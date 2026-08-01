const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const socketIo = require('socket.io');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient, io;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_MEDIA_DIR = path.join(__dir, 'assets', 'chatmedia');
const NOTIFICATIONS_DIR = path.join(__dir, 'assets', 'notifications');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_MEDIA_DIR, NOTIFICATIONS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Create notification sound file if it doesn't exist
const NOTIFICATION_SOUND = path.join(NOTIFICATIONS_DIR, 'message.mp3');
if (!fs.existsSync(NOTIFICATION_SOUND)) {
    // Create a simple silent MP3 as placeholder
    fs.writeFileSync(NOTIFICATION_SOUND, Buffer.from(''));
}

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png"
};

const VOICE = {
    welcome: "/assets/my%20user%20name.mp3",
    fakeAlert: "/assets/7%20lak%20like%20but%20its%20fake.mp3"
};

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const coverExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const groups = {};
        files.forEach(f => {
            const ext = path.extname(f).toLowerCase();
            const base = path.basename(f, ext);
            if (!groups[base]) groups[base] = { audio: null, cover: null };
            if (audioExts.includes(ext)) groups[base].audio = f;
            if (coverExts.includes(ext)) groups[base].cover = f;
        });
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions', 'notifications'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) { if (!names.includes(col)) await db.createCollection(col); }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        await db.collection('notifications').createIndex({ chatId: 1, createdAt: -1 });
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        console.log('✅ Database connected');
        return true;
    } catch (e) {
        console.error('Database error:', e.message);
        return false;
    }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

// Notification functions
async function createNotification(chatId, type, message, fromUser = null) {
    const notification = {
        chatId,
        type, // 'new_message', 'new_media', 'typing'
        message: message.substring(0, 100), // Truncate for preview
        fromUser,
        read: false,
        createdAt: new Date()
    };
    await db.collection('notifications').insertOne(notification);
    if (io) {
        io.to('admin').emit('notification', notification);
        io.to(chatId).emit('notification', notification);
    }
    return notification;
}

async function getUnreadNotifications(chatId) {
    return await db.collection('notifications')
        .find({ chatId, read: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
}

async function markNotificationRead(chatId) {
    await db.collection('notifications').updateMany(
        { chatId, read: false },
        { $set: { read: true } }
    );
}

async function createOrGetChatUser(name, phoneEmail) {
    if (!phoneEmail || !phoneEmail.trim()) return null;
    const clean = phoneEmail.trim().toLowerCase();
    let user = await db.collection('chat_users').findOne({ phoneEmail: clean });
    if (user) {
        await db.collection('chat_users').updateOne(
            { _id: user._id },
            { $set: { name, lastSeen: new Date(), status: 'active' } }
        );
        return user;
    }
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    user = { chatId, name, phoneEmail: clean, createdAt: new Date(), lastSeen: new Date(), status: 'active' };
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').deleteMany({ chatId });
    await db.collection('chat_sessions').insertOne({
        chatId, token, createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return token;
}

async function getChatUserByToken(token) {
    if (!token) return null;
    const session = await db.collection('chat_sessions').findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getChatMessages(chatId, limit = 50, before = null) {
    let query = { chatId };
    if (before) {
        const beforeDate = new Date(before);
        query.createdAt = { $lt: beforeDate };
    }
    return await db.collection('chat_messages').find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

async function saveChatMessage(chatId, sender, message, mediaUrl = null, mediaType = null) {
    const msg = { chatId, sender, message, mediaUrl, mediaType, createdAt: new Date(), read: false };
    await db.collection('chat_messages').insertOne(msg);
    await db.collection('chat_users').updateOne({ chatId }, { $set: { lastSeen: new Date() } });
    
    // Create notification
    const preview = mediaType ? `Sent a ${mediaType}` : message;
    await createNotification(chatId, mediaType ? 'new_media' : 'new_message', preview, sender);
    
    if (io) {
        io.to('admin').emit('new_message', msg);
        io.to('admin').emit('update_conversations');
        io.to(chatId).emit('new_message', msg);
    }
    return msg;
}

async function getAdminChatList() {
    const users = await db.collection('chat_users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray();
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages').findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages').countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        const notifications = await getUnreadNotifications(u.chatId);
        list.push({ 
            chatId: u.chatId, 
            name: u.name, 
            phoneEmail: u.phoneEmail, 
            lastSeen: u.lastSeen, 
            lastMessage: lastMsg, 
            unread,
            notificationCount: notifications.length,
            online: (Date.now() - new Date(u.lastSeen).getTime()) < 300000 // Online if active in last 5 minutes
        });
    }
    return list;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
    await markNotificationRead(chatId);
    if (io) {
        io.to('admin').emit('messages_read', chatId);
        io.to('admin').emit('update_conversations');
    }
}

async function updateTyping(chatId, isTyping) {
    if (io) {
        io.to('admin').emit('typing', { chatId, isTyping });
        if (isTyping) {
            await createNotification(chatId, 'typing', 'is typing...');
        }
    }
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile | Bangladesh",
        tiktokFollowers: "5,000",
        tiktokFollowing: "0",
        tiktokLikes: "50K",
        location: "Dhaka, Bangladesh"
    },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", screenshot: IMAGES.official, verified: true, followers: "5,000", following: "0", likes: "50K" },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: null, verified: true, followers: "Growing" }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger, reason: "Copies official content and logo to deceive followers.", threatLevel: "Critical", reportedCount: 156 },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers.", threatLevel: "High", reportedCount: 89 }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#075e54">
<title>Baiilla Maach | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="/socket.io/socket.io.js"></script>
<script>tailwind.config={darkMode:'class'}</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#09090b;color:#e5e5e5;min-height:100vh}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.3)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.3)}
.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}

/* Notification Styles */
.notification-container{position:fixed;top:60px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;max-width:360px}
.notification-toast{background:#1a1a2e;border:1px solid #2a2a3e;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;animation:slideIn 0.3s ease-out;box-shadow:0 8px 32px rgba(0,0,0,0.4);cursor:pointer;transition:0.2s}
.notification-toast:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,0.5)}
.notification-toast.removing{animation:slideOut 0.3s ease-in forwards}
.notification-toast .notif-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;flex-shrink:0;font-size:16px}
.notification-toast .notif-content{flex:1;min-width:0}
.notification-toast .notif-content .notif-title{font-weight:600;color:white;font-size:14px}
.notification-toast .notif-content .notif-message{font-size:12px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notification-toast .notif-content .notif-time{font-size:10px;color:#666;margin-top:2px}
.notification-toast .notif-close{background:none;border:none;color:#666;cursor:pointer;font-size:16px;padding:4px}
.notification-toast .notif-close:hover{color:white}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}

/* Chat Widget Styles */
.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.chat-btn{width:58px;height:58px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(37,211,102,0.4);transition:all 0.3s;border:none;position:relative}
.chat-btn:hover{transform:scale(1.1)}
.chat-btn svg{width:30px;height:30px;fill:white}
.chat-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;min-width:22px;height:22px;font-size:11px;display:none;align-items:center;justify-content:center;font-weight:bold;padding:0 5px;box-shadow:0 2px 8px rgba(239,68,68,0.4);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.chat-window{position:fixed;bottom:90px;right:20px;width:400px;max-width:calc(100vw - 40px);height:580px;max-height:calc(100vh - 130px);background:#111b21;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.6);display:none;flex-direction:column}
.chat-window.open{display:flex}
.chat-header{background:#202c33;padding:12px 16px;display:flex;align-items:center;gap:10px}
.chat-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;position:relative}
.chat-online{width:10px;height:10px;background:#25d366;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #202c33}
.chat-header-name{color:white;font-weight:600;font-size:15px}
.chat-header-status{color:#a5d6a7;font-size:11px}
.chat-close{background:none;border:none;color:#8696a0;font-size:20px;cursor:pointer;margin-left:auto;padding:4px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;background:#0b141a}
.msg{max-width:85%;padding:6px 12px 6px 9px;margin-bottom:4px;border-radius:8px;font-size:14px;line-height:1.45;word-wrap:break-word;animation:fadeIn 0.3s}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg-out{background:#005c4b;color:#e9edef;float:right;clear:both;border-radius:8px 0 8px 8px}
.msg-in{background:#202c33;color:#e9edef;float:left;clear:both;border-radius:0 8px 8px 8px}
.msg-time{font-size:10px;color:rgba(255,255,255,0.45);text-align:right;margin-top:3px;padding-left:15px;float:right}
.msg::after{content:'';display:table;clear:both}
.msg-media{margin:4px 0;max-width:100%;border-radius:8px}
.msg-media img{max-width:220px;border-radius:8px;max-height:220px;object-fit:cover;cursor:pointer}
.msg-media audio{width:200px;height:32px;border-radius:20px;display:block}
.msg-media video{max-width:220px;border-radius:8px;max-height:220px}
.chat-login{padding:30px 20px;text-align:center;flex:1;display:flex;flex-direction:column;justify-content:center}
.chat-login h3{color:white;margin-bottom:4px;font-size:16px}
.chat-login p{color:#8696a0;font-size:12px;margin-bottom:20px}
.chat-login input{width:100%;background:#2a3942;border:2px solid transparent;padding:10px 14px;border-radius:8px;color:white;font-size:14px;margin-bottom:10px;outline:none}
.chat-login input:focus{border-color:#00a884}
.chat-login button{width:100%;background:#00a884;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px}
.chat-login button:hover{background:#06cf9c}
.chat-input-area{background:#202c33;padding:8px 12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.chat-input-area input[type="text"]{flex:1;background:#2a3942;border:none;padding:10px 14px;border-radius:24px;color:white;font-size:14px;outline:none;min-width:100px}
.chat-input-area input[type="text"]::placeholder{color:#8696a0}
.chat-tools{display:flex;gap:4px;align-items:center}
.chat-tools button{background:transparent;border:none;color:#8696a0;font-size:18px;cursor:pointer;padding:6px 8px;border-radius:50%;transition:0.2s}
.chat-tools button:hover{background:rgba(255,255,255,0.05);color:white}
.chat-send-btn{width:38px;height:38px;border-radius:50%;background:#00a884;border:none;color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.chat-send-btn:hover{background:#06cf9c}
.typing-indicator{display:none;padding:0 16px 8px}
.typing-dots{display:flex;gap:4px;padding:8px 12px;background:#202c33;border-radius:8px;float:left;clear:both}
.typing-dot{width:7px;height:7px;border-radius:50%;background:#8696a0;animation:typing 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
@media(max-width:640px){.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:12px 12px 0 0;height:100%;max-height:100%}.notification-container{top:50px;right:10px;max-width:calc(100vw - 20px)}}
</style>
</head>
<body>
<!-- Notification Container -->
<div class="notification-container" id="notificationContainer"></div>

<!-- Notification Sound -->
<audio id="notificationSound" src="/assets/notifications/message.mp3" preload="auto"></audio>

<header class="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
<div class="max-w-5xl mx-auto px-3">
<div class="flex items-center justify-between h-12">
<div class="flex items-center gap-2">
<img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 rounded-full border-2 border-green-500 object-cover" onerror="this.style.display='none'">
<span class="text-sm font-bold gradient-text">Verification Hub</span>
</div>
<nav class="flex items-center gap-1">
<a href="#official" class="px-2 py-1 text-xs text-gray-400 hover:text-white rounded">Official</a>
<a href="#fake" class="px-2 py-1 text-xs text-gray-400 hover:text-red-400 rounded">Fakes</a>
${coverSongs.length > 0 ? '<a href="#music" class="px-2 py-1 text-xs text-gray-400 hover:text-green-400 rounded">Music</a>' : ''}
</nav>
</div>
</div>
</header>
<main class="pt-14 pb-24">
<div class="max-w-5xl mx-auto px-3">
<section class="text-center py-6">
<div class="relative inline-block mb-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-green-500 object-cover mx-auto verified-glow" onerror="this.style.display='none'">
<div class="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-[#09090b] flex items-center justify-center">
<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
</div>
<h1 class="text-xl font-extrabold gradient-text mb-1">${DATA.celebrity.fullName}</h1>
<p class="text-xs text-gray-400 mb-3">${DATA.celebrity.bio}</p>
<div class="flex justify-center gap-4 mb-3">
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokFollowers}</div><div class="text-xs text-gray-400">Followers</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokFollowing}</div><div class="text-xs text-gray-400">Following</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokLikes}</div><div class="text-xs text-gray-400">Likes</div></div>
</div>
<div class="flex justify-center gap-2 flex-wrap mb-3">
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/25 rounded-full text-xs font-semibold verified-glow">✓ Verified Official</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-full text-xs font-semibold">Creator</span>
</div>
<div class="flex justify-center gap-2">
<a href="${DATA.realAccounts[0].url}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50">TikTok</a>
<a href="${DATA.realAccounts[1].url}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50">Facebook</a>
</div>
</section>
<section id="official" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center verified-glow">
<svg class="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">✓ Official Verified Account</h2>
</div>
<div class="glass-card p-4">
<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-xs font-bold mb-3">✓ VERIFIED</span>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${DATA.realAccounts.map(acc => \`
<div class="bg-[#1f1f23] rounded-xl p-3">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase text-gray-400">\${acc.platform}</span><span class="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">Verified</span></div>
<div class="flex items-center gap-2">
\${acc.screenshot ? \`<img src="\${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover">\` : '<div class="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-lg font-bold">' + acc.platform[0] + '</div>'}
<div><div class="font-bold text-white text-sm">\${acc.username}</div><div class="text-xs text-gray-400">\${acc.followers} followers</div></div>
</div>
</div>\`).join('')}
</div>
<div class="bg-[#1f1f23] rounded-xl p-4 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-green-500 mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${DATA.realAccounts[0].url}" target="_blank" class="bg-green-500 px-5 py-2.5 rounded-full text-white font-bold text-xs hover:bg-green-600">Follow Official</a>
<p class="text-xs text-gray-500 mt-3">⚠️ This is the only authentic account</p>
</div>
</div>
</div>
</section>
<section id="fake" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center danger-glow">
<svg class="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">⚠️ Fake Accounts Detected</h2>
<span class="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full font-bold">${totalFake} Active</span>
</div>
<div class="space-y-3">
${DATA.fakeAccounts.map((a, i) => \`
<div class="glass-card p-3 border-red-500/20">
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-1.5"><span class="text-red-400 font-bold">⚠</span><span class="font-bold text-red-300 text-xs">Fake #\${i+1}</span></div>
<span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-bold">\${a.threatLevel}</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
<div class="relative rounded-xl overflow-hidden border-2 border-red-500/30">
\${a.screenshot ? \`<img src="\${a.screenshot}" alt="" class="w-full opacity-90">\` : '<div class="w-full h-40 flex items-center justify-center text-3xl text-red-500/30">FAKE</div>'}
<div class="absolute inset-0 flex items-center justify-center"><span class="bg-red-500/85 text-white px-3 py-1 rounded-lg text-xs font-extrabold">FAKE ACCOUNT</span></div>
</div>
<div class="space-y-1.5 text-sm">
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Username</span><span class="text-red-300">\${a.username}</span></div>
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Reports</span><span class="text-red-300">\${a.reportedCount}+</span></div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300">⚠️ \${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="\${a.profileUrl}" target="_blank" class="flex-1 text-center bg-red-500 px-3 py-2 rounded-full text-white text-xs font-bold hover:bg-red-600">Report</a>
<button class="flex-1 px-3 py-2 bg-[#1f1f23] border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10" onclick="navigator.clipboard.writeText('\${a.username}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)">Copy</button>
</div>
</div>\`).join('')}
</div>
<div class="text-center mt-3">
<button onclick="document.getElementById('fakeVoice').play()" class="glass px-4 py-2 rounded-full text-xs text-red-300 hover:bg-red-500/10">🔊 Voice Alert</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>
${coverSongs.length > 0 ? \`
<section id="music" class="py-4">
<div class="flex items-center gap-2 mb-3">
<span>🎵</span>
<h2 class="text-base font-bold text-white">Cover Music</h2>
<span class="text-xs text-gray-400 ml-auto">\${coverSongs.length} songs</span>
</div>
<div class="glass-card p-4">
<div class="space-y-2 max-h-64 overflow-y-auto">
\${coverSongs.map((s, i) => \`
<div class="flex items-center gap-3 p-2 hover:bg-[#1f1f23] rounded-lg cursor-pointer" onclick="playSong('\${s.audioUrl}','\${s.title}')">
<span class="text-xs text-gray-500">\${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1"><div class="text-sm text-white">\${s.title}</div><div class="text-xs text-gray-400">Cover Song</div></div>
<button class="text-green-400">▶</button>
</div>\`).join('')}
</div>
</div>
<audio id="coverAudio" preload="none"></audio>
</section>\` : ''}
</div>
</main>

<!-- Chat Widget -->
<div class="chat-widget">
<button class="chat-btn" onclick="toggleChat()" id="chatBtn">
<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
</button>
<div class="chat-badge" id="chatBadge">0</div>
</div>

<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar">H<div class="chat-online"></div></div>
<div style="flex:1">
<div class="chat-header-name">Hammad Bin Amir</div>
<div class="chat-header-status" id="statusText">Online</div>
</div>
<button class="chat-close" onclick="toggleChat()">✕</button>
</div>
<div id="chatLogin" class="chat-login">
<h3>💬 Chat with Hammad</h3>
<p>Enter your details to start</p>
<input type="text" id="userName" placeholder="Your Name">
<input type="text" id="userContact" placeholder="Phone Number or Email">
<button onclick="registerChat()">Start Chat</button>
</div>
<div id="chatUI" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages" id="chatMessages">
<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">🔒 Messages are secure</div>
</div>
<div class="typing-indicator" id="typingDiv">
<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
<div style="clear:both"></div>
</div>
<div class="chat-input-area">
<input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<div class="chat-tools">
<button onclick="document.getElementById('fileInput').click()" title="Send Photo">📷</button>
<button onclick="startVoiceRecording()" title="Send Voice" id="voiceBtn">🎤</button>
<input type="file" id="fileInput" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display:none" onchange="sendFile(this)">
</div>
<button class="chat-send-btn" onclick="sendMessage()">➤</button>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<script>
// ============ NOTIFICATION SYSTEM ============
let notificationSound;
try {
    notificationSound = document.getElementById('notificationSound');
} catch(e) {}

function showNotification(title, message, onClick) {
    // Play sound
    if (notificationSound && notificationSound.src && notificationSound.src.includes('message')) {
        notificationSound.currentTime = 0;
        notificationSound.play().catch(() => {});
    }
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, {
            body: message,
            icon: '/assets/favicon.ico',
            badge: '/assets/favicon.ico'
        });
    }
    
    // In-app toast
    const container = document.getElementById('notificationContainer');
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = \`
        <div class="notif-avatar">H</div>
        <div class="notif-content">
            <div class="notif-title">\${title}</div>
            <div class="notif-message">\${message}</div>
            <div class="notif-time">Just now</div>
        </div>
        <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
    \`;
    
    if (onClick) {
        toast.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') onClick();
        };
        toast.style.cursor = 'pointer';
    }
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
    
    // Update badge
    updateBadge();
    
    // Limit to 5 notifications
    const toasts = container.querySelectorAll('.notification-toast');
    if (toasts.length > 5) {
        toasts[0].classList.add('removing');
        setTimeout(() => toasts[0].remove(), 300);
    }
}

function updateBadge() {
    const badge = document.getElementById('chatBadge');
    const container = document.getElementById('notificationContainer');
    const count = container.querySelectorAll('.notification-toast').length;
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// ============ SOCKET.IO ============
let socket = io();
let chatToken = localStorage.getItem('chatToken');
let chatId = null;
let mediaRecorder = null;
let audioChunks = [];

setTimeout(()=>{
    const v=document.getElementById('welcomeVoice');
    if(v&&!sessionStorage.getItem('vp')){
        v.play().catch(()=>{});
        sessionStorage.setItem('vp','1');
    }
},2000);

function playSong(url,title){
    const a=document.getElementById('coverAudio');
    a.src=url;
    a.play().catch(()=>{});
    if(title)document.title=title;
}

if(chatToken){verifyToken();}

async function verifyToken(){
    try{
        const r=await fetch('/api/chat/verify?token='+encodeURIComponent(chatToken));
        const d=await r.json();
        if(d.success){
            chatId=d.chatId;
            showChatUI();
            loadMessages();
            // Join Socket.IO room
            socket.emit('join', chatId);
        } else {
            localStorage.removeItem('chatToken');
            chatToken=null;
        }
    }catch(e){}
}

function toggleChat(){
    const w=document.getElementById('chatWindow');
    w.classList.toggle('open');
    if(w.classList.contains('open')&&chatToken){
        loadMessages();
        document.getElementById('chatBadge').style.display='none';
        // Clear notifications
        document.getElementById('notificationContainer').innerHTML = '';
        updateBadge();
    }
}

function showChatUI(){
    document.getElementById('chatLogin').style.display='none';
    document.getElementById('chatUI').style.display='flex';
}

async function registerChat(){
    const name=document.getElementById('userName').value.trim();
    const contact=document.getElementById('userContact').value.trim();
    if(!name){alert('Please enter your name');return}
    if(!contact){alert('Please enter phone or email');return}
    try{
        const r=await fetch('/api/chat/register',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name,phoneEmail:contact})
        });
        const d=await r.json();
        if(d.success){
            chatToken=d.token;
            chatId=d.chatId;
            localStorage.setItem('chatToken',chatToken);
            showChatUI();
            loadMessages();
            socket.emit('join', chatId);
        } else alert(d.error||'Registration failed');
    }catch(e){alert('Connection error');}
}

async function loadMessages(){
    if(!chatToken)return;
    try{
        const r=await fetch('/api/chat/messages?token='+encodeURIComponent(chatToken)+'&t='+Date.now());
        const d=await r.json();
        if(d.success){
            const container=document.getElementById('chatMessages');
            container.innerHTML='';
            d.messages.forEach(m=>{
                const isUser=m.sender==='user';
                const div=document.createElement('div');
                let mediaHTML='';
                if(m.mediaUrl&&m.mediaType){
                    if(m.mediaType==='image')mediaHTML='<div class="msg-media"><img src="'+m.mediaUrl+'" onclick="window.open(\\''+m.mediaUrl+'\\',\\'_blank\\')" loading="lazy"></div>';
                    else if(m.mediaType==='audio')mediaHTML='<div class="msg-media"><audio controls src="'+m.mediaUrl+'"></audio></div>';
                    else if(m.mediaType==='video')mediaHTML='<div class="msg-media"><video controls src="'+m.mediaUrl+'"></video></div>';
                    else mediaHTML='<div class="msg-file">📎 <a href="'+m.mediaUrl+'" target="_blank">'+decodeURIComponent(m.mediaUrl.split('/').pop())+'</a></div>';
                }
                div.innerHTML='<div class="msg '+(isUser?'msg-out':'msg-in')+'">'+mediaHTML+(m.message?m.message:'')+'<span class="msg-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+(isUser?' ✓✓':'')+'</span></div>';
                container.appendChild(div);
            });
            container.scrollTop=container.scrollHeight;
        }else{
            localStorage.removeItem('chatToken');
            chatToken=null;
            document.getElementById('chatLogin').style.display='flex';
            document.getElementById('chatUI').style.display='none';
        }
    }catch(e){}
}

async function sendMessage(){
    const input=document.getElementById('msgInput');
    const msg=input.value.trim();
    if(!msg||!chatToken)return;
    input.value='';
    try{
        await fetch('/api/chat/send',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({token:chatToken,message:msg})
        });
    }catch(e){}
}

async function sendFile(input){
    const file=input.files[0];
    if(!file||!chatToken)return;
    const formData=new FormData();
    formData.append('token',chatToken);
    formData.append('file',file);
    try{
        await fetch('/api/chat/upload',{method:'POST',body:formData});
    }catch(e){alert('Upload error');}
    input.value='';
}

async function startVoiceRecording(){
    const btn=document.getElementById('voiceBtn');
    if(mediaRecorder&&mediaRecorder.state==='recording'){
        mediaRecorder.stop();
        btn.textContent='🎤';
        return;
    }
    try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder=new MediaRecorder(stream);
        audioChunks=[];
        mediaRecorder.ondataavailable=event=>audioChunks.push(event.data);
        mediaRecorder.onstop=async()=>{
            const audioBlob=new Blob(audioChunks,{type:'audio/webm'});
            const formData=new FormData();
            formData.append('token',chatToken);
            formData.append('file',audioBlob,'voice.webm');
            try{await fetch('/api/chat/upload',{method:'POST',body:formData});}catch(e){}
            stream.getTracks().forEach(t=>t.stop());
            btn.textContent='🎤';
        };
        mediaRecorder.start();
        btn.textContent='⏹️';
        setTimeout(()=>{
            if(mediaRecorder&&mediaRecorder.state==='recording'){
                mediaRecorder.stop();
                btn.textContent='🎤';
            }
        },60000);
    }catch(e){alert('Microphone access denied');}
}

// ============ SOCKET EVENT HANDLERS ============
socket.on('new_message', (msg) => {
    if (msg.chatId === chatId) {
        loadMessages();
        // Show notification for admin messages
        if (msg.sender === 'admin') {
            showNotification('Hammad Bin Amir', msg.message || 'Sent you a message', () => {
                toggleChat();
            });
        }
    } else {
        // Notification from other chats (for admin)
        if (msg.sender === 'user') {
            showNotification('New Message', msg.message || 'New message received', () => {
                toggleChat();
            });
        }
    }
});

socket.on('notification', (notif) => {
    if (notif.chatId === chatId) {
        showNotification('New Activity', notif.message, () => {
            toggleChat();
        });
    }
});

socket.on('typing', (data) => {
    const typingDiv = document.getElementById('typingDiv');
    if (data.chatId === chatId && data.isTyping) {
        typingDiv.style.display = 'block';
        document.getElementById('statusText').textContent = 'typing...';
        setTimeout(() => {
            typingDiv.style.display = 'none';
            document.getElementById('statusText').textContent = 'Online';
        }, 3000);
    } else {
        typingDiv.style.display = 'none';
        document.getElementById('statusText').textContent = 'Online';
    }
});

// Update page title with notification count
function updatePageTitle() {
    const badge = document.getElementById('chatBadge');
    const count = parseInt(badge.textContent) || 0;
    document.title = count > 0 ? \`(\${count}) Baiilla Maach | Verification Hub\` : 'Baiilla Maach | Verification Hub';
}

// Observer for badge changes
const badgeObserver = new MutationObserver(() => {
    updatePageTitle();
});
const badge = document.getElementById('chatBadge');
if (badge) {
    badgeObserver.observe(badge, { childList: true, characterData: true, subtree: true });
}

// Initial page title
updatePageTitle();
</script>
</body>
</html>`;
}

// Rest of the server code remains the same...
// [Previous server.js code continues here with all API routes]

const server = http.createServer(async (req, res) => {
    // ... [All previous routes remain the same]
});

io = socketIo(server);

io.on('connection', (socket) => {
    console.log('🔗 User connected:', socket.id);
    
    socket.on('join', (chatId) => {
        socket.join(chatId);
        socket.join('admin');
        console.log('📱 User joined room:', chatId);
    });
    
    socket.on('typing', (data) => {
        io.to('admin').emit('typing', data);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});

async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('🚀 Server running on port', PORT);
        console.log('📍 Admin Panel: http://localhost:' + PORT + '/admin');
        console.log('🔑 Admin Login: admin / admin123');
        console.log('💬 Real-time messaging with notifications');
        console.log('🔔 Notification system active');
    });
}

start();

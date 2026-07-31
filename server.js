const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_MEDIA_DIR = path.join(__dir, 'assets', 'chat_media');
const CHAT_VOICE_DIR = path.join(__dir, 'assets', 'chat_voice');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_MEDIA_DIR, CHAT_VOICE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) { if (!names.includes(col)) await db.createCollection(col); }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
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

// ==================== CHAT FUNCTIONS ====================
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

async function getChatMessages(chatId) {
    return await db.collection('chat_messages').find({ chatId }).sort({ createdAt: 1 }).limit(200).toArray();
}

async function saveChatMessage(chatId, sender, message, type = 'text', fileUrl = null) {
    const msg = { 
        chatId, sender, message, type, fileUrl, 
        createdAt: new Date(), read: false 
    };
    await db.collection('chat_messages').insertOne(msg);
    await db.collection('chat_users').updateOne({ chatId }, { $set: { lastSeen: new Date() } });
    return msg;
}

async function getAdminChatList() {
    const users = await db.collection('chat_users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray();
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages').findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages').countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        list.push({ chatId: u.chatId, name: u.name, phoneEmail: u.phoneEmail, lastSeen: u.lastSeen, lastMessage: lastMsg, unread });
    }
    return list;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
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

// ==================== MAIN HTML ====================
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#0084ff">
<title>Baiilla Maach | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={darkMode:'class'}</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f0f2f5;color:#1c1e21;min-height:100vh}
.dark body{background:#18191a;color:#e4e6eb}
.glass{background:rgba(255,255,255,0.9);backdrop-filter:blur(20px);border-bottom:1px solid rgba(0,0,0,0.08)}
.dark .glass{background:rgba(36,37,38,0.95);border-bottom:1px solid rgba(255,255,255,0.08)}
.glass-card{background:white;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.dark .glass-card{background:#242526;box-shadow:0 1px 2px rgba(0,0,0,0.3)}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.3)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.3)}
.gradient-text{background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700}

/* Messenger-style Chat Widget */
.messenger-btn{position:fixed;bottom:20px;right:20px;z-index:9999;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#00c6ff,#0078ff);box-shadow:0 4px 15px rgba(0,120,255,0.4);cursor:pointer;border:none;display:flex;align-items:center;justify-content:center;transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275)}
.messenger-btn:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(0,120,255,0.5)}
.messenger-btn:active{transform:scale(0.95)}
.messenger-btn svg{width:32px;height:32px;fill:white;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))}
.messenger-badge{position:absolute;top:-4px;right:-4px;background:#ff3b30;color:white;border-radius:50%;min-width:22px;height:22px;font-size:12px;display:none;align-items:center;justify-content:center;font-weight:700;border:2px solid white;padding:0 5px}
@keyframes messengerPulse{0%,100%{box-shadow:0 4px 15px rgba(0,120,255,0.4)}50%{box-shadow:0 4px 25px rgba(0,120,255,0.6)}}
.messenger-btn{animation:messengerPulse 2s infinite}

.chat-window{position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 20px);height:600px;max-height:calc(100vh - 120px);background:white;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.25);display:none;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.175,0.885,0.32,1.275)}
.dark .chat-window{background:#242526;box-shadow:0 12px 40px rgba(0,0,0,0.5)}
.chat-window.open{display:flex}
@keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}

.chat-header{background:linear-gradient(135deg,#0084ff,#00c6ff);padding:14px 16px;display:flex;align-items:center;gap:12px;color:white}
.chat-avatar{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;position:relative;overflow:hidden;border:2px solid rgba(255,255,255,0.5)}
.chat-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.chat-online{width:12px;height:12px;background:#44d62c;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid white}
.chat-header-info{flex:1}
.chat-header-name{font-weight:600;font-size:15px}
.chat-header-status{font-size:12px;opacity:0.9}
.chat-actions{display:flex;gap:8px}
.chat-action-btn{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background 0.2s}
.chat-action-btn:hover{background:rgba(255,255,255,0.3)}

.chat-messages{flex:1;overflow-y:auto;padding:12px;background:#f0f2f5;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.dark .chat-messages{background:#18191a}

.msg-wrapper{margin-bottom:8px;display:flex;animation:msgIn 0.3s ease}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-wrapper.user{justify-content:flex-end}
.msg-wrapper.admin{justify-content:flex-start}
.msg-bubble{max-width:75%;padding:8px 12px;border-radius:18px;font-size:14px;line-height:1.4;word-wrap:break-word;position:relative}
.user .msg-bubble{background:#0084ff;color:white;border-bottom-right-radius:4px}
.admin .msg-bubble{background:white;color:#1c1e21;border-bottom-left-radius:4px}
.dark .admin .msg-bubble{background:#3a3b3c;color:#e4e6eb}
.msg-image{max-width:250px;border-radius:12px;cursor:pointer;overflow:hidden}
.msg-image img{width:100%;height:auto;display:block;border-radius:12px}
.msg-voice{display:flex;align-items:center;gap:8px;padding:8px 12px;min-width:150px}
.msg-voice button{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px}
.user .msg-voice button{background:rgba(255,255,255,0.2);color:white}
.admin .msg-voice button{background:#e4e6eb;color:#0084ff}
.voice-wave{flex:1;height:30px;display:flex;align-items:center;gap:2px}
.voice-wave span{width:3px;background:currentColor;border-radius:2px;animation:wave 1s ease-in-out infinite;opacity:0.6}
@keyframes wave{0%,100%{height:8px}50%{height:20px}}
.msg-time{font-size:11px;margin-top:4px;opacity:0.7;display:flex;align-items:center;gap:4px;justify-content:flex-end}

.chat-input-area{background:white;padding:8px 12px;display:flex;align-items:center;gap:8px;border-top:1px solid #e4e6eb}
.dark .chat-input-area{background:#242526;border-top:1px solid #3a3b3c}
.chat-input-actions{display:flex;gap:4px}
.chat-input-btn{width:36px;height:36px;border-radius:50%;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#0084ff;font-size:18px;transition:background 0.2s}
.chat-input-btn:hover{background:rgba(0,132,255,0.1)}
.chat-text-input{flex:1;background:#f0f2f5;border:none;border-radius:20px;padding:10px 16px;font-size:14px;outline:none;color:#1c1e21}
.dark .chat-text-input{background:#3a3b3c;color:#e4e6eb}
.chat-text-input::placeholder{color:#8a8d91}
.chat-send-btn{width:38px;height:38px;border-radius:50%;background:#0084ff;border:none;color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
.chat-send-btn:hover{background:#0073e6;transform:scale(1.05)}
.chat-send-btn:disabled{opacity:0.5;cursor:not-allowed}
.voice-record-btn{width:38px;height:38px;border-radius:50%;background:#ff3b30;border:none;color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,0.4)}50%{box-shadow:0 0 0 12px rgba(255,59,48,0)}}
.recording-timer{font-size:12px;color:#ff3b30;font-weight:600}

.chat-login{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:30px 20px;text-align:center;background:#f0f2f5}
.dark .chat-login{background:#18191a}
.chat-login-avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#0084ff,#00c6ff);display:flex;align-items:center;justify-content:center;font-size:36px;color:white;margin-bottom:16px;overflow:hidden}
.chat-login-avatar img{width:100%;height:100%;object-fit:cover}
.chat-login h3{font-size:18px;font-weight:700;margin-bottom:6px;color:#1c1e21}
.dark .chat-login h3{color:#e4e6eb}
.chat-login p{font-size:13px;color:#65676b;margin-bottom:20px}
.chat-login input{width:100%;background:white;border:2px solid #e4e6eb;padding:12px 16px;border-radius:12px;font-size:14px;margin-bottom:10px;outline:none;transition:border 0.2s}
.dark .chat-login input{background:#3a3b3c;border-color:#3a3b3c;color:#e4e6eb}
.chat-login input:focus{border-color:#0084ff}
.chat-login button{width:100%;background:linear-gradient(135deg,#0084ff,#00c6ff);color:white;border:none;padding:14px;border-radius:12px;font-weight:600;cursor:pointer;font-size:15px;transition:transform 0.2s}
.chat-login button:hover{transform:translateY(-1px)}
.chat-login button:active{transform:translateY(0)}

@media(max-width:640px){
.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:16px 16px 0 0;height:100%;max-height:100%}
.messenger-btn{bottom:16px;right:16px;width:56px;height:56px}
}
</style>
</head>
<body>

<!-- NAVBAR -->
<header class="glass sticky top-0 z-40">
<div class="max-w-5xl mx-auto px-4">
<div class="flex items-center justify-between h-14">
<div class="flex items-center gap-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-9 h-9 rounded-full border-2 border-green-500 object-cover" onerror="this.style.display='none'">
<span class="text-base font-bold gradient-text">Verification Hub</span>
</div>
<nav class="flex items-center gap-1">
<a href="#official" class="px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 rounded-lg font-medium">Official</a>
<a href="#fake" class="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 rounded-lg font-medium">Fakes</a>
${coverSongs.length > 0 ? '<a href="#music" class="px-3 py-1.5 text-sm text-gray-600 hover:text-green-600 rounded-lg font-medium">Music</a>' : ''}
</nav>
</div>
</div>
</header>

<main class="pt-16 pb-28">
<div class="max-w-5xl mx-auto px-4">

<!-- Profile Section -->
<section class="text-center py-8">
<div class="relative inline-block mb-4">
<img src="${DATA.celebrity.photo}" alt="" class="w-24 h-24 rounded-full border-3 border-green-500 object-cover mx-auto verified-glow" onerror="this.style.display='none'">
<div class="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-3 border-white flex items-center justify-center">
<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
</div>
<h1 class="text-2xl font-extrabold gradient-text mb-1">${DATA.celebrity.fullName}</h1>
<p class="text-sm text-gray-500 mb-4">${DATA.celebrity.bio}</p>
<div class="flex justify-center gap-4 mb-4">
<div class="glass-card rounded-xl px-5 py-3"><div class="text-xl font-bold">${DATA.celebrity.tiktokFollowers}</div><div class="text-xs text-gray-500">Followers</div></div>
<div class="glass-card rounded-xl px-5 py-3"><div class="text-xl font-bold">${DATA.celebrity.tiktokFollowing}</div><div class="text-xs text-gray-500">Following</div></div>
<div class="glass-card rounded-xl px-5 py-3"><div class="text-xl font-bold">${DATA.celebrity.tiktokLikes}</div><div class="text-xs text-gray-500">Likes</div></div>
</div>
<div class="flex justify-center gap-2 flex-wrap mb-4">
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-semibold verified-glow">✓ Verified Official</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-full text-xs font-semibold">Creator</span>
</div>
<div class="flex justify-center gap-3">
<a href="${DATA.realAccounts[0].url}" target="_blank" class="inline-flex items-center gap-1.5 px-5 py-2.5 glass-card rounded-full text-sm font-semibold hover:shadow-md transition-shadow">TikTok</a>
<a href="${DATA.realAccounts[1].url}" target="_blank" class="inline-flex items-center gap-1.5 px-5 py-2.5 glass-card rounded-full text-sm font-semibold hover:shadow-md transition-shadow">Facebook</a>
</div>
</section>

<!-- Official Accounts -->
<section id="official" class="py-6">
<div class="flex items-center gap-2 mb-4">
<div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center verified-glow">
<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-lg font-bold">✓ Official Verified Account</h2>
</div>
<div class="glass-card p-5">
<span class="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-bold mb-4">✓ VERIFIED</span>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
<div class="space-y-3">
${DATA.realAccounts.map(acc => `
<div class="bg-gray-50 rounded-xl p-4">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase text-gray-500 font-semibold">${acc.platform}</span><span class="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full font-semibold">Verified</span></div>
<div class="flex items-center gap-3">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover">` : '<div class="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">' + acc.platform[0] + '</div>'}
<div><div class="font-bold text-sm">${acc.username}</div><div class="text-xs text-gray-500">${acc.followers} followers</div></div>
</div>
</div>`).join('')}
</div>
<div class="bg-gray-50 rounded-xl p-5 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-16 h-16 rounded-full border-2 border-green-500 mb-3" onerror="this.style.display='none'">
<div class="font-bold text-sm">@baiillamaach_official</div>
<div class="text-xs text-gray-500 mb-4">TikTok • Facebook</div>
<a href="${DATA.realAccounts[0].url}" target="_blank" class="bg-green-500 px-6 py-2.5 rounded-full text-white font-bold text-sm hover:bg-green-600 transition-colors">Follow Official</a>
<p class="text-xs text-gray-400 mt-3">⚠️ This is the only authentic account</p>
</div>
</div>
</div>
</section>

<!-- Fake Accounts -->
<section id="fake" class="py-6">
<div class="flex items-center gap-2 mb-4">
<div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center danger-glow">
<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-lg font-bold">⚠️ Fake Accounts Detected</h2>
<span class="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full font-bold">${totalFake} Active</span>
</div>
<div class="space-y-4">
${DATA.fakeAccounts.map((a, i) => `
<div class="glass-card p-4 border-l-4 border-red-500">
<div class="flex items-center justify-between mb-3">
<div class="flex items-center gap-2"><span class="text-red-500 font-bold">⚠</span><span class="font-bold text-red-600 text-sm">Fake #${i+1}</span></div>
<span class="px-3 py-1 bg-red-50 text-red-600 text-xs rounded-full font-bold">${a.threatLevel}</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
<div class="relative rounded-xl overflow-hidden border-2 border-red-200">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full opacity-90">` : '<div class="w-full h-40 flex items-center justify-center text-3xl text-red-300 bg-red-50">FAKE</div>'}
<div class="absolute inset-0 flex items-center justify-center"><span class="bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-extrabold">FAKE ACCOUNT</span></div>
</div>
<div class="space-y-2 text-sm">
<div class="flex justify-between bg-gray-50 rounded-lg px-3 py-2"><span class="text-gray-500">Username</span><span class="text-red-600 font-medium">${a.username}</span></div>
<div class="flex justify-between bg-gray-50 rounded-lg px-3 py-2"><span class="text-gray-500">Reports</span><span class="text-red-600 font-medium">${a.reportedCount}+</span></div>
<div class="bg-red-50 rounded-lg p-3 text-xs text-red-600">⚠️ ${a.reason}</div>
</div>
</div>
<div class="flex gap-3 mt-3">
<a href="${a.profileUrl}" target="_blank" class="flex-1 text-center bg-red-500 px-4 py-2.5 rounded-full text-white text-xs font-bold hover:bg-red-600 transition-colors">Report</a>
<button class="flex-1 px-4 py-2.5 bg-gray-100 border border-red-200 text-red-500 rounded-full text-xs font-bold hover:bg-red-50 transition-colors" onclick="navigator.clipboard.writeText('${a.username}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)">Copy</button>
</div>
</div>`).join('')}
</div>
<div class="text-center mt-4">
<button onclick="document.getElementById('fakeVoice').play()" class="glass-card px-5 py-2.5 rounded-full text-sm text-red-500 hover:bg-red-50 transition-colors">🔊 Voice Alert</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="py-6">
<div class="flex items-center gap-2 mb-4">
<span class="text-2xl">🎵</span>
<h2 class="text-lg font-bold">Cover Music</h2>
<span class="text-sm text-gray-500 ml-auto">${coverSongs.length} songs</span>
</div>
<div class="glass-card p-4">
<div class="space-y-1 max-h-72 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" onclick="playSong('${s.audioUrl}','${s.title}')">
<span class="text-xs text-gray-400 font-mono">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1"><div class="text-sm font-medium">${s.title}</div><div class="text-xs text-gray-400">Cover Song</div></div>
<button class="text-blue-500">▶</button>
</div>`).join('')}
</div>
</div>
<audio id="coverAudio" preload="none"></audio>
</section>` : ''}

</div>
</main>

<!-- ============ MESSENGER-STYLE CHAT WIDGET ============ -->
<div class="chat-widget">
<button class="messenger-btn" onclick="toggleChat()" id="chatBtn">
<svg viewBox="0 0 36 36"><path d="M18 2C9.16 2 2 8.65 2 16.79c0 4.66 2.33 8.82 5.98 11.53V34l5.47-3.02c1.45.4 2.98.61 4.55.61 8.84 0 16-6.65 16-14.79S26.84 2 18 2zm1.39 20.53l-4.07-4.34-7.95 4.34 8.74-9.27 4.15 4.34 7.86-4.34-8.73 9.27z"/></svg>
<span class="messenger-badge" id="unreadBadge">0</span>
</button>

<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar" id="adminAvatar">
<img src="${DATA.celebrity.photo}" alt="" onerror="this.parentElement.innerHTML='H'">
<div class="chat-online"></div>
</div>
<div class="chat-header-info">
<div class="chat-header-name">Hammad Bin Amir</div>
<div class="chat-header-status" id="statusText">Active now</div>
</div>
<div class="chat-actions">
<button class="chat-action-btn" onclick="toggleChat()">✕</button>
</div>
</div>

<div id="chatLogin" class="chat-login">
<div class="chat-login-avatar">
<img src="${DATA.celebrity.photo}" alt="" onerror="this.innerHTML='H'">
</div>
<h3>Chat with Hammad</h3>
<p>Enter your details to start messaging</p>
<input type="text" id="userName" placeholder="Your name" autocomplete="name">
<input type="text" id="userContact" placeholder="Phone number or email" autocomplete="email">
<button onclick="registerChat()">Start Chat</button>
</div>

<div id="chatUI" style="display:none;flex:1;flex-direction:column;height:100%">
<div class="chat-messages" id="chatMessages">
<div style="text-align:center;color:#8a8d91;font-size:12px;padding:20px">
🔒 Messages are end-to-end encrypted
</div>
</div>
<div class="chat-input-area">
<input type="file" id="imageInput" accept="image/*" style="display:none" onchange="sendImage()">
<button class="chat-input-btn" onclick="document.getElementById('imageInput').click()" title="Send photo">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/></svg>
</button>
<input type="text" id="msgInput" class="chat-text-input" placeholder="Aa" onkeypress="if(event.key==='Enter')sendTextMessage()">
<button id="voiceBtn" class="chat-input-btn" onclick="startVoiceRecording()" title="Record voice">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
</button>
<button id="sendBtn" class="chat-send-btn" onclick="sendTextMessage()" style="display:none">
<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
</button>
</div>
<div id="recordingUI" style="display:none;background:#f0f2f5;padding:8px 16px;text-align:center">
<span class="recording-timer" id="recordingTimer">00:00</span>
<button class="voice-record-btn" onclick="stopVoiceRecording()">⏹ Stop</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<script>
// Welcome voice
setTimeout(()=>{
const v=document.getElementById('welcomeVoice');
if(v&&!sessionStorage.getItem('vp')){
v.play().catch(()=>{});
sessionStorage.setItem('vp','1')
}
},2000);

// Music player
function playSong(url,title){
const a=document.getElementById('coverAudio');
a.src=url;
a.play().catch(()=>{});
if(title)document.title='🎵 '+title
}

// ============ CHAT SYSTEM ============
let chatToken = localStorage.getItem('chatToken');
let chatId = null;
let pollInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimerInterval = null;
let recordingSeconds = 0;

// Auto login
if(chatToken) verifyToken();

async function verifyToken(){
try{
const r = await fetch('/api/chat/verify?token=' + encodeURIComponent(chatToken));
const d = await r.json();
if(d.success){
chatId = d.chatId;
showChatUI();
loadMessages();
startPolling();
} else {
localStorage.removeItem('chatToken');
chatToken = null;
}
}catch(e){console.error('Verify error:',e)}
}

function toggleChat(){
const w = document.getElementById('chatWindow');
w.classList.toggle('open');
if(w.classList.contains('open') && chatToken){
loadMessages();
updateUnreadBadge(0);
}
}

function showChatUI(){
document.getElementById('chatLogin').style.display = 'none';
document.getElementById('chatUI').style.display = 'flex';
updateSendButton();
}

async function registerChat(){
const name = document.getElementById('userName').value.trim();
const contact = document.getElementById('userContact').value.trim();

if(!name){alert('Please enter your name');return}
if(!contact){alert('Please enter phone number or email');return}

const btn = document.querySelector('#chatLogin button');
btn.textContent = 'Connecting...';
btn.disabled = true;

try{
const r = await fetch('/api/chat/register', {
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({name, phoneEmail:contact})
});
const d = await r.json();

if(d.success){
chatToken = d.token;
chatId = d.chatId;
localStorage.setItem('chatToken', chatToken);
showChatUI();
loadMessages();
startPolling();
} else {
alert(d.error || 'Registration failed. Please try again.');
}
}catch(e){
alert('Connection error. Please check your internet and try again.');
}finally{
btn.textContent = 'Start Chat';
btn.disabled = false;
}
}

function startPolling(){
if(pollInterval) clearInterval(pollInterval);
pollInterval = setInterval(loadMessages, 3000);
}

async function loadMessages(){
if(!chatToken) return;
try{
const r = await fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken) + '&t=' + Date.now());
const d = await r.json();

if(d.success){
const container = document.getElementById('chatMessages');
const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

container.innerHTML = '<div style="text-align:center;color:#8a8d91;font-size:12px;padding:10px">🔒 Messages are secure</div>';

d.messages.forEach(m => {
renderMessage(m, container);
});

if(wasAtBottom) container.scrollTop = container.scrollHeight;
} else {
clearInterval(pollInterval);
localStorage.removeItem('chatToken');
chatToken = null;
document.getElementById('chatLogin').style.display = 'flex';
document.getElementById('chatUI').style.display = 'none';
}
}catch(e){console.error('Load messages error:',e)}
}

function renderMessage(m, container){
const wrapper = document.createElement('div');
wrapper.className = 'msg-wrapper ' + (m.sender === 'user' ? 'user' : 'admin');

const bubble = document.createElement('div');
bubble.className = 'msg-bubble';

if(m.type === 'image' && m.fileUrl){
bubble.className += ' msg-image';
bubble.innerHTML = '<img src="' + m.fileUrl + '" alt="Photo" onclick="window.open(\'' + m.fileUrl + '\')" loading="lazy">';
} else if(m.type === 'voice' && m.fileUrl){
bubble.className += ' msg-voice';
bubble.innerHTML = 
'<button onclick="playVoice(\'' + m.fileUrl + '\', this)">▶</button>' +
'<div class="voice-wave">' +
Array.from({length:8}, (_,i) => '<span style="animation-delay:' + (i*0.12) + 's;height:' + (8+Math.random()*16) + 'px"></span>').join('') +
'</div>';
} else {
bubble.textContent = m.message;
}

const time = document.createElement('div');
time.className = 'msg-time';
time.innerHTML = new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + 
(m.sender === 'user' ? ' <span style="font-size:10px">✓</span>' : '');

bubble.appendChild(time);
wrapper.appendChild(bubble);
container.appendChild(wrapper);
}

function updateSendButton(){
const input = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');

if(input.value.trim()){
sendBtn.style.display = 'flex';
voiceBtn.style.display = 'none';
} else {
sendBtn.style.display = 'none';
voiceBtn.style.display = 'flex';
}
}

document.getElementById('msgInput').addEventListener('input', updateSendButton);

async function sendTextMessage(){
const input = document.getElementById('msgInput');
const msg = input.value.trim();
if(!msg || !chatToken) return;

input.value = '';
updateSendButton();

try{
const r = await fetch('/api/chat/send', {
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({token:chatToken, message:msg, type:'text'})
});
const d = await r.json();
if(d.success) loadMessages();
}catch(e){console.error('Send error:',e)}
}

function sendImage(){
const file = document.getElementById('imageInput').files[0];
if(!file || !chatToken) return;

const formData = new FormData();
formData.append('image', file);
formData.append('token', chatToken);

fetch('/api/chat/send-image', {
method:'POST',
body:formData
}).then(r => r.json()).then(d => {
if(d.success) loadMessages();
}).catch(e => console.error('Image send error:',e));

document.getElementById('imageInput').value = '';
}

async function startVoiceRecording(){
if(!chatToken) return;

try{
const stream = await navigator.mediaDevices.getUserMedia({audio:true});
mediaRecorder = new MediaRecorder(stream, {mimeType:'audio/webm'});
audioChunks = [];

mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
mediaRecorder.onstop = () => {
stream.getTracks().forEach(track => track.stop());
sendVoiceMessage();
};

mediaRecorder.start();
recordingSeconds = 0;

document.getElementById('recordingUI').style.display = 'block';
document.querySelector('.chat-input-area').style.display = 'none';
document.getElementById('recordingTimer').textContent = '00:00';

recordingTimerInterval = setInterval(() => {
recordingSeconds++;
const mins = Math.floor(recordingSeconds/60).toString().padStart(2,'0');
const secs = (recordingSeconds%60).toString().padStart(2,'0');
document.getElementById('recordingTimer').textContent = mins + ':' + secs;
}, 1000);

}catch(e){
alert('Microphone access denied. Please allow microphone access to record voice messages.');
}
}

function stopVoiceRecording(){
if(mediaRecorder && mediaRecorder.state === 'recording'){
mediaRecorder.stop();
clearInterval(recordingTimerInterval);
document.getElementById('recordingUI').style.display = 'none';
document.querySelector('.chat-input-area').style.display = 'flex';
}
}

async function sendVoiceMessage(){
if(audioChunks.length === 0) return;

const audioBlob = new Blob(audioChunks, {type:'audio/webm'});
const formData = new FormData();
formData.append('voice', audioBlob, 'voice.webm');
formData.append('token', chatToken);

try{
const r = await fetch('/api/chat/send-voice', {
method:'POST',
body:formData
});
const d = await r.json();
if(d.success) loadMessages();
}catch(e){console.error('Voice send error:',e)}
audioChunks = [];
}

function playVoice(url, btn){
const audio = new Audio(url);
const icon = btn;
icon.textContent = '⏸';
audio.play();
audio.onended = () => { icon.textContent = '▶' };
audio.onpause = () => { icon.textContent = '▶' };
icon.onclick = () => {
if(audio.paused){
audio.play();
icon.textContent = '⏸';
} else {
audio.pause();
icon.textContent = '▶';
}
};
}

function updateUnreadBadge(count){
const badge = document.getElementById('unreadBadge');
if(count > 0){
badge.style.display = 'flex';
badge.textContent = count > 99 ? '99+' : count;
} else {
badge.style.display = 'none';
}
}
</script>
</body>
</html>`;
}

// ==================== ADMIN HTML ====================
function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="bg-white p-8 rounded-2xl w-full max-w-sm shadow-lg"><h2 class="text-xl font-bold text-gray-800 text-center mb-6">Admin Login</h2>${error?`<div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm text-center">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="mb-4"><label class="block text-gray-600 text-sm mb-1">Username</label><input type="text" name="username" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" required></div><div class="mb-5"><label class="block text-gray-600 text-sm mb-1">Password</label><input type="password" name="password" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" required></div><button type="submit" class="w-full py-3 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600">Sign In</button></form><div class="text-center mt-5"><a href="/" class="text-sm text-gray-400 hover:text-gray-600">Back</a></div></div></body></html>`;
}

async function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const chatList = await getAdminChatList();
    
    const photoHTML = photos.map(p => `
<div class="glass-card overflow-hidden">
<img src="${p.path}" class="w-full h-40 object-cover">
<div class="p-3">${p.caption?`<p class="text-sm text-gray-700">${p.caption}</p>`:''}<p class="text-xs text-gray-400 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p></div>
<form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="w-full py-2 bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 rounded-b-lg" onclick="return confirm('Delete?')">Delete</button></form>
</div>`).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>.glass-card{background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}body{background:#f0f2f5;font-family:-apple-system,sans-serif}</style></head>
<body>
<header class="glass-card sticky top-0 z-50 p-4 mb-6"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-blue-600">Admin Panel</h1><div class="flex gap-2"><a href="/admin/chat" class="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">💬 Chat Panel</a><a href="/" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Site</a><a href="/admin/logout" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Logout</a></div></div></header>
<div class="max-w-6xl mx-auto px-4">
${msg?`<div class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl mb-4 text-sm">${msg}</div>`:''}
${err?`<div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">${err}</div>`:''}
<form method="POST" action="/admin/upload" enctype="multipart/form-data" class="glass-card p-4 mb-6">
<h2 class="font-bold text-gray-700 mb-3">Upload Photo</h2>
<div class="flex gap-3"><input type="file" name="photo" accept="image/*" class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm" required>
<button type="submit" class="px-6 py-3 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600">Upload</button></div>
<input type="text" name="caption" placeholder="Caption (optional)" class="w-full mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
</form>
<h2 class="text-lg font-bold text-gray-800 mb-4">Gallery (${photos.length})</h2>
${photos.length?`<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">${photoHTML}</div>`:'<p class="text-gray-500 text-center py-12">No photos yet</p>'}
</div></body></html>`;
}

// ==================== SERVER ====================
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Static assets
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        const allowedDirs = [ASSETS_DIR, CHAT_MEDIA_DIR, CHAT_VOICE_DIR];
        if (!allowedDirs.some(dir => assetPath.startsWith(dir))) { 
            res.writeHead(403); res.end(); return; 
        }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { 
                '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
                '.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml',
                '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg',
                '.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac',
                '.webm':'audio/webm'
            };
            res.writeHead(200, { 
                'Content-Type': types[ext] || 'application/octet-stream', 
                'Cache-Control': 'public, max-age=86400' 
            });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    // ==================== CHAT API ====================
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                if (!name || !phoneEmail) { 
                    res.writeHead(400, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false, error: 'All fields required' })); 
                    return; 
                }
                
                const user = await createOrGetChatUser(name, phoneEmail);
                if (!user) { 
                    res.writeHead(500, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false, error: 'Failed to create user' })); 
                    return; 
                }
                
                const token = await createChatSession(user.chatId);
                
                // Send welcome message if first time
                const messages = await getChatMessages(user.chatId);
                if (messages.length === 0) {
                    await saveChatMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to the chat. How can I help you today?');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token, name: user.name }));
            } catch (e) {
                console.error('Register error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });
        return;
    }

    if (pathname === '/api/chat/verify' && method === 'GET') {
        const token = parsedUrl.query.token;
        const user = await getChatUserByToken(token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!user, chatId: user ? user.chatId : null }));
        return;
    }

    if (pathname === '/api/chat/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        if (!token) { 
            res.writeHead(401, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ success: false })); 
            return; 
        }
        
        const user = await getChatUserByToken(token);
        if (!user) { 
            res.writeHead(401, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ success: false, error: 'Invalid token' })); 
            return; 
        }
        
        const messages = await getChatMessages(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }

    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { token, message, type } = JSON.parse(body);
                if (!token || !message) { 
                    res.writeHead(400, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false })); 
                    return; 
                }
                
                const user = await getChatUserByToken(token);
                if (!user) { 
                    res.writeHead(401, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false, error: 'Invalid token' })); 
                    return; 
                }
                
                await saveChatMessage(user.chatId, 'user', message, type || 'text');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('Send error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    if (pathname === '/api/chat/send-image' && method === 'POST') {
        const form = new formidable.IncomingForm({ 
            uploadDir: CHAT_MEDIA_DIR, 
            keepExtensions: true, 
            maxFileSize: 10 * 1024 * 1024 
        });
        form.parse(req, async (err, fields, files) => {
            try {
                const token = Array.isArray(fields.token) ? fields.token[0] : fields.token;
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
                    return;
                }
                
                const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
                if (!imageFile || !imageFile.originalFilename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No file' }));
                    return;
                }
                
                const filename = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + path.extname(imageFile.originalFilename);
                const newPath = path.join(CHAT_MEDIA_DIR, filename);
                fs.renameSync(imageFile.filepath, newPath);
                
                const fileUrl = '/assets/chat_media/' + filename;
                await saveChatMessage(user.chatId, 'user', '📷 Photo', 'image', fileUrl);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, fileUrl }));
            } catch (e) {
                console.error('Image upload error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Upload failed' }));
            }
        });
        return;
    }

    if (pathname === '/api/chat/send-voice' && method === 'POST') {
        const form = new formidable.IncomingForm({ 
            uploadDir: CHAT_VOICE_DIR, 
            keepExtensions: true, 
            maxFileSize: 5 * 1024 * 1024 
        });
        form.parse(req, async (err, fields, files) => {
            try {
                const token = Array.isArray(fields.token) ? fields.token[0] : fields.token;
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
                    return;
                }
                
                const voiceFile = Array.isArray(files.voice) ? files.voice[0] : files.voice;
                if (!voiceFile || !voiceFile.originalFilename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No file' }));
                    return;
                }
                
                const filename = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.webm';
                const newPath = path.join(CHAT_VOICE_DIR, filename);
                fs.renameSync(voiceFile.filepath, newPath);
                
                const fileUrl = '/assets/chat_voice/' + filename;
                await saveChatMessage(user.chatId, 'user', '🎤 Voice message', 'voice', fileUrl);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, fileUrl }));
            } catch (e) {
                console.error('Voice upload error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Upload failed' }));
            }
        });
        return;
    }

    // ==================== ADMIN ROUTES ====================
    if (pathname === '/admin/chat' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        
        const chatId = parsedUrl.query.chatId;
        const chatList = await getAdminChatList();
        let messages = [];
        
        if (chatId) {
            messages = await getChatMessages(chatId);
            await markMessagesRead(chatId);
        }
        
        const userList = chatList.map(c => `
<div class="p-3 hover:bg-gray-100 cursor-pointer border-b ${c.chatId === chatId ? 'bg-blue-50 border-l-3 border-blue-500' : ''}" onclick="location.href='/admin/chat?chatId=${c.chatId}'">
<div class="flex justify-between items-center">
<div><div class="text-sm font-semibold">${c.name}</div><div class="text-xs text-gray-500">${c.phoneEmail}</div></div>
${c.unread > 0 ? `<span class="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">${c.unread}</span>` : ''}
</div>
${c.lastMessage ? `<div class="text-xs text-gray-400 mt-1 truncate">${c.lastMessage.message}</div>` : ''}
</div>`).join('');

        const msgHTML = messages.map(m => {
            if(m.type === 'image' && m.fileUrl) {
                return `<div class="flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'} mb-3">
<div class="max-w-[70%]"><img src="${m.fileUrl}" class="rounded-xl max-w-[250px]" onclick="window.open('${m.fileUrl}')">
<div class="text-xs text-gray-400 mt-1">${new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div></div>`;
            }
            if(m.type === 'voice' && m.fileUrl) {
                return `<div class="flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'} mb-3">
<div class="max-w-[70%] px-4 py-2 rounded-xl ${m.sender === 'user' ? 'bg-gray-100' : 'bg-blue-500 text-white'}">
<audio controls src="${m.fileUrl}" style="width:200px;height:30px"></audio>
<div class="text-xs mt-1">${new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div></div>`;
            }
            return `<div class="flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'} mb-3">
<div class="max-w-[70%] px-4 py-2 rounded-xl text-sm ${m.sender === 'user' ? 'bg-gray-100 text-gray-800' : 'bg-blue-500 text-white'}">
${m.message}
<div class="text-xs mt-1 opacity-70 text-right">${new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
</div></div>`;
        }).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Chat Panel</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{background:white;font-family:-apple-system,sans-serif;height:100vh;display:flex;margin:0}
.sidebar{width:350px;background:#f0f2f5;border-right:1px solid #e4e6eb;display:flex;flex-direction:column}
.main{flex:1;display:flex;flex-direction:column}
.header{background:white;padding:12px 16px;font-weight:600;border-bottom:1px solid #e4e6eb}
.messages{flex:1;overflow-y:auto;padding:16px;background:#f0f2f5}
.input-area{background:white;padding:10px 16px;display:flex;gap:8px;border-top:1px solid #e4e6eb}
.input-area input{flex:1;background:#f0f2f5;border:none;padding:10px 16px;border-radius:24px;outline:none;font-size:14px}
.input-area button{background:#0084ff;color:white;border:none;padding:10px 20px;border-radius:24px;cursor:pointer;font-weight:600;font-size:14px}
.input-area button:hover{background:#0073e6}
</style></head>
<body>
<div class="sidebar">
<div class="header flex justify-between items-center"><span>💬 Chats</span><a href="/admin" class="text-sm text-gray-500 hover:text-blue-500">← Admin</a></div>
<div class="flex-1 overflow-y-auto">${userList}</div>
</div>
<div class="main">
${chatId ? `
<div class="header">Chat with ${chatList.find(c=>c.chatId===chatId)?.name || 'User'}</div>
<div class="messages" id="msgContainer">${msgHTML || '<div class="text-gray-500 text-center py-8">No messages</div>'}</div>
<div class="input-area">
<input type="text" id="adminMsg" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendAdminMsg()">
<button onclick="sendAdminMsg()">Send</button>
</div>
<script>
let cid = '${chatId}';
async function loadMsgs(){
try{
const r = await fetch('/api/admin/messages?chatId=' + cid);
const d = await r.json();
if(d.success){
let html = '';
d.messages.forEach(m => {
if(m.type==='image'&&m.fileUrl){
html += '<div class="flex '+(m.sender==='user'?'justify-start':'justify-end')+' mb-3"><div class="max-w-[70%]"><img src="'+m.fileUrl+'" class="rounded-xl max-w-[250px]" onclick="window.open(\''+m.fileUrl+'\')"><div class="text-xs text-gray-400 mt-1">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div></div>';
} else if(m.type==='voice'&&m.fileUrl){
html += '<div class="flex '+(m.sender==='user'?'justify-start':'justify-end')+' mb-3"><div class="max-w-[70%] px-4 py-2 rounded-xl '+(m.sender==='user'?'bg-gray-100':'bg-blue-500 text-white')+'"><audio controls src="'+m.fileUrl+'" style="width:200px;height:30px"></audio><div class="text-xs mt-1">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div></div>';
} else {
html += '<div class="flex '+(m.sender==='user'?'justify-start':'justify-end')+' mb-3"><div class="max-w-[70%] px-4 py-2 rounded-xl text-sm '+(m.sender==='user'?'bg-gray-100 text-gray-800':'bg-blue-500 text-white')+'">'+m.message+'<div class="text-xs mt-1 opacity-70 text-right">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div></div>';
}
});
document.getElementById('msgContainer').innerHTML = html;
const c = document.getElementById('msgContainer');
c.scrollTop = c.scrollHeight;
}
}catch(e){}
}
async function sendAdminMsg(){
const input = document.getElementById('adminMsg');
const msg = input.value.trim();
if(!msg) return;
input.value = '';
try{
await fetch('/api/admin/send', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:cid, message:msg, type:'text'})});
loadMsgs();
}catch(e){}
}
setInterval(loadMsgs, 3000);
</script>` : '<div class="flex-1 flex items-center justify-center text-gray-500">Select a conversation</div>'}
</div>
</body></html>`);
        return;
    }

    if (pathname === '/api/admin/messages' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        
        const chatId = parsedUrl.query.chatId;
        const messages = await getChatMessages(chatId);
        await markMessagesRead(chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }

    if (pathname === '/api/admin/send' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const { chatId, message, type } = JSON.parse(body);
            await saveChatMessage(chatId, 'admin', message, type || 'text');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) {
            const p = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(p));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }

    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'), params.get('password'))) {
                const sid = createSession(params.get('username'));
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid credentials'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' });
        res.end();
        return;
    }

    if (pathname === '/admin/upload' && method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true, maxFileSize: 10 * 1024 * 1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, '', 'Upload error')); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf || !pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, '', 'No file')); return; }
            const fn = Date.now() + '_' + pf.originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
            try {
                fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                await savePhoto({ path: '/assets/gallery/' + fn, caption: fields.caption ? (Array.isArray(fields.caption) ? fields.caption[0] : fields.caption) : '' });
                const p = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(await getAdminPanelHTML(p, 'Uploaded'));
            } catch (e) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, '', 'Save error')); }
        });
        return;
    }

    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            try {
                const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(params.get('photoId')) });
                if (photo) { const fp = path.join(__dir, photo.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
                await deletePhoto(params.get('photoId'));
            } catch (e) { }
            const p = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(p, 'Deleted'));
        });
        return;
    }

    // Home page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getMainHTML());
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end('404');
});

async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('✅ Server running on port', PORT);
        console.log('👤 Admin: /admin (admin / admin123)');
        console.log('💬 Chat uses polling with Messenger-style UI');
    });
}

start();

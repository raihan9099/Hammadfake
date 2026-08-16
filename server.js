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

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_MEDIA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ICONS = {
    voiceCall: "/assets/cpl.png",
    videoCall: "/assets/s.png",
    camera: "/assets/1p.g.png",
    chatContact: "/assets/cpn.png",
    sendMessage: "/assets/dv.png",
    sendAlt: "/assets/x.png",
    voicePlay: "/assets/dq.png",
    voicePause: "/assets/do.png",
    voiceAudio: "/assets/dj.png",
    sentStatus: "/assets/v.png",
    userProfile: "/assets/u.png",
    fullscreen: "/assets/ef.png",
    refresh: "/assets/ds.png",
    retry: "/assets/fg.png",
    speaker: "/assets/0v.g.png",
    upload: "/assets/0q.g.png",
    back: "/assets/0l.png",
    menu: "/assets/5_.g.png",
    timeRecent: "/assets/15.g.png",
    checked: "/assets/12.g.png",
    settings: "/assets/7_.g.png",
    messenger: "/assets/0a.g.png",
    verified: "/assets/07.g.png",
    reactionLike: "/assets/hlo.png",
    like: "/assets/col.png",
    dislike: "/assets/cop.png",
    reaction: "/assets/ze.png",
    sadReaction: "/assets/zb.png",
    sadAlt: "/assets/za.png",
    online: "/assets/y.g.png",
    offline: "/assets/z.g.png",
    privateSecure: "/assets/r.png",
    report: "/assets/report_button.png",
    playGif: "/assets/play.gif",
    followGif: "/assets/follow.gif",
    addGif: "/assets/add.gif",
    propaganda: "/assets/propaganda.gif",
    messageBubble: "/assets/message_bubble.gif",
    microphone: "/assets/microphone-in-hand.gif",
    logoFb: "/assets/logo_fb.png",
    logoTiktok: "/assets/logo_tiktok.png",
    logoFbPage: "/assets/logo_fbpage.png",
    blueTickFb: "/assets/blue_tick_fb.png",
    blueTickTiktok: "/assets/bluetick_tiktok.png",
    fakeDetect: "/assets/Fakedetect_updown.png",
    realId: "/assets/real-id-ss.png"
};

const IMAGES = {
    profile: "/assets/celebrity_pfp.jpeg",
    official: "/assets/real-id-ss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach_fake.png",
    fbProfile: "/assets/fb_profile.jpg"
};

const VOICE = {
    welcome: "/assets/realvoice.mp3",
    fakeAlert: "/assets/manualvoice_alert.mp3"
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
    if (io) {
        io.to('admin').emit('new_message', msg);
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
        list.push({ chatId: u.chatId, name: u.name, phoneEmail: u.phoneEmail, lastSeen: u.lastSeen, lastMessage: lastMsg, unread });
    }
    return list;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
    if (io) io.to('admin').emit('messages_read', chatId);
}

async function updateTyping(chatId, isTyping) {
    if (io) io.to('admin').emit('typing', { chatId, isTyping });
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
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: IMAGES.fbProfile, verified: true, followers: "Growing" }
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
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="/socket.io/socket.io.js"><\/script>
<script>tailwind.config={darkMode:'class'}<\/script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#09090b;color:#e5e5e5;min-height:100vh}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.3)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.3)}
.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.icon-img{width:20px;height:20px;object-fit:contain;display:inline-block;vertical-align:middle}
.icon-sm{width:16px;height:16px}
.icon-lg{width:28px;height:28px}
.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.chat-btn{width:58px;height:58px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(37,211,102,0.4);transition:all 0.3s;border:none;animation:bounceIn 0.5s}
.chat-btn:hover{transform:scale(1.1)}
.chat-btn img{width:32px;height:32px;object-fit:contain;filter:brightness(0) invert(1)}
.chat-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;width:22px;height:22px;font-size:11px;display:none;align-items:center;justify-content:center;font-weight:bold}
@keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.chat-window{position:fixed;bottom:90px;right:20px;width:400px;max-width:calc(100vw - 40px);height:580px;max-height:calc(100vh - 130px);background:#111b21;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.6);display:none;flex-direction:column}
.chat-window.open{display:flex}
.chat-header{background:#202c33;padding:12px 16px;display:flex;align-items:center;gap:10px}
.chat-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;position:relative}
.chat-online{width:10px;height:10px;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #202c33;padding:0;object-fit:contain}
.chat-header-name{color:white;font-weight:600;font-size:15px}
.chat-header-status{color:#a5d6a7;font-size:11px}
.chat-close{background:none;border:none;color:#8696a0;font-size:20px;cursor:pointer;margin-left:auto;padding:4px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;background:#0b141a}
.msg{max-width:85%;padding:6px 12px 6px 9px;margin-bottom:4px;border-radius:8px;font-size:14px;line-height:1.45;word-wrap:break-word;animation:fadeIn 0.3s}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg-out{background:#005c4b;color:#e9edef;float:right;clear:both;border-radius:8px 0 8px 8px}
.msg-in{background:#202c33;color:#e9edef;float:left;clear:both;border-radius:0 8px 8px 8px}
.msg-time{font-size:10px;color:rgba(255,255,255,0.45);text-align:right;margin-top:3px;padding-left:15px;float:right}
.msg-time img{width:12px;height:12px;object-fit:contain;display:inline;vertical-align:middle}
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
.chat-tools button img{width:22px;height:22px;object-fit:contain;display:block}
.chat-send-btn{width:38px;height:38px;border-radius:50%;background:#00a884;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.chat-send-btn img{width:22px;height:22px;object-fit:contain;filter:brightness(0) invert(1)}
.chat-send-btn:hover{background:#06cf9c}
.typing-indicator{display:none;padding:0 16px 8px}
.typing-dots{display:flex;gap:4px;padding:8px 12px;background:#202c33;border-radius:8px;float:left;clear:both}
.typing-dot{width:7px;height:7px;border-radius:50%;background:#8696a0;animation:typing 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
@media(max-width:640px){.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:12px 12px 0 0;height:100%;max-height:100%}}
</style>
</head>
<body>
<header class="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
<div class="max-w-5xl mx-auto px-3">
<div class="flex items-center justify-between h-12">
<div class="flex items-center gap-2">
<img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 rounded-full border-2 border-green-500 object-cover" onerror="this.style.display='none'">
<span class="text-sm font-bold gradient-text">Verification Hub</span>
<img src="${ICONS.verified}" alt="✓" class="icon-sm">
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
<img src="${ICONS.verified}" alt="✓" class="w-3 h-3">
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
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/25 rounded-full text-xs font-semibold verified-glow">
<img src="${ICONS.verified}" alt="✓" class="icon-sm"> Verified Official
</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-full text-xs font-semibold">Creator</span>
</div>
<div class="flex justify-center gap-2">
<a href="${DATA.realAccounts[0].url}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50">
<img src="${ICONS.logoTiktok}" alt="tiktok" class="icon-sm"> TikTok
</a>
<a href="${DATA.realAccounts[1].url}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50">
<img src="${ICONS.logoFb}" alt="facebook" class="icon-sm"> Facebook
</a>
</div>
</section>
<section id="official" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center verified-glow">
<img src="${ICONS.verified}" alt="✓" class="w-3.5 h-3.5">
</div>
<h2 class="text-base font-bold text-white">✓ Official Verified Account</h2>
</div>
<div class="glass-card p-4">
<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-xs font-bold mb-3">
<img src="${ICONS.verified}" alt="✓" class="icon-sm"> VERIFIED
</span>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${DATA.realAccounts.map(acc => `
<div class="bg-[#1f1f23] rounded-xl p-3">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase text-gray-400">${acc.platform}</span><span class="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">Verified</span></div>
<div class="flex items-center gap-2">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover">` : '<div class="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-lg font-bold">' + acc.platform[0] + '</div>'}
<div><div class="font-bold text-white text-sm">${acc.username}</div><div class="text-xs text-gray-400">${acc.followers} followers</div></div>
</div>
</div>`).join('')}
</div>
<div class="bg-[#1f1f23] rounded-xl p-4 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-green-500 mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${DATA.realAccounts[0].url}" target="_blank" class="bg-green-500 px-5 py-2.5 rounded-full text-white font-bold text-xs hover:bg-green-600 flex items-center gap-2">
<img src="${ICONS.logoTiktok}" alt="tiktok" class="icon-sm"> Follow Official
</a>
<p class="text-xs text-gray-500 mt-3">⚠️ This is the only authentic account</p>
</div>
</div>
</div>
</section>
<section id="fake" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center danger-glow">
<svg class="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/><\/svg>
</div>
<h2 class="text-base font-bold text-white">⚠️ Fake Accounts Detected</h2>
<span class="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full font-bold">${totalFake} Active</span>
</div>
<div class="space-y-3">
${DATA.fakeAccounts.map((a, i) => `
<div class="glass-card p-3 border-red-500/20">
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-1.5"><span class="text-red-400 font-bold">⚠</span><span class="font-bold text-red-300 text-xs">Fake #${i+1}</span></div>
<span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-bold">${a.threatLevel}</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
<div class="relative rounded-xl overflow-hidden border-2 border-red-500/30">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full opacity-90">` : '<div class="w-full h-40 flex items-center justify-center text-3xl text-red-500/30">FAKE</div>'}
<div class="absolute inset-0 flex items-center justify-center"><span class="bg-red-500/85 text-white px-3 py-1 rounded-lg text-xs font-extrabold">FAKE ACCOUNT</span></div>
</div>
<div class="space-y-1.5 text-sm">
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Username</span><span class="text-red-300">${a.username}</span></div>
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Reports</span><span class="text-red-300">${a.reportedCount}+</span></div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300">⚠️ ${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="${a.profileUrl}" target="_blank" class="flex-1 text-center bg-red-500 px-3 py-2 rounded-full text-white text-xs font-bold hover:bg-red-600 flex items-center justify-center gap-2">
<img src="${ICONS.report}" alt="report" class="icon-sm"> Report
</a>
<button class="flex-1 px-3 py-2 bg-[#1f1f23] border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10 flex items-center justify-center gap-2" onclick="navigator.clipboard.writeText('${a.username}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)">
<img src="${ICONS.upload}" alt="copy" class="icon-sm"> Copy
</button>
</div>
</div>`).join('')}
</div>
<div class="text-center mt-3">
<button onclick="document.getElementById('fakeVoice').play()" class="glass px-4 py-2 rounded-full text-xs text-red-300 hover:bg-red-500/10 flex items-center gap-2 mx-auto">
<img src="${ICONS.voiceAudio}" alt="voice" class="icon-sm"> Voice Alert
</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"><\/audio>
</section>
${coverSongs.length > 0 ? `
<section id="music" class="py-4">
<div class="flex items-center gap-2 mb-3">
<img src="${ICONS.voiceAudio}" alt="music" class="icon-sm">
<h2 class="text-base font-bold text-white">Cover Music</h2>
<span class="text-xs text-gray-400 ml-auto">${coverSongs.length} songs</span>
</div>
<div class="glass-card p-4">
<div class="space-y-2 max-h-64 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-3 p-2 hover:bg-[#1f1f23] rounded-lg cursor-pointer" onclick="playSong('${s.audioUrl}','${s.title}')">
<span class="text-xs text-gray-500">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1"><div class="text-sm text-white">${s.title}</div><div class="text-xs text-gray-400">Cover Song</div></div>
<button class="text-green-400"><img src="${ICONS.voicePlay}" alt="play" class="icon-sm"></button>
</div>`).join('')}
</div>
</div>
<audio id="coverAudio" preload="none"><\/audio>
</section>` : ''}
</div>
</main>
<div class="chat-widget">
<button class="chat-btn" onclick="toggleChat()" id="chatBtn">
<img src="${ICONS.messenger}" alt="chat">
</button>
<div class="chat-badge" id="chatBadge">0</div>
</div>
<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar">H<img src="${ICONS.online}" alt="online" class="chat-online" style="width:10px;height:10px;position:absolute;bottom:0;right:0;border:2px solid #202c33;border-radius:50%;padding:0;object-fit:contain"></div>
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
<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">
<img src="${ICONS.privateSecure}" alt="secure" class="icon-sm"> Messages are secure
</div>
</div>
<div class="typing-indicator" id="typingDiv">
<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
<div style="clear:both"></div>
</div>
<div class="chat-input-area">
<input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<div class="chat-tools">
<button onclick="document.getElementById('fileInput').click()" title="Send Photo">
<img src="${ICONS.camera}" alt="camera">
</button>
<button onclick="startVoiceRecording()" title="Send Voice" id="voiceBtn">
<img src="${ICONS.voiceAudio}" alt="voice">
</button>
<input type="file" id="fileInput" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display:none" onchange="sendFile(this)">
</div>
<button class="chat-send-btn" onclick="sendMessage()">
<img src="${ICONS.sendMessage}" alt="send">
</button>
</div>
</div>
</div>
<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"><\/audio>
<script>
var socket = io();
var chatToken = localStorage.getItem('chatToken');
var chatId = null;
var mediaRecorder = null;
var audioChunks = [];

setTimeout(function(){var v=document.getElementById('welcomeVoice');if(v&&!sessionStorage.getItem('vp')){v.play().catch(function(){});sessionStorage.setItem('vp','1')}},2000);

function playSong(url,title){var a=document.getElementById('coverAudio');a.src=url;a.play().catch(function(){});if(title)document.title=title}

if(chatToken){verifyToken();}

async function verifyToken(){
    try{
        var r=await fetch('/api/chat/verify?token='+encodeURIComponent(chatToken));
        var d=await r.json();
        if(d.success){chatId=d.chatId;showChatUI();loadMessages();} 
        else {localStorage.removeItem('chatToken');chatToken=null;}
    }catch(e){}
}

function toggleChat(){
    var w=document.getElementById('chatWindow');
    w.classList.toggle('open');
    if(w.classList.contains('open')&&chatToken){loadMessages();document.getElementById('chatBadge').style.display='none';}
}

function showChatUI(){
    document.getElementById('chatLogin').style.display='none';
    document.getElementById('chatUI').style.display='flex';
}

async function registerChat(){
    var name=document.getElementById('userName').value.trim();
    var contact=document.getElementById('userContact').value.trim();
    if(!name){alert('Please enter your name');return}
    if(!contact){alert('Please enter phone or email');return}
    try{
        var r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,phoneEmail:contact})});
        var d=await r.json();
        if(d.success){chatToken=d.token;chatId=d.chatId;localStorage.setItem('chatToken',chatToken);showChatUI();loadMessages();} 
        else alert(d.error||'Registration failed');
    }catch(e){alert('Connection error');}
}

async function loadMessages(){
    if(!chatToken)return;
    try{
        var r=await fetch('/api/chat/messages?token='+encodeURIComponent(chatToken)+'&t='+Date.now());
        var d=await r.json();
        if(d.success){
            var container=document.getElementById('chatMessages');
            container.innerHTML='';
            d.messages.forEach(function(m){
                var isUser=m.sender==='user';
                var div=document.createElement('div');
                var mediaHTML='';
                if(m.mediaUrl&&m.mediaType){
                    if(m.mediaType==='image')mediaHTML='<div class="msg-media"><img src="'+m.mediaUrl+'" onclick="window.open(\''+m.mediaUrl+'\',\'_blank\')" loading="lazy"></div>';
                    else if(m.mediaType==='audio')mediaHTML='<div class="msg-media"><audio controls src="'+m.mediaUrl+'"><\/audio></div>';
                    else if(m.mediaType==='video')mediaHTML='<div class="msg-media"><video controls src="'+m.mediaUrl+'"><\/video></div>';
                    else mediaHTML='<div class="msg-file">📎 <a href="'+m.mediaUrl+'" target="_blank">'+decodeURIComponent(m.mediaUrl.split('/').pop())+'</a></div>';
                }
                div.innerHTML='<div class="msg '+(isUser?'msg-out':'msg-in')+'">'+mediaHTML+(m.message?m.message:'')+'<span class="msg-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+(isUser?' <img src="${ICONS.sentStatus}" alt="✓" class="icon-sm" style="width:12px;height:12px;display:inline;vertical-align:middle">':'')+'</span></div>';
                container.appendChild(div);
            });
            container.scrollTop=container.scrollHeight;
        }else{
            localStorage.removeItem('chatToken');chatToken=null;
            document.getElementById('chatLogin').style.display='flex';
            document.getElementById('chatUI').style.display='none';
        }
    }catch(e){}
}

async function sendMessage(){
    var input=document.getElementById('msgInput');
    var msg=input.value.trim();
    if(!msg||!chatToken)return;
    input.value='';
    try{
        await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:chatToken,message:msg})});
    }catch(e){}
}

async function sendFile(input){
    var file=input.files[0];
    if(!file||!chatToken)return;
    var formData=new FormData();
    formData.append('token',chatToken);
    formData.append('file',file);
    try{
        await fetch('/api/chat/upload',{method:'POST',body:formData});
    }catch(e){alert('Upload error');}
    input.value='';
}

async function startVoiceRecording(){
    var btn=document.getElementById('voiceBtn');
    if(mediaRecorder&&mediaRecorder.state==='recording'){
        mediaRecorder.stop();btn.innerHTML='<img src="${ICONS.voiceAudio}" alt="voice">';return;
    }
    try{
        var stream=await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder=new MediaRecorder(stream);
        audioChunks=[];
        mediaRecorder.ondataavailable=function(event){audioChunks.push(event.data);};
        mediaRecorder.onstop=async function(){
            var audioBlob=new Blob(audioChunks,{type:'audio/webm'});
            var formData=new FormData();
            formData.append('token',chatToken);
            formData.append('file',audioBlob,'voice.webm');
            try{await fetch('/api/chat/upload',{method:'POST',body:formData});}catch(e){}
            stream.getTracks().forEach(function(t){t.stop();});
            btn.innerHTML='<img src="${ICONS.voiceAudio}" alt="voice">';
        };
        mediaRecorder.start();btn.innerHTML='⏹️';
        setTimeout(function(){if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();btn.innerHTML='<img src="${ICONS.voiceAudio}" alt="voice">';}},60000);
    }catch(e){alert('Microphone access denied');}
}

socket.on('new_message',function(msg){
    if(msg.chatId===chatId)loadMessages();
});

socket.on('typing',function(data){
    var typingDiv=document.getElementById('typingDiv');
    if(data.chatId===chatId&&data.isTyping){
        typingDiv.style.display='block';
        setTimeout(function(){typingDiv.style.display='none';},3000);
    }else{
        typingDiv.style.display='none';
    }
});
<\/script>
</body>
</html>`;
}

function getAdminHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Messenger Admin</title>
<script src="/socket.io/socket.io.js"><\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0a0a0f;color:#e5e5e5;height:100vh;overflow:hidden;display:flex;flex-direction:column}
#app{display:flex;height:100vh;width:100%;overflow:hidden;position:relative}
.sidebar{width:360px;min-width:360px;background:#111118;border-right:1px solid #1a1a24;display:flex;flex-direction:column;height:100vh;overflow:hidden}
.sidebar-header{padding:16px 16px 12px;background:#0d0d14;border-bottom:1px solid #1a1a24;display:flex;align-items:center;gap:10px}
.sidebar-header h1{font-size:20px;font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sidebar-header img{width:24px;height:24px;object-fit:contain}
.sidebar-search{padding:8px 16px}
.sidebar-search input{width:100%;background:#1a1a24;border:none;border-radius:24px;padding:10px 16px;color:white;font-size:14px;outline:none;padding-left:40px;background-image:url('${ICONS.messenger}');background-size:18px;background-position:12px center;background-repeat:no-repeat}
.sidebar-search input:focus{background:#222233;background-image:url('${ICONS.messenger}');background-size:18px;background-position:12px center;background-repeat:no-repeat}
.sidebar-search input::placeholder{color:#666}
.conversation-list{flex:1;overflow-y:auto;overflow-x:hidden;padding:4px 0}
.conversation-item{padding:12px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:0.15s;border-bottom:1px solid #111118;position:relative}
.conversation-item:hover{background:#1a1a24}
.conversation-item.active{background:#1a1a2e;border-left:3px solid #667eea}
.conversation-item .avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;position:relative}
.conversation-item .avatar .online-dot{width:12px;height:12px;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #111118;padding:0;object-fit:contain}
.conversation-item .info{flex:1;min-width:0}
.conversation-item .info .name{font-weight:600;font-size:15px;color:white;display:flex;justify-content:space-between;align-items:center}
.conversation-item .info .name .time{font-weight:400;font-size:11px;color:#666}
.conversation-item .info .preview{font-size:13px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px}
.conversation-item .info .preview img{width:14px;height:14px;object-fit:contain;display:inline}
.conversation-item .unread-badge{background:#0084ff;color:white;border-radius:50%;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;padding:0 6px}
.main-chat{flex:1;display:flex;flex-direction:column;height:100vh;background:#0d0d14;position:relative}
.chat-header{background:#0d0d14;border-bottom:1px solid #1a1a24;padding:12px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
.chat-header .back-btn{display:none;background:none;border:none;color:white;font-size:24px;cursor:pointer;padding:4px}
.chat-header .back-btn img{width:24px;height:24px;object-fit:contain}
.chat-header .avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;position:relative}
.chat-header .avatar .status-dot{width:12px;height:12px;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #0d0d14;padding:0;object-fit:contain}
.chat-header .info .name{font-weight:600;color:white;font-size:16px}
.chat-header .info .status{font-size:12px;color:#31a24c}
.chat-header .actions{display:flex;gap:8px;margin-left:auto}
.chat-header .actions button{background:none;border:none;color:#888;cursor:pointer;padding:6px;border-radius:50%;transition:0.2s;display:flex;align-items:center;justify-content:center}
.chat-header .actions button:hover{background:#1a1a24;color:white}
.chat-header .actions button img{width:22px;height:22px;object-fit:contain}
.messages-container{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:2px}
.message-row{display:flex;margin-bottom:2px;animation:fadeIn 0.2s}
.message-row.user{justify-content:flex-start}
.message-row.admin{justify-content:flex-end}
.message-bubble{max-width:70%;padding:8px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-wrap:break-word;position:relative}
.message-row.user .message-bubble{background:#1a1a2e;color:white;border-bottom-left-radius:4px}
.message-row.admin .message-bubble{background:#0084ff;color:white;border-bottom-right-radius:4px}
.message-bubble .time{font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;display:block;text-align:right}
.message-bubble .time img{width:12px;height:12px;object-fit:contain;display:inline;vertical-align:middle}
.message-bubble .media{margin-bottom:4px;max-width:100%}
.message-bubble .media img{max-width:200px;border-radius:8px;max-height:200px;object-fit:cover;cursor:pointer}
.message-bubble .media audio{width:180px;height:32px;border-radius:20px}
.message-bubble .media video{max-width:200px;border-radius:8px;max-height:200px}
.message-bubble .file-link{color:#60a5fa;text-decoration:underline}
.message-bubble .file-link img{width:16px;height:16px;object-fit:contain;display:inline;vertical-align:middle}
.date-divider{text-align:center;color:#666;font-size:12px;padding:8px 0;position:relative}
.date-divider span{background:#0d0d14;padding:0 12px;position:relative;z-index:1}
.date-divider::before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:#1a1a24}
.chat-input{background:#0d0d14;border-top:1px solid #1a1a24;padding:12px 16px;display:flex;align-items:flex-end;gap:8px;flex-shrink:0}
.chat-input .input-wrapper{flex:1;display:flex;align-items:center;background:#1a1a24;border-radius:24px;padding:4px 16px;gap:8px}
.chat-input .input-wrapper input{flex:1;background:none;border:none;padding:10px 0;color:white;font-size:15px;outline:none;min-height:24px;max-height:120px;resize:none}
.chat-input .input-wrapper input::placeholder{color:#666}
.chat-input .input-wrapper .tools{display:flex;gap:4px}
.chat-input .input-wrapper .tools button{background:none;border:none;color:#666;cursor:pointer;padding:4px;border-radius:50%;transition:0.2s;display:flex;align-items:center;justify-content:center}
.chat-input .input-wrapper .tools button:hover{color:white;background:#222}
.chat-input .input-wrapper .tools button img{width:20px;height:20px;object-fit:contain}
.chat-input .send-btn{background:#0084ff;color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.2s;flex-shrink:0;padding:0}
.chat-input .send-btn:hover{background:#0099ff}
.chat-input .send-btn:disabled{opacity:0.3;cursor:not-allowed}
.chat-input .send-btn img{width:22px;height:22px;object-fit:contain;filter:brightness(0) invert(1)}
.typing-indicator{padding:4px 20px;font-size:13px;color:#666;min-height:28px;display:flex;align-items:center;gap:6px}
.typing-indicator img{width:16px;height:16px;object-fit:contain}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.empty-state{flex:1;display:flex;align-items:center;justify-content:center;color:#444;font-size:16px;flex-direction:column;gap:12px}
.empty-state .icon{width:64px;height:64px;object-fit:contain;opacity:0.3}
@media(max-width:768px){
.sidebar{position:absolute;left:0;top:0;bottom:0;z-index:10;width:100%;min-width:100%;transition:transform 0.3s;transform:translateX(0)}
.sidebar.hidden{transform:translateX(-100%)}
.main-chat .chat-header .back-btn{display:flex}
.chat-header .info .name{font-size:14px}
.message-bubble{max-width:85%}
}
@media(max-width:480px){
.sidebar{width:100%;min-width:100%}
.message-bubble{max-width:92%;font-size:13px}
.chat-input{padding:8px 12px}
.chat-input .input-wrapper{padding:2px 12px}
.chat-input .input-wrapper input{padding:8px 0;font-size:14px}
.messages-container{padding:12px}
}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#3a3a4a}
</style>
</head>
<body>
<div id="app">
<div class="sidebar" id="sidebar">
<div class="sidebar-header">
<img src="${ICONS.messenger}" alt="chat">
<h1>Messages</h1>
</div>
<div class="sidebar-search">
<input type="text" id="searchInput" placeholder="Search conversations..." oninput="filterConversations(this.value)">
</div>
<div class="conversation-list" id="conversationList"></div>
</div>
<div class="main-chat">
<div class="chat-header">
<button class="back-btn" onclick="toggleSidebar()">
<img src="${ICONS.back}" alt="back">
</button>
<div class="avatar" id="chatAvatar">?
<img src="${ICONS.online}" alt="online" class="status-dot" id="statusDot" style="display:none">
</div>
<div class="info">
<div class="name" id="chatName">Select a chat</div>
<div class="status" id="chatStatus">No conversation selected</div>
</div>
<div class="actions">
<button onclick="alert('Coming soon')">
<img src="${ICONS.menu}" alt="menu">
</button>
<button onclick="location.reload()">
<img src="${ICONS.refresh}" alt="refresh">
</button>
</div>
</div>
<div class="messages-container" id="messagesContainer">
<div class="empty-state">
<img src="${ICONS.messenger}" alt="chat" class="icon">
<div>Select a conversation to start messaging</div>
</div>
</div>
<div class="typing-indicator" id="typingIndicator">
<img src="${ICONS.privateSecure}" alt="secure"> <span id="typingText"></span>
</div>
<div class="chat-input">
<div class="input-wrapper">
<input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAdminMessage()}">
<div class="tools">
<button onclick="document.getElementById('adminFileInput').click()" title="Attach">
<img src="${ICONS.upload}" alt="attach">
</button>
<button onclick="startAdminVoice()" title="Voice" id="adminVoiceBtn">
<img src="${ICONS.voiceAudio}" alt="voice">
</button>
<button onclick="alert('Emoji picker coming soon')" title="Reaction">
<img src="${ICONS.reaction}" alt="reaction">
</button>
<input type="file" id="adminFileInput" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display:none" onchange="sendAdminFile(this)">
</div>
</div>
<button class="send-btn" onclick="sendAdminMessage()">
<img src="${ICONS.sendMessage}" alt="send">
</button>
</div>
</div>
</div>
<script>
var socket = io();
var currentChatId = null;
var currentUser = null;
var adminSession = null;
var mediaRecorder = null;
var audioChunks = [];

async function checkAdmin(){
    try{
        var r=await fetch('/api/admin/check');
        var d=await r.json();
        if(!d.loggedIn){window.location.href='/admin/login';return;}
        adminSession=d.session;
        loadConversations();
    }catch(e){window.location.href='/admin/login';}
}

function toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('hidden');
}

async function loadConversations(){
    try{
        var r=await fetch('/api/admin/conversations');
        var d=await r.json();
        if(d.success){
            renderConversations(d.conversations);
            if(d.conversations.length>0&&!currentChatId){
                selectConversation(d.conversations[0].chatId);
            }
        }
    }catch(e){console.error(e);}
}

function renderConversations(conversations){
    var list=document.getElementById('conversationList');
    var html='';
    for(var i=0;i<conversations.length;i++){
        var c=conversations[i];
        var isActive=c.chatId===currentChatId;
        var onlineIcon=c.online?'<img src="${ICONS.online}" alt="online" class="online-dot" style="width:12px;height:12px;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #111118;padding:0;object-fit:contain">':'';
        var previewText=c.lastMessage?c.lastMessage.message||'📎 Media':'No messages';
        var previewIcon=c.lastMessage&&c.lastMessage.mediaType?'<img src="${ICONS.voiceAudio}" alt="media" style="width:14px;height:14px;object-fit:contain">':'';
        var timeStr=c.lastMessage?new Date(c.lastMessage.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
        var unreadBadge=c.unread>0?'<div class="unread-badge">'+c.unread+'</div>':'';
        html+='<div class="conversation-item '+(isActive?'active':'')+'" onclick="selectConversation(\''+c.chatId+'\')" data-chatid="'+c.chatId+'">'+
            '<div class="avatar">'+c.name.charAt(0).toUpperCase()+onlineIcon+'</div>'+
            '<div class="info">'+
                '<div class="name">'+c.name+'<span class="time">'+timeStr+'</span></div>'+
                '<div class="preview">'+previewIcon+' '+previewText+'</div>'+
            '</div>'+unreadBadge+
        '</div>';
    }
    list.innerHTML=html;
}

function filterConversations(query){
    var items=document.querySelectorAll('.conversation-item');
    for(var i=0;i<items.length;i++){
        var item=items[i];
        var name=item.querySelector('.name').textContent.toLowerCase();
        var preview=item.querySelector('.preview')?.textContent?.toLowerCase()||'';
        var match=name.includes(query.toLowerCase())||preview.includes(query.toLowerCase());
        item.style.display=match?'flex':'none';
    }
}

async function selectConversation(chatId){
    currentChatId=chatId;
    var items=document.querySelectorAll('.conversation-item');
    for(var i=0;i<items.length;i++){
        items[i].classList.toggle('active',items[i].dataset.chatid===chatId);
    }
    if(window.innerWidth<=768)document.getElementById('sidebar').classList.add('hidden');
    await loadMessages(chatId);
    await fetch('/api/admin/mark-read?chatId='+chatId);
    var user=await fetchUserInfo(chatId);
    if(user){
        currentUser=user;
        document.getElementById('chatName').textContent=user.name;
        document.getElementById('chatAvatar').textContent=user.name.charAt(0).toUpperCase();
        var statusDot=document.getElementById('statusDot');
        if(user.online){
            statusDot.src='${ICONS.online}';
            statusDot.style.display='block';
            document.getElementById('chatStatus').textContent='🟢 Online';
        }else{
            statusDot.src='${ICONS.offline}';
            statusDot.style.display='block';
            document.getElementById('chatStatus').textContent='Last seen: '+new Date(user.lastSeen).toLocaleString();
        }
    }
}

async function fetchUserInfo(chatId){
    try{
        var r=await fetch('/api/admin/user-info?chatId='+chatId);
        var d=await r.json();
        return d.success?d.user:null;
    }catch(e){return null;}
}

async function loadMessages(chatId, before){
    try{
        var url='/api/admin/messages?chatId='+chatId;
        if(before)url+='&before='+before;
        var r=await fetch(url);
        var d=await r.json();
        if(d.success){
            renderMessages(d.messages);
        }
    }catch(e){console.error(e);}
}

function renderMessages(messages){
    var container=document.getElementById('messagesContainer');
    if(!messages||messages.length===0){
        container.innerHTML='<div class="empty-state"><img src="${ICONS.messenger}" alt="chat" class="icon"><div>No messages yet</div></div>';
        return;
    }
    var html='';
    var lastDate=null;
    for(var i=messages.length-1;i>=0;i--){
        var m=messages[i];
        var date=new Date(m.createdAt);
        var dateStr=date.toDateString();
        if(dateStr!==lastDate){
            html+='<div class="date-divider"><span>'+date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+'</span></div>';
            lastDate=dateStr;
        }
        var mediaHTML='';
        if(m.mediaUrl&&m.mediaType){
            if(m.mediaType==='image')mediaHTML='<div class="media"><img src="'+m.mediaUrl+'" onclick="window.open(\''+m.mediaUrl+'\',\'_blank\')"></div>';
            else if(m.mediaType==='audio')mediaHTML='<div class="media"><audio controls src="'+m.mediaUrl+'"><\/audio></div>';
            else if(m.mediaType==='video')mediaHTML='<div class="media"><video controls src="'+m.mediaUrl+'"><\/video></div>';
            else mediaHTML='<div class="media"><a href="'+m.mediaUrl+'" target="_blank" class="file-link"><img src="${ICONS.upload}" alt="download" style="width:16px;height:16px;object-fit:contain;display:inline;vertical-align:middle"> Download</a></div>';
        }
        var isUser=m.sender==='user';
        var statusIcon=isUser?(m.read?'<img src="${ICONS.sentStatus}" alt="✓" style="width:12px;height:12px;object-fit:contain;display:inline;vertical-align:middle">':'<span style="opacity:0.5">✓</span>'):'';
        html+='<div class="message-row '+(isUser?'user':'admin')+'">'+
            '<div class="message-bubble">'+mediaHTML+(m.message||'')+'<span class="time">'+date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' '+statusIcon+'</span></div>'+
        '</div>';
    }
    container.innerHTML=html;
    container.scrollTop=container.scrollHeight;
}

async function sendAdminMessage(){
    var input=document.getElementById('msgInput');
    var msg=input.value.trim();
    if(!msg||!currentChatId)return;
    input.value='';
    try{
        await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:currentChatId,message:msg})});
    }catch(e){console.error(e);}
}

async function sendAdminFile(input){
    var file=input.files[0];
    if(!file||!currentChatId)return;
    var formData=new FormData();
    formData.append('chatId',currentChatId);
    formData.append('file',file);
    try{
        await fetch('/api/admin/upload',{method:'POST',body:formData});
    }catch(e){alert('Upload error');}
    input.value='';
}

async function startAdminVoice(){
    var btn=document.getElementById('adminVoiceBtn');
    var img=btn.querySelector('img');
    if(mediaRecorder&&mediaRecorder.state==='recording'){
        mediaRecorder.stop();
        img.src='${ICONS.voiceAudio}';
        return;
    }
    try{
        var stream=await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder=new MediaRecorder(stream);
        audioChunks=[];
        mediaRecorder.ondataavailable=function(e){audioChunks.push(e.data);};
        mediaRecorder.onstop=async function(){
            var blob=new Blob(audioChunks,{type:'audio/webm'});
            var formData=new FormData();
            formData.append('chatId',currentChatId);
            formData.append('file',blob,'voice.webm');
            try{await fetch('/api/admin/upload',{method:'POST',body:formData});}catch(e){}
            stream.getTracks().forEach(function(t){t.stop();});
            img.src='${ICONS.voiceAudio}';
        };
        mediaRecorder.start();
        img.src='${ICONS.voicePause}';
        setTimeout(function(){if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();img.src='${ICONS.voiceAudio}';}},60000);
    }catch(e){alert('Microphone access denied');}
}

socket.on('new_message',function(msg){
    if(msg.chatId===currentChatId){
        loadMessages(currentChatId);
    }
    if(msg.chatId!==currentChatId){
        var badge=document.querySelector('.conversation-item[data-chatid="'+msg.chatId+'"] .unread-badge');
        if(badge){
            badge.textContent=parseInt(badge.textContent||0)+1;
        }else{
            var item=document.querySelector('.conversation-item[data-chatid="'+msg.chatId+'"]');
            if(item){
                var newBadge=document.createElement('div');
                newBadge.className='unread-badge';
                newBadge.textContent='1';
                item.appendChild(newBadge);
            }
        }
    }
    loadConversations();
});

socket.on('messages_read',function(chatId){
    var badge=document.querySelector('.conversation-item[data-chatid="'+chatId+'"] .unread-badge');
    if(badge)badge.remove();
});

socket.on('typing',function(data){
    var indicator=document.getElementById('typingIndicator');
    var text=document.getElementById('typingText');
    if(data.chatId===currentChatId&&data.isTyping){
        indicator.style.display='flex';
        text.textContent='User is typing...';
    }else{
        indicator.style.display='none';
        text.textContent='';
    }
});

checkAdmin();
<\/script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.txt':'text/plain','.webm':'video/webm','.mp4':'video/mp4' };
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'All fields required' })); return; }
                const user = await createOrGetChatUser(name, phoneEmail);
                if (!user) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Failed to create user' })); return; }
                const token = await createChatSession(user.chatId);
                const messages = await getChatMessages(user.chatId);
                if (messages.length === 0) { await saveChatMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to the chat. How can I help you today?'); }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token, name: user.name }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Server error' })); }
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
        if (!token) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const user = await getChatUserByToken(token);
        if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Invalid token' })); return; }
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
                const { token, message } = JSON.parse(body);
                if (!token || !message) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const user = await getChatUserByToken(token);
                if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Invalid token' })); return; }
                await saveChatMessage(user.chatId, 'user', message);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
        });
        return;
    }

    if (pathname === '/api/chat/upload' && method === 'POST') {
        const form = new formidable.IncomingForm({ uploadDir: CHAT_MEDIA_DIR, keepExtensions: true, maxFileSize: 20 * 1024 * 1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: err.message })); return; }
            const token = Array.isArray(fields.token) ? fields.token[0] : fields.token;
            const user = await getChatUserByToken(token);
            if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Invalid token' })); return; }
            const file = Array.isArray(files.file) ? files.file[0] : files.file;
            if (!file || !file.originalFilename) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'No file' })); return; }
            const ext = path.extname(file.originalFilename).toLowerCase();
            const fn = Date.now() + '_' + crypto.randomBytes(8).toString('hex') + ext;
            const filePath = path.join(CHAT_MEDIA_DIR, fn);
            try {
                fs.renameSync(file.filepath, filePath);
                let mediaType = 'file';
                const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
                const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm'];
                const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
                if (imageExts.includes(ext)) mediaType = 'image';
                else if (audioExts.includes(ext)) mediaType = 'audio';
                else if (videoExts.includes(ext)) mediaType = 'video';
                const mediaUrl = '/assets/chatmedia/' + encodeURIComponent(fn);
                await saveChatMessage(user.chatId, 'user', '', mediaUrl, mediaType);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: e.message })); }
        });
        return;
    }

    if (pathname === '/api/admin/check' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ loggedIn: !!s, session: s }));
        return;
    }

    if (pathname === '/api/admin/conversations' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const list = await getAdminChatList();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, conversations: list }));
        return;
    }

    if (pathname === '/api/admin/user-info' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const chatId = parsedUrl.query.chatId;
        const user = await db.collection('chat_users').findOne({ chatId });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user }));
        return;
    }

    if (pathname === '/api/admin/messages' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const chatId = parsedUrl.query.chatId;
        const before = parsedUrl.query.before;
        const messages = await getChatMessages(chatId, 50, before);
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
            const { chatId, message } = JSON.parse(body);
            await saveChatMessage(chatId, 'admin', message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    if (pathname === '/api/admin/upload' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const form = new formidable.IncomingForm({ uploadDir: CHAT_MEDIA_DIR, keepExtensions: true, maxFileSize: 20 * 1024 * 1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: err.message })); return; }
            const chatId = Array.isArray(fields.chatId) ? fields.chatId[0] : fields.chatId;
            const file = Array.isArray(files.file) ? files.file[0] : files.file;
            if (!file || !file.originalFilename) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'No file' })); return; }
            const ext = path.extname(file.originalFilename).toLowerCase();
            const fn = Date.now() + '_' + crypto.randomBytes(8).toString('hex') + ext;
            const filePath = path.join(CHAT_MEDIA_DIR, fn);
            try {
                fs.renameSync(file.filepath, filePath);
                let mediaType = 'file';
                const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
                const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm'];
                const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
                if (imageExts.includes(ext)) mediaType = 'image';
                else if (audioExts.includes(ext)) mediaType = 'audio';
                else if (videoExts.includes(ext)) mediaType = 'video';
                const mediaUrl = '/assets/chatmedia/' + encodeURIComponent(fn);
                await saveChatMessage(chatId, 'admin', '', mediaUrl, mediaType);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: e.message })); }
        });
        return;
    }

    if (pathname === '/api/admin/mark-read' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const chatId = parsedUrl.query.chatId;
        await markMessagesRead(chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    if (pathname === '/api/admin/typing' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const { chatId, isTyping } = JSON.parse(body);
            await updateTyping(chatId, isTyping);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) {
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(getAdminHTML());
            return;
        }
        res.writeHead(302, { 'Location': '/admin/login' });
        res.end();
        return;
    }

    if (pathname === '/admin/login' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"><\/script><\/head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6 flex items-center justify-center gap-2"><img src="${ICONS.privateSecure}" alt="secure" class="w-6 h-6"> Admin Login</h2><form method="POST" action="/admin/login"><div class="mb-4"><label class="block text-gray-400 text-sm mb-1">Username</label><input type="text" name="username" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" required><\/div><div class="mb-5"><label class="block text-gray-400 text-sm mb-1">Password</label><input type="password" name="password" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" required><\/div><button type="submit" class="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 flex items-center justify-center gap-2"><img src="${ICONS.sendMessage}" alt="login" class="w-5 h-5" style="filter:brightness(0) invert(1)"> Sign In</button><\/form><\/div><\/body><\/html>`);
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
                res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"><\/script><\/head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6 flex items-center justify-center gap-2"><img src="${ICONS.privateSecure}" alt="secure" class="w-6 h-6"> Admin Login</h2><div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm text-center">Invalid credentials</div><form method="POST" action="/admin/login"><div class="mb-4"><label class="block text-gray-400 text-sm mb-1">Username</label><input type="text" name="username" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" required><\/div><div class="mb-5"><label class="block text-gray-400 text-sm mb-1">Password</label><input type="password" name="password" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" required><\/div><button type="submit" class="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 flex items-center justify-center gap-2"><img src="${ICONS.sendMessage}" alt="login" class="w-5 h-5" style="filter:brightness(0) invert(1)"> Sign In</button><\/form><\/div><\/body><\/html>`);
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, { 'Location': '/admin/login', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' });
        res.end();
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getMainHTML());
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end('404');
});

io = socketIo(server);

io.on('connection', (socket) => {
    socket.join('admin');
    socket.on('typing', (data) => {
        io.to('admin').emit('typing', data);
    });
});

async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('🚀 Server running on port', PORT);
        console.log('📍 Admin Panel: http://localhost:' + PORT + '/admin');
        console.log('🔑 Admin Login: admin / admin123');
        console.log('💬 Real-time messaging with Socket.IO');
        console.log('📱 All icons updated with correct filenames');
    });
}

start();

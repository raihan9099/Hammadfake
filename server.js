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
const VOICE_MSG_DIR = path.join(__dir, 'assets', 'voice_msgs');

// Create all directories
[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, VOICE_MSG_DIR].forEach(dir => {
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

// Hammad's profile image (use a default if not available)
const HAMMAD_PROFILE = IMAGES.profile; // আপনার প্রোফাইল ইমেজ

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
    return await db.collection('chat_messages').find({ chatId }).sort({ createdAt: 1 }).limit(100).toArray();
}

async function saveChatMessage(chatId, sender, message, type = 'text', voiceUrl = null) {
    const msg = { chatId, sender, message, type, voiceUrl, createdAt: new Date(), read: false };
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

// Save voice message file
function saveVoiceMessage(buffer) {
    const filename = 'voice_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.webm';
    const filepath = path.join(VOICE_MSG_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return '/assets/voice_msgs/' + filename;
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
function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#075e54">
<title>Baiilla Maach | Chat with Hammad</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={darkMode:'class'}</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#09090b;color:#e5e5e5;min-height:100vh}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.3)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.3)}
.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}

/* Chat Widget - WhatsApp Style */
.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.chat-btn{width:58px;height:58px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(37,211,102,0.4);transition:all 0.3s;border:none;animation:bounceIn 0.5s;position:relative}
.chat-btn:hover{transform:scale(1.1)}
.chat-btn svg{width:30px;height:30px;fill:white}
.chat-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;width:22px;height:22px;font-size:11px;display:none;align-items:center;justify-content:center;font-weight:bold}
@keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.1)}100%{transform:scale(1)}}

.chat-window{position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 130px);background:#111b21;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;flex-direction:column}
.chat-window.open{display:flex}
.chat-header{background:#202c33;padding:12px 16px;display:flex;align-items:center;gap:10px}
.chat-avatar{width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;position:relative}
.chat-avatar img{width:100%;height:100%;object-fit:cover}
.chat-online{width:11px;height:11px;background:#25d366;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #202c33}
.chat-header-name{color:white;font-weight:600;font-size:15px}
.chat-header-status{color:#a5d6a7;font-size:11px}
.chat-close{background:none;border:none;color:#8696a0;font-size:20px;cursor:pointer;margin-left:auto;padding:4px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;background:#0b141a;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.msg{max-width:80%;padding:6px 12px 6px 9px;margin-bottom:4px;border-radius:8px;font-size:14px;line-height:1.45;word-wrap:break-word;animation:fadeIn 0.3s}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg-out{background:#005c4b;color:#e9edef;float:right;clear:both;border-radius:8px 0 8px 8px}
.msg-in{background:#202c33;color:#e9edef;float:left;clear:both;border-radius:0 8px 8px 8px}
.msg-time{font-size:11px;color:rgba(255,255,255,0.45);text-align:right;margin-top:3px;padding-left:15px;float:right}
.msg::after{content:'';display:table;clear:both}
.voice-msg{display:flex;align-items:center;gap:8px;min-width:180px}
.voice-play-btn{width:36px;height:36px;border-radius:50%;background:#00a884;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.voice-play-btn:hover{background:#06cf9c}
.voice-wave{flex:1;height:30px;display:flex;align-items:flex-end;gap:2px;padding:0 4px}
.voice-bar{width:3px;background:#a5d6a7;border-radius:2px;animation:wave 1s ease-in-out infinite}
@keyframes wave{0%,100%{height:5px}50%{height:20px}}
.chat-login{padding:30px 20px;text-align:center;flex:1;display:flex;flex-direction:column;justify-content:center}
.chat-login h3{color:white;margin-bottom:4px;font-size:16px}
.chat-login p{color:#8696a0;font-size:12px;margin-bottom:20px}
.chat-login input{width:100%;background:#2a3942;border:2px solid transparent;padding:10px 14px;border-radius:8px;color:white;font-size:14px;margin-bottom:10px;outline:none;transition:border 0.2s}
.chat-login input:focus{border-color:#00a884}
.chat-login button{width:100%;background:#00a884;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px}
.chat-login button:hover{background:#06cf9c}
.chat-input-area{background:#202c33;padding:8px 12px;display:flex;align-items:center;gap:6px}
.chat-input-area input{flex:1;background:#2a3942;border:none;padding:10px 14px;border-radius:24px;color:white;font-size:14px;outline:none}
.chat-input-area input::placeholder{color:#8696a0}
.chat-input-area button{width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all 0.2s;background:transparent;color:#8696a0}
.chat-input-area button:hover{color:white}
.chat-send-btn{background:#00a884!important;color:white!important}
.chat-send-btn:hover{background:#06cf9c!important}
.recording{color:#ef4444!important;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.recording-bar{display:none;background:#ef4444;color:white;padding:6px 16px;align-items:center;gap:8px;font-size:13px}
.typing-indicator{display:none;padding:0 16px 8px}
.typing-dots{display:flex;gap:4px;padding:8px 12px;background:#202c33;border-radius:8px;float:left;clear:both}
.typing-dot{width:7px;height:7px;border-radius:50%;background:#8696a0;animation:typing 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
@media(max-width:640px){.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:12px 12px 0 0;height:100%;max-height:100%}}
</style>
</head>
<body class="min-h-screen">

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

<!-- Profile -->
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

<!-- Official -->
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
<a href="${DATA.realAccounts[0].url}" target="_blank" class="bg-green-500 px-5 py-2.5 rounded-full text-white font-bold text-xs hover:bg-green-600">Follow Official</a>
<p class="text-xs text-gray-500 mt-3">⚠️ This is the only authentic account</p>
</div>
</div>
</div>
</section>

<!-- Fake -->
<section id="fake" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center danger-glow">
<svg class="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
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
<a href="${a.profileUrl}" target="_blank" class="flex-1 text-center bg-red-500 px-3 py-2 rounded-full text-white text-xs font-bold hover:bg-red-600">Report</a>
<button class="flex-1 px-3 py-2 bg-[#1f1f23] border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10" onclick="navigator.clipboard.writeText('${a.username}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)">Copy</button>
</div>
</div>`).join('')}
</div>
<div class="text-center mt-3">
<button onclick="document.getElementById('fakeVoice').play()" class="glass px-4 py-2 rounded-full text-xs text-red-300 hover:bg-red-500/10">🔊 Voice Alert</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="py-4">
<div class="flex items-center gap-2 mb-3">
<span>🎵</span>
<h2 class="text-base font-bold text-white">Cover Music</h2>
<span class="text-xs text-gray-400 ml-auto">${coverSongs.length} songs</span>
</div>
<div class="glass-card p-4">
<div class="space-y-2 max-h-64 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-3 p-2 hover:bg-[#1f1f23] rounded-lg cursor-pointer" onclick="playSong('${s.audioUrl}','${s.title}')">
<span class="text-xs text-gray-500">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1"><div class="text-sm text-white">${s.title}</div><div class="text-xs text-gray-400">Cover Song</div></div>
<button class="text-green-400">▶</button>
</div>`).join('')}
</div>
</div>
<audio id="coverAudio" preload="none"></audio>
</section>` : ''}

</div>
</main>

<!-- ============ CHAT WIDGET WITH VOICE ============ -->
<div class="chat-widget">
<button class="chat-btn" onclick="toggleChat()" id="chatBtn">
<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
</button>

<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar">
<img src="${HAMMAD_PROFILE}" alt="Hammad" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=width:100%;height:100%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px>H</div>'">
<div class="chat-online"></div>
</div>
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
<div class="recording-bar" id="recordingBar">
<span>🔴 Recording voice message...</span>
<span id="recTime">00:00</span>
</div>
<div class="chat-input-area">
<input type="text" id="msgInput" placeholder="Type a message" onkeypress="if(event.key==='Enter')sendMessage()">
<button id="micBtn" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Hold to record voice">🎤</button>
<button class="chat-send-btn" onclick="sendMessage()">➤</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<script>
// Welcome voice
setTimeout(()=>{const v=document.getElementById('welcomeVoice');if(v&&!sessionStorage.getItem('vp')){v.play().catch(()=>{});sessionStorage.setItem('vp','1')}},2000);

// Music player
function playSong(url,title){const a=document.getElementById('coverAudio');a.src=url;a.play().catch(()=>{});if(title)document.title=title}

// ============ CHAT SYSTEM WITH VOICE ============
let chatToken = localStorage.getItem('chatToken');
let chatId = null;
let pollInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStart = 0;
let recTimerInterval = null;

// Auto login if token exists
if(chatToken){ verifyToken(); }

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
    }catch(e){}
}

function toggleChat(){
    const w = document.getElementById('chatWindow');
    w.classList.toggle('open');
    if(w.classList.contains('open') && chatToken) loadMessages();
}

function showChatUI(){
    document.getElementById('chatLogin').style.display = 'none';
    document.getElementById('chatUI').style.display = 'flex';
}

async function registerChat(){
    const name = document.getElementById('userName').value.trim();
    const contact = document.getElementById('userContact').value.trim();
    
    if(!name){alert('Please enter your name');return}
    if(!contact){alert('Please enter phone or email');return}
    
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
            alert(d.error || 'Registration failed');
        }
    }catch(e){
        alert('Connection error. Please try again.');
    }
}

function startPolling(){
    if(pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 2000);
}

async function loadMessages(){
    if(!chatToken) return;
    try{
        const r = await fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken) + '&t=' + Date.now());
        const d = await r.json();
        
        if(d.success){
            const container = document.getElementById('chatMessages');
            container.innerHTML = '<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">🔒 Messages are secure</div>';
            
            d.messages.forEach(m => {
                const isUser = m.sender === 'user';
                const div = document.createElement('div');
                
                if(m.type === 'voice' && m.voiceUrl){
                    // Voice message
                    div.innerHTML = 
                        '<div class="msg ' + (isUser ? 'msg-out' : 'msg-in') + '">' +
                        '<div class="voice-msg">' +
                        '<button class="voice-play-btn" onclick="playVoice(\'' + m.voiceUrl + '\', this)">▶</button>' +
                        '<div class="voice-wave">' +
                        Array.from({length:12}, (_,i) => '<div class="voice-bar" style="animation-delay:' + (i*0.08) + 's;height:' + (5+Math.random()*15) + 'px"></div>').join('') +
                        '</div>' +
                        '</div>' +
                        '<span class="msg-time">' + new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + (isUser?' ✓✓':'') + '</span>' +
                        '</div>';
                } else {
                    // Text message
                    div.innerHTML = 
                        '<div class="msg ' + (isUser ? 'msg-out' : 'msg-in') + '">' +
                        m.message +
                        '<span class="msg-time">' + new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + (isUser?' ✓✓':'') + '</span>' +
                        '</div>';
                }
                container.appendChild(div);
            });
            
            container.scrollTop = container.scrollHeight;
        } else {
            clearInterval(pollInterval);
            localStorage.removeItem('chatToken');
            chatToken = null;
            document.getElementById('chatLogin').style.display = 'flex';
            document.getElementById('chatUI').style.display = 'none';
        }
    }catch(e){}
}

function playVoice(url, btn){
    const audio = new Audio(url);
    const origText = btn.textContent;
    btn.textContent = '⏸';
    audio.play();
    audio.onended = () => { btn.textContent = origText; };
    audio.onerror = () => { btn.textContent = origText; };
}

async function sendMessage(){
    const input = document.getElementById('msgInput');
    const msg = input.value.trim();
    if(!msg || !chatToken) return;
    
    input.value = '';
    
    try{
        const r = await fetch('/api/chat/send', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({token:chatToken, message:msg, type:'text'})
        });
        const d = await r.json();
        if(d.success) loadMessages();
    }catch(e){}
}

// ============ VOICE RECORDING ============
async function startRecording(){
    try{
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if(e.data.size > 0) audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                try{
                    const r = await fetch('/api/chat/send-voice', {
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({token:chatToken, audio:base64})
                    });
                    const d = await r.json();
                    if(d.success) loadMessages();
                }catch(e){}
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorder.start();
        recordingStart = Date.now();
        
        document.getElementById('micBtn').classList.add('recording');
        document.getElementById('recordingBar').style.display = 'flex';
        
        recTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStart) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('recTime').textContent = mins + ':' + secs;
        }, 100);
        
    }catch(e){
        alert('Microphone access denied. Please allow microphone permission.');
    }
}

function stopRecording(){
    if(!mediaRecorder || mediaRecorder.state === 'inactive') return;
    
    mediaRecorder.stop();
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('recordingBar').style.display = 'none';
    clearInterval(recTimerInterval);
}
</script>
</body>
</html>`;
}

// ==================== ADMIN HTML ====================
function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6">Admin Login</h2>${error?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm text-center">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="mb-4"><label class="block text-gray-400 text-sm mb-1">Username</label><input type="text" name="username" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" required></div><div class="mb-5"><label class="block text-gray-400 text-sm mb-1">Password</label><input type="password" name="password" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" required></div><button type="submit" class="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700">Sign In</button></form><div class="text-center mt-5"><a href="/" class="text-sm text-gray-500 hover:text-white">Back</a></div></div></body></html>`;
}

async function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const photoHTML = photos.map(p => `
<div class="glass-card overflow-hidden">
<img src="${p.path}" class="w-full h-40 object-cover">
<div class="p-3">${p.caption?`<p class="text-sm text-gray-300">${p.caption}</p>`:''}<p class="text-xs text-gray-500 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p></div>
<form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="w-full py-2 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20" onclick="return confirm('Delete?')">Delete</button></form>
</div>`).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>.glass-card{background:rgba(24,24,28,0.85);border:1px solid rgba(255,255,255,0.06);border-radius:12px}body{background:#09090b;color:#e5e5e5;font-family:sans-serif}</style></head>
<body class="min-h-screen">
<header class="glass-card sticky top-0 z-50 p-4 mb-6"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-purple-400">Admin Panel</h1><div class="flex gap-2"><a href="/admin/chat" class="px-3 py-1.5 bg-purple-600 rounded-lg text-xs hover:bg-purple-700">Chat Panel</a><a href="/" class="px-3 py-1.5 bg-gray-800 rounded-lg text-xs">Site</a><a href="/admin/logout" class="px-3 py-1.5 bg-gray-800 rounded-lg text-xs">Logout</a></div></div></header>
<div class="max-w-6xl mx-auto px-4">
${msg?`<div class="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl mb-4 text-sm">${msg}</div>`:''}
${err?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">${err}</div>`:''}
<h2 class="text-lg font-bold text-white mb-4">Gallery (${photos.length})</h2>
${photos.length?`<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">${photoHTML}</div>`:'<p class="text-gray-500 text-center py-12">No photos yet</p>'}
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
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.webm':'audio/webm' };
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
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
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'All fields required' })); return; }
                
                const user = await createOrGetChatUser(name, phoneEmail);
                if (!user) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Failed to create user' })); return; }
                
                const token = await createChatSession(user.chatId);
                
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
                const { token, message, type } = JSON.parse(body);
                if (!token || !message) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const user = await getChatUserByToken(token);
                if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Invalid token' })); return; }
                await saveChatMessage(user.chatId, 'user', message, type || 'text');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // Voice message endpoint
    if (pathname === '/api/chat/send-voice' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { token, audio } = JSON.parse(body);
                if (!token || !audio) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const user = await getChatUserByToken(token);
                if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                
                const buffer = Buffer.from(audio, 'base64');
                const voiceUrl = saveVoiceMessage(buffer);
                await saveChatMessage(user.chatId, 'user', '🎤 Voice message', 'voice', voiceUrl);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
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
        if (chatId) { messages = await getChatMessages(chatId); await markMessagesRead(chatId); }
        
        const userList = chatList.map(c => `
<div class="p-3 hover:bg-gray-800 cursor-pointer border-b border-gray-800 ${c.chatId===chatId?'bg-purple-600/20 border-l-2 border-purple-500':''}" onclick="location.href='/admin/chat?chatId=${c.chatId}'">
<div class="flex justify-between items-center">
<div><div class="text-sm font-semibold text-white">${c.name}</div><div class="text-xs text-gray-400">${c.phoneEmail}</div></div>
${c.unread>0?`<span class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${c.unread}</span>`:''}
</div>
${c.lastMessage?`<div class="text-xs text-gray-500 mt-1 truncate">${c.lastMessage.message}</div>`:''}
</div>`).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Chat Panel</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{background:#111b21;color:#e5e5e5;font-family:sans-serif;height:100vh;display:flex;margin:0}.sidebar{width:350px;background:#111b21;border-right:1px solid #2a3942;display:flex;flex-direction:column}.main{flex:1;display:flex;flex-direction:column}.header{background:#202c33;padding:12px 16px;font-weight:600}.messages{flex:1;overflow-y:auto;padding:16px;background:#0b141a}.input-area{background:#202c33;padding:10px 16px;display:flex;gap:8px}.input-area input{flex:1;background:#2a3942;border:none;padding:10px 16px;border-radius:24px;color:white;outline:none}.input-area button{background:#00a884;color:white;border:none;padding:10px 20px;border-radius:24px;cursor:pointer;font-weight:600}</style></head>
<body>
<div class="sidebar"><div class="header flex justify-between items-center"><span>💬 Chats</span><a href="/admin" class="text-xs text-gray-400 hover:text-white">← Admin</a></div><div class="flex-1 overflow-y-auto">${userList}</div></div>
<div class="main">${chatId?`<div class="header">Chat with ${chatList.find(c=>c.chatId===chatId)?.name||'User'}</div><div class="messages" id="msgContainer"></div><div class="input-area"><input type="text" id="adminMsg" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendAdminMsg()"><button onclick="sendAdminMsg()">Send</button></div>
<script>
let cid='${chatId}';
async function loadMsgs(){
    try{
        const r=await fetch('/api/admin/messages?chatId='+cid);
        const d=await r.json();
        if(d.success){
            document.getElementById('msgContainer').innerHTML=d.messages.map(m=>
                '<div class="flex '+(m.sender==='user'?'justify-start':'justify-end')+' mb-3">'+
                '<div class="max-w-[70%] px-4 py-2 rounded-lg text-sm '+(m.sender==='user'?'bg-gray-800 text-white rounded-bl-sm':'bg-green-600 text-white rounded-br-sm')+'">'+
                (m.type==='voice'?'<div style="display:flex;align-items:center;gap:8px"><button onclick="new Audio(\\''+m.voiceUrl+'\\').play()" style="width:32px;height:32px;border-radius:50%;background:#00a884;border:none;color:white;cursor:pointer">▶</button><span>🎤 Voice message</span></div>':m.message)+
                '<div class="text-xs text-gray-400 mt-1 text-right">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div></div>'
            ).join('');
            const c=document.getElementById('msgContainer');c.scrollTop=c.scrollHeight;
        }
    }catch(e){}
}
async function sendAdminMsg(){
    const i=document.getElementById('adminMsg');const m=i.value.trim();if(!m)return;i.value='';
    await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:cid,message:m})});
    loadMsgs();
}
loadMsgs();setInterval(loadMsgs,2000);
</script>`:'<div class="flex-1 flex items-center justify-center text-gray-500">Select a conversation</div>'}</div></body></html>`);
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
            const { chatId, message } = JSON.parse(body);
            await saveChatMessage(chatId, 'admin', message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p)); return; }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(getAdminLoginHTML());
        return;
    }

    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'), params.get('password'))) {
                const sid = createSession(params.get('username'));
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax` }); res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(getAdminLoginHTML('Invalid credentials'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' }); res.end();
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
                const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, 'Uploaded'));
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
            const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, 'Deleted'));
        });
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getMainHTML());
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' }); res.end('404');
});

async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('✅ Server running on port', PORT);
        console.log('✅ Chat with voice messages enabled');
        console.log('✅ Admin: /admin (admin / admin123)');
    });
}

start();

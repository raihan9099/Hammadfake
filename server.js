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

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR].forEach(dir => {
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
        const songs = Object.entries(groups).filter(([_, v]) => v.audio).map(([base, v]) => ({
            id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
            title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
            audioUrl: '/assets/covermusic/' + encodeURIComponent(v.audio),
            coverUrl: v.cover ? '/assets/covermusic/' + encodeURIComponent(v.cover) : null
        })).sort((a, b) => a.title.localeCompare(b.title));
        return songs;
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const cols = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of cols) { if (!names.includes(col)) await db.createCollection(col); }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ chatId: 1 }, { unique: true });
        await db.collection('chat_sessions').createIndex({ sessionToken: 1 }, { unique: true });
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        return true;
    } catch (e) { console.error('DB Error:', e.message); return false; }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

async function createOrGetChatUser(name, phone, email) {
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const q = {};
    if (phone) q.phone = phone;
    if (email) q.email = email;
    if (Object.keys(q).length > 0) {
        const existing = await db.collection('chat_users').findOne({ $or: [{ phone: phone || '' }, { email: email || '' }] });
        if (existing) return existing;
    }
    const user = { chatId, name, phone: phone || '', email: email || '', createdAt: new Date(), status: 'active', lastSeen: new Date() };
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').insertOne({ chatId, sessionToken: token, createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) });
    return token;
}

async function getChatUserByToken(token) {
    const s = await db.collection('chat_sessions').findOne({ sessionToken: token, expiresAt: { $gt: new Date() } });
    if (!s) return null;
    return await db.collection('chat_users').findOne({ chatId: s.chatId });
}

async function getChatMessages(chatId) {
    return await db.collection('chat_messages').find({ chatId }).sort({ createdAt: 1 }).limit(100).toArray();
}

async function saveChatMessage(chatId, sender, message) {
    const msg = { chatId, sender, message, createdAt: new Date(), read: false };
    await db.collection('chat_messages').insertOne(msg);
    return msg;
}

async function getAdminChatList() {
    const users = await db.collection('chat_users').find({}).sort({ lastSeen: -1 }).toArray();
    const list = [];
    for (const u of users) {
        const last = await db.collection('chat_messages').findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages').countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        list.push({ chatId: u.chatId, name: u.name, phone: u.phone, email: u.email, lastMessage: last, unread });
    }
    return list;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
}

const DATA = {
    celebrity: { name: "Baiilla Maach", fullName: "Baiilla Maach Official", photo: IMAGES.profile, bio: "Official Entertainment Profile | Bangladesh", followers: "5,000", following: "0", likes: "50K", location: "Dhaka, Bangladesh" },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", screenshot: IMAGES.official, followers: "5,000", following: "0", likes: "50K" },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: null, followers: "Growing" }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger, reason: "Copies official content to deceive followers.", threat: "Critical", reports: 156 },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead.", threat: "High", reports: 89 }
    ]
};

const sessions = new Map();
function createAdminSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
function getAdminSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML(galleryPhotos = []) {
    const songs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    const musicHTML = songs.length > 0 ? `
    <section id="music" class="py-4">
    <div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">♪</div><h2 class="text-base font-bold text-white">Cover Music</h2><span class="text-xs text-gray-400 ml-auto">${songs.length} songs</span></div>
    <div class="glass-card overflow-hidden">
    <div class="flex flex-col sm:flex-row gap-3 p-3 bg-gradient-to-r from-dark-800 to-dark-700">
    <div class="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-dark-600 flex items-center justify-center mx-auto sm:mx-0 shadow-lg" id="npCover">♪</div>
    <div class="flex-1 flex flex-col justify-center text-center sm:text-left">
    <div class="text-base font-bold text-white" id="npTitle">Select a song</div><div class="text-xs text-gray-400 mb-2">Cover Songs</div>
    <div class="mb-2"><div class="h-1 bg-white/10 rounded cursor-pointer" id="progressBar" onclick="seekAudio(event)"><div class="h-full bg-green-500 rounded w-0 transition-all" id="progressFill"></div></div><div class="flex justify-between text-xs text-gray-500 mt-1"><span id="curTime">0:00</span><span id="totTime">0:00</span></div></div>
    <div class="flex items-center justify-center sm:justify-start gap-3 mb-2">
    <button class="text-gray-400 hover:text-white p-1" onclick="prevSong()">⏮</button>
    <button class="w-9 h-9 rounded-full bg-white text-dark-900 flex items-center justify-center hover:scale-105 transition" id="ppBtn" onclick="togglePlay()"><span id="ppIcon">▶</span></button>
    <button class="text-gray-400 hover:text-white p-1" onclick="nextSong()">⏭</button>
    </div>
    <div class="flex items-center justify-center sm:justify-start gap-2">🔊<input type="range" id="volSlider" min="0" max="100" value="70" onchange="setVol(this.value)" class="w-20 h-1 accent-green-500 cursor-pointer"></div>
    </div>
    </div>
    <div class="max-h-64 overflow-y-auto"><div class="sticky top-0 bg-dark-800 px-3 py-2 border-b border-dark-600/50 text-xs font-bold text-white">Playlist</div>
    ${songs.map((s, i) => `
    <div class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-700/40 transition spotify-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl||''}" onclick="playSong(${i})">
    <span class="text-xs text-gray-500 w-5">${(i+1).toString().padStart(2,'0')}</span>
    <div class="w-8 h-8 rounded-lg overflow-hidden bg-dark-600 flex-shrink-0 flex items-center justify-center text-xs">${s.coverUrl ? '<img src="'+s.coverUrl+'" class="w-full h-full object-cover">' : '♪'}</div>
    <div class="flex-1 min-w-0"><div class="text-xs font-semibold text-white truncate">${s.title}</div><div class="text-xs text-gray-500">Cover Song</div></div>
    </div>`).join('')}
    </div>
    </div>
    </section>` : '';

    const galleryHTML = galleryPhotos.length > 0 ? `
    <section id="gallery" class="py-4"><div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">🖼</div><h2 class="text-base font-bold text-white">Gallery</h2></div>
    <div class="grid grid-cols-3 gap-2">${galleryPhotos.map(p => `<div class="rounded-xl overflow-hidden glass-card"><img src="${p.path}" class="w-full h-32 object-cover" loading="lazy">${p.caption?`<div class="px-2 py-1.5"><p class="text-xs text-gray-400 text-center">${p.caption}</p></div>`:''}</div>`).join('')}</div></section>` : '';

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#09090b"><title>Baiilla Maach Official | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}},fontFamily:{sans:['Inter','sans-serif']}}}}</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#09090b 0%,#101014 50%,#141418 100%);color:#e5e5e5;min-height:100vh;overflow-x:hidden;line-height:1.5}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.2);border-radius:2px}
.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.hover-lift{transition:all 0.3s ease}.hover-lift:hover{transform:translateY(-2px)}
.verified-glow{animation:vp 2s infinite}@keyframes vp{0%,100%{box-shadow:0 0 12px rgba(34,197,94,0.3)}50%{box-shadow:0 0 25px rgba(34,197,94,0.6)}}
.danger-glow{animation:dp 1.5s infinite}@keyframes dp{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.3)}50%{box-shadow:0 0 20px rgba(239,68,68,0.6)}}
.header-hide{transform:translateY(-100%);transition:transform 0.3s}.header-show{transform:translateY(0);transition:transform 0.3s}
.watermark-fake{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);font-size:3.5rem;font-weight:900;color:rgba(239,68,68,0.03);pointer-events:none;letter-spacing:6px;white-space:nowrap;z-index:0}
.btn-green{background:linear-gradient(135deg,#22c55e,#16a34a)}.btn-green:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(34,197,94,0.4)}
.btn-red{background:linear-gradient(135deg,#ef4444,#dc2626)}.btn-red:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(239,68,68,0.4)}
.chat-msg-user{background:rgba(139,92,246,0.15);border-radius:16px 16px 4px 16px}
.chat-msg-admin{background:rgba(255,255,255,0.06);border-radius:16px 16px 16px 4px}
</style>
</head>
<body class="min-h-screen">

<header id="mainHeader" class="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 header-show">
<div class="max-w-5xl mx-auto px-3"><div class="flex items-center justify-between h-12">
<div class="flex items-center gap-2"><img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 rounded-full border-2 border-accent-purple object-cover" onerror="this.style.display='none'"><span class="text-sm font-bold gradient-text">Verification Hub</span></div>
<nav class="flex items-center gap-1">
<a href="#official" class="px-2 py-1 text-xs text-gray-400 hover:text-white rounded">Official</a>
<a href="#fake" class="px-2 py-1 text-xs text-gray-400 hover:text-red-400 rounded">Fakes</a>
${songs.length>0?'<a href="#music" class="px-2 py-1 text-xs text-gray-400 hover:text-green-400 rounded">Music</a>':''}
<a href="#chat" class="px-2 py-1 text-xs text-gray-400 hover:text-purple-400 rounded">Chat</a>
</nav>
</div></div>
</header>

<main class="pt-14 pb-10"><div class="max-w-5xl mx-auto px-3">

<section class="text-center py-6">
<div class="relative inline-block mb-3"><img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-accent-purple object-cover mx-auto shadow-lg" onerror="this.style.display='none'"><div class="absolute -bottom-1 -right-1 w-6 h-6 bg-accent-green rounded-full border-3 border-dark-950 flex items-center justify-center verified-glow">✓</div></div>
<h1 class="text-xl font-extrabold gradient-text mb-1">${DATA.celebrity.fullName}</h1>
<p class="text-xs text-gray-400 mb-3">${DATA.celebrity.bio}</p>
<div class="flex justify-center gap-4 mb-3">
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.followers}</div><div class="text-xs text-gray-500 uppercase">Followers</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.following}</div><div class="text-xs text-gray-500 uppercase">Following</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.likes}</div><div class="text-xs text-gray-500 uppercase">Likes</div></div>
</div>
<div class="flex justify-center gap-2 flex-wrap mb-3">
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/25 rounded-full text-xs font-semibold verified-glow">Verified Official</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-full text-xs font-semibold">Creator</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-700/40 text-gray-300 rounded-full text-xs">${DATA.celebrity.location}</span>
</div>
<div class="flex justify-center gap-2">
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-white/20 transition">TikTok</a>
<a href="${realAcc[1].url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-white/20 transition">Facebook</a>
</div>
</section>

<section id="official" class="py-4">
<div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center verified-glow">✓</div><h2 class="text-base font-bold text-white">Official Verified Account</h2></div>
<div class="glass-card p-4 hover-lift relative overflow-hidden">
<div class="absolute top-3 right-3 z-10"><span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-xs font-bold verified-glow">VERIFIED</span></div>
<div class="flex items-center gap-3 mb-4 pt-1">
<div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center verified-glow flex-shrink-0">✓</div>
<div><h3 class="text-sm font-bold text-white">The Only Authentic Account</h3><p class="text-xs text-gray-400">This account has been verified as the one and only official profile</p></div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${realAcc.map(acc => `
<div class="bg-dark-700/40 rounded-xl p-3 border border-dark-600/30">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase tracking-wider text-gray-500 font-semibold">${acc.platform}</span><span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full font-semibold">Verified</span></div>
<div class="flex items-center gap-2 mb-2">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover border border-dark-500" onerror="this.style.display='none'">` : `<div class="w-12 h-12 rounded-lg bg-dark-600 flex items-center justify-center text-lg font-bold">${acc.platform==='TikTok'?'T':'F'}</div>`}
<div><div class="font-bold text-white text-sm">${acc.username}</div><div class="text-xs text-gray-400">${acc.platform}${acc.followers?' • '+acc.followers+' followers':''}</div></div>
</div>
${acc.platform==='TikTok'?`<div class="grid grid-cols-3 gap-1.5 text-center"><div class="bg-dark-600/30 rounded-lg py-1.5"><div class="text-sm font-bold text-white">${acc.followers}</div><div class="text-xs text-gray-500">Followers</div></div><div class="bg-dark-600/30 rounded-lg py-1.5"><div class="text-sm font-bold text-white">${acc.following}</div><div class="text-xs text-gray-500">Following</div></div><div class="bg-dark-600/30 rounded-lg py-1.5"><div class="text-sm font-bold text-white">${acc.likes}</div><div class="text-xs text-gray-500">Likes</div></div></div>`:''}
</div>`).join('')}
</div>
<div class="bg-dark-700/40 rounded-xl p-4 border border-dark-600/30 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-accent-green mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div><div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="btn-green px-5 py-2.5 rounded-full text-white font-bold text-xs">Follow Official Account</a>
<p class="text-xs text-gray-500 mt-3">This is the only authentic account. All others claiming to be Baiilla Maach are fake.</p>
</div>
</div>
</div>
</section>

<section id="fake" class="py-4">
<div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center danger-glow">!</div><h2 class="text-base font-bold text-white">Fake Accounts Detected</h2><span class="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full font-bold">${totalFake} Active</span></div>
<div class="glass-card border-red-500/20 p-3 mb-3"><div class="flex items-center gap-2 bg-red-500/5 rounded-xl px-3 py-2 border border-red-500/15"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center danger-glow flex-shrink-0">!</div><div><p class="text-xs font-bold text-red-400">Warning: ${totalFake} Fake Account${totalFake>1?'s':''} Found</p><p class="text-xs text-gray-400">Not affiliated with Baiilla Maach. Report immediately.</p></div></div></div>

<div class="relative overflow-hidden rounded-2xl" id="fakeCarousel"><div class="flex transition-transform duration-500 ease-out" id="fakeTrack">
${fakeAcc.map((a, i) => `
<div class="min-w-full px-0.5"><div class="glass-card border-red-500/20 p-3 relative overflow-hidden"><div class="watermark-fake">FAKE</div><div class="relative z-10">
<div class="flex items-center justify-between mb-2"><div class="flex items-center gap-1.5">!<span class="font-bold text-red-300 text-xs">Fake Account #${i+1}</span></div><span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-bold uppercase">${a.threat}</span></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
<div class="relative rounded-xl overflow-hidden border-2 border-red-500/30 bg-dark-900">${a.screenshot?`<img src="${a.screenshot}" alt="" class="w-full h-auto object-cover opacity-90" loading="lazy">`:'<div class="w-full h-40 flex items-center justify-center text-3xl text-red-500/30">FAKE</div>'}<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1"><span class="bg-red-500/85 text-white px-3 py-1 rounded-lg text-xs font-extrabold tracking-wider">FAKE ACCOUNT</span><span class="bg-red-500/85 text-white px-2 py-0.5 rounded-lg text-xs font-bold">DO NOT TRUST</span></div></div>
<div class="space-y-1.5">
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Platform</span><span class="text-red-300 font-semibold">${a.platform}</span></div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Username</span><span class="text-red-300 font-semibold">${a.username}</span></div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Status</span><span class="text-red-300 font-semibold">Active Threat</span></div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Reports</span><span class="text-red-300 font-semibold">${a.reports}+</span></div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300 border border-red-500/15">${a.reason}</div>
</div></div>
<div class="flex gap-2 mt-3"><a href="${a.profileUrl}" target="_blank" rel="noopener" class="flex-1 text-center btn-red px-3 py-2 rounded-full text-white text-xs font-bold">Report</a><button class="flex-1 px-3 py-2 bg-dark-700 border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10 transition copy-btn" data-username="${a.username}">Copy Username</button></div>
<div class="glass-card p-2.5 mt-3 flex items-center gap-2 cursor-pointer hover:border-purple-500/40 transition" onclick="toggleFakeVoice()"><div class="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">🔊</div><div><p class="text-xs font-medium text-white">Verify Voice Alert</p><p class="text-xs text-gray-400">Click to hear warning</p></div></div>
</div></div></div>`).join('')}
</div></div>

<div class="flex justify-center items-center gap-3 mt-3">
<button class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs hover:bg-red-500/20 transition" onclick="moveCarousel(-1)">◀</button>
<div class="flex gap-1.5" id="carouselDots">${fakeAcc.map((_, i) => `<button class="w-2 h-2 rounded-full transition-all duration-300 ${i===0?'bg-red-500 w-6':'bg-dark-600'}" onclick="goSlide(${i})"></button>`).join('')}</div>
<button class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs hover:bg-red-500/20 transition" onclick="moveCarousel(1)">▶</button>
</div>
<audio id="fakeVoicePlayer" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

${musicHTML}

<section id="chat" class="py-4">
<div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">💬</div><h2 class="text-base font-bold text-white">Chat with Hammad Bin Amir</h2></div>
<div class="glass-card p-4">
<div id="chatRegisterForm" class="space-y-3">
<p class="text-sm text-gray-300 mb-3">Enter your details to start chatting</p>
<input type="text" id="chatName" placeholder="Your Name" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition">
<input type="text" id="chatPhone" placeholder="Phone Number (optional)" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition">
<input type="email" id="chatEmail" placeholder="Email Address (optional)" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition">
<button onclick="registerChat()" class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Start Chat</button>
</div>
<div id="chatInterface" class="hidden">
<div class="h-80 overflow-y-auto mb-3 space-y-2 pr-2" id="chatMessages"><div class="text-center text-xs text-gray-500 py-4">Loading...</div></div>
<div class="flex gap-2"><input type="text" id="chatInput" placeholder="Type your message..." class="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition" onkeypress="if(event.key==='Enter')sendMessage()"><button onclick="sendMessage()" class="px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm">Send</button></div>
</div>
</div>
</section>

${galleryHTML}

</div></main>

<footer class="border-t border-white/5 py-4 text-center"><p class="text-xs text-gray-600">&copy; ${DATA.celebrity.fullName} • Official Verification Hub</p></footer>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>
<audio id="audioPlayer" preload="none"></audio>

<script>
(function(){const wv=document.getElementById('welcomeVoice');if(!sessionStorage.getItem('wvPlayed')){setTimeout(()=>{wv.play().catch(()=>{});sessionStorage.setItem('wvPlayed','1')},2000)}})();

let ls=0,h=document.getElementById('mainHeader');
window.addEventListener('scroll',()=>{const s=window.scrollY;if(s>ls&&s>60){h.classList.add('header-hide');h.classList.remove('header-show')}else if(s<ls){h.classList.remove('header-hide');h.classList.add('header-show')}ls=s});

let cs=0,tsl=${totalFake},track=document.getElementById('fakeTrack'),dots=document.querySelectorAll('#carouselDots button'),auto;
function uc(){track.style.transform='translateX(-'+(cs*100)+'%)';dots.forEach((d,i)=>{if(i===cs){d.classList.add('bg-red-500','w-6');d.classList.remove('bg-dark-600')}else{d.classList.remove('bg-red-500','w-6');d.classList.add('bg-dark-600')}})}
function mc(d){cs=(cs+d+tsl)%tsl;uc();clearInterval(auto);auto=setInterval(()=>mc(1),6000)}
function gs(i){cs=i;uc();clearInterval(auto);auto=setInterval(()=>mc(1),6000)}
auto=setInterval(()=>mc(1),6000);
let tx=0;track.parentElement.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX});
track.parentElement.addEventListener('touchend',e=>{const d=tx-e.changedTouches[0].screenX;if(Math.abs(d)>40)mc(d>0?1:-1)});

document.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',function(){navigator.clipboard.writeText(this.dataset.username).then(()=>{const o=this.textContent;this.textContent='Copied!';this.style.background='rgba(34,197,94,0.2)';this.style.color='#22c55e';this.style.borderColor='rgba(34,197,94,0.5)';setTimeout(()=>{this.textContent=o;this.style.background='';this.style.color='';this.style.borderColor=''},2000)})}));

function toggleFakeVoice(){const fv=document.getElementById('fakeVoicePlayer');if(fv.paused){fv.play().catch(()=>{})}else{fv.pause();fv.currentTime=0}}

let cur=-1,pl=false,ap=document.getElementById('audioPlayer'),items=document.querySelectorAll('.spotify-item');
function loadSong(i){if(!items.length||i<0||i>=items.length)return;if(cur===i)return;cur=i;const it=items[i];ap.src=it.dataset.audio;ap.load();document.getElementById('npTitle').textContent=it.querySelector('.text-xs').textContent;document.getElementById('npCover').innerHTML=it.dataset.cover?'<img src="'+it.dataset.cover+'" class="w-full h-full object-cover">':'♪';items.forEach(el=>el.classList.remove('bg-green-500/8'));it.classList.add('bg-green-500/8');document.getElementById('progressFill').style.width='0%';document.getElementById('curTime').textContent='0:00';document.getElementById('totTime').textContent='0:00';ap.play().then(()=>{pl=true;upb()}).catch(e=>{alert('Cannot play this audio file. It may be corrupted or unsupported format.');pl=false;upb()})}
function playSong(i){if(i===cur)tp();else loadSong(i)}
function tp(){if(!ap.src&&items.length>0){loadSong(0);return}if(pl){ap.pause();pl=false}else{ap.play().then(()=>{pl=true}).catch(e=>{alert('Playback failed. Please try again.');pl=false})}upb()}
function upb(){document.getElementById('ppIcon').textContent=pl?'⏸':'▶'}
function ns(){if(items.length)loadSong((cur+1)%items.length)}
function ps(){if(items.length)loadSong(cur<=0?items.length-1:cur-1)}
function setVol(v){ap.volume=v/100}
function seekAudio(e){const r=e.target.getBoundingClientRect();if(ap.duration)ap.currentTime=((e.clientX-r.left)/r.width)*ap.duration}
ap.addEventListener('timeupdate',()=>{if(ap.duration){document.getElementById('progressFill').style.width=(ap.currentTime/ap.duration)*100+'%';const m=Math.floor(ap.currentTime/60),s=Math.floor(ap.currentTime%60);document.getElementById('curTime').textContent=m+':'+s.toString().padStart(2,'0')}});
ap.addEventListener('loadedmetadata',()=>{const m=Math.floor(ap.duration/60),s=Math.floor(ap.duration%60);document.getElementById('totTime').textContent=m+':'+s.toString().padStart(2,'0')});
ap.addEventListener('ended',()=>{pl=false;upb();ns()});
ap.addEventListener('error',()=>{alert('Audio file error. The file may not exist or is corrupted.');pl=false;upb()});
ap.volume=0.7;

let chatToken='',chatId='',chatPollInterval;
async function registerChat(){const n=document.getElementById('chatName').value.trim();const p=document.getElementById('chatPhone').value.trim();const e=document.getElementById('chatEmail').value.trim();if(!n)return alert('Please enter your name');if(!p&&!e)return alert('Please enter phone or email');try{const r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phone:p,email:e})});const d=await r.json();if(d.success){chatToken=d.sessionToken;chatId=d.chatId;document.getElementById('chatRegisterForm').classList.add('hidden');document.getElementById('chatInterface').classList.remove('hidden');loadChatMessages();chatPollInterval=setInterval(loadChatMessages,3000)}else{alert(d.error||'Registration failed. Please try again.')}}catch(err){alert('Connection error. Please check your internet and try again.')}}
async function loadChatMessages(){try{const r=await fetch('/api/chat/messages?token='+chatToken);const d=await r.json();if(d.success){const mc=document.getElementById('chatMessages');mc.innerHTML=d.messages.map(m=>'<div class="flex '+(m.sender==='user'?'justify-end':'justify-start')+'"><div class="max-w-[80%] px-4 py-2.5 text-sm '+(m.sender==='user'?'chat-msg-user text-white':'chat-msg-admin text-gray-200')+'">'+m.message+'<div class="text-xs text-gray-500 mt-1">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div></div>').join('');mc.scrollTop=mc.scrollHeight}}catch(err){clearInterval(chatPollInterval)}}
async function sendMessage(){const msg=document.getElementById('chatInput').value.trim();if(!msg)return;try{const r=await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:chatToken,message:msg})});const d=await r.json();if(d.success){document.getElementById('chatInput').value='';loadChatMessages()}}catch(err){alert('Failed to send message. Please try again.')}}
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899'}}}}}</script><style>.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}</style></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 flex items-center justify-center min-h-screen font-sans"><div class="glass-card p-8 w-full max-w-md"><div class="text-center mb-6"><h2 class="text-xl font-bold text-white">Admin Login</h2></div>${error?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm text-center">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="mb-4"><input type="text" name="username" placeholder="Username" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition" required></div><div class="mb-5"><input type="password" name="password" placeholder="Password" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition" required></div><button type="submit" class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm">Sign In</button></form><div class="text-center mt-5"><a href="/" class="text-sm text-gray-500 hover:text-white transition">Back to Home</a></div></div></body></html>`;
}

function getAdminChatHTML(chatList = [], selectedChatId = null, selectedMessages = []) {
    const listHTML = chatList.map(c => `
    <div class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-dark-700/40 transition border-b border-dark-700/30 ${c.chatId===selectedChatId?'bg-purple-500/10 border-l-2 border-l-purple-500':''}" onclick="location.href='/admin/dashboard?chat=${c.chatId}'">
    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">${c.name.charAt(0).toUpperCase()}</div>
    <div class="flex-1 min-w-0"><div class="flex justify-between items-center"><span class="text-sm font-bold text-white truncate">${c.name}</span><span class="text-xs text-gray-500">${c.lastMessage?new Date(c.lastMessage.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</span></div><div class="flex justify-between items-center"><span class="text-xs text-gray-400 truncate">${c.lastMessage?(c.lastMessage.sender==='admin'?'You: ':'')+c.lastMessage.message:'No messages'}</span>${c.unread>0?`<span class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">${c.unread}</span>`:''}</div></div></div>`).join('');

    const msgsHTML = selectedMessages.map(m => `<div class="flex ${m.sender==='user'?'justify-start':'justify-end'}"><div class="max-w-[70%] px-4 py-2 text-sm ${m.sender==='user'?'bg-dark-700 text-gray-200 rounded-r-xl rounded-bl-xl':'bg-green-500/15 text-green-400 rounded-l-xl rounded-br-xl'}">${m.message}<div class="text-xs text-gray-500 mt-1">${new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join('');

    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Chat</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}}}}}</script><style>.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}</style></head><body class="bg-dark-950 text-gray-200 font-sans h-screen flex"><div class="w-80 bg-dark-900 border-r border-dark-700 flex flex-col"><div class="p-4 border-b border-dark-700"><h2 class="text-lg font-bold gradient-text">Chats</h2></div><div class="flex-1 overflow-y-auto">${listHTML}</div><div class="p-3 border-t border-dark-700"><a href="/admin" class="block text-center text-sm text-gray-400 hover:text-white transition">Back to Admin</a></div></div><div class="flex-1 flex flex-col"><div class="p-4 border-b border-dark-700 bg-dark-900"><h3 class="font-bold text-white">${selectedChatId?chatList.find(c=>c.chatId===selectedChatId)?.name||'Chat':'Select a chat'}</h3></div><div class="flex-1 overflow-y-auto p-4 space-y-3" id="msgContainer">${msgsHTML||'<p class="text-center text-gray-500 mt-10">Select a chat to view messages</p>'}</div>${selectedChatId?`<div class="p-3 border-t border-dark-700 bg-dark-900 flex gap-2"><input type="text" id="adminMsgInput" placeholder="Type a reply..." class="flex-1 bg-dark-700 border border-dark-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition" onkeypress="if(event.key==='Enter')sendAdminMsg()"><button onclick="sendAdminMsg()" class="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm">Send</button></div>`:''}</div><script>async function sendAdminMsg(){const msg=document.getElementById('adminMsgInput').value.trim();if(!msg)return;try{await fetch('/api/admin/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:'${selectedChatId||''}',message:msg})});location.reload()}catch(e){alert('Error sending message')}}</script></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="glass-card overflow-hidden hover-lift"><img src="${p.path}" class="w-full h-40 object-cover"><div class="p-3">${p.caption?`<p class="text-sm text-gray-300">${p.caption}</p>`:''}<p class="text-xs text-gray-500 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="w-full py-2 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}}}}}</script><style>.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}.hover-lift{transition:all 0.3s}.hover-lift:hover{transform:translateY(-2px)}</style></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen"><header class="glass border-b border-white/5 sticky top-0 z-50"><div class="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center"><h2 class="text-lg font-bold gradient-text">Admin Panel</h2><div class="flex gap-2"><a href="/" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-white/20 transition">Site</a><a href="/admin/dashboard" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-white/20 transition">Chats</a><a href="/admin/logout" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-red-500/50 transition">Logout</a></div></div></header><div class="max-w-6xl mx-auto px-4 py-6">${msg?`<div class="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl mb-5 text-sm">${msg}</div>`:''}${err?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm">${err}</div>`:''}<div class="glass-card p-6 mb-6"><h3 class="text-lg font-bold text-white mb-4">Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="mb-4"><label class="block text-gray-400 text-sm font-semibold mb-1.5">Photo</label><input type="file" name="photo" accept="image/*" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-500 file:text-white file:font-semibold file:text-sm file:cursor-pointer focus:outline-none transition" required></div><div class="mb-5"><label class="block text-gray-400 text-sm font-semibold mb-1.5">Caption</label><input type="text" name="caption" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"></div><button type="submit" class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm">Upload</button></form></div><h3 class="text-lg font-bold text-white mb-4">Gallery (${photos.length})</h3>${photos.length?`<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">${phtml}</div>`:'<p class="text-gray-500 text-center py-12">No photos yet</p>'}</div></body></html>`;
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
        const decodedPathname = decodeURIComponent(pathname);
        const assetPath = path.join(__dir, decodedPathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac' };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            const range = req.headers.range;
            if (range && ['.mp3','.wav','.ogg','.m4a','.aac','.flac'].includes(ext)) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                res.writeHead(206, { 'Content-Range':`bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges':'bytes', 'Content-Length':(end-start)+1, 'Content-Type':ct, 'Cache-Control':'public, max-age=86400' });
                fs.createReadStream(assetPath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, { 'Content-Type':ct, 'Content-Length':stat.size, 'Cache-Control':'public, max-age=86400', 'Accept-Ranges':'bytes' });
                fs.createReadStream(assetPath).pipe(res);
            }
        } else { res.writeHead(404); res.end(); }
        return;
    }

    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            try { const { name, phone, email } = JSON.parse(body); if (!name || (!phone && !email)) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false,error:'Name and phone or email required'})); return; } const user = await createOrGetChatUser(name, phone, email); const token = await createChatSession(user.chatId); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true,chatId:user.chatId,sessionToken:token})); } catch(e) { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false,error:e.message})); }
        }); return;
    }

    if (pathname === '/api/chat/messages' && method === 'GET') {
        const token = parsedUrl.query.token; if (!token) { res.writeHead(401,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); return; }
        const user = await getChatUserByToken(token); if (!user) { res.writeHead(401,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); return; }
        const messages = await getChatMessages(user.chatId); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true,messages})); return;
    }

    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            try { const { token, message } = JSON.parse(body); if (!token||!message) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); return; } const user = await getChatUserByToken(token); if (!user) { res.writeHead(401,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); return; } await saveChatMessage(user.chatId, 'user', message); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true})); } catch(e) { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); }
        }); return;
    }

    if (pathname === '/api/admin/chat/send' && method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            try { const { chatId, message } = JSON.parse(body); if (!chatId||!message) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); return; } await saveChatMessage(chatId, 'admin', message); await markMessagesRead(chatId); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true})); } catch(e) { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false})); }
        }); return;
    }

    if (pathname === '/admin' && method === 'GET') {
        const s = getAdminSession(cookies.sessionId);
        if (s) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p)); return; }
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML()); return;
    }

    if (pathname === '/admin/dashboard' && method === 'GET') {
        const s = getAdminSession(cookies.sessionId);
        if (!s) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        const chatList = await getAdminChatList();
        const selectedChatId = parsedUrl.query.chat || null;
        let selectedMessages = [];
        if (selectedChatId) { selectedMessages = await getChatMessages(selectedChatId); await markMessagesRead(selectedChatId); }
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminChatHTML(chatList, selectedChatId, selectedMessages)); return;
    }

    if (pathname === '/admin/login' && method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'),params.get('password'))) {
                const sid = createAdminSession(params.get('username'));
                res.writeHead(302,{'Location':'/admin','Set-Cookie':`sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`}); res.end();
            } else { res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML('Invalid credentials')); }
        }); return;
    }

    if (pathname === '/admin/logout') { sessions.delete(cookies.sessionId); res.writeHead(302,{'Location':'/admin','Set-Cookie':'sessionId=;HttpOnly;Path=/;Max-Age=0'}); res.end(); return; }

    if (pathname === '/admin/upload' && method === 'POST') {
        if (!getAdminSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir:GALLERY_DIR, keepExtensions:true, maxFileSize:10*1024*1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Upload error: '+err.message)); return; }
            const pf = Array.isArray(files.photo)?files.photo[0]:files.photo;
            if (!pf||!pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','No file selected')); return; }
            if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(path.extname(pf.originalFilename).toLowerCase())) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Invalid format. Use JPG, PNG, GIF, or WebP')); return; }
            const fn = Date.now()+'_'+pf.originalFilename.replace(/[^a-zA-Z0-9.]/g,'_');
            try { fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn)); await savePhoto({ path:'/assets/gallery/'+fn, caption:fields.caption?(Array.isArray(fields.caption)?fields.caption[0]:fields.caption):'' }); const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Uploaded successfully')); } catch(e) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Save error: '+e.message)); }
        }); return;
    }

    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getAdminSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            try { const photo = await db.collection('gallery_photos').findOne({_id:new ObjectId(params.get('photoId'))}); if(photo){const fp=path.join(__dir,photo.path);if(fs.existsSync(fp))fs.unlinkSync(fp);} await deletePhoto(params.get('photoId')); } catch(e){}
            const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Deleted'));
        }); return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=3600'});
        res.end(getMainHTML(photos));
        return;
    }

    res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-dark-950 flex items-center justify-center h-screen text-white font-sans"><div class="text-center"><h1 class="text-8xl font-bold text-purple-500">404</h1><p class="text-gray-400">Page not found</p><a href="/" class="inline-block mt-4 px-5 py-2 bg-purple-500 text-white rounded-lg">Home</a></div></body></html>`);
});

async function start() {
    const dbOk = await connectDB();
    if (!dbOk) console.log('WARNING: MongoDB not connected. Chat and gallery features may not work.');
    const songs = getCoverSongs();
    console.log(`Cover songs found: ${songs.length}`);
    server.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
        console.log(`Admin: http://localhost:${PORT}/admin (admin / admin123)`);
        console.log(`Admin Chat: http://localhost:${PORT}/admin/dashboard`);
    });
}

start();
server.on('error', e => { if (e.code === 'EADDRINUSE') { console.error('Port ' + PORT + ' is in use.'); process.exit(1); } });

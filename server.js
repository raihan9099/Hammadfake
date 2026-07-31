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
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { unique: true, sparse: true });
        await db.collection('chat_sessions').createIndex({ chatId: 1 });
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        return true;
    } catch (e) { return false; }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

// Chat System Functions
async function createOrGetChatUser(name, phoneEmail) {
    const existing = await db.collection('chat_users').findOne({ phoneEmail });
    if (existing) {
        // Update name if changed and update last seen
        await db.collection('chat_users').updateOne(
            { phoneEmail },
            { $set: { name, lastSeen: new Date(), status: 'active' } }
        );
        return existing;
    }
    
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const user = {
        chatId,
        name,
        phoneEmail,
        createdAt: new Date(),
        status: 'active',
        lastSeen: new Date()
    };
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').insertOne({
        chatId,
        sessionToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000) // 24 hours
    });
    return sessionToken;
}

async function getChatUserByToken(sessionToken) {
    const session = await db.collection('chat_sessions').findOne({
        sessionToken,
        expiresAt: { $gt: new Date() }
    });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getChatMessages(chatId) {
    return await db.collection('chat_messages')
        .find({ chatId })
        .sort({ createdAt: 1 })
        .limit(100)
        .toArray();
}

async function saveChatMessage(chatId, sender, message) {
    const msg = {
        chatId,
        sender,
        message,
        createdAt: new Date(),
        read: false
    };
    await db.collection('chat_messages').insertOne(msg);
    
    // Update user's last seen
    await db.collection('chat_users').updateOne(
        { chatId },
        { $set: { lastSeen: new Date() } }
    );
    
    return msg;
}

async function getAdminChatList() {
    const users = await db.collection('chat_users')
        .find({ status: 'active' })
        .sort({ lastSeen: -1 })
        .toArray();
    
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages')
            .findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages')
            .countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        
        list.push({
            chatId: u.chatId,
            name: u.name,
            phoneEmail: u.phoneEmail,
            lastSeen: u.lastSeen,
            lastMessage: lastMsg,
            unread
        });
    }
    return list;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
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
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            screenshot: IMAGES.official,
            verified: true,
            followers: "5,000",
            following: "0",
            likes: "50K"
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            screenshot: null,
            verified: true,
            followers: "Growing"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            reason: "Impersonating official account by copying content and profile picture to deceive followers.",
            threatLevel: "Critical",
            reportedCount: 156
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            reason: "Using official name and photos without authorization to mislead followers.",
            threatLevel: "High",
            reportedCount: 89
        }
    ]
};

const sessions = new Map();
function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: u, createdAt: Date.now() });
    setTimeout(() => sessions.delete(id), 7200000);
    return id;
}
function getSession(id) {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > 7200000) {
        sessions.delete(id);
        return null;
    }
    return s;
}
function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(x => {
        const p = x.split('=');
        c[p[0].trim()] = p[1] ? p[1].trim() : '';
    });
    return c;
}

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#09090b">
<title>Baiilla Maach Official | Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={darkMode:'class',theme:{extend:{colors:{primary:{50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065'},dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b',500:'#2e2e32'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444',amber:'#f59e0b'}},fontFamily:{sans:['Inter','sans-serif']},animation:{'fade-in':'fadeIn 0.5s ease-out forwards','slide-up':'slideUp 0.4s ease-out forwards'},keyframes:{fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},slideUp:{'0%':{transform:'translateY(16px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}}}}}}
</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#09090b 0%,#101014 50%,#141418 100%);color:#e5e5e5;min-height:100vh;overflow-x:hidden;line-height:1.5}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:2px}
::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.15);border-radius:2px}
.gradient-text{background:linear-gradient(135deg,#a78bfa 0%,#ec4899 50%,#a78bfa 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradient-x 3s ease infinite}
@keyframes gradient-x{0%,100%{background-position:left center}50%{background-position:right center}}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.hover-lift{transition:all 0.3s ease}.hover-lift:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(0,0,0,0.3)}
.verified-glow{animation:vp 2s ease-in-out infinite}@keyframes vp{0%,100%{box-shadow:0 0 12px rgba(34,197,94,0.3)}50%{box-shadow:0 0 25px rgba(34,197,94,0.6)}}
.danger-glow{animation:dp 1.5s ease-in-out infinite}@keyframes dp{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.3)}50%{box-shadow:0 0 20px rgba(239,68,68,0.6)}}
.music-bar{background:rgba(255,255,255,0.08);border-radius:3px;height:4px;cursor:pointer}
.music-fill{background:linear-gradient(90deg,#1db954,#169c46);border-radius:3px;height:100%;width:0%;transition:width 0.15s linear}
.eq-bar{width:2px;background:#1db954;border-radius:1px;animation:eq 0.9s ease-in-out infinite}@keyframes eq{0%,100%{height:3px}50%{height:14px}}
.header-hide{transform:translateY(-100%);transition:transform 0.3s ease}.header-show{transform:translateY(0);transition:transform 0.3s ease}
.watermark-fake{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);font-size:3.5rem;font-weight:900;color:rgba(239,68,68,0.03);pointer-events:none;letter-spacing:6px;white-space:nowrap;z-index:0}
.btn-green{background:linear-gradient(135deg,#22c55e,#16a34a);transition:all 0.3s}.btn-green:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(34,197,94,0.4)}
.btn-red{background:linear-gradient(135deg,#ef4444,#dc2626);transition:all 0.3s}.btn-red:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(239,68,68,0.4)}
.chat-msg-user{background:rgba(139,92,246,0.15);border-radius:16px 16px 4px 16px}
.chat-msg-admin{background:rgba(255,255,255,0.06);border-radius:16px 16px 16px 4px}
</style>
</head>
<body class="min-h-screen">

<header id="mainHeader" class="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 header-show">
<div class="max-w-5xl mx-auto px-3">
<div class="flex items-center justify-between h-12">
<div class="flex items-center gap-2">
<img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 rounded-full border-2 border-accent-purple object-cover" onerror="this.style.display='none'">
<span class="text-sm font-bold gradient-text">Verification Hub</span>
</div>
<nav class="flex items-center gap-1">
<a href="#official" class="px-2 py-1 text-xs text-gray-400 hover:text-white rounded transition">Official</a>
<a href="#fake" class="px-2 py-1 text-xs text-gray-400 hover:text-red-400 rounded transition">Fake Accounts</a>
<a href="#music" class="px-2 py-1 text-xs text-gray-400 hover:text-green-400 rounded transition">Music</a>
<a href="#chat" class="px-2 py-1 text-xs text-gray-400 hover:text-accent-purple rounded transition">Chat</a>
</nav>
</div>
</div>
</header>

<main class="pt-14 pb-10">
<div class="max-w-5xl mx-auto px-3">

<section class="text-center py-6 animate-fade-in">
<div class="relative inline-block mb-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-accent-purple object-cover mx-auto shadow-glow" onerror="this.style.display='none'">
<div class="absolute -bottom-1 -right-1 w-6 h-6 bg-accent-green rounded-full border-3 border-dark-950 flex items-center justify-center verified-glow">
<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
</div>
<h1 class="text-xl font-extrabold gradient-text mb-1">${DATA.celebrity.fullName}</h1>
<p class="text-xs text-gray-400 mb-3">${DATA.celebrity.bio}</p>
<div class="flex justify-center gap-4 mb-3">
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokFollowers}</div><div class="text-xs text-gray-500 uppercase">Followers</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokFollowing}</div><div class="text-xs text-gray-500 uppercase">Following</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokLikes}</div><div class="text-xs text-gray-500 uppercase">Likes</div></div>
</div>
<div class="flex justify-center gap-2 flex-wrap mb-3">
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-accent-green/10 text-accent-green border border-accent-green/25 rounded-full text-xs font-semibold verified-glow">✓ Verified Official Account</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-accent-purple/10 text-accent-purple border border-accent-purple/25 rounded-full text-xs font-semibold">Content Creator</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-700/40 text-gray-300 border border-dark-600 rounded-full text-xs">📍 ${DATA.celebrity.location}</span>
</div>
<div class="flex justify-center gap-2">
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-white/20 transition">🎵 TikTok</a>
<a href="${realAcc[1].url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-white/20 transition">📘 Facebook</a>
</div>
</section>

<section id="official" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-accent-green/15 flex items-center justify-center verified-glow">
<svg class="w-3.5 h-3.5 text-accent-green" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">✓ Official Verified Accounts</h2>
</div>
<div class="glass-card p-4 hover-lift relative overflow-hidden">
<div class="absolute top-3 right-3 z-10">
<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-green/15 text-accent-green border border-accent-green/30 rounded-full text-xs font-bold verified-glow">✓ VERIFIED AUTHENTIC</span>
</div>
<div class="flex items-center gap-3 mb-4 pt-1">
<div class="w-10 h-10 rounded-full bg-gradient-to-br from-accent-green to-green-600 flex items-center justify-center verified-glow flex-shrink-0">
<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<div><h3 class="text-sm font-bold text-white">The Only Authentic Account</h3><p class="text-xs text-gray-400">These are the only official accounts verified as authentic. All others claiming to be Baiilla Maach are fake.</p></div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${realAcc.map(acc => `
<div class="bg-dark-700/40 rounded-xl p-3 border border-dark-600/30">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase tracking-wider text-gray-500 font-semibold">${acc.platform}</span><span class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-green/10 text-accent-green text-xs rounded-full font-semibold">✓ Verified</span></div>
<div class="flex items-center gap-2 mb-2">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover border border-dark-500" onerror="this.style.display='none'">` : `<div class="w-12 h-12 rounded-lg bg-dark-600 flex items-center justify-center text-lg font-bold">${acc.platform==='TikTok'?'T':'F'}</div>`}
<div><div class="font-bold text-white text-sm">${acc.username}</div><div class="text-xs text-gray-400">${acc.platform}${acc.followers?' • '+acc.followers+' followers':''}</div></div>
</div>
${acc.platform==='TikTok'?`
<div class="grid grid-cols-3 gap-1.5 text-center">
<div class="bg-dark-600/30 rounded-lg py-1.5"><div class="text-sm font-bold text-white">${acc.followers}</div><div class="text-xs text-gray-500">Followers</div></div>
<div class="bg-dark-600/30 rounded-lg py-1.5"><div class="text-sm font-bold text-white">${acc.following}</div><div class="text-xs text-gray-500">Following</div></div>
<div class="bg-dark-600/30 rounded-lg py-1.5"><div class="text-sm font-bold text-white">${acc.likes}</div><div class="text-xs text-gray-500">Likes</div></div>
</div>`:''}
</div>`).join('')}
</div>
<div class="bg-dark-700/40 rounded-xl p-4 border border-dark-600/30 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-accent-green mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="btn-green px-5 py-2.5 rounded-full text-white font-bold text-xs">✓ Follow Official Account</a>
<p class="text-xs text-gray-500 mt-3">⚠️ Important: This is the only authentic account. All others claiming to be Baiilla Maach are fake and should be reported.</p>
</div>
</div>
</div>
</section>

<section id="fake" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-accent-red/15 flex items-center justify-center danger-glow">
<svg class="w-3.5 h-3.5 text-accent-red" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">⚠️ Fake Accounts Detected</h2>
<span class="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full font-bold">${totalFake} Active</span>
</div>

<div class="glass-card border-red-500/20 p-3 mb-3">
<div class="flex items-center gap-2 bg-red-500/5 rounded-xl px-3 py-2 border border-red-500/15">
<div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-red to-red-600 flex items-center justify-center danger-glow flex-shrink-0">⚠️</div>
<div><p class="text-xs font-bold text-red-400">Warning: ${totalFake} Fake Account${totalFake>1?'s':''} Impersonating</p><p class="text-xs text-gray-400">These accounts are NOT affiliated with Baiilla Maach. Report them immediately to protect others.</p></div>
</div>
</div>

<div class="relative overflow-hidden rounded-2xl" id="fakeCarousel">
<div class="flex transition-transform duration-500 ease-out" id="fakeTrack">
${fakeAcc.map((a, i) => `
<div class="min-w-full px-0.5">
<div class="glass-card border-red-500/20 p-3 relative overflow-hidden">
<div class="watermark-fake">FAKE</div>
<div class="relative z-10">
<div class="flex items-center justify-between mb-2"><div class="flex items-center gap-1.5"><span class="text-red-400 font-bold text-sm">⚠️</span><span class="font-bold text-red-300 text-xs">Fake Account #${i+1}</span></div><span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-bold uppercase">${a.threatLevel}</span></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
<div class="relative rounded-xl overflow-hidden border-2 border-red-500/30 bg-dark-900">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full h-auto object-cover opacity-90" loading="lazy">` : '<div class="w-full h-40 flex items-center justify-center text-3xl text-red-500/30">FAKE</div>'}
<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1"><span class="bg-red-500/85 text-white px-3 py-1 rounded-lg text-xs font-extrabold tracking-wider">⚠️ FAKE ACCOUNT</span><span class="bg-red-500/85 text-white px-2 py-0.5 rounded-lg text-xs font-bold">DO NOT TRUST</span></div>
</div>
<div class="space-y-1.5">
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Platform</span><span class="text-red-300 font-semibold">${a.platform}</span></div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Username</span><span class="text-red-300 font-semibold">${a.username}</span></div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Status</span><span class="text-red-300 font-semibold">Active Threat</span></div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs"><span class="text-gray-400">Reports</span><span class="text-red-300 font-semibold">${a.reportedCount}+</span></div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300 border border-red-500/15">⚠️ ${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="${a.profileUrl}" target="_blank" rel="noopener" class="flex-1 text-center btn-red px-3 py-2 rounded-full text-white text-xs font-bold">Report Now</a>
<button class="flex-1 px-3 py-2 bg-dark-700 border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10 transition copy-btn" data-username="${a.username}">Copy Username</button>
</div>
<div class="glass-card p-2.5 mt-3 flex items-center gap-2 cursor-pointer hover:border-accent-purple/40 transition" onclick="toggleFakeVoice()">
<div class="w-7 h-7 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-white flex-shrink-0"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clip-rule="evenodd"/></svg></div>
<div><p class="text-xs font-medium text-white">🔊 Voice Verification Alert</p><p class="text-xs text-gray-400">Click to hear official warning message</p></div>
</div>
</div>
</div>
</div>`).join('')}
</div>
</div>

<div class="flex justify-center items-center gap-3 mt-3">
<button class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs hover:bg-red-500/20 transition" onclick="moveCarousel(-1)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
<div class="flex gap-1.5" id="carouselDots">${fakeAcc.map((_, i) => `<button class="w-2 h-2 rounded-full transition-all duration-300 ${i===0?'bg-red-500 w-6':'bg-dark-600'}" onclick="goSlide(${i})"></button>`).join('')}</div>
<button class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs hover:bg-red-500/20 transition" onclick="moveCarousel(1)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>
</div>
<audio id="fakeVoicePlayer" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center"><svg class="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg></div>
<h2 class="text-base font-bold text-white">🎵 Cover Music</h2><span class="text-xs text-gray-400 ml-auto">${coverSongs.length} songs</span>
</div>
<div class="glass-card overflow-hidden">
<div class="flex flex-col sm:flex-row gap-3 p-3 bg-gradient-to-r from-dark-800 to-dark-700">
<div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-dark-600 flex items-center justify-center mx-auto sm:mx-0 shadow-lg" id="npCover"><svg class="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg></div>
<div class="flex-1 flex flex-col justify-center text-center sm:text-left">
<div class="text-base font-bold text-white" id="npTitle">Select a song</div><div class="text-xs text-gray-400 mb-2" id="npArtist">Cover Songs</div>
<div class="mb-2"><div class="music-bar" id="progressBar" onclick="seekAudio(event)"><div class="music-fill" id="progressFill"></div></div><div class="flex justify-between text-xs text-gray-500 mt-1"><span id="curTime">0:00</span><span id="totTime">0:00</span></div></div>
<div class="flex items-center justify-center sm:justify-start gap-3 mb-2">
<button class="text-gray-400 hover:text-white transition p-1" onclick="prevSong()"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"/></svg></button>
<button class="w-9 h-9 rounded-full bg-white text-dark-900 flex items-center justify-center hover:scale-105 transition" id="ppBtn" onclick="togglePlay()"><svg id="ppIcon" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg></button>
<button class="text-gray-400 hover:text-white transition p-1" onclick="nextSong()"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 5.168A1 1 0 006 6v2.798l5.445-3.63A1 1 0 0113 6v8a1 1 0 01-1.555.832L6 11.202V14a1 1 0 01-1.555.832l-6-4a1 1 0 010-1.664l6-4z"/></svg></button>
</div>
<div class="flex items-center justify-center sm:justify-start gap-2"><svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clip-rule="evenodd"/></svg><input type="range" id="volSlider" min="0" max="100" value="70" onchange="setVol(this.value)" class="w-20 h-1 accent-green-500 cursor-pointer"></div>
</div>
</div>
<div class="max-h-64 overflow-y-auto"><div class="sticky top-0 bg-dark-800/95 backdrop-blur-sm px-3 py-2 border-b border-dark-600/50 text-xs font-bold text-white">Playlist</div>
${coverSongs.map((s, i) => `
<div class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-700/40 transition spotify-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl||''}" onclick="playSong(${i})">
<span class="text-xs text-gray-500 w-5 font-mono">${(i+1).toString().padStart(2,'0')}</span>
<div class="w-8 h-8 rounded-lg overflow-hidden bg-dark-600 flex-shrink-0 flex items-center justify-center">${s.coverUrl?`<img src="${s.coverUrl}" alt="" class="w-full h-full object-cover" loading="lazy">`:'<svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>'}</div>
<div class="flex-1 min-w-0"><div class="text-xs font-semibold text-white truncate">${s.title}</div><div class="text-xs text-gray-500">Cover Song</div></div>
<div class="spotify-eq hidden items-end gap-0.5 h-3"><span class="eq-bar" style="animation-delay:0s"></span><span class="eq-bar" style="animation-delay:.2s"></span><span class="eq-bar" style="animation-delay:.4s"></span><span class="eq-bar" style="animation-delay:.6s"></span></div>
</div>`).join('')}
</div>
</div>
</section>` : ''}

<section id="chat" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center"><svg class="w-3.5 h-3.5 text-accent-purple" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"/></svg></div>
<h2 class="text-base font-bold text-white">💬 Chat with Hammad Bin Amir</h2>
</div>

<div class="glass-card p-4">
<div id="chatRegisterForm" class="space-y-3">
<p class="text-sm text-gray-300 mb-3">Enter your details to start a conversation</p>
<input type="text" id="chatName" placeholder="Your Name *" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition" required>
<div class="relative">
<input type="text" id="chatPhoneEmail" placeholder="Phone Number or Email *" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition" required>
<p class="text-xs text-gray-500 mt-1">Enter phone number or email to identify your account</p>
</div>
<button onclick="registerChat()" class="w-full py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Start Chat</button>
</div>

<div id="chatInterface" class="hidden">
<div class="h-80 overflow-y-auto mb-3 space-y-2 pr-2" id="chatMessages">
<div class="text-center text-xs text-gray-500 py-4">Loading messages...</div>
</div>
<div class="flex gap-2">
<input type="text" id="chatInput" placeholder="Type your message..." class="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition" onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()" class="px-5 py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Send</button>
</div>
<div class="text-center mt-2">
<button onclick="logoutChat()" class="text-xs text-gray-500 hover:text-red-400 transition">Logout</button>
</div>
</div>
</div>
</section>

</div>
</main>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>
<audio id="audioPlayer" preload="none"></audio>

<script>
// Voice welcome
(function(){const wv=document.getElementById('welcomeVoice');if(!sessionStorage.getItem('wvPlayed')){setTimeout(()=>{wv.play().catch(()=>{});sessionStorage.setItem('wvPlayed','1')},2000)}})();

// Header hide/show on scroll
let ls=0,h=document.getElementById('mainHeader');
window.addEventListener('scroll',()=>{const s=window.scrollY;if(s>ls&&s>60){h.classList.add('header-hide');h.classList.remove('header-show')}else if(s<ls){h.classList.remove('header-hide');h.classList.add('header-show')}ls=s});

// Carousel
let cs=0,tsl=${totalFake},track=document.getElementById('fakeTrack'),dots=document.querySelectorAll('#carouselDots button'),auto;
function uc(){track.style.transform='translateX(-'+(cs*100)+'%)';dots.forEach((d,i)=>{if(i===cs){d.classList.add('bg-red-500','w-6');d.classList.remove('bg-dark-600')}else{d.classList.remove('bg-red-500','w-6');d.classList.add('bg-dark-600')}})}
function mc(d){cs=(cs+d+tsl)%tsl;uc();clearInterval(auto);auto=setInterval(()=>mc(1),6000)}
function gs(i){cs=i;uc();clearInterval(auto);auto=setInterval(()=>mc(1),6000)}
auto=setInterval(()=>mc(1),6000);
let tx=0;track.parentElement.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX});
track.parentElement.addEventListener('touchend',e=>{const d=tx-e.changedTouches[0].screenX;if(Math.abs(d)>40)mc(d>0?1:-1)});

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',function(){navigator.clipboard.writeText(this.dataset.username).then(()=>{const o=this.textContent;this.textContent='Copied!';this.classList.add('bg-green-500/20','text-green-400','border-green-500');setTimeout(()=>{this.textContent=o;this.classList.remove('bg-green-500/20','text-green-400','border-green-500')},2000)})}));

// Fake voice
function toggleFakeVoice(){const fv=document.getElementById('fakeVoicePlayer');if(fv.paused){fv.play().catch(()=>{})}else{fv.pause();fv.currentTime=0}}

// Music player
let cur=-1,pl=false,ap=document.getElementById('audioPlayer'),items=document.querySelectorAll('.spotify-item');
function loadSong(i){if(!items.length||i<0||i>=items.length)return;if(cur===i)return;cur=i;const it=items[i];ap.src=it.dataset.audio;ap.load();document.getElementById('npTitle').textContent=it.querySelector('.text-xs').textContent;document.getElementById('npArtist').textContent='Cover Songs';const cc=document.getElementById('npCover');if(it.dataset.cover){cc.innerHTML='<img src="'+it.dataset.cover+'" alt="" class="w-full h-full object-cover">'}else{cc.innerHTML='<svg class="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>'}items.forEach(el=>el.classList.remove('bg-green-500/8'));it.classList.add('bg-green-500/8');document.querySelectorAll('.spotify-eq').forEach(el=>el.classList.add('hidden'));const eq=it.querySelector('.spotify-eq');if(eq)eq.classList.remove('hidden');document.getElementById('progressFill').style.width='0%';document.getElementById('curTime').textContent='0:00';document.getElementById('totTime').textContent='0:00';ap.play().then(()=>{pl=true;upb()}).catch(()=>{pl=false;upb()})}
function playSong(i){if(i===cur)tp();else loadSong(i)}
function tp(){if(!ap.src&&items.length>0){loadSong(0);return}if(pl){ap.pause();pl=false}else{ap.play().then(()=>{pl=true}).catch(()=>{})}upb()}
function upb(){document.getElementById('ppIcon').innerHTML=pl?'<path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM13 3a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2z"/>':'<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>'}
function ns(){if(items.length)loadSong((cur+1)%items.length)}
function ps(){if(items.length)loadSong(cur<=0?items.length-1:cur-1)}
function setVol(v){ap.volume=v/100}
function seekAudio(e){const r=e.target.getBoundingClientRect();if(ap.duration)ap.currentTime=((e.clientX-r.left)/r.width)*ap.duration}
ap.addEventListener('timeupdate',()=>{if(ap.duration){document.getElementById('progressFill').style.width=(ap.currentTime/ap.duration)*100+'%';const m=Math.floor(ap.currentTime/60),s=Math.floor(ap.currentTime%60);document.getElementById('curTime').textContent=m+':'+s.toString().padStart(2,'0')}});
ap.addEventListener('loadedmetadata',()=>{const m=Math.floor(ap.duration/60),s=Math.floor(ap.duration%60);document.getElementById('totTime').textContent=m+':'+s.toString().padStart(2,'0')});
ap.addEventListener('ended',()=>{pl=false;upb();ns()});
ap.addEventListener('error',()=>{pl=false;upb()});
ap.volume=0.7;

// Chat system
let chatToken='',chatId='',chatPollInterval;

// Check if user was previously logged in
function checkPreviousSession() {
    const saved = localStorage.getItem('chatSession');
    if (saved) {
        try {
            const session = JSON.parse(saved);
            chatToken = session.token;
            chatId = session.chatId;
            document.getElementById('chatRegisterForm').classList.add('hidden');
            document.getElementById('chatInterface').classList.remove('hidden');
            loadChatMessages();
            chatPollInterval = setInterval(loadChatMessages, 3000);
        } catch(e) {
            localStorage.removeItem('chatSession');
        }
    }
}

async function registerChat() {
    const name = document.getElementById('chatName').value.trim();
    const phoneEmail = document.getElementById('chatPhoneEmail').value.trim();
    
    if (!name) return alert('Please enter your name');
    if (!phoneEmail) return alert('Please enter your phone number or email');
    
    try {
        const r = await fetch('/api/chat/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, phoneEmail})
        });
        const d = await r.json();
        
        if (d.success) {
            chatToken = d.sessionToken;
            chatId = d.chatId;
            
            // Save session
            localStorage.setItem('chatSession', JSON.stringify({
                token: chatToken,
                chatId: chatId
            }));
            
            document.getElementById('chatRegisterForm').classList.add('hidden');
            document.getElementById('chatInterface').classList.remove('hidden');
            loadChatMessages();
            chatPollInterval = setInterval(loadChatMessages, 3000);
        } else {
            alert(d.error || 'Registration failed');
        }
    } catch(err) {
        alert('Connection error. Please try again.');
    }
}

async function loadChatMessages() {
    try {
        const r = await fetch('/api/chat/messages?token=' + chatToken);
        const d = await r.json();
        
        if (d.success) {
            const mc = document.getElementById('chatMessages');
            mc.innerHTML = d.messages.map(m => 
                '<div class="flex ' + (m.sender === 'user' ? 'justify-end' : 'justify-start') + '">' +
                '<div class="max-w-[80%] px-4 py-2.5 text-sm ' + (m.sender === 'user' ? 'chat-msg-user text-white' : 'chat-msg-admin text-gray-200') + '">' +
                m.message +
                '<div class="text-xs text-gray-500 mt-1">' + new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + '</div>' +
                '</div></div>'
            ).join('');
            mc.scrollTop = mc.scrollHeight;
        } else {
            // Session expired
            clearInterval(chatPollInterval);
            logoutChat();
        }
    } catch(err) {}
}

async function sendMessage() {
    const msg = document.getElementById('chatInput').value.trim();
    if (!msg) return;
    
    try {
        const r = await fetch('/api/chat/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: chatToken, message: msg})
        });
        const d = await r.json();
        
        if (d.success) {
            document.getElementById('chatInput').value = '';
            loadChatMessages();
        }
    } catch(err) {}
}

function logoutChat() {
    clearInterval(chatPollInterval);
    localStorage.removeItem('chatSession');
    chatToken = '';
    chatId = '';
    document.getElementById('chatRegisterForm').classList.remove('hidden');
    document.getElementById('chatInterface').classList.add('hidden');
    document.getElementById('chatMessages').innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Loading messages...</div>';
    document.getElementById('chatInput').value = '';
}

// Check for previous session on load
checkPreviousSession();
</script>
</body>
</html>`;
}

// Admin panel HTML functions remain the same
function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899'}}}}}</script></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 flex items-center justify-center min-h-screen font-sans"><div class="glass-card p-8 w-full max-w-md"><div class="text-center mb-6"><div class="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center"><svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg></div><h2 class="text-xl font-bold text-white">Admin Login</h2></div>${error?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm text-center">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="mb-4"><label class="block text-gray-400 text-sm font-semibold mb-1.5">Username</label><input type="text" name="username" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition" required></div><div class="mb-5"><label class="block text-gray-400 text-sm font-semibold mb-1.5">Password</label><input type="password" name="password" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition" required></div><button type="submit" class="w-full py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Sign In</button></form><div class="text-center mt-5"><a href="/" class="text-sm text-gray-500 hover:text-white transition">Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="glass-card overflow-hidden hover-lift"><img src="${p.path}" class="w-full h-40 object-cover"><div class="p-3">${p.caption?`<p class="text-sm text-gray-300">${p.caption}</p>`:''}<p class="text-xs text-gray-500 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="w-full py-2 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}}}}}</script><style>.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}.hover-lift{transition:all 0.3s}.hover-lift:hover{transform:translateY(-2px)}</style></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen"><header class="glass border-b border-white/5 sticky top-0 z-50"><div class="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center"><h2 class="text-lg font-bold gradient-text">Admin Panel</h2><div class="flex gap-2"><a href="/" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-white/20 transition">Site</a><a href="/admin/logout" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-red-500/50 transition">Logout</a></div></div></header><div class="max-w-6xl mx-auto px-4 py-6">${msg?`<div class="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl mb-5 text-sm">${msg}</div>`:''}${err?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm">${err}</div>`:''}<div class="glass-card p-6 mb-6"><h3 class="text-lg font-bold text-white mb-4">Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="mb-4"><label class="block text-gray-400 text-sm font-semibold mb-1.5">Photo</label><input type="file" name="photo" accept="image/*" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-accent-purple file:text-white file:font-semibold file:text-sm file:cursor-pointer focus:outline-none transition" required></div><div class="mb-5"><label class="block text-gray-400 text-sm font-semibold mb-1.5">Caption</label><input type="text" name="caption" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition"></div><button type="submit" class="px-6 py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Upload</button></form></div><h3 class="text-lg font-bold text-white mb-4">Gallery (${photos.length})</h3>${photos.length?`<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">${phtml}</div>`:'<p class="text-gray-500 text-center py-12">No photos yet</p>'}</div></body></html>`;
}

// Admin chat panel HTML
function getAdminChatHTML(chatList = [], currentChatId = null, messages = []) {
    const userList = chatList.map(c => `
        <div class="p-3 hover:bg-dark-700/40 cursor-pointer transition ${currentChatId === c.chatId ? 'bg-accent-purple/20 border-l-2 border-accent-purple' : ''}" 
             onclick="window.location.href='/admin/chat?chatId=${c.chatId}'">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm font-semibold text-white">${c.name}</div>
                    <div class="text-xs text-gray-400">${c.phoneEmail}</div>
                </div>
                ${c.unread > 0 ? `<span class="px-2 py-1 bg-red-500 text-white text-xs rounded-full">${c.unread}</span>` : ''}
            </div>
            <div class="text-xs text-gray-500 mt-1">Last active: ${new Date(c.lastSeen).toLocaleString()}</div>
            ${c.lastMessage ? `<div class="text-xs text-gray-400 mt-1 truncate">${c.lastMessage.message}</div>` : ''}
        </div>
    `).join('');

    const messageList = messages.map(m => `
        <div class="flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                m.sender === 'user' 
                    ? 'bg-accent-purple/20 text-white rounded-br-sm' 
                    : 'bg-dark-700/60 text-gray-200 rounded-bl-sm'
            }">
                ${m.message}
                <div class="text-xs text-gray-500 mt-1">
                    ${new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    ${m.sender === 'user' && m.read ? ' ✓✓' : ''}
                </div>
            </div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Admin Chat Panel</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}}}}}
</script>
<style>
.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
</style>
</head>
<body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen">
<header class="glass border-b border-white/5 sticky top-0 z-50">
<div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
<h2 class="text-lg font-bold gradient-text">Chat Panel</h2>
<div class="flex gap-2">
<a href="/admin" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-white/20 transition">Dashboard</a>
<a href="/admin/logout" class="px-3 py-1.5 glass rounded-lg text-xs hover:border-red-500/50 transition">Logout</a>
</div>
</div>
</header>

<div class="max-w-7xl mx-auto flex h-[calc(100vh-64px)]">
<!-- User List -->
<div class="w-80 glass border-r border-white/5 overflow-y-auto">
<div class="p-3 border-b border-white/5">
<h3 class="text-sm font-bold text-white">Conversations</h3>
</div>
<div id="userList">
${userList || '<div class="text-center text-gray-500 py-8">No conversations yet</div>'}
</div>
</div>

<!-- Chat Area -->
<div class="flex-1 flex flex-col">
${currentChatId ? `
<div class="flex-1 overflow-y-auto p-4 space-y-3" id="chatMessages">
${messageList || '<div class="text-center text-gray-500 py-8">Select a conversation</div>'}
</div>
<div class="p-4 glass border-t border-white/5">
<div class="flex gap-2">
<input type="text" id="adminMessage" placeholder="Type your reply..." 
       class="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition"
       onkeypress="if(event.key==='Enter')sendAdminMessage()">
<button onclick="sendAdminMessage()" 
        class="px-5 py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">
Send
</button>
</div>
</div>
` : `
<div class="flex-1 flex items-center justify-center">
<div class="text-center text-gray-500">
<svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
<path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"/>
</svg>
<p>Select a conversation to start chatting</p>
</div>
</div>
`}
</div>
</div>

${currentChatId ? `
<script>
let refreshInterval = setInterval(refreshMessages, 2000);

async function refreshMessages() {
    try {
        const r = await fetch('/api/admin/messages?chatId=${currentChatId}');
        const d = await r.json();
        if (d.success) {
            const mc = document.getElementById('chatMessages');
            mc.innerHTML = d.messages.map(m => 
                '<div class="flex ' + (m.sender === 'user' ? 'justify-end' : 'justify-start') + '">' +
                '<div class="max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ' + 
                (m.sender === 'user' ? 'bg-accent-purple/20 text-white rounded-br-sm' : 'bg-dark-700/60 text-gray-200 rounded-bl-sm') + '">' +
                m.message +
                '<div class="text-xs text-gray-500 mt-1">' + 
                new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) +
                (m.sender === 'user' && m.read ? ' ✓✓' : '') +
                '</div></div></div>'
            ).join('');
            mc.scrollTop = mc.scrollHeight;
        }
    } catch(err) {}
}

async function sendAdminMessage() {
    const msg = document.getElementById('adminMessage').value.trim();
    if (!msg) return;
    
    try {
        const r = await fetch('/api/admin/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({chatId: '${currentChatId}', message: msg})
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('adminMessage').value = '';
            refreshMessages();
        }
    } catch(err) {}
}
</script>
` : ''}
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

    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const decodedPathname = decodeURIComponent(pathname);
        const assetPath = path.join(__dir, decodedPathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = {
                '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
                '.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml',
                '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg',
                '.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac'
            };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, { 'Content-Type':ct, 'Content-Length':stat.size, 'Cache-Control':'public, max-age=86400' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    // Chat API endpoints
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = ''; 
        req.on('data', c => body += c); 
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                if (!name || !phoneEmail) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'Name and phone/email are required'}));
                    return;
                }
                
                const user = await createOrGetChatUser(name, phoneEmail);
                const sessionToken = await createChatSession(user.chatId);
                
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    success: true,
                    chatId: user.chatId,
                    sessionToken,
                    name: user.name
                }));
            } catch(e) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, error: e.message}));
            }
        });
        return;
    }

    if (pathname === '/api/chat/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        if (!token) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'No session token'}));
            return;
        }
        
        const user = await getChatUserByToken(token);
        if (!user) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'Invalid or expired session'}));
            return;
        }
        
        const messages = await getChatMessages(user.chatId);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, messages, chatId: user.chatId}));
        return;
    }

    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = ''; 
        req.on('data', c => body += c); 
        req.on('end', async () => {
            try {
                const { token, message } = JSON.parse(body);
                if (!token || !message) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'Token and message required'}));
                    return;
                }
                
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'Invalid session'}));
                    return;
                }
                
                const msg = await saveChatMessage(user.chatId, 'user', message);
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: true, message: msg}));
            } catch(e) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, error: e.message}));
            }
        });
        return;
    }

    // Admin chat endpoints
    if (pathname === '/admin/chat' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(302, {'Location': '/admin'});
            res.end();
            return;
        }
        
        const chatId = parsedUrl.query.chatId;
        let messages = [];
        const chatList = await getAdminChatList();
        
        if (chatId) {
            messages = await getChatMessages(chatId);
            await markMessagesRead(chatId);
        }
        
        res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
        res.end(getAdminChatHTML(chatList, chatId, messages));
        return;
    }

    if (pathname === '/api/admin/messages' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'Unauthorized'}));
            return;
        }
        
        const chatId = parsedUrl.query.chatId;
        if (!chatId) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'ChatId required'}));
            return;
        }
        
        const messages = await getChatMessages(chatId);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, messages}));
        return;
    }

    if (pathname === '/api/admin/send' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'Unauthorized'}));
            return;
        }
        
        let body = ''; 
        req.on('data', c => body += c); 
        req.on('end', async () => {
            try {
                const { chatId, message } = JSON.parse(body);
                if (!chatId || !message) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'ChatId and message required'}));
                    return;
                }
                
                const msg = await saveChatMessage(chatId, 'admin', message);
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: true, message: msg}));
            } catch(e) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, error: e.message}));
            }
        });
        return;
    }

    // Existing admin routes
    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) {
            const p = await getGalleryPhotos();
            res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
            res.end(getAdminPanelHTML(p));
            return;
        }
        res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
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
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`
                });
                res.end();
            } else {
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminLoginHTML('Invalid credentials'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0'
        });
        res.end();
        return;
    }

    if (pathname === '/admin/upload' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, {'Location': '/admin'});
            res.end();
            return;
        }
        const form = new formidable.IncomingForm({
            uploadDir: GALLERY_DIR,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024
        });
        form.parse(req, async (err, fields, files) => {
            if (err) {
                const p = await getGalleryPhotos();
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminPanelHTML(p, '', 'Upload error'));
                return;
            }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf || !pf.originalFilename) {
                const p = await getGalleryPhotos();
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminPanelHTML(p, '', 'No file'));
                return;
            }
            if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(pf.originalFilename).toLowerCase())) {
                const p = await getGalleryPhotos();
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminPanelHTML(p, '', 'Invalid format'));
                return;
            }
            const fn = Date.now() + '_' + pf.originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
            try {
                fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                await savePhoto({
                    path: '/assets/gallery/' + fn,
                    caption: fields.caption ? (Array.isArray(fields.caption) ? fields.caption[0] : fields.caption) : ''
                });
                const p = await getGalleryPhotos();
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminPanelHTML(p, 'Uploaded'));
            } catch (e) {
                const p = await getGalleryPhotos();
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminPanelHTML(p, '', 'Save error'));
            }
        });
        return;
    }

    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, {'Location': '/admin'});
            res.end();
            return;
        }
        let body = ''; 
        req.on('data', c => body += c); 
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            try {
                const photo = await db.collection('gallery_photos').findOne({_id: new ObjectId(params.get('photoId'))});
                if (photo) {
                    const fp = path.join(__dir, photo.path);
                    if (fs.existsSync(fp)) fs.unlinkSync(fp);
                }
                await deletePhoto(params.get('photoId'));
            } catch (e) {}
            const p = await getGalleryPhotos();
            res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
            res.end(getAdminPanelHTML(p, 'Deleted'));
        });
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(getMainHTML(photos));
        return;
    }

    res.writeHead(404, {'Content-Type': 'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-dark-950 flex items-center justify-center h-screen text-white font-sans"><div class="text-center"><h1 class="text-8xl font-bold text-accent-purple">404</h1><p class="text-gray-400">Page not found</p><a href="/" class="inline-block mt-4 px-5 py-2 bg-accent-purple text-white rounded-lg">Home</a></div></body></html>`);
});

async function start() {
    await connectDB();
    server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

start();
server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });

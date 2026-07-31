const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
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

// Database Connection
async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        const collections = ['chat_users', 'chat_messages', 'chat_sessions', 'gallery_photos'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        await db.collection('chat_users').createIndex({ phone: 1 }, { sparse: true });
        await db.collection('chat_users').createIndex({ email: 1 }, { sparse: true });
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_sessions').createIndex({ token: 1 }, { unique: true });
        
        console.log('MongoDB Connected');
        return true;
    } catch (e) {
        console.error('MongoDB Error:', e);
        return false;
    }
}

// Chat Functions
async function findOrCreateUser(name, contact) {
    const query = contact.includes('@') ? { email: contact } : { phone: contact };
    let user = await db.collection('chat_users').findOne(query);
    
    if (user) {
        await db.collection('chat_users').updateOne(
            { _id: user._id },
            { $set: { name, lastSeen: new Date() } }
        );
        return user;
    }
    
    const chatId = 'CHAT-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    user = {
        chatId,
        name,
        phone: contact.includes('@') ? '' : contact,
        email: contact.includes('@') ? contact : '',
        createdAt: new Date(),
        lastSeen: new Date(),
        status: 'active'
    };
    
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').insertOne({
        token,
        chatId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return token;
}

async function getUserByToken(token) {
    const session = await db.collection('chat_sessions').findOne({
        token,
        expiresAt: { $gt: new Date() }
    });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getMessages(chatId, limit = 100) {
    return await db.collection('chat_messages')
        .find({ chatId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
}

async function saveMessage(chatId, sender, message) {
    const msg = {
        chatId,
        sender,
        message,
        createdAt: new Date(),
        read: false
    };
    await db.collection('chat_messages').insertOne(msg);
    return msg;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
}

async function getAllUsers() {
    return await db.collection('chat_users')
        .find({ status: 'active' })
        .sort({ lastSeen: -1 })
        .toArray();
}

async function getLastMessage(chatId) {
    return await db.collection('chat_messages')
        .findOne({ chatId }, { sort: { createdAt: -1 } });
}

async function getUnreadCount(chatId) {
    return await db.collection('chat_messages')
        .countDocuments({ chatId, sender: 'user', read: false });
}

// Cover Songs
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

// Website Data
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
            reason: "Copies official content and logo to deceive followers.",
            threatLevel: "Critical",
            reportedCount: 156
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            reason: "Uses official name and photo to mislead followers.",
            threatLevel: "High",
            reportedCount: 89
        }
    ]
};

function parseCookies(header) {
    const cookies = {};
    if (header) {
        header.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
        });
    }
    return cookies;
}

// Main Website HTML with WhatsApp Chat
function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#075e54">
<title>Baiilla Maach Official | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={darkMode:'class',theme:{extend:{colors:{wa:{header:'#075e54',bg:'#0b141a',out:'#005c4b',in:'#202c33',input:'#2a3942'},dark:{950:'#09090b',900:'#101014',800:'#18181c'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}},fontFamily:{sans:['Inter','sans-serif']},animation:{'fade-in':'fadeIn 0.5s ease-out','slide-up':'slideUp 0.4s ease-out','typing-dot':'typingDot 1.4s infinite'},keyframes:{fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},slideUp:{'0%':{transform:'translateY(16px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}},typingDot:{'0%,60%,100%':{transform:'translateY(0)'},'30%':{transform:'translateY(-10px)'}}}}}}
</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#111b21;color:#e9edef;min-height:100vh}
.glass{background:rgba(32,44,51,0.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06)}
.glass-card{background:rgba(32,44,51,0.9);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.08);border-radius:16px}
.gradient-text{background:linear-gradient(135deg,#25d366,#128c7e);-webkit-background-clip:text;background-clip:text;color:transparent}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.3)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.3)}

/* WhatsApp Chat Widget */
.whatsapp-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.whatsapp-btn{width:60px;height:60px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 15px rgba(37,211,102,0.4);transition:all 0.3s}
.whatsapp-btn:hover{transform:scale(1.1)}
.whatsapp-btn svg{width:32px;height:32px;fill:white}
.chat-window{position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 120px);background:#0b141a;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;flex-direction:column}
.chat-window.open{display:flex;animation:fadeIn 0.3s ease-out}
.chat-header{background:#075e54;padding:15px;display:flex;align-items:center;gap:12px}
.chat-header .avatar{width:42px;height:42px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;font-size:18px}
.chat-messages{flex:1;overflow-y:auto;padding:15px;background-color:#0b141a;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.msg-bubble{max-width:80%;padding:8px 12px;margin-bottom:8px;border-radius:8px;font-size:14px;line-height:1.4;position:relative;word-wrap:break-word}
.msg-out{background:#005c4b;color:#e9edef;float:right;clear:both;border-radius:8px 0 8px 8px}
.msg-in{background:#202c33;color:#e9edef;float:left;clear:both;border-radius:0 8px 8px 8px}
.msg-time{font-size:11px;color:rgba(255,255,255,0.5);text-align:right;margin-top:4px}
.chat-input-area{background:#202c33;padding:10px 15px;display:flex;align-items:center;gap:10px}
.chat-input-area input{flex:1;background:#2a3942;border:none;padding:10px 15px;border-radius:25px;color:white;font-size:14px;outline:none}
.chat-input-area input::placeholder{color:#8696a0}
.chat-input-area button{background:#25d366;border:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s}
.chat-input-area button:hover{background:#1da851}
.typing-indicator{display:flex;gap:4px;padding:8px 12px;background:#202c33;border-radius:8px;float:left;clear:both;margin-bottom:8px}
.typing-indicator span{width:8px;height:8px;border-radius:50%;background:#8696a0;animation:typingDot 1.4s infinite}
.typing-indicator span:nth-child(2){animation-delay:0.2s}
.typing-indicator span:nth-child(3){animation-delay:0.4s}
@keyframes typingDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
.chat-login{padding:30px 20px;text-align:center}
.chat-login input{width:100%;background:#2a3942;border:2px solid #25d366;padding:12px 15px;border-radius:8px;color:white;font-size:14px;margin-bottom:10px;outline:none}
.chat-login button{width:100%;background:#25d366;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:all 0.2s}
.chat-login button:hover{background:#1da851}
.notification-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;width:22px;height:22px;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:bold}

.header-hide{transform:translateY(-100%)}.header-show{transform:translateY(0)}
#mainHeader{transition:transform 0.3s ease}
</style>
</head>
<body class="min-h-screen">

<!-- Main Header -->
<header id="mainHeader" class="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5 header-show">
<div class="max-w-5xl mx-auto px-3">
<div class="flex items-center justify-between h-12">
<div class="flex items-center gap-2">
<img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 rounded-full border-2 border-green-500 object-cover" onerror="this.style.display='none'">
<span class="text-sm font-bold gradient-text">Verification Hub</span>
</div>
<nav class="flex items-center gap-1">
<a href="#official" class="px-2 py-1 text-xs text-gray-400 hover:text-white rounded transition">Official</a>
<a href="#fake" class="px-2 py-1 text-xs text-gray-400 hover:text-red-400 rounded transition">Fakes</a>
${coverSongs.length > 0 ? '<a href="#music" class="px-2 py-1 text-xs text-gray-400 hover:text-green-400 rounded transition">Music</a>' : ''}
</nav>
</div>
</div>
</header>

<main class="pt-14 pb-24">
<div class="max-w-5xl mx-auto px-3">

<!-- Profile Section -->
<section class="text-center py-6 animate-fade-in">
<div class="relative inline-block mb-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-green-500 object-cover mx-auto verified-glow" onerror="this.style.display='none'">
<div class="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-[#111b21] flex items-center justify-center">
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
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/25 rounded-full text-xs font-semibold">Verified Official</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-full text-xs font-semibold">Creator</span>
</div>
<div class="flex justify-center gap-2">
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50 transition">TikTok</a>
<a href="${realAcc[1].url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50 transition">Facebook</a>
</div>
</section>

<!-- Official Account -->
<section id="official" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
<svg class="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">Official Verified Account</h2>
</div>
<div class="glass-card p-4">
<div class="absolute top-3 right-3 z-10">
<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-xs font-bold">VERIFIED</span>
</div>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${realAcc.map(acc => `
<div class="bg-[#202c33] rounded-xl p-3">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase text-gray-400">${acc.platform}</span><span class="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">Verified</span></div>
<div class="flex items-center gap-2 mb-2">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover" onerror="this.style.display='none'">` : `<div class="w-12 h-12 rounded-lg bg-[#2a3942] flex items-center justify-center text-lg font-bold">${acc.platform==='TikTok'?'T':'F'}</div>`}
<div><div class="font-bold text-white text-sm">${acc.username}</div><div class="text-xs text-gray-400">${acc.platform}${acc.followers?' • '+acc.followers+' followers':''}</div></div>
</div>
</div>`).join('')}
</div>
<div class="bg-[#202c33] rounded-xl p-4 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-green-500 mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="bg-green-500 px-5 py-2.5 rounded-full text-white font-bold text-xs hover:bg-green-600 transition">Follow Official Account</a>
<p class="text-xs text-gray-500 mt-3">This is the only authentic account</p>
</div>
</div>
</div>
</section>

<!-- Fake Accounts -->
<section id="fake" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center danger-glow">
<svg class="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">Fake Accounts Detected</h2>
<span class="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full font-bold">${totalFake} Active</span>
</div>

<div class="space-y-3">
${fakeAcc.map((a, i) => `
<div class="glass-card p-3 border-red-500/20">
<div class="watermark-fake">FAKE</div>
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-1.5"><span class="text-red-400 font-bold">⚠</span><span class="font-bold text-red-300 text-xs">Fake Account #${i+1}</span></div>
<span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-bold">${a.threatLevel}</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
<div class="relative rounded-xl overflow-hidden border-2 border-red-500/30">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full h-auto opacity-90">` : '<div class="w-full h-40 flex items-center justify-center text-3xl text-red-500/30">FAKE</div>'}
<div class="absolute inset-0 flex flex-col items-center justify-center gap-1"><span class="bg-red-500/85 text-white px-3 py-1 rounded-lg text-xs font-extrabold">FAKE ACCOUNT</span></div>
</div>
<div class="space-y-1.5 text-sm">
<div class="flex justify-between bg-[#202c33] rounded-lg px-3 py-1.5"><span class="text-gray-400">Platform</span><span class="text-red-300">${a.platform}</span></div>
<div class="flex justify-between bg-[#202c33] rounded-lg px-3 py-1.5"><span class="text-gray-400">Username</span><span class="text-red-300">${a.username}</span></div>
<div class="flex justify-between bg-[#202c33] rounded-lg px-3 py-1.5"><span class="text-gray-400">Reports</span><span class="text-red-300">${a.reportedCount}+</span></div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300">${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="${a.profileUrl}" target="_blank" rel="noopener" class="flex-1 text-center bg-red-500 px-3 py-2 rounded-full text-white text-xs font-bold hover:bg-red-600 transition">Report Account</a>
<button class="flex-1 px-3 py-2 bg-[#202c33] border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10 transition" onclick="copyText('${a.username}')">Copy Username</button>
</div>
</div>`).join('')}
</div>
<audio id="fakeVoicePlayer" src="${VOICE.fakeAlert}" preload="none"></audio>
<div class="flex justify-center mt-3">
<button onclick="document.getElementById('fakeVoicePlayer').play()" class="glass px-4 py-2 rounded-full text-xs text-red-300 hover:bg-red-500/10 transition">🔊 Listen to Alert</button>
</div>
</section>

${coverSongs.length > 0 ? `
<!-- Music Section -->
<section id="music" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
<svg class="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>
</div>
<h2 class="text-base font-bold text-white">Cover Music</h2>
<span class="text-xs text-gray-400">${coverSongs.length} songs</span>
</div>
<div class="glass-card overflow-hidden">
<div class="p-3">
<div class="flex items-center gap-3 mb-3">
<div class="w-16 h-16 rounded-xl bg-[#202c33] flex items-center justify-center flex-shrink-0" id="npCover">
<svg class="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>
</div>
<div class="flex-1">
<div class="text-sm font-bold text-white" id="npTitle">Select a song</div>
<div class="text-xs text-gray-400" id="npArtist">Cover Songs</div>
<div class="flex items-center gap-2 mt-2">
<button onclick="prevSong()" class="text-gray-400 hover:text-white">⏮</button>
<button onclick="togglePlay()" class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white" id="playBtn">▶</button>
<button onclick="nextSong()" class="text-gray-400 hover:text-white">⏭</button>
<input type="range" id="volSlider" min="0" max="100" value="70" onchange="setVolume(this.value)" class="w-20 accent-green-500">
</div>
</div>
</div>
</div>
<div class="max-h-48 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#202c33] transition" onclick="playSong(${i})">
<span class="text-xs text-gray-500 w-5">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1 min-w-0"><div class="text-xs text-white truncate">${s.title}</div><div class="text-xs text-gray-500">Cover Song</div></div>
</div>`).join('')}
</div>
</div>
<audio id="audioPlayer" preload="none"></audio>
</section>` : ''}

</div>
</main>

<!-- WhatsApp Chat Widget -->
<div class="whatsapp-widget">
<div class="whatsapp-btn" onclick="toggleChat()" id="chatBtn">
<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
</div>

<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="avatar">H</div>
<div>
<div class="text-white font-semibold">Hammad Bin Amir</div>
<div class="text-green-200 text-xs" id="statusText">Online</div>
</div>
<button onclick="toggleChat()" class="ml-auto text-white/70 hover:text-white">
<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
</button>
</div>

<div id="chatLoginForm" class="chat-login">
<p class="text-gray-300 text-sm mb-4">Enter your details to start chatting</p>
<input type="text" id="userName" placeholder="Your Name" class="mb-2">
<input type="text" id="userContact" placeholder="Phone Number or Email">
<button onclick="registerChat()" class="mt-3">Start Chat</button>
<p class="text-xs text-gray-500 mt-2">Use same phone/email to find old chats</p>
</div>

<div id="chatInterface" class="flex-1 flex flex-col" style="display:none">
<div class="chat-messages" id="chatMessages">
<div class="text-center text-xs text-gray-500 py-2">🔒 Messages are secure</div>
</div>
<div id="typingIndicator" class="hidden" style="padding:0 15px">
<div class="typing-indicator">
<span></span><span></span><span></span>
</div>
</div>
<div class="chat-input-area">
<input type="text" id="messageInput" placeholder="Type a message" onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()">
<svg width="20" height="20" fill="white" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<script>
// Header scroll behavior
let lastScroll = 0;
const header = document.getElementById('mainHeader');
window.addEventListener('scroll', () => {
const scroll = window.scrollY;
if (scroll > lastScroll && scroll > 60) header.classList.add('header-hide');
else header.classList.remove('header-hide');
lastScroll = scroll;
});

// Copy text function
function copyText(text) {
navigator.clipboard.writeText(text).then(() => {
alert('Copied: ' + text);
});
}

// Music Player
let currentSong = -1;
let isPlaying = false;
const audioPlayer = document.getElementById('audioPlayer');
const songs = [${coverSongs.map(s => JSON.stringify(s)).join(',')}];

function loadSong(index) {
if (index < 0 || index >= songs.length) return;
currentSong = index;
audioPlayer.src = songs[index].audioUrl;
document.getElementById('npTitle').textContent = songs[index].title;
document.getElementById('npArtist').textContent = songs[index].artist;
audioPlayer.play().then(() => {
isPlaying = true;
updatePlayBtn();
}).catch(() => {});
}

function togglePlay() {
if (currentSong === -1 && songs.length > 0) { loadSong(0); return; }
if (isPlaying) { audioPlayer.pause(); isPlaying = false; }
else { audioPlayer.play(); isPlaying = true; }
updatePlayBtn();
}

function updatePlayBtn() {
document.getElementById('playBtn').textContent = isPlaying ? '⏸' : '▶';
}

function nextSong() { if (songs.length > 0) loadSong((currentSong + 1) % songs.length); }
function prevSong() { if (songs.length > 0) loadSong(currentSong <= 0 ? songs.length - 1 : currentSong - 1); }
function setVolume(v) { audioPlayer.volume = v / 100; }

audioPlayer.addEventListener('ended', () => { nextSong(); });
audioPlayer.volume = 0.7;

// Welcome voice
setTimeout(() => {
const wv = document.getElementById('welcomeVoice');
if (wv && !sessionStorage.getItem('wvPlayed')) {
wv.play().catch(() => {});
sessionStorage.setItem('wvPlayed', '1');
}
}, 2000);

// WhatsApp Chat Widget
let ws = null;
let chatToken = localStorage.getItem('chatToken');
let chatId = null;

function toggleChat() {
const window = document.getElementById('chatWindow');
window.classList.toggle('open');
if (window.classList.contains('open') && !ws) {
connectWebSocket();
}
}

function connectWebSocket() {
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = protocol + '//' + window.location.host + '/ws';

ws = new WebSocket(wsUrl);

ws.onopen = () => {
console.log('Chat connected');
document.getElementById('statusText').textContent = 'Online';

if (chatToken) {
ws.send(JSON.stringify({ type: 'auth', token: chatToken }));
}
};

ws.onmessage = (event) => {
const data = JSON.parse(event.data);

if (data.type === 'auth_success') {
showChatInterface();
loadMessages();
} else if (data.type === 'message') {
addMessage(data.message, data.sender, data.timestamp);
} else if (data.type === 'typing') {
document.getElementById('typingIndicator').className = data.isTyping ? '' : 'hidden';
document.getElementById('statusText').textContent = data.isTyping ? 'typing...' : 'Online';
scrollChat();
}
};

ws.onclose = () => {
document.getElementById('statusText').textContent = 'Offline';
setTimeout(connectWebSocket, 3000);
};
}

async function registerChat() {
const name = document.getElementById('userName').value.trim();
const contact = document.getElementById('userContact').value.trim();

if (!name || !contact) {
alert('Please fill all fields');
return;
}

try {
const response = await fetch('/api/chat/register', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ name, contact })
});

const data = await response.json();

if (data.success) {
chatToken = data.sessionToken;
chatId = data.chatId;
localStorage.setItem('chatToken', chatToken);

showChatInterface();

if (ws && ws.readyState === WebSocket.OPEN) {
ws.send(JSON.stringify({ type: 'auth', token: chatToken }));
} else {
connectWebSocket();
}
} else {
alert(data.error || 'Registration failed');
}
} catch (e) {
alert('Connection error. Please try again.');
}
}

function showChatInterface() {
document.getElementById('chatLoginForm').style.display = 'none';
document.getElementById('chatInterface').style.display = 'flex';
}

function sendMessage() {
const input = document.getElementById('messageInput');
const message = input.value.trim();

if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;

ws.send(JSON.stringify({
type: 'message',
token: chatToken,
message: message
}));

input.value = '';
}

function addMessage(text, sender, timestamp) {
const container = document.getElementById('chatMessages');
const msgDiv = document.createElement('div');

const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const align = sender === 'user' ? 'flex justify-end' : 'flex justify-start';
const bubble = sender === 'user' ? 'msg-out' : 'msg-in';

msgDiv.innerHTML = `
<div class="${align} mb-2">
<div class="${bubble}">
<div>${text}</div>
<div class="msg-time">${time} ${sender === 'user' ? '✓✓' : ''}</div>
</div>
</div>
`;

container.appendChild(msgDiv);
scrollChat();
}

async function loadMessages() {
if (!chatToken) return;

try {
const response = await fetch('/api/chat/messages?token=' + chatToken);
const data = await response.json();

if (data.success) {
document.getElementById('chatMessages').innerHTML = '<div class="text-center text-xs text-gray-500 py-2">🔒 Messages are secure</div>';
data.messages.forEach(msg => {
addMessage(msg.message, msg.sender, msg.createdAt);
});
}
} catch (e) {
console.error('Error loading messages:', e);
}
}

function scrollChat() {
const container = document.getElementById('chatMessages');
if (container) {
setTimeout(() => {
container.scrollTop = container.scrollHeight;
}, 100);
}
}

// Typing indicator
let typingTimeout;
document.addEventListener('DOMContentLoaded', () => {
const input = document.getElementById('messageInput');
if (input) {
input.addEventListener('input', () => {
if (ws && ws.readyState === WebSocket.OPEN) {
ws.send(JSON.stringify({ type: 'typing', isTyping: true, token: chatToken }));
clearTimeout(typingTimeout);
typingTimeout = setTimeout(() => {
ws.send(JSON.stringify({ type: 'typing', isTyping: false, token: chatToken }));
}, 2000);
}
});
}
});

// Auto-connect if token exists
if (chatToken) {
setTimeout(connectWebSocket, 1000);
}
</script>
</body>
</html>`;
}

// WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
const userConnections = new Map();
const adminConnections = new Set();

wss.on('connection', (ws, req) => {
const pathname = url.parse(req.url).pathname;

if (pathname === '/ws') {
let userData = null;

ws.on('message', async (message) => {
try {
const data = JSON.parse(message);

if (data.type === 'auth') {
const user = await getUserByToken(data.token);
if (user) {
userData = user;
userConnections.set(user.chatId, ws);
ws.send(JSON.stringify({ type: 'auth_success' }));

// Send welcome message after delay
setTimeout(async () => {
const reply = 'Hello! How can I help you today?';
await saveMessage(user.chatId, 'admin', reply);

ws.send(JSON.stringify({
type: 'message',
message: reply,
sender: 'admin',
timestamp: new Date().toISOString()
}));

notifyAdmin({
type: 'new_message',
chatId: user.chatId,
name: user.name,
message: reply,
sender: 'admin'
});
}, 2000);
}
} else if (data.type === 'message' && userData) {
await saveMessage(userData.chatId, 'user', data.message);

ws.send(JSON.stringify({
type: 'message',
message: data.message,
sender: 'user',
timestamp: new Date().toISOString()
}));

notifyAdmin({
type: 'new_message',
chatId: userData.chatId,
name: userData.name,
message: data.message,
sender: 'user'
});
} else if (data.type === 'typing' && userData) {
notifyAdmin({
type: 'user_typing',
chatId: userData.chatId,
isTyping: data.isTyping
});
}
} catch (e) {
console.error('WS Error:', e);
}
});

ws.on('close', () => {
if (userData) userConnections.delete(userData.chatId);
});
} else if (pathname === '/admin/ws') {
adminConnections.add(ws);

ws.on('message', async (message) => {
try {
const data = JSON.parse(message);

if (data.type === 'admin_message') {
await saveMessage(data.chatId, 'admin', data.message);

const userWs = userConnections.get(data.chatId);
if (userWs && userWs.readyState === WebSocket.OPEN) {
userWs.send(JSON.stringify({
type: 'message',
message: data.message,
sender: 'admin',
timestamp: new Date().toISOString()
}));
}
}
} catch (e) {
console.error('Admin WS Error:', e);
}
});

ws.on('close', () => {
adminConnections.delete(ws);
});
}
});

function notifyAdmin(data) {
adminConnections.forEach(ws => {
if (ws.readyState === WebSocket.OPEN) {
ws.send(JSON.stringify(data));
}
});
}

// Admin Sessions
const adminSessions = new Map();

// Admin Panel HTML
async function getAdminPanelHTML() {
const users = await getAllUsers();
const usersWithInfo = [];

for (const user of users) {
const lastMsg = await getLastMessage(user.chatId);
const unread = await getUnreadCount(user.chatId);
usersWithInfo.push({ ...user, lastMessage: lastMsg, unread });
}

const usersHTML = usersWithInfo.map(user => `
<div class="flex items-center gap-3 p-3 hover:bg-[#202c33] cursor-pointer border-b border-[#2a3942] transition"
onclick="openChat('${user.chatId}', '${user.name.replace(/'/g, "\\'")}')">
<div class="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
<span class="text-lg font-bold text-white">${user.name.charAt(0).toUpperCase()}</span>
</div>
<div class="flex-1 min-w-0">
<div class="flex justify-between items-baseline">
<h3 class="text-white font-medium text-sm truncate">${user.name}</h3>
<span class="text-xs text-gray-500 flex-shrink-0 ml-2">
${user.lastMessage ? new Date(user.lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}
</span>
</div>
<div class="flex justify-between items-center mt-1">
<p class="text-sm text-gray-400 truncate">
${user.lastMessage ? user.lastMessage.message.substring(0, 30) + '...' : 'No messages'}
</p>
${user.unread > 0 ? `<span class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">${user.unread}</span>` : ''}
</div>
</div>
</div>
`).join('');

return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin - Chat Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111b21;height:100vh;display:flex}
.chat-list{width:380px;background:#111b21;border-right:1px solid #2a3942;display:flex;flex-direction:column}
.chat-area{flex:1;display:flex;flex-direction:column;background:#222e35}
.chat-header{background:#202c33;padding:15px}
.chat-bg{flex:1;overflow-y:auto;padding:15px;background-color:#0b141a;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.msg-out{background:#005c4b;border-radius:8px 0 8px 8px;color:#e9edef}
.msg-in{background:#202c33;border-radius:0 8px 8px 8px;color:#e9edef}
.typing-dot{width:8px;height:8px;border-radius:50%;background:#a0a8ae;animation:typing 1.4s infinite;display:inline-block;margin:0 2px}
.typing-dot:nth-child(2){animation-delay:0.2s}
.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
</style>
</head>
<body>
<div class="chat-list">
<div class="chat-header flex items-center justify-between">
<h1 class="text-white font-semibold text-lg">Chats</h1>
<div class="flex gap-2">
<a href="/" class="text-gray-400 hover:text-white text-sm">Site</a>
<a href="/admin/logout" class="text-gray-400 hover:text-white text-sm">Logout</a>
</div>
</div>
<div class="flex-1 overflow-y-auto">
${usersHTML || '<div class="text-gray-500 text-center py-8">No users yet</div>'}
</div>
</div>

<div class="chat-area" id="chatArea">
<div class="flex-1 flex items-center justify-center">
<div class="text-center text-gray-500">
<svg class="w-20 h-20 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
<p class="text-lg">Select a chat to start messaging</p>
</div>
</div>
</div>

<script>
let ws;
let currentChatId = null;

function connectAdmin() {
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
ws = new WebSocket(protocol + '//' + window.location.host + '/admin/ws');

ws.onmessage = (event) => {
const data = JSON.parse(event.data);

if (data.type === 'new_message' && data.chatId === currentChatId) {
addMessage(data.message, data.sender);
}
if (data.type === 'user_typing' && data.chatId === currentChatId) {
const indicator = document.getElementById('typingIndicator');
if (indicator) {
indicator.className = data.isTyping ? '' : 'hidden';
document.getElementById('statusText').textContent = data.isTyping ? 'typing...' : 'online';
}
}
};
}

async function openChat(chatId, userName) {
currentChatId = chatId;

document.getElementById('chatArea').innerHTML = `
<div class="chat-header flex items-center gap-3">
<div class="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
<span class="text-lg font-bold text-white">${userName.charAt(0)}</span>
</div>
<div class="flex-1">
<div class="text-white font-medium">${userName}</div>
<div class="text-xs text-gray-400" id="statusText">online</div>
</div>
</div>
<div class="chat-bg" id="messagesContainer">
<div id="messages"></div>
<div id="typingIndicator" class="hidden" style="float:left;clear:both;margin-top:8px">
<div class="msg-in px-4 py-3 inline-block">
<span class="typing-dot"></span>
<span class="typing-dot"></span>
<span class="typing-dot"></span>
</div>
</div>
<div style="clear:both"></div>
</div>
<div class="chat-header flex items-center gap-2">
<input type="text" id="adminInput" class="flex-1 bg-[#2a3942] text-white rounded-full px-4 py-2 text-sm focus:outline-none"
placeholder="Type a message" onkeypress="if(event.key==='Enter')sendAdminMessage('${chatId}')">
<button onclick="sendAdminMessage('${chatId}')" class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white hover:bg-green-600">
<svg width="20" height="20" fill="white" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
</button>
</div>
`;

const response = await fetch('/api/admin/messages?chatId=' + chatId);
const data = await response.json();

if (data.success) {
const messagesDiv = document.getElementById('messages');
messagesDiv.innerHTML = '';
data.messages.forEach(msg => addMessage(msg.message, msg.sender, msg.createdAt));
scrollToBottom();
}
}

function addMessage(text, sender, timestamp) {
const messagesDiv = document.getElementById('messages');
if (!messagesDiv) return;

const time = timestamp ? new Date(timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
const align = sender === 'user' ? 'justify-start' : 'justify-end';
const bubble = sender === 'user' ? 'msg-in' : 'msg-out';

const msgDiv = document.createElement('div');
msgDiv.className = 'mb-3';
msgDiv.innerHTML = `
<div class="flex ${align}">
<div class="${bubble} max-w-[70%] px-3 py-2">
<div class="text-sm">${text}</div>
<div class="text-xs text-gray-400 mt-1 text-right">${time}</div>
</div>
</div>
`;

messagesDiv.appendChild(msgDiv);
scrollToBottom();
}

function scrollToBottom() {
const container = document.getElementById('messagesContainer');
if (container) setTimeout(() => container.scrollTop = container.scrollHeight, 100);
}

async function sendAdminMessage(chatId) {
const input = document.getElementById('adminInput');
const message = input.value.trim();
if (!message) return;

input.value = '';

if (ws && ws.readyState === WebSocket.OPEN) {
ws.send(JSON.stringify({ type: 'admin_message', chatId, message }));
}

const response = await fetch('/api/admin/send', {
method: 'POST',
headers: {'Content-Type': 'application/json'},
body: JSON.stringify({ chatId, message })
});

const data = await response.json();
if (data.success) addMessage(message, 'admin');
}

connectAdmin();
</script>
</body>
</html>`;
}

// HTTP Server
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
const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4' };
const contentType = types[ext] || 'application/octet-stream';
const stat = fs.statSync(assetPath);
res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size, 'Cache-Control': 'public, max-age=86400' });
fs.createReadStream(assetPath).pipe(res);
} else { res.writeHead(404); res.end(); }
return;
}

// API: Register chat user
if (pathname === '/api/chat/register' && method === 'POST') {
let body = '';
req.on('data', chunk => body += chunk);
req.on('end', async () => {
try {
const { name, contact } = JSON.parse(body);
if (!name || !contact) {
res.writeHead(400, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: false, error: 'Name and contact required' }));
return;
}
const user = await findOrCreateUser(name, contact);
const sessionToken = await createSession(user.chatId);
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: true, chatId: user.chatId, sessionToken }));
} catch (e) {
res.writeHead(500, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: false, error: e.message }));
}
});
return;
}

// API: Get messages
if (pathname === '/api/chat/messages' && method === 'GET') {
const token = parsedUrl.query.token;
const user = await getUserByToken(token);
if (!user) {
res.writeHead(401, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
return;
}
const messages = await getMessages(user.chatId);
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: true, messages }));
return;
}

// Admin routes
if (pathname === '/admin' && method === 'GET') {
const sessionId = cookies.sessionId;
if (sessionId && adminSessions.has(sessionId)) {
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(await getAdminPanelHTML());
return;
}
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script><style>body{background:#111b21;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}</style></head><body class="flex items-center justify-center p-4"><div class="w-full max-w-sm"><div class="text-center mb-8"><div class="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center"><svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div><h1 class="text-2xl font-bold text-white">Admin Panel</h1></div><div class="bg-[#202c33] rounded-lg p-6 shadow-xl"><form method="POST" action="/admin/login" class="space-y-4"><div><label class="block text-sm text-gray-400 mb-2">Username</label><input type="text" name="username" required class="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"></div><div><label class="block text-sm text-gray-400 mb-2">Password</label><input type="password" name="password" required class="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"></div><button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition">Login</button></form></div></div></body></html>`);
return;
}

if (pathname === '/admin/login' && method === 'POST') {
let body = '';
req.on('data', chunk => body += chunk);
req.on('end', () => {
const params = new URLSearchParams(body);
if (params.get('username') === 'Hammad' && params.get('password') === 'Hammad1122@') {
const sessionId = crypto.randomBytes(32).toString('hex');
adminSessions.set(sessionId, { username: 'Hammad' });
res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=86400` });
res.end();
} else {
res.writeHead(302, { 'Location': '/admin?error=1' });
res.end();
}
});
return;
}

if (pathname === '/admin/logout') {
const sessionId = cookies.sessionId;
if (sessionId) adminSessions.delete(sessionId);
res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0' });
res.end();
return;
}

if (pathname === '/api/admin/messages' && method === 'GET') {
const chatId = parsedUrl.query.chatId;
const messages = await getMessages(chatId);
await markMessagesRead(chatId);
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: true, messages }));
return;
}

if (pathname === '/api/admin/send' && method === 'POST') {
let body = '';
req.on('data', chunk => body += chunk);
req.on('end', async () => {
const { chatId, message } = JSON.parse(body);
await saveMessage(chatId, 'admin', message);
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success: true }));
});
return;
}

// Main page
if (pathname === '/' || pathname === '/index.html') {
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(getMainHTML());
return;
}

res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
res.end('<h1>404 Not Found</h1>');
});

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
const pathname = url.parse(request.url).pathname;
if (pathname === '/ws' || pathname === '/admin/ws') {
wss.handleUpgrade(request, socket, head, (ws) => {
wss.emit('connection', ws, request);
});
} else {
socket.destroy();
}
});

async function start() {
await connectDB();
server.listen(PORT, () => {
console.log(`Server: http://localhost:${PORT}`);
console.log(`Admin: http://localhost:${PORT}/admin`);
console.log('Admin Login: Hammad / Hammad1122@');
});
}

start();

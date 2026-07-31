const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const UPLOADS_DIR = path.join(__dir, 'uploads');
const VOICE_DIR = path.join(__dir, 'uploads', 'voice');
const IMAGES_DIR = path.join(__dir, 'uploads', 'images');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, UPLOADS_DIR, VOICE_DIR, IMAGES_DIR].forEach(dir => {
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

// Chat Database Functions
async function findOrCreateUser(name, contact) {
    const query = contact.includes('@') ? { email: contact } : { phone: contact };
    let user = await db.collection('chat_users').findOne(query);
    
    if (user) {
        await db.collection('chat_users').updateOne(
            { _id: user._id },
            { $set: { name, lastSeen: new Date(), status: 'online' } }
        );
        return user;
    }
    
    const chatId = 'USER-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    user = {
        chatId, name,
        phone: contact.includes('@') ? '' : contact,
        email: contact.includes('@') ? contact : '',
        createdAt: new Date(), lastSeen: new Date(), status: 'active',
        wallpaper: 'default'
    };
    
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').insertOne({
        token, chatId, createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return token;
}

async function getUserByToken(token) {
    const session = await db.collection('chat_sessions').findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getMessages(chatId, limit = 100) {
    return await db.collection('chat_messages').find({ chatId }).sort({ createdAt: 1 }).limit(limit).toArray();
}

async function saveMessage(chatId, sender, message, type = 'text', mediaUrl = null, duration = null) {
    const msg = { chatId, sender, message, type, mediaUrl, duration, createdAt: new Date(), read: false };
    await db.collection('chat_messages').insertOne(msg);
    return msg;
}

async function getAllUsers() {
    return await db.collection('chat_users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray();
}

async function getLastMessage(chatId) {
    return await db.collection('chat_messages').findOne({ chatId }, { sort: { createdAt: -1 } });
}

async function getUnreadCount(chatId) {
    return await db.collection('chat_messages').countDocuments({ chatId, sender: 'user', read: false });
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
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

// Verification Data
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

// Generate Main HTML with Verification Hub + WhatsApp Chat Widget
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
<title>Baiilla Maach Official | Verification Hub + Chat</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={darkMode:'class',theme:{extend:{colors:{wa:{header:'#075e54',bg:'#0b141a',out:'#005c4b',in:'#202c33',input:'#2a3942'},dark:{950:'#09090b',900:'#101014',800:'#18181c'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}},fontFamily:{sans:['Inter','sans-serif']},animation:{'fade-in':'fadeIn 0.5s ease-out','slide-up':'slideUp 0.4s ease-out','bounce-in':'bounceIn 0.5s','typing-dot':'typingDot 1.4s infinite','pulse-rec':'pulseRec 1s infinite'},keyframes:{fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},slideUp:{'0%':{transform:'translateY(16px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}},bounceIn:{'0%':{transform:'scale(0.3)',opacity:'0'},'50%':{transform:'scale(1.05)'},'70%':{transform:'scale(0.9)'},'100%':{transform:'scale(1)',opacity:'1'}},typingDot:{'0%,60%,100%':{transform:'translateY(0)'},'30%':{transform:'translateY(-10px)'}},pulseRec:{'0%,100%':{opacity:'1'},'50%':{opacity:'0.5'}}}}}}
</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#09090b 0%,#101014 50%,#141418 100%);color:#e5e5e5;min-height:100vh;overflow-x:hidden;line-height:1.5}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:2px}
::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.15);border-radius:2px}
.gradient-text{background:linear-gradient(135deg,#a78bfa 0%,#ec4899 50%,#a78bfa 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradient-x 3s ease infinite}
@keyframes gradient-x{0%,100%{background-position:left center}50%{background-position:right center}}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.hover-lift{transition:all 0.3s ease}.hover-lift:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(0,0,0,0.3)}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.3)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.3)}
.header-hide{transform:translateY(-100%);transition:transform 0.3s ease}
.header-show{transform:translateY(0);transition:transform 0.3s ease}

/* WhatsApp Widget */
.whatsapp-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.whatsapp-btn{width:60px;height:60px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(37,211,102,0.5);transition:all 0.3s;animation:bounceIn 0.5s}
.whatsapp-btn:hover{transform:scale(1.1)}
.whatsapp-btn svg{width:32px;height:32px;fill:white}
.notification-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;width:22px;height:22px;font-size:11px;display:none;align-items:center;justify-content:center;font-weight:bold}
.chat-window{position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 120px);background:#0b141a;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;flex-direction:column;animation:fadeIn 0.3s ease-out}
.chat-window.open{display:flex}
.wa-header{background:#075e54;padding:15px;display:flex;align-items:center;gap:12px}
.wa-header .avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;font-size:18px;position:relative}
.online-dot{width:12px;height:12px;background:#25d366;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #075e54}
.chat-messages{flex:1;overflow-y:auto;padding:15px;background-color:#0b141a;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.msg-bubble{max-width:80%;padding:8px 12px;margin-bottom:6px;border-radius:8px;font-size:14px;line-height:1.4;position:relative;word-wrap:break-word;animation:messageIn 0.3s ease-out}
@keyframes messageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-out{background:#005c4b;color:#e9edef;float:right;clear:both;border-radius:8px 0 8px 8px}
.msg-in{background:#202c33;color:#e9edef;float:left;clear:both;border-radius:0 8px 8px 8px}
.msg-time{font-size:11px;color:rgba(255,255,255,0.5);text-align:right;margin-top:4px}
.msg-image{max-width:250px;border-radius:6px;cursor:pointer}
.chat-input-area{background:#202c33;padding:10px 15px;display:flex;align-items:center;gap:8px}
.chat-input-area input{flex:1;background:#2a3942;border:none;padding:10px 15px;border-radius:25px;color:white;font-size:14px;outline:none}
.chat-input-area input::placeholder{color:#8696a0}
.chat-input-area button{width:40px;height:40px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;background:transparent;color:#8696a0}
.chat-input-area button:hover{color:white}
.send-btn{background:#00a884!important;color:white!important}
.send-btn:hover{background:#06cf9c!important}
.record-btn.recording{color:#ef4444!important;animation:pulseRec 1s infinite}
.typing-indicator{display:none;padding:0 15px 10px}
.typing-dots{display:flex;gap:4px;padding:8px 12px;background:#202c33;border-radius:8px;float:left;clear:both}
.typing-dot{width:8px;height:8px;border-radius:50%;background:#8696a0;animation:typingDot 1.4s infinite;display:inline-block}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
.chat-login{padding:30px 20px;text-align:center}
.chat-login input{width:100%;background:#2a3942;border:2px solid #00a884;padding:12px 15px;border-radius:8px;color:white;font-size:14px;margin-bottom:10px;outline:none}
.chat-login button{width:100%;background:#00a884;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:all 0.2s}
.chat-login button:hover{background:#06cf9c}
.recording-bar{display:none;background:#ef4444;color:white;padding:5px 15px;align-items:center;gap:8px;font-size:13px}
.emoji-picker{display:none;flex-wrap:wrap;gap:4px;padding:10px;background:#202c33;max-height:150px;overflow-y:auto}
.emoji-picker.open{display:flex}
.emoji-picker span{font-size:20px;cursor:pointer;padding:4px;border-radius:6px}
.emoji-picker span:hover{background:rgba(255,255,255,0.1)}
.image-preview{display:none;padding:8px;background:#202c33;position:relative}
.image-preview img{max-height:100px;border-radius:8px}
.close-preview{position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer}
.image-viewer{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center}
.image-viewer.open{display:flex}
.image-viewer img{max-width:95%;max-height:95%}
.close-viewer{position:absolute;top:20px;right:20px;color:white;font-size:30px;cursor:pointer}
@media(max-width:768px){.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:0;height:100%;max-height:100%}}
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
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/25 rounded-full text-xs font-semibold verified-glow">Verified Official</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-full text-xs font-semibold">Creator</span>
</div>
<div class="flex justify-center gap-2">
<a href="${realAcc[0].url}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50 transition">TikTok</a>
<a href="${realAcc[1].url}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 glass rounded-full text-xs font-semibold hover:border-green-500/50 transition">Facebook</a>
</div>
</section>

<!-- Official Section -->
<section id="official" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center verified-glow">
<svg class="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">Official Verified Account</h2>
</div>
<div class="glass-card p-4">
<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-xs font-bold mb-3">✓ VERIFIED</span>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${realAcc.map(acc => `
<div class="bg-[#1f1f23] rounded-xl p-3">
<div class="flex items-center justify-between mb-2"><span class="text-xs uppercase text-gray-400">${acc.platform}</span><span class="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">Verified</span></div>
<div class="flex items-center gap-2">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover">` : '<div class="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-lg font-bold">' + acc.platform[0] + '</div>'}
<div><div class="font-bold text-white text-sm">${acc.username}</div><div class="text-xs text-gray-400">${acc.platform}${acc.followers?' • '+acc.followers+' followers':''}</div></div>
</div>
</div>`).join('')}
</div>
<div class="bg-[#1f1f23] rounded-xl p-4 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-green-500 mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" class="bg-green-500 px-5 py-2.5 rounded-full text-white font-bold text-xs hover:bg-green-600 transition">Follow Official Account</a>
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
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Platform</span><span class="text-red-300">${a.platform}</span></div>
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Username</span><span class="text-red-300">${a.username}</span></div>
<div class="flex justify-between bg-[#1f1f23] rounded-lg px-3 py-1.5"><span class="text-gray-400">Reports</span><span class="text-red-300">${a.reportedCount}+</span></div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300">${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="${a.profileUrl}" target="_blank" class="flex-1 text-center bg-red-500 px-3 py-2 rounded-full text-white text-xs font-bold hover:bg-red-600 transition">Report</a>
<button class="flex-1 px-3 py-2 bg-[#1f1f23] border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10" onclick="navigator.clipboard.writeText('${a.username}');alert('Copied!')">Copy</button>
</div>
</div>`).join('')}
</div>
<div class="text-center mt-3">
<button onclick="document.getElementById('fakeVoice').play()" class="glass px-4 py-2 rounded-full text-xs text-red-300 hover:bg-red-500/10">🔊 Voice Alert</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="py-4 animate-slide-up">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">🎵</div>
<h2 class="text-base font-bold text-white">Cover Music</h2>
<span class="text-xs text-gray-400">${coverSongs.length} songs</span>
</div>
<div class="glass-card p-4">
<div class="space-y-2 max-h-64 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-3 p-2 hover:bg-[#1f1f23] rounded-lg cursor-pointer" onclick="playCoverSong('${s.audioUrl}','${s.title}')">
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

<!-- WhatsApp Chat Widget -->
<div class="whatsapp-widget">
<div class="whatsapp-btn" onclick="toggleChat()" id="chatBtn">
<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
<span class="notification-badge" id="msgBadge">0</span>
</div>

<div class="chat-window" id="chatWindow">
<div class="wa-header">
<div class="avatar">H<div class="online-dot" id="onlineDot"></div></div>
<div style="flex:1"><div style="color:white;font-weight:600">Hammad Bin Amir</div><div style="color:#a5d6a7;font-size:12px" id="statusText">Online</div></div>
<button onclick="toggleChat()" style="background:transparent;border:none;color:white;cursor:pointer;font-size:20px">✕</button>
</div>

<div id="chatLoginForm" class="chat-login">
<p style="color:#8696a0;margin-bottom:15px">Enter your details to start chatting</p>
<input type="text" id="userName" placeholder="Your Name">
<input type="text" id="userContact" placeholder="Phone Number or Email">
<button onclick="registerChat()">Start Chat</button>
<p style="color:#8696a0;font-size:11px;margin-top:8px">Use same phone/email to find old chats</p>
</div>

<div id="chatInterface" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages" id="chatMessages">
<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">🔒 Messages are secure</div>
</div>
<div class="typing-indicator" id="typingIndicator">
<div class="typing-dots">
<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
</div>
</div>
<div class="image-preview" id="imagePreview">
<img id="previewImage" src="">
<button class="close-preview" onclick="clearImagePreview()">✕</button>
</div>
<div class="recording-bar" id="recordingBar">
<span>🔴 Recording...</span>
<span id="recTime">00:00</span>
</div>
<div class="chat-input-area">
<button onclick="document.getElementById('imageInput').click()" title="Image">🖼</button>
<input type="file" id="imageInput" accept="image/*" style="display:none" onchange="handleImage(event)">
<input type="text" id="messageInput" placeholder="Type a message" onkeypress="if(event.key==='Enter')sendMessage()">
<button id="recordBtn" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Voice">🎤</button>
<button class="send-btn" onclick="sendMessage()">➤</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<!-- Image Viewer -->
<div class="image-viewer" id="imageViewer" onclick="this.classList.remove('open')">
<span class="close-viewer">✕</span>
<img id="viewerImage" src="">
</div>

<script>
// Header scroll
let lastScroll=0;document.getElementById('mainHeader').addEventListener('scroll',()=>{const s=window.scrollY;const h=document.getElementById('mainHeader');if(s>lastScroll&&s>60)h.classList.add('header-hide');else h.classList.remove('header-hide');lastScroll=s});

// Cover Music Player
function playCoverSong(url,title){
const a=document.getElementById('coverAudio');
a.src=url;
a.play().catch(()=>{});
if(title)document.title=title+' - Cover Music';
}

// Welcome Voice
setTimeout(()=>{
const wv=document.getElementById('welcomeVoice');
if(wv&&!sessionStorage.getItem('wvPlayed')){wv.play().catch(()=>{});sessionStorage.setItem('wvPlayed','1')}
},2000);

// WhatsApp Chat
let ws=null,chatToken=localStorage.getItem('chatToken'),chatId=null,selectedImage=null;
let mediaRecorder=null,audioChunks=[],recStart=0,recInterval=null;

function toggleChat(){
const w=document.getElementById('chatWindow');
w.classList.toggle('open');
if(w.classList.contains('open')&&!ws)connectWS();
}

function connectWS(){
const p=window.location.protocol==='https:'?'wss:':'ws:';
ws=new WebSocket(p+'//'+window.location.host+'/ws');
ws.onopen=()=>{
document.getElementById('statusText').textContent='Online';
document.getElementById('onlineDot').style.display='block';
if(chatToken)ws.send(JSON.stringify({type:'auth',token:chatToken}));
};
ws.onmessage=(e)=>{
const d=JSON.parse(e.data);
if(d.type==='auth_success'){showChatUI();loadMessages()}
else if(d.type==='message')addMsg(d.message,d.sender,d.msgType||'text',d.mediaUrl,d.duration,d.timestamp)
else if(d.type==='typing'){
document.getElementById('typingIndicator').style.display=d.isTyping?'block':'none';
document.getElementById('statusText').textContent=d.isTyping?'typing...':'Online';
scrollChat();
}
};
ws.onclose=()=>{
document.getElementById('statusText').textContent='Offline';
document.getElementById('onlineDot').style.display='none';
setTimeout(connectWS,3000);
};
}

async function registerChat(){
const n=document.getElementById('userName').value.trim();
const c=document.getElementById('userContact').value.trim();
if(!n||!c){alert('Please fill all fields');return}
try{
const r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,contact:c})});
const d=await r.json();
if(d.success){
chatToken=d.sessionToken;chatId=d.chatId;
localStorage.setItem('chatToken',chatToken);
showChatUI();
if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'auth',token:chatToken}));
else connectWS();
}else alert(d.error||'Error');
}catch(e){alert('Connection error')}
}

function showChatUI(){
document.getElementById('chatLoginForm').style.display='none';
document.getElementById('chatInterface').style.display='flex';
}

function sendMessage(){
const inp=document.getElementById('messageInput');
const msg=inp.value.trim();
if(!msg&&!selectedImage)return;
if(selectedImage){
ws.send(JSON.stringify({type:'message',token:chatToken,message:msg||'🖼 Image',msgType:'image',mediaUrl:selectedImage}));
clearImagePreview();
}else{
ws.send(JSON.stringify({type:'message',token:chatToken,message:msg,msgType:'text'}));
}
inp.value='';inp.focus();
}

function addMsg(text,sender,type,mediaUrl,duration,timestamp){
const c=document.getElementById('chatMessages');
const w=document.createElement('div');
const t=new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const a=sender==='user'?'flex justify-end':'flex justify-start';
const b=sender==='user'?'msg-out':'msg-in';
let html='';
if(type==='image'){
html='<div class="'+a+' mb-2"><div class="'+b+'"><img src="'+mediaUrl+'" class="msg-image" onclick="document.getElementById(\'viewerImage\').src=\''+mediaUrl+'\';document.getElementById(\'imageViewer\').classList.add(\'open\')"><div class="msg-time">'+t+' ✓✓</div></div></div>';
}else if(type==='voice'){
html='<div class="'+a+' mb-2"><div class="'+b+'"><div style="display:flex;align-items:center;gap:8px"><button onclick="playVoice(this,\''+mediaUrl+'\')" style="width:32px;height:32px;border-radius:50%;background:#00a884;border:none;color:white;cursor:pointer">▶</button><span style="font-size:12px">🎤 '+(duration||0)+'s</span></div><div class="msg-time">'+t+' ✓✓</div></div></div>';
}else{
html='<div class="'+a+' mb-2"><div class="'+b+'">'+text+'<div class="msg-time">'+t+' '+(sender==='user'?'✓✓':'')+'</div></div></div>';
}
w.innerHTML=html;c.appendChild(w);scrollChat();
}

function playVoice(btn,url){
const a=new Audio(url);
a.play();
btn.textContent='⏸';
a.onended=()=>{btn.textContent='▶'};
}

function handleImage(e){
const f=e.target.files[0];
if(!f)return;
const r=new FileReader();
r.onload=(ev)=>{selectedImage=ev.target.result;document.getElementById('previewImage').src=selectedImage;document.getElementById('imagePreview').style.display='block'};
r.readAsDataURL(f);
}

function clearImagePreview(){
selectedImage=null;
document.getElementById('imagePreview').style.display='none';
document.getElementById('imageInput').value='';
}

async function startRecording(){
try{
const s=await navigator.mediaDevices.getUserMedia({audio:true});
mediaRecorder=new MediaRecorder(s);
audioChunks=[];
mediaRecorder.ondataavailable=(e)=>audioChunks.push(e.data);
mediaRecorder.start();
document.getElementById('recordBtn').classList.add('recording');
document.getElementById('recordingBar').style.display='flex';
recStart=Date.now();
recInterval=setInterval(()=>{
const e=Math.floor((Date.now()-recStart)/1000);
document.getElementById('recTime').textContent=Math.floor(e/60).toString().padStart(2,'0')+':'+(e%60).toString().padStart(2,'0');
},1000);
}catch(e){console.error(e)}
}

function stopRecording(){
if(!mediaRecorder||mediaRecorder.state==='inactive')return;
mediaRecorder.stop();
document.getElementById('recordBtn').classList.remove('recording');
document.getElementById('recordingBar').style.display='none';
clearInterval(recInterval);
mediaRecorder.onstop=()=>{
const b=new Blob(audioChunks,{type:'audio/webm'});
const r=new FileReader();
r.onload=()=>{
const d=Math.floor((Date.now()-recStart)/1000);
ws.send(JSON.stringify({type:'message',token:chatToken,message:'🎤 Voice',msgType:'voice',mediaUrl:r.result,duration:d}));
};
r.readAsDataURL(b);
mediaRecorder.stream.getTracks().forEach(t=>t.stop());
};
}

async function loadMessages(){
try{
const r=await fetch('/api/messages?token='+chatToken);
const d=await r.json();
if(d.success){
document.getElementById('chatMessages').innerHTML='<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">🔒 Messages are secure</div>';
d.messages.forEach(m=>addMsg(m.message,m.sender,m.type||'text',m.mediaUrl,m.duration,m.createdAt));
}
}catch(e){}
}

function scrollChat(){
const c=document.getElementById('chatMessages');
setTimeout(()=>{c.scrollTop=c.scrollHeight},100);
}

let typingTO;
document.getElementById('messageInput')?.addEventListener('input',()=>{
if(ws&&ws.readyState===WebSocket.OPEN){
ws.send(JSON.stringify({type:'typing',isTyping:true,token:chatToken}));
clearTimeout(typingTO);
typingTO=setTimeout(()=>ws.send(JSON.stringify({type:'typing',isTyping:false,token:chatToken})),2000);
}
});

if(chatToken)setTimeout(connectWS,1000);
</script>
</body>
</html>`;
}

// Login Page (separate for users who want full chat experience)
function getLoginPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp Chat - Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#075e54,#128c7e);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{background:white;border-radius:16px;padding:30px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.logo{width:80px;height:80px;background:#25d366;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center}
h1{text-align:center;color:#075e54;margin-bottom:10px}
p{text-align:center;color:#667781;margin-bottom:20px;font-size:14px}
input{width:100%;padding:12px;margin-bottom:10px;border:2px solid #e9edef;border-radius:8px;font-size:16px;outline:none}
input:focus{border-color:#25d366}
button{width:100%;padding:14px;background:#25d366;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}
button:hover{background:#1da851}
a{display:block;text-align:center;margin-top:15px;color:#075e54;text-decoration:none;font-size:14px}
</style>
</head>
<body>
<div class="container">
<div class="logo">
<svg width="50" height="50" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
</div>
<h1>WhatsApp Chat</h1>
<p>Enter your details to start chatting</p>
<form method="POST" action="/chat">
<input type="text" name="name" placeholder="Your Name" required>
<input type="text" name="contact" placeholder="Phone Number or Email" required>
<button type="submit">Start Chatting</button>
</form>
<a href="/">← Back to Verification Hub</a>
</div>
</body>
</html>`;
}

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
<div class="flex items-center gap-3 p-3 hover:bg-[#202c33] cursor-pointer border-b border-[#2a3942] transition" onclick="openChat('${user.chatId}', '${user.name.replace(/'/g, "\\'")}')">
<div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
<span class="text-lg font-bold text-white">${user.name.charAt(0).toUpperCase()}</span>
</div>
<div class="flex-1 min-w-0">
<div class="flex justify-between items-baseline">
<h3 class="text-white font-medium text-sm truncate">${user.name}</h3>
<span class="text-xs text-gray-500 flex-shrink-0 ml-2">${user.lastMessage ? new Date(user.lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</span>
</div>
<div class="flex justify-between items-center mt-1">
<p class="text-sm text-gray-400 truncate">${user.lastMessage ? user.lastMessage.message.substring(0, 30) : 'No messages'}</p>
${user.unread > 0 ? `<span class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">${user.unread}</span>` : ''}
</div>
</div>
</div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111b21;height:100vh;display:flex}
.chat-list{width:380px;background:#111b21;border-right:1px solid #2a3942;display:flex;flex-direction:column}
.chat-area{flex:1;display:flex;flex-direction:column;background:#222e35}
.wa-header{background:#202c33;padding:15px;display:flex;align-items:center;gap:12px}
.chat-bg{flex:1;overflow-y:auto;padding:15px;background-color:#0b141a;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.msg-out{background:#005c4b;color:#e9edef;border-radius:8px 0 8px 8px}
.msg-in{background:#202c33;color:#e9edef;border-radius:0 8px 8px 8px}
.typing-dot{width:8px;height:8px;border-radius:50%;background:#a0a8ae;animation:typing 1.4s infinite;display:inline-block;margin:0 2px}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
</style>
</head>
<body>
<div class="chat-list">
<div class="wa-header justify-between">
<h1 class="text-white font-semibold text-lg">Chats</h1>
<div class="flex gap-2">
<a href="/" class="text-gray-400 hover:text-white text-sm">Site</a>
<a href="/admin/logout" class="text-gray-400 hover:text-white text-sm">Logout</a>
</div>
</div>
<div class="flex-1 overflow-y-auto">${usersHTML || '<div class="text-gray-500 text-center py-8">No users yet</div>'}</div>
</div>
<div class="chat-area" id="chatArea">
<div class="flex-1 flex items-center justify-center">
<div class="text-center text-gray-500">
<svg class="w-20 h-20 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
<p class="text-lg">Select a chat</p>
</div>
</div>
</div>
<script>
let ws,currentChatId=null;
function connectAdmin(){
const p=window.location.protocol==='https:'?'wss:':'ws:';
ws=new WebSocket(p+'//'+window.location.host+'/admin/ws');
ws.onmessage=(e)=>{
const d=JSON.parse(e.data);
if(d.type==='new_message'&&d.chatId===currentChatId)addMsg(d.message,d.sender,d.msgType,d.mediaUrl,d.duration);
if(d.type==='user_typing'&&d.chatId===currentChatId){
const ti=document.getElementById('typingIndicator');
if(ti)ti.style.display=d.isTyping?'block':'none';
}
};
}
async function openChat(cid,name){
currentChatId=cid;
document.getElementById('chatArea').innerHTML=
'<div class="wa-header"><div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center"><span class="text-lg font-bold text-white">'+name.charAt(0)+'</span></div><div class="flex-1"><div class="text-white font-medium">'+name+'</div><div class="text-xs text-gray-400" id="st">online</div></div></div>'+
'<div class="chat-bg" id="mc"><div id="msgs"></div><div id="typingIndicator" style="display:none;float:left;clear:both;margin-top:8px"><div class="msg-in px-4 py-3 inline-block"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div><div style="clear:both"></div></div>'+
'<div class="wa-header"><input type="text" id="ai" class="flex-1 bg-[#2a3942] text-white rounded-full px-4 py-2 text-sm focus:outline-none" placeholder="Type a message" onkeypress="if(event.key===\\'Enter\\')sendAdmin()"><button onclick="sendAdmin()" class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white ml-2"><svg width="20" height="20" fill="white" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg></button></div>';
const r=await fetch('/api/admin/messages?chatId='+cid);
const d=await r.json();
if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt));scrollB()}
}
function addMsg(text,sender,type,mediaUrl,duration,timestamp){
const c=document.getElementById('msgs');if(!c)return;
const t=new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const a=sender==='user'?'justify-start':'justify-end';
const b=sender==='user'?'msg-in':'msg-out';
const d=document.createElement('div');d.className='mb-3';
let h='';
if(type==='image')h='<div class="flex '+a+'"><div class="'+b+' max-w-[70%] px-3 py-2"><img src="'+mediaUrl+'" style="max-width:250px;border-radius:6px;cursor:pointer" onclick="window.open(\\''+mediaUrl+'\\')"><div class="text-xs text-gray-400 mt-1 text-right">'+t+'</div></div></div>';
else if(type==='voice')h='<div class="flex '+a+'"><div class="'+b+' max-w-[70%] px-3 py-2"><div style="display:flex;align-items:center;gap:8px"><button onclick="new Audio(\\''+mediaUrl+'\\').play()" style="width:30px;height:30px;border-radius:50%;background:#00a884;border:none;color:white;cursor:pointer">▶</button><span>🎤 '+(duration||0)+'s</span></div><div class="text-xs text-gray-400 mt-1 text-right">'+t+'</div></div></div>';
else h='<div class="flex '+a+'"><div class="'+b+' max-w-[70%] px-3 py-2"><div class="text-sm">'+text+'</div><div class="text-xs text-gray-400 mt-1 text-right">'+t+'</div></div></div>';
d.innerHTML=h;c.appendChild(d);scrollB()
}
function scrollB(){const c=document.getElementById('mc');if(c)setTimeout(()=>c.scrollTop=c.scrollHeight,100)}
async function sendAdmin(){
const i=document.getElementById('ai');const m=i.value.trim();if(!m)return;i.value='';
if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'admin_message',chatId:currentChatId,message:m}));
await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:currentChatId,message:m})});
addMsg(m,'admin','text',null,null,new Date().toISOString())
}
connectAdmin();
setInterval(()=>{if(currentChatId)fetch('/api/admin/messages?chatId='+currentChatId).then(r=>r.json()).then(d=>{if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt))}})},5000);
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
                        
                        setTimeout(async () => {
                            await saveMessage(user.chatId, 'admin', 'Hello! 👋 How can I help you today?', 'text');
                            ws.send(JSON.stringify({ type: 'message', message: 'Hello! 👋 How can I help you today?', sender: 'admin', msgType: 'text', timestamp: new Date().toISOString() }));
                            notifyAdmin({ type: 'new_message', chatId: user.chatId, name: user.name, message: 'Hello! 👋 How can I help you today?', sender: 'admin' });
                        }, 1500);
                    }
                } else if (data.type === 'message' && userData) {
                    await saveMessage(userData.chatId, 'user', data.message, data.msgType || 'text', data.mediaUrl, data.duration);
                    ws.send(JSON.stringify({ type: 'message', message: data.message, sender: 'user', msgType: data.msgType, mediaUrl: data.mediaUrl, duration: data.duration, timestamp: new Date().toISOString() }));
                    notifyAdmin({ type: 'new_message', chatId: userData.chatId, name: userData.name, message: data.message, sender: 'user', msgType: data.msgType, mediaUrl: data.mediaUrl, duration: data.duration });
                } else if (data.type === 'typing' && userData) {
                    notifyAdmin({ type: 'user_typing', chatId: userData.chatId, isTyping: data.isTyping });
                }
            } catch (e) { console.error('WS Error:', e); }
        });
        ws.on('close', () => { if (userData) userConnections.delete(userData.chatId); });
    } else if (pathname === '/admin/ws') {
        adminConnections.add(ws);
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'admin_message') {
                    await saveMessage(data.chatId, 'admin', data.message, data.msgType || 'text', data.mediaUrl, data.duration);
                    const userWs = userConnections.get(data.chatId);
                    if (userWs && userWs.readyState === WebSocket.OPEN) {
                        userWs.send(JSON.stringify({ type: 'message', message: data.message, sender: 'admin', msgType: data.msgType, mediaUrl: data.mediaUrl, duration: data.duration, timestamp: new Date().toISOString() }));
                    }
                }
            } catch (e) { console.error('Admin WS Error:', e); }
        });
        ws.on('close', () => { adminConnections.delete(ws); });
    }
});

function notifyAdmin(data) {
    adminConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    });
}

// Admin sessions
const adminSessions = new Map();

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
    if (pathname.startsWith('/assets/') || pathname.startsWith('/uploads/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        if (!assetPath.startsWith(ASSETS_DIR) && !assetPath.startsWith(UPLOADS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.webm':'audio/webm' };
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    
    // API: Register chat
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { name, contact } = JSON.parse(body);
                if (!name || !contact) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Name and contact required' })); return; }
                const user = await findOrCreateUser(name, contact);
                const token = await createSession(user.chatId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, sessionToken: token }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
        });
        return;
    }
    
    // API: Get messages
    if (pathname === '/api/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        const user = await getUserByToken(token);
        if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
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
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>body{background:#111b21;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:#202c33;border-radius:12px;padding:30px;max-width:350px;width:100%}h1{color:white;text-align:center;margin-bottom:20px}input{width:100%;padding:12px;margin-bottom:10px;background:#2a3942;border:none;border-radius:8px;color:white;font-size:16px;outline:none}button{width:100%;padding:14px;background:#00a884;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#06cf9c}</style></head><body><div class="box"><h1>Admin Login</h1><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
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
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=' + sessionId + '; HttpOnly; Path=/; Max-Age=86400' });
                res.end();
            } else { res.writeHead(302, { 'Location': '/admin?error=1' }); res.end(); }
        });
        return;
    }
    
    if (pathname === '/admin/logout') {
        const sessionId = cookies.sessionId;
        if (sessionId) adminSessions.delete(sessionId);
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0' }); res.end();
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
    
    // Chat-only page (full WhatsApp experience)
    if (pathname === '/chat' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const name = params.get('name');
            const contact = params.get('contact');
            const user = await findOrCreateUser(name, contact);
            const token = await createSession(user.chatId);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getMainHTML().replace('</body>', '<script>document.addEventListener("DOMContentLoaded",()=>{localStorage.setItem("chatToken","'+token+'");setTimeout(()=>{document.querySelector(".whatsapp-btn").click()},1000)})</script></body>'));
        });
        return;
    }
    
    // Main verification hub page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML());
        return;
    }
    
    res.writeHead(404);
    res.end('404 Not Found');
});

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname === '/ws' || pathname === '/admin/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else { socket.destroy(); }
});

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

// Start
async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('========================================');
        console.log(' Verification Hub + WhatsApp Chat');
        console.log('========================================');
        console.log(' Main Site: http://localhost:' + PORT);
        console.log(' Admin: http://localhost:' + PORT + '/admin');
        console.log(' Admin Login: Hammad / Hammad1122@');
        console.log('========================================');
    });
}

start();

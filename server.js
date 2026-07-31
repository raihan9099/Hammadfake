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
        createdAt: new Date(), lastSeen: new Date(), status: 'active'
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

// Generate Complete HTML
function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#075e54">
<title>Baiilla Maach | Chat</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
    --wa-dark: #0b141a;
    --wa-darker: #111b21;
    --wa-header: #202c33;
    --wa-input: #2a3942;
    --wa-out: #005c4b;
    --wa-in: #202c33;
    --wa-green: #00a884;
    --wa-light: #e9edef;
    --wa-gray: #8696a0;
    --ver-bg: #09090b;
    --ver-card: #18181c;
}

*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--ver-bg);color:#e5e5e5;min-height:100vh}

/* WhatsApp Chat Widget */
.wa-widget{position:fixed;bottom:24px;right:24px;z-index:9999}
.wa-btn{width:60px;height:60px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 24px rgba(37,211,102,0.4);transition:all 0.3s;border:none}
.wa-btn:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(37,211,102,0.6)}
.wa-btn svg{width:32px;height:32px;fill:white}
.badge{position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border-radius:50%;width:22px;height:22px;font-size:11px;display:none;align-items:center;justify-content:center;font-weight:700}

.chat-window{position:fixed;bottom:100px;right:24px;width:400px;max-width:calc(100vw - 48px);height:600px;max-height:calc(100vh - 140px);background:var(--wa-darker);border-radius:12px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,0.5);display:none;flex-direction:column}
.chat-window.open{display:flex}

.wa-top{background:var(--wa-header);padding:14px 16px;display:flex;align-items:center;gap:12px}
.wa-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:18px;position:relative;flex-shrink:0}
.online-dot{width:12px;height:12px;background:#25d366;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid var(--wa-header)}
.wa-top-info{flex:1;min-width:0}
.wa-top-name{color:white;font-weight:600;font-size:15px}
.wa-top-status{color:#a5d6a7;font-size:12px;margin-top:1px}
.wa-close{background:transparent;border:none;color:var(--wa-gray);cursor:pointer;font-size:20px;padding:4px}

.wa-body{flex:1;overflow-y:auto;padding:16px;background-color:var(--wa-dark);background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}

.wa-login{padding:40px 24px;text-align:center}
.wa-login h3{color:var(--wa-light);margin-bottom:4px}
.wa-login p{color:var(--wa-gray);font-size:13px;margin-bottom:20px}
.wa-login input{width:100%;background:var(--wa-input);border:2px solid transparent;padding:12px 16px;border-radius:8px;color:white;font-size:14px;margin-bottom:12px;outline:none;transition:border 0.2s}
.wa-login input:focus{border-color:var(--wa-green)}
.wa-login button{width:100%;background:var(--wa-green);color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:background 0.2s}
.wa-login button:hover{background:#06cf9c}

.wa-msg{max-width:75%;padding:6px 12px 6px 9px;margin-bottom:4px;border-radius:8px;font-size:14.2px;line-height:1.45;position:relative;word-wrap:break-word}
.wa-msg-out{background:var(--wa-out);color:var(--wa-light);float:right;clear:both;border-radius:8px 0 8px 8px}
.wa-msg-in{background:var(--wa-in);color:var(--wa-light);float:left;clear:both;border-radius:0 8px 8px 8px}
.wa-msg-time{font-size:11px;color:rgba(255,255,255,0.45);text-align:right;margin-top:3px;margin-left:8px;float:right}
.wa-msg-img{max-width:240px;border-radius:6px;cursor:pointer}
.wa-msg::after{content:'';display:table;clear:both}

.wa-typing{display:none;padding:0 16px 8px}
.typing-dots{display:flex;gap:4px;padding:8px 12px;background:var(--wa-in);border-radius:8px;float:left;clear:both}
.typing-dot{width:8px;height:8px;border-radius:50%;background:var(--wa-gray);animation:td 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes td{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}

.wa-foot{background:var(--wa-header);padding:8px 12px;display:flex;align-items:center;gap:8px}
.wa-foot input{flex:1;background:var(--wa-input);border:none;padding:10px 16px;border-radius:24px;color:white;font-size:14px;outline:none}
.wa-foot input::placeholder{color:var(--wa-gray)}
.wa-foot button{width:40px;height:40px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;background:transparent;color:var(--wa-gray);font-size:18px}
.wa-foot button:hover{color:white}
.wa-send{background:var(--wa-green)!important;color:white!important}

.recording-bar{display:none;background:#ef4444;color:white;padding:6px 16px;align-items:center;gap:8px;font-size:13px}
.recording{color:#ef4444!important;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}

.img-preview{display:none;padding:8px 12px;background:var(--wa-header);position:relative}
.img-preview img{max-height:80px;border-radius:8px}
.img-preview .close-prev{position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:14px}

.viewer{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center}
.viewer.open{display:flex}
.viewer img{max-width:95%;max-height:95%}
.viewer .close{position:absolute;top:24px;right:24px;color:white;font-size:32px;cursor:pointer}

/* Verification Hub Styles */
.ver-header{position:fixed;top:0;left:0;right:0;z-index:40;background:rgba(24,24,28,0.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.06);padding:0 16px}
.ver-header-inner{max-width:1024px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:48px}
.ver-logo{display:flex;align-items:center;gap:8px}
.ver-logo img{width:28px;height:28px;border-radius:50%;border:2px solid #9333ea;object-fit:cover}
.ver-logo span{font-weight:700;font-size:14px;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ver-nav{display:flex;gap:4px}
.ver-nav a{color:#9ca3af;text-decoration:none;font-size:12px;padding:4px 8px;border-radius:6px;transition:color 0.2s}
.ver-nav a:hover{color:white}

.ver-main{padding-top:60px;max-width:1024px;margin:0 auto;padding:60px 12px 100px}

.card{background:rgba(24,24,28,0.9);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
.card-red{border-color:rgba(239,68,68,0.2)}
.card-green{border-color:rgba(34,197,94,0.2)}
.glow-green{box-shadow:0 0 20px rgba(34,197,94,0.3)}
.glow-red{box-shadow:0 0 20px rgba(239,68,68,0.3)}
.section-title{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.section-title h2{font-size:16px;font-weight:700;color:white}
.badge-sm{padding:2px 10px;background:rgba(239,68,68,0.15);color:#f87171;border-radius:999px;font-size:11px;font-weight:700}
.badge-green{padding:2px 10px;background:rgba(34,197,94,0.15);color:#4ade80;border-radius:999px;font-size:11px;font-weight:700}
.btn{padding:8px 16px;border-radius:999px;font-size:12px;font-weight:600;text-decoration:none;display:inline-block;transition:all 0.2s}
.btn-green{background:linear-gradient(135deg,#22c55e,#16a34a);color:white}
.btn-red{background:linear-gradient(135deg,#ef4444,#dc2626);color:white}
.btn-outline{padding:8px 16px;border:1px solid rgba(239,68,68,0.3);border-radius:999px;font-size:12px;font-weight:600;color:#f87171;background:rgba(24,24,28,0.9);cursor:pointer;transition:all 0.2s}
.btn-outline:hover{background:rgba(239,68,68,0.1)}
.profile-img{width:72px;height:72px;border-radius:50%;border:3px solid #9333ea;object-fit:cover}
.verified-badge{position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;background:#22c55e;border-radius:50%;border:3px solid #09090b;display:flex;align-items:center;justify-content:center}
.fake-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-15deg);font-size:48px;font-weight:900;color:rgba(239,68,68,0.04);pointer-events:none;white-space:nowrap}
.stat-box{background:rgba(24,24,28,0.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.04);border-radius:12px;padding:12px;text-align:center}
.stat-num{font-size:18px;font-weight:700;color:white}
.stat-label{font-size:11px;color:#6b7280;text-transform:uppercase}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.flex-center{display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center}
.text-sm{font-size:14px}.text-xs{font-size:12px}.text-gray{color:#9ca3af}.text-red{color:#f87171}.text-green{color:#4ade80}
.mt-2{margin-top:8px}.mb-2{margin-bottom:8px}.mb-3{margin-bottom:12px}.gap-2{gap:8px}
.overflow-auto{overflow-y:auto}.max-h-64{max-height:256px}
.song-item{padding:8px 12px;display:flex;align-items:center;gap:10px;cursor:pointer;border-radius:8px;transition:background 0.2s}
.song-item:hover{background:rgba(255,255,255,0.04)}
.voice-btn{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(24,24,28,0.9);border:1px solid rgba(255,255,255,0.06);border-radius:12px;cursor:pointer;width:100%;text-align:left;font-size:13px;color:white}
.voice-btn:hover{border-color:rgba(147,51,234,0.4)}
@media(max-width:640px){
    .chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:12px 12px 0 0;height:100%;max-height:100%}
    .grid-2{grid-template-columns:1fr}
    .ver-nav a{font-size:11px;padding:3px 6px}
}
</style>
</head>
<body>

<!-- Verification Hub Header -->
<header class="ver-header">
<div class="ver-header-inner">
<div class="ver-logo">
<img src="${DATA.celebrity.photo}" alt="" onerror="this.style.display='none'">
<span>Verification Hub</span>
</div>
<nav class="ver-nav">
<a href="#official">Official</a>
<a href="#fake">Fakes</a>
${coverSongs.length ? '<a href="#music">Music</a>' : ''}
</nav>
</div>
</header>

<!-- Main Content -->
<main class="ver-main">

<!-- Profile -->
<div class="card" style="text-align:center">
<div style="position:relative;display:inline-block;margin-bottom:12px">
<img src="${DATA.celebrity.photo}" class="profile-img" onerror="this.style.display='none'">
<div class="verified-badge">
<svg width="12" height="12" viewBox="0 0 20 20" fill="white"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
</div>
<h1 style="font-size:20px;font-weight:800;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">${DATA.celebrity.fullName}</h1>
<p class="text-xs text-gray mb-2">${DATA.celebrity.bio}</p>
<div style="display:flex;justify-content:center;gap:12px;margin-bottom:12px">
<div class="stat-box"><div class="stat-num">${DATA.celebrity.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
<div class="stat-box"><div class="stat-num">${DATA.celebrity.tiktokFollowing}</div><div class="stat-label">Following</div></div>
<div class="stat-box"><div class="stat-num">${DATA.celebrity.tiktokLikes}</div><div class="stat-label">Likes</div></div>
</div>
<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
<span class="badge-green glow-green">✓ Verified Official</span>
<span class="badge-sm" style="background:rgba(147,51,234,0.15);color:#c084fc">Creator</span>
</div>
</div>

<!-- Official Accounts -->
<div id="official" class="card card-green">
<div class="section-title">
<svg width="18" height="18" fill="#4ade80" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
<h2>Official Verified Accounts</h2>
<span class="badge-green">✓ VERIFIED</span>
</div>
<div class="grid-2">
<div>
${realAcc.map(acc => `
<div style="background:rgba(31,31,35,0.8);border-radius:10px;padding:12px;margin-bottom:8px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
<span class="text-xs" style="color:#9ca3af">${acc.platform}</span>
<span class="badge-green">Verified</span>
</div>
<div style="display:flex;align-items:center;gap:8px">
${acc.screenshot ? `<img src="${acc.screenshot}" style="width:40px;height:40px;border-radius:8px;object-fit:cover">` : ''}
<div><div style="color:white;font-weight:600;font-size:13px">${acc.username}</div><div class="text-xs text-gray">${acc.followers} followers</div></div>
</div>
</div>`).join('')}
</div>
<div style="background:rgba(31,31,35,0.8);border-radius:10px;padding:20px" class="flex-center">
<img src="${DATA.celebrity.photo}" style="width:48px;height:48px;border-radius:50%;border:2px solid #22c55e;margin-bottom:8px" onerror="this.style.display='none'">
<div style="color:white;font-weight:600;font-size:14px">@baiillamaach_official</div>
<div class="text-xs text-gray mb-2">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" class="btn btn-green">Follow Official Account</a>
<p class="text-xs text-gray mt-2">⚠️ This is the only authentic account</p>
</div>
</div>
</div>

<!-- Fake Accounts -->
<div id="fake" class="card card-red">
<div class="section-title">
<svg width="18" height="18" fill="#f87171" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
<h2>Fake Accounts Detected</h2>
<span class="badge-sm">${totalFake} Active</span>
</div>
${fakeAcc.map((a, i) => `
<div style="background:rgba(31,31,35,0.8);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden">
<div class="fake-watermark">FAKE</div>
<div style="position:relative;z-index:1">
<div style="display:flex;justify-content:space-between;margin-bottom:8px">
<div style="display:flex;align-items:center;gap:6px"><span class="text-red">⚠</span><span style="color:#f87171;font-weight:600;font-size:13px">Fake Account #${i+1}</span></div>
<span class="badge-sm">${a.threatLevel}</span>
</div>
<div class="grid-2">
<div style="border-radius:10px;overflow:hidden;border:2px solid rgba(239,68,68,0.3)">
${a.screenshot ? `<img src="${a.screenshot}" style="width:100%;display:block;opacity:0.9">` : '<div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:32px;color:rgba(239,68,68,0.3)">FAKE</div>'}
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><span style="background:rgba(239,68,68,0.85);color:white;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:800">FAKE ACCOUNT</span></div>
</div>
<div>
<div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(31,31,35,0.8);border-radius:6px;margin-bottom:4px;font-size:12px"><span class="text-gray">Username</span><span class="text-red">${a.username}</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(31,31,35,0.8);border-radius:6px;margin-bottom:4px;font-size:12px"><span class="text-gray">Reports</span><span class="text-red">${a.reportedCount}+</span></div>
<div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:8px;font-size:11px;color:#f87171">⚠️ ${a.reason}</div>
</div>
</div>
<div style="display:flex;gap:8px;margin-top:12px">
<a href="${a.profileUrl}" target="_blank" class="btn btn-red" style="flex:1;text-align:center">Report Now</a>
<button class="btn-outline" style="flex:1" onclick="navigator.clipboard.writeText('${a.username}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Username',2000)">Copy Username</button>
</div>
</div>
</div>`).join('')}
<button class="voice-btn" onclick="document.getElementById('fv').play()" style="margin-top:12px">
<svg width="18" height="18" fill="#c084fc" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clip-rule="evenodd"/></svg>
🔊 Listen to official voice warning
</button>
<audio id="fv" src="${VOICE.fakeAlert}" preload="none"></audio>
</div>

${coverSongs.length ? `
<div id="music" class="card">
<div class="section-title">
<span style="font-size:18px">🎵</span>
<h2>Cover Music</h2>
<span class="text-xs text-gray" style="margin-left:auto">${coverSongs.length} songs</span>
</div>
<div class="max-h-64 overflow-auto">
${coverSongs.map((s, i) => `
<div class="song-item" onclick="playSong('${s.audioUrl}','${s.title}')">
<span style="color:#6b7280;font-size:12px;width:24px">${(i+1).toString().padStart(2,'0')}</span>
<div style="flex:1"><div style="color:white;font-size:13px;font-weight:500">${s.title}</div><div style="color:#6b7280;font-size:11px">Cover Song</div></div>
<svg width="16" height="16" fill="#4ade80" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
</div>`).join('')}
</div>
</div>` : ''}

</main>

<!-- WhatsApp Chat Widget -->
<div class="wa-widget">
<button class="wa-btn" onclick="toggleChat()" id="waBtn">
<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
<span class="badge" id="badge">0</span>
</button>

<div class="chat-window" id="chatWin">
<div class="wa-top">
<div class="wa-avatar">H<div class="online-dot" id="dot"></div></div>
<div class="wa-top-info">
<div class="wa-top-name">Hammad Bin Amir</div>
<div class="wa-top-status" id="status">Online</div>
</div>
<button class="wa-close" onclick="toggleChat()">✕</button>
</div>

<div id="loginForm" class="wa-login" style="flex:1">
<h3>💬 Chat with Hammad</h3>
<p>Enter your details to start</p>
<input type="text" id="uName" placeholder="Your Name">
<input type="text" id="uContact" placeholder="Phone Number or Email">
<button onclick="register()">Start Chat</button>
</div>

<div id="chatUI" style="display:none;flex:1;flex-direction:column">
<div class="wa-body" id="msgs">
<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">🔒 Messages are secure</div>
</div>
<div class="wa-typing" id="typing">
<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
</div>
<div class="img-preview" id="imgPrev">
<img id="prevImg" src="">
<button class="close-prev" onclick="clearImg()">✕</button>
</div>
<div class="recording-bar" id="recBar">
<span>🔴 Recording...</span><span id="recTime">00:00</span>
</div>
<div class="wa-foot">
<button onclick="document.getElementById('imgInput').click()">🖼</button>
<input type="file" id="imgInput" accept="image/*" style="display:none" onchange="handleImg(event)">
<input type="text" id="msgInput" placeholder="Type a message" onkeypress="if(event.key==='Enter')sendMsg()">
<button id="recBtn" onmousedown="startRec()" onmouseup="stopRec()" onmouseleave="stopRec()">🎤</button>
<button class="wa-send" onclick="sendMsg()">➤</button>
</div>
</div>
</div>
</div>

<div class="viewer" id="viewer" onclick="this.classList.remove('open')">
<span class="close">✕</span>
<img id="viewerImg" src="">
</div>

<audio id="coverAudio" preload="none"></audio>

<script>
let ws=null,token=localStorage.getItem('ct'),chatId=null,selImg=null,mediaRecorder=null,recStart=0,recInt=null;

function toggleChat(){
document.getElementById('chatWin').classList.toggle('open');
if(document.getElementById('chatWin').classList.contains('open')&&!ws)connect();
}

function connect(){
const p=location.protocol==='https:'?'wss:':'ws:';
ws=new WebSocket(p+'//'+location.host+'/ws');
ws.onopen=()=>{document.getElementById('status').textContent='Online';document.getElementById('dot').style.display='block';if(token)ws.send(JSON.stringify({type:'auth',token}))};
ws.onmessage=(e)=>{
const d=JSON.parse(e.data);
if(d.type==='auth_success'){showUI();loadMsgs()}
else if(d.type==='message')addMsg(d.message,d.sender,d.msgType||'text',d.mediaUrl,d.duration,d.timestamp)
else if(d.type==='typing'){document.getElementById('typing').style.display=d.isTyping?'block':'none';document.getElementById('status').textContent=d.isTyping?'typing...':'Online';scrollB()}
};
ws.onclose=()=>{document.getElementById('status').textContent='Offline';document.getElementById('dot').style.display='none';setTimeout(connect,3000)};
}

async function register(){
const n=document.getElementById('uName').value.trim();
const c=document.getElementById('uContact').value.trim();
if(!n||!c){alert('Please fill all fields');return}
try{
const r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,contact:c})});
const d=await r.json();
if(d.success){token=d.sessionToken;chatId=d.chatId;localStorage.setItem('ct',token);showUI();if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'auth',token}));else connect()}
else alert(d.error||'Error')
}catch(e){alert('Connection error')}
}

function showUI(){
document.getElementById('loginForm').style.display='none';
document.getElementById('chatUI').style.display='flex';
}

function sendMsg(){
const i=document.getElementById('msgInput');
const m=i.value.trim();
if(!m&&!selImg)return;
if(selImg){ws.send(JSON.stringify({type:'message',token,message:m||'🖼 Image',msgType:'image',mediaUrl:selImg}));clearImg()}
else ws.send(JSON.stringify({type:'message',token,message:m,msgType:'text'}));
i.value='';i.focus()
}

function addMsg(text,sender,type,mediaUrl,duration,timestamp){
const c=document.getElementById('msgs');
const t=new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const a=sender==='user'?'wa-msg wa-msg-out':'wa-msg wa-msg-in';
let h='';
if(type==='image')h='<div class="'+a+'"><img src="'+mediaUrl+'" class="wa-msg-img" onclick="document.getElementById(\'viewerImg\').src=\''+mediaUrl+'\';document.getElementById(\'viewer\').classList.add(\'open\')"><span class="wa-msg-time">'+t+' ✓✓</span></div>';
else if(type==='voice')h='<div class="'+a+'"><div style="display:flex;align-items:center;gap:8px"><button onclick="new Audio(\''+mediaUrl+'\').play()" style="width:28px;height:28px;border-radius:50%;background:#00a884;border:none;color:white;cursor:pointer">▶</button><span>🎤 '+(duration||0)+'s</span></div><span class="wa-msg-time">'+t+'</span></div>';
else h='<div class="'+a+'">'+text+'<span class="wa-msg-time">'+t+' '+(sender==='user'?'✓✓':'')+'</span></div>';
const d=document.createElement('div');d.style.clear='both';d.style.marginBottom='4px';d.innerHTML=h;c.appendChild(d);scrollB()
}

function handleImg(e){
const f=e.target.files[0];if(!f)return;
const r=new FileReader();
r.onload=(ev)=>{selImg=ev.target.result;document.getElementById('prevImg').src=selImg;document.getElementById('imgPrev').style.display='block'};
r.readAsDataURL(f)
}

function clearImg(){selImg=null;document.getElementById('imgPrev').style.display='none';document.getElementById('imgInput').value=''}

async function startRec(){
try{
const s=await navigator.mediaDevices.getUserMedia({audio:true});
mediaRecorder=new MediaRecorder(s);const chunks=[];
mediaRecorder.ondataavailable=e=>chunks.push(e.data);
mediaRecorder.onstop=()=>{
const b=new Blob(chunks,{type:'audio/webm'});const r=new FileReader();
r.onload=()=>{const d=Math.floor((Date.now()-recStart)/1000);ws.send(JSON.stringify({type:'message',token,message:'🎤 Voice',msgType:'voice',mediaUrl:r.result,duration:d}))};
r.readAsDataURL(b);s.getTracks().forEach(t=>t.stop())
};
mediaRecorder.start();recStart=Date.now();
document.getElementById('recBtn').classList.add('recording');
document.getElementById('recBar').style.display='flex';
recInt=setInterval(()=>{const e=Math.floor((Date.now()-recStart)/1000);document.getElementById('recTime').textContent=Math.floor(e/60).toString().padStart(2,'0')+':'+(e%60).toString().padStart(2,'0')},1000)
}catch(e){}
}

function stopRec(){
if(!mediaRecorder||mediaRecorder.state==='inactive')return;
mediaRecorder.stop();
document.getElementById('recBtn').classList.remove('recording');
document.getElementById('recBar').style.display='none';
clearInterval(recInt)
}

async function loadMsgs(){
try{
const r=await fetch('/api/messages?token='+token);
const d=await r.json();
if(d.success){document.getElementById('msgs').innerHTML='<div style="text-align:center;color:#8696a0;font-size:12px;padding:10px">🔒 Messages are secure</div>';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type||'text',m.mediaUrl,m.duration,m.createdAt))}
}catch(e){}
}

function scrollB(){const c=document.getElementById('msgs');setTimeout(()=>c.scrollTop=c.scrollHeight,100)}

function playSong(url,title){const a=document.getElementById('coverAudio');a.src=url;a.play().catch(()=>{});if(title)document.title=title}

let tTO;
document.getElementById('msgInput')?.addEventListener('input',()=>{
if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'typing',isTyping:true,token}));clearTimeout(tTO);tTO=setTimeout(()=>ws.send(JSON.stringify({type:'typing',isTyping:false,token})),2000)}
});

if(token)setTimeout(connect,1000);
</script>
</body>
</html>`;
}

// Admin Panel
async function getAdminHTML() {
    const users = await getAllUsers();
    const usersInfo = [];
    for (const u of users) {
        const last = await getLastMessage(u.chatId);
        const unread = await getUnreadCount(u.chatId);
        usersInfo.push({...u, lastMessage:last, unread});
    }
    
    const userList = usersInfo.map(u => `
<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--wa-input);transition:background 0.2s" 
     onclick="openChat('${u.chatId}','${u.name.replace(/'/g,"\\'")}')">
<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
<span style="color:white;font-weight:700;font-size:18px">${u.name.charAt(0).toUpperCase()}</span>
</div>
<div style="flex:1;min-width:0">
<div style="display:flex;justify-content:space-between">
<span style="color:white;font-weight:500;font-size:14px">${u.name}</span>
<span style="color:var(--wa-gray);font-size:11px">${u.lastMessage?new Date(u.lastMessage.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</span>
</div>
<div style="display:flex;justify-content:space-between;margin-top:3px">
<span style="color:var(--wa-gray);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.lastMessage?u.lastMessage.message.substring(0,30):'No messages'}</span>
${u.unread>0?`<span style="background:var(--wa-green);color:white;border-radius:50%;width:20px;height:20px;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${u.unread}</span>`:''}
</div>
</div>
</div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Admin - Hammad Chat</title>
<style>
:root{--wa-dark:#0b141a;--wa-darker:#111b21;--wa-header:#202c33;--wa-input:#2a3942;--wa-out:#005c4b;--wa-in:#202c33;--wa-green:#00a884;--wa-light:#e9edef;--wa-gray:#8696a0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:var(--wa-darker);height:100vh;display:flex}
.sidebar{width:380px;background:var(--wa-darker);border-right:1px solid var(--wa-input);display:flex;flex-direction:column}
.main{flex:1;display:flex;flex-direction:column;background:#222e35}
.top{background:var(--wa-header);padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
.chats{flex:1;overflow-y:auto}
.msg-area{flex:1;overflow-y:auto;padding:16px;background-color:var(--wa-dark);background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.msg{max-width:70%;padding:6px 12px 6px 9px;margin-bottom:4px;border-radius:8px;font-size:14px;line-height:1.45}
.msg-out{background:var(--wa-out);color:var(--wa-light);float:right;clear:both;border-radius:8px 0 8px 8px}
.msg-in{background:var(--wa-in);color:var(--wa-light);float:left;clear:both;border-radius:0 8px 8px 8px}
.msg-time{font-size:11px;color:rgba(255,255,255,0.45);text-align:right;margin-top:3px}
.foot{background:var(--wa-header);padding:10px 16px;display:flex;align-items:center;gap:8px}
.foot input{flex:1;background:var(--wa-input);border:none;padding:10px 16px;border-radius:24px;color:white;font-size:14px;outline:none}
.foot button{width:40px;height:40px;border-radius:50%;background:var(--wa-green);border:none;color:white;cursor:pointer;font-size:18px}
.typing-dot{width:8px;height:8px;border-radius:50%;background:var(--wa-gray);animation:td 1.4s infinite;display:inline-block;margin:0 2px}
.typing-dot:nth-child(2){animation-delay:0.2s}.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes td{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
</style>
</head>
<body>
<div class="sidebar">
<div class="top">
<h1 style="color:white;font-weight:600;font-size:18px">💬 Chats</h1>
<div style="display:flex;gap:8px">
<a href="/" style="color:var(--wa-gray);text-decoration:none;font-size:13px">Site</a>
<a href="/admin/logout" style="color:var(--wa-gray);text-decoration:none;font-size:13px">Logout</a>
</div>
</div>
<div class="chats">${userList||'<div style="color:var(--wa-gray);text-align:center;padding:40px 0">No users yet</div>'}</div>
</div>
<div class="main" id="main">
<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--wa-gray)">
<div style="text-align:center">
<svg width="80" height="80" fill="currentColor" opacity="0.3"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
<p style="font-size:18px;margin-top:12px">Select a chat</p>
</div>
</div>
</div>
<script>
let ws,cid=null;
function connectAdmin(){
const p=location.protocol==='https:'?'wss:':'ws:';
ws=new WebSocket(p+'//'+location.host+'/admin/ws');
ws.onmessage=(e)=>{
const d=JSON.parse(e.data);
if(d.type==='new_message'&&d.chatId===cid)addMsg(d.message,d.sender,d.msgType,d.mediaUrl,d.duration,d.timestamp);
if(d.type==='user_typing'&&d.chatId===cid){const ti=document.getElementById('ti');if(ti)ti.style.display=d.isTyping?'block':'none'}
};
}
async function openChat(id,name){
cid=id;
document.getElementById('main').innerHTML=
'<div class="top"><div style="display:flex;align-items:center;gap:10px"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center"><span style="color:white;font-weight:700">'+name.charAt(0)+'</span></div><div style="color:white;font-weight:500">'+name+'</div></div></div>'+
'<div class="msg-area" id="ma"><div id="ml"></div><div id="ti" style="display:none;float:left;clear:both;margin-top:8px"><div class="msg msg-in" style="padding:10px 14px"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div><div style="clear:both"></div></div>'+
'<div class="foot"><input type="text" id="ai" placeholder="Type a message" onkeypress="if(event.key===\\'Enter\\')sendAdmin()"><button onclick="sendAdmin()">➤</button></div>';
const r=await fetch('/api/admin/messages?chatId='+id);
const d=await r.json();
if(d.success){document.getElementById('ml').innerHTML='';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt));scrollB()}
}
function addMsg(text,sender,type,mediaUrl,duration,timestamp){
const c=document.getElementById('ml');if(!c)return;
const t=new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const a=sender==='user'?'msg msg-in':'msg msg-out';
let h='';
if(type==='image')h='<div class="'+a+'"><img src="'+mediaUrl+'" style="max-width:220px;border-radius:6px;cursor:pointer" onclick="window.open(\\''+mediaUrl+'\\')"><div class="msg-time">'+t+'</div></div>';
else if(type==='voice')h='<div class="'+a+'"><div style="display:flex;align-items:center;gap:8px"><button onclick="new Audio(\\''+mediaUrl+'\\').play()" style="width:28px;height:28px;border-radius:50%;background:#00a884;border:none;color:white;cursor:pointer">▶</button><span>🎤 '+(duration||0)+'s</span></div><div class="msg-time">'+t+'</div></div>';
else h='<div class="'+a+'">'+text+'<div class="msg-time">'+t+'</div></div>';
const d=document.createElement('div');d.style.clear='both';d.style.marginBottom='4px';d.innerHTML=h;c.appendChild(d);scrollB()
}
function scrollB(){const c=document.getElementById('ma');if(c)setTimeout(()=>c.scrollTop=c.scrollHeight,100)}
async function sendAdmin(){
const i=document.getElementById('ai');const m=i.value.trim();if(!m)return;i.value='';
if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'admin_message',chatId:cid,message:m}));
await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:cid,message:m})});
addMsg(m,'admin','text',null,null,new Date().toISOString())
}
connectAdmin();
setInterval(()=>{if(cid)fetch('/api/admin/messages?chatId='+cid).then(r=>r.json()).then(d=>{if(d.success){document.getElementById('ml').innerHTML='';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt))}})},5000);
</script>
</body>
</html>`;
}

// WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
const userConns = new Map();
const adminConns = new Set();

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
                        userConns.set(user.chatId, ws);
                        ws.send(JSON.stringify({ type: 'auth_success' }));
                        setTimeout(async () => {
                            await saveMessage(user.chatId, 'admin', 'Hello! 👋 How can I help you today?');
                            ws.send(JSON.stringify({ type: 'message', message: 'Hello! 👋 How can I help you today?', sender: 'admin', msgType: 'text', timestamp: new Date().toISOString() }));
                            notifyAdmin({ type: 'new_message', chatId: user.chatId, name: user.name, message: 'Hello! 👋 How can I help you today?', sender: 'admin' });
                        }, 1000);
                    }
                } else if (data.type === 'message' && userData) {
                    await saveMessage(userData.chatId, 'user', data.message, data.msgType || 'text', data.mediaUrl, data.duration);
                    ws.send(JSON.stringify({ type: 'message', message: data.message, sender: 'user', msgType: data.msgType, mediaUrl: data.mediaUrl, duration: data.duration, timestamp: new Date().toISOString() }));
                    notifyAdmin({ type: 'new_message', chatId: userData.chatId, name: userData.name, message: data.message, sender: 'user', msgType: data.msgType, mediaUrl: data.mediaUrl, duration: data.duration, timestamp: new Date().toISOString() });
                } else if (data.type === 'typing' && userData) {
                    notifyAdmin({ type: 'user_typing', chatId: userData.chatId, isTyping: data.isTyping });
                }
            } catch (e) {}
        });
        ws.on('close', () => { if (userData) userConns.delete(userData.chatId); });
    } else if (pathname === '/admin/ws') {
        adminConns.add(ws);
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'admin_message') {
                    await saveMessage(data.chatId, 'admin', data.message);
                    const userWs = userConns.get(data.chatId);
                    if (userWs && userWs.readyState === 1) {
                        userWs.send(JSON.stringify({ type: 'message', message: data.message, sender: 'admin', msgType: 'text', timestamp: new Date().toISOString() }));
                    }
                }
            } catch (e) {}
        });
        ws.on('close', () => adminConns.delete(ws));
    }
});

function notifyAdmin(data) {
    adminConns.forEach(ws => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); });
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
    
    // API Routes
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, contact } = JSON.parse(body);
                if (!name || !contact) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'All fields required' })); return; }
                const user = await findOrCreateUser(name, contact);
                const sessionToken = await createSession(user.chatId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, sessionToken }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
        });
        return;
    }
    
    if (pathname === '/api/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        const user = await getUserByToken(token);
        if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const messages = await getMessages(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    // Admin
    if (pathname === '/admin' && method === 'GET') {
        if (cookies.sessionId && adminSessions.has(cookies.sessionId)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(await getAdminHTML());
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>body{background:#111b21;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:#202c33;border-radius:12px;padding:30px;width:320px}h2{color:white;text-align:center;margin-bottom:20px}input{width:100%;padding:12px;margin-bottom:10px;background:#2a3942;border:none;border-radius:8px;color:white;font-size:16px;outline:none;box-sizing:border-box}button{width:100%;padding:14px;background:#00a884;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#06cf9c}</style></head><body><div class="box"><h2>Admin Login</h2><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
        return;
    }
    
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            const p = new URLSearchParams(body);
            if (p.get('username') === 'Hammad' && p.get('password') === 'Hammad1122@') {
                const sid = crypto.randomBytes(32).toString('hex');
                adminSessions.set(sid, { username: 'Hammad' });
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=86400` });
                res.end();
            } else { res.writeHead(302, { 'Location': '/admin?error=1' }); res.end(); }
        });
        return;
    }
    
    if (pathname === '/admin/logout') {
        adminSessions.delete(cookies.sessionId);
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' });
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
        req.on('data', c => body += c);
        req.on('end', async () => {
            const { chatId, message } = JSON.parse(body);
            await saveMessage(chatId, 'admin', message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getMainHTML());
        return;
    }
    
    res.writeHead(404);
    res.end('404');
});

// WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
    const p = url.parse(req.url).pathname;
    if (p === '/ws' || p === '/admin/ws') {
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else { socket.destroy(); }
});

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; });
    return c;
}

async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('Server running on port', PORT);
        console.log('Admin: /admin | Login: Hammad / Hammad1122@');
    });
}

start();

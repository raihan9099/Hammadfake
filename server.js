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
    official: "/assets/orginalss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    flag: "/assets/flag.png",
    fakedetect: "/assets/Fakedetect .png",
    communication: "/assets/communication.png",
    realId: "/assets/real-id-ss.png",
    report: "/assets/report.png",
    socialMedia: "/assets/social-media.png",
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    microphone: "/assets/microphone-in-hand.gif"
};

const VOICE = {
    welcome: "/assets/realvoice.mp3",
    fakeAlert: "/assets/7 lak like but its fake.mp3"
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

// Generate Main HTML with White Light Mode Premium Theme
function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en" class="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ffffff">
<title>Baiilla Maach Official | Premium Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={
  theme:{
    extend:{
      colors:{
        primary:{
          50:'#f0f7ff',
          100:'#e0effe',
          200:'#b9dffd',
          300:'#7cc5fc',
          400:'#36aaf8',
          500:'#0c8ee9',
          600:'#0070c7',
          700:'#0159a1',
          800:'#064b85',
          900:'#0b3f6e'
        },
        premium:{
          gold:'#f59e0b',
          silver:'#94a3b8',
          platinum:'#8b5cf6'
        },
        surface:{
          50:'#fafafa',
          100:'#f4f4f5',
          200:'#e4e4e7',
          300:'#d4d4d8',
          400:'#a1a1aa',
          500:'#71717a',
          600:'#52525b',
          700:'#3f3f46',
          800:'#27272a',
          900:'#18181b'
        }
      },
      fontFamily:{
        sans:['Inter','sans-serif'],
        display:['Plus Jakarta Sans','sans-serif']
      },
      animation:{
        'fade-in':'fadeIn 0.5s ease-out',
        'slide-up':'slideUp 0.5s ease-out',
        'bounce-in':'bounceIn 0.5s',
        'typing-dot':'typingDot 1.4s infinite',
        'pulse-rec':'pulseRec 1s infinite',
        'float':'float 3s ease-in-out infinite',
        'shimmer':'shimmer 2s infinite',
        'glow-pulse':'glowPulse 2s ease-in-out infinite'
      },
      keyframes:{
        fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},
        slideUp:{'0%':{transform:'translateY(20px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}},
        bounceIn:{'0%':{transform:'scale(0.3)',opacity:'0'},'50%':{transform:'scale(1.05)'},'70%':{transform:'scale(0.9)'},'100%':{transform:'scale(1)',opacity:'1'}},
        typingDot:{'0%,60%,100%':{transform:'translateY(0)'},'30%':{transform:'translateY(-10px)'}},
        pulseRec:{'0%,100%':{opacity:'1'},'50%':{opacity:'0.5'}},
        float:{'0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-10px)'}},
        shimmer:{'0%':{backgroundPosition:'-200% center'},'100%':{backgroundPosition:'200% center'}},
        glowPulse:{'0%,100%':{boxShadow:'0 0 20px rgba(12,142,233,0.3)'},'50%':{boxShadow:'0 0 40px rgba(12,142,233,0.6)'}}
      }
    }
  }
}
</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'Inter',sans-serif;
  background: linear-gradient(135deg, #fafafa 0%, #f0f7ff 50%, #fafafa 100%);
  color:#18181b;
  min-height:100vh;
  overflow-x:hidden;
  line-height:1.6;
}

/* Premium Scrollbar */
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:#f4f4f5;border-radius:10px}
::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#0c8ee9,#8b5cf6);border-radius:10px}
::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#0070c7,#7c3aed)}

/* Premium Cards */
.premium-card{
  background:white;
  border:1px solid rgba(12,142,233,0.1);
  border-radius:20px;
  box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -2px rgba(0,0,0,0.05),0 0 0 1px rgba(12,142,233,0.05);
  transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.premium-card:hover{
  transform:translateY(-2px);
  box-shadow:0 20px 25px -5px rgba(0,0,0,0.08),0 8px 10px -6px rgba(0,0,0,0.05),0 0 0 1px rgba(12,142,233,0.1);
}

/* Glass Effect */
.glass-white{
  background:rgba(255,255,255,0.8);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,0.9);
}

/* Gradient Text */
.gradient-text{
  background:linear-gradient(135deg,#0c8ee9 0%,#8b5cf6 50%,#f59e0b 100%);
  background-size:200% auto;
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  animation:gradientShift 3s ease infinite;
}
@keyframes gradientShift{
  0%,100%{background-position:left center}
  50%{background-position:right center}
}

/* Verified Badge */
.verified-badge{
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  color:white;
  padding:4px 10px;
  border-radius:20px;
  font-size:12px;
  font-weight:600;
  display:inline-flex;
  align-items:center;
  gap:4px;
  box-shadow:0 4px 12px rgba(12,142,233,0.3);
}

/* Blue Tick */
.blue-tick{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:20px;
  height:20px;
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  border-radius:50%;
  margin-left:6px;
  box-shadow:0 0 10px rgba(12,142,233,0.4);
}
.blue-tick svg{
  width:12px;
  height:12px;
  fill:white;
}

/* Premium Buttons */
.btn-premium{
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  color:white;
  border:none;
  padding:12px 24px;
  border-radius:12px;
  font-weight:600;
  cursor:pointer;
  transition:all 0.3s ease;
  box-shadow:0 4px 12px rgba(12,142,233,0.2);
}
.btn-premium:hover{
  transform:translateY(-2px);
  box-shadow:0 8px 20px rgba(12,142,233,0.3);
}

/* Animations */
.animate-float{
  animation:float 3s ease-in-out infinite;
}

/* Input Fields */
.input-premium{
  width:100%;
  padding:12px 16px;
  border:2px solid #e4e4e7;
  border-radius:12px;
  font-size:14px;
  transition:all 0.3s ease;
  background:white;
}
.input-premium:focus{
  outline:none;
  border-color:#0c8ee9;
  box-shadow:0 0 0 3px rgba(12,142,233,0.1);
}

/* WhatsApp Widget - Light Theme */
.whatsapp-widget{position:fixed;bottom:24px;right:24px;z-index:9999}
.whatsapp-btn{
  width:64px;
  height:64px;
  background:linear-gradient(135deg,#25d366,#128c7e);
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 8px 24px rgba(37,211,102,0.3);
  transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation:bounceIn 0.5s;
}
.whatsapp-btn:hover{
  transform:scale(1.1) rotate(10deg);
  box-shadow:0 12px 32px rgba(37,211,102,0.4);
}
.whatsapp-btn svg{width:36px;height:36px;fill:white}
.notification-badge{
  position:absolute;
  top:-5px;
  right:-5px;
  background:#ef4444;
  color:white;
  border-radius:50%;
  width:24px;
  height:24px;
  font-size:12px;
  font-weight:bold;
  display:none;
  align-items:center;
  justify-content:center;
  border:2px solid white;
}

.chat-window{
  position:fixed;
  bottom:100px;
  right:24px;
  width:400px;
  max-width:calc(100vw - 48px);
  height:600px;
  max-height:calc(100vh - 140px);
  background:white;
  border-radius:20px;
  overflow:hidden;
  box-shadow:0 20px 60px rgba(0,0,0,0.15);
  display:none;
  flex-direction:column;
  animation:slideUp 0.3s ease-out;
  border:1px solid rgba(0,0,0,0.05);
}
.chat-window.open{display:flex}

/* Chat Header */
.chat-header{
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  padding:20px;
  display:flex;
  align-items:center;
  gap:12px;
  color:white;
}
.chat-avatar{
  width:48px;
  height:48px;
  border-radius:50%;
  background:linear-gradient(135deg,#f59e0b,#fbbf24);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:bold;
  color:white;
  font-size:20px;
  position:relative;
}
.online-dot{
  width:12px;
  height:12px;
  background:#22c55e;
  border-radius:50%;
  position:absolute;
  bottom:2px;
  right:2px;
  border:2px solid white;
}

/* Chat Messages */
.chat-messages{
  flex:1;
  overflow-y:auto;
  padding:20px;
  background:#fafafa;
}
.msg-bubble{
  max-width:75%;
  padding:10px 16px;
  margin-bottom:8px;
  border-radius:16px;
  font-size:14px;
  line-height:1.5;
  position:relative;
  word-wrap:break-word;
  animation:messageIn 0.3s ease-out;
}
@keyframes messageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-out{
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  color:white;
  float:right;
  clear:both;
  border-bottom-right-radius:4px;
}
.msg-in{
  background:white;
  color:#18181b;
  float:left;
  clear:both;
  border-bottom-left-radius:4px;
  box-shadow:0 1px 2px rgba(0,0,0,0.05);
}
.msg-time{
  font-size:11px;
  opacity:0.7;
  text-align:right;
  margin-top:4px;
}

/* Chat Input */
.chat-input-area{
  background:white;
  padding:16px;
  display:flex;
  align-items:center;
  gap:8px;
  border-top:1px solid #f4f4f5;
}
.chat-input-area input{
  flex:1;
  background:#f4f4f5;
  border:2px solid transparent;
  padding:12px 16px;
  border-radius:24px;
  font-size:14px;
  outline:none;
  transition:all 0.3s ease;
}
.chat-input-area input:focus{
  border-color:#0c8ee9;
  background:white;
}
.send-btn{
  width:44px;
  height:44px;
  border-radius:50%;
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  border:none;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition:all 0.3s ease;
  box-shadow:0 4px 12px rgba(12,142,233,0.3);
}
.send-btn:hover{
  transform:scale(1.05);
  box-shadow:0 8px 20px rgba(12,142,233,0.4);
}

/* Section Headers */
.section-header{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:20px;
}
.section-icon{
  width:40px;
  height:40px;
  border-radius:12px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:20px;
}

/* Profile Section */
.profile-container{
  text-align:center;
  padding:40px 20px;
}
.profile-image{
  width:100px;
  height:100px;
  border-radius:50%;
  border:3px solid white;
  box-shadow:0 8px 32px rgba(12,142,233,0.2);
  object-fit:cover;
  margin-bottom:16px;
}
.profile-image-wrapper{
  position:relative;
  display:inline-block;
  margin-bottom:16px;
}
.verification-check{
  position:absolute;
  bottom:8px;
  right:8px;
  width:28px;
  height:28px;
  background:linear-gradient(135deg,#0c8ee9,#0070c7);
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  border:3px solid white;
  box-shadow:0 4px 12px rgba(12,142,233,0.4);
}

/* Stats Cards */
.stat-card{
  background:white;
  border-radius:16px;
  padding:16px;
  text-align:center;
  box-shadow:0 2px 8px rgba(0,0,0,0.05);
}
.stat-number{
  font-size:24px;
  font-weight:700;
  background:linear-gradient(135deg,#0c8ee9,#8b5cf6);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}

/* Tags */
.premium-tag{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:6px 16px;
  border-radius:20px;
  font-size:12px;
  font-weight:600;
}
.tag-verified{
  background:linear-gradient(135deg,rgba(12,142,233,0.1),rgba(0,112,199,0.1));
  color:#0c8ee9;
  border:1px solid rgba(12,142,233,0.2);
}
.tag-creator{
  background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(124,58,237,0.1));
  color:#8b5cf6;
  border:1px solid rgba(139,92,246,0.2);
}
.tag-danger{
  background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.1));
  color:#ef4444;
  border:1px solid rgba(239,68,68,0.2);
}

/* Header */
.main-header{
  position:fixed;
  top:0;
  left:0;
  right:0;
  z-index:40;
  background:rgba(255,255,255,0.9);
  backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(0,0,0,0.05);
  transition:transform 0.3s ease;
}
.header-hidden{transform:translateY(-100%)}

/* Responsive */
@media(max-width:768px){
  .chat-window{
    width:100%;
    max-width:100%;
    bottom:0;
    right:0;
    border-radius:0;
    height:100%;
    max-height:100%;
  }
  .profile-container{padding:20px 12px}
}
</style>
</head>
<body class="min-h-screen">

<!-- Main Header -->
<header id="mainHeader" class="main-header">
<div class="max-w-6xl mx-auto px-4">
<div class="flex items-center justify-between h-16">
<div class="flex items-center gap-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-10 h-10 rounded-full border-2 border-primary-500 object-cover shadow-lg" onerror="this.style.display='none'">
<div class="flex items-center gap-2">
<span class="text-lg font-bold font-display gradient-text">Verification Hub</span>
<div class="blue-tick">
<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
</div>
</div>
</div>
<nav class="flex items-center gap-2">
<a href="#official" class="px-4 py-2 text-sm font-medium text-surface-600 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-all">Official</a>
<a href="#fake" class="px-4 py-2 text-sm font-medium text-surface-600 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">Fake Alerts</a>
${coverSongs.length > 0 ? '<a href="#music" class="px-4 py-2 text-sm font-medium text-surface-600 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 transition-all">Music</a>' : ''}
<a href="#report" class="px-4 py-2 text-sm font-medium text-surface-600 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-all">Report</a>
</nav>
</div>
</div>
</header>

<main class="pt-20 pb-24">
<div class="max-w-6xl mx-auto px-4">

<!-- Profile Section -->
<section class="profile-container animate-fade-in">
<div class="profile-image-wrapper">
<img src="${DATA.celebrity.photo}" alt="" class="profile-image" onerror="this.style.display='none'">
<div class="verification-check">
<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
</div>
</div>
<h1 class="text-2xl font-bold font-display mb-1 flex items-center justify-center gap-2">
${DATA.celebrity.fullName}
<span class="blue-tick" style="width:24px;height:24px;">
<svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/></svg>
</span>
</h1>
<p class="text-surface-500 text-sm mb-6">${DATA.celebrity.bio}</p>

<div class="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
<div class="stat-card">
<div class="stat-number">${DATA.celebrity.tiktokFollowers}</div>
<div class="text-xs text-surface-500 font-medium">Followers</div>
</div>
<div class="stat-card">
<div class="stat-number">${DATA.celebrity.tiktokFollowing}</div>
<div class="text-xs text-surface-500 font-medium">Following</div>
</div>
<div class="stat-card">
<div class="stat-number">${DATA.celebrity.tiktokLikes}</div>
<div class="text-xs text-surface-500 font-medium">Likes</div>
</div>
</div>

<div class="flex justify-center gap-3 flex-wrap mb-6">
<span class="premium-tag tag-verified">
<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
Verified Official
</span>
<span class="premium-tag tag-creator">
<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
Premium Creator
</span>
</div>

<div class="flex justify-center gap-3">
<a href="${realAcc[0].url}" target="_blank" class="btn-premium flex items-center gap-2">
<img src="${IMAGES.tiktokIcon}" alt="" class="w-5 h-5" onerror="this.style.display='none'">
TikTok
</a>
<a href="${realAcc[1].url}" target="_blank" class="btn-premium flex items-center gap-2" style="background:linear-gradient(135deg,#1877f2,#0c5dc7)">
<svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
Facebook
</a>
</div>
</section>

<!-- Official Account Section -->
<section id="official" class="py-8 animate-slide-up">
<div class="section-header">
<div class="section-icon" style="background:linear-gradient(135deg,rgba(12,142,233,0.1),rgba(0,112,199,0.1))">
<svg width="20" height="20" viewBox="0 0 24 24" fill="#0c8ee9"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
</div>
<div>
<h2 class="text-xl font-bold font-display">Official Verified Account</h2>
<p class="text-sm text-surface-500">The only authentic profile</p>
</div>
</div>

<div class="premium-card p-6">
<div class="flex items-center gap-2 mb-6">
<span class="verified-badge">
<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
VERIFIED
</span>
<span class="text-sm text-surface-500">Confirmed by our team</span>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
<div class="lg:col-span-2 space-y-4">
${realAcc.map(acc => `
<div class="bg-surface-50 rounded-2xl p-4 border border-surface-200">
<div class="flex items-center justify-between mb-3">
<div class="flex items-center gap-2">
<span class="font-semibold text-sm">${acc.platform}</span>
<img src="${IMAGES.socialMedia}" alt="" class="w-4 h-4" onerror="this.style.display='none'">
</div>
<span class="px-3 py-1 bg-green-100 text-green-600 text-xs rounded-full font-medium">Verified ✓</span>
</div>
<div class="flex items-center gap-3">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-16 h-16 rounded-xl object-cover border-2 border-surface-200">` : '<div class="w-16 h-16 rounded-xl bg-surface-200 flex items-center justify-center text-2xl font-bold text-surface-400">' + acc.platform[0] + '</div>'}
<div>
<div class="font-bold text-surface-800 flex items-center gap-1">
${acc.username}
<span class="blue-tick" style="width:16px;height:16px;">
<svg width="10" height="10" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/></svg>
</span>
</div>
<div class="text-sm text-surface-500">${acc.platform} • ${acc.followers} followers</div>
</div>
</div>
</div>`).join('')}
</div>

<div class="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center border border-primary-200">
<img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-white shadow-lg mb-3" onerror="this.style.display='none'">
<div class="font-bold text-surface-800 flex items-center gap-1 justify-center">
@baiillamaach_official
<span class="blue-tick">
<svg width="12" height="12" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/></svg>
</span>
</div>
<div class="text-sm text-surface-500 mb-4">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" class="btn-premium w-full justify-center flex">
<svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
Follow Official Account
</a>
<p class="text-xs text-surface-400 mt-4 flex items-center gap-1">
<img src="${IMAGES.communication}" alt="" class="w-4 h-4" onerror="this.style.display='none'">
This is the only authentic account
</p>
</div>
</div>
</div>
</section>

<!-- Fake Accounts Section -->
<section id="fake" class="py-8 animate-slide-up">
<div class="section-header">
<div class="section-icon" style="background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.1))">
<svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
</div>
<div>
<h2 class="text-xl font-bold font-display">Fake Accounts Detected</h2>
<p class="text-sm text-surface-500">Help us report these impersonators</p>
</div>
<span class="premium-tag tag-danger" style="margin-left:auto">
${totalFake} Active Threats
</span>
</div>

<div class="space-y-4">
${fakeAcc.map((a, i) => `
<div class="premium-card p-5 border-l-4 border-l-red-500">
<div class="flex items-center justify-between mb-3">
<div class="flex items-center gap-2">
<span class="text-red-500 text-lg">⚠️</span>
<span class="font-bold text-red-600">Fake Account #${i+1}</span>
</div>
<span class="premium-tag tag-danger">${a.threatLevel} Threat</span>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div class="relative rounded-xl overflow-hidden border-2 border-red-200 bg-red-50">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full opacity-90">` : '<div class="w-full h-48 flex items-center justify-center text-4xl text-red-300">⚠️</div>'}
<div class="absolute inset-0 flex items-center justify-center bg-red-500/10">
<span class="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">FAKE ACCOUNT</span>
</div>
</div>

<div class="space-y-2">
<div class="flex justify-between bg-surface-50 rounded-xl px-4 py-3">
<span class="text-surface-500 text-sm">Platform</span>
<span class="text-red-600 font-medium">${a.platform}</span>
</div>
<div class="flex justify-between bg-surface-50 rounded-xl px-4 py-3">
<span class="text-surface-500 text-sm">Username</span>
<span class="text-red-600 font-medium">${a.username}</span>
</div>
<div class="flex justify-between bg-surface-50 rounded-xl px-4 py-3">
<span class="text-surface-500 text-sm">Reports</span>
<span class="text-red-600 font-medium">${a.reportedCount}+ Reports</span>
</div>
<div class="bg-red-50 rounded-xl p-3 text-sm text-red-600 border border-red-100">
<img src="${IMAGES.communication}" alt="" class="w-4 h-4 inline mr-1" onerror="this.style.display='none'">
${a.reason}
</div>
</div>
</div>

<div class="flex gap-3 mt-4">
<a href="${a.profileUrl}" target="_blank" class="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
<img src="${IMAGES.report}" alt="" class="w-4 h-4" onerror="this.style.display='none'">
Report Account
</a>
<button onclick="navigator.clipboard.writeText('${a.username}')" class="px-6 py-3 bg-surface-100 border border-surface-200 text-surface-700 rounded-xl font-semibold hover:bg-surface-200 transition-all flex items-center gap-2">
<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
Copy Username
</button>
</div>
</div>`).join('')}
</div>

<div class="text-center mt-6">
<button onclick="document.getElementById('fakeVoice').play()" class="btn-premium flex items-center gap-2 mx-auto" style="background:linear-gradient(135deg,#ef4444,#dc2626)">
<img src="${IMAGES.microphone}" alt="" class="w-5 h-5" onerror="this.style.display='none'">
🔊 Listen to Voice Alert
</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

<!-- Report Section -->
<section id="report" class="py-8 animate-slide-up">
<div class="section-header">
<div class="section-icon" style="background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(217,119,6,0.1))">
<svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>
</div>
<div>
<h2 class="text-xl font-bold font-display">Report Fake Accounts</h2>
<p class="text-sm text-surface-500">Help keep the community safe</p>
</div>
</div>

<div class="premium-card p-6">
<div class="text-center mb-6">
<img src="${IMAGES.flag}" alt="" class="w-24 h-24 mx-auto mb-3" onerror="this.style.display='none'">
<p class="text-surface-600">If you find any fake accounts impersonating Baiilla Maach, report them immediately.</p>
</div>

<div class="flex flex-wrap gap-3 justify-center">
<a href="${fakeAcc[0].profileUrl}" target="_blank" class="btn-premium flex items-center gap-2">
<img src="${IMAGES.fakedetect}" alt="" class="w-5 h-5" onerror="this.style.display='none'">
Report on TikTok
</a>
<button class="btn-premium flex items-center gap-2" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed)" onclick="alert('Report submitted! Thank you for helping.')">
<img src="${IMAGES.report}" alt="" class="w-5 h-5" onerror="this.style.display='none'">
Submit Report
</button>
</div>
</div>
</section>

${coverSongs.length > 0 ? `
<!-- Cover Music Section -->
<section id="music" class="py-8 animate-slide-up">
<div class="section-header">
<div class="section-icon" style="background:linear-gradient(135deg,rgba(34,197,94,0.1),rgba(22,163,74,0.1))">
🎵
</div>
<div>
<h2 class="text-xl font-bold font-display">Cover Music</h2>
<p class="text-sm text-surface-500">${coverSongs.length} Premium Songs</p>
</div>
</div>

<div class="premium-card p-6">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
${coverSongs.map((s, i) => `
<div class="bg-surface-50 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer border border-surface-200" onclick="playCoverSong('${s.audioUrl}','${s.title}')">
<div class="flex items-center gap-3">
<div class="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
${(i+1).toString().padStart(2,'0')}
</div>
<div class="flex-1">
<div class="font-semibold text-surface-800 text-sm">${s.title}</div>
<div class="text-xs text-surface-500">Cover Song</div>
</div>
<button class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg">
▶
</button>
</div>
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
<div class="chat-header">
<div class="chat-avatar">
H
<div class="online-dot"></div>
</div>
<div style="flex:1">
<div style="font-weight:600;font-size:16px">Hammad Bin Amir</div>
<div style="font-size:12px;opacity:0.9" id="statusText">Online</div>
</div>
<div class="flex items-center gap-2">
<img src="${IMAGES.messageIcon}" alt="" class="w-6 h-6" onerror="this.style.display='none'">
<button onclick="toggleChat()" style="background:transparent;border:none;color:white;cursor:pointer;font-size:24px;opacity:0.8">✕</button>
</div>
</div>

<div id="chatLoginForm" style="padding:30px 20px;text-align:center">
<p style="color:#71717a;margin-bottom:20px;font-size:14px">Enter your details to start chatting</p>
<input type="text" id="userName" class="input-premium" placeholder="Your Name" style="margin-bottom:12px">
<input type="text" id="userContact" class="input-premium" placeholder="Phone Number or Email" style="margin-bottom:16px">
<button onclick="registerChat()" class="btn-premium w-full">Start Chat</button>
<p style="color:#a1a1aa;font-size:11px;margin-top:12px">Use same phone/email to find old chats</p>
</div>

<div id="chatInterface" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages" id="chatMessages">
<div style="text-align:center;color:#a1a1aa;font-size:12px;padding:10px">🔒 Messages are end-to-end encrypted</div>
</div>
<div class="typing-indicator" id="typingIndicator" style="display:none;padding:0 20px 10px">
<div style="display:flex;gap:4px;padding:8px 16px;background:white;border-radius:16px;float:left;clear:both;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
<div class="typing-dot" style="width:8px;height:8px;border-radius:50%;background:#a1a1aa;animation:typingDot 1.4s infinite;display:inline-block"></div>
<div class="typing-dot" style="width:8px;height:8px;border-radius:50%;background:#a1a1aa;animation:typingDot 1.4s infinite;display:inline-block;animation-delay:0.2s"></div>
<div class="typing-dot" style="width:8px;height:8px;border-radius:50%;background:#a1a1aa;animation:typingDot 1.4s infinite;display:inline-block;animation-delay:0.4s"></div>
</div>
</div>
<div id="imagePreview" style="display:none;padding:8px 20px;background:white;position:relative">
<img id="previewImage" src="" style="max-height:100px;border-radius:12px">
<button onclick="clearImagePreview()" style="position:absolute;top:2px;right:22px;background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer">✕</button>
</div>
<div id="recordingBar" style="display:none;background:#ef4444;color:white;padding:8px 20px;align-items:center;gap:8px;font-size:13px">
<span>🔴 Recording...</span>
<span id="recTime">00:00</span>
</div>
<div class="chat-input-area">
<button onclick="document.getElementById('imageInput').click()" title="Send Image" style="background:transparent;border:none;font-size:20px;cursor:pointer">🖼</button>
<input type="file" id="imageInput" accept="image/*" style="display:none" onchange="handleImage(event)">
<input type="text" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button id="recordBtn" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Voice Message" style="background:transparent;border:none;font-size:20px;cursor:pointer">🎤</button>
<button class="send-btn" onclick="sendMessage()">
<svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<!-- Image Viewer -->
<div id="imageViewer" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center" onclick="this.style.display='none'">
<span style="position:absolute;top:20px;right:20px;color:white;font-size:30px;cursor:pointer">✕</span>
<img id="viewerImage" src="" style="max-width:95%;max-height:95%">
</div>

<script>
// Header scroll effect
let lastScroll=0;
window.addEventListener('scroll',()=>{
const s=window.scrollY;
const h=document.getElementById('mainHeader');
if(s>lastScroll&&s>60)h.classList.add('header-hidden');
else h.classList.remove('header-hidden');
lastScroll=s;
});

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
if(wv&&!sessionStorage.getItem('wvPlayed')){
wv.play().catch(()=>{});
sessionStorage.setItem('wvPlayed','1');
}
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
html='<div class="'+a+' mb-2"><div class="'+b+'"><img src="'+mediaUrl+'" style="max-width:250px;border-radius:12px;cursor:pointer" onclick="document.getElementById(\'viewerImage\').src=\''+mediaUrl+'\';document.getElementById(\'imageViewer\').style.display=\'flex\'"><div class="msg-time">'+t+' ✓✓</div></div></div>';
}else if(type==='voice'){
html='<div class="'+a+' mb-2"><div class="'+b+'"><div style="display:flex;align-items:center;gap:8px"><button onclick="playVoice(this,\''+mediaUrl+'\')" style="width:32px;height:32px;border-radius:50%;background:#25d366;border:none;color:white;cursor:pointer">▶</button><span style="font-size:12px">🎤 '+(duration||0)+'s</span></div><div class="msg-time">'+t+' ✓✓</div></div></div>';
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
document.getElementById('recordBtn').style.color='#ef4444';
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
document.getElementById('recordBtn').style.color='';
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
document.getElementById('chatMessages').innerHTML='<div style="text-align:center;color:#a1a1aa;font-size:12px;padding:10px">🔒 Messages are end-to-end encrypted</div>';
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
                            await saveMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to Baiilla Maach Official Support. How can I help you today?', 'text');
                            ws.send(JSON.stringify({ type: 'message', message: 'Hello! 👋 Welcome to Baiilla Maach Official Support. How can I help you today?', sender: 'admin', msgType: 'text', timestamp: new Date().toISOString() }));
                            notifyAdmin({ type: 'new_message', chatId: user.chatId, name: user.name, message: 'Hello! 👋', sender: 'admin' });
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
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>body{background:#fafafa;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:white;border-radius:16px;padding:32px;max-width:360px;width:100%;box-shadow:0 4px 6px rgba(0,0,0,0.05)}h1{text-align:center;margin-bottom:24px;color:#18181b}input{width:100%;padding:12px;margin-bottom:12px;background:#f4f4f5;border:2px solid #e4e4e7;border-radius:10px;font-size:14px;outline:none;transition:all 0.3s}input:focus{border-color:#0c8ee9}button{width:100%;padding:14px;background:linear-gradient(135deg,#0c8ee9,#0070c7);color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s}button:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(12,142,233,0.3)}</style></head><body><div class="box"><h1>🔐 Admin Login</h1><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
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

// Admin Panel HTML (Light Theme)
async function getAdminPanelHTML() {
    const users = await getAllUsers();
    const usersWithInfo = [];
    
    for (const user of users) {
        const lastMsg = await getLastMessage(user.chatId);
        const unread = await getUnreadCount(user.chatId);
        usersWithInfo.push({ ...user, lastMessage: lastMsg, unread });
    }
    
    const usersHTML = usersWithInfo.map(user => `
<div class="flex items-center gap-3 p-4 hover:bg-surface-100 cursor-pointer border-b border-surface-200 transition-all" onclick="openChat('${user.chatId}', '${user.name.replace(/'/g, "\\'")}')">
<div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
<span class="text-lg font-bold text-white">${user.name.charAt(0).toUpperCase()}</span>
</div>
<div class="flex-1 min-w-0">
<div class="flex justify-between items-baseline">
<h3 class="text-surface-800 font-semibold text-sm truncate">${user.name}</h3>
<span class="text-xs text-surface-400 flex-shrink-0 ml-2">${user.lastMessage ? new Date(user.lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</span>
</div>
<div class="flex justify-between items-center mt-1">
<p class="text-sm text-surface-500 truncate">${user.lastMessage ? user.lastMessage.message.substring(0, 35) : 'No messages'}</p>
${user.unread > 0 ? `<span class="bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">${user.unread}</span>` : ''}
</div>
</div>
</div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Dashboard | Baiilla Maach</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#fafafa;height:100vh;display:flex}
.chat-list{width:380px;background:white;border-right:1px solid #e4e4e7;display:flex;flex-direction:column}
.chat-area{flex:1;display:flex;flex-direction:column;background:#fafafa}
.chat-header{background:linear-gradient(135deg,#0c8ee9,#0070c7);color:white;padding:16px;display:flex;align-items:center;gap:12px}
.chat-bg{flex:1;overflow-y:auto;padding:20px;background:#fafafa}
.msg-out{background:linear-gradient(135deg,#0c8ee9,#0070c7);color:white;border-radius:16px 4px 16px 16px}
.msg-in{background:white;color:#18181b;border-radius:4px 16px 16px 16px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
</style>
</head>
<body>
<div class="chat-list">
<div class="chat-header justify-between">
<h1 class="text-white font-semibold text-lg">💬 Admin Chats</h1>
<div class="flex gap-2">
<a href="/" class="text-white/80 hover:text-white text-sm">Site</a>
<a href="/admin/logout" class="text-white/80 hover:text-white text-sm">Logout</a>
</div>
</div>
<div class="flex-1 overflow-y-auto">${usersHTML || '<div class="text-surface-400 text-center py-8">No users yet</div>'}</div>
</div>
<div class="chat-area" id="chatArea">
<div class="flex-1 flex items-center justify-center">
<div class="text-center text-surface-400">
<svg class="w-24 h-24 mx-auto mb-4 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
<p class="text-lg">Select a conversation</p>
<p class="text-sm">Manage user chats from here</p>
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
'<div class="chat-header"><div class="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center"><span class="text-lg font-bold text-white">'+name.charAt(0)+'</span></div><div class="flex-1"><div class="text-white font-medium">'+name+'</div><div class="text-xs text-white/70" id="st">Online</div></div></div>'+
'<div class="chat-bg" id="mc"><div id="msgs"></div><div id="typingIndicator" style="display:none;float:left;clear:both;margin-top:8px"><div class="msg-in px-4 py-3 inline-block">typing...</div></div><div style="clear:both"></div></div>'+
'<div style="background:white;padding:16px;display:flex;align-items:center;gap:8px;border-top:1px solid #e4e4e7"><input type="text" id="ai" style="flex:1;background:#f4f4f5;border:2px solid transparent;padding:12px 16px;border-radius:24px;font-size:14px;outline:none;transition:all 0.3s" placeholder="Type a message..." onkeypress="if(event.key===\\'Enter\\')sendAdmin()" onfocus="this.style.borderColor=\\'#0c8ee9\\';this.style.background=\\'white\\'" onblur="this.style.borderColor=\\'transparent\\';this.style.background=\\'#f4f4f5\\'"><button onclick="sendAdmin()" style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0c8ee9,#0070c7);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(12,142,233,0.3)"><svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div>';
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
if(type==='image')h='<div class="flex '+a+'"><div class="'+b+' max-w-[70%] px-4 py-3"><img src="'+mediaUrl+'" style="max-width:250px;border-radius:12px;cursor:pointer" onclick="window.open(\\''+mediaUrl+'\\')"><div style="font-size:11px;opacity:0.7;margin-top:4px;text-align:right">'+t+'</div></div></div>';
else if(type==='voice')h='<div class="flex '+a+'"><div class="'+b+' max-w-[70%] px-4 py-3"><div style="display:flex;align-items:center;gap:8px"><button onclick="new Audio(\\''+mediaUrl+'\\').play()" style="width:30px;height:30px;border-radius:50%;background:#25d366;border:none;color:white;cursor:pointer">▶</button><span>🎤 '+(duration||0)+'s</span></div><div style="font-size:11px;opacity:0.7;margin-top:4px;text-align:right">'+t+'</div></div></div>';
else h='<div class="flex '+a+'"><div class="'+b+' max-w-[70%] px-4 py-3"><div style="font-size:14px">'+text+'</div><div style="font-size:11px;opacity:0.7;margin-top:4px;text-align:right">'+t+'</div></div></div>';
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

// Start Server
async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('========================================');
        console.log(' 🌟 Premium Verification Hub');
        console.log(' Baiilla Maach Official');
        console.log('========================================');
        console.log(' 📱 Main Site: http://localhost:' + PORT);
        console.log(' 👑 Admin: http://localhost:' + PORT + '/admin');
        console.log(' 🔑 Login: Hammad / Hammad1122@');
        console.log(' 📦 Node.js 20.x Compatible');
        console.log(' 🎨 White Light Mode Theme');
        console.log('========================================');
    });
}

start();

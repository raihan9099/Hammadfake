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

// Corrected image paths
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
    tiktokBlueTick: "/assets/check-mark.png", // TikTok blue tick
    fbBlueTick: "/assets/social-media.png", // Facebook blue tick
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    microphone: "/assets/microphone-in-hand.gif",
    fbProfile: "/assets/fb_profile.jpg" // Facebook profile
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
        const songs = files.filter(f => audioExts.includes(path.extname(f).toLowerCase()));
        
        return songs.map((f, i) => ({
            id: 'song_' + (i + 1),
            title: `Cover Song #${i + 1}`,
            artist: 'Baiilla Maach',
            audioUrl: `/assets/covermusic/${encodeURIComponent(f)}`,
            coverUrl: null
        })).sort((a, b) => a.title.localeCompare(b.title));
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
            likes: "50K",
            tickIcon: IMAGES.tiktokBlueTick
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            screenshot: IMAGES.fbProfile,
            verified: true,
            followers: "Growing",
            tickIcon: IMAGES.fbBlueTick
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

// Generate Main HTML with fixed alignment and responsive design
function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>Baiilla Maach Official | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={
  theme:{
    extend:{
      colors:{
        primary:{
          50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a'
        }
      },
      fontFamily:{
        sans:['Inter','sans-serif']
      },
      animation:{
        'fade-in':'fadeIn 0.5s ease-out',
        'slide-up':'slideUp 0.4s ease-out',
        'bounce-in':'bounceIn 0.5s',
        'typing-dot':'typingDot 1.4s infinite',
        'pulse-rec':'pulseRec 1s infinite'
      },
      keyframes:{
        fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},
        slideUp:{'0%':{transform:'translateY(16px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}},
        bounceIn:{'0%':{transform:'scale(0.3)',opacity:'0'},'50%':{transform:'scale(1.05)'},'70%':{transform:'scale(0.9)'},'100%':{transform:'scale(1)',opacity:'1'}},
        typingDot:{'0%,60%,100%':{transform:'translateY(0)'},'30%':{transform:'translateY(-10px)'}},
        pulseRec:{'0%,100%':{opacity:'1'},'50%':{opacity:'0.5'}}
      }
    }
  }
}
</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'Inter',sans-serif;
  background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 50%,#f8fafc 100%);
  color:#1e293b;
  min-height:100vh;
  overflow-x:hidden;
  line-height:1.5;
  -webkit-text-size-adjust:100%;
  -ms-text-size-adjust:100%;
}

/* Scrollbar */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#f1f5f9;border-radius:8px}
::-webkit-scrollbar-thumb{background:#3b82f6;border-radius:8px}

/* Premium Card */
.premium-card{
  background:white;
  border:1px solid rgba(59,130,246,0.1);
  border-radius:16px;
  box-shadow:0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03);
  transition:all 0.3s ease;
}
.premium-card:hover{
  box-shadow:0 10px 25px rgba(0,0,0,0.08);
}

/* Glass Header */
.glass-header{
  background:rgba(255,255,255,0.95);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  border-bottom:1px solid rgba(0,0,0,0.06);
}

/* Gradient Text */
.gradient-text{
  background:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  display:inline-block;
}

/* Blue Tick - Fixed alignment */
.blue-tick-inline{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  vertical-align:middle;
  flex-shrink:0;
  margin-left:6px;
}
.blue-tick-inline img{
  width:18px;
  height:18px;
  display:block;
  object-fit:contain;
}

.blue-tick-sm{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  vertical-align:middle;
  flex-shrink:0;
  margin-left:4px;
}
.blue-tick-sm img{
  width:14px;
  height:14px;
  display:block;
  object-fit:contain;
}

.blue-tick-lg{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  vertical-align:middle;
  flex-shrink:0;
  margin-left:8px;
}
.blue-tick-lg img{
  width:22px;
  height:22px;
  display:block;
  object-fit:contain;
}

/* Name with tick container - prevents misalignment */
.name-with-tick{
  display:inline-flex;
  align-items:center;
  flex-wrap:nowrap;
  white-space:nowrap;
}

/* Buttons */
.btn-primary{
  display:inline-flex;
  align-items:center;
  gap:8px;
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:white;
  padding:10px 20px;
  border-radius:12px;
  font-weight:600;
  font-size:14px;
  text-decoration:none;
  transition:all 0.3s ease;
  border:none;
  cursor:pointer;
  white-space:nowrap;
}
.btn-primary:hover{
  transform:translateY(-1px);
  box-shadow:0 8px 20px rgba(37,99,235,0.3);
}
.btn-primary:active{
  transform:translateY(0);
}

.btn-outline{
  display:inline-flex;
  align-items:center;
  gap:8px;
  background:white;
  color:#2563eb;
  padding:10px 20px;
  border-radius:12px;
  font-weight:600;
  font-size:14px;
  text-decoration:none;
  transition:all 0.3s ease;
  border:1.5px solid #bfdbfe;
  cursor:pointer;
  white-space:nowrap;
}
.btn-outline:hover{
  border-color:#3b82f6;
  background:#eff6ff;
}

/* Tags */
.tag{
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:5px 12px;
  border-radius:20px;
  font-size:12px;
  font-weight:600;
  white-space:nowrap;
}
.tag-verified{
  background:#dbeafe;
  color:#1d4ed8;
}
.tag-creator{
  background:#ede9fe;
  color:#6d28d9;
}
.tag-danger{
  background:#fee2e2;
  color:#dc2626;
}

/* Profile Section */
.profile-img-wrapper{
  position:relative;
  display:inline-block;
}
.profile-img{
  width:80px;
  height:80px;
  border-radius:50%;
  border:3px solid white;
  box-shadow:0 4px 16px rgba(0,0,0,0.1);
  object-fit:cover;
}
.verified-badge-circle{
  position:absolute;
  bottom:4px;
  right:4px;
  width:24px;
  height:24px;
  background:#2563eb;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  border:2.5px solid white;
}
.verified-badge-circle img{
  width:12px;
  height:12px;
  object-fit:contain;
}

/* Stats */
.stat-box{
  background:white;
  border-radius:14px;
  padding:14px 10px;
  text-align:center;
  box-shadow:0 1px 3px rgba(0,0,0,0.05);
}
.stat-number{
  font-size:22px;
  font-weight:700;
  color:#1e293b;
  line-height:1.2;
}
.stat-label{
  font-size:11px;
  color:#64748b;
  font-weight:500;
  margin-top:2px;
}

/* Section Header */
.section-title-area{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:16px;
  flex-wrap:wrap;
}
.section-icon-circle{
  width:36px;
  height:36px;
  border-radius:10px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:18px;
  flex-shrink:0;
}

/* Account Card */
.account-card{
  background:#f8fafc;
  border-radius:14px;
  padding:14px;
  border:1px solid #e2e8f0;
  transition:all 0.2s ease;
}
.account-card:hover{
  border-color:#bfdbfe;
}

/* Fake Card */
.fake-card{
  background:white;
  border-radius:16px;
  padding:16px;
  border:1px solid #fee2e2;
  border-left:4px solid #ef4444;
}

/* Chat Widget */
.whatsapp-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.whatsapp-btn{
  width:56px;
  height:56px;
  background:#25d366;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 4px 16px rgba(37,211,102,0.4);
  transition:all 0.3s ease;
  animation:bounceIn 0.5s;
}
.whatsapp-btn:hover{transform:scale(1.08)}
.whatsapp-btn svg{width:30px;height:30px;fill:white}
.notification-badge{
  position:absolute;
  top:-4px;
  right:-4px;
  background:#ef4444;
  color:white;
  border-radius:50%;
  width:22px;
  height:22px;
  font-size:11px;
  font-weight:bold;
  display:none;
  align-items:center;
  justify-content:center;
  border:2px solid white;
}

.chat-window{
  position:fixed;
  bottom:90px;
  right:20px;
  width:380px;
  max-width:calc(100vw - 40px);
  height:520px;
  max-height:calc(100vh - 130px);
  background:white;
  border-radius:16px;
  overflow:hidden;
  box-shadow:0 20px 50px rgba(0,0,0,0.2);
  display:none;
  flex-direction:column;
  animation:slideUp 0.3s ease-out;
  border:1px solid #e2e8f0;
}
.chat-window.open{display:flex}

.chat-header-bg{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:white;
  padding:14px;
  display:flex;
  align-items:center;
  gap:10px;
}
.chat-avatar-circle{
  width:40px;
  height:40px;
  border-radius:50%;
  background:linear-gradient(135deg,#f59e0b,#fbbf24);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:bold;
  color:white;
  font-size:18px;
  position:relative;
  flex-shrink:0;
}
.online-dot{
  width:10px;
  height:10px;
  background:#22c55e;
  border-radius:50%;
  position:absolute;
  bottom:1px;
  right:1px;
  border:2px solid #2563eb;
}

.chat-messages-area{
  flex:1;
  overflow-y:auto;
  padding:14px;
  background:#f8fafc;
}
.msg-bubble{
  max-width:78%;
  padding:9px 14px;
  margin-bottom:6px;
  border-radius:14px;
  font-size:13.5px;
  line-height:1.4;
  position:relative;
  word-wrap:break-word;
  animation:messageIn 0.3s ease-out;
}
@keyframes messageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg-out{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:white;
  float:right;
  clear:both;
  border-bottom-right-radius:4px;
}
.msg-in{
  background:white;
  color:#1e293b;
  float:left;
  clear:both;
  border-bottom-left-radius:4px;
  box-shadow:0 1px 2px rgba(0,0,0,0.04);
}
.msg-time-text{
  font-size:10.5px;
  opacity:0.7;
  text-align:right;
  margin-top:3px;
}

.chat-input-bar{
  background:white;
  padding:10px 14px;
  display:flex;
  align-items:center;
  gap:6px;
  border-top:1px solid #e2e8f0;
}
.chat-input-bar input{
  flex:1;
  background:#f1f5f9;
  border:1.5px solid transparent;
  padding:10px 14px;
  border-radius:20px;
  font-size:13.5px;
  outline:none;
  transition:all 0.2s ease;
  min-width:0;
}
.chat-input-bar input:focus{
  border-color:#3b82f6;
  background:white;
}
.send-btn-circle{
  width:38px;
  height:38px;
  border-radius:50%;
  background:#2563eb;
  border:none;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition:all 0.2s ease;
  flex-shrink:0;
}
.send-btn-circle:hover{background:#1d4ed8}
.send-btn-circle svg{width:18px;height:18px;fill:white}

/* Recording */
.recording-indicator{
  display:none;
  background:#ef4444;
  color:white;
  padding:6px 14px;
  align-items:center;
  gap:8px;
  font-size:12px;
}

/* Image Viewer */
.image-viewer-overlay{
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.95);
  z-index:10000;
  align-items:center;
  justify-content:center;
}
.image-viewer-overlay.open{display:flex}
.image-viewer-overlay img{max-width:95%;max-height:95%;border-radius:8px}

/* Mobile Responsive */
@media(max-width:640px){
  .profile-img{width:70px;height:70px}
  .stat-number{font-size:20px}
  .chat-window{
    width:100%;
    max-width:100%;
    bottom:0;
    right:0;
    border-radius:16px 16px 0 0;
    height:85vh;
    max-height:85vh;
  }
  .whatsapp-btn{width:50px;height:50px}
  .whatsapp-btn svg{width:26px;height:26px}
  .btn-primary,.btn-outline{padding:8px 16px;font-size:13px}
  .name-with-tick{font-size:15px}
  .blue-tick-inline img{width:16px;height:16px}
  .blue-tick-lg img{width:18px;height:18px}
}

@media(max-width:380px){
  .profile-img{width:60px;height:60px}
  .stat-box{padding:10px 6px}
  .stat-number{font-size:18px}
  .btn-primary,.btn-outline{padding:7px 12px;font-size:12px;gap:4px}
  .name-with-tick{font-size:14px}
  .blue-tick-inline img{width:14px;height:14px}
}
</style>
</head>
<body>

<!-- Header -->
<header id="mainHeader" class="fixed top-0 left-0 right-0 z-40 glass-header transition-transform duration-300">
<div class="max-w-5xl mx-auto px-3 sm:px-4">
<div class="flex items-center justify-between h-12 sm:h-14">
<div class="flex items-center gap-2 min-w-0">
<img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-blue-500 object-cover flex-shrink-0" onerror="this.style.display='none'">
<div class="name-with-tick">
<span class="text-sm sm:text-base font-bold gradient-text truncate">Verification Hub</span>
<span class="blue-tick-inline"><img src="${IMAGES.tiktokBlueTick}" alt="✓" onerror="this.style.display='none'"></span>
</div>
</div>
<nav class="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
<a href="#official" class="px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition">Official</a>
<a href="#fake" class="px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-500 rounded-lg hover:bg-red-50 transition">Fakes</a>
${coverSongs.length > 0 ? '<a href="#music" class="px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 transition hidden sm:block">Music</a>' : ''}
</nav>
</div>
</div>
</header>

<main class="pt-14 sm:pt-16 pb-20">
<div class="max-w-5xl mx-auto px-3 sm:px-4">

<!-- Profile -->
<section class="text-center py-5 sm:py-8 animate-fade-in">
<div class="profile-img-wrapper mb-3">
<img src="${DATA.celebrity.photo}" alt="" class="profile-img" onerror="this.style.display='none'">
<div class="verified-badge-circle">
<img src="${IMAGES.tiktokBlueTick}" alt="✓" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22><path d=%22M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z%22/></svg>'">
</div>
</div>
<h1 class="text-lg sm:text-xl font-bold mb-1 flex items-center justify-center flex-wrap gap-x-1">
<span class="name-with-tick">
${DATA.celebrity.fullName}
<span class="blue-tick-lg"><img src="${IMAGES.tiktokBlueTick}" alt="✓" onerror="this.style.display='none'"></span>
</span>
</h1>
<p class="text-xs sm:text-sm text-slate-500 mb-4">${DATA.celebrity.bio}</p>

<div class="grid grid-cols-3 gap-2 sm:gap-3 max-w-xs sm:max-w-sm mx-auto mb-4">
<div class="stat-box"><div class="stat-number">${DATA.celebrity.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
<div class="stat-box"><div class="stat-number">${DATA.celebrity.tiktokFollowing}</div><div class="stat-label">Following</div></div>
<div class="stat-box"><div class="stat-number">${DATA.celebrity.tiktokLikes}</div><div class="stat-label">Likes</div></div>
</div>

<div class="flex justify-center gap-2 flex-wrap mb-4">
<span class="tag tag-verified">
<img src="${IMAGES.tiktokBlueTick}" alt="" class="w-3.5 h-3.5" onerror="this.style.display='none'">
Verified Official
</span>
<span class="tag tag-creator">Premium Creator</span>
</div>

<div class="flex justify-center gap-2 flex-wrap">
<a href="${realAcc[0].url}" target="_blank" class="btn-primary">
<img src="${IMAGES.tiktokIcon}" alt="" class="w-4 h-4" onerror="this.style.display='none'">
TikTok
</a>
<a href="${realAcc[1].url}" target="_blank" class="btn-primary" style="background:linear-gradient(135deg,#1877f2,#0c5dc7)">
<img src="${IMAGES.fbBlueTick}" alt="" class="w-4 h-4 brightness-0 invert" onerror="this.style.display='none'">
Facebook
</a>
</div>
</section>

<!-- Official Section -->
<section id="official" class="py-4 sm:py-6 animate-slide-up">
<div class="section-title-area">
<div class="section-icon-circle bg-blue-100">✅</div>
<div>
<h2 class="text-base sm:text-lg font-bold text-slate-800">Official Verified Accounts</h2>
<p class="text-xs text-slate-500">The only authentic profiles</p>
</div>
</div>

<div class="premium-card p-3 sm:p-5">
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
${realAcc.map(acc => `
<div class="account-card">
<div class="flex items-center justify-between mb-2">
<span class="text-xs font-semibold text-slate-500 uppercase">${acc.platform}</span>
<span class="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full font-medium">Verified</span>
</div>
<div class="flex items-center gap-2 sm:gap-3">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover border-2 border-slate-100 flex-shrink-0" onerror="this.style.display='none'">` : '<div class="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-400 flex-shrink-0">' + acc.platform[0] + '</div>'}
<div class="min-w-0">
<div class="name-with-tick">
<span class="font-semibold text-slate-800 text-sm truncate">${acc.username}</span>
<span class="blue-tick-sm"><img src="${acc.tickIcon}" alt="✓" onerror="this.style.display='none'"></span>
</div>
<div class="text-xs text-slate-500">${acc.platform} • ${acc.followers} followers</div>
</div>
</div>
</div>`).join('')}
</div>
</div>
</section>

<!-- Fake Accounts -->
<section id="fake" class="py-4 sm:py-6 animate-slide-up">
<div class="section-title-area">
<div class="section-icon-circle bg-red-100">⚠️</div>
<div>
<h2 class="text-base sm:text-lg font-bold text-slate-800">Fake Accounts Detected</h2>
<p class="text-xs text-slate-500">Help report these impersonators</p>
</div>
<span class="tag tag-danger ml-auto">${totalFake} Active</span>
</div>

<div class="space-y-3">
${fakeAcc.map((a, i) => `
<div class="fake-card">
<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
<div class="flex items-center gap-1.5">
<span class="text-red-500">⚠</span>
<span class="font-bold text-red-600 text-sm">Fake #${i+1}</span>
</div>
<span class="tag tag-danger">${a.threatLevel}</span>
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div class="relative rounded-xl overflow-hidden border-2 border-red-200">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full opacity-90">` : '<div class="w-full h-36 flex items-center justify-center text-3xl text-red-300">FAKE</div>'}
<div class="absolute inset-0 flex items-center justify-center"><span class="bg-red-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold">FAKE ACCOUNT</span></div>
</div>
<div class="space-y-1.5 text-sm">
<div class="flex justify-between bg-red-50 rounded-lg px-3 py-2"><span class="text-slate-500">Platform</span><span class="text-red-600">${a.platform}</span></div>
<div class="flex justify-between bg-red-50 rounded-lg px-3 py-2"><span class="text-slate-500">Username</span><span class="text-red-600">${a.username}</span></div>
<div class="flex justify-between bg-red-50 rounded-lg px-3 py-2"><span class="text-slate-500">Reports</span><span class="text-red-600">${a.reportedCount}+</span></div>
<div class="bg-red-50 rounded-lg p-2 text-xs text-red-600">${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="${a.profileUrl}" target="_blank" class="flex-1 text-center bg-red-500 text-white px-3 py-2 rounded-full text-xs font-bold hover:bg-red-600 transition">Report</a>
<button onclick="navigator.clipboard.writeText('${a.username}')" class="flex-1 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-full text-xs font-bold hover:bg-red-50 transition">Copy</button>
</div>
</div>`).join('')}
</div>
<div class="text-center mt-4">
<button onclick="document.getElementById('fakeVoice').play()" class="btn-outline text-red-600 border-red-200 hover:bg-red-50">
🔊 Voice Alert
</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="py-4 sm:py-6 animate-slide-up">
<div class="section-title-area">
<div class="section-icon-circle bg-emerald-100">🎵</div>
<div>
<h2 class="text-base sm:text-lg font-bold text-slate-800">Cover Music</h2>
<p class="text-xs text-slate-500">${coverSongs.length} songs</p>
</div>
</div>
<div class="premium-card p-3 sm:p-4">
<div class="space-y-1.5 max-h-56 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition" onclick="playCoverSong('${s.audioUrl}','${s.title}')">
<span class="text-xs text-slate-400 w-5 flex-shrink-0">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1 min-w-0"><div class="text-sm text-slate-800 truncate">${s.title}</div><div class="text-xs text-slate-400">${s.artist}</div></div>
<button class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-emerald-600 transition text-xs">▶</button>
</div>`).join('')}
</div>
</div>
<audio id="coverAudio" preload="none"></audio>
</section>` : ''}

</div>
</main>

<!-- WhatsApp Widget -->
<div class="whatsapp-widget">
<div class="whatsapp-btn" onclick="toggleChat()" id="chatBtn">
<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
<span class="notification-badge" id="msgBadge">0</span>
</div>

<div class="chat-window" id="chatWindow">
<div class="chat-header-bg">
<div class="chat-avatar-circle">H<div class="online-dot" id="onlineDot"></div></div>
<div style="flex:1;min-width:0">
<div style="font-weight:600;font-size:15px">Hammad Bin Amir</div>
<div style="font-size:11px;opacity:0.9" id="statusText">Online</div>
</div>
<button onclick="toggleChat()" style="background:transparent;border:none;color:white;cursor:pointer;font-size:20px;padding:4px">✕</button>
</div>

<div id="chatLoginForm" style="padding:24px 16px;text-align:center">
<p style="color:#64748b;margin-bottom:16px;font-size:13px">Enter your details to start</p>
<input type="text" id="userName" placeholder="Your Name" style="width:100%;background:#f1f5f9;border:1.5px solid #e2e8f0;padding:10px 14px;border-radius:10px;font-size:14px;outline:none;margin-bottom:10px;transition:all 0.2s" onfocus="this.style.borderColor='#3b82f6';this.style.background='white'" onblur="this.style.borderColor='#e2e8f0';this.style.background='#f1f5f9'">
<input type="text" id="userContact" placeholder="Phone or Email" style="width:100%;background:#f1f5f9;border:1.5px solid #e2e8f0;padding:10px 14px;border-radius:10px;font-size:14px;outline:none;margin-bottom:14px;transition:all 0.2s" onfocus="this.style.borderColor='#3b82f6';this.style.background='white'" onblur="this.style.borderColor='#e2e8f0';this.style.background='#f1f5f9'">
<button onclick="registerChat()" class="btn-primary w-full justify-center">Start Chat</button>
<p style="color:#94a3b8;font-size:10px;margin-top:10px">Same phone/email to restore chats</p>
</div>

<div id="chatInterface" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages-area" id="chatMessages">
<div style="text-align:center;color:#94a3b8;font-size:11px;padding:8px">🔒 Secure messages</div>
</div>
<div id="typingIndicator" style="display:none;padding:0 14px 8px">
<div style="display:flex;gap:4px;padding:8px 14px;background:white;border-radius:14px;float:left;clear:both;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
<div style="width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:typingDot 1.4s infinite;display:inline-block"></div>
<div style="width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:typingDot 1.4s infinite;display:inline-block;animation-delay:0.2s"></div>
<div style="width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:typingDot 1.4s infinite;display:inline-block;animation-delay:0.4s"></div>
</div>
</div>
<div id="imagePreview" style="display:none;padding:8px 14px;background:white;position:relative">
<img id="previewImage" src="" style="max-height:80px;border-radius:10px">
<button onclick="clearImagePreview()" style="position:absolute;top:4px;right:18px;background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px">✕</button>
</div>
<div class="recording-indicator" id="recordingBar">
<span>🔴 Recording</span>
<span id="recTime">00:00</span>
</div>
<div class="chat-input-bar">
<button onclick="document.getElementById('imageInput').click()" title="Image" style="background:transparent;border:none;font-size:18px;cursor:pointer;padding:4px">🖼</button>
<input type="file" id="imageInput" accept="image/*" style="display:none" onchange="handleImage(event)">
<input type="text" id="messageInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button id="recordBtn" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Voice" style="background:transparent;border:none;font-size:18px;cursor:pointer;padding:4px">🎤</button>
<button class="send-btn-circle" onclick="sendMessage()">
<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<div class="image-viewer-overlay" id="imageViewer" onclick="this.classList.remove('open')">
<span style="position:absolute;top:16px;right:16px;color:white;font-size:28px;cursor:pointer">✕</span>
<img id="viewerImage" src="">
</div>

<script>
// Header scroll
let lastScroll=0;
window.addEventListener('scroll',()=>{
const s=window.scrollY,h=document.getElementById('mainHeader');
if(s>lastScroll&&s>60)h.style.transform='translateY(-100%)';
else h.style.transform='translateY(0)';
lastScroll=s;
});

// Cover Music
function playCoverSong(url,title){
const a=document.getElementById('coverAudio');a.src=url;a.play().catch(()=>{});
if(title)document.title=title;
}

// Welcome Voice
setTimeout(()=>{
const wv=document.getElementById('welcomeVoice');
if(wv&&!sessionStorage.getItem('wv')){wv.play().catch(()=>{});sessionStorage.setItem('wv','1')}
},2000);

// Chat
let ws=null,chatToken=localStorage.getItem('ct'),chatId=null,selectedImage=null;
let mediaRecorder=null,audioChunks=[],recStart=0,recInterval=null;

function toggleChat(){
const w=document.getElementById('chatWindow');w.classList.toggle('open');
if(w.classList.contains('open')&&!ws)connectWS();
}

function connectWS(){
const p=location.protocol==='https:'?'wss:':'ws:';
ws=new WebSocket(p+'//'+location.host+'/ws');
ws.onopen=()=>{
document.getElementById('statusText').textContent='Online';
document.getElementById('onlineDot').style.display='block';
if(chatToken)ws.send(JSON.stringify({type:'auth',token:chatToken}));
};
ws.onmessage=(e)=>{
const d=JSON.parse(e.data);
if(d.type==='auth_success'){showUI();loadMsgs()}
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
if(!n||!c){alert('Fill all fields');return}
try{
const r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,contact:c})});
const d=await r.json();
if(d.success){chatToken=d.sessionToken;chatId=d.chatId;localStorage.setItem('ct',chatToken);showUI();if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'auth',token:chatToken}));else connectWS()}
else alert(d.error||'Error');
}catch(e){alert('Connection error')}
}

function showUI(){
document.getElementById('chatLoginForm').style.display='none';
document.getElementById('chatInterface').style.display='flex';
}

function sendMessage(){
const inp=document.getElementById('messageInput'),msg=inp.value.trim();
if(!msg&&!selectedImage)return;
if(selectedImage){ws.send(JSON.stringify({type:'message',token:chatToken,message:msg||'🖼',msgType:'image',mediaUrl:selectedImage}));clearImagePreview()}
else ws.send(JSON.stringify({type:'message',token:chatToken,message:msg,msgType:'text'}));
inp.value='';inp.focus();
}

function addMsg(text,sender,type,mediaUrl,duration,timestamp){
const c=document.getElementById('chatMessages');
const w=document.createElement('div');
const t=new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const a=sender==='user'?'flex justify-end':'flex justify-start';
const b=sender==='user'?'msg-out':'msg-in';
let h='';
if(type==='image')h='<div class="'+a+' mb-2"><div class="'+b+'"><img src="'+mediaUrl+'" style="max-width:220px;border-radius:10px;cursor:pointer" onclick="document.getElementById(\'viewerImage\').src=\''+mediaUrl+'\';document.getElementById(\'imageViewer\').classList.add(\'open\')"><div class="msg-time-text">'+t+' ✓✓</div></div></div>';
else if(type==='voice')h='<div class="'+a+' mb-2"><div class="'+b+'"><div style="display:flex;align-items:center;gap:6px"><button onclick="playV(this,\''+mediaUrl+'\')" style="width:28px;height:28px;border-radius:50%;background:#22c55e;border:none;color:white;cursor:pointer;font-size:12px">▶</button><span style="font-size:11px">🎤 '+(duration||0)+'s</span></div><div class="msg-time-text">'+t+' ✓✓</div></div></div>';
else h='<div class="'+a+' mb-2"><div class="'+b+'">'+text+'<div class="msg-time-text">'+t+' '+(sender==='user'?'✓✓':'')+'</div></div></div>';
w.innerHTML=h;c.appendChild(w);scrollChat();
}

function playV(btn,url){const a=new Audio(url);a.play();btn.textContent='⏸';a.onended=()=>{btn.textContent='▶'}}

function handleImage(e){
const f=e.target.files[0];if(!f)return;
const r=new FileReader();
r.onload=(ev)=>{selectedImage=ev.target.result;document.getElementById('previewImage').src=selectedImage;document.getElementById('imagePreview').style.display='block'};
r.readAsDataURL(f);
}

function clearImagePreview(){selectedImage=null;document.getElementById('imagePreview').style.display='none';document.getElementById('imageInput').value=''}

async function startRecording(){
try{const s=await navigator.mediaDevices.getUserMedia({audio:true});mediaRecorder=new MediaRecorder(s);audioChunks=[];mediaRecorder.ondataavailable=(e)=>audioChunks.push(e.data);mediaRecorder.start();document.getElementById('recordBtn').style.color='#ef4444';document.getElementById('recordingBar').style.display='flex';recStart=Date.now();recInterval=setInterval(()=>{const e=Math.floor((Date.now()-recStart)/1000);document.getElementById('recTime').textContent=Math.floor(e/60).toString().padStart(2,'0')+':'+(e%60).toString().padStart(2,'0')},1000)}catch(e){console.error(e)}
}

function stopRecording(){
if(!mediaRecorder||mediaRecorder.state==='inactive')return;
mediaRecorder.stop();document.getElementById('recordBtn').style.color='';document.getElementById('recordingBar').style.display='none';clearInterval(recInterval);
mediaRecorder.onstop=()=>{const b=new Blob(audioChunks,{type:'audio/webm'});const r=new FileReader();r.onload=()=>{const d=Math.floor((Date.now()-recStart)/1000);ws.send(JSON.stringify({type:'message',token:chatToken,message:'🎤 Voice',msgType:'voice',mediaUrl:r.result,duration:d}))};r.readAsDataURL(b);mediaRecorder.stream.getTracks().forEach(t=>t.stop())}
}

async function loadMsgs(){
try{const r=await fetch('/api/messages?token='+chatToken);const d=await r.json();if(d.success){document.getElementById('chatMessages').innerHTML='<div style="text-align:center;color:#94a3b8;font-size:11px;padding:8px">🔒 Secure</div>';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type||'text',m.mediaUrl,m.duration,m.createdAt))}}catch(e){}
}

function scrollChat(){const c=document.getElementById('chatMessages');setTimeout(()=>{c.scrollTop=c.scrollHeight},100)}

let tt;
document.getElementById('messageInput')?.addEventListener('input',()=>{
if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'typing',isTyping:true,token:chatToken}));clearTimeout(tt);tt=setTimeout(()=>ws.send(JSON.stringify({type:'typing',isTyping:false,token:chatToken})),2000)}
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
                            await saveMessage(user.chatId, 'admin', 'Hello! 👋 How can I help you?', 'text');
                            ws.send(JSON.stringify({ type: 'message', message: 'Hello! 👋 How can I help you?', sender: 'admin', msgType: 'text', timestamp: new Date().toISOString() }));
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
    
    // API
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { name, contact } = JSON.parse(body);
                if (!name || !contact) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const user = await findOrCreateUser(name, contact);
                const token = await createSession(user.chatId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, sessionToken: token }));
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
        const sessionId = cookies.sessionId;
        if (sessionId && adminSessions.has(sessionId)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(await getAdminPanelHTML());
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>body{font-family:'Inter',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:white;border-radius:16px;padding:28px;max-width:340px;width:100%;box-shadow:0 4px 16px rgba(0,0,0,0.06)}h1{text-align:center;color:#1e293b;margin-bottom:20px}input{width:100%;padding:10px;margin-bottom:10px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none}input:focus{border-color:#3b82f6;background:white}button{width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}button:hover{background:#1d4ed8}</style></head><body><div class="box"><h1>🔐 Admin</h1><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
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
    
    // Main page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML());
        return;
    }
    
    res.writeHead(404);
    res.end('404 Not Found');
});

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

async function getAdminPanelHTML() {
    const users = await getAllUsers();
    const usersWithInfo = [];
    
    for (const user of users) {
        const lastMsg = await getLastMessage(user.chatId);
        const unread = await getUnreadCount(user.chatId);
        usersWithInfo.push({ ...user, lastMessage: lastMsg, unread });
    }
    
    const usersHTML = usersWithInfo.map(user => `
<div onclick="openChat('${user.chatId}','${user.name.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;border-bottom:1px solid #e2e8f0;transition:all 0.2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
<div style="width:44px;height:44px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;flex-shrink:0">${user.name.charAt(0)}</div>
<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;color:#1e293b;font-size:14px">${user.name}</span><span style="font-size:11px;color:#94a3b8">${user.lastMessage?new Date(user.lastMessage.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</span></div><div style="display:flex;justify-content:space-between;margin-top:3px"><span style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.lastMessage?user.lastMessage.message.substring(0,30):'No messages'}</span>${user.unread>0?`<span style="background:#3b82f6;color:white;font-size:10px;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center">${user.unread}</span>`:''}</div></div>
</div>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#f8fafc;height:100vh;display:flex}.sidebar{width:360px;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column}.main{flex:1;display:flex;flex-direction:column;background:white}.header{background:#2563eb;color:white;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}.header a{color:rgba(255,255,255,0.8);text-decoration:none;font-size:13px}.chat-area{flex:1;overflow-y:auto;padding:16px;background:#f8fafc}.msg-out{background:#2563eb;color:white;border-radius:14px 4px 14px 14px;padding:9px 14px;max-width:70%;margin-bottom:6px;float:right;clear:both}.msg-in{background:white;color:#1e293b;border-radius:4px 14px 14px 14px;padding:9px 14px;max-width:70%;margin-bottom:6px;float:left;clear:both;box-shadow:0 1px 2px rgba(0,0,0,0.04)}</style></head><body><div class="sidebar"><div class="header"><span style="font-weight:600">💬 Chats</span><div style="display:flex;gap:12px"><a href="/">Site</a><a href="/admin/logout">Logout</a></div></div><div style="flex:1;overflow-y:auto">${usersHTML||'<div style="text-align:center;color:#94a3b8;padding:32px">No users yet</div>'}</div></div><div class="main" id="mainArea"><div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8"><div style="text-align:center">💬<br>Select a chat</div></div></div><script>
let ws,currentChatId=null;
function connect(){const p=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(p+'//'+location.host+'/admin/ws');ws.onmessage=(e)=>{const d=JSON.parse(e.data);if(d.type==='new_message'&&d.chatId===currentChatId)addMsg(d.message,d.sender,d.msgType,d.mediaUrl,d.duration)}}
async function openChat(cid,name){currentChatId=cid;document.getElementById('mainArea').innerHTML='<div class="header"><div style="display:flex;align-items:center;gap:8px"><div style="width:36px;height:36px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">'+name.charAt(0)+'</div><span>'+name+'</span></div></div><div class="chat-area" id="msgArea"><div id="msgs"></div></div><div style="padding:12px;display:flex;gap:8px;border-top:1px solid #e2e8f0;background:white"><input id="ai" style="flex:1;padding:10px 14px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:20px;font-size:13px;outline:none" placeholder="Type..." onkeypress="if(event.key===\\'Enter\\')send()"><button onclick="send()" style="width:38px;height:38px;background:#2563eb;border:none;border-radius:50%;color:white;cursor:pointer;font-size:16px">➤</button></div>';
const r=await fetch('/api/admin/messages?chatId='+cid);const d=await r.json();
if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt));scrollB()}}
function addMsg(text,sender,type,mediaUrl,duration,timestamp){const c=document.getElementById('msgs');if(!c)return;const t=new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});const b=sender==='user'?'msg-in':'msg-out';const a=sender==='user'?'left':'right';const d=document.createElement('div');d.style.clear='both';d.style.marginBottom='8px';let h='';if(type==='image')h='<div class="'+b+'"><img src="'+mediaUrl+'" style="max-width:200px;border-radius:8px"><div style="font-size:10px;opacity:0.7;text-align:right;margin-top:3px">'+t+'</div></div>';else h='<div class="'+b+'">'+text+'<div style="font-size:10px;opacity:0.7;text-align:right;margin-top:3px">'+t+'</div></div>';d.innerHTML=h;c.appendChild(d);scrollB()}
function scrollB(){const c=document.getElementById('msgArea');if(c)setTimeout(()=>c.scrollTop=c.scrollHeight,100)}
async function send(){const i=document.getElementById('ai'),m=i.value.trim();if(!m)return;i.value='';if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'admin_message',chatId:currentChatId,message:m}));await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:currentChatId,message:m})});addMsg(m,'admin','text',null,null,new Date().toISOString())}
connect();setInterval(()=>{if(currentChatId)fetch('/api/admin/messages?chatId='+currentChatId).then(r=>r.json()).then(d=>{if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(m=>addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt))}})},5000)
</script></body></html>`;
}

// Start
async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('========================================');
        console.log(' Baiilla Maach Verification Hub');
        console.log('========================================');
        console.log(' Site: http://localhost:' + PORT);
        console.log(' Admin: http://localhost:' + PORT + '/admin');
        console.log(' Login: Hammad / Hammad1122@');
        console.log(' Node 20.x Ready | Light Theme');
        console.log('========================================');
    });
}

start();

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
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const UPLOADS_DIR = path.join(__dir, 'uploads');

[ASSETS_DIR, COVER_MUSIC_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ASSETS = {
    profile: '/assets/tiktok_video_Aj2NO.jpeg',
    officialTT: '/assets/orginalss.png',
    officialFB: '/assets/fb_profile.jpg',
    realId: '/assets/real-id-ss.png',
    tiktokTick: '/assets/check-mark.png',
    fbTick: '/assets/social-media.png',
    tiktokIcon: '/assets/tiktokicon.png',
    fakeDanger: '/assets/baillamach.png',
    fakeFraud: '/assets/hammadfams.png',
    fakeDetect: '/assets/Fakedetect .png',
    reportImg: '/assets/report.png',
    flag: '/assets/flag.png',
    communication: '/assets/communication.png',
    chatIcon: '/assets/messageicon.gif',
    micAnim: '/assets/microphone-in-hand.gif',
    welcomeVoice: '/assets/realvoice.mp3',
    fakeVoice: '/assets/7 lak like but its fake.mp3'
};

// Database Connection
async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        const collections = ['users', 'messages', 'sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        await db.collection('users').createIndex({ phone: 1 }, { sparse: true });
        await db.collection('users').createIndex({ email: 1 }, { sparse: true });
        await db.collection('messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
        await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        
        console.log('✅ MongoDB Connected');
        return true;
    } catch (e) {
        console.error('❌ MongoDB Error:', e.message);
        return false;
    }
}

async function findOrCreateUser(name, contact) {
    const query = contact.includes('@') ? { email: contact } : { phone: contact };
    let user = await db.collection('users').findOne(query);
    
    if (user) {
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { name, lastSeen: new Date(), status: 'online' } }
        );
        return user;
    }
    
    const chatId = 'USR-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    user = {
        chatId, name,
        phone: contact.includes('@') ? '' : contact,
        email: contact.includes('@') ? contact : '',
        createdAt: new Date(), lastSeen: new Date(), status: 'active'
    };
    
    await db.collection('users').insertOne(user);
    return user;
}

async function createSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('sessions').insertOne({
        token, chatId, createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return token;
}

async function getUserByToken(token) {
    const session = await db.collection('sessions').findOne({ 
        token, 
        expiresAt: { $gt: new Date() } 
    });
    if (!session) return null;
    return await db.collection('users').findOne({ chatId: session.chatId });
}

async function getMessages(chatId, limit = 50) {
    return await db.collection('messages')
        .find({ chatId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
}

async function saveMessage(chatId, sender, message, type = 'text', mediaUrl = null, duration = null) {
    const msg = {
        chatId, sender, message, type,
        mediaUrl, duration,
        createdAt: new Date(),
        read: false
    };
    await db.collection('messages').insertOne(msg);
    return msg;
}

async function getAllUsers() {
    return await db.collection('users')
        .find({ status: 'active' })
        .sort({ lastSeen: -1 })
        .toArray();
}

async function getLastMessage(chatId) {
    return await db.collection('messages')
        .findOne({ chatId }, { sort: { createdAt: -1 } });
}

async function getUnreadCount(chatId) {
    return await db.collection('messages')
        .countDocuments({ chatId, sender: 'user', read: false });
}

async function markMessagesRead(chatId) {
    await db.collection('messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
}

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        
        return files
            .filter(f => audioExts.includes(path.extname(f).toLowerCase()))
            .map((f, i) => ({
                id: `track_${i}`,
                title: path.basename(f, path.extname(f)).replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                file: f,
                url: `/assets/covermusic/${encodeURIComponent(f)}`,
                index: i
            }))
            .sort((a, b) => a.index - b.index);
    } catch (e) {
        return [];
    }
}

const VERIFICATION = {
    profile: {
        name: 'Baiilla Maach Official',
        username: '@baiillamaach_official',
        photo: ASSETS.profile,
        bio: 'Official Entertainment Profile | Bangladesh 🇧🇩',
        followers: '5,000',
        following: '0',
        likes: '50K',
        location: 'Dhaka, Bangladesh'
    },
    officialAccounts: [
        {
            platform: 'TikTok',
            username: '@baiillamaach_official',
            url: 'https://tiktok.com/@baiillamaach_official',
            screenshot: ASSETS.officialTT,
            icon: ASSETS.tiktokIcon,
            badge: ASSETS.tiktokTick,
            followers: '5,000',
            likes: '50K'
        },
        {
            platform: 'Facebook',
            username: 'Baiilla Maach Official',
            url: 'https://www.facebook.com/profile.php?id=61575202118828',
            screenshot: ASSETS.officialFB,
            icon: ASSETS.fbTick,
            badge: ASSETS.fbTick,
            followers: 'Growing'
        }
    ],
    fakeAccounts: [
        {
            platform: 'TikTok',
            username: '@baiilla_mach',
            url: 'https://tiktok.com/@baiilla_mach',
            screenshot: ASSETS.fakeDanger,
            reason: 'Copies official content and logo to deceive followers.',
            threat: 'Critical',
            reports: 156
        },
        {
            platform: 'TikTok',
            username: '@hammad_fams0',
            url: 'https://tiktok.com/@hammad_fams0',
            screenshot: ASSETS.fakeFraud,
            reason: 'Uses official name and photo to mislead followers.',
            threat: 'High',
            reports: 89
        }
    ]
};

function getMainHTML() {
    const songs = getCoverSongs();
    const { profile, officialAccounts, fakeAccounts } = VERIFICATION;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<meta name="theme-color" content="#ffffff">
<title>${profile.name} | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-light: #dbeafe;
  --danger: #ef4444;
  --danger-light: #fee2e2;
  --success: #22c55e;
  --success-light: #dcfce7;
  --warning: #f59e0b;
  --warning-light: #fef3c7;
  --purple: #8b5cf6;
  --purple-light: #ede9fe;
  --surface: #ffffff;
  --surface-2: #f8fafc;
  --surface-3: #f1f5f9;
  --border: #e2e8f0;
  --text: #0f172a;
  --text-2: #334155;
  --text-3: #64748b;
  --text-4: #94a3b8;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.1);
}

*{margin:0;padding:0;box-sizing:border-box}

body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  background:linear-gradient(180deg,#f8fafc 0%,#ffffff 50%,#f1f5f9 100%);
  color:var(--text);
  min-height:100vh;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--text-4);border-radius:10px}

.container{max-width:640px;margin:0 auto;padding:0 16px}

/* Header */
.header{
  position:fixed;
  top:0;left:0;right:0;
  z-index:100;
  background:rgba(255,255,255,0.9);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(226,232,240,0.8);
  transition:transform 0.3s;
}
.header.hidden{transform:translateY(-100%)}
.header-inner{
  display:flex;
  align-items:center;
  justify-content:space-between;
  height:56px;
  gap:12px;
}
.header-left{display:flex;align-items:center;gap:8px;min-width:0}
.header-avatar{
  width:32px;height:32px;
  border-radius:50%;
  object-fit:cover;
  border:2px solid var(--primary-light);
  flex-shrink:0;
}
.header-title{
  font-weight:700;
  font-size:14px;
  white-space:nowrap;
  background:linear-gradient(135deg,var(--primary),var(--purple));
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  display:flex;
  align-items:center;
  gap:4px;
}
.header-tick{width:14px;height:14px;flex-shrink:0}
.header-nav{display:flex;gap:2px;flex-shrink:0}
.header-nav a{
  padding:6px 8px;
  font-size:11px;
  font-weight:500;
  color:var(--text-2);
  text-decoration:none;
  border-radius:20px;
  transition:all 0.2s;
  white-space:nowrap;
}
.header-nav a:hover{background:var(--surface-3);color:var(--primary)}

/* Sections */
.section{padding:24px 0}
.section-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.section-icon{
  width:36px;height:36px;
  border-radius:10px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:16px;
  flex-shrink:0;
}
.section-title{font-size:16px;font-weight:700}
.section-subtitle{font-size:11px;color:var(--text-3)}

/* Cards */
.card{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:16px;
  padding:16px;
  box-shadow:var(--shadow-sm);
}

/* Badges */
.badge{
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:4px 10px;
  border-radius:20px;
  font-size:11px;
  font-weight:600;
  white-space:nowrap;
}
.badge-verified{background:var(--primary-light);color:var(--primary)}
.badge-creator{background:var(--purple-light);color:var(--purple)}
.badge-danger{background:var(--danger-light);color:var(--danger)}
.badge-success{background:var(--success-light);color:var(--success)}

/* Buttons */
.btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  padding:10px 18px;
  border-radius:20px;
  font-size:13px;
  font-weight:600;
  text-decoration:none;
  border:none;
  cursor:pointer;
  transition:all 0.2s;
  white-space:nowrap;
}
.btn-primary{background:var(--primary);color:white;box-shadow:0 2px 8px rgba(37,99,235,0.3)}
.btn-primary:hover{background:var(--primary-dark);transform:translateY(-1px)}
.btn-outline{background:white;color:var(--text-2);border:1.5px solid var(--border)}
.btn-outline:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-light)}
.btn-danger{background:var(--danger);color:white}
.btn-danger:hover{background:#dc2626}

/* Hero */
.hero{padding-top:72px;text-align:center}
.hero-img-wrap{position:relative;display:inline-block;margin-bottom:12px}
.hero-img{
  width:88px;height:88px;
  border-radius:50%;
  object-fit:cover;
  border:3px solid white;
  box-shadow:var(--shadow-lg);
}
.hero-badge{
  position:absolute;
  bottom:3px;right:3px;
  width:26px;height:26px;
  background:var(--primary);
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  border:3px solid white;
}
.hero-badge img{width:13px;height:13px}
.hero-name{
  display:inline-flex;
  align-items:center;
  gap:6px;
  font-size:20px;
  font-weight:800;
  margin-bottom:4px;
}
.hero-bio{font-size:13px;color:var(--text-3);margin-bottom:16px}

/* Stats */
.stats-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  max-width:300px;
  margin:0 auto 16px;
}
.stat-item{
  background:white;
  border:1px solid var(--border);
  border-radius:12px;
  padding:12px 8px;
  text-align:center;
}
.stat-value{font-size:20px;font-weight:700}
.stat-label{font-size:10px;color:var(--text-3);font-weight:500;margin-top:2px}

/* Account cards */
.account-card{
  display:flex;
  align-items:center;
  gap:12px;
  padding:12px;
  background:var(--surface-2);
  border-radius:12px;
  border:1px solid var(--border);
}
.account-img{
  width:48px;height:48px;
  border-radius:8px;
  object-fit:cover;
  flex-shrink:0;
}
.account-info{min-width:0}
.account-name{
  display:flex;
  align-items:center;
  gap:3px;
  font-weight:600;
  font-size:13px;
}
.account-meta{font-size:11px;color:var(--text-3);margin-top:2px}

/* Fake card */
.fake-card{
  background:white;
  border:1px solid var(--danger-light);
  border-left:4px solid var(--danger);
  border-radius:16px;
  padding:16px;
  margin-bottom:12px;
}
.fake-img-wrap{
  position:relative;
  border-radius:12px;
  overflow:hidden;
  border:2px solid var(--danger-light);
  margin-bottom:12px;
}
.fake-img-wrap img{width:100%;display:block}
.fake-overlay{
  position:absolute;
  inset:0;
  background:rgba(239,68,68,0.15);
  display:flex;
  align-items:center;
  justify-content:center;
}
.fake-overlay span{
  background:var(--danger);
  color:white;
  padding:6px 16px;
  border-radius:20px;
  font-size:12px;
  font-weight:700;
}

/* Music */
.music-list{max-height:300px;overflow-y:auto}
.music-item{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px;
  border-radius:12px;
  cursor:pointer;
  transition:all 0.2s;
}
.music-item:hover{background:var(--surface-3)}
.music-item.playing{background:var(--primary-light)}
.music-num{width:24px;font-size:11px;color:var(--text-4);text-align:center;flex-shrink:0}
.music-info{flex:1;min-width:0}
.music-title{font-size:13px;font-weight:600}
.music-artist{font-size:11px;color:var(--text-3)}
.music-play{
  width:32px;height:32px;
  border-radius:50%;
  background:var(--success);
  color:white;
  border:none;
  cursor:pointer;
  flex-shrink:0;
  font-size:13px;
  transition:all 0.2s;
}

/* Identity */
.identity-card{text-align:center;padding:16px}
.identity-card img{
  max-width:100%;
  max-height:300px;
  border-radius:12px;
  border:2px solid var(--border);
  margin-bottom:12px;
}

/* Report */
.report-section{text-align:center;padding:16px}
.report-section img{max-width:180px;margin-bottom:12px}

/* ============ CHAT WIDGET ============ */
.chat-widget{position:fixed;bottom:20px;right:20px;z-index:999}
.chat-btn{
  width:56px;height:56px;
  border-radius:50%;
  cursor:pointer;
  box-shadow:0 4px 20px rgba(0,0,0,0.2);
  border:none;
  padding:0;
  overflow:hidden;
  background:white;
  animation:chatBounce 0.6s ease-out;
  transition:transform 0.2s;
}
@keyframes chatBounce{0%{transform:scale(0)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.chat-btn:hover{transform:scale(1.08)}
.chat-btn:active{transform:scale(0.95)}
.chat-btn img{width:100%;height:100%;object-fit:cover}
.chat-badge{
  position:absolute;
  top:-3px;right:-3px;
  background:var(--danger);
  color:white;
  border-radius:50%;
  width:22px;height:22px;
  font-size:10px;
  font-weight:700;
  display:none;
  align-items:center;
  justify-content:center;
  border:2px solid white;
}

.chat-window{
  position:fixed;
  bottom:88px;right:20px;
  width:370px;
  max-width:calc(100vw - 32px);
  height:500px;
  max-height:calc(100vh - 120px);
  background:white;
  border-radius:16px;
  overflow:hidden;
  box-shadow:0 20px 50px rgba(0,0,0,0.2);
  display:none;
  flex-direction:column;
  border:1px solid var(--border);
  animation:chatSlideUp 0.3s ease-out;
}
@keyframes chatSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.chat-window.open{display:flex}

.chat-top{
  background:var(--primary);
  color:white;
  padding:14px 16px;
  display:flex;
  align-items:center;
  gap:10px;
  flex-shrink:0;
}
.chat-top-avatar{
  width:40px;height:40px;
  border-radius:50%;
  object-fit:cover;
  border:2px solid rgba(255,255,255,0.3);
  flex-shrink:0;
}
.chat-top-info{flex:1;min-width:0}
.chat-top-name{font-weight:600;font-size:14px}
.chat-top-status{font-size:11px;opacity:0.85}
.chat-close-btn{
  background:none;
  border:none;
  color:white;
  font-size:22px;
  cursor:pointer;
  padding:4px 8px;
  opacity:0.8;
  transition:opacity 0.2s;
}
.chat-close-btn:hover{opacity:1}

.chat-messages{
  flex:1;
  overflow-y:auto;
  padding:16px;
  background:var(--surface-2);
}
.msg-row{
  display:flex;
  margin-bottom:6px;
}
.msg-row.user{justify-content:flex-end}
.msg-row.admin{justify-content:flex-start}
.msg-bubble{
  max-width:78%;
  padding:8px 12px;
  border-radius:14px;
  font-size:13px;
  line-height:1.45;
  word-wrap:break-word;
}
.msg-bubble.user{
  background:var(--primary);
  color:white;
  border-bottom-right-radius:4px;
}
.msg-bubble.admin{
  background:white;
  color:var(--text);
  border-bottom-left-radius:4px;
  box-shadow:0 1px 2px rgba(0,0,0,0.04);
}
.msg-img{
  max-width:200px;
  border-radius:10px;
  cursor:pointer;
  display:block;
}
.msg-voice{
  display:flex;
  align-items:center;
  gap:8px;
}
.msg-voice button{
  width:30px;height:30px;
  border-radius:50%;
  background:var(--success);
  color:white;
  border:none;
  cursor:pointer;
  font-size:12px;
  flex-shrink:0;
}
.msg-time{
  font-size:10px;
  opacity:0.7;
  text-align:right;
  margin-top:2px;
}

/* Typing */
.typing-indicator{
  display:none;
  padding:0 16px 8px;
}
.typing-bubble{
  display:inline-flex;
  gap:3px;
  padding:10px 14px;
  background:white;
  border-radius:14px;
  box-shadow:0 1px 2px rgba(0,0,0,0.04);
}
.typing-dot{
  width:6px;height:6px;
  border-radius:50%;
  background:var(--text-4);
  animation:typing 1.4s infinite;
}
.typing-dot:nth-child(2){animation-delay:0.2s}
.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-8px);opacity:1}}

/* Chat input */
.chat-input-area{
  display:flex;
  align-items:center;
  gap:6px;
  padding:10px 14px;
  background:white;
  border-top:1px solid var(--border);
  flex-shrink:0;
}
.chat-input{
  flex:1;
  border:1.5px solid var(--border);
  padding:9px 14px;
  border-radius:20px;
  font-size:13px;
  outline:none;
  background:var(--surface-2);
  transition:all 0.2s;
  min-width:0;
}
.chat-input:focus{border-color:var(--primary);background:white}
.chat-icon-btn{
  width:34px;height:34px;
  border-radius:50%;
  border:none;
  background:transparent;
  cursor:pointer;
  font-size:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  transition:all 0.2s;
}
.chat-icon-btn:hover{background:var(--surface-3)}
.chat-send-btn{
  width:38px;height:38px;
  border-radius:50%;
  background:var(--primary);
  color:white;
  border:none;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  font-size:16px;
  transition:all 0.2s;
}
.chat-send-btn:hover{background:var(--primary-dark);transform:scale(1.05)}

/* Recording bar */
.recording-bar{
  display:none;
  align-items:center;
  gap:8px;
  padding:8px 16px;
  background:var(--danger);
  color:white;
  font-size:12px;
  flex-shrink:0;
}
.rec-dot{
  width:8px;height:8px;
  background:white;
  border-radius:50%;
  animation:recPulse 1s infinite;
}
@keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.3}}

/* Image preview */
.img-preview{
  display:none;
  padding:8px 16px;
  background:white;
  position:relative;
  flex-shrink:0;
}
.img-preview img{max-height:70px;border-radius:8px}
.img-preview-close{
  position:absolute;
  top:4px;right:20px;
  background:rgba(0,0,0,0.6);
  color:white;
  border:none;
  border-radius:50%;
  width:20px;height:20px;
  cursor:pointer;
  font-size:10px;
}

/* Chat login */
.chat-login{
  padding:24px 16px;
  text-align:center;
}
.chat-login input{
  width:100%;
  padding:10px 14px;
  border:1.5px solid var(--border);
  border-radius:10px;
  font-size:13px;
  outline:none;
  background:var(--surface-2);
  margin-bottom:8px;
  transition:all 0.2s;
}
.chat-login input:focus{border-color:var(--primary);background:white}

/* Image viewer */
.img-viewer{
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.95);
  z-index:10000;
  align-items:center;
  justify-content:center;
  cursor:pointer;
}
.img-viewer.open{display:flex}
.img-viewer img{max-width:95%;max-height:90%;border-radius:8px}
.img-viewer-close{
  position:absolute;
  top:16px;right:16px;
  color:white;
  font-size:30px;
  cursor:pointer;
}

/* Audio floating */
.audio-floating{
  position:fixed;
  bottom:80px;
  left:16px;right:16px;
  max-width:400px;
  background:white;
  border-radius:14px;
  padding:12px 16px;
  box-shadow:var(--shadow-lg);
  display:none;
  align-items:center;
  gap:10px;
  z-index:99;
  border:1px solid var(--border);
}
.audio-floating.open{display:flex}
.audio-floating-info{flex:1;min-width:0}
.audio-floating-title{font-size:13px;font-weight:600}
.audio-floating-artist{font-size:11px;color:var(--text-3)}

/* Toast */
.toast{
  position:fixed;
  bottom:80px;
  left:50%;
  transform:translateX(-50%);
  background:var(--text);
  color:white;
  padding:10px 20px;
  border-radius:20px;
  font-size:13px;
  z-index:1000;
  animation:fadeIn 0.3s;
  pointer-events:none;
}
@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* Mobile */
@media(max-width:480px){
  .chat-window{
    width:100%;
    max-width:100%;
    bottom:0;
    right:0;
    border-radius:16px 16px 0 0;
    height:85vh;
    max-height:85vh;
  }
  .chat-btn{width:50px;height:50px}
  .hero-img{width:72px;height:72px}
}
</style>
</head>
<body>

<!-- Header -->
<header class="header" id="header">
  <div class="container">
    <div class="header-inner">
      <div class="header-left">
        <img src="${ASSETS.profile}" alt="" class="header-avatar" onerror="this.style.display='none'">
        <span class="header-title">
          Verification Hub
          <img src="${ASSETS.tiktokTick}" alt="✓" class="header-tick" onerror="this.style.display='none'">
        </span>
      </div>
      <nav class="header-nav">
        <a href="#official">Official</a>
        <a href="#fake">Fakes</a>
        <a href="#identity">ID Proof</a>
        ${songs.length ? '<a href="#music">Music</a>' : ''}
        <a href="#help">Help</a>
      </nav>
    </div>
  </div>
</header>

<main class="container" style="padding-bottom:40px">

<!-- Hero -->
<section class="hero">
  <div class="hero-img-wrap">
    <img src="${ASSETS.profile}" alt="" class="hero-img" onerror="this.style.display='none'">
    <div class="hero-badge">
      <img src="${ASSETS.tiktokTick}" alt="✓" onerror="this.style.display='none'">
    </div>
  </div>
  <h1 class="hero-name">
    ${profile.name}
    <img src="${ASSETS.tiktokTick}" alt="✓" style="width:18px;height:18px" onerror="this.style.display='none'">
  </h1>
  <p class="hero-bio">${profile.bio}</p>
  
  <div class="stats-grid">
    <div class="stat-item"><div class="stat-value">${profile.followers}</div><div class="stat-label">Followers</div></div>
    <div class="stat-item"><div class="stat-value">${profile.following}</div><div class="stat-label">Following</div></div>
    <div class="stat-item"><div class="stat-value">${profile.likes}</div><div class="stat-label">Likes</div></div>
  </div>
  
  <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:16px">
    <span class="badge badge-verified">✓ Verified Official</span>
    <span class="badge badge-creator">Premium Creator</span>
  </div>
  
  <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
    <a href="${officialAccounts[0].url}" target="_blank" class="btn btn-primary">
      <img src="${ASSETS.tiktokIcon}" alt="" style="width:16px;height:16px" onerror="this.style.display='none'">
      TikTok
    </a>
    <a href="${officialAccounts[1].url}" target="_blank" class="btn btn-primary" style="background:#1877f2">
      Facebook
    </a>
  </div>
</section>

<!-- Official Accounts -->
<section class="section" id="official">
  <div class="section-header">
    <div class="section-icon" style="background:var(--primary-light)">✅</div>
    <div>
      <div class="section-title">Official Verified Accounts</div>
      <div class="section-subtitle">The only authentic profiles</div>
    </div>
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    ${officialAccounts.map(acc => `
    <div class="account-card">
      <img src="${acc.screenshot}" alt="" class="account-img" onerror="this.style.display='none'">
      <div class="account-info">
        <div class="account-name">
          ${acc.username}
          <img src="${acc.badge}" alt="✓" style="width:14px;height:14px" onerror="this.style.display='none'">
        </div>
        <div class="account-meta">${acc.platform} · ${acc.followers} followers${acc.likes ? ' · '+acc.likes+' likes' : ''}</div>
      </div>
      <a href="${acc.url}" target="_blank" class="btn btn-primary" style="margin-left:auto;flex-shrink:0;font-size:11px;padding:8px 14px">Follow</a>
    </div>
    `).join('')}
  </div>
</section>

<!-- Identity Verification -->
<section class="section" id="identity">
  <div class="section-header">
    <div class="section-icon" style="background:var(--success-light)">🛡️</div>
    <div>
      <div class="section-title">Identity Verification</div>
      <div class="section-subtitle">Government verified identity proof</div>
    </div>
  </div>
  <div class="card identity-card">
    <img src="${ASSETS.realId}" alt="Identity Proof" onerror="this.style.display='none'">
    <p style="font-size:13px;color:var(--text-2);margin-bottom:8px">
      <strong>✅ Verified Identity</strong><br>
      This profile has been verified through official government documentation.
    </p>
    <span class="badge badge-success">✓ Identity Confirmed</span>
  </div>
</section>

<!-- Fake Accounts -->
<section class="section" id="fake">
  <div class="section-header">
    <div class="section-icon" style="background:var(--danger-light)">⚠️</div>
    <div>
      <div class="section-title">Fake Accounts Detected</div>
      <div class="section-subtitle">Help us report these impersonators</div>
    </div>
    <span class="badge badge-danger" style="margin-left:auto">${fakeAccounts.length} Active</span>
  </div>
  
  <div style="text-align:center;margin-bottom:16px">
    <img src="${ASSETS.fakeDetect}" alt="Fake Detection" style="max-width:140px;border-radius:12px" onerror="this.style.display='none'">
  </div>
  
  ${fakeAccounts.map((acc, i) => `
  <div class="fake-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:16px">⚠️</span>
        <strong style="color:var(--danger);font-size:14px">Fake #${i+1}</strong>
      </div>
      <span class="badge badge-danger">${acc.threat} Threat</span>
    </div>
    
    <div class="fake-img-wrap">
      <img src="${acc.screenshot}" alt="Fake" onerror="this.style.display='none'">
      <div class="fake-overlay"><span>⚠️ FAKE ACCOUNT</span></div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px">
      <div style="background:var(--danger-light);padding:8px 10px;border-radius:8px"><span style="color:var(--text-3)">Platform:</span> <strong>${acc.platform}</strong></div>
      <div style="background:var(--danger-light);padding:8px 10px;border-radius:8px"><span style="color:var(--text-3)">Username:</span> <strong style="color:var(--danger)">${acc.username}</strong></div>
      <div style="background:var(--danger-light);padding:8px 10px;border-radius:8px"><span style="color:var(--text-3)">Reports:</span> <strong>${acc.reports}+</strong></div>
      <div style="background:var(--danger-light);padding:8px 10px;border-radius:8px"><span style="color:var(--text-3)">Threat:</span> <strong style="color:var(--danger)">${acc.threat}</strong></div>
    </div>
    
    <div style="background:var(--danger-light);padding:10px;border-radius:8px;font-size:12px;color:var(--danger);margin-bottom:10px">
      <img src="${ASSETS.flag}" alt="" style="width:14px;height:14px;vertical-align:middle;margin-right:4px" onerror="this.style.display='none'">
      ${acc.reason}
    </div>
    
    <div style="display:flex;gap:8px">
      <a href="${acc.url}" target="_blank" class="btn btn-danger" style="flex:1;font-size:11px">Report</a>
      <button onclick="copyText('${acc.username}')" class="btn btn-outline" style="flex:1;font-size:11px">Copy</button>
    </div>
  </div>
  `).join('')}
  
  <div style="text-align:center;margin-top:16px">
    <button onclick="playFakeVoice()" class="btn btn-outline" style="color:var(--danger);border-color:var(--danger-light);font-size:12px">
      🔊 Listen to Voice Alert
    </button>
  </div>
</section>

<!-- Report Section -->
<section class="section">
  <div class="section-header">
    <div class="section-icon" style="background:var(--warning-light)">📢</div>
    <div>
      <div class="section-title">Report Fake Accounts</div>
      <div class="section-subtitle">Your report helps protect others</div>
    </div>
  </div>
  <div class="card report-section">
    <img src="${ASSETS.reportImg}" alt="Report" onerror="this.style.display='none'">
    <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">
      If you find any account impersonating Baiilla Maach, report it immediately.
    </p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <a href="${fakeAccounts[0].url}" target="_blank" class="btn btn-danger" style="font-size:12px">
        <img src="${ASSETS.flag}" alt="" style="width:14px;height:14px" onerror="this.style.display='none'">
        Report on TikTok
      </a>
      <button onclick="showToast('Report submitted!')" class="btn btn-outline" style="font-size:12px">Submit Report</button>
    </div>
  </div>
</section>

${songs.length ? `
<!-- Cover Music -->
<section class="section" id="music">
  <div class="section-header">
    <div class="section-icon" style="background:var(--success-light)">🎵</div>
    <div>
      <div class="section-title">Cover Music</div>
      <div class="section-subtitle">${songs.length} tracks</div>
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div class="music-list">
      ${songs.map((s, i) => `
      <div class="music-item" data-url="${s.url}" data-title="${s.title}" onclick="playTrack(this,'${s.url}','${s.title}')">
        <div class="music-num">${String(i+1).padStart(2,'0')}</div>
        <div class="music-info">
          <div class="music-title">${s.title}</div>
          <div class="music-artist">Cover Song</div>
        </div>
        <button class="music-play" data-btn>▶</button>
      </div>
      `).join('')}
    </div>
  </div>
</section>
` : ''}

<!-- Help Section -->
<section class="section" id="help">
  <div class="section-header">
    <div class="section-icon" style="background:var(--purple-light)">💬</div>
    <div>
      <div class="section-title">Need Help?</div>
      <div class="section-subtitle">Chat with us directly</div>
    </div>
  </div>
  <div class="card" style="text-align:center">
    <img src="${ASSETS.communication}" alt="Contact" style="max-width:120px;margin:0 auto 12px" onerror="this.style.display='none'">
    <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">
      Have questions about verification? Chat with us.
    </p>
    <button onclick="openChatWindow()" class="btn btn-primary">
      💬 Start Chat
    </button>
  </div>
</section>

</main>

<!-- Audio Elements -->
<audio id="welcomeAudio" src="${ASSETS.welcomeVoice}" preload="none"></audio>
<audio id="fakeAudio" src="${ASSETS.fakeVoice}" preload="none"></audio>
<audio id="musicAudio" preload="none"></audio>

<!-- Floating Music Player -->
<div class="audio-floating" id="audioFloating">
  <button id="floatingPlayBtn" onclick="toggleFloatingPlay()" style="width:34px;height:34px;border-radius:50%;background:var(--success);color:white;border:none;cursor:pointer;font-size:14px;flex-shrink:0">▶</button>
  <div class="audio-floating-info">
    <div class="audio-floating-title" id="floatingTitle">No track</div>
    <div class="audio-floating-artist">Cover Song</div>
  </div>
  <button onclick="closeFloatingPlayer()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3);padding:4px">✕</button>
</div>

<!-- Image Viewer -->
<div class="img-viewer" id="imgViewer" onclick="closeImageViewer()">
  <span class="img-viewer-close">✕</span>
  <img id="viewerImg" src="" alt="">
</div>

<!-- Toast -->
<div class="toast" id="toast" style="display:none"></div>

<!-- ============ CHAT WIDGET ============ -->
<div class="chat-widget">
  <button class="chat-btn" id="chatBtn" onclick="openChatWindow()" title="Chat with us">
    <img src="${ASSETS.chatIcon}" alt="Chat" onerror="this.style.display='none'">
  </button>
  <span class="chat-badge" id="chatBadge">0</span>
  
  <div class="chat-window" id="chatWindow">
    <div class="chat-top">
      <img src="${ASSETS.profile}" alt="" class="chat-top-avatar" onerror="this.style.display='none'">
      <div class="chat-top-info">
        <div class="chat-top-name">Hammad Bin Amir</div>
        <div class="chat-top-status" id="chatStatusText">Online</div>
      </div>
      <button class="chat-close-btn" onclick="closeChatWindow()">✕</button>
    </div>
    
    <!-- Login Form -->
    <div id="chatLoginForm" class="chat-login">
      <p style="color:var(--text-3);font-size:13px;margin-bottom:12px">Enter your details to start</p>
      <input type="text" id="chatNameInput" placeholder="Your name">
      <input type="text" id="chatContactInput" placeholder="Phone number or email">
      <button onclick="registerUser()" class="btn btn-primary" style="width:100%;justify-content:center">Start Chat</button>
      <p style="color:var(--text-4);font-size:10px;margin-top:8px">Use same info to restore previous chats</p>
    </div>
    
    <!-- Chat Interface -->
    <div id="chatMainUI" style="display:none;flex:1;flex-direction:column">
      <div class="chat-messages" id="chatMessagesContainer">
        <div style="text-align:center;padding:16px">
          <span style="background:var(--surface-3);color:var(--text-4);font-size:10px;padding:4px 10px;border-radius:10px">🔒 Messages are secure</span>
        </div>
      </div>
      
      <div class="typing-indicator" id="typingIndicator">
        <div class="typing-bubble">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
      
      <div class="img-preview" id="imagePreviewBar">
        <img id="previewImage" src="" alt="">
        <button class="img-preview-close" onclick="clearImagePreview()">✕</button>
      </div>
      
      <div class="recording-bar" id="recordingBar">
        <div class="rec-dot"></div>
        <span>Recording voice...</span>
        <span id="recordingTime" style="margin-left:auto">00:00</span>
      </div>
      
      <div class="chat-input-area">
        <input type="file" id="imageFileInput" accept="image/*" style="display:none" onchange="handleImageSelect(event)">
        <button class="chat-icon-btn" onclick="document.getElementById('imageFileInput').click()" title="Send image">🖼️</button>
        <input type="text" id="messageTextInput" class="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
        <button class="chat-icon-btn" id="micButton" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Voice message">🎤</button>
        <button class="chat-send-btn" onclick="sendMessage()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<script>
// ============ GLOBAL STATE ============
let webSocket = null;
let userToken = localStorage.getItem('vh_chat_token');
let userChatId = null;
let selectedImageData = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingTimer = null;
let currentTrackElement = null;
let currentTrackUrl = '';
let floatingPlayer = document.getElementById('musicAudio');

// ============ HEADER SCROLL ============
let lastScrollPosition = 0;
window.addEventListener('scroll', function() {
  var header = document.getElementById('header');
  var currentScroll = window.scrollY;
  if (currentScroll > lastScrollPosition && currentScroll > 80) {
    header.classList.add('hidden');
  } else {
    header.classList.remove('hidden');
  }
  lastScrollPosition = currentScroll;
}, { passive: true });

// ============ WELCOME VOICE ============
if (!sessionStorage.getItem('vh_welcome_played')) {
  setTimeout(function() {
    var audio = document.getElementById('welcomeAudio');
    if (audio) {
      audio.play().catch(function() {});
      sessionStorage.setItem('vh_welcome_played', '1');
    }
  }, 3000);
}

// ============ FAKE VOICE ============
function playFakeVoice() {
  var audio = document.getElementById('fakeAudio');
  if (audio) audio.play().catch(function() {});
}

// ============ MUSIC PLAYER ============
function playTrack(element, url, title) {
  // Remove playing class from all
  var allItems = document.querySelectorAll('.music-item');
  allItems.forEach(function(item) { item.classList.remove('playing'); });
  element.classList.add('playing');
  
  // Reset all play buttons
  var allBtns = document.querySelectorAll('[data-btn]');
  allBtns.forEach(function(btn) { btn.textContent = '▶'; });
  
  if (currentTrackUrl === url && !floatingPlayer.paused) {
    floatingPlayer.pause();
    updateFloatingUI(false);
    currentTrackUrl = '';
    return;
  }
  
  currentTrackUrl = url;
  currentTrackElement = element;
  floatingPlayer.src = url;
  floatingPlayer.play().catch(function() {});
  
  element.querySelector('[data-btn]').textContent = '⏸';
  
  document.getElementById('floatingTitle').textContent = title;
  document.getElementById('floatingPlayBtn').textContent = '⏸';
  document.getElementById('audioFloating').classList.add('open');
  
  floatingPlayer.onended = function() {
    element.querySelector('[data-btn]').textContent = '▶';
    updateFloatingUI(false);
    currentTrackUrl = '';
  };
}

function toggleFloatingPlay() {
  if (!currentTrackUrl) return;
  if (floatingPlayer.paused) {
    floatingPlayer.play();
    updateFloatingUI(true);
  } else {
    floatingPlayer.pause();
    updateFloatingUI(false);
  }
}

function updateFloatingUI(playing) {
  document.getElementById('floatingPlayBtn').textContent = playing ? '⏸' : '▶';
}

function closeFloatingPlayer() {
  floatingPlayer.pause();
  floatingPlayer.src = '';
  currentTrackUrl = '';
  currentTrackElement = null;
  document.getElementById('audioFloating').classList.remove('open');
  var allBtns = document.querySelectorAll('[data-btn]');
  allBtns.forEach(function(btn) { btn.textContent = '▶'; });
  var allItems = document.querySelectorAll('.music-item');
  allItems.forEach(function(item) { item.classList.remove('playing'); });
}

// ============ TOAST ============
var toastTimeout;
function showToast(message) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function() { toast.style.display = 'none'; }, 2500);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copied: ' + text);
  }).catch(function() {
    showToast('Failed to copy');
  });
}

// ============ IMAGE VIEWER ============
function openImageViewer(url) {
  document.getElementById('viewerImg').src = url;
  document.getElementById('imgViewer').classList.add('open');
}

function closeImageViewer() {
  document.getElementById('imgViewer').classList.remove('open');
}

// ============ CHAT SYSTEM ============
function openChatWindow() {
  var chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.add('open');
  
  if (!webSocket || webSocket.readyState !== 1) {
    connectWebSocket();
  }
}

function closeChatWindow() {
  document.getElementById('chatWindow').classList.remove('open');
}

function connectWebSocket() {
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  webSocket = new WebSocket(protocol + '//' + location.host + '/ws');
  
  webSocket.onopen = function() {
    console.log('✅ Chat connected');
    document.getElementById('chatStatusText').textContent = 'Online';
    
    // Auto-auth if we have a saved token
    if (userToken) {
      webSocket.send(JSON.stringify({ type: 'auth', token: userToken }));
    }
  };
  
  webSocket.onmessage = function(event) {
    var data = JSON.parse(event.data);
    
    if (data.type === 'auth_success') {
      showChatInterface();
      loadChatHistory();
    } else if (data.type === 'message') {
      addChatMessage(data.message, data.sender, data.msgType || 'text', data.mediaUrl, data.duration, data.timestamp);
    } else if (data.type === 'typing') {
      var typingInd = document.getElementById('typingIndicator');
      typingInd.style.display = data.isTyping ? 'block' : 'none';
      document.getElementById('chatStatusText').textContent = data.isTyping ? 'typing...' : 'Online';
      scrollChatToBottom();
    }
  };
  
  webSocket.onclose = function() {
    console.log('❌ Chat disconnected');
    document.getElementById('chatStatusText').textContent = 'Offline';
    
    // Reconnect after 3 seconds
    setTimeout(function() {
      if (document.getElementById('chatWindow').classList.contains('open')) {
        connectWebSocket();
      }
    }, 3000);
  };
  
  webSocket.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

function registerUser() {
  var name = document.getElementById('chatNameInput').value.trim();
  var contact = document.getElementById('chatContactInput').value.trim();
  
  if (!name || !contact) {
    showToast('Please fill all fields');
    return;
  }
  
  fetch('/api/chat/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, contact: contact })
  })
  .then(function(response) { return response.json(); })
  .then(function(data) {
    if (data.success) {
      userToken = data.sessionToken;
      userChatId = data.chatId;
      localStorage.setItem('vh_chat_token', userToken);
      
      showChatInterface();
      
      if (webSocket && webSocket.readyState === 1) {
        webSocket.send(JSON.stringify({ type: 'auth', token: userToken }));
      } else {
        connectWebSocket();
      }
    } else {
      showToast(data.error || 'Registration failed');
    }
  })
  .catch(function(error) {
    showToast('Connection error. Please try again.');
  });
}

function showChatInterface() {
  document.getElementById('chatLoginForm').style.display = 'none';
  document.getElementById('chatMainUI').style.display = 'flex';
}

function sendMessage() {
  var input = document.getElementById('messageTextInput');
  var message = input.value.trim();
  
  if (!message && !selectedImageData) return;
  
  if (selectedImageData) {
    webSocket.send(JSON.stringify({
      type: 'message',
      token: userToken,
      message: message || '🖼️ Image',
      msgType: 'image',
      mediaUrl: selectedImageData
    }));
    clearImagePreview();
  } else {
    webSocket.send(JSON.stringify({
      type: 'message',
      token: userToken,
      message: message,
      msgType: 'text'
    }));
  }
  
  input.value = '';
  input.focus();
}

function addChatMessage(text, sender, type, mediaUrl, duration, timestamp) {
  var container = document.getElementById('chatMessagesContainer');
  var row = document.createElement('div');
  var time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var rowClass = sender === 'user' ? 'user' : 'admin';
  var bubbleClass = sender === 'user' ? 'user' : 'admin';
  var html = '';
  
  if (type === 'image') {
    html = '<div class="msg-row ' + rowClass + '"><div class="msg-bubble ' + bubbleClass + '"><img src="' + mediaUrl + '" class="msg-img" onclick="openImageViewer(\'' + mediaUrl + '\')"><div class="msg-time">' + time + '</div></div></div>';
  } else if (type === 'voice') {
    html = '<div class="msg-row ' + rowClass + '"><div class="msg-bubble ' + bubbleClass + '"><div class="msg-voice"><button onclick="playVoiceMessage(this, \'' + mediaUrl + '\')">▶</button><span style="font-size:12px">🎤 ' + (duration || 0) + 's</span></div><div class="msg-time">' + time + '</div></div></div>';
  } else {
    html = '<div class="msg-row ' + rowClass + '"><div class="msg-bubble ' + bubbleClass + '">' + escapeHtml(text) + '<div class="msg-time">' + time + '</div></div></div>';
  }
  
  row.innerHTML = html;
  container.appendChild(row);
  scrollChatToBottom();
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function playVoiceMessage(button, url) {
  var audio = new Audio(url);
  audio.play();
  button.textContent = '⏸';
  audio.onended = function() { button.textContent = '▶'; };
}

function handleImageSelect(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    selectedImageData = e.target.result;
    document.getElementById('previewImage').src = selectedImageData;
    document.getElementById('imagePreviewBar').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function clearImagePreview() {
  selectedImageData = null;
  document.getElementById('imagePreviewBar').style.display = 'none';
  document.getElementById('imageFileInput').value = '';
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function(stream) {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = function(event) {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.start();
      
      document.getElementById('micButton').style.color = '#ef4444';
      document.getElementById('recordingBar').style.display = 'flex';
      
      recordingStartTime = Date.now();
      recordingTimer = setInterval(function() {
        var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        document.getElementById('recordingTime').textContent = 
          String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
      }, 1000);
    })
    .catch(function() {
      showToast('Microphone access denied');
    });
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  
  mediaRecorder.stop();
  document.getElementById('micButton').style.color = '';
  document.getElementById('recordingBar').style.display = 'none';
  clearInterval(recordingTimer);
  
  mediaRecorder.onstop = function() {
    var blob = new Blob(audioChunks, { type: 'audio/webm' });
    var reader = new FileReader();
    
    reader.onload = function() {
      var duration = Math.floor((Date.now() - recordingStartTime) / 1000);
      webSocket.send(JSON.stringify({
        type: 'message',
        token: userToken,
        message: '🎤 Voice message',
        msgType: 'voice',
        mediaUrl: reader.result,
        duration: duration
      }));
    };
    
    reader.readAsDataURL(blob);
    mediaRecorder.stream.getTracks().forEach(function(track) { track.stop(); });
  };
}

function loadChatHistory() {
  if (!userToken) return;
  
  fetch('/api/messages?token=' + userToken)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success && data.messages.length > 0) {
        document.getElementById('chatMessagesContainer').innerHTML = '';
        data.messages.forEach(function(msg) {
          addChatMessage(msg.message, msg.sender, msg.type || 'text', msg.mediaUrl, msg.duration, msg.createdAt);
        });
      }
    })
    .catch(function() {});
}

function scrollChatToBottom() {
  var container = document.getElementById('chatMessagesContainer');
  setTimeout(function() {
    container.scrollTop = container.scrollHeight;
  }, 50);
}

// Typing indicator
var typingTimeoutId;
document.getElementById('messageTextInput').addEventListener('input', function() {
  if (webSocket && webSocket.readyState === 1) {
    webSocket.send(JSON.stringify({ type: 'typing', isTyping: true, token: userToken }));
    clearTimeout(typingTimeoutId);
    typingTimeoutId = setTimeout(function() {
      webSocket.send(JSON.stringify({ type: 'typing', isTyping: false, token: userToken }));
    }, 2000);
  }
});

// ============ INIT ============
// Auto-connect if chat was previously open
if (userToken) {
  setTimeout(function() {
    connectWebSocket();
  }, 1000);
}
</script>
</body>
</html>`;
}

// WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
const userSockets = new Map();
const adminSockets = new Set();

wss.on('connection', (ws, req) => {
    const pathname = url.parse(req.url).pathname;
    
    if (pathname === '/ws') {
        let userData = null;
        
        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg);
                
                if (data.type === 'auth') {
                    const user = await getUserByToken(data.token);
                    if (user) {
                        userData = user;
                        userSockets.set(user.chatId, ws);
                        ws.send(JSON.stringify({ type: 'auth_success' }));
                        
                        setTimeout(async () => {
                            const welcomeMsg = 'Hello! 👋 Welcome to Baiilla Maach Official Support. How can I help you today?';
                            await saveMessage(user.chatId, 'admin', welcomeMsg, 'text');
                            ws.send(JSON.stringify({
                                type: 'message',
                                message: welcomeMsg,
                                sender: 'admin',
                                msgType: 'text',
                                timestamp: new Date().toISOString()
                            }));
                            notifyAdmins({
                                type: 'new_message',
                                chatId: user.chatId,
                                name: user.name,
                                message: welcomeMsg,
                                sender: 'admin'
                            });
                        }, 1500);
                    }
                } else if (data.type === 'message' && userData) {
                    await saveMessage(userData.chatId, 'user', data.message, data.msgType || 'text', data.mediaUrl, data.duration);
                    ws.send(JSON.stringify({
                        type: 'message',
                        message: data.message,
                        sender: 'user',
                        msgType: data.msgType,
                        mediaUrl: data.mediaUrl,
                        duration: data.duration,
                        timestamp: new Date().toISOString()
                    }));
                    notifyAdmins({
                        type: 'new_message',
                        chatId: userData.chatId,
                        name: userData.name,
                        message: data.message,
                        sender: 'user',
                        msgType: data.msgType,
                        mediaUrl: data.mediaUrl,
                        duration: data.duration
                    });
                } else if (data.type === 'typing' && userData) {
                    notifyAdmins({
                        type: 'user_typing',
                        chatId: userData.chatId,
                        isTyping: data.isTyping
                    });
                }
            } catch (e) {
                console.error('WS error:', e.message);
            }
        });
        
        ws.on('close', () => {
            if (userData) {
                userSockets.delete(userData.chatId);
                db.collection('users').updateOne(
                    { chatId: userData.chatId },
                    { $set: { lastSeen: new Date(), status: 'offline' } }
                ).catch(() => {});
            }
        });
    } else if (pathname === '/admin/ws') {
        adminSockets.add(ws);
        
        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.type === 'admin_message') {
                    await saveMessage(data.chatId, 'admin', data.message, data.msgType || 'text', data.mediaUrl, data.duration);
                    const userWs = userSockets.get(data.chatId);
                    if (userWs && userWs.readyState === 1) {
                        userWs.send(JSON.stringify({
                            type: 'message',
                            message: data.message,
                            sender: 'admin',
                            msgType: data.msgType,
                            mediaUrl: data.mediaUrl,
                            duration: data.duration,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            } catch (e) {
                console.error('Admin WS error:', e.message);
            }
        });
        
        ws.on('close', () => adminSockets.delete(ws));
    }
});

function notifyAdmins(data) {
    adminSockets.forEach(ws => {
        if (ws.readyState === 1) ws.send(JSON.stringify(data));
    });
}

// Admin sessions
const adminSessions = new Map();

// HTTP Server
const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Static files
    if (pathname.startsWith('/assets/') || pathname.startsWith('/uploads/')) {
        const filePath = path.join(__dir, decodeURIComponent(pathname));
        
        if (!filePath.startsWith(path.join(__dir, 'assets')) && !filePath.startsWith(path.join(__dir, 'uploads'))) {
            res.writeHead(403);
            res.end();
            return;
        }
        
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.aac': 'audio/aac', '.flac': 'audio/flac'
            };
            
            res.writeHead(200, {
                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }
    
    // API: Register
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, contact } = JSON.parse(body);
                if (!name || !contact) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Name and contact required' }));
                    return;
                }
                const user = await findOrCreateUser(name, contact);
                const token = await createSession(user.chatId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, sessionToken: token }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });
        return;
    }
    
    // API: Messages
    if (pathname === '/api/messages' && method === 'GET') {
        const token = parsed.query.token;
        if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        const user = await getUserByToken(token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        const messages = await getMessages(user.chatId);
        await markMessagesRead(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    // Admin
    if (pathname === '/admin') {
        const sessionId = cookies.sessionId;
        if (sessionId && adminSessions.has(sessionId)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(await getAdminHTML());
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>body{font-family:'Inter',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:white;border-radius:16px;padding:32px;width:340px;box-shadow:0 4px 16px rgba(0,0,0,0.06)}h1{text-align:center;color:#0f172a;margin-bottom:20px}input{width:100%;padding:10px;margin-bottom:10px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box}input:focus{border-color:#2563eb;background:white}button{width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}button:hover{background:#1d4ed8}</style></head><body><div class="box"><h1>🔐 Admin Login</h1><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
        return;
    }
    
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            const params = new URLSearchParams(body);
            if (params.get('username') === 'Hammad' && params.get('password') === 'Hammad1122@') {
                const sid = crypto.randomBytes(32).toString('hex');
                adminSessions.set(sid, { username: 'Hammad', loginAt: new Date() });
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sid}; HttpOnly; Path=/; Max-Age=86400`
                });
                res.end();
            } else {
                res.writeHead(302, { 'Location': '/admin?error=1' });
                res.end();
            }
        });
        return;
    }
    
    if (pathname === '/admin/logout') {
        const sid = cookies.sessionId;
        if (sid) adminSessions.delete(sid);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
        });
        res.end();
        return;
    }
    
    if (pathname === '/api/admin/messages' && method === 'GET') {
        const chatId = parsed.query.chatId;
        if (!chatId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
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
            try {
                const { chatId, message } = JSON.parse(body);
                if (!chatId || !message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false }));
                    return;
                }
                await saveMessage(chatId, 'admin', message);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }
    
    // Main page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(getMainHTML());
        return;
    }
    
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
    const pathname = url.parse(req.url).pathname;
    if (pathname === '/ws' || pathname === '/admin/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    } else {
        socket.destroy();
    }
});

function parseCookies(header) {
    const cookies = {};
    if (header) {
        header.split(';').forEach(c => {
            const [name, ...val] = c.split('=');
            if (name) cookies[name.trim()] = val.join('=').trim();
        });
    }
    return cookies;
}

async function getAdminHTML() {
    const users = await getAllUsers();
    const usersWithInfo = [];
    
    for (const user of users) {
        const lastMsg = await getLastMessage(user.chatId);
        const unread = await getUnreadCount(user.chatId);
        usersWithInfo.push({ ...user, lastMessage: lastMsg, unread });
    }
    
    const userListHTML = usersWithInfo.length ? usersWithInfo.map(u => `
    <div class="user-item" onclick="openChat('${u.chatId}','${u.name.replace(/'/g,"\\'")}')">
      <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-preview">${u.lastMessage ? u.lastMessage.message.substring(0, 30) : 'No messages'}</div>
      </div>
      <div class="user-meta">
        <div class="user-time">${u.lastMessage ? new Date(u.lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</div>
        ${u.unread > 0 ? `<div class="user-badge">${u.unread}</div>` : ''}
      </div>
    </div>
    `).join('') : '<div style="text-align:center;color:#94a3b8;padding:40px">No users yet</div>';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin | Verification Hub</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8fafc;height:100vh;display:flex}
.sidebar{width:360px;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column}
.sidebar-header{padding:16px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:space-between}
.sidebar-header a{color:rgba(255,255,255,0.8);text-decoration:none;font-size:13px}
.user-list{flex:1;overflow-y:auto}
.user-item{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background 0.15s}
.user-item:hover{background:#f8fafc}
.user-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#8b5cf6);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0}
.user-info{flex:1;min-width:0}
.user-name{font-weight:600;font-size:14px;color:#0f172a}
.user-preview{font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.user-meta{text-align:right;flex-shrink:0}
.user-time{font-size:11px;color:#94a3b8}
.user-badge{background:#2563eb;color:white;font-size:10px;font-weight:700;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;margin-top:4px;margin-left:auto}
.main{flex:1;display:flex;flex-direction:column;background:white}
.chat-header{padding:16px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px}
.chat-avatar{width:40px;height:40px;border-radius:50%;background:#f59e0b;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.chat-msgs{flex:1;overflow-y:auto;padding:16px;background:#f8fafc}
.msg-bubble{max-width:70%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.45;margin-bottom:6px;word-wrap:break-word}
.msg-in{background:white;color:#0f172a;float:left;clear:both;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}
.msg-out{background:#2563eb;color:white;float:right;clear:both;border-bottom-right-radius:4px}
.msg-time{font-size:10px;opacity:0.7;text-align:right;margin-top:3px}
.msg-img{max-width:200px;border-radius:10px;cursor:pointer}
.chat-input-area{padding:12px 16px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:8px}
.chat-input-area input{flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;font-size:13px;outline:none;background:#f8fafc}
.chat-input-area input:focus{border-color:#2563eb;background:white}
.chat-input-area button{width:40px;height:40px;border-radius:50%;background:#2563eb;color:white;border:none;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.empty-state{flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-direction:column;gap:8px}
</style></head><body>
<div class="sidebar">
  <div class="sidebar-header">
    <span style="font-weight:600">💬 Conversations</span>
    <div style="display:flex;gap:12px"><a href="/">Site</a><a href="/admin/logout">Logout</a></div>
  </div>
  <div class="user-list">${userListHTML}</div>
</div>
<div class="main" id="mainArea">
  <div class="empty-state"><span style="font-size:40px">💬</span><p>Select a conversation</p></div>
</div>
<script>
let ws,currentChat=null;
(function connect(){var p=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(p+'//'+location.host+'/admin/ws');ws.onmessage=function(e){var d=JSON.parse(e.data);if(d.type==='new_message'&&d.chatId===currentChat)addMsg(d.message,d.sender,d.msgType,d.mediaUrl,d.duration)};ws.onclose=function(){setTimeout(connect,3000)}})();

async function openChat(cid,name){
currentChat=cid;
document.getElementById('mainArea').innerHTML='<div class="chat-header"><div class="chat-avatar">'+name.charAt(0)+'</div><div><div style="font-weight:600;font-size:14px">'+name+'</div><div style="font-size:11px;color:#94a3b8">online</div></div></div><div class="chat-msgs" id="msgContainer"><div id="msgs"></div></div><div class="chat-input-area"><input id="adminInput" placeholder="Type a message..." onkeypress="if(event.key===\\'Enter\\')sendAdminMsg()"><button onclick="sendAdminMsg()">➤</button></div>';
var r=await fetch('/api/admin/messages?chatId='+cid);
var d=await r.json();
if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(function(m){addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt)});scrollB()}
}

function addMsg(text,sender,type,url,duration,time){
var c=document.getElementById('msgs');if(!c)return;
var t=new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
var b=sender==='user'?'msg-in':'msg-out';
var d=document.createElement('div');d.style.clear='both';d.style.marginBottom='8px';
if(type==='image')d.innerHTML='<div class="msg-bubble '+b+'"><img src="'+url+'" class="msg-img" onclick="window.open(\\''+url+'\\')"><div class="msg-time">'+t+'</div></div>';
else d.innerHTML='<div class="msg-bubble '+b+'">'+text+'<div class="msg-time">'+t+'</div></div>';
c.appendChild(d);scrollB()
}

function scrollB(){var c=document.getElementById('msgContainer');if(c)setTimeout(function(){c.scrollTop=c.scrollHeight},50)}

async function sendAdminMsg(){
var i=document.getElementById('adminInput');
var m=i.value.trim();
if(!m)return;
i.value='';
if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'admin_message',chatId:currentChat,message:m}));
await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:currentChat,message:m})});
addMsg(m,'admin','text',null,null,new Date().toISOString())
}

setInterval(function(){if(currentChat)fetch('/api/admin/messages?chatId='+currentChat).then(function(r){return r.json()}).then(function(d){if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(function(m){addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt})}})},5000)
</script></body></html>`;
}

// Start server
async function start() {
    const dbConnected = await connectDB();
    
    server.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(' 🛡️  Verification Hub');
        console.log('='.repeat(50));
        console.log(' 🌐 Site:  http://localhost:' + PORT);
        console.log(' 👑 Admin: http://localhost:' + PORT + '/admin');
        console.log(' 🔑 Login: Hammad / Hammad1122@');
        console.log(' 💾 DB:    ' + (dbConnected ? 'Connected ✅' : 'Offline ❌'));
        console.log('='.repeat(50));
    });
}

start();

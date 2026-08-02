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

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI, { maxPoolSize: 10 });
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
        
        console.log('MongoDB Connected');
        return true;
    } catch (e) {
        console.error('MongoDB Error:', e.message);
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
    const session = await db.collection('sessions').findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return await db.collection('users').findOne({ chatId: session.chatId });
}

async function getMessages(chatId, limit = 50) {
    return await db.collection('messages').find({ chatId }).sort({ createdAt: 1 }).limit(limit).toArray();
}

async function saveMessage(chatId, sender, message, type = 'text', mediaUrl = null, duration = null) {
    const msg = { chatId, sender, message, type, mediaUrl, duration, createdAt: new Date(), read: false };
    await db.collection('messages').insertOne(msg);
    return msg;
}

async function getAllUsers() {
    return await db.collection('users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray();
}

async function getLastMessage(chatId) {
    return await db.collection('messages').findOne({ chatId }, { sort: { createdAt: -1 } });
}

async function getUnreadCount(chatId) {
    return await db.collection('messages').countDocuments({ chatId, sender: 'user', read: false });
}

async function markMessagesRead(chatId) {
    await db.collection('messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
}

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        
        return files
            .filter(f => audioExts.includes(path.extname(f).toLowerCase()))
            .map((f, i) => ({
                id: 'track_' + i,
                title: path.basename(f, path.extname(f)).replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                file: f,
                url: '/assets/covermusic/' + encodeURIComponent(f),
                index: i
            }));
    } catch (e) {
        return [];
    }
}

const VERIFICATION = {
    profile: {
        name: 'Baiilla Maach Official',
        username: '@baiillamaach_official',
        photo: ASSETS.profile,
        bio: 'Official Entertainment Profile | Bangladesh',
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
            screenshot: ASSETS.profile,
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
    
    let musicSection = '';
    if (songs.length > 0) {
        musicSection = `
        <section class="sec" id="music">
          <div class="sec-head">
            <div class="sec-icon" style="background:#dcfce7">🎵</div>
            <div><div class="sec-title">Cover Music</div><div class="sec-sub">${songs.length} tracks</div></div>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <div class="music-list">
              ${songs.map((s, i) => `
              <div class="music-item" data-url="${s.url}" data-title="${s.title.replace(/'/g, "\\'")}" onclick="playTrack(this,'${s.url}','${s.title.replace(/'/g, "\\'")}')">
                <span class="music-num">${String(i+1).padStart(2,'0')}</span>
                <div class="music-info"><div class="music-title">${s.title}</div><div class="music-artist">Cover Song</div></div>
                <button class="music-play-btn">▶</button>
              </div>
              `).join('')}
            </div>
          </div>
        </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<meta name="theme-color" content="#ffffff">
<title>${profile.name} | Official</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;line-height:1.5;overflow-x:hidden}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}

.container{max-width:600px;margin:0 auto;padding:0 14px}

/* Header */
.hdr{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);border-bottom:1px solid #e2e8f0}
.hdr-in{display:flex;align-items:center;justify-content:space-between;height:50px;gap:8px}
.hdr-l{display:flex;align-items:center;gap:8px}
.hdr-av{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #dbeafe}
.hdr-name{font-weight:700;font-size:14px;color:#0f172a;display:flex;align-items:center;gap:4px}
.hdr-tick{width:15px;height:15px}
.hdr-nav{display:flex;gap:1px}
.hdr-nav a{padding:5px 7px;font-size:11px;font-weight:500;color:#475569;text-decoration:none;border-radius:15px;white-space:nowrap}
.hdr-nav a:hover{background:#f1f5f9;color:#2563eb}

/* Sections */
.sec{padding:18px 0}
.sec-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.sec-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px}
.sec-title{font-size:15px;font-weight:700}
.sec-sub{font-size:10px;color:#64748b}

/* Card */
.card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}

/* Badge */
.badge{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:12px;font-size:10px;font-weight:600}
.bdg-b{background:#dbeafe;color:#2563eb}
.bdg-p{background:#ede9fe;color:#7c3aed}
.bdg-r{background:#fee2e2;color:#ef4444}
.bdg-g{background:#dcfce7;color:#16a34a}

/* Button */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 15px;border-radius:18px;font-size:11px;font-weight:600;text-decoration:none;border:none;cursor:pointer;transition:all 0.2s}
.btn-p{background:#2563eb;color:white}
.btn-p:hover{background:#1d4ed8}
.btn-o{background:white;color:#475569;border:1.5px solid #e2e8f0}
.btn-o:hover{border-color:#2563eb;color:#2563eb}
.btn-r{background:#ef4444;color:white}
.btn-r:hover{background:#dc2626}

/* Hero */
.hero{padding-top:64px;text-align:center}
.hero-iw{position:relative;display:inline-block;margin-bottom:10px}
.hero-img{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,0.1)}
.hero-chk{position:absolute;bottom:2px;right:2px;width:24px;height:24px;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white}
.hero-chk img{width:12px;height:12px}
.hero-name{font-size:19px;font-weight:800;margin-bottom:2px;display:inline-flex;align-items:center;gap:5px}
.hero-bio{font-size:12px;color:#64748b;margin-bottom:12px}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:270px;margin:0 auto 12px}
.stat{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 6px;text-align:center}
.stat-v{font-size:18px;font-weight:700}
.stat-l{font-size:9px;color:#64748b;font-weight:500}

/* Account */
.ac{display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
.ac-img{width:44px;height:44px;border-radius:8px;object-fit:cover}
.ac-info{flex:1;min-width:0}
.ac-name{font-weight:600;font-size:12px;display:flex;align-items:center;gap:3px}
.ac-meta{font-size:10px;color:#64748b}

/* Fake */
.fk{background:white;border:1px solid #fee2e2;border-left:4px solid #ef4444;border-radius:12px;padding:12px;margin-bottom:10px}
.fk-iw{position:relative;border-radius:9px;overflow:hidden;border:2px solid #fee2e2;margin-bottom:10px}
.fk-iw img{width:100%;display:block}
.fk-ol{position:absolute;inset:0;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center}
.fk-ol span{background:#ef4444;color:white;padding:5px 12px;border-radius:15px;font-size:10px;font-weight:700}

/* Music */
.music-list{max-height:280px;overflow-y:auto}
.music-item{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f1f5f9}
.music-item:hover{background:#f8fafc}
.music-item.playing{background:#dbeafe}
.music-num{width:20px;font-size:10px;color:#94a3b8;text-align:center}
.music-info{flex:1;min-width:0}
.music-title{font-size:12px;font-weight:600}
.music-artist{font-size:10px;color:#94a3b8}
.music-play-btn{width:28px;height:28px;border-radius:50%;background:#22c55e;color:white;border:none;cursor:pointer;font-size:11px;flex-shrink:0}

/* Identity */
.id-card{text-align:center;padding:12px}
.id-card img{max-width:100%;max-height:240px;border-radius:10px;border:2px solid #e2e8f0;margin-bottom:10px}

/* Report */
.rp{text-align:center;padding:12px}
.rp img{max-width:140px;margin-bottom:10px}

/* ==================== CHAT WIDGET ==================== */
.cw{position:fixed;bottom:18px;right:18px;z-index:999}
.cb{
  width:55px;height:55px;border-radius:50%;cursor:pointer;
  box-shadow:0 4px 20px rgba(0,0,0,0.2);border:none;padding:0;
  overflow:hidden;background:white;transition:transform 0.2s;
  animation:pop 0.5s ease-out;
}
@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
.cb:hover{transform:scale(1.08)}
.cb:active{transform:scale(0.95)}
.cb img{width:100%;height:100%;object-fit:cover;display:block}

.cw-win{
  position:fixed;bottom:85px;right:18px;width:360px;
  max-width:calc(100vw - 32px);height:460px;
  max-height:calc(100vh - 115px);background:white;
  border-radius:14px;overflow:hidden;
  box-shadow:0 15px 40px rgba(0,0,0,0.2);
  display:none;flex-direction:column;border:1px solid #e2e8f0;
}
.cw-win.open{display:flex}

.cw-top{
  background:#2563eb;color:white;padding:12px 14px;
  display:flex;align-items:center;gap:10px;flex-shrink:0;
}
.cw-av{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3)}
.cw-info{flex:1;min-width:0}
.cw-name{font-weight:600;font-size:13px}
.cw-st{font-size:10px;opacity:0.85}
.cw-cl{background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;opacity:0.8}

.cw-msgs{flex:1;overflow-y:auto;padding:12px;background:#f8fafc}
.mr{display:flex;margin-bottom:5px}
.mr.u{justify-content:flex-end}
.mr.a{justify-content:flex-start}
.mb{max-width:78%;padding:7px 11px;border-radius:12px;font-size:12px;line-height:1.4;word-wrap:break-word}
.mb.u{background:#2563eb;color:white;border-bottom-right-radius:3px}
.mb.a{background:white;color:#0f172a;border-bottom-left-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.mb-img{max-width:180px;border-radius:8px;cursor:pointer;display:block}
.mb-voice{display:flex;align-items:center;gap:6px}
.mb-voice button{width:28px;height:28px;border-radius:50%;background:#22c55e;color:white;border:none;cursor:pointer;font-size:11px;flex-shrink:0}
.mb-time{font-size:9px;opacity:0.7;text-align:right;margin-top:2px}

/* Typing */
.ti{display:none;padding:0 12px 6px}
.ti-b{display:inline-flex;gap:3px;padding:8px 12px;background:white;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.td{width:5px;height:5px;border-radius:50%;background:#94a3b8;animation:td 1.4s infinite}
.td:nth-child(2){animation-delay:0.2s}
.td:nth-child(3){animation-delay:0.4s}
@keyframes td{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-6px);opacity:1}}

/* Input */
.cw-inp{
  display:flex;align-items:center;gap:5px;padding:8px 12px;
  background:white;border-top:1px solid #e2e8f0;flex-shrink:0;
}
.cw-inp input{
  flex:1;border:1.5px solid #e2e8f0;padding:8px 12px;
  border-radius:16px;font-size:12px;outline:none;background:#f8fafc;min-width:0;
}
.cw-inp input:focus{border-color:#2563eb;background:white}
.cw-ibtn{
  width:32px;height:32px;border-radius:50%;border:none;
  background:transparent;cursor:pointer;font-size:15px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.cw-ibtn:hover{background:#f1f5f9}
.cw-send{
  width:34px;height:34px;border-radius:50%;background:#2563eb;
  color:white;border:none;cursor:pointer;display:flex;
  align-items:center;justify-content:center;flex-shrink:0;font-size:14px;
}
.cw-send:hover{background:#1d4ed8}

/* Recording */
.rc{display:none;align-items:center;gap:6px;padding:6px 12px;background:#ef4444;color:white;font-size:11px;flex-shrink:0}
.rc-dot{width:7px;height:7px;background:white;border-radius:50%;animation:rcp 1s infinite}
@keyframes rcp{0%,100%{opacity:1}50%{opacity:0.3}}

/* Image preview */
.ip{display:none;padding:6px 12px;background:white;position:relative;flex-shrink:0}
.ip img{max-height:60px;border-radius:7px}
.ip-cl{position:absolute;top:3px;right:16px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:9px}

/* Login */
.lg{padding:20px 14px;text-align:center}
.lg input{width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:12px;outline:none;background:#f8fafc;margin-bottom:7px}
.lg input:focus{border-color:#2563eb;background:white}

/* Image viewer */
.iv{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center;cursor:pointer}
.iv.open{display:flex}
.iv img{max-width:95%;max-height:90%;border-radius:8px}
.iv-cl{position:absolute;top:14px;right:14px;color:white;font-size:28px;cursor:pointer}

/* Toast */
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f172a;color:white;padding:8px 18px;border-radius:18px;font-size:12px;z-index:1000;display:none}

/* Audio floating */
.af{position:fixed;bottom:76px;left:14px;right:14px;max-width:380px;background:white;border-radius:12px;padding:10px 14px;box-shadow:0 8px 25px rgba(0,0,0,0.15);display:none;align-items:center;gap:10px;z-index:99;border:1px solid #e2e8f0}
.af.open{display:flex}
.af-info{flex:1;min-width:0}
.af-title{font-size:12px;font-weight:600}
.af-artist{font-size:10px;color:#94a3b8}

@media(max-width:480px){
  .cw-win{width:100%;max-width:100%;bottom:0;right:0;border-radius:14px 14px 0 0;height:82vh;max-height:82vh}
  .cb{width:48px;height:48px}
  .hero-img{width:68px;height:68px}
}
</style>
</head>
<body>

<!-- HEADER -->
<header class="hdr">
  <div class="container">
    <div class="hdr-in">
      <div class="hdr-l">
        <img src="${ASSETS.profile}" alt="" class="hdr-av" onerror="this.style.display='none'">
        <span class="hdr-name">
          ${profile.name}
          <img src="${ASSETS.tiktokTick}" alt="✓" class="hdr-tick" onerror="this.style.display='none'">
        </span>
      </div>
      <nav class="hdr-nav">
        <a href="#accounts">Accounts</a>
        <a href="#fake">Fakes</a>
        <a href="#identity">ID</a>
        ${songs.length ? '<a href="#music">Music</a>' : ''}
        <a href="#help">Help</a>
      </nav>
    </div>
  </div>
</header>

<main class="container" style="padding-bottom:30px">

<!-- HERO -->
<section class="hero">
  <div class="hero-iw">
    <img src="${ASSETS.profile}" alt="" class="hero-img" onerror="this.style.display='none'">
    <div class="hero-chk">
      <img src="${ASSETS.tiktokTick}" alt="✓" onerror="this.style.display='none'">
    </div>
  </div>
  <h1 class="hero-name">
    ${profile.name}
    <img src="${ASSETS.tiktokTick}" alt="✓" style="width:17px;height:17px" onerror="this.style.display='none'">
  </h1>
  <p class="hero-bio">${profile.bio}</p>
  
  <div class="stats">
    <div class="stat"><div class="stat-v">${profile.followers}</div><div class="stat-l">Followers</div></div>
    <div class="stat"><div class="stat-v">${profile.following}</div><div class="stat-l">Following</div></div>
    <div class="stat"><div class="stat-v">${profile.likes}</div><div class="stat-l">Likes</div></div>
  </div>
  
  <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <span class="badge bdg-b">
      <img src="${ASSETS.tiktokTick}" alt="" style="width:11px;height:11px" onerror="this.style.display='none'">
      Verified
    </span>
    <span class="badge bdg-p">Creator</span>
  </div>
  
  <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
    <a href="${officialAccounts[0].url}" target="_blank" class="btn btn-p">
      <img src="${ASSETS.tiktokIcon}" alt="" style="width:14px;height:14px" onerror="this.style.display='none'">
      TikTok
    </a>
    <a href="${officialAccounts[1].url}" target="_blank" class="btn btn-p" style="background:#1877f2">
      Facebook
    </a>
  </div>
</section>

<!-- ACCOUNTS -->
<section class="sec" id="accounts">
  <div class="sec-head">
    <div class="sec-icon" style="background:#dbeafe">✅</div>
    <div>
      <div class="sec-title">Verified Accounts</div>
      <div class="sec-sub">The only authentic profiles</div>
    </div>
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:8px">
    ${officialAccounts.map(acc => `
    <div class="ac">
      <img src="${acc.screenshot}" alt="" class="ac-img" onerror="this.style.display='none'">
      <div class="ac-info">
        <div class="ac-name">
          ${acc.username}
          <img src="${acc.badge}" alt="✓" style="width:12px;height:12px" onerror="this.style.display='none'">
        </div>
        <div class="ac-meta">${acc.platform} · ${acc.followers} followers${acc.likes ? ' · '+acc.likes+' likes' : ''}</div>
      </div>
      <a href="${acc.url}" target="_blank" class="btn btn-p" style="font-size:10px;padding:6px 12px;flex-shrink:0">Follow</a>
    </div>
    `).join('')}
  </div>
</section>

<!-- IDENTITY -->
<section class="sec" id="identity">
  <div class="sec-head">
    <div class="sec-icon" style="background:#dcfce7">🛡️</div>
    <div>
      <div class="sec-title">Identity Verification</div>
      <div class="sec-sub">Government verified identity</div>
    </div>
  </div>
  <div class="card id-card">
    <img src="${ASSETS.realId}" alt="ID Proof" onerror="this.style.display='none'">
    <p style="font-size:12px;color:#475569;margin-bottom:8px">
      <strong>✅ Verified Identity</strong><br>
      This profile is verified through official documentation.
    </p>
    <span class="badge bdg-g">✓ Confirmed</span>
  </div>
</section>

<!-- FAKE -->
<section class="sec" id="fake">
  <div class="sec-head">
    <div class="sec-icon" style="background:#fee2e2">⚠️</div>
    <div>
      <div class="sec-title">Fake Accounts</div>
      <div class="sec-sub">Help report these impersonators</div>
    </div>
    <span class="badge bdg-r" style="margin-left:auto">${fakeAccounts.length} Active</span>
  </div>
  
  <div style="text-align:center;margin-bottom:12px">
    <img src="${ASSETS.fakeDetect}" alt="" style="max-width:120px;border-radius:10px" onerror="this.style.display='none'">
  </div>
  
  ${fakeAccounts.map((acc, i) => `
  <div class="fk">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <div style="display:flex;align-items:center;gap:5px">
        <span style="font-size:15px">⚠️</span>
        <strong style="color:#ef4444;font-size:13px">Fake #${i+1}</strong>
      </div>
      <span class="badge bdg-r">${acc.threat}</span>
    </div>
    
    <div class="fk-iw">
      <img src="${acc.screenshot}" alt="" onerror="this.style.display='none'">
      <div class="fk-ol"><span>⚠️ FAKE ACCOUNT</span></div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px;margin-bottom:8px">
      <div style="background:#fee2e2;padding:7px 9px;border-radius:7px"><span style="color:#64748b">Platform:</span> <strong>${acc.platform}</strong></div>
      <div style="background:#fee2e2;padding:7px 9px;border-radius:7px"><span style="color:#64748b">Username:</span> <strong style="color:#ef4444">${acc.username}</strong></div>
      <div style="background:#fee2e2;padding:7px 9px;border-radius:7px"><span style="color:#64748b">Reports:</span> <strong>${acc.reports}+</strong></div>
      <div style="background:#fee2e2;padding:7px 9px;border-radius:7px"><span style="color:#64748b">Threat:</span> <strong style="color:#ef4444">${acc.threat}</strong></div>
    </div>
    
    <div style="background:#fee2e2;padding:8px 10px;border-radius:7px;font-size:11px;color:#ef4444;margin-bottom:8px">
      <img src="${ASSETS.flag}" alt="" style="width:12px;height:12px;vertical-align:middle;margin-right:4px" onerror="this.style.display='none'">
      ${acc.reason}
    </div>
    
    <div style="display:flex;gap:6px">
      <a href="${acc.url}" target="_blank" class="btn btn-r" style="flex:1;font-size:10px">Report</a>
      <button onclick="copyText('${acc.username}')" class="btn btn-o" style="flex:1;font-size:10px">Copy</button>
    </div>
  </div>
  `).join('')}
  
  <div style="text-align:center;margin-top:12px">
    <button onclick="playFakeVoice()" class="btn btn-o" style="color:#ef4444;border-color:#fee2e2;font-size:11px">
      🔊 Voice Alert
    </button>
  </div>
</section>

<!-- REPORT -->
<section class="sec">
  <div class="sec-head">
    <div class="sec-icon" style="background:#fef3c7">📢</div>
    <div>
      <div class="sec-title">Report Fake</div>
      <div class="sec-sub">Help protect others</div>
    </div>
  </div>
  <div class="card rp">
    <img src="${ASSETS.reportImg}" alt="" onerror="this.style.display='none'">
    <p style="font-size:12px;color:#475569;margin-bottom:10px">
      Found an impersonator? Report it immediately.
    </p>
    <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
      <a href="${fakeAccounts[0].url}" target="_blank" class="btn btn-r" style="font-size:10px">
        <img src="${ASSETS.flag}" alt="" style="width:12px;height:12px" onerror="this.style.display='none'">
        Report
      </a>
      <button onclick="showToast('Report submitted!')" class="btn btn-o" style="font-size:10px">Submit</button>
    </div>
  </div>
</section>

${musicSection}

<!-- HELP -->
<section class="sec" id="help">
  <div class="sec-head">
    <div class="sec-icon" style="background:#ede9fe">💬</div>
    <div>
      <div class="sec-title">Need Help?</div>
      <div class="sec-sub">Chat with us directly</div>
    </div>
  </div>
  <div class="card" style="text-align:center">
    <img src="${ASSETS.communication}" alt="" style="max-width:100px;margin:0 auto 10px" onerror="this.style.display='none'">
    <p style="font-size:12px;color:#475569;margin-bottom:10px">Have questions? Chat with our support team.</p>
    <button onclick="openChat()" class="btn btn-p">💬 Start Chat</button>
  </div>
</section>

</main>

<!-- Audio -->
<audio id="welcomeAudio" src="${ASSETS.welcomeVoice}" preload="none"></audio>
<audio id="fakeAudio" src="${ASSETS.fakeVoice}" preload="none"></audio>
<audio id="musicAudio" preload="none"></audio>

<!-- Floating Music Player -->
<div class="af" id="audioFloating">
  <button id="floatingPlayBtn" onclick="toggleFloatingPlay()" style="width:32px;height:32px;border-radius:50%;background:#22c55e;color:white;border:none;cursor:pointer;font-size:13px;flex-shrink:0">▶</button>
  <div class="af-info">
    <div class="af-title" id="floatingTitle">No track</div>
    <div class="af-artist">Cover Song</div>
  </div>
  <button onclick="closeFloatingPlayer()" style="background:none;border:none;font-size:16px;cursor:pointer;color:#94a3b8;padding:4px">✕</button>
</div>

<!-- Image Viewer -->
<div class="iv" id="imgViewer" onclick="closeImageViewer()">
  <span class="iv-cl">✕</span>
  <img id="viewerImg" src="" alt="">
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<!-- ==================== CHAT WIDGET ==================== -->
<div class="cw">
  <button class="cb" id="chatBtn" onclick="openChat()" title="Chat with us">
    <img src="${ASSETS.chatIcon}" alt="Chat" onerror="this.style.display='none'">
  </button>
  
  <div class="cw-win" id="chatWindow">
    <div class="cw-top">
      <img src="${ASSETS.profile}" alt="" class="cw-av" onerror="this.style.display='none'">
      <div class="cw-info">
        <div class="cw-name">Support Team</div>
        <div class="cw-st" id="chatStatusText">Online</div>
      </div>
      <button class="cw-cl" onclick="closeChat()">✕</button>
    </div>
    
    <!-- Login Form -->
    <div id="chatLoginForm" class="lg">
      <p style="color:#64748b;font-size:12px;margin-bottom:10px">Enter your details to start</p>
      <input type="text" id="chatNameInput" placeholder="Your name">
      <input type="text" id="chatContactInput" placeholder="Phone number or email">
      <button onclick="registerUser()" class="btn btn-p" style="width:100%">Start Chat</button>
      <p style="color:#94a3b8;font-size:9px;margin-top:6px">Use same info to restore previous chats</p>
    </div>
    
    <!-- Chat Interface -->
    <div id="chatMainUI" style="display:none;flex:1;flex-direction:column">
      <div class="cw-msgs" id="chatMessagesContainer">
        <div style="text-align:center;padding:12px">
          <span style="background:#f1f5f9;color:#94a3b8;font-size:9px;padding:3px 9px;border-radius:8px">🔒 Messages are secure</span>
        </div>
      </div>
      
      <div class="ti" id="typingIndicator">
        <div class="ti-b"><div class="td"></div><div class="td"></div><div class="td"></div></div>
      </div>
      
      <div class="ip" id="imagePreviewBar">
        <img id="previewImage" src="" alt="">
        <button class="ip-cl" onclick="clearImagePreview()">✕</button>
      </div>
      
      <div class="rc" id="recordingBar">
        <div class="rc-dot"></div>
        <span>Recording...</span>
        <span id="recordingTime" style="margin-left:auto">00:00</span>
      </div>
      
      <div class="cw-inp">
        <input type="file" id="imageFileInput" accept="image/*" style="display:none" onchange="handleImageSelect(event)">
        <button class="cw-ibtn" onclick="document.getElementById('imageFileInput').click()" title="Send image">🖼️</button>
        <input type="text" id="messageTextInput" class="cw-inp-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
        <button class="cw-ibtn" id="micButton" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Voice">🎤</button>
        <button class="cw-send" onclick="sendMessage()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<script>
// ============ GLOBAL STATE ============
var webSocket = null;
var userToken = localStorage.getItem('vh_chat_token');
var userChatId = null;
var selectedImageData = null;
var mediaRecorder = null;
var audioChunks = [];
var recordingStartTime = 0;
var recordingTimer = null;
var currentTrackElement = null;
var currentTrackUrl = '';
var floatingPlayer = document.getElementById('musicAudio');

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
  // Reset all
  var allItems = document.querySelectorAll('.music-item');
  allItems.forEach(function(item) { item.classList.remove('playing'); });
  var allBtns = document.querySelectorAll('.music-play-btn');
  allBtns.forEach(function(btn) { btn.textContent = '▶'; });
  
  if (currentTrackUrl === url && !floatingPlayer.paused) {
    floatingPlayer.pause();
    currentTrackUrl = '';
    document.getElementById('audioFloating').classList.remove('open');
    return;
  }
  
  currentTrackUrl = url;
  currentTrackElement = element;
  element.classList.add('playing');
  
  floatingPlayer.src = url;
  floatingPlayer.play().catch(function(err) {
    console.log('Play error:', err);
    showToast('Error playing track');
  });
  
  element.querySelector('.music-play-btn').textContent = '⏸';
  
  document.getElementById('floatingTitle').textContent = title;
  document.getElementById('floatingPlayBtn').textContent = '⏸';
  document.getElementById('audioFloating').classList.add('open');
  
  floatingPlayer.onended = function() {
    element.querySelector('.music-play-btn').textContent = '▶';
    element.classList.remove('playing');
    document.getElementById('audioFloating').classList.remove('open');
    currentTrackUrl = '';
  };
  
  floatingPlayer.onerror = function() {
    showToast('Error loading track');
    element.querySelector('.music-play-btn').textContent = '▶';
    element.classList.remove('playing');
    document.getElementById('audioFloating').classList.remove('open');
    currentTrackUrl = '';
  };
}

function toggleFloatingPlay() {
  if (!currentTrackUrl) return;
  if (floatingPlayer.paused) {
    floatingPlayer.play();
    document.getElementById('floatingPlayBtn').textContent = '⏸';
  } else {
    floatingPlayer.pause();
    document.getElementById('floatingPlayBtn').textContent = '▶';
  }
}

function closeFloatingPlayer() {
  floatingPlayer.pause();
  floatingPlayer.src = '';
  currentTrackUrl = '';
  currentTrackElement = null;
  document.getElementById('audioFloating').classList.remove('open');
  var allBtns = document.querySelectorAll('.music-play-btn');
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
    showToast('Copied!');
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
function openChat() {
  console.log('Opening chat...');
  var chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.add('open');
  
  if (!webSocket || webSocket.readyState !== 1) {
    connectWebSocket();
  }
}

function closeChat() {
  console.log('Closing chat...');
  document.getElementById('chatWindow').classList.remove('open');
}

function connectWebSocket() {
  console.log('Connecting WebSocket...');
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  webSocket = new WebSocket(protocol + '//' + location.host + '/ws');
  
  webSocket.onopen = function() {
    console.log('✅ WebSocket connected');
    document.getElementById('chatStatusText').textContent = 'Online';
    
    if (userToken) {
      console.log('Auto-auth with token');
      webSocket.send(JSON.stringify({ type: 'auth', token: userToken }));
    }
  };
  
  webSocket.onmessage = function(event) {
    var data = JSON.parse(event.data);
    console.log('Message received:', data.type);
    
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
    console.log('❌ WebSocket disconnected');
    document.getElementById('chatStatusText').textContent = 'Offline';
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
  
  console.log('Registering:', name, contact);
  
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
    console.log('Register response:', data);
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
    console.error('Register error:', error);
    showToast('Connection error');
  });
}

function showChatInterface() {
  console.log('Showing chat interface');
  document.getElementById('chatLoginForm').style.display = 'none';
  document.getElementById('chatMainUI').style.display = 'flex';
}

function sendMessage() {
  var input = document.getElementById('messageTextInput');
  var message = input.value.trim();
  
  if (!message && !selectedImageData) return;
  
  console.log('Sending message:', message);
  
  if (selectedImageData) {
    webSocket.send(JSON.stringify({
      type: 'message',
      token: userToken,
      message: message || 'Image',
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
  var rowClass = sender === 'user' ? 'u' : 'a';
  var bubbleClass = sender === 'user' ? 'u' : 'a';
  var html = '';
  
  if (type === 'image') {
    html = '<div class="mr ' + rowClass + '"><div class="mb ' + bubbleClass + '"><img src="' + mediaUrl + '" class="mb-img" onclick="openImageViewer(\'' + mediaUrl + '\')"><div class="mb-time">' + time + '</div></div></div>';
  } else if (type === 'voice') {
    html = '<div class="mr ' + rowClass + '"><div class="mb ' + bubbleClass + '"><div class="mb-voice"><button onclick="playVoiceMsg(this,\'' + mediaUrl + '\')">▶</button><span style="font-size:11px">🎤 ' + (duration || 0) + 's</span></div><div class="mb-time">' + time + '</div></div></div>';
  } else {
    html = '<div class="mr ' + rowClass + '"><div class="mb ' + bubbleClass + '">' + escapeHtml(text) + '<div class="mb-time">' + time + '</div></div></div>';
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

function playVoiceMsg(button, url) {
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
        message: 'Voice message',
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
    .catch(function(err) {
      console.error('Load history error:', err);
    });
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
  if (webSocket && webSocket.readyState === 1 && userToken) {
    webSocket.send(JSON.stringify({ type: 'typing', isTyping: true, token: userToken }));
    clearTimeout(typingTimeoutId);
    typingTimeoutId = setTimeout(function() {
      webSocket.send(JSON.stringify({ type: 'typing', isTyping: false, token: userToken }));
    }, 2000);
  }
});

// ============ INIT ============
console.log('Page loaded');
if (userToken) {
  console.log('Found saved token');
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
        
        if (!filePath.startsWith(ASSETS_DIR) && !filePath.startsWith(UPLOADS_DIR)) {
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
            console.log('File not found:', filePath);
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
        res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>body{font-family:Inter,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:white;border-radius:14px;padding:28px;width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.06)}h1{text-align:center;color:#0f172a;margin-bottom:18px}input{width:100%;padding:10px;margin-bottom:8px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;box-sizing:border-box}input:focus{border-color:#2563eb;background:white}button{width:100%;padding:11px;background:#2563eb;color:white;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer}button:hover{background:#1d4ed8}</style></head><body><div class="box"><h1>Admin Login</h1><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
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
    
    res.writeHead(404);
    res.end('Not Found');
});

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
    <div onclick="openChat('${u.chatId}','${u.name.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;border-bottom:1px solid #f1f5f9">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">${u.name.charAt(0)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${u.name}</div>
        <div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.lastMessage ? u.lastMessage.message.substring(0,30) : 'No messages'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#94a3b8">${u.lastMessage ? new Date(u.lastMessage.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</div>
        ${u.unread > 0 ? `<div style="background:#2563eb;color:white;font-size:9px;font-weight:700;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;margin-top:3px">${u.unread}</div>` : ''}
      </div>
    </div>
    `).join('') : '<div style="text-align:center;color:#94a3b8;padding:40px">No users yet</div>';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,sans-serif;background:#f8fafc;height:100vh;display:flex}
.sidebar{width:350px;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column}
.sidebar-header{padding:14px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:space-between}
.sidebar-header a{color:rgba(255,255,255,0.8);text-decoration:none;font-size:12px}
.main{flex:1;display:flex;flex-direction:column;background:white}
.chat-header{padding:14px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px}
.chat-avatar{width:36px;height:36px;border-radius:50%;background:#f59e0b;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}
.msg-area{flex:1;overflow-y:auto;padding:14px;background:#f8fafc}
.msg-bubble{max-width:70%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.4;margin-bottom:5px;word-wrap:break-word}
.msg-in{background:white;color:#0f172a;float:left;clear:both;border-bottom-left-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.msg-out{background:#2563eb;color:white;float:right;clear:both;border-bottom-right-radius:3px}
.msg-time{font-size:9px;opacity:0.7;text-align:right;margin-top:2px}
.msg-img{max-width:180px;border-radius:8px;cursor:pointer}
.input-area{padding:10px 14px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:6px}
.input-area input{flex:1;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:16px;font-size:12px;outline:none;background:#f8fafc}
.input-area input:focus{border-color:#2563eb;background:white}
.input-area button{width:36px;height:36px;border-radius:50%;background:#2563eb;color:white;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
</style></head><body>
<div class="sidebar">
  <div class="sidebar-header">
    <span style="font-weight:600">Conversations</span>
    <div style="display:flex;gap:10px"><a href="/">Site</a><a href="/admin/logout">Logout</a></div>
  </div>
  <div style="flex:1;overflow-y:auto">${userListHTML}</div>
</div>
<div class="main" id="mainArea">
  <div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-direction:column;gap:8px">
    <span style="font-size:36px">💬</span><p>Select a conversation</p>
  </div>
</div>
<script>
var ws,currentChat=null;
(function connect(){var p=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(p+'//'+location.host+'/admin/ws');ws.onmessage=function(e){var d=JSON.parse(e.data);if(d.type==='new_message'&&d.chatId===currentChat)addMsg(d.message,d.sender,d.msgType,d.mediaUrl,d.duration)};ws.onclose=function(){setTimeout(connect,3000)}})();

async function openChat(cid,name){
currentChat=cid;
document.getElementById('mainArea').innerHTML='<div class="chat-header"><div class="chat-avatar">'+name.charAt(0)+'</div><div><div style="font-weight:600;font-size:13px">'+name+'</div><div style="font-size:10px;color:#94a3b8">online</div></div></div><div class="msg-area" id="msgContainer"><div id="msgs"></div></div><div class="input-area"><input id="adminInput" placeholder="Type..." onkeypress="if(event.key===\\'Enter\\')sendAdminMsg()"><button onclick="sendAdminMsg()">➤</button></div>';
var r=await fetch('/api/admin/messages?chatId='+cid);
var d=await r.json();
if(d.success){document.getElementById('msgs').innerHTML='';d.messages.forEach(function(m){addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt)});scrollB()}
}

function addMsg(text,sender,type,url,duration,time){
var c=document.getElementById('msgs');if(!c)return;
var t=new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
var b=sender==='user'?'msg-in':'msg-out';
var d=document.createElement('div');d.style.clear='both';d.style.marginBottom='6px';
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

async function start() {
    const dbConnected = await connectDB();
    
    server.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(' Verification Hub - Baiilla Maach');
        console.log('='.repeat(50));
        console.log(' Site:  http://localhost:' + PORT);
        console.log(' Admin: http://localhost:' + PORT + '/admin');
        console.log(' Login: Hammad / Hammad1122@');
        console.log(' DB:    ' + (dbConnected ? 'Connected' : 'Offline'));
        console.log('='.repeat(50));
    });
}

start();

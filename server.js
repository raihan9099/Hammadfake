require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 4000;

// ===== SQLite Database =====
const db = new Database('verification_hub.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    isAdmin INTEGER DEFAULT 0,
    lastSeen DATETIME,
    isOnline INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    fileUrl TEXT,
    seen INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ SQLite Database Connected');

// Create admin
const adminCheck = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get('admin');
const hash = bcrypt.hashSync('admin123', 10);
if (adminCheck) {
  db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(hash, 'Admin', 'admin');
  console.log('✅ Admin updated');
} else {
  db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('Admin', 'admin', hash);
  console.log('✅ Admin created');
}

console.log('👤 Admin: admin / admin123');

app.use(express.json());
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

['uploads', 'assets/covermusic'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ASSETS = {
  profile: "/assets/celebrity_pfp.jpeg",
  fbProfile: "/assets/fb_profile.jpg",
  blueTikTok: "/assets/bluetick_tiktok.png",
  blueFB: "/assets/blue_tick_fb.png",
  logoFB: "/assets/logo_fb.png",
  logoTikTok: "/assets/logo_tiktok.png",
  realId: "/assets/real-id-ss.png",
  fakeDetect: "/assets/Fakedetect_updown.png",
  baillamachFake: "/assets/baillamach_fake.png",
  hammadFake: "/assets/hammadfams.png",
  followGif: "/assets/follow.gif",
  propagandaGif: "/assets/propaganda.gif",
  addGif: "/assets/add.gif",
  reportGif: "/assets/report.gif",
  playGif: "/assets/play.gif",
  musicDefault: "/assets/play.gif"
};

const WELCOME_VOICE = fs.existsSync('assets/realvoice.mp3');
const MANUAL_VOICE = fs.existsSync('assets/manualvoice_alert.mp3');

function getSongs() {
  try {
    const dir = 'assets/covermusic';
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.mp3'))
      .map((f, i) => ({
        id: i,
        title: f.replace('.mp3', '').replace(/[-_]/g, ' '),
        url: '/assets/covermusic/' + encodeURIComponent(f),
        cover: ASSETS.musicDefault
      }));
  } catch (e) { return []; }
}

// ==================== MAIN PAGE ====================
app.get('/', (req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);
  
  let songsListHTML = '';
  songs.forEach((s, i) => {
    songsListHTML += `
    <div class="song-item" onclick="playMusic(${i})" id="song-${i}" data-index="${i}">
      <span class="song-num">${String(i+1).padStart(2,'0')}</span>
      <div class="song-thumb-wrap">
        <img src="${ASSETS.musicDefault}" class="song-thumb-static" id="thumb-static-${i}">
        <img src="${ASSETS.playGif}" class="song-thumb-playing" id="thumb-playing-${i}" style="display:none">
      </div>
      <div class="song-info">
        <div class="song-title">${s.title}</div>
        <div class="song-artist">Baiilla Maach</div>
      </div>
      <div class="song-playing-indicator" id="indicator-${i}" style="display:none">
        <span class="equalizer">
          <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </span>
      </div>
    </div>`;
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `<div class="card"><div class="card-header"><span class="badge badge-blue">VOICE</span>
      <h3>Voice Verification</h3><p>Listen to authentic voice</p></div>
      <div class="card-body"><div class="btn-group">
      ${WELCOME_VOICE ? '<button class="btn btn-blue" onclick="playWelcomeVoice()">🎤 Real Voice</button>' : ''}
      ${MANUAL_VOICE ? '<button class="btn btn-red" onclick="playManualVoice()">🚨 Fake Alert</button>' : ''}
      </div></div></div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Baiilla Maach Official | Hammad Bin Amir</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,sans-serif;background:#f0f2f5;color:#1c1e21;line-height:1.5;touch-action:manipulation}
a{text-decoration:none}img{max-width:100%}
button,input{touch-action:manipulation;font-family:inherit}

/* HEADER */
.header{position:sticky;top:0;z-index:100;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:0 20px;height:60px;display:flex;align-items:center;justify-content:space-between}
.header-left{display:flex;align-items:center;gap:10px}
.header-logo{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #e4e6eb}
.header-name{font-weight:700;font-size:1.2em;color:#1877f2}
.header-btn{background:#1877f2;color:#fff;padding:8px 20px;border-radius:20px;font-weight:600;font-size:0.9em;cursor:pointer;transition:0.2s;border:none}
.header-btn:hover{background:#166fe5}

/* CONTAINER */
.container{max-width:680px;margin:16px auto;padding:0 16px}
.card{background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.1);margin-bottom:16px;overflow:hidden}
.card-header{padding:16px;border-bottom:1px solid #e4e6eb}
.card-body{padding:16px}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.badge-blue{background:#e7f3ff;color:#1877f2}
.badge-red{background:#fce4e4;color:#e41e3f}
.badge-green{background:#e6f7e6;color:#10b981}
.badge-orange{background:#fff3e0;color:#f59e0b}
h3{font-size:1.2em;font-weight:700;margin-bottom:4px}
p{color:#65676b;font-size:0.9em}

/* PROFILE CARD */
.profile-card{text-align:center;padding:0}
.profile-cover{height:180px;background:linear-gradient(135deg,#1877f2,#8b5cf6,#ec4899);border-radius:8px 8px 0 0;position:relative}
.profile-cover-actions{position:absolute;top:12px;right:12px;display:flex;gap:6px;z-index:10}
.profile-cover-actions .cover-btn{background:rgba(255,255,255,0.9);border:none;padding:6px 12px;border-radius:6px;font-size:0.75em;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;color:#1c1e21;backdrop-filter:blur(4px);transition:0.2s}
.profile-cover-actions .cover-btn:hover{background:#fff}
.profile-cover-actions .cover-btn.report-btn{background:rgba(250,56,62,0.9);color:#fff}
.profile-cover-actions .cover-btn.report-btn:hover{background:#fa383e}
.profile-avatar-wrap{margin-top:-60px;position:relative;display:inline-block}
.profile-avatar{width:120px;height:120px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.verified-badge{position:absolute;bottom:8px;right:8px;background:#1877f2;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.verified-badge svg{width:12px;height:12px;fill:#fff}
.profile-name{font-size:1.5em;font-weight:800;margin-top:8px}
.profile-username{color:#65676b;font-size:0.95em;margin-bottom:4px}
.profile-bio{color:#65676b;font-size:0.85em;margin-bottom:12px}
.stats-row{display:flex;justify-content:center;gap:40px;padding:12px 0;border-top:1px solid #e4e6eb;border-bottom:1px solid #e4e6eb;margin-bottom:12px}
.stat{text-align:center}
.stat-num{font-size:1.1em;font-weight:700}
.stat-label{font-size:0.75em;color:#65676b}

/* ACTION BUTTONS - REORGANIZED */
.profile-actions{padding:0 16px 16px}
.action-row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.action-row:last-child{margin-bottom:0}
.btn{font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:6px;transition:0.2s;font-size:0.85em}
.btn-lg{padding:10px 20px;border-radius:6px;font-size:0.9em;flex:1;justify-content:center;min-width:120px}
.btn-sm{padding:6px 14px;border-radius:20px;font-size:0.8em}
.btn-primary{background:#1877f2;color:#fff}.btn-primary:hover{background:#166fe5}
.btn-secondary{background:#e4e6eb;color:#1c1e21}.btn-secondary:hover{background:#d8dadf}
.btn-outline{border:1px solid #1877f2;color:#1877f2;background:transparent}.btn-outline:hover{background:#e7f3ff}
.btn-danger{background:#fa383e;color:#fff}.btn-danger:hover{background:#e03131}
.btn-icon{width:18px;height:18px}
.action-primary{display:flex;gap:8px}
.action-primary .btn{flex:1}
.action-secondary{justify-content:center}
.badge-official{display:inline-flex;align-items:center;gap:4px;background:#e7f3ff;color:#1877f2;padding:6px 14px;border-radius:20px;font-size:0.8em;font-weight:700}
.badge-official svg{width:14px;height:14px;fill:#1877f2}

/* GRID */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.grid-2{grid-template-columns:1fr}}
.verified-item{display:flex;align-items:center;gap:10px;padding:12px;background:#f0f2f5;border-radius:8px;margin-bottom:8px}
.verified-item .v-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover}
.verified-item .v-info h4{font-weight:600;font-size:0.95em;display:flex;align-items:center;gap:4px}
.verified-item .v-info h4 img{width:16px;height:16px}
.verified-item .v-info .v-handle{font-size:0.8em;color:#65676b}
.verified-item .v-info .v-detail{font-size:0.8em;color:#1c1e21;margin-top:2px}
.fake-card{border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin-bottom:8px}
.fake-img-wrap{position:relative;text-align:center;padding:12px;background:#fafafa}
.fake-img{max-width:100%;border-radius:4px}
.fake-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:70px;height:70px;animation:bounce 2s infinite}
@keyframes bounce{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-14px)}}
.fake-body{padding:12px}
.fake-body h4{font-weight:600;font-size:0.95em}
.fake-body .platform{color:#f59e0b;font-weight:600;font-size:0.8em;margin:2px 0}
.fake-body p{font-size:0.8em;color:#65676b;margin-bottom:8px}
.proof-single{text-align:center;padding:20px}
.proof-single img{max-width:100%;border-radius:8px;border:1px solid #e4e6eb}
.proof-single .label{font-weight:600;font-size:0.9em;margin-top:8px;color:#1877f2}

/* MUSIC PLAYER */
.music-section{padding:16px}
.music-header{display:flex;align-items:center;gap:12px;padding:12px;background:#f0f2f5;border-radius:8px;margin-bottom:12px}
.music-cover-wrap{width:56px;height:56px;border-radius:8px;overflow:hidden;flex-shrink:0;position:relative}
.music-cover-static{width:100%;height:100%;object-fit:cover}
.music-cover-playing{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:none}
.music-info{flex:1;min-width:0}
.music-title{font-weight:600;font-size:0.95em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.music-artist{font-size:0.8em;color:#65676b}
.music-slider{width:100%;height:4px;background:#e4e6eb;border-radius:2px;cursor:pointer;margin:8px 0;position:relative}
.music-slider-fill{height:100%;background:#1877f2;border-radius:2px;width:0;transition:width 0.1s linear;pointer-events:none}
.music-time-row{display:flex;justify-content:space-between;font-size:0.75em;color:#65676b;margin-bottom:8px}
.music-controls{display:flex;align-items:center;justify-content:center;gap:16px}
.music-btn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-size:1em;display:flex;align-items:center;justify-content:center;transition:0.15s}
.music-btn-nav{background:#e4e6eb;color:#1c1e21}.music-btn-nav:hover{background:#d8dadf}
.music-btn-play{background:#1877f2;color:#fff;width:48px;height:48px;font-size:1.3em}.music-btn-play:hover{background:#166fe5}
.music-list{max-height:220px;overflow-y:auto;border-top:1px solid #e4e6eb;margin-top:12px;padding-top:8px}

/* SONG ITEMS - FIXED */
.song-item{display:flex;align-items:center;gap:10px;padding:10px;cursor:pointer;border-radius:6px;transition:0.15s;position:relative}
.song-item:hover{background:#f0f2f5}
.song-item.active{background:#e7f3ff}
.song-item.active .song-title{color:#1877f2;font-weight:600}
.song-num{font-weight:700;color:#65676b;min-width:22px;font-size:0.85em}
.song-item.active .song-num{color:#1877f2}
.song-thumb-wrap{width:32px;height:32px;border-radius:4px;overflow:hidden;flex-shrink:0;position:relative}
.song-thumb-static{width:100%;height:100%;object-fit:cover}
.song-thumb-playing{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.song-info{flex:1;min-width:0}
.song-title{font-weight:500;font-size:0.85em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.song-artist{font-size:0.75em;color:#65676b}
.song-playing-indicator{margin-left:auto}
.equalizer{display:flex;align-items:flex-end;gap:2px;height:16px}
.equalizer .bar{width:3px;background:#1877f2;border-radius:1px;animation:equalize 0.8s ease-in-out infinite}
.equalizer .bar:nth-child(1){height:8px;animation-delay:0s}
.equalizer .bar:nth-child(2){height:14px;animation-delay:0.15s}
.equalizer .bar:nth-child(3){height:6px;animation-delay:0.3s}
@keyframes equalize{0%,100%{height:6px}50%{height:14px}}

/* CHAT WIDGET */
.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.chat-toggle{width:50px;height:50px;border-radius:50%;background:#1877f2;color:#fff;border:none;font-size:1.3em;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:0.2s}
.chat-toggle:hover{background:#166fe5;transform:scale(1.05)}
.chat-panel{display:none;position:fixed;bottom:80px;right:20px;width:340px;height:450px;background:#fff;border-radius:8px;box-shadow:0 5px 25px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:9999}
.chat-panel.open{display:flex}
@media(max-width:480px){.chat-panel{width:100%;right:0;bottom:60px;border-radius:0;height:60vh}}
.chat-head{padding:10px 14px;border-bottom:1px solid #e4e6eb;display:flex;justify-content:space-between;align-items:center;font-weight:600;flex-shrink:0}
.chat-head button{background:none;border:none;font-size:1.2em;cursor:pointer;color:#65676b}
.chat-body{flex:1;overflow-y:auto;padding:10px;background:#f0f2f5}
.chat-login{text-align:center;padding:20px}
.chat-login input{width:100%;padding:10px;margin-bottom:8px;border:1px solid #ccd0d5;border-radius:6px;font-size:0.9em;outline:none}
.chat-login input:focus{border-color:#1877f2}
.chat-login button{width:100%;padding:10px;background:#1877f2;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer}
.chat-input-area{padding:10px;border-top:1px solid #e4e6eb;display:none;background:#fff;flex-shrink:0}
.chat-input-row{display:flex;align-items:center;gap:6px}
.chat-input-row input{flex:1;padding:8px 12px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.9em;outline:none}
.chat-input-row input:focus{border-color:#1877f2}
.chat-input-row button{background:#1877f2;color:#fff;border:none;width:34px;height:34px;border-radius:50%;cursor:pointer;flex-shrink:0}
.msg{max-width:75%;padding:7px 10px;border-radius:18px;margin-bottom:4px;font-size:0.85em;word-wrap:break-word}
.msg.user{background:#1877f2;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:#e4e6eb;color:#1c1e21;border-bottom-left-radius:4px}
.msg .time{font-size:0.7em;opacity:0.7;margin-top:2px;text-align:right}
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <img src="${ASSETS.profile}" class="header-logo" onerror="this.style.display='none'">
    <span class="header-name">Baiilla Maach</span>
  </div>
  <a href="/messenger" class="header-btn">💬 Support Chat</a>
</header>

<div class="container">

<!-- PROFILE CARD -->
<div class="card profile-card">
  <div class="profile-cover">
    <div class="profile-cover-actions">
      <button class="cover-btn" title="Official Page">✅ Official</button>
      <button class="cover-btn report-btn" title="Report Fake">🚨 Report Fake</button>
    </div>
  </div>
  <div class="profile-avatar-wrap">
    <img src="${ASSETS.profile}" class="profile-avatar" onerror="this.style.display='none'">
    <div class="verified-badge">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
  </div>
  <h2 class="profile-name">Hammad Bin Amir</h2>
  <div class="profile-username">@baiillamaach_official</div>
  <div class="profile-bio">Official Entertainment Profile · Verified Creator</div>
  
  <div class="stats-row">
    <div class="stat"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div>
    <div class="stat"><div class="stat-num">0</div><div class="stat-label">Following</div></div>
    <div class="stat"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div>
  </div>
  
  <!-- REORGANIZED ACTION BUTTONS -->
  <div class="profile-actions">
    <div class="action-row action-primary">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-primary btn-lg">
        <img src="${ASSETS.logoTikTok}" width="18"> Follow TikTok
      </a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-outline btn-lg">
        <img src="${ASSETS.logoFB}" width="18"> Facebook
      </a>
    </div>
    <div class="action-row action-secondary">
      <span class="badge-official">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        Official Creator
      </span>
    </div>
  </div>
</div>

<!-- VERIFIED ACCOUNTS -->
<div class="card">
  <div class="card-header">
    <span class="badge badge-green">OFFICIAL</span>
    <h3>Verified Accounts</h3>
    <p>The only authentic accounts</p>
  </div>
  <div class="card-body">
    <div class="grid-2">
      <div class="verified-item">
        <img src="${ASSETS.profile}" class="v-avatar">
        <div class="v-info">
          <h4>TikTok <img src="${ASSETS.blueTikTok}"></h4>
          <div class="v-handle">@baiillamaach_official</div>
          <div class="v-detail">✓ Active · <strong>7K</strong> Followers · <strong>190K</strong> Likes</div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-primary" style="margin-top:6px;padding:5px 12px;font-size:0.8em">Follow</a>
        </div>
      </div>
      <div class="verified-item">
        <img src="${ASSETS.fbProfile}" class="v-avatar">
        <div class="v-info">
          <h4>Facebook <img src="${ASSETS.blueFB}"></h4>
          <div class="v-handle">@BaiillaMaachOfficial</div>
          <div class="v-detail">✓ Active · Official Page</div>
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-outline" style="margin-top:6px;padding:5px 12px;font-size:0.8em">Follow</a>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- FAKE ACCOUNTS -->
<div class="card">
  <div class="card-header">
    <span class="badge badge-red">WARNING</span>
    <h3>Fake Accounts Detected</h3>
    <p>Report these accounts</p>
  </div>
  <div class="card-body">
    <div class="grid-2">
      <div class="fake-card">
        <div class="fake-img-wrap">
          <img src="${ASSETS.baillamachFake}" class="fake-img">
          <img src="${ASSETS.fakeDetect}" class="fake-overlay">
        </div>
        <div class="fake-body">
          <h4>@baiilla_mach</h4>
          <div class="platform">📍 TikTok</div>
          <p>Copies official content to deceive.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-danger btn-sm">🚨 Report</a>
        </div>
      </div>
      <div class="fake-card">
        <div class="fake-img-wrap">
          <img src="${ASSETS.hammadFake}" class="fake-img">
          <img src="${ASSETS.fakeDetect}" class="fake-overlay">
        </div>
        <div class="fake-body">
          <h4>@hammad_fams0</h4>
          <div class="platform">📍 TikTok</div>
          <p>Impersonating with fake content.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-danger btn-sm">🚨 Report</a>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ID VERIFICATION -->
<div class="card">
  <div class="card-header">
    <span class="badge badge-blue">PROOF</span>
    <h3>Real ID Verified</h3>
  </div>
  <div class="proof-single">
    <img src="${ASSETS.realId}">
    <div class="label">✅ Official ID Verified</div>
  </div>
</div>

${voiceHTML}

<!-- MUSIC PLAYER - FIXED SYNC -->
${songs.length > 0 ? `
<div class="card">
  <div class="card-header">
    <span class="badge badge-blue">MUSIC</span>
    <h3>Cover Songs</h3>
  </div>
  <div class="music-section">
    <div class="music-header">
      <div class="music-cover-wrap">
        <img src="${ASSETS.musicDefault}" class="music-cover-static" id="mainCoverStatic">
        <img src="${ASSETS.playGif}" class="music-cover-playing" id="mainCoverPlaying">
      </div>
      <div class="music-info">
        <div class="music-title" id="mTitle">Select a song</div>
        <div class="music-artist">Baiilla Maach</div>
      </div>
    </div>
    <div class="music-slider" onclick="seekMusic(event)">
      <div class="music-slider-fill" id="mSliderFill"></div>
    </div>
    <div class="music-time-row">
      <span id="mCurrentTime">0:00</span>
      <span id="mDuration">0:00</span>
    </div>
    <div class="music-controls">
      <button class="music-btn music-btn-nav" onclick="prevMusic()">⏮</button>
      <button class="music-btn music-btn-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
      <button class="music-btn music-btn-nav" onclick="nextMusic()">⏭</button>
    </div>
    <div class="music-list" id="musicList">
      ${songsListHTML}
    </div>
  </div>
</div>` : ''}

</div>

<!-- CHAT WIDGET -->
<div class="chat-widget">
  <button class="chat-toggle" onclick="toggleChat()">💬</button>
</div>
<div class="chat-panel" id="chatPanel">
  <div class="chat-head">💬 Chat Support<button onclick="toggleChat()">✕</button></div>
  <div class="chat-body" id="chatBody">
    <div class="chat-login" id="chatLoginForm">
      <h4 style="margin-bottom:8px">Start Chat</h4>
      <input type="text" id="chatNameInput" placeholder="Your Name">
      <input type="text" id="chatEmailInput" placeholder="Email or Phone">
      <button onclick="startChatSession()">Start Chatting</button>
    </div>
  </div>
  <div class="chat-input-area" id="chatInputArea">
    <div class="chat-input-row">
      <input type="text" id="chatMsgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
      <button onclick="sendChatMsg()">➤</button>
    </div>
  </div>
</div>

${WELCOME_VOICE ? '<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>' : ''}
${MANUAL_VOICE ? '<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>' : ''}
<audio id="musicAudio" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
// ===== AUDIO PLAYER - FIXED STATE MANAGEMENT =====
var welcomeAudio=document.getElementById("welcomeAudio");
var manualAudio=document.getElementById("manualAudio");
var musicAudio=document.getElementById("musicAudio");
var tracks=${songsJSON};
var currentTrack=-1;
var musicPlaying=false;
var isSeeking=false;

// DOM refs cached
var mainCoverStatic=document.getElementById("mainCoverStatic");
var mainCoverPlaying=document.getElementById("mainCoverPlaying");
var mTitle=document.getElementById("mTitle");
var mPlayBtn=document.getElementById("mPlayBtn");
var mSliderFill=document.getElementById("mSliderFill");
var mCurrentTime=document.getElementById("mCurrentTime");
var mDuration=document.getElementById("mDuration");

function stopAllAudio(){
  if(welcomeAudio){welcomeAudio.pause();welcomeAudio.currentTime=0}
  if(manualAudio){manualAudio.pause();manualAudio.currentTime=0}
  if(musicAudio){musicAudio.pause();musicAudio.currentTime=0}
  setPlayingState(false)
}
function playWelcomeVoice(){if(!welcomeAudio)return;stopAllAudio();welcomeAudio.play()}
function playManualVoice(){if(!manualAudio)return;stopAllAudio();manualAudio.play()}

function setPlayingState(playing){
  musicPlaying=playing;
  updatePlayBtn();
  updateCoverArt();
  updatePlaylistUI()
}

function updatePlayBtn(){
  if(mPlayBtn)mPlayBtn.textContent=musicPlaying?"⏸":"▶"
}

function updateCoverArt(){
  if(!mainCoverStatic||!mainCoverPlaying)return;
  if(musicPlaying&&currentTrack>=0){
    mainCoverStatic.style.display="none";
    mainCoverPlaying.style.display="block"
  }else{
    mainCoverStatic.style.display="block";
    mainCoverPlaying.style.display="none"
  }
}

// FIXED: Update playlist UI to sync with current track
function updatePlaylistUI(){
  var items=document.querySelectorAll(".song-item");
  for(var j=0;j<items.length;j++){
    var item=items[j];
    var staticThumb=document.getElementById("thumb-static-"+j);
    var playingThumb=document.getElementById("thumb-playing-"+j);
    var indicator=document.getElementById("indicator-"+j);
    
    if(j===currentTrack){
      // Active track
      item.classList.add("active");
      if(musicPlaying){
        if(staticThumb)staticThumb.style.display="none";
        if(playingThumb)playingThumb.style.display="block";
        if(indicator)indicator.style.display="block"
      }else{
        if(staticThumb)staticThumb.style.display="block";
        if(playingThumb)playingThumb.style.display="none";
        if(indicator)indicator.style.display="none"
      }
    }else{
      // Inactive track
      item.classList.remove("active");
      if(staticThumb)staticThumb.style.display="block";
      if(playingThumb)playingThumb.style.display="none";
      if(indicator)indicator.style.display="none"
    }
  }
}

function updateMainTitle(i){
  if(mTitle&&tracks[i])mTitle.textContent=tracks[i].title
}

function playMusic(i){
  if(!tracks.length||i<0||i>=tracks.length)return;
  stopAllAudio();
  currentTrack=i;
  musicAudio.src=tracks[i].url;
  musicAudio.play().then(function(){
    setPlayingState(true);
    updateMainTitle(currentTrack);
    updatePlaylistUI()
  }).catch(function(e){
    console.error("Playback failed:",e);
    setPlayingState(false)
  })
}

function toggleMusic(){
  if(musicPlaying){
    musicAudio.pause();
    setPlayingState(false);
    updatePlaylistUI()
  }else{
    if(!musicAudio.src&&tracks.length){
      currentTrack=0;
      musicAudio.src=tracks[0].url;
      updateMainTitle(0)
    }
    musicAudio.play().then(function(){
      setPlayingState(true);
      updatePlaylistUI()
    }).catch(function(e){
      console.error("Playback failed:",e)
    })
  }
}

function prevMusic(){
  if(currentTrack<0)currentTrack=0;
  var prev=(currentTrack-1+tracks.length)%tracks.length;
  playMusic(prev)
}

function nextMusic(){
  if(currentTrack<0)currentTrack=0;
  var next=(currentTrack+1)%tracks.length;
  playMusic(next)
}

function seekMusic(e){
  if(!musicAudio.duration||isSeeking)return;
  var r=e.currentTarget.getBoundingClientRect();
  var pos=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  musicAudio.currentTime=pos*musicAudio.duration
}

// Audio events
musicAudio.addEventListener("timeupdate",function(){
  if(musicAudio.duration&&mSliderFill){
    var pct=(musicAudio.currentTime/musicAudio.duration)*100;
    mSliderFill.style.width=pct+"%";
    mCurrentTime.textContent=formatTime(musicAudio.currentTime);
    mDuration.textContent=formatTime(musicAudio.duration)
  }
});

musicAudio.addEventListener("ended",function(){
  nextMusic()
});

musicAudio.addEventListener("loadedmetadata",function(){
  if(mDuration)mDuration.textContent=formatTime(musicAudio.duration)
});

function formatTime(s){
  if(isNaN(s))return"0:00";
  var m=Math.floor(s/60),sec=Math.floor(s%60);
  return m+":"+String(sec).padStart(2,"0")
}

// Initialize playlist UI
if(tracks.length>0){
  updateMainTitle(0);
  updatePlaylistUI()
}

if(welcomeAudio)setTimeout(function(){welcomeAudio.play()},1500);

// ===== CHAT =====
var socket=io({transports:["websocket","polling"]});
var chatUser=null;

function toggleChat(){
  var p=document.getElementById("chatPanel");
  p.classList.toggle("open");
  if(p.classList.contains("open")&&chatUser)loadChatMessages()
}

function startChatSession(){
  var n=document.getElementById("chatNameInput").value.trim();
  var e=document.getElementById("chatEmailInput").value.trim();
  if(!n||!e)return;
  chatUser={name:n,email:e};
  socket.emit("register",{name:n,email:e});
  document.getElementById("chatLoginForm").style.display="none";
  document.getElementById("chatInputArea").style.display="block";
  loadChatMessages()
}

async function loadChatMessages(){
  if(!chatUser)return;
  try{
    var r=await fetch("/api/msgs/"+encodeURIComponent(chatUser.email));
    var ms=await r.json();
    var b=document.getElementById("chatBody");
    b.innerHTML="";
    if(ms.length===0){
      b.innerHTML='<div style="text-align:center;padding:20px;color:#65676b">No messages yet. Start chatting!</div>'
    }else{
      ms.forEach(function(m){addMsgToChat(m,b)})
    }
    b.scrollTop=b.scrollHeight
  }catch(e){console.error(e)}
}

function addMsgToChat(m,b){
  var cls=m.sender===chatUser.email?"user":"admin";
  var t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  b.innerHTML+='<div class="msg '+cls+'">'+m.message+'<div class="time">'+t+'</div></div>'
}

function sendChatMsg(){
  var i=document.getElementById("chatMsgInput");
  var m=i.value.trim();
  if(!m||!chatUser)return;
  socket.emit("sendMsg",{sender:chatUser.email,receiver:"admin",message:m,type:"text"});
  i.value="";i.focus()
}

// REALTIME new messages
socket.on("newMsg",function(m){
  if(chatUser&&(m.sender===chatUser.email||m.receiver===chatUser.email)){
    var b=document.getElementById("chatBody");
    addMsgToChat(m,b);
    b.scrollTop=b.scrollHeight
  }
});
</script>
</body>
</html>`;

  res.send(html);
});

// ==================== API ROUTES (SQLite) ====================

app.get('/api/msgs/:email', (req, res) => {
  try {
    const msgs = db.prepare(`
      SELECT * FROM messages 
      WHERE (sender = ? AND receiver = 'admin') 
         OR (sender = 'admin' AND receiver = ?)
      ORDER BY timestamp ASC
    `).all(req.params.email, req.params.email);
    res.json(msgs);
  } catch (err) { 
    res.json([]); 
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid' });
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid' });
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: 'Error' }); 
  }
});

app.get('/api/admin/users', (req, res) => {
  try {
    const users = db.prepare(`SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC`).all();
    users.forEach(u => {
      const c = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0`).get(u.email);
      u.unreadCount = c.count;
    });
    res.json(users);
  } catch (err) { 
    res.json([]); 
  }
});

// ==================== ADMIN MESSENGER PAGE ====================
app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Admin Messenger | Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,sans-serif;background:#f0f2f5;height:100vh;overflow:hidden;color:#1c1e21;font-size:15px;touch-action:manipulation}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.login-card{background:#fff;padding:30px;border-radius:12px;width:100%;max-width:380px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2)}
.login-card h2{font-weight:700;margin-bottom:4px;font-size:1.3em}
.login-card .sub{color:#65676b;font-size:0.9em;margin-bottom:20px}
.login-card input{width:100%;padding:12px;margin-bottom:10px;border:1px solid #ccd0d5;border-radius:8px;font-size:0.95em;outline:none;-webkit-appearance:none}
.login-card input:focus{border-color:#1877f2}
.login-card button{width:100%;padding:12px;background:#1877f2;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1em;-webkit-appearance:none}
.login-card button:active{background:#166fe5}
.login-card button:disabled{opacity:0.6}
.error{color:#e41e3f;font-size:0.85em;margin-top:8px;display:none}
.app{display:none;height:100vh}
.layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
@media(max-width:767px){.layout{flex-direction:column}}
.sidebar{width:340px;border-right:1px solid #e4e6eb;display:flex;flex-direction:column;flex-shrink:0}
@media(max-width:767px){.sidebar{width:100%;max-height:40vh;border-right:none;border-bottom:1px solid #e4e6eb}}
.sidebar-head{padding:14px;border-bottom:1px solid #e4e6eb;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.sidebar-head h2{font-size:1.1em;font-weight:700}
.sidebar-head button{background:none;border:none;color:#1877f2;font-weight:600;cursor:pointer;font-size:0.9em;padding:6px 10px;border-radius:4px}
.sidebar-head button:hover{background:#f0f2f5}
.search-box{padding:10px 14px;border-bottom:1px solid #e4e6eb;flex-shrink:0}
.search-box input{width:100%;padding:8px 12px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.9em;outline:none;-webkit-appearance:none}
.search-box input:focus{border-color:#1877f2}
.user-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.user-item{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #f0f2f5;-webkit-tap-highlight-color:transparent}
.user-item:hover{background:#f0f2f5}
.user-item.active{background:#e7f3ff}
.user-avatar{width:42px;height:42px;border-radius:50%;background:#1877f2;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;font-size:1.1em}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.9em}
.user-info .email{font-size:0.8em;color:#65676b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unread{background:#1877f2;color:#fff;font-size:0.7em;padding:3px 8px;border-radius:10px;font-weight:600;flex-shrink:0}
.chat-area{flex:1;display:flex;flex-direction:column;min-height:0}
@media(max-width:767px){.chat-area{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;display:none}.chat-area.active{display:flex}}
.chat-head{padding:12px 14px;border-bottom:1px solid #e4e6eb;display:flex;align-items:center;gap:10px;background:#f0f2f5;flex-shrink:0}
.back-btn{display:none;background:none;border:none;font-size:1.3em;cursor:pointer;padding:4px 8px;color:#1877f2}
@media(max-width:767px){.back-btn{display:block}}
.chat-head .avatar{width:36px;height:36px;border-radius:50%;background:#1877f2;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9em;flex-shrink:0}
.chat-head .name{font-weight:600;font-size:0.95em}
.chat-head .status{font-size:0.8em}
.chat-head .status.online{color:#10b981}
.chat-head .status.offline{color:#65676b}
.chat-msgs{flex:1;overflow-y:auto;padding:14px;background:#f0f2f5;-webkit-overflow-scrolling:touch}
.msg{max-width:70%;padding:8px 12px;border-radius:18px;margin-bottom:6px;font-size:0.85em;word-wrap:break-word}
.msg.sent{background:#1877f2;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.received{background:#e4e6eb;color:#1c1e21;border-bottom-left-radius:4px}
.msg .time{font-size:0.7em;opacity:0.7;margin-top:2px;text-align:right}
.chat-input{padding:10px 14px;border-top:1px solid #e4e6eb;display:none;background:#fff;flex-shrink:0}
.chat-input-row{display:flex;align-items:center;gap:8px}
.chat-input-row input{flex:1;padding:10px 14px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.95em;outline:none;-webkit-appearance:none}
.chat-input-row input:focus{border-color:#1877f2}
.chat-input-row button{background:#1877f2;color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;flex-shrink:0;font-size:1.1em}
.empty-state{text-align:center;color:#65676b;padding:60px 20px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.85em;z-index:9999;opacity:0;transition:opacity 0.3s}
.toast.show{opacity:1}
</style></head><body>

<div class="login-overlay" id="loginOverlay"><div class="login-card">
<h2>🔐 Admin Messenger</h2><p class="sub">Baiilla Maach Support Panel</p>
<input type="text" id="loginEmail" placeholder="Username" value="admin" autocomplete="username">
<input type="password" id="loginPassword" placeholder="Password" value="admin123" autocomplete="current-password">
<button id="loginBtn" onclick="doLogin()">Sign In</button>
<div class="error" id="loginError"></div></div></div>

<div class="app" id="app"><div class="layout">
<div class="sidebar" id="sidebar"><div class="sidebar-head"><h2>💬 Conversations</h2><button onclick="doLogout()">Logout</button></div>
<div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div>
<div class="user-list" id="userList"><div class="empty-state"><p>Loading...</p></div></div></div>

<div class="chat-area" id="chatArea"><div class="chat-head"><button class="back-btn" onclick="goBack()">←</button>
<div class="avatar" id="chatAvatar">?</div>
<div><div class="name" id="chatName">Select a user</div><div class="status offline" id="chatStatus">● Offline</div></div></div>
<div class="chat-msgs" id="chatMessages"><div class="empty-state"><h3>No conversation</h3><p>Select a user to start</p></div></div>
<div class="chat-input" id="chatInputArea"><div class="chat-input-row">
<input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()">➤</button></div></div></div>
</div></div>

<div class="toast" id="toast"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io({transports:["websocket","polling"]});
var currentUser=null,allUsers=[],isLoggedIn=false,refreshInterval=null;

function toast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2000)}

socket.on("connect",function(){console.log("Admin connected");if(isLoggedIn)loadUsers()});
socket.on("newMsg",function(m){
  if(currentUser&&((m.sender===currentUser.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===currentUser.email)))appendMessage(m);
  loadUsers()
});
socket.on("userStatus",function(d){
  if(currentUser&&currentUser.email===d.email){
    var s=document.getElementById("chatStatus");
    s.textContent=d.online?"● Online":"● Offline";
    s.className="status "+(d.online?"online":"offline")
  }
  loadUsers()
});

async function doLogin(){
  var e=document.getElementById("loginEmail").value.trim();
  var p=document.getElementById("loginPassword").value.trim();
  var err=document.getElementById("loginError"),btn=document.getElementById("loginBtn");
  err.style.display="none";
  if(!e||!p){err.textContent="Fill all fields";err.style.display="block";return}
  btn.disabled=true;btn.textContent="Signing...";
  try{
    var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});
    if(r.ok){
      isLoggedIn=true;
      localStorage.setItem("adminSession",JSON.stringify({email:e,password:p}));
      document.getElementById("loginOverlay").style.display="none";
      document.getElementById("app").style.display="block";
      socket.emit("register",{name:"Admin",email:"admin"});
      loadUsers();
      refreshInterval=setInterval(function(){if(isLoggedIn)loadUsers()},10000)
    }else{err.textContent="❌ Invalid credentials";err.style.display="block"}
  }catch(ex){err.textContent="❌ Network error";err.style.display="block"}
  btn.disabled=false;btn.textContent="Sign In"
}

async function loadUsers(){
  if(!isLoggedIn)return;
  try{var r=await fetch("/api/admin/users");allUsers=await r.json();renderUserList()}catch(e){}
}

function renderUserList(){
  var s=document.getElementById("searchInput").value.toLowerCase();
  var f=allUsers.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)});
  var h="";
  f.forEach(function(u){
    var a=currentUser&&currentUser.email===u.email;
    h+='<div class="user-item'+(a?" active":"")+'" onclick="selectUser(\\''+u.email+'\\')"><div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':"")+'</div>'
  });
  document.getElementById("userList").innerHTML=h||'<div class="empty-state"><p>No users yet</p></div>'
}

function filterUsers(){renderUserList()}

async function selectUser(e){
  var u=allUsers.find(function(u){return u.email===e});if(!u)return;currentUser=u;
  document.getElementById("chatAvatar").textContent=u.name.charAt(0).toUpperCase();
  document.getElementById("chatName").textContent=u.name;
  document.getElementById("chatStatus").textContent=u.isOnline?"● Online":"● Offline";
  document.getElementById("chatStatus").className="status "+(u.isOnline?"online":"offline");
  document.getElementById("chatInputArea").style.display="block";
  document.getElementById("chatArea").classList.add("active");
  if(window.innerWidth<768)document.getElementById("sidebar").style.display="none";
  try{
    var r=await fetch("/api/msgs/"+encodeURIComponent(u.email));
    var ms=await r.json();
    var c=document.getElementById("chatMessages");c.innerHTML="";
    if(ms.length===0)c.innerHTML='<div class="empty-state"><h3>No messages</h3></div>';
    else ms.forEach(function(m){addMsg(m,c)});
    c.scrollTop=99999
  }catch(ex){}
  socket.emit("markRead",{user:u.email});renderUserList()
}

function addMsg(m,c){
  var s=m.sender==="admin";
  var t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  c.innerHTML+='<div class="msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>'
}

function appendMessage(m){if(!currentUser)return;var c=document.getElementById("chatMessages");addMsg(m,c);c.scrollTop=99999}

function sendMessage(){
  if(!currentUser){toast("Select a user");return}
  var i=document.getElementById("msgInput");var m=i.value.trim();
  if(!m)return;
  socket.emit("sendMsg",{sender:"admin",receiver:currentUser.email,message:m,type:"text"});
  appendMessage({sender:"admin",receiver:currentUser.email,message:m,timestamp:new Date().toISOString()});
  i.value="";i.focus()
}

function goBack(){
  document.getElementById("chatArea").classList.remove("active");
  document.getElementById("sidebar").style.display="flex";
  currentUser=null;
  document.getElementById("chatMessages").innerHTML='<div class="empty-state"><h3>No conversation</h3><p>Select a user to start</p></div>';
  document.getElementById("chatInputArea").style.display="none";
  renderUserList()
}

function doLogout(){if(refreshInterval)clearInterval(refreshInterval);localStorage.removeItem("adminSession");isLoggedIn=false;location.reload()}

var saved=localStorage.getItem("adminSession");
if(saved){var d=JSON.parse(saved);document.getElementById("loginEmail").value=d.email;document.getElementById("loginPassword").value=d.password}
document.addEventListener("DOMContentLoaded",function(){document.getElementById("loginPassword").addEventListener("keypress",function(e){if(e.key==="Enter")doLogin()})});
window.addEventListener("resize",function(){if(window.innerWidth>=768&&currentUser){document.getElementById("sidebar").style.display="flex"}});
</script></body></html>`);
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);
  
  socket.on('register', (data) => {
    try {
      socket.userData = data;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
      if (!user) {
        const h = bcrypt.hashSync('default123', 10);
        db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(data.name, data.email, h);
      }
      db.prepare('UPDATE users SET isOnline = 1, lastSeen = datetime("now") WHERE email = ?').run(data.email);
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) {}
  });
  
  socket.on('sendMsg', (data) => {
    try {
      const r = db.prepare('INSERT INTO messages (sender, receiver, message, type) VALUES (?, ?, ?, ?)').run(data.sender, data.receiver, data.message, data.type || 'text');
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(r.lastInsertRowid);
      io.emit('newMsg', msg);
    } catch (err) {}
  });
  
  socket.on('markRead', (data) => {
    try { db.prepare('UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = "admin" AND seen = 0').run(data.user); } catch (err) {}
  });
  
  socket.on('disconnect', () => {
    if (socket.userData) {
      try {
        db.prepare('UPDATE users SET isOnline = 0, lastSeen = datetime("now") WHERE email = ?').run(socket.userData.email);
        io.emit('userStatus', { email: socket.userData.email, online: false });
      } catch (err) {}
    }
  });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Admin: http://localhost:' + PORT + '/messenger');
  console.log('👤 Admin: admin / admin123');
  console.log('💾 Database: SQLite');
  console.log('⚡ Realtime chat enabled');
  console.log('🎵 Audio player sync fixed');
  console.log('========================================');
});

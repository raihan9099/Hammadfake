require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// SQLite instead of MongoDB
const betterSqlite3 = require('better-sqlite3');
const db = new betterSqlite3('database.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    password TEXT,
    isAdmin INTEGER DEFAULT 0,
    lastSeen TEXT,
    isOnline INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    message TEXT,
    type TEXT DEFAULT 'text',
    fileUrl TEXT,
    seen INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now'))
  );
`);

// Create admin if not exists
const adminRow = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get('admin');
if (adminRow) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(hash, 'Admin', 'admin');
  console.log('✅ Admin updated');
} else {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('Admin', 'admin', hash);
  console.log('✅ Admin created');
}

console.log('✅ SQLite Connected');
console.log('👤 Admin login: admin / admin123');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 4000;

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
  baillamachFake: "/assets/baillamach_fake.png",
  hammadFake: "/assets/hammadfams.png"
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
        url: '/assets/covermusic/' + encodeURIComponent(f)
      }));
  } catch (e) { return []; }
}

// ==================== MAIN PAGE ====================
app.get('/', (req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);
  
  let songsListHTML = '';
  songs.forEach((s, i) => {
    songsListHTML += `<div class="song-item" onclick="playMusic(${i})" id="song-${i}">
      <span class="song-num">${String(i+1).padStart(2,'0')}</span>
      <div class="song-info"><div class="song-title">${s.title}</div><div class="song-artist">Baiilla Maach</div></div>
    </div>`;
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `<div class="fb-card"><div class="fb-card-header">
      <span class="fb-badge fb-badge-blue">VOICE</span>
      <h3>Voice Verification</h3></div>
      <div class="fb-card-body"><div class="btn-group">
      ${WELCOME_VOICE ? '<button class="fb-btn fb-btn-primary" onclick="playWelcomeVoice()"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Real Voice</button>' : ''}
      ${MANUAL_VOICE ? '<button class="fb-btn fb-btn-danger" onclick="playManualVoice()">🚨 Fake Alert</button>' : ''}
      </div></div></div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Baiilla Maach Official</title>
<link href="https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --fb-white:#FFFFFF;
  --fb-bg:#F0F2F5;
  --fb-card:#FFFFFF;
  --fb-text:#1C1E21;
  --fb-secondary:#65676B;
  --fb-primary:#1877F2;
  --fb-primary-hover:#166FE5;
  --fb-green:#42B72A;
  --fb-red:#FA383E;
  --fb-border:#E4E6EB;
  --fb-hover:#F2F2F2;
  --fb-shadow:0 1px 2px rgba(0,0,0,0.1);
  --fb-radius:8px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--fb-bg);color:var(--fb-text);line-height:1.5;touch-action:manipulation;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:var(--fb-primary)}img{max-width:100%}
button,input{touch-action:manipulation;font-family:inherit}

/* FB Style Header */
.fb-header{position:sticky;top:0;z-index:100;background:var(--fb-white);box-shadow:0 2px 4px rgba(0,0,0,0.1);padding:0 16px;height:56px;display:flex;align-items:center;justify-content:space-between}
.fb-header-left{display:flex;align-items:center;gap:12px}
.fb-logo-circle{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--fb-border)}
.fb-header-name{font-weight:700;font-size:1.1em;color:var(--fb-text)}
.fb-header-btn{background:var(--fb-primary);color:#fff;padding:8px 16px;border-radius:6px;font-weight:600;font-size:0.9em;cursor:pointer;border:none;transition:0.2s}
.fb-header-btn:hover{background:var(--fb-primary-hover)}

.fb-container{max-width:680px;margin:16px auto;padding:0 16px}

/* FB Cards */
.fb-card{background:var(--fb-card);border-radius:var(--fb-radius);box-shadow:var(--fb-shadow);margin-bottom:12px;overflow:hidden}
.fb-card-header{padding:16px 16px 12px;border-bottom:1px solid var(--fb-border)}
.fb-card-body{padding:16px}
.fb-badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
.fb-badge-blue{background:#E7F3FF;color:#1877F2}
.fb-badge-red{background:#FFE5E5;color:#FA383E}
.fb-badge-green{background:#E5F5E0;color:#42B72A}
h3{font-size:1.1em;font-weight:700;margin-bottom:2px}
.card-subtitle{color:var(--fb-secondary);font-size:0.85em}

/* Profile */
.fb-profile-card{text-align:center;padding:0}
.fb-cover{height:200px;background:linear-gradient(180deg,#1877F2 0%,#1877F2 50%,#FFFFFF 50%,#FFFFFF 100%);position:relative}
.fb-cover-img{width:100%;height:100%;object-fit:cover;border-radius:var(--fb-radius) var(--fb-radius) 0 0}
.fb-avatar-wrap{margin-top:-64px;position:relative;display:inline-block}
.fb-avatar{width:132px;height:132px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.2)}
.fb-verified{position:absolute;bottom:6px;right:6px;background:var(--fb-primary);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.fb-verified svg{width:14px;height:14px;fill:#fff}
.fb-profile-name{font-size:1.6em;font-weight:800;margin-top:8px;color:var(--fb-text)}
.fb-username{color:var(--fb-secondary);font-size:0.95em;margin-bottom:2px}
.fb-bio{color:var(--fb-secondary);font-size:0.85em;margin-bottom:8px}
.fb-stats{display:flex;justify-content:center;gap:32px;padding:12px 0;margin:0 16px;border-top:1px solid var(--fb-border)}
.fb-stat{text-align:center}
.fb-stat-num{font-size:1.1em;font-weight:700;color:var(--fb-text)}
.fb-stat-label{font-size:0.75em;color:var(--fb-secondary)}
.fb-divider{height:4px;background:var(--fb-bg)}

.btn-group{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:12px 16px}
.fb-btn{padding:8px 20px;border-radius:6px;font-weight:600;font-size:0.9em;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:6px;transition:0.2s}
.fb-btn-primary{background:var(--fb-primary);color:#fff}.fb-btn-primary:hover{background:var(--fb-primary-hover)}
.fb-btn-secondary{background:var(--fb-hover);color:var(--fb-text)}.fb-btn-secondary:hover{background:#E4E6EB}
.fb-btn-danger{background:var(--fb-red);color:#fff}.fb-btn-danger:hover{background:#e03131}
.fb-btn-block{width:100%;justify-content:center}

/* Grid */
.fb-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.fb-grid-2{grid-template-columns:1fr}}

/* Verified Items */
.fb-verified-item{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--fb-border);border-radius:var(--fb-radius)}
.fb-v-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0}
.fb-v-info{flex:1;min-width:0}
.fb-v-info h4{font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:4px}
.fb-v-info h4 img{width:16px;height:16px}
.fb-v-handle{font-size:0.8em;color:var(--fb-secondary)}
.fb-v-detail{font-size:0.75em;color:var(--fb-text);margin-top:2px}

/* Fake Cards */
.fb-fake-card{border:1px solid #FFCCCC;border-radius:var(--fb-radius);overflow:hidden}
.fb-fake-img{width:100%;display:block}
.fb-fake-body{padding:12px}
.fb-fake-body h4{font-weight:600;font-size:0.9em}
.fb-fake-body .platform{color:#F59E0B;font-weight:600;font-size:0.8em;margin:2px 0}
.fb-fake-body p{font-size:0.8em;color:var(--fb-secondary);margin-bottom:8px}

/* ID Proof */
.fb-id-card{text-align:center;padding:20px}
.fb-id-img{max-width:100%;border-radius:8px;border:1px solid var(--fb-border)}

/* Music */
.fb-music-section{padding:16px}
.fb-music-header{display:flex;align-items:center;gap:12px;padding:12px;background:var(--fb-bg);border-radius:var(--fb-radius);margin-bottom:12px}
.fb-music-info{flex:1;min-width:0}
.fb-music-title{font-weight:600;font-size:0.95em}
.fb-music-artist{font-size:0.8em;color:var(--fb-secondary)}
.fb-slider{width:100%;height:4px;background:var(--fb-border);border-radius:2px;cursor:pointer;margin:8px 0;position:relative}
.fb-slider-fill{height:100%;background:var(--fb-primary);border-radius:2px;width:0;transition:width 0.1s}
.fb-time-row{display:flex;justify-content:space-between;font-size:0.75em;color:var(--fb-secondary);margin-bottom:8px}
.fb-music-controls{display:flex;align-items:center;justify-content:center;gap:16px}
.fb-music-btn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-size:1em;display:flex;align-items:center;justify-content:center;transition:0.15s}
.fb-music-nav{background:var(--fb-hover);color:var(--fb-text)}.fb-music-nav:hover{background:#E4E6EB}
.fb-music-play{background:var(--fb-primary);color:#fff;width:48px;height:48px;font-size:1.3em}.fb-music-play:hover{background:var(--fb-primary-hover)}
.fb-music-list{max-height:200px;overflow-y:auto;border-top:1px solid var(--fb-border);margin-top:12px;padding-top:8px}
.song-item{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;border-radius:6px;transition:0.1s}
.song-item:hover{background:var(--fb-hover)}
.song-item.active{background:#E7F3FF}
.song-num{font-weight:700;color:var(--fb-secondary);min-width:22px;font-size:0.85em}
.song-info{flex:1;min-width:0}
.song-title{font-weight:500;font-size:0.85em}
.song-artist{font-size:0.75em;color:var(--fb-secondary)}

/* Chat Widget */
.fb-chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.fb-chat-toggle{width:48px;height:48px;border-radius:50%;background:var(--fb-primary);color:#fff;border:none;font-size:1.2em;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:0.2s}
.fb-chat-toggle:hover{background:var(--fb-primary-hover);transform:scale(1.05)}
.fb-chat-panel{display:none;position:fixed;bottom:80px;right:20px;width:338px;height:460px;background:#fff;border-radius:8px;box-shadow:0 5px 25px rgba(0,0,0,0.25);flex-direction:column;overflow:hidden;z-index:9999;border:1px solid var(--fb-border)}
.fb-chat-panel.open{display:flex}
@media(max-width:480px){.fb-chat-panel{width:100%;right:0;bottom:60px;border-radius:0;height:70vh}}
.fb-chat-head{padding:10px 14px;border-bottom:1px solid var(--fb-border);display:flex;justify-content:space-between;align-items:center;font-weight:600;background:#fff;flex-shrink:0}
.fb-chat-head button{background:none;border:none;font-size:1.3em;cursor:pointer;color:var(--fb-secondary);padding:4px 8px;border-radius:50%}
.fb-chat-head button:hover{background:var(--fb-hover)}
.fb-chat-body{flex:1;overflow-y:auto;padding:10px;background:var(--fb-bg)}
.fb-chat-login{text-align:center;padding:20px;background:#fff;border-radius:8px}
.fb-chat-login h4{font-weight:600;margin-bottom:12px}
.fb-input{width:100%;padding:10px 12px;margin-bottom:8px;border:1px solid var(--fb-border);border-radius:6px;font-size:0.9em;outline:none;background:var(--fb-bg);transition:0.2s}
.fb-input:focus{border-color:var(--fb-primary);background:#fff}
.fb-chat-input-area{padding:10px;border-top:1px solid var(--fb-border);display:none;background:#fff;flex-shrink:0}
.fb-chat-input-row{display:flex;align-items:center;gap:8px}
.fb-chat-input{flex:1;padding:8px 12px;border:1px solid var(--fb-border);border-radius:20px;font-size:0.9em;outline:none;background:var(--fb-bg)}
.fb-chat-input:focus{border-color:var(--fb-primary);background:#fff}
.fb-send-btn{background:var(--fb-primary);color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:0.15s}
.fb-send-btn:hover{background:var(--fb-primary-hover)}

/* Messages */
.fb-msg{max-width:80%;padding:8px 12px;border-radius:18px;margin-bottom:4px;font-size:0.85em;word-wrap:break-word;position:relative}
.fb-msg-user{background:var(--fb-primary);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.fb-msg-admin{background:#E4E6EB;color:var(--fb-text);margin-right:auto;border-bottom-left-radius:4px}
.fb-msg-time{font-size:0.65em;opacity:0.7;margin-top:3px;text-align:right}

/* ADMIN PANEL */
.fb-admin-panel{display:none;height:100vh;flex-direction:column;background:var(--fb-bg)}
.fb-admin-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.fb-admin-login{background:#fff;padding:24px;border-radius:8px;width:100%;max-width:380px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.15)}
.fb-admin-login h2{font-weight:700;margin-bottom:4px;font-size:1.2em}
.fb-admin-login .sub{color:var(--fb-secondary);font-size:0.85em;margin-bottom:16px}
.fb-admin-login input{width:100%;padding:12px;margin-bottom:10px;border:1px solid var(--fb-border);border-radius:6px;font-size:0.95em;outline:none;-webkit-appearance:none}
.fb-admin-login input:focus{border-color:var(--fb-primary)}
.fb-admin-login .fb-btn{width:100%;justify-content:center;padding:12px}
.fb-admin-error{color:var(--fb-red);font-size:0.85em;margin-top:8px;display:none}

.fb-admin-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:var(--fb-shadow)}
@media(max-width:767px){.fb-admin-layout{flex-direction:column}}
.fb-admin-sidebar{width:340px;background:#fff;display:flex;flex-direction:column;border-right:1px solid var(--fb-border);flex-shrink:0}
@media(max-width:767px){.fb-admin-sidebar{width:100%;max-height:45vh;border-right:none;border-bottom:1px solid var(--fb-border)}}
.fb-admin-sidebar-head{padding:12px 16px;border-bottom:1px solid var(--fb-border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.fb-admin-sidebar-head h2{font-size:1.1em;font-weight:700}
.fb-admin-sidebar-head button{background:none;border:none;color:var(--fb-primary);font-weight:600;cursor:pointer;font-size:0.85em;padding:6px 10px;border-radius:4px}
.fb-admin-sidebar-head button:hover{background:var(--fb-hover)}
.fb-admin-search{padding:8px 16px;border-bottom:1px solid var(--fb-border);flex-shrink:0}
.fb-admin-search input{width:100%;padding:8px 12px;border:1px solid var(--fb-border);border-radius:20px;font-size:0.85em;outline:none;-webkit-appearance:none;background:var(--fb-bg)}
.fb-admin-search input:focus{border-color:var(--fb-primary);background:#fff}
.fb-admin-user-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.fb-admin-user-item{padding:10px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:0.1s}
.fb-admin-user-item:hover{background:var(--fb-hover)}
.fb-admin-user-item.active{background:#E7F3FF}
.fb-admin-user-avatar{width:40px;height:40px;border-radius:50%;background:var(--fb-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;font-size:1em}
.fb-admin-user-info{flex:1;min-width:0}
.fb-admin-user-info .name{font-weight:600;font-size:0.88em}
.fb-admin-user-info .email{font-size:0.78em;color:var(--fb-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-admin-unread{background:var(--fb-primary);color:#fff;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:600;flex-shrink:0}

.fb-admin-chat-area{flex:1;display:flex;flex-direction:column;background:#fff;min-height:0}
@media(max-width:767px){.fb-admin-chat-area{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;display:none}.fb-admin-chat-area.active{display:flex}}
.fb-admin-chat-head{padding:10px 16px;border-bottom:1px solid var(--fb-border);display:flex;align-items:center;gap:10px;flex-shrink:0}
.fb-admin-back{display:none;background:none;border:none;font-size:1.3em;cursor:pointer;padding:4px 8px;color:var(--fb-primary);border-radius:50%}
@media(max-width:767px){.fb-admin-back{display:block}}
.fb-admin-chat-avatar{width:32px;height:32px;border-radius:50%;background:var(--fb-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.85em;flex-shrink:0}
.fb-admin-chat-name{font-weight:600;font-size:0.9em}
.fb-admin-chat-status{font-size:0.75em}
.fb-admin-chat-status.online{color:var(--fb-green)}
.fb-admin-chat-msgs{flex:1;overflow-y:auto;padding:16px;background:var(--fb-bg);-webkit-overflow-scrolling:touch}
.fb-admin-msg{max-width:70%;padding:8px 12px;border-radius:18px;margin-bottom:6px;font-size:0.85em;word-wrap:break-word}
.fb-admin-msg.sent{background:var(--fb-primary);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.fb-admin-msg.received{background:#fff;color:var(--fb-text);margin-right:auto;border-bottom-left-radius:4px;border:1px solid var(--fb-border)}
.fb-admin-msg .time{font-size:0.65em;opacity:0.7;margin-top:3px;text-align:right}
.fb-admin-chat-input{padding:10px 16px;border-top:1px solid var(--fb-border);display:none;background:#fff;flex-shrink:0}
.fb-admin-chat-row{display:flex;align-items:center;gap:8px}
.fb-admin-chat-row input{flex:1;padding:8px 14px;border:1px solid var(--fb-border);border-radius:20px;font-size:0.9em;outline:none;-webkit-appearance:none;background:var(--fb-bg)}
.fb-admin-chat-row input:focus{border-color:var(--fb-primary);background:#fff}
.fb-admin-chat-row button{background:var(--fb-primary);color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.fb-empty-state{text-align:center;color:var(--fb-secondary);padding:40px 20px}
.fb-empty-state h3{font-weight:600;margin-bottom:4px}
.fb-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1C1E21;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.85em;z-index:9999;opacity:0;transition:opacity 0.3s}
.fb-toast.show{opacity:1}
</style>
</head>
<body>

<!-- PUBLIC PAGE -->
<div class="public-page" id="publicPage">

<header class="fb-header">
<div class="fb-header-left">
<img src="${ASSETS.profile}" class="fb-logo-circle" onerror="this.style.display='none'">
<span class="fb-header-name">Baiilla Maach</span>
</div>
<button class="fb-header-btn" onclick="openAdmin()">🔧 Admin</button>
</header>

<div class="fb-container">

<!-- Profile Card -->
<div class="fb-card fb-profile-card">
<div class="fb-cover"></div>
<div class="fb-avatar-wrap">
<img src="${ASSETS.profile}" class="fb-avatar" onerror="this.style.display='none'">
<div class="fb-verified"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
</div>
<h2 class="fb-profile-name">Hammad Bin Amir</h2>
<div class="fb-username">@baiillamaach_official</div>
<div class="fb-bio">Official Entertainment Profile · Verified Creator</div>
<div class="fb-stats">
<div class="fb-stat"><div class="fb-stat-num">7K</div><div class="fb-stat-label">Followers</div></div>
<div class="fb-stat"><div class="fb-stat-num">0</div><div class="fb-stat-label">Following</div></div>
<div class="fb-stat"><div class="fb-stat-num">190K</div><div class="fb-stat-label">Likes</div></div>
</div>
<div class="btn-group">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="fb-btn fb-btn-primary"><img src="${ASSETS.logoTikTok}" width="18"> Follow TikTok</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="fb-btn fb-btn-secondary"><img src="${ASSETS.logoFB}" width="18"> Follow Facebook</a>
</div>
</div>

<!-- Verified Accounts -->
<div class="fb-card"><div class="fb-card-header"><span class="fb-badge fb-badge-green">OFFICIAL</span><h3>Verified Accounts</h3><p class="card-subtitle">The only authentic accounts</p></div><div class="fb-card-body"><div class="fb-grid-2">
<div class="fb-verified-item"><img src="${ASSETS.profile}" class="fb-v-avatar"><div class="fb-v-info"><h4>TikTok <img src="${ASSETS.blueTikTok}"></h4><div class="fb-v-handle">@baiillamaach_official</div><div class="fb-v-detail">✓ Active · <strong>7K</strong> Followers · <strong>190K</strong> Likes</div><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="fb-btn fb-btn-primary" style="margin-top:6px;padding:5px 12px;font-size:0.8em">Follow</a></div></div>
<div class="fb-verified-item"><img src="${ASSETS.fbProfile}" class="fb-v-avatar"><div class="fb-v-info"><h4>Facebook <img src="${ASSETS.blueFB}"></h4><div class="fb-v-handle">@BaiillaMaachOfficial</div><div class="fb-v-detail">✓ Active · Official Page</div><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="fb-btn fb-btn-secondary" style="margin-top:6px;padding:5px 12px;font-size:0.8em">Follow</a></div></div>
</div></div></div>

<!-- Fake Accounts -->
<div class="fb-card"><div class="fb-card-header"><span class="fb-badge fb-badge-red">WARNING</span><h3>Fake Accounts</h3><p class="card-subtitle">Report these impersonators</p></div><div class="fb-card-body"><div class="fb-grid-2">
<div class="fb-fake-card"><img src="${ASSETS.baillamachFake}" class="fb-fake-img"><div class="fb-fake-body"><h4>@baiilla_mach</h4><div class="platform">📍 TikTok</div><p>Copies official content</p><a href="https://tiktok.com/@baiilla_mach" target="_blank" class="fb-btn fb-btn-danger" style="padding:5px 12px;font-size:0.8em">🚨 Report</a></div></div>
<div class="fb-fake-card"><img src="${ASSETS.hammadFake}" class="fb-fake-img"><div class="fb-fake-body"><h4>@hammad_fams0</h4><div class="platform">📍 TikTok</div><p>Impersonating account</p><a href="https://tiktok.com/@hammad_fams0" target="_blank" class="fb-btn fb-btn-danger" style="padding:5px 12px;font-size:0.8em">🚨 Report</a></div></div>
</div></div></div>

<!-- ID Verification -->
<div class="fb-card"><div class="fb-card-header"><span class="fb-badge fb-badge-blue">VERIFIED</span><h3>Real ID Verified</h3></div><div class="fb-id-card"><img src="${ASSETS.realId}" class="fb-id-img"></div></div>

${voiceHTML}

${songs.length > 0 ? `<div class="fb-card"><div class="fb-card-header"><span class="fb-badge fb-badge-blue">MUSIC</span><h3>Cover Songs</h3></div><div class="fb-music-section">
<div class="fb-music-header"><div class="fb-music-info"><div class="fb-music-title" id="mTitle">Select Song</div><div class="fb-music-artist">Baiilla Maach</div></div></div>
<div class="fb-slider" onclick="seekMusic(event)"><div class="fb-slider-fill" id="mSliderFill"></div></div>
<div class="fb-time-row"><span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span></div>
<div class="fb-music-controls"><button class="fb-music-btn fb-music-nav" onclick="prevMusic()">⏮</button><button class="fb-music-btn fb-music-play" id="mPlayBtn" onclick="toggleMusic()">▶</button><button class="fb-music-btn fb-music-nav" onclick="nextMusic()">⏭</button></div>
<div class="fb-music-list">${songsListHTML}</div>
</div></div>` : ''}

</div>

<!-- Chat Widget -->
<div class="fb-chat-widget"><button class="fb-chat-toggle" onclick="toggleChat()">💬</button></div>
<div class="fb-chat-panel" id="chatPanel">
<div class="fb-chat-head">💬 Chat Support<button onclick="toggleChat()">✕</button></div>
<div class="fb-chat-body" id="chatBody">
<div class="fb-chat-login" id="chatLoginForm">
<h4>Start Chat</h4>
<input type="text" class="fb-input" id="chatNameInput" placeholder="Your Name">
<input type="text" class="fb-input" id="chatEmailInput" placeholder="Email or Phone">
<button class="fb-btn fb-btn-primary fb-btn-block" onclick="startChatSession()">Start Chatting</button>
</div></div>
<div class="fb-chat-input-area" id="chatInputArea">
<div class="fb-chat-input-row"><input type="text" class="fb-chat-input" id="chatMsgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendChatMsg()"><button class="fb-send-btn" onclick="sendChatMsg()">➤</button></div>
</div></div>

</div>

<!-- ADMIN PANEL -->
<div class="fb-admin-panel" id="adminPanel">

<div class="fb-admin-overlay" id="adminLoginOverlay"><div class="fb-admin-login">
<h2>🔐 Admin Messenger</h2><p class="sub">Baiilla Maach Support</p>
<input type="text" id="adminLoginEmail" placeholder="Username" value="admin" autocomplete="username">
<input type="password" id="adminLoginPassword" placeholder="Password" value="admin123" autocomplete="current-password">
<button class="fb-btn fb-btn-primary" id="adminLoginBtn" onclick="adminLogin()">Sign In</button>
<div class="fb-admin-error" id="adminLoginError"></div>
<button class="fb-btn fb-btn-secondary fb-btn-block" style="margin-top:10px" onclick="closeAdmin()">← Back</button>
</div></div>

<div class="fb-admin-layout" id="adminLayout" style="display:none">
<div class="fb-admin-sidebar">
<div class="fb-admin-sidebar-head"><h2>💬 Conversations</h2><div><button onclick="closeAdmin()">← Back</button><button onclick="adminLogout()" style="margin-left:4px">Logout</button></div></div>
<div class="fb-admin-search"><input type="text" id="adminSearchInput" placeholder="🔍 Search..." oninput="filterAdminUsers()"></div>
<div class="fb-admin-user-list" id="adminUserList"><div class="fb-empty-state"><p>Loading...</p></div></div>
</div>

<div class="fb-admin-chat-area" id="adminChatArea">
<div class="fb-admin-chat-head"><button class="fb-admin-back" onclick="adminGoBack()">←</button>
<div class="fb-admin-chat-avatar" id="adminChatAvatar">?</div>
<div><div class="fb-admin-chat-name" id="adminChatName">Select user</div><div class="fb-admin-chat-status offline" id="adminChatStatus">● Offline</div></div></div>
<div class="fb-admin-chat-msgs" id="adminChatMessages"><div class="fb-empty-state"><h3>No conversation</h3><p>Select a user to start</p></div></div>
<div class="fb-admin-chat-input" id="adminChatInputArea"><div class="fb-admin-chat-row">
<input type="text" id="adminMsgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')adminSendMsg()">
<button onclick="adminSendMsg()">➤</button></div></div></div>
</div>

</div>

<div class="fb-toast" id="toast"></div>

${WELCOME_VOICE ? '<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>' : ''}
${MANUAL_VOICE ? '<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>' : ''}
<audio id="musicAudio" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io({transports:["websocket","polling"]});
var adminLoggedIn=false,adminInterval=null,adminCurrent=null,adminUsers=[];

function toast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2000)}

// ===== PUBLIC CHAT =====
var chatUser=null;
function toggleChat(){document.getElementById("chatPanel").classList.toggle("open")}
function startChatSession(){
  var n=document.getElementById("chatNameInput").value.trim();
  var e=document.getElementById("chatEmailInput").value.trim();
  if(!n||!e){toast("Fill all fields");return}
  chatUser={name:n,email:e};
  socket.emit("register",{name:n,email:e});
  document.getElementById("chatLoginForm").style.display="none";
  document.getElementById("chatInputArea").style.display="block";
  loadChatMsgs()
}
async function loadChatMsgs(){
  if(!chatUser)return;
  var r=await fetch("/api/msgs/"+encodeURIComponent(chatUser.email));
  var ms=await r.json();
  var b=document.getElementById("chatBody");b.innerHTML="";
  if(!ms.length){b.innerHTML='<div style="text-align:center;padding:20px;color:#65676B">No messages yet</div>'}
  else ms.forEach(function(m){addChatMsg(m,b)});
  b.scrollTop=b.scrollHeight
}
function addChatMsg(m,b){
  var cls=m.sender===chatUser.email?"fb-msg-user":"fb-msg-admin";
  var t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  b.innerHTML+='<div class="fb-msg '+cls+'">'+m.message+'<div class="fb-msg-time">'+t+'</div></div>'
}
function sendChatMsg(){
  var i=document.getElementById("chatMsgInput");var m=i.value.trim();
  if(!m||!chatUser)return;
  socket.emit("sendMsg",{sender:chatUser.email,receiver:"admin",message:m,type:"text"});
  i.value=""
}
socket.on("newMsg",function(m){
  if(chatUser&&(m.sender===chatUser.email||m.receiver===chatUser.email)){
    var b=document.getElementById("chatBody");addChatMsg(m,b);b.scrollTop=b.scrollHeight
  }
  if(adminLoggedIn)loadAdminUsers()
});

// ===== ADMIN =====
function openAdmin(){document.getElementById("publicPage").style.display="none";document.getElementById("adminPanel").style.display="flex"}
function closeAdmin(){document.getElementById("adminPanel").style.display="none";document.getElementById("publicPage").style.display="block";if(adminInterval)clearInterval(adminInterval)}
async function adminLogin(){
  var e=document.getElementById("adminLoginEmail").value.trim();
  var p=document.getElementById("adminLoginPassword").value.trim();
  var err=document.getElementById("adminLoginError"),btn=document.getElementById("adminLoginBtn");
  err.style.display="none";
  if(!e||!p){err.textContent="Fill all fields";err.style.display="block";return}
  btn.disabled=true;btn.textContent="Signing...";
  var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});
  if(r.ok){adminLoggedIn=true;document.getElementById("adminLoginOverlay").style.display="none";document.getElementById("adminLayout").style.display="flex";loadAdminUsers();adminInterval=setInterval(loadAdminUsers,8000)}
  else{err.textContent="Invalid credentials";err.style.display="block"}
  btn.disabled=false;btn.textContent="Sign In"
}
async function loadAdminUsers(){
  var r=await fetch("/api/admin/users");adminUsers=await r.json();renderAdminUsers()
}
function renderAdminUsers(){
  var s=document.getElementById("adminSearchInput").value.toLowerCase();
  var f=adminUsers.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)});
  var h="";
  f.forEach(function(u){
    var a=adminCurrent&&adminCurrent.email===u.email;
    h+='<div class="fb-admin-user-item'+(a?" active":"")+'" onclick="adminSelect(\''+u.email+'\')"><div class="fb-admin-user-avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="fb-admin-user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="fb-admin-unread">'+u.unreadCount+'</div>':"")+'</div>'
  });
  document.getElementById("adminUserList").innerHTML=h||'<div class="fb-empty-state"><p>No users</p></div>'
}
function filterAdminUsers(){renderAdminUsers()}
async function adminSelect(e){
  var u=adminUsers.find(function(u){return u.email===e});if(!u)return;
  adminCurrent=u;
  document.getElementById("adminChatAvatar").textContent=u.name.charAt(0).toUpperCase();
  document.getElementById("adminChatName").textContent=u.name;
  document.getElementById("adminChatStatus").textContent=u.isOnline?"● Online":"● Offline";
  document.getElementById("adminChatStatus").className="fb-admin-chat-status "+(u.isOnline?"online":"offline");
  document.getElementById("adminChatInputArea").style.display="block";
  document.getElementById("adminChatArea").classList.add("active");
  if(window.innerWidth<768)document.querySelector(".fb-admin-sidebar").style.display="none";
  var r=await fetch("/api/msgs/"+encodeURIComponent(u.email));
  var ms=await r.json();
  var c=document.getElementById("adminChatMessages");
  c.innerHTML=ms.length?'':"<div class='fb-empty-state'><h3>No messages</h3></div>";
  ms.forEach(function(m){adminAddMsg(m,c)});
  c.scrollTop=99999;
  socket.emit("markRead",{user:u.email});renderAdminUsers()
}
function adminAddMsg(m,c){
  var s=m.sender==="admin";
  var t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  c.innerHTML+='<div class="fb-admin-msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>'
}
function adminSendMsg(){
  if(!adminCurrent)return;var i=document.getElementById("adminMsgInput");var m=i.value.trim();
  if(!m)return;socket.emit("sendMsg",{sender:"admin",receiver:adminCurrent.email,message:m,type:"text"});
  var c=document.getElementById("adminChatMessages");adminAddMsg({sender:"admin",receiver:adminCurrent.email,message:m,timestamp:new Date().toISOString()},c);c.scrollTop=99999;
  i.value="";i.focus()
}
function adminGoBack(){
  document.getElementById("adminChatArea").classList.remove("active");
  document.querySelector(".fb-admin-sidebar").style.display="flex";
  adminCurrent=null;
  document.getElementById("adminChatMessages").innerHTML='<div class="fb-empty-state"><h3>No conversation</h3></div>';
  document.getElementById("adminChatInputArea").style.display="none";
  renderAdminUsers()
}
function adminLogout(){if(adminInterval)clearInterval(adminInterval);adminLoggedIn=false;location.reload()}
socket.on("userStatus",function(d){if(adminCurrent&&adminCurrent.email===d.email){var s=document.getElementById("adminChatStatus");s.textContent=d.online?"● Online":"● Offline";s.className="fb-admin-chat-status "+(d.online?"online":"offline")}loadAdminUsers()});

// ===== MUSIC =====
var welcomeAudio=document.getElementById("welcomeAudio");
var manualAudio=document.getElementById("manualAudio");
var musicAudio=document.getElementById("musicAudio");
function stopAll(){if(welcomeAudio){welcomeAudio.pause();welcomeAudio.currentTime=0}if(manualAudio){manualAudio.pause();manualAudio.currentTime=0}if(musicAudio){musicAudio.pause()}musicPlaying=false;updatePlayBtn()}
function playWelcomeVoice(){if(!welcomeAudio)return;stopAll();welcomeAudio.play()}
function playManualVoice(){if(!manualAudio)return;stopAll();manualAudio.play()}
var tracks=${songsJSON},currentTrack=0,musicPlaying=false;
function updatePlayBtn(){var b=document.getElementById("mPlayBtn");if(b)b.textContent=musicPlaying?"⏸":"▶"}
function updateUI(i){document.getElementById("mTitle").textContent=tracks[i].title;document.querySelectorAll(".song-item").forEach(function(el,j){el.classList.toggle("active",j===i)})}
function playMusic(i){if(!tracks.length)return;stopAll();currentTrack=i;musicAudio.src=tracks[i].url;musicAudio.play();musicPlaying=true;updatePlayBtn();updateUI(i)}
function toggleMusic(){if(musicAudio.paused){if(!musicAudio.src&&tracks.length)musicAudio.src=tracks[0].url;stopAll();musicAudio.play();musicPlaying=true;updatePlayBtn();updateUI(currentTrack)}else{musicAudio.pause();musicPlaying=false;updatePlayBtn()}}
function prevMusic(){playMusic((currentTrack-1+tracks.length)%tracks.length)}
function nextMusic(){playMusic((currentTrack+1)%tracks.length)}
function seekMusic(e){if(!musicAudio.duration)return;var r=e.currentTarget.getBoundingClientRect();musicAudio.currentTime=((e.clientX-r.left)/r.width)*musicAudio.duration}
musicAudio.addEventListener("timeupdate",function(){if(musicAudio.duration){document.getElementById("mSliderFill").style.width=(musicAudio.currentTime/musicAudio.duration)*100+"%";document.getElementById("mCurrentTime").textContent=fmt(musicAudio.currentTime);document.getElementById("mDuration").textContent=fmt(musicAudio.duration)}});
musicAudio.addEventListener("ended",nextMusic);
function fmt(s){if(isNaN(s))return"0:00";var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+String(sec).padStart(2,"0")}
if(welcomeAudio)setTimeout(function(){welcomeAudio.play()},1500);
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
      WHERE (sender = ? AND receiver = 'admin') OR (sender = 'admin' AND receiver = ?)
      ORDER BY timestamp ASC
    `).all(req.params.email, req.params.email);
    res.json(msgs);
  } catch (err) { res.json([]); }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid' });
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC
    `).all();
    
    users.forEach(u => {
      u.unreadCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0
      `).get(u.email).count;
    });
    
    res.json(users);
  } catch (err) { res.json([]); }
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);
  
  socket.on('register', (data) => {
    try {
      socket.userData = data;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
      if (!user) {
        const hash = bcrypt.hashSync('default123', 10);
        db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(data.name, data.email, hash);
        console.log('✅ New user:', data.email);
      }
      db.prepare('UPDATE users SET isOnline = 1, lastSeen = datetime("now") WHERE email = ?').run(data.email);
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) { console.error(err); }
  });
  
  socket.on('sendMsg', (data) => {
    try {
      const result = db.prepare(`
        INSERT INTO messages (sender, receiver, message, type) VALUES (?, ?, ?, ?)
      `).run(data.sender, data.receiver, data.message, data.type || 'text');
      
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      io.emit('newMsg', msg);
    } catch (err) { console.error(err); }
  });
  
  socket.on('markRead', (data) => {
    try {
      db.prepare('UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = "admin" AND seen = 0').run(data.user);
    } catch (err) {}
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
  console.log('👤 Admin: admin / admin123');
  console.log('💾 Database: SQLite (database.db)');
  console.log('========================================');
});

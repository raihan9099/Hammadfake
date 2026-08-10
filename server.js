require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 4000;

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

const adminCheck = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get('admin');
const hash = bcrypt.hashSync('admin123', 10);
if (adminCheck) {
  db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(hash, 'Admin', 'admin');
} else {
  db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('Admin', 'admin', hash);
}

app.use(express.json());
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

['uploads', 'assets/covermusic'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const A = (name) => `/assets/${name}`;

const ASSETS = {
  avatar: A('celebrity_pfp.jpeg'),
  fbAvatar: A('fb_profile.jpg'),
  blueTikTok: A('bluetick_tiktok.png'),
  blueFB: A('blue_tick_fb.png'),
  logoFB: A('logo_fb.png'),
  logoFBPage: A('logo_fbpage.png'),
  logoTikTok: A('logo_tiktok.png'),
  realId: A('real-id-ss.png'),
  fakeDetect: A('Fakedetect_updown.png'),
  baillamachFake: A('baillamach_fake.png'),
  hammadFake: A('hammadfams.png'),
  followGif: A('follow.gif'),
  addGif: A('add.gif'),
  reportGif: A('report.gif'),
  reportBtn: A('report_button.png'),
  propagandaGif: A('propaganda.gif'),
  playGif: A('play.gif'),
  messageBubble: A('message_bubble.gif'),
  microphone: A('microphone-in-hand.gif'),
  realVoice: A('realvoice.mp3'),
  manualVoice: A('manualvoice_alert.mp3')
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

app.get('/', (req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);

  let songsListHTML = '';
  songs.forEach((s, i) => {
    songsListHTML += `
    <div class="song-item" onclick="playMusic(${i})" id="song-${i}">
      <span class="song-num">${String(i+1).padStart(2,'0')}</span>
      <div class="song-thumb-wrap">
        <img src="${ASSETS.playGif}" class="song-thumb-static" id="thumb-static-${i}">
        <img src="${ASSETS.playGif}" class="song-thumb-playing" id="thumb-playing-${i}" style="display:none">
      </div>
      <div class="song-info">
        <div class="song-title">${s.title}</div>
        <div class="song-artist">Baiilla Maach</div>
      </div>
      <div class="song-indicator" id="indicator-${i}" style="display:none">
        <span class="eq"><span></span><span></span><span></span></span>
      </div>
    </div>`;
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `<div class="card"><div class="card-head">
      <span class="tag tag-blue">VOICE</span>
      <h3>Voice Verification</h3>
      <p class="subtitle">Listen to authentic voice</p></div>
      <div class="card-body"><div class="btn-row">
      ${WELCOME_VOICE ? '<button class="btn btn-blue" onclick="playWelcomeVoice()"><img src="'+ASSETS.microphone+'" width="16"> Real Voice</button>' : ''}
      ${MANUAL_VOICE ? '<button class="btn btn-red" onclick="playManualVoice()"><img src="'+ASSETS.reportBtn+'" width="16"> Fake Alert</button>' : ''}
      </div></div></div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Baiilla Maach Official</title>
<style>
:root{
--bg:#F0F2F5;
--white:#FFFFFF;
--text:#1C1E21;
--secondary:#65676B;
--primary:#1877F2;
--primary-hover:#166FE5;
--green:#42B72A;
--red:#FA383E;
--border:#E4E6EB;
--hover:#F2F2F2;
--shadow:0 1px 2px rgba(0,0,0,0.1);
--radius:8px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:var(--primary)}
img{max-width:100%;display:block}
button,input{font-family:inherit;touch-action:manipulation}
button{cursor:pointer}

.topbar{position:sticky;top:0;z-index:100;background:var(--white);box-shadow:var(--shadow);padding:0 16px;height:56px;display:flex;align-items:center;justify-content:space-between}
.topbar-left{display:flex;align-items:center;gap:10px}
.topbar-logo{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--border)}
.topbar-name{font-weight:700;font-size:1.2em;color:var(--primary)}
.topbar-btn{background:var(--primary);color:#fff;padding:8px 18px;border-radius:20px;font-weight:600;font-size:0.9em;border:none;transition:0.15s}
.topbar-btn:hover{background:var(--primary-hover)}

.container{max-width:680px;margin:0 auto;padding:16px}
.card{background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden}
.card-head{padding:16px;border-bottom:1px solid var(--border)}
.card-body{padding:16px}
.tag{display:inline-block;padding:3px 10px;border-radius:4px;font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
.tag-blue{background:#E7F3FF;color:#1877F2}
.tag-red{background:#FFE5E5;color:#FA383E}
.tag-green{background:#E5F5E0;color:#42B72A}
h3{font-size:1.1em;font-weight:700}
.subtitle{color:var(--secondary);font-size:0.85em;margin-top:2px}

.profile{text-align:center;padding:0}
.cover{height:200px;background:linear-gradient(135deg,#1877F2,#8B5CF6,#EC4899);border-radius:var(--radius) var(--radius) 0 0;position:relative}
.cover-actions{position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:5}
.cover-btn{background:rgba(255,255,255,0.95);border:none;padding:5px 12px;border-radius:6px;font-size:0.73em;font-weight:600;display:flex;align-items:center;gap:4px;color:var(--text);backdrop-filter:blur(4px)}
.cover-btn.red{background:rgba(250,56,62,0.95);color:#fff}
.avatar-wrap{margin-top:-64px;position:relative;display:inline-block}
.avatar{width:128px;height:128px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.verified-icon{position:absolute;bottom:6px;right:6px;background:var(--primary);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.verified-icon svg{width:13px;height:13px;fill:#fff}
.name{font-size:1.5em;font-weight:800;margin-top:6px}
.username{color:var(--secondary);font-size:0.9em}
.bio{color:var(--secondary);font-size:0.8em;margin-bottom:8px}
.stats{display:flex;justify-content:center;gap:36px;padding:12px 0;margin:0 16px;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stat{text-align:center}
.stat-num{font-size:1.1em;font-weight:700}
.stat-label{font-size:0.7em;color:var(--secondary)}
.divider{height:4px;background:var(--bg)}

.actions{padding:0 16px 14px}
.actions-row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.actions-row:last-child{margin-bottom:0}
.btn{font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:0.15s;font-size:0.85em}
.btn-lg{padding:10px 20px;border-radius:6px;font-size:0.9em;flex:1;min-width:100px}
.btn-xs{padding:4px 10px;border-radius:4px;font-size:0.72em}
.btn-blue{background:var(--primary);color:#fff}.btn-blue:hover{background:var(--primary-hover)}
.btn-outline{border:1.5px solid var(--primary);color:var(--primary);background:transparent}.btn-outline:hover{background:#E7F3FF}
.btn-red{background:var(--red);color:#fff}.btn-red:hover{background:#E03131}
.btn-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.badge-official{display:inline-flex;align-items:center;gap:4px;background:#E7F3FF;color:var(--primary);padding:6px 14px;border-radius:20px;font-size:0.8em;font-weight:700}

.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:600px){.grid2{grid-template-columns:1fr}}
.verified-item{display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg);border-radius:6px;border:1px solid var(--border)}
.verified-item .v-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0}
.verified-item .v-info{flex:1;min-width:0}
.verified-item .v-info h4{font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:4px}
.verified-item .v-info h4 img{width:15px;height:15px}
.verified-item .v-handle{font-size:0.78em;color:var(--secondary)}
.verified-item .v-detail{font-size:0.75em;color:var(--text);margin-top:2px}

.fake-card{border:1px solid #FECACA;border-radius:6px;overflow:hidden}
.fake-img-wrap{position:relative;text-align:center;padding:8px;background:#FAFAFA}
.fake-img{width:100%;border-radius:4px}
.fake-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;animation:bounce 2s infinite}
@keyframes bounce{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-12px)}}
.fake-body{padding:10px}
.fake-body h4{font-weight:600;font-size:0.9em}
.fake-body .platform{color:#F59E0B;font-weight:600;font-size:0.75em;margin:2px 0}
.fake-body p{font-size:0.78em;color:var(--secondary);margin-bottom:6px}

.proof-single{text-align:center;padding:20px}
.proof-single img{max-width:100%;border-radius:6px;border:1px solid var(--border)}
.proof-label{font-weight:600;font-size:0.9em;margin-top:8px;color:var(--primary)}

.music-section{padding:14px}
.music-header{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:6px;margin-bottom:10px}
.music-cover-wrap{width:52px;height:52px;border-radius:6px;overflow:hidden;flex-shrink:0;position:relative}
.music-cover-static{width:100%;height:100%;object-fit:cover}
.music-cover-playing{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:none}
.music-info{flex:1;min-width:0}
.music-title{font-weight:600;font-size:0.9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.music-artist{font-size:0.78em;color:var(--secondary)}
.slider{width:100%;height:4px;background:var(--border);border-radius:2px;cursor:pointer;margin:8px 0;position:relative}
.slider-fill{height:100%;background:var(--primary);border-radius:2px;width:0;pointer-events:none}
.time-row{display:flex;justify-content:space-between;font-size:0.7em;color:var(--secondary);margin-bottom:8px}
.music-ctrls{display:flex;align-items:center;justify-content:center;gap:14px}
.m-btn{width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;font-size:0.9em;display:flex;align-items:center;justify-content:center}
.m-btn-nav{background:var(--hover);color:var(--text)}.m-btn-nav:hover{background:var(--border)}
.m-btn-play{background:var(--primary);color:#fff;width:46px;height:46px;font-size:1.2em}.m-btn-play:hover{background:var(--primary-hover)}
.music-list{max-height:200px;overflow-y:auto;border-top:1px solid var(--border);margin-top:10px;padding-top:8px}
.song-item{display:flex;align-items:center;gap:10px;padding:9px 10px;cursor:pointer;border-radius:6px;transition:0.1s}
.song-item:hover{background:var(--hover)}
.song-item.active{background:#E7F3FF}
.song-item.active .song-num{color:var(--primary)}
.song-item.active .song-title{color:var(--primary);font-weight:600}
.song-num{font-weight:700;color:var(--secondary);min-width:22px;font-size:0.82em}
.song-thumb-wrap{width:30px;height:30px;border-radius:4px;overflow:hidden;flex-shrink:0;position:relative}
.song-thumb-static{width:100%;height:100%;object-fit:cover}
.song-thumb-playing{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.song-info{flex:1;min-width:0}
.song-title{font-weight:500;font-size:0.83em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.song-artist{font-size:0.72em;color:var(--secondary)}
.song-indicator{margin-left:auto;flex-shrink:0}
.eq{display:flex;align-items:flex-end;gap:2px;height:14px}
.eq span{width:3px;background:var(--primary);border-radius:1px;animation:eqAnim 0.8s ease-in-out infinite}
.eq span:nth-child(1){animation-delay:0s}
.eq span:nth-child(2){animation-delay:0.15s}
.eq span:nth-child(3){animation-delay:0.3s}
@keyframes eqAnim{0%,100%{height:5px}50%{height:12px}}

.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}
.chat-toggle{width:48px;height:48px;border-radius:50%;background:var(--primary);color:#fff;border:none;font-size:1.2em;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:0.15s}
.chat-toggle:hover{background:var(--primary-hover);transform:scale(1.05)}
.chat-panel{display:none;position:fixed;bottom:78px;right:20px;width:338px;height:450px;background:#fff;border-radius:8px;box-shadow:0 5px 25px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:9999}
.chat-panel.open{display:flex}
@media(max-width:480px){.chat-panel{width:100%;right:0;bottom:0;border-radius:0;height:60vh;top:auto}}
.chat-head{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:0.9em;flex-shrink:0}
.chat-head button{background:none;border:none;font-size:1.2em;color:var(--secondary);padding:4px 8px;border-radius:50%}
.chat-head button:hover{background:var(--hover)}
.chat-body{flex:1;overflow-y:auto;padding:10px;background:var(--bg)}
.chat-login{text-align:center;padding:20px;background:#fff;border-radius:6px}
.chat-login h4{font-weight:600;margin-bottom:10px}
.chat-input-field{width:100%;padding:10px;margin-bottom:8px;border:1px solid var(--border);border-radius:6px;font-size:0.88em;outline:none;background:var(--bg)}
.chat-input-field:focus{border-color:var(--primary);background:#fff}
.chat-login .btn{width:100%;padding:10px}
.chat-input-area{padding:10px;border-top:1px solid var(--border);display:none;background:#fff;flex-shrink:0}
.chat-input-row{display:flex;align-items:center;gap:6px}
.chat-input-row input{flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:20px;font-size:0.88em;outline:none;background:var(--bg)}
.chat-input-row input:focus{border-color:var(--primary);background:#fff}
.chat-input-row button{background:var(--primary);color:#fff;border:none;width:34px;height:34px;border-radius:50%;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.msg{max-width:78%;padding:7px 10px;border-radius:18px;margin-bottom:4px;font-size:0.83em;word-wrap:break-word}
.msg.user{background:var(--primary);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:#E4E6EB;color:var(--text);margin-right:auto;border-bottom-left-radius:4px}
.msg .time{font-size:0.65em;opacity:0.7;margin-top:2px;text-align:right}
</style>
</head>
<body>

<header class="topbar">
<div class="topbar-left">
<img src="${ASSETS.avatar}" class="topbar-logo" onerror="this.style.display='none'">
<span class="topbar-name">Baiilla Maach</span>
</div>
<a href="/messenger" class="topbar-btn">💬 Support</a>
</header>

<div class="container">

<div class="card profile">
<div class="cover">
<div class="cover-actions">
<button class="cover-btn">✅ Official</button>
<button class="cover-btn red">🚨 Report Fake</button>
</div>
</div>
<div class="avatar-wrap">
<img src="${ASSETS.avatar}" class="avatar" onerror="this.style.display='none'">
<div class="verified-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
</div>
<h2 class="name">Hammad Bin Amir</h2>
<div class="username">@baiillamaach_official</div>
<div class="bio">Official Entertainment Profile · Verified Creator</div>
<div class="stats">
<div class="stat"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div>
<div class="stat"><div class="stat-num">0</div><div class="stat-label">Following</div></div>
<div class="stat"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div>
</div>
<div class="divider"></div>
<div class="actions">
<div class="actions-row">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue btn-lg"><img src="${ASSETS.logoTikTok}" width="18"> TikTok</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-outline btn-lg"><img src="${ASSETS.logoFB}" width="18"> Facebook</a>
</div>
<div class="actions-row" style="justify-content:center">
<span class="badge-official"><svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Official Creator</span>
</div>
</div>
</div>

<div class="card"><div class="card-head">
<span class="tag tag-green">OFFICIAL</span><h3>Verified Accounts</h3><p class="subtitle">The only authentic accounts</p></div>
<div class="card-body"><div class="grid2">
<div class="verified-item"><img src="${ASSETS.avatar}" class="v-avatar"><div class="v-info">
<h4>TikTok <img src="${ASSETS.blueTikTok}"></h4>
<div class="v-handle">@baiillamaach_official</div>
<div class="v-detail">✓ Active · <strong>7K</strong> Followers · <strong>190K</strong> Likes</div>
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue btn-xs" style="margin-top:5px">Follow</a></div></div>
<div class="verified-item"><img src="${ASSETS.fbAvatar}" class="v-avatar"><div class="v-info">
<h4>Facebook <img src="${ASSETS.blueFB}"></h4>
<div class="v-handle">@BaiillaMaachOfficial</div>
<div class="v-detail">✓ Active · Official Page</div>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-outline btn-xs" style="margin-top:5px">Follow</a></div></div>
</div></div></div>

<div class="card"><div class="card-head">
<span class="tag tag-red">WARNING</span><h3>Fake Accounts Detected</h3><p class="subtitle">Report these impersonators</p></div>
<div class="card-body"><div class="grid2">
<div class="fake-card"><div class="fake-img-wrap">
<img src="${ASSETS.baillamachFake}" class="fake-img">
<img src="${ASSETS.fakeDetect}" class="fake-overlay"></div>
<div class="fake-body"><h4>@baiilla_mach</h4><div class="platform">📍 TikTok</div>
<p>Copies official content</p>
<a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-red btn-xs">🚨 Report</a></div></div>
<div class="fake-card"><div class="fake-img-wrap">
<img src="${ASSETS.hammadFake}" class="fake-img">
<img src="${ASSETS.fakeDetect}" class="fake-overlay"></div>
<div class="fake-body"><h4>@hammad_fams0</h4><div class="platform">📍 TikTok</div>
<p>Impersonating account</p>
<a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-red btn-xs">🚨 Report</a></div></div>
</div></div></div>

<div class="card"><div class="card-head">
<span class="tag tag-blue">VERIFIED</span><h3>Real ID Verified</h3></div>
<div class="proof-single"><img src="${ASSETS.realId}"><div class="proof-label">✅ Official ID Verified</div></div></div>

${voiceHTML}

${songs.length > 0 ? `<div class="card"><div class="card-head">
<span class="tag tag-blue">MUSIC</span><h3>Cover Songs</h3></div>
<div class="music-section">
<div class="music-header"><div class="music-cover-wrap">
<img src="${ASSETS.playGif}" class="music-cover-static" id="mainCoverStatic">
<img src="${ASSETS.playGif}" class="music-cover-playing" id="mainCoverPlaying"></div>
<div class="music-info"><div class="music-title" id="mTitle">Select a song</div><div class="music-artist">Baiilla Maach</div></div></div>
<div class="slider" onclick="seekMusic(event)"><div class="slider-fill" id="mSliderFill"></div></div>
<div class="time-row"><span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span></div>
<div class="music-ctrls">
<button class="m-btn m-btn-nav" onclick="prevMusic()">⏮</button>
<button class="m-btn m-btn-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
<button class="m-btn m-btn-nav" onclick="nextMusic()">⏭</button></div>
<div class="music-list">${songsListHTML}</div>
</div></div>` : ''}

</div>

<div class="chat-widget"><button class="chat-toggle" onclick="toggleChat()">💬</button></div>
<div class="chat-panel" id="chatPanel">
<div class="chat-head">💬 Chat Support<button onclick="toggleChat()">✕</button></div>
<div class="chat-body" id="chatBody">
<div class="chat-login" id="chatLoginForm">
<h4>Start Chat</h4>
<input type="text" class="chat-input-field" id="chatNameInput" placeholder="Your Name">
<input type="text" class="chat-input-field" id="chatEmailInput" placeholder="Email or Phone">
<button class="btn btn-blue" onclick="startChatSession()">Start Chatting</button></div></div>
<div class="chat-input-area" id="chatInputArea">
<div class="chat-input-row"><input type="text" id="chatMsgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
<button onclick="sendChatMsg()">➤</button></div></div></div>

${WELCOME_VOICE ? '<audio id="welcomeAudio" src="'+ASSETS.realVoice+'" preload="auto"></audio>' : ''}
${MANUAL_VOICE ? '<audio id="manualAudio" src="'+ASSETS.manualVoice+'" preload="auto"></audio>' : ''}
<audio id="musicAudio" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
var welcomeAudio=document.getElementById("welcomeAudio");
var manualAudio=document.getElementById("manualAudio");
var musicAudio=document.getElementById("musicAudio");
var tracks=${songsJSON};
var currentTrack=-1,musicPlaying=false;

function stopAllAudio(){if(welcomeAudio){welcomeAudio.pause();welcomeAudio.currentTime=0}if(manualAudio){manualAudio.pause();manualAudio.currentTime=0}if(musicAudio){musicAudio.pause()}setPlaying(false)}
function playWelcomeVoice(){if(!welcomeAudio)return;stopAllAudio();welcomeAudio.play()}
function playManualVoice(){if(!manualAudio)return;stopAllAudio();manualAudio.play()}

function setPlaying(p){musicPlaying=p;var b=document.getElementById("mPlayBtn");if(b)b.textContent=p?"⏸":"▶";var s=document.getElementById("mainCoverStatic");var d=document.getElementById("mainCoverPlaying");if(s&&d){s.style.display=p?"none":"block";d.style.display=p?"block":"none"}updatePlaylistUI()}

function updatePlaylistUI(){
var items=document.querySelectorAll(".song-item");
for(var j=0;j<items.length;j++){
var item=items[j],st=document.getElementById("thumb-static-"+j),pt=document.getElementById("thumb-playing-"+j),ind=document.getElementById("indicator-"+j);
if(j===currentTrack){item.classList.add("active");if(musicPlaying){if(st)st.style.display="none";if(pt)pt.style.display="block";if(ind)ind.style.display="block"}else{if(st)st.style.display="block";if(pt)pt.style.display="none";if(ind)ind.style.display="none"}}
else{item.classList.remove("active");if(st)st.style.display="block";if(pt)pt.style.display="none";if(ind)ind.style.display="none"}}}

function playMusic(i){if(!tracks.length||i<0||i>=tracks.length)return;stopAllAudio();currentTrack=i;musicAudio.src=tracks[i].url;document.getElementById("mTitle").textContent=tracks[i].title;musicAudio.play().then(function(){setPlaying(true)}).catch(function(){setPlaying(false)})}
function toggleMusic(){if(musicPlaying){musicAudio.pause();setPlaying(false)}else{if(!musicAudio.src&&tracks.length){currentTrack=0;musicAudio.src=tracks[0].url;document.getElementById("mTitle").textContent=tracks[0].title}musicAudio.play().then(function(){setPlaying(true)}).catch(function(){})}}
function prevMusic(){if(currentTrack<0)currentTrack=0;playMusic((currentTrack-1+tracks.length)%tracks.length)}
function nextMusic(){if(currentTrack<0)currentTrack=0;playMusic((currentTrack+1)%tracks.length)}
function seekMusic(e){if(!musicAudio.duration)return;var r=e.currentTarget.getBoundingClientRect();musicAudio.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*musicAudio.duration}
musicAudio.addEventListener("timeupdate",function(){if(musicAudio.duration){document.getElementById("mSliderFill").style.width=(musicAudio.currentTime/musicAudio.duration)*100+"%";document.getElementById("mCurrentTime").textContent=fmt(musicAudio.currentTime);document.getElementById("mDuration").textContent=fmt(musicAudio.duration)}});
musicAudio.addEventListener("ended",nextMusic);
function fmt(s){if(isNaN(s))return"0:00";var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+String(sec).padStart(2,"0")}
if(tracks.length>0)document.getElementById("mTitle").textContent=tracks[0].title;
if(welcomeAudio)setTimeout(function(){welcomeAudio.play()},1500);

var socket=io({transports:["websocket","polling"]}),chatUser=null;
function toggleChat(){var p=document.getElementById("chatPanel");p.classList.toggle("open");if(p.classList.contains("open")&&chatUser)loadChatMsgs()}
function startChatSession(){var n=document.getElementById("chatNameInput").value.trim(),e=document.getElementById("chatEmailInput").value.trim();if(!n||!e)return;chatUser={name:n,email:e};socket.emit("register",{name:n,email:e});document.getElementById("chatLoginForm").style.display="none";document.getElementById("chatInputArea").style.display="block";loadChatMsgs()}
async function loadChatMsgs(){if(!chatUser)return;try{var r=await fetch("/api/msgs/"+encodeURIComponent(chatUser.email)),ms=await r.json(),b=document.getElementById("chatBody");b.innerHTML="";if(!ms.length)b.innerHTML='<div style="text-align:center;padding:20px;color:#65676B">No messages yet</div>';else ms.forEach(function(m){addMsg(m,b)});b.scrollTop=b.scrollHeight}catch(e){}}
function addMsg(m,b){var cls=m.sender===chatUser.email?"user":"admin",t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});b.innerHTML+='<div class="msg '+cls+'">'+m.message+'<div class="time">'+t+'</div></div>'}
function sendChatMsg(){var i=document.getElementById("chatMsgInput"),m=i.value.trim();if(!m||!chatUser)return;socket.emit("sendMsg",{sender:chatUser.email,receiver:"admin",message:m,type:"text"});i.value="";i.focus()}
socket.on("newMsg",function(m){if(chatUser&&(m.sender===chatUser.email||m.receiver===chatUser.email)){var b=document.getElementById("chatBody");addMsg(m,b);b.scrollTop=b.scrollHeight}});
</script>
</body>
</html>`;

  res.send(html);
});

app.get('/api/msgs/:email', (req, res) => {
  try {
    const msgs = db.prepare(`SELECT * FROM messages WHERE (sender = ? AND receiver = 'admin') OR (sender = 'admin' AND receiver = ?) ORDER BY timestamp ASC`).all(req.params.email, req.params.email);
    res.json(msgs);
  } catch (err) { res.json([]); }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/users', (req, res) => {
  try {
    const users = db.prepare(`SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC`).all();
    users.forEach(u => { const c = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0`).get(u.email); u.unreadCount = c.count; });
    res.json(users);
  } catch (err) { res.json([]); }
});

app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Admin Messenger</title>
<style>
:root{--bg:#F0F2F5;--white:#FFFFFF;--text:#1C1E21;--secondary:#65676B;--primary:#1877F2;--primary-hover:#166FE5;--green:#42B72A;--red:#FA383E;--border:#E4E6EB;--hover:#F2F2F2;--shadow:0 1px 2px rgba(0,0,0,0.1);--radius:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);height:100vh;overflow:hidden;color:var(--text);font-size:15px}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.login-card{background:#fff;padding:28px;border-radius:12px;width:100%;max-width:380px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.2)}
.login-card h2{font-weight:700;margin-bottom:4px;font-size:1.2em}
.login-card .sub{color:var(--secondary);font-size:0.85em;margin-bottom:18px}
.login-card input{width:100%;padding:11px;margin-bottom:10px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.9em;outline:none;-webkit-appearance:none}
.login-card input:focus{border-color:var(--primary)}
.login-card button{width:100%;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius);font-weight:600;cursor:pointer;font-size:0.95em}
.login-card button:disabled{opacity:0.6}
.error{color:var(--red);font-size:0.8em;margin-top:6px;display:none}
.app{display:none;height:100vh}
.layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:var(--shadow)}
@media(max-width:767px){.layout{flex-direction:column}}
.sidebar{width:340px;border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}
@media(max-width:767px){.sidebar{width:100%;max-height:40vh;border-right:none;border-bottom:1px solid var(--border)}}
.sidebar-head{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.sidebar-head h2{font-size:1em;font-weight:700}
.sidebar-head button{background:none;border:none;color:var(--primary);font-weight:600;cursor:pointer;font-size:0.85em;padding:5px 10px;border-radius:4px}
.sidebar-head button:hover{background:var(--hover)}
.search-box{padding:8px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
.search-box input{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:20px;font-size:0.85em;outline:none;-webkit-appearance:none;background:var(--bg)}
.search-box input:focus{border-color:var(--primary);background:#fff}
.user-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.user-item{padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid var(--border);-webkit-tap-highlight-color:transparent}
.user-item:hover{background:var(--hover)}
.user-item.active{background:#E7F3FF}
.user-avatar{width:38px;height:38px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;font-size:1em}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.85em}
.user-info .email{font-size:0.75em;color:var(--secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unread{background:var(--primary);color:#fff;font-size:0.68em;padding:2px 7px;border-radius:10px;font-weight:600;flex-shrink:0}
.chat-area{flex:1;display:flex;flex-direction:column;min-height:0}
@media(max-width:767px){.chat-area{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;display:none}.chat-area.active{display:flex}}
.chat-head{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--bg);flex-shrink:0}
.back-btn{display:none;background:none;border:none;font-size:1.2em;cursor:pointer;padding:4px 8px;color:var(--primary)}
@media(max-width:767px){.back-btn{display:block}}
.chat-avatar{width:34px;height:34px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.85em;flex-shrink:0}
.chat-name{font-weight:600;font-size:0.9em}
.chat-status{font-size:0.73em}
.chat-status.online{color:var(--green)}
.chat-msgs{flex:1;overflow-y:auto;padding:14px;background:var(--bg);-webkit-overflow-scrolling:touch}
.msg{max-width:70%;padding:8px 11px;border-radius:18px;margin-bottom:5px;font-size:0.85em;word-wrap:break-word}
.msg.sent{background:var(--primary);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.received{background:#fff;color:var(--text);border-bottom-left-radius:4px;border:1px solid var(--border)}
.msg .time{font-size:0.65em;opacity:0.7;margin-top:2px;text-align:right}
.chat-input{padding:10px 14px;border-top:1px solid var(--border);display:none;background:#fff;flex-shrink:0}
.chat-input-row{display:flex;align-items:center;gap:8px}
.chat-input-row input{flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:20px;font-size:0.9em;outline:none;-webkit-appearance:none;background:var(--bg)}
.chat-input-row input:focus{border-color:var(--primary);background:#fff}
.chat-input-row button{background:var(--primary);color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0;font-size:1em;display:flex;align-items:center;justify-content:center}
.empty-state{text-align:center;color:var(--secondary);padding:50px 20px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1C1E21;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.8em;z-index:9999;opacity:0;transition:opacity 0.3s}
.toast.show{opacity:1}
</style></head><body>

<div class="login-overlay" id="loginOverlay"><div class="login-card">
<h2>🔐 Admin Messenger</h2><p class="sub">Support Panel</p>
<input type="text" id="loginEmail" placeholder="Username" value="admin" autocomplete="username">
<input type="password" id="loginPassword" placeholder="Password" value="admin123" autocomplete="current-password">
<button id="loginBtn" onclick="doLogin()">Sign In</button>
<div class="error" id="loginError"></div></div></div>

<div class="app" id="app"><div class="layout">
<div class="sidebar" id="sidebar"><div class="sidebar-head"><h2>💬 Conversations</h2><button onclick="doLogout()">Logout</button></div>
<div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div>
<div class="user-list" id="userList"><div class="empty-state"><p>Loading...</p></div></div></div>

<div class="chat-area" id="chatArea"><div class="chat-head"><button class="back-btn" onclick="goBack()">←</button>
<div class="chat-avatar" id="chatAvatar">?</div>
<div><div class="chat-name" id="chatName">Select user</div><div class="chat-status offline" id="chatStatus">● Offline</div></div></div>
<div class="chat-msgs" id="chatMessages"><div class="empty-state"><h3>No conversation</h3><p>Select a user</p></div></div>
<div class="chat-input" id="chatInputArea"><div class="chat-input-row">
<input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()">➤</button></div></div></div>
</div></div>

<div class="toast" id="toast"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io({transports:["websocket","polling"]}),currentUser=null,allUsers=[],isLoggedIn=false,interval=null;
function toast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2000)}
socket.on("connect",function(){if(isLoggedIn)loadUsers()});
socket.on("newMsg",function(m){if(currentUser&&((m.sender===currentUser.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===currentUser.email)))appendMessage(m);loadUsers()});
socket.on("userStatus",function(d){if(currentUser&&currentUser.email===d.email){var s=document.getElementById("chatStatus");s.textContent=d.online?"● Online":"● Offline";s.className="chat-status "+(d.online?"online":"offline")}loadUsers()});
async function doLogin(){var e=document.getElementById("loginEmail").value.trim(),p=document.getElementById("loginPassword").value.trim(),err=document.getElementById("loginError"),btn=document.getElementById("loginBtn");err.style.display="none";if(!e||!p){err.textContent="Fill all fields";err.style.display="block";return}btn.disabled=true;btn.textContent="Signing...";
try{var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});if(r.ok){isLoggedIn=true;localStorage.setItem("admin",JSON.stringify({email:e,password:p}));document.getElementById("loginOverlay").style.display="none";document.getElementById("app").style.display="block";socket.emit("register",{name:"Admin",email:"admin"});loadUsers();interval=setInterval(loadUsers,8000)}else{err.textContent="❌ Invalid";err.style.display="block"}}catch(ex){err.textContent="❌ Network error";err.style.display="block"}btn.disabled=false;btn.textContent="Sign In"}
async function loadUsers(){if(!isLoggedIn)return;try{var r=await fetch("/api/admin/users");allUsers=await r.json();renderUsers()}catch(e){}}
function renderUsers(){var s=document.getElementById("searchInput").value.toLowerCase(),f=allUsers.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)}),h="";f.forEach(function(u){var a=currentUser&&currentUser.email===u.email;h+='<div class="user-item'+(a?" active":"")+'" onclick="selectUser(\\''+u.email+'\\')"><div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':"")+'</div>'});document.getElementById("userList").innerHTML=h||'<div class="empty-state"><p>No users</p></div>'}
function filterUsers(){renderUsers()}
async function selectUser(e){var u=allUsers.find(function(u){return u.email===e});if(!u)return;currentUser=u;document.getElementById("chatAvatar").textContent=u.name.charAt(0).toUpperCase();document.getElementById("chatName").textContent=u.name;document.getElementById("chatStatus").textContent=u.isOnline?"● Online":"● Offline";document.getElementById("chatStatus").className="chat-status "+(u.isOnline?"online":"offline");document.getElementById("chatInputArea").style.display="block";document.getElementById("chatArea").classList.add("active");if(window.innerWidth<768)document.getElementById("sidebar").style.display="none";
try{var r=await fetch("/api/msgs/"+encodeURIComponent(u.email)),ms=await r.json(),c=document.getElementById("chatMessages");c.innerHTML="";if(!ms.length)c.innerHTML='<div class="empty-state"><h3>No messages</h3></div>';else ms.forEach(function(m){addMsg(m,c)});c.scrollTop=99999}catch(e){}socket.emit("markRead",{user:u.email});renderUsers()}
function addMsg(m,c){var s=m.sender==="admin",t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});c.innerHTML+='<div class="msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>'}
function appendMessage(m){if(!currentUser)return;var c=document.getElementById("chatMessages");addMsg(m,c);c.scrollTop=99999}
function sendMessage(){if(!currentUser){toast("Select a user");return}var i=document.getElementById("msgInput"),m=i.value.trim();if(!m)return;socket.emit("sendMsg",{sender:"admin",receiver:currentUser.email,message:m,type:"text"});appendMessage({sender:"admin",receiver:currentUser.email,message:m,timestamp:new Date().toISOString()});i.value="";i.focus()}
function goBack(){document.getElementById("chatArea").classList.remove("active");document.getElementById("sidebar").style.display="flex";currentUser=null;document.getElementById("chatMessages").innerHTML='<div class="empty-state"><h3>No conversation</h3></div>';document.getElementById("chatInputArea").style.display="none";renderUsers()}
function doLogout(){if(interval)clearInterval(interval);localStorage.removeItem("admin");isLoggedIn=false;location.reload()}
var saved=localStorage.getItem("admin");if(saved){var d=JSON.parse(saved);document.getElementById("loginEmail").value=d.email;document.getElementById("loginPassword").value=d.password}
document.addEventListener("DOMContentLoaded",function(){document.getElementById("loginPassword").addEventListener("keypress",function(e){if(e.key==="Enter")doLogin()})});
window.addEventListener("resize",function(){if(window.innerWidth>=768&&currentUser)document.getElementById("sidebar").style.display="flex"});
</script></body></html>`);
});

io.on('connection', (socket) => {
  socket.on('register', (data) => {
    try {
      socket.userData = data;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
      if (!user) { const h = bcrypt.hashSync('default123', 10); db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(data.name, data.email, h); }
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
  socket.on('markRead', (data) => { try { db.prepare('UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = "admin" AND seen = 0').run(data.user); } catch (err) {} });
  socket.on('disconnect', () => {
    if (socket.userData) {
      try { db.prepare('UPDATE users SET isOnline = 0, lastSeen = datetime("now") WHERE email = ?').run(socket.userData.email); io.emit('userStatus', { email: socket.userData.email, online: false }); } catch (err) {}
    }
  });
});

server.listen(PORT, () => {
  console.log('Server: http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/messenger');
  console.log('Admin: admin / admin123');
});

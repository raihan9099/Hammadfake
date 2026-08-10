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

  let songsHTML = '';
  songs.forEach((s, i) => {
    songsHTML += `<div class="song-row" onclick="playTrack(${i})" id="song-${i}">
      <span class="song-idx">${String(i+1).padStart(2,'0')}</span>
      <div class="song-thumb-box">
        <img src="/assets/play.gif" class="song-thumb-static" id="st-${i}">
        <img src="/assets/play.gif" class="song-thumb-live" id="sl-${i}" style="display:none">
      </div>
      <div class="song-meta">
        <div class="song-name">${s.title}</div>
        <div class="song-by">Baiilla Maach</div>
      </div>
      <div class="song-viz" id="viz-${i}" style="display:none">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </div>
    </div>`;
  });

  const hasVoice = fs.existsSync('assets/realvoice.mp3');
  const hasManual = fs.existsSync('assets/manualvoice_alert.mp3');

  let voiceBlock = '';
  if (hasVoice || hasManual) {
    voiceBlock = `<div class="card"><div class="card-top">
      <span class="pill pill-blue">VOICE</span><h3>Voice Verification</h3></div>
      <div class="card-inner">
      ${hasVoice ? '<button class="btn btn-blue" onclick="playRealVoice()"><img src="/assets/microphone-in-hand.gif" width="18"> Real Voice</button>' : ''}
      ${hasManual ? '<button class="btn btn-red" onclick="playFakeAlert()"><img src="/assets/report_button.png" width="16"> Fake Alert</button>' : ''}
      </div></div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Baiilla Maach Official</title>
<style>
:root{
--bg:#F0F2F5;--white:#FFFFFF;--text:#1C1E21;--muted:#65676B;
--blue:#1877F2;--blue2:#166FE5;--green:#42B72A;--red:#FA383E;
--line:#E4E6EB;--hover:#F2F2F2;--sh:0 1px 2px rgba(0,0,0,0.1);--r:8px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
a{text-decoration:none}img{display:block;max-width:100%}
button,input{font-family:inherit}

.nav{position:sticky;top:0;z-index:100;background:#fff;box-shadow:var(--sh);padding:0 16px;height:56px;display:flex;align-items:center;justify-content:space-between}
.nav-l{display:flex;align-items:center;gap:10px}
.nav-avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--line)}
.nav-title{font-weight:700;font-size:1.2em;color:var(--blue)}
.nav-btn{background:var(--blue);color:#fff;padding:8px 18px;border-radius:20px;font-weight:600;font-size:0.9em;border:none;cursor:pointer}

.main{max-width:680px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:var(--r);box-shadow:var(--sh);margin-bottom:12px;overflow:hidden}
.card-top{padding:16px;border-bottom:1px solid var(--line)}
.card-inner{padding:16px}
.pill{display:inline-block;padding:3px 10px;border-radius:4px;font-size:0.68em;font-weight:700;text-transform:uppercase;margin-bottom:6px}
.pill-blue{background:#E7F3FF;color:#1877F2}
.pill-red{background:#FFE5E5;color:#FA383E}
.pill-green{background:#E5F5E0;color:#42B72A}
h3{font-size:1.1em;font-weight:700}

.profile-card{text-align:center;padding:0}
.cover-img{height:200px;background:linear-gradient(135deg,#1877F2,#8B5CF6,#EC4899);border-radius:8px 8px 0 0;position:relative}
.cover-acts{position:absolute;top:10px;right:10px;display:flex;gap:6px}
.c-btn{background:rgba(255,255,255,0.95);border:none;padding:5px 10px;border-radius:5px;font-size:0.7em;font-weight:600;cursor:pointer}
.c-btn.danger{background:rgba(250,56,62,0.95);color:#fff}
.avatar-box{margin-top:-64px;position:relative;display:inline-block}
.avatar-img{width:128px;height:128px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.badge-check{position:absolute;bottom:6px;right:6px;background:var(--blue);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.badge-check svg{width:13px;height:13px;fill:#fff}
.p-name{font-size:1.5em;font-weight:800;margin-top:6px}
.p-user{color:var(--muted);font-size:0.9em}
.p-bio{color:var(--muted);font-size:0.8em;margin-bottom:8px}
.stats-row{display:flex;justify-content:center;gap:36px;padding:12px 0;margin:0 16px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.stat-box{text-align:center}
.stat-n{font-size:1.1em;font-weight:700}
.stat-l{font-size:0.7em;color:var(--muted)}
.spacer{height:4px;background:var(--bg)}

.act-wrap{padding:0 16px 14px}
.act-line{display:flex;gap:8px;margin-bottom:8px}
.btn{font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:0.15s;font-size:0.85em}
.btn-lg{padding:10px 20px;border-radius:6px;font-size:0.9em;flex:1}
.btn-xs{padding:4px 10px;border-radius:4px;font-size:0.72em}
.btn-blue{background:var(--blue);color:#fff}
.btn-line{border:1.5px solid var(--blue);color:var(--blue);background:transparent}
.btn-red{background:var(--red);color:#fff}
.tag-official{display:inline-flex;align-items:center;gap:4px;background:#E7F3FF;color:var(--blue);padding:6px 14px;border-radius:20px;font-size:0.8em;font-weight:700}

.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:600px){.g2{grid-template-columns:1fr}}
.v-item{display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg);border-radius:6px;border:1px solid var(--line)}
.v-ava{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0}
.v-info h4{font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:4px}
.v-info h4 img{width:15px;height:15px}
.v-h{font-size:0.78em;color:var(--muted)}
.v-d{font-size:0.75em;color:var(--text);margin-top:2px}

.f-card{border:1px solid #FECACA;border-radius:6px;overflow:hidden}
.f-img-wrap{position:relative;text-align:center;padding:8px;background:#FAFAFA}
.f-img{width:100%;border-radius:4px}
.f-badge{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;animation:bob 2s infinite}
@keyframes bob{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-12px)}}
.f-body{padding:10px}
.f-body h4{font-weight:600;font-size:0.9em}
.f-body .plat{color:#F59E0B;font-weight:600;font-size:0.75em;margin:2px 0}
.f-body p{font-size:0.78em;color:var(--muted);margin-bottom:6px}

.proof-box{text-align:center;padding:20px}
.proof-box img{max-width:100%;border-radius:6px;border:1px solid var(--line)}
.proof-label{font-weight:600;font-size:0.9em;margin-top:8px;color:var(--blue)}

.music-wrap{padding:14px}
.music-top{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:6px;margin-bottom:10px}
.m-cover{width:52px;height:52px;border-radius:6px;overflow:hidden;flex-shrink:0;position:relative}
.m-cover img{width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0}
.m-cover .playing{display:none}
.m-info{flex:1;min-width:0}
.m-title{font-weight:600;font-size:0.9em}
.m-artist{font-size:0.78em;color:var(--muted)}
.seek-bar{width:100%;height:4px;background:var(--line);border-radius:2px;cursor:pointer;margin:8px 0}
.seek-fill{height:100%;background:var(--blue);border-radius:2px;width:0}
.t-row{display:flex;justify-content:space-between;font-size:0.7em;color:var(--muted);margin-bottom:8px}
.ctrl-row{display:flex;align-items:center;justify-content:center;gap:14px}
.ctrl-btn{width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;font-size:0.9em;display:flex;align-items:center;justify-content:center;background:var(--hover);color:var(--text)}
.ctrl-play{background:var(--blue);color:#fff;width:46px;height:46px;font-size:1.2em}
.song-list{max-height:200px;overflow-y:auto;border-top:1px solid var(--line);margin-top:10px;padding-top:8px}
.song-row{display:flex;align-items:center;gap:10px;padding:9px 10px;cursor:pointer;border-radius:6px}
.song-row:hover{background:var(--hover)}
.song-row.active{background:#E7F3FF}
.song-row.active .song-name{color:var(--blue);font-weight:600}
.song-idx{font-weight:700;color:var(--muted);min-width:22px;font-size:0.82em}
.song-thumb-box{width:30px;height:30px;border-radius:4px;overflow:hidden;flex-shrink:0;position:relative}
.song-thumb-box img{width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0}
.song-meta{flex:1;min-width:0}
.song-name{font-weight:500;font-size:0.83em}
.song-by{font-size:0.72em;color:var(--muted)}
.song-viz{margin-left:auto;display:flex;align-items:flex-end;gap:2px;height:14px}
.song-viz .bar{width:3px;background:var(--blue);border-radius:1px;animation:viz 0.8s ease-in-out infinite}
.song-viz .bar:nth-child(1){animation-delay:0s}
.song-viz .bar:nth-child(2){animation-delay:0.15s}
.song-viz .bar:nth-child(3){animation-delay:0.3s}
@keyframes viz{0%,100%{height:5px}50%{height:12px}}

.chat-fab{position:fixed;bottom:20px;right:20px;z-index:9999}
.chat-fab button{width:48px;height:48px;border-radius:50%;background:var(--blue);color:#fff;border:none;font-size:1.2em;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.2)}
.chat-box{display:none;position:fixed;bottom:78px;right:20px;width:338px;height:450px;background:#fff;border-radius:8px;box-shadow:0 5px 25px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:9999}
.chat-box.open{display:flex}
@media(max-width:480px){.chat-box{width:100%;right:0;bottom:0;border-radius:0;height:60vh}}
.chat-top{padding:10px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:0.9em}
.chat-top button{background:none;border:none;font-size:1.2em;color:var(--muted);cursor:pointer}
.chat-msgs{flex:1;overflow-y:auto;padding:10px;background:var(--bg)}
.chat-form{padding:20px;text-align:center;background:#fff;border-radius:6px}
.chat-form input{width:100%;padding:10px;margin-bottom:8px;border:1px solid var(--line);border-radius:6px;font-size:0.88em;outline:none;background:var(--bg)}
.chat-form .btn{width:100%;padding:10px}
.chat-send{padding:10px;border-top:1px solid var(--line);display:none;background:#fff}
.chat-send-row{display:flex;align-items:center;gap:6px}
.chat-send-row input{flex:1;padding:8px 12px;border:1px solid var(--line);border-radius:20px;font-size:0.88em;outline:none;background:var(--bg)}
.chat-send-row button{background:var(--blue);color:#fff;border:none;width:34px;height:34px;border-radius:50%;cursor:pointer}
.msg{max-width:78%;padding:7px 10px;border-radius:18px;margin-bottom:4px;font-size:0.83em;word-wrap:break-word}
.msg.me{background:var(--blue);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.you{background:#E4E6EB;color:var(--text);margin-right:auto;border-bottom-left-radius:4px}
.msg .t{font-size:0.65em;opacity:0.7;margin-top:2px;text-align:right}
</style>
</head>
<body>

<header class="nav">
<div class="nav-l">
<img src="/assets/celebrity_pfp.jpeg" class="nav-avatar" onerror="this.style.display='none'">
<span class="nav-title">Baiilla Maach</span>
</div>
<a href="/messenger" class="nav-btn">💬 Support</a>
</header>

<div class="main">

<div class="card profile-card">
<div class="cover-img">
<div class="cover-acts">
<button class="c-btn">✅ Official</button>
<button class="c-btn danger">🚨 Report Fake</button>
</div>
</div>
<div class="avatar-box">
<img src="/assets/celebrity_pfp.jpeg" class="avatar-img" onerror="this.style.display='none'">
<div class="badge-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
</div>
<h2 class="p-name">Hammad Bin Amir</h2>
<div class="p-user">@baiillamaach_official</div>
<div class="p-bio">Official Entertainment Profile · Verified Creator</div>
<div class="stats-row">
<div class="stat-box"><div class="stat-n">7K</div><div class="stat-l">Followers</div></div>
<div class="stat-box"><div class="stat-n">0</div><div class="stat-l">Following</div></div>
<div class="stat-box"><div class="stat-n">190K</div><div class="stat-l">Likes</div></div>
</div>
<div class="spacer"></div>
<div class="act-wrap">
<div class="act-line">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue btn-lg"><img src="/assets/logo_tiktok.png" width="18"> TikTok</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-line btn-lg"><img src="/assets/logo_fb.png" width="18"> Facebook</a>
</div>
<div class="act-line" style="justify-content:center">
<span class="tag-official"><svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Official Creator</span>
</div>
</div>
</div>

<div class="card"><div class="card-top">
<span class="pill pill-green">OFFICIAL</span><h3>Verified Accounts</h3></div>
<div class="card-inner"><div class="g2">
<div class="v-item"><img src="/assets/celebrity_pfp.jpeg" class="v-ava"><div class="v-info">
<h4>TikTok <img src="/assets/bluetick_tiktok.png"></h4>
<div class="v-h">@baiillamaach_official</div>
<div class="v-d">✓ Active · <strong>7K</strong> Followers · <strong>190K</strong> Likes</div>
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue btn-xs" style="margin-top:5px">Follow</a></div></div>
<div class="v-item"><img src="/assets/fb_profile.jpg" class="v-ava"><div class="v-info">
<h4>Facebook <img src="/assets/blue_tick_fb.png"></h4>
<div class="v-h">@BaiillaMaachOfficial</div>
<div class="v-d">✓ Active · Official Page</div>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-line btn-xs" style="margin-top:5px">Follow</a></div></div>
</div></div></div>

<div class="card"><div class="card-top">
<span class="pill pill-red">WARNING</span><h3>Fake Accounts Detected</h3></div>
<div class="card-inner"><div class="g2">
<div class="f-card"><div class="f-img-wrap">
<img src="/assets/baillamach_fake.png" class="f-img">
<img src="/assets/Fakedetect_updown.png" class="f-badge"></div>
<div class="f-body"><h4>@baiilla_mach</h4><div class="plat">📍 TikTok</div>
<p>Copies official content</p>
<a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-red btn-xs">🚨 Report</a></div></div>
<div class="f-card"><div class="f-img-wrap">
<img src="/assets/hammadfams.png" class="f-img">
<img src="/assets/Fakedetect_updown.png" class="f-badge"></div>
<div class="f-body"><h4>@hammad_fams0</h4><div class="plat">📍 TikTok</div>
<p>Impersonating account</p>
<a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-red btn-xs">🚨 Report</a></div></div>
</div></div></div>

<div class="card"><div class="card-top">
<span class="pill pill-blue">VERIFIED</span><h3>Real ID Verified</h3></div>
<div class="proof-box"><img src="/assets/real-id-ss.png"><div class="proof-label">✅ Official ID Verified</div></div></div>

${voiceBlock}

${songs.length > 0 ? `<div class="card"><div class="card-top">
<span class="pill pill-blue">MUSIC</span><h3>Cover Songs</h3></div>
<div class="music-wrap">
<div class="music-top"><div class="m-cover">
<img src="/assets/play.gif" class="static" id="mc-static">
<img src="/assets/play.gif" class="playing" id="mc-live"></div>
<div class="m-info"><div class="m-title" id="nowTitle">Select a song</div><div class="m-artist">Baiilla Maach</div></div></div>
<div class="seek-bar" onclick="seekTrack(event)"><div class="seek-fill" id="seekFill"></div></div>
<div class="t-row"><span id="nowTime">0:00</span><span id="totalTime">0:00</span></div>
<div class="ctrl-row">
<button class="ctrl-btn" onclick="prevTrack()">⏮</button>
<button class="ctrl-btn ctrl-play" id="playBtn" onclick="togglePlay()">▶</button>
<button class="ctrl-btn" onclick="nextTrack()">⏭</button></div>
<div class="song-list">${songsHTML}</div>
</div></div>` : ''}

</div>

<div class="chat-fab"><button onclick="toggleChat()">💬</button></div>
<div class="chat-box" id="chatBox">
<div class="chat-top">💬 Chat Support<button onclick="toggleChat()">✕</button></div>
<div class="chat-msgs" id="chatMsgs">
<div class="chat-form" id="chatForm">
<h4 style="margin-bottom:10px">Start Chat</h4>
<input type="text" id="cName" placeholder="Your Name">
<input type="text" id="cEmail" placeholder="Email or Phone">
<button class="btn btn-blue" onclick="startChat()">Start Chatting</button></div></div>
<div class="chat-send" id="chatSend">
<div class="chat-send-row"><input type="text" id="cMsg" placeholder="Type..." onkeypress="if(event.key==='Enter')sendMsg()">
<button onclick="sendMsg()">➤</button></div></div></div>

${hasVoice ? '<audio id="realVoice" src="/assets/realvoice.mp3" preload="auto"></audio>' : ''}
${hasManual ? '<audio id="fakeVoice" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>' : ''}
<audio id="player" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
var player=document.getElementById("player");
var tracks=${songsJSON};
var cur=-1,playing=false;

function stopAll(){var a=document.getElementById("realVoice"),b=document.getElementById("fakeVoice");if(a){a.pause();a.currentTime=0}if(b){b.pause();b.currentTime=0}if(player){player.pause()}setState(false)}
function playRealVoice(){var a=document.getElementById("realVoice");if(!a)return;stopAll();a.play()}
function playFakeAlert(){var a=document.getElementById("fakeVoice");if(!a)return;stopAll();a.play()}

function setState(p){playing=p;var b=document.getElementById("playBtn");if(b)b.textContent=p?"⏸":"▶";var s=document.getElementById("mc-static"),l=document.getElementById("mc-live");if(s&&l){s.style.display=p?"none":"block";l.style.display=p?"block":"none"}syncList()}

function syncList(){
var rows=document.querySelectorAll(".song-row");
for(var j=0;j<rows.length;j++){
var r=rows[j],st=document.getElementById("st-"+j),sl=document.getElementById("sl-"+j),v=document.getElementById("viz-"+j);
if(j===cur){r.classList.add("active");if(playing){if(st)st.style.display="none";if(sl)sl.style.display="block";if(v)v.style.display="flex"}else{if(st)st.style.display="block";if(sl)sl.style.display="none";if(v)v.style.display="none"}}
else{r.classList.remove("active");if(st)st.style.display="block";if(sl)sl.style.display="none";if(v)v.style.display="none"}}}

function playTrack(i){if(!tracks.length||i<0||i>=tracks.length)return;stopAll();cur=i;player.src=tracks[i].url;document.getElementById("nowTitle").textContent=tracks[i].title;player.play().then(function(){setState(true)}).catch(function(){setState(false)})}
function togglePlay(){if(playing){player.pause();setState(false)}else{if(!player.src&&tracks.length){cur=0;player.src=tracks[0].url;document.getElementById("nowTitle").textContent=tracks[0].title}player.play().then(function(){setState(true)}).catch(function(){})}}
function prevTrack(){if(cur<0)cur=0;playTrack((cur-1+tracks.length)%tracks.length)}
function nextTrack(){if(cur<0)cur=0;playTrack((cur+1)%tracks.length)}
function seekTrack(e){if(!player.duration)return;var r=e.currentTarget.getBoundingClientRect();player.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*player.duration}
player.addEventListener("timeupdate",function(){if(player.duration){document.getElementById("seekFill").style.width=(player.currentTime/player.duration)*100+"%";document.getElementById("nowTime").textContent=fmt(player.currentTime);document.getElementById("totalTime").textContent=fmt(player.duration)}});
player.addEventListener("ended",nextTrack);
function fmt(s){if(isNaN(s))return"0:00";var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+String(sec).padStart(2,"0")}
if(tracks.length>0)document.getElementById("nowTitle").textContent=tracks[0].title;
var a=document.getElementById("realVoice");if(a)setTimeout(function(){a.play()},1500);

var socket=io({transports:["websocket","polling"]}),user=null;
function toggleChat(){var b=document.getElementById("chatBox");b.classList.toggle("open");if(b.classList.contains("open")&&user)loadMsgs()}
function startChat(){var n=document.getElementById("cName").value.trim(),e=document.getElementById("cEmail").value.trim();if(!n||!e)return;user={name:n,email:e};socket.emit("register",{name:n,email:e});document.getElementById("chatForm").style.display="none";document.getElementById("chatSend").style.display="block";loadMsgs()}
async function loadMsgs(){if(!user)return;try{var r=await fetch("/api/msgs/"+encodeURIComponent(user.email)),ms=await r.json(),b=document.getElementById("chatMsgs");b.innerHTML="";if(!ms.length)b.innerHTML='<div style="text-align:center;padding:20px;color:#65676B">No messages</div>';else ms.forEach(function(m){addMsg(m,b)});b.scrollTop=b.scrollHeight}catch(e){}}
function addMsg(m,b){var c=m.sender===user.email?"me":"you",t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});b.innerHTML+='<div class="msg '+c+'">'+m.message+'<div class="t">'+t+'</div></div>'}
function sendMsg(){var i=document.getElementById("cMsg"),m=i.value.trim();if(!m||!user)return;socket.emit("sendMsg",{sender:user.email,receiver:"admin",message:m,type:"text"});i.value="";i.focus()}
socket.on("newMsg",function(m){if(user&&(m.sender===user.email||m.receiver===user.email)){var b=document.getElementById("chatMsgs");addMsg(m,b);b.scrollTop=b.scrollHeight}});
</script>
</body>
</html>`;

  res.send(html);
});

app.get('/api/msgs/:email', (req, res) => {
  try {
    const msgs = db.prepare("SELECT * FROM messages WHERE (sender = ? AND receiver = 'admin') OR (sender = 'admin' AND receiver = ?) ORDER BY timestamp ASC").all(req.params.email, req.params.email);
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
    const users = db.prepare("SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC").all();
    users.forEach(u => { const c = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0").get(u.email); u.unreadCount = c.count; });
    res.json(users);
  } catch (err) { res.json([]); }
});

app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Admin Messenger</title>
<style>
:root{--bg:#F0F2F5;--w:#fff;--t:#1C1E21;--s:#65676B;--b:#1877F2;--g:#42B72A;--r:#FA383E;--l:#E4E6EB;--h:#F2F2F2}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);height:100vh;overflow:hidden;color:var(--t);font-size:15px}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.login-card{background:#fff;padding:28px;border-radius:12px;width:100%;max-width:380px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.2)}
.login-card h2{font-weight:700;margin-bottom:4px;font-size:1.2em}
.login-card .sub{color:var(--s);font-size:0.85em;margin-bottom:18px}
.login-card input{width:100%;padding:11px;margin-bottom:10px;border:1px solid var(--l);border-radius:8px;font-size:0.9em;outline:none;-webkit-appearance:none}
.login-card input:focus{border-color:var(--b)}
.login-card button{width:100%;padding:11px;background:var(--b);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.95em}
.login-card button:disabled{opacity:0.6}
.error{color:var(--r);font-size:0.8em;margin-top:6px;display:none}
.app{display:none;height:100vh}
.layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
@media(max-width:767px){.layout{flex-direction:column}}
.sidebar{width:340px;border-right:1px solid var(--l);display:flex;flex-direction:column;flex-shrink:0}
@media(max-width:767px){.sidebar{width:100%;max-height:40vh;border-right:none;border-bottom:1px solid var(--l)}}
.sb-head{padding:12px 14px;border-bottom:1px solid var(--l);display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.sb-head h2{font-size:1em;font-weight:700}
.sb-head button{background:none;border:none;color:var(--b);font-weight:600;cursor:pointer;font-size:0.85em;padding:5px 10px;border-radius:4px}
.sb-head button:hover{background:var(--h)}
.search-box{padding:8px 14px;border-bottom:1px solid var(--l);flex-shrink:0}
.search-box input{width:100%;padding:8px 12px;border:1px solid var(--l);border-radius:20px;font-size:0.85em;outline:none;-webkit-appearance:none;background:var(--bg)}
.search-box input:focus{border-color:var(--b);background:#fff}
.user-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.u-item{padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid var(--l);-webkit-tap-highlight-color:transparent}
.u-item:hover{background:var(--h)}
.u-item.active{background:#E7F3FF}
.u-ava{width:38px;height:38px;border-radius:50%;background:var(--b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;font-size:1em}
.u-info{flex:1;min-width:0}
.u-info .name{font-weight:600;font-size:0.85em}
.u-info .email{font-size:0.75em;color:var(--s);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unread{background:var(--b);color:#fff;font-size:0.68em;padding:2px 7px;border-radius:10px;font-weight:600;flex-shrink:0}
.chat-area{flex:1;display:flex;flex-direction:column;min-height:0}
@media(max-width:767px){.chat-area{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;display:none}.chat-area.active{display:flex}}
.ch-head{padding:10px 14px;border-bottom:1px solid var(--l);display:flex;align-items:center;gap:10px;background:var(--bg);flex-shrink:0}
.back-btn{display:none;background:none;border:none;font-size:1.2em;cursor:pointer;padding:4px 8px;color:var(--b)}
@media(max-width:767px){.back-btn{display:block}}
.ch-ava{width:34px;height:34px;border-radius:50%;background:var(--b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.85em;flex-shrink:0}
.ch-name{font-weight:600;font-size:0.9em}
.ch-status{font-size:0.73em}.ch-status.online{color:var(--g)}
.ch-msgs{flex:1;overflow-y:auto;padding:14px;background:var(--bg);-webkit-overflow-scrolling:touch}
.msg{max-width:70%;padding:8px 11px;border-radius:18px;margin-bottom:5px;font-size:0.85em;word-wrap:break-word}
.msg.sent{background:var(--b);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.recv{background:#fff;color:var(--t);border-bottom-left-radius:4px;border:1px solid var(--l)}
.msg .time{font-size:0.65em;opacity:0.7;margin-top:2px;text-align:right}
.ch-input{padding:10px 14px;border-top:1px solid var(--l);display:none;background:#fff;flex-shrink:0}
.ch-row{display:flex;align-items:center;gap:8px}
.ch-row input{flex:1;padding:10px 14px;border:1px solid var(--l);border-radius:20px;font-size:0.9em;outline:none;-webkit-appearance:none;background:var(--bg)}
.ch-row input:focus{border-color:var(--b);background:#fff}
.ch-row button{background:var(--b);color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0;font-size:1em;display:flex;align-items:center;justify-content:center}
.empty{text-align:center;color:var(--s);padding:50px 20px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1C1E21;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.8em;z-index:9999;opacity:0;transition:opacity 0.3s}
.toast.show{opacity:1}
</style></head><body>

<div class="login-overlay" id="lo"><div class="login-card">
<h2>🔐 Admin Messenger</h2><p class="sub">Support Panel</p>
<input type="text" id="le" placeholder="Username" value="admin" autocomplete="username">
<input type="password" id="lp" placeholder="Password" value="admin123" autocomplete="current-password">
<button id="lb" onclick="doLogin()">Sign In</button>
<div class="error" id="err"></div></div></div>

<div class="app" id="app"><div class="layout">
<div class="sidebar" id="sb"><div class="sb-head"><h2>💬 Conversations</h2><button onclick="doLogout()">Logout</button></div>
<div class="search-box"><input type="text" id="sq" placeholder="🔍 Search..." oninput="filterUsers()"></div>
<div class="user-list" id="ul"><div class="empty"><p>Loading...</p></div></div></div>

<div class="chat-area" id="ca"><div class="ch-head"><button class="back-btn" onclick="goBack()">←</button>
<div class="ch-ava" id="cav">?</div>
<div><div class="ch-name" id="cn">Select user</div><div class="ch-status offline" id="cs">● Offline</div></div></div>
<div class="ch-msgs" id="cm"><div class="empty"><h3>No conversation</h3><p>Select a user</p></div></div>
<div class="ch-input" id="ci"><div class="ch-row">
<input type="text" id="mi" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()">➤</button></div></div></div>
</div></div>

<div class="toast" id="toast"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io({transports:["websocket","polling"]}),cu=null,au=[],li=false,iv=null;
function toast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2000)}
socket.on("connect",function(){if(li)loadUsers()});
socket.on("newMsg",function(m){if(cu&&((m.sender===cu.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===cu.email)))appendMsg(m);loadUsers()});
socket.on("userStatus",function(d){if(cu&&cu.email===d.email){var s=document.getElementById("cs");s.textContent=d.online?"● Online":"● Offline";s.className="ch-status "+(d.online?"online":"offline")}loadUsers()});
async function doLogin(){var e=document.getElementById("le").value.trim(),p=document.getElementById("lp").value.trim(),er=document.getElementById("err"),bt=document.getElementById("lb");er.style.display="none";if(!e||!p){er.textContent="Fill all";er.style.display="block";return}bt.disabled=true;bt.textContent="...";
try{var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});if(r.ok){li=true;localStorage.setItem("ad",JSON.stringify({email:e,password:p}));document.getElementById("lo").style.display="none";document.getElementById("app").style.display="block";socket.emit("register",{name:"Admin",email:"admin"});loadUsers();iv=setInterval(loadUsers,8000)}else{er.textContent="Invalid";er.style.display="block"}}catch(ex){er.textContent="Error";er.style.display="block"}bt.disabled=false;bt.textContent="Sign In"}
async function loadUsers(){if(!li)return;try{var r=await fetch("/api/admin/users");au=await r.json();renderUsers()}catch(e){}}
function renderUsers(){var s=document.getElementById("sq").value.toLowerCase(),f=au.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)}),h="";f.forEach(function(u){var a=cu&&cu.email===u.email;h+='<div class="u-item'+(a?" active":"")+'" onclick="selectUser(\\''+u.email+'\\')"><div class="u-ava">'+u.name.charAt(0).toUpperCase()+'</div><div class="u-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':"")+'</div>'});document.getElementById("ul").innerHTML=h||'<div class="empty"><p>No users</p></div>'}
function filterUsers(){renderUsers()}
async function selectUser(e){var u=au.find(function(u){return u.email===e});if(!u)return;cu=u;document.getElementById("cav").textContent=u.name.charAt(0).toUpperCase();document.getElementById("cn").textContent=u.name;document.getElementById("cs").textContent=u.isOnline?"● Online":"● Offline";document.getElementById("cs").className="ch-status "+(u.isOnline?"online":"offline");document.getElementById("ci").style.display="block";document.getElementById("ca").classList.add("active");if(window.innerWidth<768)document.getElementById("sb").style.display="none";
try{var r=await fetch("/api/msgs/"+encodeURIComponent(u.email)),ms=await r.json(),c=document.getElementById("cm");c.innerHTML="";if(!ms.length)c.innerHTML='<div class="empty"><h3>No messages</h3></div>';else ms.forEach(function(m){addMsg(m,c)});c.scrollTop=99999}catch(e){}socket.emit("markRead",{user:u.email});renderUsers()}
function addMsg(m,c){var s=m.sender==="admin",t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});c.innerHTML+='<div class="msg '+(s?"sent":"recv")+'">'+m.message+'<div class="time">'+t+'</div></div>'}
function appendMsg(m){if(!cu)return;var c=document.getElementById("cm");addMsg(m,c);c.scrollTop=99999}
function sendMessage(){if(!cu){toast("Select user");return}var i=document.getElementById("mi"),m=i.value.trim();if(!m)return;socket.emit("sendMsg",{sender:"admin",receiver:cu.email,message:m,type:"text"});appendMsg({sender:"admin",receiver:cu.email,message:m,timestamp:new Date().toISOString()});i.value="";i.focus()}
function goBack(){document.getElementById("ca").classList.remove("active");document.getElementById("sb").style.display="flex";cu=null;document.getElementById("cm").innerHTML='<div class="empty"><h3>No conversation</h3></div>';document.getElementById("ci").style.display="none";renderUsers()}
function doLogout(){if(iv)clearInterval(iv);localStorage.removeItem("ad");li=false;location.reload()}
var saved=localStorage.getItem("ad");if(saved){var d=JSON.parse(saved);document.getElementById("le").value=d.email;document.getElementById("lp").value=d.password}
document.addEventListener("DOMContentLoaded",function(){document.getElementById("lp").addEventListener("keypress",function(e){if(e.key==="Enter")doLogin()})});
window.addEventListener("resize",function(){if(window.innerWidth>=768&&cu)document.getElementById("sb").style.display="flex"});
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
  console.log('Login: admin / admin123');
});

// server.js
require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const CONFIG = require('./config');
const THEME = require('./theme');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = CONFIG.server.port;

// ==================== CACHE & STATIC FILES ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache Assets for 7 Days (604800000 ms)
app.use('/assets', express.static('assets', { maxAge: 604800000 }));
app.use('/uploads', express.static('uploads', { maxAge: 604800000 }));
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css'), { maxAge: 604800000 }));

app.use(session({
  secret: CONFIG.server.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

['uploads', 'assets/covermusic', 'assets/gallery'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==================== SQLITE3 SETUP ====================
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('❌ SQLite Error:', err.message);
  else console.log('✅ SQLite3 Connected');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    phone TEXT,
    avatar TEXT,
    isAdmin INTEGER DEFAULT 0,
    isVerified INTEGER DEFAULT 0,
    lastSeen TEXT,
    isOnline INTEGER DEFAULT 0,
    createdAt TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    message TEXT,
    type TEXT DEFAULT 'text',
    fileUrl TEXT,
    fileName TEXT,
    fileSize INTEGER,
    seen INTEGER DEFAULT 0,
    timestamp TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporterName TEXT,
    reporterEmail TEXT,
    fakeAccount TEXT,
    platform TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    createdAt TEXT
  )`);

  db.get(`SELECT * FROM users WHERE email = ? AND isAdmin = 1`, [CONFIG.admin.defaultEmail], async (err, row) => {
    const hash = await bcrypt.hash(CONFIG.admin.defaultPassword, 10);
    if (!row) {
      db.run(`INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)`, 
        ['Admin', CONFIG.admin.defaultEmail, hash], 
        (err) => { if (!err) console.log('✅ Admin created'); }
      );
    } else {
      db.run(`UPDATE users SET password = ? WHERE email = ?`, [hash, CONFIG.admin.defaultEmail], (err) => {
        if (!err) console.log('✅ Admin updated');
      });
    }
  });
});

// ==================== HELPERS ====================
const ASSETS = CONFIG.assets;
const WELCOME_VOICE = fs.existsSync(CONFIG.voice.welcome);
const MANUAL_VOICE = fs.existsSync(CONFIG.voice.manualAlert);

function getSongs() {
  try {
    const dir = CONFIG.musicDir;
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
      <img src="${ASSETS.playGif}" class="song-thumb" loading="lazy">
      <div class="song-info"><div class="song-title">${s.title}</div><div class="song-artist">Baiilla Maach</div></div>
      <span class="song-play">▶</span>
    </div>`;
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `<div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-gradient">VOICE</span>
        <h3>Voice Verification</h3>
        <p>Listen to authentic voice recordings</p>
      </div>
      <div class="card-body">
        <div class="btn-group">
          ${WELCOME_VOICE ? '<button class="btn btn-gradient" onclick="playWelcomeVoice()">🎤 Real Voice</button>' : ''}
          ${MANUAL_VOICE ? '<button class="btn btn-danger" onclick="playManualVoice()">🚨 Fake Alert</button>' : ''}
        </div>
      </div>
    </div>`;
  }

  let fakeCardsHTML = '';
  CONFIG.fakeAccounts.forEach(fake => {
    fakeCardsHTML += `<div class="fake-card">
      <div class="fake-img-wrap">
        <img src="${fake.image}" class="fake-img" loading="lazy">
        <img src="${ASSETS.fakeDetect}" class="fake-overlay" loading="lazy">
      </div>
      <div class="fake-body">
        <h4>${fake.username}</h4>
        <div class="platform">📍 ${fake.platform}</div>
        <p>${fake.reason}</p>
        <a href="${fake.url}" target="_blank" class="btn btn-danger btn-sm">🚨 Report</a>
      </div>
    </div>`;
  });

  const themeVars = `<style>
    :root {
      --primary: ${THEME.colors.primary};
      --secondary: ${THEME.colors.secondary};
      --accent: ${THEME.colors.accent};
      --danger: ${THEME.colors.danger};
      --success: ${THEME.colors.success};
      --warning: ${THEME.colors.warning};
      --dark: ${THEME.colors.dark};
      --light: ${THEME.colors.light};
      --text-primary: ${THEME.colors.textPrimary};
      --text-secondary: ${THEME.colors.textSecondary};
      --text-muted: ${THEME.colors.textMuted};
      --border: ${THEME.colors.border};
      --border-light: ${THEME.colors.borderLight};
      --gradient: ${THEME.gradients.primary};
      --gradient-pink: ${THEME.gradients.pink};
      --gradient-success: ${THEME.gradients.success};
      --shadow-sm: ${THEME.shadows.sm};
      --shadow-md: ${THEME.shadows.md};
      --shadow-lg: ${THEME.shadows.lg};
      --shadow-primary: ${THEME.shadows.primary};
      --shadow-danger: ${THEME.shadows.danger};
      --shadow-success: ${THEME.shadows.success};
      --shadow-glow: ${THEME.shadows.glow};
      --radius-sm: ${THEME.radius.sm};
      --radius-md: ${THEME.radius.md};
      --radius-lg: ${THEME.radius.lg};
      --radius-xl: ${THEME.radius.xl};
      --radius-pill: ${THEME.radius.pill};
      --radius-round: ${THEME.radius.round};
      --btn-pad-y: ${THEME.button.paddingY};
      --btn-pad-x: ${THEME.button.paddingX};
      --btn-font: ${THEME.button.fontSize};
      --btn-weight: ${THEME.button.fontWeight};
      --btn-lift: ${THEME.button.lift};
      --btn-hover-scale: ${THEME.button.hoverScale};
      --btn-active-scale: ${THEME.button.activeScale};
      --btn-transition: ${THEME.button.transition};
    }
  </style>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baiilla Maach Official | Hammad Bin Amir</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  ${themeVars}
</head>
<body>
  <header class="header">
    <div class="header-left">
      <img src="${CONFIG.profile.avatar}" class="header-logo" alt="Logo">
      <span class="header-name">Baiilla Maach</span>
    </div>
    <!-- Admin Link Removed -->
  </header>

  <div class="container">
    <div class="card profile-card">
      <div class="profile-cover"></div>
      <div class="profile-avatar-wrap">
        <img src="${CONFIG.profile.avatar}" class="profile-avatar" alt="Profile">
        <div class="verified-badge">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
      </div>
      <h2 class="profile-name typing-text" id="typeName"></h2>
      <div class="profile-username">${CONFIG.profile.username}</div>
      <div class="profile-bio typing-text" id="typeBio"></div>

      <div class="stats-row">
        <div class="stat"><div class="stat-num">${CONFIG.stats.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
        <div class="stat"><div class="stat-num">${CONFIG.stats.following}</div><div class="stat-label">Following</div></div>
        <div class="stat"><div class="stat-num">${CONFIG.stats.tiktokLikes}</div><div class="stat-label">Likes</div></div>
      </div>

      <div class="btn-group">
        <a href="${CONFIG.links.tiktok}" target="_blank" class="btn btn-gradient">
          <img src="${ASSETS.logoTikTok}" width="20" alt="TikTok" loading="lazy"> Follow TikTok
        </a>
        <a href="${CONFIG.links.facebook}" target="_blank" class="btn btn-gradient">
          <img src="${ASSETS.logoFB}" width="20" alt="Facebook" loading="lazy"> Follow Facebook
        </a>
      </div>

      <div class="gif-strip">
        <div class="gif-item"><img src="${ASSETS.followGif}" alt="Follow" loading="lazy"><span>Follow</span></div>
        <div class="gif-item"><img src="${ASSETS.addGif}" alt="Add" loading="lazy"><span>Add</span></div>
        <div class="gif-item"><img src="${ASSETS.playGif}" alt="Play" loading="lazy"><span>Play</span></div>
      </div>
    </div>

    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-success">OFFICIAL</span>
        <h3>Verified Accounts</h3>
        <p>The only authentic accounts</p>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="verified-item">
            <img src="${ASSETS.profile}" class="v-avatar" alt="TikTok" loading="lazy">
            <div class="v-info">
              <h4>TikTok <img src="${ASSETS.blueTikTok}" alt="Verified" loading="lazy"></h4>
              <div class="v-handle">${CONFIG.profile.username}</div>
              <div class="v-detail">✓ Active · <strong>${CONFIG.stats.tiktokFollowers}</strong> Followers · <strong>${CONFIG.stats.tiktokLikes}</strong> Likes</div>
              <a href="${CONFIG.links.tiktok}" target="_blank" class="btn btn-outline btn-sm">Follow</a>
            </div>
          </div>
          <div class="verified-item">
            <img src="${ASSETS.fbProfile}" class="v-avatar" alt="Facebook" loading="lazy">
            <div class="v-info">
              <h4>Facebook <img src="${ASSETS.blueFB}" alt="Verified" loading="lazy"></h4>
              <div class="v-handle">@BaiillaMaachOfficial</div>
              <div class="v-detail">✓ Active · <strong>${CONFIG.stats.facebookFollowers}</strong> Followers</div>
              <a href="${CONFIG.links.facebook}" target="_blank" class="btn btn-outline btn-sm">Follow</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-danger">WARNING</span>
        <h3>Fake Accounts Detected</h3>
        <p>Report these accounts</p>
      </div>
      <div class="card-body">
        <div class="grid-2">
          ${fakeCardsHTML}
        </div>
      </div>
    </div>

    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-gradient">PROOF</span>
        <h3>Identity Verification</h3>
      </div>
      <div class="card-body">
        <div class="proof-grid" style="grid-template-columns: 1fr;">
          <div class="proof-item">
            <img src="${ASSETS.realId}" alt="Real ID" loading="lazy">
            <div class="label">Real ID Verified</div>
          </div>
        </div>
      </div>
    </div>

    ${voiceHTML}

    ${songs.length > 0 ? `
    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-gradient">MUSIC</span>
        <h3>Cover Songs</h3>
      </div>
      <div class="music-section">
        <div class="music-header">
          <img src="${ASSETS.playGif}" class="music-cover" id="mCover" alt="Cover" loading="lazy">
          <div class="music-info">
            <div class="music-title" id="mTitle">Select Song</div>
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
        <div class="music-list">
          ${songsListHTML}
        </div>
      </div>
    </div>` : ''}
  </div>

  <div class="chat-widget">
    <button class="chat-toggle" onclick="toggleChat()">💬</button>
  </div>

  <div class="chat-panel" id="chatPanel">
    <div class="chat-head">
      💬 Chat Support
      <button onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-body" id="chatBody">
      <div class="chat-login" id="chatLoginForm">
        <h4 style="margin-bottom:16px">Start Chat</h4>
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

  ${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/${CONFIG.voice.welcome}" preload="none"></audio>` : ''}
  ${MANUAL_VOICE ? `<audio id="manualAudio" src="/${CONFIG.voice.manualAlert}" preload="none"></audio>` : ''}
  <audio id="musicAudio" preload="none"></audio>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    // Typing Animation Logic
    const nameText = "${CONFIG.profile.name}";
    const bioText = "${CONFIG.profile.bio}";
    let iName = 0, iBio = 0;
    const speed = 50; // Typing speed (ms)

    function typeName() {
      if (iName < nameText.length) {
        document.getElementById("typeName").innerHTML += nameText.charAt(iName);
        iName++;
        setTimeout(typeName, speed);
      } else {
        document.getElementById("typeName").classList.remove("typing-text"); // remove border after finish
        typeBio();
      }
    }
    function typeBio() {
      if (iBio < bioText.length) {
        document.getElementById("typeBio").innerHTML += bioText.charAt(iBio);
        iBio++;
        setTimeout(typeBio, speed);
      } else {
        document.getElementById("typeBio").classList.remove("typing-text");
      }
    }
    setTimeout(typeName, 500); // Start typing after 0.5s page load

    // Audio & Music Logic
    var welcomeAudio = document.getElementById("welcomeAudio");
    var manualAudio = document.getElementById("manualAudio");
    var musicAudio = document.getElementById("musicAudio");
    function stopAllAudio() {
      if (welcomeAudio) { welcomeAudio.pause(); welcomeAudio.currentTime = 0; }
      if (manualAudio) { manualAudio.pause(); manualAudio.currentTime = 0; }
      if (musicAudio) { musicAudio.pause(); }
      musicPlaying = false;
      updatePlayBtn();
    }
    function playWelcomeVoice() { if (!welcomeAudio) return; stopAllAudio(); welcomeAudio.play(); }
    function playManualVoice() { if (!manualAudio) return; stopAllAudio(); manualAudio.play(); }
    
    var tracks = ${songsJSON};
    var currentTrack = 0;
    var musicPlaying = false;
    function updatePlayBtn() {
      var b = document.getElementById("mPlayBtn");
      if (b) b.innerHTML = musicPlaying ? "⏸" : "▶";
      var c = document.getElementById("mCover");
      if (c) { if (musicPlaying) c.classList.add("playing"); else c.classList.remove("playing"); }
    }
    function updateMusicUI(i) {
      document.getElementById("mTitle").textContent = tracks[i].title;
      var items = document.querySelectorAll(".song-item");
      for (var j = 0; j < items.length; j++) { if (j === i) items[j].classList.add("active"); else items[j].classList.remove("active"); }
    }
    function playMusic(i) {
      if (!tracks.length) return;
      stopAllAudio();
      currentTrack = i;
      musicAudio.src = tracks[i].url;
      musicAudio.play();
      musicPlaying = true;
      updatePlayBtn();
      updateMusicUI(i);
    }
    function toggleMusic() {
      if (musicAudio.paused) {
        if (!musicAudio.src && tracks.length) musicAudio.src = tracks[0].url;
        stopAllAudio();
        musicAudio.play();
        musicPlaying = true;
        updatePlayBtn();
        updateMusicUI(currentTrack);
      } else {
        musicAudio.pause();
        musicPlaying = false;
        updatePlayBtn();
      }
    }
    function prevMusic() { playMusic((currentTrack - 1 + tracks.length) % tracks.length); }
    function nextMusic() { playMusic((currentTrack + 1) % tracks.length); }
    function seekMusic(e) {
      if (!musicAudio.duration) return;
      var r = e.currentTarget.getBoundingClientRect();
      musicAudio.currentTime = ((e.clientX - r.left) / r.width) * musicAudio.duration;
    }
    musicAudio.addEventListener("timeupdate", function() {
      if (musicAudio.duration) {
        document.getElementById("mSliderFill").style.width = (musicAudio.currentTime / musicAudio.duration) * 100 + "%";
        document.getElementById("mCurrentTime").textContent = formatTime(musicAudio.currentTime);
        document.getElementById("mDuration").textContent = formatTime(musicAudio.duration);
      }
    });
    musicAudio.addEventListener("ended", nextMusic);
    function formatTime(s) {
      if (isNaN(s)) return "0:00";
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return m + ":" + String(sec).padStart(2, "0");
    }
    
    // Play Welcome Voice after load
    if (welcomeAudio) setTimeout(function() { welcomeAudio.play().catch(e => {}); }, 1500);
    
    // Chat Logic
    var socket = io();
    var chatUser = null;
    function toggleChat() { document.getElementById("chatPanel").classList.toggle("open"); }
    function startChatSession() {
      var n = document.getElementById("chatNameInput").value.trim();
      var e = document.getElementById("chatEmailInput").value.trim();
      if (!n || !e) return;
      chatUser = { name: n, email: e };
      socket.emit("register", { name: n, email: e });
      document.getElementById("chatLoginForm").style.display = "none";
      document.getElementById("chatInputArea").style.display = "block";
      loadChatMessages();
    }
    async function loadChatMessages() {
      if (!chatUser) return;
      var r = await fetch("/api/msgs/" + chatUser.email);
      var ms = await r.json();
      var b = document.getElementById("chatBody");
      b.innerHTML = "";
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        var cls = (m.sender === chatUser.email ? "user" : "admin");
        b.innerHTML += '<div class="msg ' + cls + '">' + m.message + '<div class="time">' + new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) + '</div></div>';
      }
      b.scrollTop = b.scrollHeight;
    }
    function sendChatMsg() {
      var i = document.getElementById("chatMsgInput");
      var m = i.value.trim();
      if (!m || !chatUser) return;
      socket.emit("sendMsg", { sender: chatUser.email, receiver: "admin", message: m, type: "text" });
      i.value = "";
    }
    socket.on("newMsg", function(m) {
      if (chatUser && (m.sender === chatUser.email || m.receiver === chatUser.email)) {
        var b = document.getElementById("chatBody");
        var cls = (m.sender === chatUser.email ? "user" : "admin");
        b.innerHTML += '<div class="msg ' + cls + '">' + m.message + '<div class="time">' + new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) + '</div></div>';
        b.scrollTop = b.scrollHeight;
      }
    });
  </script>
</body>
</html>`;

  res.send(html);
});

// ==================== API ROUTES ====================
app.get('/api/msgs/:email', (req, res) => {
  const email = req.params.email;
  db.all(`SELECT * FROM messages WHERE (sender = ? AND receiver = 'admin') OR (sender = 'admin' AND receiver = ?) ORDER BY timestamp ASC`, 
    [email, email], 
    (err, rows) => {
      if (err) { console.error(err); return res.json([]); }
      res.json(rows);
    }
  );
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND isAdmin = 1`, [email], async (err, user) => {
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.isAdmin = true;
    req.session.adminEmail = email;
    res.json({ success: true });
  });
});

app.get('/api/admin/users', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  
  db.all(`SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC`, [], (err, users) => {
    if (err) return res.json([]);
    
    let count = 0;
    if (users.length === 0) return res.json([]);

    users.forEach(u => {
      db.get(`SELECT COUNT(*) as c FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0`, [u.email], (err, result) => {
        u.unreadCount = result ? result.c : 0;
        count++;
        if (count === users.length) {
          res.json(users);
        }
      });
    });
  });
});

app.post('/api/report', (req, res) => {
  const { reporterName, reporterEmail, fakeAccount, platform, reason } = req.body;
  db.run(`INSERT INTO reports (reporterName, reporterEmail, fakeAccount, platform, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [reporterName, reporterEmail, fakeAccount, platform, reason, new Date().toISOString()],
    function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ success: true, report: { id: this.lastID } });
    }
  );
});

app.get('/api/admin/reports', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  db.all(`SELECT * FROM reports ORDER BY createdAt DESC`, [], (err, rows) => {
    if (err) return res.json([]);
    res.json(rows);
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const fileUrl = '/uploads/' + req.file.filename;
    res.json({ url: fileUrl, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ==================== ADMIN MESSENGER PAGE ====================
// Route changed from /messenger to /admin
app.get('/admin', (req, res) => {
  const themeVars = `<style>
    :root {
      --primary: ${THEME.colors.primary};
      --secondary: ${THEME.colors.secondary};
      --accent: ${THEME.colors.accent};
      --danger: ${THEME.colors.danger};
      --success: ${THEME.colors.success};
      --warning: ${THEME.colors.warning};
      --dark: ${THEME.colors.dark};
      --light: ${THEME.colors.light};
      --text-primary: ${THEME.colors.textPrimary};
      --text-secondary: ${THEME.colors.textSecondary};
      --text-muted: ${THEME.colors.textMuted};
      --border: ${THEME.colors.border};
      --border-light: ${THEME.colors.borderLight};
      --gradient: ${THEME.gradients.primary};
      --gradient-pink: ${THEME.gradients.pink};
      --gradient-success: ${THEME.gradients.success};
      --shadow-sm: ${THEME.shadows.sm};
      --shadow-md: ${THEME.shadows.md};
      --shadow-lg: ${THEME.shadows.lg};
      --shadow-primary: ${THEME.shadows.primary};
      --shadow-danger: ${THEME.shadows.danger};
      --shadow-success: ${THEME.shadows.success};
      --shadow-glow: ${THEME.shadows.glow};
      --radius-sm: ${THEME.radius.sm};
      --radius-md: ${THEME.radius.md};
      --radius-lg: ${THEME.radius.lg};
      --radius-xl: ${THEME.radius.xl};
      --radius-pill: ${THEME.radius.pill};
      --radius-round: ${THEME.radius.round};
      --btn-pad-y: ${THEME.button.paddingY};
      --btn-pad-x: ${THEME.button.paddingX};
      --btn-font: ${THEME.button.fontSize};
      --btn-weight: ${THEME.button.fontWeight};
      --btn-lift: ${THEME.button.lift};
      --btn-hover-scale: ${THEME.button.hoverScale};
      --btn-active-scale: ${THEME.button.activeScale};
      --btn-transition: ${THEME.button.transition};
    }
  </style>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Messenger | Baiilla Maach</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  ${themeVars}
</head>
<body>
  <div class="login-overlay" id="loginOverlay">
    <div class="login-card">
      <h2>🔐 Admin Messenger</h2>
      <p class="sub">Baiilla Maach Support Panel</p>
      <input type="text" id="loginEmail" placeholder="Username" value="${CONFIG.admin.defaultEmail}">
      <input type="password" id="loginPassword" placeholder="Password" value="${CONFIG.admin.defaultPassword}">
      <button id="loginBtn" onclick="doLogin()">Sign In</button>
      <div class="error" id="loginError"></div>
    </div>
  </div>

  <div class="app" id="app">
    <div class="layout">
      <div class="sidebar">
        <div class="sidebar-head">
          <h2>💬 Conversations</h2>
          <button onclick="doLogout()">Logout</button>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()">
        </div>
        <div class="user-list" id="userList">
          <div class="empty-state"><p>Loading users...</p></div>
        </div>
      </div>
      <div class="chat-area">
        <div class="chat-head">
          <div class="avatar" id="chatAvatar">?</div>
          <div>
            <div class="name" id="chatName">Select a conversation</div>
            <div class="status offline" id="chatStatus">● Offline</div>
          </div>
        </div>
        <div class="chat-msgs" id="chatMessages">
          <div class="empty-state">
            <h3>No conversation selected</h3>
            <p>Click on a user to view messages</p>
          </div>
        </div>
        <div class="chat-input" id="chatInputArea">
          <div class="chat-input-row">
            <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
            <button onclick="sendMessage()">➤</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    var socket = io();
    var currentUser = null;
    var allUsers = [];
    var isLoggedIn = false;
    socket.on("newMsg", function(m) {
      if (currentUser && ((m.sender === currentUser.email && m.receiver === "admin") || (m.sender === "admin" && m.receiver === currentUser.email))) {
        appendMessage(m);
      }
      loadUsers();
    });
    socket.on("userStatus", function(d) {
      if (currentUser && currentUser.email === d.email) {
        var s = document.getElementById("chatStatus");
        s.textContent = d.online ? "● Online" : "● Offline";
        s.className = "status " + (d.online ? "online" : "offline");
      }
      loadUsers();
    });
    async function doLogin() {
      var e = document.getElementById("loginEmail").value.trim();
      var p = document.getElementById("loginPassword").value.trim();
      var err = document.getElementById("loginError");
      var btn = document.getElementById("loginBtn");
      err.style.display = "none";
      if (!e || !p) { err.textContent = "Fill all fields"; err.style.display = "block"; return; }
      btn.disabled = true;
      btn.textContent = "Signing...";
      try {
        var r = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: e, password: p })
        });
        var d = await r.json();
        if (r.ok) {
          isLoggedIn = true;
          localStorage.setItem("adminSession", JSON.stringify({ email: e, password: p }));
          document.getElementById("loginOverlay").style.display = "none";
          document.getElementById("app").style.display = "block";
          loadUsers();
          setInterval(function() { if (isLoggedIn) loadUsers(); }, 10000);
        } else {
          err.textContent = "❌ Invalid credentials";
          err.style.display = "block";
        }
      } catch(ex) {
        err.textContent = "❌ Network error";
        err.style.display = "block";
      }
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
    async function loadUsers() {
      if (!isLoggedIn) return;
      try {
        var r = await fetch("/api/admin/users");
        var data = await r.json();
        allUsers = data;
        renderUserList();
      } catch(e) { console.log("Error:", e); }
    }
    function renderUserList() {
      var s = document.getElementById("searchInput").value.toLowerCase();
      var f = allUsers.filter(function(u) { return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s); });
      var h = "";
      for (var i = 0; i < f.length; i++) {
        var u = f[i];
        var a = currentUser && currentUser.email === u.email;
        h += '<div class="user-item' + (a ? " active" : "") + '" onclick="selectUser(\\'' + u.email + '\\')">' +
          '<div class="user-avatar">' + u.name.charAt(0).toUpperCase() + '</div>' +
          '<div class="user-info"><div class="name">' + u.name + '</div>' +
          '<div class="email">' + u.email + '</div></div>' +
          (u.unreadCount > 0 ? '<div class="unread">' + u.unreadCount + '</div>' : "") +
          '</div>';
      }
      document.getElementById("userList").innerHTML = h || '<div class="empty-state"><p>No users yet</p></div>';
    }
    function filterUsers() { renderUserList(); }
    async function selectUser(e) {
      var u = allUsers.find(function(u) { return u.email === e; });
      if (!u) return;
      currentUser = u;
      document.getElementById("chatAvatar").textContent = u.name.charAt(0).toUpperCase();
      document.getElementById("chatName").textContent = u.name;
      document.getElementById("chatStatus").textContent = u.isOnline ? "● Online" : "● Offline";
      document.getElementById("chatStatus").className = "status " + (u.isOnline ? "online" : "offline");
      document.getElementById("chatInputArea").style.display = "block";
      try {
        var r = await fetch("/api/msgs/" + u.email);
        var ms = await r.json();
        var h = "";
        if (ms.length === 0) { h = '<div class="empty-state"><h3>No messages</h3></div>'; }
        else {
          for (var i = 0; i < ms.length; i++) {
            var m = ms[i];
            var s = m.sender === "admin";
            var t = new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
            h += '<div class="msg ' + (s ? "sent" : "received") + '">' + m.message + '<div class="time">' + t + '</div></div>';
          }
        }
        document.getElementById("chatMessages").innerHTML = h;
        document.getElementById("chatMessages").scrollTop = 99999;
      } catch(ex) { console.log(ex); }
      socket.emit("markRead", { user: u.email });
      renderUserList();
    }
    function appendMessage(m) {
      if (!currentUser) return;
      var c = document.getElementById("chatMessages");
      var s = m.sender === "admin";
      var t = new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
      c.innerHTML += '<div class="msg ' + (s ? "sent" : "received") + '">' + m.message + '<div class="time">' + t + '</div></div>';
      c.scrollTop = 99999;
    }
    function sendMessage() {
      if (!currentUser) return;
      var i = document.getElementById("msgInput");
      var m = i.value.trim();
      if (!m) return;
      socket.emit("sendMsg", { sender: "admin", receiver: currentUser.email, message: m, type: "text" });
      appendMessage({ sender: "admin", receiver: currentUser.email, message: m, timestamp: new Date() });
      i.value = "";
      i.focus();
    }
    function doLogout() {
      localStorage.removeItem("adminSession");
      location.reload();
    }
    var saved = localStorage.getItem("adminSession");
    if (saved) {
      var d = JSON.parse(saved);
      document.getElementById("loginEmail").value = d.email;
      document.getElementById("loginPassword").value = d.password;
    }
    document.addEventListener("DOMContentLoaded", function() {
      document.getElementById("loginPassword").addEventListener("keypress", function(e) {
        if (e.key === "Enter") doLogin();
      });
    });
  </script>
</body>
</html>`);
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  console.log('🔌 Socket connected');
  
  socket.on('register', (data) => {
    console.log('📝 Register:', data.email);
    socket.userData = data;
    
    db.get(`SELECT * FROM users WHERE email = ?`, [data.email], async (err, user) => {
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
        db.run(`INSERT INTO users (name, email, password, isOnline, lastSeen) VALUES (?, ?, ?, 1, ?)`, 
          [data.name, data.email, hash, new Date().toISOString()], 
          (err) => {
            if (!err) console.log('✅ New user created:', data.email);
            io.emit('userStatus', { email: data.email, online: true });
          }
        );
      } else {
        db.run(`UPDATE users SET isOnline = 1, lastSeen = ? WHERE email = ?`, 
          [new Date().toISOString(), data.email], 
          () => io.emit('userStatus', { email: data.email, online: true })
        );
      }
    });
  });
  
  socket.on('sendMsg', (data) => {
    console.log('💬 Msg:', data.sender, '→', data.receiver);
    const timestamp = new Date().toISOString();
    
    db.run(`INSERT INTO messages (sender, receiver, message, type, fileUrl, fileName, fileSize, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.sender, data.receiver, data.message, data.type || 'text', data.fileUrl, data.fileName, data.fileSize, timestamp],
      function(err) {
        if (err) return console.error('Msg error:', err.message);
        
        const msgData = {
          id: this.lastID,
          sender: data.sender,
          receiver: data.receiver,
          message: data.message,
          type: data.type || 'text',
          timestamp: timestamp
        };
        io.emit('newMsg', msgData);
      }
    );
  });
  
  socket.on('markRead', (data) => {
    db.run(`UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = 'admin' AND seen = 0`, [data.user]);
  });
  
  socket.on('disconnect', () => {
    if (socket.userData) {
      db.run(`UPDATE users SET isOnline = 0, lastSeen = ? WHERE email = ?`, 
        [new Date().toISOString(), socket.userData.email], 
        () => {
          io.emit('userStatus', { email: socket.userData.email, online: false });
          console.log('🔴 Offline:', socket.userData.email);
        }
      );
    }
  });
});

// ==================== START SERVER ====================
server.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Admin: http://localhost:' + PORT + '/admin'); // Updated Log
  console.log('👤 User: ' + CONFIG.admin.defaultEmail + ' | 🔑 Pass: ' + CONFIG.admin.defaultPassword);
  console.log('========================================');
});

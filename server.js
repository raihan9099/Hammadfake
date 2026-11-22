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

const PORT = process.env.PORT || CONFIG.server.port || 3000;

// ==================== CACHE & STATIC FILES ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    name TEXT, email TEXT UNIQUE, password TEXT, phone TEXT, avatar TEXT,
    isAdmin INTEGER DEFAULT 0, isVerified INTEGER DEFAULT 0,
    lastSeen TEXT, isOnline INTEGER DEFAULT 0, createdAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT, receiver TEXT, message TEXT, type TEXT DEFAULT 'text',
    fileUrl TEXT, fileName TEXT, fileSize INTEGER,
    seen INTEGER DEFAULT 0, timestamp TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporterName TEXT, reporterEmail TEXT, fakeAccount TEXT, platform TEXT,
    reason TEXT, status TEXT DEFAULT 'pending', createdAt TEXT
  )`);

  db.get(`SELECT * FROM users WHERE email = ? AND isAdmin = 1`, [CONFIG.admin.defaultEmail], async (err, row) => {
    const hash = await bcrypt.hash(CONFIG.admin.defaultPassword, 10);
    if (!row) {
      db.run(`INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)`,
        ['Admin', CONFIG.admin.defaultEmail, hash],
        (err) => { if (!err) console.log('✅ Admin created'); });
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

const THEME_CSS = `<style>
  :root {
    --c-primary: ${THEME.colors.primary};
    --c-secondary: ${THEME.colors.secondary};
    --c-accent: ${THEME.colors.accent};
    --c-danger: ${THEME.colors.danger};
    --c-success: ${THEME.colors.success};
    --c-warning: ${THEME.colors.warning};
    --c-dark: ${THEME.colors.dark};
    --c-light: ${THEME.colors.light};
    --c-text: ${THEME.colors.textPrimary};
    --c-text2: ${THEME.colors.textSecondary};
    --c-muted: ${THEME.colors.textMuted};
    --c-border: ${THEME.colors.border};
    --c-border-light: ${THEME.colors.borderLight};
  }
</style>`;

// ==================== MAIN PAGE (EDL 3D SCROLL) ====================
app.get('/', (req, res) => {
  const songs = getSongs();

  const fakeAccountsHTML = CONFIG.fakeAccounts.map(f => `
    <div class="card">
      <div class="card-icon">⚠️</div>
      <h3 class="card-title">${f.username}</h3>
      <p class="card-desc">📍 ${f.platform} · ${f.reason}</p>
      <a href="${f.url}" target="_blank" class="card-link">Report →</a>
    </div>
  `).join('');

  const songsHTML = songs.map((s, i) => `
    <div class="playlist-item" onclick="playMusic(${i})" id="song-${i}">
      <span class="playlist-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="playlist-info">
        <div class="playlist-title">${s.title}</div>
        <div class="playlist-artist">Baiilla Maach</div>
      </div>
      <span class="card-link" style="font-size:10px">▶</span>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baiilla Maach — The Temperature People®</title>
  <link rel="stylesheet" href="/styles.css">
  ${THEME_CSS}
</head>
<body>
  <div class="top-bar">
    <div class="logo-text">EDL</div>
    <div class="mode-toggle">
      <button class="mode-btn">CHIROPRACTIC</button>
      <button class="mode-btn active">INDUSTRIAL</button>
    </div>
  </div>

  <!-- 1. HERO -->
  <section class="scroll-section hero-section">
    <h1 class="hero-logo">EDL</h1>
    <div class="hero-subtitle">The Temperature People® since 1943</div>
    <div class="hero-tag">${CONFIG.profile.username}</div>
    <div class="scroll-hint">SCROLL DOWN</div>
  </section>

  <!-- 2. STORY -->
  <section class="scroll-section">
    <div class="story-section">
      <h2 class="story-headline">The Temperature People®</h2>
      <p class="story-body">${CONFIG.profile.bio}</p>
      <div class="stats" style="display:flex; justify-content:center; gap:40px; margin-top:32px;">
        <div><span style="font-size:24px; font-weight:800;">${CONFIG.stats.tiktokFollowers}</span><br><span style="font-size:11px; color:var(--text-tertiary); letter-spacing:0.1em;">FOLLOWERS</span></div>
        <div><span style="font-size:24px; font-weight:800;">${CONFIG.stats.tiktokLikes}</span><br><span style="font-size:11px; color:var(--text-tertiary); letter-spacing:0.1em;">LIKES</span></div>
      </div>
    </div>
  </section>

  <!-- 3. CHIROPRACTIC -->
  <section class="scroll-section showcase-section" id="chiropractic">
    <h2 class="showcase-title">Chiropractic</h2>
    <div class="card-grid">
      <div class="card">
        <div class="card-icon">🩺</div>
        <h3 class="card-title">Nervo-Scope® Devices</h3>
        <p class="card-desc">Precision thermal scanning instruments for accurate diagnostics.</p>
        <a href="${CONFIG.links.tiktok}" target="_blank" class="card-link">Browse Products →</a>
      </div>
      <div class="card">
        <div class="card-icon">⚡</div>
        <h3 class="card-title">Nervo-Scope® Pro-Series</h3>
        <p class="card-desc">Advanced thermal imaging for the modern practitioner.</p>
        <a href="${CONFIG.links.tiktok}" target="_blank" class="card-link">Browse Products →</a>
      </div>
      <div class="card">
        <div class="card-icon">🔧</div>
        <h3 class="card-title">Chiropractic Accessories</h3>
        <p class="card-desc">Cables, sensors, and accessories built to last.</p>
        <a href="${CONFIG.links.tiktok}" target="_blank" class="card-link">Browse Products →</a>
      </div>
    </div>
  </section>

  <!-- 4. INDUSTRIAL -->
  <section class="scroll-section showcase-section" id="industrial">
    <h2 class="showcase-title">Industrial</h2>
    <div class="card-grid">
      <div class="card">
        <div class="card-icon">🌡️</div>
        <h3 class="card-title">Sensors</h3>
        <p class="card-desc">Make contact with the industry standard by which all others are measured.</p>
        <a href="${CONFIG.links.facebook}" target="_blank" class="card-link">Browse Products →</a>
      </div>
      <div class="card">
        <div class="card-icon">🔥</div>
        <h3 class="card-title">Pyrometers</h3>
        <p class="card-desc">We can take the heat. And measure it accurately and repeatedly.</p>
        <a href="${CONFIG.links.facebook}" target="_blank" class="card-link">Browse Products →</a>
      </div>
      <div class="card">
        <div class="card-icon">📐</div>
        <h3 class="card-title">Calibrators</h3>
        <p class="card-desc">Engineered by skilled craftsmen to maximum reliability accuracy.</p>
        <a href="${CONFIG.links.facebook}" target="_blank" class="card-link">Browse Products →</a>
      </div>
    </div>
  </section>

  <!-- 5. FAKE ACCOUNTS -->
  <section class="scroll-section showcase-section">
    <h2 class="showcase-title" style="color:var(--c-danger)">Warning</h2>
    <div class="card-grid">
      ${fakeAccountsHTML}
    </div>
  </section>

  <!-- 6. MUSIC -->
  ${songs.length > 0 ? `
  <section class="scroll-section showcase-section">
    <h2 class="showcase-title">Cover Songs</h2>
    <div class="player" style="max-width:600px;margin:0 auto;padding:32px;background:rgba(15,22,56,0.6);border:1px solid var(--border);border-radius:20px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <img src="${ASSETS.playGif}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;" id="mCover">
        <div style="flex:1;min-width:0;">
          <div id="mTitle" style="font-weight:600;font-size:17px;">Select Song</div>
          <div style="font-size:13px;color:var(--text-tertiary);margin-top:4px;">Baiilla Maach</div>
        </div>
      </div>
      <div class="player-progress" onclick="seekMusic(event)" style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-bottom:8px;cursor:pointer;">
        <div id="mSliderFill" style="height:100%;background:var(--c-accent);border-radius:2px;width:0;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">
        <span id="mCurrentTime">0:00</span>
        <span id="mDuration">0:00</span>
      </div>
      <div style="display:flex;justify-content:center;gap:16px;margin-bottom:20px;">
        <button onclick="prevMusic()" style="width:44px;height:44px;border-radius:50%;border:1px solid var(--border-bright);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;">⏮</button>
        <button id="mPlayBtn" onclick="toggleMusic()" style="width:56px;height:56px;border-radius:50%;background:var(--gradient-glow);color:#000;border:none;cursor:pointer;font-size:20px;">▶</button>
        <button onclick="nextMusic()" style="width:44px;height:44px;border-radius:50%;border:1px solid var(--border-bright);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;">⏭</button>
      </div>
      <div style="max-height:200px;overflow-y:auto;">${songsHTML}</div>
    </div>
  </section>` : ''}

  <!-- 7. CONTACT -->
  <section class="scroll-section contact-section">
    <h2 class="contact-headline">Say Hello</h2>
    <a href="mailto:${CONFIG.admin.defaultEmail}" class="contact-link">${CONFIG.admin.defaultEmail}</a>
    <a href="tel:1.800.342.5335" class="contact-link">1.800.342.5335</a>
    <a href="/admin" class="btn-glow">Contact Us</a>
  </section>

  <!-- Call Now Floating -->
  <a href="tel:1.800.342.5335" class="call-now">📞 Call Now</a>

  <!-- Chat Widget -->
  <button class="chat-fab" onclick="toggleChat()" style="position:fixed;bottom:100px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--gradient-glow);color:#000;border:none;font-size:24px;cursor:pointer;z-index:9998;">💬</button>
  
  <div class="chat-panel" id="chatPanel" style="display:none;position:fixed;bottom:170px;right:24px;width:360px;height:500px;background:rgba(15,22,56,0.95);backdrop-filter:blur(30px);border-radius:24px;border:1px solid var(--border-bright);flex-direction:column;z-index:9999;">
    <div class="chat-head" style="padding:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-weight:700;">
      Chat Support <button onclick="toggleChat()" style="background:none;border:none;color:#fff;cursor:pointer;">✕</button>
    </div>
    <div class="chat-body" id="chatBody" style="flex:1;overflow-y:auto;padding:20px;">
      <div class="chat-login" id="chatLoginForm">
        <h4 style="margin-bottom:16px;">Start Chat</h4>
        <input type="text" id="chatNameInput" placeholder="Your Name" style="width:100%;padding:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);border-radius:12px;color:#fff;margin-bottom:10px;outline:none;">
        <input type="text" id="chatEmailInput" placeholder="Email" style="width:100%;padding:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);border-radius:12px;color:#fff;margin-bottom:10px;outline:none;">
        <button onclick="startChatSession()" style="width:100%;padding:12px;background:var(--gradient-glow);color:#000;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Start Chatting</button>
      </div>
    </div>
    <div class="chat-input-area" id="chatInputArea" style="display:none;padding:14px;border-top:1px solid var(--border);">
      <div style="display:flex;gap:8px;">
        <input type="text" id="chatMsgInput" placeholder="Type..." onkeypress="if(event.key==='Enter')sendChatMsg()" style="flex:1;padding:10px;border:1px solid var(--border);background:rgba(255,255,255,0.05);border-radius:12px;color:#fff;outline:none;">
        <button onclick="sendChatMsg()" style="width:40px;height:40px;border-radius:50%;background:var(--gradient-glow);color:#000;border:none;cursor:pointer;">➤</button>
      </div>
    </div>
  </div>

  ${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/${CONFIG.voice.welcome}" preload="none"></audio>` : ''}
  ${MANUAL_VOICE ? `<audio id="manualAudio" src="/${CONFIG.voice.manualAlert}" preload="none"></audio>` : ''}
  <audio id="musicAudio" preload="none"></audio>

  <script>window.__CONFIG__ = { profile: ${JSON.stringify(CONFIG.profile)}, tracks: ${JSON.stringify(songs)} };</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="/space.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    // Typing Animation
    const nameText = "${CONFIG.profile.name}";
    const bioText = "${CONFIG.profile.bio}";
    let iName = 0, iBio = 0;
    const speed = 50;
    function typeName() {
      if (iName < nameText.length) {
        document.getElementById("typeName").innerHTML += nameText.charAt(iName);
        iName++; setTimeout(typeName, speed);
      } else { document.getElementById("typeName").classList.remove("typing-text"); typeBio(); }
    }
    function typeBio() {
      if (iBio < bioText.length) {
        document.getElementById("typeBio").innerHTML += bioText.charAt(iBio);
        iBio++; setTimeout(typeBio, speed);
      } else { document.getElementById("typeBio").classList.remove("typing-text"); }
    }
    setTimeout(typeName, 500);

    // Audio
    var welcomeAudio = document.getElementById("welcomeAudio");
    var manualAudio = document.getElementById("manualAudio");
    var musicAudio = document.getElementById("musicAudio");
    function stopAllAudio() {
      if (welcomeAudio) { welcomeAudio.pause(); welcomeAudio.currentTime = 0; }
      if (manualAudio) { manualAudio.pause(); manualAudio.currentTime = 0; }
      if (musicAudio) { musicAudio.pause(); }
      musicPlaying = false; updatePlayBtn();
    }
    function playWelcomeVoice() { if (!welcomeAudio) return; stopAllAudio(); welcomeAudio.play(); }
    function playManualVoice() { if (!manualAudio) return; stopAllAudio(); manualAudio.play(); }
    var tracks = ${JSON.stringify(songs)};
    var currentTrack = 0;
    var musicPlaying = false;
    function updatePlayBtn() {
      var b = document.getElementById("mPlayBtn");
      if (b) b.innerHTML = musicPlaying ? "⏸" : "▶";
    }
    function updateMusicUI(i) {
      var t = document.getElementById("mTitle");
      if (t && tracks[i]) t.textContent = tracks[i].title;
      var items = document.querySelectorAll(".playlist-item");
      for (var j = 0; j < items.length; j++) { if (j === i) items[j].classList.add("active"); else items[j].classList.remove("active"); }
    }
    function playMusic(i) {
      if (!tracks.length) return;
      stopAllAudio();
      currentTrack = i;
      musicAudio.src = tracks[i].url;
      musicAudio.play(); musicPlaying = true; updatePlayBtn(); updateMusicUI(i);
    }
    function toggleMusic() {
      if (musicAudio.paused) {
        if (!musicAudio.src && tracks.length) musicAudio.src = tracks[0].url;
        stopAllAudio(); musicAudio.play(); musicPlaying = true; updatePlayBtn(); updateMusicUI(currentTrack);
      } else { musicAudio.pause(); musicPlaying = false; updatePlayBtn(); }
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
        var fill = document.getElementById("mSliderFill");
        var cur = document.getElementById("mCurrentTime");
        var dur = document.getElementById("mDuration");
        if (fill) fill.style.width = (musicAudio.currentTime / musicAudio.duration) * 100 + "%";
        if (cur) cur.textContent = formatTime(musicAudio.currentTime);
        if (dur) dur.textContent = formatTime(musicAudio.duration);
      }
    });
    musicAudio.addEventListener("ended", nextMusic);
    function formatTime(s) {
      if (isNaN(s)) return "0:00";
      return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    }
    if (welcomeAudio) setTimeout(function() { welcomeAudio.play().catch(e => {}); }, 1500);

    // Chat
    var socket = io();
    var chatUser = null;
    function toggleChat() {
      var p = document.getElementById("chatPanel");
      p.style.display = p.style.display === "flex" ? "none" : "flex";
    }
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
        if (count === users.length) res.json(users);
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

// ==================== ADMIN PAGE (SIMPLE DASHBOARD) ====================
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Messenger | Baiilla Maach</title>
  <link rel="stylesheet" href="/styles.css">
  ${THEME_CSS}
</head>
<body>
  <div class="login-overlay" id="loginOverlay">
    <div class="login-card">
      <h1>Admin Messenger</h1>
      <p class="sub">Baiilla Maach Support Panel</p>
      <input type="text" id="loginEmail" placeholder="Username" value="${CONFIG.admin.defaultEmail}">
      <input type="password" id="loginPassword" placeholder="Password" value="${CONFIG.admin.defaultPassword}">
      <button id="loginBtn" onclick="doLogin()">Sign In</button>
      <div class="error" id="loginError"></div>
    </div>
  </div>

  <div class="dashboard" id="app" style="display:none;">
    <aside class="dash-sidebar">
      <div class="dash-sidebar-head">
        <h2>Conversations</h2>
        <div class="sub">Baiilla Maach Admin</div>
      </div>
      <nav class="dash-nav">
        <button class="dash-nav-item active" onclick="showView('messages', this)"><span class="icon">💬</span> Messages</button>
        <button class="dash-nav-item" onclick="showView('users', this)"><span class="icon">👥</span> Users</button>
        <button class="dash-nav-item" onclick="showView('reports', this)"><span class="icon">🚨</span> Reports</button>
      </nav>
      <div style="padding:12px">
        <button class="btn btn-secondary btn-block" onclick="doLogout()">Sign out</button>
      </div>
    </aside>

    <main class="dash-content">
      <div class="dash-view active" id="view-messages">
        <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;height:calc(100vh - 80px)">
          <div style="background:rgba(15,22,56,0.7);border:1px solid rgba(120,150,255,0.15);border-radius:20px;overflow:hidden;display:flex;flex-direction:column">
            <div style="padding:12px;border-bottom:1px solid rgba(120,150,255,0.15)">
              <input type="text" id="searchInput" placeholder="Search users..." oninput="filterUsers()" style="width:100%;padding:10px 14px;border:1px solid rgba(120,150,255,0.15);background:rgba(255,255,255,0.05);border-radius:10px;color:#fff;outline:none;font-family:inherit">
            </div>
            <div id="userList" style="flex:1;overflow-y:auto"></div>
          </div>
          <div style="background:rgba(15,22,56,0.7);border:1px solid rgba(120,150,255,0.15);border-radius:20px;overflow:hidden;display:flex;flex-direction:column">
            <div style="padding:14px 20px;border-bottom:1px solid rgba(120,150,255,0.15);display:flex;align-items:center;gap:10px">
              <div id="chatAvatar" style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4A90FF,#9D6BFF);display:flex;align-items:center;justify-content:center;font-weight:700;color:white">?</div>
              <div>
                <div id="chatName" style="font-weight:600;font-size:14px;color:#fff">Select a conversation</div>
                <div id="chatStatus" style="font-size:12px;color:#6B7394">Offline</div>
              </div>
            </div>
            <div id="chatMessages" style="flex:1;overflow-y:auto;padding:20px">
              <div class="empty-state"><h3>No conversation selected</h3><p>Pick a user from the left</p></div>
            </div>
            <div id="chatInputArea" style="padding:12px;border-top:1px solid rgba(120,150,255,0.15);display:none">
              <div style="display:flex;gap:8px">
                <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()" style="flex:1;padding:10px 16px;border:1px solid rgba(120,150,255,0.15);background:rgba(255,255,255,0.05);border-radius:10px;color:#fff;outline:none;font-family:inherit">
                <button onclick="sendMessage()" style="padding:0 20px;background:linear-gradient(135deg,#4A90FF,#9D6BFF);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-view" id="view-users">
        <div style="margin-bottom:20px">
          <h1 style="font-size:24px;font-weight:800;color:#fff">Users</h1>
          <p style="color:#A8B0D8;font-size:14px">Everyone who has chatted with you</p>
        </div>
        <div id="usersList" style="background:rgba(15,22,56,0.7);border:1px solid rgba(120,150,255,0.15);border-radius:20px;overflow:hidden"></div>
      </div>

      <div class="dash-view" id="view-reports">
        <div style="margin-bottom:20px">
          <h1 style="font-size:24px;font-weight:800;color:#fff">Reports</h1>
          <p style="color:#A8B0D8;font-size:14px">Fake accounts reported by users</p>
        </div>
        <div id="reportsList" style="background:rgba(15,22,56,0.7);border:1px solid rgba(120,150,255,0.15);border-radius:20px;overflow:hidden"></div>
      </div>
    </main>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="/space.js"></script>
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
      btn.disabled = true; btn.textContent = "Signing...";
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
          document.getElementById("app").style.display = "flex";
          loadUsers();
          loadReports();
          setInterval(function() { if (isLoggedIn) loadUsers(); }, 10000);
        } else {
          err.textContent = "❌ Invalid credentials"; err.style.display = "block";
        }
      } catch(ex) {
        err.textContent = "❌ Network error"; err.style.display = "block";
      }
      btn.disabled = false; btn.textContent = "Sign In";
    }

    async function loadUsers() {
      if (!isLoggedIn) return;
      try {
        var r = await fetch("/api/admin/users");
        allUsers = await r.json();
        renderUserList();
        renderUsersView();
      } catch(e) { console.log("Error:", e); }
    }

    async function loadReports() {
      if (!isLoggedIn) return;
      try {
        var r = await fetch("/api/admin/reports");
        var reports = await r.json();
        renderReports(reports);
      } catch(e) { console.log("Error:", e); }
    }

    function renderUserList() {
      var s = document.getElementById("searchInput").value.toLowerCase();
      var f = allUsers.filter(function(u) { return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s); });
      var h = "";
      for (var i = 0; i < f.length; i++) {
        var u = f[i];
        var a = currentUser && currentUser.email === u.email;
        h += '<div class="row-item' + (a ? " active" : "") + '" onclick="selectUser(\'' + u.email + '\')">' +
          '<div class="row-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4A90FF,#9D6BFF);color:white;border-radius:50%;font-weight:700;font-size:14px">' + u.name.charAt(0).toUpperCase() + '</div>' +
          '<div class="row-info"><div class="row-title">' + u.name + '</div><div class="row-subtitle">' + u.email + '</div></div>' +
          (u.unreadCount > 0 ? '<div class="chip chip-danger">' + u.unreadCount + '</div>' : "") +
          '</div>';
      }
      document.getElementById("userList").innerHTML = h || '<div class="empty-state"><p>No users yet</p></div>';
    }

    function renderUsersView() {
      var el = document.getElementById("usersList");
      if (!allUsers.length) { el.innerHTML = '<div class="empty-state"><p>No users yet</p></div>'; return; }
      el.innerHTML = allUsers.map(function(u) {
        return '<div class="row-item">' +
          '<div class="row-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4A90FF,#9D6BFF);color:white;border-radius:50%;font-weight:700;font-size:14px">' + u.name.charAt(0).toUpperCase() + '</div>' +
          '<div class="row-info"><div class="row-title">' + u.name + '</div><div class="row-subtitle">' + u.email + ' · ' + (u.isOnline ? 'Online' : 'Offline') + '</div></div>' +
          '</div>';
      }).join('');
    }

    function renderReports(reports) {
      var el = document.getElementById("reportsList");
      if (!reports.length) { el.innerHTML = '<div class="empty-state"><h3>No reports</h3><p>When users report fake accounts, they will appear here</p></div>'; return; }
      el.innerHTML = reports.map(function(r) {
        return '<div class="row-item">' +
          '<div class="row-info">' +
          '<div class="row-title">' + (r.fakeAccount || 'Unknown') + '</div>' +
          '<div class="row-subtitle">' + (r.platform || '') + ' · ' + (r.reason || '') + '</div>' +
          '<div class="row-subtitle" style="margin-top:4px">Reported by ' + (r.reporterName || 'Anonymous') + '</div>' +
          '</div>' +
          '<div class="chip chip-danger">' + (r.status || 'pending') + '</div>' +
          '</div>';
      }).join('');
    }

    function filterUsers() { renderUserList(); }

    async function selectUser(e) {
      var u = allUsers.find(function(u) { return u.email === e; });
      if (!u) return;
      currentUser = u;
      document.getElementById("chatAvatar").textContent = u.name.charAt(0).toUpperCase();
      document.getElementById("chatName").textContent = u.name;
      document.getElementById("chatStatus").textContent = u.isOnline ? "● Online" : "● Offline";
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
      i.value = ""; i.focus();
    }

    function showView(name, btn) {
      document.querySelectorAll(".dash-view").forEach(function(v) { v.classList.remove("active"); });
      var v = document.getElementById("view-" + name);
      if (v) v.classList.add("active");
      document.querySelectorAll(".dash-nav-item").forEach(function(n) { n.classList.remove("active"); });
      if (btn) btn.classList.add("active");
      if (name === "reports") loadReports();
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
    document.getElementById("loginPassword").addEventListener("keypress", function(e) {
      if (e.key === "Enter") doLogin();
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
        io.emit('newMsg', {
          id: this.lastID, sender: data.sender, receiver: data.receiver,
          message: data.message, type: data.type || 'text', timestamp: timestamp
        });
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
  console.log('🔧 Admin: http://localhost:' + PORT + '/admin');
  console.log('👤 User: ' + CONFIG.admin.defaultEmail + ' | 🔑 Pass: ' + CONFIG.admin.defaultPassword);
  console.log('========================================');
});

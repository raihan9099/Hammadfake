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
app.use('/client.js', express.static(path.join(__dirname, 'client.js'), { maxAge: 604800000 }));
app.use('/admin.js', express.static(path.join(__dirname, 'admin.js'), { maxAge: 604800000 }));

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
  <link rel="stylesheet" href="/styles.css">
  ${themeVars}
</head>
<body>
  <header class="header">
    <div class="header-left">
      <img src="${CONFIG.profile.avatar}" class="header-logo" alt="Logo">
      <span class="header-name">Baiilla Maach</span>
    </div>
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
      <h2 class="profile-name" id="typeName"></h2>
      <div class="profile-username">${CONFIG.profile.username}</div>
      <div class="profile-bio" id="typeBio"></div>

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
    window.__CONFIG__ = {
      profile: ${JSON.stringify(CONFIG.profile)},
      tracks: ${songsJSON}
    };
  </script>
  <script src="/client.js"></script>
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
  <script src="/admin.js"></script>
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
  console.log('🔧 Admin: http://localhost:' + PORT + '/admin');
  console.log('========================================');
});

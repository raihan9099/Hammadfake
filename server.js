// server.js — Premium single-dashboard system
require('dotenv').config();
process.on('uncaughtException', (e) => console.error('Uncaught:', e.message));
process.on('unhandledRejection', (e) => console.error('Rejection:', e));

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
const io = socketIO(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const PORT = process.env.PORT || CONFIG.server.port || 3000;

/* ==================== MIDDLEWARE ==================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/assets', express.static('assets', { maxAge: 604800000 }));
app.use('/uploads', express.static('uploads', { maxAge: 604800000 }));
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css')));
app.use('/client.js', express.static(path.join(__dirname, 'client.js')));
app.use('/admin.js', express.static(path.join(__dirname, 'admin.js')));

app.use(session({
  secret: CONFIG.server.sessionSecret,
  resave: false, saveUninitialized: false,
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

/* ==================== DATABASE ==================== */
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('❌ SQLite:', err.message);
  else console.log('✅ SQLite connected');
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
      db.run(`UPDATE users SET password = ? WHERE email = ?`, [hash, CONFIG.admin.defaultEmail]);
    }
  });
});

/* ==================== HELPERS ==================== */
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

const THEME_CSS = `<style>:root{
  --c-primary:${THEME.colors.primary};--c-secondary:${THEME.colors.secondary};
  --c-accent:${THEME.colors.accent};--c-danger:${THEME.colors.danger};
  --c-success:${THEME.colors.success};--c-warning:${THEME.colors.warning};
  --c-dark:${THEME.colors.dark};--c-light:${THEME.colors.light};
  --c-text:${THEME.colors.textPrimary};--c-text2:${THEME.colors.textSecondary};
  --c-muted:${THEME.colors.textMuted};--c-border:${THEME.colors.border};
  --c-border-light:${THEME.colors.borderLight};
}</style>`;

/* ==================== PUBLIC PROFILE ==================== */
app.get('/', (req, res) => {
  const songs = getSongs();

  const songsListHTML = songs.map((s, i) => `
    <div class="playlist-item" onclick="playMusic(${i})" id="song-${i}">
      <span class="playlist-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="playlist-info">
        <div class="playlist-title">${s.title}</div>
        <div class="playlist-artist">Baiilla Maach</div>
      </div>
      <span style="color:var(--text-tertiary);font-size:11px">▶</span>
    </div>`).join('');

  const fakeCardsHTML = CONFIG.fakeAccounts.map(f => `
    <div class="row-item" style="cursor:default">
      <img src="${f.image}" class="row-avatar" style="border-radius:8px" alt="">
      <div class="row-info">
        <div class="row-title">${f.username}</div>
        <div class="row-subtitle">📍 ${f.platform} · ${f.reason}</div>
      </div>
      <a href="${f.url}" target="_blank" class="btn btn-sm btn-danger">Report</a>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baiilla Maach — Official</title>
  ${THEME_CSS}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="header">
    <div class="header-left">
      <img src="${CONFIG.profile.avatar}" class="header-logo" alt="">
      <span class="header-name">Baiilla Maach</span>
    </div>
  </header>

  <main class="public-wrap">
    <div class="profile-card">
      <div class="profile-cover"></div>
      <div class="profile-avatar-wrap">
        <img src="${CONFIG.profile.avatar}" class="profile-avatar" alt="">
      </div>
      <div class="profile-body">
        <h1 class="profile-name">${CONFIG.profile.name}</h1>
        <div class="profile-username">${CONFIG.profile.username} <span style="color:var(--primary);font-weight:600">✓</span></div>
        <p class="profile-bio">${CONFIG.profile.bio}</p>

        <div class="profile-stats">
          <div class="stat"><span class="stat-num">${CONFIG.stats.tiktokFollowers}</span><span class="stat-label">Followers</span></div>
          <div class="stat"><span class="stat-num">${CONFIG.stats.following}</span><span class="stat-label">Following</span></div>
          <div class="stat"><span class="stat-num">${CONFIG.stats.tiktokLikes}</span><span class="stat-label">Likes</span></div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="${CONFIG.links.tiktok}" target="_blank" class="btn btn-primary" style="flex:1">Follow TikTok</a>
          <a href="${CONFIG.links.facebook}" target="_blank" class="btn btn-secondary" style="flex:1">Follow Facebook</a>
        </div>
      </div>
    </div>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="section-title">Verified Accounts</div>
          <div class="section-sub">The only authentic accounts</div>
        </div>
        <span class="chip chip-success">Official</span>
      </div>
      <div>
        <div class="row-item">
          <img src="${ASSETS.profile}" class="row-avatar" alt="">
          <div class="row-info">
            <div class="row-title">TikTok ✓</div>
            <div class="row-subtitle">${CONFIG.profile.username} · ${CONFIG.stats.tiktokFollowers} followers</div>
          </div>
          <a href="${CONFIG.links.tiktok}" target="_blank" class="btn btn-sm btn-secondary">View</a>
        </div>
        <div class="row-item">
          <img src="${ASSETS.fbProfile}" class="row-avatar" alt="">
          <div class="row-info">
            <div class="row-title">Facebook ✓</div>
            <div class="row-subtitle">@BaiillaMaachOfficial · ${CONFIG.stats.facebookFollowers} followers</div>
          </div>
          <a href="${CONFIG.links.facebook}" target="_blank" class="btn btn-sm btn-secondary">View</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="section-title">Fake Accounts</div>
          <div class="section-sub">Report these if you see them</div>
        </div>
        <span class="chip chip-danger">Warning</span>
      </div>
      <div>${fakeCardsHTML}</div>
    </section>

    ${songs.length > 0 ? `
    <div class="player" id="musicPlayer">
      <div class="player-head">
        <img src="${ASSETS.playGif}" class="player-cover" id="mCover" alt="">
        <div class="player-meta">
          <div class="player-title" id="mTitle">Select a song</div>
          <div class="player-sub">Baiilla Maach</div>
        </div>
      </div>
      <div class="player-progress" onclick="seekMusic(event)">
        <div class="player-progress-fill" id="mFill"></div>
      </div>
      <div class="player-times">
        <span id="mCur">0:00</span>
        <span id="mDur">0:00</span>
      </div>
      <div class="player-controls">
        <button class="player-btn" onclick="prevMusic()">⏮</button>
        <button class="player-btn player-btn-primary" id="mPlayBtn" onclick="toggleMusic()">▶</button>
        <button class="player-btn" onclick="nextMusic()">⏭</button>
      </div>
      <div class="playlist">${songsListHTML}</div>
    </div>` : ''}
  </main>

  <button class="chat-fab" onclick="toggleChat()">💬</button>
  <div class="chat-panel" id="chatPanel">
    <div class="chat-head">
      Chat Support
      <button onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-body" id="chatBody">
      <div class="chat-login" id="chatLoginForm">
        <h4>Start a conversation</h4>
        <input type="text" id="chatNameInput" placeholder="Your name">
        <input type="text" id="chatEmailInput" placeholder="Email or phone">
        <button onclick="startChatSession()">Start Chat</button>
      </div>
    </div>
    <div class="chat-input-area" id="chatInputArea">
      <div class="chat-input-row">
        <input type="text" id="chatMsgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
        <button onclick="sendChatMsg()">➤</button>
      </div>
    </div>
  </div>

  ${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/${CONFIG.voice.welcome}" preload="none"></audio>` : ''}
  ${MANUAL_VOICE ? `<audio id="manualAudio" src="/${CONFIG.voice.manualAlert}" preload="none"></audio>` : ''}
  <audio id="musicAudio" preload="none"></audio>

  <script>
    window.__CONFIG__ = {
      profile: ${JSON.stringify(CONFIG.profile)},
      tracks: ${JSON.stringify(songs)}
    };
  </script>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/client.js"></script>
</body>
</html>`;

  res.send(html);
});

/* ==================== API ==================== */
app.get('/api/msgs/:email', (req, res) => {
  const email = req.params.email;
  db.all(`SELECT * FROM messages WHERE (sender = ? AND receiver = 'admin') OR (sender = 'admin' AND receiver = ?) ORDER BY timestamp ASC`,
    [email, email],
    (err, rows) => { if (err) return res.json([]); res.json(rows); });
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

app.get('/api/admin/stats', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const stats = {};
  db.get(`SELECT COUNT(*) as c FROM users WHERE isAdmin = 0`, (e, r) => {
    stats.users = r ? r.c : 0;
    db.get(`SELECT COUNT(*) as c FROM messages`, (e2, r2) => {
      stats.messages = r2 ? r2.c : 0;
      db.get(`SELECT COUNT(*) as c FROM reports`, (e3, r3) => {
        stats.reports = r3 ? r3.c : 0;
        db.get(`SELECT COUNT(*) as c FROM users WHERE isOnline = 1`, (e4, r4) => {
          stats.online = r4 ? r4.c : 0;
          res.json(stats);
        });
      });
    });
  });
});

app.get('/api/admin/users', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  db.all(`SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC`, [], (err, users) => {
    if (err) return res.json([]);
    let count = 0;
    if (users.length === 0) return res.json([]);
    users.forEach(u => {
      db.get(`SELECT COUNT(*) as c FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0`,
        [u.email], (err2, result) => {
          u.unreadCount = result ? result.c : 0;
          count++;
          if (count === users.length) res.json(users);
        });
    });
  });
});

app.get('/api/admin/reports', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  db.all(`SELECT * FROM reports ORDER BY createdAt DESC`, [], (err, rows) => {
    if (err) return res.json([]);
    res.json(rows);
  });
});

app.post('/api/report', (req, res) => {
  const { reporterName, reporterEmail, fakeAccount, platform, reason } = req.body;
  db.run(`INSERT INTO reports (reporterName, reporterEmail, fakeAccount, platform, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [reporterName, reporterEmail, fakeAccount, platform, reason, new Date().toISOString()],
    function (err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ success: true, report: { id: this.lastID } });
    });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    res.json({
      url: '/uploads/' + req.file.filename,
      name: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

/* ==================== ADMIN DASHBOARD ==================== */
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Baiilla Maach</title>
  ${THEME_CSS}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="login-overlay" id="loginOverlay">
    <div class="login-card">
      <h1>Welcome back</h1>
      <p class="sub">Sign in to your dashboard</p>
      <input type="text" id="loginEmail" placeholder="Email" value="${CONFIG.admin.defaultEmail}">
      <input type="password" id="loginPassword" placeholder="Password" value="${CONFIG.admin.defaultPassword}">
      <button id="loginBtn" onclick="doLogin()">Sign in</button>
      <div class="error" id="loginError"></div>
    </div>
  </div>

  <div class="dashboard" id="dashboard">
    <aside class="dash-sidebar" id="dashSidebar">
      <div class="dash-sidebar-head">
        <h2>Baiilla Maach</h2>
        <div class="sub">Admin dashboard</div>
      </div>
      <nav class="dash-nav">
        <button class="dash-nav-item active" onclick="showView('overview', this)">
          <span class="icon">📊</span> Overview
        </button>
        <button class="dash-nav-item" onclick="showView('messages', this)">
          <span class="icon">💬</span> Messages
          <span class="badge-count" id="navUnread" style="display:none">0</span>
        </button>
        <button class="dash-nav-item" onclick="showView('music', this)">
          <span class="icon">🎵</span> Music
        </button>
        <button class="dash-nav-item" onclick="showView('reports', this)">
          <span class="icon">🚨</span> Reports
        </button>
        <button class="dash-nav-item" onclick="showView('users', this)">
          <span class="icon">👥</span> Users
        </button>
        <button class="dash-nav-item" onclick="showView('settings', this)">
          <span class="icon">⚙️</span> Settings
        </button>
      </nav>
      <div class="dash-sidebar-foot">
        <button class="btn btn-secondary btn-block" onclick="doLogout()">Sign out</button>
      </div>
    </aside>

    <main class="dash-content">
      <!-- Overview -->
      <div class="dash-view active" id="view-overview">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">Overview</h1>
            <p class="dash-subtitle">Your account at a glance</p>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-label">Total Users</div>
            <div class="stat-card-value" id="statUsers">—</div>
            <div class="stat-card-sub" id="statOnline">— online now</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">Messages</div>
            <div class="stat-card-value" id="statMessages">—</div>
            <div class="stat-card-sub">all time</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">Reports</div>
            <div class="stat-card-value" id="statReports">—</div>
            <div class="stat-card-sub">pending review</div>
          </div>
        </div>

        <div class="data-card">
          <div class="data-head">
            <h3>Recent users</h3>
            <button class="btn btn-sm btn-secondary" onclick="showView('users', document.querySelectorAll('.dash-nav-item')[4])">View all</button>
          </div>
          <div id="recentUsersList">
            <div class="empty-state"><p>Loading...</p></div>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div class="dash-view" id="view-messages">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">Messages</h1>
            <p class="dash-subtitle">Chat with your users</p>
          </div>
        </div>
        <div class="messages-view">
          <div class="msg-sidebar" id="msgSidebar">
            <div class="msg-search">
              <input type="text" id="msgSearch" placeholder="Search users..." oninput="renderMsgUsers()">
            </div>
            <div class="msg-users" id="msgUsers">
              <div class="empty-state"><p>Loading...</p></div>
            </div>
          </div>
          <div class="msg-main" id="msgMain">
            <div class="msg-main-head">
              <div class="avatar" id="msgAvatar">?</div>
              <div>
                <div class="name" id="msgName">Select a conversation</div>
                <div class="status" id="msgStatus">—</div>
              </div>
            </div>
            <div class="msg-thread" id="msgThread">
              <div class="empty-state">
                <div class="icon">💬</div>
                <h3>No conversation selected</h3>
                <p>Pick a user from the left to start chatting</p>
              </div>
            </div>
            <div class="msg-compose" id="msgCompose" style="display:none">
              <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
              <button onclick="sendMessage()">Send</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Music -->
      <div class="dash-view" id="view-music">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">Music</h1>
            <p class="dash-subtitle">Manage your cover songs</p>
          </div>
        </div>
        <div class="data-card">
          <div class="data-head">
            <h3>Songs list</h3>
            <a href="/" target="_blank" class="btn btn-sm btn-secondary">View public page</a>
          </div>
          <div id="musicList">
            <div class="empty-state"><p>Loading...</p></div>
          </div>
        </div>
      </div>

      <!-- Reports -->
      <div class="dash-view" id="view-reports">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">Reports</h1>
            <p class="dash-subtitle">Fake accounts reported by users</p>
          </div>
        </div>
        <div class="data-card">
          <div class="data-head"><h3>All reports</h3></div>
          <div id="reportsList">
            <div class="empty-state"><p>Loading...</p></div>
          </div>
        </div>
      </div>

      <!-- Users -->
      <div class="dash-view" id="view-users">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">Users</h1>
            <p class="dash-subtitle">Everyone who has chatted with you</p>
          </div>
        </div>
        <div class="data-card">
          <div class="data-head"><h3>All users</h3></div>
          <div id="usersList">
            <div class="empty-state"><p>Loading...</p></div>
          </div>
        </div>
      </div>

      <!-- Settings -->
      <div class="dash-view" id="view-settings">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">Settings</h1>
            <p class="dash-subtitle">Update your public profile</p>
          </div>
        </div>
        <div class="data-card">
          <div class="data-head"><h3>Profile</h3></div>
          <div class="section-body" style="padding:20px">
            <div class="form-group">
              <label class="form-label">Display name</label>
              <input class="form-input" type="text" id="setName" value="${CONFIG.profile.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Username</label>
              <input class="form-input" type="text" id="setUsername" value="${CONFIG.profile.username}">
            </div>
            <div class="form-group">
              <label class="form-label">Bio</label>
              <input class="form-input" type="text" id="setBio" value="${CONFIG.profile.bio}">
            </div>
            <button class="btn btn-primary" onclick="saveSettings()">Save changes</button>
            <p class="form-help" style="margin-top:12px">Settings are saved in <code>config.js</code>. Edit manually to persist across deploys.</p>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/admin.js"></script>
</body>
</html>`);
});

/* ==================== SOCKET.IO ==================== */
io.on('connection', (socket) => {
  console.log('🔌 Socket connected');

  socket.on('register', (data) => {
    socket.userData = data;
    db.get(`SELECT * FROM users WHERE email = ?`, [data.email], async (err, user) => {
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
        db.run(`INSERT INTO users (name, email, password, isOnline, lastSeen) VALUES (?, ?, ?, 1, ?)`,
          [data.name, data.email, hash, new Date().toISOString()],
          (err) => {
            io.emit('userStatus', { email: data.email, online: true });
          });
      } else {
        db.run(`UPDATE users SET isOnline = 1, lastSeen = ? WHERE email = ?`,
          [new Date().toISOString(), data.email],
          () => io.emit('userStatus', { email: data.email, online: true }));
      }
    });
  });

  socket.on('sendMsg', (data) => {
    const timestamp = new Date().toISOString();
    db.run(`INSERT INTO messages (sender, receiver, message, type, fileUrl, fileName, fileSize, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.sender, data.receiver, data.message, data.type || 'text', data.fileUrl, data.fileName, data.fileSize, timestamp],
      function (err) {
        if (err) return console.error('Msg error:', err.message);
        io.emit('newMsg', {
          id: this.lastID, sender: data.sender, receiver: data.receiver,
          message: data.message, type: data.type || 'text', timestamp
        });
      });
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
        });
    }
  });
});

/* ==================== START ==================== */
server.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Dashboard: http://localhost:' + PORT + '/admin');
  console.log('========================================');
});

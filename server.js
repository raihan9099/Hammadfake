// server.js — Facebook-style UI, full-width, optimized
require('dotenv').config();

process.on('uncaughtException', (e) => console.error('Uncaught:', e));
process.on('unhandledRejection', (e) => console.error('Rejection:', e));

const CONFIG      = require('./config');
const THEME       = require('./theme');
const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const bcrypt      = require('bcryptjs');
const path        = require('path');
const fs          = require('fs');
const multer      = require('multer');
const session     = require('express-session');
const sqlite3     = require('sqlite3').verbose();
const compression = require('compression');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const PORT   = CONFIG.server.port || process.env.PORT || 3000;

/* ============================================================
   CORE MIDDLEWARE
============================================================ */
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const CACHE = 604800000; // 7 days
app.use('/assets',     express.static('assets',     { maxAge: CACHE, immutable: true }));
app.use('/uploads',    express.static('uploads',    { maxAge: CACHE, immutable: true }));
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css'), { maxAge: CACHE }));
app.use('/client.js',  express.static(path.join(__dirname, 'client.js'),  { maxAge: CACHE }));
app.use('/admin.js',   express.static(path.join(__dirname, 'admin.js'),   { maxAge: CACHE }));

app.use(session({
  secret: CONFIG.server.sessionSecret || 'change-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000, httpOnly: true, sameSite: 'lax' }
}));

/* ============================================================
   FILE UPLOAD
============================================================ */
const storage = multer.diskStorage({
  destination: (_req, _f, cb) => cb(null, 'uploads/'),
  filename:    (_req, f, cb) => cb(null, `${Date.now()}-${f.originalname.replace(/[^\w.\-]/g, '_')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => cb(null, /image|audio|video|pdf/.test(f.mimetype))
});

['uploads', 'assets/covermusic', 'assets/gallery'].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

/* ============================================================
   DATABASE
============================================================ */
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) return console.error('❌ SQLite:', err.message);
  console.log('✅ SQLite connected');
});

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    phone TEXT,
    avatar TEXT,
    isAdmin INTEGER DEFAULT 0,
    isVerified INTEGER DEFAULT 0,
    lastSeen TEXT,
    isOnline INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'text',
    fileUrl TEXT,
    fileName TEXT,
    fileSize INTEGER,
    seen INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_msg_pair   ON messages(sender, receiver)');
  db.run('CREATE INDEX IF NOT EXISTS idx_msg_unread ON messages(receiver, seen)');

  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporterName TEXT,
    reporterEmail TEXT,
    fakeAccount TEXT,
    platform TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    createdAt TEXT DEFAULT (datetime('now'))
  )`);

  db.get('SELECT id FROM users WHERE email = ? AND isAdmin = 1', [CONFIG.admin.defaultEmail], async (_e, row) => {
    const hash = await bcrypt.hash(CONFIG.admin.defaultPassword, 10);
    if (!row) {
      db.run('INSERT INTO users (name, email, password, isAdmin) VALUES (?,?,?,1)',
        ['Admin', CONFIG.admin.defaultEmail, hash], (err) => {
          if (!err) console.log('✅ Admin created');
        });
    } else {
      db.run('UPDATE users SET password = ? WHERE email = ?',
        [hash, CONFIG.admin.defaultEmail], (err) => {
          if (!err) console.log('✅ Admin password synced');
        });
    }
  });
});

const dbAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p,  (e, r) => e ? rej(e) : res(r)));
const dbGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p,  (e, r) => e ? rej(e) : res(r)));
const dbRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

/* ============================================================
   HELPERS
============================================================ */
const ASSETS        = CONFIG.assets;
const WELCOME_VOICE = fs.existsSync(CONFIG.voice.welcome);
const MANUAL_VOICE  = fs.existsSync(CONFIG.voice.manualAlert);

const escapeHTML = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function getSongs() {
  try {
    const dir = CONFIG.musicDir;
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.mp3'))
      .map((f, i) => ({
        id: i,
        title: f.replace('.mp3', '').replace(/[-_]/g, ' '),
        url: '/assets/covermusic/' + encodeURIComponent(f)
      }));
  } catch { return []; }
}

const THEME_CSS = (() => {
  const c = THEME.colors;
  const r = THEME.radius;
  const b = THEME.button;
  const t = THEME.typography;

  return `<style>:root{
    --primary:${c.primary};--secondary:${c.secondary};
    --danger:${c.danger};--success:${c.success};--warning:${c.warning};
    --dark:${c.dark};
    --bg-page:${c.light};--bg-card:${c.card};--bg-hover:${c.hover};
    --bg-input:${c.inputBg};--bg-active:${c.primaryLight};
    --text-primary:${c.textPrimary};--text-secondary:${c.textSecondary};--text-muted:${c.textMuted};
    --border:${c.border};--border-light:${c.borderLight};--divider:${c.divider};
    --radius-sm:${r.sm};--radius-md:${r.md};--radius-lg:${r.lg};--radius-xl:${r.xl};
    --radius-pill:${r.pill};--radius-round:${r.round};
    --btn-pad-y:${b.paddingY};--btn-pad-x:${b.paddingX};--btn-font:${b.fontSize};
    --btn-weight:${b.fontWeight};--btn-transition:${b.transition};
    --font:${t.fontFamily};--font-size:${t.sizeBase};--font-sm:${t.sizeSmall};
    --font-lg:${t.sizeLarge};--font-h1:${t.sizeH1};--font-h2:${t.sizeH2};--font-h3:${t.sizeH3};
    --line-height:${t.lineHeight};
    --shadow-sm:${THEME.shadows.sm};--shadow-md:${THEME.shadows.md};--shadow-lg:${THEME.shadows.lg};
  }</style>`;
})();

const HEAD = (title) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${THEME.colors.primary}">
<title>${escapeHTML(title)}</title>
<link rel="stylesheet" href="/styles.css">
${THEME_CSS}`;

/* ============================================================
   MAIN PAGE
============================================================ */
app.get('/', (_req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);

  const songsListHTML = songs.map((s, i) => `
    <div class="song-item" onclick="playMusic(${i})" id="song-${i}">
      <span class="song-num">${String(i + 1).padStart(2, '0')}</span>
      <img src="${ASSETS.playGif}" class="song-thumb" loading="lazy" alt="">
      <div class="song-info">
        <div class="song-title">${escapeHTML(s.title)}</div>
        <div class="song-artist">Baiilla Maach</div>
      </div>
      <span class="song-play">▶</span>
    </div>`).join('');

  const voiceHTML = (WELCOME_VOICE || MANUAL_VOICE) ? `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-gradient">VOICE</span>
        <h3>Voice Verification</h3>
        <p>Listen to authentic voice recordings</p>
      </div>
      <div class="card-body"><div class="btn-group">
        ${WELCOME_VOICE ? '<button class="btn btn-gradient" onclick="playWelcomeVoice()">🎤 Real Voice</button>' : ''}
        ${MANUAL_VOICE ? '<button class="btn btn-danger" onclick="playManualVoice()">🚨 Fake Alert</button>' : ''}
      </div></div>
    </div>` : '';

  const fakeCardsHTML = CONFIG.fakeAccounts.map((f) => `
    <div class="fake-card">
      <div class="fake-img-wrap">
        <img src="${f.image}" class="fake-img" loading="lazy" alt="">
        <img src="${ASSETS.fakeDetect}" class="fake-overlay" loading="lazy" alt="">
      </div>
      <div class="fake-body">
        <h4>${escapeHTML(f.username)}</h4>
        <div class="platform">📍 ${escapeHTML(f.platform)}</div>
        <p>${escapeHTML(f.reason)}</p>
        <a href="${f.url}" target="_blank" rel="noopener" class="btn btn-danger btn-sm">🚨 Report</a>
      </div>
    </div>`).join('');

  const html = `${HEAD('Baiilla Maach Official | Hammad Bin Amir')}
<body class="page-home">
  <header class="header">
    <div class="header-left">
      <img src="${CONFIG.profile.avatar}" class="header-logo" alt="Logo">
      <span class="header-name">Baiilla Maach</span>
    </div>
  </header>

  <main class="container container-full">
    <div class="card profile-card">
      <div class="profile-cover"></div>
      <div class="profile-avatar-wrap">
        <img src="${CONFIG.profile.avatar}" class="profile-avatar" alt="Profile">
        <div class="verified-badge">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
      </div>
      <h2 class="profile-name" id="typeName"></h2>
      <div class="profile-username">${escapeHTML(CONFIG.profile.username)}</div>
      <div class="profile-bio" id="typeBio"></div>

      <div class="stats-row">
        <div class="stat"><div class="stat-num">${CONFIG.stats.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
        <div class="stat"><div class="stat-num">${CONFIG.stats.following}</div><div class="stat-label">Following</div></div>
        <div class="stat"><div class="stat-num">${CONFIG.stats.tiktokLikes}</div><div class="stat-label">Likes</div></div>
      </div>

      <div class="btn-group">
        <a href="${CONFIG.links.tiktok}" target="_blank" rel="noopener" class="btn btn-gradient">
          <img src="${ASSETS.logoTikTok}" width="18" alt="" loading="lazy"> Follow TikTok
        </a>
        <a href="${CONFIG.links.facebook}" target="_blank" rel="noopener" class="btn btn-gradient">
          <img src="${ASSETS.logoFB}" width="18" alt="" loading="lazy"> Follow Facebook
        </a>
      </div>

      <div class="gif-strip">
        <div class="gif-item"><img src="${ASSETS.followGif}" alt="" loading="lazy"><span>Follow</span></div>
        <div class="gif-item"><img src="${ASSETS.addGif}"    alt="" loading="lazy"><span>Add</span></div>
        <div class="gif-item"><img src="${ASSETS.playGif}"   alt="" loading="lazy"><span>Play</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="badge badge-success">OFFICIAL</span>
        <h3>Verified Accounts</h3>
        <p>The only authentic accounts</p>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="verified-item">
            <img src="${ASSETS.profile}" class="v-avatar" alt="" loading="lazy">
            <div class="v-info">
              <h4>TikTok <img src="${ASSETS.blueTikTok}" alt="" loading="lazy"></h4>
              <div class="v-handle">${escapeHTML(CONFIG.profile.username)}</div>
              <div class="v-detail">✓ Active · <strong>${CONFIG.stats.tiktokFollowers}</strong> Followers · <strong>${CONFIG.stats.tiktokLikes}</strong> Likes</div>
              <a href="${CONFIG.links.tiktok}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Follow</a>
            </div>
          </div>
          <div class="verified-item">
            <img src="${ASSETS.fbProfile}" class="v-avatar" alt="" loading="lazy">
            <div class="v-info">
              <h4>Facebook <img src="${ASSETS.blueFB}" alt="" loading="lazy"></h4>
              <div class="v-handle">@BaiillaMaachOfficial</div>
              <div class="v-detail">✓ Active · <strong>${CONFIG.stats.facebookFollowers}</strong> Followers</div>
              <a href="${CONFIG.links.facebook}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Follow</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="badge badge-danger">WARNING</span>
        <h3>Fake Accounts Detected</h3>
        <p>Report these accounts</p>
      </div>
      <div class="card-body"><div class="grid-2">${fakeCardsHTML}</div></div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="badge badge-gradient">PROOF</span>
        <h3>Identity Verification</h3>
      </div>
      <div class="card-body">
        <div class="proof-grid proof-grid-single">
          <div class="proof-item">
            <img src="${ASSETS.realId}" alt="Real ID" loading="lazy">
            <div class="label">Real ID Verified</div>
          </div>
        </div>
      </div>
    </div>

    ${voiceHTML}

    ${songs.length ? `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-gradient">MUSIC</span>
        <h3>Cover Songs</h3>
      </div>
      <div class="music-section">
        <div class="music-header">
          <img src="${ASSETS.playGif}" class="music-cover" id="mCover" alt="" loading="lazy">
          <div class="music-info">
            <div class="music-title" id="mTitle">Select Song</div>
            <div class="music-artist">Baiilla Maach</div>
          </div>
        </div>
        <div class="music-slider" onclick="seekMusic(event)">
          <div class="music-slider-fill" id="mSliderFill"></div>
        </div>
        <div class="music-time-row">
          <span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span>
        </div>
        <div class="music-controls">
          <button class="music-btn music-btn-nav"  onclick="prevMusic()">⏮</button>
          <button class="music-btn music-btn-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
          <button class="music-btn music-btn-nav"  onclick="nextMusic()">⏭</button>
        </div>
        <div class="music-list">${songsListHTML}</div>
      </div>
    </div>` : ''}
  </main>

  <div class="chat-widget"><button class="chat-toggle" onclick="toggleChat()">💬</button></div>
  <div class="chat-panel" id="chatPanel">
    <div class="chat-head">💬 Chat Support <button onclick="toggleChat()">✕</button></div>
    <div class="chat-body" id="chatBody">
      <div class="chat-login" id="chatLoginForm">
        <h4 style="margin-bottom:16px">Start Chat</h4>
        <input type="text" id="chatNameInput"  placeholder="Your Name">
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
</body></html>`;

  res.send(html);
});

/* ============================================================
   API ROUTES
============================================================ */
app.get('/api/msgs/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const rows = await dbAll(
      `SELECT * FROM messages
       WHERE (sender = ? AND receiver = 'admin')
          OR (sender = 'admin' AND receiver = ?)
       ORDER BY timestamp ASC`, [email, email]);
    res.json(rows);
  } catch (err) { console.error(err); res.json([]); }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = await dbGet('SELECT * FROM users WHERE email = ? AND isAdmin = 1', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok)  return res.status(401).json({ error: 'Invalid credentials' });
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.isAdmin    = true;
      req.session.adminEmail = email;
      res.json({ success: true });
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/users', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const users = await dbAll(`
      SELECT u.*, IFNULL(m.unread, 0) AS unreadCount
      FROM users u
      LEFT JOIN (
        SELECT sender, COUNT(*) AS unread
        FROM messages
        WHERE receiver = 'admin' AND seen = 0
        GROUP BY sender
      ) m ON m.sender = u.email
      WHERE u.isAdmin = 0
      ORDER BY u.lastSeen DESC`, []);
    res.json(users);
  } catch (err) { console.error(err); res.json([]); }
});

app.post('/api/report', async (req, res) => {
  try {
    const { reporterName, reporterEmail, fakeAccount, platform, reason } = req.body || {};
    const r = await dbRun(
      'INSERT INTO reports (reporterName, reporterEmail, fakeAccount, platform, reason) VALUES (?,?,?,?,?)',
      [reporterName, reporterEmail, fakeAccount, platform, reason]);
    res.json({ success: true, report: { id: r.lastID } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/reports', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try { res.json(await dbAll('SELECT * FROM reports ORDER BY createdAt DESC', [])); }
  catch (err) { console.error(err); res.json([]); }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({
      url:  '/uploads/' + req.file.filename,
      name: req.file.originalname,
      size: req.file.size
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Upload failed' }); }
});

/* ============================================================
   ADMIN PAGE
============================================================ */
app.get('/admin', (req, res) => {
  res.send(`${HEAD('Admin Messenger | Baiilla Maach')}
<body class="page-admin">
  <div class="login-overlay" id="loginOverlay">
    <div class="login-card">
      <h2>Admin Messenger</h2>
      <p class="sub">Baiilla Maach Support Panel</p>
      <input type="text"     id="loginEmail"    placeholder="Username" value="${escapeHTML(CONFIG.admin.defaultEmail)}">
      <input type="password" id="loginPassword" placeholder="Password" value="${escapeHTML(CONFIG.admin.defaultPassword)}">
      <button id="loginBtn" onclick="doLogin()">Sign In</button>
      <div class="error" id="loginError"></div>
    </div>
  </div>

  <div class="app" id="app">
    <div class="layout layout-full">
      <aside class="sidebar">
        <div class="sidebar-head">
          <h2>Conversations</h2>
          <button onclick="doLogout()">Logout</button>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="Search..." oninput="filterUsers()">
        </div>
        <div class="user-list" id="userList">
          <div class="empty-state"><p>Loading users...</p></div>
        </div>
      </aside>
      <section class="chat-area">
        <div class="chat-head">
          <div class="avatar" id="chatAvatar">?</div>
          <div>
            <div class="name" id="chatName">Select a conversation</div>
            <div class="status offline" id="chatStatus">Offline</div>
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
      </section>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/admin.js"></script>
</body></html>`);
});

/* ============================================================
   SOCKET.IO
============================================================ */
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('register', async (data) => {
    if (!data?.email) return;
    socket.userData = data;
    try {
      const user = await dbGet('SELECT id FROM users WHERE email = ?', [data.email]);
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
        await dbRun(
          'INSERT INTO users (name, email, password, isOnline, lastSeen) VALUES (?,?,?,1,?)',
          [data.name, data.email, hash, new Date().toISOString()]);
      } else {
        await dbRun('UPDATE users SET isOnline = 1, lastSeen = ? WHERE email = ?',
          [new Date().toISOString(), data.email]);
      }
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) { console.error('register:', err.message); }
  });

  socket.on('sendMsg', async (data) => {
    if (!data?.sender || !data?.receiver) return;
    const ts = new Date().toISOString();
    try {
      const r = await dbRun(
        `INSERT INTO messages (sender, receiver, message, type, fileUrl, fileName, fileSize, timestamp)
         VALUES (?,?,?,?,?,?,?,?)`,
        [data.sender, data.receiver, data.message, data.type || 'text',
         data.fileUrl || null, data.fileName || null, data.fileSize || null, ts]);
      io.emit('newMsg', {
        id: r.lastID,
        sender: data.sender, receiver: data.receiver,
        message: data.message, type: data.type || 'text', timestamp: ts
      });
    } catch (err) { console.error('sendMsg:', err.message); }
  });

  socket.on('markRead', async (data) => {
    if (!data?.user) return;
    try { await dbRun(`UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = 'admin' AND seen = 0`, [data.user]); }
    catch (err) { console.error('markRead:', err.message); }
  });

  socket.on('disconnect', async () => {
    if (!socket.userData?.email) return;
    try {
      await dbRun('UPDATE users SET isOnline = 0, lastSeen = ? WHERE email = ?',
        [new Date().toISOString(), socket.userData.email]);
      io.emit('userStatus', { email: socket.userData.email, online: false });
      console.log('🔴 Offline:', socket.userData.email);
    } catch (err) { console.error('disconnect:', err.message); }
  });
});

/* ============================================================
   START
============================================================ */
server.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Admin:  http://localhost:' + PORT + '/admin');
  console.log('========================================');
});

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
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
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

    CREATE TABLE IF NOT EXISTS chat_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_room_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roomId INTEGER NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roomId) REFERENCES chat_rooms(id)
    );

    CREATE TABLE IF NOT EXISTS chat_room_members (
        roomId INTEGER NOT NULL,
        userEmail TEXT NOT NULL,
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (roomId, userEmail),
        FOREIGN KEY (roomId) REFERENCES chat_rooms(id)
    );
`);

console.log('SQLite Database Ready');

const adminHash = bcrypt.hashSync('admin123', 10);
const userHash = bcrypt.hashSync('ok@123', 10);

const adminExists = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get('admin');
const userExists = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 0').get('baillamach');

if (adminExists) {
    db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(adminHash, 'Admin', 'admin');
    console.log('Admin Updated');
} else {
    db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('Admin', 'admin', adminHash);
    console.log('Admin Created');
}

if (!userExists) {
    db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 0)').run('Baiilla Maach', 'baillamach', userHash);
    console.log('User Created');
}

console.log('Admin Login: admin / admin123');
console.log('User Login: baillamach / ok@123');

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
    } catch (e) {
        return [];
    }
}

app.get('/login', (req, res) => {
    const loginHTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Login - Baiilla Maach</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f0f2f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .login-container {
            background: #ffffff;
            border-radius: 8px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.1);
        }
        .logo { text-align: center; margin-bottom: 20px; }
        .logo h1 { color: #1877f2; font-size: 28px; font-weight: 700; margin-bottom: 5px; }
        .logo p { color: #606770; font-size: 14px; }
        .form-group { margin-bottom: 15px; }
        .form-group input {
            width: 100%; padding: 14px 16px; border: 1px solid #dddfe2;
            border-radius: 6px; font-size: 16px; color: #1d2129; outline: none;
        }
        .form-group input:focus { border-color: #1877f2; box-shadow: 0 0 0 2px rgba(24, 119, 242, 0.2); }
        .login-btn {
            width: 100%; padding: 14px; background: #1877f2; color: #ffffff;
            border: none; border-radius: 6px; font-size: 18px; font-weight: 700;
            cursor: pointer;
        }
        .login-btn:hover { background: #166fe5; }
        .login-btn:disabled { background: #6ea8f7; cursor: not-allowed; }
        .error { color: #ff0000; font-size: 13px; margin-top: 10px; display: none; text-align: center; }
        .divider { border-top: 1px solid #dadde1; margin: 20px 0; }
        .meta-link { text-align: center; }
        .meta-link a { color: #606770; font-size: 12px; text-decoration: none; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>Baiilla Maach</h1>
            <p>Official Account Login</p>
        </div>
        <form onsubmit="return handleLogin(event)">
            <div class="form-group">
                <input type="text" id="username" placeholder="Username" required>
            </div>
            <div class="form-group">
                <input type="password" id="password" placeholder="Password" required>
            </div>
            <button type="submit" class="login-btn" id="loginBtn">Log In</button>
            <div class="error" id="error">Invalid username or password</div>
        </form>
        <div class="divider"></div>
        <div class="meta-link">
            <a href="/">Back to Home</a>
        </div>
    </div>
    <script>
        async function handleLogin(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const error = document.getElementById('error');
            const btn = document.getElementById('loginBtn');
            error.style.display = 'none';
            if (!username || !password) return;
            btn.disabled = true;
            btn.textContent = 'Logging in...';
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: username, password: password })
                });
                const data = await response.json();
                if (data.success) {
                    window.location.href = data.redirect || '/';
                } else {
                    error.style.display = 'block';
                }
            } catch (err) {
                error.textContent = 'Connection error';
                error.style.display = 'block';
            }
            btn.disabled = false;
            btn.textContent = 'Log In';
        }
    </script>
</body>
</html>`;
    res.send(loginHTML);
});

app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        db.prepare('UPDATE users SET lastSeen = datetime("now"), isOnline = 1 WHERE email = ?').run(email);
        res.json({ 
            success: true, 
            redirect: user.isAdmin ? '/messenger' : '/',
            user: { name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/chat/rooms', (req, res) => {
    try {
        const rooms = db.prepare('SELECT * FROM chat_rooms ORDER BY createdAt DESC').all();
        res.json(rooms);
    } catch (err) { res.json([]); }
});

app.get('/api/chat/room/:id', (req, res) => {
    try {
        const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(req.params.id);
        const members = db.prepare('SELECT userEmail FROM chat_room_members WHERE roomId = ?').all(req.params.id);
        const messages = db.prepare('SELECT * FROM chat_room_messages WHERE roomId = ? ORDER BY timestamp ASC LIMIT 100').all(req.params.id);
        res.json({ room, members, messages });
    } catch (err) { res.json({ room: null, members: [], messages: [] }); }
});

app.post('/api/chat/room', (req, res) => {
    try {
        const { name, createdBy } = req.body;
        const result = db.prepare('INSERT INTO chat_rooms (name, createdBy) VALUES (?, ?)').run(name, createdBy);
        db.prepare('INSERT INTO chat_room_members (roomId, userEmail) VALUES (?, ?)').run(result.lastInsertRowid, createdBy);
        res.json({ success: true, roomId: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/chat/room/:id/join', (req, res) => {
    try {
        const { userEmail } = req.body;
        const exists = db.prepare('SELECT * FROM chat_room_members WHERE roomId = ? AND userEmail = ?').get(req.params.id, userEmail);
        if (!exists) {
            db.prepare('INSERT INTO chat_room_members (roomId, userEmail) VALUES (?, ?)').run(req.params.id, userEmail);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/', (req, res) => {
    const songs = getSongs();
    const songsJSON = JSON.stringify(songs);

    let songsListHTML = '';
    songs.forEach((s, i) => {
        songsListHTML += `
        <div class="song-item" onclick="playTrack(${i})" id="song-${i}">
            <span class="song-num">${String(i + 1).padStart(2, '0')}</span>
            <div class="song-thumb-box">
                <img src="/assets/play.gif" class="song-thumb" id="st-${i}">
                <img src="/assets/play.gif" class="song-thumb-live" id="sl-${i}" style="display:none">
            </div>
            <div class="song-meta">
                <div class="song-name">${s.title}</div>
                <div class="song-by">Baiilla Maach</div>
            </div>
            <div class="song-eq" id="eq-${i}" style="display:none">
                <span></span><span></span><span></span>
            </div>
        </div>`;
    });

    const html = `<!doctype html>
<html lang="bn">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>Baiilla Maach Official | Hammad Bin Amir</title>
    <style>
        :root {
            --bg-primary: #f0f2f5;
            --bg-secondary: #ffffff;
            --text-primary: #1c1e21;
            --text-secondary: #65676b;
            --text-muted: #8a8d91;
            --accent: #1877f2;
            --accent-hover: #166fe5;
            --accent-light: #e7f3ff;
            --border: #dadde1;
            --border-light: #e4e6eb;
            --success: #31a24c;
            --danger: #fa383e;
            --warning: #f57c00;
            --radius: 8px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Bengali", sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; display: block; }

        .container { max-width: 1080px; margin: 0 auto; padding: 0 16px; }

        .header {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            gap: 16px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 24px;
            color: var(--accent);
        }

        .brand-icon {
            width: 36px;
            height: 36px;
            background: var(--accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            font-weight: 700;
        }

        .nav-links { display: flex; gap: 8px; }

        .nav-link {
            padding: 8px 16px;
            border-radius: var(--radius);
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 14px;
            transition: background 0.2s;
        }

        .nav-link:hover { background: var(--accent-light); color: var(--accent); text-decoration: none; }
        .nav-link.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }

        .header-actions { display: flex; gap: 8px; align-items: center; }

        .icon-btn {
            width: 40px; height: 40px;
            border-radius: 50%;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--text-primary);
            transition: background 0.2s;
            position: relative;
        }

        .icon-btn:hover { background: var(--bg-primary); }

        .chat-notification {
            position: absolute;
            top: -2px; right: -2px;
            background: var(--danger);
            color: white;
            font-size: 10px;
            width: 18px; height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            display: none;
        }

        .hero {
            background: var(--bg-secondary);
            border-radius: var(--radius);
            padding: 32px;
            margin: 16px 0;
            text-align: center;
            border: 1px solid var(--border);
        }

        .avatar-container {
            position: relative;
            display: inline-block;
            margin-bottom: 16px;
        }

        .avatar {
            width: 120px; height: 120px;
            border-radius: 50%;
            border: 3px solid var(--accent);
            object-fit: cover;
        }

        .verified-badge {
            position: absolute;
            bottom: 4px; right: 4px;
            width: 28px; height: 28px;
            background: var(--accent);
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .verified-badge svg { width: 14px; height: 14px; fill: white; }

        .hero-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .hero-subtitle { color: var(--text-secondary); font-size: 16px; margin-bottom: 16px; }

        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 48px;
            padding: 16px 0;
            border-top: 1px solid var(--border-light);
            border-bottom: 1px solid var(--border-light);
            margin: 20px 0;
        }

        .stat-item { text-align: center; }
        .stat-number { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; }

        .action-buttons {
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 16px;
        }

        .btn {
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
        }

        .btn-primary { background: var(--accent); color: white; }
        .btn-primary:hover { background: var(--accent-hover); text-decoration: none; }
        .btn-secondary { background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #e4e6eb; text-decoration: none; }
        .btn-danger { background: #fff; color: var(--danger); border: 1px solid #ffcdd2; }
        .btn-danger:hover { background: #ffebee; text-decoration: none; }

        .btn-gif-icon { width: 20px; height: 20px; object-fit: contain; }

        .content-grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
            margin: 16px 0 32px;
        }

        .card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
        }

        .card-body { padding: 20px; }
        .card-full { grid-column: 1 / -1; }
        .card-title { font-size: 18px; font-weight: 700; margin: 12px 0; }
        .text-secondary { color: var(--text-secondary); font-size: 14px; }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .badge-verified { background: var(--accent-light); color: var(--accent); }
        .badge-warning { background: #ffebee; color: var(--danger); }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .verified-list { display: grid; gap: 12px; margin-top: 16px; }

        .verified-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: var(--bg-primary);
            border-radius: var(--radius);
        }

        .verified-avatar {
            width: 48px; height: 48px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--accent);
        }

        .verified-info h4 { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
        .verified-info h4 img { width: 16px; height: 16px; }
        .verified-handle { font-size: 12px; color: var(--text-secondary); }
        .verified-detail { font-size: 12px; color: var(--text-primary); margin-top: 4px; }

        /* Fake Account Cards */
        .fake-card {
            border: 1px solid #ffcdd2;
            border-radius: var(--radius);
            overflow: hidden;
            background: var(--bg-secondary);
        }

        .fake-image-container {
            position: relative;
            text-align: center;
            padding: 12px;
            background: var(--bg-primary);
        }

        .fake-image {
            width: 100%;
            border-radius: 4px;
        }

        .fake-overlay-image {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 70px;
            height: 70px;
            animation: bounceWarning 1.5s ease-in-out infinite;
            pointer-events: none;
        }

        @keyframes bounceWarning {
            0%, 100% { transform: translate(-50%, -50%) translateY(0); }
            50% { transform: translate(-50%, -50%) translateY(-12px); }
        }

        .fake-body { padding: 12px; }

        .fake-body h4 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--danger);
        }

        .platform {
            color: var(--warning);
            font-weight: 600;
            font-size: 12px;
            margin-bottom: 4px;
        }

        .fake-body .text-secondary {
            margin-bottom: 12px;
        }

        .report-section {
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #ffcdd2;
        }

        .report-section img {
            width: 80px;
            margin: 0 auto 8px;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        /* Real Voice Section */
        .voice-section {
            margin-top: 12px;
        }

        .voice-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        /* Proof Section */
        .proof-container { text-align: center; padding: 20px; }
        .proof-image { width: 100%; border-radius: 4px; border: 1px solid var(--border-light); }

        /* Music Player */
        .music-header {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px;
            background: var(--bg-primary);
            border-radius: var(--radius);
            margin-bottom: 16px;
        }

        .music-cover {
            width: 56px; height: 56px;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }

        .music-cover img {
            width: 100%; height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0; left: 0;
        }

        .cover-live { display: none; }

        .music-info { flex: 1; min-width: 0; }
        .music-title { font-weight: 600; font-size: 16px; }
        .music-artist { font-size: 14px; color: var(--text-secondary); }

        .seek-bar {
            width: 100%; height: 4px;
            background: var(--border);
            border-radius: 2px;
            cursor: pointer;
            margin: 12px 0;
        }

        .seek-fill {
            height: 100%;
            background: var(--accent);
            border-radius: 2px;
            width: 0;
            transition: width 0.1s;
        }

        .time-display {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }

        .player-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
        }

        .ctrl-btn {
            width: 40px; height: 40px;
            border-radius: 50%;
            border: 1px solid var(--border);
            background: var(--bg-secondary);
            color: var(--text-primary);
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .ctrl-btn:hover { background: var(--bg-primary); }

        .ctrl-btn-play {
            width: 56px; height: 56px;
            background: var(--accent);
            border: none;
            position: relative;
            overflow: hidden;
        }

        .ctrl-btn-play:hover { background: var(--accent-hover); }

        .ctrl-btn-play img {
            width: 34px; height: 34px;
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
        }

        .song-list {
            max-height: 240px;
            overflow-y: auto;
            border-top: 1px solid var(--border-light);
            margin-top: 16px;
            padding-top: 8px;
        }

        .song-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.15s;
        }

        .song-item:hover { background: var(--bg-primary); }
        .song-item.active { background: var(--accent-light); }

        .song-num { font-weight: 600; color: var(--text-muted); min-width: 24px; font-size: 13px; }

        .song-thumb-box {
            width: 32px; height: 32px;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }

        .song-thumb-box img {
            width: 100%; height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0; left: 0;
        }

        .song-meta { flex: 1; min-width: 0; }
        .song-name { font-weight: 500; font-size: 14px; }
        .song-by { font-size: 12px; color: var(--text-secondary); }

        .song-eq {
            margin-left: auto;
            display: flex;
            align-items: flex-end;
            gap: 2px;
            height: 14px;
        }

        .song-eq span {
            width: 3px;
            background: var(--accent);
            border-radius: 1px;
            animation: equalizer 0.8s ease-in-out infinite;
        }

        .song-eq span:nth-child(1) { animation-delay: 0s; }
        .song-eq span:nth-child(2) { animation-delay: 0.15s; }
        .song-eq span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes equalizer {
            0%, 100% { height: 4px; }
            50% { height: 12px; }
        }

        /* Chat Panel */
        .chat-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .chat-overlay.open { display: flex; }

        .chat-container {
            background: var(--bg-secondary);
            border-radius: var(--radius);
            width: 95%;
            max-width: 480px;
            height: 85vh;
            max-height: 650px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .chat-header {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--accent);
            color: white;
            border-radius: var(--radius) var(--radius) 0 0;
        }

        .chat-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .chat-header-left img {
            width: 28px;
            height: 28px;
            border-radius: 50%;
        }

        .chat-header-left h3 { font-size: 16px; font-weight: 600; }

        .chat-close {
            background: none;
            border: none;
            color: white;
            font-size: 22px;
            cursor: pointer;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
        }

        .chat-close:hover { background: rgba(255, 255, 255, 0.2); }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: var(--bg-primary);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .chat-login-area {
            text-align: center;
            padding: 30px 20px;
        }

        .chat-login-area h4 { margin-bottom: 12px; font-size: 16px; }
        .chat-login-area input {
            width: 100%;
            padding: 10px;
            margin-bottom: 8px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 14px;
        }

        .chat-message-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .chat-message-row.own { flex-direction: row-reverse; }

        .chat-msg-avatar {
            width: 30px; height: 30px;
            border-radius: 50%;
            background: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 12px;
            flex-shrink: 0;
        }

        .chat-bubble-wrap {
            max-width: 75%;
            position: relative;
        }

        .chat-bubble {
            padding: 10px 14px;
            border-radius: 18px;
            font-size: 13px;
            word-wrap: break-word;
            position: relative;
        }

        .chat-message-row:not(.own) .chat-bubble {
            background: white;
            border: 1px solid var(--border);
            border-bottom-left-radius: 4px;
        }

        .chat-message-row.own .chat-bubble {
            background: var(--accent);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .chat-bubble img.msg-gif {
            width: 35px;
            height: 35px;
            position: absolute;
            bottom: -8px;
            pointer-events: none;
        }

        .chat-message-row:not(.own) .msg-gif { left: -14px; }
        .chat-message-row.own .msg-gif { right: -14px; }

        .chat-msg-time {
            font-size: 10px;
            opacity: 0.6;
            margin-top: 2px;
            text-align: right;
        }

        .chat-input-area {
            padding: 12px 16px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
            border-radius: 0 0 var(--radius) var(--radius);
        }

        .chat-input-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .chat-input-row input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: 13px;
            outline: none;
            background: var(--bg-primary);
            color: var(--text-primary);
        }

        .chat-input-row input:focus { border-color: var(--accent); }

        .chat-input-row button {
            width: 38px; height: 38px;
            border-radius: 50%;
            background: var(--accent);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .chat-input-row button:hover { background: var(--accent-hover); }

        /* Footer */
        .footer {
            background: var(--bg-secondary);
            border-top: 1px solid var(--border);
            padding: 24px 0;
            margin-top: 32px;
        }

        .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }

        .footer-text { font-size: 12px; color: var(--text-muted); }
        .footer-links { display: flex; gap: 16px; flex-wrap: wrap; }
        .footer-links a { font-size: 12px; color: var(--text-muted); }
        .footer-links a:hover { color: var(--text-primary); }

        @media (max-width: 768px) {
            .hero { padding: 20px; }
            .hero-title { font-size: 22px; }
            .stats-bar { gap: 24px; }
            .content-grid { grid-template-columns: 1fr; }
            .nav-links { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
        }
    </style>
</head>
<body>

    <header class="header">
        <div class="container header-content">
            <div class="brand">
                <div class="brand-icon">B</div>
                <span>Baiilla Maach</span>
            </div>

            <nav class="nav-links">
                <a href="#home" class="nav-link active">Home</a>
                <a href="#verified" class="nav-link">Verified</a>
                <a href="#music" class="nav-link">Music</a>
                <a href="#chat" class="nav-link" onclick="openChat()">Chat</a>
            </nav>

            <div class="header-actions">
                <button class="icon-btn" onclick="openChat()" title="Community Chat">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
                    </svg>
                    <span class="chat-notification" id="chatNotification">0</span>
                </button>
                <a href="/messenger" class="icon-btn" title="Admin Panel">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                </a>
            </div>
        </div>
    </header>

    <main class="container">

        <section class="hero" id="home">
            <div class="avatar-container">
                <img src="/assets/celebrity_pfp.jpeg" class="avatar" onerror="this.style.display='none'" alt="Profile">
                <div class="verified-badge">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
            </div>
            <h1 class="hero-title">Hammad Bin Amir</h1>
            <p class="hero-subtitle">@baiillamaach_official - Official Entertainment Profile - Verified Creator</p>
            
            <div class="stats-bar">
                <div class="stat-item">
                    <div class="stat-number">7K</div>
                    <div class="stat-label">Followers</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Following</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">190K</div>
                    <div class="stat-label">Likes</div>
                </div>
            </div>

            <div class="action-buttons">
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-primary">
                    <img src="/assets/follow.gif" class="btn-gif-icon" alt="Follow">
                    <span style="font-weight: 700;">Follow Official</span>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-secondary">
                    <img src="/assets/add.gif" class="btn-gif-icon" alt="Add">
                    <span style="font-weight: 700;">Follow Now Official</span>
                </a>
            </div>
        </section>

        <div class="content-grid" id="verified">
            <!-- Verified Accounts Card -->
            <div class="card">
                <div class="card-body">
                    <span class="badge badge-verified">
                        <span class="badge-dot"></span> OFFICIAL
                    </span>
                    <h3 class="card-title">Verified Accounts</h3>
                    <p class="text-secondary">The only authentic accounts</p>
                    
                    <div class="verified-list">
                        <div class="verified-item">
                            <img src="/assets/celebrity_pfp.jpeg" class="verified-avatar" alt="TikTok Profile">
                            <div class="verified-info">
                                <h4>TikTok <img src="/assets/bluetick_tiktok.png" alt="Verified"></h4>
                                <div class="verified-handle">@baiillamaach_official</div>
                                <div class="verified-detail">Active - 7K Followers - 190K Likes</div>
                            </div>
                        </div>
                        <div class="verified-item">
                            <img src="/assets/fb_profile.jpg" class="verified-avatar" alt="Facebook Profile">
                            <div class="verified-info">
                                <h4>Facebook <img src="/assets/blue_tick_fb.png" alt="Verified"></h4>
                                <div class="verified-handle">@BaiillaMaachOfficial</div>
                                <div class="verified-detail">Active - Official Page</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Fake Accounts Card -->
            <div class="card">
                <div class="card-body">
                    <span class="badge badge-warning">
                        <span class="badge-dot"></span> WARNING
                    </span>
                    <h3 class="card-title">Fake Accounts</h3>
                    <p class="text-secondary">Report these impersonators</p>
                    
                    <div class="verified-list">
                        <!-- Fake Account 1 -->
                        <div class="fake-card">
                            <div class="fake-image-container">
                                <img src="/assets/baillamach_fake.png" class="fake-image" alt="Fake Account">
                                <img src="/assets/Fakedetect_updown.png" class="fake-overlay-image" alt="Fake Alert">
                            </div>
                            <div class="fake-body">
                                <h4>@baiilla_mach</h4>
                                <div class="platform">TikTok - Fake Account</div>
                                <p class="text-secondary">Copies official content and impersonates</p>
                                <div class="report-section">
                                    <img src="/assets/report.gif" alt="Report">
                                    <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-danger" style="display:block;text-align:center;margin-top:8px;">
                                        Report This Fake Account
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- Fake Account 2 -->
                        <div class="fake-card">
                            <div class="fake-image-container">
                                <img src="/assets/hammadfams.png" class="fake-image" alt="Fake Account">
                                <img src="/assets/Fakedetect_updown.png" class="fake-overlay-image" alt="Fake Alert">
                            </div>
                            <div class="fake-body">
                                <h4>@hammad_fams0</h4>
                                <div class="platform">TikTok - Fake Account</div>
                                <p class="text-secondary">Impersonating account with false identity</p>
                                <div class="report-section">
                                    <img src="/assets/report.gif" alt="Report">
                                    <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-danger" style="display:block;text-align:center;margin-top:8px;">
                                        Report This Fake Account
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Real ID Verified Card -->
            <div class="card">
                <div class="card-body">
                    <span class="badge badge-verified">
                        <span class="badge-dot"></span> VERIFIED
                    </span>
                    <h3 class="card-title">Real ID Verified</h3>
                    <div class="proof-container">
                        <img src="/assets/real-id-ss.png" class="proof-image" alt="ID Proof">
                        <p style="margin-top:12px;color:var(--success);font-weight:700;">Official Government ID Verified</p>
                    </div>
                </div>
            </div>

            <!-- Voice Verification Card -->
            <div class="card">
                <div class="card-body">
                    <span class="badge badge-verified">
                        <span class="badge-dot"></span> VOICE VERIFICATION
                    </span>
                    <h3 class="card-title">Voice Authentication</h3>
                    <p class="text-secondary">Listen to authentic voice samples</p>
                    <div class="voice-section">
                        <div class="voice-buttons">
                            <button class="btn btn-primary" onclick="playRealVoice()">
                                <img src="/assets/microphone-in-hand.gif" width="18"> Real Voice
                            </button>
                            <button class="btn btn-danger" onclick="playFakeAlert()">
                                <img src="/assets/report_button.png" width="16"> Fake Alert
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${songs.length > 0 ? `
        <div class="card card-full" id="music" style="margin-bottom:24px;">
            <div class="card-body">
                <span class="badge badge-verified">
                    <span class="badge-dot"></span> MUSIC
                </span>
                <h3 class="card-title">Cover Songs</h3>
                
                <div class="music-header">
                    <div class="music-cover">
                        <img src="/assets/play.gif" class="cover-static" id="coverStatic" alt="Cover">
                        <img src="/assets/play.gif" class="cover-live" id="coverLive" alt="Playing">
                    </div>
                    <div class="music-info">
                        <div class="music-title" id="nowPlaying">Select a song</div>
                        <div class="music-artist">Baiilla Maach</div>
                    </div>
                </div>
                
                <div class="seek-bar" onclick="seekTrack(event)">
                    <div class="seek-fill" id="seekFill"></div>
                </div>
                
                <div class="time-display">
                    <span id="currentTime">0:00</span>
                    <span id="totalTime">0:00</span>
                </div>
                
                <div class="player-controls">
                    <button class="ctrl-btn" onclick="prevTrack()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <button class="ctrl-btn ctrl-btn-play" id="playBtn" onclick="togglePlay()">
                        <img src="/assets/play.gif" id="playGif" alt="Play">
                    </button>
                    <button class="ctrl-btn" onclick="nextTrack()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                </div>
                
                <div class="song-list">
                    ${songsListHTML}
                </div>
            </div>
        </div>` : ''}

    </main>

    <!-- Chat Overlay -->
    <div class="chat-overlay" id="chatOverlay">
        <div class="chat-container">
            <div class="chat-header">
                <div class="chat-header-left">
                    <img src="/assets/message_bubble.gif" alt="Chat">
                    <h3>Community Chat</h3>
                </div>
                <button class="chat-close" onclick="closeChat()">&times;</button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="chat-login-area" id="chatLoginArea">
                    <h4>Join the Conversation</h4>
                    <input type="text" id="chatNameInput" placeholder="Your Name">
                    <input type="text" id="chatEmailInput" placeholder="Your Email">
                    <button class="btn btn-primary" onclick="joinChat()" style="width:100%;margin-top:8px;">Join Chat</button>
                </div>
            </div>
            <div class="chat-input-area" id="chatInputArea" style="display:none;">
                <div class="chat-input-row">
                    <input type="text" id="chatMessageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendChatMessage()">
                    <button onclick="sendChatMessage()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <footer class="footer">
        <div class="container footer-content">
            <div class="footer-text">2026 Baiilla Maach Official. All rights reserved.</div>
            <nav class="footer-links">
                <a href="#privacy">Privacy</a>
                <a href="#terms">Terms</a>
                <a href="#contact">Contact</a>
            </nav>
        </div>
    </footer>

    <audio id="realVoice" src="/assets/realvoice.mp3" preload="auto"></audio>
    <audio id="fakeVoice" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>
    <audio id="player" preload="auto"></audio>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Music Player
        var player = document.getElementById("player");
        var tracks = ${songsJSON};
        var currentTrack = -1;
        var isPlaying = false;

        function stopAllAudio() {
            var realVoice = document.getElementById("realVoice");
            var fakeVoice = document.getElementById("fakeVoice");
            if (realVoice) { realVoice.pause(); realVoice.currentTime = 0; }
            if (fakeVoice) { fakeVoice.pause(); fakeVoice.currentTime = 0; }
            if (player) { player.pause(); }
            setPlayingState(false);
        }

        function playRealVoice() {
            var audio = document.getElementById("realVoice");
            if (!audio) return;
            stopAllAudio();
            audio.play();
        }

        function playFakeAlert() {
            var audio = document.getElementById("fakeVoice");
            if (!audio) return;
            stopAllAudio();
            audio.play();
        }

        function setPlayingState(playing) {
            isPlaying = playing;
            var playGif = document.getElementById("playGif");
            var playBtn = document.getElementById("playBtn");
            if (playGif && playBtn) {
                playBtn.style.background = playing ? "#166fe5" : "#1877f2";
                playGif.style.opacity = playing ? "0.3" : "1";
            }
            var coverStatic = document.getElementById("coverStatic");
            var coverLive = document.getElementById("coverLive");
            if (coverStatic && coverLive) {
                coverStatic.style.display = playing ? "none" : "block";
                coverLive.style.display = playing ? "block" : "none";
            }
            syncPlaylistUI();
        }

        function syncPlaylistUI() {
            var items = document.querySelectorAll(".song-item");
            for (var j = 0; j < items.length; j++) {
                var item = items[j];
                var staticThumb = document.getElementById("st-" + j);
                var liveThumb = document.getElementById("sl-" + j);
                var eq = document.getElementById("eq-" + j);
                if (j === currentTrack) {
                    item.classList.add("active");
                    if (isPlaying) {
                        if (staticThumb) staticThumb.style.display = "none";
                        if (liveThumb) liveThumb.style.display = "block";
                        if (eq) eq.style.display = "flex";
                    } else {
                        if (staticThumb) staticThumb.style.display = "block";
                        if (liveThumb) liveThumb.style.display = "none";
                        if (eq) eq.style.display = "none";
                    }
                } else {
                    item.classList.remove("active");
                    if (staticThumb) staticThumb.style.display = "block";
                    if (liveThumb) liveThumb.style.display = "none";
                    if (eq) eq.style.display = "none";
                }
            }
        }

        function playTrack(i) {
            if (!tracks.length || i < 0 || i >= tracks.length) return;
            stopAllAudio();
            currentTrack = i;
            player.src = tracks[i].url;
            document.getElementById("nowPlaying").textContent = tracks[i].title;
            player.play().then(function() { setPlayingState(true); }).catch(function() { setPlayingState(false); });
        }

        function togglePlay() {
            if (isPlaying) { player.pause(); setPlayingState(false); }
            else {
                if (!player.src && tracks.length) { currentTrack = 0; player.src = tracks[0].url; document.getElementById("nowPlaying").textContent = tracks[0].title; }
                player.play().then(function() { setPlayingState(true); }).catch(function() {});
            }
        }

        function prevTrack() { if (currentTrack < 0) currentTrack = 0; playTrack((currentTrack - 1 + tracks.length) % tracks.length); }
        function nextTrack() { if (currentTrack < 0) currentTrack = 0; playTrack((currentTrack + 1) % tracks.length); }

        function seekTrack(e) {
            if (!player.duration) return;
            var rect = e.currentTarget.getBoundingClientRect();
            player.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * player.duration;
        }

        player.addEventListener("timeupdate", function() {
            if (player.duration) {
                document.getElementById("seekFill").style.width = (player.currentTime / player.duration) * 100 + "%";
                document.getElementById("currentTime").textContent = formatTime(player.currentTime);
                document.getElementById("totalTime").textContent = formatTime(player.duration);
            }
        });
        player.addEventListener("ended", nextTrack);

        function formatTime(s) { if (isNaN(s)) return "0:00"; var m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ":" + String(sec).padStart(2, "0"); }
        if (tracks.length > 0) { document.getElementById("nowPlaying").textContent = tracks[0].title; }

        // Chat System
        var socket = io({ transports: ["websocket", "polling"] });
        var chatUser = null;
        var currentRoom = null;

        function openChat() {
            document.getElementById("chatOverlay").classList.add("open");
            loadChatRooms();
        }

        function closeChat() {
            document.getElementById("chatOverlay").classList.remove("open");
        }

        async function joinChat() {
            var name = document.getElementById("chatNameInput").value.trim();
            var email = document.getElementById("chatEmailInput").value.trim();
            if (!name || !email) return;
            chatUser = { name: name, email: email };
            socket.emit("register", { name: name, email: email });
            document.getElementById("chatLoginArea").style.display = "none";
            document.getElementById("chatInputArea").style.display = "block";
            loadChatRooms();
        }

        async function loadChatRooms() {
            try {
                var r = await fetch("/api/chat/rooms");
                var rooms = await r.json();
                if (rooms.length === 0) {
                    await fetch("/api/chat/room", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: "General Chat", createdBy: "admin" })
                    });
                    loadChatRooms();
                    return;
                }
                joinRoom(rooms[0].id);
            } catch (e) {}
        }

        async function joinRoom(roomId) {
            currentRoom = roomId;
            if (chatUser) {
                await fetch("/api/chat/room/" + roomId + "/join", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userEmail: chatUser.email })
                });
            }
            loadRoomMessages(roomId);
        }

        async function loadRoomMessages(roomId) {
            try {
                var r = await fetch("/api/chat/room/" + roomId);
                var data = await r.json();
                var container = document.getElementById("chatMessages");
                if (document.getElementById("chatLoginArea")) {
                    document.getElementById("chatLoginArea").style.display = chatUser ? "none" : "block";
                }
                var existing = container.querySelectorAll(".chat-message-row");
                existing.forEach(function(el) { el.remove(); });
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(function(msg) {
                        appendChatMessage(msg);
                    });
                }
                container.scrollTop = container.scrollHeight;
            } catch (e) {}
        }

        function appendChatMessage(msg) {
            var container = document.getElementById("chatMessages");
            var isOwn = chatUser && msg.sender === chatUser.email;
            var row = document.createElement("div");
            row.className = "chat-message-row" + (isOwn ? " own" : "");
            row.innerHTML = 
                '<div class="chat-msg-avatar">' + (msg.sender || "U").charAt(0).toUpperCase() + '</div>' +
                '<div class="chat-bubble-wrap">' +
                    '<div class="chat-bubble">' + msg.message + 
                        '<img src="/assets/message_bubble.gif" class="msg-gif" alt="">' +
                    '</div>' +
                    '<div class="chat-msg-time">' + new Date(msg.timestamp + "Z").toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) + '</div>' +
                '</div>';
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;
        }

        function sendChatMessage() {
            if (!chatUser || !currentRoom) return;
            var input = document.getElementById("chatMessageInput");
            var msg = input.value.trim();
            if (!msg) return;
            socket.emit("sendChatRoomMsg", {
                roomId: currentRoom,
                sender: chatUser.email,
                message: msg
            });
            input.value = "";
            input.focus();
        }

        socket.on("chatRoomMsg", function(msg) {
            if (currentRoom && msg.roomId === currentRoom) {
                appendChatMessage(msg);
            }
        });

        socket.on("connect", function() {
            if (chatUser) {
                socket.emit("register", { name: chatUser.name, email: chatUser.email });
            }
        });
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
        users.forEach(u => { 
            const c = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0").get(u.email); 
            u.unreadCount = c.count; 
        });
        res.json(users);
    } catch (err) { res.json([]); }
});

app.get('/messenger', (req, res) => {
    const adminHTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Admin Messenger | Baiilla Maach</title>
    <style>
        :root {
            --bg: #f0f2f5; --bg-card: #ffffff; --text: #1c1e21;
            --text-secondary: #65676b; --accent: #1877f2; --accent-hover: #166fe5;
            --border: #dadde1; --radius: 8px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; font-size: 14px; }
        .login-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .login-card { background: var(--bg-card); padding: 28px; border-radius: var(--radius); width: 100%; max-width: 380px; text-align: center; border: 1px solid var(--border); }
        .login-card h2 { font-weight: 700; margin-bottom: 4px; color: var(--accent); }
        .login-card .sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 18px; }
        .login-card input { width: 100%; padding: 11px; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; outline: none; background: var(--bg); color: var(--text); }
        .login-card input:focus { border-color: var(--accent); }
        .login-card button { width: 100%; padding: 11px; background: var(--accent); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 15px; }
        .login-card button:hover { background: var(--accent-hover); }
        .login-card button:disabled { opacity: 0.6; }
        .error { color: #fa383e; font-size: 12px; margin-top: 6px; display: none; }
        .app { display: none; height: 100vh; }
        .layout { display: flex; height: 100vh; max-width: 1400px; margin: 0 auto; background: var(--bg-card); border: 1px solid var(--border); }
        @media(max-width:767px) { .layout { flex-direction: column; } }
        .sidebar { width: 340px; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        @media(max-width:767px) { .sidebar { width: 100%; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--border); } }
        .sb-head { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .sb-head h2 { font-size: 16px; font-weight: 600; }
        .sb-head button { background: none; border: none; color: var(--accent); font-weight: 600; cursor: pointer; font-size: 13px; }
        .search-box { padding: 8px 14px; border-bottom: 1px solid var(--border); }
        .search-box input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 20px; font-size: 13px; outline: none; background: var(--bg); color: var(--text); }
        .user-list { flex: 1; overflow-y: auto; }
        .u-item { padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid var(--border); }
        .u-item:hover { background: var(--bg); }
        .u-item.active { background: #e7f3ff; }
        .u-ava { width: 38px; height: 38px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; }
        .u-info { flex: 1; min-width: 0; }
        .u-info .name { font-weight: 600; font-size: 13px; }
        .u-info .email { font-size: 12px; color: var(--text-secondary); }
        .unread { background: var(--accent); color: white; font-size: 11px; padding: 2px 7px; border-radius: 10px; font-weight: 600; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        @media(max-width:767px) { .chat-area { position: fixed; inset: 0; z-index: 100; display: none; } .chat-area.active { display: flex; } }
        .ch-head { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: var(--bg-card); }
        .back-btn { display: none; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--accent); }
        @media(max-width:767px) { .back-btn { display: block; } }
        .ch-ava { width: 34px; height: 34px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
        .ch-name { font-weight: 600; font-size: 14px; }
        .ch-status { font-size: 12px; color: var(--text-secondary); } .ch-status.online { color: #31a24c; }
        .ch-msgs { flex: 1; overflow-y: auto; padding: 14px; background: var(--bg); }
        .msg { max-width: 70%; padding: 8px 11px; border-radius: 16px; margin-bottom: 5px; font-size: 13px; word-wrap: break-word; }
        .msg.sent { background: var(--accent); color: white; margin-left: auto; border-bottom-right-radius: 4px; }
        .msg.received { background: var(--bg-card); color: var(--text); border-bottom-left-radius: 4px; border: 1px solid var(--border); }
        .msg .time { font-size: 10px; opacity: 0.7; margin-top: 2px; text-align: right; }
        .ch-input { padding: 10px 14px; border-top: 1px solid var(--border); display: none; background: var(--bg-card); }
        .ch-row { display: flex; align-items: center; gap: 8px; }
        .ch-row input { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 20px; font-size: 13px; outline: none; background: var(--bg); color: var(--text); }
        .ch-row button { background: var(--accent); color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
        .empty { text-align: center; color: var(--text-secondary); padding: 50px 20px; }
    </style>
</head>
<body>
<div class="login-overlay" id="lo"><div class="login-card">
<h2>Admin Messenger</h2><p class="sub">Support Panel</p>
<input type="text" id="le" placeholder="Username" value="admin">
<input type="password" id="lp" placeholder="Password" value="admin123">
<button id="lb" onclick="doLogin()">Sign In</button>
<div class="error" id="err"></div></div></div>

<div class="app" id="app"><div class="layout">
<div class="sidebar" id="sb"><div class="sb-head"><h2>Conversations</h2><button onclick="doLogout()">Logout</button></div>
<div class="search-box"><input type="text" id="sq" placeholder="Search..." oninput="filterUsers()"></div>
<div class="user-list" id="ul"><div class="empty"><p>Loading...</p></div></div></div>

<div class="chat-area" id="ca"><div class="ch-head"><button class="back-btn" onclick="goBack()">Back</button>
<div class="ch-ava" id="cav">?</div>
<div><div class="ch-name" id="cn">Select user</div><div class="ch-status" id="cs">Offline</div></div></div>
<div class="ch-msgs" id="cm"><div class="empty"><h3>No conversation</h3></div></div>
<div class="ch-input" id="ci"><div class="ch-row">
<input type="text" id="mi" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()">Send</button></div></div></div>
</div></div>

<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io({transports:["websocket","polling"]}),cu=null,au=[],li=false,iv=null;
socket.on("connect",function(){if(li)loadUsers()});
socket.on("newMsg",function(m){if(cu&&((m.sender===cu.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===cu.email)))appendMsg(m);loadUsers()});
socket.on("userStatus",function(d){if(cu&&cu.email===d.email){var s=document.getElementById("cs");s.textContent=d.online?"Online":"Offline";s.className="ch-status "+(d.online?"online":"")}loadUsers()});
async function doLogin(){var e=document.getElementById("le").value.trim(),p=document.getElementById("lp").value.trim(),er=document.getElementById("err"),bt=document.getElementById("lb");er.style.display="none";if(!e||!p){er.textContent="Fill all fields";er.style.display="block";return}bt.disabled=true;bt.textContent="...";
try{var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});if(r.ok){li=true;localStorage.setItem("ad",JSON.stringify({email:e,password:p}));document.getElementById("lo").style.display="none";document.getElementById("app").style.display="block";socket.emit("register",{name:"Admin",email:"admin"});loadUsers();iv=setInterval(loadUsers,8000)}else{er.textContent="Invalid credentials";er.style.display="block"}}catch(ex){er.textContent="Connection error";er.style.display="block"}bt.disabled=false;bt.textContent="Sign In"}
async function loadUsers(){if(!li)return;try{var r=await fetch("/api/admin/users");au=await r.json();renderUsers()}catch(e){}}
function renderUsers(){var s=document.getElementById("sq").value.toLowerCase(),f=au.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)}),h="";f.forEach(function(u){var a=cu&&cu.email===u.email;h+='<div class="u-item'+(a?" active":"")+'" onclick="selectUser(\\''+u.email+'\\')"><div class="u-ava">'+u.name.charAt(0).toUpperCase()+'</div><div class="u-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':"")+'</div>'});document.getElementById("ul").innerHTML=h||'<div class="empty"><p>No conversations</p></div>'}
function filterUsers(){renderUsers()}
async function selectUser(e){var u=au.find(function(u){return u.email===e});if(!u)return;cu=u;document.getElementById("cav").textContent=u.name.charAt(0).toUpperCase();document.getElementById("cn").textContent=u.name;document.getElementById("cs").textContent=u.isOnline?"Online":"Offline";document.getElementById("cs").className="ch-status "+(u.isOnline?"online":"");document.getElementById("ci").style.display="block";document.getElementById("ca").classList.add("active");if(window.innerWidth<768)document.getElementById("sb").style.display="none";
try{var r=await fetch("/api/msgs/"+encodeURIComponent(u.email)),ms=await r.json(),c=document.getElementById("cm");c.innerHTML="";if(!ms.length)c.innerHTML='<div class="empty"><h3>No messages</h3></div>';else ms.forEach(function(m){addMsg(m,c)});c.scrollTop=99999}catch(e){}socket.emit("markRead",{user:u.email});renderUsers()}
function addMsg(m,c){var s=m.sender==="admin",t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});c.innerHTML+='<div class="msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>'}
function appendMsg(m){if(!cu)return;var c=document.getElementById("cm");addMsg(m,c);c.scrollTop=99999}
function sendMessage(){if(!cu)return;var i=document.getElementById("mi"),m=i.value.trim();if(!m)return;socket.emit("sendMsg",{sender:"admin",receiver:cu.email,message:m,type:"text"});appendMsg({sender:"admin",receiver:cu.email,message:m,timestamp:new Date().toISOString()});i.value="";i.focus()}
function goBack(){document.getElementById("ca").classList.remove("active");document.getElementById("sb").style.display="flex";cu=null;document.getElementById("cm").innerHTML='<div class="empty"><h3>No conversation</h3></div>';document.getElementById("ci").style.display="none";renderUsers()}
function doLogout(){if(iv)clearInterval(iv);localStorage.removeItem("ad");li=false;location.reload()}
var saved=localStorage.getItem("ad");if(saved){var d=JSON.parse(saved);document.getElementById("le").value=d.email;document.getElementById("lp").value=d.password}
document.getElementById("lp").addEventListener("keypress",function(e){if(e.key==="Enter")doLogin()});
window.addEventListener("resize",function(){if(window.innerWidth>=768&&cu)document.getElementById("sb").style.display="flex"});
</script></body></html>`;
    res.send(adminHTML);
});

io.on('connection', (socket) => {
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
    
    socket.on('sendChatRoomMsg', (data) => {
        try {
            const r = db.prepare('INSERT INTO chat_room_messages (roomId, sender, message, type) VALUES (?, ?, ?, ?)').run(data.roomId, data.sender, data.message, data.type || 'text');
            const msg = db.prepare('SELECT * FROM chat_room_messages WHERE id = ?').get(r.lastInsertRowid);
            io.emit('chatRoomMsg', msg);
        } catch (err) {}
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
    console.log('Server: http://localhost:' + PORT);
    console.log('Admin: http://localhost:' + PORT + '/messenger');
    console.log('Login: http://localhost:' + PORT + '/login');
    console.log('Admin: admin / admin123');
    console.log('User: baillamach / ok@123');
    console.log('========================================');
});

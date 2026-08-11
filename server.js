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
`);

console.log('✅ SQLite Database Ready');

const adminExists = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get('admin');
const adminHash = bcrypt.hashSync('admin123', 10);

if (adminExists) {
    db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(adminHash, 'Admin', 'admin');
    console.log('✅ Admin Updated');
} else {
    db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('Admin', 'admin', adminHash);
    console.log('✅ Admin Created');
}

console.log('👤 Admin Login: admin / admin123');

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

    const hasRealVoice = fs.existsSync('assets/realvoice.mp3');
    const hasManualVoice = fs.existsSync('assets/manualvoice_alert.mp3');

    let voiceBlock = '';
    if (hasRealVoice || hasManualVoice) {
        voiceBlock = `
        <div class="card">
            <div class="card-body">
                <span class="pill"><span class="dot-neon"></span> VOICE VERIFICATION</span>
                <h3 style="margin-top:12px">Voice Authentication</h3>
                <p class="muted">Listen to authentic voice samples</p>
                <div class="cta">
                    ${hasRealVoice ? '<button class="btn" onclick="playRealVoice()"><img src="/assets/microphone-in-hand.gif" width="18"> Real Voice</button>' : ''}
                    ${hasManualVoice ? '<button class="btn ghost" onclick="playFakeAlert()"><img src="/assets/report_button.png" width="16"> Fake Alert</button>' : ''}
                </div>
            </div>
        </div>`;
    }

    const html = `<!doctype html>
<html lang="bn">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>Baiilla Maach Official | Hammad Bin Amir</title>
    <style>
        :root {
            --bg: #0b0f10;
            --bg-soft: #0f1417;
            --text: #e6f1ff;
            --muted: #9fb0c0;
            --neon: #39ff14;
            --neon-soft: #2bff1466;
            --card: #11171a;
            --border: #1c242a;
            --link: #9dffcc;
            --radius: 14px;
            --shadow: 0 0 22px var(--neon-soft), 0 0 4px var(--neon-soft);
            --container: min(1100px, 92vw);
        }

        :root.light {
            --bg: #ffffff;
            --bg-soft: #f6faf7;
            --text: #0a0b0c;
            --muted: #4a575f;
            --neon: #16a34a;
            --neon-soft: #16a34a44;
            --card: #ffffff;
            --border: #e4efe7;
            --link: #0d9488;
            --shadow: none;
        }

        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            background: var(--bg);
            color: var(--text);
            font: 400 clamp(14px, 1.6vw, 16px)/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans Bengali", "Bangla", sans-serif;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
        }
        a { color: var(--link); text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; display: block; }
        button { cursor: pointer; font-family: inherit; }
        .container { width: var(--container); margin-inline: auto; padding-inline: max(16px, env(safe-area-inset-left)); }

        header {
            position: sticky; top: 0; z-index: 50;
            background: color-mix(in oklab, var(--bg) 88%, transparent);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            padding-top: env(safe-area-inset-top);
        }

        .nav {
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto;
            gap: 8px 12px;
            align-items: center;
            min-height: 64px;
            padding-block: 8px;
        }
        .brand {
            display: inline-flex; align-items: center; gap: 10px; font-weight: 800;
            font-size: clamp(16px, 2.4vw, 18px);
        }
        .brand .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--neon); box-shadow: var(--shadow); }

        .actions {
            justify-self: end;
            display: inline-flex; gap: 8px;
        }
        .icon-btn {
            width: 42px; height: 42px;
            display: inline-flex; justify-content: center; align-items: center;
            background: var(--bg-soft); border: 1px solid var(--border);
            border-radius: 12px; cursor: pointer; color: var(--text);
        }

        .menu {
            grid-column: 1 / -1;
            display: none;
            gap: 8px; padding: 8px;
            background: var(--bg); border: 1px solid var(--border);
            border-radius: 12px;
        }
        .menu.open { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .menu a {
            padding: 10px 12px; border-radius: 10px; text-align: center; color: var(--text);
            border: 1px solid transparent;
        }
        .menu a:hover, .menu a.active {
            border-color: color-mix(in oklab, var(--neon) 45%, var(--border));
            background: color-mix(in oklab, var(--neon) 12%, var(--bg-soft));
            box-shadow: var(--shadow);
        }

        @media (min-width: 900px) {
            .nav {
                grid-template-columns: auto 1fr auto;
                grid-template-rows: auto;
            }
            .menu { 
                display: inline-flex !important; 
                grid-column: 2 / 3; background: transparent; border: none; padding: 0; 
            }
            .menu a { padding: 8px 10px; }
        }

        .hero {
            padding-block: clamp(32px, 6vw, 72px) 24px;
            border-bottom: 1px dashed var(--border);
            background: radial-gradient(600px 200px at 50% -10%, color-mix(in oklab, var(--neon) 8%, transparent), transparent 70%) no-repeat;
            text-align: center;
        }
        .hero h1 { font-size: clamp(22px, 4.5vw, 36px); margin: 6px 0 8px; letter-spacing: .2px; }
        .hero p { margin: 0; color: var(--muted); max-width: 72ch; margin-inline: auto; }

        .avatar-wrap {
            position: relative; display: inline-block; margin-top: 20px;
        }
        .avatar-img {
            width: 120px; height: 120px; border-radius: 50%; border: 3px solid var(--neon);
            object-fit: cover; box-shadow: var(--shadow);
        }
        .verified-badge {
            position: absolute; bottom: 4px; right: 4px;
            background: var(--neon); width: 28px; height: 28px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; border: 2px solid var(--bg);
        }
        .verified-badge svg { width: 14px; height: 14px; fill: var(--bg); }

        .pill {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border);
            background: color-mix(in oklab, var(--neon) 8%, var(--bg-soft));
            box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--neon) 18%, transparent);
            color: var(--text); font-weight: 700; font-size: 0.8em;
        }
        .dot-neon { width: 6px; height: 6px; border-radius: 50%; background: var(--neon); box-shadow: var(--shadow); }
        .cta { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .btn {
            padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border);
            background: linear-gradient(to bottom right, color-mix(in oklab, var(--neon) 12%, var(--card)), var(--card));
            color: var(--text); font-weight: 700; box-shadow: var(--shadow);
            display: inline-flex; align-items: center; gap: 8px; transition: all 0.15s ease;
        }
        .btn:hover { transform: translateY(-2px); }
        .btn.ghost { background: var(--bg-soft); box-shadow: none; }

        .stats {
            display: flex; justify-content: center; gap: 36px; padding: 16px 0;
            border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
            margin: 20px 0;
        }
        .stat-item { text-align: center; }
        .stat-num { font-size: 1.2em; font-weight: 800; }
        .stat-label { font-size: 0.75em; color: var(--muted); }

        .grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
            padding-block: 28px 44px;
        }
        .card {
            background: var(--card); border: 1px solid var(--border);
            border-radius: var(--radius); padding: clamp(14px, 2.6vw, 20px);
            transition: transform .15s ease, box-shadow .15s ease;
        }
        .card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
        .card-full { grid-column: 1 / -1; }

        .card-body { }
        .muted { color: var(--muted); opacity: 0.85; font-size: 0.9em; }

        footer {
            border-top: 1px solid var(--border);
            padding: 20px 0 max(24px, env(safe-area-inset-bottom));
            color: var(--muted);
            background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--bg) 85%, #000));
        }
        .foot-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
        .foot-links { display: flex; gap: 14px; flex-wrap: wrap; }
        .tiny { font-size: 12px; }

        .verified-item {
            display: flex; align-items: center; gap: 12px; padding: 12px;
            background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius);
        }
        .verified-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--neon); }
        .verified-info h4 { font-weight: 700; font-size: 0.95em; display: flex; align-items: center; gap: 6px; margin: 0 0 4px; }
        .verified-info h4 img { width: 16px; height: 16px; }
        .verified-handle { font-size: 0.8em; color: var(--muted); }
        .verified-detail { font-size: 0.78em; color: var(--text); margin-top: 4px; }

        .fake-card {
            border: 1px solid #ff444466; border-radius: var(--radius); overflow: hidden;
            background: var(--card);
        }
        .fake-img-wrap { position: relative; text-align: center; padding: 10px; background: var(--bg-soft); }
        .fake-img { width: 100%; border-radius: 8px; }
        .fake-overlay {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 60px; height: 60px; animation: bounce 2s infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translate(-50%, -50%) translateY(0); }
            50% { transform: translate(-50%, -50%) translateY(-10px); }
        }
        .fake-body { padding: 12px; }
        .fake-body h4 { font-weight: 700; font-size: 0.95em; margin: 0 0 4px; }
        .platform { color: #ff8c00; font-weight: 700; font-size: 0.8em; }

        .proof-box { text-align: center; padding: 20px; }
        .proof-box img { max-width: 100%; border-radius: var(--radius); border: 1px solid var(--border); }

        .music-header {
            display: flex; align-items: center; gap: 14px; padding: 14px;
            background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 14px;
        }
        .music-cover { width: 56px; height: 56px; border-radius: 10px; overflow: hidden; flex-shrink: 0; position: relative; }
        .music-cover img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
        .music-cover .cover-live { display: none; }
        .music-info { flex: 1; min-width: 0; }
        .music-title { font-weight: 700; font-size: 0.95em; }
        .music-artist { font-size: 0.8em; color: var(--muted); }

        .seek-bar { width: 100%; height: 4px; background: var(--border); border-radius: 2px; cursor: pointer; margin: 10px 0; }
        .seek-fill { height: 100%; background: var(--neon); border-radius: 2px; width: 0; box-shadow: var(--shadow); }
        .time-row { display: flex; justify-content: space-between; font-size: 0.75em; color: var(--muted); margin-bottom: 10px; }
        .controls { display: flex; align-items: center; justify-content: center; gap: 16px; }
        .ctrl-btn {
            width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border);
            background: var(--bg-soft); color: var(--text); cursor: pointer; font-size: 0.9em;
            display: flex; align-items: center; justify-content: center; transition: 0.15s;
        }
        .ctrl-btn:hover { border-color: var(--neon); box-shadow: var(--shadow); }
        .ctrl-play {
            width: 50px; height: 50px; background: var(--neon); color: var(--bg);
            font-size: 1.3em; border: none;
        }
        .song-list { max-height: 220px; overflow-y: auto; border-top: 1px solid var(--border); margin-top: 12px; padding-top: 10px; }
        .song-item {
            display: flex; align-items: center; gap: 10px; padding: 10px; cursor: pointer;
            border-radius: 10px; transition: 0.1s;
        }
        .song-item:hover { background: var(--bg-soft); }
        .song-item.active { background: color-mix(in oklab, var(--neon) 12%, var(--bg-soft)); }
        .song-num { font-weight: 700; color: var(--muted); min-width: 24px; font-size: 0.85em; }
        .song-thumb-box { width: 32px; height: 32px; border-radius: 6px; overflow: hidden; flex-shrink: 0; position: relative; }
        .song-thumb-box img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
        .song-meta { flex: 1; min-width: 0; }
        .song-name { font-weight: 500; font-size: 0.85em; }
        .song-by { font-size: 0.73em; color: var(--muted); }
        .song-eq { margin-left: auto; display: flex; align-items: flex-end; gap: 2px; height: 14px; }
        .song-eq span { width: 3px; background: var(--neon); border-radius: 1px; animation: eq 0.8s ease-in-out infinite; }
        .song-eq span:nth-child(1) { animation-delay: 0s; }
        .song-eq span:nth-child(2) { animation-delay: 0.15s; }
        .song-eq span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes eq { 0%,100% { height: 4px; } 50% { height: 12px; } }

        .chat-fab { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
        .chat-fab button {
            width: 52px; height: 52px; border-radius: 50%; background: var(--neon); color: var(--bg);
            border: none; font-size: 1.3em; cursor: pointer; box-shadow: var(--shadow);
            display: flex; align-items: center; justify-content: center; transition: 0.2s;
        }
        .chat-fab button:hover { transform: scale(1.08); }

        .chat-panel {
            display: none; position: fixed; bottom: 84px; right: 20px;
            width: 350px; height: 480px; background: var(--card); border: 1px solid var(--border);
            border-radius: var(--radius); box-shadow: var(--shadow); flex-direction: column; overflow: hidden; z-index: 9999;
        }
        .chat-panel.open { display: flex; }
        @media(max-width:480px) { .chat-panel { width: 100%; right: 0; bottom: 0; border-radius: var(--radius) var(--radius) 0 0; height: 65vh; } }

        .chat-top {
            padding: 12px 16px; border-bottom: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 0.95em;
        }
        .chat-top button { background: none; border: none; color: var(--muted); font-size: 1.3em; cursor: pointer; }
        .chat-body { flex: 1; overflow-y: auto; padding: 12px; background: var(--bg-soft); }
        .chat-login { text-align: center; padding: 24px 20px; }
        .chat-login h4 { font-weight: 700; margin-bottom: 14px; }
        .chat-input-field {
            width: 100%; padding: 10px 12px; margin-bottom: 10px;
            border: 1px solid var(--border); border-radius: 10px; font-size: 0.9em;
            outline: none; background: var(--bg); color: var(--text);
        }
        .chat-input-field:focus { border-color: var(--neon); }
        .chat-send {
            padding: 12px; border-top: 1px solid var(--border); display: none; background: var(--card);
        }
        .chat-send-row { display: flex; align-items: center; gap: 8px; }
        .chat-send-row input {
            flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 20px;
            font-size: 0.9em; outline: none; background: var(--bg-soft); color: var(--text);
        }
        .chat-send-row input:focus { border-color: var(--neon); }
        .chat-send-row button {
            background: var(--neon); color: var(--bg); border: none;
            width: 38px; height: 38px; border-radius: 50%; cursor: pointer; font-size: 1.1em;
            display: flex; align-items: center; justify-content: center;
        }
        .msg {
            max-width: 80%; padding: 8px 12px; border-radius: 16px; margin-bottom: 6px;
            font-size: 0.85em; word-wrap: break-word;
        }
        .msg.me {
            background: color-mix(in oklab, var(--neon) 25%, var(--card));
            color: var(--text); margin-left: auto; border-bottom-right-radius: 4px;
            border: 1px solid color-mix(in oklab, var(--neon) 40%, var(--border));
        }
        .msg.you {
            background: var(--bg-soft); color: var(--text); margin-right: auto;
            border-bottom-left-radius: 4px; border: 1px solid var(--border);
        }
        .msg .time { font-size: 0.65em; opacity: 0.6; margin-top: 4px; text-align: right; }

        @media (prefers-reduced-motion: reduce) {
            * { transition: none !important; animation: none !important; }
        }
    </style>
</head>
<body>

    <header>
        <div class="container">
            <nav class="nav" aria-label="Primary">
                <div class="brand">
                    <span class="dot"></span>
                    <span>Baiilla Maach</span>
                </div>

                <div class="actions">
                    <button class="icon-btn" id="themeToggle" aria-label="Toggle theme">
                        <svg id="iconMoon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z"/>
                        </svg>
                        <svg id="iconSun" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:none">
                            <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.48 14.32l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM1 13h3v-2H1v2zm19 0h3v-2h-3v2zM4.96 19.04l-1.41 1.41 1.8 1.79 1.41-1.41-1.8-1.79zM12 5a7 7 0 100 14 7 7 0 000-14zm7.04-1.96l1.41-1.41-1.79-1.8-1.41 1.41 1.79 1.8zM13 23v-3h-2v3h2zm0-19V1h-2v3h2z"/>
                        </svg>
                    </button>

                    <a href="/messenger" class="icon-btn" aria-label="Admin">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                    </a>
                </div>

                <div class="menu" id="menu">
                    <a class="active" href="#home">Home</a>
                    <a href="#verified">Verified</a>
                    <a href="#music">Music</a>
                    <a href="#contact">Contact</a>
                </div>
            </nav>
        </div>
    </header>

    <main class="container">

        <section class="hero" id="home">
            <div class="avatar-wrap">
                <img src="/assets/celebrity_pfp.jpeg" class="avatar-img" onerror="this.style.display='none'">
                <div class="verified-badge">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
            </div>
            <h1>Hammad Bin Amir</h1>
            <p>@baiillamaach_official · Official Entertainment Profile · Verified Creator</p>
            <div class="stats">
                <div class="stat-item"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div>
                <div class="stat-item"><div class="stat-num">0</div><div class="stat-label">Following</div></div>
                <div class="stat-item"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div>
            </div>
            <div class="cta">
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn">
                    <img src="/assets/logo_tiktok.png" width="18"> Follow TikTok
                </a>
                <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn ghost">
                    <img src="/assets/logo_fb.png" width="18"> Facebook
                </a>
            </div>
        </section>

        <section class="grid" id="verified">
            <div class="card">
                <div class="card-body">
                    <span class="pill"><span class="dot-neon"></span> OFFICIAL</span>
                    <h3>Verified Accounts</h3>
                    <p class="muted">The only authentic accounts</p>
                    <div style="display:grid;gap:12px;margin-top:16px">
                        <div class="verified-item">
                            <img src="/assets/celebrity_pfp.jpeg" class="verified-avatar">
                            <div class="verified-info">
                                <h4>TikTok <img src="/assets/bluetick_tiktok.png"></h4>
                                <div class="verified-handle">@baiillamaach_official</div>
                                <div class="verified-detail">✓ Active · 7K Followers · 190K Likes</div>
                            </div>
                        </div>
                        <div class="verified-item">
                            <img src="/assets/fb_profile.jpg" class="verified-avatar">
                            <div class="verified-info">
                                <h4>Facebook <img src="/assets/blue_tick_fb.png"></h4>
                                <div class="verified-handle">@BaiillaMaachOfficial</div>
                                <div class="verified-detail">✓ Active · Official Page</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <span class="pill" style="border-color:#ff444466;background:color-mix(in oklab, #ff4444 8%, var(--bg-soft))">
                        <span class="dot-neon" style="background:#ff4444"></span> WARNING
                    </span>
                    <h3>Fake Accounts</h3>
                    <p class="muted">Report these impersonators</p>
                    <div style="display:grid;gap:12px;margin-top:16px">
                        <div class="fake-card">
                            <div class="fake-img-wrap">
                                <img src="/assets/baillamach_fake.png" class="fake-img">
                                <img src="/assets/Fakedetect_updown.png" class="fake-overlay">
                            </div>
                            <div class="fake-body">
                                <h4>@baiilla_mach</h4>
                                <div class="platform">📍 TikTok</div>
                                <p class="muted">Copies official content</p>
                                <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn ghost" style="padding:6px 12px;font-size:0.8em">🚨 Report</a>
                            </div>
                        </div>
                        <div class="fake-card">
                            <div class="fake-img-wrap">
                                <img src="/assets/hammadfams.png" class="fake-img">
                                <img src="/assets/Fakedetect_updown.png" class="fake-overlay">
                            </div>
                            <div class="fake-body">
                                <h4>@hammad_fams0</h4>
                                <div class="platform">📍 TikTok</div>
                                <p class="muted">Impersonating account</p>
                                <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn ghost" style="padding:6px 12px;font-size:0.8em">🚨 Report</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <span class="pill"><span class="dot-neon"></span> VERIFIED</span>
                    <h3>Real ID Verified</h3>
                    <div class="proof-box">
                        <img src="/assets/real-id-ss.png">
                        <p style="margin-top:10px">✅ Official ID Verified</p>
                    </div>
                </div>
            </div>

            ${voiceBlock}
        </section>

        ${songs.length > 0 ? `
        <section class="card card-full" id="music" style="margin-bottom:28px">
            <div class="card-body">
                <span class="pill"><span class="dot-neon"></span> MUSIC</span>
                <h3>Cover Songs</h3>
                <div class="music-header">
                    <div class="music-cover">
                        <img src="/assets/play.gif" class="cover-static" id="coverStatic">
                        <img src="/assets/play.gif" class="cover-live" id="coverLive">
                    </div>
                    <div class="music-info">
                        <div class="music-title" id="nowPlaying">Select a song</div>
                        <div class="music-artist">Baiilla Maach</div>
                    </div>
                </div>
                <div class="seek-bar" onclick="seekTrack(event)">
                    <div class="seek-fill" id="seekFill"></div>
                </div>
                <div class="time-row">
                    <span id="currentTime">0:00</span>
                    <span id="totalTime">0:00</span>
                </div>
                <div class="controls">
                    <button class="ctrl-btn" onclick="prevTrack()">⏮</button>
                    <button class="ctrl-btn ctrl-play" id="playBtn" onclick="togglePlay()">▶</button>
                    <button class="ctrl-btn" onclick="nextTrack()">⏭</button>
                </div>
                <div class="song-list">
                    ${songsListHTML}
                </div>
            </div>
        </section>` : ''}

    </main>

    <div class="chat-fab">
        <button onclick="toggleChat()">💬</button>
    </div>

    <div class="chat-panel" id="chatPanel">
        <div class="chat-top">💬 Chat Support<button onclick="toggleChat()">✕</button></div>
        <div class="chat-body" id="chatBody">
            <div class="chat-login" id="chatForm">
                <h4>Start Chat</h4>
                <input type="text" class="chat-input-field" id="chatName" placeholder="Your Name">
                <input type="text" class="chat-input-field" id="chatEmail" placeholder="Email or Phone">
                <button class="btn" onclick="startChat()">Start Chatting</button>
            </div>
        </div>
        <div class="chat-send" id="chatSend">
            <div class="chat-send-row">
                <input type="text" id="chatMsg" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMsg()">
                <button onclick="sendMsg()">➤</button>
            </div>
        </div>
    </div>

    <footer>
        <div class="container foot-inner">
            <div class="tiny">© <span id="year"></span> Baiilla Maach Official. All rights reserved.</div>
            <nav class="foot-links tiny">
                <a href="#privacy">Privacy</a>
                <a href="#terms">Terms</a>
                <a href="#contact">Contact</a>
            </nav>
        </div>
    </footer>

    ${hasRealVoice ? '<audio id="realVoice" src="/assets/realvoice.mp3" preload="auto"></audio>' : ''}
    ${hasManualVoice ? '<audio id="fakeVoice" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>' : ''}
    <audio id="player" preload="auto"></audio>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        document.getElementById('year').textContent = new Date().getFullYear();

        const root = document.documentElement;
        const themeToggle = document.getElementById('themeToggle');
        const iconMoon = document.getElementById('iconMoon');
        const iconSun = document.getElementById('iconSun');
        const saved = localStorage.getItem('theme');
        if (saved === 'light') { root.classList.add('light'); iconMoon.style.display = 'none'; iconSun.style.display = 'block'; }

        themeToggle.addEventListener('click', () => {
            root.classList.toggle('light');
            const isLight = root.classList.contains('light');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            iconMoon.style.display = isLight ? 'none' : 'block';
            iconSun.style.display = isLight ? 'block' : 'none';
        });

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
            var playBtn = document.getElementById("playBtn");
            if (playBtn) playBtn.textContent = playing ? "⏸" : "▶";
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
        if (tracks.length > 0) document.getElementById("nowPlaying").textContent = tracks[0].title;
        var rv = document.getElementById("realVoice"); if (rv) setTimeout(function() { rv.play(); }, 1500);

        var socket = io({ transports: ["websocket", "polling"] });
        var chatUser = null;

        function toggleChat() { var p = document.getElementById("chatPanel"); p.classList.toggle("open"); if (p.classList.contains("open") && chatUser) loadMessages(); }
        function startChat() {
            var n = document.getElementById("chatName").value.trim(), e = document.getElementById("chatEmail").value.trim();
            if (!n || !e) return;
            chatUser = { name: n, email: e };
            socket.emit("register", { name: n, email: e });
            document.getElementById("chatForm").style.display = "none";
            document.getElementById("chatSend").style.display = "block";
            loadMessages();
        }
        async function loadMessages() {
            if (!chatUser) return;
            try {
                var r = await fetch("/api/msgs/" + encodeURIComponent(chatUser.email));
                var ms = await r.json();
                var b = document.getElementById("chatBody");
                b.innerHTML = "";
                if (!ms.length) b.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No messages yet</div>';
                else ms.forEach(function(m) { addMsg(m, b); });
                b.scrollTop = b.scrollHeight;
            } catch (e) {}
        }
        function addMsg(m, b) { var cls = m.sender === chatUser.email ? "me" : "you"; var t = new Date(m.timestamp + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); b.innerHTML += '<div class="msg ' + cls + '">' + m.message + '<div class="time">' + t + '</div></div>'; }
        function sendMsg() { var i = document.getElementById("chatMsg"), m = i.value.trim(); if (!m || !chatUser) return; socket.emit("sendMsg", { sender: chatUser.email, receiver: "admin", message: m, type: "text" }); i.value = ""; i.focus(); }
        socket.on("newMsg", function(m) { if (chatUser && (m.sender === chatUser.email || m.receiver === chatUser.email)) { var b = document.getElementById("chatBody"); addMsg(m, b); b.scrollTop = b.scrollHeight; } });
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
    const adminHTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <title>Admin Messenger | Baiilla Maach</title>
    <style>
        :root {
            --bg: #0b0f10; --bg-soft: #0f1417; --text: #e6f1ff; --muted: #9fb0c0;
            --neon: #39ff14; --neon-soft: #2bff1466; --card: #11171a; --border: #1c242a;
            --radius: 14px; --shadow: 0 0 22px var(--neon-soft);
        }
        :root.light {
            --bg: #fff; --bg-soft: #f6faf7; --text: #0a0b0c; --muted: #4a575f;
            --neon: #16a34a; --neon-soft: #16a34a44; --card: #fff; --border: #e4efe7; --shadow: none;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; font-size: 15px; }
        .login-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .login-card { background: var(--card); padding: 28px; border-radius: var(--radius); width: 100%; max-width: 380px; text-align: center; border: 1px solid var(--border); box-shadow: var(--shadow); }
        .login-card h2 { font-weight: 700; margin-bottom: 4px; }
        .login-card .sub { color: var(--muted); font-size: 0.85em; margin-bottom: 18px; }
        .login-card input { width: 100%; padding: 11px; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 10px; font-size: 0.9em; outline: none; background: var(--bg-soft); color: var(--text); }
        .login-card input:focus { border-color: var(--neon); }
        .login-card button { width: 100%; padding: 11px; background: var(--neon); color: var(--bg); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.95em; }
        .login-card button:disabled { opacity: 0.6; }
        .error { color: #ff4444; font-size: 0.8em; margin-top: 6px; display: none; }
        .app { display: none; height: 100vh; }
        .layout { display: flex; height: 100vh; max-width: 1400px; margin: 0 auto; background: var(--card); border: 1px solid var(--border); }
        @media(max-width:767px) { .layout { flex-direction: column; } }
        .sidebar { width: 340px; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        @media(max-width:767px) { .sidebar { width: 100%; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--border); } }
        .sb-head { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .sb-head h2 { font-size: 1em; font-weight: 700; }
        .sb-head button { background: none; border: none; color: var(--neon); font-weight: 600; cursor: pointer; font-size: 0.85em; }
        .search-box { padding: 8px 14px; border-bottom: 1px solid var(--border); }
        .search-box input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 20px; font-size: 0.85em; outline: none; background: var(--bg-soft); color: var(--text); }
        .user-list { flex: 1; overflow-y: auto; }
        .u-item { padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid var(--border); }
        .u-item:hover { background: var(--bg-soft); }
        .u-item.active { background: color-mix(in oklab, var(--neon) 10%, var(--bg-soft)); }
        .u-ava { width: 38px; height: 38px; border-radius: 50%; background: var(--neon); display: flex; align-items: center; justify-content: center; color: var(--bg); font-weight: 700; font-size: 1em; }
        .u-info .name { font-weight: 600; font-size: 0.85em; }
        .u-info .email { font-size: 0.75em; color: var(--muted); }
        .unread { background: var(--neon); color: var(--bg); font-size: 0.68em; padding: 2px 7px; border-radius: 10px; font-weight: 600; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        @media(max-width:767px) { .chat-area { position: fixed; inset: 0; z-index: 100; display: none; } .chat-area.active { display: flex; } }
        .ch-head { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: var(--bg-soft); }
        .back-btn { display: none; background: none; border: none; font-size: 1.2em; cursor: pointer; color: var(--neon); }
        @media(max-width:767px) { .back-btn { display: block; } }
        .ch-ava { width: 34px; height: 34px; border-radius: 50%; background: var(--neon); display: flex; align-items: center; justify-content: center; color: var(--bg); font-weight: 700; }
        .ch-name { font-weight: 600; font-size: 0.9em; }
        .ch-status { font-size: 0.73em; } .ch-status.online { color: var(--neon); }
        .ch-msgs { flex: 1; overflow-y: auto; padding: 14px; background: var(--bg); }
        .msg { max-width: 70%; padding: 8px 11px; border-radius: 16px; margin-bottom: 5px; font-size: 0.85em; word-wrap: break-word; }
        .msg.sent { background: var(--neon); color: var(--bg); margin-left: auto; border-bottom-right-radius: 4px; }
        .msg.received { background: var(--bg-soft); color: var(--text); border-bottom-left-radius: 4px; border: 1px solid var(--border); }
        .msg .time { font-size: 0.65em; opacity: 0.6; margin-top: 2px; text-align: right; }
        .ch-input { padding: 10px 14px; border-top: 1px solid var(--border); display: none; background: var(--card); }
        .ch-row { display: flex; align-items: center; gap: 8px; }
        .ch-row input { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 20px; font-size: 0.9em; outline: none; background: var(--bg-soft); color: var(--text); }
        .ch-row button { background: var(--neon); color: var(--bg); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 1em; }
        .empty { text-align: center; color: var(--muted); padding: 50px 20px; }
        .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--card); color: var(--text); padding: 10px 20px; border-radius: 20px; font-size: 0.8em; z-index: 9999; opacity: 0; border: 1px solid var(--border); transition: opacity 0.3s; }
        .toast.show { opacity: 1; }
    </style>
</head>
<body>
<div class="login-overlay" id="lo"><div class="login-card">
<h2>🔐 Admin Messenger</h2><p class="sub">Support Panel</p>
<input type="text" id="le" placeholder="Username" value="admin">
<input type="password" id="lp" placeholder="Password" value="admin123">
<button id="lb" onclick="doLogin()">Sign In</button>
<div class="error" id="err"></div></div></div>

<div class="app" id="app"><div class="layout">
<div class="sidebar" id="sb"><div class="sb-head"><h2>💬 Conversations</h2><button onclick="doLogout()">Logout</button></div>
<div class="search-box"><input type="text" id="sq" placeholder="🔍 Search..." oninput="filterUsers()"></div>
<div class="user-list" id="ul"><div class="empty"><p>Loading...</p></div></div></div>

<div class="chat-area" id="ca"><div class="ch-head"><button class="back-btn" onclick="goBack()">←</button>
<div class="ch-ava" id="cav">?</div>
<div><div class="ch-name" id="cn">Select user</div><div class="ch-status" id="cs">● Offline</div></div></div>
<div class="ch-msgs" id="cm"><div class="empty"><h3>No conversation</h3></div></div>
<div class="ch-input" id="ci"><div class="ch-row">
<input type="text" id="mi" placeholder="Type..." onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()">➤</button></div></div></div>
</div></div>
<div class="toast" id="toast"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io({transports:["websocket","polling"]}),cu=null,au=[],li=false,iv=null;
function toast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2000)}
socket.on("connect",function(){if(li)loadUsers()});
socket.on("newMsg",function(m){if(cu&&((m.sender===cu.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===cu.email)))appendMsg(m);loadUsers()});
socket.on("userStatus",function(d){if(cu&&cu.email===d.email){var s=document.getElementById("cs");s.textContent=d.online?"● Online":"● Offline";s.className="ch-status "+(d.online?"online":"")}loadUsers()});
async function doLogin(){var e=document.getElementById("le").value.trim(),p=document.getElementById("lp").value.trim(),er=document.getElementById("err"),bt=document.getElementById("lb");er.style.display="none";if(!e||!p){er.textContent="Fill all";er.style.display="block";return}bt.disabled=true;bt.textContent="...";
try{var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});if(r.ok){li=true;localStorage.setItem("ad",JSON.stringify({email:e,password:p}));document.getElementById("lo").style.display="none";document.getElementById("app").style.display="block";socket.emit("register",{name:"Admin",email:"admin"});loadUsers();iv=setInterval(loadUsers,8000)}else{er.textContent="Invalid";er.style.display="block"}}catch(ex){er.textContent="Error";er.style.display="block"}bt.disabled=false;bt.textContent="Sign In"}
async function loadUsers(){if(!li)return;try{var r=await fetch("/api/admin/users");au=await r.json();renderUsers()}catch(e){}}
function renderUsers(){var s=document.getElementById("sq").value.toLowerCase(),f=au.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)}),h="";f.forEach(function(u){var a=cu&&cu.email===u.email;h+='<div class="u-item'+(a?" active":"")+'" onclick="selectUser(\\''+u.email+'\\')"><div class="u-ava">'+u.name.charAt(0).toUpperCase()+'</div><div class="u-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':"")+'</div>'});document.getElementById("ul").innerHTML=h||'<div class="empty"><p>No users</p></div>'}
function filterUsers(){renderUsers()}
async function selectUser(e){var u=au.find(function(u){return u.email===e});if(!u)return;cu=u;document.getElementById("cav").textContent=u.name.charAt(0).toUpperCase();document.getElementById("cn").textContent=u.name;document.getElementById("cs").textContent=u.isOnline?"● Online":"● Offline";document.getElementById("cs").className="ch-status "+(u.isOnline?"online":"");document.getElementById("ci").style.display="block";document.getElementById("ca").classList.add("active");if(window.innerWidth<768)document.getElementById("sb").style.display="none";
try{var r=await fetch("/api/msgs/"+encodeURIComponent(u.email)),ms=await r.json(),c=document.getElementById("cm");c.innerHTML="";if(!ms.length)c.innerHTML='<div class="empty"><h3>No messages</h3></div>';else ms.forEach(function(m){addMsg(m,c)});c.scrollTop=99999}catch(e){}socket.emit("markRead",{user:u.email});renderUsers()}
function addMsg(m,c){var s=m.sender==="admin",t=new Date(m.timestamp+"Z").toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});c.innerHTML+='<div class="msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>'}
function appendMsg(m){if(!cu)return;var c=document.getElementById("cm");addMsg(m,c);c.scrollTop=99999}
function sendMessage(){if(!cu){toast("Select user");return}var i=document.getElementById("mi"),m=i.value.trim();if(!m)return;socket.emit("sendMsg",{sender:"admin",receiver:cu.email,message:m,type:"text"});appendMsg({sender:"admin",receiver:cu.email,message:m,timestamp:new Date().toISOString()});i.value="";i.focus()}
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
    console.log('========================================');
    console.log('🚀 Server: http://localhost:' + PORT);
    console.log('🔧 Admin: http://localhost:' + PORT + '/messenger');
    console.log('👤 Login: admin / admin123');
    console.log('💾 SQLite Database Ready');
    console.log('========================================');
});

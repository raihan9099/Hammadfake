const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

// ============ CONFIGURATION ============
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// ============ PATHS ============
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ============ DATABASE ============
let db, mongoClient;

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const cols = ['admin_users', 'gallery_photos'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const c of cols) {
            if (!names.includes(c)) await db.createCollection(c);
        }
        await db.collection('gallery_photos').createIndex({ uploadedAt: -1 });
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                createdAt: new Date()
            });
        }
        console.log('[DB] Connected');
        return true;
    } catch (e) {
        console.error('[DB] Error:', e.message);
        return false;
    }
}

// ============ DB OPERATIONS ============
async function getGalleryPhotos() {
    if (!db) return [];
    try {
        return await db.collection('gallery_photos')
            .find({}).sort({ uploadedAt: -1 }).limit(30).toArray();
    } catch (e) { return []; }
}

async function savePhoto(data) {
    if (!db) return null;
    return await db.collection('gallery_photos').insertOne({
        ...data,
        uploadedAt: new Date()
    });
}

async function deletePhoto(id) {
    if (!db) return null;
    return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
}

async function verifyAdmin(username, password) {
    if (!db) return username === 'admin' && password === 'admin123';
    const admin = await db.collection('admin_users').findOne({ username });
    if (!admin) return false;
    return await bcrypt.compare(password, admin.password);
}

// ============ COVER SONGS ============
function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const ae = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const ce = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const groups = {};
        files.forEach(f => {
            const e = path.extname(f).toLowerCase();
            const b = path.basename(f, e);
            if (!groups[b]) groups[b] = { audio: null, cover: null };
            if (ae.includes(e)) groups[b].audio = f;
            if (ce.includes(e)) groups[b].cover = f;
        });
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([b, v]) => ({
                id: b.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: b.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

// ============ SESSIONS ============
const sessions = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of sessions) {
        if (now - v.createdAt > 7200000) sessions.delete(k);
    }
}, 1800000);

function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: u, createdAt: Date.now() });
    return id;
}

function getSession(id) {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; }
    return s;
}

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(x => {
        const p = x.split('=');
        c[p[0].trim()] = p[1] ? p[1].trim() : '';
    });
    return c;
}

// ============ MIME TYPES ============
const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.ico': 'image/x-icon'
};

// ============ HTML TEMPLATES ============
function getLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a14;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#13132b;border:1px solid rgba(255,255,255,.06);border-radius:24px;padding:40px;width:100%;max-width:380px}
.card h2{color:#f0f0ff;text-align:center;margin-bottom:24px;font-size:22px}
.card input{width:100%;padding:14px;background:#1a1a35;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#f0f0ff;margin-bottom:12px;font-size:14px;outline:none}
.card input:focus{border-color:#8b5cf6}
.card button{width:100%;padding:14px;background:#8b5cf6;color:#fff;border:none;border-radius:12px;font-weight:600;font-size:15px;cursor:pointer}
.card .err{background:rgba(239,68,68,.1);color:#fca5a5;padding:10px;border-radius:10px;margin-bottom:16px;font-size:13px;text-align:center}
.card a{color:#6060a0;text-decoration:none;font-size:13px;display:block;text-align:center;margin-top:16px}
</style>
</head>
<body>
<div class="card">
<h2>Admin Login</h2>
${error ? '<div class="err">' + error + '</div>' : ''}
<form method="POST" action="/admin/login">
<input name="username" placeholder="Username" required>
<input type="password" name="password" placeholder="Password" required>
<button type="submit">Sign In</button>
</form>
<a href="/">← Back to Site</a>
</div>
</body>
</html>`;
}

function getAdminHTML(photos = [], msg = '', err = '') {
    const photoCards = photos.length > 0 
        ? photos.map(p => `
            <div class="photo-card">
                <img src="${p.path}" alt="Photo" loading="lazy">
                <div class="photo-info">
                    <p>${p.caption || ''}</p>
                    <form method="POST" action="/admin/delete">
                        <input type="hidden" name="photoId" value="${p._id}">
                        <button type="submit" class="del-btn">Delete</button>
                    </form>
                </div>
            </div>`).join('')
        : '<p style="color:#6060a0;text-align:center;padding:40px;grid-column:1/-1">No photos yet</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a14;color:#f0f0ff;min-height:100vh}
.hdr{background:#13132b;border-bottom:1px solid rgba(255,255,255,.06);padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100}
.hdr h1{font-size:17px;background:linear-gradient(135deg,#c4b5fd,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hdr nav{display:flex;gap:8px}
.hdr nav a{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;text-decoration:none}
.btn-p{background:#8b5cf6;color:#fff}
.btn-g{background:#1a1a35;color:#a0a0cc;border:1px solid rgba(255,255,255,.1)}
.btn-r{background:rgba(239,68,68,.15);color:#fca5a5}
.ct{max-width:1100px;margin:0 auto;padding:20px}
.card{background:#13132b;border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:22px;margin-bottom:18px}
.card h2{font-size:17px;margin-bottom:14px}
.card input[type=file]{margin-bottom:10px;color:#a0a0cc}
.card input[type=text]{width:100%;padding:11px;background:#1a1a35;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#f0f0ff;margin-bottom:10px;outline:none}
.card button[type=submit]{width:100%;padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.photo-card{background:#13132b;border:1px solid rgba(255,255,255,.06);border-radius:16px;overflow:hidden}
.photo-card img{width:100%;height:150px;object-fit:cover}
.photo-info{padding:12px}
.photo-info p{font-size:13px;color:#a0a0cc}
.del-btn{background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;margin-top:6px}
.ok{background:rgba(16,185,129,.1);color:#6ee7b7;padding:12px 16px;border-radius:12px;margin-bottom:16px}
.no{background:rgba(239,68,68,.1);color:#fca5a5;padding:12px 16px;border-radius:12px;margin-bottom:16px}
</style>
</head>
<body>
<header class="hdr">
<h1>Admin Panel</h1>
<nav>
<a href="/" class="btn-g">View Site</a>
<a href="/admin/logout" class="btn-r">Logout</a>
</nav>
</header>
<div class="ct">
${msg ? '<div class="ok">' + msg + '</div>' : ''}
${err ? '<div class="no">' + err + '</div>' : ''}
<div class="card">
<h2>Upload Photo</h2>
<form method="POST" action="/admin/upload" enctype="multipart/form-data">
<input type="file" name="photo" accept="image/*" required>
<input type="text" name="caption" placeholder="Caption (optional)">
<button type="submit">Upload Photo</button>
</form>
</div>
<h2 style="font-size:19px;margin-bottom:14px">Gallery (${photos.length})</h2>
<div class="gal">${photoCards}</div>
</div>
</body>
</html>`;
}

// ============ MAIN WEBSITE HTML ============
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const songsJSON = JSON.stringify(coverSongs);
    const galleryJSON = JSON.stringify(galleryPhotos.map(p => ({ src: p.path, caption: p.caption || '' })));

    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f0f1a">
<title>Baiilla Maach | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script>
(function(){var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)})();
</script>
<style>
:root{
--font:'Inter',system-ui,sans-serif;
--radius:16px;
--t:0.25s ease;
}
[data-theme="light"]{--bg:#f5f5f7;--bg2:#fff;--bg3:#f0f0f5;--text:#1d1d1f;--text2:#6e6e73;--text3:#aeaeb2;--border:rgba(0,0,0,.08);--card:#fff;--purple:#6366f1;--green:#10b981;--red:#ef4444;--msg-out:#6366f1;--msg-in:#e8e8ed;--chat-bg:#f5f5f7;--input-bg:#e8e8ed}
[data-theme="dark"]{--bg:#0a0a14;--bg2:#13132b;--bg3:#1a1a35;--text:#f0f0ff;--text2:#a0a0cc;--text3:#6060a0;--border:rgba(255,255,255,.06);--card:#13132b;--purple:#8b5cf6;--green:#10b981;--red:#ef4444;--msg-out:#8b5cf6;--msg-in:#1e1e3a;--chat-bg:#0a0a14;--input-bg:#1a1a35}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased;transition:background var(--t),color var(--t)}
img{max-width:100%;height:auto;display:block}
a{color:inherit;text-decoration:none}
button{cursor:pointer;font-family:inherit}
input{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
.container{max-width:720px;margin:0 auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px;transition:all var(--t)}
.card:hover{border-color:rgba(255,255,255,.12)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600}
.badge-red{background:rgba(239,68,68,.12);color:var(--red)}
.badge-green{background:rgba(16,185,129,.12);color:var(--green)}
.badge-purple{background:rgba(139,92,246,.12);color:var(--purple)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;border:none;transition:all var(--t);white-space:nowrap;cursor:pointer}
.btn:active{transform:scale(.96)}
.btn-danger{background:var(--red);color:#fff}
.btn-success{background:var(--green);color:#fff}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text2)}
.btn-sm{padding:5px 10px;font-size:11px}
.header{position:sticky;top:0;z-index:50;background:var(--bg2);border-bottom:1px solid var(--border);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.header-inner{display:flex;align-items:center;justify-content:space-between;max-width:720px;margin:0 auto;padding:10px 16px}
.header-logo{display:flex;align-items:center;gap:10px}
.header-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)}
.header-title{font-weight:700;font-size:15px}
.theme-btn{width:34px;height:34px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.profile{text-align:center;padding:24px 0 16px}
.profile-pic-wrap{position:relative;display:inline-block;margin-bottom:12px}
.profile-pic{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--purple);box-shadow:0 0 30px rgba(99,102,241,.3)}
.verified-badge{position:absolute;bottom:4px;right:4px;width:26px;height:26px;background:var(--green);border-radius:50%;border:3px solid var(--bg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(16,185,129,.3)}
.verified-badge svg{width:14px;height:14px;fill:#fff}
.profile-name{font-size:22px;font-weight:800;margin-top:8px}
.profile-bio{color:var(--text2);font-size:13px;margin-top:4px}
.stats{display:flex;justify-content:center;gap:12px;margin:16px 0}
.stat-card{background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:14px 20px;text-align:center;min-width:80px;transition:all var(--t)}
.stat-card:hover{border-color:var(--purple)}
.stat-value{font-size:22px;font-weight:700;color:var(--purple)}
.stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
.section-hdr{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.section-hdr h2{font-size:16px;font-weight:700}
.fake-card{background:rgba(239,68,68,.04);border:1px solid rgba(239,68,68,.15);border-radius:14px;padding:14px;margin-bottom:10px;transition:all var(--t)}
.fake-card:hover{border-color:rgba(239,68,68,.3)}
.fake-card-user{font-weight:700;color:#fca5a5;font-size:14px;margin-bottom:4px}
.fake-card-reason{font-size:12px;color:var(--text2);margin-bottom:8px}
.fake-actions{display:flex;gap:6px}
.official-card{background:rgba(16,185,129,.04);border:1px solid rgba(16,185,129,.15);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;transition:all var(--t)}
.official-card:hover{border-color:rgba(16,185,129,.3)}
.official-name{font-weight:600;font-size:14px}
.official-followers{font-size:11px;color:var(--text3)}
.music-player{background:linear-gradient(135deg,#1a1040,#0d0d28);border-radius:20px;padding:22px;margin:16px 0;color:#fff;position:relative;overflow:hidden}
.album-art{width:64px;height:64px;border-radius:14px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;overflow:hidden;border:2px solid rgba(255,255,255,.15)}
.album-art img{width:100%;height:100%;object-fit:cover}
.play-btn{width:48px;height:48px;border-radius:50%;background:#1db954;border:none;color:#000;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 25px rgba(29,185,84,.4);flex-shrink:0;transition:all var(--t)}
.play-btn:hover{transform:scale(1.08)}
.progress-bar{flex:1;height:4px;background:rgba(255,255,255,.15);border-radius:2px;cursor:pointer;overflow:hidden}
.progress-fill{height:100%;background:#1db954;width:0%;transition:width .1s}
.song-list{max-height:200px;overflow-y:auto}
.song-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .15s;font-size:13px}
.song-item:hover{background:rgba(255,255,255,.06)}
.song-item.active{background:rgba(29,185,84,.2)}
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.gallery-item{border-radius:14px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:all var(--t);aspect-ratio:1}
.gallery-item:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(0,0,0,.2)}
.gallery-item img{width:100%;height:100%;object-fit:cover}
.lightbox{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;cursor:pointer}
.lightbox.active{display:flex}
.lightbox img{max-width:90vw;max-height:90vh;border-radius:12px}
.toast{position:fixed;top:16px;right:16px;z-index:9999;background:var(--card);border:1px solid var(--border);padding:12px 16px;border-radius:10px;font-size:13px;transform:translateX(120%);transition:transform .3s;box-shadow:0 8px 30px rgba(0,0,0,.3);max-width:300px}
.toast.show{transform:translateX(0)}
.toast.error{border-left:3px solid var(--red)}
.toast.success{border-left:3px solid var(--green)}
@media(max-width:480px){.profile-pic{width:80px;height:80px}.stat-card{padding:10px 14px;min-width:70px}.stat-value{font-size:18px}}
</style>
</head>
<body>

<div id="toast" class="toast"></div>

<header class="header">
<div class="header-inner">
<div class="header-logo">
<img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Profile" class="header-avatar" width="34" height="34">
<span class="header-title">Verification Hub</span>
</div>
<button class="theme-btn" onclick="toggleTheme()" id="themeIcon" aria-label="Toggle theme">🌙</button>
</div>
</header>

<main class="container" style="padding-top:8px">

<section class="profile">
<div class="profile-pic-wrap">
<img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Baiilla Maach" class="profile-pic" width="96" height="96">
<div class="verified-badge">
<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
</div>
</div>
<h1 class="profile-name">Baiilla Maach Official</h1>
<p class="profile-bio">Official Entertainment Profile | Bangladesh</p>
<div class="stats">
<div class="stat-card"><div class="stat-value" id="statFollowers">0</div><div class="stat-label">Followers</div></div>
<div class="stat-card"><div class="stat-value" id="statFollowing">0</div><div class="stat-label">Following</div></div>
<div class="stat-card"><div class="stat-value" id="statLikes">0</div><div class="stat-label">Likes</div></div>
</div>
<div style="display:flex;gap:6px;justify-content:center">
<span class="badge badge-green">Verified</span>
<span class="badge badge-purple">Creator</span>
</div>
</section>

<section class="card" style="border-left:3px solid var(--red)" id="fakeSection">
<div class="section-hdr">
<span style="font-size:20px">⚠️</span>
<div><h2 style="color:#fca5a5">Fake Accounts Detected</h2></div>
<span class="badge badge-red">2 Active</span>
</div>
<div id="fakeCards"></div>
<audio id="fakeVoice" src="/assets/7%20lak%20like%20but%20its%20fake.mp3" preload="none"></audio>
</section>

<section id="musicSection" style="display:none"></section>

<section class="card" style="border-left:3px solid var(--green)">
<div class="section-hdr">
<span style="font-size:20px">✓</span>
<div><h2 style="color:#6ee7b7">Official Accounts</h2></div>
</div>
<div id="officialCards"></div>
</section>

<section class="card">
<div class="section-hdr"><span style="font-size:20px">📸</span><div><h2>Photo Gallery</h2></div></div>
<div class="gallery-grid" id="galleryGrid"></div>
</section>

</main>

<div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
<img src="" alt="Preview" id="lightboxImg">
</div>

<script>
// Theme
var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
function toggleTheme(){isDark=!isDark;var t=isDark?'dark':'light';document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t);document.getElementById('themeIcon').textContent=isDark?'🌙':'☀️';document.querySelector('meta[name="theme-color"]').content=isDark?'#0f0f1a':'#f5f5f7'}
document.getElementById('themeIcon').textContent = isDark ? '🌙' : '☀️';

// Toast
function toast(m,t){var e=document.getElementById('toast');e.textContent=m;e.className='toast show '+(t||'');setTimeout(function(){e.classList.remove('show')},2500)}

// Animated Stats
(function(){
var targets=[5000,0,50000];
var ids=['statFollowers','statFollowing','statLikes'];
targets.forEach(function(t,i){animateCount(ids[i],0,t,1500)});
function animateCount(id,s,e,d){var el=document.getElementById(id);if(!el)return;var r=e-s,st=null;function step(ts){if(!st)st=ts;var p=Math.min((ts-st)/d,1);el.textContent=Math.floor(s+r*(1-Math.pow(1-p,3))).toLocaleString();if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)}
})();

// Fake Accounts
(function(){
var data=[{u:'@baiilla_mach',url:'https://tiktok.com/@baiilla_mach',reason:'Copies official content',level:'Critical'},{u:'@hammad_fams0',url:'https://tiktok.com/@hammad_fams0',reason:'Uses official name to mislead',level:'High'}];
var c=document.getElementById('fakeCards');
c.innerHTML=data.map(function(a,i){return'<div class="fake-card"><div class="fake-card-user">'+a.u+' <span class="badge badge-red">'+a.level+'</span></div><div class="fake-card-reason">⚠ '+a.reason+'</div><div class="fake-actions"><a href="'+a.url+'" target="_blank" class="btn btn-danger btn-sm">Report</a><button onclick="navigator.clipboard.writeText(\''+a.u+'\').then(function(){toast(\'Copied!\',\'success\')})" class="btn btn-ghost btn-sm">Copy</button></div></div>'}).join('')
})();

// Official Accounts
(function(){
document.getElementById('officialCards').innerHTML=[
{p:'TikTok',u:'@baiillamaach_official',f:'5,000',url:'https://tiktok.com/@baiillamaach_official'},
{p:'Facebook',u:'Baiilla Maach Official',f:'Growing',url:'https://www.facebook.com/profile.php?id=61575202118828'}
].map(function(a){return'<div class="official-card"><div style="flex:1"><div class="official-name">'+a.u+' <span class="badge badge-green">✓</span></div><div class="official-followers">'+a.f+' followers</div></div><a href="'+a.url+'" target="_blank" class="btn btn-success btn-sm">Follow</a></div>'}).join('')
})();

// Gallery
var galleryData = ${galleryJSON};
(function(){
var g=document.getElementById('galleryGrid');
if(galleryData.length===0){g.innerHTML='<p style="color:var(--text3);text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>';return}
g.innerHTML=galleryData.map(function(p){return'<div class="gallery-item" onclick="openLightbox(\''+p.src+'\')"><img src="'+p.src+'" alt="Photo" loading="lazy"></div>'}).join('')
})();

function openLightbox(src){document.getElementById('lightboxImg').src=src;document.getElementById('lightbox').classList.add('active')}

// Music Player
var songsData = ${songsJSON};
if(songsData.length>0){
var s=document.getElementById('musicSection');
s.style.display='block';
var current=-1,playing=false;
s.innerHTML='<div class="music-player"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><span style="font-size:16px">🎵</span><span style="font-weight:700;font-size:15px">Cover Music</span><span style="font-size:11px;opacity:.6;margin-left:auto">'+songsData.length+' tracks</span></div><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div class="album-art" id="albumArt"><span>🎵</span></div><div style="flex:1"><div id="curTitle" style="font-weight:600;font-size:14px">Select a Song</div><div id="curArtist" style="font-size:11px;opacity:.6">Cover Music</div></div><button class="play-btn" id="playBtn" onclick="toggleMusic()">▶️</button></div><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:10px;opacity:.7;min-width:30px" id="curTime">0:00</span><div class="progress-bar" onclick="seekMusic(event)"><div class="progress-fill" id="progFill"></div></div><span style="font-size:10px;opacity:.7;min-width:30px;text-align:right" id="totTime">0:00</span></div><div class="song-list">'+songsData.map(function(sg,i){return'<div class="song-item" onclick="playSong('+i+')" id="song-'+i+'"><span style="opacity:.5;font-size:11px;width:24px">'+String(i+1).padStart(2,'0')+'</span><span style="flex:1;font-size:13px">'+sg.title+'</span><span style="font-size:11px;opacity:.4">▶</span></div>'}).join('')+'</div><audio id="musicAudio" preload="none"></audio></div>';
window.playSong=function(i){var a=document.getElementById('musicAudio');if(current===i){toggleMusic();return}current=i;a.src=songsData[i].audioUrl;document.getElementById('curTitle').textContent=songsData[i].title;document.getElementById('curArtist').textContent=songsData[i].artist;document.getElementById('albumArt').innerHTML=songsData[i].coverUrl?'<img src="'+songsData[i].coverUrl+'" alt="Cover">':'<span>🎵</span>';document.querySelectorAll('.song-item').forEach(function(e,j){e.classList.toggle('active',j===i)});a.play().then(function(){playing=true;document.getElementById('playBtn').textContent='⏸️'}).catch(function(){toast('Error','error')});a.ontimeupdate=function(){if(a.duration){document.getElementById('progFill').style.width=(a.currentTime/a.duration*100)+'%';document.getElementById('curTime').textContent=fmt(a.currentTime)}};a.onloadedmetadata=function(){document.getElementById('totTime').textContent=fmt(a.duration)};a.onended=function(){playing=false;document.getElementById('playBtn').textContent='▶️';current=-1}};
window.toggleMusic=function(){var a=document.getElementById('musicAudio');if(!a.src||current===-1){toast('Select a song','error');return}if(playing){a.pause();playing=false;document.getElementById('playBtn').textContent='▶️'}else{a.play().then(function(){playing=true;document.getElementById('playBtn').textContent='⏸️'})}};
window.seekMusic=function(e){var a=document.getElementById('musicAudio');if(!a.duration)return;a.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*a.duration};
function fmt(s){if(isNaN(s))return'0:00';return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
}

// Fake voice
var fvp=false;
window.toggleFakeVoice=function(){var a=document.getElementById('fakeVoice');if(fvp){a.pause();a.currentTime=0;fvp=false}else{a.play().then(function(){fvp=true}).catch(function(){})};a.onended=function(){fvp=false}};

document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('lightbox').classList.remove('active')});
</script>
</body>
</html>`;
}

// ============ SERVER ============
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const pu = url.parse(req.url, true);
    const pn = pu.pathname;
    const mt = req.method;
    const ck = parseCookies(req.headers.cookie);

    // Static assets
    if (pn.startsWith('/assets/')) {
        const ap = path.join(__dir, decodeURIComponent(pn));
        if (!ap.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
        if (!fs.existsSync(ap)) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(ap).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=86400'
        });
        fs.createReadStream(ap).pipe(res);
        return;
    }

    // Admin
    if (pn === '/admin' && mt === 'GET') {
        const s = getSession(ck.sessionId);
        if (s) {
            const p = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(getAdminHTML(p));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getLoginHTML());
        return;
    }

    if (pn === '/admin/login' && mt === 'POST') {
        let b = '';
        req.on('data', c => b += c);
        req.on('end', async () => {
            const p = new URLSearchParams(b);
            if (await verifyAdmin(p.get('username'), p.get('password'))) {
                const sid = createSession(p.get('username'));
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=' + sid + ';HttpOnly;Path=/;Max-Age=7200;SameSite=Lax' });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(getLoginHTML('Invalid credentials'));
            }
        });
        return;
    }

    if (pn === '/admin/logout') {
        sessions.delete(ck.sessionId);
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' });
        res.end();
        return;
    }

    if (pn === '/admin/upload' && mt === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        const fm = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true, maxFileSize: MAX_FILE_SIZE });
        fm.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(302, { 'Location': '/admin?err=upload' }); res.end(); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf || !pf.originalFilename) { res.writeHead(302, { 'Location': '/admin?err=nofile' }); res.end(); return; }
            const ext = path.extname(pf.originalFilename).toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) { res.writeHead(302, { 'Location': '/admin?err=type' }); res.end(); return; }
            const fn = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext;
            fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
            const caption = Array.isArray(fields.caption) ? fields.caption[0] : (fields.caption || '');
            await savePhoto({ path: '/assets/gallery/' + fn, caption });
            res.writeHead(302, { 'Location': '/admin?msg=uploaded' });
            res.end();
        });
        return;
    }

    if (pn === '/admin/delete' && mt === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        let b = '';
        req.on('data', c => b += c);
        req.on('end', async () => {
            const p = new URLSearchParams(b);
            try {
                const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(p.get('photoId')) });
                if (photo) { const fp = path.join(__dir, photo.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
                await deletePhoto(p.get('photoId'));
            } catch (e) {}
            res.writeHead(302, { 'Location': '/admin?msg=deleted' });
            res.end();
        });
        return;
    }

    // Homepage
    if (pn === '/' || pn === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(photos));
        return;
    }

    res.writeHead(404);
    res.end('404');
});

async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('\n✅ Server: http://localhost:' + PORT);
        console.log('👤 Admin: http://localhost:' + PORT + '/admin (admin / admin123)\n');
    });
}
start().catch(console.error);

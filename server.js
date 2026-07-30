const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve();
const ASSETS = path.join(ROOT, 'assets');
const MUSIC = path.join(ASSETS, 'covermusic');

[ASSETS, MUSIC].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const ADMIN = {
    user: 'admin',
    pass: bcrypt.hashSync('admin123', 10)
};

const sessions = new Map();

function newSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { u, t: Date.now() });
    setTimeout(() => sessions.delete(id), 7200000);
    return id;
}

function checkSession(id) {
    const s = sessions.get(id);
    if (!s || Date.now() - s.t > 7200000) {
        sessions.delete(id);
        return null;
    }
    return s;
}

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(p => {
        const [k, v] = p.split('=');
        c[k.trim()] = (v || '').trim();
    });
    return c;
}

function getMusicFiles() {
    try {
        if (!fs.existsSync(MUSIC)) return [];
        const files = fs.readdirSync(MUSIC);
        const audio = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.weba'];
        const image = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const groups = {};
        
        files.forEach(f => {
            const ext = path.extname(f).toLowerCase();
            const base = path.basename(f, ext);
            if (!groups[base]) groups[base] = { a: null, i: null };
            if (audio.includes(ext)) groups[base].a = f;
            if (image.includes(ext)) groups[base].i = f;
        });

        return Object.entries(groups)
            .filter(([_, v]) => v.a)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                name: base.replace(/[-_]/g, ' '),
                audio: `/assets/covermusic/${v.a}`,
                cover: v.i ? `/assets/covermusic/${v.i}` : null
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        return [];
    }
}

function getHomePage() {
    const songs = getMusicFiles();
    
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh}
.nav{background:rgba(0,0,0,0.9);padding:12px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #222}
.logo{width:40px;height:40px;border-radius:50%;background:#1db954;display:flex;align-items:center;justify-content:center}
.main{padding:20px;max-width:900px;margin:0 auto}
.header{text-align:center;padding:40px 0}
.avatar{width:120px;height:120px;border-radius:50%;background:linear-gradient(45deg,#1db954,#1ed760);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:40px}
.card{background:#111;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #222}
.card-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.card-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.info-grid{grid-template-columns:1fr}}
.info-item{background:#1a1a1a;padding:12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
.label{font-size:12px;color:#888;text-transform:uppercase}
.value{font-weight:600}
.link-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px}
.link-btn.green{background:#1db954;color:#000}
.link-btn.red{background:#ff4444;color:#fff}
.link-btn.blue{background:#1877f2;color:#fff}
.alert{background:rgba(255,68,68,0.1);border:1px solid #ff4444;border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:12px}
.fake-list{display:grid;gap:16px}
.fake-item{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;position:relative;overflow:hidden}
.fake-item::after{content:'FAKE';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:80px;font-weight:900;color:rgba(255,0,0,0.03);pointer-events:none}
.fake-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.fake-badge{background:#ff4444;color:#fff;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase}
.fake-info{display:grid;gap:8px;margin-bottom:12px}
.fake-row{display:flex;justify-content:space-between;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:13px}
.fake-actions{display:flex;gap:8px}
.btn{flex:1;padding:10px;border-radius:20px;border:none;font-weight:600;font-size:13px;cursor:pointer;text-decoration:none;text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:4px}
.btn-report{background:#ff4444;color:#fff}
.btn-copy{background:#333;color:#fff;border:1px solid #555}
.btn-copy.copied{background:#1db954;border-color:#1db954}
.music-section{background:#111;border-radius:16px;overflow:hidden}
.music-header{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;background:#1a1a1a}
.now-playing{display:flex;gap:16px;padding:20px}
.album-art{width:120px;height:120px;border-radius:8px;background:linear-gradient(45deg,#1db954,#1ed760);display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;overflow:hidden}
.album-art img{width:100%;height:100%;object-fit:cover}
.track-info{flex:1;display:flex;flex-direction:column;justify-content:center}
.track-name{font-size:18px;font-weight:700;margin-bottom:4px}
.track-artist{font-size:13px;color:#aaa;margin-bottom:12px}
.progress-bar{width:100%;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;cursor:pointer;margin:8px 0}
.progress-fill{height:100%;background:#1db954;border-radius:2px;width:0;transition:width 0.1s}
.time{display:flex;justify-content:space-between;font-size:11px;color:#888}
.controls{display:flex;align-items:center;gap:12px;margin:8px 0}
.ctrl-btn{background:none;border:none;color:#fff;cursor:pointer;padding:4px;border-radius:50%;font-size:16px}
.ctrl-btn:hover{color:#1db954}
.play-btn{background:#fff;color:#000;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px}
.volume{display:flex;align-items:center;gap:8px;font-size:14px}
.vol-slider{width:80px;height:3px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.2);border-radius:2px;outline:none}
.vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer}
.playlist{max-height:320px;overflow-y:auto}
.playlist-item{display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);transition:background 0.2s}
.playlist-item:hover{background:rgba(255,255,255,0.05)}
.playlist-item.active{background:rgba(29,185,84,0.1)}
.playlist-num{width:24px;text-align:center;color:#888;font-size:13px}
.playlist-cover{width:36px;height:36px;border-radius:4px;background:#222;overflow:hidden;flex-shrink:0}
.playlist-cover img{width:100%;height:100%;object-fit:cover}
.playlist-details{flex:1;min-width:0}
.playlist-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.playlist-artist{font-size:12px;color:#888}
.eq{display:none;gap:2px;align-items:flex-end;height:14px}
.playlist-item.active .eq{display:flex}
.eq-bar{width:3px;background:#1db954;border-radius:1px;animation:eq 0.8s infinite}
.eq-bar:nth-child(1){animation-delay:0s}
.eq-bar:nth-child(2){animation-delay:0.2s}
.eq-bar:nth-child(3){animation-delay:0.4s}
.eq-bar:nth-child(4){animation-delay:0.6s}
@keyframes eq{0%,100%{height:4px}50%{height:14px}}
.footer{text-align:center;padding:30px;color:#666;font-size:13px}
</style>
</head>
<body>
<div class="nav">
    <div class="logo">🔒</div>
    <span style="font-weight:700">Verification Hub</span>
</div>

<div class="main">
    <div class="header">
        <div class="avatar">✓</div>
        <h1 style="font-size:2em;margin-bottom:8px">Baiilla Maach Official</h1>
        <p style="color:#aaa;margin-bottom:16px">Official Entertainment Profile</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <a href="#" class="link-btn green">✓ Verified Official</a>
            <a href="#" class="link-btn red">✦ Entertainment</a>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="link-btn" style="background:#000;border:1px solid #fff">TikTok</a>
            <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="link-btn blue">Facebook</a>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div class="card-icon" style="background:#1db954">✓</div>
            <h2 style="font-size:1.2em">Official Verified Account</h2>
        </div>
        <div style="background:rgba(29,185,84,0.1);border:1px solid #1db954;border-radius:12px;padding:16px;margin-bottom:16px">
            <span style="color:#1db954;font-weight:700">✅ Identity Verified - The Only Authentic Account</span>
        </div>
        <div class="info-grid">
            <div class="info-item">
                <span class="label">Username</span>
                <span class="value">@baiillamaach_official</span>
            </div>
            <div class="info-item">
                <span class="label">Platforms</span>
                <span class="value">TikTok • Facebook</span>
            </div>
            <div class="info-item">
                <span class="label">Status</span>
                <span class="value" style="color:#1db954">● Active & Verified</span>
            </div>
            <div class="info-item">
                <span class="label">Security</span>
                <span class="value" style="color:#1db954">Safe</span>
            </div>
        </div>
        <div style="text-align:center;margin-top:16px">
            <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="link-btn green" style="font-size:16px;padding:12px 28px">Follow Official Account</a>
        </div>
    </div>

    <div style="background:rgba(255,68,68,0.05);border:1px solid #ff4444;border-radius:16px;padding:24px;margin-bottom:24px">
        <div class="card-header">
            <div class="card-icon" style="background:#ff4444">⚠</div>
            <h2 style="font-size:1.2em">Fake Accounts Detected</h2>
        </div>
        
        <div class="alert">
            <span style="font-size:24px">🚨</span>
            <div>
                <h3 style="color:#ff4444">2 Fake Accounts Found</h3>
                <p style="color:#ff6666;font-size:13px">These are NOT affiliated with Baiilla Maach. Report them immediately.</p>
            </div>
        </div>

        <div class="fake-list">
            <div class="fake-item">
                <div class="fake-header">
                    <span style="font-weight:700;color:#ff4444">⚠ Fake Account #1</span>
                    <span class="fake-badge">Dangerous</span>
                </div>
                <div class="fake-info">
                    <div class="fake-row">
                        <span>Platform</span>
                        <span style="font-weight:600">TikTok</span>
                    </div>
                    <div class="fake-row">
                        <span>Username</span>
                        <span style="font-weight:600">@baiilla_mach</span>
                    </div>
                    <div class="fake-row">
                        <span>Status</span>
                        <span style="color:#ff4444">Active Threat</span>
                    </div>
                    <div style="background:rgba(255,68,68,0.1);padding:10px;border-radius:6px;margin-top:8px;font-size:13px">
                        ⚠ Copies official logo and content to deceive followers.
                    </div>
                </div>
                <div class="fake-actions">
                    <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-report">🚨 Report</a>
                    <button class="btn btn-copy" onclick="copyText('@baiilla_mach', this)">📋 Copy Username</button>
                </div>
            </div>

            <div class="fake-item">
                <div class="fake-header">
                    <span style="font-weight:700;color:#ff4444">⚠ Fake Account #2</span>
                    <span class="fake-badge">Dangerous</span>
                </div>
                <div class="fake-info">
                    <div class="fake-row">
                        <span>Platform</span>
                        <span style="font-weight:600">TikTok</span>
                    </div>
                    <div class="fake-row">
                        <span>Username</span>
                        <span style="font-weight:600">@hammad_fams0</span>
                    </div>
                    <div class="fake-row">
                        <span>Status</span>
                        <span style="color:#ff4444">Active Threat</span>
                    </div>
                    <div style="background:rgba(255,68,68,0.1);padding:10px;border-radius:6px;margin-top:8px;font-size:13px">
                        ⚠ Uses official name and photo to mislead followers.
                    </div>
                </div>
                <div class="fake-actions">
                    <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-report">🚨 Report</a>
                    <button class="btn btn-copy" onclick="copyText('@hammad_fams0', this)">📋 Copy Username</button>
                </div>
            </div>
        </div>
    </div>

    ${songs.length > 0 ? `
    <div class="music-section">
        <div class="music-header">
            <span style="font-weight:700">🎵 Playlist</span>
            <span style="color:#888;font-size:13px">${songs.length} songs</span>
        </div>
        <div class="now-playing">
            <div class="album-art" id="art">
                <span style="font-size:30px">🎵</span>
            </div>
            <div class="track-info">
                <div class="track-name" id="title">Select a song</div>
                <div class="track-artist" id="artist">Cover Songs Collection</div>
                <div class="progress-bar" id="pbar" onclick="seek(event)">
                    <div class="progress-fill" id="pfill"></div>
                </div>
                <div class="time">
                    <span id="ctime">0:00</span>
                    <span id="ttime">0:00</span>
                </div>
                <div class="controls">
                    <button class="ctrl-btn" onclick="prev()">⏮</button>
                    <button class="play-btn" id="playbtn" onclick="toggle()">▶</button>
                    <button class="ctrl-btn" onclick="next()">⏭</button>
                </div>
                <div class="volume">
                    <span>🔊</span>
                    <input type="range" class="vol-slider" min="0" max="100" value="70" oninput="setVolume(this.value)">
                </div>
            </div>
        </div>
        <div class="playlist">
            ${songs.map((s, i) => `
            <div class="playlist-item" data-idx="${i}" data-audio="${s.audio}" data-cover="${s.cover || ''}" onclick="play(${i})">
                <span class="playlist-num">${(i+1).toString().padStart(2,'0')}</span>
                <div class="playlist-cover">
                    ${s.cover ? `<img src="${s.cover}" alt="">` : '<span style="font-size:16px">🎵</span>'}
                </div>
                <div class="playlist-details">
                    <div class="playlist-title">${s.name}</div>
                    <div class="playlist-artist">Cover Song</div>
                </div>
                <div class="eq">
                    <div class="eq-bar"></div>
                    <div class="eq-bar"></div>
                    <div class="eq-bar"></div>
                    <div class="eq-bar"></div>
                </div>
            </div>`).join('')}
        </div>
    </div>
    ` : ''}
</div>

<div class="footer">
    <p>Baiilla Maach Official • Verification Hub</p>
</div>

<audio id="audio" preload="auto"></audio>

<script>
const audio = document.getElementById('audio');
audio.volume = 0.7;
let currentIndex = -1;
let isPlaying = false;
const items = document.querySelectorAll('.playlist-item');

function play(index) {
    if (index === currentIndex) {
        toggle();
        return;
    }
    currentIndex = index;
    const item = items[index];
    audio.src = item.dataset.audio;
    audio.load();
    
    document.getElementById('title').textContent = item.querySelector('.playlist-title').textContent;
    document.getElementById('artist').textContent = item.querySelector('.playlist-artist').textContent;
    
    const art = document.getElementById('art');
    if (item.dataset.cover) {
        art.innerHTML = '<img src="' + item.dataset.cover + '" alt="" style="width:100%;height:100%;object-fit:cover">';
    } else {
        art.innerHTML = '<span style="font-size:30px">🎵</span>';
    }
    
    items.forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    
    audio.play().then(() => {
        isPlaying = true;
        updatePlayBtn();
    }).catch(e => {
        console.log('Play failed:', e);
        isPlaying = false;
        updatePlayBtn();
    });
}

function toggle() {
    if (!audio.src) {
        if (items.length > 0) play(0);
        return;
    }
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        audio.play().then(() => {
            isPlaying = true;
        }).catch(() => {
            isPlaying = false;
        });
    }
    updatePlayBtn();
}

function updatePlayBtn() {
    document.getElementById('playbtn').textContent = isPlaying ? '⏸' : '▶';
}

function next() {
    if (items.length > 0) {
        play((currentIndex + 1) % items.length);
    }
}

function prev() {
    if (items.length > 0) {
        play(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
    }
}

function setVolume(v) {
    audio.volume = v / 100;
}

function seek(e) {
    if (audio.duration) {
        const rect = e.target.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    }
}

audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        document.getElementById('pfill').style.width = percent + '%';
        const m = Math.floor(audio.currentTime / 60);
        const s = Math.floor(audio.currentTime % 60);
        document.getElementById('ctime').textContent = m + ':' + s.toString().padStart(2, '0');
    }
});

audio.addEventListener('loadedmetadata', () => {
    const m = Math.floor(audio.duration / 60);
    const s = Math.floor(audio.duration % 60);
    document.getElementById('ttime').textContent = m + ':' + s.toString().padStart(2, '0');
});

audio.addEventListener('ended', next);

audio.addEventListener('error', () => {
    isPlaying = false;
    updatePlayBtn();
    document.getElementById('title').textContent = 'Error';
    document.getElementById('artist').textContent = 'Cannot play this file';
});

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Copy Username';
            btn.classList.remove('copied');
        }, 2000);
    });
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        toggle();
    }
});
</script>
</body>
</html>`;
}

function getLoginPage(error = '') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{background:#111;border:1px solid #222;border-radius:16px;padding:40px;width:100%;max-width:380px}
h2{color:#1db954;text-align:center;margin-bottom:30px;font-size:24px}
.field{margin-bottom:20px}
label{display:block;color:#888;margin-bottom:8px;font-size:13px;text-transform:uppercase}
input{width:100%;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;font-size:16px;outline:none}
input:focus{border-color:#1db954}
.btn{width:100%;padding:14px;background:#1db954;color:#000;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer}
.btn:hover{background:#1ed760}
.error{background:rgba(255,68,68,0.1);border:1px solid #ff4444;color:#ff4444;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px}
.back{text-align:center;margin-top:20px}
a{color:#666;text-decoration:none}
a:hover{color:#1db954}
</style>
</head>
<body>
<div class="box">
    <h2>🔒 Admin Login</h2>
    ${error ? '<div class="error">' + error + '</div>' : ''}
    <form method="POST" action="/admin/login">
        <div class="field">
            <label>Username</label>
            <input type="text" name="username" required autocomplete="off">
        </div>
        <div class="field">
            <label>Password</label>
            <input type="password" name="password" required>
        </div>
        <button type="submit" class="btn">Login</button>
    </form>
    <div class="back"><a href="/">← Back to Home</a></div>
</div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const cookies = parseCookies(req.headers.cookie);

    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const filePath = path.join(ROOT, pathname);
        if (!filePath.startsWith(ASSETS)) {
            res.writeHead(403);
            res.end();
            return;
        }
        
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.aac': 'audio/aac',
                '.flac': 'audio/flac',
                '.opus': 'audio/opus',
                '.weba': 'audio/webm'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(filePath);
            
            // Handle range requests for audio
            if (req.headers.range && (ext === '.mp3' || ext === '.wav' || ext === '.ogg')) {
                const range = req.headers.range;
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunkSize = end - start + 1;
                
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': contentType
                });
                
                fs.createReadStream(filePath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stat.size,
                    'Cache-Control': 'public, max-age=86400',
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(filePath).pipe(res);
            }
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }

    // Admin routes
    if (pathname === '/admin' && req.method === 'GET') {
        const session = checkSession(cookies.sessionId);
        if (session) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}.card{background:#111;padding:40px;border-radius:16px;border:1px solid #222}a{color:#1db954;text-decoration:none}</style></head><body><div class="card"><h2>✅ Welcome Admin</h2><p style="margin:20px 0">You are logged in successfully.</p><div style="display:flex;gap:12px;justify-content:center"><a href="/admin/logout">Logout</a><a href="/">Home</a></div></div></body></html>`);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getLoginPage());
        return;
    }

    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            if (username === ADMIN.user && await bcrypt.compare(password, ADMIN.pass)) {
                const sessionId = newSession(username);
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=7200; SameSite=Lax`
                });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getLoginPage('Invalid username or password'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
        });
        res.end();
        return;
    }

    // Home page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(getHomePage());
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:80px;color:#1db954;margin-bottom:10px}p{color:#888}a{color:#1db954}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>`);
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Error:', err);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
    console.error('Server error:', err);
});

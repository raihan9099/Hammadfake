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
const UPLOADS = path.join(ASSETS, 'uploads');

[ASSETS, MUSIC, UPLOADS].forEach(d => {
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
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {
    --primary: #1db954;
    --danger: #ff4444;
    --warning: #ffa500;
    --bg: #0a0a0a;
    --card: #111111;
    --border: #222222;
    --text: #ffffff;
    --muted: #888888;
}

*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6}

/* ============ NAVIGATION ============ */
.nav{background:rgba(0,0,0,0.95);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:1000;backdrop-filter:blur(20px)}
.nav-left{display:flex;align-items:center;gap:12px}
.nav-logo{width:40px;height:40px;border-radius:50%;background:linear-gradient(45deg,#1db954,#1ed760);display:flex;align-items:center;justify-content:center;font-size:20px}
.nav-title{font-weight:700;font-size:16px}
.nav-right{display:flex;align-items:center;gap:16px}
.nav-link{color:var(--text);text-decoration:none;font-size:14px;padding:8px 16px;border-radius:20px;transition:all 0.3s}
.nav-link:hover{background:var(--border)}
.nav-link.active{background:var(--primary);color:#000}
.lang-switch{background:var(--border);border:none;color:var(--text);padding:6px 12px;border-radius:16px;cursor:pointer;font-size:13px}

/* ============ HERO SECTION ============ */
.hero{text-align:center;padding:60px 20px 40px;background:linear-gradient(180deg,#0a0a0a 0%,#111 100%)}
.avatar-container{position:relative;display:inline-block;margin-bottom:20px}
.avatar{width:140px;height:140px;border-radius:50%;background:linear-gradient(45deg,#1db954,#1ed760);display:flex;align-items:center;justify-content:center;font-size:50px;border:3px solid var(--primary);box-shadow:0 0 30px rgba(29,185,84,0.3)}
.verified-badge{position:absolute;bottom:10px;right:10px;background:var(--primary);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #000}
.name-bn{font-size:2.5em;font-weight:800;margin-bottom:8px;background:linear-gradient(45deg,#1db954,#1ed760);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.name-en{font-size:1.2em;color:var(--muted);margin-bottom:16px}
.bio{color:#aaa;max-width:500px;margin:0 auto 20px;font-size:15px}
.stats{display:flex;justify-content:center;gap:30px;margin:20px 0}
.stat-item{text-align:center}
.stat-value{font-size:24px;font-weight:700;color:var(--primary)}
.stat-label{font-size:12px;color:var(--muted);text-transform:uppercase}
.badges{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:16px 0}
.badge{padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600}
.badge-verified{background:rgba(29,185,84,0.2);color:var(--primary);border:1px solid var(--primary)}
.badge-artist{background:rgba(255,165,0,0.2);color:var(--warning);border:1px solid var(--warning)}
.badge-bd{background:rgba(0,100,0,0.2);color:#00ff00;border:1px solid #006400}
.social-links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.social-btn{padding:10px 24px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px;transition:all 0.3s;display:inline-flex;align-items:center;gap:6px}
.social-btn.tiktok{background:#000;color:#fff;border:1px solid #fff}
.social-btn.tiktok:hover{background:#fff;color:#000}
.social-btn.fb{background:#1877f2;color:#fff}
.social-btn.fb:hover{background:#fff;color:#1877f2;border:1px solid #1877f2}
.social-btn.yt{background:#ff0000;color:#fff}
.social-btn.yt:hover{background:#fff;color:#ff0000;border:1px solid #ff0000}
.social-btn.ig{background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff}
.social-btn.ig:hover{opacity:0.9}

/* ============ MAIN CONTENT ============ */
.main{padding:20px;max-width:1000px;margin:0 auto}
.section{margin-bottom:30px}

/* ============ CARDS ============ */
.card{background:var(--card);border-radius:16px;padding:24px;border:1px solid var(--border);transition:transform 0.3s}
.card:hover{transform:translateY(-2px)}
.card-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}

/* ============ VERIFICATION TIMELINE ============ */
.timeline{position:relative;padding-left:30px}
.timeline::before{content:'';position:absolute;left:15px;top:0;bottom:0;width:2px;background:var(--border)}
.timeline-item{position:relative;margin-bottom:24px}
.timeline-dot{position:absolute;left:-22px;top:0;width:16px;height:16px;border-radius:50%;background:var(--primary)}
.timeline-content{background:var(--card);padding:16px;border-radius:12px;border:1px solid var(--border)}
.timeline-date{font-size:12px;color:var(--primary);margin-bottom:4px}

/* ============ ACHIEVEMENT GRID ============ */
.achievement-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.achievement-item{background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--border);transition:all 0.3s}
.achievement-item:hover{background:rgba(29,185,84,0.05);border-color:var(--primary)}
.achievement-icon{font-size:32px;margin-bottom:8px}
.achievement-name{font-weight:600;font-size:13px}
.achievement-count{font-size:20px;font-weight:700;color:var(--primary)}

/* ============ EVENT CARDS ============ */
.event-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.event-card{background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--border)}
.event-image{height:160px;background:linear-gradient(45deg,#1db954,#1ed760);display:flex;align-items:center;justify-content:center;font-size:48px}
.event-info{padding:16px}
.event-title{font-weight:700;margin-bottom:4px}
.event-date{font-size:13px;color:var(--primary);margin-bottom:8px}
.event-location{font-size:13px;color:var(--muted)}

/* ============ COLLABORATION SECTION ============ */
.collab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px}
.collab-item{text-align:center}
.collab-avatar{width:80px;height:80px;border-radius:50%;margin:0 auto 8px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:30px}
.collab-name{font-weight:600;font-size:13px}

/* ============ FAN MESSAGES ============ */
.fan-messages{max-height:300px;overflow-y:auto}
.fan-msg{background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;margin-bottom:8px;border-left:3px solid var(--primary)}
.fan-name{font-weight:600;color:var(--primary);font-size:13px}
.fan-text{font-size:14px;margin-top:4px}
.fan-time{font-size:11px;color:var(--muted);margin-top:4px}

/* ============ MERCHANDISE ============ */
.merch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.merch-item{background:var(--card);border-radius:12px;overflow:hidden;border:1px solid var(--border)}
.merch-image{height:180px;background:linear-gradient(45deg,#333,#444);display:flex;align-items:center;justify-content:center;font-size:48px}
.merch-info{padding:12px}
.merch-name{font-weight:600;margin-bottom:4px}
.merch-price{color:var(--primary);font-weight:700}

/* ============ FAQ ============ */
.faq-item{background:var(--card);border-radius:12px;margin-bottom:8px;border:1px solid var(--border);overflow:hidden}
.faq-question{padding:16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-weight:600}
.faq-answer{padding:0 16px 16px;display:none;color:var(--muted);font-size:14px}
.faq-item.open .faq-answer{display:block}

/* ============ CONTACT FORM ============ */
.contact-form{display:grid;gap:16px}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-label{font-size:13px;color:var(--muted);text-transform:uppercase}
.form-input{padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none}
.form-input:focus{border-color:var(--primary)}
.form-textarea{min-height:100px;resize:vertical}
.submit-btn{padding:12px 24px;background:var(--primary);color:#000;border:none;border-radius:24px;font-weight:700;cursor:pointer;font-size:14px;transition:all 0.3s}
.submit-btn:hover{background:#1ed760;transform:translateY(-2px)}

/* ============ LIVE INDICATOR ============ */
.live-indicator{display:inline-flex;align-items:center;gap:6px;background:rgba(255,0,0,0.1);color:#ff0000;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600}
.live-dot{width:8px;height:8px;border-radius:50%;background:#ff0000;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}

/* ============ COUNTDOWN ============ */
.countdown{display:flex;gap:12px;justify-content:center}
.countdown-item{text-align:center}
.countdown-value{font-size:36px;font-weight:700;color:var(--primary);background:rgba(29,185,84,0.1);padding:12px;border-radius:8px;min-width:70px}
.countdown-label{font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase}

/* ============ PROGRESS BARS ============ */
.progress-item{margin-bottom:12px}
.progress-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px}
.progress-track{width:100%;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:var(--primary);border-radius:3px;transition:width 1s ease}

/* ============ TABS ============ */
.tabs{display:flex;gap:4px;margin-bottom:20px;background:var(--card);padding:4px;border-radius:12px;border:1px solid var(--border)}
.tab{padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;transition:all 0.3s;flex:1;text-align:center}
.tab.active{background:var(--primary);color:#000;font-weight:600}
.tab-content{display:none}
.tab-content.active{display:block}

/* ============ MUSIC PLAYER ============ */
.music-section{background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--border)}
.music-header{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border)}
.now-playing{display:flex;gap:16px;padding:20px}
.album-art{width:120px;height:120px;border-radius:8px;background:linear-gradient(45deg,#1db954,#1ed760);display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;overflow:hidden}
.album-art img{width:100%;height:100%;object-fit:cover}
.track-info{flex:1;display:flex;flex-direction:column;justify-content:center}
.track-name{font-size:18px;font-weight:700;margin-bottom:4px}
.track-artist{font-size:13px;color:var(--muted);margin-bottom:12px}
.progress-bar{width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;cursor:pointer;margin:8px 0}
.progress-fill-music{height:100%;background:var(--primary);border-radius:2px;width:0;transition:width 0.1s}
.time{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.controls{display:flex;align-items:center;gap:12px;margin:8px 0}
.ctrl-btn{background:none;border:none;color:var(--text);cursor:pointer;padding:4px;border-radius:50%;font-size:16px;transition:all 0.2s}
.ctrl-btn:hover{color:var(--primary)}
.play-btn{background:#fff;color:#000;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:none;cursor:pointer;transition:transform 0.2s}
.play-btn:hover{transform:scale(1.1)}
.volume-control{display:flex;align-items:center;gap:8px;font-size:14px}
.vol-slider{width:80px;height:3px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.2);border-radius:2px;outline:none}
.vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer}
.playlist{max-height:320px;overflow-y:auto}
.playlist-item{display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);transition:background 0.2s}
.playlist-item:hover{background:rgba(255,255,255,0.05)}
.playlist-item.active{background:rgba(29,185,84,0.1)}
.playlist-num{width:24px;text-align:center;color:var(--muted);font-size:13px}
.playlist-cover{width:36px;height:36px;border-radius:4px;background:var(--border);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.playlist-cover img{width:100%;height:100%;object-fit:cover}
.playlist-details{flex:1;min-width:0}
.playlist-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.playlist-artist{font-size:12px;color:var(--muted)}
.eq{display:none;gap:2px;align-items:flex-end;height:14px}
.playlist-item.active .eq{display:flex}
.eq-bar{width:3px;background:var(--primary);border-radius:1px;animation:eq 0.8s infinite}
.eq-bar:nth-child(1){animation-delay:0s}
.eq-bar:nth-child(2){animation-delay:0.2s}
.eq-bar:nth-child(3){animation-delay:0.4s}
.eq-bar:nth-child(4){animation-delay:0.6s}
@keyframes eq{0%,100%{height:4px}50%{height:14px}}

/* ============ FOOTER ============ */
.footer{background:var(--card);border-top:1px solid var(--border);padding:40px 20px;text-align:center}
.footer-links{display:flex;justify-content:center;gap:24px;margin-bottom:20px;flex-wrap:wrap}
.footer-link{color:var(--muted);text-decoration:none;font-size:13px;transition:color 0.3s}
.footer-link:hover{color:var(--primary)}
.copyright{color:var(--muted);font-size:12px}

/* ============ SCROLLBAR ============ */
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--primary)}

/* ============ MOBILE RESPONSIVE ============ */
@media(max-width:768px){
    .nav{padding:10px 15px}
    .nav-right{gap:8px}
    .hero{padding:40px 15px 30px}
    .name-bn{font-size:2em}
    .stats{gap:20px}
    .stat-value{font-size:20px}
    .now-playing{flex-direction:column;align-items:center;text-align:center}
    .controls{justify-content:center}
    .countdown{gap:8px}
    .countdown-value{font-size:24px;min-width:60px;padding:8px}
}
</style>
</head>
<body>

<!-- ============ NAVIGATION ============ -->
<nav class="nav">
    <div class="nav-left">
        <div class="nav-logo">⭐</div>
        <span class="nav-title">Official Hub</span>
    </div>
    <div class="nav-right">
        <a href="#about" class="nav-link active">About</a>
        <a href="#music" class="nav-link">Music</a>
        <a href="#events" class="nav-link">Events</a>
        <a href="#contact" class="nav-link">Contact</a>
        <button class="lang-switch" onclick="toggleLang()">BN | EN</button>
    </div>
</nav>

<!-- ============ HERO SECTION ============ -->
<header class="hero">
    <div class="avatar-container">
        <div class="avatar">🎤</div>
        <div class="verified-badge">✓</div>
    </div>
    <h1 class="name-bn">বাইল্লা মাছ</h1>
    <h2 class="name-en">Baiilla Maach Official</h2>
    <p class="bio">🇧🇩 Bangladeshi Content Creator | Entertainer | Social Media Personality</p>
    
    <div class="stats">
        <div class="stat-item">
            <div class="stat-value">2.5M+</div>
            <div class="stat-label">Followers</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">500+</div>
            <div class="stat-label">Videos</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">50M+</div>
            <div class="stat-label">Views</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">5+</div>
            <div class="stat-label">Years</div>
        </div>
    </div>

    <div class="badges">
        <span class="badge badge-verified">✓ Verified Creator</span>
        <span class="badge badge-artist">🎵 Artist</span>
        <span class="badge badge-bd">🇧🇩 Bangladesh</span>
    </div>

    <div class="social-links">
        <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="social-btn tiktok">📱 TikTok</a>
        <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="social-btn fb">👍 Facebook</a>
        <a href="#" class="social-btn yt">▶️ YouTube</a>
        <a href="#" class="social-btn ig">📷 Instagram</a>
    </div>
</header>

<!-- ============ MAIN CONTENT ============ -->
<main class="main">

    <!-- FEATURE 1: ABOUT SECTION -->
    <section class="section" id="about">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(29,185,84,0.2)">👤</div>
                <h2>About Baiilla Maach</h2>
            </div>
            <p style="color:var(--muted);margin-bottom:16px">
                Baiilla Maach is one of Bangladesh's most beloved social media personalities, known for entertaining content, 
                musical talents, and genuine connection with fans. Based in Bangladesh, this creator has built a massive 
                following through authentic and engaging content across multiple platforms.
            </p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                    <div style="color:var(--muted);font-size:12px">📍 Location</div>
                    <div style="font-weight:600">Dhaka, Bangladesh</div>
                </div>
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                    <div style="color:var(--muted);font-size:12px">🗣️ Languages</div>
                    <div style="font-weight:600">বাংলা • English • Hindi</div>
                </div>
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                    <div style="color:var(--muted);font-size:12px">🎂 Joined</div>
                    <div style="font-weight:600">January 2020</div>
                </div>
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                    <div style="color:var(--muted);font-size:12px">💼 Category</div>
                    <div style="font-weight:600">Entertainment</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 2: VERIFICATION BADGE EXPLANATION -->
    <section class="section">
        <div class="card" style="border-color:var(--primary);background:rgba(29,185,84,0.05)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
                <span style="font-size:32px">✅</span>
                <div>
                    <h3 style="color:var(--primary)">Officially Verified Account</h3>
                    <p style="color:var(--muted);font-size:13px">This is the ONLY authentic Baiilla Maach account</p>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:8px">
                <div style="font-size:13px;color:var(--muted)">
                    <strong style="color:var(--text)">⚠️ Important:</strong> There are fake accounts impersonating Baiilla Maach. 
                    Always check for the verified badge. Report any suspicious accounts immediately.
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 3: CONTENT CATEGORIES -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,165,0,0.2)">🎬</div>
                <h2>Content Categories</h2>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
                <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:32px;margin-bottom:8px">😂</div>
                    <div style="font-weight:600">Comedy</div>
                </div>
                <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:32px;margin-bottom:8px">🎵</div>
                    <div style="font-weight:600">Music</div>
                </div>
                <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:32px;margin-bottom:8px">💃</div>
                    <div style="font-weight:600">Dance</div>
                </div>
                <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:32px;margin-bottom:8px">🎭</div>
                    <div style="font-weight:600">Drama</div>
                </div>
                <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:32px;margin-bottom:8px">📚</div>
                    <div style="font-weight:600">Education</div>
                </div>
                <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:32px;margin-bottom:8px">🎉</div>
                    <div style="font-weight:600">Lifestyle</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 4: ACHIEVEMENTS -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,215,0,0.2)">🏆</div>
                <h2>Achievements & Milestones</h2>
            </div>
            <div class="achievement-grid">
                <div class="achievement-item">
                    <div class="achievement-icon">🥇</div>
                    <div class="achievement-name">1M Followers</div>
                    <div class="achievement-count">2021</div>
                </div>
                <div class="achievement-item">
                    <div class="achievement-icon">🎖️</div>
                    <div class="achievement-name">Creator Award</div>
                    <div class="achievement-count">2022</div>
                </div>
                <div class="achievement-item">
                    <div class="achievement-icon">⭐</div>
                    <div class="achievement-name">Verified Badge</div>
                    <div class="achievement-count">2022</div>
                </div>
                <div class="achievement-item">
                    <div class="achievement-icon">💎</div>
                    <div class="achievement-name">2M Followers</div>
                    <div class="achievement-count">2023</div>
                </div>
                <div class="achievement-item">
                    <div class="achievement-icon">👑</div>
                    <div class="achievement-name">Top Creator BD</div>
                    <div class="achievement-count">2024</div>
                </div>
                <div class="achievement-item">
                    <div class="achievement-icon">🌟</div>
                    <div class="achievement-name">50M Total Views</div>
                    <div class="achievement-count">2024</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 5: FAKE ACCOUNT WARNING -->
    <section class="section">
        <div class="card" style="border-color:var(--danger);background:rgba(255,68,68,0.05)">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,68,68,0.3)">🚨</div>
                <h2 style="color:var(--danger)">Fake Account Alert</h2>
            </div>
            
            <div style="background:rgba(255,68,68,0.1);padding:16px;border-radius:12px;margin-bottom:16px;border:1px solid var(--danger)">
                <strong>⚠️ 2 Fake Accounts Detected</strong>
                <p style="font-size:13px;color:#ff6666;margin-top:4px">These accounts are NOT affiliated with the official Baiilla Maach</p>
            </div>

            <div style="display:grid;gap:12px">
                <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:12px;border:1px solid rgba(255,68,68,0.3)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <strong style="color:var(--danger)">⚠️ @baiilla_mach</strong>
                        <span style="background:var(--danger);color:#fff;padding:2px 10px;border-radius:10px;font-size:11px">FAKE</span>
                    </div>
                    <p style="font-size:13px;color:var(--muted);margin-bottom:8px">Platform: TikTok • Copies official content to deceive followers</p>
                    <div style="display:flex;gap:8px">
                        <a href="https://tiktok.com/@baiilla_mach" target="_blank" style="background:var(--danger);color:#fff;padding:8px 16px;border-radius:20px;text-decoration:none;font-size:13px;flex:1;text-align:center">🚨 Report</a>
                        <button onclick="copyText('@baiilla_mach',this)" style="background:#333;color:#fff;padding:8px 16px;border-radius:20px;border:1px solid #555;cursor:pointer;font-size:13px;flex:1">📋 Copy</button>
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:12px;border:1px solid rgba(255,68,68,0.3)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <strong style="color:var(--danger)">⚠️ @hammad_fams0</strong>
                        <span style="background:var(--danger);color:#fff;padding:2px 10px;border-radius:10px;font-size:11px">FAKE</span>
                    </div>
                    <p style="font-size:13px;color:var(--muted);margin-bottom:8px">Platform: TikTok • Uses official name and photo to mislead</p>
                    <div style="display:flex;gap:8px">
                        <a href="https://tiktok.com/@hammad_fams0" target="_blank" style="background:var(--danger);color:#fff;padding:8px 16px;border-radius:20px;text-decoration:none;font-size:13px;flex:1;text-align:center">🚨 Report</a>
                        <button onclick="copyText('@hammad_fams0',this)" style="background:#333;color:#fff;padding:8px 16px;border-radius:20px;border:1px solid #555;cursor:pointer;font-size:13px;flex:1">📋 Copy</button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 6: VERIFICATION TIMELINE -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(100,149,237,0.2)">📅</div>
                <h2>Verification Timeline</h2>
            </div>
            <div class="timeline">
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">January 2020</div>
                        <strong>Account Created</strong>
                        <p style="font-size:13px;color:var(--muted)">Started creating content on TikTok</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">June 2021</div>
                        <strong>Reached 1 Million Followers</strong>
                        <p style="font-size:13px;color:var(--muted)">First major milestone achieved</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">March 2022</div>
                        <strong>Received Verification Badge</strong>
                        <p style="font-size:13px;color:var(--muted)">Officially verified by platform</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">December 2023</div>
                        <strong>2.5 Million Followers</strong>
                        <p style="font-size:13px;color:var(--muted)">Continuing to grow and entertain</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 7: UPCOMING EVENTS WITH COUNTDOWN -->
    <section class="section" id="events">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,105,180,0.2)">🎪</div>
                <h2>Upcoming Events</h2>
                <span class="live-indicator"><span class="live-dot"></span> LIVE</span>
            </div>
            
            <div class="countdown" style="margin-bottom:24px">
                <div class="countdown-item">
                    <div class="countdown-value" id="days">00</div>
                    <div class="countdown-label">Days</div>
                </div>
                <div class="countdown-item">
                    <div class="countdown-value" id="hours">00</div>
                    <div class="countdown-label">Hours</div>
                </div>
                <div class="countdown-item">
                    <div class="countdown-value" id="minutes">00</div>
                    <div class="countdown-label">Minutes</div>
                </div>
                <div class="countdown-item">
                    <div class="countdown-value" id="seconds">00</div>
                    <div class="countdown-label">Seconds</div>
                </div>
            </div>

            <div class="event-grid">
                <div class="event-card">
                    <div class="event-image">🎉</div>
                    <div class="event-info">
                        <div class="event-title">Fan Meetup Dhaka 2024</div>
                        <div class="event-date">📅 December 15, 2024</div>
                        <div class="event-location">📍 Dhaka, Bangladesh</div>
                    </div>
                </div>
                <div class="event-card">
                    <div class="event-image">🎵</div>
                    <div class="event-info">
                        <div class="event-title">Live Music Session</div>
                        <div class="event-date">📅 January 10, 2025</div>
                        <div class="event-location">📍 Online Stream</div>
                    </div>
                </div>
                <div class="event-card">
                    <div class="event-image">🎬</div>
                    <div class="event-info">
                        <div class="event-title">Content Creator Workshop</div>
                        <div class="event-date">📅 February 20, 2025</div>
                        <div class="event-location">📍 Chittagong, Bangladesh</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 8: COLLABORATIONS -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(138,43,226,0.2)">🤝</div>
                <h2>Collaborations</h2>
            </div>
            <div class="collab-grid">
                <div class="collab-item">
                    <div class="collab-avatar">🎤</div>
                    <div class="collab-name">Artist A</div>
                </div>
                <div class="collab-item">
                    <div class="collab-avatar">🎭</div>
                    <div class="collab-name">Creator B</div>
                </div>
                <div class="collab-item">
                    <div class="collab-avatar">💃</div>
                    <div class="collab-name">Dancer C</div>
                </div>
                <div class="collab-item">
                    <div class="collab-avatar">🎵</div>
                    <div class="collab-name">Singer D</div>
                </div>
                <div class="collab-item">
                    <div class="collab-avatar">🎬</div>
                    <div class="collab-name">Director E</div>
                </div>
                <div class="collab-item">
                    <div class="collab-avatar">📱</div>
                    <div class="collab-name">Influencer F</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 9: BRAND PARTNERSHIPS -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,215,0,0.2)">💼</div>
                <h2>Brand Partnerships</h2>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;text-align:center">
                <div style="padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:36px">🏢</div>
                    <div style="font-weight:600;margin-top:8px">Brand 1</div>
                </div>
                <div style="padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:36px">🏪</div>
                    <div style="font-weight:600;margin-top:8px">Brand 2</div>
                </div>
                <div style="padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:36px">🏬</div>
                    <div style="font-weight:600;margin-top:8px">Brand 3</div>
                </div>
                <div style="padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:36px">🏭</div>
                    <div style="font-weight:600;margin-top:8px">Brand 4</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 10: SKILLS & TALENTS -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(0,206,209,0.2)">💪</div>
                <h2>Skills & Expertise</h2>
            </div>
            <div class="progress-item">
                <div class="progress-header"><span>Content Creation</span><span>95%</span></div>
                <div class="progress-track"><div class="progress-fill" style="width:95%"></div></div>
            </div>
            <div class="progress-item">
                <div class="progress-header"><span>Video Editing</span><span>88%</span></div>
                <div class="progress-track"><div class="progress-fill" style="width:88%"></div></div>
            </div>
            <div class="progress-item">
                <div class="progress-header"><span>Music Production</span><span>75%</span></div>
                <div class="progress-track"><div class="progress-fill" style="width:75%"></div></div>
            </div>
            <div class="progress-item">
                <div class="progress-header"><span>Public Speaking</span><span>82%</span></div>
                <div class="progress-track"><div class="progress-fill" style="width:82%"></div></div>
            </div>
            <div class="progress-item">
                <div class="progress-header"><span>Social Media Strategy</span><span>90%</span></div>
                <div class="progress-track"><div class="progress-fill" style="width:90%"></div></div>
            </div>
        </div>
    </section>

    <!-- FEATURE 11: MERCHANDISE -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,105,180,0.2)">🛍️</div>
                <h2>Official Merchandise</h2>
            </div>
            <div class="merch-grid">
                <div class="merch-item">
                    <div class="merch-image">👕</div>
                    <div class="merch-info">
                        <div class="merch-name">Limited Edition T-Shirt</div>
                        <div class="merch-price">৳ 599</div>
                    </div>
                </div>
                <div class="merch-item">
                    <div class="merch-image">🧢</div>
                    <div class="merch-info">
                        <div class="merch-name">Branded Cap</div>
                        <div class="merch-price">৳ 399</div>
                    </div>
                </div>
                <div class="merch-item">
                    <div class="merch-image">📱</div>
                    <div class="merch-info">
                        <div class="merch-name">Phone Case</div>
                        <div class="merch-price">৳ 299</div>
                    </div>
                </div>
                <div class="merch-item">
                    <div class="merch-image">☕</div>
                    <div class="merch-info">
                        <div class="merch-name">Coffee Mug</div>
                        <div class="merch-price">৳ 249</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 12: FAN MESSAGES -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,69,0,0.2)">💌</div>
                <h2>Fan Messages</h2>
            </div>
            <div class="fan-messages">
                <div class="fan-msg">
                    <div class="fan-name">Rahim Ahmed</div>
                    <div class="fan-text">ভাইয়া, আপনার ভিডিও দেখে অনেক হাসি পাই। অনেক অনেক ভালোবাসা! 🇧🇩</div>
                    <div class="fan-time">2 hours ago</div>
                </div>
                <div class="fan-msg">
                    <div class="fan-name">Fatema Khatun</div>
                    <div class="fan-text">You are the best content creator in Bangladesh! Keep inspiring us!</div>
                    <div class="fan-time">5 hours ago</div>
                </div>
                <div class="fan-msg">
                    <div class="fan-name">Sakib Hasan</div>
                    <div class="fan-text">আপনার কন্টেন্ট দেখে প্রতিদিন ভালো লাগে। দোয়া রইলো ভাইয়া!</div>
                    <div class="fan-time">1 day ago</div>
                </div>
                <div class="fan-msg">
                    <div class="fan-name">Nusrat Jahan</div>
                    <div class="fan-text">Love from Sylhet! Keep making amazing content ❤️</div>
                    <div class="fan-time">1 day ago</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 13: FAQ -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(70,130,180,0.2)">❓</div>
                <h2>Frequently Asked Questions</h2>
            </div>
            <div class="faq-item open">
                <div class="faq-question" onclick="toggleFaq(this)">
                    <span>How can I verify it's the real Baiilla Maach?</span>
                    <span>▼</span>
                </div>
                <div class="faq-answer">Always check for the blue verification badge. Only follow accounts listed on this official website.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question" onclick="toggleFaq(this)">
                    <span>How can I report a fake account?</span>
                    <span>▼</span>
                </div>
                <div class="faq-answer">Use the report button on the fake accounts listed above, or contact us through the form below.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question" onclick="toggleFaq(this)">
                    <span>How can I collaborate with Baiilla Maach?</span>
                    <span>▼</span>
                </div>
                <div class="faq-answer">Send your proposal through the contact form with details about your collaboration idea.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question" onclick="toggleFaq(this)">
                    <span>Where is Baiilla Maach based?</span>
                    <span>▼</span>
                </div>
                <div class="faq-answer">Baiilla Maach is proudly based in Bangladesh 🇧🇩</div>
            </div>
        </div>
    </section>

    <!-- FEATURE 14: TABS FOR ADDITIONAL INFO -->
    <section class="section">
        <div class="tabs">
            <div class="tab active" onclick="switchTab(this,'tab1')">Platforms</div>
            <div class="tab" onclick="switchTab(this,'tab2')">Safety Tips</div>
            <div class="tab" onclick="switchTab(this,'tab3')">Guidelines</div>
        </div>
        
        <div class="tab-content active" id="tab1">
            <div class="card">
                <div style="display:grid;gap:8px">
                    <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                        <span>📱 TikTok</span>
                        <span style="color:var(--primary)">@baiillamaach_official</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                        <span>👍 Facebook</span>
                        <span style="color:var(--primary)">Baiilla Maach Official</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                        <span>▶️ YouTube</span>
                        <span style="color:var(--primary)">@BaiillaMaachOfficial</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                        <span>📷 Instagram</span>
                        <span style="color:var(--primary)">@baiillamaach_official</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="tab-content" id="tab2">
            <div class="card">
                <ul style="color:var(--muted);padding-left:20px;line-height:2">
                    <li>Always check for verification badge ✓</li>
                    <li>Never share personal information with unverified accounts</li>
                    <li>Report suspicious accounts immediately</li>
                    <li>Only trust links from this official website</li>
                    <li>Enable two-factor authentication on your accounts</li>
                </ul>
            </div>
        </div>
        
        <div class="tab-content" id="tab3">
            <div class="card">
                <ul style="color:var(--muted);padding-left:20px;line-height:2">
                    <li>Be respectful in comments and messages</li>
                    <li>No spamming or hate speech</li>
                    <li>Do not impersonate Baiilla Maach</li>
                    <li>Credit when sharing content</li>
                    <li>Follow community guidelines on all platforms</li>
                </ul>
            </div>
        </div>
    </section>

    <!-- FEATURE 15: MUSIC PLAYER -->
    <section class="section" id="music">
        ${songs.length > 0 ? `
        <div class="music-section">
            <div class="music-header">
                <span style="font-weight:700">🎵 Cover Music Collection</span>
                <span style="color:var(--muted);font-size:13px">${songs.length} songs</span>
            </div>
            <div class="now-playing">
                <div class="album-art" id="art">
                    <span>🎵</span>
                </div>
                <div class="track-info">
                    <div class="track-name" id="title">Select a song to play</div>
                    <div class="track-artist" id="artist">Cover Songs</div>
                    <div class="progress-bar" id="pbar" onclick="seek(event)">
                        <div class="progress-fill-music" id="pfill"></div>
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
                    <div class="volume-control">
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
                        ${s.cover ? `<img src="${s.cover}" alt="">` : '<span>🎵</span>'}
                    </div>
                    <div class="playlist-details">
                        <div class="playlist-title">${s.name}</div>
                        <div class="playlist-artist">Cover Song</div>
                    </div>
                    <div class="eq">
                        <div class="eq-bar"></div><div class="eq-bar"></div>
                        <div class="eq-bar"></div><div class="eq-bar"></div>
                    </div>
                </div>`).join('')}
            </div>
        </div>
        ` : '<div class="card"><p style="text-align:center;color:var(--muted)">No music files found. Add MP3 files to assets/covermusic/</p></div>'}
    </section>

    <!-- FEATURE 16: CONTACT FORM -->
    <section class="section" id="contact">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(50,205,50,0.2)">📧</div>
                <h2>Contact & Business Inquiries</h2>
            </div>
            <form class="contact-form" onsubmit="handleContact(event)">
                <div class="form-group">
                    <label class="form-label">Your Name *</label>
                    <input type="text" class="form-input" required placeholder="Enter your full name">
                </div>
                <div class="form-group">
                    <label class="form-label">Email Address *</label>
                    <input type="email" class="form-input" required placeholder="Enter your email">
                </div>
                <div class="form-group">
                    <label class="form-label">Subject *</label>
                    <select class="form-input" required>
                        <option value="">Select subject</option>
                        <option>Business Inquiry</option>
                        <option>Collaboration Request</option>
                        <option>Report Fake Account</option>
                        <option>Fan Message</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Message *</label>
                    <textarea class="form-input form-textarea" required placeholder="Write your message here..."></textarea>
                </div>
                <button type="submit" class="submit-btn">📨 Send Message</button>
            </form>
        </div>
    </section>

    <!-- FEATURE 17: SOCIAL PROOF -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(255,192,203,0.2)">📊</div>
                <h2>Platform Statistics</h2>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
                <div style="text-align:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:40px;margin-bottom:8px">📱</div>
                    <div style="font-size:24px;font-weight:700;color:var(--primary)">2.1M</div>
                    <div style="color:var(--muted);font-size:13px">TikTok Followers</div>
                </div>
                <div style="text-align:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:40px;margin-bottom:8px">👍</div>
                    <div style="font-size:24px;font-weight:700;color:var(--primary)">350K</div>
                    <div style="color:var(--muted);font-size:13px">Facebook Followers</div>
                </div>
                <div style="text-align:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:40px;margin-bottom:8px">▶️</div>
                    <div style="font-size:24px;font-weight:700;color:var(--primary)">100K</div>
                    <div style="color:var(--muted);font-size:13px">YouTube Subscribers</div>
                </div>
                <div style="text-align:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px">
                    <div style="font-size:40px;margin-bottom:8px">📷</div>
                    <div style="font-size:24px;font-weight:700;color:var(--primary)">80K</div>
                    <div style="color:var(--muted);font-size:13px">Instagram Followers</div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 18: COMMUNITY IMPACT -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(34,139,34,0.2)">🌍</div>
                <h2>Community Impact</h2>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
                <div style="padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center">
                    <div style="font-size:32px;margin-bottom:8px">🎓</div>
                    <div style="font-weight:600">Youth Inspiration</div>
                    <p style="font-size:12px;color:var(--muted);margin-top:4px">Inspiring Bangladeshi youth to pursue content creation</p>
                </div>
                <div style="padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center">
                    <div style="font-size:32px;margin-bottom:8px">🤲</div>
                    <div style="font-weight:600">Charity Work</div>
                    <p style="font-size:12px;color:var(--muted);margin-top:4px">Regular contributions to social causes in Bangladesh</p>
                </div>
                <div style="padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center">
                    <div style="font-size:32px;margin-bottom:8px">🗣️</div>
                    <div style="font-weight:600">Bangla Language</div>
                    <p style="font-size:12px;color:var(--muted);margin-top:4px">Promoting Bengali language and culture globally</p>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 19: NEWSLETTER SIGNUP -->
    <section class="section">
        <div class="card" style="background:linear-gradient(135deg,rgba(29,185,84,0.1),rgba(30,215,96,0.05))">
            <div style="text-align:center">
                <div style="font-size:40px;margin-bottom:12px">📬</div>
                <h2 style="margin-bottom:8px">Stay Updated!</h2>
                <p style="color:var(--muted);margin-bottom:16px">Subscribe to get notifications about new content, events, and exclusive updates.</p>
                <div style="display:flex;gap:8px;max-width:400px;margin:0 auto">
                    <input type="email" placeholder="Enter your email" style="flex:1;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:24px;color:var(--text);outline:none">
                    <button onclick="alert('Subscribed successfully!')" style="padding:12px 24px;background:var(--primary);color:#000;border:none;border-radius:24px;font-weight:700;cursor:pointer">Subscribe</button>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURE 20: SHARE SECTION -->
    <section class="section">
        <div class="card">
            <div class="card-header">
                <div class="card-icon" style="background:rgba(0,191,255,0.2)">🔗</div>
                <h2>Share This Page</h2>
            </div>
            <p style="color:var(--muted);margin-bottom:16px">Help spread awareness about the official account and fake accounts. Share this verification page with others!</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="sharePage('facebook')" style="flex:1;padding:12px;background:#1877f2;color:#fff;border:none;border-radius:24px;font-weight:600;cursor:pointer;min-width:120px">👍 Facebook</button>
                <button onclick="sharePage('twitter')" style="flex:1;padding:12px;background:#1da1f2;color:#fff;border:none;border-radius:24px;font-weight:600;cursor:pointer;min-width:120px">🐦 Twitter</button>
                <button onclick="sharePage('whatsapp')" style="flex:1;padding:12px;background:#25d366;color:#fff;border:none;border-radius:24px;font-weight:600;cursor:pointer;min-width:120px">📱 WhatsApp</button>
                <button onclick="copyText(window.location.href,this)" style="flex:1;padding:12px;background:#333;color:#fff;border:1px solid #555;border-radius:24px;font-weight:600;cursor:pointer;min-width:120px">📋 Copy Link</button>
            </div>
        </div>
    </section>

</main>

<!-- ============ FOOTER ============ -->
<footer class="footer">
    <div class="footer-links">
        <a href="#" class="footer-link">About</a>
        <a href="#" class="footer-link">Privacy Policy</a>
        <a href="#" class="footer-link">Terms of Service</a>
        <a href="#" class="footer-link">Contact</a>
        <a href="/admin" class="footer-link">Admin</a>
    </div>
    <p class="copyright">© 2024 Baiilla Maach Official • All Rights Reserved • Made in Bangladesh 🇧🇩</p>
</footer>

<audio id="audio" preload="auto"></audio>

<script>
// ============ MUSIC PLAYER ============
const audio = document.getElementById('audio');
audio.volume = 0.7;
let currentIndex = -1;
let isPlaying = false;
const items = document.querySelectorAll('.playlist-item');

function play(index) {
    if (index === currentIndex) { toggle(); return; }
    currentIndex = index;
    const item = items[index];
    audio.src = item.dataset.audio;
    audio.load();
    
    document.getElementById('title').textContent = item.querySelector('.playlist-title').textContent;
    document.getElementById('artist').textContent = item.querySelector('.playlist-artist').textContent;
    
    const art = document.getElementById('art');
    if (item.dataset.cover && item.dataset.cover !== '') {
        art.innerHTML = '<img src="' + item.dataset.cover + '" alt="" style="width:100%;height:100%;object-fit:cover">';
    } else {
        art.innerHTML = '<span style="font-size:30px">🎵</span>';
    }
    
    items.forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    
    audio.play().then(() => { isPlaying = true; updatePlayBtn(); }).catch(e => { isPlaying = false; updatePlayBtn(); });
}

function toggle() {
    if (!audio.src || audio.src === window.location.href) { if (items.length > 0) play(0); return; }
    if (isPlaying) { audio.pause(); isPlaying = false; }
    else { audio.play().then(() => { isPlaying = true; }).catch(() => { isPlaying = false; }); }
    updatePlayBtn();
}

function updatePlayBtn() { document.getElementById('playbtn').textContent = isPlaying ? '⏸' : '▶'; }
function next() { if (items.length > 0) play((currentIndex + 1) % items.length); }
function prev() { if (items.length > 0) play(currentIndex <= 0 ? items.length - 1 : currentIndex - 1); }
function setVolume(v) { audio.volume = v / 100; }

function seek(e) {
    if (audio.duration) {
        const rect = e.target.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    }
}

audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        document.getElementById('pfill').style.width = (audio.currentTime / audio.duration) * 100 + '%';
        const m = Math.floor(audio.currentTime / 60), s = Math.floor(audio.currentTime % 60);
        document.getElementById('ctime').textContent = m + ':' + s.toString().padStart(2, '0');
    }
});

audio.addEventListener('loadedmetadata', () => {
    const m = Math.floor(audio.duration / 60), s = Math.floor(audio.duration % 60);
    document.getElementById('ttime').textContent = m + ':' + s.toString().padStart(2, '0');
});

audio.addEventListener('ended', next);

// ============ COUNTDOWN TIMER ============
function updateCountdown() {
    const target = new Date('2024-12-15T00:00:00').getTime();
    const now = new Date().getTime();
    const diff = target - now;
    
    if (diff > 0) {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('days').textContent = d.toString().padStart(2, '0');
        document.getElementById('hours').textContent = h.toString().padStart(2, '0');
        document.getElementById('minutes').textContent = m.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = s.toString().padStart(2, '0');
    }
}

setInterval(updateCountdown, 1000);
updateCountdown();

// ============ FAQ TOGGLE ============
function toggleFaq(el) {
    const item = el.parentElement;
    item.classList.toggle('open');
}

// ============ TAB SWITCHING ============
function switchTab(el, tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// ============ COPY TEXT ============
function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        btn.style.background = '#1db954';
        btn.style.borderColor = '#1db954';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
            btn.style.borderColor = '';
        }, 2000);
    });
}

// ============ SHARE ============
function sharePage(platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('Check out Baiilla Maach Official Verification Hub! 🇧🇩');
    const links = {
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
        twitter: 'https://twitter.com/intent/tweet?url=' + url + '&text=' + text,
        whatsapp: 'https://wa.me/?text=' + text + '%20' + url
    };
    window.open(links[platform], '_blank', 'width=600,height=400');
}

// ============ CONTACT FORM ============
function handleContact(e) {
    e.preventDefault();
    alert('✅ Message sent successfully! We will get back to you soon.');
    e.target.reset();
}

// ============ LANGUAGE TOGGLE ============
function toggleLang() {
    alert('🌐 Language switching feature coming soon!\n\nবর্তমানে বাংলা ও ইংরেজি উভয় ভাষায় কন্টেন্ট দেখানো হচ্ছে।');
}

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') next();
    if (e.code === 'ArrowLeft') prev();
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

    if (pathname.startsWith('/assets/')) {
        const filePath = path.join(ROOT, pathname);
        if (!filePath.startsWith(ASSETS)) { res.writeHead(403); res.end(); return; }
        
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
                '.opus': 'audio/opus', '.weba': 'audio/webm'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(filePath);
            
            if (req.headers.range && ['.mp3', '.wav', '.ogg'].includes(ext)) {
                const range = req.headers.range;
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunkSize = end - start + 1;
                
                res.writeHead(206, {
                    'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
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
        } else { res.writeHead(404); res.end(); }
        return;
    }

    if (pathname === '/admin' && req.method === 'GET') {
        const session = checkSession(cookies.sessionId);
        if (session) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}.card{background:#111;padding:40px;border-radius:16px;border:1px solid #222}a{color:#1db954;text-decoration:none;margin:0 10px}</style></head><body><div class="card"><h2>Welcome Admin</h2><p style="margin:20px 0">You are logged in successfully.</p><div><a href="/admin/logout">Logout</a><a href="/">Home</a></div></div></body></html>');
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
            if (params.get('username') === ADMIN.user && await bcrypt.compare(params.get('password'), ADMIN.pass)) {
                const sessionId = newSession(params.get('username'));
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': 'sessionId=' + sessionId + '; HttpOnly; Path=/; Max-Age=7200; SameSite=Lax'
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
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0' });
        res.end();
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getHomePage());
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:80px;color:#1db954}p{color:#888}a{color:#1db954}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>');
});

server.listen(PORT, () => console.log('Server running: http://localhost:' + PORT));

process.on('uncaughtException', (err) => console.error('Error:', err));
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') { console.error('Port ' + PORT + ' in use'); process.exit(1); }
});

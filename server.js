const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png"
};

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const coverExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const groups = {};
        files.forEach(f => {
            const ext = path.extname(f).toLowerCase();
            const base = path.basename(f, ext);
            if (!groups[base]) groups[base] = { audio: null, cover: null };
            if (audioExts.includes(ext)) groups[base].audio = f;
            if (coverExts.includes(ext)) groups[base].cover = f;
        });
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                audioUrl: `/assets/covermusic/${v.audio}`,
                coverUrl: v.cover ? `/assets/covermusic/${v.cover}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        return true;
    } catch (e) { return false; }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile | Bangladesh",
        tiktokFollowers: "5,000",
        tiktokFollowing: "0",
        tiktokLikes: "50K"
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            screenshot: IMAGES.official,
            verified: true,
            followers: "5k",
            following: "0",
            likes: "110K"
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            screenshot: null,
            verified: true
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            reason: "Copies official content. Requests money from followers.",
            verified: false
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            reason: "Uses official name and photo to mislead followers.",
            verified: false
        }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DATA.celebrity.fullName} | Official Verification</title>
<style>
:root {
    --bg: #fff; --bg2: #f8f9fa; --text: #111; --text2: #555; --text3: #888;
    --border: #e5e5e5; --shadow: 0 1px 2px rgba(0,0,0,.04);
    --shadow-lg: 0 8px 30px rgba(0,0,0,.08);
    --green: #22c55e; --red: #ef4444; --pink: #ff0050; --cyan: #00f2ea; --fb: #1877f2;
    --spotify: #1db954; --spotify-dark: #191414;
    --r: 10px; --r-lg: 14px; --r-xl: 18px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg2);color:var(--text);line-height:1.6;overflow-x:hidden}
@keyframes fadeUp{from{opacity:0;transform:translateY(25px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.3)}50%{box-shadow:0 0 0 14px rgba(34,197,94,0)}}
@keyframes eq{0%,100%{height:3px}50%{height:14px}}

.scroll-bar{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--pink),var(--cyan),var(--green));z-index:9999}
.nav{position:sticky;top:0;z-index:999;background:rgba(255,255,255,.9);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:10px 0}
.nav-inner{max-width:900px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:10px}
.nav-avatar{width:30px;height:30px;border-radius:50%;border:2px solid var(--pink);object-fit:cover}
.nav-title{font-weight:700;font-size:1em;color:var(--text)}
.container{max-width:900px;margin:0 auto;padding:0 20px}

.hero{padding:40px 0 25px;text-align:center}
.hero-avatar{width:100px;height:100px;border-radius:50%;border:3px solid var(--pink);object-fit:cover;box-shadow:0 0 0 4px rgba(255,0,80,.05),0 4px 16px rgba(0,0,0,.08);margin-bottom:14px}
.hero-name{font-size:1.9em;font-weight:800;letter-spacing:-.3px}
.hero-bio{font-size:.9em;color:var(--text2);margin:3px 0 12px}
.hero-stats{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.hero-stat{text-align:center}.hero-stat .n{font-size:1.3em;font-weight:700}.hero-stat .l{font-size:.65em;color:var(--text3);text-transform:uppercase;letter-spacing:.4px}
.hero-badges{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:5px 14px;border-radius:18px;font-size:.76em;font-weight:600}
.badge-ok{background:linear-gradient(135deg,var(--green),#16a34a);color:#fff;animation:pulse 2.5s infinite}
.badge-blue{background:#1877f2;color:#fff}
.hero-links{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.btn-social{display:inline-flex;align-items:center;gap:5px;padding:9px 20px;border-radius:22px;text-decoration:none;font-weight:600;font-size:.8em;transition:all .2s;border:2px solid transparent}
.btn-tiktok{background:#000;color:#fff}.btn-tiktok:hover{background:#fff;color:#000;border-color:#000;transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.btn-fb{background:var(--fb);color:#fff}.btn-fb:hover{background:#fff;color:var(--fb);border-color:var(--fb);transform:translateY(-2px);box-shadow:var(--shadow-lg)}

.sec{padding:28px 0}
.sec-head{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.sec-head h2{font-size:1.15em;font-weight:700;letter-spacing:-.2px}
.sec-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.95em}

.card-official{background:linear-gradient(135deg,#f0fdf4,#fff,#dcfce7);border:2px solid #bbf7d0;border-radius:var(--r-xl);padding:22px;box-shadow:var(--shadow-lg);margin-bottom:12px}
.card-official-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.verify-icon{width:36px;height:36px;background:linear-gradient(135deg,var(--green),#16a34a);border-radius:50%;display:flex;align-items:center;justify-content:center;animation:pulse 2.5s infinite;flex-shrink:0;color:#fff;font-size:1em}
.card-official-top h3{font-size:1em;font-weight:700;color:#15803d}
.card-official-top span{font-size:.75em;color:#16a34a;font-weight:600}
.card-official-body{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:550px){.card-official-body{grid-template-columns:1fr}}
.official-info{display:flex;flex-direction:column;gap:6px}
.official-row{display:flex;justify-content:space-between;padding:8px 12px;background:#fff;border-radius:8px;border:1px solid #dcfce7;font-size:.82em}
.official-row .lbl{color:var(--text3);font-weight:600;text-transform:uppercase;font-size:.7em;letter-spacing:.3px}
.official-row .val{font-weight:700}
.official-preview{background:#fff;border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);text-align:center}
.official-preview img{width:60px;height:60px;border-radius:50%;border:3px solid var(--green);margin-bottom:8px}
.official-preview .uname{font-size:.95em;font-weight:700}
.official-preview .plat{font-size:.7em;color:var(--text2);margin:2px 0 14px}
.btn-follow{display:inline-flex;align-items:center;gap:4px;padding:10px 24px;background:linear-gradient(135deg,var(--green),#16a34a);color:#fff;border-radius:22px;text-decoration:none;font-weight:700;font-size:.82em;transition:all .2s;box-shadow:0 3px 12px rgba(34,197,94,.18)}
.btn-follow:hover{transform:translateY(-2px)}

.fake-section{background:#fef2f2;border:2px solid #fecaca;border-radius:var(--r-xl);padding:20px}
.fake-alert{display:flex;align-items:center;gap:8px;background:#fff;padding:10px 14px;border-radius:10px;border:2px solid #fecaca;margin-bottom:14px}
.fake-alert-icon{width:36px;height:36px;background:linear-gradient(135deg,var(--red),#dc2626);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1em;flex-shrink:0}
.fake-alert-txt h4{font-size:.9em;font-weight:700;color:#b91c1c}
.fake-alert-txt p{font-size:.74em;color:#dc2626}
.fake-carousel{overflow:hidden;border-radius:10px}
.fake-track{display:flex;transition:transform .4s ease}
.fake-slide{min-width:100%;padding:0 2px}
.fake-card{background:#fff;border-radius:10px;border:2px solid #fecaca;padding:18px;position:relative;overflow:hidden}
.fake-card::after{content:'FAKE';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);font-size:4em;font-weight:900;color:rgba(239,68,68,.012);pointer-events:none;letter-spacing:10px}
.fake-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:4px}
.fake-card-top .ttl{display:flex;align-items:center;gap:4px;font-size:.88em;font-weight:700;color:#b91c1c}
.fake-badge{background:var(--red);color:#fff;padding:3px 10px;border-radius:12px;font-size:.6em;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
.fake-card-body{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:500px){.fake-card-body{grid-template-columns:1fr}}
.fake-ss{position:relative;border-radius:8px;overflow:hidden;border:2px solid #fecaca}
.fake-ss img{width:100%;display:block;max-width:100%;height:auto}
.fake-wm{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;gap:3px}
.fake-wm span{background:rgba(239,68,68,.8);color:#fff;padding:4px 10px;border-radius:10px;font-weight:700;font-size:.65em;letter-spacing:1px}
.fake-info{display:flex;flex-direction:column;gap:5px}
.fake-row{display:flex;justify-content:space-between;padding:6px 10px;background:#fef2f2;border-radius:6px;font-size:.74em}
.fake-row .lbl{color:#dc2626;font-weight:600}.fake-row .val{color:#b91c1c;font-weight:700}
.fake-reason{background:#fff;border:1px solid #fee2e2;border-radius:8px;padding:8px;margin-top:3px;font-size:.72em;color:#b91c1c;line-height:1.4}
.fake-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.btn-report{display:inline-flex;align-items:center;gap:3px;padding:8px 16px;background:linear-gradient(135deg,var(--red),#dc2626);color:#fff;border-radius:18px;text-decoration:none;font-weight:700;font-size:.74em;transition:all .2s;flex:1;justify-content:center;min-width:80px}
.btn-report:hover{transform:translateY(-1px)}
.btn-copy{display:inline-flex;align-items:center;gap:3px;padding:8px 16px;background:#fff;color:#dc2626;border:2px solid #fecaca;border-radius:18px;font-weight:700;font-size:.74em;cursor:pointer;transition:all .2s;flex:1;justify-content:center;min-width:80px}
.btn-copy:hover{background:#fef2f2}.btn-copy.done{background:var(--green)!important;color:#fff!important;border-color:var(--green)!important}

.carousel-nav{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:12px}
.carousel-dots{display:flex;gap:4px}
.carousel-dot{width:6px;height:6px;border-radius:50%;background:#fecaca;border:none;cursor:pointer;transition:all .3s}
.carousel-dot.on{background:var(--red);width:18px;border-radius:3px}
.carousel-arr{width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8em;color:var(--text);transition:all .2s}
.carousel-arr:hover{background:var(--red);color:#fff;border-color:var(--red)}

.spotify-player{background:var(--spotify-dark);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-lg)}
.spotify-now{display:flex;gap:14px;padding:18px;background:linear-gradient(135deg,#282828,#191414)}
@media(max-width:550px){.spotify-now{flex-direction:column;align-items:center;text-align:center}}
.spotify-art{width:120px;height:120px;border-radius:8px;overflow:hidden;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,.4);background:#333}
.spotify-art img{width:100%;height:100%;object-fit:cover}
.spotify-def-art{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--spotify),#169c46);color:#fff;font-size:2em}
.spotify-info{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:140px}
.spotify-name{font-size:1.1em;font-weight:700;color:#fff;margin-bottom:2px}
.spotify-artist{font-size:.75em;color:#b3b3b3;margin-bottom:12px}
.spotify-progress{margin-bottom:10px}
.spotify-bar{width:100%;height:3px;background:rgba(255,255,255,.2);border-radius:2px;cursor:pointer;margin-bottom:3px}
.spotify-fill{height:100%;background:var(--spotify);border-radius:2px;width:0%;transition:width .1s}
.spotify-time{display:flex;justify-content:space-between;font-size:.6em;color:#b3b3b3}
.spotify-ctrls{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.spotify-btn{background:none;border:none;color:#b3b3b3;cursor:pointer;padding:3px;border-radius:50%;transition:all .2s;display:flex;font-size:1.1em}
.spotify-btn:hover{color:#fff;transform:scale(1.1)}
.spotify-play{background:#fff;color:#191414;width:38px;height:38px;border-radius:50%}.spotify-play:hover{transform:scale(1.08)}
.spotify-vol{display:flex;align-items:center;gap:6px;color:#b3b3b3;font-size:.8em}
.spotify-vol input{width:70px;height:2px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.2);border-radius:1px;outline:none;cursor:pointer}
.spotify-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:#fff;cursor:pointer}
.spotify-list-cont{max-height:280px;overflow-y:auto}
.spotify-list-head{padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#191414;z-index:1}
.spotify-list-head h4{font-size:.82em;font-weight:700;color:#fff}.spotify-list-head span{font-size:.66em;color:#b3b3b3}
.spotify-item{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;transition:all .2s;border-bottom:1px solid rgba(255,255,255,.02)}
.spotify-item:hover{background:rgba(255,255,255,.04)}.spotify-item.on{background:rgba(29,185,84,.08)}
.spotify-num{font-size:.7em;color:#b3b3b3;width:20px;text-align:center;font-weight:600}
.spotify-thumb{width:30px;height:30px;border-radius:4px;overflow:hidden;flex-shrink:0;background:#282828}
.spotify-thumb img{width:100%;height:100%;object-fit:cover}
.spotify-def-thumb{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--spotify),#169c46);color:#fff;font-size:.7em}
.spotify-meta{flex:1;min-width:0}.spotify-meta .t{font-weight:600;font-size:.76em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spotify-meta .a{font-size:.66em;color:#b3b3b3}
.spotify-eq{display:none;gap:2px;align-items:flex-end;height:12px}.spotify-item.on .spotify-eq{display:flex}
.eq-bar{width:2px;background:var(--spotify);border-radius:1px;animation:eq .8s infinite}
.eq-bar:nth-child(1){animation-delay:0s}.eq-bar:nth-child(2){animation-delay:.2s}.eq-bar:nth-child(3){animation-delay:.4s}.eq-bar:nth-child(4){animation-delay:.6s}

.footer{text-align:center;padding:24px 20px;color:var(--text3);font-size:.76em;border-top:1px solid var(--border);margin-top:24px;background:#fff}
</style>
</head>
<body>
<div class="scroll-bar" id="scrollBar"></div>
<nav class="nav">
<div class="nav-inner">
<img src="${DATA.celebrity.photo}" alt="" class="nav-avatar" onerror="this.style.display='none'">
<span class="nav-title">Verification Hub</span>
</div>
</nav>

<header class="hero">
<div class="container">
<img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-avatar" onerror="this.style.display='none'">
<h1 class="hero-name">${DATA.celebrity.fullName}</h1>
<p class="hero-bio">${DATA.celebrity.bio}</p>
<div class="hero-stats">
<div class="hero-stat"><div class="n">${DATA.celebrity.tiktokFollowers}</div><div class="l">Followers</div></div>
<div class="hero-stat"><div class="n">${DATA.celebrity.tiktokFollowing}</div><div class="l">Following</div></div>
<div class="hero-stat"><div class="n">${DATA.celebrity.tiktokLikes}</div><div class="l">Likes</div></div>
</div>
<div class="hero-badges">
<span class="badge badge-ok">Verified Account</span>
<span class="badge badge-blue">Official Creator</span>
</div>
<div class="hero-links">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-social btn-tiktok">TikTok</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="btn-social btn-fb">Facebook</a>
</div>
</div>
</header>

<main class="container">

<section class="sec">
<div class="sec-head">
<div class="sec-icon" style="background:linear-gradient(135deg,var(--green),#16a34a);color:#fff">&#10003;</div>
<h2>Official Verified Account</h2>
</div>
<div class="card-official">
<div class="card-official-top">
<div class="verify-icon">&#10003;</div>
<div><h3>The Only Authentic Account</h3><span>Identity Verified</span></div>
</div>
<div class="card-official-body">
<div class="official-info">
<div class="official-row"><span class="lbl">TikTok</span><span class="val">@baiillamaach_official</span></div>
<div class="official-row"><span class="lbl">Facebook</span><span class="val">Baiilla Maach Official</span></div>
<div class="official-row"><span class="lbl">Followers</span><span class="val">5,000</span></div>
<div class="official-row"><span class="lbl">Following</span><span class="val">0</span></div>
<div class="official-row"><span class="lbl">Status</span><span class="val" style="color:var(--green)">Active & Verified</span></div>
</div>
<div class="official-preview">
<img src="${DATA.celebrity.photo}" alt="" onerror="this.style.display='none'">
<div class="uname">@baiillamaach_official</div>
<div class="plat">TikTok | Facebook</div>
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-follow">Follow Official Account</a>
</div>
</div>
</div>
</section>

<section class="sec">
<div class="sec-head">
<div class="sec-icon" style="background:linear-gradient(135deg,var(--red),#dc2626);color:#fff">!</div>
<h2>Fake Accounts Detected</h2>
</div>
<div class="fake-section">
<div class="fake-alert">
<div class="fake-alert-icon">!</div>
<div class="fake-alert-txt"><h4>${totalFake} Fake Account${totalFake > 1 ? 's' : ''} Found</h4><p>Not affiliated with Baiilla Maach. Report immediately.</p></div>
</div>
<div class="fake-carousel" id="fakeCarousel">
<div class="fake-track" id="fakeTrack">
${DATA.fakeAccounts.map((a, i) => `
<div class="fake-slide"><div class="fake-card">
<div class="fake-card-top"><div class="ttl">Fake Account #${i+1}</div><span class="fake-badge">Dangerous</span></div>
<div class="fake-card-body">
<div class="fake-ss">${a.screenshot ? `<img src="${a.screenshot}" alt="" loading="lazy">` : ''}<div class="fake-wm"><span>FAKE</span><span style="font-size:.55em">DO NOT TRUST</span></div></div>
<div class="fake-info">
<div class="fake-row"><span class="lbl">Platform</span><span class="val">${a.platform}</span></div>
<div class="fake-row"><span class="lbl">Username</span><span class="val">${a.username}</span></div>
<div class="fake-row"><span class="lbl">Status</span><span class="val">Active Threat</span></div>
<div class="fake-reason">${a.reason}</div>
</div>
</div>
<div class="fake-actions"><a href="${a.profileUrl}" target="_blank" rel="noopener" class="btn-report">Report</a><button class="btn-copy copy-btn" data-username="${a.username}">Copy Username</button></div>
</div></div>`).join('')}
</div>
</div>
<div class="carousel-nav">
<button class="carousel-arr" onclick="moveCarousel(-1)">&#9664;</button>
<div class="carousel-dots" id="carouselDots">${DATA.fakeAccounts.map((_, i) => `<button class="carousel-dot${i===0?' on':''}" onclick="goSlide(${i})"></button>`).join('')}</div>
<button class="carousel-arr" onclick="moveCarousel(1)">&#9654;</button>
</div>
</div>
</section>

${coverSongs.length > 0 ? `
<section class="sec">
<div class="sec-head">
<div class="sec-icon" style="background:linear-gradient(135deg,var(--spotify),#169c46);color:#fff">&#9835;</div>
<h2>Cover Music</h2>
</div>
<div class="spotify-player">
<div class="spotify-now">
<div class="spotify-art" id="npCover"><div class="spotify-def-art">&#9835;</div></div>
<div class="spotify-info">
<div class="spotify-name" id="npTitle">Select a song</div><div class="spotify-artist" id="npArtist">Cover Songs</div>
<div class="spotify-progress"><div class="spotify-bar" id="progressBar"><div class="spotify-fill" id="progressFill"></div></div><div class="spotify-time"><span id="curTime">0:00</span><span id="totTime">0:00</span></div></div>
<div class="spotify-ctrls"><button class="spotify-btn" onclick="prevSong()">&#9664;&#9664;</button><button class="spotify-btn spotify-play" id="ppBtn" onclick="togglePlay()"><span id="ppIcon">&#9654;</span></button><button class="spotify-btn" onclick="nextSong()">&#9654;&#9654;</button></div>
<div class="spotify-vol">Vol <input type="range" id="volSlider" min="0" max="100" value="70" onchange="setVol(this.value)"></div>
</div>
</div>
<div class="spotify-list-cont"><div class="spotify-list-head"><h4>Playlist</h4><span>${coverSongs.length} songs</span></div>
<div class="spotify-playlist" id="playlist">${coverSongs.map((s, i) => `
<div class="spotify-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl || ''}" onclick="playSong(${i})">
<div class="spotify-num">${(i+1).toString().padStart(2,'0')}</div>
<div class="spotify-thumb">${s.coverUrl ? `<img src="${s.coverUrl}" alt="" loading="lazy">` : '<div class="spotify-def-thumb">&#9835;</div>'}</div>
<div class="spotify-meta"><div class="t">${s.title}</div><div class="a">Cover Song</div></div>
<div class="spotify-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
</div>`).join('')}</div></div>
</div>
</section>` : ''}

${galleryPhotos.length > 0 ? `
<section class="sec">
<div class="sec-head"><div class="sec-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff">&#9634;</div><h2>Gallery</h2></div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
${galleryPhotos.map(p => `<div style="border-radius:10px;overflow:hidden;box-shadow:var(--shadow)"><img src="${p.path}" alt="" loading="lazy" style="width:100%;display:block">${p.caption ? `<p style="padding:6px 10px;font-size:.72em;color:var(--text2);text-align:center">${p.caption}</p>` : ''}</div>`).join('')}
</div>
</section>` : ''}

</main>
<footer class="footer"><p>&copy; ${DATA.celebrity.fullName} &middot; Official Verification Hub</p></footer>

<audio id="audioPlayer" preload="none"></audio>
<script>
window.addEventListener('scroll',()=>{document.getElementById('scrollBar').style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight)*100)+'%'});

let curSlide=0,totalSlides=${totalFake},track=document.getElementById('fakeTrack'),dots=document.querySelectorAll('.carousel-dot'),auto;
function updCarousel(){track.style.transform='translateX(-'+(curSlide*100)+'%)';dots.forEach((d,i)=>d.classList.toggle('on',i===curSlide))}
function moveCarousel(d){curSlide=(curSlide+d+totalSlides)%totalSlides;updCarousel();clearInterval(auto);auto=setInterval(()=>moveCarousel(1),5000)}
function goSlide(i){curSlide=i;updCarousel();clearInterval(auto);auto=setInterval(()=>moveCarousel(1),5000)}
auto=setInterval(()=>moveCarousel(1),5000);
let tx=0;track.parentElement.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX});
track.parentElement.addEventListener('touchend',e=>{const d=tx-e.changedTouches[0].screenX;if(Math.abs(d)>35)moveCarousel(d>0?1:-1)});

document.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',function(){navigator.clipboard.writeText(this.dataset.username).then(()=>{this.textContent='Copied!';this.classList.add('done');setTimeout(()=>{this.textContent='Copy Username';this.classList.remove('done')},2000)})}));

let cur=-1,pl=false,ap=document.getElementById('audioPlayer'),items=document.querySelectorAll('.spotify-item');
function loadSong(i){
if(!items.length||i<0||i>=items.length)return;
if(cur===i)return;
cur=i;const it=items[i];
ap.src=it.dataset.audio;ap.load();
document.getElementById('npTitle').textContent=it.querySelector('.t').textContent;
document.getElementById('npArtist').textContent=it.querySelector('.a').textContent;
const cc=document.getElementById('npCover');
if(it.dataset.cover){cc.innerHTML='<img src="'+it.dataset.cover+'" alt="">'}else{cc.innerHTML='<div class="spotify-def-art">&#9835;</div>'}
document.querySelectorAll('.spotify-item').forEach(el=>el.classList.remove('on'));it.classList.add('on');
document.getElementById('progressFill').style.width='0%';document.getElementById('curTime').textContent='0:00';document.getElementById('totTime').textContent='0:00';
ap.play().then(()=>{pl=true;updPP()}).catch(e=>{alert('Cannot play audio');pl=false;updPP()});
}
function playSong(i){if(i===cur)togglePlay();else loadSong(i)}
function togglePlay(){if(!ap.src&&items.length>0){loadSong(0);return}if(pl){ap.pause();pl=false}else{ap.play().then(()=>{pl=true}).catch(()=>{alert('Playback failed')});pl=!pl}updPP()}
function updPP(){document.getElementById('ppIcon').innerHTML=pl?'&#9646;&#9646;':'&#9654;'}
function nextSong(){if(items.length)loadSong((cur+1)%items.length)}
function prevSong(){if(items.length)loadSong(cur<=0?items.length-1:cur-1)}
function setVol(v){ap.volume=v/100}
ap.addEventListener('timeupdate',()=>{if(ap.duration){document.getElementById('progressFill').style.width=(ap.currentTime/ap.duration)*100+'%';const m=Math.floor(ap.currentTime/60),s=Math.floor(ap.currentTime%60);document.getElementById('curTime').textContent=m+':'+s.toString().padStart(2,'0')}});
ap.addEventListener('loadedmetadata',()=>{const m=Math.floor(ap.duration/60),s=Math.floor(ap.duration%60);document.getElementById('totTime').textContent=m+':'+s.toString().padStart(2,'0')});
ap.addEventListener('ended',()=>{pl=false;updPP();nextSong()});
ap.addEventListener('error',()=>{alert('Audio file error');pl=false;updPP()});
document.getElementById('progressBar').addEventListener('click',e=>{const r=e.target.getBoundingClientRect();ap.currentTime=((e.clientX-r.left)/r.width)*ap.duration});
ap.volume=.7;
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.08)}h2{text-align:center;color:#ff0050;margin-bottom:30px}.fg{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#475569;font-weight:600}input{width:100%;padding:12px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:1em;outline:none}input:focus{border-color:#ff0050}.btn{width:100%;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer}.btn:hover{background:#d90040}.error{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center}.back{text-align:center;margin-top:20px}a{color:#64748b;text-decoration:none}a:hover{color:#ff0050}</style></head><body><div class="box"><h2>Admin Login</h2>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="fg"><label>Username</label><input type="text" name="username" required></div><div class="fg"><label>Password</label><input type="password" name="password" required></div><button type="submit" class="btn">Login</button></form><div class="back"><a href="/">Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="pc"><img src="${p.path}" class="pi"><div class="info">${p.caption?`<p>${p.caption}</p>`:''}<p class="dt">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="del" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;color:#0f172a}.hdr{background:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0}.hdr h2{color:#ff0050}.hdr a{color:#64748b;text-decoration:none;padding:8px 16px;border:2px solid #e2e8f0;border-radius:8px;margin-left:10px;font-weight:600}.hdr a:hover{background:#ff0050;color:#fff;border-color:#ff0050}.cnt{max-width:1100px;margin:0 auto;padding:30px 20px}.up{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:30px;margin-bottom:30px}.up h3{color:#ff0050;margin-bottom:20px}.fg{margin-bottom:15px}label{display:block;margin-bottom:6px;color:#475569;font-weight:600}input,textarea{width:100%;padding:10px 14px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:8px;font-size:.95em;outline:none}input:focus,textarea:focus{border-color:#ff0050}.bu{background:#22c55e;color:#fff;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer}.bu:hover{background:#16a34a}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}.pc{background:#fff;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden}.pc:hover{border-color:#ff0050}.pi{width:100%;height:200px;object-fit:cover}.info{padding:12px}.dt{font-size:.75em;color:#94a3b8;margin-top:2px}.del{background:#fef2f2;color:#dc2626;border:2px solid #fecaca;padding:6px 12px;border-radius:6px;cursor:pointer;margin:0 12px 12px;width:calc(100% - 24px);font-weight:600}.del:hover{background:#ef4444;color:#fff}.msg{background:#f0fdf4;border:2px solid #bbf7d0;color:#166534;padding:12px;border-radius:8px;margin-bottom:20px}.err{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px}</style></head><body><div class="hdr"><h2>Admin Panel</h2><div><a href="/">Home</a><a href="/admin/logout">Logout</a></div></div><div class="cnt">${msg?`<div class="msg">${msg}</div>`:''}${err?`<div class="err">${err}</div>`:''}<div class="up"><h3>Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="fg"><label>Select Photo</label><input type="file" name="photo" accept="image/*" required></div><div class="fg"><label>Caption</label><input type="text" name="caption"></div><button type="submit" class="bu">Upload</button></form></div><h3 style="margin-bottom:20px">Gallery (${photos.length})</h3>${photos.length?`<div class="grid">${phtml}</div>`:'<p style="color:#94a3b8;text-align:center;padding:40px">No photos</p>'}</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, pathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac' };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, { 'Content-Type':ct, 'Content-Length':stat.size, 'Cache-Control':'public, max-age=86400', 'Accept-Ranges':'bytes' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    if (pathname === '/admin' && req.method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p)); return; }
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML()); return;
    }

    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'),params.get('password'))) {
                const sid = createSession(params.get('username'));
                res.writeHead(302,{'Location':'/admin','Set-Cookie':`sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`}); res.end();
            } else { res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML('Invalid credentials')); }
        }); return;
    }

    if (pathname === '/admin/logout') { sessions.delete(cookies.sessionId); res.writeHead(302,{'Location':'/admin','Set-Cookie':'sessionId=;HttpOnly;Path=/;Max-Age=0'}); res.end(); return; }

    if (pathname === '/admin/upload' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir:GALLERY_DIR, keepExtensions:true, maxFileSize:10*1024*1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Upload error')); return; }
            const pf = Array.isArray(files.photo)?files.photo[0]:files.photo;
            if (!pf||!pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','No file')); return; }
            if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(path.extname(pf.originalFilename).toLowerCase())) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Invalid format')); return; }
            const fn = Date.now()+'_'+pf.originalFilename.replace(/[^a-zA-Z0-9.]/g,'_');
            try {
                fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                await savePhoto({ path:'/assets/gallery/'+fn, caption:fields.caption?(Array.isArray(fields.caption)?fields.caption[0]:fields.caption):'' });
                const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Uploaded'));
            } catch(e) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Save error')); }
        }); return;
    }

    if (pathname === '/admin/delete' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            try { const photo = await db.collection('gallery_photos').findOne({_id:new ObjectId(params.get('photoId'))}); if(photo){const fp=path.join(__dir,photo.path);if(fs.existsSync(fp))fs.unlinkSync(fp);} await deletePhoto(params.get('photoId')); } catch(e){}
            const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Deleted'));
        }); return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=3600'});
        res.end(getMainHTML(photos));
        return;
    }

    res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}h1{font-size:100px;color:#ff0050}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Home</a></div></body></html>`);
});

async function start() {
    await connectDB();
    server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
}

start();
server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });

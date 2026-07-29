const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';
const COLLECTIONS = { photos: 'gallery_photos', admins: 'admin_users', settings: 'site_settings' };

let db;
let mongoClient;

const ASSETS_DIR = path.join(__dirname, 'assets');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'uploads');
const GALLERY_DIR = path.join(__dirname, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dirname, 'assets', 'covermusic');

[ASSETS_DIR, UPLOADS_DIR, GALLERY_DIR, COVER_MUSIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png"
};

const VOICE_FILES = {
    warning1: "/assets/10ff7135b502e2f5660074fdb0969109.mp3",
    warning2: "/assets/077f07c5d2a052c7081e448e6dfdaff6_1.mp3"
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
                artist: 'Cover Song',
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
        const admins = db.collection(COLLECTIONS.admins);
        const exists = await admins.findOne({ username: 'admin' });
        if (!exists) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        return true;
    } catch (e) { return false; }
}

async function getGalleryPhotos() {
    if (!db) return [];
    try { return await db.collection(COLLECTIONS.photos).find({}).sort({ uploadedAt: -1 }).toArray(); }
    catch (e) { return []; }
}

async function savePhoto(d) {
    if (!db) throw new Error('DB not connected');
    return await db.collection(COLLECTIONS.photos).insertOne({ ...d, uploadedAt: new Date() });
}

async function deletePhoto(id) {
    if (!db) throw new Error('DB not connected');
    return await db.collection(COLLECTIONS.photos).deleteOne({ _id: new ObjectId(id) });
}

async function verifyAdmin(u, p) {
    if (!db) return false;
    const a = await db.collection(COLLECTIONS.admins).findOne({ username: u });
    if (!a) return false;
    return await bcrypt.compare(p, a.password);
}

const DATA = {
    celebrity: { name: "Baiilla Maach Official", photo: IMAGES.profile, bio: "Entertainment purposes only. Stay aware of impersonators." },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", screenshot: IMAGES.official },
        { platform: "Facebook", username: "@BaiillaMaachOfficial", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: null }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger, reason: "Copies our logo and posts to deceive followers." },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud, reason: "Uses our name and photo to mislead followers." }
    ]
};

const sessions = new Map();
function createSession(u) { const id = Math.random().toString(36).substring(2) + Date.now().toString(36); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
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
<title>${DATA.celebrity.name} | Official</title>
<style>
:root{--bg:#fff;--bg2:#f8f9fa;--text:#1a1a1a;--text2:#6c757d;--border:#e9ecef;--shadow:0 1px 3px rgba(0,0,0,.08);--shadow-lg:0 10px 30px rgba(0,0,0,.1);--pink:#ff0050;--green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--fb:#1877f2;--spotify:#1db954}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg2);color:var(--text);line-height:1.6;overflow-x:hidden}
@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,0,80,.4)}50%{box-shadow:0 0 0 12px rgba(255,0,80,0)}}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-2deg)}75%{transform:rotate(2deg)}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes equalizer{0%,100%{height:4px}50%{height:16px}}

.scroll-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--pink),#00f2ea);z-index:10001;transition:width .1s}
.fade-up{opacity:0;transform:translateY(30px)}.fade-up.vis{animation:fadeUp .8s ease forwards}
.scale-in{opacity:0;transform:scale(.9)}.scale-in.vis{animation:scaleIn .6s ease forwards}

.container{max-width:1100px;margin:0 auto;padding:0 20px}

.header{text-align:center;padding:50px 20px 40px;background:var(--bg);border-bottom:1px solid var(--border);position:relative}
.header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at center,rgba(255,0,80,.03) 0%,transparent 70%);pointer-events:none}
.photo{width:130px;height:130px;border-radius:50%;border:3px solid var(--pink);object-fit:cover;margin-bottom:18px;box-shadow:0 5px 25px rgba(255,0,80,.15)}
.name{font-size:2.2em;font-weight:800;letter-spacing:-.5px;margin-bottom:4px}
.bio{color:var(--text2);font-size:1em;margin-bottom:18px}
.badge-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:22px}
.badge-official{background:var(--pink);color:#fff;padding:7px 22px;border-radius:25px;font-size:.85em;font-weight:600;animation:pulse 2.5s infinite}
.badge-fun{background:linear-gradient(135deg,var(--pink),#ff6b00);color:#fff;padding:7px 22px;border-radius:25px;font-size:.85em;font-weight:600}

.social-links{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
.social-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 26px;border-radius:30px;text-decoration:none;font-weight:600;font-size:.9em;transition:all .3s;border:2px solid transparent}
.social-btn.tiktok{background:#000;color:#fff}
.social-btn.tiktok:hover{background:#fff;color:#000;border-color:#000;transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.15)}
.social-btn.facebook{background:var(--fb);color:#fff}
.social-btn.facebook:hover{background:#fff;color:var(--fb);border-color:var(--fb);transform:translateY(-2px);box-shadow:0 8px 25px rgba(24,119,242,.25)}

.warning-hero{background:#fee2e2;border:2px solid rgba(239,68,68,.2);border-radius:18px;padding:28px;margin:30px 0;text-align:center}
.warning-hero .big-icon{font-size:3em;display:block;margin-bottom:10px;animation:shake .6s infinite}
.warning-hero h2{color:var(--red);font-size:1.4em;margin-bottom:8px;font-weight:700}
.warning-hero p{color:#991b1b;font-size:.95em;max-width:600px;margin:0 auto}

.section{margin:35px 0}
.section-title{font-size:1.3em;font-weight:700;margin-bottom:18px;padding-bottom:10px;border-bottom:3px solid var(--green);display:flex;align-items:center;gap:8px;color:var(--text)}
.section-title.fake{border-bottom-color:var(--red)}

.official-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid rgba(34,197,94,.3);border-radius:18px;padding:32px;text-align:center;margin-bottom:25px}
.official-box .check-icon{font-size:3em;margin-bottom:12px;color:var(--green)}
.official-box h3{color:#166534;font-size:1.3em;margin-bottom:10px;font-weight:700}
.official-box .uname{color:var(--text);font-size:1.1em;margin-bottom:8px;font-weight:600}
.official-box .nobackup{color:var(--text2);font-size:.9em;margin-bottom:22px}

.comparison-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px;margin:20px 0}
.comparison-card{border-radius:18px;padding:22px;transition:all .3s;background:var(--bg);border:2px solid var(--border)}
.comparison-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
.comparison-card.real{border-color:rgba(34,197,94,.3);background:linear-gradient(135deg,#f0fdf4,#fff)}
.comparison-card.fake{border-color:rgba(239,68,68,.3);background:linear-gradient(135deg,#fef2f2,#fff)}

.comparison-header{text-align:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f1f3f5}
.comparison-header .icon{font-size:1.6em;display:block;margin-bottom:2px}
.comparison-header h3{font-size:.95em;font-weight:700}
.real .comparison-header h3{color:var(--green)}.fake .comparison-header h3{color:var(--red)}

.platform-badge{display:inline-block;font-weight:700;font-size:.7em;padding:4px 12px;border-radius:14px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
.real .platform-badge{background:#dcfce7;color:#166534}
.fake .platform-badge{background:#fee2e2;color:#991b1b}

.username-display{font-size:.8em;font-weight:600;padding:5px 12px;border-radius:7px;display:inline-block;margin:5px 0}
.real .username-display{background:#dcfce7;color:#166534}
.fake .username-display{background:#fee2e2;color:#991b1b}

.screenshot-wrapper{position:relative;margin:8px 0;border-radius:14px;overflow:hidden}
.screenshot-box{text-align:center;background:#000;border-radius:14px;border:2px solid var(--border);box-shadow:var(--shadow);transition:all .3s;width:100%}
.screenshot-box:hover{box-shadow:var(--shadow-lg)}
.proof-img{width:100%;height:auto;display:block;object-fit:contain;border-radius:12px;cursor:pointer;transition:transform .3s;background:#000}
.proof-img:hover{transform:scale(1.02)}.proof-img.zoomed{transform:scale(1.5);z-index:1000;position:relative;box-shadow:0 25px 70px rgba(0,0,0,.3);border-radius:16px;cursor:zoom-out}

.real-checkmark{position:absolute;top:6px;right:6px;z-index:5;background:var(--green);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8em;font-weight:700;box-shadow:0 2px 10px rgba(34,197,94,.4)}
.danger-badge{position:absolute;top:6px;right:6px;z-index:6;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:4px 10px;border-radius:14px;font-weight:700;font-size:.65em;letter-spacing:1px;box-shadow:0 2px 12px rgba(239,68,68,.4);text-transform:uppercase}
.premium-warning{position:absolute;top:0;left:0;right:0;bottom:0;z-index:3;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.warning-main{font-size:.78em;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#ef4444;background:rgba(255,255,255,.95);padding:6px 16px;border-radius:20px;border:2px solid rgba(239,68,68,.3);animation:pulse 2s infinite}
.warning-sub{font-size:.9em;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#dc2626;background:rgba(255,255,255,.95);padding:6px 18px;border-radius:20px;border:2px solid rgba(220,38,38,.4);animation:pulse 2s infinite .3s}
.click-hint{display:block;color:#adb5bd;font-size:.65em;margin-top:4px;text-align:center}
.reason-box{color:#991b1b;font-size:.78em;margin-top:8px;padding:8px 12px;background:#fee2e2;border-radius:8px;border-left:3px solid var(--red);text-align:center;line-height:1.5}

.btn{padding:9px 14px;border-radius:22px;text-decoration:none;font-weight:600;font-size:.8em;transition:all .2s;cursor:pointer;border:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;width:100%;margin-top:6px}
.btn-follow{background:var(--green);color:#fff}.btn-follow:hover{background:#16a34a;transform:scale(1.02)}
.btn-report{background:var(--red);color:#fff}.btn-report:hover{background:#dc2626;transform:scale(1.02)}
.btn-copy{background:var(--bg2);color:var(--text);border:1px solid var(--border)}.btn-copy:hover{background:#f1f3f5}.btn-copy.copied{background:var(--green)!important;color:#fff!important;border-color:var(--green)}

.fake-info-panel{background:#fff;border:2px solid #fecaca;border-radius:16px;padding:25px;margin:30px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;text-align:center}
.fake-stat{background:#fef2f2;border-radius:12px;padding:20px}
.fake-stat .num{font-size:2.5em;font-weight:800;color:var(--red);line-height:1}
.fake-stat .lbl{color:#991b1b;font-size:.85em;margin-top:6px;font-weight:600}
.fake-stat .act{color:var(--red);font-size:.75em;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:1px}

.updates-section{background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid rgba(59,130,246,.2);border-radius:18px;padding:28px;margin:30px 0;text-align:center}
.updates-section h3{color:#1e40af;font-size:1.2em;margin-bottom:8px}
.updates-section p{color:#3b82f6;font-size:.9em;margin-bottom:16px}
.updates-section .update-list{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.update-tag{background:#fff;color:#1e40af;padding:6px 16px;border-radius:20px;font-size:.8em;font-weight:600;border:1px solid rgba(59,130,246,.2)}

.action-steps{background:#fef3c7;border:2px solid rgba(245,158,11,.3);border-radius:18px;padding:28px;margin:35px 0}
.action-steps h3{color:#92400e;font-size:1.2em;margin-bottom:16px;text-align:center;font-weight:700}
.action-steps ol{list-style:none;counter-reset:step;padding:0}
.action-steps ol li{counter-increment:step;padding:12px 12px 12px 46px;position:relative;color:var(--text);font-size:.9em;line-height:1.7;margin:8px 0;background:#fff;border-radius:10px;box-shadow:var(--shadow)}
.action-steps ol li::before{content:counter(step);position:absolute;left:8px;top:10px;width:28px;height:28px;background:var(--yellow);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8em}
.tip-box{background:#fff;border:2px solid rgba(245,158,11,.3);border-radius:12px;padding:16px;margin-top:18px;text-align:center}
.tip-box strong{color:#92400e}

.music-section{margin:40px 0}.music-section .section-title{border-bottom-color:var(--spotify)}
.music-player-container{background:var(--bg);border-radius:18px;border:2px solid var(--border);overflow:hidden;box-shadow:var(--shadow)}
.now-playing-card{display:flex;gap:22px;padding:22px;background:linear-gradient(135deg,#191414,#282828);color:#fff;border-bottom:1px solid rgba(255,255,255,.1);flex-wrap:wrap}
.now-playing-cover{width:160px;height:160px;border-radius:12px;overflow:hidden;background:#333;flex-shrink:0;box-shadow:0 8px 25px rgba(0,0,0,.3)}
.now-playing-cover img{width:100%;height:100%;object-fit:cover}
.default-cover{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1db954,#169c46);color:#fff}
.now-playing-info{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:200px}
.now-playing-title{font-size:1.4em;font-weight:700;margin-bottom:3px}
.now-playing-artist{color:#b3b3b3;font-size:.9em;margin-bottom:16px}
.progress-container{margin-bottom:14px}
.progress-bar{width:100%;height:5px;background:rgba(255,255,255,.2);border-radius:3px;cursor:pointer;margin-bottom:5px;position:relative}
.progress-fill{height:100%;background:var(--spotify);border-radius:3px;width:0%;transition:width .1s linear;position:relative}
.progress-fill::after{content:'';position:absolute;right:-6px;top:-3px;width:12px;height:12px;background:#fff;border-radius:50%;opacity:0;transition:opacity .2s}
.progress-bar:hover .progress-fill::after{opacity:1}
.time-display{display:flex;justify-content:space-between;font-size:.7em;color:#b3b3b3}
.controls{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.control-btn{background:none;border:none;color:#b3b3b3;cursor:pointer;padding:4px;border-radius:50%;transition:all .2s;display:flex;align-items:center;justify-content:center}
.control-btn:hover{color:#fff;transform:scale(1.1)}
.play-btn{background:#fff;color:#191414;width:46px;height:46px;border-radius:50%}.play-btn:hover{transform:scale(1.08);background:#f0f0f0}
.volume-control{display:flex;align-items:center;gap:8px;color:#b3b3b3}
.volume-slider{width:100px;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.2);border-radius:2px;outline:none;cursor:pointer}
.volume-slider::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;cursor:pointer}

.playlist-container{max-height:400px;overflow-y:auto}
.playlist-header{padding:14px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg);z-index:1}
.playlist-header h3{font-size:1.05em;font-weight:700}.song-count{color:var(--text2);font-size:.8em}
.playlist{padding:6px 0}
.playlist-item{display:flex;align-items:center;gap:12px;padding:10px 22px;cursor:pointer;transition:all .2s;border-bottom:1px solid #f8f9fa}
.playlist-item:hover{background:var(--bg2)}.playlist-item.active{background:rgba(29,185,84,.08)}
.playlist-number{font-size:.85em;color:#adb5bd;width:26px;text-align:center;font-weight:600}
.playlist-cover-small{width:42px;height:42px;border-radius:7px;overflow:hidden;background:var(--bg2);flex-shrink:0}
.playlist-cover-small img{width:100%;height:100%;object-fit:cover}
.default-cover-small{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1db954,#169c46);color:#fff}
.playlist-info{flex:1;min-width:0}.playlist-title{font-weight:600;font-size:.85em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.playlist-artist{color:var(--text2);font-size:.75em}
.playlist-eq{display:none}.playlist-item.active .playlist-eq{display:flex;gap:2px;align-items:flex-end;height:16px}
.eq-bar{width:3px;background:var(--spotify);border-radius:1px;animation:equalizer .8s infinite}
.eq-bar:nth-child(1){animation-delay:0s}.eq-bar:nth-child(2){animation-delay:.2s}.eq-bar:nth-child(3){animation-delay:.4s}.eq-bar:nth-child(4){animation-delay:.6s}

.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;margin:20px 0}
.gallery-item{text-align:center}.gallery-image-wrapper{background:#fff;border-radius:14px;border:2px solid var(--border);overflow:hidden;transition:all .3s;box-shadow:var(--shadow)}
.gallery-image-wrapper:hover{border-color:var(--pink);box-shadow:var(--shadow-lg)}
.gallery-img{width:100%;height:auto;display:block;object-fit:contain;cursor:pointer;transition:transform .3s}
.gallery-img:hover{transform:scale(1.03)}.gallery-img.zoomed{transform:scale(1.5);z-index:1000;position:relative;box-shadow:0 25px 70px rgba(0,0,0,.3);border-radius:14px}
.gallery-caption{color:var(--text2);font-size:.8em;margin-top:8px;padding:0 8px}

.footer{text-align:center;padding:35px 20px 25px;color:#adb5bd;font-size:.85em;border-top:1px solid var(--border);margin-top:35px;background:var(--bg)}

@media(max-width:768px){
.name{font-size:1.7em}.comparison-grid{grid-template-columns:1fr}
.gallery-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.now-playing-card{flex-direction:column;align-items:center;text-align:center}
.now-playing-cover{width:130px;height:130px}.controls{justify-content:center}.volume-control{justify-content:center}
.proof-img.zoomed,.gallery-img.zoomed{transform:scale(1.2)}
.playlist-item{padding:8px 14px}
}
@media(max-width:480px){
.header{padding:30px 15px 25px}.photo{width:100px;height:100px}.name{font-size:1.4em}
.now-playing-cover{width:100px;height:100px}.proof-img.zoomed,.gallery-img.zoomed{transform:scale(1.1)}
}
</style>
</head>
<body>
<div class="scroll-progress" id="scrollProgress"></div>

<header class="header">
<img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="photo scale-in" onerror="this.style.display='none'">
<h1 class="name fade-up">${DATA.celebrity.name}</h1>
<p class="bio fade-up">${DATA.celebrity.bio}</p>
<div class="badge-row fade-up">
<span class="badge-official">✓ OFFICIAL PAGE</span>
<span class="badge-fun">✦ ENTERTAINMENT</span>
</div>
<div class="social-links fade-up">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener noreferrer" class="social-btn tiktok">
<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
TikTok
</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener noreferrer" class="social-btn facebook">
<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
Facebook
</a>
</div>
</header>

<main class="container">

<div class="warning-hero fade-up">
<span class="big-icon">⚠️</span>
<h2>Beware of Fake Accounts</h2>
<p>Multiple impersonator accounts are using this identity. Check the real and fake profiles below to stay safe.</p>
</div>

<div class="official-box fade-up">
<div class="check-icon">✓</div>
<h3>Only This Account is Authentic</h3>
<div class="uname">@baiillamaach_official</div>
<div class="nobackup">This is our one and only official profile. No backup or secondary accounts exist.</div>
<div class="social-links">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener noreferrer" class="social-btn tiktok">🎵 Follow on TikTok</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener noreferrer" class="social-btn facebook">📘 Follow on Facebook</a>
</div>
</div>

<div class="section fade-up">
<h2 class="section-title">⚡ Real Accounts</h2>
<div class="comparison-grid">
${DATA.realAccounts.map(a => `
<div class="comparison-card real">
<div class="comparison-header"><span class="icon">✓</span><h3>Real Account</h3></div>
<span class="platform-badge">${a.platform}</span>
<div class="username-display">${a.username}</div>
${a.screenshot ? `<div class="screenshot-wrapper"><div class="real-checkmark">✓</div><div class="screenshot-box"><img src="${a.screenshot}" alt="Real Account" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy"></div></div><span class="click-hint">🖱️ Click to zoom</span>` : ''}
<a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn btn-follow">→ Follow Now</a>
</div>`).join('')}
</div>
</div>

<div class="section fade-up">
<h2 class="section-title fake">🚨 Fake Accounts — Stay Alert</h2>

<div class="fake-info-panel">
<div class="fake-stat"><div class="num">${totalFake}</div><div class="lbl">Fake Accounts Detected</div><div class="act">⚠️ Active Threats</div></div>
<div class="fake-stat"><div class="num">${DATA.realAccounts.length}</div><div class="lbl">Official Accounts</div><div class="act">✓ Verified</div></div>
<div class="fake-stat"><div class="num">100%</div><div class="lbl">Impersonation Risk</div><div class="act">🔴 High Alert</div></div>
</div>

<div class="comparison-grid">
${DATA.fakeAccounts.map(a => `
<div class="comparison-card fake">
<div class="comparison-header"><span class="icon">⚠️</span><h3>Fake Account</h3></div>
<span class="platform-badge">${a.platform}</span>
<div class="username-display">${a.username}</div>
${a.screenshot ? `<div class="screenshot-wrapper"><div class="premium-warning"><div class="warning-main">⚠️ Fake Account Alert</div><div class="warning-sub">FRAUD</div></div><div class="danger-badge">⚠️ FAKE</div><div class="screenshot-box"><img src="${a.screenshot}" alt="Fake Account" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy"></div></div><span class="click-hint">🖱️ Click to zoom</span>` : ''}
${a.reason ? `<div class="reason-box"><strong>⚠️</strong> ${a.reason}</div>` : ''}
<a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-report">🚨 Report Account</a>
<button class="btn btn-copy" data-username="${a.username}">📋 Copy Username</button>
</div>`).join('')}
</div>
</div>

<div class="updates-section fade-up">
<h3>🔄 Latest Updates & Information</h3>
<p>Stay informed about the latest impersonation attempts and security measures.</p>
<div class="update-list">
<span class="update-tag">📌 New fake accounts reported weekly</span>
<span class="update-tag">🔒 Official verification badge active</span>
<span class="update-tag">🛡️ Community reporting system active</span>
<span class="update-tag">📢 Awareness campaign ongoing</span>
</div>
</div>

${coverSongs.length > 0 ? `
<div class="music-section fade-up">
<h2 class="section-title"><span>🎵</span> Cover Music</h2>
<div class="music-player-container">
<div class="now-playing-card">
<div class="now-playing-cover" id="nowPlayingCover"><div class="default-cover"><svg viewBox="0 0 24 24" width="56" height="56"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div></div>
<div class="now-playing-info">
<div class="now-playing-title" id="nowPlayingTitle">Select a song</div>
<div class="now-playing-artist" id="nowPlayingArtist">Cover Songs Collection</div>
<div class="progress-container">
<div class="progress-bar" id="progressBar"><div class="progress-fill" id="progressFill"></div></div>
<div class="time-display"><span id="currentTime">0:00</span><span id="totalTime">0:00</span></div>
</div>
<div class="controls">
<button class="control-btn" onclick="prevSong()"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
<button class="control-btn play-btn" id="playPauseBtn" onclick="togglePlay()"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path id="playIcon" d="M8 5v14l11-7z"/><path id="pauseIcon" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" style="display:none"/></svg></button>
<button class="control-btn" onclick="nextSong()"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
</div>
<div class="volume-control">
<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
<input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="70" onchange="setVol(this.value)">
</div>
</div>
</div>
<div class="playlist-container">
<div class="playlist-header"><h3>📋 Playlist</h3><span class="song-count">${coverSongs.length} songs</span></div>
<div class="playlist" id="playlist">
${coverSongs.map((s, i) => `
<div class="playlist-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl || ''}" onclick="playSong(${i})">
<div class="playlist-number">${(i+1).toString().padStart(2,'0')}</div>
<div class="playlist-cover-small">${s.coverUrl ? `<img src="${s.coverUrl}" alt="${s.title}" onerror="this.style.display='none'">` : '<div class="default-cover-small"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>'}</div>
<div class="playlist-info"><div class="playlist-title">${s.title}</div><div class="playlist-artist">${s.artist}</div></div>
<div class="playlist-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
</div>`).join('')}
</div>
</div>
</div>
</div>` : ''}

${galleryPhotos.length > 0 ? `
<div class="section fade-up">
<h2 class="section-title">📸 Official Gallery</h2>
<div class="gallery-grid">
${galleryPhotos.map(p => `
<div class="gallery-item">
<div class="gallery-image-wrapper"><img src="${p.path}" alt="${p.caption || 'Gallery'}" class="gallery-img" onclick="this.classList.toggle('zoomed')" loading="lazy"></div>
${p.caption ? `<p class="gallery-caption">${p.caption}</p>` : ''}
</div>`).join('')}
</div>
</div>` : ''}

<div class="action-steps fade-up">
<h3>🛡️ What You Should Do</h3>
<ol>
<li>Visit the fake accounts listed above and "Report" them immediately</li>
<li>Never share personal information outside the official account</li>
<li>If you're unsure, use only the official link provided here</li>
</ol>
<div class="tip-box"><strong>💡 Remember:</strong> We will never ask for money or passwords in DMs. Always verify through official links above.</div>
</div>

</main>

<footer class="footer"><p>© ${DATA.celebrity.name} • Official Verification Hub</p></footer>

<audio id="audioPlayer" preload="auto"></audio>

<script>
window.addEventListener('scroll',()=>{const p=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100;document.getElementById('scrollProgress').style.width=p+'%'});
const ob=new IntersectionObserver((e)=>{e.forEach(x=>{if(x.isIntersecting)x.target.classList.add('vis')})},{threshold:.15});
document.querySelectorAll('.fade-up,.scale-in').forEach(el=>ob.observe(el));

let cur=-1,playing=false,ap=document.getElementById('audioPlayer'),items=document.querySelectorAll('.playlist-item');
function loadSong(i){
if(i<0||i>=items.length)return;cur=i;const it=items[i];
ap.src=it.dataset.audio;
document.getElementById('nowPlayingTitle').textContent=it.querySelector('.playlist-title').textContent;
document.getElementById('nowPlayingArtist').textContent=it.querySelector('.playlist-artist').textContent;
const cc=document.getElementById('nowPlayingCover');
if(it.dataset.cover){cc.innerHTML='<img src="'+it.dataset.cover+'" onerror="this.parentElement.innerHTML=\\'<div class=default-cover><svg viewBox=\\\\'0 0 24 24\\\\' width=\\\\'56\\\\' height=\\\\'56\\\\'><path fill=\\\\'currentColor\\\\' d=\\\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\\\'/></svg></div>\\'">'}
else{cc.innerHTML='<div class="default-cover"><svg viewBox="0 0 24 24" width="56" height="56"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>'}
document.querySelectorAll('.playlist-item').forEach(el=>el.classList.remove('active'));it.classList.add('active');
document.getElementById('progressFill').style.width='0%';document.getElementById('currentTime').textContent='0:00';document.getElementById('totalTime').textContent='0:00';
ap.play().then(()=>{playing=true;upPlayBtn()}).catch(()=>{});
}
function playSong(i){if(i===cur)togglePlay();else loadSong(i)}
function togglePlay(){if(!ap.src&&items.length>0){loadSong(0);return}if(playing)ap.pause();else ap.play();playing=!playing;upPlayBtn()}
function upPlayBtn(){document.getElementById('playIcon').style.display=playing?'none':'block';document.getElementById('pauseIcon').style.display=playing?'block':'none'}
function nextSong(){if(items.length===0)return;loadSong((cur+1)%items.length)}
function prevSong(){if(items.length===0)return;loadSong(cur<=0?items.length-1:cur-1)}
function setVol(v){ap.volume=v/100}
ap.addEventListener('timeupdate',()=>{if(ap.duration){document.getElementById('progressFill').style.width=(ap.currentTime/ap.duration)*100+'%';const cm=Math.floor(ap.currentTime/60),cs=Math.floor(ap.currentTime%60);document.getElementById('currentTime').textContent=cm+':'+cs.toString().padStart(2,'0')}});
ap.addEventListener('loadedmetadata',()=>{const tm=Math.floor(ap.duration/60),ts=Math.floor(ap.duration%60);document.getElementById('totalTime').textContent=tm+':'+ts.toString().padStart(2,'0')});
ap.addEventListener('ended',nextSong);
document.getElementById('progressBar').addEventListener('click',e=>{const r=e.target.getBoundingClientRect();ap.currentTime=(e.clientX-r.left)/r.width*ap.duration});
ap.volume=.7;

document.querySelectorAll('.btn-copy').forEach(b=>b.addEventListener('click',function(){navigator.clipboard.writeText(this.dataset.username).then(()=>{this.innerHTML='✓ Copied!';this.classList.add('copied');setTimeout(()=>{this.innerHTML='📋 Copy Username';this.classList.remove('copied')},2000)})}));
document.querySelectorAll('.proof-img,.gallery-img').forEach(img=>img.addEventListener('click',function(e){e.stopPropagation();const w=this.classList.contains('zoomed');document.querySelectorAll('.proof-img.zoomed,.gallery-img.zoomed').forEach(i=>i.classList.remove('zoomed'));if(!w)this.classList.add('zoomed')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.proof-img.zoomed,.gallery-img.zoomed').forEach(i=>i.classList.remove('zoomed'))});
document.addEventListener('click',e=>{if(!e.target.classList.contains('proof-img')&&!e.target.classList.contains('gallery-img'))document.querySelectorAll('.proof-img.zoomed,.gallery-img.zoomed').forEach(i=>i.classList.remove('zoomed'))});
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,'Inter',sans-serif;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#1a1a1a}.login-box{background:#fff;border:2px solid #e9ecef;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 10px 40px rgba(0,0,0,.08)}.login-box h2{text-align:center;color:#ff0050;margin-bottom:30px;font-size:1.8em}.form-group{margin-bottom:20px}.form-group label{display:block;margin-bottom:8px;color:#6c757d;font-size:.9em;font-weight:600}.form-group input{width:100%;padding:12px 16px;background:#f8f9fa;border:2px solid #e9ecef;border-radius:10px;color:#1a1a1a;font-size:1em;outline:none;transition:border .3s}.form-group input:focus{border-color:#ff0050}.btn{width:100%;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer;transition:all .3s}.btn:hover{background:#d90040;transform:translateY(-2px);box-shadow:0 5px 20px rgba(255,0,80,.3)}.error{background:#fee2e2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:.9em}.back-link{text-align:center;margin-top:20px}.back-link a{color:#6c757d;text-decoration:none;font-size:.9em}.back-link a:hover{color:#ff0050}</style></head><body><div class="login-box"><h2>🔐 Admin Login</h2>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="form-group"><label>Username</label><input type="text" name="username" placeholder="Enter username" required></div><div class="form-group"><label>Password</label><input type="password" name="password" placeholder="Enter password" required></div><button type="submit" class="btn">Login</button></form><div class="back-link"><a href="/">← Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(galleryPhotos = [], message = '', error = '') {
    const photosHTML = galleryPhotos.map(p => `<div class="photo-card"><img src="${p.path}" alt="${p.caption||''}" class="photo-preview"><div class="photo-info">${p.caption?`<p class="photo-caption">${p.caption}</p>`:''}<p class="photo-date">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button type="submit" class="btn-delete" onclick="return confirm('Delete this photo?')">🗑️ Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,'Inter',sans-serif;background:#f8f9fa;color:#1a1a1a;min-height:100vh}.admin-header{background:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e9ecef;flex-wrap:wrap;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.05)}.admin-header h2{color:#ff0050;font-size:1.5em}.admin-header a{color:#6c757d;text-decoration:none;padding:8px 16px;border:2px solid #e9ecef;border-radius:8px;transition:all .3s;font-size:.9em;font-weight:600}.admin-header a:hover{background:#ff0050;color:#fff;border-color:#ff0050}.container{max-width:1000px;margin:0 auto;padding:30px 20px}.upload-section{background:#fff;border:2px solid #e9ecef;border-radius:16px;padding:30px;margin-bottom:30px;box-shadow:0 4px 15px rgba(0,0,0,.05)}.upload-section h3{color:#ff0050;margin-bottom:20px;font-size:1.3em}.form-group{margin-bottom:15px}.form-group label{display:block;margin-bottom:6px;color:#6c757d;font-size:.9em;font-weight:600}.form-group input,.form-group textarea{width:100%;padding:10px 14px;background:#f8f9fa;border:2px solid #e9ecef;border-radius:8px;color:#1a1a1a;font-size:.95em;outline:none}.form-group input[type="file"]{padding:8px}.form-group textarea{resize:vertical;min-height:60px}.form-group input:focus,.form-group textarea:focus{border-color:#ff0050}.btn-upload{background:#22c55e;color:#fff;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:1em;transition:all .3s}.btn-upload:hover{background:#16a34a;transform:translateY(-2px)}.photos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}.photo-card{background:#fff;border:2px solid #e9ecef;border-radius:12px;overflow:hidden;transition:all .3s;display:flex;flex-direction:column}.photo-card:hover{border-color:#ff0050;box-shadow:0 8px 25px rgba(0,0,0,.1)}.photo-preview{width:100%;height:200px;object-fit:cover}.photo-info{padding:12px;flex:1}.photo-caption{font-size:.85em;color:#1a1a1a;margin-bottom:4px}.photo-date{font-size:.75em;color:#adb5bd}.btn-delete{background:#fee2e2;color:#dc2626;border:2px solid #fecaca;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:.8em;margin:0 12px 12px;transition:all .3s;width:calc(100% - 24px);font-weight:600}.btn-delete:hover{background:#ef4444;color:#fff;border-color:#ef4444}.message{background:#dcfce7;border:2px solid #bbf7d0;color:#166534;padding:12px;border-radius:8px;margin-bottom:20px}.error-message{background:#fee2e2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px}.empty-state{text-align:center;padding:40px;color:#adb5bd}</style></head><body><div class="admin-header"><h2>📸 Admin Panel</h2><div style="display:flex;gap:10px"><a href="/">🏠 Home</a><a href="/admin/logout">🚪 Logout</a></div></div><div class="container">${message?`<div class="message">${message}</div>`:''}${error?`<div class="error-message">${error}</div>`:''}<div class="upload-section"><h3>📤 Upload New Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="form-group"><label>Select Photo *</label><input type="file" name="photo" accept="image/*" required></div><div class="form-group"><label>Caption (optional)</label><input type="text" name="caption" placeholder="Enter photo caption..."></div><button type="submit" class="btn-upload">📤 Upload Photo</button></form></div><h3 style="margin-bottom:20px">🖼️ Gallery Photos (${galleryPhotos.length})</h3>${galleryPhotos.length>0?`<div class="photos-grid">${photosHTML}</div>`:'<div class="empty-state">No photos uploaded yet.</div>'}</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dirname, pathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac' };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            const range = req.headers.range;
            if (range && ['.mp3','.wav','.ogg','.m4a','.aac'].includes(ext)) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': (end-start)+1, 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' });
                fs.createReadStream(assetPath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, { 'Content-Type': ct, 'Content-Length': stat.size, 'Cache-Control': 'public, max-age=86400', 'Accept-Ranges': 'bytes' });
                fs.createReadStream(assetPath).pipe(res);
            }
        } else { res.writeHead(404); res.end('Not found'); }
        return;
    }

    if (pathname === '/admin' && req.method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p)); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminLoginHTML()); return;
    }

    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = ''; req.on('data', c => body += c); req.on('end', async () => {
            const params = new URLSearchParams(body);
            const valid = await verifyAdmin(params.get('username'), params.get('password'));
            if (valid) { const sid = createSession(params.get('username')); res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${sid}; HttpOnly; Path=/; Max-Age=7200` }); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminLoginHTML('Invalid username or password!')); }
        }); return;
    }

    if (pathname === '/admin/logout') { sessions.delete(cookies.sessionId); res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0' }); res.end(); return; }

    if (pathname === '/admin/upload' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true, maxFileSize: 10*1024*1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p, '', 'Upload error: '+err.message)); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf || !pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p, '', 'Please select a photo')); return; }
            const ext = path.extname(pf.originalFilename).toLowerCase();
            if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p, '', 'Invalid file type')); return; }
            const fn = Date.now()+'_'+pf.originalFilename.replace(/[^a-zA-Z0-9.]/g,'_');
            const np = path.join(GALLERY_DIR, fn);
            try {
                fs.renameSync(pf.filepath, np);
                await savePhoto({ path: '/assets/gallery/'+fn, caption: fields.caption ? (Array.isArray(fields.caption)?fields.caption[0]:fields.caption) : '', originalName: pf.originalFilename });
                const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p, '✅ Photo uploaded!'));
            } catch(e) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p, '', 'Error: '+e.message)); }
        }); return;
    }

    if (pathname === '/admin/delete' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        let body = ''; req.on('data', c => body += c); req.on('end', async () => {
            const params = new URLSearchParams(body);
            try { const photo = await db.collection(COLLECTIONS.photos).findOne({ _id: new ObjectId(params.get('photoId')) }); if (photo) { const fp = path.join(__dirname, photo.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); } await deletePhoto(params.get('photoId')); } catch(e) {}
            const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getAdminPanelHTML(p, '🗑️ Photo deleted'));
        }); return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML(photos));
        return;
    }

    if (pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok', mongodb: !!db, timestamp: new Date().toISOString() })); return; }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404</title><style>*{margin:0;padding:0}body{background:#f8f9fa;color:#1a1a1a;font-family:-apple-system,'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}.ec{font-size:130px;font-weight:800;background:linear-gradient(135deg,#ff0050,#00f2ea);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.m{font-size:1.5em;margin:20px 0;color:#6c757d}.btn{display:inline-block;padding:12px 32px;background:#ff0050;color:#fff;text-decoration:none;border-radius:30px;font-weight:600}</style></head><body><div><div class="ec">404</div><p class="m">Page not found</p><a href="/" class="btn">← Back to safety</a></div></body></html>`);
});

async function startServer() {
    await connectDB();
    const songs = getCoverSongs();
    server.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(`🚀 Server: http://localhost:${PORT}`);
        console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
        console.log(`🎵 Cover Songs Found: ${songs.length}`);
        if (songs.length > 0) songs.forEach((s, i) => console.log(`   ${i+1}. ${s.title}`));
        console.log('='.repeat(50));
    });
}

startServer();
server.on('error', (e) => { if (e.code === 'EADDRINUSE') process.exit(1); });

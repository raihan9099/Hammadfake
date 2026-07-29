const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

const PORT = 3000;

// ==================== MONGODB CONFIG ====================
const MONGO_URI = 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority'; // 👈 YOUR MONGODB URI HERE
const DB_NAME = 'verification_hub';
const COLLECTIONS = {
    photos: 'gallery_photos',
    admins: 'admin_users',
    settings: 'site_settings'
};

let db;
let mongoClient;

// ==================== ASSETS DIRECTORY ====================
const ASSETS_DIR = path.join(__dirname, 'assets');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'uploads');
const GALLERY_DIR = path.join(__dirname, 'assets', 'gallery');

// Create directories
[ASSETS_DIR, UPLOADS_DIR, GALLERY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/1785275069221.png",
    danger: "/assets/1785274960485.png"
};

// 2 voice files
const VOICE_FILES = {
    warning1: "/assets/10ff7135b502e2f5660074fdb0969109.mp3",
    warning2: "/assets/077f07c5d2a052c7081e448e6dfdaff6_1.mp3"
};

// ==================== DATABASE FUNCTIONS ====================

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        console.log('✅ MongoDB Connected Successfully');
        
        // Create default admin if not exists
        const admins = db.collection(COLLECTIONS.admins);
        const adminExists = await admins.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await admins.insertOne({
                username: 'admin',
                password: hashedPassword,
                createdAt: new Date()
            });
            console.log('🔑 Default admin created: admin / admin123');
        }
        
        return true;
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('⚠️  Running without database - admin panel will not work');
        return false;
    }
}

async function getGalleryPhotos() {
    if (!db) return [];
    try {
        const photos = await db.collection(COLLECTIONS.photos)
            .find({})
            .sort({ uploadedAt: -1 })
            .toArray();
        return photos;
    } catch (err) {
        console.error('Error fetching photos:', err);
        return [];
    }
}

async function savePhoto(photoData) {
    if (!db) throw new Error('Database not connected');
    return await db.collection(COLLECTIONS.photos).insertOne({
        ...photoData,
        uploadedAt: new Date()
    });
}

async function deletePhoto(id) {
    if (!db) throw new Error('Database not connected');
    return await db.collection(COLLECTIONS.photos).deleteOne({ _id: new ObjectId(id) });
}

async function verifyAdmin(username, password) {
    if (!db) return false;
    const admin = await db.collection(COLLECTIONS.admins).findOne({ username });
    if (!admin) return false;
    return await bcrypt.compare(password, admin.password);
}

// ==================== HTML PAGES ====================

function getMainHTML(galleryPhotos = []) {
    const galleryHTML = galleryPhotos.length > 0 ? `
    <div class="section fade-in-up">
        <h2 class="section-title">📸 Official Gallery</h2>
        <div class="gallery-grid">
            ${galleryPhotos.map(photo => `
            <div class="gallery-item scale-in">
                <div class="gallery-image-wrapper">
                    <img src="${photo.path}" alt="${photo.caption || 'Gallery Photo'}" class="gallery-img" onclick="this.classList.toggle('zoomed')" loading="lazy">
                </div>
                ${photo.caption ? `<p class="gallery-caption">${photo.caption}</p>` : ''}
            </div>
            `).join('')}
        </div>
    </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DATA.celebrity.name} | Official Verification</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Inter','SF Pro Display','Segoe UI',system-ui,sans-serif;background:#0a0b0f;color:#e4e4e7;min-height:100vh;line-height:1.6;overflow-x:hidden}

/* Scroll Progress Bar */
.scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, #ff2d55, #ff6b00);
    z-index: 10001;
    transition: width 0.1s ease;
}

/* Intro Loading */
.intro-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #0a0b0f;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.5s ease, visibility 0.5s ease;
}
.intro-overlay.hidden { opacity: 0; visibility: hidden; }
.intro-content { text-align: center; }
.intro-title { font-size: 2em; font-weight: 800; color: #ff2d55; letter-spacing: 2px; }
.intro-subtitle { color: #a1a1aa; margin-top: 10px; font-size: 1em; }

/* Voice notification */
.voice-notification {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 20, 30, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 45, 85, 0.3);
    border-radius: 16px;
    padding: 14px 24px;
    z-index: 9999;
    display: none;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(255, 45, 85, 0.2);
    max-width: 90%;
}
.voice-notification.show { display: flex; animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideDown { from { transform: translateX(-50%) translateY(-120px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
.voice-text { color: #fff; font-weight: 600; font-size: 0.9em; }
.voice-close { background: rgba(255,255,255,0.1); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.85em; transition: all 0.2s; }
.voice-close:hover { background: #ff2d55; transform: scale(1.1); }

/* Mute button */
.mute-toggle {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 9998;
    background: rgba(30, 30, 40, 0.9);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.3em;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.mute-toggle:hover { border-color: rgba(255,45,85,0.5); transform: scale(1.05); }
.mute-toggle.muted { background: #ff2d55; border-color: #ff2d55; }

/* Fade animations */
.fade-in-up { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease, transform 0.8s ease; }
.fade-in-up.visible { opacity: 1; transform: translateY(0); }
.scale-in { opacity: 0; transform: scale(0.8); transition: opacity 0.6s ease, transform 0.6s ease; }
.scale-in.visible { opacity: 1; transform: scale(1); }
.slide-in-left { opacity: 0; transform: translateX(-50px); transition: opacity 0.8s ease, transform 0.8s ease; }
.slide-in-left.visible { opacity: 1; transform: translateX(0); }
.slide-in-right { opacity: 0; transform: translateX(50px); transition: opacity 0.8s ease, transform 0.8s ease; }
.slide-in-right.visible { opacity: 1; transform: translateX(0); }

/* Typing cursor */
.typing-active { border-right: 3px solid #ff2d55; animation: typingCursor 0.8s infinite; }
@keyframes typingCursor { 0%,100%{border-right-color:#ff2d55} 50%{border-right-color:transparent} }

/* Header */
.header{text-align:center;padding:45px 20px 40px;background:linear-gradient(180deg,#0f0f1a 0%,#0a0b0f 100%);position:relative;overflow:hidden;border-bottom:1px solid rgba(255,45,85,0.15)}
.header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at center,rgba(255,45,85,0.06) 0%,transparent 70%);pointer-events:none}
.photo{width:130px;height:130px;border-radius:50%;border:4px solid #ff2d55;object-fit:cover;margin-bottom:18px;box-shadow:0 0 45px rgba(255,45,85,0.3);background:#1a1a2e}
.name{font-size:2.2em;font-weight:700;color:#fff;letter-spacing:-0.3px}
.bio{color:#a1a1aa;margin-top:6px;font-size:1.05em}
.badge-row{margin-top:15px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.badge-official{background:#ff2d55;color:#fff;padding:8px 22px;border-radius:30px;font-size:0.9em;font-weight:600;animation:softPulse 2.8s infinite}
.badge-fun{background:#ff6b00;color:#fff;padding:8px 22px;border-radius:30px;font-size:0.9em;font-weight:600}
@keyframes softPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,45,85,0.4)}50%{box-shadow:0 0 0 16px rgba(255,45,85,0)}}

.container{max-width:960px;margin:0 auto;padding:20px 20px}

.warning-hero{background:rgba(255,0,0,0.06);border:1.5px solid rgba(255,68,68,0.5);border-radius:20px;padding:28px 22px;margin:30px 0;text-align:center}
.warning-hero .big-icon{font-size:3.2em;display:block;margin-bottom:10px;animation:gentleShake 0.6s infinite}
@keyframes gentleShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.warning-hero h2{color:#ff4d4d;font-size:1.4em;margin-bottom:8px;font-weight:700}
.warning-hero p{color:#ffb3b3;font-size:0.95em}

.section{margin:35px 0}
.section-title{font-size:1.35em;font-weight:700;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #22c55e;display:flex;align-items:center;gap:8px}
.section-title.fake-title{border-bottom-color:#ff4444}

.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:20px 0}

.comparison-card{border-radius:16px;padding:16px;transition:transform 0.2s ease;position:relative;overflow:hidden}
.comparison-card:hover{transform:translateY(-3px)}
.comparison-card.real{background:rgba(34,197,94,0.06);border:1.5px solid rgba(34,197,94,0.45);box-shadow:0 0 25px rgba(34,197,94,0.15)}
.comparison-card.fake{background:rgba(255,68,68,0.06);border:1.5px solid rgba(255,68,68,0.5);box-shadow:0 0 25px rgba(255,68,68,0.15)}
.comparison-card.fake.voice-active{box-shadow:0 0 40px rgba(255,45,85,0.6);border-color:#ff2d55;animation:cardGlow 1s ease-in-out infinite}
@keyframes cardGlow{0%,100%{box-shadow:0 0 30px rgba(255,45,85,0.4)}50%{box-shadow:0 0 60px rgba(255,45,85,0.8)}}

.comparison-header{text-align:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08)}
.comparison-header .icon{font-size:1.5em;display:block;margin-bottom:2px}
.comparison-header h3{font-size:0.95em;margin:2px 0;font-weight:600}
.comparison-card.real .comparison-header h3{color:#22c55e}
.comparison-card.fake .comparison-header h3{color:#ff4d4d}

.platform-badge{display:inline-block;font-weight:600;font-size:0.7em;padding:3px 10px;border-radius:12px;margin-bottom:4px;text-transform:uppercase}
.real .platform-badge{background:#22c55e;color:#000}
.fake .platform-badge{background:#ff4444;color:#fff}

.username-display{font-size:0.8em;font-weight:600;padding:5px 10px;border-radius:6px;display:inline-block;margin:4px 0}
.real .username-display{background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3)}
.fake .username-display{background:rgba(255,68,68,0.2);color:#ff6666;border:1px solid rgba(255,68,68,0.3)}

/* SCREENSHOT - FULL RATIO DISPLAY */
.screenshot-wrapper{position:relative;margin:8px 0;border-radius:12px;overflow:hidden}

.screenshot-box{
    text-align:center;
    background:#000;
    border-radius:12px;
    padding:0;
    border:3px solid rgba(255,255,255,0.2);
    position:relative;
    box-shadow:0 8px 32px rgba(0,0,0,0.8);
    transition:all 0.3s ease;
    width:100%;
}
.screenshot-box:hover{border-color:rgba(255,255,255,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.9)}

.screenshot-wrapper.fake-image::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,0,0,0.06);z-index:2;pointer-events:none;border-radius:12px}

.danger-badge{position:absolute;top:6px;right:6px;z-index:6;background:linear-gradient(135deg,#ff0000,#b30000);color:#fff;padding:4px 8px;border-radius:12px;font-weight:700;font-size:0.6em;letter-spacing:1px;box-shadow:0 0 15px rgba(255,0,0,0.7);text-transform:uppercase}

/* FULL RATIO IMAGE - SHOWS COMPLETE PHOTO */
.proof-img{
    width:100%;
    height:auto;
    display:block;
    object-fit:contain;
    object-position:center;
    border-radius:10px;
    cursor:pointer;
    transition:transform 0.3s ease;
    background:#000;
    position:relative;
    z-index:0;
    max-height:none;
}
.proof-img:hover{transform:scale(1.02)}
.proof-img.zoomed{transform:scale(1.8);z-index:1000;position:relative;box-shadow:0 25px 70px rgba(0,0,0,0.95);border-radius:14px;cursor:zoom-out}

/* PREMIUM WARNING */
.premium-warning{position:absolute;top:0;left:0;right:0;bottom:0;z-index:8;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
.warning-main{font-size:0.8em;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#ff2d55;text-shadow:0 0 20px rgba(255,45,85,0.8);animation:bounceText 1.5s ease-in-out infinite;background:rgba(0,0,0,0.75);padding:6px 16px;border-radius:20px;border:1.5px solid rgba(255,45,85,0.6)}
.warning-sub{font-size:0.9em;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#ff0000;text-shadow:0 0 25px rgba(255,0,0,0.9);animation:bounceText 1.5s ease-in-out infinite 0.3s;background:rgba(0,0,0,0.8);padding:6px 20px;border-radius:20px;border:2px solid rgba(255,0,0,0.8)}
@keyframes bounceText{0%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}50%{transform:translateY(-10px)}70%{transform:translateY(-4px)}85%{transform:translateY(-1px)}}

.click-hint{display:block;color:#71717a;font-size:0.6em;margin-top:3px;text-align:center;position:relative;z-index:5}
.reason-box{color:#ffb3b3;font-size:0.75em;margin-top:8px;padding:8px;background:rgba(255,0,0,0.08);border-radius:8px;border-left:3px solid #ff4444;text-align:center;line-height:1.5}
.btn{padding:8px 14px;border-radius:22px;text-decoration:none;font-weight:600;font-size:0.8em;transition:all 0.2s;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:5px;justify-content:center;width:100%;margin-top:6px}
.btn-follow{background:#22c55e;color:#000;font-size:0.85em}
.btn-follow:hover{background:#1ea84e;transform:scale(1.03)}
.btn-report{background:#ff2d55;color:#fff;font-size:0.85em}
.btn-report:hover{background:#e60040;transform:scale(1.03)}
.btn-copy{background:#27272a;color:#fff;margin-top:5px;font-size:0.75em}
.btn-copy:hover{background:#3f3f46}
.btn-copy.copied{background:#22c55e!important;color:#000!important}

/* GALLERY GRID */
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;margin:20px 0}
.gallery-item{text-align:center}
.gallery-image-wrapper{background:#000;border-radius:12px;border:2px solid rgba(255,255,255,0.15);overflow:hidden;transition:all 0.3s;box-shadow:0 4px 20px rgba(0,0,0,0.5)}
.gallery-image-wrapper:hover{border-color:rgba(255,45,85,0.5);box-shadow:0 8px 30px rgba(255,45,85,0.2)}
.gallery-img{width:100%;height:auto;display:block;object-fit:contain;cursor:pointer;transition:transform 0.3s}
.gallery-img:hover{transform:scale(1.03)}
.gallery-img.zoomed{transform:scale(1.8);z-index:1000;position:relative;box-shadow:0 25px 70px rgba(0,0,0,0.95);border-radius:14px}
.gallery-caption{color:#a1a1aa;font-size:0.8em;margin-top:8px;padding:0 10px}

.action-steps{background:rgba(255,204,0,0.05);border:1.5px solid rgba(255,204,0,0.5);border-radius:18px;padding:28px;margin:35px 0}
.action-steps h3{color:#ffcc00;font-size:1.25em;margin-bottom:18px;text-align:center;font-weight:700}
.action-steps ol{list-style:none;counter-reset:step;padding-left:0}
.action-steps ol li{counter-increment:step;padding:12px 12px 12px 42px;position:relative;color:#d4d4d8;font-size:0.9em;line-height:1.7;margin:8px 0}
.action-steps ol li::before{content:counter(step);position:absolute;left:0;top:10px;width:28px;height:28px;background:#ffcc00;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85em}
.tip-box{background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.4);border-radius:12px;padding:16px;margin-top:20px;text-align:center}
.tip-box strong{color:#ffcc00}

.real-checkmark{position:absolute;top:6px;right:6px;z-index:5;background:#22c55e;color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1em;font-weight:700;box-shadow:0 0 18px rgba(34,197,94,0.7)}

.footer{text-align:center;padding:45px 20px 25px;color:#52525b;font-size:0.85em;border-top:1px solid rgba(255,255,255,0.05);margin-top:15px}

@media(max-width:768px){
    .comparison-grid{grid-template-columns:1fr}
    .gallery-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
    .proof-img.zoomed,.gallery-img.zoomed{transform:scale(1.3)}
    .warning-main{font-size:0.7em;padding:5px 12px}
    .warning-sub{font-size:0.8em;padding:5px 16px}
    .mute-toggle{width:45px;height:45px;bottom:20px;right:20px}
}
@media(max-width:400px){
    .proof-img.zoomed,.gallery-img.zoomed{transform:scale(1.15)}
}
</style>
</head>
<body>

<!-- Scroll Progress Bar -->
<div class="scroll-progress" id="scrollProgress"></div>

<!-- Intro Loading Overlay -->
<div class="intro-overlay" id="introOverlay">
    <div class="intro-content">
        <div class="intro-title" id="introTitle"></div>
        <div class="intro-subtitle" id="introSubtitle"></div>
    </div>
</div>

<!-- Voice notification -->
<div class="voice-notification" id="voiceNotification">
    <span class="voice-text" id="voiceText">⚠️ Warning: Fake account detected!</span>
    <button class="voice-close" onclick="closeNotification()">✕</button>
</div>

<!-- Mute toggle -->
<button class="mute-toggle" id="muteToggle" onclick="toggleMute()" title="Toggle Sound">🔊</button>

<div class="header">
<img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="photo scale-in" onerror="this.style.display='none'">
<h1 class="name fade-in-up" id="mainName">${DATA.celebrity.name}</h1>
<p class="bio fade-in-up" id="mainBio"></p>
<div class="badge-row fade-in-up">
<span class="badge-official">✓ OFFICIAL PAGE</span>
<span class="badge-fun">✦ ENTERTAINMENT</span>
</div>
</div>

<div class="container">

<div class="warning-hero fade-in-up">
<span class="big-icon">⚠️</span>
<h2 id="warningTitle"></h2>
<p id="warningText"></p>
</div>

<div class="section">
<h2 class="section-title fade-in-up" id="realTitle"></h2>
<div class="scale-in" style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.45);border-radius:16px;padding:28px;text-align:center;margin-bottom:25px">
<div style="font-size:3em;margin-bottom:12px">✓</div>
<h3 style="color:#22c55e;font-size:1.4em;margin-bottom:12px" id="onlyAccount"></h3>
<p style="color:#e4e4e7;font-size:1.05em;margin-bottom:10px"><strong style="color:#22c55e;font-size:1.3em">@baiillamaach_official</strong></p>
<p style="color:#a1a1aa;font-size:0.9em;margin-bottom:25px" id="noBackup"></p>
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#22c55e;color:#000;padding:14px 42px;border-radius:35px;text-decoration:none;font-weight:700;font-size:1.1em;transition:all 0.25s;box-shadow:0 0 25px rgba(34,197,94,0.45)" onmouseover="this.style.transform='scale(1.04)';this.style.boxShadow='0 0 45px rgba(34,197,94,0.75)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 0 25px rgba(34,197,94,0.45)'">→ Follow Now</a>
</div>
</div>

<div class="section">
<h2 class="section-title fade-in-up">⚡ Real Account</h2>
<div class="comparison-grid">
${DATA.realAccounts.map(a => `
<div class="comparison-card real slide-in-left">
<div class="comparison-header">
<span class="icon">✓</span>
<h3>Real Account</h3>
</div>
<span class="platform-badge">${a.platform}</span>
<div class="username-display">${a.username}</div>
${a.screenshot ? `
<div class="screenshot-wrapper real-image">
<div class="real-checkmark">✓</div>
<div class="screenshot-box">
<img src="${a.screenshot}" alt="Real Account Screenshot" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy">
</div>
</div>
<span class="click-hint">🖱️ Click to zoom</span>` : ''}
<a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn btn-follow">→ Follow Now</a>
</div>
`).join('')}
</div>
</div>

<div class="section" id="fakeAccountsSection">
<h2 class="section-title fake-title fade-in-up" id="fakeTitle"></h2>
<div class="comparison-grid" id="fakeAccountsGrid">
${DATA.fakeAccounts.map((a, index) => `
<div class="comparison-card fake slide-in-right" id="fakeCard${index}" data-voice="${a.voiceFile || ''}" data-index="${index}">
<div class="comparison-header">
<span class="icon">⚠️</span>
<h3>Fake Account</h3>
</div>
<span class="platform-badge">${a.platform}</span>
<div class="username-display">${a.username}</div>
${a.screenshot ? `
<div class="screenshot-wrapper fake-image">
<div class="premium-warning">
    <div class="warning-main">⚠️ Fake Account Alert</div>
    <div class="warning-sub">FRAUD</div>
</div>
<div class="danger-badge">⚠️ FAKE</div>
<div class="screenshot-box">
<img src="${a.screenshot}" alt="Fake Account Screenshot" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy">
</div>
</div>
<span class="click-hint">🖱️ Click to zoom</span>` : ''}
${a.reason ? `<div class="reason-box"><strong>⚠️</strong> ${a.reason}</div>` : ''}
<a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-report">🚨 Report Account</a>
<button class="btn btn-copy" data-username="${a.username}">📋 Copy Username</button>
</div>
`).join('')}
</div>
</div>

${galleryHTML}

<div class="action-steps fade-in-up">
<h3 id="stepsTitle"></h3>
<ol>
<li id="step1"></li>
<li id="step2"></li>
<li id="step3"></li>
</ol>
<div class="tip-box">
<strong>💡 Remember:</strong> <span id="tipText"></span>
</div>
</div>

</div>

<div class="footer fade-in-up">
<p>© ${DATA.celebrity.name} • Official Verification Hub</p>
</div>

${DATA.fakeAccounts.map((a, index) => a.voiceFile ? `<audio id="voiceAudio${index}" preload="auto" src="${a.voiceFile}"></audio>` : '').join('')}

<script>
// Scroll Progress
window.addEventListener('scroll', () => {
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    document.getElementById('scrollProgress').style.width = scrollPercent + '%';
});

// Intersection Observer for animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.2 });

document.querySelectorAll('.fade-in-up, .scale-in, .slide-in-left, .slide-in-right').forEach(el => observer.observe(el));

// Typing Animation
class TypingAnimation {
    constructor(element, text, speed = 40, delay = 0) {
        this.element = element;
        this.text = text;
        this.speed = speed;
        this.delay = delay;
        this.index = 0;
    }
    start() {
        setTimeout(() => {
            this.element.classList.add('typing-active');
            this.type();
        }, this.delay);
    }
    type() {
        if (this.index < this.text.length) {
            this.element.textContent = this.text.substring(0, this.index + 1);
            this.index++;
            setTimeout(() => this.type(), this.speed);
        } else {
            this.element.classList.remove('typing-active');
        }
    }
}

// Intro
const introTitle = document.getElementById('introTitle');
const introSubtitle = document.getElementById('introSubtitle');
new TypingAnimation(introTitle, '⚠️ VERIFICATION HUB', 60).start();
new TypingAnimation(introSubtitle, 'Loading official information...', 40).start();

setTimeout(() => {
    document.getElementById('introOverlay').classList.add('hidden');
    setTimeout(() => {
        const texts = [
            { id: 'mainName', text: '${DATA.celebrity.name.replace(/'/g, "\\'")}', speed: 50 },
            { id: 'mainBio', text: '${DATA.celebrity.bio.replace(/'/g, "\\'")}', speed: 30 },
            { id: 'warningTitle', text: 'Beware of fake accounts', speed: 40 },
            { id: 'warningText', text: 'Multiple impersonator accounts are using Baiilla Maach\\'s identity. Compare the real and fake profiles below to stay safe.', speed: 20 },
            { id: 'realTitle', text: '🔒 How to identify the real account', speed: 35 },
            { id: 'onlyAccount', text: 'Only this account is authentic', speed: 40 },
            { id: 'noBackup', text: 'This is our one and only official profile. No backup or secondary accounts exist.', speed: 25 },
            { id: 'fakeTitle', text: '🚨 Fake Accounts — Stay Alert', speed: 40 },
            { id: 'stepsTitle', text: '🛡️ What you should do', speed: 40 },
            { id: 'step1', text: 'Visit the fake accounts listed above and "Report" them immediately', speed: 25 },
            { id: 'step2', text: 'Never share personal information outside the official account', speed: 25 },
            { id: 'step3', text: 'If you\\'re unsure, use only the official link provided here', speed: 25 },
            { id: 'tipText', text: 'We will never ask for money or passwords in DMs. Always verify through the Follow Now button above.', speed: 20 }
        ];
        texts.forEach((t, i) => {
            const el = document.getElementById(t.id);
            if (el) { el.textContent = ''; new TypingAnimation(el, t.text, t.speed, i * 400).start(); }
        });
    }, 300);
}, 2500);

// Voice System
let isMuted = false, currentlyPlaying = null;
function closeNotification() {
    document.getElementById('voiceNotification').classList.remove('show');
    if (currentlyPlaying) { currentlyPlaying.pause(); currentlyPlaying.currentTime = 0; document.querySelectorAll('.fake.voice-active').forEach(c => c.classList.remove('voice-active')); currentlyPlaying = null; }
}
function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('muteToggle');
    if (isMuted) { btn.classList.add('muted'); btn.innerHTML = '🔇'; closeNotification(); }
    else { btn.classList.remove('muted'); btn.innerHTML = '🔊'; }
}
function playVoice(card) {
    if (isMuted || !card.dataset.voice) return;
    if (currentlyPlaying) { currentlyPlaying.pause(); currentlyPlaying.currentTime = 0; document.querySelectorAll('.fake.voice-active').forEach(c => c.classList.remove('voice-active')); }
    const audio = document.getElementById('voiceAudio' + card.dataset.index);
    if (!audio) return;
    card.classList.add('voice-active');
    audio.currentTime = 0;
    audio.play().then(() => {
        currentlyPlaying = audio;
        document.getElementById('voiceNotification').classList.add('show');
        setTimeout(() => document.getElementById('voiceNotification').classList.remove('show'), 4000);
    }).catch(() => card.classList.remove('voice-active'));
    audio.onended = () => { card.classList.remove('voice-active'); document.getElementById('voiceNotification').classList.remove('show'); currentlyPlaying = null; };
}
const voiceObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting && !isMuted && (!currentlyPlaying || currentlyPlaying.ended)) playVoice(e.target);
        else if (!e.isIntersecting && e.target.classList.contains('voice-active')) { if (currentlyPlaying) { currentlyPlaying.pause(); currentlyPlaying.currentTime = 0; } e.target.classList.remove('voice-active'); document.getElementById('voiceNotification').classList.remove('show'); currentlyPlaying = null; }
    });
}, { threshold: 0.6 });
document.querySelectorAll('.fake').forEach(c => voiceObs.observe(c));

// Copy & Zoom
document.querySelectorAll('.btn-copy').forEach(b => b.addEventListener('click', function() {
    navigator.clipboard.writeText(this.dataset.username).then(() => { this.innerHTML='✓ Copied'; this.classList.add('copied'); setTimeout(()=>{this.innerHTML='📋 Copy Username'; this.classList.remove('copied')}, 2000); });
}));
document.querySelectorAll('.proof-img, .gallery-img').forEach(img => img.addEventListener('click', function(e) {
    e.stopPropagation();
    const was = this.classList.contains('zoomed');
    document.querySelectorAll('.proof-img.zoomed, .gallery-img.zoomed').forEach(i => i.classList.remove('zoomed'));
    if (!was) this.classList.add('zoomed');
}));
document.addEventListener('keydown', e => { if(e.key==='Escape') document.querySelectorAll('.proof-img.zoomed, .gallery-img.zoomed').forEach(i => i.classList.remove('zoomed')); });
document.addEventListener('click', e => { if(!e.target.classList.contains('proof-img') && !e.target.classList.contains('gallery-img')) document.querySelectorAll('.proof-img.zoomed, .gallery-img.zoomed').forEach(i => i.classList.remove('zoomed')); });
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login | Verification Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Inter',sans-serif;background:#0a0b0f;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff}
.login-box{background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
.login-box h2{text-align:center;color:#ff2d55;margin-bottom:30px;font-size:1.8em}
.form-group{margin-bottom:20px}
.form-group label{display:block;margin-bottom:8px;color:#a1a1aa;font-size:0.9em}
.form-group input{width:100%;padding:12px 16px;background:#0a0b0f;border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:#fff;font-size:1em;outline:none;transition:border 0.3s}
.form-group input:focus{border-color:#ff2d55}
.btn{width:100%;padding:14px;background:#ff2d55;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer;transition:all 0.3s}
.btn:hover{background:#e60040;transform:translateY(-2px)}
.error{background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.3);color:#ff4d4d;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:0.9em}
.back-link{text-align:center;margin-top:20px}
.back-link a{color:#a1a1aa;text-decoration:none;font-size:0.9em}
.back-link a:hover{color:#ff2d55}
</style>
</head>
<body>
<div class="login-box">
<h2>🔐 Admin Login</h2>
${error ? `<div class="error">${error}</div>` : ''}
<form method="POST" action="/admin/login">
<div class="form-group">
<label>Username</label>
<input type="text" name="username" placeholder="Enter username" required>
</div>
<div class="form-group">
<label>Password</label>
<input type="password" name="password" placeholder="Enter password" required>
</div>
<button type="submit" class="btn">Login</button>
</form>
<div class="back-link">
<a href="/">← Back to Home</a>
</div>
</div>
</body>
</html>`;
}

function getAdminPanelHTML(galleryPhotos = [], message = '', error = '') {
    const photosHTML = galleryPhotos.map(photo => `
    <div class="photo-card">
        <img src="${photo.path}" alt="${photo.caption || ''}" class="photo-preview">
        <div class="photo-info">
            ${photo.caption ? `<p class="photo-caption">${photo.caption}</p>` : ''}
            <p class="photo-date">${new Date(photo.uploadedAt).toLocaleDateString()}</p>
        </div>
        <form method="POST" action="/admin/delete" style="display:inline">
            <input type="hidden" name="photoId" value="${photo._id}">
            <button type="submit" class="btn-delete" onclick="return confirm('Delete this photo?')">🗑️ Delete</button>
        </form>
    </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Verification Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Inter',sans-serif;background:#0a0b0f;color:#e4e4e7;min-height:100vh}
.admin-header{background:#1a1a2e;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1)}
.admin-header h2{color:#ff2d55}
.admin-header a{color:#a1a1aa;text-decoration:none;padding:8px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;transition:all 0.3s}
.admin-header a:hover{background:#ff2d55;color:#fff;border-color:#ff2d55}
.container{max-width:1000px;margin:0 auto;padding:30px 20px}
.upload-section{background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;margin-bottom:30px}
.upload-section h3{color:#ff2d55;margin-bottom:20px}
.form-group{margin-bottom:15px}
.form-group label{display:block;margin-bottom:6px;color:#a1a1aa;font-size:0.9em}
.form-group input,.form-group textarea{width:100%;padding:10px 14px;background:#0a0b0f;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:0.95em;outline:none}
.form-group textarea{resize:vertical;min-height:60px}
.form-group input:focus,.form-group textarea:focus{border-color:#ff2d55}
.btn-upload{background:#22c55e;color:#000;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:1em;transition:all 0.3s}
.btn-upload:hover{background:#1ea84e;transform:translateY(-2px)}
.photos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}
.photo-card{background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;transition:all 0.3s}
.photo-card:hover{border-color:rgba(255,45,85,0.5)}
.photo-preview{width:100%;height:200px;object-fit:cover}
.photo-info{padding:12px}
.photo-caption{font-size:0.85em;color:#e4e4e7;margin-bottom:4px}
.photo-date{font-size:0.75em;color:#71717a}
.btn-delete{background:rgba(255,0,0,0.2);color:#ff4d4d;border:1px solid rgba(255,0,0,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8em;margin:0 12px 12px;transition:all 0.3s}
.btn-delete:hover{background:#ff2d55;color:#fff}
.message{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e;padding:12px;border-radius:8px;margin-bottom:20px}
.error-message{background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.3);color:#ff4d4d;padding:12px;border-radius:8px;margin-bottom:20px}
.empty-state{text-align:center;padding:40px;color:#71717a}
</style>
</head>
<body>
<div class="admin-header">
<h2>📸 Admin Panel</h2>
<div>
<a href="/">🏠 Home</a>
<a href="/admin/logout" style="margin-left:10px">🚪 Logout</a>
</div>
</div>

<div class="container">
${message ? `<div class="message">${message}</div>` : ''}
${error ? `<div class="error-message">${error}</div>` : ''}

<div class="upload-section">
<h3>📤 Upload New Photo</h3>
<form method="POST" action="/admin/upload" enctype="multipart/form-data">
<div class="form-group">
<label>Select Photo</label>
<input type="file" name="photo" accept="image/*" required>
</div>
<div class="form-group">
<label>Caption (optional)</label>
<input type="text" name="caption" placeholder="Enter photo caption...">
</div>
<button type="submit" class="btn-upload">📤 Upload Photo</button>
</form>
</div>

<h3 style="margin-bottom:20px;color:#fff">🖼️ Gallery Photos (${galleryPhotos.length})</h3>
${galleryPhotos.length > 0 ? `<div class="photos-grid">${photosHTML}</div>` : '<div class="empty-state">No photos uploaded yet. Use the form above to add photos.</div>'}
</div>
</body>
</html>`;
}

// ==================== DATA ====================
const DATA = {
    celebrity: {
        name: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Entertainment purposes only. Stay aware of impersonators."
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            screenshot: IMAGES.official,
            description: "The only official account"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            dangerLevel: "high",
            reason: "This account is fake. It copies our logo and posts to deceive followers.",
            voiceFile: VOICE_FILES.warning1
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            dangerLevel: "medium",
            reason: "This account is fake. It uses our name and photo to mislead followers.",
            voiceFile: VOICE_FILES.warning2
        }
    ]
};

// ==================== SESSION MANAGEMENT ====================
const sessions = new Map();

function createSession(username) {
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions.set(sessionId, { username, createdAt: Date.now() });
    // Session expires in 2 hours
    setTimeout(() => sessions.delete(sessionId), 2 * 60 * 60 * 1000);
    return sessionId;
}

function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() - session.createdAt > 2 * 60 * 60 * 1000) {
        sessions.delete(sessionId);
        return null;
    }
    return session;
}

function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
        });
    }
    return cookies;
}

// ==================== SERVER ====================
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dirname, pathname);
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const contentTypes = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
                '.ogg': 'audio/ogg', '.m4a': 'audio/mp4'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            
            const range = req.headers.range;
            if (range && (ext === '.mp3' || ext === '.wav' || ext === '.ogg')) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': (end - start) + 1,
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400'
                });
                fs.createReadStream(assetPath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stat.size,
                    'Cache-Control': 'public, max-age=86400',
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(assetPath).pipe(res);
            }
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
        return;
    }

    // ==================== ADMIN ROUTES ====================
    
    // Admin login page
    if (pathname === '/admin' && req.method === 'GET') {
        const session = getSession(cookies.sessionId);
        if (session) {
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getAdminPanelHTML(photos));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }

    // Admin login POST
    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            const isValid = await verifyAdmin(username, password);
            if (isValid) {
                const sessionId = createSession(username);
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=7200`
                });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid username or password!'));
            }
        });
        return;
    }

    // Admin logout
    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
        });
        res.end();
        return;
    }

    // Admin upload photo
    if (pathname === '/admin/upload' && req.method === 'POST') {
        const session = getSession(cookies.sessionId);
        if (!session) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }

        const form = new formidable.IncomingForm({
            uploadDir: GALLERY_DIR,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Upload error: ' + err.message));
                return;
            }

            const photoFile = files.photo;
            if (!photoFile) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Please select a photo to upload'));
                return;
            }

            const fileName = Date.now() + '_' + photoFile.originalFilename;
            const newPath = path.join(GALLERY_DIR, fileName);
            
            try {
                fs.renameSync(photoFile.filepath, newPath);
                await savePhoto({
                    path: '/assets/gallery/' + fileName,
                    caption: fields.caption || '',
                    originalName: photoFile.originalFilename
                });
                
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '✅ Photo uploaded successfully!'));
            } catch (error) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Error saving photo: ' + error.message));
            }
        });
        return;
    }

    // Admin delete photo
    if (pathname === '/admin/delete' && req.method === 'POST') {
        const session = getSession(cookies.sessionId);
        if (!session) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const photoId = params.get('photoId');
            
            if (photoId) {
                try {
                    const photo = await db.collection(COLLECTIONS.photos).findOne({ _id: new ObjectId(photoId) });
                    if (photo) {
                        const filePath = path.join(__dirname, photo.path);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                    await deletePhoto(photoId);
                } catch (err) {
                    console.error('Delete error:', err);
                }
            }
            
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getAdminPanelHTML(photos, '🗑️ Photo deleted'));
        });
        return;
    }

    // ==================== MAIN PAGE ====================
    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML(photos));
        return;
    }

    // Health check
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            mongodb: !!db,
            timestamp: new Date().toISOString() 
        }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0b0f;color:#e4e4e7;font-family:-apple-system,'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}.error-code{font-size:130px;font-weight:800;background:linear-gradient(135deg,#ff2d55,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.message{font-size:1.5em;margin:20px 0;color:#a1a1aa}.btn{display:inline-block;padding:12px 32px;background:#ff2d55;color:#fff;text-decoration:none;border-radius:30px;font-weight:600}</style></head><body><div><div class="error-code">404</div><p class="message">Page not found</p><a href="/" class="btn">← Back to safety</a></div></body></html>`);
});

// ==================== START SERVER ====================
async function startServer() {
    await connectDB();
    
    server.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('✅ VERIFICATION HUB WITH ADMIN PANEL');
        console.log('='.repeat(60));
        console.log(`🚀 Website: http://localhost:${PORT}`);
        console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin`);
        console.log(`📁 Assets: ${ASSETS_DIR}`);
        console.log(`🖼️ Gallery: ${GALLERY_DIR}`);
        console.log('='.repeat(60));
        console.log('🔑 Default Admin Login:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('='.repeat(60));
    });
}

startServer();

server.on('error', (err) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') process.exit(1);
});

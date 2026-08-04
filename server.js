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
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus', '.weba'];
        const audioFiles = files.filter(f => audioExts.includes(path.extname(f).toLowerCase()));
        return audioFiles.map((file, index) => {
            const ext = path.extname(file);
            const baseName = path.basename(file, ext);
            const displayName = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim() || `Track ${index + 1}`;
            return {
                id: `track_${index}`,
                title: displayName,
                artist: 'Baiilla Maach',
                audioUrl: `/assets/covermusic/${file}`,
                fileName: file
            };
        }).sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

// ... (connectDB, gallery functions, verifyAdmin, etc. – same as before)

// (I'll keep them unchanged for brevity, but they must remain)
async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const admins = db.collection('admin_users');
        const exists = await admins.findOne({ username: 'admin' });
        if (!exists) await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        return true;
    } catch (e) { return false; }
}

async function getGalleryPhotos() {
    if (!db) return [];
    try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); }
    catch (e) { return []; }
}

async function savePhoto(d) {
    if (!db) return null;
    return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() });
}

async function deletePhoto(id) {
    if (!db) return null;
    return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
}

async function verifyAdmin(u, p) {
    if (!db) return u === 'admin' && p === 'admin123';
    const a = await db.collection('admin_users').findOne({ username: u });
    if (!a) return false;
    return await bcrypt.compare(p, a.password);
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile",
        username: "@baiillamaach_official"
    },
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger, reason: "Copies official logo and content to deceive followers." },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers." }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    // --- Music section HTML (same as before, but with new classes) ---
    let coverSongsHTML = '';
    if (coverSongs.length > 0) {
        coverSongsHTML = `
        <section class="section music-section section-padding" data-animate>
            <div class="container">
                <div class="section-header text-center mb-5">
                    <h2 class="section-title">Cover Music</h2>
                    <p>Official covers by Baiilla Maach</p>
                </div>
                <div class="android-music-player">
                    <!-- ... same music player structure ... -->
                </div>
            </div>
        </section>`;
    }

    // --- Gallery HTML ---
    let galleryHTML = '';
    if (galleryPhotos.length > 0) {
        galleryHTML = `
        <section class="section gallery-section section-padding" data-animate>
            <div class="container">
                <div class="section-header text-center mb-5">
                    <h2 class="section-title">Official Gallery</h2>
                </div>
                <div class="gallery-grid">
                    ${galleryPhotos.map((p, i) => `
                    <div class="gallery-card" onclick="openGalleryLightbox(${i})">
                        <div class="gallery-card-inner">
                            <img src="${p.path}" alt="${p.caption || 'Gallery'}" class="gallery-image" loading="lazy">
                            <div class="gallery-card-overlay">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M15.5 14h-.79l-.28-.27..."/></svg>
                            </div>
                        </div>
                        ${p.caption ? `<p class="gallery-caption">${p.caption}</p>` : ''}
                    </div>`).join('')}
                </div>
            </div>
        </section>
        <div class="lightbox" id="galleryLightbox">...</div>`;
    }

    // Full HTML (Hosttier theme)
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DATA.celebrity.fullName} | Official Verification Hub</title>
<style>
:root {
    --primary: #ff6600;
    --primary-dark: #cc5500;
    --secondary: #135360;
    --dark: #0f172a;
    --light: #f8fafc;
    --white: #ffffff;
    --border: #e2e8f0;
    --radius: 12px;
    --shadow: 0 4px 6px rgba(0,0,0,0.07);
    --shadow-hover: 0 12px 24px rgba(0,0,0,0.12);
}

* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1e293b; }

/* === HEADER === */
.rts-header {
    background: #fff;
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
    position: sticky;
    top: 0;
    z-index: 1000;
}
.container { max-width: 1200px; margin:0 auto; padding:0 20px; }
.rts-header__wrapper { display: flex; align-items: center; justify-content: space-between; }
.rts-header__logo img { height: 36px; }
.rts-header__right .login__btn {
    background: var(--primary);
    color: #fff;
    padding: 8px 20px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    transition: 0.3s;
}
.rts-header__right .login__btn:hover { background: var(--primary-dark); }

/* === HERO BANNER === */
.hero-banner {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: #fff;
    padding: 80px 0 60px;
    text-align: center;
    position: relative;
    overflow: hidden;
}
.hero-banner::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255,102,0,0.15) 0%, transparent 60%);
    animation: rotate 20s linear infinite;
}
@keyframes rotate { 100% { transform: rotate(360deg); } }
.hero-content { position: relative; z-index: 2; }
.hero-img {
    width: 120px; height: 120px;
    border-radius: 50%;
    border: 3px solid var(--primary);
    margin-bottom: 20px;
    object-fit: cover;
}
.hero-name { font-size: 2.8em; font-weight: 800; margin-bottom: 8px; }
.hero-bio { font-size: 1.1em; opacity: 0.9; }
.badge-verified {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    padding: 6px 18px;
    border-radius: 50px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    margin: 18px 0;
}
.social-links { display: flex; gap: 10px; justify-content: center; }
.social-btn {
    padding: 10px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    border: 2px solid transparent;
    transition: 0.3s;
}
.social-btn.tiktok { background: #000; color: #fff; }
.social-btn.tiktok:hover { background: #fff; color: #000; border-color: #000; }
.social-btn.facebook { background: #1877f2; color: #fff; }
.social-btn.facebook:hover { background: #fff; color: #1877f2; border-color: #1877f2; }

/* === SECTIONS === */
.section-padding { padding: 80px 0; }
.section-title { font-size: 2.2em; font-weight: 800; color: var(--dark); margin-bottom: 8px; }
.section-subtitle { color: #64748b; font-size: 1.05em; }

/* Official verified card */
.official-card {
    background: #fff;
    border: 2px solid #bbf7d0;
    border-radius: 16px;
    padding: 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    box-shadow: var(--shadow);
}
.official-card .info-list { /* ... */ }
.official-card .preview { text-align: center; }
.btn-follow {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    padding: 10px 24px;
    border-radius: 50px;
    display: inline-block;
    font-weight: 600;
    text-decoration: none;
}

/* Fake accounts carousel (styled like cards) */
.fake-section { background: #fff5f5; }
.fake-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
.fake-card {
    background: #fff;
    border: 2px solid #fecaca;
    border-radius: 16px;
    padding: 20px;
    position: relative;
    overflow: hidden;
}
.fake-card::after { content: 'FAKE'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 4em; font-weight: 900; color: rgba(239,68,68,0.05); }
.fake-screenshot img { width: 100%; border-radius: 8px; }
.btn-report { background: #ef4444; color: #fff; border-radius: 50px; padding: 8px 16px; }

/* Music player (android style, orange theme) */
.android-music-player {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: var(--shadow);
}
.amp-now-playing { background: linear-gradient(135deg, #ff6600, #cc5500); color: #fff; padding: 20px; display: flex; align-items: center; gap: 16px; }
.amp-album-art { width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; }
.amp-controls { display: flex; justify-content: center; gap: 20px; padding: 12px; }
.amp-play-btn { width: 56px; height: 56px; background: var(--primary); color: #fff; border-radius: 50%; }
.amp-song-list { max-height: 300px; overflow-y: auto; }
.amp-song-item { padding: 10px 20px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; align-items: center; gap: 12px; }
.amp-song-item.active { background: #fff7f0; border-left: 3px solid var(--primary); }

/* Gallery */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
.gallery-card { border-radius: 12px; overflow: hidden; box-shadow: var(--shadow); transition: 0.3s; }
.gallery-card:hover { transform: translateY(-4px); }
.gallery-image { width: 100%; display: block; }

/* Footer */
.footer { background: #1e293b; color: #cbd5e1; padding: 40px 0; text-align: center; }

/* ... additional styles ... */
</style>
</head>
<body>

<header class="rts-header">
    <div class="container">
        <div class="rts-header__wrapper">
            <div class="rts-header__logo">
                <img src="${DATA.celebrity.photo}" alt="Logo" style="border-radius:50%; width:40px; height:40px; object-fit:cover;">
            </div>
            <div class="rts-header__right">
                <a href="/admin" class="login__btn">Admin</a>
            </div>
        </div>
    </div>
</header>

<section class="hero-banner">
    <div class="hero-content">
        <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-img">
        <h1 class="hero-name">${DATA.celebrity.fullName}</h1>
        <p class="hero-bio">${DATA.celebrity.bio}</p>
        <div class="badge-verified">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="..."/></svg>
            VERIFIED OFFICIAL
        </div>
        <div class="social-links">
            <a href="https://tiktok.com/@baiillamaach_official" class="social-btn tiktok">TikTok</a>
            <a href="https://www.facebook.com/profile.php?id=61575202118828" class="social-btn facebook">Facebook</a>
        </div>
    </div>
</section>

<main class="container">
    <!-- Official Verified Account -->
    <section class="section-padding" data-animate>
        <div class="section-header text-center mb-5">
            <h2 class="section-title">Official Verified Account</h2>
            <p class="section-subtitle">The only authentic account — do not trust imitations</p>
        </div>
        <div class="official-card">
            <div class="info-list">
                <div><strong>Username:</strong> @baiillamaach_official</div>
                <div><strong>Platforms:</strong> TikTok • Facebook</div>
                <div><strong>Status:</strong> <span style="color:#22c55e;">● Active & Verified</span></div>
            </div>
            <div class="preview">
                <img src="${DATA.celebrity.photo}" alt="" width="80" style="border-radius:50%; border:3px solid #22c55e;">
                <p class="mt-2"><strong>@baiillamaach_official</strong></p>
                <a href="https://tiktok.com/@baiillamaach_official" class="btn-follow mt-2">Follow Official</a>
            </div>
        </div>
    </section>

    <!-- Fake Accounts -->
    <section class="fake-section section-padding" data-animate>
        <div class="container">
            <div class="section-header text-center mb-5">
                <h2 class="section-title">⚠️ Fake Accounts Detected</h2>
                <p class="section-subtitle">${totalFake} fake account${totalFake > 1 ? 's' : ''} found — report them immediately</p>
            </div>
            <div class="fake-grid">
                ${DATA.fakeAccounts.map((a, i) => `
                <div class="fake-card">
                    <div class="fake-screenshot"><img src="${a.screenshot}" alt=""></div>
                    <h4 class="mt-3">${a.username} (${a.platform})</h4>
                    <p class="text-muted">${a.reason}</p>
                    <a href="${a.profileUrl}" class="btn-report mt-2">Report Account</a>
                </div>`).join('')}
            </div>
        </div>
    </section>

    ${coverSongsHTML}
    ${galleryHTML}
</main>

<footer class="footer">
    <p>© ${DATA.celebrity.fullName} • Official Verification Hub</p>
</footer>

<!-- Audio player, carousel, gallery scripts (same as before, but updated selectors) -->
<audio id="audioPlayer" preload="auto"></audio>
<script>
// ... (same music player, carousel, gallery logic adapted to new class names) ...
</script>
</body>
</html>`;
}

// ... rest of server.js (unchanged from previous version)

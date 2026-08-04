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

// Auto-detect all music files from covermusic folder
function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus', '.weba'];
        
        // Get all audio files
        const audioFiles = files.filter(f => audioExts.includes(path.extname(f).toLowerCase()));
        
        return audioFiles.map((file, index) => {
            const ext = path.extname(file);
            const baseName = path.basename(file, ext);
            // Clean up the filename for display
            const displayName = baseName
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim() || `Track ${index + 1}`;
            
            return {
                id: `track_${index}`,
                title: displayName,
                artist: 'Baiilla Maach',
                audioUrl: `/assets/covermusic/${file}`,
                fileName: file
            };
        }).sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { 
        console.error('Error reading music files:', e);
        return []; 
    }
}

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
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", screenshot: IMAGES.official },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: null }
    ],
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

    let coverSongsHTML = '';
    if (coverSongs.length > 0) {
        coverSongsHTML = `
        <section class="section music-section" data-animate>
            <div class="section-header">
                <div class="section-icon spotify-icon-bg">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
                <h2 class="section-heading">Cover Music</h2>
            </div>
            <div class="android-music-player">
                <div class="amp-now-playing">
                    <div class="amp-album-art" id="albumArt">
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    </div>
                    <div class="amp-track-info">
                        <div class="amp-track-title" id="currentTitle">No track selected</div>
                        <div class="amp-track-artist" id="currentArtist">Tap a song to play</div>
                    </div>
                </div>
                
                <div class="amp-progress-container">
                    <div class="amp-progress-bar" id="progressBar" onclick="seekAudio(event)">
                        <div class="amp-progress-fill" id="progressFill"></div>
                    </div>
                    <div class="amp-time">
                        <span id="currentTime">0:00</span>
                        <span id="totalTime">0:00</span>
                    </div>
                </div>
                
                <div class="amp-controls">
                    <button class="amp-btn" onclick="previousTrack()" title="Previous">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <button class="amp-btn amp-play-btn" id="playBtn" onclick="togglePlay()" title="Play/Pause">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path id="playIcon" d="M8 5v14l11-7z"/>
                            <path id="pauseIcon" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" style="display:none"/>
                        </svg>
                    </button>
                    <button class="amp-btn" onclick="nextTrack()" title="Next">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                </div>
                
                <div class="amp-volume">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                    <input type="range" class="amp-volume-slider" id="volumeSlider" min="0" max="100" value="80" onchange="setVolume(this.value)">
                </div>
                
                <div class="amp-playlist">
                    <div class="amp-playlist-header">
                        <span>Songs (${coverSongs.length})</span>
                    </div>
                    <div class="amp-song-list" id="songList">
                        ${coverSongs.map((song, index) => `
                        <div class="amp-song-item" id="song-${index}" onclick="playSong(${index})" data-audio="${song.audioUrl}">
                            <div class="amp-song-number">${(index + 1).toString().padStart(2, '0')}</div>
                            <div class="amp-song-details">
                                <div class="amp-song-title">${song.title}</div>
                                <div class="amp-song-artist">${song.artist}</div>
                            </div>
                            <div class="amp-song-duration" id="duration-${index}">--:--</div>
                        </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>`;
    }

    let galleryHTML = '';
    if (galleryPhotos.length > 0) {
        galleryHTML = `
        <section class="section gallery-section" data-animate>
            <div class="section-header">
                <div class="section-icon gallery-icon-bg">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                </div>
                <h2 class="section-heading">Official Gallery</h2>
            </div>
            <div class="gallery-grid">
                ${galleryPhotos.map((p, i) => `
                <div class="gallery-card" onclick="openGalleryLightbox(${i})">
                    <div class="gallery-card-inner">
                        <img src="${p.path}" alt="${p.caption || 'Gallery'}" class="gallery-image" loading="lazy">
                        <div class="gallery-card-overlay">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        </div>
                    </div>
                    ${p.caption ? `<p class="gallery-caption">${p.caption}</p>` : ''}
                </div>`).join('')}
            </div>
        </section>
        <div class="lightbox" id="galleryLightbox">
            <button class="lightbox-close" onclick="closeGalleryLightbox()">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
            <button class="lightbox-nav lightbox-prev" onclick="navigateGallery(-1)">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <img class="lightbox-image" id="lightboxImage" src="" alt="">
            <button class="lightbox-nav lightbox-next" onclick="navigateGallery(1)">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Official Verification Hub for Baiilla Maach. Identify real vs fake accounts.">
<meta name="theme-color" content="#ffffff">
<title>${DATA.celebrity.fullName} | Official Verification Hub</title>
<style>
:root {
    --bg: #ffffff;
    --bg-secondary: #f8fafc;
    --text: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --border: #e2e8f0;
    --shadow: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.08);
    --shadow-xl: 0 20px 50px rgba(0,0,0,0.1);
    --green-50: #f0fdf4;
    --green-100: #dcfce7;
    --green-500: #22c55e;
    --green-600: #16a34a;
    --red-50: #fef2f2;
    --red-100: #fee2e2;
    --red-500: #ef4444;
    --red-600: #dc2626;
    --red-700: #b91c1c;
    --pink: #ff0050;
    --cyan: #00f2ea;
    --fb: #1877f2;
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-2xl: 24px;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    overflow-x: hidden;
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    50% { box-shadow: 0 0 0 16px rgba(34,197,94,0); }
}

@keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    50% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

@keyframes equalizer {
    0%, 100% { height: 4px; }
    50% { height: 16px; }
}

[data-animate] { opacity: 0; }
[data-animate].animated { animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

.scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--pink), var(--cyan), var(--green-500));
    z-index: 10001;
    transition: width 0.1s;
}

.navbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 14px 0;
}

.navbar .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.navbar-logo-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid var(--pink);
    object-fit: cover;
}

.navbar-logo-text {
    font-weight: 700;
    font-size: 1.05em;
    color: var(--text);
}

.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

.hero {
    padding: 50px 0 36px;
    text-align: center;
}

.hero-img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 3px solid var(--pink);
    object-fit: cover;
    box-shadow: 0 0 0 6px rgba(255,0,80,0.08), 0 6px 24px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.hero-name {
    font-size: 2.4em;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
}

.hero-bio {
    font-size: 1.05em;
    color: var(--text-secondary);
    margin-bottom: 18px;
}

.hero-badges {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
}

.badge {
    padding: 7px 18px;
    border-radius: 22px;
    font-size: 0.82em;
    font-weight: 600;
    letter-spacing: 0.2px;
}

.badge-verified {
    background: linear-gradient(135deg, var(--green-500), var(--green-600));
    color: white;
    animation: pulse-green 2.5s infinite;
    display: flex;
    align-items: center;
    gap: 5px;
}

.badge-fun {
    background: linear-gradient(135deg, var(--pink), #ff6b00);
    color: white;
}

.hero-social {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
}

.social-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 24px;
    border-radius: 28px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.88em;
    transition: all 0.25s;
    border: 2px solid transparent;
}

.social-btn.tiktok { background: #000; color: #fff; }
.social-btn.tiktok:hover { background: #fff; color: #000; border-color: #000; transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.social-btn.facebook { background: var(--fb); color: #fff; }
.social-btn.facebook:hover { background: #fff; color: var(--fb); border-color: var(--fb); transform: translateY(-2px); box-shadow: var(--shadow-lg); }

.section { padding: 36px 0; }

.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
}

.section-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.verified-icon-bg { background: linear-gradient(135deg, var(--green-500), var(--green-600)); }
.danger-icon-bg { background: linear-gradient(135deg, var(--red-500), var(--red-600)); }
.spotify-icon-bg { background: linear-gradient(135deg, #1db954, #169c46); }
.gallery-icon-bg { background: linear-gradient(135deg, #6366f1, #a855f7); }

.section-heading {
    font-size: 1.35em;
    font-weight: 700;
    letter-spacing: -0.2px;
}

.official-card {
    background: linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #dcfce7 100%);
    border: 2px solid #bbf7d0;
    border-radius: var(--radius-2xl);
    padding: 32px;
    position: relative;
    box-shadow: var(--shadow-xl);
}

.official-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--green-500), var(--green-600));
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.official-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.official-verify-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, var(--green-500), var(--green-600));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-green 2.5s infinite;
    flex-shrink: 0;
}

.official-card-title h2 {
    font-size: 1.3em;
    font-weight: 700;
    color: #15803d;
}

.official-card-title span {
    font-size: 0.85em;
    color: var(--green-600);
    font-weight: 600;
}

.official-card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

@media (max-width: 700px) { .official-card-body { grid-template-columns: 1fr; } }

.official-info-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.official-info-item {
    background: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    border: 1px solid #dcfce7;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.official-info-label {
    font-size: 0.8em;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.official-info-value {
    font-weight: 700;
    color: var(--text);
}

.official-preview {
    background: #fff;
    border-radius: var(--radius-xl);
    padding: 24px;
    border: 1px solid var(--border);
    text-align: center;
}

.official-preview img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 3px solid var(--green-500);
    margin-bottom: 10px;
}

.official-preview .uname {
    font-size: 1.05em;
    font-weight: 700;
}

.official-preview .plat {
    font-size: 0.8em;
    color: var(--text-secondary);
    margin: 4px 0 16px;
}

.btn-follow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 28px;
    background: linear-gradient(135deg, var(--green-500), var(--green-600));
    color: #fff;
    border-radius: 28px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.9em;
    transition: all 0.25s;
    box-shadow: 0 4px 15px rgba(34,197,94,0.25);
}

.btn-follow:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(34,197,94,0.35); }

.fake-section {
    background: var(--red-50);
    border: 2px solid #fecaca;
    border-radius: var(--radius-2xl);
    padding: 28px;
}

.fake-alert {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fff;
    padding: 14px 18px;
    border-radius: var(--radius-lg);
    border: 2px solid #fecaca;
    margin-bottom: 20px;
}

.fake-alert-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, var(--red-500), var(--red-600));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3em;
    animation: pulse-red 2s infinite;
    flex-shrink: 0;
}

.fake-alert-text h3 { font-size: 1.1em; font-weight: 700; color: var(--red-700); }
.fake-alert-text p { font-size: 0.85em; color: var(--red-600); }

.fake-carousel { position: relative; overflow: hidden; border-radius: var(--radius-xl); }

.fake-carousel-track {
    display: flex;
    transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fake-slide { min-width: 100%; padding: 0 2px; }

.fake-card {
    background: #fff;
    border-radius: var(--radius-xl);
    border: 2px solid #fecaca;
    padding: 24px;
    position: relative;
}

.fake-card::after {
    content: 'FAKE';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 5em;
    font-weight: 900;
    color: rgba(239,68,68,0.03);
    pointer-events: none;
    letter-spacing: 15px;
}

.fake-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
}

.fake-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1em;
    font-weight: 700;
    color: var(--red-700);
}

.fake-card-badge {
    background: var(--red-500);
    color: #fff;
    padding: 3px 12px;
    border-radius: 16px;
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
}

.fake-card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

@media (max-width: 600px) { .fake-card-body { grid-template-columns: 1fr; } }

.fake-screenshot {
    position: relative;
    border-radius: var(--radius);
    overflow: hidden;
    border: 3px solid #fecaca;
}

.fake-screenshot img {
    width: 100%;
    display: block;
}

.fake-watermark {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    gap: 6px;
}

.fake-watermark span {
    background: rgba(239,68,68,0.85);
    color: #fff;
    padding: 5px 14px;
    border-radius: 14px;
    font-weight: 800;
    font-size: 0.8em;
    letter-spacing: 1.5px;
}

.fake-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.fake-detail-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--red-50);
    border-radius: 8px;
    font-size: 0.82em;
}

.fake-detail-label { color: var(--red-600); font-weight: 600; }
.fake-detail-value { color: var(--red-700); font-weight: 700; }

.fake-reason {
    background: #fff;
    border: 2px solid #fee2e2;
    border-radius: 10px;
    padding: 12px;
    margin-top: 6px;
    font-size: 0.82em;
    color: var(--red-700);
    line-height: 1.5;
}

.fake-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    flex-wrap: wrap;
}

.btn-report {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 10px 20px;
    background: linear-gradient(135deg, var(--red-500), var(--red-600));
    color: #fff;
    border-radius: 22px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.82em;
    transition: all 0.25s;
    flex: 1;
    justify-content: center;
    min-width: 120px;
}

.btn-report:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(239,68,68,0.3); }

.btn-copy {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 10px 20px;
    background: #fff;
    color: var(--red-600);
    border: 2px solid #fecaca;
    border-radius: 22px;
    font-weight: 700;
    font-size: 0.82em;
    cursor: pointer;
    transition: all 0.25s;
    flex: 1;
    justify-content: center;
    min-width: 120px;
}

.btn-copy:hover { background: var(--red-50); border-color: var(--red-500); }
.btn-copy.copied { background: var(--green-500) !important; color: #fff !important; border-color: var(--green-500) !important; }

.carousel-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
    margin-top: 16px;
}

.carousel-dots { display: flex; gap: 6px; }

.carousel-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #fecaca;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
}

.carousel-dot.active { background: var(--red-500); width: 24px; border-radius: 4px; }

.carousel-arrow {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1em;
    color: var(--text);
    transition: all 0.25s;
}

.carousel-arrow:hover { background: var(--red-500); color: #fff; border-color: var(--red-500); }

/* Android-style Music Player */
.android-music-player {
    background: #fff;
    border-radius: var(--radius-xl);
    border: 2px solid var(--border);
    overflow: hidden;
    box-shadow: var(--shadow);
}

.amp-now-playing {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
}

.amp-album-art {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.amp-album-art.playing {
    animation: spin 10s linear infinite;
}

.amp-album-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

.amp-track-info {
    flex: 1;
    min-width: 0;
}

.amp-track-title {
    font-size: 1.1em;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.amp-track-artist {
    font-size: 0.85em;
    opacity: 0.85;
    margin-top: 2px;
}

.amp-progress-container {
    padding: 16px 20px 0;
}

.amp-progress-bar {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    cursor: pointer;
    overflow: hidden;
}

.amp-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    border-radius: 3px;
    width: 0%;
    transition: width 0.1s linear;
}

.amp-time {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 0.75em;
    color: var(--text-muted);
}

.amp-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 12px 20px;
}

.amp-btn {
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.amp-btn:hover {
    background: #f1f5f9;
    color: #667eea;
}

.amp-play-btn {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    border-radius: 50%;
}

.amp-play-btn:hover {
    background: linear-gradient(135deg, #5a6fd6, #6a41a0);
    color: #fff;
    transform: scale(1.05);
}

.amp-volume {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 20px 12px;
    color: var(--text-muted);
}

.amp-volume-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #e2e8f0;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
}

.amp-volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #667eea;
    cursor: pointer;
}

.amp-playlist {
    max-height: 300px;
    overflow-y: auto;
    border-top: 1px solid var(--border);
}

.amp-playlist-header {
    padding: 12px 20px;
    background: #f8fafc;
    font-size: 0.85em;
    font-weight: 600;
    color: var(--text-secondary);
    position: sticky;
    top: 0;
    z-index: 1;
}

.amp-song-list {
    padding: 0;
}

.amp-song-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 1px solid #f8fafc;
}

.amp-song-item:hover {
    background: #f8fafc;
}

.amp-song-item.active {
    background: #eef2ff;
    border-left: 3px solid #667eea;
}

.amp-song-item.active .amp-song-title {
    color: #667eea;
}

.amp-song-number {
    font-size: 0.85em;
    color: var(--text-muted);
    font-weight: 600;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
}

.amp-song-details {
    flex: 1;
    min-width: 0;
}

.amp-song-title {
    font-weight: 600;
    font-size: 0.9em;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.amp-song-artist {
    font-size: 0.78em;
    color: var(--text-muted);
}

.amp-song-duration {
    font-size: 0.78em;
    color: var(--text-muted);
    flex-shrink: 0;
}

/* Gallery */
.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
}

.gallery-card {
    border-radius: var(--radius-xl);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s;
    background: #fff;
    box-shadow: var(--shadow);
}

.gallery-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }

.gallery-card-inner { position: relative; overflow: hidden; }

.gallery-image {
    width: 100%;
    display: block;
    transition: transform 0.4s;
}

.gallery-card:hover .gallery-image { transform: scale(1.04); }

.gallery-card-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.gallery-card:hover .gallery-card-overlay { opacity: 1; }

.gallery-caption {
    padding: 10px 14px;
    font-size: 0.82em;
    color: var(--text-secondary);
    text-align: center;
}

.lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.95);
    z-index: 10000;
    display: none;
    align-items: center;
    justify-content: center;
}

.lightbox.active { display: flex; }

.lightbox-close {
    position: absolute;
    top: 16px; right: 16px;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 10001;
}

.lightbox-image {
    max-width: 90vw;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 8px;
}

.lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.12);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 50%;
    width: 44px; height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s;
}

.lightbox-nav:hover { background: rgba(255,255,255,0.25); }
.lightbox-prev { left: 16px; }
.lightbox-next { right: 16px; }

.footer {
    text-align: center;
    padding: 36px 20px;
    color: var(--text-muted);
    font-size: 0.85em;
    border-top: 1px solid var(--border);
    margin-top: 36px;
    background: var(--bg-secondary);
}

@media (max-width: 768px) {
    .hero-name { font-size: 1.8em; }
    .hero-img { width: 100px; height: 100px; }
    .section-heading { font-size: 1.2em; }
    .official-card { padding: 22px; }
    .amp-album-art { width: 64px; height: 64px; }
    .lightbox-nav { width: 36px; height: 36px; }
    .lightbox-prev { left: 8px; }
    .lightbox-next { right: 8px; }
}
</style>
</head>
<body>

<div class="scroll-progress" id="scrollProgress"></div>

<nav class="navbar">
    <div class="container">
        <img src="${DATA.celebrity.photo}" alt="" class="navbar-logo-img" onerror="this.style.display='none'">
        <span class="navbar-logo-text">Verification Hub</span>
    </div>
</nav>

<header class="hero" data-animate>
    <div class="container">
        <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-img" onerror="this.style.display='none'">
        <h1 class="hero-name">${DATA.celebrity.fullName}</h1>
        <p class="hero-bio">${DATA.celebrity.bio}</p>
        <div class="hero-badges">
            <span class="badge badge-verified">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                VERIFIED OFFICIAL
            </span>
            <span class="badge badge-fun">✦ ENTERTAINMENT</span>
        </div>
        <div class="hero-social">
            <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="social-btn tiktok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                TikTok
            </a>
            <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="social-btn facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
            </a>
        </div>
    </div>
</header>

<main class="container">

<section class="section" data-animate>
    <div class="section-header">
        <div class="section-icon verified-icon-bg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        </div>
        <h2 class="section-heading">Official Verified Account</h2>
    </div>

    <div class="official-card">
        <div class="official-card-header">
            <div class="official-verify-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <div class="official-card-title">
                <h2>The Only Authentic Account</h2>
                <span>✓ Identity Verified</span>
            </div>
        </div>
        <div class="official-card-body">
            <div class="official-info-list">
                <div class="official-info-item">
                    <span class="official-info-label">Username</span>
                    <span class="official-info-value">@baiillamaach_official</span>
                </div>
                <div class="official-info-item">
                    <span class="official-info-label">Platforms</span>
                    <span class="official-info-value">TikTok • Facebook</span>
                </div>
                <div class="official-info-item">
                    <span class="official-info-label">Status</span>
                    <span class="official-info-value" style="color:var(--green-600)">● Active & Verified</span>
                </div>
                <div class="official-info-item">
                    <span class="official-info-label">Security</span>
                    <span class="official-info-value" style="color:var(--green-600)">Safe</span>
                </div>
            </div>
            <div class="official-preview">
                <img src="${DATA.celebrity.photo}" alt="" onerror="this.style.display='none'">
                <div class="uname">@baiillamaach_official</div>
                <div class="plat">TikTok • Facebook</div>
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-follow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                    Follow Official Account
                </a>
            </div>
        </div>
    </div>
</section>

<section class="fake-section" data-animate>
    <div class="section-header">
        <div class="section-icon danger-icon-bg">
            <span style="font-size:1.3em">⚠</span>
        </div>
        <h2 class="section-heading">Fake Accounts Detected</h2>
    </div>

    <div class="fake-alert">
        <div class="fake-alert-icon">🚨</div>
        <div class="fake-alert-text">
            <h3>${totalFake} Fake Account${totalFake > 1 ? 's' : ''} Found</h3>
            <p>These are NOT affiliated with Baiilla Maach. Report them immediately.</p>
        </div>
    </div>

    <div class="fake-carousel" id="fakeCarousel">
        <div class="fake-carousel-track" id="fakeCarouselTrack">
            ${DATA.fakeAccounts.map((a, i) => `
            <div class="fake-slide">
                <div class="fake-card">
                    <div class="fake-card-top">
                        <div class="fake-card-title">
                            <span>⚠️</span> Fake Account #${i+1}
                        </div>
                        <span class="fake-card-badge">Dangerous</span>
                    </div>
                    <div class="fake-card-body">
                        <div class="fake-screenshot">
                            ${a.screenshot ? `<img src="${a.screenshot}" alt="" loading="lazy">` : ''}
                            <div class="fake-watermark">
                                <span>⚠️ FAKE</span>
                                <span style="font-size:0.65em">DO NOT TRUST</span>
                            </div>
                        </div>
                        <div class="fake-details">
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Platform</span>
                                <span class="fake-detail-value">${a.platform}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Username</span>
                                <span class="fake-detail-value">${a.username}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Status</span>
                                <span class="fake-detail-value">Active Threat</span>
                            </div>
                            <div class="fake-reason">
                                <span>⚠️ ${a.reason}</span>
                            </div>
                        </div>
                    </div>
                    <div class="fake-actions">
                        <a href="${a.profileUrl}" target="_blank" rel="noopener" class="btn-report">🚨 Report</a>
                        <button class="btn-copy copy-btn" data-username="${a.username}">📋 Copy Username</button>
                    </div>
                </div>
            </div>`).join('')}
        </div>
    </div>

    <div class="carousel-nav">
        <button class="carousel-arrow" onclick="moveCarousel(-1)">◀</button>
        <div class="carousel-dots" id="carouselDots">
            ${DATA.fakeAccounts.map((_, i) => `<button class="carousel-dot${i===0?' active':''}" onclick="goToSlide(${i})"></button>`).join('')}
        </div>
        <button class="carousel-arrow" onclick="moveCarousel(1)">▶</button>
    </div>
</section>

${coverSongsHTML}

${galleryHTML}

</main>

<footer class="footer">
    <p>© ${DATA.celebrity.fullName} • Official Verification Hub</p>
</footer>

<audio id="audioPlayer" preload="auto"></audio>

<script>
// Intersection Observer
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('animated');
    });
}, { threshold: 0.1 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// Scroll progress
window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    document.getElementById('scrollProgress').style.width = pct + '%';
});

// Fake Accounts Carousel
let currentSlide = 0;
const totalSlides = ${totalFake};
const track = document.getElementById('fakeCarouselTrack');
const dots = document.querySelectorAll('.carousel-dot');
let autoSlide;

function updateCarousel() {
    track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

function moveCarousel(dir) {
    currentSlide = (currentSlide + dir + totalSlides) % totalSlides;
    updateCarousel();
    clearInterval(autoSlide);
    autoSlide = setInterval(() => moveCarousel(1), 5000);
}

function goToSlide(i) {
    currentSlide = i;
    updateCarousel();
    clearInterval(autoSlide);
    autoSlide = setInterval(() => moveCarousel(1), 5000);
}

autoSlide = setInterval(() => moveCarousel(1), 5000);

// Touch swipe
const carouselEl = document.getElementById('fakeCarousel');
let touchX = 0;
carouselEl.addEventListener('touchstart', e => { touchX = e.changedTouches[0].screenX; });
carouselEl.addEventListener('touchend', e => {
    const diff = touchX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 40) moveCarousel(diff > 0 ? 1 : -1);
});

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.username).then(() => {
            this.innerHTML = '✓ Copied!';
            this.classList.add('copied');
            setTimeout(() => { this.innerHTML = '📋 Copy Username'; this.classList.remove('copied'); }, 2000);
        });
    });
});

// ==========================================
// ANDROID-STYLE MUSIC PLAYER
// ==========================================
const audioPlayer = document.getElementById('audioPlayer');
const songItems = document.querySelectorAll('.amp-song-item');
let currentTrackIndex = -1;
let isPlaying = false;
let playlist = [];

// Build playlist from DOM
songItems.forEach((item, index) => {
    playlist.push({
        index: index,
        url: item.getAttribute('data-audio'),
        title: item.querySelector('.amp-song-title').textContent,
        artist: item.querySelector('.amp-song-artist').textContent,
        element: item
    });
});

function playSong(index) {
    if (index === currentTrackIndex) {
        togglePlay();
        return;
    }
    
    currentTrackIndex = index;
    const song = playlist[index];
    
    audioPlayer.src = song.url;
    audioPlayer.load();
    
    // Update UI
    document.getElementById('currentTitle').textContent = song.title;
    document.getElementById('currentArtist').textContent = song.artist;
    
    // Update album art
    const albumArt = document.getElementById('albumArt');
    albumArt.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40" fill="#fff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
    
    // Highlight active song
    songItems.forEach(item => item.classList.remove('active'));
    song.element.classList.add('active');
    
    // Reset progress
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('totalTime').textContent = '0:00';
    
    // Play
    audioPlayer.play().then(() => {
        isPlaying = true;
        updatePlayButton();
        albumArt.classList.add('playing');
    }).catch(err => {
        console.error('Playback error:', err);
        alert('Cannot play this file. Make sure the audio file exists in assets/covermusic/');
    });
}

function togglePlay() {
    if (currentTrackIndex === -1 && playlist.length > 0) {
        playSong(0);
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        document.getElementById('albumArt').classList.remove('playing');
    } else {
        audioPlayer.play().then(() => {
            isPlaying = true;
            document.getElementById('albumArt').classList.add('playing');
        }).catch(err => {
            console.error('Play error:', err);
        });
    }
    updatePlayButton();
}

function updatePlayButton() {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function nextTrack() {
    if (playlist.length === 0) return;
    const next = (currentTrackIndex + 1) % playlist.length;
    playSong(next);
}

function previousTrack() {
    if (playlist.length === 0) return;
    const prev = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1;
    playSong(prev);
}

function seekAudio(event) {
    if (!audioPlayer.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const seekPos = (event.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = seekPos * audioPlayer.duration;
}

function setVolume(value) {
    audioPlayer.volume = value / 100;
}

// Format time
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + String(secs).padStart(2, '0');
}

// Audio events
audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('currentTime').textContent = formatTime(audioPlayer.currentTime);
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    document.getElementById('totalTime').textContent = formatTime(audioPlayer.duration);
    // Update duration in playlist
    const durationEl = document.getElementById('duration-' + currentTrackIndex);
    if (durationEl) {
        durationEl.textContent = formatTime(audioPlayer.duration);
    }
});

audioPlayer.addEventListener('ended', () => {
    nextTrack();
});

audioPlayer.addEventListener('error', (e) => {
    console.error('Audio error:', e);
    isPlaying = false;
    updatePlayButton();
    document.getElementById('albumArt').classList.remove('playing');
    alert('Error loading audio file. Check if the file exists.');
});

// Set initial volume
audioPlayer.volume = 0.8;

// Also update all durations when songs load
playlist.forEach((song, index) => {
    const tempAudio = new Audio();
    tempAudio.addEventListener('loadedmetadata', () => {
        const durationEl = document.getElementById('duration-' + index);
        if (durationEl) {
            durationEl.textContent = formatTime(tempAudio.duration);
        }
    });
    tempAudio.src = song.url;
});

// Gallery lightbox
let galleryIdx = 0;
const galleryImgs = document.querySelectorAll('.gallery-image');
const lightbox = document.getElementById('galleryLightbox');
const lightboxImg = document.getElementById('lightboxImage');

function openGalleryLightbox(i) {
    if (!galleryImgs.length) return;
    galleryIdx = i;
    lightboxImg.src = galleryImgs[i].src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeGalleryLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateGallery(dir) {
    if (!galleryImgs.length) return;
    galleryIdx = (galleryIdx + dir + galleryImgs.length) % galleryImgs.length;
    lightboxImg.src = galleryImgs[galleryIdx].src;
}

lightbox.addEventListener('click', e => { if (e.target === lightbox) closeGalleryLightbox(); });

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeGalleryLightbox();
    if (e.key === 'ArrowLeft' && lightbox.classList.contains('active')) navigateGallery(-1);
    if (e.key === 'ArrowRight' && lightbox.classList.contains('active')) navigateGallery(1);
});
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.08)}h2{text-align:center;color:#ff0050;margin-bottom:30px}.fg{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#475569;font-weight:600;font-size:.9em}input{width:100%;padding:12px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:1em;outline:none}input:focus{border-color:#ff0050}.btn{width:100%;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer}.btn:hover{background:#d90040}.error{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center}.back{text-align:center;margin-top:20px}a{color:#64748b;text-decoration:none}a:hover{color:#ff0050}</style></head><body><div class="box"><h2>Admin Login</h2>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="fg"><label>Username</label><input type="text" name="username" required></div><div class="fg"><label>Password</label><input type="password" name="password" required></div><button type="submit" class="btn">Login</button></form><div class="back"><a href="/">Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="pc"><img src="${p.path}" class="pi"><div class="info">${p.caption?`<p>${p.caption}</p>`:''}<p class="dt">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="del" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;color:#0f172a}.hdr{background:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:10px}.hdr h2{color:#ff0050}.hdr a{color:#64748b;text-decoration:none;padding:8px 16px;border:2px solid #e2e8f0;border-radius:8px;margin-left:10px;font-weight:600}.hdr a:hover{background:#ff0050;color:#fff;border-color:#ff0050}.cnt{max-width:1100px;margin:0 auto;padding:30px 20px}.up{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:30px;margin-bottom:30px}.up h3{color:#ff0050;margin-bottom:20px}.fg{margin-bottom:15px}label{display:block;margin-bottom:6px;color:#475569;font-weight:600}input,textarea{width:100%;padding:10px 14px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:8px;font-size:.95em;outline:none}input:focus,textarea:focus{border-color:#ff0050}.bu{background:#22c55e;color:#fff;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer}.bu:hover{background:#16a34a}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}.pc{background:#fff;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden}.pc:hover{border-color:#ff0050}.pi{width:100%;height:200px;object-fit:cover}.info{padding:12px}.dt{font-size:.75em;color:#94a3b8;margin-top:2px}.del{background:#fef2f2;color:#dc2626;border:2px solid #fecaca;padding:6px 12px;border-radius:6px;cursor:pointer;margin:0 12px 12px;width:calc(100% - 24px);font-weight:600}.del:hover{background:#ef4444;color:#fff}.msg{background:#f0fdf4;border:2px solid #bbf7d0;color:#166534;padding:12px;border-radius:8px;margin-bottom:20px}.err{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px}</style></head><body><div class="hdr"><h2>Admin Panel</h2><div><a href="/">Home</a><a href="/admin/logout">Logout</a></div></div><div class="cnt">${msg?`<div class="msg">${msg}</div>`:''}${err?`<div class="err">${err}</div>`:''}<div class="up"><h3>Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="fg"><label>Select Photo</label><input type="file" name="photo" accept="image/*" required></div><div class="fg"><label>Caption</label><input type="text" name="caption"></div><button type="submit" class="bu">Upload</button></form></div><h3 style="margin-bottom:20px">Gallery (${photos.length})</h3>${photos.length?`<div class="grid">${phtml}</div>`:'<p style="color:#94a3b8;text-align:center;padding:40px">No photos</p>'}</div></body></html>`;
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
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac','.wma':'audio/x-ms-wma','.opus':'audio/opus','.weba':'audio/webm' };
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
                const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Uploaded!'));
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
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:100px;color:#ff0050}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>`);
});

async function start() {
    await connectDB();
    server.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
}

start();
server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });

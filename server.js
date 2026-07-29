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

const VOICE_FILES = {
    fakeAlert1: "/assets/10ff7135b502e2f5660074fdb0969109.mp3",
    fakeAlert2: "/assets/077f07c5d2a052c7081e448e6dfdaff6_1.mp3"
};

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus', '.weba'];
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
        joinedDate: "2024",
        followers: "500K+",
        verificationId: "VF-2024-001",
        trustScore: 100
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            screenshot: IMAGES.official,
            followers: "500K+",
            verified: true,
            status: "Active",
            trustScore: 100,
            reportStatus: "Clean",
            riskLevel: "None",
            owner: "Official"
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            screenshot: null,
            followers: "Growing",
            verified: true,
            status: "Active",
            trustScore: 100,
            reportStatus: "Clean",
            riskLevel: "None",
            owner: "Official"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            reason: "Copies official logo and content to deceive followers. Impersonating verified creator.",
            riskScore: 95,
            detectionDate: "2024",
            status: "Active Threat",
            reportStatus: "Multiple Reports",
            riskLevel: "Critical",
            owner: "Impersonator",
            voiceFile: VOICE_FILES.fakeAlert1
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            reason: "Uses official name and profile photo to mislead followers. Fraudulent account.",
            riskScore: 89,
            detectionDate: "2024",
            status: "Active Threat",
            reportStatus: "Under Review",
            riskLevel: "High",
            owner: "Impersonator",
            voiceFile: VOICE_FILES.fakeAlert2
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

    let coverSongsHTML = '';
    if (coverSongs.length > 0) {
        coverSongsHTML = `
        <section class="section music-section" data-animate>
            <div class="section-header">
                <div class="section-icon" style="background:linear-gradient(135deg,#1db954,#169c46)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
                <h2 class="section-heading">Cover Music</h2>
            </div>
            <div class="spotify-player">
                <div class="spotify-now-playing">
                    <div class="spotify-album-art" id="nowPlayingCover">
                        <div class="spotify-default-art">
                            <svg viewBox="0 0 24 24" width="64" height="64"><path fill="white" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                    </div>
                    <div class="spotify-track-info">
                        <div class="spotify-track-name" id="nowPlayingTitle">Select a song</div>
                        <div class="spotify-track-artist" id="nowPlayingArtist">Cover Songs Collection</div>
                        <div class="spotify-progress">
                            <div class="spotify-progress-bar" id="progressBar">
                                <div class="spotify-progress-fill" id="progressFill"></div>
                                <div class="spotify-progress-thumb" id="progressThumb"></div>
                            </div>
                            <div class="spotify-time">
                                <span id="currentTime">0:00</span>
                                <span id="totalTime">0:00</span>
                            </div>
                        </div>
                        <div class="spotify-controls">
                            <button class="spotify-btn" onclick="prevSong()" aria-label="Previous">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                            </button>
                            <button class="spotify-btn spotify-play-btn" id="playPauseBtn" onclick="togglePlay()" aria-label="Play">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <path id="playIcon" d="M8 5v14l11-7z"/>
                                    <path id="pauseIcon" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" style="display:none"/>
                                </svg>
                            </button>
                            <button class="spotify-btn" onclick="nextSong()" aria-label="Next">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                            </button>
                        </div>
                        <div class="spotify-volume">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                            <input type="range" class="spotify-volume-slider" id="volumeSlider" min="0" max="100" value="70" onchange="setVol(this.value)" aria-label="Volume">
                        </div>
                    </div>
                </div>
                <div class="spotify-playlist-container">
                    <div class="spotify-playlist-header">
                        <h3>Playlist</h3>
                        <span class="spotify-song-count">${coverSongs.length} songs</span>
                    </div>
                    <div class="spotify-playlist" id="playlist">
                        ${coverSongs.map((s, i) => `
                        <div class="spotify-playlist-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl || ''}" onclick="playSong(${i})">
                            <div class="spotify-track-number">${(i+1).toString().padStart(2,'0')}</div>
                            <div class="spotify-track-cover-small">${s.coverUrl ? `<img src="${s.coverUrl}" alt="" loading="lazy">` : '<div class="spotify-default-art-small"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="white" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>'}</div>
                            <div class="spotify-track-details">
                                <div class="spotify-track-title">${s.title}</div>
                                <div class="spotify-track-artist-small">${s.artist}</div>
                            </div>
                            <div class="spotify-equalizer">
                                <span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>
                            </div>
                        </div>`).join('')}
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
                <div class="section-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                </div>
                <h2 class="section-heading">Official Gallery</h2>
            </div>
            <div class="gallery-masonry" id="galleryMasonry">
                ${galleryPhotos.map((p, i) => `
                <div class="gallery-card" data-index="${i}">
                    <div class="gallery-card-inner">
                        <img src="${p.path}" alt="${p.caption || 'Gallery image'}" class="gallery-image" loading="lazy" onclick="openGalleryLightbox(${i})">
                        <div class="gallery-card-overlay">
                            <button class="gallery-zoom-btn" onclick="openGalleryLightbox(${i})" aria-label="View full size">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                            </button>
                        </div>
                    </div>
                    ${p.caption ? `<p class="gallery-caption">${p.caption}</p>` : ''}
                </div>`).join('')}
            </div>
        </section>
        <div class="lightbox-overlay" id="galleryLightbox">
            <button class="lightbox-close" onclick="closeGalleryLightbox()">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
            <button class="lightbox-nav lightbox-prev" onclick="navigateGallery(-1)">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <img class="lightbox-image" id="lightboxImage" src="" alt="">
            <button class="lightbox-nav lightbox-next" onclick="navigateGallery(1)">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
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
    --bg-tertiary: #f1f5f9;
    --text: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --border: #e2e8f0;
    --border-light: #f1f5f9;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
    --shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04);
    --shadow-2xl: 0 25px 50px rgba(0,0,0,0.12);
    --green-50: #f0fdf4;
    --green-100: #dcfce7;
    --green-200: #bbf7d0;
    --green-500: #22c55e;
    --green-600: #16a34a;
    --green-700: #15803d;
    --red-50: #fef2f2;
    --red-100: #fee2e2;
    --red-200: #fecaca;
    --red-500: #ef4444;
    --red-600: #dc2626;
    --red-700: #b91c1c;
    --amber-50: #fffbeb;
    --amber-100: #fef3c7;
    --amber-500: #f59e0b;
    --amber-600: #d97706;
    --blue-50: #eff6ff;
    --blue-100: #dbeafe;
    --blue-500: #3b82f6;
    --blue-600: #2563eb;
    --blue-700: #1d4ed8;
    --tiktok-pink: #ff0050;
    --tiktok-cyan: #00f2ea;
    --tiktok-black: #000000;
    --fb-blue: #1877f2;
    --spotify-green: #1db954;
    --spotify-black: #191414;
    --gradient-verified: linear-gradient(135deg, #22c55e, #16a34a);
    --gradient-danger: linear-gradient(135deg, #ef4444, #dc2626);
    --gradient-official: linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #dcfce7 100%);
    --gradient-fake: linear-gradient(135deg, #fef2f2 0%, #ffffff 50%, #fee2e2 100%);
    --radius-sm: 8px;
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-2xl: 24px;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    overflow-x: hidden;
    min-height: 100vh;
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

@keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    50% { box-shadow: 0 0 0 20px rgba(34,197,94,0); }
}

@keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    50% { box-shadow: 0 0 0 20px rgba(239,68,68,0); }
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
}

@keyframes equalizer {
    0%, 100% { height: 4px; }
    50% { height: 16px; }
}

@keyframes dangerPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
}

@keyframes verifiedSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

[data-animate] { opacity: 0; }
[data-animate].animated { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

.scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--tiktok-pink), var(--tiktok-cyan), var(--green-500));
    z-index: 10001;
    transition: width 0.1s linear;
}

.navbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 16px 0;
}

.navbar .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.navbar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 1.1em;
    color: var(--text);
    text-decoration: none;
}

.navbar-logo img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--tiktok-pink);
}

.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

.hero-section {
    padding: 60px 0 40px;
    text-align: center;
    position: relative;
    overflow: hidden;
}

.hero-section::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(ellipse at center, rgba(255,0,80,0.03) 0%, transparent 70%);
    pointer-events: none;
}

.hero-profile {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    border: 4px solid var(--tiktok-pink);
    object-fit: cover;
    box-shadow: 0 0 0 8px rgba(255,0,80,0.1), 0 8px 32px rgba(0,0,0,0.12);
    margin-bottom: 24px;
}

.hero-name {
    font-size: 2.8em;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--text);
    margin-bottom: 4px;
}

.hero-bio {
    font-size: 1.1em;
    color: var(--text-secondary);
    margin-bottom: 20px;
}

.hero-badges {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 24px;
}

.badge {
    padding: 8px 20px;
    border-radius: 25px;
    font-size: 0.85em;
    font-weight: 600;
    letter-spacing: 0.3px;
}

.badge-verified {
    background: var(--gradient-verified);
    color: white;
    animation: pulse-green 2.5s infinite;
    display: flex;
    align-items: center;
    gap: 6px;
}

.badge-entertainment {
    background: linear-gradient(135deg, var(--tiktok-pink), #ff6b00);
    color: white;
}

.hero-social {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}

.social-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 28px;
    border-radius: 30px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9em;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
}

.social-btn.tiktok {
    background: var(--tiktok-black);
    color: white;
}

.social-btn.tiktok:hover {
    background: white;
    color: var(--tiktok-black);
    border-color: var(--tiktok-black);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.social-btn.facebook {
    background: var(--fb-blue);
    color: white;
}

.social-btn.facebook:hover {
    background: white;
    color: var(--fb-blue);
    border-color: var(--fb-blue);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.section { padding: 40px 0; }

.section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
}

.section-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.section-heading {
    font-size: 1.5em;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.3px;
}

/* OFFICIAL ACCOUNT CARD */
.official-account-card {
    background: var(--gradient-official);
    border: 2px solid var(--green-200);
    border-radius: var(--radius-2xl);
    padding: 40px;
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-xl), 0 0 0 1px rgba(34,197,94,0.1);
    margin-bottom: 20px;
}

.official-account-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--gradient-verified);
}

.official-glow {
    position: absolute;
    top: -50px;
    right: -50px;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%);
    pointer-events: none;
}

.official-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}

.official-verified-icon {
    width: 48px;
    height: 48px;
    background: var(--gradient-verified);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    animation: pulse-green 2.5s infinite;
}

.official-title-group h2 {
    font-size: 1.5em;
    font-weight: 700;
    color: var(--green-700);
}

.official-title-group span {
    font-size: 0.9em;
    color: var(--green-600);
    font-weight: 600;
}

.official-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    align-items: start;
}

@media (max-width: 768px) {
    .official-content { grid-template-columns: 1fr; }
}

.official-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.official-info-item {
    background: white;
    border-radius: var(--radius);
    padding: 14px 16px;
    border: 1px solid var(--green-100);
}

.official-info-label {
    font-size: 0.75em;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
}

.official-info-value {
    font-size: 1em;
    font-weight: 700;
    color: var(--text);
    margin-top: 2px;
}

.official-account-preview {
    background: white;
    border-radius: var(--radius-xl);
    padding: 24px;
    border: 1px solid var(--border);
    text-align: center;
}

.official-account-preview img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3px solid var(--green-500);
    margin-bottom: 12px;
}

.official-account-preview .username {
    font-size: 1.1em;
    font-weight: 700;
    color: var(--text);
}

.official-account-preview .platform {
    font-size: 0.8em;
    color: var(--text-secondary);
    margin: 4px 0 16px;
}

.official-follow-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    background: var(--gradient-verified);
    color: white;
    border-radius: 30px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95em;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(34,197,94,0.3);
}

.official-follow-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(34,197,94,0.4);
}

/* FAKE ACCOUNTS SECTION */
.fake-accounts-section {
    background: var(--red-50);
    border: 2px solid var(--red-200);
    border-radius: var(--radius-2xl);
    padding: 36px;
    position: relative;
    overflow: hidden;
}

.fake-accounts-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--gradient-danger);
}

.fake-alert-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 24px;
    background: white;
    padding: 16px 20px;
    border-radius: var(--radius-lg);
    border: 2px solid var(--red-200);
}

.fake-alert-icon {
    width: 48px;
    height: 48px;
    background: var(--gradient-danger);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5em;
    animation: pulse-red 2s infinite;
    flex-shrink: 0;
}

.fake-alert-text h3 {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--red-700);
}

.fake-alert-text p {
    font-size: 0.9em;
    color: var(--red-600);
}

.fake-carousel-wrapper {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-xl);
}

.fake-carousel-track {
    display: flex;
    transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fake-carousel-slide {
    min-width: 100%;
    padding: 0 4px;
}

.fake-account-card {
    background: white;
    border-radius: var(--radius-xl);
    border: 2px solid var(--red-200);
    padding: 28px;
    position: relative;
    overflow: hidden;
}

.fake-account-card::after {
    content: 'FAKE';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 6em;
    font-weight: 900;
    color: rgba(239,68,68,0.04);
    pointer-events: none;
    letter-spacing: 20px;
}

.fake-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
}

.fake-card-title {
    display: flex;
    align-items: center;
    gap: 10px;
}

.fake-card-title .fake-icon {
    font-size: 1.8em;
}

.fake-card-title h3 {
    font-size: 1.1em;
    font-weight: 700;
    color: var(--red-700);
}

.fake-risk-badge {
    background: var(--red-500);
    color: white;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
}

.fake-card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

@media (max-width: 600px) {
    .fake-card-body { grid-template-columns: 1fr; }
}

.fake-card-screenshot {
    position: relative;
    border-radius: var(--radius);
    overflow: hidden;
    border: 3px solid var(--red-200);
}

.fake-card-screenshot img {
    width: 100%;
    height: auto;
    display: block;
    filter: brightness(0.9);
}

.fake-watermark {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    gap: 8px;
}

.fake-watermark-text {
    background: rgba(239,68,68,0.9);
    color: white;
    padding: 8px 20px;
    border-radius: 20px;
    font-weight: 800;
    font-size: 0.9em;
    letter-spacing: 2px;
    animation: dangerPulse 1.5s infinite;
}

.fake-card-details {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.fake-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--red-50);
    border-radius: var(--radius-sm);
    font-size: 0.85em;
}

.fake-detail-label {
    color: var(--red-600);
    font-weight: 600;
}

.fake-detail-value {
    color: var(--red-700);
    font-weight: 700;
}

.fake-reason {
    background: white;
    border: 2px solid var(--red-100);
    border-radius: var(--radius);
    padding: 14px;
    margin-top: 8px;
    font-size: 0.85em;
    color: var(--red-700);
    line-height: 1.6;
    display: flex;
    gap: 8px;
    align-items: flex-start;
}

.fake-card-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    flex-wrap: wrap;
}

.btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 24px;
    background: var(--gradient-danger);
    color: white;
    border-radius: 25px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.85em;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    flex: 1;
    justify-content: center;
    min-width: 140px;
}

.btn-danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(239,68,68,0.3);
}

.btn-outline-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 24px;
    background: white;
    color: var(--red-600);
    border: 2px solid var(--red-200);
    border-radius: 25px;
    font-weight: 700;
    font-size: 0.85em;
    cursor: pointer;
    transition: all 0.3s;
    flex: 1;
    justify-content: center;
    min-width: 140px;
}

.btn-outline-danger:hover {
    background: var(--red-50);
    border-color: var(--red-500);
}

.btn-outline-danger.copied {
    background: var(--green-500) !important;
    color: white !important;
    border-color: var(--green-500) !important;
}

.carousel-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
}

.carousel-dots {
    display: flex;
    gap: 8px;
}

.carousel-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--red-200);
    border: none;
    cursor: pointer;
    transition: all 0.3s;
}

.carousel-dot.active {
    background: var(--red-500);
    width: 28px;
    border-radius: 5px;
}

.carousel-arrow {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: white;
    border: 2px solid var(--border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1em;
    color: var(--text);
    transition: all 0.3s;
}

.carousel-arrow:hover {
    background: var(--red-500);
    color: white;
    border-color: var(--red-500);
}

/* COMPARISON TABLE */
.comparison-table-wrapper {
    overflow-x: auto;
    border-radius: var(--radius-xl);
    border: 1px solid var(--border);
    background: white;
    box-shadow: var(--shadow-md);
}

.comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
}

.comparison-table th {
    background: var(--bg-tertiary);
    padding: 16px;
    text-align: left;
    font-weight: 700;
    color: var(--text);
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
}

.comparison-table th:first-child {
    border-radius: var(--radius-xl) 0 0 0;
}

.comparison-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-light);
    vertical-align: middle;
}

.comparison-table .official-col {
    background: var(--green-50);
    border-left: 3px solid var(--green-500);
}

.comparison-table .fake-col {
    background: var(--red-50);
    border-left: 3px solid var(--red-500);
}

.comparison-table .check-icon { color: var(--green-500); font-weight: 700; }
.comparison-table .cross-icon { color: var(--red-500); font-weight: 700; }

/* WARNING SECTION */
.warning-section {
    background: var(--amber-50);
    border: 2px solid var(--amber-100);
    border-radius: var(--radius-2xl);
    padding: 36px;
    margin: 40px 0;
}

.warning-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.warning-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 24px;
    border: 1px solid var(--amber-100);
    transition: all 0.3s;
}

.warning-card:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
}

.warning-card-icon {
    font-size: 2em;
    margin-bottom: 12px;
}

.warning-card h4 {
    font-size: 1em;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
}

.warning-card p {
    font-size: 0.85em;
    color: var(--text-secondary);
    line-height: 1.6;
}

/* UPDATES SECTION */
.updates-section {
    background: var(--blue-50);
    border: 2px solid var(--blue-100);
    border-radius: var(--radius-2xl);
    padding: 32px;
    text-align: center;
    margin: 40px 0;
}

.updates-section h3 {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--blue-700);
    margin-bottom: 8px;
}

.updates-section p {
    color: var(--blue-600);
    font-size: 0.9em;
    margin-bottom: 16px;
}

.update-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
}

.update-tag {
    background: white;
    color: var(--blue-700);
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
    border: 1px solid var(--blue-100);
}

/* SPOTIFY PLAYER */
.spotify-player {
    background: var(--spotify-black);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-2xl);
}

.spotify-now-playing {
    display: flex;
    gap: 24px;
    padding: 28px;
    background: linear-gradient(135deg, #282828, #191414);
    border-bottom: 1px solid rgba(255,255,255,0.08);
}

@media (max-width: 768px) {
    .spotify-now-playing { flex-direction: column; align-items: center; text-align: center; }
}

.spotify-album-art {
    width: 180px;
    height: 180px;
    border-radius: var(--radius);
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.spotify-album-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.spotify-default-art {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--spotify-green), #169c46);
}

.spotify-track-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 200px;
}

.spotify-track-name {
    font-size: 1.6em;
    font-weight: 700;
    color: white;
    margin-bottom: 4px;
}

.spotify-track-artist {
    font-size: 0.95em;
    color: #b3b3b3;
    margin-bottom: 20px;
}

.spotify-progress {
    margin-bottom: 16px;
}

.spotify-progress-bar {
    width: 100%;
    height: 5px;
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    margin-bottom: 6px;
}

.spotify-progress-fill {
    height: 100%;
    background: var(--spotify-green);
    border-radius: 3px;
    width: 0%;
    transition: width 0.1s linear;
}

.spotify-progress-thumb {
    position: absolute;
    right: -6px;
    top: -3px;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s;
}

.spotify-progress-bar:hover .spotify-progress-thumb { opacity: 1; }

.spotify-time {
    display: flex;
    justify-content: space-between;
    font-size: 0.7em;
    color: #b3b3b3;
}

.spotify-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
}

.spotify-btn {
    background: none;
    border: none;
    color: #b3b3b3;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spotify-btn:hover { color: white; transform: scale(1.1); }

.spotify-play-btn {
    background: white;
    color: var(--spotify-black);
    width: 48px;
    height: 48px;
    border-radius: 50%;
}

.spotify-play-btn:hover { transform: scale(1.08); background: #f0f0f0; color: var(--spotify-black); }

.spotify-volume {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #b3b3b3;
}

.spotify-volume-slider {
    width: 100px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
}

.spotify-volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
}

.spotify-playlist-container {
    max-height: 420px;
    overflow-y: auto;
}

.spotify-playlist-header {
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background: var(--spotify-black);
    z-index: 1;
}

.spotify-playlist-header h3 {
    font-size: 1em;
    font-weight: 700;
    color: white;
}

.spotify-song-count {
    font-size: 0.8em;
    color: #b3b3b3;
}

.spotify-playlist-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 24px;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 1px solid rgba(255,255,255,0.04);
}

.spotify-playlist-item:hover {
    background: rgba(255,255,255,0.06);
}

.spotify-playlist-item.active {
    background: rgba(29,185,84,0.12);
}

.spotify-track-number {
    font-size: 0.85em;
    color: #b3b3b3;
    width: 28px;
    text-align: center;
    font-weight: 600;
}

.spotify-track-cover-small {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    background: #282828;
}

.spotify-track-cover-small img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.spotify-default-art-small {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--spotify-green), #169c46);
}

.spotify-track-details {
    flex: 1;
    min-width: 0;
}

.spotify-track-title {
    font-weight: 600;
    font-size: 0.88em;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.spotify-track-artist-small {
    font-size: 0.75em;
    color: #b3b3b3;
}

.spotify-equalizer {
    display: none;
    gap: 2px;
    align-items: flex-end;
    height: 18px;
}

.spotify-playlist-item.active .spotify-equalizer {
    display: flex;
}

.eq-bar {
    width: 3px;
    background: var(--spotify-green);
    border-radius: 1px;
    animation: equalizer 0.8s infinite;
}

.eq-bar:nth-child(1) { animation-delay: 0s; }
.eq-bar:nth-child(2) { animation-delay: 0.2s; }
.eq-bar:nth-child(3) { animation-delay: 0.4s; }
.eq-bar:nth-child(4) { animation-delay: 0.6s; }

/* GALLERY */
.gallery-masonry {
    column-count: 3;
    column-gap: 20px;
}

@media (max-width: 900px) { .gallery-masonry { column-count: 2; } }
@media (max-width: 500px) { .gallery-masonry { column-count: 1; } }

.gallery-card {
    break-inside: avoid;
    margin-bottom: 20px;
    border-radius: var(--radius-xl);
    overflow: hidden;
    transition: all 0.3s;
    background: white;
    box-shadow: var(--shadow);
}

.gallery-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-xl);
}

.gallery-card-inner {
    position: relative;
    overflow: hidden;
}

.gallery-image {
    width: 100%;
    display: block;
    cursor: pointer;
    transition: transform 0.5s;
}

.gallery-card:hover .gallery-image {
    transform: scale(1.03);
}

.gallery-card-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.gallery-card:hover .gallery-card-overlay {
    opacity: 1;
}

.gallery-zoom-btn {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
}

.gallery-zoom-btn:hover {
    background: rgba(255,255,255,0.3);
    transform: scale(1.1);
}

.gallery-caption {
    padding: 12px 16px;
    font-size: 0.85em;
    color: var(--text-secondary);
    text-align: center;
}

/* LIGHTBOX */
.lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.95);
    z-index: 10000;
    display: none;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

.lightbox-overlay.active { display: flex; }

.lightbox-close {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 10001;
    padding: 8px;
}

.lightbox-image {
    max-width: 90vw;
    max-height: 85vh;
    object-fit: contain;
    border-radius: var(--radius);
}

.lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 50%;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s;
    color: white;
}

.lightbox-nav:hover { background: rgba(255,255,255,0.3); }

.lightbox-prev { left: 20px; }
.lightbox-next { right: 20px; }

/* FOOTER */
.footer {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 0.9em;
    border-top: 1px solid var(--border);
    margin-top: 40px;
    background: var(--bg-secondary);
}

/* RESPONSIVE */
@media (max-width: 768px) {
    .hero-name { font-size: 2em; }
    .hero-profile { width: 110px; height: 110px; }
    .section-heading { font-size: 1.25em; }
    .official-account-card { padding: 24px; }
    .official-info-grid { grid-template-columns: 1fr; }
    .fake-accounts-section { padding: 20px; }
    .fake-card-body { grid-template-columns: 1fr; }
    .comparison-table { font-size: 0.8em; }
    .lightbox-nav { width: 40px; height: 40px; }
    .lightbox-prev { left: 10px; }
    .lightbox-next { right: 10px; }
}

@media (max-width: 480px) {
    .hero-name { font-size: 1.6em; }
    .hero-profile { width: 90px; height: 90px; }
    .hero-section { padding: 40px 0 30px; }
    .social-btn { padding: 10px 20px; font-size: 0.8em; }
    .spotify-album-art { width: 140px; height: 140px; }
}
</style>
</head>
<body>

<div class="scroll-progress" id="scrollProgress"></div>

<nav class="navbar">
    <div class="container">
        <a href="/" class="navbar-logo">
            <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" onerror="this.style.display='none'">
            <span>Verification Hub</span>
        </a>
    </div>
</nav>

<header class="hero-section" data-animate>
    <div class="container">
        <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-profile" onerror="this.style.display='none'">
        <h1 class="hero-name">${DATA.celebrity.fullName}</h1>
        <p class="hero-bio">${DATA.celebrity.bio}</p>
        <div class="hero-badges">
            <span class="badge badge-verified">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                VERIFIED OFFICIAL
            </span>
            <span class="badge badge-entertainment">✦ ENTERTAINMENT</span>
        </div>
        <div class="hero-social">
            <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener noreferrer" class="social-btn tiktok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                TikTok
            </a>
            <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener noreferrer" class="social-btn facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
            </a>
        </div>
    </div>
</header>

<main class="container">

<section class="section" data-animate>
    <div class="section-header">
        <div class="section-icon" style="background:var(--gradient-verified)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        </div>
        <h2 class="section-heading">Official Verified Account</h2>
    </div>

    <div class="official-account-card">
        <div class="official-glow"></div>
        <div class="official-header">
            <div class="official-verified-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <div class="official-title-group">
                <h2>The Only Authentic Account</h2>
                <span>✓ Identity Verified • Trust Score: ${DATA.celebrity.trustScore}%</span>
            </div>
        </div>
        <div class="official-content">
            <div class="official-info-grid">
                <div class="official-info-item">
                    <div class="official-info-label">Username</div>
                    <div class="official-info-value">@baiillamaach_official</div>
                </div>
                <div class="official-info-item">
                    <div class="official-info-label">Verification ID</div>
                    <div class="official-info-value">${DATA.celebrity.verificationId}</div>
                </div>
                <div class="official-info-item">
                    <div class="official-info-label">Status</div>
                    <div class="official-info-value" style="color:var(--green-600)">● Active & Verified</div>
                </div>
                <div class="official-info-item">
                    <div class="official-info-label">Followers</div>
                    <div class="official-info-value">${DATA.celebrity.followers}</div>
                </div>
                <div class="official-info-item">
                    <div class="official-info-label">Risk Level</div>
                    <div class="official-info-value" style="color:var(--green-600)">None - Safe</div>
                </div>
                <div class="official-info-item">
                    <div class="official-info-label">Joined</div>
                    <div class="official-info-value">${DATA.celebrity.joinedDate}</div>
                </div>
            </div>
            <div class="official-account-preview">
                <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" onerror="this.style.display='none'">
                <div class="username">@baiillamaach_official</div>
                <div class="platform">TikTok • Facebook</div>
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener noreferrer" class="official-follow-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                    Follow Official Account
                </a>
            </div>
        </div>
    </div>
</section>

<section class="fake-accounts-section" data-animate>
    <div class="fake-alert-header">
        <div class="fake-alert-icon">🚨</div>
        <div class="fake-alert-text">
            <h3>WARNING: ${totalFake} Fake Accounts Detected</h3>
            <p>These accounts are NOT affiliated with Baiilla Maach. Report them immediately.</p>
        </div>
    </div>

    <div class="fake-carousel-wrapper" id="fakeCarousel">
        <div class="fake-carousel-track" id="fakeCarouselTrack">
            ${DATA.fakeAccounts.map((a, i) => `
            <div class="fake-carousel-slide">
                <div class="fake-account-card" data-voice="${a.voiceFile || ''}" data-index="${i}">
                    <div class="fake-card-header">
                        <div class="fake-card-title">
                            <span class="fake-icon">⚠️</span>
                            <h3>Fake Account #${i+1}</h3>
                        </div>
                        <span class="fake-risk-badge">${a.riskLevel} RISK</span>
                    </div>
                    <div class="fake-card-body">
                        <div class="fake-card-screenshot">
                            ${a.screenshot ? `<img src="${a.screenshot}" alt="Fake Account Screenshot" loading="lazy">` : ''}
                            <div class="fake-watermark">
                                <span class="fake-watermark-text">⚠️ FAKE ACCOUNT</span>
                                <span class="fake-watermark-text" style="font-size:0.7em">DO NOT TRUST</span>
                            </div>
                        </div>
                        <div class="fake-card-details">
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Platform</span>
                                <span class="fake-detail-value">${a.platform}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Username</span>
                                <span class="fake-detail-value">${a.username}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Risk Score</span>
                                <span class="fake-detail-value">${a.riskScore}/100</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Status</span>
                                <span class="fake-detail-value">${a.status}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Reports</span>
                                <span class="fake-detail-value">${a.reportStatus}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Owner</span>
                                <span class="fake-detail-value">${a.owner}</span>
                            </div>
                            <div class="fake-reason">
                                <span>⚠️</span>
                                <span>${a.reason}</span>
                            </div>
                        </div>
                    </div>
                    <div class="fake-card-actions">
                        <a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn-danger">
                            🚨 Report Account
                        </a>
                        <button class="btn-outline-danger copy-username-btn" data-username="${a.username}">
                            📋 Copy Username
                        </button>
                    </div>
                </div>
            </div>`).join('')}
        </div>
    </div>

    <div class="carousel-nav">
        <button class="carousel-arrow" onclick="moveCarousel(-1)" aria-label="Previous">◀</button>
        <div class="carousel-dots" id="carouselDots">
            ${DATA.fakeAccounts.map((_, i) => `<button class="carousel-dot${i===0?' active':''}" onclick="goToSlide(${i})" aria-label="Slide ${i+1}"></button>`).join('')}
        </div>
        <button class="carousel-arrow" onclick="moveCarousel(1)" aria-label="Next">▶</button>
    </div>
</section>

<section class="section" data-animate>
    <div class="section-header">
        <div class="section-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M3 5v14h18V5H3zm16 2v2H5V7h14zm0 4v2H5v-2h14zm0 4v2H5v-2h14z"/></svg>
        </div>
        <h2 class="section-heading">Account Comparison</h2>
    </div>
    <div class="comparison-table-wrapper">
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Feature</th>
                    <th>✅ Official Account</th>
                    <th>❌ Fake Accounts</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Verification</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> Verified</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Not Verified</td>
                </tr>
                <tr>
                    <td><strong>Username</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> @baiillamaach_official</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Similar copycat names</td>
                </tr>
                <tr>
                    <td><strong>Followers</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> ${DATA.celebrity.followers}</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Few or fake followers</td>
                </tr>
                <tr>
                    <td><strong>Content</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> Original content</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Stolen content</td>
                </tr>
                <tr>
                    <td><strong>Trust Score</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> 100%</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Below 20%</td>
                </tr>
                <tr>
                    <td><strong>Risk Level</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> None</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Critical/High</td>
                </tr>
                <tr>
                    <td><strong>Report Status</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> Clean</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Multiple Reports</td>
                </tr>
                <tr>
                    <td><strong>Owner</strong></td>
                    <td class="official-col"><span class="check-icon">✓</span> Official</td>
                    <td class="fake-col"><span class="cross-icon">✗</span> Impersonator</td>
                </tr>
            </tbody>
        </table>
    </div>
</section>

<div class="warning-section" data-animate>
    <div class="section-header">
        <div class="section-icon" style="background:linear-gradient(135deg,var(--amber-500),#d97706)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
        </div>
        <h2 class="section-heading">How to Stay Safe</h2>
    </div>
    <div class="warning-grid">
        <div class="warning-card">
            <div class="warning-card-icon">🔍</div>
            <h4>Verify Before Trusting</h4>
            <p>Always check the username carefully. Official account is @baiillamaach_official only.</p>
        </div>
        <div class="warning-card">
            <div class="warning-card-icon">🚫</div>
            <h4>Never Share Personal Info</h4>
            <p>Fake accounts may ask for passwords, money, or personal details. Never share them.</p>
        </div>
        <div class="warning-card">
            <div class="warning-card-icon">📢</div>
            <h4>Report Immediately</h4>
            <p>If you find a fake account, report it using the platform's report feature right away.</p>
        </div>
        <div class="warning-card">
            <div class="warning-card-icon">🔗</div>
            <h4>Use Official Links Only</h4>
            <p>Only use the links provided on this page to access the official account.</p>
        </div>
    </div>
</div>

<div class="updates-section" data-animate>
    <h3>🔄 Latest Updates & Security Information</h3>
    <p>Stay informed about impersonation attempts and security measures.</p>
    <div class="update-tags">
        <span class="update-tag">📌 New fake accounts detected weekly</span>
        <span class="update-tag">🔒 Official verification active</span>
        <span class="update-tag">🛡️ Community reporting active</span>
        <span class="update-tag">📢 Awareness campaign ongoing</span>
    </div>
</div>

${coverSongsHTML}

${galleryHTML}

</main>

<footer class="footer">
    <p>© ${DATA.celebrity.fullName} • Official Verification Hub • All Rights Reserved</p>
</footer>

${DATA.fakeAccounts.map((a, i) => a.voiceFile ? `<audio id="fakeVoice${i}" preload="auto" src="${a.voiceFile}"></audio>` : '').join('')}
<audio id="audioPlayer" preload="auto"></audio>

<script>
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

window.addEventListener('scroll', () => {
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    document.getElementById('scrollProgress').style.width = scrollPercent + '%';
});

let currentSlide = 0;
const totalSlides = ${totalFake};
const track = document.getElementById('fakeCarouselTrack');
const dots = document.querySelectorAll('.carousel-dot');
let autoSlideInterval;

function updateCarousel() {
    track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    playFakeVoiceAlert(currentSlide);
}

function moveCarousel(dir) {
    currentSlide = (currentSlide + dir + totalSlides) % totalSlides;
    updateCarousel();
    resetAutoSlide();
}

function goToSlide(i) {
    currentSlide = i;
    updateCarousel();
    resetAutoSlide();
}

function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => moveCarousel(1), 5000);
}

function playFakeVoiceAlert(index) {
    const card = document.querySelectorAll('.fake-account-card')[index];
    if (!card) return;
    const voiceFile = card.dataset.voice;
    if (!voiceFile) return;
    const audio = document.getElementById('fakeVoice' + card.dataset.index);
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.5;
    audio.play().catch(() => {});
}

autoSlideInterval = setInterval(() => moveCarousel(1), 5000);

const carousel = document.getElementById('fakeCarousel');
let touchStartX = 0;
carousel.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
carousel.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
        moveCarousel(diff > 0 ? 1 : -1);
    }
});

playFakeVoiceAlert(0);

document.querySelectorAll('.copy-username-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.username).then(() => {
            this.innerHTML = '✓ Copied!';
            this.classList.add('copied');
            setTimeout(() => {
                this.innerHTML = '📋 Copy Username';
                this.classList.remove('copied');
            }, 2000);
        });
    });
});

let cur = -1, playing = false, ap = document.getElementById('audioPlayer'), items = document.querySelectorAll('.spotify-playlist-item');
function loadSong(i) {
    if (!items.length || i < 0 || i >= items.length) return;
    cur = i;
    const it = items[i];
    ap.src = it.dataset.audio;
    document.getElementById('nowPlayingTitle').textContent = it.querySelector('.spotify-track-title').textContent;
    document.getElementById('nowPlayingArtist').textContent = it.querySelector('.spotify-track-artist-small').textContent;
    const cc = document.getElementById('nowPlayingCover');
    if (it.dataset.cover) {
        cc.innerHTML = '<img src="' + it.dataset.cover + '" alt="">';
    } else {
        cc.innerHTML = '<div class="spotify-default-art"><svg viewBox="0 0 24 24" width="64" height="64"><path fill="white" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>';
    }
    document.querySelectorAll('.spotify-playlist-item').forEach(el => el.classList.remove('active'));
    it.classList.add('active');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('totalTime').textContent = '0:00';
    ap.play().then(() => { playing = true; upPlayBtn(); }).catch(() => {});
}
function playSong(i) { if (i === cur) { togglePlay(); } else { loadSong(i); } }
function togglePlay() { if (!ap.src && items.length > 0) { loadSong(0); return; } if (playing) { ap.pause(); } else { ap.play(); } playing = !playing; upPlayBtn(); }
function upPlayBtn() { document.getElementById('playIcon').style.display = playing ? 'none' : 'block'; document.getElementById('pauseIcon').style.display = playing ? 'block' : 'none'; }
function nextSong() { if (!items.length) return; loadSong((cur + 1) % items.length); }
function prevSong() { if (!items.length) return; loadSong(cur <= 0 ? items.length - 1 : cur - 1); }
function setVol(v) { ap.volume = v / 100; }
ap.addEventListener('timeupdate', () => {
    if (ap.duration) {
        const pct = (ap.currentTime / ap.duration) * 100;
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('progressThumb').style.left = pct + '%';
        const cm = Math.floor(ap.currentTime / 60), cs = Math.floor(ap.currentTime % 60);
        document.getElementById('currentTime').textContent = cm + ':' + cs.toString().padStart(2, '0');
    }
});
ap.addEventListener('loadedmetadata', () => {
    const tm = Math.floor(ap.duration / 60), ts = Math.floor(ap.duration % 60);
    document.getElementById('totalTime').textContent = tm + ':' + ts.toString().padStart(2, '0');
});
ap.addEventListener('ended', nextSong);
const pb = document.getElementById('progressBar');
if (pb) {
    pb.addEventListener('click', e => {
        const r = e.target.getBoundingClientRect();
        ap.currentTime = ((e.clientX - r.left) / r.width) * ap.duration;
    });
}
ap.volume = 0.7;

let currentGalleryIndex = 0;
const galleryImages = document.querySelectorAll('.gallery-image');
const lightbox = document.getElementById('galleryLightbox');
const lightboxImage = document.getElementById('lightboxImage');

function openGalleryLightbox(index) {
    currentGalleryIndex = index;
    lightboxImage.src = galleryImages[index].src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeGalleryLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateGallery(dir) {
    currentGalleryIndex = (currentGalleryIndex + dir + galleryImages.length) % galleryImages.length;
    lightboxImage.src = galleryImages[currentGalleryIndex].src;
}

lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeGalleryLightbox();
});

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
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}.login-box{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.08)}h2{text-align:center;color:#ff0050;margin-bottom:30px;font-size:1.6em}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#475569;font-weight:600;font-size:.9em}input{width:100%;padding:12px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:1em;outline:none;transition:border .3s}input:focus{border-color:#ff0050}.btn{width:100%;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer;transition:all .3s}.btn:hover{background:#d90040;transform:translateY(-2px)}.error{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center}.back-link{text-align:center;margin-top:20px}a{color:#64748b;text-decoration:none}a:hover{color:#ff0050}</style></head><body><div class="login-box"><h2>Admin Login</h2>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="form-group"><label>Username</label><input type="text" name="username" required></div><div class="form-group"><label>Password</label><input type="password" name="password" required></div><button type="submit" class="btn">Login</button></form><div class="back-link"><a href="/">Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="pc"><img src="${p.path}" class="pi"><div class="info">${p.caption?`<p>${p.caption}</p>`:''}<p class="date">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="del" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;color:#0f172a}.header{background:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:10px}.header h2{color:#ff0050}.header a{color:#64748b;text-decoration:none;padding:8px 16px;border:2px solid #e2e8f0;border-radius:8px;margin-left:10px;font-weight:600}.header a:hover{background:#ff0050;color:#fff;border-color:#ff0050}.container{max-width:1100px;margin:0 auto;padding:30px 20px}.upload{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:30px;margin-bottom:30px;box-shadow:0 4px 15px rgba(0,0,0,.05)}.upload h3{color:#ff0050;margin-bottom:20px}.form-group{margin-bottom:15px}label{display:block;margin-bottom:6px;color:#475569;font-weight:600}input,textarea{width:100%;padding:10px 14px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:8px;font-size:.95em;outline:none}input:focus,textarea:focus{border-color:#ff0050}.btn-up{background:#22c55e;color:#fff;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer;transition:all .3s}.btn-up:hover{background:#16a34a;transform:translateY(-2px)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}.pc{background:#fff;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;transition:all .3s}.pc:hover{border-color:#ff0050;box-shadow:0 8px 25px rgba(0,0,0,.1)}.pi{width:100%;height:200px;object-fit:cover}.info{padding:12px}.info p{font-size:.85em}.date{font-size:.75em;color:#94a3b8;margin-top:2px}.del{background:#fef2f2;color:#dc2626;border:2px solid #fecaca;padding:6px 12px;border-radius:6px;cursor:pointer;margin:0 12px 12px;width:calc(100% - 24px);font-weight:600}.del:hover{background:#ef4444;color:#fff;border-color:#ef4444}.msg{background:#f0fdf4;border:2px solid #bbf7d0;color:#166534;padding:12px;border-radius:8px;margin-bottom:20px}.err{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px}</style></head><body><div class="header"><h2>Admin Panel</h2><div><a href="/">Home</a><a href="/admin/logout">Logout</a></div></div><div class="container">${msg?`<div class="msg">${msg}</div>`:''}${err?`<div class="err">${err}</div>`:''}<div class="upload"><h3>Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="form-group"><label>Select Photo</label><input type="file" name="photo" accept="image/*" required></div><div class="form-group"><label>Caption</label><input type="text" name="caption"></div><button type="submit" class="btn-up">Upload</button></form></div><h3 style="margin-bottom:20px">Gallery (${photos.length})</h3>${photos.length?`<div class="grid">${phtml}</div>`:'<p style="color:#94a3b8;text-align:center;padding:40px">No photos yet</p>'}</div></body></html>`;
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
            const range = req.headers.range;
            if (range && ['.mp3','.wav','.ogg','.m4a','.aac','.flac'].includes(ext)) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                res.writeHead(206, { 'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':(end-start)+1,'Content-Type':ct,'Cache-Control':'public, max-age=86400' });
                fs.createReadStream(assetPath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, { 'Content-Type':ct,'Content-Length':stat.size,'Cache-Control':'public, max-age=86400','Accept-Ranges':'bytes' });
                fs.createReadStream(assetPath).pipe(res);
            }
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
        const form = new formidable.IncomingForm({ uploadDir:GALLERY_DIR,keepExtensions:true,maxFileSize:MAX_UPLOAD_SIZE });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Upload error')); return; }
            const pf = Array.isArray(files.photo)?files.photo[0]:files.photo;
            if (!pf||!pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','No file selected')); return; }
            const ext = path.extname(pf.originalFilename).toLowerCase();
            if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Invalid format')); return; }
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

    if (pathname === '/health') { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({status:'ok',coverSongs:getCoverSongs().length,timestamp:new Date().toISOString()})); return; }

    res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:100px;color:#ff0050}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>`);
});

async function start() {
    await connectDB();
    server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
}

start();
server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });

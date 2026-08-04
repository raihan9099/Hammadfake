const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const WebSocket = require('ws');

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = process.env.DB_NAME || 'verification_hub';
const NODE_ENV = process.env.NODE_ENV || 'production';

// ==================== GLOBAL ERROR HANDLERS ====================
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    // Don't exit - keep alive for Render
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    // Don't exit - keep alive for Render
});

// ==================== VALIDATE ENVIRONMENT ====================
function validateEnv() {
    const warnings = [];
    if (!MONGO_URI) warnings.push('MONGO_URI is not set. Using default.');
    if (!PORT) warnings.push('PORT is not set. Using 3000.');
    if (warnings.length > 0) {
        console.warn('⚠️  Environment Warnings:');
        warnings.forEach(w => console.warn(`   - ${w}`));
    }
    console.log('✅ Environment validated');
}
validateEnv();

// ==================== PATHS & DIRECTORIES ====================
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');

// Create directories if they don't exist
[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    } catch (err) {
        console.error(`❌ Failed to create directory ${dir}:`, err.message);
    }
});

// ==================== DATABASE CONNECTION ====================
let db = null;
let mongoClient = null;
let dbConnected = false;

async function connectDB(retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔌 Connecting to MongoDB (attempt ${attempt}/${retries})...`);
            mongoClient = new MongoClient(MONGO_URI, {
                maxPoolSize: 5, // Limit connections for Render Free
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
            });
            await mongoClient.connect();
            db = mongoClient.db(DB_NAME);
            
            // Create indexes
            await db.collection('admin_users').createIndex({ username: 1 }, { unique: true });
            await db.collection('chat_messages').createIndex({ userId: 1, timestamp: -1 });
            await db.collection('chat_users').createIndex({ email: 1 }, { unique: true });
            await db.collection('gallery_photos').createIndex({ uploadedAt: -1 });
            
            // Create default admin if not exists
            const admins = db.collection('admin_users');
            const exists = await admins.findOne({ username: 'admin' });
            if (!exists) {
                await admins.insertOne({
                    username: 'admin',
                    password: await bcrypt.hash('admin123', 10),
                    createdAt: new Date()
                });
                console.log('👤 Default admin user created');
            }
            
            dbConnected = true;
            console.log('✅ MongoDB connected successfully');
            return true;
        } catch (err) {
            console.error(`❌ MongoDB connection attempt ${attempt} failed:`, err.message);
            if (attempt < retries) {
                const delay = attempt * 2000;
                console.log(`⏳ Retrying in ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.warn('⚠️  MongoDB connection failed after all retries. Running without database.');
    dbConnected = false;
    return false;
}

// ==================== HELPER FUNCTIONS ====================
function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus', '.weba'];
        const audioFiles = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return audioExts.includes(ext) && f !== '.gitkeep';
        });
        return audioFiles.map((file, index) => {
            const ext = path.extname(file);
            const baseName = path.basename(file, ext);
            const displayName = baseName
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim() || `Track ${index + 1}`;
            return {
                id: `track_${index}`,
                title: displayName,
                artist: 'Baiilla Maach',
                audioUrl: `/assets/covermusic/${encodeURIComponent(file)}`,
                fileName: file
            };
        }).sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) {
        console.error('Error reading cover music:', e.message);
        return [];
    }
}

async function getGalleryPhotos() {
    if (!dbConnected || !db) return [];
    try {
        return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray();
    } catch (e) {
        console.error('Error fetching gallery:', e.message);
        return [];
    }
}

async function savePhoto(d) {
    if (!dbConnected || !db) return null;
    try {
        return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() });
    } catch (e) {
        console.error('Error saving photo:', e.message);
        return null;
    }
}

async function deletePhoto(id) {
    if (!dbConnected || !db) return null;
    try {
        return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
    } catch (e) {
        console.error('Error deleting photo:', e.message);
        return null;
    }
}

async function verifyAdmin(u, p) {
    if (!dbConnected || !db) return u === 'admin' && p === 'admin123';
    try {
        const a = await db.collection('admin_users').findOne({ username: u });
        if (!a) return false;
        return await bcrypt.compare(p, a.password);
    } catch (e) {
        console.error('Error verifying admin:', e.message);
        return false;
    }
}

// Session management
const sessions = new Map();
const SESSION_TIMEOUT = 7200000; // 2 hours

function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: u, createdAt: Date.now() });
    // Clean up expired sessions periodically
    if (sessions.size > 100) {
        const now = Date.now();
        for (const [key, val] of sessions) {
            if (now - val.createdAt > SESSION_TIMEOUT) sessions.delete(key);
        }
    }
    return id;
}

function getSession(id) {
    if (!id) return null;
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_TIMEOUT) {
        sessions.delete(id);
        return null;
    }
    return s;
}

function parseCookies(h) {
    const c = {};
    if (h) {
        h.split(';').forEach(x => {
            const parts = x.split('=');
            c[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
        });
    }
    return c;
}

// MIME types
const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.wma': 'audio/x-ms-wma',
    '.opus': 'audio/opus',
    '.weba': 'audio/webm',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.html': 'text/html',
};

// ==================== DATA ====================
const ASSETS = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    fbProfile: "/assets/fb_profile.jpg",
    official: "/assets/orginalss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect .png",
    realId: "/assets/real-id-ss.png",
    checkMark: "/assets/check-mark.png",
    flag: "/assets/flag.png",
    report: "/assets/report.png",
    communication: "/assets/communication.png",
    socialMedia: "/assets/social-media.png",
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    microphoneIcon: "/assets/microphone-in-hand.gif",
    realVoice: "/assets/realvoice.mp3",
    fakeSong: "/assets/7 lak like but its fake.mp3"
};

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: ASSETS.profile,
        bio: "Official Entertainment Profile | Verified Creator",
        username: "@baiillamaach_official",
        followers: "2.5M+",
        likes: "50M+"
    },
    facebookOfficial: {
        name: "Baiilla Maach Official",
        username: "@baiillamaach_official",
        url: "https://www.facebook.com/profile.php?id=61575202118828",
        profilePic: ASSETS.fbProfile,
        verified: true,
        followers: "500K+",
        category: "Entertainment"
    },
    tiktokOfficial: {
        username: "@baiillamaach_official",
        url: "https://tiktok.com/@baiillamaach_official",
        verified: true
    },
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: ASSETS.danger,
            reason: "Copies official logo and content to deceive followers. Uses similar name to confuse fans.",
            reported: 150
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: ASSETS.fraud,
            reason: "Uses official name and photo to mislead followers. Stolen content detected.",
            reported: 89
        }
    ]
};

// ==================== HTML GENERATION ====================
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    // Music section HTML
    let coverSongsHTML = '';
    if (coverSongs.length > 0) {
        coverSongsHTML = `
        <section class="section music-section" data-animate>
            <div class="container">
                <div class="section-header">
                    <div class="section-tag">
                        <span class="tag-dot"></span><span>Music</span>
                    </div>
                    <h2 class="section-title">Cover <span class="accent">Music</span></h2>
                    <p class="section-subtitle">Official cover songs by ${DATA.celebrity.name}</p>
                </div>
                <div class="music-player">
                    <div class="music-now-playing">
                        <div class="music-album-art" id="albumArt"><i class="fas fa-music"></i></div>
                        <div class="music-track-info">
                            <div class="music-track-name" id="currentTitle">Select a song</div>
                            <div class="music-track-artist" id="currentArtist">Tap to play</div>
                            <div class="music-progress">
                                <div class="music-progress-bar" onclick="seekAudio(event)">
                                    <div class="music-progress-fill" id="progressFill"></div>
                                </div>
                                <div class="music-time">
                                    <span id="currentTime">0:00</span>
                                    <span id="totalTime">0:00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="music-controls">
                        <button class="music-btn" onclick="previousTrack()" title="Previous"><i class="fas fa-backward"></i></button>
                        <button class="music-btn music-play-btn" id="playBtn" onclick="togglePlay()"><i class="fas fa-play" id="playIcon"></i></button>
                        <button class="music-btn" onclick="nextTrack()" title="Next"><i class="fas fa-forward"></i></button>
                    </div>
                    <div class="music-playlist">
                        <div class="music-playlist-header">Playlist · ${coverSongs.length} songs</div>
                        ${coverSongs.map((s, i) => `
                        <div class="song-item" id="song-${i}" data-audio="${s.audioUrl}" onclick="playSong(${i})">
                            <div class="song-number">${(i+1).toString().padStart(2,'0')}</div>
                            <div class="song-details">
                                <div class="song-title">${s.title}</div>
                                <div class="song-artist">${s.artist}</div>
                            </div>
                            <div class="song-duration" id="duration-${i}">--:--</div>
                        </div>`).join('')}
                    </div>
                </div>
            </div>
        </section>`;
    }

    // Gallery section HTML
    let galleryHTML = '';
    if (galleryPhotos.length > 0) {
        galleryHTML = `
        <section class="section gallery-section" data-animate>
            <div class="container">
                <div class="section-header">
                    <div class="section-tag"><span class="tag-dot"></span><span>Gallery</span></div>
                    <h2 class="section-title">Official <span class="accent">Gallery</span></h2>
                    <p class="section-subtitle">Verified photos and screenshots</p>
                </div>
                <div class="gallery-grid">
                    ${galleryPhotos.map((p, i) => `
                    <div class="gallery-card" onclick="openGalleryLightbox(${i})">
                        <div class="gallery-card-inner">
                            <img src="${p.path}" alt="${p.caption || 'Gallery'}" class="gallery-image" loading="lazy">
                            <div class="gallery-overlay"><i class="fas fa-search-plus" style="color:#fff;font-size:1.5em;"></i></div>
                        </div>
                        ${p.caption ? `<p class="gallery-caption">${p.caption}</p>` : ''}
                    </div>`).join('')}
                </div>
            </div>
        </section>
        <div class="lightbox" id="galleryLightbox">
            <button class="lightbox-close" onclick="closeGalleryLightbox()"><i class="fas fa-times"></i></button>
            <button class="lightbox-nav lightbox-prev" onclick="navigateGallery(-1)"><i class="fas fa-chevron-left"></i></button>
            <img class="lightbox-image" id="lightboxImage" src="" alt="">
            <button class="lightbox-nav lightbox-next" onclick="navigateGallery(1)"><i class="fas fa-chevron-right"></i></button>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Official Verification Hub for Baiilla Maach. Identify real vs fake accounts.">
<meta name="theme-color" content="#ff6600">
<title>${DATA.celebrity.fullName} | Official Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
:root {
    --primary: #ff6600;
    --primary-dark: #cc5500;
    --primary-light: #ff8533;
    --secondary: #135360;
    --facebook: #1877f2;
    --tiktok: #000000;
    --tiktok-pink: #ff0050;
    --tiktok-cyan: #00f2ea;
    --verified: #1d9bf0;
    --success: #22c55e;
    --danger: #ef4444;
    --warning: #f59e0b;
    --dark: #0f172a;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-300: #cbd5e1;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-600: #475569;
    --gray-700: #334155;
    --gray-800: #1e293b;
    --gray-900: #0f172a;
    --white: #ffffff;
    --radius-sm: 8px;
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-2xl: 24px;
    --radius-full: 9999px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
    --shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body { font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--gray-50); color: var(--gray-800); line-height: 1.6; overflow-x: hidden; }

@keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes verifiedPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(29,155,240,0.4); } 50% { box-shadow: 0 0 0 12px rgba(29,155,240,0); } }
@keyframes dangerPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } }

[data-animate] { opacity: 0; }
[data-animate].animated { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
[data-animate-left] { opacity: 0; }
[data-animate-left].animated { animation: slideInLeft 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
[data-animate-right] { opacity: 0; }
[data-animate-right].animated { animation: slideInRight 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--gray-100); }
::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 4px; }

.scroll-progress { position: fixed; top: 0; left: 0; height: 3px; background: linear-gradient(90deg,var(--primary),var(--tiktok-pink),var(--tiktok-cyan)); z-index: 10001; transition: width 0.1s linear; }

.navbar { position: sticky; top: 0; z-index: 1000; background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--gray-200); padding: 0; box-shadow: var(--shadow-sm); }
.navbar .container { max-width: 1200px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
.nav-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.nav-logo { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover; }
.nav-title { font-weight: 700; font-size: 1.1em; color: var(--gray-900); }
.nav-actions { display: flex; align-items: center; gap: 12px; }
.btn-nav { padding: 8px 18px; border-radius: var(--radius-full); font-weight: 600; font-size: 0.85em; text-decoration: none; transition: all 0.3s; border: 2px solid transparent; cursor: pointer; }
.btn-chat { background: var(--primary); color: var(--white); display: flex; align-items: center; gap: 6px; border: none; }
.btn-chat:hover { background: var(--primary-dark); transform: translateY(-1px); }
.btn-admin { background: transparent; color: var(--gray-600); border-color: var(--gray-300); }
.btn-admin:hover { background: var(--gray-100); border-color: var(--gray-400); }

.hero { position: relative; background: linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%); padding: 80px 0 60px; overflow: hidden; }
.hero::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 30% 50%,rgba(255,102,0,0.08) 0%,transparent 50%),radial-gradient(circle at 70% 50%,rgba(255,0,80,0.06) 0%,transparent 50%); animation: spin 30s linear infinite; }
.hero-particles { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.particle { position: absolute; width: 4px; height: 4px; background: var(--primary); border-radius: 50%; animation: float 6s ease-in-out infinite; }
.particle:nth-child(1) { top: 20%; left: 10%; animation-delay: 0s; }
.particle:nth-child(2) { top: 60%; left: 80%; animation-delay: 1s; }
.particle:nth-child(3) { top: 40%; left: 50%; animation-delay: 2s; }
.particle:nth-child(4) { top: 70%; left: 30%; animation-delay: 3s; }
.particle:nth-child(5) { top: 30%; left: 70%; animation-delay: 4s; }
.hero .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 2; }
.hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
@media (max-width:968px) { .hero-grid { grid-template-columns: 1fr; text-align: center; } }
.hero-content { color: var(--white); }
.hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 8px 18px; border-radius: var(--radius-full); font-size: 0.8em; font-weight: 600; margin-bottom: 24px; color: var(--white); }
.hero-badge .dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; animation: verifiedPulse 2s infinite; }
.hero-title { font-size: 3.2em; font-weight: 900; line-height: 1.1; margin-bottom: 16px; letter-spacing: -0.5px; }
.hero-title .highlight { background: linear-gradient(135deg,var(--primary),var(--tiktok-pink)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero-subtitle { font-size: 1.1em; opacity: 0.9; margin-bottom: 24px; line-height: 1.6; }
.hero-stats { display: flex; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; justify-content: center; }
.stat-item { text-align: center; padding: 12px 20px; background: rgba(255,255,255,0.08); border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.1); }
.stat-value { font-size: 1.5em; font-weight: 800; color: var(--primary); }
.stat-label { font-size: 0.75em; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; }
.hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.btn-hero { padding: 14px 28px; border-radius: var(--radius-full); font-weight: 700; font-size: 0.95em; text-decoration: none; transition: all 0.3s; display: inline-flex; align-items: center; gap: 8px; }
.btn-hero-primary { background: linear-gradient(135deg,var(--primary),var(--primary-dark)); color: var(--white); box-shadow: 0 8px 25px rgba(255,102,0,0.3); }
.btn-hero-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(255,102,0,0.4); }
.btn-hero-outline { border: 2px solid rgba(255,255,255,0.3); color: var(--white); }
.btn-hero-outline:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }
.hero-visual { display: flex; justify-content: center; align-items: center; }
.hero-profile-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-2xl); padding: 40px; text-align: center; max-width: 380px; width: 100%; }
.hero-profile-img { width: 120px; height: 120px; border-radius: 50%; border: 4px solid var(--primary); object-fit: cover; margin-bottom: 16px; box-shadow: 0 0 30px rgba(255,102,0,0.3); }
.hero-profile-name { font-size: 1.3em; font-weight: 700; color: var(--white); margin-bottom: 4px; }
.hero-profile-username { font-size: 0.9em; color: var(--gray-400); margin-bottom: 12px; }
.verified-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--verified); color: var(--white); padding: 6px 16px; border-radius: var(--radius-full); font-size: 0.8em; font-weight: 700; animation: verifiedPulse 2.5s infinite; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 80px 0; }
.section-header { text-align: center; margin-bottom: 50px; }
.section-tag { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,102,0,0.08); border: 1px solid rgba(255,102,0,0.15); padding: 6px 18px; border-radius: var(--radius-full); font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary); margin-bottom: 16px; }
.section-tag .tag-dot { width: 7px; height: 7px; background: var(--primary); border-radius: 50%; }
.section-title { font-size: 2.5em; font-weight: 800; color: var(--gray-900); margin-bottom: 12px; letter-spacing: -0.3px; }
.section-title .accent { color: var(--primary); }
.section-subtitle { font-size: 1.05em; color: var(--gray-500); max-width: 600px; margin: 0 auto; }

.fb-official-section { background: var(--white); }
.fb-official-card { background: var(--white); border: 2px solid var(--gray-200); border-radius: var(--radius-2xl); overflow: hidden; box-shadow: var(--shadow-lg); transition: all 0.3s; }
.fb-official-card:hover { box-shadow: var(--shadow-xl); transform: translateY(-2px); }
.fb-card-header { background: linear-gradient(135deg,var(--facebook),#0d5fd9); padding: 32px; color: var(--white); display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.fb-profile-pic { width: 100px; height: 100px; border-radius: 50%; border: 4px solid var(--white); object-fit: cover; box-shadow: var(--shadow-lg); }
.fb-info h3 { font-size: 1.3em; font-weight: 700; margin-bottom: 4px; }
.fb-info p { font-size: 0.9em; opacity: 0.9; }
.fb-verified-icon { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: var(--radius-full); font-size: 0.8em; font-weight: 600; margin-top: 8px; }
.fb-card-body { padding: 24px 32px; }
.fb-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
@media (max-width:600px) { .fb-stats { grid-template-columns: repeat(2,1fr); } }
.fb-stat { text-align: center; padding: 16px; background: var(--gray-50); border-radius: var(--radius); }
.fb-stat-value { font-size: 1.2em; font-weight: 800; color: var(--gray-900); }
.fb-stat-label { font-size: 0.75em; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
.fb-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.btn-facebook { background: var(--facebook); color: var(--white); padding: 12px 24px; border-radius: var(--radius-full); font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s; }
.btn-facebook:hover { background: #0d5fd9; transform: translateY(-1px); }
.btn-tiktok { background: #000; color: #fff; padding: 12px 24px; border-radius: var(--radius-full); font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s; }
.btn-tiktok:hover { background: #333; transform: translateY(-1px); }

.fake-section { background: #fef2f2; }
.fake-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(350px,1fr)); gap: 24px; }
@media (max-width:480px) { .fake-grid { grid-template-columns: 1fr; } }
.fake-card { background: var(--white); border: 2px solid #fecaca; border-radius: var(--radius-xl); padding: 24px; position: relative; overflow: hidden; transition: all 0.3s; }
.fake-card:hover { border-color: var(--danger); box-shadow: var(--shadow-lg); transform: translateY(-3px); }
.fake-card-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-25deg); font-size: 6em; font-weight: 900; color: rgba(239,68,68,0.03); pointer-events: none; letter-spacing: 10px; white-space: nowrap; }
.fake-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.fake-card-badge { background: var(--danger); color: var(--white); padding: 4px 14px; border-radius: var(--radius-full); font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; animation: dangerPulse 2s infinite; }
.fake-screenshot { border-radius: var(--radius); overflow: hidden; margin-bottom: 16px; border: 3px solid #fecaca; }
.fake-screenshot img { width: 100%; display: block; }
.fake-detail { display: flex; justify-content: space-between; padding: 8px 12px; background: #fef2f2; border-radius: var(--radius-sm); margin-bottom: 8px; font-size: 0.85em; }
.fake-detail-label { color: var(--danger); font-weight: 600; }
.fake-detail-value { color: var(--gray-700); font-weight: 700; }
.fake-reason { background: #fff; border: 2px solid #fee2e2; border-radius: var(--radius); padding: 12px; margin: 12px 0; font-size: 0.85em; color: var(--danger); line-height: 1.5; }
.fake-actions { display: flex; gap: 8px; }
.btn-danger { background: linear-gradient(135deg,var(--danger),#dc2626); color: var(--white); padding: 10px 20px; border-radius: var(--radius-full); font-weight: 700; font-size: 0.85em; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.3s; flex: 1; justify-content: center; }
.btn-danger:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(239,68,68,0.3); }
.btn-copy { background: var(--white); color: var(--danger); border: 2px solid #fecaca; padding: 10px 20px; border-radius: var(--radius-full); font-weight: 700; font-size: 0.85em; cursor: pointer; transition: all 0.3s; display: inline-flex; align-items: center; gap: 6px; flex: 1; justify-content: center; }
.btn-copy:hover { background: #fef2f2; border-color: var(--danger); }
.btn-copy.copied { background: var(--success) !important; color: var(--white) !important; border-color: var(--success) !important; }

.evidence-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); gap: 24px; }
.evidence-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); padding: 24px; text-align: center; transition: all 0.3s; }
.evidence-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); }
.evidence-icon { width: 64px; height: 64px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.8em; }
.evidence-icon.real { background: #f0fdf4; color: var(--success); }
.evidence-icon.fake { background: #fef2f2; color: var(--danger); }
.evidence-icon.warning { background: #fffbeb; color: var(--warning); }
.evidence-card h4 { font-weight: 700; margin-bottom: 8px; color: var(--gray-900); }
.evidence-card p { font-size: 0.9em; color: var(--gray-500); }

.music-section { background: var(--gray-50); }
.music-player { background: var(--white); border-radius: var(--radius-2xl); border: 1px solid var(--gray-200); overflow: hidden; box-shadow: var(--shadow-md); max-width: 800px; margin: 0 auto; }
.music-now-playing { background: linear-gradient(135deg,#ff6600,#cc5500); color: var(--white); padding: 24px; display: flex; align-items: center; gap: 20px; }
.music-album-art { width: 90px; height: 90px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 2.5em; overflow: hidden; }
.music-album-art.playing { animation: spin 10s linear infinite; }
.music-album-art img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.music-track-info { flex: 1; min-width: 0; }
.music-track-name { font-size: 1.1em; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.music-track-artist { font-size: 0.85em; opacity: 0.9; margin-top: 2px; }
.music-progress { margin-top: 12px; }
.music-progress-bar { width: 100%; height: 5px; background: rgba(255,255,255,0.3); border-radius: 3px; cursor: pointer; overflow: hidden; }
.music-progress-fill { height: 100%; background: var(--white); border-radius: 3px; width: 0%; transition: width 0.1s linear; }
.music-time { display: flex; justify-content: space-between; font-size: 0.7em; margin-top: 4px; opacity: 0.8; }
.music-controls { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 16px; }
.music-btn { background: none; border: none; cursor: pointer; color: var(--gray-600); transition: all 0.2s; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1em; }
.music-btn:hover { color: var(--primary); background: var(--gray-100); }
.music-play-btn { width: 56px; height: 56px; background: linear-gradient(135deg,var(--primary),var(--primary-dark)); color: var(--white); border-radius: 50%; font-size: 1.2em; }
.music-play-btn:hover { background: var(--primary-dark); color: var(--white); transform: scale(1.05); }
.music-playlist { max-height: 300px; overflow-y: auto; }
.music-playlist-header { padding: 12px 20px; background: var(--gray-50); font-weight: 600; font-size: 0.85em; color: var(--gray-500); position: sticky; top: 0; }
.song-item { display: flex; align-items: center; gap: 12px; padding: 12px 20px; cursor: pointer; transition: all 0.2s; border-bottom: 1px solid var(--gray-100); }
.song-item:hover { background: var(--gray-50); }
.song-item.active { background: #fff7f0; border-left: 3px solid var(--primary); }
.song-number { font-size: 0.85em; color: var(--gray-400); font-weight: 600; width: 28px; text-align: center; }
.song-details { flex: 1; min-width: 0; }
.song-title { font-weight: 600; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-artist { font-size: 0.75em; color: var(--gray-500); }
.song-duration { font-size: 0.8em; color: var(--gray-400); }

.gallery-section { background: var(--white); }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(250px,1fr)); gap: 20px; }
.gallery-card { border-radius: var(--radius-xl); overflow: hidden; cursor: pointer; transition: all 0.3s; box-shadow: var(--shadow); }
.gallery-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.gallery-card-inner { position: relative; overflow: hidden; }
.gallery-image { width: 100%; height: 220px; object-fit: cover; display: block; transition: transform 0.4s; }
.gallery-card:hover .gallery-image { transform: scale(1.05); }
.gallery-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; }
.gallery-card:hover .gallery-overlay { opacity: 1; }
.gallery-caption { padding: 12px 16px; font-size: 0.85em; color: var(--gray-600); text-align: center; }

.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 10000; display: none; align-items: center; justify-content: center; }
.lightbox.active { display: flex; }
.lightbox-close { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: var(--white); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2em; z-index: 10001; }
.lightbox-image { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: var(--radius); }
.lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: var(--white); width: 44px; height: 44px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1em; transition: all 0.3s; }
.lightbox-nav:hover { background: rgba(255,255,255,0.25); }
.lightbox-prev { left: 20px; }
.lightbox-next { right: 20px; }

.chat-widget { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }
.chat-toggle { width: 60px; height: 60px; background: linear-gradient(135deg,var(--primary),var(--primary-dark)); color: var(--white); border-radius: 50%; border: none; cursor: pointer; font-size: 1.5em; box-shadow: 0 8px 25px rgba(255,102,0,0.3); transition: all 0.3s; display: flex; align-items: center; justify-content: center; position: relative; }
.chat-toggle:hover { transform: scale(1.1); }
.chat-notification { position: absolute; top: -4px; right: -4px; background: var(--danger); color: var(--white); width: 22px; height: 22px; border-radius: 50%; font-size: 0.65em; font-weight: 700; display: none; align-items: center; justify-content: center; }
.chat-window { position: fixed; bottom: 100px; right: 24px; width: 380px; height: 520px; background: var(--white); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); display: none; flex-direction: column; overflow: hidden; z-index: 9998; }
.chat-window.open { display: flex; }
.chat-header { background: linear-gradient(135deg,var(--primary),var(--primary-dark)); color: var(--white); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
.chat-header h4 { font-weight: 600; font-size: 0.95em; }
.chat-close { background: none; border: none; color: var(--white); cursor: pointer; font-size: 1.2em; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.chat-message { max-width: 80%; padding: 10px 16px; border-radius: 18px; font-size: 0.88em; line-height: 1.5; word-wrap: break-word; }
.chat-message.sent { background: var(--primary); color: var(--white); align-self: flex-end; border-bottom-right-radius: 4px; }
.chat-message.received { background: var(--gray-100); color: var(--gray-800); align-self: flex-start; border-bottom-left-radius: 4px; }
.chat-message .msg-time { font-size: 0.65em; opacity: 0.7; margin-top: 4px; text-align: right; }
.chat-input-area { padding: 12px 16px; border-top: 1px solid var(--gray-200); display: flex; gap: 8px; }
.chat-input { flex: 1; padding: 10px 14px; border: 2px solid var(--gray-200); border-radius: var(--radius-full); font-size: 0.88em; outline: none; font-family: inherit; }
.chat-input:focus { border-color: var(--primary); }
.chat-send-btn { width: 44px; height: 44px; background: var(--primary); color: var(--white); border: none; border-radius: 50%; cursor: pointer; font-size: 1em; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
.chat-send-btn:hover { background: var(--primary-dark); }
.chat-login { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
.chat-login h4 { text-align: center; color: var(--gray-700); margin-bottom: 8px; }
.chat-login input { padding: 12px 16px; border: 2px solid var(--gray-200); border-radius: var(--radius); font-size: 0.9em; outline: none; font-family: inherit; }
.chat-login input:focus { border-color: var(--primary); }
.chat-login .btn-login { background: var(--primary); color: var(--white); padding: 12px; border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; font-size: 0.95em; }

.footer { background: var(--gray-900); color: var(--gray-400); padding: 40px 0; text-align: center; }
.footer-content { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.footer-social { display: flex; gap: 16px; justify-content: center; margin-bottom: 20px; }
.footer-social a { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); color: var(--white); display: flex; align-items: center; justify-content: center; text-decoration: none; transition: all 0.3s; }
.footer-social a:hover { background: var(--primary); }

.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: var(--radius); color: var(--white); font-weight: 600; z-index: 10002; animation: fadeUp 0.3s ease; }
.toast.success { background: var(--success); }
.toast.error { background: var(--danger); }

@media (max-width:768px) {
    .hero-title { font-size: 2em; }
    .section-title { font-size: 1.8em; }
    .hero-grid { gap: 40px; }
    .fb-stats { grid-template-columns: repeat(2,1fr); }
    .fake-grid { grid-template-columns: 1fr; }
    .chat-window { width: calc(100vw - 32px); right: 16px; bottom: 90px; height: 60vh; }
}
@media (max-width:480px) {
    .section { padding: 50px 0; }
    .hero { padding: 60px 0 40px; }
    .hero-profile-card { padding: 24px; }
    .hero-profile-img { width: 80px; height: 80px; }
    .music-now-playing { flex-direction: column; text-align: center; }
}
</style>
</head>
<body>

<div class="scroll-progress" id="scrollProgress"></div>

<nav class="navbar">
    <div class="container">
        <a href="/" class="nav-brand">
            <img src="${DATA.celebrity.photo}" alt="Logo" class="nav-logo" onerror="this.style.display='none'">
            <span class="nav-title">Verification Hub</span>
        </a>
        <div class="nav-actions">
            <button class="btn-nav btn-chat" onclick="toggleChat()"><i class="fas fa-comment-dots"></i> Chat</button>
            <a href="/admin" class="btn-nav btn-admin"><i class="fas fa-lock"></i> Admin</a>
        </div>
    </div>
</nav>

<section class="hero" data-animate>
    <div class="hero-particles"><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div></div>
    <div class="container">
        <div class="hero-grid">
            <div class="hero-content">
                <div class="hero-badge"><span class="dot"></span>OFFICIALLY VERIFIED</div>
                <h1 class="hero-title">${DATA.celebrity.fullName}<br><span class="highlight">Real Account</span></h1>
                <p class="hero-subtitle">${DATA.celebrity.bio} — Beware of fake accounts impersonating this profile. Only trust accounts listed on this page.</p>
                <div class="hero-stats">
                    <div class="stat-item"><div class="stat-value">${DATA.celebrity.followers}</div><div class="stat-label">Followers</div></div>
                    <div class="stat-item"><div class="stat-value">${DATA.celebrity.likes}</div><div class="stat-label">Likes</div></div>
                    <div class="stat-item"><div class="stat-value">${totalFake}</div><div class="stat-label">Fakes Found</div></div>
                </div>
                <div class="hero-buttons">
                    <a href="#facebook-official" class="btn-hero btn-hero-primary"><i class="fab fa-facebook"></i> Official Facebook</a>
                    <a href="#fake-accounts" class="btn-hero btn-hero-outline"><i class="fas fa-exclamation-triangle"></i> View Fakes</a>
                </div>
            </div>
            <div class="hero-visual">
                <div class="hero-profile-card">
                    <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-profile-img" onerror="this.style.display='none'">
                    <div class="hero-profile-name">${DATA.celebrity.name}</div>
                    <div class="hero-profile-username">${DATA.celebrity.username}</div>
                    <div class="verified-badge"><i class="fas fa-check-circle"></i> VERIFIED</div>
                </div>
            </div>
        </div>
    </div>
</section>

<main>
    <section class="section fb-official-section" id="facebook-official" data-animate>
        <div class="container">
            <div class="section-header">
                <div class="section-tag"><span class="tag-dot"></span><span>Official Account</span></div>
                <h2 class="section-title">Facebook <span class="accent">Verified Profile</span></h2>
                <p class="section-subtitle">This is the ONLY authentic Facebook account. Report any others.</p>
            </div>
            <div class="fb-official-card">
                <div class="fb-card-header">
                    <img src="${DATA.facebookOfficial.profilePic}" alt="FB Profile" class="fb-profile-pic" onerror="this.style.display='none'">
                    <div class="fb-info">
                        <h3>${DATA.facebookOfficial.name}</h3>
                        <p>${DATA.facebookOfficial.username} · ${DATA.facebookOfficial.category}</p>
                        <div class="fb-verified-icon"><i class="fas fa-check-circle"></i> Facebook Verified</div>
                    </div>
                </div>
                <div class="fb-card-body">
                    <div class="fb-stats">
                        <div class="fb-stat"><div class="fb-stat-value">${DATA.facebookOfficial.followers}</div><div class="fb-stat-label">Followers</div></div>
                        <div class="fb-stat"><div class="fb-stat-value" style="color:var(--success);"><i class="fas fa-shield-halved"></i></div><div class="fb-stat-label">Verified</div></div>
                        <div class="fb-stat"><div class="fb-stat-value">100%</div><div class="fb-stat-label">Authentic</div></div>
                        <div class="fb-stat"><div class="fb-stat-value" style="color:var(--success);"><i class="fas fa-lock"></i></div><div class="fb-stat-label">Secure</div></div>
                    </div>
                    <div class="fb-actions">
                        <a href="${DATA.facebookOfficial.url}" target="_blank" rel="noopener" class="btn-facebook"><i class="fab fa-facebook"></i> Visit Official Profile</a>
                        <a href="${DATA.tiktokOfficial.url}" target="_blank" rel="noopener" class="btn-tiktok"><i class="fab fa-tiktok"></i> TikTok</a>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section fake-section" id="fake-accounts" data-animate>
        <div class="container">
            <div class="section-header">
                <div class="section-tag" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.15);color:var(--danger);"><span class="tag-dot" style="background:var(--danger);"></span><span>Warning</span></div>
                <h2 class="section-title" style="color:var(--danger);">Fake Accounts <span style="color:var(--danger);">Detected</span></h2>
                <p class="section-subtitle">${totalFake} fake account${totalFake > 1 ? 's' : ''} found. Report them immediately to protect others.</p>
            </div>
            <div class="fake-grid">
                ${DATA.fakeAccounts.map((a, i) => `
                <div class="fake-card">
                    <div class="fake-card-watermark">FAKE</div>
                    <div class="fake-card-header"><span style="font-weight:700;color:var(--danger);">⚠️ Fake Account #${i+1}</span><span class="fake-card-badge">Dangerous</span></div>
                    <div class="fake-screenshot"><img src="${a.screenshot}" alt="Fake Account Screenshot" loading="lazy" onerror="this.style.display='none'"></div>
                    <div class="fake-detail"><span class="fake-detail-label">Platform</span><span class="fake-detail-value">${a.platform}</span></div>
                    <div class="fake-detail"><span class="fake-detail-label">Username</span><span class="fake-detail-value">${a.username}</span></div>
                    <div class="fake-detail"><span class="fake-detail-label">Reports</span><span class="fake-detail-value">${a.reported}+ reports</span></div>
                    <div class="fake-reason"><i class="fas fa-exclamation-circle"></i> ${a.reason}</div>
                    <div class="fake-actions">
                        <a href="${a.profileUrl}" target="_blank" rel="noopener" class="btn-danger"><i class="fas fa-flag"></i> Report</a>
                        <button class="btn-copy" data-username="${a.username}" onclick="copyUsername(this)"><i class="fas fa-copy"></i> Copy</button>
                    </div>
                </div>`).join('')}
            </div>
        </div>
    </section>

    <section class="section" data-animate>
        <div class="container">
            <div class="section-header">
                <div class="section-tag"><span class="tag-dot"></span><span>Evidence</span></div>
                <h2 class="section-title">Verification <span class="accent">Proof</span></h2>
                <p class="section-subtitle">How to identify the real account vs fake accounts</p>
            </div>
            <div class="evidence-grid">
                <div class="evidence-card">
                    <div class="evidence-icon real"><i class="fas fa-check-circle"></i></div>
                    <h4>Facebook Verified Badge</h4>
                    <p>Real account has the blue verified checkmark from Facebook</p>
                </div>
                <div class="evidence-card">
                    <div class="evidence-icon fake"><i class="fas fa-times-circle"></i></div>
                    <h4>Fake Detection</h4>
                    <p>Fake accounts use similar names and stolen content</p>
                </div>
                <div class="evidence-card">
                    <div class="evidence-icon warning"><i class="fas fa-id-card"></i></div>
                    <h4>Real ID Verification</h4>
                    <p>Official account has proper verification documentation</p>
                </div>
            </div>
        </div>
    </section>

    ${coverSongsHTML}
    ${galleryHTML}
</main>

<footer class="footer">
    <div class="footer-content">
        <div class="footer-social">
            <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener"><i class="fab fa-tiktok"></i></a>
            <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener"><i class="fab fa-facebook"></i></a>
            <a href="#" onclick="toggleChat()"><i class="fas fa-comment"></i></a>
        </div>
        <p>© ${DATA.celebrity.fullName} · Official Verification Hub · All Rights Reserved</p>
    </div>
</footer>

<div class="chat-widget">
    <button class="chat-toggle" onclick="toggleChat()">
        <i class="fas fa-comment-dots"></i>
        <div class="chat-notification" id="chatNotification">0</div>
    </button>
    <div class="chat-window" id="chatWindow">
        <div class="chat-header">
            <h4><i class="fas fa-headset"></i> Live Support</h4>
            <button class="chat-close" onclick="toggleChat()"><i class="fas fa-times"></i></button>
        </div>
        <div id="chatBody"></div>
    </div>
</div>

<audio id="audioPlayer" preload="auto"></audio>

<script>
// Intersection Observer
const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) entry.target.classList.add('animated'); }); }, { threshold: 0.1 });
document.querySelectorAll('[data-animate],[data-animate-left],[data-animate-right]').forEach(el => observer.observe(el));

// Scroll Progress
window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    document.getElementById('scrollProgress').style.width = pct + '%';
});

// Copy Username
function copyUsername(btn) {
    navigator.clipboard.writeText(btn.dataset.username).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; btn.classList.remove('copied'); }, 2000);
    });
}

// ==================== MUSIC PLAYER ====================
const audioPlayer = document.getElementById('audioPlayer');
const songItems = document.querySelectorAll('.song-item');
let currentTrackIndex = -1;
let isPlaying = false;
let playlist = [];
songItems.forEach((item, index) => {
    playlist.push({ index, url: item.getAttribute('data-audio'), title: item.querySelector('.song-title').textContent, artist: item.querySelector('.song-artist').textContent, element: item });
});

function playSong(index) {
    if(index === currentTrackIndex) { togglePlay(); return; }
    currentTrackIndex = index;
    const song = playlist[index];
    audioPlayer.src = song.url;
    audioPlayer.load();
    document.getElementById('currentTitle').textContent = song.title;
    document.getElementById('currentArtist').textContent = song.artist;
    document.getElementById('albumArt').innerHTML = '<i class="fas fa-music"></i>';
    songItems.forEach(item => item.classList.remove('active'));
    song.element.classList.add('active');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('totalTime').textContent = '0:00';
    audioPlayer.play().then(() => { isPlaying = true; updatePlayButton(); document.getElementById('albumArt').classList.add('playing'); }).catch(() => {});
}

function togglePlay() {
    if(currentTrackIndex === -1 && playlist.length > 0) { playSong(0); return; }
    if(isPlaying) { audioPlayer.pause(); isPlaying = false; document.getElementById('albumArt').classList.remove('playing'); }
    else { audioPlayer.play().then(() => { isPlaying = true; document.getElementById('albumArt').classList.add('playing'); }).catch(() => {}); }
    updatePlayButton();
}

function updatePlayButton() { document.getElementById('playIcon').className = isPlaying ? 'fas fa-pause' : 'fas fa-play'; }

function nextTrack() { if(playlist.length) playSong((currentTrackIndex + 1) % playlist.length); }
function previousTrack() { if(playlist.length) playSong(currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1); }

function seekAudio(event) {
    if(!audioPlayer.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    audioPlayer.currentTime = ((event.clientX - rect.left) / rect.width) * audioPlayer.duration;
}

function formatTime(seconds) {
    if(isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
}

audioPlayer.addEventListener('timeupdate', () => {
    if(audioPlayer.duration) {
        document.getElementById('progressFill').style.width = (audioPlayer.currentTime / audioPlayer.duration) * 100 + '%';
        document.getElementById('currentTime').textContent = formatTime(audioPlayer.currentTime);
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    document.getElementById('totalTime').textContent = formatTime(audioPlayer.duration);
    const dEl = document.getElementById('duration-' + currentTrackIndex);
    if(dEl) dEl.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('ended', () => { nextTrack(); });
audioPlayer.addEventListener('error', () => { isPlaying = false; updatePlayButton(); document.getElementById('albumArt').classList.remove('playing'); });
audioPlayer.volume = 0.8;

// Pre-load durations
playlist.forEach((song, index) => {
    const temp = new Audio();
    temp.addEventListener('loadedmetadata', () => {
        const dEl = document.getElementById('duration-' + index);
        if(dEl) dEl.textContent = formatTime(temp.duration);
    });
    temp.src = song.url;
});

// ==================== GALLERY LIGHTBOX ====================
let galleryIdx = 0;
const galleryImgs = document.querySelectorAll('.gallery-image');
const lightbox = document.getElementById('galleryLightbox');
const lightboxImg = document.getElementById('lightboxImage');

function openGalleryLightbox(i) {
    if(!galleryImgs.length) return;
    galleryIdx = i;
    lightboxImg.src = galleryImgs[i].src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeGalleryLightbox() { lightbox.classList.remove('active'); document.body.style.overflow = ''; }
function navigateGallery(dir) {
    if(!galleryImgs.length) return;
    galleryIdx = (galleryIdx + dir + galleryImgs.length) % galleryImgs.length;
    lightboxImg.src = galleryImgs[galleryIdx].src;
}

lightbox.addEventListener('click', e => { if(e.target === lightbox) closeGalleryLightbox(); });
document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeGalleryLightbox();
    if(e.key === 'ArrowLeft' && lightbox.classList.contains('active')) navigateGallery(-1);
    if(e.key === 'ArrowRight' && lightbox.classList.contains('active')) navigateGallery(1);
});

// ==================== CHAT SYSTEM ====================
let chatUser = null;
let ws = null;
let chatMessages = [];

function toggleChat() {
    const window = document.getElementById('chatWindow');
    window.classList.toggle('open');
    if(window.classList.contains('open') && !chatUser) showChatLogin();
    else if(window.classList.contains('open') && chatUser) loadChatMessages();
}

function showChatLogin() {
    document.getElementById('chatBody').innerHTML = '<div class="chat-login"><h4>Start Chat</h4><input type="text" id="chatName" placeholder="Your Name"><input type="email" id="chatEmail" placeholder="Your Email"><button class="btn-login" onclick="startChat()">Start Chatting</button></div>';
}

async function startChat() {
    const name = document.getElementById('chatName').value.trim();
    const email = document.getElementById('chatEmail').value.trim();
    if(!name || !email) return alert('Please fill all fields');
    try {
        const res = await fetch('/chat/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, email}) });
        const data = await res.json();
        if(data.success) { chatUser = data.user; connectWebSocket(); loadChatMessages(); }
        else alert(data.error || 'Login failed');
    } catch(e) { alert('Connection error'); }
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + window.location.host);
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        chatMessages.push(msg);
        renderMessages();
    };
    ws.onclose = () => { setTimeout(connectWebSocket, 3000); };
}

async function loadChatMessages() {
    if(!chatUser) return;
    try {
        const res = await fetch('/chat/messages?userId=' + chatUser._id);
        const data = await res.json();
        chatMessages = data.messages || [];
        renderMessages();
    } catch(e) { console.error('Load messages error:', e); }
}

function renderMessages() {
    const html = chatMessages.map(m => {
        const isSent = chatUser && (m.userId === chatUser._id || m.senderId === chatUser._id);
        const time = new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        return '<div class="chat-message ' + (isSent ? 'sent' : 'received') + '"><div>' + m.message + '</div><div class="msg-time">' + time + '</div></div>';
    }).join('');
    document.getElementById('chatBody').innerHTML = '<div class="chat-messages" id="chatMessages">' + html + '</div><div class="chat-input-area"><input type="text" class="chat-input" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key===\'Enter\')sendMessage()"><button class="chat-send-btn" onclick="sendMessage()"><i class="fas fa-paper-plane"></i></button></div>';
    const msgDiv = document.getElementById('chatMessages');
    if(msgDiv) msgDiv.scrollTop = msgDiv.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    if(!input || !input.value.trim() || !ws) return;
    const msg = { userId: chatUser._id, senderName: chatUser.name, message: input.value.trim(), timestamp: new Date().toISOString(), type: 'text' };
    ws.send(JSON.stringify(msg));
    chatMessages.push(msg);
    renderMessages();
    input.value = '';
}
</script>
</body>
</html>`;
}

// ==================== ADMIN HTML PAGES ====================
function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Montserrat',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.08)}h2{text-align:center;color:#ff6600;margin-bottom:30px}.fg{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#475569;font-weight:600;font-size:.9em}input{width:100%;padding:12px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:1em;outline:none;font-family:inherit}input:focus{border-color:#ff6600}.btn{width:100%;padding:14px;background:#ff6600;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer;font-family:inherit}.btn:hover{background:#cc5500}.error{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center}.back{text-align:center;margin-top:20px}a{color:#64748b;text-decoration:none}a:hover{color:#ff6600}</style></head><body><div class="box"><h2>Admin Login</h2>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="fg"><label>Username</label><input type="text" name="username" required></div><div class="fg"><label>Password</label><input type="password" name="password" required></div><button type="submit" class="btn">Login</button></form><div class="back"><a href="/">← Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="pc"><img src="${p.path}" class="pi"><div class="info">${p.caption?`<p>${p.caption}</p>`:''}<p class="dt">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="del" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Montserrat',sans-serif;background:#f8fafc;color:#0f172a}.hdr{background:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:10px}.hdr h2{color:#ff6600}.hdr a{color:#64748b;text-decoration:none;padding:8px 16px;border:2px solid #e2e8f0;border-radius:8px;margin-left:10px;font-weight:600}.hdr a:hover{background:#ff6600;color:#fff;border-color:#ff6600}.cnt{max-width:1100px;margin:0 auto;padding:30px 20px}.up{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:30px;margin-bottom:30px}.up h3{color:#ff6600;margin-bottom:20px}.fg{margin-bottom:15px}label{display:block;margin-bottom:6px;color:#475569;font-weight:600}input,textarea{width:100%;padding:10px 14px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:8px;font-size:.95em;outline:none;font-family:inherit}input:focus,textarea:focus{border-color:#ff6600}.bu{background:#22c55e;color:#fff;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-family:inherit}.bu:hover{background:#16a34a}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}.pc{background:#fff;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden}.pc:hover{border-color:#ff6600}.pi{width:100%;height:200px;object-fit:cover}.info{padding:12px}.dt{font-size:.75em;color:#94a3b8;margin-top:2px}.del{background:#fef2f2;color:#dc2626;border:2px solid #fecaca;padding:6px 12px;border-radius:6px;cursor:pointer;margin:0 12px 12px;width:calc(100% - 24px);font-weight:600}.del:hover{background:#ef4444;color:#fff}.msg{background:#f0fdf4;border:2px solid #bbf7d0;color:#166534;padding:12px;border-radius:8px;margin-bottom:20px}.err{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px}</style></head><body><div class="hdr"><h2>Admin Panel</h2><div><a href="/">Home</a><a href="/admin/logout">Logout</a></div></div><div class="cnt">${msg?`<div class="msg">${msg}</div>`:''}${err?`<div class="err">${err}</div>`:''}<div class="up"><h3>Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="fg"><label>Select Photo</label><input type="file" name="photo" accept="image/*" required></div><div class="fg"><label>Caption</label><input type="text" name="caption"></div><button type="submit" class="bu">Upload</button></form></div><h3 style="margin-bottom:20px">Gallery (${photos.length})</h3>${photos.length?`<div class="grid">${phtml}</div>`:'<p style="color:#94a3b8;text-align:center;padding:40px">No photos</p>'}</div></body></html>`;
}

// ==================== HTTP SERVER ====================
const server = http.createServer(async (req, res) => {
    try {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const cookies = parseCookies(req.headers.cookie);

        // Static assets
        if (pathname.startsWith('/assets/')) {
            const assetPath = path.join(__dir, decodeURIComponent(pathname));
            if (!assetPath.startsWith(ASSETS_DIR)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            if (fs.existsSync(assetPath)) {
                const ext = path.extname(assetPath).toLowerCase();
                const ct = MIME_TYPES[ext] || 'application/octet-stream';
                const stat = fs.statSync(assetPath);
                res.writeHead(200, {
                    'Content-Type': ct,
                    'Content-Length': stat.size,
                    'Cache-Control': 'public, max-age=86400',
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(assetPath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
            return;
        }

        // Admin routes
        if (pathname === '/admin' && req.method === 'GET') {
            const s = getSession(cookies.sessionId);
            if (s) {
                const p = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(getAdminPanelHTML(p));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(getAdminLoginHTML());
            return;
        }

        if (pathname === '/admin/login' && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const params = new URLSearchParams(body);
                    if (await verifyAdmin(params.get('username'), params.get('password'))) {
                        const sid = createSession(params.get('username'));
                        res.writeHead(302, {
                            'Location': '/admin',
                            'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                        res.end(getAdminLoginHTML('Invalid credentials'));
                    }
                } catch (e) {
                    res.writeHead(500);
                    res.end('Server Error');
                }
            });
            return;
        }

        if (pathname === '/admin/logout') {
            sessions.delete(cookies.sessionId);
            res.writeHead(302, {
                'Location': '/admin',
                'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0'
            });
            res.end();
            return;
        }

        if (pathname === '/admin/upload' && req.method === 'POST') {
            if (!getSession(cookies.sessionId)) {
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
                return;
            }
            const form = new formidable.IncomingForm({
                uploadDir: GALLERY_DIR,
                keepExtensions: true,
                maxFileSize: 10 * 1024 * 1024
            });
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, '', 'Upload error'));
                    return;
                }
                const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
                if (!pf || !pf.originalFilename) {
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, '', 'No file'));
                    return;
                }
                const ext = path.extname(pf.originalFilename).toLowerCase();
                if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, '', 'Invalid format'));
                    return;
                }
                const fn = Date.now() + '_' + pf.originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
                try {
                    fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                    await savePhoto({
                        path: '/assets/gallery/' + fn,
                        caption: fields.caption ? (Array.isArray(fields.caption) ? fields.caption[0] : fields.caption) : ''
                    });
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, 'Uploaded!'));
                } catch (e) {
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, '', 'Save error'));
                }
            });
            return;
        }

        if (pathname === '/admin/delete' && req.method === 'POST') {
            if (!getSession(cookies.sessionId)) {
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
                return;
            }
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const params = new URLSearchParams(body);
                    if (dbConnected && db) {
                        const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(params.get('photoId')) });
                        if (photo) {
                            const fp = path.join(__dir, photo.path);
                            if (fs.existsSync(fp)) fs.unlinkSync(fp);
                        }
                        await deletePhoto(params.get('photoId'));
                    }
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, 'Deleted'));
                } catch (e) {
                    const p = await getGalleryPhotos();
                    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                    res.end(getAdminPanelHTML(p, '', 'Delete error'));
                }
            });
            return;
        }

        // Chat API routes
        if (pathname === '/chat/login' && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const { name, email } = JSON.parse(body);
                    if (!dbConnected || !db) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, user: { _id: 'guest_' + Date.now(), name, email } }));
                        return;
                    }
                    let user = await db.collection('chat_users').findOne({ email });
                    if (!user) {
                        const result = await db.collection('chat_users').insertOne({ name, email, createdAt: new Date() });
                        user = { _id: result.insertedId.toString(), name, email };
                    } else {
                        user = { _id: user._id.toString(), name: user.name, email: user.email };
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, user }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Server error' }));
                }
            });
            return;
        }

        if (pathname === '/chat/messages' && req.method === 'GET') {
            const userId = parsedUrl.query.userId;
            if (!dbConnected || !db) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ messages: [] }));
                return;
            }
            try {
                const messages = await db.collection('chat_messages').find({
                    $or: [{ userId }, { senderId: userId }]
                }).sort({ timestamp: 1 }).limit(100).toArray();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ messages: messages.map(m => ({ ...m, _id: m._id.toString() })) }));
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ messages: [] }));
            }
            return;
        }

        // Main page
        if (pathname === '/' || pathname === '/index.html') {
            const photos = await getGalleryPhotos();
            res.writeHead(200, {
                'Content-Type': 'text/html;charset=utf-8',
                'Cache-Control': 'public, max-age=3600'
            });
            res.end(getMainHTML(photos));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:100px;color:#ff6600}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>`);
    } catch (err) {
        console.error('Request error:', err.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end('<h1>500 Internal Server Error</h1>');
        }
    }
});

// ==================== STARTUP ====================
async function start() {
    console.log('='.repeat(50));
    console.log('🚀 Baiilla Maach Verification Hub');
    console.log('='.repeat(50));
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`💾 MongoDB: ${MONGO_URI ? 'Configured' : 'Not configured'}`);
    
    // Connect to database
    await connectDB();
    
    // Start HTTP server
    server.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📍 Local: http://localhost:${PORT}`);
        console.log('='.repeat(50));
    });
}

// Handle port in use
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', e.message);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        if (mongoClient) mongoClient.close();
        console.log('✅ Server closed');
        process.exit(0);
    });
});

start();

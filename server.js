// ============================================
// Baiilla Maach Verification Hub - Render Free
// ============================================

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    if (err.code === 'EADDRINUSE') process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// ============================================
// Dependencies
// ============================================
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db = null;
let mongoClient = null;

// Safe dependency loading
let MongoClient, ObjectId, formidable, bcrypt;
try { 
    const mongodb = require('mongodb');
    MongoClient = mongodb.MongoClient; 
    ObjectId = mongodb.ObjectId;
    console.log('✅ MongoDB loaded');
} catch(e) { 
    console.log('⚠️ MongoDB not available'); 
}
try { formidable = require('formidable'); console.log('✅ Formidable loaded'); } 
catch(e) { console.log('⚠️ Formidable not available'); }
try { bcrypt = require('bcryptjs'); console.log('✅ Bcrypt loaded'); } 
catch(e) { console.log('⚠️ Bcrypt not available'); }

// ============================================
// Directory Setup
// ============================================
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch(e) {}
});

// ============================================
// Asset References
// ============================================
const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    fbProfile: "/assets/fb_profile.jpg",
    official: "/assets/orginalss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect .png",
    realId: "/assets/real-id-ss.png",
    checkMark: "/assets/check-mark.png",
    communication: "/assets/communication.png",
    flag: "/assets/flag.png",
    microphone: "/assets/microphone-in-hand.gif",
    report: "/assets/report.png",
    socialMedia: "/assets/social-media.png",
    tiktokIcon: "/assets/tiktokicon.png"
};

// ============================================
// Database Functions
// ============================================
async function connectDB() {
    if (!MongoClient) return false;
    try {
        mongoClient = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        if (bcrypt) {
            const admins = db.collection('admin_users');
            const exists = await admins.findOne({ username: 'admin' });
            if (!exists) {
                await admins.insertOne({ 
                    username: 'admin', 
                    password: await bcrypt.hash('admin123', 10), 
                    createdAt: new Date() 
                });
            }
        }
        
        console.log('📦 MongoDB connected');
        return true;
    } catch (e) {
        console.log('⚠️ MongoDB connection failed:', e.message);
        return false;
    }
}

async function getGalleryPhotos() {
    if (!db) return [];
    try { 
        return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); 
    } catch (e) { return []; }
}

async function savePhoto(data) {
    if (!db) return null;
    try {
        return await db.collection('gallery_photos').insertOne({ ...data, uploadedAt: new Date() });
    } catch (e) { return null; }
}

async function deletePhoto(id) {
    if (!db) return null;
    try {
        return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
    } catch (e) { return null; }
}

async function saveChatUser(userData) {
    if (!db) return null;
    try {
        const users = db.collection('chat_users');
        const existing = await users.findOne({ email: userData.email });
        if (existing) {
            await users.updateOne({ email: userData.email }, { $set: { lastActive: new Date() } });
            return existing;
        }
        const result = await users.insertOne({ ...userData, createdAt: new Date(), lastActive: new Date() });
        return { _id: result.insertedId, ...userData };
    } catch (e) { return null; }
}

async function saveChatMessage(data) {
    if (!db) return null;
    try {
        return await db.collection('chat_messages').insertOne({ ...data, timestamp: new Date() });
    } catch (e) { return null; }
}

async function getChatMessages(userEmail) {
    if (!db) return [];
    try {
        return await db.collection('chat_messages')
            .find({ $or: [{ userEmail: userEmail }, { toEmail: userEmail }] })
            .sort({ timestamp: 1 })
            .toArray();
    } catch (e) { return []; }
}

async function getAllChatUsers() {
    if (!db) return [];
    try {
        return await db.collection('chat_users').find({}).sort({ lastActive: -1 }).toArray();
    } catch (e) { return []; }
}

async function verifyAdmin(username, password) {
    if (!db) return username === 'admin' && password === 'admin123';
    if (!bcrypt) return username === 'admin' && password === 'admin123';
    try {
        const admin = await db.collection('admin_users').findOne({ username });
        if (!admin) return false;
        return await bcrypt.compare(password, admin.password);
    } catch (e) { return false; }
}

// ============================================
// Session Management
// ============================================
const sessions = new Map();
function createSession(username) { 
    const id = crypto.randomBytes(32).toString('hex'); 
    sessions.set(id, { username, createdAt: Date.now() }); 
    setTimeout(() => sessions.delete(id), 7200000); 
    return id; 
}
function getSession(id) { 
    const s = sessions.get(id); 
    if (!s) return null; 
    if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } 
    return s; 
}
function parseCookies(header) { 
    const cookies = {}; 
    if (header) {
        header.split(';').forEach(cookie => { 
            const parts = cookie.split('='); 
            if (parts[0] && parts[0].trim()) {
                cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : ''; 
            }
        }); 
    }
    return cookies; 
}

// ============================================
// Music Functions
// ============================================
function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioFiles = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
        });
        return audioFiles.map((file, index) => {
            const baseName = path.basename(file, path.extname(file));
            const displayName = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
            return {
                id: `track_${index}`,
                title: displayName || `Track ${index + 1}`,
                artist: 'Baiilla Maach',
                audioUrl: `/assets/covermusic/${encodeURIComponent(file)}`,
                fileName: file
            };
        });
    } catch (e) { return []; }
}

// ============================================
// Data
// ============================================
const CELEBRITY_DATA = {
    name: "Baiilla Maach",
    fullName: "Baiilla Maach Official",
    photo: IMAGES.profile,
    fbPhoto: IMAGES.fbProfile,
    bio: "Official Entertainment Profile | Verified Creator",
    username: "@baiillamaach_official",
    fbUsername: "@BaiillaMaachOfficial",
    tiktokUrl: "https://tiktok.com/@baiillamaach_official",
    fbUrl: "https://www.facebook.com/profile.php?id=61575202118828",
    fakeAccounts: [
        { 
            platform: "TikTok", 
            username: "@baiilla_mach", 
            profileUrl: "https://tiktok.com/@baiilla_mach", 
            screenshot: IMAGES.danger, 
            reason: "Copies official logo and content to deceive followers." 
        },
        { 
            platform: "TikTok", 
            username: "@hammad_fams0", 
            profileUrl: "https://tiktok.com/@hammad_fams0", 
            screenshot: IMAGES.fraud, 
            reason: "Uses official name and photo to mislead followers." 
        }
    ]
};

// ============================================
// HTML Templates
// ============================================
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    
    let musicHTML = '';
    if (coverSongs.length > 0) {
        musicHTML = `
        <section style="padding:80px 20px;background:#fff;" data-animate>
            <div style="max-width:800px;margin:0 auto;text-align:center;">
                <h2 style="font-size:2em;color:#1a1a2e;margin-bottom:10px;">🎵 Official Cover Songs</h2>
                <p style="color:#666;margin-bottom:30px;">Original covers by Baiilla Maach</p>
                <div style="background:#1a1a2e;border-radius:16px;padding:30px;color:#fff;">
                    <img src="${IMAGES.profile}" style="width:100px;height:100px;border-radius:50%;margin-bottom:15px;">
                    <h3 id="trackTitle" style="margin-bottom:5px;">Select a Track</h3>
                    <p id="trackArtist" style="color:#ff6600;">Baiilla Maach</p>
                    <div style="display:flex;justify-content:center;gap:15px;margin:15px 0;">
                        <button onclick="prevTrack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.2em;">⏮</button>
                        <button id="playBtn" onclick="togglePlay()" style="background:#ff6600;border:none;color:#fff;width:56px;height:56px;border-radius:50%;cursor:pointer;font-size:1.5em;">▶️</button>
                        <button onclick="nextTrack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.2em;">⏭</button>
                    </div>
                    <div style="background:rgba(255,255,255,0.2);height:4px;border-radius:2px;cursor:pointer;margin:10px 0;" onclick="seekTrack(event)">
                        <div id="progressBar" style="background:#ff6600;height:100%;border-radius:2px;width:0%;"></div>
                    </div>
                    <div style="font-size:0.85em;"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
                </div>
                <div style="max-height:300px;overflow-y:auto;margin-top:10px;">
                    ${coverSongs.map((song, i) => `
                    <div onclick="playTrack(${i})" style="display:flex;align-items:center;padding:12px;cursor:pointer;border-bottom:1px solid #eee;gap:12px;" class="playlist-item" data-index="${i}">
                        <span style="font-weight:700;color:#999;min-width:30px;">${String(i+1).padStart(2,'0')}</span>
                        <span style="flex:1;text-align:left;">${song.title}</span>
                    </div>`).join('')}
                </div>
            </div>
        </section>`;
    }
    
    let galleryHTML = '';
    if (galleryPhotos.length > 0) {
        galleryHTML = `
        <section style="padding:80px 20px;background:#f8f9fa;" data-animate>
            <div style="max-width:1200px;margin:0 auto;">
                <h2 style="font-size:2em;color:#1a1a2e;text-align:center;margin-bottom:10px;">📸 Official Gallery</h2>
                <p style="text-align:center;color:#666;margin-bottom:30px;">Verified photos from Baiilla Maach</p>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;">
                    ${galleryPhotos.map((p, i) => `
                    <div onclick="openLightbox(${i})" style="border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);cursor:pointer;transition:transform 0.3s;">
                        <div style="height:200px;overflow:hidden;">
                            <img src="${p.path}" style="width:100%;height:100%;object-fit:cover;">
                        </div>
                        ${p.caption ? `<p style="padding:10px;text-align:center;background:#fff;">${p.caption}</p>` : ''}
                    </div>`).join('')}
                </div>
            </div>
        </section>
        <div id="lightbox" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:2000;align-items:center;justify-content:center;" onclick="closeLightbox()">
            <span style="position:absolute;top:20px;right:20px;color:#fff;font-size:2em;cursor:pointer;">✕</span>
            <button onclick="event.stopPropagation();changeLightbox(-1)" style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);border:none;color:#fff;width:50px;height:50px;border-radius:50%;font-size:1.5em;cursor:pointer;">❮</button>
            <img id="lightboxImg" src="" style="max-width:90%;max-height:90%;border-radius:8px;" onclick="event.stopPropagation();">
            <button onclick="event.stopPropagation();changeLightbox(1)" style="position:absolute;right:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);border:none;color:#fff;width:50px;height:50px;border-radius:50%;font-size:1.5em;cursor:pointer;">❯</button>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ff6600">
<title>${CELEBRITY_DATA.fullName} | Official Verification Hub</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#fafafa; color:#333; overflow-x:hidden; }

/* Header */
.header { background:rgba(255,255,255,0.95); backdrop-filter:blur(20px); border-bottom:1px solid #e0e0e0; padding:12px 20px; position:sticky; top:0; z-index:1000; display:flex; justify-content:space-between; align-items:center; }
.logo { display:flex; align-items:center; gap:10px; }
.logo img { width:45px; height:45px; border-radius:50%; border:2px solid #ff6600; }
.logo span { font-weight:700; color:#1a1a2e; font-size:1.1em; }
.header-btns { display:flex; gap:10px; }
.btn-chat { background:linear-gradient(135deg, #00c853, #00e676); color:#fff; padding:8px 16px; border-radius:50px; text-decoration:none; font-weight:600; font-size:0.9em; }
.btn-admin { background:#fff; color:#ff6600; padding:8px 16px; border-radius:50px; text-decoration:none; font-weight:600; border:2px solid #ff6600; font-size:0.9em; }

/* Hero */
.hero { background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding:60px 20px; text-align:center; color:#fff; position:relative; overflow:hidden; }
.hero::before { content:''; position:absolute; width:200%; height:200%; top:-50%; left:-50%; background:radial-gradient(circle, rgba(255,102,0,0.15) 0%, transparent 60%); animation:rotate 30s linear infinite; }
@keyframes rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
.hero-content { position:relative; z-index:2; }
.hero img { width:140px; height:140px; border-radius:50%; border:4px solid #ff6600; margin-bottom:15px; }
.hero h1 { font-size:2.5em; font-weight:800; margin-bottom:5px; background:linear-gradient(135deg, #fff, #ff8533); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hero .username { font-size:1.1em; opacity:0.9; margin-bottom:5px; }
.hero .bio { opacity:0.8; margin-bottom:15px; }
.verified-badge { display:inline-flex; align-items:center; gap:8px; background:rgba(0,200,83,0.2); padding:10px 20px; border-radius:50px; border:1px solid rgba(0,200,83,0.3); margin-bottom:20px; }
.verified-badge span { font-weight:600; color:#00e676; }
.social-btns { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.social-btn { padding:10px 24px; border-radius:50px; text-decoration:none; font-weight:600; color:#fff; transition:transform 0.3s; }
.social-btn.tiktok { background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.2); }
.social-btn.facebook { background:rgba(24,119,242,0.6); border:1px solid rgba(255,255,255,0.2); }
.social-btn:hover { transform:translateY(-2px); }

/* Sections */
.section { padding:60px 20px; }
.container { max-width:1200px; margin:0 auto; }
.section-title { font-size:2em; color:#1a1a2e; margin-bottom:10px; }
.section-subtitle { color:#666; margin-bottom:30px; }

/* Official Card */
.official-card { background:#fff; border-radius:16px; padding:30px; display:grid; grid-template-columns:1fr 1fr; gap:24px; border:2px solid #c8e6c9; box-shadow:0 4px 20px rgba(0,0,0,0.08); margin-bottom:20px; }
.info-row { display:flex; align-items:center; gap:10px; padding:10px; background:#f5f5f5; border-radius:8px; margin-bottom:10px; }
.preview-card { background:linear-gradient(135deg, #667eea, #764ba2); padding:24px; border-radius:16px; color:#fff; text-align:center; }
.preview-card img { width:80px; height:80px; border-radius:50%; border:3px solid #fff; margin-bottom:12px; }
.btn-follow { display:inline-block; background:#fff; color:#667eea; padding:10px 24px; border-radius:50px; text-decoration:none; font-weight:600; margin-top:10px; }

/* Fake Cards */
.fake-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:24px; }
.fake-card { background:#fff; border-radius:16px; overflow:hidden; border:2px solid #ffcdd2; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
.fake-card img { width:100%; height:200px; object-fit:cover; }
.fake-content { padding:20px; }
.fake-content h3 { font-size:1.2em; margin-bottom:8px; color:#1a1a2e; }
.fake-content .platform { color:#ff6600; font-weight:600; margin-bottom:8px; }
.fake-content p { color:#666; margin-bottom:12px; line-height:1.6; }
.btn-report { display:inline-flex; align-items:center; gap:6px; background:#ff1744; color:#fff; padding:8px 16px; border-radius:50px; text-decoration:none; font-weight:600; }

/* Features */
.features-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-top:20px; }
.feature-card { background:#fff; padding:24px; border-radius:12px; text-align:center; box-shadow:0 4px 6px rgba(0,0,0,0.07); }
.feature-card img { width:48px; margin-bottom:12px; }
.feature-card h3 { font-size:1.1em; margin-bottom:6px; color:#1a1a2e; }
.feature-card p { color:#666; font-size:0.9em; }

/* Proof */
.proof-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:20px; }
.proof-card { background:#f8f9fa; border-radius:12px; padding:20px; text-align:center; border:1px solid #e0e0e0; }
.proof-card img { max-width:100%; border-radius:8px; margin-bottom:10px; }

/* Footer */
.footer { background:#1a1a2e; color:#fff; padding:40px 20px; text-align:center; }
.footer-content { max-width:1200px; margin:0 auto 30px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:30px; text-align:left; }
.footer h3 { color:#ff6600; margin-bottom:15px; }
.footer p, .footer a { color:rgba(255,255,255,0.7); line-height:1.8; }
.footer a { text-decoration:none; }
.footer-bottom { border-top:1px solid rgba(255,255,255,0.1); padding-top:20px; color:rgba(255,255,255,0.5); font-size:0.9em; }

/* Animations */
[data-animate] { opacity:0; transform:translateY(30px); transition:all 0.6s; }
[data-animate].animated { opacity:1; transform:translateY(0); }

/* Playlist active */
.playlist-item.active { background:#fff3e0; border-left:3px solid #ff6600; }

@media (max-width: 768px) {
    .hero h1 { font-size:1.8em; }
    .official-card { grid-template-columns:1fr; }
    .header-btns { gap:6px; }
    .btn-chat, .btn-admin { padding:6px 12px; font-size:0.8em; }
}
</style>
</head>
<body>

<header class="header">
    <div class="logo">
        <img src="${IMAGES.profile}" alt="Logo">
        <span>${CELEBRITY_DATA.name}</span>
    </div>
    <div class="header-btns">
        <a href="/chat" class="btn-chat">💬 Chat</a>
        <a href="/admin" class="btn-admin">🔐 Admin</a>
    </div>
</header>

<section class="hero">
    <div class="hero-content">
        <img src="${IMAGES.profile}" alt="${CELEBRITY_DATA.name}">
        <h1>${CELEBRITY_DATA.fullName}</h1>
        <p class="username">${CELEBRITY_DATA.username}</p>
        <p class="bio">${CELEBRITY_DATA.bio}</p>
        <div class="verified-badge">
            <span>✅ VERIFIED OFFICIAL ACCOUNT</span>
        </div>
        <div class="social-btns">
            <a href="${CELEBRITY_DATA.tiktokUrl}" target="_blank" class="social-btn tiktok">🎵 TikTok</a>
            <a href="${CELEBRITY_DATA.fbUrl}" target="_blank" class="social-btn facebook">📘 Facebook</a>
        </div>
    </div>
</section>

<section class="section" style="background:#fff;" data-animate>
    <div class="container">
        <h2 class="section-title" style="text-align:center;">Why Trust This Hub?</h2>
        <p class="section-subtitle" style="text-align:center;">Everything you need to verify the authentic Baiilla Maach</p>
        <div class="features-grid">
            <div class="feature-card">
                <img src="${IMAGES.communication}" alt="Chat">
                <h3>Direct Chat</h3>
                <p>Chat directly with verified account</p>
            </div>
            <div class="feature-card">
                <img src="${IMAGES.report}" alt="Report">
                <h3>Report Fakes</h3>
                <p>Help us identify fake accounts</p>
            </div>
            <div class="feature-card">
                <img src="${IMAGES.socialMedia}" alt="Social">
                <h3>Social Links</h3>
                <p>All official social media links</p>
            </div>
            <div class="feature-card">
                <img src="${IMAGES.flag}" alt="Badge">
                <h3>Verified Badge</h3>
                <p>Look for verification before following</p>
            </div>
        </div>
    </div>
</section>

<section class="section" style="background:#f8fff8;" data-animate>
    <div class="container">
        <h2 class="section-title" style="text-align:center;">✅ Official Verified Account</h2>
        <p class="section-subtitle" style="text-align:center;">The ONLY authentic Baiilla Maach accounts</p>
        <div class="official-card">
            <div>
                <h3 style="margin-bottom:20px;">Verified Details</h3>
                <div class="info-row">
                    <span>✅</span>
                    <div><strong>Status:</strong> <span style="color:#00c853;">● Active & Verified</span></div>
                </div>
                <div class="info-row">
                    <span>📱</span>
                    <div><strong>TikTok:</strong> ${CELEBRITY_DATA.username}</div>
                </div>
                <div class="info-row">
                    <span>📘</span>
                    <div><strong>Facebook:</strong> ${CELEBRITY_DATA.fbUsername}</div>
                </div>
                <div class="info-row">
                    <span>🆔</span>
                    <div><strong>Identity:</strong> <span style="color:#00c853;">Real ID Confirmed</span></div>
                </div>
            </div>
            <div>
                <div class="preview-card">
                    <img src="${IMAGES.fbProfile}" alt="FB Profile">
                    <p style="font-size:1.2em;font-weight:700;">Baiilla Maach</p>
                    <p style="opacity:0.9;">${CELEBRITY_DATA.fbUsername}</p>
                    <a href="${CELEBRITY_DATA.fbUrl}" target="_blank" class="btn-follow">Follow on Facebook</a>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section" style="background:#fff5f5;" data-animate>
    <div class="container">
        <h2 class="section-title" style="text-align:center;">⚠️ Beware of Fake Accounts</h2>
        <p class="section-subtitle" style="text-align:center;">${CELEBRITY_DATA.fakeAccounts.length} fake accounts detected - Report them immediately</p>
        <div class="fake-grid">
            ${CELEBRITY_DATA.fakeAccounts.map(acc => `
            <div class="fake-card">
                <img src="${acc.screenshot}" alt="Fake Account">
                <div class="fake-content">
                    <h3>${acc.username}</h3>
                    <p class="platform">📍 ${acc.platform}</p>
                    <p>${acc.reason}</p>
                    <a href="${acc.profileUrl}" target="_blank" class="btn-report">
                        <img src="${IMAGES.report}" width="20" alt=""> Report This Account
                    </a>
                </div>
            </div>`).join('')}
        </div>
    </div>
</section>

<section class="section" style="background:#fff;" data-animate>
    <div class="container">
        <h2 class="section-title" style="text-align:center;">🔒 Identity Proof</h2>
        <p class="section-subtitle" style="text-align:center;">Evidence of official verification</p>
        <div class="proof-grid">
            <div class="proof-card">
                <img src="${IMAGES.realId}" alt="Real ID">
                <p style="font-weight:600;">Real ID Verification</p>
            </div>
            <div class="proof-card">
                <img src="${IMAGES.fakeDetect}" alt="Fake Detection">
                <p style="font-weight:600;">Fake Account Detection</p>
            </div>
            <div class="proof-card">
                <img src="${IMAGES.microphone}" alt="Voice Note">
                <p style="font-weight:600;">Real Voice Note</p>
            </div>
        </div>
    </div>
</section>

${musicHTML}
${galleryHTML}

<footer class="footer">
    <div class="footer-content">
        <div>
            <h3>About This Hub</h3>
            <p>This is the ONLY official verification hub for Baiilla Maach. We help fans identify authentic accounts and avoid scams.</p>
        </div>
        <div>
            <h3>Quick Links</h3>
            <p><a href="${CELEBRITY_DATA.tiktokUrl}" target="_blank">Official TikTok</a></p>
            <p><a href="${CELEBRITY_DATA.fbUrl}" target="_blank">Official Facebook</a></p>
            <p><a href="/chat">Support Chat</a></p>
        </div>
        <div>
            <h3>Contact</h3>
            <p>Use our support chat for any verification queries or to report fake accounts.</p>
        </div>
    </div>
    <div class="footer-bottom">
        <p>© 2024 ${CELEBRITY_DATA.fullName}. All Rights Reserved.</p>
        <p style="margin-top:8px;">⚠️ This is the only official verification hub</p>
    </div>
</footer>

<audio id="audioPlayer" preload="metadata"></audio>

<script>
const tracks = ${JSON.stringify(coverSongs)};
const galleryPhotos = ${JSON.stringify(galleryPhotos)};
let currentTrack = 0;
let isPlaying = false;
const audio = document.getElementById('audioPlayer');

if (tracks.length > 0) {
    audio.src = tracks[0].audioUrl;
    audio.load();
}

function playTrack(index) {
    if (index >= 0 && index < tracks.length) {
        currentTrack = index;
        audio.src = tracks[index].audioUrl;
        audio.load();
        audio.play();
        isPlaying = true;
        updateUI();
    }
}

function togglePlay() {
    if (audio.paused) { audio.play(); isPlaying = true; }
    else { audio.pause(); isPlaying = false; }
    updateUI();
}

function prevTrack() { playTrack((currentTrack - 1 + tracks.length) % tracks.length); }
function nextTrack() { playTrack((currentTrack + 1) % tracks.length); }

function updateUI() {
    document.getElementById('playBtn').textContent = isPlaying ? '⏸️' : '▶️';
    if (tracks[currentTrack]) {
        document.getElementById('trackTitle').textContent = tracks[currentTrack].title;
        document.getElementById('trackArtist').textContent = tracks[currentTrack].artist;
    }
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        item.classList.toggle('active', i === currentTrack);
    });
}

audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100 || 0;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
    document.getElementById('duration').textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', nextTrack);

function seekTrack(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
}

// Lightbox
let currentLightbox = 0;
function openLightbox(index) {
    currentLightbox = index;
    document.getElementById('lightboxImg').src = galleryPhotos[index].path;
    document.getElementById('lightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = 'auto';
}
function changeLightbox(dir) {
    currentLightbox = (currentLightbox + dir + galleryPhotos.length) % galleryPhotos.length;
    document.getElementById('lightboxImg').src = galleryPhotos[currentLightbox].path;
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeLightbox(-1);
    if (e.key === 'ArrowRight') changeLightbox(1);
});

// Scroll animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
</script>
</body>
</html>`;
}

function getChatHTML(userData = null) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Support Chat | Baiilla Maach</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:linear-gradient(135deg, #1a1a2e, #16213e); color:#fff; min-height:100vh; }
.chat-container { max-width:800px; margin:0 auto; height:100vh; display:flex; flex-direction:column; background:rgba(255,255,255,0.05); backdrop-filter:blur(10px); }
.chat-header { background:rgba(255,102,0,0.2); padding:15px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.1); }
.chat-header-left { display:flex; align-items:center; gap:12px; }
.chat-avatar { width:40px; height:40px; border-radius:50%; border:2px solid #ff6600; }
.chat-status { font-size:0.85em; color:#00c853; }
.back-btn { background:rgba(255,255,255,0.1); color:#fff; padding:8px 16px; border-radius:20px; text-decoration:none; font-size:0.9em; }
.chat-messages { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:10px; }
.message { max-width:70%; padding:12px 16px; border-radius:18px; word-wrap:break-word; }
.message.sent { background:#ff6600; align-self:flex-end; border-bottom-right-radius:4px; }
.message.received { background:rgba(255,255,255,0.1); align-self:flex-start; border-bottom-left-radius:4px; }
.message-time { font-size:0.7em; opacity:0.7; margin-top:4px; }
.message img { max-width:200px; border-radius:12px; cursor:pointer; }
.message audio { max-width:200px; }
.chat-input-area { padding:15px 20px; background:rgba(0,0,0,0.3); border-top:1px solid rgba(255,255,255,0.1); }
.input-row { display:flex; gap:10px; align-items:center; }
.message-input { flex:1; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:12px; border-radius:25px; font-size:0.95em; outline:none; }
.send-btn { background:#ff6600; border:none; color:#fff; width:45px; height:45px; border-radius:50%; cursor:pointer; font-size:1.2em; }
.login-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; z-index:1000; }
.login-form { background:#fff; padding:30px; border-radius:15px; width:90%; max-width:400px; color:#333; }
.login-form h2 { margin-bottom:20px; color:#1a1a2e; }
.form-group { margin-bottom:15px; }
.form-group label { display:block; margin-bottom:5px; font-weight:500; }
.form-group input { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; }
.submit-btn { width:100%; background:#ff6600; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer; }
</style>
</head>
<body>
<div class="chat-container">
    <div class="chat-header">
        <div class="chat-header-left">
            <img src="/assets/tiktok_video_Aj2NO.jpeg" class="chat-avatar">
            <div>
                <div style="font-weight:600;">Baiilla Maach Support</div>
                <div class="chat-status">● Online</div>
            </div>
        </div>
        <a href="/" class="back-btn">← Back</a>
    </div>
    <div class="chat-messages" id="chatMessages">
        <div class="message received">Welcome to Baiilla Maach Official Support! How can we help you?<div class="message-time">Just now</div></div>
    </div>
    <div class="chat-input-area">
        <div class="input-row">
            <input type="file" id="imageInput" accept="image/*" style="display:none;">
            <button onclick="document.getElementById('imageInput').click()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;">📎</button>
            <input type="text" class="message-input" id="messageInput" placeholder="Type your message...">
            <button class="send-btn" onclick="sendMessage()">➤</button>
        </div>
    </div>
</div>
${!userData ? `
<div class="login-overlay" id="loginOverlay">
    <div class="login-form">
        <h2>Start Chat Support</h2>
        <form onsubmit="login(event)">
            <div class="form-group"><label>Your Name</label><input type="text" id="userName" required></div>
            <div class="form-group"><label>Email or Phone</label><input type="text" id="userEmail" required></div>
            <button type="submit" class="submit-btn">Start Chat</button>
        </form>
    </div>
</div>` : ''}
<script>
async function login(e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    try {
        const res = await fetch('/chat/login', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name, email})
        });
        if(res.ok) {
            document.getElementById('loginOverlay').style.display='none';
            loadMessages();
        }
    } catch(err) { console.error(err); }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const msg = input.value.trim();
    if(!msg) return;
    try {
        await fetch('/chat/send', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({message:msg, type:'text'})
        });
        input.value = '';
        loadMessages();
    } catch(err) { console.error(err); }
}

async function loadMessages() {
    try {
        const res = await fetch('/chat/messages');
        const msgs = await res.json();
        document.getElementById('chatMessages').innerHTML = msgs.map(m => 
            '<div class="message ' + (m.isAdmin ? 'received' : 'sent') + '">' +
            (m.type === 'image' ? '<img src="'+m.content+'" onclick="window.open(this.src)">' :
             m.type === 'audio' ? '<audio controls src="'+m.content+'"></audio>' : m.content) +
            '<div class="message-time">'+new Date(m.timestamp).toLocaleTimeString()+'</div></div>'
        ).join('');
    } catch(err) { console.error(err); }
}

document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
        await fetch('/chat/upload-image', {method:'POST', body:fd});
        loadMessages();
    } catch(err) { console.error(err); }
});

document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

setInterval(loadMessages, 3000);
${userData ? 'loadMessages();' : ''}
</script>
</body>
</html>`;
}

function getAdminHTML(chatUsers = []) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Baiilla Maach</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f5; }
.admin-container { display:grid; grid-template-columns:250px 1fr; min-height:100vh; }
.sidebar { background:#1a1a2e; color:#fff; padding:20px; }
.sidebar h2 { color:#ff6600; margin-bottom:30px; }
.nav-item { padding:12px; margin-bottom:8px; border-radius:8px; cursor:pointer; }
.nav-item:hover, .nav-item.active { background:rgba(255,102,0,0.2); }
.main-content { padding:30px; }
.users-list { background:#fff; border-radius:12px; padding:20px; margin-bottom:20px; }
.user-item { padding:12px; border-bottom:1px solid #eee; cursor:pointer; display:flex; justify-content:space-between; }
.user-item:hover { background:#f8f9fa; }
.chat-panel { background:#fff; border-radius:12px; height:calc(100vh - 200px); display:flex; flex-direction:column; }
.chat-header { padding:15px 20px; background:#ff6600; color:#fff; border-radius:12px 12px 0 0; }
.chat-messages { flex:1; overflow-y:auto; padding:20px; }
.chat-input { padding:15px 20px; border-top:1px solid #eee; display:flex; gap:10px; }
.chat-input input { flex:1; padding:10px; border:1px solid #ddd; border-radius:20px; }
.chat-input button { background:#ff6600; color:#fff; border:none; padding:10px 20px; border-radius:20px; cursor:pointer; font-weight:600; }
.logout-btn { display:block; background:#ff1744; color:#fff; text-align:center; padding:10px; border-radius:20px; text-decoration:none; margin-top:auto; }
</style>
</head>
<body>
<div class="admin-container">
    <div class="sidebar">
        <h2>Admin Panel</h2>
        <div class="nav-item active">💬 Chat Support</div>
        <div class="nav-item">📸 Gallery</div>
        <div class="nav-item">🎵 Music</div>
        <a href="/admin/logout" class="logout-btn">Logout</a>
    </div>
    <div class="main-content">
        <div class="users-list">
            <h3>Active Users (${chatUsers.length})</h3>
            ${chatUsers.map(u => `
            <div class="user-item" onclick="selectUser('${u.email}')">
                <div><strong>${u.name}</strong><br><small>${u.email}</small></div>
                <span style="color:#00c853;">●</span>
            </div>`).join('')}
        </div>
        <div class="chat-panel">
            <div class="chat-header"><strong>Chat</strong></div>
            <div class="chat-messages" id="adminMessages"><p style="text-align:center;color:#999;">Select a user</p></div>
            <div class="chat-input">
                <input type="text" id="adminInput" placeholder="Reply...">
                <button onclick="sendReply()">Send</button>
            </div>
        </div>
    </div>
</div>
<script>
let selectedUser = null;
async function selectUser(email) {
    selectedUser = email;
    document.querySelectorAll('.user-item').forEach(i => i.style.background='');
    event.currentTarget.style.background='#fff3e0';
    const res = await fetch('/admin/messages/'+email);
    const msgs = await res.json();
    document.getElementById('adminMessages').innerHTML = msgs.map(m => 
        '<div style="margin-bottom:10px;padding:10px;background:'+(m.isAdmin?'#e3f2fd':'#f5f5f5')+';border-radius:8px;">' +
        '<strong>'+(m.isAdmin?'Admin':'User')+':</strong> '+m.content +
        '<div style="font-size:0.8em;color:#999;">'+new Date(m.timestamp).toLocaleString()+'</div></div>'
    ).join('');
}
async function sendReply() {
    if(!selectedUser) return alert('Select a user first');
    const msg = document.getElementById('adminInput').value.trim();
    if(!msg) return;
    await fetch('/admin/reply', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:selectedUser, message:msg})
    });
    document.getElementById('adminInput').value = '';
    selectUser(selectedUser);
}
setInterval(() => { if(selectedUser) selectUser(selectedUser); }, 3000);
</script>
</body>
</html>`;
}

// ============================================
// Server
// ============================================
const server = http.createServer(async (req, res) => {
    try {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;
        
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // Static assets
        if (pathname.startsWith('/assets/')) {
            const filePath = path.join(__dir, decodeURIComponent(pathname));
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
                    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
                    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'audio/webm',
                    '.mp4': 'video/mp4', '.m4a': 'audio/mp4'
                };
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('File not found');
            }
            return;
        }
        
        // Main page
        if (pathname === '/' || pathname === '/index.html') {
            const galleryPhotos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getMainHTML(galleryPhotos));
            return;
        }
        
        // Chat page
        if (pathname === '/chat') {
            const cookies = parseCookies(req.headers.cookie);
            const session = getSession(cookies.chat_session);
            let userData = null;
            if (session && db) {
                try {
                    userData = await db.collection('chat_users').findOne({ email: session.username });
                } catch(e) {}
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getChatHTML(userData));
            return;
        }
        
        // Chat login
        if (pathname === '/chat/login' && method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const user = await saveChatUser({ name: data.name, email: data.email });
                    const sessionId = createSession(data.email);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Set-Cookie': `chat_session=${sessionId}; Path=/; HttpOnly; Max-Age=7200`
                    });
                    res.end(JSON.stringify({ success: true }));
                } catch(e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Login failed' }));
                }
            });
            return;
        }
        
        // Chat send
        if (pathname === '/chat/send' && method === 'POST') {
            const cookies = parseCookies(req.headers.cookie);
            const session = getSession(cookies.chat_session);
            if (!session) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not logged in' }));
                return;
            }
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    await saveChatMessage({ userEmail: session.username, content: data.message, type: data.type || 'text', isAdmin: false });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch(e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Send failed' }));
                }
            });
            return;
        }
        
        // Chat get messages
        if (pathname === '/chat/messages') {
            const cookies = parseCookies(req.headers.cookie);
            const session = getSession(cookies.chat_session);
            if (!session) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
                return;
            }
            try {
                const messages = await getChatMessages(session.username);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(messages));
            } catch(e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
            return;
        }
        
        // Chat upload image
        if (pathname === '/chat/upload-image' && method === 'POST') {
            if (!formidable) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Upload not available' }));
                return;
            }
            const form = new formidable.IncomingForm();
            form.uploadDir = CHAT_UPLOADS_DIR;
            form.keepExtensions = true;
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Upload failed' }));
                    return;
                }
                const cookies = parseCookies(req.headers.cookie);
                const session = getSession(cookies.chat_session);
                const imageFile = files.image;
                const imagePath = '/assets/chat_uploads/' + path.basename(imageFile.filepath);
                await saveChatMessage({ userEmail: session ? session.username : 'anonymous', content: imagePath, type: 'image', isAdmin: false });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
            return;
        }
        
        // Admin
        if (pathname === '/admin') {
            const cookies = parseCookies(req.headers.cookie);
            const session = getSession(cookies.admin_session);
            if (!session) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`<!DOCTYPE html><html><head><title>Admin Login</title><style>
                    body { font-family:Arial; display:flex; justify-content:center; align-items:center; height:100vh; background:linear-gradient(135deg, #1a1a2e, #16213e); }
                    .login-box { background:#fff; padding:40px; border-radius:16px; width:350px; }
                    h2 { margin-bottom:30px; text-align:center; color:#1a1a2e; }
                    input { width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:8px; }
                    button { width:100%; padding:12px; background:#ff6600; color:#fff; border:none; border-radius:8px; font-weight:600; cursor:pointer; }
                </style></head><body>
                <div class="login-box"><h2>🔐 Admin Login</h2>
                <form method="POST" action="/admin/login">
                    <input type="text" name="username" placeholder="Username" required>
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form></div></body></html>`);
                return;
            }
            const chatUsers = await getAllChatUsers();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getAdminHTML(chatUsers));
            return;
        }
        
        // Admin login
        if (pathname === '/admin/login' && method === 'POST') {
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
                        'Set-Cookie': `admin_session=${sessionId}; Path=/; HttpOnly; Max-Age=7200`
                    });
                } else {
                    res.writeHead(302, { 'Location': '/admin' });
                }
                res.end();
            });
            return;
        }
        
        // Admin logout
        if (pathname === '/admin/logout') {
            res.writeHead(302, {
                'Location': '/admin',
                'Set-Cookie': 'admin_session=; Path=/; Max-Age=0'
            });
            res.end();
            return;
        }
        
        // Admin messages
        if (pathname.startsWith('/admin/messages/')) {
            const userEmail = pathname.split('/')[3];
            const messages = await getChatMessages(userEmail);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(messages));
            return;
        }
        
        // Admin reply
        if (pathname === '/admin/reply' && method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    await saveChatMessage({ userEmail: data.email, toEmail: data.email, content: data.message, type: 'text', isAdmin: true });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch(e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Reply failed' }));
                }
            });
            return;
        }
        
        // 404
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Page Not Found</h1><p><a href="/">Go Home</a></p>');
        
    } catch (error) {
        console.error('Request error:', error.message);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 - Internal Server Error</h1>');
    }
});

// ============================================
// Start Server
// ============================================
server.listen(PORT, async () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📁 Assets: ${ASSETS_DIR}`);
    console.log(`🎵 Music: ${COVER_MUSIC_DIR}`);
    console.log(`🖼️ Gallery: ${GALLERY_DIR}`);
    
    const dbConnected = await connectDB();
    if (dbConnected) {
        console.log('✅ All systems ready');
    } else {
        console.log('⚠️ Running without database - some features limited');
    }
    console.log('-----------------------------------\n');
});

server.on('error', (err) => {
    console.error('Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});

console.log('Starting Baiilla Maach Verification Hub...');

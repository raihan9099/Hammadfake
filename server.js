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
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Enhanced image paths with new assets
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
    messageIcon: "/assets/messageicon.gif",
    microphone: "/assets/microphone-in-hand.gif",
    report: "/assets/report.png",
    socialMedia: "/assets/social-media.png",
    tiktokIcon: "/assets/tiktokicon.png"
};

// Function to manually load cover songs from specific files
function getManualCoverSongs() {
    const manualSongs = [
        { file: '#1.mp3', title: 'Cover Song 1', artist: 'Baiilla Maach' },
        { file: '#2.mp3', title: 'Cover Song 2', artist: 'Baiilla Maach' },
        { file: '#3.mp3', title: 'Cover Song 3', artist: 'Baiilla Maach' },
        { file: '#4.mp3', title: 'Cover Song 4', artist: 'Baiilla Maach' },
        { file: '#5.mp3', title: 'Cover Song 5', artist: 'Baiilla Maach' },
        { file: '#6.mp3', title: 'Cover Song 6', artist: 'Baiilla Maach' },
        { file: '#7.mp3', title: 'Cover Song 7', artist: 'Baiilla Maach' },
        { file: '#8.mp3', title: 'Cover Song 8', artist: 'Baiilla Maach' },
        { file: '#9.mp3', title: 'Cover Song 9', artist: 'Baiilla Maach' },
        { file: '7 lak like but its fake.mp3', title: '7 Lak Like But Its Fake', artist: 'Baiilla Maach' },
        { file: 'realvoice.mp3', title: 'Real Voice Verification', artist: 'Baiilla Maach' }
    ];

    return manualSongs.filter(song => {
        return fs.existsSync(path.join(COVER_MUSIC_DIR, song.file));
    }).map((song, index) => ({
        id: `track_${index}`,
        title: song.title,
        artist: song.artist,
        audioUrl: `/assets/covermusic/${song.file}`,
        fileName: song.file
    }));
}

// Database connection
async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        // Initialize collections
        const collections = ['admin_users', 'gallery_photos', 'chat_messages', 'chat_users'];
        for (const col of collections) {
            const exists = await db.listCollections({ name: col }).hasNext();
            if (!exists) await db.createCollection(col);
        }
        
        // Create default admin
        const admins = db.collection('admin_users');
        const adminExists = await admins.findOne({ username: 'admin' });
        if (!adminExists) {
            await admins.insertOne({ 
                username: 'admin', 
                password: await bcrypt.hash('admin123', 10), 
                createdAt: new Date() 
            });
        }
        
        return true;
    } catch (e) {
        console.error('Database connection error:', e);
        return false;
    }
}

// Gallery functions
async function getGalleryPhotos() {
    if (!db) return [];
    try { 
        return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); 
    } catch (e) { return []; }
}

async function savePhoto(data) {
    if (!db) return null;
    return await db.collection('gallery_photos').insertOne({ ...data, uploadedAt: new Date() });
}

async function deletePhoto(id) {
    if (!db) return null;
    return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
}

// Chat functions
async function saveChatUser(userData) {
    if (!db) return null;
    const users = db.collection('chat_users');
    const existing = await users.findOne({ email: userData.email });
    if (existing) {
        await users.updateOne({ email: userData.email }, { $set: { lastActive: new Date() } });
        return existing;
    }
    const result = await users.insertOne({ ...userData, createdAt: new Date(), lastActive: new Date() });
    return { _id: result.insertedId, ...userData };
}

async function saveChatMessage(messageData) {
    if (!db) return null;
    return await db.collection('chat_messages').insertOne({ ...messageData, timestamp: new Date() });
}

async function getChatMessages(userId) {
    if (!db) return [];
    return await db.collection('chat_messages')
        .find({ $or: [{ userId: userId }, { toUserId: userId }] })
        .sort({ timestamp: 1 })
        .toArray();
}

async function getAllChatUsers() {
    if (!db) return [];
    return await db.collection('chat_users').find({}).sort({ lastActive: -1 }).toArray();
}

// Admin verification
async function verifyAdmin(username, password) {
    if (!db) return username === 'admin' && password === 'admin123';
    const admin = await db.collection('admin_users').findOne({ username });
    if (!admin) return false;
    return await bcrypt.compare(password, admin.password);
}

// Session management
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
    if (Date.now() - s.createdAt > 7200000) { 
        sessions.delete(id); 
        return null; 
    } 
    return s; 
}
function parseCookies(header) { 
    const cookies = {}; 
    if (header) header.split(';').forEach(cookie => { 
        const parts = cookie.split('='); 
        cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : ''; 
    }); 
    return cookies; 
}

// Main celebrities data
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
    verificationBadge: IMAGES.checkMark,
    realIdProof: IMAGES.realId,
    fakeAccounts: [
        { 
            platform: "TikTok", 
            username: "@baiilla_mach", 
            profileUrl: "https://tiktok.com/@baiilla_mach", 
            screenshot: IMAGES.danger, 
            reason: "Copies official logo and content to deceive followers. Uses similar name to confuse fans." 
        },
        { 
            platform: "TikTok", 
            username: "@hammad_fams0", 
            profileUrl: "https://tiktok.com/@hammad_fams0", 
            screenshot: IMAGES.fraud, 
            reason: "Uses official name and photo to mislead followers. Impersonating with fake content." 
        }
    ],
    features: [
        { icon: IMAGES.communication, title: "Direct Chat", desc: "Chat directly with verified account" },
        { icon: IMAGES.report, title: "Report Fakes", desc: "Help us identify fake accounts" },
        { icon: IMAGES.socialMedia, title: "Social Links", desc: "All official social media links" },
        { icon: IMAGES.flag, title: "Verified Badge", desc: "Look for verification before following" }
    ]
};

// Main HTML template with advanced UI
function getMainHTML(galleryPhotos = [], isChatPage = false) {
    const coverSongs = getManualCoverSongs();
    
    // Features section HTML
    const featuresHTML = CELEBRITY_DATA.features.map(f => `
        <div class="feature-card">
            <div class="feature-icon">
                <img src="${f.icon}" alt="${f.title}" width="48">
            </div>
            <h3 class="feature-title">${f.title}</h3>
            <p class="feature-desc">${f.desc}</p>
        </div>
    `).join('');

    // Music player HTML
    let musicPlayerHTML = '';
    if (coverSongs.length > 0) {
        musicPlayerHTML = `
        <section class="section music-section" data-animate>
            <div class="container">
                <div class="section-header">
                    <h2 class="section-title">🎵 Official Cover Songs</h2>
                    <p class="section-subtitle">Original covers by Baiilla Maach - Listen & Verify</p>
                </div>
                <div class="premium-music-player">
                    <div class="player-main">
                        <div class="player-artwork">
                            <img src="${IMAGES.profile}" alt="Now Playing">
                            <div class="playing-animation">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                        <div class="player-info">
                            <h4 class="track-title">Select a Track</h4>
                            <p class="track-artist">Baiilla Maach</p>
                            <div class="player-controls">
                                <button class="ctrl-btn" onclick="prevTrack()">⏮</button>
                                <button class="play-btn" id="mainPlayBtn" onclick="togglePlay()">▶️</button>
                                <button class="ctrl-btn" onclick="nextTrack()">⏭</button>
                            </div>
                            <div class="progress-bar">
                                <div class="progress" id="progressBar"></div>
                            </div>
                            <div class="time-display">
                                <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
                            </div>
                        </div>
                    </div>
                    <div class="playlist-container">
                        ${coverSongs.map((song, i) => `
                            <div class="playlist-item ${i === 0 ? 'active' : ''}" onclick="playTrack(${i})">
                                <span class="track-number">${String(i + 1).padStart(2, '0')}</span>
                                <span class="track-name">${song.title}</span>
                                <span class="track-duration">--:--</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>`;
    }

    // Gallery HTML
    let galleryHTML = '';
    if (galleryPhotos.length > 0) {
        galleryHTML = `
        <section class="section gallery-section" data-animate>
            <div class="container">
                <div class="section-header">
                    <h2 class="section-title">📸 Official Gallery</h2>
                    <p class="section-subtitle">Verified photos & moments from Baiilla Maach</p>
                </div>
                <div class="gallery-grid">
                    ${galleryPhotos.map((photo, index) => `
                        <div class="gallery-item" onclick="openLightbox(${index})">
                            <div class="gallery-img-wrapper">
                                <img src="${photo.path}" alt="${photo.caption || 'Gallery Image'}" loading="lazy">
                                <div class="gallery-overlay">
                                    <span class="zoom-icon">🔍</span>
                                </div>
                            </div>
                            ${photo.caption ? `<p class="gallery-caption">${photo.caption}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>
        <!-- Lightbox -->
        <div class="lightbox" id="galleryLightbox">
            <span class="close-lightbox" onclick="closeLightbox()">✕</span>
            <img id="lightboxImg" src="" alt="">
            <button class="lightbox-nav prev" onclick="changeLightbox(-1)">❮</button>
            <button class="lightbox-nav next" onclick="changeLightbox(1)">❯</button>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ff6600">
<meta name="description" content="${CELEBRITY_DATA.fullName} - Official Verification Hub. Verify authentic accounts and report fakes.">
<title>${CELEBRITY_DATA.fullName} | Official Verification Hub</title>
<style>
:root {
    --primary: #ff6600;
    --primary-dark: #e55a00;
    --primary-light: #ff8533;
    --secondary: #1a1a2e;
    --accent: #00c853;
    --danger: #ff1744;
    --warning: #ffab00;
    --dark: #121212;
    --light: #f5f5f5;
    --white: #ffffff;
    --gray: #666666;
    --border: #e0e0e0;
    --radius: 16px;
    --radius-sm: 8px;
    --shadow: 0 4px 20px rgba(0,0,0,0.08);
    --shadow-hover: 0 8px 30px rgba(0,0,0,0.15);
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
    color: #333;
    line-height: 1.6;
    overflow-x: hidden;
}

/* Premium Header */
.premium-header {
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
    position: sticky;
    top: 0;
    z-index: 1000;
    transition: var(--transition);
}

.premium-header.scrolled {
    box-shadow: 0 2px 20px rgba(0,0,0,0.1);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo-section {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo-img {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--primary);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(255,102,0,0.4); }
    70% { box-shadow: 0 0 0 10px rgba(255,102,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,102,0,0); }
}

.logo-text {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--secondary);
}

.header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
}

.chat-btn, .admin-btn {
    padding: 10px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95em;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 6px;
}

.chat-btn {
    background: linear-gradient(135deg, #00c853, #00e676);
    color: white;
    box-shadow: 0 4px 15px rgba(0,200,83,0.3);
}

.chat-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,200,83,0.4);
}

.admin-btn {
    background: var(--white);
    color: var(--primary);
    border: 2px solid var(--primary);
}

.admin-btn:hover {
    background: var(--primary);
    color: white;
}

/* Hero Section */
.hero-section {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    padding: 80px 0 60px;
    position: relative;
    overflow: hidden;
}

.hero-section::before {
    content: '';
    position: absolute;
    width: 200%;
    height: 200%;
    top: -50%;
    left: -50%;
    background: radial-gradient(circle at 50% 50%, rgba(255,102,0,0.1) 0%, transparent 50%);
    animation: rotate 30s linear infinite;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    color: white;
}

.hero-profile-wrapper {
    position: relative;
    display: inline-block;
}

.hero-profile-img {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    border: 4px solid var(--primary);
    object-fit: cover;
    box-shadow: 0 0 40px rgba(255,102,0,0.3);
}

.verified-badge-hero {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    background: var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    animation: bounce 1s infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

.hero-name {
    font-size: 3em;
    font-weight: 800;
    margin: 20px 0 10px;
    background: linear-gradient(135deg, #fff 0%, #ff8533 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.hero-username {
    font-size: 1.2em;
    opacity: 0.9;
    margin-bottom: 8px;
}

.hero-bio {
    font-size: 1.1em;
    opacity: 0.8;
    margin-bottom: 20px;
}

.verification-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,200,83,0.2);
    padding: 10px 24px;
    border-radius: 50px;
    border: 1px solid rgba(0,200,83,0.3);
    margin-bottom: 25px;
    animation: glow 2s infinite;
}

@keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(0,200,83,0.2); }
    50% { box-shadow: 0 0 30px rgba(0,200,83,0.4); }
}

.verification-text {
    font-weight: 600;
    color: #00e676;
}

.social-links-hero {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
}

.social-link-btn {
    padding: 12px 28px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    border: 2px solid transparent;
}

.social-link-btn.tiktok {
    background: rgba(0,0,0,0.6);
    border-color: rgba(255,255,255,0.2);
}

.social-link-btn.tiktok:hover {
    background: #000;
    border-color: #ff0050;
    transform: translateY(-2px);
}

.social-link-btn.facebook {
    background: rgba(24,119,242,0.6);
    border-color: rgba(255,255,255,0.2);
}

.social-link-btn.facebook:hover {
    background: #1877f2;
    border-color: white;
    transform: translateY(-2px);
}

/* Sections */
.section {
    padding: 80px 0;
    position: relative;
}

.section:nth-child(even) {
    background: white;
}

.section-header {
    text-align: center;
    margin-bottom: 50px;
}

.section-title {
    font-size: 2.5em;
    font-weight: 800;
    color: var(--secondary);
    margin-bottom: 10px;
}

.section-subtitle {
    font-size: 1.1em;
    color: var(--gray);
}

/* Features Grid */
.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 24px;
    margin-top: 30px;
}

.feature-card {
    background: white;
    padding: 30px;
    border-radius: var(--radius);
    text-align: center;
    box-shadow: var(--shadow);
    transition: var(--transition);
    border: 1px solid var(--border);
}

.feature-card:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-hover);
    border-color: var(--primary);
}

.feature-icon {
    margin-bottom: 15px;
}

.feature-title {
    font-size: 1.3em;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--secondary);
}

.feature-desc {
    color: var(--gray);
    font-size: 0.95em;
}

/* Official Account Card */
.official-account-section {
    background: linear-gradient(135deg, #f8fff8 0%, #e8f5e9 100%);
}

.official-card {
    background: white;
    border-radius: var(--radius);
    padding: 40px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    box-shadow: var(--shadow);
    border: 2px solid #c8e6c9;
    align-items: center;
}

.account-info h3 {
    font-size: 1.8em;
    margin-bottom: 20px;
    color: var(--secondary);
}

.info-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 15px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: var(--radius-sm);
}

.info-icon {
    width: 24px;
    height: 24px;
}

.info-label {
    font-weight: 600;
    color: var(--gray);
}

.info-value {
    color: var(--secondary);
    font-weight: 500;
}

.account-preview {
    text-align: center;
}

.preview-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 30px;
    border-radius: var(--radius);
    color: white;
}

.preview-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3px solid white;
    margin-bottom: 15px;
}

.preview-name {
    font-size: 1.2em;
    font-weight: 700;
    margin-bottom: 5px;
}

.preview-username {
    opacity: 0.9;
    margin-bottom: 15px;
}

.follow-btn {
    background: white;
    color: #667eea;
    padding: 10px 30px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    display: inline-block;
    transition: var(--transition);
}

.follow-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

/* Fake Accounts Section */
.fake-accounts-section {
    background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
}

.fake-accounts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 30px;
}

.fake-card {
    background: white;
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 2px solid #ffcdd2;
    transition: var(--transition);
    position: relative;
}

.fake-card:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-hover);
}

.fake-card-badge {
    position: absolute;
    top: 20px;
    right: 20px;
    background: var(--danger);
    color: white;
    padding: 5px 15px;
    border-radius: 50px;
    font-weight: 700;
    font-size: 0.9em;
    z-index: 2;
}

.fake-screenshot {
    position: relative;
    height: 250px;
    overflow: hidden;
}

.fake-screenshot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.fake-card-content {
    padding: 20px;
}

.fake-username {
    font-size: 1.3em;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--secondary);
}

.fake-platform {
    color: var(--primary);
    font-weight: 600;
    margin-bottom: 10px;
}

.fake-reason {
    color: var(--gray);
    margin-bottom: 15px;
    line-height: 1.6;
}

.report-btn {
    background: var(--danger);
    color: white;
    padding: 10px 20px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: var(--transition);
}

.report-btn:hover {
    background: #d50000;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255,23,68,0.3);
}

/* Verification Proof Section */
.verification-proof-section {
    background: white;
}

.proof-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
}

.proof-card {
    background: #f8f9fa;
    border-radius: var(--radius);
    padding: 30px;
    text-align: center;
    border: 1px solid var(--border);
    transition: var(--transition);
}

.proof-card:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow);
}

.proof-img {
    max-width: 100%;
    border-radius: var(--radius-sm);
    margin-bottom: 15px;
}

.proof-title {
    font-weight: 700;
    font-size: 1.1em;
    color: var(--secondary);
}

/* Music Player */
.premium-music-player {
    background: white;
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
}

.player-main {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 24px;
    padding: 30px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
}

.player-artwork {
    position: relative;
    width: 120px;
    height: 120px;
}

.player-artwork img {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-sm);
    object-fit: cover;
}

.playing-animation {
    display: flex;
    gap: 3px;
    justify-content: center;
    margin-top: 10px;
}

.playing-animation span {
    width: 3px;
    height: 15px;
    background: var(--primary);
    border-radius: 3px;
    animation: equalizer 0.8s infinite;
}

.playing-animation span:nth-child(2) { animation-delay: 0.2s; }
.playing-animation span:nth-child(3) { animation-delay: 0.4s; }

@keyframes equalizer {
    0%, 100% { height: 15px; }
    50% { height: 5px; }
}

.track-title {
    font-size: 1.3em;
    font-weight: 700;
    margin-bottom: 5px;
}

.track-artist {
    opacity: 0.8;
    margin-bottom: 15px;
}

.player-controls {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
}

.ctrl-btn {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2em;
    transition: var(--transition);
}

.ctrl-btn:hover {
    background: rgba(255,255,255,0.2);
}

.play-btn {
    width: 56px;
    height: 56px;
    background: var(--primary);
    border: none;
    color: white;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.5em;
    transition: var(--transition);
    box-shadow: 0 4px 15px rgba(255,102,0,0.4);
}

.play-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(255,102,0,0.6);
}

.progress-bar {
    background: rgba(255,255,255,0.2);
    height: 4px;
    border-radius: 2px;
    margin-bottom: 5px;
    cursor: pointer;
}

.progress {
    background: var(--primary);
    height: 100%;
    border-radius: 2px;
    width: 0%;
    transition: width 0.1s linear;
}

.time-display {
    font-size: 0.85em;
    opacity: 0.8;
}

.playlist-container {
    max-height: 300px;
    overflow-y: auto;
}

.playlist-item {
    display: flex;
    align-items: center;
    padding: 12px 24px;
    cursor: pointer;
    transition: var(--transition);
    border-bottom: 1px solid #f0f0f0;
    gap: 12px;
}

.playlist-item:hover {
    background: #f8f9fa;
}

.playlist-item.active {
    background: #fff3e0;
    border-left: 3px solid var(--primary);
}

.track-number {
    font-weight: 700;
    color: var(--gray);
    min-width: 30px;
}

.track-name {
    flex: 1;
    font-weight: 500;
}

.track-duration {
    color: var(--gray);
    font-size: 0.9em;
}

/* Gallery */
.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
}

.gallery-item {
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
    transition: var(--transition);
    cursor: pointer;
}

.gallery-item:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-hover);
}

.gallery-img-wrapper {
    position: relative;
    height: 250px;
    overflow: hidden;
}

.gallery-img-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
}

.gallery-item:hover .gallery-img-wrapper img {
    transform: scale(1.1);
}

.gallery-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: var(--transition);
}

.gallery-item:hover .gallery-overlay {
    opacity: 1;
}

.zoom-icon {
    font-size: 2em;
}

.gallery-caption {
    padding: 12px;
    text-align: center;
    font-weight: 500;
    background: white;
}

/* Lightbox */
.lightbox {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.95);
    z-index: 2000;
    align-items: center;
    justify-content: center;
}

.lightbox.active {
    display: flex;
}

.lightbox img {
    max-width: 90%;
    max-height: 90%;
    border-radius: var(--radius-sm);
}

.close-lightbox {
    position: absolute;
    top: 20px;
    right: 20px;
    color: white;
    font-size: 2em;
    cursor: pointer;
    background: rgba(255,255,255,0.1);
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.1);
    color: white;
    border: none;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    font-size: 1.5em;
    cursor: pointer;
    transition: var(--transition);
}

.lightbox-nav:hover {
    background: rgba(255,255,255,0.2);
}

.lightbox-nav.prev { left: 20px; }
.lightbox-nav.next { right: 20px; }

/* Footer */
.premium-footer {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
    padding: 60px 0 30px;
}

.footer-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 40px;
    margin-bottom: 40px;
}

.footer-section h3 {
    font-size: 1.3em;
    margin-bottom: 20px;
    color: var(--primary);
}

.footer-section p {
    opacity: 0.8;
    line-height: 1.8;
}

.footer-links {
    list-style: none;
}

.footer-links li {
    margin-bottom: 10px;
}

.footer-links a {
    color: white;
    text-decoration: none;
    opacity: 0.8;
    transition: var(--transition);
}

.footer-links a:hover {
    opacity: 1;
    padding-left: 5px;
}

.footer-bottom {
    text-align: center;
    padding-top: 30px;
    border-top: 1px solid rgba(255,255,255,0.1);
    opacity: 0.7;
}

/* Animations */
[data-animate] {
    opacity: 0;
    transform: translateY(30px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-animate].animated {
    opacity: 1;
    transform: translateY(0);
}

/* Responsive */
@media (max-width: 768px) {
    .hero-name { font-size: 2em; }
    .section-title { font-size: 1.8em; }
    .official-card { grid-template-columns: 1fr; }
    .player-main { grid-template-columns: 1fr; text-align: center; }
    .player-artwork { margin: 0 auto; }
    .player-controls { justify-content: center; }
    .fake-accounts-grid { grid-template-columns: 1fr; }
    .header-actions { gap: 8px; }
    .chat-btn, .admin-btn { padding: 8px 16px; font-size: 0.85em; }
}
</style>
</head>
<body>

<header class="premium-header" id="header">
    <div class="container">
        <div class="header-content">
            <div class="logo-section">
                <img src="${IMAGES.profile}" alt="Logo" class="logo-img">
                <span class="logo-text">${CELEBRITY_DATA.name}</span>
            </div>
            <div class="header-actions">
                <a href="/chat" class="chat-btn">
                    <span>💬</span> Support Chat
                </a>
                <a href="/admin" class="admin-btn">
                    <span>🔐</span> Admin
                </a>
            </div>
        </div>
    </div>
</header>

<!-- Hero Section -->
<section class="hero-section">
    <div class="hero-content container">
        <div class="hero-profile-wrapper">
            <img src="${IMAGES.profile}" alt="${CELEBRITY_DATA.name}" class="hero-profile-img">
            <div class="verified-badge-hero">✓</div>
        </div>
        <h1 class="hero-name">${CELEBRITY_DATA.fullName}</h1>
        <p class="hero-username">${CELEBRITY_DATA.username}</p>
        <p class="hero-bio">${CELEBRITY_DATA.bio}</p>
        <div class="verification-status">
            <span>✅</span>
            <span class="verification-text">VERIFIED OFFICIAL ACCOUNT</span>
        </div>
        <div class="social-links-hero">
            <a href="${CELEBRITY_DATA.tiktokUrl}" target="_blank" class="social-link-btn tiktok">
                <img src="${IMAGES.tiktokIcon}" width="20" alt="TikTok"> TikTok
            </a>
            <a href="${CELEBRITY_DATA.fbUrl}" target="_blank" class="social-link-btn facebook">
                <span>📘</span> Facebook
            </a>
        </div>
    </div>
</section>

<!-- Features Section -->
<section class="section" data-animate>
    <div class="container">
        <div class="section-header">
            <h2 class="section-title">Why Trust This Hub?</h2>
            <p class="section-subtitle">Everything you need to verify the authentic Baiilla Maach</p>
        </div>
        <div class="features-grid">
            ${featuresHTML}
        </div>
    </div>
</section>

<!-- Official Account Section -->
<section class="section official-account-section" data-animate>
    <div class="container">
        <div class="section-header">
            <h2 class="section-title">✅ Official Verified Account</h2>
            <p class="section-subtitle">The ONLY authentic Baiilla Maach accounts</p>
        </div>
        <div class="official-card">
            <div class="account-info">
                <h3>Verified Details</h3>
                <div class="info-row">
                    <img src="${IMAGES.checkMark}" class="info-icon" alt="Verified">
                    <div>
                        <span class="info-label">Status:</span>
                        <span class="info-value" style="color: #00c853;">● Active & Verified</span>
                    </div>
                </div>
                <div class="info-row">
                    <span>📱</span>
                    <div>
                        <span class="info-label">TikTok:</span>
                        <span class="info-value">${CELEBRITY_DATA.username}</span>
                    </div>
                </div>
                <div class="info-row">
                    <span>📘</span>
                    <div>
                        <span class="info-label">Facebook:</span>
                        <span class="info-value">${CELEBRITY_DATA.fbUsername}</span>
                    </div>
                </div>
                <div class="info-row">
                    <img src="${IMAGES.realId}" class="info-icon" alt="ID Proof">
                    <div>
                        <span class="info-label">Identity Verified:</span>
                        <span class="info-value" style="color: #00c853;">Real ID Confirmed</span>
                    </div>
                </div>
            </div>
            <div class="account-preview">
                <div class="preview-card">
                    <img src="${IMAGES.fbProfile}" alt="Facebook Profile" class="preview-avatar">
                    <p class="preview-name">Baiilla Maach</p>
                    <p class="preview-username">${CELEBRITY_DATA.fbUsername}</p>
                    <a href="${CELEBRITY_DATA.fbUrl}" target="_blank" class="follow-btn">Follow on Facebook</a>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Fake Accounts Section -->
<section class="section fake-accounts-section" data-animate>
    <div class="container">
        <div class="section-header">
            <h2 class="section-title">⚠️ Beware of Fake Accounts</h2>
            <p class="section-subtitle">${CELEBRITY_DATA.fakeAccounts.length} fake accounts detected - Report them immediately</p>
        </div>
        <div class="fake-accounts-grid">
            ${CELEBRITY_DATA.fakeAccounts.map(account => `
                <div class="fake-card">
                    <div class="fake-card-badge">FAKE</div>
                    <div class="fake-screenshot">
                        <img src="${account.screenshot}" alt="Fake Account">
                    </div>
                    <div class="fake-card-content">
                        <h3 class="fake-username">${account.username}</h3>
                        <p class="fake-platform">📍 ${account.platform}</p>
                        <p class="fake-reason">${account.reason}</p>
                        <a href="${account.profileUrl}" target="_blank" class="report-btn">
                            <img src="${IMAGES.report}" width="20" alt="Report"> Report This Account
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</section>

<!-- Verification Proof Section -->
<section class="section verification-proof-section" data-animate>
    <div class="container">
        <div class="section-header">
            <h2 class="section-title">🔒 Identity Proof</h2>
            <p class="section-subtitle">Evidence of official verification</p>
        </div>
        <div class="proof-grid">
            <div class="proof-card">
                <img src="${IMAGES.realId}" alt="Real ID" class="proof-img">
                <p class="proof-title">Real ID Verification</p>
            </div>
            <div class="proof-card">
                <img src="${IMAGES.fakeDetect}" alt="Fake Detection" class="proof-img">
                <p class="proof-title">Fake Account Detection</p>
            </div>
            <div class="proof-card">
                <img src="${IMAGES.microphone}" alt="Voice Note" class="proof-img">
                <p class="proof-title">Real Voice Note</p>
            </div>
        </div>
    </div>
</section>

${musicPlayerHTML}

${galleryHTML}

<!-- Footer -->
<footer class="premium-footer">
    <div class="container">
        <div class="footer-content">
            <div class="footer-section">
                <h3>About This Hub</h3>
                <p>This is the ONLY official verification hub for Baiilla Maach. We help fans identify authentic accounts and avoid scams.</p>
            </div>
            <div class="footer-section">
                <h3>Quick Links</h3>
                <ul class="footer-links">
                    <li><a href="${CELEBRITY_DATA.tiktokUrl}" target="_blank">Official TikTok</a></li>
                    <li><a href="${CELEBRITY_DATA.fbUrl}" target="_blank">Official Facebook</a></li>
                    <li><a href="/chat">Support Chat</a></li>
                    <li><a href="/admin">Admin Panel</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h3>Contact</h3>
                <p>Use our support chat for any verification queries or to report fake accounts.</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>© 2024 ${CELEBRITY_DATA.fullName}. All Rights Reserved.</p>
            <p style="margin-top: 10px;">⚠️ This is the only official verification hub</p>
        </div>
    </div>
</footer>

<!-- Hidden audio element -->
<audio id="audioPlayer" preload="metadata"></audio>

<script>
// Gallery data for lightbox
const galleryPhotos = ${JSON.stringify(galleryPhotos)};
let currentLightboxIndex = 0;

// Music player state
const tracks = ${JSON.stringify(coverSongs)};
let currentTrack = 0;
let isPlaying = false;
const audioPlayer = document.getElementById('audioPlayer');

// Initialize first track
if (tracks.length > 0) {
    audioPlayer.src = tracks[0].audioUrl;
    audioPlayer.load();
}

// Music Player Functions
function playTrack(index) {
    if (index >= 0 && index < tracks.length) {
        currentTrack = index;
        audioPlayer.src = tracks[index].audioUrl;
        audioPlayer.load();
        audioPlayer.play();
        isPlaying = true;
        updatePlayButton();
        updateActiveTrack();
        updateTrackInfo();
    }
}

function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        isPlaying = true;
    } else {
        audioPlayer.pause();
        isPlaying = false;
    }
    updatePlayButton();
}

function prevTrack() {
    currentTrack = (currentTrack - 1 + tracks.length) % tracks.length;
    playTrack(currentTrack);
}

function nextTrack() {
    currentTrack = (currentTrack + 1) % tracks.length;
    playTrack(currentTrack);
}

function updatePlayButton() {
    const playBtn = document.getElementById('mainPlayBtn');
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸️' : '▶️';
    }
}

function updateActiveTrack() {
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
        item.classList.toggle('active', index === currentTrack);
    });
}

function updateTrackInfo() {
    if (tracks[currentTrack]) {
        document.querySelector('.track-title').textContent = tracks[currentTrack].title;
        document.querySelector('.track-artist').textContent = tracks[currentTrack].artist;
    }
}

// Progress bar
audioPlayer.addEventListener('timeupdate', () => {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    
    const currentMinutes = Math.floor(audioPlayer.currentTime / 60);
    const currentSeconds = Math.floor(audioPlayer.currentTime % 60);
    const durationMinutes = Math.floor(audioPlayer.duration / 60) || 0;
    const durationSeconds = Math.floor(audioPlayer.duration % 60) || 0;
    
    document.getElementById('currentTime').textContent = 
        currentMinutes + ':' + String(currentSeconds).padStart(2, '0');
    document.getElementById('duration').textContent = 
        durationMinutes + ':' + String(durationSeconds).padStart(2, '0');
});

audioPlayer.addEventListener('ended', nextTrack);

// Click on progress bar
document.querySelector('.progress-bar').addEventListener('click', (e) => {
    const rect = e.target.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
});

// Gallery Lightbox Functions
function openLightbox(index) {
    currentLightboxIndex = index;
    const lightbox = document.getElementById('galleryLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.src = galleryPhotos[index].path;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('galleryLightbox').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function changeLightbox(direction) {
    currentLightboxIndex = (currentLightboxIndex + direction + galleryPhotos.length) % galleryPhotos.length;
    document.getElementById('lightboxImg').src = galleryPhotos[currentLightboxIndex].path;
}

// Close lightbox with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeLightbox(-1);
    if (e.key === 'ArrowRight') changeLightbox(1);
});

// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('[data-animate]').forEach(el => {
    observer.observe(el);
});

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Update track durations
tracks.forEach((track, index) => {
    const tempAudio = new Audio();
    tempAudio.src = track.audioUrl;
    tempAudio.addEventListener('loadedmetadata', () => {
        const minutes = Math.floor(tempAudio.duration / 60);
        const seconds = Math.floor(tempAudio.duration % 60);
        const durationEl = document.querySelectorAll('.track-duration')[index];
        if (durationEl) {
            durationEl.textContent = minutes + ':' + String(seconds).padStart(2, '0');
        }
    });
});
</script>
</body>
</html>`;
}

// Chat page HTML
function getChatHTML(userData = null) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Support Chat | Baiilla Maach Official</title>
<style>
:root {
    --primary: #ff6600;
    --primary-dark: #e55a00;
    --secondary: #1a1a2e;
    --accent: #00c853;
    --danger: #ff1744;
    --dark: #121212;
    --light: #f5f5f5;
    --white: #ffffff;
    --gray: #666666;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
    min-height: 100vh;
}

.chat-container {
    max-width: 800px;
    margin: 0 auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(10px);
}

.chat-header {
    background: rgba(255,102,0,0.2);
    padding: 15px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.chat-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.chat-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--primary);
}

.chat-title {
    font-size: 1.1em;
    font-weight: 600;
}

.chat-status {
    font-size: 0.85em;
    color: #00c853;
}

.back-btn {
    background: rgba(255,255,255,0.1);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    text-decoration: none;
    font-size: 0.9em;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.message {
    max-width: 70%;
    padding: 12px 16px;
    border-radius: 18px;
    margin-bottom: 5px;
    word-wrap: break-word;
    position: relative;
}

.message.sent {
    background: var(--primary);
    align-self: flex-end;
    border-bottom-right-radius: 4px;
}

.message.received {
    background: rgba(255,255,255,0.1);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
}

.message-time {
    font-size: 0.7em;
    opacity: 0.7;
    margin-top: 4px;
}

.message-image {
    max-width: 200px;
    border-radius: 12px;
    cursor: pointer;
}

.message-audio {
    max-width: 200px;
}

.chat-input-area {
    padding: 15px 20px;
    background: rgba(0,0,0,0.3);
    border-top: 1px solid rgba(255,255,255,0.1);
}

.input-row {
    display: flex;
    gap: 10px;
    align-items: center;
}

.message-input {
    flex: 1;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: white;
    padding: 12px 16px;
    border-radius: 25px;
    font-size: 0.95em;
    outline: none;
    transition: all 0.3s;
}

.message-input:focus {
    border-color: var(--primary);
    background: rgba(255,255,255,0.15);
}

.attach-btn {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2em;
    transition: all 0.3s;
}

.attach-btn:hover {
    background: rgba(255,255,255,0.2);
}

.send-btn {
    background: var(--primary);
    border: none;
    color: white;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2em;
    transition: all 0.3s;
}

.send-btn:hover {
    background: var(--primary-dark);
    transform: scale(1.05);
}

.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.login-form {
    background: white;
    padding: 30px;
    border-radius: 15px;
    width: 90%;
    max-width: 400px;
    color: #333;
}

.login-form h2 {
    margin-bottom: 20px;
    color: var(--secondary);
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: #555;
}

.form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 0.95em;
}

.submit-btn {
    width: 100%;
    background: var(--primary);
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-size: 1em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.submit-btn:hover {
    background: var(--primary-dark);
}

.voice-record-btn {
    background: var(--danger);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2em;
    transition: all 0.3s;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(255,23,68,0.4); }
    70% { box-shadow: 0 0 0 10px rgba(255,23,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,23,68,0); }
}
</style>
</head>
<body>
<div class="chat-container">
    <div class="chat-header">
        <div class="chat-header-left">
            <img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Baiilla Maach" class="chat-avatar">
            <div>
                <div class="chat-title">Baiilla Maach Support</div>
                <div class="chat-status">● Online</div>
            </div>
        </div>
        <a href="/" class="back-btn">← Back</a>
    </div>
    
    <div class="chat-messages" id="chatMessages">
        <div class="message received">
            Welcome to Baiilla Maach Official Support! How can we help you?
            <div class="message-time">Just now</div>
        </div>
    </div>
    
    <div class="chat-input-area">
        <div class="input-row">
            <input type="file" id="imageInput" accept="image/*" style="display: none;">
            <input type="file" id="audioInput" accept="audio/*" style="display: none;">
            <button class="attach-btn" onclick="document.getElementById('imageInput').click()">📎</button>
            <input type="text" class="message-input" id="messageInput" placeholder="Type your message...">
            <button class="voice-record-btn" id="voiceRecordBtn">🎤</button>
            <button class="send-btn" onclick="sendMessage()">➤</button>
        </div>
    </div>
</div>

${!userData ? `
<div class="login-overlay" id="loginOverlay">
    <div class="login-form">
        <h2>Start Chat Support</h2>
        <form onsubmit="login(event)">
            <div class="form-group">
                <label>Your Name</label>
                <input type="text" id="userName" required>
            </div>
            <div class="form-group">
                <label>Email or Phone</label>
                <input type="text" id="userEmail" required>
            </div>
            <button type="submit" class="submit-btn">Start Chat</button>
        </form>
    </div>
</div>
` : ''}

<script>
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

async function login(e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    
    try {
        const response = await fetch('/chat/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, email})
        });
        
        if (response.ok) {
            document.getElementById('loginOverlay').style.display = 'none';
            loadMessages();
        }
    } catch (error) {
        console.error('Login failed:', error);
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch('/chat/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message, type: 'text'})
        });
        
        if (response.ok) {
            input.value = '';
            loadMessages();
        }
    } catch (error) {
        console.error('Send failed:', error);
    }
}

async function loadMessages() {
    try {
        const response = await fetch('/chat/messages');
        const messages = await response.json();
        
        const container = document.getElementById('chatMessages');
        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.userId ? 'sent' : 'received'}">
                ${msg.type === 'image' ? 
                    '<img src="' + msg.content + '" class="message-image" onclick="window.open(this.src)">' :
                    msg.type === 'audio' ?
                    '<audio controls class="message-audio"><source src="' + msg.content + '"></audio>' :
                    msg.content
                }
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Load messages failed:', error);
    }
}

// Voice recording
document.getElementById('voiceRecordBtn').addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'voice_message.webm');
                
                try {
                    const response = await fetch('/chat/upload-audio', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        loadMessages();
                    }
                } catch (error) {
                    console.error('Audio upload failed:', error);
                }
            };
            
            mediaRecorder.start();
            isRecording = true;
            document.getElementById('voiceRecordBtn').style.background = '#ff0000';
        } catch (error) {
            console.error('Microphone access denied:', error);
            alert('Please allow microphone access to record voice messages');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('voiceRecordBtn').style.background = '#ff1744';
    }
});

// Image upload
document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/chat/upload-image', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            loadMessages();
        }
    } catch (error) {
        console.error('Image upload failed:', error);
    }
});

// Auto-refresh messages
setInterval(loadMessages, 3000);

// Load messages on start
${userData ? 'loadMessages();' : ''}

// Enter to send
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
</script>
</body>
</html>`;
}

// Admin panel HTML
function getAdminHTML(chatUsers = [], messages = []) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Baiilla Maach Hub</title>
<style>
:root {
    --primary: #ff6600;
    --primary-dark: #e55a00;
    --secondary: #1a1a2e;
    --accent: #00c853;
    --danger: #ff1744;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
}

.admin-container {
    display: grid;
    grid-template-columns: 250px 1fr;
    min-height: 100vh;
}

.sidebar {
    background: var(--secondary);
    color: white;
    padding: 20px;
}

.sidebar h2 {
    margin-bottom: 30px;
    color: var(--primary);
}

.nav-item {
    padding: 12px;
    margin-bottom: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 10px;
}

.nav-item:hover, .nav-item.active {
    background: rgba(255,102,0,0.2);
}

.main-content {
    padding: 30px;
    overflow-y: auto;
}

.chat-panel {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
}

.chat-header {
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
    background: var(--primary);
    color: white;
    border-radius: 12px 12px 0 0;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.chat-input {
    padding: 15px 20px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px;
}

.chat-input input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 20px;
    outline: none;
}

.chat-input button {
    background: var(--primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
}

.users-list {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.user-item {
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
}

.user-item:hover {
    background: #f8f9fa;
}

.user-item.active {
    background: #fff3e0;
    border-left: 3px solid var(--primary);
}

.user-status {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #00c853;
}

.logout-btn {
    background: var(--danger);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    margin-top: auto;
}
</style>
</head>
<body>
<div class="admin-container">
    <div class="sidebar">
        <h2>Admin Panel</h2>
        <div class="nav-item active">
            <span>💬</span> Chat Support
        </div>
        <div class="nav-item">
            <span>📸</span> Gallery
        </div>
        <div class="nav-item">
            <span>🎵</span> Music
        </div>
        <a href="/admin/logout" class="logout-btn" style="display: block; text-align: center; text-decoration: none;">Logout</a>
    </div>
    
    <div class="main-content">
        <div class="users-list">
            <h3 style="padding: 15px 20px;">Active Users (${chatUsers.length})</h3>
            ${chatUsers.map(user => `
                <div class="user-item" onclick="selectUser('${user.email}')">
                    <div>
                        <strong>${user.name}</strong>
                        <div style="font-size: 0.9em; color: #666;">${user.email}</div>
                    </div>
                    <div class="user-status"></div>
                </div>
            `).join('')}
        </div>
        
        <div class="chat-panel">
            <div class="chat-header">
                <strong>Chat with Users</strong>
            </div>
            <div class="chat-messages" id="adminChatMessages">
                <p style="text-align: center; color: #999;">Select a user to view conversation</p>
            </div>
            <div class="chat-input">
                <input type="text" id="adminMessageInput" placeholder="Type your reply...">
                <button onclick="sendAdminReply()">Send</button>
            </div>
        </div>
    </div>
</div>

<script>
let selectedUser = null;

async function selectUser(email) {
    selectedUser = email;
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    await loadUserMessages(email);
}

async function loadUserMessages(email) {
    try {
        const response = await fetch('/admin/messages/' + email);
        const messages = await response.json();
        
        const container = document.getElementById('adminChatMessages');
        container.innerHTML = messages.map(msg => `
            <div style="margin-bottom: 10px; padding: 10px; background: ${msg.type === 'admin' ? '#e3f2fd' : '#f5f5f5'}; border-radius: 8px;">
                <strong>${msg.type === 'admin' ? 'Admin' : 'User'}:</strong>
                ${msg.content}
                <div style="font-size: 0.8em; color: #999;">${new Date(msg.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Load messages failed:', error);
    }
}

async function sendAdminReply() {
    if (!selectedUser) {
        alert('Please select a user first');
        return;
    }
    
    const input = document.getElementById('adminMessageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch('/admin/reply', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: selectedUser, message})
        });
        
        if (response.ok) {
            input.value = '';
            await loadUserMessages(selectedUser);
        }
    } catch (error) {
        console.error('Reply failed:', error);
    }
}

// Auto-refresh
setInterval(() => {
    if (selectedUser) loadUserMessages(selectedUser);
}, 3000);
</script>
</body>
</html>`;
}

// Server creation
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const filePath = path.join(__dir, pathname);
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'text/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.mp4': 'video/mp4',
                '.webm': 'audio/webm'
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
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getMainHTML(galleryPhotos));
        return;
    }
    
    // Chat page
    if (pathname === '/chat') {
        const cookies = parseCookies(req.headers.cookie);
        const session = getSession(cookies.chat_session);
        let userData = null;
        
        if (session) {
            userData = await db.collection('chat_users').findOne({ email: session.username });
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
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
                res.end(JSON.stringify({ success: true, user }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Login failed' }));
            }
        });
        return;
    }
    
    // Chat send message
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
                await saveChatMessage({
                    userEmail: session.username,
                    content: data.message,
                    type: data.type || 'text',
                    isAdmin: false
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
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
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not logged in' }));
            return;
        }
        
        try {
            const messages = await getChatMessages(session.username);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(messages));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
        }
        return;
    }
    
    // Chat upload image
    if (pathname === '/chat/upload-image' && method === 'POST') {
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
            
            await saveChatMessage({
                userEmail: session ? session.username : 'anonymous',
                content: imagePath,
                type: 'image',
                isAdmin: false
            });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    // Chat upload audio
    if (pathname === '/chat/upload-audio' && method === 'POST') {
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
            
            const audioFile = files.audio;
            const audioPath = '/assets/chat_uploads/' + path.basename(audioFile.filepath);
            
            await saveChatMessage({
                userEmail: session ? session.username : 'anonymous',
                content: audioPath,
                type: 'audio',
                isAdmin: false
            });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    // Admin panel
    if (pathname === '/admin') {
        const cookies = parseCookies(req.headers.cookie);
        const session = getSession(cookies.admin_session);
        
        if (!session) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Admin Login</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        }
                        .login-box {
                            background: white;
                            padding: 40px;
                            border-radius: 16px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            width: 350px;
                        }
                        h2 { color: #1a1a2e; margin-bottom: 30px; text-align: center; }
                        input {
                            width: 100%;
                            padding: 12px;
                            margin-bottom: 15px;
                            border: 1px solid #ddd;
                            border-radius: 8px;
                            font-size: 1em;
                        }
                        button {
                            width: 100%;
                            padding: 12px;
                            background: #ff6600;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 1em;
                            font-weight: 600;
                            cursor: pointer;
                        }
                        button:hover { background: #e55a00; }
                    </style>
                </head>
                <body>
                    <div class="login-box">
                        <h2>🔐 Admin Login</h2>
                        <form method="POST" action="/admin/login">
                            <input type="text" name="username" placeholder="Username" required>
                            <input type="password" name="password" placeholder="Password" required>
                            <button type="submit">Login</button>
                        </form>
                    </div>
                </body>
                </html>
            `);
            return;
        }
        
        const chatUsers = await getAllChatUsers();
        const messages = await getChatMessages('all');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getAdminHTML(chatUsers, messages));
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
                res.end();
            } else {
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
            }
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
    
    // Admin get user messages
    if (pathname.startsWith('/admin/messages/')) {
        const userEmail = pathname.split('/')[3];
        const messages = await getChatMessages(userEmail);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(messages));
        return;
    }
    
    // Admin reply to user
    if (pathname === '/admin/reply' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                await saveChatMessage({
                    userEmail: data.email,
                    content: data.message,
                    type: 'text',
                    isAdmin: true
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Reply failed' }));
            }
        });
        return;
    }
    
    // Admin gallery upload
    if (pathname === '/admin/gallery/upload' && method === 'POST') {
        const form = new formidable.IncomingForm();
        form.uploadDir = GALLERY_DIR;
        form.keepExtensions = true;
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Upload failed' }));
                return;
            }
            
            const photoFile = files.photo;
            const photoPath = '/assets/gallery/' + path.basename(photoFile.filepath);
            const caption = fields.caption || '';
            
            await savePhoto({ path: photoPath, caption });
            
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
        });
        return;
    }
    
    // Admin gallery delete
    if (pathname.startsWith('/admin/gallery/delete/') && method === 'GET') {
        const photoId = pathname.split('/')[4];
        await deletePhoto(photoId);
        res.writeHead(302, { 'Location': '/admin' });
        res.end();
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Page Not Found</h1>');
});

// Start server
server.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    const dbConnected = await connectDB();
    if (dbConnected) {
        console.log('📦 Connected to MongoDB');
    } else {
        console.log('⚠️ Running without database');
    }
});

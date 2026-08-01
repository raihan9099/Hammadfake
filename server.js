const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

// ============ CONFIG ============
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// ============ DIRECTORIES ============
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');
const THUMBNAILS_DIR = path.join(__dir, 'assets', 'thumbnails');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ DATABASE ============
let db, mongoClient;
let dbConnected = false;

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 10000
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        const collections = [
            'admin_users', 'gallery_photos', 'chat_users', 
            'chat_messages', 'chat_sessions', 'admin_logs',
            'verification_requests', 'banned_users'
        ];
        
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        await db.collection('gallery_photos').createIndex({ uploadedAt: -1 });
        await db.collection('banned_users').createIndex({ phoneEmail: 1 });
        
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                createdAt: new Date(),
                role: 'super_admin'
            });
        }
        
        dbConnected = true;
        console.log('[DB] Connected');
        return true;
    } catch (e) {
        console.error('[DB] Error:', e.message);
        return false;
    }
}

// ============ IMAGE PROCESSING ============
async function processImage(filePath, outputDir, maxWidth = 1200) {
    const filename = crypto.randomBytes(8).toString('hex') + '.webp';
    const outputPath = path.join(outputDir, filename);
    
    try {
        await sharp(filePath)
            .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(outputPath);
        
        // Create thumbnail
        const thumbName = 'thumb_' + filename;
        const thumbPath = path.join(THUMBNAILS_DIR, thumbName);
        await sharp(filePath)
            .resize(300, 300, { fit: 'cover' })
            .webp({ quality: 60 })
            .toFile(thumbPath);
        
        return {
            path: '/assets/chat_uploads/' + filename,
            thumbnail: '/assets/thumbnails/' + thumbName,
            filename: filename
        };
    } catch (e) {
        console.error('[Image] Processing error:', e.message);
        return null;
    }
}

// ============ SANITIZE ============
function sanitize(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

function isValidFilePath(filepath) {
    const normalized = path.normalize(filepath);
    return normalized.startsWith(ASSETS_DIR) && !normalized.includes('..');
}

// ============ CACHE HEADERS ============
const CACHE_CONTROL = {
    images: 'public, max-age=31536000, immutable',
    audio: 'public, max-age=31536000, immutable',
    html: 'no-cache, must-revalidate',
    json: 'no-cache'
};

const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.ico': 'image/x-icon',
    '.css': 'text/css',
    '.js': 'application/javascript'
};

// ============ COVER SONGS ============
function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
        const coverExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
        const groups = {};
        
        files.forEach(f => {
            const ext = path.extname(f).toLowerCase();
            const base = path.basename(f, ext);
            if (!groups[base]) groups[base] = { audio: null, cover: null };
            if (audioExts.has(ext)) groups[base].audio = f;
            if (coverExts.has(ext)) groups[base].cover = f;
        });
        
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

// ============ DATABASE OPERATIONS ============
async function getGalleryPhotos() {
    if (!db) return [];
    try {
        return await db.collection('gallery_photos')
            .find({})
            .sort({ uploadedAt: -1 })
            .limit(50)
            .toArray();
    } catch (e) { return []; }
}

async function savePhoto(data) {
    if (!db) return null;
    return await db.collection('gallery_photos').insertOne({
        ...data,
        uploadedAt: new Date()
    });
}

async function deletePhoto(id) {
    if (!db) return null;
    return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
}

async function verifyAdmin(username, password) {
    if (!db) return username === 'admin' && password === 'admin123';
    const admin = await db.collection('admin_users').findOne({ username });
    if (!admin) return false;
    return await bcrypt.compare(password, admin.password);
}

async function createOrGetChatUser(name, phoneEmail) {
    if (!phoneEmail || !phoneEmail.trim()) return null;
    const clean = phoneEmail.trim().toLowerCase();
    
    // Check if banned
    const banned = await db.collection('banned_users').findOne({ phoneEmail: clean });
    if (banned) return null;
    
    let user = await db.collection('chat_users').findOne({ phoneEmail: clean });
    if (user) {
        await db.collection('chat_users').updateOne(
            { _id: user._id },
            { $set: { name, lastSeen: new Date(), status: 'active' } }
        );
        return user;
    }
    
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    user = {
        chatId, name, phoneEmail: clean,
        createdAt: new Date(), lastSeen: new Date(),
        status: 'active', isBanned: false
    };
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').deleteMany({ chatId });
    await db.collection('chat_sessions').insertOne({
        chatId, token,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return token;
}

async function getChatUserByToken(token) {
    if (!token) return null;
    const session = await db.collection('chat_sessions').findOne({
        token,
        expiresAt: { $gt: new Date() }
    });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getChatMessages(chatId, limit = 50) {
    return await db.collection('chat_messages')
        .find({ chatId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
        .then(msgs => msgs.reverse());
}

async function saveChatMessage(chatId, sender, message, type = 'text', imageUrl = null) {
    const msg = {
        chatId, sender, message, type,
        imageUrl: imageUrl || null,
        createdAt: new Date(),
        read: false,
        delivered: true
    };
    await db.collection('chat_messages').insertOne(msg);
    await db.collection('chat_users').updateOne(
        { chatId },
        { $set: { lastSeen: new Date() } }
    );
    return msg;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
}

async function getAdminChatList() {
    const users = await db.collection('chat_users')
        .find({ status: 'active' })
        .sort({ lastSeen: -1 })
        .toArray();
    
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages')
            .findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages')
            .countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        list.push({
            chatId: u.chatId, name: u.name,
            phoneEmail: u.phoneEmail, lastSeen: u.lastSeen,
            lastMessage: lastMsg, unread
        });
    }
    return list;
}

async function logAdminAction(adminUser, action, details = '') {
    if (!db) return;
    await db.collection('admin_logs').insertOne({
        adminUser, action, details,
        timestamp: new Date()
    });
}

// ============ SESSION MANAGEMENT ============
const sessions = new Map();
const SESSION_DURATION = 7200000; // 2 hours

// Cleanup expired sessions every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessions) {
        if (now - value.createdAt > SESSION_DURATION) {
            sessions.delete(key);
        }
    }
}, 1800000);

function createSession(username) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username, createdAt: Date.now() });
    return id;
}

function getSession(id) {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_DURATION) {
        sessions.delete(id);
        return null;
    }
    return s;
}

function parseCookies(header) {
    const cookies = {};
    if (header) {
        header.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
        });
    }
    return cookies;
}

// ============ ADMIN PRESENCE ============
const adminPresence = { isOnline: false, lastSeen: null };

function getLastSeenText() {
    if (adminPresence.isOnline) return 'Active now';
    if (!adminPresence.lastSeen) return 'Offline';
    const diff = Date.now() - adminPresence.lastSeen.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `Active ${mins}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `Active ${hours}h ago`;
    return `Seen ${adminPresence.lastSeen.toLocaleDateString()}`;
}

// ============ DATA ============
const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: "/assets/tiktok_video_Aj2NO.jpeg",
        bio: "Official Entertainment Profile | Bangladesh",
        tiktokFollowers: 5000,
        tiktokFollowing: 0,
        tiktokLikes: 50000,
        location: "Dhaka, Bangladesh"
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            verified: true,
            followers: "5,000"
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            verified: true,
            followers: "Growing"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            reason: "Copies official content to deceive followers",
            threatLevel: "Critical",
            reportedCount: 156
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            reason: "Uses official name and photo to mislead",
            threatLevel: "High",
            reportedCount: 89
        }
    ]
};

// ============ THEME DETECTION SCRIPT ============
const THEME_SCRIPT = `
<script>
(function() {
    var theme = localStorage.getItem('theme');
    if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
})();
</script>`;

// ============ MAIN HTML ============
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;
    
    // Generate stats JSON for animated counting
    const statsJSON = JSON.stringify({
        followers: DATA.celebrity.tiktokFollowers,
        following: DATA.celebrity.tiktokFollowing,
        likes: DATA.celebrity.tiktokLikes
    });
    
    // Gallery photos JSON
    const galleryJSON = JSON.stringify(galleryPhotos.map(p => ({
        src: p.path,
        caption: p.caption || ''
    })));
    
    // Cover songs JSON
    const songsJSON = JSON.stringify(coverSongs);
    
    // Fake accounts JSON
    const fakeJSON = JSON.stringify(DATA.fakeAccounts);
    
    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0f0f1a">
<meta name="description" content="Official Verification Hub for Baiilla Maach - Detect and report fake accounts">
<title>Baiilla Maach | Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
${THEME_SCRIPT}
<style>
/* ===== CSS RESET & VARIABLES ===== */
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --radius-sm: 10px;
    --radius-md: 16px;
    --radius-lg: 22px;
    --radius-xl: 28px;
    --radius-full: 9999px;
    --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.16);
    --shadow-lg: 0 12px 40px rgba(0,0,0,0.24);
    --shadow-xl: 0 24px 60px rgba(0,0,0,0.32);
}

/* Light Theme */
[data-theme="light"] {
    --bg: #f5f5f7;
    --bg2: #ffffff;
    --bg3: #f0f0f5;
    --text: #1d1d1f;
    --text2: #6e6e73;
    --text3: #aeaeb2;
    --border: rgba(0,0,0,0.08);
    --border2: rgba(0,0,0,0.12);
    --card: #ffffff;
    --card-hover: #fafafa;
    --purple: #6366f1;
    --purple-light: #a5b4fc;
    --green: #10b981;
    --green-light: #6ee7b7;
    --red: #ef4444;
    --red-light: #fca5a5;
    --blue: #3b82f6;
    --msg-out: #6366f1;
    --msg-in: #e8e8ed;
    --chat-bg: #f5f5f7;
    --input-bg: #e8e8ed;
    --overlay: rgba(0,0,0,0.5);
    --music-bg: linear-gradient(135deg, #1e1b4b, #312e81);
}

/* Dark Theme */
[data-theme="dark"] {
    --bg: #0a0a14;
    --bg2: #13132b;
    --bg3: #1a1a35;
    --text: #f0f0ff;
    --text2: #a0a0cc;
    --text3: #6060a0;
    --border: rgba(255,255,255,0.06);
    --border2: rgba(255,255,255,0.12);
    --card: #13132b;
    --card-hover: #1a1a35;
    --purple: #8b5cf6;
    --purple-light: #c4b5fd;
    --green: #10b981;
    --green-light: #6ee7b7;
    --red: #ef4444;
    --red-light: #fca5a5;
    --blue: #60a5fa;
    --msg-out: #8b5cf6;
    --msg-in: #1e1e3a;
    --chat-bg: #0a0a14;
    --input-bg: #1a1a35;
    --overlay: rgba(0,0,0,0.7);
    --music-bg: linear-gradient(135deg, #1a1040, #0d0d28);
}

html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
    font-family:var(--font);
    background:var(--bg);
    color:var(--text);
    min-height:100vh;
    line-height:1.5;
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
    transition:background var(--transition),color var(--transition);
}
img{max-width:100%;height:auto;display:block}
a{color:inherit;text-decoration:none}
button{cursor:pointer;font-family:inherit}
input,textarea{font-family:inherit}

/* Scrollbar */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}

/* GPU Acceleration */
.gpu{transform:translateZ(0);will-change:transform;backface-visibility:hidden}

/* Container */
.container{max-width:720px;margin:0 auto;padding:0 16px}

/* Card */
.card{
    background:var(--card);
    border:1px solid var(--border);
    border-radius:var(--radius-lg);
    padding:20px;
    margin-bottom:16px;
    transition:all var(--transition);
}
.card:hover{border-color:var(--border2)}

/* Badge */
.badge{
    display:inline-flex;align-items:center;gap:4px;
    padding:4px 10px;border-radius:var(--radius-full);
    font-size:11px;font-weight:600;
}
.badge-red{background:rgba(239,68,68,0.12);color:var(--red);border:1px solid rgba(239,68,68,0.2)}
.badge-green{background:rgba(16,185,129,0.12);color:var(--green);border:1px solid rgba(16,185,129,0.2)}
.badge-purple{background:rgba(139,92,246,0.12);color:var(--purple);border:1px solid rgba(139,92,246,0.2)}

/* Buttons */
.btn{
    display:inline-flex;align-items:center;justify-content:center;gap:6px;
    padding:8px 16px;border-radius:var(--radius-full);
    font-size:13px;font-weight:600;border:none;
    transition:all var(--transition);white-space:nowrap;
    cursor:pointer;outline:none;
}
.btn:active{transform:scale(0.96)}
.btn-primary{background:var(--purple);color:#fff}
.btn-primary:hover{filter:brightness(1.1)}
.btn-danger{background:var(--red);color:#fff}
.btn-success{background:var(--green);color:#fff}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text2)}
.btn-ghost:hover{border-color:var(--purple);color:var(--purple)}
.btn-sm{padding:5px 10px;font-size:11px}
.btn-lg{padding:12px 24px;font-size:15px}

/* Header */
.header{
    position:sticky;top:0;z-index:50;
    background:var(--bg2);
    border-bottom:1px solid var(--border);
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
}
.header-inner{
    display:flex;align-items:center;justify-content:space-between;
    max-width:720px;margin:0 auto;padding:10px 16px;gap:12px;
}
.header-logo{display:flex;align-items:center;gap:10px}
.header-avatar{
    width:34px;height:34px;border-radius:50%;
    object-fit:cover;border:2px solid var(--purple);
}
.header-title{font-weight:700;font-size:15px;color:var(--text)}
.header-actions{display:flex;gap:8px;align-items:center}

/* Theme Toggle */
.theme-toggle{
    width:36px;height:36px;border-radius:50%;
    background:var(--bg3);border:1px solid var(--border);
    display:flex;align-items:center;justify-content:center;
    font-size:16px;cursor:pointer;transition:all var(--transition);
}
.theme-toggle:hover{background:var(--border2)}

/* Profile Section */
.profile{
    text-align:center;padding:24px 0 16px;
}
.profile-pic-wrap{
    position:relative;display:inline-block;margin-bottom:12px;
}
.profile-pic{
    width:96px;height:96px;border-radius:50%;
    object-fit:cover;border:3px solid var(--purple);
    box-shadow:0 0 30px rgba(99,102,241,0.3);
}
.verified-badge{
    position:absolute;bottom:4px;right:4px;
    width:26px;height:26px;
    background:var(--green);
    border-radius:50%;border:3px solid var(--bg);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(16,185,129,0.3);
}
.verified-badge svg{width:14px;height:14px;fill:#fff}
.profile-name{font-size:22px;font-weight:800;margin-top:8px}
.profile-bio{color:var(--text2);font-size:13px;margin-top:4px}

/* Stats */
.stats{display:flex;justify-content:center;gap:12px;margin:16px 0;flex-wrap:wrap}
.stat-card{
    background:var(--bg3);border:1px solid var(--border);
    border-radius:var(--radius-md);padding:14px 20px;
    text-align:center;min-width:80px;transition:all var(--transition);
}
.stat-card:hover{border-color:var(--purple)}
.stat-value{font-size:22px;font-weight:700;color:var(--purple);font-variant-numeric:tabular-nums}
.stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-top:4px}

/* Section Header */
.section-hdr{
    display:flex;align-items:center;gap:10px;
    margin-bottom:14px;padding-bottom:12px;
    border-bottom:1px solid var(--border);
}
.section-hdr h2{font-size:16px;font-weight:700}
.section-hdr p{font-size:11px;color:var(--text3);margin-top:2px}

/* Fake Cards */
.fake-card{
    background:rgba(239,68,68,0.04);
    border:1px solid rgba(239,68,68,0.15);
    border-radius:var(--radius-md);padding:14px;
    margin-bottom:10px;transition:all var(--transition);
}
.fake-card:hover{border-color:rgba(239,68,68,0.3)}
.fake-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.fake-card-username{font-weight:700;color:var(--red-light);font-size:14px}
.fake-card-reason{font-size:12px;color:var(--text2);margin-bottom:8px}
.fake-card-actions{display:flex;gap:6px;flex-wrap:wrap}

/* Official Cards */
.official-card{
    background:rgba(16,185,129,0.04);
    border:1px solid rgba(16,185,129,0.15);
    border-radius:var(--radius-md);padding:14px;
    margin-bottom:10px;display:flex;align-items:center;gap:12px;
    transition:all var(--transition);
}
.official-card:hover{border-color:rgba(16,185,129,0.3)}
.official-platform{font-weight:600;font-size:14px}
.official-followers{font-size:11px;color:var(--text3)}

/* Music Player */
.music-player{
    background:var(--music-bg);border-radius:var(--radius-xl);
    padding:22px;margin:16px 0;position:relative;overflow:hidden;
    color:#fff;
}
.music-header{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.music-header-icon{width:22px;height:22px;flex-shrink:0}
.album-art{
    width:64px;height:64px;border-radius:var(--radius-md);
    background:rgba(255,255,255,0.1);display:flex;
    align-items:center;justify-content:center;font-size:28px;
    flex-shrink:0;overflow:hidden;
    border:2px solid rgba(255,255,255,0.15);
}
.album-art img{width:100%;height:100%;object-fit:cover}
.play-btn{
    width:48px;height:48px;border-radius:50%;
    background:#1db954;border:none;color:#000;
    font-size:18px;cursor:pointer;display:flex;
    align-items:center;justify-content:center;
    box-shadow:0 0 25px rgba(29,185,84,0.4);
    transition:all var(--transition);flex-shrink:0;
}
.play-btn:hover{transform:scale(1.08)}
.play-btn:active{transform:scale(0.94)}
.progress-wrap{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.progress-bar{flex:1;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;cursor:pointer;overflow:hidden}
.progress-fill{height:100%;background:#1db954;width:0%;transition:width 0.1s linear}
.time{font-size:10px;opacity:0.7;min-width:30px}
.song-list{max-height:200px;overflow-y:auto}
.song-item{
    display:flex;align-items:center;gap:8px;
    padding:10px 12px;border-radius:10px;
    cursor:pointer;transition:background 0.15s;
    font-size:13px;
}
.song-item:hover{background:rgba(255,255,255,0.06)}
.song-item.active{background:rgba(29,185,84,0.2)}

/* Chat Widget */
.chat-launcher{position:fixed;bottom:20px;right:20px;z-index:999}
.chat-launch-btn{
    width:56px;height:56px;border-radius:50%;
    background:linear-gradient(135deg,var(--purple),#ec4899);
    border:none;color:#fff;font-size:24px;cursor:pointer;
    box-shadow:0 8px 30px rgba(139,92,246,0.4);
    transition:all var(--transition);
    display:flex;align-items:center;justify-content:center;
}
.chat-launch-btn:hover{transform:scale(1.08)}

.chat-modal{
    position:fixed;top:0;left:0;right:0;bottom:0;
    z-index:1000;background:var(--bg);
    display:none;flex-direction:column;
    animation:fadeIn 0.2s ease;
}
.chat-modal.open{display:flex}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

.chat-modal-header{
    display:flex;align-items:center;gap:10px;
    padding:12px 14px;background:var(--bg2);
    border-bottom:1px solid var(--border);
}
.chat-modal-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover}
.chat-modal-name{font-weight:600;font-size:15px}
.chat-modal-status{font-size:11px;color:var(--text3)}
.chat-modal-close{
    margin-left:auto;width:30px;height:30px;border-radius:50%;
    background:var(--bg3);border:none;color:var(--text);
    font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;
}

.chat-messages{
    flex:1;overflow-y:auto;padding:14px;
    background:var(--chat-bg);
}
.msg-bubble{
    max-width:78%;padding:8px 12px;margin-bottom:5px;
    border-radius:18px;font-size:13px;line-height:1.4;
    animation:msgIn 0.2s ease;word-break:break-word;
    position:relative;
}
@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg-bubble.out{background:var(--msg-out);color:#fff;margin-left:auto;border-bottom-right-radius:6px}
.msg-bubble.in{background:var(--msg-in);color:var(--text);margin-right:auto;border-bottom-left-radius:6px}
.msg-bubble img{max-width:200px;border-radius:12px;margin-top:4px;cursor:pointer}
.msg-time{font-size:9px;opacity:0.6;margin-top:3px;text-align:right}

.chat-login{
    flex:1;display:flex;flex-direction:column;
    justify-content:center;padding:30px;text-align:center;
}
.chat-login input{
    width:100%;padding:10px 14px;background:var(--input-bg);
    border:1px solid var(--border);border-radius:10px;
    color:var(--text);font-size:13px;margin-bottom:8px;outline:none;
}
.chat-login input:focus{border-color:var(--purple)}
.chat-login .login-btn{
    width:100%;padding:12px;background:var(--purple);
    color:#fff;border:none;border-radius:10px;
    font-weight:600;cursor:pointer;font-size:14px;
}

.chat-composer{
    padding:10px 12px;background:var(--bg2);
    border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;
}
.chat-composer input{
    flex:1;padding:9px 14px;background:var(--input-bg);
    border:1px solid var(--border);border-radius:22px;
    color:var(--text);font-size:13px;outline:none;
}
.chat-composer input:focus{border-color:var(--purple)}
.chat-composer .send-btn{
    width:36px;height:36px;border-radius:50%;
    background:var(--purple);border:none;color:#fff;
    font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
}
.chat-composer .img-upload-btn{
    width:36px;height:36px;border-radius:50%;
    background:var(--bg3);border:1px solid var(--border);
    color:var(--text2);font-size:16px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
}

/* Gallery */
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.gallery-item{
    border-radius:var(--radius-md);overflow:hidden;
    border:1px solid var(--border);cursor:pointer;
    transition:all var(--transition);aspect-ratio:1;
}
.gallery-item:hover{transform:translateY(-3px);box-shadow:var(--shadow-md)}
.gallery-item img{width:100%;height:100%;object-fit:cover}

/* Lightbox */
.lightbox{
    position:fixed;top:0;left:0;right:0;bottom:0;
    z-index:2000;background:var(--overlay);
    display:none;align-items:center;justify-content:center;
    cursor:pointer;
}
.lightbox.active{display:flex}
.lightbox img{max-width:90vw;max-height:90vh;border-radius:12px}

/* Toast */
.toast{
    position:fixed;top:16px;right:16px;z-index:9999;
    background:var(--card);border:1px solid var(--border);
    padding:12px 16px;border-radius:10px;font-size:13px;
    transform:translateX(120%);transition:transform 0.3s ease;
    box-shadow:var(--shadow-lg);max-width:300px;
}
.toast.show{transform:translateX(0)}
.toast.error{border-left:3px solid var(--red)}
.toast.success{border-left:3px solid var(--green)}

/* Responsive */
@media(min-width:768px){
    .chat-modal{max-width:420px;right:0;left:auto;border-left:1px solid var(--border)}
}
@media(max-width:480px){
    .profile-pic{width:80px;height:80px}
    .stat-card{padding:10px 14px;min-width:70px}
    .stat-value{font-size:18px}
}
</style>
</head>
<body>

<div id="toast" class="toast"></div>

<header class="header">
<div class="header-inner">
<div class="header-logo">
<img src="${profilePic}" alt="Profile" class="header-avatar" loading="eager" width="34" height="34">
<span class="header-title">Verification Hub</span>
</div>
<div class="header-actions">
<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme" id="themeIcon">🌙</button>
</div>
</div>
</header>

<main class="container" style="padding-top:8px">

<!-- Profile Section -->
<section class="profile">
<div class="profile-pic-wrap gpu">
<img src="${profilePic}" alt="${DATA.celebrity.name}" class="profile-pic" width="96" height="96" loading="eager">
<div class="verified-badge">
<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
</div>
</div>
<h1 class="profile-name">${DATA.celebrity.fullName}</h1>
<p class="profile-bio">${DATA.celebrity.bio}</p>
<div class="stats" id="statsContainer"></div>
<div style="display:flex;gap:6px;justify-content:center;margin-top:8px">
<span class="badge badge-green">Verified</span>
<span class="badge badge-purple">Creator</span>
</div>
</section>

<!-- Fake Accounts Section -->
<section class="card" id="fakeSection" style="border-left:3px solid var(--red)">
<div class="section-hdr">
<span style="font-size:20px">⚠️</span>
<div>
<h2 style="color:var(--red-light)">Fake Accounts Detected</h2>
<p>Report these impersonating accounts</p>
</div>
<span class="badge badge-red" id="fakeCount"></span>
</div>
<div id="fakeCards"></div>
<audio id="fakeVoice" src="/assets/7%20lak%20like%20but%20its%20fake.mp3" preload="none"></audio>
</section>

<!-- Music Player -->
<section id="musicSection" style="display:none"></section>

<!-- Official Accounts -->
<section class="card" style="border-left:3px solid var(--green)">
<div class="section-hdr">
<span style="font-size:20px">✓</span>
<div>
<h2 style="color:var(--green-light)">Official Accounts</h2>
<p>Only follow these verified accounts</p>
</div>
</div>
<div id="officialCards"></div>
</section>

<!-- Gallery -->
<section class="card">
<div class="section-hdr">
<span style="font-size:20px">📸</span>
<div><h2>Photo Gallery</h2><p>Official moments</p></div>
</div>
<div class="gallery-grid" id="galleryGrid"></div>
</section>

</main>

<!-- Chat Launcher -->
<div class="chat-launcher">
<button class="chat-launch-btn" onclick="openChat()" aria-label="Open chat">💬</button>
</div>

<!-- Chat Modal -->
<div class="chat-modal" id="chatModal">
<div class="chat-modal-header">
<img src="${profilePic}" alt="Admin" class="chat-modal-avatar" width="38" height="38">
<div>
<div class="chat-modal-name">Hammad Bin Amir</div>
<div class="chat-modal-status" id="chatStatus">${statusText}</div>
</div>
<button class="chat-modal-close" onclick="closeChat()" aria-label="Close chat">✕</button>
</div>
<div id="chatLogin" class="chat-login">
<div style="font-size:40px;margin-bottom:12px">💬</div>
<h3 style="margin-bottom:6px">Start Conversation</h3>
<p style="color:var(--text3);font-size:12px;margin-bottom:18px">Enter your details to chat with support</p>
<input type="text" id="chatName" placeholder="Your name" autocomplete="name">
<input type="text" id="chatContact" placeholder="Email or phone" autocomplete="email">
<button class="login-btn" onclick="registerChat()">Start Chat</button>
</div>
<div id="chatMessages" class="chat-messages" style="display:none"></div>
<div class="chat-composer" id="chatComposer" style="display:none">
<label class="img-upload-btn" for="chatImageInput" title="Send image">🖼️</label>
<input type="file" id="chatImageInput" accept="image/*" style="display:none" onchange="sendImageMessage(event)">
<input type="text" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendTextMessage()">
<button class="send-btn" onclick="sendTextMessage()" aria-label="Send">➤</button>
</div>
</div>

<!-- Lightbox -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
<img src="" alt="Preview" id="lightboxImg">
</div>

<script>
// ============ GLOBAL STATE ============
var statsData = ${statsJSON};
var galleryData = ${galleryJSON};
var songsData = ${songsJSON};
var fakeData = ${fakeJSON};
var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

// ============ THEME ============
function toggleTheme() {
    isDark = !isDark;
    var theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.getElementById('themeIcon').textContent = isDark ? '🌙' : '☀️';
    document.querySelector('meta[name="theme-color"]').content = isDark ? '#0f0f1a' : '#f5f5f7';
}
document.getElementById('themeIcon').textContent = isDark ? '🌙' : '☀️';

// ============ TOAST ============
function showToast(msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ============ ANIMATED STATS ============
function animateStats() {
    var container = document.getElementById('statsContainer');
    var labels = ['Followers', 'Following', 'Likes'];
    var values = [statsData.followers, statsData.following, statsData.likes];
    var html = '';
    
    values.forEach(function(val, i) {
        html += '<div class="stat-card"><div class="stat-value" id="stat' + i + '">0</div><div class="stat-label">' + labels[i] + '</div></div>';
    });
    container.innerHTML = html;
    
    values.forEach(function(target, i) {
        animateCount('stat' + i, 0, target, 1500);
    });
}

function animateCount(id, start, end, duration) {
    var el = document.getElementById(id);
    if (!el) return;
    var range = end - start;
    var startTime = null;
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.floor(start + range * eased);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ============ RENDER FAKE ACCOUNTS ============
function renderFakeAccounts() {
    var container = document.getElementById('fakeCards');
    document.getElementById('fakeCount').textContent = fakeData.length + ' Active';
    
    container.innerHTML = fakeData.map(function(a, i) {
        return '<div class="fake-card">' +
            '<div class="fake-card-header">' +
                '<span style="font-size:12px;color:var(--text3)">Fake #' + (i+1) + '</span>' +
                '<span class="badge badge-red">' + a.threatLevel + '</span>' +
            '</div>' +
            '<div class="fake-card-username">' + a.username + '</div>' +
            '<div class="fake-card-reason">⚠ ' + a.reason + '</div>' +
            '<div class="fake-card-actions">' +
                '<a href="' + a.profileUrl + '" target="_blank" rel="noopener" class="btn btn-danger btn-sm">Report</a>' +
                '<button onclick="copyText(\'' + a.username + '\')" class="btn btn-ghost btn-sm">Copy</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// ============ RENDER OFFICIAL ACCOUNTS ============
function renderOfficialAccounts() {
    var container = document.getElementById('officialCards');
    var accounts = [
        { platform: 'TikTok', username: '@baiillamaach_official', url: 'https://tiktok.com/@baiillamaach_official', followers: '5,000' },
        { platform: 'Facebook', username: 'Baiilla Maach Official', url: 'https://www.facebook.com/profile.php?id=61575202118828', followers: 'Growing' }
    ];
    
    container.innerHTML = accounts.map(function(a) {
        return '<div class="official-card">' +
            '<div style="flex:1">' +
                '<div class="official-platform">' + a.username + ' <span class="badge badge-green" style="font-size:10px">✓</span></div>' +
                '<div class="official-followers">' + a.followers + ' followers</div>' +
            '</div>' +
            '<a href="' + a.url + '" target="_blank" rel="noopener" class="btn btn-success btn-sm">Follow</a>' +
        '</div>';
    }).join('');
}

// ============ RENDER MUSIC PLAYER ============
function renderMusicPlayer() {
    var section = document.getElementById('musicSection');
    if (songsData.length === 0) return;
    section.style.display = 'block';
    
    section.innerHTML = '<div class="music-player">' +
        '<div class="music-header">' +
            '<span>🎵</span><span style="font-weight:700;font-size:15px">Cover Music</span>' +
            '<span style="font-size:11px;opacity:0.6;margin-left:auto">' + songsData.length + ' tracks</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
            '<div class="album-art" id="albumArt"><span>🎵</span></div>' +
            '<div style="flex:1"><div id="currentTitle" style="font-weight:600;font-size:14px">Select a Song</div><div id="currentArtist" style="font-size:11px;opacity:0.6">Cover Music</div></div>' +
            '<button class="play-btn" id="playBtn" onclick="toggleMusic()">▶️</button>' +
        '</div>' +
        '<div class="progress-wrap">' +
            '<span class="time" id="curTime">0:00</span>' +
            '<div class="progress-bar" onclick="seekMusic(event)"><div class="progress-fill" id="progFill"></div></div>' +
            '<span class="time" id="totTime">0:00</span>' +
        '</div>' +
        '<div class="song-list">' + songsData.map(function(s, i) {
            return '<div class="song-item" onclick="playSong(' + i + ')" id="song-' + i + '">' +
                '<span style="opacity:0.5;font-size:11px;width:24px">' + String(i+1).padStart(2,'0') + '</span>' +
                '<span style="flex:1;font-size:13px">' + s.title + '</span>' +
                '<span style="font-size:11px;opacity:0.4">▶</span>' +
            '</div>';
        }).join('') + '</div>' +
        '<audio id="musicAudio" preload="none"></audio>' +
    '</div>';
}

// ============ MUSIC CONTROLS ============
var currentSong = null, isMusicPlaying = false;

function playSong(index) {
    var audio = document.getElementById('musicAudio');
    var song = songsData[index];
    
    if (currentSong === index) { toggleMusic(); return; }
    currentSong = index;
    audio.src = song.audioUrl;
    
    document.getElementById('currentTitle').textContent = song.title;
    document.getElementById('currentArtist').textContent = song.artist;
    document.getElementById('albumArt').innerHTML = song.coverUrl ? 
        '<img src="' + song.coverUrl + '" alt="Cover">' : '<span>🎵</span>';
    
    // Highlight
    document.querySelectorAll('.song-item').forEach(function(el, i) {
        el.classList.toggle('active', i === index);
    });
    
    audio.play().then(function() {
        isMusicPlaying = true;
        document.getElementById('playBtn').textContent = '⏸️';
    }).catch(function() { showToast('Error playing audio', 'error'); });
    
    audio.ontimeupdate = function() {
        if (audio.duration) {
            document.getElementById('progFill').style.width = (audio.currentTime / audio.duration * 100) + '%';
            document.getElementById('curTime').textContent = fmtTime(audio.currentTime);
        }
    };
    audio.onloadedmetadata = function() {
        document.getElementById('totTime').textContent = fmtTime(audio.duration);
    };
    audio.onended = function() {
        isMusicPlaying = false;
        document.getElementById('playBtn').textContent = '▶️';
        currentSong = null;
    };
}

function toggleMusic() {
    var audio = document.getElementById('musicAudio');
    if (!audio.src || currentSong === null) { showToast('Select a song', 'error'); return; }
    if (isMusicPlaying) {
        audio.pause(); isMusicPlaying = false;
        document.getElementById('playBtn').textContent = '▶️';
    } else {
        audio.play().then(function() {
            isMusicPlaying = true;
            document.getElementById('playBtn').textContent = '⏸️';
        }).catch(function() { showToast('Error', 'error'); });
    }
}

function seekMusic(e) {
    var audio = document.getElementById('musicAudio');
    if (!audio.duration) return;
    var rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
}

function fmtTime(s) {
    if (isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

// ============ COPY ============
function copyText(text) {
    navigator.clipboard.writeText(text).then(function() {
        showToast('Copied!', 'success');
    });
}

// ============ GALLERY ============
function renderGallery() {
    var grid = document.getElementById('galleryGrid');
    if (galleryData.length === 0) {
        grid.innerHTML = '<p style="color:var(--text3);text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>';
        return;
    }
    grid.innerHTML = galleryData.map(function(p) {
        return '<div class="gallery-item" onclick="openLightbox(\'' + p.src + '\')">' +
            '<img src="' + p.src + '" alt="Photo" loading="lazy" width="200" height="200">' +
        '</div>';
    }).join('');
}

function openLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

// ============ CHAT ============
var chatToken = localStorage.getItem('chatToken');
var chatId = null;
var pollInterval = null;

if (chatToken) verifyChatToken();

function verifyChatToken() {
    fetch('/api/chat/verify?token=' + encodeURIComponent(chatToken))
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) { chatId = d.chatId; showChatUI(); loadMessages(); startPolling(); }
        else { localStorage.removeItem('chatToken'); chatToken = null; }
    });
}

function openChat() {
    document.getElementById('chatModal').classList.add('open');
    if (chatToken) loadMessages();
}

function closeChat() {
    document.getElementById('chatModal').classList.remove('open');
}

function showChatUI() {
    document.getElementById('chatLogin').style.display = 'none';
    document.getElementById('chatMessages').style.display = 'block';
    document.getElementById('chatComposer').style.display = 'flex';
}

function registerChat() {
    var name = document.getElementById('chatName').value.trim();
    var contact = document.getElementById('chatContact').value.trim();
    if (!name) { showToast('Enter your name', 'error'); return; }
    if (!contact) { showToast('Enter contact', 'error'); return; }
    
    fetch('/api/chat/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phoneEmail: contact })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            chatToken = d.token;
            chatId = d.chatId;
            localStorage.setItem('chatToken', chatToken);
            showChatUI();
            loadMessages();
            startPolling();
            showToast('Connected!', 'success');
        } else { showToast(d.error || 'Failed', 'error'); }
    })
    .catch(function() { showToast('Network error', 'error'); });
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 2000);
}

function loadMessages() {
    if (!chatToken) return;
    fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken) + '&t=' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            var container = document.getElementById('chatMessages');
            container.innerHTML = '';
            d.messages.forEach(function(m) {
                renderMessage(m, container);
            });
            container.scrollTop = container.scrollHeight;
        } else {
            clearInterval(pollInterval);
            localStorage.removeItem('chatToken');
            chatToken = null;
            document.getElementById('chatLogin').style.display = 'flex';
            document.getElementById('chatMessages').style.display = 'none';
            document.getElementById('chatComposer').style.display = 'none';
        }
    });
}

function renderMessage(m, container) {
    var div = document.createElement('div');
    div.className = 'msg-bubble ' + (m.sender === 'user' ? 'out' : 'in');
    
    var html = m.message;
    
    if (m.type === 'image' && m.imageUrl) {
        html = '<img src="' + m.imageUrl + '" alt="Image" loading="lazy" onclick="openLightbox(\'' + m.imageUrl + '\')" style="max-width:200px;border-radius:12px;cursor:pointer">';
    }
    
    html += '<div class="msg-time">' + 
        new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        (m.sender === 'user' ? (m.read ? ' ✓✓' : ' ✓') : '') +
    '</div>';
    
    div.innerHTML = html;
    container.appendChild(div);
}

function sendTextMessage() {
    var input = document.getElementById('chatInput');
    var msg = input.value.trim();
    if (!msg || !chatToken) return;
    input.value = '';
    
    fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: chatToken, message: msg, type: 'text' })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.success) loadMessages(); });
}

function sendImageMessage(event) {
    var file = event.target.files[0];
    if (!file || !chatToken) return;
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image too large (max 10MB)', 'error');
        return;
    }
    
    var formData = new FormData();
    formData.append('image', file);
    formData.append('token', chatToken);
    
    showToast('Uploading...', 'success');
    
    fetch('/api/chat/send-image', {
        method: 'POST',
        body: formData
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            loadMessages();
            showToast('Sent!', 'success');
        } else {
            showToast(d.error || 'Upload failed', 'error');
        }
    })
    .catch(function() { showToast('Upload error', 'error'); });
    
    event.target.value = '';
}

// ============ FAKE VOICE ============
var fakePlaying = false;
function toggleFakeVoice() {
    var audio = document.getElementById('fakeVoice');
    if (fakePlaying) {
        audio.pause();
        audio.currentTime = 0;
        fakePlaying = false;
    } else {
        audio.play().then(function() { fakePlaying = true; })
        .catch(function() { showToast('Error', 'error'); });
    }
    audio.onended = function() { fakePlaying = false; };
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function() {
    animateStats();
    renderFakeAccounts();
    renderOfficialAccounts();
    renderMusicPlayer();
    renderGallery();
});

// Keyboard shortcut for lightbox
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
});

// Service worker registration for offline support
if ('serviceWorker' in navigator) {
    // Could register SW here for offline caching
}
</script>
</body>
</html>`;
}

// ============ ADMIN HTML ============
function getLoginHTML(error) {
    error = error || '';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin | Login</title><style>${ADMIN_CSS}</style></head><body><div class="login-card"><h2>Admin Login</h2>${error?'<div class="err">'+error+'</div>':''}<form method="POST" action="/admin/login"><input name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button>Sign In</button></form><a href="/">← Back to Site</a></div></body></html>`;
}

const ADMIN_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a14;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#f0f0ff}
.login-card{background:#13132b;border:1px solid rgba(255,255,255,.06);border-radius:24px;padding:40px;width:100%;max-width:380px}
.login-card h2{text-align:center;margin-bottom:24px;font-size:22px}
.login-card input{width:100%;padding:14px;background:#1a1a35;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#f0f0ff;margin-bottom:12px;font-size:14px;outline:none}
.login-card input:focus{border-color:#8b5cf6}
.login-card button{width:100%;padding:14px;background:#8b5cf6;color:#fff;border:none;border-radius:12px;font-weight:600;font-size:15px;cursor:pointer}
.login-card .err{background:rgba(239,68,68,.1);color:#fca5a5;padding:10px;border-radius:10px;margin-bottom:16px;font-size:13px;text-align:center}
.login-card a{color:#6060a0;text-decoration:none;font-size:13px;display:block;text-align:center;margin-top:16px}
`;

function getAdminPanelHTML(photos, msg, err) {
    photos = photos || [];
    msg = msg || '';
    err = err || '';
    
    const photoCards = photos.map(p => 
        `<div style="background:#13132b;border:1px solid rgba(255,255,255,.06);border-radius:16px;overflow:hidden">
            <img src="${p.path}" style="width:100%;height:150px;object-fit:cover" alt="Photo" loading="lazy">
            <div style="padding:12px">
                <p style="font-size:13px;color:#a0a0cc">${p.caption||''}</p>
                <form method="POST" action="/admin/delete" style="margin-top:8px">
                    <input type="hidden" name="photoId" value="${p._id}">
                    <button style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px">Delete</button>
                </form>
            </div>
        </div>`
    ).join('') || '<p style="color:#6060a0;text-align:center;padding:40px;grid-column:1/-1">No photos</p>';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title>
    <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#0a0a14;color:#f0f0ff;min-height:100vh}
    .hdr{background:#13132b;border-bottom:1px solid rgba(255,255,255,.06);padding:14px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100}
    .hdr h1{font-size:17px;background:linear-gradient(135deg,#c4b5fd,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .hdr nav{display:flex;gap:8px}
    .hdr nav a{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;text-decoration:none}
    .btn-p{background:#8b5cf6;color:#fff}
    .btn-g{background:#1a1a35;color:#a0a0cc;border:1px solid rgba(255,255,255,.1)}
    .btn-r{background:rgba(239,68,68,.15);color:#fca5a5}
    .ct{max-width:1100px;margin:0 auto;padding:20px}
    .card{background:#13132b;border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:22px;margin-bottom:18px}
    .card h2{font-size:17px;margin-bottom:14px}
    .card input[type=file]{margin-bottom:10px;color:#a0a0cc}
    .card input[type=text]{width:100%;padding:11px;background:#1a1a35;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#f0f0ff;margin-bottom:10px;outline:none}
    .card button[type=submit]{width:100%;padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px}
    .gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
    .ok{background:rgba(16,185,129,.1);color:#6ee7b7;padding:12px 16px;border-radius:12px;margin-bottom:16px}
    .no{background:rgba(239,68,68,.1);color:#fca5a5;padding:12px 16px;border-radius:12px;margin-bottom:16px}
    </style></head><body>
    <header class="hdr"><h1>Admin Panel</h1><nav><a href="/admin/chat" class="btn-p">Chats</a><a href="/" class="btn-g">View Site</a><a href="/admin/logout" class="btn-r">Logout</a></nav></header>
    <div class="ct">
        ${msg?'<div class="ok">'+msg+'</div>':''}
        ${err?'<div class="no">'+err+'</div>':''}
        <div class="card">
            <h2>Upload Photo</h2>
            <form method="POST" action="/admin/upload" enctype="multipart/form-data">
                <input type="file" name="photo" accept="image/*" required>
                <input type="text" name="caption" placeholder="Caption (optional)">
                <button type="submit">Upload Photo</button>
            </form>
        </div>
        <h2 style="font-size:19px;margin-bottom:14px">Gallery (${photos.length})</h2>
        <div class="gal">${photoCards}</div>
    </div></body></html>`;
}

// ============ SERVER ============
const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);
    
    // Static assets
    if (pathname.startsWith('/assets/')) {
        const decodedPath = decodeURIComponent(pathname);
        const assetPath = path.join(__dir, decodedPath);
        
        // Security: prevent path traversal
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        if (!fs.existsSync(assetPath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        
        const ext = path.extname(assetPath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        const cacheControl = ext.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/) 
            ? CACHE_CONTROL.images 
            : CACHE_CONTROL.html;
        
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': cacheControl,
            'X-Content-Type-Options': 'nosniff'
        });
        
        const stream = fs.createReadStream(assetPath);
        stream.pipe(res);
        stream.on('error', () => {
            if (!res.headersSent) {
                res.writeHead(500);
                res.end();
            }
        });
        return;
    }
    
    // Chat API
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                if (!name || !phoneEmail) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'All fields required' }));
                    return;
                }
                
                const user = await createOrGetChatUser(name, phoneEmail);
                if (!user) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Account banned or error' }));
                    return;
                }
                
                const token = await createChatSession(user.chatId);
                const messages = await getChatMessages(user.chatId);
                if (messages.length === 0) {
                    await saveChatMessage(user.chatId, 'admin', 'Hello! How can I help you? 👋');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/verify' && method === 'GET') {
        const user = await getChatUserByToken(parsedUrl.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!user, chatId: user ? user.chatId : null }));
        return;
    }
    
    if (pathname === '/api/chat/messages' && method === 'GET') {
        const user = await getChatUserByToken(parsedUrl.query.token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        const messages = await getChatMessages(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { token, message, type } = JSON.parse(body);
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false }));
                    return;
                }
                await saveChatMessage(user.chatId, 'user', message, type || 'text');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/send-image' && method === 'POST') {
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE,
            filter: function (part) {
                return part.mimetype && ALLOWED_TYPES.includes(part.mimetype);
            }
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Upload error' }));
                return;
            }
            
            const token = Array.isArray(fields.token) ? fields.token[0] : fields.token;
            const user = await getChatUserByToken(token);
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid session' }));
                return;
            }
            
            const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
            if (!imageFile || !imageFile.originalFilename) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No image' }));
                return;
            }
            
            const result = await processImage(imageFile.filepath, CHAT_UPLOADS_DIR);
            if (!result) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Processing error' }));
                return;
            }
            
            await saveChatMessage(user.chatId, 'user', '📷 Image', 'image', result.path);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, imageUrl: result.path }));
        });
        return;
    }
    
    // Admin routes
    if (pathname === '/admin' && method === 'GET') {
        const session = getSession(cookies.sessionId);
        if (session) {
            adminPresence.isOnline = true;
            adminPresence.lastSeen = new Date();
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(getAdminPanelHTML(photos));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getLoginHTML());
        return;
    }
    
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            if (await verifyAdmin(username, password)) {
                const sid = createSession(username);
                adminPresence.isOnline = true;
                adminPresence.lastSeen = new Date();
                await logAdminAction(username, 'login');
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`
                });
                res.end();
            } else {
                await logAdminAction(username || 'unknown', 'failed_login');
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(getLoginHTML('Invalid credentials'));
            }
        });
        return;
    }
    
    if (pathname === '/admin/logout') {
        const session = getSession(cookies.sessionId);
        if (session) await logAdminAction(session.username, 'logout');
        sessions.delete(cookies.sessionId);
        adminPresence.isOnline = false;
        adminPresence.lastSeen = new Date();
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0'
        });
        res.end();
        return;
    }
    
    if (pathname === '/admin/chat' && method === 'GET') {
        const session = getSession(cookies.sessionId);
        if (!session) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        
        adminPresence.isOnline = true;
        adminPresence.lastSeen = new Date();
        
        const chatId = parsedUrl.query.chatId;
        const chatList = await getAdminChatList();
        let messages = [];
        
        if (chatId) {
            messages = await getChatMessages(chatId);
            await markMessagesRead(chatId);
        }
        
        // Simple admin chat HTML
        const userListHTML = chatList.map(c => 
            `<div onclick="location.href='/admin/chat?chatId=${c.chatId}'" style="padding:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06);${c.chatId===chatId?'background:rgba(139,92,246,.2)':''}">
                <div style="font-weight:600">${c.name}</div>
                <div style="font-size:12px;opacity:.6">${c.phoneEmail}</div>
                ${c.unread>0?`<span style="background:#8b5cf6;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px">${c.unread}</span>`:''}
            </div>`
        ).join('');
        
        const msgHTML = messages.map(m => 
            `<div style="margin-bottom:8px;text-align:${m.sender==='user'?'left':'right'}">
                <div style="display:inline-block;max-width:70%;padding:8px 12px;border-radius:14px;${m.sender==='user'?'background:#1a1a35':'background:#8b5cf6'}">
                    ${m.type==='image'&&m.imageUrl?`<img src="${m.imageUrl}" style="max-width:200px;border-radius:8px;cursor:pointer">`:m.message}
                </div>
            </div>`
        ).join('');
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat Admin</title>
        <style>body{margin:0;display:flex;height:100vh;font-family:system-ui;background:#0a0a14;color:#f0f0ff}.sb{width:340px;background:#13132b;border-right:1px solid rgba(255,255,255,.06);overflow-y:auto}.mn{flex:1;display:flex;flex-direction:column}.msgs{flex:1;overflow-y:auto;padding:16px;background:#0a0a14}.ia{padding:14px;background:#13132b;display:flex;gap:8px}.ia input{flex:1;padding:9px 14px;background:#1a1a35;border:1px solid rgba(255,255,255,.1);border-radius:20px;color:#f0f0ff;outline:none;font-size:13px}.ia button{background:#8b5cf6;color:#fff;border:none;padding:9px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:13px}</style></head><body>
        <div class="sb"><div style="padding:14px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);font-weight:700">Chats <a href="/admin" style="color:#fff;float:right;font-size:12px;text-decoration:none">←</a></div>${userListHTML}</div>
        <div class="mn">${chatId?`<div style="padding:12px;background:#13132b;font-weight:600">${(chatList.find(c=>c.chatId===chatId)||{}).name||'User'}</div><div class="msgs" id="mc">${msgHTML}</div><div class="ia"><input id="am" placeholder="Reply..." onkeypress="if(event.key==='Enter')sm()"><button onclick="sm()">Send</button></div><script>let cid="${chatId}";function lm(){fetch("/api/admin/messages?chatId="+cid).then(r=>r.json()).then(d=>{if(d.success){document.getElementById("mc").innerHTML=d.messages.map(m=>'<div style="margin-bottom:8px;text-align:'+(m.sender==="user"?"left":"right")+'"><div style="display:inline-block;max-width:70%;padding:8px 12px;border-radius:14px;'+(m.sender==="user"?"background:#1a1a35":"background:#8b5cf6")+'">'+(m.type==="image"&&m.imageUrl?'<img src="'+m.imageUrl+'" style="max-width:200px;border-radius:8px">':m.message)+'</div></div>').join("")}})}function sm(){var i=document.getElementById("am");fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:i.value})}).then(()=>{i.value="";lm()})}setInterval(lm,2000);</script>`:'<div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:.5">Select a chat</div>'}</div></body></html>`);
        return;
    }
    
    if (pathname === '/api/admin/messages' && method === 'GET') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        const messages = await getChatMessages(parsedUrl.query.chatId);
        await markMessagesRead(parsedUrl.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    if (pathname === '/api/admin/send' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const { chatId, message } = JSON.parse(body);
            await saveChatMessage(chatId, 'admin', message);
            adminPresence.isOnline = true;
            adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    if (pathname === '/admin/upload' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: GALLERY_DIR,
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(302, { 'Location': '/admin?err=upload' });
                res.end();
                return;
            }
            
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile || !photoFile.originalFilename) {
                res.writeHead(302, { 'Location': '/admin?err=nofile' });
                res.end();
                return;
            }
            
            const ext = path.extname(photoFile.originalFilename).toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                res.writeHead(302, { 'Location': '/admin?err=type' });
                res.end();
                return;
            }
            
            const filename = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext;
            const newPath = path.join(GALLERY_DIR, filename);
            
            try {
                fs.renameSync(photoFile.filepath, newPath);
                const caption = Array.isArray(fields.caption) ? fields.caption[0] : (fields.caption || '');
                await savePhoto({ path: '/assets/gallery/' + filename, caption });
                res.writeHead(302, { 'Location': '/admin?msg=uploaded' });
                res.end();
            } catch (e) {
                res.writeHead(302, { 'Location': '/admin?err=save' });
                res.end();
            }
        });
        return;
    }
    
    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            try {
                const photo = await db.collection('gallery_photos').findOne({
                    _id: new ObjectId(params.get('photoId'))
                });
                if (photo) {
                    const filePath = path.join(__dir, photo.path);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
                await deletePhoto(params.get('photoId'));
            } catch (e) {}
            res.writeHead(302, { 'Location': '/admin?msg=deleted' });
            res.end();
        });
        return;
    }
    
    // Home page
    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': CACHE_CONTROL.html });
        res.end(getMainHTML(photos));
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 - Not Found');
});

// ============ START ============
async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`\n✅ Server running on http://localhost:${PORT}`);
        console.log(`👤 Admin: http://localhost:${PORT}/admin (admin/admin123)`);
        console.log(`📱 Mobile-first | Dark/Light theme | Auto system detection\n`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Shutting down...');
        server.close();
        if (mongoClient) await mongoClient.close();
        process.exit(0);
    });
}

start().catch(console.error);

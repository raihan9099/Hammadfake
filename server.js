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
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect.png",
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    reportIcon: "/assets/report.png",
    blueTick: "/assets/bluetick.png",
    fbFlag: "/assets/flag.png"
};

const VOICE = {
    welcome: "/assets/my%20user%20name.mp3",
    fakeAlert: "/assets/7%20lak%20like%20but%20its%20fake.mp3"
};

const adminPresence = {
    isOnline: false,
    lastSeen: null
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
                title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) { if (!names.includes(col)) await db.createCollection(col); }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        console.log('✅ Database connected');
        return true;
    } catch (e) { console.error('DB Error:', e.message); return false; }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

async function createOrGetChatUser(name, phoneEmail) {
    if (!phoneEmail || !phoneEmail.trim()) return null;
    const clean = phoneEmail.trim().toLowerCase();
    let user = await db.collection('chat_users').findOne({ phoneEmail: clean });
    if (user) {
        await db.collection('chat_users').updateOne({ _id: user._id }, { $set: { name, lastSeen: new Date(), status: 'active' } });
        return user;
    }
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    user = { chatId, name, phoneEmail: clean, createdAt: new Date(), lastSeen: new Date(), status: 'active' };
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').deleteMany({ chatId });
    await db.collection('chat_sessions').insertOne({ chatId, token, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return token;
}

async function getChatUserByToken(token) {
    if (!token) return null;
    const session = await db.collection('chat_sessions').findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getChatMessages(chatId) {
    return await db.collection('chat_messages').find({ chatId }).sort({ createdAt: 1 }).limit(100).toArray();
}

async function saveChatMessage(chatId, sender, message) {
    const msg = { chatId, sender, message, createdAt: new Date(), read: false };
    await db.collection('chat_messages').insertOne(msg);
    await db.collection('chat_users').updateOne({ chatId }, { $set: { lastSeen: new Date() } });
    return msg;
}

async function getAdminChatList() {
    const users = await db.collection('chat_users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray();
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages').findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages').countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        list.push({ chatId: u.chatId, name: u.name, phoneEmail: u.phoneEmail, lastSeen: u.lastSeen, lastMessage: lastMsg, unread });
    }
    return list;
}

async function markMessagesRead(chatId) {
    await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile | Bangladesh",
        tiktokFollowers: "5,000",
        tiktokFollowing: "0",
        tiktokLikes: "50K",
        location: "Dhaka, Bangladesh"
    },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", icon: IMAGES.tiktokIcon, screenshot: IMAGES.official, verified: true, followers: "5,000", following: "0", likes: "50K", verifiedIcon: IMAGES.blueTick },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", icon: IMAGES.fbFlag, screenshot: null, verified: true, followers: "Growing", verifiedIcon: IMAGES.blueTick }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", icon: IMAGES.tiktokIcon, screenshot: IMAGES.danger, reason: "Copies official content and logo to deceive followers.", threatLevel: "Critical", reportedCount: 156, detectIcon: IMAGES.fakeDetect, reportIcon: IMAGES.reportIcon },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", icon: IMAGES.tiktokIcon, screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers.", threatLevel: "High", reportedCount: 89, detectIcon: IMAGES.fakeDetect, reportIcon: IMAGES.reportIcon }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getLastSeenText() {
    if (adminPresence.isOnline) return 'Online now';
    if (!adminPresence.lastSeen) return 'Offline';
    const diffMs = Date.now() - adminPresence.lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `Active ${diffMins} min ago`;
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    if (diffDays < 7) return `Active ${diffDays}d ago`;
    return `Last seen ${adminPresence.lastSeen.toLocaleDateString()}`;
}

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1024, initial-scale=0.5, maximum-scale=1.0, user-scalable=yes">
<meta name="theme-color" content="#6366f1">
<meta name="description" content="Baiilla Maach Official Verification Hub - Detect Fake Accounts">
<title>Baiilla Maach | Verification Hub v10</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<style>
:root {
    --primary: #6366f1;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --dark: #1e293b;
}

*{margin:0;padding:0;box-sizing:border-box}

body {
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #fff1f2 100%);
    color: #1e293b;
    min-height: 100vh;
    min-width: 320px;
    overflow-x: hidden;
}

/* Force Desktop Mode on Mobile */
@media screen and (max-width: 768px) {
    body {
        min-width: 1024px;
        overflow-x: auto;
        -webkit-text-size-adjust: none;
    }
    main {
        min-width: 980px;
        padding: 16px 20px;
    }
    .container {
        min-width: 960px;
    }
}

.container { max-width: 1100px; margin: 0 auto; padding: 0 16px; }

/* Glass Card */
.glass-card {
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.8);
    border-radius: 18px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    padding: 20px 24px;
    margin-bottom: 18px;
    transition: all 0.3s ease;
}
.glass-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.12); }

.glass-card.danger-card { border-left: 4px solid var(--danger); }
.glass-card.success-card { border-left: 4px solid var(--success); }

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 22px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    border: none;
    text-decoration: none;
    transition: all 0.3s ease;
    white-space: nowrap;
}

.btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99,102,241,0.35); }

.btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; box-shadow: 0 4px 12px rgba(239,68,68,0.25); }
.btn-danger:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(239,68,68,0.35); }

.btn-success { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.25); }
.btn-success:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16,185,129,0.35); }

.btn-outline { background: white; border: 2px solid #e2e8f0; color: #64748b; }
.btn-outline:hover { border-color: var(--primary); color: var(--primary); }

.btn-sm { padding: 5px 12px; font-size: 11px; border-radius: 16px; }

/* Badges */
.badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}
.badge-danger { background: #fef2f2; color: #dc2626; }
.badge-success { background: #f0fdf4; color: #059669; }
.badge-warning { background: #fffbeb; color: #d97706; }

/* Section Headers */
.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #f1f5f9;
}
.section-header .icon-circle {
    width: 42px; height: 42px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
}
.icon-danger { background: #fef2f2; }
.icon-success { background: #f0fdf4; }
.icon-music { background: #eef2ff; }

/* Header */
.main-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 12px 0;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
    min-width: 1024px;
}
.main-header .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.header-logo {
    display: flex;
    align-items: center;
    gap: 10px;
}
.header-logo img {
    width: 38px; height: 38px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--primary);
}
.header-nav { display: flex; gap: 8px; flex-wrap: wrap; }
.header-nav a {
    padding: 7px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
}
.nav-danger { color: #ef4444; background: #fef2f2; }
.nav-danger:hover { background: #fee2e2; }
.nav-music { color: #6366f1; background: #eef2ff; }
.nav-music:hover { background: #e0e7ff; }
.nav-official { color: #10b981; background: #f0fdf4; }
.nav-official:hover { background: #dcfce7; }
.nav-gallery { color: #8b5cf6; background: #faf5ff; }
.nav-gallery:hover { background: #f3e8ff; }

/* Profile Section */
.profile-section { text-align: center; padding: 24px 0 16px; }
.profile-pic {
    width: 110px; height: 110px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid var(--primary);
    box-shadow: 0 0 30px rgba(99,102,241,0.2);
}
.verified-check {
    position: absolute;
    bottom: 4px; right: 4px;
    width: 28px; height: 28px;
    background: var(--success);
    border-radius: 50%;
    border: 3px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
}
.stats-row {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 16px 0;
    flex-wrap: wrap;
}
.stat-card {
    background: white;
    border-radius: 14px;
    padding: 12px 24px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    min-width: 90px;
}
.stat-value { font-size: 20px; font-weight: 700; color: var(--primary); }
.stat-label { font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px; }

/* Music Player */
.music-player {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border-radius: 20px;
    padding: 24px;
    color: white;
    margin: 16px 0;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
}
.music-player .player-top {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
}
.album-art {
    width: 70px; height: 70px;
    border-radius: 16px;
    background: rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.2);
    overflow: hidden;
}
.album-art img {
    width: 100%; height: 100%;
    object-fit: cover;
    animation: spin 8s linear infinite paused;
}
.album-art.playing img { animation-play-state: running; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.play-btn-main {
    width: 56px; height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: 2px solid rgba(255,255,255,0.3);
    color: white;
    font-size: 22px;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 25px rgba(99,102,241,0.4);
    flex-shrink: 0;
}
.play-btn-main:hover { transform: scale(1.08); }
.play-btn-main.playing { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 0 25px rgba(16,185,129,0.4); }

.progress-bar {
    flex: 1; height: 5px;
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
    cursor: pointer;
    overflow: hidden;
}
.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 3px;
    width: 0%;
    transition: width 0.1s linear;
}

.song-list {
    max-height: 240px;
    overflow-y: auto;
    margin-top: 16px;
}
.song-list::-webkit-scrollbar { width: 4px; }
.song-list::-webkit-scrollbar-track { background: transparent; }
.song-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

.song-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 2px;
    font-size: 13px;
}
.song-item:hover { background: rgba(255,255,255,0.08); }
.song-item.active { background: rgba(99,102,241,0.25); border-left: 3px solid #818cf8; }

/* Chat Widget - Fixed */
.chat-widget { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }

.chat-btn {
    width: 58px; height: 58px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: 3px solid rgba(255,255,255,0.3);
    cursor: pointer;
    box-shadow: 0 8px 25px rgba(99,102,241,0.35);
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
}
.chat-btn:hover { transform: scale(1.08); }

.chat-window {
    position: fixed;
    bottom: 95px;
    right: 24px;
    width: 380px;
    max-width: calc(100vw - 40px);
    height: 520px;
    max-height: calc(100vh - 130px);
    background: white;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,0.25);
    display: none;
    flex-direction: column;
    animation: slideUp 0.35s ease;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(25px); } to { opacity: 1; transform: translateY(0); } }
.chat-window.open { display: flex; }

.chat-header {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: white;
}
.chat-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255,255,255,0.4);
    flex-shrink: 0;
    background: rgba(255,255,255,0.2);
    position: relative;
}
.chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
.online-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    position: absolute;
    bottom: 0; right: 0;
    border: 2px solid #4f46e5;
}
.online-dot.online { background: #10b981; }
.online-dot.offline { background: #94a3b8; }
.chat-header-name { font-weight: 600; font-size: 15px; }
.chat-header-status { font-size: 11px; opacity: 0.9; }

.chat-close {
    background: rgba(255,255,255,0.2);
    border: none; color: white;
    width: 30px; height: 30px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    margin-left: auto;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f8fafc;
}
.msg {
    max-width: 80%;
    padding: 8px 13px;
    margin-bottom: 6px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.45;
    animation: msgIn 0.25s ease;
}
@keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.msg-out { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; margin-left: auto; border-bottom-right-radius: 4px; }
.msg-in { background: white; color: #1e293b; margin-right: auto; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
.msg-time { font-size: 10px; opacity: 0.65; margin-top: 3px; text-align: right; }

.chat-login {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 30px 22px;
    text-align: center;
    background: #f8fafc;
}
.chat-login h3 { font-size: 17px; margin-bottom: 4px; color: #1e293b; }
.chat-login p { font-size: 12px; color: #64748b; margin-bottom: 18px; }
.chat-login input {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    margin-bottom: 8px;
    outline: none;
    font-size: 13px;
}
.chat-login input:focus { border-color: #6366f1; }
.chat-login button {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
}

.chat-input-area {
    padding: 12px;
    background: white;
    border-top: 1px solid #e2e8f0;
    display: flex;
    gap: 8px;
}
.chat-input-area input {
    flex: 1;
    padding: 9px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    outline: none;
    font-size: 13px;
}
.chat-input-area input:focus { border-color: #6366f1; }
.chat-send-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #6366f1;
    border: none;
    color: white;
    font-size: 15px;
    cursor: pointer;
    flex-shrink: 0;
}

/* Toast */
.toast {
    position: fixed; top: 16px; right: 16px;
    z-index: 99999;
    background: white;
    padding: 12px 18px;
    border-radius: 10px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    transform: translateX(120%);
    transition: transform 0.3s ease;
    border-left: 4px solid #6366f1;
    font-size: 13px;
    font-weight: 500;
}
.toast.show { transform: translateX(0); }
.toast.error { border-left-color: #ef4444; }
.toast.success { border-left-color: #10b981; }

/* Fake Account Cards */
.fake-card {
    background: #fef2f2;
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 10px;
    border: 1px solid #fecaca;
}
.fake-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.fake-card-body {
    display: flex;
    gap: 14px;
    align-items: flex-start;
}
.fake-card-img {
    width: 65px; height: 65px;
    border-radius: 12px;
    object-fit: cover;
    border: 2px solid #fca5a5;
    flex-shrink: 0;
}
.fake-card-info { flex: 1; min-width: 0; }
.fake-card-username { font-weight: 700; color: #991b1b; font-size: 14px; }
.fake-card-reason { font-size: 12px; color: #dc2626; margin: 4px 0; }
.fake-card-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

/* Official Account Cards */
.official-card {
    background: #f0fdf4;
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 10px;
    border: 1px solid #bbf7d0;
    display: flex;
    align-items: center;
    gap: 12px;
}
.official-card-img {
    width: 50px; height: 50px;
    border-radius: 12px;
    object-fit: cover;
    flex-shrink: 0;
}
.official-card-placeholder {
    width: 50px; height: 50px;
    border-radius: 12px;
    background: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 22px;
    flex-shrink: 0;
}

/* Gallery */
.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
}
.gallery-item {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: all 0.3s;
}
.gallery-item:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
.gallery-item img { width: 100%; height: 130px; object-fit: cover; display: block; }
.gallery-item .caption { padding: 8px 10px; font-size: 12px; color: #64748b; background: white; }
</style>
</head>
<body>

<div id="toast" class="toast"></div>

<!-- HEADER -->
<header class="main-header">
<div class="container">
<div class="header-inner">
<div class="header-logo">
<img src="${profilePic}" alt="Profile" onerror="this.style.display='none'">
<div>
<div style="font-weight:700;font-size:15px;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Verification Hub</div>
<div style="font-size:10px;color:#94a3b8">Official v10</div>
</div>
</div>
<nav class="header-nav">
<a href="#fake" class="nav-danger">⚠️ Fake Alerts</a>
${coverSongs.length > 0 ? '<a href="#music" class="nav-music">🎵 Music</a>' : ''}
<a href="#official" class="nav-official">✓ Official</a>
<a href="#gallery" class="nav-gallery">📸 Gallery</a>
</nav>
</div>
</div>
</header>

<main>
<div class="container">

<!-- PROFILE -->
<section class="profile-section">
<div style="position:relative;display:inline-block">
<img src="${profilePic}" class="profile-pic" alt="Profile" onerror="this.style.display='none'">
<div class="verified-check">✓</div>
</div>
<h1 style="font-size:22px;font-weight:800;margin-top:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${DATA.celebrity.fullName}</h1>
<p style="color:#64748b;font-size:13px;margin-top:4px">${DATA.celebrity.bio}</p>

<div class="stats-row">
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokFollowing}</div><div class="stat-label">Following</div></div>
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokLikes}</div><div class="stat-label">Likes</div></div>
</div>

<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
<span class="badge badge-success">✓ Verified Official</span>
<span class="badge" style="background:#eef2ff;color:#6366f1">Creator</span>
<span style="font-size:12px;color:#64748b">📍 ${DATA.celebrity.location}</span>
</div>
</section>

<!-- FAKE ACCOUNTS - TOP -->
<section id="fake" class="glass-card danger-card">
<div class="section-header">
<div class="icon-circle icon-danger">
<img src="${IMAGES.fakeDetect}" alt="Fake Detect" style="width:24px;height:24px" onerror="this.innerHTML='⚠️'">
</div>
<div>
<h2 style="font-size:17px;font-weight:700;color:#dc2626">Fake Accounts Detected</h2>
<p style="font-size:11px;color:#64748b">Report these impersonating accounts</p>
</div>
<span class="badge badge-danger" style="margin-left:auto">${totalFake} Active</span>
</div>

${DATA.fakeAccounts.map((a, i) => `
<div class="fake-card">
<div class="fake-card-header">
<div style="display:flex;align-items:center;gap:6px">
<img src="${a.icon}" alt="TikTok" style="width:18px;height:18px" onerror="this.style.display='none'">
<span style="font-weight:700;color:#dc2626;font-size:13px">Fake #${i+1}</span>
</div>
<span class="badge badge-danger">${a.threatLevel}</span>
</div>
<div class="fake-card-body">
${a.screenshot ? `<img src="${a.screenshot}" class="fake-card-img" alt="Fake Account" onerror="this.style.display='none'">` : `<div class="fake-card-img" style="background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:24px">⚠️</div>`}
<div class="fake-card-info">
<div class="fake-card-username">${a.username}</div>
<div class="fake-card-reason">⚠ ${a.reason}</div>
<div style="font-size:11px;color:#991b1b;margin-top:4px">${a.reportedCount}+ reports</div>
<div class="fake-card-actions">
<a href="${a.profileUrl}" target="_blank" class="btn btn-danger btn-sm">
<img src="${IMAGES.reportIcon}" alt="Report" style="width:14px;height:14px" onerror="this.style.display='none'"> Report
</a>
<button onclick="copyText('${a.username}')" class="btn btn-outline btn-sm">Copy</button>
</div>
</div>
</div>
</div>
`).join('')}

<button onclick="document.getElementById('fakeVoice').play()" class="btn btn-danger" style="width:100%;justify-content:center;margin-top:10px">🔊 Play Voice Alert</button>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

<!-- MUSIC PLAYER - MIDDLE -->
${coverSongs.length > 0 ? `
<section id="music" class="music-player">
<div class="player-top">
<div class="album-art" id="albumArt">
<span>🎵</span>
</div>
<div style="flex:1;min-width:0">
<div id="currentTitle" style="font-weight:700;font-size:16px">Select a Song</div>
<div id="currentArtist" style="font-size:12px;opacity:0.7">Cover Music</div>
</div>
<button class="play-btn-main" id="playBtn" onclick="togglePlay()" title="Play/Pause">▶️</button>
</div>

<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
<span id="currentTime" style="font-size:11px;opacity:0.7">0:00</span>
<div class="progress-bar" onclick="seekAudio(event)"><div class="progress-fill" id="progressFill"></div></div>
<span id="totalTime" style="font-size:11px;opacity:0.7">0:00</span>
</div>

<div class="song-list">
${coverSongs.map((s, i) => `
<div class="song-item" id="song-${i}" onclick="playSong('${s.audioUrl}','${s.title}','${s.artist}','${s.coverUrl||''}',${i})">
<span style="opacity:0.6;font-size:12px;width:26px;text-align:center">${(i+1).toString().padStart(2,'0')}</span>
<div style="flex:1;min-width:0">
<div style="font-weight:500;font-size:13px">${s.title}</div>
<div style="font-size:11px;opacity:0.6">${s.artist}</div>
</div>
<span style="font-size:12px;opacity:0.5">▶️</span>
</div>
`).join('')}
</div>
<audio id="coverAudio" preload="none"></audio>
</section>` : ''}

<!-- OFFICIAL ACCOUNTS -->
<section id="official" class="glass-card success-card">
<div class="section-header">
<div class="icon-circle icon-success">
<img src="${IMAGES.blueTick}" alt="Verified" style="width:22px;height:22px" onerror="this.innerHTML='✓'">
</div>
<div>
<h2 style="font-size:17px;font-weight:700;color:#059669">Official Verified Accounts</h2>
<p style="font-size:11px;color:#64748b">Only follow these real accounts</p>
</div>
</div>

${DATA.realAccounts.map(acc => `
<div class="official-card">
${acc.screenshot ? `<img src="${acc.screenshot}" class="official-card-img" alt="${acc.platform}" onerror="this.parentElement.querySelector('.official-card-placeholder').style.display='flex';this.style.display='none'">` : ''}
<div class="official-card-placeholder" style="display:${acc.screenshot?'none':'flex'}">${acc.platform[0]}</div>
<div style="flex:1;min-width:0">
<div style="display:flex;align-items:center;gap:4px">
<img src="${acc.icon}" alt="${acc.platform}" style="width:16px;height:16px" onerror="this.style.display='none'">
<span style="font-weight:600;color:#065f46;font-size:14px">${acc.username}</span>
<img src="${acc.verifiedIcon}" alt="Verified" style="width:14px;height:14px" onerror="this.style.display='none'">
</div>
<div style="font-size:11px;color:#059669;margin-top:2px">${acc.followers} followers</div>
</div>
<a href="${acc.url}" target="_blank" class="btn btn-success btn-sm">Follow</a>
</div>
`).join('')}
</section>

<!-- GALLERY -->
<section id="gallery" class="glass-card">
<div class="section-header">
<div style="font-size:22px">📸</div>
<div>
<h2 style="font-size:17px;font-weight:700">Photo Gallery</h2>
<p style="font-size:11px;color:#64748b">Official moments</p>
</div>
</div>
<div class="gallery-grid">
${galleryPhotos.map(p => `
<div class="gallery-item">
<img src="${p.path}" alt="Gallery" loading="lazy">
${p.caption ? `<div class="caption">${p.caption}</div>` : ''}
</div>
`).join('')}
${galleryPhotos.length === 0 ? '<p style="color:#94a3b8;text-align:center;grid-column:1/-1;padding:30px">No photos uploaded yet</p>' : ''}
</div>
</section>

</div>
</main>

<!-- CHAT WIDGET -->
<div class="chat-widget">
<button class="chat-btn" onclick="toggleChat()" title="Chat with Support">
<img src="${IMAGES.messageIcon}" alt="Chat" style="width:30px;height:30px" onerror="this.outerHTML='💬'">
</button>

<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar">
<img src="${profilePic}" alt="Admin" onerror="this.parentElement.innerHTML='<div style=display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:700;font-size:18px>H</div>'">
<div class="online-dot ${isOnline ? 'online' : 'offline'}"></div>
</div>
<div>
<div class="chat-header-name">Hammad Bin Amir</div>
<div class="chat-header-status" id="statusText">${statusText}</div>
</div>
<button class="chat-close" onclick="toggleChat()">✕</button>
</div>

<div id="chatLogin" class="chat-login">
<div style="font-size:45px;margin-bottom:10px">💬</div>
<h3>Chat with Support</h3>
<p>Enter your details to start</p>
<input type="text" id="userName" placeholder="Your Name">
<input type="text" id="userContact" placeholder="Email or Phone">
<button onclick="registerChat()">Start Conversation</button>
</div>

<div id="chatUI" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages" id="chatMessages"></div>
<div class="chat-input-area">
<input type="text" id="msgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button class="chat-send-btn" onclick="sendMessage()">➤</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<script>
// Force Desktop Mode
(function() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
        meta.setAttribute('content', 'width=1024, initial-scale=0.5, maximum-scale=1.0, user-scalable=yes');
    }
    // Prevent mobile scaling
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
    document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
})();

// Toast
function showToast(m,t){var el=document.getElementById('toast');el.textContent=m;el.className='toast show '+(t||'');setTimeout(function(){el.classList.remove('show')},2800)}
function copyText(t){navigator.clipboard.writeText(t).then(function(){showToast('Copied!','success')}).catch(function(){showToast('Copy failed','error')})}

// Music Player
var currentAudio=null,isPlaying=false;

function playSong(url,title,artist,cover,index){
var a=document.getElementById('coverAudio');
var btn=document.getElementById('playBtn');
var art=document.getElementById('albumArt');

if(currentAudio===url){togglePlay();return}
if(currentAudio){a.pause()}
currentAudio=url;a.src=url;

document.getElementById('currentTitle').textContent=title||'Unknown';
document.getElementById('currentArtist').textContent=artist||'Unknown';

if(cover){art.innerHTML='<img src=\"'+cover+'\" style=\"width:100%;height:100%;object-fit:cover\" onerror=\"this.parentElement.innerHTML=&quot;<span>🎵</span>&quot;\">'}else{art.innerHTML='<span>🎵</span>'}

document.getElementById('progressFill').style.width='0%';
document.getElementById('currentTime').textContent='0:00';
document.getElementById('totalTime').textContent='0:00';

// Highlight active song
document.querySelectorAll('.song-item').forEach(function(el){el.classList.remove('active')});
var songEl=document.getElementById('song-'+index);
if(songEl)songEl.classList.add('active');

a.play().then(function(){
isPlaying=true;
btn.innerHTML='⏸️';
btn.classList.add('playing');
art.classList.add('playing');
}).catch(function(){showToast('Error playing','error')});

a.ontimeupdate=function(){if(a.duration){var p=(a.currentTime/a.duration)*100;document.getElementById('progressFill').style.width=p+'%';document.getElementById('currentTime').textContent=formatTime(a.currentTime)}};
a.onloadedmetadata=function(){document.getElementById('totalTime').textContent=formatTime(a.duration)};
a.onended=function(){isPlaying=false;btn.innerHTML='▶️';btn.classList.remove('playing');art.classList.remove('playing');document.getElementById('progressFill').style.width='0%';document.getElementById('currentTime').textContent='0:00';currentAudio=null}
}

function togglePlay(){
var a=document.getElementById('coverAudio');
var btn=document.getElementById('playBtn');
var art=document.getElementById('albumArt');
if(!a.src||a.src===window.location.href){showToast('Select a song','error');return}
if(isPlaying){a.pause();isPlaying=false;btn.innerHTML='▶️';btn.classList.remove('playing');art.classList.remove('playing')}
else{a.play().then(function(){isPlaying=true;btn.innerHTML='⏸️';btn.classList.add('playing');art.classList.add('playing')}).catch(function(){showToast('Error','error')})}
}

function seekAudio(e){
var a=document.getElementById('coverAudio');
if(!a.duration)return;
var rect=e.currentTarget.getBoundingClientRect();
a.currentTime=((e.clientX-rect.left)/rect.width)*a.duration
}

function formatTime(s){if(isNaN(s))return'0:00';var m=Math.floor(s/60);var sec=Math.floor(s%60);return m+':'+sec.toString().padStart(2,'0')}

// Welcome voice
setTimeout(function(){var v=document.getElementById('welcomeVoice');if(v&&!sessionStorage.getItem('vp')){v.play().catch(function(){});sessionStorage.setItem('vp','1')}},2000);

// Chat
var chatToken=localStorage.getItem('chatToken'),chatId=null,pollInterval=null;
if(chatToken)verifyToken();

function verifyToken(){
fetch('/api/chat/verify?token='+encodeURIComponent(chatToken))
.then(function(r){return r.json()})
.then(function(d){if(d.success){chatId=d.chatId;showChatUI();loadMessages();startPolling()}else{localStorage.removeItem('chatToken');chatToken=null}})
.catch(function(){})
}

function toggleChat(){var w=document.getElementById('chatWindow');w.classList.toggle('open');if(w.classList.contains('open')&&chatToken)loadMessages()}
function showChatUI(){document.getElementById('chatLogin').style.display='none';document.getElementById('chatUI').style.display='flex'}

function registerChat(){
var n=document.getElementById('userName').value.trim();
var c=document.getElementById('userContact').value.trim();
if(!n){showToast('Enter name','error');return}
if(!c){showToast('Enter contact','error');return}
fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phoneEmail:c})})
.then(function(r){return r.json()})
.then(function(d){if(d.success){chatToken=d.token;chatId=d.chatId;localStorage.setItem('chatToken',chatToken);showChatUI();loadMessages();startPolling();showToast('Connected!','success')}else{showToast(d.error||'Failed','error')}})
.catch(function(){showToast('Error','error')})
}

function startPolling(){if(pollInterval)clearInterval(pollInterval);pollInterval=setInterval(loadMessages,2000)}

function loadMessages(){
if(!chatToken)return;
fetch('/api/chat/messages?token='+encodeURIComponent(chatToken)+'&t='+Date.now())
.then(function(r){return r.json()})
.then(function(d){
if(d.success){
var c=document.getElementById('chatMessages');
c.innerHTML='';
d.messages.forEach(function(m){
var div=document.createElement('div');
div.className='msg '+(m.sender==='user'?'msg-out':'msg-in');
div.innerHTML=m.message+'<div class=\"msg-time\">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+(m.sender==='user'?' ✓✓':'')+'</div>';
c.appendChild(div)
});
c.scrollTop=c.scrollHeight
}else{clearInterval(pollInterval);localStorage.removeItem('chatToken');chatToken=null;document.getElementById('chatLogin').style.display='flex';document.getElementById('chatUI').style.display='none'}
})
}

function sendMessage(){
var i=document.getElementById('msgInput');
var m=i.value.trim();
if(!m||!chatToken)return;
i.value='';
fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:chatToken,message:m})})
.then(function(r){return r.json()})
.then(function(d){if(d.success)loadMessages()})
}

window.addEventListener('beforeunload',function(){if(pollInterval)clearInterval(pollInterval)});
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1024, initial-scale=0.5"><title>Admin Login | Verification Hub</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 flex items-center justify-center min-h-screen" style="min-width:1024px"><div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm"><h2 class="text-2xl font-bold text-center mb-6">Admin Login</h2>${error?`<div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">${error}</div>`:''}<form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" class="w-full p-3 border rounded-lg mb-3" required><input type="password" name="password" placeholder="Password" class="w-full p-3 border rounded-lg mb-4" required><button class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-500">← Back</a></div></body></html>`;
}

async function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const chatList = await getAdminChatList();
    const photoHTML = photos.map(p => `
<div class="bg-white rounded-xl overflow-hidden shadow"><img src="${p.path}" class="w-full h-40 object-cover"><div class="p-3"><p class="text-sm text-gray-600">${p.caption||''}</p><p class="text-xs text-gray-400 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="text-red-500 text-sm mt-2">Delete</button></form></div></div>`).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1024, initial-scale=0.5"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 min-h-screen" style="min-width:1024px"><header class="bg-white p-4 shadow mb-6"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-xl font-bold text-indigo-600">Admin Panel</h1><div class="flex gap-3"><a href="/admin/chat" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Chats (${chatList.reduce((s,c)=>s+c.unread,0)})</a><a href="/" class="px-4 py-2 bg-gray-200 rounded-lg text-sm">Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm">Logout</a></div></div></header><div class="max-w-6xl mx-auto px-4">${msg?`<div class="bg-green-50 text-green-600 p-4 rounded-xl mb-4">${msg}</div>`:''}${err?`<div class="bg-red-50 text-red-600 p-4 rounded-xl mb-4">${err}</div>`:''}<div class="bg-white p-6 rounded-xl shadow mb-6"><h2 class="font-bold mb-4">Upload Photo</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" accept="image/*" class="mb-3" required><input type="text" name="caption" placeholder="Caption" class="w-full p-2 border rounded-lg mb-3"><button class="w-full py-2 bg-indigo-600 text-white rounded-lg">Upload</button></form></div><h2 class="text-xl font-bold mb-4">Gallery (${photos.length})</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">${photoHTML||'<p class="text-gray-400 col-span-4 text-center py-12">No photos</p>'}</div></div></body></html>`;
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);

    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac','.ico':'image/x-icon' };
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    // Chat API
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'All fields required' })); return; }
                const user = await createOrGetChatUser(name, phoneEmail);
                if (!user) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const token = await createChatSession(user.chatId);
                const messages = await getChatMessages(user.chatId);
                if (messages.length === 0) await saveChatMessage(user.chatId, 'admin', 'Hello! 👋 How can I help you?');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token, name: user.name }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
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
        if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const messages = await getChatMessages(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }

    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const { token, message } = JSON.parse(body);
            const user = await getChatUserByToken(token);
            if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            await saveChatMessage(user.chatId, 'user', message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    // Admin routes
    if (pathname === '/admin/chat' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        adminPresence.isOnline = true;
        adminPresence.lastSeen = new Date();
        
        const chatId = parsedUrl.query.chatId;
        const chatList = await getAdminChatList();
        let messages = [];
        if (chatId) { messages = await getChatMessages(chatId); await markMessagesRead(chatId); }
        
        const userList = chatList.map(c => `<div onclick="location.href='/admin/chat?chatId=${c.chatId}'" style="padding:12px;cursor:pointer;border-bottom:1px solid #e2e8f0;${c.chatId===chatId?'background:#eef2ff;border-left:3px solid #6366f1':''}"><div style="font-weight:600">${c.name}</div><div style="font-size:12px;color:#64748b">${c.phoneEmail}</div>${c.unread>0?`<span style="background:#6366f1;color:white;border-radius:10px;padding:2px 8px;font-size:11px">${c.unread}</span>`:''}</div>`).join('');
        
        const msgHTML = messages.map(m => `<div style="display:flex;${m.sender==='user'?'justify-content:flex-start':'justify-content:flex-end'};margin-bottom:10px"><div style="max-width:70%;padding:10px 14px;border-radius:15px;${m.sender==='user'?'background:white;border:1px solid #e2e8f0':'background:#6366f1;color:white'}">${m.message}<div style="font-size:10px;opacity:0.7;text-align:right;margin-top:4px">${new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join('');

        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=1024, initial-scale=0.5"><title>Chat Panel</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;display:flex;height:100vh;font-family:sans-serif;min-width:1024px}.sidebar{width:350px;background:white;border-right:1px solid #e2e8f0;overflow-y:auto}.main{flex:1;display:flex;flex-direction:column}.messages{flex:1;overflow-y:auto;padding:20px;background:#f8fafc}.input-area{padding:16px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:10px}.input-area input{flex:1;padding:10px 16px;border:2px solid #e2e8f0;border-radius:25px;outline:none}.input-area button{background:#6366f1;color:white;border:none;padding:10px 20px;border-radius:25px;cursor:pointer;font-weight:600}</style></head><body><div class="sidebar"><div style="padding:16px;background:#6366f1;color:white;font-weight:700">💬 Chats <a href="/admin" style="color:white;float:right;font-size:13px;opacity:0.8">← Back</a></div>${userList}</div><div class="main">${chatId?`<div style="padding:14px;background:white;border-bottom:1px solid #e2e8f0;font-weight:600">${chatList.find(c=>c.chatId===chatId)?.name||'User'}</div><div class="messages" id="msgContainer">${msgHTML||'<p style="text-align:center;color:#94a3b8;padding:40px">No messages</p>'}</div><div class="input-area"><input id="adminMsg" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendAdminMsg()"><button onclick="sendAdminMsg()">Send</button></div><script>let cid='${chatId}';function loadMsgs(){fetch('/api/admin/messages?chatId='+cid).then(r=>r.json()).then(d=>{if(d.success){document.getElementById('msgContainer').innerHTML=d.messages.map(m=>'<div style="display:flex;'+(m.sender==='user'?'justify-content:flex-start':'justify-content:flex-end')+';margin-bottom:10px"><div style="max-width:70%;padding:10px 14px;border-radius:15px;'+(m.sender==='user'?'background:white;border:1px solid #e2e8f0':'background:#6366f1;color:white')+'">'+m.message+'<div style="font-size:10px;opacity:0.7;text-align:right;margin-top:4px">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div></div>').join('');document.getElementById('msgContainer').scrollTop=document.getElementById('msgContainer').scrollHeight}})}
function sendAdminMsg(){var i=document.getElementById('adminMsg');var m=i.value.trim();if(!m)return;i.value='';fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:cid,message:m})}).then(()=>loadMsgs())}
setInterval(loadMsgs,2000);</script>`:'<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8">Select a chat</div>'}</div></body></html>`);
        return;
    }

    if (pathname === '/api/admin/messages' && method === 'GET') {
        if (!getSession(cookies.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const messages = await getChatMessages(parsedUrl.query.chatId);
        await markMessagesRead(parsedUrl.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }

    if (pathname === '/api/admin/send' && method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
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

    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) {
            adminPresence.isOnline = true;
            adminPresence.lastSeen = new Date();
            const p = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(p));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }

    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'), params.get('password'))) {
                const sid = createSession(params.get('username'));
                adminPresence.isOnline = true;
                adminPresence.lastSeen = new Date();
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid credentials'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        adminPresence.isOnline = false;
        adminPresence.lastSeen = new Date();
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' });
        res.end();
        return;
    }

    if (pathname === '/admin/upload' && method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true, maxFileSize: 10 * 1024 * 1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, '', 'Upload error')); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf || !pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, '', 'No file')); return; }
            const fn = Date.now() + '_' + pf.originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
            try {
                fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                await savePhoto({ path: '/assets/gallery/' + fn, caption: fields.caption ? (Array.isArray(fields.caption) ? fields.caption[0] : fields.caption) : '' });
                const p = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(await getAdminPanelHTML(p, 'Uploaded!'));
            } catch (e) { const p = await getGalleryPhotos(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(p, '', 'Save error')); }
        });
        return;
    }

    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            try {
                const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(params.get('photoId')) });
                if (photo) { const fp = path.join(__dir, photo.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
                await deletePhoto(params.get('photoId'));
            } catch (e) { }
            const p = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(p, 'Deleted'));
        });
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(photos));
        return;
    }

    res.writeHead(404);
    res.end('404 - Not Found');
});

async function start() {
    await connectDB();
    server.listen(PORT, () => console.log(`\n🚀 Server running on http://localhost:${PORT}\n📱 Forced Desktop Mode on Mobile\n👤 Admin: http://localhost:${PORT}/admin (admin/admin123)\n`));
}
start().catch(console.error);

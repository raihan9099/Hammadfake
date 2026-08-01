const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const { getChatPageHTML } = require('./chat');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
let dbConnected = false;

const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/orginalss.png",
    realIdSS: "/assets/real-id-ss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect .png",
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    reportIcon: "/assets/report.png",
    blueTick: "/assets/social-media.png",
    voiceMic: "/assets/microphone-in-hand.gif",
    facebookIcon: "/assets/communication.png",
    socialMedia: "/assets/social-media.png",
    musicIcon: "/assets/music-icon.png"
};

const VOICE = {
    welcome: "/assets/realvoice.mp3",
    fakeAlert: "/assets/7 lak like but its fake.mp3"
};

const adminPresence = { isOnline: false, lastSeen: null };

const memoryStore = {
    users: new Map(),
    sessions: new Map(),
    messages: new Map()
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
        return Object.entries(groups).filter(([_, v]) => v.audio).map(([base, v]) => ({
            id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
            title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
            artist: 'Cover Song',
            audioUrl: '/assets/covermusic/' + encodeURIComponent(v.audio),
            coverUrl: v.cover ? '/assets/covermusic/' + encodeURIComponent(v.cover) : null
        })).sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        console.log('Connecting to MongoDB...');
        mongoClient = new MongoClient(MONGO_URI, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 15000 });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        await db.command({ ping: 1 });
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
            console.log('Created default admin user');
        }
        dbConnected = true;
        console.log('MongoDB Connected Successfully');
        return true;
    } catch (e) {
        console.error('MongoDB Connection Failed:', e.message);
        console.log('Running with in-memory storage fallback');
        dbConnected = false;
        db = null;
        return false;
    }
}

async function getGalleryPhotos() { if (!db || !dbConnected) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db || !dbConnected) return null; try { return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); } catch(e) { return null; } }
async function deletePhoto(id) { if (!db || !dbConnected) return null; try { return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); } catch(e) { return null; } }
async function verifyAdmin(u, p) { if (!db || !dbConnected) return u === 'admin' && p === 'admin123'; try { const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); } catch(e) { return u === 'admin' && p === 'admin123'; } }

function createOrGetChatUser(name, phoneEmail) {
    const clean = (phoneEmail || '').trim().toLowerCase();
    if (!clean) return null;
    let user = memoryStore.users.get(clean);
    if (user) { user.name = name; user.lastSeen = new Date(); user.status = 'active'; memoryStore.users.set(clean, user); return user; }
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    user = { chatId, name, phoneEmail: clean, createdAt: new Date(), lastSeen: new Date(), status: 'active' };
    memoryStore.users.set(clean, user);
    return user;
}

function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    memoryStore.sessions.set(token, { chatId, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return token;
}

function getChatUserByToken(token) {
    if (!token) return null;
    const session = memoryStore.sessions.get(token);
    if (!session) return null;
    if (new Date() > session.expiresAt) { memoryStore.sessions.delete(token); return null; }
    for (const [key, user] of memoryStore.users) { if (user.chatId === session.chatId) return user; }
    return null;
}

function getChatMessages(chatId) {
    const msgs = memoryStore.messages.get(chatId) || [];
    return msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function saveChatMessage(chatId, sender, message, type, fileUrl, fileName, duration) {
    const msg = { chatId, sender, message, type: type || 'text', fileUrl: fileUrl || null, fileName: fileName || null, duration: duration || null, createdAt: new Date(), read: false };
    if (!memoryStore.messages.has(chatId)) memoryStore.messages.set(chatId, []);
    memoryStore.messages.get(chatId).push(msg);
    return msg;
}

function getAdminChatList() {
    const list = [];
    for (const [key, user] of memoryStore.users) {
        if (user.status === 'active') {
            const msgs = memoryStore.messages.get(user.chatId) || [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const unread = msgs.filter(m => m.sender === 'user' && !m.read).length;
            list.push({ chatId: user.chatId, name: user.name, phoneEmail: user.phoneEmail, lastSeen: user.lastSeen, lastMessage: lastMsg, unread });
        }
    }
    return list.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function markMessagesRead(chatId) {
    const msgs = memoryStore.messages.get(chatId) || [];
    msgs.forEach(m => { if (m.sender === 'user') m.read = true; });
}

const DATA = {
    celebrity: { name: "Baiilla Maach", fullName: "Baiilla Maach Official", photo: IMAGES.profile, bio: "Official Entertainment Profile | Bangladesh", tiktokFollowers: "5,000", tiktokFollowing: "0", tiktokLikes: "50K", location: "Dhaka, Bangladesh" },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", icon: IMAGES.tiktokIcon, screenshot: IMAGES.official, verified: true, followers: "5,000", verifiedIcon: IMAGES.blueTick },
        { platform: "Facebook", username: "Hammad Bin Amir", url: "https://www.facebook.com/profile.php?id=61575202118828", icon: IMAGES.facebookIcon, screenshot: IMAGES.realIdSS, verified: true, followers: "Growing", verifiedIcon: IMAGES.blueTick }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", icon: IMAGES.tiktokIcon, screenshot: IMAGES.danger, reason: "Copies official content and logo to deceive followers.", threatLevel: "Critical", reportedCount: 156 },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", icon: IMAGES.tiktokIcon, screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers.", threatLevel: "High", reportedCount: 89 }
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
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return 'Active ' + diffMins + 'm ago';
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return 'Active ' + diffHours + 'h ago';
    return 'Last seen ' + adminPresence.lastSeen.toLocaleDateString();
}

function formatMsgTime(d) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function renderMsgBubble(m) {
    var time = formatMsgTime(m.createdAt);
    var bubble = '';
    if (m.type === 'image' && m.fileUrl) {
        bubble = '<img src="' + m.fileUrl + '" style="max-width:250px;max-height:250px;border-radius:12px;cursor:pointer;display:block" onclick="showImg(\'' + m.fileUrl + '\')">';
    } else if (m.type === 'voice' && m.fileUrl) {
        bubble = '<div style="display:flex;align-items:center;gap:10px;padding:5px 0">' +
            '<button onclick="playV(\'' + m.fileUrl + '\',this)" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:14px;cursor:pointer;flex-shrink:0">▶</button>' +
            '<div style="display:flex;align-items:center;gap:2px;flex:1;height:24px">';
        for (var i = 0; i < 12; i++) {
            bubble += '<div style="width:3px;background:#8b5cf6;border-radius:2px;animation:voiceAnim 1s ease-in-out infinite;animation-delay:' + (i * 0.1) + 's;height:' + (8 + Math.floor(Math.random() * 14)) + 'px"></div>';
        }
        bubble += '</div>';
        if (m.duration) {
            var mins = Math.floor(m.duration / 60);
            var secs = Math.floor(m.duration % 60);
            bubble += '<span style="font-size:11px;opacity:0.6">' + mins + ':' + String(secs).padStart(2, '0') + '</span>';
        }
        bubble += '</div>';
    } else {
        bubble = m.message;
    }
    bubble += '<div style="font-size:10px;opacity:0.5;margin-top:4px">' + time + '</div>';
    return bubble;
}

function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;

    let fakeCardsHTML = '';
    DATA.fakeAccounts.forEach(function(a) {
        fakeCardsHTML += '<div class="fake-card">' +
            '<div class="fake-card-header">' +
                '<span class="fake-badge">⚠️ FAKE ACCOUNT</span>' +
                '<span class="threat-badge ' + (a.threatLevel === 'Critical' ? 'threat-critical' : 'threat-high') + '">' + a.threatLevel + '</span>' +
            '</div>' +
            '<div class="fake-card-body">' +
                '<div class="fake-screenshot-wrap">' +
                    '<img src="' + a.screenshot + '" class="fake-card-img" alt="Fake Account Screenshot">' +
                    '<div class="warning-overlay">' +
                        '<img src="' + IMAGES.fakeDetect + '" class="warning-img" alt="Warning">' +
                        '<span class="warning-text">FAKE</span>' +
                    '</div>' +
                '</div>' +
                '<div class="fake-info">' +
                    '<div class="fake-platform"><img src="' + a.icon + '" style="width:16px;height:16px"> ' + a.platform + '</div>' +
                    '<div class="fake-username">' + a.username + '</div>' +
                    '<div class="fake-reason">' + a.reason + '</div>' +
                    '<div class="fake-stats">' +
                        '<span class="reported-count">🚩 ' + a.reportedCount + ' Reports</span>' +
                    '</div>' +
                    '<div class="fake-actions">' +
                        '<a href="' + a.profileUrl + '" target="_blank" class="btn btn-red btn-sm">🚨 Report Now</a>' +
                        '<button onclick="copyTxt(\'' + a.username + '\')" class="btn btn-outline btn-sm">📋 Copy</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    });

    let officialCardsHTML = '';
    DATA.realAccounts.forEach(function(acc) {
        officialCardsHTML += '<div class="official-card">' +
            '<div class="official-screenshot-wrap">' +
                '<img src="' + acc.screenshot + '" class="official-screenshot" alt="Official Account Screenshot">' +
                '<div class="verified-stamp">' +
                    '<img src="' + IMAGES.blueTick + '" class="verified-stamp-img" alt="Verified">' +
                '</div>' +
            '</div>' +
            '<div class="official-info">' +
                '<div class="official-header">' +
                    '<img src="' + acc.icon + '" style="width:20px;height:20px">' +
                    '<span class="official-username">' + acc.username + '</span>' +
                    '<img src="' + acc.verifiedIcon + '" style="width:16px;height:16px">' +
                '</div>' +
                '<div class="official-followers">' + acc.followers + ' Followers</div>' +
                '<a href="' + acc.url + '" target="_blank" class="btn btn-green btn-sm">✅ Follow Official</a>' +
            '</div>' +
        '</div>';
    });

    let galleryHTML = '';
    if (galleryPhotos.length === 0) {
        galleryHTML = '<p class="empty-gallery">📸 No photos yet</p>';
    } else {
        galleryPhotos.forEach(function(p) {
            galleryHTML += '<div class="gallery-item"><img src="' + p.path + '" alt="Photo" loading="lazy"></div>';
        });
    }

    let musicSectionHTML = '';
    if (coverSongs.length > 0) {
        let songListHTML = '';
        coverSongs.forEach(function(s, i) {
            songListHTML += '<div class="song-item" id="song-' + i + '" onclick="playSong(\'' + s.audioUrl + '\',\'' + s.title + '\',\'' + s.artist + '\',\'' + (s.coverUrl || '') + '\',' + i + ')">' +
                '<span class="song-number">' + String(i + 1).padStart(2, '0') + '</span>' +
                '<div class="song-info"><div class="song-title">' + s.title + '</div><div class="song-artist">' + s.artist + '</div></div>' +
                '<span class="song-play-icon">▶</span>' +
            '</div>';
        });

        musicSectionHTML = '<section id="music" class="music-section">' +
            '<div class="music-header">' +
                '<img src="' + IMAGES.voiceMic + '" class="music-header-icon" alt="Mic">' +
                '<span class="music-title">Cover Music</span>' +
                '<span class="music-count">' + coverSongs.length + ' tracks</span>' +
            '</div>' +
            '<div class="music-player-area">' +
                '<div class="album-art" id="albumArt"><span>🎵</span></div>' +
                '<div class="music-info">' +
                    '<div id="currentTitle" class="current-title">Select a Song</div>' +
                    '<div id="currentArtist" class="current-artist">Cover Music</div>' +
                '</div>' +
                '<button class="play-btn" id="playBtn" onclick="togglePlay()">▶️</button>' +
            '</div>' +
            '<div class="progress-area">' +
                '<span id="currentTime" class="time-display">0:00</span>' +
                '<div class="progress-bar" onclick="seekAudio(event)"><div class="progress-fill" id="progressFill"><div class="progress-thumb"></div></div></div>' +
                '<span id="totalTime" class="time-display">0:00</span>' +
            '</div>' +
            '<div class="song-list">' + songListHTML + '</div>' +
            '<audio id="coverAudio" preload="none"></audio>' +
        '</section>';
    }

    return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
'<meta name="theme-color" content="#ffffff">' +
'<title>Baiilla Maach | Verification Hub</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
'<style>' +
':root{--bg:#ffffff;--surface:#f8f9fa;--surface2:#ffffff;--text:#1a1a2e;--text2:#4a4a6a;--text3:#8888aa;--purple:#8b5cf6;--purple2:#6d28d9;--pink:#ec4899;--green:#10b981;--red:#ef4444;--yellow:#eab308;--border:#e5e7eb;--shadow:0 2px 8px rgba(0,0,0,0.08);--shadow-lg:0 10px 40px rgba(0,0,0,0.12);--glow-purple:0 0 30px rgba(139,92,246,0.2);--glow-green:0 0 20px rgba(16,185,129,0.2);--glow-red:0 0 20px rgba(239,68,68,0.2)}' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Plus Jakarta Sans",sans-serif;background:linear-gradient(135deg,#f8f9fa 0%,#ffffff 100%);color:var(--text);min-height:100vh;overflow-x:hidden}' +
'.bg-pattern{position:fixed;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;opacity:0.03;background-image:radial-gradient(circle at 20% 50%,#8b5cf6 1px,transparent 1px),radial-gradient(circle at 80% 20%,#ec4899 1px,transparent 1px),radial-gradient(circle at 50% 80%,#10b981 1px,transparent 1px);background-size:60px 60px}' +
'main{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:20px}' +
'.card{background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:24px;margin-bottom:20px;box-shadow:var(--shadow);transition:all 0.3s}' +
'.card:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px)}' +
'.danger-card{border-left:4px solid var(--red)}' +
'.success-card{border-left:4px solid var(--green)}' +
'.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;border:none;text-decoration:none;transition:all 0.3s;white-space:nowrap}' +
'.btn-purple{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;box-shadow:var(--glow-purple)}' +
'.btn-red{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:var(--glow-red)}' +
'.btn-green{background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:var(--glow-green)}' +
'.btn-outline{background:#fff;border:2px solid var(--border);color:var(--text2)}' +
'.btn-outline:hover{background:var(--surface);border-color:var(--purple)}' +
'.btn-sm{padding:8px 16px;font-size:12px;border-radius:10px}' +
'.badge{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:600}' +
'.badge-red{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}' +
'.badge-green{background:#f0fdf4;color:#059669;border:1px solid #bbf7d0}' +
'.badge-purple{background:#faf5ff;color:#7c3aed;border:1px solid #e9d5ff}' +
'.badge-yellow{background:#fefce8;color:#ca8a04;border:1px solid #fef08a}' +
'.main-header{background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:14px 0;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)}' +
'.header-inner{display:flex;align-items:center;justify-content:space-between;max-width:900px;margin:0 auto;padding:0 20px}' +
'.header-logo{display:flex;align-items:center;gap:10px}' +
'.header-logo img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)}' +
'.header-title{font-weight:700;font-size:17px;background:linear-gradient(135deg,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}' +
'.header-nav{display:flex;gap:6px}' +
'.header-nav a{padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;text-decoration:none;transition:all 0.3s}' +
'.nav-red{color:#dc2626;background:#fef2f2}' +
'.nav-red:hover{background:#fee2e2}' +
'.nav-green{color:#059669;background:#f0fdf4}' +
'.nav-green:hover{background:#dcfce7}' +
'.nav-purple{color:#7c3aed;background:#faf5ff}' +
'.nav-purple:hover{background:#ede9fe}' +
'.profile-section{text-align:center;padding:30px 0}' +
'.profile-pic-wrap{position:relative;display:inline-block;margin-bottom:16px}' +
'.profile-pic{width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid var(--purple);box-shadow:0 0 30px rgba(139,92,246,0.3)}' +
'.verified-badge-prof{position:absolute;bottom:2px;right:2px;width:34px;height:34px;background:#fff;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2)}' +
'.verified-badge-prof img{width:100%;height:100%;object-fit:contain}' +
'.profile-name{font-size:28px;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#ec4899,#6d28d9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:8px}' +
'.profile-bio{color:var(--text2);font-size:14px;margin-top:6px}' +
'.stats-row{display:flex;justify-content:center;gap:16px;margin:20px 0;flex-wrap:wrap}' +
'.stat-card{background:var(--surface);border:2px solid var(--border);border-radius:16px;padding:16px 28px;text-align:center}' +
'.stat-value{font-size:24px;font-weight:700;color:var(--purple)}' +
'.stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px}' +
'.section-header{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border)}' +
'.icon-circle{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}' +
'.icon-red{background:#fef2f2;color:#ef4444}' +
'.icon-green{background:#f0fdf4;color:#10b981}' +
'.icon-yellow{background:#fefce8;color:#eab308}' +
'.section-title{font-size:20px;font-weight:700}' +
'.section-subtitle{font-size:12px;color:var(--text3);margin-top:4px}' +

'/* Fake Cards */' +
'.fake-card{background:#fff;border:2px solid #fecaca;border-radius:20px;padding:0;margin-bottom:16px;overflow:hidden;box-shadow:0 4px 12px rgba(239,68,68,0.1)}' +
'.fake-card-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#fef2f2;border-bottom:1px solid #fecaca}' +
'.fake-badge{font-weight:700;font-size:12px;color:#dc2626}' +
'.threat-badge{padding:4px 12px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase}' +
'.threat-critical{background:#dc2626;color:#fff}' +
'.threat-high{background:#f97316;color:#fff}' +
'.fake-card-body{display:flex;gap:16px;padding:18px}' +
'.fake-screenshot-wrap{position:relative;width:180px;height:200px;flex-shrink:0;border-radius:12px;overflow:hidden;border:2px solid #fecaca}' +
'.fake-card-img{width:100%;height:100%;object-fit:cover}' +
'.warning-overlay{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:warningPulse 1.5s ease-in-out infinite}' +
'.warning-img{width:80%;height:auto;opacity:0.9;animation:warningFloat 2s ease-in-out infinite}' +
'.warning-text{font-size:18px;font-weight:800;color:#dc2626;text-shadow:0 2px 4px rgba(0,0,0,0.3);margin-top:8px;letter-spacing:2px}' +
'@keyframes warningPulse{0%,100%{background:rgba(239,68,68,0.1)}50%{background:rgba(239,68,68,0.3)}}' +
'@keyframes warningFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.05)}}' +
'.fake-info{flex:1;min-width:0}' +
'.fake-platform{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px;margin-bottom:6px}' +
'.fake-username{font-size:16px;font-weight:700;color:#dc2626;margin-bottom:8px}' +
'.fake-reason{font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:10px}' +
'.fake-stats{margin-bottom:12px}' +
'.reported-count{font-size:11px;color:#f97316;font-weight:600}' +
'.fake-actions{display:flex;gap:8px;flex-wrap:wrap}' +

'/* Official Cards */' +
'.official-card{background:#fff;border:2px solid #bbf7d0;border-radius:20px;padding:0;margin-bottom:16px;overflow:hidden;box-shadow:0 4px 12px rgba(16,185,129,0.1)}' +
'.official-screenshot-wrap{position:relative;width:100%;height:250px;overflow:hidden;border-bottom:2px solid #bbf7d0}' +
'.official-screenshot{width:100%;height:100%;object-fit:cover}' +
'.verified-stamp{position:absolute;top:12px;right:12px;width:40px;height:40px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);animation:stampBounce 2s ease-in-out infinite}' +
'.verified-stamp-img{width:28px;height:28px;object-fit:contain}' +
'@keyframes stampBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}' +
'.official-info{padding:16px 18px}' +
'.official-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
'.official-username{font-size:16px;font-weight:700;color:#059669}' +
'.official-followers{font-size:12px;color:var(--text3);margin-bottom:12px}' +

'/* Gallery */' +
'.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}' +
'.gallery-item{border-radius:16px;overflow:hidden;border:2px solid var(--border);transition:all 0.3s}' +
'.gallery-item:hover{transform:scale(1.03);border-color:var(--purple)}' +
'.gallery-item img{width:100%;height:140px;object-fit:cover;display:block}' +
'.empty-gallery{text-align:center;padding:40px;color:var(--text3);font-size:16px;grid-column:1/-1}' +

'/* Music Section */' +
'.music-section{background:linear-gradient(135deg,#faf5ff,#fff1f2);border:2px solid #e9d5ff;border-radius:24px;padding:24px}' +
'.music-header{display:flex;align-items:center;gap:10px;margin-bottom:20px}' +
'.music-header-icon{width:24px;height:24px}' +
'.music-title{font-weight:700;font-size:18px}' +
'.music-count{font-size:11px;color:var(--text3);margin-left:auto}' +
'.music-player-area{display:flex;align-items:center;gap:16px;margin-bottom:16px}' +
'.album-art{width:80px;height:80px;border-radius:16px;background:linear-gradient(135deg,#e9d5ff,#fce7f3);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;border:2px solid #e9d5ff;overflow:hidden}' +
'.album-art img{width:100%;height:100%;object-fit:cover}' +
'.music-info{flex:1;min-width:0}' +
'.current-title{font-weight:600;font-size:15px}' +
'.current-artist{font-size:12px;color:var(--text3);margin-top:4px}' +
'.play-btn{width:52px;height:52px;border-radius:50%;background:#10b981;border:none;color:#fff;font-size:20px;cursor:pointer;flex-shrink:0;box-shadow:0 4px 12px rgba(16,185,129,0.3)}' +
'.progress-area{display:flex;align-items:center;gap:10px;margin-bottom:16px}' +
'.progress-bar{flex:1;height:6px;background:#e5e7eb;border-radius:3px;cursor:pointer}' +
'.progress-fill{height:100%;background:linear-gradient(90deg,#8b5cf6,#ec4899);border-radius:3px;width:0%;transition:width 0.1s}' +
'.time-display{font-size:10px;color:var(--text3);width:35px}' +
'.song-list{max-height:220px;overflow-y:auto}' +
'.song-item{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;cursor:pointer;transition:all 0.2s}' +
'.song-item:hover{background:#fff}' +
'.song-item.active{background:#f0fdf4;border:2px solid #bbf7d0}' +
'.song-number{font-size:12px;color:var(--text3);width:26px;font-weight:500}' +
'.song-info{flex:1}' +
'.song-title{font-weight:500;font-size:13px}' +
'.song-artist{font-size:10px;color:var(--text3)}' +
'.song-play-icon{font-size:12px;color:var(--text3)}' +

'.toast{position:fixed;top:20px;right:20px;z-index:99999;background:#fff;border:2px solid var(--border);padding:14px 20px;border-radius:14px;color:var(--text);font-size:13px;transform:translateX(120%);transition:transform 0.4s;box-shadow:0 10px 40px rgba(0,0,0,0.15)}' +
'.toast.show{transform:translateX(0)}' +
'.toast.error{border-left:4px solid var(--red)}' +
'.toast.success{border-left:4px solid var(--green)}' +

'.chat-widget{position:fixed;bottom:24px;right:24px;z-index:9999}' +
'.chat-btn{height:56px;border-radius:28px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;cursor:pointer;box-shadow:0 8px 24px rgba(139,92,246,0.3);display:flex;align-items:center;gap:10px;padding:0 22px;transition:all 0.3s;color:#fff;font-weight:600;font-size:14px}' +
'.chat-btn:hover{transform:scale(1.05);box-shadow:0 12px 32px rgba(236,72,153,0.4)}' +
'.chat-btn img{width:34px;height:34px;border-radius:50%}' +

'@media(max-width:768px){.fake-card-body{flex-direction:column}.fake-screenshot-wrap{width:100%;height:220px}.header-nav{display:none}.official-screenshot-wrap{height:200px}}' +
'@media(max-width:640px){.chat-widget{bottom:16px;right:16px}}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="bg-pattern"></div>' +
'<div id="toast" class="toast"></div>' +
'<header class="main-header"><div class="header-inner"><div class="header-logo"><img src="' + profilePic + '" alt="Logo"><span class="header-title">Verification Hub</span></div><nav class="header-nav"><a href="#fake" class="nav-red">⚠ Fakes</a>' + (coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : '') + '<a href="#warning" class="nav-purple">🔍 Guide</a><a href="#official" class="nav-green">✓ Official</a><a href="#gallery" class="nav-purple">📸 Gallery</a></nav></div></header>' +
'<main>' +
'<section class="profile-section"><div class="profile-pic-wrap"><img src="' + profilePic + '" class="profile-pic" alt="Profile"><div class="verified-badge-prof"><img src="' + IMAGES.blueTick + '" alt="Verified"></div></div><h1 class="profile-name">' + DATA.celebrity.fullName + '</h1><p class="profile-bio">' + DATA.celebrity.bio + '</p><div class="stats-row"><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokFollowers + '</div><div class="stat-label">Followers</div></div><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokFollowing + '</div><div class="stat-label">Following</div></div><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokLikes + '</div><div class="stat-label">Likes</div></div></div><div style="display:flex;gap:8px;justify-content:center"><span class="badge badge-green"><img src="' + IMAGES.blueTick + '" style="width:12px;height:12px"> Verified</span><span class="badge badge-purple">Creator</span></div></section>' +

'<section id="fake" class="card danger-card"><div class="section-header"><div class="icon-circle icon-red">⚠️</div><div><div class="section-title" style="color:#dc2626">Fake Accounts Detected</div><div class="section-subtitle">Report these impersonating accounts immediately</div></div><span class="badge badge-red" style="margin-left:auto">' + totalFake + ' Active Threats</span></div>' + fakeCardsHTML + '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid #fecaca"><button class="btn btn-red btn-sm" id="voicePlayBtn" onclick="toggleFakeVoice()">🔊 Play Alert Voice</button><button class="btn btn-outline btn-sm" id="voiceStopBtn" onclick="stopFakeVoice()" style="display:none">⏹ Stop</button></div><audio id="fakeVoice" src="' + VOICE.fakeAlert + '" preload="auto"></audio></section>' +

musicSectionHTML +

'<section id="warning" class="card" style="text-align:center;background:linear-gradient(135deg,#fefce8,#fff7ed);border:2px solid #fde68a"><img src="' + IMAGES.fakeDetect + '" alt="Fake Detection Guide" style="max-width:100%;border-radius:12px;margin-bottom:16px"><div style="margin-bottom:8px"><span class="badge badge-yellow">🔍 Fake Account Detection Guide</span></div><p style="color:var(--text2);font-size:13px;line-height:1.6">Always check for the verified badge before interacting. Report suspicious accounts immediately to protect the community.</p></section>' +

'<section id="official" class="card success-card"><div class="section-header"><div class="icon-circle icon-green"><img src="' + IMAGES.blueTick + '" style="width:22px;height:22px"></div><div><div class="section-title" style="color:#059669">Official Verified Accounts</div><div class="section-subtitle">Only follow these real accounts</div></div></div>' + officialCardsHTML + '</section>' +

'<section id="gallery" class="card"><div class="section-header"><span style="font-size:24px">📸</span><div><div class="section-title">Photo Gallery</div><div class="section-subtitle">Official moments & updates</div></div></div><div class="gallery-grid">' + galleryHTML + '</div></section>' +
'</main>' +

'<div class="chat-widget"><button class="chat-btn" onclick="window.open(\'/chat\',\'_blank\')"><img src="' + IMAGES.messageIcon + '" alt="Chat"><span>💬 Chat Now</span></button></div>' +

'<script>function showToast(m,t){var e=document.getElementById("toast");e.textContent=m;e.className="toast show "+(t||"");setTimeout(function(){e.classList.remove("show")},2800)}function copyTxt(t){navigator.clipboard.writeText(t).then(function(){showToast("Copied!","success")})}var fvp=false,fa=document.getElementById("fakeVoice");function toggleFakeVoice(){var b=document.getElementById("voicePlayBtn"),s=document.getElementById("voiceStopBtn");if(fvp){fa.pause();fa.currentTime=0;fvp=false;b.textContent="🔊 Play Alert Voice";b.style.display="";s.style.display="none"}else{fa.play().then(function(){fvp=true;b.textContent="🔊 Playing...";s.style.display=""}).catch(function(){showToast("Error playing audio","error")})}}function stopFakeVoice(){fa.pause();fa.currentTime=0;fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert Voice";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"}fa.addEventListener("ended",function(){fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert Voice";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"});var ca=null,ip=false;function playSong(u,t,a,c,i){var ad=document.getElementById("coverAudio"),pb=document.getElementById("playBtn"),ar=document.getElementById("albumArt");if(ca===u){togglePlay();return}if(ca){ad.pause()}ca=u;ad.src=u;document.getElementById("currentTitle").textContent=t||"Unknown";document.getElementById("currentArtist").textContent=a||"Unknown";ar.innerHTML=c?\'<img src="\'+c+\'" style="width:100%;height:100%;object-fit:cover">\':"<span>🎵</span>";document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";document.getElementById("totalTime").textContent="0:00";document.querySelectorAll(".song-item").forEach(function(e){e.classList.remove("active")});var se=document.getElementById("song-"+i);if(se)se.classList.add("active");ad.play().then(function(){ip=true;pb.textContent="⏸️"}).catch(function(){showToast("Error playing song","error")});ad.ontimeupdate=function(){if(ad.duration){document.getElementById("progressFill").style.width=(ad.currentTime/ad.duration)*100+"%";document.getElementById("currentTime").textContent=ft(ad.currentTime)}};ad.onloadedmetadata=function(){document.getElementById("totalTime").textContent=ft(ad.duration)};ad.onended=function(){ip=false;pb.textContent="▶️";document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";ca=null}}function togglePlay(){var a=document.getElementById("coverAudio"),b=document.getElementById("playBtn");if(!a.src||a.src===window.location.href){showToast("Select a song first","error");return}if(ip){a.pause();ip=false;b.textContent="▶️"}else{a.play().then(function(){ip=true;b.textContent="⏸️"}).catch(function(){showToast("Error","error")})}}function seekAudio(e){var a=document.getElementById("coverAudio");if(!a.duration)return;a.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*a.duration}function ft(s){if(isNaN(s))return"0:00";return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")}</script>' +
'<audio id="welcomeVoice" src="' + VOICE.welcome + '" preload="none"></audio>' +
'</body></html>';
}

function getAdminLoginHTML(e) {
    e = e || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white flex items-center justify-center min-h-screen"><div class="bg-white p-8 rounded-2xl w-full max-w-sm border-2 border-gray-200 shadow-lg"><h2 class="text-xl font-bold text-gray-900 text-center mb-6">Admin Login</h2>' + (e ? '<div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center border border-red-200">' + e + '</div>' : '') + '<form method="POST" action="/admin/login"><input name="username" placeholder="Username" class="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-gray-900 mb-3 focus:border-purple-500 outline-none" required><input type="password" name="password" placeholder="Password" class="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-gray-900 mb-4 focus:border-purple-500 outline-none" required><button class="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-400 hover:text-purple-600">← Back to Site</a></div></body></html>';
}

async function getAdminPanelHTML(p, m, e) {
    p = p || [];
    m = m || '';
    e = e || '';
    const cl = getAdminChatList();
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 min-h-screen"><header class="bg-white p-4 border-b-2 border-gray-200 shadow-sm"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-purple-600">Admin Panel</h1><div class="flex gap-3"><a href="/admin/chat" class="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium">💬 Chats (' + cl.reduce((s,c) => s + c.unread, 0) + ')</a><a href="/" class="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm text-gray-700">🌐 Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm">Logout</a></div></div></header><div class="max-w-6xl mx-auto p-4">' + (m ? '<div class="bg-green-50 text-green-700 p-4 rounded-xl mb-4 border border-green-200">' + m + '</div>' : '') + (e ? '<div class="bg-red-50 text-red-600 p-4 rounded-xl mb-4 border border-red-200">' + e + '</div>' : '') + '<div class="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm mb-6"><h2 class="font-bold text-lg mb-4 text-gray-900">📸 Upload Photo</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" class="mb-3 text-gray-700" required><input name="caption" placeholder="Caption (optional)" class="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-gray-900 mb-3 focus:border-purple-500 outline-none"><button class="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">Upload Photo</button></form></div><h2 class="text-xl font-bold mb-4 text-gray-900">🖼 Gallery (' + p.length + ' photos)</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">' + p.map(x => '<div class="bg-white rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm"><img src="' + x.path + '" class="w-full h-40 object-cover"><div class="p-3"><p class="text-sm text-gray-500">' + (x.caption || 'No caption') + '</p><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="' + x._id + '"><button class="text-red-500 text-sm mt-2 hover:text-red-700">🗑 Delete</button></form></div></div>').join('') + (p.length === 0 ? '<p class="text-gray-400 col-span-4 text-center py-12">No photos uploaded yet</p>' : '') + '</div></div></body></html>';
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const pu = url.parse(req.url, true);
    const pn = pu.pathname;
    const m = req.method;
    const ck = parseCookies(req.headers.cookie);
    
    if (pn.startsWith('/assets/')) {
        const ap = path.join(__dir, decodeURIComponent(pn));
        if (!ap.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(ap)) {
            const e = path.extname(ap).toLowerCase();
            const t = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.webm':'audio/webm' };
            res.writeHead(200, { 'Content-Type': t[e] || 'application/octet-stream' });
            fs.createReadStream(ap).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    
    if (pn === '/chat' && m === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getChatPageHTML());
        return;
    }
    
    if (pn === '/api/chat/register' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(b);
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Name and contact required' })); return; }
                const u = createOrGetChatUser(name, phoneEmail);
                if (!u) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Failed to create user' })); return; }
                const t = createChatSession(u.chatId);
                const existingMessages = getChatMessages(u.chatId);
                if (existingMessages.length === 0) { saveChatMessage(u.chatId, 'admin', 'Hello! How can I help you? 👋'); }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: u.chatId, token: t, name, phoneEmail }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: e.message })); }
        }); return;
    }
    
    if (pn === '/api/chat/verify' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!u, chatId: u ? u.chatId : null }));
        return;
    }
    
    if (pn === '/api/chat/messages' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(u.chatId) }));
        return;
    }
    
    if (pn === '/api/chat/send' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { token, message, type, fileUrl, fileName, duration } = JSON.parse(b);
            const u = getChatUserByToken(token);
            if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            saveChatMessage(u.chatId, 'user', message, type, fileUrl, fileName, duration);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    if (pn === '/api/chat/upload' && m === 'POST') {
        const token = pu.query.token;
        const u = getChatUserByToken(token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const fm = new formidable.IncomingForm({ uploadDir: CHAT_UPLOADS_DIR, keepExtensions: true });
        fm.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const fn = Date.now() + '_' + pf.originalFilename;
            fs.renameSync(pf.filepath, path.join(CHAT_UPLOADS_DIR, fn));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fn }));
        }); return;
    }
    
    if (pn === '/api/chat/upload-voice' && m === 'POST') {
        const token = pu.query.token;
        const u = getChatUserByToken(token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const fm = new formidable.IncomingForm({ uploadDir: CHAT_UPLOADS_DIR, keepExtensions: true });
        fm.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const pf = Array.isArray(files.voice) ? files.voice[0] : files.voice;
            if (!pf) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const fn = 'voice_' + Date.now() + '.webm';
            fs.renameSync(pf.filepath, path.join(CHAT_UPLOADS_DIR, fn));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fn }));
        }); return;
    }
    
    if (pn === '/admin' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (s) { adminPresence.isOnline = true; adminPresence.lastSeen = new Date(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminPanelHTML(await getGalleryPhotos())); return; }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(getAdminLoginHTML()); return;
    }
    
    if (pn === '/admin/login' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            if (await verifyAdmin(p.get('username'), p.get('password'))) {
                const s = createSession(p.get('username'));
                adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=' + s + ';HttpOnly;Path=/;Max-Age=7200' }); res.end();
            } else { res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(getAdminLoginHTML('Invalid credentials')); }
        }); return;
    }
    
    if (pn === '/admin/logout') {
        sessions.delete(ck.sessionId);
        adminPresence.isOnline = false; adminPresence.lastSeen = new Date();
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' }); res.end(); return;
    }
    
    if (pn === '/admin/chat' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
        const cid = pu.query.chatId, cl = getAdminChatList();
        let ms = [];
        if (cid) { ms = getChatMessages(cid); markMessagesRead(cid); }
        
        let messagesHTML = '';
        ms.forEach(function(m) {
            var cls = m.sender === 'user' ? 'user' : 'admin';
            messagesHTML += '<div class="msg-b ' + cls + '"><div class="bub">' + renderMsgBubble(m) + '</div></div>';
        });
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat</title><script src="https://cdn.tailwindcss.com"></script><style>@keyframes voiceAnim{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.3)}}body{margin:0;display:flex;height:100vh;font-family:"Plus Jakarta Sans",sans-serif;background:#f8f9fa;color:#1a1a2e}.sidebar{width:350px;background:#fff;border-right:2px solid #e5e7eb;overflow-y:auto}.main{flex:1;display:flex;flex-direction:column}.messages{flex:1;overflow-y:auto;padding:20px;background:#f8f9fa}.msg-b{margin-bottom:12px;display:flex}.msg-b.user{justify-content:flex-start}.msg-b.admin{justify-content:flex-end}.msg-b .bub{max-width:70%;padding:10px 14px;border-radius:18px;font-size:13px;word-wrap:break-word}.msg-b.user .bub{background:#fff;border:2px solid #e5e7eb;border-bottom-left-radius:4px;color:#1a1a2e}.msg-b.admin .bub{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px;color:#fff}.image-preview{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer}.image-preview img{max-width:95%;max-height:95%;border-radius:12px}.admin-input-area{background:#fff;padding:14px;display:flex;gap:10px;border-top:2px solid #e5e7eb}.admin-input{flex:1;padding:10px 16px;background:#f8f9fa;border:2px solid #e5e7eb;border-radius:25px;color:#1a1a2e;font-size:13px;outline:none}.admin-input:focus{border-color:#8b5cf6}.admin-send-btn{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;padding:10px 24px;border-radius:25px;cursor:pointer;font-weight:600;font-size:13px}.admin-file-btn{width:40px;height:40px;border-radius:50%;background:#f8f9fa;border:2px solid #e5e7eb;color:#1a1a2e;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}.sidebar-item{padding:14px 16px;cursor:pointer;border-bottom:1px solid #e5e7eb;transition:background 0.2s}.sidebar-item:hover{background:#f8f9fa}.sidebar-item.active{background:#faf5ff;border-left:4px solid #8b5cf6}.unread-badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:8px}@media(max-width:768px){.sidebar{width:100%;position:absolute;top:0;left:0;bottom:0;z-index:10}.main{position:absolute;top:0;left:0;right:0;bottom:0;z-index:20}.sidebar.hidden-mobile{display:none}}</style></head><body><div class="sidebar" id="sidebar"><div style="padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);font-weight:600;display:flex;align-items:center;justify-content:space-between;color:#fff"><span>💬 Chats</span><div style="display:flex;gap:8px"><button onclick="refreshList()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:10px;cursor:pointer;font-size:11px">↻</button><a href="/admin" style="color:#fff;font-size:11px;text-decoration:none;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:10px">Back</a></div></div><div id="chatList">' + cl.map(function(c) { return '<div class="sidebar-item' + (c.chatId === cid ? ' active' : '') + '" onclick="selectChat(\'' + c.chatId + '\')"><div style="font-weight:600;display:flex;align-items:center;justify-content:space-between"><span>' + c.name + '</span>' + (c.unread > 0 ? '<span class="unread-badge">' + c.unread + '</span>' : '') + '</div><div style="font-size:12px;color:#888;margin-top:2px">' + c.phoneEmail + '</div><div style="font-size:10px;color:#aaa;margin-top:2px">' + (c.lastMessage ? (c.lastMessage.type === 'image' ? '📷 Photo' : c.lastMessage.message.substring(0, 30)) : 'No messages') + '</div></div>'; }).join('') + '</div></div><div class="main" id="mainPanel">' + (cid ? '<div style="padding:14px 16px;background:#fff;font-weight:600;display:flex;align-items:center;gap:10px;border-bottom:2px solid #e5e7eb"><button onclick="showMobileSidebar()" style="background:none;border:none;color:#1a1a2e;font-size:20px;display:none" class="back-btn">←</button><span>' + (cl.find(function(c) { return c.chatId === cid; }) ? cl.find(function(c) { return c.chatId === cid; }).name : '') + '</span></div><div class="messages" id="mc">' + messagesHTML + '</div><div class="admin-input-area"><input type="file" id="adminFileInput" accept="image/*" style="display:none" onchange="handleAdminFile(event)"><button class="admin-file-btn" onclick="document.getElementById(\'adminFileInput\').click()" title="Send Photo">📎</button><input id="am" class="admin-input" placeholder="Reply..." onkeypress="if(event.key===\'Enter\')sendAdminMessage()"><button class="admin-send-btn" onclick="sendAdminMessage()">Send</button></div><audio id="voicePlayer" style="display:none"></audio><div class="image-preview" id="imagePreview" style="display:none" onclick="this.style.display=\'none\'"><img id="previewImg" src="" alt="Preview"></div><script>var cid="' + cid + '";function selectChat(id){window.location.href="/admin/chat?chatId="+id}function refreshList(){window.location.reload()}function lm(){fetch("/api/admin/messages?chatId="+cid).then(function(r){return r.json()}).then(function(d){if(d.success){var mc=document.getElementById("mc");var h="";d.messages.forEach(function(m){var c=m.sender==="user"?"user":"admin";h+=\'<div class="msg-b \'+c+\'"><div class="bub">\';if(m.type==="image"&&m.fileUrl){h+=\'<img src="\'+m.fileUrl+\'" style="max-width:250px;max-height:250px;border-radius:12px;cursor:pointer;display:block" onclick="showImg(\\\'\'+m.fileUrl+\'\\\')">\'}else if(m.type==="voice"&&m.fileUrl){h+=\'<div style="display:flex;align-items:center;gap:10px"><button onclick="playV(\\\'\'+m.fileUrl+\'\\\',this)" style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.1);border:none;font-size:14px;cursor:pointer">▶</button><span style="font-size:11px">Voice message</span></div>\'}else{h+=m.message}h+=\'<div style="font-size:10px;opacity:0.5;margin-top:4px">\'+new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+\'</div></div></div>\'});mc.innerHTML=h;mc.scrollTop=mc.scrollHeight}})}function sendAdminMessage(){var i=document.getElementById("am");var msg=i.value.trim();if(!msg)return;fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:msg,type:"text"})}).then(function(){i.value="";lm()})}function handleAdminFile(event){var file=event.target.files[0];if(!file)return;var fd=new FormData();fd.append("photo",file);fetch("/api/admin/upload-file?chatId="+cid,{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(d){if(d.success){fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:"Photo",type:"image",fileUrl:d.fileUrl})}).then(function(){lm()})}});event.target.value=""}function playV(url,btn){var p=document.getElementById("voicePlayer");if(p.src===url&&!p.paused){p.pause();btn.textContent="▶";return}p.src=url;p.play();btn.textContent="⏸";p.onended=function(){btn.textContent="▶"};p.onpause=function(){btn.textContent="▶"}}function showImg(url){document.getElementById("previewImg").src=url;document.getElementById("imagePreview").style.display="flex"}function showMobileSidebar(){document.getElementById("sidebar").classList.toggle("hidden-mobile")}setInterval(lm,2000);setInterval(refreshList,10000);</script>' : '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#888;flex-direction:column;gap:10px"><div style="font-size:60px">💬</div><div>Select a chat from the left</div><button onclick="refreshList()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;margin-top:10px">Refresh List</button></div>') + '</div></body></html>');
        return;
    }
    
    if (pn === '/api/admin/messages' && m === 'GET') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        markMessagesRead(pu.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, messages: getChatMessages(pu.query.chatId) })); return;
    }
    
    if (pn === '/api/admin/send' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { chatId, message, type, fileUrl } = JSON.parse(b);
            saveChatMessage(chatId, 'admin', message, type, fileUrl);
            adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    if (pn === '/api/admin/upload-file' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const fm = new formidable.IncomingForm({ uploadDir: CHAT_UPLOADS_DIR, keepExtensions: true });
        fm.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const fn = 'admin_' + Date.now() + '_' + pf.originalFilename;
            fs.renameSync(pf.filepath, path.join(CHAT_UPLOADS_DIR, fn));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fn }));
        }); return;
    }
    
    if (pn === '/admin/upload' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        const fm = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true });
        fm.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
            const fn = Date.now() + '_' + pf.originalFilename;
            fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
            await savePhoto({ path: '/assets/gallery/' + fn, caption: fields.caption || '' });
            res.writeHead(302, { 'Location': '/admin' }); res.end();
        }); return;
    }
    
    if (pn === '/admin/delete' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            try { const ph = await db.collection('gallery_photos').findOne({ _id: new ObjectId(p.get('photoId')) }); if (ph && fs.existsSync(path.join(__dir, ph.path))) fs.unlinkSync(path.join(__dir, ph.path)); await deletePhoto(p.get('photoId')); } catch (e) {}
            res.writeHead(302, { 'Location': '/admin' }); res.end();
        }); return;
    }
    
    if (pn === '/' || pn === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(await getGalleryPhotos())); return;
    }
    
    res.writeHead(404); res.end('404');
});

async function start() {
    const dbOk = await connectDB();
    if (dbOk) console.log('MongoDB Connected');
    else console.log('Using in-memory storage');
    server.listen(PORT, function() { console.log('Server running at http://localhost:' + PORT); });
}
start().catch(console.error);

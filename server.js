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
        mongoClient = new MongoClient(MONGO_URI, { 
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 15000
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        await db.command({ ping: 1 });
        
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) { 
            if (!names.includes(col)) {
                await db.createCollection(col);
            }
        }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
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

async function getGalleryPhotos() { 
    if (!db || !dbConnected) return []; 
    try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } 
}
async function savePhoto(d) { 
    if (!db || !dbConnected) return null; 
    try { return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); } catch(e) { return null; }
}
async function deletePhoto(id) { 
    if (!db || !dbConnected) return null; 
    try { return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); } catch(e) { return null; }
}
async function verifyAdmin(u, p) { 
    if (!db || !dbConnected) return u === 'admin' && p === 'admin123'; 
    try {
        const a = await db.collection('admin_users').findOne({ username: u }); 
        if (!a) return false; 
        return await bcrypt.compare(p, a.password); 
    } catch(e) { return u === 'admin' && p === 'admin123'; }
}

function createOrGetChatUser(name, phoneEmail) {
    const clean = (phoneEmail || '').trim().toLowerCase();
    if (!clean) return null;
    
    let user = memoryStore.users.get(clean);
    if (user) {
        user.name = name;
        user.lastSeen = new Date();
        user.status = 'active';
        memoryStore.users.set(clean, user);
        return user;
    }
    
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
    if (new Date() > session.expiresAt) {
        memoryStore.sessions.delete(token);
        return null;
    }
    for (const [key, user] of memoryStore.users) {
        if (user.chatId === session.chatId) return user;
    }
    return null;
}

function getChatMessages(chatId) {
    const msgs = memoryStore.messages.get(chatId) || [];
    return msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function saveChatMessage(chatId, sender, message, type, fileUrl, fileName, duration) {
    const msg = { 
        chatId, sender, message, 
        type: type || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        duration: duration || null,
        createdAt: new Date(), 
        read: false 
    };
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
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", icon: IMAGES.facebookIcon, screenshot: IMAGES.realIdSS, verified: true, followers: "Growing", verifiedIcon: IMAGES.blueTick }
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

function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;

    let fakeCardsHTML = '';
    DATA.fakeAccounts.forEach(function(a) {
        fakeCardsHTML += '<div class="fake-card"><div class="fake-card-body">';
        if (a.screenshot) {
            fakeCardsHTML += '<img src="' + a.screenshot + '" class="fake-card-img" alt="Fake">';
        } else {
            fakeCardsHTML += '<div class="fake-card-placeholder">⚠️</div>';
        }
        fakeCardsHTML += '<div style="flex:1;min-width:0"><div style="font-weight:700;color:#fca5a5;font-size:14px;margin-bottom:4px">' + a.username + '</div>';
        fakeCardsHTML += '<div style="font-size:11px;color:#f87171;margin-bottom:6px">⚠ ' + a.reason + '</div>';
        fakeCardsHTML += '<div style="display:flex;gap:6px;flex-wrap:wrap"><a href="' + a.profileUrl + '" target="_blank" class="btn btn-red btn-sm">Report</a>';
        fakeCardsHTML += '<button onclick="copyTxt(\'' + a.username + '\')" class="btn btn-outline btn-sm">Copy</button></div></div></div></div>';
    });

    let officialCardsHTML = '';
    DATA.realAccounts.forEach(function(acc) {
        officialCardsHTML += '<div class="official-card">';
        officialCardsHTML += '<img src="' + acc.icon + '" style="width:22px;height:22px;flex-shrink:0">';
        officialCardsHTML += '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px">';
        officialCardsHTML += '<span style="font-weight:600;font-size:14px">' + acc.username + '</span>';
        officialCardsHTML += '<img src="' + acc.verifiedIcon + '" style="width:14px;height:14px">';
        officialCardsHTML += '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">' + acc.followers + ' followers</div></div>';
        officialCardsHTML += '<a href="' + acc.url + '" target="_blank" class="btn btn-green btn-sm">Follow</a></div>';
    });

    let galleryHTML = '';
    if (galleryPhotos.length === 0) {
        galleryHTML = '<p style="color:var(--text3);text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>';
    } else {
        galleryPhotos.forEach(function(p) {
            galleryHTML += '<div class="gallery-item"><img src="' + p.path + '" alt="Photo" loading="lazy"></div>';
        });
    }

    let musicSectionHTML = '';
    if (coverSongs.length > 0) {
        let songListHTML = '';
        coverSongs.forEach(function(s, i) {
            songListHTML += '<div class="song-item" id="song-' + i + '" onclick="playSong(\'' + s.audioUrl + '\',\'' + s.title + '\',\'' + s.artist + '\',\'' + (s.coverUrl || '') + '\',' + i + ')">';
            songListHTML += '<span style="opacity:0.4;font-size:12px;width:26px">' + String(i + 1).padStart(2, '0') + '</span>';
            songListHTML += '<div style="flex:1"><div style="font-weight:500;font-size:13px">' + s.title + '</div><div style="font-size:10px;opacity:0.4">' + s.artist + '</div></div>';
            songListHTML += '<span style="font-size:12px;opacity:0.3">▶</span></div>';
        });

        musicSectionHTML = '<section id="music" class="music-player">' +
            '<div class="music-header">' +
            '<img src="' + IMAGES.voiceMic + '" class="music-header-icon" alt="Mic">' +
            '<span style="font-weight:700;font-size:16px">Cover Music</span>' +
            '<span style="font-size:11px;opacity:0.5;margin-left:auto">' + coverSongs.length + ' tracks</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">' +
            '<div class="album-art" id="albumArt"><span>🎵</span></div>' +
            '<div style="flex:1;min-width:0">' +
            '<div id="currentTitle" style="font-weight:600;font-size:15px">Select a Song</div>' +
            '<div id="currentArtist" style="font-size:11px;opacity:0.6;margin-top:4px">Cover Music</div>' +
            '</div>' +
            '<button class="play-btn" id="playBtn" onclick="togglePlay()">▶️</button>' +
            '</div>' +
            '<div class="progress-wrap">' +
            '<span id="currentTime" style="font-size:10px;opacity:0.5;width:32px">0:00</span>' +
            '<div class="progress-bar" onclick="seekAudio(event)"><div class="progress-fill" id="progressFill"><div class="progress-thumb"></div></div></div>' +
            '<span id="totalTime" style="font-size:10px;opacity:0.5;width:32px;text-align:right">0:00</span>' +
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
'<meta name="theme-color" content="#0f0f1a">' +
'<title>Baiilla Maach | Verification Hub</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
'<style>' +
':root{--bg:#0a0a14;--surface:#13132b;--surface2:#1a1a35;--text:#f0f0ff;--text2:#a0a0cc;--text3:#6060a0;--purple:#8b5cf6;--purple2:#a78bfa;--pink:#ec4899;--green:#10b981;--red:#ef4444;--yellow:#eab308;--glass-border:rgba(255,255,255,0.06);--glow-purple:0 0 40px rgba(139,92,246,0.3);--glow-green:0 0 30px rgba(16,185,129,0.3);--glow-red:0 0 30px rgba(239,68,68,0.3);--glow-yellow:0 0 30px rgba(234,179,8,0.3)}' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Plus Jakarta Sans",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}' +
'.stars-bg{position:fixed;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;overflow:hidden}' +
'.star{position:absolute;background:white;border-radius:50%;animation:twinkle var(--dur) ease-in-out infinite;animation-delay:var(--delay);opacity:0}' +
'@keyframes twinkle{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:0.8;transform:scale(1.5)}}' +
'.orb{position:fixed;border-radius:50%;filter:blur(80px);opacity:0.3;pointer-events:none;z-index:0;animation:floatOrb var(--dur) ease-in-out infinite}' +
'@keyframes floatOrb{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,-40px) scale(1.1)}50%{transform:translate(-20px,-80px) scale(0.9)}75%{transform:translate(-40px,-20px) scale(1.05)}}' +
'main{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:16px}' +
'.glass-card{background:var(--surface);border:1px solid var(--glass-border);border-radius:24px;padding:24px;margin-bottom:20px;transition:all 0.4s}' +
'.glass-card:hover{transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,0.4)}' +
'.danger-card{border-left:3px solid var(--red)}' +
'.success-card{border-left:3px solid var(--green)}' +
'.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:50px;font-weight:600;font-size:13px;cursor:pointer;border:none;text-decoration:none;transition:all 0.3s}' +
'.btn-purple{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;box-shadow:var(--glow-purple)}' +
'.btn-red{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:var(--glow-red)}' +
'.btn-green{background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:var(--glow-green)}' +
'.btn-outline{background:transparent;border:1px solid var(--glass-border);color:var(--text2)}' +
'.btn-sm{padding:6px 14px;font-size:11px}' +
'.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:50px;font-size:11px;font-weight:600}' +
'.badge-red{background:rgba(239,68,68,0.15);color:#fca5a5}' +
'.badge-green{background:rgba(16,185,129,0.15);color:#6ee7b7}' +
'.badge-purple{background:rgba(139,92,246,0.15);color:#c4b5fd}' +
'.badge-yellow{background:rgba(234,179,8,0.15);color:#fde047}' +
'.main-header{background:rgba(10,10,20,0.8);backdrop-filter:blur(30px);border-bottom:1px solid var(--glass-border);padding:12px 0;position:sticky;top:0;z-index:100}' +
'.header-inner{display:flex;align-items:center;justify-content:space-between;max-width:860px;margin:0 auto;padding:0 16px}' +
'.header-logo{display:flex;align-items:center;gap:10px}' +
'.header-logo img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)}' +
'.header-title{font-weight:700;font-size:16px;background:linear-gradient(135deg,#c4b5fd,#f9a8d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}' +
'.header-nav{display:flex;gap:6px}' +
'.header-nav a{padding:7px 14px;border-radius:50px;font-size:11px;font-weight:600;text-decoration:none}' +
'.nav-red{color:#fca5a5;background:rgba(239,68,68,0.1)}' +
'.nav-green{color:#6ee7b7;background:rgba(16,185,129,0.1)}' +
'.nav-purple{color:#c4b5fd;background:rgba(139,92,246,0.1)}' +
'.profile-section{text-align:center;padding:30px 0 20px}' +
'.profile-pic-wrap{position:relative;display:inline-block;margin-bottom:12px}' +
'.profile-pic{width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--purple);box-shadow:var(--glow-purple)}' +
'.verified-badge-prof{position:absolute;bottom:4px;right:4px;width:30px;height:30px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;border:3px solid var(--bg);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff}' +
'.profile-name{font-size:26px;font-weight:800;background:linear-gradient(135deg,#c4b5fd,#f9a8d4,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:8px}' +
'.profile-bio{color:var(--text2);font-size:13px;margin-top:6px}' +
'.stats-row{display:flex;justify-content:center;gap:16px;margin:20px 0;flex-wrap:wrap}' +
'.stat-card{background:var(--surface2);border:1px solid var(--glass-border);border-radius:18px;padding:16px 24px;text-align:center}' +
'.stat-value{font-size:22px;font-weight:700;color:var(--purple2)}' +
'.stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px}' +
'.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--glass-border)}' +
'.icon-circle{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}' +
'.icon-red{background:rgba(239,68,68,0.15)}' +
'.icon-green{background:rgba(16,185,129,0.15)}' +
'.icon-yellow{background:rgba(234,179,8,0.15)}' +
'.section-title{font-size:18px;font-weight:700}' +
'.section-subtitle{font-size:11px;color:var(--text3);margin-top:2px}' +
'.fake-card{background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:18px;padding:18px;margin-bottom:12px}' +
'.fake-card-body{display:flex;gap:14px;align-items:flex-start}' +
'.fake-card-img{width:60px;height:60px;border-radius:14px;object-fit:cover;border:2px solid rgba(239,68,68,0.3);flex-shrink:0}' +
'.fake-card-placeholder{width:60px;height:60px;border-radius:14px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}' +
'.official-card{background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:18px;padding:16px 18px;margin-bottom:10px;display:flex;align-items:center;gap:14px}' +
'.warning-image-container{text-align:center;padding:20px;background:rgba(234,179,8,0.05);border:1px solid rgba(234,179,8,0.2);border-radius:18px;margin-bottom:20px}' +
'.warning-image-container img{max-width:100%;border-radius:16px;box-shadow:var(--glow-yellow)}' +
'.music-player{background:linear-gradient(180deg,#1a1040,#0a0a1a);border-radius:32px;padding:28px;color:#fff;margin:20px 0;border:1px solid rgba(139,92,246,0.2)}' +
'.music-header{display:flex;align-items:center;gap:10px;margin-bottom:20px}' +
'.music-header-icon{width:28px;height:28px;animation:micBounce 1.5s ease-in-out infinite}' +
'@keyframes micBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}' +
'.album-art{width:80px;height:80px;border-radius:20px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;border:2px solid rgba(255,255,255,0.1);overflow:hidden}' +
'.album-art img{width:100%;height:100%;object-fit:cover}' +
'.play-btn{width:56px;height:56px;border-radius:50%;background:#1db954;border:none;color:#000;font-size:22px;cursor:pointer;flex-shrink:0}' +
'.progress-wrap{display:flex;align-items:center;gap:10px}' +
'.progress-bar{flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;cursor:pointer}' +
'.progress-fill{height:100%;background:linear-gradient(90deg,#1db954,#1ed760);border-radius:2px;width:0%}' +
'.song-list{max-height:220px;overflow-y:auto;margin-top:18px}' +
'.song-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;cursor:pointer}' +
'.song-item:hover{background:rgba(255,255,255,0.04)}' +
'.song-item.active{background:rgba(29,185,84,0.15);border:1px solid rgba(29,185,84,0.3)}' +
'.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}' +
'.gallery-item{border-radius:18px;overflow:hidden;border:1px solid var(--glass-border)}' +
'.gallery-item img{width:100%;height:130px;object-fit:cover}' +
'.toast{position:fixed;top:20px;right:20px;z-index:99999;background:var(--surface2);border:1px solid var(--glass-border);padding:14px 20px;border-radius:14px;color:var(--text);font-size:13px;transform:translateX(120%);transition:transform 0.4s;box-shadow:0 10px 40px rgba(0,0,0,0.5)}' +
'.toast.show{transform:translateX(0)}' +
'.toast.error{border-left:3px solid var(--red)}' +
'.toast.success{border-left:3px solid var(--green)}' +
'.chat-widget{position:fixed;bottom:24px;right:24px;z-index:9999}' +
'.chat-btn{width:auto;height:56px;border-radius:50px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;cursor:pointer;box-shadow:0 10px 40px rgba(139,92,246,0.4);display:flex;align-items:center;gap:10px;padding:0 20px;transition:all 0.3s;color:#fff;font-weight:600;font-size:14px;white-space:nowrap}' +
'.chat-btn:hover{transform:scale(1.05);box-shadow:0 15px 50px rgba(236,72,153,0.5)}' +
'.chat-btn img{width:34px;height:34px;border-radius:50%;flex-shrink:0}' +
'.chat-window{position:fixed;bottom:100px;right:24px;width:380px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 150px);background:var(--surface);border:1px solid var(--glass-border);border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6);display:none;flex-direction:column;z-index:99999}' +
'.chat-window.open{display:flex}' +
'.chat-header-w{background:linear-gradient(135deg,#1a1040,#2d1b69);padding:16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--glass-border)}' +
'.chat-header-avatar-w{width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid var(--purple);flex-shrink:0;position:relative}' +
'.chat-header-avatar-w img{width:100%;height:100%;object-fit:cover}' +
'.chat-online{width:10px;height:10px;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #2d1b69}' +
'.chat-online.on{background:#10b981}' +
'.chat-online.off{background:#64748b}' +
'.chat-messages-w{flex:1;overflow-y:auto;padding:16px;background:var(--bg)}' +
'.msg-w{max-width:80%;padding:10px 15px;margin-bottom:6px;border-radius:20px;font-size:13px;line-height:1.5;animation:msgPop 0.3s ease}' +
'@keyframes msgPop{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}' +
'.msg-out-w{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;margin-left:auto;border-bottom-right-radius:6px}' +
'.msg-in-w{background:var(--surface2);color:var(--text);margin-right:auto;border-bottom-left-radius:6px;border:1px solid var(--glass-border)}' +
'.chat-login-w{flex:1;display:flex;flex-direction:column;justify-content:center;padding:30px;text-align:center}' +
'.chat-login-w input{width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--glass-border);border-radius:12px;color:var(--text);font-size:13px;margin-bottom:8px;outline:none}' +
'.chat-login-w input:focus{border-color:var(--purple)}' +
'.chat-login-w button{width:100%;padding:13px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;border-radius:12px;color:#fff;font-weight:600;cursor:pointer}' +
'.chat-input-area-w{padding:12px 14px;background:var(--surface);border-top:1px solid var(--glass-border);display:flex;gap:8px}' +
'.chat-input-area-w input{flex:1;padding:10px 16px;background:var(--surface2);border:1px solid var(--glass-border);border-radius:25px;color:var(--text);font-size:13px;outline:none}' +
'.chat-input-area-w input:focus{border-color:var(--purple)}' +
'.chat-send-btn-w{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
'@media(max-width:640px){.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:24px 24px 0 0;height:85vh;max-height:85vh}.chat-widget{bottom:16px;right:16px}.header-nav{display:none}}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="stars-bg" id="starsBg"></div>' +
'<div class="orb" style="width:300px;height:300px;background:rgba(139,92,246,0.4);top:10%;left:-100px;--dur:8s"></div>' +
'<div class="orb" style="width:250px;height:250px;background:rgba(236,72,153,0.3);top:50%;right:-80px;--dur:10s"></div>' +
'<div class="orb" style="width:200px;height:200px;background:rgba(59,130,246,0.3);bottom:10%;left:30%;--dur:12s"></div>' +
'<div id="toast" class="toast"></div>' +
'<header class="main-header"><div class="header-inner"><div class="header-logo"><img src="' + profilePic + '" alt="Logo"><span class="header-title">Verification Hub</span></div><nav class="header-nav"><a href="#fake" class="nav-red">⚠ Fakes</a>' + (coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : '') + '<a href="#warning" class="nav-purple">🔍 Detection</a><a href="#official" class="nav-green">✓ Official</a><a href="#gallery" class="nav-purple">📸 Gallery</a></nav></div></header>' +
'<main>' +
'<section class="profile-section"><div class="profile-pic-wrap"><img src="' + profilePic + '" class="profile-pic" alt="Profile"><div class="verified-badge-prof">✓</div></div><h1 class="profile-name">' + DATA.celebrity.fullName + '</h1><p class="profile-bio">' + DATA.celebrity.bio + '</p><div class="stats-row"><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokFollowers + '</div><div class="stat-label">Followers</div></div><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokFollowing + '</div><div class="stat-label">Following</div></div><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokLikes + '</div><div class="stat-label">Likes</div></div></div><div style="display:flex;gap:8px;justify-content:center"><span class="badge badge-green">✓ Verified</span><span class="badge badge-purple">Creator</span></div></section>' +
'<section id="fake" class="glass-card danger-card"><div class="section-header"><div class="icon-circle icon-red">⚠️</div><div><div class="section-title" style="color:#fca5a5">Fake Accounts Detected</div><div class="section-subtitle">Report these impersonating accounts</div></div><span class="badge badge-red" style="margin-left:auto">' + totalFake + ' Active</span></div>' + fakeCardsHTML + '<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button class="btn btn-red btn-sm" id="voicePlayBtn" onclick="toggleFakeVoice()">🔊 Play Alert</button><button class="btn btn-outline btn-sm" id="voiceStopBtn" onclick="stopFakeVoice()" style="display:none">⏹ Stop</button></div><audio id="fakeVoice" src="' + VOICE.fakeAlert + '" preload="auto"></audio></section>' +
musicSectionHTML +
'<section id="warning" class="warning-image-container"><img src="' + IMAGES.fakeDetect + '" alt="Fake Detection Warning"><div style="margin-top:16px"><span class="badge badge-yellow">🔍 Fake Account Detection Guide</span></div><p style="color:var(--text2);font-size:13px;margin-top:12px;line-height:1.6">Always check for the verified badge before interacting. Report suspicious accounts immediately.</p></section>' +
'<section id="official" class="glass-card success-card"><div class="section-header"><div class="icon-circle icon-green">✓</div><div><div class="section-title" style="color:#6ee7b7">Official Verified Accounts</div><div class="section-subtitle">Only follow these real accounts</div></div></div>' + officialCardsHTML + '</section>' +
'<section id="gallery" class="glass-card"><div class="section-header"><span style="font-size:22px">📸</span><div><div class="section-title">Photo Gallery</div><div class="section-subtitle">Official moments</div></div></div><div class="gallery-grid">' + galleryHTML + '</div></section>' +
'</main>' +
'<div class="chat-widget"><button class="chat-btn" onclick="window.open(\'/chat\',\'_blank\')"><img src="' + IMAGES.messageIcon + '" alt="Chat"><span>💬 Chat Now</span></button></div>' +
'<script>(function(){var c=document.getElementById("starsBg");for(var i=0;i<80;i++){var s=document.createElement("div");s.className="star";s.style.cssText="left:"+Math.random()*100+"%;top:"+Math.random()*100+"%;width:"+(Math.random()*3+1)+"px;height:"+(Math.random()*3+1)+"px;--dur:"+(Math.random()*3+2)+"s;--delay:"+(Math.random()*5)+"s";c.appendChild(s)}})();function showToast(m,t){var e=document.getElementById("toast");e.textContent=m;e.className="toast show "+(t||"");setTimeout(function(){e.classList.remove("show")},2800)}function copyTxt(t){navigator.clipboard.writeText(t).then(function(){showToast("Copied!","success")})}var fvp=false,fa=document.getElementById("fakeVoice");function toggleFakeVoice(){var b=document.getElementById("voicePlayBtn"),s=document.getElementById("voiceStopBtn");if(fvp){fa.pause();fa.currentTime=0;fvp=false;b.textContent="🔊 Play Alert";b.style.display="";s.style.display="none"}else{fa.play().then(function(){fvp=true;b.textContent="🔊 Playing...";s.style.display=""}).catch(function(){showToast("Error","error")})}}function stopFakeVoice(){fa.pause();fa.currentTime=0;fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"}fa.addEventListener("ended",function(){fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"});var ca=null,ip=false;function playSong(u,t,a,c,i){var ad=document.getElementById("coverAudio"),pb=document.getElementById("playBtn"),ar=document.getElementById("albumArt");if(ca===u){togglePlay();return}if(ca){ad.pause()}ca=u;ad.src=u;document.getElementById("currentTitle").textContent=t||"Unknown";document.getElementById("currentArtist").textContent=a||"Unknown";ar.innerHTML=c?\'<img src="\'+c+\'" style="width:100%;height:100%;object-fit:cover">\':"<span>🎵</span>";document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";document.getElementById("totalTime").textContent="0:00";document.querySelectorAll(".song-item").forEach(function(e){e.classList.remove("active")});var se=document.getElementById("song-"+i);if(se)se.classList.add("active");ad.play().then(function(){ip=true;pb.textContent="⏸️";ar.classList.add("playing")}).catch(function(){showToast("Error","error")});ad.ontimeupdate=function(){if(ad.duration){document.getElementById("progressFill").style.width=(ad.currentTime/ad.duration)*100+"%";document.getElementById("currentTime").textContent=ft(ad.currentTime)}};ad.onloadedmetadata=function(){document.getElementById("totalTime").textContent=ft(ad.duration)};ad.onended=function(){ip=false;pb.textContent="▶️";ar.classList.remove("playing");document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";ca=null}}function togglePlay(){var a=document.getElementById("coverAudio"),b=document.getElementById("playBtn"),r=document.getElementById("albumArt");if(!a.src||a.src===window.location.href){showToast("Select a song","error");return}if(ip){a.pause();ip=false;b.textContent="▶️";r.classList.remove("playing")}else{a.play().then(function(){ip=true;b.textContent="⏸️";r.classList.add("playing")}).catch(function(){showToast("Error","error")})}}function seekAudio(e){var a=document.getElementById("coverAudio");if(!a.duration)return;a.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*a.duration}function ft(s){if(isNaN(s))return"0:00";return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")}setTimeout(function(){var v=document.getElementById("welcomeVoice");if(v&&!sessionStorage.getItem("vp")){v.play().catch(function(){});sessionStorage.setItem("vp","1")}},2000);</script>' +
'<audio id="welcomeVoice" src="' + VOICE.welcome + '" preload="none"></audio>' +
'</body></html>';
}

function getChatPageHTML() {
    return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
'<meta name="theme-color" content="#0a0a14">' +
'<title>Chat - Baiilla Maach</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
'<style>' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Plus Jakarta Sans",sans-serif;background:#0a0a14;color:#fff;height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden}' +
'.chat-header{background:#13132b;padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;z-index:10}' +
'.chat-header-back{color:#a78bfa;text-decoration:none;font-size:22px;padding:6px;display:flex;align-items:center}' +
'.chat-header-avatar{width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid #8b5cf6;flex-shrink:0}' +
'.chat-header-avatar img{width:100%;height:100%;object-fit:cover}' +
'.chat-header-info{flex:1;min-width:0}' +
'.chat-header-name{font-weight:600;font-size:15px;display:flex;align-items:center;gap:6px}' +
'.chat-header-status{font-size:11px;color:#a0a0cc}' +
'.online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:4px;animation:pulse 2s infinite}' +
'@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}' +
'.chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:#0a0a14}' +
'.msg-row{display:flex;align-items:flex-end;gap:8px;max-width:85%}' +
'.msg-row.in{align-self:flex-start}' +
'.msg-row.out{align-self:flex-end;flex-direction:row-reverse}' +
'.msg-avatar{width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0}' +
'.msg-avatar img{width:100%;height:100%;object-fit:cover}' +
'.msg-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4;position:relative;word-wrap:break-word;max-width:100%}' +
'.msg-row.in .msg-bubble{background:#1a1a35;border-bottom-left-radius:4px}' +
'.msg-row.out .msg-bubble{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px}' +
'.msg-time{font-size:10px;opacity:0.5;margin-top:4px}' +
'.msg-image{max-width:250px;max-height:250px;border-radius:12px;cursor:pointer;display:block}' +
'.msg-voice{display:flex;align-items:center;gap:10px;padding:8px 14px;min-width:150px}' +
'.voice-play-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
'.voice-wave{flex:1;height:24px;display:flex;align-items:center;gap:2px}' +
'.voice-bar{width:3px;background:#8b5cf6;border-radius:2px;animation:voiceAnim 1s ease-in-out infinite}' +
'.voice-bar:nth-child(1){height:8px;animation-delay:0s}' +
'.voice-bar:nth-child(2){height:16px;animation-delay:0.1s}' +
'.voice-bar:nth-child(3){height:12px;animation-delay:0.2s}' +
'.voice-bar:nth-child(4){height:20px;animation-delay:0.3s}' +
'.voice-bar:nth-child(5){height:10px;animation-delay:0.4s}' +
'.voice-bar:nth-child(6){height:18px;animation-delay:0.5s}' +
'.voice-bar:nth-child(7){height:14px;animation-delay:0.6s}' +
'.voice-bar:nth-child(8){height:8px;animation-delay:0.7s}' +
'.voice-bar:nth-child(9){height:16px;animation-delay:0.8s}' +
'.voice-bar:nth-child(10){height:12px;animation-delay:0.9s}' +
'.voice-bar:nth-child(11){height:20px;animation-delay:1s}' +
'.voice-bar:nth-child(12){height:10px;animation-delay:1.1s}' +
'@keyframes voiceAnim{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.3)}}' +
'.voice-duration{font-size:11px;opacity:0.6;margin-left:8px;flex-shrink:0}' +
'.chat-input-area{background:#13132b;padding:10px 16px;display:flex;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;padding-bottom:max(10px,env(safe-area-inset-bottom))}' +
'.chat-input{flex:1;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:25px;padding:12px 16px;color:#fff;font-size:14px;outline:none;font-family:inherit}' +
'.chat-input:focus{border-color:#8b5cf6}' +
'.chat-attach-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
'.chat-mic-btn{width:40px;height:40px;border-radius:50%;background:#8b5cf6;border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.3s}' +
'.chat-mic-btn.recording{background:#ef4444;animation:micPulse 1s infinite}' +
'@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 15px rgba(239,68,68,0)}}' +
'.chat-send-btn{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
'.recording-timer{font-size:13px;color:#ef4444;font-weight:600;min-width:40px;text-align:center}' +
'.image-preview{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
'.image-preview img{max-width:95%;max-height:95%;border-radius:12px}' +
'.login-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center}' +
'.login-avatar{width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid #8b5cf6;margin-bottom:20px}' +
'.login-avatar img{width:100%;height:100%;object-fit:cover}' +
'.login-title{font-size:22px;font-weight:700;margin-bottom:8px}' +
'.login-subtitle{font-size:13px;color:#a0a0cc;margin-bottom:30px}' +
'.login-input{width:100%;max-width:320px;padding:14px 16px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:14px;color:#fff;font-size:14px;margin-bottom:10px;outline:none;font-family:inherit}' +
'.login-input:focus{border-color:#8b5cf6}' +
'.login-btn{width:100%;max-width:320px;padding:14px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;border-radius:14px;color:#fff;font-weight:600;font-size:15px;cursor:pointer;margin-top:10px}' +
'.login-error{color:#ef4444;font-size:12px;margin-top:8px;display:none}' +
'@media(max-width:480px){.msg-row{max-width:90%}.msg-image{max-width:200px;max-height:200px}}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="chat-header">' +
'<a href="/" class="chat-header-back">←</a>' +
'<div class="chat-header-avatar"><img src="' + IMAGES.profile + '" alt="Avatar"></div>' +
'<div class="chat-header-info">' +
'<div class="chat-header-name">Hammad Bin Amir <span style="font-size:10px;color:#10b981">✓</span></div>' +
'<div class="chat-header-status"><span class="online-dot"></span>Online now</div>' +
'</div>' +
'</div>' +
'<div id="loginScreen" class="login-screen">' +
'<div class="login-avatar"><img src="' + IMAGES.profile + '" alt="Avatar"></div>' +
'<div class="login-title">Chat with us</div>' +
'<div class="login-subtitle">Enter your details to start conversation</div>' +
'<input type="text" id="loginName" class="login-input" placeholder="Your Name">' +
'<input type="text" id="loginContact" class="login-input" placeholder="Email or Phone">' +
'<button class="login-btn" onclick="registerAndStart()">Start Chat</button>' +
'<div id="loginError" class="login-error">Please fill all fields</div>' +
'</div>' +
'<div id="chatMessages" class="chat-messages" style="display:none"></div>' +
'<div id="chatInputArea" class="chat-input-area" style="display:none">' +
'<input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFileUpload(event)">' +
'<button class="chat-attach-btn" onclick="document.getElementById(\'fileInput\').click()">📎</button>' +
'<input type="text" id="msgInput" class="chat-input" placeholder="Type a message..." onkeypress="if(event.key===\'Enter\')sendTextMessage()">' +
'<button id="micBtn" class="chat-mic-btn" onclick="toggleRecording()" title="Hold to record">🎤</button>' +
'<button class="chat-send-btn" onclick="sendTextMessage()">➤</button>' +
'<span id="recordingTimer" class="recording-timer" style="display:none">0:00</span>' +
'</div>' +
'<audio id="voicePlayer" style="display:none"></audio>' +
'<div id="imagePreview" class="image-preview" style="display:none" onclick="this.style.display=\'none\'"><img id="previewImg" src="" alt="Preview"></div>' +
'<script>' +
'var profilePic = "' + IMAGES.profile + '";' +
'var chatToken = localStorage.getItem("chatToken");' +
'var chatId = localStorage.getItem("chatId");' +
'var userName = localStorage.getItem("chatName");' +
'var userContact = localStorage.getItem("chatContact");' +
'var mediaRecorder = null;' +
'var audioChunks = [];' +
'var recordingStartTime = 0;' +
'var recordingTimerInterval = null;' +
'var pollInterval = null;' +
'' +
'if (chatToken && chatId) {' +
'    verifyAndLoad();' +
'}' +
'' +
'function registerAndStart() {' +
'    var name = document.getElementById("loginName").value.trim();' +
'    var contact = document.getElementById("loginContact").value.trim();' +
'    var errEl = document.getElementById("loginError");' +
'    if (!name || !contact) {' +
'        errEl.style.display = "block";' +
'        return;' +
'    }' +
'    errEl.style.display = "none";' +
'    fetch("/api/chat/register", {' +
'        method: "POST",' +
'        headers: {"Content-Type": "application/json"},' +
'        body: JSON.stringify({name: name, phoneEmail: contact})' +
'    }).then(function(r) { return r.json() }).then(function(d) {' +
'        if (d.success) {' +
'            chatToken = d.token;' +
'            chatId = d.chatId;' +
'            userName = name;' +
'            userContact = contact;' +
'            localStorage.setItem("chatToken", chatToken);' +
'            localStorage.setItem("chatId", chatId);' +
'            localStorage.setItem("chatName", userName);' +
'            localStorage.setItem("chatContact", userContact);' +
'            showChat();' +
'            loadMessages();' +
'            startPolling();' +
'        } else {' +
'            errEl.textContent = d.error || "Registration failed";' +
'            errEl.style.display = "block";' +
'        }' +
'    }).catch(function() {' +
'        errEl.textContent = "Connection error";' +
'        errEl.style.display = "block";' +
'    });' +
'}' +
'' +
'function verifyAndLoad() {' +
'    fetch("/api/chat/verify?token=" + encodeURIComponent(chatToken)).then(function(r) { return r.json() }).then(function(d) {' +
'        if (d.success) {' +
'            showChat();' +
'            loadMessages();' +
'            startPolling();' +
'        } else {' +
'            localStorage.clear();' +
'            chatToken = null;' +
'            chatId = null;' +
'        }' +
'    });' +
'}' +
'' +
'function showChat() {' +
'    document.getElementById("loginScreen").style.display = "none";' +
'    document.getElementById("chatMessages").style.display = "flex";' +
'    document.getElementById("chatInputArea").style.display = "flex";' +
'}' +
'' +
'function loadMessages() {' +
'    if (!chatToken) return;' +
'    fetch("/api/chat/messages?token=" + encodeURIComponent(chatToken) + "&t=" + Date.now()).then(function(r) { return r.json() }).then(function(d) {' +
'        if (d.success) {' +
'            renderMessages(d.messages);' +
'        }' +
'    });' +
'}' +
'' +
'function renderMessages(msgs) {' +
'    var container = document.getElementById("chatMessages");' +
'    container.innerHTML = "";' +
'    (msgs || []).forEach(function(m) {' +
'        var isUser = m.sender === "user";' +
'        var row = document.createElement("div");' +
'        row.className = "msg-row " + (isUser ? "out" : "in");' +
'        var bubble = document.createElement("div");' +
'        bubble.className = "msg-bubble";' +
'        ' +
'        if (m.type === "image" && m.fileUrl) {' +
'            var img = document.createElement("img");' +
'            img.src = m.fileUrl;' +
'            img.className = "msg-image";' +
'            img.onclick = function() { showImagePreview(m.fileUrl); };' +
'            bubble.appendChild(img);' +
'        } else if (m.type === "voice" && m.fileUrl) {' +
'            bubble.className += " msg-voice";' +
'            var playBtn = document.createElement("button");' +
'            playBtn.className = "voice-play-btn";' +
'            playBtn.textContent = "▶";' +
'            playBtn.onclick = function() { playVoice(m.fileUrl, playBtn); };' +
'            bubble.appendChild(playBtn);' +
'            var wave = document.createElement("div");' +
'            wave.className = "voice-wave";' +
'            for (var i = 0; i < 12; i++) {' +
'                var bar = document.createElement("div");' +
'                bar.className = "voice-bar";' +
'                wave.appendChild(bar);' +
'            }' +
'            bubble.appendChild(wave);' +
'            if (m.duration) {' +
'                var dur = document.createElement("span");' +
'                dur.className = "voice-duration";' +
'                dur.textContent = formatTime(m.duration);' +
'                bubble.appendChild(dur);' +
'            }' +
'        } else {' +
'            bubble.textContent = m.message;' +
'        }' +
'        ' +
'        var time = document.createElement("div");' +
'        time.className = "msg-time";' +
'        time.textContent = new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});' +
'        bubble.appendChild(time);' +
'        row.appendChild(bubble);' +
'        container.appendChild(row);' +
'    });' +
'    container.scrollTop = container.scrollHeight;' +
'}' +
'' +
'function sendTextMessage() {' +
'    var input = document.getElementById("msgInput");' +
'    var msg = input.value.trim();' +
'    if (!msg || !chatToken) return;' +
'    input.value = "";' +
'    fetch("/api/chat/send", {' +
'        method: "POST",' +
'        headers: {"Content-Type": "application/json"},' +
'        body: JSON.stringify({token: chatToken, message: msg, type: "text"})' +
'    }).then(function(r) { return r.json() }).then(function(d) {' +
'        if (d.success) loadMessages();' +
'    });' +
'}' +
'' +
'function handleFileUpload(event) {' +
'    var file = event.target.files[0];' +
'    if (!file || !chatToken) return;' +
'    var formData = new FormData();' +
'    formData.append("photo", file);' +
'    fetch("/api/chat/upload?token=" + encodeURIComponent(chatToken), {' +
'        method: "POST",' +
'        body: formData' +
'    }).then(function(r) { return r.json() }).then(function(d) {' +
'        if (d.success) {' +
'            fetch("/api/chat/send", {' +
'                method: "POST",' +
'                headers: {"Content-Type": "application/json"},' +
'                body: JSON.stringify({token: chatToken, message: "📷 Photo", type: "image", fileUrl: d.fileUrl})' +
'            }).then(function(r) { return r.json() }).then(function(d2) {' +
'                if (d2.success) loadMessages();' +
'            });' +
'        }' +
'    });' +
'    event.target.value = "";' +
'}' +
'' +
'function toggleRecording() {' +
'    if (mediaRecorder && mediaRecorder.state === "recording") {' +
'        stopRecording();' +
'    } else {' +
'        startRecording();' +
'    }' +
'}' +
'' +
'function startRecording() {' +
'    navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {' +
'        audioChunks = [];' +
'        mediaRecorder = new MediaRecorder(stream);' +
'        mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };' +
'        mediaRecorder.onstop = function() {' +
'            var audioBlob = new Blob(audioChunks, {type: "audio/webm"});' +
'            uploadVoice(audioBlob);' +
'        };' +
'        mediaRecorder.start();' +
'        recordingStartTime = Date.now();' +
'        document.getElementById("micBtn").classList.add("recording");' +
'        document.getElementById("micBtn").textContent = "⏹";' +
'        document.getElementById("recordingTimer").style.display = "inline";' +
'        recordingTimerInterval = setInterval(function() {' +
'            var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);' +
'            document.getElementById("recordingTimer").textContent = formatTime(elapsed);' +
'        }, 500);' +
'    }).catch(function() {' +
'        alert("Microphone access denied");' +
'    });' +
'}' +
'' +
'function stopRecording() {' +
'    if (mediaRecorder && mediaRecorder.state === "recording") {' +
'        mediaRecorder.stop();' +
'        mediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });' +
'        clearInterval(recordingTimerInterval);' +
'        document.getElementById("micBtn").classList.remove("recording");' +
'        document.getElementById("micBtn").textContent = "🎤";' +
'        document.getElementById("recordingTimer").style.display = "none";' +
'        var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);' +
'        window._lastVoiceDuration = elapsed;' +
'    }' +
'}' +
'' +
'function uploadVoice(blob) {' +
'    if (!chatToken) return;' +
'    var formData = new FormData();' +
'    formData.append("voice", blob, "voice.webm");' +
'    fetch("/api/chat/upload-voice?token=" + encodeURIComponent(chatToken), {' +
'        method: "POST",' +
'        body: formData' +
'    }).then(function(r) { return r.json() }).then(function(d) {' +
'        if (d.success) {' +
'            fetch("/api/chat/send", {' +
'                method: "POST",' +
'                headers: {"Content-Type": "application/json"},' +
'                body: JSON.stringify({token: chatToken, message: "🎤 Voice", type: "voice", fileUrl: d.fileUrl, duration: window._lastVoiceDuration || 0})' +
'            }).then(function(r) { return r.json() }).then(function(d2) {' +
'                if (d2.success) loadMessages();' +
'            });' +
'        }' +
'    });' +
'}' +
'' +
'function playVoice(url, btn) {' +
'    var player = document.getElementById("voicePlayer");' +
'    if (player.src === url && !player.paused) {' +
'        player.pause();' +
'        btn.textContent = "▶";' +
'        return;' +
'    }' +
'    player.src = url;' +
'    player.play();' +
'    btn.textContent = "⏸";' +
'    player.onended = function() { btn.textContent = "▶"; };' +
'    player.onpause = function() { btn.textContent = "▶"; };' +
'}' +
'' +
'function showImagePreview(url) {' +
'    document.getElementById("previewImg").src = url;' +
'    document.getElementById("imagePreview").style.display = "flex";' +
'}' +
'' +
'function formatTime(seconds) {' +
'    var m = Math.floor(seconds / 60);' +
'    var s = Math.floor(seconds % 60);' +
'    return m + ":" + String(s).padStart(2, "0");' +
'}' +
'' +
'function startPolling() {' +
'    if (pollInterval) clearInterval(pollInterval);' +
'    pollInterval = setInterval(loadMessages, 2000);' +
'}' +
'</script>' +
'</body></html>';
}

function getAdminLoginHTML(e) {
    e = e || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6">Admin Login</h2>' + (e ? '<div class="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">' + e + '</div>' : '') + '<form method="POST" action="/admin/login"><input name="username" placeholder="Username" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3" required><input type="password" name="password" placeholder="Password" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-4" required><button class="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-500">Back</a></div></body></html>';
}

async function getAdminPanelHTML(p, m, e) {
    p = p || [];
    m = m || '';
    e = e || '';
    const cl = await getAdminChatList();
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 min-h-screen text-white"><header class="bg-gray-900 p-4 border-b border-gray-800"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-purple-400">Admin Panel</h1><div class="flex gap-3"><a href="/admin/chat" class="px-4 py-2 bg-purple-600 rounded-lg text-sm">Chats (' + cl.reduce((s,c) => s + c.unread, 0) + ')</a><a href="/" class="px-4 py-2 bg-gray-800 rounded-lg text-sm">Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Logout</a></div></div></header><div class="max-w-6xl mx-auto p-4">' + (m ? '<div class="bg-green-500/10 text-green-400 p-4 rounded-xl mb-4">' + m + '</div>' : '') + (e ? '<div class="bg-red-500/10 text-red-400 p-4 rounded-xl mb-4">' + e + '</div>' : '') + '<div class="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6"><h2 class="font-bold mb-4">Upload Photo</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" class="mb-3 text-white" required><input name="caption" placeholder="Caption" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3"><button class="w-full py-3 bg-purple-600 text-white rounded-lg">Upload</button></form></div><h2 class="text-xl font-bold mb-4">Gallery (' + p.length + ')</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">' + p.map(x => '<div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-800"><img src="' + x.path + '" class="w-full h-40 object-cover"><div class="p-3"><p class="text-sm text-gray-400">' + (x.caption || '') + '</p><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="' + x._id + '"><button class="text-red-400 text-sm mt-2">Delete</button></form></div></div>').join('') + (p.length === 0 ? '<p class="text-gray-500 col-span-4 text-center py-12">No photos</p>' : '') + '</div></div></body></html>';
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
                if (!name || !phoneEmail) { 
                    res.writeHead(400, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false, error: 'Name and contact required' })); 
                    return; 
                }
                const u = createOrGetChatUser(name, phoneEmail);
                if (!u) { 
                    res.writeHead(500, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false, error: 'Failed to create user' })); 
                    return; 
                }
                const t = createChatSession(u.chatId);
                const existingMessages = getChatMessages(u.chatId);
                if (existingMessages.length === 0) {
                    saveChatMessage(u.chatId, 'admin', 'Hello! How can I help you? 👋');
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: u.chatId, token: t, name, phoneEmail }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' }); 
                res.end(JSON.stringify({ success: false, error: e.message })); 
            }
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
        if (s) {
            adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(await getGalleryPhotos()));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getAdminLoginHTML()); return;
    }
    
    if (pn === '/admin/login' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            if (await verifyAdmin(p.get('username'), p.get('password'))) {
                const s = createSession(p.get('username'));
                adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=' + s + ';HttpOnly;Path=/;Max-Age=7200' }); res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(getAdminLoginHTML('Invalid credentials'));
            }
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
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chat</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;display:flex;height:100vh;font-family:sans-serif;background:#0a0a14;color:#fff}.sidebar{width:350px;background:#13132b;border-right:1px solid rgba(255,255,255,0.06);overflow-y:auto}.main{flex:1;display:flex;flex-direction:column}.messages{flex:1;overflow-y:auto;padding:20px;background:#0a0a14}.msg-b{margin-bottom:10px}.msg-b .bub{display:inline-block;max-width:70%;padding:10px 14px;border-radius:16px;font-size:13px}.msg-b.user{text-align:left}.msg-b.user .bub{background:#1a1a35}.msg-b.admin{text-align:right}.msg-b.admin .bub{background:#8b5cf6}.msg-b .time{font-size:10px;opacity:0.5;margin-top:4px}</style></head><body><div class="sidebar"><div style="padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);font-weight:600">💬 Chats <a href="/admin" style="color:#fff;float:right;font-size:12px">Back</a></div>' + cl.map(c => '<div onclick="location.href=\'/admin/chat?chatId=' + c.chatId + '\'" style="padding:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);' + (c.chatId === cid ? 'background:rgba(139,92,246,0.2)' : '') + '"><div style="font-weight:600">' + c.name + '</div><div style="font-size:12px;opacity:0.6">' + c.phoneEmail + '</div>' + (c.unread > 0 ? '<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px">' + c.unread + '</span>' : '') + '</div>').join('') + '</div><div class="main">' + (cid ? '<div style="padding:14px;background:#13132b;font-weight:600">' + (cl.find(c => c.chatId === cid) ? cl.find(c => c.chatId === cid).name : '') + '</div><div class="messages" id="mc">' + ms.map(m => '<div class="msg-b ' + m.sender + '"><div class="bub">' + m.message + '<div class="time">' + new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) + '</div></div></div>').join('') + '</div><div style="padding:14px;background:#13132b;display:flex;gap:10px"><input id="am" placeholder="Reply..." style="flex:1;padding:10px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:#fff;outline:none" onkeypress="if(event.key===\'Enter\')sm()"><button onclick="sm()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer">Send</button></div><script>var cid="' + cid + '";function lm(){fetch("/api/admin/messages?chatId="+cid).then(r=>r.json()).then(d=>{if(d.success){document.getElementById("mc").innerHTML=d.messages.map(m=>\'<div class="msg-b \'+m.sender+\'"><div class="bub">\'+m.message+\'<div class="time">\'+new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+\'</div></div></div>\').join("")}})}function sm(){var i=document.getElementById("am");fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:i.value})}).then(()=>{i.value="";lm()})}setInterval(lm,2000)</script>' : '<div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.5">Select a chat</div>') + '</div></body></html>'); return;
    }
    
    if (pn === '/api/admin/messages' && m === 'GET') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        markMessagesRead(pu.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, messages: getChatMessages(pu.query.chatId) })); return;
    }
    
    if (pn === '/api/admin/send' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { chatId, message } = JSON.parse(b);
            saveChatMessage(chatId, 'admin', message);
            adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
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
    
    server.listen(PORT, function() {
        console.log('Server running at http://localhost:' + PORT);
        console.log('Chat page: http://localhost:' + PORT + '/chat');
        console.log('Admin: http://localhost:' + PORT + '/admin');
    });
}

start().catch(console.error);

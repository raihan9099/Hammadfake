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

// Create directories
[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Image assets
const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/orginalss.png",
    realIdSS: "/assets/real-id-ss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect.png",
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

// Admin presence tracking
const adminPresence = { isOnline: false, lastSeen: null };

// In-memory stores
const memoryStore = {
    users: new Map(),
    sessions: new Map(),
    messages: new Map()
};

// Helper function to get cover songs
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
                audioUrl: '/assets/covermusic/' + encodeURIComponent(v.audio),
                coverUrl: v.cover ? '/assets/covermusic/' + encodeURIComponent(v.cover) : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) {
        return [];
    }
}

// MongoDB connection
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
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                createdAt: new Date()
            });
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

// Database operations
async function getGalleryPhotos() {
    if (!db || !dbConnected) return [];
    try {
        return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray();
    } catch (e) {
        return [];
    }
}

async function savePhoto(d) {
    if (!db || !dbConnected) return null;
    try {
        return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() });
    } catch(e) {
        return null;
    }
}

async function deletePhoto(id) {
    if (!db || !dbConnected) return null;
    try {
        return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
    } catch(e) {
        return null;
    }
}

async function verifyAdmin(u, p) {
    if (!db || !dbConnected) return u === 'admin' && p === 'admin123';
    try {
        const a = await db.collection('admin_users').findOne({ username: u });
        if (!a) return false;
        return await bcrypt.compare(p, a.password);
    } catch(e) {
        return u === 'admin' && p === 'admin123';
    }
}

// Chat functions
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
    user = {
        chatId,
        name,
        phoneEmail: clean,
        createdAt: new Date(),
        lastSeen: new Date(),
        status: 'active'
    };
    memoryStore.users.set(clean, user);
    return user;
}

function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    memoryStore.sessions.set(token, {
        chatId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
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
        chatId,
        sender,
        message,
        type: type || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        duration: duration || null,
        createdAt: new Date(),
        read: false
    };
    
    if (!memoryStore.messages.has(chatId)) {
        memoryStore.messages.set(chatId, []);
    }
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
            list.push({
                chatId: user.chatId,
                name: user.name,
                phoneEmail: user.phoneEmail,
                lastSeen: user.lastSeen,
                lastMessage: lastMsg,
                unread
            });
        }
    }
    return list.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function markMessagesRead(chatId) {
    const msgs = memoryStore.messages.get(chatId) || [];
    msgs.forEach(m => {
        if (m.sender === 'user') m.read = true;
    });
}

// Data configuration
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
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            icon: IMAGES.tiktokIcon,
            screenshot: IMAGES.official,
            verified: true,
            followers: "5,000",
            verifiedIcon: IMAGES.blueTick
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            icon: IMAGES.facebookIcon,
            screenshot: IMAGES.realIdSS,
            verified: true,
            followers: "Growing",
            verifiedIcon: IMAGES.blueTick
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            icon: IMAGES.tiktokIcon,
            screenshot: IMAGES.danger,
            reason: "Copies official content and logo to deceive followers.",
            threatLevel: "Critical",
            reportedCount: 156
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            icon: IMAGES.tiktokIcon,
            screenshot: IMAGES.fraud,
            reason: "Uses official name and photo to mislead followers.",
            threatLevel: "High",
            reportedCount: 89
        }
    ]
};

// Session management
const sessions = new Map();

function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: u, createdAt: Date.now() });
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

function parseCookies(h) {
    const c = {};
    if (h) {
        h.split(';').forEach(x => {
            const p = x.split('=');
            c[p[0].trim()] = p[1] ? p[1].trim() : '';
        });
    }
    return c;
}

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

function formatMsgTime(d) {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMsgBubble(m) {
    const time = formatMsgTime(m.createdAt);
    let bubble = '';
    
    if (m.type === 'image' && m.fileUrl) {
        bubble = `<img src="${m.fileUrl}" style="max-width:250px;max-height:250px;border-radius:12px;cursor:pointer;display:block" onclick="showImg('${m.fileUrl}')">`;
    } else if (m.type === 'voice' && m.fileUrl) {
        bubble = `<div style="display:flex;align-items:center;gap:10px;padding:5px 0">
            <button onclick="playV('${m.fileUrl}',this)" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:14px;cursor:pointer;flex-shrink:0">▶</button>
            <div style="display:flex;align-items:center;gap:2px;flex:1;height:24px">`;
        for (let i = 0; i < 12; i++) {
            bubble += `<div style="width:3px;background:#8b5cf6;border-radius:2px;animation:voiceAnim 1s ease-in-out infinite;animation-delay:${i * 0.1}s;height:${8 + Math.floor(Math.random() * 14)}px"></div>`;
        }
        bubble += `</div>`;
        if (m.duration) {
            const mins = Math.floor(m.duration / 60);
            const secs = Math.floor(m.duration % 60);
            bubble += `<span style="font-size:11px;opacity:0.6">${mins}:${String(secs).padStart(2,'0')}</span>`;
        }
        bubble += `</div>`;
    } else {
        bubble = m.message;
    }
    
    bubble += `<div style="font-size:10px;opacity:0.5;margin-top:4px">${time}</div>`;
    return bubble;
}

// Generate main HTML page
function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;

    // Generate fake cards HTML
    let fakeCardsHTML = '';
    DATA.fakeAccounts.forEach(function(a) {
        fakeCardsHTML += `
        <div class="fake-card">
            <div class="fake-card-body">
                ${a.screenshot ? `<img src="${a.screenshot}" class="fake-card-img" alt="Fake">` : `<div class="fake-card-placeholder">⚠️</div>`}
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#fca5a5;font-size:14px;margin-bottom:4px">${a.username}</div>
                    <div style="font-size:11px;color:#f87171;margin-bottom:6px">⚠ ${a.reason}</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <a href="${a.profileUrl}" target="_blank" class="btn btn-red btn-sm">Report</a>
                        <button onclick="copyTxt('${a.username}')" class="btn btn-outline btn-sm">Copy</button>
                    </div>
                </div>
            </div>
        </div>`;
    });

    // Generate official cards HTML
    let officialCardsHTML = '';
    DATA.realAccounts.forEach(function(acc) {
        officialCardsHTML += `
        <div class="official-card">
            <img src="${acc.icon}" style="width:22px;height:22px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:5px">
                    <span style="font-weight:600;font-size:14px">${acc.username}</span>
                    <img src="${acc.verifiedIcon}" style="width:14px;height:14px">
                </div>
                <div style="font-size:10px;color:var(--text3);margin-top:2px">${acc.followers} followers</div>
            </div>
            <a href="${acc.url}" target="_blank" class="btn btn-green btn-sm">Follow</a>
        </div>`;
    });

    // Generate gallery HTML
    let galleryHTML = '';
    if (galleryPhotos.length === 0) {
        galleryHTML = '<p style="color:var(--text3);text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>';
    } else {
        galleryPhotos.forEach(function(p) {
            galleryHTML += `<div class="gallery-item"><img src="${p.path}" alt="Photo" loading="lazy"></div>`;
        });
    }

    // Generate music section HTML
    let musicSectionHTML = '';
    if (coverSongs.length > 0) {
        let songListHTML = '';
        coverSongs.forEach(function(s, i) {
            songListHTML += `
            <div class="song-item" id="song-${i}" onclick="playSong('${s.audioUrl}','${s.title}','${s.artist}','${s.coverUrl || ''}',${i})">
                <span style="opacity:0.4;font-size:12px;width:26px">${String(i+1).padStart(2,'0')}</span>
                <div style="flex:1">
                    <div style="font-weight:500;font-size:13px">${s.title}</div>
                    <div style="font-size:10px;opacity:0.4">${s.artist}</div>
                </div>
                <span style="font-size:12px;opacity:0.3">▶</span>
            </div>`;
        });

        musicSectionHTML = `
        <section id="music" class="music-player">
            <div class="music-header">
                <img src="${IMAGES.voiceMic}" class="music-header-icon" alt="Mic">
                <span style="font-weight:700;font-size:16px">Cover Music</span>
                <span style="font-size:11px;opacity:0.5;margin-left:auto">${coverSongs.length} tracks</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
                <div class="album-art" id="albumArt"><span>🎵</span></div>
                <div style="flex:1;min-width:0">
                    <div id="currentTitle" style="font-weight:600;font-size:15px">Select a Song</div>
                    <div id="currentArtist" style="font-size:11px;opacity:0.6;margin-top:4px">Cover Music</div>
                </div>
                <button class="play-btn" id="playBtn" onclick="togglePlay()">▶️</button>
            </div>
            <div class="progress-wrap">
                <span id="currentTime" style="font-size:10px;opacity:0.5;width:32px">0:00</span>
                <div class="progress-bar" onclick="seekAudio(event)">
                    <div class="progress-fill" id="progressFill">
                        <div class="progress-thumb"></div>
                    </div>
                </div>
                <span id="totalTime" style="font-size:10px;opacity:0.5;width:32px;text-align:right">0:00</span>
            </div>
            <div class="song-list">${songListHTML}</div>
            <audio id="coverAudio" preload="none"></audio>
        </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
    <meta name="theme-color" content="#0f0f1a">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Baiilla Maach | Verification Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <style>
        :root {
            --safe-top: env(safe-area-inset-top, 20px);
            --safe-bottom: env(safe-area-inset-bottom, 16px);
            --safe-left: env(safe-area-inset-left, 16px);
            --safe-right: env(safe-area-inset-right, 16px);
            --bg: #0a0a14;
            --surface: #13132b;
            --surface2: #1a1a35;
            --text: #f0f0ff;
            --text2: #a0a0cc;
            --text3: #6060a0;
            --purple: #8b5cf6;
            --purple2: #a78bfa;
            --pink: #ec4899;
            --green: #10b981;
            --red: #ef4444;
            --yellow: #eab308;
            --glass-border: rgba(255,255,255,0.06);
            --glow-purple: 0 0 40px rgba(139,92,246,0.3);
            --glow-green: 0 0 30px rgba(16,185,129,0.3);
            --glow-red: 0 0 30px rgba(239,68,68,0.3);
            --glow-yellow: 0 0 30px rgba(234,179,8,0.3);
            --radius-sm: 12px;
            --radius-md: 16px;
            --radius-lg: 24px;
            --radius-xl: 32px;
            --font-xs: 10px;
            --font-sm: 12px;
            --font-md: 14px;
            --font-lg: 16px;
            --font-xl: 20px;
            --font-2xl: 24px;
            --font-3xl: 32px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            min-height: -webkit-fill-available;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* Stars Background */
        .stars-bg {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 0;
            pointer-events: none;
            overflow: hidden;
        }

        .star {
            position: absolute;
            background: white;
            border-radius: 50%;
            animation: twinkle var(--dur) ease-in-out infinite;
            animation-delay: var(--delay);
            opacity: 0;
        }

        @keyframes twinkle {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.5); }
        }

        /* Floating Orbs */
        .orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.3;
            pointer-events: none;
            z-index: 0;
            animation: floatOrb var(--dur) ease-in-out infinite;
        }

        @keyframes floatOrb {
            0%, 100% { transform: translate(0,0) scale(1); }
            25% { transform: translate(30px,-40px) scale(1.1); }
            50% { transform: translate(-20px,-80px) scale(0.9); }
            75% { transform: translate(-40px,-20px) scale(1.05); }
        }

        /* Main Container */
        main {
            position: relative;
            z-index: 1;
            max-width: 860px;
            margin: 0 auto;
            padding: calc(var(--safe-top) + 16px) 16px calc(var(--safe-bottom) + 16px);
        }

        /* Glass Cards */
        .glass-card {
            background: var(--surface);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            padding: 24px;
            margin-bottom: 20px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }

        .glass-card:active {
            transform: scale(0.98);
        }

        .danger-card {
            border-left: 3px solid var(--red);
        }

        .success-card {
            border-left: 3px solid var(--green);
        }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: var(--font-sm);
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            min-height: 48px;
            min-width: 48px;
            position: relative;
            overflow: hidden;
            -webkit-user-select: none;
            user-select: none;
        }

        .btn:active {
            transform: scale(0.95);
        }

        .btn::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle, rgba(255,255,255,0.3) 10%, transparent 50%);
            opacity: 0;
            transition: opacity 0.3s;
        }

        .btn:active::after {
            opacity: 1;
        }

        .btn-purple {
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: #fff;
            box-shadow: var(--glow-purple);
        }

        .btn-red {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: #fff;
            box-shadow: var(--glow-red);
        }

        .btn-green {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            box-shadow: var(--glow-green);
        }

        .btn-outline {
            background: transparent;
            border: 1px solid var(--glass-border);
            color: var(--text2);
        }

        .btn-sm {
            padding: 8px 16px;
            font-size: var(--font-xs);
            min-height: 36px;
            min-width: 36px;
        }

        .btn-loading {
            pointer-events: none;
            opacity: 0.7;
        }

        .btn-loading::before {
            content: '';
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
            margin-right: 8px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .btn-disabled {
            pointer-events: none;
            opacity: 0.5;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 14px;
            border-radius: 50px;
            font-size: var(--font-xs);
            font-weight: 600;
            letter-spacing: 0.3px;
        }

        .badge-red {
            background: rgba(239,68,68,0.15);
            color: #fca5a5;
        }

        .badge-green {
            background: rgba(16,185,129,0.15);
            color: #6ee7b7;
        }

        .badge-purple {
            background: rgba(139,92,246,0.15);
            color: #c4b5fd;
        }

        .badge-yellow {
            background: rgba(234,179,8,0.15);
            color: #fde047;
        }

        /* Header */
        .main-header {
            background: rgba(10,10,20,0.85);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border-bottom: 1px solid var(--glass-border);
            padding: max(12px, var(--safe-top)) 0;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 860px;
            margin: 0 auto;
            padding: 0 16px;
        }

        .header-logo {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header-logo img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--purple);
            box-shadow: 0 0 20px rgba(139,92,246,0.3);
        }

        .header-title {
            font-weight: 700;
            font-size: var(--font-md);
            background: linear-gradient(135deg, #c4b5fd, #f9a8d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header-nav {
            display: flex;
            gap: 6px;
        }

        .header-nav a {
            padding: 8px 16px;
            border-radius: 50px;
            font-size: var(--font-xs);
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            min-height: 36px;
            display: flex;
            align-items: center;
        }

        .header-nav a:active {
            transform: scale(0.95);
        }

        .nav-red {
            color: #fca5a5;
            background: rgba(239,68,68,0.1);
        }

        .nav-green {
            color: #6ee7b7;
            background: rgba(16,185,129,0.1);
        }

        .nav-purple {
            color: #c4b5fd;
            background: rgba(139,92,246,0.1);
        }

        /* Profile Section */
        .profile-section {
            text-align: center;
            padding: 30px 0 20px;
        }

        .profile-pic-wrap {
            position: relative;
            display: inline-block;
            margin-bottom: 12px;
        }

        .profile-pic {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid var(--purple);
            box-shadow: var(--glow-purple);
            transition: all 0.3s;
        }

        .profile-pic:active {
            transform: scale(0.95);
        }

        .verified-badge-prof {
            position: absolute;
            bottom: 4px;
            right: 4px;
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 50%;
            border: 3px solid var(--bg);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: #fff;
            box-shadow: 0 4px 12px rgba(16,185,129,0.4);
        }

        .profile-name {
            font-size: var(--font-2xl);
            font-weight: 800;
            background: linear-gradient(135deg, #c4b5fd, #f9a8d4, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-top: 8px;
        }

        .profile-bio {
            color: var(--text2);
            font-size: var(--font-sm);
            margin-top: 6px;
            line-height: 1.5;
        }

        .stats-row {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin: 20px 0;
            flex-wrap: wrap;
        }

        .stat-card {
            background: var(--surface2);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: 16px 20px;
            text-align: center;
            min-width: 80px;
            transition: all 0.3s;
        }

        .stat-card:active {
            transform: scale(0.95);
            background: rgba(139,92,246,0.1);
        }

        .stat-value {
            font-size: var(--font-xl);
            font-weight: 700;
            color: var(--purple2);
        }

        .stat-label {
            font-size: var(--font-xs);
            color: var(--text3);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 4px;
        }

        /* Section Headers */
        .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--glass-border);
        }

        .icon-circle {
            width: 48px;
            height: 48px;
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
        }

        .icon-red {
            background: rgba(239,68,68,0.15);
        }

        .icon-green {
            background: rgba(16,185,129,0.15);
        }

        .icon-yellow {
            background: rgba(234,179,8,0.15);
        }

        .section-title {
            font-size: var(--font-lg);
            font-weight: 700;
        }

        .section-subtitle {
            font-size: var(--font-xs);
            color: var(--text3);
            margin-top: 2px;
        }

        /* Fake Cards */
        .fake-card {
            background: rgba(239,68,68,0.05);
            border: 1px solid rgba(239,68,68,0.2);
            border-radius: var(--radius-md);
            padding: 18px;
            margin-bottom: 12px;
            transition: all 0.3s;
        }

        .fake-card:active {
            transform: scale(0.98);
            background: rgba(239,68,68,0.1);
        }

        .fake-card-body {
            display: flex;
            gap: 14px;
            align-items: flex-start;
        }

        .fake-card-img {
            width: 64px;
            height: 64px;
            border-radius: var(--radius-sm);
            object-fit: cover;
            border: 2px solid rgba(239,68,68,0.3);
            flex-shrink: 0;
        }

        .fake-card-placeholder {
            width: 64px;
            height: 64px;
            border-radius: var(--radius-sm);
            background: rgba(239,68,68,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            flex-shrink: 0;
        }

        /* Official Cards */
        .official-card {
            background: rgba(16,185,129,0.05);
            border: 1px solid rgba(16,185,129,0.2);
            border-radius: var(--radius-md);
            padding: 16px 18px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 14px;
            transition: all 0.3s;
        }

        .official-card:active {
            transform: scale(0.98);
            background: rgba(16,185,129,0.1);
        }

        /* Warning Image */
        .warning-image-container {
            text-align: center;
            padding: 20px;
            background: rgba(234,179,8,0.05);
            border: 1px solid rgba(234,179,8,0.2);
            border-radius: var(--radius-md);
            margin-bottom: 20px;
        }

        .warning-image-container img {
            max-width: 100%;
            border-radius: var(--radius-md);
            box-shadow: var(--glow-yellow);
        }

        /* Music Player */
        .music-player {
            background: linear-gradient(180deg, #1a1040, #0a0a1a);
            border-radius: var(--radius-xl);
            padding: 28px;
            color: #fff;
            margin: 20px 0;
            border: 1px solid rgba(139,92,246,0.2);
        }

        .music-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
        }

        .music-header-icon {
            width: 32px;
            height: 32px;
            animation: micBounce 1.5s ease-in-out infinite;
        }

        @keyframes micBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
        }

        .album-art {
            width: 80px;
            height: 80px;
            border-radius: var(--radius-md);
            background: rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            flex-shrink: 0;
            border: 2px solid rgba(255,255,255,0.1);
            overflow: hidden;
            transition: all 0.3s;
        }

        .album-art img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .album-art.playing {
            animation: albumRotate 3s linear infinite;
        }

        @keyframes albumRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .play-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #1db954;
            border: none;
            color: #000;
            font-size: 24px;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.3s;
            box-shadow: 0 8px 24px rgba(29,185,84,0.3);
        }

        .play-btn:active {
            transform: scale(0.9);
        }

        .progress-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .progress-bar {
            flex: 1;
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            cursor: pointer;
            position: relative;
            overflow: visible;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #1db954, #1ed760);
            border-radius: 3px;
            width: 0%;
            position: relative;
            transition: width 0.1s linear;
        }

        .progress-thumb {
            position: absolute;
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background: #1ed760;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(30,215,96,0.4);
            opacity: 0;
            transition: opacity 0.3s;
        }

        .progress-bar:hover .progress-thumb {
            opacity: 1;
        }

        .song-list {
            max-height: 240px;
            overflow-y: auto;
            margin-top: 18px;
            -webkit-overflow-scrolling: touch;
        }

        .song-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all 0.2s;
            min-height: 48px;
        }

        .song-item:active {
            background: rgba(255,255,255,0.08);
            transform: scale(0.98);
        }

        .song-item.active {
            background: rgba(29,185,84,0.15);
            border: 1px solid rgba(29,185,84,0.3);
        }

        /* Gallery Grid */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
        }

        .gallery-item {
            border-radius: var(--radius-md);
            overflow: hidden;
            border: 1px solid var(--glass-border);
            aspect-ratio: 1;
            transition: all 0.3s;
        }

        .gallery-item:active {
            transform: scale(0.95);
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Toast Notifications */
        .toast {
            position: fixed;
            top: max(20px, var(--safe-top));
            right: max(16px, var(--safe-right));
            z-index: 99999;
            background: var(--surface2);
            border: 1px solid var(--glass-border);
            padding: 16px 24px;
            border-radius: var(--radius-sm);
            color: var(--text);
            font-size: var(--font-sm);
            font-weight: 500;
            transform: translateX(120%);
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            max-width: 90vw;
        }

        .toast.show {
            transform: translateX(0);
        }

        .toast.error {
            border-left: 3px solid var(--red);
        }

        .toast.success {
            border-left: 3px solid var(--green);
        }

        /* Chat Widget */
        .chat-widget {
            position: fixed;
            bottom: max(24px, var(--safe-bottom));
            right: max(24px, var(--safe-right));
            z-index: 9999;
        }

        .chat-btn {
            height: 56px;
            border-radius: 50px;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            border: none;
            cursor: pointer;
            box-shadow: 0 10px 40px rgba(139,92,246,0.4);
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 24px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: #fff;
            font-weight: 600;
            font-size: var(--font-sm);
            white-space: nowrap;
            min-width: auto;
        }

        .chat-btn:active {
            transform: scale(0.95);
            box-shadow: 0 5px 20px rgba(236,72,153,0.5);
        }

        .chat-btn img {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* Voice Message Animation */
        @keyframes voiceAnim {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.3); }
        }

        /* Loading Skeleton */
        .skeleton {
            background: linear-gradient(90deg, var(--surface2) 0%, var(--surface) 50%, var(--surface2) 100%);
            background-size: 200% 100%;
            animation: skeleton 1.5s ease-in-out infinite;
            border-radius: var(--radius-sm);
        }

        @keyframes skeleton {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        /* Responsive Adjustments */
        @media (max-width: 640px) {
            .header-nav {
                display: none;
            }
            
            .chat-widget {
                bottom: max(16px, var(--safe-bottom));
                right: max(16px, var(--safe-right));
            }
            
            .stats-row {
                gap: 8px;
            }
            
            .stat-card {
                padding: 12px 16px;
                min-width: 70px;
            }
            
            .glass-card {
                padding: 16px;
            }
            
            .profile-pic {
                width: 100px;
                height: 100px;
            }
            
            .profile-name {
                font-size: var(--font-xl);
            }
        }

        @media (min-width: 768px) {
            .chat-btn {
                height: 60px;
                padding: 0 28px;
                font-size: var(--font-md);
            }
            
            .chat-btn img {
                width: 40px;
                height: 40px;
            }
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }

        @media (prefers-contrast: high) {
            :root {
                --text: #ffffff;
                --text2: #cccccc;
                --text3: #999999;
            }
        }

        /* Focus states for accessibility */
        .btn:focus-visible,
        a:focus-visible,
        input:focus-visible {
            outline: 2px solid var(--purple);
            outline-offset: 2px;
            border-radius: 50px;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 4px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--text3);
            border-radius: 2px;
        }
    </style>
</head>
<body>
    <div class="stars-bg" id="starsBg"></div>
    <div class="orb" style="width:300px;height:300px;background:rgba(139,92,246,0.4);top:10%;left:-100px;--dur:8s"></div>
    <div class="orb" style="width:250px;height:250px;background:rgba(236,72,153,0.3);top:50%;right:-80px;--dur:10s"></div>
    <div class="orb" style="width:200px;height:200px;background:rgba(59,130,246,0.3);bottom:10%;left:30%;--dur:12s"></div>
    
    <div id="toast" class="toast" role="alert" aria-live="assertive"></div>
    
    <header class="main-header">
        <div class="header-inner">
            <div class="header-logo">
                <img src="${profilePic}" alt="Baiilla Maach" loading="eager">
                <span class="header-title">Verification Hub</span>
            </div>
            <nav class="header-nav" aria-label="Main navigation">
                <a href="#fake" class="nav-red">⚠ Fakes</a>
                ${coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : ''}
                <a href="#warning" class="nav-purple">🔍 Detection</a>
                <a href="#official" class="nav-green">✓ Official</a>
                <a href="#gallery" class="nav-purple">📸 Gallery</a>
            </nav>
        </div>
    </header>
    
    <main>
        <section class="profile-section">
            <div class="profile-pic-wrap">
                <img src="${profilePic}" class="profile-pic" alt="Baiilla Maach profile picture" loading="eager">
                <div class="verified-badge-prof" aria-label="Verified account">✓</div>
            </div>
            <h1 class="profile-name">${DATA.celebrity.fullName}</h1>
            <p class="profile-bio">${DATA.celebrity.bio}</p>
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-value">${DATA.celebrity.tiktokFollowers}</div>
                    <div class="stat-label">Followers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${DATA.celebrity.tiktokFollowing}</div>
                    <div class="stat-label">Following</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${DATA.celebrity.tiktokLikes}</div>
                    <div class="stat-label">Likes</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                <span class="badge badge-green">✓ Verified Creator</span>
                <span class="badge badge-purple">Official Account</span>
            </div>
        </section>

        <section id="fake" class="glass-card danger-card">
            <div class="section-header">
                <div class="icon-circle icon-red">⚠️</div>
                <div>
                    <div class="section-title" style="color:#fca5a5">Fake Accounts Detected</div>
                    <div class="section-subtitle">Report these impersonating accounts</div>
                </div>
                <span class="badge badge-red" style="margin-left:auto">${totalFake} Active</span>
            </div>
            ${fakeCardsHTML}
            <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
                <button class="btn btn-red btn-sm" id="voicePlayBtn" onclick="toggleFakeVoice()" aria-label="Play fake account alert">🔊 Play Alert</button>
                <button class="btn btn-outline btn-sm" id="voiceStopBtn" onclick="stopFakeVoice()" style="display:none" aria-label="Stop fake account alert">⏹ Stop</button>
            </div>
            <audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="auto" aria-hidden="true"></audio>
        </section>

        ${musicSectionHTML}

        <section id="warning" class="warning-image-container">
            <img src="${IMAGES.fakeDetect}" alt="Fake account detection guide" loading="lazy">
            <div style="margin-top:16px">
                <span class="badge badge-yellow">🔍 Fake Account Detection Guide</span>
            </div>
            <p style="color:var(--text2);font-size:var(--font-sm);margin-top:12px;line-height:1.6">
                Always check for the verified badge before interacting. Report suspicious accounts immediately.
            </p>
        </section>

        <section id="official" class="glass-card success-card">
            <div class="section-header">
                <div class="icon-circle icon-green">✓</div>
                <div>
                    <div class="section-title" style="color:#6ee7b7">Official Verified Accounts</div>
                    <div class="section-subtitle">Only follow these real accounts</div>
                </div>
            </div>
            ${officialCardsHTML}
        </section>

        <section id="gallery" class="glass-card">
            <div class="section-header">
                <span style="font-size:22px">📸</span>
                <div>
                    <div class="section-title">Photo Gallery</div>
                    <div class="section-subtitle">Official moments</div>
                </div>
            </div>
            <div class="gallery-grid">
                ${galleryHTML}
            </div>
        </section>
    </main>

    <div class="chat-widget">
        <button class="chat-btn" onclick="window.open('/chat','_blank')" aria-label="Open chat">
            <img src="${IMAGES.messageIcon}" alt="Chat icon">
            <span>💬 Chat Now</span>
        </button>
    </div>

    <audio id="welcomeVoice" src="${VOICE.welcome}" preload="none" aria-hidden="true"></audio>

    <script>
        (function() {
            // Generate stars
            const starsBg = document.getElementById('starsBg');
            for (let i = 0; i < 80; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                star.style.cssText = \`
                    left: \${Math.random() * 100}%;
                    top: \${Math.random() * 100}%;
                    width: \${Math.random() * 3 + 1}px;
                    height: \${Math.random() * 3 + 1}px;
                    --dur: \${Math.random() * 3 + 2}s;
                    --delay: \${Math.random() * 5}s;
                \`;
                starsBg.appendChild(star);
            }

            // Toast notification system
            window.showToast = function(message, type = '') {
                const toast = document.getElementById('toast');
                toast.textContent = message;
                toast.className = \`toast show \${type}\`;
                
                // Clear any existing timeout
                if (toast.hideTimeout) {
                    clearTimeout(toast.hideTimeout);
                }
                
                toast.hideTimeout = setTimeout(() => {
                    toast.classList.remove('show');
                }, 3000);
            };

            // Copy to clipboard
            window.copyTxt = async function(text) {
                try {
                    await navigator.clipboard.writeText(text);
                    showToast('Copied to clipboard!', 'success');
                } catch (err) {
                    showToast('Failed to copy', 'error');
                }
            };

            // Fake voice alert
            let fakeVoicePlaying = false;
            const fakeAudio = document.getElementById('fakeVoice');
            const voicePlayBtn = document.getElementById('voicePlayBtn');
            const voiceStopBtn = document.getElementById('voiceStopBtn');

            window.toggleFakeVoice = function() {
                if (fakeVoicePlaying) {
                    fakeAudio.pause();
                    fakeAudio.currentTime = 0;
                    fakeVoicePlaying = false;
                    voicePlayBtn.textContent = '🔊 Play Alert';
                    voicePlayBtn.style.display = '';
                    voiceStopBtn.style.display = 'none';
                } else {
                    fakeAudio.play()
                        .then(() => {
                            fakeVoicePlaying = true;
                            voicePlayBtn.textContent = '🔊 Playing...';
                            voiceStopBtn.style.display = '';
                        })
                        .catch(() => {
                            showToast('Failed to play audio', 'error');
                        });
                }
            };

            window.stopFakeVoice = function() {
                fakeAudio.pause();
                fakeAudio.currentTime = 0;
                fakeVoicePlaying = false;
                voicePlayBtn.textContent = '🔊 Play Alert';
                voicePlayBtn.style.display = '';
                voiceStopBtn.style.display = 'none';
            };

            fakeAudio.addEventListener('ended', () => {
                fakeVoicePlaying = false;
                voicePlayBtn.textContent = '🔊 Play Alert';
                voicePlayBtn.style.display = '';
                voiceStopBtn.style.display = 'none';
            });

            // Music player
            let currentAudio = null;
            let isPlaying = false;
            const coverAudio = document.getElementById('coverAudio');
            const playBtn = document.getElementById('playBtn');
            const albumArt = document.getElementById('albumArt');
            const progressFill = document.getElementById('progressFill');
            const currentTimeEl = document.getElementById('currentTime');
            const totalTimeEl = document.getElementById('totalTime');
            const currentTitleEl = document.getElementById('currentTitle');
            const currentArtistEl = document.getElementById('currentArtist');

            window.playSong = function(audioUrl, title, artist, coverUrl, index) {
                if (currentAudio === audioUrl) {
                    togglePlay();
                    return;
                }

                if (currentAudio) {
                    coverAudio.pause();
                }

                currentAudio = audioUrl;
                coverAudio.src = audioUrl;
                currentTitleEl.textContent = title || 'Unknown';
                currentArtistEl.textContent = artist || 'Unknown';
                
                if (coverUrl) {
                    albumArt.innerHTML = \`<img src="\${coverUrl}" alt="\${title}" style="width:100%;height:100%;object-fit:cover">\`;
                } else {
                    albumArt.innerHTML = '<span>🎵</span>';
                }

                progressFill.style.width = '0%';
                currentTimeEl.textContent = '0:00';
                totalTimeEl.textContent = '0:00';

                // Update active song in list
                document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
                const songItem = document.getElementById(\`song-\${index}\`);
                if (songItem) songItem.classList.add('active');

                coverAudio.play()
                    .then(() => {
                        isPlaying = true;
                        playBtn.textContent = '⏸️';
                        albumArt.classList.add('playing');
                    })
                    .catch(() => {
                        showToast('Failed to play audio', 'error');
                    });
            };

            window.togglePlay = function() {
                if (!coverAudio.src || coverAudio.src === window.location.href) {
                    showToast('Select a song first', 'error');
                    return;
                }

                if (isPlaying) {
                    coverAudio.pause();
                    isPlaying = false;
                    playBtn.textContent = '▶️';
                    albumArt.classList.remove('playing');
                } else {
                    coverAudio.play()
                        .then(() => {
                            isPlaying = true;
                            playBtn.textContent = '⏸️';
                            albumArt.classList.add('playing');
                        })
                        .catch(() => {
                            showToast('Failed to play audio', 'error');
                        });
                }
            };

            window.seekAudio = function(event) {
                if (!coverAudio.duration) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const seekPosition = (event.clientX - rect.left) / rect.width;
                coverAudio.currentTime = seekPosition * coverAudio.duration;
            };

            function formatTime(seconds) {
                if (isNaN(seconds)) return '0:00';
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return \`\${mins}:\${String(secs).padStart(2, '0')}\`;
            }

            coverAudio.addEventListener('timeupdate', () => {
                if (coverAudio.duration) {
                    const progress = (coverAudio.currentTime / coverAudio.duration) * 100;
                    progressFill.style.width = \`\${progress}%\`;
                    currentTimeEl.textContent = formatTime(coverAudio.currentTime);
                }
            });

            coverAudio.addEventListener('loadedmetadata', () => {
                totalTimeEl.textContent = formatTime(coverAudio.duration);
            });

            coverAudio.addEventListener('ended', () => {
                isPlaying = false;
                playBtn.textContent = '▶️';
                albumArt.classList.remove('playing');
                progressFill.style.width = '0%';
                currentTimeEl.textContent = '0:00';
                currentAudio = null;
            });

            // Welcome voice
            setTimeout(() => {
                const welcomeVoice = document.getElementById('welcomeVoice');
                if (welcomeVoice && !sessionStorage.getItem('vp')) {
                    welcomeVoice.play().catch(() => {});
                    sessionStorage.setItem('vp', '1');
                }
            }, 2000);

            // Pull to refresh (simplified)
            let touchStartY = 0;
            document.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                const touchY = e.touches[0].clientY;
                if (window.scrollY === 0 && touchY > touchStartY) {
                    // Could implement pull-to-refresh indicator here
                }
            }, { passive: true });

            // Lazy loading for images
            if ('loading' in HTMLImageElement.prototype) {
                document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                    img.src = img.src;
                });
            }
        })();
    </script>
</body>
</html>`;
}

// Admin login page
function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <title>Admin Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0f0f1a, #1a1a2e);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            min-height: -webkit-fill-available;
            padding: 20px;
        }
        .login-card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h2 {
            color: #fff;
            text-align: center;
            margin-bottom: 30px;
            font-size: 24px;
        }
        .error {
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.3);
            color: #fca5a5;
            padding: 12px;
            border-radius: 12px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            color: #a0a0cc;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 14px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: #fff;
            font-size: 16px;
            transition: all 0.3s;
            -webkit-appearance: none;
        }
        input:focus {
            outline: none;
            border-color: #8b5cf6;
            box-shadow: 0 0 0 3px rgba(139,92,246,0.2);
        }
        button {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: #fff;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        button:active {
            transform: scale(0.98);
        }
        .back-link {
            display: block;
            text-align: center;
            color: #a0a0cc;
            margin-top: 20px;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link:hover {
            color: #c4b5fd;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <h2>🔐 Admin Login</h2>
        ${error ? `<div class="error">${error}</div>` : ''}
        <form method="POST" action="/admin/login">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" placeholder="Enter username" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>
        <a href="/" class="back-link">← Back to site</a>
    </div>
</body>
</html>`;
}

// Admin panel page
async function getAdminPanelHTML(photos, message = '', error = '') {
    photos = photos || [];
    const chatList = getAdminChatList();
    const totalUnread = chatList.reduce((sum, c) => sum + c.unread, 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <title>Admin Panel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0f0f1a;
            color: #fff;
            min-height: 100vh;
        }
        header {
            background: rgba(10,10,20,0.9);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 16px;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header-inner {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        h1 { font-size: 18px; color: #a78bfa; }
        .header-nav { display: flex; gap: 8px; }
        .header-nav a, .header-nav button {
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            border: none;
            cursor: pointer;
            transition: all 0.3s;
        }
        .header-nav a:active, .header-nav button:active {
            transform: scale(0.95);
        }
        .chat-btn {
            background: #8b5cf6;
            color: #fff;
            position: relative;
        }
        .unread-count {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #ef4444;
            color: #fff;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .site-btn { background: rgba(255,255,255,0.1); color: #fff; }
        .logout-btn { background: rgba(239,68,68,0.2); color: #fca5a5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
        .notification {
            padding: 16px;
            border-radius: 16px;
            margin-bottom: 24px;
            font-size: 14px;
        }
        .notification.success {
            background: rgba(16,185,129,0.1);
            border: 1px solid rgba(16,185,129,0.3);
            color: #6ee7b7;
        }
        .notification.error {
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.3);
            color: #fca5a5;
        }
        .upload-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 24px;
            padding: 24px;
            margin-bottom: 24px;
        }
        .upload-card h2 { font-size: 18px; margin-bottom: 20px; color: #c4b5fd; }
        .form-group { margin-bottom: 16px; }
        .form-group input[type="file"] {
            color: #a0a0cc;
            font-size: 14px;
        }
        .form-group input[type="text"] {
            width: 100%;
            padding: 14px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: #fff;
            font-size: 14px;
        }
        .form-group input[type="text"]:focus {
            outline: none;
            border-color: #8b5cf6;
        }
        .upload-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: #fff;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .upload-btn:active {
            transform: scale(0.98);
        }
        .gallery-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }
        .gallery-item {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 20px;
            overflow: hidden;
            transition: all 0.3s;
        }
        .gallery-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .gallery-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        .gallery-item-content {
            padding: 16px;
        }
        .gallery-item-content p {
            color: #a0a0cc;
            font-size: 14px;
            margin-bottom: 12px;
        }
        .delete-btn {
            background: none;
            border: 1px solid rgba(239,68,68,0.3);
            color: #fca5a5;
            padding: 8px 16px;
            border-radius: 50px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .delete-btn:hover {
            background: rgba(239,68,68,0.1);
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #6060a0;
        }
        @media (max-width: 640px) {
            .gallery-grid {
                grid-template-columns: 1fr;
            }
            .header-nav a {
                padding: 8px 14px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="header-inner">
            <h1>⚡ Admin Panel</h1>
            <div class="header-nav">
                <a href="/admin/chat" class="chat-btn">
                    💬 Chats
                    ${totalUnread > 0 ? `<span class="unread-count">${totalUnread}</span>` : ''}
                </a>
                <a href="/" class="site-btn">🌐 Site</a>
                <a href="/admin/logout" class="logout-btn">🚪 Logout</a>
            </div>
        </div>
    </header>
    
    <div class="container">
        ${message ? `<div class="notification success">✓ ${message}</div>` : ''}
        ${error ? `<div class="notification error">⚠ ${error}</div>` : ''}
        
        <div class="upload-card">
            <h2>📤 Upload Photo</h2>
            <form method="POST" action="/admin/upload" enctype="multipart/form-data">
                <div class="form-group">
                    <input type="file" name="photo" accept="image/*" required>
                </div>
                <div class="form-group">
                    <input type="text" name="caption" placeholder="Photo caption (optional)">
                </div>
                <button type="submit" class="upload-btn">Upload Photo</button>
            </form>
        </div>
        
        <div class="gallery-title">
            <span>📸 Gallery</span>
            <span style="font-size:14px;opacity:0.5">(${photos.length} photos)</span>
        </div>
        
        <div class="gallery-grid">
            ${photos.length === 0 ? `
                <div class="empty-state" style="grid-column:1/-1">
                    <div style="font-size:48px;margin-bottom:16px">📭</div>
                    <div>No photos yet. Upload your first photo!</div>
                </div>
            ` : photos.map(p => `
                <div class="gallery-item">
                    <img src="${p.path}" alt="${p.caption || 'Photo'}" loading="lazy">
                    <div class="gallery-item-content">
                        <p>${p.caption || 'No caption'}</p>
                        <form method="POST" action="/admin/delete" onsubmit="return confirm('Delete this photo?')">
                            <input type="hidden" name="photoId" value="${p._id}">
                            <button type="submit" class="delete-btn">🗑 Delete</button>
                        </form>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // CORS headers
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
    
    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        
        // Security check to prevent directory traversal
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.webm': 'audio/webm',
                '.aac': 'audio/aac',
                '.flac': 'audio/flac'
            };
            
            res.writeHead(200, {
                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Asset not found');
        }
        return;
    }
    
    // Chat page
    if (pathname === '/chat' && method === 'GET') {
        try {
            const chatPageHTML = require('./chat').getChatPageHTML();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(chatPageHTML);
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat</title></head><body style="background:#0a0a14;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>💬 Chat</h1><p style="opacity:0.5">Chat module loading...</p></div></body></html>`);
        }
        return;
    }
    
    // API: Register chat user
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                if (!name || !phoneEmail) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Name and contact required' }));
                    return;
                }
                
                const user = createOrGetChatUser(name, phoneEmail);
                if (!user) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Failed to create user' }));
                    return;
                }
                
                const token = createChatSession(user.chatId);
                const existingMessages = getChatMessages(user.chatId);
                
                if (existingMessages.length === 0) {
                    saveChatMessage(user.chatId, 'admin', 'Hello! How can I help you? 👋');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token, name, phoneEmail }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // API: Verify chat session
    if (pathname === '/api/chat/verify' && method === 'GET') {
        const user = getChatUserByToken(parsedUrl.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!user, chatId: user ? user.chatId : null }));
        return;
    }
    
    // API: Get chat messages
    if (pathname === '/api/chat/messages' && method === 'GET') {
        const user = getChatUserByToken(parsedUrl.query.token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(user.chatId) }));
        return;
    }
    
    // API: Send chat message
    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { token, message, type, fileUrl, fileName, duration } = JSON.parse(body);
            const user = getChatUserByToken(token);
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            saveChatMessage(user.chatId, 'user', message, type, fileUrl, fileName, duration);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    // API: Upload chat photo
    if (pathname === '/api/chat/upload' && method === 'POST') {
        const token = parsedUrl.query.token;
        const user = getChatUserByToken(token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const fileName = Date.now() + '_' + photoFile.originalFilename;
            fs.renameSync(photoFile.filepath, path.join(CHAT_UPLOADS_DIR, fileName));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fileName }));
        });
        return;
    }
    
    // API: Upload voice message
    if (pathname === '/api/chat/upload-voice' && method === 'POST') {
        const token = parsedUrl.query.token;
        const user = getChatUserByToken(token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024 // 5MB
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const voiceFile = Array.isArray(files.voice) ? files.voice[0] : files.voice;
            if (!voiceFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const fileName = 'voice_' + Date.now() + '.webm';
            fs.renameSync(voiceFile.filepath, path.join(CHAT_UPLOADS_DIR, fileName));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fileName }));
        });
        return;
    }
    
    // Admin routes
    if (pathname === '/admin' && method === 'GET') {
        const session = getSession(cookies.sessionId);
        if (session) {
            adminPresence.isOnline = true;
            adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(await getGalleryPhotos()));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }
    
    // Admin login
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'), params.get('password'))) {
                const sessionId = createSession(params.get('username'));
                adminPresence.isOnline = true;
                adminPresence.lastSeen = new Date();
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sessionId};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`
                });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid credentials'));
            }
        });
        return;
    }
    
    // Admin logout
    if (pathname === '/admin/logout') {
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
    
    // Admin chat panel
    if (pathname === '/admin/chat' && method === 'GET') {
        const session = getSession(cookies.sessionId);
        if (!session) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        
        adminPresence.isOnline = true;
        adminPresence.lastSeen = new Date();
        
        const chatId = parsedUrl.query.chatId;
        const chatList = getAdminChatList();
        let messages = [];
        
        if (chatId) {
            messages = getChatMessages(chatId);
            markMessagesRead(chatId);
        }
        
        let messagesHTML = '';
        messages.forEach(function(m) {
            const cls = m.sender === 'user' ? 'user' : 'admin';
            messagesHTML += `<div class="msg-b ${cls}"><div class="bub">${renderMsgBubble(m)}</div></div>`;
        });
        
        const currentChat = chatList.find(c => c.chatId === chatId);
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <title>Admin Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes voiceAnim {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.3); }
        }
        body {
            font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0a0a14;
            color: #fff;
            margin: 0;
            display: flex;
            height: 100vh;
            height: -webkit-fill-available;
        }
        .sidebar {
            width: 350px;
            background: #13132b;
            border-right: 1px solid rgba(255,255,255,0.06);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #0a0a14;
            -webkit-overflow-scrolling: touch;
        }
        .msg-b {
            margin-bottom: 12px;
            display: flex;
        }
        .msg-b.user { justify-content: flex-start; }
        .msg-b.admin { justify-content: flex-end; }
        .msg-b .bub {
            max-width: 70%;
            padding: 10px 14px;
            border-radius: 18px;
            font-size: 13px;
            word-wrap: break-word;
        }
        .msg-b.user .bub {
            background: #1a1a35;
            border-bottom-left-radius: 4px;
        }
        .msg-b.admin .bub {
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            border-bottom-right-radius: 4px;
        }
        .image-preview {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        .image-preview img {
            max-width: 95%;
            max-height: 95%;
            border-radius: 12px;
        }
        .admin-input-area {
            background: #13132b;
            padding: 14px;
            display: flex;
            gap: 10px;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        .admin-input {
            flex: 1;
            padding: 10px 16px;
            background: #1a1a35;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 25px;
            color: #fff;
            font-size: 13px;
            outline: none;
        }
        .admin-input:focus {
            border-color: #8b5cf6;
        }
        .admin-send-btn {
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            color: #fff;
            border: none;
            padding: 10px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.3s;
        }
        .admin-send-btn:active {
            transform: scale(0.95);
        }
        .admin-file-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            border: none;
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.3s;
        }
        .admin-file-btn:active {
            transform: scale(0.9);
        }
        .sidebar-header {
            padding: 16px;
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .sidebar-item {
            padding: 14px 16px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            transition: background 0.2s;
        }
        .sidebar-item:active {
            background: rgba(139,92,246,0.1);
        }
        .sidebar-item.active {
            background: rgba(139,92,246,0.2);
            border-left: 3px solid #8b5cf6;
        }
        .unread-badge {
            background: #ef4444;
            color: #fff;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: 8px;
        }
        .chat-header {
            padding: 14px 16px;
            background: #13132b;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .refresh-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: #fff;
            padding: 4px 10px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 11px;
        }
        .refresh-btn:active {
            transform: scale(0.95);
        }
        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                position: absolute;
                top: 0; left: 0; bottom: 0;
                z-index: 10;
            }
            .main {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 20;
                background: #0a0a14;
            }
            .sidebar.hidden-mobile {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <span>💬 Chats</span>
            <div style="display:flex;gap:8px">
                <button class="refresh-btn" onclick="refreshList()">↻</button>
                <a href="/admin" style="color:#fff;font-size:11px;text-decoration:none;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:10px">Back</a>
            </div>
        </div>
        <div id="chatList">
            ${chatList.map(function(c) {
                return `<div class="sidebar-item${c.chatId === chatId ? ' active' : ''}" onclick="selectChat('${c.chatId}')">
                    <div style="font-weight:600;display:flex;align-items:center;justify-content:space-between">
                        <span>${c.name}</span>
                        ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : ''}
                    </div>
                    <div style="font-size:12px;opacity:0.6;margin-top:2px">${c.phoneEmail}</div>
                    <div style="font-size:10px;opacity:0.4;margin-top:2px">${c.lastMessage ? c.lastMessage.message.substring(0, 30) : 'No messages'}</div>
                </div>`;
            }).join('')}
        </div>
    </div>
    
    <div class="main" id="mainPanel">
        ${chatId ? `
            <div class="chat-header">
                <button onclick="showMobileSidebar()" style="background:none;border:none;color:#fff;font-size:20px;display:none" class="back-btn">←</button>
                <span>${currentChat ? currentChat.name : ''}</span>
            </div>
            <div class="messages" id="mc">${messagesHTML}</div>
            <div class="admin-input-area">
                <input type="file" id="adminFileInput" accept="image/*" style="display:none" onchange="handleAdminFile(event)">
                <button class="admin-file-btn" onclick="document.getElementById('adminFileInput').click()" title="Send Photo">📎</button>
                <input id="am" class="admin-input" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendAdminMessage()">
                <button class="admin-send-btn" onclick="sendAdminMessage()">Send</button>
            </div>
            <audio id="voicePlayer" style="display:none"></audio>
            <div class="image-preview" id="imagePreview" style="display:none" onclick="this.style.display='none'">
                <img id="previewImg" src="" alt="Preview">
            </div>
        ` : `
            <div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.5;flex-direction:column;gap:10px">
                <div style="font-size:60px">💬</div>
                <div>Select a chat from the left</div>
                <button onclick="refreshList()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;margin-top:10px">Refresh List</button>
            </div>
        `}
    </div>
    
    <script>
        var cid = "${chatId}";
        
        function selectChat(id) {
            window.location.href = "/admin/chat?chatId=" + id;
        }
        
        function refreshList() {
            window.location.reload();
        }
        
        function loadMessages() {
            fetch("/api/admin/messages?chatId=" + cid)
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    if (d.success) {
                        var h = "";
                        d.messages.forEach(function(m) {
                            var c = m.sender === "user" ? "user" : "admin";
                            h += '<div class="msg-b ' + c + '"><div class="bub">' + renderBubble(m) + '</div></div>';
                        });
                        document.getElementById("mc").innerHTML = h;
                        document.getElementById("mc").scrollTop = document.getElementById("mc").scrollHeight;
                    }
                });
        }
        
        function renderBubble(m) {
            var time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        
        function sendAdminMessage() {
            var input = document.getElementById("am");
            var msg = input.value.trim();
            if (!msg) return;
            
            fetch("/api/admin/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId: cid, message: msg, type: "text" })
            }).then(function() {
                input.value = "";
                loadMessages();
            });
        }
        
        function handleAdminFile(event) {
            var file = event.target.files[0];
            if (!file) return;
            
            var fd = new FormData();
            fd.append("photo", file);
            
            fetch("/api/admin/upload-file?chatId=" + cid, {
                method: "POST",
                body: fd
            }).then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success) {
                    fetch("/api/admin/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chatId: cid, message: "📷 Photo", type: "image", fileUrl: d.fileUrl })
                    }).then(function() {
                        loadMessages();
                    });
                }
            });
            
            event.target.value = "";
        }
        
        function playV(url, btn) {
            var p = document.getElementById("voicePlayer");
            if (p.src === url && !p.paused) {
                p.pause();
                btn.textContent = "▶";
                return;
            }
            p.src = url;
            p.play();
            btn.textContent = "⏸";
            p.onended = function() { btn.textContent = "▶"; };
            p.onpause = function() { btn.textContent = "▶"; };
        }
        
        function showImg(url) {
            document.getElementById("previewImg").src = url;
            document.getElementById("imagePreview").style.display = "flex";
        }
        
        function showMobileSidebar() {
            document.getElementById("sidebar").classList.toggle("hidden-mobile");
        }
        
        // Auto-refresh messages
        setInterval(loadMessages, 2000);
        setInterval(refreshList, 10000);
    </script>
</body>
</html>`);
        return;
    }
    
    // API: Get admin messages
    if (pathname === '/api/admin/messages' && method === 'GET') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        markMessagesRead(parsedUrl.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(parsedUrl.query.chatId) }));
        return;
    }
    
    // API: Admin send message
    if (pathname === '/api/admin/send' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { chatId, message, type, fileUrl } = JSON.parse(body);
            saveChatMessage(chatId, 'admin', message, type, fileUrl);
            adminPresence.isOnline = true;
            adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    // API: Admin upload file
    if (pathname === '/api/admin/upload-file' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const fileName = 'admin_' + Date.now() + '_' + photoFile.originalFilename;
            fs.renameSync(photoFile.filepath, path.join(CHAT_UPLOADS_DIR, fileName));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fileName }));
        });
        return;
    }
    
    // Admin upload photo
    if (pathname === '/admin/upload' && method === 'POST') {
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
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
                return;
            }
            
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile) {
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
                return;
            }
            
            const fileName = Date.now() + '_' + photoFile.originalFilename;
            fs.renameSync(photoFile.filepath, path.join(GALLERY_DIR, fileName));
            await savePhoto({ path: '/assets/gallery/' + fileName, caption: fields.caption || '' });
            
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
        });
        return;
    }
    
    // Admin delete photo
    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            try {
                const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(params.get('photoId')) });
                if (photo && fs.existsSync(path.join(__dir, photo.path))) {
                    fs.unlinkSync(path.join(__dir, photo.path));
                }
                await deletePhoto(params.get('photoId'));
            } catch (e) {}
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
        });
        return;
    }
    
    // Main page
    if (pathname === '/' || pathname === '/index.html') {
        const galleryPhotos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(galleryPhotos));
        return;
    }
    
    // 404 handler
    res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>404 - Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0a0a14;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .error-container {
            text-align: center;
        }
        h1 { font-size: 72px; margin: 0; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { opacity: 0.5; margin: 20px 0; }
        a { color: #8b5cf6; text-decoration: none; font-weight: 600; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/">← Go back home</a>
    </div>
</body>
</html>`);
});

// Start the server
async function start() {
    const dbOk = await connectDB();
    if (dbOk) {
        console.log('✅ MongoDB Connected Successfully');
    } else {
        console.log('⚠️  Using in-memory storage (MongoDB unavailable)');
    }
    
    server.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📱 Main site: http://localhost:${PORT}`);
        console.log(`💬 Chat: http://localhost:${PORT}/chat`);
        console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        if (mongoClient) mongoClient.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        if (mongoClient) mongoClient.close();
        process.exit(0);
    });
});

start().catch(console.error);

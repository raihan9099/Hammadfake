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

// Inline chat page - no external module needed
function getChatPageHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <title>Chat - Verification Hub</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:"Plus Jakarta Sans",-apple-system,sans-serif;background:#f5f5f7;min-height:100vh}
        .chat-container{max-width:500px;margin:0 auto;height:100vh;display:flex;flex-direction:column;background:#fff}
        .chat-header{background:#fff;padding:16px;border-bottom:1px solid #e5e5ea;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
        .chat-header img{width:40px;height:40px;border-radius:50%}
        .chat-header-info{flex:1}
        .chat-header-name{font-weight:600;font-size:16px;color:#1c1c1e}
        .chat-header-status{font-size:12px;color:#8e8e93}
        .register-form{padding:40px 20px;text-align:center;flex:1;display:flex;flex-direction:column;justify-content:center}
        .register-form h2{font-size:24px;margin-bottom:8px;color:#1c1c1e}
        .register-form p{color:#8e8e93;margin-bottom:24px;font-size:14px}
        .input-group{margin-bottom:16px;text-align:left}
        .input-group label{display:block;font-size:13px;font-weight:500;color:#3a3a3c;margin-bottom:6px}
        .input-group input{width:100%;padding:14px 16px;border:1px solid #d1d1d6;border-radius:12px;font-size:16px;background:#f9f9fb;transition:all 0.2s}
        .input-group input:focus{outline:none;border-color:#007aff;background:#fff;box-shadow:0 0 0 3px rgba(0,122,255,0.1)}
        .btn-primary{width:100%;padding:16px;background:#007aff;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.2s}
        .btn-primary:active{transform:scale(0.98);opacity:0.9}
        .btn-primary:disabled{opacity:0.5;pointer-events:none}
        .messages-area{flex:1;overflow-y:auto;padding:16px;background:#f9f9fb}
        .msg-bubble{max-width:75%;padding:10px 14px;border-radius:18px;margin-bottom:8px;font-size:15px;line-height:1.4;word-wrap:break-word;position:relative}
        .msg-user{background:#007aff;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
        .msg-admin{background:#e5e5ea;color:#1c1c1e;margin-right:auto;border-bottom-left-radius:4px}
        .msg-time{font-size:10px;opacity:0.6;margin-top:4px;text-align:right}
        .input-area{background:#fff;padding:12px 16px;border-top:1px solid #e5e5ea;display:flex;gap:8px;align-items:center}
        .input-area input{flex:1;padding:12px 16px;border:1px solid #d1d1d6;border-radius:24px;font-size:15px;background:#f9f9fb}
        .input-area input:focus{outline:none;border-color:#007aff}
        .send-btn{width:40px;height:40px;border-radius:50%;background:#007aff;color:#fff;border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .send-btn:active{transform:scale(0.9)}
        .error-msg{color:#ff3b30;font-size:13px;text-align:center;margin-top:8px}
    </style>
</head>
<body>
    <div class="chat-container" id="app">
        <div class="chat-header">
            <img src="${IMAGES.profile}" alt="Profile">
            <div class="chat-header-info">
                <div class="chat-header-name">Verification Hub Chat</div>
                <div class="chat-header-status" id="statusText">Online</div>
            </div>
        </div>
        <div id="registerSection" class="register-form">
            <h2>💬 Start Chat</h2>
            <p>Enter your details to connect with us</p>
            <div class="input-group">
                <label>Your Name</label>
                <input type="text" id="regName" placeholder="Enter your name" autocomplete="name">
            </div>
            <div class="input-group">
                <label>Phone or Email</label>
                <input type="text" id="regContact" placeholder="Phone number or email" autocomplete="email">
            </div>
            <button class="btn-primary" onclick="registerChat()">Start Chat</button>
            <div class="error-msg" id="regError"></div>
        </div>
        <div id="chatSection" style="display:none;flex:1;flex-direction:column">
            <div class="messages-area" id="messagesArea"></div>
            <div class="input-area">
                <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
                <button class="send-btn" onclick="sendMessage()">➤</button>
            </div>
        </div>
    </div>
    <script>
        let token = localStorage.getItem('chatToken');
        let chatId = localStorage.getItem('chatId');
        let pollInterval = null;

        function showError(msg) {
            document.getElementById('regError').textContent = msg;
            setTimeout(() => document.getElementById('regError').textContent = '', 3000);
        }

        async function registerChat() {
            const name = document.getElementById('regName').value.trim();
            const contact = document.getElementById('regContact').value.trim();
            if (!name || !contact) { showError('Please fill all fields'); return; }
            
            try {
                const res = await fetch('/api/chat/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phoneEmail: contact })
                });
                const data = await res.json();
                if (data.success) {
                    token = data.token;
                    chatId = data.chatId;
                    localStorage.setItem('chatToken', token);
                    localStorage.setItem('chatId', chatId);
                    document.getElementById('registerSection').style.display = 'none';
                    document.getElementById('chatSection').style.display = 'flex';
                    loadMessages();
                    pollInterval = setInterval(loadMessages, 2000);
                } else {
                    showError(data.error || 'Registration failed');
                }
            } catch(e) {
                showError('Connection error. Please try again.');
            }
        }

        async function loadMessages() {
            if (!token) return;
            try {
                const res = await fetch('/api/chat/messages?token=' + encodeURIComponent(token));
                const data = await res.json();
                if (data.success) {
                    const area = document.getElementById('messagesArea');
                    let html = '';
                    data.messages.forEach(m => {
                        const cls = m.sender === 'user' ? 'msg-user' : 'msg-admin';
                        const time = new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                        html += '<div class="msg-bubble ' + cls + '">' + m.message + '<div class="msg-time">' + time + '</div></div>';
                    });
                    area.innerHTML = html;
                    area.scrollTop = area.scrollHeight;
                }
            } catch(e) {}
        }

        async function sendMessage() {
            const input = document.getElementById('msgInput');
            const msg = input.value.trim();
            if (!msg || !token) return;
            try {
                await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, message: msg, type: 'text' })
                });
                input.value = '';
                loadMessages();
            } catch(e) {}
        }

        // Check existing session
        if (token) {
            fetch('/api/chat/verify?token=' + encodeURIComponent(token))
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('registerSection').style.display = 'none';
                        document.getElementById('chatSection').style.display = 'flex';
                        loadMessages();
                        pollInterval = setInterval(loadMessages, 2000);
                    } else {
                        localStorage.removeItem('chatToken');
                        localStorage.removeItem('chatId');
                        token = null;
                        chatId = null;
                    }
                });
        }

        window.addEventListener('beforeunload', () => {
            if (pollInterval) clearInterval(pollInterval);
        });
    </script>
</body>
</html>`;
}

function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;

    let fakeCardsHTML = '';
    DATA.fakeAccounts.forEach(function(a) {
        fakeCardsHTML += `
        <div class="card fake-card">
            <div class="fake-card-inner">
                ${a.screenshot ? `<img src="${a.screenshot}" class="fake-img" alt="Fake account">` : `<div class="fake-img-placeholder">⚠️</div>`}
                <div class="fake-info">
                    <div class="fake-username">${a.username}</div>
                    <div class="fake-reason">⚠ ${a.reason}</div>
                    <div class="fake-actions">
                        <a href="${a.profileUrl}" target="_blank" rel="noopener" class="btn btn-danger btn-sm">Report</a>
                        <button onclick="copyText('${a.username}')" class="btn btn-outline btn-sm">Copy</button>
                    </div>
                </div>
            </div>
        </div>`;
    });

    let officialCardsHTML = '';
    DATA.realAccounts.forEach(function(acc) {
        officialCardsHTML += `
        <div class="card official-card">
            <img src="${acc.icon}" class="platform-icon" alt="${acc.platform}">
            <div class="official-info">
                <div class="official-username">
                    <span>${acc.username}</span>
                    <img src="${acc.verifiedIcon}" class="verified-tick" alt="Verified">
                </div>
                <div class="official-followers">${acc.followers} followers</div>
            </div>
            <a href="${acc.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Follow</a>
        </div>`;
    });

    let galleryHTML = '';
    if (galleryPhotos.length === 0) {
        galleryHTML = '<div class="gallery-empty">📷 No photos yet</div>';
    } else {
        galleryPhotos.forEach(function(p) {
            galleryHTML += `<div class="gallery-item"><img src="${p.path}" alt="Gallery photo" loading="lazy"></div>`;
        });
    }

    let musicSectionHTML = '';
    if (coverSongs.length > 0) {
        let songListHTML = '';
        coverSongs.forEach(function(s, i) {
            songListHTML += `
            <div class="song-item" id="song-${i}" onclick="playSong('${s.audioUrl}','${s.title}','${s.artist}','${s.coverUrl || ''}',${i})">
                <span class="song-num">${String(i+1).padStart(2,'0')}</span>
                <div class="song-info">
                    <div class="song-title">${s.title}</div>
                    <div class="song-artist">${s.artist}</div>
                </div>
                <span class="song-play">▶</span>
            </div>`;
        });

        musicSectionHTML = `
        <section id="music" class="music-section card">
            <div class="music-header">
                <img src="${IMAGES.voiceMic}" class="music-mic" alt="Music">
                <span class="music-title">Cover Music</span>
                <span class="music-count">${coverSongs.length} tracks</span>
            </div>
            <div class="music-player">
                <div class="album-art" id="albumArt"><span>🎵</span></div>
                <div class="music-info">
                    <div id="currentTitle" class="current-title">Select a Song</div>
                    <div id="currentArtist" class="current-artist">Cover Music</div>
                </div>
                <button class="play-pause-btn" id="playBtn" onclick="togglePlay()">▶️</button>
            </div>
            <div class="progress-area">
                <span id="currentTime">0:00</span>
                <div class="progress-bar" onclick="seekAudio(event)">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <span id="totalTime">0:00</span>
            </div>
            <div class="song-list">${songListHTML}</div>
            <audio id="coverAudio" preload="none"></audio>
        </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <meta name="theme-color" content="#ffffff">
    <title>Baiilla Maach | Verification Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f5f5f7;
            --surface: #ffffff;
            --surface-hover: #f9f9fb;
            --text: #1c1c1e;
            --text-secondary: #6e6e73;
            --text-tertiary: #aeaeb2;
            --primary: #007aff;
            --primary-light: #e8f1ff;
            --danger: #ff3b30;
            --danger-light: #ffe5e5;
            --success: #34c759;
            --success-light: #e5f9e7;
            --warning: #ff9500;
            --warning-light: #fff4e5;
            --purple: #af52de;
            --purple-light: #f3e8ff;
            --border: #e5e5ea;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
            --radius-sm: 10px;
            --radius: 16px;
            --radius-lg: 20px;
            --radius-xl: 24px;
            --font-xs: 11px;
            --font-sm: 13px;
            --font-md: 15px;
            --font-lg: 17px;
            --font-xl: 22px;
            --font-2xl: 28px;
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
            -webkit-font-smoothing: antialiased;
            line-height: 1.5;
        }

        /* Header */
        .header {
            background: rgba(255,255,255,0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            padding: 12px 0;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-inner {
            max-width: 860px;
            margin: 0 auto;
            padding: 0 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-brand {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header-brand img {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--primary);
        }

        .header-brand span {
            font-weight: 700;
            font-size: var(--font-md);
            color: var(--text);
        }

        .header-nav {
            display: flex;
            gap: 4px;
        }

        .header-nav a {
            padding: 8px 14px;
            border-radius: 20px;
            font-size: var(--font-xs);
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s;
            white-space: nowrap;
        }

        .header-nav a:active {
            transform: scale(0.95);
        }

        .nav-danger {
            color: var(--danger);
            background: var(--danger-light);
        }

        .nav-success {
            color: var(--success);
            background: var(--success-light);
        }

        .nav-purple {
            color: var(--purple);
            background: var(--purple-light);
        }

        /* Main Content */
        .main-content {
            max-width: 860px;
            margin: 0 auto;
            padding: 20px 16px 100px;
        }

        /* Cards */
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 20px;
            margin-bottom: 16px;
            transition: all 0.2s;
        }

        .card:active {
            transform: scale(0.99);
            background: var(--surface-hover);
        }

        .card-danger {
            border-left: 4px solid var(--danger);
        }

        .card-success {
            border-left: 4px solid var(--success);
        }

        /* Profile */
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
            width: 110px;
            height: 110px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid var(--primary);
            box-shadow: 0 0 0 4px var(--primary-light);
        }

        .verified-badge {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 30px;
            height: 30px;
            background: var(--success);
            border-radius: 50%;
            border: 3px solid #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 14px;
            font-weight: bold;
        }

        .profile-name {
            font-size: var(--font-2xl);
            font-weight: 800;
            margin-top: 8px;
            color: var(--text);
        }

        .profile-bio {
            color: var(--text-secondary);
            font-size: var(--font-sm);
            margin-top: 4px;
        }

        /* Stats */
        .stats-row {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin: 20px 0;
        }

        .stat-item {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 14px 20px;
            text-align: center;
            min-width: 80px;
        }

        .stat-value {
            font-size: var(--font-lg);
            font-weight: 700;
            color: var(--primary);
        }

        .stat-label {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 2px;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: var(--font-xs);
            font-weight: 600;
        }

        .badge-success {
            background: var(--success-light);
            color: var(--success);
        }

        .badge-purple {
            background: var(--purple-light);
            color: var(--purple);
        }

        .badge-danger {
            background: var(--danger-light);
            color: var(--danger);
        }

        /* Section Headers */
        .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--border);
        }

        .section-icon {
            width: 44px;
            height: 44px;
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .section-icon-danger { background: var(--danger-light); }
        .section-icon-success { background: var(--success-light); }
        .section-icon-warning { background: var(--warning-light); }

        .section-title {
            font-size: var(--font-lg);
            font-weight: 700;
        }

        .section-subtitle {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
            margin-top: 2px;
        }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: 600;
            font-size: var(--font-sm);
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: all 0.2s;
            min-height: 40px;
            -webkit-user-select: none;
            user-select: none;
        }

        .btn:active {
            transform: scale(0.96);
        }

        .btn-primary {
            background: var(--primary);
            color: #fff;
        }

        .btn-danger {
            background: var(--danger);
            color: #fff;
        }

        .btn-outline {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-secondary);
        }

        .btn-sm {
            padding: 6px 14px;
            font-size: var(--font-xs);
            min-height: 32px;
        }

        /* Fake Cards */
        .fake-card-inner {
            display: flex;
            gap: 14px;
            align-items: flex-start;
        }

        .fake-img {
            width: 60px;
            height: 60px;
            border-radius: var(--radius-sm);
            object-fit: cover;
            border: 2px solid var(--danger-light);
            flex-shrink: 0;
        }

        .fake-img-placeholder {
            width: 60px;
            height: 60px;
            border-radius: var(--radius-sm);
            background: var(--danger-light);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            flex-shrink: 0;
        }

        .fake-info {
            flex: 1;
            min-width: 0;
        }

        .fake-username {
            font-weight: 700;
            font-size: var(--font-md);
            color: var(--danger);
            margin-bottom: 4px;
        }

        .fake-reason {
            font-size: var(--font-xs);
            color: var(--text-secondary);
            margin-bottom: 8px;
            line-height: 1.4;
        }

        .fake-actions {
            display: flex;
            gap: 8px;
        }

        /* Official Cards */
        .official-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
        }

        .platform-icon {
            width: 24px;
            height: 24px;
            flex-shrink: 0;
        }

        .official-info {
            flex: 1;
            min-width: 0;
        }

        .official-username {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            font-size: var(--font-md);
        }

        .verified-tick {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }

        .official-followers {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
            margin-top: 2px;
        }

        /* Gallery */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 10px;
        }

        .gallery-item {
            border-radius: var(--radius);
            overflow: hidden;
            aspect-ratio: 1;
            border: 1px solid var(--border);
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .gallery-empty {
            text-align: center;
            padding: 40px;
            color: var(--text-tertiary);
            grid-column: 1/-1;
        }

        /* Warning Section */
        .warning-section {
            text-align: center;
            padding: 24px;
            background: var(--warning-light);
            border: 1px solid rgba(255,149,0,0.2);
            border-radius: var(--radius-lg);
        }

        .warning-section img {
            max-width: 100%;
            border-radius: var(--radius);
            margin-bottom: 12px;
        }

        /* Music Player */
        .music-section {
            background: linear-gradient(135deg, #f3e8ff, #e8f1ff);
        }

        .music-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
        }

        .music-mic {
            width: 28px;
            height: 28px;
        }

        .music-title {
            font-weight: 700;
            font-size: var(--font-md);
        }

        .music-count {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
            margin-left: auto;
        }

        .music-player {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 12px;
        }

        .album-art {
            width: 70px;
            height: 70px;
            border-radius: var(--radius);
            background: rgba(0,0,0,0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            flex-shrink: 0;
            overflow: hidden;
            border: 2px solid var(--border);
        }

        .album-art img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .album-art.playing {
            animation: spin 4s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .music-info {
            flex: 1;
            min-width: 0;
        }

        .current-title {
            font-weight: 600;
            font-size: var(--font-md);
        }

        .current-artist {
            font-size: var(--font-xs);
            color: var(--text-secondary);
            margin-top: 2px;
        }

        .play-pause-btn {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--primary);
            color: #fff;
            border: none;
            font-size: 20px;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.2s;
        }

        .play-pause-btn:active {
            transform: scale(0.9);
        }

        .progress-area {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: var(--font-xs);
            color: var(--text-tertiary);
            margin-bottom: 14px;
        }

        .progress-bar {
            flex: 1;
            height: 4px;
            background: rgba(0,0,0,0.1);
            border-radius: 2px;
            cursor: pointer;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 2px;
            width: 0%;
            transition: width 0.1s linear;
        }

        .song-list {
            max-height: 200px;
            overflow-y: auto;
        }

        .song-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all 0.15s;
        }

        .song-item:active {
            background: rgba(0,0,0,0.05);
        }

        .song-item.active {
            background: var(--primary-light);
            border: 1px solid var(--primary);
        }

        .song-num {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
            width: 24px;
        }

        .song-info {
            flex: 1;
        }

        .song-title {
            font-weight: 500;
            font-size: var(--font-sm);
        }

        .song-artist {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
        }

        .song-play {
            font-size: var(--font-xs);
            color: var(--text-tertiary);
        }

        /* Toast */
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 14px 20px;
            border-radius: var(--radius);
            font-size: var(--font-sm);
            font-weight: 500;
            box-shadow: var(--shadow-md);
            transform: translateX(120%);
            transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
            max-width: 90vw;
        }

        .toast.show {
            transform: translateX(0);
        }

        .toast.success {
            border-left: 3px solid var(--success);
        }

        .toast.error {
            border-left: 3px solid var(--danger);
        }

        /* Chat Widget */
        .chat-widget {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99;
        }

        .chat-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: 28px;
            font-weight: 600;
            font-size: var(--font-sm);
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,122,255,0.3);
            transition: all 0.2s;
            text-decoration: none;
        }

        .chat-btn:active {
            transform: scale(0.95);
        }

        .chat-btn img {
            width: 30px;
            height: 30px;
            border-radius: 50%;
        }

        /* Responsive */
        @media (max-width: 640px) {
            .header-nav {
                display: none;
            }
            
            .stats-row {
                gap: 8px;
            }
            
            .stat-item {
                padding: 10px 14px;
                min-width: 65px;
            }
            
            .card {
                padding: 16px;
            }
            
            .profile-pic {
                width: 90px;
                height: 90px;
            }
            
            .profile-name {
                font-size: var(--font-xl);
            }
        }
    </style>
</head>
<body>
    <div id="toast" class="toast"></div>

    <header class="header">
        <div class="header-inner">
            <div class="header-brand">
                <img src="${profilePic}" alt="Logo">
                <span>Verification Hub</span>
            </div>
            <nav class="header-nav">
                <a href="#fake" class="nav-danger">⚠ Fakes</a>
                ${coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : ''}
                <a href="#warning" class="nav-purple">🔍 Detection</a>
                <a href="#official" class="nav-success">✓ Official</a>
                <a href="#gallery" class="nav-purple">📸 Gallery</a>
            </nav>
        </div>
    </header>

    <main class="main-content">
        <!-- Profile -->
        <section class="profile-section">
            <div class="profile-pic-wrap">
                <img src="${profilePic}" class="profile-pic" alt="Profile">
                <div class="verified-badge">✓</div>
            </div>
            <h1 class="profile-name">${DATA.celebrity.fullName}</h1>
            <p class="profile-bio">${DATA.celebrity.bio}</p>
            <div class="stats-row">
                <div class="stat-item">
                    <div class="stat-value">${DATA.celebrity.tiktokFollowers}</div>
                    <div class="stat-label">Followers</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${DATA.celebrity.tiktokFollowing}</div>
                    <div class="stat-label">Following</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${DATA.celebrity.tiktokLikes}</div>
                    <div class="stat-label">Likes</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                <span class="badge badge-success">✓ Verified Creator</span>
                <span class="badge badge-purple">Official Account</span>
            </div>
        </section>

        <!-- Fake Accounts -->
        <section id="fake" class="card card-danger">
            <div class="section-header">
                <div class="section-icon section-icon-danger">⚠️</div>
                <div>
                    <div class="section-title" style="color:var(--danger)">Fake Accounts Detected</div>
                    <div class="section-subtitle">Report these impersonating accounts</div>
                </div>
                <span class="badge badge-danger" style="margin-left:auto">${totalFake} Active</span>
            </div>
            ${fakeCardsHTML}
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                <button class="btn btn-danger btn-sm" onclick="toggleFakeVoice()">🔊 Play Alert</button>
            </div>
            <audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
        </section>

        ${musicSectionHTML}

        <!-- Warning -->
        <section id="warning" class="warning-section">
            <img src="${IMAGES.fakeDetect}" alt="Detection Guide" loading="lazy">
            <div style="margin-top:12px">
                <span class="badge badge-purple">🔍 Fake Account Detection Guide</span>
            </div>
            <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:10px;line-height:1.5">
                Always check for the verified badge before interacting. Report suspicious accounts immediately.
            </p>
        </section>

        <!-- Official Accounts -->
        <section id="official" class="card card-success">
            <div class="section-header">
                <div class="section-icon section-icon-success">✓</div>
                <div>
                    <div class="section-title" style="color:var(--success)">Official Verified Accounts</div>
                    <div class="section-subtitle">Only follow these real accounts</div>
                </div>
            </div>
            ${officialCardsHTML}
        </section>

        <!-- Gallery -->
        <section id="gallery" class="card">
            <div class="section-header">
                <span style="font-size:22px">📸</span>
                <div>
                    <div class="section-title">Photo Gallery</div>
                    <div class="section-subtitle">Official moments</div>
                </div>
            </div>
            <div class="gallery-grid">${galleryHTML}</div>
        </section>
    </main>

    <div class="chat-widget">
        <a href="/chat" class="chat-btn" target="_blank">
            <img src="${IMAGES.messageIcon}" alt="Chat">
            <span>💬 Chat Now</span>
        </a>
    </div>

    <audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

    <script>
        function showToast(msg, type) {
            var t = document.getElementById('toast');
            t.textContent = msg;
            t.className = 'toast show ' + (type || '');
            clearTimeout(t._timeout);
            t._timeout = setTimeout(function() { t.classList.remove('show'); }, 2500);
        }

        function copyText(txt) {
            navigator.clipboard.writeText(txt).then(function() {
                showToast('Copied!', 'success');
            }).catch(function() {
                showToast('Failed to copy', 'error');
            });
        }

        // Fake voice
        var fv = document.getElementById('fakeVoice');
        var fvp = false;

        function toggleFakeVoice() {
            if (fvp) {
                fv.pause();
                fv.currentTime = 0;
                fvp = false;
                return;
            }
            fv.play().then(function() {
                fvp = true;
            }).catch(function() {
                showToast('Audio error', 'error');
            });
        }

        fv.addEventListener('ended', function() { fvp = false; });

        // Music player
        var ca = null;
        var ip = false;
        var ad = document.getElementById('coverAudio');
        var pb = document.getElementById('playBtn');
        var ar = document.getElementById('albumArt');
        var pf = document.getElementById('progressFill');
        var ct = document.getElementById('currentTime');
        var tt = document.getElementById('totalTime');

        function playSong(url, title, artist, cover, idx) {
            if (ca === url) { togglePlay(); return; }
            if (ca) ad.pause();
            ca = url;
            ad.src = url;
            document.getElementById('currentTitle').textContent = title;
            document.getElementById('currentArtist').textContent = artist;
            ar.innerHTML = cover ? '<img src="' + cover + '" style="width:100%;height:100%;object-fit:cover">' : '<span>🎵</span>';
            pf.style.width = '0%';
            ct.textContent = '0:00';
            tt.textContent = '0:00';
            document.querySelectorAll('.song-item').forEach(function(e) { e.classList.remove('active'); });
            var si = document.getElementById('song-' + idx);
            if (si) si.classList.add('active');
            ad.play().then(function() {
                ip = true;
                pb.textContent = '⏸️';
                ar.classList.add('playing');
            }).catch(function() {
                showToast('Playback error', 'error');
            });
        }

        function togglePlay() {
            if (!ad.src) { showToast('Select a song', 'error'); return; }
            if (ip) {
                ad.pause();
                ip = false;
                pb.textContent = '▶️';
                ar.classList.remove('playing');
            } else {
                ad.play().then(function() {
                    ip = true;
                    pb.textContent = '⏸️';
                    ar.classList.add('playing');
                }).catch(function() {});
            }
        }

        function seekAudio(e) {
            if (!ad.duration) return;
            var rect = e.currentTarget.getBoundingClientRect();
            ad.currentTime = ((e.clientX - rect.left) / rect.width) * ad.duration;
        }

        function fmtTime(s) {
            if (isNaN(s)) return '0:00';
            return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0');
        }

        ad.addEventListener('timeupdate', function() {
            if (ad.duration) {
                pf.style.width = (ad.currentTime/ad.duration)*100 + '%';
                ct.textContent = fmtTime(ad.currentTime);
            }
        });

        ad.addEventListener('loadedmetadata', function() {
            tt.textContent = fmtTime(ad.duration);
        });

        ad.addEventListener('ended', function() {
            ip = false;
            pb.textContent = '▶️';
            ar.classList.remove('playing');
            pf.style.width = '0%';
            ct.textContent = '0:00';
            ca = null;
        });

        // Welcome voice
        setTimeout(function() {
            var wv = document.getElementById('welcomeVoice');
            if (wv && !sessionStorage.getItem('vp')) {
                wv.play().catch(function() {});
                sessionStorage.setItem('vp', '1');
            }
        }, 2000);
    </script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Admin Login</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
        .login-box{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:380px;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #e5e5ea}
        h2{text-align:center;margin-bottom:24px;font-size:22px;color:#1c1c1e}
        .error{background:#ffe5e5;color:#ff3b30;padding:12px;border-radius:10px;margin-bottom:16px;font-size:13px;text-align:center}
        label{display:block;font-size:13px;font-weight:500;color:#3a3a3c;margin-bottom:6px}
        input{width:100%;padding:14px;border:1px solid #d1d1d6;border-radius:12px;font-size:16px;margin-bottom:16px;background:#f9f9fb}
        input:focus{outline:none;border-color:#007aff;box-shadow:0 0 0 3px rgba(0,122,255,0.1)}
        button{width:100%;padding:16px;background:#007aff;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer}
        button:active{transform:scale(0.98)}
        a{display:block;text-align:center;color:#8e8e93;margin-top:16px;font-size:14px;text-decoration:none}
    </style>
</head>
<body>
    <div class="login-box">
        <h2>🔐 Admin Login</h2>
        ${error ? '<div class="error">' + error + '</div>' : ''}
        <form method="POST" action="/admin/login">
            <label>Username</label>
            <input name="username" placeholder="Enter username" required autofocus>
            <label>Password</label>
            <input type="password" name="password" placeholder="Enter password" required>
            <button type="submit">Sign In</button>
        </form>
        <a href="/">← Back to site</a>
    </div>
</body>
</html>`;
}

async function getAdminPanelHTML(photos, message, error) {
    photos = photos || [];
    message = message || '';
    error = error || '';
    const chatList = getAdminChatList();
    const totalUnread = chatList.reduce((s, c) => s + c.unread, 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Admin Panel</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;background:#f5f5f7;min-height:100vh;color:#1c1c1e}
        header{background:#fff;border-bottom:1px solid #e5e5ea;padding:12px 16px;position:sticky;top:0;z-index:100}
        .header-inner{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
        h1{font-size:18px;color:#007aff}
        .header-nav{display:flex;gap:8px}
        .header-nav a{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;text-decoration:none;transition:all 0.2s}
        .header-nav a:active{transform:scale(0.95)}
        .btn-chat{background:#007aff;color:#fff;position:relative}
        .badge{position:absolute;top:-6px;right:-6px;background:#ff3b30;color:#fff;width:20px;height:20px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center}
        .btn-site{background:#e5e5ea;color:#1c1c1e}
        .btn-logout{background:#ffe5e5;color:#ff3b30}
        .container{max-width:1100px;margin:0 auto;padding:20px 16px}
        .msg{ padding:14px;border-radius:12px;margin-bottom:16px;font-size:14px}
        .msg-success{background:#e5f9e7;color:#34c759;border:1px solid #c8f0cc}
        .msg-error{background:#ffe5e5;color:#ff3b30;border:1px solid #ffcccc}
        .card{background:#fff;border:1px solid #e5e5ea;border-radius:16px;padding:20px;margin-bottom:16px}
        .card h2{font-size:16px;margin-bottom:16px;color:#007aff}
        input[type="file"]{margin-bottom:12px}
        input[type="text"]{width:100%;padding:12px;border:1px solid #d1d1d6;border-radius:10px;font-size:14px;margin-bottom:12px;background:#f9f9fb}
        input[type="text"]:focus{outline:none;border-color:#007aff}
        .btn-upload{width:100%;padding:14px;background:#007aff;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
        .btn-upload:active{transform:scale(0.98)}
        .gallery-title{font-size:20px;font-weight:700;margin-bottom:16px}
        .gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
        .gallery-card{background:#fff;border:1px solid #e5e5ea;border-radius:14px;overflow:hidden}
        .gallery-card img{width:100%;height:180px;object-fit:cover;display:block}
        .gallery-card-body{padding:12px}
        .gallery-card-body p{font-size:13px;color:#6e6e73;margin-bottom:8px}
        .btn-delete{background:none;border:1px solid #ffcccc;color:#ff3b30;padding:6px 12px;border-radius:16px;font-size:12px;cursor:pointer}
        .btn-delete:hover{background:#ffe5e5}
        @media(max-width:640px){.gallery-grid{grid-template-columns:1fr}}
    </style>
</head>
<body>
    <header>
        <div class="header-inner">
            <h1>⚡ Admin Panel</h1>
            <div class="header-nav">
                <a href="/admin/chat" class="btn-chat">💬 Chats ${totalUnread > 0 ? '<span class="badge">' + totalUnread + '</span>' : ''}</a>
                <a href="/" class="btn-site">🌐 Site</a>
                <a href="/admin/logout" class="btn-logout">🚪 Logout</a>
            </div>
        </div>
    </header>
    <div class="container">
        ${message ? '<div class="msg msg-success">✓ ' + message + '</div>' : ''}
        ${error ? '<div class="msg msg-error">⚠ ' + error + '</div>' : ''}
        <div class="card">
            <h2>📤 Upload Photo</h2>
            <form method="POST" action="/admin/upload" enctype="multipart/form-data">
                <input type="file" name="photo" accept="image/*" required>
                <input type="text" name="caption" placeholder="Photo caption (optional)">
                <button type="submit" class="btn-upload">Upload Photo</button>
            </form>
        </div>
        <div class="gallery-title">📸 Gallery (${photos.length} photos)</div>
        <div class="gallery-grid">
            ${photos.length === 0 ? '<div style="text-align:center;padding:40px;color:#aeaeb2;grid-column:1/-1">📭 No photos yet</div>' : photos.map(p => `
                <div class="gallery-card">
                    <img src="${p.path}" alt="Photo" loading="lazy">
                    <div class="gallery-card-body">
                        <p>${p.caption || 'No caption'}</p>
                        <form method="POST" action="/admin/delete" onsubmit="return confirm('Delete this photo?')">
                            <input type="hidden" name="photoId" value="${p._id}">
                            <button type="submit" class="btn-delete">🗑 Delete</button>
                        </form>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
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
    
    // Static assets
    if (pn.startsWith('/assets/')) {
        const ap = path.join(__dir, decodeURIComponent(pn));
        if (!ap.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(ap)) {
            const e = path.extname(ap).toLowerCase();
            const t = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.webm':'audio/webm' };
            res.writeHead(200, { 'Content-Type': t[e] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
            fs.createReadStream(ap).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    
    // Chat page
    if (pn === '/chat' && m === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getChatPageHTML());
        return;
    }
    
    // API: Register
    if (pn === '/api/chat/register' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(b);
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Name and contact required' })); return; }
                const u = createOrGetChatUser(name, phoneEmail);
                if (!u) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const t = createChatSession(u.chatId);
                if (getChatMessages(u.chatId).length === 0) { saveChatMessage(u.chatId, 'admin', 'Hello! How can I help you? 👋'); }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: u.chatId, token: t, name, phoneEmail }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
        }); return;
    }
    
    // API: Verify
    if (pn === '/api/chat/verify' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!u, chatId: u ? u.chatId : null }));
        return;
    }
    
    // API: Messages
    if (pn === '/api/chat/messages' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(u.chatId) }));
        return;
    }
    
    // API: Send
    if (pn === '/api/chat/send' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { token, message, type, fileUrl, fileName, duration } = JSON.parse(b);
            const u = getChatUserByToken(token);
            if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            saveChatMessage(u.chatId, 'user', message, type, fileUrl, fileName, duration);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    // Admin
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
    
    // Admin chat
    if (pn === '/admin/chat' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
        const cid = pu.query.chatId;
        const cl = getAdminChatList();
        let ms = [];
        if (cid) { ms = getChatMessages(cid); markMessagesRead(cid); }
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Admin Chat</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;display:flex;height:100vh;background:#f5f5f7;color:#1c1c1e}
        .sidebar{width:320px;background:#fff;border-right:1px solid #e5e5ea;overflow-y:auto;flex-shrink:0}
        .sidebar-header{padding:14px;background:#007aff;color:#fff;font-weight:600;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0}
        .sidebar-header button{background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:10px;cursor:pointer;font-size:12px}
        .sidebar-item{padding:14px;cursor:pointer;border-bottom:1px solid #f0f0f5;transition:all 0.15s}
        .sidebar-item:active{background:#f0f0f5}
        .sidebar-item.active{background:#e8f1ff;border-left:3px solid #007aff}
        .sidebar-item-name{font-weight:600;font-size:14px;display:flex;justify-content:space-between}
        .sidebar-item-contact{font-size:12px;color:#8e8e93;margin-top:2px}
        .sidebar-item-preview{font-size:11px;color:#aeaeb2;margin-top:2px}
        .unread-count{background:#ff3b30;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px}
        .main{flex:1;display:flex;flex-direction:column;min-width:0}
        .chat-header{padding:14px 16px;background:#fff;border-bottom:1px solid #e5e5ea;font-weight:600}
        .messages{flex:1;overflow-y:auto;padding:16px;background:#f9f9fb}
        .msg-row{margin-bottom:10px;display:flex}
        .msg-row.user{justify-content:flex-start}
        .msg-row.admin{justify-content:flex-end}
        .msg-bubble{max-width:70%;padding:8px 12px;border-radius:16px;font-size:14px;line-height:1.4}
        .msg-row.user .msg-bubble{background:#fff;border:1px solid #e5e5ea;border-bottom-left-radius:4px}
        .msg-row.admin .msg-bubble{background:#007aff;color:#fff;border-bottom-right-radius:4px}
        .msg-time{font-size:10px;opacity:0.5;margin-top:4px;text-align:right}
        .input-area{background:#fff;padding:10px 16px;border-top:1px solid #e5e5ea;display:flex;gap:8px}
        .input-area input{flex:1;padding:10px 16px;border:1px solid #d1d1d6;border-radius:20px;font-size:14px;background:#f9f9fb}
        .input-area input:focus{outline:none;border-color:#007aff}
        .input-area button{padding:10px 18px;background:#007aff;color:#fff;border:none;border-radius:20px;font-weight:600;cursor:pointer;font-size:13px}
        .input-area button:active{transform:scale(0.95)}
        @media(max-width:768px){.sidebar{position:absolute;top:0;left:0;bottom:0;z-index:10;width:100%}.sidebar.hidden{display:none}.main{position:absolute;top:0;left:0;right:0;bottom:0;z-index:20;background:#f5f5f7}}
    </style>
</head>
<body>
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <span>💬 Chats</span>
            <div style="display:flex;gap:6px">
                <button onclick="location.reload()">↻</button>
                <a href="/admin" style="color:#fff;font-size:12px;text-decoration:none;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:10px">Back</a>
            </div>
        </div>
        ${cl.map(c => `
            <div class="sidebar-item${c.chatId === cid ? ' active' : ''}" onclick="location.href='/admin/chat?chatId=${c.chatId}'">
                <div class="sidebar-item-name">
                    <span>${c.name}</span>
                    ${c.unread > 0 ? '<span class="unread-count">' + c.unread + '</span>' : ''}
                </div>
                <div class="sidebar-item-contact">${c.phoneEmail}</div>
                <div class="sidebar-item-preview">${c.lastMessage ? c.lastMessage.message.substring(0,25) : 'No messages'}</div>
            </div>
        `).join('')}
    </div>
    <div class="main">
        ${cid ? `
            <div class="chat-header">
                <button onclick="document.getElementById('sidebar').classList.toggle('hidden')" style="display:none;background:none;border:none;font-size:18px;cursor:pointer;margin-right:8px" class="back-btn">←</button>
                ${cl.find(c => c.chatId === cid) ? cl.find(c => c.chatId === cid).name : ''}
            </div>
            <div class="messages" id="mc">
                ${ms.map(m => {
                    const cls = m.sender === 'user' ? 'user' : 'admin';
                    const time = new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                    return '<div class="msg-row ' + cls + '"><div class="msg-bubble">' + m.message + '<div class="msg-time">' + time + '</div></div></div>';
                }).join('')}
            </div>
            <div class="input-area">
                <input id="am" placeholder="Type reply..." onkeypress="if(event.key==='Enter')sendMsg()">
                <button onclick="sendMsg()">Send</button>
            </div>
        ` : `
            <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#aeaeb2">
                <div style="font-size:48px;margin-bottom:12px">💬</div>
                <div>Select a chat</div>
            </div>
        `}
    </div>
    <script>
        var cid = "${cid}";
        function sendMsg() {
            var inp = document.getElementById('am');
            var msg = inp.value.trim();
            if (!msg) return;
            fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:cid,message:msg,type:'text'})})
            .then(function(){inp.value='';loadMsgs();});
        }
        function loadMsgs() {
            fetch('/api/admin/messages?chatId='+cid).then(function(r){return r.json()}).then(function(d){
                if(d.success){
                    var h='';
                    d.messages.forEach(function(m){
                        var c=m.sender==='user'?'user':'admin';
                        var t=new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
                        h+='<div class="msg-row '+c+'"><div class="msg-bubble">'+m.message+'<div class="msg-time">'+t+'</div></div></div>';
                    });
                    document.getElementById('mc').innerHTML=h;
                    document.getElementById('mc').scrollTop=document.getElementById('mc').scrollHeight;
                }
            });
        }
        setInterval(loadMsgs,2000);
        if(cid) loadMsgs();
    </script>
</body>
</html>`);
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
    
    // Main page
    if (pn === '/' || pn === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(await getGalleryPhotos()));
        return;
    }
    
    res.writeHead(404);
    res.end('404 Not Found');
});

async function start() {
    const dbOk = await connectDB();
    console.log(dbOk ? '✅ MongoDB Connected' : '⚠️ Using memory storage');
    server.listen(PORT, () => {
        console.log('🚀 Server: http://localhost:' + PORT);
        console.log('💬 Chat: http://localhost:' + PORT + '/chat');
        console.log('🔐 Admin: http://localhost:' + PORT + '/admin');
    });
}

start().catch(console.error);

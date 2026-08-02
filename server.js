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

// ============ CHAT PAGE LOADER ============
let chatPageHTML = '';
try {
    const { getChatPageHTML } = require('./chat');
    chatPageHTML = getChatPageHTML();
    console.log('✅ chat.js loaded successfully');
} catch(e) {
    console.log('⚠️ chat.js not found, creating default chat page');
    chatPageHTML = getDefaultChatHTML();
}

function getDefaultChatHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#0f0f1a">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Chat - Baiilla Maach Official</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root{--bg:#0a0a14;--surface:#13132b;--white:#ffffff;--text:#f0f0ff;--text-dark:#1a1a2e;--text-gray:#666;--purple:#8b5cf6;--purple-dark:#6d28d9;--green:#10b981;--red:#ef4444;--glass:rgba(255,255,255,0.06);--glow:0 0 40px rgba(139,92,246,0.3)}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);height:100vh;display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
        
        .chat-header{background:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(139,92,246,0.1);box-shadow:0 2px 20px rgba(139,92,246,0.1);z-index:10}
        .back-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0}
        .user-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--purple);flex-shrink:0}
        .user-info{flex:1;min-width:0}
        .user-name{font-weight:700;font-size:16px;color:var(--text-dark);letter-spacing:-0.3px}
        .user-status{font-size:12px;color:var(--green);display:flex;align-items:center;gap:4px;font-weight:500}
        .online-dot{width:8px;height:8px;background:var(--green);border-radius:50%;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        
        .messages-container{flex:1;overflow-y:auto;padding:20px;background:linear-gradient(180deg,#0f0f1f 0%,#0a0a14 100%)}
        .msg-row{margin-bottom:16px;display:flex;animation:slideUp 0.3s ease-out}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .msg-row.user{justify-content:flex-end}
        .msg-row.support{justify-content:flex-start}
        .bubble{max-width:75%;padding:12px 16px;border-radius:20px;font-size:14px;line-height:1.5;word-wrap:break-word;font-weight:400}
        .msg-row.user .bubble{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border-bottom-right-radius:4px;box-shadow:0 4px 15px rgba(139,92,246,0.3);font-weight:500}
        .msg-row.support .bubble{background:#fff;color:var(--text-dark);border-bottom-left-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-weight:500}
        .msg-time{font-size:10px;opacity:0.7;margin-top:4px}
        .msg-row.user .msg-time{text-align:right;color:rgba(255,255,255,0.7)}
        .msg-row.support .msg-time{color:var(--text-gray)}
        
        .bubble img{max-width:250px;max-height:250px;border-radius:12px;cursor:pointer}
        .voice-bubble{display:flex;align-items:center;gap:10px;min-width:150px}
        .voice-play-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:14px;cursor:pointer;flex-shrink:0}
        .voice-wave{display:flex;align-items:center;gap:2px;flex:1;height:24px}
        .voice-bar{width:3px;background:var(--purple);border-radius:2px;animation:voiceAnim 1s ease-in-out infinite}
        @keyframes voiceAnim{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.3)}}
        
        .input-area{background:#fff;padding:12px 16px;display:flex;align-items:flex-end;gap:10px;border-top:1px solid rgba(139,92,246,0.1);box-shadow:0 -2px 20px rgba(0,0,0,0.05)}
        .attach-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0;box-shadow:var(--glow)}
        .msg-input{flex:1;padding:12px 16px;background:#f5f3ff;border:2px solid transparent;border-radius:24px;font-size:14px;font-family:inherit;outline:none;resize:none;max-height:100px;transition:all 0.3s}
        .msg-input:focus{border-color:var(--purple);background:#fff}
        .send-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;padding:12px 24px;border-radius:24px;font-weight:600;font-size:14px;cursor:pointer;box-shadow:var(--glow);font-family:inherit;white-space:nowrap}
        
        .permission-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:999;align-items:center;justify-content:center;backdrop-filter:blur(10px)}
        .permission-overlay.active{display:flex}
        .permission-card{background:#fff;border-radius:24px;padding:32px 24px;max-width:340px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
        .perm-icon{font-size:48px;margin-bottom:16px}
        .perm-title{font-weight:700;font-size:20px;color:var(--text-dark);margin-bottom:8px}
        .perm-text{font-size:14px;color:var(--text-gray);margin-bottom:24px;line-height:1.6}
        .btn-allow{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;padding:14px;border-radius:16px;font-weight:600;font-size:15px;cursor:pointer;box-shadow:var(--glow);font-family:inherit;width:100%;margin-bottom:8px}
        .btn-deny{background:transparent;color:var(--text-gray);border:1px solid #e0e0e0;padding:14px;border-radius:16px;font-weight:500;font-size:14px;cursor:pointer;font-family:inherit;width:100%}
        
        .image-fullscreen{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:1000;align-items:center;justify-content:center;cursor:pointer}
        .image-fullscreen.active{display:flex}
        .image-fullscreen img{max-width:95%;max-height:95%;border-radius:12px}
        
        @media(max-width:480px){.bubble{max-width:85%}}
    </style>
</head>
<body>
    <div class="chat-header">
        <button class="back-btn" onclick="history.back()">←</button>
        <img src="/assets/tiktok_video_Aj2NO.jpeg" class="user-avatar" alt="Baiilla Maach">
        <div class="user-info">
            <div class="user-name">Baiilla Maach</div>
            <div class="user-status"><span class="online-dot"></span>Online now</div>
        </div>
    </div>
    
    <div class="messages-container" id="messagesContainer"></div>
    
    <div class="input-area">
        <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFileUpload(event)">
        <button class="attach-btn" onclick="requestPhotoPermission()">📎</button>
        <textarea id="messageInput" class="msg-input" placeholder="Type a message..." rows="1" onkeypress="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>
        <button class="send-btn" onclick="sendMessage()">Send</button>
    </div>
    
    <div class="permission-overlay" id="permissionOverlay">
        <div class="permission-card" id="permissionCard"></div>
    </div>
    
    <div class="image-fullscreen" id="imageFullscreen" onclick="this.classList.remove('active')">
        <img id="fullscreenImg" src="" alt="Preview">
    </div>
    
    <script>
        let token = null;
        let chatId = null;
        
        async function init() {
            const params = new URLSearchParams(window.location.search);
            token = params.get('token');
            chatId = params.get('chatId');
            
            if (!token || !chatId) {
                document.getElementById('messagesContainer').innerHTML = '<div style="text-align:center;padding:40px;opacity:0.6">Please access this chat from the main page</div>';
                return;
            }
            
            localStorage.setItem('chatToken', token);
            localStorage.setItem('chatId', chatId);
            loadMessages();
            setInterval(loadMessages, 3000);
        }
        
        async function loadMessages() {
            try {
                const res = await fetch('/api/chat/messages?token=' + token);
                const data = await res.json();
                if (!data.success) return;
                
                const container = document.getElementById('messagesContainer');
                let html = data.messages.map(m => {
                    let cls = m.sender === 'user' ? 'user' : 'support';
                    let content = '';
                    if (m.type === 'image' && m.fileUrl) {
                        content = '<img src="'+m.fileUrl+'" onclick="showFullscreen(\''+m.fileUrl+'\')" loading="lazy">';
                    } else if (m.type === 'voice' && m.fileUrl) {
                        content = '<div class="voice-bubble"><button class="voice-play-btn" onclick="playVoice(\''+m.fileUrl+'\',this)">▶</button><div class="voice-wave">';
                        for (let i=0;i<12;i++) content += '<div class="voice-bar" style="animation-delay:'+(i*0.1)+'s;height:'+(8+Math.floor(Math.random()*14))+'px"></div>';
                        content += '</div>';
                        if (m.duration) content += '<span style="font-size:11px;opacity:0.6">'+m.duration+'s</span>';
                        content += '</div>';
                    } else {
                        content = m.message || '';
                    }
                    return '<div class="msg-row '+cls+'"><div class="bubble">'+content+'<div class="msg-time">'+formatTime(m.createdAt)+'</div></div></div>';
                }).join('');
                container.innerHTML = html;
                container.scrollTop = container.scrollHeight;
            } catch(e) { console.error(e); }
        }
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const msg = input.value.trim();
            if (!msg) return;
            
            try {
                await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ token, message: msg, type: 'text' })
                });
                input.value = '';
                loadMessages();
            } catch(e) { console.error(e); }
        }
        
        function requestPhotoPermission() {
            const overlay = document.getElementById('permissionOverlay');
            const card = document.getElementById('permissionCard');
            card.innerHTML = '<div class="perm-icon">📸</div><div class="perm-title">Access Your Photos</div><div class="perm-text">This allows you to share photos from your gallery. Your photos are only used for this chat.</div><button class="btn-allow" onclick="grantPhotoAccess()">Allow Access</button><button class="btn-deny" onclick="closePermission()">Not Now</button>';
            overlay.classList.add('active');
        }
        
        function grantPhotoAccess() {
            document.getElementById('permissionOverlay').classList.remove('active');
            document.getElementById('fileInput').click();
        }
        
        function closePermission() {
            document.getElementById('permissionOverlay').classList.remove('active');
        }
        
        async function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('photo', file);
            
            try {
                const res = await fetch('/api/chat/upload?token=' + token, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ token, message: '📷 Photo', type: 'image', fileUrl: data.fileUrl })
                    });
                    loadMessages();
                }
            } catch(e) { console.error(e); }
            event.target.value = '';
        }
        
        function showFullscreen(url) {
            document.getElementById('fullscreenImg').src = url;
            document.getElementById('imageFullscreen').classList.add('active');
        }
        
        let currentVoice = null;
        function playVoice(url, btn) {
            if (currentVoice && currentVoice.src === url && !currentVoice.paused) {
                currentVoice.pause();
                btn.textContent = '▶';
                return;
            }
            if (currentVoice) { currentVoice.pause(); document.querySelectorAll('.voice-play-btn').forEach(b => b.textContent = '▶'); }
            currentVoice = new Audio(url);
            currentVoice.play();
            btn.textContent = '⏸';
            currentVoice.onended = () => { btn.textContent = '▶'; };
            currentVoice.onpause = () => { btn.textContent = '▶'; };
        }
        
        function formatTime(date) {
            return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        init();
    </script>
</body>
</html>`;
}

// ============ IMAGES CONFIG ============
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

// ============ IN-MEMORY STORE ============
const adminPresence = { isOnline: false, lastSeen: null };
const memoryStore = {
    users: new Map(),
    sessions: new Map(),
    messages: new Map()
};

// ============ HELPER FUNCTIONS ============
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

// ============ DATABASE ============
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

// ============ CHAT FUNCTIONS ============
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

// ============ SESSION MANAGEMENT ============
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

// ============ DATA ============
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

// ============ MAIN PAGE HTML ============
function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;

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
'<meta name="apple-mobile-web-app-capable" content="yes">' +
'<title>Baiilla Maach | Verification Hub</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
'<style>' +
':root{--bg:#0a0a14;--surface:#13132b;--surface2:#1a1a35;--text:#f0f0ff;--text2:#a0a0cc;--text3:#6060a0;--purple:#8b5cf6;--purple2:#a78bfa;--pink:#ec4899;--green:#10b981;--red:#ef4444;--yellow:#eab308;--glass-border:rgba(255,255,255,0.06);--glow-purple:0 0 40px rgba(139,92,246,0.3);--glow-green:0 0 30px rgba(16,185,129,0.3);--glow-red:0 0 30px rgba(239,68,68,0.3);--glow-yellow:0 0 30px rgba(234,179,8,0.3)}' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}' +
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
'.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:50px;font-weight:600;font-size:13px;cursor:pointer;border:none;text-decoration:none;transition:all 0.3s;font-family:inherit}' +
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
'.chat-btn{width:auto;height:56px;border-radius:50px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;cursor:pointer;box-shadow:0 10px 40px rgba(139,92,246,0.4);display:flex;align-items:center;gap:10px;padding:0 20px;transition:all 0.3s;color:#fff;font-weight:600;font-size:14px;white-space:nowrap;text-decoration:none}' +
'.chat-btn:hover{transform:scale(1.05);box-shadow:0 15px 50px rgba(236,72,153,0.5)}' +
'.chat-btn img{width:34px;height:34px;border-radius:50%;flex-shrink:0}' +
'.chat-btn span{font-family:"Plus Jakarta Sans",sans-serif}' +
'@media(max-width:640px){.chat-widget{bottom:16px;right:16px}.header-nav{display:none}}' +
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
'<div class="chat-widget"><a href="/chat" class="chat-btn"><img src="' + IMAGES.messageIcon + '" alt="Chat"><span>💬 Chat Now</span></a></div>' +
'<script>(function(){var c=document.getElementById("starsBg");for(var i=0;i<80;i++){var s=document.createElement("div");s.className="star";s.style.cssText="left:"+Math.random()*100+"%;top:"+Math.random()*100+"%;width:"+(Math.random()*3+1)+"px;height:"+(Math.random()*3+1)+"px;--dur:"+(Math.random()*3+2)+"s;--delay:"+(Math.random()*5)+"s";c.appendChild(s)}})();function showToast(m,t){var e=document.getElementById("toast");e.textContent=m;e.className="toast show "+(t||"");setTimeout(function(){e.classList.remove("show")},2800)}function copyTxt(t){navigator.clipboard.writeText(t).then(function(){showToast("Copied!","success")})}var fvp=false,fa=document.getElementById("fakeVoice");function toggleFakeVoice(){var b=document.getElementById("voicePlayBtn"),s=document.getElementById("voiceStopBtn");if(fvp){fa.pause();fa.currentTime=0;fvp=false;b.textContent="🔊 Play Alert";b.style.display="";s.style.display="none"}else{fa.play().then(function(){fvp=true;b.textContent="🔊 Playing...";s.style.display=""}).catch(function(){showToast("Error","error")})}}function stopFakeVoice(){fa.pause();fa.currentTime=0;fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"}fa.addEventListener("ended",function(){fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"});var ca=null,ip=false;function playSong(u,t,a,c,i){var ad=document.getElementById("coverAudio"),pb=document.getElementById("playBtn"),ar=document.getElementById("albumArt");if(ca===u){togglePlay();return}if(ca){ad.pause()}ca=u;ad.src=u;document.getElementById("currentTitle").textContent=t||"Unknown";document.getElementById("currentArtist").textContent=a||"Unknown";ar.innerHTML=c?\'<img src="\'+c+\'" style="width:100%;height:100%;object-fit:cover">\':"<span>🎵</span>";document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";document.getElementById("totalTime").textContent="0:00";document.querySelectorAll(".song-item").forEach(function(e){e.classList.remove("active")});var se=document.getElementById("song-"+i);if(se)se.classList.add("active");ad.play().then(function(){ip=true;pb.textContent="⏸️";ar.classList.add("playing")}).catch(function(){showToast("Error","error")});ad.ontimeupdate=function(){if(ad.duration){document.getElementById("progressFill").style.width=(ad.currentTime/ad.duration)*100+"%";document.getElementById("currentTime").textContent=ft(ad.currentTime)}};ad.onloadedmetadata=function(){document.getElementById("totalTime").textContent=ft(ad.duration)};ad.onended=function(){ip=false;pb.textContent="▶️";ar.classList.remove("playing");document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";ca=null}}function togglePlay(){var a=document.getElementById("coverAudio"),b=document.getElementById("playBtn"),r=document.getElementById("albumArt");if(!a.src||a.src===window.location.href){showToast("Select a song","error");return}if(ip){a.pause();ip=false;b.textContent="▶️";r.classList.remove("playing")}else{a.play().then(function(){ip=true;b.textContent="⏸️";r.classList.add("playing")}).catch(function(){showToast("Error","error")})}}function seekAudio(e){var a=document.getElementById("coverAudio");if(!a.duration)return;a.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*a.duration}function ft(s){if(isNaN(s))return"0:00";return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")}setTimeout(function(){var v=document.getElementById("welcomeVoice");if(v&&!sessionStorage.getItem("vp")){v.play().catch(function(){});sessionStorage.setItem("vp","1")}},2000);</script>' +
'<audio id="welcomeVoice" src="' + VOICE.welcome + '" preload="none"></audio>' +
'</body></html>';
}

// ============ ADMIN PAGES ============
function getAdminLoginHTML(e) {
    e = e || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6">Admin Login</h2>' + (e ? '<div class="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">' + e + '</div>' : '') + '<form method="POST" action="/admin/login"><input name="username" placeholder="Username" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3" required><input type="password" name="password" placeholder="Password" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-4" required><button class="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-500">Back</a></div></body></html>';
}

async function getAdminPanelHTML(p, m, e) {
    p = p || [];
    m = m || '';
    e = e || '';
    const cl = getAdminChatList();
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 min-h-screen text-white"><header class="bg-gray-900 p-4 border-b border-gray-800"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-purple-400">Admin Panel</h1><div class="flex gap-3"><a href="/admin/chat" class="px-4 py-2 bg-purple-600 rounded-lg text-sm">Chats (' + cl.reduce((s,c) => s + c.unread, 0) + ')</a><a href="/" class="px-4 py-2 bg-gray-800 rounded-lg text-sm">Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Logout</a></div></div></header><div class="max-w-6xl mx-auto p-4">' + (m ? '<div class="bg-green-500/10 text-green-400 p-4 rounded-xl mb-4">' + m + '</div>' : '') + (e ? '<div class="bg-red-500/10 text-red-400 p-4 rounded-xl mb-4">' + e + '</div>' : '') + '<div class="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6"><h2 class="font-bold mb-4">Upload Photo</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" class="mb-3 text-white" required><input name="caption" placeholder="Caption" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3"><button class="w-full py-3 bg-purple-600 text-white rounded-lg">Upload</button></form></div><h2 class="text-xl font-bold mb-4">Gallery (' + p.length + ')</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">' + p.map(x => '<div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-800"><img src="' + x.path + '" class="w-full h-40 object-cover"><div class="p-3"><p class="text-sm text-gray-400">' + (x.caption || '') + '</p><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="' + x._id + '"><button class="text-red-400 text-sm mt-2">Delete</button></form></div></div>').join('') + (p.length === 0 ? '<p class="text-gray-500 col-span-4 text-center py-12">No photos</p>' : '') + '</div></div></body></html>';
}

// ============ SERVER ============
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const pu = url.parse(req.url, true);
    const pn = pu.pathname;
    const m = req.method;
    const ck = parseCookies(req.headers.cookie);
    
    // Serve static assets
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
    
    // Chat page
    if (pn === '/chat' && m === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(chatPageHTML);
        return;
    }
    
    // Chat API - Register user
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
    
    // Chat API - Verify token
    if (pn === '/api/chat/verify' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!u, chatId: u ? u.chatId : null }));
        return;
    }
    
    // Chat API - Get messages
    if (pn === '/api/chat/messages' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(u.chatId) }));
        return;
    }
    
    // Chat API - Send message
    if (pn === '/api/chat/send' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { token, message, type, fileUrl, fileName, duration } = JSON.parse(b);
            const u = getChatUserByToken(token);
            if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            saveChatMessage(u.chatId, 'user', message, type, fileUrl, fileName, duration);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    // Chat API - Upload photo
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
    
    // Chat API - Upload voice
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
    
    // Admin routes
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
    
    // Admin chat panel
    if (pn === '/admin/chat' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
        const cid = pu.query.chatId, cl = getAdminChatList();
        let ms = [];
        if (cid) { ms = getChatMessages(cid); markMessagesRead(cid); }
        
        let messagesHTML = '';
        ms.forEach(function(m) {
            var cls = m.sender === 'user' ? 'user' : 'support';
            var content = m.message || '';
            if (m.type === 'image' && m.fileUrl) content = '<img src="'+m.fileUrl+'" style="max-width:250px;max-height:250px;border-radius:12px;cursor:pointer" onclick="showImg(\''+m.fileUrl+'\')">';
            if (m.type === 'voice' && m.fileUrl) content = '🎤 Voice message';
            messagesHTML += '<div class="msg-row '+cls+'"><div class="bubble">'+content+'<div class="msg-time">'+formatMsgTime(m.createdAt)+'</div></div></div>';
        });
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Chat</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;display:flex;height:100vh;font-family:"Plus Jakarta Sans",sans-serif;background:#0a0a14;color:#fff}.sidebar{width:320px;background:#13132b;border-right:1px solid rgba(255,255,255,0.06);overflow-y:auto}.main{flex:1;display:flex;flex-direction:column}.messages{flex:1;overflow-y:auto;padding:20px;background:#0a0a14}.msg-row{margin-bottom:12px;display:flex}.msg-row.user{justify-content:flex-start}.msg-row.support{justify-content:flex-end}.bubble{max-width:70%;padding:10px 14px;border-radius:18px;font-size:13px;word-wrap:break-word}.msg-row.user .bubble{background:#1a1a35;border-bottom-left-radius:4px}.msg-row.support .bubble{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px}.input-area{background:#13132b;padding:14px;display:flex;gap:10px;border-top:1px solid rgba(255,255,255,0.06)}.msg-input{flex:1;padding:10px 16px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:25px;color:#fff;font-size:13px;outline:none}.send-btn{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;padding:10px 24px;border-radius:25px;cursor:pointer;font-weight:600;font-size:13px}.sidebar-item{padding:14px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06)}.sidebar-item:hover{background:rgba(139,92,246,0.1)}.sidebar-item.active{background:rgba(139,92,246,0.2);border-left:3px solid #8b5cf6}.unread-badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:8px}</style></head><body><div class="sidebar" id="sidebar"><div style="padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);font-weight:600;display:flex;align-items:center;justify-content:space-between"><span>💬 Chats</span><div style="display:flex;gap:8px"><button onclick="refreshList()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:10px;cursor:pointer;font-size:11px">↻</button><a href="/admin" style="color:#fff;font-size:11px;text-decoration:none;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:10px">Back</a></div></div><div id="chatList">' + cl.map(function(c) { return '<div class="sidebar-item' + (c.chatId === cid ? ' active' : '') + '" onclick="selectChat(\'' + c.chatId + '\')"><div style="font-weight:600;display:flex;align-items:center;justify-content:space-between"><span>' + c.name + '</span>' + (c.unread > 0 ? '<span class="unread-badge">' + c.unread + '</span>' : '') + '</div><div style="font-size:12px;opacity:0.6;margin-top:2px">' + c.phoneEmail + '</div><div style="font-size:10px;opacity:0.4;margin-top:2px">' + (c.lastMessage ? c.lastMessage.message.substring(0, 30) : 'No messages') + '</div></div>'; }).join('') + '</div></div><div class="main">' + (cid ? '<div style="padding:14px 16px;background:#13132b;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">' + (cl.find(function(c) { return c.chatId === cid; }) ? cl.find(function(c) { return c.chatId === cid; }).name : '') + '</div><div class="messages" id="mc">' + messagesHTML + '</div><div class="input-area"><input id="am" class="msg-input" placeholder="Reply..." onkeypress="if(event.key===\'Enter\')sendAdminMessage()"><button class="send-btn" onclick="sendAdminMessage()">Send</button></div><script>var cid="' + cid + '";function selectChat(id){window.location.href="/admin/chat?chatId="+id}function refreshList(){window.location.reload()}function lm(){fetch("/api/admin/messages?chatId="+cid).then(function(r){return r.json()}).then(function(d){if(d.success){var h="";d.messages.forEach(function(m){var c=m.sender==="user"?"user":"support";var content=m.message||"";if(m.type==="image"&&m.fileUrl)content=\'<img src="\'+m.fileUrl+\'" style="max-width:250px;max-height:250px;border-radius:12px;cursor:pointer" onclick="showImg(\\\'\'+m.fileUrl+\'\\\')">\';h+=\'<div class="msg-row \'+c+\'"><div class="bubble">\'+content+\'<div class="msg-time">\'+new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+\'</div></div></div>\'});document.getElementById("mc").innerHTML=h;document.getElementById("mc").scrollTop=document.getElementById("mc").scrollHeight}})}function sendAdminMessage(){var i=document.getElementById("am");var msg=i.value.trim();if(!msg)return;fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:msg,type:"text"})}).then(function(){i.value="";lm()})}function showImg(url){var w=window.open();w.document.write(\'<img src="\'+url+\'" style="max-width:100%;max-height:100vh">\')}setInterval(lm,2000);</script>' : '<div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.5;flex-direction:column;gap:10px"><div style="font-size:60px">💬</div><div>Select a chat</div></div>') + '</div></body></html>');
        return;
    }
    
    // Admin API routes
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
    
    // Main page
    if (pn === '/' || pn === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(await getGalleryPhotos())); return;
    }
    
    res.writeHead(404); res.end('404 Not Found');
});

// ============ START SERVER ============
async function start() {
    console.log('🚀 Starting Verification Hub Server...');
    const dbOk = await connectDB();
    if (dbOk) console.log('✅ MongoDB Connected');
    else console.log('⚠️ Using in-memory storage');
    server.listen(PORT, function() { 
        console.log('✅ Server running at http://localhost:' + PORT);
        console.log('📱 Main page: http://localhost:' + PORT);
        console.log('💬 Chat page: http://localhost:' + PORT + '/chat');
        console.log('🔐 Admin panel: http://localhost:' + PORT + '/admin');
        console.log('👤 Default admin: admin / admin123');
    });
}
start().catch(console.error);

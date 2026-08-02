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
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Created directory:', dir);
    }
});

// ============ LOAD CHAT MODULE ============
let chatPageHTML = '';
try {
    const chatModule = require('./chat');
    if (chatModule && typeof chatModule.getChatPageHTML === 'function') {
        chatPageHTML = chatModule.getChatPageHTML();
        console.log('✅ chat.js loaded successfully');
    } else {
        throw new Error('getChatPageHTML not found');
    }
} catch(e) {
    console.log('⚠️ chat.js error:', e.message);
    console.log('Using default chat page');
    chatPageHTML = getDefaultChatHTML();
}

function getDefaultChatHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#ffffff">
    <title>Chat - Baiilla Maach Official</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root{--bg:#f8f9ff;--white:#ffffff;--text:#1a1a2e;--text2:#6b7280;--purple:#8b5cf6;--purple-dark:#6d28d9;--green:#10b981;--red:#ef4444;--border:#e5e7eb}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);height:100vh;display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
        .chat-header{background:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,0.08);z-index:100}
        .back-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0}
        .user-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2.5px solid var(--purple);flex-shrink:0}
        .user-info{flex:1;min-width:0}
        .user-name{font-weight:700;font-size:16px;color:var(--text)}
        .user-status{font-size:12px;color:var(--green);display:flex;align-items:center;gap:5px;font-weight:600}
        .online-dot{width:8px;height:8px;background:var(--green);border-radius:50%;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        .messages-container{flex:1;overflow-y:auto;padding:16px;background:linear-gradient(180deg,#f8f9ff,#f0f1ff,#f8f9ff)}
        .msg-row{margin-bottom:8px;display:flex;animation:msgIn 0.4s ease}
        @keyframes msgIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .msg-row.user{justify-content:flex-end}
        .msg-row.support{justify-content:flex-start}
        .bubble{max-width:78%;padding:12px 16px;border-radius:20px;font-size:14px;line-height:1.55;word-wrap:break-word}
        .msg-row.user .bubble{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border-bottom-right-radius:6px;box-shadow:0 4px 15px rgba(139,92,246,0.25)}
        .msg-row.support .bubble{background:#fff;color:var(--text);border-bottom-left-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
        .msg-time{font-size:10px;opacity:0.7;margin-top:6px}
        .bubble img{max-width:240px;max-height:240px;border-radius:12px;cursor:pointer;display:block}
        .input-area{background:#fff;padding:12px 16px;display:flex;align-items:flex-end;gap:10px;border-top:1px solid var(--border);box-shadow:0 -2px 20px rgba(0,0,0,0.04)}
        .attach-btn{background:#f3f4f6;color:var(--purple);border:2px solid #e5e7eb;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0}
        .msg-input{flex:1;padding:12px 16px;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:9999px;font-size:14px;font-family:inherit;outline:none;resize:none;max-height:120px;min-height:42px}
        .msg-input:focus{border-color:var(--purple);background:#fff;box-shadow:0 0 0 4px rgba(139,92,246,0.08)}
        .send-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
        .send-btn:disabled{opacity:0.5;cursor:not-allowed}
        .voice-btn{background:#f3f4f6;color:var(--purple);border:2px solid #e5e7eb;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0}
        .voice-btn.recording{background:var(--red);color:#fff;border-color:var(--red);animation:pulse 0.8s infinite}
        .image-fullscreen{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:1000;align-items:center;justify-content:center;cursor:pointer}
        .image-fullscreen.active{display:flex}
        .image-fullscreen img{max-width:95%;max-height:95%;border-radius:12px}
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-120px);background:var(--text);color:#fff;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:13px;z-index:9999;transition:transform 0.4s}
        .toast.show{transform:translateX(-50%) translateY(0)}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;opacity:0.5;text-align:center;padding:40px}
        .empty-state-icon{font-size:64px;margin-bottom:16px}
        @media(max-width:480px){.bubble{max-width:85%}.bubble img{max-width:180px;max-height:180px}}
    </style>
</head>
<body>
    <div class="chat-header">
        <button class="back-btn" onclick="history.back()">←</button>
        <img src="/assets/tiktok_video_Aj2NO.jpeg" class="user-avatar" alt="Profile">
        <div class="user-info">
            <div class="user-name">Baiilla Maach</div>
            <div class="user-status"><span class="online-dot"></span>Online now</div>
        </div>
    </div>
    <div class="messages-container" id="messagesContainer">
        <div class="empty-state"><div class="empty-state-icon">💬</div><div>Start a conversation</div></div>
    </div>
    <div class="input-area">
        <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFile(event)">
        <button class="attach-btn" onclick="document.getElementById('fileInput').click()">📎</button>
        <textarea id="msgInput" class="msg-input" placeholder="Type a message..." rows="1" onkeypress="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg()}"></textarea>
        <button class="voice-btn" id="voiceBtn">🎤</button>
        <button class="send-btn" id="sendBtn" onclick="sendMsg()" disabled>➤</button>
    </div>
    <div class="image-fullscreen" id="imgFS" onclick="this.classList.remove('active')">
        <img id="fsImg" src="">
    </div>
    <div class="toast" id="toast"></div>
    <script>
        let token=null,chatId=null;
        function init(){
            let p=new URLSearchParams(window.location.search);
            token=p.get('token')||localStorage.getItem('ct');
            chatId=p.get('chatId')||localStorage.getItem('ci');
            if(!token||!chatId){autoReg();return}
            localStorage.setItem('ct',token);localStorage.setItem('ci',chatId);
            loadMsgs();setInterval(loadMsgs,3000);
            document.getElementById('msgInput').addEventListener('input',function(){document.getElementById('sendBtn').disabled=!this.value.trim()});
        }
        async function autoReg(){
            try{
                let r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Guest',phoneEmail:'guest_'+Date.now()+'@user.com'})});
                let d=await r.json();
                if(d.success){token=d.token;chatId=d.chatId;localStorage.setItem('ct',token);localStorage.setItem('ci',chatId);loadMsgs();setInterval(loadMsgs,3000)}
            }catch(e){console.error(e)}
        }
        async function loadMsgs(){
            if(!token)return;
            try{
                let r=await fetch('/api/chat/messages?token='+token);
                let d=await r.json();
                if(!d.success)return;
                let c=document.getElementById('messagesContainer'),wasAt=c.scrollHeight-c.scrollTop-c.clientHeight<100;
                if(!d.messages.length){c.innerHTML='<div class="empty-state"><div class="empty-state-icon">💬</div><div>Start a conversation</div></div>';return}
                c.innerHTML=d.messages.map(m=>{
                    let cls=m.sender==='user'?'user':'support',content=m.message||'';
                    if(m.type==='image'&&m.fileUrl)content='<img src="'+m.fileUrl+'" onclick="showImg(\''+m.fileUrl+'\')">';
                    let time=new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
                    return '<div class="msg-row '+cls+'"><div class="bubble">'+content+'<div class="msg-time">'+time+'</div></div></div>';
                }).join('');
                if(wasAt)c.scrollTop=c.scrollHeight;
            }catch(e){console.error(e)}
        }
        async function sendMsg(){
            let i=document.getElementById('msgInput'),msg=i.value.trim();
            if(!msg||!token)return;
            i.value='';document.getElementById('sendBtn').disabled=true;
            try{
                await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,message:msg,type:'text'})});
                loadMsgs();
            }catch(e){console.error(e)}
        }
        async function handleFile(e){
            let f=e.target.files[0];
            if(!f||!token)return;
            let fd=new FormData();fd.append('photo',f);
            try{
                let r=await fetch('/api/chat/upload?token='+token,{method:'POST',body:fd});
                let d=await r.json();
                if(d.success){
                    await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,message:'📷 Photo',type:'image',fileUrl:d.fileUrl})});
                    loadMsgs();
                }
            }catch(e){console.error(e)}
            e.target.value='';
        }
        function showImg(u){document.getElementById('fsImg').src=u;document.getElementById('imgFS').classList.add('active')}
        init();
    </script>
</body>
</html>`;
}

// ============ IMAGES ============
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

// ============ IN-MEMORY STORAGE (Always works) ============
const adminPresence = { isOnline: true, lastSeen: new Date() };

const memoryStore = {
    users: new Map(),
    sessions: new Map(),
    messages: new Map(),
    galleryPhotos: []
};

const adminSessions = new Map();

// ============ FUNCTIONS ============
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

// ============ DATABASE (Optional - fails gracefully) ============
async function connectDB() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        mongoClient = new MongoClient(MONGO_URI, { 
            connectTimeoutMS: 5000, 
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 10000 
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        await db.command({ ping: 1 });
        
        const collections = ['admin_users', 'gallery_photos'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) { 
            if (!names.includes(col)) await db.createCollection(col); 
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
            console.log('✅ Default admin created');
        }
        
        // Load gallery from DB
        const dbPhotos = await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray();
        memoryStore.galleryPhotos = dbPhotos;
        
        dbConnected = true;
        console.log('✅ MongoDB Connected');
        return true;
    } catch (e) {
        console.log('⚠️ MongoDB unavailable, using in-memory storage');
        console.log('  Error:', e.message);
        dbConnected = false;
        db = null;
        
        // Create default admin in memory
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        memoryStore.adminUser = { username: 'admin', password: hashedPassword };
        
        return false;
    }
}

async function getGalleryPhotos() {
    if (dbConnected && db) {
        try {
            const photos = await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray();
            memoryStore.galleryPhotos = photos;
            return photos;
        } catch(e) { return memoryStore.galleryPhotos; }
    }
    return memoryStore.galleryPhotos;
}

async function savePhoto(data) {
    const photoData = { ...data, uploadedAt: new Date(), _id: 'mem_' + Date.now() };
    memoryStore.galleryPhotos.unshift(photoData);
    
    if (dbConnected && db) {
        try {
            const result = await db.collection('gallery_photos').insertOne({ ...data, uploadedAt: new Date() });
            photoData._id = result.insertedId;
            return result;
        } catch(e) { console.log('DB save failed, saved in memory'); }
    }
    return photoData;
}

async function deletePhoto(id) {
    memoryStore.galleryPhotos = memoryStore.galleryPhotos.filter(p => 
        (p._id && p._id.toString() !== id.toString())
    );
    
    if (dbConnected && db) {
        try {
            return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
        } catch(e) { console.log('DB delete failed'); }
    }
    return { deletedCount: 1 };
}

async function verifyAdmin(username, password) {
    // Try memory first
    if (memoryStore.adminUser && memoryStore.adminUser.username === username) {
        return bcrypt.compareSync(password, memoryStore.adminUser.password);
    }
    
    // Try database
    if (dbConnected && db) {
        try {
            const admin = await db.collection('admin_users').findOne({ username });
            if (!admin) return false;
            const valid = await bcrypt.compare(password, admin.password);
            // Cache in memory
            if (valid) memoryStore.adminUser = admin;
            return valid;
        } catch(e) { return false; }
    }
    
    return false;
}

// ============ CHAT FUNCTIONS ============
function createOrGetChatUser(name, phoneEmail) {
    const clean = (phoneEmail || '').trim().toLowerCase();
    if (!clean) return null;
    
    let user = memoryStore.users.get(clean);
    if (user) {
        user.name = name;
        user.lastSeen = new Date();
        user.status = 'active';
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
    console.log('✅ New chat user:', name, chatId);
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
    console.log(`💬 Message saved: ${sender} -> ${chatId} (${type})`);
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
    msgs.forEach(m => { if (m.sender === 'user') m.read = true; });
}

// ============ SESSION ============
function createAdminSession(username) {
    const id = crypto.randomBytes(32).toString('hex');
    adminSessions.set(id, { username, createdAt: Date.now() });
    return id;
}

function getAdminSession(id) {
    const s = adminSessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > 7200000) {
        adminSessions.delete(id);
        return null;
    }
    return s;
}

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(x => {
        const p = x.split('=');
        c[p[0].trim()] = p[1] ? p[1].trim() : '';
    });
    return c;
}

function formatMsgTime(d) {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============ MAIN HTML ============
function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = 2;
    const profilePic = IMAGES.profile;

    let fakeCardsHTML = '';
    [
        { username: "@baiilla_mach", reason: "Copies official content and logo to deceive followers.", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger },
        { username: "@hammad_fams0", reason: "Uses official name and photo to mislead followers.", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud }
    ].forEach(function(a) {
        fakeCardsHTML += '<div class="fake-card"><div class="fake-card-body">';
        fakeCardsHTML += '<img src="' + a.screenshot + '" class="fake-card-img" alt="Fake">';
        fakeCardsHTML += '<div style="flex:1;min-width:0"><div style="font-weight:700;color:#fca5a5;font-size:14px;margin-bottom:4px">' + a.username + '</div>';
        fakeCardsHTML += '<div style="font-size:11px;color:#f87171;margin-bottom:6px">⚠ ' + a.reason + '</div>';
        fakeCardsHTML += '<div style="display:flex;gap:6px"><a href="' + a.profileUrl + '" target="_blank" class="btn btn-red btn-sm">Report</a>';
        fakeCardsHTML += '<button onclick="copyTxt(\'' + a.username + '\')" class="btn btn-outline btn-sm">Copy</button></div></div></div></div>';
    });

    let officialCardsHTML = '';
    [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", icon: IMAGES.tiktokIcon, verifiedIcon: IMAGES.blueTick, followers: "5,000" },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", icon: IMAGES.facebookIcon, verifiedIcon: IMAGES.blueTick, followers: "Growing" }
    ].forEach(function(acc) {
        officialCardsHTML += '<div class="official-card">';
        officialCardsHTML += '<img src="' + acc.icon + '" style="width:22px;height:22px;flex-shrink:0">';
        officialCardsHTML += '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px">';
        officialCardsHTML += '<span style="font-weight:600;font-size:14px">' + acc.username + '</span>';
        officialCardsHTML += '<img src="' + acc.verifiedIcon + '" style="width:14px;height:14px">';
        officialCardsHTML += '</div><div style="font-size:10px;color:#6060a0;margin-top:2px">' + acc.followers + ' followers</div></div>';
        officialCardsHTML += '<a href="' + acc.url + '" target="_blank" class="btn btn-green btn-sm">Follow</a></div>';
    });

    let galleryHTML = '';
    if (galleryPhotos.length === 0) {
        galleryHTML = '<p style="color:#6060a0;text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>';
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
            '<div class="music-header"><span style="font-weight:700;font-size:16px">🎵 Cover Music</span><span style="font-size:11px;opacity:0.5;margin-left:auto">' + coverSongs.length + ' tracks</span></div>' +
            '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">' +
            '<div class="album-art" id="albumArt"><span>🎵</span></div>' +
            '<div style="flex:1"><div id="currentTitle" style="font-weight:600;font-size:15px">Select a Song</div><div id="currentArtist" style="font-size:11px;opacity:0.6;margin-top:4px">Cover Music</div></div>' +
            '<button class="play-btn" id="playBtn" onclick="togglePlay()">▶️</button></div>' +
            '<div class="progress-wrap"><span id="currentTime" style="font-size:10px;opacity:0.5;width:32px">0:00</span>' +
            '<div class="progress-bar" onclick="seekAudio(event)"><div class="progress-fill" id="progressFill"></div></div>' +
            '<span id="totalTime" style="font-size:10px;opacity:0.5;width:32px;text-align:right">0:00</span></div>' +
            '<div class="song-list">' + songListHTML + '</div><audio id="coverAudio" preload="none"></audio></section>';
    }

    return '<!DOCTYPE html>' +
'<html lang="en"><head>' +
'<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
'<meta name="theme-color" content="#0f0f1a"><title>Baiilla Maach | Verification Hub</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
'<style>' +
':root{--bg:#0a0a14;--surface:#13132b;--surface2:#1a1a35;--text:#f0f0ff;--text2:#a0a0cc;--text3:#6060a0;--purple:#8b5cf6;--pink:#ec4899;--green:#10b981;--red:#ef4444;--glass-border:rgba(255,255,255,0.06);--glow-purple:0 0 40px rgba(139,92,246,0.3);--glow-green:0 0 30px rgba(16,185,129,0.3);--glow-red:0 0 30px rgba(239,68,68,0.3)}' +
'*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Plus Jakarta Sans",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}' +
'.stars-bg{position:fixed;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;overflow:hidden}' +
'.star{position:absolute;background:white;border-radius:50%;animation:twinkle var(--dur) ease-in-out infinite;animation-delay:var(--delay);opacity:0}' +
'@keyframes twinkle{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:0.8;transform:scale(1.5)}}' +
'main{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:16px}' +
'.glass-card{background:var(--surface);border:1px solid var(--glass-border);border-radius:24px;padding:24px;margin-bottom:20px}' +
'.danger-card{border-left:3px solid var(--red)}.success-card{border-left:3px solid var(--green)}' +
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
'.main-header{background:rgba(10,10,20,0.8);backdrop-filter:blur(30px);border-bottom:1px solid var(--glass-border);padding:12px 0;position:sticky;top:0;z-index:100}' +
'.header-inner{display:flex;align-items:center;justify-content:space-between;max-width:860px;margin:0 auto;padding:0 16px}' +
'.header-logo{display:flex;align-items:center;gap:10px}' +
'.header-logo img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)}' +
'.header-title{font-weight:700;font-size:16px;background:linear-gradient(135deg,#c4b5fd,#f9a8d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}' +
'.header-nav{display:flex;gap:6px}.header-nav a{padding:7px 14px;border-radius:50px;font-size:11px;font-weight:600;text-decoration:none}' +
'.nav-red{color:#fca5a5;background:rgba(239,68,68,0.1)}.nav-green{color:#6ee7b7;background:rgba(16,185,129,0.1)}.nav-purple{color:#c4b5fd;background:rgba(139,92,246,0.1)}' +
'.profile-section{text-align:center;padding:30px 0 20px}' +
'.profile-pic-wrap{position:relative;display:inline-block;margin-bottom:12px}' +
'.profile-pic{width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--purple);box-shadow:var(--glow-purple)}' +
'.verified-badge-prof{position:absolute;bottom:4px;right:4px;width:30px;height:30px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;border:3px solid var(--bg);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff}' +
'.profile-name{font-size:26px;font-weight:800;background:linear-gradient(135deg,#c4b5fd,#f9a8d4,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:8px}' +
'.profile-bio{color:var(--text2);font-size:13px;margin-top:6px}' +
'.stats-row{display:flex;justify-content:center;gap:16px;margin:20px 0;flex-wrap:wrap}' +
'.stat-card{background:var(--surface2);border:1px solid var(--glass-border);border-radius:18px;padding:16px 24px;text-align:center}' +
'.stat-value{font-size:22px;font-weight:700;color:#a78bfa}.stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px}' +
'.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--glass-border)}' +
'.icon-circle{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}' +
'.icon-red{background:rgba(239,68,68,0.15)}.icon-green{background:rgba(16,185,129,0.15)}' +
'.section-title{font-size:18px;font-weight:700}.section-subtitle{font-size:11px;color:var(--text3);margin-top:2px}' +
'.fake-card{background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:18px;padding:18px;margin-bottom:12px}' +
'.fake-card-body{display:flex;gap:14px;align-items:flex-start}' +
'.fake-card-img{width:60px;height:60px;border-radius:14px;object-fit:cover;border:2px solid rgba(239,68,68,0.3);flex-shrink:0}' +
'.official-card{background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:18px;padding:16px 18px;margin-bottom:10px;display:flex;align-items:center;gap:14px}' +
'.warning-image-container{text-align:center;padding:20px;background:rgba(234,179,8,0.05);border:1px solid rgba(234,179,8,0.2);border-radius:18px;margin-bottom:20px}' +
'.warning-image-container img{max-width:100%;border-radius:16px}' +
'.music-player{background:linear-gradient(180deg,#1a1040,#0a0a1a);border-radius:32px;padding:28px;color:#fff;margin:20px 0;border:1px solid rgba(139,92,246,0.2)}' +
'.music-header{display:flex;align-items:center;gap:10px;margin-bottom:20px}' +
'.album-art{width:80px;height:80px;border-radius:20px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;border:2px solid rgba(255,255,255,0.1)}' +
'.play-btn{width:56px;height:56px;border-radius:50%;background:#1db954;border:none;color:#000;font-size:22px;cursor:pointer;flex-shrink:0}' +
'.progress-wrap{display:flex;align-items:center;gap:10px}' +
'.progress-bar{flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;cursor:pointer}' +
'.progress-fill{height:100%;background:linear-gradient(90deg,#1db954,#1ed760);border-radius:2px;width:0%}' +
'.song-list{max-height:220px;overflow-y:auto;margin-top:18px}' +
'.song-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;cursor:pointer}' +
'.song-item:hover{background:rgba(255,255,255,0.04)}.song-item.active{background:rgba(29,185,84,0.15);border:1px solid rgba(29,185,84,0.3)}' +
'.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}' +
'.gallery-item{border-radius:18px;overflow:hidden;border:1px solid var(--glass-border)}.gallery-item img{width:100%;height:130px;object-fit:cover}' +
'.toast{position:fixed;top:20px;right:20px;z-index:99999;background:var(--surface2);border:1px solid var(--glass-border);padding:14px 20px;border-radius:14px;color:var(--text);font-size:13px;transform:translateX(120%);transition:transform 0.4s}' +
'.toast.show{transform:translateX(0)}' +
'.chat-widget{position:fixed;bottom:24px;right:24px;z-index:9999}' +
'.chat-btn{width:auto;height:56px;border-radius:50px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;cursor:pointer;box-shadow:0 10px 40px rgba(139,92,246,0.4);display:flex;align-items:center;gap:10px;padding:0 20px;transition:all 0.3s;color:#fff;font-weight:600;font-size:14px;text-decoration:none}' +
'.chat-btn:hover{transform:scale(1.05)}.chat-btn img{width:34px;height:34px;border-radius:50%}' +
'@media(max-width:640px){.chat-widget{bottom:16px;right:16px}.header-nav{display:none}}' +
'</style></head><body>' +
'<div class="stars-bg" id="starsBg"></div>' +
'<div id="toast" class="toast"></div>' +
'<header class="main-header"><div class="header-inner"><div class="header-logo"><img src="' + profilePic + '" alt="Logo"><span class="header-title">Verification Hub</span></div><nav class="header-nav"><a href="#fake" class="nav-red">⚠ Fakes</a>' + (coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : '') + '<a href="#official" class="nav-green">✓ Official</a><a href="#gallery" class="nav-purple">📸 Gallery</a></nav></div></header>' +
'<main>' +
'<section class="profile-section"><div class="profile-pic-wrap"><img src="' + profilePic + '" class="profile-pic" alt="Profile"><div class="verified-badge-prof">✓</div></div><h1 class="profile-name">Baiilla Maach Official</h1><p class="profile-bio">Official Entertainment Profile | Bangladesh</p><div class="stats-row"><div class="stat-card"><div class="stat-value">5,000</div><div class="stat-label">Followers</div></div><div class="stat-card"><div class="stat-value">0</div><div class="stat-label">Following</div></div><div class="stat-card"><div class="stat-value">50K</div><div class="stat-label">Likes</div></div></div><div style="display:flex;gap:8px;justify-content:center"><span class="badge badge-green">✓ Verified</span><span class="badge badge-purple">Creator</span></div></section>' +
'<section id="fake" class="glass-card danger-card"><div class="section-header"><div class="icon-circle icon-red">⚠️</div><div><div class="section-title" style="color:#fca5a5">Fake Accounts Detected</div><div class="section-subtitle">Report these impersonating accounts</div></div><span class="badge badge-red" style="margin-left:auto">' + totalFake + ' Active</span></div>' + fakeCardsHTML + '<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button class="btn btn-red btn-sm" id="voicePlayBtn" onclick="toggleFakeVoice()">🔊 Play Alert</button><button class="btn btn-outline btn-sm" id="voiceStopBtn" onclick="stopFakeVoice()" style="display:none">⏹ Stop</button></div><audio id="fakeVoice" src="' + VOICE.fakeAlert + '" preload="auto"></audio></section>' +
musicSectionHTML +
'<section id="official" class="glass-card success-card"><div class="section-header"><div class="icon-circle icon-green">✓</div><div><div class="section-title" style="color:#6ee7b7">Official Verified Accounts</div><div class="section-subtitle">Only follow these real accounts</div></div></div>' + officialCardsHTML + '</section>' +
'<section id="gallery" class="glass-card"><div class="section-header"><span style="font-size:22px">📸</span><div><div class="section-title">Photo Gallery</div><div class="section-subtitle">Official moments</div></div></div><div class="gallery-grid">' + galleryHTML + '</div></section>' +
'</main>' +
'<div class="chat-widget"><a href="/chat" class="chat-btn"><img src="' + IMAGES.messageIcon + '" alt="Chat"><span>💬 Chat Now</span></a></div>' +
'<script>document.getElementById("starsBg").innerHTML=Array.from({length:80},()=>{let s=document.createElement("div");s.className="star";s.style.cssText="left:"+Math.random()*100+"%;top:"+Math.random()*100+"%;width:"+(Math.random()*3+1)+"px;height:"+(Math.random()*3+1)+"px;--dur:"+(Math.random()*3+2)+"s;--delay:"+(Math.random()*5)+"s";return s}).map(e=>e.outerHTML).join("");function showToast(m,t){var e=document.getElementById("toast");e.textContent=m;e.className="toast show "+(t||"");setTimeout(function(){e.classList.remove("show")},2800)}function copyTxt(t){navigator.clipboard.writeText(t).then(function(){showToast("Copied!","success")})}var fvp=false,fa=document.getElementById("fakeVoice");function toggleFakeVoice(){var b=document.getElementById("voicePlayBtn"),s=document.getElementById("voiceStopBtn");if(fvp){fa.pause();fa.currentTime=0;fvp=false;b.textContent="🔊 Play Alert";b.style.display="";s.style.display="none"}else{fa.play().then(function(){fvp=true;b.textContent="🔊 Playing...";s.style.display=""}).catch(function(){showToast("Error","error")})}}function stopFakeVoice(){fa.pause();fa.currentTime=0;fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"}fa.addEventListener("ended",function(){fvp=false;document.getElementById("voicePlayBtn").textContent="🔊 Play Alert";document.getElementById("voicePlayBtn").style.display="";document.getElementById("voiceStopBtn").style.display="none"});var ca=null,ip=false;function playSong(u,t,a,c,i){var ad=document.getElementById("coverAudio"),pb=document.getElementById("playBtn"),ar=document.getElementById("albumArt");if(ca===u){togglePlay();return}if(ca)ad.pause();ca=u;ad.src=u;document.getElementById("currentTitle").textContent=t||"Unknown";document.getElementById("currentArtist").textContent=a||"Unknown";ar.innerHTML=c?\'<img src="\'+c+\'" style="width:100%;height:100%;object-fit:cover">\':"<span>🎵</span>";document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";document.getElementById("totalTime").textContent="0:00";document.querySelectorAll(".song-item").forEach(function(e){e.classList.remove("active")});var se=document.getElementById("song-"+i);if(se)se.classList.add("active");ad.play().then(function(){ip=true;pb.textContent="⏸️"}).catch(function(){showToast("Error","error")});ad.ontimeupdate=function(){if(ad.duration){document.getElementById("progressFill").style.width=(ad.currentTime/ad.duration)*100+"%";document.getElementById("currentTime").textContent=ft(ad.currentTime)}};ad.onloadedmetadata=function(){document.getElementById("totalTime").textContent=ft(ad.duration)};ad.onended=function(){ip=false;pb.textContent="▶️";document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";ca=null}}function togglePlay(){var a=document.getElementById("coverAudio"),b=document.getElementById("playBtn");if(!a.src||a.src===window.location.href){showToast("Select a song","error");return}if(ip){a.pause();ip=false;b.textContent="▶️"}else{a.play().then(function(){ip=true;b.textContent="⏸️"}).catch(function(){showToast("Error","error")})}}function seekAudio(e){var a=document.getElementById("coverAudio");if(!a.duration)return;a.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*a.duration}function ft(s){if(isNaN(s))return"0:00";return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")}</script>' +
'<audio id="welcomeVoice" src="' + VOICE.welcome + '" preload="none"></audio>' +
'</body></html>';
}

// ============ ADMIN HTML ============
function getAdminLoginHTML(error) {
    error = error || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6">Admin Login</h2>' + (error ? '<div class="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">' + error + '</div>' : '') + '<form method="POST" action="/admin/login"><input name="username" placeholder="Username" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3" required><input type="password" name="password" placeholder="Password" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-4" required><button class="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-500">Back to Site</a></div></body></html>';
}

async function getAdminPanelHTML(photos, message, error) {
    photos = photos || [];
    message = message || '';
    error = error || '';
    const chatList = getAdminChatList();
    const totalUnread = chatList.reduce((s, c) => s + c.unread, 0);
    
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 min-h-screen text-white"><header class="bg-gray-900 p-4 border-b border-gray-800"><div class="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-3"><h1 class="text-lg font-bold text-purple-400">⚙ Admin Panel</h1><div class="flex gap-3 flex-wrap"><a href="/admin/chat" class="px-4 py-2 bg-purple-600 rounded-lg text-sm">💬 Chats ' + (totalUnread > 0 ? '(' + totalUnread + ')' : '') + '</a><a href="/" class="px-4 py-2 bg-gray-800 rounded-lg text-sm">🏠 Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">🚪 Logout</a></div></div></header><div class="max-w-6xl mx-auto p-4">' + (message ? '<div class="bg-green-500/10 text-green-400 p-4 rounded-xl mb-4">✅ ' + message + '</div>' : '') + (error ? '<div class="bg-red-500/10 text-red-400 p-4 rounded-xl mb-4">❌ ' + error + '</div>' : '') + '<div class="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6"><h2 class="font-bold mb-4">📸 Upload Photo to Gallery</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" accept="image/*" class="mb-3 text-white" required><input name="caption" placeholder="Photo caption (optional)" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3"><button class="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold">Upload Photo</button></form></div><h2 class="text-xl font-bold mb-4">🖼 Gallery (' + photos.length + ' photos)</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">' + photos.map(p => '<div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-800"><img src="' + p.path + '" class="w-full h-40 object-cover" loading="lazy"><div class="p-3"><p class="text-sm text-gray-400 truncate">' + (p.caption || 'No caption') + '</p><form method="POST" action="/admin/delete" onsubmit="return confirm(\'Delete this photo?\')"><input type="hidden" name="photoId" value="' + p._id + '"><button class="text-red-400 text-sm mt-2 hover:text-red-300">🗑 Delete</button></form></div></div>').join('') + (photos.length === 0 ? '<p class="text-gray-500 col-span-4 text-center py-12">No photos uploaded yet</p>' : '') + '</div></div></body></html>';
}

// ============ SERVER ============
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
    
    // ============ SERVE STATIC FILES ============
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
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
                '.svg': 'image/svg+xml',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.webm': 'audio/webm',
                '.mp4': 'video/mp4',
                '.pdf': 'application/pdf'
            };
            res.writeHead(200, { 
                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=3600'
            });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }
    
    // ============ CHAT PAGE ============
    if (pathname === '/chat' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(chatPageHTML);
        return;
    }
    
    // ============ CHAT API ============
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
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
                
                // Send welcome message if first time
                const existingMessages = getChatMessages(user.chatId);
                if (existingMessages.length === 0) {
                    saveChatMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to Baiilla Maach Official support. How can I help you today?');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    chatId: user.chatId, 
                    token: token, 
                    name: user.name, 
                    phoneEmail: user.phoneEmail 
                }));
                console.log('✅ User registered:', name, user.chatId);
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/verify' && method === 'GET') {
        const user = getChatUserByToken(parsedUrl.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!user, chatId: user ? user.chatId : null }));
        return;
    }
    
    if (pathname === '/api/chat/messages' && method === 'GET') {
        const user = getChatUserByToken(parsedUrl.query.token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(user.chatId) }));
        return;
    }
    
    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { token, message, type, fileUrl, fileName, duration } = JSON.parse(body);
                const user = getChatUserByToken(token);
                
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
                    return;
                }
                
                const msg = saveChatMessage(user.chatId, 'user', message, type, fileUrl, fileName, duration);
                console.log('📩 Message from', user.name + ':', message.substring(0, 50));
                
                // Auto-reply
                setTimeout(() => {
                    const replies = [
                        'Thank you for your message! We will get back to you soon. 😊',
                        'Got it! Is there anything else you need help with?',
                        'Thanks for reaching out! Our team will review this.',
                        'We appreciate your message! Stay tuned for updates.'
                    ];
                    const reply = replies[Math.floor(Math.random() * replies.length)];
                    saveChatMessage(user.chatId, 'admin', reply);
                }, 2000);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/upload' && method === 'POST') {
        const token = parsedUrl.query.token;
        const user = getChatUserByToken(token);
        
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        });
        
        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error('Upload error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
                return;
            }
            
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile || !photoFile.filepath) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No file uploaded' }));
                return;
            }
            
            const newFileName = Date.now() + '_' + (photoFile.originalFilename || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
            const newPath = path.join(CHAT_UPLOADS_DIR, newFileName);
            
            try {
                fs.renameSync(photoFile.filepath, newPath);
                const fileUrl = '/assets/chat_uploads/' + encodeURIComponent(newFileName);
                console.log('📸 Photo uploaded:', fileUrl);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, fileUrl }));
            } catch(e) {
                console.error('File rename error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'File save failed' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/upload-voice' && method === 'POST') {
        const token = parsedUrl.query.token;
        const user = getChatUserByToken(token);
        
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024 // 5MB
        });
        
        form.parse(req, (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
                return;
            }
            
            const voiceFile = Array.isArray(files.voice) ? files.voice[0] : files.voice;
            if (!voiceFile || !voiceFile.filepath) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No voice file' }));
                return;
            }
            
            const newFileName = 'voice_' + Date.now() + '.webm';
            const newPath = path.join(CHAT_UPLOADS_DIR, newFileName);
            
            try {
                fs.renameSync(voiceFile.filepath, newPath);
                const fileUrl = '/assets/chat_uploads/' + encodeURIComponent(newFileName);
                console.log('🎤 Voice uploaded:', fileUrl);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, fileUrl }));
            } catch(e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Voice save failed' }));
            }
        });
        return;
    }
    
    // ============ ADMIN ROUTES ============
    if (pathname === '/admin' && method === 'GET') {
        const session = getAdminSession(cookies.sessionId);
        if (session) {
            adminPresence.isOnline = true;
            adminPresence.lastSeen = new Date();
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(await getAdminPanelHTML(photos));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }
    
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            const valid = await verifyAdmin(username, password);
            if (valid) {
                const sessionId = createAdminSession(username);
                adminPresence.isOnline = true;
                adminPresence.lastSeen = new Date();
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': 'sessionId=' + sessionId + '; HttpOnly; Path=/; Max-Age=7200'
                });
                res.end();
                console.log('✅ Admin logged in:', username);
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid credentials. Try admin / admin123'));
            }
        });
        return;
    }
    
    if (pathname === '/admin/logout') {
        adminSessions.delete(cookies.sessionId);
        adminPresence.isOnline = false;
        adminPresence.lastSeen = new Date();
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
        });
        res.end();
        return;
    }
    
    if (pathname === '/admin/upload' && method === 'POST') {
        const session = getAdminSession(cookies.sessionId);
        if (!session) {
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
                res.writeHead(302, { 'Location': '/admin?error=' + encodeURIComponent('Upload failed') });
                res.end();
                return;
            }
            
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile || !photoFile.filepath) {
                res.writeHead(302, { 'Location': '/admin?error=' + encodeURIComponent('No file selected') });
                res.end();
                return;
            }
            
            const newFileName = Date.now() + '_' + (photoFile.originalFilename || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
            const newPath = path.join(GALLERY_DIR, newFileName);
            
            try {
                fs.renameSync(photoFile.filepath, newPath);
                await savePhoto({
                    path: '/assets/gallery/' + encodeURIComponent(newFileName),
                    caption: fields.caption || ''
                });
                console.log('🖼 Gallery photo added:', newFileName);
                res.writeHead(302, { 'Location': '/admin?message=' + encodeURIComponent('Photo uploaded successfully!') });
            } catch(e) {
                console.error('Gallery save error:', e);
                res.writeHead(302, { 'Location': '/admin?error=' + encodeURIComponent('Save failed: ' + e.message) });
            }
            res.end();
        });
        return;
    }
    
    if (pathname === '/admin/delete' && method === 'POST') {
        const session = getAdminSession(cookies.sessionId);
        if (!session) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const photoId = params.get('photoId');
            
            try {
                // Try to delete file from disk
                const photo = memoryStore.galleryPhotos.find(p => p._id && p._id.toString() === photoId);
                if (photo && photo.path) {
                    const filePath = path.join(__dir, decodeURIComponent(photo.path));
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                
                await deletePhoto(photoId);
                console.log('🗑 Photo deleted:', photoId);
                res.writeHead(302, { 'Location': '/admin?message=' + encodeURIComponent('Photo deleted') });
            } catch(e) {
                res.writeHead(302, { 'Location': '/admin?error=' + encodeURIComponent('Delete failed') });
            }
            res.end();
        });
        return;
    }
    
    // ============ ADMIN CHAT ============
    if (pathname === '/admin/chat' && method === 'GET') {
        const session = getAdminSession(cookies.sessionId);
        if (!session) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        
        adminPresence.isOnline = true;
        adminPresence.lastSeen = new Date();
        
        const selectedChatId = parsedUrl.query.chatId;
        const chatList = getAdminChatList();
        let messages = [];
        
        if (selectedChatId) {
            messages = getChatMessages(selectedChatId);
            markMessagesRead(selectedChatId);
        }
        
        let messagesHTML = messages.map(m => {
            const cls = m.sender === 'user' ? 'user' : 'support';
            let content = m.message || '';
            if (m.type === 'image' && m.fileUrl) {
                content = '<img src="' + m.fileUrl + '" style="max-width:200px;max-height:200px;border-radius:12px;cursor:pointer" onclick="window.open(\'' + m.fileUrl + '\')">';
            }
            if (m.type === 'voice' && m.fileUrl) {
                content = '🎤 <audio controls src="' + m.fileUrl + '" style="max-width:200px;height:30px"></audio>';
            }
            return '<div class="msg-row ' + cls + '"><div class="bubble">' + content + '<div class="msg-time">' + formatMsgTime(m.createdAt) + '</div></div></div>';
        }).join('');
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Chat</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;display:flex;height:100vh;font-family:"Plus Jakarta Sans",sans-serif;background:#0a0a14;color:#fff}.sidebar{width:320px;background:#13132b;border-right:1px solid rgba(255,255,255,0.06);overflow-y:auto;flex-shrink:0}.main{flex:1;display:flex;flex-direction:column;min-width:0}.messages{flex:1;overflow-y:auto;padding:20px;background:#0a0a14}.msg-row{margin-bottom:8px;display:flex}.msg-row.user{justify-content:flex-start}.msg-row.support{justify-content:flex-end}.bubble{max-width:70%;padding:10px 14px;border-radius:18px;font-size:13px;word-wrap:break-word}.msg-row.user .bubble{background:#1a1a35;border-bottom-left-radius:4px}.msg-row.support .bubble{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px}.msg-time{font-size:10px;opacity:0.7;margin-top:4px}.input-area{background:#13132b;padding:14px;display:flex;gap:10px;border-top:1px solid rgba(255,255,255,0.06)}.msg-input{flex:1;padding:10px 16px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:25px;color:#fff;font-size:13px;outline:none}.send-btn{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;padding:10px 24px;border-radius:25px;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap}.sidebar-item{padding:14px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.2s}.sidebar-item:hover{background:rgba(139,92,246,0.1)}.sidebar-item.active{background:rgba(139,92,246,0.2);border-left:3px solid #8b5cf6}.unread-badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:8px}@media(max-width:768px){.sidebar{display:none}}</style></head><body><div class="sidebar" id="sidebar"><div style="padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);font-weight:600;display:flex;align-items:center;justify-content:space-between"><span>💬 Chats</span><div style="display:flex;gap:8px"><button onclick="location.reload()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:10px;cursor:pointer;font-size:11px">↻</button><a href="/admin" style="color:#fff;font-size:11px;text-decoration:none;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:10px">← Back</a></div></div>' + chatList.map(c => '<div class="sidebar-item' + (c.chatId === selectedChatId ? ' active' : '') + '" onclick="selectChat(\'' + c.chatId + '\')"><div style="font-weight:600;display:flex;align-items:center;justify-content:space-between"><span>' + c.name + '</span>' + (c.unread > 0 ? '<span class="unread-badge">' + c.unread + '</span>' : '') + '</div><div style="font-size:12px;opacity:0.6;margin-top:2px">' + c.phoneEmail + '</div><div style="font-size:10px;opacity:0.4;margin-top:2px">' + (c.lastMessage ? (c.lastMessage.message || '').substring(0, 30) : 'No messages') + '</div></div>').join('') + '</div><div class="main">' + (selectedChatId ? '<div style="padding:14px 16px;background:#13132b;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">' + (chatList.find(c => c.chatId === selectedChatId)?.name || 'Chat') + '</div><div class="messages" id="mc">' + messagesHTML + '</div><div class="input-area"><input id="am" class="msg-input" placeholder="Type reply..." onkeypress="if(event.key===\'Enter\')sendAdminMsg()"><button class="send-btn" onclick="sendAdminMsg()">Send</button></div><script>var cid="' + selectedChatId + '";function selectChat(id){window.location.href="/admin/chat?chatId="+id}function lm(){fetch("/api/admin/messages?chatId="+cid).then(r=>r.json()).then(d=>{if(d.success){var h="";d.messages.forEach(m=>{var c=m.sender==="user"?"user":"support",ct=m.message||"";if(m.type==="image"&&m.fileUrl)ct=\'<img src="\'+m.fileUrl+\'" style="max-width:200px;max-height:200px;border-radius:12px;cursor:pointer" onclick="window.open(\\\'\'+m.fileUrl+\'\\\')">\';if(m.type==="voice"&&m.fileUrl)ct=\'🎤 <audio controls src="\'+m.fileUrl+\'" style="max-width:200px;height:30px"></audio>\';h+=\'<div class="msg-row \'+c+\'"><div class="bubble">\'+ct+\'<div class="msg-time">\'+new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+\'</div></div></div>\'});document.getElementById("mc").innerHTML=h;document.getElementById("mc").scrollTop=document.getElementById("mc").scrollHeight}})}function sendAdminMsg(){var i=document.getElementById("am"),msg=i.value.trim();if(!msg)return;fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:msg,type:"text"})}).then(()=>{i.value="";lm()})}setInterval(lm,2000);lm();</script>' : '<div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.5;flex-direction:column;gap:10px"><div style="font-size:60px">💬</div><div>Select a chat from the sidebar</div><button onclick="location.reload()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;margin-top:10px">🔄 Refresh</button></div>') + '</div></body></html>');
        return;
    }
    
    // ============ ADMIN API ============
    if (pathname === '/api/admin/messages' && method === 'GET') {
        const session = getAdminSession(cookies.sessionId);
        if (!session) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        markMessagesRead(parsedUrl.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(parsedUrl.query.chatId) }));
        return;
    }
    
    if (pathname === '/api/admin/send' && method === 'POST') {
        const session = getAdminSession(cookies.sessionId);
        if (!session) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { chatId, message, type, fileUrl } = JSON.parse(body);
                saveChatMessage(chatId, 'admin', message, type, fileUrl);
                adminPresence.isOnline = true;
                adminPresence.lastSeen = new Date();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch(e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // ============ MAIN PAGE ============
    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML(photos));
        return;
    }
    
    // ============ 404 ============
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Page Not Found</h1><p><a href="/">Go Home</a></p>');
});

// ============ START ============
async function start() {
    console.log('🚀 Starting Verification Hub Server...');
    console.log('=====================================');
    
    await connectDB();
    
    server.listen(PORT, () => {
        console.log('=====================================');
        console.log('✅ Server running on port', PORT);
        console.log('📱 Main: http://localhost:' + PORT);
        console.log('💬 Chat: http://localhost:' + PORT + '/chat');
        console.log('🔐 Admin: http://localhost:' + PORT + '/admin');
        console.log('👤 Login: admin / admin123');
        console.log('💾 Storage:', dbConnected ? 'MongoDB' : 'In-Memory');
        console.log('=====================================');
    });
}

start().catch(err => {
    console.error('❌ Server start failed:', err);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close();
    if (mongoClient) mongoClient.close();
    process.exit(0);
});

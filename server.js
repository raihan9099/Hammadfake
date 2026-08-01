const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const socketIO = require('socket.io');

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

// ==================== DIRECTORY SETUP ====================
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_MEDIA_DIR = path.join(__dir, 'assets', 'chatmedia');
const UPLOADS_DIR = path.join(__dir, 'assets', 'uploads');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_MEDIA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==================== DATABASE ====================
let db, mongoClient;

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { unique: true, sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        await db.collection('chat_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                createdAt: new Date()
            });
        }
        
        console.log('Database connected');
        return true;
    } catch (e) {
        console.error('Database connection error:', e.message);
        return false;
    }
}

// ==================== SESSION MANAGEMENT ====================
const sessions = new Map();

function createSession(username) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, {
        username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7200000
    });
    return id;
}

function getSession(id) {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
        sessions.delete(id);
        return null;
    }
    return s;
}

// ==================== HELPER FUNCTIONS ====================
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

function getMimeType(ext) {
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.webm': 'audio/webm',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.mkv': 'video/x-matroska',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.zip': 'application/zip'
    };
    return types[ext] || 'application/octet-stream';
}

// ==================== CHAT FUNCTIONS ====================
async function createOrGetChatUser(name, phoneEmail) {
    if (!phoneEmail || !phoneEmail.trim()) return null;
    const clean = phoneEmail.trim().toLowerCase();
    
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
        chatId,
        name,
        phoneEmail: clean,
        createdAt: new Date(),
        lastSeen: new Date(),
        status: 'active'
    };
    
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').deleteMany({ chatId });
    await db.collection('chat_sessions').insertOne({
        chatId,
        token,
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

async function getChatMessages(chatId, limit = 100, before = null) {
    let query = { chatId };
    if (before) {
        query.createdAt = { $lt: new Date(before) };
    }
    
    return await db.collection('chat_messages')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
        .then(msgs => msgs.reverse());
}

async function saveChatMessage(chatId, sender, message, mediaUrl = null, mediaType = null, fileName = null, fileSize = null, replyTo = null) {
    const msg = {
        chatId,
        sender,
        message: message || '',
        mediaUrl,
        mediaType,
        fileName,
        fileSize,
        replyTo,
        createdAt: new Date(),
        read: false,
        delivered: true,
        edited: false,
        deleted: false
    };
    
    const result = await db.collection('chat_messages').insertOne(msg);
    await db.collection('chat_users').updateOne(
        { chatId },
        { $set: { lastSeen: new Date() } }
    );
    
    msg._id = result.insertedId;
    return msg;
}

async function updateMessage(messageId, updates) {
    return await db.collection('chat_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $set: updates }
    );
}

async function deleteMessage(messageId) {
    return await db.collection('chat_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $set: { deleted: true, message: 'This message was deleted' } }
    );
}

async function getAdminChatList(search = '') {
    let query = { status: 'active' };
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { phoneEmail: { $regex: search, $options: 'i' } }
        ];
    }
    
    const users = await db.collection('chat_users')
        .find(query)
        .sort({ lastSeen: -1 })
        .toArray();
    
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages')
            .findOne({ chatId: u.chatId, deleted: { $ne: true } }, { sort: { createdAt: -1 } });
        
        const unread = await db.collection('chat_messages')
            .countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        
        const mediaCount = await db.collection('chat_messages')
            .countDocuments({ chatId: u.chatId, mediaUrl: { $ne: null } });
        
        list.push({
            chatId: u.chatId,
            name: u.name,
            phoneEmail: u.phoneEmail,
            lastSeen: u.lastSeen,
            lastMessage: lastMsg,
            unread,
            mediaCount,
            status: u.status
        });
    }
    return list;
}

async function markMessagesRead(chatId) {
    const result = await db.collection('chat_messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
    return result.modifiedCount;
}

async function getChatMedia(chatId, type = null) {
    let query = { chatId, mediaUrl: { $ne: null } };
    if (type) {
        query.mediaType = type;
    }
    return await db.collection('chat_messages')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
}

// ==================== HTML TEMPLATES ====================
function getMainHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Verification Hub 2026</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}
.glass{background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.05)}
.glass-card{background:rgba(255,255,255,0.02);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:20px}
.msg-btn{position:fixed;bottom:20px;right:20px;z-index:9999;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0084ff,#00b4ff);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,132,255,0.4);display:flex;align-items:center;justify-content:center;transition:all 0.3s}
.msg-btn:hover{transform:scale(1.05)}
.msg-btn svg{width:28px;height:28px;fill:white}
.badge{position:absolute;top:-5px;right:-5px;background:#ff3b30;color:white;border-radius:50%;min-width:22px;height:22px;font-size:11px;font-weight:bold;display:none;align-items:center;justify-content:center;border:2px solid #0a0a0a}
.chat-box{position:fixed;bottom:90px;right:20px;width:380px;height:600px;max-height:calc(100vh - 120px);background:#1a1a1a;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);display:none;flex-direction:column;border:1px solid rgba(255,255,255,0.1)}
.chat-box.open{display:flex}
.chat-head{background:linear-gradient(135deg,#0084ff,#00b4ff);padding:16px 20px;display:flex;align-items:center;gap:12px;color:white}
.chat-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:bold;position:relative}
.online-dot{width:10px;height:10px;background:#4cd137;border-radius:50%;position:absolute;bottom:0;right:0;border:2px solid #0084ff}
.chat-close{background:rgba(255,255,255,0.2);border:none;color:white;width:30px;height:30px;border-radius:50%;cursor:pointer}
.chat-msgs{flex:1;overflow-y:auto;padding:20px;background:#141414;display:flex;flex-direction:column;gap:2px}
.msg-row{display:flex;margin-bottom:2px}
.msg-row.sent{justify-content:flex-end}
.msg-row.received{justify-content:flex-start}
.msg-bubble{max-width:75%;padding:8px 12px;border-radius:18px;font-size:14px;line-height:1.4;word-wrap:break-word}
.msg-row.sent .msg-bubble{background:#0084ff;color:white;border-bottom-right-radius:4px}
.msg-row.received .msg-bubble{background:#2c2c2c;color:white;border-bottom-left-radius:4px}
.msg-time{font-size:11px;opacity:0.7;margin-top:4px}
.msg-row.sent .msg-time{text-align:right}
.msg-media img{max-width:200px;max-height:200px;border-radius:12px;cursor:pointer}
.msg-media audio{width:200px;height:40px}
.chat-login{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;background:#141414}
.chat-login input{width:100%;padding:12px 16px;background:#2c2c2c;border:1px solid #3a3a3a;border-radius:12px;color:white;font-size:14px;outline:none;margin-bottom:12px}
.chat-login input:focus{border-color:#0084ff}
.chat-login button{width:100%;padding:12px;background:#0084ff;color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer}
.chat-input-box{background:#1a1a1a;padding:12px 16px;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(255,255,255,0.05)}
.chat-input-box input{flex:1;padding:10px 16px;background:#2c2c2c;border:none;border-radius:24px;color:white;font-size:14px;outline:none}
.send-btn{width:36px;height:36px;border-radius:50%;background:#0084ff;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center}
@media(max-width:480px){.chat-box{width:100%;height:100%;max-height:100vh;bottom:0;right:0;border-radius:0}}
</style>
</head>
<body>
<nav class="glass sticky top-0 z-40 px-4 py-3"><div class="max-w-6xl mx-auto flex items-center justify-between"><span class="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Verification Hub 2026</span></div></nav>
<main class="max-w-4xl mx-auto px-4 py-8 text-center"><h1 class="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">Baiilla Maach Official</h1><p class="text-gray-400">Verified Creator</p></main>
<div class="msg-btn" onclick="toggleChat()" id="msgBtn"><svg viewBox="0 0 24 24"><path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.38 5.54 3.69 7.22V22l3.45-1.89c.9.25 1.86.38 2.86.38 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm1.13 12.72l-2.55-2.72-4.97 2.72 5.47-5.8 2.55 2.72 4.97-2.72-5.47 5.8z"/></svg><span class="badge" id="badge">0</span></div>
<div class="chat-box" id="chatBox">
<div class="chat-head"><div class="chat-avatar">H<div class="online-dot"></div></div><div style="flex:1"><div style="font-weight:600">Hammad Bin Amir</div><div style="font-size:12px;opacity:0.9">Active now</div></div><button class="chat-close" onclick="toggleChat()">✕</button></div>
<div class="chat-login" id="loginUI"><div style="font-size:48px;margin-bottom:16px">💬</div><h3 style="font-size:18px;margin-bottom:8px">Chat with Hammad</h3><p style="color:#999;font-size:13px;margin-bottom:24px">Enter your details</p><input type="text" id="uName" placeholder="Your name"><input type="text" id="uContact" placeholder="Phone or email"><button onclick="startChat()">Start Chat</button></div>
<div id="chatUI" style="display:none;flex:1;flex-direction:column"><div class="chat-msgs" id="msgContainer"><div style="text-align:center;color:#666;font-size:12px;padding:20px">Messages are secure</div></div><div class="chat-input-box"><input type="text" id="msgInput" placeholder="Aa" onkeypress="if(event.key==='Enter')sendMsg()"><input type="file" id="fileInp" style="display:none" onchange="sendFile(this)" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"><button class="send-btn" onclick="sendMsg()">➤</button></div></div>
</div>
<script>
let token=localStorage.getItem('ct2026'),chatId=null,poll=null,unread=0;
if(token)verifyToken();
function toggleChat(){var b=document.getElementById('chatBox');b.classList.toggle('open');if(b.classList.contains('open')){document.getElementById('badge').style.display='none';unread=0;if(token)scrollBottom()}}
async function verifyToken(){try{var r=await fetch('/api/chat/verify?token='+encodeURIComponent(token));var d=await r.json();if(d.success){chatId=d.chatId;showUI();loadMsgs();startPoll()}else logout()}catch(e){}}
async function startChat(){var n=document.getElementById('uName').value.trim(),c=document.getElementById('uContact').value.trim();if(!n||!c){alert('Fill all fields');return}
try{var r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phoneEmail:c})});var d=await r.json();if(d.success){token=d.token;chatId=d.chatId;localStorage.setItem('ct2026',token);showUI();loadMsgs();startPoll()}else alert(d.error||'Failed')}catch(e){alert('Error')}}
function showUI(){document.getElementById('loginUI').style.display='none';var u=document.getElementById('chatUI');u.style.display='flex';u.style.flex='1'}
function logout(){localStorage.removeItem('ct2026');token=null;chatId=null;clearInterval(poll);document.getElementById('loginUI').style.display='flex';document.getElementById('chatUI').style.display='none'}
async function loadMsgs(){if(!token)return;try{var r=await fetch('/api/chat/messages?token='+encodeURIComponent(token)+'&_='+Date.now());var d=await r.json();if(d.success)renderMsgs(d.messages);else logout()}catch(e){}}
function renderMsgs(msgs){var c=document.getElementById('msgContainer'),wasBot=c.scrollHeight-c.scrollTop-c.clientHeight<100;c.innerHTML='<div style="text-align:center;color:#666;font-size:12px;padding:10px">Messages are secure</div>';msgs.forEach(function(m){var isSent=m.sender==='user',w=document.createElement('div');w.className='msg-row '+(isSent?'sent':'received');var html='';if(m.mediaUrl){if(m.mediaType==='image')html+='<div class="msg-media"><img src="'+m.mediaUrl+'" onclick="window.open(\''+m.mediaUrl+'\',\'_blank\')" loading="lazy"></div>';else if(m.mediaType==='audio'||m.mediaType==='voice')html+='<div class="msg-media"><audio controls src="'+m.mediaUrl+'"></audio></div>';else if(m.mediaType==='video')html+='<div class="msg-media"><video controls src="'+m.mediaUrl+'" style="max-width:200px;border-radius:12px"></video></div>';else if(m.mediaType==='file')html+='<div style="background:rgba(255,255,255,0.1);padding:8px 12px;border-radius:12px">'+m.fileName+'</div>'}
if(m.message)html+=m.message;html+='<div class="msg-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(isSent)html+=' ✓✓';html+='</div>';w.innerHTML='<div class="msg-bubble">'+html+'</div>';c.appendChild(w)});if(wasBot||c.scrollTop>c.scrollHeight-200)c.scrollTop=c.scrollHeight}
function startPoll(){if(poll)clearInterval(poll);poll=setInterval(loadMsgs,2000)}
async function sendMsg(){var i=document.getElementById('msgInput'),m=i.value.trim();if(!m||!token)return;i.value='';try{await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,message:m})});loadMsgs()}catch(e){}}
async function sendFile(inp){var f=inp.files[0];if(!f||!token)return;var fd=new FormData();fd.append('token',token);fd.append('file',f);try{await fetch('/api/chat/upload',{method:'POST',body:fd});loadMsgs()}catch(e){}inp.value=''}
function scrollBottom(){var c=document.getElementById('msgContainer');if(c)c.scrollTop=c.scrollHeight}
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}</style>
</head>
<body>
<div style="background:#1a1a1a;padding:40px;border-radius:20px;width:100%;max-width:380px;border:1px solid rgba(255,255,255,0.1)">
<h2 style="font-size:24px;font-weight:bold;color:white;text-align:center;margin-bottom:32px">Admin Login</h2>
${error ? `<div style="background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);color:#ff3b30;padding:12px;border-radius:12px;margin-bottom:20px;font-size:14px;text-align:center">${error}</div>` : ''}
<form method="POST" action="/admin/login">
<div style="margin-bottom:20px"><label style="display:block;color:#999;font-size:14px;margin-bottom:8px">Username</label><input type="text" name="username" style="width:100%;padding:12px 16px;background:#2c2c2c;border:1px solid #3a3a3a;border-radius:12px;color:white;font-size:14px;outline:none" required></div>
<div style="margin-bottom:24px"><label style="display:block;color:#999;font-size:14px;margin-bottom:8px">Password</label><input type="password" name="password" style="width:100%;padding:12px 16px;background:#2c2c2c;border:1px solid #3a3a3a;border-radius:12px;color:white;font-size:14px;outline:none" required></div>
<button type="submit" style="width:100%;padding:12px;background:#0084ff;color:white;border:none;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer">Sign In</button>
</form>
<div style="text-align:center;margin-top:24px"><a href="/" style="color:#666;font-size:14px;text-decoration:none">Back to Site</a></div>
</div>
</body>
</html>`;
}

function getAdminPanelHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0084ff">
<title>Messenger Inbox</title>
<script src="/socket.io/socket.io.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
<style>
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --primary: #0084ff;
  --bg-primary: #000000;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #2c2c2c;
  --text-primary: #ffffff;
  --text-secondary: #999999;
  --border-color: rgba(255,255,255,0.08);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
}

.app-container {
  display: flex;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  position: relative;
}

.sidebar {
  width: 380px;
  min-width: 380px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  z-index: 10;
}

.main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  min-width: 0;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 5;
}

.sidebar-header h1 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #0084ff, #00b4ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.search-box {
  position: relative;
  margin-bottom: 12px;
}

.search-box input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: 24px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.search-box input:focus {
  border-color: var(--primary);
  background: #333;
}

.search-box i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 14px;
}

.filter-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.filter-tabs::-webkit-scrollbar {
  display: none;
}

.filter-tab {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: none;
  transition: all 0.2s;
}

.filter-tab.active {
  background: var(--primary);
  color: white;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.conversation-list::-webkit-scrollbar {
  width: 4px;
}

.conversation-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.15s;
  border-left: 3px solid transparent;
  position: relative;
}

.conversation-item:hover {
  background: rgba(255,255,255,0.03);
}

.conversation-item.active {
  background: rgba(0,132,255,0.1);
  border-left-color: var(--primary);
}

.conversation-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0084ff, #00b4ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
  position: relative;
}

.online-indicator {
  width: 12px;
  height: 12px;
  background: #4cd137;
  border-radius: 50%;
  position: absolute;
  bottom: 2px;
  right: 2px;
  border: 2px solid var(--bg-secondary);
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 2px;
}

.conversation-preview {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.conversation-meta {
  text-align: right;
  flex-shrink: 0;
}

.conversation-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.unread-badge {
  background: var(--primary);
  color: white;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.main-chat-header {
  padding: 14px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 5;
}

.chat-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0084ff, #00b4ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.chat-header-info {
  flex: 1;
}

.chat-header-name {
  font-weight: 600;
  font-size: 16px;
}

.chat-header-status {
  font-size: 12px;
  color: #4cd137;
}

.chat-header-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  font-size: 16px;
}

.icon-btn:hover {
  background: rgba(0,132,255,0.1);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.messages-container::-webkit-scrollbar {
  width: 4px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}

.date-separator {
  text-align: center;
  padding: 16px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.message-wrapper {
  display: flex;
  margin-bottom: 2px;
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-wrapper.sent {
  justify-content: flex-end;
}

.message-wrapper.received {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 65%;
  padding: 8px 14px;
  border-radius: 20px;
  position: relative;
  word-wrap: break-word;
  font-size: 14px;
  line-height: 1.45;
}

.message-wrapper.sent .message-bubble {
  background: var(--primary);
  color: white;
  border-bottom-right-radius: 6px;
}

.message-wrapper.received .message-bubble {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-bottom-left-radius: 6px;
}

.message-content {
  word-wrap: break-word;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 2px;
  font-size: 11px;
  opacity: 0.8;
}

.message-media {
  margin: 4px 0;
  border-radius: 12px;
  overflow: hidden;
}

.message-media img {
  max-width: 240px;
  max-height: 240px;
  border-radius: 12px;
  cursor: pointer;
  display: block;
}

.message-media video {
  max-width: 240px;
  max-height: 240px;
  border-radius: 12px;
}

.message-media audio {
  width: 220px;
  height: 40px;
}

.message-file {
  background: rgba(255,255,255,0.05);
  padding: 8px 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.message-file a {
  color: #40c4ff;
  text-decoration: none;
}

.reply-preview {
  background: rgba(255,255,255,0.05);
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  border-left: 3px solid var(--primary);
  cursor: pointer;
}

.typing-indicator {
  padding: 0 20px 8px;
  display: none;
}

.typing-dots {
  display: inline-flex;
  gap: 3px;
  padding: 8px 14px;
  background: var(--bg-tertiary);
  border-radius: 18px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

.message-input-area {
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: flex-end;
  gap: 8px;
  position: sticky;
  bottom: 0;
}

.message-input-area textarea {
  flex: 1;
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: 24px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  resize: none;
  max-height: 120px;
  font-family: inherit;
  line-height: 1.4;
}

.message-input-area textarea:focus {
  border-color: var(--primary);
}

.message-input-area textarea::placeholder {
  color: #666;
}

.send-button {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--primary);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.send-button:hover {
  background: #0073e6;
  transform: scale(1.05);
}

.send-button:active {
  transform: scale(0.95);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 40px;
}

.empty-state i {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.user-info-panel {
  width: 320px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
  display: none;
}

.user-info-panel.visible {
  display: block;
}

.info-section {
  margin-bottom: 24px;
}

.info-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.info-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.media-grid img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
}

.emoji-picker {
  position: absolute;
  bottom: 70px;
  right: 20px;
  width: 320px;
  height: 300px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  display: none;
  z-index: 100;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.emoji-picker.visible {
  display: block;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 12px;
  overflow-y: auto;
  height: 100%;
}

.emoji-item {
  font-size: 24px;
  padding: 4px;
  cursor: pointer;
  text-align: center;
  border-radius: 8px;
  transition: background 0.15s;
}

.emoji-item:hover {
  background: rgba(255,255,255,0.1);
}

.context-menu {
  position: fixed;
  background: #2c2c2c;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 8px;
  min-width: 200px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  z-index: 1000;
  display: none;
}

.context-menu.visible {
  display: block;
}

.context-menu-item {
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: rgba(255,255,255,0.05);
}

.context-menu-item.danger {
  color: #ff3b30;
}

.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 14px;
  z-index: 2000;
  animation: toastIn 0.3s ease;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    min-width: 100%;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    z-index: 20;
    transition: transform 0.3s;
  }
  
  .sidebar.hidden {
    transform: translateX(-100%);
  }
  
  .main-chat {
    width: 100%;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
  }
  
  .user-info-panel {
    width: 100%;
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 30;
    transition: transform 0.3s;
  }
  
  .user-info-panel.hidden {
    transform: translateX(100%);
  }
  
  .message-bubble {
    max-width: 80%;
  }
  
  .back-button {
    display: flex !important;
  }
}

.back-button {
  display: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--primary);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-right: 8px;
}

@media (min-width: 769px) {
  .back-button {
    display: none !important;
  }
}
</style>
</head>
<body>

<div class="app-container" id="appContainer">
  
  <div class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <h1>Inbox</h1>
        <div style="display:flex;gap:4px">
          <a href="/" style="color:var(--text-secondary);text-decoration:none;font-size:13px;padding:6px 12px;background:var(--bg-tertiary);border-radius:16px">Site</a>
          <a href="/admin/logout" style="color:var(--text-secondary);text-decoration:none;font-size:13px;padding:6px 12px;background:var(--bg-tertiary);border-radius:16px">Logout</a>
        </div>
      </div>
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="searchInput" placeholder="Search conversations..." oninput="searchConversations()">
      </div>
      <div class="filter-tabs">
        <button class="filter-tab active" onclick="filterChats('all', this)">All</button>
        <button class="filter-tab" onclick="filterChats('unread', this)">Unread</button>
        <button class="filter-tab" onclick="filterChats('active', this)">Active</button>
      </div>
    </div>
    <div class="conversation-list" id="conversationList"></div>
  </div>

  <div class="main-chat" id="mainChat">
    <div class="main-chat-header" id="chatHeader">
      <button class="back-button" onclick="showSidebar()">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="chat-header-avatar" id="chatAvatar">?</div>
      <div class="chat-header-info">
        <div class="chat-header-name" id="chatName">Select a conversation</div>
        <div class="chat-header-status" id="chatStatus"></div>
      </div>
      <div class="chat-header-actions">
        <button class="icon-btn" onclick="toggleUserInfo()" title="User info">
          <i class="fas fa-info-circle"></i>
        </button>
        <button class="icon-btn" onclick="searchMessages()" title="Search in conversation">
          <i class="fas fa-search"></i>
        </button>
      </div>
    </div>
    
    <div class="messages-container" id="messagesContainer">
      <div class="empty-state" id="emptyState">
        <i class="fas fa-comments"></i>
        <h3>Messenger Inbox</h3>
        <p>Select a conversation to start messaging</p>
      </div>
    </div>
    
    <div class="typing-indicator" id="typingIndicator">
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
    
    <div class="message-input-area" id="messageInputArea" style="display:none">
      <button class="icon-btn" onclick="toggleEmojiPicker()" title="Emoji">
        <i class="far fa-smile"></i>
      </button>
      <button class="icon-btn" onclick="document.getElementById('adminFileInput').click()" title="Attach">
        <i class="fas fa-paperclip"></i>
      </button>
      <input type="file" id="adminFileInput" style="display:none" onchange="sendAdminFile(this)" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt">
      <textarea id="adminMessageInput" placeholder="Aa" rows="1" onkeydown="handleAdminKeyPress(event)" oninput="autoResize(this)"></textarea>
      <button class="icon-btn" id="voiceRecordBtn" onclick="toggleAdminVoiceRecording()" title="Voice">
        <i class="fas fa-microphone"></i>
      </button>
      <button class="send-button" onclick="sendAdminMessage()">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>

  <div class="user-info-panel" id="userInfoPanel">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h3 style="font-size:18px;font-weight:600">User Info</h3>
      <button class="icon-btn" onclick="toggleUserInfo()">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div id="userInfoContent"></div>
  </div>

  <div class="emoji-picker" id="emojiPicker">
    <div class="emoji-grid" id="emojiGrid"></div>
  </div>

</div>

<div class="context-menu" id="contextMenu"></div>

<script>
const socket = io();
let currentChatId = null;
let currentChatUser = null;
let allConversations = [];
let currentFilter = 'all';
let messagePollInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let replyToMessage = null;
let selectedMessageId = null;

const EMOJIS = ['😀','😂','😍','🥰','😎','🤩','😇','🙂','😊','🥳','😡','😢','😭','😤','🥺','❤️','🔥','👍','👎','🎉','✨','💯','✅','❌','⭐','💬','📎','📷','🎤','🎵','📁','💡','🚀','💪','🙏','👋','🤝','💼','📱','💻','🖥️','⌨️','🖱️','🔒','🔓','🔔','🔕','📌','📍'];

function initEmojiPicker() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = EMOJIS.map(e => '<div class="emoji-item" onclick="insertEmoji(\'' + e + '\')">' + e + '</div>').join('');
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.classList.toggle('visible');
}

function insertEmoji(emoji) {
  const input = document.getElementById('adminMessageInput');
  input.value += emoji;
  input.focus();
  document.getElementById('emojiPicker').classList.remove('visible');
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

socket.on('connect', () => {
  console.log('Connected to server');
  loadConversations();
});

socket.on('new_message', (data) => {
  if (data.chatId === currentChatId) {
    appendMessage(data.message, true);
  }
  loadConversations();
});

socket.on('message_updated', (data) => {
  if (data.chatId === currentChatId) {
    updateMessageInUI(data.messageId, data.updates);
  }
});

socket.on('user_typing', (data) => {
  if (data.chatId === currentChatId) {
    showTypingIndicator();
  }
});

socket.on('user_online', (data) => {
  updateUserStatus(data.chatId, data.status);
});

async function loadConversations() {
  try {
    const response = await fetch('/api/admin/conversations');
    const data = await response.json();
    if (data.success) {
      allConversations = data.conversations;
      renderConversations();
    }
  } catch (e) {
    console.error('Failed to load conversations:', e);
  }
}

function renderConversations() {
  const list = document.getElementById('conversationList');
  let filtered = allConversations;
  
  if (currentFilter === 'unread') {
    filtered = allConversations.filter(c => c.unread > 0);
  }
  
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  if (searchQuery) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(searchQuery) || 
      c.phoneEmail.toLowerCase().includes(searchQuery)
    );
  }
  
  list.innerHTML = filtered.map(conv => {
    const lastMsgText = conv.lastMessage ? 
      (conv.lastMessage.mediaType ? '📎 Media' : (conv.lastMessage.message || '').substring(0, 30)) : 
      'No messages';
    
    const time = conv.lastMessage ? 
      formatTime(conv.lastMessage.createdAt) : 
      formatTime(conv.lastSeen);
    
    return '<div class="conversation-item' + (conv.chatId === currentChatId ? ' active' : '') + '" onclick="selectConversation(\'' + conv.chatId + '\')">' +
      '<div class="conversation-avatar">' +
        conv.name.charAt(0).toUpperCase() +
        '<div class="online-indicator"></div>' +
      '</div>' +
      '<div class="conversation-info">' +
        '<div class="conversation-name">' + escapeHtml(conv.name) + '</div>' +
        '<div class="conversation-preview">' + escapeHtml(lastMsgText) + '</div>' +
      '</div>' +
      '<div class="conversation-meta">' +
        '<div class="conversation-time">' + time + '</div>' +
        (conv.unread > 0 ? '<div class="unread-badge">' + conv.unread + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

async function selectConversation(chatId) {
  currentChatId = chatId;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('messageInputArea').style.display = 'flex';
  document.getElementById('messagesContainer').innerHTML = '';
  
  if (window.innerWidth < 769) {
    document.getElementById('sidebar').classList.add('hidden');
  }
  
  renderConversations();
  await loadMessages();
  await markAsRead();
  loadUserInfo();
  
  document.getElementById('chatName').textContent = currentChatUser ? currentChatUser.name : 'Unknown';
  document.getElementById('chatAvatar').textContent = currentChatUser ? currentChatUser.name.charAt(0).toUpperCase() : '?';
  document.getElementById('chatStatus').textContent = 'Active';
}

function showSidebar() {
  document.getElementById('sidebar').classList.remove('hidden');
}

async function loadMessages(before = null) {
  if (!currentChatId) return;
  
  try {
    let url = '/api/admin/messages?chatId=' + currentChatId;
    if (before) url += '&before=' + before;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      const container = document.getElementById('messagesContainer');
      
      if (!before) {
        container.innerHTML = '';
      }
      
      let lastDate = null;
      
      data.messages.forEach(msg => {
        const msgDate = new Date(msg.createdAt).toDateString();
        if (msgDate !== lastDate) {
          lastDate = msgDate;
          container.insertAdjacentHTML('beforeend', 
            '<div class="date-separator">' + formatDate(msg.createdAt) + '</div>'
          );
        }
        
        appendMessage(msg, false);
      });
      
      if (!before) {
        scrollToBottom();
      }
    }
  } catch (e) {
    console.error('Failed to load messages:', e);
  }
}

function appendMessage(msg, scroll = true) {
  const container = document.getElementById('messagesContainer');
  const isSent = msg.sender === 'admin';
  const existing = document.getElementById('msg-' + msg._id);
  if (existing) {
    if (msg.deleted) {
      existing.querySelector('.message-content').textContent = 'This message was deleted';
      existing.querySelector('.message-content').style.fontStyle = 'italic';
    }
    if (msg.edited) {
      existing.querySelector('.message-content').textContent = msg.message + ' (edited)';
    }
    return;
  }
  
  let html = '<div class="message-wrapper ' + (isSent ? 'sent' : 'received') + '" id="msg-' + msg._id + '">';
  html += '<div class="message-bubble">';
  
  if (msg.replyTo) {
    html += '<div class="reply-preview">↩ Replying to a message</div>';
  }
  
  if (msg.mediaUrl) {
    html += '<div class="message-media">';
    if (msg.mediaType === 'image') {
      html += '<img src="' + msg.mediaUrl + '" onclick="window.open(\'' + msg.mediaUrl + '\', \'_blank\')" loading="lazy">';
    } else if (msg.mediaType === 'audio' || msg.mediaType === 'voice') {
      html += '<audio controls src="' + msg.mediaUrl + '"></audio>';
    } else if (msg.mediaType === 'video') {
      html += '<video controls src="' + msg.mediaUrl + '"></video>';
    } else {
      html += '<div class="message-file">📎 <a href="' + msg.mediaUrl + '" target="_blank">' + (msg.fileName || 'Download') + '</a></div>';
    }
    html += '</div>';
  }
  
  if (msg.message) {
    html += '<div class="message-content">' + escapeHtml(msg.deleted ? 'This message was deleted' : msg.message) + (msg.edited ? ' (edited)' : '') + '</div>';
  }
  
  html += '<div class="message-meta">';
  html += formatTime(msg.createdAt);
  if (isSent) {
    if (msg.read) {
      html += ' ✓✓';
    } else if (msg.delivered) {
      html += ' ✓';
    }
  }
  html += '</div>';
  html += '</div></div>';
  
  container.insertAdjacentHTML('beforeend', html);
  
  if (scroll) {
    scrollToBottom();
  }
}

function updateMessageInUI(messageId, updates) {
  const el = document.getElementById('msg-' + messageId);
  if (!el) return;
  
  if (updates.deleted) {
    el.querySelector('.message-content').textContent = 'This message was deleted';
  }
  if (updates.edited) {
    el.querySelector('.message-content').textContent = updates.message + ' (edited)';
  }
  if (updates.read) {
    const meta = el.querySelector('.message-meta');
    if (meta && !meta.textContent.includes('✓✓')) {
      meta.textContent = meta.textContent.replace('✓', '✓✓');
    }
  }
}

async function sendAdminMessage() {
  const input = document.getElementById('adminMessageInput');
  const message = input.value.trim();
  if (!message || !currentChatId) return;
  
  input.value = '';
  input.style.height = 'auto';
  
  try {
    const response = await fetch('/api/admin/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: currentChatId,
        message: message,
        replyTo: replyToMessage
      })
    });
    
    const data = await response.json();
    if (data.success) {
      appendMessage(data.message);
      replyToMessage = null;
      socket.emit('admin_message', { chatId: currentChatId, message: data.message });
    }
  } catch (e) {
    console.error('Failed to send message:', e);
  }
}

async function sendAdminFile(input) {
  const files = input.files;
  if (!files.length || !currentChatId) return;
  
  for (const file of files) {
    const formData = new FormData();
    formData.append('chatId', currentChatId);
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        appendMessage(data.message);
        socket.emit('admin_message', { chatId: currentChatId, message: data.message });
      }
    } catch (e) {
      console.error('Upload failed:', e);
    }
  }
  
  input.value = '';
}

async function toggleAdminVoiceRecording() {
  const btn = document.getElementById('voiceRecordBtn');
  
  if (isRecording) {
    mediaRecorder.stop();
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
    btn.style.color = '';
    isRecording = false;
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = event => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('chatId', currentChatId);
      formData.append('file', audioBlob, 'voice_note.webm');
      
      try {
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        if (data.success) {
          appendMessage(data.message);
          socket.emit('admin_message', { chatId: currentChatId, message: data.message });
        }
      } catch (e) {
        console.error('Voice upload failed:', e);
      }
      
      stream.getTracks().forEach(t => t.stop());
    };
    
    mediaRecorder.start();
    btn.innerHTML = '<i class="fas fa-stop"></i>';
    btn.style.color = '#ff3b30';
    isRecording = true;
    
    setTimeout(() => {
      if (isRecording) {
        mediaRecorder.stop();
        btn.innerHTML = '<i class="fas fa-microphone"></i>';
        btn.style.color = '';
        isRecording = false;
      }
    }, 60000);
    
  } catch (e) {
    alert('Microphone access denied');
  }
}

async function markAsRead() {
  if (!currentChatId) return;
  
  try {
    await fetch('/api/admin/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: currentChatId })
    });
  } catch (e) {
    console.error('Failed to mark as read:', e);
  }
}

async function loadUserInfo() {
  if (!currentChatId) return;
  
  try {
    const response = await fetch('/api/admin/user-info?chatId=' + currentChatId);
    const data = await response.json();
    
    if (data.success) {
      const user = data.user;
      currentChatUser = user;
      
      document.getElementById('userInfoContent').innerHTML = 
        '<div class="info-section">' +
          '<h4>Contact Info</h4>' +
          '<div class="info-item"><div class="info-label">Name</div><div class="info-value">' + escapeHtml(user.name) + '</div></div>' +
          '<div class="info-item"><div class="info-label">Contact</div><div class="info-value">' + escapeHtml(user.phoneEmail) + '</div></div>' +
          '<div class="info-item"><div class="info-label">Chat ID</div><div class="info-value">' + user.chatId + '</div></div>' +
        '</div>' +
        '<div class="info-section">' +
          '<h4>Activity</h4>' +
          '<div class="info-item"><div class="info-label">Last Active</div><div class="info-value">' + formatDateTime(user.lastSeen) + '</div></div>' +
          '<div class="info-item"><div class="info-label">Status</div><div class="info-value">' + (user.status || 'Active') + '</div></div>' +
        '</div>' +
        '<div class="info-section">' +
          '<h4>Actions</h4>' +
          '<button onclick="blockUser()" style="width:100%;padding:10px;background:#ff3b30;color:white;border:none;border-radius:12px;cursor:pointer;margin-bottom:8px">Block User</button>' +
          '<button onclick="deleteConversation()" style="width:100%;padding:10px;background:transparent;color:#ff3b30;border:1px solid #ff3b30;border-radius:12px;cursor:pointer">Delete Chat</button>' +
        '</div>';
    }
  } catch (e) {
    console.error('Failed to load user info:', e);
  }
}

function toggleUserInfo() {
  const panel = document.getElementById('userInfoPanel');
  panel.classList.toggle('visible');
}

function showTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  indicator.style.display = 'block';
  setTimeout(() => {
    indicator.style.display = 'none';
  }, 3000);
}

function handleAdminKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendAdminMessage();
  }
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 100);
}

function searchConversations() {
  renderConversations();
}

function filterChats(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderConversations();
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString([], { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateUserStatus(chatId, status) {
  const item = document.querySelector('.conversation-item[data-chatid="' + chatId + '"]');
  if (item) {
    const indicator = item.querySelector('.online-indicator');
    if (indicator) {
      indicator.style.background = status === 'online' ? '#4cd137' : '#666';
    }
  }
}

async function blockUser() {
  if (!confirm('Block this user?')) return;
  try {
    await fetch('/api/admin/block-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: currentChatId })
    });
    loadConversations();
    showToast('User blocked');
  } catch (e) {
    console.error(e);
  }
}

async function deleteConversation() {
  if (!confirm('Delete this conversation?')) return;
  try {
    await fetch('/api/admin/delete-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: currentChatId })
    });
    currentChatId = null;
    document.getElementById('messagesContainer').innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><h3>Select a conversation</h3></div>';
    document.getElementById('messageInputArea').style.display = 'none';
    document.getElementById('chatName').textContent = 'Select a conversation';
    loadConversations();
    showToast('Conversation deleted');
  } catch (e) {
    console.error(e);
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('click', (e) => {
  const picker = document.getElementById('emojiPicker');
  if (picker.classList.contains('visible') && !picker.contains(e.target) && e.target !== document.querySelector('[onclick="toggleEmojiPicker()"]')) {
    picker.classList.remove('visible');
  }
});

initEmojiPicker();
loadConversations();
setInterval(loadConversations, 10000);
</script>
</body>
</html>`;
}

// ==================== SERVER ====================
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Static assets
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403);
            res.end();
            return;
        }
        
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': getMimeType(ext),
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }
    
    // Socket.IO client
    if (pathname === '/socket.io/socket.io.js') {
        const socketPath = path.join(__dir, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js');
        if (fs.existsSync(socketPath)) {
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            fs.createReadStream(socketPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }
    
    // ==================== CHAT API ====================
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
                const token = await createChatSession(user.chatId);
                
                const messages = await getChatMessages(user.chatId);
                if (messages.length === 0) {
                    await saveChatMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to the chat. How can I help you today?');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token, name: user.name }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/verify' && method === 'GET') {
        const token = parsedUrl.query.token;
        const user = await getChatUserByToken(token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!user, chatId: user ? user.chatId : null }));
        return;
    }
    
    if (pathname === '/api/chat/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const user = await getChatUserByToken(token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
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
                const { token, message } = JSON.parse(body);
                if (!token || !message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false }));
                    return;
                }
                
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false }));
                    return;
                }
                
                const msg = await saveChatMessage(user.chatId, 'user', message);
                
                // Notify admin via Socket.IO
                io.to('admin_room').emit('new_message', { chatId: user.chatId, message: msg });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: msg }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/upload' && method === 'POST') {
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_MEDIA_DIR,
            keepExtensions: true,
            maxFileSize: 20 * 1024 * 1024
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
                return;
            }
            
            const token = Array.isArray(fields.token) ? fields.token[0] : fields.token;
            const user = await getChatUserByToken(token);
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const file = Array.isArray(files.file) ? files.file[0] : files.file;
            if (!file || !file.originalFilename) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No file' }));
                return;
            }
            
            const ext = path.extname(file.originalFilename).toLowerCase();
            const fn = Date.now() + '_' + crypto.randomBytes(8).toString('hex') + ext;
            const filePath = path.join(CHAT_MEDIA_DIR, fn);
            
            try {
                fs.renameSync(file.filepath, filePath);
                
                let mediaType = 'file';
                const imageExts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg'];
                const audioExts = ['.mp3','.wav','.ogg','.m4a','.aac','.flac','.webm'];
                const videoExts = ['.mp4','.webm','.avi','.mov','.mkv'];
                
                if (imageExts.includes(ext)) mediaType = 'image';
                else if (audioExts.includes(ext)) mediaType = 'audio';
                else if (videoExts.includes(ext)) mediaType = 'video';
                
                const mediaUrl = '/assets/chatmedia/' + encodeURIComponent(fn);
                const msg = await saveChatMessage(user.chatId, 'user', '', mediaUrl, mediaType, file.originalFilename, file.size);
                
                io.to('admin_room').emit('new_message', { chatId: user.chatId, message: msg });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: msg }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // ==================== ADMIN API ====================
    if (pathname === '/api/admin/conversations' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const search = parsedUrl.query.search || '';
        const conversations = await getAdminChatList(search);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, conversations }));
        return;
    }
    
    if (pathname === '/api/admin/messages' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const chatId = parsedUrl.query.chatId;
        const before = parsedUrl.query.before;
        const messages = await getChatMessages(chatId, 100, before);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    if (pathname === '/api/admin/send' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { chatId, message, replyTo } = JSON.parse(body);
                const msg = await saveChatMessage(chatId, 'admin', message, null, null, null, null, replyTo);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: msg }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }
    
    if (pathname === '/api/admin/upload' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_MEDIA_DIR,
            keepExtensions: true,
            maxFileSize: 20 * 1024 * 1024
        });
        
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const chatId = Array.isArray(fields.chatId) ? fields.chatId[0] : fields.chatId;
            const file = Array.isArray(files.file) ? files.file[0] : files.file;
            
            if (!file || !file.originalFilename) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            
            const ext = path.extname(file.originalFilename).toLowerCase();
            const fn = Date.now() + '_' + crypto.randomBytes(8).toString('hex') + ext;
            const filePath = path.join(CHAT_MEDIA_DIR, fn);
            
            try {
                fs.renameSync(file.filepath, filePath);
                
                let mediaType = 'file';
                const imageExts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg'];
                const audioExts = ['.mp3','.wav','.ogg','.m4a','.aac','.flac','.webm'];
                const videoExts = ['.mp4','.webm','.avi','.mov','.mkv'];
                
                if (imageExts.includes(ext)) mediaType = 'image';
                else if (audioExts.includes(ext)) mediaType = 'audio';
                else if (videoExts.includes(ext)) mediaType = 'video';
                
                const mediaUrl = '/assets/chatmedia/' + encodeURIComponent(fn);
                const msg = await saveChatMessage(chatId, 'admin', '', mediaUrl, mediaType, file.originalFilename, file.size);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: msg }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }
    
    if (pathname === '/api/admin/mark-read' && method === 'POST') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const { chatId } = JSON.parse(body);
            await markMessagesRead(chatId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    if (pathname === '/api/admin/user-info' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const chatId = parsedUrl.query.chatId;
        const user = await db.collection('chat_users').findOne({ chatId });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user }));
        return;
    }
    
    // ==================== ADMIN ROUTES ====================
    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getAdminPanelHTML());
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }
    
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            const admin = await db.collection('admin_users').findOne({ username });
            if (admin && await bcrypt.compare(password, admin.password)) {
                const sid = createSession(username);
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': 'sessionId=' + sid + ';HttpOnly;Path=/;Max-Age=7200;SameSite=Lax'
                });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid credentials'));
            }
        });
        return;
    }
    
    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0'
        });
        res.end();
        return;
    }
    
    // Home page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML());
        return;
    }
    
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('404 Not Found');
});

// ==================== SOCKET.IO SETUP ====================
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join admin room
    socket.on('join_admin', () => {
        socket.join('admin_room');
    });
    
    // Admin sends message
    socket.on('admin_message', (data) => {
        socket.to('user_' + data.chatId).emit('new_message', data);
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        socket.to('admin_room').emit('user_typing', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================
async function start() {
    await connectDB();
    
    server.listen(PORT, () => {
        console.log('Server running on port ' + PORT);
        console.log('Admin: http://localhost:' + PORT + '/admin');
        console.log('Login: admin / admin123');
    });
}

start();

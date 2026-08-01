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
        
        list.push({
            chatId: u.chatId,
            name: u.name,
            phoneEmail: u.phoneEmail,
            lastSeen: u.lastSeen,
            lastMessage: lastMsg,
            unread,
            status: u.status
        });
    }
    return list;
}

async function markMessagesRead(chatId) {
    return await db.collection('chat_messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
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
.msg-btn{position:fixed;bottom:30px;right:30px;z-index:9999;width:65px;height:65px;border-radius:50%;background:linear-gradient(135deg,#0084ff,#00b4ff);border:none;cursor:pointer;box-shadow:0 8px 30px rgba(0,132,255,0.5);display:flex;align-items:center;justify-content:center;transition:all 0.3s}
.msg-btn:hover{transform:scale(1.1);box-shadow:0 12px 40px rgba(0,132,255,0.6)}
.msg-btn svg{width:30px;height:30px;fill:white}
.badge{position:absolute;top:-8px;right:-8px;background:#ff3b30;color:white;border-radius:50%;min-width:24px;height:24px;font-size:12px;font-weight:bold;display:none;align-items:center;justify-content:center;border:3px solid #0a0a0a}
.chat-box{position:fixed;bottom:110px;right:30px;width:400px;height:600px;max-height:calc(100vh - 150px);background:#1a1a1a;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8);display:none;flex-direction:column;border:1px solid rgba(255,255,255,0.1);z-index:9998}
.chat-box.open{display:flex}
.chat-head{background:linear-gradient(135deg,#0084ff,#00b4ff);padding:16px 20px;display:flex;align-items:center;gap:12px;color:white;cursor:pointer}
.chat-avatar{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;position:relative}
.online-dot{width:12px;height:12px;background:#4cd137;border-radius:50%;position:absolute;bottom:0;right:0;border:3px solid #0084ff}
.chat-close{background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.2s}
.chat-close:hover{background:rgba(255,255,255,0.3)}
.chat-msgs{flex:1;overflow-y:auto;padding:20px;background:#141414;display:flex;flex-direction:column;gap:2px}
.chat-msgs::-webkit-scrollbar{width:6px}
.chat-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
.msg-row{display:flex;margin-bottom:4px;animation:msgIn 0.3s ease}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-row.sent{justify-content:flex-end}
.msg-row.received{justify-content:flex-start}
.msg-bubble{max-width:75%;padding:10px 14px;border-radius:20px;font-size:14px;line-height:1.5;word-wrap:break-word;position:relative}
.msg-row.sent .msg-bubble{background:#0084ff;color:white;border-bottom-right-radius:6px}
.msg-row.received .msg-bubble{background:#2c2c2c;color:white;border-bottom-left-radius:6px}
.msg-time{font-size:11px;opacity:0.7;margin-top:4px;display:flex;justify-content:flex-end;align-items:center;gap:4px}
.msg-media{margin:4px 0}
.msg-media img{max-width:200px;max-height:200px;border-radius:12px;cursor:pointer;display:block}
.msg-media audio{width:200px;height:40px;outline:none}
.msg-media video{max-width:200px;max-height:200px;border-radius:12px;outline:none}
.msg-file{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.1);padding:8px 12px;border-radius:12px;font-size:13px}
.chat-login{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 30px;background:#141414}
.chat-login-icon{font-size:64px;margin-bottom:16px}
.chat-login h3{font-size:20px;font-weight:600;margin-bottom:8px}
.chat-login p{color:#999;font-size:14px;margin-bottom:28px;text-align:center}
.chat-login input{width:100%;padding:14px 18px;background:#2c2c2c;border:2px solid #3a3a3a;border-radius:14px;color:white;font-size:15px;outline:none;margin-bottom:14px;transition:border-color 0.2s}
.chat-login input:focus{border-color:#0084ff}
.chat-login button{width:100%;padding:14px;background:linear-gradient(135deg,#0084ff,#00b4ff);color:white;border:none;border-radius:14px;font-weight:600;font-size:15px;cursor:pointer;transition:transform 0.2s}
.chat-login button:hover{transform:translateY(-1px)}
.chat-login button:active{transform:translateY(0)}
.chat-input-box{background:#1a1a1a;padding:14px 18px;display:flex;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,0.05)}
.chat-input-box input{flex:1;padding:12px 18px;background:#2c2c2c;border:none;border-radius:24px;color:white;font-size:14px;outline:none}
.chat-input-box input::placeholder{color:#666}
.send-btn{width:42px;height:42px;border-radius:50%;background:#0084ff;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}
.send-btn:hover{background:#0073e6;transform:scale(1.05)}
.send-btn:active{transform:scale(0.95)}
.send-btn svg{width:20px;height:20px;fill:white}
.attach-btn{width:40px;height:40px;border-radius:50%;background:transparent;border:none;color:#999;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;font-size:20px}
.attach-btn:hover{color:white;background:rgba(255,255,255,0.1)}
@media(max-width:480px){.chat-box{width:100%;height:100%;max-height:100vh;bottom:0;right:0;border-radius:0}.msg-btn{bottom:20px;right:20px;width:60px;height:60px}}
</style>
</head>
<body>
<nav class="glass sticky top-0 z-40 px-4 py-4"><div class="max-w-6xl mx-auto flex items-center justify-between"><span class="font-bold text-xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Verification Hub 2026</span></div></nav>
<main class="max-w-4xl mx-auto px-4 py-16 text-center"><h1 class="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">Baiilla Maach Official</h1><p class="text-gray-400 text-lg">Verified Creator ✨</p></main>

<!-- Chat Button -->
<button class="msg-btn" onclick="toggleChat()" id="msgBtn">
    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/></svg>
    <span class="badge" id="unreadBadge">0</span>
</button>

<!-- Chat Box -->
<div class="chat-box" id="chatBox">
    <div class="chat-head" onclick="toggleChat()">
        <div class="chat-avatar">H<div class="online-dot"></div></div>
        <div style="flex:1">
            <div style="font-weight:600;font-size:16px">Hammad Bin Amir</div>
            <div style="font-size:12px;opacity:0.9">Online now</div>
        </div>
        <button class="chat-close" onclick="event.stopPropagation();toggleChat()">✕</button>
    </div>
    
    <!-- Login Screen -->
    <div class="chat-login" id="loginScreen">
        <div class="chat-login-icon">💬</div>
        <h3>Start a Conversation</h3>
        <p>Enter your details to chat with Hammad</p>
        <input type="text" id="userName" placeholder="Your name">
        <input type="text" id="userContact" placeholder="Phone or email">
        <button onclick="startChat()">Start Chat</button>
        <p style="color:#666;font-size:12px;margin-top:16px">Your information is secure and encrypted</p>
    </div>
    
    <!-- Chat Screen -->
    <div id="chatScreen" style="display:none;flex:1;flex-direction:column">
        <div class="chat-msgs" id="msgContainer">
            <div style="text-align:center;color:#666;font-size:13px;padding:20px">
                🔒 Messages are end-to-end encrypted
            </div>
        </div>
        <div class="chat-input-box">
            <button class="attach-btn" onclick="document.getElementById('fileInput').click()" title="Attach file">
                📎
            </button>
            <input type="file" id="fileInput" style="display:none" onchange="sendFile(this)" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt">
            <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
            <button class="send-btn" onclick="sendMessage()">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
        </div>
    </div>
</div>

<script>
// ==================== CHAT LOGIC ====================
let chatToken = localStorage.getItem('chatToken');
let chatId = null;
let messagePoll = null;
let unreadCount = 0;

// Initialize
if (chatToken) {
    verifyToken();
}

// Toggle chat window
function toggleChat() {
    const box = document.getElementById('chatBox');
    box.classList.toggle('open');
    if (box.classList.contains('open') && chatToken) {
        document.getElementById('unreadBadge').style.display = 'none';
        unreadCount = 0;
        updateBadge();
        scrollToBottom();
    }
}

// Verify existing token
async function verifyToken() {
    try {
        const response = await fetch('/api/chat/verify?token=' + encodeURIComponent(chatToken));
        const data = await response.json();
        if (data.success) {
            chatId = data.chatId;
            showChatScreen();
            loadMessages();
            startPolling();
        } else {
            logout();
        }
    } catch (e) {
        console.error('Token verification failed:', e);
    }
}

// Start chat
async function startChat() {
    const name = document.getElementById('userName').value.trim();
    const contact = document.getElementById('userContact').value.trim();
    
    if (!name || !contact) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/chat/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phoneEmail: contact })
        });
        
        const data = await response.json();
        if (data.success) {
            chatToken = data.token;
            chatId = data.chatId;
            localStorage.setItem('chatToken', chatToken);
            showChatScreen();
            loadMessages();
            startPolling();
        } else {
            alert(data.error || 'Failed to start chat');
        }
    } catch (e) {
        console.error('Failed to start chat:', e);
        alert('Connection error. Please try again.');
    }
}

// Show chat screen
function showChatScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    const chatScreen = document.getElementById('chatScreen');
    chatScreen.style.display = 'flex';
    chatScreen.style.flex = '1';
}

// Logout
function logout() {
    localStorage.removeItem('chatToken');
    chatToken = null;
    chatId = null;
    clearInterval(messagePoll);
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('chatScreen').style.display = 'none';
}

// Load messages
async function loadMessages() {
    if (!chatToken) return;
    
    try {
        const response = await fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken) + '&_=' + Date.now());
        const data = await response.json();
        if (data.success) {
            renderMessages(data.messages);
        } else {
            logout();
        }
    } catch (e) {
        console.error('Failed to load messages:', e);
    }
}

// Render messages
function renderMessages(messages) {
    const container = document.getElementById('msgContainer');
    const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    container.innerHTML = '<div style="text-align:center;color:#666;font-size:13px;padding:15px">🔒 Messages are end-to-end encrypted</div>';
    
    messages.forEach(msg => {
        appendMessage(msg, false);
    });
    
    if (wasNearBottom || messages.length <= 1) {
        scrollToBottom();
    }
}

// Append single message
function appendMessage(msg, scroll = true) {
    const container = document.getElementById('msgContainer');
    const isSent = msg.sender === 'user';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-row ' + (isSent ? 'sent' : 'received');
    
    let html = '';
    
    // Media content
    if (msg.mediaUrl) {
        if (msg.mediaType === 'image') {
            html += '<div class="msg-media"><img src="' + msg.mediaUrl + '" onclick="window.open(\'' + msg.mediaUrl + '\',\'_blank\')" loading="lazy"></div>';
        } else if (msg.mediaType === 'audio' || msg.mediaType === 'voice') {
            html += '<div class="msg-media"><audio controls src="' + msg.mediaUrl + '"></audio></div>';
        } else if (msg.mediaType === 'video') {
            html += '<div class="msg-media"><video controls src="' + msg.mediaUrl + '"></video></div>';
        } else {
            html += '<div class="msg-file">📎 ' + (msg.fileName || 'File') + '</div>';
        }
    }
    
    // Text message
    if (msg.message) {
        html += '<span>' + escapeHtml(msg.message) + '</span>';
    }
    
    // Time
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    html += '<div class="msg-time">' + time + '</div>';
    
    wrapper.innerHTML = '<div class="msg-bubble">' + html + '</div>';
    container.appendChild(wrapper);
    
    if (scroll) {
        scrollToBottom();
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const message = input.value.trim();
    
    if (!message || !chatToken) return;
    
    input.value = '';
    
    // Optimistically add message
    const tempMsg = {
        sender: 'user',
        message: message,
        createdAt: new Date().toISOString()
    };
    appendMessage(tempMsg);
    
    try {
        const response = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: chatToken, message })
        });
        
        const data = await response.json();
        if (!data.success) {
            logout();
        }
    } catch (e) {
        console.error('Failed to send message:', e);
    }
}

// Send file
async function sendFile(input) {
    const file = input.files[0];
    if (!file || !chatToken) return;
    
    const formData = new FormData();
    formData.append('token', chatToken);
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data.success) {
            loadMessages();
        }
    } catch (e) {
        console.error('Upload failed:', e);
    }
    
    input.value = '';
}

// Poll for new messages
function startPolling() {
    if (messagePoll) clearInterval(messagePoll);
    messagePoll = setInterval(() => {
        if (chatToken && document.getElementById('chatBox').classList.contains('open')) {
            loadMessages();
        } else if (chatToken) {
            // Check for unread messages
            checkUnread();
        }
    }, 3000);
}

// Check unread messages
async function checkUnread() {
    try {
        const response = await fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken));
        const data = await response.json();
        if (data.success) {
            const userMessages = data.messages.filter(m => m.sender === 'admin');
            const lastRead = localStorage.getItem('lastRead_' + chatId);
            const newMessages = lastRead ? userMessages.filter(m => new Date(m.createdAt) > new Date(lastRead)) : userMessages;
            if (newMessages.length > unreadCount) {
                unreadCount = newMessages.length;
                updateBadge();
            }
        }
    } catch (e) {}
}

// Update badge
function updateBadge() {
    const badge = document.getElementById('unreadBadge');
    if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    } else {
        badge.style.display = 'none';
    }
}

// Utility functions
function scrollToBottom() {
    const container = document.getElementById('msgContainer');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Save last read timestamp when chat is closed
document.getElementById('chatBox').addEventListener('transitionend', function() {
    if (!this.classList.contains('open') && chatId) {
        localStorage.setItem('lastRead_' + chatId, new Date().toISOString());
    }
});
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
<title>Admin Login - Verification Hub</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
body{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',sans-serif}
</style>
</head>
<body>
<div style="background:#1a1a1a;padding:40px;border-radius:24px;width:100%;max-width:400px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.5)">
<h2 style="font-size:28px;font-weight:700;color:white;text-align:center;margin-bottom:8px">Admin Panel</h2>
<p style="color:#666;text-align:center;margin-bottom:32px;font-size:14px">Sign in to manage messages</p>
${error ? '<div style="background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);color:#ff3b30;padding:14px;border-radius:12px;margin-bottom:20px;font-size:14px;text-align:center">' + error + '</div>' : ''}
<form method="POST" action="/admin/login">
<div style="margin-bottom:20px">
<label style="display:block;color:#999;font-size:14px;margin-bottom:8px;font-weight:500">Username</label>
<input type="text" name="username" style="width:100%;padding:14px 18px;background:#2c2c2c;border:2px solid #3a3a3a;border-radius:14px;color:white;font-size:15px;outline:none;transition:border-color 0.2s" required autofocus>
</div>
<div style="margin-bottom:24px">
<label style="display:block;color:#999;font-size:14px;margin-bottom:8px;font-weight:500">Password</label>
<input type="password" name="password" style="width:100%;padding:14px 18px;background:#2c2c2c;border:2px solid #3a3a3a;border-radius:14px;color:white;font-size:15px;outline:none;transition:border-color 0.2s" required>
</div>
<button type="submit" style="width:100%;padding:14px;background:linear-gradient(135deg,#0084ff,#00b4ff);color:white;border:none;border-radius:14px;font-weight:600;font-size:15px;cursor:pointer;transition:transform 0.2s">Sign In</button>
</form>
<div style="text-align:center;margin-top:24px">
<a href="/" style="color:#666;font-size:14px;text-decoration:none;transition:color 0.2s">← Back to Site</a>
</div>
</div>
</body>
</html>`;
}

// ==================== ADMIN PANEL HTML ====================
// (Keep your existing getAdminPanelHTML function - it's already well-made)

// ==================== SERVER ====================
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);
    
    // CORS headers
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
            res.end('Forbidden');
            return;
        }
        
        if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
            const ext = path.extname(assetPath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': getMimeType(ext),
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not Found');
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
            res.end('Not Found');
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
                if (!user) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Failed to create user' }));
                    return;
                }
                
                const token = await createChatSession(user.chatId);
                
                // Send welcome message if first time
                const messages = await getChatMessages(user.chatId);
                if (messages.length === 0) {
                    await saveChatMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to Verification Hub. How can I help you today?');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: user.chatId, token, name: user.name }));
            } catch (e) {
                console.error('Register error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/verify' && method === 'GET') {
        const token = parsedUrl.query.token;
        if (!token) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        
        const user = await getChatUserByToken(token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!user, chatId: user ? user.chatId : null }));
        return;
    }
    
    if (pathname === '/api/chat/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'No token' }));
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
                    res.end(JSON.stringify({ success: false, error: 'Missing fields' }));
                    return;
                }
                
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
                    return;
                }
                
                const msg = await saveChatMessage(user.chatId, 'user', message);
                
                // Notify admin via Socket.IO
                io.to('admin_room').emit('new_message', { chatId: user.chatId, message: msg });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: msg }));
            } catch (e) {
                console.error('Send error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/chat/upload' && method === 'POST') {
        const form = new formidable.IncomingForm({
            uploadDir: CHAT_MEDIA_DIR,
            keepExtensions: true,
            maxFileSize: 20 * 1024 * 1024 // 20MB
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
                res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
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
                console.error('Upload error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Upload failed' }));
            }
        });
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
                res.end(getAdminLoginHTML('Invalid username or password'));
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
    
    // ==================== ADMIN API ====================
    if (pathname.startsWith('/api/admin/')) {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            return;
        }
        
        // Get conversations list
        if (pathname === '/api/admin/conversations' && method === 'GET') {
            const search = parsedUrl.query.search || '';
            const conversations = await getAdminChatList(search);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, conversations }));
            return;
        }
        
        // Get messages for a chat
        if (pathname === '/api/admin/messages' && method === 'GET') {
            const chatId = parsedUrl.query.chatId;
            if (!chatId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing chatId' }));
                return;
            }
            const messages = await getChatMessages(chatId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, messages }));
            return;
        }
        
        // Send admin message
        if (pathname === '/api/admin/send' && method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const { chatId, message, replyTo } = JSON.parse(body);
                    if (!chatId || !message) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing fields' }));
                        return;
                    }
                    
                    const msg = await saveChatMessage(chatId, 'admin', message, null, null, null, null, replyTo);
                    
                    // Notify user via Socket.IO
                    io.to('user_' + chatId).emit('new_message', { chatId, message: msg });
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: msg }));
                } catch (e) {
                    console.error('Admin send error:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Server error' }));
                }
            });
            return;
        }
        
        // Upload admin file
        if (pathname === '/api/admin/upload' && method === 'POST') {
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
                
                const chatId = Array.isArray(fields.chatId) ? fields.chatId[0] : fields.chatId;
                const file = Array.isArray(files.file) ? files.file[0] : files.file;
                
                if (!chatId || !file || !file.originalFilename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing fields' }));
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
                    
                    io.to('user_' + chatId).emit('new_message', { chatId, message: msg });
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: msg }));
                } catch (e) {
                    console.error('Admin upload error:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Upload failed' }));
                }
            });
            return;
        }
        
        // Mark messages as read
        if (pathname === '/api/admin/mark-read' && method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const { chatId } = JSON.parse(body);
                    await markMessagesRead(chatId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false }));
                }
            });
            return;
        }
        
        // Get user info
        if (pathname === '/api/admin/user-info' && method === 'GET') {
            const chatId = parsedUrl.query.chatId;
            if (!chatId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }
            const user = await db.collection('chat_users').findOne({ chatId });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, user }));
            return;
        }
    }
    
    // Home page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML());
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - Page Not Found</h1>');
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
    
    // Admin joins admin room
    socket.on('join_admin', () => {
        socket.join('admin_room');
        console.log('Admin joined');
    });
    
    // User joins their room
    socket.on('join_user', (chatId) => {
        socket.join('user_' + chatId);
        console.log('User joined room:', chatId);
    });
    
    // Admin sends message
    socket.on('admin_message', (data) => {
        socket.to('user_' + data.chatId).emit('new_message', data);
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        socket.to('admin_room').emit('user_typing', data);
    });
    
    socket.on('admin_typing', (data) => {
        socket.to('user_' + data.chatId).emit('admin_typing', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================
async function start() {
    const dbConnected = await connectDB();
    if (!dbConnected) {
        console.error('Failed to connect to database. Server may not work properly.');
    }
    
    server.listen(PORT, () => {
        console.log('=================================');
        console.log('🚀 Server running on port ' + PORT);
        console.log('📍 Main site: http://localhost:' + PORT);
        console.log('🔑 Admin panel: http://localhost:' + PORT + '/admin');
        console.log('   Login: admin / admin123');
        console.log('=================================');
    });
}

start();

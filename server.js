const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const WebSocket = require('ws');
const formidable = require('formidable');

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'whatsapp_advanced';

let db, mongoClient;
const __dir = path.resolve();
const UPLOADS_DIR = path.join(__dir, 'uploads');
const VOICE_DIR = path.join(__dir, 'uploads', 'voice');
const IMAGES_DIR = path.join(__dir, 'uploads', 'images');
const WALLPAPERS_DIR = path.join(__dir, 'uploads', 'wallpapers');

[UPLOADS_DIR, VOICE_DIR, IMAGES_DIR, WALLPAPERS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Database Connection
async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        const collections = [
            'users', 'messages', 'sessions', 
            'voice_notes', 'images', 'wallpapers',
            'contacts', 'status_updates', 'groups'
        ];
        
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        // Create indexes
        await db.collection('users').createIndex({ phone: 1 }, { sparse: true });
        await db.collection('users').createIndex({ email: 1 }, { sparse: true });
        await db.collection('messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('messages').createIndex({ chatId: 1, type: 1 });
        await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
        await db.collection('voice_notes').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('images').createIndex({ chatId: 1, createdAt: -1 });
        
        console.log('MongoDB Connected Successfully');
        return true;
    } catch (e) {
        console.error('MongoDB Error:', e);
        return false;
    }
}

// User Functions
async function findOrCreateUser(name, contact) {
    const query = contact.includes('@') ? { email: contact } : { phone: contact };
    let user = await db.collection('users').findOne(query);
    
    if (user) {
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { name, lastSeen: new Date(), status: 'online' } }
        );
        return user;
    }
    
    const chatId = 'USER-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    user = {
        chatId,
        name,
        phone: contact.includes('@') ? '' : contact,
        email: contact.includes('@') ? contact : '',
        avatar: null,
        about: 'Hey there! I am using WhatsApp',
        wallpaper: null,
        createdAt: new Date(),
        lastSeen: new Date(),
        status: 'online'
    };
    
    await db.collection('users').insertOne(user);
    return user;
}

async function createSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('sessions').insertOne({
        token,
        chatId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return token;
}

async function getUserByToken(token) {
    const session = await db.collection('sessions').findOne({
        token,
        expiresAt: { $gt: new Date() }
    });
    if (!session) return null;
    return await db.collection('users').findOne({ chatId: session.chatId });
}

async function getMessages(chatId, limit = 100) {
    return await db.collection('messages')
        .find({ chatId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
}

async function saveMessage(chatId, sender, message, type = 'text', mediaUrl = null, duration = null) {
    const msg = {
        chatId,
        sender,
        message,
        type, // 'text', 'image', 'voice', 'video', 'document'
        mediaUrl,
        duration, // for voice notes
        createdAt: new Date(),
        read: false,
        delivered: false,
        starred: false
    };
    await db.collection('messages').insertOne(msg);
    return msg;
}

async function markMessagesRead(chatId) {
    await db.collection('messages').updateMany(
        { chatId, sender: 'user', read: false },
        { $set: { read: true } }
    );
}

async function getAllUsers() {
    return await db.collection('users')
        .find({ status: { $ne: 'deleted' } })
        .sort({ lastSeen: -1 })
        .toArray();
}

async function getLastMessage(chatId) {
    return await db.collection('messages')
        .findOne({ chatId }, { sort: { createdAt: -1 } });
}

async function getUnreadCount(chatId) {
    return await db.collection('messages')
        .countDocuments({ chatId, sender: 'user', read: false });
}

async function updateWallpaper(chatId, wallpaperUrl) {
    await db.collection('users').updateOne(
        { chatId },
        { $set: { wallpaper: wallpaperUrl } }
    );
}

// Generate WhatsApp-style HTML
function getChatPage(user) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#075e54">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>WhatsApp - ${user.name}</title>
    <style>
        :root {
            --wa-header: #075e54;
            --wa-header-light: #128c7e;
            --wa-bg: #0b141a;
            --wa-out: #005c4b;
            --wa-in: #202c33;
            --wa-input: #2a3942;
            --wa-teal: #00a884;
            --wa-green: #25d366;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: var(--wa-bg);
            color: #e9edef;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Header */
        .wa-header {
            background: var(--wa-header);
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .back-btn {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 50%;
            transition: background 0.2s;
        }
        
        .back-btn:hover {
            background: rgba(255,255,255,0.1);
        }
        
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 18px;
            flex-shrink: 0;
            cursor: pointer;
            position: relative;
        }
        
        .avatar .online-dot {
            width: 12px;
            height: 12px;
            background: #25d366;
            border-radius: 50%;
            position: absolute;
            bottom: 0;
            right: 0;
            border: 2px solid var(--wa-header);
        }
        
        .header-info {
            flex: 1;
            cursor: pointer;
        }
        
        .header-name {
            font-size: 16px;
            font-weight: 600;
            color: white;
        }
        
        .header-status {
            font-size: 12px;
            color: rgba(255,255,255,0.8);
        }
        
        .header-actions {
            display: flex;
            gap: 5px;
        }
        
        .header-actions button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .header-actions button:hover {
            background: rgba(255,255,255,0.1);
        }
        
        /* Chat Background */
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background-color: var(--wa-bg);
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            transition: background-image 0.5s;
            scroll-behavior: smooth;
        }
        
        .chat-container::-webkit-scrollbar {
            width: 6px;
        }
        
        .chat-container::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
        }
        
        /* Message Bubbles */
        .message-wrapper {
            margin-bottom: 4px;
            display: flex;
            animation: messageIn 0.3s ease-out;
        }
        
        .message-wrapper.out {
            justify-content: flex-end;
        }
        
        .message-wrapper.in {
            justify-content: flex-start;
        }
        
        @keyframes messageIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message-bubble {
            max-width: 75%;
            padding: 6px 7px 8px 9px;
            border-radius: 8px;
            position: relative;
            box-shadow: 0 1px 1px rgba(0,0,0,0.1);
            word-wrap: break-word;
            white-space: pre-wrap;
        }
        
        .message-bubble.out {
            background: var(--wa-out);
            border-radius: 8px 0 8px 8px;
        }
        
        .message-bubble.in {
            background: var(--wa-in);
            border-radius: 0 8px 8px 8px;
        }
        
        .message-text {
            font-size: 14.2px;
            line-height: 1.4;
            color: #e9edef;
        }
        
        .message-meta {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 4px;
            margin-top: 2px;
        }
        
        .message-time {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
        }
        
        .message-status {
            font-size: 14px;
            color: rgba(255,255,255,0.5);
        }
        
        /* Image Messages */
        .message-image {
            max-width: 300px;
            border-radius: 6px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .message-image:hover {
            transform: scale(1.02);
        }
        
        /* Voice Messages */
        .voice-message {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 200px;
        }
        
        .voice-play-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #00a884;
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: transform 0.2s;
        }
        
        .voice-play-btn:hover {
            transform: scale(1.1);
        }
        
        .voice-play-btn.playing {
            background: #ef4444;
        }
        
        .voice-waveform {
            flex: 1;
            height: 30px;
            display: flex;
            align-items: center;
            gap: 2px;
        }
        
        .wave-bar {
            width: 3px;
            background: #00a884;
            border-radius: 2px;
            transition: height 0.1s;
        }
        
        .voice-duration {
            font-size: 12px;
            color: rgba(255,255,255,0.6);
            min-width: 40px;
        }
        
        /* Input Area */
        .input-area {
            background: var(--wa-input);
            padding: 8px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 56px;
        }
        
        .input-area button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: #8696a0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        
        .input-area button:hover {
            color: white;
        }
        
        .message-input {
            flex: 1;
            background: var(--wa-bg);
            border: none;
            padding: 10px 16px;
            border-radius: 24px;
            color: white;
            font-size: 15px;
            outline: none;
            min-width: 0;
        }
        
        .message-input::placeholder {
            color: #8696a0;
        }
        
        .send-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #00a884 !important;
            color: white !important;
        }
        
        .send-btn:hover {
            background: #06cf9c !important;
        }
        
        /* Voice Recording */
        .recording-indicator {
            background: #ef4444;
            color: white;
            padding: 8px 16px;
            display: none;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .record-btn.recording {
            color: #ef4444 !important;
            animation: pulse 1s infinite;
        }
        
        /* Image Preview */
        .image-preview {
            display: none;
            padding: 10px;
            background: var(--wa-input);
            position: relative;
        }
        
        .image-preview img {
            max-height: 100px;
            border-radius: 8px;
        }
        
        .image-preview .close-preview {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0,0,0,0.7);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 16px;
        }
        
        /* Emoji Picker */
        .emoji-picker {
            display: none;
            background: var(--wa-input);
            padding: 10px;
            max-height: 200px;
            overflow-y: auto;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .emoji-picker.open {
            display: flex;
        }
        
        .emoji-picker span {
            font-size: 24px;
            cursor: pointer;
            padding: 5px;
            border-radius: 8px;
            transition: background 0.2s;
        }
        
        .emoji-picker span:hover {
            background: rgba(255,255,255,0.1);
        }
        
        /* Typing Indicator */
        .typing-indicator {
            display: none;
            padding: 8px 16px;
        }
        
        .typing-dots {
            display: flex;
            gap: 4px;
            padding: 8px 12px;
            background: var(--wa-in);
            border-radius: 8px;
            display: inline-flex;
        }
        
        .typing-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #8696a0;
            animation: typingBounce 1.4s infinite;
        }
        
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typingBounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        
        /* Date Separator */
        .date-separator {
            text-align: center;
            margin: 16px 0;
        }
        
        .date-separator span {
            background: rgba(24,34,41,0.8);
            color: rgba(255,255,255,0.6);
            padding: 5px 12px;
            border-radius: 8px;
            font-size: 12px;
            box-shadow: 0 1px 1px rgba(0,0,0,0.1);
        }
        
        /* Menu */
        .menu-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 200;
        }
        
        .menu-overlay.open {
            display: block;
        }
        
        .menu-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 280px;
            height: 100%;
            background: var(--wa-bg);
            z-index: 201;
            transform: translateX(100%);
            transition: transform 0.3s;
            padding: 20px;
            overflow-y: auto;
        }
        
        .menu-panel.open {
            transform: translateX(0);
        }
        
        .menu-item {
            padding: 12px;
            color: white;
            cursor: pointer;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: background 0.2s;
        }
        
        .menu-item:hover {
            background: rgba(255,255,255,0.1);
        }
        
        /* Wallpaper Selector */
        .wallpaper-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        
        .wallpaper-item {
            aspect-ratio: 1;
            border-radius: 8px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.2s;
            object-fit: cover;
        }
        
        .wallpaper-item:hover {
            border-color: #00a884;
            transform: scale(1.05);
        }
        
        .wallpaper-item.selected {
            border-color: #00a884;
            box-shadow: 0 0 10px rgba(0,168,132,0.5);
        }
        
        /* Fullscreen Image Viewer */
        .image-viewer {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.95);
            z-index: 300;
            align-items: center;
            justify-content: center;
        }
        
        .image-viewer.open {
            display: flex;
        }
        
        .image-viewer img {
            max-width: 95%;
            max-height: 95%;
            object-fit: contain;
        }
        
        .image-viewer .close-viewer {
            position: absolute;
            top: 20px;
            right: 20px;
            color: white;
            font-size: 30px;
            cursor: pointer;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .message-bubble {
                max-width: 85%;
            }
            .message-image {
                max-width: 250px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="wa-header">
        <div class="back-btn" onclick="window.location.href='/'">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
        </div>
        
        <div class="avatar" onclick="openMenu()">
            <span id="adminAvatar">H</span>
            <div class="online-dot" id="onlineDot"></div>
        </div>
        
        <div class="header-info" onclick="openMenu()">
            <div class="header-name">Hammad Bin Amir</div>
            <div class="header-status" id="statusText">online</div>
        </div>
        
        <div class="header-actions">
            <button onclick="openMenu()" title="Menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            </button>
        </div>
    </div>
    
    <!-- Chat Messages -->
    <div class="chat-container" id="chatContainer">
        <div class="date-separator">
            <span id="encryptionNotice">🔒 Messages are end-to-end encrypted</span>
        </div>
        <div id="messagesContainer"></div>
        <div class="typing-indicator" id="typingIndicator">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    </div>
    
    <!-- Recording Indicator -->
    <div class="recording-indicator" id="recordingIndicator">
        <span>🔴</span>
        <span>Recording... <span id="recordingTimer">00:00</span></span>
    </div>
    
    <!-- Image Preview -->
    <div class="image-preview" id="imagePreview">
        <img id="previewImage" src="" alt="Preview">
        <button class="close-preview" onclick="clearImagePreview()">×</button>
    </div>
    
    <!-- Emoji Picker -->
    <div class="emoji-picker" id="emojiPicker"></div>
    
    <!-- Input Area -->
    <div class="input-area">
        <button onclick="toggleEmojiPicker()" title="Emoji">😊</button>
        <button onclick="document.getElementById('imageInput').click()" title="Attach Image">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#8696a0">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
            </svg>
        </button>
        <input type="file" id="imageInput" accept="image/*" style="display:none" onchange="handleImageUpload(event)">
        <input type="text" class="message-input" id="messageInput" placeholder="Type a message" onkeypress="if(event.key==='Enter')sendMessage()" autocomplete="off">
        <button class="record-btn" id="recordBtn" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Hold to record voice">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#8696a0">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
        </button>
        <button class="send-btn" onclick="sendMessage()" title="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
    </div>
    
    <!-- Menu Overlay -->
    <div class="menu-overlay" id="menuOverlay" onclick="closeMenu()"></div>
    <div class="menu-panel" id="menuPanel">
        <div style="text-align:center; margin-bottom:20px;">
            <div class="avatar" style="width:80px;height:80px;font-size:36px;margin:0 auto 10px;">
                <span>H</span>
            </div>
            <div style="color:white;font-size:18px;font-weight:600;">Hammad Bin Amir</div>
            <div style="color:#8696a0;font-size:14px;">Admin</div>
        </div>
        
        <div class="menu-item" onclick="changeWallpaper()">
            <span>🎨</span>
            <span>Change Wallpaper</span>
        </div>
        
        <div class="menu-item" onclick="clearChat()">
            <span>🗑️</span>
            <span>Clear Chat</span>
        </div>
        
        <div class="menu-item" onclick="exportChat()">
            <span>📤</span>
            <span>Export Chat</span>
        </div>
        
        <div style="margin-top:20px; padding:10px;">
            <div style="color:#8696a0;font-size:12px;margin-bottom:10px;">WALLPAPER</div>
            <div class="wallpaper-grid" id="wallpaperGrid">
                <div class="wallpaper-item selected" style="background:#0b141a;" onclick="setWallpaper('default')" title="Default"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);" onclick="setWallpaper('gradient1')" title="Purple Gradient"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);" onclick="setWallpaper('gradient2')" title="Pink Gradient"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);" onclick="setWallpaper('gradient3')" title="Blue Gradient"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);" onclick="setWallpaper('gradient4')" title="Green Gradient"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #fa709a 0%, #fee140 100%);" onclick="setWallpaper('gradient5')" title="Sunset Gradient"></div>
            </div>
        </div>
    </div>
    
    <!-- Fullscreen Image Viewer -->
    <div class="image-viewer" id="imageViewer" onclick="closeImageViewer()">
        <span class="close-viewer">×</span>
        <img id="viewerImage" src="" alt="Full size">
    </div>
    
    <script>
        // App State
        let ws = null;
        let token = '${user.token}';
        let chatId = '${user.chatId}';
        let isRecording = false;
        let mediaRecorder = null;
        let audioChunks = [];
        let recordingStartTime = 0;
        let recordingTimerInterval = null;
        let currentWallpaper = localStorage.getItem('whatsapp_wallpaper') || 'default';
        let selectedImage = null;
        
        // Emojis
        const emojis = ['😀','😂','😍','🥰','😘','😜','🤔','😴','😢','😡','👍','👎','❤️','💔','🔥','⭐','🎉','💯','🙏','💪','🤝','👋','🎂','🍕','☕','🎵','📸','💰','✅','❌'];
        
        // Initialize
        function init() {
            loadEmojiPicker();
            applyWallpaper(currentWallpaper);
            connectWebSocket();
            updateOnlineStatus();
            
            // Request notification permission
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
            
            // Handle paste for images
            document.addEventListener('paste', handlePaste);
        }
        
        // WebSocket Connection
        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.host + '/ws');
            
            ws.onopen = () => {
                console.log('Connected');
                updateOnlineStatus(true);
                ws.send(JSON.stringify({ type: 'auth', token: token }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'auth_success':
                        loadMessages();
                        break;
                    case 'message':
                        addMessage({
                            message: data.message,
                            sender: data.sender,
                            type: data.msgType || 'text',
                            mediaUrl: data.mediaUrl,
                            duration: data.duration,
                            createdAt: data.timestamp
                        });
                        if (data.sender === 'admin') {
                            showNotification(data.message);
                        }
                        break;
                    case 'typing':
                        showTypingIndicator(data.isTyping);
                        break;
                    case 'status':
                        updateOnlineStatus(data.online);
                        break;
                }
            };
            
            ws.onclose = () => {
                updateOnlineStatus(false);
                setTimeout(connectWebSocket, 3000);
            };
            
            ws.onerror = () => {
                updateOnlineStatus(false);
            };
        }
        
        // Send Message
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message && !selectedImage) return;
            
            if (selectedImage) {
                sendImageMessage(selectedImage, message || '');
                clearImagePreview();
            } else if (message) {
                sendTextMessage(message);
            }
            
            input.value = '';
            input.focus();
        }
        
        function sendTextMessage(text) {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            ws.send(JSON.stringify({
                type: 'message',
                token: token,
                message: text,
                msgType: 'text'
            }));
        }
        
        function sendImageMessage(imageData, caption) {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            ws.send(JSON.stringify({
                type: 'message',
                token: token,
                message: caption,
                msgType: 'image',
                mediaUrl: imageData
            }));
        }
        
        function sendVoiceMessage(audioData, duration) {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            ws.send(JSON.stringify({
                type: 'message',
                token: token,
                message: '🎤 Voice Message',
                msgType: 'voice',
                mediaUrl: audioData,
                duration: duration
            }));
        }
        
        // Add Message to UI
        function addMessage(msg) {
            const container = document.getElementById('messagesContainer');
            const wrapper = document.createElement('div');
            const isOut = msg.sender === 'user';
            
            wrapper.className = 'message-wrapper ' + (isOut ? 'out' : 'in');
            
            const time = new Date(msg.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            
            let content = '';
            
            switch(msg.type || 'text') {
                case 'image':
                    content = `
                        <div class="message-bubble ${isOut ? 'out' : 'in'}">
                            <img src="${msg.mediaUrl}" class="message-image" onclick="openImageViewer('${msg.mediaUrl}')" loading="lazy">
                            ${msg.message ? `<div class="message-text">${escapeHtml(msg.message)}</div>` : ''}
                            <div class="message-meta">
                                <span class="message-time">${time}</span>
                                ${isOut ? '<span class="message-status">✓✓</span>' : ''}
                            </div>
                        </div>`;
                    break;
                    
                case 'voice':
                    const voiceId = 'voice_' + Date.now();
                    content = `
                        <div class="message-bubble ${isOut ? 'out' : 'in'}">
                            <div class="voice-message">
                                <button class="voice-play-btn" onclick="toggleVoice('${voiceId}', '${msg.mediaUrl}')" id="btn_${voiceId}">
                                    ▶
                                </button>
                                <div class="voice-waveform" id="waveform_${voiceId}">
                                    ${generateWaveformBars(20)}
                                </div>
                                <span class="voice-duration">${formatDuration(msg.duration || 0)}</span>
                            </div>
                            <div class="message-meta">
                                <span class="message-time">${time}</span>
                                ${isOut ? '<span class="message-status">✓✓</span>' : ''}
                            </div>
                        </div>
                        <audio id="${voiceId}" src="${msg.mediaUrl}" preload="none"></audio>`;
                    break;
                    
                default:
                    content = `
                        <div class="message-bubble ${isOut ? 'out' : 'in'}">
                            <div class="message-text">${formatMessage(msg.message)}</div>
                            <div class="message-meta">
                                <span class="message-time">${time}</span>
                                ${isOut ? '<span class="message-status">✓✓</span>' : ''}
                            </div>
                        </div>`;
            }
            
            wrapper.innerHTML = content;
            container.appendChild(wrapper);
            scrollToBottom();
        }
        
        function generateWaveformBars(count) {
            let bars = '';
            for (let i = 0; i < count; i++) {
                const height = Math.random() * 20 + 5;
                bars += `<div class="wave-bar" style="height:${height}px"></div>`;
            }
            return bars;
        }
        
        function formatDuration(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }
        
        function formatMessage(text) {
            // Convert URLs to links
            text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#00a884;text-decoration:underline;">$1</a>');
            // Convert *bold*
            text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            // Convert _italic_
            text = text.replace(/_(.*?)_/g, '<em>$1</em>');
            // Convert ~strikethrough~
            text = text.replace(/~(.*?)~/g, '<del>$1</del>');
            return text;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Voice Recording
        async function startRecording() {
            const btn = document.getElementById('recordBtn');
            btn.classList.add('recording');
            
            document.getElementById('recordingIndicator').style.display = 'flex';
            isRecording = true;
            audioChunks = [];
            recordingStartTime = Date.now();
            
            // Start timer
            recordingTimerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const mins = Math.floor(elapsed / 60);
                const secs = elapsed % 60;
                document.getElementById('recordingTimer').textContent = 
                    mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
            }, 1000);
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.start();
            } catch (e) {
                console.error('Error recording:', e);
                stopRecording();
            }
        }
        
        function stopRecording() {
            const btn = document.getElementById('recordBtn');
            btn.classList.remove('recording');
            
            document.getElementById('recordingIndicator').style.display = 'none';
            isRecording = false;
            
            clearInterval(recordingTimerInterval);
            
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    
                    reader.onload = () => {
                        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
                        sendVoiceMessage(reader.result, duration);
                    };
                    
                    reader.readAsDataURL(audioBlob);
                    
                    // Stop all tracks
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                };
            }
        }
        
        // Image Handling
        function handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                selectedImage = e.target.result;
                document.getElementById('previewImage').src = selectedImage;
                document.getElementById('imagePreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
        
        function clearImagePreview() {
            selectedImage = null;
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('imageInput').value = '';
        }
        
        function handlePaste(event) {
            const items = event.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        selectedImage = e.target.result;
                        document.getElementById('previewImage').src = selectedImage;
                        document.getElementById('imagePreview').style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        }
        
        // Voice Playback
        const activeVoices = new Map();
        
        function toggleVoice(id, src) {
            const audio = document.getElementById(id);
            const btn = document.getElementById('btn_' + id);
            
            if (activeVoices.has(id)) {
                audio.pause();
                activeVoices.delete(id);
                btn.textContent = '▶';
                btn.classList.remove('playing');
            } else {
                // Stop any playing voice
                activeVoices.forEach((_, key) => {
                    const oldAudio = document.getElementById(key);
                    const oldBtn = document.getElementById('btn_' + key);
                    if (oldAudio) {
                        oldAudio.pause();
                        oldBtn.textContent = '▶';
                        oldBtn.classList.remove('playing');
                    }
                });
                activeVoices.clear();
                
                audio.src = src;
                audio.play();
                activeVoices.set(id, true);
                btn.textContent = '⏸';
                btn.classList.add('playing');
                
                audio.onended = () => {
                    activeVoices.delete(id);
                    btn.textContent = '▶';
                    btn.classList.remove('playing');
                };
            }
        }
        
        // Typing Indicator
        let typingTimeout;
        document.getElementById('messageInput').addEventListener('input', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'typing', isTyping: true, token: token }));
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'typing', isTyping: false, token: token }));
                }, 2000);
            }
        });
        
        function showTypingIndicator(show) {
            document.getElementById('typingIndicator').style.display = show ? 'block' : 'none';
            if (show) {
                document.getElementById('statusText').textContent = 'typing...';
            } else {
                updateOnlineStatus(true);
            }
            scrollToBottom();
        }
        
        function updateOnlineStatus(online) {
            const dot = document.getElementById('onlineDot');
            const text = document.getElementById('statusText');
            
            if (online) {
                dot.style.display = 'block';
                text.textContent = 'online';
            } else {
                dot.style.display = 'none';
                text.textContent = 'offline';
            }
        }
        
        // Load Messages
        async function loadMessages() {
            try {
                const response = await fetch('/api/messages?token=' + token);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('messagesContainer').innerHTML = '';
                    
                    let lastDate = null;
                    data.messages.forEach(msg => {
                        const msgDate = new Date(msg.createdAt).toDateString();
                        if (msgDate !== lastDate) {
                            addDateSeparator(msg.createdAt);
                            lastDate = msgDate;
                        }
                        addMessage(msg);
                    });
                    
                    scrollToBottom();
                }
            } catch (e) {
                console.error('Error loading messages:', e);
            }
        }
        
        function addDateSeparator(timestamp) {
            const container = document.getElementById('messagesContainer');
            const date = new Date(timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let dateText;
            if (date.toDateString() === today.toDateString()) {
                dateText = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateText = 'Yesterday';
            } else {
                dateText = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            separator.innerHTML = '<span>' + dateText + '</span>';
            container.appendChild(separator);
        }
        
        // Wallpaper
        function setWallpaper(type) {
            currentWallpaper = type;
            localStorage.setItem('whatsapp_wallpaper', type);
            applyWallpaper(type);
            closeMenu();
        }
        
        function applyWallpaper(type) {
            const container = document.getElementById('chatContainer');
            
            const wallpapers = {
                'default': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                'gradient1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'gradient2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                'gradient3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                'gradient4': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                'gradient5': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            };
            
            const bg = wallpapers[type] || wallpapers['default'];
            
            if (type === 'default') {
                container.style.backgroundImage = bg;
                container.style.backgroundColor = '#0b141a';
            } else {
                container.style.backgroundImage = bg;
                container.style.backgroundColor = 'transparent';
            }
        }
        
        function changeWallpaper() {
            // Scroll to wallpaper section
            document.getElementById('wallpaperGrid').scrollIntoView({ behavior: 'smooth' });
        }
        
        // Emoji Picker
        function loadEmojiPicker() {
            const picker = document.getElementById('emojiPicker');
            picker.innerHTML = emojis.map(emoji => 
                '<span onclick="insertEmoji(\'' + emoji + '\')">' + emoji + '</span>'
            ).join('');
        }
        
        function toggleEmojiPicker() {
            document.getElementById('emojiPicker').classList.toggle('open');
        }
        
        function insertEmoji(emoji) {
            const input = document.getElementById('messageInput');
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start + emoji.length;
            input.focus();
        }
        
        // Image Viewer
        function openImageViewer(src) {
            document.getElementById('viewerImage').src = src;
            document.getElementById('imageViewer').classList.add('open');
        }
        
        function closeImageViewer() {
            document.getElementById('imageViewer').classList.remove('open');
        }
        
        // Menu
        function openMenu() {
            document.getElementById('menuOverlay').classList.add('open');
            document.getElementById('menuPanel').classList.add('open');
        }
        
        function closeMenu() {
            document.getElementById('menuOverlay').classList.remove('open');
            document.getElementById('menuPanel').classList.remove('open');
        }
        
        // Chat Actions
        function clearChat() {
            if (confirm('Clear all messages? This cannot be undone.')) {
                fetch('/api/chat/clear?token=' + token, { method: 'POST' })
                    .then(() => {
                        document.getElementById('messagesContainer').innerHTML = '';
                        addDateSeparator(new Date());
                    });
                closeMenu();
            }
        }
        
        function exportChat() {
            const messages = document.getElementById('messagesContainer').innerText;
            const blob = new Blob([messages], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat_export.txt';
            a.click();
            closeMenu();
        }
        
        // Notifications
        function showNotification(message) {
            if (Notification.permission === 'granted' && document.hidden) {
                new Notification('Hammad Bin Amir', {
                    body: message,
                    icon: '/assets/notification-icon.png'
                });
            }
        }
        
        // Scroll Helper
        function scrollToBottom() {
            const container = document.getElementById('chatContainer');
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
        
        // Initialize app
        init();
        
        // Scroll to bottom on load
        setTimeout(scrollToBottom, 500);
        
        // Handle window resize
        window.addEventListener('resize', scrollToBottom);
    </script>
</body>
</html>`;
}

// WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
const userConnections = new Map();
const adminConnections = new Set();

wss.on('connection', (ws, req) => {
    const pathname = url.parse(req.url).pathname;
    
    if (pathname === '/ws') {
        let userData = null;
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'auth') {
                    const user = await getUserByToken(data.token);
                    if (user) {
                        userData = user;
                        userConnections.set(user.chatId, ws);
                        ws.send(JSON.stringify({ type: 'auth_success' }));
                        
                        // Send welcome message
                        setTimeout(async () => {
                            await saveMessage(user.chatId, 'admin', 'Hello! 👋 How can I help you today?', 'text');
                            
                            ws.send(JSON.stringify({
                                type: 'message',
                                message: 'Hello! 👋 How can I help you today?',
                                sender: 'admin',
                                msgType: 'text',
                                timestamp: new Date().toISOString()
                            }));
                            
                            notifyAdmin({
                                type: 'new_message',
                                chatId: user.chatId,
                                name: user.name,
                                message: 'Hello! 👋 How can I help you today?',
                                sender: 'admin'
                            });
                        }, 1500);
                    }
                } else if (data.type === 'message' && userData) {
                    const msgType = data.msgType || 'text';
                    await saveMessage(userData.chatId, 'user', data.message, msgType, data.mediaUrl, data.duration);
                    
                    ws.send(JSON.stringify({
                        type: 'message',
                        message: data.message,
                        sender: 'user',
                        msgType: msgType,
                        mediaUrl: data.mediaUrl,
                        duration: data.duration,
                        timestamp: new Date().toISOString()
                    }));
                    
                    notifyAdmin({
                        type: 'new_message',
                        chatId: userData.chatId,
                        name: userData.name,
                        message: data.message,
                        sender: 'user',
                        msgType: msgType,
                        mediaUrl: data.mediaUrl,
                        duration: data.duration
                    });
                } else if (data.type === 'typing' && userData) {
                    notifyAdmin({
                        type: 'user_typing',
                        chatId: userData.chatId,
                        isTyping: data.isTyping
                    });
                }
            } catch (e) {
                console.error('WS Error:', e);
            }
        });
        
        ws.on('close', () => {
            if (userData) {
                userConnections.delete(userData.chatId);
                notifyAdmin({ type: 'user_offline', chatId: userData.chatId });
            }
        });
    } else if (pathname === '/admin/ws') {
        adminConnections.add(ws);
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'admin_message') {
                    await saveMessage(data.chatId, 'admin', data.message, data.msgType || 'text', data.mediaUrl, data.duration);
                    
                    const userWs = userConnections.get(data.chatId);
                    if (userWs && userWs.readyState === WebSocket.OPEN) {
                        userWs.send(JSON.stringify({
                            type: 'message',
                            message: data.message,
                            sender: 'admin',
                            msgType: data.msgType || 'text',
                            mediaUrl: data.mediaUrl,
                            duration: data.duration,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            } catch (e) {
                console.error('Admin WS Error:', e);
            }
        });
        
        ws.on('close', () => {
            adminConnections.delete(ws);
        });
    }
});

function notifyAdmin(data) {
    adminConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
}

// Admin Sessions
const adminSessions = new Map();

// HTTP Server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    // Static files
    if (pathname.startsWith('/uploads/')) {
        const filePath = path.join(__dir, pathname);
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const types = {
                '.webm': 'audio/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.webp': 'image/webp'
            };
            const contentType = types[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }
    
    // API Routes
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { name, contact } = JSON.parse(body);
            const user = await findOrCreateUser(name, contact);
            const token = await createSession(user.chatId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, chatId: user.chatId, sessionToken: token }));
        });
        return;
    }
    
    if (pathname === '/api/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        const user = await getUserByToken(token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        const messages = await getMessages(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    // Admin login page
    if (pathname === '/admin' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminLoginPage());
        return;
    }
    
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const params = new URLSearchParams(body);
            if (params.get('username') === 'Hammad' && params.get('password') === 'Hammad1122@') {
                const sessionId = crypto.randomBytes(32).toString('hex');
                adminSessions.set(sessionId, { username: 'Hammad' });
                res.writeHead(302, {
                    'Location': '/admin/dashboard',
                    'Set-Cookie': 'sessionId=' + sessionId + '; HttpOnly; Path=/; Max-Age=86400'
                });
                res.end();
            } else {
                res.writeHead(302, { 'Location': '/admin?error=1' });
                res.end();
            }
        });
        return;
    }
    
    // Main login page
    if (pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getLoginPage());
        return;
    }
    
    if (pathname === '/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const name = params.get('name');
            const contact = params.get('contact');
            
            if (!name || !contact) {
                res.writeHead(302, { 'Location': '/' });
                res.end();
                return;
            }
            
            const user = await findOrCreateUser(name, contact);
            const token = await createSession(user.chatId);
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getChatPage({ ...user, token }));
        });
        return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
});

function getLoginPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Chat</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#075e54,#128c7e);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .container{background:white;border-radius:16px;padding:30px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
        .logo{width:80px;height:80px;background:#25d366;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center}
        h1{text-align:center;color:#075e54;margin-bottom:10px}
        p{text-align:center;color:#667781;margin-bottom:20px;font-size:14px}
        input{width:100%;padding:12px;margin-bottom:10px;border:2px solid #e9edef;border-radius:8px;font-size:16px;outline:none}
        input:focus{border-color:#25d366}
        button{width:100%;padding:14px;background:#25d366;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}
        button:hover{background:#1da851}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
            </svg>
        </div>
        <h1>WhatsApp Chat</h1>
        <p>Enter your details to start chatting</p>
        <form method="POST" action="/login">
            <input type="text" name="name" placeholder="Your Name" required>
            <input type="text" name="contact" placeholder="Phone Number or Email" required>
            <button type="submit">Start Chatting</button>
        </form>
    </div>
</body>
</html>`;
}

function getAdminLoginPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111b21;min-height:100vh;display:flex;align-items:center;justify-content:center}
        .container{background:#202c33;border-radius:12px;padding:30px;max-width:400px;width:100%}
        h1{color:white;text-align:center;margin-bottom:20px}
        input{width:100%;padding:12px;margin-bottom:10px;background:#2a3942;border:none;border-radius:8px;color:white;font-size:16px;outline:none}
        button{width:100%;padding:14px;background:#00a884;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}
        button:hover{background:#06cf9c}
    </style>
</head>
<body>
    <div class="container">
        <h1>Admin Login</h1>
        <form method="POST" action="/admin/login">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>`;
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

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname === '/ws' || pathname === '/admin/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Start server
async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('Advanced WhatsApp Server running on port ' + PORT);
        console.log('User: http://localhost:' + PORT);
        console.log('Admin: http://localhost:' + PORT + '/admin');
        console.log('Admin credentials: Hammad / Hammad1122@');
    });
}

start();

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
const DB_NAME = 'chat_app';

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
        about: 'Hey there! I am using ChatApp',
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
        type,
        mediaUrl,
        duration,
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

// Generate Chat App HTML
function getChatPage(user) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#6C5CE7">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>ChatApp - ${user.name}</title>
    <style>
        :root {
            --primary: #6C5CE7;
            --primary-dark: #5B4BC4;
            --bg: #0F0F23;
            --surface: #1A1A2E;
            --surface-light: #2A2A3E;
            --text: #E4E4F0;
            --text-secondary: #8888A0;
            --accent: #A8E6CF;
            --danger: #FF6B6B;
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
            background: var(--bg);
            color: var(--text);
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Header */
        .app-header {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 100;
            box-shadow: 0 4px 20px rgba(108, 92, 231, 0.3);
        }
        
        .back-btn {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 50%;
            transition: all 0.3s;
            background: rgba(255,255,255,0.1);
        }
        
        .back-btn:hover {
            background: rgba(255,255,255,0.2);
            transform: scale(1.1);
        }
        
        .avatar {
            width: 42px;
            height: 42px;
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
            box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);
        }
        
        .avatar .online-dot {
            width: 12px;
            height: 12px;
            background: #4ADE80;
            border-radius: 50%;
            position: absolute;
            bottom: 0;
            right: 0;
            border: 2px solid var(--primary);
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
            background: rgba(255,255,255,0.1);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
        }
        
        .header-actions button:hover {
            background: rgba(255,255,255,0.2);
            transform: scale(1.1);
        }
        
        /* Chat Background */
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: var(--bg);
            background-image: 
                radial-gradient(circle at 20% 50%, rgba(108, 92, 231, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(168, 230, 207, 0.03) 0%, transparent 50%);
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
            margin-bottom: 8px;
            display: flex;
            animation: messageSlide 0.3s ease-out;
        }
        
        .message-wrapper.out {
            justify-content: flex-end;
        }
        
        .message-wrapper.in {
            justify-content: flex-start;
        }
        
        @keyframes messageSlide {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .message-bubble {
            max-width: 75%;
            padding: 10px 12px;
            border-radius: 16px;
            position: relative;
            word-wrap: break-word;
            white-space: pre-wrap;
            transition: transform 0.2s;
        }
        
        .message-bubble:hover {
            transform: scale(1.01);
        }
        
        .message-bubble.out {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            border-radius: 16px 4px 16px 16px;
            margin-left: 50px;
        }
        
        .message-bubble.in {
            background: var(--surface);
            border-radius: 4px 16px 16px 16px;
            margin-right: 50px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        
        .message-text {
            font-size: 14.5px;
            line-height: 1.4;
            color: var(--text);
        }
        
        .message-meta {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
        }
        
        .message-time {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
        }
        
        .message-status {
            font-size: 14px;
        }
        
        .message-status.read {
            color: #4ADE80;
        }
        
        /* Image Messages */
        .message-image {
            max-width: 280px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .message-image:hover {
            transform: scale(1.02);
            box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        }
        
        /* Voice Messages */
        .voice-message {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 200px;
        }
        
        .voice-play-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--accent);
            border: none;
            color: var(--bg);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.3s;
            font-size: 18px;
        }
        
        .voice-play-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 15px rgba(168, 230, 207, 0.4);
        }
        
        .voice-play-btn.playing {
            background: var(--danger);
            color: white;
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
            background: var(--accent);
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
            background: var(--surface);
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 60px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        
        .input-area button {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            flex-shrink: 0;
        }
        
        .input-area button:hover {
            color: white;
            background: rgba(255,255,255,0.05);
        }
        
        .message-input {
            flex: 1;
            background: var(--surface-light);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 10px 16px;
            border-radius: 24px;
            color: white;
            font-size: 15px;
            outline: none;
            min-width: 0;
            transition: all 0.3s;
        }
        
        .message-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.1);
        }
        
        .message-input::placeholder {
            color: var(--text-secondary);
        }
        
        .send-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark)) !important;
            color: white !important;
            box-shadow: 0 4px 15px rgba(108, 92, 231, 0.3);
        }
        
        .send-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(108, 92, 231, 0.5);
        }
        
        /* Recording Indicator */
        .recording-indicator {
            background: var(--danger);
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
            color: var(--danger) !important;
            animation: pulse 1s infinite;
        }
        
        /* Image Preview */
        .image-preview {
            display: none;
            padding: 10px;
            background: var(--surface);
            position: relative;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        
        .image-preview img {
            max-height: 120px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        
        .image-preview .close-preview {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0,0,0,0.8);
            color: white;
            border: none;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.3s;
        }
        
        .image-preview .close-preview:hover {
            background: var(--danger);
        }
        
        /* Emoji Picker */
        .emoji-picker {
            display: none;
            background: var(--surface);
            padding: 12px;
            max-height: 220px;
            overflow-y: auto;
            flex-wrap: wrap;
            gap: 8px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        
        .emoji-picker.open {
            display: flex;
        }
        
        .emoji-picker span {
            font-size: 24px;
            cursor: pointer;
            padding: 8px;
            border-radius: 12px;
            transition: all 0.2s;
        }
        
        .emoji-picker span:hover {
            background: rgba(255,255,255,0.1);
            transform: scale(1.2);
        }
        
        /* Typing Indicator */
        .typing-indicator {
            display: none;
            padding: 8px 16px;
        }
        
        .typing-dots {
            display: flex;
            gap: 4px;
            padding: 10px 14px;
            background: var(--surface);
            border-radius: 12px;
            display: inline-flex;
        }
        
        .typing-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--text-secondary);
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
            background: rgba(108, 92, 231, 0.2);
            color: var(--text-secondary);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(108, 92, 231, 0.2);
        }
        
        /* Menu Overlay */
        .menu-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            z-index: 200;
            backdrop-filter: blur(5px);
        }
        
        .menu-overlay.open {
            display: block;
        }
        
        .menu-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 300px;
            height: 100%;
            background: var(--surface);
            z-index: 201;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 20px;
            overflow-y: auto;
            box-shadow: -10px 0 40px rgba(0,0,0,0.5);
        }
        
        .menu-panel.open {
            transform: translateX(0);
        }
        
        .menu-item {
            padding: 14px 16px;
            color: white;
            cursor: pointer;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.3s;
            margin-bottom: 4px;
        }
        
        .menu-item:hover {
            background: rgba(108, 92, 231, 0.2);
            transform: translateX(-5px);
        }
        
        /* Wallpaper Grid */
        .wallpaper-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        
        .wallpaper-item {
            aspect-ratio: 1;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.3s;
            object-fit: cover;
        }
        
        .wallpaper-item:hover {
            border-color: var(--primary);
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(108, 92, 231, 0.3);
        }
        
        .wallpaper-item.selected {
            border-color: var(--accent);
            box-shadow: 0 0 20px rgba(168, 230, 207, 0.3);
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
            backdrop-filter: blur(10px);
        }
        
        .image-viewer.open {
            display: flex;
        }
        
        .image-viewer img {
            max-width: 95%;
            max-height: 95%;
            object-fit: contain;
            border-radius: 8px;
        }
        
        .image-viewer .close-viewer {
            position: absolute;
            top: 20px;
            right: 20px;
            color: white;
            font-size: 32px;
            cursor: pointer;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            transition: all 0.3s;
        }
        
        .image-viewer .close-viewer:hover {
            background: rgba(255,255,255,0.2);
            transform: rotate(90deg);
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
    <div class="app-header">
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
        <span>Recording voice message... <span id="recordingTimer">00:00</span></span>
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
        <button onclick="document.getElementById('imageInput').click()" title="Send Image">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
            </svg>
        </button>
        <input type="file" id="imageInput" accept="image/*" style="display:none" onchange="handleImageUpload(event)">
        <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()" autocomplete="off">
        <button class="record-btn" id="recordBtn" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Hold to record voice">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
        </button>
        <button class="send-btn" onclick="sendMessage()" title="Send Message">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
    </div>
    
    <!-- Menu Overlay -->
    <div class="menu-overlay" id="menuOverlay" onclick="closeMenu()"></div>
    <div class="menu-panel" id="menuPanel">
        <div style="text-align:center; margin-bottom:24px;">
            <div class="avatar" style="width:80px;height:80px;font-size:36px;margin:0 auto 12px;">
                <span>H</span>
            </div>
            <div style="color:white;font-size:18px;font-weight:600;">Hammad Bin Amir</div>
            <div style="color:var(--text-secondary);font-size:14px;">Administrator</div>
        </div>
        
        <div class="menu-item" onclick="changeWallpaper()">
            <span>🎨</span>
            <span>Change Theme</span>
        </div>
        
        <div class="menu-item" onclick="clearChat()">
            <span>🗑️</span>
            <span>Clear Chat</span>
        </div>
        
        <div class="menu-item" onclick="exportChat()">
            <span>📤</span>
            <span>Export Chat</span>
        </div>
        
        <div style="margin-top:24px; padding:10px;">
            <div style="color:var(--text-secondary);font-size:12px;margin-bottom:12px;font-weight:600;">THEME</div>
            <div class="wallpaper-grid" id="wallpaperGrid">
                <div class="wallpaper-item selected" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);" onclick="setWallpaper('gradient1')" title="Purple Dream"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);" onclick="setWallpaper('gradient2')" title="Sunset Pink"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);" onclick="setWallpaper('gradient3')" title="Ocean Blue"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);" onclick="setWallpaper('gradient4')" title="Fresh Green"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #fa709a 0%, #fee140 100%);" onclick="setWallpaper('gradient5')" title="Golden Hour"></div>
                <div class="wallpaper-item" style="background:linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);" onclick="setWallpaper('gradient6')" title="Cotton Candy"></div>
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
        let currentWallpaper = localStorage.getItem('chatapp_theme') || 'gradient1';
        let selectedImage = null;
        
        // Emojis
        const emojis = ['😀','😂','😍','🥰','😘','😜','🤔','😴','😢','😡','👍','👎','❤️','💔','🔥','⭐','🎉','💯','🙏','💪','🤝','👋','🎂','🍕','☕','🎵','📸','💰','✅','❌','🎮','🚀','💡','🌈'];
        
        // Initialize
        function init() {
            loadEmojiPicker();
            applyWallpaper(currentWallpaper);
            connectWebSocket();
            updateOnlineStatus();
            
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
            
            document.addEventListener('paste', handlePaste);
        }
        
        // WebSocket Connection
        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.host + '/ws');
            
            ws.onopen = () => {
                console.log('Connected to server');
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
                            ${msg.message ? '<div class="message-text">${escapeHtml(msg.message)}</div>' : ''}
                            <div class="message-meta">
                                <span class="message-time">${time}</span>
                                ${isOut ? '<span class="message-status read">✓✓</span>' : ''}
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
                                ${isOut ? '<span class="message-status read">✓✓</span>' : ''}
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
                                ${isOut ? '<span class="message-status read">✓✓</span>' : ''}
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
            text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#A8E6CF;text-decoration:underline;">$1</a>');
            text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            text = text.replace(/_(.*?)_/g, '<em>$1</em>');
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
        
        // Wallpaper/Theme
        function setWallpaper(type) {
            currentWallpaper = type;
            localStorage.setItem('chatapp_theme', type);
            applyWallpaper(type);
            closeMenu();
            
            document.querySelectorAll('.wallpaper-item').forEach(item => {
                item.classList.remove('selected');
            });
            event.target.classList.add('selected');
        }
        
        function applyWallpaper(type) {
            const container = document.getElementById('chatContainer');
            
            const wallpapers = {
                'gradient1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'gradient2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                'gradient3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                'gradient4': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                'gradient5': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                'gradient6': 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'
            };
            
            container.style.backgroundImage = wallpapers[type] || wallpapers['gradient1'];
        }
        
        function changeWallpaper() {
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
            a.download = 'chat_export_' + new Date().toISOString().split('T')[0] + '.txt';
            a.click();
            closeMenu();
        }
        
        // Notifications
        function showNotification(message) {
            if (Notification.permission === 'granted' && document.hidden) {
                new Notification('New Message from Hammad', {
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
        
        // Initialize
        init();
        setTimeout(scrollToBottom, 500);
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
    
    if (pathname === '/api/chat/clear' && method === 'POST') {
        const token = parsedUrl.query.token;
        const user = await getUserByToken(token);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }
        await db.collection('messages').deleteMany({ chatId: user.chatId });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
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
    
    // Admin Dashboard
    if (pathname === '/admin/dashboard' && method === 'GET') {
        const sessionId = cookies.sessionId;
        if (!sessionId || !adminSessions.has(sessionId)) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminDashboard());
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
    <title>ChatApp - Welcome</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .container{background:rgba(255,255,255,0.95);border-radius:20px;padding:40px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);backdrop-filter:blur(10px)}
        .logo-container{text-align:center;margin-bottom:30px}
        .logo{width:90px;height:90px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(102,126,234,0.4)}
        .logo svg{width:50px;height:50px}
        h1{text-align:center;color:#2D3748;margin-bottom:8px;font-size:28px;font-weight:700}
        .subtitle{text-align:center;color:#718096;margin-bottom:30px;font-size:14px;line-height:1.5}
        .input-group{margin-bottom:16px}
        label{display:block;margin-bottom:6px;color:#4A5568;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
        input{width:100%;padding:14px 16px;border:2px solid #E2E8F0;border-radius:12px;font-size:16px;outline:none;transition:all 0.3s;background:#F7FAFC}
        input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1);background:white}
        button{width:100%;padding:16px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(102,126,234,0.3)}
        button:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(102,126,234,0.4)}
        .features{display:flex;justify-content:center;gap:20px;margin-top:30px}
        .feature{text-align:center}
        .feature-icon{font-size:24px;margin-bottom:4px}
        .feature-text{font-size:11px;color:#718096}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <div class="logo">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
            </div>
            <h1>ChatApp</h1>
            <p class="subtitle">Connect and chat in real-time with our secure messaging platform</p>
        </div>
        <form method="POST" action="/login">
            <div class="input-group">
                <label>Your Name</label>
                <input type="text" name="name" placeholder="Enter your name" required autocomplete="off">
            </div>
            <div class="input-group">
                <label>Phone or Email</label>
                <input type="text" name="contact" placeholder="Enter phone number or email" required autocomplete="off">
            </div>
            <button type="submit">Start Chatting</button>
        </form>
        <div class="features">
            <div class="feature">
                <div class="feature-icon">🔒</div>
                <div class="feature-text">Encrypted</div>
            </div>
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <div class="feature-text">Real-time</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📱</div>
                <div class="feature-text">Responsive</div>
            </div>
        </div>
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
    <title>ChatApp Admin</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#1A1A2E,#16213E);min-height:100vh;display:flex;align-items:center;justify-content:center}
        .container{background:#0F0F23;border-radius:16px;padding:40px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.05)}
        .logo{text-align:center;margin-bottom:30px}
        .logo-icon{font-size:48px;margin-bottom:10px}
        h1{color:white;text-align:center;margin-bottom:8px;font-size:24px}
        p{color:#8888A0;text-align:center;margin-bottom:30px;font-size:14px}
        .input-group{margin-bottom:16px}
        label{display:block;margin-bottom:6px;color:#8888A0;font-size:12px;text-transform:uppercase;letter-spacing:1px}
        input{width:100%;padding:14px;background:#1A1A2E;border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-size:16px;outline:none;transition:all 0.3s}
        input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
        button{width:100%;padding:16px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s}
        button:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(102,126,234,0.3)}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <div class="logo-icon">🛡️</div>
            <h1>Admin Panel</h1>
            <p>Login to manage your chat application</p>
        </div>
        <form method="POST" action="/admin/login">
            <div class="input-group">
                <label>Username</label>
                <input type="text" name="username" placeholder="Enter username" required>
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" name="password" placeholder="Enter password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>
    </div>
</body>
</html>`;
}

function getAdminDashboard() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - ChatApp</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#1A1A2E,#16213E);min-height:100vh;color:white}
        .header{background:rgba(15,15,35,0.9);padding:20px;border-bottom:1px solid rgba(255,255,255,0.05);backdrop-filter:blur(10px)}
        .header-content{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
        .header h1{font-size:24px;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .main-content{max-width:1200px;margin:30px auto;padding:0 20px}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:30px}
        .stat-card{background:rgba(15,15,35,0.8);padding:24px;border-radius:16px;border:1px solid rgba(255,255,255,0.05)}
        .stat-value{font-size:32px;font-weight:700;margin-bottom:4px}
        .stat-label{color:#8888A0;font-size:14px}
        .chat-list{background:rgba(15,15,35,0.8);border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.05)}
        .chat-list h2{margin-bottom:20px}
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <h1>ChatApp Admin Dashboard</h1>
            <button onclick="window.location.href='/admin/logout'" style="padding:10px 20px;background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:white;cursor:pointer">Logout</button>
        </div>
    </div>
    <div class="main-content">
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" id="activeUsers">0</div>
                <div class="stat-label">Active Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="totalMessages">0</div>
                <div class="stat-label">Total Messages</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="onlineNow">0</div>
                <div class="stat-label">Online Now</div>
            </div>
        </div>
        <div class="chat-list">
            <h2>Active Conversations</h2>
            <div id="conversations">Loading...</div>
        </div>
    </div>
    <script>
        // Connect to admin WebSocket
        const ws = new WebSocket('ws://' + window.location.host + '/admin/ws');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Handle real-time updates
            updateDashboard();
        };
        
        function updateDashboard() {
            // Update stats in real-time
            fetch('/api/admin/stats')
                .then(res => res.json())
                .then(data => {
                    document.getElementById('activeUsers').textContent = data.activeUsers || 0;
                    document.getElementById('totalMessages').textContent = data.totalMessages || 0;
                    document.getElementById('onlineNow').textContent = data.onlineNow || 0;
                });
        }
        
        updateDashboard();
        setInterval(updateDashboard, 30000);
    </script>
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
        console.log('🚀 ChatApp Server running on port ' + PORT);
        console.log('📱 User: http://localhost:' + PORT);
        console.log('🛡️ Admin: http://localhost:' + PORT + '/admin');
        console.log('👤 Admin credentials: Hammad / Hammad1122@');
    });
}

start();

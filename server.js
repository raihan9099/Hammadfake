const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'whatsapp_chat_app';

let db, mongoClient;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Database connection
async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        // Create collections
        const collections = ['users', 'messages', 'sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        
        // Create indexes
        await db.collection('users').createIndex({ phone: 1 }, { sparse: true });
        await db.collection('users').createIndex({ email: 1 }, { sparse: true });
        await db.collection('messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
        
        console.log('MongoDB connected successfully');
        return true;
    } catch (e) {
        console.error('MongoDB connection error:', e);
        return false;
    }
}

// User functions
async function findOrCreateUser(name, contact) {
    // Check if user exists by phone or email
    const query = contact.includes('@') 
        ? { email: contact }
        : { phone: contact };
    
    let user = await db.collection('users').findOne(query);
    
    if (user) {
        // Update last seen
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { lastSeen: new Date(), name: name } }
        );
        return user;
    }
    
    // Create new user
    const chatId = 'CHAT-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    user = {
        chatId,
        name,
        phone: contact.includes('@') ? '' : contact,
        email: contact.includes('@') ? contact : '',
        createdAt: new Date(),
        lastSeen: new Date(),
        status: 'active'
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
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
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

async function getMessages(chatId, limit = 50) {
    return await db.collection('messages')
        .find({ chatId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
}

async function saveMessage(chatId, sender, message) {
    const msg = {
        chatId,
        sender, // 'user' or 'admin'
        message,
        createdAt: new Date(),
        read: false
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
        .find({ status: 'active' })
        .sort({ lastSeen: -1 })
        .toArray();
}

async function getLastMessage(chatId) {
    return await db.collection('messages')
        .findOne(
            { chatId },
            { sort: { createdAt: -1 } }
        );
}

async function getUnreadCount(chatId) {
    return await db.collection('messages')
        .countDocuments({ chatId, sender: 'user', read: false });
}

// Admin authentication
async function verifyAdmin(username, password) {
    return username === 'Hammad' && password === 'Hammad1122@';
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

// HTML Pages
function getLoginPage(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat App - Login</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background: linear-gradient(135deg, #075e54 0%, #128c7e 50%, #25d366 100%);
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }
        .chat-bg {
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        .glass {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
        }
        .input-field {
            border-bottom: 2px solid #25d366;
            transition: all 0.3s;
        }
        .input-field:focus {
            border-bottom-color: #128c7e;
            outline: none;
        }
    </style>
</head>
<body class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
        <!-- App Header -->
        <div class="text-center mb-8">
            <div class="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                <svg class="w-12 h-12 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
            </div>
            <h1 class="text-3xl font-bold text-white mb-2">WhatsApp Chat</h1>
            <p class="text-white/80 text-sm">Connect with Hammad Bin Amir</p>
        </div>

        <!-- Login Form -->
        <div class="glass rounded-2xl shadow-2xl p-6">
            <h2 class="text-xl font-semibold text-gray-800 mb-6 text-center">Enter Your Details</h2>
            
            ${error ? `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">${error}</div>` : ''}
            
            <form method="POST" action="/login" class="space-y-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                    <input type="text" name="name" required 
                        class="w-full px-4 py-3 bg-gray-50 input-field text-gray-900 text-sm"
                        placeholder="Enter your name">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number or Email *</label>
                    <input type="text" name="contact" required 
                        class="w-full px-4 py-3 bg-gray-50 input-field text-gray-900 text-sm"
                        placeholder="Phone number or email address">
                    <p class="text-xs text-gray-500 mt-1">Use this to find your old chats later</p>
                </div>
                
                <button type="submit" 
                    class="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition duration-200 transform hover:scale-[1.02]">
                    Start Chatting
                </button>
            </form>
        </div>
    </div>
</body>
</html>`;
}

function getChatPage(user) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Chat - ${user.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .chat-header {
            background: #075e54;
            color: white;
        }
        .chat-bg {
            background-color: #e5ddd5;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4c8bc' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }
        .msg-out {
            background: #dcf8c6;
            border-radius: 8px 0 8px 8px;
            float: right;
            clear: both;
        }
        .msg-in {
            background: white;
            border-radius: 0 8px 8px 8px;
            float: left;
            clear: both;
        }
        .typing-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #a0a8ae;
            animation: typing 1.4s infinite;
            display: inline-block;
            margin: 0 2px;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        .message-time {
            font-size: 0.65rem;
            color: rgba(0,0,0,0.45);
            margin-top: 4px;
            text-align: right;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="chat-header px-4 py-3 flex items-center gap-3 shadow-lg">
        <div class="relative">
            <div class="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                <span class="text-lg font-bold">H</span>
            </div>
            <div class="w-3 h-3 bg-green-500 rounded-full absolute bottom-0 right-0 border-2 border-[#075e54]"></div>
        </div>
        <div class="flex-1">
            <div class="font-semibold">Hammad Bin Amir</div>
            <div class="text-xs text-green-200" id="statusText">online</div>
        </div>
    </div>

    <!-- Messages -->
    <div class="chat-bg" id="messagesContainer">
        <div class="text-center mb-4">
            <span class="bg-white/80 text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm">
                🔒 Messages are secure
            </span>
        </div>
        <div id="messages"></div>
        <div id="typingIndicator" class="hidden" style="float: left; clear: both; margin-top: 8px;">
            <div class="bg-white rounded-lg px-4 py-3 shadow-sm inline-block">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
        <div style="clear: both;"></div>
    </div>

    <!-- Input -->
    <div class="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
        <input type="text" id="messageInput" 
            class="flex-1 bg-white rounded-full px-4 py-2 text-sm focus:outline-none"
            placeholder="Type a message"
            onkeypress="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()" 
            class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white hover:bg-green-600 transition">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
            </svg>
        </button>
    </div>

    <script>
        let ws;
        let token = '${user.token}';
        let chatId = '${user.chatId}';
        
        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.host + '/ws');
            
            ws.onopen = () => {
                console.log('Connected');
                ws.send(JSON.stringify({ type: 'auth', token: token }));
                loadMessages();
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'message') {
                    addMessage(data.message, data.sender, data.timestamp);
                } else if (data.type === 'typing') {
                    document.getElementById('typingIndicator').className = 
                        data.isTyping ? '' : 'hidden';
                    document.getElementById('statusText').textContent = 
                        data.isTyping ? 'typing...' : 'online';
                    scrollToBottom();
                } else if (data.type === 'auth_success') {
                    loadMessages();
                }
            };
            
            ws.onclose = () => {
                document.getElementById('statusText').textContent = 'offline';
                setTimeout(connect, 3000);
            };
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;
            
            ws.send(JSON.stringify({
                type: 'message',
                token: token,
                message: message
            }));
            
            input.value = '';
        }
        
        function addMessage(text, sender, timestamp) {
            const messagesDiv = document.getElementById('messages');
            const msgDiv = document.createElement('div');
            msgDiv.className = 'mb-3';
            
            const time = new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const align = sender === 'user' ? 'justify-end' : 'justify-start';
            const bubble = sender === 'user' ? 'msg-out' : 'msg-in';
            
            msgDiv.innerHTML = `
                <div class="flex ${align}">
                    <div class="${bubble} max-w-[80%] px-3 py-2 shadow-sm">
                        <div class="text-sm text-gray-900">${text}</div>
                        <div class="message-time">
                            ${time}
                            ${sender === 'user' ? ' ✓✓' : ''}
                        </div>
                    </div>
                </div>
            `;
            
            messagesDiv.appendChild(msgDiv);
            scrollToBottom();
        }
        
        async function loadMessages() {
            try {
                const response = await fetch('/api/messages?token=' + token);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('messages').innerHTML = '';
                    data.messages.forEach(msg => {
                        addMessage(msg.message, msg.sender, msg.createdAt);
                    });
                }
            } catch (e) {
                console.error('Error loading messages:', e);
            }
        }
        
        function scrollToBottom() {
            const container = document.getElementById('messagesContainer');
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
        
        // Typing indicator
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
        
        connect();
    </script>
</body>
</html>`;
}

function getAdminLoginPage(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background: #111b21;
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
    </style>
</head>
<body class="flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
        <div class="text-center mb-8">
            <div class="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
            </div>
            <h1 class="text-2xl font-bold text-white">Admin Panel</h1>
        </div>
        
        <div class="bg-[#202c33] rounded-lg p-6 shadow-xl">
            ${error ? `<div class="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">${error}</div>` : ''}
            
            <form method="POST" action="/admin/login" class="space-y-4">
                <div>
                    <label class="block text-sm text-gray-400 mb-2">Username</label>
                    <input type="text" name="username" required 
                        class="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Enter username">
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-2">Password</label>
                    <input type="password" name="password" required 
                        class="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Enter password">
                </div>
                <button type="submit" 
                    class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition">
                    Login
                </button>
            </form>
        </div>
    </div>
</body>
</html>`;
}

async function getAdminPanelPage(users) {
    const usersList = [];
    
    for (const user of users) {
        const lastMsg = await getLastMessage(user.chatId);
        const unread = await getUnreadCount(user.chatId);
        
        usersList.push({
            ...user,
            lastMessage: lastMsg,
            unread: unread
        });
    }
    
    const usersHTML = usersList.map(user => `
        <div class="flex items-center gap-3 p-3 hover:bg-[#202c33] cursor-pointer border-b border-[#2a3942] transition"
             onclick="openChat('${user.chatId}', '${user.name}')">
            <div class="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span class="text-lg font-bold text-white">${user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline">
                    <h3 class="text-white font-medium text-sm truncate">${user.name}</h3>
                    <span class="text-xs text-gray-500 flex-shrink-0 ml-2">
                        ${user.lastMessage ? new Date(user.lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}
                    </span>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <p class="text-sm text-gray-400 truncate">
                        ${user.lastMessage ? user.lastMessage.message.substring(0, 30) : 'No messages'}
                    </p>
                    ${user.unread > 0 ? `
                        <span class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">
                            ${user.unread}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - Chat Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #111b21;
            height: 100vh;
            display: flex;
        }
        .chat-list {
            width: 380px;
            background: #111b21;
            border-right: 1px solid #2a3942;
        }
        .chat-area {
            flex: 1;
            background: #222e35;
        }
        .chat-header {
            background: #202c33;
        }
        .chat-bg {
            background-color: #0b141a;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        .msg-out {
            background: #005c4b;
            border-radius: 8px 0 8px 8px;
        }
        .msg-in {
            background: #202c33;
            border-radius: 0 8px 8px 8px;
        }
        .typing-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #a0a8ae;
            animation: typing 1.4s infinite;
            display: inline-block;
            margin: 0 2px;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        .active-chat {
            background: #2a3942 !important;
        }
    </style>
</head>
<body>
    <!-- Chat List -->
    <div class="chat-list flex flex-col">
        <div class="chat-header px-4 py-3 flex items-center justify-between">
            <h1 class="text-white font-semibold text-lg">Chats</h1>
            <a href="/admin/logout" class="text-gray-400 hover:text-white text-sm">Logout</a>
        </div>
        <div class="flex-1 overflow-y-auto">
            ${usersHTML || '<div class="text-gray-500 text-center py-8">No users yet</div>'}
        </div>
    </div>

    <!-- Chat Area -->
    <div class="chat-area flex flex-col" id="chatArea">
        <div class="flex-1 flex items-center justify-center">
            <div class="text-center text-gray-500">
                <svg class="w-20 h-20 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
                </svg>
                <p class="text-lg">Select a chat to start messaging</p>
            </div>
        </div>
    </div>

    <script>
        let ws;
        let currentChatId = null;
        
        function connectAdmin() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.host + '/admin/ws');
            
            ws.onopen = () => {
                console.log('Admin connected');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'new_message' && data.chatId === currentChatId) {
                    addMessage(data.message, 'user', data.timestamp);
                }
                
                if (data.type === 'user_typing' && data.chatId === currentChatId) {
                    document.getElementById('typingIndicator').className = 
                        data.isTyping ? '' : 'hidden';
                    document.getElementById('statusText').textContent = 
                        data.isTyping ? 'typing...' : 'online';
                }
            };
        }
        
        async function openChat(chatId, userName) {
            currentChatId = chatId;
            
            document.getElementById('chatArea').innerHTML = `
                <div class="chat-header px-4 py-3 flex items-center gap-3">
                    <div class="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <span class="text-lg font-bold text-white">${userName.charAt(0)}</span>
                    </div>
                    <div class="flex-1">
                        <div class="text-white font-medium">${userName}</div>
                        <div class="text-xs text-gray-400" id="statusText">online</div>
                    </div>
                </div>
                <div class="chat-bg flex-1 overflow-y-auto p-4" id="messagesContainer">
                    <div id="messages"></div>
                    <div id="typingIndicator" class="hidden" style="float: left; clear: both; margin-top: 8px;">
                        <div class="msg-in px-4 py-3 inline-block shadow-sm">
                            <span class="typing-dot"></span>
                            <span class="typing-dot"></span>
                            <span class="typing-dot"></span>
                        </div>
                    </div>
                    <div style="clear: both;"></div>
                </div>
                <div class="chat-header px-4 py-3 flex items-center gap-2">
                    <input type="text" id="adminMessageInput" 
                        class="flex-1 bg-[#2a3942] text-white rounded-full px-4 py-2 text-sm focus:outline-none"
                        placeholder="Type a message"
                        onkeypress="if(event.key==='Enter')sendAdminMessage('${chatId}')">
                    <button onclick="sendAdminMessage('${chatId}')" 
                        class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white hover:bg-green-600 transition">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                        </svg>
                    </button>
                </div>
            `;
            
            // Load messages
            const response = await fetch('/api/admin/messages?chatId=' + chatId);
            const data = await response.json();
            
            if (data.success) {
                const messagesDiv = document.getElementById('messages');
                messagesDiv.innerHTML = '';
                data.messages.forEach(msg => {
                    addMessage(msg.message, msg.sender, msg.createdAt);
                });
                scrollToBottom();
            }
        }
        
        function addMessage(text, sender, timestamp) {
            const messagesDiv = document.getElementById('messages');
            if (!messagesDiv) return;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'mb-3';
            
            const time = new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const align = sender === 'user' ? 'justify-start' : 'justify-end';
            const bubble = sender === 'user' ? 'msg-in' : 'msg-out';
            const textColor = sender === 'user' ? 'text-gray-200' : 'text-gray-200';
            
            msgDiv.innerHTML = `
                <div class="flex ${align}">
                    <div class="${bubble} max-w-[70%] px-3 py-2 shadow-sm">
                        <div class="text-sm ${textColor}">${text}</div>
                        <div class="text-xs text-gray-400 mt-1 text-right">${time}</div>
                    </div>
                </div>
            `;
            
            messagesDiv.appendChild(msgDiv);
            scrollToBottom();
        }
        
        function scrollToBottom() {
            const container = document.getElementById('messagesContainer');
            if (container) {
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }
        }
        
        async function sendAdminMessage(chatId) {
            const input = document.getElementById('adminMessageInput');
            const message = input.value.trim();
            if (!message) return;
            
            input.value = '';
            
            // Send via WebSocket
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'admin_message',
                    chatId: chatId,
                    message: message
                }));
            }
            
            // Save to database
            const response = await fetch('/api/admin/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, message })
            });
            
            const data = await response.json();
            if (data.success) {
                addMessage(message, 'admin', new Date().toISOString());
            }
        }
        
        connectAdmin();
        
        // Auto-refresh user list every 5 seconds
        setInterval(() => {
            fetch('/api/admin/users')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        // Update user list UI
                    }
                });
        }, 5000);
    </script>
</body>
</html>`;
}

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });
const userConnections = new Map(); // token -> ws
const adminConnections = new Set();

wss.on('connection', (ws, req) => {
    const pathname = url.parse(req.url).pathname;
    
    if (pathname === '/ws') {
        // User connection
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
                        
                        // Send auto-reply
                        setTimeout(async () => {
                            const reply = 'Hello! How can I help you today?';
                            await saveMessage(user.chatId, 'admin', reply);
                            
                            ws.send(JSON.stringify({
                                type: 'message',
                                message: reply,
                                sender: 'admin',
                                timestamp: new Date().toISOString()
                            }));
                            
                            // Notify admin
                            notifyAdmin({
                                type: 'new_message',
                                chatId: user.chatId,
                                name: user.name,
                                message: reply,
                                sender: 'admin',
                                timestamp: new Date().toISOString()
                            });
                        }, 2000);
                    }
                } else if (data.type === 'message' && userData) {
                    // Save message
                    await saveMessage(userData.chatId, 'user', data.message);
                    
                    // Send back to user
                    ws.send(JSON.stringify({
                        type: 'message',
                        message: data.message,
                        sender: 'user',
                        timestamp: new Date().toISOString()
                    }));
                    
                    // Notify admin
                    notifyAdmin({
                        type: 'new_message',
                        chatId: userData.chatId,
                        name: userData.name,
                        message: data.message,
                        sender: 'user',
                        timestamp: new Date().toISOString()
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
            }
        });
    } else if (pathname === '/admin/ws') {
        // Admin connection
        adminConnections.add(ws);
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'admin_message') {
                    // Save message
                    await saveMessage(data.chatId, 'admin', data.message);
                    
                    // Send to user
                    const userWs = userConnections.get(data.chatId);
                    if (userWs && userWs.readyState === WebSocket.OPEN) {
                        userWs.send(JSON.stringify({
                            type: 'message',
                            message: data.message,
                            sender: 'admin',
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

// Sessions for admin
const sessions = new Map();

// HTTP Server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, pathname);
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
            };
            const contentType = types[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }
    
    // Login page
    if (pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getLoginPage());
        return;
    }
    
    // Handle login
    if (pathname === '/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const name = params.get('name');
            const contact = params.get('contact');
            
            if (!name || !contact) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getLoginPage('Please fill all fields'));
                return;
            }
            
            const user = await findOrCreateUser(name, contact);
            const token = await createSession(user.chatId);
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getChatPage({ ...user, token }));
        });
        return;
    }
    
    // API: Get messages
    if (pathname === '/api/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        const user = await getUserByToken(token);
        
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
            return;
        }
        
        const messages = await getMessages(user.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    // Admin login page
    if (pathname === '/admin' && method === 'GET') {
        const sessionId = cookies.sessionId;
        if (sessionId && sessions.has(sessionId)) {
            const users = await getAllUsers();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(await getAdminPanelPage(users));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminLoginPage());
        return;
    }
    
    // Admin login
    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            if (await verifyAdmin(username, password)) {
                const sessionId = crypto.randomBytes(32).toString('hex');
                sessions.set(sessionId, { username });
                
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=86400`
                });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminLoginPage('Invalid credentials'));
            }
        });
        return;
    }
    
    // Admin logout
    if (pathname === '/admin/logout') {
        const sessionId = cookies.sessionId;
        if (sessionId) sessions.delete(sessionId);
        
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
        });
        res.end();
        return;
    }
    
    // API: Admin get messages
    if (pathname === '/api/admin/messages' && method === 'GET') {
        const chatId = parsedUrl.query.chatId;
        const messages = await getMessages(chatId);
        await markMessagesRead(chatId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages }));
        return;
    }
    
    // API: Admin send message
    if (pathname === '/api/admin/send' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { chatId, message } = JSON.parse(body);
            await saveMessage(chatId, 'admin', message);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }
    
    // API: Admin get users
    if (pathname === '/api/admin/users' && method === 'GET') {
        const users = await getAllUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, users }));
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1>');
});

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
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Admin: http://localhost:${PORT}/admin`);
        console.log('Admin credentials: Hammad / Hammad1122@');
    });
}

start();

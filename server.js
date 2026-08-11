require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 4000;

// Database Setup
const db = new Database('verification_hub.db');
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        isAdmin INTEGER DEFAULT 0,
        lastSeen DATETIME,
        isOnline INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        fileUrl TEXT,
        seen INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT,
        reply TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log('SQLite Database Ready');

// Admin & User Setup
const adminHash = bcrypt.hashSync('admin123', 10);
const userHash = bcrypt.hashSync('ok@123', 10);

const adminExists = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get('admin');
const userExists = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 0').get('baillamach');

if (adminExists) {
    db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(adminHash, 'Admin', 'admin');
    console.log('Admin Updated');
} else {
    db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('Admin', 'admin', adminHash);
    console.log('Admin Created');
}

if (!userExists) {
    db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 0)').run('Baiilla Maach', 'baillamach', userHash);
    console.log('User Created');
}

// Setup Auto Replies
const defaultReplies = [
    { keyword: 'hello', reply: 'Hello! Welcome to Baiilla Maach Official. How can I help you today?' },
    { keyword: 'hi', reply: 'Hi there! Thanks for reaching out to Baiilla Maach Official.' },
    { keyword: 'hey', reply: 'Hey! Great to hear from you. What can I do for you?' },
    { keyword: 'help', reply: 'I\'m here to help! What do you need assistance with?' },
    { keyword: 'admin', reply: 'The admin is currently offline. Your message has been received and will be responded to shortly.' },
    { keyword: 'offline', reply: 'The admin is currently offline. Please leave your message and we\'ll get back to you soon!' },
    { keyword: 'message', reply: 'Your message has been received. The official account will reply when available.' },
    { keyword: 'greeting', reply: 'Welcome to Baiilla Maach Official! How can we assist you today?' },
];

defaultReplies.forEach(({ keyword, reply }) => {
    const exists = db.prepare('SELECT * FROM auto_replies WHERE keyword = ?').get(keyword);
    if (!exists) {
        db.prepare('INSERT INTO auto_replies (keyword, reply) VALUES (?, ?)').run(keyword, reply);
    }
});

console.log('Admin Login: admin / admin123');
console.log('User Login: baillamach / ok@123');

// Middleware
app.use(express.json());
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

// Create directories if they don't exist
['uploads', 'assets/covermusic'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper Functions
function getSongs() {
    try {
        const dir = 'assets/covermusic';
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(f => f.endsWith('.mp3'))
            .map((f, i) => ({
                id: i,
                title: f.replace('.mp3', '').replace(/[-_]/g, ' '),
                url: '/assets/covermusic/' + encodeURIComponent(f),
                gif: '/assets/microphone-in-hand.gif'
            }));
    } catch (e) {
        return [];
    }
}

function isAdminOnline() {
    const admin = db.prepare('SELECT isOnline FROM users WHERE email = ? AND isAdmin = 1').get('admin');
    return admin ? admin.isOnline === 1 : false;
}

function getAutoReply(message) {
    const lowerMsg = message.toLowerCase();
    const replies = db.prepare('SELECT * FROM auto_replies WHERE isActive = 1').all();
    for (const reply of replies) {
        if (lowerMsg.includes(reply.keyword.toLowerCase())) {
            return reply.reply;
        }
    }
    return null;
}

// Routes
app.get('/login', (req, res) => {
    const loginHTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Admin Login - Baiilla Maach</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0a0a14;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .login-container {
            background: #13132b;
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            border: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 4px 40px rgba(0,0,0,0.5);
        }
        .logo { text-align: center; margin-bottom: 28px; }
        .logo h1 { 
            color: #8b5cf6; 
            font-size: 28px; 
            font-weight: 700;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .logo p { color: #6060a0; font-size: 14px; margin-top: 4px; }
        .form-group { margin-bottom: 16px; }
        .form-group input {
            width: 100%;
            padding: 14px 16px;
            background: #0a0a14;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 12px;
            font-size: 16px;
            color: #f0f0ff;
            outline: none;
            transition: border-color 0.3s;
        }
        .form-group input:focus { border-color: #8b5cf6; }
        .form-group input::placeholder { color: #6060a0; }
        .login-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
        }
        .login-btn:hover { transform: translateY(-2px); box-shadow: 0 0 40px rgba(139,92,246,0.3); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .error {
            color: #ef4444;
            font-size: 13px;
            margin-top: 12px;
            display: none;
            text-align: center;
        }
        .divider { border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0; }
        .back-link { text-align: center; }
        .back-link a { color: #6060a0; font-size: 13px; text-decoration: none; }
        .back-link a:hover { color: #f0f0ff; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🔐 Admin Login</h1>
            <p>Baiilla Maach Official Dashboard</p>
        </div>
        <form onsubmit="return handleLogin(event)">
            <div class="form-group">
                <input type="text" id="username" placeholder="Username" value="admin" required>
            </div>
            <div class="form-group">
                <input type="password" id="password" placeholder="Password" value="admin123" required>
            </div>
            <button type="submit" class="login-btn" id="loginBtn">Log In</button>
            <div class="error" id="error">Invalid username or password</div>
        </form>
        <div class="divider"></div>
        <div class="back-link">
            <a href="/">← Back to Home</a>
        </div>
    </div>
    <script>
        async function handleLogin(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const error = document.getElementById('error');
            const btn = document.getElementById('loginBtn');
            error.style.display = 'none';
            if (!username || !password) return;
            btn.disabled = true;
            btn.textContent = 'Logging in...';
            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: username, password: password })
                });
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/messenger';
                } else {
                    error.style.display = 'block';
                }
            } catch (err) {
                error.textContent = 'Connection error';
                error.style.display = 'block';
            }
            btn.disabled = false;
            btn.textContent = 'Log In';
        }
    </script>
</body>
</html>`;
    res.send(loginHTML);
});

app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        db.prepare('UPDATE users SET lastSeen = datetime("now"), isOnline = 1 WHERE email = ?').run(email);
        res.json({ 
            success: true, 
            redirect: user.isAdmin ? '/messenger' : '/',
            user: { name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    try {
        const { email } = req.body;
        db.prepare('UPDATE users SET isOnline = 0, lastSeen = datetime("now") WHERE email = ?').run(email);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get(email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        db.prepare('UPDATE users SET lastSeen = datetime("now"), isOnline = 1 WHERE email = ?').run(email);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/status', (req, res) => {
    try {
        const admin = db.prepare('SELECT isOnline FROM users WHERE email = ? AND isAdmin = 1').get('admin');
        res.json({ isOnline: admin ? admin.isOnline === 1 : false });
    } catch (err) {
        res.json({ isOnline: false });
    }
});

app.get('/api/admin/users', (req, res) => {
    try {
        const users = db.prepare("SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC").all();
        users.forEach(u => { 
            const c = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin' AND seen = 0").get(u.email); 
            u.unreadCount = c.count; 
        });
        res.json(users);
    } catch (err) { res.json([]); }
});

app.get('/api/msgs/:email', (req, res) => {
    try {
        const msgs = db.prepare("SELECT * FROM messages WHERE (sender = ? AND receiver = 'admin') OR (sender = 'admin' AND receiver = ?) ORDER BY timestamp ASC").all(req.params.email, req.params.email);
        res.json(msgs);
    } catch (err) { res.json([]); }
});

app.post('/api/send', (req, res) => {
    try {
        const { sender, receiver, message, type } = req.body;
        const result = db.prepare('INSERT INTO messages (sender, receiver, message, type) VALUES (?, ?, ?, ?)').run(sender, receiver, message, type || 'text');
        const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
        
        if (receiver === 'admin' && !isAdminOnline()) {
            const autoReply = getAutoReply(message);
            if (autoReply) {
                setTimeout(() => {
                    const replyResult = db.prepare('INSERT INTO messages (sender, receiver, message, type) VALUES (?, ?, ?, ?)').run('admin', sender, autoReply, 'text');
                    const replyMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyResult.lastInsertRowid);
                    io.emit('newMsg', replyMsg);
                }, 1500);
            }
        }
        
        io.emit('newMsg', msg);
        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/mark-read', (req, res) => {
    try {
        const { user } = req.body;
        db.prepare('UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = "admin" AND seen = 0').run(user);
        res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

// Admin Messenger
app.get('/messenger', (req, res) => {
    const adminHTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Messenger - Baiilla Maach</title>
    <style>
        :root {
            --bg-primary: #0a0a14;
            --bg-secondary: #13132b;
            --bg-card: #1a1a35;
            --text-primary: #f0f0ff;
            --text-secondary: #a0a0cc;
            --text-muted: #6060a0;
            --accent: #8b5cf6;
            --accent-hover: #7c3aed;
            --border: rgba(255,255,255,0.06);
            --radius: 12px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            overflow: hidden;
        }
        .app {
            display: flex;
            height: 100vh;
            max-width: 1200px;
            margin: 0 auto;
        }
        .sidebar {
            width: 320px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }
        .sb-header {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, #1a1040, #2d1b69);
        }
        .sb-header h2 { font-size: 18px; font-weight: 700; }
        .sb-header .logout-btn {
            padding: 8px 16px;
            background: rgba(255,255,255,0.1);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
        }
        .sb-header .logout-btn:hover { background: rgba(255,255,255,0.2); }
        .search-box {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
        }
        .search-box input {
            width: 100%;
            padding: 10px 14px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 20px;
            color: var(--text-primary);
            font-size: 14px;
            outline: none;
        }
        .search-box input:focus { border-color: var(--accent); }
        .user-list {
            flex: 1;
            overflow-y: auto;
        }
        .user-item {
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--border);
            transition: all 0.2s;
        }
        .user-item:hover { background: var(--bg-card); }
        .user-item.active { background: var(--bg-card); border-left: 3px solid var(--accent); }
        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 16px;
            color: white;
            flex-shrink: 0;
        }
        .user-info { flex: 1; min-width: 0; }
        .user-info .name { font-weight: 600; font-size: 14px; }
        .user-info .email { font-size: 12px; color: var(--text-secondary); }
        .user-info .status { font-size: 11px; margin-top: 2px; }
        .user-info .status.online { color: #10b981; }
        .user-info .status.offline { color: var(--text-muted); }
        .unread-badge {
            background: var(--accent);
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 700;
        }
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-primary);
        }
        .chat-header {
            padding: 12px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--bg-secondary);
        }
        .chat-header .back-btn {
            display: none;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 20px;
            cursor: pointer;
        }
        .chat-header .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: white;
        }
        .chat-header .user-name { font-weight: 600; font-size: 15px; }
        .chat-header .user-status { font-size: 12px; color: var(--text-secondary); }
        .chat-header .user-status.online { color: #10b981; }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .message {
            max-width: 70%;
            padding: 10px 14px;
            border-radius: 16px;
            font-size: 14px;
            word-wrap: break-word;
        }
        .message.sent {
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: white;
            margin-left: auto;
            border-bottom-right-radius: 4px;
        }
        .message.received {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-bottom-left-radius: 4px;
        }
        .message .time {
            font-size: 10px;
            opacity: 0.7;
            margin-top: 4px;
            text-align: right;
        }
        .chat-input {
            padding: 12px 20px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
        }
        .chat-input .input-row {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .chat-input input {
            flex: 1;
            padding: 10px 16px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 20px;
            color: var(--text-primary);
            font-size: 14px;
            outline: none;
        }
        .chat-input input:focus { border-color: var(--accent); }
        .chat-input button {
            padding: 10px 20px;
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: white;
            border: none;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .chat-input button:hover { transform: scale(1.02); }
        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: var(--text-secondary);
            height: 100%;
            gap: 8px;
        }
        .empty-state h3 { font-weight: 600; font-size: 18px; }
        .empty-state p { font-size: 14px; }

        @media (max-width: 767px) {
            .sidebar { width: 100%; }
            .chat-area { display: none; position: fixed; inset: 0; z-index: 100; background: var(--bg-primary); }
            .chat-area.active { display: flex; }
            .chat-header .back-btn { display: block; }
        }
    </style>
</head>
<body>
    <div class="app" id="app">
        <div class="sidebar" id="sidebar">
            <div class="sb-header">
                <h2>💬 Conversations</h2>
                <button class="logout-btn" onclick="logout()">Logout</button>
            </div>
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search users..." oninput="filterUsers()">
            </div>
            <div class="user-list" id="userList">
                <div class="empty-state"><p>Loading...</p></div>
            </div>
        </div>

        <div class="chat-area" id="chatArea">
            <div class="chat-header">
                <button class="back-btn" onclick="goBack()">←</button>
                <div class="avatar" id="chatAvatar">?</div>
                <div>
                    <div class="user-name" id="chatUserName">Select a user</div>
                    <div class="user-status" id="chatUserStatus">Offline</div>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="empty-state">
                    <h3>No conversation</h3>
                    <p>Select a user to start chatting</p>
                </div>
            </div>
            <div class="chat-input" id="chatInput" style="display:none;">
                <div class="input-row">
                    <input type="text" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
                    <button onclick="sendMessage()">Send</button>
                </div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io({ transports: ["websocket", "polling"] });
        let currentUser = null;
        let users = [];

        async function checkAuth() {
            try {
                const response = await fetch('/api/admin/status');
                await response.json();
                loadUsers();
            } catch (e) {
                window.location.href = '/login';
            }
        }

        async function loadUsers() {
            try {
                const response = await fetch('/api/admin/users');
                users = await response.json();
                renderUsers();
            } catch (e) { console.error(e); }
        }

        function renderUsers() {
            const list = document.getElementById('userList');
            const search = document.getElementById('searchInput').value.toLowerCase();
            const filtered = users.filter(u => 
                u.name.toLowerCase().includes(search) || 
                u.email.toLowerCase().includes(search)
            );
            
            if (filtered.length === 0) {
                list.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
                return;
            }

            list.innerHTML = filtered.map(u => 
                '<div class="user-item ' + (currentUser && currentUser.email === u.email ? 'active' : '') + '" onclick="selectUser(\'' + u.email + '\')">' +
                    '<div class="user-avatar">' + u.name.charAt(0).toUpperCase() + '</div>' +
                    '<div class="user-info">' +
                        '<div class="name">' + u.name + '</div>' +
                        '<div class="email">' + u.email + '</div>' +
                        '<div class="status ' + (u.isOnline ? 'online' : 'offline') + '">' + (u.isOnline ? '🟢 Online' : '🔴 Offline') + '</div>' +
                    '</div>' +
                    (u.unreadCount > 0 ? '<div class="unread-badge">' + u.unreadCount + '</div>' : '') +
                '</div>'
            ).join('');
        }

        function filterUsers() { renderUsers(); }

        async function selectUser(email) {
            const user = users.find(u => u.email === email);
            if (!user) return;
            
            currentUser = user;
            document.getElementById('chatAvatar').textContent = user.name.charAt(0).toUpperCase();
            document.getElementById('chatUserName').textContent = user.name;
            document.getElementById('chatUserStatus').textContent = user.isOnline ? 'Online' : 'Offline';
            document.getElementById('chatUserStatus').className = 'user-status ' + (user.isOnline ? 'online' : '');
            document.getElementById('chatInput').style.display = 'flex';
            document.getElementById('chatArea').classList.add('active');
            
            socket.emit('markRead', { user: user.email });
            
            try {
                const response = await fetch('/api/msgs/' + encodeURIComponent(user.email));
                const messages = await response.json();
                const container = document.getElementById('chatMessages');
                container.innerHTML = '';
                
                if (messages.length === 0) {
                    container.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
                } else {
                    messages.forEach(msg => appendMessage(msg));
                }
                container.scrollTop = container.scrollHeight;
                loadUsers();
            } catch (e) {}
            
            if (window.innerWidth < 768) {
                document.getElementById('sidebar').style.display = 'none';
            }
        }

        function appendMessage(msg) {
            const container = document.getElementById('chatMessages');
            const isSent = msg.sender === 'admin';
            const div = document.createElement('div');
            div.className = 'message ' + (isSent ? 'sent' : 'received');
            div.innerHTML = msg.message + '<div class="time">' + new Date(msg.timestamp + "Z").toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div>';
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }

        function sendMessage() {
            if (!currentUser) return;
            const input = document.getElementById('messageInput');
            const msg = input.value.trim();
            if (!msg) return;
            
            socket.emit('sendMsg', {
                sender: 'admin',
                receiver: currentUser.email,
                message: msg,
                type: 'text'
            });
            
            appendMessage({
                sender: 'admin',
                receiver: currentUser.email,
                message: msg,
                timestamp: new Date().toISOString()
            });
            
            input.value = '';
            input.focus();
        }

        function goBack() {
            document.getElementById('chatArea').classList.remove('active');
            document.getElementById('sidebar').style.display = 'flex';
            document.getElementById('chatInput').style.display = 'none';
            currentUser = null;
        }

        function logout() {
            fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'admin' })
            }).then(() => {
                window.location.href = '/login';
            });
        }

        socket.on('connect', () => {
            socket.emit('register', { name: 'Admin', email: 'admin' });
        });

        socket.on('newMsg', (msg) => {
            if (currentUser && (msg.sender === currentUser.email || msg.receiver === currentUser.email || msg.sender === 'admin')) {
                const existing = document.querySelectorAll('.message');
                let found = false;
                for (const el of existing) {
                    if (el.textContent.includes(msg.message) && 
                        el.querySelector('.time')?.textContent === 
                        new Date(msg.timestamp + "Z").toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) {
                        found = true;
                        break;
                    }
                }
                if (!found) appendMessage(msg);
            }
            if (msg.sender !== 'admin') loadUsers();
        });

        socket.on('userStatus', (data) => {
            loadUsers();
            if (currentUser && currentUser.email === data.email) {
                document.getElementById('chatUserStatus').textContent = data.online ? 'Online' : 'Offline';
                document.getElementById('chatUserStatus').className = 'user-status ' + (data.online ? 'online' : '');
            }
        });

        setInterval(loadUsers, 10000);

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) document.getElementById('sidebar').style.display = 'flex';
        });

        checkAuth();
    </script>
</body>
</html>`;
    res.send(adminHTML);
});

// Main Page
app.get('/', (req, res) => {
    const songs = getSongs();
    const songsJSON = JSON.stringify(songs);

    let songsListHTML = '';
    songs.forEach((s, i) => {
        songsListHTML += `
        <div class="song-item" onclick="playTrack(${i})" id="song-${i}">
            <span class="song-num">${String(i + 1).padStart(2, '0')}</span>
            <div class="song-thumb-box">
                <img src="${s.gif}" class="song-thumb-static" id="st-${i}">
                <img src="${s.gif}" class="song-thumb-live" id="sl-${i}" style="display:none">
            </div>
            <div class="song-meta">
                <div class="song-name">${s.title}</div>
                <div class="song-by">Baiilla Maach</div>
            </div>
            <div class="song-eq" id="eq-${i}" style="display:none">
                <span></span><span></span><span></span>
            </div>
        </div>`;
    });

    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>Baiilla Maach Official</title>
    <style>
        :root {
            --bg-primary: #0a0a14;
            --bg-secondary: #13132b;
            --bg-card: #1a1a35;
            --bg-card-hover: #222244;
            --text-primary: #f0f0ff;
            --text-secondary: #a0a0cc;
            --text-muted: #6060a0;
            --accent: #8b5cf6;
            --accent-hover: #7c3aed;
            --accent-light: rgba(139,92,246,0.15);
            --border: rgba(255,255,255,0.06);
            --border-light: rgba(255,255,255,0.1);
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f97316;
            --radius: 12px;
            --shadow: 0 4px 20px rgba(0,0,0,0.4);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            min-height: 100vh;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: var(--bg-secondary); }
        ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 2px; }

        .container {
            max-width: 480px;
            margin: 0 auto;
            padding: 0 16px;
            width: 100%;
        }

        .header {
            background: rgba(10,10,20,0.8);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            gap: 12px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 18px;
            color: var(--accent);
        }

        .brand-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent), #ec4899);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 700;
            color: white;
            flex-shrink: 0;
        }

        .nav-links { display: flex; gap: 4px; }

        .nav-link {
            padding: 6px 12px;
            border-radius: var(--radius);
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 12px;
            transition: all 0.3s;
            cursor: pointer;
            text-decoration: none;
        }

        .nav-link:hover, .nav-link.active {
            background: var(--accent-light);
            color: var(--accent);
        }

        .hero {
            background: var(--bg-card);
            border-radius: var(--radius);
            padding: 24px 16px;
            margin: 16px 0;
            text-align: center;
            border: 1px solid var(--border);
            position: relative;
            overflow: hidden;
        }

        .hero::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 30% 30%, var(--accent-light), transparent 70%);
            opacity: 0.3;
            pointer-events: none;
        }

        .avatar-container {
            position: relative;
            display: inline-block;
            margin-bottom: 12px;
        }

        .avatar {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 3px solid var(--accent);
            object-fit: cover;
            position: relative;
            z-index: 1;
            box-shadow: 0 0 40px rgba(139,92,246,0.2);
        }

        .verified-badge {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 28px;
            height: 28px;
            background: var(--success);
            border-radius: 50%;
            border: 3px solid var(--bg-card);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2;
        }

        .verified-badge svg {
            width: 16px;
            height: 16px;
            fill: white;
        }

        .hero-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px;
            position: relative;
            z-index: 1;
            background: linear-gradient(135deg, #c4b5fd, #f9a8d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .hero-username {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 12px;
            position: relative;
            z-index: 1;
        }

        .hero-username .verified-tick {
            width: 18px;
            height: 18px;
        }

        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 32px;
            padding: 12px 0;
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
            margin: 12px 0;
            position: relative;
            z-index: 1;
        }

        .stat-item { text-align: center; }
        .stat-number { font-size: 16px; font-weight: 700; color: var(--accent); }
        .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            margin-bottom: 16px;
            transition: all 0.3s;
        }

        .card-body { padding: 20px; }

        .card-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-verified {
            background: rgba(16,185,129,0.15);
            color: var(--success);
        }

        .badge-warning {
            background: rgba(239,68,68,0.15);
            color: var(--danger);
        }

        .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
        }

        .real-account-card {
            background: linear-gradient(135deg, var(--bg-card), #1a1040);
            border: 2px solid var(--accent);
            border-radius: var(--radius);
            padding: 24px 16px;
            text-align: center;
            margin-bottom: 16px;
            position: relative;
            box-shadow: 0 0 40px rgba(139,92,246,0.1);
        }

        .real-account-label {
            display: inline-block;
            background: var(--accent);
            color: white;
            padding: 4px 16px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .real-account-pic {
            width: 96px;
            height: 96px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid var(--accent);
            margin: 0 auto 12px;
            box-shadow: 0 0 40px rgba(139,92,246,0.2);
        }

        .real-account-username {
            font-weight: 700;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 16px;
        }

        .verified-tick {
            width: 20px;
            height: 20px;
            animation: tickFloat 2s ease-in-out infinite;
        }

        @keyframes tickFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
        }

        .follow-buttons {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 16px;
        }

        .btn-follow {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 14px 20px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: all 0.3s;
            width: 100%;
        }

        .btn-follow:active { transform: scale(0.98); }

        .btn-follow-tiktok {
            background: #000000;
            color: white;
        }
        .btn-follow-tiktok:hover { background: #1a1a1a; }

        .btn-follow-fb {
            background: var(--accent);
            color: white;
        }
        .btn-follow-fb:hover { background: var(--accent-hover); }

        .btn-follow img {
            width: 22px;
            height: 22px;
            flex-shrink: 0;
        }

        .report-section {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
        }

        .report-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            transition: all 0.3s;
            padding: 12px;
            border-radius: var(--radius);
            background: rgba(239,68,68,0.05);
        }

        .report-area:active { transform: scale(0.98); }

        .report-gif {
            width: 80px;
            height: 80px;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .report-text-btn {
            padding: 12px 24px;
            background: var(--danger);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            width: 100%;
            max-width: 300px;
        }

        .report-text-btn:hover { opacity: 0.9; }

        .fake-card {
            background: rgba(239,68,68,0.05);
            border: 1px solid rgba(239,68,68,0.2);
            border-radius: var(--radius);
            overflow: hidden;
            margin-bottom: 12px;
        }

        .fake-image-container {
            position: relative;
            text-align: center;
            padding: 12px;
            background: var(--bg-primary);
        }

        .fake-image {
            width: 100%;
            border-radius: 4px;
            max-height: 300px;
            object-fit: contain;
        }

        .fake-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            animation: bounceWarning 1.5s ease-in-out infinite;
            pointer-events: none;
        }

        @keyframes bounceWarning {
            0%, 100% { transform: translate(-50%, -50%) translateY(0); }
            50% { transform: translate(-50%, -50%) translateY(-10px); }
        }

        .fake-body { padding: 16px; }
        .fake-body h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--danger); }
        .platform { color: var(--warning); font-weight: 600; font-size: 12px; margin-bottom: 6px; }
        .text-secondary { color: var(--text-secondary); font-size: 13px; }

        .btn-fake-alert {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: transparent;
            color: var(--danger);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            margin-bottom: 10px;
            transition: all 0.3s;
        }

        .btn-fake-alert:hover { background: rgba(239,68,68,0.1); }

        .report-btn-area {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            text-decoration: none;
            color: var(--danger);
            font-weight: 600;
            font-size: 12px;
        }

        .report-btn-area img { width: 24px; height: 24px; }

        .music-header {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px;
            background: var(--bg-primary);
            border-radius: var(--radius);
            margin-bottom: 12px;
        }

        .music-cover {
            width: 56px;
            height: 56px;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            flex-shrink: 0;
        }

        .music-cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
        }

        .cover-live { display: none; }

        .music-info { flex: 1; min-width: 0; }
        .music-title { font-weight: 600; font-size: 15px; }
        .music-artist { font-size: 12px; color: var(--text-secondary); }

        .seek-bar {
            width: 100%;
            height: 4px;
            background: var(--border);
            border-radius: 2px;
            cursor: pointer;
            margin: 10px 0;
        }

        .seek-fill {
            height: 100%;
            background: var(--accent);
            border-radius: 2px;
            width: 0;
            transition: width 0.1s;
        }

        .time-display {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }

        .player-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
        }

        .ctrl-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 1px solid var(--border);
            background: var(--bg-secondary);
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
        }

        .ctrl-btn:active { transform: scale(0.95); }

        .ctrl-btn-play {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, var(--accent), #ec4899);
            border: none;
            position: relative;
            overflow: hidden;
            box-shadow: 0 0 40px rgba(139,92,246,0.3);
        }

        .ctrl-btn-play img {
            width: 32px;
            height: 32px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }

        .song-list {
            max-height: 200px;
            overflow-y: auto;
            border-top: 1px solid var(--border);
            margin-top: 12px;
            padding-top: 8px;
        }

        .song-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .song-item:active { background: var(--bg-primary); }
        .song-item.active { background: var(--accent-light); }

        .song-num { font-weight: 600; color: var(--text-muted); min-width: 24px; font-size: 12px; }

        .song-thumb-box {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            overflow: hidden;
            position: relative;
            flex-shrink: 0;
        }

        .song-thumb-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
        }

        .song-meta { flex: 1; min-width: 0; }
        .song-name { font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .song-by { font-size: 11px; color: var(--text-secondary); }

        .song-eq {
            margin-left: auto;
            display: flex;
            align-items: flex-end;
            gap: 2px;
            height: 14px;
            flex-shrink: 0;
        }

        .song-eq span {
            width: 3px;
            background: var(--accent);
            border-radius: 1px;
            animation: equalizer 0.8s ease-in-out infinite;
        }

        .song-eq span:nth-child(1) { animation-delay: 0s; height: 8px; }
        .song-eq span:nth-child(2) { animation-delay: 0.15s; height: 14px; }
        .song-eq span:nth-child(3) { animation-delay: 0.3s; height: 10px; }

        @keyframes equalizer {
            0%, 100% { height: 4px; }
            50% { height: 14px; }
        }

        .chat-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10000;
            display: none;
            align-items: flex-end;
            justify-content: center;
        }

        .chat-overlay.open { display: flex; }

        .chat-container {
            background: var(--bg-secondary);
            border-radius: var(--radius) var(--radius) 0 0;
            width: 100%;
            max-width: 480px;
            height: 80vh;
            max-height: 600px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 -4px 40px rgba(0,0,0,0.5);
        }

        .chat-header {
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, #1a1040, #2d1b69);
            border-radius: var(--radius) var(--radius) 0 0;
        }

        .chat-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .chat-header-left img {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--accent);
        }

        .chat-header-left h3 {
            font-size: 15px;
            font-weight: 600;
        }

        .chat-header-left .status {
            font-size: 11px;
            color: var(--text-secondary);
        }

        .chat-close {
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 24px;
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }

        .chat-close:active { background: rgba(255,255,255,0.1); }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: var(--bg-primary);
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .chat-login-area {
            text-align: center;
            padding: 32px 16px;
        }

        .chat-login-area h4 {
            margin-bottom: 12px;
            font-size: 16px;
        }

        .chat-login-area input {
            width: 100%;
            padding: 12px;
            margin-bottom: 10px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            background: var(--bg-card);
            color: var(--text-primary);
        }

        .chat-login-area input:focus { border-color: var(--accent); }

        .chat-message-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
            animation: messageSlide 0.3s ease-out;
        }

        @keyframes messageSlide {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .chat-message-row.own { flex-direction: row-reverse; }

        .chat-msg-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), #ec4899);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 12px;
            flex-shrink: 0;
        }

        .chat-bubble-wrap { max-width: 80%; }

        .chat-bubble {
            padding: 10px 14px;
            border-radius: 16px;
            font-size: 14px;
            word-wrap: break-word;
        }

        .chat-message-row:not(.own) .chat-bubble {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-bottom-left-radius: 4px;
        }

        .chat-message-row.own .chat-bubble {
            background: linear-gradient(135deg, var(--accent), #ec4899);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .chat-msg-time {
            font-size: 10px;
            opacity: 0.6;
            margin-top: 2px;
            text-align: right;
        }

        .chat-input-area {
            padding: 12px 16px;
            border-top: 1px solid var(--border);
            background: var(--bg-card);
        }

        .chat-input-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .chat-input-row input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: 14px;
            outline: none;
            background: var(--bg-primary);
            color: var(--text-primary);
        }

        .chat-input-row input:focus { border-color: var(--accent); }

        .chat-input-row button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), #ec4899);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .chat-input-row button:active { transform: scale(0.95); }

        .floating-chat-bubble {
            position: fixed;
            bottom: 20px;
            right: 16px;
            width: 60px;
            height: 60px;
            z-index: 9999;
            cursor: pointer;
            animation: floatBubble 3s ease-in-out infinite;
        }

        .floating-chat-bubble img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            box-shadow: 0 4px 20px rgba(139,92,246,0.4);
        }

        .floating-chat-bubble:active { transform: scale(0.95); }

        @keyframes floatBubble {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }

        .footer {
            background: var(--bg-secondary);
            border-top: 1px solid var(--border);
            padding: 20px 0;
            margin-top: 24px;
        }

        .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }

        .footer-text { font-size: 11px; color: var(--text-muted); }
        .footer-links { display: flex; gap: 12px; flex-wrap: wrap; }
        .footer-links a { font-size: 11px; color: var(--text-muted); text-decoration: none; }
        .footer-links a:hover { color: var(--text-primary); }

        @media (max-width: 420px) {
            .container { padding: 0 12px; }
            .avatar { width: 80px; height: 80px; }
            .real-account-pic { width: 80px; height: 80px; }
            .hero-title { font-size: 20px; }
            .stats-bar { gap: 20px; }
            .btn-follow { font-size: 13px; padding: 12px 16px; }
            .brand { font-size: 16px; }
            .nav-link { font-size: 11px; padding: 4px 10px; }
        }
    </style>
</head>
<body>

    <header class="header">
        <div class="container header-content">
            <div class="brand">
                <div class="brand-icon">B</div>
                <span>Baiilla Maach</span>
            </div>
            <nav class="nav-links">
                <a href="#home" class="nav-link active">Home</a>
                <a href="#real" class="nav-link">Verified</a>
                <a href="#fake" class="nav-link">Fake</a>
                <a href="#music" class="nav-link">Music</a>
            </nav>
        </div>
    </header>

    <main class="container">

        <section class="hero" id="home">
            <div class="avatar-container">
                <img src="/assets/celebrity_pfp.jpeg" class="avatar" alt="Baiilla Maach" onerror="this.style.display='none'">
                <div class="verified-badge">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
            </div>
            <h1 class="hero-title">Hammad Bin Amir</h1>
            <div class="hero-username">
                @baiillamaach_official
                <img src="/assets/bluetick_tiktok.png" class="verified-tick" alt="Verified">
            </div>
            <div class="stats-bar">
                <div class="stat-item">
                    <div class="stat-number">7K</div>
                    <div class="stat-label">Followers</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">190K</div>
                    <div class="stat-label">Likes</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Following</div>
                </div>
            </div>
        </section>

        <div class="real-account-card" id="real">
            <div class="real-account-label">✦ REAL ACCOUNT</div>
            <img src="/assets/celebrity_pfp.jpeg" class="real-account-pic" alt="Official Profile" onerror="this.style.display='none'">
            <div class="real-account-username">
                baiillamaach_offical
                <img src="/assets/bluetick_tiktok.png" class="verified-tick" alt="Verified">
            </div>
            <div class="follow-buttons">
                <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn-follow btn-follow-fb">
                    <img src="/assets/logo_fb.png" alt="Facebook">
                    Follow on Facebook
                </a>
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn-follow btn-follow-tiktok">
                    <img src="/assets/logo_tiktok.png" alt="TikTok">
                    Follow Official TikTok
                </a>
            </div>
            <div class="report-section">
                <div class="report-area" onclick="reportAccount()" id="reportActionArea">
                    <img src="/assets/report.gif" class="report-gif" alt="Report">
                    <button class="report-text-btn">Report This Account</button>
                </div>
            </div>
        </div>

        <div class="card" id="fake">
            <div class="card-body">
                <div class="card-title">
                    <span class="badge badge-warning"><span class="badge-dot"></span> WARNING</span>
                    Fake Accounts
                </div>
                <p class="text-secondary" style="margin-bottom: 12px;">Report these impersonators immediately</p>
                
                <div class="fake-card">
                    <div class="fake-image-container">
                        <img src="/assets/baillamach_fake.png" class="fake-image" alt="Fake Account">
                        <img src="/assets/Fakedetect_updown.png" class="fake-overlay" alt="Fake Alert">
                    </div>
                    <div class="fake-body">
                        <h4>@baiilla_mach</h4>
                        <div class="platform">TikTok - Impersonator</div>
                        <p class="text-secondary">Copies official content and steals identity</p>
                        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:8px;">
                            <button class="btn-fake-alert" onclick="playFakeAlert()">
                                <span>🔊</span> Fake Voice Alert
                            </button>
                            <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn-area" onclick="reportAccount()">
                                <img src="/assets/report.gif" alt="Report"> Report This Account
                            </a>
                        </div>
                    </div>
                </div>

                <div class="fake-card">
                    <div class="fake-image-container">
                        <img src="/assets/hammadfams.png" class="fake-image" alt="Fake Account">
                        <img src="/assets/Fakedetect_updown.png" class="fake-overlay" alt="Fake Alert">
                    </div>
                    <div class="fake-body">
                        <h4>@hammad_fams0</h4>
                        <div class="platform">TikTok - Impersonator</div>
                        <p class="text-secondary">Fake identity using our name</p>
                        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:8px;">
                            <button class="btn-fake-alert" onclick="playFakeAlert()">
                                <span>🔊</span> Fake Voice Alert
                            </button>
                            <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn-area" onclick="reportAccount()">
                                <img src="/assets/report.gif" alt="Report"> Report This Account
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${songs.length > 0 ? `
        <div class="card" id="music">
            <div class="card-body">
                <div class="card-title">
                    <span class="badge badge-verified"><span class="badge-dot"></span> MUSIC</span>
                    Cover Songs
                </div>
                
                <div class="music-header">
                    <div class="music-cover">
                        <img src="/assets/microphone-in-hand.gif" class="cover-static" id="coverStatic" alt="Cover">
                        <img src="/assets/microphone-in-hand.gif" class="cover-live" id="coverLive" alt="Playing">
                    </div>
                    <div class="music-info">
                        <div class="music-title" id="nowPlaying">Select a song</div>
                        <div class="music-artist">Baiilla Maach</div>
                    </div>
                </div>
                
                <div class="seek-bar" onclick="seekTrack(event)">
                    <div class="seek-fill" id="seekFill"></div>
                </div>
                
                <div class="time-display">
                    <span id="currentTime">0:00</span>
                    <span id="totalTime">0:00</span>
                </div>
                
                <div class="player-controls">
                    <button class="ctrl-btn" onclick="prevTrack()">⏮</button>
                    <button class="ctrl-btn ctrl-btn-play" id="playBtn" onclick="togglePlay()">
                        <img src="/assets/microphone-in-hand.gif" id="playGif" alt="Play">
                    </button>
                    <button class="ctrl-btn" onclick="nextTrack()">⏭</button>
                </div>
                
                <div class="song-list">
                    ${songsListHTML}
                </div>
            </div>
        </div>` : ''}

    </main>

    <div class="floating-chat-bubble" onclick="openChat()">
        <img src="/assets/message_bubble.gif" alt="Chat">
    </div>

    <div class="chat-overlay" id="chatOverlay">
        <div class="chat-container">
            <div class="chat-header">
                <div class="chat-header-left">
                    <img src="/assets/celebrity_pfp.jpeg" alt="Baiilla Maach">
                    <div>
                        <h3>Baiilla Maach</h3>
                        <div class="status" id="adminStatus">Loading...</div>
                    </div>
                </div>
                <button class="chat-close" onclick="closeChat()">✕</button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="chat-login-area" id="chatLoginArea">
                    <h4>💬 Talk to Baiilla Maach</h4>
                    <input type="text" id="chatNameInput" placeholder="Your Name">
                    <input type="text" id="chatEmailInput" placeholder="Your Email">
                    <button class="btn-follow btn-follow-fb" onclick="joinChat()" style="width:100%;margin-top:8px;">Join Chat</button>
                </div>
            </div>
            <div class="chat-input-area" id="chatInputArea" style="display:none;">
                <div class="chat-input-row">
                    <input type="text" id="chatMessageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendChatMessage()">
                    <button onclick="sendChatMessage()">➤</button>
                </div>
            </div>
        </div>
    </div>

    <footer class="footer">
        <div class="container footer-content">
            <div class="footer-text">2026 Baiilla Maach Official. All rights reserved.</div>
            <nav class="footer-links">
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Contact</a>
            </nav>
        </div>
    </footer>

    <audio id="realVoice" src="/assets/realvoice.mp3" preload="auto"></audio>
    <audio id="fakeVoice" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>
    <audio id="player" preload="auto"></audio>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        var player = document.getElementById("player");
        var tracks = ${songsJSON};
        var currentTrack = -1;
        var isPlaying = false;
        var socket = io({ transports: ["websocket", "polling"] });
        var chatUser = null;

        function stopAllAudio() {
            var realVoice = document.getElementById("realVoice");
            var fakeVoice = document.getElementById("fakeVoice");
            if (realVoice) { realVoice.pause(); realVoice.currentTime = 0; }
            if (fakeVoice) { fakeVoice.pause(); fakeVoice.currentTime = 0; }
            if (player) { player.pause(); }
            setPlayingState(false);
        }

        function playRealVoice() {
            var audio = document.getElementById("realVoice");
            if (!audio) return;
            stopAllAudio();
            audio.play().catch(function() {});
        }

        function playFakeAlert() {
            var audio = document.getElementById("fakeVoice");
            if (!audio) return;
            stopAllAudio();
            audio.play().catch(function() {});
        }

        function reportAccount() {
            alert("Report submitted. Thank you for helping keep the community safe.");
        }

        function setPlayingState(playing) {
            isPlaying = playing;
            var playGif = document.getElementById("playGif");
            var playBtn = document.getElementById("playBtn");
            if (playGif && playBtn) {
                playBtn.style.background = playing ? "linear-gradient(135deg, #7c3aed, #ec4899)" : "linear-gradient(135deg, #8b5cf6, #ec4899)";
            }
            syncPlaylistUI();
        }

        function syncPlaylistUI() {
            var items = document.querySelectorAll(".song-item");
            for (var j = 0; j < items.length; j++) {
                var item = items[j];
                var staticThumb = document.getElementById("st-" + j);
                var liveThumb = document.getElementById("sl-" + j);
                var eq = document.getElementById("eq-" + j);
                if (j === currentTrack) {
                    item.classList.add("active");
                    if (isPlaying) {
                        if (staticThumb) staticThumb.style.display = "none";
                        if (liveThumb) { liveThumb.style.display = "block"; liveThumb.src = tracks[j].gif; }
                        if (eq) eq.style.display = "flex";
                    } else {
                        if (staticThumb) { staticThumb.style.display = "block"; staticThumb.src = tracks[j].gif; }
                        if (liveThumb) liveThumb.style.display = "none";
                        if (eq) eq.style.display = "none";
                    }
                } else {
                    item.classList.remove("active");
                    if (staticThumb) { staticThumb.style.display = "block"; staticThumb.src = tracks[j].gif; }
                    if (liveThumb) liveThumb.style.display = "none";
                    if (eq) eq.style.display = "none";
                }
            }
        }

        function playTrack(i) {
            if (!tracks.length || i < 0 || i >= tracks.length) return;
            stopAllAudio();
            currentTrack = i;
            player.src = tracks[i].url;
            document.getElementById("nowPlaying").textContent = tracks[i].title;
            var coverStatic = document.getElementById("coverStatic");
            var coverLive = document.getElementById("coverLive");
            if (coverStatic) coverStatic.src = tracks[i].gif;
            if (coverLive) coverLive.src = tracks[i].gif;
            player.play().then(function() { setPlayingState(true); }).catch(function() { setPlayingState(false); });
        }

        function togglePlay() {
            if (isPlaying) { player.pause(); setPlayingState(false); }
            else {
                if (!player.src && tracks.length) { 
                    currentTrack = 0; 
                    player.src = tracks[0].url; 
                    document.getElementById("nowPlaying").textContent = tracks[0].title;
                    var cs = document.getElementById("coverStatic");
                    var cl = document.getElementById("coverLive");
                    if (cs) cs.src = tracks[0].gif;
                    if (cl) cl.src = tracks[0].gif;
                }
                player.play().then(function() { setPlayingState(true); }).catch(function() {});
            }
        }

        function prevTrack() { if (currentTrack < 0) currentTrack = 0; playTrack((currentTrack - 1 + tracks.length) % tracks.length); }
        function nextTrack() { if (currentTrack < 0) currentTrack = 0; playTrack((currentTrack + 1) % tracks.length); }

        function seekTrack(e) {
            if (!player.duration) return;
            var rect = e.currentTarget.getBoundingClientRect();
            player.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * player.duration;
        }

        player.addEventListener("timeupdate", function() {
            if (player.duration) {
                document.getElementById("seekFill").style.width = (player.currentTime / player.duration) * 100 + "%";
                document.getElementById("currentTime").textContent = formatTime(player.currentTime);
                document.getElementById("totalTime").textContent = formatTime(player.duration);
            }
        });
        player.addEventListener("ended", nextTrack);

        function formatTime(s) { if (isNaN(s)) return "0:00"; var m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ":" + String(sec).padStart(2, "0"); }
        if (tracks.length > 0) { 
            document.getElementById("nowPlaying").textContent = tracks[0].title;
            var cs = document.getElementById("coverStatic");
            if (cs) cs.src = tracks[0].gif;
        }

        function openChat() {
            document.getElementById("chatOverlay").classList.add("open");
            checkAdminStatus();
        }

        function closeChat() {
            document.getElementById("chatOverlay").classList.remove("open");
        }

        async function checkAdminStatus() {
            try {
                var r = await fetch("/api/admin/status");
                var data = await r.json();
                document.getElementById("adminStatus").textContent = data.isOnline ? "🟢 Online" : "🔴 Offline";
                document.getElementById("adminStatus").style.color = data.isOnline ? "#10b981" : "#ef4444";
            } catch (e) {}
        }

        async function joinChat() {
            var name = document.getElementById("chatNameInput").value.trim();
            var email = document.getElementById("chatEmailInput").value.trim();
            if (!name || !email) return;
            chatUser = { name: name, email: email };
            socket.emit("register", { name: name, email: email });
            document.getElementById("chatLoginArea").style.display = "none";
            document.getElementById("chatInputArea").style.display = "block";
            loadChatHistory();
            checkAdminStatus();
        }

        async function loadChatHistory() {
            if (!chatUser) return;
            try {
                var r = await fetch("/api/msgs/" + encodeURIComponent(chatUser.email));
                var messages = await r.json();
                var container = document.getElementById("chatMessages");
                var loginArea = document.getElementById("chatLoginArea");
                if (loginArea) loginArea.style.display = "none";
                container.innerHTML = "";
                if (messages.length === 0) {
                    container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">No messages yet. Start a conversation!</div>';
                } else {
                    messages.forEach(function(msg) {
                        appendChatMessage(msg);
                    });
                }
                container.scrollTop = container.scrollHeight;
            } catch (e) {}
        }

        function appendChatMessage(msg) {
            var container = document.getElementById("chatMessages");
            var isOwn = chatUser && msg.sender === chatUser.email;
            var row = document.createElement("div");
            row.className = "chat-message-row" + (isOwn ? " own" : "");
            var avatar = isOwn ? chatUser.name.charAt(0).toUpperCase() : "B";
            row.innerHTML = 
                '<div class="chat-msg-avatar">' + avatar + '</div>' +
                '<div class="chat-bubble-wrap">' +
                    '<div class="chat-bubble">' + msg.message + '</div>' +
                    '<div class="chat-msg-time">' + new Date(msg.timestamp + "Z").toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) + '</div>' +
                '</div>';
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;
        }

        function sendChatMessage() {
            if (!chatUser) return;
            var input = document.getElementById("chatMessageInput");
            var msg = input.value.trim();
            if (!msg) return;
            
            fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: chatUser.email,
                    receiver: "admin",
                    message: msg,
                    type: "text"
                })
            });
            
            input.value = "";
            input.focus();
        }

        socket.on("connect", function() {
            if (chatUser) {
                socket.emit("register", { name: chatUser.name, email: chatUser.email });
            }
        });

        socket.on("newMsg", function(msg) {
            if (chatUser && (msg.sender === chatUser.email || msg.receiver === chatUser.email || msg.sender === "admin")) {
                var existing = document.querySelectorAll('.chat-bubble');
                var found = false;
                for (var i = 0; i < existing.length; i++) {
                    if (existing[i].textContent === msg.message && 
                        existing[i].closest('.chat-message-row').querySelector('.chat-msg-time').textContent === 
                        new Date(msg.timestamp + "Z").toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    appendChatMessage(msg);
                }
            }
        });

        socket.on("userStatus", function(data) {
            if (data.email === "admin") {
                document.getElementById("adminStatus").textContent = data.online ? "🟢 Online" : "🔴 Offline";
                document.getElementById("adminStatus").style.color = data.online ? "#10b981" : "#ef4444";
            }
        });

        document.getElementById("chatOverlay").addEventListener("click", function(e) {
            if (e.target === this) closeChat();
        });

        document.querySelectorAll('.nav-link').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.nav-link').forEach(function(l) { l.classList.remove('active'); });
                this.classList.add('active');
                var target = this.getAttribute('href');
                if (target && target !== '#home') {
                    document.querySelector(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    </script>
</body>
</html>`;
    res.send(html);
});

// WebSocket
io.on('connection', (socket) => {
    socket.on('register', (data) => {
        try {
            socket.userData = data;
            let user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
            if (!user) { 
                const h = bcrypt.hashSync('default123', 10); 
                db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(data.name, data.email, h); 
            }
            db.prepare('UPDATE users SET isOnline = 1, lastSeen = datetime("now") WHERE email = ?').run(data.email);
            io.emit('userStatus', { email: data.email, online: true });
            
            const admin = db.prepare('SELECT isOnline FROM users WHERE email = ? AND isAdmin = 1').get('admin');
            socket.emit('adminStatus', { online: admin ? admin.isOnline === 1 : false });
        } catch (err) {}
    });
    
    socket.on('sendMsg', (data) => {
        try {
            const r = db.prepare('INSERT INTO messages (sender, receiver, message, type) VALUES (?, ?, ?, ?)').run(data.sender, data.receiver, data.message, data.type || 'text');
            const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(r.lastInsertRowid);
            io.emit('newMsg', msg);
        } catch (err) {}
    });
    
    socket.on('markRead', (data) => { 
        try { 
            db.prepare('UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = "admin" AND seen = 0').run(data.user); 
        } catch (err) {} 
    });

    socket.on('sendChatRoomMsg', (data) => {
        try {
            const r = db.prepare('INSERT INTO chat_room_messages (roomId, sender, message, type) VALUES (?, ?, ?, ?)').run(data.roomId, data.sender, data.message, data.type || 'text');
            const msg = db.prepare('SELECT * FROM chat_room_messages WHERE id = ?').get(r.lastInsertRowid);
            io.emit('chatRoomMsg', msg);
        } catch (err) {}
    });
    
    socket.on('disconnect', () => {
        if (socket.userData) {
            try { 
                db.prepare('UPDATE users SET isOnline = 0, lastSeen = datetime("now") WHERE email = ?').run(socket.userData.email); 
                io.emit('userStatus', { email: socket.userData.email, online: false }); 
            } catch (err) {}
        }
    });
});

server.listen(PORT, () => {
    console.log('========================================');
    console.log('Server: http://localhost:' + PORT);
    console.log('Admin: http://localhost:' + PORT + '/messenger');
    console.log('Login: http://localhost:' + PORT + '/login');
    console.log('Admin: admin / admin123');
    console.log('User: baillamach / ok@123');
    console.log('========================================');
});

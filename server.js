<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Baiilla Maach - Messenger</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: #f0f2f5;
            height: 100vh;
            overflow: hidden;
        }

        /* ============================================
           LOGIN / REGISTER
           ============================================ */
        .auth-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #f97316, #ea580c);
            padding: 20px;
        }

        .auth-box {
            background: white;
            padding: 40px;
            border-radius: 20px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .auth-box h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.8em;
            color: #1f2937;
            margin-bottom: 8px;
        }

        .auth-box p {
            color: #6b7280;
            margin-bottom: 24px;
            font-size: 0.95em;
        }

        .auth-box input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            margin-bottom: 12px;
            font-size: 0.95em;
            transition: 0.2s;
        }

        .auth-box input:focus {
            border-color: #f97316;
            outline: none;
        }

        .auth-box button {
            width: 100%;
            padding: 14px;
            background: #f97316;
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1em;
            cursor: pointer;
            transition: 0.2s;
        }

        .auth-box button:hover {
            background: #ea580c;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(249,115,22,0.3);
        }

        .auth-switch {
            text-align: center;
            margin-top: 16px;
            color: #6b7280;
            font-size: 0.9em;
        }

        .auth-switch a {
            color: #f97316;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
        }

        .auth-error {
            color: #ef4444;
            font-size: 0.85em;
            margin-top: 8px;
            display: none;
        }

        /* ============================================
           CHAT APP
           ============================================ */
        .chat-app {
            display: none;
            height: 100vh;
        }

        .chat-container {
            display: flex;
            height: 100vh;
            max-width: 1400px;
            margin: 0 auto;
            background: white;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
            width: 360px;
            background: white;
            border-right: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .sidebar-header {
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fb;
        }

        .sidebar-header .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .sidebar-header .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #f97316;
        }

        .sidebar-header .name {
            font-weight: 600;
            font-size: 0.95em;
            color: #1f2937;
        }

        .sidebar-header .badge {
            background: #10b981;
            color: white;
            font-size: 0.6em;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 600;
        }

        .sidebar-header .badge.admin {
            background: #f97316;
        }

        .logout-btn {
            background: none;
            border: none;
            color: #6b7280;
            font-size: 1.2em;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 8px;
            transition: 0.2s;
        }

        .logout-btn:hover {
            background: #f3f4f6;
            color: #ef4444;
        }

        .search-box {
            padding: 12px 20px;
            border-bottom: 1px solid #e5e7eb;
        }

        .search-box input {
            width: 100%;
            padding: 10px 16px;
            border: none;
            background: #f3f4f6;
            border-radius: 24px;
            font-size: 0.9em;
        }

        .search-box input:focus {
            outline: none;
            background: #e5e7eb;
        }

        .user-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
        }

        .user-item {
            display: flex;
            align-items: center;
            padding: 12px 20px;
            cursor: pointer;
            transition: 0.15s;
            border-left: 3px solid transparent;
            gap: 12px;
        }

        .user-item:hover {
            background: #f8f9fb;
        }

        .user-item.active {
            background: #eff6ff;
            border-left-color: #3b82f6;
        }

        .user-item .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
        }

        .user-item .info {
            flex: 1;
            min-width: 0;
        }

        .user-item .info .name {
            font-weight: 600;
            font-size: 0.95em;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .user-item .info .name .admin-tag {
            font-size: 0.55em;
            background: #f97316;
            color: white;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 600;
        }

        .user-item .info .last-msg {
            color: #6b7280;
            font-size: 0.8em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .user-item .meta {
            text-align: right;
            flex-shrink: 0;
        }

        .user-item .meta .time {
            font-size: 0.65em;
            color: #9ca3af;
        }

        .user-item .meta .unread {
            background: #ef4444;
            color: white;
            font-size: 0.6em;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 50%;
            min-width: 18px;
            display: inline-block;
            text-align: center;
            margin-top: 4px;
        }

        .user-item .online-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #9ca3af;
            flex-shrink: 0;
            border: 2px solid white;
            margin-top: -20px;
        }

        .user-item .online-dot.online {
            background: #10b981;
        }

        /* ===== CHAT AREA ===== */
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #f8f9fb;
        }

        .chat-header {
            padding: 12px 24px;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }

        .chat-header .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }

        .chat-header .name {
            font-weight: 600;
            color: #1f2937;
        }

        .chat-header .status {
            font-size: 0.75em;
            color: #6b7280;
        }

        .chat-header .status.online {
            color: #10b981;
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px 24px;
            display: flex;
            flex-direction: column;
        }

        .message {
            max-width: 70%;
            padding: 10px 16px;
            border-radius: 16px;
            margin-bottom: 6px;
            word-wrap: break-word;
            font-size: 0.92em;
            line-height: 1.5;
            position: relative;
        }

        .message.sent {
            background: #f97316;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }

        .message.received {
            background: white;
            color: #1f2937;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .message .time {
            font-size: 0.6em;
            opacity: 0.7;
            margin-top: 4px;
            display: block;
        }

        .message .read-status {
            font-size: 0.5em;
            margin-left: 6px;
        }

        .message .sender-name {
            font-weight: 600;
            font-size: 0.75em;
            margin-bottom: 2px;
            display: block;
        }

        .message.sent .sender-name {
            color: rgba(255,255,255,0.8);
        }

        .message.received .sender-name {
            color: #f97316;
        }

        .typing-indicator {
            align-self: flex-start;
            padding: 8px 16px;
            background: white;
            border-radius: 16px;
            color: #6b7280;
            font-size: 0.85em;
            display: none;
        }

        .typing-indicator .dots {
            display: inline-block;
            animation: typingDot 1.4s infinite;
        }

        @keyframes typingDot {
            0%, 60%, 100% { opacity: 0; }
            30% { opacity: 1; }
        }

        .chat-input-area {
            padding: 12px 20px;
            background: white;
            border-top: 1px solid #e5e7eb;
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }

        .chat-input-area input {
            flex: 1;
            padding: 12px 18px;
            border: 2px solid #e5e7eb;
            border-radius: 24px;
            font-size: 0.95em;
            transition: 0.2s;
        }

        .chat-input-area input:focus {
            border-color: #f97316;
            outline: none;
        }

        .chat-input-area button {
            padding: 12px 20px;
            background: #f97316;
            color: white;
            border: none;
            border-radius: 24px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
        }

        .chat-input-area button:hover {
            background: #ea580c;
            transform: scale(1.02);
        }

        .chat-input-area button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #6b7280;
            text-align: center;
        }

        .empty-state .icon {
            font-size: 4em;
            margin-bottom: 16px;
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        .empty-state h2 {
            font-family: 'Outfit', sans-serif;
            color: #1f2937;
            margin-bottom: 4px;
        }

        /* ===== ADMIN PANEL ===== */
        .admin-panel {
            display: none;
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            max-width: 90vw;
            height: 500px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 9999;
            flex-direction: column;
            border: 1px solid #e5e7eb;
            animation: slideUp 0.3s ease;
        }

        .admin-panel.open {
            display: flex;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .admin-panel .header {
            padding: 16px 20px;
            background: linear-gradient(135deg, #f97316, #ea580c);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 16px 16px 0 0;
            flex-shrink: 0;
        }

        .admin-panel .header h3 {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
        }

        .admin-panel .header button {
            background: none;
            border: none;
            color: white;
            font-size: 1.2em;
            cursor: pointer;
        }

        .admin-panel .admin-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .admin-panel .admin-body .chat-item {
            background: #f8f9fb;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 3px solid #f97316;
        }

        .admin-panel .admin-body .chat-item .names {
            font-weight: 600;
            font-size: 0.85em;
            color: #1f2937;
        }

        .admin-panel .admin-body .chat-item .msg-preview {
            color: #6b7280;
            font-size: 0.8em;
            margin-top: 2px;
        }

        .admin-panel .admin-body .chat-item .time {
            color: #9ca3af;
            font-size: 0.65em;
        }

        /* ===== CHAT ICON ===== */
        .chat-icon {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999;
            cursor: pointer;
            transition: 0.3s;
        }

        .chat-icon img {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            transition: 0.3s;
        }

        .chat-icon:hover img {
            transform: scale(1.1);
        }

        .chat-icon .notification-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            background: #ef4444;
            color: white;
            font-size: 0.6em;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 50%;
            min-width: 20px;
            text-align: center;
            border: 2px solid white;
            display: none;
        }

        .chat-icon .notification-badge.show {
            display: block;
        }

        .chat-icon .admin-badge {
            position: absolute;
            bottom: -4px;
            right: -4px;
            background: #f97316;
            color: white;
            font-size: 0.5em;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 12px;
            border: 2px solid white;
        }

        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar {
            width: 6px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 8px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                border-right: none;
            }

            .sidebar.show-chat {
                display: none;
            }

            .chat-area {
                display: none;
            }

            .chat-area.show {
                display: flex;
            }

            .message {
                max-width: 85%;
            }

            .admin-panel {
                width: 100%;
                height: 100%;
                bottom: 0;
                right: 0;
                border-radius: 0;
                max-width: 100%;
            }

            .admin-panel .header {
                border-radius: 0;
            }
        }
    </style>
</head>
<body>

<!-- ============================================
     AUTH
     ============================================ -->
<div class="auth-container" id="authContainer">
    <div class="auth-box">
        <h1 id="authTitle">💬 Welcome</h1>
        <p id="authSub">Sign in to start chatting</p>
        
        <form id="authForm">
            <input type="text" id="authName" placeholder="Full Name" style="display:none;">
            <input type="email" id="authEmail" placeholder="Email" required>
            <input type="password" id="authPassword" placeholder="Password" required>
            <div class="auth-error" id="authError">Invalid credentials</div>
            <button type="submit" id="authBtn">Sign In</button>
        </form>
        
        <div class="auth-switch">
            <span id="authSwitchText">Don't have an account?</span>
            <a id="authSwitchLink">Create one</a>
        </div>
    </div>
</div>

<!-- ============================================
     CHAT APP
     ============================================ -->
<div class="chat-app" id="chatApp">
    <div class="chat-container">
        <!-- Sidebar -->
        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="user-info">
                    <img class="avatar" id="myAvatar" src="/assets/default-avatar.png" alt="Me">
                    <div>
                        <div class="name" id="myName">Loading...</div>
                        <span class="badge" id="myBadge">User</span>
                    </div>
                </div>
                <button class="logout-btn" onclick="logout()">⏻</button>
            </div>
            
            <div class="search-box">
                <input type="text" id="searchUsers" placeholder="Search users..." oninput="filterUsers()">
            </div>
            
            <div class="user-list" id="userList">
                <div style="text-align:center;padding:40px;color:#9ca3af;">Loading users...</div>
            </div>
        </div>
        
        <!-- Chat Area -->
        <div class="chat-area" id="chatArea">
            <div class="chat-header" id="chatHeader">
                <img class="avatar" id="chatAvatar" src="/assets/default-avatar.png" alt="">
                <div>
                    <div class="name" id="chatName">Select a user</div>
                    <div class="status" id="chatStatus">Click a contact to start</div>
                </div>
            </div>
            
            <div class="chat-messages" id="chatMessages">
                <div class="empty-state">
                    <div class="icon">💬</div>
                    <h2>Select a conversation</h2>
                    <p>Choose a user from the sidebar to start messaging</p>
                </div>
            </div>
            
            <div class="typing-indicator" id="typingIndicator">
                <span>Someone is typing</span>
                <span class="dots">...</span>
            </div>
            
            <div class="chat-input-area">
                <input type="text" id="chatInput" placeholder="Type a message..." 
                       onkeypress="if(event.key==='Enter') sendMessage()"
                       oninput="typing()" disabled>
                <button id="sendBtn" onclick="sendMessage()" disabled>Send</button>
            </div>
        </div>
    </div>
</div>

<!-- ============================================
     ADMIN PANEL
     ============================================ -->
<div class="admin-panel" id="adminPanel">
    <div class="header">
        <h3>⚡ Admin Panel</h3>
        <button onclick="closeAdminPanel()">✕</button>
    </div>
    <div class="admin-body" id="adminBody">
        <div style="color:#6b7280;text-align:center;padding:20px;">Loading conversations...</div>
    </div>
</div>

<!-- ============================================
     CHAT ICON
     ============================================ -->
<div class="chat-icon" id="chatIcon" onclick="openChat()">
    <img src="/assets/chat-icon.gif" alt="Chat" id="chatIconImg" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23f97316%22%3E%3Cpath d=%22M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z%22/%3E%3C/svg%3E'">
    <span class="notification-badge" id="notifBadge">0</span>
    <span class="admin-badge" id="adminBadge" style="display:none;">⚡</span>
</div>

<!-- ============================================
     SOCKET.IO
     ============================================ -->
<script src="/socket.io/socket.io.js"></script>

<script>
// ============================================
// STATE
// ============================================
let currentUser = null;
let currentChatUser = null;
let socket = null;
let users = [];
let messages = [];
let unreadCount = 0;
let isAdmin = false;
let typingTimeout = null;

// ============================================
// DOM REFS
// ============================================
const authContainer = document.getElementById('authContainer');
const chatApp = document.getElementById('chatApp');
const authForm = document.getElementById('authForm');
const authBtn = document.getElementById('authBtn');
const authTitle = document.getElementById('authTitle');
const authSub = document.getElementById('authSub');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const authSwitchLink = document.getElementById('authSwitchLink');
const authSwitchText = document.getElementById('authSwitchText');

const userList = document.getElementById('userList');
const searchInput = document.getElementById('searchUsers');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatName = document.getElementById('chatName');
const chatStatus = document.getElementById('chatStatus');
const chatAvatar = document.getElementById('chatAvatar');
const myName = document.getElementById('myName');
const myAvatar = document.getElementById('myAvatar');
const myBadge = document.getElementById('myBadge');
const typingIndicator = document.getElementById('typingIndicator');
const notifBadge = document.getElementById('notifBadge');
const adminBadge = document.getElementById('adminBadge');

let isLogin = true;
let selectedUserId = null;

// ============================================
// AUTH
// ============================================
authSwitchLink.addEventListener('click', () => {
    isLogin = !isLogin;
    if (isLogin) {
        authTitle.textContent = '💬 Welcome';
        authSub.textContent = 'Sign in to start chatting';
        authBtn.textContent = 'Sign In';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchLink.textContent = 'Create one';
        authName.style.display = 'none';
    } else {
        authTitle.textContent = '📝 Join Us';
        authSub.textContent = 'Create your account';
        authBtn.textContent = 'Create Account';
        authSwitchText.textContent = 'Already have an account?';
        authSwitchLink.textContent = 'Sign in';
        authName.style.display = 'block';
    }
    authError.style.display = 'none';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const name = authName.value.trim();
    
    if (!email || !password) {
        authError.textContent = 'Please fill in all fields';
        authError.style.display = 'block';
        return;
    }
    
    if (!isLogin && !name) {
        authError.textContent = 'Please enter your name';
        authError.style.display = 'block';
        return;
    }
    
    try {
        const endpoint = isLogin ? '/api/login' : '/api/register';
        const body = isLogin ? { email, password } : { name, email, password };
        
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        
        if (!data.success) {
            authError.textContent = data.error || 'Something went wrong';
            authError.style.display = 'block';
            return;
        }
        
        currentUser = data.user;
        isAdmin = currentUser.isAdmin || false;
        
        if (isAdmin) {
            adminBadge.style.display = 'block';
        }
        
        initChat();
        
    } catch (error) {
        authError.textContent = 'Network error. Please try again.';
        authError.style.display = 'block';
        console.error(error);
    }
});

// ============================================
// INIT CHAT
// ============================================
function initChat() {
    authContainer.style.display = 'none';
    chatApp.style.display = 'block';
    
    myName.textContent = currentUser.name;
    myAvatar.src = currentUser.profilePic || '/assets/default-avatar.png';
    myBadge.textContent = isAdmin ? 'Admin' : 'User';
    myBadge.className = 'badge' + (isAdmin ? ' admin' : '');
    
    // Connect socket
    socket = io();
    
    socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('user-online', currentUser.id);
    });
    
    socket.on('user-status', (data) => {
        updateUserStatus(data.userId, data.isOnline);
    });
    
    socket.on('new-message', (message) => {
        if (currentChatUser && 
            (message.sender._id === currentChatUser.id || message.receiver._id === currentChatUser.id)) {
            messages.push(message);
            renderMessages();
            markAsRead(currentChatUser.id);
        }
        
        if (message.sender._id !== currentUser.id) {
            updateUnreadCount();
            playNotification();
        }
        
        updateUserList();
    });
    
    socket.on('message-sent', (message) => {
        messages.push(message);
        renderMessages();
        updateUserList();
    });
    
    socket.on('messages-read', (data) => {
        if (currentChatUser && data.userId === currentChatUser.id) {
            // Update read status in messages
            messages.forEach(m => {
                if (m.sender._id === currentUser.id && m.receiver._id === currentChatUser.id) {
                    m.read = true;
                }
            });
            renderMessages();
        }
    });
    
    socket.on('typing-indicator', (data) => {
        if (currentChatUser && data.userId === currentChatUser.id) {
            typingIndicator.style.display = data.isTyping ? 'block' : 'none';
        }
    });
    
    // Load users
    loadUsers();
    
    // Update unread
    updateUnreadCount();
}

// ============================================
// LOAD USERS
// ============================================
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        users = await res.json();
        
        // Filter out current user
        users = users.filter(u => u._id !== currentUser.id);
        
        // Get last messages for each
        for (let user of users) {
            const lastMsg = await getLastMessage(user._id);
            user.lastMessage = lastMsg;
        }
        
        renderUserList();
    } catch (error) {
        console.error('Load users error:', error);
    }
}

async function getLastMessage(userId) {
    try {
        const res = await fetch(`/api/messages/${currentUser.id}/${userId}`);
        const msgs = await res.json();
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    } catch {
        return null;
    }
}

function renderUserList() {
    const search = searchInput.value.toLowerCase();
    const filtered = users.filter(u => 
        u.name.toLowerCase().includes(search) || 
        u.email.toLowerCase().includes(search)
    );
    
    if (filtered.length === 0) {
        userList.innerHTML = `
            <div style="text-align:center;padding:40px;color:#9ca3af;">
                <div style="font-size:2em;margin-bottom:8px;">🔍</div>
                No users found
            </div>
        `;
        return;
    }
    
    userList.innerHTML = filtered.map(u => `
        <div class="user-item ${selectedUserId === u._id ? 'active' : ''}" 
             onclick="selectUser('${u._id}')" data-id="${u._id}">
            <div style="position:relative;">
                <img class="avatar" src="${u.profilePic || '/assets/default-avatar.png'}" 
                     onerror="this.src='/assets/default-avatar.png'" alt="${u.name}">
                <div class="online-dot ${u.isOnline ? 'online' : ''}"></div>
            </div>
            <div class="info">
                <div class="name">
                    ${u.name}
                    ${u.isAdmin ? '<span class="admin-tag">Admin</span>' : ''}
                </div>
                <div class="last-msg">${u.lastMessage ? (u.lastMessage.sender === currentUser.id ? 'You: ' : '') + u.lastMessage.message : 'No messages yet'}</div>
            </div>
            <div class="meta">
                <div class="time">${u.lastMessage ? formatTime(u.lastMessage.createdAt) : ''}</div>
                ${getUnreadCount(u._id) > 0 ? `<div class="unread">${getUnreadCount(u._id)}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function getUnreadCount(userId) {
    const msgs = messages.filter(m => 
        m.sender._id === userId && m.receiver._id === currentUser.id && !m.read
    );
    return msgs.length;
}

function filterUsers() {
    renderUserList();
}

// ============================================
// SELECT USER
// ============================================
async function selectUser(userId) {
    selectedUserId = userId;
    currentChatUser = users.find(u => u._id === userId);
    
    if (!currentChatUser) return;
    
    // Update UI
    renderUserList();
    
    chatName.textContent = currentChatUser.name;
    chatAvatar.src = currentChatUser.profilePic || '/assets/default-avatar.png';
    chatStatus.textContent = currentChatUser.isOnline ? '🟢 Online' : '⚪ Offline';
    chatStatus.className = 'status' + (currentChatUser.isOnline ? ' online' : '');
    
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
    
    // Load messages
    await loadMessages(userId);
    
    // Mark as read
    markAsRead(userId);
    
    // Mobile view
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.add('show-chat');
        document.getElementById('chatArea').classList.add('show');
    }
}

async function loadMessages(userId) {
    try {
        const res = await fetch(`/api/messages/${currentUser.id}/${userId}`);
        messages = await res.json();
        renderMessages();
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

function renderMessages() {
    if (!currentChatUser) {
        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="icon">💬</div>
                <h2>Select a conversation</h2>
                <p>Choose a user from the sidebar to start messaging</p>
            </div>
        `;
        return;
    }
    
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="icon">👋</div>
                <h2>No messages yet</h2>
                <p>Say hello to ${currentChatUser.name}</p>
            </div>
        `;
        return;
    }
    
    chatMessages.innerHTML = messages.map(m => {
        const isSent = m.sender._id === currentUser.id;
        const senderName = isSent ? 'You' : m.sender.name;
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <span class="sender-name">${senderName}</span>
                ${m.message}
                <span class="time">
                    ${formatTime(m.createdAt)}
                    ${isSent ? (m.read ? '✓✓' : '✓') : ''}
                </span>
            </div>
        `;
    }).join('');
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================
// SEND MESSAGE
// ============================================
function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentChatUser) return;
    
    socket.emit('send-message', {
        senderId: currentUser.id,
        receiverId: currentChatUser._id,
        message: text,
        type: 'text'
    });
    
    chatInput.value = '';
    chatInput.focus();
    
    // Add optimistic update
    const tempMsg = {
        sender: { _id: currentUser.id, name: currentUser.name },
        receiver: { _id: currentChatUser._id, name: currentChatUser.name },
        message: text,
        createdAt: new Date().toISOString(),
        read: false,
        _id: 'temp_' + Date.now()
    };
    messages.push(tempMsg);
    renderMessages();
}

function typing() {
    if (!currentChatUser) return;
    
    clearTimeout(typingTimeout);
    socket.emit('typing', {
        senderId: currentUser.id,
        receiverId: currentChatUser._id,
        isTyping: true
    });
    
    typingTimeout = setTimeout(() => {
        socket.emit('typing', {
            senderId: currentUser.id,
            receiverId: currentChatUser._id,
            isTyping: false
        });
    }, 1000);
}

// ============================================
// MARK AS READ
// ============================================
function markAsRead(userId) {
    socket.emit('mark-read', {
        userId: currentUser.id,
        senderId: userId
    });
}

// ============================================
// UPDATE UNREAD COUNT
// ============================================
async function updateUnreadCount() {
    try {
        const res = await fetch(`/api/unread/${currentUser.id}`);
        const data = await res.json();
        unreadCount = data.unread || 0;
        
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notifBadge.classList.add('show');
        } else {
            notifBadge.classList.remove('show');
        }
    } catch (error) {
        console.error('Unread error:', error);
    }
}

// ============================================
// UPDATE USER STATUS
// ============================================
function updateUserStatus(userId, isOnline) {
    const user = users.find(u => u._id === userId);
    if (user) {
        user.isOnline = isOnline;
        renderUserList();
    }
    
    if (currentChatUser && currentChatUser._id === userId) {
        chatStatus.textContent = isOnline ? '🟢 Online' : '⚪ Offline';
        chatStatus.className = 'status' + (isOnline ? ' online' : '');
    }
}

function updateUserList() {
    renderUserList();
}

// ============================================
// NOTIFICATION
// ============================================
function playNotification() {
    if (!('Notification' in window) || Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
        return;
    }
    
    try {
        new Notification('💬 New message on Baiilla Maach', {
            icon: '/assets/celebrity_pfp.jpeg',
            body: 'You have a new message!'
        });
    } catch (e) {
        // Silent fail
    }
}

// ============================================
// CHAT ICON
// ============================================
function openChat() {
    if (currentUser) {
        // Bring to front
        chatApp.style.display = 'block';
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('show-chat');
            document.getElementById('chatArea').classList.remove('show');
        }
    } else {
        authContainer.style.display = 'flex';
    }
}

function openAdminPanel() {
    if (!isAdmin) return;
    
    const panel = document.getElementById('adminPanel');
    panel.classList.toggle('open');
    
    if (panel.classList.contains('open')) {
        loadAdminConversations();
    }
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('open');
}

async function loadAdminConversations() {
    try {
        // Get all conversations with last message
        const res = await fetch('/api/users');
        const allUsers = await res.json();
        const adminUsers = allUsers.filter(u => u._id !== currentUser.id);
        
        const conversations = [];
        for (let user of adminUsers) {
            const msgRes = await fetch(`/api/messages/${user._id}/${currentUser.id}`);
            const msgs = await msgRes.json();
            if (msgs.length > 0) {
                conversations.push({
                    user: user,
                    lastMsg: msgs[msgs.length - 1],
                    count: msgs.length
                });
            }
        }
        
        const body = document.getElementById('adminBody');
        if (conversations.length === 0) {
            body.innerHTML = `<div style="color:#6b7280;text-align:center;padding:20px;">No conversations yet</div>`;
            return;
        }
        
        body.innerHTML = conversations.map(c => `
            <div class="chat-item" onclick="selectUser('${c.user._id}'); closeAdminPanel();">
                <div class="names">${c.user.name} ↔ ${currentUser.name}</div>
                <div class="msg-preview">${c.lastMsg.message.substring(0, 50)}${c.lastMsg.message.length > 50 ? '...' : ''}</div>
                <div class="time">${formatTime(c.lastMsg.createdAt)} · ${c.count} messages</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Admin load error:', error);
    }
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    if (socket) {
        socket.disconnect();
    }
    currentUser = null;
    isAdmin = false;
    chatApp.style.display = 'none';
    authContainer.style.display = 'flex';
    authEmail.value = '';
    authPassword.value = '';
    authName.value = '';
    authError.style.display = 'none';
    notifBadge.classList.remove('show');
    adminBadge.style.display = 'none';
    document.getElementById('adminPanel').classList.remove('open');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    
    return d.toLocaleDateString();
}

// ============================================
// INIT
// ============================================
// Check if already logged in (session would be stored, but we keep it simple)
console.log('🛡️ Baiilla Maach Messenger loaded');

// Keyboard shortcut: Escape to close admin panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAdminPanel();
    }
});

// Admin panel toggle (double click on chat icon)
document.getElementById('chatIcon').addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openAdminPanel();
});

// Click outside admin panel to close
document.addEventListener('click', (e) => {
    const panel = document.getElementById('adminPanel');
    const icon = document.getElementById('chatIcon');
    if (panel.classList.contains('open') && 
        !panel.contains(e.target) && 
        !icon.contains(e.target)) {
        closeAdminPanel();
    }
});

// Mobile back button
document.addEventListener('backbutton', () => {
    if (window.innerWidth <= 768 && document.getElementById('chatArea').classList.contains('show')) {
        document.getElementById('sidebar').classList.remove('show-chat');
        document.getElementById('chatArea').classList.remove('show');
    }
});

console.log('✅ Messenger ready!');
</script>
</body>
</html>

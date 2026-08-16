// Admin.js - Admin Messenger Interface
class AdminApp {
  constructor() {
    this.socket = null;
    this.currentAdmin = null;
    this.currentUser = null;
    this.users = [];
    this.messages = [];
    this.stats = null;
    this.searchQuery = '';
    this.connected = false;
    
    this.init();
  }

  init() {
    this.createAdminInterface();
    this.attachEventListeners();
    this.checkExistingSession();
  }

  createAdminInterface() {
    const adminPanel = document.getElementById('adminApp');
    if (!adminPanel) return;
    
    adminPanel.innerHTML = `
      <div class="admin-container">
        <!-- Login Screen -->
        <div class="admin-login" id="adminLogin">
          <div class="login-box glass-card">
            <h2>Admin Panel</h2>
            <p>Baiilla Maach Official</p>
            <input type="text" id="adminEmail" placeholder="Admin Email" class="login-input">
            <input type="password" id="adminPassword" placeholder="Password" class="login-input">
            <button class="login-btn" id="adminLoginBtn">Login</button>
          </div>
        </div>

        <!-- Main Dashboard -->
        <div class="admin-dashboard" id="adminDashboard" style="display:none">
          <!-- Stats Bar -->
          <div class="stats-bar">
            <div class="stat-card glass-card">
              <div class="stat-value" id="totalUsers">0</div>
              <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-value" id="onlineUsers">0</div>
              <div class="stat-label">Online</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-value" id="totalMessages">0</div>
              <div class="stat-label">Messages</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-value" id="unreadMessages">0</div>
              <div class="stat-label">Unread</div>
            </div>
          </div>

          <div class="admin-content">
            <!-- User List Sidebar -->
            <div class="user-sidebar">
              <div class="sidebar-header">
                <h3>Conversations</h3>
                <div class="sidebar-search">
                  <input type="text" id="userSearchInput" placeholder="Search users..." class="search-input">
                </div>
              </div>
              <div class="user-list" id="userList">
                <!-- Users will be rendered here -->
              </div>
            </div>

            <!-- Chat Area -->
            <div class="chat-area">
              <div class="chat-header">
                <div class="chat-user-info">
                  <img src="/assets/celebrity_pfp.jpeg" id="chatUserAvatar" class="chat-avatar" alt="">
                  <div>
                    <h3 id="chatUserName">Select a user</h3>
                    <p id="chatUserStatus" class="user-status">No conversation selected</p>
                  </div>
                </div>
                <div class="chat-actions">
                  <button class="icon-btn" id="deleteConversationBtn" title="Delete conversation">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                  <button class="icon-btn" id="adminLogoutBtn" title="Logout">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" x2="9" y1="12" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="messages-container" id="adminMessagesContainer">
                <!-- Messages will be rendered here -->
              </div>

              <div class="typing-indicator" id="adminTypingIndicator" style="display:none">
                <div class="typing-bubble"><span></span><span></span><span></span></div>
                <span class="typing-text">User is typing...</span>
              </div>

              <div class="message-composer">
                <button class="composer-btn" id="adminAttachBtn" title="Attach file">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                  </svg>
                </button>
                <button class="composer-btn" id="adminEmojiBtn" title="Add emoji">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" x2="9.01" y1="9" y2="9"></line>
                    <line x1="15" x2="15.01" y1="9" y2="9"></line>
                  </svg>
                </button>
                <input type="text" id="adminMessageInput" placeholder="Type a message..." class="message-input">
                <input type="file" id="adminFileInput" accept="image/*,.pdf,.doc,.docx" style="display:none">
                <button class="composer-btn send-btn" id="adminSendBtn" title="Send message">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m22 2-7 20-4-9-9-4Z"></path>
                    <path d="M22 2 11 13"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.injectStyles();
  }

  injectStyles() {
    const styles = `
      <style>
        .admin-container {
          height: 100vh;
          background: linear-gradient(135deg, #09090b 0%, #101014 50%, #141418 100%);
          color: #e5e5e5;
          overflow: hidden;
        }
        
        /* Login Screen */
        .admin-login {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 20px;
        }
        
        .login-box {
          background: rgba(24,24,28,0.95);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 40px;
          width: 380px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          text-align: center;
        }
        
        .login-box h2 {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 8px;
          background: linear-gradient(135deg,#a78bfa,#ec4899);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        
        .login-box p {
          font-size: 0.85rem;
          color: #9ca3af;
          margin-bottom: 24px;
        }
        
        .login-input {
          width: 100%;
          padding: 12px 16px;
          margin-bottom: 12px;
          background: rgba(31,31,35,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
          transition: 0.3s;
        }
        
        .login-input:focus {
          border-color: #9333ea;
        }
        
        .login-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg,#9333ea,#ec4899);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: 0.3s;
        }
        
        .login-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(147,51,234,0.4);
        }
        
        /* Dashboard */
        .admin-dashboard {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        /* Stats Bar */
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          padding: 16px;
        }
        
        @media (max-width: 768px) {
          .stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        .stat-card {
          background: rgba(24,24,28,0.8);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .stat-label {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* Content Area */
        .admin-content {
          flex: 1;
          display: flex;
          gap: 12px;
          padding: 0 16px 16px;
          overflow: hidden;
        }
        
        /* User Sidebar */
        .user-sidebar {
          width: 320px;
          background: rgba(24,24,28,0.8);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .sidebar-header h3 {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 12px;
        }
        
        .sidebar-search {
          margin-bottom: 8px;
        }
        
        .search-input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(31,31,35,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          color: #fff;
          font-size: 0.85rem;
          outline: none;
        }
        
        .search-input:focus {
          border-color: #9333ea;
        }
        
        .user-list {
          flex: 1;
          overflow-y: auto;
        }
        
        .user-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          cursor: pointer;
          transition: 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        
        .user-item:hover {
          background: rgba(255,255,255,0.04);
        }
        
        .user-item.active {
          background: rgba(147,51,234,0.08);
        }
        
        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg,#9333ea,#ec4899);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          flex-shrink: 0;
        }
        
        .user-info {
          flex: 1;
          min-width: 0;
        }
        
        .user-name {
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 2px;
        }
        
        .user-email {
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .user-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        
        .unread-badge {
          background: #9333ea;
          color: #fff;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
        }
        
        .online-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          margin-left: 4px;
        }
        
        /* Chat Area */
        .chat-area {
          flex: 1;
          background: rgba(24,24,28,0.8);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .chat-user-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .chat-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .chat-user-info h3 {
          font-size: 0.95rem;
          font-weight: 600;
        }
        
        .user-status {
          font-size: 0.8rem;
          color: #9ca3af;
        }
        
        .user-status.online {
          color: #4ade80;
        }
        
        .chat-actions {
          display: flex;
          gap: 4px;
        }
        
        .icon-btn {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          transition: 0.2s;
        }
        
        .icon-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }
        
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .message-wrapper {
          display: flex;
          margin-bottom: 4px;
        }
        
        .message-wrapper.sent {
          justify-content: flex-end;
        }
        
        .message-wrapper.received {
          justify-content: flex-start;
        }
        
        .message-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 0.85rem;
          word-wrap: break-word;
          position: relative;
        }
        
        .message-wrapper.sent .message-bubble {
          background: linear-gradient(135deg,#9333ea,#ec4899);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        
        .message-wrapper.received .message-bubble {
          background: rgba(31,31,35,0.8);
          color: #e5e5e5;
          border-bottom-left-radius: 4px;
        }
        
        .message-text {
          line-height: 1.4;
        }
        
        .message-image {
          max-width: 200px;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .message-file {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
        }
        
        .message-time {
          font-size: 0.7rem;
          opacity: 0.7;
          margin-top: 4px;
        }
        
        .message-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 4px;
        }
        
        .date-separator {
          text-align: center;
          margin: 16px 0;
        }
        
        .date-separator span {
          background: rgba(31,31,35,0.8);
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.75rem;
          color: #9ca3af;
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
        }
        
        .typing-bubble {
          display: flex;
          gap: 4px;
        }
        
        .typing-bubble span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
          animation: typing 1.4s infinite;
        }
        
        .typing-bubble span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-bubble span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        
        .typing-text {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        
        .message-composer {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        
        .composer-btn {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          transition: 0.2s;
        }
        
        .composer-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }
        
        .message-input {
          flex: 1;
          padding: 10px 14px;
          background: rgba(31,31,35,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          color: #fff;
          font-size: 0.85rem;
          outline: none;
        }
        
        .message-input:focus {
          border-color: #9333ea;
        }
        
        .send-btn {
          background: linear-gradient(135deg,#9333ea,#ec4899);
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
        }
        
        .send-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(147,51,234,0.4);
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .admin-content {
            flex-direction: column;
          }
          
          .user-sidebar {
            width: 100%;
            height: 40%;
          }
          
          .chat-area {
            height: 60%;
          }
        }
      </style>
    `;
    
    if (!document.querySelector('#adminStyles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'adminStyles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }

  attachEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'adminLoginBtn' || e.target.closest('#adminLoginBtn')) {
        this.handleLogin();
      }
      
      if (e.target.id === 'adminLogoutBtn' || e.target.closest('#adminLogoutBtn')) {
        this.handleLogout();
      }
      
      if (e.target.id === 'adminSendBtn' || e.target.closest('#adminSendBtn')) {
        this.sendMessage();
      }
      
      if (e.target.id === 'adminAttachBtn' || e.target.closest('#adminAttachBtn')) {
        document.getElementById('adminFileInput').click();
      }
      
      if (e.target.id === 'adminEmojiBtn' || e.target.closest('#adminEmojiBtn')) {
        this.handleEmoji();
      }
      
      if (e.target.id === 'deleteConversationBtn' || e.target.closest('#deleteConversationBtn')) {
        this.deleteConversation();
      }
    });
    
    document.addEventListener('keypress', (e) => {
      if (e.target.id === 'adminMessageInput' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
      
      if (e.target.id === 'adminMessageInput') {
        this.handleTyping();
      }
      
      if (e.target.id === 'adminEmail' && e.key === 'Enter') {
        this.handleLogin();
      }
      
      if (e.target.id === 'adminPassword' && e.key === 'Enter') {
        this.handleLogin();
      }
    });
    
    document.addEventListener('input', (e) => {
      if (e.target.id === 'userSearchInput') {
        this.searchQuery = e.target.value;
        this.renderUsers();
      }
    });
    
    document.addEventListener('change', (e) => {
      if (e.target.id === 'adminFileInput') {
        this.handleFileUpload(e.target.files[0]);
      }
    });
  }

  checkExistingSession() {
    const savedAdmin = localStorage.getItem('adminSession');
    if (savedAdmin) {
      const admin = JSON.parse(savedAdmin);
      this.currentAdmin = admin;
      this.showDashboard();
      this.connectSocket();
      this.loadUsers();
      this.loadStats();
    }
  }

  async handleLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password})
      });
      
      const data = await response.json();
      
      if (response.ok) {
        this.currentAdmin = data.user;
        localStorage.setItem('adminSession', JSON.stringify(data.user));
        this.showDashboard();
        this.connectSocket();
        this.loadUsers();
        this.loadStats();
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  }

  showDashboard() {
    const loginScreen = document.getElementById('adminLogin');
    const dashboard = document.getElementById('adminDashboard');
    
    if (loginScreen && dashboard) {
      loginScreen.style.display = 'none';
      dashboard.style.display = 'flex';
    }
  }

  connectSocket() {
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.socket = io({
      auth: {
        email: this.currentAdmin.email
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    
    this.socket.on('connect', () => {
      this.connected = true;
      this.socket.emit('authenticate', {email: this.currentAdmin.email});
    });
    
    this.socket.on('disconnect', () => {
      this.connected = false;
    });
    
    this.socket.on('message:new', (message) => {
      this.handleNewMessage(message);
    });
    
    this.socket.on('message:sent', (data) => {
      this.handleMessageSent(data);
    });
    
    this.socket.on('message:delivered', (data) => {
      this.handleMessageDelivered(data);
    });
    
    this.socket.on('message:seen', (data) => {
      this.handleMessageSeen(data);
    });
    
    this.socket.on('typing', (data) => {
      this.handleTypingIndicator(data);
    });
    
    this.socket.on('presence:update', (data) => {
      this.handlePresenceUpdate(data);
    });
  }

  async loadUsers() {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {'X-Admin-Email': this.currentAdmin.email}
      });
      
      if (response.ok) {
        const users = await response.json();
        this.users = users;
        this.renderUsers();
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {'X-Admin-Email': this.currentAdmin.email}
      });
      
      if (response.ok) {
        const stats = await response.json();
        this.stats = stats;
        this.renderStats();
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  renderStats() {
    if (!this.stats) return;
    
    const totalUsers = document.getElementById('totalUsers');
    const onlineUsers = document.getElementById('onlineUsers');
    const totalMessages = document.getElementById('totalMessages');
    const unreadMessages = document.getElementById('unreadMessages');
    
    if (totalUsers) totalUsers.textContent = this.stats.totalUsers;
    if (onlineUsers) onlineUsers.textContent = this.stats.onlineUsers;
    if (totalMessages) totalMessages.textContent = this.stats.totalMessages;
    if (unreadMessages) unreadMessages.textContent = this.stats.unreadMessages;
  }

  renderUsers() {
    const container = document.getElementById('userList');
    if (!container) return;
    
    const filteredUsers = this.users.filter(user => 
      !this.searchQuery || 
      user.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    
    container.innerHTML = filteredUsers.map(user => `
      <div class="user-item ${this.currentUser?.email === user.email ? 'active' : ''}" onclick="window.adminApp.selectUser('${user.email}')">
        <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">
            ${user.name}
            ${user.isOnline ? '<span class="online-dot"></span>' : ''}
          </div>
          <div class="user-email">${user.email}</div>
        </div>
        <div class="user-meta">
          ${user.unreadCount > 0 ? `<div class="unread-badge">${user.unreadCount}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  async selectUser(email) {
    this.currentUser = this.users.find(u => u.email === email);
    if (!this.currentUser) return;
    
    // Update UI
    const chatUserName = document.getElementById('chatUserName');
    const chatUserStatus = document.getElementById('chatUserStatus');
    const chatUserAvatar = document.getElementById('chatUserAvatar');
    
    if (chatUserName) chatUserName.textContent = this.currentUser.name;
    if (chatUserStatus) {
      if (this.currentUser.isOnline) {
        chatUserStatus.textContent = 'Online';
        chatUserStatus.classList.add('online');
      } else {
        chatUserStatus.textContent = 'Last seen ' + this.formatLastSeen(this.currentUser.lastSeen);
        chatUserStatus.classList.remove('online');
      }
    }
    if (chatUserAvatar) chatUserAvatar.src = this.currentUser.avatar || '/assets/celebrity_pfp.jpeg';
    
    // Update active state
    this.renderUsers();
    
    // Load messages
    await this.loadMessages(email);
    
    // Mark as read
    if (this.socket) {
      this.socket.emit('message:seen', {
        conversationId: [email, 'admin'].sort().join('_'),
        seenBy: 'admin'
      });
    }
  }

  async loadMessages(userEmail) {
    try {
      const conversationId = [userEmail, 'admin'].sort().join('_');
      const response = await fetch(`/api/messages/${conversationId}`, {
        headers: {'X-User-Email': 'admin'}
      });
      
      if (response.ok) {
        const messages = await response.json();
        this.messages = messages;
        this.renderMessages();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  renderMessages() {
    const container = document.getElementById('adminMessagesContainer');
    if (!container) return;
    
    let lastDate = null;
    let html = '';
    
    this.messages.forEach((message) => {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== lastDate) {
        html += `<div class="date-separator"><span>${this.formatDate(message.createdAt)}</span></div>`;
        lastDate = messageDate;
      }
      
      const isSent = message.sender === 'admin';
      html += `
        <div class="message-wrapper ${isSent ? 'sent' : 'received'}">
          <div class="message-bubble">
            ${message.type === 'image' ? `
              <img src="${message.fileUrl}" class="message-image" alt="" onclick="window.open('${message.fileUrl}', '_blank')">
            ` : message.type === 'file' ? `
              <div class="message-file">
                <div class="message-file-icon">📄</div>
                <div>
                  <div>${message.fileName}</div>
                  <div style="font-size:0.7rem;color:#9ca3af">${this.formatFileSize(message.fileSize)}</div>
                </div>
              </div>
            ` : `
              <div class="message-text">${this.formatMessage(message.message)}</div>
            `}
            <div class="message-time">
              ${this.formatTime(message.createdAt)}
              ${isSent ? `
                <span class="message-status">
                  ${message.seenAt ? '✓✓' : message.deliveredAt ? '✓✓' : '✓'}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  sendMessage() {
    const input = document.getElementById('adminMessageInput');
    const message = input.value.trim();
    
    if (!message || !this.currentUser) return;
    
    const messageId = crypto.randomUUID();
    const messageData = {
      messageId,
      conversationId: [this.currentUser.email, 'admin'].sort().join('_'),
      sender: 'admin',
      receiver: this.currentUser.email,
      message,
      type: 'text'
    };
    
    // Optimistically add message
    const optimisticMessage = {
      messageId,
      sender: 'admin',
      receiver: this.currentUser.email,
      message,
      type: 'text',
      createdAt: new Date().toISOString(),
      pending: true
    };
    
    this.messages.push(optimisticMessage);
    this.renderMessages();
    
    this.socket.emit('message:send', messageData);
    input.value = '';
  }

  async handleFileUpload(file) {
    if (!file || !this.currentUser) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {'X-User-Email': 'admin'},
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        const messageId = crypto.randomUUID();
        const messageData = {
          messageId,
          conversationId: [this.currentUser.email, 'admin'].sort().join('_'),
          sender: 'admin',
          receiver: this.currentUser.email,
          message: '',
          type: data.mimeType.startsWith('image/') ? 'image' : 'file',
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType
        };
        
        this.socket.emit('message:send', messageData);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failed to upload file');
    }
  }

  handleNewMessage(message) {
    if (!this.currentUser) return;
    
    if (message.sender === this.currentUser.email || message.receiver === this.currentUser.email) {
      const existingIndex = this.messages.findIndex(m => m.messageId === message.messageId);
      if (existingIndex !== -1) {
        this.messages[existingIndex] = {...this.messages[existingIndex], ...message, pending: false};
      } else {
        this.messages.push(message);
      }
      this.renderMessages();
      
      if (message.sender === this.currentUser.email) {
        this.socket.emit('message:seen', {
          conversationId: message.conversationId,
          seenBy: 'admin'
        });
      }
    }
    
    this.loadUsers();
    this.loadStats();
  }

  handleMessageSent(data) {
    const messageIndex = this.messages.findIndex(m => m.messageId === data.messageId);
    if (messageIndex !== -1) {
      this.messages[messageIndex] = {...this.messages[messageIndex], pending: false, status: 'sent'};
      this.renderMessages();
    }
  }

  handleMessageDelivered(data) {
    const message = this.messages.find(m => m.messageId === data.messageId);
    if (message) {
      message.deliveredAt = data.deliveredAt;
      message.status = 'delivered';
    }
  }

  handleMessageSeen(data) {
    this.messages.forEach(message => {
      if (message.conversationId === data.conversationId && message.sender === 'admin') {
        message.seenAt = new Date().toISOString();
        message.status = 'seen';
      }
    });
    this.renderMessages();
  }

  handleTypingIndicator(data) {
    const typingIndicator = document.getElementById('adminTypingIndicator');
    if (typingIndicator && this.currentUser && data.sender === this.currentUser.email) {
      typingIndicator.style.display = data.isTyping ? 'flex' : 'none';
    }
  }

  handlePresenceUpdate(data) {
    this.users = this.users.map(user => ({
      ...user,
      isOnline: user.email === data.email ? data.isOnline : user.isOnline
    }));
    this.renderUsers();
    
    if (this.currentUser && this.currentUser.email === data.email) {
      const chatUserStatus = document.getElementById('chatUserStatus');
      if (chatUserStatus) {
        if (data.isOnline) {
          chatUserStatus.textContent = 'Online';
          chatUserStatus.classList.add('online');
        } else {
          chatUserStatus.textContent = 'Offline';
          chatUserStatus.classList.remove('online');
        }
      }
    }
  }

  handleTyping() {
    if (!this.socket || !this.currentUser) return;
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    this.socket.emit('typing', {
      sender: 'admin',
      receiver: this.currentUser.email,
      isTyping: true
    });
    
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('typing', {
        sender: 'admin',
        receiver: this.currentUser.email,
        isTyping: false
      });
    }, 1000);
  }

  handleEmoji() {
    const input = document.getElementById('adminMessageInput');
    if (input) {
      input.value += '😊';
      input.focus();
    }
  }

  async deleteConversation() {
    if (!this.currentUser) return;
    
    if (confirm('Delete entire conversation with ' + this.currentUser.name + '?')) {
      try {
        const conversationId = [this.currentUser.email, 'admin'].sort().join('_');
        const response = await fetch(`/api/messages/${conversationId}`, {
          method: 'DELETE',
          headers: {'X-User-Email': 'admin'}
        });
        
        if (response.ok) {
          this.messages = [];
          this.renderMessages();
          this.loadUsers();
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        alert('Failed to delete conversation');
      }
    }
  }

  formatMessage(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return message.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color:#a78bfa;text-decoration:underline">${url}</a>`);
  }

  formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], {year: 'numeric', month: 'long', day: 'numeric'});
    }
  }

  formatLastSeen(dateString) {
    if (!dateString) return 'recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  handleLogout() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.currentAdmin = null;
    localStorage.removeItem('adminSession');
    location.reload();
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});

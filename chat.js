// Chat.js - User-side Messenger Interface
class MessengerApp {
  constructor() {
    this.socket = null;
    this.currentUser = null;
    this.currentConversation = null;
    this.conversations = [];
    this.messages = [];
    this.messagePage = 1;
    this.hasMoreMessages = false;
    this.isLoadingMessages = false;
    this.isTyping = false;
    this.typingTimeout = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    this.init();
  }

  init() {
    this.createWidget();
    this.attachEventListeners();
    this.checkExistingSession();
    
    // Listen for chat widget toggle
    const chatBtn = document.getElementById('chatWidgetBtn');
    if (chatBtn) {
      chatBtn.addEventListener('click', () => this.toggleWidget());
    }
    
    // Handle window resize for responsive
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.showConversationList();
      }
    });
  }

  createWidget() {
    const widget = document.getElementById('chatWidget');
    if (!widget) return;
    
    widget.innerHTML = `
      <div class="messenger-container" id="messengerContainer">
        <!-- Auth Screen -->
        <div class="messenger-auth" id="messengerAuth">
          <div class="auth-header">
            <div class="auth-avatar">
              <img src="/assets/celebrity_pfp.jpeg" alt="Baiilla Maach">
              <span class="online-indicator"></span>
            </div>
            <h2>Chat with Baiilla Maach</h2>
            <p>Official verified account</p>
          </div>
          
          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">Login</button>
            <button class="auth-tab" data-tab="register">Register</button>
          </div>
          
          <div class="auth-form" id="authForm">
            <div class="auth-fields">
              <input type="text" id="authName" placeholder="Your Name" class="auth-input">
              <input type="email" id="authEmail" placeholder="Email or Phone" class="auth-input">
              <input type="password" id="authPassword" placeholder="Password" class="auth-input">
            </div>
            <button class="auth-submit" id="authSubmit">Continue</button>
          </div>
        </div>

        <!-- Main Chat Interface -->
        <div class="messenger-main" id="messengerMain" style="display:none">
          <!-- Connection Status -->
          <div class="connection-status" id="connectionStatus">
            <span class="status-dot"></span>
            <span class="status-text">Connecting...</span>
          </div>
          
          <!-- Conversation List -->
          <div class="conversation-list" id="conversationList">
            <div class="chat-header">
              <div class="chat-header-user">
                <img src="/assets/celebrity_pfp.jpeg" alt="" class="chat-header-avatar">
                <div>
                  <h3>Messages</h3>
                  <p class="chat-header-status">Connected</p>
                </div>
              </div>
              <div class="chat-header-actions">
                <button class="icon-btn" id="searchBtn" aria-label="Search conversations">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
                  </svg>
                </button>
                <button class="icon-btn" id="logoutBtn" aria-label="Logout">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" x2="9" y1="12" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="conversation-search" id="conversationSearch" style="display:none">
              <input type="text" placeholder="Search conversations..." id="searchInput">
            </div>
            
            <div class="conversation-items" id="conversationItems">
              <!-- Conversations will be rendered here -->
            </div>
          </div>

          <!-- Chat Screen -->
          <div class="chat-screen" id="chatScreen" style="display:none">
            <div class="chat-header">
              <button class="icon-btn back-btn" id="backToConversations" aria-label="Back">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <div class="chat-header-user">
                <img src="/assets/celebrity_pfp.jpeg" alt="" class="chat-header-avatar">
                <div>
                  <h3 id="chatHeaderName">Baiilla Maach</h3>
                  <p class="chat-header-status" id="chatHeaderStatus">Online</p>
                </div>
              </div>
              <div class="chat-header-actions">
                <button class="icon-btn" id="conversationInfoBtn" aria-label="Conversation info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 5V3"></path><path d="M12 21v-2"></path>
                    <path d="M5 12H3"></path><path d="M21 12h-2"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="messages-container" id="messagesContainer">
              <!-- Messages will be rendered here -->
              <div class="messages-loading" id="messagesLoading" style="display:none">
                <div class="loading-spinner"></div>
              </div>
            </div>
            
            <div class="typing-indicator" id="typingIndicator" style="display:none">
              <div class="typing-bubble">
                <span></span><span></span><span></span>
              </div>
              <span class="typing-text">Baiilla Maach is typing...</span>
            </div>
            
            <div class="message-composer">
              <button class="composer-btn" id="attachBtn" aria-label="Attach file">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              <button class="composer-btn" id="emojiBtn" aria-label="Add emoji">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <line x1="9" x2="9.01" y1="9" y2="9"></line>
                  <line x1="15" x2="15.01" y1="9" y2="9"></line>
                </svg>
              </button>
              <input type="text" id="messageInput" placeholder="Type a message..." class="message-input">
              <input type="file" id="fileInput" accept="image/*,.pdf,.doc,.docx" style="display:none">
              <button class="composer-btn send-btn" id="sendBtn" aria-label="Send message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m22 2-7 20-4-9-9-4Z"></path>
                  <path d="M22 2 11 13"></path>
                </svg>
              </button>
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
        /* Chat Widget Styles */
        .messenger-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(15,15,18,0.98);
          color: #e5e5e5;
        }
        
        /* Auth Screen */
        .messenger-auth {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 20px;
        }
        
        .auth-header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .auth-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          margin: 0 auto 12px;
          position: relative;
          border: 2px solid #9333ea;
        }
        
        .auth-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .online-indicator {
          position: absolute;
          bottom: 4px;
          right: 4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          border: 2px solid #09090b;
        }
        
        .auth-header h2 {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .auth-header p {
          font-size: 0.8rem;
          color: #9ca3af;
        }
        
        .auth-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          width: 100%;
        }
        
        .auth-tab {
          flex: 1;
          padding: 8px;
          background: rgba(31,31,35,0.5);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #9ca3af;
          cursor: pointer;
          transition: 0.2s;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .auth-tab.active {
          background: rgba(147,51,234,0.15);
          border-color: #9333ea;
          color: #a78bfa;
        }
        
        .auth-form {
          width: 100%;
        }
        
        .auth-fields {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .auth-input {
          padding: 10px 12px;
          background: rgba(31,31,35,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #fff;
          font-size: 0.85rem;
          outline: none;
          transition: 0.2s;
        }
        
        .auth-input:focus {
          border-color: #9333ea;
        }
        
        .auth-submit {
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg,#9333ea,#ec4899);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: 0.2s;
        }
        
        .auth-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(147,51,234,0.4);
        }
        
        /* Connection Status */
        .connection-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px;
          background: rgba(239,68,68,0.1);
          font-size: 0.75rem;
          color: #f87171;
        }
        
        .connection-status.connected {
          background: rgba(34,197,94,0.1);
          color: #4ade80;
        }
        
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Main Chat Interface */
        .messenger-main {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .chat-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(24,24,28,0.9);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .chat-header-user {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .chat-header-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .chat-header h3 {
          font-size: 0.9rem;
          font-weight: 600;
        }
        
        .chat-header-status {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        
        .chat-header-status.online {
          color: #4ade80;
        }
        
        .chat-header-actions {
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
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .icon-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }
        
        .back-btn {
          display: none;
        }
        
        /* Conversation List */
        .conversation-list {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .conversation-search {
          padding: 8px 12px;
          background: rgba(24,24,28,0.9);
        }
        
        .conversation-search input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(31,31,35,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          color: #fff;
          font-size: 0.8rem;
          outline: none;
        }
        
        .conversation-items {
          flex: 1;
          overflow-y: auto;
        }
        
        .conversation-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        
        .conversation-item:hover {
          background: rgba(255,255,255,0.04);
        }
        
        .conversation-item.active {
          background: rgba(147,51,234,0.08);
        }
        
        .conversation-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          position: relative;
        }
        
        .conversation-info {
          flex: 1;
          min-width: 0;
        }
        
        .conversation-name {
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 2px;
        }
        
        .conversation-last-message {
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .conversation-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        
        .conversation-time {
          font-size: 0.7rem;
          color: #6b7280;
        }
        
        .unread-badge {
          background: #9333ea;
          color: #fff;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
        }
        
        /* Chat Screen */
        .chat-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .messages-loading {
          text-align: center;
          padding: 8px;
        }
        
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: #9333ea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
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
          max-width: 80%;
          padding: 8px 12px;
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
        
        .message-file-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
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
          padding: 8px 12px;
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
          padding: 8px 12px;
          background: rgba(24,24,28,0.9);
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
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .composer-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }
        
        .message-input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(31,31,35,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
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
          width: 32px;
          height: 32px;
          border-radius: 50%;
        }
        
        .send-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(147,51,234,0.4);
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .back-btn {
            display: flex;
          }
          
          .conversation-list.hidden-mobile {
            display: none;
          }
          
          .chat-screen.show-mobile {
            display: flex;
          }
        }
      </style>
    `;
    
    if (!document.querySelector('#messengerStyles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'messengerStyles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }

  attachEventListeners() {
    // Auth tabs
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('auth-tab')) {
        const tab = e.target.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const nameField = document.getElementById('authName');
        const emailField = document.getElementById('authEmail');
        
        if (tab === 'login') {
          nameField.style.display = 'none';
          emailField.placeholder = 'Email or Phone';
        } else {
          nameField.style.display = 'block';
          emailField.placeholder = 'Email or Phone';
        }
      }
      
      if (e.target.id === 'authSubmit') {
        this.handleAuth();
      }
      
      if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
        this.handleLogout();
      }
      
      if (e.target.id === 'searchBtn' || e.target.closest('#searchBtn')) {
        this.toggleSearch();
      }
      
      if (e.target.id === 'backToConversations' || e.target.closest('#backToConversations')) {
        this.showConversationList();
      }
      
      if (e.target.id === 'sendBtn' || e.target.closest('#sendBtn')) {
        this.sendMessage();
      }
      
      if (e.target.id === 'attachBtn' || e.target.closest('#attachBtn')) {
        document.getElementById('fileInput').click();
      }
      
      if (e.target.id === 'emojiBtn' || e.target.closest('#emojiBtn')) {
        this.handleEmoji();
      }
    });
    
    // Enter key to send message
    document.addEventListener('keypress', (e) => {
      if (e.target.id === 'messageInput' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
      
      if (e.target.id === 'messageInput') {
        this.handleTyping();
      }
      
      if (e.target.id === 'authEmail' && e.key === 'Enter') {
        this.handleAuth();
      }
      
      if (e.target.id === 'authPassword' && e.key === 'Enter') {
        this.handleAuth();
      }
    });
    
    // Search input
    document.addEventListener('input', (e) => {
      if (e.target.id === 'searchInput') {
        this.filterConversations(e.target.value);
      }
    });
    
    // File upload
    document.addEventListener('change', (e) => {
      if (e.target.id === 'fileInput') {
        this.handleFileUpload(e.target.files[0]);
      }
    });
    
    // Message scrolling
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop < 50 && this.hasMoreMessages && !this.isLoadingMessages) {
          this.loadMoreMessages();
        }
      });
    }
  }

  checkExistingSession() {
    const savedUser = localStorage.getItem('messengerUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.currentUser = user;
      this.connectSocket();
      this.showMainInterface();
      this.loadConversations();
    }
  }

  async handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const isLogin = document.querySelector('.auth-tab.active').dataset.tab === 'login';
    
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }
    
    if (!isLogin && !name) {
      this.showError('Please enter your name');
      return;
    }
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? {email, password} : {name, email, password};
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        this.currentUser = data.user;
        localStorage.setItem('messengerUser', JSON.stringify(data.user));
        this.connectSocket();
        this.showMainInterface();
        this.loadConversations();
        this.loadMessageHistory();
      } else {
        this.showError(data.error || 'Authentication failed');
      }
    } catch (error) {
      this.showError('Network error. Please try again.');
    }
  }

  showError(message) {
    alert(message);
  }

  connectSocket() {
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.socket = io({
      auth: {
        email: this.currentUser.email
      },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
      this.socket.emit('authenticate', {email: this.currentUser.email});
    });
    
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.updateConnectionStatus(false);
    });
    
    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.updateConnectionStatus(false, 'Reconnecting...');
    });
    
    this.socket.on('authenticated', (data) => {
      if (data.success) {
        this.socket.emit('presence:update', {email: this.currentUser.email, isOnline: true});
      }
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

  updateConnectionStatus(connected, message) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = statusElement?.querySelector('.status-text');
    
    if (statusElement && statusText) {
      if (connected) {
        statusElement.classList.add('connected');
        statusText.textContent = 'Connected';
      } else {
        statusElement.classList.remove('connected');
        statusText.textContent = message || 'Disconnected';
      }
    }
  }

  showMainInterface() {
    const authScreen = document.getElementById('messengerAuth');
    const mainScreen = document.getElementById('messengerMain');
    
    if (authScreen && mainScreen) {
      authScreen.style.display = 'none';
      mainScreen.style.display = 'flex';
    }
  }

  showConversationList() {
    const conversationList = document.getElementById('conversationList');
    const chatScreen = document.getElementById('chatScreen');
    
    if (conversationList && chatScreen) {
      conversationList.classList.remove('hidden-mobile');
      chatScreen.classList.remove('show-mobile');
      chatScreen.style.display = 'none';
      conversationList.style.display = 'flex';
    }
  }

  async loadConversations() {
    if (!this.currentUser) return;
    
    try {
      const response = await fetch('/api/conversations', {
        headers: {'X-User-Email': this.currentUser.email}
      });
      
      if (response.ok) {
        const conversations = await response.json();
        this.conversations = conversations;
        this.renderConversations();
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  renderConversations() {
    const container = document.getElementById('conversationItems');
    if (!container) return;
    
    if (this.conversations.length === 0) {
      container.innerHTML = `
        <div class="conversation-item" onclick="window.messenger.startNewConversation()">
          <img src="/assets/celebrity_pfp.jpeg" class="conversation-avatar" alt="">
          <div class="conversation-info">
            <div class="conversation-name">Baiilla Maach</div>
            <div class="conversation-last-message">Start a conversation</div>
          </div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.conversations.map(conv => `
      <div class="conversation-item ${this.currentConversation?.id === conv.id ? 'active' : ''}" onclick="window.messenger.openConversation('${conv.id}')">
        <img src="${conv.otherUser.avatar || '/assets/celebrity_pfp.jpeg'}" class="conversation-avatar" alt="">
        <div class="conversation-info">
          <div class="conversation-name">${conv.otherUser.name}</div>
          <div class="conversation-last-message">${conv.lastMessage?.message || 'Start a conversation'}</div>
        </div>
        <div class="conversation-meta">
          <div class="conversation-time">${this.formatTime(conv.lastMessageAt)}</div>
          ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  openConversation(conversationId) {
    this.currentConversation = this.conversations.find(c => c.id === conversationId);
    if (!this.currentConversation) return;
    
    const conversationList = document.getElementById('conversationList');
    const chatScreen = document.getElementById('chatScreen');
    
    if (conversationList && chatScreen) {
      conversationList.style.display = 'none';
      chatScreen.style.display = 'flex';
      chatScreen.classList.add('show-mobile');
    }
    
    // Update chat header
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderStatus = document.getElementById('chatHeaderStatus');
    
    if (chatHeaderName && chatHeaderStatus) {
      chatHeaderName.textContent = this.currentConversation.otherUser.name;
      if (this.currentConversation.otherUser.isOnline) {
        chatHeaderStatus.textContent = 'Online';
        chatHeaderStatus.classList.add('online');
      } else {
        chatHeaderStatus.textContent = 'Last seen ' + this.formatLastSeen(this.currentConversation.otherUser.lastSeen);
        chatHeaderStatus.classList.remove('online');
      }
    }
    
    this.loadMessages(conversationId);
  }

  startNewConversation() {
    const adminEmail = 'admin';
    this.currentConversation = {
      id: 'admin',
      otherUser: {
        name: 'Baiilla Maach',
        email: adminEmail,
        avatar: '/assets/celebrity_pfp.jpeg',
        isOnline: true
      }
    };
    
    this.openConversation('admin');
  }

  async loadMessages(conversationId) {
    try {
      const response = await fetch(`/api/messages/${conversationId}`, {
        headers: {'X-User-Email': this.currentUser.email}
      });
      
      if (response.ok) {
        const messages = await response.json();
        this.messages = messages;
        this.hasMoreMessages = messages.length >= 20;
        this.messagePage = 1;
        this.renderMessages();
        this.markConversationAsRead();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  async loadMoreMessages() {
    if (!this.currentConversation || this.isLoadingMessages) return;
    
    this.isLoadingMessages = true;
    const loadingElement = document.getElementById('messagesLoading');
    if (loadingElement) loadingElement.style.display = 'block';
    
    try {
      const response = await fetch(`/api/messages/${this.currentConversation.id}?before=${this.messages[0]?.createdAt}&limit=20`, {
        headers: {'X-User-Email': this.currentUser.email}
      });
      
      if (response.ok) {
        const olderMessages = await response.json();
        if (olderMessages.length > 0) {
          this.messages = [...olderMessages, ...this.messages];
          this.hasMoreMessages = olderMessages.length >= 20;
          this.messagePage++;
          this.renderMessages(true);
        } else {
          this.hasMoreMessages = false;
        }
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      this.isLoadingMessages = false;
      if (loadingElement) loadingElement.style.display = 'none';
    }
  }

  renderMessages(preserveScroll = false) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    
    let lastDate = null;
    let html = '';
    
    this.messages.forEach((message, index) => {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== lastDate) {
        html += `<div class="date-separator"><span>${this.formatDate(message.createdAt)}</span></div>`;
        lastDate = messageDate;
      }
      
      const isSent = message.sender === this.currentUser.email;
      html += `
        <div class="message-wrapper ${isSent ? 'sent' : 'received'}">
          <div class="message-bubble">
            ${message.type === 'image' ? `
              <img src="${message.fileUrl}" class="message-image" alt="" onclick="window.messenger.previewImage('${message.fileUrl}')">
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
    
    if (preserveScroll) {
      container.scrollTop = container.scrollHeight - scrollHeight + scrollTop;
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }

  sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !this.currentConversation) return;
    
    const messageId = crypto.randomUUID();
    const messageData = {
      messageId,
      conversationId: this.currentConversation.id,
      sender: this.currentUser.email,
      receiver: 'admin',
      message,
      type: 'text'
    };
    
    // Optimistically add message to UI
    const optimisticMessage = {
      messageId,
      sender: this.currentUser.email,
      receiver: 'admin',
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
    if (!file || !this.currentConversation) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {'X-User-Email': this.currentUser.email},
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        const messageId = crypto.randomUUID();
        const messageData = {
          messageId,
          conversationId: this.currentConversation.id,
          sender: this.currentUser.email,
          receiver: 'admin',
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
      this.showError('Failed to upload file');
    }
  }

  handleNewMessage(message) {
    if (!this.currentUser) return;
    
    // Check if message is for current conversation
    if (this.currentConversation && 
        (message.conversationId === this.currentConversation.id || 
         message.conversationId === [this.currentUser.email, 'admin'].sort().join('_'))) {
      
      // Check for duplicate
      const existingIndex = this.messages.findIndex(m => m.messageId === message.messageId);
      if (existingIndex !== -1) {
        this.messages[existingIndex] = {...this.messages[existingIndex], ...message, pending: false};
        this.renderMessages();
      } else {
        this.messages.push(message);
        this.renderMessages();
      }
      
      // Mark as seen if received
      if (message.sender === 'admin') {
        this.socket.emit('message:seen', {conversationId: message.conversationId, seenBy: this.currentUser.email});
      }
    }
    
    // Update conversation list
    this.loadConversations();
    this.updateUnreadCount();
    
    // Send browser notification
    this.sendNotification(message);
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
      if (message.conversationId === data.conversationId && message.sender === data.seenBy) {
        message.seenAt = new Date().toISOString();
        message.status = 'seen';
      }
    });
    this.renderMessages();
  }

  handleTypingIndicator(data) {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator && data.sender === 'admin') {
      typingIndicator.style.display = data.isTyping ? 'flex' : 'none';
    }
  }

  handlePresenceUpdate(data) {
    if (data.email === 'admin' && this.currentConversation) {
      const chatHeaderStatus = document.getElementById('chatHeaderStatus');
      if (chatHeaderStatus) {
        if (data.isOnline) {
          chatHeaderStatus.textContent = 'Online';
          chatHeaderStatus.classList.add('online');
        } else {
          chatHeaderStatus.textContent = 'Offline';
          chatHeaderStatus.classList.remove('online');
        }
      }
    }
  }

  handleTyping() {
    if (!this.socket || !this.currentConversation) return;
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    this.socket.emit('typing', {
      sender: this.currentUser.email,
      receiver: 'admin',
      isTyping: true
    });
    
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('typing', {
        sender: this.currentUser.email,
        receiver: 'admin',
        isTyping: false
      });
    }, 1000);
  }

  markConversationAsRead() {
    if (this.socket && this.currentConversation) {
      this.socket.emit('conversation:read', {
        conversationId: this.currentConversation.id,
        reader: this.currentUser.email
      });
    }
  }

  toggleSearch() {
    const searchElement = document.getElementById('conversationSearch');
    if (searchElement) {
      searchElement.style.display = searchElement.style.display === 'none' ? 'block' : 'none';
      if (searchElement.style.display === 'block') {
        document.getElementById('searchInput').focus();
      }
    }
  }

  filterConversations(query) {
    const filtered = this.conversations.filter(conv => 
      conv.otherUser.name.toLowerCase().includes(query.toLowerCase())
    );
    this.renderConversations(filtered);
  }

  handleEmoji() {
    const input = document.getElementById('messageInput');
    if (input) {
      input.value += '😊';
      input.focus();
    }
  }

  previewImage(url) {
    window.open(url, '_blank');
  }

  formatMessage(message) {
    // Basic formatting for links
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

  toggleWidget() {
    const widget = document.getElementById('chatWidget');
    if (widget) {
      widget.classList.toggle('open');
    }
  }

  updateUnreadCount() {
    const unreadCount = this.conversations.reduce((total, conv) => total + conv.unreadCount, 0);
    const badge = document.getElementById('chatUnreadCount');
    
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  sendNotification(message) {
    if (Notification.permission === 'granted' && message.sender === 'admin') {
      const notification = new Notification('Baiilla Maach', {
        body: message.message || 'Sent you a message',
        icon: '/assets/celebrity_pfp.jpeg'
      });
      
      notification.onclick = () => {
        window.focus();
        this.toggleWidget();
        notification.close();
      };
    }
  }

  handleLogout() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.currentUser = null;
    localStorage.removeItem('messengerUser');
    location.reload();
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  window.messenger = new MessengerApp();
  
  // Request notification permission
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

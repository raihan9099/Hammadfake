// ============== Baiilla Maach Admin Chat Panel ==============
// Optimized Chat Module

const ChatAdmin = (() => {
  // State
  let currentUser = null;
  let socket = null;
  let allUsers = [];
  
  // DOM Elements cache
  const dom = {
    get loginOverlay() { return document.getElementById('loginOverlay'); },
    get app() { return document.getElementById('app'); },
    get loginEmail() { return document.getElementById('loginEmail'); },
    get loginPassword() { return document.getElementById('loginPassword'); },
    get loginBtn() { return document.getElementById('loginBtn'); },
    get loginError() { return document.getElementById('loginError'); },
    get userList() { return document.getElementById('userList'); },
    get searchInput() { return document.getElementById('searchInput'); },
    get chatMessages() { return document.getElementById('chatMessages'); },
    get chatInputArea() { return document.getElementById('chatInputArea'); },
    get msgInput() { return document.getElementById('msgInput'); },
    get chatAvatar() { return document.getElementById('chatAvatar'); },
    get chatName() { return document.getElementById('chatName'); },
    get chatStatus() { return document.getElementById('chatStatus'); },
    get emptyChat() { return document.getElementById('emptyChat'); }
  };

  // API Calls
  const api = {
    async login(email, password) {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');
      return data;
    },
    
    async getUsers() {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    
    async getMessages(email) {
      const res = await fetch(`/api/msgs/${email}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    }
  };

  // UI Helpers
  const ui = {
    showError(msg) {
      if (dom.loginError) {
        dom.loginError.textContent = msg;
        dom.loginError.style.display = 'block';
        setTimeout(() => dom.loginError.style.display = 'none', 4000);
      } else {
        alert(msg);
      }
    },
    
    setLoading(btn, loading) {
      btn.disabled = loading;
      btn.innerHTML = loading ? 
        '<span class="spinner"></span> Signing in...' : 
        'Sign In';
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    },
    
    formatDate(timestamp) {
      const d = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : '' 
      });
    },
    
    scrollToBottom(el) {
      setTimeout(() => el.scrollTop = el.scrollHeight, 100);
    }
  };

  // Render Functions
  const render = {
    users(filter = '') {
      const f = filter.toLowerCase();
      const filtered = f ? 
        allUsers.filter(u => 
          u.name.toLowerCase().includes(f) || 
          u.email.toLowerCase().includes(f)
        ) : allUsers;
      
      if (filtered.length === 0) {
        dom.userList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>No users found</p>
          </div>`;
        return;
      }
      
      dom.userList.innerHTML = filtered.map(u => `
        <div class="user-item ${currentUser === u.email ? 'active' : ''}" 
             onclick="ChatAdmin.selectUser('${u.email}')">
          <div class="user-avatar">
            ${u.name[0]?.toUpperCase() || '?'}
            ${u.isOnline ? '<div class="dot"></div>' : ''}
          </div>
          <div class="user-info">
            <div class="name">${u.name}</div>
            <div class="email">${u.email}</div>
            ${u.lastMessage ? `<div class="last-msg">${u.lastMessage}</div>` : ''}
          </div>
          ${u.unreadCount > 0 ? 
            `<div class="unread">${u.unreadCount > 99 ? '99+' : u.unreadCount}</div>` : ''}
          <div class="user-time">${u.lastSeen ? ui.formatDate(u.lastSeen) : ''}</div>
        </div>
      `).join('');
    },
    
    messages(msgs) {
      if (!msgs || msgs.length === 0) {
        dom.chatMessages.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">💬</div>
            <p>No messages yet</p>
            <span>Start the conversation</span>
          </div>`;
        return;
      }
      
      let html = '';
      let lastDate = '';
      
      msgs.forEach(m => {
        const msgDate = ui.formatDate(m.timestamp);
        if (msgDate !== lastDate) {
          html += `<div class="date-divider"><span>${msgDate}</span></div>`;
          lastDate = msgDate;
        }
        
        const isSent = m.sender === 'admin@baillamaach.com';
        html += `
          <div class="message ${isSent ? 'sent' : 'received'}">
            ${m.message}
            <div class="time">
              ${ui.formatTime(m.timestamp)}
              ${isSent && m.seen ? ' ✓✓' : isSent ? ' ✓' : ''}
            </div>
          </div>`;
      });
      
      dom.chatMessages.innerHTML = html;
      ui.scrollToBottom(dom.chatMessages);
    }
  };

  // Socket Setup
  function initSocket() {
    if (socket) socket.disconnect();
    
    socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });
    
    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('register', { 
        name: 'Admin', 
        email: 'admin@baillamaach.com' 
      });
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    socket.on('newMsg', (msg) => {
      // If currently viewing this user's chat, append message
      if (currentUser && (msg.sender === currentUser || msg.receiver === currentUser)) {
        appendMessage(msg);
      }
      // Refresh user list for unread counts
      loadUsers();
    });
    
    socket.on('userStatus', (data) => {
      const user = allUsers.find(u => u.email === data.email);
      if (user) {
        user.isOnline = data.online;
        if (!data.online) user.lastSeen = new Date().toISOString();
        render.users(dom.searchInput?.value || '');
      }
    });
  }

  function appendMessage(msg) {
    const existing = dom.chatMessages.querySelector('.empty-state');
    if (existing) dom.chatMessages.innerHTML = '';
    
    const isSent = msg.sender === 'admin@baillamaach.com';
    const msgEl = document.createElement('div');
    msgEl.className = `message ${isSent ? 'sent' : 'received'}`;
    msgEl.innerHTML = `
      ${msg.message}
      <div class="time">${ui.formatTime(msg.timestamp)}${isSent ? ' ✓' : ''}</div>
    `;
    
    dom.chatMessages.appendChild(msgEl);
    ui.scrollToBottom(dom.chatMessages);
  }

  // Public Methods
  return {
    async login() {
      const email = dom.loginEmail.value.trim();
      const password = dom.loginPassword.value.trim();
      
      if (!email || !password) {
        ui.showError('Please fill in all fields');
        return;
      }
      
      ui.setLoading(dom.loginBtn, true);
      
      try {
        await api.login(email, password);
        dom.loginOverlay.style.display = 'none';
        dom.app.style.display = 'block';
        initSocket();
        await this.loadUsers();
        dom.loginPassword.value = '';
      } catch (err) {
        ui.showError(err.message);
      } finally {
        ui.setLoading(dom.loginBtn, false);
      }
    },
    
    async loadUsers() {
      try {
        allUsers = await api.getUsers();
        render.users(dom.searchInput?.value || '');
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    },
    
    filterUsers() {
      render.users(dom.searchInput?.value || '');
    },
    
    async selectUser(email) {
      currentUser = email;
      
      const user = allUsers.find(u => u.email === email);
      if (user) {
        dom.chatAvatar.textContent = user.name[0]?.toUpperCase() || '?';
        dom.chatName.textContent = user.name;
        dom.chatStatus.innerHTML = user.isOnline ? 
          '<span class="online-dot"></span> Online' : 
          '<span class="offline-dot"></span> Offline';
      }
      
      dom.chatInputArea.style.display = 'flex';
      
      try {
        const msgs = await api.getMessages(email);
        render.messages(msgs);
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
      
      if (socket) {
        socket.emit('markRead', { user: email });
      }
      
      render.users(dom.searchInput?.value || '');
      dom.msgInput?.focus();
    },
    
    sendMessage() {
      if (!currentUser || !socket) return;
      
      const msg = dom.msgInput.value.trim();
      if (!msg) return;
      
      socket.emit('sendMsg', {
        sender: 'admin@baillamaach.com',
        receiver: currentUser,
        message: msg,
        type: 'text'
      });
      
      dom.msgInput.value = '';
      dom.msgInput.focus();
    },
    
    logout() {
      if (socket) socket.disconnect();
      currentUser = null;
      allUsers = [];
      dom.app.style.display = 'none';
      dom.loginOverlay.style.display = 'flex';
      dom.loginEmail.value = '';
      dom.loginPassword.value = '';
      dom.chatMessages.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>Select a conversation</p>
        </div>`;
      dom.chatInputArea.style.display = 'none';
    },
    
    handleKeyPress(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (document.activeElement === dom.msgInput) {
          this.sendMessage();
        } else if (document.activeElement === dom.loginPassword) {
          this.login();
        }
      }
    }
  };
})();

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Login form enter key
  document.getElementById('loginPassword')?.addEventListener('keypress', 
    (e) => ChatAdmin.handleKeyPress(e));
  
  // Message input enter key
  document.getElementById('msgInput')?.addEventListener('keypress', 
    (e) => ChatAdmin.handleKeyPress(e));
  
  // Search input
  document.getElementById('searchInput')?.addEventListener('input', 
    () => ChatAdmin.filterUsers());
  
  // Auto-refresh users every 30 seconds
  setInterval(() => {
    if (document.getElementById('app')?.style.display === 'block') {
      ChatAdmin.loadUsers();
    }
  }, 30000);
});

// Expose for HTML onclick handlers
window.ChatAdmin = ChatAdmin;

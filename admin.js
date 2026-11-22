// admin.js — dashboard
(function () {
  if (typeof io === 'undefined') return;
  var socket = io();
  var currentUser = null;
  var allUsers = [];
  var allReports = [];
  var allSongs = [];
  var isLoggedIn = false;
  var pollTimer = null;
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // Login
  window.doLogin = function () {
    var e = $('loginEmail').value.trim();
    var p = $('loginPassword').value.trim();
    var err = $('loginError'), btn = $('loginBtn');
    err.style.display = 'none';
    if (!e || !p) {
      err.textContent = 'Fill all fields';
      err.style.display = 'block';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: p })
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, data: d }; });
    }).then(function (res) {
      if (res.ok) {
        isLoggedIn = true;
        localStorage.setItem('adminSession', JSON.stringify({ email: e, password: p }));
        $('loginOverlay').style.display = 'none';
        $('dashboard').classList.add('active');
        loadAll();
        pollTimer = setInterval(function () { if (isLoggedIn) loadAll(); }, 15000);
      } else {
        err.textContent = res.data.error || 'Invalid credentials';
        err.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }).catch(function () {
      err.textContent = 'Network error';
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign in';
    });
  };

  window.doLogout = function () {
    if (pollTimer) clearInterval(pollTimer);
    localStorage.removeItem('adminSession');
    location.reload();
  };

  // Navigation
  window.showView = function (name, btn) {
    document.querySelectorAll('.dash-view').forEach(function (v) { v.classList.remove('active'); });
    var v = $('view-' + name);
    if (v) v.classList.add('active');
    document.querySelectorAll('.dash-nav-item').forEach(function (n) { n.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    if (name === 'messages') loadUsers();
    if (name === 'reports') loadReports();
    if (name === 'users') loadUsers();
    if (name === 'music') loadSongs();
  };

  // Load all
  function loadAll() {
    loadStats();
    loadUsers();
    loadReports();
  }

  function loadStats() {
    fetch('/api/admin/stats')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        $('statUsers').textContent = d.users || 0;
        $('statOnline').textContent = (d.online || 0) + ' online now';
        $('statMessages').textContent = d.messages || 0;
        $('statReports').textContent = d.reports || 0;
        var badge = $('navUnread');
        if (badge && d.reports > 0) {
          badge.textContent = d.reports;
          badge.style.display = 'inline-block';
        }
      });
  }

  function loadUsers() {
    fetch('/api/admin/users')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allUsers = data || [];
        renderRecentUsers();
        renderUsersList();
        renderMsgUsers();
      });
  }

  function loadReports() {
    fetch('/api/admin/reports')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allReports = data || [];
        renderReports();
      });
  }

  function loadSongs() {
    fetch('/')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var match = html.match(/tracks:\s*(\[[\s\S]*?\])\s*[,}]/);
        // Fallback: parse from data attribute — simpler: reload homepage data
        renderMusicList();
      }).catch(function () { renderMusicList(); });
  }

  function renderMusicList() {
    var el = $('musicList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><p>Music files are managed in <code>assets/covermusic/</code></p></div>';
  }

  // Recent users on overview
  function renderRecentUsers() {
    var el = $('recentUsersList');
    if (!el) return;
    var recent = allUsers.slice(0, 5);
    if (!recent.length) {
      el.innerHTML = '<div class="empty-state"><p>No users yet</p></div>';
      return;
    }
    el.innerHTML = recent.map(function (u) {
      return '<div class="row-item">' +
        '<div class="row-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--accent);color:white;border-radius:50%;font-weight:600;font-size:14px">' +
        esc(u.name.charAt(0).toUpperCase()) + '</div>' +
        '<div class="row-info">' +
        '<div class="row-title">' + esc(u.name) + '</div>' +
        '<div class="row-subtitle">' + esc(u.email) + '</div>' +
        '</div>' +
        '<span class="chip chip-neutral">' + (u.isOnline ? 'Online' : 'Offline') + '</span>' +
        '</div>';
    }).join('');
  }

  // Users list view
  function renderUsersList() {
    var el = $('usersList');
    if (!el) return;
    if (!allUsers.length) {
      el.innerHTML = '<div class="empty-state"><p>No users yet</p></div>';
      return;
    }
    el.innerHTML = allUsers.map(function (u) {
      return '<div class="row-item">' +
        '<div class="row-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--accent);color:white;border-radius:50%;font-weight:600;font-size:14px">' +
        esc(u.name.charAt(0).toUpperCase()) + '</div>' +
        '<div class="row-info">' +
        '<div class="row-title">' + esc(u.name) + '</div>' +
        '<div class="row-subtitle">' + esc(u.email) + ' · ' + (u.isOnline ? 'Online' : 'Offline') + '</div>' +
        '</div>' +
        (u.unreadCount > 0 ? '<span class="chip chip-danger">' + u.unreadCount + ' new</span>' : '') +
        '</div>';
    }).join('');
  }

  // Messages sidebar
  function renderMsgUsers() {
    var el = $('msgUsers');
    if (!el) return;
    var q = ($('msgSearch') && $('msgSearch').value || '').toLowerCase();
    var filtered = allUsers.filter(function (u) {
      return u.name.toLowerCase().indexOf(q) !== -1 || u.email.toLowerCase().indexOf(q) !== -1;
    });
    if (!filtered.length) {
      el.innerHTML = '<div class="empty-state"><p>No users</p></div>';
      return;
    }
    el.innerHTML = filtered.map(function (u) {
      var active = currentUser && currentUser.email === u.email ? ' active' : '';
      return '<div class="msg-user-item' + active + '" onclick="selectUser(\'' + esc(u.email) + '\')">' +
        '<div class="msg-user-avatar">' + esc(u.name.charAt(0).toUpperCase()) + '</div>' +
        '<div class="msg-user-info">' +
        '<div class="msg-user-name">' + esc(u.name) + '</div>' +
        '<div class="msg-user-email">' + esc(u.email) + '</div>' +
        '</div>' +
        (u.unreadCount > 0 ? '<span class="chip chip-danger">' + u.unreadCount + '</span>' : '') +
        '</div>';
    }).join('');
  }

  window.selectUser = function (email) {
    var u = allUsers.find(function (x) { return x.email === email; });
    if (!u) return;
    currentUser = u;
    $('msgAvatar').textContent = u.name.charAt(0).toUpperCase();
    $('msgName').textContent = u.name;
    $('msgStatus').textContent = u.isOnline ? '● Online' : '● Offline';
    $('msgCompose').style.display = 'flex';
    fetch('/api/msgs/' + encodeURIComponent(u.email))
      .then(function (r) { return r.json(); })
      .then(function (ms) {
        var th = $('msgThread');
        if (!ms.length) {
          th.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
        } else {
          th.innerHTML = ms.map(function (m) {
            var sent = m.sender === 'admin';
            var t = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return '<div class="msg ' + (sent ? 'user' : 'admin') + '">' + esc(m.message) +
              '<div class="time">' + t + '</div></div>';
          }).join('');
        }
        th.scrollTop = th.scrollHeight;
      });
    socket.emit('markRead', { user: u.email });
    renderMsgUsers();
  };

  window.sendMessage = function () {
    if (!currentUser) return;
    var i = $('msgInput');
    var m = i.value.trim();
    if (!m) return;
    socket.emit('sendMsg', { sender: 'admin', receiver: currentUser.email, message: m, type: 'text' });
    var th = $('msgThread');
    var t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    th.innerHTML += '<div class="msg user">' + esc(m) + '<div class="time">' + t + '</div></div>';
    th.scrollTop = th.scrollHeight;
    i.value = '';
    i.focus();
  };

  // Reports
  function renderReports() {
    var el = $('reportsList');
    if (!el) return;
    if (!allReports.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🚨</div><h3>No reports</h3><p>When users report fake accounts, they will appear here</p></div>';
      return;
    }
    el.innerHTML = allReports.map(function (r) {
      return '<div class="row-item">' +
        '<div class="row-info">' +
        '<div class="row-title">' + esc(r.fakeAccount || 'Unknown') + '</div>' +
        '<div class="row-subtitle">' + esc(r.platform || '') + ' · ' + esc(r.reason || '') + '</div>' +
        '<div class="row-subtitle" style="margin-top:4px">Reported by ' + esc(r.reporterName || 'Anonymous') + '</div>' +
        '</div>' +
        '<span class="chip chip-warning">' + esc(r.status || 'pending') + '</span>' +
        '</div>';
    }).join('');
  }

  // Settings
  window.saveSettings = function () {
    alert('Settings are stored in config.js — edit the file to persist changes.');
  };

  // Socket events
  socket.on('newMsg', function (m) {
    if (currentUser && (
      (m.sender === currentUser.email && m.receiver === 'admin') ||
      (m.sender === 'admin' && m.receiver === currentUser.email)
    )) {
      var th = $('msgThread');
      var sent = m.sender === 'admin';
      var t = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      th.innerHTML += '<div class="msg ' + (sent ? 'user' : 'admin') + '">' + esc(m.message) +
        '<div class="time">' + t + '</div></div>';
      th.scrollTop = th.scrollHeight;
    }
    loadStats();
  });

  socket.on('userStatus', function () {
    loadUsers();
  });

  // Restore session
  var saved = localStorage.getItem('adminSession');
  if (saved) {
    try {
      var d = JSON.parse(saved);
      $('loginEmail').value = d.email || '';
      $('loginPassword').value = d.password || '';
    } catch (e) {}
  }
  var pw = $('loginPassword');
  if (pw) pw.addEventListener('keypress', function (e) { if (e.key === 'Enter') window.doLogin(); });
})();

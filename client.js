// admin.js
(function () {
  if (typeof io === 'undefined') return;
  var socket = io();
  var currentUser = null;
  var allUsers = [];
  var isLoggedIn = false;
  var pollTimer = null;
  var $ = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  socket.on('newMsg', function (m) {
    if (currentUser && (
      (m.sender === currentUser.email && m.receiver === 'admin') ||
      (m.sender === 'admin' && m.receiver === currentUser.email)
    )) {
      appendMessage(m);
    }
    loadUsers();
  });

  socket.on('userStatus', function (d) {
    if (currentUser && currentUser.email === d.email) {
      var s = $('chatStatus');
      s.textContent = d.online ? '● Online' : '● Offline';
      s.className = 'status ' + (d.online ? 'online' : 'offline');
    }
    loadUsers();
  });

  window.doLogin = function () {
    var e = $('loginEmail').value.trim();
    var p = $('loginPassword').value.trim();
    var err = $('loginError');
    var btn = $('loginBtn');
    err.style.display = 'none';
    if (!e || !p) { err.textContent = 'Fill all fields'; err.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Signing...';
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: p })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          isLoggedIn = true;
          localStorage.setItem('adminSession', JSON.stringify({ email: e, password: p }));
          $('loginOverlay').style.display = 'none';
          $('app').style.display = 'block';
          loadUsers();
          pollTimer = setInterval(function () { if (isLoggedIn) loadUsers(); }, 10000);
        } else {
          err.textContent = '❌ ' + (res.d.error || 'Invalid credentials');
          err.style.display = 'block';
        }
        btn.disabled = false; btn.textContent = 'Sign In';
      })
      .catch(function () {
        err.textContent = '❌ Network error'; err.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Sign In';
      });
  };

  function loadUsers() {
    if (!isLoggedIn) return;
    fetch('/api/admin/users')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allUsers = data;
        renderUserList();
      })
      .catch(function (e) { console.warn(e); });
  }

  function renderUserList() {
    var s = $('searchInput').value.toLowerCase();
    var f = allUsers.filter(function (u) {
      return u.name.toLowerCase().indexOf(s) !== -1 || u.email.toLowerCase().indexOf(s) !== -1;
    });
    var list = $('userList');
    if (!f.length) { list.innerHTML = '<div class="empty-state"><p>No users yet</p></div>'; return; }
    list.innerHTML = f.map(function (u) {
      var active = currentUser && currentUser.email === u.email ? ' active' : '';
      return '<div class="user-item' + active + '" onclick="selectUser(\'' + u.email + '\')">' +
        '<div class="user-avatar">' + u.name.charAt(0).toUpperCase() + '</div>' +
        '<div class="user-info">' +
          '<div class="name">' + escapeHtml(u.name) + '</div>' +
          '<div class="email">' + escapeHtml(u.email) + '</div>' +
        '</div>' +
        (u.unreadCount > 0 ? '<div class="unread">' + u.unreadCount + '</div>' : '') +
        '</div>';
    }).join('');
  }

  window.filterUsers = function () { renderUserList(); };

  window.selectUser = function (email) {
    var u = allUsers.find(function (x) { return x.email === email; });
    if (!u) return;
    currentUser = u;
    $('chatAvatar').textContent = u.name.charAt(0).toUpperCase();
    $('chatName').textContent   = u.name;
    var st = $('chatStatus');
    st.textContent = u.isOnline ? '● Online' : '● Offline';
    st.className = 'status ' + (u.isOnline ? 'online' : 'offline');
    $('chatInputArea').style.display = 'block';

    fetch('/api/msgs/' + encodeURIComponent(u.email))
      .then(function (r) { return r.json(); })
      .then(function (ms) {
        var c = $('chatMessages');
        if (!ms.length) {
          c.innerHTML = '<div class="empty-state"><h3>No messages</h3></div>';
        } else {
          c.innerHTML = ms.map(function (m) {
            var sent = m.sender === 'admin';
            var t = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return '<div class="msg ' + (sent ? 'sent' : 'received') + '">' +
              escapeHtml(m.message) +
              '<div class="time">' + t + '</div></div>';
          }).join('');
        }
        c.scrollTop = c.scrollHeight;
      })
      .catch(function (e) { console.warn(e); });

    socket.emit('markRead', { user: u.email });
    renderUserList();
  };

  function appendMessage(m) {
    if (!currentUser) return;
    var c = $('chatMessages');
    var sent = m.sender === 'admin';
    var t = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    c.insertAdjacentHTML('beforeend',
      '<div class="msg ' + (sent ? 'sent' : 'received') + '">' +
      escapeHtml(m.message) +
      '<div class="time">' + t + '</div></div>');
    c.scrollTop = c.scrollHeight;
  }

  window.sendMessage = function () {
    if (!currentUser) return;
    var i = $('msgInput');
    var m = i.value.trim();
    if (!m) return;
    socket.emit('sendMsg', { sender: 'admin', receiver: currentUser.email, message: m, type: 'text' });
    appendMessage({ sender: 'admin', receiver: currentUser.email, message: m, timestamp: new Date() });
    i.value = ''; i.focus();
  };

  window.doLogout = function () {
    if (pollTimer) clearInterval(pollTimer);
    localStorage.removeItem('adminSession');
    location.reload();
  };

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

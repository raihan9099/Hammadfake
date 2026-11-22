// client.js — public profile page
(function () {
  var cfg = window.__CONFIG__ || {};
  var tracks = cfg.tracks || [];
  var $ = function (id) { return document.getElementById(id); };

  // Music player
  var musicAudio = $('musicAudio');
  var musicPlaying = false;
  var currentTrack = 0;

  function updatePlayBtn() {
    var b = $('mPlayBtn');
    if (b) b.textContent = musicPlaying ? '⏸' : '▶';
  }

  function updateMusicUI(i) {
    var t = $('mTitle');
    if (t && tracks[i]) t.textContent = tracks[i].title;
    var items = document.querySelectorAll('.playlist-item');
    for (var j = 0; j < items.length; j++) {
      if (j === i) items[j].classList.add('active');
      else items[j].classList.remove('active');
    }
  }

  window.playMusic = function (i) {
    if (!tracks.length) return;
    currentTrack = i;
    musicAudio.src = tracks[i].url;
    musicAudio.play().catch(function () {});
    musicPlaying = true;
    updatePlayBtn();
    updateMusicUI(i);
  };

  window.toggleMusic = function () {
    if (musicAudio.paused) {
      if (!musicAudio.src && tracks.length) musicAudio.src = tracks[0].url;
      musicAudio.play().catch(function () {});
      musicPlaying = true;
      updatePlayBtn();
      updateMusicUI(currentTrack);
    } else {
      musicAudio.pause();
      musicPlaying = false;
      updatePlayBtn();
    }
  };

  window.prevMusic = function () {
    if (!tracks.length) return;
    window.playMusic((currentTrack - 1 + tracks.length) % tracks.length);
  };
  window.nextMusic = function () {
    if (!tracks.length) return;
    window.playMusic((currentTrack + 1) % tracks.length);
  };
  window.seekMusic = function (e) {
    if (!musicAudio.duration) return;
    var r = e.currentTarget.getBoundingClientRect();
    musicAudio.currentTime = ((e.clientX - r.left) / r.width) * musicAudio.duration;
  };

  if (musicAudio) {
    musicAudio.addEventListener('timeupdate', function () {
      if (!musicAudio.duration) return;
      var fill = $('mFill'), cur = $('mCur'), dur = $('mDur');
      if (fill) fill.style.width = (musicAudio.currentTime / musicAudio.duration) * 100 + '%';
      if (cur) cur.textContent = formatTime(musicAudio.currentTime);
      if (dur) dur.textContent = formatTime(musicAudio.duration);
    });
    musicAudio.addEventListener('ended', window.nextMusic);
  }

  function formatTime(s) {
    if (isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  // Chat
  if (typeof io === 'undefined') return;
  var socket = io();
  var chatUser = null;

  window.toggleChat = function () {
    $('chatPanel').classList.toggle('open');
  };

  window.startChatSession = function () {
    var n = $('chatNameInput').value.trim();
    var e = $('chatEmailInput').value.trim();
    if (!n || !e) return;
    chatUser = { name: n, email: e };
    socket.emit('register', chatUser);
    $('chatLoginForm').style.display = 'none';
    $('chatInputArea').style.display = 'block';
    loadChatMessages();
  };

  function loadChatMessages() {
    if (!chatUser) return;
    fetch('/api/msgs/' + encodeURIComponent(chatUser.email))
      .then(function (r) { return r.json(); })
      .then(function (ms) {
        var b = $('chatBody');
        b.innerHTML = '';
        ms.forEach(renderChatMsg);
        b.scrollTop = b.scrollHeight;
      });
  }

  function renderChatMsg(m) {
    var b = $('chatBody');
    var el = document.createElement('div');
    el.className = 'msg ' + (m.sender === chatUser.email ? 'user' : 'admin');
    el.textContent = m.message;
    var t = document.createElement('div');
    t.className = 'time';
    t.textContent = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.appendChild(t);
    b.appendChild(el);
  }

  window.sendChatMsg = function () {
    var i = $('chatMsgInput');
    var m = i.value.trim();
    if (!m || !chatUser) return;
    socket.emit('sendMsg', { sender: chatUser.email, receiver: 'admin', message: m, type: 'text' });
    i.value = '';
  };

  socket.on('newMsg', function (m) {
    if (chatUser && (m.sender === chatUser.email || m.receiver === chatUser.email)) {
      renderChatMsg(m);
      var b = $('chatBody');
      b.scrollTop = b.scrollHeight;
    }
  });
})();

// chat.js - Full Screen Chat Page Handler
// This file handles the /chat route

function getChatPageHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#0a0a14">
<title>Chat - Baiilla Maach Official</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
    --bg: #0a0a14;
    --surface: #13132b;
    --surface2: #1a1a35;
    --text: #f0f0ff;
    --text2: #a0a0cc;
    --text3: #6060a0;
    --purple: #8b5cf6;
    --purple2: #a78bfa;
    --pink: #ec4899;
    --green: #10b981;
    --red: #ef4444;
    --glass-border: rgba(255,255,255,0.06);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: "Plus Jakarta Sans", sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Header */
.chat-header {
    background: var(--surface);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--glass-border);
    flex-shrink: 0;
    z-index: 10;
}

.chat-header-back {
    color: var(--purple2);
    text-decoration: none;
    font-size: 22px;
    padding: 6px;
    display: flex;
    align-items: center;
    transition: color 0.2s;
}

.chat-header-back:hover {
    color: var(--purple);
}

.chat-header-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--purple);
    flex-shrink: 0;
}

.chat-header-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.chat-header-info {
    flex: 1;
    min-width: 0;
}

.chat-header-name {
    font-weight: 600;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.verified-badge {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

.chat-header-status {
    font-size: 11px;
    color: var(--text2);
    margin-top: 2px;
}

.online-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--green);
    margin-right: 4px;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Messages */
.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg);
}

.msg-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    max-width: 85%;
}

.msg-row.in {
    align-self: flex-start;
}

.msg-row.out {
    align-self: flex-end;
    flex-direction: row-reverse;
}

.msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
}

.msg-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.msg-bubble {
    padding: 10px 14px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
    max-width: 100%;
}

.msg-row.in .msg-bubble {
    background: var(--surface2);
    border-bottom-left-radius: 4px;
}

.msg-row.out .msg-bubble {
    background: linear-gradient(135deg, var(--purple), #6d28d9);
    border-bottom-right-radius: 4px;
}

.msg-time {
    font-size: 10px;
    opacity: 0.5;
    margin-top: 4px;
}

.msg-image {
    max-width: 250px;
    max-height: 250px;
    border-radius: 12px;
    cursor: pointer;
    display: block;
}

.msg-voice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    min-width: 150px;
}

.voice-play-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    border: none;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
}

.voice-play-btn:hover {
    background: rgba(255,255,255,0.3);
}

.voice-wave {
    flex: 1;
    height: 24px;
    display: flex;
    align-items: center;
    gap: 2px;
}

.voice-bar {
    width: 3px;
    background: var(--purple);
    border-radius: 2px;
    animation: voiceAnim 1s ease-in-out infinite;
}

.voice-bar:nth-child(1) { height: 8px; animation-delay: 0s; }
.voice-bar:nth-child(2) { height: 16px; animation-delay: 0.1s; }
.voice-bar:nth-child(3) { height: 12px; animation-delay: 0.2s; }
.voice-bar:nth-child(4) { height: 20px; animation-delay: 0.3s; }
.voice-bar:nth-child(5) { height: 10px; animation-delay: 0.4s; }
.voice-bar:nth-child(6) { height: 18px; animation-delay: 0.5s; }
.voice-bar:nth-child(7) { height: 14px; animation-delay: 0.6s; }
.voice-bar:nth-child(8) { height: 8px; animation-delay: 0.7s; }
.voice-bar:nth-child(9) { height: 16px; animation-delay: 0.8s; }
.voice-bar:nth-child(10) { height: 12px; animation-delay: 0.9s; }
.voice-bar:nth-child(11) { height: 20px; animation-delay: 1s; }
.voice-bar:nth-child(12) { height: 10px; animation-delay: 1.1s; }

@keyframes voiceAnim {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.3); }
}

.voice-duration {
    font-size: 11px;
    opacity: 0.6;
    margin-left: 8px;
    flex-shrink: 0;
}

/* Input Area */
.chat-input-area {
    background: var(--surface);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--glass-border);
    flex-shrink: 0;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
}

.chat-input {
    flex: 1;
    background: var(--surface2);
    border: 1px solid var(--glass-border);
    border-radius: 25px;
    padding: 12px 16px;
    color: var(--text);
    font-size: 14px;
    outline: none;
    font-family: inherit;
}

.chat-input:focus {
    border-color: var(--purple);
}

.chat-input::placeholder {
    color: var(--text3);
}

.chat-attach-btn,
.chat-send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
}

.chat-attach-btn {
    background: rgba(255,255,255,0.1);
}

.chat-attach-btn:hover {
    background: rgba(255,255,255,0.2);
}

.chat-mic-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--purple);
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.3s;
}

.chat-mic-btn:hover {
    background: #7c3aed;
}

.chat-mic-btn.recording {
    background: var(--red);
    animation: micPulse 1s infinite;
}

@keyframes micPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    50% { box-shadow: 0 0 0 15px rgba(239,68,68,0); }
}

.chat-send-btn {
    background: linear-gradient(135deg, var(--purple), var(--pink));
}

.chat-send-btn:hover {
    transform: scale(1.05);
}

.recording-timer {
    font-size: 13px;
    color: var(--red);
    font-weight: 600;
    min-width: 40px;
    text-align: center;
}

/* Image Preview */
.image-preview {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.95);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.image-preview img {
    max-width: 95%;
    max-height: 95%;
    border-radius: 12px;
    object-fit: contain;
}

/* Login Screen */
.login-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
    background: var(--bg);
}

.login-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid var(--purple);
    margin-bottom: 20px;
    position: relative;
}

.login-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.login-verified {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, var(--green), #059669);
    border-radius: 50%;
    border: 2px solid var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;
}

.login-verified img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.login-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    background: linear-gradient(135deg, #c4b5fd, #f9a8d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.login-subtitle {
    font-size: 13px;
    color: var(--text2);
    margin-bottom: 30px;
}

.login-form {
    width: 100%;
    max-width: 320px;
}

.login-input {
    width: 100%;
    padding: 14px 16px;
    background: var(--surface2);
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    color: var(--text);
    font-size: 14px;
    margin-bottom: 10px;
    outline: none;
    font-family: inherit;
}

.login-input:focus {
    border-color: var(--purple);
}

.login-input::placeholder {
    color: var(--text3);
}

.login-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, var(--purple), var(--pink));
    border: none;
    border-radius: 14px;
    color: #fff;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    margin-top: 10px;
    transition: all 0.3s;
}

.login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(139,92,246,0.4);
}

.login-btn:active {
    transform: scale(0.98);
}

.login-error {
    color: var(--red);
    font-size: 12px;
    margin-top: 8px;
    display: none;
}

/* Responsive */
@media (max-width: 480px) {
    .msg-row {
        max-width: 90%;
    }
    
    .msg-image {
        max-width: 200px;
        max-height: 200px;
    }
    
    .chat-input-area {
        padding: 8px 12px;
    }
}
</style>
</head>
<body>

<!-- Header with Verified Badge -->
<div class="chat-header">
    <a href="/" class="chat-header-back">←</a>
    <div class="chat-header-avatar">
        <img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Baiilla Maach">
    </div>
    <div class="chat-header-info">
        <div class="chat-header-name">
            Baiilla Maach Official
            <img src="/assets/check-mark.png" class="verified-badge" alt="Verified">
        </div>
        <div class="chat-header-status">
            <span class="online-dot"></span>Online now
        </div>
    </div>
</div>

<!-- Login Screen -->
<div id="loginScreen" class="login-screen">
    <div class="login-avatar">
        <img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Baiilla Maach">
        <div class="login-verified">
            <img src="/assets/check-mark.png" alt="Verified">
        </div>
    </div>
    <div class="login-title">Chat with Baiilla Maach</div>
    <div class="login-subtitle">Official Support • Verified Account</div>
    <div class="login-form">
        <input type="text" id="loginName" class="login-input" placeholder="Your Name" autocomplete="name">
        <input type="text" id="loginContact" class="login-input" placeholder="Email or Phone" autocomplete="email">
        <button class="login-btn" onclick="registerAndStart()">Start Chat</button>
        <div id="loginError" class="login-error">Please fill all fields</div>
    </div>
</div>

<!-- Chat Messages -->
<div id="chatMessages" class="chat-messages" style="display:none"></div>

<!-- Chat Input Area -->
<div id="chatInputArea" class="chat-input-area" style="display:none">
    <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFileUpload(event)">
    <button class="chat-attach-btn" onclick="document.getElementById('fileInput').click()" title="Attach Photo">📎</button>
    <input type="text" id="msgInput" class="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendTextMessage()">
    <button id="micBtn" class="chat-mic-btn" onmousedown="startRecording()" onmouseup="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()" title="Record Voice">🎤</button>
    <button class="chat-send-btn" onclick="sendTextMessage()" title="Send Message">➤</button>
    <span id="recordingTimer" class="recording-timer" style="display:none">0:00</span>
</div>

<!-- Audio Player -->
<audio id="voicePlayer" style="display:none"></audio>

<!-- Image Preview Modal -->
<div id="imagePreview" class="image-preview" style="display:none" onclick="this.style.display='none'">
    <img id="previewImg" src="" alt="Preview">
</div>

<script>
var chatToken = localStorage.getItem("chatToken");
var chatId = localStorage.getItem("chatId");
var mediaRecorder = null;
var audioChunks = [];
var recordingStartTime = 0;
var recordingTimerInterval = null;
var pollInterval = null;
var userName = localStorage.getItem("userName") || "";

// Auto-login if token exists
if (chatToken && chatId) {
    verifyAndLoad();
}

function registerAndStart() {
    var name = document.getElementById("loginName").value.trim();
    var contact = document.getElementById("loginContact").value.trim();
    var errEl = document.getElementById("loginError");
    
    if (!name || !contact) {
        errEl.textContent = "Please fill in all fields";
        errEl.style.display = "block";
        return;
    }
    
    errEl.style.display = "none";
    
    // Show loading state
    var btn = document.querySelector(".login-btn");
    btn.textContent = "Connecting...";
    btn.disabled = true;
    
    fetch("/api/chat/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name: name, phoneEmail: contact})
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            chatToken = d.token;
            chatId = d.chatId;
            userName = name;
            localStorage.setItem("chatToken", chatToken);
            localStorage.setItem("chatId", chatId);
            localStorage.setItem("userName", userName);
            showChat();
            loadMessages();
            startPolling();
        } else {
            errEl.textContent = d.error || "Registration failed. Please try again.";
            errEl.style.display = "block";
            btn.textContent = "Start Chat";
            btn.disabled = false;
        }
    })
    .catch(function() {
        errEl.textContent = "Connection error. Please check your internet.";
        errEl.style.display = "block";
        btn.textContent = "Start Chat";
        btn.disabled = false;
    });
}

function verifyAndLoad() {
    fetch("/api/chat/verify?token=" + encodeURIComponent(chatToken))
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            showChat();
            loadMessages();
            startPolling();
        } else {
            // Token expired or invalid
            localStorage.clear();
            chatToken = null;
            chatId = null;
            userName = "";
        }
    })
    .catch(function() {
        // Network error, still try to show chat
        showChat();
        loadMessages();
        startPolling();
    });
}

function showChat() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("chatMessages").style.display = "flex";
    document.getElementById("chatInputArea").style.display = "flex";
}

function loadMessages() {
    if (!chatToken) return;
    
    fetch("/api/chat/messages?token=" + encodeURIComponent(chatToken) + "&t=" + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            renderMessages(d.messages);
        }
    })
    .catch(function() {
        // Silent fail - will retry on next poll
    });
}

function renderMessages(msgs) {
    var container = document.getElementById("chatMessages");
    var wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    container.innerHTML = "";
    
    if (!msgs || msgs.length === 0) {
        container.innerHTML = '<div style="text-align:center;opacity:0.5;padding:40px">' +
            '<div style="font-size:40px;margin-bottom:12px">💬</div>' +
            '<div style="font-size:14px">Start a conversation!</div>' +
            '<div style="font-size:11px;margin-top:4px">We typically reply within minutes</div>' +
            '</div>';
        return;
    }
    
    msgs.forEach(function(m) {
        var isUser = m.sender === "user";
        var row = document.createElement("div");
        row.className = "msg-row " + (isUser ? "out" : "in");
        
        var bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        
        if (m.type === "image" && m.fileUrl) {
            var img = document.createElement("img");
            img.src = m.fileUrl;
            img.className = "msg-image";
            img.onclick = function() { showImagePreview(m.fileUrl); };
            img.loading = "lazy";
            bubble.appendChild(img);
        } else if (m.type === "voice" && m.fileUrl) {
            bubble.className += " msg-voice";
            
            var playBtn = document.createElement("button");
            playBtn.className = "voice-play-btn";
            playBtn.textContent = "▶";
            playBtn.onclick = function(e) {
                e.stopPropagation();
                playVoice(m.fileUrl, playBtn);
            };
            bubble.appendChild(playBtn);
            
            var wave = document.createElement("div");
            wave.className = "voice-wave";
            for (var i = 0; i < 12; i++) {
                var bar = document.createElement("div");
                bar.className = "voice-bar";
                wave.appendChild(bar);
            }
            bubble.appendChild(wave);
            
            if (m.duration) {
                var dur = document.createElement("span");
                dur.className = "voice-duration";
                dur.textContent = formatTime(m.duration);
                bubble.appendChild(dur);
            }
        } else {
            bubble.textContent = m.message;
        }
        
        var time = document.createElement("div");
        time.className = "msg-time";
        time.textContent = new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
        bubble.appendChild(time);
        
        row.appendChild(bubble);
        container.appendChild(row);
    });
    
    // Auto-scroll if user was at bottom
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

function sendTextMessage() {
    var input = document.getElementById("msgInput");
    var msg = input.value.trim();
    if (!msg || !chatToken) return;
    
    input.value = "";
    input.focus();
    
    // Optimistic UI update
    addOptimisticMessage(msg, "text");
    
    fetch("/api/chat/send", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            token: chatToken,
            message: msg,
            type: "text"
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            loadMessages(); // Refresh to get server timestamp
        }
    })
    .catch(function() {
        // Retry on next poll
    });
}

function addOptimisticMessage(msg, type, fileUrl) {
    var container = document.getElementById("chatMessages");
    var row = document.createElement("div");
    row.className = "msg-row out";
    var bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.style.opacity = "0.7";
    bubble.textContent = msg;
    var time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = "Sending...";
    bubble.appendChild(time);
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function handleFileUpload(event) {
    var file = event.target.files[0];
    if (!file || !chatToken) return;
    
    var formData = new FormData();
    formData.append("photo", file);
    
    // Show uploading indicator
    addOptimisticMessage("📷 Uploading photo...", "text");
    
    fetch("/api/chat/upload?token=" + encodeURIComponent(chatToken), {
        method: "POST",
        body: formData
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            return fetch("/api/chat/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    token: chatToken,
                    message: "📷 Photo",
                    type: "image",
                    fileUrl: d.fileUrl
                })
            });
        }
    })
    .then(function(r) { return r ? r.json() : null; })
    .then(function(d) {
        if (d && d.success) {
            loadMessages();
        }
    })
    .catch(function() {
        // Silent fail
    });
    
    event.target.value = "";
}

function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Voice recording is not supported on this device");
        return;
    }
    
    navigator.mediaDevices.getUserMedia({audio: true})
    .then(function(stream) {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = function() {
            var audioBlob = new Blob(audioChunks, {type: "audio/webm"});
            uploadVoice(audioBlob);
            stream.getTracks().forEach(function(t) { t.stop(); });
        };
        
        mediaRecorder.start();
        recordingStartTime = Date.now();
        
        document.getElementById("micBtn").classList.add("recording");
        document.getElementById("recordingTimer").style.display = "inline";
        
        recordingTimerInterval = setInterval(function() {
            var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            document.getElementById("recordingTimer").textContent = formatTime(elapsed);
        }, 500);
    })
    .catch(function() {
        alert("Microphone access denied. Please allow microphone access in your browser settings.");
    });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        clearInterval(recordingTimerInterval);
        document.getElementById("micBtn").classList.remove("recording");
        document.getElementById("recordingTimer").style.display = "none";
        window._lastVoiceDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
    }
}

function uploadVoice(blob) {
    if (!chatToken) return;
    
    var formData = new FormData();
    formData.append("voice", blob, "voice.webm");
    
    addOptimisticMessage("🎤 Voice message", "voice");
    
    fetch("/api/chat/upload-voice?token=" + encodeURIComponent(chatToken), {
        method: "POST",
        body: formData
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            return fetch("/api/chat/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    token: chatToken,
                    message: "🎤 Voice Message",
                    type: "voice",
                    fileUrl: d.fileUrl,
                    duration: window._lastVoiceDuration || 0
                })
            });
        }
    })
    .then(function(r) { return r ? r.json() : null; })
    .then(function(d) {
        if (d && d.success) {
            loadMessages();
        }
    });
}

function playVoice(url, btn) {
    var player = document.getElementById("voicePlayer");
    
    if (player.src === url && !player.paused) {
        player.pause();
        player.currentTime = 0;
        btn.textContent = "▶";
        return;
    }
    
    // Stop any currently playing audio
    player.pause();
    player.currentTime = 0;
    
    // Reset all play buttons
    document.querySelectorAll(".voice-play-btn").forEach(function(b) {
        b.textContent = "▶";
    });
    
    player.src = url;
    player.play().then(function() {
        btn.textContent = "⏸";
    }).catch(function() {
        btn.textContent = "▶";
    });
    
    player.onended = function() {
        btn.textContent = "▶";
    };
    
    player.onerror = function() {
        btn.textContent = "▶";
    };
}

function showImagePreview(url) {
    var preview = document.getElementById("imagePreview");
    var img = document.getElementById("previewImg");
    img.src = url;
    preview.style.display = "flex";
    document.body.style.overflow = "hidden";
    
    preview.onclick = function() {
        preview.style.display = "none";
        document.body.style.overflow = "";
    };
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 2000);
}

// Handle Enter key on login form
document.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && document.getElementById("loginScreen").style.display !== "none") {
        registerAndStart();
    }
});

// Clean up on page unload
window.addEventListener("beforeunload", function() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
    }
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});
</script>
</body>
</html>`;
}

module.exports = { getChatPageHTML };

// chat.js - Full Screen Chat Page Handler
// This file handles the /chat route

function getChatPageHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#0a0a14">
<title>Chat - Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Plus Jakarta Sans",sans-serif;background:#0a0a14;color:#fff;height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
.chat-header{background:#13132b;padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;z-index:10}
.chat-header-back{color:#a78bfa;text-decoration:none;font-size:22px;padding:6px;display:flex;align-items:center}
.chat-header-avatar{width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid #8b5cf6;flex-shrink:0}
.chat-header-avatar img{width:100%;height:100%;object-fit:cover}
.chat-header-info{flex:1;min-width:0}
.chat-header-name{font-weight:600;font-size:15px;display:flex;align-items:center;gap:6px}
.chat-header-status{font-size:11px;color:#a0a0cc}
.online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}

.chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:#0a0a14}
.msg-row{display:flex;align-items:flex-end;gap:8px;max-width:85%}
.msg-row.in{align-self:flex-start}
.msg-row.out{align-self:flex-end;flex-direction:row-reverse}
.msg-avatar{width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0}
.msg-avatar img{width:100%;height:100%;object-fit:cover}
.msg-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4;word-wrap:break-word;max-width:100%}
.msg-row.in .msg-bubble{background:#1a1a35;border-bottom-left-radius:4px}
.msg-row.out .msg-bubble{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px}
.msg-time{font-size:10px;opacity:0.5;margin-top:4px}
.msg-image{max-width:250px;max-height:250px;border-radius:12px;cursor:pointer;display:block}
.msg-voice{display:flex;align-items:center;gap:10px;padding:8px 14px;min-width:150px}
.voice-play-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.voice-wave{flex:1;height:24px;display:flex;align-items:center;gap:2px}
.voice-bar{width:3px;background:#8b5cf6;border-radius:2px;animation:voiceAnim 1s ease-in-out infinite}
.voice-bar:nth-child(1){height:8px;animation-delay:0s}
.voice-bar:nth-child(2){height:16px;animation-delay:0.1s}
.voice-bar:nth-child(3){height:12px;animation-delay:0.2s}
.voice-bar:nth-child(4){height:20px;animation-delay:0.3s}
.voice-bar:nth-child(5){height:10px;animation-delay:0.4s}
.voice-bar:nth-child(6){height:18px;animation-delay:0.5s}
.voice-bar:nth-child(7){height:14px;animation-delay:0.6s}
.voice-bar:nth-child(8){height:8px;animation-delay:0.7s}
.voice-bar:nth-child(9){height:16px;animation-delay:0.8s}
.voice-bar:nth-child(10){height:12px;animation-delay:0.9s}
.voice-bar:nth-child(11){height:20px;animation-delay:1s}
.voice-bar:nth-child(12){height:10px;animation-delay:1.1s}
@keyframes voiceAnim{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.3)}}
.voice-duration{font-size:11px;opacity:0.6;margin-left:8px;flex-shrink:0}

.chat-input-area{background:#13132b;padding:10px 16px;display:flex;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;padding-bottom:max(10px,env(safe-area-inset-bottom))}
.chat-input{flex:1;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:25px;padding:12px 16px;color:#fff;font-size:14px;outline:none;font-family:inherit}
.chat-input:focus{border-color:#8b5cf6}
.chat-attach-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.chat-mic-btn{width:40px;height:40px;border-radius:50%;background:#8b5cf6;border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.3s}
.chat-mic-btn.recording{background:#ef4444;animation:micPulse 1s infinite}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 15px rgba(239,68,68,0)}}
.chat-send-btn{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.recording-timer{font-size:13px;color:#ef4444;font-weight:600;min-width:40px;text-align:center}

.image-preview{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer}
.image-preview img{max-width:95%;max-height:95%;border-radius:12px}

.login-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center}
.login-avatar{width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid #8b5cf6;margin-bottom:20px}
.login-avatar img{width:100%;height:100%;object-fit:cover}
.login-title{font-size:22px;font-weight:700;margin-bottom:8px}
.login-subtitle{font-size:13px;color:#a0a0cc;margin-bottom:30px}
.login-input{width:100%;max-width:320px;padding:14px 16px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:14px;color:#fff;font-size:14px;margin-bottom:10px;outline:none;font-family:inherit}
.login-input:focus{border-color:#8b5cf6}
.login-btn{width:100%;max-width:320px;padding:14px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border:none;border-radius:14px;color:#fff;font-weight:600;font-size:15px;cursor:pointer;margin-top:10px}
.login-error{color:#ef4444;font-size:12px;margin-top:8px;display:none}
@media(max-width:480px){.msg-row{max-width:90%}.msg-image{max-width:200px;max-height:200px}}
</style>
</head>
<body>

<div class="chat-header">
    <a href="/" class="chat-header-back">←</a>
    <div class="chat-header-avatar"><img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Avatar"></div>
    <div class="chat-header-info">
        <div class="chat-header-name">Hammad Bin Amir <span style="font-size:10px;color:#10b981">✓</span></div>
        <div class="chat-header-status"><span class="online-dot"></span>Online now</div>
    </div>
</div>

<div id="loginScreen" class="login-screen">
    <div class="login-avatar"><img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Avatar"></div>
    <div class="login-title">Chat with us</div>
    <div class="login-subtitle">Enter your details to start conversation</div>
    <input type="text" id="loginName" class="login-input" placeholder="Your Name">
    <input type="text" id="loginContact" class="login-input" placeholder="Email or Phone">
    <button class="login-btn" onclick="registerAndStart()">Start Chat</button>
    <div id="loginError" class="login-error">Please fill all fields</div>
</div>

<div id="chatMessages" class="chat-messages" style="display:none"></div>

<div id="chatInputArea" class="chat-input-area" style="display:none">
    <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFileUpload(event)">
    <button class="chat-attach-btn" onclick="document.getElementById('fileInput').click()">📎</button>
    <input type="text" id="msgInput" class="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendTextMessage()">
    <button id="micBtn" class="chat-mic-btn" onmousedown="startRecording()" onmouseup="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()">🎤</button>
    <button class="chat-send-btn" onclick="sendTextMessage()">➤</button>
    <span id="recordingTimer" class="recording-timer" style="display:none">0:00</span>
</div>

<audio id="voicePlayer" style="display:none"></audio>
<div id="imagePreview" class="image-preview" style="display:none" onclick="this.style.display='none'"><img id="previewImg" src="" alt="Preview"></div>

<script>
var chatToken = localStorage.getItem("chatToken");
var chatId = localStorage.getItem("chatId");
var mediaRecorder = null;
var audioChunks = [];
var recordingStartTime = 0;
var recordingTimerInterval = null;
var pollInterval = null;

if (chatToken && chatId) {
    verifyAndLoad();
}

function registerAndStart() {
    var name = document.getElementById("loginName").value.trim();
    var contact = document.getElementById("loginContact").value.trim();
    var errEl = document.getElementById("loginError");
    if (!name || !contact) {
        errEl.style.display = "block";
        return;
    }
    errEl.style.display = "none";
    fetch("/api/chat/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name: name, phoneEmail: contact})
    }).then(function(r) { return r.json() }).then(function(d) {
        if (d.success) {
            chatToken = d.token;
            chatId = d.chatId;
            localStorage.setItem("chatToken", chatToken);
            localStorage.setItem("chatId", chatId);
            showChat();
            loadMessages();
            startPolling();
        } else {
            errEl.textContent = d.error || "Registration failed";
            errEl.style.display = "block";
        }
    }).catch(function() {
        errEl.textContent = "Connection error";
        errEl.style.display = "block";
    });
}

function verifyAndLoad() {
    fetch("/api/chat/verify?token=" + encodeURIComponent(chatToken)).then(function(r) { return r.json() }).then(function(d) {
        if (d.success) {
            showChat();
            loadMessages();
            startPolling();
        } else {
            localStorage.clear();
            chatToken = null;
            chatId = null;
        }
    });
}

function showChat() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("chatMessages").style.display = "flex";
    document.getElementById("chatInputArea").style.display = "flex";
}

function loadMessages() {
    if (!chatToken) return;
    fetch("/api/chat/messages?token=" + encodeURIComponent(chatToken) + "&t=" + Date.now()).then(function(r) { return r.json() }).then(function(d) {
        if (d.success) renderMessages(d.messages);
    });
}

function renderMessages(msgs) {
    var container = document.getElementById("chatMessages");
    container.innerHTML = "";
    (msgs || []).forEach(function(m) {
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
            bubble.appendChild(img);
        } else if (m.type === "voice" && m.fileUrl) {
            bubble.className += " msg-voice";
            var playBtn = document.createElement("button");
            playBtn.className = "voice-play-btn";
            playBtn.textContent = "▶";
            playBtn.onclick = function() { playVoice(m.fileUrl, playBtn); };
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
        time.textContent = new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
        bubble.appendChild(time);
        row.appendChild(bubble);
        container.appendChild(row);
    });
    container.scrollTop = container.scrollHeight;
}

function sendTextMessage() {
    var input = document.getElementById("msgInput");
    var msg = input.value.trim();
    if (!msg || !chatToken) return;
    input.value = "";
    fetch("/api/chat/send", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({token: chatToken, message: msg, type: "text"})
    }).then(function(r) { return r.json() }).then(function(d) {
        if (d.success) loadMessages();
    });
}

function handleFileUpload(event) {
    var file = event.target.files[0];
    if (!file || !chatToken) return;
    var formData = new FormData();
    formData.append("photo", file);
    fetch("/api/chat/upload?token=" + encodeURIComponent(chatToken), {
        method: "POST",
        body: formData
    }).then(function(r) { return r.json() }).then(function(d) {
        if (d.success) {
            fetch("/api/chat/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({token: chatToken, message: "📷 Photo", type: "image", fileUrl: d.fileUrl})
            }).then(function(r) { return r.json() }).then(function(d2) {
                if (d2.success) loadMessages();
            });
        }
    });
    event.target.value = "";
}

function startRecording() {
    navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
        mediaRecorder.onstop = function() {
            var audioBlob = new Blob(audioChunks, {type: "audio/webm"});
            uploadVoice(audioBlob);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();
        document.getElementById("micBtn").classList.add("recording");
        document.getElementById("recordingTimer").style.display = "inline";
        recordingTimerInterval = setInterval(function() {
            var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            document.getElementById("recordingTimer").textContent = formatTime(elapsed);
        }, 500);
    }).catch(function() {
        alert("Microphone access denied");
    });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });
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
    fetch("/api/chat/upload-voice?token=" + encodeURIComponent(chatToken), {
        method: "POST",
        body: formData
    }).then(function(r) { return r.json() }).then(function(d) {
        if (d.success) {
            fetch("/api/chat/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({token: chatToken, message: "🎤 Voice", type: "voice", fileUrl: d.fileUrl, duration: window._lastVoiceDuration || 0})
            }).then(function(r) { return r.json() }).then(function(d2) {
                if (d2.success) loadMessages();
            });
        }
    });
}

function playVoice(url, btn) {
    var player = document.getElementById("voicePlayer");
    if (player.src === url && !player.paused) {
        player.pause();
        btn.textContent = "▶";
        return;
    }
    player.src = url;
    player.play();
    btn.textContent = "⏸";
    player.onended = function() { btn.textContent = "▶"; };
    player.onpause = function() { btn.textContent = "▶"; };
}

function showImagePreview(url) {
    document.getElementById("previewImg").src = url;
    document.getElementById("imagePreview").style.display = "flex";
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 2000);
}
</script>
</body>
</html>`;
}

module.exports = { getChatPageHTML };

// chat.js - Premium Chat Module for Verification Hub
function getChatPageHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#ffffff">
    <title>Chat - Baiilla Maach Official</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root{--bg:#f8f9ff;--white:#ffffff;--text:#1a1a2e;--text2:#6b7280;--purple:#8b5cf6;--purple-dark:#6d28d9;--green:#10b981;--red:#ef4444;--border:#e5e7eb}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
        
        .chat-header{background:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,0.08);z-index:100}
        .back-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;text-decoration:none}
        .user-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2.5px solid var(--purple);flex-shrink:0}
        .user-info{flex:1;min-width:0}
        .user-name{font-weight:700;font-size:16px;color:var(--text)}
        .user-status{font-size:12px;color:var(--green);display:flex;align-items:center;gap:5px;font-weight:600}
        .online-dot{width:8px;height:8px;background:var(--green);border-radius:50%;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        
        .messages-container{flex:1;overflow-y:auto;padding:16px;background:linear-gradient(180deg,#f8f9ff,#f0f1ff,#f8f9ff);-webkit-overflow-scrolling:touch}
        .msg-row{margin-bottom:8px;display:flex;animation:msgIn 0.3s ease}
        @keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .msg-row.user{justify-content:flex-end}
        .msg-row.support{justify-content:flex-start}
        .bubble{max-width:78%;padding:12px 16px;border-radius:20px;font-size:14px;line-height:1.55;word-wrap:break-word}
        .msg-row.user .bubble{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border-bottom-right-radius:6px;box-shadow:0 4px 15px rgba(139,92,246,0.25)}
        .msg-row.support .bubble{background:#fff;color:var(--text);border-bottom-left-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
        .msg-time{font-size:10px;opacity:0.7;margin-top:6px}
        .msg-row.user .msg-time{color:rgba(255,255,255,0.8)}
        .msg-row.support .msg-time{color:#9ca3af}
        .bubble img{max-width:220px;max-height:220px;border-radius:12px;cursor:pointer;display:block}
        
        .input-area{background:#fff;padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:10px;border-top:1px solid var(--border);box-shadow:0 -2px 20px rgba(0,0,0,0.04)}
        .attach-btn{background:#f3f4f6;color:var(--purple);border:2px solid #e5e7eb;width:42px;height:42px;border-radius:50%;font-size:20px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .msg-input{flex:1;padding:12px 16px;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:9999px;font-size:14px;font-family:inherit;outline:none;resize:none;max-height:120px;min-height:42px;line-height:1.4}
        .msg-input:focus{border-color:var(--purple);background:#fff;box-shadow:0 0 0 4px rgba(139,92,246,0.08)}
        .send-btn{background:linear-gradient(135deg,var(--purple),var(--purple-dark));color:#fff;border:none;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
        .send-btn:disabled{opacity:0.5;cursor:not-allowed;box-shadow:none}
        .send-btn.sending{animation:spin 0.6s linear infinite}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;opacity:0.5;text-align:center;padding:40px}
        .empty-state-icon{font-size:64px;margin-bottom:16px}
        .empty-state-text{font-size:15px;font-weight:500;color:var(--text2)}
        
        .image-fullscreen{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:1000;align-items:center;justify-content:center;cursor:pointer}
        .image-fullscreen.active{display:flex}
        .image-fullscreen img{max-width:95%;max-height:95%;border-radius:12px}
        
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-120px);background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:13px;z-index:9999;transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);box-shadow:0 10px 40px rgba(0,0,0,0.3)}
        .toast.show{transform:translateX(-50%) translateY(0)}
        .toast.error{background:#ef4444}
        
        @media(max-width:480px){.bubble{max-width:85%}.bubble img{max-width:180px;max-height:180px}}
    </style>
</head>
<body>
    <div class="chat-header">
        <a href="/" class="back-btn">←</a>
        <img src="/assets/tiktok_video_Aj2NO.jpeg" class="user-avatar" alt="Profile" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%238b5cf6%22 width=%22100%22 height=%22100%22 rx=%2220%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22 font-family=%22sans-serif%22>B</text></svg>'">
        <div class="user-info">
            <div class="user-name">Baiilla Maach</div>
            <div class="user-status"><span class="online-dot"></span>Online now</div>
        </div>
    </div>
    
    <div class="messages-container" id="messagesContainer">
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-text">Send a message to start</div>
        </div>
    </div>
    
    <div class="input-area">
        <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFileUpload(event)">
        <button class="attach-btn" onclick="document.getElementById('fileInput').click()" title="Send Photo">📎</button>
        <textarea id="messageInput" class="msg-input" placeholder="Type a message..." rows="1" oninput="updateSendButton()" onkeypress="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>➤</button>
    </div>
    
    <div class="image-fullscreen" id="imageFullscreen" onclick="this.classList.remove('active')">
        <img id="fullscreenImg" src="" alt="Preview">
    </div>
    
    <div class="toast" id="toast"></div>
    
    <script>
        var token = null;
        var chatId = null;
        var isLoading = false;
        
        // Initialize
        function init() {
            var params = new URLSearchParams(window.location.search);
            token = params.get('token') || localStorage.getItem('chatToken');
            chatId = params.get('chatId') || localStorage.getItem('chatId');
            
            if (!token || !chatId) {
                autoRegister();
            } else {
                localStorage.setItem('chatToken', token);
                localStorage.setItem('chatId', chatId);
                loadMessages();
                setInterval(loadMessages, 3000);
            }
        }
        
        // Auto register
        function autoRegister() {
            var name = 'Guest_' + Math.random().toString(36).substr(2, 5);
            var email = 'guest_' + Date.now() + '@chat.com';
            
            fetch('/api/chat/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: name, phoneEmail: email})
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success) {
                    token = d.token;
                    chatId = d.chatId;
                    localStorage.setItem('chatToken', token);
                    localStorage.setItem('chatId', chatId);
                    loadMessages();
                    setInterval(loadMessages, 3000);
                } else {
                    showToast('Connection failed. Refresh page.', 'error');
                }
            })
            .catch(function(e) {
                console.error('Register error:', e);
                showToast('Network error. Check connection.', 'error');
            });
        }
        
        // Load messages
        function loadMessages() {
            if (!token || isLoading) return;
            
            fetch('/api/chat/messages?token=' + token)
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.success) return;
                
                var container = document.getElementById('messagesContainer');
                var wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                
                if (!d.messages || d.messages.length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">Send a message to start</div></div>';
                    return;
                }
                
                var html = '';
                for (var i = 0; i < d.messages.length; i++) {
                    var m = d.messages[i];
                    var cls = m.sender === 'user' ? 'user' : 'support';
                    var content = escapeHtml(m.message || '');
                    
                    if (m.type === 'image' && m.fileUrl) {
                        content = '<img src="' + m.fileUrl + '" onclick="showFullImage(\'' + m.fileUrl + '\')" loading="lazy">';
                    }
                    
                    var time = new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                    html += '<div class="msg-row ' + cls + '"><div class="bubble">' + content + '<div class="msg-time">' + time + '</div></div></div>';
                }
                
                container.innerHTML = html;
                
                if (wasAtBottom) {
                    container.scrollTop = container.scrollHeight;
                }
            })
            .catch(function(e) {
                console.error('Load messages error:', e);
            });
        }
        
        // Send message
        function sendMessage() {
            var input = document.getElementById('messageInput');
            var msg = input.value.trim();
            var sendBtn = document.getElementById('sendBtn');
            
            if (!msg || !token || isLoading) return;
            
            isLoading = true;
            sendBtn.disabled = true;
            sendBtn.textContent = '⟳';
            sendBtn.classList.add('sending');
            
            fetch('/api/chat/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    token: token,
                    message: msg,
                    type: 'text'
                })
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                input.value = '';
                updateSendButton();
                isLoading = false;
                sendBtn.textContent = '➤';
                sendBtn.classList.remove('sending');
                
                if (d.success) {
                    loadMessages();
                } else {
                    showToast('Failed to send. Try again.', 'error');
                }
            })
            .catch(function(e) {
                console.error('Send error:', e);
                isLoading = false;
                sendBtn.textContent = '➤';
                sendBtn.classList.remove('sending');
                sendBtn.disabled = false;
                showToast('Network error. Check connection.', 'error');
            });
        }
        
        // Handle file upload
        function handleFileUpload(event) {
            var file = event.target.files[0];
            if (!file || !token) return;
            
            if (file.size > 10 * 1024 * 1024) {
                showToast('File too large. Max 10MB.', 'error');
                event.target.value = '';
                return;
            }
            
            showToast('Uploading photo...');
            
            var formData = new FormData();
            formData.append('photo', file);
            
            fetch('/api/chat/upload?token=' + token, {
                method: 'POST',
                body: formData
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success && d.fileUrl) {
                    // Send as image message
                    return fetch('/api/chat/send', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            token: token,
                            message: '📷 Photo',
                            type: 'image',
                            fileUrl: d.fileUrl
                        })
                    });
                } else {
                    throw new Error('Upload failed');
                }
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success) {
                    showToast('Photo sent!');
                    loadMessages();
                }
            })
            .catch(function(e) {
                console.error('Upload error:', e);
                showToast('Upload failed. Try again.', 'error');
            });
            
            event.target.value = '';
        }
        
        // Update send button state
        function updateSendButton() {
            var input = document.getElementById('messageInput');
            var sendBtn = document.getElementById('sendBtn');
            if (!isLoading) {
                sendBtn.disabled = !input.value.trim();
            }
        }
        
        // Show full image
        function showFullImage(url) {
            document.getElementById('fullscreenImg').src = url;
            document.getElementById('imageFullscreen').classList.add('active');
        }
        
        // Show toast
        function showToast(message, type) {
            var toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast show';
            if (type === 'error') {
                toast.className = 'toast show error';
            }
            
            if (toast._timeout) clearTimeout(toast._timeout);
            toast._timeout = setTimeout(function() {
                toast.classList.remove('show');
            }, 2500);
        }
        
        // Escape HTML
        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Initialize on load
        init();
    </script>
</body>
</html>`;
}

module.exports = { getChatPageHTML };

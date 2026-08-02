// chat.js
function getChatPageHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#0f0f1a">
    <title>Chat with Baiilla Maach</title>
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
            --glass-border: rgba(255, 255, 255, 0.06);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: var(--bg);
            color: var(--text);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .chat-header {
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
            position: relative;
            z-index: 10;
        }
        
        .back-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
        }
        
        .back-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
        }
        
        .chat-avatar {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.3);
            object-fit: cover;
        }
        
        .chat-header-info {
            flex: 1;
        }
        
        .chat-header-name {
            font-weight: 700;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .verified-badge {
            width: 18px;
            height: 18px;
        }
        
        .chat-header-status {
            font-size: 11px;
            opacity: 0.8;
            margin-top: 2px;
        }
        
        .online-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            display: inline-block;
            margin-right: 4px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: var(--bg);
            scroll-behavior: smooth;
        }
        
        .message {
            margin-bottom: 16px;
            display: flex;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message.user {
            justify-content: flex-end;
        }
        
        .message.admin {
            justify-content: flex-start;
        }
        
        .message-bubble {
            max-width: 75%;
            padding: 12px 16px;
            border-radius: 20px;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
            position: relative;
        }
        
        .message.user .message-bubble {
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            color: white;
            border-bottom-right-radius: 4px;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }
        
        .message.admin .message-bubble {
            background: var(--surface2);
            color: var(--text);
            border-bottom-left-radius: 4px;
            border: 1px solid var(--glass-border);
        }
        
        .message-time {
            font-size: 10px;
            opacity: 0.6;
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .message.user .message-time {
            justify-content: flex-end;
        }
        
        .message-image {
            max-width: 250px;
            max-height: 250px;
            border-radius: 12px;
            cursor: pointer;
            display: block;
            transition: transform 0.3s;
        }
        
        .message-image:hover {
            transform: scale(1.02);
        }
        
        .voice-message {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 5px 0;
        }
        
        .voice-play-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.3s;
        }
        
        .voice-play-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .voice-waveform {
            display: flex;
            align-items: center;
            gap: 2px;
            flex: 1;
            height: 24px;
        }
        
        .voice-bar {
            width: 3px;
            background: #8b5cf6;
            border-radius: 2px;
            animation: voiceAnim 1s ease-in-out infinite;
        }
        
        @keyframes voiceAnim {
            0%, 100% { transform: scaleY(0.3); }
            50% { transform: scaleY(1); }
        }
        
        .voice-duration {
            font-size: 11px;
            opacity: 0.6;
            flex-shrink: 0;
        }
        
        .chat-input-area {
            background: var(--surface);
            padding: 16px;
            display: flex;
            gap: 10px;
            align-items: center;
            border-top: 1px solid var(--glass-border);
        }
        
        .chat-input {
            flex: 1;
            padding: 12px 18px;
            background: var(--surface2);
            border: 1px solid var(--glass-border);
            border-radius: 25px;
            color: var(--text);
            font-size: 14px;
            outline: none;
            transition: all 0.3s;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        
        .chat-input:focus {
            border-color: var(--purple);
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
        }
        
        .chat-input::placeholder {
            color: var(--text3);
        }
        
        .action-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            flex-shrink: 0;
        }
        
        .attach-btn {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text2);
        }
        
        .attach-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }
        
        .voice-btn {
            background: rgba(139, 92, 246, 0.2);
            color: var(--purple2);
        }
        
        .voice-btn:hover {
            background: rgba(139, 92, 246, 0.3);
            transform: scale(1.05);
        }
        
        .voice-btn.recording {
            background: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            animation: recordPulse 1s infinite;
        }
        
        @keyframes recordPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
        
        .send-btn {
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            color: white;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }
        
        .send-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(236, 72, 153, 0.5);
        }
        
        .registration-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(10px);
        }
        
        .registration-form {
            background: var(--surface);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 30px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        
        .registration-form h2 {
            font-size: 24px;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #c4b5fd, #f9a8d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .registration-form p {
            color: var(--text3);
            font-size: 13px;
            margin-bottom: 24px;
        }
        
        .form-input {
            width: 100%;
            padding: 14px 18px;
            background: var(--surface2);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            color: var(--text);
            font-size: 14px;
            margin-bottom: 16px;
            outline: none;
            font-family: 'Plus Jakarta Sans', sans-serif;
            transition: all 0.3s;
        }
        
        .form-input:focus {
            border-color: var(--purple);
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
        }
        
        .form-submit {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            color: white;
            border: none;
            border-radius: 16px;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        
        .form-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4);
        }
        
        .image-preview-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        
        .image-preview-overlay img {
            max-width: 95%;
            max-height: 95%;
            border-radius: 12px;
        }
        
        .typing-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 12px 16px;
            background: var(--surface2);
            border-radius: 20px;
            border-bottom-left-radius: 4px;
            width: fit-content;
            margin-bottom: 16px;
        }
        
        .typing-dot {
            width: 8px;
            height: 8px;
            background: var(--purple);
            border-radius: 50%;
            animation: typingBounce 1.4s infinite;
        }
        
        .typing-dot:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .typing-dot:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes typingBounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-8px); }
        }
        
        @media (max-width: 640px) {
            .chat-messages {
                padding: 12px;
            }
            
            .message-bubble {
                max-width: 85%;
                font-size: 13px;
            }
            
            .chat-input-area {
                padding: 12px;
            }
        }
    </style>
</head>
<body>
    <div id="registrationOverlay" class="registration-overlay">
        <div class="registration-form">
            <h2>💬 Start Chat</h2>
            <p>Enter your details to start chatting with Baiilla Maach</p>
            <input type="text" id="regName" class="form-input" placeholder="Your Name" autocomplete="off">
            <input type="text" id="regContact" class="form-input" placeholder="Phone or Email" autocomplete="off">
            <button onclick="registerUser()" class="form-submit">Start Chatting</button>
        </div>
    </div>

    <div class="chat-header">
        <button class="back-btn" onclick="window.close()">←</button>
        <img src="/assets/tiktok_video_Aj2NO.jpeg" class="chat-avatar" alt="Baiilla Maach">
        <div class="chat-header-info">
            <div class="chat-header-name">
                Baiilla Maach Official
                <img src="/assets/social-media.png" class="verified-badge" alt="Verified">
            </div>
            <div class="chat-header-status">
                <span class="online-dot"></span>
                Online
            </div>
        </div>
    </div>

    <div class="chat-messages" id="chatMessages">
        <div style="text-align: center; color: var(--text3); padding: 30px; font-size: 13px;">
            <div style="font-size: 40px; margin-bottom: 10px;">💬</div>
            <div>Start your conversation</div>
            <div style="font-size: 11px; margin-top: 5px; opacity: 0.6;">Messages are end-to-end encrypted</div>
        </div>
    </div>

    <div class="chat-input-area">
        <input type="file" id="fileInput" accept="image/*" style="display: none" onchange="handleFileUpload(event)">
        <button class="action-btn attach-btn" onclick="document.getElementById('fileInput').click()" title="Attach Photo">
            📎
        </button>
        
        <input type="text" id="messageInput" class="chat-input" placeholder="Type a message..." 
               onkeypress="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }">
        
        <button class="action-btn voice-btn" id="voiceRecordBtn" 
                onmousedown="startRecording()" 
                onmouseup="stopRecording()" 
                onmouseleave="stopRecording()"
                ontouchstart="startRecording()"
                ontouchend="stopRecording()"
                title="Hold to record voice">
            🎤
        </button>
        
        <button class="action-btn send-btn" onclick="sendMessage()" title="Send Message">
            ➤
        </button>
    </div>

    <audio id="audioPlayer" style="display: none"></audio>
    
    <div class="image-preview-overlay" id="imagePreview" style="display: none" onclick="this.style.display='none'">
        <img id="previewImage" src="" alt="Preview">
    </div>

    <script>
        let chatToken = localStorage.getItem('chatToken');
        let chatId = localStorage.getItem('chatId');
        let userName = localStorage.getItem('userName');
        let isRecording = false;
        let mediaRecorder;
        let audioChunks = [];
        
        // Check if user is already registered
        async function checkSession() {
            if (chatToken) {
                try {
                    const response = await fetch('/api/chat/verify?token=' + chatToken);
                    const data = await response.json();
                    if (data.success) {
                        chatId = data.chatId;
                        document.getElementById('registrationOverlay').style.display = 'none';
                        loadMessages();
                        setInterval(loadMessages, 3000);
                        return;
                    }
                } catch (e) {
                    console.error('Session check failed:', e);
                }
            }
            // Show registration if not authenticated
            document.getElementById('registrationOverlay').style.display = 'flex';
        }
        
        // Register new user
        async function registerUser() {
            const name = document.getElementById('regName').value.trim();
            const contact = document.getElementById('regContact').value.trim();
            
            if (!name || !contact) {
                alert('Please fill in all fields');
                return;
            }
            
            try {
                const response = await fetch('/api/chat/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, phoneEmail: contact })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    chatToken = data.token;
                    chatId = data.chatId;
                    userName = data.name;
                    
                    localStorage.setItem('chatToken', chatToken);
                    localStorage.setItem('chatId', chatId);
                    localStorage.setItem('userName', userName);
                    
                    document.getElementById('registrationOverlay').style.display = 'none';
                    loadMessages();
                    setInterval(loadMessages, 3000);
                } else {
                    alert('Registration failed: ' + data.error);
                }
            } catch (e) {
                alert('Connection error. Please try again.');
                console.error('Registration error:', e);
            }
        }
        
        // Load messages
        async function loadMessages() {
            if (!chatToken) return;
            
            try {
                const response = await fetch('/api/chat/messages?token=' + chatToken);
                const data = await response.json();
                
                if (data.success && data.messages) {
                    renderMessages(data.messages);
                }
            } catch (e) {
                console.error('Load messages error:', e);
            }
        }
        
        // Render messages
        function renderMessages(messages) {
            const container = document.getElementById('chatMessages');
            let html = '';
            
            if (messages.length === 0) {
                html = '<div style="text-align: center; color: var(--text3); padding: 30px; font-size: 13px;">' +
                       '<div style="font-size: 40px; margin-bottom: 10px;">💬</div>' +
                       '<div>No messages yet</div>' +
                       '</div>';
            } else {
                messages.forEach(msg => {
                    const senderClass = msg.sender === 'user' ? 'user' : 'admin';
                    const time = formatTime(msg.createdAt);
                    
                    html += '<div class="message ' + senderClass + '">';
                    html += '<div class="message-bubble">';
                    
                    if (msg.type === 'image' && msg.fileUrl) {
                        html += '<img src="' + msg.fileUrl + '" class="message-image" ' +
                                'onclick="showImagePreview(\'' + msg.fileUrl + '\')" alt="Photo">';
                    } else if (msg.type === 'voice' && msg.fileUrl) {
                        html += '<div class="voice-message">';
                        html += '<button class="voice-play-btn" onclick="playVoice(\'' + msg.fileUrl + '\', this)">▶</button>';
                        html += '<div class="voice-waveform">';
                        for (let i = 0; i < 12; i++) {
                            const delay = (i * 0.1).toFixed(1);
                            const height = 8 + Math.floor(Math.random() * 14);
                            html += '<div class="voice-bar" style="animation-delay:' + delay + 's;height:' + height + 'px"></div>';
                        }
                        html += '</div>';
                        if (msg.duration) {
                            const mins = Math.floor(msg.duration / 60);
                            const secs = Math.floor(msg.duration % 60);
                            html += '<span class="voice-duration">' + mins + ':' + String(secs).padStart(2, '0') + '</span>';
                        }
                        html += '</div>';
                    } else {
                        html += '<div>' + escapeHtml(msg.message) + '</div>';
                    }
                    
                    html += '<div class="message-time">' + time + '</div>';
                    html += '</div></div>';
                });
            }
            
            container.innerHTML = html;
            container.scrollTop = container.scrollHeight;
        }
        
        // Send message
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message || !chatToken) return;
            
            try {
                await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: chatToken,
                        message: message,
                        type: 'text'
                    })
                });
                
                input.value = '';
                loadMessages();
            } catch (e) {
                console.error('Send message error:', e);
            }
        }
        
        // Handle file upload
        async function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file || !chatToken) return;
            
            const formData = new FormData();
            formData.append('photo', file);
            
            try {
                const response = await fetch('/api/chat/upload?token=' + chatToken, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Send as image message
                    await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: chatToken,
                            message: '📷 Photo',
                            type: 'image',
                            fileUrl: data.fileUrl
                        })
                    });
                    
                    loadMessages();
                }
            } catch (e) {
                console.error('Upload error:', e);
            }
            
            event.target.value = '';
        }
        
        // Start voice recording
        async function startRecording() {
            if (!chatToken) return;
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('voice', audioBlob, 'voice.webm');
                    
                    try {
                        const response = await fetch('/api/chat/upload-voice?token=' + chatToken, {
                            method: 'POST',
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            await fetch('/api/chat/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    token: chatToken,
                                    message: '🎤 Voice Message',
                                    type: 'voice',
                                    fileUrl: data.fileUrl,
                                    duration: Math.floor(audioChunks.length / 10)
                                })
                            });
                            
                            loadMessages();
                        }
                    } catch (e) {
                        console.error('Voice upload error:', e);
                    }
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                isRecording = true;
                document.getElementById('voiceRecordBtn').classList.add('recording');
                
                // Auto stop after 60 seconds
                setTimeout(() => {
                    if (isRecording) stopRecording();
                }, 60000);
                
            } catch (e) {
                console.error('Recording error:', e);
                alert('Microphone access denied');
            }
        }
        
        // Stop voice recording
        function stopRecording() {
            if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                isRecording = false;
                document.getElementById('voiceRecordBtn').classList.remove('recording');
            }
        }
        
        // Play voice message
        function playVoice(url, button) {
            const player = document.getElementById('audioPlayer');
            
            if (player.src === url && !player.paused) {
                player.pause();
                button.textContent = '▶';
                return;
            }
            
            player.src = url;
            player.play();
            button.textContent = '⏸';
            
            player.onended = () => {
                button.textContent = '▶';
            };
            
            player.onpause = () => {
                button.textContent = '▶';
            };
        }
        
        // Show image preview
        function showImagePreview(url) {
            document.getElementById('previewImage').src = url;
            document.getElementById('imagePreview').style.display = 'flex';
        }
        
        // Format time
        function formatTime(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Initialize
        checkSession();
    </script>
</body>
</html>`;
}

module.exports = { getChatPageHTML };

// chat.js - Premium Chat Module for Verification Hub
function getChatPageHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#ffffff">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Chat - Baiilla Maach Official</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f8f9ff;
            --white: #ffffff;
            --text: #1a1a2e;
            --text2: #6b7280;
            --text3: #9ca3af;
            --purple: #8b5cf6;
            --purple-dark: #6d28d9;
            --purple-light: #a78bfa;
            --pink: #ec4899;
            --green: #10b981;
            --red: #ef4444;
            --border: #e5e7eb;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
            --shadow-md: 0 4px 20px rgba(0,0,0,0.1);
            --shadow-lg: 0 10px 40px rgba(139,92,246,0.15);
            --shadow-xl: 0 20px 60px rgba(0,0,0,0.15);
            --radius: 16px;
            --radius-lg: 24px;
            --radius-full: 9999px;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg);
            color: var(--text);
            height: 100vh;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            letter-spacing: -0.2px;
        }
        
        /* Premium Header */
        .chat-header {
            background: var(--white);
            padding: 14px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
            position: relative;
            z-index: 100;
            backdrop-filter: blur(20px);
        }
        
        .back-btn {
            background: linear-gradient(135deg, var(--purple), var(--purple-dark));
            color: white;
            border: none;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 10px rgba(139,92,246,0.3);
            transition: all 0.3s ease;
        }
        
        .back-btn:active {
            transform: scale(0.95);
            box-shadow: 0 1px 5px rgba(139,92,246,0.2);
        }
        
        .user-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            object-fit: cover;
            border: 2.5px solid var(--purple);
            flex-shrink: 0;
            box-shadow: 0 0 0 4px rgba(139,92,246,0.1);
        }
        
        .user-info {
            flex: 1;
            min-width: 0;
        }
        
        .user-name {
            font-weight: 700;
            font-size: 16px;
            color: var(--text);
            letter-spacing: -0.3px;
        }
        
        .user-status {
            font-size: 12px;
            color: var(--green);
            display: flex;
            align-items: center;
            gap: 5px;
            font-weight: 600;
        }
        
        .online-dot {
            width: 8px;
            height: 8px;
            background: var(--green);
            border-radius: 50%;
            animation: pulse 2s infinite;
            box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
        }
        
        .header-actions {
            display: flex;
            gap: 6px;
        }
        
        .header-action-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            background: #f3f4f6;
            color: var(--text2);
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .header-action-btn:active {
            background: #e5e7eb;
            transform: scale(0.95);
        }
        
        /* Messages Area */
        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: linear-gradient(180deg, #f8f9ff 0%, #f0f1ff 50%, #f8f9ff 100%);
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
        
        .messages-container::-webkit-scrollbar {
            width: 4px;
        }
        
        .messages-container::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .messages-container::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 2px;
        }
        
        /* Date separator */
        .date-separator {
            text-align: center;
            margin: 20px 0;
            position: relative;
        }
        
        .date-separator span {
            background: #f8f9ff;
            padding: 6px 16px;
            border-radius: var(--radius-full);
            font-size: 11px;
            font-weight: 600;
            color: var(--text3);
            border: 1px solid var(--border);
            position: relative;
            z-index: 1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* Message Bubbles */
        .msg-row {
            margin-bottom: 8px;
            display: flex;
            animation: messageIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            padding: 0 4px;
        }
        
        @keyframes messageIn {
            from {
                opacity: 0;
                transform: translateY(16px) scale(0.96);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .msg-row.user {
            justify-content: flex-end;
        }
        
        .msg-row.support {
            justify-content: flex-start;
        }
        
        .bubble {
            max-width: 78%;
            padding: 12px 16px;
            border-radius: 20px;
            font-size: 14px;
            line-height: 1.55;
            word-wrap: break-word;
            position: relative;
            font-weight: 400;
            transition: all 0.2s;
        }
        
        .msg-row.user .bubble {
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
            color: #ffffff;
            border-bottom-right-radius: 6px;
            box-shadow: 0 4px 15px rgba(139,92,246,0.25);
            font-weight: 500;
        }
        
        .msg-row.support .bubble {
            background: var(--white);
            color: var(--text);
            border-bottom-left-radius: 6px;
            box-shadow: var(--shadow-sm);
            font-weight: 500;
        }
        
        .msg-time {
            font-size: 10px;
            opacity: 0.7;
            margin-top: 6px;
            font-weight: 500;
            letter-spacing: 0.2px;
        }
        
        .msg-row.user .msg-time {
            text-align: right;
            color: rgba(255,255,255,0.8);
        }
        
        .msg-row.support .msg-time {
            color: var(--text3);
        }
        
        .msg-read {
            font-size: 12px;
            margin-left: 4px;
        }
        
        /* Image in bubble */
        .bubble img {
            max-width: 240px;
            max-height: 240px;
            border-radius: 12px;
            cursor: pointer;
            display: block;
            transition: transform 0.3s;
        }
        
        .bubble img:active {
            transform: scale(0.98);
        }
        
        /* Voice bubble */
        .voice-bubble {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 160px;
        }
        
        .voice-play-btn {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: rgba(255,255,255,0.25);
            border: 2px solid rgba(255,255,255,0.4);
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .voice-play-btn:active {
            transform: scale(0.9);
            background: rgba(255,255,255,0.4);
        }
        
        .voice-wave {
            display: flex;
            align-items: center;
            gap: 2.5px;
            flex: 1;
            height: 28px;
        }
        
        .voice-bar {
            width: 3px;
            background: rgba(255,255,255,0.8);
            border-radius: 3px;
            animation: voiceAnim 1.2s ease-in-out infinite;
        }
        
        @keyframes voiceAnim {
            0%, 100% { transform: scaleY(1); opacity: 0.7; }
            50% { transform: scaleY(0.25); opacity: 0.3; }
        }
        
        .voice-duration {
            font-size: 11px;
            opacity: 0.8;
            font-weight: 500;
            min-width: 35px;
            text-align: right;
        }
        
        /* Support voice bubble */
        .msg-row.support .voice-play-btn {
            background: rgba(139,92,246,0.15);
            border-color: rgba(139,92,246,0.3);
            color: var(--purple);
        }
        
        .msg-row.support .voice-bar {
            background: var(--purple-light);
        }
        
        /* Input Area */
        .input-area {
            background: var(--white);
            padding: 12px 16px;
            padding-bottom: max(12px, env(safe-area-inset-bottom));
            display: flex;
            align-items: flex-end;
            gap: 10px;
            border-top: 1px solid var(--border);
            box-shadow: 0 -2px 20px rgba(0,0,0,0.04);
            position: relative;
            z-index: 100;
        }
        
        .attach-btn {
            background: #f3f4f6;
            color: var(--purple);
            border: 2px solid #e5e7eb;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.2s;
        }
        
        .attach-btn:active {
            background: var(--purple);
            color: white;
            border-color: var(--purple);
            transform: scale(0.95);
        }
        
        .voice-record-btn {
            background: #f3f4f6;
            color: var(--purple);
            border: 2px solid #e5e7eb;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.2s;
        }
        
        .voice-record-btn.recording {
            background: var(--red);
            color: white;
            border-color: var(--red);
            animation: recordingPulse 1.5s infinite;
            box-shadow: 0 0 0 8px rgba(239,68,68,0.2);
        }
        
        @keyframes recordingPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
            50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
        }
        
        .msg-input {
            flex: 1;
            padding: 12px 16px;
            background: #f3f4f6;
            border: 2px solid #e5e7eb;
            border-radius: var(--radius-full);
            font-size: 14px;
            font-family: inherit;
            font-weight: 400;
            outline: none;
            resize: none;
            max-height: 120px;
            min-height: 42px;
            transition: all 0.3s ease;
            line-height: 1.4;
            color: var(--text);
        }
        
        .msg-input:focus {
            border-color: var(--purple);
            background: var(--white);
            box-shadow: 0 0 0 4px rgba(139,92,246,0.08);
        }
        
        .msg-input::placeholder {
            color: var(--text3);
            font-weight: 400;
        }
        
        .send-btn {
            background: linear-gradient(135deg, var(--purple), var(--purple-dark));
            color: white;
            border: none;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 15px rgba(139,92,246,0.3);
            transition: all 0.2s;
        }
        
        .send-btn:active {
            transform: scale(0.92);
            box-shadow: 0 2px 8px rgba(139,92,246,0.2);
        }
        
        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        }
        
        /* Permission Modal */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 999;
            align-items: flex-end;
            justify-content: center;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.3s;
        }
        
        .modal-overlay.active {
            display: flex;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .modal-sheet {
            background: var(--white);
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            padding: 28px 24px;
            padding-bottom: max(28px, env(safe-area-inset-bottom));
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: var(--shadow-xl);
            animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        
        .modal-handle {
            width: 36px;
            height: 5px;
            background: #d1d5db;
            border-radius: 3px;
            margin: 0 auto 20px;
        }
        
        .modal-icon {
            font-size: 56px;
            margin-bottom: 16px;
            animation: bounce 0.6s;
        }
        
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            40% { transform: translateY(-20px); }
            60% { transform: translateY(-10px); }
        }
        
        .modal-title {
            font-weight: 700;
            font-size: 20px;
            color: var(--text);
            margin-bottom: 8px;
            letter-spacing: -0.3px;
        }
        
        .modal-text {
            font-size: 14px;
            color: var(--text2);
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .modal-actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, var(--purple), var(--purple-dark));
            color: white;
            border: none;
            padding: 14px;
            border-radius: var(--radius);
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            font-family: inherit;
            box-shadow: 0 4px 15px rgba(139,92,246,0.3);
            transition: all 0.2s;
            letter-spacing: -0.2px;
        }
        
        .btn-primary:active {
            transform: scale(0.98);
            box-shadow: 0 2px 8px rgba(139,92,246,0.2);
        }
        
        .btn-secondary {
            background: transparent;
            color: var(--text2);
            border: 1.5px solid var(--border);
            padding: 14px;
            border-radius: var(--radius);
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
        }
        
        .btn-secondary:active {
            background: #f3f4f6;
        }
        
        /* Fullscreen Image Preview */
        .image-fullscreen {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 1000;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            animation: fadeIn 0.2s;
        }
        
        .image-fullscreen.active {
            display: flex;
        }
        
        .image-fullscreen img {
            max-width: 95%;
            max-height: 95%;
            border-radius: 12px;
            box-shadow: var(--shadow-xl);
        }
        
        .image-fullscreen-close {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* Recording indicator */
        .recording-indicator {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 20px 30px;
            border-radius: var(--radius-lg);
            z-index: 998;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            align-items: center;
            gap: 12px;
        }
        
        .recording-indicator.active {
            display: flex;
        }
        
        .recording-dot {
            width: 12px;
            height: 12px;
            background: var(--red);
            border-radius: 50%;
            animation: recordingPulse 0.8s infinite;
        }
        
        .recording-timer {
            font-size: 24px;
            font-weight: 700;
        }
        
        /* Empty state */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            opacity: 0.5;
            text-align: center;
            padding: 40px;
        }
        
        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 16px;
        }
        
        .empty-state-text {
            font-size: 15px;
            font-weight: 500;
            color: var(--text2);
        }
        
        /* Toast */
        .toast {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-120px);
            background: var(--text);
            color: white;
            padding: 12px 24px;
            border-radius: var(--radius-full);
            font-weight: 600;
            font-size: 13px;
            z-index: 9999;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: var(--shadow-lg);
            letter-spacing: -0.2px;
        }
        
        .toast.show {
            transform: translateX(-50%) translateY(0);
        }
        
        /* Responsive */
        @media (max-width: 480px) {
            .bubble {
                max-width: 85%;
            }
            
            .bubble img {
                max-width: 200px;
                max-height: 200px;
            }
            
            .chat-header {
                padding: 12px 14px;
            }
            
            .input-area {
                padding: 10px 12px;
                padding-bottom: max(10px, env(safe-area-inset-bottom));
                gap: 8px;
            }
            
            .user-name {
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="chat-header">
        <button class="back-btn" onclick="goBack()">←</button>
        <img src="/assets/tiktok_video_Aj2NO.jpeg" class="user-avatar" alt="Baiilla Maach" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%238b5cf6%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22 font-family=%22sans-serif%22>B</text></svg>'">
        <div class="user-info">
            <div class="user-name">Baiilla Maach</div>
            <div class="user-status"><span class="online-dot"></span>Online now</div>
        </div>
        <div class="header-actions">
            <button class="header-action-btn" onclick="scrollToBottom()" title="Scroll down">↓</button>
        </div>
    </div>
    
    <!-- Messages -->
    <div class="messages-container" id="messagesContainer">
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-text">Send a message to start conversation</div>
        </div>
    </div>
    
    <!-- Recording Indicator -->
    <div class="recording-indicator" id="recordingIndicator">
        <div class="recording-dot"></div>
        <span>Recording...</span>
        <span class="recording-timer" id="recordingTimer">00:00</span>
    </div>
    
    <!-- Input Area -->
    <div class="input-area">
        <input type="file" id="fileInput" accept="image/*,video/*" style="display:none" onchange="handleFileUpload(event)">
        <button class="attach-btn" onclick="showAttachmentOptions()">📎</button>
        <textarea id="messageInput" class="msg-input" placeholder="Type a message..." rows="1" 
            oninput="autoResize(this); updateSendButton()"
            onkeypress="handleKeyPress(event)"></textarea>
        <button class="voice-record-btn" id="voiceRecordBtn" onclick="toggleVoiceRecording()" title="Hold to record">🎤</button>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>➤</button>
    </div>
    
    <!-- Permission Modal -->
    <div class="modal-overlay" id="modalOverlay">
        <div class="modal-sheet" id="modalSheet"></div>
    </div>
    
    <!-- Fullscreen Image -->
    <div class="image-fullscreen" id="imageFullscreen">
        <button class="image-fullscreen-close" onclick="closeFullscreen()">✕</button>
        <img id="fullscreenImg" src="" alt="Preview">
    </div>
    
    <!-- Toast -->
    <div class="toast" id="toast"></div>
    
    <script>
        // ============ STATE ============
        let token = null;
        let chatId = null;
        let currentVoice = null;
        let mediaRecorder = null;
        let audioChunks = [];
        let recordingTimer = null;
        let recordingSeconds = 0;
        let isRecording = false;
        
        // ============ INITIALIZATION ============
        function init() {
            // Check URL params first
            const params = new URLSearchParams(window.location.search);
            token = params.get('token');
            chatId = params.get('chatId');
            
            // Then check localStorage
            if (!token) token = localStorage.getItem('chatToken');
            if (!chatId) chatId = localStorage.getItem('chatId');
            
            if (!token || !chatId) {
                // Auto-register if accessed directly
                autoRegister();
                return;
            }
            
            localStorage.setItem('chatToken', token);
            localStorage.setItem('chatId', chatId);
            
            loadMessages();
            setInterval(loadMessages, 3000);
            
            // Initial scroll after load
            setTimeout(scrollToBottom, 500);
        }
        
        async function autoRegister() {
            const name = 'Guest User';
            const phoneEmail = 'guest_' + Date.now() + '@user.com';
            
            try {
                const res = await fetch('/api/chat/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phoneEmail })
                });
                const data = await res.json();
                
                if (data.success) {
                    token = data.token;
                    chatId = data.chatId;
                    localStorage.setItem('chatToken', token);
                    localStorage.setItem('chatId', chatId);
                    loadMessages();
                    setInterval(loadMessages, 3000);
                }
            } catch(e) {
                console.error('Auto-register failed:', e);
                showToast('Connection error. Please try again.');
            }
        }
        
        // ============ MESSAGES ============
        async function loadMessages() {
            if (!token) return;
            
            try {
                const res = await fetch('/api/chat/messages?token=' + token);
                const data = await res.json();
                if (!data.success) return;
                
                const container = document.getElementById('messagesContainer');
                const wasAtBottom = isNearBottom(container);
                
                if (data.messages.length === 0) {
                    container.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-state-icon">💬</div>
                            <div class="empty-state-text">Send a message to start conversation</div>
                        </div>\`;
                    return;
                }
                
                let html = '';
                let lastDate = null;
                
                data.messages.forEach(m => {
                    const msgDate = new Date(m.createdAt).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    
                    // Add date separator
                    if (msgDate !== lastDate) {
                        html += \`<div class="date-separator"><span>\${msgDate}</span></div>\`;
                        lastDate = msgDate;
                    }
                    
                    let cls = m.sender === 'user' ? 'user' : 'support';
                    let content = '';
                    let timeStr = formatTime(m.createdAt);
                    let readIcon = '';
                    
                    if (m.sender === 'user' && m.read) {
                        readIcon = '<span class="msg-read">✓✓</span>';
                    } else if (m.sender === 'user') {
                        readIcon = '<span class="msg-read">✓</span>';
                    }
                    
                    if (m.type === 'image' && m.fileUrl) {
                        content = \`<img src="\${m.fileUrl}" onclick="showFullscreen('\\'\${m.fileUrl}\\'')" loading="lazy" alt="Photo">\`;
                    } else if (m.type === 'voice' && m.fileUrl) {
                        content = \`
                            <div class="voice-bubble">
                                <button class="voice-play-btn" onclick="playVoice('\\'\${m.fileUrl}\\'', this)">▶</button>
                                <div class="voice-wave">\`;
                        for (let i = 0; i < 14; i++) {
                            const h = 8 + Math.floor(Math.random() * 18);
                            content += \`<div class="voice-bar" style="animation-delay:\${i * 0.09}s;height:\${h}px"></div>\`;
                        }
                        content += \`</div>\`;
                        if (m.duration) {
                            content += \`<span class="voice-duration">\${m.duration}s</span>\`;
                        }
                        content += \`</div>\`;
                    } else {
                        content = escapeHtml(m.message || '');
                    }
                    
                    html += \`
                        <div class="msg-row \${cls}">
                            <div class="bubble">
                                \${content}
                                <div class="msg-time">\${timeStr}\${readIcon}</div>
                            </div>
                        </div>\`;
                });
                
                container.innerHTML = html;
                
                if (wasAtBottom) {
                    scrollToBottom();
                }
            } catch(e) {
                console.error('Load messages error:', e);
            }
        }
        
        function isNearBottom(container, threshold = 100) {
            return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        }
        
        function scrollToBottom() {
            const container = document.getElementById('messagesContainer');
            container.scrollTop = container.scrollHeight;
        }
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const msg = input.value.trim();
            if (!msg || !token) return;
            
            // Optimistic UI
            const tempId = 'temp_' + Date.now();
            appendTempMessage(msg, tempId);
            
            input.value = '';
            updateSendButton();
            autoResize(input);
            
            try {
                await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, message: msg, type: 'text' })
                });
                removeTempMessage(tempId);
                loadMessages();
            } catch(e) {
                removeTempMessage(tempId);
                showToast('Failed to send. Retry.');
                input.value = msg;
                updateSendButton();
            }
        }
        
        function appendTempMessage(msg, tempId) {
            const container = document.getElementById('messagesContainer');
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            
            const tempDiv = document.createElement('div');
            tempDiv.id = tempId;
            tempDiv.className = 'msg-row user';
            tempDiv.style.opacity = '0.6';
            tempDiv.innerHTML = \`
                <div class="bubble">
                    \${escapeHtml(msg)}
                    <div class="msg-time">Sending... <span class="msg-read">✓</span></div>
                </div>\`;
            container.appendChild(tempDiv);
            scrollToBottom();
        }
        
        function removeTempMessage(tempId) {
            const el = document.getElementById(tempId);
            if (el) el.remove();
        }
        
        function updateSendButton() {
            const input = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            sendBtn.disabled = !input.value.trim();
        }
        
        function handleKeyPress(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }
        
        function autoResize(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
        
        // ============ FILE UPLOAD ============
        function showAttachmentOptions() {
            showModal(
                '📸',
                'Share Photo',
                'Choose a photo from your gallery to share in this conversation.',
                [
                    { text: 'Choose Photo', class: 'btn-primary', action: 'grantPhotoAccess()' },
                    { text: 'Cancel', class: 'btn-secondary', action: 'closeModal()' }
                ]
            );
        }
        
        function grantPhotoAccess() {
            closeModal();
            document.getElementById('fileInput').click();
        }
        
        async function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file || !token) return;
            
            // Validate file type
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                showToast('Please select an image or video');
                return;
            }
            
            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                showToast('File too large. Max 10MB');
                return;
            }
            
            showToast('Uploading...');
            
            const formData = new FormData();
            formData.append('photo', file);
            
            try {
                const res = await fetch('/api/chat/upload?token=' + token, { 
                    method: 'POST', 
                    body: formData 
                });
                const data = await res.json();
                
                if (data.success) {
                    await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            token, 
                            message: file.type.startsWith('video/') ? '🎥 Video' : '📷 Photo', 
                            type: 'image', 
                            fileUrl: data.fileUrl 
                        })
                    });
                    showToast('Sent!');
                    loadMessages();
                } else {
                    showToast('Upload failed');
                }
            } catch(e) {
                showToast('Upload error');
                console.error(e);
            }
            
            event.target.value = '';
        }
        
        // ============ VOICE RECORDING ============
        async function toggleVoiceRecording() {
            if (isRecording) {
                stopRecording();
                return;
            }
            
            // Request permission
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                startRecording(stream);
            } catch(e) {
                showModal(
                    '🎤',
                    'Microphone Access',
                    'Allow microphone access to send voice messages. Your recordings are only used for this chat.',
                    [
                        { text: 'Allow Access', class: 'btn-primary', action: 'requestMicAgain()' },
                        { text: 'Not Now', class: 'btn-secondary', action: 'closeModal()' }
                    ]
                );
            }
        }
        
        function requestMicAgain() {
            closeModal();
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => startRecording(stream))
                .catch(() => showToast('Microphone access denied'));
        }
        
        function startRecording(stream) {
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await uploadVoice(audioBlob);
            };
            
            mediaRecorder.start();
            isRecording = true;
            recordingSeconds = 0;
            
            // Update UI
            document.getElementById('voiceRecordBtn').classList.add('recording');
            document.getElementById('voiceRecordBtn').textContent = '⏹';
            document.getElementById('recordingIndicator').classList.add('active');
            
            // Start timer
            updateRecordingTimer();
            recordingTimer = setInterval(updateRecordingTimer, 1000);
            
            // Auto stop after 60 seconds
            setTimeout(() => {
                if (isRecording) stopRecording();
            }, 60000);
        }
        
        function stopRecording() {
            if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
            
            mediaRecorder.stop();
            isRecording = false;
            
            // Reset UI
            document.getElementById('voiceRecordBtn').classList.remove('recording');
            document.getElementById('voiceRecordBtn').textContent = '🎤';
            document.getElementById('recordingIndicator').classList.remove('active');
            clearInterval(recordingTimer);
            document.getElementById('recordingTimer').textContent = '00:00';
        }
        
        function updateRecordingTimer() {
            recordingSeconds++;
            const mins = Math.floor(recordingSeconds / 60);
            const secs = recordingSeconds % 60;
            document.getElementById('recordingTimer').textContent = 
                String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }
        
        async function uploadVoice(audioBlob) {
            if (!token) return;
            
            showToast('Sending voice...');
            
            const formData = new FormData();
            formData.append('voice', audioBlob, 'voice.webm');
            
            try {
                const res = await fetch('/api/chat/upload-voice?token=' + token, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                if (data.success) {
                    await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token,
                            message: '🎤 Voice Message',
                            type: 'voice',
                            fileUrl: data.fileUrl,
                            duration: recordingSeconds
                        })
                    });
                    showToast('Voice sent!');
                    loadMessages();
                } else {
                    showToast('Voice send failed');
                }
            } catch(e) {
                showToast('Voice upload error');
                console.error(e);
            }
        }
        
        // ============ VOICE PLAYBACK ============
        function playVoice(url, btn) {
            // If same voice is playing, pause it
            if (currentVoice && currentVoice.src.includes(url) && !currentVoice.paused) {
                currentVoice.pause();
                btn.textContent = '▶';
                return;
            }
            
            // Stop any playing voice
            if (currentVoice) {
                currentVoice.pause();
                document.querySelectorAll('.voice-play-btn').forEach(b => b.textContent = '▶');
            }
            
            // Play new voice
            currentVoice = new Audio(url);
            currentVoice.play().catch(() => showToast('Playback error'));
            btn.textContent = '⏸';
            
            currentVoice.onended = () => {
                btn.textContent = '▶';
                currentVoice = null;
            };
            
            currentVoice.onpause = () => {
                btn.textContent = '▶';
            };
            
            currentVoice.onerror = () => {
                btn.textContent = '▶';
                showToast('Cannot play audio');
                currentVoice = null;
            };
        }
        
        // ============ FULLSCREEN IMAGE ============
        function showFullscreen(url) {
            document.getElementById('fullscreenImg').src = url;
            document.getElementById('imageFullscreen').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeFullscreen() {
            document.getElementById('imageFullscreen').classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Close fullscreen on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeFullscreen();
        });
        
        // ============ MODAL ============
        function showModal(icon, title, text, actions) {
            const overlay = document.getElementById('modalOverlay');
            const sheet = document.getElementById('modalSheet');
            
            let actionsHTML = actions.map(a => 
                \`<button class="\${a.class}" onclick="\${a.action}">\${a.text}</button>\`
            ).join('');
            
            sheet.innerHTML = \`
                <div class="modal-handle"></div>
                <div class="modal-icon">\${icon}</div>
                <div class="modal-title">\${title}</div>
                <div class="modal-text">\${text}</div>
                <div class="modal-actions">\${actionsHTML}</div>\`;
            
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeModal() {
            document.getElementById('modalOverlay').classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Close modal on overlay click
        document.getElementById('modalOverlay').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
        
        // ============ TOAST ============
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 2500);
        }
        
        // ============ UTILITY ============
        function formatTime(date) {
            return new Date(date).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function goBack() {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                history.back();
            } else {
                window.location.href = '/';
            }
        }
        
        // ============ START ============
        init();
        
        // Handle safe area changes on iOS
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                document.body.style.height = window.visualViewport.height + 'px';
            });
        }
    </script>
</body>
</html>`;
}

module.exports = { getChatPageHTML };

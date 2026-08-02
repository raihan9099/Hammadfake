const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const sessions = new Map();

function createSession(u) { 
    const id = crypto.randomBytes(32).toString('hex'); 
    sessions.set(id, { username: u, createdAt: Date.now() }); 
    return id; 
}

function getSession(id) { 
    const s = sessions.get(id); 
    if (!s) return null; 
    if (Date.now() - s.createdAt > 7200000) { 
        sessions.delete(id); 
        return null; 
    } 
    return s; 
}

function getAdminLoginHTML(e) {
    e = e || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6">Admin Login</h2>' + (e ? '<div class="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">' + e + '</div>' : '') + '<form method="POST" action="/admin/login"><input name="username" placeholder="Username" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3" required><input type="password" name="password" placeholder="Password" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-4" required><button class="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-500">Back</a></div></body></html>';
}

async function getAdminPanelHTML(p, m, e, getAdminChatList) {
    p = p || [];
    m = m || '';
    e = e || '';
    const cl = getAdminChatList();
    const unreadTotal = cl.reduce((s, c) => s + c.unread, 0);
    
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 min-h-screen text-white"><header class="bg-gray-900 p-4 border-b border-gray-800"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-purple-400">Admin Panel</h1><div class="flex gap-3"><a href="/admin/chat" class="px-4 py-2 bg-purple-600 rounded-lg text-sm">Chats (' + unreadTotal + ')</a><a href="/" class="px-4 py-2 bg-gray-800 rounded-lg text-sm">Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Logout</a></div></div></header><div class="max-w-6xl mx-auto p-4">' + (m ? '<div class="bg-green-500/10 text-green-400 p-4 rounded-xl mb-4">' + m + '</div>' : '') + (e ? '<div class="bg-red-500/10 text-red-400 p-4 rounded-xl mb-4">' + e + '</div>' : '') + '<div class="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6"><h2 class="font-bold mb-4">Upload Photo</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" class="mb-3 text-white" required><input name="caption" placeholder="Caption" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3"><button class="w-full py-3 bg-purple-600 text-white rounded-lg">Upload</button></form></div><h2 class="text-xl font-bold mb-4">Gallery (' + p.length + ')</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">' + p.map(x => '<div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-800"><img src="' + x.path + '" class="w-full h-40 object-cover"><div class="p-3"><p class="text-sm text-gray-400">' + (x.caption || '') + '</p><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="' + x._id + '"><button class="text-red-400 text-sm mt-2">Delete</button></form></div></div>').join('') + (p.length === 0 ? '<p class="text-gray-500 col-span-4 text-center py-12">No photos</p>' : '') + '</div></div></body></html>';
}

async function verifyAdmin(u, p, db, dbConnected) { 
    if (!db || !dbConnected) return u === 'admin' && p === 'admin123'; 
    try { 
        const a = await db.collection('admin_users').findOne({ username: u }); 
        if (!a) return false; 
        return await bcrypt.compare(p, a.password); 
    } catch(e) { 
        return u === 'admin' && p === 'admin123'; 
    } 
}

function formatMsgTime(d) { 
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
}

function renderMsgBubble(m) {
    var time = formatMsgTime(m.createdAt);
    var bubble = '';
    if (m.type === 'image' && m.fileUrl) {
        bubble = '<img src="' + m.fileUrl + '" style="max-width:250px;max-height:250px;border-radius:12px;cursor:pointer;display:block" onclick="showImg(\'' + m.fileUrl + '\')">';
    } else if (m.type === 'voice' && m.fileUrl) {
        bubble = '<div style="display:flex;align-items:center;gap:10px;padding:5px 0">' +
            '<button onclick="playV(\'' + m.fileUrl + '\',this)" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:14px;cursor:pointer;flex-shrink:0">▶</button>' +
            '<div style="display:flex;align-items:center;gap:2px;flex:1;height:24px">';
        for (var i = 0; i < 12; i++) {
            bubble += '<div style="width:3px;background:#8b5cf6;border-radius:2px;animation:voiceAnim 1s ease-in-out infinite;animation-delay:' + (i * 0.1) + 's;height:' + (8 + Math.floor(Math.random() * 14)) + 'px"></div>';
        }
        bubble += '</div>';
        if (m.duration) {
            var mins = Math.floor(m.duration / 60);
            var secs = Math.floor(m.duration % 60);
            bubble += '<span style="font-size:11px;opacity:0.6">' + mins + ':' + String(secs).padStart(2, '0') + '</span>';
        }
        bubble += '</div>';
    } else {
        bubble = m.message;
    }
    bubble += '<div style="font-size:10px;opacity:0.5;margin-top:4px">' + time + '</div>';
    return bubble;
}

// Main admin route handler
async function setupAdminRoutes(req, res, pn, m, ck, pu, db, dbConnected, 
    memoryStore, adminPresence, getGalleryPhotos, savePhoto, 
    deletePhoto, getAdminChatList, getChatMessages, saveChatMessage, 
    markMessagesRead, getChatPageHTML) {
    
    const GALLERY_DIR = path.join(path.resolve(), 'assets', 'gallery');
    const CHAT_UPLOADS_DIR = path.join(path.resolve(), 'assets', 'chat_uploads');
    
    // Admin login page
    if (pn === '/admin' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (s) { 
            adminPresence.isOnline = true; 
            adminPresence.lastSeen = new Date(); 
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); 
            res.end(await getAdminPanelHTML(await getGalleryPhotos(), '', '', getAdminChatList)); 
            return; 
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); 
        res.end(getAdminLoginHTML()); 
        return;
    }
    
    // Admin login POST
    if (pn === '/admin/login' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            if (await verifyAdmin(p.get('username'), p.get('password'), db, dbConnected)) {
                const s = createSession(p.get('username'));
                adminPresence.isOnline = true; 
                adminPresence.lastSeen = new Date();
                res.writeHead(302, { 
                    'Location': '/admin', 
                    'Set-Cookie': 'sessionId=' + s + ';HttpOnly;Path=/;Max-Age=7200' 
                }); 
                res.end();
            } else { 
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); 
                res.end(getAdminLoginHTML('Invalid credentials')); 
            }
        }); 
        return;
    }
    
    // Admin logout
    if (pn === '/admin/logout') {
        sessions.delete(ck.sessionId);
        adminPresence.isOnline = false; 
        adminPresence.lastSeen = new Date();
        res.writeHead(302, { 
            'Location': '/admin', 
            'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' 
        }); 
        res.end(); 
        return;
    }
    
    // Admin chat interface
    if (pn === '/admin/chat' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (!s) { 
            res.writeHead(302, { 'Location': '/admin' }); 
            res.end(); 
            return; 
        }
        adminPresence.isOnline = true; 
        adminPresence.lastSeen = new Date();
        const cid = pu.query.chatId;
        const cl = getAdminChatList();
        let ms = [];
        if (cid) { 
            ms = getChatMessages(cid); 
            markMessagesRead(cid); 
        }
        
        let messagesHTML = '';
        ms.forEach(function(m) {
            var cls = m.sender === 'user' ? 'user' : 'admin';
            messagesHTML += '<div class="msg-b ' + cls + '"><div class="bub">' + renderMsgBubble(m) + '</div></div>';
        });
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Admin Chat</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @keyframes voiceAnim{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.3)}}
                    body{margin:0;display:flex;height:100vh;font-family:"Plus Jakarta Sans",sans-serif;background:#0a0a14;color:#fff}
                    .sidebar{width:350px;background:#13132b;border-right:1px solid rgba(255,255,255,0.06);overflow-y:auto}
                    .main{flex:1;display:flex;flex-direction:column}
                    .messages{flex:1;overflow-y:auto;padding:20px;background:#0a0a14}
                    .msg-b{margin-bottom:12px;display:flex}
                    .msg-b.user{justify-content:flex-start}
                    .msg-b.admin{justify-content:flex-end}
                    .msg-b .bub{max-width:70%;padding:10px 14px;border-radius:18px;font-size:13px;word-wrap:break-word}
                    .msg-b.user .bub{background:#1a1a35;border-bottom-left-radius:4px}
                    .msg-b.admin .bub{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px}
                    .image-preview{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer}
                    .image-preview img{max-width:95%;max-height:95%;border-radius:12px}
                    .admin-input-area{background:#13132b;padding:14px;display:flex;gap:10px;border-top:1px solid rgba(255,255,255,0.06)}
                    .admin-input{flex:1;padding:10px 16px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:25px;color:#fff;font-size:13px;outline:none}
                    .admin-input:focus{border-color:#8b5cf6}
                    .admin-send-btn{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;padding:10px 24px;border-radius:25px;cursor:pointer;font-weight:600;font-size:13px}
                    .admin-file-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
                    .sidebar-item{padding:14px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.2s}
                    .sidebar-item:hover{background:rgba(139,92,246,0.1)}
                    .sidebar-item.active{background:rgba(139,92,246,0.2);border-left:3px solid #8b5cf6}
                    .unread-badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:8px}
                    @media(max-width:768px){.sidebar{width:100%;position:absolute;top:0;left:0;bottom:0;z-index:10}.main{position:absolute;top:0;left:0;right:0;bottom:0;z-index:20}.sidebar.hidden-mobile{display:none}}
                </style>
            </head>
            <body>
                <div class="sidebar" id="sidebar">
                    <div style="padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);font-weight:600;display:flex;align-items:center;justify-content:space-between">
                        <span>💬 Chats</span>
                        <div style="display:flex;gap:8px">
                            <button onclick="refreshList()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:10px;cursor:pointer;font-size:11px">↻</button>
                            <a href="/admin" style="color:#fff;font-size:11px;text-decoration:none;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:10px">Back</a>
                        </div>
                    </div>
                    <div id="chatList">
                        ${cl.map(c => `
                            <div class="sidebar-item${c.chatId === cid ? ' active' : ''}" onclick="selectChat('${c.chatId}')">
                                <div style="font-weight:600;display:flex;align-items:center;justify-content:space-between">
                                    <span>${c.name}</span>
                                    ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : ''}
                                </div>
                                <div style="font-size:12px;opacity:0.6;margin-top:2px">${c.phoneEmail}</div>
                                <div style="font-size:10px;opacity:0.4;margin-top:2px">${c.lastMessage ? c.lastMessage.message.substring(0, 30) : 'No messages'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="main" id="mainPanel">
                    ${cid ? `
                        <div style="padding:14px 16px;background:#13132b;font-weight:600;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06)">
                            <button onclick="showMobileSidebar()" style="background:none;border:none;color:#fff;font-size:20px;display:none" class="back-btn">←</button>
                            <span>${cl.find(c => c.chatId === cid)?.name || ''}</span>
                        </div>
                        <div class="messages" id="mc">${messagesHTML}</div>
                        <div class="admin-input-area">
                            <input type="file" id="adminFileInput" accept="image/*" style="display:none" onchange="handleAdminFile(event)">
                            <button class="admin-file-btn" onclick="document.getElementById('adminFileInput').click()" title="Send Photo">📎</button>
                            <input id="am" class="admin-input" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendAdminMessage()">
                            <button class="admin-send-btn" onclick="sendAdminMessage()">Send</button>
                        </div>
                    ` : `
                        <div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.5;flex-direction:column;gap:10px">
                            <div style="font-size:60px">💬</div>
                            <div>Select a chat from the left</div>
                            <button onclick="refreshList()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;margin-top:10px">Refresh List</button>
                        </div>
                    `}
                </div>
                <audio id="voicePlayer" style="display:none"></audio>
                <div class="image-preview" id="imagePreview" style="display:none" onclick="this.style.display='none'">
                    <img id="previewImg" src="" alt="Preview">
                </div>
                <script>
                    var cid="${cid || ''}";
                    function selectChat(id){window.location.href="/admin/chat?chatId="+id}
                    function refreshList(){window.location.reload()}
                    function lm(){fetch("/api/admin/messages?chatId="+cid).then(r=>r.json()).then(d=>{if(d.success){var h="";d.messages.forEach(function(m){var c=m.sender==="user"?"user":"admin";h+='<div class="msg-b '+c+'"><div class="bub">${renderMsgBubbleJS()}</div></div>'});document.getElementById("mc").innerHTML=h;document.getElementById("mc").scrollTop=document.getElementById("mc").scrollHeight}})}
                    function sendAdminMessage(){var i=document.getElementById("am");var msg=i.value.trim();if(!msg)return;fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:msg,type:"text"})}).then(function(){i.value="";lm()})}
                    function handleAdminFile(event){var file=event.target.files[0];if(!file)return;var fd=new FormData();fd.append("photo",file);fetch("/api/admin/upload-file?chatId="+cid,{method:"POST",body:fd}).then(r=>r.json()).then(d=>{if(d.success){fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:cid,message:"📷 Photo",type:"image",fileUrl:d.fileUrl})}).then(function(){lm()})}});event.target.value=""}
                    function playV(url,btn){var p=document.getElementById("voicePlayer");if(p.src===url&&!p.paused){p.pause();btn.textContent="▶";return}p.src=url;p.play();btn.textContent="⏸";p.onended=function(){btn.textContent="▶"};p.onpause=function(){btn.textContent="▶"}}
                    function showImg(url){document.getElementById("previewImg").src=url;document.getElementById("imagePreview").style.display="flex"}
                    function showMobileSidebar(){document.getElementById("sidebar").classList.toggle("hidden-mobile")}
                    setInterval(lm,2000);
                    setInterval(refreshList,10000);
                </script>
            </body>
            </html>
        `);
        return;
    }
    
    // API: Get admin messages
    if (pn === '/api/admin/messages' && m === 'GET') {
        if (!getSession(ck.sessionId)) { 
            res.writeHead(401, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ success: false })); 
            return; 
        }
        markMessagesRead(pu.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' }); 
        res.end(JSON.stringify({ success: true, messages: getChatMessages(pu.query.chatId) })); 
        return;
    }
    
    // API: Admin send message
    if (pn === '/api/admin/send' && m === 'POST') {
        if (!getSession(ck.sessionId)) { 
            res.writeHead(401, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ success: false })); 
            return; 
        }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { chatId, message, type, fileUrl } = JSON.parse(b);
            saveChatMessage(chatId, 'admin', message, type, fileUrl);
            adminPresence.isOnline = true; 
            adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ success: true }));
        }); 
        return;
    }
    
    // API: Admin upload file
    if (pn === '/api/admin/upload-file' && m === 'POST') {
        if (!getSession(ck.sessionId)) { 
            res.writeHead(401, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ success: false })); 
            return; 
        }
        const fm = new formidable.IncomingForm({ 
            uploadDir: CHAT_UPLOADS_DIR, 
            keepExtensions: true 
        });
        fm.parse(req, async (err, fields, files) => {
            if (err) { 
                res.writeHead(500, { 'Content-Type': 'application/json' }); 
                res.end(JSON.stringify({ success: false })); 
                return; 
            }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { 
                res.writeHead(400, { 'Content-Type': 'application/json' }); 
                res.end(JSON.stringify({ success: false })); 
                return; 
            }
            const fn = 'admin_' + Date.now() + '_' + pf.originalFilename;
            fs.renameSync(pf.filepath, path.join(CHAT_UPLOADS_DIR, fn));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fn }));
        }); 
        return;
    }
    
    // Admin upload photo
    if (pn === '/admin/upload' && m === 'POST') {
        if (!getSession(ck.sessionId)) { 
            res.writeHead(302, { 'Location': '/admin' }); 
            res.end(); 
            return; 
        }
        const fm = new formidable.IncomingForm({ 
            uploadDir: GALLERY_DIR, 
            keepExtensions: true 
        });
        fm.parse(req, async (err, fields, files) => {
            if (err) { 
                res.writeHead(302, { 'Location': '/admin' }); 
                res.end(); 
                return; 
            }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { 
                res.writeHead(302, { 'Location': '/admin' }); 
                res.end(); 
                return; 
            }
            const fn = Date.now() + '_' + pf.originalFilename;
            fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
            await savePhoto({ path: '/assets/gallery/' + fn, caption: fields.caption || '' });
            res.writeHead(302, { 'Location': '/admin' }); 
            res.end();
        }); 
        return;
    }
    
    // Admin delete photo
    if (pn === '/admin/delete' && m === 'POST') {
        if (!getSession(ck.sessionId)) { 
            res.writeHead(302, { 'Location': '/admin' }); 
            res.end(); 
            return; 
        }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            try { 
                if (db && dbConnected) {
                    const ph = await db.collection('gallery_photos').findOne({ _id: new ObjectId(p.get('photoId')) }); 
                    if (ph && fs.existsSync(path.join(path.resolve(), ph.path))) 
                        fs.unlinkSync(path.join(path.resolve(), ph.path)); 
                    await deletePhoto(p.get('photoId')); 
                }
            } catch (e) {}
            res.writeHead(302, { 'Location': '/admin' }); 
            res.end();
        }); 
        return;
    }
}

module.exports = { setupAdminRoutes };

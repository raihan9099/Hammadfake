require('dotenv').config();
process.on('uncaughtException',(e)=>{console.error(e.message)});
process.on('unhandledRejection',(e)=>{console.error(e)});

const express=require('express');
const http=require('http');
const socketIO=require('socket.io');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const multer=require('multer');
const path=require('path');
const fs=require('fs');

const app=express();
const server=http.createServer(app);
const io=socketIO(server);

const PORT=process.env.PORT||3000;
const MONGO_URI=process.env.MONGO_URI||'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

app.use(express.json());
app.use('/assets',express.static('assets'));
app.use('/uploads',express.static('uploads'));

['uploads','assets/covermusic'].forEach(d=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true})});

const upload=multer({dest:'uploads/'});

const User=mongoose.model('User',new mongoose.Schema({
  name:String,email:{type:String,unique:true},password:String,isAdmin:{type:Boolean,default:false},
  lastSeen:Date,isOnline:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now}
}));
const Message=mongoose.model('Message',new mongoose.Schema({
  sender:String,receiver:String,message:String,type:{type:String,default:'text'},
  fileUrl:String,seen:{type:Boolean,default:false},timestamp:{type:Date,default:Date.now}
}));

mongoose.connect(MONGO_URI).then(async()=>{
  console.log('MongoDB connected');
  
  // Check and create/update admin user
  const adminEmail = 'admin@baillamaach.com';
  const adminPassword = 'admin@112233'; // Your desired password
  
  let admin = await User.findOne({ email: adminEmail });
  
  if (!admin) {
    // Create new admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    admin = await User.create({
      name: 'Baiilla Maach',
      email: adminEmail,
      password: hashedPassword,
      isAdmin: true
    });
    console.log('✅ Admin created successfully');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
  } else {
    // Update existing admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await User.updateOne(
      { email: adminEmail },
      { $set: { password: hashedPassword, isAdmin: true } }
    );
    console.log('✅ Admin password updated');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
  }
}).catch(e=>console.log('MongoDB error:',e.message));

const ASSETS={
  profile:"/assets/celebrity_pfp.jpeg",
  fbProfile:"/assets/fb_profile.jpg",
  blueTikTok:"/assets/bluetick_tiktok.png",
  blueFB:"/assets/blue_tick_fb.png",
  logoFB:"/assets/logo_fb.png",
  logoTikTok:"/assets/logo_tiktok.png",
  messageBubble:"/assets/message_bubble.gif",
  microphone:"/assets/microphone-in-hand.gif",
  reportBtn:"/assets/report_button.png",
  realId:"/assets/real-id-ss.png",
  fakeDetect:"/assets/Fakedetect_updown.png",
  baillamachFake:"/assets/baillamach_fake.png",
  hammadFake:"/assets/hammadfams.png",
  officialTikTok:"/assets/orginalss-tiktok.png"
};

const WELCOME_VOICE=fs.existsSync('assets/realvoice.mp3');
const MANUAL_VOICE=fs.existsSync('assets/manualvoice_alert.mp3');

function getSongs(){
  try{
    const dir='assets/covermusic';
    if(!fs.existsSync(dir))return[];
    return fs.readdirSync(dir).filter(f=>f.endsWith('.mp3')).map((f,i)=>({
      id:i,title:f.replace('.mp3','').replace(/[-_]/g,' '),url:'/assets/covermusic/'+encodeURIComponent(f)
    }));
  }catch(e){return[]}
}

// API Routes
app.post('/api/admin/login',async(req,res)=>{
  try {
    console.log('🔐 Login attempt:', req.body.email);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email, isAdmin: true });
    
    if (!user) {
      console.log('❌ Admin not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    console.log('🔑 Password check:', validPassword ? 'Valid' : 'Invalid');
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ Admin logged in:', user.name);
    res.json({ 
      success: true,
      token: 'admin_authenticated',
      user: {
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('/api/admin/users',async(req,res)=>{
  try {
    const users = await User.find({ isAdmin: false }).sort({ lastSeen: -1 }).lean();
    
    // Add unread message count for each user
    for (let user of users) {
      user.unreadCount = await Message.countDocuments({
        sender: user.email,
        receiver: 'admin@baillamaach.com',
        seen: false
      });
    }
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/msgs/:email',async(req,res)=>{
  try {
    const msgs = await Message.find({
      $or: [
        { sender: req.params.email, receiver: 'admin@baillamaach.com' },
        { sender: 'admin@baillamaach.com', receiver: req.params.email }
      ]
    }).sort({ timestamp: 1 });
    
    res.json(msgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/messenger',(req,res)=>{
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Messenger | Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8f9fb;height:100vh;overflow:hidden;color:#1f2937}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-card{background:#fff;padding:40px;border-radius:16px;width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.login-card h2{font-family:'Outfit',sans-serif;margin-bottom:8px;font-size:1.5em;color:#1f2937}
.login-card .subtitle{color:#6b7280;margin-bottom:24px;font-size:0.9em}
.login-card .input-group{margin-bottom:16px;text-align:left}
.login-card label{display:block;margin-bottom:6px;font-weight:500;font-size:0.85em;color:#374151}
.login-card input{width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:10px;font-size:0.95em;outline:none;transition:border-color 0.2s}
.login-card input:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,0.1)}
.login-card button{width:100%;padding:14px;background:#f97316;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:1em;transition:background 0.2s}
.login-card button:hover{background:#ea580c}
.login-card .error{color:#ef4444;font-size:0.85em;margin-top:8px;display:none}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff}
.sidebar{width:360px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-family:'Outfit',sans-serif;font-size:1.3em}
.sidebar-header button{background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85em;transition:background 0.2s}
.sidebar-header button:hover{background:#dc2626}
.search-bar{padding:16px 20px}
.search-bar input{width:100%;padding:10px 16px;border:1px solid #e5e7eb;border-radius:20px;font-size:0.9em;outline:none;background:#f9fafb}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:14px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:0.15s;border-bottom:1px solid #f3f4f6}
.user-item:hover{background:#f9fafb}
.user-item.active{background:#fff7ed;border-left:4px solid #f97316}
.user-avatar{width:48px;height:48px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#10b981;border:2px solid #fff}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.95em;color:#1f2937}
.user-info .email{font-size:0.8em;color:#9ca3af;margin-top:2px}
.user-info .last-seen{font-size:0.75em;color:#9ca3af}
.unread{background:#f97316;color:#fff;font-size:0.75em;padding:3px 8px;border-radius:12px;font-weight:700;min-width:24px;text-align:center}
.chat-area{flex:1;display:flex;flex-direction:column;background:#f8f9fb}
.chat-header{padding:18px 24px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:12px}
.chat-header .avatar{width:44px;height:44px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1em}
.chat-header .name{font-weight:600;font-size:1em;color:#1f2937}
.chat-header .status{font-size:0.8em;color:#10b981}
.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column}
.message{max-width:65%;padding:10px 16px;border-radius:16px;margin-bottom:6px;font-size:0.9em;line-height:1.5;word-wrap:break-word}
.message.sent{background:#f97316;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.message.received{background:#fff;color:#1f2937;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}
.message .time{font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}
.date-divider{text-align:center;margin:16px 0;font-size:0.8em;color:#9ca3af}
.chat-input{padding:16px 20px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:10px;align-items:center}
.chat-input input{flex:1;padding:12px 18px;border:1px solid #e5e7eb;border-radius:24px;font-size:0.9em;outline:none}
.chat-input input:focus{border-color:#f97316}
.chat-input button{background:#f97316;color:#fff;border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1.1em;transition:background 0.2s}
.chat-input button:hover{background:#ea580c}
.empty-state{text-align:center;color:#9ca3af;padding:60px 20px}
.empty-state .icon{font-size:3em;margin-bottom:12px}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <h2>🔐 Admin Messenger</h2>
    <p class="subtitle">Sign in to manage conversations</p>
    <div class="input-group">
      <label>Email</label>
      <input type="email" id="loginEmail" placeholder="admin@baillamaach.com" value="admin@baillamaach.com">
    </div>
    <div class="input-group">
      <label>Password</label>
      <input type="password" id="loginPassword" placeholder="Enter password" value="admin@112233">
    </div>
    <button onclick="doLogin()">Sign In</button>
    <div class="error" id="loginError"></div>
  </div>
</div>

<div class="app" id="app">
  <div class="app-layout">
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>💬 Conversations</h2>
        <button onclick="logout()">Logout</button>
      </div>
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="🔍 Search conversations..." oninput="filterUsers()">
      </div>
      <div class="user-list" id="userList"></div>
    </div>
    <div class="chat-area">
      <div class="chat-header">
        <div class="avatar" id="chatAvatar">?</div>
        <div>
          <div class="name" id="chatName">Select a conversation</div>
          <div class="status" id="chatStatus"></div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="empty-state">
          <div class="icon">💬</div>
          <div>Select a user to start chatting</div>
        </div>
      </div>
      <div class="chat-input" id="chatInputArea" style="display:none">
        <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMsg()">
        <button onclick="sendMsg()">➤</button>
      </div>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let currentUser = null;
let socket = null;
let allUsers = [];

async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  
  errorDiv.style.display = 'none';
  
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      initSocket();
      loadUsers();
    } else {
      errorDiv.textContent = data.error || 'Invalid credentials';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.style.display = 'block';
  }
}

function logout() {
  if (socket) socket.disconnect();
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  currentUser = null;
}

function initSocket() {
  socket = io();
  socket.emit('register', {
    name: 'Admin',
    email: 'admin@baillamaach.com'
  });
  
  socket.on('newMsg', (msg) => {
    if (currentUser && (msg.sender === currentUser || msg.receiver === currentUser)) {
      appendMessage(msg);
    }
    loadUsers();
  });
  
  socket.on('userStatus', (data) => {
    loadUsers();
  });
}

async function loadUsers() {
  try {
    const response = await fetch('/api/admin/users');
    allUsers = await response.json();
    renderUsers();
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

function renderUsers(filter = '') {
  const filtered = filter ? 
    allUsers.filter(u => 
      u.name.toLowerCase().includes(filter) || 
      u.email.toLowerCase().includes(filter)
    ) : allUsers;
  
  const userList = document.getElementById('userList');
  
  if (filtered.length === 0) {
    userList.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;">No users found</div>';
    return;
  }
  
  userList.innerHTML = filtered.map(user => `
    <div class="user-item${currentUser === user.email ? ' active' : ''}" 
         onclick="selectUser('${user.email}')">
      <div class="user-avatar">
        ${user.name[0].toUpperCase()}
        ${user.isOnline ? '<div class="dot"></div>' : ''}
      </div>
      <div class="user-info">
        <div class="name">${user.name}</div>
        <div class="email">${user.email}</div>
        ${!user.isOnline && user.lastSeen ? 
          `<div class="last-seen">Last seen ${new Date(user.lastSeen).toLocaleString()}</div>` : 
          ''}
      </div>
      ${user.unreadCount > 0 ? 
        `<div class="unread">${user.unreadCount}</div>` : ''}
    </div>
  `).join('');
}

function filterUsers() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  renderUsers(searchTerm);
}

async function selectUser(email) {
  currentUser = email;
  document.getElementById('chatInputArea').style.display = 'flex';
  
  const user = allUsers.find(u => u.email === email);
  if (user) {
    document.getElementById('chatAvatar').textContent = user.name[0].toUpperCase();
    document.getElementById('chatName').textContent = user.name;
    document.getElementById('chatStatus').textContent = user.isOnline ? '🟢 Online' : '⚫ Offline';
  }
  
  try {
    const response = await fetch('/api/msgs/' + email);
    const messages = await response.json();
    
    const messagesContainer = document.getElementById('chatMessages');
    
    if (messages.length === 0) {
      messagesContainer.innerHTML = '<div class="empty-state"><div class="icon">💬</div><div>No messages yet</div></div>';
    } else {
      let html = '';
      let lastDate = '';
      
      messages.forEach(msg => {
        const msgDate = new Date(msg.timestamp).toLocaleDateString();
        if (msgDate !== lastDate) {
          html += `<div class="date-divider">${msgDate}</div>`;
          lastDate = msgDate;
        }
        
        html += `
          <div class="message ${msg.sender === email ? 'received' : 'sent'}">
            ${msg.message}
            <div class="time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
          </div>
        `;
      });
      
      messagesContainer.innerHTML = html;
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Mark messages as read
    if (socket) {
      socket.emit('markRead', { user: email });
    }
    
    renderUsers();
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

function appendMessage(msg) {
  const container = document.getElementById('chatMessages');
  
  // Remove empty state if exists
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${msg.sender === currentUser ? 'received' : 'sent'}`;
  msgDiv.innerHTML = `
    ${msg.message}
    <div class="time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
  `;
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function sendMsg() {
  if (!currentUser) return;
  
  const input = document.getElementById('msgInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  socket.emit('sendMsg', {
    sender: 'admin@baillamaach.com',
    receiver: currentUser,
    message: message,
    type: 'text'
  });
  
  input.value = '';
}

// Auto-login for testing (remove in production)
document.addEventListener('DOMContentLoaded', () => {
  // Uncomment the line below for auto-login during development
  // doLogin();
});
</script>
</body>
</html>`);
});

// Main website route
app.get('/',(req,res)=>{
  const songs=getSongs();
  
  let musicHTML='';
  if(songs.length>0){
    musicHTML=`
    <section class="section bg-gray">
      <div class="container">
        <div class="section-label">MUSIC</div>
        <h2 class="section-heading">Cover Songs</h2>
        <p class="section-desc">Official covers by Hammad Bin Amir</p>
        <div class="music-player">
          <div class="music-cover">
            <img src="${ASSETS.microphone}" alt="Music" onerror="this.src='${ASSETS.profile}'">
          </div>
          <div class="music-info">
            <h4 id="trackTitle">Select a Song</h4>
            <p id="trackArtist">Baiilla Maach</p>
            <div class="music-ctrls">
              <button onclick="prevTrack()">⏮</button>
              <button id="playBtn" onclick="togglePlay()" class="btn-play">▶️</button>
              <button onclick="nextTrack()">⏭</button>
            </div>
            <div class="music-bar" onclick="seekTrack(event)"><div id="progressBar" class="music-bar-fill"></div></div>
            <div class="music-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
          </div>
        </div>
        <div class="music-list">
          ${songs.map((s,i)=>`<div onclick="playTrack(${i})" class="music-item"><span>${String(i+1).padStart(2,'0')}</span>${s.title}</div>`).join('')}
        </div>
      </div>
    </section>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<title>Hammad Bin Amir — Official Verification</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
:root{
  --white:#ffffff;
  --bg:#f8f9fb;
  --gray50:#f9fafb;
  --gray100:#f3f4f6;
  --gray200:#e5e7eb;
  --gray300:#d1d5db;
  --gray400:#9ca3af;
  --gray500:#6b7280;
  --gray600:#4b5563;
  --gray700:#374151;
  --gray800:#1f2937;
  --gray900:#111827;
  --orange:#f97316;
  --orange-dark:#ea580c;
  --orange-light:#fff7ed;
  --green:#10b981;
  --green-light:#ecfdf5;
  --red:#ef4444;
  --red-light:#fef2f2;
  --blue:#3b82f6;
  --blue-light:#eff6ff;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.05);
  --shadow:0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:0 4px 6px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg:0 10px 15px rgba(0,0,0,0.1),0 4px 6px rgba(0,0,0,0.05);
  --radius:16px;
  --radius-sm:10px;
  --radius-full:9999px;
}

*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--white);color:var(--gray800);line-height:1.6;-webkit-font-smoothing:antialiased}

/* Nav */
.nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--gray200);padding:0 24px}
.nav-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;height:64px}
.nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none}
.nav-brand img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--orange)}
.nav-brand span{font-family:'Outfit',sans-serif;font-weight:700;font-size:1.15em;color:var(--gray900);letter-spacing:-0.3px}
.nav-chat{display:flex;align-items:center;gap:6px;background:var(--green);color:var(--white);padding:8px 18px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.85em;transition:0.2s}
.nav-chat:hover{background:#059669;transform:translateY(-1px)}
.nav-chat img{width:18px;height:18px}

/* Hero */
.hero{padding:80px 24px 60px;text-align:center;max-width:700px;margin:0 auto}
.hero-avatar{position:relative;display:inline-block;margin-bottom:20px}
.hero-avatar img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--orange);box-shadow:0 0 0 8px var(--orange-light)}
.hero-avatar .verified-icon{position:absolute;bottom:8px;right:8px;background:var(--green);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid var(--white)}
.hero-avatar .verified-icon svg{width:14px;height:14px;fill:var(--white)}
.hero h1{font-family:'Outfit',sans-serif;font-size:2.5em;font-weight:800;color:var(--gray900);letter-spacing:-1px;margin-bottom:4px}
.hero .username{font-family:'DM Sans',sans-serif;font-size:1.05em;color:var(--gray500);font-weight:400;margin-bottom:4px}
.hero .bio{color:var(--gray400);font-size:0.95em;margin-bottom:20px}
.hero-stats{display:flex;justify-content:center;gap:32px;margin:20px 0}
.hero-stat{text-align:center}
.hero-stat .num{font-family:'Outfit',sans-serif;font-size:1.6em;font-weight:700;color:var(--gray900)}
.hero-stat .label{font-size:0.78em;color:var(--gray400);text-transform:uppercase;letter-spacing:1.5px;margin-top:2px}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--green-light);color:var(--green);padding:6px 16px;border-radius:var(--radius-full);font-weight:600;font-size:0.8em;margin-bottom:18px}
.hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}
.hero-btn{padding:10px 22px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.88em;display:flex;align-items:center;gap:6px;transition:0.2s}
.hero-btn img{width:18px;height:18px}
.hero-btn.tiktok{background:var(--gray900);color:var(--white)}
.hero-btn.tiktok:hover{background:#000}
.hero-btn.facebook{background:var(--blue-light);color:var(--blue)}
.hero-btn.facebook:hover{background:#dbeafe}

/* Sections */
.section{padding:80px 24px}
.section.bg-gray{background:var(--gray50)}
.section.bg-green{background:var(--green-light)}
.section.bg-red{background:var(--red-light)}
.container{max-width:1050px;margin:0 auto}
.section-label{display:inline-block;font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:var(--orange);margin-bottom:12px}
.section-heading{font-family:'Outfit',sans-serif;font-size:2em;font-weight:700;color:var(--gray900);text-align:center;letter-spacing:-0.5px;margin-bottom:6px}
.section-desc{text-align:center;color:var(--gray500);margin-bottom:40px;font-size:0.95em}

/* Verified Cards */
.verified-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.verified-card{background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);padding:28px;transition:0.2s}
.verified-card:hover{border-color:var(--green);box-shadow:var(--shadow-md)}
.verified-card .card-top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.verified-card .card-top .pfp{width:48px;height:48px;border-radius:50%;object-fit:cover}
.verified-card .card-top .info h3{font-family:'Outfit',sans-serif;font-size:1.1em;font-weight:600;display:flex;align-items:center;gap:5px;color:var(--gray900)}
.verified-card .card-top .info h3 img{width:18px;height:18px}
.verified-card .card-top .info .handle{color:var(--gray500);font-size:0.85em;font-family:'DM Sans',sans-serif}
.verified-card .card-body .row{display:flex;align-items:center;gap:6px;padding:6px 0;color:var(--gray600);font-size:0.88em}
.verified-card .card-body .row strong{color:var(--gray800);font-weight:600}
.verified-card .card-body .follow-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.82em;margin-top:12px;transition:0.2s}
.verified-card .card-body .follow-btn img{width:16px;height:16px}
.verified-card .card-body .follow-btn.tiktok-btn{background:var(--gray900);color:var(--white)}
.verified-card .card-body .follow-btn.tiktok-btn:hover{background:#000}
.verified-card .card-body .follow-btn.fb-btn{background:var(--blue);color:var(--white)}
.verified-card .card-body .follow-btn.fb-btn:hover{background:#2563eb}

/* Fake Cards */
.fake-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.fake-card{background:var(--white);border:2px solid #fecaca;border-radius:var(--radius);overflow:hidden;position:relative;transition:0.2s}
.fake-card:hover{box-shadow:var(--shadow-lg)}
.fake-img-container{position:relative;text-align:center;background:#fafafa;padding:20px}
.fake-img{max-width:100%;height:auto;display:block;margin:0 auto}
.fake-detect{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;animation:updown 2s infinite ease-in-out}
@keyframes updown{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-15px)}}
.fake-card .fake-info{padding:20px}
.fake-card .fake-info h3{font-family:'Outfit',sans-serif;font-size:1.1em;font-weight:600;color:var(--gray900);margin-bottom:2px}
.fake-card .fake-info .plat{color:var(--orange);font-weight:600;font-size:0.82em;margin-bottom:6px}
.fake-card .fake-info p{color:var(--gray500);font-size:0.88em;margin-bottom:12px;line-height:1.5}
.fake-card .fake-info .report-btn{display:inline-flex;align-items:center;gap:5px;background:var(--red);color:var(--white);padding:7px 16px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.8em;transition:0.2s}
.fake-card .fake-info .report-btn:hover{background:#dc2626}
.fake-card .fake-info .report-btn img{width:15px;height:15px}

/* Voice */
.voice-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.voice-btn{padding:12px 26px;border-radius:var(--radius-full);border:none;font-weight:600;cursor:pointer;font-size:0.9em;display:flex;align-items:center;gap:6px;transition:0.2s}
.voice-btn.welcome{background:var(--orange);color:var(--white)}
.voice-btn.welcome:hover{background:var(--orange-dark)}
.voice-btn.manual{background:var(--white);color:var(--red);border:2px solid var(--red)}
.voice-btn.manual:hover{background:var(--red);color:var(--white)}

/* Proof */
.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.proof-card{background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius-sm);padding:20px;text-align:center;transition:0.2s}
.proof-card:hover{border-color:var(--orange);box-shadow:var(--shadow-sm)}
.proof-card img{width:100%;height:auto;border-radius:6px;margin-bottom:10px}
.proof-card p{font-weight:600;font-size:0.85em;color:var(--gray700)}

/* Music */
.music-player{max-width:600px;margin:0 auto;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);padding:28px;display:flex;align-items:center;gap:24px}
.music-cover img{width:100px;height:100px;border-radius:50%;object-fit:cover;border:2px solid var(--orange)}
.music-info{flex:1;text-align:center}
.music-info h4{font-family:'Outfit',sans-serif;font-size:1.05em;font-weight:600;color:var(--gray900);margin-bottom:2px}
.music-info p{color:var(--orange);font-weight:600;font-size:0.85em;margin-bottom:10px}
.music-ctrls{display:flex;justify-content:center;gap:10px;margin-bottom:8px}
.music-ctrls button{background:var(--gray100);border:1px solid var(--gray200);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:0.9em;transition:0.2s;color:var(--gray700)}
.music-ctrls button:hover{background:var(--orange-light);border-color:var(--orange)}
.music-ctrls .btn-play{background:var(--orange);color:var(--white);border:none;width:48px;height:48px;font-size:1.1em}
.music-ctrls .btn-play:hover{background:var(--orange-dark)}
.music-bar{background:var(--gray200);height:4px;border-radius:2px;cursor:pointer;margin:6px 0}
.music-bar-fill{background:var(--orange);height:100%;border-radius:2px;width:0%;transition:width 0.1s}
.music-time{font-size:0.78em;color:var(--gray500);font-family:'DM Sans',sans-serif}
.music-list{margin-top:10px;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius-sm);max-height:240px;overflow-y:auto}
.music-item{padding:10px 18px;cursor:pointer;border-bottom:1px solid var(--gray100);display:flex;gap:8px;font-size:0.85em;transition:0.15s;color:var(--gray700)}
.music-item:hover{background:var(--orange-light)}
.music-item.active{background:var(--orange-light);border-left:3px solid var(--orange);font-weight:600}
.music-item span{font-weight:700;color:var(--orange);min-width:24px}

/* Footer */
.footer{background:var(--gray900);color:var(--white);padding:50px 24px 30px;text-align:center}
.footer-grid{max-width:1000px;margin:0 auto 30px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:30px;text-align:left}
.footer h4{font-family:'Outfit',sans-serif;color:var(--orange);margin-bottom:10px;font-size:0.95em}
.footer p,.footer a{color:var(--gray400);text-decoration:none;font-size:0.82em;line-height:1.8}
.footer a:hover{color:var(--white)}
.footer-bottom{padding-top:20px;border-top:1px solid var(--gray700);font-size:0.78em;color:var(--gray500)}

/* Chat Widget */
.chat-widget{position:fixed;bottom:24px;right:24px;z-index:999}
.chat-bubble{width:56px;height:56px;border-radius:50%;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.3);transition:0.2s;animation:softBounce 3s infinite}
.chat-bubble:hover{transform:scale(1.08)}
.chat-bubble img{width:100%;height:100%;border-radius:50%}
@keyframes softBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.chat-box{display:none;position:fixed;bottom:90px;right:24px;width:360px;height:460px;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);flex-direction:column;overflow:hidden;z-index:999;box-shadow:var(--shadow-lg)}
.chat-box.open{display:flex}
.chat-box .head{background:var(--green);color:var(--white);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-family:'Outfit',sans-serif;font-weight:600;font-size:0.9em}
.chat-box .head button{background:none;border:none;color:var(--white);font-size:1.2em;cursor:pointer}
.chat-box .body{flex:1;overflow-y:auto;padding:14px;background:var(--gray50)}
.chat-box .login-form{padding:24px;text-align:center}
.chat-box .login-form input{width:100%;padding:10px 14px;margin-bottom:8px;border:1px solid var(--gray200);border-radius:8px;font-size:0.88em;font-family:'Inter',sans-serif;outline:none}
.chat-box .login-form input:focus{border-color:var(--orange)}
.chat-box .login-form button{width:100%;padding:10px;background:var(--orange);color:var(--white);border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9em}
.chat-box .input-row{padding:12px 14px;background:var(--white);border-top:1px solid var(--gray200);display:none}
.chat-box .input-row input{flex:1;padding:10px 14px;border:1px solid var(--gray200);border-radius:20px;font-size:0.88em;font-family:'Inter',sans-serif;outline:none}
.chat-box .input-row button{background:var(--orange);color:var(--white);border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:1em;margin-left:6px}
.msg{max-width:80%;padding:8px 12px;border-radius:14px;margin-bottom:5px;font-size:0.84em;word-wrap:break-word}
.msg.user{background:var(--orange);color:var(--white);margin-left:auto;border-bottom-right-radius:3px}
.msg.admin{background:var(--white);color:var(--gray800);border:1px solid var(--gray200);border-bottom-left-radius:3px}
.msg .time{font-size:0.65em;opacity:0.6;margin-top:3px;text-align:right}

@media(max-width:768px){
  .hero h1{font-size:1.8em}
  .verified-grid,.fake-grid{grid-template-columns:1fr}
  .proof-grid{grid-template-columns:1fr}
  .music-player{flex-direction:column;text-align:center}
  .chat-box{width:100%;height:100%;bottom:0;right:0;border-radius:0}
}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <img src="${ASSETS.profile}" alt="Logo" onerror="this.style.display='none'">
      <span>Baiilla Maach</span>
    </a>
    <a href="/messenger" class="nav-chat">
      <img src="${ASSETS.messageBubble}" alt="Chat"> Chat Support
    </a>
  </div>
</nav>

<section class="hero">
  <div class="hero-avatar">
    <img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'">
    <div class="verified-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
  </div>
  <h1>Hammad Bin Amir</h1>
  <p class="username">@baiillamaach_official</p>
  <p class="bio">Official Entertainment Profile · Verified Creator</p>
  <div class="hero-stats">
    <div class="hero-stat"><div class="num">7K</div><div class="label">Followers</div></div>
    <div class="hero-stat"><div class="num">0</div><div class="label">Following</div></div>
    <div class="hero-stat"><div class="num">190K</div><div class="label">Likes</div></div>
  </div>
  <div class="hero-badge">✓ Verified Official Account</div>
  <div class="hero-btns">
    <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="hero-btn tiktok"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a>
    <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="hero-btn facebook"><img src="${ASSETS.logoFB}" alt=""> Facebook</a>
  </div>
</section>

<section class="section bg-green">
  <div class="container">
    <div class="section-label">OFFICIAL</div>
    <h2 class="section-heading">Verified Accounts</h2>
    <p class="section-desc">The only authentic Baiilla Maach accounts</p>
    <div class="verified-grid">
      <div class="verified-card">
        <div class="card-top">
          <img src="${ASSETS.profile}" class="pfp" onerror="this.style.display='none'">
          <div class="info">
            <h3>TikTok <img src="${ASSETS.blueTikTok}" onerror="this.style.display='none'"></h3>
            <p class="handle">@baiillamaach_official</p>
          </div>
        </div>
        <div class="card-body">
          <div class="row">✓ Status: <strong>Active & Verified</strong></div>
          <div class="row">👥 Followers: <strong>7,000</strong></div>
          <div class="row">❤️ Likes: <strong>190,000</strong></div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok-btn">
            <img src="${ASSETS.logoTikTok}" alt="TikTok" style="width:16px;height:16px"> Follow on TikTok
          </a>
        </div>
      </div>
      <div class="verified-card">
        <div class="card-top">
          <img src="${ASSETS.fbProfile}" class="pfp" onerror="this.style.display='none'">
          <div class="info">
            <h3>Facebook <img src="${ASSETS.blueFB}" onerror="this.style.display='none'"></h3>
            <p class="handle">@BaiillaMaachOfficial</p>
          </div>
        </div>
        <div class="card-body">
          <div class="row">✓ Status: <strong>Active & Verified</strong></div>
          <div class="row">📘 Page: <strong>Official Facebook</strong></div>
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">
            <img src="${ASSETS.logoFB}" alt="Facebook" style="width:16px;height:16px"> Follow on Facebook
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section bg-red">
  <div class="container">
    <div class="section-label" style="color:var(--red)">WARNING</div>
    <h2 class="section-heading">Fake Accounts Detected</h2>
    <p class="section-desc">Report these accounts immediately</p>
    <div class="fake-grid">
      <div class="fake-card">
        <div class="fake-img-container">
          <img src="${ASSETS.baillamachFake}" class="fake-img" alt="Fake Account Screenshot" onerror="this.style.display='none'">
          <img src="${ASSETS.fakeDetect}" class="fake-detect" alt="FAKE" onerror="this.style.display='none'">
        </div>
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="plat">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers. Uses similar name to confuse fans.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
        </div>
      </div>
      <div class="fake-card">
        <div class="fake-img-container">
          <img src="${ASSETS.hammadFake}" class="fake-img" alt="Fake Account Screenshot" onerror="this.style.display='none'">
          <img src="${ASSETS.fakeDetect}" class="fake-detect" alt="FAKE" onerror="this.style.display='none'">
        </div>
        <div class="fake-info">
          <h3>@hammad_fams0</h3>
          <p class="plat">📍 TikTok</p>
          <p>Uses official name and photo to mislead followers. Impersonating with fake content.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section bg-gray">
  <div class="container">
    <div class="section-label">PROOF</div>
    <h2 class="section-heading">Identity Verification</h2>
    <p class="section-desc">Evidence confirming authenticity</p>
    <div class="proof-grid">
      <div class="proof-card"><img src="${ASSETS.realId}" alt="Real ID Proof" onerror="this.style.display='none'"><p>Real ID Verified</p></div>
      <div class="proof-card"><img src="${ASSETS.fakeDetect}" alt="Fake Detection" onerror="this.style.display='none'"><p>Fake Account Detection</p></div>
      <div class="proof-card"><img src="${ASSETS.microphone}" alt="Voice Note" onerror="this.style.display='none'"><p>Real Voice Recording</p></div>
    </div>
  </div>
</section>

${WELCOME_VOICE||MANUAL_VOICE?`
<section class="section">
  <div class="container" style="text-align:center">
    <div class="section-label">VOICE</div>
    <h2 class="section-heading">Voice Verification</h2>
    <p class="section-desc">Listen to authentic Baiilla Maach voice</p>
    <div class="voice-btns">
      ${WELCOME_VOICE?`<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>`:''}
      ${MANUAL_VOICE?`<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert</button>`:''}
    </div>
  </div>
</section>`:''}

${musicHTML}

<footer class="footer">
  <div class="footer-grid">
    <div><h4>About</h4><p>Official verification hub for Baiilla Maach. Protecting fans from fake accounts.</p></div>
    <div><h4>Links</h4><p><a href="https://tiktok.com/@baiillamaach_official">TikTok</a></p><p><a href="https://www.facebook.com/profile.php?id=61575202118828">Facebook</a></p></div>
    <div><h4>Contact</h4><p>Use the chat button for support</p></div>
  </div>
  <div class="footer-bottom"><p>© 2024 Baiilla Maach. All rights reserved.</p></div>
</footer>

<div class="chat-widget"><div class="chat-bubble" onclick="openChat()"><img src="${ASSETS.messageBubble}" alt="Chat"></div></div>
<div class="chat-box" id="chatBox">
  <div class="head">💬 Chat Support<button onclick="closeChat()">✕</button></div>
  <div class="body" id="chatBody">
    <div class="login-form" id="chatLogin">
      <h4 style="margin-bottom:12px;font-family:'Outfit',sans-serif;">Start Chat</h4>
      <input type="text" id="chatName" placeholder="Your Name">
      <input type="text" id="chatEmail" placeholder="Email or Phone">
      <button onclick="startChat()">Start Chatting</button>
    </div>
  </div>
  <div class="input-row" id="chatInput">
    <div style="display:flex;align-items:center">
      <input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()">
      <button onclick="sendMsg()">➤</button>
    </div>
  </div>
</div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>`:''}
${MANUAL_VOICE?`<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
// Voice
window.addEventListener('load',()=>{const a=document.getElementById('welcomeAudio');if(a)setTimeout(()=>a.play().catch(()=>{}),1200)});
function playWelcome(){const a=document.getElementById('welcomeAudio');if(a){a.currentTime=0;a.play()}}
function playManual(){const a=document.getElementById('manualAudio');if(a){a.currentTime=0;a.play()}}

// Music
const tracks=${JSON.stringify(songs)};
let ct=0,playing=false;
const audio=new Audio();
if(tracks.length>0){audio.src=tracks[0].url;audio.load()}
function playTrack(i){ct=i;audio.src=tracks[i].url;audio.load();audio.play();playing=true;document.getElementById('playBtn').textContent='⏸️';document.getElementById('trackTitle').textContent=tracks[i].title;document.querySelectorAll('.music-item').forEach((el,j)=>el.classList.toggle('active',j===i))}
function togglePlay(){if(audio.paused){audio.play();playing=true;document.getElementById('playBtn').textContent='⏸️'}else{audio.pause();playing=false;document.getElementById('playBtn').textContent='▶️'}}
function prevTrack(){playTrack((ct-1+tracks.length)%tracks.length)}
function nextTrack(){playTrack((ct+1)%tracks.length)}
audio.addEventListener('timeupdate',()=>{const p=(audio.currentTime/audio.duration)*100||0;document.getElementById('progressBar').style.width=p+'%';document.getElementById('currentTime').textContent=ft(audio.currentTime);document.getElementById('duration').textContent=ft(audio.duration)});
audio.addEventListener('ended',nextTrack);
function seekTrack(e){const r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration}
function ft(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}

// Chat
const socket=io();let cu=null;
function openChat(){document.getElementById('chatBox').classList.add('open')}
function closeChat(){document.getElementById('chatBox').classList.remove('open')}
function startChat(){const n=document.getElementById('chatName').value.trim();const e=document.getElementById('chatEmail').value.trim();if(!n||!e)return;cu={name:n,email:e};socket.emit('register',{name:n,email:e});document.getElementById('chatLogin').style.display='none';document.getElementById('chatInput').style.display='block';loadMsgs()}
async function loadMsgs(){if(!cu)return;const r=await fetch('/api/msgs/'+cu.email);const ms=await r.json();const b=document.getElementById('chatBody');b.innerHTML=ms.map(m=>'<div class="msg '+(m.sender===cu.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');b.scrollTop=b.scrollHeight}
function sendMsg(){const i=document.getElementById('chatMsg');const m=i.value.trim();if(!m||!cu)return;socket.emit('sendMsg',{sender:cu.email,receiver:'admin',message:m,type:'text'});i.value=''}
socket.on('newMsg',(m)=>{if(cu&&(m.sender===cu.email||m.receiver===cu.email)){const b=document.getElementById('chatBody');b.insertAdjacentHTML('beforeend','<div class="msg '+(m.sender===cu.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');b.scrollTop=b.scrollHeight}});
</script>
</body>
</html>`);
});

// Socket.IO connection handling
io.on('connection',(socket)=>{
  console.log('User connected:', socket.id);
  
  socket.on('register',async(data)=>{
    socket.userData=data;
    
    try {
      let user = await User.findOne({email:data.email});
      if(!user){
        const hash = await bcrypt.hash('default123',10);
        user = await User.create({
          name: data.name,
          email: data.email,
          password: hash
        });
      }
      
      await User.updateOne(
        {email: data.email},
        {$set: {isOnline: true, lastSeen: new Date()}}
      );
      
      io.emit('userStatus', {email: data.email, online: true});
      console.log('User registered:', data.email);
    } catch (error) {
      console.error('Registration error:', error);
    }
  });
  
  socket.on('sendMsg',async(data)=>{
    try {
      const msg = await Message.create({
        sender: data.sender,
        receiver: data.receiver,
        message: data.message,
        type: data.type || 'text'
      });
      
      io.emit('newMsg', msg);
      console.log('Message sent:', data.sender, '->', data.receiver);
    } catch (error) {
      console.error('Message error:', error);
    }
  });
  
  socket.on('markRead',async(data)=>{
    try {
      await Message.updateMany(
        {
          sender: data.user,
          receiver: 'admin@baillamaach.com',
          seen: false
        },
        {$set: {seen: true}}
      );
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });
  
  socket.on('disconnect',async()=>{
    if(socket.userData){
      try {
        await User.updateOne(
          {email: socket.userData.email},
          {$set: {isOnline: false, lastSeen: new Date()}}
        );
        io.emit('userStatus', {email: socket.userData.email, online: false});
        console.log('User disconnected:', socket.userData.email);
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
  });
});

server.listen(PORT,()=>{
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Main site: http://localhost:${PORT}/`);
  console.log(`💬 Admin panel: http://localhost:${PORT}/messenger`);
  console.log(`\n📧 Admin credentials:`);
  console.log(`   Email: admin@baillamaach.com`);
  console.log(`   Password: admin@112233\n`);
});

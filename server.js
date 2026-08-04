// Baiilla Maach - Premium Realtime Chat System
require('dotenv').config();
process.on('uncaughtException',(e)=>{console.error(e.message);if(e.code==='EADDRINUSE')process.exit(1)});
process.on('unhandledRejection',(e)=>{console.error(e)});

const express=require('express');
const http=require('http');
const socketIO=require('socket.io');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const cors=require('cors');

const app=express();
const server=http.createServer(app);
const io=socketIO(server,{cors:{origin:"*",methods:["GET","POST"]}});

const PORT=process.env.PORT||3000;
const MONGODB_URI=process.env.MONGODB_URI||'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/chat_app?retryWrites=true&w=majority';
const JWT_SECRET=process.env.JWT_SECRET||'baiilla_maach_secret_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads',express.static('uploads'));

// Create directories
['public','uploads','public/css','public/js'].forEach(d=>{
  if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
});

// Multer
const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,'uploads/'),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname)
});
const upload=multer({storage,limits:{fileSize:10*1024*1024}});

// Models
const UserSchema=new mongoose.Schema({
  fullName:{type:String,required:true},
  phoneOrEmail:{type:String,required:true,unique:true},
  password:{type:String,required:true},
  createdAt:{type:Date,default:Date.now},
  lastSeen:{type:Date},
  isOnline:{type:Boolean,default:false}
});

const MessageSchema=new mongoose.Schema({
  sender:{type:String,required:true},
  receiver:{type:String,required:true},
  message:{type:String},
  type:{type:String,enum:['text','image','voice'],default:'text'},
  fileUrl:{type:String},
  seen:{type:Boolean,default:false},
  timestamp:{type:Date,default:Date.now}
});

const User=mongoose.model('User',UserSchema);
const Message=mongoose.model('Message',MessageSchema);

// MongoDB Connection
mongoose.connect(MONGODB_URI).then(()=>{
  console.log('MongoDB Connected');
  createDefaultAdmin();
}).catch(err=>console.log('MongoDB Error:',err.message));

async function createDefaultAdmin(){
  const exists=await User.findOne({phoneOrEmail:'admin'});
  if(!exists){
    const hash=await bcrypt.hash('admin123',10);
    await User.create({fullName:'Admin',phoneOrEmail:'admin',password:hash});
    console.log('Default admin created');
  }
}

// Auth Middleware
function authMiddleware(req,res,next){
  const token=req.headers.authorization?.split(' ')[1];
  if(!token)return res.status(401).json({error:'No token'});
  try{
    const decoded=jwt.verify(token,JWT_SECRET);
    req.user=decoded;
    next();
  }catch(e){res.status(401).json({error:'Invalid token'})}
}

// ============ HTML PAGES ============

function getLoginPage(){
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login | Baiilla Maach Chat</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f8f9fa;--card:#fff;--text:#1a1a2e;--sub:#64748b;--primary:#ff6600;--border:#e2e8f0;--shadow:0 4px 20px rgba(0,0,0,0.08);--radius:16px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{width:100%;max-width:420px}
.card{background:var(--card);border-radius:var(--radius);padding:40px 30px;box-shadow:var(--shadow);border:1px solid var(--border)}
.logo{text-align:center;margin-bottom:30px}
.logo img{width:80px;height:80px;border-radius:50%;border:3px solid var(--primary);object-fit:cover;margin-bottom:15px}
.logo h2{font-size:1.5em;color:var(--text);margin-bottom:5px}
.logo p{color:var(--sub);font-size:0.9em}
.form-group{margin-bottom:20px}
.form-group label{display:block;margin-bottom:8px;font-weight:600;color:var(--text);font-size:0.9em}
.form-group input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:12px;font-size:1em;transition:0.3s;background:var(--bg)}
.form-group input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(255,102,0,0.1)}
.btn{width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:600;cursor:pointer;transition:0.3s}
.btn:hover{opacity:0.9;transform:translateY(-1px)}
.link{text-align:center;margin-top:20px;color:var(--sub);font-size:0.9em}
.link a{color:var(--primary);text-decoration:none;font-weight:600}
.error{background:#fef2f2;color:#ef4444;padding:10px;border-radius:8px;font-size:0.9em;margin-bottom:15px;display:none}
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="/assets/celebrity_pfp.jpeg" alt="Baiilla Maach" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23ff6600%22 width=%2280%22 height=%2280%22 rx=%2240%22/><text fill=%22white%22 x=%2240%22 y=%2255%22 text-anchor=%22middle%22 font-size=%2230%22>BM</text></svg>'">
      <h2>Baiilla Maach Chat</h2>
      <p>Sign in to start messaging</p>
    </div>
    <div class="error" id="error"></div>
    <form onsubmit="login(event)">
      <div class="form-group">
        <label>Email or Phone</label>
        <input type="text" id="phoneOrEmail" placeholder="Enter email or phone" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="password" placeholder="Enter password" required>
      </div>
      <button type="submit" class="btn">Sign In</button>
    </form>
    <div class="link">Don't have an account? <a href="/register">Register</a></div>
  </div>
</div>
<script>
async function login(e){
  e.preventDefault();
  const error=document.getElementById('error');
  error.style.display='none';
  const data={
    phoneOrEmail:document.getElementById('phoneOrEmail').value,
    password:document.getElementById('password').value
  };
  try{
    const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await res.json();
    if(res.ok){
      localStorage.setItem('token',result.token);
      localStorage.setItem('user',JSON.stringify(result.user));
      window.location.href='/chat';
    }else{
      error.textContent=result.error||'Login failed';
      error.style.display='block';
    }
  }catch(e){error.textContent='Network error';error.style.display='block'}
}
</script>
</body>
</html>`;
}

function getRegisterPage(){
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Register | Baiilla Maach Chat</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f8f9fa;--card:#fff;--text:#1a1a2e;--sub:#64748b;--primary:#ff6600;--border:#e2e8f0;--shadow:0 4px 20px rgba(0,0,0,0.08);--radius:16px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{width:100%;max-width:420px}
.card{background:var(--card);border-radius:var(--radius);padding:40px 30px;box-shadow:var(--shadow);border:1px solid var(--border)}
.logo{text-align:center;margin-bottom:30px}
.logo img{width:80px;height:80px;border-radius:50%;border:3px solid var(--primary);object-fit:cover;margin-bottom:15px}
.logo h2{font-size:1.5em;color:var(--text);margin-bottom:5px}
.logo p{color:var(--sub);font-size:0.9em}
.form-group{margin-bottom:20px}
.form-group label{display:block;margin-bottom:8px;font-weight:600;color:var(--text);font-size:0.9em}
.form-group input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:12px;font-size:1em;transition:0.3s;background:var(--bg)}
.form-group input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(255,102,0,0.1)}
.btn{width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:600;cursor:pointer;transition:0.3s}
.btn:hover{opacity:0.9;transform:translateY(-1px)}
.link{text-align:center;margin-top:20px;color:var(--sub);font-size:0.9em}
.link a{color:var(--primary);text-decoration:none;font-weight:600}
.error{background:#fef2f2;color:#ef4444;padding:10px;border-radius:8px;font-size:0.9em;margin-bottom:15px;display:none}
.success{background:#f0fdf4;color:#10b981;padding:10px;border-radius:8px;font-size:0.9em;margin-bottom:15px;display:none}
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="/assets/celebrity_pfp.jpeg" alt="Baiilla Maach" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23ff6600%22 width=%2280%22 height=%2280%22 rx=%2240%22/><text fill=%22white%22 x=%2240%22 y=%2255%22 text-anchor=%22middle%22 font-size=%2230%22>BM</text></svg>'">
      <h2>Create Account</h2>
      <p>Join Baiilla Maach Chat</p>
    </div>
    <div class="error" id="error"></div>
    <div class="success" id="success"></div>
    <form onsubmit="register(event)">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="fullName" placeholder="Enter your full name" required>
      </div>
      <div class="form-group">
        <label>Email or Phone</label>
        <input type="text" id="phoneOrEmail" placeholder="Enter email or phone" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="password" placeholder="Create password" required minlength="6">
      </div>
      <button type="submit" class="btn">Register</button>
    </form>
    <div class="link">Already have an account? <a href="/login">Sign In</a></div>
  </div>
</div>
<script>
async function register(e){
  e.preventDefault();
  const error=document.getElementById('error');
  const success=document.getElementById('success');
  error.style.display='none';
  success.style.display='none';
  const data={
    fullName:document.getElementById('fullName').value,
    phoneOrEmail:document.getElementById('phoneOrEmail').value,
    password:document.getElementById('password').value
  };
  try{
    const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await res.json();
    if(res.ok){
      success.textContent='Registration successful! Redirecting...';
      success.style.display='block';
      setTimeout(()=>window.location.href='/login',1500);
    }else{
      error.textContent=result.error||'Registration failed';
      error.style.display='block';
    }
  }catch(e){error.textContent='Network error';error.style.display='block'}
}
</script>
</body>
</html>`;
}

function getChatPage(){
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Chat | Baiilla Maach</title>
<style>
:root{--bg:#f0f2f5;--white:#fff;--primary:#ff6600;--primary-light:#fff7f0;--text:#1a1a2e;--sub:#64748b;--border:#e8e8e8;--sent:#ff6600;--received:#fff;--shadow:0 2px 10px rgba(0,0,0,0.05);--radius:20px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);height:100vh;overflow:hidden}
.app{display:flex;flex-direction:column;height:100vh;max-width:900px;margin:0 auto;background:var(--white);box-shadow:var(--shadow)}
.header{background:var(--white);padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;z-index:100}
.header img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--primary)}
.header-info{flex:1}
.header-info h3{font-size:1em;color:var(--text)}
.header-info span{font-size:0.8em;color:#10b981}
.header-actions{display:flex;gap:8px}
.header-btn{background:var(--bg);border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em;display:flex;align-items:center;justify-content:center;transition:0.2s}
.header-btn:hover{background:var(--border)}
.messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.message{max-width:75%;padding:10px 14px;border-radius:18px;position:relative;animation:fadeIn 0.3s;word-wrap:break-word}
.message.sent{background:var(--sent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.message.received{background:var(--received);color:var(--text);align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
.message img{max-width:200px;border-radius:12px;cursor:pointer;display:block}
.message audio{max-width:200px;margin-top:5px}
.message-time{font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}
.message.sent .message-time{color:rgba(255,255,255,0.8)}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.input-area{padding:12px 16px;background:var(--white);border-top:1px solid var(--border);display:flex;align-items:center;gap:8px}
.input-area input{flex:1;padding:12px 16px;border:2px solid var(--border);border-radius:25px;font-size:0.95em;outline:none;background:var(--bg);transition:0.3s}
.input-area input:focus{border-color:var(--primary)}
.icon-btn{background:var(--bg);border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1.2em;display:flex;align-items:center;justify-content:center;transition:0.2s;color:var(--primary)}
.icon-btn:hover{background:var(--primary-light)}
.icon-btn.recording{background:#ef4444;color:#fff;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0)}}
.empty-chat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--sub);text-align:center;padding:40px}
.empty-chat .icon{font-size:4em;margin-bottom:15px}
.typing-indicator{padding:8px 20px;font-size:0.85em;color:var(--sub);font-style:italic;display:none}
</style>
</head>
<body>
<div class="app">
  <div class="header">
    <img src="/assets/celebrity_pfp.jpeg" alt="Admin" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22><rect fill=%22%23ff6600%22 width=%2244%22 height=%2244%22 rx=%2222%22/><text fill=%22white%22 x=%2222%22 y=%2230%22 text-anchor=%22middle%22 font-size=%2218%22>A</text></svg>'">
    <div class="header-info">
      <h3>Baiilla Maach Support</h3>
      <span id="statusText">● Online</span>
    </div>
    <div class="header-actions">
      <button class="header-btn" onclick="window.location.href='/login'" title="Logout">🚪</button>
    </div>
  </div>
  <div class="typing-indicator" id="typingIndicator">Admin is typing...</div>
  <div class="messages" id="messages">
    <div class="empty-chat">
      <div class="icon">💬</div>
      <h3>Start Conversation</h3>
      <p>Send a message to Baiilla Maach Support</p>
    </div>
  </div>
  <div class="input-area">
    <input type="file" id="imageInput" accept="image/*" style="display:none">
    <input type="file" id="audioInput" accept="audio/*" style="display:none">
    <button class="icon-btn" onclick="document.getElementById('imageInput').click()" title="Send Image">🖼️</button>
    <input type="text" id="messageInput" placeholder="Type a message..." autocomplete="off">
    <button class="icon-btn" id="voiceBtn" title="Record Voice">🎤</button>
    <button class="icon-btn" onclick="sendMessage()" title="Send" style="background:var(--primary);color:#fff;">➤</button>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
const token=localStorage.getItem('token');
const user=JSON.parse(localStorage.getItem('user')||'{}');
if(!token)window.location.href='/login';

const socket=io({auth:{token}});
const adminId='admin';
let mediaRecorder,audioChunks=[],isRecording=false;

socket.on('connect',()=>{
  console.log('Connected');
  socket.emit('join',user.phoneOrEmail);
});

socket.on('loadMessages',(messages)=>{
  const container=document.getElementById('messages');
  if(messages.length>0){
    container.innerHTML=messages.map(m=>renderMessage(m)).join('');
    container.scrollTop=container.scrollHeight;
  }
});

socket.on('newMessage',(msg)=>{
  const container=document.getElementById('messages');
  const empty=container.querySelector('.empty-chat');
  if(empty)empty.remove();
  container.insertAdjacentHTML('beforeend',renderMessage(msg));
  container.scrollTop=container.scrollHeight;
  document.getElementById('typingIndicator').style.display='none';
});

socket.on('typing',()=>{
  document.getElementById('typingIndicator').style.display='block';
  setTimeout(()=>document.getElementById('typingIndicator').style.display='none',2000);
});

socket.on('userStatus',(status)=>{
  document.getElementById('statusText').textContent=status.online?'● Online':'○ Offline';
});

function renderMessage(m){
  const isMe=m.sender===user.phoneOrEmail;
  const cls=isMe?'sent':'received';
  let content='';
  if(m.type==='image')content='<img src="'+m.fileUrl+'" onclick="window.open(this.src)">';
  else if(m.type==='voice')content='<audio controls src="'+m.fileUrl+'"></audio>';
  else content=m.message;
  return '<div class="message '+cls+'">'+content+'<div class="message-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
}

function sendMessage(){
  const input=document.getElementById('messageInput');
  const msg=input.value.trim();
  if(!msg)return;
  socket.emit('sendMessage',{receiver:adminId,message:msg,type:'text'});
  input.value='';
}

document.getElementById('messageInput').addEventListener('keypress',(e)=>{
  if(e.key==='Enter')sendMessage();
});

document.getElementById('messageInput').addEventListener('input',()=>{
  socket.emit('typing',{receiver:adminId});
});

document.getElementById('imageInput').addEventListener('change',async(e)=>{
  const file=e.target.files[0];
  if(!file)return;
  const fd=new FormData();
  fd.append('image',file);
  fd.append('receiver',adminId);
  fd.append('token',token);
  const res=await fetch('/api/upload/image',{method:'POST',body:fd});
  if(res.ok)e.target.value='';
});

document.getElementById('voiceBtn').addEventListener('click',async()=>{
  if(!isRecording){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      mediaRecorder=new MediaRecorder(stream);
      audioChunks=[];
      mediaRecorder.ondataavailable=e=>audioChunks.push(e.data);
      mediaRecorder.onstop=async()=>{
        const blob=new Blob(audioChunks,{type:'audio/webm'});
        const fd=new FormData();
        fd.append('audio',blob,'voice.webm');
        fd.append('receiver',adminId);
        fd.append('token',token);
        await fetch('/api/upload/audio',{method:'POST',body:fd});
        stream.getTracks().forEach(t=>t.stop());
      };
      mediaRecorder.start();
      isRecording=true;
      document.getElementById('voiceBtn').classList.add('recording');
    }catch(e){alert('Microphone access denied')}
  }else{
    mediaRecorder.stop();
    isRecording=false;
    document.getElementById('voiceBtn').classList.remove('recording');
  }
});
</script>
</body>
</html>`;
}

function getAdminPage(){
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Baiilla Maach</title>
<style>
:root{--bg:#f8f9fa;--white:#fff;--primary:#ff6600;--text:#1a1a2e;--sub:#64748b;--border:#e2e8f0;--shadow:0 2px 10px rgba(0,0,0,0.05);--radius:12px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);display:flex;height:100vh}
.sidebar{width:320px;background:var(--white);border-right:1px solid var(--border);display:flex;flex-direction:column}
.sidebar-header{padding:20px;border-bottom:1px solid var(--border)}
.sidebar-header h2{font-size:1.3em;color:var(--text);margin-bottom:5px}
.sidebar-search{padding:12px 20px}
.sidebar-search input{width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:25px;font-size:0.9em;outline:none}
.sidebar-search input:focus{border-color:var(--primary)}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:16px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid var(--border);transition:0.2s}
.user-item:hover{background:#f8f9fa}
.user-item.active{background:var(--primary);color:#fff}
.user-avatar{width:44px;height:44px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1em;flex-shrink:0}
.user-info{flex:1;min-width:0}
.user-name{font-weight:600;font-size:0.95em}
.user-email{font-size:0.8em;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-status{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.user-status.online{background:#10b981}
.user-status.offline{background:#94a3b8}
.badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:0.7em;font-weight:700}
.chat-area{flex:1;display:flex;flex-direction:column}
.chat-header{padding:16px 20px;background:var(--white);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px}
.chat-messages{flex:1;overflow-y:auto;padding:20px;background:var(--bg)}
.chat-input{padding:16px 20px;background:var(--white);border-top:1px solid var(--border);display:flex;gap:8px}
.chat-input input{flex:1;padding:12px 16px;border:2px solid var(--border);border-radius:25px;outline:none}
.chat-input input:focus{border-color:var(--primary)}
.chat-input button{padding:12px 24px;background:var(--primary);color:#fff;border:none;border-radius:25px;font-weight:600;cursor:pointer}
.message{max-width:70%;padding:10px 14px;border-radius:18px;margin-bottom:8px;word-wrap:break-word}
.message.user{background:var(--primary);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.message.admin{background:var(--white);color:var(--text);border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
.message img{max-width:200px;border-radius:12px}
.message audio{max-width:200px}
.message-time{font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}
.login-form{width:400px;margin:100px auto;background:var(--white);padding:40px;border-radius:var(--radius);box-shadow:var(--shadow)}
.login-form h2{margin-bottom:30px;text-align:center}
.login-form input{width:100%;padding:12px;margin-bottom:15px;border:2px solid var(--border);border-radius:8px}
.login-form button{width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
</style>
</head>
<body>
<div id="loginForm" class="login-form">
  <h2>🔐 Admin Login</h2>
  <input type="text" id="adminEmail" placeholder="Email" value="admin">
  <input type="password" id="adminPass" placeholder="Password" value="admin123">
  <button onclick="adminLogin()">Login</button>
</div>
<div id="app" style="display:none;width:100%;display:none">
  <div class="sidebar">
    <div class="sidebar-header"><h2>Users</h2></div>
    <div class="sidebar-search"><input type="text" id="searchInput" placeholder="Search users..." oninput="filterUsers()"></div>
    <div class="user-list" id="userList"></div>
  </div>
  <div class="chat-area">
    <div class="chat-header" id="chatHeader"><span>Select a user</span></div>
    <div class="chat-messages" id="adminMessages"><div style="text-align:center;color:var(--sub);padding:40px;">Select a user to view conversation</div></div>
    <div class="chat-input" id="chatInput" style="display:none">
      <input type="text" id="adminInput" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendReply()">
      <button onclick="sendReply()">Send</button>
    </div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
let token='',selectedUser=null,socket=null,allUsers=[];

async function adminLogin(){
  const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phoneOrEmail:document.getElementById('adminEmail').value,password:document.getElementById('adminPass').value})});
  const data=await res.json();
  if(res.ok){
    token=data.token;
    document.getElementById('loginForm').style.display='none';
    document.getElementById('app').style.display='flex';
    initSocket();
    loadUsers();
  }else alert('Login failed');
}

function initSocket(){
  socket=io({auth:{token}});
  socket.on('connect',()=>socket.emit('join','admin'));
  socket.on('newMessage',(msg)=>{
    if(selectedUser===msg.sender)appendMessage(msg);
    loadUsers();
  });
  socket.on('userStatus',loadUsers);
}

async function loadUsers(){
  const res=await fetch('/api/admin/users',{headers:{Authorization:'Bearer '+token}});
  allUsers=await res.json();
  renderUsers(allUsers);
}

function renderUsers(users){
  const list=document.getElementById('userList');
  list.innerHTML=users.filter(u=>u.phoneOrEmail!=='admin').map(u=>'<div class="user-item'+(selectedUser===u.phoneOrEmail?' active':'')+'" onclick="selectUser(\''+u.phoneOrEmail+'\')"><div class="user-avatar">'+u.fullName[0].toUpperCase()+'</div><div class="user-info"><div class="user-name">'+u.fullName+'</div><div class="user-email">'+u.phoneOrEmail+'</div></div><div class="user-status '+(u.isOnline?'online':'offline')+'"></div></div>').join('');
}

function filterUsers(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  renderUsers(allUsers.filter(u=>u.fullName.toLowerCase().includes(q)||u.phoneOrEmail.toLowerCase().includes(q)));
}

async function selectUser(email){
  selectedUser=email;
  document.getElementById('chatInput').style.display='flex';
  document.getElementById('chatHeader').innerHTML='<div class="user-avatar">'+email[0].toUpperCase()+'</div><div>'+email+'</div>';
  const res=await fetch('/api/admin/messages/'+email,{headers:{Authorization:'Bearer '+token}});
  const msgs=await res.json();
  const container=document.getElementById('adminMessages');
  container.innerHTML=msgs.map(m=>renderAdminMsg(m,email)).join('');
  container.scrollTop=container.scrollHeight;
  renderUsers(allUsers);
}

function renderAdminMsg(m,email){
  const cls=m.sender===email?'user':'admin';
  let content='';
  if(m.type==='image')content='<img src="'+m.fileUrl+'">';
  else if(m.type==='voice')content='<audio controls src="'+m.fileUrl+'"></audio>';
  else content=m.message;
  return '<div class="message '+cls+'">'+content+'<div class="message-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
}

function appendMessage(m){
  const container=document.getElementById('adminMessages');
  const email=selectedUser;
  container.insertAdjacentHTML('beforeend',renderAdminMsg(m,email));
  container.scrollTop=container.scrollHeight;
}

async function sendReply(){
  if(!selectedUser)return;
  const input=document.getElementById('adminInput');
  const msg=input.value.trim();
  if(!msg)return;
  socket.emit('sendMessage',{receiver:selectedUser,message:msg,type:'text'});
  input.value='';
}
</script>
</body>
</html>`;
}

// ============ ROUTES ============

app.get('/login',(req,res)=>res.send(getLoginPage()));
app.get('/register',(req,res)=>res.send(getRegisterPage()));
app.get('/chat',(req,res)=>res.send(getChatPage()));
app.get('/admin',(req,res)=>res.send(getAdminPage()));

// API Routes
app.post('/api/register',async(req,res)=>{
  try{
    const{fullName,phoneOrEmail,password}=req.body;
    if(!fullName||!phoneOrEmail||!password)return res.status(400).json({error:'All fields required'});
    const exists=await User.findOne({phoneOrEmail});
    if(exists)return res.status(400).json({error:'User already exists'});
    const hash=await bcrypt.hash(password,10);
    const user=await User.create({fullName,phoneOrEmail,password:hash});
    res.json({message:'Registered successfully',user:{fullName:user.fullName,phoneOrEmail:user.phoneOrEmail}});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/login',async(req,res)=>{
  try{
    const{phoneOrEmail,password}=req.body;
    const user=await User.findOne({phoneOrEmail});
    if(!user)return res.status(400).json({error:'User not found'});
    const valid=await bcrypt.compare(password,user.password);
    if(!valid)return res.status(400).json({error:'Invalid password'});
    const token=jwt.sign({phoneOrEmail:user.phoneOrEmail,fullName:user.fullName},JWT_SECRET,{expiresIn:'7d'});
    await User.updateOne({phoneOrEmail},{$set:{isOnline:true,lastSeen:new Date()}});
    io.emit('userStatus',{phoneOrEmail:user.phoneOrEmail,online:true});
    res.json({token,user:{fullName:user.fullName,phoneOrEmail:user.phoneOrEmail}});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/upload/image',upload.single('image'),async(req,res)=>{
  try{
    const{receiver,token}=req.body;
    const decoded=jwt.verify(token,JWT_SECRET);
    const fileUrl='/uploads/'+req.file.filename;
    const msg=await Message.create({sender:decoded.phoneOrEmail,receiver,type:'image',fileUrl});
    io.to(receiver).emit('newMessage',msg);
    io.to(decoded.phoneOrEmail).emit('newMessage',msg);
    res.json(msg);
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/upload/audio',upload.single('audio'),async(req,res)=>{
  try{
    const{receiver,token}=req.body;
    const decoded=jwt.verify(token,JWT_SECRET);
    const fileUrl='/uploads/'+req.file.filename;
    const msg=await Message.create({sender:decoded.phoneOrEmail,receiver,type:'voice',fileUrl});
    io.to(receiver).emit('newMessage',msg);
    io.to(decoded.phoneOrEmail).emit('newMessage',msg);
    res.json(msg);
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/api/admin/users',async(req,res)=>{
  try{
    const users=await User.find({}).select('-password').sort({lastSeen:-1});
    res.json(users);
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/api/admin/messages/:email',async(req,res)=>{
  try{
    const msgs=await Message.find({$or:[{sender:req.params.email},{receiver:req.params.email}]}).sort({timestamp:1});
    res.json(msgs);
  }catch(e){res.status(500).json({error:e.message})}
});

// Socket.IO
io.use((socket,next)=>{
  const token=socket.handshake.auth.token;
  if(!token)return next(new Error('No token'));
  try{
    const decoded=jwt.verify(token,JWT_SECRET);
    socket.user=decoded;
    next();
  }catch(e){next(new Error('Invalid token'))}
});

io.on('connection',(socket)=>{
  console.log('User connected:',socket.user.phoneOrEmail);
  
  socket.on('join',async(phoneOrEmail)=>{
    socket.join(phoneOrEmail);
    await User.updateOne({phoneOrEmail},{$set:{isOnline:true}});
    io.emit('userStatus',{phoneOrEmail,online:true});
    
    const msgs=await Message.find({$or:[{sender:phoneOrEmail},{receiver:phoneOrEmail}]}).sort({timestamp:1});
    socket.emit('loadMessages',msgs);
  });
  
  socket.on('sendMessage',async(data)=>{
    const msg=await Message.create({
      sender:socket.user.phoneOrEmail,
      receiver:data.receiver,
      message:data.message,
      type:data.type||'text'
    });
    io.to(data.receiver).emit('newMessage',msg);
    io.to(socket.user.phoneOrEmail).emit('newMessage',msg);
  });
  
  socket.on('typing',(data)=>{
    io.to(data.receiver).emit('typing');
  });
  
  socket.on('disconnect',async()=>{
    await User.updateOne({phoneOrEmail:socket.user.phoneOrEmail},{$set:{isOnline:false,lastSeen:new Date()}});
    io.emit('userStatus',{phoneOrEmail:socket.user.phoneOrEmail,online:false});
  });
});

// Serve index
app.get('/',(req,res)=>res.redirect('/login'));

server.listen(PORT,()=>console.log(`Chat server running on port ${PORT}`));

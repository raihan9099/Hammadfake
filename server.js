require('dotenv').config();
process.on('uncaughtException',(e)=>{console.error(e.message)});
process.on('unhandledRejection',(e)=>{console.error(e)});

const express=require('express');
const http=require('http');
const socketIO=require('socket.io');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
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

// Models
const User=mongoose.model('User',new mongoose.Schema({
  name:String,email:{type:String,unique:true},password:String,isAdmin:{type:Boolean,default:false},
  lastSeen:Date,isOnline:{type:Boolean,default:false},unreadCount:{type:Number,default:0},createdAt:{type:Date,default:Date.now}
}));
const Message=mongoose.model('Message',new mongoose.Schema({
  sender:String,receiver:String,message:String,type:{type:String,default:'text'},
  fileUrl:String,seen:{type:Boolean,default:false},timestamp:{type:Date,default:Date.now}
}));

mongoose.connect(MONGO_URI).then(async()=>{
  console.log('MongoDB connected');
  const admin=await User.findOne({email:'admin'});
  if(!admin){await User.create({name:'Baiilla Maach',email:'admin',password:await bcrypt.hash('admin123',10),isAdmin:true})}
}).catch(e=>console.log('MongoDB error:',e.message));

// Assets
const ASSETS={
  profile:"/assets/celebrity_pfp.jpeg",fbProfile:"/assets/fb_profile.jpg",
  blueTikTok:"/assets/bluetick_tiktok.png",blueFB:"/assets/blue_tick_fb.png",
  logoFB:"/assets/logo_fb.png",logoTikTok:"/assets/logo_tiktok.png",
  messageBubble:"/assets/message_bubble.gif",microphone:"/assets/microphone-in-hand.gif",
  reportBtn:"/assets/report_button.png",realId:"/assets/real-id-ss.png",
  fakeDetect:"/assets/Fakedetect_updown.png",baillamachFake:"/assets/baillamach_fake.png",
  hammadFake:"/assets/hammadfams.png"
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

// MAIN PAGE (Same as before with chat widget)
app.get('/',(req,res)=>{
  const songs=getSongs();
  let musicSection='';
  if(songs.length>0){
    musicSection=`
    <section style="padding:60px 20px;background:#fff;text-align:center">
      <h2 style="font-size:2em;color:#1a1a2e;margin-bottom:10px">🎵 Cover Songs</h2>
      <p style="color:#666;margin-bottom:30px">Official covers by Baiilla Maach</p>
      <div style="max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:30px;color:#fff">
        <img src="${ASSETS.profile}" style="width:100px;height:100px;border-radius:50%;border:3px solid #ff6600;object-fit:cover;margin-bottom:15px" onerror="this.style.display='none'">
        <h3 id="trackTitle">Select Song</h3>
        <p style="color:#ff6600;margin-bottom:15px">Baiilla Maach</p>
        <div style="display:flex;justify-content:center;gap:15px;margin-bottom:15px">
          <button onclick="prevTrack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.2em">⏮</button>
          <button id="playBtn" onclick="togglePlay()" style="background:#ff6600;border:none;color:#fff;width:60px;height:60px;border-radius:50%;cursor:pointer;font-size:1.5em">▶️</button>
          <button onclick="nextTrack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.2em">⏭</button>
        </div>
        <div style="background:rgba(255,255,255,0.2);height:5px;border-radius:3px;cursor:pointer" onclick="seekTrack(event)"><div id="progressBar" style="background:#ff6600;height:100%;border-radius:3px;width:0%"></div></div>
        <div style="margin-top:5px;font-size:0.9em"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
      </div>
      <div style="max-width:600px;margin:10px auto;background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1)">
        ${songs.map((s,i)=>`<div onclick="playTrack(${i})" class="song-item" style="padding:12px 20px;cursor:pointer;border-bottom:1px solid #eee;display:flex;gap:10px"><span style="font-weight:700;color:#999">${i+1}.</span><span>${s.title}</span></div>`).join('')}
      </div>
    </section>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#ff6600">
<title>Baiilla Maach Official | Verification Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:#f5f5f5;color:#333}
.header{background:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;position:sticky;top:0;z-index:100}
.header img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #ff6600}
.header span{font-weight:700;font-size:1.1em}
.header a{color:#ff6600;text-decoration:none;font-weight:600;padding:8px 16px;border:2px solid #ff6600;border-radius:50px;font-size:0.9em}
.hero{background:#1a1a2e;color:#fff;text-align:center;padding:60px 20px}
.hero-img{position:relative;display:inline-block}
.hero-img img:first-child{width:130px;height:130px;border-radius:50%;border:4px solid #ff6600;object-fit:cover}
.hero-img .tick{position:absolute;bottom:10px;right:10px;width:30px;height:30px}
.hero h1{font-size:2.2em;margin:15px 0 5px}
.hero p{opacity:0.9;margin-bottom:5px}
.stats{display:flex;justify-content:center;gap:30px;margin:20px 0}
.stat{text-align:center}
.stat-num{font-size:1.5em;font-weight:800;color:#ff6600}
.stat-label{font-size:0.8em;opacity:0.7}
.verified{display:inline-block;background:rgba(0,200,83,0.2);padding:10px 20px;border-radius:50px;margin:15px 0;font-weight:600;color:#00e676}
.social{display:flex;gap:10px;justify-content:center}
.social a{padding:10px 20px;border-radius:50px;text-decoration:none;font-weight:600;color:#fff;display:flex;align-items:center;gap:6px}
.social a.tiktok{background:rgba(0,0,0,0.5)}
.social a.facebook{background:rgba(24,119,242,0.5)}
.social a img{width:20px;height:20px}
.section{padding:50px 20px;max-width:900px;margin:0 auto}
.section h2{font-size:1.8em;text-align:center;margin-bottom:10px;color:#1a1a2e}
.section>p{text-align:center;color:#666;margin-bottom:30px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{background:#fff;border-radius:12px;padding:25px;box-shadow:0 2px 10px rgba(0,0,0,0.05)}
.card-header{display:flex;align-items:center;gap:10px;margin-bottom:15px}
.card-header img.pfp{width:45px;height:45px;border-radius:50%;object-fit:cover}
.card-header .tick-icon{width:18px;height:18px}
.card-header h3{font-size:1.1em;display:flex;align-items:center;gap:5px}
.card-header p{color:#666;font-size:0.85em}
.card-body p{margin-bottom:8px;color:#555}
.card-body a{display:inline-block;padding:8px 20px;border-radius:50px;text-decoration:none;font-weight:600;color:#fff;margin-top:10px}
.card-body a.tiktok-btn{background:#ff0050}
.card-body a.fb-btn{background:#1877f2}
.fake-cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.fake-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:2px solid #ffcdd2;position:relative}
.fake-card .badge{position:absolute;top:10px;right:10px;background:#ff1744;color:#fff;padding:5px 12px;border-radius:50px;font-weight:700;font-size:0.8em}
.fake-card img{width:100%;height:200px;object-fit:cover}
.fake-card .info{padding:20px}
.fake-card .info h3{margin-bottom:5px}
.fake-card .info .platform{color:#ff6600;font-weight:600;font-size:0.9em;margin-bottom:8px}
.fake-card .info p{color:#666;font-size:0.9em;margin-bottom:10px}
.fake-card .info a{display:inline-flex;align-items:center;gap:5px;background:#ff1744;color:#fff;padding:6px 14px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.85em}
.voice-btns{display:flex;gap:10px;justify-content:center}
.voice-btns button{padding:12px 24px;border-radius:50px;border:none;font-weight:600;cursor:pointer;color:#fff;font-size:1em}
.voice-btns .welcome{background:#ff6600}
.voice-btns .manual{background:#ff1744}
.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;text-align:center}
.proof-grid div{background:#f8f9fa;padding:15px;border-radius:8px}
.proof-grid img{max-width:100%;border-radius:8px;margin-bottom:8px}
.proof-grid p{font-weight:600;font-size:0.9em}
.footer{background:#1a1a2e;color:#fff;text-align:center;padding:30px 20px;margin-top:30px}
.footer p{opacity:0.7}
.chat-btn{position:fixed;bottom:20px;right:20px;z-index:999;cursor:pointer}
.chat-btn img{width:60px;height:60px;border-radius:50%}
.chat-box{display:none;position:fixed;bottom:90px;right:20px;width:350px;height:450px;background:#fff;border-radius:16px;box-shadow:0 5px 30px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:999}
.chat-box.open{display:flex}
.chat-box .head{background:#ff6600;color:#fff;padding:12px 15px;display:flex;justify-content:space-between;align-items:center}
.chat-box .head button{background:none;border:none;color:#fff;font-size:1.3em;cursor:pointer}
.chat-box .body{flex:1;overflow-y:auto;padding:15px;background:#f5f5f5}
.chat-box .login{padding:30px;text-align:center}
.chat-box .login input{width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:8px}
.chat-box .login button{width:100%;padding:10px;background:#ff6600;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
.chat-box .input-area{padding:10px 15px;background:#fff;border-top:1px solid #ddd;display:none}
.chat-box .input-area input{flex:1;padding:10px;border:1px solid #ddd;border-radius:20px;outline:none}
.chat-box .input-area button{background:#ff6600;color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;margin-left:8px}
.msg{max-width:80%;padding:10px 14px;border-radius:15px;margin-bottom:8px;font-size:0.9em}
.msg.user{background:#ff6600;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:#fff;color:#333;border-bottom-left-radius:4px}
.msg .time{font-size:0.7em;opacity:0.7;margin-top:3px;text-align:right}
.song-item:hover{background:#fff7f0}
.song-item.active{background:#fff3e0;border-left:3px solid #ff6600}
@media(max-width:768px){
  .cards,.fake-cards{grid-template-columns:1fr}
  .proof-grid{grid-template-columns:1fr}
  .chat-box{width:100%;height:100%;bottom:0;right:0;border-radius:0}
}
</style>
</head>
<body>

<div class="header">
  <div style="display:flex;align-items:center;gap:8px"><img src="${ASSETS.profile}" alt="Logo" onerror="this.style.display='none'"><span>Baiilla Maach</span></div>
  <a href="/admin">🔐 Admin</a>
</div>

<div class="hero">
  <div class="hero-img"><img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'"><img src="${ASSETS.blueTikTok}" class="tick" alt="Verified" onerror="this.style.display='none'"></div>
  <h1>Baiilla Maach Official</h1><p>@baiillamaach_official</p><p>Official Entertainment Profile | Verified Creator</p>
  <div class="stats"><div class="stat"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div><div class="stat"><div class="stat-num">0</div><div class="stat-label">Following</div></div><div class="stat"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div></div>
  <div class="verified">✅ VERIFIED OFFICIAL ACCOUNT</div>
  <div class="social"><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="tiktok"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="facebook"><img src="${ASSETS.logoFB}" alt=""> Facebook</a></div>
</div>

<div class="section">
  <h2>✅ Official Verified Accounts</h2><p>The ONLY authentic Baiilla Maach accounts with blue tick</p>
  <div class="cards">
    <div class="card"><div class="card-header"><img src="${ASSETS.profile}" class="pfp" alt="" onerror="this.style.display='none'"><div><h3>TikTok <img src="${ASSETS.blueTikTok}" class="tick-icon" alt="" onerror="this.style.display='none'"></h3><p>@baiillamaach_official</p></div></div><div class="card-body"><p>✅ Active & Verified</p><p>👥 7,000 Followers | ❤️ 190K Likes</p><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="tiktok-btn">Follow on TikTok</a></div></div>
    <div class="card"><div class="card-header"><img src="${ASSETS.fbProfile}" class="pfp" alt="" onerror="this.style.display='none'"><div><h3>Facebook <img src="${ASSETS.blueFB}" class="tick-icon" alt="" onerror="this.style.display='none'"></h3><p>@BaiillaMaachOfficial</p></div></div><div class="card-body"><p>✅ Active & Verified</p><p>📘 Official Facebook Page</p><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="fb-btn">Follow on Facebook</a></div></div>
  </div>
</div>

<div class="section" style="background:#fff5f5;max-width:100%;padding:50px 20px"><div style="max-width:900px;margin:0 auto"><h2>⚠️ Fake Accounts Detected</h2><p>2 fake accounts found - Report them immediately</p><div class="fake-cards"><div class="fake-card"><div class="badge">FAKE</div><img src="${ASSETS.baillamachFake}" alt="" onerror="this.style.display='none'"><div class="info"><h3>@baiilla_mach</h3><p class="platform">📍 TikTok</p><p>Copies official logo and content to deceive followers.</p><a href="https://tiktok.com/@baiilla_mach" target="_blank"><img src="${ASSETS.reportBtn}" alt=""> Report</a></div></div><div class="fake-card"><div class="badge">FAKE</div><img src="${ASSETS.hammadFake}" alt="" onerror="this.style.display='none'"><div class="info"><h3>@hammad_fams0</h3><p class="platform">📍 TikTok</p><p>Uses official name and photo to mislead followers.</p><a href="https://tiktok.com/@hammad_fams0" target="_blank"><img src="${ASSETS.reportBtn}" alt=""> Report</a></div></div></div></div></div>

${WELCOME_VOICE||MANUAL_VOICE?`<div class="section"><h2>🔊 Voice Verification</h2><p>Listen to verify authentic Baiilla Maach voice</p><div class="voice-btns">${WELCOME_VOICE?`<button class="welcome" onclick="playWelcome()">▶️ Real Voice</button>`:''}${MANUAL_VOICE?`<button class="manual" onclick="playManual()">⚠️ Fake Alert</button>`:''}</div></div>`:''}

<div class="section"><h2>🔒 Identity Proof</h2><p>Evidence confirming authenticity</p><div class="proof-grid"><div><img src="${ASSETS.realId}" alt="" onerror="this.style.display='none'"><p>Real ID Verified</p></div><div><img src="${ASSETS.fakeDetect}" alt="" onerror="this.style.display='none'"><p>Fake Detection</p></div><div><img src="${ASSETS.microphone}" alt="" onerror="this.style.display='none'"><p>Real Voice</p></div></div></div>

${musicSection}

<div class="footer"><p>© 2024 Baiilla Maach Official. All Rights Reserved.</p><p style="margin-top:5px">⚠️ This is the only official verification hub</p></div>

<div class="chat-btn" onclick="openChat()"><img src="${ASSETS.messageBubble}" alt="Chat"></div>
<div class="chat-box" id="chatBox"><div class="head"><strong>💬 Chat Support</strong><button onclick="closeChat()">✕</button></div><div class="body" id="chatBody"><div class="login" id="chatLogin"><h4 style="margin-bottom:15px">Start Chat</h4><input type="text" id="chatName" placeholder="Your Name"><input type="text" id="chatEmail" placeholder="Email or Phone"><button onclick="startChat()">Start Chatting</button></div></div><div class="input-area" id="chatInput"><div style="display:flex;align-items:center"><input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">➤</button></div></div></div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>`:''}
${MANUAL_VOICE?`<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
// Voice & Music (same as before)
window.addEventListener('load',()=>{const a=document.getElementById('welcomeAudio');if(a)setTimeout(()=>a.play().catch(()=>{}),1000)});
function playWelcome(){const a=document.getElementById('welcomeAudio');if(a){a.currentTime=0;a.play()}}
function playManual(){const a=document.getElementById('manualAudio');if(a){a.currentTime=0;a.play()}}
const tracks=${JSON.stringify(songs)};
let currentTrack=0,playing=false;
const audio=new Audio();
if(tracks.length>0){audio.src=tracks[0].url;audio.load()}
function playTrack(i){currentTrack=i;audio.src=tracks[i].url;audio.load();audio.play();playing=true;document.getElementById('playBtn').textContent='⏸️';document.getElementById('trackTitle').textContent=tracks[i].title;document.querySelectorAll('.song-item').forEach((el,j)=>el.classList.toggle('active',j===i))}
function togglePlay(){if(audio.paused){audio.play();playing=true;document.getElementById('playBtn').textContent='⏸️'}else{audio.pause();playing=false;document.getElementById('playBtn').textContent='▶️'}}
function prevTrack(){playTrack((currentTrack-1+tracks.length)%tracks.length)}
function nextTrack(){playTrack((currentTrack+1)%tracks.length)}
audio.addEventListener('timeupdate',()=>{const p=(audio.currentTime/audio.duration)*100||0;document.getElementById('progressBar').style.width=p+'%';document.getElementById('currentTime').textContent=formatTime(audio.currentTime);document.getElementById('duration').textContent=formatTime(audio.duration)});
audio.addEventListener('ended',nextTrack);
function seekTrack(e){const r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration}
function formatTime(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}

// Chat
const socket=io();
let chatUser=null;
function openChat(){document.getElementById('chatBox').classList.add('open')}
function closeChat(){document.getElementById('chatBox').classList.remove('open')}
function startChat(){
  const name=document.getElementById('chatName').value.trim();
  const email=document.getElementById('chatEmail').value.trim();
  if(!name||!email)return alert('Fill all fields');
  chatUser={name,email};
  socket.emit('register',{name,email});
  document.getElementById('chatLogin').style.display='none';
  document.getElementById('chatInput').style.display='block';
  loadMsgs();
}
async function loadMsgs(){
  if(!chatUser)return;
  const res=await fetch('/api/msgs/'+chatUser.email);
  const msgs=await res.json();
  const body=document.getElementById('chatBody');
  body.innerHTML=msgs.map(m=>'<div class="msg '+(m.sender===chatUser.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
  body.scrollTop=body.scrollHeight;
}
function sendMsg(){
  const input=document.getElementById('chatMsg');
  const msg=input.value.trim();
  if(!msg||!chatUser)return;
  socket.emit('sendMsg',{sender:chatUser.email,receiver:'admin',message:msg,type:'text',senderName:chatUser.name});
  input.value='';
}
socket.on('newMsg',(msg)=>{
  if(chatUser&&(msg.sender===chatUser.email||msg.receiver===chatUser.email)){
    const body=document.getElementById('chatBody');
    body.insertAdjacentHTML('beforeend','<div class="msg '+(msg.sender===chatUser.email?'user':'admin')+'">'+(msg.type==='image'?'<img src="'+msg.fileUrl+'" style="max-width:150px;border-radius:8px">':msg.message)+'<div class="time">'+new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');
    body.scrollTop=body.scrollHeight;
  }
});
</script>
</body>
</html>`);
});

// API
app.get('/api/msgs/:email',async(req,res)=>{
  const msgs=await Message.find({$or:[{sender:req.params.email},{receiver:req.params.email}]}).sort({timestamp:1});
  res.json(msgs);
});

// ============ PROFESSIONAL ADMIN PANEL ============
app.get('/admin',(req,res)=>{
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Baiilla Maach</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f2f5;height:100vh;overflow:hidden}

/* Login */
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-box{background:#fff;padding:40px;border-radius:16px;width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.login-box h2{text-align:center;margin-bottom:30px;color:#1a1a2e;font-size:1.5em}
.login-box input{width:100%;padding:14px;margin-bottom:15px;border:2px solid #e0e0e0;border-radius:12px;font-size:1em;transition:0.3s}
.login-box input:focus{outline:none;border-color:#ff6600}
.login-box button{width:100%;padding:14px;background:#ff6600;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:600;cursor:pointer;transition:0.3s}
.login-box button:hover{background:#e55a00}

/* App Layout */
.app{display:none;height:100vh}
.sidebar{width:350px;background:#fff;border-right:1px solid #e0e0e0;display:flex;flex-direction:column}
.sidebar-header{padding:20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-size:1.3em;color:#1a1a2e}
.sidebar-header .logout{background:#ff1744;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85em}
.search-box{padding:15px 20px;border-bottom:1px solid #e0e0e0}
.search-box input{width:100%;padding:10px 15px;border:2px solid #e0e0e0;border-radius:25px;font-size:0.9em;outline:none;background:#f5f5f5}
.search-box input:focus{border-color:#ff6600;background:#fff}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:15px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:0.2s;position:relative}
.user-item:hover{background:#f8f9fa}
.user-item.active{background:#fff7f0;border-left:4px solid #ff6600}
.user-avatar{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#ff6600,#ff8533);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.2em;flex-shrink:0}
.user-info{flex:1;min-width:0}
.user-name{font-weight:600;font-size:0.95em;color:#1a1a2e}
.user-email{font-size:0.8em;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-meta{display:flex;align-items:center;gap:8px;margin-top:4px}
.user-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.user-status.online{background:#10b981}
.user-status.offline{background:#cbd5e1}
.user-time{font-size:0.75em;color:#999}
.unread-badge{background:#ff1744;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.7em;font-weight:700;min-width:20px;text-align:center}

/* Chat Area */
.chat-area{flex:1;display:flex;flex-direction:column;background:#f5f5f5}
.chat-header{padding:20px;background:#fff;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:12px}
.chat-header .back-btn{display:none;background:none;border:none;font-size:1.5em;cursor:pointer;padding:5px}
.chat-header-info{flex:1}
.chat-header-name{font-weight:700;font-size:1.1em;color:#1a1a2e}
.chat-header-status{font-size:0.85em;color:#10b981}
.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:5px}
.empty-chat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#999;text-align:center}
.empty-chat .icon{font-size:4em;margin-bottom:15px}
.date-divider{text-align:center;margin:20px 0;position:relative}
.date-divider span{background:#f5f5f5;padding:5px 15px;border-radius:20px;font-size:0.8em;color:#999;position:relative;z-index:1}
.date-divider::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:#e0e0e0;z-index:0}
.msg-bubble{max-width:70%;padding:10px 15px;border-radius:18px;position:relative;word-wrap:break-word;animation:slideIn 0.3s}
@keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-bubble.user{background:#ff6600;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.msg-bubble.admin{background:#fff;color:#333;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.msg-bubble img{max-width:200px;border-radius:12px;cursor:pointer;display:block}
.msg-bubble .msg-time{font-size:0.7em;opacity:0.7;margin-top:5px;text-align:right;display:flex;align-items:center;gap:4px;justify-content:flex-end}
.msg-bubble.user .msg-time{color:rgba(255,255,255,0.8)}
.msg-bubble .seen-icon{font-size:0.8em}

/* Typing indicator */
.typing-indicator{padding:8px 20px;font-size:0.85em;color:#888;font-style:italic;display:none}
.typing-dots{display:flex;gap:3px;align-items:center}
.typing-dots span{width:6px;height:6px;border-radius:50%;background:#999;animation:typing 1.4s infinite}
.typing-dots span:nth-child(2){animation-delay:0.2s}
.typing-dots span:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-5px)}}

/* Chat Input */
.chat-input-area{padding:15px 20px;background:#fff;border-top:1px solid #e0e0e0;display:flex;align-items:center;gap:10px}
.chat-input-area input{flex:1;padding:12px 18px;border:2px solid #e0e0e0;border-radius:25px;font-size:0.95em;outline:none;transition:0.3s}
.chat-input-area input:focus{border-color:#ff6600}
.icon-btn{background:none;border:none;font-size:1.3em;cursor:pointer;padding:8px;border-radius:50%;transition:0.2s;width:40px;height:40px;display:flex;align-items:center;justify-content:center}
.icon-btn:hover{background:#f0f0f0}
.send-btn{background:#ff6600;color:#fff;border:none;width:45px;height:45px;border-radius:50%;cursor:pointer;font-size:1.2em;transition:0.3s;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.send-btn:hover{background:#e55a00;transform:scale(1.05)}

/* User Detail Sidebar */
.user-detail{width:300px;background:#fff;border-left:1px solid #e0e0e0;padding:20px;display:none;flex-direction:column}
.user-detail.open{display:flex}
.user-detail .close-detail{background:none;border:none;font-size:1.5em;cursor:pointer;align-self:flex-end}
.detail-header{text-align:center;margin-bottom:20px}
.detail-header .detail-avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#ff6600,#ff8533);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:2em;margin:0 auto 10px}
.detail-name{font-weight:700;font-size:1.2em}
.detail-email{color:#888;font-size:0.9em}
.detail-info{flex:1}
.detail-item{padding:12px 0;border-bottom:1px solid #f0f0f0}
.detail-item label{font-size:0.8em;color:#999;display:block;margin-bottom:4px}
.detail-item span{font-weight:500}
.delete-btn{width:100%;padding:12px;background:#ff1744;color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;margin-top:15px;transition:0.3s}
.delete-btn:hover{background:#d50000}

@media(max-width:1024px){
  .user-detail{display:none!important}
  .sidebar{width:100%}
  .chat-area{display:none}
  .chat-area.mobile-open{display:flex;position:fixed;top:0;left:0;right:0;bottom:0;z-index:10}
}
</style>
</head>
<body>

<!-- Login -->
<div class="login-overlay" id="loginOverlay">
  <div class="login-box">
    <h2>🔐 Admin Login</h2>
    <input type="text" id="adminEmail" placeholder="Email" value="admin">
    <input type="password" id="adminPassword" placeholder="Password" value="admin123">
    <button onclick="adminLogin()">Login to Admin Panel</button>
  </div>
</div>

<!-- App -->
<div class="app" id="app">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>💬 Messages</h2>
      <button class="logout" onclick="logout()">Logout</button>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="🔍 Search users..." oninput="filterUsers()">
    </div>
    <div class="user-list" id="userList"></div>
  </div>

  <!-- Chat Area -->
  <div class="chat-area" id="chatArea">
    <div class="chat-header">
      <button class="back-btn" id="backBtn" onclick="closeChatMobile()">←</button>
      <div class="chat-header-info">
        <div class="chat-header-name" id="chatHeaderName">Select a user</div>
        <div class="chat-header-status" id="chatHeaderStatus"></div>
      </div>
      <button class="icon-btn" onclick="toggleDetail()" title="User Info">ℹ️</button>
    </div>
    <div class="typing-indicator" id="typingIndicator"><div class="typing-dots"><span></span><span></span><span></span></div> typing...</div>
    <div class="chat-messages" id="chatMessages">
      <div class="empty-chat">
        <div class="icon">💬</div>
        <h3>Select a conversation</h3>
        <p>Choose a user from the left to view messages</p>
      </div>
    </div>
    <div class="chat-input-area" id="chatInputArea" style="display:none">
      <button class="icon-btn" onclick="document.getElementById('imageUpload').click()" title="Send Image">🖼️</button>
      <input type="file" id="imageUpload" accept="image/*" style="display:none" onchange="uploadImage()">
      <input type="text" id="adminMessageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendAdminMessage()">
      <button class="send-btn" onclick="sendAdminMessage()">➤</button>
    </div>
  </div>

  <!-- User Detail -->
  <div class="user-detail" id="userDetail">
    <button class="close-detail" onclick="toggleDetail()">✕</button>
    <div class="detail-header">
      <div class="detail-avatar" id="detailAvatar">?</div>
      <div class="detail-name" id="detailName"></div>
      <div class="detail-email" id="detailEmail"></div>
    </div>
    <div class="detail-info">
      <div class="detail-item"><label>Status</label><span id="detailStatus"></span></div>
      <div class="detail-item"><label>Messages</label><span id="detailMsgCount"></span></div>
      <div class="detail-item"><label>Joined</label><span id="detailJoined"></span></div>
      <div class="detail-item"><label>Last Active</label><span id="detailLastSeen"></span></div>
    </div>
    <button class="delete-btn" onclick="deleteConversation()">🗑️ Delete Conversation</button>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let token='',currentUser=null,socket=null,allUsers=[],isMobile=window.innerWidth<1024;

window.addEventListener('resize',()=>{isMobile=window.innerWidth<1024});

async function adminLogin(){
  const email=document.getElementById('adminEmail').value;
  const password=document.getElementById('adminPassword').value;
  try{
    const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(res.ok){
      document.getElementById('loginOverlay').style.display='none';
      document.getElementById('app').style.display='flex';
      initSocket();
      loadUsers();
    }else{alert('Invalid credentials')}
  }catch(e){alert('Login failed')}
}

function logout(){
  if(socket)socket.disconnect();
  document.getElementById('loginOverlay').style.display='flex';
  document.getElementById('app').style.display='none';
  currentUser=null;
}

function initSocket(){
  socket=io();
  socket.emit('register',{name:'Admin',email:'admin'});
  
  socket.on('newMsg',(msg)=>{
    if(currentUser&&(msg.sender===currentUser||msg.receiver===currentUser)){
      appendMessage(msg);
    }
    loadUsers(); // Refresh user list for unread counts
  });
  
  socket.on('userStatus',(data)=>{
    allUsers=allUsers.map(u=>({...u,isOnline:u.email===data.email?data.online:u.isOnline}));
    renderUsers();
    if(currentUser===data.email){
      document.getElementById('chatHeaderStatus').textContent=data.online?'● Online':'○ Offline';
    }
  });
  
  socket.on('typing',(data)=>{
    if(currentUser===data.from){
      document.getElementById('typingIndicator').style.display='block';
      setTimeout(()=>document.getElementById('typingIndicator').style.display='none',2000);
    }
  });
}

async function loadUsers(){
  try{
    const res=await fetch('/api/admin/users');
    allUsers=await res.json();
    renderUsers();
  }catch(e){console.error(e)}
}

function renderUsers(filter=''){
  const list=document.getElementById('userList');
  const filtered=filter?allUsers.filter(u=>u.name.toLowerCase().includes(filter)||u.email.toLowerCase().includes(filter)):allUsers;
  
  list.innerHTML=filtered.map(u=>{
    const isActive=currentUser===u.email;
    return `
    <div class="user-item${isActive?' active':''}" onclick="selectUser('${u.email}')">
      <div class="user-avatar">${u.name[0].toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-email">${u.email}</div>
        <div class="user-meta">
          <div class="user-status ${u.isOnline?'online':'offline'}"></div>
          <div class="user-time">${u.isOnline?'Online':u.lastSeen?'Last seen '+new Date(u.lastSeen).toLocaleDateString():''}</div>
        </div>
      </div>
      ${u.unreadCount>0?`<div class="unread-badge">${u.unreadCount}</div>`:''}
    </div>`;
  }).join('');
}

function filterUsers(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  renderUsers(q);
}

async function selectUser(email){
  currentUser=email;
  
  // UI updates
  document.getElementById('chatInputArea').style.display='flex';
  document.getElementById('chatHeaderName').textContent=allUsers.find(u=>u.email===email)?.name||email;
  document.getElementById('chatHeaderStatus').textContent=allUsers.find(u=>u.email===email)?.isOnline?'● Online':'○ Offline';
  
  // Mobile
  if(isMobile){
    document.getElementById('chatArea').classList.add('mobile-open');
  }
  
  // Update user detail
  updateDetailPanel(email);
  
  // Load messages
  const res=await fetch('/api/msgs/'+email);
  const msgs=await res.json();
  renderMessages(msgs,email);
  
  // Mark as read
  socket.emit('markRead',{user:email});
  
  renderUsers();
}

function renderMessages(msgs,email){
  const container=document.getElementById('chatMessages');
  if(msgs.length===0){
    container.innerHTML='<div class="empty-chat"><div class="icon">💬</div><h3>No messages yet</h3><p>Start the conversation</p></div>';
    return;
  }
  
  let html='';
  let lastDate='';
  
  msgs.forEach(m=>{
    const msgDate=new Date(m.timestamp).toLocaleDateString();
    if(msgDate!==lastDate){
      html+='<div class="date-divider"><span>'+msgDate+'</span></div>';
      lastDate=msgDate;
    }
    
    const isUser=m.sender===email;
    html+=`
    <div class="msg-bubble ${isUser?'user':'admin'}">
      ${m.type==='image'?`<img src="${m.fileUrl}" onclick="window.open(this.src)" loading="lazy">`:m.message}
      <div class="msg-time">
        ${new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
        ${!isUser&&m.seen?' <span class="seen-icon">✓✓</span>':!isUser?' <span class="seen-icon">✓</span>':''}
      </div>
    </div>`;
  });
  
  container.innerHTML=html;
  container.scrollTop=container.scrollHeight;
}

function appendMessage(m){
  const container=document.getElementById('chatMessages');
  const empty=container.querySelector('.empty-chat');
  if(empty)container.innerHTML='';
  
  const isUser=m.sender===currentUser;
  container.insertAdjacentHTML('beforeend',`
    <div class="msg-bubble ${isUser?'user':'admin'}">
      ${m.type==='image'?`<img src="${m.fileUrl}" onclick="window.open(this.src)">`:m.message}
      <div class="msg-time">${new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    </div>
  `);
  container.scrollTop=container.scrollHeight;
}

function sendAdminMessage(){
  if(!currentUser)return;
  const input=document.getElementById('adminMessageInput');
  const msg=input.value.trim();
  if(!msg)return;
  
  socket.emit('sendMsg',{sender:'admin',receiver:currentUser,message:msg,type:'text'});
  input.value='';
  input.focus();
}

function closeChatMobile(){
  document.getElementById('chatArea').classList.remove('mobile-open');
}

function toggleDetail(){
  document.getElementById('userDetail').classList.toggle('open');
}

function updateDetailPanel(email){
  const user=allUsers.find(u=>u.email===email);
  if(!user)return;
  document.getElementById('detailAvatar').textContent=user.name[0].toUpperCase();
  document.getElementById('detailName').textContent=user.name;
  document.getElementById('detailEmail').textContent=user.email;
  document.getElementById('detailStatus').textContent=user.isOnline?'Online':'Offline';
  document.getElementById('detailJoined').textContent=new Date(user.createdAt).toLocaleDateString();
  document.getElementById('detailLastSeen').textContent=user.lastSeen?new Date(user.lastSeen).toLocaleString():'Never';
}

async function uploadImage(){
  const file=document.getElementById('imageUpload').files[0];
  if(!file||!currentUser)return;
  const fd=new FormData();
  fd.append('image',file);
  fd.append('sender','admin');
  fd.append('receiver',currentUser);
  try{
    await fetch('/api/upload',{method:'POST',body:fd});
    document.getElementById('imageUpload').value='';
  }catch(e){console.error(e)}
}

async function deleteConversation(){
  if(!currentUser)return;
  if(!confirm('Delete all messages with this user?'))return;
  await fetch('/api/delete-msgs/'+currentUser,{method:'DELETE'});
  document.getElementById('chatMessages').innerHTML='<div class="empty-chat"><div class="icon">💬</div><h3>Conversation deleted</h3></div>';
  loadUsers();
}
</script>
</body>
</html>`);
});

// API routes
app.post('/api/admin/login',async(req,res)=>{
  const user=await User.findOne({email:req.body.email,isAdmin:true});
  if(!user)return res.status(400).json({error:'Not found'});
  const valid=await bcrypt.compare(req.body.password,user.password);
  if(!valid)return res.status(400).json({error:'Wrong password'});
  res.json({token:'admin_session'});
});

app.get('/api/admin/users',async(req,res)=>{
  const users=await User.find({isAdmin:false}).sort({lastSeen:-1}).lean();
  // Get unread count for each user
  for(let u of users){
    u.unreadCount=await Message.countDocuments({sender:u.email,receiver:'admin',seen:false});
  }
  res.json(users);
});

app.post('/api/upload',require('multer')({dest:'uploads/'}).single('image'),async(req,res)=>{
  const fileUrl='/uploads/'+req.file.filename;
  const msg=await Message.create({
    sender:req.body.sender,
    receiver:req.body.receiver,
    type:'image',
    fileUrl
  });
  io.emit('newMsg',msg);
  res.json(msg);
});

app.delete('/api/delete-msgs/:email',async(req,res)=>{
  await Message.deleteMany({$or:[{sender:req.params.email},{receiver:req.params.email}]});
  res.json({success:true});
});

// Socket.IO
io.on('connection',(socket)=>{
  socket.on('register',async(data)=>{
    socket.userData=data;
    let user=await User.findOne({email:data.email});
    if(!user){
      const hash=await bcrypt.hash('default123',10);
      user=await User.create({name:data.name,email:data.email,password:hash});
    }
    await User.updateOne({email:data.email},{$set:{isOnline:true,lastSeen:new Date()}});
    io.emit('userStatus',{email:data.email,online:true});
  });
  
  socket.on('sendMsg',async(data)=>{
    const msg=await Message.create({
      sender:data.sender,
      receiver:data.receiver,
      message:data.message,
      type:data.type||'text'
    });
    io.emit('newMsg',msg);
  });
  
  socket.on('markRead',async(data)=>{
    await Message.updateMany({sender:data.user,receiver:'admin',seen:false},{$set:{seen:true}});
  });
  
  socket.on('typing',(data)=>{
    socket.broadcast.emit('typing',data);
  });
  
  socket.on('disconnect',async()=>{
    if(socket.userData){
      await User.updateOne({email:socket.userData.email},{$set:{isOnline:false,lastSeen:new Date()}});
      io.emit('userStatus',{email:socket.userData.email,online:false});
    }
  });
});

server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));

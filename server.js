// Baiilla Maach Verification Hub with Integrated Chat
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
const MONGODB_URI=process.env.MONGODB_URI||'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';
const JWT_SECRET=process.env.JWT_SECRET||'baiilla_maach_secret_2024';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads',express.static('uploads'));
app.use('/assets',express.static('assets'));

// Create directories
['public','uploads','assets','assets/gallery','assets/covermusic','assets/chat_uploads'].forEach(d=>{
  if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
});

// Multer setup
const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,'uploads/'),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname)
});
const upload=multer({storage,limits:{fileSize:10*1024*1024}});

// MongoDB Models
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

const GallerySchema=new mongoose.Schema({
  path:{type:String,required:true},
  caption:{type:String},
  uploadedAt:{type:Date,default:Date.now}
});

const User=mongoose.model('User',UserSchema);
const Message=mongoose.model('Message',MessageSchema);
const Gallery=mongoose.model('Gallery',GallerySchema);

// Connect to MongoDB
mongoose.connect(MONGODB_URI).then(async()=>{
  console.log('MongoDB Connected');
  const adminExists=await User.findOne({phoneOrEmail:'admin'});
  if(!adminExists){
    const hash=await bcrypt.hash('admin123',10);
    await User.create({fullName:'Admin',phoneOrEmail:'admin',password:hash});
    console.log('Admin created');
  }
}).catch(err=>console.log('MongoDB Error:',err.message));

// Asset paths (your renamed files)
const IMG={
  profile:"/assets/celebrity_pfp.jpeg",
  fbProfile:"/assets/fb_profile.jpg",
  officialTikTok:"/assets/orginalss-tiktok.png",
  hammadFake:"/assets/hammadfams.png",
  baillamachFake:"/assets/baillamach_fake.png",
  fakeDetect:"/assets/Fakedetect_updown.png",
  realId:"/assets/real-id-ss.png",
  blueTikTok:"/assets/bluetick_tiktok.png",
  logoFB:"/assets/logo_fb.png",
  logoFBPage:"/assets/logo_fbpage.png",
  messageBubble:"/assets/message_bubble.gif",
  microphone:"/assets/microphone-in-hand.gif",
  reportBtn:"/assets/report_button.png",
  blueFB:"/assets/blue_tick_fb.png",
  logoTikTok:"/assets/logo_tiktok.png"
};

const WELCOME_VOICE=fs.existsSync(path.join(__dirname,'assets','realvoice.mp3'))?"/assets/realvoice.mp3":null;
const MANUAL_VOICE=fs.existsSync(path.join(__dirname,'assets','manualvoice_alert.mp3'))?"/assets/manualvoice_alert.mp3":null;

const DATA={
  name:"Baiilla Maach",
  fullName:"Baiilla Maach Official",
  photo:IMG.profile,
  fbPhoto:IMG.fbProfile,
  bio:"Official Entertainment Profile | Verified Creator",
  username:"@baiillamaach_official",
  fbUsername:"@BaiillaMaachOfficial",
  tiktokUrl:"https://tiktok.com/@baiillamaach_official",
  fbUrl:"https://www.facebook.com/profile.php?id=61575202118828",
  stats:{followers:"7K",following:"0",likes:"190K"},
  fakeAccounts:[
    {platform:"TikTok",username:"@baiilla_mach",profileUrl:"https://tiktok.com/@baiilla_mach",screenshot:IMG.baillamachFake,reason:"Copies official logo and content to deceive followers."},
    {platform:"TikTok",username:"@hammad_fams0",profileUrl:"https://tiktok.com/@hammad_fams0",screenshot:IMG.hammadFake,reason:"Uses official name and photo to mislead followers."}
  ]
};

function getSongs(){
  try{
    const dir=path.join(__dirname,'assets','covermusic');
    if(!fs.existsSync(dir))return[];
    return fs.readdirSync(dir).filter(f=>['.mp3','.wav','.ogg','.m4a'].includes(path.extname(f).toLowerCase())).map((f,i)=>{
      const n=path.basename(f,path.extname(f)).replace(/[-_]/g,' ').replace(/\b\w/g,l=>l.toUpperCase()).trim();
      return{id:'t_'+i,title:n||'Track '+(i+1),artist:'Baiilla Maach',audioUrl:'/assets/covermusic/'+encodeURIComponent(f)}
    });
  }catch(e){return[]}
}

// ============ MAIN WEBSITE HTML ============
function getMainPage(gallery=[]){
  const songs=getSongs();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ff6600">
<title>${DATA.fullName} | Official Verification Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafafa;color:#333;line-height:1.6;overflow-x:hidden}

/* Header */
.header{background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);border-bottom:1px solid #e0e0e0;padding:12px 20px;position:sticky;top:0;z-index:999;display:flex;justify-content:space-between;align-items:center}
.logo{display:flex;align-items:center;gap:10px}
.logo img{width:45px;height:45px;border-radius:50%;border:2px solid #ff6600;object-fit:cover}
.logo span{font-weight:700;color:#1a1a2e;font-size:1.1em}
.header-btns{display:flex;gap:10px;align-items:center}
.btn-chat{background:linear-gradient(135deg,#00c853,#00e676);color:#fff;padding:10px 20px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:6px;cursor:pointer;border:none;box-shadow:0 4px 15px rgba(0,200,83,0.3);transition:0.3s}
.btn-chat:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,200,83,0.4)}
.btn-admin{background:#fff;color:#ff6600;padding:8px 16px;border-radius:50px;text-decoration:none;font-weight:600;border:2px solid #ff6600;font-size:0.9em}

/* Hero */
.hero{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);padding:60px 20px;text-align:center;color:#fff;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;width:200%;height:200%;top:-50%;left:-50%;background:radial-gradient(circle,rgba(255,102,0,0.15) 0%,transparent 60%);animation:rotate 30s linear infinite}
@keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.hero-content{position:relative;z-index:2;max-width:600px;margin:0 auto}
.hero img{width:140px;height:140px;border-radius:50%;border:4px solid #ff6600;margin-bottom:15px;object-fit:cover}
.hero h1{font-size:2.5em;font-weight:800;margin-bottom:5px;background:linear-gradient(135deg,#fff,#ff8533);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero .username{font-size:1.1em;opacity:0.9}
.hero .bio{opacity:0.8;margin-bottom:15px}
.hero-stats{display:flex;justify-content:center;gap:30px;margin:20px 0;flex-wrap:wrap}
.hero-stat{text-align:center}
.hero-stat-num{font-size:1.5em;font-weight:800;color:#ff6600}
.hero-stat-label{font-size:0.85em;opacity:0.7}
.verified-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(0,200,83,0.2);padding:10px 20px;border-radius:50px;border:1px solid rgba(0,200,83,0.3);margin-bottom:20px}
.social-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.social-btn{padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:600;color:#fff;transition:0.3s;display:flex;align-items:center;gap:8px}
.social-btn.tiktok{background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2)}
.social-btn.facebook{background:rgba(24,119,242,0.6);border:1px solid rgba(255,255,255,0.2)}
.social-btn:hover{transform:translateY(-2px)}

/* Sections */
.section{padding:60px 20px}
.container{max-width:1200px;margin:0 auto}
.section-title{font-size:2em;color:#1a1a2e;text-align:center;margin-bottom:10px}
.section-subtitle{color:#666;text-align:center;margin-bottom:40px}

/* Official Card */
.official-card{background:#fff;border-radius:16px;padding:30px;display:grid;grid-template-columns:1fr 1fr;gap:24px;border:2px solid #c8e6c9;box-shadow:0 4px 20px rgba(0,0,0,0.08);margin-bottom:20px}
.info-row{display:flex;align-items:center;gap:10px;padding:10px;background:#f5f5f5;border-radius:8px;margin-bottom:10px}
.platform-card{background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;border-radius:16px;color:#fff;text-align:center}
.platform-card img{width:80px;height:80px;border-radius:50%;border:3px solid #fff;margin-bottom:12px;object-fit:cover}
.btn-follow{display:inline-block;background:#fff;color:#667eea;padding:10px 24px;border-radius:50px;text-decoration:none;font-weight:600;margin-top:10px}

/* Fake Cards */
.fake-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}
.fake-card{background:#fff;border-radius:16px;overflow:hidden;border:2px solid #ffcdd2;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
.fake-card img{width:100%;height:200px;object-fit:cover}
.fake-content{padding:20px}
.fake-content h3{font-size:1.2em;margin-bottom:8px;color:#1a1a2e}
.fake-content .platform{color:#ff6600;font-weight:600;margin-bottom:8px}
.fake-content p{color:#666;margin-bottom:12px;line-height:1.6}
.btn-report{display:inline-flex;align-items:center;gap:6px;background:#ff1744;color:#fff;padding:8px 16px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.9em}

/* Features */
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:20px}
.feature-card{background:#fff;padding:24px;border-radius:12px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.07);transition:0.3s;cursor:pointer}
.feature-card:hover{transform:translateY(-5px);box-shadow:0 8px 25px rgba(0,0,0,0.12)}
.feature-card img{width:48px;margin-bottom:12px}
.feature-card h3{font-size:1.1em;margin-bottom:6px;color:#1a1a2e}
.feature-card p{color:#666;font-size:0.9em}

/* Voice Section */
.voice-section{background:#fff;padding:40px 20px;text-align:center}
.voice-buttons{display:flex;gap:20px;justify-content:center;flex-wrap:wrap}
.voice-btn{padding:14px 28px;border-radius:50px;border:none;font-weight:600;cursor:pointer;font-size:1em;transition:0.3s;display:flex;align-items:center;gap:8px}
.voice-btn.welcome{background:#ff6600;color:#fff}
.voice-btn.manual{background:#ff1744;color:#fff}
.voice-btn:hover{transform:translateY(-2px)}

/* Proof */
.proof-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}
.proof-card{background:#f8f9fa;border-radius:12px;padding:20px;text-align:center;border:1px solid #e0e0e0}
.proof-card img{max-width:100%;border-radius:8px;margin-bottom:10px}

/* Footer */
.footer{background:#1a1a2e;color:#fff;padding:40px 20px;text-align:center}
.footer-content{max-width:1200px;margin:0 auto 30px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:30px;text-align:left}
.footer h3{color:#ff6600;margin-bottom:15px}
.footer p,.footer a{color:rgba(255,255,255,0.7);line-height:1.8;text-decoration:none}
.footer a:hover{color:#fff}
.footer-bottom{border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;color:rgba(255,255,255,0.5);font-size:0.9em}

/* Chat Widget */
.chat-widget{position:fixed;bottom:30px;right:30px;z-index:998}
.chat-bubble{width:65px;height:65px;background:#00c853;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 25px rgba(0,200,83,0.4);transition:0.3s;animation:bounce 2s infinite}
.chat-bubble:hover{transform:scale(1.1)}
.chat-bubble img{width:35px;height:35px}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.chat-window{display:none;position:fixed;bottom:100px;right:30px;width:380px;height:500px;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:999}
.chat-window.open{display:flex}
.chat-window-header{background:#ff6600;color:#fff;padding:15px 20px;display:flex;align-items:center;justify-content:space-between}
.chat-window-header h3{font-size:1em}
.chat-close{background:none;border:none;color:#fff;font-size:1.3em;cursor:pointer}
.chat-window-body{flex:1;overflow-y:auto;padding:15px;background:#f5f5f5;display:flex;flex-direction:column;gap:8px}
.chat-window-input{padding:12px 15px;background:#fff;border-top:1px solid #e0e0e0;display:flex;gap:8px;align-items:center}
.chat-window-input input{flex:1;padding:10px 14px;border:2px solid #e0e0e0;border-radius:25px;outline:none;font-size:0.9em}
.chat-window-input input:focus{border-color:#ff6600}
.chat-window-input button{background:#ff6600;color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em;flex-shrink:0}
.chat-msg{max-width:80%;padding:10px 14px;border-radius:18px;word-wrap:break-word;font-size:0.9em}
.chat-msg.user{background:#ff6600;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.chat-msg.admin{background:#fff;color:#333;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.chat-msg img{max-width:150px;border-radius:10px}
.chat-msg audio{max-width:150px}
.chat-time{font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}
.chat-login{text-align:center;padding:20px}
.chat-login input{width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:8px}
.chat-login button{width:100%;padding:10px;background:#ff6600;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}

@media(max-width:768px){
  .hero h1{font-size:1.8em}
  .official-card{grid-template-columns:1fr}
  .chat-window{width:100%;height:100%;bottom:0;right:0;border-radius:0}
  .chat-bubble{bottom:20px;right:20px}
}
</style>
</head>
<body>

<header class="header">
  <div class="logo">
    <img src="${DATA.photo}" alt="${DATA.name}">
    <span>${DATA.name}</span>
  </div>
  <div class="header-btns">
    <a href="/admin" class="btn-admin">🔐 Admin</a>
  </div>
</header>

<section class="hero">
  <div class="hero-content">
    <img src="${DATA.photo}" alt="${DATA.fullName}">
    <h1>${DATA.fullName}</h1>
    <p class="username">${DATA.username}</p>
    <p class="bio">${DATA.bio}</p>
    <div class="hero-stats">
      <div class="hero-stat"><div class="hero-stat-num">${DATA.stats.followers}</div><div class="hero-stat-label">Followers</div></div>
      <div class="hero-stat"><div class="hero-stat-num">${DATA.stats.following}</div><div class="hero-stat-label">Following</div></div>
      <div class="hero-stat"><div class="hero-stat-num">${DATA.stats.likes}</div><div class="hero-stat-label">Likes</div></div>
    </div>
    <div class="verified-badge"><span>✅ VERIFIED OFFICIAL ACCOUNT</span></div>
    <div class="social-btns">
      <a href="${DATA.tiktokUrl}" target="_blank" class="social-btn tiktok">🎵 TikTok</a>
      <a href="${DATA.fbUrl}" target="_blank" class="social-btn facebook">📘 Facebook</a>
    </div>
  </div>
</section>

<section class="section" style="background:#fff;">
  <div class="container">
    <h2 class="section-title">Why Trust This Hub?</h2>
    <p class="section-subtitle">Everything you need to verify the authentic Baiilla Maach</p>
    <div class="features-grid">
      <div class="feature-card" onclick="openChat()">
        <img src="${IMG.messageBubble}" alt="Chat">
        <h3>Direct Chat</h3>
        <p>Chat with verified account</p>
      </div>
      <div class="feature-card">
        <img src="${IMG.reportBtn}" alt="Report">
        <h3>Report Fakes</h3>
        <p>Help identify fake accounts</p>
      </div>
      <div class="feature-card">
        <img src="${IMG.logoTikTok}" alt="TikTok">
        <h3>TikTok Verified</h3>
        <p>Blue tick verification</p>
      </div>
      <div class="feature-card">
        <img src="${IMG.logoFBPage}" alt="Facebook">
        <h3>Facebook Verified</h3>
        <p>Official page badge</p>
      </div>
    </div>
  </div>
</section>

<section class="section" style="background:#f8fff8;">
  <div class="container">
    <h2 class="section-title">✅ Official Verified Account</h2>
    <p class="section-subtitle">The ONLY authentic Baiilla Maach accounts</p>
    <div class="official-card">
      <div>
        <h3 style="margin-bottom:20px;">Verified Details</h3>
        <div class="info-row"><span>✅</span><div><strong>Status:</strong> <span style="color:#00c853;">● Active & Verified</span></div></div>
        <div class="info-row"><span>📱</span><div><strong>TikTok:</strong> ${DATA.username}</div></div>
        <div class="info-row"><span>📘</span><div><strong>Facebook:</strong> ${DATA.fbUsername}</div></div>
        <div class="info-row"><span>🆔</span><div><strong>Identity:</strong> <span style="color:#00c853;">Real ID Confirmed</span></div></div>
      </div>
      <div>
        <div class="platform-card">
          <img src="${IMG.fbProfile}" alt="FB Profile">
          <p style="font-size:1.2em;font-weight:700;">Baiilla Maach</p>
          <p style="opacity:0.9;">${DATA.fbUsername}</p>
          <a href="${DATA.fbUrl}" target="_blank" class="btn-follow">Follow on Facebook</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" style="background:#fff5f5;">
  <div class="container">
    <h2 class="section-title">⚠️ Beware of Fake Accounts</h2>
    <p class="section-subtitle">${DATA.fakeAccounts.length} fake accounts detected - Report them</p>
    <div class="fake-grid">
      ${DATA.fakeAccounts.map(acc=>`
      <div class="fake-card">
        <img src="${acc.screenshot}" alt="Fake">
        <div class="fake-content">
          <h3>${acc.username}</h3>
          <p class="platform">📍 ${acc.platform}</p>
          <p>${acc.reason}</p>
          <a href="${acc.profileUrl}" target="_blank" class="btn-report">🚨 Report Account</a>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>

${WELCOME_VOICE||MANUAL_VOICE?`
<section class="voice-section">
  <div class="container">
    <h2 class="section-title">🔊 Voice Verification</h2>
    <p class="section-subtitle">Listen to verify authentic Baiilla Maach</p>
    <div class="voice-buttons">
      ${WELCOME_VOICE?`<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>`:''}
      ${MANUAL_VOICE?`<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert</button>`:''}
    </div>
  </div>
</section>`:''}

<section class="section" style="background:#fff;">
  <div class="container">
    <h2 class="section-title">🔒 Identity Proof</h2>
    <p class="section-subtitle">Evidence of official verification</p>
    <div class="proof-grid">
      <div class="proof-card"><img src="${IMG.realId}" alt="ID"><p style="font-weight:600;">Real ID Verification</p></div>
      <div class="proof-card"><img src="${IMG.fakeDetect}" alt="Fake"><p style="font-weight:600;">Fake Account Detection</p></div>
      <div class="proof-card"><img src="${IMG.microphone}" alt="Voice"><p style="font-weight:600;">Real Voice Note</p></div>
    </div>
  </div>
</section>

<footer class="footer">
  <div class="footer-content">
    <div><h3>About</h3><p>Official verification hub for Baiilla Maach. Helping fans identify authentic accounts.</p></div>
    <div><h3>Links</h3><p><a href="${DATA.tiktokUrl}" target="_blank">TikTok</a></p><p><a href="${DATA.fbUrl}" target="_blank">Facebook</a></p></div>
    <div><h3>Contact</h3><p>Use the chat widget for support</p></div>
  </div>
  <div class="footer-bottom"><p>© 2024 ${DATA.fullName}. All Rights Reserved.</p></div>
</footer>

<!-- Chat Widget -->
<div class="chat-widget">
  <div class="chat-bubble" onclick="toggleChat()">
    <img src="${IMG.messageBubble}" alt="Chat">
  </div>
  <div class="chat-window" id="chatWindow">
    <div class="chat-window-header">
      <h3>💬 Baiilla Maach Support</h3>
      <button class="chat-close" onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-window-body" id="chatBody">
      <div class="chat-login" id="chatLogin">
        <h4 style="margin-bottom:15px;">Start Chat</h4>
        <input type="text" id="chatName" placeholder="Your Name">
        <input type="text" id="chatEmail" placeholder="Email or Phone">
        <button onclick="startChat()">Start Chatting</button>
      </div>
    </div>
    <div class="chat-window-input" id="chatInput" style="display:none;">
      <input type="file" id="chatImageInput" accept="image/*" style="display:none;">
      <button onclick="document.getElementById('chatImageInput').click()" style="background:#e0e0e0;color:#333;">📎</button>
      <input type="text" id="chatMessageInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
      <button onclick="sendChatMsg()">➤</button>
    </div>
  </div>
</div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="${WELCOME_VOICE}" preload="auto"></audio>`:''}
${MANUAL_VOICE?`<audio id="manualAudio" src="${MANUAL_VOICE}" preload="auto"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
// Welcome voice auto-play
window.addEventListener('load',()=>{
  const wa=document.getElementById('welcomeAudio');
  if(wa)setTimeout(()=>wa.play().catch(()=>{}),1000);
});

function playWelcome(){
  const a=document.getElementById('welcomeAudio');
  if(a){a.currentTime=0;a.play()}
}
function playManual(){
  const a=document.getElementById('manualAudio');
  if(a){a.currentTime=0;a.play()}
}

// Chat Widget
let chatUser=null;
const socket=io();

function toggleChat(){
  const w=document.getElementById('chatWindow');
  w.classList.toggle('open');
}

function openChat(){
  document.getElementById('chatWindow').classList.add('open');
}

function startChat(){
  const name=document.getElementById('chatName').value.trim();
  const email=document.getElementById('chatEmail').value.trim();
  if(!name||!email)return alert('Please fill all fields');
  chatUser={name,email};
  socket.emit('chatRegister',{name,email});
  document.getElementById('chatLogin').style.display='none';
  document.getElementById('chatInput').style.display='flex';
  loadChatHistory();
}

async function loadChatHistory(){
  if(!chatUser)return;
  const res=await fetch('/api/chat/messages/'+chatUser.email);
  const msgs=await res.json();
  const body=document.getElementById('chatBody');
  body.innerHTML=msgs.map(m=>renderChatMsg(m)).join('');
  body.scrollTop=body.scrollHeight;
}

function renderChatMsg(m){
  const cls=m.sender===chatUser.email?'user':'admin';
  let content='';
  if(m.type==='image')content='<img src="'+m.fileUrl+'">';
  else if(m.type==='voice')content='<audio controls src="'+m.fileUrl+'"></audio>';
  else content=m.message;
  return '<div class="chat-msg '+cls+'">'+content+'<div class="chat-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
}

function sendChatMsg(){
  const input=document.getElementById('chatMessageInput');
  const msg=input.value.trim();
  if(!msg||!chatUser)return;
  socket.emit('chatMessage',{sender:chatUser.email,receiver:'admin',message:msg,type:'text',senderName:chatUser.name});
  input.value='';
}

socket.on('chatMessage',(msg)=>{
  if(chatUser&&(msg.sender===chatUser.email||msg.receiver===chatUser.email)){
    const body=document.getElementById('chatBody');
    body.insertAdjacentHTML('beforeend',renderChatMsg(msg));
    body.scrollTop=body.scrollHeight;
  }
});

document.getElementById('chatImageInput').addEventListener('change',async(e)=>{
  const file=e.target.files[0];
  if(!file||!chatUser)return;
  const fd=new FormData();
  fd.append('image',file);
  fd.append('sender',chatUser.email);
  const res=await fetch('/api/chat/upload/image',{method:'POST',body:fd});
  if(res.ok)e.target.value='';
});
</script>
</body>
</html>`;
}

// ============ ROUTES ============
app.get('/',async(req,res)=>{
  const gallery=await Gallery.find({}).sort({uploadedAt:-1});
  res.send(getMainPage(gallery));
});

app.get('/admin',(req,res)=>{
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Admin | Baiilla Maach</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:sans-serif;background:#f5f5f5;display:flex;height:100vh}
.sidebar{width:300px;background:#1a1a2e;color:#fff;display:flex;flex-direction:column}
.sidebar-header{padding:20px;border-bottom:1px solid rgba(255,255,255,0.1)}
.sidebar-header h2{color:#ff6600}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:15px 20px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05)}
.user-item:hover{background:rgba(255,102,0,0.1)}
.user-item.active{background:#ff6600}
.user-avatar{width:40px;height:40px;border-radius:50%;background:#ff6600;display:flex;align-items:center;justify-content:center;font-weight:700}
.chat-area{flex:1;display:flex;flex-direction:column;background:#fff}
.chat-header{padding:15px 20px;background:#ff6600;color:#fff}
.chat-messages{flex:1;overflow-y:auto;padding:20px;background:#f5f5f5}
.chat-input{padding:15px 20px;display:flex;gap:10px;border-top:1px solid #e0e0e0}
.chat-input input{flex:1;padding:10px;border:1px solid #ddd;border-radius:20px}
.chat-input button{background:#ff6600;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600}
.msg{max-width:70%;padding:10px 14px;border-radius:18px;margin-bottom:8px;font-size:0.9em}
.msg.user{background:#ff6600;color:#fff;margin-left:auto}
.msg.admin{background:#fff;color:#333}
.login-box{width:400px;margin:100px auto;background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
.login-box h2{text-align:center;margin-bottom:30px}
.login-box input{width:100%;padding:12px;margin-bottom:15px;border:1px solid #ddd;border-radius:8px}
.login-box button{width:100%;padding:12px;background:#ff6600;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
</style></head>
<body>
<div id="loginForm" class="login-box">
  <h2>🔐 Admin Login</h2>
  <input type="text" id="adminUser" placeholder="Username" value="admin">
  <input type="password" id="adminPass" placeholder="Password" value="admin123">
  <button onclick="adminLogin()">Login</button>
</div>
<div id="app" style="display:none;width:100%;">
  <div class="sidebar">
    <div class="sidebar-header"><h2>Chat Users</h2></div>
    <div class="user-list" id="userList"></div>
  </div>
  <div class="chat-area">
    <div class="chat-header" id="chatHeader">Select a user</div>
    <div class="chat-messages" id="chatMessages"><div style="text-align:center;color:#999;padding:40px;">Select a user to chat</div></div>
    <div class="chat-input" id="chatInputArea" style="display:none">
      <input type="text" id="adminMsgInput" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendReply()">
      <button onclick="sendReply()">Send</button>
    </div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
let token='',selectedUser=null,socket=null,allUsers=[];
async function adminLogin(){
  const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('adminUser').value,password:document.getElementById('adminPass').value})});
  const data=await res.json();
  if(res.ok){token=data.token;document.getElementById('loginForm').style.display='none';document.getElementById('app').style.display='flex';initSocket();loadUsers()}else alert('Login failed')
}
function initSocket(){socket=io();socket.on('connect',()=>socket.emit('chatRegister',{name:'Admin',email:'admin'}));socket.on('chatMessage',(msg)=>{if(selectedUser===msg.sender||selectedUser===msg.receiver)appendMsg(msg);loadUsers()})}
async function loadUsers(){const res=await fetch('/api/admin/users',{headers:{Authorization:'Bearer '+token}});allUsers=await res.json();renderUsers()}
function renderUsers(){document.getElementById('userList').innerHTML=allUsers.filter(u=>u.phoneOrEmail!=='admin').map(u=>'<div class="user-item'+(selectedUser===u.phoneOrEmail?' active':'')+'" onclick="selectUser(\''+u.phoneOrEmail+'\')"><div class="user-avatar">'+u.fullName[0].toUpperCase()+'</div><div><div style="font-weight:600;">'+u.fullName+'</div><div style="font-size:0.8em;opacity:0.7;">'+u.phoneOrEmail+'</div></div></div>').join('')}
async function selectUser(email){selectedUser=email;document.getElementById('chatInputArea').style.display='flex';document.getElementById('chatHeader').innerHTML='<strong>Chat with '+email+'</strong>';const res=await fetch('/api/chat/messages/'+email);const msgs=await res.json();const c=document.getElementById('chatMessages');c.innerHTML=msgs.map(m=>'<div class="msg '+(m.sender===email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:10px;">':m.message)+'</div>').join('');c.scrollTop=c.scrollHeight;renderUsers()}
function appendMsg(m){const c=document.getElementById('chatMessages');c.insertAdjacentHTML('beforeend','<div class="msg '+(m.sender===selectedUser?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:10px;">':m.message)+'</div>');c.scrollTop=c.scrollHeight}
async function sendReply(){if(!selectedUser)return;const input=document.getElementById('adminMsgInput');const msg=input.value.trim();if(!msg)return;socket.emit('chatMessage',{sender:'admin',receiver:selectedUser,message:msg,type:'text',senderName:'Admin'});input.value=''}
</script></body></html>`);
});

// API Routes
app.post('/api/admin/login',async(req,res)=>{
  try{
    const{username,password}=req.body;
    const user=await User.findOne({phoneOrEmail:username});
    if(!user)return res.status(400).json({error:'User not found'});
    const valid=await bcrypt.compare(password,user.password);
    if(!valid)return res.status(400).json({error:'Invalid password'});
    const token=jwt.sign({phoneOrEmail:user.phoneOrEmail,fullName:user.fullName},JWT_SECRET,{expiresIn:'7d'});
    res.json({token});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/api/admin/users',async(req,res)=>{
  const users=await User.find({}).select('-password').sort({lastSeen:-1});
  res.json(users);
});

app.get('/api/chat/messages/:email',async(req,res)=>{
  const msgs=await Message.find({$or:[{sender:req.params.email},{receiver:req.params.email}]}).sort({timestamp:1});
  res.json(msgs);
});

app.post('/api/chat/upload/image',upload.single('image'),async(req,res)=>{
  try{
    const fileUrl='/uploads/'+req.file.filename;
    const msg=await Message.create({sender:req.body.sender,receiver:'admin',type:'image',fileUrl});
    io.emit('chatMessage',msg);
    res.json(msg);
  }catch(e){res.status(500).json({error:e.message})}
});

// Socket.IO
io.on('connection',(socket)=>{
  socket.on('chatRegister',async(data)=>{
    socket.userData=data;
    let user=await User.findOne({phoneOrEmail:data.email});
    if(!user)user=await User.create({fullName:data.name,phoneOrEmail:data.email,password:await bcrypt.hash('default123',10)});
    await User.updateOne({phoneOrEmail:data.email},{$set:{isOnline:true}});
  });

  socket.on('chatMessage',async(data)=>{
    const msg=await Message.create({sender:data.sender,receiver:data.receiver,message:data.message,type:data.type||'text'});
    io.emit('chatMessage',msg);
  });

  socket.on('disconnect',async()=>{
    if(socket.userData){
      await User.updateOne({phoneOrEmail:socket.userData.email},{$set:{isOnline:false,lastSeen:new Date()}});
    }
  });
});

server.listen(PORT,()=>console.log(`Verification Hub running on port ${PORT}`));

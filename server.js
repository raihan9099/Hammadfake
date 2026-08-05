// Baiilla Maach Verification Hub - Complete
require('dotenv').config();
process.on('uncaughtException',(e)=>{console.error(e.message);if(e.code==='EADDRINUSE')process.exit(1)});
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
app.use(express.urlencoded({extended:true}));
app.use('/assets',express.static('assets'));
app.use('/uploads',express.static('uploads'));

['uploads','assets','assets/gallery','assets/covermusic'].forEach(d=>{
  if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
});

const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,'uploads/'),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname)
});
const upload=multer({storage});

// MongoDB
const UserSchema=new mongoose.Schema({
  name:String,email:{type:String,unique:true},password:String,
  isAdmin:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now}
});
const MessageSchema=new mongoose.Schema({
  sender:String,receiver:String,message:String,type:{type:String,default:'text'},
  fileUrl:String,timestamp:{type:Date,default:Date.now}
});
const User=mongoose.model('User',UserSchema);
const Message=mongoose.model('Message',MessageSchema);

mongoose.connect(MONGO_URI).then(async()=>{
  console.log('MongoDB Connected');
  const admin=await User.findOne({email:'admin'});
  if(!admin){const hash=await bcrypt.hash('admin123',10);await User.create({name:'Baiilla Maach',email:'admin',password:hash,isAdmin:true});}
}).catch(e=>console.log('MongoDB Error:',e.message));

// Asset paths - YOUR RENAMED FILES
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

const WELCOME_VOICE=fs.existsSync('assets/realvoice.mp3')?"/assets/realvoice.mp3":null;
const MANUAL_VOICE=fs.existsSync('assets/manualvoice_alert.mp3')?"/assets/manualvoice_alert.mp3":null;

function getSongs(){
  try{
    const dir='assets/covermusic';
    if(!fs.existsSync(dir))return[];
    return fs.readdirSync(dir).filter(f=>['.mp3','.wav','.ogg','.m4a'].includes(path.extname(f).toLowerCase())).map((f,i)=>{
      const n=path.basename(f,path.extname(f)).replace(/[-_]/g,' ').replace(/\b\w/g,l=>l.toUpperCase()).trim();
      return{id:i,title:n||'Track '+(i+1),artist:'Baiilla Maach',url:'/assets/covermusic/'+encodeURIComponent(f)}
    });
  }catch(e){return[]}
}

app.get('/',(req,res)=>{
  const songs=getSongs();
  
  let musicHTML='';
  if(songs.length>0){
    musicHTML=`
    <section style="padding:70px 20px;background:#fff;">
      <div style="max-width:800px;margin:0 auto;text-align:center;">
        <h2 style="font-size:2.2em;font-weight:800;color:#1a1a2e;margin-bottom:10px;">🎵 Official Cover Songs</h2>
        <p style="color:#666;margin-bottom:40px;font-size:1.05em;">Original covers by Baiilla Maach - Listen & Verify</p>
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:20px;padding:35px;color:#fff;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
          <img src="${IMG.profile}" style="width:120px;height:120px;border-radius:50%;border:4px solid #ff6600;object-fit:cover;margin-bottom:15px;" onerror="this.style.display='none'">
          <h3 id="trackTitle" style="font-size:1.4em;margin-bottom:5px;">Select a Track</h3>
          <p id="trackArtist" style="color:#ff6600;font-weight:600;margin-bottom:20px;">Baiilla Maach</p>
          <div style="display:flex;justify-content:center;align-items:center;gap:20px;margin-bottom:15px;">
            <button onclick="prevTrack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:45px;height:45px;border-radius:50%;cursor:pointer;font-size:1.3em;transition:0.3s;">⏮</button>
            <button id="playBtn" onclick="togglePlay()" style="background:#ff6600;border:none;color:#fff;width:65px;height:65px;border-radius:50%;cursor:pointer;font-size:1.6em;transition:0.3s;box-shadow:0 5px 20px rgba(255,102,0,0.4);">▶️</button>
            <button onclick="nextTrack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:45px;height:45px;border-radius:50%;cursor:pointer;font-size:1.3em;transition:0.3s;">⏭</button>
          </div>
          <div style="background:rgba(255,255,255,0.2);height:6px;border-radius:3px;cursor:pointer;margin:10px 0;" onclick="seekTrack(event)">
            <div id="progressBar" style="background:#ff6600;height:100%;border-radius:3px;width:0%;transition:width 0.1s linear;"></div>
          </div>
          <div style="font-size:0.9em;opacity:0.9;"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
        </div>
        <div style="background:#fff;border-radius:16px;margin-top:15px;box-shadow:0 4px 20px rgba(0,0,0,0.06);overflow:hidden;">
          ${songs.map((s,i)=>`
          <div onclick="playTrack(${i})" class="playlist-item" style="padding:14px 24px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:15px;transition:0.2s;text-align:left;">
            <span style="font-weight:700;color:#999;min-width:30px;font-size:1.1em;">${String(i+1).padStart(2,'0')}</span>
            <span style="flex:1;font-weight:500;">${s.title}</span>
            <span style="color:#ff6600;font-size:1.2em;">🎵</span>
          </div>`).join('')}
        </div>
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
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;color:#1a1a2e;line-height:1.6}
.header{background:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e8e8e8;position:sticky;top:0;z-index:100}
.header-left{display:flex;align-items:center;gap:10px}
.header-left img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #ff6600}
.header-left span{font-weight:700;font-size:1.1em}
.header-right{display:flex;gap:10px;align-items:center}
.btn-chat{background:#00c853;color:#fff;padding:10px 20px;border-radius:50px;border:none;font-weight:600;font-size:0.9em;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-chat img{width:22px;height:22px}
.btn-admin{color:#ff6600;padding:10px 20px;border-radius:50px;text-decoration:none;font-weight:600;border:2px solid #ff6600;font-size:0.9em}
.hero{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);color:#fff;padding:80px 20px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(255,102,0,0.1) 0%,transparent 60%);animation:spin 30s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.hero-content{position:relative;z-index:1;max-width:600px;margin:0 auto}
.hero-img-wrap{position:relative;display:inline-block}
.hero-img-wrap img:first-child{width:140px;height:140px;border-radius:50%;border:4px solid #ff6600;object-fit:cover}
.hero-blue-tick{position:absolute;bottom:12px;right:12px;width:34px;height:34px}
.hero h1{font-size:2.8em;font-weight:800;margin:15px 0 5px}
.hero .handle{font-size:1.1em;opacity:0.9;margin-bottom:5px}
.hero .bio{opacity:0.8;margin-bottom:20px}
.stats{display:flex;justify-content:center;gap:40px;margin:20px 0}
.stat-item{text-align:center}
.stat-num{font-size:1.6em;font-weight:800;color:#ff6600}
.stat-label{font-size:0.85em;opacity:0.7}
.verified-tag{display:inline-flex;align-items:center;gap:8px;background:rgba(0,200,83,0.2);padding:10px 24px;border-radius:50px;border:1px solid rgba(0,200,83,0.3);margin-bottom:25px;font-weight:600;color:#00e676}
.social-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.social-btn{padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px;transition:0.3s}
.social-btn.tiktok{background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2)}
.social-btn.tiktok:hover{background:#000;transform:translateY(-2px)}
.social-btn.facebook{background:rgba(24,119,242,0.5);border:1px solid rgba(255,255,255,0.2)}
.social-btn.facebook:hover{background:#1877f2;transform:translateY(-2px)}
.section{padding:70px 20px;text-align:center}
.section:nth-child(odd){background:#fff}
.section-title{font-size:2.2em;font-weight:800;margin-bottom:10px;color:#1a1a2e}
.section-sub{color:#666;margin-bottom:40px;font-size:1.05em}
.container{max-width:1100px;margin:0 auto}
.verified-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px;margin:0 auto;text-align:left}
.verified-card{background:#fff;border-radius:16px;padding:30px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:2px solid #e8e8e8}
.verified-card.tiktok-card{border-color:#00f2ea}
.verified-card.fb-card{border-color:#1877f2}
.card-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.card-header .pfp{width:50px;height:50px;border-radius:50%;object-fit:cover}
.card-header .platform-info{flex:1}
.card-header .platform-name{font-weight:700;font-size:1.2em;display:flex;align-items:center;gap:6px}
.card-header .platform-name img{width:20px;height:20px}
.card-header .platform-handle{color:#666;font-size:0.9em}
.card-body .info-row{display:flex;align-items:center;gap:8px;padding:8px 0;color:#555}
.card-body .info-row strong{color:#1a1a2e}
.card-footer{margin-top:15px}
.follow-btn{display:inline-block;padding:10px 24px;border-radius:50px;text-decoration:none;font-weight:600;color:#fff;transition:0.3s}
.follow-btn.tiktok{background:linear-gradient(135deg,#00f2ea,#ff0050)}
.follow-btn.facebook{background:#1877f2}
.follow-btn:hover{opacity:0.9;transform:translateY(-2px)}
.fake-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;max-width:900px;margin:0 auto;text-align:left}
.fake-card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:2px solid #ffcdd2;position:relative}
.fake-badge{position:absolute;top:15px;right:15px;background:#ff1744;color:#fff;padding:6px 16px;border-radius:50px;font-weight:700;font-size:0.8em;z-index:1}
.fake-card>img{width:100%;height:220px;object-fit:cover}
.fake-info{padding:20px}
.fake-info h3{font-size:1.2em;margin-bottom:5px}
.fake-info .platform{color:#ff6600;font-weight:600;font-size:0.9em;margin-bottom:8px}
.fake-info p{color:#666;font-size:0.95em;margin-bottom:12px;line-height:1.6}
.report-btn{display:inline-flex;align-items:center;gap:6px;background:#ff1744;color:#fff;padding:8px 16px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.85em;transition:0.3s}
.report-btn:hover{background:#d50000}
.report-btn img{width:18px;height:18px}
.voice-btns{display:flex;gap:15px;justify-content:center;flex-wrap:wrap}
.voice-btn{padding:14px 28px;border-radius:50px;border:none;font-weight:600;cursor:pointer;font-size:1em;display:flex;align-items:center;gap:8px;transition:0.3s}
.voice-btn.welcome{background:#ff6600;color:#fff}
.voice-btn.welcome:hover{background:#e55a00;transform:translateY(-2px)}
.voice-btn.manual{background:#ff1744;color:#fff}
.voice-btn.manual:hover{background:#d50000;transform:translateY(-2px)}
.proof-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;max-width:800px;margin:0 auto}
.proof-card{background:#f8f9fa;border-radius:12px;padding:20px;border:1px solid #e0e0e0}
.proof-card img{max-width:100%;border-radius:8px;margin-bottom:10px}
.proof-card p{font-weight:600;font-size:0.95em}
.playlist-item:hover{background:#fff7f0!important}
.playlist-item.active{background:#fff3e0!important;border-left:3px solid #ff6600}
.footer{background:#1a1a2e;color:#fff;padding:50px 20px 30px}
.footer-grid{max-width:1000px;margin:0 auto 30px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:30px;text-align:left}
.footer h4{color:#ff6600;margin-bottom:15px}
.footer p,.footer a{color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.9em;line-height:1.8}
.footer a:hover{color:#fff}
.footer-bottom{text-align:center;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:0.85em}
.chat-bubble{position:fixed;bottom:25px;right:25px;z-index:999;cursor:pointer}
.chat-bubble img{width:65px;height:65px;border-radius:50%;box-shadow:0 6px 20px rgba(0,200,83,0.4);animation:bounce 2s infinite}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.chat-window{display:none;position:fixed;bottom:100px;right:25px;width:370px;height:480px;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:999}
.chat-window.open{display:flex}
.chat-header{background:#ff6600;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
.chat-body{flex:1;overflow-y:auto;padding:15px;background:#f5f5f5;display:flex;flex-direction:column;gap:8px}
.chat-login{padding:20px;text-align:center}
.chat-login input{width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:8px;font-size:0.9em}
.chat-login button{width:100%;padding:10px;background:#ff6600;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
.chat-footer{padding:12px 15px;background:#fff;border-top:1px solid #e0e0e0;display:none}
.chat-footer input{flex:1;padding:10px;border:1px solid #ddd;border-radius:20px;outline:none;font-size:0.9em}
.chat-footer button{background:#ff6600;color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer}
.msg{max-width:80%;padding:10px 14px;border-radius:16px;font-size:0.9em;word-wrap:break-word}
.msg.user{background:#ff6600;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.msg.admin{background:#fff;color:#333;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.msg img{max-width:150px;border-radius:10px;cursor:pointer}
.msg .time{font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}
@media(max-width:768px){
  .hero h1{font-size:1.8em}
  .verified-grid{grid-template-columns:1fr}
  .chat-window{width:100%;height:100%;bottom:0;right:0;border-radius:0}
}
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <img src="${IMG.profile}" alt="Logo" onerror="this.style.display='none'">
    <span>Baiilla Maach</span>
  </div>
  <div class="header-right">
    <button class="btn-chat" onclick="openChat()">
      <img src="${IMG.messageBubble}" alt="Chat"> Chat Support
    </button>
    <a href="/admin" class="btn-admin">🔐 Admin</a>
  </div>
</header>

<section class="hero">
  <div class="hero-content">
    <div class="hero-img-wrap">
      <img src="${IMG.profile}" alt="Baiilla Maach" onerror="this.style.display='none'">
      <img src="${IMG.blueTikTok}" class="hero-blue-tick" alt="Verified" onerror="this.style.display='none'">
    </div>
    <h1>Baiilla Maach Official</h1>
    <p class="handle">@baiillamaach_official</p>
    <p class="bio">Official Entertainment Profile | Verified Creator</p>
    <div class="stats">
      <div class="stat-item"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div>
      <div class="stat-item"><div class="stat-num">0</div><div class="stat-label">Following</div></div>
      <div class="stat-item"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div>
    </div>
    <div class="verified-tag">✅ VERIFIED OFFICIAL ACCOUNT</div>
    <div class="social-btns">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="social-btn tiktok">
        <img src="${IMG.logoTikTok}" width="20" alt=""> TikTok
      </a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="social-btn facebook">
        <img src="${IMG.logoFB}" width="20" alt=""> Facebook
      </a>
    </div>
  </div>
</section>

<div class="section">
  <div class="container">
    <h2 class="section-title">✅ Official Verified Accounts</h2>
    <p class="section-sub">The ONLY authentic Baiilla Maach accounts with blue tick verification</p>
    <div class="verified-grid">
      <div class="verified-card tiktok-card">
        <div class="card-header">
          <img src="${IMG.profile}" class="pfp" alt="TikTok" onerror="this.style.display='none'">
          <div class="platform-info">
            <div class="platform-name">
              TikTok <img src="${IMG.blueTikTok}" alt="Blue Tick" onerror="this.style.display='none'">
            </div>
            <div class="platform-handle">@baiillamaach_official</div>
          </div>
        </div>
        <div class="card-body">
          <div class="info-row">✅ <strong>Status:</strong> <span style="color:#00c853;">Active & Verified</span></div>
          <div class="info-row">👥 <strong>Followers:</strong> 7,000</div>
          <div class="info-row">❤️ <strong>Likes:</strong> 190,000</div>
        </div>
        <div class="card-footer">
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok">Follow on TikTok</a>
        </div>
      </div>
      <div class="verified-card fb-card">
        <div class="card-header">
          <img src="${IMG.fbProfile}" class="pfp" alt="Facebook" onerror="this.style.display='none'">
          <div class="platform-info">
            <div class="platform-name">
              Facebook <img src="${IMG.blueFB}" alt="Blue Tick" onerror="this.style.display='none'">
            </div>
            <div class="platform-handle">@BaiillaMaachOfficial</div>
          </div>
        </div>
        <div class="card-body">
          <div class="info-row">✅ <strong>Status:</strong> <span style="color:#00c853;">Active & Verified</span></div>
          <div class="info-row">📘 <strong>Page:</strong> Official Facebook Page</div>
        </div>
        <div class="card-footer">
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn facebook">Follow on Facebook</a>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="section" style="background:#fff5f5;">
  <div class="container">
    <h2 class="section-title">⚠️ Fake Accounts Detected</h2>
    <p class="section-sub">2 fake accounts found — Report them immediately</p>
    <div class="fake-grid">
      <div class="fake-card">
        <div class="fake-badge">FAKE</div>
        <img src="${IMG.baillamachFake}" alt="Fake" onerror="this.style.display='none'">
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="platform">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn">
            <img src="${IMG.reportBtn}" alt=""> Report Account
          </a>
        </div>
      </div>
      <div class="fake-card">
        <div class="fake-badge">FAKE</div>
        <img src="${IMG.hammadFake}" alt="Fake" onerror="this.style.display='none'">
        <div class="fake-info">
          <h3>@hammad_fams0</h3>
          <p class="platform">📍 TikTok</p>
          <p>Uses official name and photo to mislead followers.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn">
            <img src="${IMG.reportBtn}" alt=""> Report Account
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

${WELCOME_VOICE||MANUAL_VOICE?`
<div class="section">
  <div class="container">
    <h2 class="section-title">🔊 Voice Verification</h2>
    <p class="section-sub">Listen to verify authentic Baiilla Maach voice</p>
    <div class="voice-btns">
      ${WELCOME_VOICE?`<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>`:''}
      ${MANUAL_VOICE?`<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert Voice</button>`:''}
    </div>
  </div>
</div>`:''}

<div class="section">
  <div class="container">
    <h2 class="section-title">🔒 Identity Proof</h2>
    <p class="section-sub">Evidence confirming authenticity</p>
    <div class="proof-grid">
      <div class="proof-card"><img src="${IMG.realId}" alt="ID" onerror="this.style.display='none'"><p>Real ID Verified</p></div>
      <div class="proof-card"><img src="${IMG.fakeDetect}" alt="Fake Detect" onerror="this.style.display='none'"><p>Fake Account Detection</p></div>
      <div class="proof-card"><img src="${IMG.microphone}" alt="Voice" onerror="this.style.display='none'"><p>Real Voice Recording</p></div>
    </div>
  </div>
</div>

${musicHTML}

<footer class="footer">
  <div class="footer-grid">
    <div><h4>About</h4><p>The ONLY official verification hub for Baiilla Maach. We help fans identify authentic accounts.</p></div>
    <div><h4>Links</h4><p><a href="https://tiktok.com/@baiillamaach_official">TikTok</a></p><p><a href="https://www.facebook.com/profile.php?id=61575202118828">Facebook</a></p></div>
    <div><h4>Contact</h4><p>Use the chat button for verification queries.</p></div>
  </div>
  <div class="footer-bottom"><p>© 2024 Baiilla Maach Official. All Rights Reserved.</p></div>
</footer>

<div class="chat-bubble" onclick="openChat()"><img src="${IMG.messageBubble}" alt="Chat"></div>
<div class="chat-window" id="chatWindow">
  <div class="chat-header"><strong>💬 Baiilla Maach Support</strong><button onclick="closeChat()" style="background:none;border:none;color:#fff;font-size:1.3em;cursor:pointer;">✕</button></div>
  <div class="chat-body" id="chatBody">
    <div class="chat-login" id="chatLogin">
      <h4 style="margin-bottom:15px;">Start Chat</h4>
      <input type="text" id="chatName" placeholder="Your Name">
      <input type="text" id="chatEmail" placeholder="Email or Phone">
      <button onclick="startChat()">Start Chatting</button>
    </div>
  </div>
  <div class="chat-footer" id="chatFooter" style="display:none;">
    <div style="display:flex;align-items:center;">
      <input type="file" id="chatImageInput" accept="image/*" style="display:none;">
      <button onclick="document.getElementById('chatImageInput').click()" style="background:#e0e0e0;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;margin-right:8px;">📎</button>
      <input type="text" id="chatMsgInput" placeholder="Type message..." style="flex:1;" onkeypress="if(event.key==='Enter')sendMsg()">
      <button onclick="sendMsg()">➤</button>
    </div>
  </div>
</div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="${WELCOME_VOICE}" preload="auto"></audio>`:''}
${MANUAL_VOICE?`<audio id="manualAudio" src="${MANUAL_VOICE}" preload="auto"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
// Voice
window.addEventListener('load',()=>{const a=document.getElementById('welcomeAudio');if(a)setTimeout(()=>a.play().catch(()=>{}),1000)});
function playWelcome(){const a=document.getElementById('welcomeAudio');if(a){a.currentTime=0;a.play()}}
function playManual(){const a=document.getElementById('manualAudio');if(a){a.currentTime=0;a.play()}}

// Music Player
const tracks=${JSON.stringify(songs)};
let currentTrack=0,isPlaying=false;
const audio=new Audio();
if(tracks.length>0){audio.src=tracks[0].url;audio.load()}
function playTrack(i){
  currentTrack=i;audio.src=tracks[i].url;audio.load();audio.play();isPlaying=true;
  document.getElementById('playBtn').textContent='⏸️';
  document.getElementById('trackTitle').textContent=tracks[i].title;
  document.querySelectorAll('.playlist-item').forEach((el,j)=>el.classList.toggle('active',j===i));
}
function togglePlay(){
  if(audio.paused){audio.play();isPlaying=true;document.getElementById('playBtn').textContent='⏸️'}
  else{audio.pause();isPlaying=false;document.getElementById('playBtn').textContent='▶️'}
}
function prevTrack(){playTrack((currentTrack-1+tracks.length)%tracks.length)}
function nextTrack(){playTrack((currentTrack+1)%tracks.length)}
audio.addEventListener('timeupdate',()=>{
  const p=(audio.currentTime/audio.duration)*100||0;
  document.getElementById('progressBar').style.width=p+'%';
  document.getElementById('currentTime').textContent=formatTime(audio.currentTime);
  document.getElementById('duration').textContent=formatTime(audio.duration);
});
audio.addEventListener('ended',nextTrack);
function seekTrack(e){const r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration}
function formatTime(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}

// Chat
const socket=io();
let chatUser=null;
function openChat(){document.getElementById('chatWindow').classList.add('open')}
function closeChat(){document.getElementById('chatWindow').classList.remove('open')}
function startChat(){
  const name=document.getElementById('chatName').value.trim();
  const email=document.getElementById('chatEmail').value.trim();
  if(!name||!email)return alert('Please fill all fields');
  chatUser={name,email};
  socket.emit('register',{name,email});
  document.getElementById('chatLogin').style.display='none';
  document.getElementById('chatFooter').style.display='block';
  loadMessages();
}
async function loadMessages(){
  if(!chatUser)return;
  const res=await fetch('/api/messages/'+chatUser.email);
  const msgs=await res.json();
  const body=document.getElementById('chatBody');
  body.innerHTML=msgs.map(m=>'<div class="msg '+(m.sender===chatUser.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" onclick="window.open(this.src)">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
  body.scrollTop=body.scrollHeight;
}
function sendMsg(){
  const input=document.getElementById('chatMsgInput');
  const msg=input.value.trim();
  if(!msg||!chatUser)return;
  socket.emit('sendMessage',{sender:chatUser.email,receiver:'admin',message:msg,type:'text',senderName:chatUser.name});
  input.value='';
}
socket.on('newMessage',(msg)=>{
  if(chatUser&&(msg.sender===chatUser.email||msg.receiver===chatUser.email)){
    const body=document.getElementById('chatBody');
    body.insertAdjacentHTML('beforeend','<div class="msg '+(msg.sender===chatUser.email?'user':'admin')+'">'+(msg.type==='image'?'<img src="'+msg.fileUrl+'">':msg.message)+'<div class="time">'+new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');
    body.scrollTop=body.scrollHeight;
  }
});
document.getElementById('chatImageInput').addEventListener('change',async(e)=>{
  const file=e.target.files[0];
  if(!file||!chatUser)return;
  const fd=new FormData();fd.append('image',file);fd.append('sender',chatUser.email);
  const res=await fetch('/api/upload/image',{method:'POST',body:fd});
  if(res.ok)e.target.value='';
});
</script>
</body>
</html>`);
});

// API Routes
app.get('/api/messages/:email',async(req,res)=>{
  const msgs=await Message.find({$or:[{sender:req.params.email},{receiver:req.params.email}]}).sort({timestamp:1});
  res.json(msgs);
});

app.post('/api/upload/image',upload.single('image'),async(req,res)=>{
  const fileUrl='/uploads/'+req.file.filename;
  const msg=await Message.create({sender:req.body.sender,receiver:'admin',type:'image',fileUrl});
  io.emit('newMessage',msg);
  res.json(msg);
});

app.get('/admin',async(req,res)=>{
  const users=await User.find({isAdmin:false}).sort({createdAt:-1});
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;display:flex;height:100vh;background:#f5f5f5}
.sidebar{width:300px;background:#1a1a2e;color:#fff;display:flex;flex-direction:column}
.sidebar h2{padding:20px;color:#ff6600;border-bottom:1px solid rgba(255,255,255,0.1)}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:15px 20px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:10px}
.user-item:hover{background:rgba(255,102,0,0.1)}
.user-item.active{background:#ff6600}
.user-avatar{width:40px;height:40px;border-radius:50%;background:#ff6600;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.main{flex:1;display:flex;flex-direction:column}
.chat-header{padding:15px 20px;background:#ff6600;color:#fff;font-weight:600}
.chat-messages{flex:1;overflow-y:auto;padding:20px;background:#f5f5f5}
.chat-input{padding:15px 20px;background:#fff;border-top:1px solid #e0e0e0;display:none}
.chat-input input{flex:1;padding:10px;border:1px solid #ddd;border-radius:20px;outline:none}
.chat-input button{background:#ff6600;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600;margin-left:10px}
.msg{max-width:70%;padding:10px 14px;border-radius:16px;margin-bottom:8px;font-size:0.9em}
.msg.user{background:#ff6600;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:#fff;color:#333;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.msg img{max-width:150px;border-radius:10px}
.login-box{width:400px;margin:100px auto;background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
.login-box h2{text-align:center;margin-bottom:30px}
.login-box input{width:100%;padding:12px;margin-bottom:15px;border:1px solid #ddd;border-radius:8px}
.login-box button{width:100%;padding:12px;background:#ff6600;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
</style></head>
<body>
<div id="loginForm" class="login-box"><h2>🔐 Admin Login</h2><input type="text" id="adminUser" placeholder="Username" value="admin"><input type="password" id="adminPass" placeholder="Password" value="admin123"><button onclick="adminLogin()">Login</button></div>
<div id="app" style="display:none;width:100%;">
  <div class="sidebar"><h2>Chat Users</h2><div class="user-list" id="userList">${users.map(u=>`<div class="user-item" onclick="selectUser('${u.email}')" data-email="${u.email}"><div class="user-avatar">${u.name[0].toUpperCase()}</div><div><div style="font-weight:600;">${u.name}</div><div style="font-size:0.8em;opacity:0.7;">${u.email}</div></div></div>`).join('')}</div></div>
  <div class="main"><div class="chat-header" id="chatHeader">Select a user to chat</div><div class="chat-messages" id="chatMessages"><div style="text-align:center;color:#999;padding:40px;">Select a user</div></div><div class="chat-input" id="chatInput"><div style="display:flex;"><input type="text" id="adminMsg" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendReply()"><button onclick="sendReply()">Send</button></div></div></div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
let token='',selectedUser=null,socket;
async function adminLogin(){
  const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('adminUser').value,password:document.getElementById('adminPass').value})});
  const data=await res.json();
  if(res.ok){token=data.token;document.getElementById('loginForm').style.display='none';document.getElementById('app').style.display='flex';initSocket()}else alert('Login failed')
}
function initSocket(){socket=io();socket.emit('register',{name:'Admin',email:'admin'});socket.on('newMessage',(msg)=>{if(selectedUser===msg.sender||selectedUser===msg.receiver)appendMsg(msg)})}
async function selectUser(email){
  selectedUser=email;
  document.querySelectorAll('.user-item').forEach(el=>el.classList.remove('active'));
  document.querySelector('[data-email="'+email+'"]').classList.add('active');
  document.getElementById('chatInput').style.display='block';
  document.getElementById('chatHeader').textContent='Chat with '+email;
  const res=await fetch('/api/messages/'+email);
  const msgs=await res.json();
  const c=document.getElementById('chatMessages');
  c.innerHTML=msgs.map(m=>'<div class="msg '+(m.sender===email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" onclick="window.open(this.src)">':m.message)+'</div>').join('');
  c.scrollTop=c.scrollHeight;
}
function appendMsg(m){
  const c=document.getElementById('chatMessages');
  c.insertAdjacentHTML('beforeend','<div class="msg '+(m.sender===selectedUser?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'">':m.message)+'</div>');
  c.scrollTop=c.scrollHeight;
}
function sendReply(){
  if(!selectedUser)return;
  const input=document.getElementById('adminMsg');
  const msg=input.value.trim();
  if(!msg)return;
  socket.emit('sendMessage',{sender:'admin',receiver:selectedUser,message:msg,type:'text',senderName:'Admin'});
  input.value='';
}
</script></body></html>`);
});

app.post('/api/admin/login',async(req,res)=>{
  const user=await User.findOne({email:req.body.email,isAdmin:true});
  if(!user)return res.status(400).json({error:'Not found'});
  const valid=await bcrypt.compare(req.body.password,user.password);
  if(!valid)return res.status(400).json({error:'Invalid password'});
  res.json({token:'admin_token'});
});

// Socket.IO
io.on('connection',(socket)=>{
  socket.on('register',async(data)=>{
    socket.userData=data;
    let user=await User.findOne({email:data.email});
    if(!user){const hash=await bcrypt.hash('default123',10);user=await User.create({name:data.name,email:data.email,password:hash});}
  });
  socket.on('sendMessage',async(data)=>{
    const msg=await Message.create({sender:data.sender,receiver:data.receiver,message:data.message,type:data.type||'text'});
    io.emit('newMessage',msg);
  });
});

server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));

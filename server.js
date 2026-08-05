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
  const admin=await User.findOne({email:'admin'});
  if(!admin){await User.create({name:'Baiilla Maach',email:'admin',password:await bcrypt.hash('admin123',10),isAdmin:true})}
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

app.get('/',(req,res)=>{
  const songs=getSongs();
  
  let musicHTML='';
  if(songs.length>0){
    musicHTML=`
    <section class="section bg-gray">
      <div class="container">
        <div class="section-label">MUSIC</div>
        <h2 class="section-heading">Cover Songs</h2>
        <p class="section-desc">Official covers by Baiilla Maach</p>
        <div class="music-player">
          <div class="music-cover">
            <img src="${ASSETS.profile}" alt="Cover" onerror="this.style.display='none'">
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
<title>Baiilla Maach — Official Verification</title>
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
.verified-card .card-body .follow-btn{display:inline-block;padding:9px 20px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.82em;margin-top:12px;transition:0.2s}
.verified-card .card-body .follow-btn.tiktok-btn{background:var(--gray900);color:var(--white)}
.verified-card .card-body .follow-btn.tiktok-btn:hover{background:#000}
.verified-card .card-body .follow-btn.fb-btn{background:var(--blue);color:var(--white)}
.verified-card .card-body .follow-btn.fb-btn:hover{background:#2563eb}

/* Fake Cards */
.fake-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.fake-card{background:var(--white);border:2px solid #fecaca;border-radius:var(--radius);overflow:hidden;position:relative;transition:0.2s}
.fake-card:hover{box-shadow:var(--shadow-lg)}
.fake-badge{position:absolute;top:12px;right:12px;background:var(--red);color:var(--white);padding:4px 12px;border-radius:var(--radius-full);font-weight:700;font-size:0.68em;letter-spacing:1.5px;text-transform:uppercase;z-index:1}
.fake-card .fake-img{width:100%;height:auto;display:block;object-fit:contain;background:#fafafa}
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
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok-btn">Follow on TikTok</a>
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
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">Follow on Facebook</a>
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
        <div class="fake-badge">FAKE</div>
        <img src="${ASSETS.baillamachFake}" class="fake-img" alt="Fake Account Screenshot" onerror="this.style.display='none'">
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="plat">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers. Uses similar name to confuse fans.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
        </div>
      </div>
      <div class="fake-card">
        <div class="fake-badge">FAKE</div>
        <img src="${ASSETS.hammadFake}" class="fake-img" alt="Fake Account Screenshot" onerror="this.style.display='none'">
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

// API + Messenger + Admin
app.get('/api/msgs/:email',async(req,res)=>{
  const msgs=await Message.find({$or:[{sender:req.params.email},{receiver:req.params.email}]}).sort({timestamp:1});
  res.json(msgs);
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
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-card{background:#fff;padding:35px;border-radius:16px;width:380px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.15)}
.login-card h2{font-family:'Outfit',sans-serif;margin-bottom:20px;font-size:1.4em}
.login-card input{width:100%;padding:12px;margin-bottom:10px;border:1px solid #e5e7eb;border-radius:10px;font-size:0.95em;outline:none}
.login-card input:focus{border-color:#f97316}
.login-card button{width:100%;padding:12px;background:#f97316;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:1em}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff}
.sidebar{width:340px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:18px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-family:'Outfit',sans-serif;font-size:1.2em}
.sidebar-header button{background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.8em}
.search-bar{padding:12px 18px}
.search-bar input{width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:20px;font-size:0.9em;outline:none;background:#f9fafb}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:12px 18px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:0.15s}
.user-item:hover{background:#f9fafb}
.user-item.active{background:#fff7ed;border-left:3px solid #f97316}
.user-avatar{width:44px;height:44px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.9em}
.user-info .email{font-size:0.78em;color:#9ca3af}
.unread{background:#f97316;color:#fff;font-size:0.7em;padding:2px 7px;border-radius:10px;font-weight:700}
.chat-area{flex:1;display:flex;flex-direction:column;background:#f8f9fb}
.chat-header{padding:16px 20px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}
.chat-header .avatar{width:38px;height:38px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9em}
.chat-header .name{font-weight:600;font-size:0.95em}
.chat-header .status{font-size:0.78em;color:#10b981}
.chat-messages{flex:1;overflow-y:auto;padding:18px}
.message{max-width:60%;padding:8px 14px;border-radius:16px;margin-bottom:4px;font-size:0.88em}
.message.sent{background:#f97316;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.message.received{background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:4px}
.message .time{font-size:0.65em;opacity:0.6;margin-top:3px;text-align:right}
.date-divider{text-align:center;margin:12px 0;font-size:0.75em;color:#9ca3af}
.chat-input{padding:14px 18px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px}
.chat-input input{flex:1;padding:10px 16px;border:1px solid #e5e7eb;border-radius:20px;font-size:0.9em;outline:none}
.chat-input button{background:#f97316;color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:1em}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay"><div class="login-card"><h2>Admin Messenger</h2><input type="text" id="loginEmail" placeholder="Email" value="admin"><input type="password" id="loginPassword" placeholder="Password" value="admin123"><button onclick="doLogin()">Sign In</button></div></div>
<div class="app" id="app"><div class="app-layout"><div class="sidebar"><div class="sidebar-header"><h2>Chats</h2><button onclick="logout()">Logout</button></div><div class="search-bar"><input type="text" id="searchInput" placeholder="Search conversations..." oninput="filterUsers()"></div><div class="user-list" id="userList"></div></div><div class="chat-area"><div class="chat-header"><div class="avatar" id="chatAvatar">?</div><div><div class="name" id="chatName">Select user</div><div class="status" id="chatStatus"></div></div></div><div class="chat-messages" id="chatMessages"><div style="text-align:center;color:#9ca3af;padding:40px;">Select a conversation</div></div><div class="chat-input" id="chatInputArea" style="display:none"><input type="text" id="msgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">➤</button></div></div></div></div>
<script src="/socket.io/socket.io.js"></script>
<script>
let cu=null,socket=null,allUsers=[];
async function doLogin(){const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value})});if(r.ok){document.getElementById('loginOverlay').style.display='none';document.getElementById('app').style.display='block';init();loadUsers()}else alert('Invalid')}
function logout(){if(socket)socket.disconnect();document.getElementById('loginOverlay').style.display='flex';document.getElementById('app').style.display='none';cu=null}
function init(){socket=io();socket.emit('register',{name:'Admin',email:'admin'});socket.on('newMsg',(m)=>{if(cu&&(m.sender===cu||m.receiver===cu))appendMsg(m);loadUsers()})}
async function loadUsers(){const r=await fetch('/api/admin/users');allUsers=await r.json();renderUsers()}
function renderUsers(f=''){const data=f?allUsers.filter(u=>u.name.toLowerCase().includes(f)||u.email.toLowerCase().includes(f)):allUsers;document.getElementById('userList').innerHTML=data.map(u=>'<div class="user-item'+(cu===u.email?' active':'')+'" onclick="selectUser(\''+u.email+'\')"><div class="user-avatar">'+u.name[0].toUpperCase()+(u.isOnline?'<div class="dot"></div>':'')+'</div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':'')+'</div>').join('')}
function filterUsers(){renderUsers(document.getElementById('searchInput').value.toLowerCase())}
async function selectUser(email){cu=email;document.getElementById('chatInputArea').style.display='flex';const u=allUsers.find(u=>u.email===email);document.getElementById('chatAvatar').textContent=u?.name[0]?.toUpperCase()||'?';document.getElementById('chatName').textContent=u?.name||email;document.getElementById('chatStatus').textContent=u?.isOnline?'● Online':'○ Offline';const r=await fetch('/api/msgs/'+email);const ms=await r.json();const c=document.getElementById('chatMessages');if(ms.length){let h='',ld='';ms.forEach(m=>{const d=new Date(m.timestamp).toLocaleDateString();if(d!==ld){h+='<div class="date-divider">'+d+'</div>';ld=d}h+='<div class="message '+(m.sender===email?'received':'sent')+'">'+m.message+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>'});c.innerHTML=h}else{c.innerHTML='<div style="text-align:center;color:#9ca3af;padding:40px;">No messages</div>'}c.scrollTop=c.scrollHeight;socket.emit('markRead',{user:email});renderUsers()}
function appendMsg(m){const c=document.getElementById('chatMessages');c.querySelector('div[style]')?.remove();c.insertAdjacentHTML('beforeend','<div class="message '+(m.sender===cu?'received':'sent')+'">'+m.message+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');c.scrollTop=c.scrollHeight}
function sendMsg(){if(!cu)return;const i=document.getElementById('msgInput');const m=i.value.trim();if(!m)return;socket.emit('sendMsg',{sender:'admin',receiver:cu,message:m,type:'text'});i.value=''}
</script>
</body>
</html>`);
});

app.post('/api/admin/login',async(req,res)=>{
  const user=await User.findOne({email:req.body.email,isAdmin:true});
  if(!user)return res.status(400).json({error:'Not found'});
  const valid=await bcrypt.compare(req.body.password,user.password);
  if(!valid)return res.status(400).json({error:'Wrong password'});
  res.json({token:'ok'});
});

app.get('/api/admin/users',async(req,res)=>{
  const users=await User.find({isAdmin:false}).sort({lastSeen:-1}).lean();
  for(let u of users)u.unreadCount=await Message.countDocuments({sender:u.email,receiver:'admin',seen:false});
  res.json(users);
});

io.on('connection',(socket)=>{
  socket.on('register',async(data)=>{
    socket.userData=data;
    let user=await User.findOne({email:data.email});
    if(!user){const hash=await bcrypt.hash('default123',10);user=await User.create({name:data.name,email:data.email,password:hash})}
    await User.updateOne({email:data.email},{$set:{isOnline:true,lastSeen:new Date()}});
    io.emit('userStatus',{email:data.email,online:true});
  });
  socket.on('sendMsg',async(data)=>{
    const msg=await Message.create({sender:data.sender,receiver:data.receiver,message:data.message,type:data.type||'text'});
    io.emit('newMsg',msg);
  });
  socket.on('markRead',async(data)=>{await Message.updateMany({sender:data.user,receiver:'admin',seen:false},{$set:{seen:true}})});
  socket.on('disconnect',async()=>{
    if(socket.userData){await User.updateOne({email:socket.userData.email},{$set:{isOnline:false,lastSeen:new Date()}});io.emit('userStatus',{email:socket.userData.email,online:false})}
  });
});

server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));

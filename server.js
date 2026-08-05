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

app.get('/',(req,res)=>{
  const songs=getSongs();
  
  let musicHTML='';
  if(songs.length>0){
    musicHTML=`
    <section class="music-section">
      <div class="container">
        <div class="section-badge">🎵 MUSIC</div>
        <h2 class="section-title">Cover Songs</h2>
        <p class="section-subtitle">Official covers by Baiilla Maach</p>
        <div class="music-player">
          <div class="music-art"><img src="${ASSETS.profile}" onerror="this.style.display='none'"><div class="music-ring"></div></div>
          <div class="music-body">
            <h3 id="trackTitle">Select Song</h3><p id="trackArtist">Baiilla Maach</p>
            <div class="music-controls">
              <button onclick="prevTrack()">⏮</button>
              <button id="playBtn" onclick="togglePlay()" class="play-btn">▶️</button>
              <button onclick="nextTrack()">⏭</button>
            </div>
            <div class="music-progress" onclick="seekTrack(event)"><div id="progressBar" class="music-fill"></div></div>
            <div class="music-timer"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
          </div>
        </div>
        <div class="music-list">${songs.map((s,i)=>`<div onclick="playTrack(${i})" class="music-item"><span>${String(i+1).padStart(2,'0')}</span>${s.title}</div>`).join('')}</div>
      </div>
    </section>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#0a0a0a">
<title>Baiilla Maach | Official Verification</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,100;9..40,200;9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Inter+Tight:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&family=Clash+Display:wght@200;300;400;500;600;700&family=Satoshi:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0a0a0a;
  --surface:#141414;
  --surface2:#1a1a1a;
  --border:#2a2a2a;
  --text:#f5f5f5;
  --text2:#a0a0a0;
  --accent:#ff6600;
  --accent2:#ff4500;
  --green:#00ff88;
  --red:#ff3333;
  --blue:#3b82f6;
  --gradient1:linear-gradient(135deg,#ff6600,#ff4500);
  --gradient2:linear-gradient(135deg,#1a1a2e,#0f3460);
  --gradient3:linear-gradient(135deg,#0a0a0a,#1a1a1a);
  --shadow:0 4px 30px rgba(0,0,0,0.5);
  --shadow-glow:0 0 40px rgba(255,102,0,0.2);
  --radius:20px;
  --radius-sm:12px;
}

*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--bg)}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}

/* Scrollbar */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--surface)}
::-webkit-scrollbar-thumb{background:var(--accent);border-radius:2px}

/* Loader */
.page-loader{position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:9999;display:flex;align-items:center;justify-content:center;transition:0.5s}
.page-loader.hide{opacity:0;pointer-events:none}
.loader-ring{width:50px;height:50px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:16px 30px;transition:0.4s}
.nav.scrolled{background:rgba(10,10,10,0.9);backdrop-filter:blur(30px);border-bottom:1px solid var(--border);padding:12px 30px}
.nav-inner{max-width:1300px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
.nav-logo{display:flex;align-items:center;gap:12px;text-decoration:none}
.nav-logo img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)}
.nav-logo span{font-family:'Clash Display',sans-serif;font-weight:600;font-size:1.2em;color:var(--text);letter-spacing:-0.5px}
.nav-links{display:flex;gap:8px;align-items:center}
.nav-link{font-family:'Inter Tight',sans-serif;padding:10px 20px;border-radius:50px;text-decoration:none;font-weight:500;font-size:0.9em;transition:0.3s;letter-spacing:-0.3px}
.nav-link.messenger{background:var(--gradient1);color:#fff}
.nav-link.messenger:hover{box-shadow:var(--shadow-glow);transform:translateY(-2px)}
.nav-link.admin{border:1.5px solid var(--border);color:var(--text2)}
.nav-link.admin:hover{border-color:var(--accent);color:var(--accent)}

/* Hero */
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:120px 20px 80px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 50% 30%,rgba(255,102,0,0.08) 0%,transparent 60%)}
.hero-grid{position:relative;z-index:1;max-width:800px;margin:0 auto}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.2);padding:8px 20px;border-radius:50px;font-family:'Inter Tight',sans-serif;font-weight:600;font-size:0.8em;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:25px}
.hero-badge .dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.hero-avatar-wrap{position:relative;display:inline-block;margin-bottom:30px}
.hero-avatar{width:160px;height:160px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);box-shadow:0 0 60px rgba(255,102,0,0.3)}
.hero-verified{position:absolute;bottom:12px;right:12px;width:34px;height:34px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid var(--bg)}
.hero-verified svg{width:16px;height:16px;fill:#fff}
.hero-title{font-family:'Clash Display',sans-serif;font-size:clamp(2.5em,6vw,4.5em);font-weight:700;line-height:1.1;letter-spacing:-2px;margin-bottom:8px}
.hero-title .gradient{background:linear-gradient(135deg,#fff 0%,#ff6600 50%,#ff4500 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-handle{font-family:'Space Grotesk',sans-serif;font-size:1.2em;color:var(--text2);font-weight:400;letter-spacing:1px;margin-bottom:5px}
.hero-bio{font-family:'DM Sans',sans-serif;color:var(--text2);font-size:1.05em;font-weight:300;margin-bottom:25px}
.hero-stats{display:flex;justify-content:center;gap:40px;margin:25px 0}
.hero-stat{text-align:center}
.hero-stat .num{font-family:'Clash Display',sans-serif;font-size:2em;font-weight:700;color:var(--accent);letter-spacing:-1px}
.hero-stat .label{font-family:'Inter Tight',sans-serif;font-size:0.75em;color:var(--text2);text-transform:uppercase;letter-spacing:3px;margin-top:4px}
.hero-social{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.hero-social a{font-family:'Inter Tight',sans-serif;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:8px;transition:0.4s;letter-spacing:-0.3px}
.hero-social a img{width:20px;height:20px}
.hero-social .tiktok{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text)}
.hero-social .tiktok:hover{background:rgba(0,0,0,0.5);border-color:#ff0050}
.hero-social .facebook{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text)}
.hero-social .facebook:hover{background:rgba(24,119,242,0.3);border-color:#1877f2}

/* Section */
.section{padding:100px 20px;position:relative}
.section::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:1px;height:60px;background:linear-gradient(transparent,var(--border),transparent)}
.container{max-width:1100px;margin:0 auto}
.section-badge{display:inline-block;font-family:'Inter Tight',sans-serif;font-size:0.75em;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--accent);margin-bottom:15px;padding:6px 16px;background:rgba(255,102,0,0.1);border-radius:50px}
.section-title{font-family:'Clash Display',sans-serif;font-size:2.5em;font-weight:700;text-align:center;margin-bottom:8px;letter-spacing:-1px}
.section-subtitle{font-family:'DM Sans',sans-serif;text-align:center;color:var(--text2);margin-bottom:50px;font-size:1.05em;font-weight:300}

/* Verified Cards */
.verified-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.verified-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:30px;transition:0.4s;position:relative;overflow:hidden}
.verified-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gradient1);opacity:0;transition:0.4s}
.verified-card:hover::after{opacity:1}
.verified-card:hover{transform:translateY(-5px);box-shadow:var(--shadow);border-color:var(--accent)}
.verified-card .card-top{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.verified-card .card-top .pfp{width:52px;height:52px;border-radius:50%;object-fit:cover}
.verified-card .card-top .info h3{font-family:'Syne',sans-serif;font-size:1.2em;font-weight:700;display:flex;align-items:center;gap:6px}
.verified-card .card-top .info h3 img{width:20px;height:20px}
.verified-card .card-top .info .handle{font-family:'Space Grotesk',sans-serif;color:var(--text2);font-size:0.85em}
.verified-card .card-body .row{font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:8px;padding:8px 0;color:var(--text2);font-size:0.9em}
.verified-card .card-body .row strong{color:var(--text);font-weight:500}
.verified-card .card-body .btn{display:inline-block;font-family:'Inter Tight',sans-serif;padding:10px 24px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.85em;margin-top:12px;transition:0.3s;letter-spacing:-0.3px}
.verified-card .card-body .btn.tiktok-btn{background:linear-gradient(135deg,#00f2ea,#ff0050);color:#fff}
.verified-card .card-body .btn.fb-btn{background:#1877f2;color:#fff}
.verified-card .card-body .btn:hover{opacity:0.9;transform:translateY(-2px)}

/* Fake Cards */
.fake-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.fake-card{background:var(--surface);border:1px solid rgba(255,51,51,0.3);border-radius:var(--radius);overflow:hidden;position:relative;transition:0.4s}
.fake-card:hover{transform:translateY(-5px);box-shadow:0 10px 40px rgba(255,51,51,0.15);border-color:var(--red)}
.fake-badge{position:absolute;top:14px;right:14px;background:var(--red);color:#fff;padding:5px 16px;border-radius:50px;font-family:'Inter Tight',sans-serif;font-weight:700;font-size:0.7em;letter-spacing:2px;z-index:1;text-transform:uppercase}
.fake-card .fake-img{width:100%;height:220px;object-fit:cover}
.fake-card .fake-info{padding:22px}
.fake-card .fake-info h3{font-family:'Syne',sans-serif;font-size:1.2em;font-weight:700;margin-bottom:4px}
.fake-card .fake-info .plat{font-family:'Space Grotesk',sans-serif;color:var(--accent);font-weight:600;font-size:0.85em;margin-bottom:8px}
.fake-card .fake-info p{font-family:'DM Sans',sans-serif;color:var(--text2);font-size:0.9em;margin-bottom:14px;line-height:1.6;font-weight:300}
.fake-card .fake-info .report-btn{display:inline-flex;align-items:center;gap:6px;background:var(--red);color:#fff;padding:8px 18px;border-radius:50px;text-decoration:none;font-family:'Inter Tight',sans-serif;font-weight:600;font-size:0.8em;letter-spacing:-0.3px;transition:0.3s}
.fake-card .fake-info .report-btn:hover{background:#ff0000;transform:translateY(-2px)}
.fake-card .fake-info .report-btn img{width:16px;height:16px}

/* Voice Section */
.voice-section{background:var(--surface);text-align:center}
.voice-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:25px}
.voice-btn{font-family:'Inter Tight',sans-serif;padding:14px 30px;border-radius:50px;border:none;font-weight:600;cursor:pointer;font-size:0.95em;display:flex;align-items:center;gap:8px;transition:0.4s;letter-spacing:-0.3px}
.voice-btn.welcome{background:var(--gradient1);color:#fff}
.voice-btn.welcome:hover{box-shadow:var(--shadow-glow);transform:translateY(-3px)}
.voice-btn.manual{background:transparent;color:var(--red);border:1.5px solid var(--red)}
.voice-btn.manual:hover{background:var(--red);color:#fff;box-shadow:0 0 30px rgba(255,51,51,0.3)}

/* Proof */
.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.proof-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:24px;text-align:center;transition:0.4s}
.proof-card:hover{transform:translateY(-5px);border-color:var(--accent);box-shadow:var(--shadow)}
.proof-card img{max-width:100%;border-radius:8px;margin-bottom:12px}
.proof-card p{font-family:'Syne',sans-serif;font-weight:600;font-size:0.9em}

/* Music */
.music-section{background:var(--surface2)}
.music-player{max-width:650px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:30px;display:flex;align-items:center;gap:25px}
.music-art{position:relative}
.music-art img{width:110px;height:110px;border-radius:50%;object-fit:cover}
.music-ring{position:absolute;top:-5px;left:-5px;right:-5px;bottom:-5px;border-radius:50%;border:2px solid var(--accent);opacity:0.3;animation:spin 10s linear infinite}
.music-body{flex:1;text-align:center}
.music-body h3{font-family:'Syne',sans-serif;font-size:1.1em;margin-bottom:2px}
.music-body p{font-family:'Space Grotesk',sans-serif;color:var(--accent);font-weight:600;margin-bottom:12px;font-size:0.9em}
.music-controls{display:flex;justify-content:center;gap:12px;margin-bottom:10px}
.music-controls button{background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text);width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1em;transition:0.3s}
.music-controls button:hover{border-color:var(--accent);background:rgba(255,102,0,0.1)}
.music-controls .play-btn{background:var(--gradient1);border:none;width:54px;height:54px;font-size:1.3em}
.music-controls .play-btn:hover{box-shadow:var(--shadow-glow)}
.music-progress{background:var(--border);height:4px;border-radius:2px;cursor:pointer;margin:8px 0}
.music-fill{background:var(--accent);height:100%;border-radius:2px;width:0%;transition:width 0.1s}
.music-timer{font-family:'Space Grotesk',sans-serif;font-size:0.8em;color:var(--text2)}
.music-list{margin-top:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:260px;overflow-y:auto}
.music-item{padding:12px 20px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;gap:10px;font-family:'DM Sans',sans-serif;font-size:0.9em;transition:0.2s}
.music-item:hover{background:rgba(255,102,0,0.05)}
.music-item.active{background:rgba(255,102,0,0.1);border-left:3px solid var(--accent)}
.music-item span{font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--accent);min-width:25px}

/* Footer */
.footer{background:var(--surface);padding:50px 20px 30px;text-align:center;border-top:1px solid var(--border)}
.footer-grid{max-width:1000px;margin:0 auto 30px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:30px;text-align:left}
.footer h4{font-family:'Clash Display',sans-serif;color:var(--accent);margin-bottom:12px;font-size:1em}
.footer p,.footer a{font-family:'DM Sans',sans-serif;color:var(--text2);text-decoration:none;font-size:0.85em;line-height:1.8;font-weight:300}
.footer a:hover{color:var(--accent)}
.footer-bottom{padding-top:20px;border-top:1px solid var(--border);font-family:'Space Grotesk',sans-serif;font-size:0.8em;color:var(--text2)}

/* Chat Widget */
.chat-widget{position:fixed;bottom:25px;right:25px;z-index:999}
.chat-widget .bubble{width:62px;height:62px;border-radius:50%;cursor:pointer;transition:0.4s;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.chat-widget .bubble:hover{transform:scale(1.1)}
.chat-widget .bubble img{width:100%;height:100%;border-radius:50%}
.chat-box{display:none;position:fixed;bottom:100px;right:25px;width:380px;height:500px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);flex-direction:column;overflow:hidden;z-index:999;box-shadow:var(--shadow)}
.chat-box.open{display:flex}
.chat-box .head{background:var(--gradient1);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-family:'Syne',sans-serif;font-weight:600;font-size:0.95em}
.chat-box .head button{background:none;border:none;color:#fff;font-size:1.2em;cursor:pointer}
.chat-box .body{flex:1;overflow-y:auto;padding:14px;background:var(--bg)}
.chat-box .login-form{padding:25px;text-align:center}
.chat-box .login-form input{width:100%;padding:12px;margin-bottom:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.9em;outline:none}
.chat-box .login-form input:focus{border-color:var(--accent)}
.chat-box .login-form button{width:100%;padding:12px;background:var(--gradient1);color:#fff;border:none;border-radius:10px;font-family:'Inter Tight',sans-serif;font-weight:600;cursor:pointer;transition:0.3s}
.chat-box .input-row{padding:12px 14px;background:var(--surface);border-top:1px solid var(--border);display:none}
.chat-box .input-row input{flex:1;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:20px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.9em;outline:none}
.chat-box .input-row button{background:var(--gradient1);color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em;margin-left:8px}
.msg{max-width:80%;padding:10px 14px;border-radius:16px;margin-bottom:6px;font-size:0.85em;word-wrap:break-word}
.msg.user{background:var(--gradient1);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:var(--surface);color:var(--text);border:1px solid var(--border);border-bottom-left-radius:4px}
.msg .time{font-family:'Space Grotesk',sans-serif;font-size:0.65em;opacity:0.6;margin-top:4px;text-align:right}

@media(max-width:768px){
  .hero-stats{gap:25px}
  .verified-grid,.fake-grid{grid-template-columns:1fr}
  .proof-grid{grid-template-columns:1fr}
  .music-player{flex-direction:column;padding:20px}
  .chat-box{width:100%;height:100%;bottom:0;right:0;border-radius:0}
}
</style>
</head>
<body>

<div class="page-loader" id="loader"><div class="loader-ring"></div></div>

<nav class="nav" id="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo"><img src="${ASSETS.profile}" onerror="this.style.display='none'"><span>Baiilla Maach</span></a>
    <div class="nav-links">
      <a href="/messenger" class="nav-link messenger">💬 Messenger</a>
      <a href="/admin" class="nav-link admin">🔐 Admin</a>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="hero-grid">
    <div class="hero-badge"><span class="dot"></span> Verified Official Account</div>
    <div class="hero-avatar-wrap">
      <img src="${ASSETS.profile}" class="hero-avatar" onerror="this.style.display='none'">
      <div class="hero-verified"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
    </div>
    <h1 class="hero-title"><span class="gradient">Baiilla Maach</span></h1>
    <p class="hero-handle">@baiillamaach_official</p>
    <p class="hero-bio">Official Entertainment Profile · Verified Creator</p>
    <div class="hero-stats">
      <div class="hero-stat"><div class="num">7K</div><div class="label">Followers</div></div>
      <div class="hero-stat"><div class="num">0</div><div class="label">Following</div></div>
      <div class="hero-stat"><div class="num">190K</div><div class="label">Likes</div></div>
    </div>
    <div class="hero-social">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="tiktok"><img src="${ASSETS.logoTikTok}"> TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="facebook"><img src="${ASSETS.logoFB}"> Facebook</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-badge">OFFICIAL</div>
    <h2 class="section-title">Verified Accounts</h2>
    <p class="section-subtitle">The only authentic Baiilla Maach accounts with verification</p>
    <div class="verified-grid">
      <div class="verified-card">
        <div class="card-top"><img src="${ASSETS.profile}" class="pfp" onerror="this.style.display='none'"><div class="info"><h3>TikTok <img src="${ASSETS.blueTikTok}" onerror="this.style.display='none'"></h3><p class="handle">@baiillamaach_official</p></div></div>
        <div class="card-body"><div class="row">✓ <strong>Status:</strong> <span style="color:var(--green)">Active & Verified</span></div><div class="row">👥 <strong>Followers:</strong> 7,000</div><div class="row">❤️ <strong>Likes:</strong> 190,000</div><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn tiktok-btn">Follow on TikTok</a></div>
      </div>
      <div class="verified-card">
        <div class="card-top"><img src="${ASSETS.fbProfile}" class="pfp" onerror="this.style.display='none'"><div class="info"><h3>Facebook <img src="${ASSETS.blueFB}" onerror="this.style.display='none'"></h3><p class="handle">@BaiillaMaachOfficial</p></div></div>
        <div class="card-body"><div class="row">✓ <strong>Status:</strong> <span style="color:var(--green)">Active & Verified</span></div><div class="row">📘 <strong>Page:</strong> Official Facebook</div><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn fb-btn">Follow on Facebook</a></div>
      </div>
    </div>
  </div>
</section>

<section class="section" style="background:var(--surface);">
  <div class="container">
    <div class="section-badge" style="color:var(--red);background:rgba(255,51,51,0.1);">⚠️ WARNING</div>
    <h2 class="section-title">Fake Accounts</h2>
    <p class="section-subtitle">2 fake accounts detected — Report immediately</p>
    <div class="fake-grid">
      <div class="fake-card"><div class="fake-badge">FAKE</div><img src="${ASSETS.baillamachFake}" class="fake-img" onerror="this.style.display='none'"><div class="fake-info"><h3>@baiilla_mach</h3><p class="plat">📍 TikTok</p><p>Copies official logo and content to deceive followers.</p><a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}"> Report</a></div></div>
      <div class="fake-card"><div class="fake-badge">FAKE</div><img src="${ASSETS.hammadFake}" class="fake-img" onerror="this.style.display='none'"><div class="fake-info"><h3>@hammad_fams0</h3><p class="plat">📍 TikTok</p><p>Uses official name and photo to mislead followers.</p><a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}"> Report</a></div></div>
    </div>
  </div>
</section>

${WELCOME_VOICE||MANUAL_VOICE?`
<section class="voice-section section">
  <div class="container">
    <div class="section-badge">VOICE</div>
    <h2 class="section-title">Voice Verification</h2>
    <p class="section-subtitle">Listen to authentic Baiilla Maach voice</p>
    <div class="voice-btns">
      ${WELCOME_VOICE?`<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>`:''}
      ${MANUAL_VOICE?`<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert</button>`:''}
    </div>
  </div>
</section>`:''}

<section class="section">
  <div class="container">
    <div class="section-badge">PROOF</div>
    <h2 class="section-title">Identity Proof</h2>
    <p class="section-subtitle">Evidence confirming authenticity</p>
    <div class="proof-grid">
      <div class="proof-card"><img src="${ASSETS.realId}" onerror="this.style.display='none'"><p>Real ID Verified</p></div>
      <div class="proof-card"><img src="${ASSETS.fakeDetect}" onerror="this.style.display='none'"><p>Fake Detection</p></div>
      <div class="proof-card"><img src="${ASSETS.microphone}" onerror="this.style.display='none'"><p>Real Voice</p></div>
    </div>
  </div>
</section>

${musicHTML}

<footer class="footer">
  <div class="footer-grid">
    <div><h4>About</h4><p>Official verification hub for Baiilla Maach. Helping fans identify authentic accounts and avoid scams.</p></div>
    <div><h4>Links</h4><p><a href="https://tiktok.com/@baiillamaach_official">TikTok</a></p><p><a href="https://www.facebook.com/profile.php?id=61575202118828">Facebook</a></p></div>
    <div><h4>Contact</h4><p>Use chat for verification queries</p></div>
  </div>
  <div class="footer-bottom"><p>© 2024 Baiilla Maach Official</p></div>
</footer>

<div class="chat-widget"><div class="bubble" onclick="openChat()"><img src="${ASSETS.messageBubble}" alt="Chat"></div></div>
<div class="chat-box" id="chatBox">
  <div class="head">💬 Chat Support<button onclick="closeChat()">✕</button></div>
  <div class="body" id="chatBody"><div class="login-form" id="chatLogin"><h4 style="margin-bottom:12px;font-family:'Syne',sans-serif;">Start Chat</h4><input type="text" id="chatName" placeholder="Your Name"><input type="text" id="chatEmail" placeholder="Email / Phone"><button onclick="startChat()">Start Chatting</button></div></div>
  <div class="input-row" id="chatInput"><div style="display:flex;align-items:center"><input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">➤</button></div></div>
</div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>`:''}
${MANUAL_VOICE?`<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
// Loader
window.addEventListener('load',()=>{setTimeout(()=>document.getElementById('loader').classList.add('hide'),500);const a=document.getElementById('welcomeAudio');if(a)setTimeout(()=>a.play().catch(()=>{}),1500)});

// Nav scroll
window.addEventListener('scroll',()=>{document.getElementById('nav').classList.toggle('scrolled',window.scrollY>50)});

// Voice
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

// API + Messenger + Admin (same as previous working version)
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
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Syne:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#0a0a0a;color:#f5f5f5;height:100vh;overflow:hidden}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-card{background:#141414;border:1px solid #2a2a2a;padding:35px;border-radius:20px;width:380px;text-align:center}
.login-card .icon{font-size:3em;margin-bottom:15px}
.login-card h2{font-family:'Syne',sans-serif;margin-bottom:8px}
.login-card p{color:#a0a0a0;margin-bottom:20px;font-size:0.9em}
.login-card input{width:100%;padding:12px;margin-bottom:10px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;color:#f5f5f5;font-size:0.95em;outline:none}
.login-card input:focus{border-color:#ff6600}
.login-card button{width:100%;padding:12px;background:linear-gradient(135deg,#ff6600,#ff4500);color:#fff;border:none;border-radius:10px;font-family:'Inter Tight',sans-serif;font-weight:600;cursor:pointer;font-size:1em}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1500px;margin:0 auto}
.sidebar{width:340px;background:#141414;border-right:1px solid #2a2a2a;display:flex;flex-direction:column}
.sidebar-header{padding:18px;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-family:'Syne',sans-serif;font-size:1.3em}
.sidebar-header button{background:#ff3333;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-family:'Inter Tight',sans-serif;font-weight:600;font-size:0.8em}
.search-bar{padding:12px 18px}
.search-bar input{width:100%;padding:10px 14px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;color:#f5f5f5;font-size:0.9em;outline:none}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:12px 18px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:0.15s;border-bottom:1px solid #1a1a1a}
.user-item:hover{background:#1a1a1a}
.user-item.active{background:rgba(255,102,0,0.1);border-left:3px solid #ff6600}
.user-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ff6600,#ff4500);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:1px;right:1px;width:12px;height:12px;border-radius:50%;background:#00ff88;border:2px solid #141414}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.9em}
.user-info .email{font-size:0.78em;color:#a0a0a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unread{background:#ff6600;color:#fff;font-size:0.7em;padding:2px 7px;border-radius:10px;font-family:'Inter Tight',sans-serif;font-weight:700}
.chat-area{flex:1;display:flex;flex-direction:column;background:#0a0a0a}
.chat-header{padding:16px 20px;background:#141414;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:10px}
.chat-header .avatar{width:40px;height:40px;border-radius:50%;background:#ff6600;display:flex;align-items:center;justify-content:center;font-weight:700}
.chat-header .info{flex:1}
.chat-header .name{font-weight:600;font-size:0.95em}
.chat-header .status{font-size:0.78em;color:#00ff88}
.chat-messages{flex:1;overflow-y:auto;padding:18px}
.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#a0a0a0}
.message{max-width:60%;padding:8px 14px;border-radius:18px;margin-bottom:4px;font-size:0.9em;word-wrap:break-word}
.message.sent{background:linear-gradient(135deg,#ff6600,#ff4500);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.message.received{background:#1a1a1a;color:#f5f5f5;border:1px solid #2a2a2a;border-bottom-left-radius:4px}
.message .time{font-size:0.65em;opacity:0.6;margin-top:3px;text-align:right}
.date-divider{text-align:center;margin:12px 0;font-size:0.75em;color:#a0a0a0}
.chat-input{padding:14px 18px;background:#141414;border-top:1px solid #2a2a2a;display:flex;gap:8px;align-items:center}
.chat-input input{flex:1;padding:10px 16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;color:#f5f5f5;font-size:0.9em;outline:none}
.chat-input button{background:linear-gradient(135deg,#ff6600,#ff4500);color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay"><div class="login-card"><div class="icon">💬</div><h2>Admin Messenger</h2><p>Sign in to manage chats</p><input type="text" id="loginEmail" placeholder="Email" value="admin"><input type="password" id="loginPassword" placeholder="Password" value="admin123"><button onclick="doLogin()">Sign In</button></div></div>
<div class="app" id="app"><div class="app-layout"><div class="sidebar"><div class="sidebar-header"><h2>Chats</h2><button onclick="logout()">Logout</button></div><div class="search-bar"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div><div class="user-list" id="userList"></div></div><div class="chat-area" id="chatArea"><div class="chat-header"><div class="avatar" id="chatAvatar">?</div><div class="info"><div class="name" id="chatName">Select user</div><div class="status" id="chatStatus"></div></div></div><div class="chat-messages" id="chatMessages"><div class="empty-chat"><h3>💬 Your Messages</h3><p>Select a conversation</p></div></div><div class="chat-input" id="chatInputArea" style="display:none"><input type="text" id="msgInput" placeholder="Aa" onkeypress="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">➤</button></div></div></div></div>
<script src="/socket.io/socket.io.js"></script>
<script>
let cu=null,socket=null,allUsers=[];
async function doLogin(){const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value})});if(r.ok){document.getElementById('loginOverlay').style.display='none';document.getElementById('app').style.display='block';init();loadUsers()}else alert('Invalid')}
function logout(){if(socket)socket.disconnect();document.getElementById('loginOverlay').style.display='flex';document.getElementById('app').style.display='none';cu=null}
function init(){socket=io();socket.emit('register',{name:'Admin',email:'admin'});socket.on('newMsg',(m)=>{if(cu&&(m.sender===cu||m.receiver===cu))appendMsg(m);loadUsers()})}
async function loadUsers(){const r=await fetch('/api/admin/users');allUsers=await r.json();renderUsers()}
function renderUsers(f=''){const list=document.getElementById('userList');const data=f?allUsers.filter(u=>u.name.toLowerCase().includes(f)||u.email.toLowerCase().includes(f)):allUsers;list.innerHTML=data.map(u=>'<div class="user-item'+(cu===u.email?' active':'')+'" onclick="selectUser(\''+u.email+'\')"><div class="user-avatar">'+u.name[0].toUpperCase()+(u.isOnline?'<div class="dot"></div>':'')+'</div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':'')+'</div>').join('')}
function filterUsers(){renderUsers(document.getElementById('searchInput').value.toLowerCase())}
async function selectUser(email){cu=email;document.getElementById('chatInputArea').style.display='flex';const user=allUsers.find(u=>u.email===email);document.getElementById('chatAvatar').textContent=user?.name[0]?.toUpperCase()||'?';document.getElementById('chatName').textContent=user?.name||email;document.getElementById('chatStatus').textContent=user?.isOnline?'● Online':'○ Offline';const r=await fetch('/api/msgs/'+email);const msgs=await r.json();const c=document.getElementById('chatMessages');if(msgs.length){let h='',ld='';msgs.forEach(m=>{const d=new Date(m.timestamp).toLocaleDateString();if(d!==ld){h+='<div class="date-divider">'+d+'</div>';ld=d}h+='<div class="message '+(m.sender===email?'received':'sent')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>'});c.innerHTML=h}else{c.innerHTML='<div class="empty-chat"><p>No messages</p></div>'}c.scrollTop=c.scrollHeight;socket.emit('markRead',{user:email});renderUsers()}
function appendMsg(m){const c=document.getElementById('chatMessages');c.querySelector('.empty-chat')?.remove();c.insertAdjacentHTML('beforeend','<div class="message '+(m.sender===cu?'received':'sent')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');c.scrollTop=c.scrollHeight}
function sendMsg(){if(!cu)return;const i=document.getElementById('msgInput');const m=i.value.trim();if(!m)return;socket.emit('sendMsg',{sender:'admin',receiver:cu,message:m,type:'text'});i.value=''}
</script>
</body>
</html>`);
});

app.get('/admin',(req,res)=>{
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin | Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Syne:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter Tight',sans-serif;background:#0a0a0a;display:flex;height:100vh;color:#f5f5f5}
.login-box{width:380px;margin:80px auto;background:#141414;border:1px solid #2a2a2a;padding:35px;border-radius:20px;text-align:center}
.login-box h2{font-family:'Syne',sans-serif;margin-bottom:25px}
.login-box input{width:100%;padding:12px;margin-bottom:12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;color:#f5f5f5;font-size:0.95em;outline:none}
.login-box button{width:100%;padding:12px;background:linear-gradient(135deg,#ff6600,#ff4500);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
.sidebar{width:300px;background:#141414;border-right:1px solid #2a2a2a;display:flex;flex-direction:column}
.sidebar h2{padding:20px;font-family:'Syne',sans-serif;color:#ff6600;border-bottom:1px solid #2a2a2a}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:14px 18px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #1a1a1a}
.user-item:hover{background:#1a1a1a}
.user-item.active{background:rgba(255,102,0,0.15);border-left:3px solid #ff6600}
.user-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#ff6600,#ff4500);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.main{flex:1;display:flex;flex-direction:column}
.main-header{padding:14px 20px;background:#141414;border-bottom:1px solid #2a2a2a;font-family:'Syne',sans-serif;font-weight:600}
.main-body{flex:1;overflow-y:auto;padding:18px;background:#0a0a0a}
.main-input{padding:14px 20px;background:#141414;border-top:1px solid #2a2a2a;display:none}
.main-input input{flex:1;padding:10px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;color:#f5f5f5;outline:none}
.main-input button{background:linear-gradient(135deg,#ff6600,#ff4500);color:#fff;border:none;padding:10px 18px;border-radius:20px;cursor:pointer;font-weight:600;margin-left:8px}
.msg{max-width:65%;padding:8px 12px;border-radius:14px;margin-bottom:6px;font-size:0.85em}
.msg.user{background:linear-gradient(135deg,#ff6600,#ff4500);color:#fff;margin-left:auto;border-bottom-right-radius:3px}
.msg.admin{background:#1a1a1a;color:#f5f5f5;border:1px solid #2a2a2a;border-bottom-left-radius:3px}
</style>
</head>
<body>
<div id="loginForm" class="login-box"><h2>🔐 Admin Login</h2><input type="text" id="adminUser" placeholder="Email" value="admin"><input type="password" id="adminPass" placeholder="Password" value="admin123"><button onclick="adminLogin()">Login</button></div>
<div id="app" style="display:none;width:100%"><div class="sidebar"><h2>Chat Users</h2><div class="user-list" id="userList"></div></div><div class="main"><div class="main-header" id="chatHeader">Select user</div><div class="main-body" id="chatMessages"><div style="text-align:center;color:#a0a0a0;padding:40px;">Select a user</div></div><div class="main-input" id="chatInput"><div style="display:flex"><input type="text" id="adminMsg" placeholder="Reply..." onkeypress="if(event.key==='Enter')sendReply()"><button onclick="sendReply()">Send</button></div></div></div></div>
<script src="/socket.io/socket.io.js"></script>
<script>
let sel=null,socket;
async function adminLogin(){const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('adminUser').value,password:document.getElementById('adminPass').value})});if(r.ok){document.getElementById('loginForm').style.display='none';document.getElementById('app').style.display='flex';init();loadUsers()}else alert('Invalid')}
function init(){socket=io();socket.emit('register',{name:'Admin',email:'admin'});socket.on('newMsg',(m)=>{if(sel===m.sender||sel===m.receiver)appendMsg(m);loadUsers()})}
async function loadUsers(){const r=await fetch('/api/admin/users');const u=await r.json();document.getElementById('userList').innerHTML=u.map(u=>'<div class="user-item'+(sel===u.email?' active':'')+'" onclick="selectUser(\''+u.email+'\')"><div class="user-avatar">'+u.name[0].toUpperCase()+'</div><div><div style="font-weight:600">'+u.name+'</div><div style="font-size:0.75em;opacity:0.6">'+u.email+'</div></div></div>').join('')}
async function selectUser(e){sel=e;document.getElementById('chatInput').style.display='block';document.getElementById('chatHeader').textContent='Chat: '+e;const r=await fetch('/api/msgs/'+e);const ms=await r.json();const c=document.getElementById('chatMessages');c.innerHTML=ms.map(m=>'<div class="msg '+(m.sender===e?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'</div>').join('');c.scrollTop=c.scrollHeight;document.querySelectorAll('.user-item').forEach(el=>el.classList.remove('active'));document.querySelector('[onclick="selectUser(\''+e+'\')"]').classList.add('active')}
function appendMsg(m){const c=document.getElementById('chatMessages');c.insertAdjacentHTML('beforeend','<div class="msg '+(m.sender===sel?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'</div>');c.scrollTop=c.scrollHeight}
function sendReply(){if(!sel)return;const i=document.getElementById('adminMsg');const m=i.value.trim();if(!m)return;socket.emit('sendMsg',{sender:'admin',receiver:sel,message:m,type:'text'});i.value=''}
</script>
</body>
</html>`);
});

app.post('/api/admin/login',async(req,res)=>{
  const user=await User.findOne({email:req.body.email,isAdmin:true});
  if(!user)return res.status(400).json({error:'Not found'});
  const valid=await bcrypt.compare(req.body.password,user.password);
  if(!valid)return res.status(400).json({error:'Wrong'});
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

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
  
  let musicSection='';
  if(songs.length>0){
    musicSection=`
    <section class="music-section" id="music">
      <div class="container">
        <h2 class="section-title">🎵 Official Cover Songs</h2>
        <p class="section-subtitle">Original covers by Baiilla Maach - Listen & Verify</p>
        <div class="music-player-card">
          <div class="music-artwork">
            <img src="${ASSETS.profile}" alt="Cover" onerror="this.style.display='none'">
            <div class="music-equalizer"><span></span><span></span><span></span><span></span></div>
          </div>
          <div class="music-info">
            <h3 id="trackTitle">Select a Song</h3>
            <p id="trackArtist">Baiilla Maach</p>
            <div class="music-controls">
              <button onclick="prevTrack()" class="ctrl-btn">⏮</button>
              <button id="playBtn" onclick="togglePlay()" class="play-btn">▶️</button>
              <button onclick="nextTrack()" class="ctrl-btn">⏭</button>
            </div>
            <div class="music-progress" onclick="seekTrack(event)">
              <div id="progressBar" class="progress-fill"></div>
            </div>
            <div class="music-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
          </div>
        </div>
        <div class="playlist">
          ${songs.map((s,i)=>`<div onclick="playTrack(${i})" class="playlist-item"><span class="track-num">${String(i+1).padStart(2,'0')}</span><span class="track-name">${s.title}</span><span class="track-icon">🎵</span></div>`).join('')}
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Poppins:wght@300;400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Dancing+Script:wght@700&family=Oswald:wght@500;600;700&family=Raleway:wght@300;400;600;700&family=Quicksand:wght@400;500;600;700&family=Bebas+Neue&family=Caveat:wght@700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Poppins',sans-serif;background:#fafafa;color:#1a1a2e;line-height:1.6;overflow-x:hidden}

/* Custom Scrollbar */
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:#f1f1f1}
::-webkit-scrollbar-thumb{background:#ff6600;border-radius:3px}

/* ===== HEADER - Montserrat Font ===== */
.header{font-family:'Montserrat',sans-serif;background:rgba(255,255,255,0.98);backdrop-filter:blur(20px);padding:15px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,0,0,0.05);position:sticky;top:0;z-index:1000;box-shadow:0 2px 20px rgba(0,0,0,0.03)}
.header-left{display:flex;align-items:center;gap:12px}
.header-left img{width:45px;height:45px;border-radius:50%;object-fit:cover;border:2px solid #ff6600;box-shadow:0 0 20px rgba(255,102,0,0.2)}
.header-left .brand-name{font-weight:700;font-size:1.2em;color:#1a1a2e;letter-spacing:-0.5px}
.header-right{display:flex;gap:12px;align-items:center}
.header-right .admin-link{font-family:'Poppins',sans-serif;font-weight:600;padding:10px 20px;border:2px solid #ff6600;color:#ff6600;border-radius:50px;text-decoration:none;font-size:0.9em;transition:0.3s}
.header-right .admin-link:hover{background:#ff6600;color:#fff}

/* ===== HERO - Playfair Display + Oswald Stats ===== */
.hero{background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);padding:100px 20px;text-align:center;color:#fff;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.hero-content{position:relative;z-index:2;max-width:700px;margin:0 auto}
.hero-img-wrap{position:relative;display:inline-block}
.hero-img-wrap .hero-pfp{width:150px;height:150px;border-radius:50%;border:5px solid #ff6600;object-fit:cover;box-shadow:0 0 60px rgba(255,102,0,0.4)}
.hero-img-wrap .hero-verified{position:absolute;bottom:15px;right:15px;width:36px;height:36px;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.hero h1{font-family:'Playfair Display',serif;font-size:3.5em;font-weight:900;margin:20px 0 5px;background:linear-gradient(135deg,#fff,#ff8533);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero .handle{font-family:'Quicksand',sans-serif;font-size:1.2em;opacity:0.9;font-weight:500;letter-spacing:1px}
.hero .bio{font-family:'Raleway',sans-serif;font-size:1.1em;opacity:0.8;font-weight:300;margin:10px 0 20px}
.hero-stats{display:flex;justify-content:center;gap:50px;margin:25px 0}
.hero-stats .stat-item{text-align:center}
.hero-stats .stat-num{font-family:'Oswald',sans-serif;font-size:2.2em;font-weight:700;color:#ff6600;letter-spacing:2px}
.hero-stats .stat-label{font-family:'Montserrat',sans-serif;font-size:0.85em;text-transform:uppercase;letter-spacing:3px;opacity:0.7}
.hero .verified-tag{font-family:'Poppins',sans-serif;display:inline-flex;align-items:center;gap:8px;background:rgba(0,200,83,0.15);padding:12px 28px;border-radius:50px;border:1px solid rgba(0,200,83,0.3);margin:20px 0;font-weight:600;color:#00e676;letter-spacing:1px}
.hero-social{display:flex;gap:15px;justify-content:center;margin-top:20px;flex-wrap:wrap}
.hero-social a{font-family:'Montserrat',sans-serif;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px;transition:0.3s;font-size:0.95em;letter-spacing:1px}
.hero-social a.tiktok-btn{background:linear-gradient(135deg,#000000,#333333);border:1px solid rgba(255,255,255,0.2)}
.hero-social a.fb-btn{background:linear-gradient(135deg,#1877f2,#0d5dc2);border:1px solid rgba(255,255,255,0.2)}
.hero-social a:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,0,0,0.3)}
.hero-social a img{width:20px;height:20px}

/* ===== OFFICIAL SECTION - Raleway Font ===== */
.official-section{font-family:'Raleway',sans-serif;background:linear-gradient(135deg,#e8f5e9,#c8e6c9,#a5d6a7);padding:80px 20px;position:relative}
.official-section::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 20% 50%,rgba(255,255,255,0.5) 0%,transparent 50%)}
.container{max-width:1100px;margin:0 auto;position:relative;z-index:1}
.section-title{font-family:'Playfair Display',serif;font-size:2.5em;font-weight:900;text-align:center;margin-bottom:10px;color:#1b5e20}
.section-subtitle{font-family:'Quicksand',sans-serif;text-align:center;color:#555;margin-bottom:50px;font-size:1.1em;font-weight:500}
.official-cards{display:grid;grid-template-columns:1fr 1fr;gap:30px}
.official-card{background:#fff;border-radius:20px;padding:35px;box-shadow:0 10px 40px rgba(0,0,0,0.08);transition:0.3s;border:2px solid transparent}
.official-card:hover{transform:translateY(-5px);box-shadow:0 20px 60px rgba(0,0,0,0.12)}
.official-card.tiktok{border-color:#00f2ea;background:linear-gradient(135deg,#fff,#f0fffe)}
.official-card.facebook{border-color:#1877f2;background:linear-gradient(135deg,#fff,#f0f5ff)}
.card-header{display:flex;align-items:center;gap:15px;margin-bottom:25px}
.card-header .platform-pfp{width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid #ddd}
.card-header .platform-info h3{font-family:'Montserrat',sans-serif;font-size:1.3em;font-weight:700;display:flex;align-items:center;gap:8px}
.card-header .platform-info h3 img{width:22px;height:22px}
.card-header .platform-info .handle{font-family:'Poppins',sans-serif;color:#888;font-size:0.9em}
.card-body .info-row{font-family:'Poppins',sans-serif;display:flex;align-items:center;gap:10px;padding:10px 0;color:#555;font-weight:500}
.card-body .info-row strong{color:#1a1a2e;font-weight:600}
.card-body .follow-link{font-family:'Montserrat',sans-serif;display:inline-block;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:700;color:#fff;margin-top:15px;text-transform:uppercase;letter-spacing:1px;font-size:0.9em;transition:0.3s}
.card-body .follow-link.tiktok-link{background:linear-gradient(135deg,#00f2ea,#ff0050)}
.card-body .follow-link.fb-link{background:linear-gradient(135deg,#1877f2,#0d5dc2)}
.card-body .follow-link:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,0.2)}

/* ===== FAKE ACCOUNTS - Oswald + Bebas Neue ===== */
.fake-section{font-family:'Oswald',sans-serif;background:linear-gradient(135deg,#fff5f5,#fee2e2,#fecaca);padding:80px 20px;position:relative}
.fake-section .section-title{font-family:'Bebas Neue',cursive;font-size:3em;letter-spacing:3px;color:#c62828}
.fake-section .section-subtitle{font-family:'Poppins',sans-serif;font-weight:400}
.fake-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px}
.fake-card{font-family:'Poppins',sans-serif;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.08);border:3px solid #ffcdd2;position:relative;transition:0.3s}
.fake-card:hover{transform:translateY(-5px);box-shadow:0 20px 60px rgba(239,68,68,0.2)}
.fake-card .fake-badge{font-family:'Bebas Neue',cursive;position:absolute;top:15px;right:15px;background:#ff1744;color:#fff;padding:8px 20px;border-radius:50px;font-weight:700;letter-spacing:3px;font-size:0.9em;z-index:1}
.fake-card .fake-img{width:100%;height:250px;object-fit:cover}
.fake-card .fake-info{padding:25px}
.fake-card .fake-info h3{font-family:'Montserrat',sans-serif;font-size:1.3em;font-weight:700;margin-bottom:5px}
.fake-card .fake-info .platform{font-family:'Raleway',sans-serif;color:#ff6600;font-weight:700;font-size:0.9em;margin-bottom:10px}
.fake-card .fake-info p{color:#666;font-size:0.95em;margin-bottom:15px;line-height:1.7}
.fake-card .fake-info .report-link{font-family:'Montserrat',sans-serif;display:inline-flex;align-items:center;gap:8px;background:#ff1744;color:#fff;padding:10px 22px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.85em;text-transform:uppercase;letter-spacing:1px;transition:0.3s}
.fake-card .fake-info .report-link:hover{background:#d50000;transform:translateY(-2px)}
.fake-card .fake-info .report-link img{width:18px;height:18px}

/* ===== VOICE SECTION - Dancing Script + Caveat ===== */
.voice-section{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);padding:80px 20px;color:#fff;text-align:center;position:relative}
.voice-section::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 70% 30%,rgba(255,102,0,0.2) 0%,transparent 50%)}
.voice-section .section-title{font-family:'Dancing Script',cursive;font-size:3em;color:#ff6600}
.voice-section .section-subtitle{font-family:'Caveat',cursive;font-size:1.3em;opacity:0.9}
.voice-buttons{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-top:30px}
.voice-btn{font-family:'Montserrat',sans-serif;padding:16px 35px;border-radius:50px;border:none;font-weight:700;cursor:pointer;font-size:1.1em;text-transform:uppercase;letter-spacing:2px;transition:0.3s;display:flex;align-items:center;gap:10px}
.voice-btn.welcome{background:linear-gradient(135deg,#ff6600,#ff8533);color:#fff;box-shadow:0 10px 30px rgba(255,102,0,0.4)}
.voice-btn.welcome:hover{transform:translateY(-3px);box-shadow:0 15px 40px rgba(255,102,0,0.6)}
.voice-btn.manual{background:linear-gradient(135deg,#ff1744,#ff5252);color:#fff;box-shadow:0 10px 30px rgba(255,23,68,0.4)}
.voice-btn.manual:hover{transform:translateY(-3px);box-shadow:0 15px 40px rgba(255,23,68,0.6)}

/* ===== PROOF SECTION - Quicksand Font ===== */
.proof-section{font-family:'Quicksand',sans-serif;background:linear-gradient(135deg,#f8f9fa,#e9ecef,#dee2e6);padding:80px 20px}
.proof-section .section-title{font-family:'Raleway',sans-serif;font-weight:700;color:#495057}
.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}
.proof-card{background:#fff;border-radius:20px;padding:30px;text-align:center;box-shadow:0 5px 25px rgba(0,0,0,0.05);transition:0.3s;border:2px solid #e0e0e0}
.proof-card:hover{transform:translateY(-8px);box-shadow:0 15px 40px rgba(0,0,0,0.1);border-color:#ff6600}
.proof-card img{max-width:100%;border-radius:15px;margin-bottom:15px}
.proof-card p{font-family:'Poppins',sans-serif;font-weight:600;font-size:1.1em;color:#1a1a2e}

/* ===== MUSIC SECTION - Poppins Font ===== */
.music-section{background:linear-gradient(135deg,#1a1a2e,#2d2d44,#1a1a2e);padding:80px 20px;color:#fff;font-family:'Poppins',sans-serif}
.music-section .section-title{font-family:'Playfair Display',serif;color:#ff6600}
.music-section .section-subtitle{font-family:'Quicksand',sans-serif;opacity:0.8}
.music-player-card{max-width:650px;margin:0 auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:25px;padding:40px;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.music-artwork{position:relative}
.music-artwork img{width:130px;height:130px;border-radius:50%;object-fit:cover;border:4px solid #ff6600;box-shadow:0 0 40px rgba(255,102,0,0.3)}
.music-equalizer{display:flex;gap:3px;justify-content:center;margin-top:10px}
.music-equalizer span{width:4px;height:20px;background:#ff6600;border-radius:2px;animation:eq 1s infinite}
.music-equalizer span:nth-child(2){animation-delay:0.2s}
.music-equalizer span:nth-child(3){animation-delay:0.4s}
.music-equalizer span:nth-child(4){animation-delay:0.6s}
@keyframes eq{0%,100%{height:10px}50%{height:25px}}
.music-info{flex:1;text-align:center}
.music-info h3{font-family:'Montserrat',sans-serif;font-size:1.3em;margin-bottom:5px}
.music-info p{font-family:'Raleway',sans-serif;color:#ff6600;font-weight:600;margin-bottom:15px}
.music-controls{display:flex;justify-content:center;align-items:center;gap:15px;margin-bottom:15px}
.ctrl-btn{font-family:'Poppins',sans-serif;background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em;transition:0.3s}
.ctrl-btn:hover{background:rgba(255,255,255,0.2)}
.play-btn{background:linear-gradient(135deg,#ff6600,#ff8533);border:none;color:#fff;width:60px;height:60px;border-radius:50%;cursor:pointer;font-size:1.5em;transition:0.3s;box-shadow:0 5px 25px rgba(255,102,0,0.4)}
.play-btn:hover{transform:scale(1.05);box-shadow:0 8px 35px rgba(255,102,0,0.6)}
.music-progress{background:rgba(255,255,255,0.2);height:6px;border-radius:3px;cursor:pointer;margin:10px 0}
.progress-fill{background:#ff6600;height:100%;border-radius:3px;width:0%;transition:width 0.1s}
.music-time{font-family:'Quicksand',sans-serif;font-size:0.9em;opacity:0.8}
.playlist{max-width:650px;margin:20px auto 0;background:rgba(255,255,255,0.03);border-radius:20px;overflow:hidden}
.playlist-item{font-family:'Poppins',sans-serif;padding:14px 25px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:15px;transition:0.2s}
.playlist-item:hover{background:rgba(255,102,0,0.1)}
.playlist-item.active{background:rgba(255,102,0,0.2);border-left:4px solid #ff6600}
.track-num{font-family:'Oswald',sans-serif;font-weight:700;color:#ff6600;font-size:1.1em;min-width:30px}
.track-name{font-weight:500}
.track-icon{color:#ff6600}

/* ===== FOOTER ===== */
.footer{font-family:'Raleway',sans-serif;background:#0a0a1a;color:#fff;padding:50px 20px 30px;text-align:center}
.footer-grid{max-width:1000px;margin:0 auto 30px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:30px;text-align:left}
.footer h4{font-family:'Montserrat',sans-serif;color:#ff6600;margin-bottom:15px;font-size:1.1em;text-transform:uppercase;letter-spacing:2px}
.footer p,.footer a{color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.9em;line-height:1.8}
.footer a:hover{color:#ff6600}
.footer-bottom{font-family:'Quicksand',sans-serif;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:0.85em}

/* ===== CHAT WIDGET ===== */
.chat-widget{position:fixed;bottom:25px;right:25px;z-index:999;cursor:pointer}
.chat-widget .chat-bubble-img{width:65px;height:65px;border-radius:50%;box-shadow:0 8px 30px rgba(0,200,83,0.5);animation:chatBounce 2s infinite;transition:0.3s}
.chat-widget .chat-bubble-img:hover{transform:scale(1.1)}
@keyframes chatBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.chat-window{display:none;position:fixed;bottom:100px;right:25px;width:370px;height:500px;background:#fff;border-radius:20px;box-shadow:0 15px 50px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:999}
.chat-window.open{display:flex}
.chat-window .chat-window-header{font-family:'Montserrat',sans-serif;background:linear-gradient(135deg,#ff6600,#ff8533);color:#fff;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;font-weight:600}
.chat-window .chat-window-header button{background:none;border:none;color:#fff;font-size:1.3em;cursor:pointer}
.chat-window .chat-body{flex:1;overflow-y:auto;padding:15px;background:#f5f5f5;font-family:'Poppins',sans-serif}
.chat-window .chat-login{padding:30px;text-align:center}
.chat-window .chat-login input{width:100%;padding:12px;margin-bottom:12px;border:2px solid #e0e0e0;border-radius:12px;font-family:'Poppins',sans-serif;font-size:0.9em;transition:0.3s}
.chat-window .chat-login input:focus{outline:none;border-color:#ff6600}
.chat-window .chat-login button{font-family:'Montserrat',sans-serif;width:100%;padding:14px;background:linear-gradient(135deg,#ff6600,#ff8533);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:0.3s}
.chat-window .chat-login button:hover{box-shadow:0 8px 25px rgba(255,102,0,0.4)}
.chat-window .chat-input-area{padding:12px 15px;background:#fff;border-top:1px solid #e0e0e0;display:none}
.chat-window .chat-input-area input{font-family:'Poppins',sans-serif;flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:25px;outline:none;font-size:0.9em}
.chat-window .chat-input-area input:focus{border-color:#ff6600}
.chat-window .chat-input-area button{background:#ff6600;color:#fff;border:none;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:1.1em;margin-left:8px;transition:0.3s}
.chat-window .chat-input-area button:hover{background:#e55a00}
.msg-bubble{max-width:80%;padding:10px 15px;border-radius:18px;margin-bottom:8px;font-size:0.9em;word-wrap:break-word;animation:msgSlide 0.3s}
@keyframes msgSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-bubble.user{background:linear-gradient(135deg,#ff6600,#ff8533);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg-bubble.admin{background:#fff;color:#333;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.msg-bubble .msg-time{font-family:'Quicksand',sans-serif;font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}

@media(max-width:768px){
  .hero h1{font-size:2em}
  .official-cards,.fake-grid{grid-template-columns:1fr}
  .proof-grid{grid-template-columns:1fr}
  .music-player-card{flex-direction:column;padding:25px}
  .chat-window{width:100%;height:100%;bottom:0;right:0;border-radius:0}
}
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <img src="${ASSETS.profile}" alt="Logo" onerror="this.style.display='none'">
    <span class="brand-name">Baiilla Maach</span>
  </div>
  <div class="header-right">
    <a href="/admin" class="admin-link">🔐 Admin Panel</a>
  </div>
</header>

<section class="hero">
  <div class="hero-content">
    <div class="hero-img-wrap">
      <img src="${ASSETS.profile}" alt="Baiilla Maach" class="hero-pfp" onerror="this.style.display='none'">
      <img src="${ASSETS.blueTikTok}" alt="Verified" class="hero-verified" onerror="this.style.display='none'">
    </div>
    <h1>Baiilla Maach Official</h1>
    <p class="handle">@baiillamaach_official</p>
    <p class="bio">Official Entertainment Profile | Verified Creator</p>
    <div class="hero-stats">
      <div class="stat-item"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div>
      <div class="stat-item"><div class="stat-num">0</div><div class="stat-label">Following</div></div>
      <div class="stat-item"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div>
    </div>
    <div class="verified-tag">✅ VERIFIED OFFICIAL ACCOUNT</div>
    <div class="hero-social">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="tiktok-btn"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="fb-btn"><img src="${ASSETS.logoFB}" alt=""> Facebook</a>
    </div>
  </div>
</section>

<section class="official-section" id="official">
  <div class="container">
    <h2 class="section-title">✅ Official Verified Accounts</h2>
    <p class="section-subtitle">The ONLY authentic Baiilla Maach accounts with blue tick verification</p>
    <div class="official-cards">
      <div class="official-card tiktok">
        <div class="card-header">
          <img src="${ASSETS.profile}" alt="" class="platform-pfp" onerror="this.style.display='none'">
          <div class="platform-info">
            <h3>TikTok <img src="${ASSETS.blueTikTok}" alt="" onerror="this.style.display='none'"></h3>
            <p class="handle">@baiillamaach_official</p>
          </div>
        </div>
        <div class="card-body">
          <div class="info-row">✅ <strong>Status:</strong> <span style="color:#00c853">Active & Verified</span></div>
          <div class="info-row">👥 <strong>Followers:</strong> 7,000</div>
          <div class="info-row">❤️ <strong>Likes:</strong> 190,000</div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-link tiktok-link">Follow on TikTok</a>
        </div>
      </div>
      <div class="official-card facebook">
        <div class="card-header">
          <img src="${ASSETS.fbProfile}" alt="" class="platform-pfp" onerror="this.style.display='none'">
          <div class="platform-info">
            <h3>Facebook <img src="${ASSETS.blueFB}" alt="" onerror="this.style.display='none'"></h3>
            <p class="handle">@BaiillaMaachOfficial</p>
          </div>
        </div>
        <div class="card-body">
          <div class="info-row">✅ <strong>Status:</strong> <span style="color:#00c853">Active & Verified</span></div>
          <div class="info-row">📘 <strong>Page:</strong> Official Facebook Page</div>
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-link fb-link">Follow on Facebook</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="fake-section" id="fake">
  <div class="container">
    <h2 class="section-title">⚠️ Fake Accounts Detected</h2>
    <p class="section-subtitle">2 fake accounts found — Report them immediately to protect others</p>
    <div class="fake-grid">
      <div class="fake-card">
        <div class="fake-badge">FAKE</div>
        <img src="${ASSETS.baillamachFake}" alt="" class="fake-img" onerror="this.style.display='none'">
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="platform">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers. Uses similar name to confuse fans.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-link"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
        </div>
      </div>
      <div class="fake-card">
        <div class="fake-badge">FAKE</div>
        <img src="${ASSETS.hammadFake}" alt="" class="fake-img" onerror="this.style.display='none'">
        <div class="fake-info">
          <h3>@hammad_fams0</h3>
          <p class="platform">📍 TikTok</p>
          <p>Uses official name and photo to mislead followers. Impersonating with fake content.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-link"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
        </div>
      </div>
    </div>
  </div>
</section>

${WELCOME_VOICE||MANUAL_VOICE?`
<section class="voice-section" id="voice">
  <div class="container">
    <h2 class="section-title">🔊 Voice Verification</h2>
    <p class="section-subtitle">Listen to verify the authentic Baiilla Maach voice</p>
    <div class="voice-buttons">
      ${WELCOME_VOICE?`<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>`:''}
      ${MANUAL_VOICE?`<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert Voice</button>`:''}
    </div>
  </div>
</section>`:''}

<section class="proof-section" id="proof">
  <div class="container">
    <h2 class="section-title">🔒 Identity Proof</h2>
    <p class="section-subtitle">Evidence confirming the authenticity of Baiilla Maach</p>
    <div class="proof-grid">
      <div class="proof-card"><img src="${ASSETS.realId}" alt="" onerror="this.style.display='none'"><p>Real ID Verified</p></div>
      <div class="proof-card"><img src="${ASSETS.fakeDetect}" alt="" onerror="this.style.display='none'"><p>Fake Account Detection</p></div>
      <div class="proof-card"><img src="${ASSETS.microphone}" alt="" onerror="this.style.display='none'"><p>Real Voice Recording</p></div>
    </div>
  </div>
</section>

${musicSection}

<footer class="footer">
  <div class="footer-grid">
    <div><h4>About This Hub</h4><p>The ONLY official verification hub for Baiilla Maach. We help fans identify authentic accounts and avoid scams.</p></div>
    <div><h4>Quick Links</h4><p><a href="https://tiktok.com/@baiillamaach_official">Official TikTok</a></p><p><a href="https://www.facebook.com/profile.php?id=61575202118828">Official Facebook</a></p></div>
    <div><h4>Contact</h4><p>Use the chat button for verification queries or to report fake accounts.</p></div>
  </div>
  <div class="footer-bottom"><p>© 2024 Baiilla Maach Official. All Rights Reserved.</p><p style="margin-top:5px">⚠️ This is the only official verification hub</p></div>
</footer>

<div class="chat-widget" onclick="openChat()"><img src="${ASSETS.messageBubble}" alt="Chat" class="chat-bubble-img"></div>
<div class="chat-window" id="chatWindow">
  <div class="chat-window-header"><strong>💬 Baiilla Maach Support</strong><button onclick="closeChat()">✕</button></div>
  <div class="chat-body" id="chatBody"><div class="chat-login" id="chatLogin"><h4 style="margin-bottom:15px">Start Chat</h4><input type="text" id="chatName" placeholder="Your Name"><input type="text" id="chatEmail" placeholder="Email or Phone"><button onclick="startChat()">Start Chatting</button></div></div>
  <div class="chat-input-area" id="chatInput"><div style="display:flex;align-items:center"><input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">➤</button></div></div>
</div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>`:''}
${MANUAL_VOICE?`<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
window.addEventListener('load',()=>{const a=document.getElementById('welcomeAudio');if(a)setTimeout(()=>a.play().catch(()=>{}),1000)});
function playWelcome(){const a=document.getElementById('welcomeAudio');if(a){a.currentTime=0;a.play()}}
function playManual(){const a=document.getElementById('manualAudio');if(a){a.currentTime=0;a.play()}}

const tracks=${JSON.stringify(songs)};
let currentTrack=0,playing=false;
const audio=new Audio();
if(tracks.length>0){audio.src=tracks[0].url;audio.load()}
function playTrack(i){currentTrack=i;audio.src=tracks[i].url;audio.load();audio.play();playing=true;document.getElementById('playBtn').textContent='⏸️';document.getElementById('trackTitle').textContent=tracks[i].title;document.querySelectorAll('.playlist-item').forEach((el,j)=>el.classList.toggle('active',j===i))}
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
function openChat(){document.getElementById('chatWindow').classList.add('open')}
function closeChat(){document.getElementById('chatWindow').classList.remove('open')}
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
  body.innerHTML=msgs.map(m=>'<div class="msg-bubble '+(m.sender===chatUser.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
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
    body.insertAdjacentHTML('beforeend','<div class="msg-bubble '+(msg.sender===chatUser.email?'user':'admin')+'">'+(msg.type==='image'?'<img src="'+msg.fileUrl+'" style="max-width:150px;border-radius:8px">':msg.message)+'<div class="msg-time">'+new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');
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

// Admin Panel (same professional one from before)
app.get('/admin',(req,res)=>{
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f0f2f5;height:100vh;overflow:hidden}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-box{background:#fff;padding:40px;border-radius:20px;width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.login-box h2{font-family:'Montserrat',sans-serif;text-align:center;margin-bottom:30px;color:#1a1a2e;font-size:1.5em}
.login-box input{width:100%;padding:14px;margin-bottom:15px;border:2px solid #e0e0e0;border-radius:12px;font-family:'Inter',sans-serif;font-size:1em;transition:0.3s}
.login-box input:focus{outline:none;border-color:#ff6600}
.login-box button{font-family:'Montserrat',sans-serif;width:100%;padding:14px;background:#ff6600;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:600;cursor:pointer;transition:0.3s;text-transform:uppercase;letter-spacing:1px}
.login-box button:hover{background:#e55a00}
.app{display:none;height:100vh}
.sidebar{width:350px;background:#fff;border-right:1px solid #e0e0e0;display:flex;flex-direction:column;font-family:'Poppins',sans-serif}
.sidebar-header{padding:20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-family:'Montserrat',sans-serif;font-size:1.3em;color:#1a1a2e}
.logout-btn{background:#ff1744;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85em;font-family:'Poppins',sans-serif}
.search-box{padding:15px 20px;border-bottom:1px solid #e0e0e0}
.search-box input{width:100%;padding:10px 15px;border:2px solid #e0e0e0;border-radius:25px;font-family:'Inter',sans-serif;font-size:0.9em;outline:none;background:#f5f5f5}
.search-box input:focus{border-color:#ff6600;background:#fff}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:15px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:0.2s}
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
.unread-badge{background:#ff1744;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.7em;font-weight:700}
.chat-area{flex:1;display:flex;flex-direction:column;background:#f5f5f5}
.chat-header{padding:20px;background:#fff;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:12px}
.chat-header-name{font-family:'Montserrat',sans-serif;font-weight:700;font-size:1.1em}
.chat-header-status{font-family:'Poppins',sans-serif;font-size:0.85em;color:#10b981}
.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:5px}
.empty-chat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#999;font-family:'Poppins',sans-serif}
.msg-bubble{font-family:'Inter',sans-serif;max-width:70%;padding:10px 15px;border-radius:18px;word-wrap:break-word;animation:slideIn 0.3s}
@keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-bubble.user{background:#ff6600;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.msg-bubble.admin{background:#fff;color:#333;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.msg-bubble .msg-time{font-size:0.7em;opacity:0.7;margin-top:5px;text-align:right}
.chat-input-area{padding:15px 20px;background:#fff;border-top:1px solid #e0e0e0;display:flex;align-items:center;gap:10px}
.chat-input-area input{font-family:'Inter',sans-serif;flex:1;padding:12px 18px;border:2px solid #e0e0e0;border-radius:25px;font-size:0.95em;outline:none}
.chat-input-area input:focus{border-color:#ff6600}
.send-btn{background:#ff6600;color:#fff;border:none;width:45px;height:45px;border-radius:50%;cursor:pointer;font-size:1.2em}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay"><div class="login-box"><h2>🔐 Admin Login</h2><input type="text" id="adminEmail" placeholder="Email" value="admin"><input type="password" id="adminPassword" placeholder="Password" value="admin123"><button onclick="adminLogin()">Login to Admin Panel</button></div></div>
<div class="app" id="app"><div class="sidebar"><div class="sidebar-header"><h2>💬 Messages</h2><button class="logout-btn" onclick="logout()">Logout</button></div><div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search users..." oninput="filterUsers()"></div><div class="user-list" id="userList"></div></div><div class="chat-area"><div class="chat-header"><div><div class="chat-header-name" id="chatHeaderName">Select a user</div><div class="chat-header-status" id="chatHeaderStatus"></div></div></div><div class="chat-messages" id="chatMessages"><div class="empty-chat"><h3>💬 Select a conversation</h3><p>Choose a user from the left</p></div></div><div class="chat-input-area" id="chatInputArea" style="display:none"><input type="text" id="adminMessageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendAdminMessage()"><button class="send-btn" onclick="sendAdminMessage()">➤</button></div></div></div>
<script src="/socket.io/socket.io.js"></script>
<script>
let currentUser=null,socket=null,allUsers=[];
async function adminLogin(){const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('adminEmail').value,password:document.getElementById('adminPassword').value})});if(res.ok){document.getElementById('loginOverlay').style.display='none';document.getElementById('app').style.display='flex';initSocket();loadUsers()}else alert('Invalid')}
function logout(){if(socket)socket.disconnect();document.getElementById('loginOverlay').style.display='flex';document.getElementById('app').style.display='none'}
function initSocket(){socket=io();socket.emit('register',{name:'Admin',email:'admin'});socket.on('newMsg',(msg)=>{if(currentUser&&(msg.sender===currentUser||msg.receiver===currentUser))appendMessage(msg);loadUsers()})}
async function loadUsers(){const res=await fetch('/api/admin/users');allUsers=await res.json();renderUsers()}
function renderUsers(f=''){document.getElementById('userList').innerHTML=(f?allUsers.filter(u=>u.name.toLowerCase().includes(f)||u.email.toLowerCase().includes(f)):allUsers).map(u=>'<div class="user-item'+(currentUser===u.email?' active':'')+'" onclick="selectUser(\''+u.email+'\')"><div class="user-avatar">'+u.name[0].toUpperCase()+'</div><div class="user-info"><div class="user-name">'+u.name+'</div><div class="user-email">'+u.email+'</div><div class="user-meta"><div class="user-status '+(u.isOnline?'online':'offline')+'"></div></div></div>'+(u.unreadCount>0?'<div class="unread-badge">'+u.unreadCount+'</div>':'')+'</div>').join('')}
function filterUsers(){renderUsers(document.getElementById('searchInput').value.toLowerCase())}
async function selectUser(email){currentUser=email;document.getElementById('chatInputArea').style.display='flex';document.getElementById('chatHeaderName').textContent=allUsers.find(u=>u.email===email)?.name||email;const res=await fetch('/api/msgs/'+email);const msgs=await res.json();const c=document.getElementById('chatMessages');c.innerHTML=msgs.length?msgs.map(m=>'<div class="msg-bubble '+(m.sender===email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join(''):'<div class="empty-chat"><h3>No messages</h3></div>';c.scrollTop=c.scrollHeight;socket.emit('markRead',{user:email});renderUsers()}
function appendMessage(m){const c=document.getElementById('chatMessages');c.querySelector('.empty-chat')?.remove();c.insertAdjacentHTML('beforeend','<div class="msg-bubble '+(m.sender===currentUser?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');c.scrollTop=c.scrollHeight}
function sendAdminMessage(){if(!currentUser)return;const i=document.getElementById('adminMessageInput');const m=i.value.trim();if(!m)return;socket.emit('sendMsg',{sender:'admin',receiver:currentUser,message:m,type:'text'});i.value=''}
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

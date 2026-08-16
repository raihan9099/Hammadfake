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
const multer=require('multer');

const app=express();
const server=http.createServer(app);
const io=socketIO(server);

const PORT=process.env.PORT||3000;
const MONGO_URI=process.env.MONGO_URI||'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

app.use(express.json());
app.use('/assets',express.static('assets'));
app.use('/uploads',express.static('uploads'));
app.use('/assets/covermusic',express.static('assets/covermusic'));

['uploads','assets/covermusic','assets/gallery'].forEach(d=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true})});

const User=mongoose.model('User',new mongoose.Schema({
  name:String,
  email:{type:String,unique:true},
  password:String,
  isAdmin:{type:Boolean,default:false},
  lastSeen:Date,
  isOnline:{type:Boolean,default:false},
  unreadCount:{type:Number,default:0},
  createdAt:{type:Date,default:Date.now}
}));

const Message=mongoose.model('Message',new mongoose.Schema({
  sender:String,
  receiver:String,
  message:String,
  type:{type:String,default:'text'},
  fileUrl:String,
  seen:{type:Boolean,default:false},
  timestamp:{type:Date,default:Date.now}
}));

const GalleryPhoto=mongoose.model('GalleryPhoto',new mongoose.Schema({
  path:String,
  caption:String,
  uploadedAt:{type:Date,default:Date.now}
}));

mongoose.connect(MONGO_URI).then(async()=>{
  console.log('MongoDB connected');
  const admin=await User.findOne({email:'admin'});
  if(!admin){
    await User.create({
      name:'Baiilla Maach',
      email:'admin',
      password:await bcrypt.hash('admin123',10),
      isAdmin:true
    });
    console.log('Admin created: admin / admin123');
  }
}).catch(e=>console.log('MongoDB error:',e.message));

const ASSETS={
  profile:"/assets/celebrity_pfp.jpeg",
  fbProfile:"/assets/fb_profile.jpg",
  blueTikTok:"/assets/bluetick_tiktok.png",
  blueFB:"/assets/blue_tick_fb.png",
  logoFB:"/assets/logo_fb.png",
  logoTikTok:"/assets/logo_tiktok.png",
  logoFbPage:"/assets/logo_fbpage.png",
  messageBubble:"/assets/message_bubble.gif",
  microphone:"/assets/microphone-in-hand.gif",
  reportBtn:"/assets/report_button.png",
  realId:"/assets/real-id-ss.png",
  fakeDetect:"/assets/Fakedetect_updown.png",
  baillamachFake:"/assets/baillamach_fake.png",
  hammadFake:"/assets/hammadfams.png",
  playGif:"/assets/play.gif",
  followGif:"/assets/follow.gif",
  addGif:"/assets/add.gif",
  propagandaGif:"/assets/propaganda.gif",
  cpl:"/assets/cpl.png",
  sIcon:"/assets/s.png",
  p1g:"/assets/1p.g.png",
  cpn:"/assets/cpn.png",
  dv:"/assets/dv.png",
  xIcon:"/assets/x.png",
  dq:"/assets/dq.png",
  doIcon:"/assets/do.png",
  dj:"/assets/dj.png",
  vIcon:"/assets/v.png",
  uIcon:"/assets/u.png",
  ef:"/assets/ef.png",
  ds:"/assets/ds.png",
  fg:"/assets/fg.png",
  v0g:"/assets/0v.g.png",
  q0g:"/assets/0q.g.png",
  l0:"/assets/0l.png",
  g5:"/assets/5_.g.png",
  g15:"/assets/15.g.png",
  g12:"/assets/12.g.png",
  g7:"/assets/7_.g.png",
  a0g:"/assets/0a.g.png",
  g07:"/assets/07.g.png",
  hlo:"/assets/hlo.png",
  col:"/assets/col.png",
  cop:"/assets/cop.png",
  ze:"/assets/ze.png",
  zb:"/assets/zb.png",
  za:"/assets/za.png",
  yg:"/assets/y.g.png",
  zg:"/assets/z.g.png",
  rIcon:"/assets/r.png"
};

const WELCOME_VOICE=fs.existsSync('assets/realvoice.mp3');
const MANUAL_VOICE=fs.existsSync('assets/manualvoice_alert.mp3');

function getSongs(){
  try{
    const dir='assets/covermusic';
    if(!fs.existsSync(dir))return[];
    return fs.readdirSync(dir).filter(f=>f.endsWith('.mp3')).map((f,i)=>({
      id:i,
      title:f.replace('.mp3','').replace(/[-_#]/g,' ').replace(/\b\w/g,l=>l.toUpperCase()),
      url:'/assets/covermusic/'+encodeURIComponent(f)
    }));
  }catch(e){return[]}
}

function getGallery(){
  try{
    const dir='assets/gallery';
    if(!fs.existsSync(dir))return[];
    return fs.readdirSync(dir).filter(f=>['.jpg','.jpeg','.png','.gif','.webp'].includes(path.extname(f).toLowerCase())).map(f=>({
      url:'/assets/gallery/'+encodeURIComponent(f),
      name:f
    }));
  }catch(e){return[]}
}

app.get('/',(req,res)=>{
  const songs=getSongs();
  const gallery=getGallery();

  let musicSection='';
  if(songs.length>0){
    musicSection=`
    <section class="section" id="music">
      <h2><img src="${ASSETS.playGif}" alt="" style="width:30px;height:30px;vertical-align:middle"> Cover Music</h2>
      <p>Official covers by Baiilla Maach</p>
      <div class="music-player">
        <img src="${ASSETS.profile}" class="music-cover" onerror="this.style.display='none'">
        <h3 id="trackTitle">Select Song</h3>
        <p class="music-artist">Baiilla Maach</p>
        <div class="music-controls">
          <button class="music-btn" onclick="prevTrack()">⏮</button>
          <button class="music-btn music-play" id="playBtn" onclick="togglePlay()">▶️</button>
          <button class="music-btn" onclick="nextTrack()">⏭</button>
        </div>
        <div class="music-progress" onclick="seekTrack(event)"><div id="progressBar"></div></div>
        <div class="music-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
      </div>
      <div class="music-list">
        ${songs.map((s,i)=>`<div onclick="playTrack(${i})" class="music-item" id="song${i}"><span class="music-num">${i+1}.</span><span>${s.title}</span></div>`).join('')}
      </div>
    </section>`;
  }

  let gallerySection='';
  if(gallery.length>0){
    gallerySection=`
    <section class="section" id="gallery">
      <h2><img src="${ASSETS.cpl}" alt="" style="width:30px;height:30px;vertical-align:middle"> Gallery</h2>
      <p>Official photos and moments</p>
      <div class="gallery-grid">
        ${gallery.map(g=>`<div class="gallery-item"><img src="${g.url}" alt="${g.name}" loading="lazy" onerror="this.style.display='none'"></div>`).join('')}
      </div>
    </section>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#09090b">
<title>Baiilla Maach Official | Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#09090b 0%,#101014 50%,#141418 100%);color:#e5e5e5;min-height:100vh;overflow-x:hidden;line-height:1.6}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:2px}
::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.15);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:rgba(139,92,246,0.3)}

.gradient-text{background:linear-gradient(135deg,#a78bfa 0%,#ec4899 50%,#a78bfa 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradientShift 3s ease infinite}
@keyframes gradientShift{0%,100%{background-position:left center}50%{background-position:right center}}

.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.hover-lift{transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275)}
.hover-lift:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,0.3)}

.verified-glow{animation:verifiedPulse 2s ease-in-out infinite}
@keyframes verifiedPulse{0%,100%{box-shadow:0 0 12px rgba(34,197,94,0.3)}50%{box-shadow:0 0 28px rgba(34,197,94,0.6)}}

.danger-glow{animation:dangerPulse 1.5s ease-in-out infinite}
@keyframes dangerPulse{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.3)}50%{box-shadow:0 0 20px rgba(239,68,68,0.6)}}

.header-hide{transform:translateY(-100%);transition:transform 0.3s ease}
.header-show{transform:translateY(0);transition:transform 0.3s ease}

.watermark-fake{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);font-size:3.5rem;font-weight:900;color:rgba(239,68,68,0.04);pointer-events:none;letter-spacing:6px;white-space:nowrap;z-index:0}

.header{position:fixed;top:0;left:0;right:0;z-index:50;padding:0 16px;height:50px;display:flex;align-items:center;justify-content:space-between}
.header-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;width:100%}
.header-left{display:flex;align-items:center;gap:8px}
.header-left img{width:28px;height:28px;object-fit:contain}
.header-left span{font-size:0.9rem;font-weight:700}
.header-nav{display:flex;gap:4px}
.header-nav a{color:#9ca3af;text-decoration:none;font-size:0.75rem;padding:4px 10px;border-radius:6px;transition:0.2s}
.header-nav a:hover{color:#fff;background:rgba(255,255,255,0.05)}

main{max-width:900px;margin:0 auto;padding:60px 12px 20px}

.hero{text-align:center;padding:30px 0}
.hero-avatar-wrap{position:relative;display:inline-block;margin-bottom:12px}
.hero-avatar{width:90px;height:90px;border-radius:50%;border:3px solid #9333ea;object-fit:cover}
.hero-tick{position:absolute;bottom:0;right:0;width:26px;height:26px;object-fit:contain}
.hero-name{font-size:1.5rem;font-weight:800}
.hero-bio{font-size:0.8rem;color:#9ca3af;margin:4px 0 10px}
.hero-stats{display:flex;justify-content:center;gap:16px;margin-bottom:12px}
.hero-stat{text-align:center}
.hero-stat-num{font-size:1.2rem;font-weight:700;color:#fff}
.hero-stat-label{font-size:0.65rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px}
.hero-badges{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.hero-badge{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;font-size:0.7rem;font-weight:600}
.badge-green{background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.25)}
.badge-purple{background:rgba(147,51,234,0.1);color:#a78bfa;border:1px solid rgba(147,51,234,0.25)}
.badge-gray{background:rgba(255,255,255,0.05);color:#d1d5db;border:1px solid rgba(255,255,255,0.1)}
.hero-badge img{width:14px;height:14px;object-fit:contain}
.hero-links{display:flex;justify-content:center;gap:8px}
.hero-links a{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:22px;text-decoration:none;font-size:0.8rem;font-weight:600;color:#fff;transition:0.2s}
.hero-links a img{width:16px;height:16px;object-fit:contain}
.btn-tiktok{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1)}
.btn-tiktok:hover{background:rgba(0,0,0,0.6)}
.btn-facebook{background:rgba(24,119,242,0.2);border:1px solid rgba(24,119,242,0.3)}
.btn-facebook:hover{background:rgba(24,119,242,0.3)}

.section{padding:25px 0}
.section h2{font-size:1.2rem;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.section p{font-size:0.8rem;color:#9ca3af;margin-bottom:16px}

.official-card{padding:16px;position:relative;overflow:hidden}
.official-verify{position:absolute;top:12px;right:12px;width:28px;height:28px;object-fit:contain}
.official-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.official-verify-icon{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.official-verify-icon img{width:18px;height:18px;object-fit:contain}
.official-header h3{font-size:0.95rem;font-weight:700}
.official-header p{font-size:0.7rem;color:#9ca3af;margin:0}
.official-body{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.official-body{grid-template-columns:1fr}}
.official-accounts{display:flex;flex-direction:column;gap:8px}
.official-account{background:rgba(31,31,35,0.5);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.04)}
.account-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.account-platform{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600}
.account-tick{width:18px;height:18px;object-fit:contain}
.account-info{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.account-avatar{width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,0.1)}
.account-avatar-placeholder{width:40px;height:40px;border-radius:10px;background:rgba(31,31,35,0.8);display:flex;align-items:center;justify-content:center}
.account-avatar-placeholder img{width:24px;height:24px;object-fit:contain}
.account-name{font-size:0.85rem;font-weight:700}
.account-detail{font-size:0.7rem;color:#9ca3af}
.account-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;text-align:center}
.account-stat{background:rgba(39,39,43,0.4);border-radius:8px;padding:6px}
.account-stat-num{font-size:0.85rem;font-weight:700;color:#fff}
.account-stat-label{font-size:0.6rem;color:#6b7280}

.official-preview{background:rgba(31,31,35,0.5);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.04);text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
.official-preview img{width:50px;height:50px;border-radius:50%;border:2px solid #22c55e;margin-bottom:8px;object-fit:cover}
.official-preview-name{font-size:0.9rem;font-weight:700}
.official-preview-platform{font-size:0.7rem;color:#9ca3af;margin:2px 0 10px}
.official-follow{display:inline-flex;align-items:center;gap:6px;padding:8px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:22px;text-decoration:none;font-weight:700;font-size:0.75rem;color:#fff;transition:0.2s}
.official-follow:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(34,197,94,0.3)}
.official-follow img{width:14px;height:14px;object-fit:contain}
.official-note{font-size:0.65rem;color:#6b7280;margin-top:8px}

.fake-alert-box{padding:12px;border-radius:12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);display:flex;align-items:center;gap:8px;margin-bottom:12px}
.fake-alert-icon{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fake-alert-icon img{width:16px;height:16px;object-fit:contain}
.fake-alert-text h4{font-size:0.8rem;font-weight:700;color:#f87171}
.fake-alert-text p{font-size:0.7rem;color:#9ca3af;margin:0}

.fake-carousel{position:relative;overflow:hidden;border-radius:12px}
.fake-track{display:flex;transition:transform 0.4s ease}
.fake-slide{min-width:100%;padding:0 2px}
.fake-card{padding:14px;position:relative;overflow:hidden;border:1px solid rgba(239,68,68,0.15)}
.fake-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;position:relative;z-index:1}
.fake-card-title{display:flex;align-items:center;gap:4px;font-size:0.8rem;font-weight:700;color:#f87171}
.fake-card-badge{padding:3px 10px;background:rgba(239,68,68,0.15);color:#f87171;border-radius:12px;font-size:0.6rem;font-weight:700;text-transform:uppercase}
.fake-card-body{display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative;z-index:1}
@media(max-width:500px){.fake-card-body{grid-template-columns:1fr}}
.fake-screenshot{position:relative;border-radius:10px;overflow:hidden;border:2px solid rgba(239,68,68,0.2)}
.fake-screenshot img{width:100%;display:block;opacity:0.85}
.fake-watermark{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;gap:3px}
.fake-watermark span{background:rgba(239,68,68,0.85);color:#fff;padding:4px 10px;border-radius:10px;font-weight:800;font-size:0.65rem;letter-spacing:1px}
.fake-details{display:flex;flex-direction:column;gap:5px}
.fake-detail-row{display:flex;justify-content:space-between;padding:6px 10px;background:rgba(31,31,35,0.5);border-radius:8px;font-size:0.7rem}
.fake-detail-label{color:#6b7280}
.fake-detail-value{color:#f87171;font-weight:600}
.fake-reason{background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.1);border-radius:8px;padding:8px;font-size:0.7rem;color:#fca5a5;line-height:1.4}
.fake-actions{display:flex;gap:6px;margin-top:10px;position:relative;z-index:1}
.btn-report{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:8px 14px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:18px;text-decoration:none;font-weight:700;font-size:0.7rem;color:#fff;transition:0.2s}
.btn-report:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(239,68,68,0.3)}
.btn-report img{width:14px;height:14px;object-fit:contain}
.btn-copy{flex:1;padding:8px 14px;background:rgba(31,31,35,0.5);border:1px solid rgba(239,68,68,0.2);border-radius:18px;font-weight:700;font-size:0.7rem;color:#f87171;cursor:pointer;transition:0.2s}
.btn-copy:hover{background:rgba(239,68,68,0.1)}
.btn-copy.done{background:rgba(34,197,94,0.2);color:#4ade80;border-color:rgba(34,197,94,0.4)}

.voice-verify{margin-top:10px;padding:10px;display:flex;align-items:center;gap:10px;cursor:pointer;border-radius:12px;transition:0.2s;border:1px solid rgba(147,51,234,0.15)}
.voice-verify:hover{border-color:rgba(147,51,234,0.4)}
.voice-icon{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#9333ea,#ec4899);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.voice-icon img{width:16px;height:16px;object-fit:contain}
.voice-text h5{font-size:0.75rem;font-weight:600}
.voice-text p{font-size:0.65rem;color:#9ca3af;margin:0}

.carousel-nav{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px}
.carousel-arrow{width:30px;height:30px;border-radius:50%;background:rgba(31,31,35,0.5);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9ca3af;transition:0.2s;font-size:0.8rem}
.carousel-arrow:hover{background:rgba(239,68,68,0.15);color:#f87171}
.carousel-dots{display:flex;gap:4px}
.carousel-dot{width:6px;height:6px;border-radius:50%;background:#27272b;border:none;cursor:pointer;transition:0.3s;padding:0}
.carousel-dot.on{background:#ef4444;width:18px;border-radius:4px}

.music-player{background:rgba(24,24,28,0.9);border-radius:16px;padding:20px;text-align:center;max-width:500px;margin:0 auto}
.music-cover{width:80px;height:80px;border-radius:12px;object-fit:cover;margin-bottom:10px}
.music-player h3{font-size:1rem;font-weight:700;color:#fff}
.music-artist{font-size:0.75rem;color:#9ca3af;margin:2px 0 12px}
.music-controls{display:flex;justify-content:center;gap:10px;margin-bottom:12px}
.music-btn{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.2rem;padding:5px;border-radius:50%;transition:0.2s}
.music-btn:hover{color:#fff}
.music-play{background:#fff;color:#09090b;width:44px;height:44px;border-radius:50%;font-size:1rem}
.music-play:hover{transform:scale(1.05);color:#09090b}
.music-progress{background:rgba(255,255,255,0.08);height:4px;border-radius:2px;cursor:pointer;margin-bottom:4px}
.music-progress div{background:linear-gradient(90deg,#1db954,#169c46);height:100%;border-radius:2px;width:0;transition:width 0.1s linear}
.music-time{font-size:0.65rem;color:#6b7280}
.music-list{max-width:500px;margin:8px auto 0;background:rgba(24,24,28,0.7);border-radius:12px;max-height:250px;overflow-y:auto}
.music-item{padding:10px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.8rem;transition:0.2s;display:flex;gap:8px}
.music-item:hover{background:rgba(255,255,255,0.04)}
.music-item.active{background:rgba(29,185,84,0.08);border-left:2px solid #1db954}
.music-num{color:#6b7280;font-weight:600}

.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
@media(max-width:500px){.gallery-grid{grid-template-columns:repeat(2,1fr)}}
.gallery-item{border-radius:10px;overflow:hidden;cursor:pointer;transition:0.3s}
.gallery-item:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3)}
.gallery-item img{width:100%;height:120px;object-fit:cover;display:block}

.chat-widget-btn{position:fixed;bottom:16px;right:16px;width:55px;height:55px;border-radius:50%;cursor:pointer;z-index:100;border:none;padding:0;overflow:hidden;box-shadow:0 4px 20px rgba(147,51,234,0.4);transition:0.3s}
.chat-widget-btn:hover{transform:scale(1.08)}
.chat-widget-btn img{width:100%;height:100%;object-fit:cover}
.chat-widget{position:fixed;bottom:80px;right:16px;width:340px;height:480px;border-radius:16px;display:none;flex-direction:column;overflow:hidden;z-index:100;box-shadow:0 10px 40px rgba(0,0,0,0.4)}
@media(max-width:400px){.chat-widget{width:calc(100vw - 32px);height:70vh;bottom:80px}}
.chat-widget.open{display:flex}
.chat-widget-head{background:linear-gradient(135deg,#9333ea,#ec4899);padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.chat-widget-head span{font-weight:700;font-size:0.85rem;color:#fff}
.chat-widget-head button{background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer;padding:2px}
.chat-widget-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;background:#f5f5f5}
.chat-widget-login{text-align:center;padding:20px}
.chat-widget-login h4{font-size:0.9rem;margin-bottom:12px;color:#333}
.chat-widget-login input{width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:8px;margin-bottom:8px;font-size:0.8rem;outline:none}
.chat-widget-login button{width:100%;padding:9px;background:linear-gradient(135deg,#9333ea,#ec4899);color:#fff;border:none;border-radius:8px;font-weight:600;font-size:0.8rem;cursor:pointer}
.chat-widget-input-area{display:none;padding:8px 12px;background:#fff;border-top:1px solid #eee;gap:6px}
.chat-widget-input-area input{flex:1;padding:8px 14px;border:1px solid #ddd;border-radius:20px;font-size:0.8rem;outline:none}
.chat-widget-input-area button{background:linear-gradient(135deg,#9333ea,#ec4899);color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0}
.chat-msg{max-width:80%;padding:8px 12px;border-radius:14px;font-size:0.78rem;word-wrap:break-word;position:relative}
.chat-msg.user{background:#9333ea;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.chat-msg.admin{background:#fff;color:#333;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
.chat-msg .chat-time{font-size:0.6rem;opacity:0.7;margin-top:3px;text-align:right}

.footer{text-align:center;padding:20px;font-size:0.7rem;color:#6b7280;border-top:1px solid rgba(255,255,255,0.05)}
</style>
</head>
<body>

<div class="header glass header-show" id="mainHeader">
  <div class="header-inner">
    <div class="header-left">
      <img src="${ASSETS.logoTikTok}" alt="" onerror="this.style.display='none'">
      <span class="gradient-text">Verification Hub</span>
    </div>
    <nav class="header-nav">
      <a href="#official">Official</a>
      <a href="#fake">Fakes</a>
      <a href="#music">Music</a>
      <a href="#gallery">Gallery</a>
    </nav>
  </div>
</div>

<main>
  <section class="hero">
    <div class="hero-avatar-wrap">
      <img src="${ASSETS.profile}" class="hero-avatar" alt="" onerror="this.style.display='none'">
      <img src="${ASSETS.blueTikTok}" class="hero-tick" alt="" onerror="this.style.display='none'">
    </div>
    <h1 class="hero-name gradient-text">Baiilla Maach Official</h1>
    <p class="hero-bio">@baiillamaach_official | Official Entertainment Profile</p>
    <div class="hero-stats">
      <div class="hero-stat"><div class="hero-stat-num">7K</div><div class="hero-stat-label">Followers</div></div>
      <div class="hero-stat"><div class="hero-stat-num">0</div><div class="hero-stat-label">Following</div></div>
      <div class="hero-stat"><div class="hero-stat-num">190K</div><div class="hero-stat-label">Likes</div></div>
    </div>
    <div class="hero-badges">
      <span class="hero-badge badge-green verified-glow"><img src="${ASSETS.blueTikTok}" alt="" onerror="this.style.display='none'">Verified Official</span>
      <span class="hero-badge badge-purple"><img src="${ASSETS.cpl}" alt="" onerror="this.style.display='none'">Creator</span>
      <span class="hero-badge badge-gray"><img src="${ASSETS.hlo}" alt="" onerror="this.style.display='none'">Bangladesh</span>
    </div>
    <div class="hero-links">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-tiktok"><img src="${ASSETS.logoTikTok}" alt="" onerror="this.style.display='none'">TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="btn-facebook"><img src="${ASSETS.logoFB}" alt="" onerror="this.style.display='none'">Facebook</a>
    </div>
  </section>

  <section class="section" id="official">
    <h2><img src="${ASSETS.blueTikTok}" alt="" style="width:24px;height:24px" onerror="this.style.display='none'"> Official Verified Account</h2>
    <p>The ONLY authentic Baiilla Maach account with blue tick verification</p>
    <div class="glass-card official-card hover-lift">
      <img src="${ASSETS.blueTikTok}" class="official-verify verified-glow" alt="" onerror="this.style.display='none'">
      <div class="official-header">
        <div class="official-verify-icon verified-glow"><img src="${ASSETS.blueTikTok}" alt="" onerror="this.style.display='none'"></div>
        <div><h3>The Only Authentic Account</h3><p>This account has been verified as the one and only official profile</p></div>
      </div>
      <div class="official-body">
        <div class="official-accounts">
          <div class="official-account">
            <div class="account-header"><span class="account-platform">TikTok</span><img src="${ASSETS.blueTikTok}" class="account-tick" alt="" onerror="this.style.display='none'"></div>
            <div class="account-info"><img src="${ASSETS.profile}" class="account-avatar" alt="" onerror="this.style.display='none'"><div><div class="account-name">@baiillamaach_official</div><div class="account-detail">TikTok • 7K followers</div></div></div>
            <div class="account-stats"><div class="account-stat"><div class="account-stat-num">7K</div><div class="account-stat-label">Followers</div></div><div class="account-stat"><div class="account-stat-num">0</div><div class="account-stat-label">Following</div></div><div class="account-stat"><div class="account-stat-num">190K</div><div class="account-stat-label">Likes</div></div></div>
          </div>
          <div class="official-account">
            <div class="account-header"><span class="account-platform">Facebook</span><img src="${ASSETS.blueFB}" class="account-tick" alt="" onerror="this.style.display='none'"></div>
            <div class="account-info"><img src="${ASSETS.fbProfile}" class="account-avatar" alt="" onerror="this.style.display='none'"><div><div class="account-name">Baiilla Maach Official</div><div class="account-detail">Facebook Page</div></div></div>
          </div>
        </div>
        <div class="official-preview">
          <img src="${ASSETS.profile}" alt="" onerror="this.style.display='none'">
          <div class="official-preview-name">@baiillamaach_official</div>
          <div class="official-preview-platform">TikTok • Facebook</div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="official-follow"><img src="${ASSETS.followGif}" alt="" onerror="this.style.display='none'">Follow Official Account</a>
          <p class="official-note">This is the only authentic account. All others are fake.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="fake">
    <h2><img src="${ASSETS.fakeDetect}" alt="" style="width:24px;height:24px" onerror="this.style.display='none'"> Fake Accounts Detected</h2>
    <p>2 impersonator accounts found - Report them immediately</p>
    <div class="fake-alert-box">
      <div class="fake-alert-icon danger-glow"><img src="${ASSETS.xIcon}" alt="" onerror="this.style.display='none'"></div>
      <div class="fake-alert-text"><h4>Warning: 2 Fake Accounts Found</h4><p>Not affiliated with Baiilla Maach. Report immediately.</p></div>
    </div>
    <div class="fake-carousel" id="fakeCarousel">
      <div class="fake-track" id="fakeTrack">
        <div class="fake-slide"><div class="glass-card fake-card"><div class="watermark-fake">FAKE</div><div class="fake-card-top"><div class="fake-card-title"><span>!</span>Fake Account #1</div><span class="fake-card-badge">Critical</span></div><div class="fake-card-body"><div class="fake-screenshot"><img src="${ASSETS.baillamachFake}" alt="" loading="lazy" onerror="this.style.display='none'"><div class="fake-watermark"><span>FAKE ACCOUNT</span><span>DO NOT TRUST</span></div></div><div class="fake-details"><div class="fake-detail-row"><span class="fake-detail-label">Platform</span><span class="fake-detail-value">TikTok</span></div><div class="fake-detail-row"><span class="fake-detail-label">Username</span><span class="fake-detail-value">@baiilla_mach</span></div><div class="fake-detail-row"><span class="fake-detail-label">Status</span><span class="fake-detail-value">Active Threat</span></div><div class="fake-detail-row"><span class="fake-detail-label">Reports</span><span class="fake-detail-value">156+</span></div><div class="fake-reason">Copies official content and logo to deceive followers. Requests money from fans.</div></div></div><div class="fake-actions"><a href="https://tiktok.com/@baiilla_mach" target="_blank" rel="noopener" class="btn-report"><img src="${ASSETS.reportBtn}" alt="" onerror="this.style.display='none'">Report</a><button class="btn-copy" data-username="@baiilla_mach">Copy Username</button></div><div class="voice-verify" onclick="toggleFakeVoice()"><div class="voice-icon"><img src="${ASSETS.microphone}" alt="" onerror="this.style.display='none'"></div><div class="voice-text"><h5>Verify Voice Alert</h5><p>Click to hear warning</p></div></div></div></div>
        <div class="fake-slide"><div class="glass-card fake-card"><div class="watermark-fake">FAKE</div><div class="fake-card-top"><div class="fake-card-title"><span>!</span>Fake Account #2</div><span class="fake-card-badge">High</span></div><div class="fake-card-body"><div class="fake-screenshot"><img src="${ASSETS.hammadFake}" alt="" loading="lazy" onerror="this.style.display='none'"><div class="fake-watermark"><span>FAKE ACCOUNT</span><span>DO NOT TRUST</span></div></div><div class="fake-details"><div class="fake-detail-row"><span class="fake-detail-label">Platform</span><span class="fake-detail-value">TikTok</span></div><div class="fake-detail-row"><span class="fake-detail-label">Username</span><span class="fake-detail-value">@hammad_fams0</span></div><div class="fake-detail-row"><span class="fake-detail-label">Status</span><span class="fake-detail-value">Active Threat</span></div><div class="fake-detail-row"><span class="fake-detail-label">Reports</span><span class="fake-detail-value">89+</span></div><div class="fake-reason">Uses official name and photo to mislead followers. Posts fake giveaways.</div></div></div><div class="fake-actions"><a href="https://tiktok.com/@hammad_fams0" target="_blank" rel="noopener" class="btn-report"><img src="${ASSETS.reportBtn}" alt="" onerror="this.style.display='none'">Report</a><button class="btn-copy" data-username="@hammad_fams0">Copy Username</button></div><div class="voice-verify" onclick="toggleFakeVoice()"><div class="voice-icon"><img src="${ASSETS.microphone}" alt="" onerror="this.style.display='none'"></div><div class="voice-text"><h5>Verify Voice Alert</h5><p>Click to hear warning</p></div></div></div></div>
      </div>
    </div>
    <div class="carousel-nav">
      <button class="carousel-arrow" onclick="moveCarousel(-1)">◀</button>
      <div class="carousel-dots" id="carouselDots"><button class="carousel-dot on" onclick="goSlide(0)"></button><button class="carousel-dot" onclick="goSlide(1)"></button></div>
      <button class="carousel-arrow" onclick="moveCarousel(1)">▶</button>
    </div>
    ${MANUAL_VOICE?`<audio id="fakeVoicePlayer" src="/assets/manualvoice_alert.mp3" preload="none"></audio>`:''}
  </section>

  ${musicSection}

  ${gallerySection}

  <div class="footer">
    <p>© ${new Date().getFullYear()} Baiilla Maach Official. All Rights Reserved.</p>
    <p style="margin-top:4px">This is the only official verification hub</p>
    <p style="margin-top:4px"><a href="/admin" style="color:#6b7280">Admin Login</a></p>
  </div>
</main>

<button class="chat-widget-btn" onclick="toggleChatWidget()"><img src="${ASSETS.messageBubble}" alt="Chat"></button>
<div class="chat-widget" id="chatWidget">
  <div class="chat-widget-head"><span>Chat with Baiilla Maach</span><button onclick="toggleChatWidget()">✕</button></div>
  <div class="chat-widget-body" id="chatWidgetBody">
    <div class="chat-widget-login" id="chatWidgetLogin">
      <h4>Start Chat</h4>
      <input type="text" id="chatUserName" placeholder="Your Name">
      <input type="text" id="chatUserEmail" placeholder="Email or Phone">
      <button onclick="startUserChat()">Start Chatting</button>
    </div>
  </div>
  <div class="chat-widget-input-area" id="chatWidgetInput">
    <input type="text" id="chatUserMessage" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendUserMessage()">
    <button onclick="sendUserMessage()">➤</button>
  </div>
</div>

${WELCOME_VOICE?`<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="none"></audio>`:''}

<script src="/socket.io/socket.io.js"></script>
<script>
window.addEventListener('load',()=>{const a=document.getElementById('welcomeAudio');if(a&&!sessionStorage.getItem('wvPlayed')){setTimeout(()=>{a.play().catch(()=>{});sessionStorage.setItem('wvPlayed','1')},1500)}});

let ls=0,header=document.getElementById('mainHeader');
window.addEventListener('scroll',()=>{const s=window.scrollY;if(s>ls&&s>50){header.classList.add('header-hide');header.classList.remove('header-show')}else if(s<ls){header.classList.remove('header-hide');header.classList.add('header-show')}ls=s});

function toggleFakeVoice(){const a=document.getElementById('fakeVoicePlayer');if(a){if(a.paused){a.play().catch(()=>{})}else{a.pause();a.currentTime=0}}}

let cs=0,tsl=2,track=document.getElementById('fakeTrack'),dots=document.querySelectorAll('#carouselDots .carousel-dot'),auto;
function updateCarousel(){track.style.transform='translateX(-'+(cs*100)+'%)';dots.forEach((d,i)=>d.classList.toggle('on',i===cs))}
function moveCarousel(d){cs=(cs+d+tsl)%tsl;updateCarousel();clearInterval(auto);auto=setInterval(()=>moveCarousel(1),6000)}
function goSlide(i){cs=i;updateCarousel();clearInterval(auto);auto=setInterval(()=>moveCarousel(1),6000)}
auto=setInterval(()=>moveCarousel(1),6000);
let tx=0;track.parentElement.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX});
track.parentElement.addEventListener('touchend',e=>{const d=tx-e.changedTouches[0].screenX;if(Math.abs(d)>40)moveCarousel(d>0?1:-1)});

document.querySelectorAll('.btn-copy').forEach(b=>b.addEventListener('click',function(){navigator.clipboard.writeText(this.dataset.username).then(()=>{const o=this.textContent;this.textContent='Copied!';this.classList.add('done');setTimeout(()=>{this.textContent=o;this.classList.remove('done')},2000)})}));

const tracks=${JSON.stringify(songs)};
let currentTrack=0,playing=false;
const audio=new Audio();
if(tracks.length>0){audio.src=tracks[0].url;audio.load()}
function playTrack(i){currentTrack=i;audio.src=tracks[i].url;audio.load();audio.play().then(()=>{playing=true;document.getElementById('playBtn').textContent='⏸️'}).catch(()=>{});document.getElementById('trackTitle').textContent=tracks[i].title;document.querySelectorAll('.music-item').forEach((el,j)=>el.classList.toggle('active',j===i))}
function togglePlay(){if(audio.paused){audio.play().then(()=>{playing=true;document.getElementById('playBtn').textContent='⏸️'}).catch(()=>{})}else{audio.pause();playing=false;document.getElementById('playBtn').textContent='▶️'}}
function prevTrack(){if(tracks.length)playTrack((currentTrack-1+tracks.length)%tracks.length)}
function nextTrack(){if(tracks.length)playTrack((currentTrack+1)%tracks.length)}
audio.addEventListener('timeupdate',()=>{if(audio.duration){const p=(audio.currentTime/audio.duration)*100;document.getElementById('progressBar').style.width=p+'%';document.getElementById('currentTime').textContent=formatTime(audio.currentTime);document.getElementById('duration').textContent=formatTime(audio.duration)}});
audio.addEventListener('ended',nextTrack);
function seekTrack(e){const r=e.currentTarget.getBoundingClientRect();if(audio.duration)audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration}
function formatTime(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}

const socket=io();
let chatUser=null;
function toggleChatWidget(){document.getElementById('chatWidget').classList.toggle('open')}
function startUserChat(){
  const name=document.getElementById('chatUserName').value.trim();
  const email=document.getElementById('chatUserEmail').value.trim();
  if(!name||!email)return alert('Fill all fields');
  chatUser={name,email};
  socket.emit('register',{name,email});
  document.getElementById('chatWidgetLogin').style.display='none';
  document.getElementById('chatWidgetInput').style.display='flex';
  loadUserMessages();
}
async function loadUserMessages(){
  if(!chatUser)return;
  const res=await fetch('/api/msgs/'+chatUser.email);
  const msgs=await res.json();
  const body=document.getElementById('chatWidgetBody');
  body.innerHTML=msgs.map(m=>'<div class="chat-msg '+(m.sender===chatUser.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'<div class="chat-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
  body.scrollTop=body.scrollHeight;
}
function sendUserMessage(){
  const input=document.getElementById('chatUserMessage');
  const msg=input.value.trim();
  if(!msg||!chatUser)return;
  socket.emit('sendMsg',{sender:chatUser.email,receiver:'admin',message:msg,type:'text',senderName:chatUser.name});
  input.value='';
}
socket.on('newMsg',(msg)=>{if(chatUser&&(msg.sender===chatUser.email||msg.receiver===chatUser.email)){const body=document.getElementById('chatWidgetBody');body.insertAdjacentHTML('beforeend','<div class="chat-msg '+(msg.sender===chatUser.email?'user':'admin')+'">'+(msg.type==='image'?'<img src="'+msg.fileUrl+'" style="max-width:120px;border-radius:8px">':msg.message)+'<div class="chat-time">'+new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');body.scrollTop=body.scrollHeight}});
</script>
</body>
</html>`);
});

app.get('/api/msgs/:email',async(req,res)=>{
  const msgs=await Message.find({$or:[{sender:req.params.email},{receiver:req.params.email}]}).sort({timestamp:1});
  res.json(msgs);
});

app.post('/api/admin/login',async(req,res)=>{
  const user=await User.findOne({email:req.body.email,isAdmin:true});
  if(!user)return res.status(400).json({error:'Not found'});
  const valid=await bcrypt.compare(req.body.password,user.password);
  if(!valid)return res.status(400).json({error:'Wrong password'});
  res.json({success:true});
});

app.get('/api/admin/users',async(req,res)=>{
  const users=await User.find({isAdmin:false}).sort({lastSeen:-1}).lean();
  for(let u of users){
    u.unreadCount=await Message.countDocuments({sender:u.email,receiver:'admin',seen:false});
  }
  res.json(users);
});

app.post('/api/upload',multer({dest:'uploads/'}).single('image'),async(req,res)=>{
  const fileUrl='/uploads/'+req.file.filename;
  const msg=await Message.create({sender:req.body.sender,receiver:req.body.receiver,type:'image',fileUrl});
  io.emit('newMsg',msg);
  res.json(msg);
});

app.delete('/api/delete-msgs/:email',async(req,res)=>{
  await Message.deleteMany({$or:[{sender:req.params.email},{receiver:req.params.email}]});
  res.json({success:true});
});

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
    const msg=await Message.create({sender:data.sender,receiver:data.receiver,message:data.message,type:data.type||'text'});
    io.emit('newMsg',msg);
  });
  socket.on('markRead',async(data)=>{
    await Message.updateMany({sender:data.user,receiver:'admin',seen:false},{$set:{seen:true}});
  });
  socket.on('typing',(data)=>{socket.broadcast.emit('typing',data)});
  socket.on('disconnect',async()=>{
    if(socket.userData){
      await User.updateOne({email:socket.userData.email},{$set:{isOnline:false,lastSeen:new Date()}});
      io.emit('userStatus',{email:socket.userData.email,online:false});
    }
  });
});

app.get('/admin',(req,res)=>{
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Baiilla Maach</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#09090b,#101014,#141418);color:#e5e5e5;height:100vh;overflow:hidden}
.login-screen{position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-box{background:rgba(24,24,28,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
.login-box h2{text-align:center;margin-bottom:25px;font-size:1.4em;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
.login-box input{width:100%;padding:13px 16px;margin-bottom:12px;background:rgba(31,31,35,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:0.9em;outline:none;transition:0.3s}
.login-box input:focus{border-color:#9333ea}
.login-box button{width:100%;padding:13px;background:linear-gradient(135deg,#9333ea,#ec4899);color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;transition:0.3s}
.login-box button:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(147,51,234,0.4)}
.admin-app{display:none;height:100vh;max-width:1200px;margin:0 auto;padding:16px}
.admin-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(24,24,28,0.7);border:1px solid rgba(255,255,255,0.05);border-radius:16px;margin-bottom:16px;backdrop-filter:blur(16px)}
.admin-header h2{font-size:1.2em;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
.admin-header button{background:#dc2626;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:600;font-size:0.85em;cursor:pointer;transition:0.2s}
.admin-header button:hover{background:#b91c1c}
.admin-content{display:flex;gap:16px;height:calc(100vh - 100px)}
.user-sidebar{width:320px;flex-shrink:0;background:rgba(24,24,28,0.7);border:1px solid rgba(255,255,255,0.05);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(16px)}
.search-bar{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05)}
.search-bar input{width:100%;padding:9px 14px;background:rgba(31,31,35,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:20px;color:#fff;font-size:0.85em;outline:none;transition:0.3s}
.search-bar input:focus{border-color:#9333ea}
.user-list{flex:1;overflow-y:auto}
.user-item{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);transition:0.2s}
.user-item:hover{background:rgba(255,255,255,0.04)}
.user-item.active{background:rgba(147,51,234,0.08);border-left:3px solid #9333ea}
.user-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#9333ea,#ec4899);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1em;flex-shrink:0}
.user-name{font-weight:600;font-size:0.85em;color:#fff}
.user-email{font-size:0.75em;color:#9ca3af}
.unread-badge{margin-left:auto;background:#dc2626;color:#fff;padding:2px 8px;border-radius:10px;font-size:0.7em;font-weight:700}
.chat-area{flex:1;background:rgba(24,24,28,0.7);border:1px solid rgba(255,255,255,0.05);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(16px)}
.chat-header{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:10px}
.chat-header-name{font-weight:700;font-size:1em;color:#fff}
.chat-header-status{font-size:0.8em;color:#22c55e}
.messages-container{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:5px}
.empty-chat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#6b7280;text-align:center}
.empty-chat span{font-size:3em;margin-bottom:10px}
.msg-bubble{max-width:70%;padding:10px 14px;border-radius:16px;font-size:0.85em;word-wrap:break-word;position:relative}
.msg-bubble.user{background:rgba(147,51,234,0.15);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.msg-bubble.admin{background:rgba(255,255,255,0.06);color:#e5e5e5;align-self:flex-start;border-bottom-left-radius:4px}
.msg-bubble .msg-time{font-size:0.7em;color:#6b7280;margin-top:4px;text-align:right}
.chat-input-area{padding:12px 16px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:8px;align-items:center}
.chat-input-area input{flex:1;padding:10px 16px;background:rgba(31,31,35,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:20px;color:#fff;font-size:0.85em;outline:none;transition:0.3s}
.chat-input-area input:focus{border-color:#9333ea}
.send-btn{background:linear-gradient(135deg,#9333ea,#ec4899);color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em;flex-shrink:0;transition:0.2s}
.send-btn:hover{transform:scale(1.05);box-shadow:0 4px 16px rgba(147,51,234,0.4)}
</style>
</head>
<body>

<div class="login-screen" id="loginScreen">
  <div class="login-box">
    <h2>Admin Login</h2>
    <input type="text" id="adminEmail" placeholder="Email" value="admin">
    <input type="password" id="adminPassword" placeholder="Password" value="admin123">
    <button onclick="adminLogin()">Login to Admin Panel</button>
  </div>
</div>

<div class="admin-app" id="adminApp">
  <div class="admin-header">
    <h2>Chat Admin Panel</h2>
    <button onclick="logout()">Logout</button>
  </div>
  <div class="admin-content">
    <div class="user-sidebar">
      <div class="search-bar"><input type="text" id="searchInput" placeholder="Search users..." oninput="filterUsers()"></div>
      <div class="user-list" id="userList"></div>
    </div>
    <div class="chat-area">
      <div class="chat-header"><div class="chat-header-name" id="chatHeaderName">Select a user</div><div class="chat-header-status" id="chatHeaderStatus"></div></div>
      <div class="messages-container" id="messagesContainer"><div class="empty-chat"><span>💬</span><p>Select a conversation to view messages</p></div></div>
      <div class="chat-input-area" id="chatInputArea" style="display:none">
        <input type="text" id="adminMessageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendAdminMessage()">
        <button class="send-btn" onclick="sendAdminMessage()">➤</button>
      </div>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let currentUser=null,socket=null,allUsers=[];
async function adminLogin(){
  const email=document.getElementById('adminEmail').value;
  const password=document.getElementById('adminPassword').value;
  try{
    const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(res.ok){
      document.getElementById('loginScreen').style.display='none';
      document.getElementById('adminApp').style.display='block';
      initSocket();
      loadUsers();
    }else{alert('Invalid credentials')}
  }catch(e){alert('Login failed')}
}
function logout(){if(socket)socket.disconnect();document.getElementById('loginScreen').style.display='flex';document.getElementById('adminApp').style.display='none';currentUser=null}
function initSocket(){
  socket=io();
  socket.emit('register',{name:'Admin',email:'admin'});
  socket.on('newMsg',(msg)=>{if(currentUser&&(msg.sender===currentUser||msg.receiver===currentUser)){appendMessage(msg)}loadUsers()});
  socket.on('userStatus',(data)=>{allUsers=allUsers.map(u=>({...u,isOnline:u.email===data.email?data.online:u.isOnline}));renderUsers();if(currentUser===data.email){document.getElementById('chatHeaderStatus').textContent=data.online?'● Online':'○ Offline'}});
}
async function loadUsers(){
  try{const res=await fetch('/api/admin/users');allUsers=await res.json();renderUsers()}catch(e){console.error(e)}
}
function renderUsers(filter=''){
  const list=document.getElementById('userList');
  const filtered=filter?allUsers.filter(u=>u.name.toLowerCase().includes(filter)||u.email.toLowerCase().includes(filter)):allUsers;
  list.innerHTML=filtered.map(u=>`
    <div class="user-item${currentUser===u.email?' active':''}" onclick="selectUser('${u.email}')">
      <div class="user-avatar">${u.name[0].toUpperCase()}</div>
      <div><div class="user-name">${u.name}</div><div class="user-email">${u.email}</div></div>
      ${u.unreadCount>0?'<div class="unread-badge">'+u.unreadCount+'</div>':''}
    </div>`).join('');
}
function filterUsers(){renderUsers(document.getElementById('searchInput').value.toLowerCase())}
async function selectUser(email){
  currentUser=email;
  document.getElementById('chatInputArea').style.display='flex';
  document.getElementById('chatHeaderName').textContent=allUsers.find(u=>u.email===email)?.name||email;
  document.getElementById('chatHeaderStatus').textContent=allUsers.find(u=>u.email===email)?.isOnline?'● Online':'○ Offline';
  const res=await fetch('/api/msgs/'+email);
  const msgs=await res.json();
  const container=document.getElementById('messagesContainer');
  if(msgs.length===0){container.innerHTML='<div class="empty-chat"><span>💬</span><p>No messages yet</p></div>';return}
  container.innerHTML=msgs.map(m=>'<div class="msg-bubble '+(m.sender===email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
  container.scrollTop=container.scrollHeight;
  socket.emit('markRead',{user:email});
  renderUsers();
}
function appendMessage(m){
  const container=document.getElementById('messagesContainer');
  const empty=container.querySelector('.empty-chat');
  if(empty)container.innerHTML='';
  container.insertAdjacentHTML('beforeend','<div class="msg-bubble '+(m.sender===currentUser?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:150px;border-radius:8px">':m.message)+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');
  container.scrollTop=container.scrollHeight;
}
function sendAdminMessage(){
  if(!currentUser)return;
  const input=document.getElementById('adminMessageInput');
  const msg=input.value.trim();
  if(!msg)return;
  socket.emit('sendMsg',{sender:'admin',receiver:currentUser,message:msg,type:'text'});
  input.value='';
}
</script>
</body>
</html>`);
});

server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));

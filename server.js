require('dotenv').config();
process.on('uncaughtException',(e)=>{console.error('Uncaught Exception:',e.message)});
process.on('unhandledRejection',(e)=>{console.error('Unhandled Rejection:',e.message)});

const express=require('express');
const http=require('http');
const socketIO=require('socket.io');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const path=require('path');
const fs=require('fs');
const multer=require('multer');
const crypto=require('crypto');

const app=express();
const server=http.createServer(app);
const io=socketIO(server,{
  maxHttpBufferSize:1e7,
  pingTimeout:60000,
  pingInterval:25000,
  upgradeTimeout:30000,
  allowUpgrades:true,
  transports:['websocket','polling'],
  cookie:false
});

const PORT=process.env.PORT||3000;
const MONGO_URI=process.env.MONGO_URI||'mongodb://localhost:27017/verification_hub';
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'admin';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'admin123';
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');

app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true,limit:'1mb'}));
app.use('/assets',express.static('assets'));
app.use('/uploads',express.static('uploads'));
app.use('/assets/covermusic',express.static('assets/covermusic'));
app.use('/assets/gallery',express.static('assets/gallery'));

// Security headers
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-XSS-Protection','1; mode=block');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  next();
});

// Rate limiting
const rateLimit=new Map();
function rateLimiter(limit=100,windowMs=60000){
  return (req,res,next)=>{
    const key=req.ip;
    const now=Date.now();
    if(!rateLimit.has(key))rateLimit.set(key,[]);
    const timestamps=rateLimit.get(key).filter(t=>now-t<windowMs);
    if(timestamps.length>=limit)return res.status(429).json({error:'Too many requests'});
    timestamps.push(now);
    rateLimit.set(key,timestamps);
    next();
  };
}

['uploads','assets/covermusic','assets/gallery'].forEach(d=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true})});

// MongoDB Schemas
const UserSchema=new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:50},
  email:{type:String,required:true,unique:true,trim:true,lowercase:true},
  password:{type:String,required:true},
  avatar:{type:String,default:''},
  isAdmin:{type:Boolean,default:false},
  isOnline:{type:Boolean,default:false},
  lastSeen:{type:Date,default:Date.now},
  lastActive:{type:Date,default:Date.now},
  socketIds:{type:[String],default:[]},
  unreadCount:{type:Number,default:0},
  createdAt:{type:Date,default:Date.now},
  updatedAt:{type:Date,default:Date.now}
});

const ConversationSchema=new mongoose.Schema({
  participants:{type:[String],required:true,index:true},
  lastMessage:{type:mongoose.Schema.Types.ObjectId,ref:'Message',default:null},
  lastMessageAt:{type:Date,default:Date.now},
  unreadCounts:{type:Map,of:Number,default:{}},
  createdAt:{type:Date,default:Date.now},
  updatedAt:{type:Date,default:Date.now}
});
ConversationSchema.index({participants:1,updatedAt:-1});
ConversationSchema.index({lastMessageAt:-1});

const MessageSchema=new mongoose.Schema({
  messageId:{type:String,unique:true,required:true},
  conversationId:{type:String,required:true,index:true},
  sender:{type:String,required:true,index:true},
  receiver:{type:String,required:true,index:true},
  message:{type:String,default:''},
  type:{type:String,default:'text',enum:['text','image','file','system']},
  fileUrl:{type:String,default:''},
  fileName:{type:String,default:''},
  fileSize:{type:Number,default:0},
  mimeType:{type:String,default:''},
  replyTo:{type:mongoose.Schema.Types.ObjectId,ref:'Message',default:null},
  reactions:{type:Map,of:String,default:{}},
  deliveredAt:{type:Date,default:null},
  seenAt:{type:Date,default:null},
  deletedAt:{type:Date,default:null},
  createdAt:{type:Date,default:Date.now}
});
MessageSchema.index({conversationId:1,createdAt:-1});
MessageSchema.index({sender:1,receiver:1,createdAt:-1});
MessageSchema.index({messageId:1});

const User=mongoose.model('User',UserSchema);
const Conversation=mongoose.model('Conversation',ConversationSchema);
const Message=mongoose.model('Message',MessageSchema);

// Connect to MongoDB with retry
async function connectDB(){
  try{
    await mongoose.connect(MONGO_URI,{useNewUrlParser:true,useUnifiedTopology:true});
    console.log('MongoDB connected');
    
    // Create admin if not exists
    const admin=await User.findOne({email:ADMIN_EMAIL});
    if(!admin){
      await User.create({
        name:'Baiilla Maach',
        email:ADMIN_EMAIL,
        password:await bcrypt.hash(ADMIN_PASSWORD,12),
        isAdmin:true,
        avatar:'/assets/celebrity_pfp.jpeg'
      });
      console.log('Admin created');
    }
    
    // Create indexes
    await User.createIndexes();
    await Conversation.createIndexes();
    await Message.createIndexes();
    
  }catch(e){
    console.error('MongoDB connection error:',e.message);
    setTimeout(connectDB,5000);
  }
}
connectDB();

// File upload configuration
const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,'uploads/'),
  filename:(req,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase();
    const name=crypto.randomBytes(16).toString('hex')+ext;
    cb(null,name);
  }
});

const fileFilter=(req,file,cb)=>{
  const allowedTypes=['image/jpeg','image/jpg','image/png','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(allowedTypes.includes(file.mimetype))cb(null,true);
  else cb(new Error('Invalid file type'),false);
};

const upload=multer({
  storage,
  fileFilter,
  limits:{fileSize:10*1024*1024}
});

// Authentication middleware
async function authenticateUser(req,res,next){
  const email=req.headers['x-user-email'];
  if(!email)return res.status(401).json({error:'Authentication required'});
  
  const user=await User.findOne({email});
  if(!user)return res.status(401).json({error:'User not found'});
  
  req.user=user;
  next();
}

async function authenticateAdmin(req,res,next){
  const email=req.headers['x-admin-email'];
  if(!email)return res.status(401).json({error:'Admin authentication required'});
  
  const user=await User.findOne({email,isAdmin:true});
  if(!user)return res.status(401).json({error:'Admin not found'});
  
  req.user=user;
  next();
}

// Helper functions
function getConversationId(user1,user2){
  return [user1,user2].sort().join('_');
}

async function getOrCreateConversation(user1,user2){
  const convId=getConversationId(user1,user2);
  let conv=await Conversation.findOne({participants:convId});
  
  if(!conv){
    conv=await Conversation.create({
      participants:convId,
      unreadCounts:{[user1]:0,[user2]:0}
    });
  }
  
  return conv;
}

// API Routes
app.get('/',(req,res)=>{
  // Serve existing verification hub with enhanced chat
  const songs=getSongs();
  const gallery=getGallery();
  
  let musicSection='';
  if(songs.length>0){
    musicSection=`
    <section class="section" id="music">
      <h2>🎵 Cover Music</h2>
      <p>Official covers by Baiilla Maach</p>
      <div class="music-player">
        <img src="/assets/celebrity_pfp.jpeg" class="music-cover">
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
      <h2>📸 Gallery</h2>
      <p>Official photos and moments</p>
      <div class="gallery-grid">
        ${gallery.map(g=>`<div class="gallery-item"><img src="${g.url}" alt="${g.name}" loading="lazy"></div>`).join('')}
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
body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#09090b 0%,#101014 50%,#141418 100%);color:#e5e5e5;min-height:100vh;overflow-x:hidden;line-height:1.6}
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

.header{position:fixed;top:0;left:0;right:0;z-index:50;padding:0 16px;height:60px;display:flex;align-items:center;justify-content:space-between;transition:transform 0.3s ease}
.header-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;width:100%}
.header-left{display:flex;align-items:center;gap:8px}
.header-left img{width:28px;height:28px;object-fit:contain}
.header-left span{font-size:0.9rem;font-weight:700}
.header-nav{display:flex;gap:4px}
.header-nav a{color:#9ca3af;text-decoration:none;font-size:0.75rem;padding:4px 10px;border-radius:6px;transition:0.2s}
.header-nav a:hover{color:#fff;background:rgba(255,255,255,0.05)}

main{max-width:900px;margin:0 auto;padding:70px 12px 20px}

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
.hero-links{display:flex;justify-content:center;gap:8px}
.hero-links a{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:22px;text-decoration:none;font-size:0.8rem;font-weight:600;color:#fff;transition:0.2s}
.btn-tiktok{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1)}
.btn-tiktok:hover{background:rgba(0,0,0,0.6)}
.btn-facebook{background:rgba(24,119,242,0.2);border:1px solid rgba(24,119,242,0.3)}
.btn-facebook:hover{background:rgba(24,119,242,0.3)}

.section{padding:25px 0}
.section h2{font-size:1.2rem;font-weight:700;margin-bottom:4px}
.section p{font-size:0.8rem;color:#9ca3af;margin-bottom:16px}

.official-card{padding:20px;position:relative;overflow:hidden}
.official-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.official-verify-icon{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center}
.official-body{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:600px){.official-body{grid-template-columns:1fr}}
.official-account{background:rgba(31,31,35,0.5);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.04)}
.account-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.account-platform{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600}
.account-info{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.account-avatar{width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.1)}
.account-name{font-size:0.9rem;font-weight:700}
.account-detail{font-size:0.75rem;color:#9ca3af}
.account-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}
.account-stat{background:rgba(39,39,43,0.4);border-radius:8px;padding:8px}
.account-stat-num{font-size:0.9rem;font-weight:700;color:#fff}
.account-stat-label{font-size:0.6rem;color:#6b7280}

.fake-alert-box{padding:12px;border-radius:12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);display:flex;align-items:center;gap:8px;margin-bottom:12px}
.fake-alert-icon{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fake-alert-text h4{font-size:0.8rem;font-weight:700;color:#f87171}
.fake-alert-text p{font-size:0.7rem;color:#9ca3af;margin:0}

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

.chat-widget-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;cursor:pointer;z-index:1000;border:none;padding:0;overflow:hidden;box-shadow:0 4px 20px rgba(147,51,234,0.4);transition:0.3s;background:linear-gradient(135deg,#9333ea,#ec4899)}
.chat-widget-btn:hover{transform:scale(1.1);box-shadow:0 8px 30px rgba(147,51,234,0.6)}
.chat-widget-btn img{width:100%;height:100%;object-fit:cover}
.chat-widget-btn .unread-count{position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;border-radius:50%;width:22px;height:22px;font-size:0.65rem;display:flex;align-items:center;justify-content:center;font-weight:700}

.chat-widget{position:fixed;bottom:85px;right:20px;width:380px;height:600px;max-height:calc(100vh - 100px);border-radius:20px;display:none;flex-direction:column;overflow:hidden;z-index:999;box-shadow:0 10px 40px rgba(0,0,0,0.5);background:rgba(24,24,28,0.95);backdrop-filter:blur(20px)}
@media(max-width:400px){.chat-widget{width:calc(100vw - 32px);height:75vh;bottom:85px;right:16px}}
.chat-widget.open{display:flex}

.footer{text-align:center;padding:20px;font-size:0.7rem;color:#6b7280;border-top:1px solid rgba(255,255,255,0.05)}
</style>
</head>
<body>

<div class="header glass" id="mainHeader">
  <div class="header-inner">
    <div class="header-left">
      <img src="/assets/logo_tiktok.png" alt="">
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
      <img src="/assets/celebrity_pfp.jpeg" class="hero-avatar" alt="">
      <img src="/assets/bluetick_tiktok.png" class="hero-tick" alt="">
    </div>
    <h1 class="hero-name gradient-text">Baiilla Maach Official</h1>
    <p class="hero-bio">@baiillamaach_official | Official Entertainment Profile</p>
    <div class="hero-stats">
      <div class="hero-stat"><div class="hero-stat-num">7K</div><div class="hero-stat-label">Followers</div></div>
      <div class="hero-stat"><div class="hero-stat-num">0</div><div class="hero-stat-label">Following</div></div>
      <div class="hero-stat"><div class="hero-stat-num">190K</div><div class="hero-stat-label">Likes</div></div>
    </div>
    <div class="hero-badges">
      <span class="hero-badge badge-green verified-glow">✓ Verified Official</span>
      <span class="hero-badge badge-purple">Creator</span>
      <span class="hero-badge badge-gray">Bangladesh</span>
    </div>
    <div class="hero-links">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-tiktok">TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="btn-facebook">Facebook</a>
    </div>
  </section>

  <section class="section" id="official">
    <h2>✓ Official Verified Account</h2>
    <p>The ONLY authentic Baiilla Maach account with blue tick verification</p>
    <div class="glass-card official-card hover-lift">
      <div class="official-header">
        <div class="official-verify-icon verified-glow">✓</div>
        <div><h3>The Only Authentic Account</h3><p>This account has been verified as the one and only official profile</p></div>
      </div>
      <div class="official-body">
        <div class="official-accounts">
          <div class="official-account">
            <div class="account-header"><span class="account-platform">TikTok</span>✓</div>
            <div class="account-info"><img src="/assets/celebrity_pfp.jpeg" class="account-avatar" alt=""><div><div class="account-name">@baiillamaach_official</div><div class="account-detail">TikTok • 7K followers</div></div></div>
            <div class="account-stats"><div class="account-stat"><div class="account-stat-num">7K</div><div class="account-stat-label">Followers</div></div><div class="account-stat"><div class="account-stat-num">0</div><div class="account-stat-label">Following</div></div><div class="account-stat"><div class="account-stat-num">190K</div><div class="account-stat-label">Likes</div></div></div>
          </div>
          <div class="official-account">
            <div class="account-header"><span class="account-platform">Facebook</span>✓</div>
            <div class="account-info"><img src="/assets/fb_profile.jpg" class="account-avatar" alt=""><div><div class="account-name">Baiilla Maach Official</div><div class="account-detail">Facebook Page</div></div></div>
          </div>
        </div>
        <div class="official-preview">
          <img src="/assets/celebrity_pfp.jpeg" alt="">
          <div class="official-preview-name">@baiillamaach_official</div>
          <div class="official-preview-platform">TikTok • Facebook</div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="official-follow">Follow Official Account</a>
          <p class="official-note">This is the only authentic account. All others are fake.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="fake">
    <h2>⚠️ Fake Accounts Detected</h2>
    <p>2 impersonator accounts found - Report them immediately</p>
    <div class="fake-alert-box">
      <div class="fake-alert-icon danger-glow">!</div>
      <div class="fake-alert-text"><h4>Warning: 2 Fake Accounts Found</h4><p>Not affiliated with Baiilla Maach. Report immediately.</p></div>
    </div>
    <div class="fake-carousel" id="fakeCarousel">
      <div class="fake-track" id="fakeTrack">
        <div class="fake-slide"><div class="glass-card fake-card"><div class="fake-card-top"><div class="fake-card-title">! Fake Account #1</div><span class="fake-card-badge">Critical</span></div><div class="fake-card-body"><div class="fake-screenshot"><img src="/assets/baillamach_fake.png" alt="" loading="lazy"><div class="fake-watermark"><span>FAKE ACCOUNT</span><span>DO NOT TRUST</span></div></div><div class="fake-details"><div class="fake-detail-row"><span class="fake-detail-label">Platform</span><span class="fake-detail-value">TikTok</span></div><div class="fake-detail-row"><span class="fake-detail-label">Username</span><span class="fake-detail-value">@baiilla_mach</span></div><div class="fake-detail-row"><span class="fake-detail-label">Status</span><span class="fake-detail-value">Active Threat</span></div><div class="fake-detail-row"><span class="fake-detail-label">Reports</span><span class="fake-detail-value">156+</span></div><div class="fake-reason">Copies official content and logo to deceive followers. Requests money from fans.</div></div></div><div class="fake-actions"><a href="https://tiktok.com/@baiilla_mach" target="_blank" rel="noopener" class="btn-report">Report</a><button class="btn-copy" data-username="@baiilla_mach">Copy Username</button></div></div></div>
        <div class="fake-slide"><div class="glass-card fake-card"><div class="fake-card-top"><div class="fake-card-title">! Fake Account #2</div><span class="fake-card-badge">High</span></div><div class="fake-card-body"><div class="fake-screenshot"><img src="/assets/hammadfams.png" alt="" loading="lazy"><div class="fake-watermark"><span>FAKE ACCOUNT</span><span>DO NOT TRUST</span></div></div><div class="fake-details"><div class="fake-detail-row"><span class="fake-detail-label">Platform</span><span class="fake-detail-value">TikTok</span></div><div class="fake-detail-row"><span class="fake-detail-label">Username</span><span class="fake-detail-value">@hammad_fams0</span></div><div class="fake-detail-row"><span class="fake-detail-label">Status</span><span class="fake-detail-value">Active Threat</span></div><div class="fake-detail-row"><span class="fake-detail-label">Reports</span><span class="fake-detail-value">89+</span></div><div class="fake-reason">Uses official name and photo to mislead followers. Posts fake giveaways.</div></div></div><div class="fake-actions"><a href="https://tiktok.com/@hammad_fams0" target="_blank" rel="noopener" class="btn-report">Report</a><button class="btn-copy" data-username="@hammad_fams0">Copy Username</button></div></div></div>
      </div>
    </div>
    <div class="carousel-nav">
      <button class="carousel-arrow" onclick="moveCarousel(-1)">◀</button>
      <div class="carousel-dots" id="carouselDots"><button class="carousel-dot on" onclick="goSlide(0)"></button><button class="carousel-dot" onclick="goSlide(1)"></button></div>
      <button class="carousel-arrow" onclick="moveCarousel(1)">▶</button>
    </div>
  </section>

  ${musicSection}
  ${gallerySection}

  <div class="footer">
    <p>© ${new Date().getFullYear()} Baiilla Maach Official. All Rights Reserved.</p>
    <p style="margin-top:4px">This is the only official verification hub</p>
    <p style="margin-top:4px"><a href="/admin" style="color:#6b7280">Admin Login</a></p>
  </div>
</main>

<button class="chat-widget-btn" id="chatWidgetBtn" onclick="toggleChatWidget()">
  <img src="/assets/message_bubble.gif" alt="Chat">
  <span class="unread-count" id="chatUnreadCount" style="display:none">0</span>
</button>
<div class="chat-widget" id="chatWidget"></div>

<script src="/socket.io/socket.io.js"></script>
<script src="/Chat.js"></script>
</body>
</html>`);
});

// Helper functions for public site
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

// Serve Chat.js and Admin.js
app.get('/Chat.js',(req,res)=>{
  res.setHeader('Content-Type','application/javascript');
  res.sendFile(path.join(__dirname,'Chat.js'));
});

app.get('/Admin.js',(req,res)=>{
  res.setHeader('Content-Type','application/javascript');
  res.sendFile(path.join(__dirname,'Admin.js'));
});

// Auth API
app.post('/api/auth/register',rateLimiter(10,60000),async(req,res)=>{
  try{
    const {name,email,password}=req.body;
    
    if(!name||!email||!password)return res.status(400).json({error:'All fields are required'});
    if(name.length<2||name.length>50)return res.status(400).json({error:'Name must be 2-50 characters'});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/^[0-9+\-\s()]{7,20}$/.test(email))return res.status(400).json({error:'Invalid email or phone'});
    if(password.length<6)return res.status(400).json({error:'Password must be at least 6 characters'});
    
    const existing=await User.findOne({email:email.toLowerCase()});
    if(existing)return res.status(400).json({error:'User already exists'});
    
    const hashedPassword=await bcrypt.hash(password,12);
    const user=await User.create({
      name:name.trim(),
      email:email.toLowerCase(),
      password:hashedPassword,
      avatar:'/assets/celebrity_pfp.jpeg'
    });
    
    res.json({success:true,user:{name:user.name,email:user.email,avatar:user.avatar}});
  }catch(e){
    console.error('Register error:',e);
    res.status(500).json({error:'Registration failed'});
  }
});

app.post('/api/auth/login',rateLimiter(20,60000),async(req,res)=>{
  try{
    const {email,password}=req.body;
    
    if(!email||!password)return res.status(400).json({error:'Email and password are required'});
    
    const user=await User.findOne({email:email.toLowerCase()});
    if(!user)return res.status(400).json({error:'User not found'});
    
    const validPassword=await bcrypt.compare(password,user.password);
    if(!validPassword)return res.status(400).json({error:'Invalid password'});
    
    res.json({success:true,user:{name:user.name,email:user.email,avatar:user.avatar}});
  }catch(e){
    console.error('Login error:',e);
    res.status(500).json({error:'Login failed'});
  }
});

// Admin login
app.post('/api/admin/login',rateLimiter(10,60000),async(req,res)=>{
  try{
    const {email,password}=req.body;
    
    if(!email||!password)return res.status(400).json({error:'Email and password are required'});
    
    const user=await User.findOne({email:email.toLowerCase(),isAdmin:true});
    if(!user)return res.status(400).json({error:'Admin not found'});
    
    const validPassword=await bcrypt.compare(password,user.password);
    if(!validPassword)return res.status(400).json({error:'Invalid password'});
    
    res.json({success:true,user:{name:user.name,email:user.email,avatar:user.avatar}});
  }catch(e){
    console.error('Admin login error:',e);
    res.status(500).json({error:'Login failed'});
  }
});

// Get conversations
app.get('/api/conversations',authenticateUser,async(req,res)=>{
  try{
    const userEmail=req.user.email;
    const conversations=await Conversation.find({participants:userEmail})
      .sort({lastMessageAt:-1})
      .limit(50)
      .populate('lastMessage')
      .lean();
    
    const formatted=await Promise.all(conversations.map(async(conv)=>{
      const otherEmail=conv.participants.find(p=>p!==userEmail);
      const otherUser=await User.findOne({email:otherEmail}).select('name email avatar isOnline lastSeen').lean();
      
      return {
        id:conv._id,
        otherUser,
        lastMessage:conv.lastMessage,
        lastMessageAt:conv.lastMessageAt,
        unreadCount:conv.unreadCounts?.get(userEmail)||0
      };
    }));
    
    res.json(formatted);
  }catch(e){
    console.error('Get conversations error:',e);
    res.status(500).json({error:'Failed to load conversations'});
  }
});

// Get messages for conversation
app.get('/api/messages/:conversationId',authenticateUser,async(req,res)=>{
  try{
    const {conversationId}=req.params;
    const {before,limit=20}=req.query;
    
    const query={conversationId,deletedAt:null};
    if(before)query.createdAt={$lt:new Date(before)};
    
    const messages=await Message.find(query)
      .sort({createdAt:-1})
      .limit(parseInt(limit))
      .lean();
    
    res.json(messages.reverse());
  }catch(e){
    console.error('Get messages error:',e);
    res.status(500).json({error:'Failed to load messages'});
  }
});

// Upload file
app.post('/api/upload',authenticateUser,upload.single('file'),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:'No file uploaded'});
    
    const fileUrl='/uploads/'+req.file.filename;
    res.json({fileUrl,fileName:req.file.originalname,fileSize:req.file.size,mimeType:req.file.mimetype});
  }catch(e){
    console.error('Upload error:',e);
    res.status(500).json({error:'Upload failed'});
  }
});

// Admin APIs
app.get('/api/admin/users',authenticateAdmin,async(req,res)=>{
  try{
    const users=await User.find({isAdmin:false})
      .select('name email avatar isOnline lastSeen unreadCount')
      .sort({lastActive:-1})
      .limit(100)
      .lean();
    
    const formatted=await Promise.all(users.map(async(user)=>{
      const conversations=await Conversation.find({participants:user.email})
        .sort({lastMessageAt:-1})
        .limit(1)
        .populate('lastMessage')
        .lean();
      
      return {
        ...user,
        lastMessage:conversations[0]?.lastMessage,
        lastMessageAt:conversations[0]?.lastMessageAt,
        unreadCount:conversations[0]?.unreadCounts?.get('admin')||0
      };
    }));
    
    res.json(formatted);
  }catch(e){
    console.error('Admin users error:',e);
    res.status(500).json({error:'Failed to load users'});
  }
});

app.get('/api/admin/stats',authenticateAdmin,async(req,res)=>{
  try{
    const [totalUsers,onlineUsers,totalMessages,totalConversations] = await Promise.all([
      User.countDocuments({isAdmin:false}),
      User.countDocuments({isAdmin:false,isOnline:true}),
      Message.countDocuments({deletedAt:null}),
      Conversation.countDocuments()
    ]);
    
    const unreadMessages=await Message.countDocuments({receiver:'admin',seenAt:null,deletedAt:null});
    
    res.json({totalUsers,onlineUsers,totalMessages,totalConversations,unreadMessages});
  }catch(e){
    console.error('Admin stats error:',e);
    res.status(500).json({error:'Failed to load stats'});
  }
});

// Socket.IO handling
const connectedSockets=new Map();
const typingUsers=new Map();

io.use(async(socket,next)=>{
  const email=socket.handshake.auth?.email;
  if(!email)return next(new Error('Authentication required'));
  
  const user=await User.findOne({email:email.toLowerCase()});
  if(!user)return next(new Error('User not found'));
  
  socket.user=user;
  next();
});

io.on('connection',(socket)=>{
  const userEmail=socket.user.email;
  
  // Update user online status
  socket.join(userEmail);
  
  if(!socket.user.socketIds.includes(socket.id)){
    socket.user.socketIds.push(socket.id);
  }
  
  User.updateOne({email:userEmail},{
    $set:{isOnline:true,lastSeen:new Date(),lastActive:new Date()},
    $addToSet:{socketIds:socket.id}
  }).exec();
  
  io.emit('presence:update',{email:userEmail,isOnline:true});
  
  socket.on('authenticate',async(data)=>{
    try{
      const user=await User.findOne({email:data.email});
      if(user){
        socket.user=user;
        socket.join(user.email);
        
        User.updateOne({email:user.email},{
          $set:{isOnline:true,lastSeen:new Date()},
          $addToSet:{socketIds:socket.id}
        }).exec();
        
        socket.emit('authenticated',{success:true,user:{name:user.name,email:user.email,avatar:user.avatar}});
        io.emit('presence:update',{email:user.email,isOnline:true});
      }
    }catch(e){
      console.error('Socket auth error:',e);
      socket.emit('authenticated',{success:false,error:'Authentication failed'});
    }
  });
  
  socket.on('message:send',async(data)=>{
    try{
      const {conversationId,sender,receiver,message,type,fileUrl,fileName,fileSize,mimeType,replyTo,messageId}=data;
      
      // Check for duplicate
      if(messageId){
        const existing=await Message.findOne({messageId});
        if(existing){
          socket.emit('message:sent',{messageId,status:'duplicate'});
          return;
        }
      }
      
      const conversation=await getOrCreateConversation(sender,receiver);
      const newMessage=await Message.create({
        messageId:messageId||crypto.randomUUID(),
        conversationId,
        sender,
        receiver,
        message:message||'',
        type:type||'text',
        fileUrl:fileUrl||'',
        fileName:fileName||'',
        fileSize:fileSize||0,
        mimeType:mimeType||'',
        replyTo:replyTo||null
      });
      
      await Conversation.updateOne({_id:conversation._id},{
        $set:{lastMessage:newMessage._id,lastMessageAt:new Date(),updatedAt:new Date()},
        $inc:{[`unreadCounts.${receiver}`]:1}
      });
      
      // Emit to both sender and receiver
      io.to(sender).emit('message:new',newMessage);
      io.to(receiver).emit('message:new',newMessage);
      
      socket.emit('message:sent',{messageId:newMessage.messageId,status:'sent'});
    }catch(e){
      console.error('Message send error:',e);
      socket.emit('message:error',{error:'Failed to send message'});
    }
  });
  
  socket.on('message:delivered',async(data)=>{
    try{
      const {messageId,deliveredAt}=data;
      await Message.updateOne({messageId},{$set:{deliveredAt:deliveredAt||new Date()}});
      io.emit('message:delivered',{messageId,deliveredAt:deliveredAt||new Date()});
    }catch(e){
      console.error('Message delivered error:',e);
    }
  });
  
  socket.on('message:seen',async(data)=>{
    try{
      const {conversationId,seenBy}=data;
      await Message.updateMany(
        {conversationId,receiver:seenBy,seenAt:null,deletedAt:null},
        {$set:{seenAt:new Date()}}
      );
      
      await Conversation.updateOne(
        {participants:conversationId},
        {$set:{[`unreadCounts.${seenBy}`]:0}}
      );
      
      io.emit('message:seen',{conversationId,seenBy});
    }catch(e){
      console.error('Message seen error:',e);
    }
  });
  
  socket.on('typing',(data)=>{
    const {sender,receiver,isTyping}=data;
    const key=sender+'_'+receiver;
    
    if(isTyping){
      typingUsers.set(key,{sender,receiver,timestamp:Date.now()});
      io.to(receiver).emit('typing',{sender,isTyping:true});
    }else{
      typingUsers.delete(key);
      io.to(receiver).emit('typing',{sender,isTyping:false});
    }
  });
  
  socket.on('conversation:read',async(data)=>{
    try{
      const {conversationId,reader}=data;
      await Conversation.updateOne(
        {participants:conversationId},
        {$set:{[`unreadCounts.${reader}`]:0}}
      );
      io.emit('conversation:read',{conversationId,reader});
    }catch(e){
      console.error('Conversation read error:',e);
    }
  });
  
  socket.on('disconnect',async()=>{
    try{
      const user=await User.findOne({email:userEmail});
      if(user){
        user.socketIds=user.socketIds.filter(id=>id!==socket.id);
        
        if(user.socketIds.length===0){
          user.isOnline=false;
          user.lastSeen=new Date();
          user.lastActive=new Date();
        }
        
        await user.save();
        
        if(user.socketIds.length===0){
          io.emit('presence:update',{email:userEmail,isOnline:false});
        }
      }
    }catch(e){
      console.error('Disconnect error:',e);
    }
  });
});

// Error handling middleware
app.use((err,req,res,next)=>{
  console.error('Server error:',err);
  res.status(500).json({error:'Internal server error'});
});

// Start server
server.listen(PORT,()=>{
  console.log(`Server running on port ${PORT}`);
});

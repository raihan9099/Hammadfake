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

['uploads','assets/covermusic'].forEach(function(d){if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true})});

const upload=multer({dest:'uploads/'});

const User=mongoose.model('User',new mongoose.Schema({
  name:String,email:{type:String,unique:true},password:String,isAdmin:{type:Boolean,default:false},
  lastSeen:Date,isOnline:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now}
}));
const Message=mongoose.model('Message',new mongoose.Schema({
  sender:String,receiver:String,message:String,type:{type:String,default:'text'},
  fileUrl:String,seen:{type:Boolean,default:false},timestamp:{type:Date,default:Date.now}
}));

// Fixed: Admin password always set to 'admin@112233'
mongoose.connect(MONGO_URI).then(async function(){
  console.log('MongoDB connected');
  try {
    const admin=await User.findOne({email:'admin@baillamaach.com'});
    if(!admin){
      await User.create({
        name:'Baiilla Maach',
        email:'admin@baillamaach.com',
        password:await bcrypt.hash('admin@112233',10),
        isAdmin:true
      });
      console.log('Admin account created with correct password');
    } else {
      // Update existing admin password if needed
      const validPassword = await bcrypt.compare('admin@112233', admin.password);
      if (!validPassword) {
        await User.updateOne(
          {email:'admin@baillamaach.com'},
          {$set:{password:await bcrypt.hash('admin@112233',10)}}
        );
        console.log('Admin password updated');
      }
    }
  } catch(e) {
    console.log('Admin setup error:', e.message);
  }
}).catch(function(e){console.log('MongoDB error:',e.message)});

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
    return fs.readdirSync(dir).filter(function(f){return f.endsWith('.mp3')}).map(function(f,i){
      return {
        id:i,
        title:f.replace('.mp3','').replace(/[-_]/g,' '),
        url:'/assets/covermusic/'+encodeURIComponent(f)
      };
    });
  }catch(e){return[]}
}

app.get('/',function(req,res){
  const songs=getSongs();
  
  // Fixed: Build music HTML using string concatenation instead of template literals
  let musicHTML='';
  if(songs.length>0){
    musicHTML='<section class="section bg-gray">'+
      '<div class="container">'+
        '<div class="section-label">MUSIC</div>'+
        '<h2 class="section-heading">Cover Songs</h2>'+
        '<p class="section-desc">Official covers by Hammad Bin Amir</p>'+
        '<div class="music-player">'+
          '<div class="music-cover">'+
            '<img src="'+ASSETS.microphone+'" alt="Music" onerror="this.src=\''+ASSETS.profile+'\'">'+
          '</div>'+
          '<div class="music-info">'+
            '<h4 id="trackTitle">Select a Song</h4>'+
            '<p id="trackArtist">Baiilla Maach</p>'+
            '<div class="music-ctrls">'+
              '<button onclick="prevTrack()">⏮</button>'+
              '<button id="playBtn" onclick="togglePlay()" class="btn-play">▶️</button>'+
              '<button onclick="nextTrack()">⏭</button>'+
            '</div>'+
            '<div class="music-bar" onclick="seekTrack(event)"><div id="progressBar" class="music-bar-fill"></div></div>'+
            '<div class="music-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>'+
          '</div>'+
        '</div>'+
        '<div class="music-list">';
    
    songs.forEach(function(s,i){
      musicHTML+='<div onclick="playTrack('+i+')" class="music-item"><span>'+String(i+1).padStart(2,'0')+'</span>'+s.title+'</div>';
    });
    
    musicHTML+='</div></div></section>';
  }

  // Fixed: Build voice HTML using string concatenation
  let voiceHTML='';
  if(WELCOME_VOICE||MANUAL_VOICE){
    voiceHTML='<section class="section">'+
      '<div class="container" style="text-align:center">'+
        '<div class="section-label">VOICE</div>'+
        '<h2 class="section-heading">Voice Verification</h2>'+
        '<p class="section-desc">Listen to authentic Baiilla Maach voice</p>'+
        '<div class="voice-btns">';
    
    if(WELCOME_VOICE) voiceHTML+='<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>';
    if(MANUAL_VOICE) voiceHTML+='<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert</button>';
    
    voiceHTML+='</div></div></section>';
  }

  res.send('<!DOCTYPE html>\n'+
'<html lang="en">\n'+
'<head>\n'+
'<meta charset="UTF-8">\n'+
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'+
'<meta name="theme-color" content="#ffffff">\n'+
'<title>Hammad Bin Amir — Official Verification</title>\n'+
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">\n'+
'<style>\n'+
':root{\n'+
'  --white:#ffffff;\n'+
'  --bg:#f8f9fb;\n'+
'  --gray50:#f9fafb;\n'+
'  --gray100:#f3f4f6;\n'+
'  --gray200:#e5e7eb;\n'+
'  --gray300:#d1d5db;\n'+
'  --gray400:#9ca3af;\n'+
'  --gray500:#6b7280;\n'+
'  --gray600:#4b5563;\n'+
'  --gray700:#374151;\n'+
'  --gray800:#1f2937;\n'+
'  --gray900:#111827;\n'+
'  --orange:#f97316;\n'+
'  --orange-dark:#ea580c;\n'+
'  --orange-light:#fff7ed;\n'+
'  --green:#10b981;\n'+
'  --green-light:#ecfdf5;\n'+
'  --red:#ef4444;\n'+
'  --red-light:#fef2f2;\n'+
'  --blue:#3b82f6;\n'+
'  --blue-light:#eff6ff;\n'+
'  --shadow-sm:0 1px 2px rgba(0,0,0,0.05);\n'+
'  --shadow:0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06);\n'+
'  --shadow-md:0 4px 6px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.06);\n'+
'  --shadow-lg:0 10px 15px rgba(0,0,0,0.1),0 4px 6px rgba(0,0,0,0.05);\n'+
'  --radius:16px;\n'+
'  --radius-sm:10px;\n'+
'  --radius-full:9999px;\n'+
'}\n'+
'\n'+
'*{margin:0;padding:0;box-sizing:border-box}\n'+
'html{scroll-behavior:smooth}\n'+
'body{font-family:\'Inter\',sans-serif;background:var(--white);color:var(--gray800);line-height:1.6;-webkit-font-smoothing:antialiased}\n'+
'\n'+
'.nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--gray200);padding:0 24px}\n'+
'.nav-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;height:64px}\n'+
'.nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none}\n'+
'.nav-brand img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--orange)}\n'+
'.nav-brand span{font-family:\'Outfit\',sans-serif;font-weight:700;font-size:1.15em;color:var(--gray900);letter-spacing:-0.3px}\n'+
'.nav-chat{display:flex;align-items:center;gap:6px;background:var(--green);color:var(--white);padding:8px 18px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.85em;transition:0.2s}\n'+
'.nav-chat:hover{background:#059669;transform:translateY(-1px)}\n'+
'.nav-chat img{width:18px;height:18px}\n'+
'\n'+
'.hero{padding:80px 24px 60px;text-align:center;max-width:700px;margin:0 auto}\n'+
'.hero-avatar{position:relative;display:inline-block;margin-bottom:20px}\n'+
'.hero-avatar img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--orange);box-shadow:0 0 0 8px var(--orange-light)}\n'+
'.hero-avatar .verified-icon{position:absolute;bottom:8px;right:8px;background:var(--green);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid var(--white)}\n'+
'.hero-avatar .verified-icon svg{width:14px;height:14px;fill:var(--white)}\n'+
'.hero h1{font-family:\'Outfit\',sans-serif;font-size:2.5em;font-weight:800;color:var(--gray900);letter-spacing:-1px;margin-bottom:4px}\n'+
'.hero .username{font-family:\'DM Sans\',sans-serif;font-size:1.05em;color:var(--gray500);font-weight:400;margin-bottom:4px}\n'+
'.hero .bio{color:var(--gray400);font-size:0.95em;margin-bottom:20px}\n'+
'.hero-stats{display:flex;justify-content:center;gap:32px;margin:20px 0}\n'+
'.hero-stat{text-align:center}\n'+
'.hero-stat .num{font-family:\'Outfit\',sans-serif;font-size:1.6em;font-weight:700;color:var(--gray900)}\n'+
'.hero-stat .label{font-size:0.78em;color:var(--gray400);text-transform:uppercase;letter-spacing:1.5px;margin-top:2px}\n'+
'.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--green-light);color:var(--green);padding:6px 16px;border-radius:var(--radius-full);font-weight:600;font-size:0.8em;margin-bottom:18px}\n'+
'.hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}\n'+
'.hero-btn{padding:10px 22px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.88em;display:flex;align-items:center;gap:6px;transition:0.2s}\n'+
'.hero-btn img{width:18px;height:18px}\n'+
'.hero-btn.tiktok{background:var(--gray900);color:var(--white)}\n'+
'.hero-btn.tiktok:hover{background:#000}\n'+
'.hero-btn.facebook{background:var(--blue-light);color:var(--blue)}\n'+
'.hero-btn.facebook:hover{background:#dbeafe}\n'+
'\n'+
'.section{padding:80px 24px}\n'+
'.section.bg-gray{background:var(--gray50)}\n'+
'.section.bg-green{background:var(--green-light)}\n'+
'.section.bg-red{background:var(--red-light)}\n'+
'.container{max-width:1050px;margin:0 auto}\n'+
'.section-label{display:inline-block;font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:var(--orange);margin-bottom:12px}\n'+
'.section-heading{font-family:\'Outfit\',sans-serif;font-size:2em;font-weight:700;color:var(--gray900);text-align:center;letter-spacing:-0.5px;margin-bottom:6px}\n'+
'.section-desc{text-align:center;color:var(--gray500);margin-bottom:40px;font-size:0.95em}\n'+
'\n'+
'.verified-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}\n'+
'.verified-card{background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);padding:28px;transition:0.2s}\n'+
'.verified-card:hover{border-color:var(--green);box-shadow:var(--shadow-md)}\n'+
'.verified-card .card-top{display:flex;align-items:center;gap:12px;margin-bottom:18px}\n'+
'.verified-card .card-top .pfp{width:48px;height:48px;border-radius:50%;object-fit:cover}\n'+
'.verified-card .card-top .info h3{font-family:\'Outfit\',sans-serif;font-size:1.1em;font-weight:600;display:flex;align-items:center;gap:5px;color:var(--gray900)}\n'+
'.verified-card .card-top .info h3 img{width:18px;height:18px}\n'+
'.verified-card .card-top .info .handle{color:var(--gray500);font-size:0.85em;font-family:\'DM Sans\',sans-serif}\n'+
'.verified-card .card-body .row{display:flex;align-items:center;gap:6px;padding:6px 0;color:var(--gray600);font-size:0.88em}\n'+
'.verified-card .card-body .row strong{color:var(--gray800);font-weight:600}\n'+
'.verified-card .card-body .follow-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.82em;margin-top:12px;transition:0.2s}\n'+
'.verified-card .card-body .follow-btn img{width:16px;height:16px}\n'+
'.verified-card .card-body .follow-btn.tiktok-btn{background:var(--gray900);color:var(--white)}\n'+
'.verified-card .card-body .follow-btn.tiktok-btn:hover{background:#000}\n'+
'.verified-card .card-body .follow-btn.fb-btn{background:var(--blue);color:var(--white)}\n'+
'.verified-card .card-body .follow-btn.fb-btn:hover{background:#2563eb}\n'+
'\n'+
'.fake-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}\n'+
'.fake-card{background:var(--white);border:2px solid #fecaca;border-radius:var(--radius);overflow:hidden;position:relative;transition:0.2s}\n'+
'.fake-card:hover{box-shadow:var(--shadow-lg)}\n'+
'.fake-img-container{position:relative;text-align:center;background:#fafafa;padding:20px}\n'+
'.fake-img{max-width:100%;height:auto;display:block;margin:0 auto}\n'+
'.fake-detect{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;animation:updown 2s infinite ease-in-out}\n'+
'@keyframes updown{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-15px)}}\n'+
'.fake-card .fake-info{padding:20px}\n'+
'.fake-card .fake-info h3{font-family:\'Outfit\',sans-serif;font-size:1.1em;font-weight:600;color:var(--gray900);margin-bottom:2px}\n'+
'.fake-card .fake-info .plat{color:var(--orange);font-weight:600;font-size:0.82em;margin-bottom:6px}\n'+
'.fake-card .fake-info p{color:var(--gray500);font-size:0.88em;margin-bottom:12px;line-height:1.5}\n'+
'.fake-card .fake-info .report-btn{display:inline-flex;align-items:center;gap:5px;background:var(--red);color:var(--white);padding:7px 16px;border-radius:var(--radius-full);text-decoration:none;font-weight:600;font-size:0.8em;transition:0.2s}\n'+
'.fake-card .fake-info .report-btn:hover{background:#dc2626}\n'+
'.fake-card .fake-info .report-btn img{width:15px;height:15px}\n'+
'\n'+
'.voice-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px}\n'+
'.voice-btn{padding:12px 26px;border-radius:var(--radius-full);border:none;font-weight:600;cursor:pointer;font-size:0.9em;display:flex;align-items:center;gap:6px;transition:0.2s}\n'+
'.voice-btn.welcome{background:var(--orange);color:var(--white)}\n'+
'.voice-btn.welcome:hover{background:var(--orange-dark)}\n'+
'.voice-btn.manual{background:var(--white);color:var(--red);border:2px solid var(--red)}\n'+
'.voice-btn.manual:hover{background:var(--red);color:var(--white)}\n'+
'\n'+
'.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}\n'+
'.proof-card{background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius-sm);padding:20px;text-align:center;transition:0.2s}\n'+
'.proof-card:hover{border-color:var(--orange);box-shadow:var(--shadow-sm)}\n'+
'.proof-card img{width:100%;height:auto;border-radius:6px;margin-bottom:10px}\n'+
'.proof-card p{font-weight:600;font-size:0.85em;color:var(--gray700)}\n'+
'\n'+
'.music-player{max-width:600px;margin:0 auto;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);padding:28px;display:flex;align-items:center;gap:24px}\n'+
'.music-cover img{width:100px;height:100px;border-radius:50%;object-fit:cover;border:2px solid var(--orange)}\n'+
'.music-info{flex:1;text-align:center}\n'+
'.music-info h4{font-family:\'Outfit\',sans-serif;font-size:1.05em;font-weight:600;color:var(--gray900);margin-bottom:2px}\n'+
'.music-info p{color:var(--orange);font-weight:600;font-size:0.85em;margin-bottom:10px}\n'+
'.music-ctrls{display:flex;justify-content:center;gap:10px;margin-bottom:8px}\n'+
'.music-ctrls button{background:var(--gray100);border:1px solid var(--gray200);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:0.9em;transition:0.2s;color:var(--gray700)}\n'+
'.music-ctrls button:hover{background:var(--orange-light);border-color:var(--orange)}\n'+
'.music-ctrls .btn-play{background:var(--orange);color:var(--white);border:none;width:48px;height:48px;font-size:1.1em}\n'+
'.music-ctrls .btn-play:hover{background:var(--orange-dark)}\n'+
'.music-bar{background:var(--gray200);height:4px;border-radius:2px;cursor:pointer;margin:6px 0}\n'+
'.music-bar-fill{background:var(--orange);height:100%;border-radius:2px;width:0%;transition:width 0.1s}\n'+
'.music-time{font-size:0.78em;color:var(--gray500);font-family:\'DM Sans\',sans-serif}\n'+
'.music-list{margin-top:10px;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius-sm);max-height:240px;overflow-y:auto}\n'+
'.music-item{padding:10px 18px;cursor:pointer;border-bottom:1px solid var(--gray100);display:flex;gap:8px;font-size:0.85em;transition:0.15s;color:var(--gray700)}\n'+
'.music-item:hover{background:var(--orange-light)}\n'+
'.music-item.active{background:var(--orange-light);border-left:3px solid var(--orange);font-weight:600}\n'+
'.music-item span{font-weight:700;color:var(--orange);min-width:24px}\n'+
'\n'+
'.footer{background:var(--gray900);color:var(--white);padding:50px 24px 30px;text-align:center}\n'+
'.footer-grid{max-width:1000px;margin:0 auto 30px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:30px;text-align:left}\n'+
'.footer h4{font-family:\'Outfit\',sans-serif;color:var(--orange);margin-bottom:10px;font-size:0.95em}\n'+
'.footer p,.footer a{color:var(--gray400);text-decoration:none;font-size:0.82em;line-height:1.8}\n'+
'.footer a:hover{color:var(--white)}\n'+
'.footer-bottom{padding-top:20px;border-top:1px solid var(--gray700);font-size:0.78em;color:var(--gray500)}\n'+
'\n'+
'.chat-widget{position:fixed;bottom:24px;right:24px;z-index:999}\n'+
'.chat-bubble{width:56px;height:56px;border-radius:50%;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.3);transition:0.2s;animation:softBounce 3s infinite}\n'+
'.chat-bubble:hover{transform:scale(1.08)}\n'+
'.chat-bubble img{width:100%;height:100%;border-radius:50%}\n'+
'@keyframes softBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n'+
'.chat-box{display:none;position:fixed;bottom:90px;right:24px;width:360px;height:460px;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);flex-direction:column;overflow:hidden;z-index:999;box-shadow:var(--shadow-lg)}\n'+
'.chat-box.open{display:flex}\n'+
'.chat-box .head{background:var(--green);color:var(--white);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-family:\'Outfit\',sans-serif;font-weight:600;font-size:0.9em}\n'+
'.chat-box .head button{background:none;border:none;color:var(--white);font-size:1.2em;cursor:pointer}\n'+
'.chat-box .body{flex:1;overflow-y:auto;padding:14px;background:var(--gray50)}\n'+
'.chat-box .login-form{padding:24px;text-align:center}\n'+
'.chat-box .login-form input{width:100%;padding:10px 14px;margin-bottom:8px;border:1px solid var(--gray200);border-radius:8px;font-size:0.88em;font-family:\'Inter\',sans-serif;outline:none}\n'+
'.chat-box .login-form input:focus{border-color:var(--orange)}\n'+
'.chat-box .login-form button{width:100%;padding:10px;background:var(--orange);color:var(--white);border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9em}\n'+
'.chat-box .input-row{padding:12px 14px;background:var(--white);border-top:1px solid var(--gray200);display:none}\n'+
'.chat-box .input-row input{flex:1;padding:10px 14px;border:1px solid var(--gray200);border-radius:20px;font-size:0.88em;font-family:\'Inter\',sans-serif;outline:none}\n'+
'.chat-box .input-row button{background:var(--orange);color:var(--white);border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:1em;margin-left:6px}\n'+
'.msg{max-width:80%;padding:8px 12px;border-radius:14px;margin-bottom:5px;font-size:0.84em;word-wrap:break-word}\n'+
'.msg.user{background:var(--orange);color:var(--white);margin-left:auto;border-bottom-right-radius:3px}\n'+
'.msg.admin{background:var(--white);color:var(--gray800);border:1px solid var(--gray200);border-bottom-left-radius:3px}\n'+
'.msg .time{font-size:0.65em;opacity:0.6;margin-top:3px;text-align:right}\n'+
'\n'+
'@media(max-width:768px){\n'+
'  .hero h1{font-size:1.8em}\n'+
'  .verified-grid,.fake-grid{grid-template-columns:1fr}\n'+
'  .proof-grid{grid-template-columns:1fr}\n'+
'  .music-player{flex-direction:column;text-align:center}\n'+
'  .chat-box{width:100%;height:100%;bottom:0;right:0;border-radius:0}\n'+
'}\n'+
'</style>\n'+
'</head>\n'+
'<body>\n'+
'\n'+
'<nav class="nav">\n'+
'  <div class="nav-inner">\n'+
'    <a href="/" class="nav-brand">\n'+
'      <img src="'+ASSETS.profile+'" alt="Logo" onerror="this.style.display=\'none\'">\n'+
'      <span>Baiilla Maach</span>\n'+
'    </a>\n'+
'    <a href="/messenger" class="nav-chat">\n'+
'      <img src="'+ASSETS.messageBubble+'" alt="Chat"> Chat Support\n'+
'    </a>\n'+
'  </div>\n'+
'</nav>\n'+
'\n'+
'<section class="hero">\n'+
'  <div class="hero-avatar">\n'+
'    <img src="'+ASSETS.profile+'" alt="Baiilla Maach" onerror="this.style.display=\'none\'">\n'+
'    <div class="verified-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>\n'+
'  </div>\n'+
'  <h1>Hammad Bin Amir</h1>\n'+
'  <p class="username">@baiillamaach_official</p>\n'+
'  <p class="bio">Official Entertainment Profile · Verified Creator</p>\n'+
'  <div class="hero-stats">\n'+
'    <div class="hero-stat"><div class="num">7K</div><div class="label">Followers</div></div>\n'+
'    <div class="hero-stat"><div class="num">0</div><div class="label">Following</div></div>\n'+
'    <div class="hero-stat"><div class="num">190K</div><div class="label">Likes</div></div>\n'+
'  </div>\n'+
'  <div class="hero-badge">✓ Verified Official Account</div>\n'+
'  <div class="hero-btns">\n'+
'    <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="hero-btn tiktok"><img src="'+ASSETS.logoTikTok+'" alt=""> TikTok</a>\n'+
'    <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="hero-btn facebook"><img src="'+ASSETS.logoFB+'" alt=""> Facebook</a>\n'+
'  </div>\n'+
'</section>\n'+
'\n'+
'<section class="section bg-green">\n'+
'  <div class="container">\n'+
'    <div class="section-label">OFFICIAL</div>\n'+
'    <h2 class="section-heading">Verified Accounts</h2>\n'+
'    <p class="section-desc">The only authentic Baiilla Maach accounts</p>\n'+
'    <div class="verified-grid">\n'+
'      <div class="verified-card">\n'+
'        <div class="card-top">\n'+
'          <img src="'+ASSETS.profile+'" class="pfp" onerror="this.style.display=\'none\'">\n'+
'          <div class="info">\n'+
'            <h3>TikTok <img src="'+ASSETS.blueTikTok+'" onerror="this.style.display=\'none\'"></h3>\n'+
'            <p class="handle">@baiillamaach_official</p>\n'+
'          </div>\n'+
'        </div>\n'+
'        <div class="card-body">\n'+
'          <div class="row">✓ Status: <strong>Active & Verified</strong></div>\n'+
'          <div class="row">👥 Followers: <strong>7,000</strong></div>\n'+
'          <div class="row">❤️ Likes: <strong>190,000</strong></div>\n'+
'          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok-btn">\n'+
'            <img src="'+ASSETS.logoTikTok+'" alt="TikTok" style="width:16px;height:16px"> Follow on TikTok\n'+
'          </a>\n'+
'        </div>\n'+
'      </div>\n'+
'      <div class="verified-card">\n'+
'        <div class="card-top">\n'+
'          <img src="'+ASSETS.fbProfile+'" class="pfp" onerror="this.style.display=\'none\'">\n'+
'          <div class="info">\n'+
'            <h3>Facebook <img src="'+ASSETS.blueFB+'" onerror="this.style.display=\'none\'"></h3>\n'+
'            <p class="handle">@BaiillaMaachOfficial</p>\n'+
'          </div>\n'+
'        </div>\n'+
'        <div class="card-body">\n'+
'          <div class="row">✓ Status: <strong>Active & Verified</strong></div>\n'+
'          <div class="row">📘 Page: <strong>Official Facebook</strong></div>\n'+
'          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">\n'+
'            <img src="'+ASSETS.logoFB+'" alt="Facebook" style="width:16px;height:16px"> Follow on Facebook\n'+
'          </a>\n'+
'        </div>\n'+
'      </div>\n'+
'    </div>\n'+
'  </div>\n'+
'</section>\n'+
'\n'+
'<section class="section bg-red">\n'+
'  <div class="container">\n'+
'    <div class="section-label" style="color:var(--red)">WARNING</div>\n'+
'    <h2 class="section-heading">Fake Accounts Detected</h2>\n'+
'    <p class="section-desc">Report these accounts immediately</p>\n'+
'    <div class="fake-grid">\n'+
'      <div class="fake-card">\n'+
'        <div class="fake-img-container">\n'+
'          <img src="'+ASSETS.baillamachFake+'" class="fake-img" alt="Fake Account Screenshot" onerror="this.style.display=\'none\'">\n'+
'          <img src="'+ASSETS.fakeDetect+'" class="fake-detect" alt="FAKE" onerror="this.style.display=\'none\'">\n'+
'        </div>\n'+
'        <div class="fake-info">\n'+
'          <h3>@baiilla_mach</h3>\n'+
'          <p class="plat">📍 TikTok</p>\n'+
'          <p>Copies official logo and content to deceive followers. Uses similar name to confuse fans.</p>\n'+
'          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn"><img src="'+ASSETS.reportBtn+'" alt=""> Report Account</a>\n'+
'        </div>\n'+
'      </div>\n'+
'      <div class="fake-card">\n'+
'        <div class="fake-img-container">\n'+
'          <img src="'+ASSETS.hammadFake+'" class="fake-img" alt="Fake Account Screenshot" onerror="this.style.display=\'none\'">\n'+
'          <img src="'+ASSETS.fakeDetect+'" class="fake-detect" alt="FAKE" onerror="this.style.display=\'none\'">\n'+
'        </div>\n'+
'        <div class="fake-info">\n'+
'          <h3>@hammad_fams0</h3>\n'+
'          <p class="plat">📍 TikTok</p>\n'+
'          <p>Uses official name and photo to mislead followers. Impersonating with fake content.</p>\n'+
'          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn"><img src="'+ASSETS.reportBtn+'" alt=""> Report Account</a>\n'+
'        </div>\n'+
'      </div>\n'+
'    </div>\n'+
'  </div>\n'+
'</section>\n'+
'\n'+
'<section class="section bg-gray">\n'+
'  <div class="container">\n'+
'    <div class="section-label">PROOF</div>\n'+
'    <h2 class="section-heading">Identity Verification</h2>\n'+
'    <p class="section-desc">Evidence confirming authenticity</p>\n'+
'    <div class="proof-grid">\n'+
'      <div class="proof-card"><img src="'+ASSETS.realId+'" alt="Real ID Proof" onerror="this.style.display=\'none\'"><p>Real ID Verified</p></div>\n'+
'      <div class="proof-card"><img src="'+ASSETS.fakeDetect+'" alt="Fake Detection" onerror="this.style.display=\'none\'"><p>Fake Account Detection</p></div>\n'+
'      <div class="proof-card"><img src="'+ASSETS.microphone+'" alt="Voice Note" onerror="this.style.display=\'none\'"><p>Real Voice Recording</p></div>\n'+
'    </div>\n'+
'  </div>\n'+
'</section>\n'+
'\n'+
voiceHTML+
'\n'+
musicHTML+
'\n'+
'<footer class="footer">\n'+
'  <div class="footer-grid">\n'+
'    <div><h4>About</h4><p>Official verification hub for Baiilla Maach. Protecting fans from fake accounts.</p></div>\n'+
'    <div><h4>Links</h4><p><a href="https://tiktok.com/@baiillamaach_official">TikTok</a></p><p><a href="https://www.facebook.com/profile.php?id=61575202118828">Facebook</a></p></div>\n'+
'    <div><h4>Contact</h4><p>Use the chat button for support</p></div>\n'+
'  </div>\n'+
'  <div class="footer-bottom"><p>© 2024 Baiilla Maach. All rights reserved.</p></div>\n'+
'</footer>\n'+
'\n'+
'<div class="chat-widget"><div class="chat-bubble" onclick="openChat()"><img src="'+ASSETS.messageBubble+'" alt="Chat"></div></div>\n'+
'<div class="chat-box" id="chatBox">\n'+
'  <div class="head">💬 Chat Support<button onclick="closeChat()">✕</button></div>\n'+
'  <div class="body" id="chatBody">\n'+
'    <div class="login-form" id="chatLogin">\n'+
'      <h4 style="margin-bottom:12px;font-family:\'Outfit\',sans-serif;">Start Chat</h4>\n'+
'      <input type="text" id="chatName" placeholder="Your Name">\n'+
'      <input type="text" id="chatEmail" placeholder="Email or Phone">\n'+
'      <button onclick="startChat()">Start Chatting</button>\n'+
'    </div>\n'+
'  </div>\n'+
'  <div class="input-row" id="chatInput">\n'+
'    <div style="display:flex;align-items:center">\n'+
'      <input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key===\'Enter\')sendMsg()">\n'+
'      <button onclick="sendMsg()">➤</button>\n'+
'    </div>\n'+
'  </div>\n'+
'</div>\n'+
'\n'+
(WELCOME_VOICE?'<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>\n':'')+
(MANUAL_VOICE?'<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>\n':'')+
'\n'+
'<script src="/socket.io/socket.io.js"></script>\n'+
'<script>\n'+
'window.addEventListener("load",function(){var a=document.getElementById("welcomeAudio");if(a)setTimeout(function(){a.play().catch(function(){})},1200)});\n'+
'function playWelcome(){var a=document.getElementById("welcomeAudio");if(a){a.currentTime=0;a.play()}}\n'+
'function playManual(){var a=document.getElementById("manualAudio");if(a){a.currentTime=0;a.play()}}\n'+
'\n'+
'var tracks='+JSON.stringify(songs)+';\n'+
'var ct=0,playing=false;\n'+
'var audio=new Audio();\n'+
'if(tracks.length>0){audio.src=tracks[0].url;audio.load()}\n'+
'function playTrack(i){ct=i;audio.src=tracks[i].url;audio.load();audio.play();playing=true;document.getElementById("playBtn").textContent="⏸️";document.getElementById("trackTitle").textContent=tracks[i].title;document.querySelectorAll(".music-item").forEach(function(el,j){el.classList.toggle("active",j===i)})}\n'+
'function togglePlay(){if(audio.paused){audio.play();playing=true;document.getElementById("playBtn").textContent="⏸️"}else{audio.pause();playing=false;document.getElementById("playBtn").textContent="▶️"}}\n'+
'function prevTrack(){playTrack((ct-1+tracks.length)%tracks.length)}\n'+
'function nextTrack(){playTrack((ct+1)%tracks.length)}\n'+
'audio.addEventListener("timeupdate",function(){var p=(audio.currentTime/audio.duration)*100||0;document.getElementById("progressBar").style.width=p+"%";document.getElementById("currentTime").textContent=ft(audio.currentTime);document.getElementById("duration").textContent=ft(audio.duration)});\n'+
'audio.addEventListener("ended",nextTrack);\n'+
'function seekTrack(e){var r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration}\n'+
'function ft(s){if(isNaN(s))return"0:00";var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+String(sec).padStart(2,"0")}\n'+
'\n'+
'var socket=io();var cu=null;\n'+
'function openChat(){document.getElementById("chatBox").classList.add("open")}\n'+
'function closeChat(){document.getElementById("chatBox").classList.remove("open")}\n'+
'function startChat(){var n=document.getElementById("chatName").value.trim();var e=document.getElementById("chatEmail").value.trim();if(!n||!e)return;cu={name:n,email:e};socket.emit("register",{name:n,email:e});document.getElementById("chatLogin").style.display="none";document.getElementById("chatInput").style.display="block";loadMsgs()}\n'+
'async function loadMsgs(){if(!cu)return;var r=await fetch("/api/msgs/"+cu.email);var ms=await r.json();var b=document.getElementById("chatBody");b.innerHTML=ms.map(function(m){return "<div class=\"msg "+(m.sender===cu.email?"user":"admin")+"\">"+(m.type==="image"?"<img src=\""+m.fileUrl+"\" style=\"max-width:120px;border-radius:8px\">":m.message)+"<div class=\"time\">"+new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"</div></div>"}).join("");b.scrollTop=b.scrollHeight}\n'+
'function sendMsg(){var i=document.getElementById("chatMsg");var m=i.value.trim();if(!m||!cu)return;socket.emit("sendMsg",{sender:cu.email,receiver:"admin",message:m,type:"text"});i.value=""}\n'+
'socket.on("newMsg",function(m){if(cu&&(m.sender===cu.email||m.receiver===cu.email)){var b=document.getElementById("chatBody");b.insertAdjacentHTML("beforeend","<div class=\"msg "+(m.sender===cu.email?"user":"admin")+"\">"+(m.type==="image"?"<img src=\""+m.fileUrl+"\" style=\"max-width:120px;border-radius:8px\">":m.message)+"<div class=\"time\">"+new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"</div></div>");b.scrollTop=b.scrollHeight}});\n'+
'</script>\n'+
'</body>\n'+
'</html>');
});

// Fixed: API routes with proper error handling
app.get('/api/msgs/:email',async function(req,res){
  try {
    const msgs=await Message.find({
      $or:[
        {sender:req.params.email,receiver:'admin@baillamaach.com'},
        {sender:'admin@baillamaach.com',receiver:req.params.email}
      ]
    }).sort({timestamp:1});
    res.json(msgs);
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.get('/messenger',function(req,res){
  res.send('<!DOCTYPE html>\n'+
'<html lang="en">\n'+
'<head>\n'+
'<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n'+
'<title>Messenger | Baiilla Maach</title>\n'+
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">\n'+
'<style>\n'+
'*{margin:0;padding:0;box-sizing:border-box}\n'+
'body{font-family:"Inter",sans-serif;background:#f8f9fb;height:100vh;overflow:hidden;color:#1f2937}\n'+
'.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}\n'+
'.login-card{background:#fff;padding:35px;border-radius:16px;width:380px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.15)}\n'+
'.login-card h2{font-family:"Outfit",sans-serif;margin-bottom:20px;font-size:1.4em}\n'+
'.login-card input{width:100%;padding:12px;margin-bottom:10px;border:1px solid #e5e7eb;border-radius:10px;font-size:0.95em;outline:none}\n'+
'.login-card input:focus{border-color:#f97316}\n'+
'.login-card button{width:100%;padding:12px;background:#f97316;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:1em}\n'+
'.app{display:none;height:100vh}\n'+
'.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff}\n'+
'.sidebar{width:340px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fff}\n'+
'.sidebar-header{padding:18px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}\n'+
'.sidebar-header h2{font-family:"Outfit",sans-serif;font-size:1.2em}\n'+
'.sidebar-header button{background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.8em}\n'+
'.search-bar{padding:12px 18px}\n'+
'.search-bar input{width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:20px;font-size:0.9em;outline:none;background:#f9fafb}\n'+
'.user-list{flex:1;overflow-y:auto}\n'+
'.user-item{padding:12px 18px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:0.15s}\n'+
'.user-item:hover{background:#f9fafb}\n'+
'.user-item.active{background:#fff7ed;border-left:3px solid #f97316}\n'+
'.user-avatar{width:44px;height:44px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1em;flex-shrink:0;position:relative}\n'+
'.user-avatar .dot{position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff}\n'+
'.user-info{flex:1;min-width:0}\n'+
'.user-info .name{font-weight:600;font-size:0.9em}\n'+
'.user-info .email{font-size:0.78em;color:#9ca3af}\n'+
'.unread{background:#f97316;color:#fff;font-size:0.7em;padding:2px 7px;border-radius:10px;font-weight:700}\n'+
'.chat-area{flex:1;display:flex;flex-direction:column;background:#f8f9fb}\n'+
'.chat-header{padding:16px 20px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}\n'+
'.chat-header .avatar{width:38px;height:38px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9em}\n'+
'.chat-header .name{font-weight:600;font-size:0.95em}\n'+
'.chat-header .status{font-size:0.78em;color:#10b981}\n'+
'.chat-messages{flex:1;overflow-y:auto;padding:18px}\n'+
'.message{max-width:60%;padding:8px 14px;border-radius:16px;margin-bottom:4px;font-size:0.88em}\n'+
'.message.sent{background:#f97316;color:#fff;margin-left:auto;border-bottom-right-radius:4px}\n'+
'.message.received{background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:4px}\n'+
'.message .time{font-size:0.65em;opacity:0.6;margin-top:3px;text-align:right}\n'+
'.date-divider{text-align:center;margin:12px 0;font-size:0.75em;color:#9ca3af}\n'+
'.chat-input{padding:14px 18px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px}\n'+
'.chat-input input{flex:1;padding:10px 16px;border:1px solid #e5e7eb;border-radius:20px;font-size:0.9em;outline:none}\n'+
'.chat-input button{background:#f97316;color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:1em}\n'+
'</style>\n'+
'</head>\n'+
'<body>\n'+
'<div class="login-overlay" id="loginOverlay"><div class="login-card"><h2>Admin Messenger</h2><input type="text" id="loginEmail" placeholder="Email"><input type="password" id="loginPassword" placeholder="Password"><button onclick="doLogin()">Sign In</button></div></div>\n'+
'<div class="app" id="app"><div class="app-layout"><div class="sidebar"><div class="sidebar-header"><h2>Chats</h2><button onclick="logout()">Logout</button></div><div class="search-bar"><input type="text" id="searchInput" placeholder="Search conversations..." oninput="filterUsers()"></div><div class="user-list" id="userList"></div></div><div class="chat-area"><div class="chat-header"><div class="avatar" id="chatAvatar">?</div><div><div class="name" id="chatName">Select user</div><div class="status" id="chatStatus"></div></div></div><div class="chat-messages" id="chatMessages"><div style="text-align:center;color:#9ca3af;padding:40px;">Select a conversation</div></div><div class="chat-input" id="chatInputArea" style="display:none"><input type="text" id="msgInput" placeholder="Type message..." onkeypress="if(event.key===\'Enter\')sendMsg()"><button onclick="sendMsg()">➤</button></div></div></div></div>\n'+
'<script src="/socket.io/socket.io.js"></script>\n'+
'<script>\n'+
'var cu=null,socket=null,allUsers=[];\n'+
'async function doLogin(){var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:document.getElementById("loginEmail").value,password:document.getElementById("loginPassword").value})});if(r.ok){document.getElementById("loginOverlay").style.display="none";document.getElementById("app").style.display="block";init();loadUsers()}else alert("Invalid credentials")}\n'+
'function logout(){if(socket)socket.disconnect();document.getElementById("loginOverlay").style.display="flex";document.getElementById("app").style.display="none";cu=null}\n'+
'function init(){socket=io();socket.emit("register",{name:"Admin",email:"admin@baillamaach.com"});socket.on("newMsg",function(m){if(cu&&(m.sender===cu||m.receiver===cu))appendMsg(m);loadUsers()})}\n'+
'async function loadUsers(){var r=await fetch("/api/admin/users");allUsers=await r.json();renderUsers()}\n'+
'function renderUsers(f){var data=f?allUsers.filter(function(u){return u.name.toLowerCase().includes(f)||u.email.toLowerCase().includes(f)}):allUsers;document.getElementById("userList").innerHTML=data.map(function(u){return "<div class=\"user-item"+(cu===u.email?" active":"")+"\" onclick=\"selectUser(\'"+u.email+"\')\"><div class=\"user-avatar\">"+u.name[0].toUpperCase()+(u.isOnline?"<div class=\"dot\"></div>":"")+"</div><div class=\"user-info\"><div class=\"name\">"+u.name+"</div><div class=\"email\">"+u.email+"</div></div>"+(u.unreadCount>0?"<div class=\"unread\">"+u.unreadCount+"</div>":"")+"</div>"}).join("")}\n'+
'function filterUsers(){renderUsers(document.getElementById("searchInput").value.toLowerCase())}\n'+
'async function selectUser(email){cu=email;document.getElementById("chatInputArea").style.display="flex";var u=allUsers.find(function(u){return u.email===email});document.getElementById("chatAvatar").textContent=u?u.name[0].toUpperCase():"?";document.getElementById("chatName").textContent=u?u.name:email;document.getElementById("chatStatus").textContent=u&&u.isOnline?"● Online":"○ Offline";var r=await fetch("/api/msgs/"+email);var ms=await r.json();var c=document.getElementById("chatMessages");if(ms.length){var h="",ld="";ms.forEach(function(m){var d=new Date(m.timestamp).toLocaleDateString();if(d!==ld){h+="<div class=\"date-divider\">"+d+"</div>";ld=d}h+="<div class=\"message "+(m.sender===email?"received":"sent")+"\">"+m.message+"<div class=\"time\">"+new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"</div></div>"});c.innerHTML=h}else{c.innerHTML="<div style=\"text-align:center;color:#9ca3af;padding:40px;\">No messages</div>"}c.scrollTop=c.scrollHeight;socket.emit("markRead",{user:email});renderUsers()}\n'+
'function appendMsg(m){var c=document.getElementById("chatMessages");c.querySelector("div[style]")?.remove();c.insertAdjacentHTML("beforeend","<div class=\"message "+(m.sender===cu?"received":"sent")+"\">"+m.message+"<div class=\"time\">"+new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"</div></div>");c.scrollTop=c.scrollHeight}\n'+
'function sendMsg(){if(!cu)return;var i=document.getElementById("msgInput");var m=i.value.trim();if(!m)return;socket.emit("sendMsg",{sender:"admin@baillamaach.com",receiver:cu,message:m,type:"text"});i.value=""}\n'+
'</script>\n'+
'</body>\n'+
'</html>');
});

app.post('/api/admin/login',async function(req,res){
  try {
    const user=await User.findOne({email:req.body.email,isAdmin:true});
    if(!user)return res.status(400).json({error:'Invalid credentials'});
    const valid=await bcrypt.compare(req.body.password,user.password);
    if(!valid)return res.status(400).json({error:'Invalid credentials'});
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.get('/api/admin/users',async function(req,res){
  try {
    const users=await User.find({isAdmin:false}).sort({lastSeen:-1}).lean();
    for(var i=0;i<users.length;i++){
      users[i].unreadCount=await Message.countDocuments({
        sender:users[i].email,
        receiver:'admin@baillamaach.com',
        seen:false
      });
    }
    res.json(users);
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

io.on('connection',function(socket){
  socket.on('register',async function(data){
    socket.userData=data;
    var user=await User.findOne({email:data.email});
    if(!user){
      const hash=await bcrypt.hash('default123',10);
      user=await User.create({name:data.name,email:data.email,password:hash});
    }
    await User.updateOne({email:data.email},{$set:{isOnline:true,lastSeen:new Date()}});
    io.emit('userStatus',{email:data.email,online:true});
  });
  
  socket.on('sendMsg',async function(data){
    try {
      const msg=await Message.create({
        sender:data.sender,
        receiver:data.receiver,
        message:data.message,
        type:data.type||'text'
      });
      io.emit('newMsg',msg);
    } catch(e) {
      console.error('Message error:',e);
    }
  });
  
  socket.on('markRead',async function(data){
    await Message.updateMany(
      {sender:data.user,receiver:'admin@baillamaach.com',seen:false},
      {$set:{seen:true}}
    );
  });
  
  socket.on('disconnect',async function(){
    if(socket.userData){
      await User.updateOne(
        {email:socket.userData.email},
        {$set:{isOnline:false,lastSeen:new Date()}}
      );
      io.emit('userStatus',{email:socket.userData.email,online:false});
    }
  });
});

server.listen(PORT,function(){console.log('Server running on port '+PORT)});

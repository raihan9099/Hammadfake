require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

app.use(express.json());
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

['uploads', 'assets/covermusic'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
  lastSeen: Date,
  isOnline: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  type: { type: String, default: 'text' },
  fileUrl: String,
  seen: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    
    const adminExists = await User.findOne({ email: 'admin', isAdmin: true });
    if (adminExists) {
      const hash = await bcrypt.hash('admin123', 10);
      await User.updateOne({ email: 'admin' }, { $set: { password: hash, name: 'Admin', isAdmin: true } });
      console.log('✅ Admin updated');
    } else {
      const hash = await bcrypt.hash('admin123', 10);
      await User.create({ name: 'Admin', email: 'admin', password: hash, isAdmin: true });
      console.log('✅ Admin created');
    }
    
    const totalUsers = await User.countDocuments({ isAdmin: false });
    const totalMsgs = await Message.countDocuments({});
    console.log('📊 Total users:', totalUsers);
    console.log('📊 Total messages:', totalMsgs);
  })
  .catch(e => console.error('❌ MongoDB Error:', e.message));

const ASSETS = {
  profile: "/assets/celebrity_pfp.jpeg",
  fbProfile: "/assets/fb_profile.jpg",
  blueTikTok: "/assets/bluetick_tiktok.png",
  blueFB: "/assets/blue_tick_fb.png",
  logoFB: "/assets/logo_fb.png",
  logoTikTok: "/assets/logo_tiktok.png",
  microphone: "/assets/microphone-in-hand.gif",
  realId: "/assets/real-id-ss.png",
  fakeDetect: "/assets/Fakedetect_updown.png",
  baillamachFake: "/assets/baillamach_fake.png",
  hammadFake: "/assets/hammadfams.png"
};

const WELCOME_VOICE = fs.existsSync('assets/realvoice.mp3');
const MANUAL_VOICE = fs.existsSync('assets/manualvoice_alert.mp3');

function getSongs() {
  try {
    const dir = 'assets/covermusic';
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.mp3'))
      .map((f, i) => ({
        id: i,
        title: f.replace('.mp3', '').replace(/[-_]/g, ' '),
        url: '/assets/covermusic/' + encodeURIComponent(f)
      }));
  } catch (e) { return []; }
}

// ==================== MAIN PAGE ====================
app.get('/', (req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);
  
  let songsListHTML = '';
  songs.forEach((s, i) => {
    songsListHTML += '<div class="song-item" onclick="playMusic(' + i + ')" id="song-' + i + '">' +
      '<span class="song-num">' + String(i+1).padStart(2,'0') + '</span>' +
      '<div class="song-info"><div class="song-title">' + s.title + '</div><div class="song-artist">Baiilla Maach</div></div>' +
      '</div>';
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = '<div class="card"><div class="card-header"><span class="badge badge-blue">VOICE</span>' +
      '<h3>Voice Verification</h3><p>Listen to authentic voice</p></div>' +
      '<div class="card-body"><div class="btn-group">' +
      (WELCOME_VOICE ? '<button class="btn btn-blue" onclick="playWelcomeVoice()">🎤 Real Voice</button>' : '') +
      (MANUAL_VOICE ? '<button class="btn btn-red" onclick="playManualVoice()">🚨 Fake Alert</button>' : '') +
      '</div></div></div>';
  }

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Baiilla Maach Official | Hammad Bin Amir</title>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
  '<style>' +
  '*{margin:0;padding:0;box-sizing:border-box}' +
  'body{font-family:Inter,sans-serif;background:#f0f2f5;color:#1c1e21;line-height:1.5}' +
  'a{text-decoration:none}img{max-width:100%}' +
  '.header{position:sticky;top:0;z-index:100;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:0 20px;height:60px;display:flex;align-items:center;justify-content:space-between}' +
  '.header-left{display:flex;align-items:center;gap:10px}' +
  '.header-logo{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #e4e6eb}' +
  '.header-name{font-weight:700;font-size:1.2em;color:#1877f2}' +
  '.header-btn{background:#1877f2;color:#fff;padding:8px 20px;border-radius:20px;font-weight:600;font-size:0.9em;cursor:pointer;transition:0.2s}' +
  '.header-btn:hover{background:#166fe5}' +
  '.container{max-width:680px;margin:16px auto;padding:0 16px}' +
  '.card{background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.1);margin-bottom:16px;overflow:hidden}' +
  '.card-header{padding:16px;border-bottom:1px solid #e4e6eb}' +
  '.card-body{padding:16px}' +
  '.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}' +
  '.badge-blue{background:#e7f3ff;color:#1877f2}' +
  '.badge-red{background:#fce4e4;color:#e41e3f}' +
  '.badge-green{background:#e6f7e6;color:#10b981}' +
  'h3{font-size:1.2em;font-weight:700;margin-bottom:4px}' +
  'p{color:#65676b;font-size:0.9em}' +
  '.profile-card{text-align:center;padding:0}' +
  '.profile-cover{height:180px;background:linear-gradient(135deg,#1877f2,#8b5cf6,#ec4899);border-radius:8px 8px 0 0}' +
  '.profile-avatar-wrap{margin-top:-60px;position:relative;display:inline-block}' +
  '.profile-avatar{width:120px;height:120px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.15)}' +
  '.verified-badge{position:absolute;bottom:8px;right:8px;background:#1877f2;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff}' +
  '.verified-badge svg{width:12px;height:12px;fill:#fff}' +
  '.profile-name{font-size:1.5em;font-weight:800;margin-top:8px}' +
  '.profile-username{color:#65676b;font-size:0.95em;margin-bottom:4px}' +
  '.profile-bio{color:#65676b;font-size:0.85em;margin-bottom:12px}' +
  '.stats-row{display:flex;justify-content:center;gap:40px;padding:12px 0;border-top:1px solid #e4e6eb;border-bottom:1px solid #e4e6eb;margin-bottom:12px}' +
  '.stat{text-align:center}' +
  '.stat-num{font-size:1.1em;font-weight:700}' +
  '.stat-label{font-size:0.75em;color:#65676b}' +
  '.btn-group{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:12px 0}' +
  '.btn{padding:8px 16px;border-radius:6px;font-weight:600;font-size:0.9em;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:6px;transition:0.2s}' +
  '.btn-blue{background:#1877f2;color:#fff}.btn-blue:hover{background:#166fe5}' +
  '.btn-gray{background:#e4e6eb;color:#1c1e21}.btn-gray:hover{background:#d8dadf}' +
  '.btn-red{background:#e41e3f;color:#fff}.btn-red:hover{background:#c81a35}' +
  '.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
  '@media(max-width:600px){.grid-2{grid-template-columns:1fr}}' +
  '.verified-item{display:flex;align-items:center;gap:10px;padding:12px;background:#f0f2f5;border-radius:8px;margin-bottom:8px}' +
  '.verified-item .v-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover}' +
  '.verified-item .v-info h4{font-weight:600;font-size:0.95em;display:flex;align-items:center;gap:4px}' +
  '.verified-item .v-info h4 img{width:16px;height:16px}' +
  '.verified-item .v-info .v-handle{font-size:0.8em;color:#65676b}' +
  '.verified-item .v-info .v-detail{font-size:0.8em;color:#1c1e21;margin-top:2px}' +
  '.fake-card{border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin-bottom:8px}' +
  '.fake-img-wrap{position:relative;text-align:center;padding:12px;background:#fafafa}' +
  '.fake-img{max-width:100%;border-radius:4px}' +
  '.fake-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:70px;height:70px;animation:bounce 2s infinite}' +
  '@keyframes bounce{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-14px)}}' +
  '.fake-body{padding:12px}' +
  '.fake-body h4{font-weight:600;font-size:0.95em}' +
  '.fake-body .platform{color:#f59e0b;font-weight:600;font-size:0.8em;margin:2px 0}' +
  '.fake-body p{font-size:0.8em;color:#65676b;margin-bottom:8px}' +
  '.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
  '@media(max-width:600px){.proof-grid{grid-template-columns:1fr}}' +
  '.proof-item{background:#f0f2f5;border-radius:8px;padding:10px;text-align:center}' +
  '.proof-item img{width:100%;border-radius:4px;margin-bottom:6px}' +
  '.proof-item .label{font-weight:600;font-size:0.8em}' +
  '.music-section{padding:16px}' +
  '.music-header{display:flex;align-items:center;gap:12px;padding:12px;background:#f0f2f5;border-radius:8px;margin-bottom:12px}' +
  '.music-info{flex:1;min-width:0}' +
  '.music-title{font-weight:600;font-size:0.95em}' +
  '.music-artist{font-size:0.8em;color:#65676b}' +
  '.music-slider{width:100%;height:4px;background:#e4e6eb;border-radius:2px;cursor:pointer;margin:8px 0}' +
  '.music-slider-fill{height:100%;background:#1877f2;border-radius:2px;width:0}' +
  '.music-time-row{display:flex;justify-content:space-between;font-size:0.75em;color:#65676b;margin-bottom:8px}' +
  '.music-controls{display:flex;align-items:center;justify-content:center;gap:12px}' +
  '.music-btn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-size:1em;display:flex;align-items:center;justify-content:center}' +
  '.music-btn-nav{background:#e4e6eb;color:#1c1e21}' +
  '.music-btn-play{background:#1877f2;color:#fff;width:48px;height:48px;font-size:1.2em}' +
  '.music-list{max-height:200px;overflow-y:auto;border-top:1px solid #e4e6eb;margin-top:12px;padding-top:8px}' +
  '.song-item{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;border-radius:6px;transition:0.15s}' +
  '.song-item:hover{background:#f0f2f5}' +
  '.song-item.active{background:#e7f3ff}' +
  '.song-num{font-weight:700;color:#65676b;min-width:22px;font-size:0.85em}' +
  '.song-info{flex:1;min-width:0}' +
  '.song-title{font-weight:500;font-size:0.85em}' +
  '.song-artist{font-size:0.75em;color:#65676b}' +
  '.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}' +
  '.chat-toggle{width:50px;height:50px;border-radius:50%;background:#1877f2;color:#fff;border:none;font-size:1.3em;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2)}' +
  '.chat-toggle:hover{background:#166fe5;transform:scale(1.05)}' +
  '.chat-panel{display:none;position:fixed;bottom:80px;right:20px;width:340px;height:450px;background:#fff;border-radius:8px;box-shadow:0 5px 25px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;z-index:9999}' +
  '.chat-panel.open{display:flex}' +
  '.chat-head{padding:10px 14px;border-bottom:1px solid #e4e6eb;display:flex;justify-content:space-between;align-items:center;font-weight:600}' +
  '.chat-head button{background:none;border:none;font-size:1.2em;cursor:pointer;color:#65676b}' +
  '.chat-body{flex:1;overflow-y:auto;padding:10px;background:#f0f2f5}' +
  '.chat-login{text-align:center;padding:20px}' +
  '.chat-login input{width:100%;padding:10px;margin-bottom:8px;border:1px solid #ccd0d5;border-radius:6px;font-size:0.9em;outline:none}' +
  '.chat-login input:focus{border-color:#1877f2}' +
  '.chat-login button{width:100%;padding:10px;background:#1877f2;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer}' +
  '.chat-input-area{padding:10px;border-top:1px solid #e4e6eb;display:none;background:#fff}' +
  '.chat-input-row{display:flex;align-items:center;gap:6px}' +
  '.chat-input-row input{flex:1;padding:8px 12px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.9em;outline:none}' +
  '.chat-input-row input:focus{border-color:#1877f2}' +
  '.chat-input-row button{background:#1877f2;color:#fff;border:none;width:34px;height:34px;border-radius:50%;cursor:pointer}' +
  '.msg{max-width:75%;padding:7px 10px;border-radius:18px;margin-bottom:4px;font-size:0.85em}' +
  '.msg.user{background:#1877f2;color:#fff;margin-left:auto;border-bottom-right-radius:4px}' +
  '.msg.admin{background:#e4e6eb;color:#1c1e21;border-bottom-left-radius:4px}' +
  '.msg .time{font-size:0.7em;opacity:0.7;margin-top:2px;text-align:right}' +
  '@media(max-width:480px){.chat-panel{width:100%;right:0;bottom:60px;border-radius:0}}' +
  '</style></head><body>' +
  
  '<header class="header">' +
  '<div class="header-left"><img src="' + ASSETS.profile + '" class="header-logo" onerror="this.style.display=\'none\'"><span class="header-name">Baiilla Maach</span></div>' +
  '<a href="/messenger" class="header-btn">💬 Support Chat</a>' +
  '</header>' +
  
  '<div class="container">' +
  
  '<div class="card profile-card">' +
  '<div class="profile-cover"></div>' +
  '<div class="profile-avatar-wrap"><img src="' + ASSETS.profile + '" class="profile-avatar" onerror="this.style.display=\'none\'">' +
  '<div class="verified-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div></div>' +
  '<h2 class="profile-name">Hammad Bin Amir</h2>' +
  '<div class="profile-username">@baiillamaach_official</div>' +
  '<div class="profile-bio">Official Entertainment Profile · Verified Creator</div>' +
  '<div class="stats-row">' +
  '<div class="stat"><div class="stat-num">7K</div><div class="stat-label">Followers</div></div>' +
  '<div class="stat"><div class="stat-num">0</div><div class="stat-label">Following</div></div>' +
  '<div class="stat"><div class="stat-num">190K</div><div class="stat-label">Likes</div></div>' +
  '</div>' +
  '<div class="btn-group">' +
  '<a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue"><img src="' + ASSETS.logoTikTok + '" width="20"> Follow TikTok</a>' +
  '<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-blue"><img src="' + ASSETS.logoFB + '" width="20"> Follow Facebook</a>' +
  '</div>' +
  '</div>' +
  
  '<div class="card"><div class="card-header"><span class="badge badge-green">OFFICIAL</span><h3>Verified Accounts</h3><p>The only authentic accounts</p></div><div class="card-body"><div class="grid-2">' +
  '<div class="verified-item"><img src="' + ASSETS.profile + '" class="v-avatar"><div class="v-info"><h4>TikTok <img src="' + ASSETS.blueTikTok + '"></h4><div class="v-handle">@baiillamaach_official</div><div class="v-detail">✓ Active · <strong>7K</strong> Followers · <strong>190K</strong> Likes</div><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue" style="margin-top:6px;padding:5px 12px;font-size:0.8em">Follow</a></div></div>' +
  '<div class="verified-item"><img src="' + ASSETS.fbProfile + '" class="v-avatar"><div class="v-info"><h4>Facebook <img src="' + ASSETS.blueFB + '"></h4><div class="v-handle">@BaiillaMaachOfficial</div><div class="v-detail">✓ Active · Official Page</div><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-blue" style="margin-top:6px;padding:5px 12px;font-size:0.8em">Follow</a></div></div>' +
  '</div></div></div>' +
  
  '<div class="card"><div class="card-header"><span class="badge badge-red">WARNING</span><h3>Fake Accounts Detected</h3><p>Report these accounts</p></div><div class="card-body"><div class="grid-2">' +
  '<div class="fake-card"><div class="fake-img-wrap"><img src="' + ASSETS.baillamachFake + '" class="fake-img"><img src="' + ASSETS.fakeDetect + '" class="fake-overlay"></div><div class="fake-body"><h4>@baiilla_mach</h4><div class="platform">📍 TikTok</div><p>Copies official content to deceive.</p><a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-red" style="padding:5px 12px;font-size:0.8em">🚨 Report</a></div></div>' +
  '<div class="fake-card"><div class="fake-img-wrap"><img src="' + ASSETS.hammadFake + '" class="fake-img"><img src="' + ASSETS.fakeDetect + '" class="fake-overlay"></div><div class="fake-body"><h4>@hammad_fams0</h4><div class="platform">📍 TikTok</div><p>Impersonating with fake content.</p><a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-red" style="padding:5px 12px;font-size:0.8em">🚨 Report</a></div></div>' +
  '</div></div></div>' +
  
  '<div class="card"><div class="card-header"><span class="badge badge-blue">PROOF</span><h3>Identity Verification</h3></div><div class="card-body"><div class="proof-grid">' +
  '<div class="proof-item"><img src="' + ASSETS.realId + '"><div class="label">Real ID Verified</div></div>' +
  '<div class="proof-item"><img src="' + ASSETS.microphone + '"><div class="label">Voice Recording</div></div>' +
  '<div class="proof-item"><img src="' + ASSETS.fakeDetect + '"><div class="label">Fake Detection</div></div>' +
  '</div></div></div>' +
  
  voiceHTML +
  
  (songs.length > 0 ? '<div class="card"><div class="card-header"><span class="badge badge-blue">MUSIC</span><h3>Cover Songs</h3></div><div class="music-section">' +
  '<div class="music-header"><div class="music-info"><div class="music-title" id="mTitle">Select Song</div><div class="music-artist">Baiilla Maach</div></div></div>' +
  '<div class="music-slider" onclick="seekMusic(event)"><div class="music-slider-fill" id="mSliderFill"></div></div>' +
  '<div class="music-time-row"><span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span></div>' +
  '<div class="music-controls"><button class="music-btn music-btn-nav" onclick="prevMusic()">⏮</button><button class="music-btn music-btn-play" id="mPlayBtn" onclick="toggleMusic()">▶</button><button class="music-btn music-btn-nav" onclick="nextMusic()">⏭</button></div>' +
  '<div class="music-list">' + songsListHTML + '</div>' +
  '</div></div>' : '') +
  
  '</div>' +
  
  '<div class="chat-widget"><button class="chat-toggle" onclick="toggleChat()">💬</button></div>' +
  '<div class="chat-panel" id="chatPanel">' +
  '<div class="chat-head">💬 Chat Support<button onclick="toggleChat()">✕</button></div>' +
  '<div class="chat-body" id="chatBody">' +
  '<div class="chat-login" id="chatLoginForm">' +
  '<h4 style="margin-bottom:8px">Start Chat</h4>' +
  '<input type="text" id="chatNameInput" placeholder="Your Name">' +
  '<input type="text" id="chatEmailInput" placeholder="Email or Phone">' +
  '<button onclick="startChatSession()">Start Chatting</button>' +
  '</div></div>' +
  '<div class="chat-input-area" id="chatInputArea">' +
  '<div class="chat-input-row"><input type="text" id="chatMsgInput" placeholder="Type message..." onkeypress="if(event.key===\'Enter\')sendChatMsg()"><button onclick="sendChatMsg()">➤</button></div>' +
  '</div></div>' +
  
  (WELCOME_VOICE ? '<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>' : '') +
  (MANUAL_VOICE ? '<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>' : '') +
  '<audio id="musicAudio" preload="auto"></audio>' +
  
  '<script src="/socket.io/socket.io.js"></script>' +
  '<script>' +
  'var welcomeAudio=document.getElementById("welcomeAudio");' +
  'var manualAudio=document.getElementById("manualAudio");' +
  'var musicAudio=document.getElementById("musicAudio");' +
  'function stopAllAudio(){if(welcomeAudio){welcomeAudio.pause();welcomeAudio.currentTime=0}if(manualAudio){manualAudio.pause();manualAudio.currentTime=0}if(musicAudio){musicAudio.pause()}musicPlaying=false;updatePlayBtn()}' +
  'function playWelcomeVoice(){if(!welcomeAudio)return;stopAllAudio();welcomeAudio.play()}' +
  'function playManualVoice(){if(!manualAudio)return;stopAllAudio();manualAudio.play()}' +
  'var tracks=' + songsJSON + ';' +
  'var currentTrack=0,musicPlaying=false;' +
  'function updatePlayBtn(){var b=document.getElementById("mPlayBtn");if(b)b.innerHTML=musicPlaying?"⏸":"▶"}' +
  'function updateMusicUI(i){document.getElementById("mTitle").textContent=tracks[i].title;var items=document.querySelectorAll(".song-item");for(var j=0;j<items.length;j++){if(j===i)items[j].classList.add("active");else items[j].classList.remove("active")}}' +
  'function playMusic(i){if(!tracks.length)return;stopAllAudio();currentTrack=i;musicAudio.src=tracks[i].url;musicAudio.play();musicPlaying=true;updatePlayBtn();updateMusicUI(i)}' +
  'function toggleMusic(){if(musicAudio.paused){if(!musicAudio.src&&tracks.length)musicAudio.src=tracks[0].url;stopAllAudio();musicAudio.play();musicPlaying=true;updatePlayBtn();updateMusicUI(currentTrack)}else{musicAudio.pause();musicPlaying=false;updatePlayBtn()}}' +
  'function prevMusic(){playMusic((currentTrack-1+tracks.length)%tracks.length)}' +
  'function nextMusic(){playMusic((currentTrack+1)%tracks.length)}' +
  'function seekMusic(e){if(!musicAudio.duration)return;var r=e.currentTarget.getBoundingClientRect();musicAudio.currentTime=((e.clientX-r.left)/r.width)*musicAudio.duration}' +
  'musicAudio.addEventListener("timeupdate",function(){if(musicAudio.duration){document.getElementById("mSliderFill").style.width=(musicAudio.currentTime/musicAudio.duration)*100+"%";document.getElementById("mCurrentTime").textContent=formatTime(musicAudio.currentTime);document.getElementById("mDuration").textContent=formatTime(musicAudio.duration)}});' +
  'musicAudio.addEventListener("ended",nextMusic);' +
  'function formatTime(s){if(isNaN(s))return"0:00";var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+String(sec).padStart(2,"0")}' +
  'if(welcomeAudio)setTimeout(function(){welcomeAudio.play()},1500);' +
  
  // FIXED CHAT SCRIPT
  'var socket=io({transports:["websocket","polling"]});var chatUser=null;' +
  'function toggleChat(){document.getElementById("chatPanel").classList.toggle("open")}' +
  'function startChatSession(){var n=document.getElementById("chatNameInput").value.trim();var e=document.getElementById("chatEmailInput").value.trim();if(!n||!e)return;chatUser={name:n,email:e};' +
  'socket.emit("register",{name:n,email:e});' +
  'document.getElementById("chatLoginForm").style.display="none";' +
  'document.getElementById("chatInputArea").style.display="block";' +
  'loadChatMessages()}' +
  
  'async function loadChatMessages(){if(!chatUser)return;' +
  'try{var r=await fetch("/api/msgs/"+encodeURIComponent(chatUser.email));' +
  'if(!r.ok){console.error("Failed to load messages");return}' +
  'var ms=await r.json();' +
  'var b=document.getElementById("chatBody");' +
  'b.innerHTML="";' +
  'if(ms.length===0){b.innerHTML="<div style=\\"text-align:center;padding:20px;color:#65676b\\">No messages yet. Start chatting!</div>"}' +
  'else{for(var i=0;i<ms.length;i++){var m=ms[i];var cls=(m.sender===chatUser.email?"user":"admin");' +
  'b.innerHTML+="<div class=\\"msg "+cls+"\\">"+m.message+"<div class=\\"time\\">"+new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"</div></div>"}' +
  'b.scrollTop=b.scrollHeight}}catch(e){console.error("Error loading messages:",e)}}' +
  
  'function sendChatMsg(){var i=document.getElementById("chatMsgInput");var m=i.value.trim();if(!m||!chatUser)return;' +
  'socket.emit("sendMsg",{sender:chatUser.email,receiver:"admin",message:m,type:"text"});i.value=""}' +
  
  'socket.on("newMsg",function(m){if(chatUser&&(m.sender===chatUser.email||m.receiver===chatUser.email)){' +
  'var b=document.getElementById("chatBody");' +
  'var cls=(m.sender===chatUser.email?"user":"admin");' +
  'b.innerHTML+="<div class=\\"msg "+cls+"\\">"+m.message+"<div class=\\"time\\">"+new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"</div></div>";' +
  'b.scrollTop=b.scrollHeight}});' +
  '</script></body></html>';
  
  res.send(html);
});

// ==================== API ROUTES ====================

app.get('/api/msgs/:email', async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { sender: req.params.email, receiver: 'admin' },
        { sender: 'admin', receiver: req.params.email }
      ]
    }).sort({ timestamp: 1 }).lean();
    res.json(msgs);
  } catch (err) { 
    console.error('Error /api/msgs:', err.message);
    res.json([]); 
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isAdmin: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({ isAdmin: { $ne: true } })
      .sort({ lastSeen: -1 })
      .lean();
    
    for (let u of users) {
      u.unreadCount = await Message.countDocuments({ 
        sender: u.email, 
        receiver: 'admin', 
        seen: false 
      });
    }
    
    res.json(users);
  } catch (err) { 
    console.error('Error /api/admin/users:', err.message);
    res.json([]); 
  }
});

// ==================== ADMIN MESSENGER PAGE ====================
app.get('/messenger', (req, res) => {
  res.send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
  '<title>Admin Messenger | Baiilla Maach</title>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">' +
  '<style>' +
  '*{margin:0;padding:0;box-sizing:border-box}' +
  'body{font-family:Inter,sans-serif;background:#f0f2f5;height:100vh;overflow:hidden;color:#1c1e21;font-size:15px;touch-action:manipulation}' +
  '.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}' +
  '.login-card{background:#fff;padding:30px;border-radius:12px;width:100%;max-width:380px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2)}' +
  '.login-card h2{font-weight:700;margin-bottom:4px;font-size:1.3em}' +
  '.login-card .sub{color:#65676b;font-size:0.9em;margin-bottom:20px}' +
  '.login-card input{width:100%;padding:12px;margin-bottom:10px;border:1px solid #ccd0d5;border-radius:8px;font-size:0.95em;outline:none;-webkit-appearance:none}' +
  '.login-card input:focus{border-color:#1877f2}' +
  '.login-card button{width:100%;padding:12px;background:#1877f2;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1em;-webkit-appearance:none}' +
  '.login-card button:active{background:#166fe5}' +
  '.login-card button:disabled{opacity:0.6}' +
  '.error{color:#e41e3f;font-size:0.85em;margin-top:8px;display:none}' +
  '.app{display:none;height:100vh;flex-direction:column}' +
  '@media(min-width:768px){.app{flex-direction:row}}' +
  '.sidebar{width:100%;background:#fff;display:flex;flex-direction:column;border-right:1px solid #e4e6eb;flex-shrink:0}' +
  '@media(min-width:768px){.sidebar{width:320px;height:100vh}}' +
  '.sidebar-head{padding:14px;border-bottom:1px solid #e4e6eb;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}' +
  '.sidebar-head h2{font-size:1.1em;font-weight:700}' +
  '.sidebar-head button{background:none;border:none;color:#1877f2;font-weight:600;cursor:pointer;font-size:0.9em;padding:8px}' +
  '.search-box{padding:10px 14px;border-bottom:1px solid #e4e6eb;flex-shrink:0}' +
  '.search-box input{width:100%;padding:8px 12px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.9em;outline:none;-webkit-appearance:none}' +
  '.search-box input:focus{border-color:#1877f2}' +
  '.user-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:40vh}' +
  '@media(min-width:768px){.user-list{max-height:none}}' +
  '.user-item{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #f0f2f5;transition:0.15s;-webkit-tap-highlight-color:transparent}' +
  '.user-item:active{background:#f0f2f5}' +
  '.user-item.active{background:#e7f3ff}' +
  '.user-avatar{width:42px;height:42px;border-radius:50%;background:#1877f2;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;font-size:1.1em}' +
  '.user-info{flex:1;min-width:0}' +
  '.user-info .name{font-weight:600;font-size:0.9em}' +
  '.user-info .email{font-size:0.8em;color:#65676b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.unread{background:#1877f2;color:#fff;font-size:0.7em;padding:3px 8px;border-radius:10px;font-weight:600;flex-shrink:0}' +
  '.chat-area{flex:1;display:flex;flex-direction:column;background:#fff;min-height:0}' +
  '@media(max-width:767px){.chat-area{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;display:none}.chat-area.active{display:flex}}' +
  '.chat-head{padding:12px 14px;border-bottom:1px solid #e4e6eb;display:flex;align-items:center;gap:10px;background:#f0f2f5;flex-shrink:0}' +
  '.back-btn{display:none;background:none;border:none;font-size:1.3em;cursor:pointer;padding:4px 8px;color:#1877f2}' +
  '@media(max-width:767px){.back-btn{display:block}}' +
  '.chat-head .avatar{width:36px;height:36px;border-radius:50%;background:#1877f2;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9em;flex-shrink:0}' +
  '.chat-head .name{font-weight:600;font-size:0.95em}' +
  '.chat-head .status{font-size:0.8em}' +
  '.chat-head .status.online{color:#10b981}' +
  '.chat-head .status.offline{color:#65676b}' +
  '.chat-msgs{flex:1;overflow-y:auto;padding:14px;background:#f0f2f5;-webkit-overflow-scrolling:touch}' +
  '.msg{max-width:80%;padding:8px 12px;border-radius:18px;margin-bottom:6px;font-size:0.85em;word-wrap:break-word}' +
  '.msg.sent{background:#1877f2;color:#fff;margin-left:auto;border-bottom-right-radius:4px}' +
  '.msg.received{background:#e4e6eb;color:#1c1e21;border-bottom-left-radius:4px}' +
  '.msg .time{font-size:0.7em;opacity:0.7;margin-top:2px;text-align:right}' +
  '.chat-input{padding:10px 14px;border-top:1px solid #e4e6eb;display:none;background:#fff;flex-shrink:0}' +
  '.chat-input-row{display:flex;align-items:center;gap:8px}' +
  '.chat-input-row input{flex:1;padding:10px 14px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.95em;outline:none;-webkit-appearance:none}' +
  '.chat-input-row input:focus{border-color:#1877f2}' +
  '.chat-input-row button{background:#1877f2;color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;flex-shrink:0;font-size:1.1em;-webkit-appearance:none}' +
  '.chat-input-row button:active{background:#166fe5}' +
  '.empty-state{text-align:center;color:#65676b;padding:60px 20px}' +
  '.empty-state h3{font-weight:600;margin-bottom:8px}' +
  '.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.85em;z-index:9999;opacity:0;transition:opacity 0.3s}' +
  '.toast.show{opacity:1}' +
  '</style></head><body>' +
  
  '<div class="login-overlay" id="loginOverlay"><div class="login-card">' +
  '<h2>🔐 Admin Messenger</h2><p class="sub">Baiilla Maach Support Panel</p>' +
  '<input type="text" id="loginEmail" placeholder="Username" value="admin" autocomplete="username">' +
  '<input type="password" id="loginPassword" placeholder="Password" value="admin123" autocomplete="current-password">' +
  '<button id="loginBtn" onclick="doLogin()">Sign In</button>' +
  '<div class="error" id="loginError"></div></div></div>' +
  
  '<div class="app" id="app">' +
  '<div class="sidebar" id="sidebar"><div class="sidebar-head"><h2>💬 Conversations</h2><button onclick="doLogout()">Logout</button></div>' +
  '<div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div>' +
  '<div class="user-list" id="userList"><div class="empty-state"><p>Loading...</p></div></div></div>' +
  
  '<div class="chat-area" id="chatArea"><div class="chat-head"><button class="back-btn" onclick="goBack()">←</button>' +
  '<div class="avatar" id="chatAvatar">?</div>' +
  '<div><div class="name" id="chatName">Select a user</div><div class="status offline" id="chatStatus">● Offline</div></div></div>' +
  '<div class="chat-msgs" id="chatMessages"><div class="empty-state"><h3>No conversation</h3><p>Select a user to start chatting</p></div></div>' +
  '<div class="chat-input" id="chatInputArea"><div class="chat-input-row">' +
  '<input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key===\'Enter\')sendMessage()">' +
  '<button onclick="sendMessage()">➤</button></div></div></div>' +
  '</div>' +
  
  '<div class="toast" id="toast"></div>' +
  
  '<script src="/socket.io/socket.io.js"></script>' +
  '<script>' +
  'var socket=io({transports:["websocket","polling"]});' +
  'var currentUser=null,allUsers=[],isLoggedIn=false,refreshInterval=null;' +
  
  'function showToast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2000)}' +
  
  'socket.on("connect",function(){console.log("Socket connected")});' +
  'socket.on("connect_error",function(e){console.error("Socket error:",e);showToast("Connection error")});' +
  'socket.on("newMsg",function(m){console.log("New msg:",m);if(currentUser&&((m.sender===currentUser.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===currentUser.email))){appendMessage(m)}loadUsers()});' +
  'socket.on("userStatus",function(d){if(currentUser&&currentUser.email===d.email){var s=document.getElementById("chatStatus");s.textContent=d.online?"● Online":"● Offline";s.className="status "+(d.online?"online":"offline")}loadUsers()});' +
  
  'async function doLogin(){var e=document.getElementById("loginEmail").value.trim();var p=document.getElementById("loginPassword").value.trim();var err=document.getElementById("loginError");var btn=document.getElementById("loginBtn");err.style.display="none";if(!e||!p){err.textContent="Fill all fields";err.style.display="block";return}btn.disabled=true;btn.textContent="Signing...";' +
  'try{var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});var d=await r.json();' +
  'if(r.ok){isLoggedIn=true;localStorage.setItem("adminSession",JSON.stringify({email:e,password:p}));document.getElementById("loginOverlay").style.display="none";document.getElementById("app").style.display="flex";await loadUsers();refreshInterval=setInterval(function(){if(isLoggedIn)loadUsers()},10000)}' +
  'else{err.textContent="❌ Invalid credentials";err.style.display="block"}}catch(ex){err.textContent="❌ Network error";err.style.display="block";console.error(ex)}btn.disabled=false;btn.textContent="Sign In"}' +
  
  'async function loadUsers(){if(!isLoggedIn)return;try{console.log("Loading users...");var r=await fetch("/api/admin/users");if(!r.ok)throw new Error("HTTP "+r.status);var data=await r.json();console.log("Got users:",data.length);allUsers=data;renderUserList()}catch(e){console.error("Load users error:",e);showToast("Failed to load users")}}' +
  
  'function renderUserList(){var s=document.getElementById("searchInput").value.toLowerCase();var f=allUsers.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)});' +
  'var h="";for(var i=0;i<f.length;i++){var u=f[i];var a=currentUser&&currentUser.email===u.email;' +
  'h+="<div class=\\"user-item"+(a?" active":"")+"\\" onclick=\\"selectUser(\'"+u.email+"\')\\"><div class=\\"user-avatar\\">"+u.name.charAt(0).toUpperCase()+"</div><div class=\\"user-info\\"><div class=\\"name\\">"+u.name+"</div><div class=\\"email\\">"+u.email+"</div></div>"+(u.unreadCount>0?"<div class=\\"unread\\">"+u.unreadCount+"</div>":"")+"</div>"}' +
  'document.getElementById("userList").innerHTML=h||"<div class=\\"empty-state\\"><p>No users yet</p></div>"}' +
  
  'function filterUsers(){renderUserList()}' +
  
  'async function selectUser(e){var u=allUsers.find(function(u){return u.email===e});if(!u){console.log("User not found:",e);return}currentUser=u;' +
  'document.getElementById("chatAvatar").textContent=u.name.charAt(0).toUpperCase();document.getElementById("chatName").textContent=u.name;' +
  'document.getElementById("chatStatus").textContent=u.isOnline?"● Online":"● Offline";' +
  'document.getElementById("chatStatus").className="status "+(u.isOnline?"online":"offline");' +
  'document.getElementById("chatInputArea").style.display="block";' +
  'document.getElementById("chatArea").classList.add("active");' +
  'if(window.innerWidth<768)document.getElementById("sidebar").style.display="none";' +
  
  'try{console.log("Loading msgs for:",u.email);var r=await fetch("/api/msgs/"+encodeURIComponent(u.email));if(!r.ok)throw new Error("HTTP "+r.status);var ms=await r.json();console.log("Got msgs:",ms.length);' +
  'var h="";if(ms.length===0){h="<div class=\\"empty-state\\"><h3>No messages</h3></div>"}else{' +
  'for(var i=0;i<ms.length;i++){var m=ms[i];var s=m.sender==="admin";var t=new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});' +
  'h+="<div class=\\"msg "+(s?"sent":"received")+"\\">"+m.message+"<div class=\\"time\\">"+t+"</div></div>"}}' +
  'document.getElementById("chatMessages").innerHTML=h;document.getElementById("chatMessages").scrollTop=99999;' +
  '}catch(ex){console.error("Msg load error:",ex);showToast("Failed to load messages")}' +
  
  'socket.emit("markRead",{user:u.email});renderUserList()}' +
  
  'function appendMessage(m){if(!currentUser)return;var c=document.getElementById("chatMessages");var s=m.sender==="admin";var t=new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});c.innerHTML+="<div class=\\"msg "+(s?"sent":"received")+"\\">"+m.message+"<div class=\\"time\\">"+t+"</div></div>";c.scrollTop=99999}' +
  
  'function sendMessage(){if(!currentUser){showToast("Select a user first");return}var i=document.getElementById("msgInput");var m=i.value.trim();if(!m)return;' +
  'socket.emit("sendMsg",{sender:"admin",receiver:currentUser.email,message:m,type:"text"});' +
  'appendMessage({sender:"admin",receiver:currentUser.email,message:m,timestamp:new Date()});i.value="";i.focus()}' +
  
  'function goBack(){document.getElementById("chatArea").classList.remove("active");document.getElementById("sidebar").style.display="flex";currentUser=null;' +
  'document.getElementById("chatMessages").innerHTML="<div class=\\"empty-state\\"><h3>No conversation</h3><p>Select a user to start chatting</p></div>";' +
  'document.getElementById("chatInputArea").style.display="none";renderUserList()}' +
  
  'function doLogout(){if(refreshInterval)clearInterval(refreshInterval);localStorage.removeItem("adminSession");isLoggedIn=false;location.reload()}' +
  
  'var saved=localStorage.getItem("adminSession");if(saved){var d=JSON.parse(saved);document.getElementById("loginEmail").value=d.email||"admin";document.getElementById("loginPassword").value=d.password||"admin123"}' +
  
  'document.addEventListener("DOMContentLoaded",function(){document.getElementById("loginPassword").addEventListener("keypress",function(e){if(e.key==="Enter")doLogin()});' +
  'document.getElementById("loginEmail").addEventListener("keypress",function(e){if(e.key==="Enter")document.getElementById("loginPassword").focus()})});' +
  
  'window.addEventListener("popstate",function(){if(currentUser)goBack()});' +
  'window.addEventListener("resize",function(){if(window.innerWidth>=768&&currentUser){document.getElementById("sidebar").style.display="flex"}});' +
  '</script></body></html>');
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);
  
  socket.on('register', async (data) => {
    try {
      console.log('📝 Register:', data.email);
      socket.userData = data;
      
      let user = await User.findOne({ email: data.email });
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
        user = await User.create({ name: data.name, email: data.email, password: hash });
        console.log('✅ New user created:', data.email);
      }
      
      await User.updateOne({ email: data.email }, { $set: { isOnline: true, lastSeen: new Date() } });
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) {
      console.error('Register error:', err.message);
    }
  });
  
  socket.on('sendMsg', async (data) => {
    try {
      console.log('💬 Msg:', data.sender, '→', data.receiver);
      const msg = await Message.create({ 
        sender: data.sender, 
        receiver: data.receiver, 
        message: data.message, 
        type: data.type || 'text' 
      });
      io.emit('newMsg', msg);
    } catch (err) {
      console.error('Msg error:', err.message);
    }
  });
  
  socket.on('markRead', async (data) => {
    try { 
      await Message.updateMany({ sender: data.user, receiver: 'admin', seen: false }, { $set: { seen: true } }); 
    } catch (err) {}
  });
  
  socket.on('disconnect', async () => {
    if (socket.userData) {
      try {
        await User.updateOne({ email: socket.userData.email }, { $set: { isOnline: false, lastSeen: new Date() } });
        io.emit('userStatus', { email: socket.userData.email, online: false });
      } catch (err) {}
    }
  });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Admin: http://localhost:' + PORT + '/messenger');
  console.log('👤 User: admin | 🔑 Pass: admin123');
  console.log('========================================');
});

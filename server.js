require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Error:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Error:', e); });

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

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

app.use(express.json());
app.use(express.static('assets'));
app.use('/assets', express.static('assets'));

['uploads', 'assets/covermusic'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ MONGODB ============
const userSchema = new mongoose.Schema({
  name: String, email: String, password: String,
  isAdmin: { type: Boolean, default: false },
  lastSeen: Date, isOnline: { type: Boolean, default: false }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  sender: String, receiver: String, message: String,
  type: { type: String, default: 'text' }, seen: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

mongoose.connect(MONGO_URI).then(async () => {
  console.log('MongoDB Connected');
  const hash = await bcrypt.hash('admin123', 10);
  const admin = await User.findOne({ email: 'admin', isAdmin: true });
  if (admin) {
    await User.updateOne({ email: 'admin' }, { $set: { password: hash } });
  } else {
    await User.create({ name: 'Hammad Bin Amir', email: 'admin', password: hash, isAdmin: true });
  }
}).catch(e => console.error('MongoDB Error:', e.message));

// ============ ASSET PATHS ============
const A = {
  profile: "/assets/tiktok_video_Aj2NO.jpeg",
  fbProfile: "/assets/fb_profile.jpg",
  blueTikTok: "/assets/bluetick_tiktok.png",
  blueFB: "/assets/blue_tick_fb.png",
  logoFB: "/assets/flag.png",
  logoTikTok: "/assets/tiktokicon.png",
  messageIcon: "/assets/messageicon.gif",
  microphone: "/assets/microphone-in-hand.gif",
  reportIcon: "/assets/report.png",
  realId: "/assets/real-id-ss.png",
  fakeDetect: "/assets/Fakedetect.png",
  baillamachFake: "/assets/baillamach.png",
  hammadFake: "/assets/hammadfams.png",
  socialMedia: "/assets/social-media.png",
  communication: "/assets/communication.png",
  followGif: "/assets/follow.gif",
  propagandaGif: "/assets/propaganda.gif",
  addGif: "/assets/add.gif",
  reportGif: "/assets/report.gif",
  playGif: "/assets/play.gif"
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

// ============ API ============
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isAdmin: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({ isAdmin: { $ne: true } }).sort({ updatedAt: -1 }).lean();
    for (let u of users) {
      u.unreadCount = await Message.countDocuments({ sender: u.email, receiver: 'admin', seen: false });
    }
    res.json(users);
  } catch (err) { res.json([]); }
});

app.get('/api/msgs/:email', async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { sender: req.params.email, receiver: 'admin' },
        { sender: 'admin', receiver: req.params.email }
      ]
    }).sort({ createdAt: 1 }).lean();
    res.json(msgs);
  } catch (err) { res.json([]); }
});

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  
  socket.on('register', async (data) => {
    try {
      socket.userData = data;
      let user = await User.findOne({ email: data.email });
      if (!user) {
        const hash = await bcrypt.hash('user123', 10);
        user = await User.create({ name: data.name, email: data.email, password: hash });
      }
      await User.updateOne({ email: data.email }, { $set: { isOnline: true, lastSeen: new Date() } });
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) {}
  });
  
  socket.on('sendMsg', async (data) => {
    try {
      const msg = await Message.create({ sender: data.sender, receiver: data.receiver, message: data.message, type: data.type || 'text' });
      io.emit('newMsg', msg);
    } catch (err) {}
  });
  
  socket.on('markRead', async (data) => {
    try { await Message.updateMany({ sender: data.user, receiver: 'admin', seen: false }, { $set: { seen: true } }); } catch (err) {}
  });
  
  socket.on('disconnect', async () => {
    if (socket.userData) {
      try { await User.updateOne({ email: socket.userData.email }, { $set: { isOnline: false, lastSeen: new Date() } }); io.emit('userStatus', { email: socket.userData.email, online: false }); } catch (err) {}
    }
  });
});

// ============ MAIN PAGE ============
app.get('/', (req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);
  
  let songsHTML = '';
  songs.forEach((s, i) => {
    songsHTML += `<div class="song-row" onclick="playMusic(${i})" id="song-${i}"><span class="song-idx">${String(i+1).padStart(2,'0')}</span><span class="song-name">${s.title}</span><span class="song-icon">▶</span></div>`;
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `<div class="card"><div class="card-head"><span class="pill pill-blue">VOICE</span><h3>Voice Verification</h3></div><div class="card-body"><div class="btn-row">`;
    if (WELCOME_VOICE) voiceHTML += `<button class="btn btn-blue" onclick="playWelcomeVoice()">🎤 Real Voice</button>`;
    if (MANUAL_VOICE) voiceHTML += `<button class="btn btn-red" onclick="playManualVoice()">🚨 Fake Alert</button>`;
    voiceHTML += `</div></div></div>`;
  }

  let musicHTML = '';
  if (songs.length > 0) {
    musicHTML = `<div class="card music-card"><div class="card-head"><span class="pill pill-purple">MUSIC</span><h3>Cover Songs</h3><span class="count">${songs.length} tracks</span></div>
    <div class="music-inner">
      <div class="music-now">
        <div class="music-cover" id="mCover">🎵</div>
        <div class="music-meta"><div class="music-title" id="mTitle">Select a song</div><div class="music-artist">Cover Music</div></div>
        <div class="music-actions">
          <button class="music-nav" onclick="prevMusic()">⏮</button>
          <button class="music-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
          <button class="music-nav" onclick="nextMusic()">⏭</button>
        </div>
      </div>
      <div class="music-bar" onclick="seekMusic(event)"><div class="music-bar-fill" id="mBarFill"></div></div>
      <div class="music-time"><span id="mCur">0:00</span><span id="mDur">0:00</span></div>
      <div class="music-list">${songsHTML}</div>
    </div></div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#ffffff">
<title>Baiilla Maach | Official Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f7;color:#1d1d1f;min-height:100vh;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{text-decoration:none;color:inherit}button{cursor:pointer;font-family:inherit}
.container{max-width:660px;margin:0 auto;padding:16px}

/* Navbar */
.nav{background:#fff;border-bottom:1px solid #e5e5ea;padding:12px 0;position:sticky;top:0;z-index:50}
.nav-inner{max-width:660px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between}
.nav-brand{display:flex;align-items:center;gap:10px}
.nav-av{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e5e5ea}
.nav-title{font-weight:700;font-size:16px}
.nav-links{display:flex;gap:4px}
.nav-links a{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;transition:0.15s}
.nav-links a:hover{background:#f0f0f5}

/* Profile */
.profile{text-align:center;padding:30px 0 20px}
.av-wrap{position:relative;display:inline-block;margin-bottom:12px}
.av-img{width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #000;box-shadow:0 0 0 4px #fff,0 0 0 6px #e5e5ea}
.av-badge{position:absolute;bottom:4px;right:4px;width:26px;height:26px;background:#22c55e;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center}
.av-badge svg{width:13px;height:13px;fill:#fff}
.profile-name{font-size:24px;font-weight:800;margin-top:8px}
.profile-bio{color:#86868b;font-size:14px;margin-top:4px}
.stats{display:flex;justify-content:center;gap:24px;margin:18px 0}
.stat-item{text-align:center}.stat-num{font-size:22px;font-weight:800}.stat-lbl{font-size:11px;color:#86868b;text-transform:uppercase;margin-top:4px}
.tags{display:flex;gap:8px;justify-content:center}

/* Cards */
.card{background:#fff;border:1px solid #e5e5ea;border-radius:20px;padding:20px;margin-bottom:16px}
.card-head{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f0f0f5}
.card-head h3{font-size:17px;font-weight:700}
.card-body{padding:0}

/* Pills & Badges */
.pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700}
.pill-blue{background:#e8f0fe;color:#1a73e8}
.pill-red{background:#fce8e8;color:#ea4335}
.pill-green{background:#e6f4ea;color:#137333}
.pill-purple{background:#f3e8fd;color:#7c3aed}
.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600}
.badge-green{background:#e6f4ea;color:#137333}
.badge-purple{background:#f3e8fd;color:#7c3aed}
.count{font-size:12px;color:#86868b;margin-left:auto}

/* Buttons */
.btn-row{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:0.15s}
.btn-blue{background:#1a73e8;color:#fff}.btn-blue:hover{background:#1557b0}
.btn-red{background:#ea4335;color:#fff}.btn-red:hover{background:#c5221f}
.btn-outline{background:#fff;border:2px solid #e5e5ea;color:#1d1d1f}

/* Grids */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}

/* Verified */
.verified-row{display:flex;align-items:center;gap:12px;padding:12px;background:#f9f9fb;border-radius:12px;margin-bottom:10px}
.verified-row .v-av{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0}
.verified-row .v-info{flex:1}
.verified-row .v-name{font-weight:600;font-size:14px;display:flex;align-items:center;gap:5px}
.verified-row .v-name img{width:16px;height:16px}
.verified-row .v-sub{font-size:11px;color:#86868b;margin-top:2px}

/* Fake */
.fake-card{border:1px solid #fce8e8;border-radius:14px;overflow:hidden;margin-bottom:10px}
.fake-img-wrap{text-align:center;padding:10px;background:#fafafa;position:relative}
.fake-img{width:100%;max-height:300px;object-fit:contain;border-radius:8px}
.fake-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px}
.fake-body{padding:12px}
.fake-body h4{font-weight:600;font-size:14px;margin-bottom:4px}
.fake-body .plat{color:#ea4335;font-size:11px;font-weight:600;margin-bottom:4px}
.fake-body p{font-size:12px;color:#86868b;margin-bottom:8px}

/* Proof */
.proof-item{background:#f9f9fb;border-radius:12px;padding:12px;text-align:center}
.proof-item img{width:100%;border-radius:8px;margin-bottom:8px}
.proof-item span{font-weight:600;font-size:12px}

/* Music */
.music-card{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);color:#fff;border:none}
.music-card .card-head{border-bottom-color:rgba(255,255,255,0.1)}
.music-card .card-head h3,.music-card .card-head .count{color:#fff}
.music-now{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.music-cover{width:60px;height:60px;border-radius:14px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
.music-meta{flex:1}.music-title{font-weight:600;font-size:15px}.music-artist{font-size:11px;opacity:0.6;margin-top:3px}
.music-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
.music-nav{background:rgba(255,255,255,0.1);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:11px}
.music-play{background:#1db954;color:#fff;border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:16px;box-shadow:0 0 20px rgba(29,185,84,0.3)}
.music-bar{width:100%;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;cursor:pointer;margin-bottom:6px}
.music-bar-fill{height:100%;background:#1db954;border-radius:2px;width:0}
.music-time{display:flex;justify-content:space-between;font-size:10px;opacity:0.5;margin-bottom:14px}
.music-list{max-height:180px;overflow-y:auto}
.song-row{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;cursor:pointer;transition:0.1s;margin-bottom:2px;font-size:13px}
.song-row:hover{background:rgba(255,255,255,0.05)}.song-row.active{background:rgba(29,185,84,0.15)}
.song-idx{opacity:0.4;font-size:11px;width:22px}.song-name{flex:1}.song-icon{font-size:10px;opacity:0.3}

/* Chat */
.chat-fab{position:fixed;bottom:20px;right:20px;z-index:99}
.fab{width:54px;height:54px;border-radius:50%;background:#1d1d1f;color:#fff;border:none;font-size:22px;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:0.2s}
.fab:hover{transform:scale(1.06)}
.fab img{width:26px;height:26px;border-radius:50%}
.chat-panel{position:fixed;bottom:85px;right:20px;width:360px;max-width:calc(100vw-32px);height:480px;max-height:calc(100vh-120px);background:#fff;border-radius:16px;box-shadow:0 15px 50px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;z-index:99}
.chat-panel.open{display:flex}
.chat-top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #e5e5ea;background:#fff}
.chat-top-av{width:36px;height:36px;border-radius:50%;object-fit:cover}
.chat-top-name{font-weight:600;font-size:14px}.chat-top-status{font-size:10px;color:#86868b}
.chat-top-close{margin-left:auto;background:none;border:none;font-size:16px;color:#86868b;cursor:pointer}
.chat-msgs{flex:1;overflow-y:auto;padding:12px;background:#f9f9fb}
.chat-login{flex:1;display:flex;flex-direction:column;justify-content:center;padding:24px;text-align:center}
.chat-login input{width:100%;padding:10px 14px;border:2px solid #e5e5ea;border-radius:10px;font-size:13px;outline:none;margin-bottom:8px}
.chat-login input:focus{border-color:#1d1d1f}
.chat-login button{width:100%;padding:11px;background:#1d1d1f;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px}
.chat-input-area{padding:10px 12px;border-top:1px solid #e5e5ea;display:none;background:#fff}
.chat-input-row{display:flex;align-items:center;gap:6px}
.chat-input-row input{flex:1;padding:8px 14px;border:2px solid #e5e5ea;border-radius:20px;font-size:13px;outline:none}
.chat-input-row input:focus{border-color:#1d1d1f}
.chat-input-row button{background:#1d1d1f;color:#fff;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.msg{max-width:78%;padding:7px 11px;border-radius:16px;margin-bottom:4px;font-size:13px;line-height:1.4;word-wrap:break-word}
.msg.user{background:#1d1d1f;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:#fff;color:#1d1d1f;margin-right:auto;border-bottom-left-radius:4px;border:1px solid #e5e5ea}
.msg .time{font-size:9px;opacity:0.5;margin-top:2px;text-align:right}

@media(max-width:600px){.grid2{grid-template-columns:1fr}.grid3{grid-template-columns:1fr 1fr}.chat-panel{width:100%;max-width:100%;bottom:0;right:0;border-radius:16px 16px 0 0;height:75vh;max-height:75vh}}
</style>
</head>
<body>

<nav class="nav"><div class="nav-inner">
<div class="nav-brand"><img src="${A.profile}" class="nav-av" onerror="this.style.display='none'"><span class="nav-title">Verification Hub</span></div>
<div class="nav-links"><a href="#official" style="color:#137333">✓ Official</a><a href="#fake" style="color:#ea4335">⚠ Fakes</a>${songs.length?'<a href="#music" style="color:#7c3aed">🎵 Music</a>':''}</div>
</div></nav>

<main class="container">

<div class="profile">
<div class="av-wrap"><img src="${A.profile}" class="av-img" onerror="this.style.display='none'"><div class="av-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div></div>
<h1 class="profile-name">Hammad Bin Amir</h1>
<p class="profile-bio">Official Entertainment Profile · @baiillamaach_official</p>
<div class="stats"><div class="stat-item"><div class="stat-num">7K</div><div class="stat-lbl">Followers</div></div><div class="stat-item"><div class="stat-num">0</div><div class="stat-lbl">Following</div></div><div class="stat-item"><div class="stat-num">190K</div><div class="stat-lbl">Likes</div></div></div>
<div class="tags"><span class="badge badge-green">✓ Verified</span><span class="badge badge-purple">Creator</span></div>
</div>

<div class="card" id="official"><div class="card-head"><span class="pill pill-green">OFFICIAL</span><h3>Verified Accounts</h3></div><div class="card-body"><div class="grid2">
<div class="verified-row"><img src="${A.profile}" class="v-av"><div class="v-info"><div class="v-name"><img src="${A.logoTikTok}"> @baiillamaach_official <img src="${A.socialMedia}" width="14"></div><div class="v-sub">7K Followers · 190K Likes</div></div><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="btn btn-blue" style="flex-shrink:0;font-size:11px;padding:6px 12px">Follow</a></div>
<div class="verified-row"><img src="${A.fbProfile}" class="v-av"><div class="v-info"><div class="v-name"><img src="${A.logoFB}"> Baiilla Maach Official <img src="${A.socialMedia}" width="14"></div><div class="v-sub">Official Facebook Page</div></div><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="btn btn-blue" style="flex-shrink:0;font-size:11px;padding:6px 12px">Follow</a></div>
</div></div></div>

<div class="card" id="fake" style="border-left:3px solid #ea4335"><div class="card-head"><span class="pill pill-red">WARNING</span><h3>Fake Accounts Detected</h3><span class="count">2 active</span></div><div class="card-body"><div class="grid2">
<div class="fake-card"><div class="fake-img-wrap"><img src="${A.baillamachFake}" class="fake-img"><img src="${A.fakeDetect}" class="fake-overlay"></div><div class="fake-body"><h4>@baiilla_mach</h4><div class="plat">📍 TikTok</div><p>Copies official content to deceive followers.</p><div class="btn-row"><a href="https://tiktok.com/@baiilla_mach" target="_blank" class="btn btn-red" style="font-size:11px;padding:5px 12px"><img src="${A.reportIcon}" width="14"> Report</a></div></div></div>
<div class="fake-card"><div class="fake-img-wrap"><img src="${A.hammadFake}" class="fake-img"><img src="${A.fakeDetect}" class="fake-overlay"></div><div class="fake-body"><h4>@hammad_fams0</h4><div class="plat">📍 TikTok</div><p>Impersonating with fake content.</p><div class="btn-row"><a href="https://tiktok.com/@hammad_fams0" target="_blank" class="btn btn-red" style="font-size:11px;padding:5px 12px"><img src="${A.reportIcon}" width="14"> Report</a></div></div></div>
</div></div></div>

<div class="card"><div class="card-head"><span class="pill pill-blue">PROOF</span><h3>Identity Verification</h3></div><div class="card-body"><div class="grid3">
<div class="proof-item"><img src="${A.realId}"><span>Real ID Verified</span></div>
<div class="proof-item"><img src="${A.microphone}"><span>Voice Recording</span></div>
<div class="proof-item"><img src="${A.fakeDetect}"><span>Fake Detection</span></div>
</div></div></div>

${voiceHTML}
${musicHTML}

</main>

<div class="chat-fab"><button class="fab" onclick="toggleChat()"><img src="${A.messageIcon}" onerror="this.outerHTML='💬'"></button></div>
<div class="chat-panel" id="chatPanel">
<div class="chat-top"><img src="${A.profile}" class="chat-top-av"><div><div class="chat-top-name">Hammad Bin Amir</div><div class="chat-top-status">Support</div></div><button class="chat-top-close" onclick="toggleChat()">✕</button></div>
<div class="chat-msgs" id="chatBody"><div class="chat-login" id="chatLoginForm"><h3 style="margin-bottom:4px">💬 Chat Support</h3><p style="color:#86868b;font-size:12px;margin-bottom:16px">Enter your details</p><input type="text" id="chatNameInput" placeholder="Your name"><input type="text" id="chatEmailInput" placeholder="Email or phone"><button onclick="startChat()">Start Chat</button></div></div>
<div class="chat-input-area" id="chatInputArea"><div class="chat-input-row"><input type="text" id="chatMsgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">➤</button></div></div>
</div>

${WELCOME_VOICE?'<audio id="wAudio" src="/assets/realvoice.mp3" preload="auto"></audio>':''}
${MANUAL_VOICE?'<audio id="mAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>':''}
<audio id="musicAudio" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
var wA=document.getElementById("wAudio"),mA=document.getElementById("mAudio"),musicA=document.getElementById("musicAudio");
function stopAll(){if(wA){wA.pause();wA.currentTime=0}if(mA){mA.pause();mA.currentTime=0}if(musicA){musicA.pause()}mp=false;var b=document.getElementById("mPlayBtn");if(b)b.textContent="▶"}
function playWelcomeVoice(){if(!wA)return;stopAll();wA.play()}
function playManualVoice(){if(!mA)return;stopAll();mA.play()}

var tracks=${songsJSON},ct=0,mp=false;
function upUI(i){document.getElementById("mTitle").textContent=tracks[i].title;var r=document.querySelectorAll(".song-row");for(var j=0;j<r.length;j++)r[j].classList.toggle("active",j===i)}
function playMusic(i){if(!tracks.length)return;stopAll();ct=i;musicA.src=tracks[i].url;musicA.play();mp=true;document.getElementById("mPlayBtn").textContent="⏸";upUI(i)}
function toggleMusic(){if(musicA.paused){if(!musicA.src&&tracks.length)musicA.src=tracks[0].url;stopAll();musicA.play();mp=true;document.getElementById("mPlayBtn").textContent="⏸";upUI(ct)}else{musicA.pause();mp=false;document.getElementById("mPlayBtn").textContent="▶"}}
function prevMusic(){playMusic((ct-1+tracks.length)%tracks.length)}
function nextMusic(){playMusic((ct+1)%tracks.length)}
function seekMusic(e){if(!musicA.duration)return;musicA.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*musicA.duration}
musicA.addEventListener("timeupdate",function(){if(musicA.duration){document.getElementById("mBarFill").style.width=(musicA.currentTime/musicA.duration)*100+"%";document.getElementById("mCur").textContent=fmt(musicA.currentTime);document.getElementById("mDur").textContent=fmt(musicA.duration)}});
musicA.addEventListener("ended",nextMusic);
function fmt(s){if(isNaN(s))return"0:00";var m=Math.floor(s/60);return m+":"+String(Math.floor(s%60)).padStart(2,"0")}

if(wA)setTimeout(function(){wA.play()},1500);

// Chat
var socket=io(),cu=null;
function toggleChat(){document.getElementById("chatPanel").classList.toggle("open")}
function startChat(){var n=document.getElementById("chatNameInput").value.trim(),e=document.getElementById("chatEmailInput").value.trim();if(!n||!e)return;cu={name:n,email:e};socket.emit("register",{name:n,email:e});document.getElementById("chatLoginForm").style.display="none";document.getElementById("chatInputArea").style.display="block";loadMsgs()}
async function loadMsgs(){if(!cu)return;try{var r=await fetch("/api/msgs/"+cu.email);var ms=await r.json();var b=document.getElementById("chatBody");b.innerHTML="";for(var i=0;i<ms.length;i++){var m=ms[i],c=m.sender===cu.email?"user":"admin",t=new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});b.innerHTML+='<div class="msg '+c+'">'+m.message+'<div class="time">'+t+'</div></div>'}b.scrollTop=b.scrollHeight}catch(e){}}
function sendMsg(){var i=document.getElementById("chatMsgInput"),m=i.value.trim();if(!m||!cu)return;socket.emit("sendMsg",{sender:cu.email,receiver:"admin",message:m,type:"text"});i.value=""}
socket.on("newMsg",function(m){if(cu&&(m.sender===cu.email||m.receiver===cu.email)){var b=document.getElementById("chatBody"),c=m.sender===cu.email?"user":"admin",t=new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});b.innerHTML+='<div class="msg '+c+'">'+m.message+'<div class="time">'+t+'</div></div>';b.scrollTop=b.scrollHeight}});
</script>
</body>
</html>`;
  res.send(html);
});

// ============ ADMIN MESSENGER ============
app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Messenger</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f7;height:100vh;overflow:hidden;color:#1d1d1f}
.login-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-card{background:#fff;padding:30px;border-radius:20px;width:380px;text-align:center;box-shadow:0 15px 50px rgba(0,0,0,0.2)}
.login-card h2{font-weight:700;margin-bottom:4px}.login-card .sub{color:#86868b;font-size:14px;margin-bottom:20px}
.login-card input{width:100%;padding:12px;margin-bottom:10px;border:2px solid #e5e5ea;border-radius:10px;font-size:14px;outline:none}
.login-card input:focus{border-color:#1d1d1f}
.login-card button{width:100%;padding:12px;background:#1d1d1f;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:15px}
.login-card button:disabled{opacity:0.6}
.error{color:#ea4335;font-size:13px;margin-top:8px;display:none}
.app{display:none;height:100vh}
.layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.sidebar{width:340px;border-right:1px solid #e5e5ea;display:flex;flex-direction:column;background:#fff}
.sidebar-head{padding:16px;border-bottom:1px solid #e5e5ea;display:flex;justify-content:space-between;align-items:center}
.sidebar-head h2{font-size:17px;font-weight:700}.sidebar-head button{background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;font-size:13px}
.search-box{padding:10px 14px;border-bottom:1px solid #e5e5ea}
.search-box input{width:100%;padding:8px 12px;border:2px solid #e5e5ea;border-radius:20px;font-size:13px;outline:none}
.search-box input:focus{border-color:#1d1d1f}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #f5f5f7;transition:0.1s}
.user-item:hover{background:#f5f5f7}.user-item.active{background:#e8f0fe}
.user-avatar{width:40px;height:40px;border-radius:50%;background:#1d1d1f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:16px}
.user-info{flex:1;min-width:0}.user-info .name{font-weight:600;font-size:14px}.user-info .email{font-size:12px;color:#86868b}
.unread{background:#1a73e8;color:#fff;font-size:11px;padding:3px 8px;border-radius:10px;font-weight:600}
.chat-area{flex:1;display:flex;flex-direction:column}
.chat-head{padding:14px;border-bottom:1px solid #e5e5ea;display:flex;align-items:center;gap:10px;background:#f9f9fb}
.chat-head .av{width:36px;height:36px;border-radius:50%;background:#1d1d1f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}
.chat-head .name{font-weight:600;font-size:15px}.chat-head .status{font-size:12px}
.chat-head .status.online{color:#137333}.chat-head .status.offline{color:#86868b}
.chat-msgs{flex:1;overflow-y:auto;padding:14px;background:#f9f9fb}
.msg{max-width:65%;padding:8px 12px;border-radius:16px;margin-bottom:4px;font-size:13px;word-wrap:break-word}
.msg.sent{background:#1d1d1f;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.received{background:#fff;color:#1d1d1f;border:1px solid #e5e5ea;border-bottom-left-radius:4px}
.msg .time{font-size:10px;opacity:0.5;margin-top:3px;text-align:right}
.chat-input{padding:10px 14px;border-top:1px solid #e5e5ea;display:none;background:#fff}
.chat-input-row{display:flex;align-items:center;gap:8px}
.chat-input-row input{flex:1;padding:8px 14px;border:2px solid #e5e5ea;border-radius:20px;font-size:13px;outline:none}
.chat-input-row input:focus{border-color:#1d1d1f}
.chat-input-row button{background:#1d1d1f;color:#fff;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
.empty-state{text-align:center;color:#86868b;padding:60px 20px}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay"><div class="login-card"><h2>🔐 Admin Messenger</h2><p class="sub">Support Panel</p><input type="text" id="loginEmail" placeholder="Username" value="admin"><input type="password" id="loginPassword" placeholder="Password" value="admin123"><button id="loginBtn" onclick="doLogin()">Sign In</button><div class="error" id="loginError"></div></div></div>
<div class="app" id="app"><div class="layout">
<div class="sidebar"><div class="sidebar-head"><h2>💬 Conversations</h2><button onclick="doLogout()">Logout</button></div><div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div><div class="user-list" id="userList"><div class="empty-state"><p>Loading...</p></div></div></div>
<div class="chat-area"><div class="chat-head"><div class="av" id="chatAv">?</div><div><div class="name" id="chatName">Select a user</div><div class="status offline" id="chatStatus">● Offline</div></div></div><div class="chat-msgs" id="chatMsgs"><div class="empty-state"><h3>No conversation</h3><p>Click a user to view messages</p></div></div><div class="chat-input" id="chatInputArea"><div class="chat-input-row"><input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()"><button onclick="sendMessage()">➤</button></div></div></div>
</div></div>
<script src="/socket.io/socket.io.js"></script>
<script>
var socket=io(),currentUser=null,allUsers=[],isLoggedIn=false;
socket.on("newMsg",function(m){if(currentUser&&((m.sender===currentUser.email&&m.receiver==="admin")||(m.sender==="admin"&&m.receiver===currentUser.email))){addMsg(m)}loadUsers()});
socket.on("userStatus",function(d){if(currentUser&&currentUser.email===d.email){var s=document.getElementById("chatStatus");s.textContent=d.online?"● Online":"● Offline";s.className="status "+(d.online?"online":"offline")}loadUsers()});
async function doLogin(){var e=document.getElementById("loginEmail").value.trim(),p=document.getElementById("loginPassword").value.trim(),err=document.getElementById("loginError"),btn=document.getElementById("loginBtn");err.style.display="none";if(!e||!p){err.textContent="Fill all fields";err.style.display="block";return}btn.disabled=true;btn.textContent="Signing...";try{var r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});if(r.ok){isLoggedIn=true;localStorage.setItem("adminSession",JSON.stringify({email:e,password:p}));document.getElementById("loginOverlay").style.display="none";document.getElementById("app").style.display="block";loadUsers();setInterval(function(){if(isLoggedIn)loadUsers()},10000)}else{err.textContent="Invalid credentials";err.style.display="block"}}catch(ex){err.textContent="Network error";err.style.display="block"}btn.disabled=false;btn.textContent="Sign In"}
async function loadUsers(){if(!isLoggedIn)return;try{var r=await fetch("/api/admin/users");allUsers=await r.json();renderUsers()}catch(e){}}
function renderUsers(){var s=document.getElementById("searchInput").value.toLowerCase();var f=allUsers.filter(function(u){return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)});var h="";for(var i=0;i<f.length;i++){var u=f[i],a=currentUser&&currentUser.email===u.email;h+='<div class="user-item'+(a?" active":"")+'" onclick="selectUser(\''+u.email+'\')"><div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':"")+'</div>'}document.getElementById("userList").innerHTML=h||'<div class="empty-state"><p>No users</p></div>'}
function filterUsers(){renderUsers()}
async function selectUser(e){var u=allUsers.find(function(u){return u.email===e});if(!u)return;currentUser=u;document.getElementById("chatAv").textContent=u.name.charAt(0).toUpperCase();document.getElementById("chatName").textContent=u.name;document.getElementById("chatStatus").textContent=u.isOnline?"● Online":"● Offline";document.getElementById("chatStatus").className="status "+(u.isOnline?"online":"offline");document.getElementById("chatInputArea").style.display="block";try{var r=await fetch("/api/msgs/"+u.email);var ms=await r.json();var h="";if(ms.length===0)h='<div class="empty-state"><h3>No messages</h3></div>';else for(var i=0;i<ms.length;i++){var m=ms[i],s=m.sender==="admin",t=new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});h+='<div class="msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>'}document.getElementById("chatMsgs").innerHTML=h;document.getElementById("chatMsgs").scrollTop=99999}catch(ex){}socket.emit("markRead",{user:u.email});renderUsers()}
function addMsg(m){if(!currentUser)return;var c=document.getElementById("chatMsgs"),s=m.sender==="admin",t=new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});c.innerHTML+='<div class="msg '+(s?"sent":"received")+'">'+m.message+'<div class="time">'+t+'</div></div>';c.scrollTop=99999}
function sendMessage(){if(!currentUser)return;var i=document.getElementById("msgInput"),m=i.value.trim();if(!m)return;socket.emit("sendMsg",{sender:"admin",receiver:currentUser.email,message:m,type:"text"});addMsg({sender:"admin",receiver:currentUser.email,message:m,createdAt:new Date()});i.value="";i.focus()}
function doLogout(){localStorage.removeItem("adminSession");location.reload()}
var saved=localStorage.getItem("adminSession");if(saved){var d=JSON.parse(saved);document.getElementById("loginEmail").value=d.email;document.getElementById("loginPassword").value=d.password}
document.addEventListener("DOMContentLoaded",function(){document.getElementById("loginPassword").addEventListener("keypress",function(e){if(e.key==="Enter")doLogin()})});
</script>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log('\n🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Admin: http://localhost:' + PORT + '/messenger');
  console.log('👤 admin / admin123\n');
});

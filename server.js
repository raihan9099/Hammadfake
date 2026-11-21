// server.js
require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const CONFIG = require('./config');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = CONFIG.server.port;
const MONGO_URI = CONFIG.server.mongoUri;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: CONFIG.server.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

['uploads', 'assets/covermusic', 'assets/gallery'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: String,
  avatar: String,
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
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
  fileName: String,
  fileSize: Number,
  seen: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  image: String,
  category: String,
  author: String,
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const reportSchema = new mongoose.Schema({
  reporterName: String,
  reporterEmail: String,
  fakeAccount: String,
  platform: String,
  reason: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Post = mongoose.model('Post', postSchema);
const Report = mongoose.model('Report', reportSchema);

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');

    const adminExists = await User.findOne({ email: CONFIG.admin.defaultEmail, isAdmin: true });
    const hash = await bcrypt.hash(CONFIG.admin.defaultPassword, 10);
    if (adminExists) {
      await User.updateOne(
        { email: CONFIG.admin.defaultEmail },
        { $set: { password: hash, name: 'Admin', isAdmin: true } }
      );
      console.log('✅ Admin updated');
    } else {
      await User.create({
        name: 'Admin',
        email: CONFIG.admin.defaultEmail,
        password: hash,
        isAdmin: true
      });
      console.log('✅ Admin created');
    }

    const totalUsers = await User.countDocuments({ isAdmin: false });
    const totalMsgs = await Message.countDocuments({});
    console.log('📊 Total users:', totalUsers);
    console.log('📊 Total messages:', totalMsgs);
  })
  .catch(e => console.error('❌ MongoDB Error:', e.message));

const ASSETS = CONFIG.assets;
const WELCOME_VOICE = fs.existsSync(CONFIG.voice.welcome);
const MANUAL_VOICE = fs.existsSync(CONFIG.voice.manualAlert);

function getSongs() {
  try {
    const dir = CONFIG.musicDir;
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

app.get('/', (req, res) => {
  const songs = getSongs();
  const songsJSON = JSON.stringify(songs);

  let songsListHTML = '';
  songs.forEach((s, i) => {
    songsListHTML += `<div class="song-item" onclick="playMusic(${i})" id="song-${i}">
      <span class="song-num">${String(i+1).padStart(2,'0')}</span>
      <img src="${ASSETS.playGif}" class="song-thumb">
      <div class="song-info"><div class="song-title">${s.title}</div><div class="song-artist">Baiilla Maach</div></div>
      <span class="song-play">▶</span>
    </div>`;
  });

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `<div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-gradient">VOICE</span>
        <h3>Voice Verification</h3>
        <p>Listen to authentic voice recordings</p>
      </div>
      <div class="card-body">
        <div class="btn-group">
          ${WELCOME_VOICE ? '<button class="btn btn-gradient" onclick="playWelcomeVoice()">🎤 Real Voice</button>' : ''}
          ${MANUAL_VOICE ? '<button class="btn btn-danger" onclick="playManualVoice()">🚨 Fake Alert</button>' : ''}
        </div>
      </div>
    </div>`;
  }

  let fakeCardsHTML = '';
  CONFIG.fakeAccounts.forEach(fake => {
    fakeCardsHTML += `<div class="fake-card">
      <div class="fake-img-wrap">
        <img src="${fake.image}" class="fake-img">
        <img src="${ASSETS.fakeDetect}" class="fake-overlay">
      </div>
      <div class="fake-body">
        <h4>${fake.username}</h4>
        <div class="platform">📍 ${fake.platform}</div>
        <p>${fake.reason}</p>
        <a href="${fake.url}" target="_blank" class="btn btn-danger" style="padding:6px 16px;font-size:0.8em">🚨 Report</a>
      </div>
    </div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baiilla Maach Official | Hammad Bin Amir</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --primary: #667eea;
      --secondary: #764ba2;
      --accent: #f093fb;
      --danger: #eb3349;
      --success: #00b09b;
      --dark: #1a1a2e;
      --light: #f8f9fa;
      --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --gradient-pink: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      --shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: #333; line-height: 1.6; }
    .header { position: sticky; top: 0; z-index: 1000; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); box-shadow: 0 2px 20px rgba(0,0,0,0.1); padding: 0 24px; height: 70px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 3px solid var(--gradient); }
    .header-name { font-weight: 800; font-size: 1.3em; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header-btn { background: var(--gradient); color: white; padding: 10px 24px; border-radius: 25px; font-weight: 600; cursor: pointer; transition: all 0.3s; text-decoration: none; }
    .header-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102,126,234,0.4); }
    .container { max-width: 720px; margin: 20px auto; padding: 0 16px; }
    .card { background: rgba(255,255,255,0.95); border-radius: 16px; box-shadow: var(--shadow); margin-bottom: 20px; overflow: hidden; backdrop-filter: blur(10px); animation: slideUp 0.6s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    .glass-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.3); }
    .card-header { padding: 20px; border-bottom: 2px solid #f0f0f0; position: relative; overflow: hidden; }
    .card-header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--gradient); }
    .card-body { padding: 24px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .badge-gradient { background: var(--gradient); color: white; }
    .badge-danger { background: var(--gradient-pink); color: white; }
    .badge-success { background: linear-gradient(135deg, #00b09b, #96c93d); color: white; }
    h3 { font-size: 1.4em; font-weight: 800; margin-bottom: 6px; }
    p { color: #666; font-size: 0.9em; }
    .profile-card { text-align: center; padding: 0; }
    .profile-cover { height: 200px; background: var(--gradient); position: relative; overflow: hidden; }
    .profile-cover::after { content: ''; position: absolute; bottom: -50%; left: -50%; width: 200%; height: 200%; background: rgba(255,255,255,0.1); animation: wave 3s infinite linear; }
    @keyframes wave { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .profile-avatar-wrap { margin-top: -70px; position: relative; display: inline-block; animation: float 3s infinite ease-in-out; }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .profile-avatar { width: 140px; height: 140px; border-radius: 50%; border: 6px solid white; object-fit: cover; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .verified-badge { position: absolute; bottom: 10px; right: 10px; background: #1da1f2; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(29,161,242,0.7); } 50% { box-shadow: 0 0 0 10px rgba(29,161,242,0); } }
    .verified-badge svg { width: 18px; height: 18px; fill: white; }
    .profile-name { font-size: 1.8em; font-weight: 900; margin-top: 12px; }
    .profile-username { color: #666; font-size: 1em; margin-bottom: 6px; }
    .profile-bio { color: #888; font-size: 0.9em; margin-bottom: 16px; }
    .stats-row { display: flex; justify-content: center; gap: 50px; padding: 16px 0; border-top: 2px solid #f0f0f0; border-bottom: 2px solid #f0f0f0; margin-bottom: 16px; }
    .stat { text-align: center; }
    .stat-num { font-size: 1.4em; font-weight: 800; color: #667eea; }
    .stat-label { font-size: 0.8em; color: #888; }
    .btn-group { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; padding: 16px; }
    .btn { padding: 12px 24px; border-radius: 25px; font-weight: 700; font-size: 0.95em; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s; text-decoration: none; }
    .btn-gradient { background: var(--gradient); color: white; }
    .btn-gradient:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102,126,234,0.4); }
    .btn-danger { background: var(--gradient-pink); color: white; }
    .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(245,87,108,0.4); }
    .btn-outline { background: white; color: #667eea; border: 2px solid #667eea; }
    .btn-outline:hover { background: #667eea; color: white; }
    .gif-strip { display: flex; gap: 15px; padding: 16px; justify-content: center; flex-wrap: wrap; }
    .gif-item { text-align: center; transition: all 0.3s; }
    .gif-item:hover { transform: scale(1.1); }
    .gif-item img { width: 50px; height: 50px; border-radius: 12px; object-fit: cover; }
    .gif-item span { display: block; font-size: 0.7em; color: #888; margin-top: 6px; font-weight: 600; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    @media(max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
    .verified-item { display: flex; align-items: center; gap: 12px; padding: 16px; background: #f8f9fa; border-radius: 12px; transition: all 0.3s; border: 2px solid transparent; }
    .verified-item:hover { border-color: #667eea; transform: translateY(-2px); }
    .verified-item .v-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
    .verified-item .v-info h4 { font-weight: 700; font-size: 1em; display: flex; align-items: center; gap: 4px; }
    .verified-item .v-info h4 img { width: 18px; height: 18px; }
    .verified-item .v-info .v-handle { font-size: 0.85em; color: #667eea; font-weight: 600; }
    .verified-item .v-info .v-detail { font-size: 0.8em; color: #888; margin-top: 4px; }
    .fake-card { border: 2px solid #fecaca; border-radius: 12px; overflow: hidden; transition: all 0.3s; }
    .fake-card:hover { border-color: #ef4444; box-shadow: 0 5px 20px rgba(239,68,68,0.2); }
    .fake-img-wrap { position: relative; text-align: center; padding: 16px; background: #fafafa; }
    .fake-img { max-width: 100%; border-radius: 8px; }
    .fake-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 80px; height: 80px; animation: bounce 2s infinite; }
    @keyframes bounce { 0%, 100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-20px); } }
    .fake-body { padding: 16px; }
    .fake-body h4 { font-weight: 700; font-size: 1em; }
    .fake-body .platform { color: #f59e0b; font-weight: 700; font-size: 0.85em; margin: 4px 0; }
    .fake-body p { font-size: 0.85em; color: #888; margin-bottom: 12px; }
    .proof-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
    @media(max-width: 600px) { .proof-grid { grid-template-columns: 1fr; } }
    .proof-item { background: #f8f9fa; border-radius: 12px; padding: 16px; text-align: center; transition: all 0.3s; cursor: pointer; }
    .proof-item:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .proof-item img { width: 100%; border-radius: 8px; margin-bottom: 10px; }
    .proof-item .label { font-weight: 700; font-size: 0.85em; color: #667eea; }
    .music-section { padding: 20px; }
    .music-header { display: flex; align-items: center; gap: 15px; padding: 16px; background: #f8f9fa; border-radius: 12px; }
    .music-cover { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; }
    .music-info { flex: 1; min-width: 0; }
    .music-title { font-weight: 700; font-size: 1em; }
    .music-artist { font-size: 0.85em; color: #888; }
    .music-slider { width: 100%; height: 6px; background: #e0e0e0; border-radius: 3px; cursor: pointer; margin: 16px 0; position: relative; }
    .music-slider-fill { height: 100%; background: var(--gradient); border-radius: 3px; width: 0; transition: width 0.1s; }
    .music-time-row { display: flex; justify-content: space-between; font-size: 0.8em; color: #888; margin-bottom: 12px; }
    .music-controls { display: flex; align-items: center; justify-content: center; gap: 16px; }
    .music-btn { width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; font-size: 1.1em; display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
    .music-btn-nav { background: #e0e0e0; color: #333; }
    .music-btn-nav:hover { background: #d0d0d0; }
    .music-btn-play { background: var(--gradient); color: white; width: 56px; height: 56px; font-size: 1.3em; }
    .music-btn-play:hover { transform: scale(1.1); }
    .music-list { max-height: 250px; overflow-y: auto; margin-top: 16px; }
    .song-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; border-radius: 8px; transition: all 0.3s; }
    .song-item:hover { background: #f0f0f0; }
    .song-item.active { background: #e3e8ff; }
    .song-num { font-weight: 700; color: #888; min-width: 24px; font-size: 0.85em; }
    .song-thumb { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; }
    .song-info { flex: 1; min-width: 0; }
    .song-title { font-weight: 600; font-size: 0.9em; }
    .song-artist { font-size: 0.75em; color: #888; }
    .song-play { color: #667eea; font-size: 0.9em; }
    .chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
    .chat-toggle { width: 60px; height: 60px; border-radius: 50%; background: var(--gradient); color: white; border: none; font-size: 1.5em; cursor: pointer; box-shadow: 0 10px 30px rgba(102,126,234,0.4); transition: all 0.3s; }
    .chat-toggle:hover { transform: scale(1.1); }
    .chat-panel { display: none; position: fixed; bottom: 90px; right: 20px; width: 360px; height: 500px; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); flex-direction: column; overflow: hidden; z-index: 9999; animation: slideUp 0.3s ease; }
    .chat-panel.open { display: flex; }
    .chat-head { padding: 16px; background: var(--gradient); color: white; display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
    .chat-head button { background: none; border: none; color: white; font-size: 1.2em; cursor: pointer; }
    .chat-body { flex: 1; overflow-y: auto; padding: 16px; background: #f8f9fa; }
    .chat-login { text-align: center; padding: 20px; }
    .chat-login input { width: 100%; padding: 12px; margin-bottom: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 0.9em; outline: none; }
    .chat-login input:focus { border-color: #667eea; }
    .chat-login button { width: 100%; padding: 12px; background: var(--gradient); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .chat-input-area { padding: 16px; border-top: 1px solid #e0e0e0; display: none; background: white; }
    .chat-input-row { display: flex; align-items: center; gap: 8px; }
    .chat-input-row input { flex: 1; padding: 10px 16px; border: 2px solid #e0e0e0; border-radius: 20px; font-size: 0.9em; outline: none; }
    .chat-input-row input:focus { border-color: #667eea; }
    .chat-input-row button { background: var(--gradient); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; }
    .msg { max-width: 75%; padding: 10px 14px; border-radius: 18px; margin-bottom: 6px; font-size: 0.85em; word-wrap: break-word; }
    .msg.user { background: var(--gradient); color: white; margin-left: auto; border-bottom-right-radius: 4px; }
    .msg.admin { background: white; color: #333; border: 1px solid #e0e0e0; border-bottom-left-radius: 4px; }
    .msg .time { font-size: 0.7em; opacity: 0.7; margin-top: 4px; text-align: right; }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-left">
      <img src="${CONFIG.profile.avatar}" class="header-logo" onerror="this.style.display='none'">
      <span class="header-name">Baiilla Maach</span>
    </div>
    <a href="/messenger" class="header-btn">💬 Support Chat</a>
  </header>

  <div class="container">
    <div class="card profile-card">
      <div class="profile-cover"></div>
      <div class="profile-avatar-wrap">
        <img src="${CONFIG.profile.avatar}" class="profile-avatar" onerror="this.style.display='none'">
        <div class="verified-badge">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
      </div>
      <h2 class="profile-name">${CONFIG.profile.name}</h2>
      <div class="profile-username">${CONFIG.profile.username}</div>
      <div class="profile-bio">${CONFIG.profile.bio}</div>

      <div class="stats-row">
        <div class="stat"><div class="stat-num">${CONFIG.stats.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
        <div class="stat"><div class="stat-num">${CONFIG.stats.following}</div><div class="stat-label">Following</div></div>
        <div class="stat"><div class="stat-num">${CONFIG.stats.tiktokLikes}</div><div class="stat-label">Likes</div></div>
      </div>

      <div class="btn-group">
        <a href="${CONFIG.links.tiktok}" target="_blank" class="btn btn-gradient">
          <img src="${ASSETS.logoTikTok}" width="20"> Follow TikTok
        </a>
        <a href="${CONFIG.links.facebook}" target="_blank" class="btn btn-gradient">
          <img src="${ASSETS.logoFB}" width="20"> Follow Facebook
        </a>
      </div>

      <div class="gif-strip">
        <div class="gif-item"><img src="${ASSETS.followGif}"><span>Follow</span></div>
        <div class="gif-item"><img src="${ASSETS.addGif}"><span>Add</span></div>
        <div class="gif-item"><img src="${ASSETS.propagandaGif}"><span>Official</span></div>
        <div class="gif-item"><img src="${ASSETS.reportGif}"><span>Report</span></div>
        <div class="gif-item"><img src="${ASSETS.playGif}"><span>Play</span></div>
      </div>
    </div>

    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-success">OFFICIAL</span>
        <h3>Verified Accounts</h3>
        <p>The only authentic accounts</p>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="verified-item">
            <img src="${ASSETS.profile}" class="v-avatar">
            <div class="v-info">
              <h4>TikTok <img src="${ASSETS.blueTikTok}"></h4>
              <div class="v-handle">${CONFIG.profile.username}</div>
              <div class="v-detail">✓ Active · <strong>${CONFIG.stats.tiktokFollowers}</strong> Followers · <strong>${CONFIG.stats.tiktokLikes}</strong> Likes</div>
              <a href="${CONFIG.links.tiktok}" target="_blank" class="btn btn-outline" style="margin-top:8px;padding:6px 16px;font-size:0.8em">Follow</a>
            </div>
          </div>
          <div class="verified-item">
            <img src="${ASSETS.fbProfile}" class="v-avatar">
            <div class="v-info">
              <h4>Facebook <img src="${ASSETS.blueFB}"></h4>
              <div class="v-handle">@BaiillaMaachOfficial</div>
              <div class="v-detail">✓ Active · <strong>${CONFIG.stats.facebookFollowers}</strong> Followers</div>
              <a href="${CONFIG.links.facebook}" target="_blank" class="btn btn-outline" style="margin-top:8px;padding:6px 16px;font-size:0.8em">Follow</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-danger">WARNING</span>
        <h3>Fake Accounts Detected</h3>
        <p>Report these accounts</p>
      </div>
      <div class="card-body">
        <div class="grid-2">
          ${fakeCardsHTML}
        </div>
      </div>
    </div>

    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-gradient">PROOF</span>
        <h3>Identity Verification</h3>
      </div>
      <div class="card-body">
        <div class="proof-grid">
          <div class="proof-item">
            <img src="${ASSETS.realId}">
            <div class="label">Real ID Verified</div>
          </div>
          <div class="proof-item">
            <img src="${ASSETS.microphone}">
            <div class="label">Voice Recording</div>
          </div>
          <div class="proof-item">
            <img src="${ASSETS.fakeDetect}">
            <div class="label">Fake Detection</div>
          </div>
        </div>
      </div>
    </div>

    ${voiceHTML}

    ${songs.length > 0 ? `
    <div class="card glass-card">
      <div class="card-header">
        <span class="badge badge-gradient">MUSIC</span>
        <h3>Cover Songs</h3>
      </div>
      <div class="music-section">
        <div class="music-header">
          <img src="${ASSETS.playGif}" class="music-cover" id="mCover">
          <div class="music-info">
            <div class="music-title" id="mTitle">Select Song</div>
            <div class="music-artist">Baiilla Maach</div>
          </div>
        </div>
        <div class="music-slider" onclick="seekMusic(event)">
          <div class="music-slider-fill" id="mSliderFill"></div>
        </div>
        <div class="music-time-row">
          <span id="mCurrentTime">0:00</span>
          <span id="mDuration">0:00</span>
        </div>
        <div class="music-controls">
          <button class="music-btn music-btn-nav" onclick="prevMusic()">⏮</button>
          <button class="music-btn music-btn-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
          <button class="music-btn music-btn-nav" onclick="nextMusic()">⏭</button>
        </div>
        <div class="music-list">
          ${songsListHTML}
        </div>
      </div>
    </div>` : ''}
  </div>

  <div class="chat-widget">
    <button class="chat-toggle" onclick="toggleChat()">💬</button>
  </div>

  <div class="chat-panel" id="chatPanel">
    <div class="chat-head">
      💬 Chat Support
      <button onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-body" id="chatBody">
      <div class="chat-login" id="chatLoginForm">
        <h4 style="margin-bottom:16px">Start Chat</h4>
        <input type="text" id="chatNameInput" placeholder="Your Name">
        <input type="text" id="chatEmailInput" placeholder="Email or Phone">
        <button onclick="startChatSession()">Start Chatting</button>
      </div>
    </div>
    <div class="chat-input-area" id="chatInputArea">
      <div class="chat-input-row">
        <input type="text" id="chatMsgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
        <button onclick="sendChatMsg()">➤</button>
      </div>
    </div>
  </div>

  ${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/${CONFIG.voice.welcome}" preload="auto"></audio>` : ''}
  ${MANUAL_VOICE ? `<audio id="manualAudio" src="/${CONFIG.voice.manualAlert}" preload="auto"></audio>` : ''}
  <audio id="musicAudio" preload="auto"></audio>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    var welcomeAudio = document.getElementById("welcomeAudio");
    var manualAudio = document.getElementById("manualAudio");
    var musicAudio = document.getElementById("musicAudio");
    function stopAllAudio() {
      if (welcomeAudio) { welcomeAudio.pause(); welcomeAudio.currentTime = 0; }
      if (manualAudio) { manualAudio.pause(); manualAudio.currentTime = 0; }
      if (musicAudio) { musicAudio.pause(); }
      musicPlaying = false;
      updatePlayBtn();
    }
    function playWelcomeVoice() { if (!welcomeAudio) return; stopAllAudio(); welcomeAudio.play(); }
    function playManualVoice() { if (!manualAudio) return; stopAllAudio(); manualAudio.play(); }
    var tracks = ${songsJSON};
    var currentTrack = 0;
    var musicPlaying = false;
    function updatePlayBtn() { var b = document.getElementById("mPlayBtn"); if (b) b.innerHTML = musicPlaying ? "⏸" : "▶"; }
    function updateMusicUI(i) {
      document.getElementById("mTitle").textContent = tracks[i].title;
      var items = document.querySelectorAll(".song-item");
      for (var j = 0; j < items.length; j++) { if (j === i) items[j].classList.add("active"); else items[j].classList.remove("active"); }
    }
    function playMusic(i) {
      if (!tracks.length) return;
      stopAllAudio();
      currentTrack = i;
      musicAudio.src = tracks[i].url;
      musicAudio.play();
      musicPlaying = true;
      updatePlayBtn();
      updateMusicUI(i);
    }
    function toggleMusic() {
      if (musicAudio.paused) {
        if (!musicAudio.src && tracks.length) musicAudio.src = tracks[0].url;
        stopAllAudio();
        musicAudio.play();
        musicPlaying = true;
        updatePlayBtn();
        updateMusicUI(currentTrack);
      } else {
        musicAudio.pause();
        musicPlaying = false;
        updatePlayBtn();
      }
    }
    function prevMusic() { playMusic((currentTrack - 1 + tracks.length) % tracks.length); }
    function nextMusic() { playMusic((currentTrack + 1) % tracks.length); }
    function seekMusic(e) {
      if (!musicAudio.duration) return;
      var r = e.currentTarget.getBoundingClientRect();
      musicAudio.currentTime = ((e.clientX - r.left) / r.width) * musicAudio.duration;
    }
    musicAudio.addEventListener("timeupdate", function() {
      if (musicAudio.duration) {
        document.getElementById("mSliderFill").style.width = (musicAudio.currentTime / musicAudio.duration) * 100 + "%";
        document.getElementById("mCurrentTime").textContent = formatTime(musicAudio.currentTime);
        document.getElementById("mDuration").textContent = formatTime(musicAudio.duration);
      }
    });
    musicAudio.addEventListener("ended", nextMusic);
    function formatTime(s) {
      if (isNaN(s)) return "0:00";
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return m + ":" + String(sec).padStart(2, "0");
    }
    if (welcomeAudio) setTimeout(function() { welcomeAudio.play(); }, 1500);
    var socket = io();
    var chatUser = null;
    function toggleChat() { document.getElementById("chatPanel").classList.toggle("open"); }
    function startChatSession() {
      var n = document.getElementById("chatNameInput").value.trim();
      var e = document.getElementById("chatEmailInput").value.trim();
      if (!n || !e) return;
      chatUser = { name: n, email: e };
      socket.emit("register", { name: n, email: e });
      document.getElementById("chatLoginForm").style.display = "none";
      document.getElementById("chatInputArea").style.display = "block";
      loadChatMessages();
    }
    async function loadChatMessages() {
      if (!chatUser) return;
      var r = await fetch("/api/msgs/" + chatUser.email);
      var ms = await r.json();
      var b = document.getElementById("chatBody");
      b.innerHTML = "";
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        var cls = (m.sender === chatUser.email ? "user" : "admin");
        b.innerHTML += '<div class="msg ' + cls + '">' + m.message + '<div class="time">' + new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) + '</div></div>';
      }
      b.scrollTop = b.scrollHeight;
    }
    function sendChatMsg() {
      var i = document.getElementById("chatMsgInput");
      var m = i.value.trim();
      if (!m || !chatUser) return;
      socket.emit("sendMsg", { sender: chatUser.email, receiver: "admin", message: m, type: "text" });
      i.value = "";
    }
    socket.on("newMsg", function(m) {
      if (chatUser && (m.sender === chatUser.email || m.receiver === chatUser.email)) {
        var b = document.getElementById("chatBody");
        var cls = (m.sender === chatUser.email ? "user" : "admin");
        b.innerHTML += '<div class="msg ' + cls + '">' + m.message + '<div class="time">' + new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) + '</div></div>';
        b.scrollTop = b.scrollHeight;
      }
    });
  </script>
</body>
</html>`;

  res.send(html);
});

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
    req.session.isAdmin = true;
    req.session.adminEmail = email;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const users = await User.find({ isAdmin: { $ne: true } }).sort({ lastSeen: -1 }).lean();
    for (let u of users) {
      u.unreadCount = await Message.countDocuments({ sender: u.email, receiver: 'admin', seen: false });
    }
    res.json(users);
  } catch (err) {
    console.error('Error /api/admin/users:', err.message);
    res.json([]);
  }
});

app.post('/api/report', async (req, res) => {
  try {
    const { reporterName, reporterEmail, fakeAccount, platform, reason } = req.body;
    const report = await Report.create({ reporterName, reporterEmail, fakeAccount, platform, reason });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/reports', async (req, res) => {
  try {
    if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    res.json(reports);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const fileUrl = '/uploads/' + req.file.filename;
    res.json({ url: fileUrl, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Messenger | Baiilla Maach</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    :root { --primary: #667eea; --secondary: #764ba2; --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%); --shadow: 0 10px 30px rgba(0,0,0,0.1); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: var(--gradient); height: 100vh; overflow: hidden; color: #333; }
    .login-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(10px); }
    .login-card { background: white; padding: 40px; border-radius: 20px; width: 400px; text-align: center; box-shadow: var(--shadow); animation: slideUp 0.5s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    .login-card h2 { font-weight: 800; margin-bottom: 8px; font-size: 1.5em; }
    .login-card .sub { color: #888; font-size: 0.9em; margin-bottom: 24px; }
    .login-card input { width: 100%; padding: 14px; margin-bottom: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 0.95em; outline: none; transition: all 0.3s; }
    .login-card input:focus { border-color: #667eea; }
    .login-card button { width: 100%; padding: 14px; background: var(--gradient); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 1em; transition: all 0.3s; }
    .login-card button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102,126,234,0.4); }
    .login-card button:disabled { opacity: 0.6; }
    .error { color: #eb3349; font-size: 0.85em; margin-top: 12px; display: none; }
    .app { display: none; height: 100vh; }
    .layout { display: flex; height: 100vh; max-width: 1400px; margin: 0 auto; background: white; box-shadow: var(--shadow); animation: slideUp 0.5s ease; }
    .sidebar { width: 360px; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; background: #f8f9fa; }
    .sidebar-head { padding: 20px; background: var(--gradient); color: white; display: flex; justify-content: space-between; align-items: center; }
    .sidebar-head h2 { font-size: 1.2em; font-weight: 800; }
    .sidebar-head button { background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer; }
    .search-box { padding: 16px; background: white; }
    .search-box input { width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 25px; font-size: 0.9em; outline: none; }
    .search-box input:focus { border-color: #667eea; }
    .user-list { flex: 1; overflow-y: auto; }
    .user-item { padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: all 0.3s; background: white; }
    .user-item:hover { background: #f0f0f0; }
    .user-item.active { background: #e3e8ff; border-left: 4px solid #667eea; }
    .user-avatar { width: 45px; height: 45px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; flex-shrink: 0; font-size: 1.2em; }
    .user-info { flex: 1; min-width: 0; }
    .user-info .name { font-weight: 700; font-size: 0.95em; }
    .user-info .email { font-size: 0.8em; color: #888; }
    .unread { background: #eb3349; color: white; font-size: 0.75em; padding: 4px 10px; border-radius: 12px; font-weight: 700; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .chat-area { flex: 1; display: flex; flex-direction: column; }
    .chat-head { padding: 16px 20px; background: white; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 12px; }
    .chat-head .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 1em; }
    .chat-head .name { font-weight: 700; font-size: 1em; }
    .chat-head .status { font-size: 0.85em; }
    .chat-head .status.online { color: #00b09b; }
    .chat-head .status.offline { color: #888; }
    .chat-msgs { flex: 1; overflow-y: auto; padding: 20px; background: #f8f9fa; }
    .msg { max-width: 65%; padding: 10px 16px; border-radius: 18px; margin-bottom: 8px; font-size: 0.9em; word-wrap: break-word; }
    .msg.sent { background: var(--gradient); color: white; margin-left: auto; border-bottom-right-radius: 4px; }
    .msg.received { background: white; color: #333; border: 1px solid #e0e0e0; border-bottom-left-radius: 4px; }
    .msg .time { font-size: 0.7em; opacity: 0.7; margin-top: 4px; text-align: right; }
    .chat-input { padding: 16px 20px; border-top: 1px solid #e0e0e0; display: none; background: white; }
    .chat-input-row { display: flex; align-items: center; gap: 12px; }
    .chat-input-row input { flex: 1; padding: 12px 20px; border: 2px solid #e0e0e0; border-radius: 25px; font-size: 0.9em; outline: none; }
    .chat-input-row input:focus { border-color: #667eea; }
    .chat-input-row button { background: var(--gradient); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 1.1em; transition: all 0.3s; }
    .chat-input-row button:hover { transform: scale(1.1); }
    .empty-state { text-align: center; color: #888; padding: 60px 20px; }
  </style>
</head>
<body>
  <div class="login-overlay" id="loginOverlay">
    <div class="login-card">
      <h2>🔐 Admin Messenger</h2>
      <p class="sub">Baiilla Maach Support Panel</p>
      <input type="text" id="loginEmail" placeholder="Username" value="${CONFIG.admin.defaultEmail}">
      <input type="password" id="loginPassword" placeholder="Password" value="${CONFIG.admin.defaultPassword}">
      <button id="loginBtn" onclick="doLogin()">Sign In</button>
      <div class="error" id="loginError"></div>
    </div>
  </div>

  <div class="app" id="app">
    <div class="layout">
      <div class="sidebar">
        <div class="sidebar-head">
          <h2>💬 Conversations</h2>
          <button onclick="doLogout()">Logout</button>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()">
        </div>
        <div class="user-list" id="userList">
          <div class="empty-state"><p>Loading users...</p></div>
        </div>
      </div>
      <div class="chat-area">
        <div class="chat-head">
          <div class="avatar" id="chatAvatar">?</div>
          <div>
            <div class="name" id="chatName">Select a conversation</div>
            <div class="status offline" id="chatStatus">● Offline</div>
          </div>
        </div>
        <div class="chat-msgs" id="chatMessages">
          <div class="empty-state">
            <h3>No conversation selected</h3>
            <p>Click on a user to view messages</p>
          </div>
        </div>
        <div class="chat-input" id="chatInputArea">
          <div class="chat-input-row">
            <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
            <button onclick="sendMessage()">➤</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    var socket = io();
    var currentUser = null;
    var allUsers = [];
    var isLoggedIn = false;
    socket.on("newMsg", function(m) {
      if (currentUser && ((m.sender === currentUser.email && m.receiver === "admin") || (m.sender === "admin" && m.receiver === currentUser.email))) {
        appendMessage(m);
      }
      loadUsers();
    });
    socket.on("userStatus", function(d) {
      if (currentUser && currentUser.email === d.email) {
        var s = document.getElementById("chatStatus");
        s.textContent = d.online ? "● Online" : "● Offline";
        s.className = "status " + (d.online ? "online" : "offline");
      }
      loadUsers();
    });
    async function doLogin() {
      var e = document.getElementById("loginEmail").value.trim();
      var p = document.getElementById("loginPassword").value.trim();
      var err = document.getElementById("loginError");
      var btn = document.getElementById("loginBtn");
      err.style.display = "none";
      if (!e || !p) { err.textContent = "Fill all fields"; err.style.display = "block"; return; }
      btn.disabled = true;
      btn.textContent = "Signing...";
      try {
        var r = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: e, password: p })
        });
        var d = await r.json();
        if (r.ok) {
          isLoggedIn = true;
          localStorage.setItem("adminSession", JSON.stringify({ email: e, password: p }));
          document.getElementById("loginOverlay").style.display = "none";
          document.getElementById("app").style.display = "block";
          loadUsers();
          setInterval(function() { if (isLoggedIn) loadUsers(); }, 10000);
        } else {
          err.textContent = "❌ Invalid credentials";
          err.style.display = "block";
        }
      } catch(ex) {
        err.textContent = "❌ Network error";
        err.style.display = "block";
      }
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
    async function loadUsers() {
      if (!isLoggedIn) return;
      try {
        var r = await fetch("/api/admin/users");
        var data = await r.json();
        allUsers = data;
        renderUserList();
      } catch(e) { console.log("Error:", e); }
    }
    function renderUserList() {
      var s = document.getElementById("searchInput").value.toLowerCase();
      var f = allUsers.filter(function(u) { return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s); });
      var h = "";
      for (var i = 0; i < f.length; i++) {
        var u = f[i];
        var a = currentUser && currentUser.email === u.email;
        h += '<div class="user-item' + (a ? " active" : "") + '" onclick="selectUser(\\'' + u.email + '\\')">' +
          '<div class="user-avatar">' + u.name.charAt(0).toUpperCase() + '</div>' +
          '<div class="user-info"><div class="name">' + u.name + '</div>' +
          '<div class="email">' + u.email + '</div></div>' +
          (u.unreadCount > 0 ? '<div class="unread">' + u.unreadCount + '</div>' : "") +
          '</div>';
      }
      document.getElementById("userList").innerHTML = h || '<div class="empty-state"><p>No users yet</p></div>';
    }
    function filterUsers() { renderUserList(); }
    async function selectUser(e) {
      var u = allUsers.find(function(u) { return u.email === e; });
      if (!u) return;
      currentUser = u;
      document.getElementById("chatAvatar").textContent = u.name.charAt(0).toUpperCase();
      document.getElementById("chatName").textContent = u.name;
      document.getElementById("chatStatus").textContent = u.isOnline ? "● Online" : "● Offline";
      document.getElementById("chatStatus").className = "status " + (u.isOnline ? "online" : "offline");
      document.getElementById("chatInputArea").style.display = "block";
      try {
        var r = await fetch("/api/msgs/" + u.email);
        var ms = await r.json();
        var h = "";
        if (ms.length === 0) { h = '<div class="empty-state"><h3>No messages</h3></div>'; }
        else {
          for (var i = 0; i < ms.length; i++) {
            var m = ms[i];
            var s = m.sender === "admin";
            var t = new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
            h += '<div class="msg ' + (s ? "sent" : "received") + '">' + m.message + '<div class="time">' + t + '</div></div>';
          }
        }
        document.getElementById("chatMessages").innerHTML = h;
        document.getElementById("chatMessages").scrollTop = 99999;
      } catch(ex) { console.log(ex); }
      socket.emit("markRead", { user: u.email });
      renderUserList();
    }
    function appendMessage(m) {
      if (!currentUser) return;
      var c = document.getElementById("chatMessages");
      var s = m.sender === "admin";
      var t = new Date(m.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
      c.innerHTML += '<div class="msg ' + (s ? "sent" : "received") + '">' + m.message + '<div class="time">' + t + '</div></div>';
      c.scrollTop = 99999;
    }
    function sendMessage() {
      if (!currentUser) return;
      var i = document.getElementById("msgInput");
      var m = i.value.trim();
      if (!m) return;
      socket.emit("sendMsg", { sender: "admin", receiver: currentUser.email, message: m, type: "text" });
      appendMessage({ sender: "admin", receiver: currentUser.email, message: m, timestamp: new Date() });
      i.value = "";
      i.focus();
    }
    function doLogout() {
      localStorage.removeItem("adminSession");
      location.reload();
    }
    var saved = localStorage.getItem("adminSession");
    if (saved) {
      var d = JSON.parse(saved);
      document.getElementById("loginEmail").value = d.email;
      document.getElementById("loginPassword").value = d.password;
    }
    document.addEventListener("DOMContentLoaded", function() {
      document.getElementById("loginPassword").addEventListener("keypress", function(e) {
        if (e.key === "Enter") doLogin();
      });
    });
  </script>
</body>
</html>`);
});

io.on('connection', (socket) => {
  console.log('🔌 Socket connected');
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
      console.log('💬 Msg:', data.sender, '→', data.receiver, ':', data.message.substring(0, 30));
      const msg = await Message.create({
        sender: data.sender,
        receiver: data.receiver,
        message: data.message,
        type: data.type || 'text',
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize
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
        console.log('🔴 Offline:', socket.userData.email);
      } catch (err) {}
    }
  });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('🔧 Admin: http://localhost:' + PORT + '/messenger');
  console.log('👤 User: ' + CONFIG.admin.defaultEmail + ' | 🔑 Pass: ' + CONFIG.admin.defaultPassword);
  console.log('========================================');
});

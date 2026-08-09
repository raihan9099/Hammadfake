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
  email: { type: String, unique: true },
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
    const adminEmail = 'admin@baillamaach.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.updateOne({ email: adminEmail }, { $set: { password: hashedPassword, name: 'Baiilla Maach', isAdmin: true } });
      console.log('✅ Admin Password Reset to: admin123');
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ name: 'Baiilla Maach', email: adminEmail, password: hashedPassword, isAdmin: true });
      console.log('✅ Admin Created');
    }
    console.log('📧 Admin: admin@baillamaach.com | 🔑 Pass: admin123');
  })
  .catch(e => console.error('❌ MongoDB Error:', e.message));

const ASSETS = {
  profile: "/assets/celebrity_pfp.jpeg",
  fbProfile: "/assets/fb_profile.jpg",
  blueTikTok: "/assets/bluetick_tiktok.png",
  blueFB: "/assets/blue_tick_fb.png",
  logoFB: "/assets/logo_fb.png",
  logoTikTok: "/assets/logo_tiktok.png",
  messageBubble: "/assets/message_bubble.gif",
  microphone: "/assets/microphone-in-hand.gif",
  reportBtn: "/assets/report_button.png",
  realId: "/assets/real-id-ss.png",
  fakeDetect: "/assets/Fakedetect_updown.png",
  baillamachFake: "/assets/baillamach_fake.png",
  hammadFake: "/assets/hammadfams.png",
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

app.get('/', (req, res) => {
  const songs = getSongs();

  let voiceHTML = '';
  if (WELCOME_VOICE || MANUAL_VOICE) {
    voiceHTML = `
    <div class="fb-card">
      <div style="text-align:center;padding:20px 16px;">
        <div style="font-size:0.8125rem;color:#65676b;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:8px;">Voice Verification</div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#1c1e21;margin-bottom:6px;">Listen to Authentic Voice</h2>
        <p style="font-size:0.9375rem;color:#65676b;margin-bottom:16px;">Verify the real Baiilla Maach</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          ${WELCOME_VOICE ? '<button class="fb-btn" onclick="playWelcomeVoice()" style="background:#e4e6eb;color:#1c1e21;">🎤 Real Voice</button>' : ''}
          ${MANUAL_VOICE ? '<button class="fb-btn" onclick="playManualVoice()" style="background:#fce4e4;color:#e41e3f;">🚨 Fake Alert</button>' : ''}
        </div>
      </div>
    </div>`;
  }

  let musicHTML = '';
  if (songs.length > 0) {
    musicHTML = `
    <div class="fb-card">
      <div style="padding:16px;">
        <div style="font-size:0.8125rem;color:#65676b;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:8px;">Music</div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#1c1e21;margin-bottom:4px;">Cover Songs</h2>
        <p style="font-size:0.9375rem;color:#65676b;margin-bottom:16px;">Official covers by Hammad Bin Amir</p>
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f0f2f5;border-radius:8px;margin-bottom:12px;">
          <img src="${ASSETS.playGif}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;" id="mCover" alt="Cover" onerror="this.src='${ASSETS.microphone}'">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.9375rem;font-weight:600;color:#1c1e21;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="mTitle">Select a Song</div>
            <div style="font-size:0.8125rem;color:#65676b;">Baiilla Maach</div>
          </div>
        </div>
        <div style="width:100%;height:4px;background:#e4e6eb;border-radius:2px;cursor:pointer;margin:8px 0;" onclick="seekMusic(event)"><div id="mSliderFill" style="height:100%;background:#1b74e4;border-radius:2px;width:0%;transition:width 0.1s linear;"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#65676b;margin-bottom:8px;"><span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <button onclick="prevMusic()" style="background:none;border:none;color:#65676b;font-size:1rem;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">⏮</button>
          <button id="mPlayBtn" onclick="toggleMusic()" style="background:#1b74e4;color:#fff;border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">▶</button>
          <button onclick="nextMusic()" style="background:none;border:none;color:#65676b;font-size:1rem;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">⏭</button>
        </div>
        <div style="margin-top:12px;max-height:180px;overflow-y:auto;border-top:1px solid #e4e6eb;padding-top:8px;">
          ${songs.map((s, i) => `
            <div onclick="playMusic(${i})" style="display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;border-radius:6px;font-size:0.8125rem;color:#1c1e21;" class="song-item-${i}">
              <span style="font-weight:600;color:#65676b;min-width:22px;">${String(i+1).padStart(2,'0')}</span>
              <img src="${ASSETS.playGif}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;">
              <div style="flex:1;"><div style="font-weight:500;">${s.title}</div><div style="font-size:0.75rem;color:#65676b;">Baiilla Maach</div></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<title>Baiilla Maach — Official Hub | Hammad Bin Amir</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Segoe+UI:wght@400;600;700&display=swap" rel="stylesheet">
<style>
/* ═══════════ FACEBOOK UI WHITE THEME ═══════════ */
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif;
  background: #f0f2f5;
  color: #1c1e21;
  line-height: 1.34;
  -webkit-font-smoothing: antialiased;
  font-size: 0.9375rem;
}
a { text-decoration: none; color: #1b74e4; }
a:hover { text-decoration: underline; }
img { max-width: 100%; }

/* FB Top Bar */
.fb-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fb-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fb-logo-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e4e6eb;
}
.fb-logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1b74e4;
  letter-spacing: -0.5px;
}
.fb-header-right { display: flex; gap: 8px; align-items: center; }
.fb-header-btn {
  padding: 8px 16px;
  border-radius: 20px;
  border: none;
  background: #e4e6eb;
  color: #1c1e21;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Segoe UI', sans-serif;
}
.fb-header-btn:hover { background: #d8dadf; }
.fb-header-btn.primary { background: #1b74e4; color: #fff; }
.fb-header-btn.primary:hover { background: #1668d3; }

/* FB Container */
.fb-container {
  max-width: 680px;
  margin: 16px auto;
  padding: 0 16px;
}

/* FB Card */
.fb-card {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  margin-bottom: 16px;
  overflow: hidden;
}

/* FB Profile Card */
.fb-profile-card {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  margin-bottom: 16px;
  overflow: hidden;
}
.fb-cover {
  height: 200px;
  background: linear-gradient(135deg, #1b74e4, #8b5cf6, #ec4899);
  position: relative;
  border-radius: 8px 8px 0 0;
}
.fb-avatar-wrap {
  position: relative;
  margin-top: -60px;
  text-align: center;
  padding-bottom: 12px;
}
.fb-avatar-img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  object-fit: cover;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  background: #fff;
}
.fb-verified-badge {
  position: absolute;
  bottom: 16px;
  right: calc(50% - 70px);
  background: #1b74e4;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}
.fb-verified-badge svg { width: 12px; height: 12px; fill: #fff; }
.fb-profile-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1c1e21;
  text-align: center;
  padding: 0 16px;
}
.fb-profile-username {
  font-size: 1.0625rem;
  color: #1c1e21;
  text-align: center;
  font-weight: 600;
}
.fb-profile-bio {
  font-size: 0.9375rem;
  color: #65676b;
  text-align: center;
  padding: 4px 16px 8px;
}
.fb-profile-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 12px 16px;
  border-top: 1px solid #e4e6eb;
  border-bottom: 1px solid #e4e6eb;
  margin: 8px 0;
}
.fb-stat { text-align: center; }
.fb-stat-num { font-size: 1.0625rem; font-weight: 700; color: #1c1e21; }
.fb-stat-label { font-size: 0.8125rem; color: #65676b; }
.fb-profile-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  justify-content: center;
  flex-wrap: wrap;
}
.fb-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Segoe UI', sans-serif;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.fb-btn img { width: 18px; height: 18px; }
.fb-btn-primary { background: #1b74e4; color: #fff; }
.fb-btn-primary:hover { background: #1668d3; }
.fb-btn-secondary { background: #e4e6eb; color: #1c1e21; }
.fb-btn-secondary:hover { background: #d8dadf; }

/* GIF Strip */
.fb-gif-strip {
  display: flex;
  gap: 8px;
  padding: 8px 16px 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.fb-gif-item { text-align: center; }
.fb-gif-item img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
.fb-gif-item span { display: block; font-size: 0.6875rem; color: #65676b; margin-top: 2px; }

/* Section Header */
.fb-section-header {
  padding: 16px;
  border-bottom: 1px solid #e4e6eb;
}
.fb-section-label {
  font-size: 0.8125rem;
  color: #65676b;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 1px;
}
.fb-section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1c1e21;
}
.fb-section-desc {
  font-size: 0.9375rem;
  color: #65676b;
  margin-top: 4px;
}

/* FB Content */
.fb-content { padding: 16px; }
.fb-row { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-col { flex: 1; min-width: 200px; }

/* Verified Item */
.fb-verified-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f0f2f5;
  border-radius: 8px;
  margin-bottom: 8px;
}
.fb-verified-item img.avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.fb-verified-item .info h4 { font-size: 0.9375rem; font-weight: 600; color: #1c1e21; display: flex; align-items: center; gap: 4px; }
.fb-verified-item .info h4 img { width: 16px; height: 16px; }
.fb-verified-item .info .handle { font-size: 0.8125rem; color: #65676b; }
.fb-verified-item .info .detail { font-size: 0.8125rem; color: #1c1e21; }
.fb-verified-item .info .detail strong { font-weight: 600; }

/* Fake Item */
.fb-fake-item {
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
}
.fb-fake-img-wrap { position: relative; text-align: center; padding: 12px; background: #f0f2f5; }
.fb-fake-img { max-width: 100%; border-radius: 4px; }
.fb-fake-overlay {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 70px; height: 70px; z-index: 2;
  animation: fbUpDown 1.8s infinite ease-in-out;
  filter: drop-shadow(0 3px 10px rgba(228,30,63,0.5));
}
@keyframes fbUpDown {
  0%, 100% { transform: translate(-50%, -50%) translateY(0); }
  50% { transform: translate(-50%, -50%) translateY(-14px); }
}
.fb-fake-body { padding: 12px; }
.fb-fake-body h4 { font-size: 0.9375rem; font-weight: 600; color: #1c1e21; }
.fb-fake-body .platform { font-size: 0.8125rem; color: #f59e0b; font-weight: 600; margin: 2px 0; }
.fb-fake-body p { font-size: 0.8125rem; color: #65676b; margin-bottom: 8px; }
.fb-report-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 14px; border-radius: 6px;
  background: #e41e3f; color: #fff;
  font-weight: 600; font-size: 0.8125rem;
  text-decoration: none; transition: all 0.2s;
}
.fb-report-btn:hover { background: #c81a35; text-decoration: none; }

/* Proof Grid */
.fb-proof-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-proof-card { flex: 1; min-width: 180px; background: #f0f2f5; border-radius: 8px; padding: 12px; text-align: center; }
.fb-proof-card img { width: 100%; border-radius: 4px; margin-bottom: 8px; }
.fb-proof-card .label { font-size: 0.8125rem; font-weight: 600; color: #1c1e21; }
.fb-real-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: #e7f3ff; padding: 5px 12px; border-radius: 20px;
  margin-top: 6px; font-size: 0.75rem; font-weight: 600; color: #1b74e4;
}
.fb-real-badge svg { width: 14px; height: 14px; fill: #1b74e4; }

/* Chat Widget */
.fb-chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
.fb-chat-btn {
  width: 50px; height: 50px; border-radius: 50%;
  background: #1b74e4; color: #fff; border: none;
  font-size: 1.3rem; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.fb-chat-btn:hover { background: #1668d3; transform: scale(1.05); }
.fb-chat-panel {
  display: none; position: fixed; bottom: 80px; right: 20px;
  width: 338px; height: 455px; background: #fff;
  border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);
  flex-direction: column; overflow: hidden; z-index: 9999;
}
.fb-chat-panel.open { display: flex; }
.fb-chat-head {
  padding: 10px 14px; background: #fff;
  border-bottom: 1px solid #e4e6eb; display: flex;
  justify-content: space-between; align-items: center;
  font-weight: 600; font-size: 0.9375rem;
}
.fb-chat-head button { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #65676b; }
.fb-chat-body { flex: 1; overflow-y: auto; padding: 10px; background: #f0f2f5; }
.fb-chat-login { text-align: center; padding: 20px; }
.fb-chat-login h4 { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
.fb-chat-login p { font-size: 0.8125rem; color: #65676b; margin-bottom: 12px; }
.fb-chat-login input {
  width: 100%; padding: 10px 12px; margin-bottom: 8px;
  border: 1px solid #ccd0d5; border-radius: 6px;
  font-size: 0.9375rem; outline: none; font-family: 'Segoe UI', sans-serif;
}
.fb-chat-login input:focus { border-color: #1b74e4; box-shadow: 0 0 0 2px rgba(27,116,228,0.2); }
.fb-chat-login button {
  width: 100%; padding: 10px; background: #1b74e4; color: #fff;
  border: none; border-radius: 6px; font-weight: 600;
  cursor: pointer; font-size: 0.9375rem; font-family: 'Segoe UI', sans-serif;
}
.fb-chat-input-area { padding: 10px; border-top: 1px solid #e4e6eb; display: none; background: #fff; }
.fb-chat-input-area input {
  flex: 1; padding: 8px 12px; border: 1px solid #ccd0d5;
  border-radius: 20px; font-size: 0.9375rem; outline: none;
  font-family: 'Segoe UI', sans-serif;
}
.fb-chat-input-area input:focus { border-color: #1b74e4; }
.fb-chat-input-area button {
  background: #1b74e4; color: #fff; border: none;
  width: 32px; height: 32px; border-radius: 50%;
  cursor: pointer; margin-left: 6px; font-size: 0.9rem;
}
.fb-msg { max-width: 75%; padding: 7px 10px; border-radius: 18px; margin-bottom: 4px; font-size: 0.8125rem; }
.fb-msg.user { background: #1b74e4; color: #fff; margin-left: auto; border-bottom-right-radius: 4px; }
.fb-msg.admin { background: #e4e6eb; color: #1c1e21; border-bottom-left-radius: 4px; }
.fb-msg .time { font-size: 0.6875rem; opacity: 0.7; margin-top: 2px; text-align: right; }

@media(max-width: 680px) {
  .fb-cover { height: 140px; }
  .fb-avatar-img { width: 100px; height: 100px; }
  .fb-avatar-wrap { margin-top: -50px; }
  .fb-profile-name { font-size: 1.25rem; }
  .fb-profile-stats { gap: 20px; }
  .fb-chat-panel { width: 100%; height: 100%; bottom: 0; right: 0; border-radius: 0; }
}
</style>
</head>
<body>

<!-- FB Header -->
<header class="fb-header">
  <div class="fb-header-left">
    <img src="${ASSETS.profile}" class="fb-logo-circle" alt="Logo" onerror="this.style.display='none'">
    <span class="fb-logo-text">Baiilla Maach</span>
  </div>
  <div class="fb-header-right">
    <a href="/messenger" class="fb-header-btn primary">💬 Support</a>
  </div>
</header>

<!-- FB Container -->
<div class="fb-container">

  <!-- Profile Card -->
  <div class="fb-profile-card">
    <div class="fb-cover"></div>
    <div class="fb-avatar-wrap">
      <img src="${ASSETS.profile}" class="fb-avatar-img" alt="Hammad Bin Amir" onerror="this.style.display='none'">
      <div class="fb-verified-badge">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>
    </div>
    <div class="fb-profile-name">Hammad Bin Amir</div>
    <div class="fb-profile-username">@baiillamaach_official</div>
    <div class="fb-profile-bio">Official Entertainment Profile · Verified Creator</div>
    <div class="fb-profile-stats">
      <div class="fb-stat"><div class="fb-stat-num">7K</div><div class="fb-stat-label">Followers</div></div>
      <div class="fb-stat"><div class="fb-stat-num">0</div><div class="fb-stat-label">Following</div></div>
      <div class="fb-stat"><div class="fb-stat-num">190K</div><div class="fb-stat-label">Likes</div></div>
    </div>
    <div class="fb-profile-actions">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="fb-btn fb-btn-primary"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="fb-btn fb-btn-secondary"><img src="${ASSETS.logoFB}" alt=""> Facebook</a>
    </div>
    <div class="fb-gif-strip">
      <div class="fb-gif-item"><img src="${ASSETS.followGif}" alt="Follow"><span>Follow</span></div>
      <div class="fb-gif-item"><img src="${ASSETS.addGif}" alt="Add"><span>Add</span></div>
      <div class="fb-gif-item"><img src="${ASSETS.propagandaGif}" alt="Official"><span>Official</span></div>
      <div class="fb-gif-item"><img src="${ASSETS.reportGif}" alt="Report"><span>Report</span></div>
      <div class="fb-gif-item"><img src="${ASSETS.playGif}" alt="Play"><span>Play</span></div>
    </div>
  </div>

  <!-- Official Accounts -->
  <div class="fb-card">
    <div class="fb-section-header">
      <div class="fb-section-label">Authentic</div>
      <div class="fb-section-title">Official Accounts</div>
      <div class="fb-section-desc">The only real verified profiles</div>
    </div>
    <div class="fb-content">
      <div class="fb-row">
        <div class="fb-col">
          <div class="fb-verified-item">
            <img src="${ASSETS.profile}" class="avatar">
            <div class="info">
              <h4>TikTok <img src="${ASSETS.blueTikTok}"></h4>
              <div class="handle">@baiillamaach_official</div>
              <div class="detail">✓ Active & Verified · 👥 7K · ❤️ 190K</div>
              <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="fb-btn fb-btn-primary" style="margin-top:6px;padding:5px 12px;font-size:0.8125rem;">Follow</a>
            </div>
          </div>
        </div>
        <div class="fb-col">
          <div class="fb-verified-item">
            <img src="${ASSETS.fbProfile}" class="avatar">
            <div class="info">
              <h4>Facebook <img src="${ASSETS.blueFB}"></h4>
              <div class="handle">@BaiillaMaachOfficial</div>
              <div class="detail">✓ Active & Verified · Official Page</div>
              <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="fb-btn fb-btn-primary" style="margin-top:6px;padding:5px 12px;font-size:0.8125rem;">Follow</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Fake Accounts -->
  <div class="fb-card">
    <div class="fb-section-header">
      <div class="fb-section-label" style="color:#e41e3f;">⚠️ Warning</div>
      <div class="fb-section-title">Fake Accounts Detected</div>
      <div class="fb-section-desc">Report these accounts immediately</div>
    </div>
    <div class="fb-content">
      <div class="fb-row">
        <div class="fb-col">
          <div class="fb-fake-item">
            <div class="fb-fake-img-wrap">
              <img src="${ASSETS.baillamachFake}" class="fb-fake-img" alt="Fake">
              <img src="${ASSETS.fakeDetect}" class="fb-fake-overlay" alt="FAKE">
            </div>
            <div class="fb-fake-body">
              <h4>@baiilla_mach</h4>
              <div class="platform">📍 TikTok</div>
              <p>Copies official content to deceive followers.</p>
              <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="fb-report-btn">🚨 Report</a>
            </div>
          </div>
        </div>
        <div class="fb-col">
          <div class="fb-fake-item">
            <div class="fb-fake-img-wrap">
              <img src="${ASSETS.hammadFake}" class="fb-fake-img" alt="Fake">
              <img src="${ASSETS.fakeDetect}" class="fb-fake-overlay" alt="FAKE">
            </div>
            <div class="fb-fake-body">
              <h4>@hammad_fams0</h4>
              <div class="platform">📍 TikTok</div>
              <p>Impersonating with fake content.</p>
              <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="fb-report-btn">🚨 Report</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Identity Verification -->
  <div class="fb-card">
    <div class="fb-section-header">
      <div class="fb-section-label">Proof</div>
      <div class="fb-section-title">Identity Verification</div>
      <div class="fb-section-desc">Evidence confirming authenticity</div>
    </div>
    <div class="fb-content">
      <div class="fb-proof-grid">
        <div class="fb-proof-card">
          <img src="${ASSETS.realId}" alt="Real ID">
          <div class="label">Real ID Verified</div>
          <div class="fb-real-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Real Account</div>
        </div>
        <div class="fb-proof-card">
          <img src="${ASSETS.microphone}" alt="Voice">
          <div class="label">Real Voice Recording</div>
        </div>
        <div class="fb-proof-card">
          <img src="${ASSETS.fakeDetect}" alt="Detection">
          <div class="label">Fake Account Detection</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Voice Verification -->
  ${voiceHTML}

  <!-- Music -->
  ${musicHTML}

</div>

<!-- Chat Widget -->
<div class="fb-chat-widget">
  <button class="fb-chat-btn" onclick="toggleChat()">💬</button>
</div>
<div class="fb-chat-panel" id="chatPanel">
  <div class="fb-chat-head">💬 Chat Support <button onclick="toggleChat()">✕</button></div>
  <div class="fb-chat-body" id="chatBody">
    <div class="fb-chat-login" id="chatLoginForm">
      <h4>Start Chat</h4>
      <p>Connect with support team</p>
      <input type="text" id="chatNameInput" placeholder="Your Name">
      <input type="text" id="chatEmailInput" placeholder="Email or Phone">
      <button onclick="startChatSession()">Start Chatting</button>
    </div>
  </div>
  <div class="fb-chat-input-area" id="chatInputArea">
    <div style="display:flex;align-items:center">
      <input type="text" id="chatMsgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
      <button onclick="sendChatMsg()">➤</button>
    </div>
  </div>
</div>

${WELCOME_VOICE ? '<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>' : ''}
${MANUAL_VOICE ? '<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>' : ''}
<audio id="musicAudio" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
const welcomeAudio=document.getElementById('welcomeAudio');
const manualAudio=document.getElementById('manualAudio');
const musicAudio=document.getElementById('musicAudio');
function stopAllAudio(){if(welcomeAudio){welcomeAudio.pause();welcomeAudio.currentTime=0;}if(manualAudio){manualAudio.pause();manualAudio.currentTime=0;}if(musicAudio){musicAudio.pause();}musicPlaying=false;updatePlayBtn();}
function playWelcomeVoice(){if(!welcomeAudio)return;stopAllAudio();welcomeAudio.play().catch(()=>{});}
function playManualVoice(){if(!manualAudio)return;stopAllAudio();manualAudio.play().catch(()=>{});}

const tracks=${JSON.stringify(songs)};
let currentTrack=0,musicPlaying=false;
function updatePlayBtn(){const b=document.getElementById('mPlayBtn');if(!b)return;if(musicPlaying){b.textContent='⏸';b.style.background='#1668d3';}else{b.textContent='▶';b.style.background='#1b74e4';}}
function playMusic(i){if(!tracks.length)return;stopAllAudio();currentTrack=i;musicAudio.src=tracks[i].url;musicAudio.play().then(()=>{musicPlaying=true;updatePlayBtn();updateMusicUI(i);}).catch(()=>{});}
function updateMusicUI(i){document.getElementById('mTitle').textContent=tracks[i].title;document.querySelectorAll('[class*="song-item-"]').forEach((el,j)=>el.style.background=j===i?'#e7f3ff':'transparent');}
function toggleMusic(){if(musicAudio.paused){stopAllAudio();if(!musicAudio.src&&tracks.length)musicAudio.src=tracks[currentTrack].url;musicAudio.play().then(()=>{musicPlaying=true;updatePlayBtn();updateMusicUI(currentTrack);}).catch(()=>{});}else{musicAudio.pause();musicPlaying=false;updatePlayBtn();}}
function prevMusic(){playMusic((currentTrack-1+tracks.length)%tracks.length);}
function nextMusic(){playMusic((currentTrack+1)%tracks.length);}
function seekMusic(e){if(!musicAudio.duration)return;const r=e.currentTarget.getBoundingClientRect();musicAudio.currentTime=((e.clientX-r.left)/r.width)*musicAudio.duration;}
musicAudio.addEventListener('timeupdate',()=>{if(musicAudio.duration){document.getElementById('mSliderFill').style.width=(musicAudio.currentTime/musicAudio.duration)*100+'%';document.getElementById('mCurrentTime').textContent=formatTime(musicAudio.currentTime);document.getElementById('mDuration').textContent=formatTime(musicAudio.duration);}});
musicAudio.addEventListener('ended',nextMusic);
function formatTime(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0');}

window.addEventListener('load',()=>{if(welcomeAudio)setTimeout(()=>welcomeAudio.play().catch(()=>{}),1500);});

const socket=io();let chatUser=null;
function toggleChat(){document.getElementById('chatPanel').classList.toggle('open');}
function startChatSession(){const n=document.getElementById('chatNameInput').value.trim();const e=document.getElementById('chatEmailInput').value.trim();if(!n||!e)return;chatUser={name:n,email:e};socket.emit('register',{name:n,email:e});document.getElementById('chatLoginForm').style.display='none';document.getElementById('chatInputArea').style.display='block';loadChatMessages();}
async function loadChatMessages(){if(!chatUser)return;const r=await fetch('/api/msgs/'+chatUser.email);const ms=await r.json();const b=document.getElementById('chatBody');b.innerHTML=ms.map(m=>'<div class="fb-msg '+(m.sender===chatUser.email?'user':'admin')+'">'+m.message+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');b.scrollTop=b.scrollHeight;}
function sendChatMsg(){const i=document.getElementById('chatMsgInput');const m=i.value.trim();if(!m||!chatUser)return;socket.emit('sendMsg',{sender:chatUser.email,receiver:'admin@baillamaach.com',message:m,type:'text'});i.value='';}
socket.on('newMsg',(m)=>{if(chatUser&&(m.sender===chatUser.email||m.receiver===chatUser.email)){const b=document.getElementById('chatBody');b.insertAdjacentHTML('beforeend','<div class="fb-msg '+(m.sender===chatUser.email?'user':'admin')+'">'+m.message+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');b.scrollTop=b.scrollHeight;}});
</script>
</body>
</html>`);
});

// API Routes
app.get('/api/msgs/:email', async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { sender: req.params.email, receiver: 'admin@baillamaach.com' },
        { sender: 'admin@baillamaach.com', receiver: req.params.email }
      ]
    }).sort({ timestamp: 1 }).lean();
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email, isAdmin: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: 'ok', message: 'Login successful' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({ isAdmin: false }).sort({ lastSeen: -1 }).lean();
    for (let u of users) {
      u.unreadCount = await Message.countDocuments({ sender: u.email, receiver: 'admin@baillamaach.com', seen: false });
    }
    res.json(users);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Messenger | Baiilla Maach Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;background:#f0f2f5;height:100vh;overflow:hidden;color:#1c1e21;font-size:0.9375rem}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000}
.login-card{background:#fff;padding:24px;border-radius:8px;width:396px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,0.15)}
.login-card h2{font-size:1.25rem;font-weight:700;color:#1c1e21;margin-bottom:4px}
.login-card .subtitle{font-size:0.9375rem;color:#65676b;margin-bottom:16px}
.login-card .input-group{margin-bottom:12px;text-align:left}
.login-card .input-group input{width:100%;padding:10px 12px;border:1px solid #ccd0d5;border-radius:6px;font-size:0.9375rem;outline:none;font-family:'Segoe UI',sans-serif}
.login-card .input-group input:focus{border-color:#1b74e4;box-shadow:0 0 0 2px rgba(27,116,228,0.2)}
.login-card button{width:100%;padding:10px;background:#1b74e4;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:1rem;font-family:'Segoe UI',sans-serif;transition:all 0.2s}
.login-card button:hover{background:#1668d3}
.login-card button:disabled{opacity:0.6;cursor:not-allowed}
.login-error{color:#e41e3f;font-size:0.8125rem;margin-top:8px;display:none}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.sidebar{width:338px;border-right:1px solid #e4e6eb;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:12px 14px;border-bottom:1px solid #e4e6eb;display:flex;justify-content:space-between;align-items:center;background:#f0f2f5}
.sidebar-header h2{font-size:1.0625rem;font-weight:700;color:#1c1e21}
.sidebar-header .logout-btn{background:none;border:none;color:#1b74e4;font-weight:600;cursor:pointer;font-size:0.9375rem}
.search-bar{padding:8px 14px;border-bottom:1px solid #e4e6eb;background:#f0f2f5}
.search-bar input{width:100%;padding:8px 12px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.9375rem;outline:none;background:#fff;font-family:'Segoe UI',sans-serif}
.search-bar input:focus{border-color:#1b74e4}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #f0f2f5;transition:background 0.15s}
.user-item:hover{background:#f0f2f5}
.user-item.active{background:#e7f3ff}
.user-avatar{width:40px;height:40px;border-radius:50%;background:#1b74e4;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9375rem;flex-shrink:0}
.user-info{flex:1;min-width:0}.user-info .name{font-weight:600;font-size:0.9375rem;color:#1c1e21}.user-info .email{font-size:0.8125rem;color:#65676b}
.unread{background:#1b74e4;color:#fff;font-size:0.75rem;padding:3px 7px;border-radius:10px;font-weight:600;flex-shrink:0}
.chat-area{flex:1;display:flex;flex-direction:column;background:#fff}
.chat-header{padding:10px 14px;border-bottom:1px solid #e4e6eb;display:flex;align-items:center;gap:10px;background:#f0f2f5}
.chat-header .avatar{width:36px;height:36px;border-radius:50%;background:#1b74e4;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.875rem}
.chat-header .name{font-weight:600;font-size:0.9375rem;color:#1c1e21}
.chat-messages{flex:1;overflow-y:auto;padding:12px 14px;background:#f0f2f5}
.message{max-width:65%;padding:7px 10px;border-radius:18px;font-size:0.8125rem;line-height:1.34;margin-bottom:4px}
.message.sent{background:#1b74e4;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.message.received{background:#e4e6eb;color:#1c1e21;border-bottom-left-radius:4px}
.message .time{font-size:0.6875rem;opacity:0.7;margin-top:2px;text-align:right}
.chat-input{padding:10px 14px;border-top:1px solid #e4e6eb;display:none;background:#fff}
.chat-input input{flex:1;padding:8px 12px;border:1px solid #ccd0d5;border-radius:20px;font-size:0.9375rem;outline:none;font-family:'Segoe UI',sans-serif}
.chat-input input:focus{border-color:#1b74e4}
.chat-input button{background:#1b74e4;color:#fff;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:0.9rem;margin-left:6px}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <h2>🔐 Admin Messenger</h2><p class="subtitle">Baiilla Maach Support Panel</p>
    <div class="input-group"><input type="email" id="loginEmail" placeholder="Email" value="admin@baillamaach.com"></div>
    <div class="input-group"><input type="password" id="loginPassword" placeholder="Password" value="admin123"></div>
    <button id="loginBtn" onclick="doLogin()">Sign In</button>
    <div class="login-error" id="loginError"></div>
  </div>
</div>
<div class="app" id="app">
  <div class="app-layout">
    <div class="sidebar"><div class="sidebar-header"><h2>💬 Conversations</h2><button class="logout-btn" onclick="doLogout()">Logout</button></div><div class="search-bar"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div><div class="user-list" id="userList"></div></div>
    <div class="chat-area"><div class="chat-header"><div class="avatar" id="chatAvatar">?</div><div><div class="name" id="chatName">Select user</div><div id="chatStatus"></div></div></div><div class="chat-messages" id="chatMessages"></div><div class="chat-input" id="chatInputArea"><div style="display:flex;align-items:center"><input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()"><button onclick="sendMessage()">➤</button></div></div></div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
let socket,currentUser,users=[],messages=[],isLoggedIn=false;
socket=io();
socket.on('newMsg',(m)=>{if(currentUser&&((m.sender===currentUser.email&&m.receiver==='admin@baillamaach.com')||(m.sender==='admin@baillamaach.com'&&m.receiver===currentUser.email))){messages.push(m);renderMessages();}loadUsers();});
socket.on('userStatus',(d)=>{updateUserStatus(d.email,d.online);});

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value.trim();
  const errDiv=document.getElementById('loginError');
  const btn=document.getElementById('loginBtn');
  errDiv.style.display='none';
  if(!email||!password){errDiv.textContent='Please fill all fields';errDiv.style.display='block';return;}
  btn.disabled=true;btn.textContent='Signing in...';
  try{
    const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const data=await res.json();
    if(res.ok){
      isLoggedIn=true;
      localStorage.setItem('adminSession',JSON.stringify({email,password}));
      document.getElementById('loginOverlay').style.display='none';
      document.getElementById('app').style.display='block';
      loadUsers();
    }else{errDiv.textContent='❌ '+ (data.error || 'Login failed');errDiv.style.display='block';}
  }catch(e){errDiv.textContent='❌ Network error';errDiv.style.display='block';}
  btn.disabled=false;btn.textContent='Sign In';
}

async function loadUsers(){if(!isLoggedIn)return;try{const res=await fetch('/api/admin/users');users=await res.json();renderUserList();}catch(e){}}
function selectUser(u){currentUser=u;document.getElementById('chatAvatar').textContent=u.name.charAt(0).toUpperCase();document.getElementById('chatName').textContent=u.name;document.getElementById('chatStatus').innerHTML=u.isOnline?'<span style="color:#10b981">● Online</span>':'<span style="color:#65676b">● Offline</span>';document.getElementById('chatInputArea').style.display='block';document.querySelectorAll('.user-item').forEach(el=>el.classList.remove('active'));const el=document.querySelector('.user-item[data-email="'+u.email+'"]');if(el)el.classList.add('active');loadMessages();socket.emit('markRead',{user:u.email});}
async function loadMessages(){if(!currentUser)return;try{const res=await fetch('/api/msgs/'+currentUser.email);const all=await res.json();messages=all.filter(m=>(m.sender===currentUser.email&&m.receiver==='admin@baillamaach.com')||(m.sender==='admin@baillamaach.com'&&m.receiver===currentUser.email));renderMessages();}catch(e){}}
function renderMessages(){const c=document.getElementById('chatMessages');if(messages.length===0){c.innerHTML='<div style="text-align:center;color:#65676b;padding:40px">No messages yet</div>';return;}c.innerHTML=messages.map(m=>{const s=m.sender==='admin@baillamaach.com';const t=new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return'<div class="message '+(s?'sent':'received')+'">'+m.message+'<div class="time">'+t+'</div></div>';}).join('');c.scrollTop=c.scrollHeight;}
function sendMessage(){const i=document.getElementById('msgInput');const m=i.value.trim();if(!m||!currentUser)return;socket.emit('sendMsg',{sender:'admin@baillamaach.com',receiver:currentUser.email,message:m,type:'text'});messages.push({sender:'admin@baillamaach.com',receiver:currentUser.email,message:m,type:'text',timestamp:new Date()});renderMessages();i.value='';i.focus();}
function updateUserStatus(e,o){if(currentUser&&currentUser.email===e){document.getElementById('chatStatus').innerHTML=o?'<span style="color:#10b981">● Online</span>':'<span style="color:#65676b">● Offline</span>';}}
function renderUserList(){const c=document.getElementById('userList');const s=document.getElementById('searchInput')?.value?.toLowerCase()||'';const f=users.filter(u=>u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s));if(f.length===0){c.innerHTML='<div style="text-align:center;color:#65676b;padding:40px">No users</div>';return;}c.innerHTML=f.map(u=>{const a=currentUser&&currentUser.email===u.email;return'<div class="user-item'+(a?' active':'')+'" data-email="'+u.email+'" onclick="selectUserById(\''+u.email+'\')"><div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':'')+'</div>';}).join('');}
function selectUserById(e){const u=users.find(u=>u.email===e);if(u)selectUser(u);}
function filterUsers(){renderUserList();}
function doLogout(){localStorage.removeItem('adminSession');location.reload();}
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('loginPassword').addEventListener('keypress',e=>{if(e.key==='Enter')doLogin();});const saved=localStorage.getItem('adminSession');if(saved){const s=JSON.parse(saved);document.getElementById('loginEmail').value=s.email;document.getElementById('loginPassword').value=s.password;}});
setInterval(()=>{if(isLoggedIn)loadUsers();},30000);
</script>
</body>
</html>`);
});

io.on('connection', (socket) => {
  socket.on('register', async (data) => {
    try {
      socket.userData = data;
      let user = await User.findOne({ email: data.email });
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
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
    try { await Message.updateMany({ sender: data.user, receiver: 'admin@baillamaach.com', seen: false }, { $set: { seen: true } }); } catch (err) {}
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
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('📧 Messenger: http://localhost:' + PORT + '/messenger');
  console.log('📧 Admin: admin@baillamaach.com | 🔑 Pass: admin123');
});

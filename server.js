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
    if (!existingAdmin) {
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

// ==================== PUBLIC WEBSITE (NO CHAT BUTTON) ====================
app.get('/', (req, res) => {
  const songs = getSongs();

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#8b5cf6">
<title>Baiilla Maach — Official Hub | Hammad Bin Amir</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0a0a0f; --surface: #12121a; --surface2: #1a1a26; --surface3: #222233;
  --border: #2a2a3a; --text: #e4e4f0; --text2: #a0a0b8; --text3: #6a6a80;
  --purple: #8b5cf6; --purple2: #a78bfa; --pink: #ec4899; --cyan: #06b6d4;
  --amber: #f59e0b; --emerald: #10b981; --red: #ef4444;
  --grad1: linear-gradient(135deg, #8b5cf6, #ec4899);
  --grad2: linear-gradient(135deg, #06b6d4, #8b5cf6);
  --grad3: linear-gradient(135deg, #f59e0b, #ec4899);
  --glow-purple: 0 0 30px rgba(139,92,246,0.3);
  --glow-cyan: 0 0 30px rgba(6,182,212,0.3);
  --radius: 24px; --radius-sm: 14px; --radius-xs: 8px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Manrope', 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: var(--surface); } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.glass-header { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 1000; width: 90%; max-width: 1200px; background: rgba(18,18,26,0.7); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 60px; padding: 12px 28px; display: flex; justify-content: space-between; align-items: center; }
.glass-header .logo-group { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.glass-header .logo-group img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--purple); }
.glass-header .logo-group .logo-text { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 1em; color: var(--text); }
.glass-header .logo-group .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--purple); animation: pulse-dot 2s infinite; }
@keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.6); } 50% { box-shadow: 0 0 0 12px rgba(139,92,246,0); } }
.btn-glass { padding: 10px 20px; border-radius: 40px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text); font-weight: 600; font-size: 0.82em; cursor: pointer; transition: all 0.3s; text-decoration: none; display: flex; align-items: center; gap: 6px; font-family: 'Manrope', sans-serif; }
.btn-glass:hover { background: rgba(139,92,246,0.15); border-color: var(--purple); box-shadow: var(--glow-purple); }
.btn-glass.accent { background: var(--grad1); border: none; color: #fff; }
.btn-glass.accent:hover { box-shadow: 0 0 30px rgba(236,72,153,0.3); transform: translateY(-2px); }

.hero-v2 { padding: 140px 20px 80px; text-align: center; position: relative; overflow: hidden; }
.hero-v2::before { content: ''; position: absolute; top: -200px; left: 50%; transform: translateX(-50%); width: 600px; height: 600px; background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%); pointer-events: none; }
.hero-card { display: inline-block; background: var(--surface); border: 1px solid var(--border); border-radius: 40px; padding: 40px 50px; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
.hero-card .avatar-ring { width: 130px; height: 130px; border-radius: 50%; padding: 4px; background: var(--grad1); margin: 0 auto 20px; }
.hero-card .avatar-ring img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 4px solid var(--bg); }
.hero-card .verified-chip { display: inline-flex; align-items: center; gap: 5px; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); padding: 6px 14px; border-radius: 30px; font-size: 0.75em; font-weight: 600; color: var(--purple2); margin-bottom: 14px; }
.hero-card .verified-chip svg { width: 14px; height: 14px; fill: var(--purple2); }
.hero-card h1 { font-family: 'Space Grotesk', sans-serif; font-size: 2em; font-weight: 700; color: var(--text); letter-spacing: -0.5px; margin-bottom: 3px; }
.hero-card .username-text { font-family: 'DM Sans', sans-serif; font-size: 0.9em; color: var(--text2); margin-bottom: 3px; }
.hero-card .bio-text { color: var(--text3); font-size: 0.82em; margin-bottom: 16px; }
.hero-stats-row { display: flex; gap: 30px; justify-content: center; margin: 16px 0; padding: 14px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.hero-stats-row .stat-item { text-align: center; }
.hero-stats-row .stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.3em; font-weight: 700; color: var(--text); }
.hero-stats-row .stat-label { font-size: 0.68em; color: var(--text3); text-transform: uppercase; letter-spacing: 2px; }
.hero-social-links { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
.social-pill { padding: 10px 22px; border-radius: 40px; text-decoration: none; font-weight: 600; font-size: 0.8em; display: flex; align-items: center; gap: 7px; transition: all 0.3s; border: 1px solid var(--border); color: var(--text); background: var(--surface2); }
.social-pill:hover { transform: translateY(-3px); }
.social-pill.tiktok-pill { border-color: rgba(6,182,212,0.4); } .social-pill.tiktok-pill:hover { background: rgba(6,182,212,0.1); border-color: var(--cyan); box-shadow: var(--glow-cyan); }
.social-pill.fb-pill { border-color: rgba(139,92,246,0.4); } .social-pill.fb-pill:hover { background: rgba(139,92,246,0.1); border-color: var(--purple); box-shadow: var(--glow-purple); }
.social-pill img { width: 18px; height: 18px; }

.section-dark { padding: 80px 20px; } .section-dark.alt { background: var(--surface); }
.container-v2 { max-width: 1000px; margin: 0 auto; }
.section-eyebrow { display: inline-block; font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; background: var(--grad1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 10px; }
.section-title { font-family: 'Space Grotesk', sans-serif; font-size: 2em; font-weight: 700; color: var(--text); text-align: center; letter-spacing: -0.5px; margin-bottom: 6px; }
.section-subtitle { text-align: center; color: var(--text3); margin-bottom: 40px; font-size: 0.85em; }

.v-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.v-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; transition: all 0.3s; }
.v-card:hover { border-color: rgba(16,185,129,0.4); transform: translateY(-4px); box-shadow: 0 15px 40px rgba(0,0,0,0.3); }
.v-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.v-card-header .v-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.v-card-header .v-info h4 { font-family: 'Space Grotesk', sans-serif; font-size: 0.95em; font-weight: 600; display: flex; align-items: center; gap: 5px; }
.v-card-header .v-info h4 img { width: 16px; height: 16px; }
.v-card-header .v-info .v-handle { font-size: 0.78em; color: var(--text3); font-family: 'DM Sans', sans-serif; }
.v-detail { font-size: 0.8em; color: var(--text2); padding: 4px 0; display: flex; align-items: center; gap: 6px; } .v-detail strong { color: var(--text); }
.v-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 0.78em; margin-top: 12px; transition: all 0.3s; }
.v-btn.tiktok-v { background: var(--grad2); color: #fff; } .v-btn.tiktok-v:hover { box-shadow: var(--glow-cyan); transform: translateY(-2px); }
.v-btn.fb-v { background: var(--grad1); color: #fff; } .v-btn.fb-v:hover { box-shadow: var(--glow-purple); transform: translateY(-2px); }

.f-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.f-card { background: var(--surface2); border: 1px solid rgba(239,68,68,0.4); border-radius: var(--radius); overflow: hidden; transition: all 0.3s; }
.f-card:hover { border-color: var(--red); box-shadow: 0 0 30px rgba(239,68,68,0.2); }
.f-card .f-img-wrap { position: relative; text-align: center; padding: 20px; background: var(--surface3); }
.f-card .f-img-wrap img.f-img { max-width: 100%; border-radius: var(--radius-xs); }
.f-card .f-img-wrap .f-stamp { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); background: rgba(239,68,68,0.9); color: #fff; padding: 8px 20px; border-radius: 6px; font-weight: 800; font-size: 1em; letter-spacing: 2px; border: 2px solid #fff; }
.f-card .f-body { padding: 18px; } .f-card .f-body h4 { font-family: 'Space Grotesk', sans-serif; font-size: 0.95em; font-weight: 600; margin-bottom: 3px; }
.f-card .f-body .f-platform { color: var(--amber); font-size: 0.75em; font-weight: 600; margin-bottom: 6px; }
.f-card .f-body p { color: var(--text3); font-size: 0.8em; margin-bottom: 12px; }
.f-report-btn { display: inline-flex; align-items: center; gap: 5px; background: var(--red); color: #fff; padding: 8px 18px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 0.76em; transition: all 0.3s; } .f-report-btn:hover { background: #dc2626; }

.p-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.p-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 20px; text-align: center; transition: all 0.3s; }
.p-card:hover { border-color: var(--purple); box-shadow: 0 0 20px rgba(139,92,246,0.15); }
.p-card img { width: 100%; border-radius: var(--radius-xs); margin-bottom: 10px; }
.p-card .p-label { font-weight: 600; font-size: 0.8em; color: var(--text2); }
.real-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); padding: 7px 16px; border-radius: 30px; margin-top: 10px; font-weight: 600; font-size: 0.8em; color: var(--emerald); }
.real-badge svg { width: 16px; height: 16px; fill: var(--emerald); }

.voice-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.voice-chip { padding: 12px 26px; border-radius: 40px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-weight: 600; cursor: pointer; font-size: 0.82em; display: flex; align-items: center; gap: 8px; transition: all 0.3s; font-family: 'Manrope', sans-serif; }
.voice-chip:hover { border-color: var(--purple); } .voice-chip.welcome-chip { border-color: rgba(139,92,246,0.5); } .voice-chip.welcome-chip:hover { background: rgba(139,92,246,0.1); box-shadow: var(--glow-purple); }
.voice-chip.alert-chip { border-color: rgba(239,68,68,0.5); } .voice-chip.alert-chip:hover { background: rgba(239,68,68,0.1); }

.music-container { max-width: 600px; margin: 0 auto; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 30px; }
.music-now { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.music-now .m-cover { width: 100px; height: 100px; border-radius: 16px; object-fit: cover; box-shadow: 0 10px 30px rgba(0,0,0,0.4); flex-shrink: 0; }
.music-now .m-info { flex: 1; min-width: 0; } .music-now .m-info .m-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 1.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.music-now .m-info .m-artist { color: var(--purple2); font-size: 0.8em; font-weight: 500; }
.m-slider { width: 100%; height: 3px; background: var(--border); border-radius: 2px; cursor: pointer; margin: 10px 0; }
.m-slider-fill { height: 100%; background: var(--grad1); border-radius: 2px; width: 0%; transition: width 0.1s linear; }
.m-time-row { display: flex; justify-content: space-between; font-size: 0.68em; color: var(--text3); margin-bottom: 12px; }
.m-controls { display: flex; align-items: center; justify-content: center; gap: 16px; }
.m-ctrl { background: none; border: none; color: var(--text2); cursor: pointer; font-size: 1em; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s; } .m-ctrl:hover { color: var(--text); background: var(--surface3); }
.m-play { width: 50px; height: 50px; border-radius: 50%; border: none; background: var(--grad1); color: #fff; font-size: 1.1em; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; } .m-play:hover { transform: scale(1.06); box-shadow: var(--glow-purple); } .m-play.playing { background: var(--grad3); }
.m-song-list { margin-top: 16px; max-height: 200px; overflow-y: auto; border-top: 1px solid var(--border); padding-top: 8px; }
.m-song-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-xs); cursor: pointer; transition: all 0.2s; font-size: 0.8em; color: var(--text2); } .m-song-item:hover { background: var(--surface3); color: var(--text); }
.m-song-item.active { background: rgba(139,92,246,0.1); color: var(--purple2); } .m-song-item .m-num { font-weight: 700; color: var(--text3); min-width: 22px; } .m-song-item.active .m-num { color: var(--purple2); }
.m-song-item .m-song-cover-mini { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; }
.m-song-item .m-song-info { flex: 1; min-width: 0; } .m-song-item .m-song-info .m-song-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; } .m-song-item .m-song-info .m-song-artist { font-size: 0.73em; color: var(--text3); }

.footer-v2 { background: var(--surface); border-top: 1px solid var(--border); padding: 50px 20px 30px; text-align: center; }
.footer-v2 .footer-grid-v2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 30px; max-width: 900px; margin: 0 auto 30px; text-align: left; }
.footer-v2 h5 { font-family: 'Space Grotesk', sans-serif; color: var(--purple2); margin-bottom: 10px; font-size: 0.85em; }
.footer-v2 p, .footer-v2 a { color: var(--text3); font-size: 0.76em; line-height: 2; text-decoration: none; display: block; transition: all 0.3s; } .footer-v2 a:hover { color: var(--purple2); }
.footer-v2 .footer-line { border-top: 1px solid var(--border); padding-top: 20px; font-size: 0.72em; color: var(--text3); } .footer-v2 .footer-line span { color: var(--purple2); font-weight: 600; }

@media(max-width: 768px) { .glass-header { width: 95%; padding: 10px 18px; } .hero-card { padding: 30px 24px; border-radius: 30px; } .hero-card h1 { font-size: 1.5em; } .v-grid, .f-grid { grid-template-columns: 1fr; } .p-grid { grid-template-columns: 1fr; } .music-now { flex-direction: column; text-align: center; } }
</style>
</head>
<body>

<header class="glass-header">
  <a href="/" class="logo-group"><img src="${ASSETS.profile}" alt="Logo" onerror="this.style.display='none'"><span class="logo-text">Baiilla Maach</span><span class="logo-dot"></span></a>
</header>

<section class="hero-v2">
  <div class="hero-card">
    <div class="avatar-ring"><img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'"></div>
    <div class="verified-chip"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified Creator</div>
    <h1>Hammad Bin Amir</h1>
    <p class="username-text">@baiillamaach_official</p>
    <p class="bio-text">Official Entertainment · Verified</p>
    <div class="hero-stats-row">
      <div class="stat-item"><div class="stat-value">7K</div><div class="stat-label">Followers</div></div>
      <div class="stat-item"><div class="stat-value">0</div><div class="stat-label">Following</div></div>
      <div class="stat-item"><div class="stat-value">190K</div><div class="stat-label">Likes</div></div>
    </div>
    <div class="hero-social-links">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="social-pill tiktok-pill"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="social-pill fb-pill"><img src="${ASSETS.logoFB}" alt=""> Facebook</a>
    </div>
  </div>
</section>

<section class="section-dark">
  <div class="container-v2">
    <span class="section-eyebrow">Authentic</span>
    <h2 class="section-title">Official Accounts</h2>
    <p class="section-subtitle">Real verified profiles only</p>
    <div class="v-grid">
      <div class="v-card"><div class="v-card-header"><img src="${ASSETS.profile}" class="v-avatar"><div class="v-info"><h4>TikTok <img src="${ASSETS.blueTikTok}"></h4><p class="v-handle">@baiillamaach_official</p></div></div><div class="v-detail">✓ Status: <strong>Active & Verified</strong></div><div class="v-detail">👥 Followers: <strong>7,000</strong></div><div class="v-detail">❤️ Likes: <strong>190,000</strong></div><a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="v-btn tiktok-v">Follow on TikTok</a></div>
      <div class="v-card"><div class="v-card-header"><img src="${ASSETS.fbProfile}" class="v-avatar"><div class="v-info"><h4>Facebook <img src="${ASSETS.blueFB}"></h4><p class="v-handle">@BaiillaMaachOfficial</p></div></div><div class="v-detail">✓ Status: <strong>Active & Verified</strong></div><div class="v-detail">📘 Page: <strong>Official Facebook</strong></div><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="v-btn fb-v">Follow on Facebook</a></div>
    </div>
  </div>
</section>

<section class="section-dark alt">
  <div class="container-v2">
    <span class="section-eyebrow" style="background:linear-gradient(135deg,#ef4444,#f87171);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Warning</span>
    <h2 class="section-title">Fake Accounts</h2>
    <p class="section-subtitle">Report these immediately</p>
    <div class="f-grid">
      <div class="f-card"><div class="f-img-wrap"><img src="${ASSETS.baillamachFake}" class="f-img" alt="Fake"><div class="f-stamp">FAKE</div></div><div class="f-body"><h4>@baiilla_mach</h4><p class="f-platform">📍 TikTok</p><p>Copies official content to deceive followers.</p><a href="https://tiktok.com/@baiilla_mach" target="_blank" class="f-report-btn">🚨 Report Account</a></div></div>
      <div class="f-card"><div class="f-img-wrap"><img src="${ASSETS.hammadFake}" class="f-img" alt="Fake"><div class="f-stamp">FAKE</div></div><div class="f-body"><h4>@hammad_fams0</h4><p class="f-platform">📍 TikTok</p><p>Impersonating with fake content.</p><a href="https://tiktok.com/@hammad_fams0" target="_blank" class="f-report-btn">🚨 Report Account</a></div></div>
    </div>
  </div>
</section>

<section class="section-dark">
  <div class="container-v2">
    <span class="section-eyebrow">Proof</span>
    <h2 class="section-title">Identity Verification</h2>
    <p class="section-subtitle">Evidence confirming authenticity</p>
    <div class="p-grid">
      <div class="p-card"><img src="${ASSETS.realId}" alt="Real ID"><p class="p-label">Real ID Verified</p><div class="real-badge"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> Real Account</div></div>
      <div class="p-card"><img src="${ASSETS.microphone}" alt="Voice"><p class="p-label">Real Voice Recording</p></div>
      <div class="p-card"><img src="${ASSETS.fakeDetect}" alt="Verification"><p class="p-label">Official Verification</p></div>
    </div>
  </div>
</section>

${WELCOME_VOICE || MANUAL_VOICE ? `
<section class="section-dark alt">
  <div class="container-v2" style="text-align:center">
    <span class="section-eyebrow">Voice</span>
    <h2 class="section-title">Voice Verification</h2>
    <p class="section-subtitle">Listen to authentic voice</p>
    <div class="voice-row">
      ${WELCOME_VOICE ? `<button class="voice-chip welcome-chip" onclick="playWelcomeVoice()">▶️ Real Voice</button>` : ''}
      ${MANUAL_VOICE ? `<button class="voice-chip alert-chip" onclick="playManualVoice()">⚠️ Fake Alert</button>` : ''}
    </div>
  </div>
</section>` : ''}

${songs.length > 0 ? `
<section class="section-dark">
  <div class="container-v2">
    <span class="section-eyebrow">Music</span>
    <h2 class="section-title">Cover Songs</h2>
    <p class="section-subtitle">Official covers by Hammad Bin Amir</p>
    <div class="music-container">
      <div class="music-now">
        <img src="${ASSETS.microphone}" class="m-cover" id="mCover" alt="Cover" onerror="this.src='${ASSETS.profile}'">
        <div class="m-info"><div class="m-title" id="mTitle">Select a Song</div><div class="m-artist">Baiilla Maach</div></div>
      </div>
      <div class="m-slider" onclick="seekMusic(event)"><div class="m-slider-fill" id="mSliderFill"></div></div>
      <div class="m-time-row"><span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span></div>
      <div class="m-controls">
        <button class="m-ctrl" onclick="prevMusic()">⏮</button>
        <button class="m-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
        <button class="m-ctrl" onclick="nextMusic()">⏭</button>
      </div>
      <div class="m-song-list">
        ${songs.map((s, i) => `<div class="m-song-item" onclick="playMusic(${i})"><span class="m-num">${String(i+1).padStart(2,'0')}</span><img src="${ASSETS.microphone}" class="m-song-cover-mini" alt=""><div class="m-song-info"><div class="m-song-name">${s.title}</div><div class="m-song-artist">Baiilla Maach</div></div></div>`).join('')}
      </div>
    </div>
  </div>
</section>` : ''}

<footer class="footer-v2">
  <div class="footer-grid-v2">
    <div><h5>About</h5><p>Official verification hub for Baiilla Maach.</p></div>
    <div><h5>Links</h5><a href="https://tiktok.com/@baiillamaach_official">→ TikTok</a><a href="https://www.facebook.com/profile.php?id=61575202118828">→ Facebook</a></div>
    <div><h5>Contact</h5><p>Direct message on social media</p></div>
  </div>
  <div class="footer-line">© 2024 <span>Baiilla Maach</span>. All rights reserved.</div>
</footer>

${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>` : ''}
${MANUAL_VOICE ? `<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>` : ''}
<audio id="musicAudio" preload="auto"></audio>

<script>
const welcomeAudio=document.getElementById('welcomeAudio');
const manualAudio=document.getElementById('manualAudio');
const musicAudio=document.getElementById('musicAudio');
function stopAllAudio(){if(welcomeAudio){welcomeAudio.pause();welcomeAudio.currentTime=0;}if(manualAudio){manualAudio.pause();manualAudio.currentTime=0;}if(musicAudio){musicAudio.pause();}}
function playWelcomeVoice(){if(!welcomeAudio)return;stopAllAudio();musicPlaying=false;updatePlayBtn();welcomeAudio.play().catch(()=>{});}
function playManualVoice(){if(!manualAudio)return;stopAllAudio();musicPlaying=false;updatePlayBtn();manualAudio.play().catch(()=>{});}

const tracks=${JSON.stringify(songs)};
let currentTrack=0,musicPlaying=false;
function updatePlayBtn(){const b=document.getElementById('mPlayBtn');if(musicPlaying){b.textContent='⏸';b.classList.add('playing');}else{b.textContent='▶';b.classList.remove('playing');}}
function playMusic(i){stopAllAudio();currentTrack=i;musicAudio.src=tracks[i].url;musicAudio.play().then(()=>{musicPlaying=true;updatePlayBtn();updateMusicUI(i);}).catch(()=>{});}
function updateMusicUI(i){document.getElementById('mTitle').textContent=tracks[i].title;document.querySelectorAll('.m-song-item').forEach((el,j)=>el.classList.toggle('active',j===i));}
function toggleMusic(){if(musicAudio.paused){stopAllAudio();if(!musicAudio.src){musicAudio.src=tracks[currentTrack].url;}musicAudio.play().then(()=>{musicPlaying=true;updatePlayBtn();updateMusicUI(currentTrack);}).catch(()=>{});}else{musicAudio.pause();musicPlaying=false;updatePlayBtn();}}
function prevMusic(){playMusic((currentTrack-1+tracks.length)%tracks.length);}
function nextMusic(){playMusic((currentTrack+1)%tracks.length);}
function seekMusic(e){if(!musicAudio.duration)return;const r=e.currentTarget.getBoundingClientRect();musicAudio.currentTime=((e.clientX-r.left)/r.width)*musicAudio.duration;}
musicAudio.addEventListener('timeupdate',()=>{if(musicAudio.duration){document.getElementById('mSliderFill').style.width=(musicAudio.currentTime/musicAudio.duration)*100+'%';document.getElementById('mCurrentTime').textContent=formatTime(musicAudio.currentTime);document.getElementById('mDuration').textContent=formatTime(musicAudio.duration);}});
musicAudio.addEventListener('ended',nextMusic);
function formatTime(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0');}
window.addEventListener('load',()=>{if(welcomeAudio)setTimeout(()=>welcomeAudio.play().catch(()=>{}),1500);});
</script>
</body>
</html>`);
});

// ==================== ADMIN DASHBOARD (deo/login) ====================
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>deo/login • Admin Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    
    .login-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.97); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(10px); }
    .login-card { background: #1e293b; padding: 2.5rem 2rem; border-radius: 24px; width: 420px; max-width: 90%; text-align: center; border: 1px solid #334155; box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
    .login-card .login-icon { font-size: 2.8rem; color: #818cf8; margin-bottom: 0.5rem; }
    .login-card h2 { font-family: 'Space Grotesk', sans-serif; color: #f1f5f9; font-size: 1.8rem; margin-bottom: 0.2rem; letter-spacing: -0.5px; }
    .login-card .subtitle { color: #818cf8; font-size: 0.8rem; font-weight: 600; margin-bottom: 1.8rem; letter-spacing: 2px; text-transform: uppercase; }
    .input-group { margin-bottom: 1.2rem; text-align: left; }
    .input-group label { display: block; color: #94a3b8; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 1px; }
    .input-group input { width: 100%; padding: 0.8rem 1rem; background: #0f172a; border: 1.5px solid #334155; border-radius: 12px; color: #e2e8f0; font-size: 0.95rem; font-family: 'Inter', sans-serif; outline: none; transition: all 0.2s; }
    .input-group input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15); }
    .login-btn { width: 100%; padding: 0.85rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s; font-family: 'Inter', sans-serif; letter-spacing: 0.5px; }
    .login-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(99, 102, 241, 0.35); }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .login-error { color: #f87171; font-size: 0.82rem; margin-top: 0.8rem; display: none; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.6s linear infinite; margin-right: 6px; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .dashboard { display: none; width: 100%; height: 100vh; flex-direction: column; }
    .dash-header { background: #1e293b; border-bottom: 1px solid #334155; padding: 0 2rem; height: 68px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .dash-header .brand { display: flex; align-items: center; gap: 0.6rem; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 1.1rem; color: #f1f5f9; }
    .dash-header .brand i { color: #818cf8; font-size: 1.3rem; }
    .dash-header .brand .page-sub { color: #818cf8; font-size: 0.7rem; font-weight: 600; margin-left: 0.3rem; background: rgba(129, 140, 248, 0.12); padding: 0.2rem 0.7rem; border-radius: 20px; letter-spacing: 1px; }
    .dash-header .header-right { display: flex; align-items: center; gap: 0.8rem; }
    .online-badge { background: rgba(16, 185, 129, 0.12); color: #10b981; padding: 0.35rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 5px; border: 1px solid rgba(16, 185, 129, 0.25); }
    .online-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; animation: pulse-dot 2s infinite; }
    @keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); } 50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } }
    .logout-btn { background: rgba(239, 68, 68, 0.08); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); padding: 0.45rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.78rem; transition: all 0.2s; display: flex; align-items: center; gap: 5px; }
    .logout-btn:hover { background: rgba(239, 68, 68, 0.18); }
    
    .dash-body { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 340px; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; flex-shrink: 0; }
    .sidebar-header { padding: 1rem 1.2rem; border-bottom: 1px solid #334155; }
    .sidebar-header h3 { font-family: 'Space Grotesk', sans-serif; font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.6rem; }
    .sidebar-header input { width: 100%; padding: 0.55rem 0.9rem; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 0.82rem; outline: none; font-family: 'Inter', sans-serif; }
    .sidebar-header input:focus { border-color: #818cf8; }
    .user-list { flex: 1; overflow-y: auto; }
    .user-item { padding: 0.85rem 1.2rem; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid rgba(51, 65, 85, 0.4); transition: all 0.2s; }
    .user-item:hover { background: rgba(129, 140, 248, 0.05); }
    .user-item.active { background: rgba(129, 140, 248, 0.1); border-left: 3px solid #818cf8; }
    .user-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85em; flex-shrink: 0; position: relative; }
    .user-avatar .online-dot { position: absolute; bottom: 1px; right: 1px; width: 9px; height: 9px; border-radius: 50%; background: #10b981; border: 2px solid #1e293b; }
    .user-avatar .offline-dot { position: absolute; bottom: 1px; right: 1px; width: 9px; height: 9px; border-radius: 50%; background: #64748b; border: 2px solid #1e293b; }
    .user-info { flex: 1; min-width: 0; }
    .user-info .name { font-weight: 600; font-size: 0.85rem; color: #f1f5f9; }
    .user-info .email { font-size: 0.72rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .unread-badge { background: #818cf8; color: #fff; font-size: 0.68rem; padding: 3px 8px; border-radius: 12px; font-weight: 700; min-width: 22px; text-align: center; }
    .empty-state { text-align: center; padding: 40px 20px; color: #64748b; }
    .empty-state i { font-size: 2.5rem; display: block; margin-bottom: 10px; opacity: 0.4; }
    
    .chat-area { flex: 1; display: flex; flex-direction: column; background: #0f172a; }
    .chat-header { padding: 0.9rem 1.5rem; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 10px; }
    .chat-header .chat-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85rem; }
    .chat-header .chat-name { font-weight: 600; font-size: 0.9rem; color: #f1f5f9; }
    .chat-header .chat-status { font-size: 0.72rem; color: #64748b; }
    .chat-header .chat-status.online { color: #10b981; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 1.2rem; display: flex; flex-direction: column; gap: 4px; }
    .message { max-width: 68%; padding: 0.6rem 1rem; border-radius: 14px; font-size: 0.84rem; line-height: 1.45; word-wrap: break-word; }
    .message.sent { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .message.received { background: #1e293b; color: #e2e8f0; align-self: flex-start; border: 1px solid #334155; border-bottom-left-radius: 4px; }
    .message .msg-time { font-size: 0.65rem; opacity: 0.7; margin-top: 4px; text-align: right; }
    .chat-input-area { padding: 0.9rem 1.2rem; background: #1e293b; border-top: 1px solid #334155; display: none; }
    .chat-input-row { display: flex; align-items: center; gap: 8px; }
    .chat-input-row input { flex: 1; padding: 0.65rem 1rem; background: #0f172a; border: 1px solid #334155; border-radius: 20px; color: #e2e8f0; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; }
    .chat-input-row input:focus { border-color: #818cf8; }
    .chat-input-row button { width: 38px; height: 38px; border-radius: 50%; border: none; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; cursor: pointer; font-size: 1rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
    .chat-input-row button:hover { transform: scale(1.05); box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
    
    @media(max-width: 768px) { .sidebar { width: 100%; position: absolute; z-index: 10; height: 100%; } .dash-body { flex-direction: column; } }
  </style>
</head>
<body>

<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <div class="login-icon"><i class="fas fa-shield-halved"></i></div>
    <h2>Admin Dashboard</h2>
    <p class="subtitle">deo/login</p>
    <div class="input-group">
      <label>Email</label>
      <input type="email" id="loginEmail" placeholder="admin@baillamaach.com" value="admin@baillamaach.com">
    </div>
    <div class="input-group">
      <label>Password</label>
      <input type="password" id="loginPassword" placeholder="Enter password">
    </div>
    <button class="login-btn" id="loginBtn" onclick="doLogin()">
      <i class="fas fa-lock"></i> Sign In
    </button>
    <div class="login-error" id="loginError"></div>
  </div>
</div>

<div class="dashboard" id="dashboard">
  <div class="dash-header">
    <div class="brand">
      <i class="fas fa-comments"></i> Messenger
      <span class="page-sub">deo/login</span>
    </div>
    <div class="header-right">
      <div class="online-badge"><span class="dot"></span> Admin Online</div>
      <button class="logout-btn" onclick="doLogout()"><i class="fas fa-right-from-bracket"></i> Logout</button>
    </div>
  </div>
  <div class="dash-body">
    <div class="sidebar">
      <div class="sidebar-header">
        <h3><i class="far fa-user"></i> Conversations</h3>
        <input type="text" id="searchInput" placeholder="Search fans..." oninput="filterUsers()">
      </div>
      <div class="user-list" id="userList">
        <div class="empty-state"><i class="far fa-comment-dots"></i><p>No conversations yet</p></div>
      </div>
    </div>
    <div class="chat-area">
      <div class="chat-header">
        <div class="chat-avatar" id="chatAvatar">?</div>
        <div>
          <div class="chat-name" id="chatName">Select a fan</div>
          <div class="chat-status" id="chatStatus">No user selected</div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="empty-state"><i class="far fa-envelope"></i><p>Select a conversation to start chatting</p></div>
      </div>
      <div class="chat-input-area" id="chatInputArea">
        <div class="chat-input-row">
          <input type="text" id="msgInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter')sendMessage()">
          <button onclick="sendMessage()"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let socket;
let currentUser = null;
let allUsers = [];
let messages = [];
let isLoggedIn = false;

// Initialize socket connection
function initSocket() {
  socket = io();
  socket.on('newMsg', (msg) => {
    if (currentUser && ((msg.sender === currentUser.email && msg.receiver === 'admin@baillamaach.com') || 
        (msg.sender === 'admin@baillamaach.com' && msg.receiver === currentUser.email))) {
      messages.push(msg);
      renderMessages();
    }
    loadUsers();
  });
  socket.on('userStatus', (data) => {
    updateUserStatus(data.email, data.online);
  });
}

// Login function
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  
  if (!email || !password) {
    errorEl.textContent = 'Please fill in all fields';
    errorEl.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in...';
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      isLoggedIn = true;
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('dashboard').style.display = 'flex';
      localStorage.setItem('adminSession', JSON.stringify({ email, password }));
      initSocket();
      loadUsers();
    } else {
      errorEl.textContent = data.error || 'Invalid credentials';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
  }
  
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-lock"></i> Sign In';
}

// Logout function
function doLogout() {
  localStorage.removeItem('adminSession');
  location.reload();
}

// Load users
async function loadUsers() {
  if (!isLoggedIn) return;
  try {
    const res = await fetch('/api/admin/users');
    allUsers = await res.json();
    renderUserList();
  } catch (err) {
    console.error('Failed to load users');
  }
}

// Select user to chat
async function selectUser(user) {
  currentUser = user;
  document.getElementById('chatAvatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('chatName').textContent = user.name;
  document.getElementById('chatStatus').textContent = user.isOnline ? 'Online' : 'Offline';
  document.getElementById('chatStatus').className = 'chat-status' + (user.isOnline ? ' online' : '');
  document.getElementById('chatInputArea').style.display = 'block';
  
  // Highlight active user
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector('.user-item[data-email="' + user.email + '"]');
  if (activeEl) activeEl.classList.add('active');
  
  await loadMessages();
  if (socket) socket.emit('markRead', { user: user.email });
}

// Load messages for selected user
async function loadMessages() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/msgs/' + currentUser.email);
    const allMsgs = await res.json();
    messages = allMsgs.filter(m => 
      (m.sender === currentUser.email && m.receiver === 'admin@baillamaach.com') ||
      (m.sender === 'admin@baillamaach.com' && m.receiver === currentUser.email)
    );
    renderMessages();
  } catch (err) {
    console.error('Failed to load messages');
  }
}

// Render messages
function renderMessages() {
  const container = document.getElementById('chatMessages');
  if (messages.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="far fa-envelope"></i><p>No messages yet</p></div>';
    return;
  }
  container.innerHTML = messages.map(m => {
    const isSent = m.sender === 'admin@baillamaach.com';
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return '<div class="message ' + (isSent ? 'sent' : 'received') + '">' + 
           m.message + '<div class="msg-time">' + time + '</div></div>';
  }).join('');
  container.scrollTop = container.scrollHeight;
}

// Send message
async function sendMessage() {
  const input = document.getElementById('msgInput');
  const msg = input.value.trim();
  if (!msg || !currentUser) return;
  
  socket.emit('sendMsg', {
    sender: 'admin@baillamaach.com',
    receiver: currentUser.email,
    message: msg,
    type: 'text'
  });
  
  messages.push({
    sender: 'admin@baillamaach.com',
    receiver: currentUser.email,
    message: msg,
    type: 'text',
    timestamp: new Date()
  });
  renderMessages();
  input.value = '';
  input.focus();
  setTimeout(() => loadUsers(), 500);
}

// Update user online status in UI
function updateUserStatus(email, online) {
  const dot = document.querySelector('.user-item[data-email="' + email + '"] .online-dot, .user-item[data-email="' + email + '"] .offline-dot');
  if (dot) {
    dot.className = online ? 'online-dot' : 'offline-dot';
  }
  if (currentUser && currentUser.email === email) {
    document.getElementById('chatStatus').textContent = online ? 'Online' : 'Offline';
    document.getElementById('chatStatus').className = 'chat-status' + (online ? ' online' : '');
  }
}

// Render user list
function renderUserList() {
  const container = document.getElementById('userList');
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filtered = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm) || 
    u.email.toLowerCase().includes(searchTerm)
  );
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="far fa-user"></i><p>No fans found</p></div>';
    return;
  }
  
  container.innerHTML = filtered.map(u => {
    const isActive = currentUser && currentUser.email === u.email;
    return '<div class="user-item' + (isActive ? ' active' : '') + '" data-email="' + u.email + '" onclick="selectUserByEmail(\'' + u.email + '\')">' +
           '<div class="user-avatar">' + u.name.charAt(0).toUpperCase() + 
           '<div class="' + (u.isOnline ? 'online-dot' : 'offline-dot') + '"></div></div>' +
           '<div class="user-info"><div class="name">' + u.name + '</div><div class="email">' + u.email + '</div></div>' +
           (u.unreadCount > 0 ? '<div class="unread-badge">' + u.unreadCount + '</div>' : '') +
           '</div>';
  }).join('');
}

function selectUserByEmail(email) {
  const user = allUsers.find(u => u.email === email);
  if (user) selectUser(user);
}

function filterUsers() {
  renderUserList();
}

// Check for saved session on load
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('adminSession');
  if (saved) {
    const creds = JSON.parse(saved);
    document.getElementById('loginEmail').value = creds.email;
    document.getElementById('loginPassword').value = creds.password;
    doLogin();
  }
  document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
  });
});

// Auto refresh users list
setInterval(() => {
  if (isLoggedIn) loadUsers();
}, 30000);
</script>
</body>
</html>`);
});

// ==================== FAN MESSENGER (Login to chat) ====================
app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Support • Baiilla Maach</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .chat-container { width: 420px; max-width: 95%; background: #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.4); border: 1px solid #334155; display: flex; flex-direction: column; height: 600px; max-height: 90vh; }
    .chat-header { padding: 1rem 1.2rem; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 10px; }
    .chat-header .agent-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 1rem; }
    .chat-header .agent-info .agent-name { font-weight: 600; font-size: 0.9rem; color: #f1f5f9; }
    .chat-header .agent-info .agent-status { font-size: 0.72rem; color: #10b981; display: flex; align-items: center; gap: 4px; }
    .chat-header .agent-info .agent-status .dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; }
    .close-btn { margin-left: auto; color: #94a3b8; text-decoration: none; font-size: 1.2rem; transition: color 0.2s; }
    .close-btn:hover { color: #f87171; }
    
    .login-form { padding: 2rem 1.5rem; text-align: center; }
    .login-form h3 { font-family: 'Space Grotesk', sans-serif; color: #f1f5f9; font-size: 1.3rem; margin-bottom: 0.3rem; }
    .login-form p { color: #64748b; font-size: 0.82rem; margin-bottom: 1.5rem; }
    .login-form input { width: 100%; padding: 0.7rem 1rem; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #e2e8f0; font-size: 0.88rem; margin-bottom: 0.7rem; outline: none; font-family: 'Inter', sans-serif; }
    .login-form input:focus { border-color: #818cf8; }
    .login-form button { width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; }
    .login-form button:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3); }
    
    .chat-body { flex: 1; overflow-y: auto; padding: 1rem; display: none; flex-direction: column; gap: 6px; }
    .chat-body .msg { max-width: 75%; padding: 0.55rem 0.9rem; border-radius: 12px; font-size: 0.82rem; line-height: 1.4; word-wrap: break-word; }
    .chat-body .msg.fan { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
    .chat-body .msg.admin { background: #0f172a; color: #e2e8f0; align-self: flex-start; border: 1px solid #334155; border-bottom-left-radius: 3px; }
    .chat-body .msg .time { font-size: 0.62rem; opacity: 0.7; margin-top: 3px; text-align: right; }
    
    .chat-input-area { padding: 0.8rem 1rem; border-top: 1px solid #334155; display: none; }
    .chat-input-row { display: flex; gap: 8px; align-items: center; }
    .chat-input-row input { flex: 1; padding: 0.6rem 0.9rem; background: #0f172a; border: 1px solid #334155; border-radius: 20px; color: #e2e8f0; font-size: 0.84rem; outline: none; font-family: 'Inter', sans-serif; }
    .chat-input-row input:focus { border-color: #818cf8; }
    .chat-input-row button { width: 36px; height: 36px; border-radius: 50%; border: none; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .chat-input-row button:hover { transform: scale(1.05); }
  </style>
</head>
<body>

<div class="chat-container">
  <div class="chat-header">
    <div class="agent-avatar">BM</div>
    <div class="agent-info">
      <div class="agent-name">Baiilla Maach Support</div>
      <div class="agent-status"><span class="dot"></span> Online</div>
    </div>
    <a href="/" class="close-btn"><i class="fas fa-times"></i></a>
  </div>
  
  <div class="login-form" id="loginForm">
    <h3><i class="fas fa-headset"></i> Start Chat</h3>
    <p>Connect with our support team</p>
    <input type="text" id="fanName" placeholder="Your Name">
    <input type="text" id="fanEmail" placeholder="Your Email or Phone">
    <button onclick="startChat()"><i class="fas fa-comments"></i> Start Chatting</button>
  </div>
  
  <div class="chat-body" id="chatBody"></div>
  <div class="chat-input-area" id="chatInputArea">
    <div class="chat-input-row">
      <input type="text" id="msgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()">
      <button onclick="sendMsg()"><i class="fas fa-paper-plane"></i></button>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let fanSocket;
let fanUser = null;

function startChat() {
  const name = document.getElementById('fanName').value.trim();
  const email = document.getElementById('fanEmail').value.trim();
  if (!name || !email) return alert('Please fill all fields');
  
  fanUser = { name, email };
  fanSocket = io();
  fanSocket.emit('register', { name, email });
  
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('chatBody').style.display = 'flex';
  document.getElementById('chatInputArea').style.display = 'block';
  
  loadFanMessages();
  
  fanSocket.on('newMsg', (msg) => {
    if ((msg.sender === fanUser.email && msg.receiver === 'admin@baillamaach.com') ||
        (msg.sender === 'admin@baillamaach.com' && msg.receiver === fanUser.email)) {
      appendMessage(msg);
    }
  });
}

async function loadFanMessages() {
  try {
    const res = await fetch('/api/msgs/' + fanUser.email);
    const msgs = await res.json();
    const chatBody = document.getElementById('chatBody');
    chatBody.innerHTML = '';
    msgs.forEach(m => appendMessage(m));
  } catch (err) {}
}

function appendMessage(msg) {
  const chatBody = document.getElementById('chatBody');
  const isFan = msg.sender === fanUser.email;
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  chatBody.insertAdjacentHTML('beforeend', 
    '<div class="msg ' + (isFan ? 'fan' : 'admin') + '">' + msg.message + 
    '<div class="time">' + time + '</div></div>');
  chatBody.scrollTop = chatBody.scrollHeight;
}

function sendMsg() {
  const input = document.getElementById('msgInput');
  const msg = input.value.trim();
  if (!msg || !fanUser) return;
  
  fanSocket.emit('sendMsg', {
    sender: fanUser.email,
    receiver: 'admin@baillamaach.com',
    message: msg,
    type: 'text'
  });
  
  appendMessage({
    sender: fanUser.email,
    receiver: 'admin@baillamaach.com',
    message: msg,
    timestamp: new Date()
  });
  
  input.value = '';
  input.focus();
}
</script>
</body>
</html>`);
});

// ==================== API ROUTES ====================
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
    const user = await User.findOne({ email, isAdmin: true });
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
      u.unreadCount = await Message.countDocuments({ 
        sender: u.email, 
        receiver: 'admin@baillamaach.com', 
        seen: false 
      });
    }
    res.json(users);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);
  
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
    } catch (err) { console.error('Register error:', err.message); }
  });
  
  socket.on('sendMsg', async (data) => {
    try {
      const msg = await Message.create({ 
        sender: data.sender, 
        receiver: data.receiver, 
        message: data.message, 
        type: data.type || 'text' 
      });
      io.emit('newMsg', msg);
    } catch (err) { console.error('Send error:', err.message); }
  });
  
  socket.on('markRead', async (data) => {
    try { 
      await Message.updateMany({ 
        sender: data.user, 
        receiver: 'admin@baillamaach.com', 
        seen: false 
      }, { $set: { seen: true } }); 
    } catch (err) {}
  });
  
  socket.on('disconnect', async () => {
    if (socket.userData) {
      try {
        await User.updateOne({ email: socket.userData.email }, { 
          $set: { isOnline: false, lastSeen: new Date() } 
        });
        io.emit('userStatus', { email: socket.userData.email, online: false });
      } catch (err) {}
    }
  });
});

server.listen(PORT, () => {
  console.log('🚀 Public Site: http://localhost:' + PORT);
  console.log('🔐 Admin Dashboard: http://localhost:' + PORT + '/admin');
  console.log('💬 Fan Messenger: http://localhost:' + PORT + '/messenger');
  console.log('📧 Admin: admin@baillamaach.com | 🔑 Pass: admin123');
});

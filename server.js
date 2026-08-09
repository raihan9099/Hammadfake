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
      // Reset admin password every time server starts
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.updateOne({ email: adminEmail }, { $set: { password: hashedPassword, name: 'Baiilla Maach', isAdmin: true } });
      console.log('✅ Admin Password Reset to: admin123');
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ name: 'Baiilla Maach', email: adminEmail, password: hashedPassword, isAdmin: true });
      console.log('✅ Admin Created');
    }
    console.log('═══════════════════════════════════');
    console.log('📧 Admin Email: admin@baillamaach.com');
    console.log('🔑 Admin Password: admin123');
    console.log('═══════════════════════════════════');
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
  // New GIFs
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
    <section class="section-dark alt">
      <div class="container-v2" style="text-align:center">
        <span class="section-eyebrow">Voice</span>
        <h2 class="section-title">Voice Verification</h2>
        <p class="section-subtitle">Listen to authentic Baiilla Maach voice</p>
        <div class="voice-row">
          ${WELCOME_VOICE ? '<button class="voice-chip welcome-chip" onclick="playWelcomeVoice()">🎤 Real Voice</button>' : ''}
          ${MANUAL_VOICE ? '<button class="voice-chip alert-chip" onclick="playManualVoice()">🚨 Fake Alert</button>' : ''}
        </div>
      </div>
    </section>`;
  }

  let musicHTML = '';
  if (songs.length > 0) {
    musicHTML = `
    <section class="section-dark">
      <div class="container-v2">
        <span class="section-eyebrow">Music</span>
        <h2 class="section-title">Cover Songs</h2>
        <p class="section-subtitle">Official covers by Hammad Bin Amir</p>
        <div class="music-container">
          <div class="music-now">
            <img src="${ASSETS.playGif}" class="m-cover" id="mCover" alt="Cover" onerror="this.src='${ASSETS.microphone}'">
            <div class="m-info">
              <div class="m-title" id="mTitle">Select a Song</div>
              <div class="m-artist">Baiilla Maach</div>
            </div>
          </div>
          <div class="m-slider" onclick="seekMusic(event)"><div class="m-slider-fill" id="mSliderFill"></div></div>
          <div class="m-time-row"><span id="mCurrentTime">0:00</span><span id="mDuration">0:00</span></div>
          <div class="m-controls">
            <button class="m-ctrl" onclick="prevMusic()">⏮</button>
            <button class="m-play" id="mPlayBtn" onclick="toggleMusic()">▶</button>
            <button class="m-ctrl" onclick="nextMusic()">⏭</button>
          </div>
          <div class="m-song-list">
            ${songs.map((s, i) => `
              <div class="m-song-item" onclick="playMusic(${i})">
                <span class="m-num">${String(i+1).padStart(2,'0')}</span>
                <img src="${ASSETS.playGif}" class="m-song-cover-mini" alt="">
                <div class="m-song-info"><div class="m-song-name">${s.title}</div><div class="m-song-artist">Baiilla Maach</div></div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#8b5cf6">
<title>Baiilla Maach — Official Hub | Hammad Bin Amir</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Manrope:wght@300;400;500;600;700;800&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0a0a0f; --surface: #12121a; --surface2: #1a1a26; --surface3: #222233;
  --border: #2a2a3a; --text: #e4e4f0; --text2: #a0a0b8; --text3: #6a6a80;
  --purple: #8b5cf6; --purple2: #a78bfa; --pink: #ec4899; --cyan: #06b6d4;
  --amber: #f59e0b; --emerald: #10b981; --red: #ef4444; --red2: #f87171;
  --grad1: linear-gradient(135deg, #8b5cf6, #ec4899);
  --grad2: linear-gradient(135deg, #06b6d4, #8b5cf6);
  --grad3: linear-gradient(135deg, #f59e0b, #ec4899);
  --glow-purple: 0 0 30px rgba(139,92,246,0.3);
  --glow-cyan: 0 0 30px rgba(6,182,212,0.3);
  --radius: 24px; --radius-sm: 14px; --radius-xs: 8px;
}
* { margin:0; padding:0; box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { font-family:'Manrope','Inter',sans-serif; background:var(--bg); color:var(--text); line-height:1.6; -webkit-font-smoothing:antialiased; overflow-x:hidden; }
::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:var(--surface); } ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }

.glass-header { position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:1000; width:90%; max-width:1200px; background:rgba(18,18,26,0.7); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:60px; padding:12px 28px; display:flex; justify-content:space-between; align-items:center; }
.glass-header .logo-group { display:flex; align-items:center; gap:10px; text-decoration:none; }
.glass-header .logo-group img { width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--purple); }
.glass-header .logo-group .logo-text { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:1em; color:var(--text); }
.btn-glass { padding:10px 20px; border-radius:40px; border:1px solid var(--border); background:rgba(255,255,255,0.03); color:var(--text); font-weight:600; font-size:0.82em; cursor:pointer; transition:all 0.3s; text-decoration:none; display:flex; align-items:center; gap:6px; font-family:'Manrope',sans-serif; }
.btn-glass:hover { background:rgba(139,92,246,0.15); border-color:var(--purple); }
.btn-glass.accent { background:var(--grad1); border:none; color:#fff; }
.btn-glass.accent:hover { box-shadow:0 0 30px rgba(236,72,153,0.3); transform:translateY(-2px); }

.hero-v2 { padding:140px 20px 80px; text-align:center; position:relative; overflow:hidden; }
.hero-v2::before { content:''; position:absolute; top:-200px; left:50%; transform:translateX(-50%); width:600px; height:600px; background:radial-gradient(circle,rgba(139,92,246,0.15) 0%,transparent 70%); pointer-events:none; }
.hero-card { display:inline-block; background:var(--surface); border:1px solid var(--border); border-radius:40px; padding:40px 50px; position:relative; box-shadow:0 20px 60px rgba(0,0,0,0.4); }
.hero-card .avatar-ring { width:130px; height:130px; border-radius:50%; padding:4px; background:var(--grad1); margin:0 auto 20px; }
.hero-card .avatar-ring img { width:100%; height:100%; border-radius:50%; object-fit:cover; border:4px solid var(--bg); }
.hero-card .verified-chip { display:inline-flex; align-items:center; gap:5px; background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); padding:6px 14px; border-radius:30px; font-size:0.75em; font-weight:600; color:var(--purple2); margin-bottom:14px; }
.hero-card .verified-chip svg { width:14px; height:14px; fill:var(--purple2); }
.hero-card h1 { font-family:'Space Grotesk',sans-serif; font-size:2em; font-weight:700; letter-spacing:-0.5px; }
.hero-card .username-text { font-family:'DM Sans',sans-serif; font-size:0.9em; color:var(--text2); }
.hero-card .bio-text { color:var(--text3); font-size:0.82em; margin-bottom:16px; }
.hero-stats-row { display:flex; gap:30px; justify-content:center; margin:16px 0; padding:14px 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
.hero-stats-row .stat-item { text-align:center; }
.hero-stats-row .stat-value { font-family:'Space Grotesk',sans-serif; font-size:1.3em; font-weight:700; }
.hero-stats-row .stat-label { font-size:0.68em; color:var(--text3); text-transform:uppercase; letter-spacing:2px; }
.hero-social-links { display:flex; gap:10px; justify-content:center; margin-top:16px; }
.social-pill { padding:10px 22px; border-radius:40px; text-decoration:none; font-weight:600; font-size:0.8em; display:flex; align-items:center; gap:7px; transition:all 0.3s; border:1px solid var(--border); color:var(--text); background:var(--surface2); }
.social-pill:hover { transform:translateY(-3px); }
.social-pill.tiktok-pill { border-color:rgba(6,182,212,0.4); } .social-pill.tiktok-pill:hover { background:rgba(6,182,212,0.1); border-color:var(--cyan); }
.social-pill.fb-pill { border-color:rgba(139,92,246,0.4); } .social-pill.fb-pill:hover { background:rgba(139,92,246,0.1); border-color:var(--purple); }
.social-pill img { width:18px; height:18px; }

.section-dark { padding:80px 20px; } .section-dark.alt { background:var(--surface); }
.container-v2 { max-width:1000px; margin:0 auto; }
.section-eyebrow { display:inline-block; font-size:0.7em; font-weight:700; text-transform:uppercase; letter-spacing:3px; background:var(--grad1); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:10px; }
.section-title { font-family:'Space Grotesk',sans-serif; font-size:2em; font-weight:700; text-align:center; letter-spacing:-0.5px; margin-bottom:6px; }
.section-subtitle { text-align:center; color:var(--text3); margin-bottom:40px; font-size:0.85em; }

.v-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.v-card { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:24px; transition:all 0.3s; }
.v-card:hover { border-color:rgba(16,185,129,0.4); transform:translateY(-4px); }
.v-card-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.v-card-header .v-avatar { width:44px; height:44px; border-radius:50%; object-fit:cover; }
.v-card-header .v-info h4 { font-family:'Space Grotesk',sans-serif; font-size:0.95em; font-weight:600; display:flex; align-items:center; gap:5px; }
.v-card-header .v-info h4 img { width:16px; height:16px; }
.v-card-header .v-info .v-handle { font-size:0.78em; color:var(--text3); }
.v-detail { font-size:0.8em; color:var(--text2); padding:4px 0; display:flex; align-items:center; gap:6px; } .v-detail strong { color:var(--text); }
.v-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:30px; text-decoration:none; font-weight:600; font-size:0.78em; margin-top:12px; transition:all 0.3s; }
.v-btn.tiktok-v { background:var(--grad2); color:#fff; } .v-btn.tiktok-v:hover { box-shadow:var(--glow-cyan); transform:translateY(-2px); }
.v-btn.fb-v { background:var(--grad1); color:#fff; } .v-btn.fb-v:hover { box-shadow:var(--glow-purple); transform:translateY(-2px); }

/* Fake Cards - ONLY detect image updown, NO text animation */
.f-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.f-card { background:var(--surface2); border:1px solid rgba(239,68,68,0.4); border-radius:var(--radius); overflow:hidden; transition:all 0.3s; }
.f-card:hover { border-color:var(--red); box-shadow:0 0 30px rgba(239,68,68,0.2); }
.f-card .f-img-wrap { position:relative; text-align:center; padding:20px; background:var(--surface3); }
.f-card .f-img-wrap img.f-img { max-width:100%; border-radius:var(--radius-xs); position:relative; z-index:1; }
/* Fake detect image updown ONLY */
.f-detect-overlay {
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%);
  z-index:2; width:80px; height:80px;
  animation: updownOnly 1.8s infinite ease-in-out;
  filter:drop-shadow(0 5px 20px rgba(239,68,68,0.6));
}
@keyframes updownOnly {
  0%,100% { transform:translate(-50%,-50%) translateY(0); }
  50% { transform:translate(-50%,-50%) translateY(-18px); }
}
.f-card .f-body { padding:18px; }
.f-card .f-body h4 { font-family:'Space Grotesk',sans-serif; font-size:0.95em; font-weight:600; margin-bottom:3px; }
.f-card .f-body .f-platform { color:var(--amber); font-size:0.75em; font-weight:600; margin-bottom:6px; }
.f-card .f-body p { color:var(--text3); font-size:0.8em; margin-bottom:12px; }
.f-report-btn { display:inline-flex; align-items:center; gap:5px; background:var(--red); color:#fff; padding:8px 18px; border-radius:30px; text-decoration:none; font-weight:600; font-size:0.76em; transition:all 0.3s; }
.f-report-btn:hover { background:#dc2626; box-shadow:0 0 25px rgba(239,68,68,0.3); transform:translateY(-2px); }

/* GIFs section */
.gif-section { padding:30px 0; }
.gif-row { display:flex; gap:20px; justify-content:center; flex-wrap:wrap; align-items:center; }
.gif-item { text-align:center; }
.gif-item img { width:60px; height:60px; border-radius:12px; transition:all 0.3s; }
.gif-item img:hover { transform:scale(1.15); }
.gif-item p { font-size:0.7em; color:var(--text3); margin-top:6px; font-weight:600; }

.p-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.p-card { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius-sm); padding:20px; text-align:center; transition:all 0.3s; }
.p-card:hover { border-color:var(--purple); box-shadow:0 0 20px rgba(139,92,246,0.15); }
.p-card img { width:100%; border-radius:var(--radius-xs); margin-bottom:10px; }
.p-card .p-label { font-weight:600; font-size:0.8em; color:var(--text2); }
.real-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:7px 16px; border-radius:30px; margin-top:10px; font-weight:600; font-size:0.8em; color:var(--emerald); }
.real-badge svg { width:16px; height:16px; fill:var(--emerald); }

.voice-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.voice-chip { padding:12px 26px; border-radius:40px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-weight:600; cursor:pointer; font-size:0.82em; display:flex; align-items:center; gap:8px; transition:all 0.3s; font-family:'Manrope',sans-serif; }
.voice-chip:hover { border-color:var(--purple); }
.voice-chip.welcome-chip:hover { background:rgba(139,92,246,0.1); box-shadow:var(--glow-purple); }
.voice-chip.alert-chip:hover { background:rgba(239,68,68,0.1); }

.music-container { max-width:600px; margin:0 auto; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:30px; }
.music-now { display:flex; align-items:center; gap:16px; margin-bottom:18px; }
.music-now .m-cover { width:100px; height:100px; border-radius:16px; object-fit:cover; box-shadow:0 10px 30px rgba(0,0,0,0.4); }
.music-now .m-info .m-title { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:1.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.music-now .m-info .m-artist { color:var(--purple2); font-size:0.8em; }
.m-slider { width:100%; height:3px; background:var(--border); border-radius:2px; cursor:pointer; margin:10px 0; }
.m-slider-fill { height:100%; background:var(--grad1); border-radius:2px; width:0%; transition:width 0.1s linear; }
.m-time-row { display:flex; justify-content:space-between; font-size:0.68em; color:var(--text3); margin-bottom:12px; }
.m-controls { display:flex; align-items:center; justify-content:center; gap:16px; }
.m-ctrl { background:none; border:none; color:var(--text2); cursor:pointer; font-size:1em; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all 0.3s; } .m-ctrl:hover { color:var(--text); background:var(--surface3); }
.m-play { width:50px; height:50px; border-radius:50%; border:none; background:var(--grad1); color:#fff; font-size:1.1em; cursor:pointer; transition:all 0.3s; display:flex; align-items:center; justify-content:center; } .m-play:hover { transform:scale(1.06); box-shadow:var(--glow-purple); } .m-play.playing { background:var(--grad3); }
.m-song-list { margin-top:16px; max-height:220px; overflow-y:auto; border-top:1px solid var(--border); padding-top:8px; }
.m-song-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:var(--radius-xs); cursor:pointer; transition:all 0.2s; font-size:0.8em; color:var(--text2); } .m-song-item:hover { background:var(--surface3); color:var(--text); } .m-song-item.active { background:rgba(139,92,246,0.1); color:var(--purple2); }

.footer-v2 { background:var(--surface); border-top:1px solid var(--border); padding:50px 20px 30px; text-align:center; }
.footer-v2 .footer-grid-v2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:30px; max-width:900px; margin:0 auto 30px; text-align:left; }
.footer-v2 h5 { font-family:'Space Grotesk',sans-serif; color:var(--purple2); margin-bottom:10px; font-size:0.85em; }
.footer-v2 p,.footer-v2 a { color:var(--text3); font-size:0.76em; line-height:2; text-decoration:none; display:block; transition:all 0.3s; } .footer-v2 a:hover { color:var(--purple2); }
.footer-v2 .footer-line { border-top:1px solid var(--border); padding-top:20px; font-size:0.72em; color:var(--text3); } .footer-v2 .footer-line span { color:var(--purple2); font-weight:600; }

.chat-fab { position:fixed; bottom:28px; right:28px; z-index:9999; }
.chat-fab-btn { width:56px; height:56px; border-radius:50%; border:none; background:var(--grad1); color:#fff; font-size:1.3em; cursor:pointer; box-shadow:0 10px 30px rgba(139,92,246,0.4); transition:all 0.3s; display:flex; align-items:center; justify-content:center; animation:float 3s ease-in-out infinite; }
@keyframes float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-8px); } }
.chat-fab-btn:hover { transform:scale(1.08); }
.chat-panel { display:none; position:fixed; bottom:96px; right:28px; width:380px; height:480px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); flex-direction:column; overflow:hidden; z-index:9999; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
.chat-panel.open { display:flex; }
.chat-panel .cp-head { padding:16px 20px; background:var(--surface2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:0.85em; }
.chat-panel .cp-head button { background:none; border:none; color:var(--text3); font-size:1.2em; cursor:pointer; }
.chat-panel .cp-body { flex:1; overflow-y:auto; padding:14px; }
.chat-panel .cp-login { padding:30px 20px; text-align:center; }
.chat-panel .cp-login h4 { font-family:'Space Grotesk',sans-serif; margin-bottom:4px; }
.chat-panel .cp-login p { color:var(--text3); font-size:0.78em; margin-bottom:16px; }
.chat-panel .cp-login input { width:100%; padding:10px 14px; margin-bottom:8px; border:1px solid var(--border); border-radius:10px; background:var(--surface2); color:var(--text); font-size:0.82em; outline:none; font-family:'Manrope',sans-serif; }
.chat-panel .cp-login input:focus { border-color:var(--purple); }
.chat-panel .cp-login button { width:100%; padding:10px; background:var(--grad1); color:#fff; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.85em; font-family:'Manrope',sans-serif; }
.chat-panel .cp-input-area { padding:12px; border-top:1px solid var(--border); display:none; }
.chat-panel .cp-input-area input { flex:1; padding:10px 14px; border:1px solid var(--border); border-radius:20px; background:var(--surface2); color:var(--text); font-size:0.82em; outline:none; font-family:'Manrope',sans-serif; }
.chat-panel .cp-input-area button { background:var(--grad1); color:#fff; border:none; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:0.9em; margin-left:8px; }
.chat-msg { max-width:75%; padding:8px 12px; border-radius:12px; margin-bottom:4px; font-size:0.78em; word-wrap:break-word; }
.chat-msg.user-msg { background:var(--grad1); color:#fff; margin-left:auto; }
.chat-msg.admin-msg { background:var(--surface3); color:var(--text); border:1px solid var(--border); }
.chat-msg .msg-time { font-size:0.65em; opacity:0.6; margin-top:3px; text-align:right; }

@media(max-width:768px) {
  .glass-header { width:95%; padding:10px 18px; top:10px; }
  .hero-v2 { padding:120px 16px 60px; }
  .hero-card { padding:30px 24px; border-radius:30px; }
  .hero-card h1 { font-size:1.5em; }
  .v-grid,.f-grid { grid-template-columns:1fr; }
  .p-grid { grid-template-columns:1fr; }
  .music-now { flex-direction:column; text-align:center; }
  .chat-panel { width:100%; height:100%; bottom:0; right:0; border-radius:0; }
}
</style>
</head>
<body>

<header class="glass-header">
  <a href="/" class="logo-group">
    <img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'">
    <span class="logo-text">Baiilla Maach</span>
  </a>
  <div class="header-actions">
    <a href="/messenger" class="btn-glass accent">💬 Support</a>
  </div>
</header>

<section class="hero-v2">
  <div class="hero-card">
    <div class="avatar-ring"><img src="${ASSETS.profile}" alt="Hammad Bin Amir" onerror="this.style.display='none'"></div>
    <div class="verified-chip"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified Creator</div>
    <h1>Hammad Bin Amir</h1>
    <p class="username-text">@baiillamaach_official</p>
    <p class="bio-text">Official Entertainment Profile · Verified</p>
    <div class="hero-stats-row">
      <div class="stat-item"><div class="stat-value">7K</div><div class="stat-label">Followers</div></div>
      <div class="stat-item"><div class="stat-value">0</div><div class="stat-label">Following</div></div>
      <div class="stat-item"><div class="stat-value">190K</div><div class="stat-label">Likes</div></div>
    </div>
    <div class="hero-social-links">
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="social-pill tiktok-pill"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="social-pill fb-pill"><img src="${ASSETS.logoFB}" alt=""> Facebook</a>
    </div>
    <!-- GIFs under social links -->
    <div class="gif-section">
      <div class="gif-row">
        <div class="gif-item"><img src="${ASSETS.followGif}" alt="Follow" onerror="this.style.display='none'"><p>Follow</p></div>
        <div class="gif-item"><img src="${ASSETS.addGif}" alt="Add" onerror="this.style.display='none'"><p>Add</p></div>
        <div class="gif-item"><img src="${ASSETS.propagandaGif}" alt="Propaganda" onerror="this.style.display='none'"><p>Official</p></div>
        <div class="gif-item"><img src="${ASSETS.reportGif}" alt="Report" onerror="this.style.display='none'"><p>Report</p></div>
        <div class="gif-item"><img src="${ASSETS.playGif}" alt="Play" onerror="this.style.display='none'"><p>Play</p></div>
      </div>
    </div>
  </div>
</section>

<section class="section-dark">
  <div class="container-v2">
    <span class="section-eyebrow">Authentic</span>
    <h2 class="section-title">Official Accounts</h2>
    <p class="section-subtitle">The only real verified profiles of Baiilla Maach</p>
    <div class="v-grid">
      <div class="v-card">
        <div class="v-card-header"><img src="${ASSETS.profile}" class="v-avatar"><div class="v-info"><h4>TikTok <img src="${ASSETS.blueTikTok}"></h4><p class="v-handle">@baiillamaach_official</p></div></div>
        <div class="v-detail">✓ Status: <strong>Active & Verified</strong></div>
        <div class="v-detail">👥 Followers: <strong>7,000</strong></div>
        <div class="v-detail">❤️ Likes: <strong>190,000</strong></div>
        <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="v-btn tiktok-v">Follow on TikTok</a>
      </div>
      <div class="v-card">
        <div class="v-card-header"><img src="${ASSETS.fbProfile}" class="v-avatar"><div class="v-info"><h4>Facebook <img src="${ASSETS.blueFB}"></h4><p class="v-handle">@BaiillaMaachOfficial</p></div></div>
        <div class="v-detail">✓ Status: <strong>Active & Verified</strong></div>
        <div class="v-detail">📘 Page: <strong>Official Facebook</strong></div>
        <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="v-btn fb-v">Follow on Facebook</a>
      </div>
    </div>
  </div>
</section>

<section class="section-dark alt">
  <div class="container-v2">
    <span class="section-eyebrow" style="background:linear-gradient(135deg,#ef4444,#f87171);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Warning</span>
    <h2 class="section-title">Fake Accounts Detected</h2>
    <p class="section-subtitle">Report these accounts immediately to protect the community</p>
    <div class="f-grid">
      <div class="f-card">
        <div class="f-img-wrap">
          <img src="${ASSETS.baillamachFake}" class="f-img" alt="Fake Account">
          <img src="${ASSETS.fakeDetect}" class="f-detect-overlay" alt="FAKE DETECTED">
        </div>
        <div class="f-body">
          <h4>@baiilla_mach</h4>
          <p class="f-platform">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers. Uses similar name to confuse fans.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="f-report-btn">🚨 Report Account</a>
        </div>
      </div>
      <div class="f-card">
        <div class="f-img-wrap">
          <img src="${ASSETS.hammadFake}" class="f-img" alt="Fake Account">
          <img src="${ASSETS.fakeDetect}" class="f-detect-overlay" alt="FAKE DETECTED">
        </div>
        <div class="f-body">
          <h4>@hammad_fams0</h4>
          <p class="f-platform">📍 TikTok</p>
          <p>Uses official name and photo to mislead followers. Impersonating with fake content.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="f-report-btn">🚨 Report Account</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section-dark">
  <div class="container-v2">
    <span class="section-eyebrow">Proof</span>
    <h2 class="section-title">Identity Verification</h2>
    <p class="section-subtitle">Evidence confirming the authenticity of Baiilla Maach</p>
    <div class="p-grid">
      <div class="p-card"><img src="${ASSETS.realId}" alt="Real ID"><p class="p-label">Real ID Verified</p><div class="real-badge"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> Real Account</div></div>
      <div class="p-card"><img src="${ASSETS.microphone}" alt="Voice"><p class="p-label">Real Voice Recording</p></div>
      <div class="p-card"><img src="${ASSETS.fakeDetect}" alt="Verification"><p class="p-label">Fake Account Detection</p></div>
    </div>
  </div>
</section>

${voiceHTML}

${musicHTML}

<footer class="footer-v2">
  <div class="footer-grid-v2">
    <div><h5>About</h5><p>Official verification hub for Baiilla Maach. Protecting fans from fake accounts.</p></div>
    <div><h5>Links</h5><a href="https://tiktok.com/@baiillamaach_official">→ TikTok</a><a href="https://www.facebook.com/profile.php?id=61575202118828">→ Facebook</a><a href="/messenger">→ Chat Support</a></div>
    <div><h5>Contact</h5><p>Use chat button for support</p><p style="color:var(--purple2);font-weight:600;">admin@baillamaach.com</p></div>
  </div>
  <div class="footer-line">© 2024 <span>Baiilla Maach</span>. All rights reserved.</div>
</footer>

<div class="chat-fab"><button class="chat-fab-btn" onclick="toggleChat()">💬</button></div>
<div class="chat-panel" id="chatPanel">
  <div class="cp-head">💬 Chat Support <button onclick="toggleChat()">✕</button></div>
  <div class="cp-body" id="chatBody">
    <div class="cp-login" id="chatLoginForm">
      <h4>Start Chat</h4>
      <p>Connect with our support team</p>
      <input type="text" id="chatNameInput" placeholder="Your Name">
      <input type="text" id="chatEmailInput" placeholder="Email or Phone">
      <button onclick="startChatSession()">Start Chatting</button>
    </div>
  </div>
  <div class="cp-input-area" id="chatInputArea">
    <div style="display:flex;align-items:center">
      <input type="text" id="chatMsgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendChatMsg()">
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
function updatePlayBtn(){const b=document.getElementById('mPlayBtn');if(!b)return;if(musicPlaying){b.textContent='⏸';b.classList.add('playing');}else{b.textContent='▶';b.classList.remove('playing');}}
function playMusic(i){if(!tracks.length)return;stopAllAudio();currentTrack=i;musicAudio.src=tracks[i].url;musicAudio.play().then(()=>{musicPlaying=true;updatePlayBtn();updateMusicUI(i);}).catch(()=>{});}
function updateMusicUI(i){document.getElementById('mTitle').textContent=tracks[i].title;document.querySelectorAll('.m-song-item').forEach((el,j)=>el.classList.toggle('active',j===i));}
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
async function loadChatMessages(){if(!chatUser)return;const r=await fetch('/api/msgs/'+chatUser.email);const ms=await r.json();const b=document.getElementById('chatBody');b.innerHTML=ms.map(m=>'<div class="chat-msg '+(m.sender===chatUser.email?'user-msg':'admin-msg')+'">'+m.message+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');b.scrollTop=b.scrollHeight;}
function sendChatMsg(){const i=document.getElementById('chatMsgInput');const m=i.value.trim();if(!m||!chatUser)return;socket.emit('sendMsg',{sender:chatUser.email,receiver:'admin@baillamaach.com',message:m,type:'text'});i.value='';}
socket.on('newMsg',(m)=>{if(chatUser&&(m.sender===chatUser.email||m.receiver===chatUser.email)){const b=document.getElementById('chatBody');b.insertAdjacentHTML('beforeend','<div class="chat-msg '+(m.sender===chatUser.email?'user-msg':'admin-msg')+'">'+m.message+'<div class="msg-time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');b.scrollTop=b.scrollHeight;}});
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
    console.log('Login attempt:', email); // Debug log
    const user = await User.findOne({ email: email, isAdmin: true });
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', valid); // Debug log
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ token: 'ok', message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f1f5f9;height:100vh;overflow:hidden;color:#1e293b}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
.login-card{background:#fff;padding:40px;border-radius:24px;width:400px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.2)}
.login-card h2{font-family:'Space Grotesk',sans-serif;margin-bottom:6px;font-size:1.5em;color:#0f172a}
.login-card .subtitle{color:#94a3b8;font-size:0.9em;margin-bottom:24px}
.login-card .input-group{margin-bottom:14px;text-align:left}
.login-card .input-group label{display:block;font-size:0.8em;font-weight:600;color:#475569;margin-bottom:4px}
.login-card .input-group input{width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:12px;font-size:0.95em;outline:none;font-family:'Inter',sans-serif}
.login-card .input-group input:focus{border-color:#8b5cf6}
.login-card button{width:100%;padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:1em;font-family:'Inter',sans-serif;transition:all 0.2s}
.login-card button:hover{background:#7c3aed}
.login-card button:disabled{opacity:0.6;cursor:not-allowed}
.login-error{color:#ef4444;font-size:0.85em;margin-top:10px;display:none}
.login-success{color:#10b981;font-size:0.85em;margin-top:10px;display:none}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff}
.sidebar{width:350px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-family:'Space Grotesk',sans-serif;font-size:1.1em}
.sidebar-header .logout-btn{background:#fee2e2;color:#ef4444;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.78em}
.search-bar{padding:10px 14px;border-bottom:1px solid #e2e8f0}
.search-bar input{width:100%;padding:9px 14px;border:2px solid #e2e8f0;border-radius:20px;font-size:0.85em;outline:none;font-family:'Inter',sans-serif}
.search-bar input:focus{border-color:#8b5cf6}
.user-list{flex:1;overflow-y:auto}
.user-item{padding:12px 18px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #f1f5f9}
.user-item:hover{background:#f8fafc}
.user-item.active{background:#f5f3ff;border-left:3px solid #8b5cf6}
.user-avatar{width:40px;height:40px;border-radius:50%;background:#8b5cf6;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:2px;right:2px;width:9px;height:9px;border-radius:50%;border:2px solid #fff}
.user-info{flex:1;min-width:0}.user-info .name{font-weight:600;font-size:0.85em}.user-info .email{font-size:0.73em;color:#94a3b8}
.unread{background:#8b5cf6;color:#fff;font-size:0.68em;padding:3px 7px;border-radius:10px;font-weight:700}
.chat-area{flex:1;display:flex;flex-direction:column;background:#f8fafc}
.chat-header{padding:14px 20px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px}
.chat-header .avatar{width:38px;height:38px;border-radius:50%;background:#8b5cf6;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
.chat-header .name{font-weight:600;font-size:0.9em}
.chat-messages{flex:1;overflow-y:auto;padding:16px 20px}
.message{max-width:65%;padding:8px 14px;border-radius:16px;font-size:0.85em;line-height:1.4;margin-bottom:4px}
.message.sent{background:#8b5cf6;color:#fff;margin-left:auto}
.message.received{background:#fff;color:#1e293b;border:1px solid #e2e8f0}
.message .time{font-size:0.65em;opacity:0.7;margin-top:3px;text-align:right}
.chat-input{padding:12px 18px;background:#fff;border-top:1px solid #e2e8f0;display:none}
.chat-input input{flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:20px;font-size:0.85em;outline:none;font-family:'Inter',sans-serif}
.chat-input input:focus{border-color:#8b5cf6}
.chat-input button{background:#8b5cf6;color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1em;margin-left:8px}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <h2>🔐 Admin Messenger</h2><p class="subtitle">Baiilla Maach Support Panel</p>
    <div class="input-group"><label>Email</label><input type="email" id="loginEmail" placeholder="admin@baillamaach.com" value="admin@baillamaach.com"></div>
    <div class="input-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter password" value="admin123"></div>
    <button id="loginBtn" onclick="doLogin()">Sign In</button>
    <div class="login-error" id="loginError"></div>
    <div class="login-success" id="loginSuccess"></div>
  </div>
</div>
<div class="app" id="app">
  <div class="app-layout">
    <div class="sidebar"><div class="sidebar-header"><h2>💬 Conversations</h2><button class="logout-btn" onclick="doLogout()">Logout</button></div><div class="search-bar"><input type="text" id="searchInput" placeholder="🔍 Search..." oninput="filterUsers()"></div><div class="user-list" id="userList"></div></div>
    <div class="chat-area"><div class="chat-header"><div class="avatar" id="chatAvatar">?</div><div><div class="name" id="chatName">Select user</div><div id="chatStatus"></div></div></div><div class="chat-messages" id="chatMessages"></div><div class="chat-input" id="chatInputArea"><div style="display:flex;align-items:center"><input type="text" id="msgInput" placeholder="Type..." onkeypress="if(event.key==='Enter')sendMessage()"><button onclick="sendMessage()">➤</button></div></div></div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
let socket,currentUser,users=[],messages=[],isLoggedIn=false;
socket=io();

socket.on('newMsg',(m)=>{
  if(currentUser&&((m.sender===currentUser.email&&m.receiver==='admin@baillamaach.com')||(m.sender==='admin@baillamaach.com'&&m.receiver===currentUser.email))){
    messages.push(m);renderMessages();
  }
  loadUsers();
});

socket.on('userStatus',(d)=>{updateUserStatus(d.email,d.online);});

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value.trim();
  const errDiv=document.getElementById('loginError');
  const successDiv=document.getElementById('loginSuccess');
  const btn=document.getElementById('loginBtn');
  
  errDiv.style.display='none';
  successDiv.style.display='none';
  
  if(!email||!password){
    errDiv.textContent='Please fill all fields';
    errDiv.style.display='block';
    return;
  }
  
  btn.disabled=true;
  btn.textContent='Signing in...';
  
  try{
    const res=await fetch('/api/admin/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    });
    const data=await res.json();
    
    if(res.ok){
      successDiv.textContent='✅ Login successful!';
      successDiv.style.display='block';
      isLoggedIn=true;
      localStorage.setItem('adminSession',JSON.stringify({email,password}));
      setTimeout(()=>{
        document.getElementById('loginOverlay').style.display='none';
        document.getElementById('app').style.display='block';
        loadUsers();
      },500);
    }else{
      errDiv.textContent='❌ '+ (data.error || 'Login failed');
      errDiv.style.display='block';
    }
  }catch(e){
    errDiv.textContent='❌ Network error. Check console.';
    errDiv.style.display='block';
    console.error('Login error:',e);
  }finally{
    btn.disabled=false;
    btn.textContent='Sign In';
  }
}

async function loadUsers(){
  if(!isLoggedIn)return;
  try{
    const res=await fetch('/api/admin/users');
    users=await res.json();
    renderUserList();
  }catch(e){console.error('Load users error:',e);}
}

function selectUser(u){
  currentUser=u;
  document.getElementById('chatAvatar').textContent=u.name.charAt(0).toUpperCase();
  document.getElementById('chatName').textContent=u.name;
  document.getElementById('chatStatus').innerHTML=u.isOnline?'<span style="color:#10b981">● Online</span>':'<span style="color:#d1d5db">● Offline</span>';
  document.getElementById('chatInputArea').style.display='block';
  document.querySelectorAll('.user-item').forEach(el=>el.classList.remove('active'));
  const el=document.querySelector('.user-item[data-email="'+u.email+'"]');
  if(el)el.classList.add('active');
  loadMessages();
  socket.emit('markRead',{user:u.email});
}

async function loadMessages(){
  if(!currentUser)return;
  try{
    const res=await fetch('/api/msgs/'+currentUser.email);
    const all=await res.json();
    messages=all.filter(m=>(m.sender===currentUser.email&&m.receiver==='admin@baillamaach.com')||(m.sender==='admin@baillamaach.com'&&m.receiver===currentUser.email));
    renderMessages();
  }catch(e){}
}

function renderMessages(){
  const c=document.getElementById('chatMessages');
  if(messages.length===0){c.innerHTML='<div style="text-align:center;color:#94a3b8;padding:40px">No messages</div>';return;}
  c.innerHTML=messages.map(m=>{
    const s=m.sender==='admin@baillamaach.com';
    const t=new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return'<div class="message '+(s?'sent':'received')+'">'+m.message+'<div class="time">'+t+'</div></div>';
  }).join('');
  c.scrollTop=c.scrollHeight;
}

function sendMessage(){
  const i=document.getElementById('msgInput');
  const m=i.value.trim();
  if(!m||!currentUser)return;
  socket.emit('sendMsg',{sender:'admin@baillamaach.com',receiver:currentUser.email,message:m,type:'text'});
  messages.push({sender:'admin@baillamaach.com',receiver:currentUser.email,message:m,type:'text',timestamp:new Date()});
  renderMessages();
  i.value='';i.focus();
}

function updateUserStatus(e,o){
  const el=document.querySelector('.user-item[data-email="'+e+'"] .dot');
  if(el)el.style.background=o?'#10b981':'#d1d5db';
  if(currentUser&&currentUser.email===e){
    document.getElementById('chatStatus').innerHTML=o?'<span style="color:#10b981">● Online</span>':'<span style="color:#d1d5db">● Offline</span>';
  }
}

function renderUserList(){
  const c=document.getElementById('userList');
  const s=document.getElementById('searchInput')?.value?.toLowerCase()||'';
  const f=users.filter(u=>u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s));
  if(f.length===0){c.innerHTML='<div style="text-align:center;color:#94a3b8;padding:40px">No users</div>';return;}
  c.innerHTML=f.map(u=>{
    const a=currentUser&&currentUser.email===u.email;
    return'<div class="user-item'+(a?' active':'')+'" data-email="'+u.email+'" onclick="selectUserById(\''+u.email+'\')"><div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'<div class="dot" style="background:'+(u.isOnline?'#10b981':'#d1d5db')+'"></div></div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':'')+'</div>';
  }).join('');
}

function selectUserById(e){const u=users.find(u=>u.email===e);if(u)selectUser(u);}
function filterUsers(){renderUserList();}
function doLogout(){localStorage.removeItem('adminSession');location.reload();}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('loginPassword').addEventListener('keypress',e=>{if(e.key==='Enter')doLogin();});
  const saved=localStorage.getItem('adminSession');
  if(saved){
    const s=JSON.parse(saved);
    document.getElementById('loginEmail').value=s.email;
    document.getElementById('loginPassword').value=s.password;
  }
});

setInterval(()=>{if(isLoggedIn)loadUsers();},30000);
</script>
</body>
</html>`);
});

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
      const msg = await Message.create({ sender: data.sender, receiver: data.receiver, message: data.message, type: data.type || 'text' });
      io.emit('newMsg', msg);
    } catch (err) { console.error('Send error:', err.message); }
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
  console.log('═══════════════════════════════════');
  console.log('🚀 Server: http://localhost:' + PORT);
  console.log('📧 Messenger: http://localhost:' + PORT + '/messenger');
  console.log('📧 Admin: admin@baillamaach.com');
  console.log('🔑 Password: admin123');
  console.log('═══════════════════════════════════');
});

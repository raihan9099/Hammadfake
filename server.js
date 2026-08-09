require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

app.use(express.json());
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

['uploads', 'assets/covermusic'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({ dest: 'uploads/' });

const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  isAdmin: { type: Boolean, default: false },
  lastSeen: Date,
  isOnline: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  type: { type: String, default: 'text' },
  fileUrl: String,
  seen: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
}));

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    const adminEmail = 'admin@baillamaach.com';
    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('Admin@2024!', 10);
      await User.create({
        name: 'Baiilla Maach',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true
      });
      console.log('✅ Admin user created');
    } else {
      const validPassword = await bcrypt.compare('Admin@2024!', admin.password);
      if (!validPassword) {
        const hashedPassword = await bcrypt.hash('Admin@2024!', 10);
        await User.updateOne({ email: adminEmail }, { $set: { password: hashedPassword } });
        console.log('🔄 Admin password reset to default');
      }
    }
    console.log('📧 Admin Email: admin@baillamaach.com');
    console.log('🔑 Admin Password: Admin@2024!');
  })
  .catch(e => console.error('❌ MongoDB error:', e.message));

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
  officialTikTok: "/assets/orginalss-tiktok.png"
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
  } catch (e) {
    return [];
  }
}

app.get('/', (req, res) => {
  const songs = getSongs();
  let musicHTML = '';
  if (songs.length > 0) {
    musicHTML = `
    <section class="section music-section">
      <div class="container">
        <div class="section-badge">🎵 MUSIC</div>
        <h2 class="section-heading">Cover Songs</h2>
        <p class="section-desc">Official covers by Hammad Bin Amir</p>
        <div class="music-player">
          <div class="music-cover">
            <img src="${ASSETS.microphone}" alt="Music" onerror="this.src='${ASSETS.profile}'">
            <div class="music-visualizer">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div class="music-info">
            <h4 id="trackTitle">Select a Song</h4>
            <p id="trackArtist">Baiilla Maach</p>
            <div class="music-ctrls">
              <button onclick="prevTrack()" class="ctrl-btn">⏮</button>
              <button id="playBtn" onclick="togglePlay()" class="btn-play">▶️</button>
              <button onclick="nextTrack()" class="ctrl-btn">⏭</button>
            </div>
            <div class="music-bar" onclick="seekTrack(event)">
              <div id="progressBar" class="music-bar-fill"></div>
            </div>
            <div class="music-time">
              <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
            </div>
          </div>
        </div>
        <div class="music-list">
          ${songs.map((s, i) => `
            <div onclick="playTrack(${i})" class="music-item">
              <span class="track-number">${String(i + 1).padStart(2, '0')}</span>
              <span class="track-title">${s.title}</span>
              <span class="track-duration">▶</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#f97316">
<meta name="description" content="Official Verification Hub - Hammad Bin Amir (Baiilla Maach)">
<title>Hammad Bin Amir — Official Verification | Baiilla Maach</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --white: #ffffff;
  --bg: #fafbfc;
  --gray50: #f8fafc;
  --gray100: #f1f5f9;
  --gray200: #e2e8f0;
  --gray300: #cbd5e1;
  --gray400: #94a3b8;
  --gray500: #64748b;
  --gray600: #475569;
  --gray700: #334155;
  --gray800: #1e293b;
  --gray900: #0f172a;
  --orange: #f97316;
  --orange-dark: #ea580c;
  --orange-light: #fff7ed;
  --orange-gradient: linear-gradient(135deg, #f97316, #fb923c);
  --green: #10b981;
  --green-dark: #059669;
  --green-light: #ecfdf5;
  --green-gradient: linear-gradient(135deg, #10b981, #34d399);
  --red: #ef4444;
  --red-light: #fef2f2;
  --red-gradient: linear-gradient(135deg, #ef4444, #f87171);
  --blue: #3b82f6;
  --blue-light: #eff6ff;
  --blue-gradient: linear-gradient(135deg, #3b82f6, #60a5fa);
  --purple: #8b5cf6;
  --purple-light: #f5f3ff;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 50px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06);
  --shadow-orange: 0 10px 30px rgba(249,115,22,0.2);
  --shadow-green: 0 10px 30px rgba(16,185,129,0.2);
  --radius: 20px;
  --radius-sm: 12px;
  --radius-lg: 28px;
  --radius-full: 9999px;
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  background: var(--white);
  color: var(--gray800);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

/* Custom Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--gray100); }
::-webkit-scrollbar-thumb { background: var(--gray300); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--gray400); }

/* Navigation */
.nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-bottom: 1px solid var(--gray200);
  padding: 0 32px;
  animation: slideDown 0.5s ease;
}

@keyframes slideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 72px;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  transition: var(--transition);
}

.nav-brand:hover { transform: scale(1.02); }

.nav-brand img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--orange);
  box-shadow: var(--shadow-orange);
}

.nav-brand span {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 1.2em;
  color: var(--gray900);
  letter-spacing: -0.5px;
}

.nav-chat {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--green-gradient);
  color: var(--white);
  padding: 10px 22px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.85em;
  transition: var(--transition);
  box-shadow: var(--shadow-green);
  letter-spacing: 0.3px;
}

.nav-chat:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px rgba(16,185,129,0.35);
}

.nav-chat img {
  width: 20px;
  height: 20px;
}

/* Hero Section */
.hero {
  padding: 100px 24px 80px;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
}

.hero::before {
  content: '';
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-avatar {
  position: relative;
  display: inline-block;
  margin-bottom: 24px;
  animation: fadeInUp 0.8s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.hero-avatar img {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--orange);
  box-shadow: 0 0 0 12px var(--orange-light), var(--shadow-xl);
  transition: var(--transition);
}

.hero-avatar:hover img {
  transform: scale(1.05);
}

.hero-avatar .verified-icon {
  position: absolute;
  bottom: 14px;
  right: 10px;
  background: var(--green-gradient);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid var(--white);
  box-shadow: var(--shadow-md);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
  50% { box-shadow: 0 0 0 15px rgba(16,185,129,0); }
}

.hero-avatar .verified-icon svg {
  width: 16px;
  height: 16px;
  fill: var(--white);
}

.hero h1 {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 3.2em;
  font-weight: 800;
  color: var(--gray900);
  letter-spacing: -1.5px;
  margin-bottom: 6px;
  line-height: 1.1;
}

.hero .username {
  font-family: 'Space Grotesk', 'DM Sans', sans-serif;
  font-size: 1.1em;
  color: var(--gray500);
  font-weight: 500;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}

.hero .bio {
  color: var(--gray400);
  font-size: 1em;
  margin-bottom: 24px;
  font-weight: 400;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin: 28px 0;
}

.hero-stat {
  text-align: center;
  transition: var(--transition);
}

.hero-stat:hover { transform: translateY(-3px); }

.hero-stat .num {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 2em;
  font-weight: 800;
  color: var(--gray900);
  letter-spacing: -0.5px;
}

.hero-stat .label {
  font-size: 0.78em;
  color: var(--gray400);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 4px;
  font-weight: 600;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--green-light);
  color: var(--green-dark);
  padding: 8px 20px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.85em;
  margin-bottom: 24px;
  letter-spacing: 0.5px;
  border: 1px solid rgba(16,185,129,0.2);
}

.hero-btns {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 20px;
}

.hero-btn {
  padding: 13px 28px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition);
  letter-spacing: 0.3px;
}

.hero-btn img { width: 20px; height: 20px; }

.hero-btn.tiktok {
  background: var(--gray900);
  color: var(--white);
  box-shadow: var(--shadow-lg);
}

.hero-btn.tiktok:hover {
  background: #000;
  transform: translateY(-3px);
  box-shadow: var(--shadow-xl);
}

.hero-btn.facebook {
  background: var(--blue-light);
  color: var(--blue);
  border: 2px solid transparent;
}

.hero-btn.facebook:hover {
  background: #dbeafe;
  border-color: var(--blue);
  transform: translateY(-3px);
}

/* Section Styles */
.section {
  padding: 100px 32px;
  position: relative;
}

.section.bg-green { background: var(--green-light); }
.section.bg-red { background: var(--red-light); }
.section.bg-gray { background: var(--gray50); }
.section.bg-white { background: var(--white); }
.section.music-section { background: linear-gradient(180deg, #fafbfc 0%, #fff7ed 100%); }

.container {
  max-width: 1150px;
  margin: 0 auto;
}

.section-badge {
  display: inline-block;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--orange);
  margin-bottom: 16px;
  background: var(--orange-light);
  padding: 6px 16px;
  border-radius: var(--radius-full);
}

.section-label {
  display: inline-block;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--orange);
  margin-bottom: 16px;
}

.section-heading {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 2.5em;
  font-weight: 800;
  color: var(--gray900);
  text-align: center;
  letter-spacing: -1px;
  margin-bottom: 10px;
  line-height: 1.2;
}

.section-desc {
  text-align: center;
  color: var(--gray500);
  margin-bottom: 50px;
  font-size: 1.05em;
  font-weight: 400;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

/* Verified Grid */
.verified-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.verified-card {
  background: var(--white);
  border: 2px solid var(--gray200);
  border-radius: var(--radius-lg);
  padding: 32px;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

.verified-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--green-gradient);
  opacity: 0;
  transition: var(--transition);
}

.verified-card:hover {
  border-color: var(--green);
  box-shadow: var(--shadow-xl);
  transform: translateY(-4px);
}

.verified-card:hover::before { opacity: 1; }

.verified-card .card-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}

.verified-card .card-top .pfp {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--orange);
}

.verified-card .card-top .info h3 {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 1.2em;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--gray900);
  letter-spacing: -0.3px;
}

.verified-card .card-top .info h3 img {
  width: 20px;
  height: 20px;
}

.verified-card .card-top .info .handle {
  color: var(--gray500);
  font-size: 0.9em;
  font-family: 'Space Grotesk', 'DM Sans', sans-serif;
  font-weight: 500;
}

.verified-card .card-body .row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  color: var(--gray600);
  font-size: 0.9em;
  font-weight: 500;
}

.verified-card .card-body .row strong {
  color: var(--gray800);
  font-weight: 700;
}

.verified-card .card-body .follow-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.85em;
  margin-top: 16px;
  transition: var(--transition);
  letter-spacing: 0.3px;
}

.verified-card .card-body .follow-btn img {
  width: 18px;
  height: 18px;
}

.verified-card .card-body .follow-btn.tiktok-btn {
  background: var(--gray900);
  color: var(--white);
}

.verified-card .card-body .follow-btn.tiktok-btn:hover {
  background: #000;
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.verified-card .card-body .follow-btn.fb-btn {
  background: var(--blue);
  color: var(--white);
}

.verified-card .card-body .follow-btn.fb-btn:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Fake Grid */
.fake-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.fake-card {
  background: var(--white);
  border: 2px solid #fecaca;
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
  transition: var(--transition);
}

.fake-card:hover {
  box-shadow: var(--shadow-xl);
  transform: translateY(-4px);
}

.fake-img-container {
  position: relative;
  text-align: center;
  background: #fafafa;
  padding: 24px;
}

.fake-img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  border-radius: var(--radius-sm);
}

.fake-detect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90px;
  height: 90px;
  animation: updown 2s infinite ease-in-out;
  filter: drop-shadow(0 5px 15px rgba(239,68,68,0.4));
}

@keyframes updown {
  0%, 100% { transform: translate(-50%, -50%) translateY(0); }
  50% { transform: translate(-50%, -50%) translateY(-20px); }
}

.fake-card .fake-info {
  padding: 24px;
}

.fake-card .fake-info h3 {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 1.15em;
  font-weight: 700;
  color: var(--gray900);
  margin-bottom: 4px;
  letter-spacing: -0.3px;
}

.fake-card .fake-info .plat {
  color: var(--orange);
  font-weight: 700;
  font-size: 0.85em;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.fake-card .fake-info p {
  color: var(--gray500);
  font-size: 0.9em;
  margin-bottom: 16px;
  line-height: 1.6;
}

.fake-card .fake-info .report-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--red-gradient);
  color: var(--white);
  padding: 10px 22px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.85em;
  transition: var(--transition);
  letter-spacing: 0.3px;
  box-shadow: 0 5px 15px rgba(239,68,68,0.3);
}

.fake-card .fake-info .report-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(239,68,68,0.4);
}

.fake-card .fake-info .report-btn img {
  width: 16px;
  height: 16px;
}

/* Proof Grid */
.proof-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.proof-card {
  background: var(--white);
  border: 2px solid var(--gray200);
  border-radius: var(--radius-lg);
  padding: 28px;
  text-align: center;
  transition: var(--transition);
  position: relative;
}

.proof-card:hover {
  border-color: var(--orange);
  box-shadow: var(--shadow-xl);
  transform: translateY(-4px);
}

.proof-card img {
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  transition: var(--transition);
}

.proof-card:hover img {
  transform: scale(1.03);
}

.proof-card p {
  font-weight: 700;
  font-size: 0.9em;
  color: var(--gray700);
  letter-spacing: 0.3px;
}

.real-account-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
  background: var(--green-light);
  padding: 10px 20px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(16,185,129,0.3);
  transition: var(--transition);
}

.real-account-badge:hover {
  background: #d1fae5;
  transform: scale(1.05);
}

.real-account-badge svg {
  width: 22px;
  height: 22px;
  filter: drop-shadow(0 2px 4px rgba(16,185,129,0.3));
}

.real-account-badge span {
  font-weight: 800;
  color: var(--green-dark);
  font-size: 0.95em;
  letter-spacing: 0.5px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

/* Voice Section */
.voice-btns {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 24px;
}

.voice-btn {
  padding: 14px 32px;
  border-radius: var(--radius-full);
  border: none;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.95em;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: var(--transition);
  letter-spacing: 0.3px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.voice-btn.welcome {
  background: var(--orange-gradient);
  color: var(--white);
  box-shadow: var(--shadow-orange);
}

.voice-btn.welcome:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 35px rgba(249,115,22,0.4);
}

.voice-btn.manual {
  background: var(--white);
  color: var(--red);
  border: 2px solid var(--red);
}

.voice-btn.manual:hover {
  background: var(--red);
  color: var(--white);
  transform: translateY(-3px);
  box-shadow: 0 15px 35px rgba(239,68,68,0.3);
}

/* Music Player */
.music-player {
  max-width: 650px;
  margin: 0 auto;
  background: var(--white);
  border: 2px solid var(--gray200);
  border-radius: var(--radius-lg);
  padding: 36px;
  display: flex;
  align-items: center;
  gap: 32px;
  box-shadow: var(--shadow-lg);
  transition: var(--transition);
}

.music-player:hover {
  box-shadow: var(--shadow-xl);
  border-color: var(--orange);
}

.music-cover {
  position: relative;
}

.music-cover img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--orange);
  box-shadow: var(--shadow-orange);
  animation: rotate 20s linear infinite;
  animation-play-state: paused;
}

.music-cover img.playing {
  animation-play-state: running;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.music-visualizer {
  display: flex;
  gap: 3px;
  justify-content: center;
  margin-top: 12px;
}

.music-visualizer span {
  width: 4px;
  height: 20px;
  background: var(--orange);
  border-radius: 2px;
  animation: visualizer 0.8s infinite ease-in-out;
}

.music-visualizer span:nth-child(1) { animation-delay: 0s; }
.music-visualizer span:nth-child(2) { animation-delay: 0.1s; }
.music-visualizer span:nth-child(3) { animation-delay: 0.2s; }
.music-visualizer span:nth-child(4) { animation-delay: 0.3s; }
.music-visualizer span:nth-child(5) { animation-delay: 0.4s; }

@keyframes visualizer {
  0%, 100% { height: 10px; }
  50% { height: 25px; }
}

.music-info {
  flex: 1;
  text-align: center;
}

.music-info h4 {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 1.2em;
  font-weight: 700;
  color: var(--gray900);
  margin-bottom: 4px;
  letter-spacing: -0.3px;
}

.music-info p {
  color: var(--orange);
  font-weight: 700;
  font-size: 0.9em;
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}

.music-ctrls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.music-ctrls .ctrl-btn {
  background: var(--gray100);
  border: 2px solid var(--gray200);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1em;
  transition: var(--transition);
  color: var(--gray700);
  display: flex;
  align-items: center;
  justify-content: center;
}

.music-ctrls .ctrl-btn:hover {
  background: var(--orange-light);
  border-color: var(--orange);
}

.music-ctrls .btn-play {
  background: var(--orange-gradient);
  color: var(--white);
  border: none;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2em;
  transition: var(--transition);
  box-shadow: var(--shadow-orange);
  display: flex;
  align-items: center;
  justify-content: center;
}

.music-ctrls .btn-play:hover {
  transform: scale(1.1);
  box-shadow: 0 15px 35px rgba(249,115,22,0.4);
}

.music-bar {
  background: var(--gray200);
  height: 6px;
  border-radius: 3px;
  cursor: pointer;
  margin: 8px 0;
  overflow: hidden;
}

.music-bar-fill {
  background: var(--orange-gradient);
  height: 100%;
  border-radius: 3px;
  width: 0%;
  transition: width 0.1s linear;
}

.music-time {
  font-size: 0.8em;
  color: var(--gray500);
  font-family: 'Space Grotesk', 'DM Sans', sans-serif;
  font-weight: 500;
}

.music-list {
  margin-top: 16px;
  background: var(--white);
  border: 2px solid var(--gray200);
  border-radius: var(--radius-lg);
  max-height: 280px;
  overflow-y: auto;
}

.music-item {
  padding: 14px 22px;
  cursor: pointer;
  border-bottom: 1px solid var(--gray100);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9em;
  transition: var(--transition);
  color: var(--gray700);
  font-weight: 500;
}

.music-item:hover {
  background: var(--orange-light);
}

.music-item.active {
  background: var(--orange-light);
  border-left: 4px solid var(--orange);
  font-weight: 700;
}

.music-item .track-number {
  font-weight: 800;
  color: var(--orange);
  min-width: 28px;
  font-family: 'Space Grotesk', sans-serif;
}

.music-item .track-title {
  flex: 1;
}

.music-item .track-duration {
  color: var(--gray400);
  font-size: 0.85em;
}

/* Footer */
.footer {
  background: var(--gray900);
  color: var(--white);
  padding: 80px 32px 40px;
  position: relative;
  overflow: hidden;
}

.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--orange), transparent);
}

.footer-grid {
  max-width: 1150px;
  margin: 0 auto 50px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 40px;
  text-align: left;
}

.footer-col h4 {
  font-family: 'Syne', 'Outfit', sans-serif;
  color: var(--orange);
  margin-bottom: 18px;
  font-size: 1.05em;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.footer-col p {
  color: var(--gray400);
  font-size: 0.88em;
  line-height: 1.8;
  font-weight: 400;
}

.footer-col a {
  color: var(--gray400);
  text-decoration: none;
  font-size: 0.88em;
  line-height: 2.2;
  transition: var(--transition);
  display: block;
  font-weight: 400;
}

.footer-col a:hover {
  color: var(--orange);
  transform: translateX(5px);
}

.footer-social {
  display: flex;
  gap: 14px;
  margin-top: 16px;
}

.footer-social a {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--gray800);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.footer-social a:hover {
  background: var(--orange);
  transform: translateY(-3px);
}

.footer-social svg {
  width: 18px;
  height: 18px;
  fill: var(--white);
}

.footer-bottom {
  padding-top: 30px;
  border-top: 1px solid var(--gray700);
  text-align: center;
  font-size: 0.82em;
  color: var(--gray500);
  font-weight: 400;
  max-width: 1150px;
  margin: 0 auto;
}

.footer-bottom span {
  color: var(--orange);
  font-weight: 700;
}

/* Chat Widget */
.chat-widget {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 999;
}

.chat-bubble {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: var(--shadow-green);
  transition: var(--transition);
  animation: softBounce 3s infinite;
}

.chat-bubble:hover {
  transform: scale(1.1);
  box-shadow: 0 15px 35px rgba(16,185,129,0.5);
}

.chat-bubble img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

@keyframes softBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.chat-box {
  display: none;
  position: fixed;
  bottom: 104px;
  right: 32px;
  width: 380px;
  height: 500px;
  background: var(--white);
  border: 2px solid var(--gray200);
  border-radius: var(--radius-lg);
  flex-direction: column;
  overflow: hidden;
  z-index: 999;
  box-shadow: var(--shadow-xl);
}

.chat-box.open { display: flex; }

.chat-box .head {
  background: var(--green-gradient);
  color: var(--white);
  padding: 16px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Syne', 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.95em;
  letter-spacing: 0.3px;
}

.chat-box .head button {
  background: none;
  border: none;
  color: var(--white);
  font-size: 1.3em;
  cursor: pointer;
  transition: var(--transition);
}

.chat-box .head button:hover { transform: scale(1.2); }

.chat-box .body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  background: var(--gray50);
}

.chat-box .login-form { padding: 28px; text-align: center; }

.chat-box .login-form input {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 10px;
  border: 2px solid var(--gray200);
  border-radius: var(--radius-sm);
  font-size: 0.9em;
  font-family: 'Plus Jakarta Sans', sans-serif;
  outline: none;
  transition: var(--transition);
}

.chat-box .login-form input:focus { border-color: var(--orange); }

.chat-box .login-form button {
  width: 100%;
  padding: 12px;
  background: var(--orange-gradient);
  color: var(--white);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.95em;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: var(--transition);
}

.chat-box .login-form button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-orange);
}

.chat-box .input-row {
  padding: 14px 18px;
  background: var(--white);
  border-top: 1px solid var(--gray200);
  display: none;
}

.chat-box .input-row input {
  flex: 1;
  padding: 12px 18px;
  border: 2px solid var(--gray200);
  border-radius: var(--radius-full);
  font-size: 0.9em;
  font-family: 'Plus Jakarta Sans', sans-serif;
  outline: none;
  transition: var(--transition);
}

.chat-box .input-row input:focus { border-color: var(--orange); }

.chat-box .input-row button {
  background: var(--orange-gradient);
  color: var(--white);
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.1em;
  margin-left: 8px;
  transition: var(--transition);
}

.chat-box .input-row button:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-orange);
}

.msg {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 18px;
  margin-bottom: 6px;
  font-size: 0.88em;
  word-wrap: break-word;
  font-weight: 500;
  line-height: 1.5;
}

.msg.user {
  background: var(--orange-gradient);
  color: var(--white);
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.msg.admin {
  background: var(--white);
  color: var(--gray800);
  border: 1px solid var(--gray200);
  border-bottom-left-radius: 4px;
}

.msg .time {
  font-size: 0.7em;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
  font-family: 'Space Grotesk', sans-serif;
}

/* Responsive */
@media(max-width: 768px) {
  .hero h1 { font-size: 2.2em; }
  .section-heading { font-size: 1.8em; }
  .verified-grid,
  .fake-grid { grid-template-columns: 1fr; }
  .proof-grid { grid-template-columns: 1fr; }
  .music-player { flex-direction: column; text-align: center; }
  .chat-box { width: 100%; height: 100%; bottom: 0; right: 0; border-radius: 0; }
  .nav { padding: 0 16px; }
  .section { padding: 60px 16px; }
  .hero-stats { gap: 28px; }
}
</style>
</head>
<body>

<!-- Navigation -->
<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <img src="${ASSETS.profile}" alt="Logo" onerror="this.style.display='none'">
      <span>Baiilla Maach</span>
    </a>
    <a href="/messenger" class="nav-chat">
      <img src="${ASSETS.messageBubble}" alt="Chat"> Chat Support
    </a>
  </div>
</nav>

<!-- Hero Section -->
<section class="hero">
  <div class="hero-avatar">
    <img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'">
    <div class="verified-icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
  </div>
  <h1>Hammad Bin Amir</h1>
  <p class="username">@baiillamaach_official</p>
  <p class="bio">Official Entertainment Profile · Verified Creator</p>
  <div class="hero-stats">
    <div class="hero-stat"><div class="num">7K</div><div class="label">Followers</div></div>
    <div class="hero-stat"><div class="num">0</div><div class="label">Following</div></div>
    <div class="hero-stat"><div class="num">190K</div><div class="label">Likes</div></div>
  </div>
  <div class="hero-badge">✓ Verified Official Account</div>
  <div class="hero-btns">
    <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="hero-btn tiktok">
      <img src="${ASSETS.logoTikTok}" alt=""> TikTok
    </a>
    <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="hero-btn facebook">
      <img src="${ASSETS.logoFB}" alt=""> Facebook
    </a>
  </div>
</section>

<!-- Verified Accounts Section -->
<section class="section bg-green">
  <div class="container">
    <div class="section-label" style="color:var(--green-dark)">OFFICIAL</div>
    <h2 class="section-heading">Verified Accounts</h2>
    <p class="section-desc">The only authentic Baiilla Maach accounts. Follow the real one.</p>
    <div class="verified-grid">
      <div class="verified-card">
        <div class="card-top">
          <img src="${ASSETS.profile}" class="pfp" onerror="this.style.display='none'">
          <div class="info">
            <h3>TikTok <img src="${ASSETS.blueTikTok}" onerror="this.style.display='none'"></h3>
            <p class="handle">@baiillamaach_official</p>
          </div>
        </div>
        <div class="card-body">
          <div class="row">✓ Status: <strong>Active & Verified</strong></div>
          <div class="row">👥 Followers: <strong>7,000</strong></div>
          <div class="row">❤️ Likes: <strong>190,000</strong></div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok-btn">
            <img src="${ASSETS.logoTikTok}" alt="TikTok"> Follow on TikTok
          </a>
        </div>
      </div>
      <div class="verified-card">
        <div class="card-top">
          <img src="${ASSETS.fbProfile}" class="pfp" onerror="this.style.display='none'">
          <div class="info">
            <h3>Facebook <img src="${ASSETS.blueFB}" onerror="this.style.display='none'"></h3>
            <p class="handle">@BaiillaMaachOfficial</p>
          </div>
        </div>
        <div class="card-body">
          <div class="row">✓ Status: <strong>Active & Verified</strong></div>
          <div class="row">📘 Page: <strong>Official Facebook</strong></div>
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">
            <img src="${ASSETS.logoFB}" alt="Facebook"> Follow on Facebook
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Fake Accounts Section -->
<section class="section bg-red">
  <div class="container">
    <div class="section-label" style="color:var(--red)">⚠️ WARNING</div>
    <h2 class="section-heading">Fake Accounts Detected</h2>
    <p class="section-desc">Report these accounts immediately to protect the community</p>
    <div class="fake-grid">
      <div class="fake-card">
        <div class="fake-img-container">
          <img src="${ASSETS.baillamachFake}" class="fake-img" alt="Fake Account" onerror="this.style.display='none'">
          <img src="${ASSETS.fakeDetect}" class="fake-detect" alt="FAKE" onerror="this.style.display='none'">
        </div>
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="plat">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers. Uses similar name to confuse fans.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn">
            <img src="${ASSETS.reportBtn}" alt=""> Report Account
          </a>
        </div>
      </div>
      <div class="fake-card">
        <div class="fake-img-container">
          <img src="${ASSETS.hammadFake}" class="fake-img" alt="Fake Account" onerror="this.style.display='none'">
          <img src="${ASSETS.fakeDetect}" class="fake-detect" alt="FAKE" onerror="this.style.display='none'">
        </div>
        <div class="fake-info">
          <h3>@hammad_fams0</h3>
          <p class="plat">📍 TikTok</p>
          <p>Uses official name and photo to mislead followers. Impersonating with fake content.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn">
            <img src="${ASSETS.reportBtn}" alt=""> Report Account
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Identity Verification Section -->
<section class="section bg-gray">
  <div class="container">
    <div class="section-label">PROOF</div>
    <h2 class="section-heading">Identity Verification</h2>
    <p class="section-desc">Evidence confirming authenticity of Baiilla Maach</p>
    <div class="proof-grid">
      <div class="proof-card">
        <img src="${ASSETS.realId}" alt="Real ID Proof" onerror="this.style.display='none'">
        <p>Real ID Verified</p>
        <div class="real-account-badge">
          <svg viewBox="0 0 24 24" fill="#10b981">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>Real Account</span>
        </div>
      </div>
      <div class="proof-card">
        <img src="${ASSETS.fakeDetect}" alt="Fake Detection" onerror="this.style.display='none'">
        <p>Fake Account Detection</p>
      </div>
      <div class="proof-card">
        <img src="${ASSETS.microphone}" alt="Voice Note" onerror="this.style.display='none'">
        <p>Real Voice Recording</p>
      </div>
    </div>
  </div>
</section>

${WELCOME_VOICE || MANUAL_VOICE ? `
<section class="section bg-white">
  <div class="container" style="text-align:center">
    <div class="section-label">VOICE</div>
    <h2 class="section-heading">Voice Verification</h2>
    <p class="section-desc">Listen to authentic Baiilla Maach voice recordings</p>
    <div class="voice-btns">
      ${WELCOME_VOICE ? `<button class="voice-btn welcome" onclick="playWelcome()">▶️ Real Voice</button>` : ''}
      ${MANUAL_VOICE ? `<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Alert</button>` : ''}
    </div>
  </div>
</section>` : ''}

${musicHTML}

<!-- Footer -->
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-col">
      <h4>About Baiilla Maach</h4>
      <p>Official verification hub for Hammad Bin Amir (Baiilla Maach). We protect fans from fake accounts and provide authentic content.</p>
      <div class="footer-social">
        <a href="https://tiktok.com/@baiillamaach_official" target="_blank" title="TikTok">
          <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 01-2.88 2.51 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.34 0 .66.06.96.17v-3.5a6.37 6.37 0 00-.96-.07 6.4 6.4 0 100 12.8 6.4 6.4 0 006.4-6.4V8.56a8.18 8.18 0 004.7 1.5v-3.4a4.76 4.76 0 01-.1.03z"/></svg>
        </a>
        <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" title="Facebook">
          <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
      </div>
    </div>
    <div class="footer-col">
      <h4>Quick Links</h4>
      <a href="https://tiktok.com/@baiillamaach_official" target="_blank">→ TikTok Profile</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank">→ Facebook Page</a>
      <a href="/messenger">→ Chat Support</a>
      <a href="#">→ Privacy Policy</a>
    </div>
    <div class="footer-col">
      <h4>Contact & Support</h4>
      <p>Use the chat button for instant support</p>
      <p>Report fake accounts immediately</p>
      <p style="margin-top:8px;font-weight:600;color:var(--orange)">admin@baillamaach.com</p>
    </div>
    <div class="footer-col">
      <h4>Verification</h4>
      <p>✓ Identity Verified</p>
      <p>✓ Blue Tick Certified</p>
      <p>✓ Official Creator</p>
      <p>✓ Active Since 2024</p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© 2024 <span>Baiilla Maach</span>. All rights reserved. | Designed with ❤️ for the community</p>
  </div>
</footer>

<!-- Chat Widget -->
<div class="chat-widget">
  <div class="chat-bubble" onclick="openChat()">
    <img src="${ASSETS.messageBubble}" alt="Chat">
  </div>
</div>

<div class="chat-box" id="chatBox">
  <div class="head">💬 Chat Support <button onclick="closeChat()">✕</button></div>
  <div class="body" id="chatBody">
    <div class="login-form" id="chatLogin">
      <h4 style="margin-bottom:14px;font-family:'Syne','Outfit',sans-serif;font-size:1.1em;">Start Chat</h4>
      <input type="text" id="chatName" placeholder="Your Name">
      <input type="text" id="chatEmail" placeholder="Email or Phone">
      <button onclick="startChat()">Start Chatting</button>
    </div>
  </div>
  <div class="input-row" id="chatInput">
    <div style="display:flex;align-items:center">
      <input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()">
      <button onclick="sendMsg()">➤</button>
    </div>
  </div>
</div>

${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>` : ''}
${MANUAL_VOICE ? `<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>` : ''}

<script src="/socket.io/socket.io.js"></script>
<script>
window.addEventListener('load',()=>{const a=document.getElementById('welcomeAudio');if(a)setTimeout(()=>a.play().catch(()=>{}),1200)});
function playWelcome(){const a=document.getElementById('welcomeAudio');if(a){a.currentTime=0;a.play()}}
function playManual(){const a=document.getElementById('manualAudio');if(a){a.currentTime=0;a.play()}}
const tracks=${JSON.stringify(songs)};
let ct=0,playing=false;
const audio=new Audio();
if(tracks.length>0){audio.src=tracks[0].url;audio.load()}
function playTrack(i){
  ct=i;audio.src=tracks[i].url;audio.load();audio.play();playing=true;
  document.getElementById('playBtn').textContent='⏸️';
  document.getElementById('trackTitle').textContent=tracks[i].title;
  document.querySelectorAll('.music-item').forEach((el,j)=>el.classList.toggle('active',j===i));
  const coverImg=document.querySelector('.music-cover img');
  if(coverImg)coverImg.classList.add('playing');
}
function togglePlay(){
  if(audio.paused){audio.play();playing=true;document.getElementById('playBtn').textContent='⏸️';
    const coverImg=document.querySelector('.music-cover img');
    if(coverImg)coverImg.classList.add('playing');
  }else{audio.pause();playing=false;document.getElementById('playBtn').textContent='▶️';
    const coverImg=document.querySelector('.music-cover img');
    if(coverImg)coverImg.classList.remove('playing');
  }
}
function prevTrack(){playTrack((ct-1+tracks.length)%tracks.length)}
function nextTrack(){playTrack((ct+1)%tracks.length)}
audio.addEventListener('timeupdate',()=>{
  const p=(audio.currentTime/audio.duration)*100||0;
  document.getElementById('progressBar').style.width=p+'%';
  document.getElementById('currentTime').textContent=ft(audio.currentTime);
  document.getElementById('duration').textContent=ft(audio.duration)
});
audio.addEventListener('ended',nextTrack);
function seekTrack(e){const r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration}
function ft(s){if(isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}
const socket=io();let cu=null;
function openChat(){document.getElementById('chatBox').classList.add('open')}
function closeChat(){document.getElementById('chatBox').classList.remove('open')}
function startChat(){
  const n=document.getElementById('chatName').value.trim();
  const e=document.getElementById('chatEmail').value.trim();
  if(!n||!e)return;cu={name:n,email:e};
  socket.emit('register',{name:n,email:e});
  document.getElementById('chatLogin').style.display='none';
  document.getElementById('chatInput').style.display='block';
  loadMsgs()
}
async function loadMsgs(){
  if(!cu)return;const r=await fetch('/api/msgs/'+cu.email);const ms=await r.json();
  const b=document.getElementById('chatBody');
  b.innerHTML=ms.map(m=>'<div class="msg '+(m.sender===cu.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
  b.scrollTop=b.scrollHeight
}
function sendMsg(){
  const i=document.getElementById('chatMsg');const m=i.value.trim();
  if(!m||!cu)return;socket.emit('sendMsg',{sender:cu.email,receiver:'admin',message:m,type:'text'});i.value=''
}
socket.on('newMsg',(m)=>{
  if(cu&&(m.sender===cu.email||m.receiver===cu.email)){
    const b=document.getElementById('chatBody');
    b.insertAdjacentHTML('beforeend','<div class="msg '+(m.sender===cu.email?'user':'admin')+'">'+(m.type==='image'?'<img src="'+m.fileUrl+'" style="max-width:120px;border-radius:8px">':m.message)+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');
    b.scrollTop=b.scrollHeight
  }
});
</script>
</body>
</html>`);
});

app.get('/api/msgs/:email', async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { sender: req.params.email, receiver: 'admin@baillamaach.com' },
        { sender: 'admin@baillamaach.com', receiver: req.params.email }
      ]
    }).sort({ timestamp: 1 }).lean();
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email, isAdmin: true });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ token: 'ok', message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({ isAdmin: false })
      .sort({ lastSeen: -1 })
      .lean();
    for (let u of users) {
      u.unreadCount = await Message.countDocuments({
        sender: u.email,
        receiver: 'admin@baillamaach.com',
        seen: false
      });
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Messenger | Baiilla Maach Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8f9fb;height:100vh;overflow:hidden;color:#1f2937}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
.login-card{background:#fff;padding:40px;border-radius:20px;width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:slideUp 0.3s ease}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.login-card .logo{width:60px;height:60px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#fff;font-size:1.5em;font-weight:700}
.login-card h2{font-family:'Outfit',sans-serif;margin-bottom:6px;font-size:1.5em;color:#111827}
.login-card .subtitle{color:#9ca3af;font-size:0.9em;margin-bottom:24px}
.login-card .input-group{margin-bottom:14px;text-align:left}
.login-card .input-group label{display:block;font-size:0.8em;font-weight:600;color:#4b5563;margin-bottom:4px}
.login-card .input-group input{width:100%;padding:12px 16px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:0.95em;outline:none;transition:border-color 0.2s;font-family:'Inter',sans-serif}
.login-card .input-group input:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,0.1)}
.login-card button{width:100%;padding:12px;background:#f97316;color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:1em;transition:all 0.2s;font-family:'Inter',sans-serif}
.login-card button:hover{background:#ea580c;transform:translateY(-1px)}
.login-card button:disabled{opacity:0.7;cursor:not-allowed;transform:none}
.login-error{color:#ef4444;font-size:0.85em;margin-top:10px;display:none}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:0 0 40px rgba(0,0,0,0.05)}
.sidebar{width:360px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
.sidebar-header h2{font-family:'Outfit',sans-serif;font-size:1.2em;color:#111827}
.sidebar-header .logout-btn{background:#fee2e2;color:#ef4444;border:none;padding:7px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.8em;transition:0.2s}
.sidebar-header .logout-btn:hover{background:#fecaca}
.search-bar{padding:12px 16px;border-bottom:1px solid #e5e7eb}
.search-bar input{width:100%;padding:10px 16px;border:1.5px solid #e5e7eb;border-radius:24px;font-size:0.9em;outline:none;background:#f9fafb;transition:0.2s;font-family:'Inter',sans-serif}
.search-bar input:focus{border-color:#f97316;background:#fff}
.user-list{flex:1;overflow-y:auto}
.user-list::-webkit-scrollbar{width:4px}
.user-list::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}
.user-item{padding:14px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:0.15s;border-bottom:1px solid #f3f4f6;position:relative}
.user-item:hover{background:#f9fafb}
.user-item.active{background:#fff7ed;border-left:3px solid #f97316}
.user-avatar{width:44px;height:44px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.9em;color:#111827}
.user-info .email{font-size:0.78em;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-info .last-msg{font-size:0.75em;color:#9ca3af;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-time{font-size:0.7em;color:#d1d5db;flex-shrink:0}
.unread{background:#f97316;color:#fff;font-size:0.7em;padding:3px 8px;border-radius:10px;font-weight:700;flex-shrink:0}
.empty-state{text-align:center;padding:40px 20px;color:#9ca3af}
.empty-state .empty-icon{font-size:2em;margin-bottom:8px}
.empty-state p{font-weight:500}
.empty-state span{font-size:0.8em}
.chat-area{flex:1;display:flex;flex-direction:column;background:#f8f9fb}
.chat-header{padding:16px 24px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:12px}
.chat-header .avatar{width:42px;height:42px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.95em;flex-shrink:0}
.chat-header .name{font-weight:600;font-size:1em;color:#111827}
.chat-header .status{font-size:0.8em;display:flex;align-items:center;gap:4px}
.online-dot{width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block}
.offline-dot{width:7px;height:7px;border-radius:50%;background:#d1d5db;display:inline-block}
.chat-messages{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:2px}
.chat-messages::-webkit-scrollbar{width:4px}
.chat-messages::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}
.message{max-width:65%;padding:10px 16px;border-radius:18px;font-size:0.9em;line-height:1.5;word-wrap:break-word;position:relative;animation:fadeIn 0.2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.message.sent{background:#f97316;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;margin-left:auto}
.message.received{background:#fff;color:#1f2937;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}
.message .time{font-size:0.65em;opacity:0.7;margin-top:4px;text-align:right}
.date-divider{text-align:center;margin:16px 0;font-size:0.75em}
.date-divider span{background:#e5e7eb;color:#6b7280;padding:4px 12px;border-radius:10px;font-weight:500}
.chat-input{padding:14px 24px;background:#fff;border-top:1px solid #e5e7eb;display:none;gap:10px;align-items:center}
.chat-input input{flex:1;padding:10px 18px;border:1.5px solid #e5e7eb;border-radius:24px;font-size:0.9em;outline:none;font-family:'Inter',sans-serif;transition:0.2s}
.chat-input input:focus{border-color:#f97316}
.chat-input button{background:#f97316;color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em;flex-shrink:0;transition:0.2s;display:flex;align-items:center;justify-content:center}
.chat-input button:hover{background:#ea580c;transform:scale(1.05)}
@media(max-width:768px){
  .sidebar{width:100%;display:none}
  .sidebar.mobile-show{display:flex}
  .chat-area{width:100%}
  .login-card{width:90%;padding:30px}
}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <div class="logo">BM</div>
    <h2>Admin Messenger</h2>
    <p class="subtitle">Baiilla Maach Support Panel</p>
    <div class="input-group">
      <label>Email</label>
      <input type="email" id="loginEmail" placeholder="admin@baillamaach.com" autocomplete="email">
    </div>
    <div class="input-group">
      <label>Password</label>
      <input type="password" id="loginPassword" placeholder="Enter password" autocomplete="current-password">
    </div>
    <button id="loginBtn" onclick="ChatAdmin.login()">Sign In</button>
    <div class="login-error" id="loginError"></div>
  </div>
</div>
<div class="app" id="app">
  <div class="app-layout">
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h2>💬 Conversations</h2>
        <button class="logout-btn" onclick="ChatAdmin.logout()">Logout</button>
      </div>
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="🔍 Search users..." oninput="ChatAdmin.filterUsers()">
      </div>
      <div class="user-list" id="userList">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>No conversations</p>
        </div>
      </div>
    </div>
    <div class="chat-area">
      <div class="chat-header">
        <div class="avatar" id="chatAvatar">?</div>
        <div>
          <div class="name" id="chatName">Select a user</div>
          <div class="status" id="chatStatus"></div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="empty-state" id="emptyChat">
          <div class="empty-icon">💬</div>
          <p>Select a conversation</p>
          <span>Choose a user from the sidebar</span>
        </div>
      </div>
      <div class="chat-input" id="chatInputArea">
        <input type="text" id="msgInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter')ChatAdmin.sendMessage()">
        <button onclick="ChatAdmin.sendMessage()">➤</button>
      </div>
    </div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
const ChatAdmin = {
    socket: null,
    currentUser: null,
    users: [],
    messages: [],
    isLoggedIn: false,

    init() {
        this.socket = io();
        this.socket.on('newMsg', (msg) => {
            if (this.currentUser && 
                ((msg.sender === this.currentUser.email && msg.receiver === 'admin@baillamaach.com') ||
                 (msg.sender === 'admin@baillamaach.com' && msg.receiver === this.currentUser.email))) {
                this.messages.push(msg);
                this.renderMessages();
                this.markAsRead();
            }
            this.loadUsers();
        });
        this.socket.on('userStatus', (data) => {
            this.updateUserStatus(data.email, data.online);
        });
        const savedSession = localStorage.getItem('adminSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            document.getElementById('loginEmail').value = session.email;
            document.getElementById('loginPassword').value = session.password;
            this.login(true);
        }
    },

    async login(isAutoLogin = false) {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');
        if (!email || !password) {
            errorDiv.textContent = 'Please fill in all fields';
            errorDiv.style.display = 'block';
            return;
        }
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
        errorDiv.style.display = 'none';
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                this.isLoggedIn = true;
                document.getElementById('loginOverlay').style.display = 'none';
                document.getElementById('app').style.display = 'block';
                localStorage.setItem('adminSession', JSON.stringify({ email, password }));
                await this.loadUsers();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
                localStorage.removeItem('adminSession');
            }
        } catch (err) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            localStorage.removeItem('adminSession');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Sign In';
        }
    },

    async loadUsers() {
        if (!this.isLoggedIn) return;
        try {
            const response = await fetch('/api/admin/users');
            this.users = await response.json();
            this.renderUserList();
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    },

    async selectUser(user) {
        this.currentUser = user;
        document.getElementById('chatAvatar').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('chatName').textContent = user.name;
        document.getElementById('chatStatus').innerHTML = 
            user.isOnline ? '<span class="online-dot"></span> Online' : 
            '<span class="offline-dot"></span> Offline';
        document.getElementById('chatInputArea').style.display = 'flex';
        document.getElementById('emptyChat').style.display = 'none';
        document.getElementById('msgInput').focus();
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.email === user.email) {
                item.classList.add('active');
            }
        });
        await this.loadMessages();
        await this.markAsRead();
    },

    async loadMessages() {
        if (!this.currentUser) return;
        try {
            const response = await fetch('/api/msgs/' + this.currentUser.email);
            const allMessages = await response.json();
            this.messages = allMessages.filter(msg => 
                (msg.sender === this.currentUser.email && msg.receiver === 'admin@baillamaach.com') ||
                (msg.sender === 'admin@baillamaach.com' && msg.receiver === this.currentUser.email)
            );
            this.renderMessages();
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    },

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (this.messages.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No messages yet</p><span>Start the conversation</span></div>';
            return;
        }
        let html = '';
        let lastDate = '';
        this.messages.forEach(msg => {
            const msgDate = new Date(msg.timestamp).toLocaleDateString();
            if (msgDate !== lastDate) {
                html += '<div class="date-divider"><span>' + msgDate + '</span></div>';
                lastDate = msgDate;
            }
            const isSentByAdmin = msg.sender === 'admin@baillamaach.com';
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            html += '<div class="message ' + (isSentByAdmin ? 'sent' : 'received') + '">' +
                (msg.type === 'image' ? '<img src="' + msg.fileUrl + '" style="max-width:200px;border-radius:8px">' : msg.message) +
                '<div class="time">' + time + (isSentByAdmin ? ' ✓' : '') + '</div></div>';
        });
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    },

    async sendMessage() {
        const input = document.getElementById('msgInput');
        const message = input.value.trim();
        if (!message || !this.currentUser) return;
        try {
            this.socket.emit('sendMsg', {
                sender: 'admin@baillamaach.com',
                receiver: this.currentUser.email,
                message: message,
                type: 'text'
            });
            const newMsg = {
                sender: 'admin@baillamaach.com',
                receiver: this.currentUser.email,
                message: message,
                type: 'text',
                timestamp: new Date()
            };
            this.messages.push(newMsg);
            this.renderMessages();
            input.value = '';
            input.focus();
            setTimeout(() => this.loadUsers(), 500);
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    },

    async markAsRead() {
        if (!this.currentUser) return;
        this.socket.emit('markRead', { user: this.currentUser.email });
        this.loadUsers();
    },

    updateUserStatus(email, online) {
        const userElement = document.querySelector('.user-item[data-email="' + email + '"]');
        if (userElement) {
            const dotElement = userElement.querySelector('.dot');
            if (dotElement) {
                dotElement.style.background = online ? '#10b981' : '#d1d5db';
            }
        }
        if (this.currentUser && this.currentUser.email === email) {
            document.getElementById('chatStatus').innerHTML = 
                online ? '<span class="online-dot"></span> Online' : 
                '<span class="offline-dot"></span> Offline';
        }
    },

    renderUserList() {
        const container = document.getElementById('userList');
        const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
        const filteredUsers = this.users.filter(user => 
            user.name.toLowerCase().includes(searchTerm) || 
            user.email.toLowerCase().includes(searchTerm)
        );
        if (filteredUsers.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No conversations found</p></div>';
            return;
        }
        container.innerHTML = filteredUsers.map(user => {
            const lastSeen = user.lastSeen ? new Date(user.lastSeen) : null;
            const timeAgo = lastSeen ? this.getTimeAgo(lastSeen) : '';
            const isActive = this.currentUser && this.currentUser.email === user.email;
            return '<div class="user-item' + (isActive ? ' active' : '') + '" data-email="' + user.email + '" onclick="ChatAdmin.selectUserById(\'' + user.email + '\')">' +
                '<div class="user-avatar">' + user.name.charAt(0).toUpperCase() +
                '<div class="dot" style="background:' + (user.isOnline ? '#10b981' : '#d1d5db') + '"></div></div>' +
                '<div class="user-info"><div class="name">' + user.name + '</div><div class="email">' + user.email + '</div></div>' +
                (user.unreadCount > 0 ? '<div class="unread">' + user.unreadCount + '</div>' : '') +
                '<div class="user-time">' + timeAgo + '</div></div>';
        }).join('');
    },

    selectUserById(email) {
        const user = this.users.find(u => u.email === email);
        if (user) {
            this.selectUser(user);
        }
    },

    filterUsers() {
        this.renderUserList();
    },

    getTimeAgo(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        return Math.floor(diff / 86400) + 'd';
    },

    logout() {
        localStorage.removeItem('adminSession');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ChatAdmin.init();
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') ChatAdmin.login();
    });
});

setInterval(() => {
    if (ChatAdmin.isLoggedIn) ChatAdmin.loadUsers();
}, 30000);
</script>
</body>
</html>`);
});

io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);
  socket.on('register', async (data) => {
    try {
      socket.userData = data;
      let user = await User.findOne({ email: data.email });
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
        user = await User.create({
          name: data.name,
          email: data.email,
          password: hash
        });
      }
      await User.updateOne(
        { email: data.email },
        { $set: { isOnline: true, lastSeen: new Date() } }
      );
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) {
      console.error('Register error:', err.message);
    }
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
    } catch (err) {
      console.error('Send message error:', err.message);
    }
  });
  socket.on('markRead', async (data) => {
    try {
      await Message.updateMany(
        { sender: data.user, receiver: 'admin@baillamaach.com', seen: false },
        { $set: { seen: true } }
      );
    } catch (err) {
      console.error('Mark read error:', err.message);
    }
  });
  socket.on('disconnect', async () => {
    if (socket.userData) {
      try {
        await User.updateOne(
          { email: socket.userData.email },
          { $set: { isOnline: false, lastSeen: new Date() } }
        );
        io.emit('userStatus', { email: socket.userData.email, online: false });
      } catch (err) {
        console.error('Disconnect error:', err.message);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
  console.log('📧 Admin panel: http://localhost:' + PORT + '/messenger');
  console.log('📧 Admin Email: admin');
  console.log('🔑 Admin Password: admin123baiilla');
});

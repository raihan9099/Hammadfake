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
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

app.use(express.json());
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

['uploads', 'assets/covermusic'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
      await User.create({ name: 'Baiilla Maach', email: adminEmail, password: hashedPassword, isAdmin: true });
      console.log('✅ Admin user created');
    }
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
  } catch (e) { return []; }
}

app.get('/', (req, res) => {
  const songs = getSongs();
  
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#f97316">
<title>Hammad Bin Amir — Official Verification | Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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
  --blue: #3b82f6;
  --blue-light: #eff6ff;
  --spotify-black: #121212;
  --spotify-dark: #1a1a1a;
  --spotify-card: #1e1e1e;
  --spotify-hover: #282828;
  --spotify-green: #1db954;
  --spotify-text: #b3b3b3;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.08);
  --shadow-xl: 0 20px 50px rgba(0,0,0,0.12);
  --radius: 16px;
  --radius-sm: 10px;
  --radius-full: 9999px;
  --transition: all 0.25s ease;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  background: var(--white);
  color: var(--gray800);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--gray300); border-radius: 3px; }

.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--gray200);
  padding: 0 28px;
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}
.nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.nav-brand img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--orange); }
.nav-brand span { font-family: 'Syne', 'Outfit', sans-serif; font-weight: 700; font-size: 1.1em; color: var(--gray900); }
.nav-chat {
  display: flex; align-items: center; gap: 7px;
  background: var(--green); color: var(--white);
  padding: 9px 20px; border-radius: var(--radius-full);
  text-decoration: none; font-weight: 600; font-size: 0.82em;
  transition: var(--transition);
}
.nav-chat:hover { background: #059669; transform: translateY(-2px); }

.hero { padding: 80px 24px 60px; text-align: center; max-width: 700px; margin: 0 auto; }
.hero-avatar { position: relative; display: inline-block; margin-bottom: 20px; }
.hero-avatar img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--orange); box-shadow: 0 0 0 8px var(--orange-light); }
.hero-avatar .verified-icon {
  position: absolute; bottom: 8px; right: 8px;
  background: var(--green); width: 28px; height: 28px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  border: 3px solid var(--white);
}
.hero-avatar .verified-icon svg { width: 14px; height: 14px; fill: var(--white); }
.hero h1 { font-family: 'Syne', 'Outfit', sans-serif; font-size: 2.3em; font-weight: 800; color: var(--gray900); letter-spacing: -0.8px; margin-bottom: 4px; }
.hero .username { font-size: 0.95em; color: var(--gray500); margin-bottom: 4px; }
.hero .bio { color: var(--gray400); font-size: 0.85em; margin-bottom: 18px; }
.hero-stats { display: flex; justify-content: center; gap: 36px; margin: 20px 0; }
.hero-stat { text-align: center; }
.hero-stat .num { font-family: 'Syne', sans-serif; font-size: 1.5em; font-weight: 700; color: var(--gray900); }
.hero-stat .label { font-size: 0.72em; color: var(--gray400); text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--green-light); color: var(--green);
  padding: 6px 16px; border-radius: var(--radius-full);
  font-weight: 600; font-size: 0.78em; margin-bottom: 18px;
}
.hero-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
.hero-btn {
  padding: 10px 22px; border-radius: var(--radius-full);
  text-decoration: none; font-weight: 600; font-size: 0.82em;
  display: flex; align-items: center; gap: 6px; transition: var(--transition);
}
.hero-btn img { width: 18px; height: 18px; }
.hero-btn.tiktok { background: var(--gray900); color: var(--white); }
.hero-btn.tiktok:hover { background: #000; }
.hero-btn.facebook { background: var(--blue-light); color: var(--blue); }
.hero-btn.facebook:hover { background: #dbeafe; }

.section { padding: 70px 28px; }
.section.bg-green { background: var(--green-light); }
.section.bg-red { background: var(--red-light); }
.section.bg-gray { background: var(--gray50); }
.section.bg-white { background: var(--white); }
.section.music-section { background: #121212; }

.container { max-width: 1050px; margin: 0 auto; }

.section-label {
  display: inline-block; font-size: 0.7em; font-weight: 700;
  text-transform: uppercase; letter-spacing: 2.5px;
  color: var(--orange); margin-bottom: 12px;
}
.section-heading {
  font-family: 'Syne', 'Outfit', sans-serif;
  font-size: 2em; font-weight: 700; color: var(--gray900);
  text-align: center; letter-spacing: -0.5px; margin-bottom: 6px;
}
.section-heading.white { color: var(--white); }
.section-desc {
  text-align: center; color: var(--gray500); margin-bottom: 36px;
  font-size: 0.88em; max-width: 500px; margin-left: auto; margin-right: auto;
}
.section-desc.white { color: #b3b3b3; }

.verified-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.verified-card {
  background: var(--white); border: 1px solid var(--gray200);
  border-radius: var(--radius); padding: 26px; transition: var(--transition);
}
.verified-card:hover { border-color: var(--green); box-shadow: var(--shadow-md); }
.verified-card .card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.verified-card .card-top .pfp { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
.verified-card .card-top .info h3 {
  font-family: 'Syne', sans-serif; font-size: 1em; font-weight: 600;
  display: flex; align-items: center; gap: 5px; color: var(--gray900);
}
.verified-card .card-top .info h3 img { width: 18px; height: 18px; }
.verified-card .card-top .info .handle { color: var(--gray500); font-size: 0.8em; }
.verified-card .card-body .row {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 0; color: var(--gray600); font-size: 0.82em;
}
.verified-card .card-body .row strong { color: var(--gray800); font-weight: 600; }
.verified-card .card-body .follow-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 20px; border-radius: var(--radius-full);
  text-decoration: none; font-weight: 600; font-size: 0.78em;
  margin-top: 12px; transition: var(--transition);
}
.follow-btn.tiktok-btn { background: var(--gray900); color: var(--white); }
.follow-btn.tiktok-btn:hover { background: #000; }
.follow-btn.fb-btn { background: var(--blue); color: var(--white); }
.follow-btn.fb-btn:hover { background: #2563eb; }

.fake-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.fake-card {
  background: var(--white); border: 2px solid #fecaca;
  border-radius: var(--radius); overflow: hidden; transition: var(--transition);
}
.fake-card:hover { box-shadow: var(--shadow-lg); }
.fake-img-container { position: relative; text-align: center; background: #fafafa; padding: 18px; }
.fake-img { max-width: 100%; height: auto; border-radius: 8px; }
.fake-detect {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%); width: 70px; height: 70px;
  animation: updown 2s infinite ease-in-out;
}
@keyframes updown {
  0%, 100% { transform: translate(-50%, -50%) translateY(0); }
  50% { transform: translate(-50%, -50%) translateY(-15px); }
}
.fake-card .fake-info { padding: 18px; }
.fake-card .fake-info h3 { font-family: 'Syne', sans-serif; font-size: 1em; font-weight: 600; color: var(--gray900); margin-bottom: 3px; }
.fake-card .fake-info .plat { color: var(--orange); font-weight: 600; font-size: 0.78em; margin-bottom: 6px; }
.fake-card .fake-info p { color: var(--gray500); font-size: 0.82em; margin-bottom: 12px; }
.fake-card .fake-info .report-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--red); color: var(--white);
  padding: 7px 16px; border-radius: var(--radius-full);
  text-decoration: none; font-weight: 600; font-size: 0.76em;
  transition: var(--transition);
}
.fake-card .fake-info .report-btn:hover { background: #dc2626; }
.fake-card .fake-info .report-btn img { width: 14px; height: 14px; }

.proof-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.proof-card {
  background: var(--white); border: 1px solid var(--gray200);
  border-radius: var(--radius-sm); padding: 22px; text-align: center;
  transition: var(--transition);
}
.proof-card:hover { border-color: var(--orange); box-shadow: var(--shadow-sm); }
.proof-card img { width: 100%; height: auto; border-radius: 6px; margin-bottom: 10px; }
.proof-card p { font-weight: 600; font-size: 0.8em; color: var(--gray700); }

.real-account-badge {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 12px; background: var(--green-light);
  padding: 8px 16px; border-radius: var(--radius-full);
  border: 1px solid rgba(16,185,129,0.2);
}
.real-account-badge svg { width: 18px; height: 18px; }
.real-account-badge span { font-weight: 700; color: var(--green-dark); font-size: 0.85em; }

.voice-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 20px; }
.voice-btn {
  padding: 11px 24px; border-radius: var(--radius-full); border: none;
  font-weight: 600; cursor: pointer; font-size: 0.85em;
  display: flex; align-items: center; gap: 7px; transition: var(--transition);
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.voice-btn.welcome { background: var(--orange); color: var(--white); }
.voice-btn.welcome:hover { background: var(--orange-dark); transform: translateY(-2px); }
.voice-btn.manual { background: var(--white); color: var(--red); border: 2px solid var(--red); }
.voice-btn.manual:hover { background: var(--red); color: var(--white); transform: translateY(-2px); }

/* ============ SPOTIFY STYLE MUSIC PLAYER ============ */
.spotify-player {
  max-width: 700px;
  margin: 0 auto;
  background: var(--spotify-dark);
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
}

.spotify-now-playing {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.spotify-cover {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  flex-shrink: 0;
}

.spotify-track-info {
  flex: 1;
  min-width: 0;
}

.spotify-track-info h4 {
  font-family: 'Syne', sans-serif;
  font-size: 1.2em;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spotify-track-info p {
  color: #b3b3b3;
  font-size: 0.85em;
  font-weight: 500;
  margin-bottom: 14px;
}

.spotify-progress {
  width: 100%;
}

.spotify-progress-bar {
  width: 100%;
  height: 4px;
  background: #4d4d4d;
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 8px;
  position: relative;
}

.spotify-progress-bar:hover { height: 6px; }

.spotify-progress-fill {
  height: 100%;
  background: var(--spotify-green);
  border-radius: 2px;
  width: 0%;
  transition: width 0.1s linear;
  position: relative;
}

.spotify-progress-bar:hover .spotify-progress-fill::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background: var(--white);
  border-radius: 50%;
}

.spotify-time-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.7em;
  color: #b3b3b3;
  font-weight: 500;
}

.spotify-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 16px;
}

.spotify-ctrl-btn {
  background: none;
  border: none;
  color: #b3b3b3;
  cursor: pointer;
  font-size: 1.1em;
  transition: var(--transition);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spotify-ctrl-btn:hover { color: var(--white); }

.spotify-play-btn {
  background: var(--white);
  border: none;
  color: var(--spotify-black);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2em;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.spotify-play-btn:hover {
  transform: scale(1.06);
  background: #f0f0f0;
}

.spotify-play-btn.playing {
  background: var(--spotify-green);
  color: var(--spotify-black);
}

.spotify-song-list {
  margin-top: 20px;
  max-height: 220px;
  overflow-y: auto;
  border-top: 1px solid #282828;
  padding-top: 8px;
}

.spotify-song-list::-webkit-scrollbar { width: 4px; }
.spotify-song-list::-webkit-scrollbar-thumb { background: #4d4d4d; border-radius: 2px; }

.spotify-song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: var(--transition);
  color: #b3b3b3;
  font-size: 0.82em;
}

.spotify-song-item:hover { background: var(--spotify-hover); color: var(--white); }

.spotify-song-item.active {
  background: #1a3a2a;
  color: var(--spotify-green);
}

.spotify-song-item .song-num {
  font-weight: 700;
  color: #b3b3b3;
  min-width: 24px;
  font-size: 0.9em;
}

.spotify-song-item.active .song-num { color: var(--spotify-green); }

.spotify-song-item .song-cover-mini {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.spotify-song-item .song-info-mini {
  flex: 1;
  min-width: 0;
}

.spotify-song-item .song-info-mini .song-title-mini {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--white);
}

.spotify-song-item.active .song-info-mini .song-title-mini { color: var(--spotify-green); }

.spotify-song-item .song-info-mini .song-artist-mini {
  font-size: 0.75em;
  color: #b3b3b3;
}

.spotify-song-item .now-playing-icon {
  color: var(--spotify-green);
  font-size: 0.7em;
  display: none;
}

.spotify-song-item.active .now-playing-icon { display: block; }
.spotify-song-item.active .song-num { display: none; }

/* Footer */
.footer {
  background: var(--gray900);
  color: var(--white);
  padding: 60px 28px 30px;
}
.footer-grid {
  max-width: 1050px;
  margin: 0 auto 40px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 30px;
}
.footer-col h4 { font-family: 'Syne', sans-serif; color: var(--orange); margin-bottom: 14px; font-size: 0.9em; font-weight: 700; }
.footer-col p { color: var(--gray400); font-size: 0.78em; line-height: 1.7; }
.footer-col a { color: var(--gray400); text-decoration: none; font-size: 0.78em; line-height: 2; transition: var(--transition); display: block; }
.footer-col a:hover { color: var(--orange); }
.footer-bottom {
  padding-top: 24px; border-top: 1px solid var(--gray700);
  text-align: center; font-size: 0.75em; color: var(--gray500);
  max-width: 1050px; margin: 0 auto;
}
.footer-bottom span { color: var(--orange); font-weight: 700; }

/* Chat Widget */
.chat-widget { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }
.chat-bubble {
  width: 56px; height: 56px; border-radius: 50%;
  cursor: pointer; background: var(--green);
  box-shadow: 0 6px 25px rgba(16,185,129,0.35);
  display: flex; align-items: center; justify-content: center;
  transition: var(--transition); animation: float 3s ease-in-out infinite;
}
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.chat-bubble:hover { transform: scale(1.08); }
.chat-bubble svg { width: 26px; height: 26px; fill: var(--white); }

.chat-window {
  display: none; position: fixed; bottom: 92px; right: 24px;
  width: 370px; height: 460px; background: var(--white);
  border-radius: 18px; flex-direction: column; overflow: hidden;
  z-index: 9999; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  border: 1px solid var(--gray200); animation: slideUp 0.3s ease;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
.chat-window.open { display: flex; }

.chat-header {
  background: var(--green); color: var(--white);
  padding: 14px 18px; display: flex; align-items: center;
  justify-content: space-between; font-weight: 600; font-size: 0.85em;
}
.chat-header-left { display: flex; align-items: center; gap: 8px; }
.chat-header-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--white); }
.chat-close { background: none; border: none; color: var(--white); cursor: pointer; font-size: 1.3em; }

.chat-messages { flex: 1; overflow-y: auto; padding: 14px; background: var(--gray50); }
.chat-login { padding: 30px 20px; text-align: center; }
.chat-login h4 { font-family: 'Syne', sans-serif; margin-bottom: 4px; font-size: 1em; color: var(--gray900); }
.chat-login p { color: var(--gray500); font-size: 0.78em; margin-bottom: 18px; }
.chat-login input {
  width: 100%; padding: 11px 14px; margin-bottom: 8px;
  border: 1.5px solid var(--gray200); border-radius: 10px;
  font-size: 0.82em; font-family: 'Plus Jakarta Sans', sans-serif;
  outline: none; transition: var(--transition);
}
.chat-login input:focus { border-color: var(--green); }
.chat-login button {
  width: 100%; padding: 11px; background: var(--green);
  color: var(--white); border: none; border-radius: 10px;
  font-weight: 600; cursor: pointer; font-size: 0.85em;
  transition: var(--transition);
}
.chat-login button:hover { background: #059669; }

.chat-input-area {
  padding: 12px 14px; background: var(--white);
  border-top: 1px solid var(--gray200); display: none;
}
.chat-input-row { display: flex; gap: 8px; align-items: center; }
.chat-input-row input {
  flex: 1; padding: 10px 14px; border: 1.5px solid var(--gray200);
  border-radius: 20px; font-size: 0.82em; outline: none;
  font-family: 'Plus Jakarta Sans', sans-serif; transition: var(--transition);
}
.chat-input-row input:focus { border-color: var(--green); }
.chat-input-row button {
  background: var(--green); color: var(--white); border: none;
  width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
  font-size: 1em; transition: var(--transition); flex-shrink: 0;
}
.chat-input-row button:hover { background: #059669; }

.msg {
  max-width: 80%; padding: 8px 12px; border-radius: 14px;
  margin-bottom: 4px; font-size: 0.8em; word-wrap: break-word;
  line-height: 1.4;
}
.msg.user { background: var(--green); color: var(--white); margin-left: auto; border-bottom-right-radius: 3px; }
.msg.admin { background: var(--white); color: var(--gray800); border: 1px solid var(--gray200); border-bottom-left-radius: 3px; }
.msg .time { font-size: 0.65em; opacity: 0.6; margin-top: 3px; text-align: right; }

@media(max-width: 768px) {
  .hero h1 { font-size: 1.7em; }
  .section-heading { font-size: 1.5em; }
  .verified-grid, .fake-grid { grid-template-columns: 1fr; }
  .proof-grid { grid-template-columns: 1fr; }
  .spotify-now-playing { flex-direction: column; text-align: center; }
  .chat-window { width: 100%; height: 100%; bottom: 0; right: 0; border-radius: 0; }
  .nav { padding: 0 16px; }
  .section { padding: 50px 16px; }
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
    <a href="/messenger" class="nav-chat">💬 Chat Support</a>
  </div>
</nav>

<!-- Hero -->
<section class="hero">
  <div class="hero-avatar">
    <img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'">
    <div class="verified-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
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
    <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="hero-btn tiktok"><img src="${ASSETS.logoTikTok}" alt=""> TikTok</a>
    <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="hero-btn facebook"><img src="${ASSETS.logoFB}" alt=""> Facebook</a>
  </div>
</section>

<!-- Verified Accounts -->
<section class="section bg-green">
  <div class="container">
    <div class="section-label" style="color:var(--green-dark)">OFFICIAL</div>
    <h2 class="section-heading">Verified Accounts</h2>
    <p class="section-desc">The only authentic Baiilla Maach accounts</p>
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
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok-btn">Follow on TikTok</a>
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
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">Follow on Facebook</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Fake Accounts -->
<section class="section bg-red">
  <div class="container">
    <div class="section-label" style="color:var(--red)">⚠️ WARNING</div>
    <h2 class="section-heading">Fake Accounts Detected</h2>
    <p class="section-desc">Report these accounts immediately</p>
    <div class="fake-grid">
      <div class="fake-card">
        <div class="fake-img-container">
          <img src="${ASSETS.baillamachFake}" class="fake-img" alt="Fake Account" onerror="this.style.display='none'">
          <img src="${ASSETS.fakeDetect}" class="fake-detect" alt="FAKE" onerror="this.style.display='none'">
        </div>
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="plat">📍 TikTok</p>
          <p>Copies official logo and content to deceive followers.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
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
          <p>Uses official name and photo to mislead followers.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn"><img src="${ASSETS.reportBtn}" alt=""> Report Account</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Identity Verification -->
<section class="section bg-gray">
  <div class="container">
    <div class="section-label">PROOF</div>
    <h2 class="section-heading">Identity Verification</h2>
    <p class="section-desc">Evidence confirming authenticity</p>
    <div class="proof-grid">
      <div class="proof-card">
        <img src="${ASSETS.realId}" alt="Real ID Proof" onerror="this.style.display='none'">
        <p>Real ID Verified</p>
        <div class="real-account-badge">
          <svg viewBox="0 0 24 24" fill="#10b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span>Real Account</span>
        </div>
      </div>
      <div class="proof-card">
        <img src="${ASSETS.microphone}" alt="Voice Note" onerror="this.style.display='none'">
        <p>Real Voice Recording</p>
      </div>
      <div class="proof-card">
        <img src="${ASSETS.officialTikTok}" alt="Official TikTok" onerror="this.style.display='none'">
        <p>Official TikTok Profile</p>
      </div>
    </div>
  </div>
</section>

${WELCOME_VOICE || MANUAL_VOICE ? `
<section class="section bg-white">
  <div class="container" style="text-align:center">
    <div class="section-label">VOICE</div>
    <h2 class="section-heading">Voice Verification</h2>
    <p class="section-desc">Listen to authentic Baiilla Maach voice</p>
    <div class="voice-btns">
      ${WELCOME_VOICE ? `<button class="voice-btn welcome" onclick="playWelcomeVoice()">▶️ Real Voice</button>` : ''}
      ${MANUAL_VOICE ? `<button class="voice-btn manual" onclick="playManualVoice()">⚠️ Fake Alert</button>` : ''}
    </div>
  </div>
</section>` : ''}

<!-- Spotify Style Music Player -->
${songs.length > 0 ? `
<section class="section music-section">
  <div class="container">
    <div class="section-label" style="color:var(--spotify-green)">MUSIC</div>
    <h2 class="section-heading white">Cover Songs</h2>
    <p class="section-desc white">Official covers by Hammad Bin Amir</p>
    <div class="spotify-player">
      <div class="spotify-now-playing">
        <img src="${ASSETS.microphone}" class="spotify-cover" id="spotifyCover" alt="Cover" onerror="this.src='${ASSETS.profile}'">
        <div class="spotify-track-info">
          <h4 id="spotifyTrackTitle">Select a Song</h4>
          <p>Baiilla Maach</p>
          <div class="spotify-progress">
            <div class="spotify-progress-bar" onclick="seekSpotify(event)">
              <div class="spotify-progress-fill" id="spotifyProgressFill"></div>
            </div>
            <div class="spotify-time-row">
              <span id="spotifyCurrentTime">0:00</span>
              <span id="spotifyDuration">0:00</span>
            </div>
          </div>
        </div>
      </div>
      <div class="spotify-controls">
        <button class="spotify-ctrl-btn" onclick="prevSpotifyTrack()" title="Previous">⏮</button>
        <button class="spotify-play-btn" id="spotifyPlayBtn" onclick="toggleSpotifyPlay()">▶</button>
        <button class="spotify-ctrl-btn" onclick="nextSpotifyTrack()" title="Next">⏭</button>
      </div>
      <div class="spotify-song-list" id="spotifySongList">
        ${songs.map((s, i) => `
          <div class="spotify-song-item" onclick="playSpotifyTrack(${i})" data-index="${i}">
            <span class="song-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="now-playing-icon">▶</span>
            <img src="${ASSETS.microphone}" class="song-cover-mini" alt="" onerror="this.style.display='none'">
            <div class="song-info-mini">
              <div class="song-title-mini">${s.title}</div>
              <div class="song-artist-mini">Baiilla Maach</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</section>` : ''}

<!-- Footer -->
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-col">
      <h4>About</h4>
      <p>Official verification hub for Baiilla Maach. Protecting fans from fake accounts.</p>
    </div>
    <div class="footer-col">
      <h4>Links</h4>
      <a href="https://tiktok.com/@baiillamaach_official">→ TikTok</a>
      <a href="https://www.facebook.com/profile.php?id=61575202118828">→ Facebook</a>
      <a href="/messenger">→ Chat Support</a>
    </div>
    <div class="footer-col">
      <h4>Contact</h4>
      <p>Use the chat button for support</p>
      <p style="color:var(--orange);font-weight:600;">admin@baillamaach.com</p>
    </div>
  </div>
  <div class="footer-bottom"><p>© 2024 <span>Baiilla Maach</span>. All rights reserved.</p></div>
</footer>

<!-- Chat Widget -->
<div class="chat-widget">
  <div class="chat-bubble" onclick="toggleChat()">
    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
  </div>
</div>
<div class="chat-window" id="chatWindow">
  <div class="chat-header">
    <div class="chat-header-left"><span class="chat-header-dot"></span> Chat Support</div>
    <button class="chat-close" onclick="toggleChat()">✕</button>
  </div>
  <div class="chat-messages" id="chatMessages">
    <div class="chat-login" id="chatLoginForm">
      <h4>Start Chat</h4>
      <p>Connect with support team</p>
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

${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>` : ''}
${MANUAL_VOICE ? `<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>` : ''}
<audio id="spotifyAudio" preload="auto"></audio>

<script src="/socket.io/socket.io.js"></script>
<script>
// ============ AUDIO MANAGEMENT ============
const welcomeAudio = document.getElementById('welcomeAudio');
const manualAudio = document.getElementById('manualAudio');
const spotifyAudio = document.getElementById('spotifyAudio');

function stopAllAudio() {
  if (welcomeAudio) { welcomeAudio.pause(); welcomeAudio.currentTime = 0; }
  if (manualAudio) { manualAudio.pause(); manualAudio.currentTime = 0; }
  if (spotifyAudio) { spotifyAudio.pause(); }
}

function playWelcomeVoice() {
  if (!welcomeAudio) return;
  stopAllAudio();
  spotifyPlaying = false;
  updateSpotifyPlayBtn();
  welcomeAudio.currentTime = 0;
  welcomeAudio.play().catch(e => console.log('Welcome audio play failed:', e));
}

function playManualVoice() {
  if (!manualAudio) return;
  stopAllAudio();
  spotifyPlaying = false;
  updateSpotifyPlayBtn();
  manualAudio.currentTime = 0;
  manualAudio.play().catch(e => console.log('Manual audio play failed:', e));
}

// ============ SPOTIFY STYLE MUSIC PLAYER ============
const spotifyTracks = ${JSON.stringify(songs)};
let spotifyCurrentTrack = 0;
let spotifyPlaying = false;

function updateSpotifyPlayBtn() {
  const btn = document.getElementById('spotifyPlayBtn');
  if (spotifyPlaying) {
    btn.textContent = '⏸';
    btn.classList.add('playing');
  } else {
    btn.textContent = '▶';
    btn.classList.remove('playing');
  }
}

function playSpotifyTrack(index) {
  stopAllAudio();
  spotifyCurrentTrack = index;
  spotifyAudio.src = spotifyTracks[index].url;
  spotifyAudio.load();
  spotifyAudio.play().then(() => {
    spotifyPlaying = true;
    updateSpotifyPlayBtn();
    updateSpotifyUI(index);
  }).catch(e => console.log('Spotify play failed:', e));
}

function updateSpotifyUI(index) {
  document.getElementById('spotifyTrackTitle').textContent = spotifyTracks[index].title;
  document.querySelectorAll('.spotify-song-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

function toggleSpotifyPlay() {
  if (spotifyAudio.paused) {
    stopAllAudio();
    if (!spotifyAudio.src) {
      spotifyAudio.src = spotifyTracks[spotifyCurrentTrack].url;
      spotifyAudio.load();
    }
    spotifyAudio.play().then(() => {
      spotifyPlaying = true;
      updateSpotifyPlayBtn();
      updateSpotifyUI(spotifyCurrentTrack);
    }).catch(e => console.log('Toggle play failed:', e));
  } else {
    spotifyAudio.pause();
    spotifyPlaying = false;
    updateSpotifyPlayBtn();
  }
}

function prevSpotifyTrack() {
  const index = (spotifyCurrentTrack - 1 + spotifyTracks.length) % spotifyTracks.length;
  playSpotifyTrack(index);
}

function nextSpotifyTrack() {
  const index = (spotifyCurrentTrack + 1) % spotifyTracks.length;
  playSpotifyTrack(index);
}

function seekSpotify(e) {
  if (!spotifyAudio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  spotifyAudio.currentTime = percent * spotifyAudio.duration;
}

spotifyAudio.addEventListener('timeupdate', () => {
  if (spotifyAudio.duration) {
    const percent = (spotifyAudio.currentTime / spotifyAudio.duration) * 100;
    document.getElementById('spotifyProgressFill').style.width = percent + '%';
    document.getElementById('spotifyCurrentTime').textContent = formatTime(spotifyAudio.currentTime);
    document.getElementById('spotifyDuration').textContent = formatTime(spotifyAudio.duration);
  }
});

spotifyAudio.addEventListener('loadedmetadata', () => {
  document.getElementById('spotifyDuration').textContent = formatTime(spotifyAudio.duration);
});

spotifyAudio.addEventListener('ended', nextSpotifyTrack);

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ':' + String(secs).padStart(2, '0');
}

// Auto play welcome voice on load
window.addEventListener('load', () => {
  if (welcomeAudio) {
    setTimeout(() => {
      welcomeAudio.play().catch(() => {});
    }, 1500);
  }
});

// ============ CHAT SYSTEM ============
const socket = io({ transports: ['websocket', 'polling'] });
let chatUser = null;

function toggleChat() {
  document.getElementById('chatWindow').classList.toggle('open');
}

function startChatSession() {
  const name = document.getElementById('chatNameInput').value.trim();
  const email = document.getElementById('chatEmailInput').value.trim();
  if (!name || !email) return;
  chatUser = { name, email };
  socket.emit('register', { name, email });
  document.getElementById('chatLoginForm').style.display = 'none';
  document.getElementById('chatInputArea').style.display = 'block';
  document.getElementById('chatMsgInput').focus();
  loadChatMessages();
}

async function loadChatMessages() {
  if (!chatUser) return;
  try {
    const res = await fetch('/api/msgs/' + chatUser.email);
    const msgs = await res.json();
    const container = document.getElementById('chatMessages');
    container.innerHTML = msgs.map(m => 
      '<div class="msg ' + (m.sender === chatUser.email ? 'user' : 'admin') + '">' +
      m.message + '<div class="time">' + new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div></div>'
    ).join('');
    container.scrollTop = container.scrollHeight;
  } catch(e) { console.log('Load messages failed:', e); }
}

function sendChatMsg() {
  const input = document.getElementById('chatMsgInput');
  const msg = input.value.trim();
  if (!msg || !chatUser) return;
  socket.emit('sendMsg', { sender: chatUser.email, receiver: 'admin@baillamaach.com', message: msg, type: 'text' });
  input.value = '';
  input.focus();
}

socket.on('newMsg', (msg) => {
  if (chatUser && (msg.sender === chatUser.email || msg.receiver === chatUser.email)) {
    const container = document.getElementById('chatMessages');
    container.insertAdjacentHTML('beforeend', 
      '<div class="msg ' + (msg.sender === chatUser.email ? 'user' : 'admin') + '">' +
      msg.message + '<div class="time">' + new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div></div>'
    );
    container.scrollTop = container.scrollHeight;
  }
});
</script>
</body>
</html>`);
});

// ============ API ROUTES ============
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
    const user = await User.findOne({ email, isAdmin: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: 'ok', message: 'Login successful' });
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============ ADMIN MESSENGER PANEL ============
app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Messenger | Baiilla Maach Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8f9fb;height:100vh;overflow:hidden;color:#1f2937}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
.login-card{background:#fff;padding:40px;border-radius:20px;width:380px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
.login-card .logo{width:60px;height:60px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#fff;font-size:1.5em;font-weight:700}
.login-card h2{font-family:'Syne',sans-serif;margin-bottom:6px;font-size:1.5em;color:#111827}
.login-card .subtitle{color:#9ca3af;font-size:0.9em;margin-bottom:24px}
.login-card .input-group{margin-bottom:14px;text-align:left}
.login-card .input-group label{display:block;font-size:0.8em;font-weight:600;color:#4b5563;margin-bottom:4px}
.login-card .input-group input{width:100%;padding:12px 16px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:0.95em;outline:none;font-family:'Inter',sans-serif}
.login-card .input-group input:focus{border-color:#f97316}
.login-card button{width:100%;padding:12px;background:#f97316;color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:1em;font-family:'Inter',sans-serif}
.login-card button:hover{background:#ea580c}
.login-error{color:#ef4444;font-size:0.85em;margin-top:10px;display:none}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff}
.sidebar{width:350px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
.sidebar-header h2{font-family:'Syne',sans-serif;font-size:1.1em;color:#111827}
.sidebar-header .logout-btn{background:#fee2e2;color:#ef4444;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.78em}
.sidebar-header .logout-btn:hover{background:#fecaca}
.search-bar{padding:10px 14px;border-bottom:1px solid #e5e7eb}
.search-bar input{width:100%;padding:9px 14px;border:1.5px solid #e5e7eb;border-radius:20px;font-size:0.85em;outline:none;background:#f9fafb;font-family:'Inter',sans-serif}
.search-bar input:focus{border-color:#f97316;background:#fff}
.user-list{flex:1;overflow-y:auto}
.user-list::-webkit-scrollbar{width:4px}
.user-list::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}
.user-item{padding:12px 18px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid #f3f4f6}
.user-item:hover{background:#f9fafb}
.user-item.active{background:#fff7ed;border-left:3px solid #f97316}
.user-avatar{width:40px;height:40px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:2px;right:2px;width:9px;height:9px;border-radius:50%;background:#10b981;border:2px solid #fff}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.85em;color:#111827}
.user-info .email{font-size:0.73em;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unread{background:#f97316;color:#fff;font-size:0.68em;padding:3px 7px;border-radius:10px;font-weight:700;flex-shrink:0}
.empty-state{text-align:center;padding:40px 20px;color:#9ca3af}
.chat-area{flex:1;display:flex;flex-direction:column;background:#f8f9fb}
.chat-header{padding:14px 20px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}
.chat-header .avatar{width:38px;height:38px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9em}
.chat-header .name{font-weight:600;font-size:0.9em;color:#111827}
.online-dot{width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block}
.offline-dot{width:7px;height:7px;border-radius:50%;background:#d1d5db;display:inline-block}
.chat-messages{flex:1;overflow-y:auto;padding:16px 20px}
.chat-messages::-webkit-scrollbar{width:4px}
.chat-messages::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}
.message{max-width:65%;padding:8px 14px;border-radius:16px;font-size:0.85em;line-height:1.4;word-wrap:break-word;margin-bottom:4px}
.message.sent{background:#f97316;color:#fff;margin-left:auto;border-bottom-right-radius:3px}
.message.received{background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:3px}
.message .time{font-size:0.65em;opacity:0.7;margin-top:3px;text-align:right}
.chat-input{padding:12px 18px;background:#fff;border-top:1px solid #e5e7eb;display:none}
.chat-input input{flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:20px;font-size:0.85em;outline:none;font-family:'Inter',sans-serif}
.chat-input input:focus{border-color:#f97316}
.chat-input button{background:#f97316;color:#fff;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1em;margin-left:8px}
@media(max-width:768px){.sidebar{width:100%}.login-card{width:90%;padding:30px}}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <div class="logo">BM</div>
    <h2>Admin Messenger</h2>
    <p class="subtitle">Baiilla Maach Support Panel</p>
    <div class="input-group"><label>Email</label><input type="email" id="loginEmail" placeholder="admin@baillamaach.com"></div>
    <div class="input-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter password"></div>
    <button id="loginBtn" onclick="Admin.login()">Sign In</button>
    <div class="login-error" id="loginError"></div>
  </div>
</div>
<div class="app" id="app">
  <div class="app-layout">
    <div class="sidebar">
      <div class="sidebar-header"><h2>💬 Conversations</h2><button class="logout-btn" onclick="Admin.logout()">Logout</button></div>
      <div class="search-bar"><input type="text" id="searchInput" placeholder="🔍 Search users..." oninput="Admin.filterUsers()"></div>
      <div class="user-list" id="userList"><div class="empty-state"><p>No conversations</p></div></div>
    </div>
    <div class="chat-area">
      <div class="chat-header"><div class="avatar" id="chatAvatar">?</div><div><div class="name" id="chatName">Select a user</div><div id="chatStatus"></div></div></div>
      <div class="chat-messages" id="chatMessages"><div class="empty-state"><p>Select a conversation</p></div></div>
      <div class="chat-input" id="chatInputArea"><div style="display:flex;align-items:center"><input type="text" id="msgInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')Admin.sendMessage()"><button onclick="Admin.sendMessage()">➤</button></div></div>
    </div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
const Admin = {
  socket: null, currentUser: null, users: [], messages: [], isLoggedIn: false,
  init() {
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.socket.on('newMsg', (msg) => {
      if (this.currentUser && ((msg.sender === this.currentUser.email && msg.receiver === 'admin@baillamaach.com') || (msg.sender === 'admin@baillamaach.com' && msg.receiver === this.currentUser.email))) {
        this.messages.push(msg); this.renderMessages();
      }
      this.loadUsers();
    });
    this.socket.on('userStatus', (data) => { this.updateUserStatus(data.email, data.online); });
    const saved = localStorage.getItem('adminSession');
    if (saved) { const s = JSON.parse(saved); document.getElementById('loginEmail').value = s.email; document.getElementById('loginPassword').value = s.password; this.login(true); }
  },
  async login(auto = false) {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errDiv = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    if (!email || !password) { errDiv.textContent = 'Fill all fields'; errDiv.style.display = 'block'; return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in...';
    try {
      const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
      const data = await res.json();
      if (res.ok) {
        this.isLoggedIn = true;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        localStorage.setItem('adminSession', JSON.stringify({email,password}));
        this.loadUsers();
      } else { errDiv.textContent = data.error; errDiv.style.display = 'block'; }
    } catch(e) { errDiv.textContent = 'Network error'; errDiv.style.display = 'block'; }
    btn.disabled = false; btn.innerHTML = 'Sign In';
  },
  async loadUsers() {
    if (!this.isLoggedIn) return;
    try {
      const res = await fetch('/api/admin/users');
      this.users = await res.json();
      this.renderUserList();
    } catch(e) {}
  },
  async selectUser(user) {
    this.currentUser = user;
    document.getElementById('chatAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('chatName').textContent = user.name;
    document.getElementById('chatStatus').innerHTML = user.isOnline ? '<span class="online-dot"></span> Online' : '<span class="offline-dot"></span> Offline';
    document.getElementById('chatInputArea').style.display = 'block';
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.querySelector('.user-item[data-email="'+user.email+'"]')?.classList.add('active');
    await this.loadMessages();
    this.socket.emit('markRead', { user: user.email });
  },
  async loadMessages() {
    if (!this.currentUser) return;
    try {
      const res = await fetch('/api/msgs/' + this.currentUser.email);
      const all = await res.json();
      this.messages = all.filter(m => (m.sender === this.currentUser.email && m.receiver === 'admin@baillamaach.com') || (m.sender === 'admin@baillamaach.com' && m.receiver === this.currentUser.email));
      this.renderMessages();
    } catch(e) {}
  },
  renderMessages() {
    const c = document.getElementById('chatMessages');
    if (this.messages.length === 0) { c.innerHTML = '<div class="empty-state"><p>No messages</p></div>'; return; }
    c.innerHTML = this.messages.map(m => {
      const sent = m.sender === 'admin@baillamaach.com';
      const time = new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      return '<div class="message '+(sent?'sent':'received')+'">'+m.message+'<div class="time">'+time+'</div></div>';
    }).join('');
    c.scrollTop = c.scrollHeight;
  },
  async sendMessage() {
    const input = document.getElementById('msgInput');
    const msg = input.value.trim();
    if (!msg || !this.currentUser) return;
    this.socket.emit('sendMsg', { sender:'admin@baillamaach.com', receiver:this.currentUser.email, message:msg, type:'text' });
    this.messages.push({ sender:'admin@baillamaach.com', receiver:this.currentUser.email, message:msg, type:'text', timestamp:new Date() });
    this.renderMessages();
    input.value = ''; input.focus();
    setTimeout(() => this.loadUsers(), 500);
  },
  updateUserStatus(email, online) {
    const el = document.querySelector('.user-item[data-email="'+email+'"] .dot');
    if (el) el.style.background = online ? '#10b981' : '#d1d5db';
    if (this.currentUser?.email === email) {
      document.getElementById('chatStatus').innerHTML = online ? '<span class="online-dot"></span> Online' : '<span class="offline-dot"></span> Offline';
    }
  },
  renderUserList() {
    const c = document.getElementById('userList');
    const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const filtered = this.users.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    if (filtered.length === 0) { c.innerHTML = '<div class="empty-state"><p>No users found</p></div>'; return; }
    c.innerHTML = filtered.map(u => {
      const active = this.currentUser?.email === u.email;
      return '<div class="user-item'+(active?' active':'')+'" data-email="'+u.email+'" onclick="Admin.selectUserById(\''+u.email+'\')">' +
        '<div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'<div class="dot" style="background:'+(u.isOnline?'#10b981':'#d1d5db')+'"></div></div>' +
        '<div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>' +
        (u.unreadCount > 0 ? '<div class="unread">'+u.unreadCount+'</div>' : '') +
        '</div>';
    }).join('');
  },
  selectUserById(email) { const u = this.users.find(u => u.email === email); if (u) this.selectUser(u); },
  filterUsers() { this.renderUserList(); },
  logout() { localStorage.removeItem('adminSession'); location.reload(); }
};
document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
  document.getElementById('loginPassword').addEventListener('keypress', e => { if (e.key === 'Enter') Admin.login(); });
});
setInterval(() => { if (Admin.isLoggedIn) Admin.loadUsers(); }, 30000);
</script>
</body>
</html>`);
});

// ============ SOCKET.IO ============
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
    } catch (err) { console.error('Send msg error:', err.message); }
  });

  socket.on('markRead', async (data) => {
    try {
      await Message.updateMany(
        { sender: data.user, receiver: 'admin@baillamaach.com', seen: false },
        { $set: { seen: true } }
      );
    } catch (err) { console.error('Mark read error:', err.message); }
  });

  socket.on('disconnect', async () => {
    if (socket.userData) {
      try {
        await User.updateOne({ email: socket.userData.email }, { $set: { isOnline: false, lastSeen: new Date() } });
        io.emit('userStatus', { email: socket.userData.email, online: false });
      } catch (err) { console.error('Disconnect error:', err.message); }
    }
  });
});

server.listen(PORT, () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
  console.log('📧 Admin panel: http://localhost:' + PORT + '/messenger');
  console.log('📧 Admin Email: admin@baillamaach.com');
  console.log('🔑 Admin Password: Admin@2024!');
});

require('dotenv').config();
process.on('uncaughtException', (e) => { 
    console.error('❌ Uncaught Exception:', e.message);
    console.error('📍 Stack:', e.stack);
});
process.on('unhandledRejection', (e) => { 
    console.error('❌ Unhandled Rejection:', e);
    console.error('📍 Stack:', e.stack);
});

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/assets', express.static('assets', { maxAge: '30d' }));
app.use('/uploads', express.static('uploads', { maxAge: '7d' }));

// Create required directories
const dirs = ['uploads', 'uploads/images', 'uploads/audio', 'assets/covermusic'];
dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = 'uploads/';
        if (file.mimetype.startsWith('image/')) dest = 'uploads/images/';
        else if (file.mimetype.startsWith('audio/')) dest = 'uploads/audio/';
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Database Models
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true, index: true },
    receiver: { type: String, required: true, index: true },
    message: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'audio', 'file'], default: 'text' },
    fileUrl: { type: String, default: null },
    seen: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ MongoDB connected successfully');
    const admin = await User.findOne({ email: 'admin' });
    if (!admin) {
        await User.create({
            name: 'Baiilla Maach',
            email: 'admin',
            password: await bcrypt.hash('admin123', 12),
            isAdmin: true
        });
        console.log('👑 Admin account created (Email: admin, Password: admin123)');
    }
}).catch(e => {
    console.error('❌ MongoDB connection error:', e.message);
    process.exit(1);
});

// Assets
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

// Get songs function
function getSongs() {
    try {
        const dir = 'assets/covermusic';
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir).filter(f => f.endsWith('.mp3')).map((f, i) => ({
            id: i,
            title: f.replace('.mp3', '').replace(/[-_]/g, ' '),
            url: '/assets/covermusic/' + encodeURIComponent(f)
        }));
    } catch (e) { return []; }
}

// ============================================
// MAIN WEBSITE ROUTE
// ============================================
app.get('/', (req, res) => {
    const songs = getSongs();
    
    let musicHTML = '';
    if (songs.length > 0) {
        musicHTML = `
    <section class="section bg-gray">
      <div class="container">
        <div class="section-label">🎵 MUSIC</div>
        <h2 class="section-heading">Cover Songs Collection</h2>
        <p class="section-desc">Official covers by Hammad Bin Amir</p>
        <div class="music-player">
          <div class="music-cover">
            <img src="${ASSETS.microphone}" alt="Music" onerror="this.src='${ASSETS.profile}'">
          </div>
          <div class="music-info">
            <h4 id="trackTitle">Select a Song</h4>
            <p id="trackArtist">Baiilla Maach</p>
            <div class="music-ctrls">
              <button onclick="prevTrack()">⏮</button>
              <button id="playBtn" onclick="togglePlay()" class="btn-play">▶️</button>
              <button onclick="nextTrack()">⏭</button>
            </div>
            <div class="music-bar" onclick="seekTrack(event)"><div id="progressBar" class="music-bar-fill"></div></div>
            <div class="music-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></div>
          </div>
        </div>
        <div class="music-list">
          ${songs.map((s, i) => `<div onclick="playTrack(${i})" class="music-item"><span>${String(i + 1).padStart(2, '0')}</span>${s.title}</div>`).join('')}
        </div>
      </div>
    </section>`;
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<title>Baiilla Maach — Official Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
:root{
  --white:#ffffff;
  --bg:#f8f9fb;
  --gray50:#f9fafb;
  --gray100:#f3f4f6;
  --gray200:#e5e7eb;
  --gray300:#d1d5db;
  --gray400:#9ca3af;
  --gray500:#6b7280;
  --gray600:#4b5563;
  --gray700:#374151;
  --gray800:#1f2937;
  --gray900:#111827;
  --orange:#f97316;
  --orange-dark:#ea580c;
  --orange-light:#fff7ed;
  --green:#10b981;
  --green-dark:#059669;
  --green-light:#ecfdf5;
  --red:#ef4444;
  --red-dark:#dc2626;
  --red-light:#fef2f2;
  --blue:#3b82f6;
  --blue-dark:#2563eb;
  --blue-light:#eff6ff;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.05);
  --shadow:0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:0 4px 6px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg:0 10px 15px rgba(0,0,0,0.1),0 4px 6px rgba(0,0,0,0.05);
  --shadow-xl:0 20px 25px rgba(0,0,0,0.1),0 10px 10px rgba(0,0,0,0.04);
  --radius:16px;
  --radius-sm:10px;
  --radius-lg:24px;
  --radius-full:9999px;
}

*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--white);color:var(--gray800);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;height:auto;display:block}
a{text-decoration:none;color:inherit}
button{cursor:pointer;border:none;outline:none;font-family:inherit}
input{font-family:inherit;outline:none}

/* Nav */
.nav{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--gray200);padding:0 24px;box-shadow:var(--shadow-sm)}
.nav-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;height:64px}
.nav-brand{display:flex;align-items:center;gap:10px;transition:0.3s}
.nav-brand:hover{opacity:0.8}
.nav-brand img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--orange)}
.nav-brand span{font-family:'Outfit',sans-serif;font-weight:700;font-size:1.15em;color:var(--gray900);letter-spacing:-0.3px}
.nav-links{display:flex;align-items:center;gap:10px}
.nav-chat,.nav-admin{display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:var(--radius-full);font-weight:600;font-size:0.85em;transition:0.3s;color:var(--white)}
.nav-chat{background:var(--green)}
.nav-chat:hover{background:var(--green-dark);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.nav-admin{background:var(--orange)}
.nav-admin:hover{background:var(--orange-dark);transform:translateY(-2px);box-shadow:var(--shadow-md)}

/* Hero */
.hero{padding:80px 24px 60px;text-align:center;max-width:700px;margin:0 auto;animation:fadeInUp 0.8s ease}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
.hero-avatar{position:relative;display:inline-block;margin-bottom:20px}
.hero-avatar img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--orange);box-shadow:0 0 0 8px var(--orange-light);transition:0.3s}
.hero-avatar:hover img{transform:scale(1.05)}
.hero-avatar .verified-icon{position:absolute;bottom:8px;right:8px;background:var(--green);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid var(--white);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.hero-avatar .verified-icon svg{width:14px;height:14px;fill:var(--white)}
.hero h1{font-family:'Outfit',sans-serif;font-size:2.5em;font-weight:800;color:var(--gray900);letter-spacing:-1px;margin-bottom:4px;background:linear-gradient(135deg,var(--orange),#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero .username{font-family:'DM Sans',sans-serif;font-size:1.05em;color:var(--gray500);margin-bottom:4px}
.hero .bio{color:var(--gray400);font-size:0.95em;margin-bottom:20px}
.hero-stats{display:flex;justify-content:center;gap:32px;margin:20px 0}
.hero-stat{text-align:center}
.hero-stat .num{font-family:'Outfit',sans-serif;font-size:1.6em;font-weight:700;color:var(--gray900)}
.hero-stat .label{font-size:0.78em;color:var(--gray400);text-transform:uppercase;letter-spacing:1.5px;margin-top:2px}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--green-light);color:var(--green);padding:6px 16px;border-radius:var(--radius-full);font-weight:600;font-size:0.8em;margin-bottom:18px}
.hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}
.hero-btn{padding:12px 24px;border-radius:var(--radius-full);font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:8px;transition:0.3s}
.hero-btn img{width:20px;height:20px}
.hero-btn.tiktok{background:#000;color:#fff}
.hero-btn.tiktok:hover{background:#111;transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.hero-btn.facebook{background:var(--blue);color:#fff}
.hero-btn.facebook:hover{background:var(--blue-dark);transform:translateY(-2px);box-shadow:var(--shadow-lg)}

/* Sections */
.section{padding:80px 24px}
.section.bg-gray{background:var(--gray50)}
.section.bg-green{background:var(--green-light)}
.section.bg-red{background:var(--red-light)}
.container{max-width:1050px;margin:0 auto}
.section-label{display:inline-block;font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:var(--orange);margin-bottom:12px;background:var(--orange-light);padding:4px 12px;border-radius:var(--radius-full)}
.section-heading{font-family:'Outfit',sans-serif;font-size:2em;font-weight:700;color:var(--gray900);text-align:center;letter-spacing:-0.5px;margin-bottom:6px}
.section-desc{text-align:center;color:var(--gray500);margin-bottom:40px;font-size:0.95em}

/* Verified Cards */
.verified-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.verified-card{background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);padding:28px;transition:0.3s;position:relative;overflow:hidden}
.verified-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--green),var(--blue));transform:scaleX(0);transition:0.3s}
.verified-card:hover::before{transform:scaleX(1)}
.verified-card:hover{border-color:var(--green);box-shadow:var(--shadow-lg);transform:translateY(-4px)}
.verified-card .card-top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.verified-card .card-top .pfp{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--orange)}
.verified-card .card-top .info h3{font-family:'Outfit',sans-serif;font-size:1.1em;font-weight:600;display:flex;align-items:center;gap:5px;color:var(--gray900)}
.verified-card .card-top .info h3 img{width:18px;height:18px}
.verified-card .card-top .info .handle{color:var(--gray500);font-size:0.85em;font-family:'DM Sans',sans-serif}
.verified-card .card-body .row{display:flex;align-items:center;gap:6px;padding:6px 0;color:var(--gray600);font-size:0.88em}
.verified-card .card-body .row strong{color:var(--gray800);font-weight:600}
.verified-card .card-body .follow-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:var(--radius-full);font-weight:600;font-size:0.85em;margin-top:12px;transition:0.3s}
.verified-card .card-body .follow-btn img{width:18px;height:18px}
.verified-card .card-body .follow-btn.tiktok-btn{background:#000;color:#fff}
.verified-card .card-body .follow-btn.tiktok-btn:hover{background:#111;transform:translateY(-2px)}
.verified-card .card-body .follow-btn.fb-btn{background:var(--blue);color:#fff}
.verified-card .card-body .follow-btn.fb-btn:hover{background:var(--blue-dark);transform:translateY(-2px)}

/* Fake Cards */
.fake-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.fake-card{background:var(--white);border:2px solid #fecaca;border-radius:var(--radius);overflow:hidden;transition:0.3s}
.fake-card:hover{box-shadow:var(--shadow-xl);border-color:var(--red);transform:translateY(-4px)}
.fake-img-container{position:relative;text-align:center;background:#fafafa;padding:20px;overflow:hidden}
.fake-img{max-width:100%;height:auto;margin:0 auto;border-radius:8px}
.fake-detect{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100px;height:100px;animation:updown 2s infinite ease-in-out;z-index:10;opacity:0.9}
@keyframes updown{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-20px)}}
.fake-card .fake-info{padding:24px}
.fake-card .fake-info h3{font-family:'Outfit',sans-serif;font-size:1.2em;font-weight:600;color:var(--gray900);margin-bottom:4px}
.fake-card .fake-info .plat{color:var(--orange);font-weight:600;font-size:0.85em;margin-bottom:8px}
.fake-card .fake-info p{color:var(--gray500);font-size:0.9em;margin-bottom:16px;line-height:1.6}
.fake-card .fake-info .report-btn{display:inline-flex;align-items:center;gap:6px;background:var(--red);color:#fff;padding:8px 18px;border-radius:var(--radius-full);font-weight:600;font-size:0.85em;transition:0.3s}
.fake-card .fake-info .report-btn:hover{background:var(--red-dark);transform:translateY(-2px);box-shadow:0 4px 12px rgba(239,68,68,0.3)}
.fake-card .fake-info .report-btn img{width:16px;height:16px}

/* Voice */
.voice-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px}
.voice-btn{padding:14px 28px;border-radius:var(--radius-full);font-weight:600;font-size:0.95em;display:flex;align-items:center;gap:8px;transition:0.3s}
.voice-btn.welcome{background:var(--orange);color:#fff}
.voice-btn.welcome:hover{background:var(--orange-dark);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.voice-btn.manual{background:#fff;color:var(--red);border:2px solid var(--red)}
.voice-btn.manual:hover{background:var(--red);color:#fff;transform:translateY(-2px)}

/* Proof */
.proof-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}
.proof-card{background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius-sm);padding:24px;text-align:center;transition:0.3s}
.proof-card:hover{border-color:var(--orange);box-shadow:var(--shadow-md);transform:translateY(-4px)}
.proof-card img{width:100%;height:auto;border-radius:8px;margin-bottom:12px}
.proof-card p{font-weight:600;font-size:0.88em;color:var(--gray700)}

/* Music */
.music-player{max-width:600px;margin:0 auto;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius);padding:32px;display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.music-cover img{width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--orange);box-shadow:0 0 20px rgba(249,115,22,0.2)}
.music-info{flex:1;text-align:center;min-width:200px}
.music-info h4{font-family:'Outfit',sans-serif;font-size:1.1em;font-weight:600;color:var(--gray900);margin-bottom:4px}
.music-info p{color:var(--orange);font-weight:600;font-size:0.88em;margin-bottom:12px}
.music-ctrls{display:flex;justify-content:center;gap:12px;margin-bottom:10px}
.music-ctrls button{background:var(--gray100);border:1px solid var(--gray200);width:40px;height:40px;border-radius:50%;font-size:1em;transition:0.3s;color:var(--gray700)}
.music-ctrls button:hover{background:var(--orange-light);border-color:var(--orange)}
.music-ctrls .btn-play{background:var(--orange);color:#fff;border:none;width:52px;height:52px;font-size:1.2em}
.music-ctrls .btn-play:hover{background:var(--orange-dark);transform:scale(1.05)}
.music-bar{background:var(--gray200);height:5px;border-radius:3px;cursor:pointer;margin:8px 0}
.music-bar-fill{background:var(--orange);height:100%;border-radius:3px;width:0%;transition:width 0.1s}
.music-time{font-size:0.8em;color:var(--gray500);font-family:'DM Sans',sans-serif}
.music-list{margin-top:12px;background:var(--white);border:1px solid var(--gray200);border-radius:var(--radius-sm);max-height:260px;overflow-y:auto}
.music-item{padding:12px 20px;cursor:pointer;border-bottom:1px solid var(--gray100);display:flex;gap:10px;font-size:0.88em;transition:0.15s;color:var(--gray700)}
.music-item:hover{background:var(--orange-light)}
.music-item.active{background:var(--orange-light);border-left:4px solid var(--orange);font-weight:600}
.music-item span{font-weight:700;color:var(--orange);min-width:28px}

/* Footer */
.footer{background:var(--gray900);color:#fff;padding:60px 24px 40px;text-align:center}
.footer-grid{max-width:1000px;margin:0 auto 40px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:40px;text-align:left}
.footer h4{font-family:'Outfit',sans-serif;color:var(--orange);margin-bottom:12px;font-size:1em}
.footer p,.footer a{color:var(--gray400);font-size:0.85em;line-height:2;transition:0.2s}
.footer a:hover{color:#fff}
.footer-bottom{padding-top:24px;border-top:1px solid var(--gray700);font-size:0.8em;color:var(--gray500)}

/* Chat Widget */
.chat-widget{position:fixed;bottom:28px;right:28px;z-index:999}
.chat-bubble{width:60px;height:60px;border-radius:50%;cursor:pointer;box-shadow:0 4px 20px rgba(16,185,129,0.4);transition:0.3s;animation:softBounce 3s infinite}
.chat-bubble:hover{transform:scale(1.1)}
.chat-bubble img{width:100%;height:100%;border-radius:50%}
@keyframes softBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.chat-box{display:none;position:fixed;bottom:100px;right:28px;width:380px;height:500px;background:#fff;border:1px solid var(--gray200);border-radius:var(--radius);flex-direction:column;overflow:hidden;z-index:999;box-shadow:var(--shadow-xl)}
.chat-box.open{display:flex}
.chat-box .head{background:var(--green);color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;font-family:'Outfit',sans-serif;font-weight:600;font-size:0.95em}
.chat-box .head button{background:none;border:none;color:#fff;font-size:1.3em;cursor:pointer}
.chat-box .body{flex:1;overflow-y:auto;padding:16px;background:var(--gray50)}
.chat-box .login-form{padding:28px;text-align:center}
.chat-box .login-form h4{font-family:'Outfit',sans-serif;margin-bottom:16px;font-size:1.2em;color:var(--gray800)}
.chat-box .login-form input{width:100%;padding:12px 16px;margin-bottom:10px;border:1px solid var(--gray200);border-radius:8px;font-size:0.9em;transition:0.2s}
.chat-box .login-form input:focus{border-color:var(--orange)}
.chat-box .login-form button{width:100%;padding:12px;background:var(--orange);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.95em;transition:0.2s}
.chat-box .login-form button:hover{background:var(--orange-dark)}
.chat-box .input-row{padding:14px 16px;background:#fff;border-top:1px solid var(--gray200);display:none;gap:8px}
.chat-box .input-row input{flex:1;padding:12px 16px;border:1px solid var(--gray200);border-radius:20px;font-size:0.9em}
.chat-box .input-row button{background:var(--orange);color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:1.1em;transition:0.2s}
.chat-box .input-row button:hover{background:var(--orange-dark)}
.msg{max-width:80%;padding:10px 14px;border-radius:16px;margin-bottom:6px;font-size:0.88em;word-wrap:break-word;line-height:1.5}
.msg.user{background:var(--orange);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.admin{background:#fff;color:var(--gray800);border:1px solid var(--gray200);border-bottom-left-radius:4px}
.msg .time{font-size:0.7em;opacity:0.7;margin-top:4px;text-align:right}

@media(max-width:768px){
  .hero h1{font-size:2em}
  .verified-grid,.fake-grid{grid-template-columns:1fr}
  .proof-grid{grid-template-columns:1fr}
  .music-player{flex-direction:column;text-align:center}
  .chat-box{width:100%;height:100%;bottom:0;right:0;border-radius:0}
  .nav-links{gap:6px}
  .nav-chat,.nav-admin{padding:6px 12px;font-size:0.75em}
}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <img src="${ASSETS.profile}" alt="Logo" onerror="this.style.display='none'">
      <span>Baiilla Maach</span>
    </a>
    <div class="nav-links">
      <a href="/messenger" class="nav-admin">⚡ Admin Panel</a>
      <a href="#" class="nav-chat" onclick="openChat();return false;">💬 Chat Support</a>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="hero-avatar">
    <img src="${ASSETS.profile}" alt="Baiilla Maach" onerror="this.style.display='none'">
    <div class="verified-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
  </div>
  <h1>Hammad Bin Amir</h1>
  <p class="username">@baiillamaach_official</p>
  <p class="bio">Official Entertainment Profile · Verified Creator · Content Producer</p>
  <div class="hero-stats">
    <div class="hero-stat"><div class="num">7.2K</div><div class="label">Followers</div></div>
    <div class="hero-stat"><div class="num">0</div><div class="label">Following</div></div>
    <div class="hero-stat"><div class="num">195K</div><div class="label">Likes</div></div>
  </div>
  <div class="hero-badge">✓ Verified Official Account - Authentic Creator</div>
  <div class="hero-btns">
    <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="hero-btn tiktok">
      <img src="${ASSETS.logoTikTok}" alt="TikTok"> Follow on TikTok
    </a>
    <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="hero-btn facebook">
      <img src="${ASSETS.logoFB}" alt="Facebook"> Follow on Facebook
    </a>
  </div>
</section>

<section class="section bg-green">
  <div class="container">
    <div class="section-label">✅ OFFICIAL</div>
    <h2 class="section-heading">Verified Social Media Accounts</h2>
    <p class="section-desc">The only authentic Baiilla Maach accounts across all platforms</p>
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
          <div class="row">👥 Followers: <strong>7,200+</strong></div>
          <div class="row">❤️ Likes: <strong>195,000+</strong></div>
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
          <div class="row">📘 Page: <strong>Official Facebook Page</strong></div>
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">
            <img src="${ASSETS.logoFB}" alt="Facebook"> Follow on Facebook
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section bg-red">
  <div class="container">
    <div class="section-label" style="color:var(--red);background:var(--red-light)">⚠️ WARNING</div>
    <h2 class="section-heading">Fake Accounts Detected</h2>
    <p class="section-desc">Beware of these impersonating accounts. Report them immediately to protect the community.</p>
    <div class="fake-grid">
      <div class="fake-card">
        <div class="fake-img-container">
          <img src="${ASSETS.baillamachFake}" class="fake-img" alt="Fake Account" onerror="this.style.display='none'">
          <img src="${ASSETS.fakeDetect}" class="fake-detect" alt="FAKE" onerror="this.style.display='none'">
        </div>
        <div class="fake-info">
          <h3>@baiilla_mach</h3>
          <p class="plat">📍 TikTok Fake Account</p>
          <p>This account copies official logo and content to deceive followers. Uses similar name to confuse fans and steal content without permission.</p>
          <a href="https://tiktok.com/@baiilla_mach" target="_blank" class="report-btn">
            <img src="${ASSETS.reportBtn}" alt=""> Report This Account
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
          <p class="plat">📍 TikTok Fake Account</p>
          <p>Uses official name and photo to mislead followers. Impersonating with fake content and spreading misleading information to the audience.</p>
          <a href="https://tiktok.com/@hammad_fams0" target="_blank" class="report-btn">
            <img src="${ASSETS.reportBtn}" alt=""> Report This Account
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section bg-gray">
  <div class="container">
    <div class="section-label">📋 PROOF</div>
    <h2 class="section-heading">Identity Verification Evidence</h2>
    <p class="section-desc">Official documentation confirming the authenticity of Baiilla Maach</p>
    <div class="proof-grid">
      <div class="proof-card">
        <img src="${ASSETS.realId}" alt="Real ID" onerror="this.style.display='none'">
        <p>Real ID Verified ✓</p>
      </div>
      <div class="proof-card">
        <img src="${ASSETS.fakeDetect}" alt="Fake Detection" onerror="this.style.display='none'">
        <p>Fake Account Detection System</p>
      </div>
      <div class="proof-card">
        <img src="${ASSETS.microphone}" alt="Voice Note" onerror="this.style.display='none'">
        <p>Real Voice Recording Verified</p>
      </div>
    </div>
  </div>
</section>

${WELCOME_VOICE || MANUAL_VOICE ? `
<section class="section">
  <div class="container" style="text-align:center">
    <div class="section-label">🎤 VOICE</div>
    <h2 class="section-heading">Voice Verification System</h2>
    <p class="section-desc">Listen to authentic Baiilla Maach voice recordings for verification</p>
    <div class="voice-btns">
      ${WELCOME_VOICE ? `<button class="voice-btn welcome" onclick="playWelcome()">🎤 Play Real Voice Recording</button>` : ''}
      ${MANUAL_VOICE ? `<button class="voice-btn manual" onclick="playManual()">⚠️ Fake Voice Alert Sample</button>` : ''}
    </div>
  </div>
</section>` : ''}

${musicHTML}

<footer class="footer">
  <div class="footer-grid">
    <div>
      <h4>About Baiilla Maach</h4>
      <p>Official verification hub for Hammad Bin Amir (Baiilla Maach). Dedicated to protecting fans from fake accounts and providing authentic content to the community.</p>
    </div>
    <div>
      <h4>Official Links</h4>
      <p><a href="https://tiktok.com/@baiillamaach_official">TikTok Profile</a></p>
      <p><a href="https://www.facebook.com/profile.php?id=61575202118828">Facebook Page</a></p>
      <p><a href="/messenger">Admin Messenger Panel</a></p>
    </div>
    <div>
      <h4>Contact & Support</h4>
      <p>Use the chat button for quick support</p>
      <p>Report fake accounts immediately</p>
      <p>Stay safe from impersonators</p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© 2024 Baiilla Maach - Hammad Bin Amir. All rights reserved. | Official Verification Hub | Protecting Fans Since 2024</p>
  </div>
</footer>

<div class="chat-widget">
  <div class="chat-bubble" onclick="openChat()">
    <img src="${ASSETS.messageBubble}" alt="Chat">
  </div>
</div>

<div class="chat-box" id="chatBox">
  <div class="head">💬 Chat Support <button onclick="closeChat()">✕</button></div>
  <div class="body" id="chatBody">
    <div class="login-form" id="chatLogin">
      <h4>Start Conversation</h4>
      <p style="color:var(--gray500);font-size:0.85em;margin-bottom:16px">Fill in your details to start chatting with our support team</p>
      <input type="text" id="chatName" placeholder="Your Full Name">
      <input type="text" id="chatEmail" placeholder="Email or Phone Number">
      <button onclick="startChat()">Start Chatting Now</button>
    </div>
  </div>
  <div class="input-row" id="chatInput" style="display:flex;">
    <input type="text" id="chatMsg" placeholder="Type your message here..." onkeypress="if(event.key==='Enter')sendMsg()">
    <button onclick="sendMsg()">➤</button>
  </div>
</div>

${WELCOME_VOICE ? `<audio id="welcomeAudio" src="/assets/realvoice.mp3" preload="auto"></audio>` : ''}
${MANUAL_VOICE ? `<audio id="manualAudio" src="/assets/manualvoice_alert.mp3" preload="auto"></audio>` : ''}

<script src="/socket.io/socket.io.js"></script>
<script>
// ============================================
// VOICE FUNCTIONS
// ============================================
window.addEventListener('load', () => {
    const welcomeAudio = document.getElementById('welcomeAudio');
    if (welcomeAudio) {
        setTimeout(() => {
            welcomeAudio.play().catch(() => {});
        }, 1500);
    }
});

function playWelcome() {
    const audio = document.getElementById('welcomeAudio');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

function playManual() {
    const audio = document.getElementById('manualAudio');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

// ============================================
// MUSIC PLAYER FUNCTIONS
// ============================================
const tracks = ${JSON.stringify(songs)};
let currentTrackIndex = 0;
let isPlaying = false;
const audio = new Audio();

if (tracks.length > 0) {
    audio.src = tracks[0].url;
    audio.load();
}

function playTrack(index) {
    currentTrackIndex = index;
    audio.src = tracks[index].url;
    audio.load();
    audio.play().catch(() => {});
    isPlaying = true;
    updatePlayButton();
    document.getElementById('trackTitle').textContent = tracks[index].title;
    document.querySelectorAll('.music-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
}

function togglePlay() {
    if (audio.paused) {
        audio.play().catch(() => {});
        isPlaying = true;
    } else {
        audio.pause();
        isPlaying = false;
    }
    updatePlayButton();
}

function updatePlayButton() {
    document.getElementById('playBtn').textContent = isPlaying ? '⏸️' : '▶️';
}

function prevTrack() {
    playTrack((currentTrackIndex - 1 + tracks.length) % tracks.length);
}

function nextTrack() {
    playTrack((currentTrackIndex + 1) % tracks.length);
}

audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100 || 0;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
    document.getElementById('duration').textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', nextTrack);

audio.addEventListener('loadedmetadata', () => {
    document.getElementById('duration').textContent = formatTime(audio.duration);
});

function seekTrack(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + String(secs).padStart(2, '0');
}

// ============================================
// CHAT FUNCTIONS
// ============================================
const socket = io();
let currentUser = null;

function openChat() {
    document.getElementById('chatBox').classList.add('open');
}

function closeChat() {
    document.getElementById('chatBox').classList.remove('open');
}

function startChat() {
    const name = document.getElementById('chatName').value.trim();
    const email = document.getElementById('chatEmail').value.trim();
    
    if (!name || !email) {
        alert('Please fill in all fields to start chatting.');
        return;
    }
    
    currentUser = { name, email };
    socket.emit('register', { name, email });
    
    document.getElementById('chatLogin').style.display = 'none';
    document.getElementById('chatInput').style.display = 'flex';
    loadMessages();
}

async function loadMessages() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/msgs/' + currentUser.email);
        const messages = await response.json();
        const body = document.getElementById('chatBody');
        
        body.innerHTML = messages.map(msg => 
            '<div class="msg ' + (msg.sender === currentUser.email ? 'user' : 'admin') + '">' +
            (msg.type === 'image' ? '<img src="' + msg.fileUrl + '" style="max-width:120px;border-radius:8px">' : msg.message) +
            '<div class="time">' + new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>' +
            '</div>'
        ).join('');
        
        body.scrollTop = body.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function sendMsg() {
    const input = document.getElementById('chatMsg');
    const message = input.value.trim();
    
    if (!message || !currentUser) return;
    
    socket.emit('sendMsg', {
        sender: currentUser.email,
        receiver: 'admin',
        message: message,
        type: 'text'
    });
    
    input.value = '';
}

socket.on('newMsg', (msg) => {
    if (currentUser && (msg.sender === currentUser.email || msg.receiver === currentUser.email)) {
        const body = document.getElementById('chatBody');
        body.insertAdjacentHTML('beforeend',
            '<div class="msg ' + (msg.sender === currentUser.email ? 'user' : 'admin') + '">' +
            (msg.type === 'image' ? '<img src="' + msg.fileUrl + '" style="max-width:120px;border-radius:8px">' : msg.message) +
            '<div class="time">' + new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>' +
            '</div>'
        );
        body.scrollTop = body.scrollHeight;
    }
});
</script>
</body>
</html>`);
});

// ============================================
// API ROUTES
// ============================================
app.get('/api/msgs/:email', async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.params.email },
                { receiver: req.params.email }
            ]
        }).sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find({ isAdmin: false })
            .sort({ lastSeen: -1 })
            .lean();
        
        for (let user of users) {
            user.unreadCount = await Message.countDocuments({
                sender: user.email,
                receiver: 'admin',
                seen: false
            });
        }
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ADMIN MESSENGER ROUTE (NO LOGIN REQUIRED)
// ============================================
app.get('/messenger', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Messenger | Baiilla Maach</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8f9fb;height:100vh;overflow:hidden;color:#1f2937}

.app{height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#fff;box-shadow:0 0 40px rgba(0,0,0,0.1)}

/* Sidebar */
.sidebar{width:350px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fff}
.sidebar-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;background:#fff}
.sidebar-header h2{font-family:'Outfit',sans-serif;font-size:1.3em;display:flex;align-items:center;gap:8px;color:#1f2937}
.sidebar-header .header-btns{display:flex;gap:8px}
.sidebar-header button{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82em;transition:0.2s}
.btn-home{background:#f3f4f6;color:#374151}
.btn-home:hover{background:#e5e7eb}
.btn-refresh{background:#dbeafe;color:#2563eb}
.btn-refresh:hover{background:#bfdbfe}

.search-bar{padding:16px 20px}
.search-bar input{width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:12px;font-size:0.9em;outline:none;background:#f9fafb;transition:0.2s}
.search-bar input:focus{border-color:#f97316;background:#fff}

.user-list{flex:1;overflow-y:auto}
.user-list::-webkit-scrollbar{width:6px}
.user-list::-webkit-scrollbar-track{background:#f9fafb}
.user-list::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}

.user-item{padding:16px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:0.15s;border-bottom:1px solid #f3f4f6}
.user-item:hover{background:#f9fafb}
.user-item.active{background:#fff7ed;border-left:4px solid #f97316}
.user-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ef4444);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.2em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:3px;right:3px;width:12px;height:12px;border-radius:50%;background:#10b981;border:2px solid #fff}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.95em;margin-bottom:3px;color:#1f2937}
.user-info .email{font-size:0.8em;color:#9ca3af}
.user-info .last-seen{font-size:0.72em;color:#d1d5db;margin-top:2px}
.unread{background:#f97316;color:#fff;font-size:0.72em;padding:3px 9px;border-radius:12px;font-weight:700;min-width:24px;text-align:center}

/* Chat Area */
.chat-area{flex:1;display:flex;flex-direction:column;background:#f8f9fb}
.chat-header{padding:20px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:14px}
.chat-header .avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ef4444);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1em}
.chat-header .user-details .name{font-weight:600;font-size:1em;color:#1f2937}
.chat-header .user-details .status{font-size:0.82em;color:#10b981;display:flex;align-items:center;gap:4px}
.chat-header .user-details .status.offline{color:#9ca3af}

.chat-messages{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:4px}
.chat-messages::-webkit-scrollbar{width:6px}
.chat-messages::-webkit-scrollbar-track{background:#f8f9fb}
.chat-messages::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}

.message{max-width:70%;padding:12px 18px;border-radius:20px;font-size:0.92em;line-height:1.6;position:relative;word-wrap:break-word}
.message.sent{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;margin-left:auto;border-bottom-right-radius:6px}
.message.received{background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:6px}
.message .time{font-size:0.7em;opacity:0.8;margin-top:6px;text-align:right;display:flex;align-items:center;gap:4px;justify-content:flex-end}
.message.sent .time{color:rgba(255,255,255,0.8)}
.message.received .time{color:#9ca3af}
.message .seen-icon{font-size:0.9em}

.date-divider{text-align:center;margin:20px 0;position:relative}
.date-divider span{background:#f8f9fb;padding:6px 16px;font-size:0.78em;color:#9ca3af;position:relative;z-index:1;border-radius:12px;border:1px solid #e5e7eb}
.date-divider::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:#e5e7eb;z-index:0}

.chat-input{padding:16px 20px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:12px;align-items:center}
.chat-input input{flex:1;padding:14px 20px;border:1px solid #e5e7eb;border-radius:24px;font-size:0.95em;outline:none;transition:0.2s}
.chat-input input:focus{border-color:#f97316}
.chat-input button{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1.2em;transition:0.2s;display:flex;align-items:center;justify-content:center}
.chat-input button:hover{transform:scale(1.05);box-shadow:0 4px 12px rgba(249,115,22,0.3)}
.chat-input button:active{transform:scale(0.95)}

.welcome-screen{text-align:center;padding:80px 40px;color:#9ca3af}
.welcome-screen .icon{font-size:4em;margin-bottom:20px}
.welcome-screen h3{font-family:'Outfit',sans-serif;font-size:1.8em;color:#6b7280;margin-bottom:12px}
.welcome-screen p{font-size:1em;color:#9ca3af;line-height:1.6}

.stats-bar{padding:12px 20px;background:#f9fafb;border-bottom:1px solid #e5e7eb;display:flex;gap:16px;font-size:0.82em;color:#6b7280}
.stats-bar span{display:flex;align-items:center;gap:4px}

@media(max-width:768px){
  .app-layout{flex-direction:column}
  .sidebar{width:100%;max-height:40vh}
  .chat-area{flex:1}
}
</style>
</head>
<body>
<div class="app" id="app">
  <div class="app-layout">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>💬 Messenger</h2>
        <div class="header-btns">
          <button class="btn-refresh" onclick="refreshData()">🔄 Refresh</button>
          <button class="btn-home" onclick="location.href='/'">🏠 Home</button>
        </div>
      </div>
      <div class="stats-bar">
        <span>👥 <strong id="totalUsers">0</strong> Users</span>
        <span>🟢 <strong id="onlineUsers">0</strong> Online</span>
      </div>
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="🔍 Search users by name or email..." oninput="filterUsers()">
      </div>
      <div class="user-list" id="userList">
        <div style="text-align:center;padding:40px;color:#9ca3af;">
          <div style="font-size:3em;margin-bottom:12px">📭</div>
          <p>No conversations yet</p>
        </div>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="chat-area">
      <div class="chat-header">
        <div class="avatar" id="chatAvatar">?</div>
        <div class="user-details">
          <div class="name" id="chatName">Select a conversation</div>
          <div class="status offline" id="chatStatus">○ Offline</div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="welcome-screen">
          <div class="icon">💬</div>
          <h3>Welcome to Admin Messenger</h3>
          <p>Select a conversation from the left sidebar to start chatting with users. All messages are real-time and encrypted.</p>
        </div>
      </div>
      <div class="chat-input" id="chatInputArea" style="display:none">
        <input type="text" id="msgInput" placeholder="Type your message here..." onkeypress="if(event.key==='Enter')sendMsg()">
        <button onclick="sendMsg()" title="Send Message">➤</button>
      </div>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
// ============================================
// ADMIN MESSENGER - MAIN JAVASCRIPT
// ============================================

let selectedUser = null;
let socket = null;
let allUsers = [];

// Initialize Socket Connection
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        socket.emit('register', { 
            name: 'Admin', 
            email: 'admin' 
        });
    });

    socket.on('newMsg', (msg) => {
        console.log('📩 New message received:', msg);
        if (selectedUser && (msg.sender === selectedUser || msg.receiver === selectedUser)) {
            appendMessage(msg);
        }
        loadUsers();
    });

    socket.on('userStatus', (data) => {
        console.log('👤 User status update:', data);
        loadUsers();
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });
}

// Load Users from API
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        allUsers = await response.json();
        renderUsers();
        updateStats();
    } catch (error) {
        console.error('❌ Error loading users:', error);
    }
}

// Update Statistics
function updateStats() {
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('onlineUsers').textContent = allUsers.filter(u => u.isOnline).length;
}

// Render User List
function renderUsers(filter = '') {
    const filteredUsers = filter 
        ? allUsers.filter(u => 
            u.name.toLowerCase().includes(filter) || 
            u.email.toLowerCase().includes(filter)
          )
        : allUsers;

    const userList = document.getElementById('userList');
    
    if (filteredUsers.length === 0) {
        userList.innerHTML = `
            <div style="text-align:center;padding:40px;color:#9ca3af;">
                <div style="font-size:3em;margin-bottom:12px">🔍</div>
                <p>No users found</p>
            </div>`;
        return;
    }

    userList.innerHTML = filteredUsers.map(user => `
        <div class="user-item ${selectedUser === user.email ? 'active' : ''}" 
             onclick="selectUser('${user.email}')">
            <div class="user-avatar">
                ${user.name.charAt(0).toUpperCase()}
                ${user.isOnline ? '<div class="dot"></div>' : ''}
            </div>
            <div class="user-info">
                <div class="name">${user.name}</div>
                <div class="email">${user.email}</div>
                <div class="last-seen">
                    ${user.isOnline ? '🟢 Online now' : 'Last seen: ' + new Date(user.lastSeen).toLocaleString()}
                </div>
            </div>
            ${user.unreadCount > 0 ? `<div class="unread">${user.unreadCount}</div>` : ''}
        </div>
    `).join('');
}

// Filter Users
function filterUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    renderUsers(searchTerm);
}

// Select User for Chat
async function selectUser(email) {
    selectedUser = email;
    document.getElementById('chatInputArea').style.display = 'flex';
    
    const user = allUsers.find(u => u.email === email);
    
    if (user) {
        document.getElementById('chatAvatar').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('chatName').textContent = user.name;
        
        const statusEl = document.getElementById('chatStatus');
        if (user.isOnline) {
            statusEl.textContent = '🟢 Online';
            statusEl.className = 'status';
        } else {
            statusEl.textContent = '○ Offline';
            statusEl.className = 'status offline';
        }
    }

    // Load Messages
    try {
        const response = await fetch('/api/msgs/' + email);
        const messages = await response.json();
        displayMessages(messages);
        
        // Mark messages as read
        socket.emit('markRead', { user: email });
        loadUsers();
    } catch (error) {
        console.error('❌ Error loading messages:', error);
    }
}

// Display Messages
function displayMessages(messages) {
    const container = document.getElementById('chatMessages');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-screen">
                <div class="icon">💭</div>
                <h3>No Messages Yet</h3>
                <p>Start the conversation by typing a message below.</p>
            </div>`;
        return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach(msg => {
        const msgDate = new Date(msg.timestamp).toLocaleDateString();
        
        if (msgDate !== lastDate) {
            html += `<div class="date-divider"><span>${msgDate}</span></div>`;
            lastDate = msgDate;
        }

        const isSent = msg.sender === 'admin';
        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${msg.message}
                <div class="time">
                    ${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    ${isSent && msg.seen ? '<span class="seen-icon">✓✓</span>' : isSent ? '<span class="seen-icon">✓</span>' : ''}
                </div>
            </div>`;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// Append New Message
function appendMessage(msg) {
    const container = document.getElementById('chatMessages');
    
    // Remove welcome screen if exists
    const welcomeScreen = container.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    const isSent = msg.sender === 'admin';
    const messageHTML = `
        <div class="message ${isSent ? 'sent' : 'received'}">
            ${msg.message}
            <div class="time">
                ${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                ${isSent ? '<span class="seen-icon">✓</span>' : ''}
            </div>
        </div>`;

    container.insertAdjacentHTML('beforeend', messageHTML);
    container.scrollTop = container.scrollHeight;
}

// Send Message
function sendMsg() {
    if (!selectedUser) {
        alert('Please select a user first');
        return;
    }

    const input = document.getElementById('msgInput');
    const message = input.value.trim();

    if (!message) return;

    socket.emit('sendMsg', {
        sender: 'admin',
        receiver: selectedUser,
        message: message,
        type: 'text'
    });

    input.value = '';
    input.focus();
}

// Refresh All Data
function refreshData() {
    loadUsers();
    if (selectedUser) {
        selectUser(selectedUser);
    }
}

// Initialize
initSocket();
loadUsers();

// Auto refresh every 10 seconds
setInterval(() => {
    loadUsers();
}, 10000);

console.log('🚀 Admin Messenger initialized');
console.log('📱 Connected to chat server');
</script>
</body>
</html>`);
});

// ============================================
// SOCKET.IO HANDLING
// ============================================
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    let userData = null;

    socket.on('register', async (data) => {
        try {
            userData = data;
            console.log('📝 User registered:', data.email);

            let user = await User.findOne({ email: data.email });
            if (!user) {
                const hashedPassword = await bcrypt.hash('default123', 12);
                user = await User.create({
                    name: data.name,
                    email: data.email,
                    password: hashedPassword
                });
                console.log('👤 New user created:', data.email);
            }

            await User.updateOne(
                { email: data.email },
                { $set: { isOnline: true, lastSeen: new Date() } }
            );

            io.emit('userStatus', { email: data.email, online: true });
            console.log('🟢 User online:', data.email);
        } catch (error) {
            console.error('❌ Register error:', error);
        }
    });

    socket.on('sendMsg', async (data) => {
        try {
            console.log('💬 Message from:', data.sender, 'to:', data.receiver);
            
            const message = await Message.create({
                sender: data.sender,
                receiver: data.receiver,
                message: data.message,
                type: data.type || 'text',
                fileUrl: data.fileUrl || null
            });

            io.emit('newMsg', message);
            console.log('✅ Message sent and broadcasted');
        } catch (error) {
            console.error('❌ Send message error:', error);
        }
    });

    socket.on('markRead', async (data) => {
        try {
            await Message.updateMany(
                { sender: data.user, receiver: 'admin', seen: false },
                { $set: { seen: true } }
            );
            console.log('📖 Messages marked as read for:', data.user);
        } catch (error) {
            console.error('❌ Mark read error:', error);
        }
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('userTyping', data);
    });

    socket.on('stopTyping', (data) => {
        socket.broadcast.emit('userStopTyping', data);
    });

    socket.on('disconnect', async () => {
        console.log('🔌 Disconnected:', socket.id);
        
        if (userData) {
            try {
                await User.updateOne(
                    { email: userData.email },
                    { $set: { isOnline: false, lastSeen: new Date() } }
                );
                io.emit('userStatus', { email: userData.email, online: false });
                console.log('🔴 User offline:', userData.email);
            } catch (error) {
                console.error('❌ Disconnect error:', error);
            }
        }
    });

    socket.on('error', (error) => {
        console.error('⚠️ Socket error:', error);
    });
});

// ============================================
// FILE UPLOAD ROUTE
// ============================================
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = '/' + req.file.path.replace(/\\/g, '/');
        console.log('📁 File uploaded:', fileUrl);

        res.json({
            success: true,
            fileUrl: fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found on this server',
        path: req.path
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================================
// START SERVER
// ============================================
server.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Baiilla Maach Verification Hub');
    console.log('='.repeat(60));
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🌐 Main Website: http://localhost:${PORT}/`);
    console.log(`💬 Admin Messenger: http://localhost:${PORT}/messenger`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('📋 Available Routes:');
    console.log('   GET  /              - Main Website');
    console.log('   GET  /messenger     - Admin Messenger Panel');
    console.log('   GET  /api/msgs/:email - Get Messages');
    console.log('   GET  /api/admin/users - Get Users List');
    console.log('   POST /api/upload     - File Upload');
    console.log('\n💡 Tips:');
    console.log('   - Admin messenger is accessible without login');
    console.log('   - Default admin credentials are auto-created');
    console.log('   - Upload cover songs in assets/covermusic/');
    console.log('   - Add voice files: assets/realvoice.mp3');
    console.log('\n' + '='.repeat(60) + '\n');
});

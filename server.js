const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png"
};

const VOICE = {
    welcome: "/assets/my%20user%20name.mp3",
    fakeAlert: "/assets/7%20lak%20like%20but%20its%20fake.mp3"
};

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const coverExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const groups = {};
        files.forEach(f => {
            const ext = path.extname(f).toLowerCase();
            const base = path.basename(f, ext);
            if (!groups[base]) groups[base] = { audio: null, cover: null };
            if (audioExts.includes(ext)) groups[base].audio = f;
            if (coverExts.includes(ext)) groups[base].cover = f;
        });
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }
        console.log('MongoDB Connected');
        return true;
    } catch (e) { console.log('MongoDB Failed:', e.message); return false; }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile | Bangladesh",
        tiktokFollowers: "5,000",
        tiktokFollowing: "0",
        tiktokLikes: "50K",
        location: "Dhaka, Bangladesh",
        verified: true
    },
    realAccounts: [
        { 
            platform: "TikTok", 
            username: "@baiillamaach_official", 
            url: "https://tiktok.com/@baiillamaach_official", 
            screenshot: IMAGES.official, 
            verified: true,
            followers: "5,000",
            following: "0",
            likes: "50K",
            posts: "120+",
            bio: "Official Account | Entertainment",
            verifiedBadge: true,
            accountType: "Creator",
            region: "Bangladesh"
        },
        { 
            platform: "Facebook", 
            username: "Baiilla Maach Official", 
            url: "https://www.facebook.com/profile.php?id=61575202118828", 
            screenshot: null, 
            verified: true,
            followers: "Growing",
            accountType: "Page",
            category: "Entertainment"
        }
    ],
    fakeAccounts: [
        { 
            platform: "TikTok", 
            username: "@baiilla_mach", 
            profileUrl: "https://tiktok.com/@baiilla_mach", 
            screenshot: IMAGES.danger, 
            reason: "Copies official content and logo to deceive followers. Has been reported multiple times for requesting money from fans through direct messages.",
            reportedCount: 156,
            activeSince: "3 months",
            threatLevel: "Critical",
            verified: false
        },
        { 
            platform: "TikTok", 
            username: "@hammad_fams0", 
            profileUrl: "https://tiktok.com/@hammad_fams0", 
            screenshot: IMAGES.fraud, 
            reason: "Uses official name and profile photo to mislead followers. Posts fake giveaway announcements to collect personal information.",
            reportedCount: 89,
            activeSince: "2 months",
            threatLevel: "High",
            verified: false
        }
    ],
    safetyTips: [
        { title: "Verify Username", description: "Always check the exact username. Official account uses @baiillamaach_official with zero spelling variations.", icon: "search" },
        { title: "Check Verification Badge", description: "The real account has an official blue verification checkmark from TikTok and Facebook.", icon: "shield" },
        { title: "Never Share Personal Information", description: "Fake accounts often ask for passwords, phone numbers, or financial details through DMs.", icon: "lock" },
        { title: "Report Suspicious Accounts", description: "Use the built-in report feature on TikTok and Facebook to flag impersonator accounts.", icon: "flag" },
        { title: "Use Official Links Only", description: "Only click links provided on this official verification page to access the real accounts.", icon: "link" },
        { title: "Check Follower Count", description: "The official account has genuine organic followers. Fake accounts typically have few or purchased followers.", icon: "users" }
    ],
    features: [
        { title: "Account Verification", description: "Verify official accounts instantly with our verification system", icon: "check" },
        { title: "Fake Account Detection", description: "Active monitoring and reporting of impersonator accounts", icon: "alert" },
        { title: "Cover Music Player", description: "Stream exclusive cover songs directly from the official playlist", icon: "music" },
        { title: "Safety Guidelines", description: "Comprehensive safety tips to protect yourself from scams", icon: "book" },
        { title: "Direct Links", description: "Quick access to official TikTok and Facebook profiles", icon: "external" },
        { title: "Real-time Updates", description: "Stay informed about new fake accounts and security alerts", icon: "refresh" }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const safetyTips = DATA.safetyTips;
    const features = DATA.features;
    const realAccounts = DATA.realAccounts;
    const fakeAccounts = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Official Verification Hub for Baiilla Maach. Verify real accounts and report fakes.">
<meta name="theme-color" content="#09090b">
<meta name="robots" content="index, follow">
<title>Baiilla Maach Official | Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065'
        },
        dark: {
          950: '#09090b', 900: '#101014', 850: '#141418', 800: '#18181c',
          700: '#1f1f23', 600: '#27272b', 500: '#2e2e32', 400: '#39393d'
        },
        accent: {
          purple: '#9333ea', pink: '#ec4899', blue: '#3b82f6',
          teal: '#14b8a6', green: '#22c55e', red: '#ef4444',
          amber: '#f59e0b', cyan: '#06b6d4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif']
      },
      animation: {
        'gradient-x': 'gradient-x 3s ease infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards'
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
          '50%': { 'background-size': '200% 200%', 'background-position': 'right center' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'glowPulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.6)' }
        },
        'slideIn': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      boxShadow: {
        'glow': '0 0 30px rgba(139, 92, 246, 0.4)',
        'glow-sm': '0 0 10px rgba(139, 92, 246, 0.3)',
        'glow-lg': '0 0 50px rgba(139, 92, 246, 0.5)',
        'glow-green': '0 0 25px rgba(34, 197, 94, 0.4)',
        'glow-red': '0 0 25px rgba(239, 68, 68, 0.4)'
      }
    }
  }
}
</script>
<style>
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); border-radius: 3px; }
::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.2); border-radius: 3px; transition: background 0.3s; }
::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }

.gradient-text {
  background: linear-gradient(135deg, #a78bfa 0%, #ec4899 50%, #a78bfa 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: gradient-x 3s ease infinite;
}
.gradient-text-green {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #22c55e 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.gradient-text-red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #ef4444 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.gradient-button {
  background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.gradient-button::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s;
}
.gradient-button:hover::after { left: 100%; }
.gradient-button:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(147, 51, 234, 0.4); }
.gradient-button-green {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.gradient-button-green:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(34, 197, 94, 0.4); }
.gradient-button-red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.gradient-button-red:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(239, 68, 68, 0.4); }

.frosted-card {
  background: rgba(24, 24, 28, 0.85) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 1.25rem;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.frosted-card-light {
  background: rgba(31, 31, 35, 0.7) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.card-hover {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  overflow: hidden;
}
.card-hover::before {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(135deg, rgba(147, 51, 234, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: -1;
}
.card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4); }
.card-hover:hover::before { opacity: 1; }

.card-hover-green { border: 1px solid rgba(34, 197, 94, 0.15); }
.card-hover-green:hover { border-color: rgba(34, 197, 94, 0.5); box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4), 0 0 30px rgba(34, 197, 94, 0.1); }

.card-hover-red { border: 1px solid rgba(239, 68, 68, 0.15); }
.card-hover-red:hover { border-color: rgba(239, 68, 68, 0.5); box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4), 0 0 30px rgba(239, 68, 68, 0.1); }

.card-hover-purple { border: 1px solid rgba(139, 92, 246, 0.15); }
.card-hover-purple:hover { border-color: rgba(139, 92, 246, 0.5); box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4), 0 0 30px rgba(139, 92, 246, 0.1); }

.verified-pulse {
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 15px rgba(34, 197, 94, 0.3); }
  50% { box-shadow: 0 0 30px rgba(34, 197, 94, 0.6); }
}

.danger-pulse {
  animation: dangerGlow 1.5s ease-in-out infinite;
}

@keyframes dangerGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.6); }
}

.spotify-bar {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  height: 4px;
  cursor: pointer;
  position: relative;
}
.spotify-bar:hover { height: 6px; }
.spotify-fill {
  background: linear-gradient(90deg, #1db954, #169c46);
  border-radius: 3px;
  height: 100%;
  width: 0%;
  transition: width 0.15s linear;
  position: relative;
}
.spotify-fill::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background: #1db954;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s;
}
.spotify-bar:hover .spotify-fill::after { opacity: 1; }

.spotify-eq-bar {
  width: 3px;
  background: #1db954;
  border-radius: 2px;
  animation: eqAnim 0.9s ease-in-out infinite;
}
@keyframes eqAnim {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}

.stat-card {
  position: relative;
  overflow: hidden;
}
.stat-card::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%);
  pointer-events: none;
}

.watermark-fake {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-25deg);
  font-size: 5rem;
  font-weight: 900;
  color: rgba(239, 68, 68, 0.04);
  pointer-events: none;
  letter-spacing: 1rem;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .resp-flex-col { flex-direction: column !important; }
  .resp-text-center { text-align: center !important; }
  .resp-w-full { width: 100% !important; }
}

.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.tooltip {
  position: relative;
}
.tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(24, 24, 28, 0.95);
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  margin-bottom: 8px;
}
.tooltip:hover::after { opacity: 1; }
</style>
</head>
<body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen antialiased">

<header class="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center gap-3">
        <div class="relative">
          <img src="${DATA.celebrity.photo}" alt="" class="w-10 h-10 rounded-full border-2 border-accent-purple object-cover" onerror="this.style.display='none'">
          <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-accent-green rounded-full border-2 border-dark-900"></div>
        </div>
        <span class="text-lg font-bold gradient-text font-heading hidden sm:block">Verification Hub</span>
      </div>
      <nav class="flex items-center gap-1 sm:gap-2">
        <a href="#official" class="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all duration-200">Official</a>
        <a href="#fake" class="px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-dark-700/50 rounded-lg transition-all duration-200">Fake Alerts</a>
        <a href="#features" class="px-3 py-2 text-sm text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg transition-all duration-200 hidden sm:block">Features</a>
        <a href="#safety" class="px-3 py-2 text-sm text-gray-400 hover:text-accent-amber hover:bg-dark-700/50 rounded-lg transition-all duration-200 hidden sm:block">Safety</a>
        <a href="#music" class="px-3 py-2 text-sm text-gray-400 hover:text-green-400 hover:bg-dark-700/50 rounded-lg transition-all duration-200">Music</a>
        <a href="#gallery" class="px-3 py-2 text-sm text-gray-400 hover:text-accent-cyan hover:bg-dark-700/50 rounded-lg transition-all duration-200 hidden sm:block">Gallery</a>
      </nav>
    </div>
  </div>
</header>

<main class="pt-20 pb-16">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

    <section class="text-center py-10 sm:py-16 animate-fade-in">
      <div class="relative inline-block mb-6">
        <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-3 border-accent-purple object-cover mx-auto shadow-glow" onerror="this.style.display='none'">
        <div class="absolute -bottom-1 -right-1 w-8 h-8 bg-accent-green rounded-full border-4 border-dark-950 flex items-center justify-center verified-pulse">
          <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        </div>
      </div>
      <h1 class="text-3xl sm:text-5xl font-extrabold gradient-text font-heading mb-3">${DATA.celebrity.fullName}</h1>
      <p class="text-gray-400 text-base sm:text-lg mb-6 max-w-xl mx-auto">${DATA.celebrity.bio}</p>
      
      <div class="flex justify-center gap-6 sm:gap-10 mb-6">
        <div class="stat-card bg-dark-800/50 rounded-xl px-6 py-3">
          <div class="text-2xl sm:text-3xl font-bold text-white">${DATA.celebrity.tiktokFollowers}</div>
          <div class="text-xs text-gray-500 uppercase tracking-wider mt-1">Followers</div>
        </div>
        <div class="stat-card bg-dark-800/50 rounded-xl px-6 py-3">
          <div class="text-2xl sm:text-3xl font-bold text-white">${DATA.celebrity.tiktokFollowing}</div>
          <div class="text-xs text-gray-500 uppercase tracking-wider mt-1">Following</div>
        </div>
        <div class="stat-card bg-dark-800/50 rounded-xl px-6 py-3">
          <div class="text-2xl sm:text-3xl font-bold text-white">${DATA.celebrity.tiktokLikes}</div>
          <div class="text-xs text-gray-500 uppercase tracking-wider mt-1">Likes</div>
        </div>
      </div>

      <div class="flex justify-center gap-3 flex-wrap mb-7">
        <span class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-green/10 text-accent-green border border-accent-green/30 rounded-full text-sm font-semibold verified-pulse">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l6-6z" clip-rule="evenodd"/></svg>
          Verified Official
        </span>
        <span class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-purple/10 text-accent-purple border border-accent-purple/30 rounded-full text-sm font-semibold">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          Official Creator
        </span>
        <span class="inline-flex items-center gap-1.5 px-4 py-2 bg-dark-800/50 text-gray-300 border border-dark-600 rounded-full text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          ${DATA.celebrity.location}
        </span>
      </div>

      <div class="flex justify-center gap-3 flex-wrap">
        <a href="${realAccounts[0].url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-6 py-3 bg-dark-800 border border-dark-600 hover:border-white rounded-full text-sm font-semibold transition-all duration-300 hover:bg-dark-700">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
          TikTok
        </a>
        <a href="${realAccounts[1].url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-6 py-3 bg-dark-800 border border-dark-600 hover:border-white rounded-full text-sm font-semibold transition-all duration-300 hover:bg-dark-700">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </a>
      </div>
    </section>

    <section id="features" class="py-8 animate-slide-in">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        ${features.map((f, i) => `
        <div class="frosted-card-light card-hover-purple p-4 text-center" style="animation-delay: ${i * 0.1}s">
          <div class="w-10 h-10 mx-auto mb-3 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h4 class="text-xs font-bold text-white mb-1">${f.title}</h4>
          <p class="text-xs text-gray-500 leading-relaxed">${f.description}</p>
        </div>`).join('')}
      </div>
    </section>

    <section id="official" class="py-8 animate-slide-in" style="animation-delay: 0.2s">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-accent-green/15 flex items-center justify-center verified-pulse">
          <svg class="w-5 h-5 text-accent-green" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l6-6z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <h2 class="text-2xl font-bold font-heading text-white">Official Verified Account</h2>
          <p class="text-sm text-gray-400">The only authentic account - All others are fake</p>
        </div>
      </div>

      <div class="frosted-card card-hover-green p-6 sm:p-8">
        <div class="flex items-center gap-4 mb-6 pb-6 border-b border-dark-700/50">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-accent-green to-green-600 flex items-center justify-center verified-pulse flex-shrink-0">
            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">The Only Authentic Account</h3>
            <p class="text-sm text-gray-400">This account has been verified as the one and only official profile</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-3">
            ${realAccounts.map(acc => `
            <div class="bg-dark-700/40 rounded-xl p-4 border border-dark-600/30">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs uppercase tracking-wider text-gray-500 font-semibold">${acc.platform}</span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-green/10 text-accent-green text-xs rounded-full font-semibold">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  Verified
                </span>
              </div>
              <div class="flex items-center gap-3 mb-3">
                ${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-16 h-16 rounded-lg object-cover border border-dark-500" onerror="this.style.display='none'">` : `<div class="w-16 h-16 rounded-lg bg-dark-600 flex items-center justify-center text-2xl">${acc.platform === 'TikTok' ? '🎵' : '📘'}</div>`}
                <div>
                  <div class="font-bold text-white">${acc.username}</div>
                  <div class="text-xs text-gray-400">${acc.platform} • ${acc.followers || ''} followers</div>
                </div>
              </div>
              ${acc.platform === 'TikTok' ? `
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-dark-600/30 rounded-lg py-2"><div class="text-sm font-bold text-white">${acc.followers}</div><div class="text-xs text-gray-500">Followers</div></div>
                <div class="bg-dark-600/30 rounded-lg py-2"><div class="text-sm font-bold text-white">${acc.following}</div><div class="text-xs text-gray-500">Following</div></div>
                <div class="bg-dark-600/30 rounded-lg py-2"><div class="text-sm font-bold text-white">${acc.likes}</div><div class="text-xs text-gray-500">Likes</div></div>
              </div>` : ''}
            </div>`).join('')}
          </div>
          <div class="bg-dark-700/40 rounded-xl p-6 border border-dark-600/30 flex flex-col items-center justify-center text-center">
            <img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-accent-green mb-4" onerror="this.style.display='none'">
            <div class="text-lg font-bold text-white">@baiillamaach_official</div>
            <div class="text-sm text-gray-400 mb-4">TikTok • Facebook</div>
            <a href="${realAccounts[0].url}" target="_blank" rel="noopener noreferrer" class="gradient-button-green px-6 py-3 rounded-full text-white font-bold text-sm hover:shadow-glow-green transition-all duration-300">
              Follow Official Account
            </a>
            <p class="text-xs text-gray-500 mt-4">This is the only authentic account. All others claiming to be Baiilla Maach are fake.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="fake" class="py-8 animate-slide-in" style="animation-delay: 0.4s">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-accent-red/15 flex items-center justify-center danger-pulse">
          <svg class="w-5 h-5 text-accent-red" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <h2 class="text-2xl font-bold font-heading text-white">Fake Accounts Detected</h2>
          <p class="text-sm text-gray-400">${totalFake} impersonator accounts identified - Report them immediately</p>
        </div>
      </div>

      <div class="frosted-card border-red-500/20 p-5 mb-6">
        <div class="flex items-center gap-3 bg-red-500/5 rounded-xl px-4 py-3 border border-red-500/15">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-accent-red to-red-600 flex items-center justify-center danger-pulse flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <h4 class="font-bold text-red-400">${totalFake} Active Fake Account${totalFake > 1 ? 's' : ''} Detected</h4>
            <p class="text-xs text-gray-400">These accounts are NOT affiliated with Baiilla Maach. Report them to protect the community.</p>
          </div>
        </div>
      </div>

      <div class="relative overflow-hidden rounded-2xl" id="fakeCarousel">
        <div class="flex transition-transform duration-500 ease-out" id="fakeTrack">
          ${fakeAccounts.map((a, i) => `
          <div class="min-w-full px-1">
            <div class="frosted-card card-hover-red p-5 sm:p-6 relative overflow-hidden">
              <div class="watermark-fake">FAKE</div>
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <span class="text-red-400 text-lg font-bold">!</span>
                  <span class="font-bold text-red-300">Fake Account #${i + 1} of ${totalFake}</span>
                </div>
                <span class="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full font-bold uppercase border border-red-500/30">${a.threatLevel} Threat</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="relative rounded-xl overflow-hidden border-2 border-red-500/30 bg-dark-900">
                  ${a.screenshot ? `<img src="${a.screenshot}" alt="Fake account screenshot" class="w-full h-auto object-cover opacity-80" loading="lazy">` : '<div class="w-full h-48 flex items-center justify-center text-4xl text-red-500/30">FAKE</div>'}
                  <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
                    <span class="bg-red-500/85 text-white px-4 py-1.5 rounded-lg text-sm font-extrabold tracking-wider">FAKE ACCOUNT</span>
                    <span class="bg-red-500/85 text-white px-3 py-1 rounded-lg text-xs font-bold">DO NOT TRUST</span>
                  </div>
                </div>
                <div class="space-y-2.5">
                  <div class="flex justify-between items-center bg-dark-700/40 rounded-lg px-4 py-2.5 text-sm border border-dark-600/20">
                    <span class="text-gray-400 text-xs uppercase tracking-wider font-semibold">Platform</span>
                    <span class="text-red-300 font-semibold">${a.platform}</span>
                  </div>
                  <div class="flex justify-between items-center bg-dark-700/40 rounded-lg px-4 py-2.5 text-sm border border-dark-600/20">
                    <span class="text-gray-400 text-xs uppercase tracking-wider font-semibold">Username</span>
                    <span class="text-red-300 font-semibold">${a.username}</span>
                  </div>
                  <div class="flex justify-between items-center bg-dark-700/40 rounded-lg px-4 py-2.5 text-sm border border-dark-600/20">
                    <span class="text-gray-400 text-xs uppercase tracking-wider font-semibold">Status</span>
                    <span class="text-red-300 font-semibold">Active Threat</span>
                  </div>
                  <div class="flex justify-between items-center bg-dark-700/40 rounded-lg px-4 py-2.5 text-sm border border-dark-600/20">
                    <span class="text-gray-400 text-xs uppercase tracking-wider font-semibold">Reports</span>
                    <span class="text-red-300 font-semibold">${a.reportedCount}+ reports</span>
                  </div>
                  <div class="flex justify-between items-center bg-dark-700/40 rounded-lg px-4 py-2.5 text-sm border border-dark-600/20">
                    <span class="text-gray-400 text-xs uppercase tracking-wider font-semibold">Active Since</span>
                    <span class="text-red-300 font-semibold">${a.activeSince}</span>
                  </div>
                  <div class="bg-red-500/5 rounded-lg p-3 text-sm text-red-300 border border-red-500/15 leading-relaxed">
                    <span class="font-bold text-red-400">Reason: </span>${a.reason}
                  </div>
                </div>
              </div>
              <div class="flex gap-3 mt-4">
                <a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 text-center gradient-button-red px-5 py-3 rounded-full text-white text-sm font-bold hover:shadow-glow-red transition-all duration-300">
                  Report Account
                </a>
                <button class="flex-1 px-5 py-3 bg-dark-700 border border-red-500/25 text-red-300 rounded-full text-sm font-bold hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-300 copy-btn" data-username="${a.username}">
                  Copy Username
                </button>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="flex justify-center items-center gap-4 mt-5">
        <button class="w-10 h-10 rounded-full bg-dark-700 border border-dark-500 flex items-center justify-center text-sm hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300" onclick="moveCarousel(-1)" aria-label="Previous fake account">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex gap-2" id="carouselDots">
          ${fakeAccounts.map((_, i) => `<button class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-red-500 w-7' : 'bg-dark-600 hover:bg-red-500/50'}" onclick="goSlide(${i})" aria-label="Slide ${i + 1}"></button>`).join('')}
        </div>
        <button class="w-10 h-10 rounded-full bg-dark-700 border border-dark-500 flex items-center justify-center text-sm hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300" onclick="moveCarousel(1)" aria-label="Next fake account">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div class="frosted-card p-4 mt-5 flex items-center gap-4 cursor-pointer hover:border-accent-purple/50 transition-all duration-300 group" onclick="toggleFakeVoice()">
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
          <svg id="fakeVoiceIcon" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <p class="font-medium text-white">Verify Voice Alert</p>
          <p class="text-sm text-gray-400">Click to hear: "7 lak like but its fake" - Warning about fake accounts</p>
        </div>
        <audio id="fakeVoicePlayer" src="${VOICE.fakeAlert}" preload="none"></audio>
      </div>
    </section>

    <section id="safety" class="py-8 animate-slide-in" style="animation-delay: 0.6s">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-accent-amber/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-accent-amber" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <h2 class="text-2xl font-bold font-heading text-white">Safety Guidelines</h2>
          <p class="text-sm text-gray-400">Protect yourself from impersonators and scams</p>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${safetyTips.map((tip, i) => `
        <div class="frosted-card-light card-hover-purple p-5" style="animation-delay: ${i * 0.1}s">
          <div class="w-10 h-10 rounded-lg bg-accent-amber/10 flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h4 class="font-bold text-white mb-1.5">${tip.title}</h4>
          <p class="text-sm text-gray-400 leading-relaxed">${tip.description}</p>
        </div>`).join('')}
      </div>
    </section>

    ${coverSongs.length > 0 ? `
    <section id="music" class="py-8 animate-slide-in" style="animation-delay: 0.8s">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>
        </div>
        <div>
          <h2 class="text-2xl font-bold font-heading text-white">Cover Music</h2>
          <p class="text-sm text-gray-400">${coverSongs.length} cover songs available</p>
        </div>
      </div>
      <div class="frosted-card overflow-hidden">
        <div class="flex resp-flex-col gap-5 p-5 sm:p-6 bg-gradient-to-r from-dark-800 via-dark-750 to-dark-700">
          <div class="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden flex-shrink-0 bg-dark-600 flex items-center justify-center text-5xl mx-auto sm:mx-0 shadow-xl" id="npCover">
            <svg class="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>
          </div>
          <div class="flex-1 flex flex-col justify-center resp-text-center">
            <div class="text-xl sm:text-2xl font-bold text-white mb-1" id="npTitle">Select a song</div>
            <div class="text-sm text-gray-400 mb-4" id="npArtist">Cover Songs Collection</div>
            <div class="mb-4">
              <div class="spotify-bar" id="progressBar" onclick="seekAudio(event)">
                <div class="spotify-fill" id="progressFill"></div>
              </div>
              <div class="flex justify-between text-xs text-gray-500 mt-2">
                <span id="curTime">0:00</span>
                <span id="totTime">0:00</span>
              </div>
            </div>
            <div class="flex items-center justify-center sm:justify-start gap-4 mb-4">
              <button class="text-gray-400 hover:text-white transition p-2 rounded-full hover:bg-dark-600" onclick="prevSong()" aria-label="Previous">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"/></svg>
              </button>
              <button class="w-12 h-12 rounded-full bg-white text-dark-900 flex items-center justify-center hover:scale-105 transition-transform shadow-lg" id="ppBtn" onclick="togglePlay()" aria-label="Play/Pause">
                <svg id="ppIcon" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
              </button>
              <button class="text-gray-400 hover:text-white transition p-2 rounded-full hover:bg-dark-600" onclick="nextSong()" aria-label="Next">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 5.168A1 1 0 006 6v2.798l5.445-3.63A1 1 0 0113 6v8a1 1 0 01-1.555.832L6 11.202V14a1 1 0 01-1.555.832l-6-4a1 1 0 010-1.664l6-4z"/></svg>
              </button>
            </div>
            <div class="flex items-center justify-center sm:justify-start gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd"/></svg>
              <input type="range" id="volSlider" min="0" max="100" value="70" onchange="setVol(this.value)" class="w-24 h-1.5 accent-green-500 cursor-pointer rounded-full" aria-label="Volume">
            </div>
          </div>
        </div>
        <div class="max-h-80 overflow-y-auto">
          <div class="sticky top-0 bg-dark-800/95 backdrop-blur-sm px-5 py-3 border-b border-dark-600/50 flex justify-between items-center z-10">
            <span class="font-bold text-white text-sm">Playlist</span>
            <span class="text-xs text-gray-400">${coverSongs.length} songs</span>
          </div>
          <div class="divide-y divide-dark-700/30">
            ${coverSongs.map((s, i) => `
            <div class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-dark-700/40 transition-all duration-200 spotify-item group" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl || ''}" onclick="playSong(${i})">
              <span class="text-xs text-gray-500 w-6 font-mono">${(i + 1).toString().padStart(2, '0')}</span>
              <div class="w-10 h-10 rounded-lg overflow-hidden bg-dark-600 flex-shrink-0 flex items-center justify-center shadow-md">
                ${s.coverUrl ? `<img src="${s.coverUrl}" alt="" class="w-full h-full object-cover" loading="lazy">` : '<svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>'}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-white truncate group-hover:text-green-400 transition-colors">${s.title}</div>
                <div class="text-xs text-gray-500">Cover Song</div>
              </div>
              <div class="spotify-eq hidden items-end gap-0.5 h-4">
                <span class="spotify-eq-bar" style="animation-delay: 0s"></span>
                <span class="spotify-eq-bar" style="animation-delay: 0.2s"></span>
                <span class="spotify-eq-bar" style="animation-delay: 0.4s"></span>
                <span class="spotify-eq-bar" style="animation-delay: 0.6s"></span>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </section>` : ''}

    ${galleryPhotos.length > 0 ? `
    <section id="gallery" class="py-8 animate-slide-in">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-accent-cyan/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-accent-cyan" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <h2 class="text-2xl font-bold font-heading text-white">Official Gallery</h2>
          <p class="text-sm text-gray-400">${galleryPhotos.length} photos</p>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        ${galleryPhotos.map(p => `
        <div class="rounded-xl overflow-hidden bg-dark-800 border border-dark-600/50 card-hover-purple group cursor-pointer">
          <div class="relative overflow-hidden">
            <img src="${p.path}" alt="${p.caption || 'Gallery image'}" class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
            </div>
          </div>
          ${p.caption ? `<div class="px-3 py-2.5"><p class="text-xs text-gray-400 text-center truncate">${p.caption}</p></div>` : ''}
        </div>`).join('')}
      </div>
    </section>` : ''}

  </div>
</main>

<footer class="border-t border-dark-700/50 bg-dark-900/50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <img src="${DATA.celebrity.photo}" alt="" class="w-8 h-8 rounded-full border border-accent-purple" onerror="this.style.display='none'">
          <span class="font-bold gradient-text">${DATA.celebrity.fullName}</span>
        </div>
        <p class="text-sm text-gray-500 leading-relaxed">Official verification hub. Protecting fans from impersonators and fake accounts.</p>
      </div>
      <div>
        <h4 class="font-bold text-white mb-3">Quick Links</h4>
        <div class="space-y-2">
          <a href="#official" class="block text-sm text-gray-400 hover:text-white transition">Official Account</a>
          <a href="#fake" class="block text-sm text-gray-400 hover:text-red-400 transition">Fake Alerts</a>
          <a href="#safety" class="block text-sm text-gray-400 hover:text-accent-amber transition">Safety Tips</a>
          <a href="#music" class="block text-sm text-gray-400 hover:text-green-400 transition">Cover Music</a>
          <a href="#gallery" class="block text-sm text-gray-400 hover:text-accent-cyan transition">Gallery</a>
        </div>
      </div>
      <div>
        <h4 class="font-bold text-white mb-3">Official Accounts</h4>
        <div class="space-y-2">
          <a href="${realAccounts[0].url}" target="_blank" rel="noopener noreferrer" class="block text-sm text-gray-400 hover:text-white transition">TikTok: ${realAccounts[0].username}</a>
          <a href="${realAccounts[1].url}" target="_blank" rel="noopener noreferrer" class="block text-sm text-gray-400 hover:text-white transition">Facebook: ${realAccounts[1].username}</a>
          <p class="text-sm text-gray-500">${DATA.celebrity.location}</p>
        </div>
      </div>
    </div>
    <div class="pt-6 border-t border-dark-700/30 text-center">
      <p class="text-xs text-gray-600">&copy; ${new Date().getFullYear()} ${DATA.celebrity.fullName}. All rights reserved. This is the only official verification page.</p>
    </div>
  </div>
</footer>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>
<audio id="audioPlayer" preload="none"></audio>

<script>
(function(){
  const wv = document.getElementById('welcomeVoice');
  const played = sessionStorage.getItem('welcomeVoicePlayed');
  if (!played) {
    setTimeout(() => {
      wv.play().catch(() => {});
      sessionStorage.setItem('welcomeVoicePlayed', '1');
    }, 2000);
  }
})();

let currentSlide = 0;
const totalSlides = ${totalFake};
const track = document.getElementById('fakeTrack');
const dots = document.querySelectorAll('#carouselDots button');
let autoSlideInterval;

function updateCarousel() {
  track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
  dots.forEach((d, i) => {
    if (i === currentSlide) {
      d.classList.add('bg-red-500', 'w-7');
      d.classList.remove('bg-dark-600', 'hover:bg-red-500/50');
    } else {
      d.classList.remove('bg-red-500', 'w-7');
      d.classList.add('bg-dark-600', 'hover:bg-red-500/50');
    }
  });
}

function moveCarousel(dir) {
  currentSlide = (currentSlide + dir + totalSlides) % totalSlides;
  updateCarousel();
  clearInterval(autoSlideInterval);
  autoSlideInterval = setInterval(() => moveCarousel(1), 6000);
}

function goSlide(i) {
  currentSlide = i;
  updateCarousel();
  clearInterval(autoSlideInterval);
  autoSlideInterval = setInterval(() => moveCarousel(1), 6000);
}

autoSlideInterval = setInterval(() => moveCarousel(1), 6000);

let touchStartX = 0;
const carouselEl = document.getElementById('fakeCarousel');
carouselEl.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
carouselEl.addEventListener('touchend', (e) => {
  const diff = touchStartX - e.changedTouches[0].screenX;
  if (Math.abs(diff) > 50) moveCarousel(diff > 0 ? 1 : -1);
});

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    navigator.clipboard.writeText(this.dataset.username).then(() => {
      const originalText = this.textContent;
      this.textContent = 'Copied!';
      this.classList.add('bg-green-500/20', 'text-green-400', 'border-green-500/50');
      this.classList.remove('text-red-300', 'border-red-500/25');
      setTimeout(() => {
        this.textContent = originalText;
        this.classList.remove('bg-green-500/20', 'text-green-400', 'border-green-500/50');
        this.classList.add('text-red-300', 'border-red-500/25');
      }, 2000);
    });
  });
});

let currentSongIndex = -1;
let isPlaying = false;
const audioPlayer = document.getElementById('audioPlayer');
const songItems = document.querySelectorAll('.spotify-item');

function loadSong(index) {
  if (!songItems.length || index < 0 || index >= songItems.length) return;
  if (currentSongIndex === index) return;
  currentSongIndex = index;
  const item = songItems[index];
  audioPlayer.src = item.dataset.audio;
  audioPlayer.load();
  document.getElementById('npTitle').textContent = item.querySelector('.text-sm').textContent;
  document.getElementById('npArtist').textContent = item.querySelector('.text-xs').textContent;
  const coverEl = document.getElementById('npCover');
  if (item.dataset.cover) {
    coverEl.innerHTML = '<img src="' + item.dataset.cover + '" alt="" class="w-full h-full object-cover">';
  } else {
    coverEl.innerHTML = '<svg class="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>';
  }
  songItems.forEach(el => el.classList.remove('bg-green-500/8', 'border-l-2', 'border-green-500'));
  item.classList.add('bg-green-500/8', 'border-l-2', 'border-green-500');
  document.querySelectorAll('.spotify-eq').forEach(el => el.classList.add('hidden'));
  const eqEl = item.querySelector('.spotify-eq');
  if (eqEl) eqEl.classList.remove('hidden');
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('curTime').textContent = '0:00';
  document.getElementById('totTime').textContent = '0:00';
  audioPlayer.play().then(() => {
    isPlaying = true;
    updatePlayButton();
  }).catch((e) => {
    console.error('Playback failed:', e);
    isPlaying = false;
    updatePlayButton();
  });
}

function playSong(index) {
  if (index === currentSongIndex) {
    togglePlay();
  } else {
    loadSong(index);
  }
}

function togglePlay() {
  if (!audioPlayer.src && songItems.length > 0) {
    loadSong(0);
    return;
  }
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
  } else {
    audioPlayer.play().then(() => {
      isPlaying = true;
    }).catch(() => {
      isPlaying = false;
    });
    isPlaying = !isPlaying;
  }
  updatePlayButton();
}

function updatePlayButton() {
  const icon = document.getElementById('ppIcon');
  if (isPlaying) {
    icon.innerHTML = '<path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM13 3a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2z"/>';
  } else {
    icon.innerHTML = '<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>';
  }
}

function nextSong() {
  if (songItems.length) loadSong((currentSongIndex + 1) % songItems.length);
}

function prevSong() {
  if (songItems.length) loadSong(currentSongIndex <= 0 ? songItems.length - 1 : currentSongIndex - 1);
}

function setVol(value) {
  audioPlayer.volume = value / 100;
}

function seekAudio(event) {
  const rect = event.target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  if (audioPlayer.duration) {
    audioPlayer.currentTime = (clickX / width) * audioPlayer.duration;
  }
}

function toggleFakeVoice() {
  const fv = document.getElementById('fakeVoicePlayer');
  if (fv.paused) {
    fv.play().catch(() => {});
  } else {
    fv.pause();
    fv.currentTime = 0;
  }
}

audioPlayer.addEventListener('timeupdate', () => {
  if (audioPlayer.duration) {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    const mins = Math.floor(audioPlayer.currentTime / 60);
    const secs = Math.floor(audioPlayer.currentTime % 60);
    document.getElementById('curTime').textContent = mins + ':' + secs.toString().padStart(2, '0');
  }
});

audioPlayer.addEventListener('loadedmetadata', () => {
  const mins = Math.floor(audioPlayer.duration / 60);
  const secs = Math.floor(audioPlayer.duration % 60);
  document.getElementById('totTime').textContent = mins + ':' + secs.toString().padStart(2, '0');
});

audioPlayer.addEventListener('ended', () => {
  isPlaying = false;
  updatePlayButton();
  nextSong();
});

audioPlayer.addEventListener('error', () => {
  console.error('Audio playback error');
  isPlaying = false;
  updatePlayButton();
});

audioPlayer.volume = 0.7;
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login | Verification Hub</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}}}}}</script></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 flex items-center justify-center min-h-screen font-sans"><div class="bg-dark-800/90 backdrop-blur-xl border border-dark-600/50 rounded-2xl p-10 w-full max-w-md shadow-2xl"><div class="text-center mb-8"><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center"><svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg></div><h2 class="text-2xl font-bold text-white font-heading">Admin Login</h2><p class="text-sm text-gray-400 mt-1">Verification Hub Dashboard</p></div>${error?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="mb-5"><label class="block text-gray-400 text-sm font-semibold mb-2">Username</label><input type="text" name="username" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:border-accent-purple transition-all duration-300" placeholder="Enter username" required></div><div class="mb-6"><label class="block text-gray-400 text-sm font-semibold mb-2">Password</label><input type="password" name="password" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:border-accent-purple transition-all duration-300" placeholder="Enter password" required></div><button type="submit" class="w-full py-3.5 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02]">Sign In</button></form><div class="text-center mt-6"><a href="/" class="text-sm text-gray-500 hover:text-white transition-colors duration-200">Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="bg-dark-800 border border-dark-600/50 rounded-xl overflow-hidden card-hover-purple"><div class="relative overflow-hidden"><img src="${p.path}" class="w-full h-48 object-cover"><div class="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div></div><div class="p-4">${p.caption?`<p class="text-sm text-gray-300 mb-1">${p.caption}</p>`:''}<p class="text-xs text-gray-500">${new Date(p.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><form method="POST" action="/admin/delete" class="border-t border-dark-600/30"><input type="hidden" name="photoId" value="${p._id}"><button type="submit" class="w-full py-2.5 text-sm text-red-400 font-semibold hover:bg-red-500/10 transition-colors duration-200" onclick="return confirm('Delete this photo permanently?')">Delete Photo</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel | Verification Hub</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b',500:'#2e2e32'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444',blue:'#3b82f6'}}}}}</script><style>.gradient-text{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}.card-hover-purple{transition:all .3s ease}.card-hover-purple:hover{transform:translateY(-3px);box-shadow:0 15px 35px rgba(0,0,0,.3);border-color:rgba(139,92,246,.4)}</style></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen"><header class="sticky top-0 z-50 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex items-center justify-between h-16"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd"/></svg></div><h2 class="text-xl font-bold gradient-text font-heading">Admin Panel</h2></div><div class="flex items-center gap-3"><a href="/" class="px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white transition-all duration-200">View Site</a><a href="/admin/logout" class="px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-sm text-gray-300 hover:text-red-400 hover:border-red-500/50 transition-all duration-200">Logout</a></div></div></div></header><main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">${msg?`<div class="bg-green-500/10 border border-green-500/30 text-green-400 px-5 py-4 rounded-xl mb-6 flex items-center gap-3"><svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>${msg}</div>`:''}${err?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl mb-6 flex items-center gap-3"><svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>${err}</div>`:''}<div class="bg-dark-800/80 backdrop-blur-md border border-dark-600/50 rounded-2xl p-8 mb-8"><h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2"><svg class="w-5 h-5 text-accent-purple" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>Upload New Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="mb-5"><label class="block text-gray-400 text-sm font-semibold mb-2">Select Photo</label><div class="relative"><input type="file" name="photo" accept="image/*" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:bg-accent-purple file:text-white file:font-semibold file:text-sm hover:file:bg-accent-pink file:transition-colors file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-purple/50 transition-all duration-300" required></div><p class="text-xs text-gray-500 mt-2">Supported formats: JPG, PNG, GIF, WebP. Max size: 10MB</p></div><div class="mb-6"><label class="block text-gray-400 text-sm font-semibold mb-2">Caption (Optional)</label><input type="text" name="caption" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:border-accent-purple transition-all duration-300" placeholder="Enter a caption for this photo..."></div><button type="submit" class="px-8 py-3.5 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02]">Upload Photo</button></form></div><div class="flex items-center justify-between mb-6"><h3 class="text-xl font-bold text-white">Gallery Photos <span class="text-sm text-gray-400 font-normal ml-2">(${photos.length} total)</span></h3></div>${photos.length ? `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">${phtml}</div>` : '<div class="text-center py-16"><div class="w-20 h-20 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center"><svg class="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg></div><p class="text-gray-500 text-lg font-medium">No photos uploaded yet</p><p class="text-gray-600 text-sm mt-1">Upload your first photo using the form above</p></div>'}</main></body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    if (pathname.startsWith('/assets/')) {
        const decodedPathname = decodeURIComponent(pathname);
        const assetPath = path.join(__dir, decodedPathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Forbidden'); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const contentTypes = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
                '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
                '.flac': 'audio/flac', '.wma': 'audio/x-ms-wma'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            const rangeHeader = req.headers.range;
            if (rangeHeader && ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
                const parts = rangeHeader.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunkSize = (end - start) + 1;
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400'
                });
                fs.createReadStream(assetPath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stat.size,
                    'Cache-Control': 'public, max-age=86400',
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(assetPath).pipe(res);
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Asset not found');
        }
        return;
    }

    if (pathname === '/admin' && req.method === 'GET') {
        const session = getSession(cookies.sessionId);
        if (session) {
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getAdminPanelHTML(photos));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAdminLoginHTML());
        return;
    }

    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const isValid = await verifyAdmin(params.get('username'), params.get('password'));
            if (isValid) {
                const sessionId = createSession(params.get('username'));
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=7200; SameSite=Lax`
                });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminLoginHTML('Invalid username or password. Please try again.'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
        });
        res.end();
        return;
    }

    if (pathname === '/admin/upload' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        const form = new formidable.IncomingForm({
            uploadDir: GALLERY_DIR,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024
        });
        form.parse(req, async (err, fields, files) => {
            if (err) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Upload error: ' + err.message));
                return;
            }
            const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!photoFile || !photoFile.originalFilename) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Please select a photo to upload.'));
                return;
            }
            const ext = path.extname(photoFile.originalFilename).toLowerCase();
            if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Invalid file format. Allowed: JPG, PNG, GIF, WebP.'));
                return;
            }
            const fileName = Date.now() + '_' + photoFile.originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
            const newPath = path.join(GALLERY_DIR, fileName);
            try {
                fs.renameSync(photoFile.filepath, newPath);
                await savePhoto({
                    path: '/assets/gallery/' + fileName,
                    caption: fields.caption ? (Array.isArray(fields.caption) ? fields.caption[0] : fields.caption) : '',
                    originalName: photoFile.originalFilename
                });
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, 'Photo uploaded successfully!'));
            } catch (error) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(getAdminPanelHTML(photos, '', 'Error saving photo: ' + error.message));
            }
        });
        return;
    }

    if (pathname === '/admin/delete' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const photoId = params.get('photoId');
            if (photoId) {
                try {
                    const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(photoId) });
                    if (photo) {
                        const filePath = path.join(__dir, photo.path);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    await deletePhoto(photoId);
                } catch (e) {
                    console.error('Delete error:', e.message);
                }
            }
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getAdminPanelHTML(photos, 'Photo deleted successfully.'));
        });
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(getMainHTML(photos));
        return;
    }

    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            mongodb: !!db,
            coverSongs: getCoverSongs().length,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404 Not Found</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-dark-950 flex items-center justify-center min-h-screen font-sans"><div class="text-center"><div class="text-9xl font-black gradient-text mb-4">404</div><p class="text-gray-400 text-lg mb-8">The page you are looking for does not exist.</p><a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>Back to Home</a></div></body></html>`);
});

async function start() {
    await connectDB();
    const songs = getCoverSongs();
    server.listen(PORT, () => {
        console.log('='.repeat(55));
        console.log('  Baiilla Maach | Official Verification Hub');
        console.log('='.repeat(55));
        console.log(`  Server: http://localhost:${PORT}`);
        console.log(`  Admin:  http://localhost:${PORT}/admin`);
        console.log(`  Music:  ${songs.length} cover songs detected`);
        console.log(`  Voice:  Welcome + Fake Alert loaded`);
        console.log('='.repeat(55));
    });
}

start();

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' is already in use.');
        process.exit(1);
    }
    console.error('Server error:', err.message);
});

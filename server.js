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
        return true;
    } catch (e) { return false; }
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
        tiktokLikes: "50K"
    },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", screenshot: IMAGES.official, verified: true },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: null, verified: true }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger, reason: "Copies official content. Requests money from followers." },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers." }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#09090b">
<title>${DATA.celebrity.fullName} | Official Verification</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065' },
        dark: { 950:'#09090b',900:'#101014',850:'#141418',800:'#18181c',700:'#1f1f23',600:'#27272b',500:'#2e2e32',400:'#39393d' },
        accent: { purple:'#9333ea',pink:'#ec4899',blue:'#3b82f6',teal:'#14b8a6',green:'#22c55e',red:'#ef4444' }
      },
      fontFamily: { sans:['Inter','sans-serif'], heading:['Poppins','sans-serif'] },
      animation: { 'gradient-x':'gradient-x 3s ease infinite','pulse-slow':'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite','float':'float 6s ease-in-out infinite' },
      keyframes: { 'gradient-x':{'0%,100%':{'background-size':'200% 200%','background-position':'left center'},'50%':{'background-size':'200% 200%','background-position':'right center'}},'float':{'0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-10px)'}} },
      boxShadow: { glow:'0 0 15px rgba(139,92,246,0.5)','glow-sm':'0 0 5px rgba(139,92,246,0.3)','glow-green':'0 0 15px rgba(34,197,94,0.4)','glow-red':'0 0 15px rgba(239,68,68,0.4)' }
    }
  }
}
</script>
<style>
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:rgba(255,255,255,0.05);border-radius:3px}
::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.2);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:rgba(139,92,246,0.5)}
.gradient-text{background:linear-gradient(to right,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
.gradient-text-green{background:linear-gradient(to right,#22c55e,#16a34a);-webkit-background-clip:text;background-clip:text;color:transparent}
.gradient-text-red{background:linear-gradient(to right,#ef4444,#dc2626);-webkit-background-clip:text;background-clip:text;color:transparent}
.gradient-button{background:linear-gradient(to right,#9333ea,#ec4899);transition:all .3s ease;position:relative;z-index:1;box-shadow:0 4px 15px rgba(147,51,234,0.3)}
.gradient-button:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(147,51,234,0.4)}
.gradient-button-green{background:linear-gradient(to right,#22c55e,#16a34a);box-shadow:0 4px 15px rgba(34,197,94,0.3)}
.gradient-button-red{background:linear-gradient(to right,#ef4444,#dc2626);box-shadow:0 4px 15px rgba(239,68,68,0.3)}
.frosted-card{background:rgba(24,24,28,0.8)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:1.25rem;box-shadow:0 4px 30px rgba(0,0,0,0.1);border:1px solid rgba(255,255,255,0.05)}
.card-hover{transition:all .4s cubic-bezier(0.175,0.885,0.32,1.275);border:1px solid rgba(139,92,246,0.1);position:relative;z-index:1;overflow:hidden}
.card-hover:hover{transform:translateY(-3px);box-shadow:0 15px 30px -10px rgba(0,0,0,0.3);border-color:rgba(139,92,246,0.5)}
.card-hover-green{border:1px solid rgba(34,197,94,0.2)}.card-hover-green:hover{border-color:rgba(34,197,94,0.6);box-shadow:0 15px 30px -10px rgba(0,0,0,0.3),0 0 20px rgba(34,197,94,0.15)}
.card-hover-red{border:1px solid rgba(239,68,68,0.2)}.card-hover-red:hover{border-color:rgba(239,68,68,0.6);box-shadow:0 15px 30px -10px rgba(0,0,0,0.3),0 0 20px rgba(239,68,68,0.15)}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.fadeIn{animation:fadeIn .6s ease forwards}
.slideUp{animation:slideUp .5s ease forwards}
.pulse-dot{width:8px;height:8px;border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.7)}50%{opacity:0.7;box-shadow:0 0 0 10px rgba(34,197,94,0)}}
.verified-badge-anim{animation:pulse 2.5s infinite}
.spotify-bar-bg{background:rgba(255,255,255,0.1);border-radius:2px;height:3px;cursor:pointer}
.spotify-fill{background:linear-gradient(to right,#1db954,#169c46);border-radius:2px;height:100%;width:0;transition:width .1s}
.spotify-eq-bar{width:3px;background:#1db954;border-radius:1px;animation:eq .8s infinite}
@keyframes eq{0%,100%{height:4px}50%{height:14px}}
@media(max-width:768px){.resp-stack{flex-direction:column!important}}
</style>
</head>
<body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen">

<header class="fixed top-0 left-0 right-0 bg-dark-800/80 backdrop-blur-md border-b border-dark-600 z-50">
<div class="max-w-6xl mx-auto px-6">
<div class="flex justify-between items-center py-3">
<div class="flex items-center gap-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-9 h-9 rounded-full border-2 border-accent-purple object-cover" onerror="this.style.display='none'">
<h1 class="text-lg font-semibold gradient-text font-heading">Verification Hub</h1>
</div>
<div class="flex items-center gap-3">
<a href="#official" class="text-sm text-gray-400 hover:text-white transition">Official</a>
<a href="#fake" class="text-sm text-gray-400 hover:text-red-400 transition">Fake Alerts</a>
<a href="#music" class="text-sm text-gray-400 hover:text-green-400 transition">Music</a>
</div>
</div>
</div>
</header>

<main class="pt-20 pb-12">
<div class="max-w-5xl mx-auto px-6">

<section class="text-center mb-12 fadeIn">
<img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="w-28 h-28 rounded-full border-3 border-accent-purple object-cover mx-auto mb-5 shadow-glow" onerror="this.style.display='none'">
<h1 class="text-4xl font-bold gradient-text font-heading mb-2">${DATA.celebrity.fullName}</h1>
<p class="text-gray-400 mb-4">${DATA.celebrity.bio}</p>
<div class="flex justify-center gap-6 mb-5">
<div class="text-center"><div class="text-2xl font-bold">${DATA.celebrity.tiktokFollowers}</div><div class="text-xs text-gray-500 uppercase tracking-wider">Followers</div></div>
<div class="text-center"><div class="text-2xl font-bold">${DATA.celebrity.tiktokFollowing}</div><div class="text-xs text-gray-500 uppercase tracking-wider">Following</div></div>
<div class="text-center"><div class="text-2xl font-bold">${DATA.celebrity.tiktokLikes}</div><div class="text-xs text-gray-500 uppercase tracking-wider">Likes</div></div>
</div>
<div class="flex justify-center gap-3 flex-wrap">
<span class="px-4 py-1.5 bg-accent-green/10 text-accent-green border border-accent-green/30 rounded-full text-sm font-medium verified-badge-anim">Verified Official</span>
<span class="px-4 py-1.5 bg-accent-purple/10 text-accent-purple border border-accent-purple/30 rounded-full text-sm font-medium">Official Creator</span>
</div>
<div class="flex justify-center gap-3 mt-5">
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="px-5 py-2.5 bg-dark-800 border border-dark-600 rounded-full text-sm font-medium hover:border-white transition">TikTok</a>
<a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="px-5 py-2.5 bg-dark-800 border border-dark-600 rounded-full text-sm font-medium hover:border-white transition">Facebook</a>
</div>
</section>

<section id="official" class="mb-10 slideUp">
<div class="flex items-center gap-3 mb-5">
<div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center text-accent-green text-lg font-bold">&#10003;</div>
<h2 class="text-xl font-bold font-heading">Official Verified Account</h2>
</div>
<div class="frosted-card card-hover-green p-6">
<div class="flex items-center gap-3 mb-5">
<div class="w-10 h-10 rounded-full bg-gradient-to-r from-accent-green to-green-600 flex items-center justify-center text-white font-bold verified-badge-anim">&#10003;</div>
<div><h3 class="font-bold text-white">The Only Authentic Account</h3><p class="text-xs text-gray-400">Identity Verified</p></div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
<div class="space-y-2">
<div class="flex justify-between bg-dark-700/50 rounded-lg px-4 py-2.5 text-sm"><span class="text-gray-400 uppercase text-xs tracking-wider">TikTok</span><span class="font-medium">@baiillamaach_official</span></div>
<div class="flex justify-between bg-dark-700/50 rounded-lg px-4 py-2.5 text-sm"><span class="text-gray-400 uppercase text-xs tracking-wider">Facebook</span><span class="font-medium">Baiilla Maach Official</span></div>
<div class="flex justify-between bg-dark-700/50 rounded-lg px-4 py-2.5 text-sm"><span class="text-gray-400 uppercase text-xs tracking-wider">Followers</span><span class="font-medium">5,000</span></div>
<div class="flex justify-between bg-dark-700/50 rounded-lg px-4 py-2.5 text-sm"><span class="text-gray-400 uppercase text-xs tracking-wider">Status</span><span class="font-medium text-accent-green">Active & Verified</span></div>
</div>
<div class="bg-dark-700/50 rounded-xl p-5 text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-16 h-16 rounded-full border-2 border-accent-green mx-auto mb-3" onerror="this.style.display='none'">
<div class="font-bold">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok | Facebook</div>
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="inline-block px-5 py-2.5 gradient-button-green text-white rounded-full text-sm font-bold">Follow Official Account</a>
</div>
</div>
</div>
</section>

<section id="fake" class="mb-10 slideUp" style="animation-delay:.2s">
<div class="flex items-center gap-3 mb-5">
<div class="w-10 h-10 rounded-lg bg-accent-red/20 flex items-center justify-center text-accent-red text-lg font-bold">!</div>
<h2 class="text-xl font-bold font-heading">Fake Accounts Detected</h2>
</div>
<div class="bg-dark-800/80 border border-accent-red/30 rounded-2xl p-5 mb-4">
<div class="flex items-center gap-3 bg-dark-700/50 rounded-xl px-4 py-3 border border-accent-red/20">
<div class="w-10 h-10 rounded-full bg-gradient-to-r from-accent-red to-red-600 flex items-center justify-center text-white font-bold flex-shrink-0">!</div>
<div><h4 class="font-bold text-red-400">${totalFake} Fake Account${totalFake>1?'s':''} Found</h4><p class="text-xs text-gray-400">Not affiliated with Baiilla Maach. Report immediately.</p></div>
</div>
</div>

<div class="relative overflow-hidden rounded-xl" id="fakeCarousel">
<div class="flex transition-transform duration-500" id="fakeTrack">
${DATA.fakeAccounts.map((a,i)=>`
<div class="min-w-full px-1">
<div class="frosted-card card-hover-red p-5 relative overflow-hidden">
<div class="flex justify-between items-center mb-4"><div class="flex items-center gap-2"><span class="text-red-400 font-bold">!</span><span class="font-bold text-red-300">Fake Account #${i+1}</span></div><span class="px-2.5 py-1 bg-red-500/20 text-red-400 text-xs rounded-full font-bold uppercase">Dangerous</span></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div class="relative rounded-lg overflow-hidden border-2 border-red-500/30">
${a.screenshot?`<img src="${a.screenshot}" alt="" class="w-full" loading="lazy">`:''}
<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span class="bg-red-500/80 text-white px-3 py-1 rounded-lg text-xs font-bold">FAKE</span></div>
</div>
<div class="space-y-2">
<div class="flex justify-between bg-dark-700/50 rounded-lg px-3 py-2 text-xs"><span class="text-gray-400">Platform</span><span class="text-red-300 font-medium">${a.platform}</span></div>
<div class="flex justify-between bg-dark-700/50 rounded-lg px-3 py-2 text-xs"><span class="text-gray-400">Username</span><span class="text-red-300 font-medium">${a.username}</span></div>
<div class="flex justify-between bg-dark-700/50 rounded-lg px-3 py-2 text-xs"><span class="text-gray-400">Status</span><span class="text-red-300 font-medium">Active Threat</span></div>
<div class="bg-dark-700/30 rounded-lg p-2.5 text-xs text-red-300 border border-red-500/20">${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-4">
<a href="${a.profileUrl}" target="_blank" rel="noopener" class="flex-1 text-center px-4 py-2.5 gradient-button-red text-white rounded-full text-xs font-bold">Report</a>
<button class="flex-1 px-4 py-2.5 bg-dark-700 border border-red-500/30 text-red-300 rounded-full text-xs font-bold copy-btn" data-username="${a.username}">Copy Username</button>
</div>
</div>
</div>
`).join('')}
</div>
</div>

<div class="flex justify-center items-center gap-3 mt-4">
<button class="w-9 h-9 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center text-sm hover:bg-red-500/20 hover:border-red-500 transition" onclick="moveCarousel(-1)">&#9664;</button>
<div class="flex gap-2">${DATA.fakeAccounts.map((_,i)=>`<button class="w-2 h-2 rounded-full ${i===0?'bg-red-500 w-5':'bg-dark-600'} transition-all" onclick="goSlide(${i})"></button>`).join('')}</div>
<button class="w-9 h-9 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center text-sm hover:bg-red-500/20 hover:border-red-500 transition" onclick="moveCarousel(1)">&#9654;</button>
</div>

<div class="frosted-card p-4 mt-4 flex items-center gap-3 cursor-pointer hover:border-accent-purple/50 transition" onclick="document.getElementById('fakeVoicePlayer').play()">
<div class="w-10 h-10 rounded-full bg-gradient-to-r from-accent-purple to-accent-pink flex items-center justify-center text-white text-sm">&#9654;</div>
<div><p class="text-sm font-medium">Verify Voice: 7 lak like but its fake</p><p class="text-xs text-gray-400">Click to play warning voice</p></div>
<audio id="fakeVoicePlayer" src="${VOICE.fakeAlert}" preload="none"></audio>
</div>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="mb-10 slideUp" style="animation-delay:.4s">
<div class="flex items-center gap-3 mb-5">
<div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 text-lg">&#9835;</div>
<h2 class="text-xl font-bold font-heading">Cover Music</h2>
</div>
<div class="frosted-card overflow-hidden">
<div class="flex resp-stack gap-4 p-5 bg-gradient-to-r from-dark-800 to-dark-700">
<div class="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-dark-600 flex items-center justify-center text-4xl" id="npCover">&#9835;</div>
<div class="flex-1 flex flex-col justify-center">
<div class="text-lg font-bold text-white" id="npTitle">Select a song</div>
<div class="text-sm text-gray-400 mb-3" id="npArtist">Cover Songs</div>
<div class="mb-3">
<div class="spotify-bar-bg" id="progressBar"><div class="spotify-fill" id="progressFill"></div></div>
<div class="flex justify-between text-xs text-gray-500 mt-1"><span id="curTime">0:00</span><span id="totTime">0:00</span></div>
</div>
<div class="flex items-center gap-3">
<button class="text-gray-400 hover:text-white transition" onclick="prevSong()">&#9664;&#9664;</button>
<button class="w-10 h-10 rounded-full bg-white text-dark-900 flex items-center justify-center font-bold hover:scale-105 transition" id="ppBtn" onclick="togglePlay()"><span id="ppIcon">&#9654;</span></button>
<button class="text-gray-400 hover:text-white transition" onclick="nextSong()">&#9654;&#9654;</button>
<input type="range" id="volSlider" min="0" max="100" value="70" onchange="setVol(this.value)" class="w-20 h-1 accent-green-500 cursor-pointer">
</div>
</div>
</div>
<div class="max-h-72 overflow-y-auto">
<div class="sticky top-0 bg-dark-800 px-5 py-2.5 border-b border-dark-600 flex justify-between text-sm"><span class="font-bold text-white">Playlist</span><span class="text-gray-400">${coverSongs.length} songs</span></div>
${coverSongs.map((s,i)=>`
<div class="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-dark-700/50 transition border-b border-dark-700/30 spotify-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl||''}" onclick="playSong(${i})">
<span class="text-xs text-gray-500 w-6">${(i+1).toString().padStart(2,'0')}</span>
<div class="w-9 h-9 rounded-md overflow-hidden bg-dark-600 flex-shrink-0 flex items-center justify-center text-sm">${s.coverUrl?`<img src="${s.coverUrl}" alt="" class="w-full h-full object-cover">`:'&#9835;'}</div>
<div class="flex-1 min-w-0"><div class="text-sm font-medium text-white truncate">${s.title}</div><div class="text-xs text-gray-400">Cover Song</div></div>
<div class="spotify-eq hidden gap-0.5 items-end h-3"><span class="spotify-eq-bar" style="animation-delay:0s"></span><span class="spotify-eq-bar" style="animation-delay:.2s"></span><span class="spotify-eq-bar" style="animation-delay:.4s"></span><span class="spotify-eq-bar" style="animation-delay:.6s"></span></div>
</div>`).join('')}
</div>
</div>
</section>` : ''}

${galleryPhotos.length > 0 ? `
<section class="mb-10 slideUp">
<div class="flex items-center gap-3 mb-5">
<div class="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center text-accent-purple text-lg">&#9638;</div>
<h2 class="text-xl font-bold font-heading">Gallery</h2>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
${galleryPhotos.map(p=>`
<div class="rounded-xl overflow-hidden bg-dark-800 border border-dark-600 card-hover">
<img src="${p.path}" alt="" class="w-full" loading="lazy">
${p.caption?`<p class="px-3 py-2 text-xs text-gray-400 text-center">${p.caption}</p>`:''}
</div>`).join('')}
</div>
</section>` : ''}

</div>
</main>

<footer class="text-center py-8 border-t border-dark-700">
<p class="text-sm text-gray-500">&copy; ${DATA.celebrity.fullName} &middot; Official Verification Hub</p>
</footer>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>
<audio id="audioPlayer" preload="none"></audio>

<script>
(function(){
const wv=document.getElementById('welcomeVoice');
let played=sessionStorage.getItem('welcomePlayed');
if(!played){setTimeout(()=>{wv.play().catch(()=>{});sessionStorage.setItem('welcomePlayed','1')},1500)}
})();

let curSlide=0,totalSlides=${totalFake},track=document.getElementById('fakeTrack'),dots=document.querySelectorAll('.carousel-nav button.w-2'),auto;
function updCarousel(){track.style.transform='translateX(-'+(curSlide*100)+'%)';document.querySelectorAll('.carousel-nav button.w-2').forEach((d,i)=>d.classList.toggle('bg-red-500',i===curSlide));document.querySelectorAll('.carousel-nav button.w-2').forEach((d,i)=>d.classList.toggle('w-5',i===curSlide))}
function moveCarousel(d){curSlide=(curSlide+d+totalSlides)%totalSlides;updCarousel();clearInterval(auto);auto=setInterval(()=>moveCarousel(1),5000)}
function goSlide(i){curSlide=i;updCarousel();clearInterval(auto);auto=setInterval(()=>moveCarousel(1),5000)}
auto=setInterval(()=>moveCarousel(1),5000);
let tx=0;track.parentElement.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX});
track.parentElement.addEventListener('touchend',e=>{const d=tx-e.changedTouches[0].screenX;if(Math.abs(d)>35)moveCarousel(d>0?1:-1)});

document.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',function(){navigator.clipboard.writeText(this.dataset.username).then(()=>{this.textContent='Copied!';this.classList.add('bg-green-500/20','text-green-400','border-green-500');setTimeout(()=>{this.textContent='Copy Username';this.classList.remove('bg-green-500/20','text-green-400','border-green-500')},2000)})}));

let cur=-1,pl=false,ap=document.getElementById('audioPlayer'),items=document.querySelectorAll('.spotify-item');
function loadSong(i){
if(!items.length||i<0||i>=items.length)return;if(cur===i)return;
cur=i;const it=items[i];ap.src=it.dataset.audio;ap.load();
document.getElementById('npTitle').textContent=it.querySelector('.text-sm').textContent;
document.getElementById('npArtist').textContent=it.querySelector('.text-xs').textContent;
const cc=document.getElementById('npCover');
if(it.dataset.cover){cc.innerHTML='<img src="'+it.dataset.cover+'" alt="" class="w-full h-full object-cover">'}else{cc.innerHTML='&#9835;'}
document.querySelectorAll('.spotify-item').forEach(el=>el.classList.remove('bg-green-500/10'));it.classList.add('bg-green-500/10');
document.querySelectorAll('.spotify-eq').forEach(el=>el.classList.add('hidden'));it.querySelector('.spotify-eq').classList.remove('hidden');
document.getElementById('progressFill').style.width='0%';document.getElementById('curTime').textContent='0:00';document.getElementById('totTime').textContent='0:00';
ap.play().then(()=>{pl=true;updPP()}).catch(e=>{alert('Cannot play audio');pl=false;updPP()});
}
function playSong(i){if(i===cur)togglePlay();else loadSong(i)}
function togglePlay(){if(!ap.src&&items.length>0){loadSong(0);return}if(pl){ap.pause();pl=false}else{ap.play().then(()=>{pl=true}).catch(()=>{})}updPP()}
function updPP(){document.getElementById('ppIcon').innerHTML=pl?'&#9646;&#9646;':'&#9654;'}
function nextSong(){if(items.length)loadSong((cur+1)%items.length)}
function prevSong(){if(items.length)loadSong(cur<=0?items.length-1:cur-1)}
function setVol(v){ap.volume=v/100}
ap.addEventListener('timeupdate',()=>{if(ap.duration){document.getElementById('progressFill').style.width=(ap.currentTime/ap.duration)*100+'%';const m=Math.floor(ap.currentTime/60),s=Math.floor(ap.currentTime%60);document.getElementById('curTime').textContent=m+':'+s.toString().padStart(2,'0')}});
ap.addEventListener('loadedmetadata',()=>{const m=Math.floor(ap.duration/60),s=Math.floor(ap.duration%60);document.getElementById('totTime').textContent=m+':'+s.toString().padStart(2,'0')});
ap.addEventListener('ended',()=>{pl=false;updPP();nextSong()});
ap.addEventListener('error',()=>{alert('Audio file error');pl=false;updPP()});
document.getElementById('progressBar').addEventListener('click',e=>{const r=e.target.getBoundingClientRect();ap.currentTime=((e.clientX-r.left)/r.width)*ap.duration});
ap.volume=.7;
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899'}}}}} </script></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 flex items-center justify-center min-h-screen font-sans"><div class="bg-dark-800/80 backdrop-blur-md border border-dark-600 rounded-2xl p-10 w-full max-w-md shadow-xl"><h2 class="text-2xl font-bold text-center gradient-text mb-8">Admin Login</h2>${error?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-center text-sm">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="mb-5"><label class="block text-gray-400 text-sm font-medium mb-2">Username</label><input type="text" name="username" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition" required></div><div class="mb-6"><label class="block text-gray-400 text-sm font-medium mb-2">Password</label><input type="password" name="password" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition" required></div><button type="submit" class="w-full py-3 gradient-button text-white rounded-lg font-bold">Login</button></form><div class="text-center mt-6"><a href="/" class="text-sm text-gray-500 hover:text-white transition">Back to Home</a></div></div></body></html>`;
}

function getAdminPanelHTML(photos = [], msg = '', err = '') {
    const phtml = photos.map(p => `<div class="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden card-hover"><img src="${p.path}" class="w-full h-48 object-cover"><div class="p-3">${p.caption?`<p class="text-sm text-gray-300">${p.caption}</p>`:''}<p class="text-xs text-gray-500 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${p._id}"><button class="w-full py-2 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition" onclick="return confirm('Delete?')">Delete</button></form></div>`).join('');
    return `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={darkMode:'class',theme:{extend:{colors:{dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444'}}}}} </script><style>.gradient-text{background:linear-gradient(to right,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}.gradient-button{background:linear-gradient(to right,#9333ea,#ec4899)}.card-hover{transition:all .3s}.card-hover:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(0,0,0,.3)}</style></head><body class="bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850 text-gray-200 font-sans min-h-screen"><header class="bg-dark-800/80 backdrop-blur-md border-b border-dark-600"><div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center"><h2 class="text-xl font-bold gradient-text">Admin Panel</h2><div class="flex gap-3"><a href="/" class="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm hover:border-white transition">Home</a><a href="/admin/logout" class="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm hover:border-red-500 transition">Logout</a></div></div></header><div class="max-w-6xl mx-auto px-6 py-8">${msg?`<div class="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg mb-6">${msg}</div>`:''}${err?`<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6">${err}</div>`:''}<div class="bg-dark-800/80 backdrop-blur-md border border-dark-600 rounded-2xl p-8 mb-8"><h3 class="text-lg font-bold mb-5">Upload Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="mb-4"><label class="block text-gray-400 text-sm font-medium mb-2">Select Photo</label><input type="file" name="photo" accept="image/*" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent-purple file:text-white file:font-bold" required></div><div class="mb-5"><label class="block text-gray-400 text-sm font-medium mb-2">Caption</label><input type="text" name="caption" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-purple transition"></div><button type="submit" class="px-6 py-3 gradient-button text-white rounded-lg font-bold">Upload</button></form></div><h3 class="text-xl font-bold mb-5">Gallery (${photos.length})</h3>${photos.length?`<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">${phtml}</div>`:'<p class="text-gray-500 text-center py-12">No photos uploaded yet</p>'}</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    if (pathname.startsWith('/assets/')) {
        const decodedPathname = decodeURIComponent(pathname);
        const assetPath = path.join(__dir, decodedPathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac' };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, { 'Content-Type':ct, 'Content-Length':stat.size, 'Cache-Control':'public, max-age=86400', 'Accept-Ranges':'bytes' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    if (pathname === '/admin' && req.method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p)); return; }
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML()); return;
    }

    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'),params.get('password'))) {
                const sid = createSession(params.get('username'));
                res.writeHead(302,{'Location':'/admin','Set-Cookie':`sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`}); res.end();
            } else { res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML('Invalid credentials')); }
        }); return;
    }

    if (pathname === '/admin/logout') { sessions.delete(cookies.sessionId); res.writeHead(302,{'Location':'/admin','Set-Cookie':'sessionId=;HttpOnly;Path=/;Max-Age=0'}); res.end(); return; }

    if (pathname === '/admin/upload' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir:GALLERY_DIR, keepExtensions:true, maxFileSize:10*1024*1024 });
        form.parse(req, async (err, fields, files) => {
            if (err) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Upload error')); return; }
            const pf = Array.isArray(files.photo)?files.photo[0]:files.photo;
            if (!pf||!pf.originalFilename) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','No file')); return; }
            if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(path.extname(pf.originalFilename).toLowerCase())) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Invalid format')); return; }
            const fn = Date.now()+'_'+pf.originalFilename.replace(/[^a-zA-Z0-9.]/g,'_');
            try {
                fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                await savePhoto({ path:'/assets/gallery/'+fn, caption:fields.caption?(Array.isArray(fields.caption)?fields.caption[0]:fields.caption):'' });
                const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Uploaded'));
            } catch(e) { const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'','Save error')); }
        }); return;
    }

    if (pathname === '/admin/delete' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            try { const photo = await db.collection('gallery_photos').findOne({_id:new ObjectId(params.get('photoId'))}); if(photo){const fp=path.join(__dir,photo.path);if(fs.existsSync(fp))fs.unlinkSync(fp);} await deletePhoto(params.get('photoId')); } catch(e){}
            const p = await getGalleryPhotos(); res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminPanelHTML(p,'Deleted'));
        }); return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=3600'});
        res.end(getMainHTML(photos));
        return;
    }

    res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-dark-950 flex items-center justify-center h-screen text-white font-sans"><div class="text-center"><h1 class="text-8xl font-bold text-accent-purple">404</h1><p class="text-gray-400 mt-2">Page not found</p><a href="/" class="inline-block mt-4 px-5 py-2 bg-accent-purple text-white rounded-lg">Home</a></div></body></html>`);
});

async function start() {
    await connectDB();
    server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
}

start();
server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });

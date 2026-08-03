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
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');

[ASSETS_DIR, GALLERY_DIR, CHAT_UPLOADS_DIR, COVER_MUSIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/tiktok_video_Aj2NO.jpeg",
    tiktokSS: "/orginalss.png",
    facebookSS: "/real-id-ss.png",
    fakeAccount1: "/hammadfams.png",
    fakeAccount2: "/baillamach.png",
    fakeDetect: "/Fakedetect.png",
    tiktokIcon: "/tiktokicon.png",
    facebookIcon: "/communication.png",
    messageIcon: "/messageicon.gif",
    reportIcon: "/report.png",
    verifiedBadge: "/social-media.png",
    microphoneIcon: "/microphone-in-hand.gif",
    musicIcon: "/music-icon.png",
    flagIcon: "/flag.png",
    checkMark: "/check-mark.png",
    fbProfile: "/fb_profile.jpg"
};

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus', '.weba'];
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
                title: base.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${v.audio}`,
                coverUrl: v.cover ? `/assets/covermusic/${v.cover}` : null
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
        const exists = await admins.findOne({ username: 'admin' });
        if (!exists) await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        try { await db.collection('chat_messages').createIndex({ timestamp: -1 }); } catch(e) {}
        try { await db.collection('chat_messages').createIndex({ room: 1 }); } catch(e) {}
        return true;
    } catch (e) { return false; }
}

async function getGalleryPhotos() {
    if (!db) return [];
    try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); }
    catch (e) { return []; }
}

async function savePhoto(d) {
    if (!db) return null;
    return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() });
}

async function deletePhoto(id) {
    if (!db) return null;
    return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
}

async function getChatMessages(room, limit) {
    if (!db) return [];
    room = room || 'general';
    limit = limit || 50;
    try { return await db.collection('chat_messages').find({ room: room }).sort({ timestamp: -1 }).limit(limit).toArray(); }
    catch (e) { return []; }
}

async function saveChatMessage(message) {
    if (!db) return null;
    try { return await db.collection('chat_messages').insertOne({ ...message, timestamp: new Date() }); }
    catch (e) { return null; }
}

async function deleteChatMessage(id) {
    if (!db) return null;
    try { return await db.collection('chat_messages').deleteOne({ _id: new ObjectId(id) }); }
    catch (e) { return null; }
}

async function verifyAdmin(u, p) {
    if (!db) return u === 'admin' && p === 'admin123';
    const a = await db.collection('admin_users').findOne({ username: u });
    if (!a) return false;
    return await bcrypt.compare(p, a.password);
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: "/tiktok_video_Aj2NO.jpeg",
        bio: "Official Entertainment Profile | Singer & Content Creator",
        username: "@baiillamaach_official",
        followers: "50K+",
        totalPosts: "200+",
        verifiedSince: "2023"
    },
    realAccounts: [
        { 
            platform: "TikTok", 
            username: "@baiillamaach_official", 
            url: "https://tiktok.com/@baiillamaach_official", 
            screenshot: "/orginalss.png",
            icon: "/tiktokicon.png",
            followers: "45.2K",
            verified: true
        },
        { 
            platform: "Facebook", 
            username: "Baiilla Maach Official", 
            url: "https://www.facebook.com/profile.php?id=61575202118828", 
            screenshot: "/real-id-ss.png",
            icon: "/communication.png",
            followers: "12.8K",
            verified: true
        }
    ],
    fakeAccounts: [
        { 
            platform: "TikTok", 
            username: "@baiilla_mach", 
            profileUrl: "https://tiktok.com/@baiilla_mach", 
            screenshot: "/baillamach.png", 
            reason: "Copies official logo and content to deceive followers.",
            reportCount: 45,
            dateDetected: "2024-01-15"
        },
        { 
            platform: "TikTok", 
            username: "@hammad_fams0", 
            profileUrl: "https://tiktok.com/@hammad_fams0", 
            screenshot: "/hammadfams.png", 
            reason: "Uses official name and photo to mislead followers.",
            reportCount: 32,
            dateDetected: "2024-02-20"
        }
    ]
};

const sessions = new Map();
const onlineUsers = new Map();

function createSession(u) { 
    const id = crypto.randomBytes(32).toString('hex'); 
    sessions.set(id, { username: u, createdAt: Date.now() }); 
    setTimeout(function() { sessions.delete(id); }, 7200000); 
    return id; 
}

function getSession(id) { 
    const s = sessions.get(id); 
    if (!s) return null; 
    if (Date.now() - s.createdAt > 7200000) { 
        sessions.delete(id); 
        return null; 
    } 
    return s; 
}

function parseCookies(h) { 
    const c = {}; 
    if (h) {
        h.split(';').forEach(function(x) { 
            const p = x.split('='); 
            c[p[0].trim()] = p[1] ? p[1].trim() : ''; 
        }); 
    }
    return c; 
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getMainHTML(galleryPhotos, chatMessages) {
    galleryPhotos = galleryPhotos || [];
    chatMessages = chatMessages || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const onlineCount = onlineUsers.size;
    let coverSongsHTML = '';
    if (coverSongs.length > 0) {
        coverSongsHTML += '<section class="section music-section" data-animate>';
        coverSongsHTML += '<div class="section-header">';
        coverSongsHTML += '<div class="section-icon spotify-icon-bg">';
        coverSongsHTML += '<img src="/microphone-in-hand.gif" width="22" height="22" alt="Music" style="border-radius:50%;">';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<h2 class="section-heading">🎵 Cover Music Collection</h2>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<div class="spotify-player">';
        coverSongsHTML += '<div class="spotify-now-playing">';
        coverSongsHTML += '<div class="spotify-album-art" id="nowPlayingCover">';
        coverSongsHTML += '<img src="/music-icon.png" width="150" height="150" alt="Default Music">';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<div class="spotify-track-info">';
        coverSongsHTML += '<div class="spotify-track-name" id="nowPlayingTitle">Select a Song</div>';
        coverSongsHTML += '<div class="spotify-track-artist" id="nowPlayingArtist">Cover Songs Collection</div>';
        coverSongsHTML += '<div class="spotify-progress">';
        coverSongsHTML += '<div class="spotify-progress-bar" id="progressBar" onclick="seekAudio(event)">';
        coverSongsHTML += '<div class="spotify-progress-fill" id="progressFill"></div>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<div class="spotify-time">';
        coverSongsHTML += '<span id="currentTime">0:00</span>';
        coverSongsHTML += '<span id="totalTime">0:00</span>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<div class="spotify-controls">';
        coverSongsHTML += '<button class="spotify-btn" onclick="prevSong()">⏮️</button>';
        coverSongsHTML += '<button class="spotify-btn spotify-play-btn" id="playPauseBtn" onclick="togglePlay()">▶️</button>';
        coverSongsHTML += '<button class="spotify-btn" onclick="nextSong()">⏭️</button>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<div class="spotify-volume">🔊 <input type="range" id="volumeSlider" min="0" max="100" value="70" onchange="setVol(this.value)" class="spotify-volume-slider"></div>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '<div class="spotify-playlist-container">';
        coverSongsHTML += '<div class="spotify-playlist-header"><h3>Playlist</h3><span class="spotify-song-count">' + coverSongs.length + ' songs</span></div>';
        coverSongsHTML += '<div class="spotify-playlist" id="playlist">';
        for (let i = 0; i < coverSongs.length; i++) {
            const s = coverSongs[i];
            const coverUrl = s.coverUrl || '/music-icon.png';
            coverSongsHTML += '<div class="spotify-playlist-item" data-index="' + i + '" data-audio="' + escapeHTML(s.audioUrl) + '" data-cover="' + escapeHTML(coverUrl) + '" onclick="playSong(' + i + ')">';
            coverSongsHTML += '<div class="spotify-track-number">' + (i+1).toString().padStart(2,'0') + '</div>';
            coverSongsHTML += '<div class="spotify-track-cover-small"><img src="' + escapeHTML(coverUrl) + '" alt="' + escapeHTML(s.title) + '" loading="lazy"></div>';
            coverSongsHTML += '<div class="spotify-track-details">';
            coverSongsHTML += '<div class="spotify-track-title">' + escapeHTML(s.title) + '</div>';
            coverSongsHTML += '<div class="spotify-track-artist-small">' + escapeHTML(s.artist) + '</div>';
            coverSongsHTML += '</div>';
            coverSongsHTML += '</div>';
        }
        coverSongsHTML += '</div>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '</div>';
        coverSongsHTML += '</section>';
    }
    let galleryHTML = '';
    if (galleryPhotos.length > 0) {
        galleryHTML += '<section class="section gallery-section" data-animate>';
        galleryHTML += '<div class="section-header">';
        galleryHTML += '<div class="section-icon gallery-icon-bg">📸</div>';
        galleryHTML += '<h2 class="section-heading">Official Gallery</h2>';
        galleryHTML += '</div>';
        galleryHTML += '<div class="gallery-grid">';
        for (let i = 0; i < galleryPhotos.length; i++) {
            const p = galleryPhotos[i];
            galleryHTML += '<div class="gallery-card" onclick="openGalleryLightbox(' + i + ')">';
            galleryHTML += '<div class="gallery-card-inner">';
            galleryHTML += '<img src="' + escapeHTML(p.path) + '" alt="' + escapeHTML(p.caption || 'Gallery') + '" class="gallery-image" loading="lazy">';
            galleryHTML += '<div class="gallery-card-overlay">🔍</div>';
            galleryHTML += '</div>';
            if (p.caption) {
                galleryHTML += '<p class="gallery-caption">' + escapeHTML(p.caption) + '</p>';
            }
            galleryHTML += '</div>';
        }
        galleryHTML += '</div>';
        galleryHTML += '</section>';
        galleryHTML += '<div class="lightbox" id="galleryLightbox">';
        galleryHTML += '<button class="lightbox-close" onclick="closeGalleryLightbox()">✕</button>';
        galleryHTML += '<button class="lightbox-nav lightbox-prev" onclick="navigateGallery(-1)">◀</button>';
        galleryHTML += '<img class="lightbox-image" id="lightboxImage" src="" alt="">';
        galleryHTML += '<button class="lightbox-nav lightbox-next" onclick="navigateGallery(1)">▶</button>';
        galleryHTML += '</div>';
    }
    let chatDisplayHTML = '';
    const displayMessages = chatMessages.slice().reverse();
    for (let i = 0; i < displayMessages.length; i++) {
        const msg = displayMessages[i];
        chatDisplayHTML += '<div class="chat-message">';
        chatDisplayHTML += '<div class="message-header">';
        chatDisplayHTML += '<span class="message-sender">' + escapeHTML(msg.sender || 'Anonymous') + '</span>';
        chatDisplayHTML += '<span class="message-time">' + new Date(msg.timestamp).toLocaleTimeString() + '</span>';
        chatDisplayHTML += '</div>';
        chatDisplayHTML += '<div class="message-content">' + escapeHTML(msg.text || '') + '</div>';
        if (msg.file) {
            chatDisplayHTML += '<div class="message-file"><a href="' + escapeHTML(msg.file) + '" target="_blank">📎 Attachment</a></div>';
        }
        chatDisplayHTML += '</div>';
    }
    let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description" content="Official Verification Hub for Baiilla Maach. Identify real vs fake accounts."><meta name="theme-color" content="#ff0050"><title>' + escapeHTML(DATA.celebrity.fullName) + ' | Official Verification Hub</title>';
    html += '<style>:root{--bg:#ffffff;--bg-secondary:#f8fafc;--text:#0f172a;--text-secondary:#475569;--text-muted:#94a3b8;--border:#e2e8f0;--shadow:0 1px 3px rgba(0,0,0,0.06);--shadow-md:0 4px 12px rgba(0,0,0,0.06);--shadow-lg:0 10px 30px rgba(0,0,0,0.08);--shadow-xl:0 20px 50px rgba(0,0,0,0.1);--green-50:#f0fdf4;--green-100:#dcfce7;--green-500:#22c55e;--green-600:#16a34a;--red-50:#fef2f2;--red-100:#fee2e2;--red-500:#ef4444;--red-600:#dc2626;--red-700:#b91c1c;--amber-50:#fffbeb;--amber-100:#fef3c7;--amber-600:#d97706;--blue-50:#eff6ff;--blue-100:#dbeafe;--blue-600:#2563eb;--blue-700:#1d4ed8;--pink:#ff0050;--cyan:#00f2ea;--fb:#1877f2;--spotify:#1db954;--spotify-black:#191414;--radius:12px;--radius-lg:16px;--radius-xl:20px;--radius-2xl:24px}*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}body{font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden}@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse-green{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 16px rgba(34,197,94,0)}}@keyframes pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}@keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-10px)}}@keyframes onlinePulse{0%,100%{opacity:1}50%{opacity:0.5}}[data-animate]{opacity:0}[data-animate].animated{animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards}.scroll-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--pink),var(--cyan),var(--green-500));z-index:10001;transition:width 0.1s}.navbar{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:14px 0}.navbar .container{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between}.navbar-brand{display:flex;align-items:center;gap:12px}.navbar-logo-img{width:40px;height:40px;border-radius:50%;border:2px solid var(--pink);object-fit:cover;box-shadow:0 2px 8px rgba(255,0,80,0.2)}.navbar-logo-text{font-weight:700;font-size:1.1em;color:var(--text)}.navbar-status{display:flex;align-items:center;gap:8px;font-size:0.85em;font-weight:600}.online-dot{width:8px;height:8px;border-radius:50%;background:var(--green-500);animation:onlinePulse 2s infinite}.verified-badge-small{display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,var(--green-500),var(--green-600));color:white;padding:4px 12px;border-radius:20px;font-size:0.75em}.verified-badge-small img{width:14px;height:14px}.container{max-width:1100px;margin:0 auto;padding:0 24px}.hero{padding:50px 0 36px;text-align:center;position:relative}.hero-img{width:130px;height:130px;border-radius:50%;border:4px solid var(--pink);object-fit:cover;box-shadow:0 0 0 8px rgba(255,0,80,0.1),0 8px 32px rgba(0,0,0,0.12);margin-bottom:20px;animation:float 3s ease-in-out infinite}.hero-name{font-size:2.6em;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;background:linear-gradient(135deg,#ff0050,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.hero-bio{font-size:1.1em;color:var(--text-secondary);margin-bottom:8px}.hero-stats{display:flex;gap:24px;justify-content:center;margin:20px 0;flex-wrap:wrap}.hero-stat{text-align:center}.hero-stat-value{font-size:1.5em;font-weight:800;color:var(--pink)}.hero-stat-label{font-size:0.75em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px}.hero-badges{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}.badge{padding:8px 20px;border-radius:22px;font-size:0.85em;font-weight:600;letter-spacing:0.2px}.badge-verified{background:linear-gradient(135deg,var(--green-500),var(--green-600));color:white;animation:pulse-green 2.5s infinite;display:flex;align-items:center;gap:5px}.badge-verified img{width:16px;height:16px}.badge-fun{background:linear-gradient(135deg,var(--pink),#ff6b00);color:white}.badge-music{background:linear-gradient(135deg,#8b5cf6,#6366f1);color:white}.hero-social{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.social-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 24px;border-radius:28px;text-decoration:none;font-weight:600;font-size:0.88em;transition:all 0.25s;border:2px solid transparent}.social-btn img{width:20px;height:20px}.social-btn.tiktok{background:#000;color:#fff}.social-btn.tiktok:hover{background:#fff;color:#000;border-color:#000;transform:translateY(-2px);box-shadow:var(--shadow-lg)}.social-btn.facebook{background:var(--fb);color:#fff}.social-btn.facebook:hover{background:#fff;color:var(--fb);border-color:var(--fb);transform:translateY(-2px);box-shadow:var(--shadow-lg)}.section{padding:36px 0}.section-header{display:flex;align-items:center;gap:10px;margin-bottom:24px}.section-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.3em}.verified-icon-bg{background:linear-gradient(135deg,var(--green-500),var(--green-600))}.danger-icon-bg{background:linear-gradient(135deg,var(--red-500),var(--red-600))}.compare-icon-bg{background:linear-gradient(135deg,#6366f1,#8b5cf6)}.warning-icon-bg{background:linear-gradient(135deg,#f59e0b,var(--amber-600))}.update-icon-bg{background:linear-gradient(135deg,#3b82f6,var(--blue-600))}.spotify-icon-bg{background:linear-gradient(135deg,var(--spotify),#169c46)}.gallery-icon-bg{background:linear-gradient(135deg,#6366f1,#a855f7)}.section-heading{font-size:1.4em;font-weight:700;letter-spacing:-0.2px}.official-card{background:linear-gradient(135deg,#f0fdf4 0%,#fff 50%,#dcfce7 100%);border:2px solid #bbf7d0;border-radius:var(--radius-2xl);padding:32px;position:relative;box-shadow:var(--shadow-xl)}.official-card::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--green-500),var(--green-600),var(--green-500));border-radius:var(--radius-2xl) var(--radius-2xl) 0 0}.official-card-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}.official-verify-icon{width:48px;height:48px;background:linear-gradient(135deg,var(--green-500),var(--green-600));border-radius:50%;display:flex;align-items:center;justify-content:center;animation:pulse-green 2.5s infinite;flex-shrink:0}.official-verify-icon img{width:24px;height:24px}.official-card-title h2{font-size:1.3em;font-weight:700;color:#15803d}.official-card-title span{font-size:0.85em;color:var(--green-600);font-weight:600}.official-card-body{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:700px){.official-card-body{grid-template-columns:1fr}}.official-info-list{display:flex;flex-direction:column;gap:10px}.official-info-item{background:#fff;border-radius:10px;padding:12px 16px;border:1px solid #dcfce7;display:flex;justify-content:space-between;align-items:center}.official-info-label{font-size:0.8em;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.3px}.official-info-value{font-weight:700;color:var(--text)}.official-preview{background:#fff;border-radius:var(--radius-xl);padding:24px;border:1px solid var(--border);text-align:center}.official-preview img{width:80px;height:80px;border-radius:50%;border:3px solid var(--green-500);margin-bottom:10px}.official-preview .uname{font-size:1.1em;font-weight:700}.official-preview .plat{font-size:0.8em;color:var(--text-secondary);margin:4px 0 16px}.btn-follow{display:inline-flex;align-items:center;gap:6px;padding:12px 28px;background:linear-gradient(135deg,var(--green-500),var(--green-600));color:#fff;border-radius:28px;text-decoration:none;font-weight:700;font-size:0.9em;transition:all 0.25s;box-shadow:0 4px 15px rgba(34,197,94,0.25)}.btn-follow:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(34,197,94,0.35)}.fake-section{background:var(--red-50);border:2px solid #fecaca;border-radius:var(--radius-2xl);padding:28px}.fake-alert{display:flex;align-items:center;gap:12px;background:#fff;padding:14px 18px;border-radius:var(--radius-lg);border:2px solid #fecaca;margin-bottom:20px}.fake-alert-icon{width:48px;height:48px;background:linear-gradient(135deg,var(--red-500),var(--red-600));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5em;animation:pulse-red 2s infinite;flex-shrink:0}.fake-alert-text h3{font-size:1.1em;font-weight:700;color:var(--red-700)}.fake-alert-text p{font-size:0.85em;color:var(--red-600)}.fake-card{background:#fff;border-radius:var(--radius-xl);border:2px solid #fecaca;padding:24px;margin-bottom:20px;position:relative}.fake-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}.fake-card-title{display:flex;align-items:center;gap:8px;font-size:1em;font-weight:700;color:var(--red-700)}.fake-card-badge{background:var(--red-500);color:#fff;padding:4px 14px;border-radius:16px;font-size:0.7em;font-weight:700;letter-spacing:0.8px;text-transform:uppercase}.fake-card-body{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:600px){.fake-card-body{grid-template-columns:1fr}}.fake-screenshot{position:relative;border-radius:var(--radius);overflow:hidden;border:3px solid #fecaca}.fake-screenshot img{width:100%;display:block}.fake-watermark{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;gap:6px}.fake-watermark span{background:rgba(239,68,68,0.85);color:#fff;padding:5px 14px;border-radius:14px;font-weight:800;font-size:0.8em;letter-spacing:1.5px}.fake-details{display:flex;flex-direction:column;gap:8px}.fake-detail-row{display:flex;justify-content:space-between;padding:8px 12px;background:var(--red-50);border-radius:8px;font-size:0.82em}.fake-detail-label{color:var(--red-600);font-weight:600}.fake-detail-value{color:var(--red-700);font-weight:700}.fake-reason{background:#fff;border:2px solid #fee2e2;border-radius:10px;padding:12px;margin-top:6px;font-size:0.82em;color:var(--red-700);line-height:1.5}.fake-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.btn-report{display:inline-flex;align-items:center;gap:5px;padding:10px 20px;background:linear-gradient(135deg,var(--red-500),var(--red-600));color:#fff;border-radius:22px;text-decoration:none;font-weight:700;font-size:0.82em;transition:all 0.25s;flex:1;justify-content:center;min-width:120px}.btn-report img{width:16px;height:16px}.btn-report:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(239,68,68,0.3)}.comparison-table-wrap{overflow-x:auto;border-radius:var(--radius-xl);border:1px solid var(--border);background:#fff;box-shadow:var(--shadow)}.comparison-table{width:100%;border-collapse:collapse;font-size:0.88em}.comparison-table th{background:#f1f5f9;padding:14px 16px;text-align:left;font-weight:700;border-bottom:2px solid var(--border)}.comparison-table td{padding:12px 16px;border-bottom:1px solid #f1f5f9}.comparison-table .col-official{background:#f0fdf4;border-left:3px solid var(--green-500)}.comparison-table .col-fake{background:#fef2f2;border-left:3px solid var(--red-500)}.check{color:var(--green-500);font-weight:700}.cross{color:var(--red-500);font-weight:700}.warning-section{background:#fffbeb;border:2px solid #fde68a;border-radius:var(--radius-2xl);padding:28px}.warning-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:16px}.warning-card{background:#fff;border-radius:var(--radius-lg);padding:20px;border:1px solid #fde68a;transition:all 0.25s}.warning-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}.warning-card-icon{font-size:2em;margin-bottom:10px}.warning-card h4{font-size:0.95em;font-weight:700;margin-bottom:4px}.warning-card p{font-size:0.82em;color:var(--text-secondary);line-height:1.5}.updates-section{background:#eff6ff;border:2px solid #bfdbfe;border-radius:var(--radius-2xl);padding:28px;text-align:center}.updates-section h3{font-size:1.1em;font-weight:700;color:var(--blue-700);margin-bottom:6px}.updates-section p{color:var(--blue-600);font-size:0.85em;margin-bottom:14px}.update-tags{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.update-tag{background:#fff;color:var(--blue-700);padding:6px 14px;border-radius:18px;font-size:0.78em;font-weight:600;border:1px solid #bfdbfe}.spotify-player{background:var(--spotify-black);border-radius:var(--radius-xl);overflow:hidden;box-shadow:var(--shadow-xl)}.spotify-now-playing{display:flex;gap:20px;padding:24px;background:linear-gradient(135deg,#282828,#191414)}@media(max-width:680px){.spotify-now-playing{flex-direction:column;align-items:center;text-align:center}}.spotify-album-art{width:150px;height:150px;border-radius:10px;overflow:hidden;flex-shrink:0;box-shadow:0 6px 24px rgba(0,0,0,0.4)}.spotify-album-art img{width:100%;height:100%;object-fit:cover}.spotify-track-info{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:180px}.spotify-track-name{font-size:1.3em;font-weight:700;color:#fff;margin-bottom:3px}.spotify-track-artist{font-size:0.85em;color:#b3b3b3;margin-bottom:16px}.spotify-progress{margin-bottom:14px}.spotify-progress-bar{width:100%;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;cursor:pointer;margin-bottom:5px}.spotify-progress-fill{height:100%;background:var(--spotify);border-radius:2px;width:0%;transition:width 0.1s linear}.spotify-time{display:flex;justify-content:space-between;font-size:0.68em;color:#b3b3b3}.spotify-controls{display:flex;align-items:center;gap:14px;margin-bottom:14px}.spotify-btn{background:none;border:none;color:#b3b3b3;cursor:pointer;padding:5px;border-radius:50%;transition:all 0.2s;display:flex;align-items:center;justify-content:center;font-size:1.2em}.spotify-btn:hover{color:#fff;transform:scale(1.1)}.spotify-play-btn{background:#fff;color:#191414;width:44px;height:44px;border-radius:50%}.spotify-play-btn:hover{transform:scale(1.08)}.spotify-volume{display:flex;align-items:center;gap:8px;color:#b3b3b3}.spotify-volume-slider{width:90px;height:3px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.2);border-radius:2px;outline:none;cursor:pointer}.spotify-volume-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer}.spotify-playlist-container{max-height:360px;overflow-y:auto}.spotify-playlist-header{padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#191414;z-index:1}.spotify-playlist-header h3{font-size:0.95em;font-weight:700;color:#fff}.spotify-song-count{font-size:0.75em;color:#b3b3b3}.spotify-playlist-item{display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;transition:all 0.2s;border-bottom:1px solid rgba(255,255,255,0.03)}.spotify-playlist-item:hover{background:rgba(255,255,255,0.05)}.spotify-playlist-item.active{background:rgba(29,185,84,0.1)}.spotify-track-number{font-size:0.8em;color:#b3b3b3;width:24px;text-align:center;font-weight:600}.spotify-track-cover-small{width:38px;height:38px;border-radius:5px;overflow:hidden;flex-shrink:0;background:#282828}.spotify-track-cover-small img{width:100%;height:100%;object-fit:cover}.spotify-track-details{flex:1;min-width:0}.spotify-track-title{font-weight:600;font-size:0.84em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.spotify-track-artist-small{font-size:0.72em;color:#b3b3b3}.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}.gallery-card{border-radius:var(--radius-xl);overflow:hidden;cursor:pointer;transition:all 0.3s;background:#fff;box-shadow:var(--shadow)}.gallery-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}.gallery-card-inner{position:relative;overflow:hidden}.gallery-image{width:100%;height:200px;object-fit:cover;display:block;transition:transform 0.4s}.gallery-card:hover .gallery-image{transform:scale(1.05)}.gallery-card-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;color:white;font-size:2em}.gallery-card:hover .gallery-card-overlay{opacity:1}.gallery-caption{padding:10px 14px;font-size:0.85em;color:var(--text-secondary);text-align:center;font-weight:500}.lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;display:none;align-items:center;justify-content:center}.lightbox.active{display:flex}.lightbox-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;z-index:10001;font-size:1.2em;display:flex;align-items:center;justify-content:center}.lightbox-close:hover{background:rgba(255,255,255,0.2)}.lightbox-image{max-width:90vw;max-height:85vh;object-fit:contain;border-radius:12px}.lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.25s;color:white;font-size:1.2em}.lightbox-nav:hover{background:rgba(255,255,255,0.25)}.lightbox-prev{left:20px}.lightbox-next{right:20px}.footer{text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.85em;border-top:1px solid var(--border);margin-top:40px;background:var(--bg-secondary)}.footer-brand{font-weight:700;color:var(--pink);margin-bottom:8px}.footer-links{display:flex;gap:20px;justify-content:center;margin:16px 0;flex-wrap:wrap}.footer-links a{color:var(--text-secondary);text-decoration:none;font-weight:500;transition:color 0.2s}.footer-links a:hover{color:var(--pink)}.chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999}.chat-toggle{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--pink),#ff6b00);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(255,0,80,0.3);display:flex;align-items:center;justify-content:center;transition:all 0.3s;animation:float 3s ease-in-out infinite}.chat-toggle:hover{transform:scale(1.1)}.chat-toggle img{width:30px;height:30px;border-radius:50%}.chat-window{display:none;position:fixed;bottom:90px;right:20px;width:350px;max-height:500px;background:#fff;border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);border:2px solid var(--border);overflow:hidden;flex-direction:column}.chat-window.active{display:flex}.chat-header{background:linear-gradient(135deg,var(--pink),#ff6b00);color:white;padding:15px 20px;display:flex;justify-content:space-between;align-items:center}.chat-header h3{font-size:1em;font-weight:700}.chat-close{background:none;border:none;color:white;font-size:1.2em;cursor:pointer}.chat-messages{flex:1;overflow-y:auto;padding:15px;max-height:350px;background:#f8fafc}.chat-message{margin-bottom:12px;padding:10px;border-radius:10px;background:#fff;border:1px solid var(--border)}.message-header{display:flex;justify-content:space-between;margin-bottom:5px}.message-sender{font-weight:700;font-size:0.85em;color:var(--pink)}.message-time{font-size:0.7em;color:var(--text-muted)}.message-content{font-size:0.9em;color:var(--text);line-height:1.4}.message-file{margin-top:5px}.message-file a{color:var(--blue-600);text-decoration:none;font-size:0.85em}.chat-input-area{padding:15px;border-top:1px solid var(--border);display:flex;gap:10px;background:#fff}.chat-input{flex:1;padding:10px 15px;border:2px solid var(--border);border-radius:20px;outline:none;font-size:0.9em}.chat-input:focus{border-color:var(--pink)}.chat-send-btn{background:linear-gradient(135deg,var(--pink),#ff6b00);color:white;border:none;padding:10px 20px;border-radius:20px;font-weight:600;cursor:pointer;transition:all 0.25s}.chat-send-btn:hover{transform:scale(1.05)}@media(max-width:768px){.hero-name{font-size:2em}.hero-img{width:110px;height:110px}.section-heading{font-size:1.2em}.official-card{padding:22px}.chat-window{width:300px}.lightbox-nav{width:40px;height:40px}.lightbox-prev{left:10px}.lightbox-next{right:10px}}</style></head><body><div class="scroll-progress" id="scrollProgress"></div><nav class="navbar"><div class="container"><div class="navbar-brand"><img src="/tiktok_video_Aj2NO.jpeg" alt="" class="navbar-logo-img" onerror="this.style.display=\'none\'"><span class="navbar-logo-text">Verification Hub</span></div><div class="navbar-status"><span class="online-dot"></span><span>Active Now</span><span class="verified-badge-small"><img src="/social-media.png" alt=""> Verified</span></div></div></nav><header class="hero" data-animate><div class="container"><img src="/tiktok_video_Aj2NO.jpeg" alt="Baiilla Maach" class="hero-img" onerror="this.style.display=\'none\'"><h1 class="hero-name">Baiilla Maach Official</h1><p class="hero-bio">Official Entertainment Profile | Singer & Content Creator</p><div class="hero-stats"><div class="hero-stat"><div class="hero-stat-value">50K+</div><div class="hero-stat-label">Followers</div></div><div class="hero-stat"><div class="hero-stat-value">200+</div><div class="hero-stat-label">Posts</div></div><div class="hero-stat"><div class="hero-stat-value" id="onlineCountDisplay">' + onlineCount + '</div><div class="hero-stat-label">Online Now</div></div></div><div class="hero-badges"><span class="badge badge-verified"><img src="/social-media.png" alt=""> VERIFIED OFFICIAL</span><span class="badge badge-fun">✨ ENTERTAINMENT</span><span class="badge badge-music">🎵 MUSIC ARTIST</span></div><div class="hero-social"><a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="social-btn tiktok"><img src="/tiktokicon.png" alt=""> TikTok</a><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="social-btn facebook"><img src="/communication.png" alt=""> Facebook</a></div></div></header><main class="container"><section class="section" data-animate><div class="section-header"><div class="section-icon verified-icon-bg">✅</div><h2 class="section-heading">Official Verified Accounts</h2></div><div class="official-card"><div class="official-card-header"><div class="official-verify-icon"><img src="/check-mark.png" alt=""></div><div class="official-card-title"><h2>The Only Authentic Accounts</h2><span>✓ Identity Verified & Protected</span></div></div><div class="official-card-body"><div class="official-info-list"><div class="official-info-item"><span class="official-info-label"><img src="/tiktokicon.png" width="16" height="16" alt=""> TikTok</span><span class="official-info-value">@baiillamaach_official</span></div><div class="official-info-item"><span class="official-info-label"><img src="/communication.png" width="16" height="16" alt=""> Facebook</span><span class="official-info-value">Baiilla Maach Official</span></div><div class="official-info-item"><span class="official-info-label">Status</span><span class="official-info-value" style="color:var(--green-600)">● Active & Verified</span></div><div class="official-info-item"><span class="official-info-label">Security</span><span class="official-info-value" style="color:var(--green-600)">🔒 Protected</span></div></div><div class="official-preview"><img src="/tiktok_video_Aj2NO.jpeg" alt="" onerror="this.style.display=\'none\'"><div class="uname">@baiillamaach_official</div><div class="plat">TikTok • Facebook</div><a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-follow">✓ Follow Official Account</a></div></div></div></section><section class="fake-section" data-animate><div class="section-header"><div class="section-icon danger-icon-bg">🚨</div><h2 class="section-heading">⚠️ Fake Accounts Detected</h2></div><div class="fake-alert"><div class="fake-alert-icon">🛡️</div><div class="fake-alert-text"><h3>' + totalFake + ' Fake Account' + (totalFake > 1 ? 's' : '') + ' Currently Active</h3><p>These accounts are NOT affiliated with Baiilla Maach. Report them immediately to protect the community.</p></div></div>';
    for (let i = 0; i < DATA.fakeAccounts.length; i++) {
        const a = DATA.fakeAccounts[i];
        html += '<div class="fake-card"><div class="fake-card-top"><div class="fake-card-title"><span>⚠️</span> Fake Account #' + (i+1) + '</div><span class="fake-card-badge">⚠️ DANGEROUS</span></div><div class="fake-card-body"><div class="fake-screenshot">' + (a.screenshot ? '<img src="' + escapeHTML(a.screenshot) + '" alt="Fake Account Screenshot" loading="lazy">' : '') + '<div class="fake-watermark"><span>⚠️ FAKE ACCOUNT</span><span style="font-size:0.7em">DO NOT TRUST</span></div></div><div class="fake-details"><div class="fake-detail-row"><span class="fake-detail-label">Platform</span><span class="fake-detail-value">' + escapeHTML(a.platform) + '</span></div><div class="fake-detail-row"><span class="fake-detail-label">Username</span><span class="fake-detail-value">' + escapeHTML(a.username) + '</span></div><div class="fake-detail-row"><span class="fake-detail-label">Reports</span><span class="fake-detail-value">' + a.reportCount + ' reports</span></div><div class="fake-detail-row"><span class="fake-detail-label">Detected</span><span class="fake-detail-value">' + escapeHTML(a.dateDetected) + '</span></div><div class="fake-reason"><strong>⚠️ Reason:</strong> ' + escapeHTML(a.reason) + '</div></div></div><div class="fake-actions"><a href="' + escapeHTML(a.profileUrl) + '" target="_blank" rel="noopener" class="btn-report"><img src="/report.png" alt=""> Report Account</a><button style="background:#fff;color:var(--red-600);border:2px solid #fecaca;border-radius:22px;padding:10px 20px;font-weight:700;cursor:pointer;flex:1;min-width:120px" onclick="navigator.clipboard.writeText(\'' + escapeHTML(a.username) + '\')">📋 Copy Username</button></div></div>';
    }
    html += '</section><section class="section" data-animate><div class="section-header"><div class="section-icon compare-icon-bg">📊</div><h2 class="section-heading">Account Comparison Guide</h2></div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>Feature</th><th>✅ Official Account</th><th>❌ Fake Account</th></tr></thead><tbody><tr><td><strong>Verification Badge</strong></td><td class="col-official"><span class="check">✓</span> Blue checkmark</td><td class="col-fake"><span class="cross">✗</span> No verification</td></tr><tr><td><strong>Username</strong></td><td class="col-official"><span class="check">✓</span> @baiillamaach_official</td><td class="col-fake"><span class="cross">✗</span> Similar but different</td></tr><tr><td><strong>Content Quality</strong></td><td class="col-official"><span class="check">✓</span> Original, high quality</td><td class="col-fake"><span class="cross">✗</span> Stolen, low quality</td></tr><tr><td><strong>Follower Count</strong></td><td class="col-official"><span class="check">✓</span> 50K+ followers</td><td class="col-fake"><span class="cross">✗</span> Low follower count</td></tr><tr><td><strong>Post History</strong></td><td class="col-official"><span class="check">✓</span> Long history</td><td class="col-fake"><span class="cross">✗</span> Recently created</td></tr><tr><td><strong>Community Reports</strong></td><td class="col-official"><span class="check">✓</span> Clean record</td><td class="col-fake"><span class="cross">✗</span> Multiple reports</td></tr></tbody></table></div></section><div class="warning-section" data-animate><div class="section-header"><div class="section-icon warning-icon-bg">⚡</div><h2 class="section-heading">Safety Guidelines</h2></div><div class="warning-grid"><div class="warning-card"><div class="warning-card-icon">🔍</div><h4>Verify Username</h4><p>Always check the exact username. Official account is <strong>@baiillamaach_official</strong></p></div><div class="warning-card"><div class="warning-card-icon">🔒</div><h4>Never Share Personal Info</h4><p>Fake accounts may ask for passwords, money, or personal details. Never share them.</p></div><div class="warning-card"><div class="warning-card-icon">🚨</div><h4>Report Immediately</h4><p>Use platform report features when you encounter fake accounts. Help keep the community safe.</p></div><div class="warning-card"><div class="warning-card-icon">🔗</div><h4>Use Official Links Only</h4><p>Only use the links provided on this official verification page to access authentic accounts.</p></div></div></div><div class="updates-section" data-animate><h3>📢 Stay Updated</h3><p>We regularly monitor and update this page with new information about impersonation attempts.</p><div class="update-tags"><span class="update-tag">🔍 Weekly fake account checks</span><span class="update-tag">🛡️ Active verification monitoring</span><span class="update-tag">👥 Community-driven reporting</span><span class="update-tag">📊 Database updated regularly</span><span class="update-tag">🎯 Quick response to reports</span></div></div>' + coverSongsHTML + galleryHTML + '</main><footer class="footer"><div class="footer-brand">Baiilla Maach Official</div><p>Official Verification Hub • Established 2023</p><div class="footer-links"><a href="https://tiktok.com/@baiillamaach_official" target="_blank">TikTok</a><a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank">Facebook</a><a href="/admin">Admin</a><a href="#top">Back to Top</a></div><p style="margin-top:16px">© ' + new Date().getFullYear() + ' Baiilla Maach Official. All rights reserved.</p></footer><div class="chat-widget"><button class="chat-toggle" onclick="toggleChat()" title="Chat with us"><img src="/messageicon.gif" alt="Chat"></button><div class="chat-window" id="chatWindow"><div class="chat-header"><h3>💬 Community Chat</h3><button class="chat-close" onclick="toggleChat()">✕</button></div><div class="chat-messages" id="chatMessages">' + (chatDisplayHTML || '<p style="text-align:center;color:var(--text-muted);padding:20px">No messages yet. Be the first!</p>') + '</div><div class="chat-input-area"><input type="text" class="chat-input" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key===\'Enter\')sendMessage()"><button class="chat-send-btn" onclick="sendMessage()">Send</button></div></div></div><audio id="audioPlayer" preload="auto"></audio><script>const observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting)entry.target.classList.add("animated")})},{threshold:0.1});document.querySelectorAll("[data-animate]").forEach(function(el){observer.observe(el)});window.addEventListener("scroll",function(){var pct=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100;document.getElementById("scrollProgress").style.width=pct+"%"});function toggleChat(){document.getElementById("chatWindow").classList.toggle("active")}function sendMessage(){var input=document.getElementById("chatInput");var message=input.value.trim();if(!message)return;var messagesContainer=document.getElementById("chatMessages");var messageElement=document.createElement("div");messageElement.className="chat-message";messageElement.innerHTML=\'<div class="message-header"><span class="message-sender">You</span><span class="message-time">\'+new Date().toLocaleTimeString()+\'</span></div><div class="message-content">\'+message+\'</div>\';messagesContainer.appendChild(messageElement);messagesContainer.scrollTop=messagesContainer.scrollHeight;fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:message})}).catch(function(){});input.value=""}var cur=-1,playing=false,ap=document.getElementById("audioPlayer"),items=document.querySelectorAll(".spotify-playlist-item");function loadSong(i){if(!items.length||i<0||i>=items.length)return;cur=i;var it=items[i];ap.src=it.dataset.audio;document.getElementById("nowPlayingTitle").textContent=it.querySelector(".spotify-track-title").textContent;document.getElementById("nowPlayingArtist").textContent=it.querySelector(".spotify-track-artist-small").textContent;document.getElementById("nowPlayingCover").innerHTML=\'<img src="\'+it.dataset.cover+\'" width="150" height="150" alt="">\';document.querySelectorAll(".spotify-playlist-item").forEach(function(el){el.classList.remove("active")});it.classList.add("active");document.getElementById("progressFill").style.width="0%";document.getElementById("currentTime").textContent="0:00";document.getElementById("totalTime").textContent="0:00";ap.play().then(function(){playing=true}).catch(function(){})}function playSong(i){if(i===cur)togglePlay();else loadSong(i)}function togglePlay(){if(!ap.src&&items.length>0){loadSong(0);return}if(playing)ap.pause();else ap.play();playing=!playing}function nextSong(){if(items.length)loadSong((cur+1)%items.length)}function prevSong(){if(items.length)loadSong(cur<=0?items.length-1:cur-1)}function setVol(v){ap.volume=v/100}function seekAudio(e){var r=e.target.getBoundingClientRect();ap.currentTime=((e.clientX-r.left)/r.width)*ap.duration}ap.addEventListener("timeupdate",function(){if(ap.duration){document.getElementById("progressFill").style.width=(ap.currentTime/ap.duration)*100+"%";var m=Math.floor(ap.currentTime/60),s=Math.floor(ap.currentTime%60);document.getElementById("currentTime").textContent=m+":"+s.toString().padStart(2,"0")}});ap.addEventListener("loadedmetadata",function(){var m=Math.floor(ap.duration/60),s=Math.floor(ap.duration%60);document.getElementById("totalTime").textContent=m+":"+s.toString().padStart(2,"0")});ap.addEventListener("ended",nextSong);ap.volume=0.7;var galleryIdx=0;var galleryImgs=document.querySelectorAll(".gallery-image");var lightbox=document.getElementById("galleryLightbox");var lightboxImg=document.getElementById("lightboxImage");function openGalleryLightbox(i){galleryIdx=i;if(lightboxImg&&galleryImgs[i]){lightboxImg.src=galleryImgs[i].src;lightbox.classList.add("active");document.body.style.overflow="hidden"}}function closeGalleryLightbox(){if(lightbox){lightbox.classList.remove("active");document.body.style.overflow=""}}function navigateGallery(dir){if(!galleryImgs.length)return;galleryIdx=(galleryIdx+dir+galleryImgs.length)%galleryImgs.length;if(lightboxImg&&galleryImgs[galleryIdx])lightboxImg.src=galleryImgs[galleryIdx].src}if(lightbox){lightbox.addEventListener("click",function(e){if(e.target===lightbox)closeGalleryLightbox()})}document.addEventListener("keydown",function(e){if(e.key==="Escape")closeGalleryLightbox();if(e.key==="ArrowLeft"&&lightbox&&lightbox.classList.contains("active"))navigateGallery(-1);if(e.key==="ArrowRight"&&lightbox&&lightbox.classList.contains("active"))navigateGallery(1)});setInterval(function(){fetch("/api/online").then(function(r){return r.json()}).then(function(d){var el=document.getElementById("onlineCountDisplay");if(el)el.textContent=d.count}).catch(function(){})},30000);</script></body></html>';
    return html;
}

function getAdminLoginHTML(error) {
    error = error || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%);display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#fff;border-radius:24px;padding:48px;width:100%;max-width:420px;box-shadow:0 25px 80px rgba(0,0,0,.12)}h2{text-align:center;background:linear-gradient(135deg,#ff0050,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:32px;font-size:1.8em}.fg{margin-bottom:24px}label{display:block;margin-bottom:8px;color:#475569;font-weight:600;font-size:.9em}input{width:100%;padding:14px 18px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;font-size:1em;outline:none;transition:all .3s}input:focus{border-color:#ff0050;box-shadow:0 0 0 3px rgba(255,0,80,.1)}.btn{width:100%;padding:16px;background:linear-gradient(135deg,#ff0050,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;transition:all .3s}.btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(255,0,80,.3)}.error{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:14px;border-radius:10px;margin-bottom:24px;text-align:center;font-weight:500}.back{text-align:center;margin-top:24px}a{color:#64748b;text-decoration:none;font-weight:600;transition:color .2s}a:hover{color:#ff0050}</style></head><body><div class="box"><h2>🔐 Admin Login</h2>' + (error ? '<div class="error">⚠️ ' + escapeHTML(error) + '</div>' : '') + '<form method="POST" action="/admin/login"><div class="fg"><label>Username</label><input type="text" name="username" placeholder="Enter username" required></div><div class="fg"><label>Password</label><input type="password" name="password" placeholder="Enter password" required></div><button type="submit" class="btn">Sign In</button></form><div class="back"><a href="/">← Back to Home</a></div></div></body></html>';
}

function getAdminPanelHTML(photos, chatMessages, msg, err) {
    photos = photos || [];
    chatMessages = chatMessages || [];
    msg = msg || '';
    err = err || '';
    let phtml = '';
    for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        phtml += '<div class="pc"><img src="' + escapeHTML(p.path) + '" class="pi"><div class="info">' + (p.caption ? '<p>' + escapeHTML(p.caption) + '</p>' : '') + '<p class="dt">' + new Date(p.uploadedAt).toLocaleDateString() + '</p></div><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="' + p._id + '"><button class="del" onclick="return confirm(\'Delete this photo?\')">🗑️ Delete</button></form></div>';
    }
    let chatHTML = '';
    const displayChat = chatMessages.slice(0, 20).reverse();
    for (let i = 0; i < displayChat.length; i++) {
        const m = displayChat[i];
        chatHTML += '<div class="chat-item"><div class="chat-info"><strong>' + escapeHTML(m.sender || 'Anonymous') + '</strong><span>' + new Date(m.timestamp).toLocaleString() + '</span></div><p>' + escapeHTML(m.text || '') + '</p>' + (m.file ? '<a href="' + escapeHTML(m.file) + '" target="_blank">📎 Attachment</a>' : '') + '<form method="POST" action="/admin/delete-chat" style="display:inline"><input type="hidden" name="messageId" value="' + m._id + '"><button class="del-small" onclick="return confirm(\'Delete this message?\')">Delete</button></form></div>';
    }
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;color:#0f172a}.hdr{background:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:12px;box-shadow:0 2px 10px rgba(0,0,0,.05)}.hdr h2{background:linear-gradient(135deg,#ff0050,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.hdr a{color:#64748b;text-decoration:none;padding:10px 20px;border:2px solid #e2e8f0;border-radius:10px;font-weight:600;transition:all .3s}.hdr a:hover{background:#ff0050;color:#fff;border-color:#ff0050}.cnt{max-width:1200px;margin:0 auto;padding:30px 20px}.up{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:30px;margin-bottom:30px;box-shadow:0 4px 15px rgba(0,0,0,.05)}.up h3{color:#ff0050;margin-bottom:20px;font-size:1.2em}.fg{margin-bottom:18px}label{display:block;margin-bottom:6px;color:#475569;font-weight:600;font-size:.9em}input,textarea{width:100%;padding:12px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:.95em;outline:none;transition:all .3s}input:focus,textarea:focus{border-color:#ff0050;box-shadow:0 0 0 3px rgba(255,0,80,.1)}.bu{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:12px 28px;border:none;border-radius:10px;font-weight:600;cursor:pointer;transition:all .3s}.bu:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(34,197,94,.3)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}.pc{background:#fff;border:2px solid #e2e8f0;border-radius:14px;overflow:hidden;transition:all .3s}.pc:hover{border-color:#ff0050;transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.1)}.pi{width:100%;height:220px;object-fit:cover}.info{padding:14px}.dt{font-size:.75em;color:#94a3b8;margin-top:4px}.del{background:#fef2f2;color:#dc2626;border:2px solid #fecaca;padding:8px 16px;border-radius:8px;cursor:pointer;margin:0 14px 14px;width:calc(100% - 28px);font-weight:600;transition:all .3s}.del:hover{background:#ef4444;color:#fff;border-color:#ef4444}.chat-section{margin-top:40px}.chat-item{background:#fff;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px}.chat-info{display:flex;justify-content:space-between;margin-bottom:8px;font-size:.85em}.chat-info span{color:#94a3b8}.del-small{background:none;border:none;color:#dc2626;cursor:pointer;font-size:.8em;margin-top:8px;text-decoration:underline}.msg{background:#f0fdf4;border:2px solid #bbf7d0;color:#166534;padding:14px;border-radius:10px;margin-bottom:20px;font-weight:500}.err{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:14px;border-radius:10px;margin-bottom:20px;font-weight:500}@media(max-width:768px){.cnt{padding:20px 15px}.hdr{padding:15px 20px}.grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}}</style></head><body><div class="hdr"><h2>🎛️ Admin Panel</h2><div><a href="/">🏠 Home</a><a href="/admin/logout">🚪 Logout</a></div></div><div class="cnt">' + (msg ? '<div class="msg">✅ ' + escapeHTML(msg) + '</div>' : '') + (err ? '<div class="err">❌ ' + escapeHTML(err) + '</div>' : '') + '<div class="up"><h3>📸 Upload New Photo</h3><form method="POST" action="/admin/upload" enctype="multipart/form-data"><div class="fg"><label>Select Photo</label><input type="file" name="photo" accept="image/*" required></div><div class="fg"><label>Caption (optional)</label><input type="text" name="caption" placeholder="Add a description..."></div><button type="submit" class="bu">📤 Upload Photo</button></form></div><h3 style="margin-bottom:20px">🖼️ Gallery (' + photos.length + ' photos)</h3>' + (photos.length ? '<div class="grid">' + phtml + '</div>' : '<p style="color:#94a3b8;text-align:center;padding:40px;background:#fff;border-radius:10px;border:1px solid #e2e8f0;">📭 No photos uploaded yet</p>') + '<div class="chat-section"><h3 style="margin-bottom:20px">💬 Recent Messages (' + chatMessages.length + ' total)</h3>' + (chatHTML || '<p style="color:#94a3b8;text-align:center;padding:20px;">No messages yet</p>') + '</div></div></body></html>';
}

const server = http.createServer(async function(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);
    const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!onlineUsers.has(userIP)) {
        onlineUsers.set(userIP, Date.now());
    } else {
        onlineUsers.set(userIP, Date.now());
    }
    const now = Date.now();
    onlineUsers.forEach(function(time, ip) {
        if (now - time > 300000) onlineUsers.delete(ip);
    });
    if (pathname === '/api/online') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ count: onlineUsers.size }));
        return;
    }
    if (pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', function(c) { body += c; });
        req.on('end', async function() {
            try {
                const data = JSON.parse(body);
                await saveChatMessage({ text: data.text, sender: data.sender || 'Anonymous', room: data.room || 'general', type: 'user' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    const staticFiles = [
        '/tiktok_video_Aj2NO.jpeg', '/orginalss.png', '/real-id-ss.png', '/hammadfams.png',
        '/baillamach.png', '/Fakedetect.png', '/tiktokicon.png', '/communication.png',
        '/messageicon.gif', '/report.png', '/social-media.png', '/microphone-in-hand.gif',
        '/music-icon.png', '/flag.png', '/check-mark.png', '/fb_profile.jpg'
    ];
    if (pathname.startsWith('/assets/') || staticFiles.indexOf(pathname) !== -1) {
        let assetPath;
        if (pathname.startsWith('/assets/')) {
            assetPath = path.join(__dir, pathname);
        } else {
            assetPath = path.join(__dir, pathname);
        }
        if (!assetPath.startsWith(__dir)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac','.wma':'audio/x-ms-wma','.opus':'audio/opus','.weba':'audio/webm' };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, { 'Content-Type': ct, 'Content-Length': stat.size, 'Cache-Control': 'public, max-age=86400', 'Accept-Ranges': 'bytes' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    if (pathname === '/admin' && req.method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) { 
            const p = await getGalleryPhotos();
            const cm = await getChatMessages('general', 50);
            res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
            res.end(getAdminPanelHTML(p, cm)); 
            return; 
        }
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
        res.end(getAdminLoginHTML()); 
        return;
    }
    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = ''; 
        req.on('data',function(c){body+=c}); 
        req.on('end',async function(){
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'),params.get('password'))) {
                const sid = createSession(params.get('username'));
                res.writeHead(302,{'Location':'/admin','Set-Cookie':'sessionId=' + sid + ';HttpOnly;Path=/;Max-Age=7200;SameSite=Lax'}); 
                res.end();
            } else { 
                res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
                res.end(getAdminLoginHTML('Invalid username or password')); 
            }
        }); 
        return;
    }
    if (pathname === '/admin/logout') { 
        sessions.delete(cookies.sessionId); 
        res.writeHead(302,{'Location':'/admin','Set-Cookie':'sessionId=;HttpOnly;Path=/;Max-Age=0'}); 
        res.end(); 
        return; 
    }
    if (pathname === '/admin/upload' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        const form = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true, maxFileSize: 10*1024*1024 });
        form.parse(req, async function(err, fields, files) {
            if (err) { 
                const p = await getGalleryPhotos();
                const cm = await getChatMessages('general', 50);
                res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
                res.end(getAdminPanelHTML(p, cm, '', 'Upload failed: ' + err.message)); 
                return; 
            }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf || !pf.originalFilename) { 
                const p = await getGalleryPhotos();
                const cm = await getChatMessages('general', 50);
                res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
                res.end(getAdminPanelHTML(p, cm, '', 'No file selected')); 
                return; 
            }
            if (['.jpg','.jpeg','.png','.gif','.webp'].indexOf(path.extname(pf.originalFilename).toLowerCase()) === -1) { 
                const p = await getGalleryPhotos();
                const cm = await getChatMessages('general', 50);
                res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
                res.end(getAdminPanelHTML(p, cm, '', 'Invalid file format. Use JPG, PNG, GIF, or WebP')); 
                return; 
            }
            const fn = Date.now()+'_'+pf.originalFilename.replace(/[^a-zA-Z0-9.]/g,'_');
            try {
                fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
                await savePhoto({ path:'/assets/gallery/'+fn, caption:fields.caption?(Array.isArray(fields.caption)?fields.caption[0]:fields.caption):'' });
                const p = await getGalleryPhotos();
                const cm = await getChatMessages('general', 50);
                res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
                res.end(getAdminPanelHTML(p, cm, 'Photo uploaded successfully!'));
            } catch(e) { 
                const p = await getGalleryPhotos();
                const cm = await getChatMessages('general', 50);
                res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
                res.end(getAdminPanelHTML(p, cm, '', 'Error saving photo')); 
            }
        }); 
        return;
    }
    if (pathname === '/admin/delete' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        let body = ''; 
        req.on('data',function(c){body+=c}); 
        req.on('end',async function(){
            const params = new URLSearchParams(body);
            try { 
                const photo = await db.collection('gallery_photos').findOne({_id:new ObjectId(params.get('photoId'))}); 
                if(photo){ const fp=path.join(__dir,photo.path); if(fs.existsSync(fp)) fs.unlinkSync(fp); } 
                await deletePhoto(params.get('photoId')); 
            } catch(e){}
            const p = await getGalleryPhotos();
            const cm = await getChatMessages('general', 50);
            res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); 
            res.end(getAdminPanelHTML(p, cm, 'Photo deleted'));
        }); 
        return;
    }
    if (pathname === '/admin/delete-chat' && req.method === 'POST') {
        if (!getSession(cookies.sessionId)) { res.writeHead(302,{'Location':'/admin'}); res.end(); return; }
        let body = ''; 
        req.on('data',function(c){body+=c}); 
        req.on('end',async function(){
            const params = new URLSearchParams(body);
            await deleteChatMessage(params.get('messageId'));
            res.writeHead(302,{'Location':'/admin'}); 
            res.end();
        }); 
        return;
    }
    if (pathname === '/' || pathname === '/index.html') {
        const photos = await getGalleryPhotos();
        const chatMessages = await getChatMessages('general', 10);
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=3600'});
        res.end(getMainHTML(photos, chatMessages));
        return;
    }
    res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});
    res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404</title><style>body{background:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:100px;color:#ff0050}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>');
});

async function start() {
    await connectDB();
    server.listen(PORT, function() {
        console.log('Server running: http://localhost:' + PORT);
    });
}

start();
server.on('error', function(e) { if (e.code === 'EADDRINUSE') process.exit(1); });

require('dotenv').config();
process.on('uncaughtException', (e) => { 
    console.error('❌ Uncaught Exception:', e.message);
    console.error(e.stack);
});
process.on('unhandledRejection', (e) => { 
    console.error('❌ Unhandled Rejection:', e);
    console.error(e.stack);
});
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Server closed');
        process.exit(0);
    });
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
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

const APP_CONFIG = {
    name: 'Baiilla Maach Verification Hub',
    version: '3.0.0',
    description: 'Official verification system for Hammad Bin Amir',
    author: 'Baiilla Maach Team',
    socialLinks: {
        tiktok: 'https://tiktok.com/@baiillamaach_official',
        facebook: 'https://www.facebook.com/profile.php?id=61575202118828'
    },
    fakeAccounts: [
        {
            username: '@baiilla_mach',
            platform: 'TikTok',
            url: 'https://tiktok.com/@baiilla_mach',
            description: 'Copies official logo and content to deceive followers'
        },
        {
            username: '@hammad_fams0',
            platform: 'TikTok',
            url: 'https://tiktok.com/@hammad_fams0',
            description: 'Uses official name and photo to mislead followers'
        }
    ],
    stats: {
        followers: '7,200',
        likes: '195,000',
        following: '0'
    }
};

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '50mb' 
}));

app.use('/assets', express.static('assets', {
    maxAge: '30d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.gif')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg')) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }
}));

app.use('/uploads', express.static('uploads', {
    maxAge: '7d',
    etag: true
}));

app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'Baiilla Maach');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// ============================================
// FILE SYSTEM SETUP
// ============================================
const REQUIRED_DIRS = [
    'uploads',
    'uploads/images',
    'uploads/audio',
    'uploads/video',
    'assets/covermusic',
    'assets/thumbnails',
    'assets/icons',
    'assets/voices',
    'assets/screenshots',
    'logs'
];

REQUIRED_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
});

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        if (file.mimetype.startsWith('image/')) {
            uploadPath = 'uploads/images/';
        } else if (file.mimetype.startsWith('audio/')) {
            uploadPath = 'uploads/audio/';
        } else if (file.mimetype.startsWith('video/')) {
            uploadPath = 'uploads/video/';
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/webm',
        'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 5
    }
});

// ============================================
// DATABASE MODELS
// ============================================
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    profilePicture: {
        type: String,
        default: '/assets/default-avatar.png'
    },
    bio: {
        type: String,
        maxlength: [200, 'Bio cannot exceed 200 characters'],
        default: ''
    },
    preferences: {
        notifications: { type: Boolean, default: true },
        theme: { type: String, default: 'light' }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true,
        index: true
    },
    receiver: {
        type: String,
        required: true,
        index: true
    },
    message: {
        type: String,
        required: function() {
            return this.type === 'text';
        },
        maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    type: {
        type: String,
        enum: ['text', 'image', 'audio', 'video', 'file', 'location'],
        default: 'text'
    },
    fileUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    },
    fileSize: {
        type: Number,
        default: null
    },
    seen: {
        type: Boolean,
        default: false,
        index: true
    },
    seenAt: {
        type: Date,
        default: null
    },
    delivered: {
        type: Boolean,
        default: false
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    reactions: [{
        user: String,
        reaction: String,
        timestamp: { type: Date, default: Date.now }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date,
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, seen: 1 });

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// ============================================
// DATABASE CONNECTION
// ============================================
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
        console.log(`🔗 Host: ${mongoose.connection.host}`);
        console.log(`📡 Port: ${mongoose.connection.port}`);
        
        // Create admin user if not exists
        const adminExists = await User.findOne({ email: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await User.create({
                name: 'Baiilla Maach',
                email: 'admin',
                password: hashedPassword,
                isAdmin: true,
                bio: 'Official Admin Account'
            });
            console.log('👑 Admin account created successfully');
            console.log('📧 Email: admin');
            console.log('🔑 Password: admin123');
        } else {
            console.log('👑 Admin account already exists');
        }
        
        // Create indexes
        await User.collection.createIndex({ email: 1 }, { unique: true });
        await User.collection.createIndex({ isOnline: 1 });
        await User.collection.createIndex({ lastSeen: -1 });
        
        console.log('📑 Database indexes created');
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

// ============================================
// ASSETS CONFIGURATION
// ============================================
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

// Check if required assets exist
const checkAssets = () => {
    console.log('\n📦 Checking required assets...');
    let missingCount = 0;
    
    Object.entries(ASSETS).forEach(([key, value]) => {
        const filePath = path.join(__dirname, value);
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Missing: ${key} -> ${value}`);
            missingCount++;
        }
    });
    
    if (missingCount === 0) {
        console.log('✅ All assets present');
    } else {
        console.log(`⚠️  ${missingCount} assets missing`);
    }
    console.log('');
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const WELCOME_VOICE = fs.existsSync(path.join(__dirname, 'assets/realvoice.mp3'));
const MANUAL_VOICE = fs.existsSync(path.join(__dirname, 'assets/manualvoice_alert.mp3'));

function getSongs() {
    try {
        const dir = path.join(__dirname, 'assets/covermusic');
        if (!fs.existsSync(dir)) {
            console.log('⚠️  Cover music directory not found');
            return [];
        }
        
        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.mp3'))
            .map((f, i) => ({
                id: i,
                title: f.replace('.mp3', '').replace(/[-_]/g, ' '),
                url: '/assets/covermusic/' + encodeURIComponent(f),
                filename: f
            }));
        
        console.log(`🎵 Found ${files.length} songs`);
        return files;
    } catch (e) {
        console.error('❌ Error reading songs:', e.message);
        return [];
    }
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function getFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// ============================================
// ROUTES - MAIN WEBSITE
// ============================================
app.get('/', async (req, res) => {
    const songs = getSongs();
    const userIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    console.log(`🌐 Homepage accessed from: ${userIP}`);
    console.log(`📱 User Agent: ${userAgent}`);
    console.log(`🎵 Songs available: ${songs.length}`);
    
    let musicHTML = '';
    if (songs.length > 0) {
        musicHTML = `
    <!-- Music Section -->
    <section class="section bg-gray">
      <div class="container">
        <div class="section-label">🎵 MUSIC</div>
        <h2 class="section-heading">Cover Songs Collection</h2>
        <p class="section-desc">Official covers by Hammad Bin Amir - Listen & Enjoy</p>
        
        <div class="music-player">
          <div class="music-cover">
            <img src="${ASSETS.microphone}" alt="Music Cover" 
                 onerror="this.src='${ASSETS.profile}'">
          </div>
          <div class="music-info">
            <h4 id="trackTitle">Select a Song</h4>
            <p id="trackArtist">🎤 Baiilla Maach</p>
            <div class="music-ctrls">
              <button onclick="prevTrack()" title="Previous">⏮</button>
              <button id="playBtn" onclick="togglePlay()" class="btn-play" title="Play/Pause">▶️</button>
              <button onclick="nextTrack()" title="Next">⏭</button>
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
          <div onclick="playTrack(${i})" class="music-item" id="track-${i}">
            <span>${String(i + 1).padStart(2, '0')}</span>
            <div>${s.title}</div>
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
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="Official Verification Hub for Hammad Bin Amir (Baiilla Maach) - Verified Creator on TikTok and Facebook">
<meta name="keywords" content="Baiilla Maach, Hammad Bin Amir, TikTok Creator, Verified Account, Entertainment">
<meta name="author" content="Baiilla Maach Official">
<meta property="og:title" content="Baiilla Maach - Official Verification Hub">
<meta property="og:description" content="Official verification portal for Hammad Bin Amir. Protect yourself from fake accounts.">
<meta property="og:image" content="${ASSETS.profile}">
<meta property="og:url" content="https://baillamaach.com">
<meta name="twitter:card" content="summary_large_image">
<title>Baiilla Maach | Official Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
/* ============================================
   CSS VARIABLES & ROOT CONFIGURATION
   ============================================ */
:root {
  --white: #ffffff;
  --bg: #f8f9fb;
  --gray50: #f9fafb;
  --gray100: #f3f4f6;
  --gray200: #e5e7eb;
  --gray300: #d1d5db;
  --gray400: #9ca3af;
  --gray500: #6b7280;
  --gray600: #4b5563;
  --gray700: #374151;
  --gray800: #1f2937;
  --gray900: #111827;
  --orange: #f97316;
  --orange-dark: #ea580c;
  --orange-light: #fff7ed;
  --green: #10b981;
  --green-dark: #059669;
  --green-light: #ecfdf5;
  --red: #ef4444;
  --red-dark: #dc2626;
  --red-light: #fef2f2;
  --blue: #3b82f6;
  --blue-dark: #2563eb;
  --blue-light: #eff6ff;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --radius: 16px;
  --radius-sm: 10px;
  --radius-lg: 24px;
  --radius-full: 9999px;
}

/* ============================================
   GLOBAL RESET & BASE STYLES
   ============================================ */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--white);
  color: var(--gray800);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

a {
  text-decoration: none;
  color: inherit;
}

button {
  cursor: pointer;
  border: none;
  outline: none;
  font-family: inherit;
}

input {
  font-family: inherit;
  outline: none;
}

/* ============================================
   SCROLLBAR STYLES
   ============================================ */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--gray100);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: var(--gray300);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--gray400);
}

/* ============================================
   NAVIGATION BAR
   ============================================ */
.nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--gray200);
  padding: 0 24px;
  box-shadow: var(--shadow-sm);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  transition: 0.2s;
}

.nav-brand:hover {
  opacity: 0.8;
}

.nav-brand img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--orange);
  transition: 0.3s;
}

.nav-brand:hover img {
  transform: rotate(5deg);
}

.nav-brand span {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 1.15em;
  color: var(--gray900);
  letter-spacing: -0.3px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-chat, .nav-admin {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.85em;
  transition: all 0.3s ease;
}

.nav-chat {
  background: var(--green);
  color: var(--white);
}

.nav-chat:hover {
  background: var(--green-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.nav-admin {
  background: var(--orange);
  color: var(--white);
}

.nav-admin:hover {
  background: var(--orange-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.nav-chat img, .nav-admin img {
  width: 16px;
  height: 16px;
}

/* ============================================
   HERO SECTION
   ============================================ */
.hero {
  padding: 80px 24px 60px;
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
  animation: fadeInUp 0.8s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-avatar {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.hero-avatar img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--orange);
  box-shadow: 0 0 0 8px var(--orange-light);
  transition: transform 0.3s;
}

.hero-avatar:hover img {
  transform: scale(1.05);
}

.hero-avatar .verified-icon {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: var(--green);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--white);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.hero-avatar .verified-icon svg {
  width: 14px;
  height: 14px;
  fill: var(--white);
}

.hero h1 {
  font-family: 'Outfit', sans-serif;
  font-size: 2.5em;
  font-weight: 800;
  color: var(--gray900);
  letter-spacing: -1px;
  margin-bottom: 4px;
  background: linear-gradient(135deg, var(--orange), var(--red));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero .username {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.05em;
  color: var(--gray500);
  font-weight: 400;
  margin-bottom: 4px;
}

.hero .bio {
  color: var(--gray400);
  font-size: 0.95em;
  margin-bottom: 20px;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 20px 0;
}

.hero-stat {
  text-align: center;
}

.hero-stat .num {
  font-family: 'Outfit', sans-serif;
  font-size: 1.6em;
  font-weight: 700;
  color: var(--gray900);
}

.hero-stat .label {
  font-size: 0.78em;
  color: var(--gray400);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-top: 2px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--green-light);
  color: var(--green);
  padding: 6px 16px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.8em;
  margin-bottom: 18px;
}

.hero-btns {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 16px;
}

.hero-btn {
  padding: 12px 24px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.hero-btn img {
  width: 20px;
  height: 20px;
}

.hero-btn.tiktok {
  background: #000000;
  color: var(--white);
}

.hero-btn.tiktok:hover {
  background: #111111;
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.hero-btn.facebook {
  background: var(--blue);
  color: var(--white);
}

.hero-btn.facebook:hover {
  background: var(--blue-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* ============================================
   SECTION STYLES
   ============================================ */
.section {
  padding: 80px 24px;
  position: relative;
}

.section.bg-gray { background: var(--gray50); }
.section.bg-green { background: var(--green-light); }
.section.bg-red { background: var(--red-light); }

.container {
  max-width: 1050px;
  margin: 0 auto;
}

.section-label {
  display: inline-block;
  font-size: 0.72em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  color: var(--orange);
  margin-bottom: 12px;
  background: var(--orange-light);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.section-heading {
  font-family: 'Outfit', sans-serif;
  font-size: 2em;
  font-weight: 700;
  color: var(--gray900);
  text-align: center;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}

.section-desc {
  text-align: center;
  color: var(--gray500);
  margin-bottom: 40px;
  font-size: 0.95em;
}

/* ============================================
   VERIFIED CARDS
   ============================================ */
.verified-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.verified-card {
  background: var(--white);
  border: 1px solid var(--gray200);
  border-radius: var(--radius);
  padding: 28px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.verified-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--green), var(--blue));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.verified-card:hover::before {
  transform: scaleX(1);
}

.verified-card:hover {
  border-color: var(--green);
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
}

.verified-card .card-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.verified-card .card-top .pfp {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--orange);
}

.verified-card .card-top .info h3 {
  font-family: 'Outfit', sans-serif;
  font-size: 1.1em;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--gray900);
}

.verified-card .card-top .info h3 img {
  width: 18px;
  height: 18px;
}

.verified-card .card-top .info .handle {
  color: var(--gray500);
  font-size: 0.85em;
  font-family: 'DM Sans', sans-serif;
}

.verified-card .card-body .row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  color: var(--gray600);
  font-size: 0.88em;
  transition: 0.2s;
}

.verified-card .card-body .row:hover {
  color: var(--gray900);
}

.verified-card .card-body .row strong {
  color: var(--gray800);
  font-weight: 600;
}

.verified-card .card-body .follow-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.85em;
  margin-top: 12px;
  transition: all 0.3s ease;
}

.verified-card .card-body .follow-btn img {
  width: 18px;
  height: 18px;
}

.verified-card .card-body .follow-btn.tiktok-btn {
  background: #000;
  color: var(--white);
}

.verified-card .card-body .follow-btn.tiktok-btn:hover {
  background: #111;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.verified-card .card-body .follow-btn.fb-btn {
  background: var(--blue);
  color: var(--white);
}

.verified-card .card-body .follow-btn.fb-btn:hover {
  background: var(--blue-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}

/* ============================================
   FAKE CARDS
   ============================================ */
.fake-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.fake-card {
  background: var(--white);
  border: 2px solid #fecaca;
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.fake-card:hover {
  box-shadow: var(--shadow-xl);
  border-color: var(--red);
  transform: translateY(-4px);
}

.fake-img-container {
  position: relative;
  text-align: center;
  background: #fafafa;
  padding: 20px;
  overflow: hidden;
}

.fake-img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
}

.fake-detect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  animation: updown 2s infinite ease-in-out;
  z-index: 10;
  opacity: 0.9;
}

@keyframes updown {
  0%, 100% { 
    transform: translate(-50%, -50%) translateY(0);
  }
  50% { 
    transform: translate(-50%, -50%) translateY(-20px);
  }
}

.fake-card .fake-info {
  padding: 24px;
}

.fake-card .fake-info h3 {
  font-family: 'Outfit', sans-serif;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--gray900);
  margin-bottom: 4px;
}

.fake-card .fake-info .plat {
  color: var(--orange);
  font-weight: 600;
  font-size: 0.85em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
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
  gap: 6px;
  background: var(--red);
  color: var(--white);
  padding: 8px 18px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.85em;
  transition: all 0.3s ease;
}

.fake-card .fake-info .report-btn:hover {
  background: var(--red-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239,68,68,0.3);
}

.fake-card .fake-info .report-btn img {
  width: 16px;
  height: 16px;
}

/* Continue with more styles... */
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <img src="${ASSETS.profile}" alt="Baiilla Maach Logo" onerror="this.style.display='none'">
      <span>Baiilla Maach</span>
    </a>
    <div class="nav-links">
      <a href="/messenger" class="nav-admin">⚡ Admin Panel</a>
      <a href="#" class="nav-chat" onclick="openChat();return false;">
        💬 Chat Support
      </a>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="hero-avatar">
    <img src="${ASSETS.profile}" alt="Baiilla Maach Official" onerror="this.style.display='none'">
    <div class="verified-icon">
      <svg viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    </div>
  </div>
  <h1>Hammad Bin Amir</h1>
  <p class="username">@baiillamaach_official</p>
  <p class="bio">Official Entertainment Profile · Verified Creator · Content Producer</p>
  <div class="hero-stats">
    <div class="hero-stat">
      <div class="num">7.2K</div>
      <div class="label">Followers</div>
    </div>
    <div class="hero-stat">
      <div class="num">0</div>
      <div class="label">Following</div>
    </div>
    <div class="hero-stat">
      <div class="num">195K</div>
      <div class="label">Likes</div>
    </div>
  </div>
  <div class="hero-badge">✓ Verified Official Account - Authentic Creator</div>
  <div class="hero-btns">
    <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="hero-btn tiktok">
      <img src="${ASSETS.logoTikTok}" alt="TikTok Logo"> Follow on TikTok
    </a>
    <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="hero-btn facebook">
      <img src="${ASSETS.logoFB}" alt="Facebook Logo"> Follow on Facebook
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
          <img src="${ASSETS.profile}" class="pfp" alt="Profile" onerror="this.style.display='none'">
          <div class="info">
            <h3>TikTok <img src="${ASSETS.blueTikTok}" alt="Verified" onerror="this.style.display='none'"></h3>
            <p class="handle">@baiillamaach_official</p>
          </div>
        </div>
        <div class="card-body">
          <div class="row">✓ Account Status: <strong>Active & Verified</strong></div>
          <div class="row">👥 Total Followers: <strong>7,200+</strong></div>
          <div class="row">❤️ Total Likes: <strong>195,000+</strong></div>
          <a href="https://tiktok.com/@baiillamaach_official" target="_blank" class="follow-btn tiktok-btn">
            <img src="${ASSETS.logoTikTok}" alt="TikTok"> Follow on TikTok
          </a>
        </div>
      </div>
      <div class="verified-card">
        <div class="card-top">
          <img src="${ASSETS.fbProfile}" class="pfp" alt="Facebook Profile" onerror="this.style.display='none'">
          <div class="info">
            <h3>Facebook <img src="${ASSETS.blueFB}" alt="Verified" onerror="this.style.display='none'"></h3>
            <p class="handle">@BaiillaMaachOfficial</p>
          </div>
        </div>
        <div class="card-body">
          <div class="row">✓ Page Status: <strong>Active & Verified</strong></div>
          <div class="row">📘 Page Type: <strong>Official Facebook Page</strong></div>
          <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" class="follow-btn fb-btn">
            <img src="${ASSETS.logoFB}" alt="Facebook"> Follow on Facebook
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- More sections continue... -->

<script src="/socket.io/socket.io.js"></script>
<script>
// Complete JavaScript functionality
</script>
</body>
</html>`);
});

// Continue with more routes and WebSocket handling...

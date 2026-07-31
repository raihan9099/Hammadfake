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

// Create directories if they don't exist
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
        mongoClient = new MongoClient(MONGO_URI, {
            maxPoolSize: 5, // Limit connections for free tier
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        // Create collections and indexes
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) {
                await db.createCollection(col);
            }
        }
        
        // Drop existing problematic index if exists
        try {
            await db.collection('chat_users').dropIndex('phoneEmail_1');
        } catch (e) {
            // Index might not exist, that's fine
        }
        
        // Create proper index - sparse allows null values
        await db.collection('chat_users').createIndex(
            { phoneEmail: 1 }, 
            { unique: true, sparse: true }
        );
        
        // Create other indexes
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_sessions').createIndex({ sessionToken: 1 });
        await db.collection('chat_sessions').createIndex({ chatId: 1 });
        
        // Create default admin if not exists
        const admins = db.collection('admin_users');
        const adminExists = await admins.findOne({ username: 'admin' });
        if (!adminExists) {
            await admins.insertOne({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                createdAt: new Date()
            });
            console.log('Default admin created');
        }
        
        // Clean expired sessions
        await db.collection('chat_sessions').deleteMany({
            expiresAt: { $lt: new Date() }
        });
        
        console.log('Database connected successfully');
        return true;
    } catch (e) {
        console.error('Database connection error:', e);
        return false;
    }
}

async function getGalleryPhotos() {
    if (!db) return [];
    try {
        return await db.collection('gallery_photos')
            .find({})
            .sort({ uploadedAt: -1 })
            .limit(50) // Limit for performance
            .toArray();
    } catch (e) {
        return [];
    }
}

async function savePhoto(d) {
    if (!db) return null;
    return await db.collection('gallery_photos').insertOne({
        ...d,
        uploadedAt: new Date()
    });
}

async function deletePhoto(id) {
    if (!db) return null;
    return await db.collection('gallery_photos').deleteOne({
        _id: new ObjectId(id)
    });
}

async function verifyAdmin(u, p) {
    if (!db) return u === 'admin' && p === 'admin123';
    const a = await db.collection('admin_users').findOne({ username: u });
    if (!a) return false;
    return await bcrypt.compare(p, a.password);
}

// Chat System Functions
async function createOrGetChatUser(name, phoneEmail) {
    try {
        // Validate input
        if (!phoneEmail || phoneEmail.trim() === '') {
            throw new Error('Phone/Email is required');
        }
        
        const cleanPhoneEmail = phoneEmail.trim().toLowerCase();
        
        // Try to find existing user
        let user = await db.collection('chat_users').findOne({
            phoneEmail: cleanPhoneEmail
        });
        
        if (user) {
            // Update existing user
            await db.collection('chat_users').updateOne(
                { _id: user._id },
                {
                    $set: {
                        name: name || user.name,
                        lastSeen: new Date(),
                        status: 'active'
                    }
                }
            );
            console.log('Existing user found:', user.chatId);
            return user;
        }
        
        // Create new user
        const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const newUser = {
            chatId,
            name: name || 'Anonymous',
            phoneEmail: cleanPhoneEmail,
            createdAt: new Date(),
            status: 'active',
            lastSeen: new Date()
        };
        
        await db.collection('chat_users').insertOne(newUser);
        console.log('New user created:', chatId);
        return newUser;
        
    } catch (error) {
        console.error('Error in createOrGetChatUser:', error);
        // If duplicate key error, try to find the user
        if (error.code === 11000) {
            return await db.collection('chat_users').findOne({
                phoneEmail: phoneEmail.trim().toLowerCase()
            });
        }
        throw error;
    }
}

async function createChatSession(chatId) {
    try {
        // Clean old sessions for this user
        await db.collection('chat_sessions').deleteMany({ chatId });
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        await db.collection('chat_sessions').insertOne({
            chatId,
            sessionToken,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        
        return sessionToken;
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

async function getChatUserByToken(sessionToken) {
    try {
        if (!sessionToken) return null;
        
        const session = await db.collection('chat_sessions').findOne({
            sessionToken,
            expiresAt: { $gt: new Date() }
        });
        
        if (!session) return null;
        
        return await db.collection('chat_users').findOne({
            chatId: session.chatId
        });
    } catch (error) {
        console.error('Error getting user by token:', error);
        return null;
    }
}

async function getChatMessages(chatId) {
    try {
        return await db.collection('chat_messages')
            .find({ chatId })
            .sort({ createdAt: 1 })
            .limit(100)
            .toArray();
    } catch (error) {
        return [];
    }
}

async function saveChatMessage(chatId, sender, message) {
    try {
        const msg = {
            chatId,
            sender,
            message,
            createdAt: new Date(),
            read: false
        };
        
        await db.collection('chat_messages').insertOne(msg);
        
        // Update user's last seen
        await db.collection('chat_users').updateOne(
            { chatId },
            { $set: { lastSeen: new Date() } }
        );
        
        return msg;
    } catch (error) {
        console.error('Error saving message:', error);
        throw error;
    }
}

async function getAdminChatList() {
    try {
        const users = await db.collection('chat_users')
            .find({ status: 'active' })
            .sort({ lastSeen: -1 })
            .toArray();
        
        const list = [];
        for (const u of users) {
            const lastMsg = await db.collection('chat_messages')
                .findOne(
                    { chatId: u.chatId },
                    { sort: { createdAt: -1 } }
                );
            
            const unread = await db.collection('chat_messages')
                .countDocuments({
                    chatId: u.chatId,
                    sender: 'user',
                    read: false
                });
            
            list.push({
                chatId: u.chatId,
                name: u.name,
                phoneEmail: u.phoneEmail,
                lastSeen: u.lastSeen,
                lastMessage: lastMsg,
                unread
            });
        }
        return list;
    } catch (error) {
        return [];
    }
}

async function markMessagesRead(chatId) {
    try {
        await db.collection('chat_messages').updateMany(
            { chatId, sender: 'user', read: false },
            { $set: { read: true } }
        );
    } catch (error) {
        console.error('Error marking messages read:', error);
    }
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile | Bangladesh",
        tiktokFollowers: "5,000",
        tiktokFollowing: "0",
        tiktokLikes: "50K",
        location: "Dhaka, Bangladesh"
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
            likes: "50K"
        },
        {
            platform: "Facebook",
            username: "Baiilla Maach Official",
            url: "https://www.facebook.com/profile.php?id=61575202118828",
            screenshot: null,
            verified: true,
            followers: "Growing"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            reason: "Impersonating official account by copying content and profile picture to deceive followers.",
            threatLevel: "Critical",
            reportedCount: 156
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            reason: "Using official name and photos without authorization to mislead followers.",
            threatLevel: "High",
            reportedCount: 89
        }
    ]
};

// Session management
const sessions = new Map();

function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: u, createdAt: Date.now() });
    
    // Clean old sessions periodically
    if (sessions.size > 100) {
        const now = Date.now();
        for (const [key, value] of sessions) {
            if (now - value.createdAt > 7200000) {
                sessions.delete(key);
            }
        }
    }
    
    return id;
}

function getSession(id) {
    if (!id) return null;
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
        h.split(';').forEach(x => {
            const parts = x.split('=');
            if (parts.length >= 2) {
                c[parts[0].trim()] = parts.slice(1).join('=').trim();
            }
        });
    }
    return c;
}

// HTML Generation Functions
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const realAcc = DATA.realAccounts;
    const fakeAcc = DATA.fakeAccounts;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#09090b">
<title>Baiilla Maach Official | Verification Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={darkMode:'class',theme:{extend:{colors:{primary:{50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065'},dark:{950:'#09090b',900:'#101014',800:'#18181c',700:'#1f1f23',600:'#27272b',500:'#2e2e32'},accent:{purple:'#9333ea',pink:'#ec4899',green:'#22c55e',red:'#ef4444',amber:'#f59e0b'}},fontFamily:{sans:['Inter','sans-serif']}}}}
</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#09090b 0%,#101014 50%,#141418 100%);color:#e5e5e5;min-height:100vh;overflow-x:hidden;line-height:1.5}
.gradient-text{background:linear-gradient(135deg,#a78bfa 0%,#ec4899 50%,#a78bfa 100%);-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradient-x 3s ease infinite}
@keyframes gradient-x{0%,100%{background-position:left center}50%{background-position:right center}}
.glass{background:rgba(24,24,28,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.04)}
.glass-card{background:rgba(24,24,28,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
.verified-glow{box-shadow:0 0 15px rgba(34,197,94,0.4)}
.danger-glow{box-shadow:0 0 15px rgba(239,68,68,0.4)}
.chat-msg-user{background:rgba(139,92,246,0.15);border-radius:16px 16px 4px 16px}
.chat-msg-admin{background:rgba(255,255,255,0.06);border-radius:16px 16px 16px 4px}
</style>
</head>
<body class="min-h-screen">

<header class="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
<div class="max-w-5xl mx-auto px-3">
<div class="flex items-center justify-between h-12">
<div class="flex items-center gap-2">
<img src="${DATA.celebrity.photo}" alt="" class="w-7 h-7 rounded-full border-2 border-accent-purple object-cover" onerror="this.style.display='none'">
<span class="text-sm font-bold gradient-text">Verification Hub</span>
</div>
<nav class="flex items-center gap-1">
<a href="#official" class="px-2 py-1 text-xs text-gray-400 hover:text-white rounded transition">Official</a>
<a href="#fake" class="px-2 py-1 text-xs text-gray-400 hover:text-red-400 rounded transition">Fake Accounts</a>
<a href="#music" class="px-2 py-1 text-xs text-gray-400 hover:text-green-400 rounded transition">Music</a>
<a href="#chat" class="px-2 py-1 text-xs text-gray-400 hover:text-accent-purple rounded transition">Chat</a>
</nav>
</div>
</div>
</header>

<main class="pt-14 pb-10">
<div class="max-w-5xl mx-auto px-3">

<section class="text-center py-6">
<div class="relative inline-block mb-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-20 h-20 rounded-full border-3 border-accent-purple object-cover mx-auto" onerror="this.style.display='none'">
<div class="absolute -bottom-1 -right-1 w-6 h-6 bg-accent-green rounded-full border-3 border-dark-950 flex items-center justify-center verified-glow">
<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
</div>
<h1 class="text-xl font-extrabold gradient-text mb-1">${DATA.celebrity.fullName}</h1>
<p class="text-xs text-gray-400 mb-3">${DATA.celebrity.bio}</p>
<div class="flex justify-center gap-4 mb-3">
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokFollowers}</div><div class="text-xs text-gray-500 uppercase">Followers</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokFollowing}</div><div class="text-xs text-gray-500 uppercase">Following</div></div>
<div class="glass rounded-xl px-4 py-2"><div class="text-lg font-bold text-white">${DATA.celebrity.tiktokLikes}</div><div class="text-xs text-gray-500 uppercase">Likes</div></div>
</div>
<div class="flex justify-center gap-2 flex-wrap mb-3">
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-accent-green/10 text-accent-green border border-accent-green/25 rounded-full text-xs font-semibold verified-glow">✓ Verified Official</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-accent-purple/10 text-accent-purple border border-accent-purple/25 rounded-full text-xs font-semibold">Creator</span>
<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-700/40 text-gray-300 border border-dark-600 rounded-full text-xs">📍 ${DATA.celebrity.location}</span>
</div>
</section>

<section id="official" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-accent-green/15 flex items-center justify-center verified-glow">
<svg class="w-3.5 h-3.5 text-accent-green" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">✓ Official Verified Accounts</h2>
</div>
<div class="glass-card p-4">
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
<div class="space-y-2">
${realAcc.map(acc => `
<div class="bg-dark-700/40 rounded-xl p-3 border border-dark-600/30">
<div class="flex items-center justify-between mb-2">
<span class="text-xs uppercase text-gray-500 font-semibold">${acc.platform}</span>
<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-green/10 text-accent-green text-xs rounded-full font-semibold">✓ Verified</span>
</div>
<div class="flex items-center gap-2">
${acc.screenshot ? `<img src="${acc.screenshot}" alt="" class="w-12 h-12 rounded-lg object-cover" onerror="this.style.display='none'">` : ''}
<div>
<div class="font-bold text-white text-sm">${acc.username}</div>
<div class="text-xs text-gray-400">${acc.platform}${acc.followers?' • '+acc.followers+' followers':''}</div>
</div>
</div>
</div>`).join('')}
</div>
<div class="bg-dark-700/40 rounded-xl p-4 flex flex-col items-center justify-center text-center">
<img src="${DATA.celebrity.photo}" alt="" class="w-14 h-14 rounded-full border-2 border-accent-green mb-2" onerror="this.style.display='none'">
<div class="text-sm font-bold text-white">@baiillamaach_official</div>
<div class="text-xs text-gray-400 mb-3">TikTok • Facebook</div>
<a href="${realAcc[0].url}" target="_blank" rel="noopener" class="px-5 py-2.5 bg-green-500 hover:bg-green-600 rounded-full text-white font-bold text-xs transition">✓ Follow Official Account</a>
</div>
</div>
</div>
</section>

<section id="fake" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-accent-red/15 flex items-center justify-center danger-glow">
<svg class="w-3.5 h-3.5 text-accent-red" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
</div>
<h2 class="text-base font-bold text-white">⚠️ Fake Accounts Detected</h2>
<span class="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full font-bold">${totalFake} Active</span>
</div>
${fakeAcc.map((a, i) => `
<div class="glass-card border-red-500/20 p-3 mb-3">
<div class="flex items-center justify-between mb-2">
<span class="font-bold text-red-300 text-xs">Fake Account #${i+1}</span>
<span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-bold uppercase">${a.threatLevel}</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
<div class="rounded-xl overflow-hidden border-2 border-red-500/30">
${a.screenshot ? `<img src="${a.screenshot}" alt="" class="w-full h-auto object-cover">` : '<div class="w-full h-40 flex items-center justify-center bg-dark-900 text-red-500">FAKE</div>'}
</div>
<div class="space-y-1.5">
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs">
<span class="text-gray-400">Username</span><span class="text-red-300 font-semibold">${a.username}</span>
</div>
<div class="flex justify-between bg-dark-700/40 rounded-lg px-3 py-1.5 text-xs">
<span class="text-gray-400">Reports</span><span class="text-red-300 font-semibold">${a.reportedCount}+</span>
</div>
<div class="bg-red-500/5 rounded-lg p-2 text-xs text-red-300 border border-red-500/15">⚠️ ${a.reason}</div>
</div>
</div>
<div class="flex gap-2 mt-3">
<a href="${a.profileUrl}" target="_blank" rel="noopener" class="flex-1 text-center px-3 py-2 bg-red-500/20 text-red-400 rounded-full text-xs font-bold hover:bg-red-500/30 transition">Report</a>
<button class="flex-1 px-3 py-2 bg-dark-700 border border-red-500/25 text-red-300 rounded-full text-xs font-bold hover:bg-red-500/10 transition copy-btn" data-username="${a.username}">Copy Username</button>
</div>
</div>
`).join('')}
</section>

${coverSongs.length > 0 ? `
<section id="music" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">🎵</div>
<h2 class="text-base font-bold text-white">Cover Music</h2>
<span class="text-xs text-gray-400 ml-auto">${coverSongs.length} songs</span>
</div>
<div class="glass-card overflow-hidden">
<div class="max-h-64 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-700/40 transition" onclick="playSong('${s.audioUrl}')">
<span class="text-xs text-gray-500 w-5">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1 min-w-0">
<div class="text-xs font-semibold text-white truncate">${s.title}</div>
<div class="text-xs text-gray-500">Cover Song</div>
</div>
</div>`).join('')}
</div>
</div>
</section>` : ''}

<section id="chat" class="py-4">
<div class="flex items-center gap-2 mb-3">
<div class="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center">💬</div>
<h2 class="text-base font-bold text-white">Chat with Hammad Bin Amir</h2>
</div>

<div class="glass-card p-4">
<div id="chatRegisterForm" class="space-y-3">
<p class="text-sm text-gray-300 mb-3">Enter your details to start a conversation</p>
<input type="text" id="chatName" placeholder="Your Name *" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition">
<input type="text" id="chatPhoneEmail" placeholder="Phone Number or Email *" class="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition">
<button onclick="registerChat()" class="w-full py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Start Chat</button>
</div>

<div id="chatInterface" class="hidden">
<div class="h-80 overflow-y-auto mb-3 space-y-2 pr-2" id="chatMessages">
<div class="text-center text-xs text-gray-500 py-4">Loading messages...</div>
</div>
<div class="flex gap-2">
<input type="text" id="chatInput" placeholder="Type your message..." class="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-purple transition" onkeypress="if(event.key==='Enter')sendMessage()">
<button onclick="sendMessage()" class="px-5 py-3 bg-gradient-to-r from-accent-purple to-accent-pink text-white rounded-xl font-bold text-sm hover:shadow-glow transition">Send</button>
</div>
<div class="text-center mt-2">
<button onclick="logoutChat()" class="text-xs text-gray-500 hover:text-red-400 transition">Logout</button>
</div>
</div>
</div>
</section>

</div>
</main>

<audio id="audioPlayer" preload="none"></audio>

<script>
// Copy buttons
document.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', function() {
    navigator.clipboard.writeText(this.dataset.username).then(() => {
        const orig = this.textContent;
        this.textContent = 'Copied!';
        this.classList.add('bg-green-500/20', 'text-green-400');
        setTimeout(() => {
            this.textContent = orig;
            this.classList.remove('bg-green-500/20', 'text-green-400');
        }, 2000);
    });
}));

// Music player
function playSong(url) {
    const ap = document.getElementById('audioPlayer');
    if (ap.src === url && !ap.paused) {
        ap.pause();
    } else {
        ap.src = url;
        ap.play().catch(() => {});
    }
}

// Chat System
let chatToken = '', chatId = '', chatPollInterval;

// Check for existing session on load
function initChat() {
    const saved = localStorage.getItem('chatSession');
    if (saved) {
        try {
            const session = JSON.parse(saved);
            chatToken = session.token;
            chatId = session.chatId;
            document.getElementById('chatRegisterForm').classList.add('hidden');
            document.getElementById('chatInterface').classList.remove('hidden');
            loadChatMessages();
            chatPollInterval = setInterval(loadChatMessages, 3000);
        } catch(e) {
            localStorage.removeItem('chatSession');
        }
    }
}

async function registerChat() {
    const name = document.getElementById('chatName').value.trim();
    const phoneEmail = document.getElementById('chatPhoneEmail').value.trim();
    
    if (!name) return alert('Please enter your name');
    if (!phoneEmail) return alert('Please enter your phone number or email');
    
    try {
        const r = await fetch('/api/chat/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, phoneEmail})
        });
        const d = await r.json();
        
        if (d.success) {
            chatToken = d.sessionToken;
            chatId = d.chatId;
            
            localStorage.setItem('chatSession', JSON.stringify({
                token: chatToken,
                chatId: chatId
            }));
            
            document.getElementById('chatRegisterForm').classList.add('hidden');
            document.getElementById('chatInterface').classList.remove('hidden');
            loadChatMessages();
            chatPollInterval = setInterval(loadChatMessages, 3000);
        } else {
            alert(d.error || 'Registration failed');
        }
    } catch(err) {
        alert('Connection error. Please try again.');
    }
}

async function loadChatMessages() {
    if (!chatToken) return;
    try {
        const r = await fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken));
        const d = await r.json();
        
        if (d.success) {
            const mc = document.getElementById('chatMessages');
            mc.innerHTML = d.messages.map(m => 
                '<div class="flex ' + (m.sender === 'user' ? 'justify-end' : 'justify-start') + '">' +
                '<div class="max-w-[80%] px-4 py-2.5 text-sm ' + (m.sender === 'user' ? 'chat-msg-user text-white' : 'chat-msg-admin text-gray-200') + '">' +
                m.message +
                '<div class="text-xs text-gray-500 mt-1">' + new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + '</div>' +
                '</div></div>'
            ).join('');
            mc.scrollTop = mc.scrollHeight;
        } else {
            clearInterval(chatPollInterval);
            logoutChat();
        }
    } catch(err) {}
}

async function sendMessage() {
    const msg = document.getElementById('chatInput').value.trim();
    if (!msg || !chatToken) return;
    
    try {
        const r = await fetch('/api/chat/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: chatToken, message: msg})
        });
        const d = await r.json();
        
        if (d.success) {
            document.getElementById('chatInput').value = '';
            loadChatMessages();
        }
    } catch(err) {}
}

function logoutChat() {
    clearInterval(chatPollInterval);
    localStorage.removeItem('chatSession');
    chatToken = '';
    chatId = '';
    document.getElementById('chatRegisterForm').classList.remove('hidden');
    document.getElementById('chatInterface').classList.add('hidden');
    document.getElementById('chatInput').value = '';
}

// Initialize chat on load
initChat();
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Admin Login</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 flex items-center justify-center min-h-screen">
<div class="bg-gray-900 p-8 rounded-2xl w-full max-w-md border border-gray-800">
<div class="text-center mb-6">
<h2 class="text-xl font-bold text-white">Admin Login</h2>
</div>
${error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm text-center">${error}</div>` : ''}
<form method="POST" action="/admin/login">
<div class="mb-4">
<label class="block text-gray-400 text-sm mb-1.5">Username</label>
<input type="text" name="username" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" required>
</div>
<div class="mb-5">
<label class="block text-gray-400 text-sm mb-1.5">Password</label>
<input type="password" name="password" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" required>
</div>
<button type="submit" class="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition">Sign In</button>
</form>
<div class="text-center mt-5">
<a href="/" class="text-sm text-gray-500 hover:text-white transition">Back to Home</a>
</div>
</div>
</body>
</html>`;
}

// Server setup
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        const decodedPathname = decodeURIComponent(pathname);
        const assetPath = path.join(__dir, decodedPathname);
        
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403);
            res.end();
            return;
        }
        
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.aac': 'audio/aac',
                '.flac': 'audio/flac'
            };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, {
                'Content-Type': ct,
                'Content-Length': stat.size,
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
        return;
    }

    // Chat API endpoints
    if (pathname === '/api/chat/register' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(body);
                
                if (!phoneEmail || phoneEmail.trim() === '') {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'Phone number or email is required'}));
                    return;
                }
                
                const user = await createOrGetChatUser(name, phoneEmail);
                const sessionToken = await createChatSession(user.chatId);
                
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    success: true,
                    chatId: user.chatId,
                    sessionToken
                }));
            } catch(e) {
                console.error('Register error:', e);
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, error: 'Registration failed. Please try again.'}));
            }
        });
        return;
    }

    if (pathname === '/api/chat/messages' && method === 'GET') {
        const token = parsedUrl.query.token;
        if (!token) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'No session token'}));
            return;
        }
        
        const user = await getChatUserByToken(token);
        if (!user) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: 'Invalid session'}));
            return;
        }
        
        const messages = await getChatMessages(user.chatId);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, messages}));
        return;
    }

    if (pathname === '/api/chat/send' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { token, message } = JSON.parse(body);
                
                if (!token || !message) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'Invalid request'}));
                    return;
                }
                
                const user = await getChatUserByToken(token);
                if (!user) {
                    res.writeHead(401, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, error: 'Invalid session'}));
                    return;
                }
                
                await saveChatMessage(user.chatId, 'user', message);
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: true}));
            } catch(e) {
                console.error('Send error:', e);
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, error: 'Failed to send message'}));
            }
        });
        return;
    }

    // Admin routes
    if (pathname === '/admin' && method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (!s) {
            res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
            res.end(getAdminLoginHTML());
            return;
        }
        
        const photos = await getGalleryPhotos();
        res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Admin Panel</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-200 min-h-screen">
<header class="bg-gray-900 border-b border-gray-800 p-4">
<div class="max-w-6xl mx-auto flex justify-between items-center">
<h1 class="text-lg font-bold text-purple-400">Admin Panel</h1>
<div class="flex gap-2">
<a href="/" class="px-3 py-1.5 bg-gray-800 rounded-lg text-xs hover:bg-gray-700 transition">Site</a>
<a href="/admin/logout" class="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition">Logout</a>
</div>
</div>
</header>
<div class="max-w-6xl mx-auto p-6">
<h2 class="text-lg font-bold text-white mb-4">Gallery (${photos.length})</h2>
${photos.length ? '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">' + photos.map(p => 
    `<div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
        <img src="${p.path}" class="w-full h-40 object-cover">
        <div class="p-3">
            ${p.caption ? `<p class="text-sm text-gray-300">${p.caption}</p>` : ''}
            <p class="text-xs text-gray-500 mt-1">${new Date(p.uploadedAt).toLocaleDateString()}</p>
        </div>
        <form method="POST" action="/admin/delete">
            <input type="hidden" name="photoId" value="${p._id}">
            <button class="w-full py-2 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition" onclick="return confirm('Delete?')">Delete</button>
        </form>
    </div>`).join('') + '</div>' : '<p class="text-gray-500 text-center py-12">No photos yet</p>'}
</div>
</body>
</html>`);
        return;
    }

    if (pathname === '/admin/login' && method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const username = params.get('username');
            const password = params.get('password');
            
            if (await verifyAdmin(username, password)) {
                const sid = createSession(username);
                res.writeHead(302, {
                    'Location': '/admin',
                    'Set-Cookie': `sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`
                });
                res.end();
            } else {
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
                res.end(getAdminLoginHTML('Invalid username or password'));
            }
        });
        return;
    }

    if (pathname === '/admin/logout') {
        sessions.delete(cookies.sessionId);
        res.writeHead(302, {
            'Location': '/admin',
            'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0'
        });
        res.end();
        return;
    }

    if (pathname === '/admin/delete' && method === 'POST') {
        if (!getSession(cookies.sessionId)) {
            res.writeHead(302, {'Location': '/admin'});
            res.end();
            return;
        }
        
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            try {
                const photoId = params.get('photoId');
                const photo = await db.collection('gallery_photos').findOne({_id: new ObjectId(photoId)});
                if (photo) {
                    const fp = path.join(__dir, photo.path);
                    if (fs.existsSync(fp)) fs.unlinkSync(fp);
                }
                await deletePhoto(photoId);
            } catch(e) {}
            res.writeHead(302, {'Location': '/admin'});
            res.end();
        });
        return;
    }

    // Home page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(getMainHTML());
        return;
    }

    // 404
    res.writeHead(404, {'Content-Type': 'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html><head><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center h-screen"><div class="text-center"><h1 class="text-6xl font-bold text-purple-500">404</h1><p class="text-gray-400 mt-2">Page not found</p><a href="/" class="inline-block mt-4 px-5 py-2 bg-purple-600 text-white rounded-lg">Home</a></div></body></html>`);
});

// Start server with health check endpoint for Render
async function start() {
    try {
        await connectDB();
        
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
        });
        
        // Keep alive for Render free tier
        setInterval(() => {
            console.log('Server is alive');
        }, 300000); // Log every 5 minutes
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing server...');
    server.close();
    if (mongoClient) await mongoClient.close();
    process.exit(0);
});

start();

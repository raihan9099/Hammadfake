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
const TEMP_DIR = path.join(__dir, 'temp');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Connection pool for better performance
let dbConnected = false;

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

// Cache for better performance
const cache = {
    coverSongs: null,
    coverSongsTimestamp: 0,
    galleryPhotos: null,
    galleryPhotosTimestamp: 0
};

function getCoverSongs() {
    const now = Date.now();
    if (cache.coverSongs && (now - cache.coverSongsTimestamp) < 300000) {
        return cache.coverSongs;
    }
    
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
        
        const songs = Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
            
        cache.coverSongs = songs;
        cache.coverSongsTimestamp = now;
        return songs;
    } catch (e) { 
        console.error('Error getting cover songs:', e);
        return []; 
    }
}

async function connectDB() {
    if (dbConnected) return true;
    
    try {
        mongoClient = new MongoClient(MONGO_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 10000
        });
        
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        const collections = ['admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        
        for (const col of collections) {
            if (!names.includes(col)) {
                await db.createCollection(col);
            }
        }
        
        // Create indexes for better performance
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { unique: true, sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        await db.collection('chat_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                createdAt: new Date()
            });
        }
        
        dbConnected = true;
        console.log('✅ Database connected and optimized');
        return true;
    } catch (e) {
        console.error('Database connection error:', e.message);
        dbConnected = false;
        return false;
    }
}

// Database operations with error handling
async function getGalleryPhotos() {
    if (!db) return [];
    
    try {
        const now = Date.now();
        if (cache.galleryPhotos && (now - cache.galleryPhotosTimestamp) < 60000) {
            return cache.galleryPhotos;
        }
        
        const photos = await db.collection('gallery_photos')
            .find({})
            .sort({ uploadedAt: -1 })
            .toArray();
            
        cache.galleryPhotos = photos;
        cache.galleryPhotosTimestamp = now;
        return photos;
    } catch (e) {
        console.error('Error fetching gallery:', e);
        return [];
    }
}

async function savePhoto(d) {
    if (!db) return null;
    try {
        const result = await db.collection('gallery_photos').insertOne({
            ...d,
            uploadedAt: new Date()
        });
        cache.galleryPhotosTimestamp = 0; // Invalidate cache
        return result;
    } catch (e) {
        console.error('Error saving photo:', e);
        return null;
    }
}

async function deletePhoto(id) {
    if (!db) return null;
    try {
        const result = await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
        cache.galleryPhotosTimestamp = 0; // Invalidate cache
        return result;
    } catch (e) {
        console.error('Error deleting photo:', e);
        return null;
    }
}

async function verifyAdmin(u, p) {
    if (!db) return u === 'admin' && p === 'admin123';
    try {
        const a = await db.collection('admin_users').findOne({ username: u });
        if (!a) return false;
        return await bcrypt.compare(p, a.password);
    } catch (e) {
        console.error('Admin verification error:', e);
        return false;
    }
}

// Chat functions with improved error handling
async function createOrGetChatUser(name, phoneEmail) {
    if (!db || !phoneEmail || !phoneEmail.trim()) return null;
    
    const clean = phoneEmail.trim().toLowerCase();
    
    try {
        let user = await db.collection('chat_users').findOne({ phoneEmail: clean });
        
        if (user) {
            await db.collection('chat_users').updateOne(
                { _id: user._id },
                { 
                    $set: { 
                        name, 
                        lastSeen: new Date(), 
                        status: 'active' 
                    } 
                }
            );
            return user;
        }
        
        const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        user = {
            chatId,
            name,
            phoneEmail: clean,
            createdAt: new Date(),
            lastSeen: new Date(),
            status: 'active'
        };
        
        await db.collection('chat_users').insertOne(user);
        return user;
    } catch (e) {
        console.error('Error creating chat user:', e);
        return null;
    }
}

async function createChatSession(chatId) {
    if (!db) return null;
    
    try {
        const token = crypto.randomBytes(32).toString('hex');
        await db.collection('chat_sessions').deleteMany({ chatId });
        await db.collection('chat_sessions').insertOne({
            chatId,
            token,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        return token;
    } catch (e) {
        console.error('Error creating session:', e);
        return null;
    }
}

async function getChatUserByToken(token) {
    if (!db || !token) return null;
    
    try {
        const session = await db.collection('chat_sessions').findOne({
            token,
            expiresAt: { $gt: new Date() }
        });
        
        if (!session) return null;
        return await db.collection('chat_users').findOne({ chatId: session.chatId });
    } catch (e) {
        console.error('Error getting user by token:', e);
        return null;
    }
}

async function getChatMessages(chatId) {
    if (!db) return [];
    
    try {
        return await db.collection('chat_messages')
            .find({ chatId })
            .sort({ createdAt: 1 })
            .limit(100)
            .toArray();
    } catch (e) {
        console.error('Error getting messages:', e);
        return [];
    }
}

async function saveChatMessage(chatId, sender, message) {
    if (!db) return null;
    
    try {
        const msg = {
            chatId,
            sender,
            message,
            createdAt: new Date(),
            read: false
        };
        
        await db.collection('chat_messages').insertOne(msg);
        await db.collection('chat_users').updateOne(
            { chatId },
            { $set: { lastSeen: new Date() } }
        );
        return msg;
    } catch (e) {
        console.error('Error saving message:', e);
        return null;
    }
}

async function getAdminChatList() {
    if (!db) return [];
    
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
    } catch (e) {
        console.error('Error getting chat list:', e);
        return [];
    }
}

async function markMessagesRead(chatId) {
    if (!db) return;
    
    try {
        await db.collection('chat_messages').updateMany(
            { chatId, sender: 'user', read: false },
            { $set: { read: true } }
        );
    } catch (e) {
        console.error('Error marking messages read:', e);
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
            reason: "Copies official content and logo to deceive followers.", 
            threatLevel: "Critical", 
            reportedCount: 156 
        },
        { 
            platform: "TikTok", 
            username: "@hammad_fams0", 
            profileUrl: "https://tiktok.com/@hammad_fams0", 
            screenshot: IMAGES.fraud, 
            reason: "Uses official name and photo to mislead followers.", 
            threatLevel: "High", 
            reportedCount: 89 
        }
    ]
};

// Session management with cleanup
const sessions = new Map();

// Cleanup expired sessions every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessions) {
        if (now - value.createdAt > 7200000) {
            sessions.delete(key);
        }
    }
}, 1800000);

function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { 
        username: u, 
        createdAt: Date.now() 
    });
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
        h.split(';').forEach(x => {
            const p = x.split('=');
            c[p[0].trim()] = p[1] ? p[1].trim() : '';
        });
    }
    return c;
}

// Professional White Theme HTML
function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ffffff">
<title>Baiilla Maach | Official Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                success: '#10b981',
                danger: '#ef4444',
                warning: '#f59e0b',
                dark: '#1e293b',
                light: '#f8fafc'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif']
            }
        }
    }
}
</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);color:#1e293b;min-height:100vh}
.glass{background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.1)}
.glass-card{background:white;border:1px solid rgba(0,0,0,0.08);border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);transition:all 0.3s ease}
.glass-card:hover{box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -5px rgba(0,0,0,0.04);transform:translateY(-2px)}
.verified-glow{box-shadow:0 0 20px rgba(16,185,129,0.2)}
.danger-glow{box-shadow:0 0 20px rgba(239,68,68,0.2)}
.gradient-text{background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:12px 24px;border-radius:12px;font-weight:600;transition:all 0.3s ease;border:none;cursor:pointer}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 20px -5px rgba(99,102,241,0.4)}
.btn-success{background:#10b981;color:white;padding:12px 24px;border-radius:12px;font-weight:600;transition:all 0.3s ease;border:none;cursor:pointer}
.btn-success:hover{transform:translateY(-2px);box-shadow:0 10px 20px -5px rgba(16,185,129,0.4)}
.btn-danger{background:#ef4444;color:white;padding:12px 24px;border-radius:12px;font-weight:600;transition:all 0.3s ease;border:none;cursor:pointer}
.btn-danger:hover{transform:translateY(-2px);box-shadow:0 10px 20px -5px rgba(239,68,68,0.4)}

/* Modern Music Player */
.music-player{background:linear-gradient(135deg,#1e293b,#334155);border-radius:20px;padding:24px;color:white;box-shadow:0 20px 40px rgba(0,0,0,0.3)}
.player-controls{display:flex;align-items:center;gap:16px;margin-top:16px}
.play-btn{width:56px;height:56px;border-radius:50%;background:#6366f1;border:none;color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;transition:all 0.3s ease}
.play-btn:hover{transform:scale(1.1);box-shadow:0 10px 20px rgba(99,102,241,0.4)}
.play-btn.playing{background:#10b981}
.progress-bar{flex:1;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;cursor:pointer;position:relative;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:3px;width:0%;transition:width 0.3s ease}
.time-display{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:rgba(255,255,255,0.6)}

/* Modern Chat Widget */
.chat-widget{position:fixed;bottom:24px;right:24px;z-index:9999}
.chat-btn{width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 25px rgba(99,102,241,0.3);transition:all 0.3s;border:none;color:white;font-size:24px}
.chat-btn:hover{transform:scale(1.1)}
.chat-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;min-width:24px;height:24px;font-size:12px;display:none;align-items:center;justify-content:center;font-weight:bold;padding:0 6px}
@keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.1)}100%{transform:scale(1)}}

.chat-window{position:fixed;bottom:100px;right:24px;width:380px;max-width:calc(100vw - 48px);height:600px;max-height:calc(100vh - 140px);background:white;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);display:none;flex-direction:column;border:1px solid rgba(0,0,0,0.1)}
.chat-window.open{display:flex;animation:slideUp 0.3s ease}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.chat-header{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:16px;display:flex;align-items:center;gap:12px;color:white}
.chat-avatar{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;position:relative;border:2px solid rgba(255,255,255,0.3)}
.chat-online{width:10px;height:10px;background:#10b981;border-radius:50%;position:absolute;bottom:2px;right:2px;border:2px solid white}
.chat-header-info{flex:1}
.chat-header-name{font-weight:600;font-size:16px}
.chat-header-status{font-size:12px;opacity:0.9}
.chat-close{background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
.chat-close:hover{background:rgba(255,255,255,0.3)}
.chat-messages{flex:1;overflow-y:auto;padding:20px;background:#f8fafc}
.chat-messages::-webkit-scrollbar{width:6px}
.chat-messages::-webkit-scrollbar-track{background:transparent}
.chat-messages::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
.msg{max-width:75%;padding:10px 14px;margin-bottom:8px;border-radius:16px;font-size:14px;line-height:1.5;word-wrap:break-word;position:relative;animation:fadeIn 0.3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-out{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;margin-left:auto;border-bottom-right-radius:4px}
.msg-in{background:white;color:#1e293b;margin-right:auto;border-bottom-left-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.05)}
.msg-time{font-size:11px;opacity:0.7;margin-top:4px;text-align:right}
.msg-in .msg-time{color:#64748b}
.chat-login{flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 24px;text-align:center;background:#f8fafc}
.chat-login h3{color:#1e293b;margin-bottom:8px;font-size:20px;font-weight:700}
.chat-login p{color:#64748b;font-size:14px;margin-bottom:24px}
.chat-login input{width:100%;background:white;border:2px solid #e2e8f0;padding:12px 16px;border-radius:12px;font-size:14px;margin-bottom:12px;outline:none;transition:all 0.2s;color:#1e293b}
.chat-login input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
.chat-login button{width:100%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;padding:14px;border-radius:12px;font-weight:600;cursor:pointer;font-size:16px;transition:all 0.3s}
.chat-login button:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(99,102,241,0.3)}
.chat-input-area{background:white;padding:16px;display:flex;align-items:center;gap:12px;border-top:1px solid #e2e8f0}
.chat-input-area input{flex:1;background:#f1f5f9;border:2px solid #e2e8f0;padding:12px 16px;border-radius:24px;font-size:14px;outline:none;transition:all 0.2s;color:#1e293b}
.chat-input-area input:focus{border-color:#6366f1;background:white}
.chat-send-btn{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s}
.chat-send-btn:hover{transform:scale(1.1)}
.typing-indicator{display:none;padding:0 20px 8px}
.typing-dots{display:inline-flex;gap:4px;padding:10px 14px;background:white;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05)}
.typing-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:typing 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:0.2s}
.typing-dot:nth-child(3){animation-delay:0.4s}
@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}

@media(max-width:640px){
.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:20px 20px 0 0;height:90vh;max-height:90vh}
.chat-widget{bottom:16px;right:16px}
}

/* Loading Spinner */
.spinner{width:40px;height:40px;border:3px solid #e2e8f0;border-top:3px solid #6366f1;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}

/* Toast Notification */
.toast{position:fixed;top:20px;right:20px;z-index:99999;background:white;padding:16px 24px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);display:flex;align-items:center;gap:12px;transform:translateX(120%);transition:transform 0.3s ease;border-left:4px solid #6366f1}
.toast.show{transform:translateX(0)}
.toast.error{border-left-color:#ef4444}
.toast.success{border-left-color:#10b981}
</style>
</head>
<body>

<!-- Toast Notification Container -->
<div id="toast" class="toast"></div>

<!-- Header -->
<header class="glass sticky top-0 z-40 backdrop-blur-lg">
<div class="max-w-7xl mx-auto px-4">
<div class="flex items-center justify-between h-16">
<div class="flex items-center gap-3">
<img src="${DATA.celebrity.photo}" alt="" class="w-10 h-10 rounded-full border-2 border-primary object-cover shadow-lg" onerror="this.style.display='none'">
<div>
<span class="text-lg font-bold gradient-text">Verification Hub</span>
<p class="text-xs text-gray-500">Official Account Verification</p>
</div>
</div>
<nav class="hidden md:flex items-center gap-2">
<a href="#official" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary rounded-lg hover:bg-primary/5 transition-all">Official</a>
<a href="#fake" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-danger rounded-lg hover:bg-danger/5 transition-all">Fake Alerts</a>
${coverSongs.length > 0 ? '<a href="#music" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary rounded-lg hover:bg-primary/5 transition-all">Music</a>' : ''}
<a href="#gallery" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary rounded-lg hover:bg-primary/5 transition-all">Gallery</a>
</nav>
</div>
</div>
</header>

<!-- Main Content -->
<main class="pt-20 pb-32">
<div class="max-w-7xl mx-auto px-4 space-y-12">

<!-- Profile Section -->
<section class="text-center">
<div class="relative inline-block mb-6">
<img src="${DATA.celebrity.photo}" alt="" class="w-32 h-32 rounded-full border-4 border-primary object-cover mx-auto verified-glow shadow-2xl" onerror="this.style.display='none'">
<div class="absolute -bottom-2 -right-2 w-10 h-10 bg-success rounded-full border-4 border-white flex items-center justify-center shadow-lg">
<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
</svg>
</div>
</div>
<h1 class="text-3xl font-extrabold gradient-text mb-2">${DATA.celebrity.fullName}</h1>
<p class="text-gray-600 mb-6 text-lg">${DATA.celebrity.bio}</p>

<div class="flex justify-center gap-6 mb-6">
<div class="glass-card px-8 py-4">
<div class="text-2xl font-bold text-primary">${DATA.celebrity.tiktokFollowers}</div>
<div class="text-sm text-gray-500 font-medium">Followers</div>
</div>
<div class="glass-card px-8 py-4">
<div class="text-2xl font-bold text-primary">${DATA.celebrity.tiktokFollowing}</div>
<div class="text-sm text-gray-500 font-medium">Following</div>
</div>
<div class="glass-card px-8 py-4">
<div class="text-2xl font-bold text-primary">${DATA.celebrity.tiktokLikes}</div>
<div class="text-sm text-gray-500 font-medium">Likes</div>
</div>
</div>

<div class="flex justify-center gap-4 flex-wrap">
<span class="inline-flex items-center gap-2 px-5 py-2.5 bg-success/10 text-success border border-success/25 rounded-full text-sm font-semibold verified-glow">
<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
Verified Official
</span>
<span class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary border border-primary/25 rounded-full text-sm font-semibold">
<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
Content Creator
</span>
</div>
</section>

<!-- Official Accounts Section -->
<section id="official" class="glass-card p-8">
<div class="flex items-center gap-3 mb-6">
<div class="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center verified-glow">
<svg class="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
</div>
<div>
<h2 class="text-2xl font-bold text-gray-800">Official Verified Accounts</h2>
<p class="text-gray-500 text-sm">Only follow these verified accounts</p>
</div>
<span class="ml-auto px-4 py-2 bg-success/10 text-success border border-success/30 rounded-full text-sm font-bold">✓ VERIFIED</span>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
${DATA.realAccounts.map(acc => `
<div class="bg-gray-50 rounded-2xl p-6 hover:shadow-lg transition-all border border-gray-100">
<div class="flex items-center justify-between mb-4">
<span class="text-xs uppercase text-gray-500 font-semibold">${acc.platform}</span>
<span class="px-3 py-1 bg-success/10 text-success text-xs rounded-full font-semibold">Official</span>
</div>
<div class="flex items-center gap-4 mb-4">
${acc.screenshot ? 
`<img src="${acc.screenshot}" alt="" class="w-16 h-16 rounded-xl object-cover shadow-md">` : 
`<div class="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-md">${acc.platform[0]}</div>`
}
<div>
<div class="font-bold text-gray-800 text-lg">${acc.username}</div>
<div class="text-sm text-gray-500">${acc.followers} followers</div>
</div>
</div>
<a href="${acc.url}" target="_blank" class="block w-full text-center bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all hover:shadow-lg">
Follow Official Account
</a>
</div>
`).join('')}
</div>
</section>

<!-- Fake Accounts Alert Section -->
<section id="fake" class="glass-card p-8 border-danger/20">
<div class="flex items-center gap-3 mb-6">
<div class="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center danger-glow">
<svg class="w-5 h-5 text-danger" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
</div>
<div>
<h2 class="text-2xl font-bold text-gray-800">Fake Accounts Detected</h2>
<p class="text-gray-500 text-sm">Report these impersonating accounts</p>
</div>
<span class="ml-auto px-4 py-2 bg-danger/10 text-danger border border-danger/30 rounded-full text-sm font-bold">${totalFake} Active</span>
</div>

<div class="space-y-6">
${DATA.fakeAccounts.map((a, i) => `
<div class="bg-red-50 rounded-2xl p-6 border-2 border-danger/20">
<div class="flex items-center justify-between mb-4">
<div class="flex items-center gap-3">
<span class="text-2xl">⚠️</span>
<div>
<span class="font-bold text-danger text-lg">Fake Account #${i+1}</span>
<p class="text-sm text-gray-600">${a.platform} Impersonation</p>
</div>
</div>
<span class="px-4 py-1.5 bg-danger/20 text-danger rounded-full text-sm font-bold">${a.threatLevel}</span>
</div>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
<div class="relative rounded-2xl overflow-hidden border-2 border-danger/30">
${a.screenshot ? 
`<img src="${a.screenshot}" alt="" class="w-full opacity-90">` : 
`<div class="w-full h-48 flex items-center justify-center text-4xl text-danger/30 bg-gray-100">⚠️ FAKE</div>`
}
<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent">
<span class="bg-danger text-white px-6 py-2 rounded-xl text-sm font-extrabold shadow-lg">FAKE ACCOUNT</span>
</div>
</div>

<div class="space-y-4">
<div class="bg-white rounded-xl p-4 shadow-sm">
<div class="flex justify-between items-center mb-2">
<span class="text-sm text-gray-500">Username</span>
<span class="font-semibold text-danger">${a.username}</span>
</div>
<div class="flex justify-between items-center">
<span class="text-sm text-gray-500">Reports</span>
<span class="font-semibold text-danger">${a.reportedCount}+</span>
</div>
</div>
<div class="bg-danger/5 rounded-xl p-4 border border-danger/20">
<p class="text-sm text-gray-700"><span class="font-semibold text-danger">⚠️ Warning:</span> ${a.reason}</p>
</div>
<div class="flex gap-3">
<a href="${a.profileUrl}" target="_blank" class="flex-1 btn-danger text-center">
Report Account
</a>
<button class="flex-1 px-4 py-3 bg-white border-2 border-danger/25 text-danger rounded-xl font-semibold hover:bg-danger/5 transition-all" 
onclick="copyToClipboard('${a.username}')">
Copy Username
</button>
</div>
</div>
</div>
</div>
`).join('')}
</div>

<div class="text-center mt-6">
<button onclick="document.getElementById('fakeVoice').play()" class="btn-danger inline-flex items-center gap-2">
🔊 Play Voice Alert
</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="none"></audio>
</section>

<!-- Music Section -->
${coverSongs.length > 0 ? `
<section id="music" class="glass-card p-8">
<div class="flex items-center gap-3 mb-6">
<span class="text-3xl">🎵</span>
<div>
<h2 class="text-2xl font-bold text-gray-800">Cover Music Collection</h2>
<p class="text-gray-500 text-sm">${coverSongs.length} songs available</p>
</div>
</div>

<div class="music-player">
<div class="flex items-center gap-4 mb-4">
<div id="currentCover" class="w-16 h-16 rounded-xl bg-gray-700 flex items-center justify-center text-2xl">
🎵
</div>
<div>
<div id="currentTitle" class="font-semibold text-lg">Select a song</div>
<div id="currentArtist" class="text-sm opacity-75">Artist</div>
</div>
</div>

<div class="progress-bar" onclick="seekAudio(event)">
<div id="progressFill" class="progress-fill"></div>
</div>
<div class="time-display">
<span id="currentTime">0:00</span>
<span id="totalTime">0:00</span>
</div>

<div class="player-controls justify-center">
<button class="play-btn" id="playBtn" onclick="togglePlay()">
▶️
</button>
</div>

<div class="mt-6 space-y-2 max-h-64 overflow-y-auto">
${coverSongs.map((s, i) => `
<div class="flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl cursor-pointer transition-all" 
onclick="playSong('${s.audioUrl}','${s.title}','${s.artist}', '${s.coverUrl || ''}')">
<span class="text-sm opacity-75 w-8">${(i+1).toString().padStart(2,'0')}</span>
<div class="flex-1">
<div class="font-medium">${s.title}</div>
<div class="text-sm opacity-75">${s.artist}</div>
</div>
<button class="text-white/75 hover:text-white">▶️</button>
</div>
`).join('')}
</div>
</div>

<audio id="coverAudio" preload="none"></audio>
</section>` : ''}

<!-- Gallery Section -->
<section id="gallery" class="glass-card p-8">
<div class="flex items-center gap-3 mb-6">
<span class="text-3xl">📸</span>
<div>
<h2 class="text-2xl font-bold text-gray-800">Photo Gallery</h2>
<p class="text-gray-500 text-sm">Official photos and moments</p>
</div>
</div>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
${galleryPhotos.map(p => `
<div class="relative group rounded-2xl overflow-hidden shadow-lg">
<img src="${p.path}" class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-110">
${p.caption ? `
<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-4">
<p class="text-white text-sm font-medium">${p.caption}</p>
</div>
` : ''}
</div>
`).join('')}
</div>
</section>

</div>
</main>

<!-- Chat Widget -->
<div class="chat-widget">
<button class="chat-btn" onclick="toggleChat()" id="chatBtn">
💬
</button>

<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar">
H
<div class="chat-online"></div>
</div>
<div class="chat-header-info">
<div class="chat-header-name">Hammad Bin Amir</div>
<div class="chat-header-status" id="statusText">Online now</div>
</div>
<button class="chat-close" onclick="toggleChat()">✕</button>
</div>

<div id="chatLogin" class="chat-login">
<h3>💬 Chat with Support</h3>
<p>Enter your details to start a conversation</p>
<input type="text" id="userName" placeholder="Your full name">
<input type="email" id="userContact" placeholder="Your email or phone number">
<button onclick="registerChat()">
Start Conversation
</button>
</div>

<div id="chatUI" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages" id="chatMessages">
<div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px">
🔒 Messages are end-to-end encrypted
</div>
</div>
<div class="typing-indicator" id="typingDiv">
<div class="typing-dots">
<div class="typing-dot"></div>
<div class="typing-dot"></div>
<div class="typing-dot"></div>
</div>
<div style="clear:both"></div>
</div>
<div class="chat-input-area">
<input type="text" id="msgInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button class="chat-send-btn" onclick="sendMessage()">
➤
</button>
</div>
</div>
</div>
</div>

<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>

<script>
// Toast notification system
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

// Music player functionality
let currentAudio = null;
let isPlaying = false;

function playSong(url, title, artist, coverUrl) {
    const audio = document.getElementById('coverAudio');
    
    if (currentAudio === url) {
        togglePlay();
        return;
    }
    
    currentAudio = url;
    audio.src = url;
    
    document.getElementById('currentTitle').textContent = title || 'Unknown Title';
    document.getElementById('currentArtist').textContent = artist || 'Unknown Artist';
    
    if (coverUrl) {
        document.getElementById('currentCover').innerHTML = '<img src="' + coverUrl + '" class="w-full h-full object-cover rounded-xl">';
    } else {
        document.getElementById('currentCover').innerHTML = '🎵';
    }
    
    audio.play().then(() => {
        isPlaying = true;
        updatePlayButton();
    }).catch(err => {
        showToast('Error playing audio', 'error');
    });
    
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', () => {
        document.getElementById('totalTime').textContent = formatTime(audio.duration);
    });
    audio.addEventListener('ended', () => {
        isPlaying = false;
        updatePlayButton();
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('currentTime').textContent = '0:00';
    });
}

function togglePlay() {
    const audio = document.getElementById('coverAudio');
    if (!audio.src) return;
    
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        audio.play();
        isPlaying = true;
    }
    updatePlayButton();
}

function updatePlayButton() {
    const btn = document.getElementById('playBtn');
    btn.textContent = isPlaying ? '⏸️' : '▶️';
    btn.className = 'play-btn' + (isPlaying ? ' playing' : '');
}

function updateProgress() {
    const audio = document.getElementById('coverAudio');
    const progress = (audio.currentTime / audio.duration) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
}

function seekAudio(event) {
    const audio = document.getElementById('coverAudio');
    if (!audio.duration) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
}

// Welcome voice
setTimeout(() => {
    const voice = document.getElementById('welcomeVoice');
    if (voice && !sessionStorage.getItem('voicePlayed')) {
        voice.play().catch(() => {});
        sessionStorage.setItem('voicePlayed', '1');
    }
}, 2000);

// Chat system with polling
let chatToken = localStorage.getItem('chatToken');
let chatId = null;
let pollInterval = null;

// Auto login if token exists
if (chatToken) {
    verifyToken();
}

async function verifyToken() {
    try {
        const response = await fetch('/api/chat/verify?token=' + encodeURIComponent(chatToken));
        const data = await response.json();
        
        if (data.success) {
            chatId = data.chatId;
            showChatUI();
            loadMessages();
            startPolling();
        } else {
            localStorage.removeItem('chatToken');
            chatToken = null;
        }
    } catch (error) {
        console.error('Token verification failed:', error);
    }
}

function toggleChat() {
    const window = document.getElementById('chatWindow');
    window.classList.toggle('open');
    
    if (window.classList.contains('open') && chatToken) {
        loadMessages();
    }
}

function showChatUI() {
    document.getElementById('chatLogin').style.display = 'none';
    document.getElementById('chatUI').style.display = 'flex';
}

async function registerChat() {
    const name = document.getElementById('userName').value.trim();
    const contact = document.getElementById('userContact').value.trim();
    
    if (!name) {
        showToast('Please enter your name', 'error');
        return;
    }
    if (!contact) {
        showToast('Please enter your email or phone', 'error');
        return;
    }
    
    // Show loading state
    const loginBtn = document.querySelector('#chatLogin button');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Connecting...';
    loginBtn.disabled = true;
    
    try {
        const response = await fetch('/api/chat/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: name, 
                phoneEmail: contact 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            chatToken = data.token;
            chatId = data.chatId;
            localStorage.setItem('chatToken', chatToken);
            showChatUI();
            loadMessages();
            startPolling();
            showToast('Connected successfully!', 'success');
        } else {
            showToast(data.error || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        showToast('Connection error. Please check your internet and try again.', 'error');
    } finally {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 2000);
}

async function loadMessages() {
    if (!chatToken) return;
    
    try {
        const response = await fetch('/api/chat/messages?token=' + encodeURIComponent(chatToken) + '&t=' + Date.now());
        const data = await response.json();
        
        if (data.success) {
            const container = document.getElementById('chatMessages');
            container.innerHTML = '';
            
            // Add secure message indicator
            const secureMsg = document.createElement('div');
            secureMsg.style.cssText = 'text-align:center;color:#94a3b8;font-size:12px;padding:15px;border-bottom:1px solid #e2e8f0;margin-bottom:10px';
            secureMsg.textContent = '🔒 Messages are secure';
            container.appendChild(secureMsg);
            
            data.messages.forEach(msg => {
                const isUser = msg.sender === 'user';
                const messageDiv = document.createElement('div');
                messageDiv.className = 'msg ' + (isUser ? 'msg-out' : 'msg-in');
                
                const time = new Date(msg.createdAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                messageDiv.innerHTML = 
                    msg.message +
                    '<div class="msg-time">' + 
                    time + 
                    (isUser ? ' ✓✓' : '') +
                    '</div>';
                    
                container.appendChild(messageDiv);
            });
            
            container.scrollTop = container.scrollHeight;
        } else {
            // Token expired
            clearInterval(pollInterval);
            localStorage.removeItem('chatToken');
            chatToken = null;
            document.getElementById('chatLogin').style.display = 'flex';
            document.getElementById('chatUI').style.display = 'none';
            showToast('Session expired. Please login again.', 'error');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const message = input.value.trim();
    
    if (!message || !chatToken) return;
    
    // Optimistically show message
    input.value = '';
    const container = document.getElementById('chatMessages');
    const tempDiv = document.createElement('div');
    tempDiv.className = 'msg msg-out';
    tempDiv.style.opacity = '0.7';
    tempDiv.innerHTML = 
        message +
        '<div class="msg-time">' + 
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
        ' ✓' +
        '</div>';
    container.appendChild(tempDiv);
    container.scrollTop = container.scrollHeight;
    
    try {
        const response = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: chatToken, 
                message: message 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            tempDiv.style.opacity = '1';
            loadMessages(); // Refresh to get correct order
        } else {
            tempDiv.remove();
            showToast('Failed to send message', 'error');
        }
    } catch (error) {
        tempDiv.remove();
        showToast('Error sending message. Please try again.', 'error');
    }
}

// Clean up polling on page unload
window.addEventListener('beforeunload', () => {
    if (pollInterval) clearInterval(pollInterval);
});
</script>
</body>
</html>`;
}

// Server setup with improved error handling
const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const cookies = parseCookies(req.headers.cookie);

    // Serve static files
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, decodeURIComponent(pathname));
        
        // Security check
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const contentTypes = {
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
                '.flac': 'audio/flac',
                '.ico': 'image/x-icon'
            };
            
            res.writeHead(200, {
                'Content-Type': contentTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400'
            });
            
            const stream = fs.createReadStream(assetPath);
            stream.pipe(res);
            stream.on('error', () => {
                res.end();
            });
        } else {
            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }

    // API Routes with improved error handling
    try {
        // Chat API Routes
        if (pathname === '/api/chat/register' && method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { name, phoneEmail } = JSON.parse(body);
                    
                    if (!name || !phoneEmail) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            error: 'Name and contact information are required' 
                        }));
                        return;
                    }
                    
                    const user = await createOrGetChatUser(name, phoneEmail);
                    if (!user) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            error: 'Failed to create user. Please try again.' 
                        }));
                        return;
                    }
                    
                    const token = await createChatSession(user.chatId);
                    
                    // Send welcome message if first time
                    const messages = await getChatMessages(user.chatId);
                    if (messages.length === 0) {
                        await saveChatMessage(
                            user.chatId, 
                            'admin', 
                            'Hello! 👋 Welcome to Baiilla Maach Official Support. How can I help you today?'
                        );
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        chatId: user.chatId, 
                        token, 
                        name: user.name 
                    }));
                } catch (e) {
                    console.error('Registration error:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'Server error. Please try again later.' 
                    }));
                }
            });
            return;
        }

        if (pathname === '/api/chat/verify' && method === 'GET') {
            const token = parsedUrl.query.token;
            const user = await getChatUserByToken(token);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: !!user, 
                chatId: user ? user.chatId : null 
            }));
            return;
        }

        if (pathname === '/api/chat/messages' && method === 'GET') {
            const token = parsedUrl.query.token;
            
            if (!token) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Authentication required' }));
                return;
            }
            
            const user = await getChatUserByToken(token);
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid or expired session' }));
                return;
            }
            
            const messages = await getChatMessages(user.chatId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, messages }));
            return;
        }

        if (pathname === '/api/chat/send' && method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { token, message } = JSON.parse(body);
                    
                    if (!token || !message) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
                        return;
                    }
                    
                    const user = await getChatUserByToken(token);
                    if (!user) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Invalid session' }));
                        return;
                    }
                    
                    await saveChatMessage(user.chatId, 'user', message);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Server error' }));
                }
            });
            return;
        }

        // Admin Routes
        if (pathname === '/admin' && method === 'GET') {
            const session = getSession(cookies.sessionId);
            if (session) {
                const photos = await getGalleryPhotos();
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(await getAdminPanelHTML(photos));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(getAdminLoginHTML());
            return;
        }

        // Main page
        if (pathname === '/' || pathname === '/index.html') {
            const photos = await getGalleryPhotos();
            res.writeHead(200, { 
                'Content-Type': 'text/html;charset=utf-8',
                'Cache-Control': 'public, max-age=3600'
            });
            res.end(getMainHTML(photos));
            return;
        }

        // 404 for unmatched routes
        res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Page Not Found</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        text-align: center;
                    }
                    h1 {
                        font-size: 72px;
                        margin: 0;
                    }
                    p {
                        font-size: 24px;
                        margin: 20px 0;
                    }
                    a {
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        border: 2px solid white;
                        border-radius: 25px;
                        font-weight: bold;
                        transition: all 0.3s;
                    }
                    a:hover {
                        background: white;
                        color: #667eea;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>404</h1>
                    <p>Page not found</p>
                    <a href="/">Go Home</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>500 - Server Error</title></head>
            <body style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
                <h1>500 - Server Error</h1>
                <p>Something went wrong. Please try again later.</p>
                <a href="/">Go Home</a>
            </body>
            </html>
        `);
    }
});

// Start server
async function start() {
    await connectDB();
    
    server.listen(PORT, () => {
        console.log(`
🚀 Server running on port ${PORT}
📱 Main site: http://localhost:${PORT}
⚙️  Admin panel: http://localhost:${PORT}/admin
👤 Default admin: admin / admin123
💬 Chat system: Polling-based (no WebSocket needed)
🎵 Music player: Integrated
        `);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Shutting down gracefully...');
        server.close();
        if (mongoClient) await mongoClient.close();
        process.exit(0);
    });
}

start().catch(console.error);

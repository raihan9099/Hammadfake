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
const CHAT_MEDIA_DIR = path.join(__dir, 'assets', 'chat_media');
const CHAT_VOICE_DIR = path.join(__dir, 'assets', 'chat_voice');
const THUMBNAILS_DIR = path.join(__dir, 'assets', 'thumbnails');
const TEMP_DIR = path.join(__dir, 'assets', 'temp');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_MEDIA_DIR, CHAT_VOICE_DIR, THUMBNAILS_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    banner: "/assets/tiktok_video_Aj2NO.jpeg",
    logo: "/assets/tiktok_video_Aj2NO.jpeg"
};

const VOICE = {
    welcome: "/assets/my%20user%20name.mp3",
    fakeAlert: "/assets/7%20lak%20like%20but%20its%20fake.mp3",
    notification: "/assets/my%20user%20name.mp3"
};

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip'
};

const sessions = new Map();
const rateLimiter = new Map();
const chatConnections = new Map();
const activeUsers = new Map();

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(x => {
        const p = x.split('=');
        c[p[0].trim()] = p[1] ? p[1].trim() : '';
    });
    return c;
}

function createSession(u) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: u, createdAt: Date.now(), ip: '', userAgent: '' });
    return id;
}

function getSession(id) {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; }
    return s;
}

function generateToken() {
    return crypto.randomBytes(48).toString('hex');
}

function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

function sanitize(str) {
    return str.replace(/[<>]/g, '');
}

function formatDate(date) {
    return new Date(date).toISOString();
}

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

function checkRateLimit(ip, limit = 100, window = 60000) {
    const now = Date.now();
    if (!rateLimiter.has(ip)) rateLimiter.set(ip, []);
    const timestamps = rateLimiter.get(ip).filter(t => now - t < window);
    if (timestamps.length >= limit) return false;
    timestamps.push(now);
    rateLimiter.set(ip, timestamps);
    return true;
}

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
            if (!groups[base]) groups[base] = { audio: null, cover: null, files: [] };
            if (audioExts.includes(ext)) groups[base].audio = f;
            if (coverExts.includes(ext)) groups[base].cover = f;
            groups[base].files.push(f);
        });
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
                artist: 'Cover Artist',
                duration: '3:45',
                audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
                coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null,
                genre: 'Cover',
                plays: Math.floor(Math.random() * 10000)
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const collections = [
            'admin_users', 'gallery_photos', 'chat_users', 'chat_messages',
            'chat_sessions', 'notifications', 'reports', 'blocked_users',
            'activity_logs', 'settings', 'music_library', 'user_sessions'
        ];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_messages').createIndex({ chatId: 1, sender: 1, read: 1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { unique: true, sparse: true });
        await db.collection('chat_users').createIndex({ chatId: 1 }, { unique: true });
        await db.collection('chat_sessions').createIndex({ token: 1 }, { unique: true });
        await db.collection('chat_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await db.collection('notifications').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('reports').createIndex({ reportedId: 1, createdAt: -1 });
        await db.collection('activity_logs').createIndex({ createdAt: -1 });
        await db.collection('gallery_photos').createIndex({ uploadedAt: -1 });
        const admins = db.collection('admin_users');
        const adminExists = await admins.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await admins.insertOne({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@verificationhub.com',
                role: 'super_admin',
                createdAt: new Date(),
                lastLogin: null,
                permissions: ['all']
            });
        }
        await db.collection('settings').updateOne(
            { key: 'site_config' },
            {
                $setOnInsert: {
                    key: 'site_config',
                    siteName: 'Verification Hub',
                    maintenance: false,
                    chatEnabled: true,
                    musicEnabled: true,
                    galleryEnabled: true,
                    maxUploadSize: 10,
                    allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'mp4', 'webm'],
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
        console.log('Database connected successfully');
        return true;
    } catch (e) {
        console.error('Database connection error:', e.message);
        return false;
    }
}

async function getGalleryPhotos(page = 1, limit = 20) {
    if (!db) return [];
    try {
        const skip = (page - 1) * limit;
        return await db.collection('gallery_photos')
            .find({})
            .sort({ uploadedAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
    } catch (e) { return []; }
}

async function savePhoto(data) {
    if (!db) return null;
    try {
        const result = await db.collection('gallery_photos').insertOne({
            ...data,
            uploadedAt: new Date(),
            views: 0,
            likes: 0,
            status: 'active'
        });
        await logActivity('photo_upload', data.uploadedBy || 'system', { photoId: result.insertedId });
        return result;
    } catch (e) { return null; }
}

async function deletePhoto(id) {
    if (!db) return null;
    try {
        const photo = await db.collection('gallery_photos').findOne({ _id: new ObjectId(id) });
        if (photo) {
            const filePath = path.join(__dir, photo.path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (photo.thumbnail) {
                const thumbPath = path.join(__dir, photo.thumbnail);
                if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            }
        }
        const result = await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) });
        await logActivity('photo_delete', 'admin', { photoId: id });
        return result;
    } catch (e) { return null; }
}

async function updatePhotoViews(id) {
    if (!db) return;
    try {
        await db.collection('gallery_photos').updateOne(
            { _id: new ObjectId(id) },
            { $inc: { views: 1 } }
        );
    } catch (e) {}
}

async function verifyAdmin(username, password) {
    if (!db) return username === 'admin' && password === 'admin123';
    try {
        const admin = await db.collection('admin_users').findOne({ username });
        if (!admin) return false;
        const isValid = await bcrypt.compare(password, admin.password);
        if (isValid) {
            await db.collection('admin_users').updateOne(
                { username },
                { $set: { lastLogin: new Date() } }
            );
        }
        return isValid;
    } catch (e) { return false; }
}

async function logActivity(action, user, details = {}) {
    if (!db) return;
    try {
        await db.collection('activity_logs').insertOne({
            action,
            user,
            details,
            ip: details.ip || 'unknown',
            createdAt: new Date()
        });
    } catch (e) {}
}

async function createOrGetChatUser(name, phoneEmail, ip) {
    if (!phoneEmail || !phoneEmail.trim()) return null;
    const clean = phoneEmail.trim().toLowerCase();
    try {
        let user = await db.collection('chat_users').findOne({ phoneEmail: clean });
        if (user) {
            if (user.status === 'blocked') return null;
            await db.collection('chat_users').updateOne(
                { _id: user._id },
                {
                    $set: {
                        name: name || user.name,
                        lastSeen: new Date(),
                        status: 'active',
                        ip: ip || user.ip
                    },
                    $inc: { visitCount: 1 }
                }
            );
            return user;
        }
        const chatId = 'CH-' + crypto.randomBytes(6).toString('hex').toUpperCase();
        user = {
            chatId,
            name: name || 'User',
            phoneEmail: clean,
            createdAt: new Date(),
            lastSeen: new Date(),
            status: 'active',
            ip: ip || 'unknown',
            visitCount: 1,
            totalMessages: 0,
            avatar: null
        };
        await db.collection('chat_users').insertOne(user);
        await logActivity('new_user', 'system', { chatId, phoneEmail: clean });
        return user;
    } catch (e) {
        console.error('Create user error:', e);
        return null;
    }
}

async function createChatSession(chatId, ip) {
    const token = generateToken();
    try {
        await db.collection('chat_sessions').deleteMany({ chatId });
        await db.collection('chat_sessions').insertOne({
            chatId,
            token,
            ip: ip || 'unknown',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            active: true
        });
        return token;
    } catch (e) { return null; }
}

async function getChatUserByToken(token) {
    if (!token) return null;
    try {
        const session = await db.collection('chat_sessions').findOne({
            token,
            expiresAt: { $gt: new Date() },
            active: true
        });
        if (!session) return null;
        const user = await db.collection('chat_users').findOne({ chatId: session.chatId });
        return user;
    } catch (e) { return null; }
}

async function getChatMessages(chatId, limit = 100, before = null) {
    try {
        const query = { chatId };
        if (before) query.createdAt = { $lt: new Date(before) };
        return await db.collection('chat_messages')
            .find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray()
            .then(msgs => msgs.reverse());
    } catch (e) { return []; }
}

async function saveChatMessage(chatId, sender, message, type = 'text', fileUrl = null, fileSize = null) {
    try {
        const msg = {
            chatId,
            sender,
            message,
            type,
            fileUrl,
            fileSize,
            createdAt: new Date(),
            read: false,
            delivered: true,
            edited: false,
            deleted: false
        };
        const result = await db.collection('chat_messages').insertOne(msg);
        await db.collection('chat_users').updateOne(
            { chatId },
            {
                $set: { lastSeen: new Date() },
                $inc: { totalMessages: 1 }
            }
        );
        return { ...msg, _id: result.insertedId };
    } catch (e) { return null; }
}

async function markMessagesRead(chatId) {
    try {
        await db.collection('chat_messages').updateMany(
            { chatId, sender: 'user', read: false },
            { $set: { read: true, readAt: new Date() } }
        );
    } catch (e) {}
}

async function getAdminChatList() {
    try {
        const users = await db.collection('chat_users')
            .find({ status: { $ne: 'deleted' } })
            .sort({ lastSeen: -1 })
            .toArray();
        const list = [];
        for (const u of users) {
            const lastMsg = await db.collection('chat_messages')
                .findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
            const unread = await db.collection('chat_messages')
                .countDocuments({ chatId: u.chatId, sender: 'user', read: false });
            list.push({
                chatId: u.chatId,
                name: u.name,
                phoneEmail: u.phoneEmail,
                lastSeen: u.lastSeen,
                lastMessage: lastMsg,
                unread,
                totalMessages: u.totalMessages,
                status: u.status
            });
        }
        return list;
    } catch (e) { return []; }
}

async function deleteMessage(messageId, chatId) {
    try {
        const result = await db.collection('chat_messages').updateOne(
            { _id: new ObjectId(messageId), chatId },
            { $set: { deleted: true, deletedAt: new Date() } }
        );
        return result;
    } catch (e) { return null; }
}

async function editMessage(messageId, chatId, newMessage) {
    try {
        const result = await db.collection('chat_messages').updateOne(
            { _id: new ObjectId(messageId), chatId },
            { $set: { message: newMessage, edited: true, editedAt: new Date() } }
        );
        return result;
    } catch (e) { return null; }
}

async function getUnreadCount(chatId) {
    try {
        return await db.collection('chat_messages')
            .countDocuments({ chatId, sender: 'admin', read: false });
    } catch (e) { return 0; }
}

async function blockUser(chatId, reason) {
    try {
        await db.collection('chat_users').updateOne(
            { chatId },
            { $set: { status: 'blocked', blockedAt: new Date(), blockReason: reason } }
        );
        await db.collection('chat_sessions').updateMany(
            { chatId },
            { $set: { active: false } }
        );
        await logActivity('block_user', 'admin', { chatId, reason });
        return true;
    } catch (e) { return false; }
}

async function unblockUser(chatId) {
    try {
        await db.collection('chat_users').updateOne(
            { chatId },
            { $set: { status: 'active', unblockedAt: new Date() }, $unset: { blockReason: '', blockedAt: '' } }
        );
        await logActivity('unblock_user', 'admin', { chatId });
        return true;
    } catch (e) { return false; }
}

async function getStatistics() {
    try {
        const totalUsers = await db.collection('chat_users').countDocuments();
        const activeChats = await db.collection('chat_users').countDocuments({ status: 'active' });
        const totalMessages = await db.collection('chat_messages').countDocuments();
        const totalPhotos = await db.collection('gallery_photos').countDocuments();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMessages = await db.collection('chat_messages').countDocuments({ createdAt: { $gte: today } });
        const todayUsers = await db.collection('chat_users').countDocuments({ createdAt: { $gte: today } });
        return {
            totalUsers,
            activeChats,
            totalMessages,
            totalPhotos,
            todayMessages,
            todayUsers
        };
    } catch (e) { return {}; }
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile",
        tiktokFollowers: "5,000",
        tiktokFollowing: "0",
        tiktokLikes: "50K",
        location: "Dhaka, Bangladesh",
        verified: true,
        premium: true
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
            reason: "Copies official content and logo to deceive followers",
            threatLevel: "Critical",
            reportedCount: 156
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            reason: "Uses official name and photo to mislead followers",
            threatLevel: "High",
            reportedCount: 89
        }
    ]
};

function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': stat.size,
                'Cache-Control': 'public, max-age=31536000',
                'ETag': crypto.createHash('md5').update(stat.size + '-' + stat.mtime.getTime()).digest('hex')
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    } catch (e) {
        res.writeHead(500);
        res.end('Server Error');
    }
}

function sendJSON(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function sendHTML(res, html, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

function redirect(res, location, status = 302) {
    res.writeHead(status, { 'Location': location });
    res.end();
}

function setCookie(res, name, value, options = {}) {
    const defaults = {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 7200,
        secure: false
    };
    const opts = { ...defaults, ...options };
    let cookie = `${name}=${value}; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=${opts.sameSite}`;
    if (opts.httpOnly) cookie += '; HttpOnly';
    if (opts.secure) cookie += '; Secure';
    res.setHeader('Set-Cookie', cookie);
}

async function handleFileUpload(req, uploadDir, maxSize = 10 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm({
            uploadDir,
            keepExtensions: true,
            maxFileSize: maxSize,
            multiples: false
        });
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}

function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#000000">
<meta name="description" content="Official Verification Hub">
<title>Verification Hub</title>
<style>
:root {
    --bg-primary: #0a0a0a;
    --bg-secondary: #141414;
    --bg-tertiary: #1a1a1a;
    --bg-card: #1e1e1e;
    --bg-hover: #252525;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
    --text-tertiary: #707070;
    --accent-blue: #3b82f6;
    --accent-green: #22c55e;
    --accent-red: #ef4444;
    --accent-purple: #8b5cf6;
    --accent-pink: #ec4899;
    --accent-yellow: #eab308;
    --accent-cyan: #06b6d4;
    --gradient-1: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --gradient-2: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --gradient-3: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    --gradient-4: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    --gradient-5: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    --border-color: rgba(255,255,255,0.08);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
    --shadow-lg: 0 10px 25px rgba(0,0,0,0.5);
    --shadow-xl: 0 20px 50px rgba(0,0,0,0.6);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --radius-full: 9999px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;background:var(--bg-primary);color:var(--text-primary);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg-secondary)}
::-webkit-scrollbar-thumb{background:var(--text-tertiary);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--text-secondary)}
.container{max-width:1200px;margin:0 auto;padding:0 20px}
.header{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(10,10,10,0.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--border-color)}
.header-inner{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{display:flex;align-items:center;gap:12px;text-decoration:none}
.logo-img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--accent-green)}
.logo-text{font-size:18px;font-weight:700;background:var(--gradient-1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.nav{display:flex;align-items:center;gap:4px}
.nav-link{padding:8px 16px;color:var(--text-secondary);text-decoration:none;font-size:14px;font-weight:500;border-radius:var(--radius-full);transition:all 0.2s}
.nav-link:hover{color:var(--text-primary);background:var(--bg-hover)}
.nav-link.active{color:var(--accent-blue);background:rgba(59,130,246,0.1)}
.main{padding-top:80px;padding-bottom:120px}
.hero{text-align:center;padding:60px 0}
.hero-avatar{position:relative;display:inline-block;margin-bottom:24px}
.hero-avatar img{width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--accent-green);box-shadow:0 0 30px rgba(34,197,94,0.3)}
.hero-badge{position:absolute;bottom:0;right:0;width:28px;height:28px;background:var(--accent-green);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid var(--bg-primary)}
.hero-badge svg{width:14px;height:14px;fill:white}
.hero-title{font-size:28px;font-weight:800;margin-bottom:8px;background:var(--gradient-1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-subtitle{font-size:14px;color:var(--text-secondary);margin-bottom:24px}
.stats{display:flex;justify-content:center;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.stat-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 24px;text-align:center;min-width:100px}
.stat-value{font-size:20px;font-weight:700;color:var(--text-primary)}
.stat-label{font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px}
.badges{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--radius-full);font-size:12px;font-weight:600}
.badge-verified{background:rgba(34,197,94,0.1);color:var(--accent-green);border:1px solid rgba(34,197,94,0.2)}
.badge-premium{background:rgba(139,92,246,0.1);color:var(--accent-purple);border:1px solid rgba(139,92,246,0.2)}
.badge-creator{background:rgba(236,72,153,0.1);color:var(--accent-pink);border:1px solid rgba(236,72,153,0.2)}
.social-links{display:flex;justify-content:center;gap:12px}
.social-link{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-full);color:var(--text-secondary);text-decoration:none;font-size:14px;font-weight:500;transition:all 0.2s}
.social-link:hover{background:var(--bg-hover);color:var(--text-primary);border-color:var(--accent-blue)}
.section{padding:40px 0}
.section-header{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.section-icon{width:40px;height:40px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:20px}
.section-title{font-size:20px;font-weight:700}
.section-badge{padding:4px 10px;border-radius:var(--radius-full);font-size:11px;font-weight:600}
.grid{display:grid;gap:16px}
.grid-2{grid-template-columns:repeat(2,1fr)}
.grid-3{grid-template-columns:repeat(3,1fr)}
.grid-4{grid-template-columns:repeat(4,1fr)}
.card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);overflow:hidden;transition:all 0.3s}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.card-body{padding:20px}
.card-image{width:100%;height:200px;object-fit:cover}
.card-title{font-size:16px;font-weight:600;margin-bottom:8px}
.card-text{font-size:14px;color:var(--text-secondary);line-height:1.6}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 20px;border-radius:var(--radius-full);font-size:14px;font-weight:600;text-decoration:none;border:none;cursor:pointer;transition:all 0.2s}
.btn-primary{background:var(--accent-blue);color:white}
.btn-primary:hover{background:#2563eb;transform:translateY(-1px)}
.btn-success{background:var(--accent-green);color:white}
.btn-danger{background:var(--accent-red);color:white}
.btn-outline{background:transparent;border:1px solid var(--border-color);color:var(--text-secondary)}
.btn-outline:hover{background:var(--bg-hover);color:var(--text-primary)}
.btn-sm{padding:6px 14px;font-size:12px}
.btn-lg{padding:14px 28px;font-size:16px}
.alert{padding:12px 16px;border-radius:var(--radius-md);font-size:14px;margin-bottom:16px}
.alert-success{background:rgba(34,197,94,0.1);color:var(--accent-green);border:1px solid rgba(34,197,94,0.2)}
.alert-danger{background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2)}
.alert-info{background:rgba(59,130,246,0.1);color:var(--accent-blue);border:1px solid rgba(59,130,246,0.2)}
.fake-card{border-left:3px solid var(--accent-red)}
.official-card{border-left:3px solid var(--accent-green)}
.music-list{max-height:400px;overflow-y:auto}
.music-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s}
.music-item:hover{background:var(--bg-hover)}
.music-item.active{background:rgba(59,130,246,0.1)}
.music-number{width:24px;text-align:center;font-size:12px;color:var(--text-tertiary)}
.music-info{flex:1}
.music-title{font-size:14px;font-weight:500}
.music-artist{font-size:12px;color:var(--text-tertiary)}
.music-play{width:32px;height:32px;border-radius:50%;background:var(--accent-blue);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px}
.chat-widget{position:fixed;bottom:24px;right:24px;z-index:9999}
.chat-toggle{width:60px;height:60px;border-radius:50%;background:var(--gradient-3);border:none;cursor:pointer;box-shadow:0 8px 25px rgba(59,130,246,0.4);transition:all 0.3s;display:flex;align-items:center;justify-content:center}
.chat-toggle:hover{transform:scale(1.1);box-shadow:0 12px 35px rgba(59,130,246,0.5)}
.chat-toggle svg{width:28px;height:28px;fill:white}
.chat-badge{position:absolute;top:-4px;right:-4px;background:var(--accent-red);color:white;border-radius:50%;min-width:22px;height:22px;font-size:11px;display:none;align-items:center;justify-content:center;font-weight:700;padding:0 4px}
.chat-window{position:fixed;bottom:100px;right:24px;width:380px;max-width:calc(100vw - 48px);height:600px;max-height:calc(100vh - 140px);background:var(--bg-secondary);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-xl);display:none;flex-direction:column;border:1px solid var(--border-color)}
.chat-window.open{display:flex}
.chat-header{background:var(--gradient-3);padding:16px;display:flex;align-items:center;gap:12px}
.chat-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden}
.chat-avatar img{width:100%;height:100%;object-fit:cover}
.chat-header-info{flex:1}
.chat-header-name{font-weight:600;font-size:15px;color:white}
.chat-header-status{font-size:12px;color:rgba(255,255,255,0.8)}
.chat-close{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:white;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.chat-body{flex:1;display:flex;flex-direction:column}
.chat-login{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center}
.chat-login-avatar{width:70px;height:70px;border-radius:50%;background:var(--gradient-1);display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:16px;overflow:hidden}
.chat-login-avatar img{width:100%;height:100%;object-fit:cover}
.chat-login h3{font-size:18px;margin-bottom:8px}
.chat-login p{font-size:13px;color:var(--text-secondary);margin-bottom:20px}
.chat-input{width:100%;padding:12px;background:var(--bg-tertiary);border:2px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;margin-bottom:10px;outline:none}
.chat-input:focus{border-color:var(--accent-blue)}
.chat-btn{width:100%;padding:14px;background:var(--gradient-3);color:white;border:none;border-radius:var(--radius-md);font-size:15px;font-weight:600;cursor:pointer}
.chat-messages{flex:1;overflow-y:auto;padding:16px;background:var(--bg-primary)}
.chat-message{display:flex;margin-bottom:12px;animation:fadeIn 0.3s}
.chat-message.user{justify-content:flex-end}
.chat-message.admin{justify-content:flex-start}
.chat-bubble{max-width:75%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-wrap:break-word}
.user .chat-bubble{background:var(--accent-blue);color:white;border-bottom-right-radius:4px}
.admin .chat-bubble{background:var(--bg-card);color:var(--text-primary);border-bottom-left-radius:4px}
.chat-time{font-size:10px;opacity:0.6;margin-top:4px;text-align:right}
.chat-input-area{display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg-tertiary);border-top:1px solid var(--border-color)}
.chat-input-field{flex:1;padding:10px 16px;background:var(--bg-card);border:none;border-radius:24px;color:var(--text-primary);font-size:14px;outline:none}
.chat-input-actions{display:flex;gap:4px}
.chat-action-btn{width:36px;height:36px;border-radius:50%;background:transparent;border:none;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.2s}
.chat-action-btn:hover{background:var(--bg-hover);color:var(--accent-blue)}
.chat-send-btn{width:38px;height:38px;border-radius:50%;background:var(--accent-blue);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px}
.chat-image{max-width:200px;border-radius:var(--radius-md);cursor:pointer}
.chat-voice{display:flex;align-items:center;gap:8px;padding:8px 12px;min-width:120px}
.chat-voice-play{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center}
.voice-waves{display:flex;align-items:center;gap:2px;flex:1}
.voice-wave{width:3px;border-radius:2px;animation:wave 1s ease-in-out infinite}
.recording{display:none;align-items:center;gap:8px;padding:8px 16px;background:rgba(239,68,68,0.1);border-radius:var(--radius-md)}
.recording.active{display:flex}
.recording-dot{width:8px;height:8px;border-radius:50%;background:var(--accent-red);animation:pulse 1s infinite}
.recording-time{font-size:12px;color:var(--accent-red);font-weight:600}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes wave{0%,100%{height:4px}50%{height:16px}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@media(max-width:768px){
.grid-2,.grid-3,.grid-4{grid-template-columns:1fr}
.chat-window{width:100%;max-width:100%;bottom:0;right:0;border-radius:var(--radius-lg) var(--radius-lg) 0 0;height:100%;max-height:100%}
.hero-title{font-size:24px}
.stats{gap:8px}
.stat-card{padding:12px 16px;min-width:80px}
.stat-value{font-size:16px}
}
</style>
</head>
<body>
<header class="header">
<div class="container header-inner">
<a href="/" class="logo">
<img src="${DATA.celebrity.photo}" alt="" class="logo-img" onerror="this.style.display='none'">
<span class="logo-text">Verification Hub</span>
</a>
<nav class="nav">
<a href="#official" class="nav-link">Official</a>
<a href="#fakes" class="nav-link">Fakes</a>
${coverSongs.length > 0 ? '<a href="#music" class="nav-link">Music</a>' : ''}
<a href="#gallery" class="nav-link">Gallery</a>
</nav>
</div>
</header>
<main class="main container">
<section class="hero">
<div class="hero-avatar">
<img src="${DATA.celebrity.photo}" alt="" onerror="this.style.display='none'">
<div class="hero-badge"><svg viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></div>
</div>
<h1 class="hero-title">${DATA.celebrity.fullName}</h1>
<p class="hero-subtitle">${DATA.celebrity.bio} • ${DATA.celebrity.location}</p>
<div class="stats">
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokFollowing}</div><div class="stat-label">Following</div></div>
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokLikes}</div><div class="stat-label">Likes</div></div>
</div>
<div class="badges">
<span class="badge badge-verified">✓ Verified Official</span>
<span class="badge badge-premium">◆ Premium Creator</span>
<span class="badge badge-creator">★ Content Creator</span>
</div>
<div class="social-links">
<a href="${DATA.realAccounts[0].url}" target="_blank" class="social-link">
<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 01-5.76 0 2.89 2.89 0 012.89-2.89h.74V9.54a6.39 6.39 0 00-7.5 6.35 6.39 6.39 0 006.39 6.39 6.41 6.41 0 006.41-6.4v-7.1a8.3 8.3 0 004.85 1.53V6.69h-.8z"/></svg>
TikTok
</a>
<a href="${DATA.realAccounts[1].url}" target="_blank" class="social-link">
<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
Facebook
</a>
</div>
</section>
<section id="official" class="section">
<div class="section-header">
<div class="section-icon" style="background:rgba(34,197,94,0.1)">✓</div>
<h2 class="section-title">Official Verified Accounts</h2>
<span class="section-badge" style="background:rgba(34,197,94,0.1);color:#22c55e">Verified</span>
</div>
<div class="grid grid-2">
${DATA.realAccounts.map(acc => `
<div class="card official-card">
<div class="card-body">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
<span style="font-size:12px;color:var(--text-tertiary);text-transform:uppercase;font-weight:600">${acc.platform}</span>
<span style="font-size:11px;background:rgba(34,197,94,0.1);color:#22c55e;padding:2px 8px;border-radius:var(--radius-full)">✓ Verified</span>
</div>
<div style="display:flex;align-items:center;gap:12px">
${acc.screenshot ? `<img src="${acc.screenshot}" style="width:48px;height:48px;border-radius:var(--radius-md);object-fit:cover">` : `<div style="width:48px;height:48px;border-radius:var(--radius-md);background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${acc.platform[0]}</div>`}
<div>
<div style="font-weight:600;font-size:15px">${acc.username}</div>
<div style="font-size:13px;color:var(--text-tertiary)">${acc.followers} followers</div>
</div>
</div>
</div>
</div>`).join('')}
<div class="card" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:30px">
<div>
<img src="${DATA.celebrity.photo}" style="width:60px;height:60px;border-radius:50%;border:2px solid var(--accent-green);margin-bottom:12px" onerror="this.style.display='none'">
<div style="font-weight:600;font-size:15px;margin-bottom:4px">@baiillamaach_official</div>
<div style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px">The only authentic account</div>
<a href="${DATA.realAccounts[0].url}" target="_blank" class="btn btn-success">Follow Official Account</a>
</div>
</div>
</div>
</section>
<section id="fakes" class="section">
<div class="section-header">
<div class="section-icon" style="background:rgba(239,68,68,0.1)">⚠</div>
<h2 class="section-title">Fake Accounts Detected</h2>
<span class="section-badge" style="background:rgba(239,68,68,0.1);color:#ef4444">${totalFake} Active</span>
</div>
<div class="grid" style="gap:16px">
${DATA.fakeAccounts.map((acc, i) => `
<div class="card fake-card">
<div class="card-body">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
<span style="color:var(--accent-red);font-weight:600">⚠ Fake Account #${i+1}</span>
<span style="font-size:11px;background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 8px;border-radius:var(--radius-full)">${acc.threatLevel}</span>
</div>
<div class="grid grid-2" style="gap:12px">
${acc.screenshot ? `<div style="border-radius:var(--radius-md);overflow:hidden;border:2px solid rgba(239,68,68,0.3)"><img src="${acc.screenshot}" style="width:100%;display:block"></div>` : ''}
<div>
<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:8px">
<span style="font-size:13px;color:var(--text-tertiary)">Username</span>
<span style="font-size:13px;color:var(--accent-red);font-weight:500">${acc.username}</span>
</div>
<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:8px">
<span style="font-size:13px;color:var(--text-tertiary)">Reports</span>
<span style="font-size:13px;color:var(--accent-red);font-weight:500">${acc.reportedCount}+</span>
</div>
<div style="padding:8px 12px;background:rgba(239,68,68,0.05);border-radius:var(--radius-md);font-size:12px;color:var(--accent-red)">${acc.reason}</div>
</div>
</div>
<div style="display:flex;gap:8px;margin-top:12px">
<a href="${acc.profileUrl}" target="_blank" class="btn btn-danger btn-sm" style="flex:1">Report Account</a>
<button class="btn btn-outline btn-sm" style="flex:1" onclick="navigator.clipboard.writeText('${acc.username}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Username',2000)">Copy Username</button>
</div>
</div>
</div>`).join('')}
</div>
</section>
${coverSongs.length > 0 ? `
<section id="music" class="section">
<div class="section-header">
<div class="section-icon" style="background:rgba(59,130,246,0.1)">🎵</div>
<h2 class="section-title">Cover Music</h2>
<span class="section-badge" style="background:rgba(59,130,246,0.1);color:#3b82f6">${coverSongs.length} Songs</span>
</div>
<div class="card">
<div class="card-body music-list">
${coverSongs.map((song, i) => `
<div class="music-item" onclick="playMusic('${song.audioUrl}','${song.title}',${i})" id="music-${i}">
<span class="music-number">${(i+1).toString().padStart(2,'0')}</span>
<div class="music-info">
<div class="music-title">${song.title}</div>
<div class="music-artist">${song.artist}</div>
</div>
<button class="music-play">▶</button>
</div>`).join('')}
</div>
</div>
</section>` : ''}
</main>
<div class="chat-widget">
<button class="chat-toggle" onclick="toggleChat()" id="chatToggle">
<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
<span class="chat-badge" id="unreadBadge">0</span>
</button>
<div class="chat-window" id="chatWindow">
<div class="chat-header">
<div class="chat-avatar"><img src="${DATA.celebrity.photo}" onerror="this.innerHTML='H'"></div>
<div class="chat-header-info">
<div class="chat-header-name">Hammad Bin Amir</div>
<div class="chat-header-status">Online</div>
</div>
<button class="chat-close" onclick="toggleChat()">✕</button>
</div>
<div class="chat-body">
<div class="chat-login" id="chatLogin">
<div class="chat-login-avatar"><img src="${DATA.celebrity.photo}" onerror="this.innerHTML='H'"></div>
<h3>Chat with Hammad</h3>
<p>Enter your details to start</p>
<input type="text" class="chat-input" id="userName" placeholder="Your name">
<input type="text" class="chat-input" id="userContact" placeholder="Phone or email">
<button class="chat-btn" onclick="registerChat()">Start Chat</button>
</div>
<div id="chatInterface" style="display:none;flex:1;flex-direction:column">
<div class="chat-messages" id="chatMessages"></div>
<div class="chat-input-area">
<input type="file" id="imageInput" accept="image/*" style="display:none" onchange="sendImage()">
<div class="chat-input-actions">
<button class="chat-action-btn" onclick="document.getElementById('imageInput').click()">📷</button>
<button class="chat-action-btn" id="voiceRecordBtn" onclick="toggleRecording()">🎤</button>
</div>
<input type="text" class="chat-input-field" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
<button class="chat-send-btn" onclick="sendMessage()">➤</button>
</div>
</div>
</div>
</div>
</div>
<audio id="musicPlayer" preload="none"></audio>
<audio id="notificationSound" src="${VOICE.notification}" preload="none"></audio>
<script>
let chatToken = localStorage.getItem('chatToken');
let chatId = null;
let pollInterval = null;
let currentTrack = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingInterval = null;
let recordingSeconds = 0;
if(chatToken) verifyToken();
function toggleChat(){
document.getElementById('chatWindow').classList.toggle('open');
if(document.getElementById('chatWindow').classList.contains('open') && chatToken) loadMessages();
}
async function verifyToken(){
try{
const r=await fetch('/api/chat/verify?token='+encodeURIComponent(chatToken));
const d=await r.json();
if(d.success){chatId=d.chatId;showChatInterface();loadMessages();startPolling()}
else{localStorage.removeItem('chatToken');chatToken=null}
}catch(e){}
}
function showChatInterface(){
document.getElementById('chatLogin').style.display='none';
document.getElementById('chatInterface').style.display='flex';
}
async function registerChat(){
const name=document.getElementById('userName').value.trim();
const contact=document.getElementById('userContact').value.trim();
if(!name||!contact){alert('Please fill all fields');return}
try{
const r=await fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phoneEmail:contact})});
const d=await r.json();
if(d.success){chatToken=d.token;chatId=d.chatId;localStorage.setItem('chatToken',chatToken);showChatInterface();loadMessages();startPolling()}
else alert(d.error||'Registration failed')
}catch(e){alert('Connection error')}
}
function startPolling(){if(pollInterval)clearInterval(pollInterval);pollInterval=setInterval(loadMessages,3000)}
async function loadMessages(){
if(!chatToken)return;
try{
const r=await fetch('/api/chat/messages?token='+encodeURIComponent(chatToken)+'&t='+Date.now());
const d=await r.json();
if(d.success){
const c=document.getElementById('chatMessages');
c.innerHTML='';
d.messages.forEach(m=>{
const div=document.createElement('div');
div.className='chat-message '+(m.sender==='user'?'user':'admin');
if(m.type==='image'&&m.fileUrl){
div.innerHTML='<div class="chat-bubble"><img src="'+m.fileUrl+'" class="chat-image" onclick="window.open(\''+m.fileUrl+'\')"><div class="chat-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
}else if(m.type==='voice'&&m.fileUrl){
div.innerHTML='<div class="chat-bubble chat-voice"><button class="chat-voice-play" onclick="playVoice(\''+m.fileUrl+'\',this)">▶</button><div class="voice-waves">'+Array(8).fill(0).map((_,i)=>'<div class="voice-wave" style="height:'+(4+Math.random()*16)+'px;animation-delay:'+(i*0.12)+'s;background:currentColor;opacity:'+(0.3+Math.random()*0.7)+'"></div>').join('')+'</div><div class="chat-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
}else{
div.innerHTML='<div class="chat-bubble">'+m.message+'<div class="chat-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
}
c.appendChild(div);
});
c.scrollTop=c.scrollHeight;
}
}catch(e){}
}
async function sendMessage(){
const input=document.getElementById('msgInput');
const msg=input.value.trim();
if(!msg||!chatToken)return;
input.value='';
try{
await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:chatToken,message:msg,type:'text'})});
loadMessages();
}catch(e){}
}
function sendImage(){
const file=document.getElementById('imageInput').files[0];
if(!file||!chatToken)return;
const fd=new FormData();
fd.append('image',file);
fd.append('token',chatToken);
fetch('/api/chat/send-image',{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.success)loadMessages()});
document.getElementById('imageInput').value='';
}
async function toggleRecording(){
if(!isRecording){startRecording()}else{stopRecording()}
}
async function startRecording(){
try{
const stream=await navigator.mediaDevices.getUserMedia({audio:true});
mediaRecorder=new MediaRecorder(stream);
audioChunks=[];
mediaRecorder.ondataavailable=e=>audioChunks.push(e.data);
mediaRecorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());sendVoiceMessage()};
mediaRecorder.start();
isRecording=true;
recordingSeconds=0;
document.getElementById('voiceRecordBtn').textContent='⏹';
document.getElementById('voiceRecordBtn').style.color='#ef4444';
recordingInterval=setInterval(()=>{recordingSeconds++},1000);
}catch(e){alert('Microphone access denied')}
}
function stopRecording(){
if(mediaRecorder&&mediaRecorder.state==='recording'){
mediaRecorder.stop();
isRecording=false;
clearInterval(recordingInterval);
document.getElementById('voiceRecordBtn').textContent='🎤';
document.getElementById('voiceRecordBtn').style.color='';
}
}
async function sendVoiceMessage(){
if(audioChunks.length===0)return;
const blob=new Blob(audioChunks,{type:'audio/webm'});
const fd=new FormData();
fd.append('voice',blob,'voice.webm');
fd.append('token',chatToken);
try{const r=await fetch('/api/chat/send-voice',{method:'POST',body:fd});const d=await r.json();if(d.success)loadMessages()}catch(e){}
audioChunks=[];
}
function playVoice(url,btn){
const audio=new Audio(url);
btn.textContent='⏸';
audio.play();
audio.onended=()=>{btn.textContent='▶'};
audio.onpause=()=>{btn.textContent='▶'};
btn.onclick=()=>{if(audio.paused){audio.play();btn.textContent='⏸'}else{audio.pause();btn.textContent='▶'}};
}
function playMusic(url,title,index){
const player=document.getElementById('musicPlayer');
if(currentTrack===index){if(player.paused){player.play()}else{player.pause()};return}
player.src=url;
player.play().catch(()=>{});
currentTrack=index;
document.querySelectorAll('.music-item').forEach((el,i)=>{el.classList.toggle('active',i===index)});
document.querySelectorAll('.music-play').forEach((el,i)=>{el.textContent=i===index?'⏸':'▶'});
}
</script>
</body>
</html>`;
    return html;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-card{background:#1a1a1a;padding:40px;border-radius:16px;width:100%;max-width:400px;border:1px solid rgba(255,255,255,0.1)}
.login-title{font-size:24px;font-weight:700;color:white;text-align:center;margin-bottom:8px}
.login-subtitle{font-size:14px;color:#a0a0a0;text-align:center;margin-bottom:32px}
.form-group{margin-bottom:20px}
.form-label{display:block;font-size:13px;color:#a0a0a0;margin-bottom:8px}
.form-input{width:100%;padding:12px 16px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;font-size:14px;outline:none;transition:border 0.2s}
.form-input:focus{border-color:#3b82f6}
.form-btn{width:100%;padding:14px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:transform 0.2s}
.form-btn:hover{transform:translateY(-1px)}
.form-btn:active{transform:translateY(0)}
.error-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;padding:12px;border-radius:8px;font-size:13px;text-align:center;margin-bottom:20px}
.back-link{display:block;text-align:center;color:#a0a0a0;text-decoration:none;font-size:14px;margin-top:20px}
.back-link:hover{color:white}
</style>
</head>
<body>
<div class="login-card">
<h1 class="login-title">Admin Panel</h1>
<p class="login-subtitle">Sign in to manage your site</p>
${error ? `<div class="error-msg">${error}</div>` : ''}
<form method="POST" action="/admin/login">
<div class="form-group">
<label class="form-label">Username</label>
<input type="text" name="username" class="form-input" required autofocus>
</div>
<div class="form-group">
<label class="form-label">Password</label>
<input type="password" name="password" class="form-input" required>
</div>
<button type="submit" class="form-btn">Sign In</button>
</form>
<a href="/" class="back-link">← Back to Site</a>
</div>
</body>
</html>`;
}

function getAdminPanelHTML(stats = {}, photos = [], chatList = []) {
    const photoGrid = photos.map(p => `
<div class="card">
<img src="${p.path}" class="card-img">
<div class="card-body">
${p.caption ? `<p class="card-caption">${p.caption}</p>` : ''}
<p class="card-date">${new Date(p.uploadedAt).toLocaleDateString()}</p>
<div class="card-actions">
<span>👁 ${p.views || 0}</span>
<form method="POST" action="/admin/delete" style="display:inline">
<input type="hidden" name="photoId" value="${p._id}">
<button class="btn btn-danger btn-sm" onclick="return confirm('Delete this photo?')">Delete</button>
</form>
</div>
</div>
</div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:white;min-height:100vh}
.header{background:#1a1a1a;border-bottom:1px solid rgba(255,255,255,0.1);padding:16px 24px;position:sticky;top:0;z-index:100}
.header-inner{max-width:1400px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
.header-title{font-size:18px;font-weight:700}
.header-nav{display:flex;gap:8px}
.btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s}
.btn-primary{background:#3b82f6;color:white}
.btn-primary:hover{background:#2563eb}
.btn-secondary{background:rgba(255,255,255,0.1);color:white}
.btn-secondary:hover{background:rgba(255,255,255,0.2)}
.btn-danger{background:#ef4444;color:white}
.btn-danger:hover{background:#dc2626}
.btn-success{background:#22c55e;color:white}
.btn-sm{padding:6px 12px;font-size:12px}
.container{max-width:1400px;margin:0 auto;padding:24px}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px}
.stat-card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px}
.stat-value{font-size:32px;font-weight:700;margin-bottom:4px}
.stat-label{font-size:13px;color:#a0a0a0}
.upload-form{background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:32px}
.form-title{font-size:16px;font-weight:600;margin-bottom:16px}
.form-group{margin-bottom:12px}
.form-input{width:100%;padding:10px 14px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;font-size:14px;outline:none}
.form-input:focus{border-color:#3b82f6}
.form-row{display:flex;gap:12px}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden}
.card-img{width:100%;height:200px;object-fit:cover}
.card-body{padding:16px}
.card-caption{font-size:14px;margin-bottom:8px}
.card-date{font-size:12px;color:#a0a0a0;margin-bottom:12px}
.card-actions{display:flex;justify-content:space-between;align-items:center}
.section-title{font-size:18px;font-weight:600;margin-bottom:20px}
.alert{padding:12px 16px;border-radius:8px;font-size:14px;margin-bottom:16px}
.alert-success{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:#22c55e}
.alert-error{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444}
</style>
</head>
<body>
<header class="header">
<div class="header-inner">
<h1 class="header-title">Admin Panel</h1>
<nav class="header-nav">
<a href="/admin/chat" class="btn btn-primary">💬 Chat</a>
<a href="/" class="btn btn-secondary">🌐 Site</a>
<a href="/admin/logout" class="btn btn-secondary">🚪 Logout</a>
</nav>
</div>
</header>
<div class="container">
<div class="stats-grid">
<div class="stat-card"><div class="stat-value">${stats.totalUsers || 0}</div><div class="stat-label">Total Users</div></div>
<div class="stat-card"><div class="stat-value">${stats.activeChats || 0}</div><div class="stat-label">Active Chats</div></div>
<div class="stat-card"><div class="stat-value">${stats.totalMessages || 0}</div><div class="stat-label">Total Messages</div></div>
<div class="stat-card"><div class="stat-value">${stats.todayMessages || 0}</div><div class="stat-label">Today Messages</div></div>
<div class="stat-card"><div class="stat-value">${stats.totalPhotos || 0}</div><div class="stat-label">Gallery Photos</div></div>
<div class="stat-card"><div class="stat-value">${stats.todayUsers || 0}</div><div class="stat-label">Today Users</div></div>
</div>
<div class="upload-form">
<h2 class="form-title">📤 Upload Photo</h2>
<form method="POST" action="/admin/upload" enctype="multipart/form-data">
<div class="form-row">
<input type="file" name="photo" accept="image/*" class="form-input" required style="flex:1">
<button type="submit" class="btn btn-primary">Upload</button>
</div>
<input type="text" name="caption" placeholder="Caption (optional)" class="form-input" style="margin-top:8px">
</form>
</div>
<h2 class="section-title">🖼 Gallery (${photos.length})</h2>
<div class="photo-grid">${photoGrid || '<p style="color:#a0a0a0;grid-column:1/-1;text-align:center;padding:40px">No photos yet</p>'}</div>
</div>
</body>
</html>`;
}

function getAdminChatHTML(chatList = [], messages = [], activeChatId = null) {
    const userListHTML = chatList.map(c => `
<div class="chat-user ${c.chatId === activeChatId ? 'active' : ''}" onclick="location.href='/admin/chat?chatId=${c.chatId}'">
<div class="chat-user-info">
<div class="chat-user-name">${c.name}</div>
<div class="chat-user-contact">${c.phoneEmail}</div>
${c.lastMessage ? `<div class="chat-user-lastmsg">${c.lastMessage.message.substring(0, 30)}...</div>` : ''}
</div>
${c.unread > 0 ? `<span class="chat-user-badge">${c.unread}</span>` : ''}
</div>`).join('');

    const messagesHTML = messages.map(m => {
        if(m.type === 'image' && m.fileUrl) {
            return `<div class="msg ${m.sender === 'user' ? 'msg-left' : 'msg-right'}">
<img src="${m.fileUrl}" class="msg-img" onclick="window.open('${m.fileUrl}')">
<div class="msg-time">${new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
        }
        if(m.type === 'voice' && m.fileUrl) {
            return `<div class="msg ${m.sender === 'user' ? 'msg-left' : 'msg-right'}">
<div class="msg-voice"><audio controls src="${m.fileUrl}"></audio></div>
<div class="msg-time">${new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
        }
        return `<div class="msg ${m.sender === 'user' ? 'msg-left' : 'msg-right'}">
<div class="msg-bubble">${m.message}</div>
<div class="msg-time">${new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Chat Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;display:flex;height:100vh;background:#0a0a0a;color:white}
.sidebar{width:350px;background:#1a1a1a;border-right:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column}
.sidebar-header{padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center}
.sidebar-title{font-weight:600;font-size:16px}
.sidebar-list{flex:1;overflow-y:auto}
.chat-user{padding:16px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:background 0.2s;display:flex;justify-content:space-between;align-items:center}
.chat-user:hover{background:rgba(255,255,255,0.05)}
.chat-user.active{background:rgba(59,130,246,0.1);border-left:3px solid #3b82f6}
.chat-user-name{font-weight:500;font-size:14px}
.chat-user-contact{font-size:12px;color:#a0a0a0}
.chat-user-lastmsg{font-size:12px;color:#707070;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat-user-badge{background:#3b82f6;color:white;border-radius:50%;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;padding:0 4px}
.main{flex:1;display:flex;flex-direction:column}
.main-header{padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:600}
.main-messages{flex:1;overflow-y:auto;padding:16px}
.msg{margin-bottom:16px;display:flex;flex-direction:column}
.msg-left{align-items:flex-start}
.msg-right{align-items:flex-end}
.msg-bubble{max-width:60%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5}
.msg-left .msg-bubble{background:#1a1a1a;border-bottom-left-radius:4px}
.msg-right .msg-bubble{background:#3b82f6;border-bottom-right-radius:4px}
.msg-img{max-width:250px;border-radius:8px;cursor:pointer}
.msg-voice{max-width:250px}
.msg-voice audio{width:200px;height:30px}
.msg-time{font-size:11px;color:#707070;margin-top:4px}
.main-input{padding:16px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:8px}
.main-input input{flex:1;padding:10px 16px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;color:white;font-size:14px;outline:none}
.main-input input:focus{border-color:#3b82f6}
.main-input button{padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:24px;cursor:pointer;font-size:14px;font-weight:500}
.main-input button:hover{background:#2563eb}
.btn-back{padding:6px 12px;background:rgba(255,255,255,0.1);color:white;border-radius:6px;text-decoration:none;font-size:13px}
.empty-state{flex:1;display:flex;align-items:center;justify-content:center;color:#707070;font-size:16px}
</style>
</head>
<body>
<div class="sidebar">
<div class="sidebar-header">
<span class="sidebar-title">💬 Conversations</span>
<a href="/admin" class="btn-back">← Back</a>
</div>
<div class="sidebar-list">${userListHTML}</div>
</div>
<div class="main">
${activeChatId ? `
<div class="main-header">Chat with ${chatList.find(c=>c.chatId===activeChatId)?.name || 'User'}</div>
<div class="main-messages" id="msgContainer">${messagesHTML}</div>
<div class="main-input">
<input type="text" id="adminMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()">
<button onclick="sendMsg()">Send</button>
</div>
<script>
const chatId='${activeChatId}';
async function loadMsgs(){
try{
const r=await fetch('/api/admin/messages?chatId='+chatId);
const d=await r.json();
if(d.success){
let h='';
d.messages.forEach(m=>{
if(m.type==='image'&&m.fileUrl)h+='<div class="msg '+(m.sender==='user'?'msg-left':'msg-right')+'"><img src="'+m.fileUrl+'" class="msg-img" onclick="window.open(\''+m.fileUrl+'\')"><div class="msg-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
else if(m.type==='voice'&&m.fileUrl)h+='<div class="msg '+(m.sender==='user'?'msg-left':'msg-right')+'"><div class="msg-voice"><audio controls src="'+m.fileUrl+'"></audio></div><div class="msg-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
else h+='<div class="msg '+(m.sender==='user'?'msg-left':'msg-right')+'"><div class="msg-bubble">'+m.message+'</div><div class="msg-time">'+new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>';
});
document.getElementById('msgContainer').innerHTML=h;
document.getElementById('msgContainer').scrollTop=document.getElementById('msgContainer').scrollHeight;
}
}catch(e){}
}
async function sendMsg(){
const i=document.getElementById('adminMsg');
const m=i.value.trim();
if(!m)return;
i.value='';
try{await fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId,m,type:'text'})});loadMsgs()}catch(e){}
}
setInterval(loadMsgs,3000);
</script>` : '<div class="empty-state">Select a conversation to start chatting</div>'}
</div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    try {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;
        const query = parsedUrl.query;
        const cookies = parseCookies(req.headers.cookie);
        const clientIP = getClientIP(req);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        
        if (pathname.startsWith('/assets/')) {
            const assetPath = path.join(__dir, decodeURIComponent(pathname));
            const allowedDirs = [ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_MEDIA_DIR, CHAT_VOICE_DIR, THUMBNAILS_DIR, TEMP_DIR];
            const isAllowed = allowedDirs.some(dir => assetPath.startsWith(dir));
            if (!isAllowed) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
                serveStaticFile(res, assetPath);
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
            return;
        }
        
        if (pathname === '/api/chat/register' && method === 'POST') {
            if (!checkRateLimit(clientIP, 10, 60000)) {
                sendJSON(res, { success: false, error: 'Too many requests' }, 429);
                return;
            }
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const { name, phoneEmail } = JSON.parse(body);
                    if (!name || !phoneEmail) {
                        sendJSON(res, { success: false, error: 'All fields required' }, 400);
                        return;
                    }
                    const user = await createOrGetChatUser(name, phoneEmail, clientIP);
                    if (!user) {
                        sendJSON(res, { success: false, error: 'Failed to create user' }, 500);
                        return;
                    }
                    const token = await createChatSession(user.chatId, clientIP);
                    if (!token) {
                        sendJSON(res, { success: false, error: 'Session creation failed' }, 500);
                        return;
                    }
                    const messages = await getChatMessages(user.chatId, 1);
                    if (messages.length === 0) {
                        await saveChatMessage(user.chatId, 'admin', 'Hello! 👋 Welcome to Verification Hub. How can I help you today?');
                    }
                    sendJSON(res, { success: true, chatId: user.chatId, token, name: user.name });
                } catch (e) {
                    console.error('Register error:', e);
                    sendJSON(res, { success: false, error: 'Server error' }, 500);
                }
            });
            return;
        }
        
        if (pathname === '/api/chat/verify' && method === 'GET') {
            const token = query.token;
            if (!token) {
                sendJSON(res, { success: false }, 401);
                return;
            }
            const user = await getChatUserByToken(token);
            sendJSON(res, { success: !!user, chatId: user ? user.chatId : null });
            return;
        }
        
        if (pathname === '/api/chat/messages' && method === 'GET') {
            const token = query.token;
            if (!token) {
                sendJSON(res, { success: false }, 401);
                return;
            }
            const user = await getChatUserByToken(token);
            if (!user) {
                sendJSON(res, { success: false, error: 'Invalid token' }, 401);
                return;
            }
            const messages = await getChatMessages(user.chatId, 100);
            if (user.chatId) await markMessagesRead(user.chatId);
            sendJSON(res, { success: true, messages });
            return;
        }
        
        if (pathname === '/api/chat/send' && method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const { token, message, type } = JSON.parse(body);
                    if (!token || !message) {
                        sendJSON(res, { success: false, error: 'Missing fields' }, 400);
                        return;
                    }
                    const user = await getChatUserByToken(token);
                    if (!user) {
                        sendJSON(res, { success: false, error: 'Invalid token' }, 401);
                        return;
                    }
                    const msg = await saveChatMessage(user.chatId, 'user', message, type || 'text');
                    sendJSON(res, { success: true, message: msg });
                } catch (e) {
                    console.error('Send error:', e);
                    sendJSON(res, { success: false, error: 'Server error' }, 500);
                }
            });
            return;
        }
        
        if (pathname === '/api/chat/send-image' && method === 'POST') {
            try {
                const { fields, files } = await handleFileUpload(req, CHAT_MEDIA_DIR, 10 * 1024 * 1024);
                const token = fields.token;
                if (!token) {
                    sendJSON(res, { success: false, error: 'No token' }, 401);
                    return;
                }
                const user = await getChatUserByToken(token);
                if (!user) {
                    sendJSON(res, { success: false, error: 'Invalid token' }, 401);
                    return;
                }
                const imageFile = files.image;
                if (!imageFile || !imageFile.originalFilename) {
                    sendJSON(res, { success: false, error: 'No file' }, 400);
                    return;
                }
                const ext = path.extname(imageFile.originalFilename);
                const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
                const newPath = path.join(CHAT_MEDIA_DIR, filename);
                fs.renameSync(imageFile.filepath, newPath);
                const fileUrl = `/assets/chat_media/${filename}`;
                const fileSize = fs.statSync(newPath).size;
                await saveChatMessage(user.chatId, 'user', '📷 Photo', 'image', fileUrl, fileSize);
                sendJSON(res, { success: true, fileUrl });
            } catch (e) {
                console.error('Image upload error:', e);
                sendJSON(res, { success: false, error: 'Upload failed' }, 500);
            }
            return;
        }
        
        if (pathname === '/api/chat/send-voice' && method === 'POST') {
            try {
                const { fields, files } = await handleFileUpload(req, CHAT_VOICE_DIR, 5 * 1024 * 1024);
                const token = fields.token;
                if (!token) {
                    sendJSON(res, { success: false, error: 'No token' }, 401);
                    return;
                }
                const user = await getChatUserByToken(token);
                if (!user) {
                    sendJSON(res, { success: false, error: 'Invalid token' }, 401);
                    return;
                }
                const voiceFile = files.voice;
                if (!voiceFile || !voiceFile.originalFilename) {
                    sendJSON(res, { success: false, error: 'No file' }, 400);
                    return;
                }
                const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webm`;
                const newPath = path.join(CHAT_VOICE_DIR, filename);
                fs.renameSync(voiceFile.filepath, newPath);
                const fileUrl = `/assets/chat_voice/${filename}`;
                await saveChatMessage(user.chatId, 'user', '🎤 Voice message', 'voice', fileUrl);
                sendJSON(res, { success: true, fileUrl });
            } catch (e) {
                console.error('Voice upload error:', e);
                sendJSON(res, { success: false, error: 'Upload failed' }, 500);
            }
            return;
        }
        
        if (pathname === '/api/admin/messages' && method === 'GET') {
            const session = getSession(cookies.sessionId);
            if (!session) {
                sendJSON(res, { success: false }, 401);
                return;
            }
            const chatId = query.chatId;
            if (!chatId) {
                sendJSON(res, { success: false }, 400);
                return;
            }
            const messages = await getChatMessages(chatId, 200);
            await markMessagesRead(chatId);
            sendJSON(res, { success: true, messages });
            return;
        }
        
        if (pathname === '/api/admin/send' && method === 'POST') {
            const session = getSession(cookies.sessionId);
            if (!session) {
                sendJSON(res, { success: false }, 401);
                return;
            }
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const { chatId, message, type } = JSON.parse(body);
                    if (!chatId || !message) {
                        sendJSON(res, { success: false }, 400);
                        return;
                    }
                    await saveChatMessage(chatId, 'admin', message, type || 'text');
                    sendJSON(res, { success: true });
                } catch (e) {
                    sendJSON(res, { success: false }, 500);
                }
            });
            return;
        }
        
        if (pathname === '/admin' && method === 'GET') {
            const session = getSession(cookies.sessionId);
            if (session) {
                const stats = await getStatistics();
                const photos = await getGalleryPhotos(1, 50);
                const chatList = await getAdminChatList();
                sendHTML(res, getAdminPanelHTML(stats, photos, chatList));
                return;
            }
            sendHTML(res, getAdminLoginHTML());
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
                    const sessionId = createSession(username);
                    setCookie(res, 'sessionId', sessionId);
                    redirect(res, '/admin');
                } else {
                    sendHTML(res, getAdminLoginHTML('Invalid credentials'));
                }
            });
            return;
        }
        
        if (pathname === '/admin/logout') {
            const sessionId = cookies.sessionId;
            if (sessionId) sessions.delete(sessionId);
            setCookie(res, 'sessionId', '', { maxAge: 0 });
            redirect(res, '/admin');
            return;
        }
        
        if (pathname === '/admin/chat' && method === 'GET') {
            const session = getSession(cookies.sessionId);
            if (!session) {
                redirect(res, '/admin');
                return;
            }
            const activeChatId = query.chatId || null;
            const chatList = await getAdminChatList();
            let messages = [];
            if (activeChatId) {
                messages = await getChatMessages(activeChatId, 200);
                await markMessagesRead(activeChatId);
            }
            sendHTML(res, getAdminChatHTML(chatList, messages, activeChatId));
            return;
        }
        
        if (pathname === '/admin/upload' && method === 'POST') {
            const session = getSession(cookies.sessionId);
            if (!session) {
                redirect(res, '/admin');
                return;
            }
            try {
                const { fields, files } = await handleFileUpload(req, GALLERY_DIR, 10 * 1024 * 1024);
                const photoFile = files.photo;
                if (!photoFile || !photoFile.originalFilename) {
                    redirect(res, '/admin');
                    return;
                }
                const ext = path.extname(photoFile.originalFilename);
                const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
                const newPath = path.join(GALLERY_DIR, filename);
                fs.renameSync(photoFile.filepath, newPath);
                await savePhoto({
                    path: `/assets/gallery/${filename}`,
                    caption: fields.caption || '',
                    uploadedBy: session.username
                });
                redirect(res, '/admin');
            } catch (e) {
                redirect(res, '/admin');
            }
            return;
        }
        
        if (pathname === '/admin/delete' && method === 'POST') {
            const session = getSession(cookies.sessionId);
            if (!session) {
                redirect(res, '/admin');
                return;
            }
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                const params = new URLSearchParams(body);
                const photoId = params.get('photoId');
                if (photoId) await deletePhoto(photoId);
                redirect(res, '/admin');
            });
            return;
        }
        
        if (pathname === '/' || pathname === '/index.html') {
            sendHTML(res, getMainHTML());
            return;
        }
        
        res.writeHead(404);
        res.end('404 Not Found');
        
    } catch (e) {
        console.error('Server error:', e);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
});

async function start() {
    const dbConnected = await connectDB();
    if (!dbConnected) {
        console.error('Failed to connect to database. Starting with limited functionality.');
    }
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Admin panel: http://localhost:${PORT}/admin`);
    });
}

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

start();

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
const CHATX_SOUNDS_DIR = path.join(__dir, 'assets', 'sounds');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHATX_SOUNDS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/orginalss.png",
    realIdSS: "/assets/real-id-ss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect .png",
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    reportIcon: "/assets/report.png",
    blueTick: "/assets/social-media.png",
    voiceMic: "/assets/microphone-in-hand.gif",
    facebookIcon: "/assets/communication.png",
    socialMedia: "/assets/social-media.png",
    musicIcon: "/assets/music-icon.png"
};

const VOICE = {
    welcome: "/assets/realvoice.mp3",
    fakeAlert: "/assets/7 lak like but its fake.mp3"
};

const CHATX_CONFIG = {
    primaryColor: '#8b5cf6',
    position: 'right',
    greetingTitle: 'Hi there 👋',
    greetingSubtitle: 'Ask us anything, or share your valuable feedback.',
    startButtonText: 'Start Live Chat',
    chatCardTitle: 'Start a new chat',
    chatCardText: 'Our team typically replies in a few seconds.',
    headerBgColor: '#8b5cf6',
    headerTextColor: '#ffffff',
    agentBubbleBgColor: '#1a1a35',
    agentBubbleTextColor: '#f0f0ff',
    visitorBubbleBgColor: '#8b5cf6',
    visitorBubbleTextColor: '#ffffff',
    sendButtonBgColor: '#8b5cf6',
    sendButtonTextColor: '#ffffff',
    launcherBgColor: '#8b5cf6',
    launcherIconColor: '#ffffff',
    popupTitle: 'Live Chat Online',
    popupText: 'Click here and start chatting with us!',
    isEnabled: true
};

const adminPresence = { isOnline: false, lastSeen: null };

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
        return Object.entries(groups).filter(([_, v]) => v.audio).map(([base, v]) => ({
            id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
            title: base.replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
            artist: 'Cover Song',
            audioUrl: `/assets/covermusic/${encodeURIComponent(v.audio)}`,
            coverUrl: v.cover ? `/assets/covermusic/${encodeURIComponent(v.cover)}` : null
        })).sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const collections = [
            'admin_users', 'gallery_photos', 'chat_users', 'chat_messages', 'chat_sessions',
            'chatx_visitors', 'chatx_chats', 'chatx_messages', 'chatx_departments', 'chatx_agents', 'chatx_bans', 'chatx_settings'
        ];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of collections) { 
            if (!names.includes(col)) await db.createCollection(col); 
        }
        await db.collection('chat_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chat_users').createIndex({ phoneEmail: 1 }, { sparse: true });
        await db.collection('chat_sessions').createIndex({ token: 1 });
        await db.collection('chatx_messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('chatx_visitors').createIndex({ sessionId: 1 });
        await db.collection('chatx_chats').createIndex({ visitorId: 1 });
        await db.collection('chatx_chats').createIndex({ status: 1 });
        
        const admins = db.collection('admin_users');
        if (!await admins.findOne({ username: 'admin' })) {
            await admins.insertOne({ username: 'admin', password: await bcrypt.hash('admin123', 10), createdAt: new Date() });
        }

        const depts = db.collection('chatx_departments');
        if (await depts.countDocuments() === 0) {
            await depts.insertMany([
                { id: 'support', name: 'Support', online: true, agents: [
                    { id: 'agent1', name: 'Hammad Bin Amir', avatar: IMAGES.profile, status: 'online' }
                ]},
                { id: 'sales', name: 'Sales', online: true, agents: [] },
                { id: 'billing', name: 'Billing', online: false, agents: [] }
            ]);
        }

        const settings = db.collection('chatx_settings');
        if (await settings.countDocuments() === 0) {
            await settings.insertOne({
                company: 'Default Company',
                organizationId: 'org_default',
                logoUrl: IMAGES.profile,
                primaryColor: CHATX_CONFIG.primaryColor,
                headerBgColor: CHATX_CONFIG.headerBgColor,
                headerTextColor: CHATX_CONFIG.headerTextColor,
                agentBubbleBgColor: CHATX_CONFIG.agentBubbleBgColor,
                agentBubbleTextColor: CHATX_CONFIG.agentBubbleTextColor,
                visitorBubbleBgColor: CHATX_CONFIG.visitorBubbleBgColor,
                visitorBubbleTextColor: CHATX_CONFIG.visitorBubbleTextColor,
                sendButtonBgColor: CHATX_CONFIG.sendButtonBgColor,
                sendButtonTextColor: CHATX_CONFIG.sendButtonTextColor,
                launcherBgColor: CHATX_CONFIG.launcherBgColor,
                launcherIconColor: CHATX_CONFIG.launcherIconColor,
                position: CHATX_CONFIG.position,
                greetingTitle: CHATX_CONFIG.greetingTitle,
                greetingSubtitle: CHATX_CONFIG.greetingSubtitle,
                startButtonText: CHATX_CONFIG.startButtonText,
                chatCardTitle: CHATX_CONFIG.chatCardTitle,
                chatCardText: CHATX_CONFIG.chatCardText,
                popupTitle: CHATX_CONFIG.popupTitle,
                popupText: CHATX_CONFIG.popupText,
                isEnabled: true
            });
        }
        return true;
    } catch (e) { console.error('DB Error:', e); return false; }
}

async function getGalleryPhotos() { if (!db) return []; try { return await db.collection('gallery_photos').find({}).sort({ uploadedAt: -1 }).toArray(); } catch (e) { return []; } }
async function savePhoto(d) { if (!db) return null; return await db.collection('gallery_photos').insertOne({ ...d, uploadedAt: new Date() }); }
async function deletePhoto(id) { if (!db) return null; return await db.collection('gallery_photos').deleteOne({ _id: new ObjectId(id) }); }
async function verifyAdmin(u, p) { if (!db) return u === 'admin' && p === 'admin123'; const a = await db.collection('admin_users').findOne({ username: u }); if (!a) return false; return await bcrypt.compare(p, a.password); }

async function createOrGetChatUser(name, phoneEmail) {
    if (!phoneEmail || !phoneEmail.trim()) return null;
    const clean = phoneEmail.trim().toLowerCase();
    let user = await db.collection('chat_users').findOne({ phoneEmail: clean });
    if (user) {
        await db.collection('chat_users').updateOne({ _id: user._id }, { $set: { name, lastSeen: new Date(), status: 'active' } });
        return user;
    }
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    user = { chatId, name, phoneEmail: clean, createdAt: new Date(), lastSeen: new Date(), status: 'active' };
    await db.collection('chat_users').insertOne(user);
    return user;
}

async function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('chat_sessions').deleteMany({ chatId });
    await db.collection('chat_sessions').insertOne({ chatId, token, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return token;
}

async function getChatUserByToken(token) {
    if (!token) return null;
    const session = await db.collection('chat_sessions').findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return await db.collection('chat_users').findOne({ chatId: session.chatId });
}

async function getChatMessages(chatId) { return await db.collection('chat_messages').find({ chatId }).sort({ createdAt: 1 }).limit(100).toArray(); }
async function saveChatMessage(chatId, sender, message) {
    const msg = { chatId, sender, message, createdAt: new Date(), read: false };
    await db.collection('chat_messages').insertOne(msg);
    await db.collection('chat_users').updateOne({ chatId }, { $set: { lastSeen: new Date() } });
    return msg;
}
async function getAdminChatList() {
    const users = await db.collection('chat_users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray();
    const list = [];
    for (const u of users) {
        const lastMsg = await db.collection('chat_messages').findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } });
        const unread = await db.collection('chat_messages').countDocuments({ chatId: u.chatId, sender: 'user', read: false });
        list.push({ chatId: u.chatId, name: u.name, phoneEmail: u.phoneEmail, lastSeen: u.lastSeen, lastMessage: lastMsg, unread });
    }
    return list;
}
async function markMessagesRead(chatId) { await db.collection('chat_messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } }); }

// ChatX Widget Functions
async function getChatXSettings(company) {
    if (!db) return CHATX_CONFIG;
    const settings = await db.collection('chatx_settings').findOne({ company: company || 'Default Company' });
    return settings || CHATX_CONFIG;
}

async function getChatXDepartments() {
    if (!db) return [];
    return await db.collection('chatx_departments').find({}).toArray();
}

async function getChatXAgents() {
    if (!db) return [];
    const depts = await db.collection('chatx_departments').find({}).toArray();
    const agents = [];
    depts.forEach(d => { if (d.agents) agents.push(...d.agents); });
    return agents;
}

async function createChatXVisitor(sessionId, data) {
    const visitor = {
        sessionId,
        currentPage: data.currentPage || '',
        referrer: data.referrer || '',
        userAgent: data.userAgent || '',
        connectedAt: new Date(),
        lastSeen: new Date()
    };
    await db.collection('chatx_visitors').updateOne({ sessionId }, { $set: visitor }, { upsert: true });
    return visitor;
}

async function getChatXVisitor(sessionId) {
    return await db.collection('chatx_visitors').findOne({ sessionId });
}

async function createChatXChat(data) {
    const chat = {
        visitorId: data.visitorId,
        visitorName: data.name,
        visitorEmail: data.email,
        department: data.department || 'support',
        status: 'pending',
        createdAt: new Date(),
        agent: null,
        agentJoinEvents: []
    };
    const result = await db.collection('chatx_chats').insertOne(chat);
    return { ...chat, _id: result.insertedId };
}

async function getChatXChat(chatId) {
    return await db.collection('chatx_chats').findOne({ _id: new ObjectId(chatId) });
}

async function getChatXChatsByVisitor(visitorId) {
    return await db.collection('chatx_chats').find({ visitorId, status: { $ne: 'closed' } }).toArray();
}

async function getChatXMessages(chatId) {
    return await db.collection('chatx_messages').find({ chatId }).sort({ createdAt: 1 }).toArray();
}

async function saveChatXMessage(data) {
    const msg = { ...data, createdAt: new Date(), isRead: false };
    await db.collection('chatx_messages').insertOne(msg);
    return msg;
}

const DATA = {
    celebrity: { name: "Baiilla Maach", fullName: "Baiilla Maach Official", photo: IMAGES.profile, bio: "Official Entertainment Profile | Bangladesh", tiktokFollowers: "5,000", tiktokFollowing: "0", tiktokLikes: "50K", location: "Dhaka, Bangladesh" },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", icon: IMAGES.tiktokIcon, screenshot: IMAGES.official, verified: true, followers: "5,000", verifiedIcon: IMAGES.blueTick },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", icon: IMAGES.facebookIcon, screenshot: IMAGES.realIdSS, verified: true, followers: "Growing", verifiedIcon: IMAGES.blueTick }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", icon: IMAGES.tiktokIcon, screenshot: IMAGES.danger, reason: "Copies official content and logo to deceive followers.", threatLevel: "Critical", reportedCount: 156 },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", icon: IMAGES.tiktokIcon, screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers.", threatLevel: "High", reportedCount: 89 }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }
function getLastSeenText() {
    if (adminPresence.isOnline) return 'Online now';
    if (!adminPresence.lastSeen) return 'Offline';
    const diffMs = Date.now() - adminPresence.lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    return `Last seen ${adminPresence.lastSeen.toLocaleDateString()}`;
}

function getMainHTML(galleryPhotos = []) {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0f0f1a">
<title>Baiilla Maach | Verification Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
<script src="https://cdn.tailwindcss.com"></script>
<style>
:root {
    --bg: #0a0a14;
    --surface: #13132b;
    --surface2: #1a1a35;
    --surface3: #222244;
    --text: #f0f0ff;
    --text2: #a0a0cc;
    --text3: #6060a0;
    --purple: #8b5cf6;
    --purple2: #a78bfa;
    --pink: #ec4899;
    --blue: #3b82f6;
    --cyan: #06b6d4;
    --green: #10b981;
    --red: #ef4444;
    --orange: #f97316;
    --yellow: #eab308;
    --glass: rgba(255,255,255,0.03);
    --glass-border: rgba(255,255,255,0.06);
    --glow-purple: 0 0 40px rgba(139,92,246,0.3);
    --glow-pink: 0 0 40px rgba(236,72,153,0.3);
    --glow-blue: 0 0 40px rgba(59,130,246,0.3);
    --glow-green: 0 0 30px rgba(16,185,129,0.3);
    --glow-red: 0 0 30px rgba(239,68,68,0.3);
    --glow-yellow: 0 0 30px rgba(234,179,8,0.3);
    --radius-sm: 12px;
    --radius-md: 18px;
    --radius-lg: 24px;
    --radius-xl: 32px;
    --chatx-primary: #8b5cf6;
    --chatx-header-bg: #8b5cf6;
    --chatx-header-text: #ffffff;
    --chatx-agent-bubble-bg: #1a1a35;
    --chatx-agent-bubble-text: #f0f0ff;
    --chatx-visitor-bubble-bg: #8b5cf6;
    --chatx-visitor-bubble-text: #ffffff;
    --chatx-send-btn-bg: #8b5cf6;
    --chatx-send-btn-text: #ffffff;
    --chatx-launcher-bg: #8b5cf6;
    --chatx-launcher-icon: #ffffff;
}

*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}

body {
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    letter-spacing: -0.01em;
}

.stars-bg {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
}
.star {
    position: absolute;
    background: white;
    border-radius: 50%;
    animation: twinkle var(--dur) ease-in-out infinite;
    animation-delay: var(--delay);
    opacity: 0;
}
@keyframes twinkle {
    0%, 100% { opacity: 0.2; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.5); }
}

.orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.3;
    pointer-events: none;
    z-index: 0;
    animation: floatOrb var(--dur) ease-in-out infinite;
}
@keyframes floatOrb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(30px, -40px) scale(1.1); }
    50% { transform: translate(-20px, -80px) scale(0.9); }
    75% { transform: translate(-40px, -20px) scale(1.05); }
}

main { position: relative; z-index: 1; max-width: 860px; margin: 0 auto; padding: 16px; }

.glass-card {
    background: var(--surface);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
    backdrop-filter: blur(10px);
}
.glass-card::after {
    content: '';
    position: absolute;
    top: -1px; left: 20px; right: 20px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
}
.glass-card:hover {
    border-color: rgba(255,255,255,0.12);
    transform: translateY(-4px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.glass-card.danger-card { border-left: 3px solid var(--red); }
.glass-card.success-card { border-left: 3px solid var(--green); }
.glass-card.warning-card { border-left: 3px solid var(--yellow); }
.glass-card.music-card { background: linear-gradient(135deg, #1a1a3e 0%, #0f0f28 100%); }

.btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 50px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    border: none;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    white-space: nowrap;
    position: relative;
    overflow: hidden;
}
.btn::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50px;
    padding: 1px;
    background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
}
.btn-purple { background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; box-shadow: var(--glow-purple); }
.btn-purple:hover { transform: translateY(-2px); box-shadow: 0 0 50px rgba(139,92,246,0.5); }
.btn-red { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; box-shadow: var(--glow-red); }
.btn-red:hover { transform: translateY(-2px); box-shadow: 0 0 50px rgba(239,68,68,0.5); }
.btn-green { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: var(--glow-green); }
.btn-green:hover { transform: translateY(-2px); box-shadow: 0 0 40px rgba(16,185,129,0.5); }
.btn-outline { background: transparent; border: 1px solid var(--glass-border); color: var(--text2); }
.btn-outline:hover { border-color: var(--purple); color: var(--purple2); background: rgba(139,92,246,0.1); }
.btn-sm { padding: 6px 14px; font-size: 11px; border-radius: 40px; }

.badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
}
.badge-red { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
.badge-green { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); }
.badge-purple { background: rgba(139,92,246,0.15); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.3); }
.badge-yellow { background: rgba(234,179,8,0.15); color: #fde047; border: 1px solid rgba(234,179,8,0.3); }

.main-header {
    background: rgba(10,10,20,0.8);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border-bottom: 1px solid var(--glass-border);
    padding: 12px 0;
    position: sticky;
    top: 0;
    z-index: 100;
}
.header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 860px;
    margin: 0 auto;
    padding: 0 16px;
    gap: 16px;
}
.header-logo {
    display: flex;
    align-items: center;
    gap: 10px;
}
.header-logo img {
    width: 38px; height: 38px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--purple);
    box-shadow: var(--glow-purple);
}
.header-title {
    font-weight: 700;
    font-size: 16px;
    background: linear-gradient(135deg, #c4b5fd, #a78bfa, #f9a8d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.header-nav { display: flex; gap: 6px; }
.header-nav a {
    padding: 7px 14px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s;
}
.nav-red { color: #fca5a5; background: rgba(239,68,68,0.1); }
.nav-red:hover { background: rgba(239,68,68,0.2); }
.nav-green { color: #6ee7b7; background: rgba(16,185,129,0.1); }
.nav-green:hover { background: rgba(16,185,129,0.2); }
.nav-purple { color: #c4b5fd; background: rgba(139,92,246,0.1); }
.nav-purple:hover { background: rgba(139,92,246,0.2); }

.profile-section { text-align: center; padding: 30px 0 20px; }
.profile-pic-wrap { position: relative; display: inline-block; margin-bottom: 12px; }
.profile-pic {
    width: 110px; height: 110px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--purple);
    box-shadow: var(--glow-purple), 0 0 80px rgba(139,92,246,0.2);
    transition: all 0.5s;
}
.profile-pic:hover { transform: scale(1.05); box-shadow: var(--glow-purple), 0 0 120px rgba(139,92,246,0.4); }
.verified-badge-prof {
    position: absolute;
    bottom: 4px; right: 4px;
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #10b981, #059669);
    border-radius: 50%;
    border: 3px solid var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #fff;
    box-shadow: var(--glow-green);
}
.profile-name {
    font-size: 26px;
    font-weight: 800;
    background: linear-gradient(135deg, #c4b5fd, #f9a8d4, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-top: 8px;
}
.profile-bio { color: var(--text2); font-size: 13px; margin-top: 6px; }
.stats-row { display: flex; justify-content: center; gap: 16px; margin: 20px 0; flex-wrap: wrap; }
.stat-card {
    background: var(--surface2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 16px 24px;
    text-align: center;
    transition: all 0.3s;
}
.stat-card:hover { border-color: var(--purple); box-shadow: var(--glow-purple); }
.stat-value { font-size: 22px; font-weight: 700; color: var(--purple2); }
.stat-label { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }

.section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--glass-border);
}
.icon-circle {
    width: 44px; height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}
.icon-red { background: rgba(239,68,68,0.15); }
.icon-green { background: rgba(16,185,129,0.15); }
.icon-purple { background: rgba(139,92,246,0.15); }
.icon-yellow { background: rgba(234,179,8,0.15); }
.section-title { font-size: 18px; font-weight: 700; color: var(--text); }
.section-subtitle { font-size: 11px; color: var(--text3); margin-top: 2px; }

.fake-card {
    background: rgba(239,68,68,0.05);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: var(--radius-md);
    padding: 18px;
    margin-bottom: 12px;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
}
.fake-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--red), transparent);
    opacity: 0.5;
}
.fake-card:hover { border-color: rgba(239,68,68,0.4); box-shadow: 0 8px 30px rgba(239,68,68,0.1); }
.fake-card-body { display: flex; gap: 14px; align-items: flex-start; }
.fake-card-img {
    width: 60px; height: 60px;
    border-radius: 14px;
    object-fit: cover;
    border: 2px solid rgba(239,68,68,0.3);
    flex-shrink: 0;
}
.fake-card-placeholder {
    width: 60px; height: 60px;
    border-radius: 14px;
    background: rgba(239,68,68,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
}

.official-card {
    background: rgba(16,185,129,0.05);
    border: 1px solid rgba(16,185,129,0.2);
    border-radius: var(--radius-md);
    padding: 16px 18px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: all 0.3s;
}
.official-card:hover { border-color: rgba(16,185,129,0.4); box-shadow: 0 8px 30px rgba(16,185,129,0.1); }

.warning-image-container {
    text-align: center;
    padding: 20px;
    background: rgba(234,179,8,0.05);
    border: 1px solid rgba(234,179,8,0.2);
    border-radius: var(--radius-md);
    margin-bottom: 20px;
}
.warning-image-container img {
    max-width: 100%;
    border-radius: 16px;
    box-shadow: var(--glow-yellow);
}

.music-player {
    background: linear-gradient(180deg, #1a1040 0%, #0d0d28 50%, #0a0a1a 100%);
    border-radius: var(--radius-xl);
    padding: 28px;
    color: #fff;
    margin: 20px 0;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(139,92,246,0.2);
}
.music-player::before {
    content: '';
    position: absolute;
    top: -100px; right: -100px;
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%);
    animation: musicGlow 4s ease-in-out infinite;
}
.music-player::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -80px;
    width: 250px; height: 250px;
    background: radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%);
    animation: musicGlow 4s ease-in-out infinite 1s;
}
@keyframes musicGlow {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.3); opacity: 0.8; }
}
.music-player > * { position: relative; z-index: 1; }
.music-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}
.music-header-icon {
    width: 28px; height: 28px;
    animation: micBounce 1.5s ease-in-out infinite;
}
@keyframes micBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
}
.album-art {
    width: 80px; height: 80px;
    border-radius: 20px;
    background: rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.1);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    overflow: hidden;
}
.album-art img {
    width: 100%; height: 100%;
    object-fit: cover;
    animation: spinDisc 6s linear infinite paused;
}
.album-art.playing img { animation-play-state: running; }
@keyframes spinDisc { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.play-btn {
    width: 56px; height: 56px;
    border-radius: 50%;
    background: #1db954;
    border: none;
    color: #000;
    font-size: 22px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 40px rgba(29,185,84,0.4);
    flex-shrink: 0;
}
.play-btn:hover { transform: scale(1.1); box-shadow: 0 0 60px rgba(29,185,84,0.6); }
.play-btn:active { transform: scale(0.9); }
.progress-wrap { display: flex; align-items: center; gap: 10px; }
.progress-bar {
    flex: 1; height: 4px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    cursor: pointer;
    overflow: visible;
    position: relative;
}
.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #1db954, #1ed760);
    border-radius: 2px;
    width: 0%;
    transition: width 0.05s linear;
    position: relative;
}
.progress-thumb {
    position: absolute;
    right: -6px; top: 50%;
    transform: translateY(-50%);
    width: 12px; height: 12px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    opacity: 0;
    transition: opacity 0.2s;
}
.progress-bar:hover .progress-thumb { opacity: 1; }

.song-list { max-height: 220px; overflow-y: auto; margin-top: 18px; }
.song-list::-webkit-scrollbar { width: 3px; }
.song-list::-webkit-scrollbar-track { background: transparent; }
.song-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.song-item {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 3px;
}
.song-item:hover { background: rgba(255,255,255,0.04); }
.song-item.active { background: rgba(29,185,84,0.15); border: 1px solid rgba(29,185,84,0.3); }

/* ChatX Widget */
#chatx-widget {
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    position: fixed;
    z-index: 999998;
}

.chatx-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--chatx-launcher-bg, #8b5cf6);
    color: var(--chatx-launcher-icon, white);
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 30px rgba(139,92,246,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), box-shadow 0.3s ease;
    z-index: 999998;
    animation: chatx-button-entrance 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
.chatx-button:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 25px rgba(0,0,0,0.25), 0 0 50px rgba(139,92,246,0.6);
}
.chatx-button:active { transform: scale(0.95); }
.chatx-button svg { width: 28px; height: 28px; transition: transform 0.3s ease, opacity 0.2s ease; }
.chatx-button .chatx-icon-default { display: block; }
.chatx-button .chatx-icon-hover { display: none; }
.chatx-button .chatx-icon-close { display: none; }
.chatx-button:hover .chatx-icon-default { display: none; }
.chatx-button:hover .chatx-icon-hover { display: block; }
.chatx-button.chatx-open .chatx-icon-default,
.chatx-button.chatx-open .chatx-icon-hover { display: none; }
.chatx-button.chatx-open .chatx-icon-close { display: block; }

@keyframes chatx-button-entrance {
    0% { transform: scale(0) rotate(-180deg); opacity: 0; }
    100% { transform: scale(1) rotate(0); opacity: 1; }
}

.chatx-window {
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 400px;
    height: min(680px, calc(100vh - 120px));
    background: #13132b;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    display: none;
    flex-direction: column;
    overflow: hidden;
    z-index: 999999;
    animation: chatx-window-slide-up 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.chatx-window.open { display: flex; }

@keyframes chatx-window-slide-up {
    0% { transform: scale(0.9) translateY(20px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
}

.chatx-header {
    background: linear-gradient(135deg, var(--chatx-header-bg, #8b5cf6), var(--chatx-header-bg, #6d28d9));
    color: var(--chatx-header-text, white);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
.chatx-header-info { display: flex; align-items: center; flex: 1; min-width: 0; }
.chatx-header-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    overflow: hidden;
    flex-shrink: 0;
}
.chatx-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
.chatx-header-title { font-weight: 600; font-size: 16px; }
.chatx-header-status { font-size: 12px; opacity: 0.8; }
.chatx-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 8px;
    opacity: 0.8;
    font-size: 20px;
}
.chatx-close:hover { opacity: 1; }

.chatx-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #0a0a14;
}
.chatx-message {
    margin-bottom: 16px;
    display: flex;
    align-items: flex-start;
    animation: chatx-message-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.chatx-message.visitor { justify-content: flex-end; }
.chatx-message-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    flex-shrink: 0;
    overflow: hidden;
}
.chatx-message-avatar img { width: 100%; height: 100%; object-fit: cover; }
.chatx-message-content { max-width: 75%; }
.chatx-message-sender { font-size: 12px; font-weight: 600; color: var(--chatx-primary, #8b5cf6); margin-bottom: 4px; }
.chatx-message-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    word-wrap: break-word;
    font-size: 13px;
    line-height: 1.5;
}
.chatx-message.agent .chatx-message-bubble {
    background: var(--chatx-agent-bubble-bg, #1a1a35);
    color: var(--chatx-agent-bubble-text, #f0f0ff);
    border-top-left-radius: 4px;
    border: 1px solid rgba(255,255,255,0.06);
}
.chatx-message.visitor .chatx-message-bubble {
    background: var(--chatx-visitor-bubble-bg, #8b5cf6);
    color: var(--chatx-visitor-bubble-text, white);
    border-top-right-radius: 4px;
}
.chatx-message-time { font-size: 10px; opacity: 0.5; margin-top: 4px; }

@keyframes chatx-message-slide-in {
    0% { transform: translateX(-20px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
}

.chatx-input-area {
    padding: 12px 16px;
    background: #13132b;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: flex-end;
    gap: 8px;
}
.chatx-input {
    flex: 1;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 10px 16px;
    font-size: 13px;
    outline: none;
    resize: none;
    max-height: 100px;
    font-family: inherit;
    background: #1a1a35;
    color: #f0f0ff;
}
.chatx-input:focus { border-color: var(--chatx-primary, #8b5cf6); }
.chatx-send {
    background: var(--chatx-send-btn-bg, #8b5cf6);
    color: var(--chatx-send-btn-text, white);
    border: none;
    width: 40px; height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
}
.chatx-send:hover { opacity: 0.9; transform: scale(1.05); }
.chatx-send:disabled { opacity: 0.5; cursor: not-allowed; }

.chatx-powered {
    padding: 8px 20px;
    text-align: center;
    background: #0a0a14;
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    border-top: 1px solid rgba(255,255,255,0.06);
}

@media (max-width: 480px) {
    .chatx-window {
        width: calc(100% - 20px);
        height: calc(100vh - 120px);
        bottom: 80px;
        right: 10px;
        border-radius: 16px;
    }
    .chatx-button { bottom: 15px; right: 15px; width: 56px; height: 56px; }
}

.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.gallery-item {
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--glass-border);
    transition: all 0.3s;
}
.gallery-item:hover { transform: translateY(-4px); border-color: var(--purple); box-shadow: var(--glow-purple); }
.gallery-item img { width: 100%; height: 130px; object-fit: cover; }

.toast {
    position: fixed; top: 20px; right: 20px; z-index: 99999;
    background: var(--surface2); border: 1px solid var(--glass-border);
    padding: 14px 20px; border-radius: 14px;
    color: var(--text); font-size: 13px;
    transform: translateX(120%); transition: transform 0.4s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
.toast.show { transform: translateX(0); }
.toast.error { border-left: 3px solid var(--red); }
.toast.success { border-left: 3px solid var(--green); }

@media (max-width: 640px) {
    .header-nav { display: none; }
}
</style>
</head>
<body>

<div class="stars-bg" id="starsBg"></div>
<div class="orb" style="width:300px;height:300px;background:rgba(139,92,246,0.4);top:10%;left:-100px;--dur:8s"></div>
<div class="orb" style="width:250px;height:250px;background:rgba(236,72,153,0.3);top:50%;right:-80px;--dur:10s"></div>
<div class="orb" style="width:200px;height:200px;background:rgba(59,130,246,0.3);bottom:10%;left:30%;--dur:12s"></div>

<div id="toast" class="toast"></div>

<header class="main-header">
<div class="header-inner">
<div class="header-logo">
<img src="${profilePic}" alt="Logo" onerror="this.style.display='none'">
<span class="header-title">Verification Hub</span>
</div>
<nav class="header-nav">
<a href="#fake" class="nav-red">⚠ Fakes</a>
${coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : ''}
<a href="#warning" class="nav-purple">🔍 Detection</a>
<a href="#official" class="nav-green">✓ Official</a>
<a href="#gallery" class="nav-purple">📸 Gallery</a>
</nav>
</div>
</header>

<main>

<section class="profile-section">
<div class="profile-pic-wrap">
<img src="${profilePic}" class="profile-pic" alt="Profile">
<div class="verified-badge-prof">✓</div>
</div>
<h1 class="profile-name">${DATA.celebrity.fullName}</h1>
<p class="profile-bio">${DATA.celebrity.bio}</p>
<div class="stats-row">
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokFollowers}</div><div class="stat-label">Followers</div></div>
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokFollowing}</div><div class="stat-label">Following</div></div>
<div class="stat-card"><div class="stat-value">${DATA.celebrity.tiktokLikes}</div><div class="stat-label">Likes</div></div>
</div>
<div style="display:flex;gap:8px;justify-content:center">
<span class="badge badge-green">✓ Verified</span>
<span class="badge badge-purple">Creator</span>
</div>
</section>

<section id="fake" class="glass-card danger-card">
<div class="section-header">
<div class="icon-circle icon-red">⚠️</div>
<div>
<div class="section-title" style="color:#fca5a5">Fake Accounts Detected</div>
<div class="section-subtitle">Report these impersonating accounts</div>
</div>
<span class="badge badge-red" style="margin-left:auto">${totalFake} Active</span>
</div>
${DATA.fakeAccounts.map((a, i) => `
<div class="fake-card">
<div class="fake-card-body">
${a.screenshot ? `<img src="${a.screenshot}" class="fake-card-img" alt="Fake" onerror="this.parentElement.innerHTML='<div class=\\'fake-card-placeholder\\'>⚠️</div>'">` : '<div class="fake-card-placeholder">⚠️</div>'}
<div style="flex:1;min-width:0">
<div style="font-weight:700;color:#fca5a5;font-size:14px;margin-bottom:4px">${a.username}</div>
<div style="font-size:11px;color:#f87171;margin-bottom:6px">⚠ ${a.reason}</div>
<div style="display:flex;gap:6px;flex-wrap:wrap">
<a href="${a.profileUrl}" target="_blank" class="btn btn-red btn-sm">Report</a>
<button onclick="copyTxt('${a.username}')" class="btn btn-outline btn-sm">Copy</button>
</div>
</div>
</div>
</div>
`).join('')}
<div style="display:flex;gap:8px;align-items:center;margin-top:12px">
<button class="btn btn-red btn-sm" id="voicePlayBtn" onclick="toggleFakeVoice()">🔊 Play Alert</button>
<button class="btn btn-outline btn-sm" id="voiceStopBtn" onclick="stopFakeVoice()" style="display:none">⏹ Stop</button>
</div>
<audio id="fakeVoice" src="${VOICE.fakeAlert}" preload="auto"></audio>
</section>

${coverSongs.length > 0 ? `
<section id="music" class="music-player">
<div class="music-header">
<img src="${IMAGES.voiceMic}" class="music-header-icon" alt="Mic" onerror="this.style.display='none'">
<span style="font-weight:700;font-size:16px">Cover Music</span>
<span style="font-size:11px;opacity:0.5;margin-left:auto">${coverSongs.length} tracks</span>
</div>
<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
<div class="album-art" id="albumArt"><span>🎵</span></div>
<div style="flex:1;min-width:0">
<div id="currentTitle" style="font-weight:600;font-size:15px">Select a Song</div>
<div id="currentArtist" style="font-size:11px;opacity:0.6;margin-top:4px">Cover Music</div>
</div>
<button class="play-btn" id="playBtn" onclick="togglePlay()">▶️</button>
</div>
<div class="progress-wrap">
<span id="currentTime" style="font-size:10px;opacity:0.5;width:32px">0:00</span>
<div class="progress-bar" onclick="seekAudio(event)"><div class="progress-fill" id="progressFill"><div class="progress-thumb"></div></div></div>
<span id="totalTime" style="font-size:10px;opacity:0.5;width:32px;text-align:right">0:00</span>
</div>
<div class="song-list">
${coverSongs.map((s, i) => `
<div class="song-item" id="song-${i}" onclick="playSong('${s.audioUrl}','${s.title}','${s.artist}','${s.coverUrl||''}',${i})">
<span style="opacity:0.4;font-size:12px;width:26px">${(i+1).toString().padStart(2,'0')}</span>
<div style="flex:1"><div style="font-weight:500;font-size:13px">${s.title}</div><div style="font-size:10px;opacity:0.4">${s.artist}</div></div>
<span style="font-size:12px;opacity:0.3">▶</span>
</div>
`).join('')}
</div>
<audio id="coverAudio" preload="none"></audio>
</section>` : ''}

<section id="warning" class="warning-image-container">
<img src="${IMAGES.fakeDetect}" alt="Fake Detection Warning" onerror="this.parentElement.style.display='none'">
<div style="margin-top: 16px;">
<span class="badge badge-yellow">🔍 Fake Account Detection Guide</span>
</div>
<p style="color: var(--text2); font-size: 13px; margin-top: 12px; line-height: 1.6;">
Always check for the verified badge before interacting. Report suspicious accounts immediately.
</p>
</section>

<section id="official" class="glass-card success-card">
<div class="section-header">
<div class="icon-circle icon-green">✓</div>
<div>
<div class="section-title" style="color:#6ee7b7">Official Verified Accounts</div>
<div class="section-subtitle">Only follow these real accounts</div>
</div>
</div>
${DATA.realAccounts.map(acc => `
<div class="official-card">
<img src="${acc.icon}" style="width:22px;height:22px;flex-shrink:0" onerror="this.style.display='none'">
<div style="flex:1;min-width:0">
<div style="display:flex;align-items:center;gap:5px">
<span style="font-weight:600;font-size:14px">${acc.username}</span>
<img src="${acc.verifiedIcon}" style="width:14px;height:14px" onerror="this.style.display='none'">
</div>
<div style="font-size:10px;color:var(--text3);margin-top:2px">${acc.followers} followers</div>
</div>
<a href="${acc.url}" target="_blank" class="btn btn-green btn-sm">Follow</a>
</div>
`).join('')}
</section>

<section id="gallery" class="glass-card">
<div class="section-header">
<span style="font-size:22px">📸</span>
<div><div class="section-title">Photo Gallery</div><div class="section-subtitle">Official moments</div></div>
</div>
<div class="gallery-grid">
${galleryPhotos.map(p => `<div class="gallery-item"><img src="${p.path}" alt="Photo" loading="lazy"></div>`).join('')}
${galleryPhotos.length === 0 ? '<p style="color:var(--text3);text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>' : ''}
</div>
</section>

</main>

<!-- ChatX Widget -->
<div id="chatx-widget"></div>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script>
(function() {
    'use strict';
    
    const WIDGET_ID = 'chatx-widget';
    const SERVER_URL = window.location.origin;
    const PRIMARY_COLOR = '${CHATX_CONFIG.primaryColor}';
    const COMPANY_NAME = 'Default Company';
    
    let socket = null;
    let visitorId = null;
    let chatId = null;
    let sessionId = localStorage.getItem('chatx_session') || ('v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    localStorage.setItem('chatx_session', sessionId);
    let isOpen = false;
    let isConnected = false;
    let messages = [];
    
    const widgetHTML = `
        <button class="chatx-button" id="chatx-toggle" style="background:${PRIMARY_COLOR}">
            <svg class="chatx-icon-default" xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="white">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
            </svg>
            <svg class="chatx-icon-hover" xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="white">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                <circle cx="8" cy="10" r="1.5" fill="${PRIMARY_COLOR}"/>
                <circle cx="12" cy="10" r="1.5" fill="${PRIMARY_COLOR}"/>
                <circle cx="16" cy="10" r="1.5" fill="${PRIMARY_COLOR}"/>
            </svg>
            <svg class="chatx-icon-close" xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
        <div class="chatx-window" id="chatx-window">
            <div class="chatx-header" style="background:linear-gradient(135deg, ${PRIMARY_COLOR}, ${PRIMARY_COLOR})">
                <div class="chatx-header-info">
                    <div class="chatx-header-avatar">
                        <img src="${IMAGES.profile}" alt="Support" onerror="this.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' height=\\'24\\' viewBox=\\'0 -960 960 960\\' width=\\'24\\' fill=\\'white\\'><path d=\\'M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-164q-59 0-99.5-40.5T340-580q0-59 40.5-99.5T480-720q59 0 99.5 40.5T620-580q0 59-40.5 99.5T480-440Z\\'/></svg>'">
                    </div>
                    <div>
                        <div class="chatx-header-title">Chat Support</div>
                        <div class="chatx-header-status" id="chatx-status">We're here to help</div>
                    </div>
                </div>
                <button class="chatx-close" id="chatx-close">✕</button>
            </div>
            <div class="chatx-messages" id="chatx-messages"></div>
            <div class="chatx-input-area">
                <input type="text" class="chatx-input" id="chatx-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')window.chatxSendMessage()">
                <button class="chatx-send" id="chatx-send" style="background:${PRIMARY_COLOR}" onclick="window.chatxSendMessage()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
            <div class="chatx-powered">Powered by ChatX</div>
        </div>
    `;
    
    const container = document.getElementById(WIDGET_ID);
    container.innerHTML = widgetHTML;
    
    document.getElementById('chatx-toggle').addEventListener('click', function() {
        const window = document.getElementById('chatx-window');
        if (window.classList.contains('open')) {
            window.classList.remove('open');
            this.classList.remove('chatx-open');
            isOpen = false;
        } else {
            window.classList.add('open');
            this.classList.add('chatx-open');
            isOpen = true;
            if (chatId) scrollToBottom();
        }
    });
    
    document.getElementById('chatx-close').addEventListener('click', function() {
        document.getElementById('chatx-window').classList.remove('open');
        document.getElementById('chatx-toggle').classList.remove('chatx-open');
        isOpen = false;
    });
    
    function addMessage(msg, isVisitor) {
        const container = document.getElementById('chatx-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chatx-message ' + (isVisitor ? 'visitor' : 'agent');
        
        const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        msgDiv.innerHTML = `
            ${!isVisitor ? '<div class="chatx-message-avatar"><img src="${IMAGES.profile}" alt="Agent" onerror="this.innerHTML=\\'<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' height=\\\'18\\\' viewBox=\\\'0 -960 960 960\\\' width=\\\'18\\\' fill=\\\'white\\\'><path d=\\\'M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Z\\\'/></svg>\\'"></div>' : ''}
            <div class="chatx-message-content">
                ${!isVisitor ? '<div class="chatx-message-sender">Hammad Bin Amir</div>' : ''}
                <div class="chatx-message-bubble">${msg.content || msg.message}</div>
                <div class="chatx-message-time">${time}</div>
            </div>
        `;
        
        container.appendChild(msgDiv);
        scrollToBottom();
    }
    
    function scrollToBottom() {
        const container = document.getElementById('chatx-messages');
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
    }
    
    window.chatxSendMessage = function() {
        const input = document.getElementById('chatx-input');
        const message = input.value.trim();
        if (!message) return;
        
        if (!chatId) {
            startChat(message);
        } else if (socket && isConnected) {
            socket.emit('chatx:message:send', { chatId, content: message, sessionId });
            addMessage({ content: message, createdAt: new Date() }, true);
        }
        
        input.value = '';
    };
    
    function startChat(initialMessage) {
        const name = 'Visitor';
        const email = 'visitor@chat.com';
        
        if (socket && isConnected) {
            socket.emit('chatx:chat:start', {
                name, email, message: initialMessage,
                department: 'support', sessionId
            });
            addMessage({ content: initialMessage, createdAt: new Date() }, true);
        }
    }
    
    function connectSocket() {
        if (socket && isConnected) return;
        
        socket = io(SERVER_URL + '/chatx', { transports: ['websocket', 'polling'] });
        
        socket.on('connect', () => {
            isConnected = true;
            socket.emit('chatx:visitor:connect', {
                sessionId,
                currentPage: window.location.href,
                referrer: document.referrer,
                userAgent: navigator.userAgent
            });
        });
        
        socket.on('disconnect', () => { isConnected = false; });
        
        socket.on('chatx:visitor:connected', (data) => {
            visitorId = data.visitorId;
        });
        
        socket.on('chatx:chat:started', (chat) => {
            chatId = chat._id || chat.id;
            if (chat.messages && chat.messages.length > 0) {
                chat.messages.forEach(msg => {
                    addMessage(msg, msg.senderType === 'visitor');
                });
            }
        });
        
        socket.on('chatx:message:new', (msg) => {
            if (msg.chatId === chatId) {
                addMessage(msg, msg.senderType === 'visitor');
            }
        });
        
        socket.on('chatx:chat:history', (chats) => {
            const activeChat = chats.find(c => c.status !== 'closed');
            if (activeChat) {
                chatId = activeChat._id || activeChat.id;
                const chatMessages = activeChat.messages || [];
                document.getElementById('chatx-messages').innerHTML = '';
                chatMessages.forEach(msg => {
                    addMessage(msg, msg.senderType === 'visitor');
                });
                socket.emit('chatx:chat:rejoin', { chatId, sessionId });
            }
        });
    }
    
    connectSocket();
    
    // Initialize with welcome message
    setTimeout(() => {
        const container = document.getElementById('chatx-messages');
        if (container && container.children.length === 0) {
            addMessage({ content: 'Hello! How can I help you today? 👋', createdAt: new Date() }, false);
        }
    }, 1000);
})();
</script>

<script>
(function(){var c=document.getElementById('starsBg');for(var i=0;i<80;i++){var s=document.createElement('div');s.className='star';s.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;width:'+(Math.random()*3+1)+'px;height:'+(Math.random()*3+1)+'px;--dur:'+(Math.random()*3+2)+'s;--delay:'+(Math.random()*5)+'s';c.appendChild(s)}})();

function showToast(m,t){var e=document.getElementById('toast');e.textContent=m;e.className='toast show '+(t||'');setTimeout(function(){e.classList.remove('show')},2800)}
function copyTxt(t){navigator.clipboard.writeText(t).then(function(){showToast('Copied!','success')})}

var fvp=false,fa=document.getElementById('fakeVoice');
function toggleFakeVoice(){var b=document.getElementById('voicePlayBtn'),s=document.getElementById('voiceStopBtn');if(fvp){fa.pause();fa.currentTime=0;fvp=false;b.textContent='🔊 Play Alert';b.style.display='';s.style.display='none'}else{fa.play().then(function(){fvp=true;b.textContent='🔊 Playing...';s.style.display=''}).catch(function(){showToast('Error','error')})}}
function stopFakeVoice(){fa.pause();fa.currentTime=0;fvp=false;document.getElementById('voicePlayBtn').textContent='🔊 Play Alert';document.getElementById('voicePlayBtn').style.display='';document.getElementById('voiceStopBtn').style.display='none'}
fa.addEventListener('ended',function(){fvp=false;document.getElementById('voicePlayBtn').textContent='🔊 Play Alert';document.getElementById('voicePlayBtn').style.display='';document.getElementById('voiceStopBtn').style.display='none'});

var ca=null,ip=false;
function playSong(u,t,a,c,i){
var ad=document.getElementById('coverAudio'),pb=document.getElementById('playBtn'),ar=document.getElementById('albumArt');
if(ca===u){togglePlay();return}
if(ca){ad.pause()}ca=u;ad.src=u;
document.getElementById('currentTitle').textContent=t||'Unknown';
document.getElementById('currentArtist').textContent=a||'Unknown';
ar.innerHTML=c?'<img src="'+c+'" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML=\\'<span>🎵</span>\\'">':'<span>🎵</span>';
document.getElementById('progressFill').style.width='0%';
document.getElementById('currentTime').textContent='0:00';document.getElementById('totalTime').textContent='0:00';
document.querySelectorAll('.song-item').forEach(function(e){e.classList.remove('active')});
var se=document.getElementById('song-'+i);if(se)se.classList.add('active');
ad.play().then(function(){ip=true;pb.textContent='⏸️';ar.classList.add('playing')}).catch(function(){showToast('Error','error')});
ad.ontimeupdate=function(){if(ad.duration){document.getElementById('progressFill').style.width=(ad.currentTime/ad.duration)*100+'%';document.getElementById('currentTime').textContent=ft(ad.currentTime)}};
ad.onloadedmetadata=function(){document.getElementById('totalTime').textContent=ft(ad.duration)};
ad.onended=function(){ip=false;pb.textContent='▶️';ar.classList.remove('playing');document.getElementById('progressFill').style.width='0%';document.getElementById('currentTime').textContent='0:00';ca=null}
}
function togglePlay(){var a=document.getElementById('coverAudio'),b=document.getElementById('playBtn'),r=document.getElementById('albumArt');if(!a.src||a.src===window.location.href){showToast('Select a song','error');return}if(ip){a.pause();ip=false;b.textContent='▶️';r.classList.remove('playing')}else{a.play().then(function(){ip=true;b.textContent='⏸️';r.classList.add('playing')}).catch(function(){showToast('Error','error')})}}
function seekAudio(e){var a=document.getElementById('coverAudio');if(!a.duration)return;a.currentTime=((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth)*a.duration}
function ft(s){if(isNaN(s))return'0:00';return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}

setTimeout(function(){var v=document.getElementById('welcomeVoice');if(v&&!sessionStorage.getItem('vp')){v.play().catch(function(){});sessionStorage.setItem('vp','1')}},2000);
</script>
<audio id="welcomeVoice" src="${VOICE.welcome}" preload="none"></audio>
</body>
</html>`;
}

function getAdminLoginHTML(e = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 flex items-center justify-center min-h-screen"><div class="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800"><h2 class="text-xl font-bold text-white text-center mb-6">Admin Login</h2>${e?`<div class="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">${e}</div>`:''}<form method="POST" action="/admin/login"><input name="username" placeholder="Username" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3" required><input type="password" name="password" placeholder="Password" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-4" required><button class="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold">Sign In</button></form><a href="/" class="block text-center mt-4 text-sm text-gray-500">Back</a></div></body></html>`;
}

async function getAdminPanelHTML(p = [], m = '', e = '') {
    const cl = await getAdminChatList();
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 min-h-screen text-white"><header class="bg-gray-900 p-4 border-b border-gray-800"><div class="max-w-6xl mx-auto flex justify-between items-center"><h1 class="text-lg font-bold text-purple-400">Admin Panel</h1><div class="flex gap-3"><a href="/admin/chat" class="px-4 py-2 bg-purple-600 rounded-lg text-sm">Chats (${cl.reduce((s,c)=>s+c.unread,0)})</a><a href="/" class="px-4 py-2 bg-gray-800 rounded-lg text-sm">Site</a><a href="/admin/logout" class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Logout</a></div></div></header><div class="max-w-6xl mx-auto p-4">${m?`<div class="bg-green-500/10 text-green-400 p-4 rounded-xl mb-4">${m}</div>`:''}${e?`<div class="bg-red-500/10 text-red-400 p-4 rounded-xl mb-4">${e}</div>`:''}<div class="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6"><h2 class="font-bold mb-4">Upload Photo</h2><form method="POST" action="/admin/upload" enctype="multipart/form-data"><input type="file" name="photo" class="mb-3 text-white" required><input name="caption" placeholder="Caption" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white mb-3"><button class="w-full py-3 bg-purple-600 text-white rounded-lg">Upload</button></form></div><h2 class="text-xl font-bold mb-4">Gallery (${p.length})</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">${p.map(x=>`<div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-800"><img src="${x.path}" class="w-full h-40 object-cover"><div class="p-3"><p class="text-sm text-gray-400">${x.caption||''}</p><form method="POST" action="/admin/delete"><input type="hidden" name="photoId" value="${x._id}"><button class="text-red-400 text-sm mt-2">Delete</button></form></div></div>`).join('')||'<p class="text-gray-500 col-span-4 text-center py-12">No photos</p>'}</div></div></body></html>`;
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const pu = url.parse(req.url, true), pn = pu.pathname, m = req.method, ck = parseCookies(req.headers.cookie);
    
    if (pn.startsWith('/assets/')) {
        const ap = path.join(__dir, decodeURIComponent(pn));
        if (!ap.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(ap)) {
            const e = path.extname(ap).toLowerCase();
            const t = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4' };
            res.writeHead(200, { 'Content-Type': t[e] || 'application/octet-stream' });
            fs.createReadStream(ap).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    
    // ChatX API Routes
    if (pn === '/api/settings/widget-public' && m === 'GET') {
        const settings = await getChatXSettings(pu.query.company);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settings));
        return;
    }
    
    if (pn === '/api/departments' && m === 'GET') {
        const depts = await getChatXDepartments();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(depts));
        return;
    }
    
    if (pn === '/api/agents/avatars' && m === 'GET') {
        const agents = await getChatXAgents();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(agents));
        return;
    }
    
    // Socket.IO namespace for ChatX
    if (pn === '/chatx' || pn.startsWith('/chatx/')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Socket.IO endpoint');
        return;
    }
    
    if (pn === '/api/chat/register' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(b);
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const u = await createOrGetChatUser(name, phoneEmail);
                if (!u) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
                const t = await createChatSession(u.chatId);
                if ((await getChatMessages(u.chatId)).length === 0) await saveChatMessage(u.chatId, 'admin', 'Hello! How can I help you? 👋');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: u.chatId, token: t }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
        }); return;
    }
    
    if (pn === '/api/chat/verify' && m === 'GET') {
        const u = await getChatUserByToken(pu.query.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!u, chatId: u ? u.chatId : null }));
        return;
    }
    
    if (pn === '/api/chat/messages' && m === 'GET') {
        const u = await getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: await getChatMessages(u.chatId) }));
        return;
    }
    
    if (pn === '/api/chat/send' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { token, message } = JSON.parse(b);
            const u = await getChatUserByToken(token);
            if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            await saveChatMessage(u.chatId, 'user', message);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    if (pn === '/admin' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (s) {
            adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(await getAdminPanelHTML(await getGalleryPhotos()));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getAdminLoginHTML()); return;
    }
    
    if (pn === '/admin/login' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            if (await verifyAdmin(p.get('username'), p.get('password'))) {
                const s = createSession(p.get('username'));
                adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `sessionId=${s};HttpOnly;Path=/;Max-Age=7200` }); res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(getAdminLoginHTML('Invalid credentials'));
            }
        }); return;
    }
    
    if (pn === '/admin/logout') {
        sessions.delete(ck.sessionId);
        adminPresence.isOnline = false; adminPresence.lastSeen = new Date();
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' }); res.end(); return;
    }
    
    if (pn === '/admin/chat' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
        const cid = pu.query.chatId, cl = await getAdminChatList();
        let ms = [];
        if (cid) { ms = await getChatMessages(cid); await markMessagesRead(cid); }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chat</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;display:flex;height:100vh;font-family:sans-serif;background:#0a0a14;color:#fff}.sidebar{width:350px;background:#13132b;border-right:1px solid rgba(255,255,255,0.06)}.main{flex:1;display:flex;flex-direction:column}.messages{flex:1;overflow-y:auto;padding:20px;background:#0a0a14}</style></head><body><div class="sidebar"><div style="padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9)">💬 Chats <a href="/admin" style="color:#fff;float:right">Back</a></div>${cl.map(c=>`<div onclick="location.href='/admin/chat?chatId=${c.chatId}'" style="padding:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);${c.chatId===cid?'background:rgba(139,92,246,0.2)':''}"><div style="font-weight:600">${c.name}</div><div style="font-size:12px;opacity:0.6">${c.phoneEmail}</div></div>`).join('')}</div><div class="main">${cid?`<div style="padding:14px;background:#13132b;font-weight:600">${cl.find(c=>c.chatId===cid)?.name}</div><div class="messages" id="mc">${ms.map(m=>`<div style="margin-bottom:10px;text-align:${m.sender==='user'?'left':'right'}"><div style="display:inline-block;max-width:70%;padding:10px 14px;border-radius:16px;${m.sender==='user'?'background:#1a1a35':'background:#8b5cf6'}">${m.message}</div></div>`).join('')}</div><div style="padding:14px;background:#13132b;display:flex;gap:10px"><input id="am" placeholder="Reply..." style="flex:1;padding:10px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:#fff;outline:none" onkeypress="if(event.key==='Enter')sm()"><button onclick="sm()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer">Send</button></div><script>let cid='${cid}';function lm(){fetch('/api/admin/messages?chatId='+cid).then(r=>r.json()).then(d=>{if(d.success){document.getElementById('mc').innerHTML=d.messages.map(m=>'<div style="margin-bottom:10px;text-align:'+(m.sender==='user'?'left':'right')+'"><div style="display:inline-block;max-width:70%;padding:10px 14px;border-radius:16px;'+(m.sender==='user'?'background:#1a1a35':'background:#8b5cf6')+'">'+m.message+'</div></div>').join('')}})}function sm(){var i=document.getElementById('am');fetch('/api/admin/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:cid,message:i.value})}).then(()=>{i.value='';lm()})}setInterval(lm,2000)</script>`:'<div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.5">Select a chat</div>'}</div></body></html>`); return;
    }
    
    if (pn === '/api/admin/messages' && m === 'GET') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        await markMessagesRead(pu.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, messages: await getChatMessages(pu.query.chatId) })); return;
    }
    
    if (pn === '/api/admin/send' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { chatId, message } = JSON.parse(b);
            await saveChatMessage(chatId, 'admin', message);
            adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    if (pn === '/admin/upload' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        const fm = new formidable.IncomingForm({ uploadDir: GALLERY_DIR, keepExtensions: true });
        fm.parse(req, async (err, fields, files) => {
            if (err) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
            const fn = Date.now() + '_' + pf.originalFilename;
            fs.renameSync(pf.filepath, path.join(GALLERY_DIR, fn));
            await savePhoto({ path: '/assets/gallery/' + fn, caption: fields.caption || '' });
            res.writeHead(302, { 'Location': '/admin' }); res.end();
        }); return;
    }
    
    if (pn === '/admin/delete' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            try { const ph = await db.collection('gallery_photos').findOne({ _id: new ObjectId(p.get('photoId')) }); if (ph && fs.existsSync(path.join(__dir, ph.path))) fs.unlinkSync(path.join(__dir, ph.path)); await deletePhoto(p.get('photoId')); } catch (e) {}
            res.writeHead(302, { 'Location': '/admin' }); res.end();
        }); return;
    }
    
    if (pn === '/' || pn === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML(await getGalleryPhotos())); return;
    }
    
    res.writeHead(404); res.end('404');
});

// Socket.IO for ChatX Widget
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io'
});

const chatxNamespace = io.of('/chatx');

chatxNamespace.on('connection', (socket) => {
    console.log('ChatX client connected:', socket.id);
    
    socket.on('chatx:visitor:connect', async (data) => {
        const { sessionId } = data;
        const visitor = await createChatXVisitor(sessionId, data);
        socket.visitorSessionId = sessionId;
        socket.emit('chatx:visitor:connected', { visitorId: visitor.sessionId });
        
        const activeChats = await getChatXChatsByVisitor(sessionId);
        if (activeChats.length > 0) {
            const chatsWithMessages = [];
            for (const chat of activeChats) {
                const messages = await getChatXMessages(chat._id.toString());
                chatsWithMessages.push({ ...chat, _id: chat._id.toString(), id: chat._id.toString(), messages });
            }
            socket.emit('chatx:chat:history', chatsWithMessages);
        }
    });
    
    socket.on('chatx:chat:start', async (data) => {
        const { name, email, message, department, sessionId } = data;
        const visitor = await getChatXVisitor(sessionId);
        if (!visitor) return;
        
        const chat = await createChatXChat({ visitorId: sessionId, name, email, department });
        const chatId = chat._id.toString();
        
        const messages = [];
        if (message) {
            const msg = await saveChatXMessage({
                chatId, senderType: 'visitor', senderId: sessionId,
                content: message, type: 'text'
            });
            messages.push(msg);
        }
        
        socket.join('chat:' + chatId);
        socket.chatId = chatId;
        socket.emit('chatx:chat:started', { ...chat, _id: chatId, id: chatId, messages });
        
        setTimeout(async () => {
            const autoMsg = await saveChatXMessage({
                chatId, senderType: 'agent', senderId: 'agent1',
                content: `Hello ${name}! I'm Hammad Bin Amir. How can I help you today?`,
                type: 'text', agent: { id: 'agent1', name: 'Hammad Bin Amir', avatar: IMAGES.profile }
            });
            socket.emit('chatx:message:new', autoMsg);
        }, 2000);
    });
    
    socket.on('chatx:chat:rejoin', async (data) => {
        const { chatId } = data;
        socket.join('chat:' + chatId);
        socket.chatId = chatId;
    });
    
    socket.on('chatx:message:send', async (data) => {
        const { chatId, content, sessionId } = data;
        const msg = await saveChatXMessage({
            chatId, senderType: 'visitor', senderId: sessionId,
            content, type: 'text'
        });
        chatxNamespace.to('chat:' + chatId).emit('chatx:message:new', msg);
    });
    
    socket.on('disconnect', () => {
        console.log('ChatX client disconnected:', socket.id);
    });
});

async function start() {
    const dbConnected = await connectDB();
    if (dbConnected) console.log('✅ MongoDB Connected');
    else console.log('⚠️ MongoDB Connection Failed - Running without database');
    
    server.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`💬 ChatX Widget integrated`);
        console.log(`👤 Admin panel: http://localhost:${PORT}/admin`);
    });
}

start().catch(console.error);

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const UPLOADS_DIR = path.join(__dir, 'uploads');

[ASSETS_DIR, COVER_MUSIC_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    officialTT: "/assets/orginalss.png",
    officialFB: "/assets/fb_profile.jpg",
    realIdSS: "/assets/real-id-ss.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png",
    fakeDetect: "/assets/Fakedetect .png",
    tiktokIcon: "/assets/tiktokicon.png",
    messageIcon: "/assets/messageicon.gif",
    reportIcon: "/assets/report.png",
    flag: "/assets/flag.png",
    tiktokTick: "/assets/check-mark.png",
    fbTick: "/assets/social-media.png",
    voiceMic: "/assets/microphone-in-hand.gif",
    communication: "/assets/communication.png"
};

const VOICE = {
    welcome: "/assets/realvoice.mp3",
    fakeAlert: "/assets/7 lak like but its fake.mp3"
};

async function connectDB() {
    try {
        mongoClient = new MongoClient(MONGO_URI, { maxPoolSize: 10 });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        const cols = ['users', 'messages', 'sessions'];
        const existing = await db.listCollections().toArray();
        const names = existing.map(c => c.name);
        for (const col of cols) {
            if (!names.includes(col)) await db.createCollection(col);
        }
        await db.collection('users').createIndex({ phone: 1 }, { sparse: true });
        await db.collection('users').createIndex({ email: 1 }, { sparse: true });
        await db.collection('messages').createIndex({ chatId: 1, createdAt: -1 });
        await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
        console.log('MongoDB Connected');
        return true;
    } catch (e) {
        console.error('MongoDB Error:', e.message);
        return false;
    }
}

function createOrGetChatUser(name, contact) {
    const users = db ? null : (global._users || (global._users = []));
    const query = contact.includes('@') ? { email: contact } : { phone: contact };
    
    if (db) {
        return db.collection('users').findOne(query).then(user => {
            if (user) {
                return db.collection('users').updateOne({ _id: user._id }, { $set: { name, lastSeen: new Date(), status: 'online' } }).then(() => user);
            }
            const chatId = 'USR-' + crypto.randomBytes(6).toString('hex').toUpperCase();
            const newUser = { chatId, name, phone: contact.includes('@') ? '' : contact, email: contact.includes('@') ? contact : '', createdAt: new Date(), lastSeen: new Date(), status: 'active' };
            return db.collection('users').insertOne(newUser).then(() => newUser);
        });
    }
    
    let user = users.find(u => (query.phone && u.phone === query.phone) || (query.email && u.email === query.email));
    if (user) { user.name = name; user.lastSeen = new Date(); user.status = 'online'; return Promise.resolve(user); }
    const chatId = 'USR-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    user = { chatId, name, phone: contact.includes('@') ? '' : contact, email: contact.includes('@') ? contact : '', createdAt: new Date(), lastSeen: new Date(), status: 'active' };
    users.push(user);
    return Promise.resolve(user);
}

function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    if (db) {
        return db.collection('sessions').insertOne({ token, chatId, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).then(() => token);
    }
    if (!global._sessions) global._sessions = [];
    global._sessions.push({ token, chatId, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return token;
}

function getChatUserByToken(token) {
    if (db) {
        return db.collection('sessions').findOne({ token, expiresAt: { $gt: new Date() } }).then(session => {
            if (!session) return null;
            return db.collection('users').findOne({ chatId: session.chatId });
        });
    }
    const sessions = global._sessions || [];
    const session = sessions.find(s => s.token === token && new Date(s.expiresAt) > new Date());
    if (!session) return null;
    const users = global._users || [];
    return users.find(u => u.chatId === session.chatId) || null;
}

function getChatMessages(chatId) {
    if (db) {
        return db.collection('messages').find({ chatId }).sort({ createdAt: 1 }).limit(50).toArray();
    }
    const messages = global._messages || [];
    return messages.filter(m => m.chatId === chatId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 50);
}

function saveChatMessage(chatId, sender, message, type, fileUrl, fileName, duration) {
    const msg = { chatId, sender, message, type: type || 'text', fileUrl: fileUrl || null, fileName: fileName || null, duration: duration || null, createdAt: new Date(), read: false };
    if (db) {
        return db.collection('messages').insertOne(msg);
    }
    if (!global._messages) global._messages = [];
    global._messages.push(msg);
    return Promise.resolve();
}

function markMessagesRead(chatId) {
    if (db) {
        return db.collection('messages').updateMany({ chatId, sender: 'user', read: false }, { $set: { read: true } });
    }
    const messages = global._messages || [];
    messages.forEach(m => { if (m.chatId === chatId && m.sender === 'user') m.read = true; });
    return Promise.resolve();
}

function getAdminChatList() {
    if (db) {
        return db.collection('users').find({ status: 'active' }).sort({ lastSeen: -1 }).toArray().then(users => {
            return Promise.all(users.map(u => {
                return db.collection('messages').findOne({ chatId: u.chatId }, { sort: { createdAt: -1 } }).then(lastMsg => {
                    return db.collection('messages').countDocuments({ chatId: u.chatId, sender: 'user', read: false }).then(unread => {
                        return { ...u, lastMessage: lastMsg, unread };
                    });
                });
            }));
        });
    }
    const users = (global._users || []).filter(u => u.status === 'active');
    const messages = global._messages || [];
    return users.map(u => {
        const userMsgs = messages.filter(m => m.chatId === u.chatId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return { ...u, lastMessage: userMsgs[0] || null, unread: userMsgs.filter(m => m.sender === 'user' && !m.read).length };
    }).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        return files.filter(f => audioExts.includes(path.extname(f).toLowerCase())).map((f, i) => ({
            id: 'track_' + i,
            title: path.basename(f, path.extname(f)).replace(/[-_#]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(),
            url: '/assets/covermusic/' + encodeURIComponent(f),
            index: i
        }));
    } catch (e) { return []; }
}

const sessions = new Map();
const adminPresence = { isOnline: false, lastSeen: new Date() };

function getSession(sid) { return sessions.get(sid); }
function createSession(username) { const sid = crypto.randomBytes(32).toString('hex'); sessions.set(sid, { username, createdAt: new Date() }); return sid; }
async function verifyAdmin(username, password) { return username === 'Hammad' && password === 'Hammad1122@'; }

function renderMsgBubble(m) {
    if (m.type === 'image') return '<img src="' + m.fileUrl + '" style="max-width:200px;border-radius:10px;cursor:pointer" onclick="showImg(\'' + m.fileUrl + '\')"><div style="font-size:10px;opacity:0.7;text-align:right;margin-top:4px">' + new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>';
    if (m.type === 'voice') return '<div style="display:flex;align-items:center;gap:6px"><button onclick="playV(\'' + m.fileUrl + '\',this)" style="width:30px;height:30px;border-radius:50%;background:#22c55e;color:white;border:none;cursor:pointer;font-size:12px">▶</button><span style="font-size:11px">🎤 ' + (m.duration || 0) + 's</span></div><div style="font-size:10px;opacity:0.7;text-align:right;margin-top:4px">' + new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>';
    return m.message + '<div style="font-size:10px;opacity:0.7;text-align:right;margin-top:4px">' + new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>';
}

const VERIFICATION = {
    profile: { name: 'Baiilla Maach Official', username: '@baiillamaach_official', bio: 'Official Entertainment Profile | Bangladesh', followers: '5,000', following: '0', likes: '50K' },
    official: [
        { platform: 'TikTok', username: '@baiillamaach_official', url: 'https://tiktok.com/@baiillamaach_official', icon: IMAGES.tiktokIcon, badge: IMAGES.tiktokTick, screenshot: IMAGES.profile, followers: '5,000', likes: '50K' },
        { platform: 'Facebook', username: 'Baiilla Maach Official', url: 'https://www.facebook.com/profile.php?id=61575202118828', icon: IMAGES.fbTick, badge: IMAGES.fbTick, screenshot: IMAGES.officialFB, followers: 'Growing' }
    ],
    fake: [
        { platform: 'TikTok', username: '@baiilla_mach', url: 'https://tiktok.com/@baiilla_mach', screenshot: IMAGES.danger, reason: 'Copies official content and logo to deceive followers.', threat: 'Critical', reports: 156 },
        { platform: 'TikTok', username: '@hammad_fams0', url: 'https://tiktok.com/@hammad_fams0', screenshot: IMAGES.fraud, reason: 'Uses official name and photo to mislead followers.', threat: 'High', reports: 89 }
    ]
};

function getMainHTML() {
    const songs = getCoverSongs();
    const p = VERIFICATION.profile, oa = VERIFICATION.official, fa = VERIFICATION.fake;
    
    let musicSection = '';
    if (songs.length > 0) {
        musicSection = '<section class="sec" id="music"><div class="sec-hd"><div class="sec-ic" style="background:#dcfce7">🎵</div><div><div class="sec-tl">Cover Music</div><div class="sec-sb">' + songs.length + ' tracks</div></div></div><div class="card" style="padding:0;overflow:hidden"><div class="music-list">' + songs.map((s, i) => '<div class="music-item" data-url="' + s.url + '" data-title="' + s.title.replace(/'/g, "\\'") + '" onclick="playTrack(this,\'' + s.url + '\',\'' + s.title.replace(/'/g, "\\'") + '\')"><span class="music-num">' + String(i + 1).padStart(2, '0') + '</span><div class="music-info"><div class="music-tl">' + s.title + '</div><div class="music-art">Cover Song</div></div><button class="music-btn">▶</button></div>').join('') + '</div></div></section>';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<meta name="theme-color" content="#ffffff">
<title>${p.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--pri:#2563eb;--pri-d:#1d4ed8;--pri-l:#dbeafe;--red:#ef4444;--red-l:#fee2e2;--grn:#22c55e;--grn-l:#dcfce7;--pur:#8b5cf6;--pur-l:#ede9fe;--w:#fff;--s1:#f8fafc;--s2:#f1f5f9;--b:#e2e8f0;--t1:#0f172a;--t2:#334155;--t3:#64748b;--t4:#94a3b8;--sh:0 1px 3px rgba(0,0,0,0.06);--r:12px;--r2:8px;--rf:20px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--s1);color:var(--t1);min-height:100vh;line-height:1.5;overflow-x:hidden;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--t4);border-radius:10px}
.container{max-width:600px;margin:0 auto;padding:0 14px}
.hdr{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.95);backdrop-filter:blur(16px);border-bottom:1px solid var(--b)}
.hdr-in{display:flex;align-items:center;justify-content:space-between;height:50px;gap:10px}
.hdr-l{display:flex;align-items:center;gap:8px}
.hdr-av{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid var(--pri-l)}
.hdr-nm{font-weight:700;font-size:14px;display:flex;align-items:center;gap:4px}
.hdr-tk{width:15px;height:15px}
.hdr-nav{display:flex;gap:1px}
.hdr-nav a{padding:4px 7px;font-size:10px;font-weight:500;color:var(--t2);text-decoration:none;border-radius:15px;white-space:nowrap}
.hdr-nav a:hover{background:var(--s2);color:var(--pri)}
.sec{padding:16px 0}
.sec-hd{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.sec-ic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px}
.sec-tl{font-size:15px;font-weight:700}
.sec-sb{font-size:10px;color:var(--t3)}
.card{background:var(--w);border:1px solid var(--b);border-radius:var(--r);padding:12px;box-shadow:var(--sh)}
.badge{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:15px;font-size:10px;font-weight:600}
.bdg-b{background:var(--pri-l);color:var(--pri)}
.bdg-p{background:var(--pur-l);color:var(--pur)}
.bdg-r{background:var(--red-l);color:var(--red)}
.bdg-g{background:var(--grn-l);color:#16a34a}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 14px;border-radius:var(--rf);font-size:11px;font-weight:600;text-decoration:none;border:none;cursor:pointer;transition:all 0.15s}
.btn-p{background:var(--pri);color:white}
.btn-p:hover{background:var(--pri-d)}
.btn-o{background:var(--w);color:var(--t2);border:1.5px solid var(--b)}
.btn-o:hover{border-color:var(--pri);color:var(--pri)}
.btn-r{background:var(--red);color:white}
.btn-r:hover{background:#dc2626}
.hero{padding-top:64px;text-align:center}
.hero-iw{position:relative;display:inline-block;margin-bottom:8px}
.hero-img{width:76px;height:76px;border-radius:50%;object-fit:cover;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,0.1)}
.hero-chk{position:absolute;bottom:2px;right:2px;width:22px;height:22px;background:var(--pri);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid white}
.hero-chk img{width:11px;height:11px}
.hero-nm{font-size:18px;font-weight:800;margin-bottom:2px;display:inline-flex;align-items:center;gap:4px}
.hero-bio{font-size:11px;color:var(--t3);margin-bottom:12px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:260px;margin:0 auto 12px}
.stat{background:var(--w);border:1px solid var(--b);border-radius:var(--r2);padding:10px 6px;text-align:center}
.stat-v{font-size:17px;font-weight:700}
.stat-l{font-size:9px;color:var(--t3);font-weight:500}
.ac{display:flex;align-items:center;gap:10px;padding:10px;background:var(--s1);border-radius:var(--r2);border:1px solid var(--b)}
.ac-img{width:42px;height:42px;border-radius:var(--r2);object-fit:cover}
.ac-info{flex:1;min-width:0}
.ac-nm{font-weight:600;font-size:12px;display:flex;align-items:center;gap:3px}
.ac-meta{font-size:10px;color:var(--t3)}
.fk{background:var(--w);border:1px solid var(--red-l);border-left:4px solid var(--red);border-radius:var(--r);padding:12px;margin-bottom:10px}
.fk-iw{position:relative;border-radius:var(--r2);overflow:hidden;border:2px solid var(--red-l);margin-bottom:10px}
.fk-iw img{width:100%;display:block}
.fk-ol{position:absolute;inset:0;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center}
.fk-ol span{background:var(--red);color:white;padding:4px 12px;border-radius:15px;font-size:10px;font-weight:700}
.music-list{max-height:260px;overflow-y:auto}
.music-item{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f1f5f9}
.music-item:hover{background:var(--s1)}
.music-item.playing{background:var(--pri-l)}
.music-num{width:20px;font-size:10px;color:var(--t4);text-align:center}
.music-info{flex:1;min-width:0}
.music-tl{font-size:12px;font-weight:600}
.music-art{font-size:10px;color:var(--t4)}
.music-btn{width:28px;height:28px;border-radius:50%;background:var(--grn);color:white;border:none;cursor:pointer;font-size:11px;flex-shrink:0}
.id-card{text-align:center;padding:12px}
.id-card img{max-width:100%;max-height:220px;border-radius:var(--r2);border:2px solid var(--b);margin-bottom:8px}
.rp{text-align:center;padding:12px}
.rp img{max-width:130px;margin-bottom:8px}
.cw{position:fixed;bottom:16px;right:16px;z-index:999}
.cb{width:52px;height:52px;border-radius:50%;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.2);border:none;padding:0;overflow:hidden;background:var(--w);transition:transform 0.2s;animation:pop 0.5s ease-out}
@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
.cb:hover{transform:scale(1.08)}
.cb:active{transform:scale(0.95)}
.cb img{width:100%;height:100%;object-fit:cover;display:block}
.cw-win{position:fixed;bottom:80px;right:16px;width:350px;max-width:calc(100vw - 28px);height:440px;max-height:calc(100vh - 110px);background:var(--w);border-radius:var(--r);overflow:hidden;box-shadow:0 15px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;border:1px solid var(--b)}
.cw-win.open{display:flex}
.cw-top{background:var(--pri);color:white;padding:12px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.cw-av{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3)}
.cw-info{flex:1;min-width:0}
.cw-nm{font-weight:600;font-size:13px}
.cw-st{font-size:10px;opacity:0.85}
.cw-cl{background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:4px 8px;opacity:0.8}
.cw-msgs{flex:1;overflow-y:auto;padding:10px;background:var(--s1)}
.mr{display:flex;margin-bottom:4px}
.mr.u{justify-content:flex-end}
.mr.a{justify-content:flex-start}
.mb{max-width:78%;padding:7px 10px;border-radius:12px;font-size:11px;line-height:1.4;word-wrap:break-word}
.mb.u{background:var(--pri);color:white;border-bottom-right-radius:3px}
.mb.a{background:var(--w);color:var(--t1);border-bottom-left-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.mb-img{max-width:160px;border-radius:var(--r2);cursor:pointer;display:block}
.mb-voice{display:flex;align-items:center;gap:6px}
.mb-voice button{width:26px;height:26px;border-radius:50%;background:var(--grn);color:white;border:none;cursor:pointer;font-size:10px;flex-shrink:0}
.mb-time{font-size:9px;opacity:0.7;text-align:right;margin-top:1px}
.ti{display:none;padding:0 10px 6px}
.ti-b{display:inline-flex;gap:3px;padding:7px 10px;background:var(--w);border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.td{width:5px;height:5px;border-radius:50%;background:var(--t4);animation:td 1.4s infinite}
.td:nth-child(2){animation-delay:0.2s}
.td:nth-child(3){animation-delay:0.4s}
@keyframes td{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-5px);opacity:1}}
.cw-inp{display:flex;align-items:center;gap:5px;padding:8px 10px;background:var(--w);border-top:1px solid var(--b);flex-shrink:0}
.cw-inp input{flex:1;border:1.5px solid var(--b);padding:7px 10px;border-radius:16px;font-size:11px;outline:none;background:var(--s1);min-width:0}
.cw-inp input:focus{border-color:var(--pri);background:var(--w)}
.cw-ibtn{width:30px;height:30px;border-radius:50%;border:none;background:transparent;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cw-ibtn:hover{background:var(--s2)}
.cw-send{width:32px;height:32px;border-radius:50%;background:var(--pri);color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px}
.cw-send:hover{background:var(--pri-d)}
.rc{display:none;align-items:center;gap:6px;padding:6px 10px;background:var(--red);color:white;font-size:10px;flex-shrink:0}
.rc-dot{width:6px;height:6px;background:white;border-radius:50%;animation:rcp 1s infinite}
@keyframes rcp{0%,100%{opacity:1}50%{opacity:0.3}}
.ip{display:none;padding:6px 10px;background:var(--w);position:relative;flex-shrink:0}
.ip img{max-height:55px;border-radius:var(--r2)}
.ip-cl{position:absolute;top:2px;right:14px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:17px;height:17px;cursor:pointer;font-size:9px}
.lg{padding:18px 12px;text-align:center}
.lg input{width:100%;padding:8px 10px;border:1.5px solid var(--b);border-radius:var(--r2);font-size:11px;outline:none;background:var(--s1);margin-bottom:6px}
.lg input:focus{border-color:var(--pri);background:var(--w)}
.iv{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center;cursor:pointer}
.iv.open{display:flex}
.iv img{max-width:95%;max-height:90%;border-radius:8px}
.iv-cl{position:absolute;top:14px;right:14px;color:white;font-size:26px;cursor:pointer}
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--t1);color:white;padding:8px 16px;border-radius:var(--rf);font-size:11px;z-index:1000;display:none}
.af{position:fixed;bottom:72px;left:14px;right:14px;max-width:360px;background:var(--w);border-radius:var(--r);padding:10px 12px;box-shadow:0 8px 25px rgba(0,0,0,0.15);display:none;align-items:center;gap:10px;z-index:99;border:1px solid var(--b)}
.af.open{display:flex}
.af-info{flex:1;min-width:0}
.af-tl{font-size:12px;font-weight:600}
.af-art{font-size:10px;color:var(--t4)}
@media(max-width:480px){.cw-win{width:100%;max-width:100%;bottom:0;right:0;border-radius:var(--r) var(--r) 0 0;height:80vh;max-height:80vh}.cb{width:46px;height:46px}.hero-img{width:64px;height:64px}}
</style>
</head>
<body>

<header class="hdr">
  <div class="container">
    <div class="hdr-in">
      <div class="hdr-l">
        <img src="${IMAGES.profile}" alt="" class="hdr-av" onerror="this.style.display='none'">
        <span class="hdr-nm">${p.name} <img src="${IMAGES.tiktokTick}" alt="✓" class="hdr-tk" onerror="this.style.display='none'"></span>
      </div>
      <nav class="hdr-nav">
        <a href="#accounts">Accounts</a>
        <a href="#fake">Fakes</a>
        <a href="#identity">ID</a>
        ${songs.length ? '<a href="#music">Music</a>' : ''}
        <a href="#help">Help</a>
      </nav>
    </div>
  </div>
</header>

<main class="container" style="padding-bottom:24px">

<section class="hero">
  <div class="hero-iw">
    <img src="${IMAGES.profile}" alt="" class="hero-img" onerror="this.style.display='none'">
    <div class="hero-chk"><img src="${IMAGES.tiktokTick}" alt="✓" onerror="this.style.display='none'"></div>
  </div>
  <h1 class="hero-nm">${p.name} <img src="${IMAGES.tiktokTick}" alt="✓" style="width:16px;height:16px" onerror="this.style.display='none'"></h1>
  <p class="hero-bio">${p.bio}</p>
  <div class="stats">
    <div class="stat"><div class="stat-v">${p.followers}</div><div class="stat-l">Followers</div></div>
    <div class="stat"><div class="stat-v">${p.following}</div><div class="stat-l">Following</div></div>
    <div class="stat"><div class="stat-v">${p.likes}</div><div class="stat-l">Likes</div></div>
  </div>
  <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    <span class="badge bdg-b"><img src="${IMAGES.tiktokTick}" alt="" style="width:10px;height:10px" onerror="this.style.display='none'"> Verified</span>
    <span class="badge bdg-p">Creator</span>
  </div>
  <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
    <a href="${oa[0].url}" target="_blank" class="btn btn-p"><img src="${IMAGES.tiktokIcon}" alt="" style="width:13px;height:13px" onerror="this.style.display='none'"> TikTok</a>
    <a href="${oa[1].url}" target="_blank" class="btn btn-p" style="background:#1877f2">Facebook</a>
  </div>
</section>

<section class="sec" id="accounts">
  <div class="sec-hd">
    <div class="sec-ic" style="background:var(--pri-l)">✅</div>
    <div><div class="sec-tl">Verified Accounts</div><div class="sec-sb">The only authentic profiles</div></div>
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:8px">
    ${oa.map(acc => `
    <div class="ac">
      <img src="${acc.screenshot}" alt="" class="ac-img" onerror="this.style.display='none'">
      <div class="ac-info">
        <div class="ac-nm">${acc.username} <img src="${acc.badge}" alt="✓" style="width:12px;height:12px" onerror="this.style.display='none'"></div>
        <div class="ac-meta">${acc.platform} · ${acc.followers} followers${acc.likes ? ' · '+acc.likes+' likes' : ''}</div>
      </div>
      <a href="${acc.url}" target="_blank" class="btn btn-p" style="font-size:10px;padding:6px 10px;flex-shrink:0">Follow</a>
    </div>
    `).join('')}
  </div>
</section>

<section class="sec" id="identity">
  <div class="sec-hd">
    <div class="sec-ic" style="background:var(--grn-l)">🛡️</div>
    <div><div class="sec-tl">Identity Verification</div><div class="sec-sb">Government verified identity</div></div>
  </div>
  <div class="card id-card">
    <img src="${IMAGES.realIdSS}" alt="ID Proof" onerror="this.style.display='none'">
    <p style="font-size:11px;color:var(--t2);margin-bottom:6px"><strong>✅ Verified Identity</strong><br>This profile is verified through official documentation.</p>
    <span class="badge bdg-g">✓ Confirmed</span>
  </div>
</section>

<section class="sec" id="fake">
  <div class="sec-hd">
    <div class="sec-ic" style="background:var(--red-l)">⚠️</div>
    <div><div class="sec-tl">Fake Accounts</div><div class="sec-sb">Help report these impersonators</div></div>
    <span class="badge bdg-r" style="margin-left:auto">${fa.length} Active</span>
  </div>
  <div style="text-align:center;margin-bottom:10px">
    <img src="${IMAGES.fakeDetect}" alt="" style="max-width:110px;border-radius:var(--r2)" onerror="this.style.display='none'">
  </div>
  ${fa.map((acc, i) => `
  <div class="fk">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <div style="display:flex;align-items:center;gap:4px"><span style="font-size:14px">⚠️</span><strong style="color:var(--red);font-size:12px">Fake #${i+1}</strong></div>
      <span class="badge bdg-r">${acc.threat}</span>
    </div>
    <div class="fk-iw"><img src="${acc.screenshot}" alt="" onerror="this.style.display='none'"><div class="fk-ol"><span>⚠️ FAKE ACCOUNT</span></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;margin-bottom:8px">
      <div style="background:var(--red-l);padding:6px 8px;border-radius:var(--r2)">Platform: <strong>${acc.platform}</strong></div>
      <div style="background:var(--red-l);padding:6px 8px;border-radius:var(--r2)">Username: <strong style="color:var(--red)">${acc.username}</strong></div>
      <div style="background:var(--red-l);padding:6px 8px;border-radius:var(--r2)">Reports: <strong>${acc.reports}+</strong></div>
      <div style="background:var(--red-l);padding:6px 8px;border-radius:var(--r2)">Threat: <strong style="color:var(--red)">${acc.threat}</strong></div>
    </div>
    <div style="background:var(--red-l);padding:8px 10px;border-radius:var(--r2);font-size:10px;color:var(--red);margin-bottom:8px">
      <img src="${IMAGES.flag}" alt="" style="width:12px;height:12px;vertical-align:middle;margin-right:4px" onerror="this.style.display='none'"> ${acc.reason}
    </div>
    <div style="display:flex;gap:6px">
      <a href="${acc.url}" target="_blank" class="btn btn-r" style="flex:1;font-size:10px">Report</a>
      <button onclick="copyText('${acc.username}')" class="btn btn-o" style="flex:1;font-size:10px">Copy</button>
    </div>
  </div>
  `).join('')}
  <div style="text-align:center;margin-top:10px">
    <button onclick="playFakeVoice()" class="btn btn-o" style="color:var(--red);border-color:var(--red-l);font-size:11px">🔊 Voice Alert</button>
  </div>
</section>

<section class="sec">
  <div class="sec-hd">
    <div class="sec-ic" style="background:#fef3c7">📢</div>
    <div><div class="sec-tl">Report Fake</div><div class="sec-sb">Help protect others</div></div>
  </div>
  <div class="card rp">
    <img src="${IMAGES.reportIcon}" alt="" onerror="this.style.display='none'">
    <p style="font-size:11px;color:var(--t2);margin-bottom:8px">Found an impersonator? Report it immediately.</p>
    <div style="display:flex;gap:6px;justify-content:center">
      <a href="${fa[0].url}" target="_blank" class="btn btn-r" style="font-size:10px"><img src="${IMAGES.flag}" alt="" style="width:12px;height:12px" onerror="this.style.display='none'"> Report</a>
      <button onclick="showToast('Report submitted!')" class="btn btn-o" style="font-size:10px">Submit</button>
    </div>
  </div>
</section>

${musicSection}

<section class="sec" id="help">
  <div class="sec-hd">
    <div class="sec-ic" style="background:var(--pur-l)">💬</div>
    <div><div class="sec-tl">Need Help?</div><div class="sec-sb">Chat with us directly</div></div>
  </div>
  <div class="card" style="text-align:center">
    <img src="${IMAGES.communication}" alt="" style="max-width:100px;margin:0 auto 8px" onerror="this.style.display='none'">
    <p style="font-size:11px;color:var(--t2);margin-bottom:8px">Have questions? Chat with our support team.</p>
    <button onclick="openChat()" class="btn btn-p">💬 Start Chat</button>
  </div>
</section>

</main>

<audio id="welcomeAudio" src="${VOICE.welcome}" preload="none"></audio>
<audio id="fakeAudio" src="${VOICE.fakeAlert}" preload="none"></audio>
<audio id="musicAudio" preload="none"></audio>

<div class="af" id="audioFloating">
  <button id="floatingPlayBtn" onclick="toggleFloatingPlay()" style="width:30px;height:30px;border-radius:50%;background:var(--grn);color:white;border:none;cursor:pointer;font-size:12px;flex-shrink:0">▶</button>
  <div class="af-info"><div class="af-tl" id="floatingTitle">No track</div><div class="af-art">Cover Song</div></div>
  <button onclick="closeFloatingPlayer()" style="background:none;border:none;font-size:15px;cursor:pointer;color:var(--t4);padding:4px">✕</button>
</div>

<div class="iv" id="imgViewer" onclick="closeImageViewer()"><span class="iv-cl">✕</span><img id="viewerImg" src="" alt=""></div>
<div class="toast" id="toast"></div>

<div class="cw">
  <button class="cb" id="chatBtn" onclick="openChat()"><img src="${IMAGES.messageIcon}" alt="Chat" onerror="this.style.display='none'"></button>
  <div class="cw-win" id="chatWindow">
    <div class="cw-top">
      <img src="${IMAGES.profile}" alt="" class="cw-av" onerror="this.style.display='none'">
      <div class="cw-info"><div class="cw-nm">Support Team</div><div class="cw-st" id="chatStatusText">Online</div></div>
      <button class="cw-cl" onclick="closeChat()">✕</button>
    </div>
    <div id="chatLoginForm" class="lg">
      <p style="color:var(--t3);font-size:11px;margin-bottom:8px">Enter your details to start</p>
      <input type="text" id="chatNameInput" placeholder="Your name">
      <input type="text" id="chatContactInput" placeholder="Phone number or email">
      <button onclick="registerUser()" class="btn btn-p" style="width:100%">Start Chat</button>
      <p style="color:var(--t4);font-size:9px;margin-top:4px">Use same info to restore previous chats</p>
    </div>
    <div id="chatMainUI" style="display:none;flex:1;flex-direction:column">
      <div class="cw-msgs" id="chatMessagesContainer"><div style="text-align:center;padding:10px"><span style="background:var(--s2);color:var(--t4);font-size:9px;padding:3px 8px;border-radius:8px">🔒 Secure messages</span></div></div>
      <div class="ti" id="typingIndicator"><div class="ti-b"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>
      <div class="ip" id="imagePreviewBar"><img id="previewImage" src="" alt=""><button class="ip-cl" onclick="clearImagePreview()">✕</button></div>
      <div class="rc" id="recordingBar"><div class="rc-dot"></div><span>Recording...</span><span id="recordingTime" style="margin-left:auto">00:00</span></div>
      <div class="cw-inp">
        <input type="file" id="imageFileInput" accept="image/*" style="display:none" onchange="handleImageSelect(event)">
        <button class="cw-ibtn" onclick="document.getElementById('imageFileInput').click()">🖼️</button>
        <input type="text" id="messageTextInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
        <button class="cw-ibtn" id="micButton" onmousedown="startRecording()" onmouseup="stopRecording()" onmouseleave="stopRecording()" ontouchstart="startRecording()" ontouchend="stopRecording()">🎤</button>
        <button class="cw-send" onclick="sendMessage()"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>
    </div>
  </div>
</div>

<script>
var ws=null,token=localStorage.getItem('vh_t'),chatId=null,selImg=null,mr=null,chunks=[],rs=0,rt=null,curTrack=null,curUrl='',fp=document.getElementById('musicAudio');

if(!sessionStorage.getItem('vw')){setTimeout(function(){var a=document.getElementById('welcomeAudio');if(a){a.play().catch(function(){});sessionStorage.setItem('vw','1')}},3000)}

function playFakeVoice(){var a=document.getElementById('fakeAudio');if(a)a.play().catch(function(){})}

function playTrack(el,url,title){
  document.querySelectorAll('.music-item').forEach(function(i){i.classList.remove('playing')});
  document.querySelectorAll('.music-btn').forEach(function(b){b.textContent='▶'});
  if(curUrl===url&&!fp.paused){fp.pause();curUrl='';document.getElementById('audioFloating').classList.remove('open');return}
  curUrl=url;curTrack=el;el.classList.add('playing');
  fp.src=url;fp.play().catch(function(e){showToast('Play error')});
  el.querySelector('.music-btn').textContent='⏸';
  document.getElementById('floatingTitle').textContent=title;
  document.getElementById('floatingPlayBtn').textContent='⏸';
  document.getElementById('audioFloating').classList.add('open');
  fp.onended=function(){el.querySelector('.music-btn').textContent='▶';el.classList.remove('playing');document.getElementById('audioFloating').classList.remove('open');curUrl=''}
}

function toggleFloatingPlay(){
  if(!curUrl)return;
  if(fp.paused){fp.play();document.getElementById('floatingPlayBtn').textContent='⏸'}else{fp.pause();document.getElementById('floatingPlayBtn').textContent='▶'}
}

function closeFloatingPlayer(){
  fp.pause();fp.src='';curUrl='';curTrack=null;
  document.getElementById('audioFloating').classList.remove('open');
  document.querySelectorAll('.music-btn').forEach(function(b){b.textContent='▶'});
  document.querySelectorAll('.music-item').forEach(function(i){i.classList.remove('playing')})
}

var tt;
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(tt);tt=setTimeout(function(){t.style.display='none'},2500)}
function copyText(t){navigator.clipboard.writeText(t).then(function(){showToast('Copied!')}).catch(function(){showToast('Failed')})}

function openImageViewer(url){document.getElementById('viewerImg').src=url;document.getElementById('imgViewer').classList.add('open')}
function closeImageViewer(){document.getElementById('imgViewer').classList.remove('open')}

function openChat(){document.getElementById('chatWindow').classList.add('open');if(!ws||ws.readyState!==1)connectWS()}
function closeChat(){document.getElementById('chatWindow').classList.remove('open')}

function connectWS(){
  var p=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(p+'//'+location.host+'/ws');
  ws.onopen=function(){document.getElementById('chatStatusText').textContent='Online';if(token)ws.send(JSON.stringify({type:'auth',token:token}))};
  ws.onmessage=function(e){
    var d=JSON.parse(e.data);
    if(d.type==='auth_success'){showChatUI();loadMsgs()}
    else if(d.type==='message')addMsg(d.message,d.sender,d.msgType||'text',d.mediaUrl,d.duration,d.timestamp)
    else if(d.type==='typing'){document.getElementById('typingIndicator').style.display=d.isTyping?'block':'none';document.getElementById('chatStatusText').textContent=d.isTyping?'typing...':'Online';scrollChat()}
  };
  ws.onclose=function(){document.getElementById('chatStatusText').textContent='Offline';setTimeout(function(){if(document.getElementById('chatWindow').classList.contains('open'))connectWS()},3000)}
}

function registerUser(){
  var n=document.getElementById('chatNameInput').value.trim(),c=document.getElementById('chatContactInput').value.trim();
  if(!n||!c){showToast('Fill all fields');return}
  fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phoneEmail:c})})
  .then(function(r){return r.json()})
  .then(function(d){if(d.success){token=d.token;chatId=d.chatId;localStorage.setItem('vh_t',token);showChatUI();if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'auth',token:token}));else connectWS()}else showToast(d.error||'Error')})
  .catch(function(){showToast('Connection error')})
}

function showChatUI(){document.getElementById('chatLoginForm').style.display='none';document.getElementById('chatMainUI').style.display='flex'}

function sendMessage(){
  var i=document.getElementById('messageTextInput'),msg=i.value.trim();
  if(!msg&&!selImg)return;
  if(selImg){ws.send(JSON.stringify({type:'message',token:token,message:msg||'Image',msgType:'image',mediaUrl:selImg}));clearImagePreview()}
  else ws.send(JSON.stringify({type:'message',token:token,message:msg,msgType:'text'}));
  i.value='';i.focus()
}

function addMsg(text,sender,type,url,dur,ts){
  var c=document.getElementById('chatMessagesContainer'),d=document.createElement('div');
  var t=new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  var rc=sender==='user'?'u':'a',bc=sender==='user'?'u':'a',h='';
  if(type==='image')h='<div class="mr '+rc+'"><div class="mb '+bc+'"><img src="'+url+'" class="mb-img" onclick="openImageViewer(\''+url+'\')"><div class="mb-time">'+t+'</div></div></div>';
  else if(type==='voice')h='<div class="mr '+rc+'"><div class="mb '+bc+'"><div class="mb-voice"><button onclick="playVM(this,\''+url+'\')">▶</button><span style="font-size:10px">🎤 '+(dur||0)+'s</span></div><div class="mb-time">'+t+'</div></div></div>';
  else h='<div class="mr '+rc+'"><div class="mb '+bc+'">'+eh(text)+'<div class="mb-time">'+t+'</div></div></div>';
  d.innerHTML=h;c.appendChild(d);scrollChat()
}

function eh(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function playVM(btn,url){var a=new Audio(url);a.play();btn.textContent='⏸';a.onended=function(){btn.textContent='▶'}}

function handleImageSelect(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){selImg=ev.target.result;document.getElementById('previewImage').src=selImg;document.getElementById('imagePreviewBar').style.display='block'};r.readAsDataURL(f)}
function clearImagePreview(){selImg=null;document.getElementById('imagePreviewBar').style.display='none';document.getElementById('imageFileInput').value=''}

function startRecording(){
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){
    mr=new MediaRecorder(s);chunks=[];mr.ondataavailable=function(e){chunks.push(e.data)};mr.start();
    document.getElementById('micButton').style.color='var(--red)';document.getElementById('recordingBar').style.display='flex';
    rs=Date.now();rt=setInterval(function(){var e=Math.floor((Date.now()-rs)/1000);document.getElementById('recordingTime').textContent=String(Math.floor(e/60)).padStart(2,'0')+':'+String(e%60).padStart(2,'0')},1000)
  }).catch(function(){showToast('Mic denied')})
}

function stopRecording(){
  if(!mr||mr.state==='inactive')return;
  mr.stop();document.getElementById('micButton').style.color='';document.getElementById('recordingBar').style.display='none';clearInterval(rt);
  mr.onstop=function(){var b=new Blob(chunks,{type:'audio/webm'}),r=new FileReader();r.onload=function(){var d=Math.floor((Date.now()-rs)/1000);ws.send(JSON.stringify({type:'message',token:token,message:'Voice',msgType:'voice',mediaUrl:r.result,duration:d}))};r.readAsDataURL(b);mr.stream.getTracks().forEach(function(t){t.stop()})}
}

function loadMsgs(){
  fetch('/api/messages?token='+token).then(function(r){return r.json()}).then(function(d){
    if(d.success&&d.messages.length){document.getElementById('chatMessagesContainer').innerHTML='';d.messages.forEach(function(m){addMsg(m.message,m.sender,m.type||'text',m.mediaUrl,m.duration,m.createdAt)})}
  }).catch(function(){})
}

function scrollChat(){var c=document.getElementById('chatMessagesContainer');setTimeout(function(){c.scrollTop=c.scrollHeight},50)}

var tto;
document.getElementById('messageTextInput').addEventListener('input',function(){
  if(ws&&ws.readyState===1&&token){ws.send(JSON.stringify({type:'typing',isTyping:true,token:token}));clearTimeout(tto);tto=setTimeout(function(){ws.send(JSON.stringify({type:'typing',isTyping:false,token:token}))},2000)}
});

if(token)setTimeout(connectWS,1000);
</script>
</body>
</html>`;
}

function getChatPageHTML() {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Chat</title><style>
:root{--pri:#2563eb;--w:#fff;--s1:#f8fafc;--b:#e2e8f0;--t1:#0f172a;--t3:#64748b}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,sans-serif;background:var(--s1);display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{background:var(--w);border-radius:14px;padding:24px;width:340px;box-shadow:0 4px 16px rgba(0,0,0,0.06);text-align:center}
h1{font-size:18px;color:var(--t1);margin-bottom:16px}
input{width:100%;padding:10px;margin-bottom:8px;border:1.5px solid var(--b);border-radius:9px;font-size:13px;outline:none}
input:focus{border-color:var(--pri)}
button{width:100%;padding:11px;background:var(--pri);color:white;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer}
button:hover{opacity:0.9}
</style></head><body><div class="box"><h1>💬 Start Chat</h1><form id="cf"><input type="text" id="n" placeholder="Your name" required><input type="text" id="c" placeholder="Phone or email" required><button type="submit">Start Chatting</button></form></div><script>
document.getElementById('cf').addEventListener('submit',function(e){e.preventDefault();var n=document.getElementById('n').value.trim(),c=document.getElementById('c').value.trim();if(!n||!c)return;fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phoneEmail:c})}).then(function(r){return r.json()}).then(function(d){if(d.success){localStorage.setItem('vh_t',d.token);window.location.href='/'}else alert(d.error||'Error')})})
</script></body></html>`;
}

// ============ WEB SOCKET ============
const wss = new WebSocket.Server({ noServer: true });
const userSockets = new Map();
const adminSockets = new Set();

wss.on('connection', (ws, req) => {
    const pn = url.parse(req.url).pathname;
    
    if (pn === '/ws') {
        let ud = null;
        ws.on('message', async (msg) => {
            try {
                const d = JSON.parse(msg);
                if (d.type === 'auth') {
                    const u = await getChatUserByToken(d.token);
                    if (u) {
                        ud = u; userSockets.set(u.chatId, ws);
                        ws.send(JSON.stringify({ type: 'auth_success' }));
                        setTimeout(async () => {
                            const wm = 'Hello! 👋 Welcome to Baiilla Maach Official Support. How can I help you today?';
                            await saveChatMessage(u.chatId, 'admin', wm, 'text');
                            ws.send(JSON.stringify({ type: 'message', message: wm, sender: 'admin', msgType: 'text', timestamp: new Date().toISOString() }));
                            notifyAdmins({ type: 'new_message', chatId: u.chatId, name: u.name, message: wm, sender: 'admin' });
                        }, 1500);
                    }
                } else if (d.type === 'message' && ud) {
                    await saveChatMessage(ud.chatId, 'user', d.message, d.msgType, d.mediaUrl, null, d.duration);
                    ws.send(JSON.stringify({ type: 'message', message: d.message, sender: 'user', msgType: d.msgType, mediaUrl: d.mediaUrl, duration: d.duration, timestamp: new Date().toISOString() }));
                    notifyAdmins({ type: 'new_message', chatId: ud.chatId, name: ud.name, message: d.message, sender: 'user', msgType: d.msgType, mediaUrl: d.mediaUrl, duration: d.duration });
                } else if (d.type === 'typing' && ud) {
                    notifyAdmins({ type: 'user_typing', chatId: ud.chatId, isTyping: d.isTyping });
                }
            } catch (e) {}
        });
        ws.on('close', () => { if (ud) userSockets.delete(ud.chatId); });
    } else if (pn === '/admin/ws') {
        adminSockets.add(ws);
        ws.on('message', async (msg) => {
            try {
                const d = JSON.parse(msg);
                if (d.type === 'admin_message') {
                    await saveChatMessage(d.chatId, 'admin', d.message, d.msgType, d.mediaUrl);
                    const uws = userSockets.get(d.chatId);
                    if (uws && uws.readyState === 1) uws.send(JSON.stringify({ type: 'message', message: d.message, sender: 'admin', msgType: d.msgType, mediaUrl: d.mediaUrl, timestamp: new Date().toISOString() }));
                }
            } catch (e) {}
        });
        ws.on('close', () => adminSockets.delete(ws));
    }
});

function notifyAdmins(data) { adminSockets.forEach(ws => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }); }

// ============ HTTP SERVER ============
const server = http.createServer(async (req, res) => {
    const pu = url.parse(req.url, true);
    const pn = pu.pathname;
    const m = req.method;
    const ck = parseCookies(req.headers.cookie);
    
    if (pn.startsWith('/assets/')) {
        const ap = path.join(__dir, decodeURIComponent(pn));
        if (!ap.startsWith(ASSETS_DIR) && !ap.startsWith(UPLOADS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(ap)) {
            const e = path.extname(ap).toLowerCase();
            const t = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.webm':'audio/webm' };
            res.writeHead(200, { 'Content-Type': t[e] || 'application/octet-stream' });
            fs.createReadStream(ap).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    
    if (pn === '/chat' && m === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getChatPageHTML());
        return;
    }
    
    if (pn === '/api/chat/register' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            try {
                const { name, phoneEmail } = JSON.parse(b);
                if (!name || !phoneEmail) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Name and contact required' })); return; }
                const u = await createOrGetChatUser(name, phoneEmail);
                const t = createChatSession(u.chatId);
                const em = await getChatMessages(u.chatId);
                if (em.length === 0) { await saveChatMessage(u.chatId, 'admin', 'Hello! How can I help you? 👋', 'text'); }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: u.chatId, token: t, name, phoneEmail }));
            } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: e.message })); }
        }); return;
    }
    
    if (pn === '/api/messages' && m === 'GET') {
        const u = await getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const ms = await getChatMessages(u.chatId);
        await markMessagesRead(u.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: ms }));
        return;
    }
    
    if (pn === '/admin' && m === 'GET') {
        const s = getSession(ck.sessionId);
        if (s) { adminPresence.isOnline = true; adminPresence.lastSeen = new Date(); res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(await getAdminHTML()); return; }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>body{font-family:Inter,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:white;border-radius:14px;padding:28px;width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.06)}h1{text-align:center;color:#0f172a;margin-bottom:18px}input{width:100%;padding:10px;margin-bottom:8px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;box-sizing:border-box}input:focus{border-color:#2563eb;background:white}button{width:100%;padding:11px;background:#2563eb;color:white;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer}button:hover{background:#1d4ed8}</style></head><body><div class="box"><h1>Admin Login</h1><form method="POST" action="/admin/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>');
        return;
    }
    
    if (pn === '/admin/login' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const p = new URLSearchParams(b);
            if (await verifyAdmin(p.get('username'), p.get('password'))) {
                const s = createSession(p.get('username'));
                adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
                res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=' + s + ';HttpOnly;Path=/;Max-Age=7200' }); res.end();
            } else { res.writeHead(302, { 'Location': '/admin?error=1' }); res.end(); }
        }); return;
    }
    
    if (pn === '/admin/logout') {
        sessions.delete(ck.sessionId);
        adminPresence.isOnline = false; adminPresence.lastSeen = new Date();
        res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'sessionId=;HttpOnly;Path=/;Max-Age=0' }); res.end(); return;
    }
    
    if (pn === '/api/admin/messages' && m === 'GET') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        await markMessagesRead(pu.query.chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: await getChatMessages(pu.query.chatId) }));
        return;
    }
    
    if (pn === '/api/admin/send' && m === 'POST') {
        if (!getSession(ck.sessionId)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        let b = ''; req.on('data', c => b += c); req.on('end', async () => {
            const { chatId, message, type, fileUrl } = JSON.parse(b);
            await saveChatMessage(chatId, 'admin', message, type, fileUrl);
            adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    if (pn === '/' || pn === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getMainHTML());
        return;
    }
    
    res.writeHead(404); res.end('404');
});

server.on('upgrade', (req, socket, head) => {
    const pn = url.parse(req.url).pathname;
    if (pn === '/ws' || pn === '/admin/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => { wss.emit('connection', ws, req); });
    } else { socket.destroy(); }
});

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(v => { const [n, ...val] = v.split('='); if (n) c[n.trim()] = val.join('=').trim(); });
    return c;
}

async function getAdminHTML() {
    const cl = await getAdminChatList();
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;background:#f8fafc;height:100vh;display:flex}.sb{width:340px;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column}.sb-hd{padding:14px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:space-between}.sb-hd a{color:rgba(255,255,255,0.8);text-decoration:none;font-size:12px}.main{flex:1;display:flex;flex-direction:column;background:white}.msg-area{flex:1;overflow-y:auto;padding:14px;background:#f8fafc}.msg-bub{max-width:70%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.4;margin-bottom:5px;word-wrap:break-word}.msg-in{background:white;color:#0f172a;float:left;clear:both;border-bottom-left-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}.msg-out{background:#2563eb;color:white;float:right;clear:both;border-bottom-right-radius:3px}.inp-area{padding:10px 14px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:6px}.inp-area input{flex:1;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:16px;font-size:12px;outline:none;background:#f8fafc}.inp-area input:focus{border-color:#2563eb;background:white}.inp-area button{width:36px;height:36px;border-radius:50%;background:#2563eb;color:white;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}</style></head><body><div class="sb"><div class="sb-hd"><span>Conversations</span><div style="display:flex;gap:10px"><a href="/">Site</a><a href="/admin/logout">Logout</a></div></div><div style="flex:1;overflow-y:auto">' + cl.map(u => '<div onclick="openChat(\'' + u.chatId + '\',\'' + u.name.replace(/'/g,"\\'") + '\')" style="padding:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px"><div style="width:36px;height:36px;border-radius:50%;background:#7c3aed;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">' + u.name.charAt(0) + '</div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">' + u.name + '</div><div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (u.lastMessage ? u.lastMessage.message.substring(0,25) : 'No messages') + '</div></div>' + (u.unread > 0 ? '<div style="background:#2563eb;color:white;font-size:9px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center">' + u.unread + '</div>' : '') + '</div>').join('') + '</div></div><div class="main" id="mainArea"><div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-direction:column;gap:8px"><span style="font-size:40px">💬</span><p>Select a conversation</p></div></div><script>
var ws,currentChat=null;(function connect(){var p=location.protocol==="https:"?"wss:":"ws:";ws=new WebSocket(p+"//"+location.host+"/admin/ws");ws.onmessage=function(e){var d=JSON.parse(e.data);if(d.type==="new_message"&&d.chatId===currentChat)addMsg(d.message,d.sender,d.msgType,d.mediaUrl,d.duration)};ws.onclose=function(){setTimeout(connect,3000)}})();
async function openChat(cid,name){currentChat=cid;document.getElementById("mainArea").innerHTML=\'<div style="padding:14px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px"><div style="width:36px;height:36px;border-radius:50%;background:#f59e0b;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">\'+name.charAt(0)+\'</div><div><div style="font-weight:600;font-size:13px">\'+name+\'</div><div style="font-size:10px;color:#94a3b8">online</div></div></div><div class="msg-area" id="msgContainer"><div id="msgs"></div></div><div class="inp-area"><input id="adminInput" placeholder="Type..." onkeypress="if(event.key===\\\'Enter\\\')sendAdminMsg()"><button onclick="sendAdminMsg()">➤</button></div>\';var r=await fetch("/api/admin/messages?chatId="+cid);var d=await r.json();if(d.success){document.getElementById("msgs").innerHTML="";d.messages.forEach(function(m){addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt)});scrollB()}}
function addMsg(text,sender,type,url,duration,time){var c=document.getElementById("msgs");if(!c)return;var t=new Date(time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});var b=sender==="user"?"msg-in":"msg-out";var d=document.createElement("div");d.style.clear="both";d.style.marginBottom="6px";if(type==="image")d.innerHTML=\'<div class="msg-bub \'+b+\'"><img src="\'+url+\'" style="max-width:180px;border-radius:8px;cursor:pointer" onclick="window.open(\\\'\'+url+\'\\\')"><div style="font-size:9px;opacity:0.7;text-align:right;margin-top:2px">\'+t+\'</div></div>\';else d.innerHTML=\'<div class="msg-bub \'+b+\'">\'+text+\'<div style="font-size:9px;opacity:0.7;text-align:right;margin-top:2px">\'+t+\'</div></div>\';c.appendChild(d);scrollB()}
function scrollB(){var c=document.getElementById("msgContainer");if(c)setTimeout(function(){c.scrollTop=c.scrollHeight},50)}
async function sendAdminMsg(){var i=document.getElementById("adminInput");var m=i.value.trim();if(!m)return;i.value="";if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:"admin_message",chatId:currentChat,message:m}));await fetch("/api/admin/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:currentChat,message:m,type:"text"})});addMsg(m,"admin","text",null,null,new Date().toISOString())}
setInterval(function(){if(currentChat)fetch("/api/admin/messages?chatId="+currentChat).then(function(r){return r.json()}).then(function(d){if(d.success){document.getElementById("msgs").innerHTML="";d.messages.forEach(function(m){addMsg(m.message,m.sender,m.type,m.mediaUrl,m.duration,m.createdAt)})}})},3000)
</script></body></html>';
}

async function start() {
    const dbOk = await connectDB();
    if (dbOk) console.log('MongoDB Connected');
    else console.log('Using in-memory storage');
    server.listen(PORT, function() { console.log('Server: http://localhost:' + PORT); });
}
start().catch(console.error);

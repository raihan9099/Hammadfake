const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const { getChatPageHTML } = require('./chat');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/milow?retryWrites=true&w=majority';
const DB_NAME = 'verification_hub';

let db, mongoClient;
let dbConnected = false;

const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');

[ASSETS_DIR, GALLERY_DIR, COVER_MUSIC_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
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
    blueTick: "/assets/check-mark.png",  // Using check-mark.png for verified badge
    voiceMic: "/assets/microphone-in-hand.gif",
    facebookIcon: "/assets/communication.png",
    socialMedia: "/assets/social-media.png",
    musicIcon: "/assets/music-icon.png",
    flagIcon: "/assets/flag.png"
};

const VOICE = {
    welcome: "/assets/realvoice.mp3",
    fakeAlert: "/assets/7 lak like but its fake.mp3"
};

const adminPresence = { isOnline: false, lastSeen: null };

const memoryStore = {
    users: new Map(),
    sessions: new Map(),
    messages: new Map()
};

// ... [Keep all existing functions: getCoverSongs, connectDB, getGalleryPhotos, etc.] ...

function getMainHTML(galleryPhotos) {
    galleryPhotos = galleryPhotos || [];
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;
    const profilePic = DATA.celebrity.photo;
    const statusText = getLastSeenText();
    const isOnline = adminPresence.isOnline;

    let fakeCardsHTML = '';
    DATA.fakeAccounts.forEach(function(a) {
        fakeCardsHTML += '<div class="fake-card">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
            '<img src="' + IMAGES.flagIcon + '" style="width:18px;height:18px" alt="Flag">' +
            '<span style="font-weight:700;color:#fca5a5;font-size:15px">' + a.username + '</span>' +
            '<span class="badge badge-red" style="margin-left:auto;font-size:10px">⚠ ' + a.threatLevel + '</span>' +
            '</div>' +
            '<div class="fake-screenshot-wrapper">' +
            '<img src="' + a.screenshot + '" class="fake-screenshot-img" alt="Fake Account Screenshot">' +
            '<div class="fake-warning-overlay">' +
            '<div class="fake-warning-icon">⚠️</div>' +
            '<div class="fake-warning-text">FAKE ACCOUNT</div>' +
            '</div>' +
            '</div>' +
            '<div style="margin-top:12px">' +
            '<div style="font-size:12px;color:#f87171;margin-bottom:8px;line-height:1.5">⚠ ' + a.reason + '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
            '<a href="' + a.profileUrl + '" target="_blank" class="btn btn-red btn-sm">🚩 Report Now</a>' +
            '<button onclick="copyTxt(\'' + a.username + '\')" class="btn btn-outline btn-sm">📋 Copy Username</button>' +
            '<span style="margin-left:auto;font-size:10px;color:var(--text3)">' + a.reportedCount + ' reports</span>' +
            '</div>' +
            '</div>' +
            '</div>';
    });

    // Fixed Official Accounts with proper Follow button alignment
    let officialCardsHTML = '';
    DATA.realAccounts.forEach(function(acc) {
        officialCardsHTML += '<div class="official-card">' +
            '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">' +
            '<img src="' + acc.icon + '" style="width:24px;height:24px;flex-shrink:0" alt="' + acc.platform + '">' +
            '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
            '<span style="font-weight:600;font-size:14px;color:var(--text)">' + acc.username + '</span>' +
            '<img src="' + IMAGES.blueTick + '" style="width:16px;height:16px;flex-shrink:0" alt="Verified">' +
            '</div>' +
            '<div style="font-size:10px;color:var(--text3);margin-top:2px">' + acc.followers + ' followers</div>' +
            '</div>' +
            '</div>' +
            '<a href="' + acc.url + '" target="_blank" class="btn btn-green btn-sm" style="flex-shrink:0;white-space:nowrap">Follow</a>' +
            '</div>';
    });

    let galleryHTML = '';
    if (galleryPhotos.length === 0) {
        galleryHTML = '<p style="color:var(--text3);text-align:center;padding:30px;grid-column:1/-1">No photos yet</p>';
    } else {
        galleryPhotos.forEach(function(p) {
            galleryHTML += '<div class="gallery-item"><img src="' + p.path + '" alt="Photo" loading="lazy"></div>';
        });
    }

    // ... [Keep musicSectionHTML code] ...

    return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
'<meta name="theme-color" content="#0f0f1a">' +
'<title>Baiilla Maach | Verification Hub</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
'<style>' +
':root{--bg:#0a0a14;--surface:#13132b;--surface2:#1a1a35;--text:#f0f0ff;--text2:#a0a0cc;--text3:#6060a0;--purple:#8b5cf6;--purple2:#a78bfa;--pink:#ec4899;--green:#10b981;--red:#ef4444;--yellow:#eab308;--glass-border:rgba(255,255,255,0.06);--glow-purple:0 0 40px rgba(139,92,246,0.3);--glow-green:0 0 30px rgba(16,185,129,0.3);--glow-red:0 0 30px rgba(239,68,68,0.3);--glow-yellow:0 0 30px rgba(234,179,8,0.3)}' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Plus Jakarta Sans",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}' +
'.stars-bg{position:fixed;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;overflow:hidden}' +
'.star{position:absolute;background:white;border-radius:50%;animation:twinkle var(--dur) ease-in-out infinite;animation-delay:var(--delay);opacity:0}' +
'@keyframes twinkle{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:0.8;transform:scale(1.5)}}' +
'.orb{position:fixed;border-radius:50%;filter:blur(80px);opacity:0.3;pointer-events:none;z-index:0;animation:floatOrb var(--dur) ease-in-out infinite}' +
'@keyframes floatOrb{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,-40px) scale(1.1)}50%{transform:translate(-20px,-80px) scale(0.9)}75%{transform:translate(-40px,-20px) scale(1.05)}}' +
'main{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:16px}' +
'.glass-card{background:var(--surface);border:1px solid var(--glass-border);border-radius:24px;padding:24px;margin-bottom:20px;transition:all 0.4s}' +
'.glass-card:hover{transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,0.4)}' +
'.danger-card{border-left:3px solid var(--red)}' +
'.success-card{border-left:3px solid var(--green)}' +
'.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:50px;font-weight:600;font-size:13px;cursor:pointer;border:none;text-decoration:none;transition:all 0.3s}' +
'.btn-purple{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;box-shadow:var(--glow-purple)}' +
'.btn-red{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:var(--glow-red)}' +
'.btn-green{background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:var(--glow-green)}' +
'.btn-outline{background:transparent;border:1px solid var(--glass-border);color:var(--text2)}' +
'.btn-sm{padding:6px 14px;font-size:11px}' +
'.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:50px;font-size:11px;font-weight:600}' +
'.badge-red{background:rgba(239,68,68,0.15);color:#fca5a5}' +
'.badge-green{background:rgba(16,185,129,0.15);color:#6ee7b7}' +
'.badge-purple{background:rgba(139,92,246,0.15);color:#c4b5fd}' +
'.badge-yellow{background:rgba(234,179,8,0.15);color:#fde047}' +
'.main-header{background:rgba(10,10,20,0.8);backdrop-filter:blur(30px);border-bottom:1px solid var(--glass-border);padding:12px 0;position:sticky;top:0;z-index:100}' +
'.header-inner{display:flex;align-items:center;justify-content:space-between;max-width:860px;margin:0 auto;padding:0 16px}' +
'.header-logo{display:flex;align-items:center;gap:10px}' +
'.header-logo img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)}' +
'.header-title{font-weight:700;font-size:16px;background:linear-gradient(135deg,#c4b5fd,#f9a8d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}' +
'.header-nav{display:flex;gap:6px}' +
'.header-nav a{padding:7px 14px;border-radius:50px;font-size:11px;font-weight:600;text-decoration:none}' +
'.nav-red{color:#fca5a5;background:rgba(239,68,68,0.1)}' +
'.nav-green{color:#6ee7b7;background:rgba(16,185,129,0.1)}' +
'.nav-purple{color:#c4b5fd;background:rgba(139,92,246,0.1)}' +
'.profile-section{text-align:center;padding:30px 0 20px}' +
'.profile-pic-wrap{position:relative;display:inline-block;margin-bottom:12px}' +
'.profile-pic{width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--purple);box-shadow:var(--glow-purple)}' +
// Fixed: Using check-mark.png image for verified badge
'.verified-badge-prof{position:absolute;bottom:4px;right:4px;width:30px;height:30px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;border:3px solid var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden}' +
'.verified-badge-prof img{width:16px;height:16px;object-fit:contain}' +
'.profile-name{font-size:26px;font-weight:800;background:linear-gradient(135deg,#c4b5fd,#f9a8d4,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:8px}' +
'.profile-bio{color:var(--text2);font-size:13px;margin-top:6px}' +
'.stats-row{display:flex;justify-content:center;gap:16px;margin:20px 0;flex-wrap:wrap}' +
'.stat-card{background:var(--surface2);border:1px solid var(--glass-border);border-radius:18px;padding:16px 24px;text-align:center}' +
'.stat-value{font-size:22px;font-weight:700;color:var(--purple2)}' +
'.stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px}' +
'.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--glass-border)}' +
'.icon-circle{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}' +
'.icon-red{background:rgba(239,68,68,0.15)}' +
'.icon-green{background:rgba(16,185,129,0.15)}' +
'.icon-yellow{background:rgba(234,179,8,0.15)}' +
'.section-title{font-size:18px;font-weight:700}' +
'.section-subtitle{font-size:11px;color:var(--text3);margin-top:2px}' +
'.fake-card{background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:18px;padding:18px;margin-bottom:16px}' +
'.fake-screenshot-wrapper{position:relative;width:100%;border-radius:16px;overflow:hidden;border:2px solid rgba(239,68,68,0.3);background:#000;margin:8px 0}' +
'.fake-screenshot-img{width:100%;display:block;border-radius:14px;transition:all 0.3s}' +
'.fake-warning-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;z-index:2}' +
'.fake-warning-icon{font-size:48px;animation:warningBounce 1s ease-in-out infinite;filter:drop-shadow(0 0 20px rgba(239,68,68,0.8))}' +
'.fake-warning-text{background:rgba(239,68,68,0.9);color:#fff;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:700;letter-spacing:0.05em;animation:warningPulse 2s ease-in-out infinite;backdrop-filter:blur(4px)}' +
'@keyframes warningBounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.1)}}' +
'@keyframes warningPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.05)}}' +
// Fixed: Official card with proper Follow button alignment
'.official-card{background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:18px;padding:16px 18px;margin-bottom:10px;display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:nowrap}' +
'.warning-image-container{text-align:center;padding:20px;background:rgba(234,179,8,0.05);border:1px solid rgba(234,179,8,0.2);border-radius:18px;margin-bottom:20px}' +
'.warning-image-container img{max-width:100%;border-radius:16px;box-shadow:var(--glow-yellow)}' +
// ... [Keep rest of CSS] ...
'@media(max-width:640px){' +
'.chat-widget{bottom:16px;right:16px}' +
'.header-nav{display:none}' +
'.fake-warning-icon{font-size:36px}' +
'.fake-warning-text{font-size:10px;padding:4px 12px}' +
'.official-card{flex-wrap:wrap;gap:10px}' +
'.official-card .btn{width:100%;justify-content:center}' +
'}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="stars-bg" id="starsBg"></div>' +
'<div class="orb" style="width:300px;height:300px;background:rgba(139,92,246,0.4);top:10%;left:-100px;--dur:8s"></div>' +
'<div class="orb" style="width:250px;height:250px;background:rgba(236,72,153,0.3);top:50%;right:-80px;--dur:10s"></div>' +
'<div class="orb" style="width:200px;height:200px;background:rgba(59,130,246,0.3);bottom:10%;left:30%;--dur:12s"></div>' +
'<div id="toast" class="toast"></div>' +
'<header class="main-header"><div class="header-inner"><div class="header-logo"><img src="' + profilePic + '" alt="Logo"><span class="header-title">Verification Hub</span></div><nav class="header-nav"><a href="#fake" class="nav-red">⚠ Fakes</a>' + (coverSongs.length > 0 ? '<a href="#music" class="nav-purple">🎵 Music</a>' : '') + '<a href="#warning" class="nav-purple">🔍 Detection</a><a href="#official" class="nav-green">✓ Official</a><a href="#gallery" class="nav-purple">📸 Gallery</a></nav></div></header>' +
'<main>' +
// Fixed: Profile section with check-mark.png image
'<section class="profile-section"><div class="profile-pic-wrap"><img src="' + profilePic + '" class="profile-pic" alt="Profile"><div class="verified-badge-prof"><img src="' + IMAGES.blueTick + '" alt="Verified"></div></div><h1 class="profile-name">' + DATA.celebrity.fullName + '</h1><p class="profile-bio">' + DATA.celebrity.bio + '</p><div class="stats-row"><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokFollowers + '</div><div class="stat-label">Followers</div></div><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokFollowing + '</div><div class="stat-label">Following</div></div><div class="stat-card"><div class="stat-value">' + DATA.celebrity.tiktokLikes + '</div><div class="stat-label">Likes</div></div></div><div style="display:flex;gap:8px;justify-content:center"><span class="badge badge-green"><img src="' + IMAGES.blueTick + '" style="width:12px;height:12px"> Verified</span><span class="badge badge-purple">Creator</span></div></section>' +
'<section id="fake" class="glass-card danger-card">' + 
// ... [Keep fake section] ... +
'</section>' +
musicSectionHTML +
// ... [Keep rest of sections] ... +
'<section id="official" class="glass-card success-card"><div class="section-header"><div class="icon-circle icon-green">✓</div><div><div class="section-title" style="color:#6ee7b7">Official Verified Accounts</div><div class="section-subtitle">Only follow these real accounts</div></div></div>' + officialCardsHTML + '</section>' +
// ... [Keep gallery and chat widget] ... +
'</main>' +
// ... [Keep scripts] ... +
'</body></html>';
}

// Admin Panel Mobile-Friendly Chat Interface
async function getAdminChatHTML(cid, cl, ms) {
    let messagesHTML = '';
    ms.forEach(function(m) {
        var cls = m.sender === 'user' ? 'user' : 'admin';
        messagesHTML += '<div class="msg-b ' + cls + '"><div class="bub">' + renderMsgBubble(m) + '</div></div>';
    });

    return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,target-densitydpi=device-dpi">' +
'<meta name="theme-color" content="#0a0a14">' +
'<meta name="apple-mobile-web-app-capable" content="yes">' +
'<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
'<title>Admin Chat</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">' +
'<style>' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Plus Jakarta Sans",sans-serif;background:#0a0a14;color:#fff;height:100vh;overflow:hidden;display:flex;flex-direction:column}' +
'.app-container{display:flex;height:100vh;width:100%}' +
// Mobile sidebar
'.mobile-sidebar{width:100%;max-width:360px;background:#13132b;border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;flex-shrink:0}' +
'.sidebar-header{padding:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}' +
'.sidebar-header h2{font-size:16px;font-weight:600;color:#fff}' +
'.sidebar-header-actions{display:flex;gap:8px}' +
'.icon-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}' +
'.icon-btn:active{background:rgba(255,255,255,0.25);transform:scale(0.95)}' +
'.chat-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
// Chat list items with touch-friendly design
'.chat-item{padding:14px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.2s;display:flex;align-items:center;gap:12px;position:relative;touch-action:manipulation}' +
'.chat-item:active{background:rgba(139,92,246,0.15)}' +
'.chat-item.active{background:rgba(139,92,246,0.2);border-left:3px solid #8b5cf6}' +
'.chat-avatar{width:44px;height:44px;border-radius:50%;background:rgba(139,92,246,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}' +
'.chat-info{flex:1;min-width:0}' +
'.chat-name{font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:space-between}' +
'.chat-preview{font-size:11px;opacity:0.5;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'.chat-time{font-size:10px;opacity:0.4}' +
'.unread-badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;min-width:20px;text-align:center}' +
// View button for mobile
'.view-btn{background:#8b5cf6;color:#fff;border:none;padding:8px 16px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;touch-action:manipulation;transition:all 0.2s}' +
'.view-btn:active{background:#7c3aed;transform:scale(0.95)}' +
// Main chat area
'.main-chat{flex:1;display:flex;flex-direction:column;background:#0a0a14;position:relative}' +
'.chat-header{padding:14px 16px;background:#13132b;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:12px;flex-shrink:0}' +
'.back-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:18px;cursor:pointer;display:none;align-items:center;justify-content:center;touch-action:manipulation}' +
'.messages-container{flex:1;overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:12px}' +
'.msg-b{display:flex;margin-bottom:8px}' +
'.msg-b.user{justify-content:flex-start}' +
'.msg-b.admin{justify-content:flex-end}' +
'.bub{max-width:75%;padding:10px 14px;border-radius:18px;font-size:13px;word-wrap:break-word;line-height:1.4}' +
'.msg-b.user .bub{background:#1a1a35;border-bottom-left-radius:4px}' +
'.msg-b.admin .bub{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-bottom-right-radius:4px}' +
// Input area
'.input-area{background:#13132b;padding:12px;display:flex;gap:8px;align-items:center;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0}' +
'.attach-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation}' +
'.attach-btn:active{background:rgba(255,255,255,0.2)}' +
'.msg-input{flex:1;padding:10px 16px;background:#1a1a35;border:1px solid rgba(255,255,255,0.1);border-radius:25px;color:#fff;font-size:14px;outline:none;min-width:0}' +
'.msg-input:focus{border-color:#8b5cf6}' +
'.send-btn{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;padding:10px 20px;border-radius:25px;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;touch-action:manipulation;transition:all 0.2s}' +
'.send-btn:active{transform:scale(0.95);opacity:0.9}' +
// Voice player
'.voice-player{display:flex;align-items:center;gap:8px;padding:8px 0}' +
'.voice-play-btn{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:12px;cursor:pointer;flex-shrink:0}' +
'.voice-wave{display:flex;align-items:center;gap:2px;flex:1;height:20px}' +
'.voice-bar{width:3px;background:#8b5cf6;border-radius:2px;animation:voiceAnim 1s ease-in-out infinite}' +
'@keyframes voiceAnim{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.3)}}' +
// Connection status
'.connection-status{position:fixed;top:0;left:0;right:0;padding:4px;text-align:center;font-size:10px;z-index:9999;transition:all 0.3s}' +
'.connection-status.connected{background:#10b981;color:#fff}' +
'.connection-status.disconnected{background:#ef4444;color:#fff}' +
'.connection-status.reconnecting{background:#eab308;color:#000}' +
// Image preview
'.image-preview{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
'.image-preview img{max-width:95%;max-height:95%;border-radius:12px;object-fit:contain}' +
// Empty state
'.empty-state{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;opacity:0.5}' +
'.empty-state-icon{font-size:60px}' +
'.empty-state-text{font-size:14px}' +
// Loading spinner
'.loading-spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,0.2);border-top-color:#8b5cf6;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block}' +
'@keyframes spin{to{transform:rotate(360deg)}}' +
// Responsive design
'@media(max-width:768px){' +
'.mobile-sidebar{position:fixed;top:0;left:0;bottom:0;z-index:100;transform:translateX(0);transition:transform 0.3s}' +
'.mobile-sidebar.hidden{transform:translateX(-100%)}' +
'.main-chat{position:fixed;top:0;left:0;right:0;bottom:0;z-index:90}' +
'.back-btn{display:flex}' +
'.chat-header{padding-left:12px}' +
'}' +
'@media(min-width:769px){' +
'.back-btn{display:none}' +
'}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="connection-status connected" id="connectionStatus">● Connected</div>' +
'<div class="app-container">' +
// Sidebar
'<div class="mobile-sidebar" id="sidebar">' +
'<div class="sidebar-header">' +
'<h2>💬 Chats</h2>' +
'<div class="sidebar-header-actions">' +
'<button class="icon-btn" onclick="refreshChatList()" title="Refresh">↻</button>' +
'<a href="/admin" class="icon-btn" style="text-decoration:none" title="Back">←</a>' +
'</div>' +
'</div>' +
'<div class="chat-list" id="chatList">' +
cl.map(function(c) { 
    return '<div class="chat-item' + (c.chatId === cid ? ' active' : '') + '" onclick="selectChat(\'' + c.chatId + '\')">' +
        '<div class="chat-avatar">' + c.name.charAt(0).toUpperCase() + '</div>' +
        '<div class="chat-info">' +
        '<div class="chat-name">' +
        '<span>' + c.name + '</span>' +
        (c.unread > 0 ? '<span class="unread-badge">' + c.unread + '</span>' : '') +
        '</div>' +
        '<div class="chat-preview">' + (c.lastMessage ? (c.lastMessage.message || '📷 Photo').substring(0, 25) : 'No messages') + '</div>' +
        '</div>' +
        '<button class="view-btn" onclick="event.stopPropagation();selectChat(\'' + c.chatId + '\')">View</button>' +
        '</div>';
}).join('') +
(cl.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">No active chats</div></div>' : '') +
'</div>' +
'</div>' +
// Main chat area
'<div class="main-chat" id="mainChat">' +
(cid ? 
    '<div class="chat-header">' +
    '<button class="back-btn" onclick="toggleSidebar()">←</button>' +
    '<div class="chat-avatar" style="width:36px;height:36px;font-size:14px">' + (cl.find(function(c) { return c.chatId === cid; }) ? cl.find(function(c) { return c.chatId === cid; }).name.charAt(0).toUpperCase() : '?') + '</div>' +
    '<div style="flex:1">' +
    '<div style="font-weight:600;font-size:14px">' + (cl.find(function(c) { return c.chatId === cid; }) ? cl.find(function(c) { return c.chatId === cid; }).name : 'Unknown') + '</div>' +
    '<div style="font-size:10px;opacity:0.5">Online</div>' +
    '</div>' +
    '</div>' +
    '<div class="messages-container" id="messagesContainer">' + messagesHTML + '</div>' +
    '<div class="input-area">' +
    '<input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFileUpload(event)">' +
    '<button class="attach-btn" onclick="document.getElementById(\'fileInput\').click()">📎</button>' +
    '<input type="text" class="msg-input" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key===\'Enter\')sendMessage()">' +
    '<button class="send-btn" onclick="sendMessage()">Send</button>' +
    '</div>' +
    '<audio id="voicePlayer" style="display:none"></audio>' +
    '<div class="image-preview" id="imagePreview" style="display:none" onclick="this.style.display=\'none\'">' +
    '<img id="previewImg" src="" alt="Preview">' +
    '</div>'
    :
    '<div class="empty-state">' +
    '<div class="empty-state-icon">💬</div>' +
    '<div class="empty-state-text">Select a chat to start messaging</div>' +
    '<button class="view-btn" onclick="refreshChatList()" style="margin-top:12px">Refresh List</button>' +
    '</div>'
) +
'</div>' +
'</div>' +
'<script>' +
'var currentChatId = "' + (cid || '') + '";' +
'var isConnected = true;' +
'var messagePollInterval;' +
'var listPollInterval;' +
// Initialize
'function init() {' +
    'if(currentChatId) {' +
        'startMessagePolling();' +
        'scrollToBottom();' +
    '}' +
    'startListPolling();' +
    'updateConnectionStatus();' +
'}' +
// Connection status
'function updateConnectionStatus() {' +
    'var status = document.getElementById("connectionStatus");' +
    'if(navigator.onLine) {' +
        'status.className = "connection-status connected";' +
        'status.textContent = "● Connected";' +
        'isConnected = true;' +
    '} else {' +
        'status.className = "connection-status disconnected";' +
        'status.textContent = "● Disconnected - Trying to reconnect...";' +
        'isConnected = false;' +
    '}' +
    'setTimeout(function() {' +
        'status.style.opacity = "0";' +
        'setTimeout(function() { status.style.opacity = "1"; }, 3000);' +
    '}, 2000);' +
'}' +
'window.addEventListener("online", function() {' +
    'updateConnectionStatus();' +
    'if(currentChatId) startMessagePolling();' +
    'startListPolling();' +
'});' +
'window.addEventListener("offline", function() {' +
    'updateConnectionStatus();' +
    'clearInterval(messagePollInterval);' +
    'clearInterval(listPollInterval);' +
'});' +
// Polling functions
'function startMessagePolling() {' +
    'clearInterval(messagePollInterval);' +
    'messagePollInterval = setInterval(loadMessages, 1500);' +
'}' +
'function startListPolling() {' +
    'clearInterval(listPollInterval);' +
    'listPollInterval = setInterval(refreshChatList, 5000);' +
'}' +
// Load messages
'function loadMessages() {' +
    'if(!currentChatId || !isConnected) return;' +
    'fetch("/api/admin/messages?chatId=" + currentChatId)' +
    '.then(function(r) { return r.json(); })' +
    '.then(function(d) {' +
        'if(d.success) {' +
            'var container = document.getElementById("messagesContainer");' +
            'var wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;' +
            'var html = "";' +
            'd.messages.forEach(function(m) {' +
                'var cls = m.sender === "user" ? "user" : "admin";' +
                'html += \'<div class="msg-b \' + cls + \'"><div class="bub">\' + renderMessageContent(m) + \'</div></div>\';' +
            '});' +
            'container.innerHTML = html;' +
            'if(wasAtBottom) scrollToBottom();' +
        '}' +
    '})' +
    '.catch(function() {' +
        'document.getElementById("connectionStatus").className = "connection-status reconnecting";' +
        'document.getElementById("connectionStatus").textContent = "● Reconnecting...";' +
    '});' +
'}' +
// Render message content
'function renderMessageContent(m) {' +
    'var time = new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});' +
    'var content = "";' +
    'if(m.type === "image" && m.fileUrl) {' +
        'content = \'<img src="\' + m.fileUrl + \'" style="max-width:200px;max-height:200px;border-radius:12px;cursor:pointer" onclick="showImage(\\\'\' + m.fileUrl + \'\\\')">\';' +
    '} else if(m.type === "voice" && m.fileUrl) {' +
        'content = \'<div class="voice-player"><button class="voice-play-btn" onclick="playVoice(\\\'\' + m.fileUrl + \'\\\',this)">▶</button><div class="voice-wave">\';' +
        'for(var i=0;i<10;i++) {' +
            'content += \'<div class="voice-bar" style="animation-delay:\' + (i*0.1) + \'s;height:\' + (8+Math.random()*14) + \'px"></div>\';' +
        '}' +
        'content += \'</div></div>\';' +
    '} else {' +
        'content = m.message;' +
    '}' +
    'content += \'<div style="font-size:10px;opacity:0.5;margin-top:4px">\' + time + \'</div>\';' +
    'return content;' +
'}' +
// Send message
'function sendMessage() {' +
    'var input = document.getElementById("messageInput");' +
    'var msg = input.value.trim();' +
    'if(!msg || !currentChatId) return;' +
    'input.value = "";' +
    'fetch("/api/admin/send", {' +
        'method:"POST",' +
        'headers:{"Content-Type":"application/json"},' +
        'body:JSON.stringify({chatId:currentChatId,message:msg,type:"text"})' +
    '}).then(function() {' +
        'loadMessages();' +
    '});' +
'}' +
// File upload
'function handleFileUpload(event) {' +
    'var file = event.target.files[0];' +
    'if(!file || !currentChatId) return;' +
    'var formData = new FormData();' +
    'formData.append("photo", file);' +
    'fetch("/api/admin/upload-file?chatId=" + currentChatId, {' +
        'method:"POST",' +
        'body:formData' +
    '}).then(function(r) { return r.json(); })' +
    '.then(function(d) {' +
        'if(d.success) {' +
            'fetch("/api/admin/send", {' +
                'method:"POST",' +
                'headers:{"Content-Type":"application/json"},' +
                'body:JSON.stringify({chatId:currentChatId,message:"📷 Photo",type:"image",fileUrl:d.fileUrl})' +
            '}).then(function() {' +
                'loadMessages();' +
            '});' +
        '}' +
    '});' +
    'event.target.value = "";' +
'}' +
// Voice player
'function playVoice(url, btn) {' +
    'var player = document.getElementById("voicePlayer");' +
    'if(player.src === url && !player.paused) {' +
        'player.pause();' +
        'btn.textContent = "▶";' +
        'return;' +
    '}' +
    'player.src = url;' +
    'player.play();' +
    'btn.textContent = "⏸";' +
    'player.onended = function() { btn.textContent = "▶"; };' +
    'player.onpause = function() { btn.textContent = "▶"; };' +
'}' +
// Image preview
'function showImage(url) {' +
    'document.getElementById("previewImg").src = url;' +
    'document.getElementById("imagePreview").style.display = "flex";' +
'}' +
// Chat selection
'function selectChat(chatId) {' +
    'window.location.href = "/admin/chat?chatId=" + chatId;' +
'}' +
// Sidebar toggle for mobile
'function toggleSidebar() {' +
    'document.getElementById("sidebar").classList.toggle("hidden");' +
'}' +
// Refresh chat list
'function refreshChatList() {' +
    'fetch("/admin/chat?chatId=" + currentChatId)' +
    '.then(function(r) { return r.text(); })' +
    '.then(function(html) {' +
        'var parser = new DOMParser();' +
        'var doc = parser.parseFromString(html, "text/html");' +
        'var newList = doc.getElementById("chatList");' +
        'if(newList) {' +
            'document.getElementById("chatList").innerHTML = newList.innerHTML;' +
        '}' +
    '});' +
'}' +
// Scroll to bottom
'function scrollToBottom() {' +
    'var container = document.getElementById("messagesContainer");' +
    'if(container) {' +
        'container.scrollTop = container.scrollHeight;' +
    '}' +
'}' +
// Initialize on load
'window.addEventListener("load", init);' +
// Touch event handling for mobile
'document.addEventListener("touchstart", function(){}, {passive:true});' +
'</script>' +
'</body>' +
'</html>';
}

// ... [Keep all existing route handlers] ...

// Update the admin chat route handler
if (pn === '/admin/chat' && m === 'GET') {
    const s = getSession(ck.sessionId);
    if (!s) { res.writeHead(302, { 'Location': '/admin' }); res.end(); return; }
    adminPresence.isOnline = true; adminPresence.lastSeen = new Date();
    const cid = pu.query.chatId, cl = getAdminChatList();
    let ms = [];
    if (cid) { ms = getChatMessages(cid); markMessagesRead(cid); }
    
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(await getAdminChatHTML(cid, cl, ms));
    return;
}

// ... [Keep rest of the server code] ...

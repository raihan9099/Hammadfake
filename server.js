const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR);
}

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/1785275069221.png",
    danger: "/assets/1785274960485.png"
};

// 2 voice files
const VOICE_FILES = {
    warning1: "/assets/10ff7135b502e2f5660074fdb0969109.mp3",
    warning2: "/assets/077f07c5d2a052c7081e448e6dfdaff6_1.mp3"
};

console.log('\n📁 Checking assets...');
for (const [key, imagePath] of Object.entries(IMAGES)) {
    const fullPath = path.join(__dirname, imagePath);
    if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        console.log(`✅ ${key}: ${imagePath} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
        console.log(`❌ ${key}: ${imagePath} - FILE NOT FOUND!`);
    }
}

console.log('\n🎵 Checking voice files...');
for (const [key, voicePath] of Object.entries(VOICE_FILES)) {
    const fullPath = path.join(__dirname, voicePath);
    if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        console.log(`✅ ${key}: ${voicePath} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
        console.log(`❌ ${key}: ${voicePath} - FILE NOT FOUND!`);
    }
}
console.log('');

const DATA = {
    celebrity: {
        name: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Entertainment purposes only. Stay aware of impersonators."
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            screenshot: IMAGES.official,
            description: "The only official account"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            dangerLevel: "high",
            reason: "This account is fake. It copies our logo and posts to deceive followers.",
            voiceFile: VOICE_FILES.warning1
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            dangerLevel: "medium",
            reason: "This account is fake. It uses our name and photo to mislead followers.",
            voiceFile: VOICE_FILES.warning2
        }
    ]
};

function getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DATA.celebrity.name} | Official Verification</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Inter','SF Pro Display','Segoe UI',system-ui,sans-serif;background:#0a0b0f;color:#e4e4e7;min-height:100vh;line-height:1.6}

/* Voice notification banner */
.voice-notification {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 20, 30, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 45, 85, 0.3);
    border-radius: 16px;
    padding: 14px 24px;
    z-index: 9999;
    display: none;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(255, 45, 85, 0.2), 0 2px 8px rgba(0,0,0,0.5);
    max-width: 90%;
}
.voice-notification.show {
    display: flex;
    animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideDown {
    from { transform: translateX(-50%) translateY(-120px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
}
.voice-text {
    color: #fff;
    font-weight: 600;
    font-size: 0.9em;
    letter-spacing: -0.2px;
}
.voice-close {
    background: rgba(255,255,255,0.1);
    border: none;
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.85em;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-weight: 500;
}
.voice-close:hover {
    background: #ff2d55;
    transform: scale(1.1);
}

/* Mute button */
.mute-toggle {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 9998;
    background: rgba(30, 30, 40, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.3em;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.mute-toggle:hover {
    border-color: rgba(255,45,85,0.5);
    transform: scale(1.05);
    box-shadow: 0 6px 25px rgba(255,45,85,0.3);
}
.mute-toggle.muted {
    background: #ff2d55;
    border-color: #ff2d55;
}

/* PREMIUM WARNING - No emoji bounce, just text */
.premium-warning {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 8;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.warning-main {
    font-family: -apple-system, 'SF Pro Display', 'Inter', sans-serif;
    font-size: 0.8em;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #ff2d55;
    text-shadow: 0 0 20px rgba(255,45,85,0.8), 0 0 40px rgba(255,0,0,0.5);
    animation: bounceText 1.5s ease-in-out infinite;
    background: rgba(0,0,0,0.75);
    padding: 6px 16px;
    border-radius: 20px;
    border: 1.5px solid rgba(255,45,85,0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.warning-sub {
    font-family: -apple-system, 'SF Pro Display', 'Inter', sans-serif;
    font-size: 0.9em;
    font-weight: 900;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #ff0000;
    text-shadow: 0 0 25px rgba(255,0,0,0.9), 0 0 50px rgba(255,0,0,0.6);
    animation: bounceText 1.5s ease-in-out infinite 0.3s;
    background: rgba(0,0,0,0.8);
    padding: 6px 20px;
    border-radius: 20px;
    border: 2px solid rgba(255,0,0,0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

@keyframes bounceText {
    0%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
    50% { transform: translateY(-10px); }
    70% { transform: translateY(-4px); }
    85% { transform: translateY(-1px); }
}

.header{text-align:center;padding:45px 20px 40px;background:linear-gradient(180deg,#0f0f1a 0%,#0a0b0f 100%);position:relative;overflow:hidden;border-bottom:1px solid rgba(255,45,85,0.15)}
.header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at center,rgba(255,45,85,0.06) 0%,transparent 70%);pointer-events:none}
.photo{width:130px;height:130px;border-radius:50%;border:4px solid #ff2d55;object-fit:cover;margin-bottom:18px;box-shadow:0 0 45px rgba(255,45,85,0.3);transition:transform 0.3s ease;background:#1a1a2e}
.photo:hover{transform:scale(1.04)}
.name{font-size:2.2em;font-weight:700;color:#fff;letter-spacing:-0.3px}
.bio{color:#a1a1aa;margin-top:6px;font-size:1.05em;font-weight:400}
.badge-row{margin-top:15px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.badge-official{background:#ff2d55;color:#fff;padding:8px 22px;border-radius:30px;font-size:0.9em;font-weight:600;letter-spacing:0.3px;animation:softPulse 2.8s infinite}
.badge-fun{background:#ff6b00;color:#fff;padding:8px 22px;border-radius:30px;font-size:0.9em;font-weight:600}
@keyframes softPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,45,85,0.4)}50%{box-shadow:0 0 0 16px rgba(255,45,85,0)}}

.container{max-width:960px;margin:0 auto;padding:20px 20px}

.warning-hero{background:rgba(255,0,0,0.06);border:1.5px solid rgba(255,68,68,0.5);border-radius:20px;padding:28px 22px;margin:30px 0;text-align:center;backdrop-filter:blur(4px)}
.warning-hero .big-icon{font-size:3.2em;display:block;margin-bottom:10px;animation:gentleShake 0.6s infinite}
@keyframes gentleShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.warning-hero h2{color:#ff4d4d;font-size:1.4em;margin-bottom:8px;font-weight:700}
.warning-hero p{color:#ffb3b3;font-size:0.95em}

.section{margin:35px 0}
.section-title{font-size:1.35em;font-weight:700;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #22c55e;display:flex;align-items:center;gap:8px;letter-spacing:-0.2px}
.section-title.fake-title{border-bottom-color:#ff4444}

.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:20px 0}

.comparison-card{border-radius:16px;padding:16px;transition:transform 0.2s ease, box-shadow 0.3s ease;position:relative;overflow:hidden}
.comparison-card:hover{transform:translateY(-3px)}
.comparison-card.real{background:rgba(34,197,94,0.06);border:1.5px solid rgba(34,197,94,0.45);box-shadow:0 0 25px rgba(34,197,94,0.15)}
.comparison-card.fake{background:rgba(255,68,68,0.06);border:1.5px solid rgba(255,68,68,0.5);box-shadow:0 0 25px rgba(255,68,68,0.15)}

/* Glow effect when voice is playing */
.comparison-card.fake.voice-active {
    box-shadow: 0 0 40px rgba(255, 45, 85, 0.6), 0 0 80px rgba(255, 0, 0, 0.3);
    border-color: #ff2d55;
    animation: cardGlow 1s ease-in-out infinite;
}
@keyframes cardGlow {
    0%, 100% { box-shadow: 0 0 30px rgba(255, 45, 85, 0.4); }
    50% { box-shadow: 0 0 60px rgba(255, 45, 85, 0.8), 0 0 100px rgba(255, 0, 0, 0.4); }
}

/* Compact header */
.comparison-header{text-align:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08)}
.comparison-header .icon{font-size:1.5em;display:block;margin-bottom:2px}
.comparison-header h3{font-size:0.95em;margin:2px 0;font-weight:600}
.comparison-card.real .comparison-header h3{color:#22c55e}
.comparison-card.fake .comparison-header h3{color:#ff4d4d}

/* Smaller platform badge */
.platform-badge{display:inline-block;font-weight:600;font-size:0.7em;padding:3px 10px;border-radius:12px;margin-bottom:4px;letter-spacing:0.3px;text-transform:uppercase}
.real .platform-badge{background:#22c55e;color:#000}
.fake .platform-badge{background:#ff4444;color:#fff}

/* Compact username */
.username-display{
    font-size:0.8em;
    font-weight:600;
    letter-spacing:0.3px;
    padding:5px 10px;
    border-radius:6px;
    display:inline-block;
    margin:4px 0;
}
.real .username-display{background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3)}
.fake .username-display{background:rgba(255,68,68,0.2);color:#ff6666;border:1px solid rgba(255,68,68,0.3)}

/* STRONG SCREENSHOT BOX - Like TikTok full picture view */
.screenshot-wrapper{position:relative;margin:8px 0;border-radius:12px;overflow:hidden}

/* Strong box like TikTok profile picture click */
.screenshot-box{
    text-align:center;
    background:#000;
    border-radius:12px;
    padding:2px;
    border:3px solid rgba(255,255,255,0.2);
    position:relative;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.15);
    transition: all 0.3s ease;
}
.screenshot-box:hover {
    border-color: rgba(255,255,255,0.4);
    box-shadow: 0 12px 40px rgba(0,0,0,0.9), 0 0 0 2px rgba(255,255,255,0.25);
}

/* Red overlay for fake images */
.screenshot-wrapper.fake-image::before{
    content:'';
    position:absolute;
    top:0;left:0;right:0;bottom:0;
    background:rgba(255,0,0,0.06);
    z-index:2;
    pointer-events:none;
    border-radius:12px;
}

/* Danger badge - smaller */
.danger-badge{
    position:absolute;
    top:6px;
    right:6px;
    z-index:6;
    background:linear-gradient(135deg,#ff0000,#b30000);
    color:#fff;
    padding:4px 8px;
    border-radius:12px;
    font-weight:700;
    font-size:0.6em;
    letter-spacing:1px;
    box-shadow:0 0 15px rgba(255,0,0,0.7);
    display:flex;
    align-items:center;
    gap:3px;
    text-transform:uppercase;
}

/* Profile image - Full width like TikTok */
.proof-img{
    width:100%;
    max-width:100%;
    height:auto;
    max-height:450px;
    object-fit:cover;
    object-position:center;
    border-radius:10px;
    cursor:pointer;
    transition:transform 0.3s ease;
    background:#0a0a12;
    position:relative;
    z-index:0;
    display:block;
}
.proof-img:hover{transform:scale(1.01)}
.proof-img.zoomed{
    transform:scale(1.7);
    z-index:1000;
    position:relative;
    box-shadow:0 25px 70px rgba(0,0,0,0.95);
    border-radius:14px;
    cursor:zoom-out;
}

.click-hint{display:block;color:#71717a;font-size:0.6em;margin-top:3px;text-align:center;position:relative;z-index:5}

.reason-box{color:#ffb3b3;font-size:0.75em;margin-top:8px;padding:8px;background:rgba(255,0,0,0.08);border-radius:8px;border-left:3px solid #ff4444;text-align:center;line-height:1.5;font-weight:500}

/* Compact buttons */
.btn{padding:8px 14px;border-radius:22px;text-decoration:none;font-weight:600;font-size:0.8em;transition:all 0.2s ease;cursor:pointer;border:none;font-family:inherit;display:inline-flex;align-items:center;gap:5px;justify-content:center;width:100%;margin-top:6px;letter-spacing:0.2px}
.btn-follow{background:#22c55e;color:#000;font-size:0.85em}
.btn-follow:hover{background:#1ea84e;transform:scale(1.03);box-shadow:0 6px 18px rgba(34,197,94,0.45)}
.btn-report{background:#ff2d55;color:#fff;font-size:0.85em}
.btn-report:hover{background:#e60040;transform:scale(1.03);box-shadow:0 6px 18px rgba(255,45,85,0.5)}
.btn-copy{background:#27272a;color:#fff;margin-top:5px;font-size:0.75em}
.btn-copy:hover{background:#3f3f46}
.btn-copy.copied{background:#22c55e!important;color:#000!important}

.action-steps{background:rgba(255,204,0,0.05);border:1.5px solid rgba(255,204,0,0.5);border-radius:18px;padding:28px;margin:35px 0}
.action-steps h3{color:#ffcc00;font-size:1.25em;margin-bottom:18px;text-align:center;font-weight:700}
.action-steps ol{list-style:none;counter-reset:step;padding-left:0}
.action-steps ol li{counter-increment:step;padding:12px 12px 12px 42px;position:relative;color:#d4d4d8;font-size:0.9em;line-height:1.7;margin:8px 0}
.action-steps ol li::before{content:counter(step);position:absolute;left:0;top:10px;width:28px;height:28px;background:#ffcc00;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85em}
.tip-box{background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.4);border-radius:12px;padding:16px;margin-top:20px;text-align:center}
.tip-box strong{color:#ffcc00}

.footer{text-align:center;padding:45px 20px 25px;color:#52525b;font-size:0.85em;line-height:1.8;border-top:1px solid rgba(255,255,255,0.05);margin-top:15px}

/* Real image */
.real-checkmark{
    position:absolute;
    top:6px;
    right:6px;
    z-index:5;
    background:#22c55e;
    color:#000;
    width:28px;
    height:28px;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:1em;
    font-weight:700;
    box-shadow:0 0 18px rgba(34,197,94,0.7);
}

@media(max-width:768px){
    .comparison-grid{grid-template-columns:1fr}
    .proof-img{max-width:100%;max-height:400px}
    .proof-img.zoomed{transform:scale(1.2)}
    .warning-main{font-size:0.7em;padding:5px 12px}
    .warning-sub{font-size:0.8em;padding:5px 16px}
    .voice-notification{font-size:0.8em;padding:10px 16px}
    .mute-toggle{width:45px;height:45px;bottom:20px;right:20px}
}
@media(max-width:400px){
    .proof-img.zoomed{transform:scale(1.1)}
}
</style>
</head>
<body>

<!-- Voice notification banner -->
<div class="voice-notification" id="voiceNotification">
    <span class="voice-text" id="voiceText">⚠️ Warning: Fake account detected!</span>
    <button class="voice-close" onclick="closeNotification()">✕</button>
</div>

<!-- Mute/Unmute toggle -->
<button class="mute-toggle" id="muteToggle" onclick="toggleMute()" title="Toggle Sound">
    🔊
</button>

<div class="header">
<img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="photo" onerror="this.style.display='none'">
<h1 class="name">${DATA.celebrity.name}</h1>
<p class="bio">${DATA.celebrity.bio}</p>
<div class="badge-row">
<span class="badge-official">✓ OFFICIAL PAGE</span>
<span class="badge-fun">✦ ENTERTAINMENT</span>
</div>
</div>

<div class="container">

<div class="warning-hero">
<span class="big-icon">⚠️</span>
<h2>Beware of fake accounts</h2>
<p>Multiple impersonator accounts are using ${DATA.celebrity.name.split(' ')[0]}'s identity.<br>Compare the real and fake profiles below to stay safe.</p>
</div>

<div class="section">
<h2 class="section-title">🔒 How to identify the real account</h2>
<div style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.45);border-radius:16px;padding:28px;text-align:center;margin-bottom:25px">
<div style="font-size:3em;margin-bottom:12px">✓</div>
<h3 style="color:#22c55e;font-size:1.4em;margin-bottom:12px">Only this account is authentic</h3>
<p style="color:#e4e4e7;font-size:1.05em;margin-bottom:10px"><strong style="color:#22c55e;font-size:1.3em">@baiillamaach_official</strong></p>
<p style="color:#a1a1aa;font-size:0.9em;margin-bottom:25px">This is our one and only official profile.<br>No backup or secondary accounts exist.</p>
<a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#22c55e;color:#000;padding:14px 42px;border-radius:35px;text-decoration:none;font-weight:700;font-size:1.1em;transition:all 0.25s;box-shadow:0 0 25px rgba(34,197,94,0.45)" onmouseover="this.style.transform='scale(1.04)';this.style.boxShadow='0 0 45px rgba(34,197,94,0.75)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 0 25px rgba(34,197,94,0.45)'">→ Follow Now</a>
</div>
</div>

<div class="section">
<h2 class="section-title">⚡ Real Account</h2>
<div class="comparison-grid">
${DATA.realAccounts.map(a => `
<div class="comparison-card real">
<div class="comparison-header">
<span class="icon">✓</span>
<h3>Real Account</h3>
</div>
<span class="platform-badge">${a.platform}</span>
<div class="username-display">${a.username}</div>
${a.screenshot ? `
<div class="screenshot-wrapper real-image">
<div class="real-checkmark">✓</div>
<div class="screenshot-box">
<img src="${a.screenshot}" alt="Real Account Screenshot" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy">
</div>
</div>
<span class="click-hint">🖱️ Click to zoom</span>` : ''}
<a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn btn-follow">→ Follow Now</a>
</div>
`).join('')}
</div>
</div>

<div class="section" id="fakeAccountsSection">
<h2 class="section-title fake-title">🚨 Fake Accounts — Stay Alert</h2>
<div class="comparison-grid" id="fakeAccountsGrid">
${DATA.fakeAccounts.map((a, index) => `
<div class="comparison-card fake" id="fakeCard${index}" data-voice="${a.voiceFile || ''}" data-index="${index}">
<div class="comparison-header">
<span class="icon">⚠️</span>
<h3>Fake Account</h3>
</div>
<span class="platform-badge">${a.platform}</span>
<div class="username-display">${a.username}</div>
${a.screenshot ? `
<div class="screenshot-wrapper fake-image">
<!-- PREMIUM WARNING - Text only, no emoji icons -->
<div class="premium-warning">
    <div class="warning-main">⚠️ Fake Account Alert</div>
    <div class="warning-sub">FRAUD</div>
</div>
<div class="danger-badge">⚠️ FAKE</div>
<div class="screenshot-box">
<img src="${a.screenshot}" alt="Fake Account Screenshot" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy">
</div>
</div>
<span class="click-hint">🖱️ Click to zoom</span>` : ''}
${a.reason ? `<div class="reason-box"><strong>⚠️</strong> ${a.reason}</div>` : ''}
<a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-report">🚨 Report Account</a>
<button class="btn btn-copy" data-username="${a.username}">📋 Copy Username</button>
</div>
`).join('')}
</div>
</div>

<div class="action-steps">
<h3>🛡️ What you should do</h3>
<ol>
<li>Visit the fake accounts listed above and <strong>"Report"</strong> them immediately</li>
<li>Never share personal information outside the official account</li>
<li>If you're unsure, use only the official link provided here</li>
</ol>
<div class="tip-box">
<strong>💡 Remember:</strong> We will never ask for money or passwords in DMs. Always verify through the <strong>Follow Now</strong> button above.
</div>
</div>

</div>

<div class="footer">
<p>© ${DATA.celebrity.name} • Official Verification Hub</p>
</div>

<!-- Hidden audio elements -->
${DATA.fakeAccounts.map((a, index) => a.voiceFile ? `<audio id="voiceAudio${index}" preload="auto" src="${a.voiceFile}"></audio>` : '').join('')}

<script>
// Global state
let isMuted = false;
let currentlyPlaying = null;

// Voice notification elements
const voiceNotification = document.getElementById('voiceNotification');
const voiceText = document.getElementById('voiceText');
const muteToggle = document.getElementById('muteToggle');

// Close notification
function closeNotification() {
    voiceNotification.classList.remove('show');
    if (currentlyPlaying) {
        currentlyPlaying.pause();
        currentlyPlaying.currentTime = 0;
        document.querySelectorAll('.comparison-card.fake.voice-active').forEach(card => {
            card.classList.remove('voice-active');
        });
        currentlyPlaying = null;
    }
}

// Toggle mute
function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
        muteToggle.classList.add('muted');
        muteToggle.innerHTML = '🔇';
        if (currentlyPlaying) {
            currentlyPlaying.pause();
            currentlyPlaying.currentTime = 0;
            document.querySelectorAll('.comparison-card.fake.voice-active').forEach(card => {
                card.classList.remove('voice-active');
            });
            currentlyPlaying = null;
        }
        voiceNotification.classList.remove('show');
    } else {
        muteToggle.classList.remove('muted');
        muteToggle.innerHTML = '🔊';
    }
}

// Play voice for specific fake account
function playVoiceForCard(cardElement) {
    if (isMuted) return;
    
    const voiceFile = cardElement.dataset.voice;
    const index = cardElement.dataset.index;
    
    if (!voiceFile) return;
    
    // Stop current audio if playing
    if (currentlyPlaying) {
        currentlyPlaying.pause();
        currentlyPlaying.currentTime = 0;
        document.querySelectorAll('.comparison-card.fake.voice-active').forEach(c => {
            c.classList.remove('voice-active');
        });
    }
    
    const audioElement = document.getElementById('voiceAudio' + index);
    if (!audioElement) return;
    
    // Add glow effect to card
    cardElement.classList.add('voice-active');
    
    // Play audio
    audioElement.currentTime = 0;
    audioElement.play().then(() => {
        currentlyPlaying = audioElement;
        
        // Show notification
        voiceText.textContent = '⚠️ Warning: Fake account detected! Listen carefully...';
        voiceNotification.classList.add('show');
        
        // Auto-hide notification after 4 seconds
        setTimeout(() => {
            if (voiceNotification.classList.contains('show')) {
                voiceNotification.classList.remove('show');
            }
        }, 4000);
        
    }).catch(err => {
        console.log('Audio play failed:', err);
        cardElement.classList.remove('voice-active');
    });
    
    // When audio ends
    audioElement.onended = () => {
        cardElement.classList.remove('voice-active');
        voiceNotification.classList.remove('show');
        currentlyPlaying = null;
    };
}

// Intersection Observer for fake account cards
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.6
};

const observerCallback = (entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !isMuted) {
            const card = entry.target;
            if (!currentlyPlaying || currentlyPlaying.ended) {
                playVoiceForCard(card);
            }
        } else if (!entry.isIntersecting) {
            const card = entry.target;
            if (card.classList.contains('voice-active') && currentlyPlaying) {
                currentlyPlaying.pause();
                currentlyPlaying.currentTime = 0;
                card.classList.remove('voice-active');
                voiceNotification.classList.remove('show');
                currentlyPlaying = null;
            }
        }
    });
};

const observer = new IntersectionObserver(observerCallback, observerOptions);

// Observe all fake account cards
document.querySelectorAll('.comparison-card.fake').forEach(card => {
    observer.observe(card);
});

// Copy username functionality
document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', function() {
        const username = this.dataset.username;
        navigator.clipboard.writeText(username).then(() => {
            this.innerHTML = '✓ Copied';
            this.classList.add('copied');
            setTimeout(() => {
                this.innerHTML = '📋 Copy Username';
                this.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            alert('Username: ' + username);
        });
    });
});

// Image zoom functionality
document.querySelectorAll('.proof-img').forEach(img => {
    img.addEventListener('click', function(e) {
        e.stopPropagation();
        const wasZoomed = this.classList.contains('zoomed');
        document.querySelectorAll('.proof-img.zoomed').forEach(zoomImg => {
            zoomImg.classList.remove('zoomed');
        });
        if (!wasZoomed) {
            this.classList.add('zoomed');
        }
    });
});

// Keyboard escape to unzoom
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.proof-img.zoomed').forEach(img => {
            img.classList.remove('zoomed');
        });
    }
});

// Click outside to unzoom
document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('proof-img')) {
        document.querySelectorAll('.proof-img.zoomed').forEach(img => {
            img.classList.remove('zoomed');
        });
    }
});

console.log('✓ Voice alert system initialized');
console.log('📢 Scroll to fake accounts to trigger voice warnings');
console.log('🔊 Click the speaker icon to mute/unmute');
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve assets (images and audio)
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dirname, pathname);
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
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
                '.ico': 'image/x-icon',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            
            // Support range requests for audio
            const range = req.headers.range;
            if (range && (ext === '.mp3' || ext === '.wav' || ext === '.ogg')) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunksize = (end - start) + 1;
                
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*'
                });
                
                const stream = fs.createReadStream(assetPath, { start, end });
                stream.pipe(res);
                stream.on('error', (err) => {
                    console.error('Error streaming audio:', err);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end('Error loading audio');
                    }
                });
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stat.size,
                    'Cache-Control': 'public, max-age=86400, immutable',
                    'Access-Control-Allow-Origin': '*',
                    'X-Content-Type-Options': 'nosniff',
                    'Accept-Ranges': 'bytes'
                });
                const readStream = fs.createReadStream(assetPath);
                readStream.pipe(res);
                readStream.on('error', (err) => {
                    console.error('Error reading asset:', err);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end('Error loading asset');
                    }
                });
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Asset not found');
        }
        return;
    }

    // Main page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getHTML());
        return;
    }

    // JSON data endpoint
    if (pathname === '/data.json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(DATA, null, 2));
        return;
    }

    // Health check
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404 • Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0b0f;color:#e4e4e7;font-family:-apple-system,'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}.error-code{font-size:130px;font-weight:800;background:linear-gradient(135deg,#ff2d55,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.message{font-size:1.5em;margin:20px 0;color:#a1a1aa}.btn{display:inline-block;padding:12px 32px;background:#ff2d55;color:#fff;text-decoration:none;border-radius:30px;font-weight:600}.btn:hover{transform:scale(1.04)}</style></head><body><div><div class="error-code">404</div><p class="message">Page not found</p><a href="/" class="btn">← Back to safety</a></div></body></html>`);
});

server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('✅ SERVER STARTED — PREMIUM VERIFICATION HUB');
    console.log('='.repeat(60));
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`📁 Assets directory: ${ASSETS_DIR}`);
    console.log('='.repeat(60));
    console.log('📸 Images:');
    for (const [key, imagePath] of Object.entries(IMAGES)) {
        const fullPath = path.join(__dirname, imagePath);
        const exists = fs.existsSync(fullPath);
        console.log(`   ${exists ? '✅' : '❌'} ${key}: ${imagePath}`);
    }
    console.log('🎵 Voice files:');
    for (const [key, voicePath] of Object.entries(VOICE_FILES)) {
        const fullPath = path.join(__dirname, voicePath);
        const exists = fs.existsSync(fullPath);
        console.log(`   ${exists ? '✅' : '❌'} ${key}: ${voicePath}`);
    }
    console.log('');
    console.log('🎯 Changes Made:');
    console.log('   ❌ Removed emoji up-down animation from warning');
    console.log('   📦 Stronger screenshot box (TikTok style)');
    console.log('   📏 Compact username & header sections');
    console.log('   🔊 Voice auto-play on scroll');
    console.log('='.repeat(60));
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') process.exit(1);
});

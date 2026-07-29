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
console.log('');

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        tagline: "Official Entertainment Profile",
        photo: IMAGES.profile,
        bio: "Entertainment purposes only."
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            screenshot: IMAGES.official
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: IMAGES.danger,
            dangerLevel: "critical",
            reason: "Copies exact logo, content and branding. Spelling difference: missing letters."
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            dangerLevel: "high",
            reason: "Uses our name and profile picture to mislead followers."
        }
    ]
};

function getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DATA.celebrity.name} — Official</title>
<style>
:root {
    --bg: #050505;
    --surface: #0a0a0a;
    --surface2: #111111;
    --border: #1a1a1a;
    --text: #f5f5f5;
    --text2: #a0a0a0;
    --green: #00e676;
    --red: #ff1744;
    --red2: #ff5252;
    --amber: #ffd740;
    --accent: #ff2d55;
    --radius: 16px;
    --radius-sm: 10px;
    --font: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6;-webkit-font-smoothing:antialiased}

/* ============ NAVBAR ============ */
.navbar{
    position:fixed;top:0;left:0;right:0;z-index:100;
    background:rgba(5,5,5,0.85);backdrop-filter:blur(20px) saturate(180%);
    border-bottom:1px solid rgba(255,255,255,0.06);
    padding:0 24px;height:64px;
    display:flex;align-items:center;justify-content:space-between;
}
.nav-logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.1em;color:var(--text);letter-spacing:-0.3px}
.nav-logo img{width:36px;height:36px;border-radius:50%;border:2px solid var(--accent)}
.nav-actions{display:flex;align-items:center;gap:12px}
.nav-btn{
    padding:8px 18px;border-radius:20px;font-weight:600;font-size:0.85em;
    text-decoration:none;transition:var(--transition);border:none;cursor:pointer;
    font-family:var(--font);letter-spacing:-0.2px;
}
.nav-btn-primary{background:var(--green);color:#000}
.nav-btn-primary:hover{box-shadow:0 0 25px rgba(0,230,118,0.4);transform:translateY(-1px)}
.nav-btn-outline{background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.2)}
.nav-btn-outline:hover{border-color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.05)}

/* ============ HERO ============ */
.hero{
    padding:120px 24px 60px;text-align:center;
    background:radial-gradient(ellipse at 50% 0%, rgba(255,45,85,0.08) 0%, transparent 60%),
               radial-gradient(ellipse at 80% 100%, rgba(0,230,118,0.04) 0%, transparent 50%);
    position:relative;overflow:hidden;
}
.hero::after{
    content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
}
.hero-content{position:relative;z-index:1;max-width:600px;margin:0 auto}
.hero-avatar{
    width:110px;height:110px;border-radius:50%;object-fit:cover;
    border:4px solid var(--accent);margin-bottom:20px;
    box-shadow:0 0 50px rgba(255,45,85,0.25);
}
.verified-pill{
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(0,230,118,0.15);color:var(--green);
    padding:6px 14px;border-radius:20px;font-size:0.8em;font-weight:600;
    margin-bottom:12px;letter-spacing:0.3px;
    border:1px solid rgba(0,230,118,0.2);
}
.hero h1{font-size:2.6em;font-weight:800;letter-spacing:-1px;line-height:1.1;margin-bottom:6px}
.hero .tagline{color:var(--text2);font-size:1.05em;font-weight:400}
.hero .bio{color:var(--text2);font-size:0.95em;margin-top:10px}

/* ============ LAYOUT ============ */
.container{max-width:960px;margin:0 auto;padding:0 24px}

/* ============ ALERT BANNER ============ */
.alert-banner{
    background:linear-gradient(135deg, rgba(255,23,68,0.1), rgba(255,23,68,0.05));
    border:1px solid rgba(255,23,68,0.25);border-radius:var(--radius);
    padding:24px 28px;margin:30px 0;display:flex;align-items:flex-start;gap:16px;
}
.alert-banner .alert-icon{font-size:2em;flex-shrink:0}
.alert-banner h3{color:var(--red2);font-size:1.1em;margin-bottom:4px}
.alert-banner p{color:var(--text2);font-size:0.9em;line-height:1.6}

/* ============ SECTION ============ */
.section{margin:50px 0}
.section-header{display:flex;align-items:center;gap:10px;margin-bottom:20px}
.section-header h2{font-size:1.3em;font-weight:700;letter-spacing:-0.4px}
.section-line{flex:1;height:1px;background:var(--border)}

/* ============ COMPARISON ============ */
.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}

.card{
    background:var(--surface);border:1px solid var(--border);
    border-radius:var(--radius);padding:24px;
    transition:var(--transition);position:relative;overflow:hidden;
}
.card:hover{transform:translateY(-2px)}
.card.real{border-color:rgba(0,230,118,0.3);background:rgba(0,230,118,0.03)}
.card.fake{border-color:rgba(255,23,68,0.3);background:rgba(255,23,68,0.03)}

.card-badge{
    display:inline-flex;align-items:center;gap:5px;
    padding:5px 12px;border-radius:15px;font-size:0.75em;font-weight:700;
    letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px;
}
.card.real .card-badge{background:rgba(0,230,118,0.2);color:var(--green)}
.card.fake .card-badge{background:rgba(255,23,68,0.2);color:var(--red)}

.card-username{
    font-size:1.2em;font-weight:700;letter-spacing:-0.3px;
    padding:8px 14px;border-radius:8px;display:inline-block;margin-bottom:14px;
    font-family:'SF Mono','Fira Code','JetBrains Mono',monospace;
}
.card.real .card-username{background:rgba(0,230,118,0.08);color:var(--green)}
.card.fake .card-username{background:rgba(255,23,68,0.08);color:var(--red2)}

/* ============ IMAGE WRAPPER ============ */
.img-wrapper{position:relative;border-radius:var(--radius-sm);overflow:hidden;margin-bottom:12px}

/* Real image glow */
.img-wrapper.real-img::after{
    content:'';position:absolute;inset:0;
    background:rgba(0,230,118,0.04);pointer-events:none;z-index:2;
}

/* Fake image red overlay */
.img-wrapper.fake-img::before{
    content:'';position:absolute;inset:0;
    background:rgba(255,0,0,0.08);z-index:2;pointer-events:none;
    animation:redPulse 2s ease-in-out infinite;
}
@keyframes redPulse{
    0%,100%{background:rgba(255,0,0,0.06)}
    50%{background:rgba(255,0,0,0.15)}
}

/* Fake image border alert */
.img-wrapper.fake-img::after{
    content:'';position:absolute;inset:0;
    border:2px solid transparent;border-radius:var(--radius-sm);
    z-index:3;pointer-events:none;
    animation:borderAlert 2.5s ease-in-out infinite;
}
@keyframes borderAlert{
    0%,100%{border-color:rgba(255,0,0,0);box-shadow:inset 0 0 0 rgba(255,0,0,0)}
    50%{border-color:rgba(255,0,0,0.6);box-shadow:inset 0 0 30px rgba(255,0,0,0.2)}
}

/* Cross mark on fake */
.cross-mark{
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:5;pointer-events:none;
    width:70px;height:70px;
}
.cross-mark::before,
.cross-mark::after{
    content:'';position:absolute;background:var(--red);
    border-radius:3px;box-shadow:0 0 20px rgba(255,0,0,0.7);
    animation:crossPulse 1.2s ease-in-out infinite;
}
.cross-mark::before{width:3px;height:100%;left:50%;transform:translateX(-50%)}
.cross-mark::after{width:100%;height:3px;top:50%;transform:translateY(-50%)}
@keyframes crossPulse{
    0%,100%{opacity:0.5;box-shadow:0 0 15px rgba(255,0,0,0.4)}
    50%{opacity:0.9;box-shadow:0 0 30px rgba(255,0,0,0.9)}
}

/* Danger label */
.danger-label{
    position:absolute;top:10px;right:10px;z-index:6;
    background:linear-gradient(135deg,#ff0000,#d50000);
    color:#fff;padding:6px 12px;border-radius:15px;
    font-size:0.7em;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;
    animation:dangerGlow 1.5s ease-in-out infinite;
    display:flex;align-items:center;gap:4px;
}
@keyframes dangerGlow{
    0%,100%{box-shadow:0 0 10px rgba(255,0,0,0.5)}
    50%{box-shadow:0 0 25px rgba(255,0,0,0.9),0 0 50px rgba(255,0,0,0.4)}
}

/* Warning icon corner */
.warning-corner{
    position:absolute;top:10px;left:10px;z-index:6;
    font-size:1.3em;animation:warningBounce 0.7s ease-in-out infinite;
}
@keyframes warningBounce{
    0%,100%{transform:translateY(0)}
    50%{transform:translateY(-4px)}
}

/* Scan lines */
.scan-effect{
    position:absolute;inset:0;z-index:1;pointer-events:none;
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,0,0,0.03) 2px,rgba(255,0,0,0.03) 4px);
    animation:scanDown 3s linear infinite;
}
@keyframes scanDown{
    0%{background-position:0 0}
    100%{background-position:0 20px}
}

/* Verified checkmark for real */
.verified-mark{
    position:absolute;top:10px;right:10px;z-index:6;
    background:var(--green);color:#000;width:30px;height:30px;
    border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-weight:700;font-size:0.9em;
    box-shadow:0 0 20px rgba(0,230,118,0.5);
}

.img-display{
    width:100%;max-width:340px;aspect-ratio:9/19.5;
    object-fit:contain;display:block;margin:0 auto;
    border-radius:6px;background:#000;
}
.img-hint{display:block;text-align:center;color:var(--text2);font-size:0.7em;margin-top:6px}

/* ============ REASON ============ */
.reason-block{
    background:rgba(255,23,68,0.06);border-left:3px solid var(--red);
    padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:12px;
    font-size:0.82em;color:var(--red2);line-height:1.5;
}

/* ============ BUTTONS ============ */
.btn{
    display:inline-flex;align-items:center;justify-content:center;gap:6px;
    width:100%;padding:12px 20px;border-radius:25px;
    font-weight:600;font-size:0.9em;text-decoration:none;
    transition:var(--transition);cursor:pointer;border:none;
    font-family:var(--font);letter-spacing:-0.2px;
}
.btn-green{background:var(--green);color:#000;margin-top:10px}
.btn-green:hover{box-shadow:0 0 30px rgba(0,230,118,0.35);transform:translateY(-1px)}
.btn-red{background:var(--red);color:#fff;margin-top:10px}
.btn-red:hover{box-shadow:0 0 30px rgba(255,23,68,0.4);transform:translateY(-1px)}
.btn-dark{background:var(--surface2);color:var(--text);margin-top:8px}
.btn-dark:hover{background:#1e1e1e}
.btn-dark.copied{background:var(--green)!important;color:#000!important}

/* ============ CTA SECTION ============ */
.cta-card{
    background:rgba(0,230,118,0.04);border:2px solid rgba(0,230,118,0.3);
    border-radius:var(--radius);padding:30px;text-align:center;margin:40px 0;
}
.cta-card .cta-icon{font-size:3em;margin-bottom:10px}
.cta-card h2{color:var(--green);font-size:1.4em;margin-bottom:6px}
.cta-card p{color:var(--text2);font-size:0.9em;margin-bottom:20px}
.cta-card .btn{width:auto;display:inline-flex;padding:14px 36px;font-size:1em}

/* ============ STEPS ============ */
.steps-card{
    background:var(--surface);border:1px solid rgba(255,215,64,0.3);
    border-radius:var(--radius);padding:28px;margin:40px 0;
}
.steps-card h3{color:var(--amber);text-align:center;font-size:1.1em;margin-bottom:20px}
.step-list{list-style:none;counter-reset:step}
.step-list li{
    counter-increment:step;padding:10px 10px 10px 42px;
    position:relative;color:var(--text2);font-size:0.88em;line-height:1.6;margin:6px 0;
}
.step-list li::before{
    content:counter(step);position:absolute;left:0;top:8px;
    width:26px;height:26px;background:var(--amber);color:#000;
    border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-weight:700;font-size:0.8em;
}
.tip-box{
    background:rgba(255,215,64,0.06);border:1px solid rgba(255,215,64,0.2);
    border-radius:var(--radius-sm);padding:14px;text-align:center;margin-top:16px;
    color:var(--amber);font-size:0.85em;
}

/* ============ FOOTER ============ */
.footer{
    text-align:center;padding:50px 20px;color:var(--text2);
    font-size:0.8em;border-top:1px solid var(--border);margin-top:40px;
}

/* ============ RESPONSIVE ============ */
@media(max-width:768px){
    .comparison-grid{grid-template-columns:1fr}
    .hero h1{font-size:2em}
    .img-display{max-width:280px}
    .cross-mark{width:50px;height:50px}
}
@media(max-width:480px){
    .hero h1{font-size:1.7em}
    .hero-avatar{width:90px;height:90px}
    .img-display{max-width:240px}
    .navbar{padding:0 16px}
    .nav-btn{padding:6px 14px;font-size:0.8em}
}
</style>
</head>
<body>

<!-- ============ NAVBAR ============ -->
<nav class="navbar">
    <div class="nav-logo">
        <img src="${DATA.celebrity.photo}" alt="Logo">
        <span>${DATA.celebrity.name}</span>
    </div>
    <div class="nav-actions">
        <a href="#official" class="nav-btn nav-btn-primary">Follow Official</a>
        <a href="#fake" class="nav-btn nav-btn-outline">View Fakes</a>
    </div>
</nav>

<!-- ============ HERO ============ -->
<section class="hero">
    <div class="hero-content">
        <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-avatar">
        <div class="verified-pill">
            <span>✓</span> VERIFIED OFFICIAL
        </div>
        <h1>${DATA.celebrity.name}</h1>
        <p class="tagline">${DATA.celebrity.tagline}</p>
        <p class="bio">${DATA.celebrity.bio}</p>
    </div>
</section>

<div class="container">

<!-- ============ ALERT ============ -->
<div class="alert-banner">
    <span class="alert-icon">⚠️</span>
    <div>
        <h3>Impersonation Alert</h3>
        <p>Multiple fake accounts are using our name to deceive followers. Please verify before engaging.</p>
    </div>
</div>

<!-- ============ OFFICIAL CTA ============ -->
<div class="cta-card" id="official">
    <div class="cta-icon">✅</div>
    <h2>This Is The Only Official Account</h2>
    <p>All other accounts claiming to be us are fake. Follow only this one.</p>
    <a href="${DATA.realAccounts[0].url}" target="_blank" rel="noopener noreferrer" class="btn btn-green">👉 Follow @baiillamaach_official</a>
</div>

<!-- ============ COMPARISON ============ -->
<div class="section" id="fake">
    <div class="section-header">
        <h2 style="color:var(--green)">✅ Official</h2>
        <div class="section-line"></div>
        <h2 style="color:var(--red)">🚨 Fake</h2>
    </div>
    <div class="comparison-grid">
        ${DATA.realAccounts.map(a => `
        <div class="card real">
            <span class="card-badge">✓ Verified Official</span>
            <div class="card-username">${a.username}</div>
            ${a.screenshot ? `
            <div class="img-wrapper real-img">
                <div class="verified-mark">✓</div>
                <img src="${a.screenshot}" alt="Official Account" class="img-display" loading="lazy">
            </div>
            <span class="img-hint">Click to zoom</span>` : ''}
            <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn btn-green">👉 Follow Official</a>
        </div>
        `).join('')}
        ${DATA.fakeAccounts.map(a => `
        <div class="card fake">
            <span class="card-badge">⚠️ Fake Account</span>
            <div class="card-username">${a.username}</div>
            ${a.screenshot ? `
            <div class="img-wrapper fake-img">
                <div class="scan-effect"></div>
                <div class="warning-corner">⚠️</div>
                <div class="danger-label">⚠ FAKE</div>
                <div class="cross-mark"></div>
                <img src="${a.screenshot}" alt="Fake Account" class="img-display" loading="lazy">
            </div>
            <span class="img-hint">Click to zoom</span>` : ''}
            ${a.reason ? `<div class="reason-block"><strong>⚠</strong> ${a.reason}</div>` : ''}
            <a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-red">🚨 Report This Account</a>
            <button class="btn btn-dark copy-btn" data-username="${a.username}">📋 Copy Username</button>
        </div>
        `).join('')}
    </div>
</div>

<!-- ============ STEPS ============ -->
<div class="steps-card">
    <h3>🛡️ How To Protect Yourself</h3>
    <ol class="step-list">
        <li>Go to the fake accounts above and click <strong>"Report"</strong></li>
        <li>Never share personal information or send money to unverified accounts</li>
        <li>Always use the official follow button on this page to reach us</li>
    </ol>
    <div class="tip-box">
        <strong>💡 Tip:</strong> We will never ask for money in DMs. If someone does, it's a fake account.
    </div>
</div>

</div>

<!-- ============ FOOTER ============ -->
<footer class="footer">
    <p>© ${DATA.celebrity.name} — Official Entertainment Profile</p>
</footer>

<script>
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const username = this.dataset.username;
        navigator.clipboard.writeText(username).then(() => {
            this.innerHTML = '✅ Copied';
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

document.querySelectorAll('.img-display').forEach(img => {
    img.addEventListener('click', function() {
        this.classList.toggle('zoomed');
        if (this.classList.contains('zoomed')) {
            this.style.transform = 'scale(1.5)';
            this.style.zIndex = '999';
            this.style.position = 'relative';
        } else {
            this.style.transform = 'scale(1)';
            this.style.zIndex = '1';
            this.style.position = 'relative';
        }
    });
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.img-display.zoomed').forEach(img => {
            img.classList.remove('zoomed');
            img.style.transform = 'scale(1)';
            img.style.zIndex = '1';
        });
    }
});
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

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
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, {
                'Content-Type': contentType, 'Content-Length': stat.size,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(assetPath).pipe(res);
        } else {
            res.writeHead(404); res.end('Not found');
        }
        return;
    }

    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(getHTML());
        return;
    }

    if (pathname === '/data.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(DATA, null, 2));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center}h1{font-size:80px;color:#ff2d55}p{color:#aaa}a{color:#ff2d55}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>');
});

server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('✅ SERVER RUNNING');
    console.log('='.repeat(50));
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`📁 ${ASSETS_DIR}`);
    console.log('='.repeat(50));
    for (const [key, imagePath] of Object.entries(IMAGES)) {
        const fullPath = path.join(__dirname, imagePath);
        console.log(`   ${fs.existsSync(fullPath) ? '✅' : '❌'} ${key}`);
    }
    console.log('');
});

server.on('error', (err) => {
    console.error('❌ Error:', err.message);
    if (err.code === 'EADDRINUSE') process.exit(1);
});

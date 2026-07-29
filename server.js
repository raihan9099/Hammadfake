const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Check if assets directory exists
const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ Assets folder not found! Creating...');
    fs.mkdirSync(ASSETS_DIR);
}

// Local image mapping - using assets folder
const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/1785275069221.png",
    danger: "/assets/1785274960485.png"
};

// Verify images exist
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

// DATA
const DATA = {
    celebrity: {
        name: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "শুধুমাত্র এন্টারটেইনমেন্টের জন্য। অন্য সব একাউন্ট ভুয়া।"
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
            dangerLevel: "high",
            reason: "বানান কপি করে ভুয়া একাউন্ট। একটি 'l' এবং একটি 'a' কম আছে। হুবহু লোগো ও পোস্ট কপি করে প্রতারণা করছে।"
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.fraud,
            dangerLevel: "medium",
            reason: "নাম ও ছবি ব্যবহার করে ভুয়া একাউন্ট। ফলোয়ারদের বিভ্রান্ত করছে।"
        }
    ]
};

// HTML Page
function getHTML() {
    return `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${DATA.celebrity.name} | অফিসিয়াল</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Hind Siliguri','Noto Sans Bengali',Arial,sans-serif;background:#000;color:#fff;min-height:100vh;line-height:1.7}
        
        .header{text-align:center;padding:50px 20px 40px;background:linear-gradient(180deg,#0d0015 0%,#000 100%);position:relative;overflow:hidden}
        .header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at center,rgba(255,45,85,0.08) 0%,transparent 70%);pointer-events:none}
        .photo{width:140px;height:140px;border-radius:50%;border:5px solid #ff2d55;object-fit:cover;margin-bottom:18px;box-shadow:0 0 40px rgba(255,45,85,0.35);transition:transform 0.3s;background:#1a1a1a}
        .photo:hover{transform:scale(1.05)}
        .name{font-size:2.2em;font-weight:800;color:#fff;text-shadow:0 0 30px rgba(255,45,85,0.5)}
        .bio{color:#ddd;margin-top:8px;font-size:1.1em;max-width:500px;margin-left:auto;margin-right:auto}
        .badge-row{margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .badge-official{background:#ff2d55;color:#fff;padding:8px 22px;border-radius:25px;font-size:0.9em;font-weight:700;animation:pulse 2.5s infinite}
        .badge-fun{background:#ff6b00;color:#fff;padding:8px 22px;border-radius:25px;font-size:0.9em;font-weight:700}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,45,85,0.5)}50%{box-shadow:0 0 0 18px rgba(255,45,85,0)}}
        
        .container{max-width:780px;margin:0 auto;padding:15px 20px}
        
        .warning-hero{background:linear-gradient(135deg,#1a0000,#0d0000);border:2px solid #ff4444;border-radius:18px;padding:30px 25px;margin:30px 0;text-align:center;position:relative}
        .warning-hero .big-icon{font-size:3.5em;display:block;margin-bottom:10px;animation:shake 0.5s infinite}
        @keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
        .warning-hero h2{color:#ff4444;font-size:1.4em;margin-bottom:10px}
        .warning-hero p{color:#ffaaaa;font-size:1em;line-height:1.8}
        
        .guide-section{background:#0a0a0a;border:1px solid #222;border-radius:16px;padding:25px;margin:25px 0}
        .guide-section h3{color:#ffcc00;font-size:1.15em;margin-bottom:15px;display:flex;align-items:center;gap:8px}
        .guide-step{background:#111;border-radius:12px;padding:18px;margin:12px 0;border-left:4px solid #22c55e}
        .guide-step.fake-step{border-left-color:#ff4444}
        .guide-step.fake-step.high{border-left-color:#ff0000;background:#140000}
        .guide-step h4{font-size:1.05em;margin-bottom:6px;display:flex;align-items:center;gap:8px}
        .guide-step h4 .step-num{background:#333;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:700;flex-shrink:0}
        .guide-step p{color:#bbb;font-size:0.95em;line-height:1.7}
        .guide-step .highlight{color:#ff4444;font-weight:600}
        .guide-step .spelling-note{background:#1a1a00;color:#ffcc00;padding:6px 12px;border-radius:6px;display:inline-block;font-size:0.9em;margin-top:6px}
        
        .section{margin:35px 0}
        .section-title{font-size:1.4em;font-weight:700;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #22c55e;display:flex;align-items:center;gap:8px}
        .section-title.fake-title{border-bottom-color:#ff4444}
        
        .account-card{border-radius:14px;padding:20px;margin:14px 0;transition:transform 0.2s}
        .account-card:hover{transform:translateY(-2px)}
        .account-card.verified{background:#0a1a0a;border:1px solid #22c55e}
        .account-card.fake{background:#1a0a0a;border:1px solid #ff4444}
        .account-card.high-danger{border-width:2px;box-shadow:0 0 20px rgba(255,68,68,0.2)}
        .card-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
        .platform-badge{font-weight:700;font-size:0.85em;padding:5px 14px;border-radius:20px}
        .verified-badge{background:#22c55e;color:#000}
        .fake-badge{background:#ff4444;color:#fff}
        .username{font-size:1.2em;font-weight:600;letter-spacing:0.5px}
        
        .tag{padding:5px 14px;border-radius:15px;font-size:0.8em;font-weight:600;display:inline-block;margin:10px 0}
        .official-tag{background:#22c55e;color:#000}
        .fake-tag{background:#ff4444;color:#fff}
        
        .screenshot-box{
            text-align:center;
            margin:14px 0;
            background:#000;
            border-radius:10px;
            padding:14px;
            border:1px solid #222;
            display:flex;
            justify-content:center;
            align-items:center;
        }
        
        .proof-img{
            width:100%;
            max-width:360px;
            height:auto;
            aspect-ratio:9/19.5;
            object-fit:contain;
            object-position:center;
            border-radius:8px;
            cursor:pointer;
            transition:transform 0.3s ease, box-shadow 0.3s ease;
            border:1px solid #333;
            background:#0a0a0a;
        }
        
        .proof-img:hover{
            transform:scale(1.03);
            box-shadow:0 8px 30px rgba(255,255,255,0.1);
        }
        
        .proof-img.zoomed{
            transform:scale(1.6);
            z-index:1000;
            position:relative;
            box-shadow:0 20px 60px rgba(0,0,0,0.9);
            border-radius:12px;
            max-width:360px;
            cursor:zoom-out;
        }
        
        .click-hint{
            display:block;
            color:#666;
            font-size:0.75em;
            margin-top:6px;
            text-align:center;
        }
        
        .reason{color:#ffaaaa;font-size:0.9em;margin-top:10px;line-height:1.6;background:rgba(255,0,0,0.1);padding:10px;border-radius:8px;border-left:3px solid #ff4444}
        
        .action-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
        .btn{padding:12px 22px;border-radius:25px;text-decoration:none;font-weight:700;font-size:0.95em;transition:all 0.2s;cursor:pointer;border:none;font-family:inherit;display:inline-flex;align-items:center;gap:6px;justify-content:center}
        .btn-icon{font-size:1.1em}
        .btn-follow{background:#22c55e;color:#000;font-size:1em}
        .btn-follow:hover{background:#1ea84e;transform:scale(1.04);box-shadow:0 4px 15px rgba(34,197,94,0.4)}
        .btn-report{background:#ff2d55;color:#fff;font-size:1em}
        .btn-report:hover{background:#e60040;transform:scale(1.04);box-shadow:0 4px 15px rgba(255,45,85,0.4)}
        .btn-copy{background:#2a2a2a;color:#fff}
        .btn-copy:hover{background:#444}
        .btn-copy.copied{background:#22c55e!important;color:#000!important}
        
        .action-steps{background:#0a0a0a;border:2px solid #ffcc00;border-radius:16px;padding:25px;margin:30px 0}
        .action-steps h3{color:#ffcc00;font-size:1.2em;margin-bottom:15px;text-align:center}
        .action-steps ol{list-style:none;counter-reset:step;padding-left:0}
        .action-steps ol li{counter-increment:step;padding:12px 12px 12px 45px;position:relative;color:#ddd;font-size:0.95em;line-height:1.7;margin:8px 0}
        .action-steps ol li::before{content:counter(step);position:absolute;left:0;top:10px;width:30px;height:30px;background:#ffcc00;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9em}
        .action-steps .tip-box{background:#1a1a00;border:1px solid #ffcc00;border-radius:10px;padding:14px;margin-top:16px;text-align:center}
        .action-steps .tip-box strong{color:#ffcc00}
        
        .footer{text-align:center;padding:40px 20px;color:#555;font-size:0.85em;line-height:1.8}
        .footer .heart{color:#ff2d55}
        
        @media(max-width:600px){
            .proof-img{max-width:300px}
            .proof-img.zoomed{transform:scale(1.3);max-width:300px}
        }
        
        @media(max-width:400px){
            .proof-img{max-width:260px}
            .proof-img.zoomed{transform:scale(1.2);max-width:260px}
        }
        
        @media(max-width:500px){
            .name{font-size:1.5em}
            .card-top{justify-content:center;text-align:center}
            .action-buttons{flex-direction:column}
            .btn{width:100%}
            .guide-step{padding:14px}
            .photo{width:100px;height:100px}
        }
    </style>
</head>
<body>
<div class="header">
<img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="photo" onerror="this.style.display='none'">
<h1 class="name">${DATA.celebrity.name}</h1>
<p class="bio">${DATA.celebrity.bio}</p>
<div class="badge-row">
<span class="badge-official">✅ অফিসিয়াল পেজ</span>
<span class="badge-fun">🎭 এন্টারটেইনমেন্ট</span>
</div>
</div>

<div class="container">

<div class="warning-hero">
<span class="big-icon">⚠️</span>
<h2>সাবধান! আমার নামে অনেক ভুয়া একাউন্ট আছে</h2>
<p>${DATA.celebrity.name} নাম ব্যবহার করে অনেকেই ভুয়া একাউন্ট খুলেছে।<br>নিচে বিস্তারিত দেখুন এবং সাবধান থাকুন।</p>
</div>

<div class="guide-section">
<h3>📖 আসল একাউন্ট চেনার উপায়</h3>

<div class="guide-step">
<h4><span class="step-num">১</span> আসল একাউন্ট</h4>
<p><strong>অফিসিয়াল ইউজারনেম:</strong> <span style="color:#22c55e;font-weight:700">@baiillamaach_official</span></p>
<p>এটিই আমাদের <strong>একমাত্র অফিসিয়াল প্রোফাইল।</strong> আমাদের সব অথেনটিক আপডেট এবং কন্টেন্ট শুধুমাত্র এই একাউন্ট থেকেই পোস্ট করা হয়। এর বাইরে আমাদের অন্য কোনো ব্যাকআপ বা পার্সোনাল একাউন্ট <strong>নেই।</strong></p>
</div>

<div class="guide-step fake-step high">
<h4><span class="step-num">২</span> প্রধান ভুয়া একাউন্ট</h4>
<p><strong>নকল ইউজারনেম:</strong> <span class="highlight">@baiilla_mach</span></p>
<p class="spelling-note">⚠️ বানান খেয়াল করুন: এখানে একটি <strong>'l'</strong> এবং একটি <strong>'a'</strong> কম আছে</p>
<p>এই একাউন্টটি হুবহু আমাদের লোগো এবং পোস্ট কপি করে।</p>
</div>

<div class="guide-step fake-step">
<h4><span class="step-num">৩</span> স্প্যাম ভুয়া একাউন্ট</h4>
<p><strong>নকল ইউজারনেম:</strong> <span class="highlight">@hammad_fams0</span></p>
<p>এটি আরেকটি ফেক একাউন্ট যা আমাদের নাম ও ছবি ব্যবহার করে ফলোয়ারদের বিভ্রান্ত করছে।</p>
</div>
</div>

<div class="section">
<h2 class="section-title">✅ আসল একাউন্ট</h2>
${DATA.realAccounts.map(a => `
<div class="account-card verified">
<div class="card-top">
<span class="platform-badge verified-badge">✅ ${a.platform}</span>
<span class="username">${a.username}</span>
</div>
<span class="tag official-tag">✨ অফিসিয়াল</span>
${a.screenshot ? `
<div class="screenshot-box">
<img src="${a.screenshot}" alt="Official TikTok Account Screenshot" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy" title="ক্লিক করে বড় করে দেখুন">
</div>
<span class="click-hint">🖱️ ক্লিক করে বড় করে দেখুন</span>` : ''}
<a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn btn-follow">
<span class="btn-icon">👉</span> ফলো করতে ক্লিক করুন
</a>
</div>
`).join('')}
</div>

<div class="section">
<h2 class="section-title fake-title">🚨 ভুয়া একাউন্ট সমূহ</h2>
${DATA.fakeAccounts.map(a => `
<div class="account-card fake ${a.dangerLevel === 'high' ? 'high-danger' : ''}">
<div class="card-top">
<span class="platform-badge fake-badge">🚨 ${a.platform}</span>
<span class="username">${a.username}</span>
</div>
<span class="tag fake-tag">⚠️ ভুয়া একাউন্ট</span>
${a.screenshot ? `
<div class="screenshot-box">
<img src="${a.screenshot}" alt="Fake Account Screenshot - ${a.username}" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy" title="ক্লিক করে বড় করে দেখুন">
</div>
<span class="click-hint">🖱️ ক্লিক করে বড় করে দেখুন</span>` : ''}
${a.reason ? `<p class="reason"><strong>⚠️ বিপদ:</strong> ${a.reason}</p>` : ''}
<div class="action-buttons">
<a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-report">
<span class="btn-icon">🚨</span> রিপোর্ট করতে ক্লিক করুন
</a>
<button class="btn btn-copy" data-username="${a.username}">
<span class="btn-icon">📋</span> ইউজারনেম কপি করুন
</button>
</div>
</div>
`).join('')}
</div>

<div class="action-steps">
<h3>🛡️ আপনার করণীয়</h3>
<ol>
<li>উপরের ভুয়া একাউন্টগুলোতে (<strong>@baiilla_mach</strong> এবং <strong>@hammad_fams0</strong>) গিয়ে ক্লিক করে <strong>"Report"</strong> করুন।</li>
<li>আমাদের অফিসিয়াল পেজ ছাড়া অন্য কোথাও কোনো তথ্য শেয়ার করবেন না।</li>
<li>সন্দেহ হলে শুধুমাত্র এই পেজে দেওয়া <strong>অফিসিয়াল লিংক</strong> ব্যবহার করবেন।</li>
</ol>
<div class="tip-box">
<strong>💡 টিপস:</strong> কোনো একাউন্টের ওপর সন্দেহ হলে উপরের <strong>অফিসিয়াল ফলো বাটন</strong> থেকে আমাদের আসল একাউন্টে যান।
</div>
</div>

</div>

<div class="footer">
<p>© ${DATA.celebrity.name} | শুধুমাত্র এন্টারটেইনমেন্ট <span class="heart">🎭</span></p>
</div>

<script>
document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', function() {
        const username = this.dataset.username;
        navigator.clipboard.writeText(username).then(() => {
            this.innerHTML = '<span class="btn-icon">✅</span> কপি হয়েছে';
            this.classList.add('copied');
            setTimeout(() => {
                this.innerHTML = '<span class="btn-icon">📋</span> ইউজারনেম কপি করুন';
                this.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            alert('ইউজারনেম: ' + username);
        });
    });
});

document.querySelectorAll('.proof-img').forEach(img => {
    img.addEventListener('click', function(e) {
        e.stopPropagation();
        const wasZoomed = this.classList.contains('zoomed');
        
        document.querySelectorAll('.proof-img.zoomed').forEach(zoomImg => {
            zoomImg.classList.remove('zoomed');
        });
        
        if (!wasZoomed) {
            this.classList.add('zoomed');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.proof-img.zoomed').forEach(img => {
            img.classList.remove('zoomed');
            document.body.style.overflow = '';
        });
    }
});

document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('proof-img')) {
        document.querySelectorAll('.proof-img.zoomed').forEach(img => {
            img.classList.remove('zoomed');
            document.body.style.overflow = '';
        });
    }
});
</script>
</body>
</html>`;
}

// Create server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve local assets from /assets folder
    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dirname, pathname);
        
        // Security check to prevent directory traversal
        if (!assetPath.startsWith(ASSETS_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        
        // Check if file exists and serve it
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const contentTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon'
            };
            
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': stat.size,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': '*',
                'X-Content-Type-Options': 'nosniff'
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
        } else {
            console.log(`❌ Asset not found: ${assetPath}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Asset not found');
        }
        return;
    }

    // Main page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(getHTML());
        return;
    }

    // API endpoint
    if (pathname === '/data.json') {
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(DATA, null, 2));
        return;
    }

    // Health check
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            assets: {
                profile: fs.existsSync(path.join(__dirname, IMAGES.profile)),
                official: fs.existsSync(path.join(__dirname, IMAGES.official)),
                fraud: fs.existsSync(path.join(__dirname, IMAGES.fraud)),
                danger: fs.existsSync(path.join(__dirname, IMAGES.danger))
            }
        }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 - পাওয়া যায়নি</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.error-code{font-size:120px;font-weight:900;background:linear-gradient(45deg,#ff2d55,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.message{font-size:1.5em;margin:20px 0;color:#ddd}
.btn{display:inline-block;padding:12px 30px;background:#ff2d55;color:#fff;text-decoration:none;border-radius:25px;font-weight:700}
.btn:hover{transform:scale(1.05)}
</style>
</head>
<body>
<div>
<div class="error-code">404</div>
<p class="message">দুঃখিত! পেজটি খুঁজে পাওয়া যায়নি</p>
<a href="/" class="btn">🏠 হোম পেজ</a>
</div>
</body>
</html>`);
});

// Start server
server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('✅ SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`🚀 URL: http://localhost:${PORT}`);
    console.log(`📁 Assets directory: ${ASSETS_DIR}`);
    console.log(`📡 API: http://localhost:${PORT}/data.json`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log('='.repeat(60));
    console.log('');
    console.log('📸 Asset paths:');
    for (const [key, imagePath] of Object.entries(IMAGES)) {
        const fullPath = path.join(__dirname, imagePath);
        const exists = fs.existsSync(fullPath);
        const icon = exists ? '✅' : '❌';
        console.log(`   ${icon} ${key}: ${imagePath}`);
    }
    console.log('');
    console.log('📱 Mobile screenshots optimized for 9:19.5 aspect ratio');
    console.log('');
});

// Error handling
server.on('error', (err) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the process or use a different port.`);
        process.exit(1);
    }
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n👋 Interrupted. Shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

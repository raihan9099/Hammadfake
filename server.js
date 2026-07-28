const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Create images directory
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
}

// YOUR ACTUAL IMAGES
const IMAGES = {
    official: '/images/official.png',
    fraud: '/images/fraud.png',
    danger: '/images/danger.png'
};

// Download images from Imgur
function downloadImage(imageUrl, filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(IMAGES_DIR, filename);
        
        if (fs.existsSync(filePath)) {
            console.log(`✅ Already exists: ${filename}`);
            resolve(filePath);
            return;
        }
        
        console.log(`📥 Downloading: ${filename} from ${imageUrl}`);
        
        const options = {
            hostname: 'i.imgur.com',
            path: new URL(imageUrl).pathname,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*',
                'Referer': 'https://imgur.com/'
            }
        };
        
        https.get(options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (redirectRes) => {
                    const file = fs.createWriteStream(filePath);
                    redirectRes.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✅ Downloaded: ${filename}`);
                        resolve(filePath);
                    });
                }).on('error', reject);
                return;
            }
            
            const file = fs.createWriteStream(filePath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded: ${filename}`);
                resolve(filePath);
            });
        }).on('error', (err) => {
            console.error(`❌ Failed: ${filename}`, err.message);
            reject(err);
        });
    });
}

// Download all images
async function downloadAllImages() {
    console.log('\n🔄 Downloading images...\n');
    try {
        await downloadImage('https://i.imgur.com/jvAsp7P.png', 'official.png');
        await downloadImage('https://i.imgur.com/Yu1H5eT.png', 'fraud.png');
        await downloadImage('https://i.imgur.com/J8MucwJ.png', 'danger.png');
        console.log('\n✅ All images ready!\n');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

// DATA with YOUR images
const DATA = {
    celebrity: {
        name: "Baiilla Maach Official",
        photo: IMAGES.official,
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
            screenshot: IMAGES.fraud,
            dangerLevel: "high",
            reason: "বানান কপি করে ভুয়া একাউন্ট। একটি 'l' এবং একটি 'a' কম আছে। হুবহু লোগো ও পোস্ট কপি করে প্রতারণা করছে।"
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: IMAGES.danger,
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
        body{font-family:'Hind Siliguri',Arial,sans-serif;background:#000;color:#fff;min-height:100vh;line-height:1.7}
        
        .header{text-align:center;padding:50px 20px 40px;background:linear-gradient(180deg,#0d0015 0%,#000 100%)}
        .photo{width:140px;height:140px;border-radius:50%;border:5px solid #ff2d55;object-fit:cover;margin-bottom:18px;box-shadow:0 0 40px rgba(255,45,85,0.35)}
        .name{font-size:2.2em;font-weight:800}
        .bio{color:#ddd;margin-top:8px;font-size:1.1em}
        .badge-row{margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .badge-official{background:#ff2d55;padding:8px 22px;border-radius:25px;font-weight:700}
        .badge-fun{background:#ff6b00;padding:8px 22px;border-radius:25px;font-weight:700}
        
        .container{max-width:780px;margin:0 auto;padding:15px 20px}
        
        .warning-hero{background:linear-gradient(135deg,#1a0000,#0d0000);border:2px solid #ff4444;border-radius:18px;padding:30px;margin:30px 0;text-align:center}
        .big-icon{font-size:3.5em;display:block;margin-bottom:10px}
        .warning-hero h2{color:#ff4444;margin-bottom:10px}
        .warning-hero p{color:#ffaaaa}
        
        .guide-section{background:#0a0a0a;border:1px solid #222;border-radius:16px;padding:25px;margin:25px 0}
        .guide-section h3{color:#ffcc00;margin-bottom:15px}
        .guide-step{background:#111;border-radius:12px;padding:18px;margin:12px 0;border-left:4px solid #22c55e}
        .guide-step.fake-step{border-left-color:#ff4444}
        .guide-step.fake-step.high{border-left-color:#ff0000;background:#140000}
        .step-num{background:#333;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:8px}
        .guide-step p{color:#bbb;font-size:0.95em;line-height:1.7;margin-top:6px}
        .highlight{color:#ff4444;font-weight:600}
        .spelling-note{background:#1a1a00;color:#ffcc00;padding:6px 12px;border-radius:6px;display:inline-block;margin-top:6px}
        
        .section{margin:35px 0}
        .section-title{font-size:1.4em;font-weight:700;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #22c55e}
        .section-title.fake-title{border-bottom-color:#ff4444}
        
        .account-card{border-radius:14px;padding:20px;margin:14px 0}
        .account-card.verified{background:#0a1a0a;border:1px solid #22c55e}
        .account-card.fake{background:#1a0a0a;border:1px solid #ff4444}
        .account-card.high-danger{border-width:2px;box-shadow:0 0 20px rgba(255,68,68,0.3)}
        
        .card-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
        .platform-badge{font-weight:700;font-size:0.85em;padding:5px 14px;border-radius:20px}
        .verified-badge{background:#22c55e;color:#000}
        .fake-badge{background:#ff4444}
        .username{font-size:1.2em;font-weight:600}
        
        .tag{padding:5px 14px;border-radius:15px;font-size:0.8em;font-weight:600;display:inline-block;margin:10px 0}
        .official-tag{background:#22c55e;color:#000}
        .fake-tag{background:#ff4444}
        
        .screenshot-box{text-align:center;margin:14px 0;background:#000;border-radius:10px;padding:14px;border:1px solid #222}
        .proof-img{max-width:100%;max-height:400px;border-radius:8px;cursor:pointer;transition:transform 0.3s;border:1px solid #333}
        .proof-img.zoomed{transform:scale(1.8);z-index:100;position:relative}
        .click-hint{display:block;color:#666;font-size:0.75em;margin-top:6px}
        
        .reason{color:#ffaaaa;font-size:0.9em;margin-top:10px;line-height:1.6;background:rgba(255,0,0,0.1);padding:10px;border-radius:8px}
        
        .action-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
        .btn{padding:12px 22px;border-radius:25px;text-decoration:none;font-weight:700;font-size:0.95em;border:none;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
        .btn-follow{background:#22c55e;color:#000}
        .btn-follow:hover{transform:scale(1.04)}
        .btn-report{background:#ff2d55;color:#fff}
        .btn-report:hover{transform:scale(1.04)}
        .btn-copy{background:#2a2a2a;color:#fff}
        .btn-copy.copied{background:#22c55e!important;color:#000!important}
        
        .action-steps{background:#0a0a0a;border:2px solid #ffcc00;border-radius:16px;padding:25px;margin:30px 0}
        .action-steps h3{color:#ffcc00;text-align:center;margin-bottom:15px}
        .action-steps ol{list-style:none;counter-reset:step;padding-left:0}
        .action-steps ol li{counter-increment:step;padding:12px 12px 12px 45px;position:relative;color:#ddd;margin:8px 0}
        .action-steps ol li::before{content:counter(step);position:absolute;left:0;top:10px;width:30px;height:30px;background:#ffcc00;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
        .tip-box{background:#1a1a00;border:1px solid #ffcc00;border-radius:10px;padding:14px;margin-top:16px;text-align:center}
        .tip-box strong{color:#ffcc00}
        
        .footer{text-align:center;padding:40px;color:#555}
        
        @media(max-width:500px){
            .name{font-size:1.5em}
            .action-buttons{flex-direction:column}
            .btn{width:100%;justify-content:center}
            .photo{width:100px;height:100px}
        }
    </style>
</head>
<body>

<div class="header">
    <img src="${DATA.celebrity.photo}" alt="Official" class="photo">
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
        <p><strong>অফিসিয়াল ইউজারনেম:</strong> <span style="color:#22c55e;font-weight:700;font-size:1.1em;">@baiillamaach_official</span></p>
        <p>এটিই আমাদের <strong>একমাত্র অফিসিয়াল প্রোফাইল।</strong> সব আপডেট শুধুমাত্র এই একাউন্ট থেকে দেওয়া হয়।</p>
    </div>
    
    <div class="guide-step fake-step high">
        <h4><span class="step-num">২</span> প্রধান ভুয়া একাউন্ট</h4>
        <p><strong>নকল ইউজারনেম:</strong> <span class="highlight">@baiilla_mach</span></p>
        <p class="spelling-note">⚠️ বানান খেয়াল করুন: একটি 'l' এবং একটি 'a' কম</p>
        <p>হুবহু লোগো ও পোস্ট কপি করে প্রতারণা করছে।</p>
    </div>
    
    <div class="guide-step fake-step">
        <h4><span class="step-num">৩</span> স্প্যাম ভুয়া একাউন্ট</h4>
        <p><strong>নকল ইউজারনেম:</strong> <span class="highlight">@hammad_fams0</span></p>
        <p>নাম ও ছবি ব্যবহার করে ফলোয়ারদের বিভ্রান্ত করছে।</p>
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
            <img src="${a.screenshot}" alt="Official Account" class="proof-img" onclick="this.classList.toggle('zoomed')">
            <span class="click-hint">🖱️ ক্লিক করে বড় করে দেখুন</span>
        </div>` : ''}
        <a href="${a.url}" target="_blank" rel="noopener" class="btn btn-follow">
            👉 ফলো করতে ক্লিক করুন
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
            <img src="${a.screenshot}" alt="${a.username}" class="proof-img" onclick="this.classList.toggle('zoomed')">
            <span class="click-hint">🖱️ ক্লিক করে বড় করে দেখুন</span>
        </div>` : ''}
        ${a.reason ? `<p class="reason"><strong>⚠️ বিপদ:</strong> ${a.reason}</p>` : ''}
        <div class="action-buttons">
            <a href="${a.profileUrl}" target="_blank" rel="noopener" class="btn btn-report">
                🚨 রিপোর্ট করতে ক্লিক করুন
            </a>
            <button class="btn btn-copy" data-username="${a.username}">
                📋 ইউজারনেম কপি করুন
            </button>
        </div>
    </div>
    `).join('')}
</div>

<div class="action-steps">
    <h3>🛡️ আপনার করণীয়</h3>
    <ol>
        <li>ভুয়া একাউন্টে গিয়ে <strong>"Report → Scam or Fraud"</strong> ক্লিক করুন</li>
        <li>অফিসিয়াল পেজ ছাড়া কোথাও <strong>টাকা বা তথ্য</strong> শেয়ার করবেন না</li>
        <li>সন্দেহ হলে <strong>অফিসিয়াল লিংক</strong> ব্যবহার করে যোগাযোগ করুন</li>
    </ol>
    <div class="tip-box">
        <strong>💡 টিপস:</strong> আমরা কখনো ইনবক্সে টাকা চাইবো না। সন্দেহ হলে উপরের অফিসিয়াল ফলো বাটন ব্যবহার করুন।
    </div>
</div>

</div>

<div class="footer">
    <p>© ${DATA.celebrity.name} | শুধুমাত্র এন্টারটেইনমেন্ট 🎭</p>
</div>

<script>
// Copy username
document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', function() {
        const username = this.dataset.username;
        navigator.clipboard.writeText(username).then(() => {
            this.innerHTML = '✅ কপি হয়েছে';
            this.classList.add('copied');
            setTimeout(() => {
                this.innerHTML = '📋 ইউজারনেম কপি করুন';
                this.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            alert('ইউজারনেম: ' + username);
        });
    });
});

// Close zoom on ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.proof-img.zoomed').forEach(img => {
            img.classList.remove('zoomed');
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

    // Serve local images
    if (pathname.startsWith('/images/')) {
        const imagePath = path.join(__dirname, pathname);
        
        if (!imagePath.startsWith(IMAGES_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        if (fs.existsSync(imagePath)) {
            const ext = path.extname(imagePath).toLowerCase();
            const contentTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif'
            };
            
            res.writeHead(200, {
                'Content-Type': contentTypes[ext] || 'image/png',
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*'
            });
            
            fs.createReadStream(imagePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Image not found');
        }
        return;
    }

    // Main page
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getHTML());
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1 style="color:white;background:black;text-align:center;padding:50px">404 - Not Found</h1>');
});

// Start
downloadAllImages().then(() => {
    server.listen(PORT, () => {
        console.log(`\n✅ SERVER RUNNING: http://localhost:${PORT}`);
        console.log(`📁 Images: ${IMAGES_DIR}`);
        console.log(`    - official.png`);
        console.log(`    - fraud.png`);
        console.log(`    - danger.png\n`);
    });
});

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        celebrity: {
            name: '',
            photo: '',
            bio: '',
            warningVoice: ''
        },
        realAccounts: [],
        fakeAccounts: []
    }, null, 2));
}

function readData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function renderPage(data) {
    const realList = data.realAccounts.map(a =>
        `<div class="account-card verified">
            <div class="account-top">
                <span class="platform-badge">${a.platform}</span>
                <span class="username">${a.username}</span>
            </div>
            <div class="account-bottom">
                <span class="status">✅ ভেরিফাইড অফিসিয়াল</span>
                <a href="${a.url}" target="_blank" class="follow-btn">👉 ফলো করুন</a>
            </div>
        </div>`
    ).join('');

    const fakeList = data.fakeAccounts.map((a, i) =>
        `<div class="account-card fake">
            <div class="fake-top">
                <span class="platform-badge fake-badge">${a.platform}</span>
                <span class="username">${a.username}</span>
                <span class="fake-tag">⚠️ ভুয়া</span>
            </div>
            ${a.screenshot ? `
            <div class="screenshot-box">
                <img src="${a.screenshot}" alt="প্রমাণ" class="proof-img" onclick="this.classList.toggle('zoomed')">
                <span class="proof-label">📸 ভুয়া একাউন্টের স্ক্রিনশট</span>
            </div>` : ''}
            <div class="action-buttons">
                ${a.profileUrl ? `<a href="${a.profileUrl}" target="_blank" class="report-btn">🚨 রিপোর্ট করুন</a>` : ''}
                <button class="copy-btn" data-username="${a.username}">📋 ইউজারনেম কপি</button>
            </div>
            <p class="reason-text">${a.reason || 'এই একাউন্টটি ভুয়া, প্রতারণা করছে'}</p>
        </div>`
    ).join('') || '<p class="empty">এখনো কোন ভুয়া একাউন্ট রিপোর্ট করা হয়নি।</p>';

    return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.celebrity.name || 'অফিসিয়াল'} | ভুয়া একাউন্টের তালিকা</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hind Siliguri','Noto Sans Bengali','Segoe UI',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}
.header{text-align:center;padding:40px 20px 30px;background:linear-gradient(180deg,#1a0020 0%,#0a0a0a 100%)}
.photo{width:130px;height:130px;border-radius:50%;border:4px solid #ff2d55;object-fit:cover;margin-bottom:16px;box-shadow:0 0 30px rgba(255,45,85,0.3)}
.photo-placeholder{width:130px;height:130px;border-radius:50%;border:4px solid #ff2d55;margin:0 auto 16px;background:#1a0020;display:flex;align-items:center;justify-content:center;font-size:45px;box-shadow:0 0 30px rgba(255,45,85,0.3)}
.name{font-size:2em;font-weight:800;color:#fff;text-shadow:0 0 20px rgba(255,45,85,0.5)}
.bio{color:#ccc;margin-top:6px;font-size:1.05em}
.official-badge{display:inline-block;background:#ff2d55;color:#fff;padding:8px 20px;border-radius:25px;font-size:0.9em;font-weight:700;margin-top:14px;letter-spacing:1px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,45,85,0.6)}50%{box-shadow:0 0 0 15px rgba(255,45,85,0)}}
.container{max-width:750px;margin:0 auto;padding:15px}
.alert-box{background:#1a0000;border:2px solid #ff4444;border-radius:16px;padding:24px;margin:25px 0;text-align:center}
.alert-box .icon{font-size:2.5em;display:block;margin-bottom:8px}
.alert-box h3{color:#ff4444;font-size:1.3em;margin-bottom:8px}
.alert-box p{color:#ffaaaa;line-height:1.7;font-size:1em}
.voice-section{background:#0a0a1a;border:1px solid #333;border-radius:12px;padding:20px;margin:20px 0;text-align:center}
.voice-section h3{color:#ffcc00;margin-bottom:10px;font-size:1.1em}
.voice-section audio{width:100%;max-width:400px;margin-top:8px}
.voice-section .voice-note{color:#888;font-size:0.85em;margin-top:8px}
.section{margin:35px 0}
.section-title{font-size:1.4em;font-weight:700;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #22c55e;display:flex;align-items:center;gap:8px}
.section-title.fake-title{border-bottom-color:#ff4444}
.account-card{border-radius:14px;padding:18px;margin:12px 0}
.account-card.verified{background:#0a1a0a;border:1px solid #22c55e}
.account-card.fake{background:#1a0a0a;border:1px solid #ff4444}
.account-top,.fake-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.platform-badge{font-weight:700;font-size:0.85em;padding:5px 14px;border-radius:20px}
.verified .platform-badge{background:#22c55e;color:#000}
.fake-badge{background:#ff4444;color:#fff}
.username{font-size:1.2em;font-weight:600;letter-spacing:0.5px}
.status{color:#22c55e;font-size:0.9em;font-weight:600}
.fake-tag{color:#ff4444;font-weight:700;font-size:0.85em;animation:blink 1s infinite}
@keyframes blink{50%{opacity:0.5}}
.account-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:10px}
.screenshot-box{text-align:center;margin:14px 0;background:#000;border-radius:10px;padding:12px}
.proof-img{max-width:100%;max-height:300px;border-radius:8px;cursor:pointer;transition:transform 0.3s;border:1px solid #333}
.proof-img.zoomed{transform:scale(1.8);z-index:100;position:relative}
.proof-label{display:block;color:#888;font-size:0.8em;margin-top:6px}
.action-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.follow-btn{display:inline-block;background:#22c55e;color:#000;padding:10px 22px;border-radius:25px;text-decoration:none;font-weight:700;font-size:0.95em;transition:all 0.2s;text-align:center}
.follow-btn:hover{background:#1ea84e;transform:scale(1.03)}
.report-btn{display:inline-block;background:#ff2d55;color:#fff;padding:10px 22px;border-radius:25px;text-decoration:none;font-weight:700;font-size:0.95em;transition:all 0.2s;text-align:center}
.report-btn:hover{background:#e60040;transform:scale(1.03)}
.copy-btn{background:#333;color:#fff;padding:10px 18px;border-radius:25px;font-weight:600;font-size:0.9em;cursor:pointer;border:none;transition:all 0.2s}
.copy-btn:hover{background:#555}
.copied{background:#22c55e!important;color:#000!important}
.reason-text{color:#ffaaaa;font-size:0.9em;margin-top:10px;font-style:italic}
.empty{color:#666;text-align:center;padding:30px;font-size:1.1em}
.report-page-btn{display:block;width:100%;max-width:400px;margin:25px auto;padding:16px;background:#ff2d55;color:#fff;border:none;border-radius:30px;font-size:1.15em;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;transition:all 0.2s;box-shadow:0 4px 20px rgba(255,45,85,0.3)}
.report-page-btn:hover{background:#e60040;transform:translateY(-2px);box-shadow:0 6px 25px rgba(255,45,85,0.5)}
.footer{text-align:center;padding:40px 20px;color:#555;font-size:0.85em;line-height:1.8}
.heart{color:#ff2d55}
@media(max-width:500px){
.name{font-size:1.5em}
.account-top,.fake-top{justify-content:center;text-align:center}
.account-bottom{flex-direction:column;text-align:center}
.action-buttons{flex-direction:column}
.follow-btn,.report-btn,.copy-btn{width:100%;text-align:center}
}
</style>
</head>
<body>
<div class="header">
${data.celebrity.photo
    ? `<img src="${data.celebrity.photo}" alt="অফিসিয়াল" class="photo">`
    : '<div class="photo-placeholder">⭐</div>'}
<h1 class="name">${data.celebrity.name || 'নাম লিখুন'}</h1>
${data.celebrity.bio ? `<p class="bio">${data.celebrity.bio}</p>` : ''}
<span class="official-badge">✅ অফিসিয়াল পেজ</span>
</div>

<div class="container">

<div class="alert-box">
<span class="icon">⚠️</span>
<h3>সাবধান! আমার নামে অনেক ভুয়া একাউন্ট আছে</h3>
<p>${data.celebrity.name || 'আমার'} নাম ব্যবহার করে অনেকেই ভুয়া একাউন্ট খুলে প্রতারণা করছে।<br>
নিচে শুধুমাত্র আমার <strong>আসল একাউন্টগুলোর</strong> তালিকা দেওয়া হলো।<br>
এগুলো ছাড়া <strong>অন্য সব একাউন্ট ভুয়া।</strong> দয়া করে টাকা পাঠাবেন না বা ব্যক্তিগত তথ্য শেয়ার করবেন না।</p>
</div>

${data.celebrity.warningVoice ? `
<div class="voice-section">
<h3>🎙️ আমার ভয়েজ মেসেজ শুনুন</h3>
<audio controls>
<source src="${data.celebrity.warningVoice}" type="audio/mpeg">
আপনার ব্রাউজার অডিও সাপোর্ট করে না।
</audio>
<p class="voice-note">⚠️ এই ভয়েজটি শুধুমাত্র এই অফিসিয়াল পেজেই আছে। অন্য কোথাও শুনলে সেটা ভুয়া।</p>
</div>` : ''}

<div class="section">
<h2 class="section-title">✅ আমার আসল একাউন্ট সমূহ</h2>
${data.realAccounts.length ? realList : '<p class="empty">এখনো কোন একাউন্ট যোগ করা হয়নি।</p>'}
</div>

<div class="section">
<h2 class="section-title fake-title">🚨 ভুয়া একাউন্টের তালিকা</h2>
${fakeList}
</div>

<a href="/report" class="report-page-btn">📢 ভুয়া একাউন্ট রিপোর্ট করুন</a>

</div>

<div class="footer">
<p>এটাই আমার একমাত্র অফিসিয়াল পেজ। অন্য সব ভুয়া।</p>
<p>প্রতারিত হবেন না <span class="heart">❤️</span></p>
<p style="margin-top:10px;color:#888;">© ${data.celebrity.name || ''} - অফিসিয়াল</p>
</div>

<script>
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const username = this.dataset.username;
        navigator.clipboard.writeText(username).then(() => {
            this.textContent = '✅ কপি হয়েছে!';
            this.classList.add('copied');
            setTimeout(() => {
                this.textContent = '📋 ইউজারনেম কপি';
                this.classList.remove('copied');
            }, 2000);
        });
    });
});
</script>
</body>
</html>`;
}

function renderReportPage() {
    return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ভুয়া একাউন্ট রিপোর্ট</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hind Siliguri','Noto Sans Bengali','Segoe UI',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.form-box{background:#111;padding:35px;border-radius:18px;width:100%;max-width:480px;margin:20px;border:1px solid #222}
h2{text-align:center;margin-bottom:8px;font-size:1.5em}
.subtitle{text-align:center;color:#888;margin-bottom:22px;font-size:0.9em}
label{display:block;margin:14px 0 6px;font-weight:600;color:#ddd}
input,select,textarea{width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#0a0a0a;color:#fff;font-size:1em;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:#ff2d55}
textarea{resize:vertical;min-height:80px}
button{width:100%;padding:14px;margin-top:22px;background:#ff2d55;color:#fff;border:none;border-radius:12px;font-size:1.1em;font-weight:700;cursor:pointer;transition:all 0.2s}
button:hover{background:#e60040}
.back{display:block;text-align:center;margin-top:16px;color:#888;text-decoration:none}
.back:hover{color:#fff}
.help{font-size:0.8em;color:#777;margin-top:4px}
</style>
</head>
<body>
<div class="form-box">
<h2>🚨 ভুয়া একাউন্ট রিপোর্ট করুন</h2>
<p class="subtitle">কেউ আমার নামে ভুয়া একাউন্ট খুললে জানান</p>
<form action="/submit-report" method="POST">
<label>প্লাটফর্ম</label>
<select name="platform" required>
<option value="">প্লাটফর্ম সিলেক্ট করুন...</option>
<option>TikTok</option>
<option>Instagram</option>
<option>Facebook</option>
<option>YouTube</option>
<option>Twitter/X</option>
<option>Telegram</option>
<option>WhatsApp</option>
<option>Snapchat</option>
<option>অন্যান্য</option>
</select>
<label>ভুয়া একাউন্টের ইউজারনেম</label>
<input type="text" name="username" placeholder="যেমন: @fakeaccount123" required>
<label>ভুয়া একাউন্টের লিংক</label>
<input type="url" name="profileUrl" placeholder="https://tiktok.com/@fakeaccount">
<span class="help">ভুয়া প্রোফাইলের ডাইরেক্ট লিংক দিন</span>
<label>স্ক্রিনশট লিংক (Imgur বা অন্য কোনো ইমেজ লিংক)</label>
<input type="url" name="screenshot" placeholder="https://imgur.com/...">
<span class="help">imgur.com এ স্ক্রিনশট আপলোড করে লিংক দিন</span>
<label>কারণ (ঐচ্ছিক)</label>
<textarea name="reason" placeholder="যেমন: টাকা চাচ্ছে, আমার ছবি ব্যবহার করছে, ফ্যানদের সাথে প্রতারণা করছে..."></textarea>
<button type="submit">রিপোর্ট সাবমিট করুন</button>
</form>
<a href="/" class="back">← মূল পেজে ফিরুন</a>
</div>
</body>
</html>`;
}

function renderAdminPage(data) {
    const realList = data.realAccounts.map((a, i) =>
        `<tr>
            <td>${a.platform}</td>
            <td>${a.username}</td>
            <td><a href="${a.url}" target="_blank">লিংক</a></td>
            <td><button class="del-btn" data-type="real" data-index="${i}">মুছুন</button></td>
        </tr>`
    ).join('');

    const fakeList = data.fakeAccounts.map((a, i) =>
        `<tr>
            <td>${a.platform}</td>
            <td>${a.username}</td>
            <td>${a.reason || '-'}</td>
            <td>${a.profileUrl ? `<a href="${a.profileUrl}" target="_blank">লিংক</a>` : '-'}</td>
            <td>${a.screenshot ? `<a href="${a.screenshot}" target="_blank">📸</a>` : '-'}</td>
            <td><button class="del-btn" data-type="fake" data-index="${i}">মুছুন</button></td>
        </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>অ্যাডমিন প্যানেল</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hind Siliguri','Noto Sans Bengali','Segoe UI',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}
.header{background:#111;padding:18px;text-align:center;border-bottom:2px solid #ff2d55}
.header h1{font-size:1.3em}
.container{max-width:950px;margin:0 auto;padding:20px}
.section{margin:25px 0;background:#111;border-radius:14px;padding:22px;border:1px solid #222}
.section h2{margin-bottom:14px;color:#ff2d55;font-size:1.15em}
form{display:flex;flex-direction:column;gap:10px}
.row{display:flex;gap:10px;flex-wrap:wrap}
.row input,.row select{flex:1;min-width:140px}
input,select,textarea{padding:10px;border-radius:6px;border:1px solid #333;background:#0a0a0a;color:#fff;font-size:0.9em;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:#ff2d55}
textarea{resize:vertical;min-height:55px}
button{padding:10px 18px;background:#ff2d55;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600}
button:hover{background:#e60040}
.btn-green{background:#22c55e;color:#000}
.btn-green:hover{background:#1ea84e}
.btn-red{background:#ef4444}
.btn-red:hover{background:#dc2626}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:0.85em}
th,td{padding:8px;text-align:left;border-bottom:1px solid #222}
th{color:#888;font-size:0.8em}
td a{color:#ff6b8a}
.del-btn{background:#ef4444;padding:5px 12px;font-size:0.8em}
.del-btn:hover{background:#dc2626}
.back-link{display:block;text-align:center;margin-top:20px;color:#888;text-decoration:none}
.back-link:hover{color:#fff}
hr{border:none;border-top:1px solid #222;margin:18px 0}
.help-text{font-size:0.75em;color:#888;margin-top:2px}
</style>
</head>
<body>
<div class="header">
<h1>⚙️ অ্যাডমিন প্যানেল</h1>
</div>
<div class="container">

<div class="section">
<h2>প্রোফাইল আপডেট</h2>
<form action="/admin/update-profile" method="POST">
<input type="text" name="name" placeholder="আপনার নাম" value="${data.celebrity.name}">
<input type="text" name="photo" placeholder="প্রোফাইল ফটো URL" value="${data.celebrity.photo}">
<input type="text" name="bio" placeholder="ছোট বায়ো" value="${data.celebrity.bio}">
<input type="text" name="warningVoice" placeholder="ভয়েজ মেসেজের অডিও লিংক (Google Drive বা সরাসরি mp3 link)" value="${data.celebrity.warningVoice || ''}">
<span class="help-text">ভয়েজ রেকর্ড করে Google Drive বা অন্য কোথাও আপলোড করে সরাসরি mp3 লিংক দিন</span>
<button type="submit">সেইভ করুন</button>
</form>
</div>

<div class="section">
<h2>আসল একাউন্ট যোগ করুন</h2>
<form action="/admin/add-real" method="POST">
<div class="row">
<select name="platform">
<option>TikTok</option><option>Instagram</option><option>Facebook</option>
<option>YouTube</option><option>Twitter/X</option><option>অন্যান্য</option>
</select>
<input type="text" name="username" placeholder="ইউজারনেম" required>
<input type="url" name="url" placeholder="প্রোফাইল লিংক" required>
<button type="submit" class="btn-green">যোগ করুন</button>
</div>
</form>
<table>${realList || '<tr><td colspan="4">কোন একাউন্ট নেই</td></tr>'}</table>
</div>

<div class="section">
<h2>ভুয়া একাউন্ট যোগ করুন</h2>
<form action="/admin/add-fake" method="POST">
<div class="row">
<select name="platform">
<option>TikTok</option><option>Instagram</option><option>Facebook</option>
<option>YouTube</option><option>Twitter/X</option><option>Telegram</option>
<option>WhatsApp</option><option>Snapchat</option><option>অন্যান্য</option>
</select>
<input type="text" name="username" placeholder="ভুয়া ইউজারনেম" required>
</div>
<div class="row">
<input type="url" name="profileUrl" placeholder="ভুয়া প্রোফাইলের লিংক">
<input type="url" name="screenshot" placeholder="স্ক্রিনশট/Imgur লিংক">
</div>
<textarea name="reason" placeholder="কারণ (যেমন: টাকা চায়, ছবি চুরি করে)"></textarea>
<button type="submit" class="btn-red">ভুয়া একাউন্ট যোগ করুন</button>
</form>
<table>${fakeList || '<tr><td colspan="6">কোন ভুয়া একাউন্ট নেই</td></tr>'}</table>
</div>

</div>
<a href="/" class="back-link">← পাবলিক পেজ দেখুন</a>

<script>
document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        if(!confirm('এন্ট্রিটি মুছে ফেলবেন?')) return;
        const type = btn.dataset.type;
        const index = btn.dataset.index;
        const res = await fetch('/admin/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({type, index})
        });
        if(res.ok) location.reload();
    });
});
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    if (method === 'GET') {
        if (pathname === '/') {
            const data = readData();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderPage(data));
        }
        else if (pathname === '/report') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderReportPage());
        }
        else if (pathname === '/admin') {
            const data = readData();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderAdminPage(data));
        }
        else {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>পেজ পাওয়া যায়নি</h1>');
        }
    }
    else if (method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const params = new URLSearchParams(body);
            const data = readData();

            if (pathname === '/submit-report') {
                const report = {
                    platform: params.get('platform') || 'Unknown',
                    username: params.get('username') || '',
                    profileUrl: params.get('profileUrl') || '',
                    screenshot: params.get('screenshot') || '',
                    reason: params.get('reason') || '',
                    reportedAt: new Date().toISOString()
                };
                if (report.username) {
                    data.fakeAccounts.push(report);
                    writeData(data);
                }
                res.writeHead(302, { 'Location': '/?reported=1' });
                res.end();
            }
            else if (pathname === '/admin/update-profile') {
                data.celebrity.name = params.get('name') || '';
                data.celebrity.photo = params.get('photo') || '';
                data.celebrity.bio = params.get('bio') || '';
                data.celebrity.warningVoice = params.get('warningVoice') || '';
                writeData(data);
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
            }
            else if (pathname === '/admin/add-real') {
                data.realAccounts.push({
                    platform: params.get('platform'),
                    username: params.get('username'),
                    url: params.get('url')
                });
                writeData(data);
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
            }
            else if (pathname === '/admin/add-fake') {
                data.fakeAccounts.push({
                    platform: params.get('platform'),
                    username: params.get('username'),
                    profileUrl: params.get('profileUrl') || '',
                    screenshot: params.get('screenshot') || '',
                    reason: params.get('reason') || 'ভুয়া একাউন্ট, প্রতারণা করছে'
                });
                writeData(data);
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
            }
            else if (pathname === '/admin/delete') {
                const json = JSON.parse(body);
                if (json.type === 'real') data.realAccounts.splice(json.index, 1);
                if (json.type === 'fake') data.fakeAccounts.splice(json.index, 1);
                writeData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ok: true}));
            }
            else {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>পেজ পাওয়া যায়নি</h1>');
            }
        });
    }
    else {
        res.writeHead(405);
        res.end('Method not allowed');
    }
});

server.listen(PORT, () => {
    console.log(`✅ সার্ভার চালু হয়েছে: http://localhost:${PORT}`);
    console.log(`⚙️ অ্যাডমিন প্যানেল: http://localhost:${PORT}/admin`);
    console.log(`📢 রিপোর্ট পেজ: http://localhost:${PORT}/report`);
});

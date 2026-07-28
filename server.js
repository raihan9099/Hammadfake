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
            bio: ''
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
            <span class="platform">${a.platform}</span>
            <span class="username">${a.username}</span>
            <a href="${a.url}" target="_blank" class="visit-btn">Visit</a>
        </div>`
    ).join('');

    const fakeList = data.fakeAccounts.map((a, i) =>
        `<div class="account-card fake">
            <div class="fake-info">
                <span class="platform">${a.platform}</span>
                <span class="username">${a.username}</span>
                <span class="reason">${a.reason || 'Impersonating'}</span>
            </div>
            ${a.screenshot ? `<a href="${a.screenshot}" target="_blank" class="screenshot-link">📸 View Proof</a>` : ''}
            <div class="action-buttons">
                ${a.profileUrl ? `<a href="${a.profileUrl}" target="_blank" class="report-btn-tiktok">🚨 Report on ${a.platform}</a>` : ''}
                <button class="copy-btn" data-username="${a.username}" data-platform="${a.platform}">📋 Copy Username</button>
            </div>
        </div>`
    ).join('') || '<p class="empty">No fake accounts reported yet.</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.celebrity.name || 'Official'} | Fake Account Exposer</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh}
.header{text-align:center;padding:50px 20px 30px;background:linear-gradient(180deg,#1a1a2e 0%,#0f0f0f 100%)}
.photo{width:140px;height:140px;border-radius:50%;border:4px solid #e94560;object-fit:cover;margin-bottom:20px}
.photo-placeholder{width:140px;height:140px;border-radius:50%;border:4px solid #e94560;margin:0 auto 20px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:50px}
.name{font-size:2.2em;font-weight:700;color:#fff}
.bio{color:#aaa;margin-top:8px;font-size:1.1em}
.badge{display:inline-block;background:#e94560;color:#fff;padding:6px 18px;border-radius:20px;font-size:0.85em;font-weight:600;margin-top:12px;letter-spacing:1px}
.container{max-width:800px;margin:0 auto;padding:20px}
.section{margin:40px 0}
.section-title{font-size:1.5em;font-weight:700;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #e94560;display:flex;align-items:center;gap:10px}
.section-title .icon{font-size:1.3em}
.account-card{display:flex;align-items:center;padding:16px 20px;margin:10px 0;border-radius:12px;gap:16px;flex-wrap:wrap}
.account-card.verified{background:#0d2818;border:1px solid #22c55e}
.account-card.fake{background:#2d0f0f;border:1px solid #ef4444;flex-direction:column;align-items:stretch}
.platform{font-weight:700;font-size:0.9em;padding:4px 12px;border-radius:6px;min-width:80px;text-align:center;display:inline-block}
.verified .platform{background:#22c55e;color:#000}
.fake .platform{background:#ef4444;color:#fff}
.username{flex:1;font-size:1.1em;font-weight:500}
.reason{color:#fca5a5;font-size:0.9em}
.visit-btn{background:#22c55e;color:#000;padding:8px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9em;transition:opacity 0.2s}
.visit-btn:hover{opacity:0.8}
.fake-info{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.screenshot-link{display:inline-block;color:#60a5fa;text-decoration:none;font-size:0.9em;margin:8px 0}
.screenshot-link:hover{text-decoration:underline}
.action-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
.report-btn-tiktok{background:#ff0050;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9em;transition:all 0.2s;border:none;cursor:pointer;text-align:center}
.report-btn-tiktok:hover{background:#e60048;transform:translateY(-1px)}
.copy-btn{background:#374151;color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;font-size:0.9em;cursor:pointer;border:none;transition:all 0.2s}
.copy-btn:hover{background:#4b5563;transform:translateY(-1px)}
.copied{background:#22c55e!important;color:#000!important}
.empty{color:#666;text-align:center;padding:30px;font-style:italic}
.warning-box{background:#2d0f0f;border:2px solid #ef4444;border-radius:12px;padding:20px;margin:30px 0;text-align:center}
.warning-box h3{color:#ef4444;margin-bottom:8px;font-size:1.2em}
.warning-box p{color:#fca5a5;line-height:1.6}
.footer{text-align:center;padding:40px 20px;color:#555;font-size:0.85em}
.report-btn{display:block;width:100%;max-width:400px;margin:30px auto;padding:16px;background:#e94560;color:#fff;border:none;border-radius:12px;font-size:1.1em;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;transition:background 0.2s}
.report-btn:hover{background:#d63851}
@media(max-width:600px){
.name{font-size:1.6em}
.fake-info{flex-direction:column;text-align:center}
.action-buttons{flex-direction:column}
.report-btn-tiktok,.copy-btn{text-align:center}
}
</style>
</head>
<body>
<div class="header">
${data.celebrity.photo
    ? `<img src="${data.celebrity.photo}" alt="Official" class="photo">`
    : '<div class="photo-placeholder">⭐</div>'}
<h1 class="name">${data.celebrity.name || 'Celebrity Name'}</h1>
${data.celebrity.bio ? `<p class="bio">${data.celebrity.bio}</p>` : ''}
<span class="badge">✔ OFFICIAL PAGE</span>
</div>

<div class="container">
<div class="warning-box">
<h3>⚠️ SCAM WARNING</h3>
<p>There are many fake accounts impersonating ${data.celebrity.name || 'this celebrity'}.<br>
Only the accounts listed below are real. Never send money or personal information to anyone claiming to be ${data.celebrity.name || 'them'}.</p>
</div>

<div class="section">
<h2 class="section-title"><span class="icon">✅</span> Verified Real Accounts</h2>
${data.realAccounts.length ? realList : '<p class="empty">No verified accounts listed.</p>'}
</div>

<div class="section">
<h2 class="section-title"><span class="icon">🚨</span> Known Fake Accounts</h2>
${fakeList}
</div>

<a href="/report" class="report-btn">📢 Report a Fake Account</a>
</div>

<div class="footer">
<p>This is the only official page. All other accounts are fake. Do not get scammed.</p>
</div>

<script>
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const username = this.dataset.username;
        navigator.clipboard.writeText(username).then(() => {
            this.textContent = '✅ Copied!';
            this.classList.add('copied');
            setTimeout(() => {
                this.textContent = '📋 Copy Username';
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
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report Fake Account</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.form-box{background:#1a1a2e;padding:40px;border-radius:16px;width:100%;max-width:480px;margin:20px}
h2{text-align:center;margin-bottom:24px;font-size:1.5em}
label{display:block;margin:14px 0 6px;font-weight:600;color:#ccc}
input,select,textarea{width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#0f0f0f;color:#fff;font-size:1em;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:#e94560}
textarea{resize:vertical;min-height:80px}
button{width:100%;padding:14px;margin-top:20px;background:#e94560;color:#fff;border:none;border-radius:10px;font-size:1.1em;font-weight:600;cursor:pointer}
button:hover{background:#d63851}
.back{display:block;text-align:center;margin-top:16px;color:#888;text-decoration:none}
.back:hover{color:#fff}
.help-text{font-size:0.8em;color:#888;margin-top:4px}
</style>
</head>
<body>
<div class="form-box">
<h2>🚨 Report a Fake Account</h2>
<form action="/submit-report" method="POST">
<label>Platform</label>
<select name="platform" required>
<option value="">Select platform...</option>
<option>TikTok</option>
<option>Instagram</option>
<option>Facebook</option>
<option>YouTube</option>
<option>Twitter/X</option>
<option>Telegram</option>
<option>WhatsApp</option>
<option>Snapchat</option>
<option>Other</option>
</select>
<label>Fake Username</label>
<input type="text" name="username" placeholder="@fakeaccount" required>
<label>Fake Account Profile URL</label>
<input type="url" name="profileUrl" placeholder="https://tiktok.com/@fakeaccount">
<span class="help-text">Direct link to the fake profile</span>
<label>Screenshot / Proof Link (Imgur or similar)</label>
<input type="url" name="screenshot" placeholder="https://imgur.com/...">
<span class="help-text">Upload screenshot to imgur.com and paste link here</span>
<label>Additional Info (optional)</label>
<textarea name="reason" placeholder="Asking for money, using my photos, scamming fans..."></textarea>
<button type="submit">Submit Report</button>
</form>
<a href="/" class="back">← Back to main page</a>
</div>
</body>
</html>`;
}

function renderAdminPage(data) {
    const realList = data.realAccounts.map((a, i) =>
        `<tr>
            <td>${a.platform}</td>
            <td>${a.username}</td>
            <td><a href="${a.url}" target="_blank">${a.url}</a></td>
            <td><button class="del-btn" data-type="real" data-index="${i}">Delete</button></td>
        </tr>`
    ).join('');

    const fakeList = data.fakeAccounts.map((a, i) =>
        `<tr>
            <td>${a.platform}</td>
            <td>${a.username}</td>
            <td>${a.reason || ''}</td>
            <td>${a.profileUrl ? `<a href="${a.profileUrl}" target="_blank">Link</a>` : '-'}</td>
            <td>${a.screenshot ? `<a href="${a.screenshot}" target="_blank">📸</a>` : '-'}</td>
            <td><button class="del-btn" data-type="fake" data-index="${i}">Delete</button></td>
        </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh}
.header{background:#1a1a2e;padding:20px;text-align:center;border-bottom:2px solid #e94560}
.header h1{font-size:1.4em}
.container{max-width:1000px;margin:0 auto;padding:20px}
.section{margin:30px 0;background:#1a1a2e;border-radius:12px;padding:24px}
.section h2{margin-bottom:16px;color:#e94560;font-size:1.2em}
form{display:flex;flex-direction:column;gap:12px}
.row{display:flex;gap:12px;flex-wrap:wrap}
.row input,.row select{flex:1;min-width:150px}
input,select,textarea{padding:10px;border-radius:6px;border:1px solid #333;background:#0f0f0f;color:#fff;font-size:0.95em;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:#e94560}
textarea{resize:vertical;min-height:60px}
button{padding:10px 20px;background:#e94560;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600}
button:hover{background:#d63851}
.btn-green{background:#22c55e;color:#000}
.btn-green:hover{background:#1ea84e}
.btn-red{background:#ef4444}
.btn-red:hover{background:#dc2626}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:0.9em}
th,td{padding:10px;text-align:left;border-bottom:1px solid #333}
th{color:#888;font-size:0.85em}
td a{color:#60a5fa}
.del-btn{background:#ef4444;padding:6px 14px;font-size:0.85em}
.del-btn:hover{background:#dc2626}
.back-link{display:block;text-align:center;margin-top:20px;color:#888;text-decoration:none}
.back-link:hover{color:#fff}
hr{border:none;border-top:1px solid #333;margin:20px 0}
.help-text{font-size:0.75em;color:#888;margin-top:2px}
</style>
</head>
<body>
<div class="header">
<h1>⚙️ Admin Panel</h1>
</div>
<div class="container">

<div class="section">
<h2>Update Profile</h2>
<form action="/admin/update-profile" method="POST">
<input type="text" name="name" placeholder="Celebrity Name" value="${data.celebrity.name}">
<input type="text" name="photo" placeholder="Photo URL" value="${data.celebrity.photo}">
<input type="text" name="bio" placeholder="Short bio" value="${data.celebrity.bio}">
<button type="submit">Save Profile</button>
</form>
</div>

<div class="section">
<h2>Add Real Account</h2>
<form action="/admin/add-real" method="POST">
<div class="row">
<select name="platform">
<option>TikTok</option><option>Instagram</option><option>Facebook</option>
<option>YouTube</option><option>Twitter/X</option><option>Other</option>
</select>
<input type="text" name="username" placeholder="Username" required>
<input type="url" name="url" placeholder="Profile URL" required>
<button type="submit" class="btn-green">Add</button>
</div>
</form>
<table>${realList || '<tr><td colspan="4">No accounts yet</td></tr>'}</table>
</div>

<div class="section">
<h2>Add Fake Account</h2>
<form action="/admin/add-fake" method="POST">
<div class="row">
<select name="platform">
<option>TikTok</option><option>Instagram</option><option>Facebook</option>
<option>YouTube</option><option>Twitter/X</option><option>Telegram</option>
<option>WhatsApp</option><option>Snapchat</option><option>Other</option>
</select>
<input type="text" name="username" placeholder="Fake username" required>
</div>
<div class="row">
<input type="url" name="profileUrl" placeholder="Fake profile URL (for report button)">
<input type="url" name="screenshot" placeholder="Screenshot/Imgur link">
</div>
<textarea name="reason" placeholder="Reason (optional)"></textarea>
<button type="submit" class="btn-red">Add Fake Account</button>
</form>
<table>${fakeList || '<tr><td colspan="6">No fake accounts yet</td></tr>'}</table>
</div>

</div>
<a href="/" class="back-link">← View Public Page</a>

<script>
document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        if(!confirm('Delete this entry?')) return;
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
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(renderPage(data));
        }
        else if (pathname === '/report') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(renderReportPage());
        }
        else if (pathname === '/admin') {
            const data = readData();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(renderAdminPage(data));
        }
        else {
            res.writeHead(404);
            res.end('Not found');
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
                    reason: params.get('reason') || 'Impersonating'
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
                res.writeHead(404);
                res.end('Not found');
            }
        });
    }
    else {
        res.writeHead(405);
        res.end('Method not allowed');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Report page: http://localhost:${PORT}/report`);
});

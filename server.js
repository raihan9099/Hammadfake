const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;

const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const COVER_MUSIC_DIR = path.join(__dir, 'assets', 'covermusic');

[ASSETS_DIR, COVER_MUSIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const IMAGES = {
    profile: "/assets/tiktok_video_Aj2NO.jpeg",
    official: "/assets/1785276289604.png",
    fraud: "/assets/hammadfams.png",
    danger: "/assets/baillamach.png"
};

function getCoverSongs() {
    try {
        if (!fs.existsSync(COVER_MUSIC_DIR)) return [];
        const files = fs.readdirSync(COVER_MUSIC_DIR);
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus', '.weba'];
        const coverExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const groups = {};
        files.forEach(f => {
            const ext = path.extname(f).toLowerCase();
            const base = path.basename(f, ext);
            if (!groups[base]) groups[base] = { audio: null, cover: null };
            if (audioExts.includes(ext)) groups[base].audio = f;
            if (coverExts.includes(ext)) groups[base].cover = f;
        });
        return Object.entries(groups)
            .filter(([_, v]) => v.audio)
            .map(([base, v]) => ({
                id: base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                title: base.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                artist: 'Cover Song',
                audioUrl: `/assets/covermusic/${v.audio}`,
                coverUrl: v.cover ? `/assets/covermusic/${v.cover}` : null
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) { return []; }
}

// Simple admin credentials (hardcoded for now)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin123', 10);

async function verifyAdmin(u, p) {
    return u === ADMIN_USERNAME && await bcrypt.compare(p, ADMIN_PASSWORD_HASH);
}

const DATA = {
    celebrity: {
        name: "Baiilla Maach",
        fullName: "Baiilla Maach Official",
        photo: IMAGES.profile,
        bio: "Official Entertainment Profile",
        username: "@baiillamaach_official"
    },
    realAccounts: [
        { platform: "TikTok", username: "@baiillamaach_official", url: "https://tiktok.com/@baiillamaach_official", screenshot: IMAGES.official },
        { platform: "Facebook", username: "Baiilla Maach Official", url: "https://www.facebook.com/profile.php?id=61575202118828", screenshot: null }
    ],
    fakeAccounts: [
        { platform: "TikTok", username: "@baiilla_mach", profileUrl: "https://tiktok.com/@baiilla_mach", screenshot: IMAGES.danger, reason: "Copies official logo and content to deceive followers." },
        { platform: "TikTok", username: "@hammad_fams0", profileUrl: "https://tiktok.com/@hammad_fams0", screenshot: IMAGES.fraud, reason: "Uses official name and photo to mislead followers." }
    ]
};

const sessions = new Map();
function createSession(u) { const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { username: u, createdAt: Date.now() }); setTimeout(() => sessions.delete(id), 7200000); return id; }
function getSession(id) { const s = sessions.get(id); if (!s) return null; if (Date.now() - s.createdAt > 7200000) { sessions.delete(id); return null; } return s; }
function parseCookies(h) { const c = {}; if (h) h.split(';').forEach(x => { const p = x.split('='); c[p[0].trim()] = p[1] ? p[1].trim() : ''; }); return c; }

function getMainHTML() {
    const coverSongs = getCoverSongs();
    const totalFake = DATA.fakeAccounts.length;

    let coverSongsHTML = '';
    if (coverSongs.length > 0) {
        coverSongsHTML = `
        <section class="section music-section" data-animate>
            <div class="section-header">
                <div class="section-icon spotify-icon-bg">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
                <h2 class="section-heading">Cover Music</h2>
            </div>
            <div class="spotify-player">
                <div class="spotify-now-playing">
                    <div class="spotify-album-art" id="nowPlayingCover">
                        <div class="spotify-default-art">
                            <svg viewBox="0 0 24 24" width="56" height="56"><path fill="white" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                    </div>
                    <div class="spotify-track-info">
                        <div class="spotify-track-name" id="nowPlayingTitle">Select a song</div>
                        <div class="spotify-track-artist" id="nowPlayingArtist">Cover Songs Collection</div>
                        <div class="spotify-progress">
                            <div class="spotify-progress-bar" id="progressBar">
                                <div class="spotify-progress-fill" id="progressFill"></div>
                            </div>
                            <div class="spotify-time">
                                <span id="currentTime">0:00</span>
                                <span id="totalTime">0:00</span>
                            </div>
                        </div>
                        <div class="spotify-controls">
                            <button class="spotify-btn" onclick="prevSong()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                            </button>
                            <button class="spotify-btn spotify-play-btn" id="playPauseBtn" onclick="togglePlay()">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                                    <path id="playIcon" d="M8 5v14l11-7z"/>
                                    <path id="pauseIcon" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" style="display:none"/>
                                </svg>
                            </button>
                            <button class="spotify-btn" onclick="nextSong()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                            </button>
                        </div>
                        <div class="spotify-volume">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                            <input type="range" class="spotify-volume-slider" id="volumeSlider" min="0" max="100" value="70" onchange="setVol(this.value)">
                        </div>
                    </div>
                </div>
                <div class="spotify-playlist-container">
                    <div class="spotify-playlist-header">
                        <h3>Playlist</h3>
                        <span class="spotify-song-count">${coverSongs.length} songs</span>
                    </div>
                    <div class="spotify-playlist" id="playlist">
                        ${coverSongs.map((s, i) => `
                        <div class="spotify-playlist-item" data-index="${i}" data-audio="${s.audioUrl}" data-cover="${s.coverUrl || ''}" onclick="playSong(${i})">
                            <div class="spotify-track-number">${(i+1).toString().padStart(2,'0')}</div>
                            <div class="spotify-track-cover-small">${s.coverUrl ? `<img src="${s.coverUrl}" alt="" loading="lazy">` : '<div class="spotify-default-art-small"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="white" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>'}</div>
                            <div class="spotify-track-details">
                                <div class="spotify-track-title">${s.title}</div>
                                <div class="spotify-track-artist-small">${s.artist}</div>
                            </div>
                            <div class="spotify-equalizer">
                                <span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>
                            </div>
                        </div>`).join('')}
                    </div>
                </div>
            </div>
        </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Official Verification Hub for Baiilla Maach. Identify real vs fake accounts.">
<meta name="theme-color" content="#ffffff">
<title>${DATA.celebrity.fullName} | Official Verification Hub</title>
<style>
:root {
    --bg: #ffffff;
    --bg-secondary: #f8fafc;
    --text: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --border: #e2e8f0;
    --shadow: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.08);
    --shadow-xl: 0 20px 50px rgba(0,0,0,0.1);
    --green-50: #f0fdf4;
    --green-100: #dcfce7;
    --green-500: #22c55e;
    --green-600: #16a34a;
    --red-50: #fef2f2;
    --red-100: #fee2e2;
    --red-500: #ef4444;
    --red-600: #dc2626;
    --red-700: #b91c1c;
    --amber-50: #fffbeb;
    --amber-100: #fef3c7;
    --amber-600: #d97706;
    --blue-50: #eff6ff;
    --blue-100: #dbeafe;
    --blue-600: #2563eb;
    --blue-700: #1d4ed8;
    --pink: #ff0050;
    --cyan: #00f2ea;
    --fb: #1877f2;
    --spotify: #1db954;
    --spotify-black: #191414;
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-2xl: 24px;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    overflow-x: hidden;
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    50% { box-shadow: 0 0 0 16px rgba(34,197,94,0); }
}

@keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    50% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
}

@keyframes equalizer {
    0%, 100% { height: 4px; }
    50% { height: 14px; }
}

@keyframes typing {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}

[data-animate] { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
[data-animate].animated { opacity: 1; transform: translateY(0); }

.scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--pink), var(--cyan), var(--green-500));
    z-index: 10001;
    transition: width 0.1s;
}

.navbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 14px 0;
}

.navbar .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.navbar-logo-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid var(--pink);
    object-fit: cover;
}

.navbar-logo-text {
    font-weight: 700;
    font-size: 1.05em;
    color: var(--text);
}

.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

.hero {
    padding: 50px 0 36px;
    text-align: center;
}

.hero-img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 3px solid var(--pink);
    object-fit: cover;
    box-shadow: 0 0 0 6px rgba(255,0,80,0.08), 0 6px 24px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.hero-name {
    font-size: 2.4em;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
}

.hero-bio {
    font-size: 1.05em;
    color: var(--text-secondary);
    margin-bottom: 18px;
}

.hero-badges {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
}

.badge {
    padding: 7px 18px;
    border-radius: 22px;
    font-size: 0.82em;
    font-weight: 600;
    letter-spacing: 0.2px;
}

.badge-verified {
    background: linear-gradient(135deg, var(--green-500), var(--green-600));
    color: white;
    animation: pulse-green 2.5s infinite;
    display: flex;
    align-items: center;
    gap: 5px;
}

.badge-fun {
    background: linear-gradient(135deg, var(--pink), #ff6b00);
    color: white;
}

.hero-social {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
}

.social-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 24px;
    border-radius: 28px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.88em;
    transition: all 0.25s;
    border: 2px solid transparent;
}

.social-btn.tiktok { background: #000; color: #fff; }
.social-btn.tiktok:hover { background: #fff; color: #000; border-color: #000; transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.social-btn.facebook { background: var(--fb); color: #fff; }
.social-btn.facebook:hover { background: #fff; color: var(--fb); border-color: var(--fb); transform: translateY(-2px); box-shadow: var(--shadow-lg); }

.section { padding: 36px 0; }

.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
}

.section-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.verified-icon-bg { background: linear-gradient(135deg, var(--green-500), var(--green-600)); }
.danger-icon-bg { background: linear-gradient(135deg, var(--red-500), var(--red-600)); }
.spotify-icon-bg { background: linear-gradient(135deg, var(--spotify), #169c46); }

.section-heading {
    font-size: 1.35em;
    font-weight: 700;
    letter-spacing: -0.2px;
}

.official-card {
    background: linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #dcfce7 100%);
    border: 2px solid #bbf7d0;
    border-radius: var(--radius-2xl);
    padding: 32px;
    position: relative;
    box-shadow: var(--shadow-xl);
}

.official-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--green-500), var(--green-600));
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.official-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.official-verify-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, var(--green-500), var(--green-600));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-green 2.5s infinite;
    flex-shrink: 0;
}

.official-card-title h2 {
    font-size: 1.3em;
    font-weight: 700;
    color: #15803d;
}

.official-card-title span {
    font-size: 0.85em;
    color: var(--green-600);
    font-weight: 600;
}

.official-card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

@media (max-width: 700px) { .official-card-body { grid-template-columns: 1fr; } }

.official-info-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.official-info-item {
    background: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    border: 1px solid #dcfce7;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.official-info-label {
    font-size: 0.8em;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.official-info-value {
    font-weight: 700;
    color: var(--text);
}

.official-preview {
    background: #fff;
    border-radius: var(--radius-xl);
    padding: 24px;
    border: 1px solid var(--border);
    text-align: center;
}

.official-preview img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 3px solid var(--green-500);
    margin-bottom: 10px;
}

.official-preview .uname {
    font-size: 1.05em;
    font-weight: 700;
}

.official-preview .plat {
    font-size: 0.8em;
    color: var(--text-secondary);
    margin: 4px 0 16px;
}

.btn-follow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 28px;
    background: linear-gradient(135deg, var(--green-500), var(--green-600));
    color: #fff;
    border-radius: 28px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.9em;
    transition: all 0.25s;
    box-shadow: 0 4px 15px rgba(34,197,94,0.25);
}

.btn-follow:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(34,197,94,0.35); }

.fake-section {
    background: var(--red-50);
    border: 2px solid #fecaca;
    border-radius: var(--radius-2xl);
    padding: 28px;
}

.fake-alert {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fff;
    padding: 14px 18px;
    border-radius: var(--radius-lg);
    border: 2px solid #fecaca;
    margin-bottom: 20px;
}

.fake-alert-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, var(--red-500), var(--red-600));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3em;
    animation: pulse-red 2s infinite;
    flex-shrink: 0;
}

.fake-alert-text h3 { font-size: 1.1em; font-weight: 700; color: var(--red-700); }
.fake-alert-text p { font-size: 0.85em; color: var(--red-600); }

.fake-carousel { position: relative; overflow: hidden; border-radius: var(--radius-xl); }

.fake-carousel-track {
    display: flex;
    transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fake-slide { min-width: 100%; padding: 0 2px; }

.fake-card {
    background: #fff;
    border-radius: var(--radius-xl);
    border: 2px solid #fecaca;
    padding: 24px;
    position: relative;
}

.fake-card::after {
    content: 'FAKE';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 5em;
    font-weight: 900;
    color: rgba(239,68,68,0.03);
    pointer-events: none;
    letter-spacing: 15px;
}

.fake-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
}

.fake-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1em;
    font-weight: 700;
    color: var(--red-700);
}

.fake-card-badge {
    background: var(--red-500);
    color: #fff;
    padding: 3px 12px;
    border-radius: 16px;
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
}

.fake-card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

@media (max-width: 600px) { .fake-card-body { grid-template-columns: 1fr; } }

.fake-screenshot {
    position: relative;
    border-radius: var(--radius);
    overflow: hidden;
    border: 3px solid #fecaca;
}

.fake-screenshot img {
    width: 100%;
    display: block;
}

.fake-watermark {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    gap: 6px;
}

.fake-watermark span {
    background: rgba(239,68,68,0.85);
    color: #fff;
    padding: 5px 14px;
    border-radius: 14px;
    font-weight: 800;
    font-size: 0.8em;
    letter-spacing: 1.5px;
}

.fake-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.fake-detail-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--red-50);
    border-radius: 8px;
    font-size: 0.82em;
}

.fake-detail-label { color: var(--red-600); font-weight: 600; }
.fake-detail-value { color: var(--red-700); font-weight: 700; }

.fake-reason {
    background: #fff;
    border: 2px solid #fee2e2;
    border-radius: 10px;
    padding: 12px;
    margin-top: 6px;
    font-size: 0.82em;
    color: var(--red-700);
    line-height: 1.5;
}

.fake-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    flex-wrap: wrap;
}

.btn-report {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 10px 20px;
    background: linear-gradient(135deg, var(--red-500), var(--red-600));
    color: #fff;
    border-radius: 22px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.82em;
    transition: all 0.25s;
    flex: 1;
    justify-content: center;
    min-width: 120px;
}

.btn-report:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(239,68,68,0.3); }

.btn-copy {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 10px 20px;
    background: #fff;
    color: var(--red-600);
    border: 2px solid #fecaca;
    border-radius: 22px;
    font-weight: 700;
    font-size: 0.82em;
    cursor: pointer;
    transition: all 0.25s;
    flex: 1;
    justify-content: center;
    min-width: 120px;
}

.btn-copy:hover { background: var(--red-50); border-color: var(--red-500); }
.btn-copy.copied { background: var(--green-500) !important; color: #fff !important; border-color: var(--green-500) !important; }

.carousel-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
    margin-top: 16px;
}

.carousel-dots { display: flex; gap: 6px; }

.carousel-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #fecaca;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
}

.carousel-dot.active { background: var(--red-500); width: 24px; border-radius: 4px; }

.carousel-arrow {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1em;
    color: var(--text);
    transition: all 0.25s;
}

.carousel-arrow:hover { background: var(--red-500); color: #fff; border-color: var(--red-500); }

.spotify-player {
    background: var(--spotify-black);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-xl);
}

.spotify-now-playing {
    display: flex;
    gap: 20px;
    padding: 24px;
    background: linear-gradient(135deg, #282828, #191414);
}

@media (max-width: 680px) { .spotify-now-playing { flex-direction: column; align-items: center; text-align: center; } }

.spotify-album-art {
    width: 150px; height: 150px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
}

.spotify-album-art img { width: 100%; height: 100%; object-fit: cover; }

.spotify-default-art {
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--spotify), #169c46);
}

.spotify-track-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 180px;
}

.spotify-track-name {
    font-size: 1.3em;
    font-weight: 700;
    color: #fff;
    margin-bottom: 3px;
}

.spotify-track-artist {
    font-size: 0.85em;
    color: #b3b3b3;
    margin-bottom: 16px;
}

.spotify-progress { margin-bottom: 14px; }

.spotify-progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
    cursor: pointer;
    margin-bottom: 5px;
}

.spotify-progress-fill {
    height: 100%;
    background: var(--spotify);
    border-radius: 2px;
    width: 0%;
    transition: width 0.1s linear;
}

.spotify-time {
    display: flex;
    justify-content: space-between;
    font-size: 0.68em;
    color: #b3b3b3;
}

.spotify-controls {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
}

.spotify-btn {
    background: none;
    border: none;
    color: #b3b3b3;
    cursor: pointer;
    padding: 5px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spotify-btn:hover { color: #fff; transform: scale(1.1); }

.spotify-play-btn {
    background: #fff;
    color: #191414;
    width: 44px; height: 44px;
    border-radius: 50%;
}

.spotify-play-btn:hover { transform: scale(1.08); }

.spotify-volume {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #b3b3b3;
}

.spotify-volume-slider {
    width: 90px; height: 3px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
}

.spotify-volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
}

.spotify-playlist-container { max-height: 360px; overflow-y: auto; }

.spotify-playlist-header {
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background: #191414;
    z-index: 1;
}

.spotify-playlist-header h3 { font-size: 0.95em; font-weight: 700; color: #fff; }
.spotify-song-count { font-size: 0.75em; color: #b3b3b3; }

.spotify-playlist-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 1px solid rgba(255,255,255,0.03);
}

.spotify-playlist-item:hover { background: rgba(255,255,255,0.05); }
.spotify-playlist-item.active { background: rgba(29,185,84,0.1); }

.spotify-track-number {
    font-size: 0.8em;
    color: #b3b3b3;
    width: 24px;
    text-align: center;
    font-weight: 600;
}

.spotify-track-cover-small {
    width: 38px; height: 38px;
    border-radius: 5px;
    overflow: hidden;
    flex-shrink: 0;
    background: #282828;
}

.spotify-track-cover-small img { width: 100%; height: 100%; object-fit: cover; }

.spotify-default-art-small {
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--spotify), #169c46);
}

.spotify-track-details { flex: 1; min-width: 0; }

.spotify-track-title {
    font-weight: 600;
    font-size: 0.84em;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.spotify-track-artist-small { font-size: 0.72em; color: #b3b3b3; }

.spotify-equalizer { display: none; gap: 2px; align-items: flex-end; height: 16px; }

.spotify-playlist-item.active .spotify-equalizer { display: flex; }

.eq-bar {
    width: 3px;
    background: var(--spotify);
    border-radius: 1px;
    animation: equalizer 0.8s infinite;
}

.eq-bar:nth-child(1) { animation-delay: 0s; }
.eq-bar:nth-child(2) { animation-delay: 0.2s; }
.eq-bar:nth-child(3) { animation-delay: 0.4s; }
.eq-bar:nth-child(4) { animation-delay: 0.6s; }

.typing-indicator {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--spotify-black);
    color: #fff;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 0.9em;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.typing-indicator.active {
    opacity: 1;
}

.typing-dots {
    display: flex;
    gap: 4px;
}

.typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--spotify);
    animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

.footer {
    text-align: center;
    padding: 36px 20px;
    color: var(--text-muted);
    font-size: 0.85em;
    border-top: 1px solid var(--border);
    margin-top: 36px;
    background: var(--bg-secondary);
}

@media (max-width: 768px) {
    .hero-name { font-size: 1.8em; }
    .hero-img { width: 100px; height: 100px; }
    .section-heading { font-size: 1.2em; }
    .official-card { padding: 22px; }
    .spotify-album-art { width: 120px; height: 120px; }
}
</style>
</head>
<body>

<div class="scroll-progress" id="scrollProgress"></div>
<div class="typing-indicator" id="typingIndicator">
    <span>Loading content</span>
    <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    </div>
</div>

<nav class="navbar">
    <div class="container">
        <img src="${DATA.celebrity.photo}" alt="" class="navbar-logo-img" onerror="this.style.display='none'">
        <span class="navbar-logo-text">Verification Hub</span>
    </div>
</nav>

<header class="hero" data-animate>
    <div class="container">
        <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="hero-img" onerror="this.style.display='none'">
        <h1 class="hero-name">${DATA.celebrity.fullName}</h1>
        <p class="hero-bio">${DATA.celebrity.bio}</p>
        <div class="hero-badges">
            <span class="badge badge-verified">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                VERIFIED OFFICIAL
            </span>
            <span class="badge badge-fun">✦ ENTERTAINMENT</span>
        </div>
        <div class="hero-social">
            <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="social-btn tiktok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.89a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                TikTok
            </a>
            <a href="https://www.facebook.com/profile.php?id=61575202118828" target="_blank" rel="noopener" class="social-btn facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
            </a>
        </div>
    </div>
</header>

<main class="container">

<section class="section" data-animate>
    <div class="section-header">
        <div class="section-icon verified-icon-bg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        </div>
        <h2 class="section-heading">Official Verified Account</h2>
    </div>

    <div class="official-card">
        <div class="official-card-header">
            <div class="official-verify-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <div class="official-card-title">
                <h2>The Only Authentic Account</h2>
                <span>✓ Identity Verified</span>
            </div>
        </div>
        <div class="official-card-body">
            <div class="official-info-list">
                <div class="official-info-item">
                    <span class="official-info-label">Username</span>
                    <span class="official-info-value">@baiillamaach_official</span>
                </div>
                <div class="official-info-item">
                    <span class="official-info-label">Platforms</span>
                    <span class="official-info-value">TikTok • Facebook</span>
                </div>
                <div class="official-info-item">
                    <span class="official-info-label">Status</span>
                    <span class="official-info-value" style="color:var(--green-600)">● Active & Verified</span>
                </div>
                <div class="official-info-item">
                    <span class="official-info-label">Security</span>
                    <span class="official-info-value" style="color:var(--green-600)">Safe</span>
                </div>
            </div>
            <div class="official-preview">
                <img src="${DATA.celebrity.photo}" alt="" onerror="this.style.display='none'">
                <div class="uname">@baiillamaach_official</div>
                <div class="plat">TikTok • Facebook</div>
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank" rel="noopener" class="btn-follow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                    Follow Official Account
                </a>
            </div>
        </div>
    </div>
</section>

<section class="fake-section" data-animate>
    <div class="section-header">
        <div class="section-icon danger-icon-bg">
            <span style="font-size:1.3em">⚠</span>
        </div>
        <h2 class="section-heading">Fake Accounts Detected</h2>
    </div>

    <div class="fake-alert">
        <div class="fake-alert-icon">🚨</div>
        <div class="fake-alert-text">
            <h3>${totalFake} Fake Account${totalFake > 1 ? 's' : ''} Found</h3>
            <p>These are NOT affiliated with Baiilla Maach. Report them immediately.</p>
        </div>
    </div>

    <div class="fake-carousel" id="fakeCarousel">
        <div class="fake-carousel-track" id="fakeCarouselTrack">
            ${DATA.fakeAccounts.map((a, i) => `
            <div class="fake-slide">
                <div class="fake-card">
                    <div class="fake-card-top">
                        <div class="fake-card-title">
                            <span>⚠️</span> Fake Account #${i+1}
                        </div>
                        <span class="fake-card-badge">Dangerous</span>
                    </div>
                    <div class="fake-card-body">
                        <div class="fake-screenshot">
                            ${a.screenshot ? `<img src="${a.screenshot}" alt="" loading="lazy">` : ''}
                            <div class="fake-watermark">
                                <span>⚠️ FAKE</span>
                                <span style="font-size:0.65em">DO NOT TRUST</span>
                            </div>
                        </div>
                        <div class="fake-details">
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Platform</span>
                                <span class="fake-detail-value">${a.platform}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Username</span>
                                <span class="fake-detail-value">${a.username}</span>
                            </div>
                            <div class="fake-detail-row">
                                <span class="fake-detail-label">Status</span>
                                <span class="fake-detail-value">Active Threat</span>
                            </div>
                            <div class="fake-reason">
                                <span>⚠️ ${a.reason}</span>
                            </div>
                        </div>
                    </div>
                    <div class="fake-actions">
                        <a href="${a.profileUrl}" target="_blank" rel="noopener" class="btn-report">🚨 Report</a>
                        <button class="btn-copy copy-btn" data-username="${a.username}">📋 Copy Username</button>
                    </div>
                </div>
            </div>`).join('')}
        </div>
    </div>

    <div class="carousel-nav">
        <button class="carousel-arrow" onclick="moveCarousel(-1)">◀</button>
        <div class="carousel-dots" id="carouselDots">
            ${DATA.fakeAccounts.map((_, i) => `<button class="carousel-dot${i===0?' active':''}" onclick="goToSlide(${i})"></button>`).join('')}
        </div>
        <button class="carousel-arrow" onclick="moveCarousel(1)">▶</button>
    </div>
</section>

${coverSongsHTML}

</main>

<footer class="footer">
    <p>© ${DATA.celebrity.fullName} • Official Verification Hub</p>
</footer>

<audio id="audioPlayer" preload="auto"></audio>

<script>
// Scroll-based animation with typing indicator
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('animated');
            }, 200);
        } else if (entry.boundingClientRect.top > window.innerHeight) {
            // Remove animation when scrolling up past the element
            entry.target.classList.remove('animated');
        }
    });
}, { 
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// Typing indicator logic
let scrollTimeout;
const typingIndicator = document.getElementById('typingIndicator');
let lastScrollTop = 0;
let isScrollingDown = false;

window.addEventListener('scroll', () => {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollBottom = scrollHeight - clientHeight - currentScrollTop;
    
    // Update progress bar
    const pct = (currentScrollTop / (scrollHeight - clientHeight)) * 100;
    document.getElementById('scrollProgress').style.width = pct + '%';
    
    // Determine scroll direction
    isScrollingDown = currentScrollTop > lastScrollTop;
    lastScrollTop = currentScrollTop;
    
    // Show typing indicator when near bottom
    if (scrollBottom < 300 && isScrollingDown) {
        typingIndicator.classList.add('active');
    } else {
        typingIndicator.classList.remove('active');
    }
    
    // Clear previous timeout
    clearTimeout(scrollTimeout);
    
    // Remove animations when scrolling up significantly
    if (!isScrollingDown && currentScrollTop < lastScrollTop - 50) {
        document.querySelectorAll('[data-animate].animated').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top > window.innerHeight) {
                el.classList.remove('animated');
            }
        });
    }
    
    // Set timeout to hide indicator after scrolling stops
    scrollTimeout = setTimeout(() => {
        typingIndicator.classList.remove('active');
    }, 1000);
});

let currentSlide = 0;
const totalSlides = ${totalFake};
const track = document.getElementById('fakeCarouselTrack');
const dots = document.querySelectorAll('.carousel-dot');
let autoSlide;

function updateCarousel() {
    track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

function moveCarousel(dir) {
    currentSlide = (currentSlide + dir + totalSlides) % totalSlides;
    updateCarousel();
    clearInterval(autoSlide);
    autoSlide = setInterval(() => moveCarousel(1), 5000);
}

function goToSlide(i) {
    currentSlide = i;
    updateCarousel();
    clearInterval(autoSlide);
    autoSlide = setInterval(() => moveCarousel(1), 5000);
}

autoSlide = setInterval(() => moveCarousel(1), 5000);

const carousel = document.getElementById('fakeCarousel');
let touchX = 0;
carousel.addEventListener('touchstart', e => { touchX = e.changedTouches[0].screenX; });
carousel.addEventListener('touchend', e => {
    const diff = touchX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 40) moveCarousel(diff > 0 ? 1 : -1);
});

document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.username).then(() => {
            this.innerHTML = '✓ Copied!';
            this.classList.add('copied');
            setTimeout(() => { this.innerHTML = '📋 Copy Username'; this.classList.remove('copied'); }, 2000);
        });
    });
});

let cur = -1, playing = false, ap = document.getElementById('audioPlayer'), items = document.querySelectorAll('.spotify-playlist-item');

function loadSong(i) {
    if (!items.length || i < 0 || i >= items.length) return;
    cur = i; const it = items[i];
    ap.src = it.dataset.audio;
    document.getElementById('nowPlayingTitle').textContent = it.querySelector('.spotify-track-title').textContent;
    document.getElementById('nowPlayingArtist').textContent = it.querySelector('.spotify-track-artist-small').textContent;
    const cc = document.getElementById('nowPlayingCover');
    if (it.dataset.cover) {
        cc.innerHTML = '<img src="' + it.dataset.cover + '" alt="">';
    } else {
        cc.innerHTML = '<div class="spotify-default-art"><svg viewBox="0 0 24 24" width="56" height="56"><path fill="white" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>';
    }
    document.querySelectorAll('.spotify-playlist-item').forEach(el => el.classList.remove('active'));
    it.classList.add('active');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('totalTime').textContent = '0:00';
    ap.play().then(() => { playing = true; upPlayBtn(); }).catch(() => {});
}

function playSong(i) { if (i === cur) togglePlay(); else loadSong(i); }

function togglePlay() {
    if (!ap.src && items.length > 0) { loadSong(0); return; }
    if (playing) ap.pause(); else ap.play();
    playing = !playing; upPlayBtn();
}

function upPlayBtn() {
    document.getElementById('playIcon').style.display = playing ? 'none' : 'block';
    document.getElementById('pauseIcon').style.display = playing ? 'block' : 'none';
}

function nextSong() { if (items.length) loadSong((cur + 1) % items.length); }
function prevSong() { if (items.length) loadSong(cur <= 0 ? items.length - 1 : cur - 1); }
function setVol(v) { ap.volume = v / 100; }

ap.addEventListener('timeupdate', () => {
    if (ap.duration) {
        document.getElementById('progressFill').style.width = (ap.currentTime / ap.duration) * 100 + '%';
        const m = Math.floor(ap.currentTime / 60), s = Math.floor(ap.currentTime % 60);
        document.getElementById('currentTime').textContent = m + ':' + s.toString().padStart(2, '0');
    }
});

ap.addEventListener('loadedmetadata', () => {
    const m = Math.floor(ap.duration / 60), s = Math.floor(ap.duration % 60);
    document.getElementById('totalTime').textContent = m + ':' + s.toString().padStart(2, '0');
});

ap.addEventListener('ended', nextSong);

document.getElementById('progressBar').addEventListener('click', e => {
    const r = e.target.getBoundingClientRect();
    ap.currentTime = ((e.clientX - r.left) / r.width) * ap.duration;
});

ap.volume = 0.7;
</script>
</body>
</html>`;
}

function getAdminLoginHTML(error = '') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.08)}h2{text-align:center;color:#ff0050;margin-bottom:30px}.fg{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#475569;font-weight:600;font-size:.9em}input{width:100%;padding:12px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:1em;outline:none}input:focus{border-color:#ff0050}.btn{width:100%;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;font-size:1em;font-weight:600;cursor:pointer}.btn:hover{background:#d90040}.error{background:#fef2f2;border:2px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center}.back{text-align:center;margin-top:20px}a{color:#64748b;text-decoration:none}a:hover{color:#ff0050}</style></head><body><div class="box"><h2>Admin Login</h2>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/admin/login"><div class="fg"><label>Username</label><input type="text" name="username" required></div><div class="fg"><label>Password</label><input type="password" name="password" required></div><button type="submit" class="btn">Login</button></form><div class="back"><a href="/">Back to Home</a></div></div></body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    if (pathname.startsWith('/assets/')) {
        const assetPath = path.join(__dir, pathname);
        if (!assetPath.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac','.wma':'audio/x-ms-wma','.opus':'audio/opus','.weba':'audio/webm' };
            const ct = types[ext] || 'application/octet-stream';
            const stat = fs.statSync(assetPath);
            res.writeHead(200, { 'Content-Type':ct, 'Content-Length':stat.size, 'Cache-Control':'public, max-age=86400', 'Accept-Ranges':'bytes' });
            fs.createReadStream(assetPath).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }

    if (pathname === '/admin' && req.method === 'GET') {
        const s = getSession(cookies.sessionId);
        if (s) {
            res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
            res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admin</title><style>body{font-family:sans-serif;background:#f8fafc;padding:40px;text-align:center}a{color:#ff0050}</style></head><body><h2>Welcome Admin</h2><p>You are logged in.</p><a href="/admin/logout">Logout</a> | <a href="/">Home</a></body></html>`);
            return;
        }
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML()); return;
    }

    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = ''; req.on('data',c=>body+=c); req.on('end',async()=>{
            const params = new URLSearchParams(body);
            if (await verifyAdmin(params.get('username'),params.get('password'))) {
                const sid = createSession(params.get('username'));
                res.writeHead(302,{'Location':'/admin','Set-Cookie':`sessionId=${sid};HttpOnly;Path=/;Max-Age=7200;SameSite=Lax`}); res.end();
            } else { res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}); res.end(getAdminLoginHTML('Invalid credentials')); }
        }); return;
    }

    if (pathname === '/admin/logout') { sessions.delete(cookies.sessionId); res.writeHead(302,{'Location':'/admin','Set-Cookie':'sessionId=;HttpOnly;Path=/;Max-Age=0'}); res.end(); return; }

    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=3600'});
        res.end(getMainHTML());
        return;
    }

    res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:100px;color:#ff0050}</style></head><body><div><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></div></body></html>`);
});

server.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });

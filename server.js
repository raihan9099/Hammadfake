/* ============================================================
   FACEBOOK-STYLE UI — Clean, Neutral, Full-Width
   No gradients, no glass, no bright colors
============================================================ */

:root {
  --primary: #1877F2;
  --primary-hover: #166FE5;
  --primary-light: #EBF5FF;
  --danger: #FA383E;
  --success: #42B72A;
  --warning: #F7B928;
  --dark: #1C1E21;

  --bg-page: #F0F2F5;
  --bg-card: #FFFFFF;
  --bg-hover: #F2F2F2;
  --bg-input: #F0F2F5;

  --text-primary: #1C1E21;
  --text-secondary: #65676B;
  --text-muted: #8A8D91;
  --text-link: #1877F2;

  --border: #CED0D4;
  --border-light: #E4E6EB;
  --divider: #E4E6EB;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
  --shadow-md: 0 1px 2px rgba(0,0,0,0.1);
  --shadow-lg: 0 2px 12px rgba(0,0,0,0.2);

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-pill: 999px;
  --radius-round: 50%;

  --font: -apple-system, BlinkMacSystemFont, "Segoe UI Historic", "Segoe UI", Helvetica, Arial, sans-serif;
  --font-size: 15px;
  --font-sm: 13px;
  --font-xs: 12px;
  --font-lg: 17px;
  --font-h1: 24px;
  --font-h2: 20px;
  --font-h3: 17px;
  --line-height: 1.3333;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  --transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

/* ==================== RESET ==================== */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: var(--font);
  font-size: var(--font-size);
  line-height: var(--line-height);
  background: var(--bg-page);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body::before, body::after { display: none; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ==================== PAGE WRAPPERS ==================== */
.page-home, .page-admin { min-height: 100vh; display: flex; flex-direction: column; }
.page-admin .app { flex: 1; display: flex; flex-direction: column; }

/* ==================== HEADER ==================== */
.header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  padding: 0 var(--space-md);
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
}

.header-left { display: flex; align-items: center; gap: var(--space-sm); }

.header-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.header-name {
  font-weight: 700;
  font-size: var(--font-lg);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

/* ==================== BUTTONS ==================== */
.btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: var(--font-size);
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: var(--transition);
  text-decoration: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
  min-height: 36px;
}

.btn:hover { background: var(--bg-hover); }
.btn:active { transform: scale(0.98); }

.btn-gradient { background: var(--primary); color: white; }
.btn-gradient:hover { background: var(--primary-hover); }

.btn-danger { background: var(--danger); color: white; }
.btn-danger:hover { background: #E32F35; }

.btn-success { background: var(--success); color: white; }
.btn-success:hover { background: #3AA624; }

.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn-outline:hover { background: var(--bg-hover); }

.btn-sm { padding: 4px 12px; font-size: var(--font-sm); min-height: 28px; }
.btn-lg { padding: 12px 24px; font-size: var(--font-lg); min-height: 44px; }

/* ==================== CONTAINERS ==================== */
.container, .container-full {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: var(--space-md);
}

/* ==================== CARDS ==================== */
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-md);
  overflow: hidden;
  border: 1px solid var(--border-light);
  transition: box-shadow 0.15s ease;
}

.card:hover { box-shadow: var(--shadow-md); }

.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
}

.card-header {
  padding: var(--space-md);
  border-bottom: 1px solid var(--divider);
  position: relative;
}

.card-header::before { display: none; }

.card-body { padding: var(--space-md); }

/* ==================== BADGES ==================== */
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.badge-gradient { background: var(--primary-light); color: var(--primary); }
.badge-danger { background: #FFEBEE; color: var(--danger); }
.badge-success { background: #E7F3E4; color: var(--success); }

h3 {
  font-size: var(--font-h3);
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
  line-height: var(--line-height);
}

p {
  color: var(--text-secondary);
  font-size: var(--font-sm);
  line-height: var(--line-height);
}

/* ==================== PROFILE ==================== */
.profile-card { text-align: center; padding: 0; }

.profile-cover {
  height: 180px;
  background: var(--primary-light);
  position: relative;
  overflow: hidden;
}
.profile-cover::after { display: none; }

.profile-avatar-wrap {
  margin-top: -60px;
  position: relative;
  display: inline-block;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid var(--bg-card);
  object-fit: cover;
  box-shadow: var(--shadow-sm);
}

.verified-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: var(--primary);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-card);
}
.verified-badge svg { width: 14px; height: 14px; fill: white; }

.profile-name {
  font-size: var(--font-h1);
  font-weight: 700;
  margin-top: var(--space-sm);
  color: var(--text-primary);
  line-height: 1.2;
}

.profile-username {
  color: var(--text-secondary);
  font-size: var(--font-size);
  margin-bottom: 4px;
  font-weight: 400;
}

.profile-bio {
  color: var(--text-secondary);
  font-size: var(--font-size);
  margin-bottom: var(--space-md);
  padding: 0 var(--space-md);
  line-height: var(--line-height);
}

/* ==================== STATS ==================== */
.stats-row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-lg);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  margin-bottom: var(--space-md);
}

.stat { text-align: center; }

.stat-num {
  font-size: var(--font-h3);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  font-weight: 400;
}

/* ==================== BUTTON GROUPS ==================== */
.btn-group {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  justify-content: center;
  padding: var(--space-md);
}

/* ==================== GIF STRIP ==================== */
.gif-strip {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  justify-content: center;
  flex-wrap: wrap;
}

.gif-item { text-align: center; cursor: pointer; }

.gif-item img {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  object-fit: cover;
}
.gif-item span {
  display: block;
  font-size: var(--font-xs);
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 500;
}

/* ==================== GRIDS ==================== */
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

/* ==================== VERIFIED ITEMS ==================== */
.verified-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: transparent;
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease;
  border: 1px solid var(--border-light);
  flex-wrap: wrap;
}
.verified-item:hover { background: var(--bg-hover); border-color: var(--border); }

.verified-item .v-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.verified-item .v-info { flex: 1; min-width: 0; }
.verified-item .v-info h4 {
  font-weight: 600;
  font-size: var(--font-size);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.verified-item .v-info h4 img { width: 16px; height: 16px; }
.verified-item .v-info .v-handle {
  font-size: var(--font-sm);
  color: var(--text-link);
  font-weight: 500;
}
.verified-item .v-info .v-detail {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  margin-top: 4px;
  word-break: break-word;
}

/* ==================== FAKE CARDS ==================== */
.fake-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color 0.15s ease;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
}
.fake-card:hover { border-color: var(--danger); }

.fake-img-wrap {
  position: relative;
  text-align: center;
  padding: var(--space-sm);
  background: var(--bg-hover);
}
.fake-img { max-width: 100%; border-radius: var(--radius-sm); }
.fake-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
}
.fake-body {
  padding: var(--space-md);
  flex: 1;
  display: flex;
  flex-direction: column;
}
.fake-body h4 {
  font-weight: 600;
  font-size: var(--font-size);
  color: var(--text-primary);
}
.fake-body .platform {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: var(--font-sm);
  margin: 4px 0;
}
.fake-body p {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
  flex: 1;
}

/* ==================== PROOF GRID ==================== */
.proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-sm);
}
.proof-grid-single { grid-template-columns: 1fr; }

.proof-item {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  text-align: center;
  transition: border-color 0.15s ease;
  cursor: pointer;
}
.proof-item:hover { border-color: var(--border); background: var(--bg-hover); }

.proof-item img {
  width: 100%;
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-sm);
}
.proof-item .label {
  font-weight: 600;
  font-size: var(--font-sm);
  color: var(--text-primary);
}

/* ==================== MUSIC ==================== */
.music-section { padding: var(--space-md); }

.music-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--bg-hover);
  border-radius: var(--radius-md);
}

.music-cover {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.music-info { flex: 1; min-width: 0; }
.music-title {
  font-weight: 600;
  font-size: var(--font-size);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.music-artist {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.music-slider {
  width: 100%;
  height: 4px;
  background: var(--border-light);
  border-radius: 2px;
  cursor: pointer;
  margin: var(--space-md) 0;
  position: relative;
  transition: height 0.15s ease;
}
.music-slider:hover { height: 6px; }

.music-slider-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  width: 0;
  transition: width 0.1s;
}

.music-time-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-xs);
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
  font-weight: 500;
}

.music-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
}

.music-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.music-btn-nav { background: var(--bg-hover); color: var(--text-primary); }
.music-btn-nav:hover { background: var(--border-light); }

.music-btn-play {
  background: var(--primary);
  color: white;
  width: 48px;
  height: 48px;
  font-size: 18px;
}
.music-btn-play:hover { background: var(--primary-hover); }
.music-btn-play:active { transform: scale(0.95); }

.music-list {
  max-height: 280px;
  overflow-y: auto;
  margin-top: var(--space-md);
}

.song-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s ease;
}
.song-item:hover { background: var(--bg-hover); }
.song-item.active {
  background: var(--primary-light);
  border-left: 3px solid var(--primary);
}

.song-num {
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 20px;
  font-size: var(--font-sm);
}
.song-thumb {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
}
.song-info { flex: 1; min-width: 0; }
.song-title {
  font-weight: 500;
  font-size: var(--font-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.song-artist {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}
.song-play { color: var(--primary); font-size: 12px; }

/* ==================== CHAT WIDGET ==================== */
.chat-widget {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
}

.chat-toggle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  border: none;
  font-size: 22px;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  transition: background-color 0.15s ease;
}
.chat-toggle:hover { background: var(--primary-hover); }
.chat-toggle:active { transform: scale(0.95); }

.chat-panel {
  display: none;
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: min(400px, calc(100vw - 32px));
  height: min(540px, calc(100vh - 120px));
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
  border: 1px solid var(--border-light);
}
.chat-panel.open { display: flex; }

.chat-head {
  padding: var(--space-md);
  background: var(--bg-card);
  border-bottom: 1px solid var(--divider);
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: var(--font-lg);
}

.chat-head button {
  background: var(--bg-hover);
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: background-color 0.15s ease;
}
.chat-head button:hover { background: var(--border-light); }

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  background: var(--bg-card);
}
.chat-login { text-align: center; padding: var(--space-sm); }

.chat-login input {
  width: 100%;
  padding: 10px 14px;
  margin-bottom: var(--space-sm);
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  font-size: var(--font-size);
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s ease;
}
.chat-login input:focus { border-color: var(--primary); }

.chat-login button {
  width: 100%;
  padding: 10px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: var(--font-size);
  font-family: var(--font);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.chat-login button:hover { background: var(--primary-hover); }

.chat-input-area {
  padding: var(--space-sm);
  border-top: 1px solid var(--divider);
  display: none;
  background: var(--bg-card);
}
.chat-input-row { display: flex; align-items: center; gap: var(--space-sm); }

.chat-input-row input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  border-radius: var(--radius-pill);
  font-size: var(--font-size);
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s ease;
}
.chat-input-row input:focus { border-color: var(--primary); background: var(--bg-card); }

.chat-input-row button {
  background: var(--primary);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.chat-input-row button:hover { background: var(--primary-hover); }
.chat-input-row button:active { transform: scale(0.95); }

/* ==================== MESSAGES ==================== */
.msg {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 18px;
  margin-bottom: 4px;
  font-size: var(--font-size);
  line-height: var(--line-height);
  word-wrap: break-word;
}
.msg.user {
  background: var(--primary);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}
.msg.admin {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}
.msg .time {
  font-size: var(--font-xs);
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
}

/* ==================== LOGIN ==================== */
.login-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-md);
}

.login-card {
  background: var(--bg-card);
  padding: var(--space-xl);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 420px;
  text-align: center;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-light);
}

.login-card h2 {
  font-weight: 700;
  margin-bottom: var(--space-sm);
  font-size: var(--font-h2);
  color: var(--text-primary);
}
.login-card .sub {
  color: var(--text-secondary);
  font-size: var(--font-sm);
  margin-bottom: var(--space-lg);
}

.login-card input {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: var(--space-sm);
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  font-size: var(--font-size);
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s ease;
}
.login-card input:focus { border-color: var(--primary); }

.login-card button {
  width: 100%;
  padding: 12px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  font-size: var(--font-size);
  font-family: var(--font);
  transition: background-color 0.15s ease;
}
.login-card button:hover { background: var(--primary-hover); }
.login-card button:active { transform: scale(0.98); }
.login-card button:disabled { opacity: 0.6; cursor: not-allowed; }

.error {
  color: var(--danger);
  font-size: var(--font-sm);
  margin-top: var(--space-sm);
  display: none;
}

/* ==================== ADMIN LAYOUT ==================== */
.app { display: none; height: 100vh; }

.layout, .layout-full {
  display: flex;
  height: 100vh;
  width: 100%;
  max-width: 100%;
  margin: 0;
  background: var(--bg-card);
}

.sidebar {
  width: clamp(280px, 30vw, 420px);
  flex-shrink: 0;
  border-right: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  min-width: 0;
}

.sidebar-head {
  padding: var(--space-md);
  background: var(--bg-card);
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  border-bottom: 1px solid var(--divider);
}
.sidebar-head h2 {
  font-size: var(--font-h3);
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-head button {
  background: var(--bg-hover);
  color: var(--text-primary);
  border: none;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: var(--font-sm);
  font-family: var(--font);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.sidebar-head button:hover { background: var(--border-light); }

.search-box {
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  border-bottom: 1px solid var(--divider);
}

.search-box input {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  border-radius: var(--radius-pill);
  font-size: var(--font-sm);
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s ease;
}
.search-box input:focus { border-color: var(--primary); background: var(--bg-card); }

.user-list { flex: 1; overflow-y: auto; }

.user-item {
  padding: 10px var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  border-bottom: 1px solid var(--divider);
  transition: background-color 0.15s ease;
  background: var(--bg-card);
}
.user-item:hover { background: var(--bg-hover); }
.user-item.active {
  background: var(--primary-light);
  border-left: 3px solid var(--primary);
}

.user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  flex-shrink: 0;
  font-size: var(--font-lg);
}

.user-info { flex: 1; min-width: 0; }
.user-info .name {
  font-weight: 600;
  font-size: var(--font-size);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-info .email {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread {
  background: var(--primary);
  color: white;
  font-size: var(--font-xs);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-card);
}

.chat-head {
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  border-bottom: 1px solid var(--divider);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.chat-head .avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: var(--font-lg);
  flex-shrink: 0;
}
.chat-head .name {
  font-weight: 600;
  font-size: var(--font-size);
  color: var(--text-primary);
}
.chat-head .status { font-size: var(--font-sm); }
.chat-head .status.online { color: var(--success); font-weight: 500; }
.chat-head .status.offline { color: var(--text-secondary); }

.chat-msgs {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  background: var(--bg-page);
}

.msg.sent {
  background: var(--primary);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}
.msg.received {
  background: var(--bg-card);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
  box-shadow: var(--shadow-sm);
}

.chat-input {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--divider);
  display: none;
  background: var(--bg-card);
}
.chat-input-row { display: flex; align-items: center; gap: var(--space-sm); }
.chat-input-row input {
  flex: 1;
  padding: 10px 20px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  border-radius: var(--radius-pill);
  font-size: var(--font-size);
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s ease;
}
.chat-input-row input:focus { border-color: var(--primary); background: var(--bg-card); }

.chat-input-row button {
  background: var(--primary);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-input-row button:hover { background: var(--primary-hover); }
.chat-input-row button:active { transform: scale(0.95); }

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  padding: 48px 20px;
}
.empty-state h3 { color: var(--text-primary); margin-bottom: 4px; }
.empty-state p { font-size: var(--font-sm); }

/* ==================== RESPONSIVE ==================== */
@media (max-width: 480px) {
  .header { padding: 0 var(--space-sm); height: 52px; }
  .profile-name { font-size: 20px; }
  .stats-row { gap: var(--space-md); }
  .chat-panel { width: calc(100vw - 16px); right: 8px; bottom: 76px; height: calc(100vh - 96px); }
  .btn { padding: 6px 14px; font-size: var(--font-sm); }
  .card-body { padding: var(--space-sm); }
  .msg { max-width: 88%; }
}

@media (max-width: 768px) {
  .layout {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }
  .sidebar {
    width: 100%;
    max-height: 45vh;
    border-right: none;
    border-bottom: 1px solid var(--divider);
  }
  .chat-area { flex: 1; min-height: 55vh; }
  .layout-full { height: auto; min-height: 100vh; }
}

@media (min-width: 1400px) {
  .container-full {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(560px, 1fr));
    gap: var(--space-md);
    align-items: start;
  }
  .container-full > .profile-card { grid-column: 1 / -1; }
  .container-full > .card { margin-bottom: 0; }
}

@media (min-width: 2200px) {
  .container-full {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 2400px;
    margin: 0 auto;
  }
}

/* ==================== ACCESSIBILITY ==================== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

::selection {
  background: var(--primary-light);
  color: var(--text-primary);
}

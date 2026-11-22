/* ============================================================
   DARK SPACE PREMIUM — Three.js particles behind glass cards
============================================================ */

:root {
  --bg-deep: #0A0E27;
  --bg-space: #0F1535;
  --bg-card: rgba(15, 21, 53, 0.55);
  --bg-card-hover: rgba(20, 28, 68, 0.7);
  --bg-input: rgba(255, 255, 255, 0.05);
  --bg-hover: rgba(255, 255, 255, 0.08);

  --text: #FFFFFF;
  --text-secondary: #A8B0D8;
  --text-tertiary: #6B7394;

  --border: rgba(120, 150, 255, 0.15);
  --border-bright: rgba(120, 150, 255, 0.3);
  --border-glow: rgba(74, 227, 255, 0.5);

  --cyan: #4AE3FF;
  --cyan-glow: rgba(74, 227, 255, 0.5);
  --purple: #9D6BFF;
  --purple-glow: rgba(157, 107, 255, 0.5);
  --pink: #FF6BCB;
  --pink-glow: rgba(255, 107, 203, 0.5);

  --gradient-primary: linear-gradient(135deg, #4A90FF 0%, #9D6BFF 100%);
  --gradient-glow: linear-gradient(135deg, #4AE3FF 0%, #9D6BFF 50%, #FF6BCB 100%);

  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.6);

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 24px;
  --radius-pill: 999px;

  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.6;
  background: #0A0E27;
  background-image:
    radial-gradient(ellipse at top left, rgba(26, 43, 122, 0.6) 0%, transparent 50%),
    radial-gradient(ellipse at top right, rgba(42, 26, 94, 0.6) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(61, 26, 94, 0.6) 0%, transparent 50%);
  background-attachment: fixed;
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ============ HEADER ============ */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 14, 39, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--border);
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-logo {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 20px var(--cyan-glow);
}
.header-name {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.02em;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ============ PUBLIC PROFILE ============ */
.public-wrap {
  max-width: 520px;
  margin: 0 auto;
  padding: 40px 16px 100px;
  position: relative;
  z-index: 1;
}

/* Glass card */
.profile-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md), 0 0 60px rgba(74, 144, 255, 0.1);
  position: relative;
}
.profile-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--gradient-glow);
  opacity: 0.6;
  z-index: 2;
}

.profile-cover {
  height: 140px;
  background:
    radial-gradient(circle at 30% 50%, rgba(74, 144, 255, 0.5) 0%, transparent 60%),
    radial-gradient(circle at 70% 50%, rgba(157, 107, 255, 0.5) 0%, transparent 60%),
    radial-gradient(circle at 50% 100%, rgba(255, 107, 203, 0.4) 0%, transparent 60%),
    rgba(15, 21, 53, 0.5);
  position: relative;
  overflow: hidden;
}

.profile-avatar-wrap {
  margin-top: -50px;
  display: inline-block;
  position: relative;
  margin-left: 24px;
}
.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 3px solid rgba(15, 21, 53, 0.9);
  object-fit: cover;
  box-shadow: 0 0 30px var(--purple-glow), 0 0 60px rgba(157, 107, 255, 0.3);
  position: relative;
  z-index: 2;
}

.profile-body { padding: 20px 24px 28px; }
.profile-name {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 4px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.profile-username {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}
.profile-bio {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 24px;
}

.profile-stats {
  display: flex;
  gap: 32px;
  padding: 20px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.stat { display: flex; flex-direction: column; }
.stat-num {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text);
}
.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 4px;
  font-weight: 600;
}

/* ============ BUTTONS ============ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  white-space: nowrap;
  height: 40px;
}
.btn-primary {
  background: var(--gradient-primary);
  color: white;
  border: none;
  box-shadow: 0 4px 20px rgba(74, 144, 255, 0.4);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(74, 144, 255, 0.6);
}
.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  border: 1px solid var(--border-bright);
  backdrop-filter: blur(10px);
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-glow);
  box-shadow: 0 0 20px rgba(74, 227, 255, 0.2);
}
.btn-danger {
  background: linear-gradient(135deg, #FF6BCB 0%, #FF4A7A 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 20px rgba(255, 107, 203, 0.3);
}
.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(255, 107, 203, 0.5);
}
.btn-sm { height: 32px; padding: 6px 14px; font-size: 13px; }
.btn-block { width: 100%; }

/* ============ SECTIONS ============ */
.section {
  background: var(--bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-top: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  position: relative;
}
.section::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--gradient-glow);
  opacity: 0.3;
}
.section-head {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.section-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.section-body { padding: 20px 24px; }

.row-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s ease;
}
.row-item:last-child { border-bottom: none; }
.row-item:hover { background: var(--bg-hover); }
.row-item .row-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-bright);
}
.row-info { flex: 1; min-width: 0; }
.row-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}
.row-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 3px;
}

/* Chips */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.chip-success {
  background: rgba(74, 227, 255, 0.15);
  color: var(--cyan);
  border: 1px solid rgba(74, 227, 255, 0.3);
  box-shadow: 0 0 15px rgba(74, 227, 255, 0.15);
}
.chip-danger {
  background: rgba(255, 107, 203, 0.15);
  color: var(--pink);
  border: 1px solid rgba(255, 107, 203, 0.3);
  box-shadow: 0 0 15px rgba(255, 107, 203, 0.15);
}

/* ============ MUSIC PLAYER ============ */
.player {
  background: var(--bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px;
  margin-top: 20px;
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}
.player::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--gradient-glow);
  opacity: 0.5;
}
.player-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.player-cover {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  object-fit: cover;
  border: 1px solid var(--border-bright);
  box-shadow: 0 0 20px var(--cyan-glow);
}
.player-meta { flex: 1; min-width: 0; }
.player-title {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.player-progress {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  margin-bottom: 8px;
  overflow: hidden;
}
.player-progress:hover { height: 6px; }
.player-progress-fill {
  height: 100%;
  background: var(--gradient-glow);
  border-radius: 2px;
  width: 0;
  box-shadow: 0 0 10px var(--cyan-glow);
  transition: width 0.1s;
}
.player-times {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
}
.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.player-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border-bright);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 14px;
}
.player-btn:hover {
  color: var(--text);
  border-color: var(--border-glow);
  background: rgba(255, 255, 255, 0.1);
}
.player-btn-primary {
  width: 52px;
  height: 52px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  box-shadow: 0 0 25px rgba(74, 144, 255, 0.5);
  font-size: 18px;
}
.player-btn-primary:hover {
  transform: scale(1.05);
  box-shadow: 0 0 35px rgba(74, 144, 255, 0.8);
}
.playlist {
  margin-top: 20px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  max-height: 280px;
  overflow-y: auto;
}
.playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.playlist-item:hover {
  background: var(--bg-hover);
  border-color: var(--border);
}
.playlist-item.active {
  background: rgba(74, 144, 255, 0.15);
  border-color: var(--border-glow);
  box-shadow: 0 0 20px rgba(74, 227, 255, 0.1);
}
.playlist-num {
  font-size: 12px;
  color: var(--text-tertiary);
  min-width: 20px;
  font-variant-numeric: tabular-nums;
}
.playlist-info { flex: 1; min-width: 0; }
.playlist-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.playlist-artist { font-size: 11px; color: var(--text-tertiary); }

/* ============ CHAT ============ */
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 0 30px rgba(74, 144, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: all 0.3s ease;
  z-index: 9998;
}
.chat-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 0 50px rgba(74, 144, 255, 0.9);
}
.chat-panel {
  display: none;
  position: fixed;
  bottom: 92px;
  right: 24px;
  width: min(400px, calc(100vw - 32px));
  height: min(540px, calc(100vh - 130px));
  background: rgba(15, 21, 53, 0.95);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-bright);
  box-shadow: var(--shadow-lg), 0 0 60px rgba(74, 144, 255, 0.2);
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
}
.chat-panel.open { display: flex; }
.chat-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--gradient-glow);
}
.chat-head {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 15px;
}
.chat-head button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 16px;
  transition: all 0.2s;
}
.chat-head button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  border-color: var(--border-glow);
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.chat-login { padding: 16px 0; }
.chat-login h4 {
  font-size: 17px;
  margin-bottom: 16px;
  font-weight: 700;
}
.chat-login input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  margin-bottom: 10px;
  color: var(--text);
  transition: all 0.2s;
}
.chat-login input::placeholder { color: var(--text-tertiary); }
.chat-login input:focus {
  border-color: var(--border-glow);
  box-shadow: 0 0 0 3px rgba(74, 227, 255, 0.1);
}
.chat-login button {
  width: 100%;
  padding: 12px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(74, 144, 255, 0.4);
}
.chat-login button:hover { box-shadow: 0 8px 30px rgba(74, 144, 255, 0.6); }
.chat-input-area {
  padding: 14px;
  border-top: 1px solid var(--border);
  display: none;
}
.chat-input-row { display: flex; gap: 8px; }
.chat-input-row input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  color: var(--text);
}
.chat-input-row input::placeholder { color: var(--text-tertiary); }
.chat-input-row input:focus { border-color: var(--border-glow); }
.chat-input-row button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(74, 144, 255, 0.4);
}

.msg {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 18px;
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
  animation: msgIn 0.2s ease;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.msg.user {
  background: var(--gradient-primary);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 6px;
  box-shadow: 0 4px 15px rgba(74, 144, 255, 0.3);
}
.msg.admin {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  color: var(--text);
  border-bottom-left-radius: 6px;
}
.msg .time {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 4px;
  text-align: right;
}

/* ============ LOGIN / ADMIN ============ */
.login-overlay {
  position: fixed;
  inset: 0;
  background: #0A0E27;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.login-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 40%, rgba(74, 144, 255, 0.2) 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(157, 107, 255, 0.2) 0%, transparent 50%);
  pointer-events: none;
}
.login-card {
  background: rgba(15, 21, 53, 0.7);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  padding: 44px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-bright);
  box-shadow: var(--shadow-lg), 0 0 60px rgba(74, 144, 255, 0.2);
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}
.login-card h1 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.login-card .sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 28px;
}
.login-card input {
  width: 100%;
  padding: 13px 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  margin-bottom: 12px;
  color: var(--text);
  transition: all 0.2s;
}
.login-card input::placeholder { color: var(--text-tertiary); }
.login-card input:focus {
  border-color: var(--border-glow);
  box-shadow: 0 0 0 3px rgba(74, 227, 255, 0.1);
}
.login-card button {
  width: 100%;
  padding: 14px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(74, 144, 255, 0.5);
  transition: all 0.2s;
}
.login-card button:hover { box-shadow: 0 8px 30px rgba(74, 144, 255, 0.7); }
.login-card button:disabled { opacity: 0.5; cursor: not-allowed; }
.error {
  color: var(--pink);
  font-size: 13px;
  margin-top: 12px;
  display: none;
}

/* ============ DASHBOARD ============ */
.dashboard {
  display: none;
  width: 100%;
  height: 100vh;
  background: transparent;
  position: relative;
  z-index: 1;
}
.dashboard.active { display: flex; }

.dash-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: rgba(15, 21, 53, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.dash-sidebar-head {
  padding: 24px 20px;
  border-bottom: 1px solid var(--border);
}
.dash-sidebar-head h2 {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.dash-sidebar-head .sub {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}
.dash-nav { flex: 1; padding: 16px 12px; overflow-y: auto; }
.dash-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  border: 1px solid transparent;
  background: transparent;
  width: 100%;
  text-align: left;
  font-family: inherit;
}
.dash-nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  border-color: var(--border);
}
.dash-nav-item.active {
  background: rgba(74, 144, 255, 0.15);
  color: var(--text);
  border-color: var(--border-glow);
  box-shadow: 0 0 20px rgba(74, 227, 255, 0.1);
}
.dash-nav-item .icon { font-size: 16px; width: 20px; text-align: center; }

.dash-content { flex: 1; overflow-y: auto; padding: 32px 40px; }
.dash-view { display: none; }
.dash-view.active { display: block; }

/* Forms */
.form-group { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  color: var(--text);
}
.form-input:focus {
  border-color: var(--border-glow);
  box-shadow: 0 0 0 3px rgba(74, 227, 255, 0.1);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}
.empty-state h3 {
  color: var(--text);
  font-size: 15px;
  margin-bottom: 4px;
  font-weight: 600;
}

/* Responsive */
@media (max-width: 700px) {
  .dash-sidebar { position: fixed; left: -260px; top: 0; bottom: 0; z-index: 200; transition: left 0.2s; }
  .dash-sidebar.open { left: 0; }
  .dash-content { padding: 20px; }
  .public-wrap { padding: 20px 12px 100px; }
}

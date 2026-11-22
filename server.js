/* ============================================================
   EDL-STYLE FUTURISTIC DARK SPACE
============================================================ */

:root {
  --primary: #4A90FF;
  --secondary: #9D6BFF;
  --accent: #4AE3FF;
  --danger: #FF6BCB;
  --success: #4AE3FF;
  --warning: #FFC84A;

  --bg-deep: #060818;
  --bg-space: #0F1638;
  --bg-card: rgba(15, 22, 56, 0.55);
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
  background: var(--bg-deep);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ==================== TOP BAR ==================== */
.top-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  pointer-events: none;
}
.top-bar > * { pointer-events: auto; }

.logo-mark {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.logo-text {
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.15em;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.mode-toggle {
  display: flex;
  background: rgba(15, 22, 56, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 4px;
  gap: 4px;
}
.mode-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.3s;
}
.mode-btn:hover { color: var(--text); }
.mode-btn.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 0 20px rgba(74, 144, 255, 0.4);
}

/* ==================== SCROLL PROGRESS ==================== */
.scroll-progress {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.05);
  z-index: 1001;
}
.scroll-progress-bar {
  height: 100%;
  width: 0;
  background: var(--gradient-glow);
  box-shadow: 0 0 10px var(--cyan-glow);
  transition: width 0.1s;
}

/* ==================== SCENE HINT ==================== */
.scene-hint {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 0.3em;
  font-weight: 600;
  z-index: 100;
  animation: float 2.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes float {
  0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.6; }
  50% { transform: translateX(-50%) translateY(-8px); opacity: 1; }
}

/* ==================== SCROLL SECTIONS ==================== */
.scroll-sections {
  position: relative;
  z-index: 10;
}

section[data-scroll-section] {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 24px;
  position: relative;
}

/* HERO */
.hero-section { text-align: center; }
.hero-logo {
  font-size: clamp(80px, 15vw, 200px);
  font-weight: 900;
  letter-spacing: 0.1em;
  line-height: 1;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 60px rgba(74, 227, 255, 0.5));
  margin-bottom: 20px;
  animation: float 4s ease-in-out infinite;
}
.hero-subtitle {
  font-size: clamp(16px, 2.5vw, 24px);
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.hero-tag {
  font-size: clamp(12px, 1.5vw, 14px);
  color: var(--text-secondary);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

/* GLASS */
.glass {
  background: var(--bg-card);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}
.glass::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--gradient-glow);
  opacity: 0.5;
}

/* STORY */
.story-section { max-width: 800px; }
.story-card {
  padding: 60px 48px;
  text-align: center;
}
.story-eyebrow {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 16px;
}
.story-headline {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-bottom: 24px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.story-body {
  font-size: 17px;
  line-height: 1.7;
  color: var(--text-secondary);
}

/* SECTION HEADERS */
.section-header {
  padding: 40px 32px;
  text-align: center;
  max-width: 720px;
  margin: 0 auto 32px;
}
.section-eyebrow {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 12px;
  display: block;
}
.section-headline {
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.section-desc {
  font-size: 15px;
  color: var(--text-secondary);
}

/* CARD GRID */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}
.industrial-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.product-card {
  padding: 32px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.product-card:hover {
  transform: translateY(-6px);
  border-color: var(--border-glow);
  box-shadow: 0 20px 40px rgba(74, 144, 255, 0.2), 0 0 0 1px var(--border-glow);
}
.card-icon {
  font-size: 40px;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 20px rgba(74, 227, 255, 0.5));
}
.card-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text);
}
.card-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 20px;
  flex: 1;
}
.card-btn {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-top: auto;
}

/* MUSIC SECTION */
.music-section {
  max-width: 720px;
  padding: 40px;
  width: 100%;
  text-align: center;
}
.music-eyebrow {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 12px;
}
.music-headline {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 24px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.player {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px;
  text-align: left;
}
.player-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.player-cover {
  width: 56px; height: 56px;
  border-radius: var(--radius-md);
  object-fit: cover;
  border: 1px solid var(--border-bright);
}
.player-meta { flex: 1; min-width: 0; }
.player-title {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.player-progress {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  margin-bottom: 8px;
}
.player-progress-fill {
  height: 100%;
  background: var(--gradient-glow);
  border-radius: 2px;
  width: 0;
  box-shadow: 0 0 10px var(--cyan-glow);
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
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border-bright);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.player-btn:hover {
  color: var(--text);
  border-color: var(--border-glow);
}
.player-btn-primary {
  width: 52px; height: 52px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  box-shadow: 0 0 25px rgba(74, 144, 255, 0.5);
  font-size: 18px;
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
  border: 1px solid transparent;
}
.playlist-item:hover { background: rgba(255, 255, 255, 0.05); }
.playlist-item.active {
  background: rgba(74, 144, 255, 0.15);
  border-color: var(--border-glow);
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

/* CONTACT */
.contact-section { max-width: 600px; }
.contact-card {
  padding: 60px 40px;
  text-align: center;
}
.contact-eyebrow {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 16px;
}
.contact-headline {
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 40px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.contact-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}
.contact-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: all 0.3s;
}
.contact-item:hover {
  border-color: var(--border-glow);
  background: rgba(74, 144, 255, 0.08);
}
.contact-label {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--text-tertiary);
  font-weight: 600;
  margin-bottom: 4px;
}
.contact-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

/* BUTTONS */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  white-space: nowrap;
  height: 48px;
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
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-glow);
}
.btn-danger {
  background: var(--gradient-pink);
  color: white;
}
.btn-sm { height: 32px; padding: 6px 14px; font-size: 13px; }
.btn-block { width: 100%; }

/* ==================== CHAT FAB ==================== */
.chat-fab {
  position: fixed;
  bottom: 24px; right: 100px;
  width: 56px; height: 56px;
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
  z-index: 9998;
}
.chat-fab:hover { transform: scale(1.1); }

.call-now-fab {
  position: fixed;
  bottom: 24px; right: 24px;
  padding: 14px 20px;
  border-radius: var(--radius-pill);
  background: var(--gradient-pink);
  color: white;
  text-decoration: none;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 4px 20px rgba(255, 107, 203, 0.5);
  z-index: 9998;
  transition: all 0.3s;
}
.call-now-fab:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(255, 107, 203, 0.7);
}

/* ==================== CHAT PANEL ==================== */
.chat-panel {
  display: none;
  position: fixed;
  bottom: 92px; right: 24px;
  width: min(400px, calc(100vw - 32px));
  height: min(540px, calc(100vh - 130px));
  background: rgba(15, 22, 56, 0.95);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-bright);
  box-shadow: var(--shadow-lg);
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
}
.chat-panel.open { display: flex; }
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
  width: 30px; height: 30px;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-secondary);
}
.chat-body { flex: 1; overflow-y: auto; padding: 20px; }
.chat-login { padding: 16px 0; }
.chat-login h4 { font-size: 17px; margin-bottom: 16px; font-weight: 700; }
.chat-login input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  margin-bottom: 10px;
  color: var(--text);
}
.chat-login input:focus { border-color: var(--border-glow); }
.chat-login button {
  width: 100%;
  padding: 12px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
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
  background: var(--bg-input);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  color: var(--text);
}
.chat-input-row input:focus { border-color: var(--border-glow); }
.chat-input-row button {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  border: none;
  cursor: pointer;
}
.msg {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 18px;
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}
.msg.user {
  background: var(--gradient-primary);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 6px;
}
.msg.admin {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  border-bottom-left-radius: 6px;
}
.msg .time { font-size: 10px; opacity: 0.6; margin-top: 4px; text-align: right; }

/* ==================== INDUSTRIAL CATALOG PAGE ==================== */
.page-catalog {
  background: var(--bg-deep);
}
.catalog-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 120px 32px 80px;
}
.breadcrumb {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 32px;
}
.breadcrumb a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}
.breadcrumb a:hover { color: var(--accent); }
.breadcrumb span { margin: 0 8px; }

.catalog-header {
  text-align: center;
  margin-bottom: 60px;
}
.catalog-page-title {
  font-size: clamp(48px, 8vw, 96px);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 16px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.catalog-page-subtitle {
  font-size: 17px;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto;
}
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}
.catalog-card {
  padding: 36px;
  transition: all 0.3s;
}
.catalog-card:hover {
  transform: translateY(-6px);
  border-color: var(--border-glow);
  box-shadow: 0 20px 40px rgba(74, 144, 255, 0.2);
}
.catalog-icon {
  font-size: 48px;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 20px rgba(74, 227, 255, 0.5));
}
.catalog-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
}
.catalog-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}
.catalog-btn {
  padding: 12px 20px;
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s;
}
.catalog-btn:hover {
  background: var(--gradient-primary);
  color: white;
  border-color: transparent;
}

/* ==================== FOOTER ==================== */
.site-footer {
  background: rgba(15, 22, 56, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  padding: 80px 32px 32px;
  margin-top: 80px;
}
.footer-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
  gap: 40px;
}
.footer-brand-title {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 12px;
  background: var(--gradient-glow);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.footer-brand-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 16px;
}
.footer-badge {
  display: inline-block;
  padding: 6px 12px;
  background: rgba(74, 227, 255, 0.1);
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}
.footer-col-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text);
  margin-bottom: 16px;
}
.footer-links {
  list-style: none;
}
.footer-links li { margin-bottom: 10px; }
.footer-links a {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-links a:hover { color: var(--accent); }
.footer-contact {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}
.footer-contact strong { color: var(--text); font-weight: 600; }
.footer-contact a { color: var(--accent); text-decoration: none; }
.footer-bottom {
  max-width: 1200px;
  margin: 60px auto 0;
  padding-top: 32px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

/* ==================== ADMIN (unchanged) ==================== */
.page-admin { background: var(--bg-deep); }
.login-overlay {
  position: fixed; inset: 0;
  background: var(--bg-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.login-card {
  background: var(--bg-card);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  padding: 44px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-bright);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 420px;
}
.login-card h1 {
  font-size: 26px;
  font-weight: 800;
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
  background: var(--bg-input);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text);
  font-family: inherit;
  outline: none;
  margin-bottom: 12px;
}
.login-card input:focus { border-color: var(--border-glow); }
.login-card button {
  width: 100%;
  padding: 14px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}
.error { color: var(--pink); font-size: 13px; margin-top: 12px; display: none; }

.dashboard { display: none; width: 100%; height: 100vh; }
.dashboard.active { display: flex; }
.dash-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: rgba(15, 22, 56, 0.7);
  backdrop-filter: blur(20px);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.dash-sidebar-head { padding: 24px 20px; border-bottom: 1px solid var(--border); }
.dash-sidebar-head h2 {
  font-size: 17px;
  font-weight: 800;
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
.dash-nav { flex: 1; padding: 16px 12px; }
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
}
.dash-nav-item.active {
  background: rgba(74, 144, 255, 0.15);
  color: var(--text);
  border-color: var(--border-glow);
}
.dash-nav-item .icon { font-size: 16px; width: 20px; text-align: center; }
.dash-content { flex: 1; overflow-y: auto; padding: 32px 40px; }
.dash-view { display: none; }
.dash-view.active { display: block; }

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

/* Row items (admin lists) */
.row-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.2s;
}
.row-item:hover { background: rgba(255, 255, 255, 0.05); }
.row-item:last-child { border-bottom: none; }
.row-item .row-avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.row-info { flex: 1; min-width: 0; }
.row-title { font-size: 14px; font-weight: 600; }
.row-subtitle { font-size: 12px; color: var(--text-tertiary); margin-top: 3px; }
.chip {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.chip-danger {
  background: rgba(255, 107, 203, 0.15);
  color: var(--pink);
  border: 1px solid rgba(255, 107, 203, 0.3);
}

/* Responsive */
@media (max-width: 900px) {
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .catalog-main { padding: 100px 20px 60px; }
}
@media (max-width: 600px) {
  .top-bar { padding: 16px; }
  .logo-text { font-size: 16px; }
  .mode-btn { padding: 6px 12px; font-size: 10px; }
  .story-card { padding: 40px 24px; }
  .contact-card { padding: 40px 24px; }
  .chat-fab { right: 80px; }
  .footer-grid { grid-template-columns: 1fr; }
  section[data-scroll-section] { padding: 80px 16px; }
}

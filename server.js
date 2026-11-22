// ==================== SERVE REACT APP ====================
const path = require('path');
const express = require('express');
const compression = require('compression');

const app = express();

// Add near the top after other middleware
app.use(compression());

// Serve built React app
const DIST = path.join(__dirname, 'dist');

// Serve static assets from dist
app.use('/assets', express.static(path.join(DIST, 'assets'), { maxAge: 604800000 }));
app.use(express.static(DIST, { maxAge: 0, index: false }));

// Keep your existing asset serving (uploads, covermusic, gallery, styles.css)
// (those directives stay exactly as you have them)

// ==================== MAIN PAGE (React) ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// ==================== PROJECT PAGE (React) ====================
app.get('/project', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// Fallback for SPA routes (must come AFTER API + admin routes)
app.get(/^\/(?!api|admin|socket\.io|assets|uploads|styles).*/, (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

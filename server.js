require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ==================== ERROR GUARDS ====================
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// ==================== MIDDLEWARE ====================
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'bailla-mach-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ==================== DATABASE (SQLITE) ====================
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite connection error:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
});

// ==================== STATIC ASSETS & REACT BUILD ====================
const distCandidates = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'client', 'dist'),
  path.join(__dirname, 'client', 'build'),
];

const DIST = distCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || distCandidates[0];
const indexHtmlPath = path.join(DIST, 'index.html');

if (fs.existsSync(path.join(DIST, 'assets'))) {
  app.use('/assets', express.static(path.join(DIST, 'assets'), { maxAge: 604800000 }));
}

app.use(express.static(DIST, { maxAge: 0, index: false }));

// Optional static directories if present in project
['uploads', 'covermusic', 'gallery'].forEach((folder) => {
  const folderPath = path.join(__dirname, folder);
  if (fs.existsSync(folderPath)) {
    app.use(`/${folder}`, express.static(folderPath));
  }
});

// ==================== API & SOCKET ROUTES ====================
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'bailla-mach', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// ==================== FRONTEND SPA ROUTES ====================
function sendFrontend(req, res) {
  if (fs.existsSync(indexHtmlPath)) {
    return res.sendFile(indexHtmlPath);
  }
  return res.status(200).send('Bailla Mach server is running. Build frontend assets to serve index.html.');
}

app.get('/', sendFrontend);
app.get('/project', sendFrontend);

// Fallback for SPA routes (placed after API & static routes)
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/socket.io') ||
    req.path.startsWith('/assets') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/styles')
  ) {
    return next();
  }
  return sendFrontend(req, res);
});

// ==================== START SERVER ====================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

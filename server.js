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

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'bailla.sid',
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(
  path.join(dataDir, 'database.sqlite'),
  (err) => {
    if (err) {
      console.error('SQLite connection error:', err.message);
    } else {
      console.log('Connected to SQLite database');
    }
  }
);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'bailla-mach',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/reports', (req, res) => {
  const target = String(req.body.target || '').trim();
  const reason = String(req.body.reason || '').trim();

  if (!target || !reason) {
    return res.status(400).json({
      error: 'Target and reason are required',
    });
  }

  db.run(
    'INSERT INTO reports (target, reason) VALUES (?, ?)',
    [target, reason],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: 'Could not save report',
        });
      }

      return res.status(201).json({
        id: this.lastID,
        target,
        reason,
      });
    }
  );
});

app.get('/api/reports', (req, res) => {
  db.all(
    'SELECT id, target, reason, created_at FROM reports ORDER BY id DESC',
    [],
    (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: 'Could not fetch reports',
        });
      }

      res.json(rows);
    }
  );
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const DIST = path.join(__dirname, 'dist');

if (fs.existsSync(path.join(DIST, 'assets'))) {
  app.use(
    '/assets',
    express.static(path.join(DIST, 'assets'), {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  );
}

app.use(express.static(DIST, {
  maxAge: 0,
  index: false,
  etag: true,
}));

['uploads', 'covermusic', 'gallery'].forEach((folder) => {
  const folderPath = path.join(__dirname, folder);

  if (fs.existsSync(folderPath)) {
    app.use(`/${folder}`, express.static(folderPath));
  }
});

const indexPath = path.join(DIST, 'index.html');

function sendFrontend(req, res) {
  if (!fs.existsSync(indexPath)) {
    return res.status(503).send(
      'Frontend is not built. Run: npm run build'
    );
  }

  return res.sendFile(indexPath);
}

app.get(['/'], sendFrontend);
app.get(['/project'], sendFrontend);

app.get('*', (req, res, next) => {
  if (
    req.path === '/socket.io' ||
    req.path.startsWith('/socket.io/') ||
    req.path.startsWith('/api/') ||
    req.path.startsWith('/admin/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/uploads/') ||
    req.path.startsWith('/styles/')
  ) {
    return next();
  }

  return sendFrontend(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

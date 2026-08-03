const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const __dir = path.resolve();
const ASSETS_DIR = path.join(__dir, 'assets');
const GALLERY_DIR = path.join(__dir, 'assets', 'gallery');
const CHAT_UPLOADS_DIR = path.join(__dir, 'assets', 'chat_uploads');

[ASSETS_DIR, GALLERY_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// In-memory storage
const memoryStore = {
    users: new Map(),
    sessions: new Map(),
    messages: new Map(),
    galleryPhotos: [],
    adminUser: { username: 'admin', password: bcrypt.hashSync('admin123', 10) }
};

const adminSessions = new Map();

function parseCookies(h) {
    const c = {};
    if (h) h.split(';').forEach(x => {
        const p = x.split('=');
        c[p[0].trim()] = p[1] ? p[1].trim() : '';
    });
    return c;
}

function createOrGetChatUser(name, phoneEmail) {
    const clean = (phoneEmail || '').trim().toLowerCase();
    if (!clean) return null;
    let user = memoryStore.users.get(clean);
    if (user) { user.name = name; user.lastSeen = new Date(); return user; }
    const chatId = 'CHAT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    user = { chatId, name, phoneEmail: clean, createdAt: new Date(), lastSeen: new Date(), status: 'active' };
    memoryStore.users.set(clean, user);
    return user;
}

function createChatSession(chatId) {
    const token = crypto.randomBytes(32).toString('hex');
    memoryStore.sessions.set(token, { chatId, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return token;
}

function getChatUserByToken(token) {
    if (!token) return null;
    const session = memoryStore.sessions.get(token);
    if (!session || new Date() > session.expiresAt) { memoryStore.sessions.delete(token); return null; }
    for (const [key, user] of memoryStore.users) { if (user.chatId === session.chatId) return user; }
    return null;
}

function getChatMessages(chatId) {
    return (memoryStore.messages.get(chatId) || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function saveChatMessage(chatId, sender, message, type, fileUrl) {
    const msg = { chatId, sender, message, type: type || 'text', fileUrl: fileUrl || null, createdAt: new Date(), read: false };
    if (!memoryStore.messages.has(chatId)) memoryStore.messages.set(chatId, []);
    memoryStore.messages.get(chatId).push(msg);
    return msg;
}

// ============ PROFESSIONAL BUSINESS UI ============
function getMainHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baiilla Maach | Official Website</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #ec4899;
            --dark: #0f172a;
            --darker: #020617;
            --light: #f8fafc;
            --gray: #64748b;
            --card: #1e293b;
            --border: #334155;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --gradient: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899);
            --shadow: 0 10px 40px rgba(0,0,0,0.3);
            --shadow-lg: 0 20px 60px rgba(0,0,0,0.4);
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--darker);
            color: var(--light);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Navigation */
        .navbar {
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            padding: 0 20px;
        }
        
        .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 70px;
        }
        
        .nav-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
        }
        
        .nav-logo img {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            object-fit: cover;
        }
        
        .nav-logo span {
            font-size: 20px;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .nav-links {
            display: flex;
            gap: 8px;
            list-style: none;
        }
        
        .nav-links a {
            color: var(--gray);
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 500;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .nav-links a:hover {
            color: var(--light);
            background: rgba(99, 102, 241, 0.1);
        }
        
        .nav-cta {
            background: var(--gradient) !important;
            color: white !important;
            padding: 10px 20px !important;
            border-radius: 12px !important;
            font-weight: 600 !important;
        }
        
        /* Hero Section */
        .hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 100px 20px 60px;
            position: relative;
            overflow: hidden;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
            animation: rotate 20s linear infinite;
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .hero-content {
            position: relative;
            z-index: 1;
            max-width: 800px;
        }
        
        .hero-badge {
            display: inline-block;
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        
        .hero-badge i {
            margin-right: 6px;
            color: #10b981;
        }
        
        .hero h1 {
            font-size: 56px;
            font-weight: 800;
            line-height: 1.1;
            margin-bottom: 20px;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .hero p {
            font-size: 18px;
            color: var(--gray);
            margin-bottom: 30px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .hero-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.3s;
            border: none;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: var(--gradient);
            color: white;
            box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3);
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(99, 102, 241, 0.4);
        }
        
        .btn-outline {
            background: transparent;
            color: var(--light);
            border: 2px solid var(--border);
        }
        
        .btn-outline:hover {
            border-color: var(--primary);
            background: rgba(99, 102, 241, 0.1);
        }
        
        /* Stats */
        .hero-stats {
            display: flex;
            gap: 40px;
            justify-content: center;
            margin-top: 40px;
            flex-wrap: wrap;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-number {
            font-size: 32px;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .stat-label {
            font-size: 13px;
            color: var(--gray);
            margin-top: 4px;
        }
        
        /* Sections */
        .section {
            padding: 80px 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .section-header {
            text-align: center;
            margin-bottom: 60px;
        }
        
        .section-badge {
            display: inline-block;
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        
        .section-title {
            font-size: 36px;
            font-weight: 800;
            margin-bottom: 12px;
        }
        
        .section-subtitle {
            font-size: 16px;
            color: var(--gray);
            max-width: 600px;
            margin: 0 auto;
        }
        
        /* Services Grid */
        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
        }
        
        .service-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 30px;
            transition: all 0.3s;
        }
        
        .service-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
            box-shadow: var(--shadow);
        }
        
        .service-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 20px;
        }
        
        .icon-purple { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
        .icon-pink { background: rgba(236, 72, 153, 0.2); color: #f9a8d4; }
        .icon-green { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
        .icon-orange { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
        .icon-blue { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
        .icon-red { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        
        .service-card h3 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .service-card p {
            color: var(--gray);
            font-size: 14px;
            line-height: 1.7;
        }
        
        /* About Section */
        .about-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            align-items: center;
        }
        
        .about-image img {
            width: 100%;
            border-radius: 20px;
            border: 2px solid var(--border);
        }
        
        .about-content h2 {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 16px;
        }
        
        .about-content p {
            color: var(--gray);
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 20px;
        }
        
        .about-features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        
        .about-feature {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--gray);
            font-size: 14px;
        }
        
        .about-feature i {
            color: #10b981;
        }
        
        /* Contact Section */
        .contact-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        
        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .contact-item {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        
        .contact-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: rgba(99, 102, 241, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: #a5b4fc;
            flex-shrink: 0;
        }
        
        .contact-text h4 {
            font-weight: 600;
            font-size: 14px;
            color: var(--gray);
        }
        
        .contact-text p {
            font-weight: 500;
        }
        
        .contact-form {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 30px;
        }
        
        .contact-form input,
        .contact-form textarea {
            width: 100%;
            background: var(--darker);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 16px;
            color: var(--light);
            font-family: inherit;
            font-size: 14px;
            margin-bottom: 12px;
            outline: none;
            transition: border-color 0.3s;
        }
        
        .contact-form input:focus,
        .contact-form textarea:focus {
            border-color: var(--primary);
        }
        
        .contact-form button {
            width: 100%;
            padding: 14px;
            background: var(--gradient);
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            font-family: inherit;
        }
        
        /* Footer */
        .footer {
            background: var(--card);
            border-top: 1px solid var(--border);
            padding: 40px 20px;
            text-align: center;
        }
        
        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .footer-links {
            display: flex;
            gap: 20px;
            list-style: none;
        }
        
        .footer-links a {
            color: var(--gray);
            text-decoration: none;
            font-size: 14px;
        }
        
        .footer-links a:hover { color: var(--light); }
        
        .footer-social {
            display: flex;
            gap: 12px;
        }
        
        .footer-social a {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: var(--darker);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gray);
            text-decoration: none;
            transition: all 0.3s;
        }
        
        .footer-social a:hover {
            background: var(--primary);
            color: white;
        }
        
        /* Chat Widget */
        .chat-widget {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999;
        }
        
        .chat-btn {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--gradient);
            border: none;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            text-decoration: none;
            transition: all 0.3s;
        }
        
        .chat-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5);
        }
        
        /* Mobile Menu */
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: var(--light);
            font-size: 24px;
            cursor: pointer;
        }
        
        @media (max-width: 768px) {
            .hero h1 { font-size: 36px; }
            .nav-links { display: none; }
            .mobile-menu-btn { display: block; }
            .about-grid { grid-template-columns: 1fr; }
            .contact-grid { grid-template-columns: 1fr; }
            .hero-stats { gap: 20px; }
            .stat-number { font-size: 24px; }
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar">
        <div class="nav-container">
            <a href="/" class="nav-logo">
                <img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Logo" onerror="this.style.display='none'">
                <span>Baiilla Maach</span>
            </a>
            <ul class="nav-links" id="navLinks">
                <li><a href="#home">Home</a></li>
                <li><a href="#services">Services</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#contact">Contact</a></li>
                <li><a href="/chat" class="nav-cta">💬 Chat Now</a></li>
            </ul>
            <button class="mobile-menu-btn" onclick="toggleMenu()">☰</button>
        </div>
    </nav>
    
    <!-- Hero Section -->
    <section class="hero" id="home">
        <div class="hero-content">
            <div class="hero-badge"><i class="fas fa-check-circle"></i> Official Verified Creator</div>
            <h1>Digital Creator &<br>Entertainment Hub</h1>
            <p>Welcome to the official website of Baiilla Maach. Discover authentic content, connect with our community, and stay updated with the latest.</p>
            <div class="hero-buttons">
                <a href="/chat" class="btn btn-primary"><i class="fas fa-comment"></i> Start Chat</a>
                <a href="#services" class="btn btn-outline"><i class="fas fa-arrow-down"></i> Explore More</a>
            </div>
            <div class="hero-stats">
                <div class="stat">
                    <div class="stat-number">5K+</div>
                    <div class="stat-label">Followers</div>
                </div>
                <div class="stat">
                    <div class="stat-number">50K+</div>
                    <div class="stat-label">Total Likes</div>
                </div>
                <div class="stat">
                    <div class="stat-number">100%</div>
                    <div class="stat-label">Authentic</div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Services Section -->
    <section class="section" id="services">
        <div class="section-header">
            <div class="section-badge">What We Offer</div>
            <h2 class="section-title">Our Services</h2>
            <p class="section-subtitle">Comprehensive digital solutions tailored for creators and businesses</p>
        </div>
        <div class="services-grid">
            <div class="service-card">
                <div class="service-icon icon-purple"><i class="fas fa-shield-halved"></i></div>
                <h3>Account Verification</h3>
                <p>Get your social media accounts verified. We help you through the official verification process.</p>
            </div>
            <div class="service-card">
                <div class="service-icon icon-pink"><i class="fas fa-chart-line"></i></div>
                <h3>Content Strategy</h3>
                <p>Professional content planning and strategy to grow your online presence effectively.</p>
            </div>
            <div class="service-card">
                <div class="service-icon icon-green"><i class="fas fa-paint-brush"></i></div>
                <h3>Brand Design</h3>
                <p>Custom branding solutions including logos, banners, and complete visual identity.</p>
            </div>
            <div class="service-card">
                <div class="service-icon icon-orange"><i class="fas fa-video"></i></div>
                <h3>Video Production</h3>
                <p>High-quality video content creation for TikTok, YouTube, and other platforms.</p>
            </div>
            <div class="service-card">
                <div class="service-icon icon-blue"><i class="fas fa-bullhorn"></i></div>
                <h3>Social Marketing</h3>
                <p>Targeted social media marketing campaigns to reach your ideal audience.</p>
            </div>
            <div class="service-card">
                <div class="service-icon icon-red"><i class="fas fa-headset"></i></div>
                <h3>24/7 Support</h3>
                <p>Round-the-clock customer support for all your queries and concerns.</p>
            </div>
        </div>
    </section>
    
    <!-- About Section -->
    <section class="section" id="about">
        <div class="about-grid">
            <div class="about-image">
                <img src="/assets/tiktok_video_Aj2NO.jpeg" alt="About" onerror="this.style.background='linear-gradient(135deg,#6366f1,#ec4899)';this.style.minHeight='400px'">
            </div>
            <div class="about-content">
                <div class="section-badge">About Us</div>
                <h2>Creative Digital Studio Since 2020</h2>
                <p>We are a team of passionate digital creators dedicated to producing authentic and engaging content. Our mission is to build a trustworthy community around creative expression.</p>
                <div class="about-features">
                    <div class="about-feature"><i class="fas fa-check-circle"></i> Verified Creator</div>
                    <div class="about-feature"><i class="fas fa-check-circle"></i> Original Content</div>
                    <div class="about-feature"><i class="fas fa-check-circle"></i> Community First</div>
                    <div class="about-feature"><i class="fas fa-check-circle"></i> 24/7 Support</div>
                    <div class="about-feature"><i class="fas fa-check-circle"></i> Secure Platform</div>
                    <div class="about-feature"><i class="fas fa-check-circle"></i> Fast Response</div>
                </div>
                <a href="/chat" class="btn btn-primary" style="margin-top:20px">Get In Touch</a>
            </div>
        </div>
    </section>
    
    <!-- Contact Section -->
    <section class="section" id="contact">
        <div class="section-header">
            <div class="section-badge">Get In Touch</div>
            <h2 class="section-title">Contact Us</h2>
            <p class="section-subtitle">Have questions? We'd love to hear from you.</p>
        </div>
        <div class="contact-grid">
            <div class="contact-info">
                <div class="contact-item">
                    <div class="contact-icon"><i class="fas fa-envelope"></i></div>
                    <div class="contact-text">
                        <h4>Email</h4>
                        <p>contact@baiillamaach.com</p>
                    </div>
                </div>
                <div class="contact-item">
                    <div class="contact-icon"><i class="fas fa-phone"></i></div>
                    <div class="contact-text">
                        <h4>Phone</h4>
                        <p>+880 1700-000000</p>
                    </div>
                </div>
                <div class="contact-item">
                    <div class="contact-icon"><i class="fas fa-location-dot"></i></div>
                    <div class="contact-text">
                        <h4>Location</h4>
                        <p>Dhaka, Bangladesh</p>
                    </div>
                </div>
                <div class="contact-item">
                    <div class="contact-icon"><i class="fas fa-clock"></i></div>
                    <div class="contact-text">
                        <h4>Working Hours</h4>
                        <p>24/7 Available</p>
                    </div>
                </div>
            </div>
            <div class="contact-form" id="contactForm">
                <h3 style="margin-bottom:20px;font-weight:700">Send Message</h3>
                <input type="text" id="contactName" placeholder="Your Name">
                <input type="email" id="contactEmail" placeholder="Your Email">
                <textarea id="contactMessage" rows="4" placeholder="Your Message"></textarea>
                <button onclick="submitContact()">Send Message <i class="fas fa-paper-plane"></i></button>
                <p id="contactResponse" style="margin-top:10px;text-align:center;font-size:13px"></p>
            </div>
        </div>
    </section>
    
    <!-- Footer -->
    <footer class="footer">
        <div class="footer-content">
            <p style="color:var(--gray);font-size:14px">&copy; 2024 Baiilla Maach Official. All rights reserved.</p>
            <ul class="footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="#services">Services</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="/chat">Chat</a></li>
            </ul>
            <div class="footer-social">
                <a href="https://tiktok.com/@baiillamaach_official" target="_blank"><i class="fab fa-tiktok"></i></a>
                <a href="https://facebook.com" target="_blank"><i class="fab fa-facebook"></i></a>
                <a href="https://instagram.com" target="_blank"><i class="fab fa-instagram"></i></a>
                <a href="https://youtube.com" target="_blank"><i class="fab fa-youtube"></i></a>
            </div>
        </div>
    </footer>
    
    <!-- Chat Widget -->
    <div class="chat-widget">
        <a href="/chat" class="chat-btn" title="Chat with us">💬</a>
    </div>
    
    <script>
        function toggleMenu() {
            var nav = document.getElementById('navLinks');
            if (nav.style.display === 'flex') {
                nav.style.display = 'none';
            } else {
                nav.style.display = 'flex';
                nav.style.flexDirection = 'column';
                nav.style.position = 'absolute';
                nav.style.top = '70px';
                nav.style.left = '0';
                nav.style.right = '0';
                nav.style.background = '#0f172a';
                nav.style.padding = '20px';
                nav.style.borderBottom = '1px solid #334155';
            }
        }
        
        function submitContact() {
            var name = document.getElementById('contactName').value;
            var email = document.getElementById('contactEmail').value;
            var message = document.getElementById('contactMessage').value;
            var response = document.getElementById('contactResponse');
            
            if (!name || !email || !message) {
                response.textContent = 'Please fill all fields';
                response.style.color = '#ef4444';
                return;
            }
            
            response.textContent = 'Message sent successfully! We will get back to you soon.';
            response.style.color = '#10b981';
            
            document.getElementById('contactName').value = '';
            document.getElementById('contactEmail').value = '';
            document.getElementById('contactMessage').value = '';
        }
        
        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                var target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    </script>
</body>
</html>`;
}

// Chat HTML
function getChatHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat - Baiilla Maach</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Plus Jakarta Sans',sans-serif;background:#0f172a;height:100vh;display:flex;flex-direction:column;color:#f8fafc}
        .header{background:#1e293b;padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #334155}
        .header a{color:#6366f1;font-size:22px;text-decoration:none}
        .header img{width:40px;height:40px;border-radius:12px;object-fit:cover}
        .header-info{flex:1}
        .header-name{font-weight:700;font-size:15px}
        .header-status{font-size:11px;color:#10b981}
        .messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
        .msg{display:flex;animation:fadeIn 0.3s}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .msg.user{justify-content:flex-end}
        .msg.support{justify-content:flex-start}
        .bubble{max-width:75%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5;word-wrap:break-word}
        .msg.user .bubble{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-bottom-right-radius:4px}
        .msg.support .bubble{background:#1e293b;border:1px solid #334155;border-bottom-left-radius:4px}
        .bubble img{max-width:200px;border-radius:10px;cursor:pointer;margin-top:6px}
        .msg-time{font-size:10px;opacity:0.6;margin-top:4px}
        .footer{background:#1e293b;padding:12px 16px;display:flex;gap:8px;align-items:center;border-top:1px solid #334155}
        .footer input[type=text]{flex:1;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:25px;color:#f8fafc;font-family:inherit;font-size:13px;outline:none}
        .footer input[type=text]:focus{border-color:#6366f1}
        .footer button{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:10px 20px;border-radius:25px;font-weight:600;cursor:pointer;font-family:inherit;font-size:13px;white-space:nowrap}
        .footer label{cursor:pointer;color:#64748b;font-size:18px;padding:8px}
        .footer input[type=file]{display:none}
        .empty{text-align:center;color:#64748b;padding:60px 20px}
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid #334155;color:#f8fafc;padding:10px 20px;border-radius:25px;font-size:13px;z-index:9999;display:none}
        .toast.show{display:block}
        .overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9998;align-items:center;justify-content:center}
        .overlay.show{display:flex}
        .overlay img{max-width:95%;max-height:95%;border-radius:12px}
    </style>
</head>
<body>
    <div class="header">
        <a href="/"><i class="fas fa-arrow-left"></i></a>
        <img src="/assets/tiktok_video_Aj2NO.jpeg" alt="Profile">
        <div class="header-info">
            <div class="header-name">Baiilla Maach</div>
            <div class="header-status"><i class="fas fa-circle" style="font-size:6px"></i> Online</div>
        </div>
    </div>
    <div class="messages" id="messagesDiv"><div class="empty"><i class="fas fa-comments" style="font-size:40px;display:block;margin-bottom:12px"></i>Send a message to start</div></div>
    <div class="footer">
        <label for="fileInput"><i class="fas fa-paperclip"></i></label>
        <input type="file" id="fileInput" accept="image/*" onchange="uploadPhoto()">
        <input type="text" id="messageInput" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()"><i class="fas fa-paper-plane"></i> Send</button>
    </div>
    <div class="overlay" id="imageOverlay" onclick="this.classList.remove('show')"><img id="overlayImg" src=""></div>
    <div class="toast" id="toast"></div>
    <script>
        var TOKEN='',CHAT_ID='';
        (function(){var p=new URLSearchParams(window.location.search);TOKEN=p.get('token')||localStorage.getItem('ctoken');CHAT_ID=p.get('chatId')||localStorage.getItem('cchatid');if(TOKEN&&CHAT_ID){localStorage.setItem('ctoken',TOKEN);localStorage.setItem('cchatid',CHAT_ID);loadChat();setInterval(loadChat,3000)}else{register()}})();
        function register(){fetch('/api/chat/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'User_'+Date.now().toString(36),phoneEmail:'user_'+Date.now()+'@chat.com'})}).then(r=>r.json()).then(d=>{if(d.success){TOKEN=d.token;CHAT_ID=d.chatId;localStorage.setItem('ctoken',TOKEN);localStorage.setItem('cchatid',CHAT_ID);loadChat();setInterval(loadChat,3000)}}).catch(e=>console.log(e))}
        function loadChat(){if(!TOKEN)return;fetch('/api/chat/messages?token='+TOKEN).then(r=>r.json()).then(d=>{if(!d.success||!d.messages)return;var div=document.getElementById('messagesDiv'),sb=div.scrollHeight-div.scrollTop-div.clientHeight<80;if(d.messages.length===0){div.innerHTML='<div class="empty"><i class="fas fa-comments" style="font-size:40px;display:block;margin-bottom:12px"></i>Send a message to start</div>';return}var h='';d.messages.forEach(function(m){var side=m.sender==='user'?'user':'support',text=m.message||'';if(m.type==='image'&&m.fileUrl)text='<img src="'+m.fileUrl+'" onclick="showImg(\''+m.fileUrl+'\')">';var time=new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});h+='<div class="msg '+side+'"><div class="bubble">'+text+'<div class="msg-time">'+time+'</div></div></div>'});div.innerHTML=h;if(sb)div.scrollTop=div.scrollHeight}).catch(e=>console.log(e))}
        function sendMessage(){var i=document.getElementById('messageInput'),t=i.value.trim();if(!t||!TOKEN)return;i.value='';showToast('Sending...');fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,message:t,type:'text'})}).then(r=>r.json()).then(d=>{if(d.success){showToast('Sent!');loadChat()}else{showToast('Failed')}}).catch(e=>{showToast('Error')})}
        function uploadPhoto(){var f=document.getElementById('fileInput').files[0];if(!f||!TOKEN)return;showToast('Uploading...');var fd=new FormData();fd.append('photo',f);fetch('/api/chat/upload?token='+TOKEN,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.success&&d.fileUrl){return fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,message:'📷 Photo',type:'image',fileUrl:d.fileUrl})})}else{throw new Error('Upload failed')}}).then(r=>r.json()).then(d=>{if(d.success){showToast('Photo sent!');loadChat()}}).catch(e=>{showToast('Upload failed')});document.getElementById('fileInput').value=''}
        function showImg(u){document.getElementById('overlayImg').src=u;document.getElementById('imageOverlay').classList.add('show')}
        function showToast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(function(){t.classList.remove('show')},2000)}
    </script>
</body>
</html>`;
}

// ============ SERVER ============
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const pu = url.parse(req.url, true);
    const pn = pu.pathname;
    const m = req.method;
    const ck = parseCookies(req.headers.cookie);
    
    if (pn.startsWith('/assets/')) {
        const ap = path.join(__dir, decodeURIComponent(pn));
        if (!ap.startsWith(ASSETS_DIR)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(ap)) {
            const e = path.extname(ap).toLowerCase();
            const t = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.webm':'audio/webm' };
            res.writeHead(200, { 'Content-Type': t[e] || 'application/octet-stream' });
            fs.createReadStream(ap).pipe(res);
        } else { res.writeHead(404); res.end(); }
        return;
    }
    
    if (pn === '/chat' && m === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getChatHTML()); return;
    }
    
    if (pn === '/api/chat/register' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', () => {
            try {
                const { name, phoneEmail } = JSON.parse(b);
                const u = createOrGetChatUser(name, phoneEmail);
                const t = createChatSession(u.chatId);
                if (getChatMessages(u.chatId).length === 0) saveChatMessage(u.chatId, 'admin', 'Hello! Welcome to Baiilla Maach Official. How can I help you? 👋');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, chatId: u.chatId, token: t, name, phoneEmail }));
            } catch(e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); }
        }); return;
    }
    
    if (pn === '/api/chat/messages' && m === 'GET') {
        const u = getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messages: getChatMessages(u.chatId) })); return;
    }
    
    if (pn === '/api/chat/send' && m === 'POST') {
        let b = ''; req.on('data', c => b += c); req.on('end', () => {
            const { token, message, type, fileUrl } = JSON.parse(b);
            const u = getChatUserByToken(token);
            if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            saveChatMessage(u.chatId, 'user', message, type, fileUrl);
            setTimeout(() => saveChatMessage(u.chatId, 'admin', 'Thank you for your message! We will get back to you soon. 😊'), 2000);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
        }); return;
    }
    
    if (pn === '/api/chat/upload' && m === 'POST') {
        const u = getChatUserByToken(pu.query.token);
        if (!u) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
        const fm = new formidable.IncomingForm({ uploadDir: CHAT_UPLOADS_DIR, keepExtensions: true, maxFileSize: 10 * 1024 * 1024 });
        fm.parse(req, (err, fields, files) => {
            if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const pf = Array.isArray(files.photo) ? files.photo[0] : files.photo;
            if (!pf) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false })); return; }
            const fn = Date.now() + '_' + (pf.originalFilename || 'photo.jpg');
            fs.renameSync(pf.filepath, path.join(CHAT_UPLOADS_DIR, fn));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileUrl: '/assets/chat_uploads/' + fn }));
        }); return;
    }
    
    if (pn === '/' || pn === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMainHTML()); return;
    }
    
    res.writeHead(404); res.end('404');
});

server.listen(PORT, () => {
    console.log('✅ Professional Website: http://localhost:' + PORT);
    console.log('💬 Chat: http://localhost:' + PORT + '/chat');
});

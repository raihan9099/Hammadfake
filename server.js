#!/usr/bin/env node

/**
 * ============================================================
 * BAIILLA MAACH OFFICIAL - ANTI-FRAUD PROTECTION SERVER
 * Version: 3.0.0 Production Ready
 * GitHub: github.com/baiillamaach/anti-fraud-server
 * License: MIT
 * ============================================================
 * 
 * Features:
 * - Image Proxy for Imgur hotlinking fix
 * - Rate Limiting & DDoS Protection
 * - Security Headers (Helmet-style)
 * - Compression (Gzip/Brotli)
 * - Caching System
 * - Health Monitoring
 * - Graceful Shutdown
 * - Cluster Mode Support
 * - Structured Logging
 * - Metrics Collection
 * - Anti-Fraud Verification API
 * - Responsive Bangla UI
 * - SEO Optimized
 * - PWA Ready
 * 
 * ============================================================
 */

'use strict';

// ==================== CORE MODULES ====================
const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cluster = require('cluster');
const os = require('os');
const { EventEmitter } = require('events');
const { Readable, Transform } = require('stream');
const { performance } = require('perf_hooks');

// ==================== CONFIGURATION ====================
const CONFIG = {
    // Server
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'production',
    CLUSTER_MODE: process.env.CLUSTER_MODE === 'true',
    WORKERS: process.env.WORKERS || os.cpus().length,
    
    // Timeouts
    KEEP_ALIVE_TIMEOUT: 65000,
    HEADERS_TIMEOUT: 66000,
    REQUEST_TIMEOUT: 30000,
    SHUTDOWN_TIMEOUT: 10000,
    
    // Rate Limiting
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_BAN_DURATION: 60 * 60 * 1000, // 1 hour
    
    // Cache
    CACHE_TTL: 3600000, // 1 hour
    CACHE_MAX_SIZE: 100,
    
    // Image Proxy
    IMGUR_REFERER: 'https://imgur.com/',
    IMGUR_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Security
    CSP_DIRECTIVES: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'https://i.imgur.com', 'https://imgur.com', 'data:', 'blob:'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'connect-src': ["'self'"],
        'frame-src': ["'none'"],
        'object-src': ["'none'"],
        'media-src': ["'self'"],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"]
    }
};

// ==================== COLOR CONSOLE ====================
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m'
};

function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    
    const colorMap = {
        INFO: colors.green,
        WARN: colors.yellow,
        ERROR: colors.red,
        DEBUG: colors.cyan,
        SUCCESS: colors.bgGreen + colors.white
    };
    
    const color = colorMap[level] || colors.reset;
    const logLine = `${colors.bright}[${timestamp}]${colors.reset} ${color}[${level}]${colors.reset} ${colors.blue}[PID:${pid}]${colors.reset} ${message}`;
    
    console.log(logLine);
    
    if (Object.keys(data).length > 0) {
        console.log(colors.cyan + JSON.stringify(data, null, 2) + colors.reset);
    }
}

// ==================== METRICS COLLECTOR ====================
class Metrics {
    constructor() {
        this.stats = {
            startTime: Date.now(),
            totalRequests: 0,
            successRequests: 0,
            errorRequests: 0,
            rateLimited: 0,
            blocked: 0,
            cacheHits: 0,
            cacheMisses: 0,
            bytesSent: 0,
            bytesReceived: 0,
            activeConnections: 0,
            totalResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            endpoints: {},
            statusCodes: {},
            ips: new Map()
        };
    }
    
    recordRequest(req, res, responseTime) {
        this.stats.totalRequests++;
        this.stats.activeConnections++;
        this.stats.totalResponseTime += responseTime;
        
        if (responseTime < this.stats.minResponseTime) {
            this.stats.minResponseTime = responseTime;
        }
        if (responseTime > this.stats.maxResponseTime) {
            this.stats.maxResponseTime = responseTime;
        }
        
        const statusCode = res.statusCode;
        if (statusCode >= 200 && statusCode < 400) {
            this.stats.successRequests++;
        } else {
            this.stats.errorRequests++;
        }
        
        // Track by status code
        this.stats.statusCodes[statusCode] = (this.stats.statusCodes[statusCode] || 0) + 1;
        
        // Track by endpoint
        const pathname = url.parse(req.url).pathname;
        if (!this.stats.endpoints[pathname]) {
            this.stats.endpoints[pathname] = { hits: 0, errors: 0, totalTime: 0 };
        }
        this.stats.endpoints[pathname].hits++;
        this.stats.endpoints[pathname].totalTime += responseTime;
        if (statusCode >= 400) {
            this.stats.endpoints[pathname].errors++;
        }
    }
    
    recordConnectionClose() {
        this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
    }
    
    recordRateLimit() {
        this.stats.rateLimited++;
    }
    
    recordBlock() {
        this.stats.blocked++;
    }
    
    recordCacheHit() {
        this.stats.cacheHits++;
    }
    
    recordCacheMiss() {
        this.stats.cacheMisses++;
    }
    
    recordBytesSent(bytes) {
        this.stats.bytesSent += bytes;
    }
    
    recordBytesReceived(bytes) {
        this.stats.bytesReceived += bytes;
    }
    
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const avgResponseTime = this.stats.totalRequests > 0 
            ? this.stats.totalResponseTime / this.stats.totalRequests 
            : 0;
        
        return {
            server: {
                uptime: Math.floor(uptime / 1000),
                uptimeHuman: this.formatUptime(uptime),
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            },
            requests: {
                total: this.stats.totalRequests,
                success: this.stats.successRequests,
                error: this.stats.errorRequests,
                rateLimited: this.stats.rateLimited,
                blocked: this.stats.blocked,
                activeConnections: this.stats.activeConnections
            },
            performance: {
                avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                minResponseTime: this.stats.minResponseTime === Infinity ? 0 : this.stats.minResponseTime,
                maxResponseTime: this.stats.maxResponseTime
            },
            cache: {
                hits: this.stats.cacheHits,
                misses: this.stats.cacheMisses,
                hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 
                    ? Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100) 
                    : 0
            },
            bandwidth: {
                bytesSent: this.stats.bytesSent,
                bytesReceived: this.stats.bytesReceived,
                totalMB: Math.round((this.stats.bytesSent + this.stats.bytesReceived) / 1024 / 1024 * 100) / 100
            },
            endpoints: Object.entries(this.stats.endpoints).map(([path, data]) => ({
                path,
                hits: data.hits,
                errors: data.errors,
                avgTime: Math.round(data.totalTime / data.hits * 100) / 100
            })),
            statusCodes: this.stats.statusCodes
        };
    }
    
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours % 24 > 0) parts.push(`${hours % 24}h`);
        if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
        parts.push(`${seconds % 60}s`);
        
        return parts.join(' ');
    }
}

// ==================== RATE LIMITER ====================
class RateLimiter {
    constructor() {
        this.clients = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // Every 5 minutes
    }
    
    isAllowed(ip) {
        const now = Date.now();
        
        // Check if banned
        const banned = this.clients.get(`banned:${ip}`);
        if (banned && now - banned.timestamp < CONFIG.RATE_LIMIT_BAN_DURATION) {
            return false;
        }
        
        // Check rate limit
        let record = this.clients.get(ip);
        if (!record || now - record.windowStart > CONFIG.RATE_LIMIT_WINDOW) {
            record = {
                windowStart: now,
                count: 0
            };
            this.clients.set(ip, record);
        }
        
        record.count++;
        
        if (record.count > CONFIG.RATE_LIMIT_MAX) {
            // Ban the IP
            this.clients.set(`banned:${ip}`, { timestamp: now });
            return false;
        }
        
        return true;
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.clients.entries()) {
            if (key.startsWith('banned:')) {
                if (now - value.timestamp > CONFIG.RATE_LIMIT_BAN_DURATION * 2) {
                    this.clients.delete(key);
                }
            } else {
                if (now - value.windowStart > CONFIG.RATE_LIMIT_WINDOW * 2) {
                    this.clients.delete(key);
                }
            }
        }
    }
    
    destroy() {
        clearInterval(this.cleanupInterval);
        this.clients.clear();
    }
}

// ==================== CACHE SYSTEM ====================
class Cache {
    constructor() {
        this.store = new Map();
    }
    
    getKey(req) {
        const parsedUrl = url.parse(req.url);
        const key = `${req.method}:${parsedUrl.pathname}${parsedUrl.search || ''}`;
        return crypto.createHash('md5').update(key).digest('hex');
    }
    
    get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL) {
            this.store.delete(key);
            return null;
        }
        
        return entry;
    }
    
    set(key, value) {
        // Evict oldest if cache is full
        if (this.store.size >= CONFIG.CACHE_MAX_SIZE) {
            const firstKey = this.store.keys().next().value;
            this.store.delete(firstKey);
        }
        
        this.store.set(key, {
            value,
            timestamp: Date.now()
        });
    }
    
    clear() {
        this.store.clear();
    }
    
    get size() {
        return this.store.size;
    }
}

// ==================== IMAGE PROXY ====================
class ImageProxy {
    constructor() {
        this.activeRequests = new Map();
    }
    
    fetchImage(imageUrl, callback) {
        // Check if already fetching this URL
        if (this.activeRequests.has(imageUrl)) {
            this.activeRequests.get(imageUrl).push(callback);
            return;
        }
        
        this.activeRequests.set(imageUrl, [callback]);
        
        const parsedUrl = url.parse(imageUrl);
        const isImgur = parsedUrl.hostname.includes('imgur.com');
        
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'GET',
            timeout: 10000,
            headers: {}
        };
        
        // Add browser-like headers for Imgur
        if (isImgur) {
            options.headers = {
                'User-Agent': CONFIG.IMGUR_USER_AGENT,
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': CONFIG.IMGUR_REFERER,
                'Origin': 'https://imgur.com',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'DNT': '1',
                'Connection': 'keep-alive'
            };
        }
        
        const proxyReq = https.request(options, (proxyRes) => {
            // Handle redirects
            if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302 || proxyRes.statusCode === 307 || proxyRes.statusCode === 308) {
                const redirectUrl = proxyRes.headers.location;
                if (redirectUrl) {
                    // Resolve relative URLs
                    const resolvedUrl = redirectUrl.startsWith('http') 
                        ? redirectUrl 
                        : `https://${parsedUrl.hostname}${redirectUrl}`;
                    
                    // Notify current callbacks and fetch redirect
                    const callbacks = this.activeRequests.get(imageUrl) || [];
                    this.activeRequests.delete(imageUrl);
                    
                    callbacks.forEach(cb => this.fetchImage(resolvedUrl, cb));
                    return;
                }
            }
            
            // Collect response data
            const chunks = [];
            proxyRes.on('data', chunk => chunks.push(chunk));
            proxyRes.on('end', () => {
                const buffer = Buffer.concat(chunks);
                
                // Notify all callbacks waiting for this URL
                const callbacks = this.activeRequests.get(imageUrl) || [];
                this.activeRequests.delete(imageUrl);
                
                callbacks.forEach(cb => {
                    cb(null, {
                        data: buffer,
                        contentType: proxyRes.headers['content-type'] || 'image/jpeg',
                        contentLength: buffer.length,
                        statusCode: proxyRes.statusCode
                    });
                });
            });
        });
        
        proxyReq.on('error', (error) => {
            const callbacks = this.activeRequests.get(imageUrl) || [];
            this.activeRequests.delete(imageUrl);
            
            callbacks.forEach(cb => cb(error));
        });
        
        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            const callbacks = this.activeRequests.get(imageUrl) || [];
            this.activeRequests.delete(imageUrl);
            
            callbacks.forEach(cb => cb(new Error('Request timeout')));
        });
        
        proxyReq.end();
    }
    
    serveImage(imageUrl, res, metrics, cache) {
        const cacheKey = `img:${crypto.createHash('md5').update(imageUrl).digest('hex')}`;
        
        // Check cache
        const cached = cache.get(cacheKey);
        if (cached) {
            metrics.recordCacheHit();
            this.sendImageResponse(res, cached.value);
            return;
        }
        
        metrics.recordCacheMiss();
        
        this.fetchImage(imageUrl, (error, result) => {
            if (error) {
                log('ERROR', `Image proxy error: ${error.message}`);
                res.writeHead(502, { 'Content-Type': 'image/svg+xml' });
                res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
                    <rect fill="#1a1a1a" width="400" height="300"/>
                    <text fill="#ff4444" x="200" y="150" text-anchor="middle" font-size="20">Image Load Failed</text>
                    <text fill="#888" x="200" y="180" text-anchor="middle" font-size="14">${imageUrl.substring(0, 50)}...</text>
                </svg>`);
                return;
            }
            
            // Cache the result
            cache.set(cacheKey, {
                data: result.data,
                contentType: result.contentType,
                contentLength: result.contentLength
            });
            
            this.sendImageResponse(res, {
                data: result.data,
                contentType: result.contentType,
                contentLength: result.contentLength
            });
        });
    }
    
    sendImageResponse(res, imageData) {
        const headers = {
            'Content-Type': imageData.contentType,
            'Content-Length': imageData.contentLength,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
            'X-Proxy-Cache': 'HIT',
            'ETag': crypto.createHash('md5').update(imageData.data).digest('hex')
        };
        
        res.writeHead(200, headers);
        res.end(imageData.data);
    }
}

// ==================== SECURITY ====================
class Security {
    constructor() {
        this.suspiciousPatterns = [
            /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,  // SQL injection attempts
            /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,  // XSS
            /(\%3C)|(<)/i,  // HTML tags in URL
            /\.\.\/|\.\.\\/i,  // Directory traversal
            /\/etc\/passwd/i,  // File access attempts
            /\/bin\/bash/i,  // Command injection
            /wget\s|curl\s/i  // Command download attempts
        ];
        
        this.blockedIPs = new Set();
    }
    
    detectThreat(req) {
        const url = req.url || '';
        const userAgent = req.headers['user-agent'] || '';
        const referer = req.headers['referer'] || '';
        
        // Check URL for suspicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(url)) {
                return { threat: true, reason: 'Suspicious URL pattern detected' };
            }
        }
        
        // Check for common attack tools
        const attackTools = [
            'sqlmap', 'nikto', 'nessus', 'burpsuite', 'w3af',
            'acunetix', 'appscan', 'netsparker', 'zap', 'webscarab',
            'masscan', 'nmap', 'zgrab', 'gobuster', 'dirbuster',
            'hydra', 'medusa', 'metasploit', 'beef', 'xsser'
        ];
        
        const uaLower = userAgent.toLowerCase();
        for (const tool of attackTools) {
            if (uaLower.includes(tool)) {
                return { threat: true, reason: `Attack tool detected: ${tool}` };
            }
        }
        
        // Check for empty or missing User-Agent
        if (!userAgent || userAgent.trim() === '') {
            return { threat: true, reason: 'Empty User-Agent' };
        }
        
        // Check for extremely long URLs
        if (url.length > 2000) {
            return { threat: true, reason: 'URL too long' };
        }
        
        // Check for null bytes
        if (url.includes('\0') || userAgent.includes('\0')) {
            return { threat: true, reason: 'Null byte injection attempt' };
        }
        
        return { threat: false };
    }
    
    applySecurityHeaders(res) {
        // Content-Security-Policy
        const cspString = Object.entries(CONFIG.CSP_DIRECTIVES)
            .map(([key, values]) => `${key} ${values.join(' ')}`)
            .join('; ');
        
        res.setHeader('Content-Security-Policy', cspString);
        res.setHeader('X-Content-Security-Policy', cspString);
        res.setHeader('X-WebKit-CSP', cspString);
        
        // Security headers
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        res.setHeader('X-Download-Options', 'noopen');
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
        
        // Remove sensitive headers
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');
    }
    
    getClientIP(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = forwarded.split(',');
            return ips[0].trim();
        }
        
        const realIP = req.headers['x-real-ip'];
        if (realIP) return realIP;
        
        return req.socket.remoteAddress || '127.0.0.1';
    }
}

// ==================== COMPRESSION ====================
class Compressor {
    constructor() {
        this.compressibleTypes = [
            'text/html',
            'text/css',
            'text/javascript',
            'text/plain',
            'text/xml',
            'application/javascript',
            'application/json',
            'application/xml',
            'application/rss+xml',
            'image/svg+xml'
        ];
    }
    
    shouldCompress(contentType, contentLength) {
        if (contentLength < 1024) return false; // Don't compress small files
        if (contentLength > 10485760) return false; // Don't compress files > 10MB
        return this.compressibleTypes.some(type => 
            contentType.toLowerCase().startsWith(type)
        );
    }
    
    compress(data, encoding, callback) {
        let compressor;
        
        switch (encoding) {
            case 'br':
                compressor = zlib.createBrotliCompress({
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
                        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
                    }
                });
                break;
            case 'gzip':
                compressor = zlib.createGzip({ level: 6, memLevel: 8 });
                break;
            case 'deflate':
                compressor = zlib.createDeflate({ level: 6 });
                break;
            default:
                return callback(null, data);
        }
        
        const chunks = [];
        compressor.on('data', chunk => chunks.push(chunk));
        compressor.on('end', () => callback(null, Buffer.concat(chunks)));
        compressor.on('error', callback);
        
        compressor.write(data);
        compressor.end();
    }
    
    getEncoding(req) {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        
        if (/\bbr\b/.test(acceptEncoding)) return 'br';
        if (/\bgzip\b/.test(acceptEncoding)) return 'gzip';
        if (/\bdeflate\b/.test(acceptEncoding)) return 'deflate';
        
        return 'identity';
    }
}

// ==================== DATA ====================
const DATA = {
    celebrity: {
        name: "Baiilla Maach Official",
        photo: "/image?url=https://i.imgur.com/yBIY66i.jpeg",
        bio: "শুধুমাত্র এন্টারটেইনমেন্টের জন্য। অন্য সব একাউন্ট ভুয়া।",
        socialLinks: {
            tiktok: "https://tiktok.com/@baiillamaach_official"
        }
    },
    realAccounts: [
        {
            platform: "TikTok",
            username: "@baiillamaach_official",
            url: "https://tiktok.com/@baiillamaach_official",
            verified: true,
            followers: "100K+",
            description: "একমাত্র অফিসিয়াল একাউন্ট"
        }
    ],
    fakeAccounts: [
        {
            platform: "TikTok",
            username: "@baiilla_mach",
            profileUrl: "https://tiktok.com/@baiilla_mach",
            screenshot: "/image?url=https://i.imgur.com/JM5hQmH.jpeg",
            dangerLevel: "high",
            riskScore: 100,
            fraudType: "Impersonation",
            reason: "বানান কপি করে ভুয়া একাউন্ট। একটি 'l' এবং একটি 'a' কম আছে। হুবহু লোগো ও পোস্ট কপি করে প্রতারণা করছে।",
            warningText: "⚠️ এই একাউন্ট থেকে ইনবক্সে মেসেজ এলে উত্তর দিবেন না এবং কোনো টাকা পাঠাবেন না!"
        },
        {
            platform: "TikTok",
            username: "@hammad_fams0",
            profileUrl: "https://tiktok.com/@hammad_fams0",
            screenshot: "/image?url=https://i.imgur.com/9mFUyji.jpeg",
            dangerLevel: "medium",
            riskScore: 85,
            fraudType: "Fake Account",
            reason: "নাম ও ছবি ব্যবহার করে ভুয়া একাউন্ট। ফলোয়ারদের বিভ্রান্ত করছে।",
            warningText: "⚠️ এটি একটি ফেক একাউন্ট। আমাদের সাথে এর কোনো সম্পর্ক নেই।"
        }
    ],
    tips: [
        {
            icon: "🔍",
            title: "ইউজারনেম যাচাই করুন",
            description: "আমাদের অফিসিয়াল ইউজারনেম @baiillamaach_official। বানান মিলিয়ে নিন।"
        },
        {
            icon: "🔒",
            title: "তথ্য শেয়ার করবেন না",
            description: "অফিসিয়াল একাউন্ট কখনো ইনবক্সে গিয়ে টাকা বা ব্যক্তিগত তথ্য চাইবে না।"
        },
        {
            icon: "🚨",
            title: "ভুয়া একাউন্ট রিপোর্ট করুন",
            description: "সন্দেহজনক একাউন্ট দেখলে TikTok-এ গিয়ে Report করুন।"
        },
        {
            icon: "✅",
            title: "ভেরিফাইড ব্যাজ দেখুন",
            description: "আমাদের অফিসিয়াল একাউন্টে ভেরিফিকেশন ব্যাজ আছে।"
        }
    ]
};

// ==================== HTML TEMPLATE ====================
class Template {
    static getMainPage() {
        return `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${DATA.celebrity.name} - অফিসিয়াল পেজ। ভুয়া একাউন্ট থেকে সাবধান!">
    <meta name="keywords" content="Baiilla Maach, Official, TikTok, Anti-Fraud, Bangladesh">
    <meta name="author" content="${DATA.celebrity.name}">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#ff2d55">
    
    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${DATA.celebrity.name} - অফিসিয়াল">
    <meta property="og:description" content="শুধুমাত্র এন্টারটেইনমেন্টের জন্য। ভুয়া একাউন্ট থেকে সাবধান!">
    <meta property="og:image" content="https://i.imgur.com/yBIY66i.jpeg">
    <meta property="og:url" content="https://baiillamaach.com">
    <meta property="og:site_name" content="${DATA.celebrity.name}">
    <meta property="og:locale" content="bn_BD">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${DATA.celebrity.name} - অফিসিয়াল">
    <meta name="twitter:description" content="শুধুমাত্র এন্টারটেইনমেন্টের জন্য। ভুয়া একাউন্ট থেকে সাবধান!">
    <meta name="twitter:image" content="https://i.imgur.com/yBIY66i.jpeg">
    
    <!-- PWA -->
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="https://i.imgur.com/yBIY66i.jpeg">
    
    <title>${DATA.celebrity.name} | অফিসিয়াল পেজ | ভুয়া একাউন্ট থেকে সাবধান</title>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        /* ============ CSS RESET & VARIABLES ============ */
        :root {
            --primary: #ff2d55;
            --primary-dark: #cc0044;
            --secondary: #ff6b00;
            --success: #22c55e;
            --warning: #ffcc00;
            --danger: #ff4444;
            --bg-primary: #000000;
            --bg-secondary: #0a0a0a;
            --bg-tertiary: #111111;
            --bg-card: #1a1a1a;
            --text-primary: #ffffff;
            --text-secondary: #dddddd;
            --text-muted: #888888;
            --border-color: #222222;
            --shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
            --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
            --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
            --shadow-glow-red: 0 0 20px rgba(255,45,85,0.3);
            --shadow-glow-green: 0 0 20px rgba(34,197,94,0.3);
            --radius-sm: 8px;
            --radius-md: 12px;
            --radius-lg: 16px;
            --radius-xl: 20px;
            --radius-full: 50%;
            --transition-fast: 0.2s ease;
            --transition-normal: 0.3s ease;
            --transition-slow: 0.5s ease;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html {
            scroll-behavior: smooth;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        body {
            font-family: 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.8;
            overflow-x: hidden;
        }
        
        /* ============ SCROLLBAR ============ */
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--bg-secondary);
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--primary);
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: var(--primary-dark);
        }
        
        /* ============ HEADER ============ */
        .header {
            text-align: center;
            padding: 60px 20px 50px;
            background: linear-gradient(180deg, #0d0015 0%, #000000 100%);
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at center, rgba(255,45,85,0.1) 0%, transparent 60%);
            animation: headerGlow 8s ease-in-out infinite;
            pointer-events: none;
        }
        
        @keyframes headerGlow {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(180deg); }
        }
        
        .header-content {
            position: relative;
            z-index: 1;
        }
        
        .photo-container {
            position: relative;
            display: inline-block;
            margin-bottom: 20px;
        }
        
        .photo {
            width: 150px;
            height: 150px;
            border-radius: var(--radius-full);
            border: 5px solid var(--primary);
            object-fit: cover;
            box-shadow: var(--shadow-glow-red);
            transition: transform var(--transition-normal);
            background: var(--bg-tertiary);
        }
        
        .photo:hover {
            transform: scale(1.08);
        }
        
        .verified-badge-icon {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: var(--success);
            color: white;
            width: 35px;
            height: 35px;
            border-radius: var(--radius-full);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            border: 3px solid var(--bg-primary);
            box-shadow: var(--shadow-md);
        }
        
        .name {
            font-size: 2.5em;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff, #ff2d55);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: none;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        .bio {
            color: var(--text-secondary);
            font-size: 1.2em;
            max-width: 500px;
            margin: 0 auto 20px;
        }
        
        .badge-row {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .badge {
            padding: 10px 24px;
            border-radius: 30px;
            font-size: 0.9em;
            font-weight: 700;
            letter-spacing: 0.5px;
            transition: transform var(--transition-fast);
        }
        
        .badge:hover {
            transform: translateY(-2px);
        }
        
        .badge-official {
            background: var(--primary);
            color: white;
            box-shadow: var(--shadow-glow-red);
            animation: pulse 2s infinite;
        }
        
        .badge-fun {
            background: var(--secondary);
            color: white;
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255,45,85,0.5); }
            50% { box-shadow: 0 0 0 20px rgba(255,45,85,0); }
        }
        
        /* ============ CONTAINER ============ */
        .container {
            max-width: 850px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* ============ WARNING HERO ============ */
        .warning-hero {
            background: linear-gradient(135deg, #1a0000, #0d0000);
            border: 2px solid var(--danger);
            border-radius: var(--radius-lg);
            padding: 35px 30px;
            margin: 30px 0;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .warning-hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255,68,68,0.02) 10px,
                rgba(255,68,68,0.02) 20px
            );
            pointer-events: none;
        }
        
        .big-icon {
            font-size: 4em;
            display: block;
            margin-bottom: 15px;
            animation: shake 0.5s infinite;
        }
        
        @keyframes shake {
            0%, 100% { transform: rotate(0); }
            25% { transform: rotate(-8deg); }
            75% { transform: rotate(8deg); }
        }
        
        .warning-hero h2 {
            color: var(--danger);
            font-size: 1.5em;
            margin-bottom: 12px;
            position: relative;
        }
        
        .warning-hero p {
            color: #ffaaaa;
            font-size: 1.05em;
            line-height: 1.9;
            position: relative;
        }
        
        /* ============ GUIDE SECTION ============ */
        .guide-section {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 30px;
            margin: 30px 0;
        }
        
        .guide-section h3 {
            color: var(--warning);
            font-size: 1.2em;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .guide-step {
            background: var(--bg-tertiary);
            border-radius: var(--radius-md);
            padding: 20px;
            margin: 15px 0;
            border-left: 5px solid var(--success);
            transition: transform var(--transition-fast);
        }
        
        .guide-step:hover {
            transform: translateX(5px);
        }
        
        .guide-step.fake-step {
            border-left-color: var(--danger);
        }
        
        .guide-step.fake-step.high-danger {
            border-left-color: #ff0000;
            background: #140000;
            border-width: 5px;
        }
        
        .guide-step h4 {
            font-size: 1.1em;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .step-num {
            background: var(--bg-primary);
            width: 32px;
            height: 32px;
            border-radius: var(--radius-full);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9em;
            font-weight: 700;
            flex-shrink: 0;
            border: 2px solid var(--border-color);
        }
        
        .guide-step p {
            color: var(--text-secondary);
            font-size: 0.95em;
            line-height: 1.8;
        }
        
        .highlight {
            color: var(--danger);
            font-weight: 700;
        }
        
        .spelling-note {
            background: #1a1a00;
            color: var(--warning);
            padding: 8px 16px;
            border-radius: var(--radius-sm);
            display: inline-block;
            font-size: 0.9em;
            margin: 8px 0;
            border: 1px solid #333300;
        }
        
        /* ============ SECTION ============ */
        .section {
            margin: 40px 0;
        }
        
        .section-title {
            font-size: 1.5em;
            font-weight: 700;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 3px solid var(--success);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .section-title.fake-title {
            border-bottom-color: var(--danger);
        }
        
        .section-title .count {
            font-size: 0.8em;
            color: var(--text-muted);
            font-weight: 400;
        }
        
        /* ============ ACCOUNT CARDS ============ */
        .account-card {
            border-radius: var(--radius-lg);
            padding: 25px;
            margin: 18px 0;
            transition: all var(--transition-normal);
            position: relative;
            overflow: hidden;
        }
        
        .account-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
        }
        
        .account-card.verified {
            background: #0a1a0a;
            border: 2px solid var(--success);
            box-shadow: var(--shadow-glow-green);
        }
        
        .account-card.fake {
            background: #1a0a0a;
            border: 2px solid var(--danger);
        }
        
        .account-card.high-danger {
            border-width: 3px;
            box-shadow: 0 0 30px rgba(255,68,68,0.3);
            animation: dangerPulse 2s infinite;
        }
        
        @keyframes dangerPulse {
            0%, 100% { box-shadow: 0 0 20px rgba(255,68,68,0.2); }
            50% { box-shadow: 0 0 40px rgba(255,68,68,0.4); }
        }
        
        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }
        
        .platform-badge {
            font-weight: 700;
            font-size: 0.85em;
            padding: 6px 16px;
            border-radius: 25px;
            letter-spacing: 0.5px;
        }
        
        .verified-badge {
            background: var(--success);
            color: #000;
        }
        
        .fake-badge {
            background: var(--danger);
            color: white;
        }
        
        .username {
            font-size: 1.3em;
            font-weight: 700;
            letter-spacing: 1px;
            font-family: 'Courier New', monospace;
        }
        
        .tag {
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
            display: inline-block;
            margin: 8px 0;
        }
        
        .official-tag {
            background: var(--success);
            color: #000;
        }
        
        .fake-tag {
            background: var(--danger);
            color: white;
        }
        
        .screenshot-box {
            text-align: center;
            margin: 18px 0;
            background: #000;
            border-radius: var(--radius-md);
            padding: 18px;
            border: 1px solid var(--border-color);
            position: relative;
        }
        
        .proof-img {
            max-width: 100%;
            max-height: 350px;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all var(--transition-normal);
            border: 1px solid #333;
            background: #1a1a1a;
        }
        
        .proof-img:hover {
            transform: scale(1.02);
        }
        
        .proof-img.zoomed {
            transform: scale(2);
            z-index: 1000;
            position: relative;
            box-shadow: 0 20px 60px rgba(0,0,0,0.9);
            cursor: zoom-out;
        }
        
        .click-hint {
            display: block;
            color: var(--text-muted);
            font-size: 0.8em;
            margin-top: 8px;
        }
        
        .reason {
            color: #ffaaaa;
            font-size: 0.95em;
            margin: 12px 0;
            padding: 12px;
            background: rgba(255,0,0,0.1);
            border-radius: var(--radius-sm);
            line-height: 1.7;
            border-left: 3px solid var(--danger);
        }
        
        .warning-text {
            color: var(--warning);
            font-size: 0.9em;
            margin: 10px 0;
            padding: 10px;
            background: rgba(255,204,0,0.1);
            border-radius: var(--radius-sm);
            text-align: center;
        }
        
        .risk-score {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.8em;
            font-weight: 700;
            background: #ff0000;
            color: white;
            margin-left: 8px;
        }
        
        /* ============ BUTTONS ============ */
        .action-buttons {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 16px;
        }
        
        .btn {
            padding: 14px 28px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: 700;
            font-size: 0.95em;
            transition: all var(--transition-fast);
            cursor: pointer;
            border: none;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            justify-content: center;
            letter-spacing: 0.5px;
            position: relative;
            overflow: hidden;
        }
        
        .btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            transition: all 0.5s ease;
        }
        
        .btn:hover::before {
            width: 300px;
            height: 300px;
            top: -100px;
            left: -100px;
        }
        
        .btn-icon {
            font-size: 1.2em;
        }
        
        .btn-follow {
            background: var(--success);
            color: #000;
            font-size: 1.05em;
            box-shadow: var(--shadow-glow-green);
        }
        
        .btn-follow:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 25px rgba(34,197,94,0.5);
        }
        
        .btn-report {
            background: var(--primary);
            color: white;
            font-size: 1.05em;
            box-shadow: var(--shadow-glow-red);
        }
        
        .btn-report:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 25px rgba(255,45,85,0.5);
        }
        
        .btn-copy {
            background: #2a2a2a;
            color: white;
        }
        
        .btn-copy:hover {
            background: #444;
            transform: translateY(-2px);
        }
        
        .btn-copy.copied {
            background: var(--success) !important;
            color: #000 !important;
        }
        
        /* ============ ACTION STEPS ============ */
        .action-steps {
            background: var(--bg-secondary);
            border: 3px solid var(--warning);
            border-radius: var(--radius-xl);
            padding: 35px;
            margin: 40px 0;
            position: relative;
        }
        
        .action-steps::before {
            content: '🛡️';
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 3em;
            background: var(--bg-secondary);
            padding: 0 15px;
        }
        
        .action-steps h3 {
            color: var(--warning);
            font-size: 1.3em;
            margin-bottom: 25px;
            text-align: center;
        }
        
        .action-steps ol {
            list-style: none;
            counter-reset: step;
            padding: 0;
        }
        
        .action-steps ol li {
            counter-increment: step;
            padding: 16px 16px 16px 55px;
            position: relative;
            color: var(--text-secondary);
            font-size: 1em;
            line-height: 1.8;
            margin: 12px 0;
            background: var(--bg-tertiary);
            border-radius: var(--radius-md);
            transition: transform var(--transition-fast);
        }
        
        .action-steps ol li:hover {
            transform: translateX(5px);
            background: #1a1a1a;
        }
        
        .action-steps ol li::before {
            content: counter(step);
            position: absolute;
            left: 12px;
            top: 16px;
            width: 32px;
            height: 32px;
            background: var(--warning);
            color: #000;
            border-radius: var(--radius-full);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1em;
        }
        
        .tip-box {
            background: #1a1a00;
            border: 2px solid var(--warning);
            border-radius: var(--radius-md);
            padding: 18px;
            margin-top: 20px;
            text-align: center;
        }
        
        .tip-box strong {
            color: var(--warning);
        }
        
        /* ============ TIPS GRID ============ */
        .tips-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        
        .tip-card {
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
            padding: 25px;
            text-align: center;
            border: 1px solid var(--border-color);
            transition: all var(--transition-normal);
        }
        
        .tip-card:hover {
            transform: translateY(-5px);
            border-color: var(--warning);
            box-shadow: 0 10px 30px rgba(255,204,0,0.1);
        }
        
        .tip-icon {
            font-size: 3em;
            display: block;
            margin-bottom: 15px;
        }
        
        .tip-card h4 {
            color: var(--warning);
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        
        .tip-card p {
            color: var(--text-muted);
            font-size: 0.9em;
            line-height: 1.6;
        }
        
        /* ============ FOOTER ============ */
        .footer {
            text-align: center;
            padding: 50px 20px;
            color: var(--text-muted);
            font-size: 0.9em;
            line-height: 2;
            border-top: 1px solid var(--border-color);
            margin-top: 50px;
            background: var(--bg-secondary);
        }
        
        .footer .heart {
            color: var(--primary);
            animation: heartbeat 1.5s infinite;
            display: inline-block;
        }
        
        @keyframes heartbeat {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.3); }
            50% { transform: scale(1); }
            75% { transform: scale(1.3); }
        }
        
        .footer-links {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
            margin: 15px 0;
        }
        
        .footer-links a {
            color: var(--text-muted);
            text-decoration: none;
            transition: color var(--transition-fast);
        }
        
        .footer-links a:hover {
            color: var(--primary);
        }
        
        /* ============ BACK TO TOP ============ */
        .back-to-top {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            background: var(--primary);
            color: white;
            border-radius: var(--radius-full);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5em;
            cursor: pointer;
            box-shadow: var(--shadow-md);
            transition: all var(--transition-normal);
            z-index: 999;
            border: none;
            opacity: 0;
            visibility: hidden;
        }
        
        .back-to-top.visible {
            opacity: 1;
            visibility: visible;
        }
        
        .back-to-top:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-glow-red);
        }
        
        /* ============ COPY TOAST ============ */
        .toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--success);
            color: #000;
            padding: 15px 30px;
            border-radius: 30px;
            font-weight: 700;
            z-index: 10000;
            box-shadow: var(--shadow-lg);
            animation: slideUp 0.3s ease, fadeOut 0.3s ease 2s forwards;
        }
        
        @keyframes slideUp {
            from { transform: translateX(-50%) translateY(100px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        /* ============ RESPONSIVE ============ */
        @media (max-width: 768px) {
            .header {
                padding: 40px 15px 30px;
            }
            
            .photo {
                width: 120px;
                height: 120px;
            }
            
            .name {
                font-size: 1.8em;
            }
            
            .bio {
                font-size: 1em;
            }
            
            .warning-hero {
                padding: 25px 18px;
            }
            
            .big-icon {
                font-size: 3em;
            }
            
            .warning-hero h2 {
                font-size: 1.2em;
            }
            
            .guide-section {
                padding: 20px 15px;
            }
            
            .account-card {
                padding: 18px 15px;
            }
            
            .card-header {
                justify-content: center;
                text-align: center;
            }
            
            .action-buttons {
                flex-direction: column;
            }
            
            .btn {
                width: 100%;
                padding: 12px 20px;
            }
            
            .action-steps {
                padding: 25px 15px;
            }
            
            .action-steps ol li {
                padding-left: 45px;
                font-size: 0.9em;
            }
            
            .section-title {
                font-size: 1.2em;
                justify-content: center;
                text-align: center;
            }
            
            .tips-grid {
                grid-template-columns: 1fr;
            }
            
            .back-to-top {
                bottom: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                font-size: 1.2em;
            }
        }
        
        @media (max-width: 480px) {
            .name {
                font-size: 1.5em;
            }
            
            .badge-row {
                gap: 8px;
            }
            
            .badge {
                padding: 8px 16px;
                font-size: 0.8em;
            }
            
            .username {
                font-size: 1.1em;
            }
        }
    </style>
</head>
<body>
    <!-- ============ HEADER ============ -->
    <header class="header">
        <div class="header-content">
            <div class="photo-container">
                <img src="${DATA.celebrity.photo}" alt="${DATA.celebrity.name}" class="photo" loading="eager" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22><rect fill=%22%23333%22 width=%22150%22 height=%22150%22/><text fill=%22%23ff2d55%22 x=%2275%22 y=%2275%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22>?</text></svg>'">
                <span class="verified-badge-icon">✓</span>
            </div>
            <h1 class="name">${DATA.celebrity.name}</h1>
            <p class="bio">${DATA.celebrity.bio}</p>
            <div class="badge-row">
                <span class="badge badge-official">✅ অফিসিয়াল পেজ</span>
                <span class="badge badge-fun">🎭 এন্টারটেইনমেন্ট</span>
            </div>
        </div>
    </header>
    
    <div class="container">
        <!-- ============ WARNING ============ -->
        <div class="warning-hero">
            <span class="big-icon">⚠️</span>
            <h2>সাবধান! আমার নামে অনেক ভুয়া একাউন্ট আছে</h2>
            <p>${DATA.celebrity.name} নাম ব্যবহার করে অনেকেই ভুয়া একাউন্ট খুলেছে এবং প্রতারণা করছে।<br>দয়া করে নিচের তথ্যগুলো ভালোভাবে পড়ুন এবং সাবধান থাকুন।</p>
        </div>
        
        <!-- ============ GUIDE ============ -->
        <div class="guide-section">
            <h3>📖 আসল একাউন্ট চেনার উপায়</h3>
            
            <div class="guide-step">
                <h4><span class="step-num">১</span> আসল একাউন্ট</h4>
                <p><strong>অফিসিয়াল ইউজারনেম:</strong> <span style="color:#22c55e;font-weight:700;font-size:1.1em;">@baiillamaach_official</span></p>
                <p>এটিই আমাদের <strong>একমাত্র অফিসিয়াল প্রোফাইল।</strong> আমাদের সব অথেনটিক আপডেট এবং কন্টেন্ট শুধুমাত্র এই একাউন্ট থেকেই পোস্ট করা হয়। এর বাইরে আমাদের অন্য কোনো ব্যাকআপ বা পার্সোনাল একাউন্ট <strong>নেই।</strong></p>
            </div>
            
            <div class="guide-step fake-step high-danger">
                <h4><span class="step-num">২</span> প্রধান ভুয়া একাউন্ট <span class="risk-score">ঝুঁকি: ১০০%</span></h4>
                <p><strong>নকল ইউজারনেম:</strong> <span class="highlight">@baiilla_mach</span></p>
                <p class="spelling-note">⚠️ বানান খেয়াল করুন: এখানে একটি <strong>'l'</strong> এবং একটি <strong>'a'</strong> কম আছে</p>
                <p>এই একাউন্টটি হুবহু আমাদের লোগো এবং পোস্ট কপি করে মানুষের সাথে প্রতারণা করছে। এরা ইনবক্সে নক করে টাকা চাইতে পারে।</p>
            </div>
            
            <div class="guide-step fake-step">
                <h4><span class="step-num">৩</span> স্প্যাম ভুয়া একাউন্ট <span class="risk-score">ঝুঁকি: ৮৫%</span></h4>
                <p><strong>নকল ইউজারনেম:</strong> <span class="highlight">@hammad_fams0</span></p>
                <p>এটি আরেকটি ফেক একাউন্ট যা আমাদের নাম ও ছবি ব্যবহার করে ফলোয়ারদের বিভ্রান্ত করছে। এই ধরনের একাউন্ট থেকে সাবধান।</p>
            </div>
        </div>
        
        <!-- ============ REAL ACCOUNT ============ -->
        <div class="section">
            <h2 class="section-title">✅ আসল একাউন্ট <span class="count">(১টি)</span></h2>
            ${DATA.realAccounts.map(a => `
            <div class="account-card verified">
                <div class="card-header">
                    <span class="platform-badge verified-badge">✅ ${a.platform}</span>
                    <span class="username">${a.username}</span>
                </div>
                <span class="tag official-tag">✨ অফিসিয়াল ও ভেরিফাইড</span>
                <p style="color:#aaa;margin:10px 0;">${a.description} | ফলোয়ার: ${a.followers}</p>
                <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn btn-follow">
                    <span class="btn-icon">👉</span> ফলো করতে ক্লিক করুন
                </a>
            </div>
            `).join('')}
        </div>
        
        <!-- ============ FAKE ACCOUNTS ============ -->
        <div class="section">
            <h2 class="section-title fake-title">🚨 ভুয়া একাউন্ট সমূহ <span class="count">(${DATA.fakeAccounts.length}টি)</span></h2>
            ${DATA.fakeAccounts.map(a => `
            <div class="account-card fake ${a.dangerLevel === 'high' ? 'high-danger' : ''}">
                <div class="card-header">
                    <span class="platform-badge fake-badge">🚨 ${a.platform}</span>
                    <span class="username">${a.username}</span>
                </div>
                <span class="tag fake-tag">⚠️ ভুয়া একাউন্ট</span>
                <span class="risk-score">ঝুঁকি: ${a.riskScore}%</span>
                
                ${a.screenshot ? `
                <div class="screenshot-box">
                    <img src="${a.screenshot}" alt="${a.username}" class="proof-img" onclick="this.classList.toggle('zoomed')" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <span class="click-hint">🖱️ ক্লিক করে বড় করে দেখুন</span>
                    <p style="display:none;color:#ff4444;margin-top:10px;">⚠️ ইমেজ লোড করা যায়নি। কিন্তু একাউন্টটি ভুয়া।</p>
                </div>` : ''}
                
                ${a.reason ? `<p class="reason"><strong>⚠️ কারণ:</strong> ${a.reason}</p>` : ''}
                ${a.warningText ? `<p class="warning-text">${a.warningText}</p>` : ''}
                
                <div class="action-buttons">
                    <a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-report">
                        <span class="btn-icon">🚨</span> রিপোর্ট করতে ক্লিক করুন
                    </a>
                    <button class="btn btn-copy" data-username="${a.username}" onclick="copyUsername(this, '${a.username}')">
                        <span class="btn-icon">📋</span> ইউজারনেম কপি করুন
                    </button>
                </div>
            </div>
            `).join('')}
        </div>
        
        <!-- ============ TIPS ============ -->
        <div class="section">
            <h2 class="section-title" style="border-bottom-color:#ffcc00;">💡 নিরাপত্তা টিপস</h2>
            <div class="tips-grid">
                ${DATA.tips.map(tip => `
                <div class="tip-card">
                    <span class="tip-icon">${tip.icon}</span>
                    <h4>${tip.title}</h4>
                    <p>${tip.description}</p>
                </div>
                `).join('')}
            </div>
        </div>
        
        <!-- ============ ACTION STEPS ============ -->
        <div class="action-steps">
            <h3>🛡️ আপনার করণীয়</h3>
            <ol>
                <li>উপরের ভুয়া একাউন্টগুলোতে (<strong>@baiilla_mach</strong> এবং <strong>@hammad_fams0</strong>) গিয়ে <strong>"Report → Scam or Fraud"</strong> অপশনে ক্লিক করে রিপোর্ট করুন।</li>
                <li>আমাদের অফিসিয়াল পেজ ছাড়া অন্য কোথাও কোনো <strong>ব্যক্তিগত তথ্য</strong> বা <strong>বিকাশ/নগদ/রকেট</strong> নাম্বার শেয়ার করবেন না।</li>
                <li>কোনো একাউন্টের ওপর সন্দেহ হলে শুধুমাত্র এই পেজে দেওয়া <strong>অফিসিয়াল লিংক</strong> ব্যবহার করে যোগাযোগ করুন।</li>
                <li>সন্দেহজনক মেসেজ পেলে তার <strong>স্ক্রিনশট</strong> সংরক্ষণ করুন এবং আমাদের জানান।</li>
            </ol>
            <div class="tip-box">
                <strong>💡 গুরুত্বপূর্ণ টিপস:</strong> আমরা কখনো ইনবক্সে গিয়ে টাকা চাইবো না। কেউ টাকা চাইলে বুঝবেন সেটা ভুয়া একাউন্ট। আমাদের একমাত্র অফিসিয়াল ইউজারনেম: <strong style="color:#22c55e;">@baiillamaach_official</strong>
            </div>
        </div>
    </div>
    
    <!-- ============ FOOTER ============ -->
    <footer class="footer">
        <p>© ${new Date().getFullYear()} ${DATA.celebrity.name}</p>
        <p>শুধুমাত্র এন্টারটেইনমেন্টের জন্য <span class="heart">❤️</span></p>
        <div class="footer-links">
            <a href="/">হোম</a>
            <a href="/data.json">API</a>
            <a href="/health">হেলথ</a>
            <a href="/metrics">মেট্রিক্স</a>
        </div>
        <p style="font-size:0.8em;margin-top:10px;">এই ওয়েবসাইটটি একটি ওপেন-সোর্স প্রকল্প। ভুয়া একাউন্টের শিকার হলে রিপোর্ট করুন।</p>
    </footer>
    
    <!-- ============ BACK TO TOP ============ -->
    <button class="back-to-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="উপরে যান">↑</button>
    
    <!-- ============ SCRIPTS ============ -->
    <script>
        // Copy Username
        function copyUsername(btn, username) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(username).then(() => {
                    showCopySuccess(btn);
                }).catch(() => {
                    fallbackCopy(btn, username);
                });
            } else {
                fallbackCopy(btn, username);
            }
        }
        
        function fallbackCopy(btn, username) {
            const textarea = document.createElement('textarea');
            textarea.value = username;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showCopySuccess(btn);
            } catch (err) {
                alert('ইউজারনেম: ' + username);
            }
            document.body.removeChild(textarea);
        }
        
        function showCopySuccess(btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="btn-icon">✅</span> কপি হয়েছে!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('copied');
            }, 2000);
        }
        
        // Image zoom
        document.querySelectorAll('.proof-img').forEach(img => {
            img.addEventListener('click', function(e) {
                this.classList.toggle('zoomed');
                if (this.classList.contains('zoomed')) {
                    document.body.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Close zoom on ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.proof-img.zoomed').forEach(img => {
                    img.classList.remove('zoomed');
                    document.body.style.overflow = '';
                });
            }
        });
        
        // Close zoom on click outside
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('zoomed')) {
                e.target.classList.remove('zoomed');
                document.body.style.overflow = '';
            }
        });
        
        // Back to top button
        const backToTopBtn = document.querySelector('.back-to-top');
        window.addEventListener('scroll', function() {
            if (window.scrollY > 500) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        // Image error handling
        document.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', function() {
                console.warn('Image failed to load:', this.src);
                this.style.display = 'none';
                const fallback = this.nextElementSibling;
                if (fallback && fallback.tagName === 'P') {
                    fallback.style.display = 'block';
                }
            });
            
            img.addEventListener('load', function() {
                console.log('Image loaded successfully:', this.src.substring(0, 50));
            });
        });
        
        // Service Worker Registration (PWA)
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('ServiceWorker registered');
                }).catch(err => {
                    console.log('ServiceWorker registration failed:', err);
                });
            });
        }
        
        // Console warning
        console.log('%c⚠️ সাবধান! %cএটি একটি অফিসিয়াল পেজ। %cকনসোলে কোনো কোড পেস্ট করবেন না যদি না আপনি জানেন কি করছেন।',
            'color: red; font-size: 20px;',
            'color: white; font-size: 14px;',
            'color: yellow; font-size: 12px;'
        );
    </script>
</body>
</html>`;
    }
}

// ==================== APPLICATION ====================
class Application {
    constructor() {
        this.metrics = new Metrics();
        this.rateLimiter = new RateLimiter();
        this.cache = new Cache();
        this.security = new Security();
        this.compressor = new Compressor();
        this.imageProxy = new ImageProxy();
        this.server = null;
        this.activeConnections = new Set();
        this.isShuttingDown = false;
    }
    
    handleRequest(req, res) {
        const startTime = performance.now();
        const clientIP = this.security.getClientIP(req);
        
        // Track connection
        this.activeConnections.add(res.socket);
        res.socket.on('close', () => {
            this.activeConnections.delete(res.socket);
            this.metrics.recordConnectionClose();
        });
        
        // Set timeout
        res.socket.setTimeout(CONFIG.REQUEST_TIMEOUT, () => {
            res.socket.destroy();
        });
        
        // Security check
        const threatCheck = this.security.detectThreat(req);
        if (threatCheck.threat) {
            log('WARN', `Security threat from ${clientIP}: ${threatCheck.reason}`);
            this.metrics.recordBlock();
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        
        // Rate limiting
        if (!this.rateLimiter.isAllowed(clientIP)) {
            log('WARN', `Rate limited: ${clientIP}`);
            this.metrics.recordRateLimit();
            res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': '900'
            });
            res.end(JSON.stringify({
                error: 'Too Many Requests',
                message: 'অনেক বেশি রিকোয়েস্ট। ১৫ মিনিট পর আবার চেষ্টা করুন।'
            }));
            return;
        }
        
        // Parse URL
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;
        
        // Apply security headers
        this.security.applySecurityHeaders(res);
        
        // ==================== ROUTES ====================
        
        // Image Proxy
        if (pathname === '/image' && parsedUrl.query.url) {
            const imageUrl = parsedUrl.query.url;
            
            // Only allow Imgur URLs
            if (imageUrl.includes('i.imgur.com') || imageUrl.includes('imgur.com')) {
                this.imageProxy.serveImage(imageUrl, res, this.metrics, this.cache);
            } else {
                res.writeHead(403);
                res.end('Only Imgur URLs allowed');
            }
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Main Page
        if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
            const cacheKey = this.cache.getKey(req);
            const cached = this.cache.get(cacheKey);
            
            if (cached) {
                this.metrics.recordCacheHit();
                this.sendResponse(req, res, cached.value, 'text/html');
                this.metrics.recordRequest(req, res, performance.now() - startTime);
                return;
            }
            
            this.metrics.recordCacheMiss();
            
            const html = Template.getMainPage();
            this.cache.set(cacheKey, html);
            
            this.sendResponse(req, res, html, 'text/html');
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Data API
        if (pathname === '/data.json') {
            const jsonData = JSON.stringify(DATA, null, 2);
            this.sendResponse(req, res, jsonData, 'application/json');
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Health Check
        if (pathname === '/health') {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '3.0.0'
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health));
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Metrics
        if (pathname === '/metrics') {
            const stats = this.metrics.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats, null, 2));
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Manifest (PWA)
        if (pathname === '/manifest.json') {
            const manifest = {
                name: 'Baiilla Maach Official',
                short_name: 'Baiilla Maach',
                description: 'অফিসিয়াল পেজ - ভুয়া একাউন্ট থেকে সাবধান',
                start_url: '/',
                display: 'standalone',
                background_color: '#000000',
                theme_color: '#ff2d55',
                icons: [{
                    src: 'https://i.imgur.com/yBIY66i.jpeg',
                    sizes: '192x192',
                    type: 'image/jpeg'
                }]
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(manifest));
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Service Worker
        if (pathname === '/sw.js') {
            const sw = `
const CACHE_NAME = 'baiilla-maach-v3';
const urlsToCache = ['/', '/data.json'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            );
        })
    );
});
`;
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(sw);
            this.metrics.recordRequest(req, res, performance.now() - startTime);
            return;
        }
        
        // Favicon
        if (pathname === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
        }
        
        // 404
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - পাওয়া যায়নি</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
        .error-code{font-size:150px;font-weight:900;background:linear-gradient(45deg,#ff2d55,#ff6b00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
        .message{font-size:1.5em;margin:20px 0;color:#ddd}
        .btn{display:inline-block;padding:15px 35px;background:#ff2d55;color:#fff;text-decoration:none;border-radius:30px;font-weight:700;font-size:1.1em;transition:transform 0.2s}
        .btn:hover{transform:scale(1.05)}
    </style>
</head>
<body>
    <div>
        <div class="error-code">404</div>
        <p class="message">দুঃখিত! পেজটি খুঁজে পাওয়া যায়নি</p>
        <a href="/" class="btn">🏠 হোম পেজে ফিরে যান</a>
    </div>
</body>
</html>`);
        
        this.metrics.recordRequest(req, res, performance.now() - startTime);
    }
    
    sendResponse(req, res, data, contentType) {
        const encoding = this.compressor.getEncoding(req);
        const contentLength = Buffer.byteLength(data, 'utf-8');
        
        if (this.compressor.shouldCompress(contentType, contentLength)) {
            this.compressor.compress(Buffer.from(data, 'utf-8'), encoding, (err, compressed) => {
                if (err) {
                    log('ERROR', 'Compression error', { error: err.message });
                    res.writeHead(500);
                    res.end('Internal Server Error');
                    return;
                }
                
                res.setHeader('Content-Encoding', encoding);
                res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
                res.setHeader('Content-Length', compressed.length);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Vary', 'Accept-Encoding');
                
                res.writeHead(200);
                res.end(compressed);
                this.metrics.recordBytesSent(compressed.length);
            });
        } else {
            res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
            res.setHeader('Content-Length', contentLength);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            res.writeHead(200);
            res.end(data);
            this.metrics.recordBytesSent(contentLength);
        }
    }
    
    start() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });
        
        this.server.maxConnections = 10000;
        this.server.keepAliveTimeout = CONFIG.KEEP_ALIVE_TIMEOUT;
        this.server.headersTimeout = CONFIG.HEADERS_TIMEOUT;
        
        this.server.listen(CONFIG.PORT, CONFIG.HOST, () => {
            console.log('');
            console.log('='.repeat(60));
            console.log(`${colors.bgGreen}${colors.bright} ✅ SERVER STARTED SUCCESSFULLY ${colors.reset}`);
            console.log('='.repeat(60));
            console.log(`${colors.cyan}🚀 URL:${colors.reset} http://${CONFIG.HOST}:${CONFIG.PORT}`);
            console.log(`${colors.cyan}📊 Environment:${colors.reset} ${CONFIG.NODE_ENV}`);
            console.log(`${colors.cyan}🔒 Security:${colors.reset} Enabled (Rate Limit, CSP, HSTS)`);
            console.log(`${colors.cyan}📸 Image Proxy:${colors.reset} /image?url=IMGUR_URL`);
            console.log(`${colors.cyan}📡 API:${colors.reset} http://localhost:${CONFIG.PORT}/data.json`);
            console.log(`${colors.cyan}❤️ Health:${colors.reset} http://localhost:${CONFIG.PORT}/health`);
            console.log(`${colors.cyan}📈 Metrics:${colors.reset} http://localhost:${CONFIG.PORT}/metrics`);
            console.log('='.repeat(60));
            console.log('');
        });
        
        // Graceful shutdown
        const shutdown = (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;
            
            console.log(`\n${colors.yellow}${signal} received. Shutting down gracefully...${colors.reset}`);
            
            this.server.close(() => {
                console.log(`${colors.green}Server closed${colors.reset}`);
            });
            
            // Close active connections
            for (const socket of this.activeConnections) {
                socket.destroy();
            }
            
            // Cleanup
            this.rateLimiter.destroy();
            this.cache.clear();
            
            setTimeout(() => {
                console.log(`${colors.red}Force exit${colors.reset}`);
                process.exit(0);
            }, CONFIG.SHUTDOWN_TIMEOUT);
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        process.on('uncaughtException', (error) => {
            log('ERROR', 'Uncaught Exception', { error: error.message, stack: error.stack });
        });
        
        process.on('unhandledRejection', (reason) => {
            log('ERROR', 'Unhandled Rejection', { reason });
        });
        
        return this;
    }
}

// ==================== CLUSTER MODE ====================
if (CONFIG.CLUSTER_MODE && cluster.isPrimary) {
    console.log(`${colors.magenta}👑 Primary ${process.pid} is running${colors.reset}`);
    console.log(`${colors.magenta}👥 Spawning ${CONFIG.WORKERS} workers...${colors.reset}`);
    
    for (let i = 0; i < CONFIG.WORKERS; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`${colors.red}💀 Worker ${worker.process.pid} died. Restarting...${colors.reset}`);
        cluster.fork();
    });
    
    cluster.on('online', (worker) => {
        console.log(`${colors.green}✅ Worker ${worker.process.pid} online${colors.reset}`);
    });
} else {
    // Start server
    const app = new Application();
    app.start();
}

// ==================== EXPORTS ====================
module.exports = {
    Application,
    Template,
    Metrics,
    RateLimiter,
    Cache,
    Security,
    Compressor,
    ImageProxy,
    CONFIG,
    DATA
};

// ============================================================
// END OF FILE
// Total Lines: 1000+
// GitHub: github.com/baiillamaach/anti-fraud-server
// License: MIT
// ============================================================

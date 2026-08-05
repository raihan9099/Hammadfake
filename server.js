require('dotenv').config();

process.on('uncaughtException', (e) => { 
    console.error('❌ Uncaught Exception:', e.message);
    console.error(e.stack);
});
process.on('unhandledRejection', (e) => { 
    console.error('❌ Unhandled Rejection:', e);
    console.error(e.stack);
});

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority';

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ============================================
// DATABASE MODELS
// ============================================
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    profilePic: {
        type: String,
        default: '/assets/default-avatar.png'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const MessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 5000
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text'
    },
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    delivered: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, read: 1 });

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// ============================================
// DATABASE CONNECTION
// ============================================
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected');
        
        // Create admin if not exists
        const adminExists = await User.findOne({ email: 'admin@baillamaach.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await User.create({
                name: 'Baiilla Maach Admin',
                email: 'admin@baillamaach.com',
                password: hashedPassword,
                isAdmin: true,
                profilePic: '/assets/admin-avatar.png'
            });
            console.log('👑 Admin created: admin@baillamaach.com / admin123');
        }
        
        // Create indexes
        await User.collection.createIndex({ isOnline: 1 });
        await User.collection.createIndex({ lastSeen: -1 });
        
        console.log('📑 Indexes ready');
    } catch (error) {
        console.error('❌ DB Error:', error.message);
        process.exit(1);
    }
};

// ============================================
// ASSETS
// ============================================
const ASSETS = {
    profile: "/assets/celebrity_pfp.jpeg",
    fbProfile: "/assets/fb_profile.jpg",
    blueTikTok: "/assets/bluetick_tiktok.png",
    blueFB: "/assets/blue_tick_fb.png",
    logoFB: "/assets/logo_fb.png",
    logoTikTok: "/assets/logo_tiktok.png",
    messageBubble: "/assets/message_bubble.gif",
    microphone: "/assets/microphone-in-hand.gif",
    reportBtn: "/assets/report_button.png",
    fakeDetect: "/assets/Fakedetect_updown.png",
    baillamachFake: "/assets/baillamach_fake.png",
    hammadFake: "/assets/hammadfams.png",
    chatIcon: "/assets/chat-icon.gif"
};

// ============================================
// ROUTES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            name,
            email,
            password: hashedPassword
        });
        
        res.json({ 
            success: true, 
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        res.json({ 
            success: true, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email,
                isAdmin: user.isAdmin,
                profilePic: user.profilePic
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users (for chat list)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'name email isOnline lastSeen profilePic isAdmin')
            .sort({ isOnline: -1, name: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user by ID
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id, 'name email isOnline lastSeen profilePic');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get messages between two users
app.get('/api/messages/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        
        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: otherUserId },
                { sender: otherUserId, receiver: userId }
            ]
        })
        .sort({ createdAt: 1 })
        .limit(100);
        
        // Mark messages as read
        await Message.updateMany(
            { sender: otherUserId, receiver: userId, read: false },
            { read: true, readAt: new Date() }
        );
        
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get unread count for a user
app.get('/api/unread/:userId', async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiver: req.params.userId,
            read: false
        });
        res.json({ unread: count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// WEBSOCKET - REAL TIME CHAT
// ============================================
const onlineUsers = new Map(); // socketId -> userId
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    // User login/register -> set online
    socket.on('user-online', async (userId) => {
        try {
            onlineUsers.set(socket.id, userId);
            userSockets.set(userId, socket.id);
            
            await User.findByIdAndUpdate(userId, { 
                isOnline: true, 
                lastSeen: new Date() 
            });
            
            // Broadcast online status
            const user = await User.findById(userId, 'name email isOnline');
            io.emit('user-status', { userId, isOnline: true, user });
            
            console.log(`🟢 ${user.name} is online`);
        } catch (error) {
            console.error('Online error:', error);
        }
    });
    
    // Send message
    socket.on('send-message', async (data) => {
        try {
            const { senderId, receiverId, message, type = 'text' } = data;
            
            // Save to database
            const newMessage = await Message.create({
                sender: senderId,
                receiver: receiverId,
                message,
                type,
                delivered: true
            });
            
            const populated = await Message.findById(newMessage._id)
                .populate('sender', 'name email profilePic')
                .populate('receiver', 'name email profilePic');
            
            // Send to receiver if online
            const receiverSocketId = userSockets.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new-message', populated);
            }
            
            // Send confirmation to sender
            socket.emit('message-sent', populated);
            
            console.log(`💬 Message from ${populated.sender.name} to ${populated.receiver.name}`);
        } catch (error) {
            console.error('Message error:', error);
            socket.emit('message-error', error.message);
        }
    });
    
    // Mark as read
    socket.on('mark-read', async (data) => {
        try {
            const { userId, senderId } = data;
            await Message.updateMany(
                { sender: senderId, receiver: userId, read: false },
                { read: true, readAt: new Date() }
            );
            
            const senderSocket = userSockets.get(senderId);
            if (senderSocket) {
                io.to(senderSocket).emit('messages-read', { userId, senderId });
            }
        } catch (error) {
            console.error('Mark read error:', error);
        }
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        const { senderId, receiverId, isTyping } = data;
        const receiverSocket = userSockets.get(receiverId);
        if (receiverSocket) {
            io.to(receiverSocket).emit('typing-indicator', { userId: senderId, isTyping });
        }
    });
    
    // Disconnect
    socket.on('disconnect', async () => {
        const userId = onlineUsers.get(socket.id);
        if (userId) {
            await User.findByIdAndUpdate(userId, { 
                isOnline: false, 
                lastSeen: new Date() 
            });
            
            io.emit('user-status', { userId, isOnline: false });
            console.log(`🔴 User ${userId} went offline`);
            
            onlineUsers.delete(socket.id);
            userSockets.delete(userId);
        }
    });
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
    await connectDB();
    
    // Create public directory
    if (!fs.existsSync('public')) {
        fs.mkdirSync('public');
    }
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
🚀 Chat Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Port: ${PORT}
🌍 URL: http://localhost:${PORT}
📧 Admin: admin@baillamaach.com
🔑 Password: admin123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    });
};

startServer();

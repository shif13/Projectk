const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require('path');
require('dotenv').config();

// Database connection
const { testConnection } = require('./config/db');

// Email service
const { verifyEmailConfig } = require('./services/emailService');

// Routes - Import BOTH route files
const userRoutes = require('./routes/registerRoutes');
const loginRoutes = require('./routes/loginRoutes');

const app = express();
const PORT = process.env.PORT || 5550;

// Debug middleware - Log ALL requests
app.use((req, res, next) => {
    console.log(`\n🔍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    next();
});

// Middleware - Fixed CORS for Vite (port 5173)
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files for uploaded documents
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('✅ Health check endpoint hit');
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint to verify server is working
app.get('/test', (req, res) => {
    console.log('✅ Test endpoint hit');
    res.json({ message: 'Server is working!' });
});

// Routes - Add BOTH route groups with logging
app.use('/api/users', (req, res, next) => {
    console.log('🔵 Hitting /api/users route group');
    next();
}, userRoutes);

app.use('/api/auth', (req, res, next) => {
    console.log('🟢 Hitting /api/auth route group');
    next();
}, loginRoutes);



// Catch-all route to log unmatched requests
app.use('*', (req, res) => {
    console.log(`❌ 404 - Unmatched route: ${req.method} ${req.originalUrl}`);
    console.log('Available routes:');
    console.log('  - GET  /api/health');
    console.log('  - GET  /test');
    console.log('  - POST /api/auth/login');
    console.log('  - POST /api/auth/forgot-password');
    console.log('  - POST /api/auth/reset-password');
    res.status(404).json({
        success: false,
        msg: 'Route not found',
        requestedRoute: req.originalUrl,
        method: req.method
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({
        success: false,
        msg: 'Internal server error',
        error: error.message
    });
});

// Start server
const startServer = async () => {
    try {
        await testConnection();
        
        // Initialize email service
        const emailReady = await verifyEmailConfig();
        if (emailReady) {
            console.log('✅ Email service initialized successfully');
        } else {
            console.warn('⚠️ Email service failed to initialize (emails will be skipped)');
        }
        
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${PORT}`);
            console.log('📋 Available routes:');
            console.log('   GET  /api/health');
            console.log('   GET  /test');
            console.log('   POST /api/auth/login');
            console.log('   POST /api/auth/forgot-password');
            console.log('   POST /api/auth/reset-password');
            console.log('   POST /api/users/register');
            console.log('   GET  /api/users/profile');
            console.log('   POST /api/users/search-jobseekers');
            console.log('   POST /api/users/match-skills');
            console.log('\n🔍 Debug mode enabled - All requests will be logged\n');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
const express = require('express');
const router = express.Router();

// Import controller functions from loginController
const { 
  loginUser,
  forgotPassword,
  resetPassword
} = require('../controllers/loginController');

// Debug middleware for auth routes
router.use((req, res, next) => {
    console.log(`\n🔐 AUTH ROUTE: ${req.method} ${req.originalUrl}`);
    console.log('🔐 Path:', req.path);
    console.log('🔐 Body:', req.body);
    console.log('🔐 Headers:', req.headers);
    next();
});

// Test route to verify the router is working
router.get('/test', (req, res) => {
    console.log('✅ Auth test route hit');
    res.json({ 
        success: true, 
        message: 'Auth routes are working!',
        route: '/api/auth/test'
    });
});

router.post('/login', (req, res, next) => {
    console.log('🔐 LOGIN route handler called');
    console.log('🔐 Request body:', req.body);
    try {
        loginUser(req, res, next);
    } catch (error) {
        console.error('🔐 LOGIN route error:', error);
        res.status(500).json({
            success: false,
            msg: 'Login route error',
            error: error.message
        });
    }
});

router.post('/forgot-password', (req, res, next) => {
    console.log('🔐 FORGOT-PASSWORD route handler called');
    console.log('🔐 Request body:', req.body);
    try {
        forgotPassword(req, res, next);
    } catch (error) {
        console.error('🔐 FORGOT-PASSWORD route error:', error);
        res.status(500).json({
            success: false,
            msg: 'Forgot password route error',
            error: error.message
        });
    }
});

router.post('/reset-password', (req, res, next) => {
    console.log('🔐 RESET-PASSWORD route handler called');
    console.log('🔐 Request body:', req.body);
    try {
        resetPassword(req, res, next);
    } catch (error) {
        console.error('🔐 RESET-PASSWORD route error:', error);
        res.status(500).json({
            success: false,
            msg: 'Reset password route error',
            error: error.message
        });
    }
});

console.log('🔐 Auth routes module loaded successfully');

module.exports = router;
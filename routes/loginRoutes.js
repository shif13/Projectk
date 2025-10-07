const express = require('express');
const router = express.Router();
const { loginUser, forgotPassword, resetPassword } = require('../controllers/loginController');

// POST /api/login - Login user
router.post('/login', loginUser);

// POST /api/login/forgot-password - Send password reset link
router.post('/forgot-password', forgotPassword);

// POST /api/login/reset-password - Reset user password
router.post('/reset-password', resetPassword);

module.exports = router;

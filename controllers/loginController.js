const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { db } = require('../config/db');
const { sendPasswordResetEmail, sendPasswordChangeConfirmation } = require('../services/emailService');

dotenv.config();

// Helper functions
const cleanInput = (input) => {
    const cleaned = {};
    for (const key in input) {
        if (input.hasOwnProperty(key)) {
            cleaned[key.trim()] = typeof input[key] === 'string' ? input[key].trim() : input[key];
        }
    }
    return cleaned;
};

const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePassword = (password) => {
    return password && password.length >= 6;
};

// LOGIN USER - accepts both username and email
const loginUser = async (req, res) => {
    try {
        console.log("🔥 Incoming login request for:", req.body.usernameOrEmail);

        const { usernameOrEmail, password } = cleanInput(req.body);

        if (!usernameOrEmail || !password) {
            console.warn("⚠️ Missing login credentials");
            return res.status(400).json({ 
                success: false, 
                msg: 'Username/Email and password are required' 
            });
        }

        // Find user by username or email
        const query = 'SELECT id, userName, email, password, userType, firstName, lastName FROM users WHERE email = ? OR userName = ?';
        
        db.query(query, [usernameOrEmail.toLowerCase(), usernameOrEmail.toUpperCase()], async (err, users) => {
            if (err) {
                console.error("❌ Database login error:", err);
                return res.status(500).json({ 
                    success: false, 
                    msg: 'Database error occurred' 
                });
            }

            if (users.length === 0) {
                console.warn("⚠️ Login attempt with non-existent user:", usernameOrEmail);
                return res.status(401).json({ 
                    success: false, 
                    msg: 'Invalid credentials' 
                });
            }

            const user = users[0];
            console.log("👤 Found user:", user.userName);

            try {
                // Verify password
                const isMatch = await bcrypt.compare(password, user.password);
                
                if (!isMatch) {
                    console.warn("⚠️ Invalid password attempt for user:", usernameOrEmail);
                    return res.status(401).json({ 
                        success: false, 
                        msg: 'Invalid credentials' 
                    });
                }

                // Generate JWT token
                const token = jwt.sign(
                    { 
                        userId: user.id, 
                        email: user.email, 
                        userType: user.userType 
                    },
                    process.env.JWT_SECRET || 'fallback_secret_key',
                    { expiresIn: '24h' }
                );

                console.log("✅ Login successful for user:", user.userName);
                res.json({
                    success: true,
                    msg: 'Login successful',
                    token,
                    user: {
                        id: user.id,
                        userName: user.userName,
                        email: user.email,
                        userType: user.userType,
                        firstName: user.firstName,
                        lastName: user.lastName
                    }
                });
            } catch (authError) {
                console.error("❌ Authentication error:", authError);
                res.status(500).json({ 
                    success: false, 
                    msg: 'Authentication failed' 
                });
            }
        });
    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ 
            success: false, 
            msg: 'Internal server error' 
        });
    }
};

// FORGOT PASSWORD - generate and send reset token
const forgotPassword = async (req, res) => {
    try {
        console.log('🔍 Forgot password function called with body:', req.body);
        
        const { email } = cleanInput(req.body);

        if (!email || !validateEmail(email)) {
            console.log('🔍 Invalid email provided');
            return res.status(400).json({
                success: false,
                msg: 'Valid email address is required'
            });
        }

        // Check if user exists
        const checkUserQuery = 'SELECT id, firstName, lastName, userName, email FROM users WHERE email = ?';
        
        db.query(checkUserQuery, [email.toLowerCase()], async (err, users) => {
            if (err) {
                console.error('🔍 Database error in forgot password:', err);
                return res.status(500).json({
                    success: false,
                    msg: 'Database error occurred'
                });
            }

            console.log('🔍 Found users:', users.length);

            if (users.length === 0) {
                console.log('🔍 No user found with email:', email);
                // Don't reveal if email exists or not for security
                return res.status(200).json({
                    success: true,
                    msg: 'If email exists, reset instructions have been sent'
                });
            }

            const user = users[0];

            try {
                // Generate 6-digit reset token
                const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
                const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

                console.log('🔍 Generated reset token for user:', user.email, 'Token:', resetToken);

                // Store reset token in database
                const updateTokenQuery = 'UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?';
                
                db.query(updateTokenQuery, [resetToken, resetTokenExpiry, user.id], async (err) => {
                    if (err) {
                        console.error('🔍 Token storage error:', err);
                        return res.status(500).json({
                            success: false,
                            msg: 'Error processing request'
                        });
                    }

                    console.log('🔍 Token stored successfully, attempting to send email');

                    try {
                        // Use the dedicated email service
                        const emailResult = await sendPasswordResetEmail(user, resetToken);
                        
                        if (emailResult.success) {
                            console.log("✅ Password reset email sent successfully:", emailResult.messageId);
                            res.status(200).json({ 
                                success: true,
                                msg: 'Password reset instructions have been sent to your email' 
                            });
                        } else {
                            console.error("❌ Email sending failed:", emailResult.error);
                            res.status(500).json({ 
                                success: false,
                                msg: 'Error sending reset email. Please try again later.' 
                            });
                        }

                    } catch (emailError) {
                        console.error("❌ Email sending error:", emailError);
                        res.status(500).json({ 
                            success: false,
                            msg: 'Error sending reset email' 
                        });
                    }
                });
            } catch (error) {
                console.error('🔍 Forgot password process error:', error);
                res.status(500).json({
                    success: false,
                    msg: 'Error processing password reset request'
                });
            }
        });
    } catch (error) {
        console.error("❌ Forgot password error:", error);
        res.status(500).json({ 
            success: false, 
            msg: 'Internal server error' 
        });
    }
};

// RESET PASSWORD with token
const resetPassword = async (req, res) => {
    try {
        console.log('🔍 Reset password function called');
        
        const { token, newPassword } = cleanInput(req.body);

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                msg: 'Reset token and new password are required'
            });
        }

        if (token.length !== 6) {
            console.warn("⚠️ Invalid token format:", token);
            return res.status(400).json({
                success: false,
                msg: 'Invalid reset token format'
            });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                success: false,
                msg: 'Password must be at least 6 characters long'
            });
        }

        // Find user with valid reset token
        const findUserQuery = `
            SELECT id, email, firstName, lastName, resetTokenExpiry 
            FROM users 
            WHERE resetToken = ? AND resetTokenExpiry > NOW()
        `;
        
        db.query(findUserQuery, [token], async (err, users) => {
            if (err) {
                console.error('🔍 Database error in reset password:', err);
                return res.status(500).json({
                    success: false,
                    msg: 'Database error occurred'
                });
            }

            console.log('🔍 Found users with valid token:', users.length);

            if (users.length === 0) {
                console.warn("⚠️ Invalid or expired reset token:", token);
                return res.status(400).json({
                    success: false,
                    msg: 'Invalid or expired reset token'
                });
            }

            const user = users[0];

            try {
                // Hash new password
                const salt = await bcrypt.genSalt(12);
                const hashedPassword = await bcrypt.hash(newPassword, salt);

                // Update password and clear reset token
                const updatePasswordQuery = `
                    UPDATE users 
                    SET password = ?, resetToken = NULL, resetTokenExpiry = NULL 
                    WHERE id = ?
                `;
                
                db.query(updatePasswordQuery, [hashedPassword, user.id], async (err) => {
                    if (err) {
                        console.error('🔍 Password update error:', err);
                        return res.status(500).json({
                            success: false,
                            msg: 'Error updating password'
                        });
                    }

                    console.log('🔍 Password reset successful for user:', user.email);
                    
                    // Send password change confirmation email
                    try {
                        const confirmationResult = await sendPasswordChangeConfirmation(user);
                        if (confirmationResult.success) {
                            console.log("✅ Password change confirmation email sent:", confirmationResult.messageId);
                        } else {
                            console.warn("⚠️ Failed to send confirmation email:", confirmationResult.error);
                        }
                    } catch (confirmationError) {
                        console.error("❌ Confirmation email error:", confirmationError);
                        // Don't fail the password reset if confirmation email fails
                    }
                    
                    res.json({
                        success: true,
                        msg: 'Password has been reset successfully. You can now login with your new password. A confirmation email has been sent.'
                    });
                });

            } catch (hashError) {
                console.error('🔍 Password hashing error:', hashError);
                res.status(500).json({
                    success: false,
                    msg: 'Error processing new password'
                });
            }
        });
    } catch (error) {
        console.error("❌ Reset password error:", error);
        res.status(500).json({ 
            success: false, 
            msg: 'Internal server error' 
        });
    }
};

module.exports = {
    loginUser,
    forgotPassword,
    resetPassword
};
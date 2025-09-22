const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const crypto = require('crypto');

// Import the email service
const { sendPasswordResetEmail } = require('../services/emailService');

// Login user - FIXED to accept both username and email
const loginUser = (req, res) => {
  const { usernameOrEmail, password } = req.body; // Changed from email to usernameOrEmail

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ 
      success: false, 
      msg: 'Please provide username/email and password' 
    });
  }

  // Check if user exists by email OR username
  const query = 'SELECT id, userName, email, password, userType, firstName, lastName FROM users WHERE email = ? OR userName = ?';
  
  db.query(query, [usernameOrEmail, usernameOrEmail], async (err, users) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Server error during login' 
      });
    }

    if (users.length === 0) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Invalid credentials' 
      });
    }

    const user = users[0];

    try {
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ 
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
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

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

    } catch (error) {
      console.error('Password comparison error:', error);
      res.status(500).json({ 
        success: false, 
        msg: 'Server error during login' 
      });
    }
  });
};

// Forgot password - generate and send reset token
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      msg: 'Please provide email address'
    });
  }

  try {
    // Check if user exists
    const checkUserQuery = 'SELECT id, firstName, lastName, userName, email FROM users WHERE email = ?';
    
    db.query(checkUserQuery, [email], async (err, users) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Server error during password reset request'
        });
      }

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          msg: 'No account found with this email address'
        });
      }

      const user = users[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database
      const updateTokenQuery = 'UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?';
      
      db.query(updateTokenQuery, [resetToken, resetTokenExpiry, user.id], async (err) => {
        if (err) {
          console.error('Token storage error:', err);
          return res.status(500).json({
            success: false,
            msg: 'Server error during password reset request'
          });
        }

        // Send password reset email
        try {
          const emailResult = await sendPasswordResetEmail(user, resetToken);
          if (emailResult.success) {
            console.log('✅ Password reset email sent to:', email);
            res.json({
              success: true,
              msg: 'Password reset instructions have been sent to your email'
            });
          } else {
            console.warn('⚠️ Failed to send reset email:', emailResult.error);
            res.status(500).json({
              success: false,
              msg: 'Error sending password reset email'
            });
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          res.status(500).json({
            success: false,
            msg: 'Error sending password reset email'
          });
        }
      });
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error during password reset request'
    });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      msg: 'Please provide reset token and new password'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      msg: 'Password must be at least 6 characters long'
    });
  }

  try {
    // Find user with valid reset token
    const findUserQuery = `
      SELECT id, email, firstName, lastName, resetTokenExpiry 
      FROM users 
      WHERE resetToken = ? AND resetTokenExpiry > NOW()
    `;
    
    db.query(findUserQuery, [token], async (err, users) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Server error during password reset'
        });
      }

      if (users.length === 0) {
        return res.status(400).json({
          success: false,
          msg: 'Invalid or expired reset token'
        });
      }

      const user = users[0];

      try {
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear reset token
        const updatePasswordQuery = `
          UPDATE users 
          SET password = ?, resetToken = NULL, resetTokenExpiry = NULL 
          WHERE id = ?
        `;
        
        db.query(updatePasswordQuery, [hashedPassword, user.id], (err) => {
          if (err) {
            console.error('Password update error:', err);
            return res.status(500).json({
              success: false,
              msg: 'Server error during password reset'
            });
          }

          console.log('✅ Password reset successful for user:', user.email);
          res.json({
            success: true,
            msg: 'Password has been reset successfully. You can now login with your new password.'
          });
        });

      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        res.status(500).json({
          success: false,
          msg: 'Server error during password reset'
        });
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error during password reset'
    });
  }
};

module.exports = {
  loginUser,
  forgotPassword,
  resetPassword
};
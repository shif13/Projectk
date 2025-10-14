// controllers/freelancerController.js - Frontend Direct Upload to Cloudinary
const { db } = require('../config/db');
const {sendProfileCompletedEmail, sendProfileUpdateEmail} = require('../services/emailService');

// Helper function to safely parse JSON
const safeJsonParse = (jsonString, fallback = []) => {
  if (!jsonString) return fallback;
  if (typeof jsonString !== 'string') return jsonString;
  
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn('JSON parse error:', error.message);
    return fallback;
  }
};

// ==========================================
// GET FREELANCER PROFILE
// ==========================================

const getFreelancerProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    console.log('📋 Fetching profile for user:', userId);

    // Get user basic info
    const userQuery = `
      SELECT id, userName, email, firstName, lastName, 
             phone, location, isFreelancer, isEquipmentOwner, createdAt 
      FROM users 
      WHERE id = ?
    `;
    
    db.query(userQuery, [userId], (err, users) => {
      if (err) {
        console.error('❌ Get user error:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Error fetching user profile' 
        });
      }

      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          msg: 'User not found' 
        });
      }

      const user = users[0];

      // Check if user has freelancer role
      if (!user.isFreelancer) {
        return res.status(403).json({
          success: false,
          msg: 'Access denied. Freelancer role required.'
        });
      }

      // Get freelancer profile
      const profileQuery = 'SELECT * FROM job_seekers WHERE userId = ?';
      
      db.query(profileQuery, [userId], (err, profiles) => {
        if (err) {
          console.error('❌ Get profile error:', err);
          return res.status(500).json({ 
            success: false, 
            msg: 'Error fetching freelancer profile' 
          });
        }

        let profile = null;
        if (profiles.length > 0) {
          profile = {
            ...profiles[0],
            certificatesPath: safeJsonParse(profiles[0].certificatesPath, [])
          };
        }

        console.log('✅ Profile fetched successfully');

        res.json({
          success: true,
          user,
          profile
        });
      });
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Error fetching profile' 
    });
  }
};

// ==========================================
// UPDATE/COMPLETE FREELANCER PROFILE
// ==========================================

const updateFreelancerProfile = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === PROFILE UPDATE REQUEST ===`);

  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    console.log('📝 Update request for user:', userId);

    const { 
      firstName, 
      lastName, 
      userName, 
      email, 
      phone, 
      location,
      // Freelancer profile fields
      title, 
      experience, 
      expectedSalary,
      salaryCurrency,
      bio, 
      availability,
      availableFrom,
      cvFilePath,        // Cloudinary URL from frontend
      certificatesPath   // Array of Cloudinary URLs from frontend
    } = req.body;

    // Validate basic required fields
    if (!firstName || !lastName || !userName || !email) {
      return res.status(400).json({
        success: false,
        msg: 'First name, last name, username, and email are required'
      });
    }

    // Start transaction
    await new Promise((resolve, reject) => {
      db.beginTransaction((err) => {
        if (err) {
          console.error('❌ Transaction start error:', err);
          return reject(err);
        }
        resolve();
      });
    });

    try {
      // Check for username/email conflicts with other users
      const conflictQuery = `
        SELECT id FROM users 
        WHERE (email = ? OR userName = ?) AND id != ?
      `;
      
      const conflicts = await new Promise((resolve, reject) => {
        db.query(conflictQuery, [email.toLowerCase().trim(), userName.trim(), userId], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      if (conflicts.length > 0) {
        await new Promise((resolve) => {
          db.rollback(() => resolve());
        });
        return res.status(409).json({ 
          success: false, 
          msg: 'Username or email already taken by another user'
        });
      }

      // Update users table
      const updateUserQuery = `
        UPDATE users 
        SET firstName = ?, lastName = ?, userName = ?, email = ?, 
            phone = ?, location = ? 
        WHERE id = ?
      `;
      
      await new Promise((resolve, reject) => {
        db.query(updateUserQuery, [
          firstName.trim(),
          lastName.trim(),
          userName.trim(),
          email.toLowerCase().trim(),
          phone ? phone.trim() : null,
          location ? location.trim() : null,
          userId
        ], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      console.log('✅ User table updated');

      // Check if profile exists
      const checkProfileQuery = 'SELECT id FROM job_seekers WHERE userId = ?';
      const existingProfile = await new Promise((resolve, reject) => {
        db.query(checkProfileQuery, [userId], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      if (existingProfile.length > 0) {
        // UPDATE existing profile
        const updateProfileQuery = `
          UPDATE job_seekers 
          SET title = ?, experience = ?, expectedSalary = ?, salaryCurrency = ?,
              bio = ?, availability = ?, availableFrom = ?, 
              cvFilePath = ?, certificatesPath = ?
          WHERE userId = ?
        `;

        await new Promise((resolve, reject) => {
          db.query(updateProfileQuery, [
            title ? title.trim() : null,
            experience ? experience.trim() : null,
            expectedSalary ? expectedSalary.trim() : null,
            salaryCurrency || 'USD',
            bio ? bio.trim() : null,
            availability || 'available',
            availableFrom || null,
            cvFilePath || null,
            JSON.stringify(certificatesPath || []),
            userId
          ], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        console.log('✅ Profile updated');
      } else {
        // INSERT new profile
        const insertProfileQuery = `
          INSERT INTO job_seekers (
            userId, title, experience, expectedSalary, salaryCurrency,
            bio, availability, availableFrom, cvFilePath, certificatesPath
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await new Promise((resolve, reject) => {
          db.query(insertProfileQuery, [
            userId,
            title ? title.trim() : null,
            experience ? experience.trim() : null,
            expectedSalary ? expectedSalary.trim() : null,
            salaryCurrency || 'USD',
            bio ? bio.trim() : null,
            availability || 'available',
            availableFrom || null,
            cvFilePath || null,
            JSON.stringify(certificatesPath || [])
          ], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        console.log('✅ Profile created');
      }

      // Commit transaction
      await new Promise((resolve, reject) => {
        db.commit((err) => {
          if (err) {
            console.error('❌ Commit error:', err);
            return reject(err);
          }
          resolve();
        });
      });

    const responseTime = Date.now() - startTime;
      console.log(`✅ Profile update completed in ${responseTime}ms`);

      // 📧 Send profile email
      try {
        // Check if this is first-time profile completion
        const isFirstCompletion = existingProfile.length === 0 && title && title.trim();
        
        if (isFirstCompletion) {
          await sendProfileCompletedEmail({
            email: email.toLowerCase().trim(),
            firstName: firstName.trim()
          });
          console.log('✅ Profile completion email sent');
        } else {
          await sendProfileUpdateEmail({
            email: email.toLowerCase().trim(),
            firstName: firstName.trim()
          });
          console.log('✅ Profile update email sent');
        }
      } catch (emailError) {
        console.error('⚠️ Failed to send profile email:', emailError);
      }

      res.json({ 
        success: true, 
        msg: 'Profile updated successfully',
        timestamp: new Date().toISOString(),
        processingTime: `${responseTime}ms`
      });

    } catch (dbError) {
      // Rollback on error
      await new Promise((resolve) => {
        db.rollback(() => {
          console.log('🔄 Transaction rolled back');
          resolve();
        });
      });
      throw dbError;
    }

  } catch (error) {
    console.error(`❌ Profile update error:`, error);
    
    let statusCode = 500;
    let errorMessage = 'Server error during profile update';
    
    if (error.code === 'ER_DUP_ENTRY') {
      statusCode = 409;
      errorMessage = 'Username or email already exists';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Database connection failed';
    }
    
    res.status(statusCode).json({ 
      success: false, 
      msg: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getFreelancerProfile,
  updateFreelancerProfile
};
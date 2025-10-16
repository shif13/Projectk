// controllers/freelancerController.js - Local Multer Storage
const { db } = require('../config/db');
const { sendProfileCompletedEmail, sendProfileUpdateEmail } = require('../services/emailService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directories
const uploadsDir = './uploads';
const cvDir = './uploads/cvs';
const certsDir = './uploads/certificates';

[uploadsDir, cvDir, certsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer local storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'cvFile') {
      cb(null, cvDir);
    } else if (file.fieldname === 'certificateFiles') {
      cb(null, certsDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images allowed.'));
    }
  }
});

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
    console.log('📎 req.files:', req.files);
    console.log('📋 Body received:', Object.keys(req.body));

    const { 
      firstName, 
      lastName, 
      userName, 
      email, 
      phone, 
      location,
      title, 
      experience, 
      expectedSalary,
      salaryCurrency,
      bio, 
      availability,
      availableFrom,
      existingCertificates
    } = req.body;

    // Parse existing certificates from request body
    let certificates = safeJsonParse(existingCertificates, []);
    console.log('📜 Existing certificates from body:', certificates);

    // Handle uploaded CV
    let cvFilePath = req.body.cvFilePath; // Keep existing CV if no new upload
    
    if (req.files && req.files.cvFile && req.files.cvFile.length > 0) {
      const cvFile = req.files.cvFile[0];
      cvFilePath = `uploads/cvs/${cvFile.filename}`;
      console.log('✅ New CV uploaded:', cvFilePath);
    } else {
      console.log('ℹ️ No new CV uploaded. Existing CV:', cvFilePath || 'None');
    }

    // Handle uploaded certificates
    if (req.files && req.files.certificateFiles) {
      console.log('📦 Certificate files found:', req.files.certificateFiles.length);
      
      if (req.files.certificateFiles.length > 0) {
        const certFiles = req.files.certificateFiles;
        const newCerts = certFiles.map(file => {
          const certPath = `uploads/certificates/${file.filename}`;
          console.log('  - Certificate:', certPath);
          return certPath;
        });
        
        // Merge with existing certificates
        certificates = [...certificates, ...newCerts];
        console.log(`✅ ${newCerts.length} new certificate(s) uploaded`);
        console.log('📜 Total certificates now:', certificates.length);
      }
    } else {
      console.log('ℹ️ No new certificates uploaded. Existing count:', certificates.length);
    }

    // Validate required fields
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
      // Check for username/email conflicts
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
      const checkProfileQuery = 'SELECT id, cvFilePath, certificatesPath FROM job_seekers WHERE userId = ?';
      const existingProfile = await new Promise((resolve, reject) => {
        db.query(checkProfileQuery, [userId], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      // Determine final CV path
      let finalCvPath = cvFilePath;
      if (!finalCvPath && existingProfile.length > 0) {
        // Keep the existing CV from database if no new one uploaded
        finalCvPath = existingProfile[0].cvFilePath;
      }

      // Determine final certificates
      let finalCertificates = certificates;
      if (existingProfile.length > 0 && certificates.length === 0) {
        // If no new certificates and existing profile has certificates, keep them
        const existingCerts = safeJsonParse(existingProfile[0].certificatesPath, []);
        if (existingCerts.length > 0) {
          finalCertificates = existingCerts;
          console.log('ℹ️ Keeping existing certificates:', existingCerts.length);
        }
      }

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
            finalCvPath || null,
            JSON.stringify(finalCertificates),
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
            finalCvPath || null,
            JSON.stringify(finalCertificates)
          ], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        console.log('✅ Profile created');
      }

      console.log('📄 Final CV Path:', finalCvPath);
      console.log('📜 Final Certificates:', finalCertificates);

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

      // Send email
      try {
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

// ==========================================
// DELETE CERTIFICATE
// ==========================================
const deleteCertificate = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { certificateUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    if (!certificateUrl) {
      return res.status(400).json({
        success: false,
        msg: 'Certificate URL is required'
      });
    }

    console.log('🗑️ Deleting certificate:', certificateUrl);

    // Get current certificates from database
    const getProfileQuery = 'SELECT certificatesPath FROM job_seekers WHERE userId = ?';
    
    db.query(getProfileQuery, [userId], async (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          msg: 'Profile not found'
        });
      }

      let certificates = safeJsonParse(results[0].certificatesPath, []);
      
      // Check if certificate exists
      if (!certificates.includes(certificateUrl)) {
        return res.status(404).json({
          success: false,
          msg: 'Certificate not found'
        });
      }

      try {
        // Delete physical file
        const filePath = path.join(__dirname, '..', certificateUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('✅ File deleted from disk:', filePath);
        }

        // Remove from array
        certificates = certificates.filter(cert => cert !== certificateUrl);

        // Update database
        const updateQuery = 'UPDATE job_seekers SET certificatesPath = ? WHERE userId = ?';
        
        db.query(updateQuery, [JSON.stringify(certificates), userId], (err) => {
          if (err) {
            console.error('❌ Update error:', err);
            return res.status(500).json({
              success: false,
              msg: 'Failed to update database'
            });
          }

          console.log('✅ Certificate deleted successfully');
          res.json({
            success: true,
            msg: 'Certificate deleted successfully',
            certificates
          });
        });

      } catch (fileError) {
        console.error('❌ File deletion error:', fileError);
        
        // Still remove from database even if file deletion fails
        certificates = certificates.filter(cert => cert !== certificateUrl);
        
        const updateQuery = 'UPDATE job_seekers SET certificatesPath = ? WHERE userId = ?';
        db.query(updateQuery, [JSON.stringify(certificates), userId], (err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              msg: 'Failed to delete certificate'
            });
          }

          res.json({
            success: true,
            msg: 'Certificate removed from profile (file deletion failed)',
            certificates
          });
        });
      }
    });

  } catch (error) {
    console.error('❌ Delete certificate error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
};

module.exports = {
  getFreelancerProfile,
  updateFreelancerProfile,
  deleteCertificate,
  upload 
};
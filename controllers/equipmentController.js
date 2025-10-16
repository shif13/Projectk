// equipmentController.js - Frontend Direct Upload to Cloudinary
const { db } = require('../config/db');
const { sendProfileUpdateEmail, sendEquipmentAddedEmail } = require('../services/emailService');

// ==========================================
// GET EQUIPMENT OWNER PROFILE
// ==========================================
const getEquipmentOwnerProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    console.log('🔍 Request received for profile');
    console.log('👤 User ID from token:', userId);

    if (!userId) {
      console.log('❌ No userId in request');
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    console.log('📋 Fetching equipment owner profile for user:', userId);

    // Get user basic info
    const userQuery = `
      SELECT id, userName, email, firstName, lastName, 
             phone, location, isEquipmentOwner, createdAt 
      FROM users 
      WHERE id = ?
    `;
    
    db.query(userQuery, [userId], (err, users) => {
      if (err) {
        console.error('❌ Database error getting user:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Error fetching user profile',
          error: err.message 
        });
      }

      console.log('📊 Query result:', users);

      if (!users || users.length === 0) {
        console.log('❌ User not found in database');
        return res.status(404).json({ 
          success: false, 
          msg: 'User not found' 
        });
      }

      const user = users[0];
      console.log('✅ User found:', {
        id: user.id,
        userName: user.userName,
        isEquipmentOwner: user.isEquipmentOwner
      });

      // Check if user has equipment owner role
      if (!user.isEquipmentOwner) {
        console.log('⚠️ User does not have equipment owner role');
        return res.status(403).json({
          success: false,
          msg: 'Access denied. Equipment owner role required.'
        });
      }

      console.log('✅ User is an equipment owner, fetching equipment...');

      // Get user's equipment list
      const equipmentQuery = 'SELECT * FROM equipment WHERE userId = ? ORDER BY createdAt DESC';
      
      db.query(equipmentQuery, [userId], (err, equipment) => {
        if (err) {
          console.error('❌ Database error getting equipment:', err);
          return res.status(500).json({ 
            success: false, 
            msg: 'Error fetching equipment',
            error: err.message 
          });
        }

        console.log(`📦 Found ${equipment ? equipment.length : 0} equipment items`);

        // Parse equipment images JSON safely - FIXED FOR BUFFER/JSON
        const equipmentList = (equipment || []).map(eq => {
          let parsedImages = [];
          
          console.log(`Processing equipment ${eq.id}:`, {
            rawImagesType: typeof eq.equipmentImages,
            isBuffer: Buffer.isBuffer(eq.equipmentImages),
            rawValue: eq.equipmentImages
          });
          
          try {
            // Handle Buffer (MySQL JSON column returns Buffer in older Node.js versions)
            if (Buffer.isBuffer(eq.equipmentImages)) {
              const imageString = eq.equipmentImages.toString('utf8');
              console.log(`Buffer converted to string for equipment ${eq.id}:`, imageString);
              const parsed = JSON.parse(imageString);
              parsedImages = Array.isArray(parsed) ? parsed : [];
              console.log(`Parsed from Buffer for equipment ${eq.id}:`, parsedImages);
            }
            // Handle string (JSON stored as TEXT or VARCHAR)
            else if (typeof eq.equipmentImages === 'string' && eq.equipmentImages.trim()) {
              const parsed = JSON.parse(eq.equipmentImages);
              parsedImages = Array.isArray(parsed) ? parsed : [];
              console.log(`Parsed from string for equipment ${eq.id}:`, parsedImages);
            }
            // Handle array (already parsed by MySQL driver)
            else if (Array.isArray(eq.equipmentImages)) {
              parsedImages = eq.equipmentImages;
              console.log(`Already array for equipment ${eq.id}:`, parsedImages);
            }
            // Handle object (MySQL JSON type already parsed to object)
            else if (eq.equipmentImages && typeof eq.equipmentImages === 'object') {
              // If it's an object but not an array, it might be already parsed JSON
              parsedImages = Array.isArray(eq.equipmentImages) ? eq.equipmentImages : [];
              console.log(`Object handled for equipment ${eq.id}:`, parsedImages);
            }
            else {
              console.log(`No images or null for equipment ${eq.id}`);
              parsedImages = [];
            }
          } catch (parseError) {
            console.error('⚠️ Error parsing images for equipment:', eq.id, parseError.message);
            console.error('Raw value was:', eq.equipmentImages);
            parsedImages = [];
          }
          
          return {
            ...eq,
            equipmentImages: parsedImages
          };
        });

        console.log('✅ Profile and equipment fetched successfully');
        console.log('Final equipment list:', equipmentList.map(eq => ({
          id: eq.id,
          name: eq.equipmentName,
          images: eq.equipmentImages
        })));

        return res.status(200).json({
          success: true,
          user,
          equipment: equipmentList
        });
      });
    });
  } catch (error) {
    console.error('❌ Unexpected error in getEquipmentOwnerProfile:', error);
    
    // Make sure we send a response even if there's an error
    return res.status(500).json({ 
      success: false, 
      msg: 'Server error',
      error: error.message 
    });
  }
};

// ==========================================
// UPDATE EQUIPMENT OWNER PROFILE
// ==========================================

const updateEquipmentOwnerProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    const { firstName, lastName, phone, email, location } = req.body;

    console.log('🔄 Updating profile for user:', userId);

    // Validation
    const errors = [];
    if (!firstName || firstName.trim().length < 1) {
      errors.push('First name is required');
    }
    if (!lastName || lastName.trim().length < 1) {
      errors.push('Last name is required');
    }
    if (!phone || phone.trim().length < 8) {
      errors.push('Valid phone number is required');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        msg: errors.join(', ') 
      });
    }

    // Check if email is already taken by another user
    const emailCheckQuery = 'SELECT id FROM users WHERE email = ? AND id != ?';
    
    db.query(emailCheckQuery, [email.trim().toLowerCase(), userId], (err, results) => {
      if (err) {
        console.error('❌ Email check error:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Error checking email availability' 
        });
      }

      if (results.length > 0) {
        return res.status(400).json({ 
          success: false, 
          msg: 'Email is already in use by another account' 
        });
      }

      // Update profile
      const updateQuery = `
        UPDATE users 
        SET firstName = ?, lastName = ?, phone = ?, email = ?, location = ?
        WHERE id = ?
      `;

      db.query(updateQuery, [
        firstName.trim(),
        lastName.trim(),
        phone.trim(),
        email.trim().toLowerCase(),
        location ? location.trim() : null,
        userId
      ], async (err) => {
        if (err) {
          console.error('❌ Update profile error:', err);
          return res.status(500).json({ 
            success: false, 
            msg: 'Error updating profile' 
          });
        }

        console.log('✅ Profile updated successfully for user:', userId);

        // 📧 Send profile update email
        try {
          await sendProfileUpdateEmail({
            email: email.trim().toLowerCase(),
            firstName: firstName.trim()
          });
          console.log('✅ Profile update email sent');
        } catch (emailError) {
          console.error('⚠️ Failed to send profile update email:', emailError);
        }

        res.json({ 
          success: true, 
          msg: 'Profile updated successfully' 
        });
      });
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error' 
    });
  }
};

// ==========================================
// ADD EQUIPMENT (Cloudinary URLs from frontend)
// ==========================================

const addEquipment = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === ADD EQUIPMENT REQUEST ===`);

  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    const {
      equipmentName,
      equipmentType,
      location,
      contactPerson,
      contactNumber,
      contactEmail,
      availability,
      description,
      equipmentImages // Array of Cloudinary URLs from frontend
    } = req.body;

    // Validation
    const errors = [];
    if (!equipmentName || equipmentName.trim().length < 2) {
      errors.push('Equipment name must be at least 2 characters');
    }
    if (!equipmentType || equipmentType.trim().length < 2) {
      errors.push('Equipment type is required');
    }
    if (!contactPerson || contactPerson.trim().length < 2) {
      errors.push('Contact person is required');
    }
    if (!contactNumber || contactNumber.trim().length < 8) {
      errors.push('Valid contact number is required');
    }
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errors.push('Valid email is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        msg: errors.join(', ') 
      });
    }

    console.log('📸 Images provided:', equipmentImages?.length || 0);

    // Insert equipment
    const insertQuery = `
      INSERT INTO equipment (
        userId, equipmentName, equipmentType, location, 
        contactPerson, contactNumber, contactEmail, 
        availability, description, equipmentImages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [
      userId,
      equipmentName.trim(),
      equipmentType.trim(),
      location ? location.trim() : null,
      contactPerson.trim(),
      contactNumber.trim(),
      contactEmail.trim().toLowerCase(),
      availability || 'available',
      description ? description.trim() : null,
      JSON.stringify(equipmentImages || [])
    ], (err, result) => {
      if (err) {
        console.error('❌ Insert equipment error:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Error adding equipment' 
        });
      }

      const responseTime = Date.now() - startTime;
      const equipmentId = result.insertId;
      console.log(`✅ Equipment added with ID: ${equipmentId} in ${responseTime}ms`);

      // Send response immediately
      res.status(201).json({
        success: true,
        msg: 'Equipment added successfully!',
        equipment: {
          id: equipmentId,
          equipmentName: equipmentName.trim(),
          equipmentType: equipmentType.trim(),
          availability: availability || 'available',
          images: equipmentImages || []
        },
        timestamp: new Date().toISOString(),
        processingTime: `${responseTime}ms`
      });

      // 📧 Send email asynchronously (after response)
      console.log('📧 Attempting to send equipment added email...');
      
      // Get user info for email
      db.query('SELECT firstName, email FROM users WHERE id = ?', [userId], async (err, users) => {
        if (err) {
          console.error('⚠️ Error fetching user for email:', err);
          return;
        }

        if (users.length === 0) {
          console.error('⚠️ User not found for email');
          return;
        }

        const user = users[0];
        console.log(`📧 Sending equipment added email to: ${user.email}`);

        try {
          await sendEquipmentAddedEmail(
            {
              firstName: user.firstName,
              email: user.email
            },
            equipmentName.trim()
          );
          console.log('✅ Equipment added email sent successfully!');
        } catch (emailError) {
          console.error('❌ Failed to send equipment added email:', emailError);
          console.error('❌ Email error details:', emailError.message);
        }
      });
    });

  } catch (error) {
    console.error('❌ Add equipment error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error' 
    });
  }
};

// ==========================================
// UPDATE EQUIPMENT (Cloudinary URLs from frontend)
// ==========================================

const updateEquipment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const equipmentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    const {
      equipmentName,
      equipmentType,
      location,
      contactPerson,
      contactNumber,
      contactEmail,
      availability,
      description,
      equipmentImages // Array of Cloudinary URLs from frontend
    } = req.body;

    // Check if equipment belongs to user
    const checkQuery = 'SELECT id FROM equipment WHERE id = ? AND userId = ?';
    
    db.query(checkQuery, [equipmentId, userId], (err, results) => {
      if (err) {
        console.error('❌ Check equipment error:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Error checking equipment' 
        });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          success: false, 
          msg: 'Equipment not found or access denied' 
        });
      }

      // Update equipment
      const updateQuery = `
        UPDATE equipment 
        SET equipmentName = ?, equipmentType = ?, location = ?,
            contactPerson = ?, contactNumber = ?, contactEmail = ?,
            availability = ?, description = ?, equipmentImages = ?
        WHERE id = ? AND userId = ?
      `;

      db.query(updateQuery, [
        equipmentName ? equipmentName.trim() : null,
        equipmentType ? equipmentType.trim() : null,
        location ? location.trim() : null,
        contactPerson ? contactPerson.trim() : null,
        contactNumber ? contactNumber.trim() : null,
        contactEmail ? contactEmail.trim().toLowerCase() : null,
        availability || 'available',
        description ? description.trim() : null,
        JSON.stringify(equipmentImages || []),
        equipmentId,
        userId
      ], (err) => {
        if (err) {
          console.error('❌ Update equipment error:', err);
          return res.status(500).json({ 
            success: false, 
            msg: 'Error updating equipment' 
          });
        }

        console.log('✅ Equipment updated:', equipmentId);
        res.json({ 
          success: true, 
          msg: 'Equipment updated successfully'
        });
      });
    });
  } catch (error) {
    console.error('❌ Update equipment error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error' 
    });
  }
};

// ==========================================
// DELETE EQUIPMENT
// ==========================================

const deleteEquipment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const equipmentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    // Check if equipment belongs to user
    const checkQuery = 'SELECT equipmentImages FROM equipment WHERE id = ? AND userId = ?';
    
    db.query(checkQuery, [equipmentId, userId], (err, results) => {
      if (err) {
        console.error('❌ Check equipment error:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Error checking equipment' 
        });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          success: false, 
          msg: 'Equipment not found or access denied' 
        });
      }

      // Delete equipment
      const deleteQuery = 'DELETE FROM equipment WHERE id = ? AND userId = ?';
      
      db.query(deleteQuery, [equipmentId, userId], (err) => {
        if (err) {
          console.error('❌ Delete equipment error:', err);
          return res.status(500).json({ 
            success: false, 
            msg: 'Error deleting equipment' 
          });
        }

        console.log('✅ Equipment deleted:', equipmentId);
        res.json({ 
          success: true, 
          msg: 'Equipment deleted successfully' 
        });
      });
    });
  } catch (error) {
    console.error('❌ Delete equipment error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error' 
    });
  }
};

// ==========================================
// CREATE EQUIPMENT TABLE
// ==========================================

const createEquipmentTable = () => {
  return new Promise((resolve, reject) => {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS equipment (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        equipmentName VARCHAR(255) NOT NULL,
        equipmentType VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        contactPerson VARCHAR(100) NOT NULL,
        contactNumber VARCHAR(20) NOT NULL,
        contactEmail VARCHAR(255) NOT NULL,
        availability ENUM('available', 'on-hire') DEFAULT 'available',
        description TEXT,
        equipmentImages JSON,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_availability (availability),
        INDEX idx_location (location),
        INDEX idx_equipment_type (equipmentType)
      )
    `;

    db.query(createTableQuery, (err) => {
      if (err) {
        console.error('❌ Error creating equipment table:', err.message);
        return reject(err);
      }
      console.log('✅ Equipment table initialized');
      resolve();
    });
  });
};

// Initialize table on load
let tablesInitialized = false;
const initializeTables = async () => {
  if (!tablesInitialized) {
    try {
      await createEquipmentTable();
      tablesInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize equipment table:', error);
    }
  }
};

initializeTables();

module.exports = {
  getEquipmentOwnerProfile,
  updateEquipmentOwnerProfile,
  addEquipment,
  updateEquipment,
  deleteEquipment,
  createEquipmentTable
};
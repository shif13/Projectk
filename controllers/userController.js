const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { sendWelcomeEmail, sendRoleSelectionEmail } = require('../services/emailService')

// ==========================================
// DATABASE TABLE CREATION
// ==========================================

const createTables = () => {
  return new Promise((resolve, reject) => {
    // Users table - userType can be NULL until role selection
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userName VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        firstName VARCHAR(50) NOT NULL,
        lastName VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        location VARCHAR(100),
        userType ENUM('jobseeker', 'equipment_owner') DEFAULT NULL,
        isFreelancer BOOLEAN DEFAULT FALSE,
        isEquipmentOwner BOOLEAN DEFAULT FALSE,
        rolesSelected BOOLEAN DEFAULT FALSE,
        resetToken VARCHAR(255),
        resetTokenExpiry DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_userName (userName),
        INDEX idx_userType (userType),
        INDEX idx_roles (isFreelancer, isEquipmentOwner),
        INDEX idx_rolesSelected (rolesSelected)
      )
    `;

    // Job seekers profile table
    const createJobSeekersTable = `
      CREATE TABLE IF NOT EXISTS job_seekers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        title VARCHAR(100),
        experience VARCHAR(50),
        expectedSalary VARCHAR(50),
        salaryCurrency VARCHAR(10) DEFAULT 'USD',
        bio TEXT,
        availability ENUM('available', 'busy') DEFAULT 'available',
        availableFrom DATE,
        cvFilePath VARCHAR(255),
        certificatesPath JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_availability (availability)
      )
    `;

    // Equipment owners profile table
    const createEquipmentOwnersTable = `
      CREATE TABLE IF NOT EXISTS equipment_owners (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        companyName VARCHAR(255),
        businessLicense VARCHAR(255),
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId)
      )
    `;

    // Execute table creation in sequence
    db.query(createUsersTable, (err) => {
      if (err) {
        console.error('❌ Error creating users table:', err.message);
        return reject(err);
      }
      
      db.query(createJobSeekersTable, (err) => {
        if (err) {
          console.error('❌ Error creating job_seekers table:', err.message);
          return reject(err);
        }
        
        db.query(createEquipmentOwnersTable, (err) => {
          if (err) {
            console.error('❌ Error creating equipment_owners table:', err.message);
            return reject(err);
          }
          
          console.log('✅ All tables initialized successfully');
          resolve();
        });
      });
    });
  });
};

let tablesInitialized = false;
const initializeTables = async () => {
  if (!tablesInitialized) {
    try {
      await createTables();
      tablesInitialized = true;
      console.log('✅ Database tables initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize tables:', error);
    }
  }
};

initializeTables();

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Validate signup fields (NO userType required)
const validateSignupFields = ({ firstName, lastName, userName, email, password }) => {
  const errors = [];

  if (!firstName || firstName.trim().length < 1) errors.push('First name is required');
  if (!lastName || lastName.trim().length < 1) errors.push('Last name is required');
  if (!userName || userName.trim().length < 3) errors.push('Username must be at least 3 characters');
  if (userName && !/^[a-zA-Z0-9_]{3,30}$/.test(userName.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters');

  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Check if user exists
const checkExistingUser = (email, userName) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT id, email, userName FROM users WHERE email = ? OR userName = ?';
    
    db.query(query, [email, userName], (err, results) => {
      if (err) return reject(err);
      
      if (results.length > 0) {
        const user = results[0];
        const conflictField = user.email === email ? 'email' : 'username';
        resolve({ exists: true, conflictField });
      } else {
        resolve({ exists: false });
      }
    });
  });
};

// Generate JWT token
const generateJWTToken = (userId, email, userType, isFreelancer, isEquipmentOwner, rolesSelected) => {
  try {
    const payload = {
      userId: userId,
      email: email,
      userType: userType,
      isFreelancer: isFreelancer,
      isEquipmentOwner: isEquipmentOwner,
      rolesSelected: rolesSelected,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your-default-secret-key-change-this',
      { 
        expiresIn: '24h',
        issuer: 'profetch'
      }
    );

    return token;
  } catch (error) {
    console.error('❌ Token generation error:', error);
    throw new Error('Failed to generate authentication token');
  }
};

// Create empty profile tables based on roles
const createEmptyProfiles = (userId, isFreelancer, isEquipmentOwner) => {
  return new Promise((resolve, reject) => {
    const promises = [];

    // Create job seeker profile if freelancer role selected
    if (isFreelancer) {
      const createJobSeekerProfile = new Promise((resolveJS, rejectJS) => {
        const query = `
          INSERT INTO job_seekers (userId, availability) 
          VALUES (?, 'available')
        `;
        
        db.query(query, [userId], (err, result) => {
          if (err) {
            console.error('❌ Failed to create job seeker profile:', err);
            rejectJS(err);
          } else {
            console.log('✅ Empty job seeker profile created for user:', userId);
            resolveJS(result);
          }
        });
      });
      
      promises.push(createJobSeekerProfile);
    }

    // Create equipment owner profile if equipment owner role selected
    if (isEquipmentOwner) {
      const createEquipmentOwnerProfile = new Promise((resolveEO, rejectEO) => {
        const query = `INSERT INTO equipment_owners (userId) VALUES (?)`;
        
        db.query(query, [userId], (err, result) => {
          if (err) {
            console.error('❌ Failed to create equipment owner profile:', err);
            rejectEO(err);
          } else {
            console.log('✅ Empty equipment owner profile created for user:', userId);
            resolveEO(result);
          }
        });
      });
      
      promises.push(createEquipmentOwnerProfile);
    }

    // Wait for all profile creations to complete
    if (promises.length === 0) {
      return resolve(); // No roles selected, nothing to create
    }

    Promise.all(promises)
      .then(() => {
        console.log('✅ All profiles created successfully');
        resolve();
      })
      .catch((error) => {
        console.warn('⚠️ Profile creation had errors:', error);
        reject(error);
      });
  });
};

// ==========================================
// STEP 1: BASIC SIGNUP (NO ROLE SELECTION)
// ==========================================

const createUser = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === USER SIGNUP REQUEST ===`);
  
  try {
    const {
      userName,
      email,
      password,
      firstName,
      lastName,
      phone,
      location
    } = req.body;

    console.log('🔥 Signup data:', { userName, email, firstName, lastName });

    // Validate required fields (NO userType needed)
    const validation = validateSignupFields({
      firstName, lastName, userName, email, password
    });

    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return res.status(400).json({ 
        success: false, 
        msg: validation.errors.join(', '),
        errors: validation.errors
      });
    }

    console.log('✅ Validation passed');

    // Check if user already exists
    const existingCheck = await checkExistingUser(
      email.toLowerCase().trim(), 
      userName.trim()
    );
    
    if (existingCheck.exists) {
      console.log('❌ User already exists:', existingCheck.conflictField);
      return res.status(409).json({ 
        success: false, 
        msg: `User with this ${existingCheck.conflictField} already exists`,
        conflictField: existingCheck.conflictField
      });
    }

    console.log('✅ No existing user found');

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('✅ Password hashed successfully');

    // Insert new user with NO roles selected yet (userType = NULL)
    const insertQuery = `
      INSERT INTO users (
        userName, email, password, firstName, lastName, 
        phone, location, userType, isFreelancer, isEquipmentOwner, rolesSelected
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, FALSE, FALSE, FALSE)
    `;

    db.query(insertQuery, [
  userName.trim(),
  email.toLowerCase().trim(),
  hashedPassword,
  firstName.trim(),
  lastName.trim(),
  phone ? phone.trim() : null,
  location ? location.trim() : null
], async (err, result) => {  // ⬅️ ADD 'async' here
  if (err) {
    console.error('❌ User creation error:', err);
    let statusCode = 500;
    let errorMessage = 'Server error during user creation. Please try again.';
    
    if (err.code === 'ER_DUP_ENTRY') {
      statusCode = 409;
      errorMessage = 'User with this email or username already exists';
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      msg: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  const userId = result.insertId;
  console.log(`✅ User created with ID: ${userId}`);

  // Generate JWT token
  const token = generateJWTToken(userId, email.toLowerCase().trim(), null, false, false, false);

  const userData = {
    id: userId,
    userName: userName.trim(),
    email: email.toLowerCase().trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone ? phone.trim() : null,
    location: location ? location.trim() : null,
    userType: null,
    isFreelancer: false,
    isEquipmentOwner: false,
    rolesSelected: false,
    requiresRoleSelection: true
  };

  const responseTime = Date.now() - startTime;
  console.log(`✅ User signup completed in ${responseTime}ms`);

  // 📧 Send welcome email
  try {
    await sendWelcomeEmail(userData);  // ⬅️ Now this works!
    console.log('✅ Welcome email sent to:', userData.email);
  } catch (emailError) {
    console.error('⚠️ Failed to send welcome email:', emailError);
    // Don't fail the signup if email fails
  }

  res.status(201).json({
    success: true,
    msg: 'Account created successfully! Please select your role to continue.',
    token,
    user: userData,
    timestamp: new Date().toISOString(),
    processingTime: `${responseTime}ms`
  });
});

  } catch (error) {
    console.error('❌ User signup error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error during signup',
      timestamp: new Date().toISOString()
    });
  }
};

// ==========================================
// STEP 2: ROLE SELECTION (SUPPORTS BOTH ROLES)
// ==========================================

const selectRoles = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === ROLE SELECTION REQUEST ===`);
  
  try {
    const { isFreelancer, isEquipmentOwner, primaryRole } = req.body;

    // Verify token and get user ID
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        msg: 'Authentication required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-default-secret-key-change-this');
    } catch (err) {
      return res.status(401).json({
        success: false,
        msg: 'Invalid or expired token'
      });
    }

    const userId = decoded.userId;
    console.log('✅ User authenticated:', userId);

    // Validate: At least one role must be selected
    if (!isFreelancer && !isEquipmentOwner) {
      return res.status(400).json({
        success: false,
        msg: 'Please select at least one role'
      });
    }

    // Determine userType based on selection
    let userType;
    
    if (isFreelancer && !isEquipmentOwner) {
      // Only freelancer
      userType = 'jobseeker';
      console.log('📋 Role: Freelancer only');
    } else if (!isFreelancer && isEquipmentOwner) {
      // Only equipment owner
      userType = 'equipment_owner';
      console.log('📋 Role: Equipment Owner only');
    } else if (isFreelancer && isEquipmentOwner) {
      // BOTH roles - use primaryRole if provided, otherwise default to jobseeker
      userType = primaryRole || 'jobseeker';
      console.log('📋 Role: BOTH (Primary:', userType + ')');
    }

    console.log('🔥 Role selection:', { isFreelancer, isEquipmentOwner, userType });

    // Get current user
    const getUserQuery = 'SELECT * FROM users WHERE id = ?';
    db.query(getUserQuery, [userId], async (err, users) => {
      if (err || users.length === 0) {
        return res.status(404).json({
          success: false,
          msg: 'User not found'
        });
      }

      const user = users[0];

      // Check if roles already selected
      if (user.rolesSelected) {
        return res.status(400).json({
          success: false,
          msg: 'Roles have already been selected for this account. Please contact support to modify roles.'
        });
      }

      // Update user with selected roles
      const updateQuery = `
        UPDATE users 
        SET userType = ?,
            isFreelancer = ?,
            isEquipmentOwner = ?,
            rolesSelected = TRUE
        WHERE id = ?
      `;
      
      db.query(updateQuery, [userType, isFreelancer, isEquipmentOwner, userId], async (err) => {
        if (err) {
          console.error('❌ Role update error:', err);
          return res.status(500).json({
            success: false,
            msg: 'Failed to update roles'
          });
        }

        console.log('✅ Roles updated successfully');

        // Create empty profile tables based on selected roles
        try {
          await createEmptyProfiles(userId, isFreelancer, isEquipmentOwner);
          console.log('✅ Profile tables created');
        } catch (profileErr) {
          console.error('❌ Profile creation failed:', profileErr);
          return res.status(500).json({
            success: false,
            msg: 'Failed to create profile tables'
          });
        }

        // Generate new token with updated roles
        const newToken = generateJWTToken(userId, user.email, userType, isFreelancer, isEquipmentOwner, true);

        const responseTime = Date.now() - startTime;
        console.log(`✅ Role selection completed in ${responseTime}ms`);

        res.json({
          success: true,
          msg: 'Roles selected successfully! Welcome to ProFetch.',
          token: newToken,
          user: {
            id: userId,
            userName: user.userName,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            location: user.location,
            userType: userType,
            isFreelancer: isFreelancer,
            isEquipmentOwner: isEquipmentOwner,
            rolesSelected: true,
            hasBothRoles: isFreelancer && isEquipmentOwner
          },
          timestamp: new Date().toISOString(),
          processingTime: `${responseTime}ms`
        });
      });
    });

  } catch (error) {
    console.error('❌ Role selection error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error during role selection',
      timestamp: new Date().toISOString()
    });
  }
};

// ==========================================
// GET USER INFO
// ==========================================

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT id, userName, email, firstName, lastName, phone, location,
             userType, isFreelancer, isEquipmentOwner, rolesSelected, 
             createdAt, updatedAt 
      FROM users 
      WHERE id = ?
    `;

    db.query(query, [id], (err, results) => {
      if (err) {
        console.error('❌ Error fetching user:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to fetch user' 
        });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          success: false, 
          msg: 'User not found' 
        });
      }

      const user = results[0];
      user.hasBothRoles = user.isFreelancer && user.isEquipmentOwner;

      res.json({
        success: true,
        user: user
      });
    });

  } catch (error) {
    console.error('❌ Get user by ID error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while fetching user' 
    });
  }
};

// ==========================================
// GET ALL USERS
// ==========================================

const getAllUsers = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const query = `
      SELECT id, userName, email, firstName, lastName, phone, location,
             userType, isFreelancer, isEquipmentOwner, rolesSelected, 
             createdAt, updatedAt 
      FROM users
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;

    db.query(query, [parseInt(limit), parseInt(offset)], (err, results) => {
      if (err) {
        console.error('❌ Error fetching users:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to fetch users' 
        });
      }

      const users = results.map(user => ({
        ...user,
        hasBothRoles: user.isFreelancer && user.isEquipmentOwner
      }));

      res.json({
        success: true,
        users: users,
        count: users.length
      });
    });

  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while fetching users' 
    });
  }
};

// ==========================================
// UPDATE USER
// ==========================================

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, location, password } = req.body;

    const updates = [];
    const values = [];

    if (firstName) {
      updates.push('firstName = ?');
      values.push(firstName.trim());
    }
    if (lastName) {
      updates.push('lastName = ?');
      values.push(lastName.trim());
    }
    if (phone) {
      updates.push('phone = ?');
      values.push(phone.trim());
    }
    if (location) {
      updates.push('location = ?');
      values.push(location.trim());
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        msg: 'No fields to update' 
      });
    }

    values.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('❌ Error updating user:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to update user' 
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          msg: 'User not found' 
        });
      }

      res.json({
        success: true,
        msg: 'User updated successfully'
      });
    });

  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while updating user' 
    });
  }
};

// ==========================================
// DELETE USER
// ==========================================

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM users WHERE id = ?';

    db.query(query, [id], (err, result) => {
      if (err) {
        console.error('❌ Error deleting user:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to delete user' 
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          msg: 'User not found' 
        });
      }

      res.json({
        success: true,
        msg: 'User deleted successfully'
      });
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while deleting user' 
    });
  }
};

// ==========================================
// SEARCH USERS
// ==========================================

const searchUsers = async (req, res) => {
  try {
    const { q, userType } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Search term must be at least 2 characters' 
      });
    }

    const searchTerm = `%${q.trim()}%`;
    let query = `
      SELECT id, userName, email, firstName, lastName, phone, location,
             userType, isFreelancer, isEquipmentOwner, rolesSelected, 
             createdAt, updatedAt 
      FROM users 
      WHERE (firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR userName LIKE ?)
    `;
    const params = [searchTerm, searchTerm, searchTerm, searchTerm];

    if (userType && ['jobseeker', 'equipment_owner'].includes(userType)) {
      query += ' AND userType = ?';
      params.push(userType);
    }

    query += ' ORDER BY createdAt DESC LIMIT 50';

    db.query(query, params, (err, results) => {
      if (err) {
        console.error('❌ Error searching users:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to search users' 
        });
      }

      const users = results.map(user => ({
        ...user,
        hasBothRoles: user.isFreelancer && user.isEquipmentOwner
      }));

      res.json({
        success: true,
        users: users,
        count: users.length,
        searchTerm: q.trim()
      });
    });

  } catch (error) {
    console.error('❌ Search users error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while searching users' 
    });
  }
};

// ==========================================
// GET USER STATISTICS
// ==========================================

const getUserStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as totalUsers,
        SUM(CASE WHEN isFreelancer = TRUE THEN 1 ELSE 0 END) as totalFreelancers,
        SUM(CASE WHEN isEquipmentOwner = TRUE THEN 1 ELSE 0 END) as totalEquipmentOwners,
        SUM(CASE WHEN isFreelancer = TRUE AND isEquipmentOwner = TRUE THEN 1 ELSE 0 END) as bothRoles,
        SUM(CASE WHEN rolesSelected = FALSE THEN 1 ELSE 0 END) as pendingRoleSelection,
        SUM(CASE WHEN DATE(createdAt) = CURDATE() THEN 1 ELSE 0 END) as newUsersToday,
        SUM(CASE WHEN DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as newUsersThisWeek
      FROM users
    `;

    db.query(statsQuery, (err, results) => {
      if (err) {
        console.error('❌ Error fetching user stats:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to fetch user statistics' 
        });
      }

      res.json({
        success: true,
        stats: results[0]
      });
    });

  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while fetching statistics' 
    });
  }
};

// ==========================================
// GET USERS BY TYPE
// ==========================================

const getUsersByType = async (req, res) => {
  try {
    const { userType } = req.params;

    if (!['jobseeker', 'equipment_owner'].includes(userType)) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Invalid user type' 
      });
    }

    const query = `
      SELECT id, userName, email, firstName, lastName, phone, location,
             userType, isFreelancer, isEquipmentOwner, rolesSelected, 
             createdAt, updatedAt 
      FROM users 
      WHERE userType = ?
      ORDER BY createdAt DESC
    `;

    db.query(query, [userType], (err, results) => {
      if (err) {
        console.error('❌ Error fetching users by type:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Failed to fetch users' 
        });
      }

      const users = results.map(user => ({
        ...user,
        hasBothRoles: user.isFreelancer && user.isEquipmentOwner
      }));

      res.json({
        success: true,
        users: users,
        count: users.length,
        userType: userType
      });
    });

  } catch (error) {
    console.error('❌ Get users by type error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error while fetching users' 
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  createUser,
  selectRoles,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByType,
  searchUsers,
  getUserStats,
  createTables,
  validateSignupFields,
  checkExistingUser,
  generateJWTToken,
  createEmptyProfiles
};
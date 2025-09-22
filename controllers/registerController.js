const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { cleanupUploadedFiles } = require('../middleware/registerMiddleware');

// Import the email service (make sure this file exists or comment out if not using)
const { sendWelcomeEmail } = require('../services/emailService');

// Create tables if they don't exist
const createTables = () => {
  return new Promise((resolve, reject) => {
    // Users table - Add resetToken and resetTokenExpiry columns
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userName VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        userType ENUM('jobseeker', 'recruiter') NOT NULL,
        firstName VARCHAR(50) NOT NULL,
        lastName VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        location VARCHAR(100),
        resetToken VARCHAR(255),
        resetTokenExpiry DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;

    // Job seekers profile table
    const createJobSeekersTable = `
      CREATE TABLE IF NOT EXISTS job_seekers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        title VARCHAR(100),
        experience VARCHAR(50),
        skills JSON,
        expectedSalary VARCHAR(50),
        linkedinUrl VARCHAR(255),
        githubUrl VARCHAR(255),
        bio TEXT,
        availability ENUM('available', 'busy') DEFAULT 'available',
        cvFilePath VARCHAR(255),
        certificatesPath JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Recruiters table
    const createRecruitersTable = `
      CREATE TABLE IF NOT EXISTS recruiters (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        companyName VARCHAR(100) NOT NULL,
        companySize VARCHAR(50),
        industry VARCHAR(100),
        companyWebsite VARCHAR(255),
        companyDescription TEXT,
        position VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Execute table creation queries in sequence
    db.query(createUsersTable, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
        return reject(err);
      }
      
      db.query(createJobSeekersTable, (err) => {
        if (err) {
          console.error('Error creating job_seekers table:', err.message);
          return reject(err);
        }
        
        db.query(createRecruitersTable, (err) => {
          if (err) {
            console.error('Error creating recruiters table:', err.message);
            return reject(err);
          }
          
          resolve();
        });
      });
    });
  });
};

// Initialize tables on first controller load
let tablesInitialized = false;
const initializeTables = async () => {
  if (!tablesInitialized) {
    try {
      await createTables();
      tablesInitialized = true;
      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tables:', error);
    }
  }
};

// Call initialization
initializeTables();

// Helper function to validate and process skills
const processSkills = (skills) => {
  console.log('Processing skills - input:', { type: typeof skills, value: skills });
  
  let skillsArray = [];
  
  if (!skills) {
    return skillsArray;
  }
  
  // If it's already an array, use it
  if (Array.isArray(skills)) {
    skillsArray = skills;
  }
  // If it's a string, try to parse as JSON first, then fallback to comma-split
  else if (typeof skills === 'string') {
    const trimmed = skills.trim();
    
    if (trimmed === '' || trimmed === '[]') {
      return skillsArray;
    }
    
    // Try JSON parse first
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          skillsArray = parsed;
        }
      } catch (jsonError) {
        console.warn('Failed to parse skills JSON:', jsonError.message);
        // Fallback to comma-split
        skillsArray = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
    } else {
      // Split by comma
      skillsArray = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
  }
  
  // Clean and validate the array
  skillsArray = skillsArray
    .map(skill => String(skill).trim())
    .filter(skill => skill.length > 0 && skill.length <= 50)
    .slice(0, 20); // Limit to 20 skills
  
  console.log('Processed skills result:', skillsArray);
  return skillsArray;
};

// Enhanced validation function
const validateRequiredFields = ({ firstName, lastName, userName, email, password, userType, companyName }) => {
  const errors = [];

  if (!firstName || firstName.trim().length < 1) errors.push('First name is required');
  if (!lastName || lastName.trim().length < 1) errors.push('Last name is required');
  if (!userName || userName.trim().length < 3) errors.push('Username must be at least 3 characters');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
  if (!userType || !['jobseeker', 'recruiter'].includes(userType)) errors.push('Valid user type is required');
  
  if (userType === 'recruiter' && (!companyName || companyName.trim().length < 2)) {
    errors.push('Company name is required for recruiters');
  }

  // Additional validation
  if (userName && !/^[a-zA-Z0-9_]{3,30}$/.test(userName.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Promisified database operations
const checkExistingUser = (email, userName) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT id, email, userName FROM users WHERE email = ? OR userName = ?';
    db.query(query, [email, userName], (err, results) => {
      if (err) return reject(err);
      
      if (results.length > 0) {
        const user = results[0];
        const conflictField = user.email === email ? 'email' : 'username';
        resolve({ conflictField, user });
      } else {
        resolve(null);
      }
    });
  });
};

const insertUser = (userData) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO users (userName, email, password, userType, firstName, lastName, phone, location) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      userData.userName,
      userData.email,
      userData.hashedPassword,
      userData.userType,
      userData.firstName,
      userData.lastName,
      userData.phone,
      userData.location
    ];

    db.query(query, values, (err, result) => {
      if (err) return reject(err);
      resolve(result.insertId);
    });
  });
};

const rollbackTransaction = () => {
  return new Promise((resolve) => {
    db.rollback(() => {
      console.log('Transaction rolled back');
      resolve();
    });
  });
};

// URL validation helper
const validateUrl = (url) => {
  if (!url || url.trim() === '') return null;
  try {
    const urlObj = new URL(url.trim());
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' ? url.trim() : null;
  } catch {
    return null;
  }
};

// Handle job seeker profile creation
const handleJobSeekerProfileCreation = async (req, userId, profileData) => {
  try {
    const { title, experience, skills, expectedSalary, linkedinUrl, githubUrl, bio, availability } = profileData;

    // Handle file uploads
    let cvFilePath = null;
    let certificatesPath = [];

    if (req.files) {
      if (req.files.cvFile && req.files.cvFile[0]) {
        cvFilePath = req.files.cvFile[0].path;
      }
      if (req.files.certificateFiles && req.files.certificateFiles.length > 0) {
        certificatesPath = req.files.certificateFiles.map(file => file.path);
      }
    }

    // Process skills
    const parsedSkills = processSkills(skills);

    // Validate URLs
    const validLinkedinUrl = validateUrl(linkedinUrl);
    const validGithubUrl = validateUrl(githubUrl);

    const query = `
      INSERT INTO job_seekers (
        userId, title, experience, skills, expectedSalary, 
        linkedinUrl, githubUrl, bio, availability, cvFilePath, certificatesPath
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      userId,
      title ? title.trim() : null,
      experience ? experience.trim() : null,
      JSON.stringify(parsedSkills),
      expectedSalary ? expectedSalary.trim() : null,
      validLinkedinUrl,
      validGithubUrl,
      bio ? bio.trim() : null,
      availability || 'available',
      cvFilePath,
      JSON.stringify(certificatesPath)
    ];

    return new Promise((resolve, reject) => {
      db.query(query, values, (err, result) => {
        if (err) return reject(err);
        console.log('Job seeker profile created successfully');
        resolve(result.insertId);
      });
    });

  } catch (error) {
    console.error('Job seeker profile creation error:', error);
    throw error;
  }
};

// Handle recruiter profile creation
const handleRecruiterProfileCreation = async (req, userId, profileData) => {
  try {
    const { companyName, companySize, industry, companyWebsite, companyDescription, position } = profileData;

    const validWebsite = validateUrl(companyWebsite);

    const query = `
      INSERT INTO recruiters (
        userId, companyName, companySize, industry, 
        companyWebsite, companyDescription, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      userId,
      companyName.trim(),
      companySize ? companySize.trim() : null,
      industry ? industry.trim() : null,
      validWebsite,
      companyDescription ? companyDescription.trim() : null,
      position ? position.trim() : null
    ];

    return new Promise((resolve, reject) => {
      db.query(query, values, (err, result) => {
        if (err) return reject(err);
        console.log('Recruiter profile created successfully');
        resolve(result.insertId);
      });
    });

  } catch (error) {
    console.error('Recruiter profile creation error:', error);
    throw error;
  }
};

// Helper function to generate JWT token
const generateJWTToken = (userId, email, userType) => {
  try {
    const payload = {
      userId: userId,
      email: email,
      userType: userType,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your-default-secret-key-change-this',
      { 
        expiresIn: '24h',
        issuer: 'talentconnect'
      }
    );

    return token;
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate authentication token');
  }
};

// Helper function to send welcome email asynchronously
const sendWelcomeEmailAsync = async (userData, userType, companyName = null) => {
  try {
    const emailResult = await sendWelcomeEmail(userData, userType, companyName);
    if (emailResult && emailResult.success) {
      console.log(`Welcome email sent successfully to ${userType}:`, userData.email);
    } else {
      console.warn(`Failed to send welcome email to ${userType}:`, emailResult?.error || 'Unknown error');
    }
  } catch (emailError) {
    console.warn('Email sending error:', emailError.message);
    // Don't fail registration if email fails
  }
};

// Main registration function with improved error handling
const registerUser = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === REGISTRATION REQUEST START ===`);
  
  try {
    console.log('Request details:', {
      method: req.method,
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
      fileKeys: req.files ? Object.keys(req.files) : 'No files',
      userAgent: req.headers['user-agent']
    });

    const {
      userName,
      email,
      password,
      userType,
      firstName,
      lastName,
      phone,
      location,
      // Job seeker fields
      title,
      experience,
      skills,
      expectedSalary,
      linkedinUrl,
      githubUrl,
      bio,
      availability,
      // Recruiter fields
      companyName,
      companySize,
      industry,
      companyWebsite,
      companyDescription,
      position
    } = req.body;

    // Enhanced validation with detailed logging
    console.log('Validating required fields...');
    const validationResult = validateRequiredFields({
      firstName, lastName, userName, email, password, userType, companyName
    });

    if (!validationResult.isValid) {
      console.log(`[${startTime}] Registration failed - validation error:`, validationResult.message);
      cleanupUploadedFiles(req);
      return res.status(400).json({ 
        success: false, 
        msg: validationResult.message,
        timestamp: new Date().toISOString()
      });
    }

    console.log('Basic validation passed, checking database for existing users...');

    // Start a database transaction for atomic operations
    await new Promise((resolve, reject) => {
      db.beginTransaction((err) => {
        if (err) {
          console.error('Transaction start error:', err);
          return reject(err);
        }
        resolve();
      });
    });

    try {
      // Check if user already exists with more specific error handling
      const existingUser = await checkExistingUser(email.toLowerCase().trim(), userName.trim());
      
      if (existingUser) {
        await rollbackTransaction();
        console.log(`[${startTime}] Registration failed - user exists:`, existingUser.conflictField);
        cleanupUploadedFiles(req);
        return res.status(409).json({ 
          success: false, 
          msg: `User with this ${existingUser.conflictField} already exists`,
          conflictField: existingUser.conflictField,
          timestamp: new Date().toISOString()
        });
      }

      console.log('No existing user found, proceeding with registration...');

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      console.log('Password hashed successfully');

      // Insert user into users table
      const userId = await insertUser({
        userName: userName.trim(),
        email: email.toLowerCase().trim(),
        hashedPassword,
        userType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone ? phone.trim() : null,
        location: location ? location.trim() : null
      });

      console.log(`User created with ID: ${userId}`);

      // Prepare user data for response
      const userData = {
        id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: userName.trim(),
        email: email.toLowerCase().trim(),
        userType
      };

      // Handle user type specific profile creation
      if (userType === 'jobseeker') {
        await handleJobSeekerProfileCreation(req, userId, {
          title, experience, skills, expectedSalary, 
          linkedinUrl, githubUrl, bio, availability
        });
      } else if (userType === 'recruiter') {
        await handleRecruiterProfileCreation(req, userId, {
          companyName, companySize, industry, 
          companyWebsite, companyDescription, position
        });
      }

      // Commit transaction
      await new Promise((resolve, reject) => {
        db.commit((err) => {
          if (err) {
            console.error('Transaction commit error:', err);
            return reject(err);
          }
          resolve();
        });
      });

      console.log(`[${startTime}] Registration completed successfully`);

      // Generate JWT token
      const token = generateJWTToken(userId, userData.email, userData.userType);

      // Send welcome email (non-blocking)
      sendWelcomeEmailAsync(userData, userType, companyName);

      // Send success response
      const responseTime = Date.now() - startTime;
      res.status(201).json({
        success: true,
        msg: 'Registration successful! Welcome to TalentConnect!',
        token,
        user: {
          id: userId,
          userName: userData.userName,
          email: userData.email,
          userType: userData.userType,
          firstName: userData.firstName,
          lastName: userData.lastName
        },
        timestamp: new Date().toISOString(),
        processingTime: `${responseTime}ms`
      });

    } catch (dbError) {
      // Rollback transaction on any database error
      await rollbackTransaction();
      throw dbError;
    }

  } catch (error) {
    console.error(`[${startTime}] Registration error:`, error);
    cleanupUploadedFiles(req);
    
    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'Server error during registration. Please try again.';
    
    if (error.code === 'ER_DUP_ENTRY') {
      statusCode = 409;
      errorMessage = 'User with this email or username already exists';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Database connection failed. Please try again later.';
    }
    
    res.status(statusCode).json({ 
      success: false, 
      msg: errorMessage,
      timestamp: new Date().toISOString(),
      requestId: startTime
    });
  }
};

module.exports = {
  registerUser,
  createTables
};
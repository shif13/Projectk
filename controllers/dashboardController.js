const { db } = require('../config/db');
const { cleanupUploadedFiles } = require('../middleware/registerMiddleware');

// Helper function to safely parse JSON
const safeJsonParse = (jsonString, fallback = []) => {
  if (!jsonString) return fallback;
  if (typeof jsonString !== 'string') return jsonString;
  
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn('JSON parse error for:', jsonString, error.message);
    return fallback;
  }
};

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

// Enhanced validation function for updates
const validateRequiredFields = ({ firstName, lastName, userName, email, userType, companyName }) => {
  const errors = [];

  if (!firstName || firstName.trim().length < 1) errors.push('First name is required');
  if (!lastName || lastName.trim().length < 1) errors.push('Last name is required');
  if (!userName || userName.trim().length < 3) errors.push('Username must be at least 3 characters');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required');
  
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

// Promisified rollback function
const rollbackTransaction = () => {
  return new Promise((resolve) => {
    db.rollback(() => {
      console.log('Transaction rolled back');
      resolve();
    });
  });
};

// Get user profile
const getUserProfile = (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    const query = `
      SELECT id, userName, email, userType, firstName, lastName, 
             phone, location, createdAt 
      FROM users 
      WHERE id = ?
    `;
    
    db.query(query, [userId], (err, users) => {
      if (err) {
        console.error('Get profile error:', err);
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

      if (user.userType === 'jobseeker') {
        const profileQuery = 'SELECT * FROM job_seekers WHERE userId = ?';
        
        db.query(profileQuery, [userId], (err, jobSeekers) => {
          if (err) {
            console.error('Job seeker profile error:', err);
            return res.status(500).json({ 
              success: false, 
              msg: 'Error fetching user profile' 
            });
          }

          let profile = null;
          if (jobSeekers.length > 0) {
            try {
              profile = {
                ...jobSeekers[0],
                skills: safeJsonParse(jobSeekers[0].skills, []),
                certificatesPath: safeJsonParse(jobSeekers[0].certificatesPath, [])
              };
            } catch (parseError) {
              console.warn('Error parsing JSON fields:', parseError);
              profile = {
                ...jobSeekers[0],
                skills: [],
                certificatesPath: []
              };
            }
          }

          res.json({
            success: true,
            user,
            profile
          });
        });

      } else if (user.userType === 'recruiter') {
        const profileQuery = 'SELECT * FROM recruiters WHERE userId = ?';
        
        db.query(profileQuery, [userId], (err, recruiters) => {
          if (err) {
            console.error('Recruiter profile error:', err);
            return res.status(500).json({ 
              success: false, 
              msg: 'Error fetching user profile' 
            });
          }

          let profile = null;
          if (recruiters.length > 0) {
            profile = recruiters[0];
          }

          res.json({
            success: true,
            user,
            profile
          });
        });
      } else {
        res.status(400).json({
          success: false,
          msg: 'Invalid user type'
        });
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Error fetching user profile' 
    });
  }
};

// Update user profile - Enhanced version with file handling
const updateUserProfile = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === PROFILE UPDATE REQUEST START ===`);

  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        msg: 'Authentication required' 
      });
    }

    console.log('Update request details:', {
      method: req.method,
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
      fileKeys: req.files ? Object.keys(req.files) : 'No files',
      userId: userId
    });

    const { 
      firstName, 
      lastName, 
      userName, 
      email, 
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

    // Enhanced validation
    const validation = validateRequiredFields({
      firstName, lastName, userName, email, 
      userType: 'jobseeker', // We'll get actual type from DB
      companyName: null // Will validate later if needed
    });

    if (!validation.isValid) {
      cleanupUploadedFiles(req);
      return res.status(400).json({
        success: false,
        msg: validation.message
      });
    }

    // Start transaction for atomic operations
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
      // Check if username/email conflicts with other users
      const conflictQuery = `
        SELECT id, email, userName FROM users 
        WHERE (email = ? OR userName = ?) AND id != ?
      `;
      
      const existingUsers = await new Promise((resolve, reject) => {
        db.query(conflictQuery, [email.toLowerCase().trim(), userName.trim(), userId], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      if (existingUsers.length > 0) {
        await rollbackTransaction();
        cleanupUploadedFiles(req);
        const user = existingUsers[0];
        const conflictField = user.email === email.toLowerCase().trim() ? 'email' : 'username';
        return res.status(409).json({ 
          success: false, 
          msg: `Another user with this ${conflictField} already exists`,
          conflictField: conflictField
        });
      }

      // Update users table
      const updateUserQuery = `
        UPDATE users 
        SET firstName = ?, lastName = ?, userName = ?, email = ?, phone = ?, location = ? 
        WHERE id = ?
      `;
      
      const userValues = [
        firstName.trim(),
        lastName.trim(),
        userName.trim(),
        email.toLowerCase().trim(),
        phone ? phone.trim() : null,
        location ? location.trim() : null,
        userId
      ];
      
      await new Promise((resolve, reject) => {
        db.query(updateUserQuery, userValues, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      console.log('User table updated successfully');

      // Get user type to update appropriate profile
      const getUserTypeQuery = 'SELECT userType FROM users WHERE id = ?';
      
      const userTypeResult = await new Promise((resolve, reject) => {
        db.query(getUserTypeQuery, [userId], (err, users) => {
          if (err) return reject(err);
          resolve(users);
        });
      });

      if (userTypeResult.length === 0) {
        await rollbackTransaction();
        cleanupUploadedFiles(req);
        return res.status(404).json({ 
          success: false, 
          msg: 'User not found' 
        });
      }

      const userType = userTypeResult[0].userType;
      console.log('User type:', userType);

      // Update profile based on user type
      if (userType === 'jobseeker') {
        await updateJobSeekerProfileWithFiles(req, userId, {
          title, experience, skills, expectedSalary, 
          linkedinUrl, githubUrl, bio, availability
        });
      } else if (userType === 'recruiter') {
        await updateRecruiterProfileWithFiles(req, userId, {
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

      console.log(`[${startTime}] Profile update completed successfully`);

      const responseTime = Date.now() - startTime;
      res.json({ 
        success: true, 
        msg: 'Profile updated successfully',
        timestamp: new Date().toISOString(),
        processingTime: `${responseTime}ms`
      });

    } catch (dbError) {
      await rollbackTransaction();
      throw dbError;
    }

  } catch (error) {
    console.error(`[${startTime}] Profile update error:`, error);
    cleanupUploadedFiles(req);
    
    let statusCode = 500;
    let errorMessage = 'Server error during profile update. Please try again.';
    
    if (error.code === 'ER_DUP_ENTRY') {
      statusCode = 409;
      errorMessage = 'Username or email already exists';
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

// Enhanced job seeker profile update with file handling
const updateJobSeekerProfileWithFiles = async (req, userId, profileData) => {
  const { title, experience, skills, expectedSalary, linkedinUrl, githubUrl, bio, availability } = profileData;

  // Handle file uploads
  let newCvFilePath = null;
  let newCertificatesPath = [];

  if (req.files) {
    if (req.files.cvFile && req.files.cvFile[0]) {
      newCvFilePath = req.files.cvFile[0].path;
      console.log('New CV file uploaded:', newCvFilePath);
    }
    if (req.files.certificateFiles && req.files.certificateFiles.length > 0) {
      newCertificatesPath = req.files.certificateFiles.map(file => file.path);
      console.log('New certificate files uploaded:', newCertificatesPath.length);
    }
  }

  // Process skills
  const parsedSkills = processSkills(skills);

  // Validate URLs
  const validLinkedinUrl = validateUrl(linkedinUrl);
  const validGithubUrl = validateUrl(githubUrl);

  // Build update query dynamically based on whether new files were uploaded
  let updateQuery = `
    UPDATE job_seekers 
    SET title = ?, experience = ?, skills = ?, expectedSalary = ?, 
        linkedinUrl = ?, githubUrl = ?, bio = ?, availability = ?
  `;
  
  let values = [
    title ? title.trim() : null, 
    experience ? experience.trim() : null, 
    JSON.stringify(parsedSkills), 
    expectedSalary ? expectedSalary.trim() : null, 
    validLinkedinUrl, 
    validGithubUrl, 
    bio ? bio.trim() : null, 
    availability || 'available'
  ];

  // Add file fields if new files were uploaded
  if (newCvFilePath) {
    updateQuery += `, cvFilePath = ?`;
    values.push(newCvFilePath);
  }

  if (newCertificatesPath.length > 0) {
    updateQuery += `, certificatesPath = ?`;
    values.push(JSON.stringify(newCertificatesPath));
  }

  updateQuery += ` WHERE userId = ?`;
  values.push(userId);

  return new Promise((resolve, reject) => {
    db.query(updateQuery, values, (err, result) => {
      if (err) {
        console.error('Job seeker profile update error:', err);
        return reject(err);
      }
      console.log('Job seeker profile updated successfully');
      resolve(result);
    });
  });
};

// Enhanced recruiter profile update
const updateRecruiterProfileWithFiles = async (req, userId, profileData) => {
  const { companyName, companySize, industry, companyWebsite, companyDescription, position } = profileData;

  // Validate required fields for recruiters
  if (!companyName || companyName.trim().length < 2) {
    throw new Error('Company name is required for recruiters');
  }

  // Validate company website URL
  const validWebsite = validateUrl(companyWebsite);

  const updateRecruiterQuery = `
    UPDATE recruiters 
    SET companyName = ?, companySize = ?, industry = ?, 
        companyWebsite = ?, companyDescription = ?, position = ? 
    WHERE userId = ?
  `;
  
  const values = [
    companyName.trim(),
    companySize ? companySize.trim() : null,
    industry ? industry.trim() : null,
    validWebsite,
    companyDescription ? companyDescription.trim() : null,
    position ? position.trim() : null,
    userId
  ];
  
  return new Promise((resolve, reject) => {
    db.query(updateRecruiterQuery, values, (err, result) => {
      if (err) {
        console.error('Recruiter profile update error:', err);
        return reject(err);
      }
      console.log('Recruiter profile updated successfully');
      resolve(result);
    });
  });
};

// Update job seeker profile (basic version without files)
const updateJobSeekerProfile = (req, res, userId, profileData) => {
  const { title, experience, skills, expectedSalary, linkedinUrl, githubUrl, bio, availability } = profileData;

  // Process skills using the helper function
  const parsedSkills = processSkills(skills);

  // Validate URLs
  const validLinkedinUrl = validateUrl(linkedinUrl);
  const validGithubUrl = validateUrl(githubUrl);

  const updateProfileQuery = `
    UPDATE job_seekers 
    SET title = ?, experience = ?, skills = ?, expectedSalary = ?, 
        linkedinUrl = ?, githubUrl = ?, bio = ?, availability = ?
    WHERE userId = ?
  `;
  
  const values = [
    title ? title.trim() : null, 
    experience ? experience.trim() : null, 
    JSON.stringify(parsedSkills), 
    expectedSalary ? expectedSalary.trim() : null, 
    validLinkedinUrl, 
    validGithubUrl, 
    bio ? bio.trim() : null, 
    availability || 'available', 
    userId
  ];
  
  db.query(updateProfileQuery, values, (err) => {
    if (err) {
      console.error('Job seeker profile update error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Server error during profile update' 
      });
    }

    res.json({ 
      success: true, 
      msg: 'Profile updated successfully' 
    });
  });
};

// Update recruiter profile (basic version)
const updateRecruiterProfile = (req, res, userId, profileData) => {
  const { companyName, companySize, industry, companyWebsite, companyDescription, position } = profileData;

  // Validate company website URL
  const validWebsite = validateUrl(companyWebsite);

  const updateRecruiterQuery = `
    UPDATE recruiters 
    SET companyName = ?, companySize = ?, industry = ?, 
        companyWebsite = ?, companyDescription = ?, position = ? 
    WHERE userId = ?
  `;
  
  const values = [
    companyName ? companyName.trim() : null,
    companySize ? companySize.trim() : null,
    industry ? industry.trim() : null,
    validWebsite,
    companyDescription ? companyDescription.trim() : null,
    position ? position.trim() : null,
    userId
  ];
  
  db.query(updateRecruiterQuery, values, (err) => {
    if (err) {
      console.error('Recruiter profile update error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Server error during profile update' 
      });
    }

    res.json({ 
      success: true, 
      msg: 'Profile updated successfully' 
    });
  });
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateJobSeekerProfile,
  updateRecruiterProfile
};
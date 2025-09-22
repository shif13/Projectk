const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const path = require('path');
const fs = require('fs');

// Import the email service
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

    // Recruiters profile table
    const createRecruitersTable = `
      CREATE TABLE IF NOT EXISTS recruiters (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        companyName VARCHAR(100) NOT NULL,
        companySize VARCHAR(50),
        industry VARCHAR(50),
        companyWebsite VARCHAR(255),
        companyDescription TEXT,
        position VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Job applications table (for future use)
    const createApplicationsTable = `
      CREATE TABLE IF NOT EXISTS applications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        jobSeekerId INT NOT NULL,
        recruiterId INT NOT NULL,
        status ENUM('pending', 'contacted', 'rejected', 'hired') DEFAULT 'pending',
        message TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (jobSeekerId) REFERENCES job_seekers(id) ON DELETE CASCADE,
        FOREIGN KEY (recruiterId) REFERENCES recruiters(id) ON DELETE CASCADE
      )
    `;

    // Execute table creation queries in sequence
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
        
        db.query(createRecruitersTable, (err) => {
          if (err) {
            console.error('❌ Error creating recruiters table:', err.message);
            return reject(err);
          }
          
          db.query(createApplicationsTable, (err) => {
            if (err) {
              console.error('❌ Error creating applications table:', err.message);
              return reject(err);
            }
            
            console.log('✅ Database tables created successfully');
            resolve(true);
          });
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
    } catch (error) {
      console.error('Failed to initialize tables:', error);
    }
  }
};

// Call initialization
initializeTables();

const registerUser = async (req, res) => {
  try {
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

    // Validate required fields
    if (!userName || !email || !password || !userType || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Please provide all required fields' 
      });
    }

    // Validate user type
    if (!['jobseeker', 'recruiter'].includes(userType)) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Invalid user type' 
      });
    }

    // Additional validation for recruiters
    if (userType === 'recruiter' && !companyName) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Company name is required for recruiters' 
      });
    }

    // Check if user already exists
    const checkUserQuery = 'SELECT id FROM users WHERE email = ? OR userName = ?';
    db.query(checkUserQuery, [email, userName], async (err, existingUsers) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          success: false, 
          msg: 'Server error during registration' 
        });
      }

      if (existingUsers.length > 0) {
        return res.status(400).json({ 
          success: false, 
          msg: 'User with this email or username already exists' 
        });
      }

      try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user into users table
        const insertUserQuery = `
          INSERT INTO users (userName, email, password, userType, firstName, lastName, phone, location) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.query(insertUserQuery, 
          [userName, email, hashedPassword, userType, firstName, lastName, phone || null, location || null], 
          async (err, userResult) => {
            if (err) {
              console.error('User insertion error:', err);
              return res.status(500).json({ 
                success: false, 
                msg: 'Server error during registration' 
              });
            }

            const userId = userResult.insertId;
            
            // Prepare user data for email
            const userData = {
              firstName,
              lastName,
              userName,
              email
            };

            if (userType === 'jobseeker') {
              // Handle file uploads
              let cvFilePath = null;
              let certificatesPath = [];

              if (req.files) {
                // Handle CV file
                if (req.files.cvFile && req.files.cvFile[0]) {
                  cvFilePath = req.files.cvFile[0].path;
                }

                // Handle certificate files
                if (req.files.certificateFiles) {
                  certificatesPath = req.files.certificateFiles.map(file => file.path);
                }
              }

              // Parse skills JSON if it's a string
              let parsedSkills = [];
              if (skills) {
                try {
                  parsedSkills = typeof skills === 'string' ? JSON.parse(skills) : skills;
                } catch (error) {
                  console.warn('Invalid skills JSON, using empty array');
                }
              }

              // Insert job seeker profile
              const insertJobSeekerQuery = `
                INSERT INTO job_seekers (userId, title, experience, skills, expectedSalary, linkedinUrl, githubUrl, bio, availability, cvFilePath, certificatesPath) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              
              db.query(insertJobSeekerQuery, [
                userId,
                title || null,
                experience || null,
                JSON.stringify(parsedSkills),
                expectedSalary || null,
                linkedinUrl || null,
                githubUrl || null,
                bio || null,
                availability || 'available',
                cvFilePath,
                JSON.stringify(certificatesPath)
              ], async (err) => {
                if (err) {
                  console.error('Job seeker profile insertion error:', err);
                  return res.status(500).json({ 
                    success: false, 
                    msg: 'Server error during registration' 
                  });
                }

                // Generate JWT token
                const token = jwt.sign(
                  { 
                    userId: userId, 
                    email: email, 
                    userType: userType 
                  },
                  process.env.JWT_SECRET || 'your-secret-key',
                  { expiresIn: '24h' }
                );

                // Send welcome email for job seeker
                try {
                  const emailResult = await sendWelcomeEmail(userData, 'jobseeker');
                  if (emailResult.success) {
                    console.log('✅ Welcome email sent to job seeker:', email);
                  } else {
                    console.warn('⚠️ Failed to send welcome email:', emailResult.error);
                  }
                } catch (emailError) {
                  console.warn('⚠️ Email sending error:', emailError.message);
                  // Don't fail registration if email fails
                }

                res.status(201).json({
                  success: true,
                  msg: 'Registration successful! Welcome email has been sent to your inbox.',
                  token,
                  user: {
                    id: userId,
                    userName,
                    email,
                    userType,
                    firstName,
                    lastName
                  }
                });
              });

            } else if (userType === 'recruiter') {
              // Insert recruiter profile
              const insertRecruiterQuery = `
                INSERT INTO recruiters (userId, companyName, companySize, industry, companyWebsite, companyDescription, position) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `;
              
              db.query(insertRecruiterQuery, [
                userId,
                companyName,
                companySize || null,
                industry || null,
                companyWebsite || null,
                companyDescription || null,
                position || null
              ], async (err) => {
                if (err) {
                  console.error('Recruiter profile insertion error:', err);
                  return res.status(500).json({ 
                    success: false, 
                    msg: 'Server error during registration' 
                  });
                }

                // Generate JWT token
                const token = jwt.sign(
                  { 
                    userId: userId, 
                    email: email, 
                    userType: userType 
                  },
                  process.env.JWT_SECRET || 'your-secret-key',
                  { expiresIn: '24h' }
                );

                // Send welcome email for recruiter
                try {
                  const emailResult = await sendWelcomeEmail(userData, 'recruiter', companyName);
                  if (emailResult.success) {
                    console.log('✅ Welcome email sent to recruiter:', email);
                  } else {
                    console.warn('⚠️ Failed to send welcome email:', emailResult.error);
                  }
                } catch (emailError) {
                  console.warn('⚠️ Email sending error:', emailError.message);
                  // Don't fail registration if email fails
                }

                res.status(201).json({
                  success: true,
                  msg: 'Registration successful! Welcome email has been sent to your inbox.',
                  token,
                  user: {
                    id: userId,
                    userName,
                    email,
                    userType,
                    firstName,
                    lastName
                  }
                });
              });
            }
          });
      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
          success: false, 
          msg: 'Server error during registration' 
        });
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      msg: 'Server error during registration' 
    });
  }
};

// Get user profile
const getUserProfile = (req, res) => {
  const userId = req.user.userId; // From JWT middleware

  const query = 'SELECT id, userName, email, userType, firstName, lastName, phone, location FROM users WHERE id = ?';
  
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
          profile = {
            ...jobSeekers[0],
            skills: JSON.parse(jobSeekers[0].skills || '[]'),
            certificatesPath: JSON.parse(jobSeekers[0].certificatesPath || '[]')
          };
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
    }
  });
};

// Search job seekers (for recruiters)
const searchJobSeekers = (req, res) => {
  const {
    jobTitle,
    location,
    experience,
    availability,
    salaryRange
  } = req.body;

  let query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      u.phone,
      u.location,
      u.createdAt,
      js.title,
      js.experience,
      js.skills,
      js.expectedSalary,
      js.linkedinUrl,
      js.githubUrl,
      js.bio,
      js.availability,
      js.cvFilePath,
      js.certificatesPath
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker'
  `;

  const params = [];

  // Add filters
  if (jobTitle && jobTitle.trim()) {
    query += ` AND js.title LIKE ?`;
    params.push(`%${jobTitle.trim()}%`);
  }

  if (location && location.trim()) {
    query += ` AND u.location LIKE ?`;
    params.push(`%${location.trim()}%`);
  }

  if (experience && experience.trim()) {
    query += ` AND js.experience = ?`;
    params.push(experience.trim());
  }

  if (availability && availability.trim()) {
    query += ` AND js.availability = ?`;
    params.push(availability.trim());
  }

  if (salaryRange && salaryRange.trim()) {
    query += ` AND js.expectedSalary IS NOT NULL`;
  }

  query += ` ORDER BY u.createdAt DESC LIMIT 50`;

  db.query(query, params, (err, candidates) => {
    if (err) {
      console.error('Search error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Error searching job seekers' 
      });
    }

    // Parse JSON fields
    const parsedCandidates = candidates.map(candidate => ({
      ...candidate,
      skills: candidate.skills ? JSON.parse(candidate.skills) : [],
      certificatesPath: candidate.certificatesPath ? JSON.parse(candidate.certificatesPath) : []
    }));

    res.json({
      success: true,
      candidates: parsedCandidates,
      total: parsedCandidates.length
    });
  });
};

// AI-powered skill matching (simplified version)
const matchSkills = (req, res) => {
  const { skills } = req.body;

  if (!skills || !skills.trim()) {
    return res.status(400).json({ 
      success: false, 
      msg: 'Skills are required for matching' 
    });
  }

  // Parse input skills
  const inputSkills = skills.toLowerCase().split(',').map(skill => skill.trim());

  const query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      u.phone,
      u.location,
      u.createdAt,
      js.title,
      js.experience,
      js.skills,
      js.expectedSalary,
      js.linkedinUrl,
      js.githubUrl,
      js.bio,
      js.availability,
      js.cvFilePath,
      js.certificatesPath
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker' AND js.skills IS NOT NULL
    ORDER BY u.createdAt DESC
  `;

  db.query(query, [], (err, allCandidates) => {
    if (err) {
      console.error('Skill matching error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Error matching skills' 
      });
    }

    // Simple skill matching algorithm
    const matchedCandidates = allCandidates.map(candidate => {
      const candidateSkills = JSON.parse(candidate.skills || '[]');
      const candidateSkillsLower = candidateSkills.map(skill => skill.toLowerCase());
      
      // Calculate match score
      const matchingSkills = inputSkills.filter(skill => 
        candidateSkillsLower.some(candidateSkill => 
          candidateSkill.includes(skill) || skill.includes(candidateSkill)
        )
      );
      
      const matchScore = matchingSkills.length > 0 
        ? Math.round((matchingSkills.length / inputSkills.length) * 100)
        : 0;

      return {
        ...candidate,
        skills: candidateSkills,
        certificatesPath: candidate.certificatesPath ? JSON.parse(candidate.certificatesPath) : [],
        matchScore,
        matchingSkills
      };
    }).filter(candidate => candidate.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20); // Limit to top 20 matches

    res.json({
      success: true,
      matches: matchedCandidates,
      total: matchedCandidates.length,
      searchedSkills: inputSkills
    });
  });
};

module.exports = {
  registerUser,
  getUserProfile,
  searchJobSeekers,
  matchSkills,
  createTables
};
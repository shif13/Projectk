const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration
const baseUploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024; // 5MB

// Directory setup
const uploadDir = baseUploadDir;
const cvDir = path.join(uploadDir, 'cvs');
const certificateDir = path.join(uploadDir, 'certificates');

// Create directories
const createDirectories = () => {
  try {
    [uploadDir, cvDir, certificateDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
    return true;
  } catch (error) {
    console.error('Error creating upload directories:', error);
    return false;
  }
};

// Initialize directories
createDirectories();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let targetDir;
    if (file.fieldname === 'cvFile') {
      targetDir = cvDir;
    } else if (file.fieldname === 'certificateFiles') {
      targetDir = certificateDir;
    } else {
      return cb(new Error(`Invalid file field: ${file.fieldname}`));
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomNum = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${baseName}-${timestamp}-${randomNum}${ext}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log(`Validating file: ${file.originalname}, field: ${file.fieldname}, mimetype: ${file.mimetype}`);

  if (file.fieldname === 'cvFile') {
    const allowedMimes = ['application/pdf'];
    const allowedExts = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('CV must be a PDF file'), false);
    }
  } else if (file.fieldname === 'certificateFiles') {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Certificates must be PDF, JPG, or PNG files'), false);
    }
  } else {
    cb(new Error(`Unexpected file field: ${file.fieldname}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 6,
    fieldSize: 1 * 1024 * 1024,
    fieldNameSize: 100
  }
});

// Upload fields middleware
const uploadFields = (req, res, next) => {
  console.log('Processing file upload...');
  
  const uploadMiddleware = upload.fields([
    { name: 'cvFile', maxCount: 1 },
    { name: 'certificateFiles', maxCount: 5 }
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({ 
              success: false, 
              msg: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB per file`
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({ 
              success: false, 
              msg: 'Too many files. Maximum 5 certificate files allowed'
            });
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({ 
              success: false, 
              msg: 'Unexpected file field. Only cvFile and certificateFiles are allowed'
            });
          default:
            return res.status(400).json({ 
              success: false, 
              msg: `Upload error: ${err.message}`
            });
        }
      }
      
      if (err.message.includes('CV must be') || err.message.includes('Certificates must be')) {
        return res.status(400).json({ 
          success: false, 
          msg: err.message
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        msg: 'File upload failed'
      });
    }

    // Log successful uploads
    if (req.files) {
      if (req.files.cvFile) {
        console.log('CV uploaded:', req.files.cvFile[0].filename);
      }
      if (req.files.certificateFiles) {
        console.log('Certificates uploaded:', req.files.certificateFiles.length, 'files');
      }
    }

    next();
  });
};

// Validation middleware
const validateRegistration = (req, res, next) => {
  console.log('Validating registration data...');
  console.log('Body keys:', Object.keys(req.body || {}));
  
  const { userName, email, password, userType, firstName, lastName, companyName } = req.body;
  const errors = [];

  // Required field validation
  if (!firstName || firstName.trim().length < 1) {
    errors.push('First name is required');
  }
  if (!lastName || lastName.trim().length < 1) {
    errors.push('Last name is required');
  }
  if (!userName || userName.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  if (!email || !isValidEmail(email)) {
    errors.push('Valid email address is required');
  }
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  if (!userType || !['jobseeker', 'recruiter'].includes(userType)) {
    errors.push('Valid user type is required (jobseeker or recruiter)');
  }

  // Recruiter specific validation
  if (userType === 'recruiter' && (!companyName || companyName.trim().length < 2)) {
    errors.push('Company name is required for recruiters');
  }

  // Username format validation
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (userName && !usernameRegex.test(userName.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (errors.length > 0) {
    cleanupUploadedFiles(req);
    return res.status(400).json({ 
      success: false, 
      msg: 'Validation failed', 
      errors 
    });
  }

  console.log('Validation passed for:', userType, 'user');
  next();
};

// Helper functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const cleanupUploadedFiles = (req) => {
  if (!req.files) return;
  
  try {
    const filesToDelete = [];
    if (req.files.cvFile) {
      filesToDelete.push(...req.files.cvFile.map(f => f.path));
    }
    if (req.files.certificateFiles) {
      filesToDelete.push(...req.files.certificateFiles.map(f => f.path));
    }

    filesToDelete.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up file:', filePath);
      }
    });
  } catch (error) {
    console.error('Error cleaning up files:', error.message);
  }
};

const getFileUrl = (filePath, baseUrl = `http://localhost:${process.env.PORT || 5550}`) => {
  if (!filePath) return null;
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  return `${baseUrl}/${relativePath.replace(/\\/g, '/')}`;
};

module.exports = {
  uploadFields,
  validateRegistration,
  cleanupUploadedFiles,
  getFileUrl
};
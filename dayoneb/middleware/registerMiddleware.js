const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Read from environment variables with fallbacks
const baseUploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;

// Create uploads directory structure
const uploadDir = baseUploadDir;
const cvDir = path.join(uploadDir, 'cvs');
const certificateDir = path.join(uploadDir, 'certificates');

// Ensure directories exist
const createDirectories = () => {
  try {
    [uploadDir, cvDir, certificateDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
    return true;
  } catch (error) {
    console.error('❌ Error creating upload directories:', error);
    return false;
  }
};

// Initialize directories
const directoriesCreated = createDirectories();
if (!directoriesCreated) {
  console.warn('⚠️ Failed to create upload directories');
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      let targetDir;
      if (file.fieldname === 'cvFile') {
        targetDir = cvDir;
      } else if (file.fieldname === 'certificateFiles') {
        targetDir = certificateDir;
      } else {
        return cb(new Error(`Invalid file field: ${file.fieldname}`), null);
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      cb(null, targetDir);
    } catch (error) {
      console.error('❌ Error setting file destination:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      const timestamp = Date.now();
      const randomNum = Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');

      const filename = `${baseName}-${timestamp}-${randomNum}${ext}`;

      console.log(`📄 Saving file: ${filename}`);
      cb(null, filename);
    } catch (error) {
      console.error('❌ Error generating filename:', error);
      cb(error, null);
    }
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  try {
    console.log(`🔍 Validating file: ${file.originalname}, field: ${file.fieldname}, mimetype: ${file.mimetype}`);

    if (file.fieldname === 'cvFile') {
      const allowedMimes = ['application/pdf'];
      const allowedExts = ['.pdf'];
      const ext = path.extname(file.originalname).toLowerCase();

      if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('CV must be a PDF file only'), false);
      }
    } else if (file.fieldname === 'certificateFiles') {
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
      const ext = path.extname(file.originalname).toLowerCase();

      if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Certificates must be PDF, JPG, or PNG files only'), false);
      }
    } else {
      cb(new Error(`Unexpected file field: ${file.fieldname}`), false);
    }
  } catch (error) {
    console.error('❌ File filter error:', error);
    cb(error, false);
  }
};

// Configure multer with env-driven settings
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // from .env
    files: 6,
    fieldSize: 1 * 1024 * 1024,
    fieldNameSize: 100,
    headerPairs: 2000
  }
});

// Upload fields middleware
const uploadFields = (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: 'cvFile', maxCount: 1 },
    { name: 'certificateFiles', maxCount: 5 }
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('❌ Upload error:', err);
      return handleFileUploadError(err, req, res, next);
    }

    if (req.files) {
      if (req.files.cvFile) {
        console.log('✅ CV uploaded:', req.files.cvFile[0].path);
      }
      if (req.files.certificateFiles) {
        console.log('✅ Certificates uploaded:', req.files.certificateFiles.map(f => f.path));
      }
    }

    next();
  });
};

// Validation middleware
const validateRegistration = (req, res, next) => {
  const { userName, email, password, userType, firstName, lastName } = req.body;
  const errors = [];

  if (!firstName || firstName.trim().length < 1) errors.push('First name is required');
  if (!lastName || lastName.trim().length < 1) errors.push('Last name is required');
  if (!userName || userName.trim().length < 3) errors.push('Username must be at least 3 characters long');
  if (!email || !isValidEmail(email)) errors.push('Valid email address is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters long');
  if (!userType || !['jobseeker', 'recruiter'].includes(userType)) errors.push('Valid user type is required (jobseeker or recruiter)');

  if (userType === 'recruiter' && (!req.body.companyName || req.body.companyName.trim().length < 2)) {
    errors.push('Company name is required for recruiters');
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (userName && !usernameRegex.test(userName.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (errors.length > 0) {
    cleanupUploadedFiles(req);
    return res.status(400).json({ success: false, msg: 'Registration validation failed', errors });
  }

  next();
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const handleFileUploadError = (error, req, res, next) => {
  console.error('📤 File upload error details:', error);
  cleanupUploadedFiles(req);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ success: false, msg: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB per file`, error: 'FILE_TOO_LARGE' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ success: false, msg: 'Too many files. Maximum 5 certificate files allowed', error: 'TOO_MANY_FILES' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ success: false, msg: 'Unexpected file field. Only cvFile and certificateFiles are allowed', error: 'UNEXPECTED_FILE' });
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({ success: false, msg: 'Field name too long', error: 'FIELD_NAME_TOO_LONG' });
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({ success: false, msg: 'Field value too long', error: 'FIELD_VALUE_TOO_LONG' });
      default:
        return res.status(400).json({ success: false, msg: `Upload error: ${error.message}`, error: 'UPLOAD_ERROR' });
    }
  }

  if (error.message && (error.message.includes('CV must be a PDF') || error.message.includes('Certificates must be PDF') || error.message.includes('Unexpected file field'))) {
    return res.status(400).json({ success: false, msg: error.message, error: 'INVALID_FILE_TYPE' });
  }

  return res.status(500).json({ success: false, msg: 'File upload failed due to server error', error: 'SERVER_ERROR' });
};

const cleanupUploadedFiles = (req) => {
  if (!req.files) return;
  try {
    const filesToDelete = [];
    if (req.files.cvFile) filesToDelete.push(...req.files.cvFile.map(f => f.path));
    if (req.files.certificateFiles) filesToDelete.push(...req.files.certificateFiles.map(f => f.path));

    filesToDelete.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Cleaned up file:', filePath);
      }
    });
  } catch (error) {
    console.error('⚠️ Error cleaning up files:', error.message);
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
  handleFileUploadError,
  cleanupUploadedFiles,
  getFileUrl
};

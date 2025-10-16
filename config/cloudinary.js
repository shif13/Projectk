// config/cloudinary.js - FIXED FOR PUBLIC ACCESS
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured for:', process.env.CLOUDINARY_CLOUD_NAME);

// ==========================================
// CV STORAGE (PDF) - PUBLIC ACCESS
// ==========================================
const cvStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profetch/cvs',
    resource_type: 'raw', // For PDFs
    access_mode: 'public', // IMPORTANT: Makes files publicly accessible
    type: 'upload', // Ensures it's stored as public upload
    allowed_formats: ['pdf']
  }
});

const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for CV'), false);
    }
  }
});

// ==========================================
// CERTIFICATES STORAGE (PDF/Images) - PUBLIC ACCESS
// ==========================================
const certificateStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';
    
    return {
      folder: 'profetch/certificates',
      resource_type: isPdf ? 'raw' : 'image', // Use 'raw' for PDFs, 'image' for images
      access_mode: 'public', // IMPORTANT: Makes files publicly accessible
      type: 'upload', // Ensures public storage
      allowed_formats: isPdf ? ['pdf'] : ['jpg', 'jpeg', 'png']
    };
  }
});

const uploadCertificates = multer({
  storage: certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
    }
  }
});

// ==========================================
// EQUIPMENT IMAGES STORAGE - PUBLIC ACCESS
// ==========================================
const equipmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profetch/equipment',
    resource_type: 'image',
    access_mode: 'public', // IMPORTANT: Makes files publicly accessible
    type: 'upload',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { 
        width: 1500, 
        height: 1500, 
        crop: 'limit', 
        quality: 'auto',
        fetch_format: 'auto' // Automatically optimizes format
      }
    ]
  }
});

const uploadEquipmentImages = multer({ 
  storage: equipmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

module.exports = {
  cloudinary,
  uploadCV,
  uploadCertificates,
  uploadEquipmentImages
};
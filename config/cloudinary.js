// config/cloudinary.js
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
// EQUIPMENT IMAGES STORAGE
// ==========================================

const equipmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profetch/equipment',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1500, height: 1500, crop: 'limit', quality: 'auto' }]
  }
});

const uploadEquipmentImages = multer({ 
  storage: equipmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// ==========================================
// FREELANCER CV STORAGE (PDF)
// ==========================================

const cvStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profetch/cvs',
    allowed_formats: ['pdf'],
    resource_type: 'raw' // Important for PDFs
  }
});

const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for CV'), false);
    }
  }
});

// ==========================================
// FREELANCER CERTIFICATES STORAGE
// ==========================================

const certificateStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine resource type based on file mimetype
    const isPdf = file.mimetype === 'application/pdf';
    
    return {
      folder: 'profetch/certificates',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: isPdf ? 'raw' : 'image',
      transformation: !isPdf ? [{ width: 1500, height: 1500, crop: 'limit', quality: 'auto' }] : undefined
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
      cb(new Error('Only PDF, JPG, and PNG files are allowed for certificates'), false);
    }
  }
});

// ==========================================
// COMBINED FREELANCER UPLOAD
// ==========================================

const uploadFreelancerFiles = multer({
  storage: multer.memoryStorage() // We'll handle this manually
}).fields([
  { name: 'cvFile', maxCount: 1 },
  { name: 'certificateFiles', maxCount: 5 }
]);

// Manual upload handler for freelancer files
const uploadFreelancerToCloudinary = async (files) => {
  const results = {
    cvFilePath: null,
    certificatesPath: []
  };

  try {
    // Upload CV if provided
    if (files.cvFile && files.cvFile[0]) {
      const cvFile = files.cvFile[0];
      const cvResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'profetch/cvs',
            resource_type: 'raw',
            format: 'pdf'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(cvFile.buffer);
      });
      results.cvFilePath = cvResult.secure_url;
      console.log('✅ CV uploaded to Cloudinary');
    }

    // Upload certificates if provided
    if (files.certificateFiles && files.certificateFiles.length > 0) {
      const certificatePromises = files.certificateFiles.map(file => {
        return new Promise((resolve, reject) => {
          const isPdf = file.mimetype === 'application/pdf';
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'profetch/certificates',
              resource_type: isPdf ? 'raw' : 'image',
              transformation: !isPdf ? [{ width: 1500, height: 1500, crop: 'limit', quality: 'auto' }] : undefined
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });
      });

      const certificateResults = await Promise.all(certificatePromises);
      results.certificatesPath = certificateResults.map(r => r.secure_url);
      console.log(`✅ ${results.certificatesPath.length} certificate(s) uploaded to Cloudinary`);
    }

    return results;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadEquipmentImages,
  uploadCV,
  uploadCertificates,
  uploadFreelancerFiles,
  uploadFreelancerToCloudinary
};
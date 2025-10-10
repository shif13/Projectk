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

// Cloudinary storage for equipment images
const equipmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profetch/equipment',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1500, height: 1500, crop: 'limit', quality: 'auto' }]
  }
});

// Multer upload instance
const uploadEquipmentImages = multer({ 
  storage: equipmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = {
  cloudinary,
  uploadEquipmentImages
};
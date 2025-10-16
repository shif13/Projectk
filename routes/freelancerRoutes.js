// routes/freelancerRoutes.js
const express = require('express');
const router = express.Router();
const freelancerController = require('../controllers/freelancerController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET freelancer profile
router.get('/profile', freelancerController.getFreelancerProfile);

// UPDATE freelancer profile (with file uploads via Multer + Cloudinary)
router.put(
  '/profile', 
  freelancerController.handleFileUploads, // Multer middleware for file handling
  freelancerController.updateFreelancerProfile
);

// DELETE certificate from profile
router.delete('/certificate', freelancerController.deleteCertificate);

module.exports = router;
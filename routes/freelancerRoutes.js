// routes/freelancerRoutes.js
const express = require('express');
const router = express.Router();
const freelancerController = require('../controllers/freelancerController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET freelancer profile
router.get('/profile', freelancerController.getFreelancerProfile);

// UPDATE freelancer profile (Cloudinary URLs in body, no file upload)
router.put('/profile', freelancerController.updateFreelancerProfile);

module.exports = router;
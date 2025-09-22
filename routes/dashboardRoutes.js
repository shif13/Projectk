const express = require('express');
const router = express.Router();
const { 
  getUserProfile, 
  updateUserProfile 
} = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadFields } = require('../middleware/registerMiddleware');

//GET /api/dashboard/profile - Get user profile
router.get('/profile', authMiddleware, getUserProfile);

// PUT /api/dashboard/profile - Update user profile
router.put('/profile', authMiddleware, uploadFields, updateUserProfile);

module.exports = router;
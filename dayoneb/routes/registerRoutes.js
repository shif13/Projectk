const express = require('express');
const router = express.Router();

// Import controller functions from registerController
const { 
  registerUser,
  getUserProfile,
  searchJobSeekers, 
  matchSkills
} = require('../controllers/registerController');

// Import middleware functions
const { 
  uploadFields, 
  validateRegistration, 
  handleFileUploadError 
} = require('../middleware/registerMiddleware');

// Import auth middleware
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', uploadFields, handleFileUploadError, validateRegistration, registerUser);

// Protected routes (require authentication)
router.get('/profile', authMiddleware, getUserProfile);
router.post('/search-jobseekers', searchJobSeekers);
router.post('/match-skills', matchSkills);

module.exports = router;
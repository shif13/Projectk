
const express = require('express');
const router = express.Router();
const { 
  getAllReviews, 
  createReview, 
  updateReview, 
  deleteReview, 
  getUserReview,
  getReviewStats 
} = require('../controllers/reviewController');

const authenticateToken = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllReviews);
router.get('/stats', getReviewStats);

// Protected routes
router.get('/my-review', authenticateToken, getUserReview);
router.post('/', authenticateToken, createReview);
router.put('/:id', authenticateToken, updateReview);
router.delete('/:id', authenticateToken, deleteReview);

module.exports = router;

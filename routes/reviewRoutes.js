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

const { authMiddleware } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllReviews);
router.get('/stats', getReviewStats);

// Protected routes
router.get('/my-review', authMiddleware, getUserReview);
router.post('/', authMiddleware, createReview);
router.put('/:id', authMiddleware, updateReview);
router.delete('/:id', authMiddleware, deleteReview);

module.exports = router;
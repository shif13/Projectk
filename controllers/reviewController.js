// reviewController.js
const { db } = require('../config/db');

// Create reviews table if it doesn't exist
const createReviewsTable = () => {
  return new Promise((resolve, reject) => {
    const createReviewsTableQuery = `
      CREATE TABLE IF NOT EXISTS reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(100) NOT NULL,
        comment TEXT NOT NULL,
        category ENUM('general', 'job-search', 'recruitment', 'platform', 'support') DEFAULT 'general',
        isApproved BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_rating (rating),
        INDEX idx_category (category),
        INDEX idx_created_at (createdAt)
      )
    `;

    db.query(createReviewsTableQuery, (err) => {
      if (err) {
        console.error('Error creating reviews table:', err.message);
        return reject(err);
      }
      console.log('Reviews table initialized successfully');
      resolve();
    });
  });
};

// Initialize table
let reviewsTableInitialized = false;
const initializeReviewsTable = async () => {
  if (!reviewsTableInitialized) {
    try {
      await createReviewsTable();
      reviewsTableInitialized = true;
    } catch (error) {
      console.error('Failed to initialize reviews table:', error);
    }
  }
};

// Call initialization
initializeReviewsTable();

// Validation helpers
const validateReview = ({ rating, title, comment, category }) => {
  const errors = [];

  if (!rating || rating < 1 || rating > 5) {
    errors.push('Rating must be between 1 and 5');
  }

  if (!title || title.trim().length < 5 || title.trim().length > 100) {
    errors.push('Title must be between 5 and 100 characters');
  }

  if (!comment || comment.trim().length < 20 || comment.trim().length > 1000) {
    errors.push('Comment must be between 20 and 1000 characters');
  }

  const validCategories = ['general', 'job-search', 'recruitment', 'platform', 'support'];
  if (category && !validCategories.includes(category)) {
    errors.push('Invalid category');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Check if user already reviewed
const checkExistingReview = (userId) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT id FROM reviews WHERE userId = ?';
    db.query(query, [userId], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0 ? results[0] : null);
    });
  });
};

// Get all reviews with user info
const getAllReviews = async (req, res) => {
  try {
    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const query = `
      SELECT 
        r.id,
        r.userId,
        r.rating,
        r.title,
        r.comment,
        r.category,
        r.createdAt,
        r.updatedAt,
        u.firstName,
        u.lastName,
        u.userType
      FROM reviews r
      JOIN users u ON r.userId = u.id
      WHERE r.isApproved = true
      ORDER BY r.createdAt DESC
      LIMIT 100
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Get reviews error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to fetch reviews'
        });
      }

      // Log for debugging
      console.log(`Fetched ${results.length} reviews, newest:`, 
        results[0] ? {
          id: results[0].id,
          name: `${results[0].firstName} ${results[0].lastName}`,
          created: results[0].createdAt
        } : 'none'
      );

      res.json({
        success: true,
        reviews: results,
        total: results.length
      });
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while fetching reviews'
    });
  }
};

// Create a new review
const createReview = async (req, res) => {
  try {
    const { rating, title, comment, category = 'general' } = req.body;
    const userId = req.user.userId;

    // Validate input
    const validation = validateReview({ rating, title, comment, category });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        msg: validation.errors.join(', ')
      });
    }

    // Check if user already has a review (limit one review per user)
    const existingReview = await checkExistingReview(userId);
    if (existingReview) {
      return res.status(409).json({
        success: false,
        msg: 'You have already submitted a review. You can edit your existing review.'
      });
    }

    // Insert new review
    const insertQuery = `
      INSERT INTO reviews (userId, rating, title, comment, category)
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
      userId,
      parseInt(rating),
      title.trim(),
      comment.trim(),
      category
    ];

    db.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('Create review error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to submit review'
        });
      }

      console.log(`New review created: ID ${result.insertId} by user ${userId}`);

      res.status(201).json({
        success: true,
        msg: 'Review submitted successfully!',
        reviewId: result.insertId
      });
    });

  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while creating review'
    });
  }
};

// Update a review
const updateReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const { rating, title, comment, category } = req.body;
    const userId = req.user.userId;

    // Validate input
    const validation = validateReview({ rating, title, comment, category });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        msg: validation.errors.join(', ')
      });
    }

    // Check if review exists and belongs to user
    const checkQuery = 'SELECT id, userId FROM reviews WHERE id = ?';
    
    db.query(checkQuery, [reviewId], (err, results) => {
      if (err) {
        console.error('Check review error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          msg: 'Review not found'
        });
      }

      if (results[0].userId !== userId) {
        return res.status(403).json({
          success: false,
          msg: 'You can only edit your own reviews'
        });
      }

      // Update the review
      const updateQuery = `
        UPDATE reviews 
        SET rating = ?, title = ?, comment = ?, category = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND userId = ?
      `;

      const values = [
        parseInt(rating),
        title.trim(),
        comment.trim(),
        category,
        reviewId,
        userId
      ];

      db.query(updateQuery, values, (err, result) => {
        if (err) {
          console.error('Update review error:', err);
          return res.status(500).json({
            success: false,
            msg: 'Failed to update review'
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            msg: 'Review not found or no changes made'
          });
        }

        console.log(`Review updated: ID ${reviewId} by user ${userId}`);

        res.json({
          success: true,
          msg: 'Review updated successfully!'
        });
      });
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while updating review'
    });
  }
};

// Delete a review
const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const userId = req.user.userId;

    // Check if review exists and belongs to user
    const checkQuery = 'SELECT id, userId FROM reviews WHERE id = ?';
    
    db.query(checkQuery, [reviewId], (err, results) => {
      if (err) {
        console.error('Check review error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          msg: 'Review not found'
        });
      }

      if (results[0].userId !== userId) {
        return res.status(403).json({
          success: false,
          msg: 'You can only delete your own reviews'
        });
      }

      // Delete the review
      const deleteQuery = 'DELETE FROM reviews WHERE id = ? AND userId = ?';
      
      db.query(deleteQuery, [reviewId, userId], (err, result) => {
        if (err) {
          console.error('Delete review error:', err);
          return res.status(500).json({
            success: false,
            msg: 'Failed to delete review'
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            msg: 'Review not found'
          });
        }

        console.log(`Review deleted: ID ${reviewId} by user ${userId}`);

        res.json({
          success: true,
          msg: 'Review deleted successfully!'
        });
      });
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while deleting review'
    });
  }
};

// Get user's own review
const getUserReview = async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT 
        r.id,
        r.rating,
        r.title,
        r.comment,
        r.category,
        r.createdAt,
        r.updatedAt
      FROM reviews r
      WHERE r.userId = ?
    `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Get user review error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to fetch your review'
        });
      }

      res.json({
        success: true,
        review: results.length > 0 ? results[0] : null
      });
    });
  } catch (error) {
    console.error('Get user review error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while fetching your review'
    });
  }
};

// Get review statistics
const getReviewStats = async (req, res) => {
  try {
    // Set cache control headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const statsQuery = `
      SELECT 
        COUNT(*) as totalReviews,
        AVG(rating) as averageRating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as fiveStars,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as fourStars,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as threeStars,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as twoStars,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as oneStars
      FROM reviews 
      WHERE isApproved = true
    `;

    db.query(statsQuery, (err, results) => {
      if (err) {
        console.error('Get review stats error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to fetch review statistics'
        });
      }

      const stats = results[0];
      res.json({
        success: true,
        stats: {
          totalReviews: stats.totalReviews || 0,
          averageRating: parseFloat(stats.averageRating || 0).toFixed(1),
          distribution: {
            5: stats.fiveStars || 0,
            4: stats.fourStars || 0,
            3: stats.threeStars || 0,
            2: stats.twoStars || 0,
            1: stats.oneStars || 0
          }
        }
      });
    });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while fetching statistics'
    });
  }
};

module.exports = {
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
  getUserReview,
  getReviewStats,
  createReviewsTable
};
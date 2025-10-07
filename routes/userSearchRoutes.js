const express = require('express');
const router = express.Router();

// Import controller functions from userSearchController
const {
  searchJobSeekers,
  getCandidateDetails,
  getSearchStats,
  getProfessionalCategories
} = require('../controllers/userSearchController');

// Search job seekers - General search endpoint
router.post('/jobseekers', searchJobSeekers);

// Get candidate details by ID
router.get('/candidate/:candidateId', getCandidateDetails);

// Get search statistics
router.get('/stats', getSearchStats);

// Get professional categories
router.get('/categories', getProfessionalCategories);

module.exports = router;
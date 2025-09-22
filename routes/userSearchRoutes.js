const express = require('express');
const router = express.Router();

// Import controller functions from userSearchController
const {
  searchJobSeekers,
  matchSkills,
  getCandidateDetails,
  getSearchStats,
  getProfessionalCategories
} = require('../controllers/userSearchController');

// Search job seekers
router.post('/jobseekers', searchJobSeekers);

// AI skill matching
router.post('/match-skills', matchSkills);

// Get candidate details
router.get('/candidate/:candidateId', getCandidateDetails);

// Get search statistics
router.get('/stats', getSearchStats);

// Get professional categories
router.get('/categories', getProfessionalCategories);

module.exports = router;
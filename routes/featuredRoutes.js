// routes/featuredRoutes.js
const express = require('express');
const router = express.Router();
const {
  getFeaturedFreelancers,
  getFreelancerById,
  getAllFreelancers,
  getFeaturedEquipment,
  getEquipmentById,
  getAllEquipment
} = require('../controllers/featuredController');

// Freelancer routes - more specific routes first
router.get('/freelancers/featured', getFeaturedFreelancers);
router.get('/freelancers/:id', getFreelancerById);
router.get('/freelancers', getAllFreelancers);

// Equipment routes - more specific routes first
router.get('/equipment/featured', getFeaturedEquipment);
router.get('/equipment/details/:id', getEquipmentById); // Changed to /details/:id
router.get('/equipment', getAllEquipment);

module.exports = router;
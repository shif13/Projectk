// routes/featureRoutes.js
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

// Freelancer routes
router.get('/freelancers/featured', getFeaturedFreelancers);
router.get('/freelancers/:id', getFreelancerById);
router.get('/freelancers', getAllFreelancers);

// Equipment routes
router.get('/equipment/featured', getFeaturedEquipment);
router.get('/equipment/:id', getEquipmentById);
router.get('/equipment', getAllEquipment);

module.exports = router;
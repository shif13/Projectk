const express = require('express');
const router = express.Router();

const { 
  searchEquipment, 
  getLocations, 
  getEquipmentStats,
  sendEquipmentInquiry,
  getFeaturedEquipment
} = require('../controllers/equipmentSearchController');

router.get('/search', searchEquipment);
router.get('/locations/all', getLocations);
router.get('/stats/summary', getEquipmentStats);
router.post('/contact', sendEquipmentInquiry);
router.get('/featured', getFeaturedEquipment);

module.exports = router;
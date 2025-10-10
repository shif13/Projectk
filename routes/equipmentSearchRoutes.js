const express = require('express');
const router = express.Router();

const { 
  searchEquipment, 
  getLocations, 
  getEquipmentStats,
  sendEquipmentInquiry
} = require('../controllers/equipmentSearchController');

router.get('/search', searchEquipment);
router.get('/locations/all', getLocations);
router.get('/stats/summary', getEquipmentStats);
router.post('/contact', sendEquipmentInquiry);

module.exports = router;
const express = require('express');
const router = express.Router();
const {uploadEquipmentImages} = require('../config/cloudinary')
const {
  createEquipment
} = require('../controllers/equipmentController');

// Create new equipment listing
router.post('/create', uploadEquipmentImages.array('equipmentImages', 10), createEquipment);

module.exports = router;
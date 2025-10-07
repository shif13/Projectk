const express = require('express');
const router = express.Router();

// Import controller functions from equipmentController
const {
  createEquipment
} = require('../controllers/equipmentController');

// Create new equipment listing
router.post('/create', createEquipment);

module.exports = router;
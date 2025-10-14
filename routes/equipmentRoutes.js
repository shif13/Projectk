// routes/equipmentRoutes.js
// Equipment Owner CRUD Operations (Protected Routes)
const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Profile routes - Owner managing their equipment
router.get('/profile', equipmentController.getEquipmentOwnerProfile);
router.put('/profile', equipmentController.updateEquipmentOwnerProfile);

// Equipment CRUD routes (frontend sends Cloudinary URLs)
router.post('/add', equipmentController.addEquipment);
router.put('/:id', equipmentController.updateEquipment);
router.delete('/:id', equipmentController.deleteEquipment);

module.exports = router;
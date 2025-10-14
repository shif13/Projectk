const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public - Register new user
router.post('/create', userController.createUser);

// Public - Select roles (protected)
router.post('/select-roles', verifyToken, userController.selectRoles);

// Protected - Get all users
router.get('/', verifyToken, userController.getAllUsers);

// Protected - Get user stats
router.get('/stats', verifyToken, userController.getUserStats);

// Protected - Search users
router.get('/search', verifyToken, userController.searchUsers);

// Protected - Get user by ID
router.get('/:id', verifyToken, userController.getUserById);

// Protected - Update user
router.put('/:id', verifyToken, userController.updateUser);

// Protected - Delete user
router.delete('/:id', verifyToken, userController.deleteUser);

module.exports = router;
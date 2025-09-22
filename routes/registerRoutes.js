const express = require('express');
const router = express.Router();
const { registerUser } = require('../controllers/registerController');
const { uploadFields, validateRegistration } = require('../middleware/registerMiddleware');

// POST /api/register - Register new user
router.post('/register', uploadFields, validateRegistration, registerUser);

module.exports = router;
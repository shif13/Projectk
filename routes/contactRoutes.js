const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");

// POST /api/contact/send-email
router.post("/send-email", contactController.sendEmailToCandidate);

module.exports = router;

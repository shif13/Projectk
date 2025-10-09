const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const { db } = require('../config/db');
const { sendContactEmail, sendEquipmentInquiryEmail } = require('../services/emailService');

// POST /api/contact/freelancer - Send contact email to freelancer
router.post('/freelancer', async (req, res) => {
  try {
    const { freelancerId, senderInfo, subject, message } = req.body;

    // Validation
    if (!freelancerId || !senderInfo || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (!senderInfo.name || !senderInfo.email) {
      return res.status(400).json({
        success: false,
        message: 'Sender name and email are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderInfo.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // Fetch freelancer details from database
    const query = `
      SELECT 
        u.id,
        u.firstName,
        u.lastName,
        u.email,
        js.title
      FROM users u
      INNER JOIN job_seekers js ON u.id = js.userId
      WHERE u.id = ? AND u.userType = 'jobseeker'
    `;

    db.query(query, [freelancerId], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
      }

      const freelancer = results[0];

      // Prepare candidate data for email
      const candidateData = {
        firstName: freelancer.firstName,
        lastName: freelancer.lastName,
        email: freelancer.email,
        title: freelancer.title
      };

      // Prepare email data
      const emailData = {
        subject: subject,
        message: message,
        senderInfo: {
          name: senderInfo.name,
          email: senderInfo.email
        }
      };

      // Send email using existing sendContactEmail function
      const emailResult = await sendContactEmail(candidateData, emailData);

      if (emailResult.success) {
        return res.status(200).json({
          success: true,
          message: 'Contact email sent successfully',
          messageId: emailResult.messageId
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to send email',
          error: emailResult.error
        });
      }
    });

  } catch (error) {
    console.error('Error in freelancer contact route:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
});

// POST /api/contact/equipment - Send inquiry email to equipment owner
router.post('/equipment', async (req, res) => {
  try {
    const { equipmentId, inquiryData } = req.body;

    // Validation
    if (!equipmentId || !inquiryData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (!inquiryData.name || !inquiryData.email || !inquiryData.message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inquiryData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // Fetch equipment details from database
    const query = `
      SELECT 
        id,
        equipmentName,
        equipmentType,
        location,
        contactPerson,
        contactEmail,
        availability
      FROM equipment
      WHERE id = ? AND isActive = TRUE
    `;

    db.query(query, [equipmentId], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Equipment not found'
        });
      }

      const equipment = results[0];

      if (!equipment.contactEmail) {
        return res.status(400).json({
          success: false,
          message: 'Equipment owner email not available'
        });
      }

      // Prepare equipment data for email
      const equipmentData = {
        name: equipment.equipmentName,
        type: equipment.equipmentType,
        location: equipment.location || 'Not specified',
        owner: equipment.contactPerson,
        ownerEmail: equipment.contactEmail,
        email: equipment.contactEmail, // Alias for compatibility
        price: 'Contact for pricing', // You can add price field if available
        availability: equipment.availability
      };

      // Send email using existing sendEquipmentInquiryEmail function
      const emailResult = await sendEquipmentInquiryEmail(equipmentData, inquiryData);

      if (emailResult.success) {
        return res.status(200).json({
          success: true,
          message: 'Inquiry email sent successfully',
          messageId: emailResult.messageId
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to send inquiry email',
          error: emailResult.error
        });
      }
    });

  } catch (error) {
    console.error('Error in equipment inquiry route:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
});
// POST /api/contact/send-email
router.post("/send-email", contactController.sendEmailToCandidate);

module.exports = router;

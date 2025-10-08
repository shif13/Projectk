const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

// Database and services
const { testConnection } = require("./config/db");
const { verifyEmailConfig } = require("./services/emailService");

// Existing Routes
const loginRoutes = require("./routes/loginRoutes");

// Search and contact routes
const userSearchRoutes = require("./routes/userSearchRoutes");
const contactRoutes = require("./routes/contactRoutes");

// Register and dashboard routes
const registerRoutes = require("./routes/registerRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Review routes
const reviewRoutes = require('./routes/reviewRoutes');

// Equipment routes
const equipmentRoutes = require("./routes/equipmentRoutes");
const equipmentSearchRoutes = require("./routes/equipmentSearchRoutes");

// Controllers for table creation
const { createContactLogsTable } = require("./controllers/contactController");
const { createTables } = require("./controllers/registerController");
const { createEquipmentTable } = require("./controllers/equipmentController");

const app = express();
const PORT = process.env.PORT || 5550;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (for uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ADD THIS EMAIL TEST ENDPOINT HERE 👇
app.get('/api/test-email', async (req, res) => {
  const nodemailer = require('nodemailer');
  
  const log = [];
  const addLog = (msg) => {
    console.log(msg);
    log.push(msg);
  };
  
  try {
    addLog('🔍 Starting email diagnostic...');
    addLog('-----------------------------------');
    
    // Check environment variables
    addLog('📋 Environment Variables:');
    addLog(`   EMAIL_HOST: ${process.env.EMAIL_HOST || 'NOT SET'}`);
    addLog(`   EMAIL_PORT: ${process.env.EMAIL_PORT || 'NOT SET'}`);
    addLog(`   EMAIL_USER: ${process.env.EMAIL_USER || 'NOT SET'}`);
    addLog(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);
    addLog(`   EMAIL_SECURE: ${process.env.EMAIL_SECURE || 'NOT SET'}`);
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email credentials not configured in environment variables');
    }
    
    addLog('-----------------------------------');
    addLog('🔧 Creating email transporter...');
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      debug: true,
      logger: true
    });
    
    addLog('✅ Transporter created');
    addLog('-----------------------------------');
    addLog('🔄 Verifying SMTP connection...');
    
    // Verify connection
    await transporter.verify();
    addLog('✅ SMTP connection verified successfully!');
    
    addLog('-----------------------------------');
    addLog('📧 Sending test email...');
    
    // Send test email
    const result = await transporter.sendMail({
      from: {
        name: 'TalentConnect Test',
        address: process.env.EMAIL_USER
      },
      to: process.env.EMAIL_USER,
      subject: `✅ Email Test Success - ${new Date().toLocaleString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">🎉 Email Service is Working!</h2>
          <p>This test email was sent from your production server.</p>
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>⏰ Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>🌐 Server:</strong> https://projectk-6vkc.onrender.com</p>
          </div>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <h3>Configuration Details:</h3>
          <ul>
            <li><strong>Host:</strong> ${process.env.EMAIL_HOST}</li>
            <li><strong>Port:</strong> ${process.env.EMAIL_PORT}</li>
            <li><strong>Secure:</strong> ${process.env.EMAIL_SECURE}</li>
            <li><strong>User:</strong> ${process.env.EMAIL_USER}</li>
          </ul>
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0;"><strong>✅ Your email service is configured correctly and working!</strong></p>
          </div>
        </div>
      `,
      text: `Email service is working! Test sent at ${new Date().toLocaleString()}`
    });
    
    addLog(`✅ Email sent successfully!`);
    addLog(`   Message ID: ${result.messageId}`);
    addLog(`   Accepted: ${result.accepted?.join(', ')}`);
    addLog(`   Response: ${result.response}`);
    addLog('-----------------------------------');
    addLog('🎉 ALL TESTS PASSED! Check your inbox at ' + process.env.EMAIL_USER);
    
    res.json({
      success: true,
      message: '✅ Email service is working correctly!',
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        timestamp: new Date().toISOString(),
        sentTo: process.env.EMAIL_USER
      },
      log: log
    });
    
  } catch (error) {
    addLog(`❌ ERROR: ${error.message}`);
    addLog(`   Code: ${error.code || 'UNKNOWN'}`);
    addLog(`   Response Code: ${error.responseCode || 'N/A'}`);
    addLog(`   Command: ${error.command || 'N/A'}`);
    
    // Provide specific troubleshooting
    let suggestion = '';
    let nextSteps = [];
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      suggestion = '🔑 Authentication Failed - Your Gmail app password is incorrect or expired';
      nextSteps = [
        '1. Go to https://myaccount.google.com/apppasswords',
        '2. Generate a NEW app password',
        '3. Update EMAIL_PASS in Render environment variables',
        '4. Remove any spaces from the password',
        '5. Redeploy your service'
      ];
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      suggestion = '🔥 Connection Timeout - Port 587 might be blocked by Render';
      nextSteps = [
        '1. Try using port 465 instead',
        '2. Update environment variables:',
        '   EMAIL_PORT=465',
        '   EMAIL_SECURE=true',
        '3. Or consider using SendGrid (more reliable for production)'
      ];
    } else if (error.code === 'ESOCKET') {
      suggestion = '🌐 Network Error - Cannot reach smtp.gmail.com';
      nextSteps = [
        '1. Check if DNS is working on your server',
        '2. Verify server can make outbound connections',
        '3. Contact Render support about SMTP access'
      ];
    } else if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      suggestion = '⚙️ Configuration Error - Email credentials not set';
      nextSteps = [
        '1. Go to Render Dashboard > Your Service > Environment',
        '2. Add/update these variables:',
        '   EMAIL_HOST=smtp.gmail.com',
        '   EMAIL_PORT=587',
        '   EMAIL_USER=kingsy1131@gmail.com',
        '   EMAIL_PASS=your_app_password',
        '   EMAIL_SECURE=false',
        '3. Save and redeploy'
      ];
    } else {
      suggestion = '❓ Unknown Error - Check the error details below';
      nextSteps = [
        '1. Check Render logs for more details',
        '2. Verify all environment variables are set correctly',
        '3. Try regenerating Gmail app password'
      ];
    }
    
    addLog(`💡 ${suggestion}`);
    nextSteps.forEach(step => addLog(`   ${step}`));
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      responseCode: error.responseCode,
      suggestion: suggestion,
      nextSteps: nextSteps,
      log: log
    });
  }
});

// API Routes
// Existing routes
app.use("/api/login", loginRoutes);
app.use("/api/search", userSearchRoutes);
app.use("/api/contact", contactRoutes);

// New routes
app.use("/api", registerRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Review routes
app.use('/api/reviews', reviewRoutes);

// Equipment routes
app.use("/api/equipment", equipmentRoutes);
app.use("/api/equipment", equipmentSearchRoutes);
  
// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedRoute: req.originalUrl,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    await testConnection();
    console.log("✅ Database connection established");

    // Create tables
    createContactLogsTable();
    await createTables();
    await createEquipmentTable();
    console.log("✅ Database tables initialized");

    await verifyEmailConfig();
    console.log("✅ Email service initialized");

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
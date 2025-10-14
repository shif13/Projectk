const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();
const { testConnection } = require("./config/db");
const { verifyEmailConfig } = require("./services/emailService");

// User Routes
const userRoutes = require('./routes/userRoutes');

// Auth Routes
const loginRoutes = require("./routes/loginRoutes");

// Roles Routes
const freelancerRoutes = require('./routes/freelancerRoutes');
const equipmentRoutes = require("./routes/equipmentRoutes");

// Search Routes
const userSearchRoutes = require("./routes/userSearchRoutes");
const equipmentSearchRoutes = require("./routes/equipmentSearchRoutes");

// Other Routes
const contactRoutes = require("./routes/contactRoutes");
const reviewRoutes = require('./routes/reviewRoutes');

const { createContactLogsTable } = require("./controllers/contactController");
const { createTables } = require("./controllers/userController");
const { createEquipmentTable } = require("./controllers/equipmentController");
const { createReviewsTable } = require("./controllers/reviewController");

const app = express();
const PORT = process.env.PORT || 5550;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ProFetch Server is running",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// ==========================================
// ROUTES REGISTRATION
// ==========================================

// User and Auth Routes (PUBLIC)
app.use('/api/users', userRoutes);
app.use("/api/login", loginRoutes);

// Roles Routes (PROTECTED)
app.use('/api/freelancer', freelancerRoutes);

// ⚠️ FIXED: Use DIFFERENT paths to avoid conflicts
// Equipment CRUD operations (owner managing their equipment)
app.use("/api/equipment-owner", equipmentRoutes);  // For: create, update, delete equipment

// Equipment Search/Browse (public access)
app.use("/api/equipment", equipmentSearchRoutes);  // For: /search, /featured, /contact, etc.

// Search Routes (PUBLIC)
app.use("/api/search", userSearchRoutes);

// Other Routes (PUBLIC)
app.use("/api/contact", contactRoutes);
app.use('/api/reviews', reviewRoutes);

// ==========================================
// ERROR HANDLERS
// ==========================================

// 404 Handler - must be AFTER all routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedRoute: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================
const startServer = async () => {
  try {
    console.log('🚀 Starting ProFetch Server...');
    
    await testConnection();
    console.log('✅ Database connected');
    
    await createTables();
    await createEquipmentTable();
    await createReviewsTable();
    createContactLogsTable();
    console.log('✅ Database tables ready');
    
    await verifyEmailConfig();
    console.log('✅ Email service configured');
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log('\n📋 Route Map:');
      console.log('   PUBLIC:');
      console.log('   - /api/equipment/search (browse equipment)');
      console.log('   - /api/equipment/featured (home page)');
      console.log('   - /api/search (browse freelancers)');
      console.log('   - /api/login');
      console.log('   - /api/reviews');
      console.log('\n   PROTECTED:');
      console.log('   - /api/equipment-owner (manage equipment)');
      console.log('   - /api/freelancer (manage profile)');
      console.log('   - /api/users');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

module.exports = app;
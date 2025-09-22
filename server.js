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
const userSearchRoutes = require("./routes/userSearchRoutes");
const contactRoutes = require("./routes/contactRoutes");

// New Routes
const registerRoutes = require("./routes/registerRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Controllers for table creation
const { createContactLogsTable } = require("./controllers/contactController");
const { createTables } = require("./controllers/registerController");

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

// API Routes
// Existing routes
app.use("/api/login", loginRoutes);
app.use("/api/search", userSearchRoutes);
app.use("/api/contact", contactRoutes);

// New routes
app.use("/api", registerRoutes);
app.use("/api/dashboard", dashboardRoutes);

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
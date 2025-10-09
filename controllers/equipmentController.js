// equipmentController.js - For equipment creation and profile management
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../config/db');
const { cleanupUploadedFiles } = require('../middleware/registerMiddleware');
const { sendEquipmentListingEmail } = require('../services/emailService');

// Configure multer for file uploads (equipment images)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/equipment/';
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'equipmentImages') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  } else {
    cb(new Error('Unexpected field'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10
  }
}).fields([
  { name: 'equipmentImages', maxCount: 5 }
]);

// Create equipment table
const createEquipmentTable = () => {
  return new Promise((resolve, reject) => {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS equipment (
        id INT PRIMARY KEY AUTO_INCREMENT,
        equipmentName VARCHAR(255) NOT NULL,
        equipmentType VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        contactPerson VARCHAR(100) NOT NULL,
        contactNumber VARCHAR(20) NOT NULL,
        contactEmail VARCHAR(255) NOT NULL,
        availability ENUM('available', 'on-hire') DEFAULT 'available',
        equipmentImages JSON,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_availability (availability),
        INDEX idx_location (location),
        INDEX idx_equipment_type (equipmentType)
      )
    `;

    db.query(createTableQuery, (err) => {
      if (err) {
        console.error('Error creating equipment table:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
};

// Create contact inquiries table
const createContactInquiriesTable = () => {
  return new Promise((resolve, reject) => {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS contact_inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        equipment_id INT NOT NULL,
        requester_name VARCHAR(255) NOT NULL,
        requester_email VARCHAR(255) NOT NULL,
        requester_phone VARCHAR(20),
        message TEXT NOT NULL,
        status ENUM('pending', 'responded', 'resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_equipment_id (equipment_id),
        INDEX idx_requester_email (requester_email),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
      )
    `;

    db.query(createTableQuery, (err) => {
      if (err) {
        console.error('Error creating contact_inquiries table:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
};

// Initialize tables
let tablesInitialized = false;
const initializeTables = async () => {
  if (!tablesInitialized) {
    try {
      await createEquipmentTable();
      console.log('Equipment table initialized successfully');
      
      await createContactInquiriesTable();
      console.log('Contact inquiries table initialized successfully');
      
      tablesInitialized = true;
    } catch (error) {
      console.error('Failed to initialize tables:', error);
    }
  }
};

initializeTables();

// Validation functions
const validateRequiredFields = ({ equipmentName, equipmentType, contactPerson, contactNumber, contactEmail }) => {
  const errors = [];

  if (!equipmentName || equipmentName.trim().length < 2) {
    errors.push('Equipment name must be at least 2 characters');
  }
  if (!equipmentType || equipmentType.trim().length < 2) {
    errors.push('Equipment type is required');
  }
  if (!contactPerson || contactPerson.trim().length < 2) {
    errors.push('Contact person is required');
  }
  if (!contactNumber || contactNumber.trim().length < 8) {
    errors.push('Valid contact number is required');
  }
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.push('Valid email is required');
  }

  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Database operations
const insertEquipment = (equipmentData) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO equipment (
        equipmentName, equipmentType, location, contactPerson, 
        contactNumber, contactEmail, availability, equipmentImages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      equipmentData.equipmentName,
      equipmentData.equipmentType,
      equipmentData.location || '',
      equipmentData.contactPerson,
      equipmentData.contactNumber,
      equipmentData.contactEmail,
      equipmentData.availability || 'available',
      JSON.stringify(equipmentData.equipmentImages || [])
    ];

    db.query(query, values, (err, result) => {
      if (err) return reject(err);
      resolve(result.insertId);
    });
  });
};


const rollbackTransaction = () => {
  return new Promise((resolve) => {
    db.rollback(() => {
      console.log('Transaction rolled back');
      resolve();
    });
  });
};

// Main equipment creation function
const createEquipment = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === EQUIPMENT CREATION REQUEST START ===`);
  
  try {
    // Handle file upload
    upload(req, res, async function (err) {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          msg: 'File upload failed: ' + err.message,
          timestamp: new Date().toISOString()
        });
      }

      try {
        console.log('Request body:', req.body);
        console.log('Files:', req.files);

        const {
          equipmentName, 
          equipmentType, 
          location, 
          contactPerson, 
          contactNumber, 
          contactEmail, 
          availability
        } = req.body;

        // Validate required fields
        const validationResult = validateRequiredFields({
          equipmentName, 
          equipmentType, 
          contactPerson, 
          contactNumber, 
          contactEmail
        });

        if (!validationResult.isValid) {
          console.log('Validation failed:', validationResult.message);
          cleanupUploadedFiles(req);
          return res.status(400).json({ 
            success: false, 
            msg: validationResult.message,
            timestamp: new Date().toISOString()
          });
        }

        // Start transaction
        await new Promise((resolve, reject) => {
          db.beginTransaction((err) => {
            if (err) {
              console.error('Transaction start error:', err);
              return reject(err);
            }
            resolve();
          });
        });

        try {
          // Process file uploads (equipment images)
          const equipmentImages = req.files?.equipmentImages?.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size
          })) || [];

          // Prepare equipment data
          const equipmentData = {
            equipmentName: equipmentName.trim(),
            equipmentType: equipmentType.trim(),
            location: location?.trim() || '',
            contactPerson: contactPerson.trim(),
            contactNumber: contactNumber.trim(),
            contactEmail: contactEmail.trim().toLowerCase(),
            availability: availability || 'available',
            equipmentImages
          };

          console.log('Inserting equipment data:', equipmentData);

          // Insert equipment
          const equipmentId = await insertEquipment(equipmentData);
          console.log(`Equipment created with ID: ${equipmentId}`);

          // Commit transaction
          await new Promise((resolve, reject) => {
            db.commit((err) => {
              if (err) {
                console.error('Transaction commit error:', err);
                return reject(err);
              }
              resolve();
            });
          });

          // Send confirmation email (non-blocking - don't wait for it)
          sendEquipmentListingEmail(equipmentData)
            .then(emailResult => {
              if (emailResult.success) {
                console.log('Equipment listing confirmation email sent');
              } else {
                console.log('Failed to send listing confirmation email:', emailResult.error);
              }
            })
            .catch(emailError => {
              console.error('Email sending error:', emailError);
            });

          const responseTime = Date.now() - startTime;
          res.status(201).json({
            success: true,
            msg: 'Equipment listed successfully! Check your email for confirmation.',
            data: {
              id: equipmentId,
              equipmentName: equipmentData.equipmentName,
              equipmentType: equipmentData.equipmentType,
              availability: equipmentData.availability
            },
            timestamp: new Date().toISOString(),
            processingTime: `${responseTime}ms`
          });

        } catch (dbError) {
          console.error('Database error:', dbError);
          await rollbackTransaction();
          throw dbError;
        }

      } catch (error) {
        console.error('Equipment creation error:', error);
        cleanupUploadedFiles(req);
        
        let statusCode = 500;
        let errorMessage = 'Server error during equipment creation. Please try again.';
        
        if (error.code === 'ECONNREFUSED') {
          statusCode = 503;
          errorMessage = 'Database connection failed. Please try again later.';
        }
        
        res.status(statusCode).json({ 
          success: false, 
          msg: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: startTime
        });
      }
    });

  } catch (error) {
    console.error('Equipment creation controller error:', error);
    res.status(500).json({
      success: false,
      msg: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};


module.exports = {
  createEquipment,
  createEquipmentTable,
  createContactInquiriesTable
};
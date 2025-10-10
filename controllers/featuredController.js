// featuredController.js - Handles featured freelancers and equipment
const { db } = require('../config/db');

// Get backend URL from environment variable with fallback
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5550';

console.log('Backend URL configured:', BACKEND_URL);

// ==================== FREELANCER FUNCTIONS ====================

// Get featured freelancers
const getFeaturedFreelancers = (req, res) => {
  const limit = parseInt(req.query.limit) || 3;
  
  console.log('Fetching featured freelancers, limit:', limit);
  
  const query = `
    SELECT 
      js.id,
      js.userId,
      js.title,
      js.experience,
      js.availability,
      u.firstName,
      u.lastName,
      u.location
    FROM job_seekers js
    INNER JOIN users u ON js.userId = u.id
    WHERE js.availability = 'available'
    ORDER BY js.updatedAt DESC
    LIMIT ?
  `;
  
  db.query(query, [limit], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: err.message
      });
    }
    
    console.log('Found freelancers:', results.length);
    
    res.json({
      success: true,
      freelancers: results
    });
  });
};

// Get freelancer by ID
const getFreelancerById = (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      msg: 'Invalid freelancer ID'
    });
  }

  const query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.userName,
      u.email,
      u.phone,
      u.location,
      js.title,
      js.experience,
      js.expectedSalary,
      js.salaryCurrency,
      js.bio,
      js.availability,
      js.availableFrom,
      js.cvFilePath,
      js.certificatesPath,
      js.createdAt,
      js.updatedAt
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.id = ? AND u.userType = 'jobseeker'
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Database error fetching freelancer:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching freelancer details'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'Freelancer not found'
      });
    }

    const freelancer = results[0];
    
    // Safely parse JSON fields
    try {
      if (freelancer.certificatesPath) {
        if (typeof freelancer.certificatesPath === 'string') {
          const trimmed = freelancer.certificatesPath.trim();
          freelancer.certificatesPath = (trimmed === '' || trimmed === 'null') ? [] : JSON.parse(trimmed);
        } else if (!Array.isArray(freelancer.certificatesPath)) {
          freelancer.certificatesPath = [];
        }
      } else {
        freelancer.certificatesPath = [];
      }
    } catch (e) {
      console.error('Error parsing certificatesPath:', e);
      freelancer.certificatesPath = [];
    }

    res.status(200).json({
      success: true,
      freelancer: freelancer
    });
  });
};

// Get all freelancers with filtering
const getAllFreelancers = (req, res) => {
  const { 
    location, 
    experience, 
    availability,
    search,
    limit = 20,
    offset = 0
  } = req.query;

  let query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.userName,
      u.location,
      js.title,
      js.experience,
      js.expectedSalary,
      js.salaryCurrency,
      js.availability,
      js.createdAt
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker'
  `;

  const params = [];

  // Add filters
  if (location) {
    query += ` AND u.location LIKE ?`;
    params.push(`%${location}%`);
  }

  if (experience) {
    query += ` AND js.experience = ?`;
    params.push(experience);
  }

  if (availability) {
    query += ` AND js.availability = ?`;
    params.push(availability);
  }

  if (search) {
    query += ` AND (u.firstName LIKE ? OR u.lastName LIKE ? OR js.title LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Add ordering and pagination
  query += ` ORDER BY js.createdAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Database error fetching freelancers:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching freelancers'
      });
    }

    res.status(200).json({
      success: true,
      freelancers: results,
      count: results.length
    });
  });
};

// ==================== EQUIPMENT FUNCTIONS ====================

// Get featured equipment
const getFeaturedEquipment = (req, res) => {
  const limit = parseInt(req.query.limit) || 3;
  
  console.log('Fetching featured equipment, limit:', limit);
  
  const query = `
    SELECT 
      id,
      equipmentName,
      equipmentType,
      location,
      availability,
      equipmentImages
    FROM equipment
    WHERE isActive = TRUE
      AND availability = 'available'
    ORDER BY updatedAt DESC
    LIMIT ?
  `;
  
  db.query(query, [limit], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: err.message
      });
    }
    
    console.log('Found equipment:', results.length);
    
    // Extract first image from each equipment
    const equipment = results.map(item => {
      let image = null;
      
      if (item.equipmentImages) {
        try {
          let files = item.equipmentImages;
          
          if (typeof files === 'string') {
            if (files.trim() === '' || files.trim() === 'null') {
              files = [];
            } else {
              files = JSON.parse(files);
            }
          }
          
          if (Array.isArray(files) && files.length > 0) {
            // ✅ Use path directly - it's either a Cloudinary URL or local path
            const imageFile = files[0];
            if (imageFile && imageFile.path) {
              // ✅ If it's already a full URL (Cloudinary), use it as-is
              if (imageFile.path.startsWith('http://') || imageFile.path.startsWith('https://')) {
                image = imageFile.path;
                console.log('Cloudinary URL:', image);
              } else {
                // Fallback for old local images
                const cleanPath = imageFile.path.replace(/\\/g, '/').replace(/^uploads\//, '');
                image = `${BACKEND_URL}/uploads/${cleanPath}`;
                console.log('Local image URL:', image);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing equipment files for equipment ID', item.id, ':', e.message);
          console.error('Raw data:', item.equipmentImages);
        }
      }
      
      return {
        id: item.id,
        equipmentName: item.equipmentName,
        equipmentType: item.equipmentType,
        location: item.location,
        availability: item.availability,
        image: image
      };
    });
    
    res.json({
      success: true,
      equipment: equipment
    });
  });
};

// Get equipment by ID
const getEquipmentById = (req, res) => {
  const { id } = req.params;

  console.log('Fetching equipment with ID:', id);

  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      msg: 'Invalid equipment ID'
    });
  }

  const query = `
    SELECT 
      id,
      equipmentName,
      equipmentType,
      location,
      contactPerson,
      contactNumber,
      contactEmail,
      availability,
      equipmentImages,
      createdAt,
      updatedAt
    FROM equipment
    WHERE id = ? AND isActive = TRUE
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Database error fetching equipment:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching equipment details',
        error: err.message
      });
    }

    if (results.length === 0) {
      console.log('Equipment not found with ID:', id);
      return res.status(404).json({
        success: false,
        msg: 'Equipment not found'
      });
    }

    const equipment = results[0];
    console.log('Equipment found:', equipment.equipmentName);
    
    // Safely parse JSON fields
    try {
      if (equipment.equipmentImages) {
        if (typeof equipment.equipmentImages === 'string') {
          const trimmed = equipment.equipmentImages.trim();
          equipment.equipmentImages = (trimmed === '' || trimmed === 'null') ? [] : JSON.parse(trimmed);
        } else if (!Array.isArray(equipment.equipmentImages)) {
          equipment.equipmentImages = [];
        }
      } else {
        equipment.equipmentImages = [];
      }
      console.log('Parsed images count:', equipment.equipmentImages.length);
    } catch (e) {
      console.error('Error parsing equipmentImages:', e);
      equipment.equipmentImages = [];
    }

    res.status(200).json({
      success: true,
      equipment: equipment
    });
  });
};

// Get all equipment with filtering
const getAllEquipment = (req, res) => {
  const { 
    location, 
    equipmentType, 
    availability,
    search,
    limit = 20,
    offset = 0
  } = req.query;

  let query = `
    SELECT 
      id,
      equipmentName,
      equipmentType,
      location,
      availability,
      createdAt
    FROM equipment
    WHERE isActive = TRUE
  `;

  const params = [];

  // Add filters
  if (location) {
    query += ` AND location LIKE ?`;
    params.push(`%${location}%`);
  }

  if (equipmentType) {
    query += ` AND equipmentType LIKE ?`;
    params.push(`%${equipmentType}%`);
  }

  if (availability) {
    query += ` AND availability = ?`;
    params.push(availability);
  }

  if (search) {
    query += ` AND (equipmentName LIKE ? OR equipmentType LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  // Add ordering and pagination
  query += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Database error fetching equipment:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching equipment'
      });
    }

    res.status(200).json({
      success: true,
      equipment: results,
      count: results.length
    });
  });
};

module.exports = {
  // Freelancer functions
  getFeaturedFreelancers,
  getFreelancerById,
  getAllFreelancers,
  
  // Equipment functions
  getFeaturedEquipment,
  getEquipmentById,
  getAllEquipment
};
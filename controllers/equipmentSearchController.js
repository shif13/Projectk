// equipmentSearchController.js - For searching and filtering equipment
const { db } = require('../config/db');

// Enhanced hierarchical location matching with comprehensive locations
const buildLocationQuery = (searchLocation) => {
  if (!searchLocation || !searchLocation.trim()) {
    return { condition: '', params: [] };
  }

  const location = searchLocation.trim().toLowerCase();
  
  // Comprehensive location hierarchy with Indian states, cities, and regions
  const locationHierarchy = {
    // Countries
    'india': {
      type: 'country',
      includes: ['india', 'indian', 'bharat'],
      children: ['tamil nadu', 'karnataka', 'maharashtra', 'delhi', 'west bengal', 'gujarat', 
                'rajasthan', 'uttar pradesh', 'andhra pradesh', 'telangana', 'kerala', 'punjab',
                'haryana', 'odisha', 'jharkhand', 'assam', 'madhya pradesh', 'chhattisgarh',
                'uttarakhand', 'himachal pradesh', 'jammu and kashmir', 'goa', 'bihar',
                'munnar', 'ooty', 'darjeeling', 'shimla', 'manali', 'kodaikanal', 'wayanad']
    },
    
    // Tamil Nadu
    'tamil nadu': {
      type: 'state',
      includes: ['tamil nadu', 'tn', 'tamilnadu'],
      cities: ['chennai', 'coimbatore', 'madurai', 'salem', 'tirupur', 'erode', 'vellore', 
              'tiruchirappalli', 'trichy', 'tirunelveli', 'thanjavur', 'tuticorin', 'dindigul',
              'karur', 'cuddalore', 'kumbakonam', 'hosur', 'nagercoil', 'kanchipuram']
    },
    'chennai': {
      type: 'city',
      includes: ['chennai', 'madras', 'tambaram', 'velachery', 'omr', 'it corridor', 'anna nagar',
                't nagar', 'adyar', 'chrompet', 'porur', 'sholinganallur']
    },
    'coimbatore': {
      type: 'city',
      includes: ['coimbatore', 'kovai', 'cbe']
    },
    'madurai': {
      type: 'city',
      includes: ['madurai', 'temple city']
    },
    
    // Karnataka
    'karnataka': {
      type: 'state',
      includes: ['karnataka', 'ka'],
      cities: ['bangalore', 'bengaluru', 'mysore', 'mysuru', 'mangalore', 'mangaluru', 
              'hubli', 'belgaum', 'dharwad', 'bellary', 'tumkur', 'shimoga', 'ooty', 'udupi', 'hassan']
    },
    'bangalore': {
      type: 'city',
      includes: ['bangalore', 'bengaluru', 'blr', 'whitefield', 'electronic city', 'koramangala',
                'indiranagar', 'hsr layout', 'marathahalli', 'btm layout', 'jp nagar']
    },
    
    // Maharashtra
    'maharashtra': {
      type: 'state',
      includes: ['maharashtra', 'mh'],
      cities: ['mumbai', 'pune', 'nagpur', 'nashik', 'aurangabad', 'solapur', 'thane', 
              'kalyan', 'kolhapur', 'nanded']
    },
    'mumbai': {
      type: 'city',
      includes: ['mumbai', 'bombay', 'navi mumbai', 'thane', 'kalyan', 'bandra', 'andheri',
                'borivali', 'dadar', 'mulund', 'vikhroli', 'powai']
    },
    'pune': {
      type: 'city',
      includes: ['pune', 'pimpri', 'chinchwad', 'hinjewadi', 'wakad', 'baner', 'kharadi']
    },
    
    // Delhi NCR
    'delhi': {
      type: 'state',
      includes: ['delhi', 'new delhi', 'ncr', 'delhi ncr'],
      cities: ['new delhi', 'gurgaon', 'gurugram', 'noida', 'faridabad', 'ghaziabad', 
              'greater noida', 'dwarka', 'rohini', 'connaught place']
    },
    'gurgaon': {
      type: 'city',
      includes: ['gurgaon', 'gurugram', 'cyber city', 'udyog vihar', 'golf course road']
    },
    'noida': {
      type: 'city',
      includes: ['noida', 'greater noida', 'noida extension', 'sector 62', 'sector 16']
    },
    
    // West Bengal
    'west bengal': {
      type: 'state',
      includes: ['west bengal', 'wb'],
      cities: ['kolkata', 'calcutta', 'howrah', 'durgapur', 'siliguri', 'asansol']
    },
    'kolkata': {
      type: 'city',
      includes: ['kolkata', 'calcutta', 'howrah', 'salt lake', 'new town', 'rajarhat']
    },
    
    // Gujarat
    'gujarat': {
      type: 'state',
      includes: ['gujarat', 'gj'],
      cities: ['ahmedabad', 'surat', 'vadodara', 'baroda', 'rajkot', 'bhavnagar', 'gandhinagar']
    },
    'ahmedabad': {
      type: 'city',
      includes: ['ahmedabad', 'amdavad', 'gandhinagar', 'bopal', 'sg highway']
    },
    'surat': {
      type: 'city',
      includes: ['surat', 'diamond city']
    },
    
    // Rajasthan
    'rajasthan': {
      type: 'state',
      includes: ['rajasthan', 'rj'],
      cities: ['jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer', 'bikaner']
    },
    'jaipur': {
      type: 'city',
      includes: ['jaipur', 'pink city']
    },
    
    // Uttar Pradesh
    'uttar pradesh': {
      type: 'state',
      includes: ['uttar pradesh', 'up'],
      cities: ['lucknow', 'kanpur', 'agra', 'varanasi', 'meerut', 'allahabad', 'prayagraj', 'bareilly']
    },
    'lucknow': {
      type: 'city',
      includes: ['lucknow', 'gomti nagar']
    },
    'kanpur': {
      type: 'city',
      includes: ['kanpur', 'kanpur nagar']
    },
    
    // Andhra Pradesh
    'andhra pradesh': {
      type: 'state',
      includes: ['andhra pradesh', 'ap'],
      cities: ['vijayawada', 'visakhapatnam', 'vizag', 'guntur', 'tirupati', 'rajahmundry']
    },
    'visakhapatnam': {
      type: 'city',
      includes: ['visakhapatnam', 'vizag', 'vishakhapatnam']
    },
    
    // Telangana
    'telangana': {
      type: 'state',
      includes: ['telangana', 'ts'],
      cities: ['hyderabad', 'warangal', 'nizamabad', 'secunderabad']
    },
    'hyderabad': {
      type: 'city',
      includes: ['hyderabad', 'secunderabad', 'hitec city', 'gachibowli', 'kondapur', 
                'madhapur', 'kukatpally', 'hitech city']
    },
    
    // Kerala
    'kerala': {
      type: 'state',
      includes: ['kerala', 'kl'],
      cities: ['kochi', 'cochin', 'thiruvananthapuram', 'kozhikode', 'calicut', 'kottayam', 'thrissur', 'munnar', 'wayanad', 'alappuzha', 'kollam']
    },
    'kochi': {
      type: 'city',
      includes: ['kochi', 'cochin', 'ernakulam']
    },
    'munnar': {
      type: 'city',
      includes: ['munnar']
    },
    'ooty': {
      type: 'city',
      includes: ['ooty', 'ootacamund', 'udhagamandalam']
    },
    'thiruvananthapuram': {
      type: 'city',
      includes: ['thiruvananthapuram', 'trivandrum']
    },
    
    // Punjab
    'punjab': {
      type: 'state',
      includes: ['punjab', 'pb'],
      cities: ['chandigarh', 'ludhiana', 'amritsar', 'jalandhar', 'patiala']
    },
    'chandigarh': {
      type: 'city',
      includes: ['chandigarh', 'tricity', 'mohali', 'panchkula']
    },
    
    // Haryana
    'haryana': {
      type: 'state',
      includes: ['haryana', 'hr'],
      cities: ['gurgaon', 'gurugram', 'faridabad', 'panipat', 'ambala', 'karnal']
    },
    
    // Saudi Arabia
    'saudi arabia': {
      type: 'country',
      includes: ['saudi arabia', 'saudi', 'ksa'],
      children: ['eastern province', 'riyadh region', 'makkah region', 'madinah region']
    },
    'eastern province': {
      type: 'region',
      includes: ['eastern province', 'eastern region'],
      cities: ['dammam', 'khobar', 'dhahran', 'jubail', 'hofuf', 'qatif', 'al hasa']
    },
    'riyadh': {
      type: 'city',
      includes: ['riyadh', 'ar riyadh']
    },
    'jeddah': {
      type: 'city',
      includes: ['jeddah', 'jiddah']
    },
    'dammam': {
      type: 'city',
      includes: ['dammam']
    },
    'jubail': {
      type: 'city',
      includes: ['jubail', 'al jubail']
    },
    
    // UAE
    'uae': {
      type: 'country',
      includes: ['uae', 'united arab emirates', 'emirates'],
      cities: ['dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'fujairah', 'umm al quwain']
    },
    'dubai': {
      type: 'city',
      includes: ['dubai', 'dxb']
    },
    'abu dhabi': {
      type: 'city',
      includes: ['abu dhabi', 'abudhabi']
    }
  };
  
  // Function to get all matching locations recursively
  const getAllMatchingLocations = (searchKey) => {
    let matches = new Set();
    
    const locationData = locationHierarchy[searchKey];
    
    if (!locationData) {
      return [searchKey];
    }
    
    locationData.includes.forEach(loc => matches.add(loc));
    
    // If country, add all children (states/regions) and their cities
    if (locationData.type === 'country' && locationData.children) {
      locationData.children.forEach(child => {
        const childData = locationHierarchy[child];
        if (childData) {
          // Add state/region variations
          childData.includes.forEach(loc => matches.add(loc));
          
          // Add all cities under this state/region
          if (childData.cities) {
            childData.cities.forEach(city => {
              matches.add(city); // Add city name directly
              const cityData = locationHierarchy[city];
              if (cityData && cityData.includes) {
                cityData.includes.forEach(loc => matches.add(loc));
              }
            });
          }
        }
      });
    }
    
    // If state/region, add all its cities
    if ((locationData.type === 'state' || locationData.type === 'region') && locationData.cities) {
      locationData.cities.forEach(city => {
        matches.add(city); // Add city name directly
        const cityData = locationHierarchy[city];
        if (cityData && cityData.includes) {
          cityData.includes.forEach(loc => matches.add(loc));
        }
      });
    }
    
    return Array.from(matches);
  };
  
  const matchingLocations = getAllMatchingLocations(location);
  
  const conditions = matchingLocations.map(() => 'LOWER(location) LIKE ?').join(' OR ');
  const params = matchingLocations.map(loc => `%${loc}%`);
  
  return {
    condition: matchingLocations.length > 0 ? `(${conditions})` : '',
    params: params
  };
};

/**
 * Search and filter equipment based on various criteria
 */
const searchEquipment = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${startTime}] === EQUIPMENT SEARCH REQUEST START ===`);

  try {
    const { 
      search,
      location,
      availability
    } = req.query;

    console.log('Search parameters:', { search, location, availability });

    let query = `
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
      WHERE isActive = TRUE
    `;

    const queryParams = [];

    if (search && search.trim()) {
      query += ` AND (
        LOWER(equipmentName) LIKE ? OR 
        LOWER(equipmentType) LIKE ?
      )`;
      const searchTerm = `%${search.toLowerCase().trim()}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    if (location && location.trim()) {
      const locationQuery = buildLocationQuery(location);
      console.log('Location Query Result:', locationQuery);
      if (locationQuery.condition) {
        query += ` AND ${locationQuery.condition}`;
        queryParams.push(...locationQuery.params);
      }
    }

    if (availability && (availability === 'available' || availability === 'on-hire')) {
      query += ` AND availability = ?`;
      queryParams.push(availability);
    }

    query += ` ORDER BY createdAt DESC`;

    console.log('Executing query:', query);
    console.log('Query parameters:', queryParams);

    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to search equipment',
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }

      const equipmentList = results.map(item => {
        let images = [];
        try {
          if (item.equipmentImages) {
            images = typeof item.equipmentImages === 'string' 
              ? JSON.parse(item.equipmentImages)
              : item.equipmentImages;
          }
        } catch (parseError) {
          console.error('Error parsing images for equipment:', item.id, parseError);
        }

        return {
          ...item,
          equipmentImages: images
        };
      });

      const responseTime = Date.now() - startTime;
      console.log(`Found ${equipmentList.length} equipment items`);
      console.log(`Request completed in ${responseTime}ms`);

      res.status(200).json({
        success: true,
        msg: `Found ${equipmentList.length} equipment items`,
        data: equipmentList,
        count: equipmentList.length,
        filters: {
          search: search || null,
          location: location || null,
          availability: availability || 'all'
        },
        timestamp: new Date().toISOString(),
        processingTime: `${responseTime}ms`
      });
    });

  } catch (error) {
    console.error('Equipment search error:', error);
    res.status(500).json({
      success: false,
      msg: 'Internal server error during equipment search',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const getLocations = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT location
      FROM equipment
      WHERE isActive = TRUE AND location IS NOT NULL AND location != ''
      ORDER BY location ASC
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to retrieve locations',
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }

      const locations = results.map(row => row.location);

      res.status(200).json({
        success: true,
        msg: 'Locations retrieved successfully',
        data: locations,
        count: locations.length,
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      msg: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const getEquipmentStats = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN availability = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN availability = 'on-hire' THEN 1 ELSE 0 END) as onHire,
        COUNT(DISTINCT location) as locations,
        COUNT(DISTINCT equipmentType) as types
      FROM equipment
      WHERE isActive = TRUE
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({
          success: false,
          msg: 'Failed to retrieve equipment statistics',
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }

      const stats = results[0];

      res.status(200).json({
        success: true,
        msg: 'Equipment statistics retrieved successfully',
        data: {
          total: stats.total || 0,
          available: stats.available || 0,
          onHire: stats.onHire || 0,
          locations: stats.locations || 0,
          types: stats.types || 0
        },
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Get equipment stats error:', error);
    res.status(500).json({
      success: false,
      msg: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const sendEquipmentInquiry = async (req, res) => {
  try {
    const {
      equipmentId,
      equipmentName,
      ownerEmail,
      ownerName,
      location,
      inquirerName,
      inquirerEmail,
      inquirerPhone,
      message
    } = req.body;

    // Validate required fields
    if (!equipmentName || !ownerEmail || !inquirerName || !inquirerEmail || !message) {
      return res.status(400).json({
        success: false,
        msg: 'Missing required fields',
        timestamp: new Date().toISOString()
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inquirerEmail) || !emailRegex.test(ownerEmail)) {
      return res.status(400).json({
        success: false,
        msg: 'Invalid email address',
        timestamp: new Date().toISOString()
      });
    }

    // Import email service
    const { sendEquipmentInquiryEmail } = require('../services/emailService');

    // Prepare equipment data (matching the email template format)
    const equipmentData = {
      name: equipmentName,
      price: 'Contact for pricing', // You can add this field if needed
      location: location || 'Not specified',
      ownerEmail: ownerEmail,
      owner: ownerName || 'Equipment Owner'
    };

    // Prepare inquiry data
    const inquiryData = {
      name: inquirerName,
      email: inquirerEmail,
      phone: inquirerPhone || '',
      message: message
    };

    // Send email using the existing email service
    const emailResult = await sendEquipmentInquiryEmail(equipmentData, inquiryData);

    if (emailResult.success) {
      res.status(200).json({
        success: true,
        msg: 'Inquiry sent successfully! The equipment owner will contact you soon.',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        msg: 'Failed to send inquiry email. Please try again later.',
        error: emailResult.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Send equipment inquiry error:', error);
    res.status(500).json({
      success: false,
      msg: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  searchEquipment,
  getLocations,
  getEquipmentStats,
  sendEquipmentInquiry
};
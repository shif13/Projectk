const { db } = require('../config/db');

// Helper function for hierarchical location matching
const buildLocationQuery = (searchLocation) => {
  if (!searchLocation || !searchLocation.trim()) {
    return { condition: '', params: [] };
  }

  const location = searchLocation.trim().toLowerCase();
  
  // Define country-level mappings that include ALL their sub-locations
  const countryMappings = {
    'india': ['india', 'indian', 'tamil nadu', 'tn', 'chennai', 'coimbatore', 'madurai', 'salem', 'tirupur', 'erode', 'vellore', 'tiruchirappalli', 'trichy', 'karnataka', 'bangalore', 'bengaluru', 'mysore', 'mysuru', 'mangalore', 'mangaluru', 'hubli', 'belgaum', 'dharwad', 'maharashtra', 'mumbai', 'pune', 'nagpur', 'nashik', 'aurangabad', 'solapur', 'thane', 'kalyan', 'delhi', 'new delhi', 'ncr', 'gurgaon', 'gurugram', 'noida', 'faridabad', 'ghaziabad', 'greater noida', 'west bengal', 'kolkata', 'calcutta', 'howrah', 'durgapur', 'siliguri', 'gujarat', 'ahmedabad', 'surat', 'vadodara', 'baroda', 'rajkot', 'bhavnagar', 'gandhinagar', 'rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer', 'bikaner', 'uttar pradesh', 'up', 'lucknow', 'kanpur', 'agra', 'varanasi', 'meerut', 'allahabad', 'prayagraj', 'bareilly', 'andhra pradesh', 'ap', 'vijayawada', 'visakhapatnam', 'vizag', 'guntur', 'tirupati', 'telangana', 'hyderabad', 'warangal', 'nizamabad', 'secunderabad', 'kerala', 'kochi', 'cochin', 'thiruvananthapuram', 'kozhikode', 'calicut', 'kottayam', 'thrissur', 'punjab', 'chandigarh', 'ludhiana', 'amritsar', 'jalandhar', 'patiala', 'haryana', 'panipat', 'ambala', 'karnal', 'odisha', 'orissa', 'bhubaneswar', 'cuttack', 'rourkela', 'brahmapur', 'jharkhand', 'ranchi', 'jamshedpur', 'dhanbad', 'bokaro', 'assam', 'guwahati', 'dibrugarh', 'silchar', 'jorhat', 'madhya pradesh', 'mp', 'bhopal', 'indore', 'jabalpur', 'gwalior', 'ujjain', 'chhattisgarh', 'raipur', 'bhilai', 'bilaspur', 'uttarakhand', 'dehradun', 'haridwar', 'roorkee', 'nainital', 'himachal pradesh', 'hp', 'shimla', 'dharamshala', 'manali', 'jammu and kashmir', 'j&k', 'srinagar', 'jammu', 'goa', 'panaji', 'margao', 'vasco', 'bihar', 'patna', 'gaya', 'muzaffarpur', 'bhagalpur', 'tripura', 'agartala', 'meghalaya', 'shillong', 'manipur', 'imphal', 'nagaland', 'kohima', 'mizoram', 'aizawl', 'arunachal pradesh', 'itanagar', 'sikkim', 'gangtok']
  };
  
  // Check if searching for a country
  if (countryMappings[location]) {
    const matchingLocations = countryMappings[location];
    const conditions = matchingLocations.map(() => 'LOWER(u.location) LIKE ?').join(' OR ');
    const params = matchingLocations.map(loc => `%${loc}%`);
    return {
      condition: `(${conditions})`,
      params: params
    };
  }
  
  // Define location hierarchy mapping for states and cities
  const locationHierarchy = {
    // Countries (fallback if not in countryMappings)
    'usa': ['usa', 'united states', 'america', 'us'],
    'canada': ['canada', 'canadian'],
    'uk': ['uk', 'united kingdom', 'britain', 'british'],
    'australia': ['australia', 'australian'],
    'germany': ['germany', 'german'],
    'singapore': ['singapore'],
    'uae': ['uae', 'dubai', 'abu dhabi', 'united arab emirates'],
    'usa': ['usa', 'united states', 'america', 'us'],
    'canada': ['canada', 'canadian'],
    'uk': ['uk', 'united kingdom', 'britain', 'british'],
    'australia': ['australia', 'australian'],
    'germany': ['germany', 'german'],
    'uae': ['uae', 'dubai', 'abu dhabi', 'united arab emirates'],
    
    // Indian states and major cities
    'tamil nadu': ['tamil nadu', 'tn', 'chennai', 'coimbatore', 'madurai', 'salem', 'tirupur', 'erode', 'vellore', 'tiruchirappalli', 'trichy'],
    'karnataka': ['karnataka', 'bangalore', 'bengaluru', 'mysore', 'mysuru', 'mangalore', 'mangaluru', 'hubli', 'belgaum', 'dharwad'],
    'maharashtra': ['maharashtra', 'mumbai', 'pune', 'nagpur', 'nashik', 'aurangabad', 'solapur', 'thane', 'kalyan'],
    'delhi': ['delhi', 'new delhi', 'ncr', 'gurgaon', 'gurugram', 'noida', 'faridabad', 'ghaziabad', 'greater noida'],
    'west bengal': ['west bengal', 'kolkata', 'calcutta', 'howrah', 'durgapur', 'siliguri'],
    'gujarat': ['gujarat', 'ahmedabad', 'surat', 'vadodara', 'baroda', 'rajkot', 'bhavnagar', 'gandhinagar'],
    'rajasthan': ['rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer', 'bikaner'],
    'uttar pradesh': ['uttar pradesh', 'up', 'lucknow', 'kanpur', 'agra', 'varanasi', 'meerut', 'allahabad', 'prayagraj', 'bareilly'],
    'andhra pradesh': ['andhra pradesh', 'ap', 'vijayawada', 'visakhapatnam', 'vizag', 'guntur', 'tirupati'],
    'telangana': ['telangana', 'hyderabad', 'warangal', 'nizamabad', 'secunderabad'],
    'kerala': ['kerala', 'kochi', 'cochin', 'thiruvananthapuram', 'kozhikode', 'calicut', 'kottayam', 'thrissur'],
    'punjab': ['punjab', 'chandigarh', 'ludhiana', 'amritsar', 'jalandhar', 'patiala'],
    'haryana': ['haryana', 'gurgaon', 'gurugram', 'faridabad', 'panipat', 'ambala', 'karnal'],
    'odisha': ['odisha', 'orissa', 'bhubaneswar', 'cuttack', 'rourkela', 'brahmapur'],
    'jharkhand': ['jharkhand', 'ranchi', 'jamshedpur', 'dhanbad', 'bokaro'],
    'assam': ['assam', 'guwahati', 'dibrugarh', 'silchar', 'jorhat'],
    'madhya pradesh': ['madhya pradesh', 'mp', 'bhopal', 'indore', 'jabalpur', 'gwalior', 'ujjain'],
    'chhattisgarh': ['chhattisgarh', 'raipur', 'bhilai', 'bilaspur'],
    'uttarakhand': ['uttarakhand', 'dehradun', 'haridwar', 'roorkee', 'nainital'],
    'himachal pradesh': ['himachal pradesh', 'hp', 'shimla', 'dharamshala', 'manali'],
    'jammu and kashmir': ['jammu and kashmir', 'j&k', 'srinagar', 'jammu'],
    'goa': ['goa', 'panaji', 'margao', 'vasco'],
    'bihar': ['bihar', 'patna', 'gaya', 'muzaffarpur', 'bhagalpur'],
    'tripura': ['tripura', 'agartala'],
    'meghalaya': ['meghalaya', 'shillong'],
    'manipur': ['manipur', 'imphal'],
    'nagaland': ['nagaland', 'kohima'],
    'mizoram': ['mizoram', 'aizawl'],
    'arunachal pradesh': ['arunachal pradesh', 'itanagar'],
    'sikkim': ['sikkim', 'gangtok'],
    
    // Major cities that might be searched independently
    'bangalore': ['bangalore', 'bengaluru', 'whitefield', 'electronic city', 'koramangala', 'indiranagar'],
    'mumbai': ['mumbai', 'bombay', 'navi mumbai', 'thane', 'kalyan', 'bandra', 'andheri'],
    'chennai': ['chennai', 'madras', 'tambaram', 'velachery', 'omr', 'it corridor'],
    'hyderabad': ['hyderabad', 'secunderabad', 'hitec city', 'gachibowli', 'kondapur'],
    'pune': ['pune', 'pimpri', 'chinchwad', 'hinjewadi', 'wakad', 'baner'],
    'kolkata': ['kolkata', 'calcutta', 'howrah', 'salt lake', 'new town'],
    'ahmedabad': ['ahmedabad', 'gandhinagar', 'bopal', 'sg highway'],
    'jaipur': ['jaipur', 'pink city'],
    'surat': ['surat', 'diamond city'],
    'lucknow': ['lucknow', 'gomti nagar'],
    'kanpur': ['kanpur', 'kanpur nagar'],
    'nagpur': ['nagpur'],
    'indore': ['indore'],
    'thane': ['thane', 'kalyan', 'dombivli'],
    'bhopal': ['bhopal'],
    'visakhapatnam': ['visakhapatnam', 'vizag'],
    'vadodara': ['vadodara', 'baroda'],
    'ghaziabad': ['ghaziabad', 'indirapuram', 'vaishali'],
    'ludhiana': ['ludhiana'],
    'agra': ['agra'],
    'nashik': ['nashik'],
    'faridabad': ['faridabad'],
    'meerut': ['meerut'],
    'rajkot': ['rajkot'],
    'varanasi': ['varanasi', 'benaras', 'kashi'],
    'srinagar': ['srinagar'],
    'aurangabad': ['aurangabad'],
    'dhanbad': ['dhanbad'],
    'amritsar': ['amritsar'],
    'allahabad': ['allahabad', 'prayagraj'],
    'ranchi': ['ranchi'],
    'howrah': ['howrah'],
    'coimbatore': ['coimbatore', 'kovai'],
    'jabalpur': ['jabalpur'],
    'gwalior': ['gwalior'],
    'vijayawada': ['vijayawada', 'bezawada'],
    'jodhpur': ['jodhpur', 'blue city'],
    'madurai': ['madurai', 'temple city'],
    'raipur': ['raipur'],
    'kota': ['kota'],
    'chandigarh': ['chandigarh', 'tricity'],
    'guwahati': ['guwahati'],
    'solapur': ['solapur'],
    'hubli': ['hubli', 'hubli-dharwad', 'dharwad'],
    'tiruchirappalli': ['tiruchirappalli', 'trichy'],
    'bareilly': ['bareilly'],
    'mysore': ['mysore', 'mysuru'],
    'tiruppur': ['tiruppur'],
    'gurgaon': ['gurgaon', 'gurugram', 'cyber city', 'udyog vihar'],
    'noida': ['noida', 'greater noida', 'noida extension'],
    'mangalore': ['mangalore', 'mangaluru'],
    'salem': ['salem'],
    'erode': ['erode'],
    'vellore': ['vellore'],
    'guntur': ['guntur'],
    'bhilai': ['bhilai'],
    'warangal': ['warangal'],
    'firozabad': ['firozabad'],
    'kochi': ['kochi', 'cochin', 'ernakulam'],
    'bhavnagar': ['bhavnagar'],
    'dehradun': ['dehradun', 'doon'],
    'durgapur': ['durgapur'],
    'asansol': ['asansol'],
    'nanded': ['nanded'],
    'kolhapur': ['kolhapur'],
    'ajmer': ['ajmer'],
    'jamnagar': ['jamnagar'],
    'ujjain': ['ujjain'],
    'sangli': ['sangli'],
    'malegaon': ['malegaon'],
    'jalgaon': ['jalgaon'],
    'akola': ['akola'],
    'latur': ['latur'],
    'dhule': ['dhule'],
    'ahmednagar': ['ahmednagar'],
    'ichalkaranji': ['ichalkaranji'],
    'chandrapur': ['chandrapur'],
    'parbhani': ['parbhani'],
    'jalna': ['jalna'],
    'ambattur': ['ambattur'],
    'tirunelveli': ['tirunelveli', 'nellai'],
    'thanjavur': ['thanjavur', 'tanjore'],
    'tuticorin': ['tuticorin', 'thoothukudi'],
    'avadi': ['avadi'],
    'dindigul': ['dindigul'],
    'karur': ['karur'],
    'cuddalore': ['cuddalore'],
    'kumbakonam': ['kumbakonam'],
    'hosur': ['hosur'],
    'rajahmundry': ['rajahmundry', 'rajamahendravaram'],
    'kadapa': ['kadapa', 'cuddapah'],
    'karimnagar': ['karimnagar'],
    'ramagundam': ['ramagundam'],
    'khammam': ['khammam'],
    'mahbubnagar': ['mahbubnagar'],
    'nalgonda': ['nalgonda'],
    'adilabad': ['adilabad'],
    'suryapet': ['suryapet'],
    'miryalaguda': ['miryalaguda'],
    'jagtial': ['jagtial']
  };
  
  // Find all locations that should match this search
  let matchingLocations = [];
  
  // First, check if the search term is a key in our hierarchy (broader location like country/state)
  if (locationHierarchy[location]) {
    matchingLocations = locationHierarchy[location];
  } else {
    // Check if the search term appears in any hierarchy values (specific city)
    let found = false;
    for (const [key, values] of Object.entries(locationHierarchy)) {
      if (values.includes(location)) {
        // For specific city searches, only return that city and its variants
        matchingLocations = values.filter(loc => 
          loc === location || 
          loc.includes(location) || 
          location.includes(loc)
        );
        found = true;
        break;
      }
    }
    
    // If no hierarchy match found, fall back to original search term
    if (!found) {
      matchingLocations = [location];
    }
  }
  
  // Remove duplicates
  matchingLocations = [...new Set(matchingLocations)];
  
  // Build the SQL condition for multiple location matches
  const conditions = matchingLocations.map(() => 'LOWER(u.location) LIKE ?').join(' OR ');
  const params = matchingLocations.map(loc => `%${loc}%`);
  
  return {
    condition: `(${conditions})`,
    params: params
  };
};

// Search job seekers (for recruiters)
const searchJobSeekers = (req, res) => {
  const {
    jobTitle,
    location,
    experience
  } = req.body;

  console.log('Search request:', { jobTitle, location, experience });

  let query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      u.phone,
      u.location,
      u.createdAt,
      js.title,
      js.experience,
      js.expectedSalary,
      js.bio,
      js.cvFilePath
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker'
  `;

  const params = [];

  // Enhanced search logic with multiple field matching
  if (jobTitle && jobTitle.trim()) {
    query += ` AND (
      js.title LIKE ? OR 
      js.bio LIKE ?
    )`;
    const searchTerm = `%${jobTitle.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  // Enhanced location search with hierarchy
  if (location && location.trim()) {
    const locationQuery = buildLocationQuery(location);
    if (locationQuery.condition) {
      query += ` AND ${locationQuery.condition}`;
      params.push(...locationQuery.params);
    }
  }

  if (experience && experience.trim()) {
    query += ` AND js.experience = ?`;
    params.push(experience.trim());
  }

  query += ` ORDER BY u.createdAt DESC LIMIT 50`;

  console.log('Executing search query:', query);
  console.log('Search params:', params);

  db.query(query, params, (err, candidates) => {
    if (err) {
      console.error('Search error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Error searching job seekers',
        error: err.message 
      });
    }

    console.log(`Found ${candidates.length} candidates`);

    // Calculate relevance score
    const parsedCandidates = candidates.map(candidate => {
      let relevanceScore = 0;
      if (jobTitle && jobTitle.trim()) {
        const searchTerm = jobTitle.toLowerCase();
        if (candidate.title && candidate.title.toLowerCase().includes(searchTerm)) relevanceScore += 3;
        if (candidate.bio && candidate.bio.toLowerCase().includes(searchTerm)) relevanceScore += 2;
      }
      
      return {
        ...candidate,
        relevanceScore
      };
    });

    // Sort by relevance if there's a job title search, otherwise by date
    const sortedCandidates = jobTitle && jobTitle.trim() 
      ? parsedCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore)
      : parsedCandidates;

    res.json({
      success: true,
      candidates: sortedCandidates,
      total: sortedCandidates.length,
      searchCriteria: {
        jobTitle,
        location,
        experience
      }
    });
  });
};

// Get candidate profile details
const getCandidateDetails = (req, res) => {
  const { candidateId } = req.params;

  if (!candidateId) {
    return res.status(400).json({
      success: false,
      msg: 'Candidate ID is required'
    });
  }

  const query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      u.phone,
      u.location,
      u.createdAt,
      js.title,
      js.experience,
      js.expectedSalary,
      js.salaryCurrency,
      js.bio,
      js.availability,
      js.availableFrom,
      js.cvFilePath,
      js.certificatesPath
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker' AND u.id = ?
  `;

  db.query(query, [candidateId], (err, candidates) => {
    if (err) {
      console.error('Get candidate details error:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching candidate details'
      });
    }

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'Candidate not found'
      });
    }

    const candidate = candidates[0];
    
    // Parse certificates safely
    let parsedCertificates = [];
    
    try {
      if (candidate.certificatesPath) {
        if (typeof candidate.certificatesPath === 'string') {
          parsedCertificates = JSON.parse(candidate.certificatesPath);
        } else if (Array.isArray(candidate.certificatesPath)) {
          parsedCertificates = candidate.certificatesPath;
        }
      }
    } catch (error) {
      console.warn('Error parsing certificates for candidate details:', error.message);
      parsedCertificates = [];
    }

    // Ensure it's an array
    if (!Array.isArray(parsedCertificates)) parsedCertificates = [];

    const parsedCandidate = {
      ...candidate,
      certificatesPath: parsedCertificates
    };

    res.json({
      success: true,
      candidate: parsedCandidate
    });
  });
};

// Get professional categories and counts
const getProfessionalCategories = (req, res) => {
  const query = `
    SELECT 
      js.title,
      js.bio
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker' 
      AND js.title IS NOT NULL 
      AND js.title != ''
    ORDER BY u.createdAt DESC
  `;

  db.query(query, [], (err, professionals) => {
    if (err) {
      console.error('Categories error:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching professional categories'
      });
    }

    // Enhanced category mappings
    const categories = {
      'Frontend Developer': {
        keywords: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'javascript', 'html', 'css', 'ui developer', 'web developer'],
        count: 0,
        icon: 'Code'
      },
      'Backend Developer': {
        keywords: ['backend', 'back-end', 'back end', 'node', 'nodejs', 'python', 'java', 'php', 'api', 'server', 'database'],
        count: 0,
        icon: 'Database'
      },
      'Full Stack Developer': {
        keywords: ['fullstack', 'full-stack', 'full stack', 'mern', 'mean', 'lamp', 'stack'],
        count: 0,
        icon: 'Layers'
      },
      'Data Engineer': {
        keywords: ['data engineer', 'data engineering', 'etl', 'data pipeline', 'big data'],
        count: 0,
        icon: 'Database'
      },
      'Data Analyst': {
        keywords: ['data analyst', 'data analysis', 'analyst', 'business analyst', 'reporting'],
        count: 0,
        icon: 'BarChart'
      },
      'Data Scientist': {
        keywords: ['data scientist', 'data science', 'machine learning', 'ml', 'ai', 'artificial intelligence'],
        count: 0,
        icon: 'TrendingUp'
      },
      'DevOps Engineer': {
        keywords: ['devops', 'dev ops', 'docker', 'kubernetes', 'aws', 'azure', 'jenkins', 'ci/cd'],
        count: 0,
        icon: 'Settings'
      },
      'Cloud Engineer': {
        keywords: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'cloud architect'],
        count: 0,
        icon: 'Settings'
      },
      'Mobile Developer': {
        keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'app developer'],
        count: 0,
        icon: 'Smartphone'
      },
      'QA Engineer': {
        keywords: ['qa', 'quality assurance', 'testing', 'test', 'automation', 'tester'],
        count: 0,
        icon: 'CheckCircle'
      },
      'UI/UX Designer': {
        keywords: ['ui', 'ux', 'designer', 'design', 'figma', 'user experience', 'user interface'],
        count: 0,
        icon: 'Palette'
      },
      'Product Manager': {
        keywords: ['product manager', 'product management', 'pm', 'product owner', 'scrum master'],
        count: 0,
        icon: 'Users'
      },
      'Software Engineer': {
        keywords: ['software engineer', 'software developer', 'programmer', 'coding', 'engineer'],
        count: 0,
        icon: 'Code'
      },
      'Others': {
        keywords: [],
        count: 0,
        icon: 'User'
      }
    };

    // Categorize professionals
    professionals.forEach(professional => {
      const title = (professional.title || '').toLowerCase();
      const bio = (professional.bio || '').toLowerCase();
      const combinedText = `${title} ${bio}`;
      
      let categorized = false;
      
      Object.keys(categories).forEach(categoryName => {
        if (categoryName !== 'Others' && !categorized) {
          const category = categories[categoryName];
          const hasMatch = category.keywords.some(keyword => 
            combinedText.includes(keyword.toLowerCase())
          );
          
          if (hasMatch) {
            category.count++;
            categorized = true;
          }
        }
      });
      
      if (!categorized) {
        categories['Others'].count++;
      }
    });

    // Convert to array and filter
    const categoryArray = Object.keys(categories)
      .map(name => ({
        name,
        count: categories[name].count,
        icon: categories[name].icon
      }))
      .filter(category => category.count > 0)
      .sort((a, b) => {
        if (a.name === 'Others') return 1;
        if (b.name === 'Others') return -1;
        return b.count - a.count;
      });

    res.json({
      success: true,
      categories: categoryArray,
      totalProfessionals: professionals.length
    });
  });
};

// Get search statistics
const getSearchStats = (req, res) => {
  const statsQuery = `
    SELECT 
      COUNT(DISTINCT u.id) as totalCandidates,
      COUNT(DISTINCT CASE WHEN js.cvFilePath IS NOT NULL THEN u.id END) as candidatesWithCV
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker'
  `;

  db.query(statsQuery, [], (err, stats) => {
    if (err) {
      console.error('Stats error:', err);
      return res.status(500).json({
        success: false,
        msg: 'Error fetching search statistics'
      });
    }

    res.json({
      success: true,
      statistics: stats[0]
    });
  });
};

module.exports = {
  searchJobSeekers,
  getCandidateDetails,
  getSearchStats,
  getProfessionalCategories
};
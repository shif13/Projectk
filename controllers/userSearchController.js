const { db } = require('../config/db');

// Search job seekers (for recruiters)
const searchJobSeekers = (req, res) => {
  const {
    jobTitle,
    location,
    experience,
    availability,
    salaryRange
  } = req.body;

  console.log('Search request:', { jobTitle, location, experience, availability, salaryRange });

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
      js.skills,
      js.expectedSalary,
      js.linkedinUrl,
      js.githubUrl,
      js.bio,
      js.availability,
      js.cvFilePath,
      js.certificatesPath
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker'
  `;

  const params = [];

  // Enhanced search logic with multiple field matching
  if (jobTitle && jobTitle.trim()) {
    query += ` AND (
      js.title LIKE ? OR 
      js.bio LIKE ? OR 
      JSON_SEARCH(js.skills, 'one', ?, NULL, '$[*]') IS NOT NULL
    )`;
    const searchTerm = `%${jobTitle.trim()}%`;
    params.push(searchTerm, searchTerm, `%${jobTitle.trim()}%`);
  }

  if (location && location.trim()) {
    query += ` AND u.location LIKE ?`;
    params.push(`%${location.trim()}%`);
  }

  if (experience && experience.trim()) {
    query += ` AND js.experience = ?`;
    params.push(experience.trim());
  }

  if (availability && availability.trim()) {
    query += ` AND js.availability = ?`;
    params.push(availability.trim());
  }

  if (salaryRange && salaryRange.trim()) {
    // Enhanced salary filtering based on range
    switch (salaryRange) {
      case 'entry':
        query += ` AND (js.expectedSalary LIKE '%20%' OR js.expectedSalary LIKE '%30%' OR js.expectedSalary LIKE '%40%')`;
        break;
      case 'mid':
        query += ` AND (js.expectedSalary LIKE '%50%' OR js.expectedSalary LIKE '%60%' OR js.expectedSalary LIKE '%70%')`;
        break;
      case 'senior':
        query += ` AND (js.expectedSalary LIKE '%70%' OR js.expectedSalary LIKE '%80%' OR js.expectedSalary LIKE '%90%' OR js.expectedSalary LIKE '%100%')`;
        break;
      case 'expert':
        query += ` AND (js.expectedSalary LIKE '%100%' OR js.expectedSalary LIKE '%120%' OR js.expectedSalary LIKE '%150%')`;
        break;
    }
  }

  query += ` ORDER BY 
    CASE 
      WHEN js.availability = 'available' THEN 0 
      ELSE 1 
    END,
    u.createdAt DESC 
    LIMIT 50`;

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

    // Parse JSON fields and add search relevance
    const parsedCandidates = candidates.map(candidate => {
      let parsedSkills = [];
      let parsedCertificates = [];

      // Safely parse skills
      try {
        if (candidate.skills) {
          if (typeof candidate.skills === 'string') {
            parsedSkills = JSON.parse(candidate.skills);
          } else if (Array.isArray(candidate.skills)) {
            parsedSkills = candidate.skills;
          }
        }
      } catch (error) {
        console.warn('Error parsing skills for candidate', candidate.id, ':', error.message);
        parsedSkills = [];
      }

      // Safely parse certificates
      try {
        if (candidate.certificatesPath) {
          if (typeof candidate.certificatesPath === 'string') {
            parsedCertificates = JSON.parse(candidate.certificatesPath);
          } else if (Array.isArray(candidate.certificatesPath)) {
            parsedCertificates = candidate.certificatesPath;
          }
        }
      } catch (error) {
        console.warn('Error parsing certificates for candidate', candidate.id, ':', error.message);
        parsedCertificates = [];
      }

      // Ensure arrays
      if (!Array.isArray(parsedSkills)) parsedSkills = [];
      if (!Array.isArray(parsedCertificates)) parsedCertificates = [];
      
      // Calculate relevance score
      let relevanceScore = 0;
      if (jobTitle && jobTitle.trim()) {
        const searchTerm = jobTitle.toLowerCase();
        if (candidate.title && candidate.title.toLowerCase().includes(searchTerm)) relevanceScore += 3;
        if (candidate.bio && candidate.bio.toLowerCase().includes(searchTerm)) relevanceScore += 2;
        parsedSkills.forEach(skill => {
          if (skill && skill.toLowerCase().includes(searchTerm)) relevanceScore += 2;
        });
      }
      
      return {
        ...candidate,
        skills: parsedSkills,
        certificatesPath: parsedCertificates,
        relevanceScore
      };
    });

    // Sort by relevance if there's a job title search, otherwise by availability and date
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
        experience,
        availability,
        salaryRange
      }
    });
  });
};

// AI-powered skill matching (enhanced version)
const matchSkills = (req, res) => {
  const { skills } = req.body;

  console.log('Skill matching request:', { skills });

  if (!skills || !skills.trim()) {
    return res.status(400).json({ 
      success: false, 
      msg: 'Skills are required for matching' 
    });
  }

  // Parse input skills with better processing
  const inputSkills = skills.toLowerCase()
    .split(/[,;|\n]/)
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0);

  console.log('Parsed input skills for matching:', inputSkills);

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
      js.skills,
      js.expectedSalary,
      js.linkedinUrl,
      js.githubUrl,
      js.bio,
      js.availability,
      js.cvFilePath,
      js.certificatesPath
    FROM users u
    INNER JOIN job_seekers js ON u.id = js.userId
    WHERE u.userType = 'jobseeker' 
      AND js.skills IS NOT NULL 
      AND js.skills != '[]'
      AND js.skills != 'null'
      AND js.skills != ''
    ORDER BY u.createdAt DESC
  `;

  db.query(query, [], (err, allCandidates) => {
    if (err) {
      console.error('Skill matching error:', err);
      return res.status(500).json({ 
        success: false, 
        msg: 'Error matching skills',
        error: err.message 
      });
    }

    console.log(`Processing ${allCandidates.length} candidates for skill matching`);

    // Enhanced skill matching algorithm
    const matchedCandidates = allCandidates.map(candidate => {
      let candidateSkills = [];
      
      // Safely parse candidate skills
      try {
        if (candidate.skills) {
          if (typeof candidate.skills === 'string') {
            candidateSkills = JSON.parse(candidate.skills);
          } else if (Array.isArray(candidate.skills)) {
            candidateSkills = candidate.skills;
          }
        }
      } catch (error) {
        console.warn('Invalid skills JSON for candidate:', candidate.id, error.message);
        candidateSkills = [];
      }
      
      // Ensure it's an array and filter out empty values
      if (!Array.isArray(candidateSkills)) {
        candidateSkills = [];
      }
      candidateSkills = candidateSkills.filter(skill => skill && skill.trim().length > 0);
      
      const candidateSkillsLower = candidateSkills.map(skill => skill.toLowerCase().trim());
      
      // Calculate different types of matches
      const exactMatches = [];
      const partialMatches = [];
      const relatedMatches = [];

      inputSkills.forEach(inputSkill => {
        candidateSkillsLower.forEach((candidateSkill, index) => {
          if (candidateSkill === inputSkill) {
            exactMatches.push(candidateSkills[index]);
          } else if (candidateSkill.includes(inputSkill) || inputSkill.includes(candidateSkill)) {
            partialMatches.push(candidateSkills[index]);
          } else if (areRelatedSkills(inputSkill, candidateSkill)) {
            relatedMatches.push(candidateSkills[index]);
          }
        });
      });

      // Calculate match score with weighted scoring
      const exactScore = exactMatches.length * 3;
      const partialScore = partialMatches.length * 2;
      const relatedScore = relatedMatches.length * 1;
      const totalScore = exactScore + partialScore + relatedScore;
      
      const maxPossibleScore = inputSkills.length * 3;
      const matchScore = maxPossibleScore > 0 
        ? Math.round((totalScore / maxPossibleScore) * 100)
        : 0;

      const allMatchingSkills = [...new Set([...exactMatches, ...partialMatches, ...relatedMatches])];

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
        console.warn('Error parsing certificates for candidate', candidate.id, ':', error.message);
        parsedCertificates = [];
      }

      if (!Array.isArray(parsedCertificates)) parsedCertificates = [];

      return {
        ...candidate,
        skills: candidateSkills,
        certificatesPath: parsedCertificates,
        matchScore,
        matchingSkills: allMatchingSkills,
        matchDetails: {
          exact: exactMatches.length,
          partial: partialMatches.length,
          related: relatedMatches.length,
          total: allMatchingSkills.length
        }
      };
    }).filter(candidate => candidate.matchScore > 0)
      .sort((a, b) => {
        // Sort by match score first, then by availability, then by date
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if (a.availability === 'available' && b.availability !== 'available') return -1;
        if (b.availability === 'available' && a.availability !== 'available') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 25); // Limit to top 25 matches

    console.log(`Found ${matchedCandidates.length} skill matches`);

    res.json({
      success: true,
      matches: matchedCandidates,
      total: matchedCandidates.length,
      searchedSkills: inputSkills,
      statistics: {
        totalCandidatesProcessed: allCandidates.length,
        candidatesWithMatches: matchedCandidates.length,
        averageMatchScore: matchedCandidates.length > 0 
          ? Math.round(matchedCandidates.reduce((sum, c) => sum + c.matchScore, 0) / matchedCandidates.length)
          : 0
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
      js.skills,
      js.expectedSalary,
      js.linkedinUrl,
      js.githubUrl,
      js.bio,
      js.availability,
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
    
    // Parse JSON fields safely
    let parsedSkills = [];
    let parsedCertificates = [];

    try {
      if (candidate.skills) {
        if (typeof candidate.skills === 'string') {
          parsedSkills = JSON.parse(candidate.skills);
        } else if (Array.isArray(candidate.skills)) {
          parsedSkills = candidate.skills;
        }
      }
    } catch (error) {
      console.warn('Error parsing skills for candidate details:', error.message);
      parsedSkills = [];
    }

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

    // Ensure arrays
    if (!Array.isArray(parsedSkills)) parsedSkills = [];
    if (!Array.isArray(parsedCertificates)) parsedCertificates = [];

    const parsedCandidate = {
      ...candidate,
      skills: parsedSkills,
      certificatesPath: parsedCertificates
    };

    res.json({
      success: true,
      candidate: parsedCandidate
    });
  });
};

// NEW: Get professional categories and counts
// In userSearchController.js - Update the getProfessionalCategories function:

const getProfessionalCategories = (req, res) => {
  const query = `
    SELECT 
      js.title,
      js.skills,
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

    // Enhanced category mappings - more comprehensive
    const categories = {
      'Frontend Developer': {
        keywords: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'javascript', 'html', 'css', 'ui developer', 'web developer', 'jsx', 'typescript'],
        count: 0,
        icon: 'Code'
      },
      'Backend Developer': {
        keywords: ['backend', 'back-end', 'back end', 'node', 'nodejs', 'python', 'java', 'php', 'api', 'server', 'database', 'django', 'flask', 'spring'],
        count: 0,
        icon: 'Database'
      },
      'Full Stack Developer': {
        keywords: ['fullstack', 'full-stack', 'full stack', 'mern', 'mean', 'lamp', 'stack'],
        count: 0,
        icon: 'Layers'
      },
      'Data Engineer': {
        keywords: ['data engineer', 'data engineering', 'etl', 'data pipeline', 'big data', 'hadoop', 'spark', 'airflow', 'kafka'],
        count: 0,
        icon: 'Database'
      },
      'Data Analyst': {
        keywords: ['data analyst', 'data analysis', 'analyst', 'business analyst', 'reporting', 'dashboard', 'excel', 'tableau', 'power bi'],
        count: 0,
        icon: 'BarChart'
      },
      'Data Scientist': {
        keywords: ['data scientist', 'data science', 'machine learning', 'ml', 'ai', 'artificial intelligence', 'analytics', 'statistics'],
        count: 0,
        icon: 'TrendingUp'
      },
      'DevOps Engineer': {
        keywords: ['devops', 'dev ops', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'jenkins', 'ci/cd', 'terraform', 'ansible'],
        count: 0,
        icon: 'Settings'
      },
      'Cloud Engineer': {
        keywords: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'cloud architect', 'cloud developer', 'ec2', 's3', 'lambda'],
        count: 0,
        icon: 'Settings'
      },
      'Mobile Developer': {
        keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'app developer'],
        count: 0,
        icon: 'Smartphone'
      },
      'QA Engineer': {
        keywords: ['qa', 'quality assurance', 'testing', 'test', 'automation', 'selenium', 'tester', 'manual testing', 'test engineer'],
        count: 0,
        icon: 'CheckCircle'
      },
      'UI/UX Designer': {
        keywords: ['ui', 'ux', 'designer', 'design', 'figma', 'sketch', 'adobe', 'user experience', 'user interface', 'graphic'],
        count: 0,
        icon: 'Palette'
      },
      'Product Manager': {
        keywords: ['product manager', 'product management', 'pm', 'product owner', 'scrum master', 'agile', 'product lead'],
        count: 0,
        icon: 'Users'
      },
      'Software Engineer': {
        keywords: ['software engineer', 'software developer', 'programmer', 'coding', 'development', 'engineer'],
        count: 0,
        icon: 'Code'
      },
      'Others': {
        keywords: [],
        count: 0,
        icon: 'User'
      }
    };

    // Categorize ALL professionals
    professionals.forEach(professional => {
      const title = (professional.title || '').toLowerCase();
      const bio = (professional.bio || '').toLowerCase();
      let skills = [];
      
      // Parse skills safely
      try {
        if (professional.skills) {
          if (typeof professional.skills === 'string') {
            skills = JSON.parse(professional.skills);
          } else if (Array.isArray(professional.skills)) {
            skills = professional.skills;
          }
        }
      } catch (error) {
        skills = [];
      }
      
      const skillsText = Array.isArray(skills) ? skills.join(' ').toLowerCase() : '';
      const combinedText = `${title} ${bio} ${skillsText}`;
      
      let categorized = false;
      
      // Check each category (excluding "Others")
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
      
      // If not categorized in any specific category, add to "Others"
      if (!categorized) {
        categories['Others'].count++;
      }
    });

    // Convert to array, filter out empty categories, and sort by count
    const categoryArray = Object.keys(categories)
      .map(name => ({
        name,
        count: categories[name].count,
        icon: categories[name].icon
      }))
      .filter(category => category.count > 0)  // Only show categories with candidates
      .sort((a, b) => {
        // Sort "Others" to the end, then by count
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
// Get search statistics (enhanced with categories)
const getSearchStats = (req, res) => {
  const statsQuery = `
    SELECT 
      COUNT(DISTINCT u.id) as totalCandidates,
      COUNT(DISTINCT CASE WHEN js.availability = 'available' THEN u.id END) as availableCandidates,
      COUNT(DISTINCT CASE WHEN js.skills IS NOT NULL AND js.skills != '[]' AND js.skills != '' THEN u.id END) as candidatesWithSkills,
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

    const topSkillsQuery = `
      SELECT skill, COUNT(*) as count
      FROM (
        SELECT JSON_UNQUOTE(JSON_EXTRACT(js.skills, CONCAT('$[', numbers.n, ']'))) as skill
        FROM job_seekers js
        JOIN (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) numbers
        WHERE JSON_LENGTH(js.skills) > numbers.n
        AND js.skills IS NOT NULL
        AND js.skills != '[]'
        AND js.skills != ''
      ) as extracted_skills
      WHERE skill IS NOT NULL AND skill != ''
      GROUP BY skill
      ORDER BY count DESC
      LIMIT 10
    `;

    db.query(topSkillsQuery, [], (err, topSkills) => {
      if (err) {
        console.warn('Top skills query error:', err);
        // If top skills query fails, still return basic stats
        return res.json({
          success: true,
          statistics: stats[0],
          topSkills: []
        });
      }

      res.json({
        success: true,
        statistics: stats[0],
        topSkills: topSkills || []
      });
    });
  });
};

// Helper function to determine if skills are related
function areRelatedSkills(skill1, skill2) {
  const relatedSkillsMap = {
    'react': ['javascript', 'js', 'jsx', 'frontend', 'web development', 'next', 'nextjs'],
    'vue': ['javascript', 'js', 'frontend', 'web development', 'nuxt'],
    'angular': ['typescript', 'javascript', 'js', 'frontend', 'web development'],
    'node': ['javascript', 'js', 'backend', 'server', 'express'],
    'nodejs': ['javascript', 'js', 'backend', 'server', 'express'],
    'python': ['django', 'flask', 'fastapi', 'backend', 'data science', 'machine learning', 'ai'],
    'java': ['spring', 'backend', 'enterprise', 'springboot'],
    'typescript': ['javascript', 'js', 'react', 'angular', 'node'],
    'css': ['html', 'frontend', 'web development', 'sass', 'scss', 'tailwind'],
    'html': ['css', 'frontend', 'web development'],
    'sql': ['database', 'mysql', 'postgresql', 'mongodb'],
    'aws': ['cloud', 'devops', 'infrastructure', 'ec2', 's3'],
    'docker': ['devops', 'containerization', 'kubernetes'],
    'git': ['version control', 'github', 'gitlab'],
    'mongodb': ['database', 'nosql', 'mongoose'],
    'mysql': ['database', 'sql', 'relational'],
    'postgresql': ['database', 'sql', 'relational'],
    'redis': ['cache', 'database', 'memory'],
    'graphql': ['api', 'query language', 'apollo'],
    'rest': ['api', 'web service', 'http'],
    'sass': ['css', 'scss', 'styling'],
    'scss': ['css', 'sass', 'styling'],
    'tailwind': ['css', 'utility', 'styling'],
    'bootstrap': ['css', 'framework', 'responsive']
  };

  const skill1Lower = skill1.toLowerCase();
  const skill2Lower = skill2.toLowerCase();

  if (relatedSkillsMap[skill1Lower] && relatedSkillsMap[skill1Lower].includes(skill2Lower)) {
    return true;
  }
  if (relatedSkillsMap[skill2Lower] && relatedSkillsMap[skill2Lower].includes(skill1Lower)) {
    return true;
  }
  
  return false;
}

module.exports = {
  searchJobSeekers,
  matchSkills,
  getCandidateDetails,
  getSearchStats,
  getProfessionalCategories  // NEW export
};
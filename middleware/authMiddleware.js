const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach user data to request
 */
const verifyToken = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        msg: 'No token provided, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-default-secret-key-change-this');
    req.user = decoded; // Contains: userId, email, userType
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        msg: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        msg: 'Invalid token'
      });
    }

    res.status(401).json({
      success: false,
      msg: 'Token verification failed'
    });
  }
};

/**
 * Check if user is admin (for future use)
 */
const isAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        msg: 'Authentication required'
      });
    }

    // Check if user has admin role
    // Note: You'll need to add 'role' field to users table or check userType
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        msg: 'Access denied. Admin privileges required.'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      msg: 'Error checking admin privileges'
    });
  }
};

/**
 * Check if user is the owner of the resource or admin
 */
const isOwnerOrAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        msg: 'Authentication required'
      });
    }

    const requestedUserId = parseInt(req.params.id);
    const currentUserId = req.user.userId;

    // Allow if user is admin or accessing their own data
    if (req.user.role === 'admin' || currentUserId === requestedUserId) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        msg: 'Access denied. You can only access your own data.'
      });
    }
  } catch (error) {
    console.error('Ownership check error:', error);
    res.status(500).json({
      success: false,
      msg: 'Error checking resource ownership'
    });
  }
};

/**
 * Check if user type matches required type
 */
const requireUserType = (allowedTypes) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: 'Authentication required'
        });
      }

      const userType = req.user.userType;

      if (!allowedTypes.includes(userType)) {
        return res.status(403).json({
          success: false,
          msg: `Access denied. This action is only allowed for: ${allowedTypes.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('User type check error:', error);
      res.status(500).json({
        success: false,
        msg: 'Error checking user type'
      });
    }
  };
};

// Export for backwards compatibility
const authMiddleware = verifyToken;

module.exports = {
  authMiddleware,     // Keep for backwards compatibility
  verifyToken,        // New name (more descriptive)
  isAdmin,
  isOwnerOrAdmin,
  requireUserType
};
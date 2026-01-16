const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * Middleware для перевірки JWT токену
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'токен авторизації відсутній'
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    
    // Перевірка що користувач існує та активний
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true }
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Користувач не знайдено або неактивний'
      });
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Невірний токен'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Токен прострочено'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Помилка авторизації'
    });
  }
};

/**
 * Middleware для перевірки ролі
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Необхідна авторизація'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Недостатньо прав доступу'
      });
    }
    
    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};

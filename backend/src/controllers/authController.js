const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Логін користувача
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array()
      });
    }
    
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Невірний email або пароль'
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Невірний email або пароль'
      });
    }
    
    // Оновлюємо last_login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });
    
    const token = jwt.sign(
      { id: user.id, email: user.email, roleId: user.roleId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка входу'
    });
  }
};

/**
 * Реєстрація нового користувача
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array()
      });
    }
    
    const { email, password, fullName } = req.body;
    
    // Перевірка чи користувач вже існує
    const existing = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Користувач з таким email вже існує'
      });
    }
    
    // Отримуємо роль User за замовчуванням
    let role = await prisma.role.findUnique({
      where: { name: 'User' }
    });
    
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: 'User',
          description: 'Звичайний користувач'
        }
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        roleId: role.id,
        isActive: true
      }
    });
    
    const token = jwt.sign(
      { id: user.id, email: user.email, roleId: user.roleId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: role.name
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка реєстрації'
    });
  }
};

/**
 * Отримати профіль користувача
 */
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        role: true,
        personnel: {
          include: {
            crew: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Користувач не знайдено'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
        isActive: user.isActive,
        personnel: user.personnel
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання профілю'
    });
  }
};

module.exports = {
  login,
  register,
  getProfile
};

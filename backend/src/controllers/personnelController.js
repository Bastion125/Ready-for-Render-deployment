const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');

/**
 * Створити новий запис особового складу
 */
const createPersonnel = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array()
      });
    }
    
    const { serviceNumber, rank, fullName, position, unit, phone, combatZoneAccess, crewId } = req.body;
    
    // Перевірка унікальності service_number
    const existing = await prisma.personnel.findUnique({
      where: { serviceNumber }
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Особовий склад з таким службовим номером вже існує'
      });
    }
    
    // Перевірка crewId якщо вказано
    if (crewId) {
      const crew = await prisma.crew.findUnique({
        where: { id: crewId }
      });
      if (!crew) {
        return res.status(400).json({
          success: false,
          message: 'Екіпаж не знайдено'
        });
      }
    }
    
    const personnel = await prisma.personnel.create({
      data: {
        serviceNumber,
        rank,
        fullName,
        position,
        unit,
        phone: phone || null,
        combatZoneAccess: combatZoneAccess || false,
        crewId: crewId || null,
        userId: null,
        login: null,
        passwordHash: null
      }
    });
    
    res.status(201).json({
      success: true,
      data: personnel
    });
  } catch (error) {
    console.error('Create personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення особового складу'
    });
  }
};

/**
 * Отримати список особового складу
 */
const getPersonnel = async (req, res) => {
  try {
    const { crewId } = req.query;
    
    const where = {};
    if (crewId) {
      where.crewId = parseInt(crewId);
    }
    
    const personnel = await prisma.personnel.findMany({
      where,
      include: {
        crew: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    console.error('Get personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання особового складу'
    });
  }
};

/**
 * Отримати один запис особового складу
 */
const getPersonnelById = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    
    const personnel = await prisma.personnel.findUnique({
      where: { id },
      include: {
        crew: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true
          }
        }
      }
    });
    
    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: 'Особовий склад не знайдено'
      });
    }
    
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    console.error('Get personnel by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання особового складу'
    });
  }
};

/**
 * Оновити запис особового складу
 */
const updatePersonnel = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    const { serviceNumber, rank, fullName, position, unit, phone, combatZoneAccess, crewId } = req.body;
    
    // Перевірка що запис існує
    const existing = await prisma.personnel.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Особовий склад не знайдено'
      });
    }
    
    // Перевірка унікальності service_number (якщо змінюється)
    if (serviceNumber && serviceNumber !== existing.serviceNumber) {
      const duplicate = await prisma.personnel.findUnique({
        where: { serviceNumber }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Особовий склад з таким службовим номером вже існує'
        });
      }
    }
    
    // Перевірка crewId якщо вказано
    if (crewId) {
      const crew = await prisma.crew.findUnique({
        where: { id: crewId }
      });
      if (!crew) {
        return res.status(400).json({
          success: false,
          message: 'Екіпаж не знайдено'
        });
      }
    }
    
    const updateData = {};
    if (serviceNumber !== undefined) updateData.serviceNumber = serviceNumber;
    if (rank !== undefined) updateData.rank = rank;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (position !== undefined) updateData.position = position;
    if (unit !== undefined) updateData.unit = unit;
    if (phone !== undefined) updateData.phone = phone || null;
    if (combatZoneAccess !== undefined) updateData.combatZoneAccess = combatZoneAccess || false;
    if (crewId !== undefined) updateData.crewId = crewId || null;
    
    const personnel = await prisma.personnel.update({
      where: { id },
      data: updateData
    });
    
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    console.error('Update personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення особового складу'
    });
  }
};

/**
 * Видалити запис особового складу
 */
const deletePersonnel = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    
    const existing = await prisma.personnel.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Особовий склад не знайдено'
      });
    }
    
    await prisma.personnel.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Особовий склад видалено'
    });
  } catch (error) {
    console.error('Delete personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка видалення особового складу'
    });
  }
};

/**
 * Створити акаунт для особового складу
 */
const createAccount = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    const { login, password } = req.body;
    
    // Перевірка що особовий склад існує
    const personnel = await prisma.personnel.findUnique({
      where: { id }
    });
    
    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: 'Особовий склад не знайдено'
      });
    }
    
    // Перевірка що акаунт ще не створено
    if (personnel.userId || personnel.login) {
      return res.status(400).json({
        success: false,
        message: 'Акаунт вже створено для цього особового складу'
      });
    }
    
    // Валідація login та password
    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Login та password обов\'язкові'
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Пароль повинен містити мінімум 8 символів'
      });
    }
    
    // Перевірка унікальності login
    // Перевіряємо чи email (login) вже використовується в users
    const existingUser = await prisma.user.findUnique({
      where: { email: login }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Користувач з таким login вже існує'
      });
    }
    
    // Перевіряємо чи login вже використовується в personnel
    const existingPersonnel = await prisma.personnel.findFirst({
      where: { login }
    });
    
    if (existingPersonnel) {
      return res.status(400).json({
        success: false,
        message: 'Login вже використовується'
      });
    }
    
    // Хешування паролю
    const passwordHash = await bcrypt.hash(password, 10);
    
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
    
    // Використовуємо транзакцію для atomicity
    const updatedPersonnel = await prisma.$transaction(async (tx) => {
      // Створюємо користувача
      const user = await tx.user.create({
        data: {
          email: login, // Використовуємо login як email
          passwordHash,
          roleId: role.id,
          isActive: true
        }
      });
      
      // Оновлюємо особовий склад
      return await tx.personnel.update({
        where: { id },
        data: {
          userId: user.id,
          login,
          passwordHash
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true
            }
          }
        }
      });
    });
    
    res.status(201).json({
      success: true,
      data: updatedPersonnel,
      message: 'Акаунт успішно створено'
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення акаунту'
    });
  }
};

module.exports = {
  createPersonnel,
  getPersonnel,
  getPersonnelById,
  updatePersonnel,
  deletePersonnel,
  createAccount
};

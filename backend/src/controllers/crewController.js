const prisma = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * Створити новий екіпаж
 */
const createCrew = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array()
      });
    }
    
    const { name, uavType, members } = req.body;
    
    // Створюємо екіпаж з членами в транзакції
    const crew = await prisma.$transaction(async (tx) => {
      const newCrew = await tx.crew.create({
        data: {
          name,
          uavType: uavType || null
        }
      });
      
      // Додаємо членів екіпажу якщо вказано
      if (members && Array.isArray(members) && members.length > 0) {
        for (const member of members) {
          const personnelId = typeof member === 'object' ? member.personnelId : member;
          
          // Оновлюємо personnel.crewId
          await tx.personnel.update({
            where: { id: personnelId },
            data: { crewId: newCrew.id }
          });
        }
      }
      
      return newCrew;
    });
    
    // Отримуємо повну інформацію про екіпаж
    const crewWithMembers = await prisma.crew.findUnique({
      where: { id: crew.id },
      include: {
        personnel: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isActive: true
              }
            }
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      data: crewWithMembers
    });
  } catch (error) {
    console.error('Create crew error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення екіпажу'
    });
  }
};

/**
 * Отримати список екіпажів
 */
const getCrews = async (req, res) => {
  try {
    const crews = await prisma.crew.findMany({
      include: {
        personnel: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isActive: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Додаємо кількість членів
    const crewsWithCount = crews.map(crew => ({
      ...crew,
      members_count: crew.personnel?.length || 0
    }));
    
    res.json({
      success: true,
      data: crewsWithCount
    });
  } catch (error) {
    console.error('Get crews error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання екіпажів'
    });
  }
};

/**
 * Отримати один екіпаж
 */
const getCrew = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    
    const crew = await prisma.crew.findUnique({
      where: { id },
      include: {
        personnel: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isActive: true
              }
            }
          }
        }
      }
    });
    
    if (!crew) {
      return res.status(404).json({
        success: false,
        message: 'Екіпаж не знайдено'
      });
    }
    
    res.json({
      success: true,
      data: crew
    });
  } catch (error) {
    console.error('Get crew by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання екіпажу'
    });
  }
};

/**
 * Оновити екіпаж
 */
const updateCrew = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    const { name, uavType, members } = req.body;
    
    const existing = await prisma.crew.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Екіпаж не знайдено'
      });
    }
    
    // Оновлюємо екіпаж та членів в транзакції
    const updatedCrew = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (uavType !== undefined) updateData.uavType = uavType || null;
      
      const crew = await tx.crew.update({
        where: { id },
        data: updateData
      });
      
      // Якщо вказано нових членів - оновлюємо
      if (members !== undefined) {
        // Спочатку видаляємо старих членів (скидаємо crewId)
        await tx.personnel.updateMany({
          where: { crewId: id },
          data: { crewId: null }
        });
        
        // Додаємо нових членів
        if (Array.isArray(members) && members.length > 0) {
          for (const member of members) {
            const personnelId = typeof member === 'object' ? member.personnelId : member;
            await tx.personnel.update({
              where: { id: personnelId },
              data: { crewId: id }
            });
          }
        }
      }
      
      return crew;
    });
    
    // Отримуємо повну інформацію
    const crewWithMembers = await prisma.crew.findUnique({
      where: { id },
      include: {
        personnel: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isActive: true
              }
            }
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: crewWithMembers
    });
  } catch (error) {
    console.error('Update crew error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення екіпажу'
    });
  }
};

/**
 * Видалити екіпаж
 */
const deleteCrew = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    
    const existing = await prisma.crew.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Екіпаж не знайдено'
      });
    }
    
    // Видаляємо екіпаж (personnel.crewId автоматично стане null через onDelete: SetNull)
    await prisma.crew.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Екіпаж видалено'
    });
  } catch (error) {
    console.error('Delete crew error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка видалення екіпажу'
    });
  }
};

module.exports = {
  createCrew,
  getCrews,
  getCrew,
  updateCrew,
  deleteCrew
};

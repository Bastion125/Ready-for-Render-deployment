const prisma = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * Створити новий засіб
 */
const createEquipment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array()
      });
    }
    
    const { name, type, manufacturer, notes, imagePath } = req.body;
    
    const equipment = await prisma.equipment.create({
      data: {
        name,
        type,
        manufacturer: manufacturer || null,
        notes: notes || null,
        imagePath: imagePath || null
      }
    });
    
    res.status(201).json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Create equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення засобу'
    });
  }
};

/**
 * Отримати список засобів
 */
const getEquipment = async (req, res) => {
  try {
    const equipment = await prisma.equipment.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання засобів'
    });
  }
};

/**
 * Отримати один засіб
 */
const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    
    const equipment = await prisma.equipment.findUnique({
      where: { id }
    });
    
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Засіб не знайдено'
      });
    }
    
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Get equipment by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання засобу'
    });
  }
};

/**
 * Оновити засіб
 */
const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    const { name, type, manufacturer, notes, imagePath } = req.body;
    
    const existing = await prisma.equipment.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Засіб не знайдено'
      });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (imagePath !== undefined) updateData.imagePath = imagePath || null;
    
    const equipment = await prisma.equipment.update({
      where: { id },
      data: updateData
    });
    
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення засобу'
    });
  }
};

/**
 * Видалити засіб
 */
const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    
    const existing = await prisma.equipment.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Засіб не знайдено'
      });
    }
    
    await prisma.equipment.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Засіб видалено'
    });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка видалення засобу'
    });
  }
};

module.exports = {
  createEquipment,
  getEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment
};

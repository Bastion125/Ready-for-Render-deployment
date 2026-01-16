const prisma = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * GET /api/knowledge/categories
 */
const getKnowledgeCategories = async (req, res) => {
  try {
    const categories = await prisma.knowledgeCategory.findMany({
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Get knowledge categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання категорій',
    });
  }
};

/**
 * POST /api/knowledge/categories
 */
const createKnowledgeCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array(),
      });
    }

    const { name, description, parent_id, order_index } = req.body;

    if (parent_id) {
      const parent = await prisma.knowledgeCategory.findUnique({ where: { id: parent_id } });
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Батьківська категорія не знайдена',
        });
      }
    }

    const category = await prisma.knowledgeCategory.create({
      data: {
        name,
        description: description || null,
        parentId: parent_id || null,
        orderIndex: typeof order_index === 'number' ? order_index : 0,
      },
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    logger.error('Create knowledge category error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення категорії',
    });
  }
};

/**
 * GET /api/knowledge/materials?category_id=...
 */
const getKnowledgeMaterials = async (req, res) => {
  try {
    const { category_id } = req.query;
    const userRole = req.user?.role;

    const where = {};
    if (category_id) {
      const parsed = Number(category_id);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, message: 'Некоректний category_id' });
      }
      where.categoryId = parsed;
    }

    // User бачить тільки опубліковані матеріали
    if (userRole === 'User') {
      where.isPublished = true;
    }

    const materials = await prisma.knowledgeMaterial.findMany({
      where,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: materials });
  } catch (error) {
    logger.error('Get knowledge materials error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання матеріалів',
    });
  }
};

/**
 * POST /api/knowledge/materials
 */
const createKnowledgeMaterial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array(),
      });
    }

    const {
      category_id,
      title,
      content,
      material_type,
      file_path,
      file_size,
      mime_type,
      avatar_path,
      is_published,
      order_index,
    } = req.body;

    const category = await prisma.knowledgeCategory.findUnique({ where: { id: category_id } });
    if (!category) {
      return res.status(400).json({ success: false, message: 'Категорія не знайдена' });
    }

    const material = await prisma.knowledgeMaterial.create({
      data: {
        categoryId: category_id,
        title,
        content: content || null,
        materialType: material_type,
        filePath: file_path || null,
        fileSize: typeof file_size === 'number' ? file_size : (file_size ? Number(file_size) : null),
        mimeType: mime_type || null,
        avatarPath: avatar_path || null,
        isPublished: typeof is_published === 'boolean' ? is_published : true,
        orderIndex: typeof order_index === 'number' ? order_index : 0,
        createdBy: req.user.id,
      },
    });

    res.status(201).json({ success: true, data: material });
  } catch (error) {
    logger.error('Create knowledge material error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення матеріалу',
    });
  }
};

/**
 * PUT /api/knowledge/materials/:id
 */
const updateKnowledgeMaterial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Помилки валідації',
        errors: errors.array(),
      });
    }

    const id = Number(req.params.id);
    const existing = await prisma.knowledgeMaterial.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Матеріал не знайдено' });
    }

    const {
      category_id,
      title,
      content,
      material_type,
      file_path,
      file_size,
      mime_type,
      avatar_path,
      is_published,
      order_index,
    } = req.body;

    const data = {};
    if (category_id !== undefined) {
      const category = await prisma.knowledgeCategory.findUnique({ where: { id: category_id } });
      if (!category) {
        return res.status(400).json({ success: false, message: 'Категорія не знайдена' });
      }
      data.categoryId = category_id;
    }
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content || null;
    if (material_type !== undefined) data.materialType = material_type;
    if (file_path !== undefined) data.filePath = file_path || null;
    if (file_size !== undefined) data.fileSize = typeof file_size === 'number' ? file_size : (file_size ? Number(file_size) : null);
    if (mime_type !== undefined) data.mimeType = mime_type || null;
    if (avatar_path !== undefined) data.avatarPath = avatar_path || null;
    if (is_published !== undefined) data.isPublished = !!is_published;
    if (order_index !== undefined) data.orderIndex = typeof order_index === 'number' ? order_index : Number(order_index) || 0;

    const updated = await prisma.knowledgeMaterial.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update knowledge material error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення матеріалу',
    });
  }
};

module.exports = {
  getKnowledgeCategories,
  createKnowledgeCategory,
  getKnowledgeMaterials,
  createKnowledgeMaterial,
  updateKnowledgeMaterial,
};

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  getKnowledgeCategories,
  createKnowledgeCategory,
  getKnowledgeMaterials,
  createKnowledgeMaterial,
  updateKnowledgeMaterial,
} = require('../controllers/knowledgeController');

// Валідація для категорій
const categoryValidation = [
  body('name')
    .notEmpty()
    .withMessage('Назва категорії обов\'язкова')
    .isLength({ min: 1, max: 255 })
    .withMessage('Назва має бути від 1 до 255 символів'),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Опис має бути до 5000 символів'),
  body('parent_id')
    .optional()
    .isInt()
    .withMessage('ID батьківської категорії має бути числом'),
  body('order_index')
    .optional()
    .isInt()
    .withMessage('order_index має бути числом'),
];

// Валідація для матеріалів
const materialValidation = [
  body('category_id')
    .notEmpty()
    .withMessage('ID категорії обов\'язковий')
    .isInt()
    .withMessage('ID категорії має бути числом'),
  body('title')
    .notEmpty()
    .withMessage('Назва матеріалу обов\'язкова')
    .isLength({ min: 1, max: 500 })
    .withMessage('Назва має бути від 1 до 500 символів'),
  body('material_type')
    .notEmpty()
    .withMessage('Тип матеріалу обов\'язковий')
    .isIn(['text', 'pdf', 'video'])
    .withMessage('Тип матеріалу має бути: text, pdf або video'),
  body('content')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('Контент має бути до 100000 символів'),
  body('file_path')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Шлях до файлу має бути до 1000 символів'),
  body('avatar_path')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Шлях до аватари має бути до 1000 символів'),
];

// Всі маршрути вимагають авторизації
router.use(authenticate);

// Категорії
router.get('/categories', getKnowledgeCategories);
router.post('/categories',
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  categoryValidation,
  createKnowledgeCategory
);

// Матеріали
router.get('/materials', getKnowledgeMaterials);
router.post('/materials',
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  materialValidation,
  createKnowledgeMaterial
);
router.put('/materials/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  materialValidation,
  updateKnowledgeMaterial
);

module.exports = router;

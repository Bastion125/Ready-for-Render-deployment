const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  createEquipment,
  getEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment
} = require('../controllers/equipmentController');

// Валідація для створення/оновлення засобу
const equipmentValidation = [
  body('name')
    .notEmpty()
    .withMessage('Назва засобу обов\'язкова')
    .isLength({ min: 1, max: 255 })
    .withMessage('Назва має бути від 1 до 255 символів'),
  body('type')
    .notEmpty()
    .withMessage('Тип засобу обов\'язковий')
    .isLength({ min: 1, max: 255 })
    .withMessage('Тип має бути від 1 до 255 символів'),
  body('manufacturer')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Виробник має бути до 255 символів'),
  body('notes')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Примітки мають бути до 5000 символів'),
  body('imagePath')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Шлях до зображення має бути до 500 символів')
];

// Всі маршрути вимагають авторизації
router.use(authenticate);

// CRUD операції
router.post('/', 
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  equipmentValidation,
  createEquipment
);

router.get('/', getEquipment);

router.get('/:id', validateId(), getEquipmentById);

router.put('/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  equipmentValidation,
  updateEquipment
);

router.delete('/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin'),
  deleteEquipment
);

module.exports = router;

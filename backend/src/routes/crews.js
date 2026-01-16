const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  createCrew,
  getCrews,
  getCrew,
  updateCrew,
  deleteCrew
} = require('../controllers/crewController');

// Валідація для створення/оновлення екіпажу
const crewValidation = [
  body('name')
    .notEmpty()
    .withMessage('Назва екіпажу обов\'язкова')
    .isLength({ min: 1, max: 255 })
    .withMessage('Назва має бути від 1 до 255 символів'),
  body('uavType')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Тип БПЛА має бути до 255 символів'),
  body('members')
    .optional()
    .isArray()
    .withMessage('Члени екіпажу мають бути масивом')
];

// Всі маршрути вимагають авторизації
router.use(authenticate);

router.get('/', getCrews);

router.post('/', 
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  crewValidation,
  createCrew
);

router.get('/:id', validateId(), getCrew);

router.put('/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin', 'Readit'),
  crewValidation,
  updateCrew
);

router.delete('/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin'),
  deleteCrew
);

module.exports = router;

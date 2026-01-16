const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  createPersonnel,
  getPersonnel,
  getPersonnelById,
  updatePersonnel,
  deletePersonnel,
  createAccount
} = require('../controllers/personnelController');

/**
 * @swagger
 * tags:
 *   name: Personnel
 *   description: Управління особовим складом
 */

// Валідація для створення особового складу
const personnelValidation = [
  body('serviceNumber')
    .notEmpty()
    .withMessage('Службовий номер обов\'язковий')
    .isLength({ min: 1, max: 50 })
    .withMessage('Службовий номер має бути від 1 до 50 символів'),
  body('rank')
    .notEmpty()
    .withMessage('Військове звання обов\'язкове')
    .isLength({ min: 1, max: 100 })
    .withMessage('Звання має бути від 1 до 100 символів'),
  body('fullName')
    .notEmpty()
    .withMessage('ПІБ обов\'язкове')
    .isLength({ min: 1, max: 255 })
    .withMessage('ПІБ має бути від 1 до 255 символів'),
  body('position')
    .notEmpty()
    .withMessage('Посада обов\'язкова')
    .isLength({ min: 1, max: 255 })
    .withMessage('Посада має бути від 1 до 255 символів'),
  body('unit')
    .notEmpty()
    .withMessage('Підрозділ обов\'язковий')
    .isLength({ min: 1, max: 255 })
    .withMessage('Підрозділ має бути від 1 до 255 символів'),
  body('crewId')
    .optional()
    .isInt()
    .withMessage('ID екіпажу має бути числом'),
  body('phone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Телефон має бути до 50 символів'),
  body('combatZoneAccess')
    .optional()
    .isBoolean()
    .withMessage('Допуск до БЗ має бути boolean')
];

// Валідація для створення акаунту
const accountValidation = [
  body('login')
    .notEmpty()
    .withMessage('Login обов\'язковий')
    .isLength({ min: 3, max: 255 })
    .withMessage('Login має бути від 3 до 255 символів')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Login може містити тільки літери, цифри та підкреслення'),
  body('password')
    .notEmpty()
    .withMessage('Пароль обов\'язковий')
    .isLength({ min: 8 })
    .withMessage('Пароль має містити мінімум 8 символів')
];

// Всі маршрути вимагають авторизації
router.use(authenticate);

/**
 * @swagger
 * /api/personnel:
 *   get:
 *     summary: Отримати список особового складу
 *     tags: [Personnel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список особового складу
 */
router.get('/', getPersonnel);

/**
 * @swagger
 * /api/personnel:
 *   post:
 *     summary: Створити новий запис особового складу
 *     tags: [Personnel]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceNumber
 *               - rank
 *               - fullName
 *               - position
 *               - unit
 *             properties:
 *               serviceNumber:
 *                 type: string
 *               rank:
 *                 type: string
 *               fullName:
 *                 type: string
 *               position:
 *                 type: string
 *               unit:
 *                 type: string
 *               crewId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Особовий склад створено
 */
router.post('/', 
  requireRole('SystemAdmin', 'Admin'),
  personnelValidation,
  createPersonnel
);

/**
 * @swagger
 * /api/personnel/{id}:
 *   get:
 *     summary: Отримати один запис особового складу
 *     tags: [Personnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Запис особового складу
 */
router.get('/:id', validateId(), getPersonnelById);

router.put('/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin'),
  updatePersonnel
);

router.delete('/:id',
  validateId(),
  requireRole('SystemAdmin', 'Admin'),
  deletePersonnel
);

// Створення акаунту
router.post('/:id/create-account',
  validateId(),
  requireRole('SystemAdmin', 'Admin'),
  accountValidation,
  createAccount
);

module.exports = router;

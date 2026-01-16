const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { login, register, getProfile } = require('../controllers/authController');

// Валідація для логіну
const loginValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email обов\'язковий')
    .isEmail()
    .withMessage('Невірний формат email'),
  body('password')
    .notEmpty()
    .withMessage('Пароль обов\'язковий')
];

// Валідація для реєстрації
const registerValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email обов\'язковий')
    .isEmail()
    .withMessage('Невірний формат email'),
  body('password')
    .notEmpty()
    .withMessage('Пароль обов\'язковий')
    .isLength({ min: 8 })
    .withMessage('Пароль має містити мінімум 8 символів'),
  body('fullName')
    .notEmpty()
    .withMessage('ПІБ обов\'язкове')
];

router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);
router.get('/profile', authenticate, getProfile);
router.get('/me', authenticate, getProfile); // Alias for frontend compatibility

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Всі маршрути вимагають авторизації
router.use(authenticate);

/**
 * GET /api/practice/videos
 * Заглушка - повертає порожній масив
 * TODO: Реалізувати повний функціонал
 */
router.get('/videos', (req, res) => {
  res.json({
    success: true,
    data: [],
  });
});

module.exports = router;

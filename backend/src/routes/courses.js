const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse
} = require('../controllers/courseController');

// Всі автентифіковані користувачі можуть читати
router.get('/', authenticate, getCourses);
router.get('/:id', authenticate, validateId(), getCourse);

// Тільки Admin, SystemAdmin можуть створювати та редагувати
router.post('/', 
  authenticate, 
  requireRole('SystemAdmin', 'Admin', 'Readit'), 
  createCourse
);

router.put('/:id', 
  authenticate, 
  validateId(),
  requireRole('SystemAdmin', 'Admin', 'Readit'), 
  updateCourse
);

module.exports = router;

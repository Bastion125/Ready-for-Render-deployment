/**
 * Middleware та утиліти для обробки помилок (Prisma, JWT, валідація тощо)
 */

/**
 * Обробка Prisma помилок (pure-функція)
 */
const handlePrismaError = (error) => {
  // P2002 - Unique constraint violation
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field';
    return {
      status: 400,
      message: `Значення для поля ${field} вже існує`
    };
  }
  
  // P2025 - Record not found
  if (error.code === 'P2025') {
    return {
      status: 404,
      message: 'Запис не знайдено'
    };
  }
  
  // P2003 - Foreign key constraint failed
  if (error.code === 'P2003') {
    return {
      status: 400,
      message: 'Помилка зв\'язку з іншим записом'
    };
  }
  
  // P2014 - Required relation violation
  if (error.code === 'P2014') {
    return {
      status: 400,
      message: 'Помилка зв\'язку між записами'
    };
  }
  
  return null;
};

const logger = require('../config/logger');

/**
 * Prisma error handler middleware
 * Має бути підключений ПЕРЕД глобальним error handler
 */
const prismaErrorHandler = (err, req, res, next) => {
  const prismaError = handlePrismaError(err);

  if (prismaError) {
    return res.status(prismaError.status).json({
      success: false,
      message: prismaError.message,
    });
  }

  // Якщо це не Prisma-помилка — передаємо далі
  return next(err);
};

/**
 * Global error handler middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  // JWT помилки
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Невірний токен авторизації',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Токен авторизації прострочено',
    });
  }

  // Validation помилки (express-validator)
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      success: false,
      message: 'Помилки валідації',
      errors: err.array(),
    });
  }

  // Помилки зі статусом
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message || 'Помилка запиту',
    });
  }

  // Неочікувані помилки
  logger.error('Unhandled error:', { error: err, stack: err.stack });
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Внутрішня помилка сервера'
        : err.message,
  });
};

module.exports = {
  handlePrismaError,
  prismaErrorHandler,
  globalErrorHandler,
};


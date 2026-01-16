/**
 * Middleware для валідації числових ID параметрів
 * Перевіряє що ID є додатнім цілим числом
 */
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: `Параметр ${paramName} відсутній`
      });
    }
    
    const parsedId = parseInt(id, 10);
    
    if (isNaN(parsedId) || parsedId <= 0 || parsedId.toString() !== id) {
      return res.status(400).json({
        success: false,
        message: `Параметр ${paramName} має бути додатнім цілим числом`
      });
    }
    
    // Зберігаємо валідований ID в req.params
    req.params[paramName] = parsedId;
    next();
  };
};

module.exports = validateId;

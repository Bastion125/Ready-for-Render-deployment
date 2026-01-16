// Простий logger з рівнями логування
// Використовується замість прямого console.* для можливості розширення (zапис у файл, зовнішні сервіси тощо)

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (!meta) {
    return base;
  }

  try {
    const metaString = typeof meta === 'string' ? meta : JSON.stringify(meta);
    return `${base} ${metaString}`;
  } catch {
    return base;
  }
};

const info = (message, meta) => {
  // У production можна замінити на інтеграцію з зовнішнім логгером
  console.log(formatMessage('info', message, meta));
};

const warn = (message, meta) => {
  console.warn(formatMessage('warn', message, meta));
};

const error = (message, meta) => {
  console.error(formatMessage('error', message, meta));
};

const debug = (message, meta) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(formatMessage('debug', message, meta));
  }
};

module.exports = {
  info,
  warn,
  error,
  debug,
};


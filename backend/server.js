require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./src/config/logger');
const { prismaErrorHandler, globalErrorHandler } = require('./src/middleware/errorHandler');

// Routes
const authRoutes = require('./src/routes/auth');
const coursesRoutes = require('./src/routes/courses');
const personnelRoutes = require('./src/routes/personnel');
const crewsRoutes = require('./src/routes/crews');
const equipmentRoutes = require('./src/routes/equipment');
const knowledgeRoutes = require('./src/routes/knowledge');
const filesRoutes = require('./src/routes/files');
const practiceRoutes = require('./src/routes/practice');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - має бути ПЕРЕД всіма іншими middleware
// Отримуємо дозволені origins з env або використовуємо дефолтні
const getCorsOrigins = () => {
  if (process.env.CORS_ORIGIN === '*') {
    return true; // Дозволяємо всі origins
  }
  
  const defaultOrigins = [
    'https://bastion125.github.io',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1'
  ];
  
  if (process.env.CORS_ORIGIN) {
    const envOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
    return [...envOrigins, ...defaultOrigins];
  }
  
  return defaultOrigins;
};

// Спрощена CORS конфігурація
app.use(cors({
  origin: getCorsOrigins(),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true
}));

// Явна обробка OPTIONS запитів для CORS preflight (критично для GitHub Pages)
app.options('*', cors());

// Додаткова явна обробка preflight запитів
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    const allowedOrigins = getCorsOrigins();
    
    // Перевіряємо чи origin дозволений
    if (allowedOrigins === true || (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      return res.sendStatus(200);
    }
  }
  next();
});

// Security middleware - після CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (uploads)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Static files from root directory (css, fonts, images, js, app)
// Serve static files from parent directory (project root)
const projectRoot = path.join(__dirname, '..');
app.use('/css', express.static(path.join(projectRoot, 'css')));
app.use('/fonts', express.static(path.join(projectRoot, 'fonts')));
app.use('/images', express.static(path.join(projectRoot, 'images')));
app.use('/js', express.static(path.join(projectRoot, 'js')));
app.use('/app', express.static(path.join(projectRoot, 'app')));

// Serve HTML files from root (must be before API routes)
app.get('*.html', (req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api')) {
    return next();
  }
  const htmlPath = path.join(projectRoot, req.path);
  res.sendFile(htmlPath, (err) => {
    if (err) next();
  });
});

// Serve index.html for root path (must be before API routes)
app.get('/', (req, res, next) => {
  // Skip if it's an API request
  if (req.url.startsWith('/api')) {
    return next();
  }
  // Otherwise serve index.html
  res.sendFile(path.join(projectRoot, 'index.html'), (err) => {
    if (err) next();
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Root endpoint for Railway health check (має бути перед /api routes)
// Note: This is now handled by static file serving above, but kept for API health checks
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Training Recording System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Додатковий root endpoint для Railway
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Database health check endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    const prisma = require('./src/config/database');
    
    // Простий запит до БД для перевірки підключення
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Перевірка кількості таблиць
    const tableCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    res.json({
      success: true,
      message: 'Database connection successful',
      database: {
        connected: true,
        tables: Number(tableCount[0]?.count) || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes - мають бути після health checks
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/crews', crewsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/practice', practiceRoutes);

// Error handling middleware (must be last)
app.use(prismaErrorHandler);
app.use(globalErrorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = app;

// Функція для автоматичного створення адміністратора при першому запуску
async function ensureAdminExists() {
  try {
    const prisma = require('./src/config/database');
    const bcrypt = require('bcrypt');
    
    // Спочатку перевіряємо та створюємо ролі, якщо їх немає
    const roles = [
      { name: 'SystemAdmin', description: 'Системний адміністратор - повний доступ' },
      { name: 'Admin', description: 'Адміністратор - адміністративний доступ' },
      { name: 'Readit', description: 'Інструктор - може створювати курси та матеріали' },
      { name: 'User', description: 'Звичайний користувач - тільки перегляд та проходження курсів' }
    ];
    
    for (const roleData of roles) {
      await prisma.role.upsert({
        where: { name: roleData.name },
        update: {},
        create: roleData
      });
    }
    
    logger.info('✅ Ролі перевірено/створено');
    
    // Перевіряємо чи існує адміністратор
    const systemAdminRole = await prisma.role.findUnique({
      where: { name: 'SystemAdmin' }
    });
    
    if (!systemAdminRole) {
      logger.warn('⚠️ SystemAdmin role not found after creation. Something went wrong.');
      return;
    }
    
    const adminEmail = 'admin@test.local';
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
    
    if (!existingAdmin) {
      // Створюємо адміністратора
      const adminPassword = 'admin123';
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: adminPasswordHash,
          roleId: systemAdminRole.id,
          isActive: true
        }
      });
      
      logger.info('✅ ============================================');
      logger.info('✅ Адміністратор автоматично створено!');
      logger.info('✅ ============================================');
      logger.info(`📧 Email:    ${adminEmail}`);
      logger.info(`🔑 Пароль:   ${adminPassword}`);
      logger.info('👤 Роль:     SystemAdmin (повний доступ)');
      logger.info('✅ ============================================');
    } else {
      logger.info('ℹ️  Адміністратор вже існує');
    }
  } catch (error) {
    logger.error('❌ Помилка при створенні адміністратора:', error);
    // Не зупиняємо сервер, якщо не вдалося створити адміністратора
  }
}

// Start server only when running directly (not when imported by tests)
if (require.main === module) {
  // Спочатку перевіряємо та створюємо адміністратора
  ensureAdminExists().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 Server listening on 0.0.0.0:${PORT}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      }
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

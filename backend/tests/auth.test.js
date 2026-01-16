/**
 * TDD: Тести для авторизації та middleware
 */

const request = require('supertest');
const app = require('../server');
const prisma = require('../src/config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let testUser;
let testAdminRole;
let testUserRole;
let userToken;
let adminToken;

beforeAll(async () => {
  // Очищення
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  
  // Створення ролей
  testUserRole = await prisma.role.create({
    data: { name: 'User', description: 'User role' }
  });
  
  testAdminRole = await prisma.role.create({
    data: { name: 'Admin', description: 'Admin role' }
  });
  
  // Створення тестового користувача
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);
  testUser = await prisma.user.create({
    data: {
      email: 'testuser@test.local',
      passwordHash,
      roleId: testUserRole.id,
      isActive: true
    }
  });
  
  // Створення тестового адміна
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.local',
      passwordHash: adminPasswordHash,
      roleId: testAdminRole.id,
      isActive: true
    }
  });
  
  // Генерація токенів
  userToken = jwt.sign(
    { id: testUser.id, email: testUser.email, roleId: testUserRole.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  adminToken = jwt.sign(
    { id: admin.id, email: admin.email, roleId: testAdminRole.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.$disconnect();
});

describe('Auth Middleware', () => {
  
  describe('authenticate middleware', () => {
    test('Доступ з валідним токеном', async () => {
      const response = await request(app)
        .get('/api/personnel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('Відсутній токен - 401', async () => {
      const response = await request(app)
        .get('/api/personnel')
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('токен');
    });
    
    test('Невірний токен - 401', async () => {
      const response = await request(app)
        .get('/api/personnel')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Прострочений токен - 401', async () => {
      const expiredToken = jwt.sign(
        { id: testUser.id, email: testUser.email, roleId: testUserRole.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );
      
      const response = await request(app)
        .get('/api/personnel')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Неактивний користувач - 401', async () => {
      // Деактивуємо користувача
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false }
      });
      
      const response = await request(app)
        .get('/api/personnel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      
      // Повертаємо активність
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: true }
      });
    });
  });
  
  describe('requireRole middleware', () => {
    test('User не може створювати personnel - 403', async () => {
      const response = await request(app)
        .post('/api/personnel')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          serviceNumber: 'SN-TEST',
          rank: 'Сержант',
          fullName: 'Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        })
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('прав');
    });
    
    test('Admin може створювати personnel - 201', async () => {
      const response = await request(app)
        .post('/api/personnel')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serviceNumber: 'SN-ADMIN-TEST',
          rank: 'Сержант',
          fullName: 'Адмін Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        })
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      // Очищення
      await prisma.personnel.deleteMany({
        where: { serviceNumber: 'SN-ADMIN-TEST' }
      });
    });
  });
  
  describe('POST /api/auth/login', () => {
    test('Успішний логін', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@test.local',
          password: 'TestPassword123!'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('testuser@test.local');
    });
    
    test('Невірний пароль - 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@test.local',
          password: 'WrongPassword'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Невірний email - 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.local',
          password: 'TestPassword123!'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Валідація: відсутній email - 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'TestPassword123!'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/register', () => {
    test('Успішна реєстрація', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.local',
          password: 'NewPassword123!',
          fullName: 'Новий Користувач'
        })
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      
      // Очищення
      await prisma.user.delete({
        where: { email: 'newuser@test.local' }
      });
    });
    
    test('Реєстрація з існуючим email - 400', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'testuser@test.local',
          password: 'NewPassword123!',
          fullName: 'Тест'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Валідація: короткий пароль - 400', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'shortpass@test.local',
          password: '123',
          fullName: 'Тест'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/auth/profile', () => {
    test('Отримання профілю з валідним токеном', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('role');
    });
    
    test('Отримання профілю без токену - 401', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
  });
});

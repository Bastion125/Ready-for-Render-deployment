/**
 * TDD: Тести для CRUD операцій з особовим складом
 * RED фаза - тести пишуться ПЕРЕД реалізацією
 */

const request = require('supertest');
const app = require('../server');
const prisma = require('../src/config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Тестова БД або ізольована сесія
let testUser;
let authToken;
let testCrew;
let testUnit;

// Налаштування перед тестами
beforeAll(async () => {
  // Очищення тестової БД
  await prisma.courseAssignment.deleteMany();
  await prisma.personnel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.crew.deleteMany();
  await prisma.role.deleteMany();
  
  // Створення тестової ролі
  const role = await prisma.role.create({
    data: {
      name: 'SystemAdmin',
      description: 'System Administrator'
    }
  });
  
  // Створення тестового користувача
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);
  testUser = await prisma.user.create({
    data: {
      email: 'admin@test.local',
      passwordHash,
      roleId: role.id,
      isActive: true
    }
  });
  
  // Генерація JWT токену
  authToken = jwt.sign(
    { id: testUser.id, email: testUser.email, roleId: role.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  // Створення тестового екіпажу
  testCrew = await prisma.crew.create({
    data: {
      name: 'Тестовий екіпаж',
      uavType: 'Test UAV'
    }
  });
});

// Очищення після тестів
afterAll(async () => {
  await prisma.courseAssignment.deleteMany();
  await prisma.personnel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.crew.deleteMany();
  await prisma.role.deleteMany();
  await prisma.$disconnect();
});

describe('Personnel API - CRUD Operations', () => {
  
  describe('POST /api/personnel', () => {
    test('Створення нового особового складу (успішно)', async () => {
      const personnelData = {
        serviceNumber: 'SN-001',
        rank: 'Сержант',
        fullName: 'Іван Іванович Іванов',
        position: 'Оператор БПЛА',
        unit: 'Підрозділ 1',
        crewId: testCrew.id
      };
      
      const response = await request(app)
        .post('/api/personnel')
        .set('Authorization', `Bearer ${authToken}`)
        .send(personnelData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.serviceNumber).toBe(personnelData.serviceNumber);
      expect(response.body.data.fullName).toBe(personnelData.fullName);
      expect(response.body.data.userId).toBeNull(); // Спочатку без акаунту
      expect(response.body.data.login).toBeNull();
    });
    
    test('Валідація: обов\'язкові поля', async () => {
      const response = await request(app)
        .post('/api/personnel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Відсутні обов'язкові поля
          rank: 'Сержант'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Валідація: унікальність service_number', async () => {
      // Створюємо перший запис
      await request(app)
        .post('/api/personnel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serviceNumber: 'SN-002',
          rank: 'Сержант',
          fullName: 'Петро Петрович Петров',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        });
      
      // Спробуємо створити з таким самим service_number
      const response = await request(app)
        .post('/api/personnel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serviceNumber: 'SN-002',
          rank: 'Старший сержант',
          fullName: 'Інший ПІБ',
          position: 'Оператор',
          unit: 'Підрозділ 2'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    test('Авторизація: без токену - 401', async () => {
      const response = await request(app)
        .post('/api/personnel')
        .send({
          serviceNumber: 'SN-003',
          rank: 'Сержант',
          fullName: 'Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/personnel', () => {
    test('Отримання списку особового складу', async () => {
      // Створюємо кілька записів
      await prisma.personnel.createMany({
        data: [
          {
            serviceNumber: 'SN-100',
            rank: 'Сержант',
            fullName: 'Олексій Олексійович Олексієв',
            position: 'Оператор',
            unit: 'Підрозділ 1',
            crewId: testCrew.id
          },
          {
            serviceNumber: 'SN-101',
            rank: 'Старший сержант',
            fullName: 'Василь Васильович Василенко',
            position: 'Командир',
            unit: 'Підрозділ 2',
            crewId: testCrew.id
          }
        ]
      });
      
      const response = await request(app)
        .get('/api/personnel')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      
      // Перевірка структури
      const firstPerson = response.body.data[0];
      expect(firstPerson).toHaveProperty('id');
      expect(firstPerson).toHaveProperty('serviceNumber');
      expect(firstPerson).toHaveProperty('rank');
      expect(firstPerson).toHaveProperty('fullName');
      expect(firstPerson).toHaveProperty('position');
      expect(firstPerson).toHaveProperty('unit');
      expect(firstPerson).toHaveProperty('crewId');
      expect(firstPerson).toHaveProperty('userId');
      expect(firstPerson).toHaveProperty('login');
    });
    
    test('Фільтрація за екіпажем', async () => {
      const response = await request(app)
        .get('/api/personnel')
        .query({ crewId: testCrew.id })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      response.body.data.forEach(person => {
        expect(person.crewId).toBe(testCrew.id);
      });
    });
  });
  
  describe('GET /api/personnel/:id', () => {
    test('Отримання одного запису', async () => {
      const personnel = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-200',
          rank: 'Сержант',
          fullName: 'Тест Тестович Тестовий',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        }
      });
      
      const response = await request(app)
        .get(`/api/personnel/${personnel.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(personnel.id);
      expect(response.body.data.serviceNumber).toBe('SN-200');
    });
    
    test('404 для неіснуючого запису', async () => {
      const response = await request(app)
        .get('/api/personnel/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/personnel/:id', () => {
    test('Оновлення запису', async () => {
      const personnel = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-300',
          rank: 'Сержант',
          fullName: 'Оновлюваний Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        }
      });
      
      const updateData = {
        rank: 'Старший сержант',
        position: 'Старший оператор',
        unit: 'Підрозділ 2'
      };
      
      const response = await request(app)
        .put(`/api/personnel/${personnel.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.rank).toBe(updateData.rank);
      expect(response.body.data.position).toBe(updateData.position);
      expect(response.body.data.unit).toBe(updateData.unit);
    });
    
    test('404 для неіснуючого запису', async () => {
      const response = await request(app)
        .put('/api/personnel/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rank: 'Сержант' })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/personnel/:id', () => {
    test('Видалення запису', async () => {
      const personnel = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-400',
          rank: 'Сержант',
          fullName: 'Видалюваний Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        }
      });
      
      const response = await request(app)
        .delete(`/api/personnel/${personnel.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Перевірка що запис видалено
      const deleted = await prisma.personnel.findUnique({
        where: { id: personnel.id }
      });
      expect(deleted).toBeNull();
    });
    
    test('404 для неіснуючого запису', async () => {
      const response = await request(app)
        .delete('/api/personnel/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/personnel/:id/create-account', () => {
    test('Створення акаунту для особового складу', async () => {
      const personnel = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-500',
          rank: 'Сержант',
          fullName: 'Акаунт Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        }
      });
      
      const accountData = {
        login: 'testuser',
        password: 'TestPassword123!'
      };
      
      const response = await request(app)
        .post(`/api/personnel/${personnel.id}/create-account`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data.login).toBe(accountData.login);
      
      // Перевірка що user створено
      const updatedPersonnel = await prisma.personnel.findUnique({
        where: { id: personnel.id },
        include: { user: true }
      });
      
      expect(updatedPersonnel.userId).not.toBeNull();
      expect(updatedPersonnel.login).toBe(accountData.login);
      expect(updatedPersonnel.passwordHash).not.toBeNull();
      
      // Перевірка що пароль захешований
      const passwordMatch = await bcrypt.compare(
        accountData.password,
        updatedPersonnel.passwordHash
      );
      expect(passwordMatch).toBe(true);
    });
    
    test('Валідація: унікальність login', async () => {
      const personnel1 = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-501',
          rank: 'Сержант',
          fullName: 'Перший Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        }
      });
      
      const personnel2 = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-502',
          rank: 'Сержант',
          fullName: 'Другий Тест',
          position: 'Оператор',
          unit: 'Підрозділ 1'
        }
      });
      
      // Створюємо акаунт для першого
      await request(app)
        .post(`/api/personnel/${personnel1.id}/create-account`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ login: 'uniqueuser', password: 'Test123!' });
      
      // Спробуємо створити з таким самим login
      const response = await request(app)
        .post(`/api/personnel/${personnel2.id}/create-account`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ login: 'uniqueuser', password: 'Test123!' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    test('404 для неіснуючого особового складу', async () => {
      const response = await request(app)
        .post('/api/personnel/99999/create-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ login: 'test', password: 'Test123!' })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    test('400 якщо акаунт вже створено', async () => {
      const personnel = await prisma.personnel.create({
        data: {
          serviceNumber: 'SN-503',
          rank: 'Сержант',
          fullName: 'Вже має акаунт',
          position: 'Оператор',
          unit: 'Підрозділ 1',
          userId: testUser.id,
          login: 'existinguser',
          passwordHash: 'hash'
        }
      });
      
      const response = await request(app)
        .post(`/api/personnel/${personnel.id}/create-account`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ login: 'newuser', password: 'Test123!' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
});

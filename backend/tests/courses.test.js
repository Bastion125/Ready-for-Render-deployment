/**
 * TDD: Тести для курсів
 * Перевірка правильного порядку, групування та доступу
 */

const request = require('supertest');
const app = require('../server');
const prisma = require('../src/config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let testUser;
let testUserRole;
let testAdminRole;
let authToken;
let testCourses = [];

beforeAll(async () => {
  // Очищення
  await prisma.courseAssignment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.courseModule.deleteMany();
  await prisma.course.deleteMany();
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
      email: 'user@test.local',
      passwordHash,
      roleId: testUserRole.id,
      isActive: true
    }
  });
  
  // Генерація JWT токену
  authToken = jwt.sign(
    { id: testUser.id, email: testUser.email, roleId: testUserRole.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  // Створення тестових курсів з різними order_index
  testCourses = await Promise.all([
    prisma.course.create({
      data: {
        title: 'Курс 1 (order: 0)',
        description: 'Перший курс',
        orderIndex: 0,
        isPublished: true,
        createdBy: testUser.id
      }
    }),
    prisma.course.create({
      data: {
        title: 'Курс 2 (order: 1)',
        description: 'Другий курс',
        orderIndex: 1,
        isPublished: true,
        createdBy: testUser.id
      }
    }),
    prisma.course.create({
      data: {
        title: 'Курс 3 (order: 2)',
        description: 'Третій курс',
        orderIndex: 2,
        isPublished: true,
        createdBy: testUser.id
      }
    }),
    prisma.course.create({
      data: {
        title: 'Неопублікований курс',
        description: 'Невидимий для User',
        orderIndex: 3,
        isPublished: false,
        createdBy: testUser.id
      }
    })
  ]);
});

afterAll(async () => {
  await prisma.courseAssignment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.courseModule.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.$disconnect();
});

describe('Courses API - Order and Access', () => {
  
  describe('GET /api/courses', () => {
    test('Курси повертаються в правильному порядку (order_index)', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Перевірка порядку
      const courses = response.body.data;
      for (let i = 1; i < courses.length; i++) {
        expect(courses[i].orderIndex).toBeGreaterThanOrEqual(courses[i - 1].orderIndex);
      }
      
      // Перевірка що перший курс має orderIndex 0
      expect(courses[0].orderIndex).toBe(0);
    });
    
    test('User бачить тільки опубліковані курси', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const courses = response.body.data;
      courses.forEach(course => {
        expect(course.isPublished).toBe(true);
      });
      
      // Перевірка що неопублікований курс відсутній
      const unpublished = courses.find(c => c.title === 'Неопублікований курс');
      expect(unpublished).toBeUndefined();
    });
    
    test('Admin бачить всі курси (включно з неопублікованими)', async () => {
      // Створюємо адміна
      const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
      const admin = await prisma.user.create({
        data: {
          email: 'admin@test.local',
          passwordHash: adminPasswordHash,
          roleId: testAdminRole.id,
          isActive: true
        }
      });
      
      const adminToken = jwt.sign(
        { id: admin.id, email: admin.email, roleId: testAdminRole.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const courses = response.body.data;
      const unpublished = courses.find(c => c.title === 'Неопублікований курс');
      expect(unpublished).toBeDefined();
      expect(unpublished.isPublished).toBe(false);
      
      // Очищення
      await prisma.user.delete({ where: { id: admin.id } });
    });
    
    test('Курси мають правильну структуру відповіді', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      if (response.body.data.length > 0) {
        const course = response.body.data[0];
        expect(course).toHaveProperty('id');
        expect(course).toHaveProperty('title');
        expect(course).toHaveProperty('description');
        expect(course).toHaveProperty('orderIndex');
        expect(course).toHaveProperty('isPublished');
        expect(course).toHaveProperty('createdAt');
      }
    });
    
    test('Курси з requires_previous_course_id мають правильну логіку доступу', async () => {
      // Створюємо курс з вимогою попереднього
      const prerequisiteCourse = testCourses[0];
      const dependentCourse = await prisma.course.create({
        data: {
          title: 'Залежний курс',
          description: 'Потребує попереднього курсу',
          orderIndex: 10,
          isPublished: true,
          requiresPreviousCourseId: prerequisiteCourse.id,
          createdBy: testUser.id
        }
      });
      
      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const courses = response.body.data;
      const dependent = courses.find(c => c.id === dependentCourse.id);
      
      expect(dependent).toBeDefined();
      expect(dependent.requiresPreviousCourseId).toBe(prerequisiteCourse.id);
      
      // Очищення
      await prisma.course.delete({ where: { id: dependentCourse.id } });
    });
  });
  
  describe('GET /api/courses/:id', () => {
    test('Отримання одного курсу з модулями', async () => {
      // Створюємо курс з модулями
      const course = await prisma.course.create({
        data: {
          title: 'Курс з модулями',
          description: 'Тестовий курс',
          orderIndex: 100,
          isPublished: true,
          createdBy: testUser.id,
          modules: {
            create: [
              {
                title: 'Модуль 1',
                orderIndex: 0
              },
              {
                title: 'Модуль 2',
                orderIndex: 1
              }
            ]
          }
        }
      });
      
      const response = await request(app)
        .get(`/api/courses/${course.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', course.id);
      expect(response.body.data).toHaveProperty('modules');
      expect(Array.isArray(response.body.data.modules)).toBe(true);
      expect(response.body.data.modules.length).toBe(2);
      
      // Перевірка порядку модулів
      expect(response.body.data.modules[0].orderIndex).toBeLessThan(
        response.body.data.modules[1].orderIndex
      );
      
      // Очищення
      await prisma.courseModule.deleteMany({ where: { courseId: course.id } });
      await prisma.course.delete({ where: { id: course.id } });
    });
    
    test('404 для неіснуючого курсу', async () => {
      const response = await request(app)
        .get('/api/courses/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    test('User не може отримати неопублікований курс', async () => {
      const unpublishedCourse = testCourses.find(c => !c.isPublished);
      
      const response = await request(app)
        .get(`/api/courses/${unpublishedCourse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
});

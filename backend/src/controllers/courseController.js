const prisma = require('../config/database');

/**
 * Отримати курси з правильним порядком та доступністю
 */
const getCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Базовий where для фільтрації
    const where = {};
    
    // User бачить тільки опубліковані курси
    if (userRole === 'User') {
      where.isPublished = true;
    }
    
    // Отримуємо курси з правильним порядком
    const courses = await prisma.course.findMany({
      where,
      include: {
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    // Отримуємо personnelId для користувача (якщо є)
    let personnelId = null;
    if (userRole === 'User') {
      const personnel = await prisma.personnel.findFirst({
        where: { userId },
        select: { id: true }
      });
      personnelId = personnel?.id || null;
    }
    
    // Додаємо інформацію про прогрес та доступність
    const coursesWithAccess = await Promise.all(
      courses.map(async (course) => {
        // Перевірка доступу до курсу
        let canAccess = true;
        
        // Адміни та інші ролі мають доступ до всіх курсів
        if (userRole !== 'User') {
          canAccess = true;
        } else {
          // Для User перевіряємо через CourseAssignment
          if (personnelId) {
            const assignment = await prisma.courseAssignment.findUnique({
              where: {
                personnelId_courseId: {
                  personnelId,
                  courseId: course.id
                }
              }
            });
            
            // Користувач має доступ тільки якщо є призначення
            canAccess = !!assignment;
          } else {
            // Якщо немає personnelId, немає доступу
            canAccess = false;
          }
          
          // Якщо курс потребує попереднього курсу, перевіряємо його завершення
          if (canAccess && course.requiresPreviousCourseId && personnelId) {
            const previousAssignment = await prisma.courseAssignment.findUnique({
              where: {
                personnelId_courseId: {
                  personnelId,
                  courseId: course.requiresPreviousCourseId
                }
              }
            });
            
            // Попередній курс повинен бути завершено
            canAccess = previousAssignment?.status === 'completed';
          }
        }
        
        // Підрахунок модулів та уроків
        const modulesCount = course.modules?.length || 0;
        let lessonsCount = 0;
        course.modules?.forEach(module => {
          lessonsCount += module.lessons?.length || 0;
        });
        
        return {
          id: course.id,
          title: course.title,
          description: course.description,
          content: course.content,
          orderIndex: course.orderIndex,
          isPublished: course.isPublished,
          requiresPreviousCourseId: course.requiresPreviousCourseId,
          canAccess,
          modulesCount,
          lessonsCount,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt
        };
      })
    );
    
    res.json({
      success: true,
      data: coursesWithAccess
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання курсів'
    });
  }
};

/**
 * Отримати один курс з модулями та уроками
 */
const getCourse = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Курс не знайдено'
      });
    }
    
    // User не може отримати неопублікований курс
    if (userRole === 'User' && !course.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Курс не знайдено'
      });
    }
    
    // Перевірка доступу
    let canAccess = true;
    
    // Адміни та інші ролі мають доступ до всіх курсів
    if (userRole !== 'User') {
      canAccess = true;
    } else {
      // Для User перевіряємо через CourseAssignment
      const personnel = await prisma.personnel.findFirst({
        where: { userId },
        select: { id: true }
      });
      
      if (personnel) {
        const assignment = await prisma.courseAssignment.findUnique({
          where: {
            personnelId_courseId: {
              personnelId: personnel.id,
              courseId: id
            }
          }
        });
        
        // Користувач має доступ тільки якщо є призначення
        canAccess = !!assignment;
        
        // Якщо курс потребує попереднього курсу, перевіряємо його завершення
        if (canAccess && course.requiresPreviousCourseId) {
          const previousAssignment = await prisma.courseAssignment.findUnique({
            where: {
              personnelId_courseId: {
                personnelId: personnel.id,
                courseId: course.requiresPreviousCourseId
              }
            }
          });
          
          // Попередній курс повинен бути завершено
          canAccess = previousAssignment?.status === 'completed';
        }
      } else {
        // Якщо немає personnel, немає доступу
        canAccess = false;
      }
    }
    
    res.json({
      success: true,
      data: {
        ...course,
        canAccess
      }
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання курсу'
    });
  }
};

/**
 * Створити новий курс
 */
const createCourse = async (req, res) => {
  try {
    const { title, description, content, orderIndex, requiresPreviousCourseId } = req.body;
    
    const course = await prisma.course.create({
      data: {
        title,
        description,
        content: content || null,
        orderIndex: orderIndex || 0,
        requiresPreviousCourseId: requiresPreviousCourseId || null,
        createdBy: req.user.id,
        isPublished: false
      }
    });
    
    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення курсу'
    });
  }
};

/**
 * Оновити курс
 */
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params; // Вже валідовано через middleware
    const { title, description, content, orderIndex, isPublished, requiresPreviousCourseId } = req.body;
    
    const existing = await prisma.course.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Курс не знайдено'
      });
    }
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (requiresPreviousCourseId !== undefined) {
      updateData.requiresPreviousCourseId = requiresPreviousCourseId || null;
    }
    
    const course = await prisma.course.update({
      where: { id },
      data: updateData
    });
    
    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення курсу'
    });
  }
};

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse
};

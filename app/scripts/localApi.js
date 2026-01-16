// Локальний API для роботи з SQL.js замість backend сервера

// Функція для отримання екземпляра БД
function getDb() {
    // Спочатку перевіряємо локальну змінну db (якщо вона доступна в цьому контексті)
    if (typeof db !== 'undefined' && db !== null) {
        return db;
    }
    // Потім перевіряємо глобальну змінну window.db напряму (без рекурсії)
    if (typeof window !== 'undefined' && window.db !== null && window.db !== undefined) {
        return window.db;
    }
    // Якщо БД не ініціалізована, викидаємо помилку з підказкою
    throw new Error('База даних не ініціалізована. Переконайтеся, що initDatabase() викликано перед використанням API.');
}

// Автентифікація
const localAuth = {
    async register(data) {
        const { full_name, email, password } = data;
        const db = getDb();
        
        // Перевірка чи існує користувач
        const stmt = db.prepare("SELECT id FROM users WHERE email = ?");
        stmt.bind([email]);
        if (stmt.step()) {
            stmt.free();
            throw new Error('Користувач з таким email вже існує');
        }
        stmt.free();
        
        // Хешування пароля
        const passwordHash = await hashPassword(password);
        
        // Перевірка наявності колонки password
        let hasPasswordField = false;
        try {
            const tableInfo = db.exec("PRAGMA table_info(users)");
            if (tableInfo[0]) {
                hasPasswordField = tableInfo[0].values.some(row => row[1] === 'password');
            }
        } catch (e) {
            // Якщо не вдалося перевірити, просто не додаємо
        }
        
        // Створення користувача
        if (hasPasswordField) {
            const insertStmt = db.prepare("INSERT INTO users (full_name, email, password_hash, password, role) VALUES (?, ?, ?, ?, 'User')");
            insertStmt.run([full_name, email, passwordHash, password]);
            insertStmt.free();
        } else {
            const insertStmt = db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'User')");
            insertStmt.run([full_name, email, passwordHash]);
            insertStmt.free();
        }
        
        const selectStmt = db.prepare("SELECT id, full_name, email, role FROM users WHERE email = ?");
        selectStmt.bind([email]);
        selectStmt.step();
        const row = selectStmt.getAsObject();
        selectStmt.free();
        
        const user = {
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            role: row.role
        };
        
        // Створення сесії
        const token = generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const dbInstance = getDb();
        dbInstance.run(
            "INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
            [user.id, token, expiresAt.toISOString()]
        );
        
        // Оновлення last_login
        dbInstance.run(
            "UPDATE users SET last_login = datetime('now'), last_activity = datetime('now') WHERE id = ?",
            [user.id]
        );
        
        saveDatabase();
        
        return {
            success: true,
            user,
            token
        };
    },
    
    async login(data) {
        const { email, password } = data;
        const db = getDb();
        
        // Пошук користувача
        const stmt = db.prepare("SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = ?");
        stmt.bind([email]);
        if (!stmt.step()) {
            stmt.free();
            throw new Error('Невірний email або пароль');
        }
        
        const row = stmt.getAsObject();
        stmt.free();
        
        if (!row.is_active) {
            throw new Error('Акаунт деактивовано');
        }
        
        // Перевірка пароля
        const isValid = await verifyPassword(password, row.password_hash);
        if (!isValid) {
            throw new Error('Невірний email або пароль');
        }
        
        const user = {
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            role: row.role
        };
        
        // Створення сесії
        const token = generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const sessionStmt = db.prepare("INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)");
        sessionStmt.run([user.id, token, expiresAt.toISOString()]);
        sessionStmt.free();
        
        // Оновлення last_login
        const updateStmt = db.prepare("UPDATE users SET last_login = datetime('now'), last_activity = datetime('now') WHERE id = ?");
        updateStmt.run([user.id]);
        updateStmt.free();
        
        saveDatabase();
        
        return {
            success: true,
            user,
            token
        };
    },
    
    async logout(token) {
        const db = getDb();
        if (token) {
            const stmt = db.prepare("DELETE FROM sessions WHERE session_token = ?");
            stmt.run([token]);
            stmt.free();
            saveDatabase();
        }
        return { success: true };
    },
    
    async getCurrentUser(token) {
        if (!token) {
            throw new Error('Токен відсутній');
        }
        const db = getDb();
        
        // Перевірка сесії
        const sessionStmt = db.prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ? AND expires_at > datetime('now')");
        sessionStmt.bind([token]);
        if (!sessionStmt.step()) {
            sessionStmt.free();
            throw new Error('Сесія недійсна');
        }
        
        const sessionRow = sessionStmt.getAsObject();
        const userId = sessionRow.user_id;
        sessionStmt.free();
        
        // Оновлення активності сесії
        const updateSessionStmt = db.prepare("UPDATE sessions SET last_activity = datetime('now') WHERE session_token = ?");
        updateSessionStmt.run([token]);
        updateSessionStmt.free();
        
        // Отримання користувача
        const userStmt = db.prepare("SELECT id, full_name, email, role, is_active FROM users WHERE id = ?");
        userStmt.bind([userId]);
        if (!userStmt.step()) {
            userStmt.free();
            throw new Error('Користувач не знайдений');
        }
        
        const userRow = userStmt.getAsObject();
        userStmt.free();

        // Оновлюємо last_activity користувача для коректного відображення в адмінці
        try {
            const updateUserStmt = getDb().prepare("UPDATE users SET last_activity = datetime('now') WHERE id = ?");
            updateUserStmt.run([userId]);
            updateUserStmt.free();
        } catch (e) {
            console.warn('Could not update user last_activity:', e);
        }

        return {
            success: true,
            user: {
                id: userRow.id,
                full_name: userRow.full_name,
                email: userRow.email,
                role: userRow.role,
                is_active: userRow.is_active
            }
        };
    }
};

// База знань
const localKnowledge = {
    async getCategories() {
        const db = getDb();
        const result = db.exec("SELECT * FROM knowledge_categories ORDER BY order_index, name");
        const categories = result.length > 0 && result[0] ? result[0].values.map(row => ({
            id: row[0],
            name: row[1],
            description: row[2],
            parent_id: row[3],
            order_index: row[4],
            created_at: row[5]
        })) : [];
        
        return { success: true, data: categories };
    },
    
    async getMaterials(categoryId = null) {
        const db = getDb();
        let query = "SELECT * FROM knowledge_materials WHERE is_published = 1";
        
        if (categoryId) {
            query += " AND category_id = " + categoryId;
        }
        
        query += " ORDER BY order_index, created_at DESC";
        
        const result = db.exec(query);
        const materials = result.length > 0 && result[0] ? result[0].values.map(row => {
            // Визначаємо структуру рядка - може бути різна кількість колонок
            const colCount = row.length;
            return {
                id: row[0],
                category_id: colCount > 1 ? row[1] : null,
                title: colCount > 2 ? (row[2] || '') : '',
                content: colCount > 3 ? (row[3] || '') : '', // Важливо: content може бути null
                material_type: colCount > 4 ? (row[4] || 'text') : 'text',
                file_path: colCount > 5 ? row[5] : null,
                file_data: colCount > 6 ? row[6] : null,
                file_size: colCount > 7 ? (row[7] || 0) : 0,
                mime_type: colCount > 8 ? row[8] : null,
                created_by: colCount > 9 ? row[9] : null,
                is_published: colCount > 10 ? (row[10] || 1) : 1,
                order_index: colCount > 11 ? (row[11] || 0) : 0,
                created_at: colCount > 12 ? row[12] : null
            };
        }) : [];
        
        return { success: true, data: materials };
    },
    
    async createMaterial(data, userId) {
        const db = getDb();
        const { category_id, title, content, material_type, file_path, file_size, mime_type, avatar_path, avatar_data } = data;
        
        // Перевірка наявності колонок avatar_path та avatar_data
        let hasAvatarPath = false;
        let hasAvatarData = false;
        try {
            const tableInfo = db.exec("PRAGMA table_info(knowledge_materials)");
            if (tableInfo[0]) {
                hasAvatarPath = tableInfo[0].values.some(row => row[1] === 'avatar_path');
                hasAvatarData = tableInfo[0].values.some(row => row[1] === 'avatar_data');
            }
        } catch (e) {
            // Якщо не вдалося перевірити, просто не додаємо
        }
        
        let stmt;
        if (hasAvatarPath || hasAvatarData) {
            stmt = db.prepare(
                `INSERT INTO knowledge_materials 
                 (category_id, title, content, material_type, file_path, file_size, mime_type, created_by, is_published${hasAvatarPath ? ', avatar_path' : ''}${hasAvatarData ? ', avatar_data' : ''})
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1${hasAvatarPath ? ', ?' : ''}${hasAvatarData ? ', ?' : ''})`
            );
            const params = [category_id, title, content || '', material_type, file_path || '', file_size || 0, mime_type || '', userId];
            if (hasAvatarPath) params.push(avatar_path || '');
            if (hasAvatarData) params.push(avatar_data || null);
            stmt.run(params);
        } else {
            stmt = db.prepare(
                `INSERT INTO knowledge_materials 
                 (category_id, title, content, material_type, file_path, file_size, mime_type, created_by, is_published)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
            );
            stmt.run([category_id, title, content || '', material_type, file_path || '', file_size || 0, mime_type || '', userId]);
        }
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        const result = db.exec("SELECT * FROM knowledge_materials WHERE id = " + lastId);
        const material = result[0].values[0];
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: material[0],
                category_id: material[1],
                title: material[2],
                content: material[3],
                material_type: material[4]
            }
        };
    },
    
    async updateMaterial(materialId, data) {
        const { title, content, category_id, is_published } = data;
        
        const updates = [];
        const params = [];
        
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (category_id !== undefined) {
            updates.push('category_id = ?');
            params.push(category_id);
        }
        if (is_published !== undefined) {
            updates.push('is_published = ?');
            params.push(is_published ? 1 : 0);
        }
        
        // Перевірка наявності колонок avatar_path та avatar_data
        try {
            const tableInfo = db.exec("PRAGMA table_info(knowledge_materials)");
            if (tableInfo[0]) {
                const hasAvatarPath = tableInfo[0].values.some(row => row[1] === 'avatar_path');
                const hasAvatarData = tableInfo[0].values.some(row => row[1] === 'avatar_data');
                
                if (hasAvatarPath && avatar_path !== undefined) {
                    updates.push('avatar_path = ?');
                    params.push(avatar_path);
                }
                if (hasAvatarData && avatar_data !== undefined) {
                    updates.push('avatar_data = ?');
                    params.push(avatar_data);
                }
                
                const hasUpdatedAt = tableInfo[0].values.some(row => row[1] === 'updated_at');
                if (hasUpdatedAt) {
                    updates.push("updated_at = datetime('now')");
                }
            }
        } catch (e) {
            // Якщо не вдалося перевірити, просто не додаємо
        }
        
        if (updates.length === 0) {
            return { success: true };
        }
        
        params.push(materialId);
        
        const stmt = db.prepare(`UPDATE knowledge_materials SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(params);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    },
    
    async createCategory(data) {
        const { name, description, parent_id } = data;
        
        const stmt = db.prepare(
            `INSERT INTO knowledge_categories (name, description, parent_id, order_index)
             VALUES (?, ?, ?, 0)`
        );
        stmt.run([name, description || '', parent_id || null]);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        const result = db.exec("SELECT * FROM knowledge_categories WHERE id = " + lastId);
        const category = result[0].values[0];
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: category[0],
                name: category[1],
                description: category[2],
                parent_id: category[3]
            }
        };
    }
};

// Курси
const localCourses = {
    async getCourses(userRole = 'User') {
        let query = "SELECT * FROM courses";
        if (userRole === 'User') {
            query += " WHERE is_published = 1";
        }
        query += " ORDER BY order_index, created_at DESC";
        
        const result = db.exec(query);
        const courses = result.length > 0 && result[0] ? result[0].values.map(row => {
            const courseId = row[0];
            
            // Підрахунок модулів
            let modulesCount = 0;
            let lessonsCount = 0;
            let participantsCount = 0;
            
            try {
                const modulesResult = db.exec(`SELECT COUNT(*) FROM course_modules WHERE course_id = ${courseId}`);
                if (modulesResult.length > 0 && modulesResult[0].values.length > 0) {
                    modulesCount = modulesResult[0].values[0][0] || 0;
                }
                
                // Підрахунок уроків через модулі
                if (modulesCount > 0) {
                    const modulesIds = db.exec(`SELECT id FROM course_modules WHERE course_id = ${courseId}`);
                    if (modulesIds.length > 0 && modulesIds[0].values.length > 0) {
                        const ids = modulesIds[0].values.map(r => r[0]).join(',');
                        const lessonsResult = db.exec(`SELECT COUNT(*) FROM lessons WHERE module_id IN (${ids})`);
                        if (lessonsResult.length > 0 && lessonsResult[0].values.length > 0) {
                            lessonsCount = lessonsResult[0].values[0][0] || 0;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not count modules/lessons:', e);
            }
            
            // Підрахунок учасників (користувачів, які почали курс)
            try {
                const participantsResult = db.exec(`SELECT COUNT(DISTINCT user_id) FROM user_courses WHERE course_id = ${courseId}`);
                if (participantsResult.length > 0 && participantsResult[0].values.length > 0) {
                    participantsCount = participantsResult[0].values[0][0] || 0;
                }
            } catch (e) {
                console.warn('Could not count participants:', e);
            }
            
            // Отримуємо статус користувача для цього курсу
            let user_status = null;
            let user_progress = 0;
            let user_time_spent = 0;
            try {
                const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
                if (token) {
                    const userStmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                    userStmt.bind([token]);
                    if (userStmt.step()) {
                        const userId = userStmt.get()[0];
                        userStmt.free();
                        
                        const userCourseStmt = db.prepare("SELECT status, progress FROM user_courses WHERE user_id = ? AND course_id = ?");
                        userCourseStmt.bind([userId, courseId]);
                        if (userCourseStmt.step()) {
                            const userCourseRow = userCourseStmt.get();
                            user_status = userCourseRow[0] || null;
                            user_progress = userCourseRow[1] || 0;
                        }
                        userCourseStmt.free();
                    } else {
                        userStmt.free();
                    }
                }
            } catch (e) {
                console.warn('Could not get user course status:', e);
            }
            
            return {
                id: courseId,
                title: row[1],
                description: row[2],
                content: row[3],
                test_id: row[4],
                created_by: row[5],
                is_published: row[6],
                order_index: row[7],
                created_at: row[8],
                modules_count: modulesCount,
                lessons_count: lessonsCount,
                participants_count: participantsCount,
                user_status: user_status,
                user_progress: user_progress,
                user_time_spent: user_time_spent
            };
        }) : [];
        
        return { success: true, data: courses };
    },
    
    async getCourse(courseId) {
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        // Отримуємо поточного користувача
        let userId = null;
        try {
            const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
            if (token) {
                const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                stmt.bind([token]);
                if (stmt.step()) {
                    userId = stmt.get()[0];
                }
                stmt.free();
            }
        } catch (e) {
            console.warn('Could not get user from session:', e);
        }
        
        // Отримуємо курс
        const stmt = db.prepare("SELECT * FROM courses WHERE id = ?");
        stmt.bind([courseId]);
        if (!stmt.step()) {
            stmt.free();
            return { success: false, message: 'Курс не знайдено' };
        }
        
        const courseRow = stmt.get();
        stmt.free();
        
        // Визначаємо кількість полів в таблиці courses
        const course = {
            id: courseRow[0],
            title: courseRow[1],
            description: courseRow[2] || null,
            content: courseRow[3] || null,
            test_id: courseRow[4] || null,
            created_by: courseRow[5],
            is_published: courseRow[6] || 0,
            order_index: courseRow[7] || 0,
            created_at: courseRow[8] || null,
            requires_previous_course_id: courseRow[9] || null
        };
        
        // Перевірка доступу
        let canAccess = true;
        if (course.requires_previous_course_id && userId) {
            try {
                const prevStmt = db.prepare("SELECT status FROM user_courses WHERE user_id = ? AND course_id = ?");
                prevStmt.bind([userId, course.requires_previous_course_id]);
                if (!prevStmt.step()) {
                    canAccess = false;
                } else {
                    const status = prevStmt.get()[0];
                    canAccess = status === 'completed';
                }
                prevStmt.free();
            } catch (e) {
                console.warn('Could not check previous course access:', e);
            }
        }
        
        // Отримуємо модулі (якщо таблиця існує)
        const modules = [];
        try {
            const modulesStmt = db.prepare("SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index, created_at");
            modulesStmt.bind([courseId]);
            while (modulesStmt.step()) {
                const row = modulesStmt.get();
                modules.push({
                    id: row[0],
                    course_id: row[1],
                    title: row[2],
                    description: row[3] || null,
                    order_index: row[4] || 0,
                    requires_previous_module_id: row[5] || null,
                    created_at: row[6] || null
                });
            }
            modulesStmt.free();
        } catch (e) {
            console.warn('Table course_modules does not exist or error:', e);
        }
        
        // Отримуємо уроки для кожного модуля (якщо таблиця існує)
        for (const module of modules) {
            try {
                const lessonsStmt = db.prepare("SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index, created_at");
                lessonsStmt.bind([module.id]);
                module.lessons = [];
                while (lessonsStmt.step()) {
                    const row = lessonsStmt.get();
                    const lessonId = row[0];
                    
                    // Перевіряємо статус користувача для цього уроку
                    let user_is_completed = false;
                    let user_time_on_page_seconds = 0;
                    
                    if (userId) {
                        try {
                            const userLessonStmt = db.prepare("SELECT is_completed, time_on_page_seconds FROM user_lessons WHERE user_id = ? AND lesson_id = ?");
                            userLessonStmt.bind([userId, lessonId]);
                            if (userLessonStmt.step()) {
                                const userRow = userLessonStmt.get();
                                user_is_completed = userRow[0] === 1;
                                user_time_on_page_seconds = userRow[1] || 0;
                            }
                            userLessonStmt.free();
                        } catch (e) {
                            console.warn('Could not get user lesson status:', e);
                        }
                    }
                    
                    module.lessons.push({
                        id: lessonId,
                        module_id: row[1],
                        title: row[2],
                        description: row[3] || null,
                        content_type: row[4] || 'text',
                        text_content: row[5] || null,
                        video_path: row[6] || null,
                        pdf_path: row[7] || null,
                        video_data: row[8] || null,
                        pdf_data: row[9] || null,
                        mime_type: row[10] || null,
                        file_size: row[11] || null,
                        minimum_time_seconds: row[12] || 180,
                        order_index: row[13] || 0,
                        requires_previous_lesson_id: row[14] || null,
                        created_at: row[15] || null,
                        user_is_completed: user_is_completed,
                        user_time_on_page_seconds: user_time_on_page_seconds
                    });
                }
                lessonsStmt.free();
            } catch (e) {
                console.warn('Table lessons does not exist or error:', e);
                module.lessons = [];
            }
        }
        
        course.modules = modules;
        course.can_access = canAccess;
        
        return { success: true, data: course };
    },
    
    async createModule(data) {
        const { course_id, title, description, order_index } = data;
        
        // Перевірка існування таблиці та створення якщо потрібно
        try {
            db.exec("SELECT COUNT(*) FROM course_modules LIMIT 1");
        } catch (e) {
            if (e.message && e.message.includes('no such table')) {
                // Створюємо таблицю якщо вона не існує
                db.exec(`
                    CREATE TABLE IF NOT EXISTS course_modules (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        description TEXT,
                        order_index INTEGER DEFAULT 0,
                        requires_previous_module_id INTEGER REFERENCES course_modules(id) ON DELETE SET NULL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                saveDatabase();
            }
        }
        
        const stmt = db.prepare(`
            INSERT INTO course_modules (course_id, title, description, order_index)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run([course_id, title, description || '', order_index || 0]);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: lastId,
                course_id: course_id,
                title: title,
                description: description || '',
                order_index: order_index || 0
            }
        };
    },
    
    async startCourse(courseId) {
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        // Отримуємо поточного користувача
        let userId = null;
        try {
            const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
            if (token) {
                const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                stmt.bind([token]);
                if (stmt.step()) {
                    userId = stmt.get()[0];
                }
                stmt.free();
            }
        } catch (e) {
            console.warn('Could not get user from session:', e);
            return { success: false, message: 'Користувач не авторизований' };
        }
        
        if (!userId) {
            return { success: false, message: 'Користувач не авторизований' };
        }
        
        // Перевіряємо чи існує запис в user_courses
        const checkStmt = db.prepare("SELECT id, status FROM user_courses WHERE user_id = ? AND course_id = ?");
        checkStmt.bind([userId, courseId]);
        
        if (checkStmt.step()) {
            // Запис існує - оновлюємо статус
            const existingId = checkStmt.get()[0];
            checkStmt.free();
            
            const updateStmt = db.prepare("UPDATE user_courses SET status = 'in_progress', started_at = datetime('now') WHERE id = ?");
            updateStmt.run([existingId]);
            updateStmt.free();
        } else {
            // Створюємо новий запис
            checkStmt.free();
            const insertStmt = db.prepare("INSERT INTO user_courses (user_id, course_id, status, started_at) VALUES (?, ?, 'in_progress', datetime('now'))");
            insertStmt.run([userId, courseId]);
            insertStmt.free();
        }
        
        saveDatabase();
        
        return { success: true, message: 'Курс розпочато' };
    },
    
    async getModuleLessons(moduleId) {
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        try {
            // Отримуємо поточного користувача
            let userId = null;
            try {
                const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
                if (token) {
                    const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                    stmt.bind([token]);
                    if (stmt.step()) {
                        userId = stmt.get()[0];
                    }
                    stmt.free();
                }
            } catch (e) {
                console.warn('Could not get user from session:', e);
            }
            
            // Отримуємо уроки модуля
            const lessonsStmt = db.prepare("SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index, created_at");
            lessonsStmt.bind([moduleId]);
            const lessons = [];
            
            while (lessonsStmt.step()) {
                const row = lessonsStmt.get();
                const lessonId = row[0];
                
                // Перевіряємо статус користувача для цього уроку
                let user_is_completed = false;
                let user_time_on_page_seconds = 0;
                
                if (userId) {
                    try {
                        const userLessonStmt = db.prepare("SELECT is_completed, time_on_page_seconds FROM user_lessons WHERE user_id = ? AND lesson_id = ?");
                        userLessonStmt.bind([userId, lessonId]);
                        if (userLessonStmt.step()) {
                            const userRow = userLessonStmt.get();
                            user_is_completed = userRow[0] === 1;
                            user_time_on_page_seconds = userRow[1] || 0;
                        }
                        userLessonStmt.free();
                    } catch (e) {
                        console.warn('Could not get user lesson status:', e);
                    }
                }
                
                lessons.push({
                    id: lessonId,
                    module_id: row[1],
                    title: row[2],
                    description: row[3] || null,
                    content_type: row[4] || 'text',
                    text_content: row[5] || null,
                    video_path: row[6] || null,
                    pdf_path: row[7] || null,
                    video_data: row[8] || null,
                    pdf_data: row[9] || null,
                    mime_type: row[10] || null,
                    file_size: row[11] || null,
                    minimum_time_seconds: row[12] || 180,
                    order_index: row[13] || 0,
                    requires_previous_lesson_id: row[14] || null,
                    created_at: row[15] || null,
                    can_access: true,
                    user_is_completed: user_is_completed,
                    user_time_on_page_seconds: user_time_on_page_seconds
                });
            }
            lessonsStmt.free();
            
            return { success: true, data: lessons };
        } catch (error) {
            console.error('Error loading module lessons:', error);
            if (error.message && error.message.includes('no such table')) {
                return { success: true, data: [] };
            }
            throw error;
        }
    },
    
    async getLesson(lessonId) {
        try {
            // Отримуємо поточного користувача
            let userId = null;
            try {
                const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
                if (token) {
                    const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                    stmt.bind([token]);
                    if (stmt.step()) {
                        userId = stmt.get()[0];
                    }
                    stmt.free();
                }
            } catch (e) {
                console.warn('Could not get user from session:', e);
            }
            
            // Отримуємо урок
            const stmt = db.prepare("SELECT * FROM lessons WHERE id = ?");
            stmt.bind([lessonId]);
            
            if (!stmt.step()) {
                stmt.free();
                return { success: false, message: 'Урок не знайдено' };
            }
            
            const row = stmt.get();
            stmt.free();
            
            const lesson = {
                id: row[0],
                module_id: row[1],
                title: row[2],
                description: row[3] || null,
                content_type: row[4] || 'text',
                text_content: row[5] || null,
                video_path: row[6] || null,
                pdf_path: row[7] || null,
                video_data: row[8] || null,
                pdf_data: row[9] || null,
                mime_type: row[10] || null,
                file_size: row[11] || null,
                minimum_time_seconds: row[12] || 180,
                order_index: row[13] || 0,
                requires_previous_lesson_id: row[14] || null,
                created_at: row[15] || null,
                can_access: true
            };
            
            // Перевірка доступу (чи завершено попередній урок)
            if (lesson.requires_previous_lesson_id && userId) {
                try {
                    const prevStmt = db.prepare("SELECT is_completed FROM user_lessons WHERE user_id = ? AND lesson_id = ?");
                    prevStmt.bind([userId, lesson.requires_previous_lesson_id]);
                    if (!prevStmt.step() || !prevStmt.get()[0]) {
                        lesson.can_access = false;
                    }
                    prevStmt.free();
                } catch (e) {
                    console.warn('Could not check previous lesson access:', e);
                }
            }
            
            // Перевірка чи користувач вже почав урок
            if (userId) {
                try {
                    const userLessonStmt = db.prepare("SELECT started_at, is_completed, time_on_page_seconds FROM user_lessons WHERE user_id = ? AND lesson_id = ?");
                    userLessonStmt.bind([userId, lessonId]);
                    if (userLessonStmt.step()) {
                        const userLesson = userLessonStmt.get();
                        lesson.user_started_at = userLesson[0];
                        lesson.user_is_completed = userLesson[1] || false;
                        lesson.user_time_spent = userLesson[2] || 0;
                        lesson.user_time_on_page_seconds = userLesson[2] || 0;
                    }
                    userLessonStmt.free();
                } catch (e) {
                    console.warn('Could not get user lesson data:', e);
                }
            }
            
            return { success: true, data: lesson };
        } catch (error) {
            console.error('Error getting lesson:', error);
            if (error.message && error.message.includes('no such table')) {
                return { success: false, message: 'Таблиця lessons не існує' };
            }
            throw error;
        }
    },
    
    async createLesson(data) {
        const { module_id, title, description, content_type, text_content, video_path, pdf_path, video_data, pdf_data, mime_type, file_size, minimum_time_seconds, order_index } = data;
        
        // Перевірка існування таблиці та створення якщо потрібно
        try {
            db.exec("SELECT COUNT(*) FROM lessons LIMIT 1");
        } catch (e) {
            if (e.message && e.message.includes('no such table')) {
                // Таблиця буде створена при ініціалізації БД
                throw new Error('Таблиця lessons не існує. Перезавантажте сторінку.');
            }
        }
        
        const stmt = db.prepare(`
            INSERT INTO lessons (module_id, title, description, content_type, text_content, video_path, pdf_path, video_data, pdf_data, mime_type, file_size, minimum_time_seconds, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
            module_id, 
            title, 
            description || '', 
            content_type || 'text',
            text_content || null,
            video_path || null,
            pdf_path || null,
            video_data || null,
            pdf_data || null,
            mime_type || null,
            file_size || 0,
            minimum_time_seconds || 180,
            order_index || 0
        ]);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: lastId,
                module_id: module_id,
                title: title,
                description: description || '',
                content_type: content_type || 'text'
            }
        };
    },
    
    async createCourse(data, userId) {
        const { title, description, content, test_id } = data;
        
        const stmt = db.prepare("INSERT INTO courses (title, description, content, test_id, created_by, is_published) VALUES (?, ?, ?, ?, ?, 0)");
        stmt.run([title, description, content || '{}', test_id || null, userId]);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        const result = db.exec("SELECT * FROM courses WHERE id = " + lastId);
        const course = result[0].values[0];
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: course[0],
                title: course[1],
                description: course[2]
            }
        };
    },

    async updateCourse(courseId, data) {
        // Динамічне оновлення полів курсу (для аватари та ін. метаданих)
        const {
            title,
            description,
            content,
            is_published,
            order_index,
            requires_previous_course_id,
            avatar_path,
            avatar_data
        } = data;

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(typeof content === 'string' ? content : JSON.stringify(content));
        }
        if (is_published !== undefined) {
            updates.push('is_published = ?');
            params.push(is_published ? 1 : 0);
        }
        if (order_index !== undefined) {
            updates.push('order_index = ?');
            params.push(order_index);
        }
        if (requires_previous_course_id !== undefined) {
            updates.push('requires_previous_course_id = ?');
            params.push(requires_previous_course_id || null);
        }

        // Перевіряємо наявність колонок avatar_path / avatar_data
        try {
            const tableInfo = db.exec("PRAGMA table_info(courses)");
            if (tableInfo[0]) {
                const hasAvatarPath = tableInfo[0].values.some(row => row[1] === 'avatar_path');
                const hasAvatarData = tableInfo[0].values.some(row => row[1] === 'avatar_data');

                if (hasAvatarPath && avatar_path !== undefined) {
                    updates.push('avatar_path = ?');
                    params.push(avatar_path);
                }
                if (hasAvatarData && avatar_data !== undefined) {
                    updates.push('avatar_data = ?');
                    params.push(avatar_data);
                }
            }
        } catch (e) {
            console.warn('Could not inspect courses table for avatar columns:', e);
        }

        if (updates.length === 0) {
            return { success: true };
        }

        params.push(courseId);

        const stmt = db.prepare(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(params);
        stmt.free();

        saveDatabase();

        return { success: true };
    },
    
    async addCourseMaterial(courseId, materialId) {
        // Перевірка чи не існує вже така прив'язка
        const checkStmt = db.prepare("SELECT id FROM course_materials WHERE course_id = ? AND material_id = ?");
        checkStmt.bind([courseId, materialId]);
        if (checkStmt.step()) {
            checkStmt.free();
            return { success: true, message: 'Матеріал вже додано' };
        }
        checkStmt.free();
        
        // Додавання прив'язки
        const stmt = db.prepare("INSERT INTO course_materials (course_id, material_id, order_index) VALUES (?, ?, 0)");
        stmt.run([courseId, materialId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    },
    
    async startLesson(lessonId) {
        // Отримуємо поточного користувача
        let userId = null;
        try {
            const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
            if (token) {
                const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                stmt.bind([token]);
                if (stmt.step()) {
                    userId = stmt.get()[0];
                }
                stmt.free();
            }
        } catch (e) {
            console.warn('Could not get user from session:', e);
            throw new Error('Користувач не авторизований');
        }
        
        if (!userId) {
            throw new Error('Користувач не авторизований');
        }
        
        // Перевіряємо чи існує запис в user_lessons
        const checkStmt = db.prepare("SELECT id, started_at FROM user_lessons WHERE user_id = ? AND lesson_id = ?");
        checkStmt.bind([userId, lessonId]);
        
        if (checkStmt.step()) {
            // Запис вже існує, оновлюємо last_activity
            checkStmt.free();
            const updateStmt = db.prepare("UPDATE user_lessons SET started_at = COALESCE(started_at, datetime('now')) WHERE user_id = ? AND lesson_id = ?");
            updateStmt.run([userId, lessonId]);
            updateStmt.free();
        } else {
            // Створюємо новий запис
            checkStmt.free();
            const insertStmt = db.prepare("INSERT INTO user_lessons (user_id, lesson_id, started_at, is_completed, time_on_page_seconds) VALUES (?, ?, datetime('now'), 0, 0)");
            insertStmt.run([userId, lessonId]);
            insertStmt.free();
        }
        
        saveDatabase();
        
        return { success: true };
    },
    
    async updateLessonTime(lessonId, timeOnPageSeconds) {
        // Отримуємо поточного користувача
        let userId = null;
        try {
            const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
            if (token) {
                const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                stmt.bind([token]);
                if (stmt.step()) {
                    userId = stmt.get()[0];
                }
                stmt.free();
            }
        } catch (e) {
            console.warn('Could not get user from session:', e);
            return { success: false, message: 'Користувач не авторизований' };
        }
        
        if (!userId) {
            return { success: false, message: 'Користувач не авторизований' };
        }
        
        // Оновлюємо час
        const stmt = db.prepare("UPDATE user_lessons SET time_on_page_seconds = ? WHERE user_id = ? AND lesson_id = ?");
        stmt.run([timeOnPageSeconds, userId, lessonId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    },
    
    async completeLesson(lessonId) {
        // Отримуємо поточного користувача
        let userId = null;
        try {
            const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
            if (token) {
                const stmt = db.prepare("SELECT user_id FROM sessions WHERE session_token = ? LIMIT 1");
                stmt.bind([token]);
                if (stmt.step()) {
                    userId = stmt.get()[0];
                }
                stmt.free();
            }
        } catch (e) {
            console.warn('Could not get user from session:', e);
            throw new Error('Користувач не авторизований');
        }
        
        if (!userId) {
            throw new Error('Користувач не авторизований');
        }
        
        // Оновлюємо статус завершення
        const stmt = db.prepare("UPDATE user_lessons SET is_completed = 1, completed_at = datetime('now') WHERE user_id = ? AND lesson_id = ?");
        stmt.run([userId, lessonId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    }
};

// Екіпажі
const localCrews = {
    // Створення таблиць, якщо їх немає
    ensureTables() {
        try {
            // Перевірка таблиці crews
            db.exec("SELECT COUNT(*) FROM crews LIMIT 1");
        } catch (e) {
            if (e.message && e.message.includes('no such table')) {
                console.log('Створення таблиць crews та crew_members...');
                db.exec(`
                    CREATE TABLE IF NOT EXISTS crews (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        uav_type TEXT NOT NULL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    CREATE TABLE IF NOT EXISTS crew_members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
                        personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
                        role TEXT,
                        UNIQUE(crew_id, personnel_id)
                    );
                `);
                saveDatabase();
            }
        }
    },
    
    async getCrews() {
        try {
            // Перевірка наявності БД
            const dbInstance = getDb();
            if (!dbInstance) {
                console.warn('Database not initialized, returning empty crews list');
                return { success: true, data: [] };
            }
            
            // Переконатися, що таблиці існують
            this.ensureTables();
            
            const result = dbInstance.exec("SELECT * FROM crews ORDER BY created_at DESC");
            const crews = result.length > 0 && result[0] ? result[0].values.map(row => {
                const crewId = row[0];
                let membersCount = 0;
                let members = [];
                
                try {
                    const membersResult = dbInstance.exec("SELECT COUNT(*) FROM crew_members WHERE crew_id = " + crewId);
                    membersCount = membersResult[0]?.values[0]?.[0] || 0;
                    
                    // Отримуємо список членів
                    const membersListResult = dbInstance.exec(`
                        SELECT cm.personnel_id, cm.role, p.full_name, p.position, p.rank
                        FROM crew_members cm
                        LEFT JOIN personnel p ON cm.personnel_id = p.id
                        WHERE cm.crew_id = ${crewId}
                    `);
                    
                    if (membersListResult.length > 0 && membersListResult[0]) {
                        members = membersListResult[0].values.map(memberRow => ({
                            personnel_id: memberRow[0],
                            role: memberRow[1] || '',
                            full_name: memberRow[2] || '',
                            position: memberRow[3] || '',
                            rank: memberRow[4] || ''
                        }));
                    }
                } catch (e) {
                    console.warn('Error loading crew members:', e);
                }
                
                // Перевіряємо наявність колонок avatar
                let avatar_path = null;
                let avatar_data = null;
                if (row.length > 4) {
                    avatar_path = row[4] || null;
                }
                if (row.length > 5) {
                    avatar_data = row[5] || null;
                }
                
                return {
                    id: row[0],
                    name: row[1],
                    uav_type: row[2],
                    created_at: row[3],
                    avatar_path: avatar_path,
                    avatar_data: avatar_data,
                    members_count: membersCount,
                    members: members
                };
            }) : [];
            
            return { success: true, data: crews };
        } catch (error) {
            console.error('Error loading crews:', error);
            if (error.message && error.message.includes('no such table')) {
                // Спробувати створити таблиці
                try {
                    this.ensureTables();
                    return { success: true, data: [] };
                } catch (e) {
                    console.error('Error creating crews tables:', e);
                    return { success: true, data: [] };
                }
            }
            throw error;
        }
    },
    
    async createCrew(data) {
        this.ensureTables();
        
        const { name, uav_type, members, avatar_path, avatar_data } = data;
        
        // Перевіряємо наявність колонок avatar
        let hasAvatarPath = false;
        let hasAvatarData = false;
        try {
            const tableInfo = db.exec("PRAGMA table_info(crews)");
            if (tableInfo[0]) {
                hasAvatarPath = tableInfo[0].values.some(row => row[1] === 'avatar_path');
                hasAvatarData = tableInfo[0].values.some(row => row[1] === 'avatar_data');
            }
        } catch (e) {
            console.warn('Could not inspect crews table:', e);
        }
        
        let sql = "INSERT INTO crews (name, uav_type";
        let params = [name, uav_type];
        if (hasAvatarPath && avatar_path !== undefined) {
            sql += ", avatar_path";
            params.push(avatar_path);
        }
        if (hasAvatarData && avatar_data !== undefined) {
            sql += ", avatar_data";
            params.push(avatar_data);
        }
        sql += ") VALUES (?, ?";
        if (hasAvatarPath && avatar_path !== undefined) sql += ", ?";
        if (hasAvatarData && avatar_data !== undefined) sql += ", ?";
        sql += ")";
        
        const stmt = db.prepare(sql);
        stmt.run(params);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        // Додавання членів
        if (members && members.length > 0) {
            const memberStmt = db.prepare("INSERT INTO crew_members (crew_id, personnel_id, role) VALUES (?, ?, ?)");
            members.forEach(member => {
                memberStmt.run([lastId, member.personnel_id, member.role || '']);
            });
            memberStmt.free();
        }
        
        saveDatabase();
        
        return { success: true, data: { id: lastId, name, uav_type } };
    },
    
    async updateCrew(crewId, data) {
        this.ensureTables();
        
        const { name, uav_type, members, avatar_path, avatar_data } = data;
        
        // Перевіряємо наявність колонок avatar
        let hasAvatarPath = false;
        let hasAvatarData = false;
        try {
            const tableInfo = db.exec("PRAGMA table_info(crews)");
            if (tableInfo[0]) {
                hasAvatarPath = tableInfo[0].values.some(row => row[1] === 'avatar_path');
                hasAvatarData = tableInfo[0].values.some(row => row[1] === 'avatar_data');
            }
        } catch (e) {
            console.warn('Could not inspect crews table:', e);
        }
        
        const updates = ['name = ?', 'uav_type = ?'];
        const params = [name, uav_type];
        
        if (hasAvatarPath && avatar_path !== undefined) {
            updates.push('avatar_path = ?');
            params.push(avatar_path);
        }
        if (hasAvatarData && avatar_data !== undefined) {
            updates.push('avatar_data = ?');
            params.push(avatar_data);
        }
        
        params.push(crewId);
        
        const stmt = db.prepare(`UPDATE crews SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(params);
        stmt.free();
        
        // Видалення старих членів
        const deleteStmt = db.prepare("DELETE FROM crew_members WHERE crew_id = ?");
        deleteStmt.run([crewId]);
        deleteStmt.free();
        
        // Додавання нових членів
        if (members && members.length > 0) {
            const memberStmt = db.prepare("INSERT INTO crew_members (crew_id, personnel_id, role) VALUES (?, ?, ?)");
            members.forEach(member => {
                memberStmt.run([crewId, member.personnel_id, member.role || '']);
            });
            memberStmt.free();
        }
        
        saveDatabase();
        
        return { success: true };
    },
    
    async deleteCrew(crewId) {
        this.ensureTables();
        
        const stmt = db.prepare("DELETE FROM crews WHERE id = ?");
        stmt.run([crewId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    },
    
    async getCrew(crewId) {
        this.ensureTables();
        
        const crewResult = db.exec("SELECT * FROM crews WHERE id = " + crewId);
        if (!crewResult[0] || !crewResult[0].values.length) {
            throw new Error('Екіпаж не знайдено');
        }
        
        const crewRow = crewResult[0].values[0];
        
        // Отримуємо список членів з деталями
        let members = [];
        try {
            const membersResult = db.exec(
                `SELECT cm.personnel_id, cm.role, p.full_name, p.position, p.rank
                 FROM crew_members cm
                 LEFT JOIN personnel p ON cm.personnel_id = p.id
                 WHERE cm.crew_id = ${crewId}`
            );
            
            if (membersResult.length > 0 && membersResult[0]) {
                members = membersResult[0].values.map(row => ({
                    personnel_id: row[0],
                    role: row[1] || '',
                    full_name: row[2] || 'Невідомо',
                    position: row[3] || '',
                    rank: row[4] || ''
                }));
            }
        } catch (e) {
            console.warn('Error loading crew members:', e);
        }
        
        // Перевіряємо наявність колонок avatar
        let avatar_path = null;
        let avatar_data = null;
        if (crewRow.length > 4) {
            avatar_path = crewRow[4] || null;
        }
        if (crewRow.length > 5) {
            avatar_data = crewRow[5] || null;
        }
        
        return {
            success: true,
            data: {
                id: crewRow[0],
                name: crewRow[1],
                uav_type: crewRow[2],
                created_at: crewRow[3],
                avatar_path: avatar_path,
                avatar_data: avatar_data,
                members_count: members.length,
                members: members
            }
        };
    },
    
    async getCrewMembers(crewId) {
        this.ensureTables();
        
        try {
            const membersResult = db.exec(
                `SELECT cm.personnel_id, cm.role, p.full_name, p.position, p.rank, p.shpk
                 FROM crew_members cm
                 LEFT JOIN personnel p ON cm.personnel_id = p.id
                 WHERE cm.crew_id = ${crewId}`
            );
            
            if (membersResult.length > 0 && membersResult[0]) {
                return {
                    success: true,
                    data: membersResult[0].values.map(row => ({
                        personnel_id: row[0],
                        role: row[1] || '',
                        full_name: row[2] || 'Невідомо',
                        position: row[3] || '',
                        rank: row[4] || '',
                        shpk: row[5] || ''
                    }))
                };
            }
            
            return { success: true, data: [] };
        } catch (e) {
            console.error('Error loading crew members:', e);
            return { success: true, data: [] };
        }
    }
};

// Типи засобів
const localEquipmentTypes = {
    async getTypes() {
        try {
            const result = db.exec("SELECT * FROM equipment_types ORDER BY name");
            const types = result.length > 0 && result[0] ? result[0].values.map(row => ({
                id: row[0],
                name: row[1],
                description: row[2],
                created_at: row[3]
            })) : [];
            
            return { success: true, data: types };
        } catch (error) {
            console.error('Error loading equipment types:', error);
            if (error.message && error.message.includes('no such table')) {
                db.run(`
                    CREATE TABLE IF NOT EXISTS equipment_types (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                saveDatabase();
                return { success: true, data: [] };
            }
            throw error;
        }
    },
    
    async createType(data) {
        const { name, description } = data;
        
        const stmt = db.prepare("INSERT INTO equipment_types (name, description) VALUES (?, ?)");
        stmt.run([name, description || '']);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        saveDatabase();
        
        return { success: true, data: { id: lastId, name, description } };
    },
    
    async updateType(typeId, data) {
        const { name, description } = data;
        
        const stmt = db.prepare("UPDATE equipment_types SET name = ?, description = ? WHERE id = ?");
        stmt.run([name, description || '', typeId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    },
    
    async deleteType(typeId) {
        // Перевірка залежностей
        const checkStmt = db.prepare("SELECT COUNT(*) FROM equipment WHERE type_id = ?");
        checkStmt.bind([typeId]);
        checkStmt.step();
        const count = checkStmt.getAsObject()['COUNT(*)'];
        checkStmt.free();
        
        if (count > 0) {
            throw new Error('Неможливо видалити тип: існують засоби з цим типом');
        }
        
        const stmt = db.prepare("DELETE FROM equipment_types WHERE id = ?");
        stmt.run([typeId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    }
};

// Засоби
const localEquipment = {
    async getEquipment() {
        try {
            // Перевірка наявності БД
            const dbInstance = getDb();
            if (!dbInstance) {
                console.warn('Database not initialized, returning empty equipment list');
                return { success: true, data: [] };
            }
            
            // Спочатку перевіряємо структуру таблиці та мігруємо якщо потрібно
            // Таблиця equipment вже створена в схемі БД
            
            // Спробуємо запит з type_id
            try {
                const result = dbInstance.exec(`
                    SELECT e.*, et.name as type_name 
                    FROM equipment e
                    LEFT JOIN equipment_types et ON e.type_id = et.id
                    ORDER BY e.created_at DESC
                `);
                const equipment = result.length > 0 && result[0] ? result[0].values.map(row => {
                    // Визначаємо структуру рядка залежно від кількості колонок
                    const colCount = row.length;
                    return {
                        id: row[0],
                        name: row[1],
                        type_id: colCount > 2 ? row[2] : null,
                        type_name: colCount > 11 ? row[11] : null,
                        type_uav: colCount > 3 ? row[3] : null,
                        photo_path: colCount > 4 ? row[4] : null,
                        photo_data: colCount > 5 ? row[5] : null,
                        crew_id: colCount > 6 ? row[6] : null,
                        unit_id: colCount > 7 ? row[7] : null,
                        status: colCount > 8 ? row[8] : 'active',
                        notes: colCount > 9 ? row[9] : null,
                        created_at: colCount > 10 ? row[10] : null
                    };
                }) : [];
                
                return { success: true, data: equipment };
            } catch (joinError) {
                // Якщо JOIN не працює, використовуємо простий SELECT
                console.warn('JOIN query failed, using simple SELECT:', joinError);
                const dbInstance = getDb();
                if (!dbInstance) {
                    return { success: true, data: [] };
                }
                const result = dbInstance.exec("SELECT * FROM equipment ORDER BY created_at DESC");
                const equipment = result.length > 0 && result[0] ? result[0].values.map(row => ({
                    id: row[0],
                    name: row[1],
                    type_id: row.length > 2 ? row[2] : null,
                    type_name: null,
                    type_uav: row.length > 3 ? row[3] : null,
                    photo_path: row.length > 4 ? row[4] : null,
                    photo_data: row.length > 5 ? row[5] : null,
                    crew_id: row.length > 6 ? row[6] : null,
                    unit_id: row.length > 7 ? row[7] : null,
                    status: row.length > 8 ? row[8] : 'active',
                    notes: row.length > 9 ? row[9] : null,
                    created_at: row.length > 10 ? row[10] : null
                })) : [];
                
                return { success: true, data: equipment };
            }
        } catch (error) {
            console.error('Error loading equipment:', error);
            // Якщо таблиця не існує, повертаємо порожній масив
            if (error.message && error.message.includes('no such table')) {
                return { success: true, data: [] };
            }
            throw error;
        }
    },
    
    async migrateEquipmentTable() {
        try {
            // Перевіряємо чи існує колонка type_id
            const testResult = db.exec("PRAGMA table_info(equipment)");
            const columns = testResult[0]?.values || [];
            const hasTypeId = columns.some(col => col[1] === 'type_id');
            
            if (!hasTypeId) {
                console.log('Migrating equipment table: adding type_id column');
                // Додаємо колонку type_id
                db.run("ALTER TABLE equipment ADD COLUMN type_id INTEGER REFERENCES equipment_types(id) ON DELETE SET NULL");
                saveDatabase();
            }
        } catch (error) {
            // Якщо таблиця не існує, створимо її
            if (error.message && error.message.includes('no such table')) {
                await createEquipmentTables();
            } else {
                console.warn('Migration warning:', error);
            }
        }
    },
    
    async createEquipmentTables() {
        db.run(`
            CREATE TABLE IF NOT EXISTS equipment_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type_id INTEGER REFERENCES equipment_types(id) ON DELETE SET NULL,
                type_uav TEXT,
                photo_path TEXT,
                photo_data BLOB,
                crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
                unit_id INTEGER REFERENCES units(id),
                status TEXT DEFAULT 'active',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        saveDatabase();
    },
    
    async createEquipment(data) {
        const { name, type_id, type_uav, photo_data, photo_path, notes, status } = data;
        
        // Перевіряємо чи існує колонка type_id
        let hasTypeId = false;
        try {
            const pragmaResult = db.exec("PRAGMA table_info(equipment)");
            if (pragmaResult.length > 0 && pragmaResult[0].values) {
                hasTypeId = pragmaResult[0].values.some(col => col[1] === 'type_id');
            }
        } catch (e) {
            console.warn('Could not check equipment table structure:', e);
        }
        
        let stmt;
        if (hasTypeId) {
            stmt = db.prepare(
                `INSERT INTO equipment (name, type_id, type_uav, photo_path, photo_data, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            );
            stmt.run([name, type_id || null, type_uav || null, photo_path || null, photo_data || null, notes || null, status || 'active']);
        } else {
            // Якщо колонки type_id немає, використовуємо стару структуру
            stmt = db.prepare(
                `INSERT INTO equipment (name, type_uav, photo_path, photo_data, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?)`
            );
            stmt.run([name, type_uav || null, photo_path || null, photo_data || null, notes || null, status || 'active']);
        }
        
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        saveDatabase();
        
        return { success: true, data: { id: lastId, name } };
    },
    
    async updateEquipment(equipmentId, data) {
        const { name, type_id, type_uav, photo_data, photo_path, notes, status } = data;
        
        // Перевіряємо чи існує колонка type_id
        let hasTypeId = false;
        try {
            const pragmaResult = db.exec("PRAGMA table_info(equipment)");
            if (pragmaResult.length > 0 && pragmaResult[0].values) {
                hasTypeId = pragmaResult[0].values.some(col => col[1] === 'type_id');
            }
        } catch (e) {
            console.warn('Could not check equipment table structure:', e);
        }
        
        let stmt;
        if (hasTypeId) {
            stmt = db.prepare(
                `UPDATE equipment 
                 SET name = ?, type_id = ?, type_uav = ?, photo_path = ?, photo_data = ?, notes = ?, status = ?
                 WHERE id = ?`
            );
            stmt.run([name, type_id || null, type_uav || null, photo_path || null, photo_data || null, notes || null, status || 'active', equipmentId]);
        } else {
            // Якщо колонки type_id немає, використовуємо стару структуру
            stmt = db.prepare(
                `UPDATE equipment 
                 SET name = ?, type_uav = ?, photo_path = ?, photo_data = ?, notes = ?, status = ?
                 WHERE id = ?`
            );
            stmt.run([name, type_uav || null, photo_path || null, photo_data || null, notes || null, status || 'active', equipmentId]);
        }
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    },
    
    async deleteEquipment(equipmentId) {
        const stmt = db.prepare("DELETE FROM equipment WHERE id = ?");
        stmt.run([equipmentId]);
        stmt.free();
        
        saveDatabase();
        
        return { success: true };
    }
};

// Особовий склад
const localPersonnel = {
    async getPersonnel() {
        try {
            // Перевірка наявності БД
            const dbInstance = getDb();
            if (!dbInstance) {
                console.warn('Database not initialized, returning empty personnel list');
                return { success: true, data: [] };
            }
            
            // Спробуємо запит з JOIN для отримання назви підрозділу
            try {
                const result = dbInstance.exec(`
                    SELECT p.*, u.name as unit_name 
                    FROM personnel p
                    LEFT JOIN units u ON p.unit_id = u.id
                    ORDER BY p.full_name
                `);
                const personnel = result.length > 0 && result[0] ? result[0].values.map(row => {
                    // Визначаємо структуру рядка
                    const colCount = row.length;
                    return {
                        id: row[0],
                        shpk: row[1] || null,
                        full_name: row[2] || '',
                        position: row[3] || '',
                        rank: row[4] || '',
                        phone: row[5] || null,
                        email: row[6] || null,
                        unit_id: row[7] || null,
                        user_id: row[8] || null,
                        combat_zone_access: row[9] || 0,
                        created_at: row[10] || null,
                        unit_name: colCount > 11 ? row[11] : null
                    };
                }) : [];
                
                return { success: true, data: personnel };
            } catch (joinError) {
                // Якщо JOIN не працює, використовуємо простий SELECT
                console.warn('JOIN query failed, using simple SELECT:', joinError);
                const dbInstance = getDb();
                if (!dbInstance) {
                    return { success: true, data: [] };
                }
                const result = dbInstance.exec("SELECT * FROM personnel ORDER BY full_name");
                const personnel = result.length > 0 && result[0] ? result[0].values.map(row => ({
                    id: row[0],
                    shpk: row[1] || null,
                    full_name: row[2] || '',
                    position: row[3] || '',
                    rank: row[4] || '',
                    phone: row[5] || null,
                    email: row[6] || null,
                    unit_id: row[7] || null,
                    user_id: row[8] || null,
                    combat_zone_access: row[9] || 0,
                    created_at: row[10] || null,
                    unit_name: null
                })) : [];
                
                return { success: true, data: personnel };
            }
        } catch (error) {
            console.error('Error loading personnel:', error);
            if (error.message && error.message.includes('no such table')) {
                return { success: true, data: [] };
            }
            throw error;
        }
    },
    
    async createPersonnel(data) {
        const { shpk, full_name, position, rank, phone, email, unit_id, user_id, combat_zone_access } = data;
        
        const stmt = db.prepare(
            `INSERT INTO personnel (shpk, full_name, position, rank, phone, email, unit_id, user_id, combat_zone_access)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([shpk || null, full_name, position, rank, phone || null, email || null, unit_id || null, user_id || null, combat_zone_access || 0]);
        const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        
        saveDatabase();
        
        return { success: true, data: { id: lastId, full_name, position, rank } };
    }
};

// Адміністрування
const localAdmin = {
    async getUsers() {
        try {
            // Перевірка наявності колонки password
            let hasPasswordField = false;
            try {
                const tableInfo = db.exec("PRAGMA table_info(users)");
                if (tableInfo[0]) {
                    hasPasswordField = tableInfo[0].values.some(row => row[1] === 'password');
                }
            } catch (e) {
                // Якщо не вдалося перевірити, просто не додаємо
            }
            
            const query = hasPasswordField 
                ? "SELECT id, full_name, email, password_hash, password, role, is_active, last_login, last_activity FROM users ORDER BY created_at DESC"
                : "SELECT id, full_name, email, password_hash, role, is_active, last_login, last_activity FROM users ORDER BY created_at DESC";
            
            const result = db.exec(query);
            const users = result.length > 0 && result[0] ? result[0].values.map(row => {
                // Визначаємо структуру рядка
                const colCount = row.length;
                const id = row[0];
                const full_name = row[1];
                const email = row[2];
                const password = hasPasswordField && colCount > 4 ? row[4] : (colCount > 3 ? row[3] : null);
                const role = hasPasswordField && colCount > 5 ? row[5] : (colCount > 3 ? row[3] : 'User');
                const is_active = hasPasswordField && colCount > 6 ? (row[6] || 1) : (colCount > 4 ? (row[4] || 1) : 1);
                const last_login = hasPasswordField && colCount > 7 ? row[7] : (colCount > 5 ? row[5] : null);
                const last_activity = hasPasswordField && colCount > 8 ? row[8] : (colCount > 6 ? row[6] : null);

                // Визначаємо онлайн‑статус за останньою активністю в sessions (5 хв)
                let is_online = false;
                try {
                    const onlineResult = db.exec(
                        `SELECT COUNT(*) FROM sessions 
                         WHERE user_id = ${id} 
                           AND last_activity > datetime('now', '-5 minutes')`
                    );
                    const count = onlineResult[0]?.values[0]?.[0] || 0;
                    is_online = count > 0;
                } catch (e) {
                    console.warn('Could not determine online status for user', id, e);
                }

                return {
                    id,
                    full_name,
                    email,
                    password,
                    role,
                    is_active,
                    last_login,
                    last_activity,
                    is_online
                };
            }) : [];
            
            return { success: true, data: users };
        } catch (error) {
            console.error('Error loading users:', error);
            return { success: true, data: [] };
        }
    },
    
    async getUser(userId) {
        try {
            const result = db.exec(`SELECT id, full_name, email, password_hash, password, role, is_active, last_login, last_activity FROM users WHERE id = ${userId}`);
            if (!result[0] || !result[0].values.length) {
                throw new Error('Користувач не знайдено');
            }
            
            const row = result[0].values[0];
            const colCount = row.length;
            
            return {
                success: true,
                data: {
                    id: row[0],
                    full_name: row[1],
                    email: row[2],
                    password: colCount > 4 ? row[4] : row[3], // Використовуємо password якщо є, інакше password_hash
                    role: colCount > 5 ? row[5] : row[3],
                    is_active: colCount > 6 ? (row[6] || 1) : 1,
                    last_login: colCount > 7 ? row[7] : null,
                    last_activity: colCount > 8 ? row[8] : null,
                    is_online: false
                }
            };
        } catch (error) {
            console.error('Error loading user:', error);
            throw error;
        }
    },
    
    async updateUserPassword(userId, newPassword) {
        const passwordHash = await hashPassword(newPassword);
        
        // Перевірка наявності колонки password
        let hasPasswordField = false;
        try {
            const tableInfo = db.exec("PRAGMA table_info(users)");
            if (tableInfo[0]) {
                hasPasswordField = tableInfo[0].values.some(row => row[1] === 'password');
            }
        } catch (e) {
            // Якщо не вдалося перевірити, просто не додаємо
        }
        
        if (hasPasswordField) {
            const stmt = db.prepare("UPDATE users SET password_hash = ?, password = ? WHERE id = ?");
            stmt.run([passwordHash, newPassword, userId]);
        } else {
            const stmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            stmt.run([passwordHash, userId]);
        }
        
        saveDatabase();
        
        return { success: true };
    },

    async updateUserRole(userId, role) {
        if (!['SystemAdmin', 'Admin', 'Readit', 'User'].includes(role)) {
            throw new Error('Невірна роль');
        }

        const stmt = db.prepare("UPDATE users SET role = ? WHERE id = ?");
        stmt.run([role, userId]);
        stmt.free();

        saveDatabase();

        return { success: true };
    }
};

// Профіль
const localProfile = {
    async getProfile(userId) {
        const userResult = db.exec("SELECT id, full_name, email, role, created_at FROM users WHERE id = " + userId);
        const personnelResult = db.exec("SELECT * FROM personnel WHERE user_id = " + userId);
        // Отримуємо ВСІ курси (і призначені, і доступні)
        // Спочатку призначені курси
        const assignedCoursesResult = db.exec(
            `SELECT c.*, uc.status, uc.progress, uc.completed_at
             FROM user_courses uc
             JOIN courses c ON uc.course_id = c.id
             WHERE uc.user_id = ` + userId + `
             ORDER BY uc.created_at DESC`
        );
        
        // Потім всі опубліковані курси (для показу доступних)
        const allPublishedCoursesResult = db.exec(
            `SELECT c.*, NULL as status, 0 as progress, NULL as completed_at
             FROM courses c
             WHERE c.is_published = 1
             ORDER BY c.order_index, c.created_at DESC`
        );
        
        // Об'єднуємо та видаляємо дублікати (призначені курси мають пріоритет)
        const assignedCourses = assignedCoursesResult[0]?.values || [];
        const allPublishedCourses = allPublishedCoursesResult[0]?.values || [];
        const assignedIds = new Set(assignedCourses.map(row => row[0]));
        const uniquePublishedCourses = allPublishedCourses.filter(row => !assignedIds.has(row[0]));
        
        // Об'єднуємо результати
        const coursesResult = [{
            columns: assignedCoursesResult[0]?.columns || [],
            values: [...assignedCourses, ...uniquePublishedCourses]
        }];
        const testsResult = db.exec(
            `SELECT tr.id, tr.test_id, tr.user_id, tr.score, tr.max_score, tr.percentage, tr.passed, tr.time_spent, tr.started_at, tr.completed_at, t.title as test_title, t.course_id, c.title as course_title
             FROM test_results tr
             JOIN tests t ON tr.test_id = t.id
             LEFT JOIN courses c ON t.course_id = c.id
             WHERE tr.user_id = ` + userId + `
             ORDER BY tr.completed_at DESC
             LIMIT 10`
        );
        
        // Отримання екіпажів користувача
        let crewsData = [];
        const personnelRow = personnelResult[0]?.values[0];
        if (personnelRow && personnelRow[0]) {
            const personnelId = personnelRow[0];
            const crewsResult = db.exec(
                `SELECT c.id, c.name, c.uav_type, c.avatar_path, c.avatar_data, cm.role
                 FROM crews c
                 JOIN crew_members cm ON c.id = cm.crew_id
                 WHERE cm.personnel_id = ` + personnelId
            );
            
            if (crewsResult[0] && crewsResult[0].values) {
                crewsData = crewsResult[0].values.map(row => ({
                    id: row[0],
                    name: row[1],
                    uav_type: row[2],
                    avatar_path: row[3] || null,
                    avatar_data: row[4] || null,
                    role: row[5] || null
                }));
            }
        }
        
        const userRow = userResult[0]?.values[0];
        
        // Обробка курсів
        // Структура: c.id, c.title, c.description, c.content, c.test_id, c.created_by, c.is_published, c.order_index, c.created_at, uc.status, uc.progress, uc.completed_at
        const courses = (coursesResult[0]?.values || []).map(row => {
            const colCount = row.length;
            // Визначаємо індекси залежно від кількості колонок
            // c.* має 9 колонок (id, title, description, content, test_id, created_by, is_published, order_index, created_at)
            // uc.status, uc.progress, uc.completed_at - це колонки 10, 11, 12 (або NULL для доступних курсів)
            const status = colCount > 9 && row[9] !== null ? (row[9] || 'assigned') : 'available';
            const progress = colCount > 10 && row[10] !== null ? (row[10] || 0) : 0;
            const completed_at = colCount > 11 && row[11] !== null ? row[11] : null;
            
            return {
                id: row[0],
                title: row[1] || 'Без назви',
                description: row[2] || null,
                status: status,
                progress: progress,
                completed_at: completed_at
            };
        });
        
        // Обробка результатів тестів
        // Структура: tr.id, tr.test_id, tr.user_id, tr.score, tr.max_score, tr.percentage, tr.passed, tr.time_spent, tr.started_at, tr.completed_at, t.title as test_title, t.course_id, c.title as course_title
        const testResults = (testsResult[0]?.values || []).map(row => {
            const colCount = row.length;
            // Перевіряємо чи passed це число (1/0) або boolean
            const passedValue = colCount > 6 ? row[6] : 0;
            const passed = passedValue === 1 || passedValue === true;
            
            // Отримуємо назву тесту (колонка 10 - індекс 10)
            const testTitle = colCount > 10 ? (row[10] || 'Тест') : 'Тест';
            // Отримуємо назву курсу (колонка 12 - індекс 12)
            const courseTitle = colCount > 12 ? (row[12] || null) : null;
            
            // Використовуємо назву тесту, якщо є назва курсу - додаємо її
            let displayTitle = testTitle;
            if (courseTitle && testTitle !== 'Тест') {
                displayTitle = `${courseTitle} - ${testTitle}`;
            } else if (courseTitle) {
                displayTitle = courseTitle;
            }
            
            // Перевіряємо чи displayTitle не містить JSON (якщо випадково потрапили answers)
            if (displayTitle && (displayTitle.includes('{') || displayTitle.includes('q-'))) {
                // Якщо це JSON, використовуємо тільки назву тесту
                displayTitle = testTitle !== 'Тест' ? testTitle : (courseTitle || 'Тест');
            }
            
            return {
                id: row[0],
                test_id: colCount > 1 ? row[1] : null,
                user_id: colCount > 2 ? row[2] : null,
                score: colCount > 3 ? (row[3] || 0) : 0,
                max_score: colCount > 4 ? (row[4] || 0) : 0,
                percentage: colCount > 5 ? (row[5] || 0) : 0,
                passed: passed,
                time_spent: colCount > 7 ? row[7] : null,
                started_at: colCount > 8 ? row[8] : null,
                completed_at: colCount > 9 ? row[9] : null,
                test_title: testTitle,
                course_title: courseTitle,
                display_title: displayTitle
            };
        });
        
        // Обробка персоналу
        let personnel = null;
        if (personnelResult[0]?.values && personnelResult[0].values.length > 0) {
            const pRow = personnelResult[0].values[0];
            personnel = {
                id: pRow[0],
                shpk: pRow[1],
                full_name: pRow[2],
                position: pRow[3],
                rank: pRow[4],
                phone: pRow[5] || null,
                email: pRow[6] || null,
                unit_id: pRow[7] || null,
                user_id: pRow[8] || null
            };
        }
        
        return {
            success: true,
            user: {
                ...(userRow ? {
                    id: userRow[0],
                    full_name: userRow[1],
                    email: userRow[2],
                    role: userRow[3],
                    created_at: userRow[4]
                } : {}),
                personnel: personnel,
                courses: courses,
                test_results: testResults,
                crews: crewsData,
                learning_history: [] // TODO: Додати історію навчання
            }
        };
    }
};

// Генерація токена сесії
function generateSessionToken() {
    return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Тести
const localTests = {
    async createTest(data, userId) {
        const { course_id, title, description, passing_score, time_limit, questions } = data;
        
        // Створення тесту
        const testStmt = db.prepare(`
            INSERT INTO tests (course_id, title, description, passing_score, time_limit, created_by, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `);
        testStmt.run([course_id, title, description || '', passing_score || 70, time_limit || null, userId]);
        const testId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        testStmt.free();
        
        // Створення питань та відповідей
        if (questions && questions.length > 0) {
            questions.forEach((question, qIndex) => {
                const questionStmt = db.prepare(`
                    INSERT INTO test_questions (test_id, question_text, question_type, points, order_index)
                    VALUES (?, ?, ?, ?, ?)
                `);
                questionStmt.run([
                    testId,
                    question.question_text,
                    question.question_type || 'single',
                    question.points || 1,
                    question.order_index || qIndex
                ]);
                const questionId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
                questionStmt.free();
                
                // Створення відповідей
                if (question.answers && question.answers.length > 0) {
                    question.answers.forEach((answer, aIndex) => {
                        const answerStmt = db.prepare(`
                            INSERT INTO test_answers (question_id, answer_text, is_correct, order_index)
                            VALUES (?, ?, ?, ?)
                        `);
                        answerStmt.run([
                            questionId,
                            answer.text,
                            answer.is_correct ? 1 : 0,
                            aIndex
                        ]);
                        answerStmt.free();
                    });
                }
            });
        }
        
        // Оновлення курсу з test_id
        const updateCourseStmt = db.prepare("UPDATE courses SET test_id = ? WHERE id = ?");
        updateCourseStmt.run([testId, course_id]);
        updateCourseStmt.free();
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: testId,
                course_id: course_id,
                title: title
            }
        };
    },
    
    async updateTest(testId, data, userId) {
        const { course_id, title, description, passing_score, time_limit, questions } = data;
        
        // Оновлення тесту
        const updateTestStmt = db.prepare(`
            UPDATE tests 
            SET title = ?, description = ?, passing_score = ?, time_limit = ?
            WHERE id = ?
        `);
        updateTestStmt.run([title, description || '', passing_score || 70, time_limit || null, testId]);
        updateTestStmt.free();
        
        // Видалення старих питань та відповідей
        const deleteAnswersStmt = db.prepare(`
            DELETE FROM test_answers 
            WHERE question_id IN (SELECT id FROM test_questions WHERE test_id = ?)
        `);
        deleteAnswersStmt.run([testId]);
        deleteAnswersStmt.free();
        
        const deleteQuestionsStmt = db.prepare("DELETE FROM test_questions WHERE test_id = ?");
        deleteQuestionsStmt.run([testId]);
        deleteQuestionsStmt.free();
        
        // Створення нових питань та відповідей
        if (questions && questions.length > 0) {
            questions.forEach((question, qIndex) => {
                const questionStmt = db.prepare(`
                    INSERT INTO test_questions (test_id, question_text, question_type, points, order_index)
                    VALUES (?, ?, ?, ?, ?)
                `);
                questionStmt.run([
                    testId,
                    question.question_text,
                    question.question_type || 'single',
                    question.points || 1,
                    question.order_index || qIndex
                ]);
                const questionId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
                questionStmt.free();
                
                // Створення відповідей
                if (question.answers && question.answers.length > 0) {
                    question.answers.forEach((answer, aIndex) => {
                        const answerStmt = db.prepare(`
                            INSERT INTO test_answers (question_id, answer_text, is_correct, order_index)
                            VALUES (?, ?, ?, ?)
                        `);
                        answerStmt.run([
                            questionId,
                            answer.text,
                            answer.is_correct ? 1 : 0,
                            aIndex
                        ]);
                        answerStmt.free();
                    });
                }
            });
        }
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                id: testId,
                course_id: course_id,
                title: title
            }
        };
    },
    
    async getTest(testId) {
        try {
            const testResult = db.exec(`SELECT * FROM tests WHERE id = ${testId}`);
            if (!testResult[0] || !testResult[0].values.length) {
                throw new Error('Тест не знайдено');
            }
            
            const testRow = testResult[0].values[0];
            const test = {
                id: testRow[0],
                title: testRow[1],
                description: testRow[2] || null,
                material_id: testRow[3] || null,
                course_id: testRow[4] || null,
                passing_score: testRow[5] || 70,
                time_limit: testRow[6] || null,
                created_by: testRow[7],
                is_active: testRow[8] || 1,
                created_at: testRow[9] || null
            };
            
            // Отримуємо питання
            const questionsResult = db.exec(`SELECT * FROM test_questions WHERE test_id = ${testId} ORDER BY order_index`);
            test.questions = [];
            
            if (questionsResult[0] && questionsResult[0].values) {
                for (const qRow of questionsResult[0].values) {
                    const questionId = qRow[0];
                    const question = {
                        id: questionId,
                        test_id: qRow[1],
                        question_text: qRow[2],
                        question_type: qRow[3] || 'single',
                        order_index: qRow[4] || 0,
                        points: qRow[5] || 1,
                        created_at: qRow[6] || null
                    };
                    
                    // Отримуємо відповіді
                    const answersResult = db.exec(`SELECT * FROM test_answers WHERE question_id = ${questionId} ORDER BY order_index`);
                    question.answers = [];
                    
                    if (answersResult[0] && answersResult[0].values) {
                        question.answers = answersResult[0].values.map(aRow => ({
                            id: aRow[0],
                            question_id: aRow[1],
                            answer_text: aRow[2],
                            is_correct: aRow[3] === 1,
                            order_index: aRow[4] || 0
                        }));
                    }
                    
                    test.questions.push(question);
                }
            }
            
            return { success: true, data: test };
        } catch (error) {
            console.error('Error loading test:', error);
            throw error;
        }
    },
    
    async submitTest(testId, data, userId) {
        const { answers } = data;
        
        // Отримуємо тест з правильними відповідями
        const testData = await this.getTest(testId);
        const test = testData.data;
        
        let score = 0;
        let maxScore = 0;
        const details = [];
        let correctCount = 0;
        let incorrectCount = 0;
        
        // Перевіряємо відповіді
        test.questions.forEach((question, index) => {
            maxScore += question.points || 1;
            const questionKey = `q-${question.id || index}`;
            const userAnswer = answers[questionKey];
            
            let isCorrect = false;
            let correctAnswer = '';
            let userAnswerText = '';
            
            if (question.question_type === 'text') {
                // Текстова відповідь - завжди неправильна (потрібна ручна перевірка)
                isCorrect = false;
                userAnswerText = userAnswer || 'Не відповіли';
                correctAnswer = 'Потрібна ручна перевірка';
            } else {
                // Вибір з варіантів
                // Створюємо мапу для швидкого пошуку відповідей
                const answerMap = new Map();
                question.answers.forEach((a, idx) => {
                    const answerKey = String(a.id !== undefined ? a.id : idx);
                    answerMap.set(answerKey, a);
                });
                
                // Отримуємо правильні відповіді
                const correctAnswers = question.answers
                    .map((a, idx) => ({ answer: a, key: String(a.id !== undefined ? a.id : idx) }))
                    .filter(item => item.answer.is_correct)
                    .map(item => item.key);
                
                if (question.question_type === 'single') {
                    // Один правильний варіант
                    const userAnswerStr = String(userAnswer || '');
                    isCorrect = correctAnswers.includes(userAnswerStr);
                    const userAnswerObj = answerMap.get(userAnswerStr);
                    userAnswerText = userAnswerObj ? (userAnswerObj.answer_text || userAnswerObj.text || 'Невідомо') : 'Не відповіли';
                    const correctAnswerObj = question.answers.find(a => a.is_correct);
                    correctAnswer = correctAnswerObj ? (correctAnswerObj.answer_text || correctAnswerObj.text || '') : '';
                } else {
                    // Кілька правильних варіантів
                    const userAnswersArray = Array.isArray(userAnswer) 
                        ? userAnswer.map(String) 
                        : (userAnswer ? [String(userAnswer)] : []);
                    
                    // Перевіряємо чи всі правильні відповіді вибрані і чи немає зайвих
                    const correctSet = new Set(correctAnswers);
                    const userSet = new Set(userAnswersArray);
                    
                    isCorrect = correctSet.size === userSet.size && 
                               correctAnswers.every(ans => userSet.has(ans));
                    
                    userAnswerText = userAnswersArray.map(ans => {
                        const answerObj = answerMap.get(ans);
                        return answerObj ? (answerObj.answer_text || answerObj.text || 'Невідомо') : 'Невідомо';
                    }).join(', ') || 'Не відповіли';
                    
                    correctAnswer = question.answers
                        .filter(a => a.is_correct)
                        .map(a => a.answer_text || a.text || '')
                        .join(', ');
                }
            }
            
            if (isCorrect) {
                score += question.points || 1;
                correctCount++;
            } else {
                incorrectCount++;
            }
            
            details.push({
                question_text: question.question_text,
                user_answer: userAnswerText,
                correct_answer: correctAnswer,
                correct: isCorrect,
                points: isCorrect ? (question.points || 1) : 0
            });
        });
        
        const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
        const passed = percentage >= test.passing_score;
        
        // Зберігаємо результат
        const resultStmt = db.prepare(`
            INSERT INTO test_results (test_id, user_id, score, max_score, percentage, passed, answers, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        resultStmt.run([
            testId,
            userId,
            score,
            maxScore,
            percentage,
            passed ? 1 : 0,
            JSON.stringify(answers)
        ]);
        resultStmt.free();
        
        // Оновлюємо статус курсу якщо тест пройдено
        if (passed && test.course_id) {
            try {
                const updateStmt = db.prepare(`
                    UPDATE user_courses 
                    SET status = 'completed', completed_at = datetime('now'), progress = 100
                    WHERE user_id = ? AND course_id = ?
                `);
                updateStmt.run([userId, test.course_id]);
                updateStmt.free();
            } catch (e) {
                console.warn('Could not update course status:', e);
            }
        }
        
        saveDatabase();
        
        return {
            success: true,
            data: {
                score: score,
                max_score: maxScore,
                percentage: percentage,
                passed: passed,
                correct_answers: correctCount,
                incorrect_answers: incorrectCount,
                details: details
            }
        };
    }
};

// Експорт глобально
if (typeof window !== 'undefined') {
    window.localAuth = localAuth;
    window.localKnowledge = localKnowledge;
    window.localCourses = localCourses;
    window.localCrews = localCrews;
    window.localEquipmentTypes = localEquipmentTypes;
    window.localEquipment = localEquipment;
    window.localPersonnel = localPersonnel;
    window.localProfile = localProfile;
    window.localAdmin = localAdmin;
    window.localTests = localTests;
}

// Експорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        localAuth,
        localKnowledge,
        localCourses,
        localProfile
    };
}


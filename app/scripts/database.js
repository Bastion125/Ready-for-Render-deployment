// Локальна база даних через SQL.js
let db = null;
let SQL = null;
const DB_STORAGE_KEY = 'bpsTrainingDb';
const DB_NAME = 'bpsTrainingDB';
const DB_VERSION = 1;
const DB_STORE_NAME = 'database';

// IndexedDB для зберігання БД
let idb = null;
let idbDb = null;

// Ініціалізація IndexedDB
async function initIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.warn('IndexedDB не підтримується, використовуємо localStorage');
            resolve(false);
            return;
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Помилка відкриття IndexedDB:', request.error);
            resolve(false);
        };
        
        request.onsuccess = () => {
            idbDb = request.result;
            console.log('IndexedDB успішно відкрито');
            resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
                db.createObjectStore(DB_STORE_NAME);
            }
        };
    });
}

// Збереження БД в IndexedDB
async function saveToIndexedDB(data) {
    if (!idbDb) {
        const initialized = await initIndexedDB();
        if (!initialized || !idbDb) {
            return false;
        }
    }
    
    return new Promise((resolve, reject) => {
        const transaction = idbDb.transaction([DB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(DB_STORE_NAME);
        const request = store.put(data, 'database');
        
        request.onsuccess = () => {
            console.log('БД збережена в IndexedDB');
            resolve(true);
        };
        
        request.onerror = () => {
            console.error('Помилка збереження в IndexedDB:', request.error);
            resolve(false);
        };
    });
}

// Завантаження БД з IndexedDB
async function loadFromIndexedDB() {
    if (!idbDb) {
        const initialized = await initIndexedDB();
        if (!initialized || !idbDb) {
            return null;
        }
    }
    
    return new Promise((resolve, reject) => {
        const transaction = idbDb.transaction([DB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(DB_STORE_NAME);
        const request = store.get('database');
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Помилка завантаження з IndexedDB:', request.error);
            resolve(null);
        };
    });
}

// Міграція з localStorage на IndexedDB
async function migrateFromLocalStorage() {
    try {
        const savedDb = localStorage.getItem(DB_STORAGE_KEY);
        if (savedDb) {
            const uint8Array = new Uint8Array(JSON.parse(savedDb));
            const success = await saveToIndexedDB(uint8Array);
            if (success) {
                // Видаляємо з localStorage після успішної міграції
                localStorage.removeItem(DB_STORAGE_KEY);
                console.log('БД мігрована з localStorage на IndexedDB');
                return uint8Array;
            }
        }
    } catch (e) {
        console.warn('Помилка міграції з localStorage:', e);
    }
    return null;
}

// Ініціалізація бази даних
async function initDatabase() {
    try {
        // Перевірка чи БД вже ініціалізована
        if (db !== null && db !== undefined) {
            try {
                // Перевіряємо чи БД дійсно працює
                db.exec("SELECT 1");
                console.log('База даних вже ініціалізована');
                return true;
            } catch (e) {
                // БД не працює, потрібно переініціалізувати
                console.warn('База даних існує, але не працює. Переініціалізація...');
                db = null;
            }
        }
        
        console.log('Ініціалізація локальної бази даних...');
        
        // Завантаження SQL.js
        if (typeof initSqlJs === 'undefined') {
            console.error('SQL.js не завантажено');
            if (typeof showNotification === 'function') {
                showNotification('Помилка: SQL.js не завантажено. Перезавантажте сторінку.', 'error');
            }
            return false;
        }
        
        SQL = await initSqlJs({
            locateFile: file => `https://unpkg.com/sql.js@1.8.0/dist/${file}`
        });
        
        if (!SQL) {
            throw new Error('Не вдалося ініціалізувати SQL.js');
        }
        
        console.log('SQL.js успішно завантажено');
        
        // Ініціалізуємо IndexedDB
        await initIndexedDB();
        
        // Завантаження або створення БД
        // Спочатку пробуємо завантажити з IndexedDB
        let savedDb = await loadFromIndexedDB();
        
        // Якщо в IndexedDB немає, пробуємо мігрувати з localStorage
        if (!savedDb) {
            savedDb = await migrateFromLocalStorage();
        }
        
        // Якщо все ще немає, пробуємо localStorage (fallback)
        if (!savedDb) {
            try {
                const localStorageData = localStorage.getItem(DB_STORAGE_KEY);
                if (localStorageData) {
                    savedDb = new Uint8Array(JSON.parse(localStorageData));
                }
            } catch (e) {
                console.warn('Не вдалося прочитати localStorage:', e);
                if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                    console.warn('localStorage переповнений. Використовуємо IndexedDB.');
                }
            }
        }
        
        if (savedDb) {
            try {
                console.log('Завантаження збереженої бази даних...');
                db = new SQL.Database(savedDb);
                console.log('База даних завантажена');
            } catch (e) {
                console.error('Помилка завантаження БД:', e);
                db = new SQL.Database();
            }
        } else {
            console.log('Створення нової бази даних...');
            db = new SQL.Database();
        }
        
        // Увімкнути FOREIGN KEY constraints
        db.run("PRAGMA foreign_keys = ON");
        
        // Створити таблиці якщо їх немає (чекаємо завершення)
        await createTables();
        
        // Оновлюємо глобальну змінну для сумісності
        if (typeof window !== 'undefined') {
            window.db = db;
        }
        
        // Автоматичне збереження при змінах
        setupAutoSave();
        
        console.log('База даних успішно ініціалізована та готова до використання');
        return true;
    } catch (error) {
        console.error('Помилка ініціалізації БД:', error);
        console.error('Stack trace:', error.stack);
        if (typeof showNotification === 'function') {
            showNotification('Помилка ініціалізації бази даних: ' + (error.message || 'невідома помилка'), 'error');
        }
        // Скидаємо db на null у разі помилки
        db = null;
        if (typeof window !== 'undefined') {
            window.db = null;
        }
        return false;
    }
}

// Створення таблиць
async function createTables() {
    if (!db) return;
    
    try {
        // Перевірка чи існують таблиці
        db.exec("SELECT COUNT(*) FROM users");
        console.log('Таблиці вже існують');
        // Перевіряємо чи є адмін, якщо ні - створюємо
        await createSystemAdmin().catch(e => console.error('Помилка створення адміністратора:', e));
        return;
    } catch (e) {
        console.log('Створення таблиць...');
    }
    
    // Виконати SQL зі схеми
    const schema = getDatabaseSchema();
    db.exec(schema);
    
    // Створити системного адміністратора (чекаємо завершення)
    await createSystemAdmin().catch(e => console.error('Помилка створення адміністратора:', e));
    
    // Створити тестових людей (асинхронно, не блокуємо)
    createTestPersonnel().catch(e => console.error('Помилка створення тестового персоналу:', e));
    
    console.log('Таблиці створено');
}

// SQL схема для SQLite
function getDatabaseSchema() {
    return `
        -- Користувачі
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password TEXT, -- Пароль у відкритому вигляді для адмін панелі (тільки локальна версія)
            role TEXT NOT NULL DEFAULT 'User' CHECK(role IN ('SystemAdmin', 'Admin', 'Readit', 'User')),
            is_active INTEGER DEFAULT 1,
            last_login TEXT,
            last_activity TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Сесії
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_token TEXT NOT NULL UNIQUE,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL,
            last_activity TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Підрозділи
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            code TEXT,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Персонал
        CREATE TABLE IF NOT EXISTS personnel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shpk TEXT UNIQUE,
            full_name TEXT NOT NULL,
            position TEXT NOT NULL,
            rank TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            unit_id INTEGER REFERENCES units(id),
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            combat_zone_access INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Категорії Бази знань
        CREATE TABLE IF NOT EXISTS knowledge_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            parent_id INTEGER REFERENCES knowledge_categories(id) ON DELETE CASCADE,
            order_index INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Матеріали Бази знань
        CREATE TABLE IF NOT EXISTS knowledge_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES knowledge_categories(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            content TEXT,
            material_type TEXT NOT NULL CHECK(material_type IN ('text', 'pdf', 'video')),
            file_path TEXT,
            file_data BLOB,
            file_size INTEGER,
            mime_type TEXT,
            created_by INTEGER NOT NULL REFERENCES users(id),
            is_published INTEGER DEFAULT 1,
            order_index INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            avatar_path TEXT,
            avatar_data BLOB
        );

        -- Тести
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            material_id INTEGER REFERENCES knowledge_materials(id) ON DELETE SET NULL,
            course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
            passing_score INTEGER DEFAULT 70,
            time_limit INTEGER,
            created_by INTEGER NOT NULL REFERENCES users(id),
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Питання тестів
        CREATE TABLE IF NOT EXISTS test_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            question_type TEXT NOT NULL DEFAULT 'single' CHECK(question_type IN ('single', 'multiple', 'text')),
            order_index INTEGER DEFAULT 0,
            points INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Варіанти відповідей
        CREATE TABLE IF NOT EXISTS test_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
            answer_text TEXT NOT NULL,
            is_correct INTEGER DEFAULT 0,
            order_index INTEGER DEFAULT 0
        );

        -- Результати тестувань
        CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            score INTEGER NOT NULL,
            max_score INTEGER NOT NULL,
            percentage REAL NOT NULL,
            passed INTEGER NOT NULL,
            time_spent INTEGER,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            answers TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Курси
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            content TEXT,
            test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL,
            created_by INTEGER NOT NULL REFERENCES users(id),
            is_published INTEGER DEFAULT 0,
            order_index INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            avatar_path TEXT,
            avatar_data BLOB
        );

        -- Модулі курсів
        CREATE TABLE IF NOT EXISTS course_modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            order_index INTEGER DEFAULT 0,
            requires_previous_module_id INTEGER REFERENCES course_modules(id) ON DELETE SET NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Уроки модулів
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_id INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            content_type TEXT NOT NULL DEFAULT 'text' CHECK(content_type IN ('text', 'video', 'pdf', 'mixed')),
            text_content TEXT,
            video_path TEXT,
            pdf_path TEXT,
            video_data BLOB,
            pdf_data BLOB,
            mime_type TEXT,
            file_size INTEGER,
            minimum_time_seconds INTEGER DEFAULT 180,
            order_index INTEGER DEFAULT 0,
            requires_previous_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Прогрес користувачів по модулях
        CREATE TABLE IF NOT EXISTS user_modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            module_id INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
            status TEXT DEFAULT 'locked' CHECK(status IN ('locked', 'unlocked', 'in_progress', 'completed')),
            started_at TEXT,
            completed_at TEXT,
            progress INTEGER DEFAULT 0,
            UNIQUE(user_id, module_id)
        );

        -- Прогрес користувачів по уроках
        CREATE TABLE IF NOT EXISTS user_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
            is_completed INTEGER DEFAULT 0,
            time_on_page_seconds INTEGER DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            UNIQUE(user_id, lesson_id)
        );

        -- Матеріали курсів
        CREATE TABLE IF NOT EXISTS course_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            material_id INTEGER NOT NULL REFERENCES knowledge_materials(id) ON DELETE CASCADE,
            order_index INTEGER DEFAULT 0,
            UNIQUE(course_id, material_id)
        );

        -- Пройдені курси
        CREATE TABLE IF NOT EXISTS user_courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            started_at TEXT,
            completed_at TEXT,
            progress INTEGER DEFAULT 0,
            status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'in_progress', 'completed', 'failed')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
        );

        -- Практика (відео)
        CREATE TABLE IF NOT EXISTS practice_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            video_data BLOB,
            video_path TEXT,
            thumbnail_path TEXT,
            duration INTEGER,
            uploaded_by INTEGER NOT NULL REFERENCES users(id),
            category TEXT,
            is_published INTEGER DEFAULT 0,
            views_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Перегляди відео
        CREATE TABLE IF NOT EXISTS video_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL REFERENCES practice_videos(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            watched_duration INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            viewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(video_id, user_id)
        );

        -- Історія навчання
        CREATE TABLE IF NOT EXISTS learning_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('course', 'material', 'test', 'video')),
            entity_id INTEGER NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('viewed', 'started', 'completed', 'passed', 'failed')),
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Екіпажі
        CREATE TABLE IF NOT EXISTS crews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            uav_type TEXT NOT NULL,
            avatar_path TEXT,
            avatar_data BLOB,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Члени екіпажів
        CREATE TABLE IF NOT EXISTS crew_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
            personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            role TEXT,
            UNIQUE(crew_id, personnel_id)
        );

        -- Типи засобів
        CREATE TABLE IF NOT EXISTS equipment_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Засоби (БПЛА, обладнання)
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
        );

        -- Індекси
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_knowledge_materials_category ON knowledge_materials(category_id);
        CREATE INDEX IF NOT EXISTS idx_user_courses_user_id ON user_courses(user_id);
        CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
        CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id ON crew_members(crew_id);
        CREATE INDEX IF NOT EXISTS idx_crew_members_personnel_id ON crew_members(personnel_id);
    `;
}

// Створення системного адміністратора
async function createSystemAdmin() {
    if (!db) return;
    
    try {
        // Перевірка чи вже існує
        const result = db.exec("SELECT id FROM users WHERE email = 'system@bps.local'");
        if (result.length > 0 && result[0] && result[0].values.length > 0) {
            console.log('Системний адміністратор вже існує');
            return;
        }
        
        // Хеш пароля: SystemAdmin123! (SHA-256 для локальної версії)
        const password = 'SystemAdmin123!';
        const passwordHash = await hashPassword(password);
        
        const stmt = db.prepare(
            `INSERT INTO users (full_name, email, password_hash, role, is_active)
             VALUES (?, ?, ?, ?, ?)`
        );
        stmt.run(['System Administrator', 'system@bps.local', passwordHash, 'SystemAdmin', 1]);
        stmt.free();
        
        saveDatabase();
        console.log('Системний адміністратор створено');
    } catch (e) {
        console.error('Помилка створення системного адміністратора:', e);
    }
}

// Створення тестового персоналу
async function createTestPersonnel() {
    if (!db) return;
    
    try {
        // Завжди створюємо тестових людей (якщо їх немає)
        const checkResult = db.exec("SELECT COUNT(*) FROM personnel WHERE email IN ('pilot1@test.local', 'pilot2@test.local')");
        const existingCount = checkResult.length > 0 && checkResult[0].values.length > 0 ? checkResult[0].values[0][0] : 0;
        
        if (existingCount >= 2) {
            console.log('Тестовий персонал вже існує');
            return;
        }
        
        // Створюємо підрозділ якщо немає
        let unitId = null;
        try {
            const unitCheck = db.exec("SELECT id FROM units LIMIT 1");
            if (unitCheck.length > 0 && unitCheck[0].values.length > 0) {
                unitId = unitCheck[0].values[0][0];
            } else {
                const unitStmt = db.prepare("INSERT INTO units (name, code) VALUES (?, ?)");
                unitStmt.run(['Тестовий підрозділ', 'TEST-001']);
                unitStmt.free();
                const unitResult = db.exec("SELECT last_insert_rowid()");
                unitId = unitResult[0].values[0][0];
            }
        } catch (e) {
            console.warn('Could not create unit:', e);
        }
        
        // Тестові люди
        const testPersonnel = [
            {
                shpk: '12345',
                full_name: 'Іванов Іван Іванович',
                position: 'Пілот БПЛА',
                rank: 'лейтенант',
                phone: '+380501234567',
                email: 'pilot1@test.local',
                unit_id: unitId
            },
            {
                shpk: '12346',
                full_name: 'Петров Петро Петрович',
                position: 'Пілот ретранслятора',
                rank: 'старший лейтенант',
                phone: '+380501234568',
                email: 'pilot2@test.local',
                unit_id: unitId
            }
        ];
        
        const stmt = db.prepare(`
            INSERT INTO personnel (shpk, full_name, position, rank, phone, email, unit_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const person of testPersonnel) {
            try {
                stmt.run([
                    person.shpk,
                    person.full_name,
                    person.position,
                    person.rank,
                    person.phone,
                    person.email,
                    person.unit_id
                ]);
            } catch (e) {
                // Можливо вже існує
                console.warn('Could not insert test personnel:', person.full_name, e);
            }
        }
        stmt.free();
        
        saveDatabase();
        console.log('Тестовий персонал створено');
    } catch (e) {
        console.error('Помилка створення тестового персоналу:', e);
    }
}

// Хешування пароля (простий SHA-256 для локальної версії)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Перевірка пароля
async function verifyPassword(password, hash) {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}

// Автоматичне збереження
function setupAutoSave() {
    // Зберігаємо БД в localStorage при змінах
    setInterval(() => {
        if (db) {
            saveDatabase();
        }
    }, 30000); // Кожні 30 секунд
}

// Збереження бази даних
function saveDatabase() {
    // Не зберігаємо одразу, щоб уникнути перевантаження
    // Використовуємо debounce
    if (saveDatabase.timeout) {
        clearTimeout(saveDatabase.timeout);
    }
    saveDatabase.timeout = setTimeout(() => {
        saveDatabaseNow();
    }, 1000); // Зберігаємо через 1 секунду після останньої зміни
}

async function saveDatabaseNow() {
    if (!db) return;
    
    try {
        const data = db.export();
        const uint8Array = new Uint8Array(data);
        const sizeInMB = (uint8Array.length) / (1024 * 1024); // Розмір в MB
        
        // Перевірка розміру перед збереженням
        if (sizeInMB > 50) {
            console.warn(`Розмір БД великий: ${sizeInMB.toFixed(2)}MB. Рекомендується експортувати у файл.`);
            if (!window.largeDbWarningShown) {
                window.largeDbWarningShown = true;
                setTimeout(() => {
                    showNotification(`Увага: Розмір бази даних великий (${sizeInMB.toFixed(2)}MB). Рекомендується експортувати у файл.`, 'warning');
                }, 1000);
            }
        }
        
        // Спочатку пробуємо зберегти в IndexedDB
        const savedToIndexedDB = await saveToIndexedDB(uint8Array);
        
        if (savedToIndexedDB) {
            console.log('База даних збережена в IndexedDB');
            // Якщо успішно збережено в IndexedDB, видаляємо з localStorage (якщо там є)
            try {
                localStorage.removeItem(DB_STORAGE_KEY);
            } catch (e) {
                // Ігноруємо помилки
            }
        } else {
            // Fallback до localStorage (якщо IndexedDB недоступний)
            try {
                const jsonData = JSON.stringify(Array.from(uint8Array));
                localStorage.setItem(DB_STORAGE_KEY, jsonData);
                console.log('База даних збережена в localStorage');
            } catch (e) {
                console.error('Помилка збереження БД:', e);
                if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                    const errorMsg = 'Перевищено ліміт сховища. Будь ласка, експортуйте базу даних у файл.';
                    if (!window.quotaWarningShown) {
                        window.quotaWarningShown = true;
                        setTimeout(() => {
                            showNotification(errorMsg, 'error');
                            if (confirm('Перевищено ліміт сховища. Експортувати базу даних у файл зараз?')) {
                                exportDatabaseToFile();
                            }
                        }, 1000);
                    }
                } else {
                    showNotification('Помилка збереження бази даних: ' + (e.message || 'невідома помилка'), 'error');
                }
            }
        }
    } catch (e) {
        console.error('Помилка збереження БД:', e);
        showNotification('Помилка збереження бази даних: ' + (e.message || 'невідома помилка'), 'error');
    }
}

// Експорт бази даних у файл
async function exportDatabaseToFile() {
    if (!db) {
        showNotification('База даних не ініціалізована', 'error');
        return;
    }
    
    try {
        const data = db.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        a.download = `bps-training-db-${timestamp}.sqlite`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('База даних експортована', 'success');
    } catch (e) {
        console.error('Помилка експорту:', e);
        showNotification('Помилка експорту бази даних', 'error');
    }
}

// Імпорт бази даних з файлу
async function importDatabaseFromFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sqlite,.db';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                reject(new Error('Файл не вибрано'));
                return;
            }
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                db = new SQL.Database(uint8Array);
                db.run("PRAGMA foreign_keys = ON");
                
                // Зберігаємо в IndexedDB
                await saveToIndexedDB(uint8Array);
                
                // Видаляємо з localStorage якщо там є
                try {
                    localStorage.removeItem(DB_STORAGE_KEY);
                } catch (e) {
                    // Ігноруємо помилки
                }
                
                showNotification('База даних імпортована та збережена в IndexedDB', 'success');
                resolve(true);
            } catch (e) {
                console.error('Помилка імпорту:', e);
                showNotification('Помилка імпорту бази даних', 'error');
                reject(e);
            }
        };
        input.click();
    });
}

// Очищення сховища БД
async function clearDatabaseStorage() {
    if (!confirm('Ви впевнені, що хочете очистити сховище БД? Це видалить всі дані з IndexedDB та localStorage. Рекомендується спочатку експортувати БД.')) {
        return;
    }
    
    try {
        // Очищаємо IndexedDB
        if (idbDb) {
            const transaction = idbDb.transaction([DB_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(DB_STORE_NAME);
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        
        // Очищаємо localStorage
        try {
            localStorage.removeItem(DB_STORAGE_KEY);
        } catch (e) {
            console.warn('Не вдалося очистити localStorage:', e);
        }
        
        showNotification('Сховище БД очищено. Перезавантажте сторінку.', 'success');
    } catch (e) {
        console.error('Помилка очищення сховища:', e);
        showNotification('Помилка очищення сховища БД', 'error');
    }
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.initDatabase = initDatabase;
    window.getDb = () => db;
    window.getSQL = () => SQL;
    window.db = db; // Для сумісності зі старим кодом
    window.saveDatabase = saveDatabase;
    window.exportDatabaseToFile = exportDatabaseToFile;
    window.importDatabaseFromFile = importDatabaseFromFile;
    window.clearDatabaseStorage = clearDatabaseStorage;
}

// Експорт функцій
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initDatabase,
        db: () => db,
        SQL: () => SQL,
        saveDatabase,
        exportDatabaseToFile,
        importDatabaseFromFile,
        hashPassword,
        verifyPassword
    };
}


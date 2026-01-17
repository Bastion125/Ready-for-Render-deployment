// API Configuration
// Визначаємо базовий URL для API в залежності від середовища
const IS_BROWSER = typeof window !== 'undefined';
const IS_LOCALHOST = IS_BROWSER && (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'));

function parseBoolean(value) {
    if (value === null || value === undefined) return null;
    const v = String(value).trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'y') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'n') return false;
    return null;
}

function getRuntimeConfig() {
    if (!IS_BROWSER) return {};

    const cfg = (window.__APP_CONFIG__ && typeof window.__APP_CONFIG__ === 'object')
        ? window.__APP_CONFIG__
        : {};

    const params = new URLSearchParams(window.location.search);
    const ls = window.localStorage || null;

    return {
        apiBaseUrl: cfg.apiBaseUrl || (ls ? ls.getItem('API_BASE_URL') : null) || null,
        remoteApiUrl: cfg.remoteApiUrl || (ls ? ls.getItem('REMOTE_API_URL') : null) || null,
        useLocalDb: parseBoolean(params.get('localDb'))
            ?? parseBoolean(cfg.useLocalDb)
            ?? parseBoolean(ls ? ls.getItem('USE_LOCAL_DB') : null),
    };
}

// Локально використовуємо backend на 3000 порту, у проді - Render backend
// 
// ⚠️ ВАЖЛИВО: Для деплою встановіть URL через один з способів:
// 1. Через localStorage: localStorage.setItem('REMOTE_API_URL', 'https://your-domain.onrender.com/api')
// 2. Через window.__APP_CONFIG__: window.__APP_CONFIG__ = { remoteApiUrl: 'https://your-domain.onrender.com/api' }
// 3. Через URL параметр: ?apiUrl=https://your-domain.onrender.com/api
// 
// Приклад:
// Render URL: https://training-recording-backend.onrender.com
// API URL: https://training-recording-backend.onrender.com/api
//
// Детальна інструкція: див. RENDER_DEPLOY.md

// Render backend URL - fallback (використовується тільки якщо не встановлено через runtime config)
// Для GitHub Pages встановіть через localStorage або window.__APP_CONFIG__
const DEFAULT_RENDER_API_URL = 'https://training-recording-backend.onrender.com/api';

const runtimeConfig = getRuntimeConfig();

// Функція для валідації та санитизації API URL
function validateAndSanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    const trimmedUrl = url.trim();
    
    // Перевіряємо чи URL не містить закодовані символи, що вказують на проблему (наприклад, xn--_)
    if (trimmedUrl.includes('xn--_') || trimmedUrl.includes('xn--_railway_domain')) {
        console.warn('⚠️ Виявлено пошкоджений URL:', trimmedUrl);
        // Очищаємо localStorage від пошкодженого URL
        if (IS_BROWSER && window.localStorage) {
            window.localStorage.removeItem('API_BASE_URL');
            window.localStorage.removeItem('REMOTE_API_URL');
        }
        return null;
    }
    
    // Перевіряємо базовий формат URL
    try {
        const urlObj = new URL(trimmedUrl);
        // Перевіряємо чи це HTTP/HTTPS протокол
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return null;
        }
        return trimmedUrl;
    } catch (e) {
        // Якщо URL невалідний, повертаємо null
        console.warn('⚠️ Невінідний API URL:', trimmedUrl, e);
        return null;
    }
}

// Функція для визначення API URL
function getApiBaseUrl() {
    // 1. Перевіряємо runtime config (найвищий пріоритет)
    if (runtimeConfig.apiBaseUrl) {
        const validated = validateAndSanitizeUrl(runtimeConfig.apiBaseUrl);
        if (validated) return validated;
    }
    
    // 2. Перевіряємо remoteApiUrl з runtime config
    if (runtimeConfig.remoteApiUrl) {
        const validated = validateAndSanitizeUrl(runtimeConfig.remoteApiUrl);
        if (validated) return validated;
    }
    
    // 3. Для localhost використовуємо локальний сервер
    if (IS_LOCALHOST) {
        return 'http://localhost:3000/api';
    }
    
    // 4. Для GitHub Pages перевіряємо URL параметр
    if (IS_BROWSER) {
        const params = new URLSearchParams(window.location.search);
        const apiUrlParam = params.get('apiUrl');
        if (apiUrlParam) {
            const validated = validateAndSanitizeUrl(apiUrlParam);
            if (validated) {
                // Зберігаємо в localStorage для наступних завантажень
                if (window.localStorage) {
                    window.localStorage.setItem('REMOTE_API_URL', validated);
                }
                return validated;
            }
        }
    }
    
    // 5. Fallback до Render URL (якщо встановлено)
    if (DEFAULT_RENDER_API_URL && !DEFAULT_RENDER_API_URL.includes('ВАШ_')) {
        return DEFAULT_RENDER_API_URL;
    }
    
    // 6. Останній fallback - спроба визначити з поточного домену (для GitHub Pages)
    if (IS_BROWSER && window.location.origin.includes('github.io')) {
        // Для GitHub Pages потрібно встановити Render URL вручну
        console.warn('⚠️ Render API URL не встановлено. Встановіть через localStorage.setItem("REMOTE_API_URL", "https://your-domain.onrender.com/api")');
        // Повертаємо null, щоб викликати помилку
        return null;
    }
    
    return DEFAULT_RENDER_API_URL;
}

const API_BASE_URL = getApiBaseUrl();

// Використовувати backend API (а не локальну SQLite в браузері)
const USE_LOCAL_DB = runtimeConfig.useLocalDb ?? false;

// API Service
const api = {
    // Auth endpoints
    async register(data) {
        if (USE_LOCAL_DB) {
            return localAuth.register(data);
        }
        return fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
    },

    async login(data) {
        if (USE_LOCAL_DB) {
            return localAuth.login(data);
        }
        
        // Перевіряємо чи API_BASE_URL встановлено
        if (!API_BASE_URL) {
            const errorMsg = 'API URL не налаштовано. Встановіть Render URL через localStorage.setItem("REMOTE_API_URL", "https://your-domain.onrender.com/api")';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            // Перевіряємо чи це CORS помилка
            if (response.status === 0 || response.type === 'opaque') {
                throw new Error('CORS помилка: Backend не дозволяє запити з цього домену. Перевірте CORS налаштування на сервері.');
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Помилка сервера: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            console.error('API connection error:', error);
            
            // Якщо це помилка мережі (CORS, timeout, тощо)
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                const apiUrl = API_BASE_URL || 'не налаштовано';
                throw new Error(`Не вдалося підключитися до сервера на ${apiUrl}. Перевірте:\n1. Чи запущений backend сервер\n2. Чи правильно налаштовано CORS\n3. Чи правильно встановлено API URL (Render: ${DEFAULT_RENDER_API_URL})`);
            }
            
            throw error;
        }
    },

    async logout() {
        const token = this.getToken();
        if (USE_LOCAL_DB) {
            return localAuth.logout(token);
        }
        return fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async getCurrentUser() {
        const token = this.getToken();
        if (USE_LOCAL_DB) {
            return localAuth.getCurrentUser(token);
        }
        
        if (!token) {
            throw new Error('Токен авторизації відсутній');
        }
        
        if (!API_BASE_URL) {
            throw new Error('API URL не налаштовано');
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            // Перевіряємо чи це CORS помилка
            if (response.status === 0 || response.type === 'opaque') {
                throw new Error('CORS помилка: Backend не дозволяє запити з цього домену');
            }
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.removeToken();
                    throw new Error('Сесія закінчилася. Будь ласка, увійдіть знову.');
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Помилка сервера: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            console.error('API connection error:', error);
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                throw new Error('Не вдалося підключитися до сервера. Перевірте підключення та CORS налаштування.');
            }
            throw error;
        }
    },

    // Knowledge Base endpoints
    async getKnowledgeCategories() {
        if (USE_LOCAL_DB) {
            return localKnowledge.getCategories();
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/knowledge/categories`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createKnowledgeCategory(data) {
        if (USE_LOCAL_DB) {
            const token = this.getToken();
            const userData = await localAuth.getCurrentUser(token);
            return localKnowledge.createCategory(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/knowledge/categories`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async getKnowledgeMaterials(categoryId = null) {
        if (USE_LOCAL_DB) {
            return localKnowledge.getMaterials(categoryId);
        }
        const token = this.getToken();
        const url = categoryId 
            ? `${API_BASE_URL}/knowledge/materials?category_id=${categoryId}`
            : `${API_BASE_URL}/knowledge/materials`;
        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createKnowledgeMaterial(data) {
        if (USE_LOCAL_DB) {
            const token = this.getToken();
            const userData = await localAuth.getCurrentUser(token);
            return localKnowledge.createMaterial(data, userData.user.id);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/knowledge/materials`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },
    
    async updateKnowledgeMaterial(materialId, data) {
        if (USE_LOCAL_DB) {
            return localKnowledge.updateMaterial(materialId, data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/knowledge/materials/${materialId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    // Courses endpoints
    async getCourses() {
        if (USE_LOCAL_DB) {
            const token = this.getToken();
            const userData = await localAuth.getCurrentUser(token);
            if (typeof window !== 'undefined' && window.localCourses) {
                return window.localCourses.getCourses(userData.user.role);
            } else {
                throw new Error('localCourses не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/courses`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createCourse(data) {
        if (USE_LOCAL_DB) {
            const token = this.getToken();
            const userData = await localAuth.getCurrentUser(token);
            if (typeof window !== 'undefined' && window.localCourses) {
                return window.localCourses.createCourse(data, userData.user.id);
            } else {
                throw new Error('localCourses не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/courses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    // Profile endpoints
    async getProfile() {
        if (USE_LOCAL_DB) {
            const token = this.getToken();
            const userData = await localAuth.getCurrentUser(token);
            return localProfile.getProfile(userData.user.id);
        }
        const token = this.getToken();
        if (!token) {
            throw new Error('Токен авторизації відсутній. Будь ласка, увійдіть в систему.');
        }
        
        if (!API_BASE_URL) {
            throw new Error('API URL не налаштовано');
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Токен недійсний - видаляємо його
                    this.removeToken();
                    throw new Error('Сесія закінчилася. Будь ласка, увійдіть знову.');
                }
                if (response.status === 404) {
                    throw new Error('Профіль не знайдено');
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Помилка сервера: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            console.error('Error fetching profile:', error);
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
            }
            throw error;
        }
    },

    // Courses endpoints (додаткові)
    async getCourse(id) {
        if (USE_LOCAL_DB) {
            if (typeof window !== 'undefined' && window.localCourses) {
                return window.localCourses.getCourse(id);
            } else {
                throw new Error('localCourses не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/courses/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async updateCourse(id, data) {
        if (USE_LOCAL_DB) {
            if (typeof window !== 'undefined' && window.localCourses) {
                return window.localCourses.updateCourse(id, data);
            } else {
                throw new Error('localCourses не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/courses/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async startCourse(id) {
        if (USE_LOCAL_DB) {
            if (typeof window !== 'undefined' && window.localCourses) {
                return window.localCourses.startCourse(id);
            } else {
                throw new Error('localCourses не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/courses/${id}/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    // Modules endpoints
    async getCourseModules(courseId) {
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/lessons/modules/${courseId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createModule(data) {
        if (USE_LOCAL_DB) {
            if (typeof window !== 'undefined' && window.localCourses && window.localCourses.createModule) {
                return window.localCourses.createModule(data);
            } else {
                throw new Error('localCourses.createModule не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/lessons/modules`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async updateModule(id, data) {
        if (USE_LOCAL_DB) {
            // TODO: Реалізувати для локальної версії
            throw new Error('Не реалізовано для локальної версії');
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/lessons/modules/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async createLesson(data) {
        if (USE_LOCAL_DB) {
            return localCourses.createLesson(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/lessons/lessons`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    // Lessons endpoints
    async getModuleLessons(moduleId) {
        if (USE_LOCAL_DB) {
            if (typeof window !== 'undefined' && window.localCourses && window.localCourses.getModuleLessons) {
                return window.localCourses.getModuleLessons(moduleId);
            } else {
                throw new Error('localCourses.getModuleLessons не ініціалізовано');
            }
        }
        const token = this.getToken();
        try {
            const response = await fetch(`${API_BASE_URL}/lessons/module/${moduleId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('Error getting module lessons:', error);
            throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
        }
    },

    async getLesson(id) {
        if (USE_LOCAL_DB) {
            return localCourses.getLesson(id);
        }
        const token = this.getToken();
        try {
            const response = await fetch(`${API_BASE_URL}/lessons/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('Error getting lesson:', error);
            throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
        }
    },

    async createLesson(data) {
        if (USE_LOCAL_DB) {
            return localCourses.createLesson(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/lessons/lessons`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async createTest(data) {
        if (USE_LOCAL_DB) {
            // Отримуємо поточного користувача
            const token = this.getToken();
            let userId = null;
            try {
                if (token && typeof window !== 'undefined' && window.localAuth) {
                    const userData = await window.localAuth.getCurrentUser(token);
                    userId = userData.user.id;
                }
            } catch (e) {
                console.warn('Could not get user:', e);
            }
            if (!userId) {
                throw new Error('Користувач не авторизований');
            }
            if (typeof window !== 'undefined' && window.localTests) {
                return window.localTests.createTest(data, userId);
            } else {
                throw new Error('localTests не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/tests`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },
    
    async updateTest(testId, data) {
        if (USE_LOCAL_DB) {
            // Отримуємо поточного користувача
            const token = this.getToken();
            let userId = null;
            try {
                if (token && typeof window !== 'undefined' && window.localAuth) {
                    const userData = await window.localAuth.getCurrentUser(token);
                    userId = userData.user.id;
                }
            } catch (e) {
                console.warn('Could not get user:', e);
            }
            if (!userId) {
                throw new Error('Користувач не авторизований');
            }
            if (typeof window !== 'undefined' && window.localTests) {
                return window.localTests.updateTest(testId, data, userId);
            } else {
                throw new Error('localTests не ініціалізовано');
            }
        }
        const token = this.getToken();
        try {
            const response = await fetch(`${API_BASE_URL}/tests/${testId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('Error updating test:', error);
            throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
        }
    },

    async getTest(testId) {
        if (USE_LOCAL_DB) {
            if (typeof window !== 'undefined' && window.localTests) {
                return window.localTests.getTest(testId);
            } else {
                throw new Error('localTests не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/tests/${testId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async submitTest(testId, data) {
        if (USE_LOCAL_DB) {
            // Отримуємо поточного користувача
            const token = this.getToken();
            let userId = null;
            try {
                if (token && typeof window !== 'undefined' && window.localAuth) {
                    const userData = await window.localAuth.getCurrentUser(token);
                    userId = userData.user.id;
                }
            } catch (e) {
                console.warn('Could not get user:', e);
            }
            if (!userId) {
                throw new Error('Користувач не авторизований');
            }
            if (typeof window !== 'undefined' && window.localTests) {
                return window.localTests.submitTest(testId, data, userId);
            } else {
                throw new Error('localTests не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/tests/${testId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async updateLesson(id, data) {
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/lessons/lessons/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async startLesson(id) {
        if (USE_LOCAL_DB) {
            return localCourses.startLesson(id);
        }
        const token = this.getToken();
        try {
            const response = await fetch(`${API_BASE_URL}/lessons/${id}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('Error starting lesson:', error);
            throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
        }
    },

    async updateLessonTime(id, timeOnPageSeconds) {
        if (USE_LOCAL_DB) {
            return localCourses.updateLessonTime(id, timeOnPageSeconds);
        }
        const token = this.getToken();
        try {
            const response = await fetch(`${API_BASE_URL}/lessons/${id}/time`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ time_on_page_seconds: timeOnPageSeconds })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('Error updating lesson time:', error);
            throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
        }
    },

    async completeLesson(id) {
        if (USE_LOCAL_DB) {
            return localCourses.completeLesson(id);
        }
        const token = this.getToken();
        try {
            const response = await fetch(`${API_BASE_URL}/lessons/${id}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('Error completing lesson:', error);
            throw new Error('Не вдалося підключитися до сервера. Перевірте підключення.');
        }
    },

    async addCourseMaterial(courseId, materialId) {
        if (USE_LOCAL_DB) {
            const token = this.getToken();
            const userData = await localAuth.getCurrentUser(token);
            if (typeof window !== 'undefined' && window.localCourses) {
                return window.localCourses.addCourseMaterial(courseId, materialId);
            } else {
                throw new Error('localCourses не ініціалізовано');
            }
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/courses/${courseId}/materials`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ material_id: materialId })
        });
    },

    // Practice Videos endpoints
    async getPracticeVideos() {
        if (USE_LOCAL_DB) {
            // TODO: Реалізувати для локальної версії
            return { success: true, data: [] };
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/practice/videos`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createPracticeVideo(data) {
        if (USE_LOCAL_DB) {
            // TODO: Реалізувати для локальної версії
            throw new Error('Не реалізовано для локальної версії');
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/practice/videos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    // Personnel endpoints
    async getPersonnel() {
        if (USE_LOCAL_DB) {
            return localPersonnel.getPersonnel();
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/personnel`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createPersonnel(data) {
        if (USE_LOCAL_DB) {
            return localPersonnel.createPersonnel(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/personnel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async updatePersonnel(personnelId, data) {
        if (USE_LOCAL_DB) {
            return localPersonnel.updatePersonnel(personnelId, data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/personnel/${personnelId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async deletePersonnel(personnelId) {
        if (USE_LOCAL_DB) {
            return localPersonnel.deletePersonnel(personnelId);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/personnel/${personnelId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createPersonnelAccount(personnelId, data) {
        if (USE_LOCAL_DB) {
            return localPersonnel.createAccount(personnelId, data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/personnel/${personnelId}/create-account`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async getUnits() {
        if (USE_LOCAL_DB) {
            // TODO: Реалізувати для локальної версії
            return { success: true, data: [] };
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/units`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    // Admin endpoints
    async getAdminUsers() {
        if (USE_LOCAL_DB) {
            return localAdmin.getUsers();
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/admin/users`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async getAdminUser(userId) {
        if (USE_LOCAL_DB) {
            return localAdmin.getUser(userId);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async updateUserPassword(userId, password) {
        if (USE_LOCAL_DB) {
            return localAdmin.updateUserPassword(userId, password);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/admin/users/${userId}/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
    },

    async updateUserRole(userId, role) {
        if (USE_LOCAL_DB) {
            return localAdmin.updateUserRole(userId, role);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role })
        });
    },

    // Analytics endpoints
    async getCourseAnalytics(courseId) {
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/analytics/courses/${courseId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async getLearningAnalytics() {
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/analytics/learning`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async getUserAnalytics(userId) {
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/analytics/users/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    // Crews endpoints
    async getCrews() {
        if (USE_LOCAL_DB) {
            return localCrews.getCrews();
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/crews`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createCrew(data) {
        if (USE_LOCAL_DB) {
            return localCrews.createCrew(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/crews`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async updateCrew(crewId, data) {
        if (USE_LOCAL_DB) {
            return localCrews.updateCrew(crewId, data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/crews/${crewId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async deleteCrew(crewId) {
        if (USE_LOCAL_DB) {
            return localCrews.deleteCrew(crewId);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/crews/${crewId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async getCrew(crewId) {
        if (USE_LOCAL_DB) {
            return localCrews.getCrew(crewId);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/crews/${crewId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    // Equipment Types endpoints
    async getEquipmentTypes() {
        if (USE_LOCAL_DB) {
            return localEquipmentTypes.getTypes();
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment/types`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createEquipmentType(data) {
        if (USE_LOCAL_DB) {
            return localEquipmentTypes.createType(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment/types`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async updateEquipmentType(typeId, data) {
        if (USE_LOCAL_DB) {
            return localEquipmentTypes.updateType(typeId, data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment/types/${typeId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async deleteEquipmentType(typeId) {
        if (USE_LOCAL_DB) {
            return localEquipmentTypes.deleteType(typeId);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment/types/${typeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    // Equipment endpoints
    async getEquipment() {
        if (USE_LOCAL_DB) {
            return localEquipment.getEquipment();
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async createEquipment(data) {
        if (USE_LOCAL_DB) {
            return localEquipment.createEquipment(data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async updateEquipment(equipmentId, data) {
        if (USE_LOCAL_DB) {
            return localEquipment.updateEquipment(equipmentId, data);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment/${equipmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    async deleteEquipment(equipmentId) {
        if (USE_LOCAL_DB) {
            return localEquipment.deleteEquipment(equipmentId);
        }
        const token = this.getToken();
        return fetch(`${API_BASE_URL}/equipment/${equipmentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    // Token management
    getToken() {
        // Токен зберігається в sessionStorage (не localStorage для безпеки)
        return sessionStorage.getItem('authToken');
    },

    setToken(token) {
        sessionStorage.setItem('authToken', token);
    },

    removeToken() {
        sessionStorage.removeItem('authToken');
    },

    // Helper для обробки відповідей
    async handleResponse(response) {
        // Якщо це вже об'єкт (локальний API), повертаємо як є
        if (typeof response === 'object' && !response.json) {
            return response;
        }
        // Інакше це fetch response
        const data = await response.json();
        if (!response.ok) {
            // Використовуємо повідомлення з сервера або стандартне
            let errorMessage = data.message || data.error || `Помилка сервера (${response.status})`;
            
            // Додаємо підказку якщо є
            if (data.hint) {
                errorMessage += `\n💡 Підказка: ${data.hint}`;
            }
            
            // Спеціальна обробка помилок підключення до БД
            if (data.message && (data.message.includes('password authentication') || data.message.includes('бази даних'))) {
                errorMessage += '\n\n💡 Альтернатива: Використайте локальну БД - змініть USE_LOCAL_DB = true в frontend/app/scripts/api.js';
            }
            
            throw new Error(errorMessage);
        }
        return data;
    },

    // Експортуємо прапорець використання локальної БД,
    // щоб інші скрипти могли перевіряти api.USE_LOCAL_DB
    USE_LOCAL_DB: USE_LOCAL_DB
};

// Експорт глобально
if (typeof window !== 'undefined') {
    window.api = api;
    window.API_BASE_URL = API_BASE_URL;
    window.USE_LOCAL_DB = USE_LOCAL_DB;
}

// Експорт для використання в інших файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}


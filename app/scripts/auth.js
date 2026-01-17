// Authentication functions

let currentUser = null;

// Перевірка автентифікації
async function checkAuth() {
    // Дозволяємо прямій доступ до training.html без перевірки токену
    // Користувач зможе увійти безпосередньо на сторінці
    const isTrainingPage = typeof window !== 'undefined' && window.location.pathname.includes('training.html');
    
    const token = api.getToken();
    if (!token && !isTrainingPage) {
        showAuthScreen();
        return;
    }

    // Якщо є токен, одразу приховуємо authScreenTS та показуємо mainContent
    // Це потрібно щоб не показувати екран автентифікації якщо користувач залогінений на основному сайті
    const authScreenTS = document.getElementById('authScreenTS');
    if (authScreenTS) {
        authScreenTS.style.display = 'none';
    }
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.style.display = 'block';
    }

    try {
        const response = await api.getCurrentUser();
        const data = await api.handleResponse(response);
        
        if (data.success) {
            currentUser = data.user;
            // Встановлюємо глобально для доступу з інших скриптів
            if (typeof window !== 'undefined') {
                window.currentUser = data.user;
            }
            // Якщо користувач залогінений, одразу показуємо mainContent та приховуємо всі екрани автентифікації
            showMainContent();
            updateUserInfo();
            checkUserRole();
        } else {
            // Тільки якщо токен недійсний, показуємо екран автентифікації
            api.removeToken();
            showAuthScreen();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // Якщо є помилка перевірки, але токен є, не показуємо екран автентифікації
        // Можливо це тимчасова помилка підключення
        const isAuthError = error.message && (
            error.message.includes('Сесія недійсна') || 
            error.message.includes('Токен не знайдено') ||
            error.message.includes('401') ||
            error.message.includes('Unauthorized')
        );
        
        if (isAuthError) {
            // Тільки якщо це помилка авторизації, видаляємо токен та показуємо екран
            api.removeToken();
            showAuthScreen();
        } else {
            // Для інших помилок (підключення тощо) не показуємо екран автентифікації
            // Користувач залишається в системі якщо токен є
            if (error.message && error.message.includes('Не удалось подключиться к серверу')) {
                showNotification('Помилка підключення до сервера. Перевірте чи запущений backend сервер на порту 3000.', 'error');
            } else if (error.message && !error.message.includes('Сесія недійсна') && !error.message.includes('Токен не знайдено')) {
                console.warn('Auth check warning:', error.message);
            }
            // Не показуємо authScreenTS, користувач залишається залогіненим
            // Можливо просто тимчасова проблема з сервером
        }
    }
}

// Показати екран автентифікації
function showAuthScreen() {
    const authScreen = document.getElementById('authScreen');
    const authScreenTS = document.getElementById('authScreenTS');
    const mainContent = document.getElementById('mainContent');
    
    // Перевіряємо чи є токен - якщо є, не показуємо екрани автентифікації
    const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
    if (token) {
        // Якщо є токен, користувач вже залогінений - не показуємо authScreenTS
        if (authScreenTS) authScreenTS.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        return;
    }
    
    // Якщо є authScreenTS (training.html), використовуємо його
    if (authScreenTS) {
        authScreenTS.style.display = 'flex';
        if (authScreen) authScreen.style.display = 'none';
        if (mainContent) mainContent.style.display = 'none';
    } else if (authScreen) {
        // Стандартна поведінка для інших файлів
        authScreen.style.display = 'flex';
        if (mainContent) mainContent.style.display = 'none';
    }
}

// Показати основний контент
function showMainContent() {
    const authScreen = document.getElementById('authScreen');
    const authScreenTS = document.getElementById('authScreenTS');
    const mainContent = document.getElementById('mainContent');
    
    // Якщо є authScreenTS (training.html), приховуємо його та homepage
    if (authScreenTS) {
        authScreenTS.style.display = 'none';
        // Приховуємо homepage (authScreen) якщо показуємо training system
        if (authScreen) {
            authScreen.style.display = 'none';
            // Видаляємо !important з inline стилів якщо вони є
            authScreen.style.setProperty('display', 'none', 'important');
        }
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    } else if (authScreen) {
        // Стандартна поведінка для інших файлів
        authScreen.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    }
}

// Оновити інформацію про користувача
function updateUserInfo() {
    if (!currentUser) return;

    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl) {
        userNameEl.textContent = currentUser.full_name;
    }

    if (userRoleEl) {
        const roleNames = {
            'SystemAdmin': 'Системний адміністратор',
            'Admin': 'Адміністратор',
            'Readit': 'Інструктор',
            'User': 'Користувач'
        };
        userRoleEl.textContent = roleNames[currentUser.role] || currentUser.role;
    }

    if (userAvatarEl && currentUser.full_name) {
        const initials = currentUser.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        userAvatarEl.textContent = initials;
    }

    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.style.display = 'flex';
    }
}

// Перевірка ролі користувача
function checkUserRole() {
    if (!currentUser) return;

    const adminTab = document.getElementById('adminTab');
    const readitTab = document.getElementById('readitTab');
    const personnelTab = document.getElementById('personnelTab');
    const crewsTab = document.getElementById('crewsTab');
    const equipmentTab = document.getElementById('equipmentTab');
    const addKnowledgeBtn = document.getElementById('addKnowledgeBtn');
    const addCourseBtn = document.getElementById('addCourseBtn');
    const exportDbBtn = document.getElementById('exportDbBtn');
    const importDbBtn = document.getElementById('importDbBtn');
    const clearDbBtn = document.getElementById('clearDbBtn');

    // За замовчуванням ховаємо всі "адмінські" та службові вкладки
    if (adminTab) adminTab.style.display = 'none';
    if (readitTab) readitTab.style.display = 'none';
    if (personnelTab) personnelTab.style.display = 'none';
    if (crewsTab) crewsTab.style.display = 'none';
    if (equipmentTab) equipmentTab.style.display = 'none';
    if (addKnowledgeBtn) addKnowledgeBtn.style.display = 'none';
    if (addCourseBtn) addCourseBtn.style.display = 'none';
    if (exportDbBtn) exportDbBtn.style.display = 'none';
    if (importDbBtn) importDbBtn.style.display = 'none';
    if (clearDbBtn) clearDbBtn.style.display = 'none';

    // SystemAdmin та Admin бачать адмін панель
    if (currentUser.role === 'SystemAdmin' || currentUser.role === 'Admin') {
        if (adminTab) adminTab.style.display = 'block';
        // Кнопки керування БД доступні тільки адміністраторам
        if (exportDbBtn) exportDbBtn.style.display = 'inline-flex';
        if (importDbBtn) importDbBtn.style.display = 'inline-flex';
        if (clearDbBtn) clearDbBtn.style.display = 'inline-flex';
    }

    // Readit та вище бачать панель інструктора, особовий склад, екіпажі та засоби
    if (currentUser.role === 'Readit' || currentUser.role === 'Admin' || currentUser.role === 'SystemAdmin') {
        if (readitTab) readitTab.style.display = 'block';
        if (addKnowledgeBtn) addKnowledgeBtn.style.display = 'inline-block';
        if (addCourseBtn) addCourseBtn.style.display = 'inline-block';
        if (personnelTab) personnelTab.style.display = 'block';
        if (crewsTab) crewsTab.style.display = 'block';
        if (equipmentTab) equipmentTab.style.display = 'block';
    }
}

// Вхід
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await api.login({ email, password });
        const data = await api.handleResponse(response);

        if (data.success) {
            api.setToken(data.token);
            currentUser = data.user;
            // Встановлюємо глобально для доступу з інших скриптів
            if (typeof window !== 'undefined') {
                window.currentUser = data.user;
            }
            closeModal('loginModal');
            // Приховуємо authScreenTS одразу після логіну
            const authScreenTS = document.getElementById('authScreenTS');
            if (authScreenTS) {
                authScreenTS.style.display = 'none';
            }
            showMainContent();
            updateUserInfo();
            checkUserRole();
            showNotification('Успішний вхід', 'success');
            // Завантажити профіль після невеликої затримки, щоб main.js встиг завантажитися
            setTimeout(() => {
                if (typeof loadProfile === 'function') {
                    loadProfile();
                } else {
                    // Якщо функція ще не завантажена, показуємо секцію profile
                    if (typeof showSection === 'function') {
                        showSection('profile', document.querySelector('[data-section="profile"]'));
                    }
                }
            }, 100);
        }
    } catch (error) {
        console.error('Login error:', error);
        // Показуємо зрозуміле повідомлення про помилку
        let errorMessage = 'Помилка входу';
        
        if (error.message && error.message.includes('Не удалось подключиться к серверу')) {
            errorMessage = 'Помилка підключення до сервера. Перевірте чи запущений backend сервер на порту 3000.\n\nДля запуску: cd backend && npm start';
        } else if (error.message && error.message.includes('password authentication')) {
            errorMessage = 'Помилка підключення до бази даних.\n\n💡 Рішення:\n1. Перевірте пароль PostgreSQL в backend/.env\n2. Або використайте локальну БД: змініть USE_LOCAL_DB = true в frontend/app/scripts/api.js';
        } else if (error.message && error.message.includes('бази даних')) {
            errorMessage = error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        // Показуємо повідомлення (може містити переноси рядків)
        showNotification(errorMessage.replace(/\n/g, ' '), 'error');
        
        // НЕ закриваємо модальне вікно при помилці
    }
}

// Реєстрація
async function handleRegister(event) {
    event.preventDefault();

    const fullName = document.getElementById('registerFullName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showNotification('Паролі не співпадають', 'error');
        return;
    }

    try {
        const response = await api.register({ full_name: fullName, email, password });
        const data = await api.handleResponse(response);

        if (data.success) {
            api.setToken(data.token);
            currentUser = data.user;
            // Встановлюємо глобально для доступу з інших скриптів
            if (typeof window !== 'undefined') {
                window.currentUser = data.user;
            }
            closeModal('registerModal');
            // Приховуємо authScreenTS одразу після реєстрації
            const authScreenTS = document.getElementById('authScreenTS');
            if (authScreenTS) {
                authScreenTS.style.display = 'none';
            }
            showMainContent();
            updateUserInfo();
            checkUserRole();
            showNotification('Реєстрація успішна', 'success');
            // Завантажити dashboard після невеликої затримки, щоб main.js встиг завантажитися
            setTimeout(() => {
                if (typeof loadDashboard === 'function') {
                    loadDashboard();
                } else {
                    // Якщо функція ще не завантажена, показуємо секцію dashboard
                    if (typeof showSection === 'function') {
                        showSection('dashboard', document.querySelector('[data-section="dashboard"]'));
                    }
                }
            }, 100);
        }
    } catch (error) {
        console.error('Register error:', error);
        showNotification(error.message || 'Помилка реєстрації', 'error');
        // НЕ закриваємо модальне вікно при помилці
    }
}

// Вихід
async function logout() {
    if (!confirm('Ви впевнені, що хочете вийти?')) {
        return;
    }
    
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        api.removeToken();
        currentUser = null;
        showAuthScreen();
        showNotification('Вихід виконано', 'info');
    }
}

// Модальні вікна
function showLoginModal() {
    let modal = document.getElementById('loginModal');
    if (!modal) {
        // Створюємо модальне вікно якщо його немає
        modal = document.createElement('div');
        modal.id = 'loginModal';
        modal.className = 'modal-overlay';
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('loginModal');
        };
        modal.innerHTML = `
            <div class="modal-content auth-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Вхід в систему</div>
                    <button class="close-btn" onclick="closeModal('loginModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="loginForm" onsubmit="handleLogin(event); return false;">
                        <div class="form-group">
                            <label>E-mail</label>
                            <input type="email" id="loginEmail" required autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label>Пароль</label>
                            <input type="password" id="loginPassword" required autocomplete="current-password">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">Увійти</button>
                            <button type="button" class="btn-secondary" onclick="closeModal('loginModal')">Скасувати</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.add('active');
}

function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error('registerModal not found');
        showNotification('Помилка відкриття вікна реєстрації', 'error');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // Якщо модальне вікно було створене динамічно, видаляємо його
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

function closeModalOnOverlay(event, modalId) {
    if (event.target.classList.contains('modal-overlay')) {
        closeModal(modalId);
    }
}

// Сповіщення
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) {
        console.warn('Notification element not found');
        return;
    }
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Експорт функцій глобально
if (typeof window !== 'undefined') {
    window.showLoginModal = showLoginModal;
    window.showRegisterModal = showRegisterModal;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.logout = logout;
    window.checkAuth = checkAuth;
    window.showAuthScreen = showAuthScreen;
    window.showMainContent = showMainContent;
    window.updateUserInfo = updateUserInfo;
    window.checkUserRole = checkUserRole;
    
    // Експортуємо closeModal та showNotification як основні функції
    window.closeModal = closeModal;
    window.closeModalOnOverlay = closeModalOnOverlay;
    window.showNotification = showNotification;
    
    // Експортуємо currentUser для доступу з інших файлів
    Object.defineProperty(window, 'currentUser', {
        get: () => currentUser,
        set: (value) => { currentUser = value; },
        configurable: true
    });
}

// Експорт для використання в інших файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkAuth,
        logout,
        currentUser: () => currentUser
    };
}

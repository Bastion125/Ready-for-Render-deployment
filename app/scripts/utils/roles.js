/**
 * Утиліти для роботи з ролями користувачів
 */

/**
 * Отримує поточного користувача
 * @returns {Object|null} Об'єкт користувача або null
 */
function getCurrentUser() {
    if (typeof window !== 'undefined' && window.currentUser) {
        return window.currentUser;
    }
    if (typeof currentUser !== 'undefined') {
        return currentUser;
    }
    return null;
}

/**
 * Перевіряє чи користувач має доступ до функцій адміністратора
 * @param {Object} user - Об'єкт користувача
 * @returns {boolean} true якщо користувач адміністратор
 */
function isAdmin(user = null) {
    const currentUser = user || getCurrentUser();
    if (!currentUser) return false;
    return currentUser.role === 'Admin' || currentUser.role === 'SystemAdmin';
}

/**
 * Перевіряє чи користувач має доступ до функцій інструктора
 * @param {Object} user - Об'єкт користувача
 * @returns {boolean} true якщо користувач інструктор або вище
 */
function isInstructor(user = null) {
    const currentUser = user || getCurrentUser();
    if (!currentUser) return false;
    return currentUser.role === 'Readit' || 
           currentUser.role === 'Admin' || 
           currentUser.role === 'SystemAdmin';
}

/**
 * Перевіряє чи користувач має доступ до створення контенту
 * @param {Object} user - Об'єкт користувача
 * @returns {boolean} true якщо користувач може створювати контент
 */
function canCreateContent(user = null) {
    return isInstructor(user);
}

/**
 * Отримує назву ролі для відображення
 * @param {string} role - Код ролі
 * @returns {string} Назва ролі
 */
function getRoleName(role) {
    const roleNames = {
        'User': 'Користувач',
        'Readit': 'Інструктор',
        'Admin': 'Адміністратор',
        'SystemAdmin': 'Системний адміністратор'
    };
    return roleNames[role] || role || 'Невідома роль';
}

// Експорт функцій
if (typeof window !== 'undefined') {
    window.getCurrentUser = getCurrentUser;
    window.isAdmin = isAdmin;
    window.isInstructor = isInstructor;
    window.canCreateContent = canCreateContent;
    window.getRoleName = getRoleName;
}

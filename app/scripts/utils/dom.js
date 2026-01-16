// Утиліти для роботи з DOM та кешування елементів

/**
 * Кеш для DOM елементів
 */
const domCache = new Map();

/**
 * Отримує DOM елемент з кешу або з DOM
 * @param {string} id - ID елемента
 * @param {boolean} forceRefresh - Примусово оновити кеш
 * @returns {HTMLElement|null} DOM елемент або null
 */
function getCachedElement(id, forceRefresh = false) {
    if (forceRefresh || !domCache.has(id)) {
        const element = document.getElementById(id);
        if (element) {
            domCache.set(id, element);
        } else {
            domCache.delete(id);
            return null;
        }
    }
    return domCache.get(id) || null;
}

/**
 * Очищає кеш DOM елементів
 */
function clearDomCache() {
    domCache.clear();
}

/**
 * Очищає конкретний елемент з кешу
 * @param {string} id - ID елемента
 */
function clearCachedElement(id) {
    domCache.delete(id);
}

/**
 * Отримує кілька елементів одночасно
 * @param {string[]} ids - Масив ID елементів
 * @returns {Object} Об'єкт з елементами
 */
function getCachedElements(ids) {
    const elements = {};
    ids.forEach(id => {
        elements[id] = getCachedElement(id);
    });
    return elements;
}

/**
 * Дебаунсинг функції
 * @param {Function} func - Функція для дебаунсингу
 * @param {number} wait - Час очікування в мілісекундах
 * @returns {Function} Дебаунсована функція
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Створює DocumentFragment з HTML рядка
 * @param {string} html - HTML рядок
 * @returns {DocumentFragment} DocumentFragment
 */
function createFragmentFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
}

// Експорт функцій
if (typeof window !== 'undefined') {
    window.getCachedElement = getCachedElement;
    window.clearDomCache = clearDomCache;
    window.clearCachedElement = clearCachedElement;
    window.getCachedElements = getCachedElements;
    window.debounce = debounce;
    window.createFragmentFromHTML = createFragmentFromHTML;
}

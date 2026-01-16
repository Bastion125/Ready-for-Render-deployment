// Скрипт для автоматичного оновлення індикатора мови на основі поточної сторінки
document.addEventListener('DOMContentLoaded', function() {
    // Визначаємо поточну мову на основі URL або lang атрибута
    const isEnglish = window.location.pathname.includes('index-en.html') || 
                      window.location.pathname.includes('index-en') ||
                      document.documentElement.lang === 'en';
    
    // Знаходимо всі елементи перемикача мов
    const languageSwitchers = document.querySelectorAll('.wpml-ls-legacy-dropdown');
    
    languageSwitchers.forEach(function(switcher) {
        // Знаходимо елементи мов
        const ukItem = switcher.querySelector('.wpml-ls-item-uk');
        const enItem = switcher.querySelector('.wpml-ls-item-en');
        
        if (!ukItem || !enItem) return;
        
        if (isEnglish) {
            // Англійська версія - ENG поточна, УКР в меню
            ukItem.classList.remove('wpml-ls-current-language');
            enItem.classList.add('wpml-ls-current-language');
            
            // Оновлюємо текст та посилання
            const ukLink = ukItem.querySelector('a');
            const enLink = enItem.querySelector('a');
            
            if (ukLink) {
                ukLink.href = 'index.html';
                ukLink.classList.add('wpml-ls-link');
                ukLink.classList.remove('js-wpml-ls-item-toggle', 'wpml-ls-item-toggle');
                ukLink.setAttribute('title', 'Switch to УКР');
                ukLink.setAttribute('aria-label', 'Switch to УКР');
                // Видаляємо обробник подій, якщо він був доданий script.min.js
                const newUkLink = ukLink.cloneNode(true);
                ukLink.parentNode.replaceChild(newUkLink, ukLink);
            }
            
            if (enLink) {
                enLink.href = '#';
                enLink.classList.add('js-wpml-ls-item-toggle', 'wpml-ls-item-toggle');
                enLink.classList.remove('wpml-ls-link');
                enLink.setAttribute('title', 'Switch to ENG');
                enLink.setAttribute('aria-label', 'Switch to ENG');
                
                // Оновлюємо текст
                const enText = enLink.querySelector('.wpml-ls-display, .wpml-ls-native');
                if (enText) {
                    enText.textContent = 'ENG';
                }
            }
            
            // Переміщуємо елементи: ENG в основне меню, УКР в підменю ENG
            const mainMenu = switcher.querySelector('ul[role="menu"]');
            const ukSubMenu = ukItem.querySelector('.wpml-ls-sub-menu');
            const enSubMenu = enItem.querySelector('.wpml-ls-sub-menu');
            
            // Якщо ENG в підменю УКР, переміщуємо його в основне меню
            if (enItem.parentElement && enItem.parentElement.classList.contains('wpml-ls-sub-menu')) {
                if (mainMenu) {
                    // Видаляємо підменю УКР, якщо воно порожнє
                    if (ukSubMenu && ukSubMenu.children.length === 0) {
                        ukSubMenu.remove();
                    }
                    // Переміщуємо ENG в основне меню
                    mainMenu.appendChild(enItem);
                }
            }
            
            // Якщо УКР в основному меню, переміщуємо його в підменю ENG
            if (ukItem.parentElement === mainMenu) {
                // Створюємо підменю для ENG, якщо його немає
                if (!enSubMenu) {
                    const newSubMenu = document.createElement('ul');
                    newSubMenu.className = 'wpml-ls-sub-menu';
                    newSubMenu.setAttribute('role', 'menu');
                    enItem.appendChild(newSubMenu);
                }
                // Переміщуємо УКР в підменю ENG
                const subMenu = enItem.querySelector('.wpml-ls-sub-menu');
                if (subMenu) {
                    subMenu.appendChild(ukItem);
                }
            }
        } else {
            // Українська версія - УКР поточна, ENG в меню
            ukItem.classList.add('wpml-ls-current-language');
            enItem.classList.remove('wpml-ls-current-language');
            
            // Оновлюємо текст та посилання
            const ukLink = ukItem.querySelector('a');
            const enLink = enItem.querySelector('a');
            
            if (ukLink) {
                ukLink.href = '#';
                ukLink.classList.add('js-wpml-ls-item-toggle', 'wpml-ls-item-toggle');
                ukLink.classList.remove('wpml-ls-link');
                ukLink.setAttribute('title', 'Switch to УКР');
                ukLink.setAttribute('aria-label', 'Switch to УКР');
            }
            
            if (enLink) {
                enLink.href = 'index-en.html';
                enLink.classList.add('wpml-ls-link');
                enLink.classList.remove('js-wpml-ls-item-toggle', 'wpml-ls-item-toggle');
                enLink.setAttribute('title', 'Switch to ENG');
                enLink.setAttribute('aria-label', 'Switch to ENG');
            }
            
            // Переміщуємо елементи: УКР в основне меню, ENG в підменю УКР
            const mainMenu = switcher.querySelector('ul[role="menu"]');
            const ukSubMenu = ukItem.querySelector('.wpml-ls-sub-menu');
            const enSubMenu = enItem.querySelector('.wpml-ls-sub-menu');
            
            // Якщо УКР в підменю ENG, переміщуємо його в основне меню
            if (ukItem.parentElement && ukItem.parentElement.classList.contains('wpml-ls-sub-menu')) {
                if (mainMenu) {
                    // Видаляємо підменю ENG, якщо воно порожнє
                    if (enSubMenu && enSubMenu.children.length === 0) {
                        enSubMenu.remove();
                    }
                    // Переміщуємо УКР в основне меню
                    mainMenu.appendChild(ukItem);
                }
            }
            
            // Якщо ENG в основному меню, переміщуємо його в підменю УКР
            if (enItem.parentElement === mainMenu) {
                // Створюємо підменю для УКР, якщо його немає
                if (!ukSubMenu) {
                    const newSubMenu = document.createElement('ul');
                    newSubMenu.className = 'wpml-ls-sub-menu';
                    newSubMenu.setAttribute('role', 'menu');
                    ukItem.appendChild(newSubMenu);
                }
                // Переміщуємо ENG в підменю УКР
                const subMenu = ukItem.querySelector('.wpml-ls-sub-menu');
                if (subMenu) {
                    subMenu.appendChild(enItem);
                }
            }
        }
    });
    
    // Оновлюємо cookie мови
    const currentLang = isEnglish ? 'en' : 'uk';
    document.cookie = `wp-wpml_current_language=${currentLang};expires=${new Date(Date.now() + 86400000).toUTCString()};path=/;SameSite=Lax`;
});

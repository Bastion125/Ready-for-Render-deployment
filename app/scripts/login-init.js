// Login page initialization script
// Виправлення помилок TLS при завантаженні ресурсів
(function() {
    // Перевіряємо, чи сторінка відкрита через file:// або http://
    const protocol = window.location.protocol;
    if (protocol === 'https:') {
        console.warn('Сторінка відкрита через HTTPS. Для локальної розробки використовуйте HTTP або file:// протокол.');
    }
    
    // Обробка помилок завантаження ресурсів
    window.addEventListener('error', function(e) {
        if (e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT')) {
            const src = e.target.href || e.target.src;
            if (src && src.startsWith('https://') && protocol !== 'https:') {
                console.warn('Спроба завантажити ресурс через HTTPS:', src);
                // Спробуємо завантажити через правильний протокол
                const relativePath = src.replace(/^https?:\/\/[^/]+/, '');
                if (e.target.tagName === 'LINK') {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = relativePath;
                    document.head.appendChild(link);
                } else if (e.target.tagName === 'SCRIPT') {
                    const script = document.createElement('script');
                    script.src = relativePath;
                    document.body.appendChild(script);
                }
            }
        }
    }, true);
})();

// Login page specific functions

function switchTab(tab) {
    // Update tabs
    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
    const clickedTab = document.querySelector(`.form-tab[data-tab="${tab}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // Update forms
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    if (tab === 'login') {
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.getElementById('registerForm').classList.add('active');
    }
    
    // Clear messages
    hideMessages();
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    successEl.textContent = message;
    successEl.classList.add('show');
    setTimeout(() => successEl.classList.remove('show'), 5000);
}

function hideMessages() {
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');
}

async function handleLogin(event) {
    event.preventDefault();
    hideMessages();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        if (typeof api === 'undefined') {
            showError('Помилка: API не завантажено. Перевірте підключення до сервера.');
            return;
        }
        
        const response = await api.login({ email, password });
        const data = await api.handleResponse(response);
        
        if (data.success) {
            api.setToken(data.token);
            showSuccess('Успішний вхід! Перенаправлення...');
            // Перевіряємо роль користувача для визначення куди перенаправити
            const redirectUrl = (data.user && (data.user.role === 'Admin' || data.user.role === 'SystemAdmin')) 
                ? 'admin.html' 
                : 'training.html';
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            showError(data.message || 'Помилка входу. Перевірте дані та спробуйте ще раз.');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Помилка входу. Перевірте дані та спробуйте ще раз.');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    hideMessages();
    
    const fullName = document.getElementById('registerFullName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    if (password !== passwordConfirm) {
        showError('Паролі не співпадають');
        return;
    }
    
    try {
        if (typeof api === 'undefined') {
            showError('Помилка: API не завантажено. Перевірте підключення до сервера.');
            return;
        }
        
        const response = await api.register({ full_name: fullName, email, password });
        const data = await api.handleResponse(response);
        
        if (data.success) {
            api.setToken(data.token);
            showSuccess('Реєстрація успішна! Перенаправлення...');
            setTimeout(() => {
                window.location.href = 'training.html';
            }, 1000);
        }
    } catch (error) {
        console.error('Register error:', error);
        showError(error.message || 'Помилка реєстрації. Спробуйте ще раз.');
    }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Якщо використовується локальна БД, чекаємо на ініціалізацію
    if (typeof window !== 'undefined' && window.USE_LOCAL_DB && typeof window.initDatabase === 'function') {
        try {
            // Перевіряємо чи БД вже ініціалізована (перевіряємо напряму window.db, щоб уникнути рекурсії)
            let dbInitialized = false;
            if (typeof window.db !== 'undefined' && window.db !== null) {
                // Перевіряємо чи БД дійсно працює
                try {
                    window.db.exec("SELECT 1");
                    dbInitialized = true;
                } catch (e) {
                    // БД не працює, потрібно ініціалізувати
                    dbInitialized = false;
                }
            }
            
            // Якщо БД не ініціалізована, ініціалізуємо
            if (!dbInitialized) {
                console.log('Ініціалізація бази даних...');
                const success = await window.initDatabase();
                if (!success) {
                    throw new Error('Не вдалося ініціалізувати базу даних');
                }
                console.log('База даних успішно ініціалізована');
            } else {
                console.log('База даних вже ініціалізована');
            }
        } catch (error) {
            console.error('Помилка ініціалізації бази даних:', error);
            showError('Помилка ініціалізації бази даних. Перезавантажте сторінку.');
        }
    }
    
    // Tab switching
    document.querySelectorAll('.form-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab') || (this.textContent.trim() === 'Вхід' ? 'login' : 'register');
            switchTab(tabName);
        });
    });
    
    // Form submissions
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('registerFormElement');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

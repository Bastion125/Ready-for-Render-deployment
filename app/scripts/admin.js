// Адміністрування - онлайн/офлайн статус, аналітика

let adminRefreshInterval = null;

// Завантаження адмін панелі
async function loadAdminPanel() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    if (!currentUser || !['Admin', 'SystemAdmin'].includes(currentUser.role)) {
        content.innerHTML = '<div class="empty-state">Доступ заборонено</div>';
        return;
    }

    try {
        // Завантаження користувачів з онлайн/офлайн статусом
        let usersResponse;
        if (typeof api !== 'undefined' && api.USE_LOCAL_DB && typeof localAdmin !== 'undefined') {
            usersResponse = await localAdmin.getUsers();
        } else {
            usersResponse = await api.getAdminUsers();
        }
        const usersData = await api.handleResponse(usersResponse);

        renderAdminPanel(usersData.data || []);
        
        // Автоматичне оновлення кожні 30 секунд
        if (adminRefreshInterval) {
            clearInterval(adminRefreshInterval);
        }
        adminRefreshInterval = setInterval(() => {
            loadAdminPanel();
        }, 30000);
    } catch (error) {
        console.error('Error loading admin panel:', error);
        content.innerHTML = '<div class="error">Помилка завантаження адмін панелі</div>';
    }
}

// Відображення адмін панелі
function renderAdminPanel(users) {
    const content = document.getElementById('adminContent');
    if (!content) return;

    // Розділення на онлайн/офлайн
    const onlineUsers = users.filter(u => u.is_online);
    const offlineUsers = users.filter(u => !u.is_online);

    content.innerHTML = `
        <div class="admin-panel">
            <div class="admin-stats">
                <div class="stat-card">
                    <div class="stat-value">${users.length}</div>
                    <div class="stat-label">Всього користувачів</div>
                </div>
                <div class="stat-card online">
                    <div class="stat-value">${onlineUsers.length}</div>
                    <div class="stat-label">Онлайн</div>
                </div>
                <div class="stat-card offline">
                    <div class="stat-value">${offlineUsers.length}</div>
                    <div class="stat-label">Офлайн</div>
                </div>
            </div>

            <div class="admin-tabs">
                <button class="admin-tab active" onclick="showAdminTab('all')">Всі користувачі</button>
                <button class="admin-tab" onclick="showAdminTab('online')">Онлайн</button>
                <button class="admin-tab" onclick="showAdminTab('offline')">Офлайн</button>
            </div>

            <div class="admin-users-section">
                <div class="admin-filters">
                    <input type="text" id="adminUserSearch" placeholder="Пошук користувачів..." 
                           oninput="filterAdminUsers()" class="search-input">
                    <select id="adminRoleFilter" onchange="filterAdminUsers()" class="filter-select">
                        <option value="">Всі ролі</option>
                        <option value="SystemAdmin">System Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="Readit">Readit</option>
                        <option value="User">User</option>
                    </select>
                </div>
                <div id="adminUsersList" class="admin-users-list">
                    ${renderUsersList(users)}
                </div>
            </div>
        </div>
    `;
}

// Відображення списку користувачів
function renderUsersList(users) {
    if (users.length === 0) {
        return '<div class="empty-state">Користувачі відсутні</div>';
    }

    return users.map(user => `
        <div class="admin-user-card" data-user-id="${user.id}" data-role="${user.role}" data-status="${user.is_online ? 'online' : 'offline'}">
            <div class="user-status-indicator ${user.is_online ? 'online' : 'offline'}"></div>
            <div class="user-avatar-small">${getUserInitials(user.full_name)}</div>
            <div class="user-info-admin">
                <h3>${user.full_name}</h3>
                <p><strong>Логін (Email):</strong> ${user.email}</p>
                ${user.password ? `<p><strong>Пароль:</strong> <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${user.password}</code></p>` : ''}
                <div class="user-role-badge role-${user.role.toLowerCase()}">${getRoleName(user.role)}</div>
            </div>
            <div class="user-actions">
                ${user.is_online ? '<span class="status-badge online-badge">Онлайн</span>' : '<span class="status-badge offline-badge">Офлайн</span>'}
                ${user.last_activity ? `<span class="last-activity">Остання активність: ${formatLastActivity(user.last_activity)}</span>` : ''}
                <button class="btn-secondary btn-small" onclick="showUserDetails(${user.id})">Деталі</button>
                <button class="btn-secondary btn-small" onclick="showChangeUserRoleModal(${user.id})">Змінити роль</button>
                <button class="btn-secondary btn-small" onclick="showUserPasswordModal(${user.id})">Змінити пароль</button>
            </div>
        </div>
    `).join('');
}

// Модальне вікно зміни ролі користувача
async function showChangeUserRoleModal(userId) {
    try {
        const response = await api.getAdminUser(userId);
        const data = await api.handleResponse(response);

        if (!data.success || !data.data) {
            showNotification('Користувач не знайдено', 'error');
            return;
        }

        const user = data.data;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'userRoleModal';
        modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Зміна ролі: ${user.full_name}</div>
                    <button class="close-btn" onclick="closeModal('userRoleModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="changeUserRoleForm" onsubmit="handleChangeUserRole(event, ${userId}); return false;">
                        <div class="form-group">
                            <label>Поточна роль:</label>
                            <input type="text" value="${getRoleName(user.role)}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Нова роль *</label>
                            <select id="newUserRole" required>
                                <option value="User" ${user.role === 'User' ? 'selected' : ''}>Користувач</option>
                                <option value="Readit" ${user.role === 'Readit' ? 'selected' : ''}>Інструктор</option>
                                <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Адміністратор</option>
                                <option value="SystemAdmin" ${user.role === 'SystemAdmin' ? 'selected' : ''}>System Admin</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">Зберегти</button>
                            <button type="button" class="btn-secondary" onclick="closeModal('userRoleModal')">Скасувати</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('userRoleModal');
        };
    } catch (error) {
        console.error('Error showing role modal:', error);
        showNotification('Помилка завантаження', 'error');
    }
}

// Обробка зміни ролі
async function handleChangeUserRole(event, userId) {
    event.preventDefault();

    const newRole = document.getElementById('newUserRole').value;

    try {
        const response = await api.updateUserRole(userId, newRole);
        const data = await api.handleResponse(response);

        if (data.success) {
            showNotification('Роль успішно змінено', 'success');
            closeModal('userRoleModal');
            // Оновлюємо список користувачів
            loadAdminPanel();
        }
    } catch (error) {
        console.error('Error changing user role:', error);
        showNotification(error.message || 'Помилка зміни ролі', 'error');
    }
}

// Перемикання вкладок адміністрування
function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    const allCards = document.querySelectorAll('.admin-user-card');
    allCards.forEach(card => {
        const status = card.dataset.status;
        if (tab === 'all') {
            card.style.display = 'flex';
        } else if (tab === 'online' && status === 'online') {
            card.style.display = 'flex';
        } else if (tab === 'offline' && status === 'offline') {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Фільтрація користувачів
function filterAdminUsers() {
    const search = document.getElementById('adminUserSearch').value.toLowerCase();
    const roleFilter = document.getElementById('adminRoleFilter').value;
    const cards = document.querySelectorAll('.admin-user-card');

    cards.forEach(card => {
        const userName = card.querySelector('h3').textContent.toLowerCase();
        const userEmail = card.querySelector('p').textContent.toLowerCase();
        const userRole = card.dataset.role;

        const matchesSearch = !search || userName.includes(search) || userEmail.includes(search);
        const matchesRole = !roleFilter || userRole === roleFilter;

        if (matchesSearch && matchesRole) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Допоміжні функції
function getUserInitials(name) {
    if (!name) return '??';
    return name.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function getRoleName(role) {
    const roleNames = {
        'SystemAdmin': 'Системний адміністратор',
        'Admin': 'Адміністратор',
        'Readit': 'Інструктор',
        'User': 'Користувач'
    };
    return roleNames[role] || role;
}

function formatLastActivity(timestamp) {
    if (!timestamp) return 'Невідомо';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // секунди

    if (diff < 60) return 'щойно';
    if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
    return `${Math.floor(diff / 86400)} дн тому`;
}

// Показати деталі користувача
async function showUserDetails(userId) {
    try {
        const response = await api.getAdminUser(userId);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Користувач не знайдено', 'error');
            return;
        }
        
        const user = data.data;
        
        // Отримуємо аналітику користувача
        let analytics = null;
        try {
            const analyticsResponse = await api.getUserAnalytics(userId);
            const analyticsData = await api.handleResponse(analyticsResponse);
            analytics = analyticsData.data || [];
        } catch (error) {
            console.error('Error loading user analytics:', error);
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'userDetailsModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Деталі користувача: ${user.full_name}</div>
                    <button class="close-btn" onclick="closeModal('userDetailsModal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="user-details-section">
                        <h3>Основна інформація</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>ПІБ:</label>
                                <span>${user.full_name}</span>
                            </div>
                            <div class="info-item">
                                <label>Логін (Email):</label>
                                <span>${user.email}</span>
                            </div>
                            ${user.password ? `
                                <div class="info-item">
                                    <label>Пароль:</label>
                                    <span><code style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-family: monospace;">${user.password}</code></span>
                                </div>
                            ` : ''}
                            <div class="info-item">
                                <label>Роль:</label>
                                <span>${getRoleName(user.role)}</span>
                            </div>
                            <div class="info-item">
                                <label>Статус:</label>
                                <span>${user.is_active ? 'Активний' : 'Неактивний'}</span>
                            </div>
                            <div class="info-item">
                                <label>Онлайн:</label>
                                <span>${user.is_online ? 'Так' : 'Ні'}</span>
                            </div>
                            ${user.last_login ? `
                                <div class="info-item">
                                    <label>Останній вхід:</label>
                                    <span>${formatDate(user.last_login)}</span>
                                </div>
                            ` : ''}
                            ${user.last_activity ? `
                                <div class="info-item">
                                    <label>Остання активність:</label>
                                    <span>${formatLastActivity(user.last_activity)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${analytics && analytics.length > 0 ? `
                        <div class="user-analytics-section">
                            <h3>Аналітика навчання</h3>
                            <div class="analytics-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Курс</th>
                                            <th>Почато</th>
                                            <th>Завершено</th>
                                            <th>Час</th>
                                            <th>Прогрес</th>
                                            <th>Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${analytics.map(course => `
                                            <tr>
                                                <td>${course.title || 'Без назви'}</td>
                                                <td>${course.started_at ? formatDate(course.started_at) : '-'}</td>
                                                <td>${course.completed_at ? formatDate(course.completed_at) : '-'}</td>
                                                <td>${course.time_spent_seconds ? formatTime(course.time_spent_seconds) : '-'}</td>
                                                <td>${course.progress || 0}%</td>
                                                <td><span class="status-badge status-${course.status}">${getCourseStatus({user_status: course.status})}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : '<div class="empty-state">Аналітика навчання відсутня</div>'}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('userDetailsModal');
        };
    } catch (error) {
        console.error('Error showing user details:', error);
        showNotification('Помилка завантаження деталей користувача', 'error');
    }
}

// Показати модальне вікно для зміни пароля
async function showUserPasswordModal(userId) {
    try {
        const response = await api.getAdminUser(userId);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Користувач не знайдено', 'error');
            return;
        }
        
        const user = data.data;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'userPasswordModal';
        modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Зміна пароля: ${user.full_name}</div>
                    <button class="close-btn" onclick="closeModal('userPasswordModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="changePasswordForm" onsubmit="handleChangePassword(event, ${userId}); return false;">
                        <div class="form-group">
                            <label>Поточний пароль (хешований):</label>
                            <input type="text" value="${user.password || 'Невідомо'}" readonly style="font-family: monospace; font-size: 12px;">
                            <small>Пароль зберігається в хешованому вигляді для безпеки</small>
                        </div>
                        <div class="form-group">
                            <label>Новий пароль *</label>
                            <input type="password" id="newPassword" required minlength="8" autocomplete="new-password">
                            <small>Мінімум 8 символів</small>
                        </div>
                        <div class="form-group">
                            <label>Підтвердження пароля *</label>
                            <input type="password" id="confirmPassword" required minlength="8" autocomplete="new-password">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">Змінити пароль</button>
                            <button type="button" class="btn-secondary" onclick="closeModal('userPasswordModal')">Скасувати</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('userPasswordModal');
        };
    } catch (error) {
        console.error('Error showing password modal:', error);
        showNotification('Помилка завантаження', 'error');
    }
}

// Обробка зміни пароля
async function handleChangePassword(event, userId) {
    event.preventDefault();
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showNotification('Паролі не співпадають', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showNotification('Пароль повинен містити мінімум 8 символів', 'error');
        return;
    }
    
    try {
        const response = await api.updateUserPassword(userId, newPassword);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            showNotification('Пароль успішно змінено', 'success');
            closeModal('userPasswordModal');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification(error.message || 'Помилка зміни пароля', 'error');
    }
}

// Допоміжні функції
function formatDate(dateString) {
    if (!dateString) return 'Невідомо';
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(seconds) {
    if (!seconds) return '0 хв';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours} год ${minutes} хв`;
    } else if (minutes > 0) {
        return `${minutes} хв ${secs} сек`;
    } else {
        return `${secs} сек`;
    }
}

function getCourseStatus(course) {
    if (!course.user_status) return 'Доступний';
    
    const statusMap = {
        'assigned': 'Призначено',
        'in_progress': 'В процесі',
        'completed': 'Пройдено',
        'failed': 'Не пройдено',
        'locked': 'Заблоковано'
    };
    
    return statusMap[course.user_status] || course.user_status;
}

// Очищення інтервалу при виході з секції
function stopAdminRefresh() {
    if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
    }
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.loadAdminPanel = loadAdminPanel;
    window.renderAdminPanel = renderAdminPanel;
    window.renderUsersList = renderUsersList;
    window.stopAdminRefresh = stopAdminRefresh;
    window.showAdminTab = showAdminTab;
    window.filterAdminUsers = filterAdminUsers;
    window.getUserInitials = getUserInitials;
    window.getRoleName = getRoleName;
    window.formatLastActivity = formatLastActivity;
    window.showUserDetails = showUserDetails;
    window.showUserPasswordModal = showUserPasswordModal;
    window.handleChangePassword = handleChangePassword;
    window.formatDate = formatDate;
    window.formatTime = formatTime;
    window.getCourseStatus = getCourseStatus;
    window.showChangeUserRoleModal = showChangeUserRoleModal;
    window.handleChangeUserRole = handleChangeUserRole;
    // closeModal та showNotification експортуються в auth.js
}





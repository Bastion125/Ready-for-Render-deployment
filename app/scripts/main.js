// Main application logic

// Перемикання секцій
function showSection(sectionId, tabElement) {
    // Приховати всі секції
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Показати вибрану секцію
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }

    // Оновити активну вкладку
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Завантажити контент секції
    loadSectionContent(sectionId);
}

// Експорт критичних функцій одразу (до завантаження інших скриптів)
if (typeof window !== 'undefined') {
    window.showSection = showSection;
}

// Завантаження контенту секції
function loadSectionContent(sectionId) {
    switch (sectionId) {
        case 'profile':
            loadProfile();
            break;
        case 'knowledge':
            if (typeof loadKnowledgeBase === 'function') {
                loadKnowledgeBase();
            } else {
                // Fallback до старої версії
                loadKnowledgeBaseOld();
            }
            break;
        case 'courses':
            if (typeof loadCoursesPage === 'function') {
                loadCoursesPage();
            } else if (typeof loadCourses === 'function') {
                loadCourses();
            } else {
                loadCoursesOld();
            }
            break;
        case 'profile':
            loadProfile();
            break;
        case 'admin':
            if (typeof loadAdminPanel === 'function') {
                loadAdminPanel();
            } else {
                loadAdminPanelOld();
            }
            break;
        case 'readit':
            loadReaditPanel();
            break;
        case 'personnel':
            if (typeof loadPersonnel === 'function') {
                loadPersonnel();
            }
            break;
        case 'crews':
            if (typeof loadCrews === 'function') {
                loadCrews();
            }
            break;
        case 'equipment':
            if (typeof loadEquipment === 'function') {
                loadEquipment();
            }
            break;
    }
}

// Завантаження головної панелі
async function loadDashboard() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    try {
        const userResponse = await api.getCurrentUser();
        const userData = await api.handleResponse(userResponse);

        const coursesResponse = await api.getCourses();
        const coursesData = await api.handleResponse(coursesResponse);

        content.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Ласкаво просимо, ${userData.user.full_name}!</h3>
                    <p>Ваша роль: ${getRoleName(userData.user.role)}</p>
                </div>
                <div class="dashboard-card">
                    <h3>Доступні курси</h3>
                    <p>Кількість: ${coursesData.data?.length || 0}</p>
                </div>
                <div class="dashboard-card">
                    <h3>Статистика</h3>
                    <p>Інформація буде додана</p>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<p class="error">Помилка завантаження: ${error.message}</p>`;
    }
}

// Завантаження Бази знань (стара версія - fallback)
async function loadKnowledgeBaseOld() {
    const list = document.getElementById('knowledgeList');
    if (!list) return;

    list.innerHTML = '<p>Завантаження...</p>';

    try {
        const response = await api.getKnowledgeMaterials();
        const data = await api.handleResponse(response);

        if (data.data && data.data.length > 0) {
            const viewMode = localStorage.getItem('knowledgeViewMode') || 'list';
            renderKnowledgeMaterials(data.data, viewMode);
        } else {
            list.innerHTML = '<p class="empty-state">Матеріали відсутні</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="error">Помилка завантаження: ${error.message}</p>`;
    }
}

// Відображення матеріалів Бази знань
function renderKnowledgeMaterials(materials, viewMode = 'list') {
    const list = document.getElementById('knowledgeList');
    if (!list) return;

    if (viewMode === 'grid') {
        list.className = 'knowledge-list grid-view';
        list.innerHTML = materials.map(material => `
            <div class="knowledge-card" onclick="openKnowledgeMaterial(${material.id})">
                <div class="material-icon">${getMaterialIcon(material.material_type)}</div>
                <h3>${material.title}</h3>
                <p>${material.content?.substring(0, 100) || ''}...</p>
            </div>
        `).join('');
    } else {
        list.className = 'knowledge-list list-view';
        list.innerHTML = materials.map(material => `
            <div class="knowledge-item" onclick="openKnowledgeMaterial(${material.id})">
                <div class="material-icon">${getMaterialIcon(material.material_type)}</div>
                <div class="material-info">
                    <h3>${material.title}</h3>
                    <p>${material.content?.substring(0, 150) || ''}...</p>
                </div>
            </div>
        `).join('');
    }
}

// Завантаження курсів (використовує courses.js)
async function loadCourses() {
    if (typeof loadCourses === 'function' && typeof loadCourses !== typeof loadCoursesOld) {
        // Використовуємо нову версію з courses.js
        if (typeof loadCourses !== 'undefined') {
            loadCourses();
        }
    } else {
        // Fallback до старої версії
        loadCoursesOld();
    }
}

// Стара версія (fallback)
async function loadCoursesOld() {
    const list = document.getElementById('coursesList');
    if (!list) return;

    list.innerHTML = '<p>Завантаження...</p>';

    try {
        const response = await api.getCourses();
        const data = await api.handleResponse(response);

        if (data.data && data.data.length > 0) {
            const viewMode = localStorage.getItem('coursesViewMode') || 'list';
            renderCourses(data.data, viewMode);
        } else {
            list.innerHTML = '<p class="empty-state">Курси відсутні</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="error">Помилка завантаження: ${error.message}</p>`;
    }
}

// Відображення курсів (стара версія)
function renderCourses(courses, viewMode = 'list') {
    const list = document.getElementById('coursesList');
    if (!list) return;

    if (viewMode === 'grid') {
        list.className = 'courses-list grid-view';
        list.innerHTML = courses.map(course => `
            <div class="course-card" onclick="openCourse(${course.id})">
                <h3>${course.title}</h3>
                <p>${course.description?.substring(0, 100) || ''}...</p>
            </div>
        `).join('');
    } else {
        list.className = 'courses-list list-view';
        list.innerHTML = courses.map(course => `
            <div class="course-item" onclick="openCourse(${course.id})">
                <h3>${course.title}</h3>
                <p>${course.description?.substring(0, 150) || ''}...</p>
            </div>
        `).join('');
    }
}

// Завантаження профілю
async function loadProfile() {
    const content = document.getElementById('profileContent');
    if (!content) return;

    try {
        const response = await api.getProfile();
        const data = await api.handleResponse(response);
        const user = data.user;

        // Відображення курсів з правильною категоризацією
        const allCourses = user.courses || [];
        
        // Пройдені курси - тільки ті що реально завершені
        // Перевіряємо ТІЛЬКИ статус 'completed'
        const completedCourses = allCourses.filter(c => {
            const status = String(c.status || '').toLowerCase();
            return status === 'completed';
        });
        
        // Курси в процесі - ті що мають прогрес але НЕ завершені
        // ВАЖЛИВО: спочатку перевіряємо що курс НЕ завершений
        const inProgressCourses = allCourses.filter(c => {
            const status = String(c.status || '').toLowerCase();
            // Якщо курс завершений - він НЕ в процесі
            if (status === 'completed') {
                return false;
            }
            // Курс в процесі якщо:
            // 1. Статус in_progress або assigned
            // 2. АБО є прогрес (progress > 0)
            return status === 'in_progress' || status === 'assigned' || (c.progress || 0) > 0;
        });
        
        // Доступні курси - всі інші (без прогресу і не завершені)
        const processedIds = new Set([...completedCourses.map(c => c.id), ...inProgressCourses.map(c => c.id)]);
        const availableCourses = allCourses.filter(c => !processedIds.has(c.id));

        // Відображення результатів тестів
        const testResults = user.test_results || [];

        content.innerHTML = `
            <div class="profile-grid">
                <div class="profile-card">
                    <h3>Персональні дані</h3>
                    <div class="profile-info">
                        <div class="info-row">
                            <span class="info-label">ПІБ:</span>
                            <span class="info-value">${user.full_name}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${user.email}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Роль:</span>
                            <span class="info-value">${getRoleName(user.role)}</span>
                        </div>
                        ${user.personnel ? `
                            <div class="info-row">
                                <span class="info-label">Посада:</span>
                                <span class="info-value">${user.personnel.position}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Звання:</span>
                                <span class="info-value">${user.personnel.rank}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${user.crews && user.crews.length > 0 ? `
                    <div class="profile-card">
                        <h3>Екіпаж</h3>
                        ${user.crews.map(crew => `
                            <div class="crew-info">
                                <h4>${crew.name}</h4>
                                <p><strong>Тип БПЛА:</strong> ${crew.uav_type}</p>
                                ${crew.role ? `<p><strong>Роль в екіпажі:</strong> ${crew.role}</p>` : ''}
                                <button class="btn-secondary btn-small" onclick="viewCrewDetails(${crew.id})">Деталі екіпажу</button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="profile-card">
                        <h3>Екіпаж</h3>
                        <p class="empty-state">Користувач не прив'язаний до екіпажу</p>
                    </div>
                `}

                <div class="profile-card">
                    <h3>Пройдені курси (${completedCourses.length})</h3>
                    ${completedCourses.length > 0 ? `
                        <div class="courses-list">
                            ${completedCourses.map(course => `
                                <div class="course-item">
                                    <div class="course-info">
                                        <h4>${course.title || 'Курс'}</h4>
                                        <p>Прогрес: ${course.progress || 0}%</p>
                                        ${course.completed_at ? `<p class="course-date">Завершено: ${formatDate(course.completed_at)}</p>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="empty-state">Пройдені курси відсутні</p>'}
                </div>

                <div class="profile-card">
                    <h3>Курси в процесі (${inProgressCourses.length})</h3>
                    ${inProgressCourses.length > 0 ? `
                        <div class="courses-list">
                            ${inProgressCourses.map(course => `
                                <div class="course-item">
                                    <div class="course-info">
                                        <h4>${course.title || 'Курс'}</h4>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${course.progress || 0}%"></div>
                                        </div>
                                        <p>Прогрес: ${course.progress || 0}%</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="empty-state">Курси в процесі відсутні</p>'}
                </div>

                <div class="profile-card">
                    <h3>Доступні курси (${availableCourses.length})</h3>
                    ${availableCourses.length > 0 ? `
                        <div class="courses-list">
                            ${availableCourses.map(course => `
                                <div class="course-item">
                                    <div class="course-info">
                                        <h4>${course.title || 'Курс'}</h4>
                                        <button class="btn-primary btn-small" onclick="startCourse(${course.id})">Почати курс</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="empty-state">Доступні курси відсутні</p>'}
                </div>

                <div class="profile-card">
                    <h3>Історичні екіпажі</h3>
                    <p class="empty-state">Функціонал в розробці</p>
                </div>

                <div class="profile-card">
                    <h3>Результати тестів (${testResults.length})</h3>
                    ${testResults.length > 0 ? `
                        <div class="test-results-list">
                            ${testResults.map(test => `
                                <div class="test-result-item ${test.passed ? 'passed' : 'failed'}">
                                    <div class="test-info">
                                        <h4>${test.display_title || test.test_title || 'Тест'}</h4>
                                        <p>Оцінка: ${test.score}/${test.max_score} (${test.percentage}%)</p>
                                        ${test.completed_at ? `<p class="test-date">Дата: ${formatDate(test.completed_at)}</p>` : ''}
                                    </div>
                                    <div class="test-status ${test.passed ? 'passed' : 'failed'}">
                                        ${test.passed ? '✅ Пройдено' : '❌ Не пройдено'}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="empty-state">Результати тестів відсутні</p>'}
                </div>

                ${user.learning_history && user.learning_history.length > 0 ? `
                    <div class="profile-card full-width">
                        <h3>Історія навчання</h3>
                        <div class="learning-history">
                            ${user.learning_history.slice(0, 10).map(entry => `
                                <div class="history-item">
                                    <span class="history-action">${getActionName(entry.action)}</span>
                                    <span class="history-entity">${entry.entity_type}</span>
                                    <span class="history-date">${formatDate(entry.created_at)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<p class="error">Помилка завантаження: ${error.message}</p>`;
    }
}

// Допоміжні функції для профілю
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

function getActionName(action) {
    const actions = {
        'viewed': 'Переглянуто',
        'started': 'Почато',
        'completed': 'Завершено',
        'passed': 'Пройдено',
        'failed': 'Не пройдено'
    };
    return actions[action] || action;
}

function startCourse(courseId) {
    console.log('Start course:', courseId);
    // TODO: Реалізувати початок курсу
    showNotification('Функціонал буде додано', 'info');
}

// Завантаження адмін панелі
function loadAdminPanel() {
    if (typeof loadAdminPanel === 'function' && typeof loadAdminPanel !== typeof loadAdminPanelOld) {
        // Використовуємо нову версію з admin.js
        if (typeof loadAdminPanel !== 'undefined') {
            loadAdminPanel();
        }
    } else {
        // Fallback
        loadAdminPanelOld();
    }
}

// Стара версія (fallback)
function loadAdminPanelOld() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    content.innerHTML = `
        <div class="admin-section">
            <h3>Користувачі</h3>
            <p>Функціонал буде додано</p>
        </div>
        <div class="admin-section">
            <h3>Онлайн/Офлайн статус</h3>
            <p>Функціонал буде додано</p>
        </div>
    `;
}

// Завантаження панелі інструктора
function loadReaditPanel() {
    const content = document.getElementById('readitContent');
    if (!content) return;

    content.innerHTML = `
        <div class="readit-section">
            <h3>Управління курсами</h3>
            <p>Функціонал буде додано</p>
        </div>
        <div class="readit-section">
            <h3>Управління базою знань</h3>
            <p>Функціонал буде додано</p>
        </div>
    `;
}

// Перемикання виду (список/плитка) - універсальна функція
function toggleView(mode, sectionId = null) {
    // Якщо sectionId не вказано, визначаємо з активної секції
    if (!sectionId) {
        const activeSection = document.querySelector('.section.active');
        if (activeSection) {
            sectionId = activeSection.id;
        }
    }

    // Оновлення кнопок перемикача
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
        const toggleButtons = activeSection.querySelectorAll('.toggle-btn');
        toggleButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === mode) {
                btn.classList.add('active');
            }
        });
    }

    // Збереження вибору
    if (sectionId) {
        localStorage.setItem(`${sectionId}ViewMode`, mode);
        
        // Для курсів використовуємо функцію з courses.js
        if (sectionId === 'courses' && typeof toggleCoursesView === 'function') {
            toggleCoursesView(mode);
        } else {
            // Перезавантажити контент
            loadSectionContent(sectionId);
        }
    }
}

// Допоміжні функції
function getRoleName(role) {
    const roleNames = {
        'SystemAdmin': 'Системний адміністратор',
        'Admin': 'Адміністратор',
        'Readit': 'Інструктор',
        'User': 'Користувач'
    };
    return roleNames[role] || role;
}

function getMaterialIcon(type) {
    const icons = {
        'text': '📄',
        'pdf': '📕',
        'video': '🎥'
    };
    return icons[type] || '📄';
}

async function openKnowledgeMaterial(id) {
    try {
        // Отримання матеріалу
        const response = await api.getKnowledgeMaterials();
        const data = await api.handleResponse(response);
        const material = data.data.find(m => m.id === id);
        
        if (!material) {
            showNotification('Матеріал не знайдено', 'error');
            return;
        }
        
        // Відкриття залежно від типу
        if (material.material_type === 'pdf') {
            await openKnowledgePDFMaterial(material);
        } else if (material.material_type === 'video') {
            openKnowledgeVideo(material);
        } else {
            openKnowledgeText(material);
        }
    } catch (error) {
        console.error('Помилка відкриття матеріалу:', error);
        showNotification('Помилка відкриття матеріалу', 'error');
    }
}

// Відкриття PDF матеріалу
async function openKnowledgePDFMaterial(material) {
    let pdfUrl = material.file_path;
    
    // Якщо файл в БД як base64
    if (material.file_data) {
        pdfUrl = formatDataUrl(material.file_data, 'application/pdf');
    } else if (material.file_path) {
        if (material.file_path.startsWith('data:') || material.file_path.startsWith('http') || material.file_path.startsWith('/')) {
            pdfUrl = material.file_path;
        } else {
            // Відносний шлях - додаємо базовий URL
            const USE_LOCAL_DB = typeof api !== 'undefined' && api.USE_LOCAL_DB;
            // Беремо базовий URL з scripts/api.js (або fallback)
            const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3000/api';
            pdfUrl = USE_LOCAL_DB ? material.file_path : `${baseUrl.replace('/api', '')}${material.file_path}`;
        }
    }
    
    if (typeof openPDFViewer === 'function') {
        await openPDFViewer(pdfUrl, material.title);
    } else {
        // Fallback - відкриття в новому вікні
        window.open(pdfUrl, '_blank');
    }
}

function openKnowledgeText(material) {
    // Відкриття текстового матеріалу в модальному вікні
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${material.title}</div>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="knowledge-text-content">
                    ${material.content || 'Контент відсутній'}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function openKnowledgeVideo(material) {
    // Відкриття відео в модальному вікні
    let videoUrl = null;
    const USE_LOCAL_DB = typeof api !== 'undefined' && api.USE_LOCAL_DB;
    // Беремо базовий URL з scripts/api.js (або fallback)
    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3000/api';
    
    // Визначаємо джерело відео
    if (material.file_data) {
        videoUrl = formatDataUrl(material.file_data, material.mime_type || 'video/mp4');
    } else if (material.file_path) {
        if (material.file_path.startsWith('data:') || material.file_path.startsWith('http') || material.file_path.startsWith('/')) {
            videoUrl = material.file_path;
        } else {
            // Відносний шлях
            videoUrl = USE_LOCAL_DB ? material.file_path : `${baseUrl.replace('/api', '')}${material.file_path}`;
        }
    }
    
    if (!videoUrl) {
        showNotification('Відео не знайдено', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content video-viewer-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${material.title}</div>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <video controls style="width: 100%; max-height: 70vh;">
                    <source src="${videoUrl}" type="${material.mime_type || 'video/mp4'}">
                    Ваш браузер не підтримує відео.
                </video>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// Відкриття курсу (використовує courses.js)
async function openCourse(id) {
    if (typeof openCourse === 'function' && typeof openCourse !== typeof openCourseOld) {
        // Використовуємо нову версію з courses.js
        if (typeof openCourse !== 'undefined') {
            openCourse(id);
        }
    } else {
        // Fallback до старої версії
        openCourseOld(id);
    }
}

// Стара версія (fallback)
async function openCourseOld(id) {
    try {
        const response = await api.getCourse(id);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Курс не знайдено', 'error');
            return;
        }
        
        const course = data.data;
        
        // Створення модального вікна для перегляду курсу
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'courseModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">${course.title || 'Курс'}</div>
                    <button class="close-btn" onclick="closeModal('courseModal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="course-view">
                        ${course.description ? `<div class="course-description"><p>${course.description}</p></div>` : ''}
                        ${course.content ? `
                            <div class="course-content">
                                <h3>Зміст курсу</h3>
                                <div>${course.content}</div>
                            </div>
                        ` : ''}
                        <div class="course-actions">
                            <button class="btn-primary" onclick="startCourse(${course.id})">Почати курс</button>
                            <button class="btn-secondary" onclick="closeModal('courseModal')">Закрити</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('courseModal');
        };
    } catch (error) {
        console.error('Error opening course:', error);
        showNotification('Помилка відкриття курсу: ' + (error.message || 'невідома помилка'), 'error');
    }
}

// Початок курсу
async function startCourse(courseId) {
    try {
        // Тут можна додати логіку початку курсу
        showNotification('Курс розпочато', 'success');
        closeModal('courseModal');
    } catch (error) {
        console.error('Error starting course:', error);
        showNotification('Помилка початку курсу', 'error');
    }
}

// Перегляд деталей екіпажу
function viewCrewDetails(crewId) {
    showNotification('Функціонал перегляду екіпажу в розробці', 'info');
}

// Функція showAddKnowledgeModal визначена в knowledgeBase.js

function showAddCourseModal() {
    // Завантаження категорій та матеріалів для вибору
    loadCourseModalData().then(() => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'addCourseModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Створити курс</div>
                    <button class="close-btn" onclick="closeModal('addCourseModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="addCourseForm" onsubmit="handleAddCourse(event); return false;">
                        <div class="form-group">
                            <label>Назва курсу *</label>
                            <input type="text" id="courseTitle" required>
                        </div>
                        <div class="form-group">
                            <label>Опис</label>
                            <textarea id="courseDescription" rows="4"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Тип БПЛА / засобу</label>
                            <input type="text" id="courseUavType" placeholder="Наприклад: DJI Mavic, FPV дрон">
                        </div>
                        <div class="form-group">
                            <label>Матеріали з Бази знань</label>
                            <select id="courseMaterials" multiple style="min-height: 100px;">
                                <option value="">Виберіть матеріали</option>
                            </select>
                            <small>Утримуйте Ctrl/Cmd для вибору кількох</small>
                        </div>
                        <div class="form-group">
                            <label>Відео (опціонально)</label>
                            <div class="file-upload-area" onclick="document.getElementById('courseVideoInput').click()">
                                <p>Натисніть для вибору відео</p>
                                <input type="file" id="courseVideoInput" style="display: none;" 
                                       accept="video/*" onchange="handleCourseVideoSelect(event)">
                                <div id="courseVideoPreview"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Доступність</label>
                            <select id="courseAccess">
                                <option value="all">Всі користувачі</option>
                                <option value="role">За ролями</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">Створити курс</button>
                            <button type="button" class="btn-secondary" onclick="closeModal('addCourseModal')">Скасувати</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('addCourseModal');
        };
        
        // Заповнення матеріалів
        populateCourseMaterials();
    }).catch(error => {
        console.error('Error loading course modal data:', error);
        showNotification('Помилка завантаження даних', 'error');
    });
}

// Завантаження даних для модального вікна курсу
async function loadCourseModalData() {
    try {
        const materialsResponse = await api.getKnowledgeMaterials();
        const materialsData = await api.handleResponse(materialsResponse);
        window.courseModalMaterials = materialsData.data || [];
    } catch (error) {
        console.error('Error loading materials:', error);
        window.courseModalMaterials = [];
    }
}

// Заповнення списку матеріалів
function populateCourseMaterials() {
    const select = document.getElementById('courseMaterials');
    if (!select || !window.courseModalMaterials) return;
    
    select.innerHTML = '<option value="">Виберіть матеріали</option>';
    window.courseModalMaterials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.id;
        option.textContent = `${material.title} (${material.material_type})`;
        select.appendChild(option);
    });
}

// Обробка вибору відео для курсу
function handleCourseVideoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('courseVideoPreview');
    preview.innerHTML = `
        <div class="file-preview">
            <strong>${file.name}</strong>
            <span>${formatFileSize(file.size)}</span>
        </div>
    `;
}

// Збереження курсу
async function handleAddCourse(event) {
    event.preventDefault();
    
    const title = document.getElementById('courseTitle').value;
    const description = document.getElementById('courseDescription').value;
    const uavType = document.getElementById('courseUavType').value;
    const materialsSelect = document.getElementById('courseMaterials');
    const videoInput = document.getElementById('courseVideoInput');
    const access = document.getElementById('courseAccess').value;
    
    const selectedMaterials = Array.from(materialsSelect.selectedOptions).map(opt => parseInt(opt.value));
    
    try {
        let videoPath = null;
        
        // Завантаження відео якщо є
        if (videoInput.files[0]) {
            const file = videoInput.files[0];
            if (USE_LOCAL_DB) {
                videoPath = await fileToBase64(file);
            } else {
                videoPath = await uploadFile(file);
            }
        }
        
        const courseData = {
            title: title,
            description: description,
            content: JSON.stringify({
                uav_type: uavType,
                video_path: videoPath,
                access: access
            })
        };
        
        const response = await api.createCourse(courseData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            // Прив'язка матеріалів до курсу
            if (selectedMaterials.length > 0) {
                for (const materialId of selectedMaterials) {
                    try {
                        await api.addCourseMaterial(data.data.id, materialId);
                    } catch (err) {
                        console.error('Error adding material to course:', err);
                    }
                }
            }
            
            closeModal('addCourseModal');
            showNotification('Курс створено успішно', 'success');
            loadCourses();
        }
    } catch (error) {
        console.error('Error creating course:', error);
        showNotification(error.message || 'Помилка створення курсу', 'error');
    }
}

// Форматування розміру файлу
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Конвертація файлу в base64
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Допоміжна функція для форматування data URL
function formatDataUrl(data, defaultMimeType = 'image/jpeg') {
    if (!data) return null;
    
    // Якщо вже є префікс data:, повертаємо як є
    if (typeof data === 'string' && data.startsWith('data:')) {
        return data;
    }
    
    // Якщо це base64 без префіксу, додаємо префікс
    if (typeof data === 'string') {
        return `data:${defaultMimeType};base64,${data}`;
    }
    
    // Якщо це бінарні дані, створюємо Blob URL
    try {
        const blob = new Blob([data], { type: defaultMimeType });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error('Error creating blob URL:', e);
        return null;
    }
}

// Завантаження файлу на сервер
async function uploadFile(file) {
    if (typeof api !== 'undefined' && api.USE_LOCAL_DB) {
        // Для локальної версії - конвертуємо в base64
        return await fileToBase64(file);
    }
    
    // Для серверної версії - завантаження на сервер
    const formData = new FormData();
    formData.append('file', file);
    
    const token = api.getToken();
    // Беремо базовий URL з scripts/api.js (або fallback)
    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3000/api';
    const response = await fetch(`${baseUrl}/files/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Помилка завантаження файлу');
    }
    
    return data.file_path;
}

// Експорт функцій одразу після визначення (для швидкого доступу)
if (typeof window !== 'undefined') {
    // Експортуємо критичні функції одразу
    window.showSection = showSection;
    window.loadSectionContent = loadSectionContent;
    window.loadDashboard = loadDashboard;
    window.loadProfile = loadProfile;
    window.toggleView = toggleView;
    window.openCourse = openCourse;
    window.openCourseOld = openCourseOld;
    window.openKnowledgeMaterial = openKnowledgeMaterial;
    window.openKnowledgeText = openKnowledgeText;
    window.openKnowledgeVideo = openKnowledgeVideo;
    window.openKnowledgePDFMaterial = openKnowledgePDFMaterial;
    window.showAddCourseModal = showAddCourseModal;
    window.handleAddCourse = handleAddCourse;
    window.loadCourseModalData = loadCourseModalData;
    window.populateCourseMaterials = populateCourseMaterials;
    window.handleCourseVideoSelect = handleCourseVideoSelect;
    window.startCourse = startCourse;
    window.viewCrewDetails = viewCrewDetails;
    window.formatFileSize = formatFileSize;
    window.fileToBase64 = fileToBase64;
    window.uploadFile = uploadFile;
    window.formatDataUrl = formatDataUrl;
    window.formatDate = formatDate;
    window.getActionName = getActionName;
    window.getRoleName = getRoleName;
    window.getMaterialIcon = getMaterialIcon;
    window.renderCourses = renderCourses;
    window.loadCoursesOld = loadCoursesOld;
    window.loadKnowledgeBaseOld = loadKnowledgeBaseOld;
    window.renderKnowledgeMaterials = renderKnowledgeMaterials;
    window.loadAdminPanelOld = loadAdminPanelOld;
    window.loadReaditPanel = loadReaditPanel;
    
    // Визначаємо USE_LOCAL_DB якщо не визначено
    if (typeof USE_LOCAL_DB === 'undefined') {
        window.USE_LOCAL_DB = typeof api !== 'undefined' && api.USE_LOCAL_DB !== undefined ? api.USE_LOCAL_DB : true;
    }
    
    // closeModal та showNotification експортуються в auth.js
}
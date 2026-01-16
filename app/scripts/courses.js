// Управління курсами з ієрархією Курси → Модулі → Уроки

let coursesViewMode = 'list'; // 'list' або 'grid'

// Допоміжні функції для роботи з файлами
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadFile(file) {
    const USE_LOCAL_DB = typeof api !== 'undefined' && api.USE_LOCAL_DB;
    if (USE_LOCAL_DB) {
        // Для локальної версії - конвертуємо в base64
        return await fileToBase64(file);
    }
    // Для серверної версії - завантаження на сервер
    try {
        const formData = new FormData();
        formData.append('file', file);
        const token = typeof api !== 'undefined' && api.getToken ? api.getToken() : null;
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
        return data.file_path || data.path;
    } catch (error) {
        console.error('Error uploading file:', error);
        // Fallback до base64 якщо сервер недоступний
        return await fileToBase64(file);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Завантаження курсів
async function loadCoursesPage() {
    const list = document.getElementById('coursesList');
    if (!list) return;

    list.innerHTML = '<p>Завантаження...</p>';

    try {
        const response = await api.getCourses();
        const data = await api.handleResponse(response);

        if (data.data && data.data.length > 0) {
            coursesViewMode = localStorage.getItem('coursesViewMode') || 'list';
            renderCourses(data.data, coursesViewMode);
        } else {
            list.innerHTML = '<div class="empty-state">Курси відсутні</div>';
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        list.innerHTML = `<div class="error">Помилка завантаження: ${error.message}</div>`;
    }
}

// Відображення курсів
function renderCourses(courses, viewMode = 'list') {
    const list = document.getElementById('coursesList');
    if (!list) return;

    // Оновлюємо кнопки перемикача
    const toggleButtons = document.querySelectorAll('#coursesContent .toggle-btn');
    toggleButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewMode) {
            btn.classList.add('active');
        }
    });

    if (viewMode === 'grid') {
        list.className = 'courses-list grid-view';
        list.innerHTML = courses.map(course => renderCourseCard(course)).join('');
    } else {
        list.className = 'courses-list list-view';
        list.innerHTML = courses.map(course => renderCourseListItem(course)).join('');
    }
}

// Відображення картки курсу
function renderCourseCard(course) {
    const status = getCourseStatus(course);
    const statusClass = getStatusClass(course.user_status);
    const canAccess = course.can_access !== false;

    return `
        <div class="course-card ${!canAccess ? 'locked' : ''}" onclick="${canAccess ? `openCourse(${course.id})` : 'showNotification(\'Спочатку завершіть попередній курс\', \'warning\')'}">
            <div class="course-card-header">
                <h3>${course.title || 'Без назви'}</h3>
                <div class="course-status-badge ${statusClass}">${status}</div>
            </div>
            <div class="course-card-body">
                <p class="course-description">${(course.description || '').substring(0, 150)}${course.description && course.description.length > 150 ? '...' : ''}</p>
                <div class="course-stats">
                    <span class="course-stat">📚 ${course.modules_count || 0} модулів</span>
                    <span class="course-stat">📖 ${course.lessons_count || 0} уроків</span>
                    <span class="course-stat">👥 ${course.participants_count || 0} учасників</span>
                </div>
                ${course.user_progress !== undefined ? `
                    <div class="course-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${course.user_progress || 0}%"></div>
                        </div>
                        <span class="progress-text">${course.user_progress || 0}%</span>
                    </div>
                ` : ''}
            </div>
            ${!canAccess ? '<div class="course-locked-overlay">🔒 Заблоковано</div>' : ''}
        </div>
    `;
}

// Відображення елемента списку курсу
function renderCourseListItem(course) {
    const status = getCourseStatus(course);
    const statusClass = getStatusClass(course.user_status);
    const canAccess = course.can_access !== false;

    return `
        <div class="course-item ${!canAccess ? 'locked' : ''}" onclick="${canAccess ? `openCourse(${course.id})` : 'showNotification(\'Спочатку завершіть попередній курс\', \'warning\')'}">
            <div class="course-item-icon">🎓</div>
            <div class="course-item-info">
                <div class="course-item-header">
                    <h3>${course.title || 'Без назви'}</h3>
                    <div class="course-status-badge ${statusClass}">${status}</div>
                </div>
                <p class="course-description">${(course.description || '').substring(0, 200)}${course.description && course.description.length > 200 ? '...' : ''}</p>
                <div class="course-item-meta">
                    <span class="course-meta-item">📚 ${course.modules_count || 0} модулів</span>
                    <span class="course-meta-item">📖 ${course.lessons_count || 0} уроків</span>
                    <span class="course-meta-item">👥 ${course.participants_count || 0} учасників</span>
                    ${course.user_time_spent ? `<span class="course-meta-item">⏱️ ${formatTime(course.user_time_spent)}</span>` : ''}
                </div>
                ${course.user_progress !== undefined ? `
                    <div class="course-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${course.user_progress || 0}%"></div>
                        </div>
                        <span class="progress-text">${course.user_progress || 0}%</span>
                    </div>
                ` : ''}
            </div>
            ${!canAccess ? '<div class="course-locked-icon">🔒</div>' : ''}
        </div>
    `;
}

// Отримання статусу курсу
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

// Отримання класу статусу
function getStatusClass(status) {
    if (!status) return 'status-available';
    
    const classMap = {
        'assigned': 'status-assigned',
        'in_progress': 'status-in-progress',
        'completed': 'status-completed',
        'failed': 'status-failed',
        'locked': 'status-locked'
    };
    
    return classMap[status] || 'status-available';
}

// Відкриття курсу
async function openCourse(courseId) {
    try {
        const response = await api.getCourse(courseId);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Курс не знайдено', 'error');
            return;
        }
        
        const course = data.data;
        
        // Перевірка доступу
        if (course.can_access === false) {
            showNotification('Курс недоступний. Спочатку завершіть попередній курс.', 'warning');
            return;
        }
        
        // Відображення курсу з модулями та уроками
        showCourseView(course);
    } catch (error) {
        console.error('Error opening course:', error);
        showNotification('Помилка відкриття курсу: ' + (error.message || 'невідома помилка'), 'error');
    }
}

// Відображення перегляду курсу
function showCourseView(course) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'courseViewModal';
    
    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    const canEdit = currentUser && ['Readit', 'Admin', 'SystemAdmin'].includes(currentUser.role);
    
    modal.innerHTML = `
        <div class="modal-content large-modal course-view-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${course.title || 'Курс'}</div>
                <div style="display: flex; gap: 10px;">
                    ${canEdit ? `<button class="btn-secondary btn-small" onclick="editCourseAvatar(${course.id})">🖼️ Змінити аватару</button>` : ''}
                    <button class="close-btn" onclick="closeModal('courseViewModal')">✕</button>
                </div>
            </div>
            <div class="modal-body">
                ${course.avatar_path || course.avatar_data ? `
                    <div class="course-avatar-preview" style="text-align: center; margin-bottom: 20px;">
                        <img src="${course.avatar_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(course.avatar_data, 'image/jpeg') : (course.avatar_data.startsWith('data:') ? course.avatar_data : 'data:image/jpeg;base64,' + course.avatar_data)) : course.avatar_path}" 
                             alt="${course.title}" 
                             style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--primary);">
                    </div>
                ` : ''}
                ${course.description ? `<div class="course-view-description"><p>${course.description}</p></div>` : ''}
                
                <div class="course-modules-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3>Модулі курсу</h3>
                        ${(typeof window !== 'undefined' && window.currentUser && ['Readit', 'Admin', 'SystemAdmin'].includes(window.currentUser.role)) ? `
                            <button class="btn-primary btn-small" onclick="showAddModuleModal(${course.id})">➕ Додати модуль</button>
                        ` : ''}
                    </div>
                    <div id="courseModulesList" class="course-modules-list">
                        ${renderCourseModules(course.modules || [])}
                    </div>
                </div>
                
                ${course.test_id ? `
                    <div class="course-test-section" style="margin-top: 30px; padding: 20px; background: var(--bg-card); border-radius: 8px; border: 2px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0;">📝 Тест курсу</h3>
                            ${canEdit ? `
                                <button class="btn-secondary btn-small" onclick="editTest(${course.test_id}, ${course.id})">✏️ Редагувати тест</button>
                            ` : ''}
                        </div>
                        <p>Після завершення всіх модулів необхідно пройти тест для завершення курсу.</p>
                        ${areAllModulesCompleted(course.modules || []) ? `
                            <button class="btn-primary" onclick="startTest(${course.test_id}, ${course.id})">📝 Пройти тест</button>
                        ` : '<p class="text-muted">Спочатку завершіть всі модулі курсу</p>'}
                    </div>
                ` : canEdit ? `
                    <div class="course-test-section" style="margin-top: 30px; padding: 20px; background: var(--bg-card); border-radius: 8px; border: 2px solid var(--border);">
                        <h3>📝 Тест курсу</h3>
                        <p>Тест для курсу ще не створено.</p>
                        <button class="btn-primary" onclick="showAddTestModal(${course.id})">➕ Створити тест</button>
                    </div>
                ` : ''}
                
                ${course.user_status === 'assigned' || !course.user_status ? `
                    <div class="course-actions">
                        <button class="btn-primary" onclick="startCourseFromView(${course.id})">Почати курс</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('courseViewModal');
    };
}

// Відображення модулів курсу
function renderCourseModules(modules) {
    if (modules.length === 0) {
        return '<div class="empty-state">Модулі відсутні</div>';
    }
    
    return modules.map(module => {
        const canAccess = module.user_status !== 'locked' && (module.user_status || true);
        const lessonsCount = module.lessons_count || 0;
        const progress = module.user_progress || 0;
        
        return `
            <div class="course-module-item ${!canAccess ? 'locked' : ''}" onclick="${canAccess ? `openModule(${module.id}, '${(module.title || 'Без назви').replace(/'/g, "\\'")}')` : ''}">
                <div class="module-header">
                    <h4>${module.title || 'Без назви'}</h4>
                    ${module.user_status ? `<span class="module-status ${getStatusClass(module.user_status)}">${getCourseStatus(module)}</span>` : ''}
                </div>
                <div class="module-info">
                    <span class="module-lessons-count">📚 ${lessonsCount} уроків</span>
                    ${progress > 0 ? `
                        <div class="module-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text">${progress}%</span>
                        </div>
                    ` : ''}
                </div>
                ${!canAccess ? '<div class="module-locked">🔒 Заблоковано</div>' : ''}
            </div>
        `;
    }).join('');
}

// Відкриття модуля
async function openModule(moduleId, moduleTitle = null) {
    try {
        const response = await api.getModuleLessons(moduleId);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Модуль не знайдено', 'error');
            return;
        }
        
        const lessons = data.data;
        showModuleView(moduleId, lessons, moduleTitle);
    } catch (error) {
        console.error('Error opening module:', error);
        showNotification('Помилка відкриття модуля: ' + (error.message || 'невідома помилка'), 'error');
    }
}

// Відображення перегляду модуля
function showModuleView(moduleId, lessons, moduleTitle = 'Модуль') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'moduleViewModal';
    
    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    const canEdit = currentUser && ['Readit', 'Admin', 'SystemAdmin'].includes(currentUser.role);
    
    modal.innerHTML = `
        <div class="modal-content large-modal module-view-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${moduleTitle}</div>
                <div style="display: flex; gap: 10px;">
                    ${canEdit ? `<button class="btn-primary btn-small" onclick="showAddLessonModal(${moduleId})">➕ Додати урок</button>` : ''}
                    <button class="close-btn" onclick="closeModal('moduleViewModal')">✕</button>
                </div>
            </div>
            <div class="modal-body">
                <div class="module-lessons-list">
                    ${renderModuleLessons(lessons)}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('moduleViewModal');
    };
}

// Відображення уроків модуля
function renderModuleLessons(lessons) {
    if (lessons.length === 0) {
        return '<div class="empty-state">Уроки відсутні</div>';
    }
    
    return lessons.map(lesson => {
        const canAccess = lesson.can_access !== false;
        const isCompleted = lesson.user_is_completed;
        const timeOnPage = lesson.user_time_on_page_seconds || 0;
        const minimumTime = lesson.minimum_time_seconds || 180;
        const timeRemaining = Math.max(0, minimumTime - timeOnPage);
        
        return `
            <div class="lesson-item ${!canAccess ? 'locked' : ''} ${isCompleted ? 'completed' : ''}" 
                 onclick="${canAccess ? `openLesson(${lesson.id})` : ''}">
                <div class="lesson-icon">${getLessonIcon(lesson.content_type)}</div>
                <div class="lesson-info">
                    <h4>${lesson.title || 'Без назви'}</h4>
                    ${lesson.description ? `<p class="lesson-description">${lesson.description}</p>` : ''}
                    <div class="lesson-meta">
                        <span class="lesson-type">${getContentTypeName(lesson.content_type)}</span>
                        ${isCompleted ? '<span class="lesson-completed">✅ Завершено</span>' : ''}
                        ${!isCompleted && timeRemaining > 0 ? `<span class="lesson-time-remaining">⏱️ Залишилось: ${formatTime(timeRemaining)}</span>` : ''}
                    </div>
                </div>
                ${!canAccess ? '<div class="lesson-locked">🔒</div>' : ''}
            </div>
        `;
    }).join('');
}

// Відкриття уроку
async function openLesson(lessonId) {
    try {
        // Почати урок
        try {
            const startResponse = await api.startLesson(lessonId);
            const startData = await api.handleResponse(startResponse);
            if (!startData.success) {
                console.warn('Could not start lesson:', startData.message);
            }
        } catch (startError) {
            console.warn('Error starting lesson (continuing anyway):', startError);
            // Продовжуємо навіть якщо не вдалося зафіксувати старт
        }
        
        const response = await api.getLesson(lessonId);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Урок не знайдено', 'error');
            return;
        }
        
        const lesson = data.data;
        
        // Перевірка доступу
        if (lesson.can_access === false) {
            showNotification('Урок недоступний. Спочатку завершіть попередній урок.', 'warning');
            return;
        }
        
        // Відображення уроку
        showLessonView(lesson);
    } catch (error) {
        console.error('Error opening lesson:', error);
        const errorMessage = error.message || 'невідома помилка';
        if (errorMessage.includes('Не вдалося підключитися') || errorMessage.includes('Failed to fetch') || errorMessage.includes('Load failed')) {
            showNotification('Помилка підключення до сервера. Перевірте підключення до інтернету або використовуйте локальну версію.', 'error');
        } else {
            showNotification('Помилка відкриття уроку: ' + errorMessage, 'error');
        }
    }
}

// Відображення перегляду уроку
function showLessonView(lesson) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'lessonViewModal';
    
    const minimumTime = lesson.minimum_time_seconds || 180;
    const timeOnPage = lesson.user_time_on_page_seconds || 0;
    const timeRemaining = Math.max(0, minimumTime - timeOnPage);
    const isCompleted = lesson.user_is_completed;
    
    modal.innerHTML = `
        <div class="modal-content large-modal lesson-view-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${lesson.title || 'Урок'}</div>
                <button class="close-btn" onclick="closeModal('lessonViewModal')">✕</button>
            </div>
            <div class="modal-body">
                ${lesson.description ? `<div class="lesson-description"><p>${lesson.description}</p></div>` : ''}
                
                <div class="lesson-content">
                    ${renderLessonContent(lesson)}
                </div>
                
                <div class="lesson-timer">
                    <div class="timer-info">
                        <span>Мінімальний час: ${formatTime(minimumTime)}</span>
                        <span id="lessonTimeSpent">Час на сторінці: ${formatTime(timeOnPage)}</span>
                        ${!isCompleted && timeRemaining > 0 ? `<span class="time-remaining">Залишилось: ${formatTime(timeRemaining)}</span>` : ''}
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="lessonTimeProgress" style="width: ${Math.min(100, (timeOnPage / minimumTime) * 100)}%"></div>
                    </div>
                </div>
                
                <div class="lesson-actions">
                    ${!isCompleted ? `
                        <button class="btn-primary" id="completeLessonBtn" onclick="completeLesson(${lesson.id})" disabled>
                            Завершити урок
                        </button>
                        <small class="lesson-complete-hint">Мінімальний час перебування: ${formatTime(minimumTime)}</small>
                    ` : `
                        <div class="lesson-completed-message">✅ Урок завершено</div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('lessonViewModal');
    };
    
    // Запуск таймера відстеження часу
    if (!isCompleted) {
        startLessonTimer(lesson.id, timeOnPage, minimumTime);
    }
}

// Відображення контенту уроку
function renderLessonContent(lesson) {
    const contentType = lesson.content_type || 'text';
    
    if (contentType === 'text' || contentType === 'mixed') {
        let textContent = lesson.text_content || '';
        
        // Якщо текст порожній або відсутній
        if (!textContent || textContent.trim() === '') {
            textContent = '<p class="empty-state">Текстовий контент відсутній</p>';
        } else {
            // Якщо текст вже містить HTML теги - використовуємо як є (з захистом)
            if (textContent.includes('<') && textContent.includes('>')) {
                // Захист від XSS
                textContent = textContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                textContent = textContent.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
            } else {
                // Якщо звичайний текст - форматуємо як у Word
                // Заміна переносів рядків на параграфи
                textContent = textContent.split('\n\n').map(para => {
                    if (para.trim()) {
                        // Форматування списків
                        if (para.trim().match(/^[-•*]\s/)) {
                            return '<ul><li>' + para.trim().substring(1).trim() + '</li></ul>';
                        }
                        if (para.trim().match(/^\d+\.\s/)) {
                            return '<ol><li>' + para.trim().replace(/^\d+\.\s/, '') + '</li></ol>';
                        }
                        // Жирний текст **текст**
                        para = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                        // Курсив *текст*
                        para = para.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
                        // Підкреслений _текст_
                        para = para.replace(/_([^_]+?)_/g, '<u>$1</u>');
                        // Заміна переносів рядків на <br>
                        para = para.replace(/\n/g, '<br>');
                        return '<p style="margin-bottom: 12px; line-height: 1.6; text-align: justify;">' + para + '</p>';
                    }
                    return '';
                }).join('');
            }
        }
        
        return `
            <div class="lesson-text-content" style="background: var(--bg-card); padding: 30px; border-radius: 8px; color: var(--text-light); font-size: 16px; line-height: 1.8; max-width: 100%; overflow-x: auto;">
                <div style="font-family: 'Times New Roman', serif; text-align: justify;">
                    ${textContent}
                </div>
            </div>
        `;
    }
    
    if (contentType === 'video' || contentType === 'mixed') {
        let videoUrl = lesson.video_path || lesson.video_data;
        
        // Якщо відео в base64
        if (lesson.video_data) {
            // Використовуємо допоміжну функцію для форматування
            if (typeof formatDataUrl === 'function') {
                videoUrl = formatDataUrl(lesson.video_data, lesson.mime_type || 'video/mp4');
            } else {
                // Fallback
                if (lesson.video_data.startsWith('data:')) {
                    videoUrl = lesson.video_data;
                } else {
                    videoUrl = `data:${lesson.mime_type || 'video/mp4'};base64,${lesson.video_data}`;
                }
            }
        } else if (lesson.video_path) {
            if (lesson.video_path.startsWith('data:') || lesson.video_path.startsWith('http') || lesson.video_path.startsWith('/')) {
                videoUrl = lesson.video_path;
            } else {
                videoUrl = `${API_BASE_URL.replace('/api', '')}${lesson.video_path}`;
            }
        }
        
        return `
            <div class="lesson-video-content">
                <div class="video-loading" id="lessonVideoLoading" style="display: none; text-align: center; padding: 20px;">
                    Завантаження відео...
                </div>
                <video controls preload="metadata" style="width: 100%; max-height: 60vh; display: none;" id="lessonVideo">
                    <source src="${videoUrl}" type="${lesson.mime_type || 'video/mp4'}">
                    Ваш браузер не підтримує відео.
                </video>
                <div class="video-error" id="lessonVideoError" style="display: none; text-align: center; padding: 20px; color: var(--danger);">
                    Помилка завантаження відео. Перевірте формат файлу.
                </div>
            </div>
            <script>
                (function() {
                    const video = document.getElementById('lessonVideo');
                    const loading = document.getElementById('lessonVideoLoading');
                    const error = document.getElementById('lessonVideoError');
                    
                    if (video) {
                        video.addEventListener('loadstart', () => {
                            if (loading) loading.style.display = 'block';
                            if (error) error.style.display = 'none';
                        });
                        
                        video.addEventListener('canplay', () => {
                            if (loading) loading.style.display = 'none';
                            video.style.display = 'block';
                        });
                        
                        video.addEventListener('error', (e) => {
                            console.error('Video loading error:', e);
                            if (loading) loading.style.display = 'none';
                            if (error) error.style.display = 'block';
                            video.style.display = 'none';
                        });
                        
                        // Спробувати завантажити
                        video.load();
                    }
                })();
            </script>
        `;
    }
    
    if (contentType === 'pdf' || contentType === 'mixed') {
        let pdfUrl = lesson.pdf_path || lesson.pdf_data;
        
        // Якщо PDF в base64
        if (lesson.pdf_data) {
            // Використовуємо допоміжну функцію для форматування
            if (typeof formatDataUrl === 'function') {
                pdfUrl = formatDataUrl(lesson.pdf_data, 'application/pdf');
            } else {
                // Fallback
                if (lesson.pdf_data.startsWith('data:')) {
                    pdfUrl = lesson.pdf_data;
                } else {
                    pdfUrl = `data:application/pdf;base64,${lesson.pdf_data}`;
                }
            }
        } else if (lesson.pdf_path) {
            if (lesson.pdf_path.startsWith('data:') || lesson.pdf_path.startsWith('http') || lesson.pdf_path.startsWith('/')) {
                pdfUrl = lesson.pdf_path;
            } else {
                pdfUrl = `${API_BASE_URL.replace('/api', '')}${lesson.pdf_path}`;
            }
        }
        
        // Використовуємо PDF.js для кращої підтримки
        if (typeof openPDFViewer === 'function') {
            return `
                <div class="lesson-pdf-content">
                    <button class="btn-primary" onclick="openPDFViewer('${pdfUrl}', '${lesson.title || 'PDF'}')">
                        Відкрити PDF
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="lesson-pdf-content">
                    <iframe src="${pdfUrl}" style="width: 100%; height: 60vh; border: none;" id="lessonPdfFrame"></iframe>
                    <div class="pdf-error" id="lessonPdfError" style="display: none; text-align: center; padding: 20px; color: var(--danger);">
                        Помилка завантаження PDF. <a href="${pdfUrl}" target="_blank">Спробуйте відкрити в новому вікні</a>
                    </div>
                </div>
            `;
        }
    }
    
    return '<div class="empty-state">Контент відсутній</div>';
}

// Запуск таймера уроку
let lessonTimerInterval = null;
function startLessonTimer(lessonId, initialTime, minimumTime) {
    let timeSpent = initialTime;
    
    if (lessonTimerInterval) {
        clearInterval(lessonTimerInterval);
    }
    
    lessonTimerInterval = setInterval(async () => {
        timeSpent += 1;
        
        // Оновлення відображення
        const timeSpentEl = document.getElementById('lessonTimeSpent');
        const progressEl = document.getElementById('lessonTimeProgress');
        const completeBtn = document.getElementById('completeLessonBtn');
        
        if (timeSpentEl) {
            timeSpentEl.textContent = `Час на сторінці: ${formatTime(timeSpent)}`;
        }
        
        if (progressEl) {
            const progress = Math.min(100, (timeSpent / minimumTime) * 100);
            progressEl.style.width = progress + '%';
        }
        
        // Активуємо кнопку завершення після мінімального часу
        if (completeBtn && timeSpent >= minimumTime) {
            completeBtn.disabled = false;
        }
        
        // Оновлення на сервері кожні 30 секунд
        if (timeSpent % 30 === 0) {
            try {
                await api.updateLessonTime(lessonId, timeSpent);
            } catch (error) {
                console.error('Error updating lesson time:', error);
            }
        }
    }, 1000);
}

// Завершення уроку
async function completeLesson(lessonId) {
    try {
        const response = await api.completeLesson(lessonId);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            if (lessonTimerInterval) {
                clearInterval(lessonTimerInterval);
                lessonTimerInterval = null;
            }
            
            showNotification('Урок завершено!', 'success');
            closeModal('lessonViewModal');
            
            // Оновлення списку курсів
            loadCourses();
        }
    } catch (error) {
        console.error('Error completing lesson:', error);
        showNotification(error.message || 'Помилка завершення уроку', 'error');
    }
}

// Початок курсу з перегляду
async function startCourseFromView(courseId) {
    try {
        const response = await api.startCourse(courseId);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            showNotification('Курс розпочато!', 'success');
            closeModal('courseViewModal');
            loadCourses();
        }
    } catch (error) {
        console.error('Error starting course:', error);
        showNotification(error.message || 'Помилка початку курсу', 'error');
    }
}

// Перевірка чи всі модулі завершені
function areAllModulesCompleted(modules) {
    if (!modules || modules.length === 0) return false;
    return modules.every(module => {
        if (!module.lessons || module.lessons.length === 0) return false;
        return module.lessons.every(lesson => lesson.user_is_completed === true);
    });
}

// Редагування тесту
async function editTest(testId, courseId) {
    try {
        const response = await api.getTest(testId);
        const data = await api.handleResponse(response);
        
        if (data.success && data.data) {
            showAddTestModal(courseId, data.data);
        } else {
            showNotification('Тест не знайдено', 'error');
        }
    } catch (error) {
        console.error('Error loading test:', error);
        showNotification('Помилка завантаження тесту', 'error');
    }
}

// Допоміжні функції
function getLessonIcon(contentType) {
    const icons = {
        'text': '📄',
        'video': '🎥',
        'pdf': '📕',
        'mixed': '📚'
    };
    return icons[contentType] || '📄';
}

function getContentTypeName(contentType) {
    const names = {
        'text': 'Текст',
        'video': 'Відео',
        'pdf': 'PDF',
        'mixed': 'Змішаний'
    };
    return names[contentType] || contentType;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} хв ${secs} сек`;
}

// Перемикання виду курсів
function toggleCoursesView(mode) {
    coursesViewMode = mode;
    localStorage.setItem('coursesViewMode', mode);
    loadCoursesPage();
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.loadCoursesPage = loadCoursesPage;
    window.loadCourses = loadCoursesPage; // Аліас для сумісності
    window.renderCourses = renderCourses;
    window.renderCourseCard = renderCourseCard;
    window.renderCourseListItem = renderCourseListItem;
    window.getCourseStatus = getCourseStatus;
    window.getStatusClass = getStatusClass;
    window.openCourse = openCourse;
    window.showCourseView = showCourseView;
    window.renderCourseModules = renderCourseModules;
    window.openModule = openModule;
    window.showModuleView = showModuleView;
    window.renderModuleLessons = renderModuleLessons;
    window.openLesson = openLesson;
    window.showLessonView = showLessonView;
    window.renderLessonContent = renderLessonContent;
    window.startLessonTimer = startLessonTimer;
    window.completeLesson = completeLesson;
    window.startCourseFromView = startCourseFromView;
    window.getLessonIcon = getLessonIcon;
    window.getContentTypeName = getContentTypeName;
    window.formatTime = formatTime;
    window.showAddModuleModal = showAddModuleModal;
    window.handleAddModule = handleAddModule;
    window.editCourseAvatar = editCourseAvatar;
    window.handleCourseAvatarChange = handleCourseAvatarChange;
    window.showAddLessonModal = showAddLessonModal;
    window.handleAddLesson = handleAddLesson;
    window.showAddTestModal = showAddTestModal;
    window.handleAddTest = handleAddTest;
    window.startTest = startTest;
    window.toggleLessonContentInputs = toggleLessonContentInputs;
    window.handleLessonVideoSelect = handleLessonVideoSelect;
    window.handleLessonPdfSelect = handleLessonPdfSelect;
    window.formatText = formatText;
    window.updateLessonTextContent = updateLessonTextContent;
    window.initLessonTextEditor = initLessonTextEditor;
    // formatDataUrl експортується в main.js
    // closeModal та showNotification експортуються в auth.js
}

// Модальне вікно створення тесту
function showAddTestModal(courseId, existingTest = null) {
    const isEdit = !!existingTest;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addTestModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${isEdit ? 'Редагувати тест' : 'Створити тест для курсу'}</div>
                <button class="close-btn" onclick="closeModal('addTestModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addTestForm" onsubmit="handleAddTest(event, ${courseId}, ${existingTest ? existingTest.id : 'null'}); return false;">
                    <input type="hidden" id="testId" value="${existingTest ? existingTest.id : ''}">
                    <div class="form-group">
                        <label>Назва тесту *</label>
                        <input type="text" id="testTitle" required placeholder="Введіть назву тесту" value="${existingTest ? (existingTest.title || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label>Опис тесту</label>
                        <textarea id="testDescription" rows="3" placeholder="Введіть опис тесту (необов'язково)">${existingTest ? (existingTest.description || '') : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Мінімальний бал для проходження (%)</label>
                        <input type="number" id="testPassingScore" value="${existingTest ? (existingTest.passing_score || 70) : 70}" min="0" max="100" placeholder="70">
                    </div>
                    <div class="form-group">
                        <label>Обмеження часу (хвилини, 0 = без обмеження)</label>
                        <input type="number" id="testTimeLimit" value="${existingTest ? (existingTest.time_limit || 0) : 0}" min="0" placeholder="0">
                    </div>
                    <div id="testQuestionsContainer">
                        <h4>Питання тесту</h4>
                        <div id="testQuestionsList"></div>
                        <button type="button" class="btn-secondary" onclick="addTestQuestion()">➕ Додати питання</button>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">${isEdit ? 'Оновити тест' : 'Створити тест'}</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addTestModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addTestModal');
    };
    
    // Якщо редагуємо, завантажуємо існуючі питання
    if (isEdit && existingTest && existingTest.questions) {
        testQuestionCounter = 0;
        const questionsList = document.getElementById('testQuestionsList');
        if (questionsList && existingTest.questions.length > 0) {
            existingTest.questions.forEach((question, index) => {
                addTestQuestion();
                const questionDiv = document.getElementById(`question-${testQuestionCounter}`);
                if (questionDiv) {
                    const textArea = questionDiv.querySelector(`#questionText-${testQuestionCounter}`);
                    const typeSelect = questionDiv.querySelector(`#questionType-${testQuestionCounter}`);
                    const pointsInput = questionDiv.querySelector(`#questionPoints-${testQuestionCounter}`);
                    if (textArea) textArea.value = question.question_text || '';
                    if (typeSelect) typeSelect.value = question.question_type || 'single';
                    if (pointsInput) pointsInput.value = question.points || 1;
                    
                    // Завантажуємо відповіді
                    if (question.answers && question.answers.length > 0) {
                        question.answers.forEach((answer, aIndex) => {
                            if (aIndex === 0) {
                                const answerText = questionDiv.querySelector(`#answerText-${testQuestionCounter}-0`);
                                const answerCorrect = questionDiv.querySelector(`#answerCorrect-${testQuestionCounter}-0`);
                                if (answerText) answerText.value = answer.answer_text || '';
                                if (answerCorrect) answerCorrect.checked = answer.is_correct || false;
                            } else {
                                addTestAnswer(testQuestionCounter);
                                const answerItems = questionDiv.querySelectorAll('.test-answer-item');
                                if (answerItems[aIndex]) {
                                    const answerText = answerItems[aIndex].querySelector('.answer-text');
                                    const answerCorrect = answerItems[aIndex].querySelector('.answer-correct');
                                    if (answerText) answerText.value = answer.answer_text || '';
                                    if (answerCorrect) answerCorrect.checked = answer.is_correct || false;
                                }
                            }
                        });
                    }
                }
            });
        }
    } else {
        // Додаємо перше питання
        addTestQuestion();
    }
}

let testQuestionCounter = 0;

// Додавання питання до тесту
function addTestQuestion() {
    testQuestionCounter++;
    const questionsList = document.getElementById('testQuestionsList');
    if (!questionsList) return;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'test-question-item';
    questionDiv.id = `question-${testQuestionCounter}`;
    questionDiv.innerHTML = `
        <div class="question-header">
            <h5>Питання ${testQuestionCounter}</h5>
            <button type="button" class="btn-danger btn-small" onclick="removeTestQuestion(${testQuestionCounter})">✕ Видалити</button>
        </div>
        <div class="form-group">
            <label>Текст питання *</label>
            <textarea id="questionText-${testQuestionCounter}" required rows="2" placeholder="Введіть текст питання"></textarea>
        </div>
        <div class="form-group">
            <label>Тип питання *</label>
            <select id="questionType-${testQuestionCounter}" required onchange="toggleQuestionType(${testQuestionCounter})">
                <option value="single">Один правильний варіант</option>
                <option value="multiple">Кілька правильних варіантів</option>
                <option value="text">Текстова відповідь</option>
            </select>
        </div>
        <div class="form-group">
            <label>Балів за питання</label>
            <input type="number" id="questionPoints-${testQuestionCounter}" value="1" min="1" placeholder="1">
        </div>
        <div class="question-answers" id="answers-${testQuestionCounter}">
            <h6>Варіанти відповідей</h6>
            <div id="answersList-${testQuestionCounter}"></div>
            <button type="button" class="btn-secondary btn-small" onclick="addTestAnswer(${testQuestionCounter})">➕ Додати варіант</button>
        </div>
    `;
    
    questionsList.appendChild(questionDiv);
    
    // Додаємо 2 варіанти відповідей за замовчуванням
    addTestAnswer(testQuestionCounter);
    addTestAnswer(testQuestionCounter);
}

// Додавання варіанту відповіді
function addTestAnswer(questionId) {
    const answersList = document.getElementById(`answersList-${questionId}`);
    if (!answersList) return;
    
    const answerDiv = document.createElement('div');
    answerDiv.className = 'test-answer-item';
    answerDiv.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" class="answer-text" placeholder="Текст відповіді" required>
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" class="answer-correct"> Правильна
            </label>
            <button type="button" class="btn-danger btn-small" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    
    answersList.appendChild(answerDiv);
}

// Видалення питання
function removeTestQuestion(questionId) {
    const questionDiv = document.getElementById(`question-${questionId}`);
    if (questionDiv) {
        questionDiv.remove();
    }
}

// Перемикання типу питання
function toggleQuestionType(questionId) {
    const questionType = document.getElementById(`questionType-${questionId}`).value;
    const answersContainer = document.getElementById(`answers-${questionId}`);
    
    if (questionType === 'text') {
        answersContainer.style.display = 'none';
    } else {
        answersContainer.style.display = 'block';
    }
}

// Збереження тесту
async function handleAddTest(event, courseId, testId = null) {
    event.preventDefault();
    
    try {
        const title = document.getElementById('testTitle').value;
        const description = document.getElementById('testDescription').value;
        const passingScore = parseInt(document.getElementById('testPassingScore').value) || 70;
        const timeLimit = parseInt(document.getElementById('testTimeLimit').value) || 0;
        const isEdit = !!testId;
        
        // Збираємо питання
        const questions = [];
        const questionItems = document.querySelectorAll('.test-question-item');
        
        questionItems.forEach((item, index) => {
            const questionId = item.id.replace('question-', '');
            const questionText = document.getElementById(`questionText-${questionId}`).value;
            const questionType = document.getElementById(`questionType-${questionId}`).value;
            const questionPoints = parseInt(document.getElementById(`questionPoints-${questionId}`).value) || 1;
            
            const answers = [];
            if (questionType !== 'text') {
                const answerItems = item.querySelectorAll('.test-answer-item');
                answerItems.forEach(answerItem => {
                    const answerText = answerItem.querySelector('.answer-text').value;
                    const isCorrect = answerItem.querySelector('.answer-correct').checked;
                    if (answerText) {
                        answers.push({
                            text: answerText,
                            is_correct: isCorrect
                        });
                    }
                });
            }
            
            if (questionText) {
                questions.push({
                    question_text: questionText,
                    question_type: questionType,
                    points: questionPoints,
                    order_index: index,
                    answers: answers
                });
            }
        });
        
        if (questions.length === 0) {
            showNotification('Додайте хоча б одне питання', 'error');
            return;
        }
        
        const testData = {
            course_id: courseId,
            title: title,
            description: description || '',
            passing_score: passingScore,
            time_limit: timeLimit > 0 ? timeLimit : null,
            questions: questions
        };
        
        let response;
        if (isEdit && testId) {
            // Оновлення тесту
            response = await api.updateTest(testId, testData);
        } else {
            // Створення тесту
            response = await api.createTest(testData);
        }
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addTestModal');
            showNotification(isEdit ? 'Тест оновлено успішно' : 'Тест створено успішно', 'success');
            // Перезавантажити курс
            openCourse(courseId);
        }
    } catch (error) {
        console.error('Error creating test:', error);
        showNotification(error.message || 'Помилка створення тесту', 'error');
    }
}

// Початок тесту
async function startTest(testId, courseId) {
    try {
        const response = await api.getTest(testId);
        const data = await api.handleResponse(response);
        
        if (!data.success || !data.data) {
            showNotification('Тест не знайдено', 'error');
            return;
        }
        
        const test = data.data;
        showTestView(test, courseId);
    } catch (error) {
        console.error('Error starting test:', error);
        showNotification('Помилка завантаження тесту', 'error');
    }
}

// Відображення тесту
function showTestView(test, courseId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'testViewModal';
    
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${test.title || 'Тест'}</div>
                <button class="close-btn" onclick="closeModal('testViewModal')">✕</button>
            </div>
            <div class="modal-body">
                ${test.description ? `<p>${test.description}</p>` : ''}
                <p><strong>Мінімальний бал:</strong> ${test.passing_score}%</p>
                ${test.time_limit ? `<p><strong>Обмеження часу:</strong> ${test.time_limit} хвилин</p>` : ''}
                
                <form id="testForm" onsubmit="submitTest(event, ${test.id}, ${courseId}); return false;">
                    <div id="testQuestionsContainer">
                        ${renderTestQuestions(test.questions || [])}
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Завершити тест</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('testViewModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('testViewModal');
    };
}

// Відображення питань тесту
function renderTestQuestions(questions) {
    return questions.map((question, index) => {
        // Використовуємо ID питання, якщо є, інакше індекс
        const questionId = `q-${question.id || index}`;
        const questionKey = question.id || index;
        let answersHtml = '';
        
        if (question.question_type === 'text') {
            answersHtml = `
                <div class="form-group">
                    <textarea id="${questionId}-answer" rows="3" placeholder="Введіть відповідь"></textarea>
                </div>
            `;
        } else if (question.answers && question.answers.length > 0) {
            const isMultiple = question.question_type === 'multiple';
            answersHtml = question.answers.map((answer, ansIndex) => {
                // Використовуємо ID відповіді, якщо є, інакше індекс
                const answerId = answer.id || ansIndex;
                return `
                <div class="test-answer-option">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="${isMultiple ? 'checkbox' : 'radio'}" 
                               name="${questionId}" 
                               value="${answerId}"
                               id="${questionId}-${ansIndex}">
                        <span>${answer.answer_text || answer.text || ''}</span>
                    </label>
                </div>
            `;
            }).join('');
        } else {
            answersHtml = '<p class="text-muted">Варіанти відповідей відсутні</p>';
        }
        
        return `
            <div class="test-question-display" data-question-id="${questionKey}" id="question-${index}">
                <h4>Питання ${index + 1} (${question.points || 1} балів)</h4>
                <p>${question.question_text}</p>
                <div class="test-answers">
                    ${answersHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Відправка тесту
async function submitTest(event, testId, courseId) {
    event.preventDefault();
    
    try {
        // Збираємо відповіді
        const answers = {};
        const questions = document.querySelectorAll('.test-question-display');
        
        questions.forEach((questionDiv) => {
            // Отримуємо ID питання з data-атрибута
            const questionKey = questionDiv.getAttribute('data-question-id');
            const questionId = `q-${questionKey}`;
            const textAnswer = document.getElementById(`${questionId}-answer`);
            
            if (textAnswer) {
                answers[questionId] = textAnswer.value;
            } else {
                const selected = questionDiv.querySelectorAll('input:checked');
                if (selected.length > 0) {
                    const selectedValues = Array.from(selected).map(input => input.value);
                    // Для single choice беремо перше значення, для multiple - масив
                    const isMultiple = selected.length > 1 || questionDiv.querySelector('input[type="checkbox"]');
                    answers[questionId] = isMultiple ? selectedValues : selectedValues[0];
                }
            }
        });
        
        const response = await api.submitTest(testId, { answers });
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('testViewModal');
            showTestResults(data.data, testId, courseId);
        }
    } catch (error) {
        console.error('Error submitting test:', error);
        showNotification(error.message || 'Помилка відправки тесту', 'error');
    }
}

// Відображення результатів тесту
function showTestResults(result, testId, courseId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'testResultsModal';
    
    const passed = result.passed;
    const percentage = result.percentage || 0;
    const score = result.score || 0;
    const maxScore = result.max_score || 0;
    const correctCount = result.correct_answers || 0;
    const incorrectCount = result.incorrect_answers || 0;
    
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Результати тесту</div>
                <button class="close-btn" onclick="closeModal('testResultsModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="test-results-summary" style="text-align: center; padding: 20px; background: var(--bg-card); border-radius: 8px; margin-bottom: 20px;">
                    <h2 style="color: ${passed ? 'var(--primary)' : 'var(--danger)'};">
                        ${passed ? '✅ Тест пройдено!' : '❌ Тест не пройдено'}
                    </h2>
                    <div style="font-size: 48px; margin: 20px 0; color: var(--primary);">
                        ${percentage.toFixed(1)}%
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                        <div style="padding: 15px; background: rgba(76, 175, 80, 0.2); border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${correctCount}</div>
                            <div>Правильних відповідей</div>
                        </div>
                        <div style="padding: 15px; background: rgba(244, 67, 54, 0.2); border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #f44336;">${incorrectCount}</div>
                            <div>Неправильних відповідей</div>
                        </div>
                    </div>
                    <div style="margin-top: 20px;">
                        <p><strong>Балів:</strong> ${score} з ${maxScore}</p>
                    </div>
                </div>
                
                ${result.details ? `
                    <div class="test-results-details">
                        <h3>Деталі результатів</h3>
                        ${result.details.map((detail, index) => `
                            <div class="test-result-item" style="padding: 15px; margin: 10px 0; background: var(--bg-card); border-radius: 8px; border-left: 4px solid ${detail.correct ? '#4CAF50' : '#f44336'};">
                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                    <div>
                                        <h4>Питання ${index + 1}</h4>
                                        <p>${detail.question_text}</p>
                                        <p><strong>Ваша відповідь:</strong> ${detail.user_answer || 'Не відповіли'}</p>
                                        ${!detail.correct ? `<p><strong>Правильна відповідь:</strong> ${detail.correct_answer}</p>` : ''}
                                    </div>
                                    <span style="font-size: 24px;">${detail.correct ? '✅' : '❌'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="form-actions">
                    <button class="btn-primary" onclick="closeModal('testResultsModal'); openCourse(${courseId});">Повернутися до курсу</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('testResultsModal');
    };
}

// Модальне вікно створення уроку
function showAddLessonModal(moduleId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addLessonModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Додати урок до модуля</div>
                <button class="close-btn" onclick="closeModal('addLessonModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addLessonForm" onsubmit="handleAddLesson(event, ${moduleId}); return false;">
                    <div class="form-group">
                        <label>Назва уроку *</label>
                        <input type="text" id="lessonTitle" required placeholder="Введіть назву уроку">
                    </div>
                    <div class="form-group">
                        <label>Опис уроку</label>
                        <textarea id="lessonDescription" rows="3" placeholder="Введіть опис уроку (необов'язково)"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Тип контенту *</label>
                        <select id="lessonContentType" required onchange="toggleLessonContentInputs()">
                            <option value="text">Текст</option>
                            <option value="video">Відео</option>
                            <option value="pdf">PDF</option>
                            <option value="mixed">Змішаний</option>
                        </select>
                    </div>
                    <div class="form-group" id="lessonTextGroup">
                        <label>Текстовий контент (форматування як у Word)</label>
                        <div style="border: 2px solid var(--primary); border-radius: 8px; background: rgba(0, 0, 0, 0.5); padding: 10px;">
                            <div style="display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                                <button type="button" class="btn-secondary btn-small" onclick="formatText('bold')" title="Жирний (Ctrl+B)"><strong>B</strong></button>
                                <button type="button" class="btn-secondary btn-small" onclick="formatText('italic')" title="Курсив (Ctrl+I)"><em>I</em></button>
                                <button type="button" class="btn-secondary btn-small" onclick="formatText('underline')" title="Підкреслення (Ctrl+U)"><u>U</u></button>
                                <button type="button" class="btn-secondary btn-small" onclick="formatText('bullet')" title="Маркований список">• Список</button>
                                <button type="button" class="btn-secondary btn-small" onclick="formatText('number')" title="Нумерований список">1. Список</button>
                                <button type="button" class="btn-secondary btn-small" onclick="formatText('paragraph')" title="Параграф">¶</button>
                            </div>
                            <div id="lessonTextEditor" contenteditable="true" style="min-height: 300px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 6px; color: var(--text-light); font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; text-align: justify; outline: none;" placeholder="Введіть текст уроку..."></div>
                            <textarea id="lessonTextContent" style="display: none;"></textarea>
                        </div>
                        <small style="color: var(--text-muted); margin-top: 5px; display: block;">
                            Використовуйте кнопки для форматування або введіть текст з Markdown: **жирний**, *курсив*, _підкреслення_, - список
                        </small>
                    </div>
                    <div class="form-group" id="lessonVideoGroup" style="display: none;">
                        <label>Відео файл</label>
                        <div class="file-upload-area" onclick="document.getElementById('lessonVideoInput').click()">
                            <p>Натисніть для вибору відео</p>
                            <input type="file" id="lessonVideoInput" style="display: none;" 
                                   accept="video/*" onchange="handleLessonVideoSelect(event)">
                            <div id="lessonVideoPreview"></div>
                        </div>
                    </div>
                    <div class="form-group" id="lessonPdfGroup" style="display: none;">
                        <label>PDF файл</label>
                        <div class="file-upload-area" onclick="document.getElementById('lessonPdfInput').click()">
                            <p>Натисніть для вибору PDF</p>
                            <input type="file" id="lessonPdfInput" style="display: none;" 
                                   accept=".pdf" onchange="handleLessonPdfSelect(event)">
                            <div id="lessonPdfPreview"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Мінімальний час перегляду (секунди)</label>
                        <input type="number" id="lessonMinTime" value="180" min="0" placeholder="180">
                    </div>
                    <div class="form-group">
                        <label>Порядковий номер</label>
                        <input type="number" id="lessonOrderIndex" value="0" min="0" placeholder="Порядок відображення">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Створити урок</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addLessonModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addLessonModal');
    };
    
    // Ініціалізація редактора
    setTimeout(() => {
        initLessonTextEditor();
    }, 100);
}

// Перемикання полів контенту уроку
function toggleLessonContentInputs() {
    const contentType = document.getElementById('lessonContentType').value;
    document.getElementById('lessonTextGroup').style.display = (contentType === 'text' || contentType === 'mixed') ? 'block' : 'none';
    document.getElementById('lessonVideoGroup').style.display = (contentType === 'video' || contentType === 'mixed') ? 'block' : 'none';
    document.getElementById('lessonPdfGroup').style.display = (contentType === 'pdf' || contentType === 'mixed') ? 'block' : 'none';
}

// Обробка вибору відео для уроку
function handleLessonVideoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('lessonVideoPreview');
    preview.innerHTML = `
        <div class="file-preview">
            <strong>${file.name}</strong>
            <span>${formatFileSize(file.size)}</span>
        </div>
    `;
}

// Обробка вибору PDF для уроку
function handleLessonPdfSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('lessonPdfPreview');
    preview.innerHTML = `
        <div class="file-preview">
            <strong>${file.name}</strong>
            <span>${formatFileSize(file.size)}</span>
        </div>
    `;
}

// Форматування тексту в редакторі
function formatText(command) {
    const editor = document.getElementById('lessonTextEditor');
    if (!editor) return;
    
    document.execCommand(command, false, null);
    editor.focus();
    
    // Оновлюємо прихований textarea
    updateLessonTextContent();
}

// Оновлення прихованого textarea з HTML контенту
function updateLessonTextContent() {
    const editor = document.getElementById('lessonTextEditor');
    const textarea = document.getElementById('lessonTextContent');
    if (editor && textarea) {
        textarea.value = editor.innerHTML;
    }
}

// Ініціалізація редактора
function initLessonTextEditor() {
    const editor = document.getElementById('lessonTextEditor');
    if (editor) {
        editor.addEventListener('input', updateLessonTextContent);
        editor.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
            updateLessonTextContent();
        });
    }
}

// Збереження уроку
async function handleAddLesson(event, moduleId) {
    event.preventDefault();
    
    try {
        const title = document.getElementById('lessonTitle').value;
        const description = document.getElementById('lessonDescription').value;
        const contentType = document.getElementById('lessonContentType').value;
        
        // Отримуємо текст з редактора
        const editor = document.getElementById('lessonTextEditor');
        const textContent = editor ? editor.innerHTML : document.getElementById('lessonTextContent').value;
        const minTime = parseInt(document.getElementById('lessonMinTime').value) || 180;
        const orderIndex = parseInt(document.getElementById('lessonOrderIndex').value) || 0;
        
        let videoPath = null;
        let videoData = null;
        let pdfPath = null;
        let pdfData = null;
        let mimeType = null;
        let fileSize = 0;
        
        const videoInput = document.getElementById('lessonVideoInput');
        const pdfInput = document.getElementById('lessonPdfInput');
        
        if (videoInput && videoInput.files[0] && (contentType === 'video' || contentType === 'mixed')) {
            const file = videoInput.files[0];
            mimeType = file.type;
            fileSize = file.size;
            if (typeof api !== 'undefined' && api.USE_LOCAL_DB) {
                videoData = await fileToBase64(file);
            } else {
                videoPath = await uploadFile(file);
            }
        }
        
        if (pdfInput && pdfInput.files[0] && (contentType === 'pdf' || contentType === 'mixed')) {
            const file = pdfInput.files[0];
            mimeType = file.type;
            fileSize = file.size;
            if (typeof api !== 'undefined' && api.USE_LOCAL_DB) {
                pdfData = await fileToBase64(file);
            } else {
                pdfPath = await uploadFile(file);
            }
        }
        
        const lessonData = {
            module_id: moduleId,
            title: title,
            description: description || '',
            content_type: contentType,
            text_content: (contentType === 'text' || contentType === 'mixed') ? textContent : null,
            video_path: videoPath,
            video_data: videoData,
            pdf_path: pdfPath,
            pdf_data: pdfData,
            mime_type: mimeType,
            file_size: fileSize,
            minimum_time_seconds: minTime,
            order_index: orderIndex
        };
        
        const response = await api.createLesson(lessonData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addLessonModal');
            showNotification('Урок створено успішно', 'success');
            // Перезавантажити модуль
            openModule(moduleId);
        }
    } catch (error) {
        console.error('Error creating lesson:', error);
        showNotification(error.message || 'Помилка створення уроку', 'error');
    }
}

// Зміна аватари курсу
function editCourseAvatar(courseId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'editCourseAvatarModal';
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Змінити аватару курсу</div>
                <button class="close-btn" onclick="closeModal('editCourseAvatarModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="editCourseAvatarForm" onsubmit="handleCourseAvatarChange(event, ${courseId}); return false;">
                    <div class="form-group">
                        <label>Аватара (зображення)</label>
                        <div class="file-upload-area" onclick="document.getElementById('courseAvatarInput').click()">
                            <p>Натисніть для вибору зображення</p>
                            <input type="file" id="courseAvatarInput" style="display: none;" 
                                   accept="image/*" onchange="handleCourseAvatarSelect(event)">
                            <div id="courseAvatarPreview"></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Зберегти</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('editCourseAvatarModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('editCourseAvatarModal');
    };
}

// Обробка вибору аватари
function handleCourseAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Виберіть файл зображення', 'error');
        return;
    }
    
    const preview = document.getElementById('courseAvatarPreview');
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = `
            <div class="file-preview">
                <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 10px;">
                <p><strong>${file.name}</strong> (${formatFileSize(file.size)})</p>
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

// Збереження аватари курсу
async function handleCourseAvatarChange(event, courseId) {
    event.preventDefault();
    
    const fileInput = document.getElementById('courseAvatarInput');
    if (!fileInput.files[0]) {
        showNotification('Виберіть зображення', 'error');
        return;
    }
    
    try {
        const file = fileInput.files[0];
        let avatarData = null;
        
        if (typeof api !== 'undefined' && api.USE_LOCAL_DB) {
            avatarData = await fileToBase64(file);
        } else {
            avatarData = await uploadFile(file);
        }
        
        const courseData = {
            avatar_path: avatarData,
            avatar_data: typeof api !== 'undefined' && api.USE_LOCAL_DB ? avatarData : null
        };
        
        const response = await api.updateCourse(courseId, courseData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('editCourseAvatarModal');
            showNotification('Аватару оновлено', 'success');
            openCourse(courseId);
        }
    } catch (error) {
        console.error('Error updating course avatar:', error);
        showNotification(error.message || 'Помилка оновлення аватари', 'error');
    }
}

// Модальне вікно створення модуля
function showAddModuleModal(courseId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addModuleModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Додати модуль до курсу</div>
                <button class="close-btn" onclick="closeModal('addModuleModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addModuleForm" onsubmit="handleAddModule(event, ${courseId}); return false;">
                    <div class="form-group">
                        <label>Назва модуля *</label>
                        <input type="text" id="moduleTitle" required placeholder="Введіть назву модуля">
                    </div>
                    <div class="form-group">
                        <label>Опис модуля</label>
                        <textarea id="moduleDescription" rows="4" placeholder="Введіть опис модуля (необов'язково)"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Порядковий номер</label>
                        <input type="number" id="moduleOrderIndex" value="0" min="0" placeholder="Порядок відображення">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Створити модуль</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addModuleModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addModuleModal');
    };
}

// Збереження модуля
async function handleAddModule(event, courseId) {
    event.preventDefault();
    
    try {
        const title = document.getElementById('moduleTitle').value;
        const description = document.getElementById('moduleDescription').value;
        const orderIndex = parseInt(document.getElementById('moduleOrderIndex').value) || 0;
        
        const moduleData = {
            course_id: courseId,
            title: title,
            description: description || '',
            order_index: orderIndex
        };
        
        const response = await api.createModule(moduleData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addModuleModal');
            showNotification('Модуль створено успішно', 'success');
            // Перезавантажити курс
            openCourse(courseId);
        }
    } catch (error) {
        console.error('Error creating module:', error);
        showNotification(error.message || 'Помилка створення модуля', 'error');
    }
}


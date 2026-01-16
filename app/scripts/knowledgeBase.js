// База знань - повний функціонал

let knowledgeViewMode = 'list';
let knowledgeCategories = [];
let currentCategoryId = null;
let currentKnowledgeTab = 'materials';

// Завантаження Бази знань
async function loadKnowledgeBase() {
    if (currentKnowledgeTab === 'practice') {
        loadPracticeContent();
        return;
    }

    const content = document.getElementById('knowledgeContent');
    if (!content) return;

    try {
        // Завантаження категорій
        const categoriesResponse = await api.getKnowledgeCategories();
        const categoriesData = await api.handleResponse(categoriesResponse);
        knowledgeCategories = categoriesData.data || [];

        // Завантаження матеріалів
        const materialsResponse = await api.getKnowledgeMaterials(currentCategoryId);
        const materialsData = await api.handleResponse(materialsResponse);

        // Відображення
        renderKnowledgeBase(categoriesData.data || [], materialsData.data || []);
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        showNotification('Помилка завантаження Бази знань', 'error');
    }
}

// Перемикання вкладок Бази знань
function showKnowledgeTab(tab) {
    currentKnowledgeTab = tab;
    
    // Оновлення активних вкладок
    document.querySelectorAll('.knowledge-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Показати/приховати контент
    if (tab === 'materials') {
        document.getElementById('knowledgeContent').style.display = 'block';
        document.getElementById('practiceContent').style.display = 'none';
        loadKnowledgeBase();
    } else {
        document.getElementById('knowledgeContent').style.display = 'none';
        document.getElementById('practiceContent').style.display = 'block';
        loadPracticeContent();
    }
}

// Завантаження вкладки "Практика"
async function loadPracticeContent() {
    const content = document.getElementById('practiceContent');
    if (!content) return;

    try {
        // Завантаження відео (потрібно додати API endpoint)
        const response = await api.getPracticeVideos();
        const data = await api.handleResponse(response);
        
        renderPracticeVideos(data.data || []);
    } catch (error) {
        console.error('Error loading practice videos:', error);
        content.innerHTML = '<div class="empty-state">Помилка завантаження відео</div>';
    }
}

// Відображення відео практики
function renderPracticeVideos(videos) {
    const content = document.getElementById('practiceContent');
    if (!content) return;

    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    const canUpload = currentUser && ['Readit', 'Admin', 'SystemAdmin'].includes(currentUser.role);

    content.innerHTML = `
        <div class="practice-container">
            ${canUpload ? `
                <div class="practice-header">
                    <button class="btn-primary" onclick="showAddPracticeVideoModal()">
                        ➕ Завантажити відео
                    </button>
                </div>
            ` : ''}
            <div class="practice-videos-grid">
                ${videos.length === 0 ? '<div class="empty-state">Відео відсутні</div>' : ''}
                ${videos.map(video => `
                    <div class="practice-video-card" onclick="openPracticeVideo(${video.id})">
                        <div class="video-thumbnail">
                            ${video.thumbnail_path ? 
                                `<img src="${video.thumbnail_path}" alt="${video.title}">` :
                                '<div class="video-placeholder">🎥</div>'
                            }
                            <div class="video-duration">${formatDuration(video.duration)}</div>
                        </div>
                        <div class="video-info">
                            <h3>${video.title}</h3>
                            <p>${video.description || ''}</p>
                            <div class="video-meta">
                                <span>${video.views_count || 0} переглядів</span>
                                <span>${video.category || 'Без категорії'}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Відображення Бази знань
function renderKnowledgeBase(categories, materials) {
    const content = document.getElementById('knowledgeContent');
    if (!content) return;

    content.innerHTML = `
        <div class="knowledge-base-container">
            <!-- Категорії -->
            <div class="knowledge-categories">
                <h3>Категорії</h3>
                <div class="categories-list">
                    <div class="category-item ${currentCategoryId === null ? 'active' : ''}" 
                         onclick="selectKnowledgeCategory(null)">
                        Всі матеріали
                    </div>
                    ${categories.map(cat => `
                        <div class="category-item ${currentCategoryId === cat.id ? 'active' : ''}" 
                             onclick="selectKnowledgeCategory(${cat.id})">
                            ${cat.name}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Матеріали -->
            <div class="knowledge-materials-section">
                <div class="materials-header">
                    <div class="view-toggle">
                        <button class="toggle-btn ${knowledgeViewMode === 'list' ? 'active' : ''}" 
                                data-view="list" onclick="setKnowledgeViewMode('list')">
                            📋 Список
                        </button>
                        <button class="toggle-btn ${knowledgeViewMode === 'grid' ? 'active' : ''}" 
                                data-view="grid" onclick="setKnowledgeViewMode('grid')">
                            ⊞ Плитка
                        </button>
                    </div>
                    <button class="btn-primary" id="addKnowledgeBtn" 
                            style="display: none;" 
                            onclick="showAddKnowledgeModal()">
                        ➕ Додати матеріал
                    </button>
                </div>
                <div id="knowledgeMaterialsList" class="knowledge-materials-list ${knowledgeViewMode}-view">
                    ${renderMaterials(materials)}
                </div>
            </div>
        </div>
    `;

    // Перевірка прав доступу
    checkKnowledgePermissions();
}

// Відображення матеріалів
function renderMaterials(materials) {
    if (materials.length === 0) {
        return '<div class="empty-state">Матеріали відсутні</div>';
    }

    if (knowledgeViewMode === 'grid') {
        return materials.map(material => `
            <div class="knowledge-material-card" onclick="openKnowledgeMaterial(${material.id})">
                ${material.avatar_path || material.avatar_data ? `
                    <div class="material-avatar">
                        <img src="${material.avatar_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(material.avatar_data, 'image/jpeg') : (material.avatar_data.startsWith('data:') ? material.avatar_data : 'data:image/jpeg;base64,' + material.avatar_data)) : material.avatar_path}" 
                             alt="${material.title}" 
                             style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px 8px 0 0;">
                    </div>
                ` : `<div class="material-icon-large">${getMaterialIcon(material.material_type)}</div>`}
                <h3>${material.title}</h3>
                <p style="color: var(--text-muted);">${(material.content || '').replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                <div class="material-meta">
                    <span class="material-type">${getMaterialTypeName(material.material_type)}</span>
                </div>
            </div>
        `).join('');
    } else {
        return materials.map(material => `
            <div class="knowledge-material-item" onclick="openKnowledgeMaterial(${material.id})">
                ${material.avatar_path || material.avatar_data ? `
                    <div class="material-avatar-small">
                        <img src="${material.avatar_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(material.avatar_data, 'image/jpeg') : (material.avatar_data.startsWith('data:') ? material.avatar_data : 'data:image/jpeg;base64,' + material.avatar_data)) : material.avatar_path}" 
                             alt="${material.title}" 
                             style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    </div>
                ` : `<div class="material-icon">${getMaterialIcon(material.material_type)}</div>`}
                <div class="material-info">
                    <h3>${material.title}</h3>
                    <p style="color: var(--text-muted);">${(material.content || '').replace(/<[^>]*>/g, '').substring(0, 150)}...</p>
                    <div class="material-meta">
                        <span class="material-type">${getMaterialTypeName(material.material_type)}</span>
                        ${material.file_size ? `<span class="file-size">${formatFileSize(material.file_size)}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// Вибір категорії
function selectKnowledgeCategory(categoryId) {
    currentCategoryId = categoryId;
    loadKnowledgeBase();
}

// Встановлення режиму перегляду
function setKnowledgeViewMode(mode) {
    knowledgeViewMode = mode;
    localStorage.setItem('knowledgeViewMode', mode);
    loadKnowledgeBase();
}

// Перевірка прав доступу
function checkKnowledgePermissions() {
    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    if (!currentUser) return;
    
    const addBtn = document.getElementById('addKnowledgeBtn');
    if (addBtn) {
        // Readit, Admin, SystemAdmin можуть додавати
        if (['Readit', 'Admin', 'SystemAdmin'].includes(currentUser.role)) {
            addBtn.style.display = 'inline-block';
        } else {
            addBtn.style.display = 'none';
        }
    }
}

// Модальне вікно додавання матеріалу
function showAddKnowledgeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addKnowledgeModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Додати матеріал до Бази знань</div>
                <button class="close-btn" onclick="closeModal('addKnowledgeModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addKnowledgeForm" onsubmit="handleAddKnowledge(event); return false;">
                    <div class="form-group">
                        <label>Категорія *</label>
                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                            <select id="knowledgeCategory" required style="flex: 1;">
                                <option value="">Виберіть категорію</option>
                                ${knowledgeCategories.map(cat => `
                                    <option value="${cat.id}">${cat.name}</option>
                                `).join('')}
                            </select>
                            <button type="button" class="btn-secondary" onclick="showAddCategoryModal()" style="white-space: nowrap;">
                                ➕ Створити
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Назва *</label>
                        <input type="text" id="knowledgeTitle" required>
                    </div>
                    <div class="form-group">
                        <label>Тип матеріалу *</label>
                        <select id="knowledgeType" required onchange="toggleKnowledgeFileInput()">
                            <option value="text">Текст</option>
                            <option value="pdf">PDF</option>
                            <option value="video">Відео</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Аватара (зображення)</label>
                        <div class="file-upload-area" onclick="document.getElementById('knowledgeAvatarInput').click()">
                            <p>Натисніть для вибору зображення</p>
                            <input type="file" id="knowledgeAvatarInput" style="display: none;" 
                                   accept="image/*" onchange="handleKnowledgeAvatarSelect(event)">
                            <div id="knowledgeAvatarPreview"></div>
                        </div>
                    </div>
                    <div class="form-group" id="knowledgeContentGroup">
                        <label>Контент</label>
                        <div id="knowledgeContentEditor" style="height: 300px; background: white;"></div>
                        <textarea id="knowledgeContent" style="display: none;"></textarea>
                    </div>
                    <div class="form-group" id="knowledgeFileGroup" style="display: none;">
                        <label>Файл *</label>
                        <div class="file-upload-area" onclick="document.getElementById('knowledgeFileInput').click()">
                            <p>Натисніть або перетягніть файл сюди</p>
                            <input type="file" id="knowledgeFileInput" style="display: none;" 
                                   accept=".pdf,.mp4,.avi,.mov" onchange="handleKnowledgeFileSelect(event)">
                            <div id="knowledgeFilePreview"></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Зберегти</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addKnowledgeModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addKnowledgeModal');
    };
    
    // Ініціалізація Quill editor для тексту
    if (typeof Quill !== 'undefined') {
        const editorElement = document.getElementById('knowledgeContentEditor');
        if (editorElement) {
            window.knowledgeQuillEditor = new Quill('#knowledgeContentEditor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'align': [] }],
                        ['link', 'image'],
                        ['clean']
                    ]
                }
            });
        }
    }
}

// Перемикання поля файлу
function toggleKnowledgeFileInput() {
    const type = document.getElementById('knowledgeType').value;
    const contentGroup = document.getElementById('knowledgeContentGroup');
    const fileGroup = document.getElementById('knowledgeFileGroup');
    
    if (type === 'text') {
        contentGroup.style.display = 'block';
        fileGroup.style.display = 'none';
        // Ініціалізація Quill editor, якщо ще не ініціалізовано
        if (typeof Quill !== 'undefined' && !window.knowledgeQuillEditor) {
            const editorElement = document.getElementById('knowledgeContentEditor');
            if (editorElement) {
                window.knowledgeQuillEditor = new Quill('#knowledgeContentEditor', {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'color': [] }, { 'background': [] }],
                            [{ 'align': [] }],
                            ['link', 'image'],
                            ['clean']
                        ]
                    }
                });
            }
        }
    } else {
        contentGroup.style.display = 'none';
        fileGroup.style.display = 'block';
    }
}

// Обробка вибору аватари
function handleKnowledgeAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Виберіть файл зображення', 'error');
        return;
    }
    
    const preview = document.getElementById('knowledgeAvatarPreview');
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

// Обробка вибору файлу
function handleKnowledgeFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('knowledgeFilePreview');
    preview.innerHTML = `
        <div class="file-preview">
            <strong>${file.name}</strong>
            <span>${formatFileSize(file.size)}</span>
        </div>
    `;
}

// Збереження матеріалу
async function handleAddKnowledge(event) {
    event.preventDefault();
    
    const categoryId = document.getElementById('knowledgeCategory').value;
    const title = document.getElementById('knowledgeTitle').value;
    const type = document.getElementById('knowledgeType').value;
    
    // Отримуємо контент з Quill editor, якщо він існує
    let content = '';
    if (type === 'text' && window.knowledgeQuillEditor) {
        content = window.knowledgeQuillEditor.root.innerHTML;
    } else {
        content = document.getElementById('knowledgeContent').value;
    }
    
    const fileInput = document.getElementById('knowledgeFileInput');
    const avatarInput = document.getElementById('knowledgeAvatarInput');
    
    try {
        let fileData = null;
        let fileSize = 0;
        let mimeType = '';
        
        if (type !== 'text' && fileInput.files[0]) {
            const file = fileInput.files[0];
            fileSize = file.size;
            mimeType = file.type;
            
            // Перевірка розміру файлу (для PDF та відео)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                showNotification(`Файл занадто великий (${(file.size / 1024 / 1024).toFixed(2)}MB). Максимальний розмір: 10MB`, 'error');
                return;
            }
            
            // Для локальної версії - зберігаємо як base64
            // Для серверної версії - завантажуємо на сервер
            if (USE_LOCAL_DB) {
                try {
                    fileData = await fileToBase64(file);
                } catch (error) {
                    if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
                        showNotification('Перевищено ліміт сховища. Для великих файлів використовуйте серверну версію або експортуйте БД.', 'error');
                        return;
                    }
                    throw error;
                }
            } else {
                // Завантаження на сервер
                fileData = await uploadFile(file);
            }
        }
        
        // Обробка аватари
        let avatarData = null;
        let avatarPath = null;
        if (avatarInput && avatarInput.files[0]) {
            const avatarFile = avatarInput.files[0];
            if (USE_LOCAL_DB) {
                avatarData = await fileToBase64(avatarFile);
            } else {
                avatarPath = await uploadFile(avatarFile);
            }
        }
        
        const materialData = {
            category_id: categoryId,
            title: title,
            content: type === 'text' ? content : '',
            material_type: type,
            file_path: fileData,
            file_size: fileSize,
            mime_type: mimeType,
            avatar_path: avatarPath,
            avatar_data: avatarData
        };
        
        const response = await api.createKnowledgeMaterial(materialData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addKnowledgeModal');
            showNotification('Матеріал додано', 'success');
            loadKnowledgeBase();
        }
    } catch (error) {
        console.error('Error adding material:', error);
        showNotification(error.message || 'Помилка додавання матеріалу', 'error');
    }
}

// Допоміжні функції
function getMaterialIcon(type) {
    const icons = {
        'text': '📄',
        'pdf': '📕',
        'video': '🎥'
    };
    return icons[type] || '📄';
}

function getMaterialTypeName(type) {
    const names = {
        'text': 'Текст',
        'pdf': 'PDF',
        'video': 'Відео'
    };
    return names[type] || type;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadFile(file) {
    if (USE_LOCAL_DB) {
        // Для локальної версії - конвертуємо в base64
        return await fileToBase64(file);
    }
    
    // Для серверної версії - завантаження на сервер
    const formData = new FormData();
    formData.append('file', file);
    
    const token = api.getToken();
    const response = await fetch(`${API_BASE_URL}/files/upload`, {
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

// Форматування тривалості відео
function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Відкриття відео практики
async function openPracticeVideo(videoId) {
    try {
        // Отримання відео
        const response = await api.getPracticeVideos();
        const data = await api.handleResponse(response);
        const video = data.data.find(v => v.id === videoId);
        
        if (!video) {
            showNotification('Відео не знайдено', 'error');
            return;
        }
        
        let videoUrl = null;
        
        // Визначаємо джерело відео
        if (video.video_data) {
            // Використовуємо допоміжну функцію для форматування
            if (typeof formatDataUrl === 'function') {
                videoUrl = formatDataUrl(video.video_data, 'video/mp4');
            } else {
                // Fallback
                if (video.video_data.startsWith('data:')) {
                    videoUrl = video.video_data;
                } else {
                    videoUrl = 'data:video/mp4;base64,' + video.video_data;
                }
            }
        } else if (video.video_path) {
            if (video.video_path.startsWith('data:') || video.video_path.startsWith('http') || video.video_path.startsWith('/')) {
                videoUrl = video.video_path;
            } else {
                // Відносний шлях
                videoUrl = USE_LOCAL_DB ? video.video_path : `${API_BASE_URL.replace('/api', '')}${video.video_path}`;
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
                    <div class="modal-title">${video.title}</div>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <video controls style="width: 100%; max-height: 70vh;">
                        <source src="${videoUrl}" type="video/mp4">
                        Ваш браузер не підтримує відео.
                    </video>
                    ${video.description ? `<p style="margin-top: 15px; color: var(--text-muted);">${video.description}</p>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        // Оновлення кількості переглядів
        if (typeof api.updateVideoViews === 'function') {
            api.updateVideoViews(videoId);
        }
    } catch (error) {
        console.error('Error opening practice video:', error);
        showNotification('Помилка відкриття відео', 'error');
    }
}

// Модальне вікно додавання відео практики
function showAddPracticeVideoModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addPracticeVideoModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Завантажити відео практики</div>
                <button class="close-btn" onclick="closeModal('addPracticeVideoModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addPracticeVideoForm" onsubmit="handleAddPracticeVideo(event); return false;">
                    <div class="form-group">
                        <label>Назва *</label>
                        <input type="text" id="practiceVideoTitle" required>
                    </div>
                    <div class="form-group">
                        <label>Опис</label>
                        <textarea id="practiceVideoDescription" rows="4"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Категорія</label>
                        <input type="text" id="practiceVideoCategory" placeholder="Наприклад: Тактика, Техніка">
                    </div>
                    <div class="form-group">
                        <label>Відео файл *</label>
                        <div class="file-upload-area" onclick="document.getElementById('practiceVideoFileInput').click()">
                            <p>Натисніть або перетягніть відео файл сюди</p>
                            <input type="file" id="practiceVideoFileInput" style="display: none;" 
                                   accept="video/*" onchange="handlePracticeVideoFileSelect(event)">
                            <div id="practiceVideoFilePreview"></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Завантажити</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addPracticeVideoModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addPracticeVideoModal');
    };
}

// Обробка вибору відео файлу
function handlePracticeVideoFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('practiceVideoFilePreview');
    preview.innerHTML = `
        <div class="file-preview">
            <strong>${file.name}</strong>
            <span>${formatFileSize(file.size)}</span>
        </div>
    `;
}

// Змінна для скасування завантаження
let videoUploadAbortController = null;

// Збереження відео практики
async function handleAddPracticeVideo(event) {
    event.preventDefault();
    
    const title = document.getElementById('practiceVideoTitle').value;
    const description = document.getElementById('practiceVideoDescription').value;
    const category = document.getElementById('practiceVideoCategory').value;
    const fileInput = document.getElementById('practiceVideoFileInput');
    
    if (!fileInput.files[0]) {
        showNotification('Виберіть відео файл', 'error');
        return;
    }
    
    // Отримуємо елементи форми
    const form = document.getElementById('addPracticeVideoForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const cancelBtn = form.querySelector('.btn-secondary');
    
    // Створюємо loader
    const loaderHtml = `
        <div id="videoUploadLoader" class="upload-loader">
            <div class="upload-progress">
                <div class="upload-progress-bar">
                    <div class="upload-progress-fill" id="uploadProgressFill"></div>
                </div>
                <div class="upload-progress-text" id="uploadProgressText">Підготовка до завантаження...</div>
            </div>
            <button type="button" class="btn-danger" onclick="cancelVideoUpload()">Скасувати завантаження</button>
        </div>
    `;
    
    // Додаємо loader перед формою
    const formActions = form.querySelector('.form-actions');
    formActions.insertAdjacentHTML('beforebegin', loaderHtml);
    formActions.style.display = 'none';
    
    // Блокуємо форму
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    
    try {
        const file = fileInput.files[0];
        let videoPath = '';
        
        // Створюємо AbortController для скасування
        videoUploadAbortController = new AbortController();
        
        // Оновлюємо прогрес
        const progressFill = document.getElementById('uploadProgressFill');
        const progressText = document.getElementById('uploadProgressText');
        
        if (USE_LOCAL_DB) {
            // Для локальної версії - base64 з прогресом
            progressText.textContent = 'Конвертація відео в base64...';
            videoPath = await fileToBase64WithProgress(file, (progress) => {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Конвертація: ${Math.round(progress)}%`;
            }, videoUploadAbortController.signal);
        } else {
            // Для серверної версії - завантаження на сервер з прогресом
            progressText.textContent = 'Завантаження на сервер...';
            videoPath = await uploadFileWithProgress(file, (progress) => {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Завантаження: ${Math.round(progress)}%`;
            }, videoUploadAbortController.signal);
        }
        
        // Перевірка на скасування
        if (videoUploadAbortController.signal.aborted) {
            return;
        }
        
        progressText.textContent = 'Збереження інформації...';
        progressFill.style.width = '90%';
        
        const videoInfo = {
            title: title,
            description: description,
            category: category,
            video_path: videoPath,
            video_data: USE_LOCAL_DB ? videoPath : null,
            duration: 0,
            mime_type: file.type
        };
        
        const response = await api.createPracticeVideo(videoInfo);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            progressFill.style.width = '100%';
            progressText.textContent = 'Завантаження завершено!';
            
            setTimeout(() => {
                closeModal('addPracticeVideoModal');
                showNotification('Відео завантажено успішно', 'success');
                loadPracticeContent();
            }, 500);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            showNotification('Завантаження скасовано', 'info');
        } else {
            console.error('Error adding practice video:', error);
            showNotification(error.message || 'Помилка завантаження відео', 'error');
        }
        
        // Відновлюємо форму
        const loader = document.getElementById('videoUploadLoader');
        if (loader) loader.remove();
        formActions.style.display = 'flex';
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
    } finally {
        videoUploadAbortController = null;
    }
}

// Скасування завантаження
function cancelVideoUpload() {
    if (videoUploadAbortController) {
        videoUploadAbortController.abort();
    }
}

// Конвертація файлу в base64 з прогресом
async function fileToBase64WithProgress(file, onProgress, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        
        const reader = new FileReader();
        const chunkSize = 1024 * 1024; // 1MB chunks
        let offset = 0;
        const totalSize = file.size;
        let base64Parts = [];
        
        reader.onload = (e) => {
            if (signal.aborted) {
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            
            const chunk = e.target.result;
            base64Parts.push(chunk.split(',')[1]); // Видаляємо data:type;base64,
            
            offset += chunkSize;
            const progress = Math.min((offset / totalSize) * 100, 99);
            onProgress(progress);
            
            if (offset < totalSize) {
                const slice = file.slice(offset, offset + chunkSize);
                reader.readAsDataURL(slice);
            } else {
                const base64 = 'data:' + file.type + ';base64,' + base64Parts.join('');
                resolve(base64);
            }
        };
        
        reader.onerror = () => reject(new Error('Помилка читання файлу'));
        
        const firstSlice = file.slice(0, Math.min(chunkSize, totalSize));
        reader.readAsDataURL(firstSlice);
    });
}

// Завантаження файлу на сервер з прогресом
async function uploadFileWithProgress(file, onProgress, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                onProgress(progress);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.file_path);
                } catch (e) {
                    reject(new Error('Помилка парсингу відповіді'));
                }
            } else {
                reject(new Error('Помилка завантаження: ' + xhr.statusText));
            }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Помилка мережі')));
        xhr.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        
        if (signal) {
            signal.addEventListener('abort', () => xhr.abort());
        }
        
        const token = api.getToken();
        xhr.open('POST', `${API_BASE_URL}/files/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
}

// Модальне вікно створення категорії
function showAddCategoryModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addCategoryModal';
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Створити категорію</div>
                <button class="close-btn" onclick="closeModal('addCategoryModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addCategoryForm" onsubmit="handleAddCategory(event); return false;">
                    <div class="form-group">
                        <label>Назва категорії *</label>
                        <input type="text" id="categoryName" required placeholder="Введіть назву категорії">
                    </div>
                    <div class="form-group">
                        <label>Опис (опціонально)</label>
                        <textarea id="categoryDescription" rows="3" placeholder="Введіть опис категорії"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Батьківська категорія (опціонально)</label>
                        <select id="categoryParent">
                            <option value="">Немає (основна категорія)</option>
                            ${knowledgeCategories.map(cat => `
                                <option value="${cat.id}">${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Створити</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addCategoryModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addCategoryModal');
    };
}

// Збереження категорії
async function handleAddCategory(event) {
    event.preventDefault();
    
    const name = document.getElementById('categoryName').value;
    const description = document.getElementById('categoryDescription').value;
    const parentId = document.getElementById('categoryParent').value || null;
    
    try {
        const categoryData = {
            name: name,
            description: description,
            parent_id: parentId
        };
        
        const response = await api.createKnowledgeCategory(categoryData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addCategoryModal');
            showNotification('Категорію створено', 'success');
            // Оновлюємо список категорій
            await loadKnowledgeBase();
            // Оновлюємо вибір категорії в модальному вікні додавання матеріалу
            const categorySelect = document.getElementById('knowledgeCategory');
            if (categorySelect) {
                const newOption = document.createElement('option');
                newOption.value = data.data.id;
                newOption.textContent = data.data.name;
                categorySelect.appendChild(newOption);
                categorySelect.value = data.data.id;
            }
        }
    } catch (error) {
        console.error('Error creating category:', error);
        showNotification(error.message || 'Помилка створення категорії', 'error');
    }
}

// Відкриття матеріалу для перегляду
async function openKnowledgeMaterial(materialId) {
    try {
        // Отримання матеріалу
        const response = await api.getKnowledgeMaterials();
        const data = await api.handleResponse(response);
        const material = data.data.find(m => m.id === materialId);
        
        if (!material) {
            showNotification('Матеріал не знайдено', 'error');
            return;
        }
        
        // Відкриття залежно від типу
        if (material.material_type === 'pdf') {
            await openKnowledgePDFMaterial(material);
        } else if (material.material_type === 'video') {
            openKnowledgeVideoMaterial(material);
        } else {
            openKnowledgeTextMaterial(material);
        }
    } catch (error) {
        console.error('Error opening material:', error);
        showNotification('Помилка відкриття матеріалу', 'error');
    }
}

// Відкриття текстового матеріалу
function openKnowledgeTextMaterial(material) {
    if (!material) {
        showNotification('Матеріал не знайдено', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'knowledgeTextModal';
    
    // Перевірка та форматування контенту
    let content = material.content || '';
    if (!content || content.trim() === '') {
        content = '<p class="empty-state">Контент відсутній</p>';
    }
    
    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    const canEdit = currentUser && ['Readit', 'Admin', 'SystemAdmin'].includes(currentUser.role);
    
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${material.title || 'Матеріал'}</div>
                <div style="display: flex; gap: 10px;">
                    ${canEdit ? `<button class="btn-secondary btn-small" onclick="editKnowledgeMaterial(${material.id})">✏️ Редагувати</button>` : ''}
                    <button class="close-btn" onclick="closeModal('knowledgeTextModal')">✕</button>
                </div>
            </div>
            <div class="modal-body">
                <div class="knowledge-text-content" id="knowledgeTextContent" style="background: var(--bg-card); padding: 20px; border-radius: 8px; color: var(--text-light);">
                    ${content}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('knowledgeTextModal');
    };
}

// Редагування текстового матеріалу
async function editKnowledgeMaterial(materialId) {
    try {
        const response = await api.getKnowledgeMaterials();
        const data = await api.handleResponse(response);
        const material = data.data.find(m => m.id === materialId);
        
        if (!material || material.material_type !== 'text') {
            showNotification('Матеріал не знайдено або не є текстовим', 'error');
            return;
        }
        
        closeModal('knowledgeTextModal');
        
        // Створюємо модальне вікно для редагування
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'editKnowledgeModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Редагувати матеріал: ${material.title}</div>
                    <button class="close-btn" onclick="closeModal('editKnowledgeModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="editKnowledgeForm" onsubmit="handleEditKnowledge(event, ${materialId}); return false;">
                        <div class="form-group">
                            <label>Назва *</label>
                            <input type="text" id="editKnowledgeTitle" required value="${material.title || ''}">
                        </div>
                        <div class="form-group">
                            <label>Контент</label>
                            <div id="editKnowledgeContentEditor" style="height: 400px; background: white;"></div>
                            <textarea id="editKnowledgeContent" style="display: none;">${material.content || ''}</textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">Зберегти</button>
                            <button type="button" class="btn-secondary" onclick="closeModal('editKnowledgeModal')">Скасувати</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('editKnowledgeModal');
        };
        
        // Ініціалізація Quill editor
        if (typeof Quill !== 'undefined') {
            window.editKnowledgeQuillEditor = new Quill('#editKnowledgeContentEditor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'align': [] }],
                        ['link', 'image'],
                        ['clean']
                    ]
                }
            });
            
            // Завантажуємо існуючий контент
            if (material.content) {
                window.editKnowledgeQuillEditor.root.innerHTML = material.content;
            }
        }
    } catch (error) {
        console.error('Error loading material for edit:', error);
        showNotification('Помилка завантаження матеріалу', 'error');
    }
}

// Збереження відредагованого матеріалу
async function handleEditKnowledge(event, materialId) {
    event.preventDefault();
    
    try {
        const title = document.getElementById('editKnowledgeTitle').value;
        let content = '';
        
        if (window.editKnowledgeQuillEditor) {
            content = window.editKnowledgeQuillEditor.root.innerHTML;
        } else {
            content = document.getElementById('editKnowledgeContent').value;
        }
        
        const materialData = {
            title: title,
            content: content
        };
        
        const response = await api.updateKnowledgeMaterial(materialId, materialData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('editKnowledgeModal');
            showNotification('Матеріал оновлено', 'success');
            loadKnowledgeBase();
        }
    } catch (error) {
        console.error('Error updating material:', error);
        showNotification(error.message || 'Помилка оновлення матеріалу', 'error');
    }
}

// Відкриття PDF матеріалу
async function openKnowledgePDFMaterial(material) {
    try {
        let pdfUrl = null;
        
        // Якщо файл в БД як base64
        if (material.file_data) {
            // Використовуємо допоміжну функцію для форматування
            if (typeof formatDataUrl === 'function') {
                pdfUrl = formatDataUrl(material.file_data, 'application/pdf');
            } else {
                // Fallback
                if (material.file_data.startsWith('data:')) {
                    pdfUrl = material.file_data;
                } else {
                    pdfUrl = 'data:application/pdf;base64,' + material.file_data;
                }
            }
        } else if (material.file_path) {
            if (material.file_path.startsWith('data:') || material.file_path.startsWith('http') || material.file_path.startsWith('/')) {
                pdfUrl = material.file_path;
            } else {
                // Відносний шлях
                const USE_LOCAL_DB = typeof api !== 'undefined' && api.USE_LOCAL_DB;
                if (USE_LOCAL_DB) {
                    // Для локальної БД, якщо file_path це base64
                    if (material.file_path.startsWith('data:')) {
                        pdfUrl = material.file_path;
                    } else {
                        pdfUrl = material.file_path;
                    }
                } else {
                    // Беремо базовий URL з scripts/api.js (або fallback)
                    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3000/api';
                    pdfUrl = `${baseUrl.replace('/api', '')}${material.file_path}`;
                }
            }
        }
        
        if (!pdfUrl) {
            showNotification('PDF файл не знайдено', 'error');
            return;
        }
        
        // Використовуємо PDF.js якщо доступний
        if (typeof openPDFViewer === 'function') {
            await openPDFViewer(pdfUrl, material.title);
        } else {
            // Fallback до iframe
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.id = 'pdfModal';
            modal.innerHTML = `
                <div class="modal-content large-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <div class="modal-title">${material.title}</div>
                        <button class="close-btn" onclick="closeModal('pdfModal')">✕</button>
                    </div>
                    <div class="modal-body">
                        <iframe src="${pdfUrl}" style="width: 100%; height: 70vh; border: none;"></iframe>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.onclick = (e) => {
                if (e.target === modal) closeModal('pdfModal');
            };
        }
    } catch (error) {
        console.error('Error opening PDF:', error);
        showNotification('Помилка відкриття PDF: ' + error.message, 'error');
    }
}

// Відкриття відео матеріалу
function openKnowledgeVideoMaterial(material) {
    if (!material) {
        showNotification('Матеріал не знайдено', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'knowledgeVideoModal';
    
    let videoUrl = null;
    
    // Визначаємо джерело відео
    if (material.file_data) {
        // Використовуємо допоміжну функцію для форматування
        if (typeof formatDataUrl === 'function') {
            videoUrl = formatDataUrl(material.file_data, material.mime_type || 'video/mp4');
        } else {
            // Fallback
            if (material.file_data.startsWith('data:')) {
                videoUrl = material.file_data;
            } else {
                videoUrl = 'data:video/mp4;base64,' + material.file_data;
            }
        }
    } else if (material.file_path) {
        if (material.file_path.startsWith('data:') || material.file_path.startsWith('http') || material.file_path.startsWith('/')) {
            videoUrl = material.file_path;
        } else {
            // Відносний шлях
            const USE_LOCAL_DB = typeof api !== 'undefined' && api.USE_LOCAL_DB;
            // Беремо базовий URL з scripts/api.js (або fallback)
            const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3000/api';
            videoUrl = USE_LOCAL_DB ? material.file_path : `${baseUrl.replace('/api', '')}${material.file_path}`;
        }
    }
    
    if (!videoUrl) {
        showNotification('Відео файл не знайдено', 'error');
        return;
    }
    
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${material.title || 'Відео'}</div>
                <button class="close-btn" onclick="closeModal('knowledgeVideoModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="knowledge-video-content">
                    <video controls preload="metadata" style="width: 100%; max-height: 80vh;">
                        <source src="${videoUrl}" type="${material.mime_type || 'video/mp4'}">
                        Ваш браузер не підтримує відео.
                    </video>
                    <div class="video-loading" style="display: none; text-align: center; padding: 20px;">
                        Завантаження відео...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обробка помилок завантаження відео
    const video = modal.querySelector('video');
    if (video) {
        video.addEventListener('error', (e) => {
            console.error('Video loading error:', e);
            const loadingDiv = modal.querySelector('.video-loading');
            if (loadingDiv) {
                loadingDiv.style.display = 'block';
                loadingDiv.innerHTML = '<p class="error">Помилка завантаження відео. Перевірте формат файлу.</p>';
            }
            showNotification('Помилка завантаження відео', 'error');
        });
        
        video.addEventListener('loadstart', () => {
            const loadingDiv = modal.querySelector('.video-loading');
            if (loadingDiv) loadingDiv.style.display = 'block';
        });
        
        video.addEventListener('canplay', () => {
            const loadingDiv = modal.querySelector('.video-loading');
            if (loadingDiv) loadingDiv.style.display = 'none';
        });
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('knowledgeVideoModal');
    };
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.loadKnowledgeBase = loadKnowledgeBase;
    window.showKnowledgeTab = showKnowledgeTab;
    window.loadPracticeContent = loadPracticeContent;
    window.renderPracticeVideos = renderPracticeVideos;
    window.renderKnowledgeBase = renderKnowledgeBase;
    window.renderMaterials = renderMaterials;
    window.selectKnowledgeCategory = selectKnowledgeCategory;
    window.setKnowledgeViewMode = setKnowledgeViewMode;
    window.checkKnowledgePermissions = checkKnowledgePermissions;
    window.showAddKnowledgeModal = showAddKnowledgeModal;
    window.toggleKnowledgeFileInput = toggleKnowledgeFileInput;
    window.handleKnowledgeFileSelect = handleKnowledgeFileSelect;
    window.handleAddKnowledge = handleAddKnowledge;
    window.showAddCategoryModal = showAddCategoryModal;
    window.handleAddCategory = handleAddCategory;
    window.openKnowledgeMaterial = openKnowledgeMaterial;
    window.openKnowledgeTextMaterial = openKnowledgeTextMaterial;
    window.openKnowledgePDFMaterial = openKnowledgePDFMaterial;
    window.openKnowledgeVideoMaterial = openKnowledgeVideoMaterial;
    window.openPracticeVideo = openPracticeVideo;
    window.showAddPracticeVideoModal = showAddPracticeVideoModal;
    window.handlePracticeVideoFileSelect = handlePracticeVideoFileSelect;
    window.handleAddPracticeVideo = handleAddPracticeVideo;
    window.cancelVideoUpload = cancelVideoUpload;
    window.getMaterialIcon = getMaterialIcon;
    window.getMaterialTypeName = getMaterialTypeName;
    window.formatFileSize = formatFileSize;
    window.formatDuration = formatDuration;
    // formatDataUrl експортується в main.js
    // closeModal та showNotification експортуються в auth.js
}


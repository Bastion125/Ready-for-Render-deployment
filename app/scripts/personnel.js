// Управління особовим складом
// Нова версія - простий список з пошуком

let personnelViewMode = 'list';

// Функція для екранування HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Отримання поточного користувача
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
 * Завантаження списку особового складу
 * @async
 */
async function loadPersonnel() {
    console.log('loadPersonnel called');
    const grid = typeof getCachedElement === 'function' 
        ? getCachedElement('personnelGrid') 
        : document.getElementById('personnelGrid');
    if (!grid) {
        console.error('personnelGrid element not found in DOM');
        return;
    }
    
    // Ініціалізувати форму якщо ще не ініціалізована
    initPersonnelForm();
    
    console.log('personnelGrid found, loading...');
    // Показуємо skeleton loading
    grid.innerHTML = `
        <div class="skeleton-loading">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;
    
    const currentUser = getCurrentUser();
    console.log('Current user:', currentUser);
    
    // Якщо користувач не знайдений, спробуємо отримати з API
    if (!currentUser) {
        try {
            const profileResponse = await api.getProfile();
            const profileData = await api.handleResponse(profileResponse);
            if (profileData.user) {
                window.currentUser = profileData.user;
                console.log('User loaded from API:', window.currentUser);
            }
        } catch (e) {
            console.warn('Could not get current user:', e);
        }
    }
    
    const user = getCurrentUser();
    if (!user) {
        grid.innerHTML = '<div class="empty-state">Користувач не авторизований</div>';
        return;
    }

    // User бачить тільки себе
    if (user.role === 'User') {
        console.log('User role is User, loading personal card');
        await loadUserPersonnel();
        return;
    }

    // Readit, Admin, SystemAdmin бачать всіх
    console.log('Loading all personnel for role:', user.role);
    try {
        const response = await api.getPersonnel();
        const data = await api.handleResponse(response);
        const personnelList = data.data || [];
        console.log('Loaded personnel:', personnelList.length, personnelList);
        if (personnelList.length === 0) {
            grid.innerHTML = '<div class="empty-state">Особовий склад відсутній. Заповніть форму вище для додавання особового складу.</div>';
        } else {
            await renderPersonnel(personnelList);
        }
    } catch (error) {
        console.error('Error loading personnel:', error);
        grid.innerHTML = `<div class="error">Помилка завантаження особового складу: ${error.message || 'невідома помилка'}</div>`;
        if (typeof showNotification === 'function') {
            showNotification('Помилка завантаження особового складу', 'error');
        }
    }
}

// Завантаження персональної картки користувача
async function loadUserPersonnel() {
    try {
        const grid = typeof getCachedElement === 'function' 
            ? getCachedElement('personnelGrid') 
            : document.getElementById('personnelGrid');
        if (!grid) {
            console.error('personnelGrid not found');
            return;
        }
        
        const response = await api.getProfile();
        const data = await api.handleResponse(response);
        
        if (data.user.personnel) {
            await renderPersonnel([data.user.personnel]);
        } else {
            grid.innerHTML = '<div class="empty-state">Персональна картка не знайдена</div>';
        }
    } catch (error) {
        console.error('Error loading user personnel:', error);
    }
}

/**
 * Відображення особового складу
 * @param {Array} personnel - Масив особового складу
 * @async
 */
async function renderPersonnel(personnel) {
    console.log('renderPersonnel called with:', personnel);
    const grid = typeof getCachedElement === 'function' 
        ? getCachedElement('personnelGrid') 
        : document.getElementById('personnelGrid');
    if (!grid) {
        console.error('personnelGrid element not found in renderPersonnel');
        return;
    }

    if (!personnel || !Array.isArray(personnel)) {
        console.error('Invalid personnel data:', personnel);
        grid.innerHTML = '<div class="empty-state">Помилка: некоректні дані особового складу</div>';
        return;
    }

    console.log('Rendering personnel:', personnel.length, 'items', personnel);

    // Зберігаємо оригінальний список для фільтрації
    window.allPersonnel = personnel;

    if (personnel.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">Особовий склад відсутній. Заповніть форму вище або натисніть "Створити картку" для додавання особового складу.</div>';
        return;
    }

    // Отримуємо режим перегляду з localStorage
    const viewMode = localStorage.getItem('personnelViewMode') || 'grid';
    personnelViewMode = viewMode;

    // Завантажуємо екіпажі та засоби для відображення на картках
    let crewsData = [];
    let equipmentData = [];
    
    try {
        const crewsResponse = await api.getCrews();
        const crewsResult = await api.handleResponse(crewsResponse);
        crewsData = crewsResult.data || [];
    } catch (e) {
        console.warn('Could not load crews:', e);
    }

    try {
        const equipmentResponse = await api.getEquipment();
        const equipmentResult = await api.handleResponse(equipmentResponse);
        equipmentData = equipmentResult.data || [];
    } catch (e) {
        console.warn('Could not load equipment:', e);
    }

    // Рендеримо в залежності від режиму перегляду
    try {
        console.log('Rendering personnel with view mode:', viewMode);
        
        let contentHtml = '';
        
        if (viewMode === 'table' || viewMode === 'list') {
            // Табличний вигляд
            contentHtml = renderPersonnelList(personnel);
        } else {
            // Вигляд картками
            const cardsHtml = await renderPersonnelGrid(personnel, crewsData, equipmentData);
            contentHtml = cardsHtml;
        }
        
        // Додаємо перемикач режимів перегляду
        const viewToggle = `
            <div class="view-toggle" style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center;">
                <span style="color: var(--text-muted); margin-right: 10px;">Вигляд:</span>
                <button class="toggle-btn ${viewMode === 'table' || viewMode === 'list' ? 'active' : ''}"
                        data-view="table" onclick="setPersonnelViewMode('table')" style="padding: 8px 16px; background: ${viewMode === 'table' || viewMode === 'list' ? 'var(--primary)' : 'rgba(0, 0, 0, 0.5)'}; color: ${viewMode === 'table' || viewMode === 'list' ? 'white' : 'var(--text-light)'}; border: 2px solid var(--primary); border-radius: 6px; cursor: pointer;">
                    📋 Таблиця
                </button>
                <button class="toggle-btn ${viewMode === 'grid' ? 'active' : ''}"
                        data-view="grid" onclick="setPersonnelViewMode('grid')" style="padding: 8px 16px; background: ${viewMode === 'grid' ? 'var(--primary)' : 'rgba(0, 0, 0, 0.5)'}; color: ${viewMode === 'grid' ? 'white' : 'var(--text-light)'}; border: 2px solid var(--primary); border-radius: 6px; cursor: pointer;">
                    🟦 Картки
                </button>
            </div>
        `;
        
        // Використовуємо DocumentFragment для оптимізації
        const fullHtml = viewToggle + '<div class="personnel-content-wrapper">' + contentHtml + '</div>';
        if (typeof createFragmentFromHTML === 'function') {
            const fragment = createFragmentFromHTML(fullHtml);
            grid.innerHTML = '';
            grid.appendChild(fragment);
        } else {
            grid.innerHTML = fullHtml;
        }
        console.log('Personnel rendered successfully');
    } catch (error) {
        console.error('Error rendering personnel:', error);
        console.error('Error stack:', error.stack);
        grid.innerHTML = `<div class="empty-state">Помилка відображення: ${error.message || 'невідома помилка'}</div>`;
    }
}

// Відображення таблицею
function renderPersonnelList(personnel) {
    if (!personnel || personnel.length === 0) {
        return '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">Особовий склад відсутній</div>';
    }
    
    return `
        <div style="overflow-x: auto; width: 100%; max-width: 100%; box-sizing: border-box;">
            <table class="personnel-table" style="width: 100%; border-collapse: collapse; background: var(--bg-card); border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: rgba(230, 168, 87, 0.15);">
                        <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">ПІБ</th>
                        <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Посада</th>
                        <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Звання</th>
                        <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Підрозділ</th>
                        <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">ШПК</th>
                        <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Телефон</th>
                        <th style="padding: 15px; text-align: center; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Допуск БЗ</th>
                        <th style="padding: 15px; text-align: center; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${personnel.map(p => `
                        <tr onclick="openPersonnelCard(${p.id})" style="cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s;" 
                            onmouseover="this.style.background='rgba(230, 168, 87, 0.1)'" 
                            onmouseout="this.style.background='transparent'">
                            <td style="padding: 15px; color: var(--text-light); font-weight: 600;">${escapeHtml(p.full_name || 'Не вказано')}</td>
                            <td style="padding: 15px; color: var(--text-light);">${escapeHtml(p.position || 'Не вказано')}</td>
                            <td style="padding: 15px; color: var(--text-light);">${escapeHtml(p.rank || 'Не вказано')}</td>
                            <td style="padding: 15px; color: var(--text-light);">${escapeHtml(p.unit_name || 'Не вказано')}</td>
                            <td style="padding: 15px; color: var(--text-light);">${escapeHtml(p.shpk || 'Не вказано')}</td>
                            <td style="padding: 15px; color: var(--text-light);">${escapeHtml(p.phone || 'Не вказано')}</td>
                            <td style="padding: 15px; text-align: center;">
                                <span class="status-badge ${p.combat_zone_access ? 'status-allowed' : 'status-not-allowed'}" style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                    ${p.combat_zone_access ? 'Так' : 'Ні'}
                                </span>
                            </td>
                            <td style="padding: 15px; text-align: center;">
                                <button class="btn-primary btn-small" onclick="event.stopPropagation(); openPersonnelCard(${p.id})" style="padding: 6px 12px; font-size: 12px;">Переглянути</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Відображення плиткою з екіпажами та засобами
 * @param {Array} personnel - Масив особового складу
 * @param {Array} crewsData - Масив екіпажів
 * @param {Array} equipmentData - Масив засобів
 * @returns {Promise<string>} HTML рядок з картками
 * @async
 */
async function renderPersonnelGrid(personnel, crewsData, equipmentData) {
    console.log('renderPersonnelGrid called with:', {
        personnelCount: personnel ? personnel.length : 0,
        crewsCount: crewsData ? crewsData.length : 0,
        equipmentCount: equipmentData ? equipmentData.length : 0
    });
    
    if (!personnel || personnel.length === 0) {
        return '<div class="empty-state">Особовий склад відсутній</div>';
    }
    
    // Створюємо мапу екіпажів для швидкого пошуку
    const crewsMap = new Map();
    crewsData.forEach(crew => {
        if (crew.members && Array.isArray(crew.members)) {
            crew.members.forEach(member => {
                if (!crewsMap.has(member.personnel_id)) {
                    crewsMap.set(member.personnel_id, []);
                }
                crewsMap.get(member.personnel_id).push({
                    crewId: crew.id,
                    crewName: crew.name,
                    crewUavType: crew.uav_type,
                    role: member.role
                });
            });
        }
    });

    // Створюємо мапу засобів для пошуку зображень
    const equipmentMap = new Map();
    equipmentData.forEach(eq => {
        // Перевіряємо різні можливі поля для типу та зображення
        const eqType = eq.type || eq.type_name || eq.type_uav || '';
        const eqImage = eq.image_data || eq.photo_data || eq.avatar_data || '';
        
        if (eqType && eqImage) {
            equipmentMap.set(eqType.toLowerCase(), eqImage);
        }
    });

    const cardsHtml = personnel.map((p, index) => {
        const fullName = p.full_name || 'Не вказано';
        const rank = p.rank || '';
        const position = p.position || 'Не вказано';
        const unitName = p.unit_name || '';
        const phone = p.phone || '';
        const combatZoneAccess = p.combat_zone_access || false;
        const combatZone = combatZoneAccess ? 'Так' : 'Ні';
        
        // Отримуємо екіпажі для цього персоналу
        const personnelCrews = crewsMap.get(p.id) || [];
        
        // Шукаємо аватар з засобів через тип БПЛА з екіпажів
        let avatarUrl = '';
        if (personnelCrews.length > 0) {
            const firstCrew = personnelCrews[0];
            if (firstCrew.crewUavType) {
                const uavType = firstCrew.crewUavType.toLowerCase();
                avatarUrl = equipmentMap.get(uavType) || '';
            }
        }

        return `
            <div class="personnel-card" onclick="openPersonnelCard(${p.id})" style="animation-delay: ${index * 0.1}s; cursor: pointer;">
                <div class="personnel-card-header">
                    <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
                        ${avatarUrl ? `
                            <div class="personnel-avatar" style="overflow: hidden; flex-shrink: 0;">
                                <img src="${escapeHtml(avatarUrl)}" alt="Аватар" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
        </div>
                        ` : `
                            <div class="personnel-avatar" style="flex-shrink: 0;">
                                ${getInitials(fullName)}
                            </div>
                        `}
                        <div style="flex: 1; min-width: 0;">
                            <div class="personnel-name">${escapeHtml(fullName)}</div>
                            <div class="personnel-rank">${escapeHtml(rank)}</div>
                            ${unitName ? `
                                <div style="margin-top: 6px; background: rgba(230, 168, 87, 0.2); color: var(--primary); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid var(--primary); display: inline-block;">
                                    ${escapeHtml(unitName)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="personnel-info">
                    <div class="info-row">
                        <span class="info-label">Посада:</span>
                        <span class="info-value">${escapeHtml(position)}</span>
                    </div>
                    ${phone ? `
                        <div class="info-row">
                            <span class="info-label">Телефон:</span>
                            <span class="info-value">${escapeHtml(phone)}</span>
                        </div>
                    ` : ''}
                    <div class="info-row">
                        <span class="info-label">Допуск БЗ:</span>
                        <span class="status-badge ${combatZoneAccess ? 'status-allowed' : 'status-not-allowed'}">${combatZone}</span>
                    </div>
                    ${personnelCrews.length > 0 ? `
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(230, 168, 87, 0.2);">
                            <div style="font-size: 11px; color: var(--primary-dark); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Екіпажі:</div>
                            ${personnelCrews.map(crew => `
                                <div style="background: rgba(230, 168, 87, 0.1); padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; font-size: 12px; border-left: 2px solid var(--primary);">
                                    <strong style="color: var(--primary);">${escapeHtml(crew.crewName)}</strong>
                                    ${crew.crewUavType ? `<span style="color: var(--primary-dark); margin-left: 6px;">- ${escapeHtml(crew.crewUavType)}</span>` : ''}
                                    ${crew.role ? `<span style="color: var(--text-light); margin-left: 6px; font-size: 11px;">(${escapeHtml(crew.role)})</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    console.log('renderPersonnelGrid completed, returning HTML, length:', cardsHtml.length);
    return cardsHtml;
}

// Встановлення режиму перегляду
function setPersonnelViewMode(mode) {
    personnelViewMode = mode;
    localStorage.setItem('personnelViewMode', mode);
    // Перерендеримо особовий склад з новим режимом
    if (window.allPersonnel && Array.isArray(window.allPersonnel)) {
        renderPersonnel(window.allPersonnel);
    } else {
    filterPersonnel();
    }
}

/**
 * Фільтрація особового складу (внутрішня функція)
 * @async
 * @private
 */
async function filterPersonnelInternal() {
    const getElement = typeof getCachedElement === 'function' 
        ? getCachedElement 
        : document.getElementById.bind(document);
    const searchInput = getElement('personnelSearch');
    const grid = getElement('personnelGrid');
    if (!searchInput || !grid || !window.allPersonnel) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filtered = searchTerm 
        ? window.allPersonnel.filter(p => {
            const fullName = (p.full_name || '').toLowerCase();
            const position = (p.position || '').toLowerCase();
            const rank = (p.rank || '').toLowerCase();
            const unit = (p.unit_name || '').toLowerCase();
            const shpk = (p.shpk || '').toLowerCase();
            return fullName.includes(searchTerm) || 
                   position.includes(searchTerm) || 
                   rank.includes(searchTerm) ||
                   unit.includes(searchTerm) ||
                   shpk.includes(searchTerm);
        })
        : window.allPersonnel;
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state">Нічого не знайдено</div>';
    } else {
        // Завантажуємо екіпажі та засоби для фільтрованих результатів
        let crewsData = [];
        let equipmentData = [];
        
        try {
            const crewsResponse = await api.getCrews();
            const crewsResult = await api.handleResponse(crewsResponse);
            crewsData = crewsResult.data || [];
        } catch (e) {
            console.warn('Could not load crews:', e);
        }

        try {
            const equipmentResponse = await api.getEquipment();
            const equipmentResult = await api.handleResponse(equipmentResponse);
            equipmentData = equipmentResult.data || [];
        } catch (e) {
            console.warn('Could not load equipment:', e);
        }

        const cardsHtml = await renderPersonnelGrid(filtered, crewsData, equipmentData);
        // Використовуємо DocumentFragment для оптимізації
        if (typeof createFragmentFromHTML === 'function') {
            const fragment = createFragmentFromHTML(cardsHtml);
            grid.innerHTML = '';
            grid.appendChild(fragment);
        } else {
            grid.innerHTML = cardsHtml;
        }
    }
}

/**
 * Дебаунсована версія фільтрації для пошуку
 * @type {Function}
 */
const filterPersonnel = typeof debounce === 'function' 
    ? debounce(filterPersonnelInternal, 300)
    : filterPersonnelInternal;

/**
 * Отримання ініціалів з ПІБ
 * @param {string} fullName - Повне ім'я
 * @returns {string} Ініціали
 */
function getInitials(fullName) {
    if (!fullName) return '??';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
}

// Відкриття картки особового складу
async function openPersonnelCard(personnelId) {
    try {
        const response = await api.getPersonnel();
        const data = await api.handleResponse(response);
        const personnel = (data.data || []).find(p => p.id === personnelId);
        
        if (!personnel) {
            showNotification('Особовий склад не знайдено', 'error');
            return;
        }
        
        // Отримуємо екіпажі для цього персоналу
        let crews = [];
        try {
            const crewsResponse = await api.getCrews();
            const crewsData = await api.handleResponse(crewsResponse);
            if (crewsData.data) {
                crews = crewsData.data.filter(crew => 
                    crew.members && crew.members.some(m => m.personnel_id === personnelId)
                );
            }
        } catch (e) {
            console.warn('Could not load crews:', e);
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'personnelCardModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Картка особового складу: ${personnel.full_name}</div>
                    <button class="close-btn" onclick="closeModal('personnelCardModal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="personnel-card-details">
                        <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px;">
                            <div class="info-item">
                                <label style="color: var(--text-muted); font-size: 14px;">ПІБ:</label>
                                <span style="color: var(--text-light); font-size: 16px; font-weight: bold;">${personnel.full_name}</span>
                            </div>
                            <div class="info-item">
                                <label style="color: var(--text-muted); font-size: 14px;">Посада:</label>
                                <span style="color: var(--text-light); font-size: 16px;">${personnel.position || 'Не вказано'}</span>
                            </div>
                            <div class="info-item">
                                <label style="color: var(--text-muted); font-size: 14px;">Звання:</label>
                                <span style="color: var(--text-light); font-size: 16px;">${personnel.rank || 'Не вказано'}</span>
                            </div>
                            ${personnel.shpk ? `
                                <div class="info-item">
                                    <label style="color: var(--text-muted); font-size: 14px;">Особовий номер (ШПК):</label>
                                    <span style="color: var(--text-light); font-size: 16px;">${personnel.shpk}</span>
                                </div>
                            ` : ''}
                            ${personnel.phone ? `
                                <div class="info-item">
                                    <label style="color: var(--text-muted); font-size: 14px;">Телефон:</label>
                                    <span style="color: var(--text-light); font-size: 16px;">${personnel.phone}</span>
                                </div>
                            ` : ''}
                            ${personnel.email ? `
                                <div class="info-item">
                                    <label style="color: var(--text-muted); font-size: 14px;">Email:</label>
                                    <span style="color: var(--text-light); font-size: 16px;">${personnel.email}</span>
                                </div>
                            ` : ''}
                            ${personnel.unit_name ? `
                                <div class="info-item">
                                    <label style="color: var(--text-muted); font-size: 14px;">Підрозділ:</label>
                                    <span style="color: var(--text-light); font-size: 16px;">${personnel.unit_name}</span>
                                </div>
                            ` : ''}
                        </div>
                        ${crews.length > 0 ? `
                            <div class="personnel-crews-section" style="margin-top: 20px; padding: 15px; background: rgba(0, 0, 0, 0.3); border-radius: 8px;">
                                <h3 style="color: var(--primary); margin-bottom: 15px;">Екіпажі</h3>
                                <div class="crews-list">
                                    ${crews.map(crew => {
                                        const member = crew.members.find(m => m.personnel_id === personnelId);
                                        return `
                                            <div style="padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 6px; margin-bottom: 10px;">
                                                <strong>${crew.name}</strong> - ${crew.uav_type || 'БПЛА'}
                                                ${member && member.role ? `<br><span style="color: var(--text-muted);">Роль: ${member.role}</span>` : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${(() => {
                            // Завантажуємо курси для цього персоналу
                            try {
                                const userCourses = personnel.courses || [];
                                if (userCourses.length > 0) {
                                    const completed = userCourses.filter(c => String(c.status || '').toLowerCase() === 'completed');
                                    const inProgress = userCourses.filter(c => {
                                        const status = String(c.status || '').toLowerCase();
                                        return status !== 'completed' && (status === 'in_progress' || status === 'assigned' || (c.progress || 0) > 0);
                                    });
                                    
                                    return `
                                        <div class="personnel-courses-section" style="margin-top: 20px; padding: 15px; background: rgba(0, 0, 0, 0.3); border-radius: 8px;">
                                            <h3 style="color: var(--primary); margin-bottom: 15px;">Курси</h3>
                                            ${completed.length > 0 ? `
                                                <div style="margin-bottom: 15px;">
                                                    <h4 style="color: var(--primary-dark); font-size: 14px; margin-bottom: 10px;">Пройдені (${completed.length})</h4>
                                                    ${completed.map(c => `
                                                        <div style="padding: 8px; background: rgba(0, 200, 0, 0.1); border-left: 3px solid #00c800; border-radius: 4px; margin-bottom: 5px;">
                                                            ${escapeHtml(c.title || 'Курс')} - ${c.progress || 0}%
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            ${inProgress.length > 0 ? `
                                                <div style="margin-bottom: 15px;">
                                                    <h4 style="color: var(--primary-dark); font-size: 14px; margin-bottom: 10px;">В процесі (${inProgress.length})</h4>
                                                    ${inProgress.map(c => `
                                                        <div style="padding: 8px; background: rgba(230, 168, 87, 0.1); border-left: 3px solid var(--primary); border-radius: 4px; margin-bottom: 5px;">
                                                            ${escapeHtml(c.title || 'Курс')} - ${c.progress || 0}%
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }
                            } catch (e) {
                                console.warn('Could not load courses:', e);
                            }
                            return '';
                        })()}
                    </div>
                    <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn-primary" onclick="editPersonnel(${personnelId})">Редагувати</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('personnelCardModal');
        };
    } catch (error) {
        console.error('Error opening personnel card:', error);
        showNotification('Помилка відкриття картки особового складу', 'error');
    }
}

// Функція для редагування особового складу
function editPersonnel(personnelId) {
    closeModal('personnelCardModal');
    showAddPersonnelModal(personnelId);
}

// Модальне вікно додавання особового складу
async function showAddPersonnelModal(personnelId = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addPersonnelModal';
    
    // Завантажуємо дані для редагування якщо потрібно
    let personnelData = null;
    if (personnelId) {
        try {
            const response = await api.getPersonnel();
            const data = await api.handleResponse(response);
            personnelData = (data.data || []).find(p => p.id === personnelId);
        } catch (e) {
            console.warn('Could not load personnel for edit:', e);
        }
    }
    
    modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">${personnelData ? 'Редагувати особовий склад' : 'Додати особовий склад'}</div>
                    <button class="close-btn" onclick="closeModal('addPersonnelModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="addPersonnelForm" onsubmit="handleAddPersonnel(event); return false;">
                        <input type="hidden" id="personnelEditId" value="${personnelData ? personnelData.id : ''}">
                    <div class="form-row">
                        <div class="form-group">
                            <label>ПІБ *</label>
                            <input type="text" id="personnelFullName" required value="${personnelData ? escapeHtml(personnelData.full_name || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label>Посада *</label>
                            <input type="text" id="personnelPosition" required value="${personnelData ? escapeHtml(personnelData.position || '') : ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Особовий номер (ШПК) *</label>
                            <input type="text" id="personnelShpk" required placeholder="Наприклад: 12345" value="${personnelData ? escapeHtml(personnelData.shpk || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label>Військове звання *</label>
                            <select id="personnelRank" required>
                                <option value="">Виберіть звання</option>
                                <option value="рекрут" ${personnelData && personnelData.rank === 'рекрут' ? 'selected' : ''}>Рекрут</option>
                                <option value="солдат" ${personnelData && personnelData.rank === 'солдат' ? 'selected' : ''}>Солдат</option>
                                <option value="молодший сержант" ${personnelData && personnelData.rank === 'молодший сержант' ? 'selected' : ''}>Молодший сержант</option>
                                <option value="сержант" ${personnelData && personnelData.rank === 'сержант' ? 'selected' : ''}>Сержант</option>
                                <option value="старший сержант" ${personnelData && personnelData.rank === 'старший сержант' ? 'selected' : ''}>Старший сержант</option>
                                <option value="молодший лейтенант" ${personnelData && personnelData.rank === 'молодший лейтенант' ? 'selected' : ''}>Молодший лейтенант</option>
                                <option value="лейтенант" ${personnelData && personnelData.rank === 'лейтенант' ? 'selected' : ''}>Лейтенант</option>
                                <option value="старший лейтенант" ${personnelData && personnelData.rank === 'старший лейтенант' ? 'selected' : ''}>Старший лейтенант</option>
                                <option value="капітан" ${personnelData && personnelData.rank === 'капітан' ? 'selected' : ''}>Капітан</option>
                                <option value="майор" ${personnelData && personnelData.rank === 'майор' ? 'selected' : ''}>Майор</option>
                                <option value="підполковник" ${personnelData && personnelData.rank === 'підполковник' ? 'selected' : ''}>Підполковник</option>
                                <option value="полковник" ${personnelData && personnelData.rank === 'полковник' ? 'selected' : ''}>Полковник</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Підрозділ *</label>
                            <div style="display: flex; gap: 10px; align-items: flex-end;">
                                <select id="personnelUnit" required style="flex: 1;">
                                    <option value="">Виберіть підрозділ</option>
                                </select>
                                <button type="button" class="btn-secondary" onclick="showAddUnitModal()" style="white-space: nowrap;">
                                    ➕ Створити підрозділ
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Телефон</label>
                            <input type="tel" id="personnelPhone" placeholder="+380501234567" value="${personnelData ? escapeHtml(personnelData.phone || '') : ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="personnelEmail" placeholder="email@example.com" value="${personnelData ? escapeHtml(personnelData.email || '') : ''}">
                        </div>
                        ${!personnelData ? `
                        <div class="form-group">
                            <label>Пароль (якщо створюєте нового користувача)</label>
                            <input type="password" id="personnelPassword" placeholder="Мінімум 6 символів">
                        </div>
                        ` : ''}
                    </div>
                    <div class="form-group">
                        <label>Екіпаж</label>
                        <select id="personnelCrew">
                            <option value="">Виберіть екіпаж (необов'язково)</option>
                        </select>
                    </div>
                    <div class="form-group" id="personnelCrewRoleGroup" style="display: none;">
                        <label>Роль в екіпажі *</label>
                        <select id="personnelCrewRole" required>
                            <option value="">Виберіть роль</option>
                            <option value="Пілот БПЛА">Пілот БПЛА</option>
                            <option value="Штурман">Штурман</option>
                            <option value="Оператор ретранслятора">Оператор ретранслятора</option>
                            <option value="Пілот ретранслятора">Пілот ретранслятора</option>
                            <option value="Інженер БК">Інженер БК</option>
                            <option value="Сапер">Сапер</option>
                            <option value="Командир екіпажу">Командир екіпажу</option>
                            <option value="custom">Інша роль (вкажіть нижче)</option>
                        </select>
                        <input type="text" id="personnelCrewRoleCustom" placeholder="Вкажіть роль" style="display: none; margin-top: 10px;">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Зберегти</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addPersonnelModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Завантажуємо дані для select
    await loadUnitsForSelect();
    await loadCrewsForSelect();
    
    // Заповнюємо форму якщо редагуємо
    if (personnelData) {
        if (personnelData.unit_id) {
            const unitSelect = document.getElementById('personnelUnit');
            if (unitSelect) {
                unitSelect.value = personnelData.unit_id;
            }
        }
        if (personnelData.crew_id) {
            const crewSelect = document.getElementById('personnelCrew');
            if (crewSelect) {
                crewSelect.value = personnelData.crew_id;
                const crewRoleGroup = document.getElementById('personnelCrewRoleGroup');
                if (crewRoleGroup) {
                    crewRoleGroup.style.display = 'block';
                }
            }
        }
    }
    
    // Обробник зміни екіпажу
    const crewSelect = document.getElementById('personnelCrew');
    const crewRoleGroup = document.getElementById('personnelCrewRoleGroup');
    const crewRoleSelect = document.getElementById('personnelCrewRole');
    const crewRoleCustom = document.getElementById('personnelCrewRoleCustom');
    
    if (crewSelect) {
        crewSelect.addEventListener('change', function() {
            if (this.value && this.value !== '') {
                crewRoleGroup.style.display = 'block';
                if (crewRoleSelect) {
                    crewRoleSelect.required = true;
                    crewRoleSelect.disabled = false;
                }
            } else {
                crewRoleGroup.style.display = 'none';
                if (crewRoleSelect) {
                    crewRoleSelect.required = false;
                    crewRoleSelect.value = '';
                    crewRoleSelect.disabled = false;
                }
                if (crewRoleCustom) {
                    crewRoleCustom.style.display = 'none';
                    crewRoleCustom.value = '';
                    crewRoleCustom.required = false;
                }
            }
        });
    }
    
    if (crewRoleSelect) {
        crewRoleSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                crewRoleCustom.style.display = 'block';
                crewRoleCustom.required = true;
            } else {
                crewRoleCustom.style.display = 'none';
                crewRoleCustom.required = false;
                crewRoleCustom.value = '';
            }
        });
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addPersonnelModal');
    };
}

// Завантаження підрозділів для select
async function loadUnitsForSelect() {
    try {
        const response = await api.getUnits();
        const data = await api.handleResponse(response);
        const select = document.getElementById('personnelUnit');
        
        if (select && data.data) {
            select.innerHTML = '<option value="">Виберіть підрозділ</option>' +
                data.data.map(unit => `<option value="${unit.id}">${unit.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading units:', error);
    }
}

// Завантаження екіпажів для select
async function loadCrewsForSelect() {
    try {
        const response = await api.getCrews();
        const data = await api.handleResponse(response);
        
        // Для модального вікна
        const modalSelect = document.getElementById('personnelCrew');
        if (modalSelect) {
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                modalSelect.innerHTML = '<option value="">Виберіть екіпаж (необов\'язково)</option>' +
                    data.data.map(crew => `<option value="${crew.id}">${escapeHtml(crew.name || 'Без назви')} (${escapeHtml(crew.uav_type || 'Не вказано')})</option>`).join('');
            } else {
                modalSelect.innerHTML = '<option value="">Виберіть екіпаж (необов\'язково)</option>';
            }
        }
        
        // Для HTML форми
        const formSelect = document.getElementById('crewId');
        if (formSelect) {
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                formSelect.innerHTML = '<option value="">Без екіпажу</option>' +
                    data.data.map(crew => `<option value="${crew.id}">${escapeHtml(crew.name || 'Без назви')} (${escapeHtml(crew.uav_type || 'Не вказано')})</option>`).join('');
            } else {
                formSelect.innerHTML = '<option value="">Без екіпажу</option>';
            }
        }
    } catch (error) {
        console.warn('Error loading crews for select:', error);
        // Встановлюємо порожній список якщо помилка
        const modalSelect = document.getElementById('personnelCrew');
        if (modalSelect) {
            modalSelect.innerHTML = '<option value="">Виберіть екіпаж (необов\'язково)</option>';
        }
        const formSelect = document.getElementById('crewId');
        if (formSelect) {
            formSelect.innerHTML = '<option value="">Без екіпажу</option>';
        }
    }
}

// Модальне вікно створення підрозділу
function showAddUnitModal() {
    const unitName = prompt('Введіть назву підрозділу:');
    if (!unitName || !unitName.trim()) {
        return;
    }
    
    // Створюємо підрозділ через API
    (async () => {
        try {
            const response = await api.createUnit({ name: unitName.trim() });
            const data = await api.handleResponse(response);
            
            if (data.success) {
                showNotification('Підрозділ створено успішно', 'success');
                // Оновлюємо список підрозділів
                await loadUnitsForSelect();
                // Встановлюємо новий підрозділ як вибраний
                const unitSelect = document.getElementById('personnelUnit');
                if (unitSelect && data.data && data.data.id) {
                    unitSelect.value = data.data.id;
                }
            }
        } catch (error) {
            console.error('Error creating unit:', error);
            showNotification('Помилка створення підрозділу: ' + (error.message || 'невідома помилка'), 'error');
        }
    })();
}

// Збереження особового складу
async function handleAddPersonnel(event) {
    event.preventDefault();
    
    try {
        const editId = document.getElementById('personnelEditId')?.value;
        const fullName = document.getElementById('personnelFullName').value;
        const position = document.getElementById('personnelPosition').value;
        const shpk = document.getElementById('personnelShpk').value;
        const rank = document.getElementById('personnelRank').value;
        const unitId = document.getElementById('personnelUnit').value;
        const phone = document.getElementById('personnelPhone').value;
        const email = document.getElementById('personnelEmail').value;
        const password = document.getElementById('personnelPassword')?.value;
        const crewId = document.getElementById('personnelCrew').value;
        const crewRoleSelect = document.getElementById('personnelCrewRole');
        const crewRoleCustom = document.getElementById('personnelCrewRoleCustom');
        let crewRole = null;
        
        if (crewId) {
            if (crewRoleSelect.value === 'custom') {
                crewRole = crewRoleCustom.value.trim();
                if (!crewRole) {
                    showNotification('Вкажіть роль в екіпажі', 'error');
                    return;
                }
            } else {
                crewRole = crewRoleSelect.value;
            }
            if (!crewRole) {
                showNotification('Виберіть роль в екіпажі', 'error');
                return;
            }
        }
        
        // Створення користувача якщо вказано email та пароль
        let userId = null;
        if (email && password) {
            if (password.length < 6) {
                showNotification('Пароль повинен містити мінімум 6 символів', 'error');
                return;
            }
            try {
                const registerResponse = await api.register({
                    full_name: fullName,
                    email: email,
                    password: password
                });
                const registerData = await api.handleResponse(registerResponse);
                if (registerData.user) {
                    userId = registerData.user.id;
                }
            } catch (e) {
                // Можливо користувач вже існує
                if (e.message && e.message.includes('вже існує')) {
                    // Спробуємо знайти користувача
                    try {
                        if (typeof window !== 'undefined' && window.localAdmin) {
                            const usersResponse = await window.localAdmin.getUsers();
                            const users = usersResponse.data || [];
                            const existingUser = users.find(u => u.email === email);
                            if (existingUser) {
                                userId = existingUser.id;
                            }
                        }
                    } catch (e2) {
                        console.warn('Could not find existing user:', e2);
                    }
                } else {
                    throw e;
                }
            }
        } else if (email) {
            // Якщо тільки email - спробуємо знайти користувача
            try {
                if (typeof window !== 'undefined' && window.localAdmin) {
                    const usersResponse = await window.localAdmin.getUsers();
                    const users = usersResponse.data || [];
                    const existingUser = users.find(u => u.email === email);
                    if (existingUser) {
                        userId = existingUser.id;
                    }
                }
            } catch (e) {
                console.warn('Could not find existing user:', e);
            }
        }
        
        // Створення/оновлення особового складу
        const personnelData = {
            shpk: shpk,
            full_name: fullName,
            position: position,
            rank: rank,
            phone: phone || null,
            email: email || null,
            unit_id: unitId ? parseInt(unitId) : null,
            user_id: userId
        };
        
        let response;
        if (editId) {
            // Оновлення існуючого
            response = await api.updatePersonnel(parseInt(editId), personnelData);
        } else {
            // Створення нового
            response = await api.createPersonnel(personnelData);
        }
        
        const data = await api.handleResponse(response);
        
        if (data.success) {
            const personnelId = editId ? parseInt(editId) : data.data.id;
            
            // Додавання до екіпажу якщо вказано
            if (crewId && crewRole) {
                try {
                    const crewResponse = await api.getCrew(crewId);
                    const crewData = await api.handleResponse(crewResponse);
                    const crew = crewData.data;
                    
                    const members = crew.members || [];
                    members.push({
                        personnel_id: personnelId,
                        role: crewRole
                    });
                    
                    await api.updateCrew(crewId, {
                        name: crew.name,
                        uav_type: crew.uav_type,
                        members: members
                    });
                } catch (e) {
                    console.warn('Could not add to crew:', e);
                }
            }
            
            closeModal('addPersonnelModal');
            showNotification('Особовий склад додано успішно', 'success');
            loadPersonnel();
        }
    } catch (error) {
        console.error('Error adding personnel:', error);
        showNotification(error.message || 'Помилка додавання особового складу', 'error');
    }
}

// Обробник форми додавання особового складу (з HTML)
async function handlePersonnelForm(event) {
    event.preventDefault();
    
    try {
        const serviceNumber = document.getElementById('serviceNumber').value;
        const fullName = document.getElementById('fullName').value;
        const position = document.getElementById('position').value;
        const rank = document.getElementById('rank').value;
        const unit = document.getElementById('unit').value;
        const phone = document.getElementById('phone').value;
        const combatZoneAccess = document.getElementById('combatZoneAccess').value === 'true';
        const crewId = document.getElementById('crewId').value || null;
        const personnelId = document.getElementById('personnelId').value;
        
        const personnelData = {
            serviceNumber: serviceNumber,
            fullName: fullName,
            position: position,
            rank: rank,
            unit: unit,
            phone: phone || null,
            combatZoneAccess: combatZoneAccess,
            crewId: crewId ? parseInt(crewId) : null
        };
        
        let response;
        if (personnelId) {
            // Оновлення існуючого
            response = await api.updatePersonnel(personnelId, personnelData);
        } else {
            // Створення нового
            response = await api.createPersonnel(personnelData);
        }
        
        const data = await api.handleResponse(response);
        
        if (data.success) {
            showNotification(personnelId ? 'Особовий склад оновлено успішно' : 'Особовий склад додано успішно', 'success');
            // Очистити форму
            document.getElementById('personnelForm').reset();
            document.getElementById('personnelId').value = '';
            // Перезавантажити список
            await loadPersonnel();
        }
    } catch (error) {
        console.error('Error saving personnel:', error);
        showNotification(error.message || 'Помилка збереження особового складу', 'error');
    }
}

// Ініціалізація форми при завантаженні сторінки
function initPersonnelForm() {
    const form = document.getElementById('personnelForm');
    if (form) {
        // Перевіряємо, чи обробник вже додано
        if (!form.hasAttribute('data-handler-attached')) {
            form.addEventListener('submit', handlePersonnelForm);
            form.setAttribute('data-handler-attached', 'true');
        }
    }
    
    // Завантажити екіпажі для select (з обробкою помилок)
    const crewSelect = document.getElementById('crewId');
    if (crewSelect) {
        loadCrewsForSelect().catch(error => {
            console.warn('Could not load crews for select (database may not be initialized yet):', error);
            // Не показуємо помилку користувачу, просто залишаємо порожній список
        });
    }
}

// Експорт функцій
if (typeof window !== 'undefined') {
    window.loadPersonnel = loadPersonnel;
    window.setPersonnelViewMode = setPersonnelViewMode;
    window.filterPersonnel = filterPersonnel;
    window.getCurrentUser = getCurrentUser;
    window.showAddPersonnelModal = showAddPersonnelModal;
    window.editPersonnel = editPersonnel;
    window.showAddUnitModal = showAddUnitModal;
    
    // Показуємо форму в модальному вікні замість прямо на сторінці
    const originalShowAddPersonnelModal = showAddPersonnelModal;
    window.showAddPersonnelModal = async function(personnelId = null) {
        // Приховуємо форму на сторінці якщо вона видима
        const formCard = document.getElementById('personnelFormCard');
        if (formCard) {
            formCard.style.display = 'none';
        }
        // Показуємо модальне вікно
        await originalShowAddPersonnelModal(personnelId);
    };
    window.handleAddPersonnel = handleAddPersonnel;
    window.handlePersonnelForm = handlePersonnelForm;
    window.initPersonnelForm = initPersonnelForm;
    window.loadCrewsForSelect = loadCrewsForSelect;
    window.openPersonnelCard = openPersonnelCard;
    
    // Ініціалізувати форму при завантаженні
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPersonnelForm);
    } else {
        initPersonnelForm();
    }
}

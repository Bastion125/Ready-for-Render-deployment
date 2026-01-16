// Управління особовим складом
// Нова версія - простий список з пошуком

let personnelViewMode = 'list';

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

// Завантаження списку особового складу
async function loadPersonnel() {
    console.log('loadPersonnel called');
    const content = document.getElementById('personnelContent');
    if (!content) {
        console.error('personnelContent element not found in DOM');
        return;
    }
    
    console.log('personnelContent found, loading...');
    // Показуємо завантаження
    content.innerHTML = '<div class="empty-state">Завантаження...</div>';
    
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
        content.innerHTML = '<div class="empty-state">Користувач не авторизований</div>';
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
            content.innerHTML = '<div class="empty-state">Особовий склад відсутній. Натисніть "Додати особовий склад" для створення.</div>';
        } else {
            renderPersonnel(personnelList);
        }
    } catch (error) {
        console.error('Error loading personnel:', error);
        content.innerHTML = `<div class="error">Помилка завантаження особового складу: ${error.message || 'невідома помилка'}</div>`;
        if (typeof showNotification === 'function') {
            showNotification('Помилка завантаження особового складу', 'error');
        }
    }
}

// Завантаження персональної картки користувача
async function loadUserPersonnel() {
    try {
        const response = await api.getProfile();
        const data = await api.handleResponse(response);
        
        if (data.user.personnel) {
            renderPersonnel([data.user.personnel]);
        } else {
            document.getElementById('personnelContent').innerHTML = 
                '<div class="empty-state">Персональна картка не знайдена</div>';
        }
    } catch (error) {
        console.error('Error loading user personnel:', error);
    }
}

// Відображення особового складу
function renderPersonnel(personnel) {
    console.log('renderPersonnel called with:', personnel);
    const content = document.getElementById('personnelContent');
    if (!content) {
        console.error('personnelContent element not found in renderPersonnel');
        return;
    }

    if (!personnel || !Array.isArray(personnel)) {
        console.error('Invalid personnel data:', personnel);
        content.innerHTML = '<div class="empty-state">Помилка: некоректні дані особового складу</div>';
        return;
    }

    console.log('Rendering personnel:', personnel.length, 'items', personnel);

    const currentUser = getCurrentUser();
    const canEdit = currentUser && ['Readit', 'Admin', 'SystemAdmin'].includes(currentUser.role);

    // Генеруємо HTML для таблиці
    let listHtml;
    if (personnel.length === 0) {
        listHtml = '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">Особовий склад відсутній. Натисніть "Додати особовий склад" для створення.</div>';
    } else {
        listHtml = renderPersonnelList(personnel);
        console.log('Generated list HTML length:', listHtml.length);
    }

    content.innerHTML = `
        <div class="personnel-section">
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin: 0;">Особовий склад</h2>
                ${canEdit ? `
                    <button class="btn-primary" onclick="showAddPersonnelModal()">
                        ➕ Додати особовий склад
                    </button>
                ` : ''}
            </div>
            
            <div class="personnel-filters" style="margin-bottom: 20px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <div style="flex: 1; min-width: 300px;">
                    <input type="text" 
                           id="personnelSearch" 
                           placeholder="🔍 Пошук за ПІБ, посадою, званням, підрозділом, ШПК..." 
                           class="search-input"
                           oninput="filterPersonnel()"
                           style="width: 100%; padding: 12px; background: rgba(0, 0, 0, 0.5); border: 2px solid var(--border); border-radius: 8px; color: var(--text-light); font-size: 14px;">
                </div>
            </div>
            
            <div class="personnel-container" id="personnelListContainer" style="min-height: 200px; width: 100%; overflow-x: auto; background: transparent;">
                ${listHtml}
            </div>
        </div>
    `;
    
    // Зберігаємо оригінальний список для фільтрації
    window.allPersonnel = personnel;
    
    const container = document.getElementById('personnelListContainer');
    console.log('Personnel rendered, container found:', !!container, 'HTML length:', container ? container.innerHTML.length : 0);
    
    // Додаткова перевірка - якщо контейнер порожній після рендерингу
    if (container && (!container.innerHTML || container.innerHTML.trim() === '')) {
        console.error('Container is empty after rendering!');
        container.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">Помилка відображення. Перезавантажте сторінку.</div>';
    }
}

// Відображення таблицею
function renderPersonnelList(personnel) {
    if (personnel.length === 0) {
        return '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">Особовий склад відсутній</div>';
    }
    
    return `
        <table class="personnel-table" style="width: 100%; border-collapse: collapse; background: var(--bg-card); border-radius: 8px; overflow: hidden;">
            <thead>
                <tr style="background: rgba(230, 168, 87, 0.15);">
                    <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">ПІБ</th>
                    <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Посада</th>
                    <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Звання</th>
                    <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Підрозділ</th>
                    <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">ШПК</th>
                    <th style="padding: 15px; text-align: left; color: var(--primary); font-weight: bold; border-bottom: 2px solid var(--border);">Email</th>
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
                        <td style="padding: 15px; color: var(--text-light);">${escapeHtml(p.email || 'Не вказано')}</td>
                        <td style="padding: 15px; text-align: center;">
                            <button class="btn-primary" onclick="event.stopPropagation(); openPersonnelCard(${p.id})" style="padding: 8px 16px; font-size: 13px; border-radius: 6px;">Переглянути</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Відображення плиткою
function renderPersonnelGrid(personnel) {
    if (personnel.length === 0) {
        return '<div class="empty-state">Особовий склад відсутній</div>';
    }
    
    return personnel.map(p => `
        <div class="personnel-card" onclick="openPersonnelCard(${p.id})" style="cursor: pointer;">
            <div class="personnel-avatar-large">${getInitials(p.full_name)}</div>
            <h3 style="margin: 10px 0 5px 0; color: var(--primary);">${p.full_name}</h3>
            <p class="personnel-position" style="margin: 5px 0; color: var(--text-light);"><strong>Посада:</strong> ${p.position || 'Не вказано'}</p>
            <p class="personnel-rank" style="margin: 5px 0; color: var(--text-light);"><strong>Звання:</strong> ${p.rank || 'Не вказано'}</p>
            ${p.unit_name ? `<p class="personnel-unit" style="margin: 5px 0; color: var(--text-muted);"><strong>Підрозділ:</strong> ${p.unit_name}</p>` : ''}
        </div>
    `).join('');
}

// Встановлення режиму перегляду
function setPersonnelViewMode(mode) {
    personnelViewMode = mode;
    localStorage.setItem('personnelViewMode', mode);
    filterPersonnel();
}

// Фільтрація особового складу
function filterPersonnel() {
    const searchInput = document.getElementById('personnelSearch');
    const container = document.getElementById('personnelListContainer');
    if (!searchInput || !container || !window.allPersonnel) return;
    
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
        container.innerHTML = '<div class="empty-state">Нічого не знайдено</div>';
    } else {
        container.innerHTML = renderPersonnelList(filtered);
    }
}

// Отримання ініціалів
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

// Модальне вікно додавання особового складу
function showAddPersonnelModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addPersonnelModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Додати особовий склад</div>
                <button class="close-btn" onclick="closeModal('addPersonnelModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addPersonnelForm" onsubmit="handleAddPersonnel(event); return false;">
                    <div class="form-row">
                        <div class="form-group">
                            <label>ПІБ *</label>
                            <input type="text" id="personnelFullName" required>
                        </div>
                        <div class="form-group">
                            <label>Посада *</label>
                            <input type="text" id="personnelPosition" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Особовий номер (ШПК) *</label>
                            <input type="text" id="personnelShpk" required placeholder="Наприклад: 12345">
                        </div>
                        <div class="form-group">
                            <label>Військове звання *</label>
                            <select id="personnelRank" required>
                                <option value="">Виберіть звання</option>
                                <option value="рекрут">Рекрут</option>
                                <option value="солдат">Солдат</option>
                                <option value="молодший сержант">Молодший сержант</option>
                                <option value="сержант">Сержант</option>
                                <option value="старший сержант">Старший сержант</option>
                                <option value="молодший лейтенант">Молодший лейтенант</option>
                                <option value="лейтенант">Лейтенант</option>
                                <option value="старший лейтенант">Старший лейтенант</option>
                                <option value="капітан">Капітан</option>
                                <option value="майор">Майор</option>
                                <option value="підполковник">Підполковник</option>
                                <option value="полковник">Полковник</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Підрозділ *</label>
                            <select id="personnelUnit" required>
                                <option value="">Виберіть підрозділ</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Телефон</label>
                            <input type="tel" id="personnelPhone" placeholder="+380501234567">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="personnelEmail" placeholder="email@example.com">
                        </div>
                        <div class="form-group">
                            <label>Пароль (якщо створюєте нового користувача)</label>
                            <input type="password" id="personnelPassword" placeholder="Мінімум 6 символів">
                        </div>
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
    loadUnitsForSelect();
    loadCrewsForSelect();
    
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
        const select = document.getElementById('personnelCrew');
        
        if (select && data.data) {
            select.innerHTML = '<option value="">Виберіть екіпаж (необов\'язково)</option>' +
                data.data.map(crew => `<option value="${crew.id}">${crew.name} (${crew.uav_type})</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading crews:', error);
    }
}

// Збереження особового складу
async function handleAddPersonnel(event) {
    event.preventDefault();
    
    try {
        const fullName = document.getElementById('personnelFullName').value;
        const position = document.getElementById('personnelPosition').value;
        const shpk = document.getElementById('personnelShpk').value;
        const rank = document.getElementById('personnelRank').value;
        const unitId = document.getElementById('personnelUnit').value;
        const phone = document.getElementById('personnelPhone').value;
        const email = document.getElementById('personnelEmail').value;
        const password = document.getElementById('personnelPassword').value;
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
        
        // Створення особового складу
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
        
        const response = await api.createPersonnel(personnelData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            const personnelId = data.data.id;
            
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

// Експорт функцій
if (typeof window !== 'undefined') {
    window.loadPersonnel = loadPersonnel;
    window.setPersonnelViewMode = setPersonnelViewMode;
    window.filterPersonnel = filterPersonnel;
    window.getCurrentUser = getCurrentUser;
    window.showAddPersonnelModal = showAddPersonnelModal;
    window.handleAddPersonnel = handleAddPersonnel;
    window.loadCrewsForSelect = loadCrewsForSelect;
    window.openPersonnelCard = openPersonnelCard;
}

// Екіпажі - управління екіпажами

let crewsList = [];

// Завантаження екіпажів
async function loadCrews() {
    const content = document.getElementById('crewsContent');
    if (!content) return;

    try {
        const response = await api.getCrews();
        const data = await api.handleResponse(response);
        crewsList = data.data || [];
        
        renderCrews(crewsList);
    } catch (error) {
        console.error('Error loading crews:', error);
        content.innerHTML = '<div class="empty-state">Помилка завантаження екіпажів</div>';
    }
}

// Відображення екіпажів
function renderCrews(crews) {
    const content = document.getElementById('crewsContent');
    if (!content) return;

    if (crews.length === 0) {
        content.innerHTML = '<div class="empty-state">Екіпажі відсутні</div>';
        return;
    }

    content.innerHTML = `
        <div class="section-actions">
            <button class="btn-primary" onclick="showAddCrewModal()">
                ➕ Додати екіпаж
            </button>
        </div>
        <div class="crews-grid">
            ${crews.map(crew => `
                <div class="crew-card">
                    ${crew.avatar_path || crew.avatar_data ? `
                        <div class="crew-avatar" style="text-align: center; margin-bottom: 15px;">
                            <img src="${crew.avatar_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(crew.avatar_data, 'image/jpeg') : (crew.avatar_data.startsWith('data:') ? crew.avatar_data : 'data:image/jpeg;base64,' + crew.avatar_data)) : crew.avatar_path}" 
                                 alt="${crew.name}" 
                                 style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid var(--primary);">
                        </div>
                    ` : ''}
                    <h3>${crew.name}</h3>
                    <p><strong>Тип БПЛА:</strong> ${crew.uav_type}</p>
                    <p><strong>Членів:</strong> ${crew.members_count || 0}</p>
                    ${crew.members && crew.members.length > 0 ? `
                        <div class="crew-members-preview">
                            <strong>Члени екіпажу:</strong>
                            <ul class="crew-members-list">
                                ${crew.members.map(member => `
                                    <li>${member.full_name || 'Невідомо'} ${member.role ? `(${member.role})` : ''}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : '<p class="text-muted">Члени екіпажу не додані</p>'}
                    <div class="crew-actions">
                        <button class="btn-primary btn-small" onclick="editCrew(${crew.id})">Редагувати</button>
                        <button class="btn-secondary btn-small" onclick="viewCrewDetails(${crew.id})">Деталі</button>
                        <button class="btn-danger btn-small" onclick="deleteCrew(${crew.id})">Видалити</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Модальне вікно створення/редагування екіпажу
async function showAddCrewModal(crewId = null) {
    let crew = null;
    if (crewId) {
        // Завантажуємо повну інформацію про екіпаж
        try {
            const response = await api.getCrew(crewId);
            const data = await api.handleResponse(response);
            crew = data.data;
        } catch (error) {
            console.error('Error loading crew:', error);
            crew = crewsList.find(c => c.id === crewId) || null;
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addCrewModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${crew ? 'Редагувати екіпаж' : 'Створити екіпаж'}</div>
                <button class="close-btn" onclick="closeModal('addCrewModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addCrewForm" onsubmit="handleAddCrew(event); return false;">
                    <input type="hidden" id="crewId" value="${crew ? crew.id : ''}">
                    <div class="form-group">
                        <label>Назва екіпажу *</label>
                        <input type="text" id="crewName" required value="${crew ? crew.name : ''}">
                    </div>
                    <div class="form-group">
                        <label>Тип БПЛА *</label>
                        <select id="crewUavType" required>
                            <option value="">Виберіть тип БПЛА з засобів</option>
                        </select>
                        <small>Або введіть новий тип вручну</small>
                        <input type="text" id="crewUavTypeCustom" placeholder="Або введіть новий тип" style="margin-top: 10px; display: none;">
                    </div>
                    <div class="form-group">
                        <label>Аватар екіпажу</label>
                        <input type="file" id="crewAvatar" accept="image/jpeg,image/png,image/webp" onchange="handleCrewAvatarSelect(event)">
                        <div id="crewAvatarPreview" style="margin-top: 10px;"></div>
                    </div>
                    <div class="form-group">
                        <label>Члени екіпажу</label>
                        <div id="crewMembersList"></div>
                        <button type="button" class="btn-secondary" onclick="addCrewMember()">➕ Додати члена</button>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Зберегти</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addCrewModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addCrewModal');
    };
    
    // Завантаження типів БПЛА з засобів
    loadEquipmentTypesForCrew();
    
    // Обробник вибору типу БПЛА
    const uavTypeSelect = document.getElementById('crewUavType');
    const uavTypeCustom = document.getElementById('crewUavTypeCustom');
    if (uavTypeSelect) {
        uavTypeSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                uavTypeCustom.style.display = 'block';
                uavTypeCustom.required = true;
            } else {
                uavTypeCustom.style.display = 'none';
                uavTypeCustom.required = false;
            }
        });
    }
    
    // Завантаження списку персоналу для вибору
    loadPersonnelForCrew().then(() => {
        // Якщо редагуємо, завантажуємо існуючих членів
        if (crew && crew.members && crew.members.length > 0) {
            const membersList = document.getElementById('crewMembersList');
            crew.members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'crew-member-item';
                memberDiv.innerHTML = `
                    <select class="crew-member-select">
                        <option value="">Виберіть особу</option>
                        ${(window.crewPersonnelList || []).map(p => `
                            <option value="${p.id}" ${p.id === member.personnel_id ? 'selected' : ''}>${p.full_name} - ${p.position}</option>
                        `).join('')}
                    </select>
                    <input type="text" class="crew-member-role" placeholder="Роль в екіпажі" value="${member.role || ''}">
                    <button type="button" class="btn-danger btn-small" onclick="this.parentElement.remove()">✕</button>
                `;
                membersList.appendChild(memberDiv);
            });
        }
    });
}

// Завантаження типів БПЛА з засобів
async function loadEquipmentTypesForCrew() {
    try {
        const response = await api.getEquipment();
        const data = await api.handleResponse(response);
        const select = document.getElementById('crewUavType');
        
        if (select && data.data) {
            // Отримуємо унікальні типи БПЛА
            const uavTypes = [...new Set(data.data
                .filter(eq => eq.type_uav)
                .map(eq => eq.type_uav))];
            
            select.innerHTML = '<option value="">Виберіть тип БПЛА з засобів</option>' +
                uavTypes.map(type => `<option value="${type}">${type}</option>`).join('') +
                '<option value="custom">Інший тип (вкажіть нижче)</option>';
            
            // Якщо редагуємо, встановлюємо значення
            const crewId = document.getElementById('crewId');
            if (crewId && crewId.value) {
                // Значення буде встановлено пізніше
            }
        }
    } catch (error) {
        console.error('Error loading equipment types:', error);
    }
}

// Обробка вибору аватару екіпажу
function handleCrewAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Перевірка типу файлу
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        showNotification('Дозволені тільки зображення: JPG, PNG, WEBP', 'error');
        return;
    }
    
    // Перевірка розміру (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Розмір файлу не повинен перевищувати 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('crewAvatarPreview');
        if (preview) {
            preview.innerHTML = `
                <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--primary);">
            `;
        }
        window.crewAvatarData = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Завантаження персоналу для вибору в екіпаж
async function loadPersonnelForCrew() {
    try {
        const response = await api.getPersonnel();
        const data = await api.handleResponse(response);
        window.crewPersonnelList = data.data || [];
        return Promise.resolve();
    } catch (error) {
        console.error('Error loading personnel:', error);
        window.crewPersonnelList = [];
        return Promise.resolve();
    }
}

// Додавання члена екіпажу
function addCrewMember() {
    const membersList = document.getElementById('crewMembersList');
    if (!membersList) return;
    
    const memberDiv = document.createElement('div');
    memberDiv.className = 'crew-member-item';
    memberDiv.innerHTML = `
        <select class="crew-member-select">
            <option value="">Виберіть особу</option>
            ${(window.crewPersonnelList || []).map(p => `
                <option value="${p.id}">${p.full_name} - ${p.position}</option>
            `).join('')}
        </select>
        <input type="text" class="crew-member-role" placeholder="Роль в екіпажі">
        <button type="button" class="btn-danger btn-small" onclick="this.parentElement.remove()">✕</button>
    `;
    
    membersList.appendChild(memberDiv);
}

// Збереження екіпажу
async function handleAddCrew(event) {
    event.preventDefault();
    
    const crewId = document.getElementById('crewId').value;
    const name = document.getElementById('crewName').value;
    const uavTypeSelect = document.getElementById('crewUavType');
    const uavTypeCustom = document.getElementById('crewUavTypeCustom');
    const uavType = uavTypeSelect.value === 'custom' ? uavTypeCustom.value : uavTypeSelect.value;
    
    if (!uavType) {
        showNotification('Виберіть або введіть тип БПЛА', 'error');
        return;
    }
    
    // Аватар екіпажу
    const avatarData = window.crewAvatarData || null;
    
    const members = [];
    const memberItems = document.querySelectorAll('.crew-member-item');
    memberItems.forEach(item => {
        const select = item.querySelector('.crew-member-select');
        const roleInput = item.querySelector('.crew-member-role');
        if (select.value) {
            members.push({
                personnel_id: parseInt(select.value),
                role: roleInput.value
            });
        }
    });
    
    try {
        const crewData = {
            name: name,
            uav_type: uavType,
            members: members,
            avatar_data: avatarData
        };
        
        let response;
        if (crewId) {
            response = await api.updateCrew(crewId, crewData);
        } else {
            response = await api.createCrew(crewData);
        }
        
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addCrewModal');
            showNotification(crewId ? 'Екіпаж оновлено' : 'Екіпаж створено', 'success');
            loadCrews();
        }
    } catch (error) {
        console.error('Error saving crew:', error);
        showNotification(error.message || 'Помилка збереження екіпажу', 'error');
    }
}

// Редагування екіпажу
function editCrew(crewId) {
    showAddCrewModal(crewId);
}

// Видалення екіпажу
async function deleteCrew(crewId) {
    if (!confirm('Ви впевнені, що хочете видалити цей екіпаж?')) {
        return;
    }
    
    try {
        const response = await api.deleteCrew(crewId);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            showNotification('Екіпаж видалено', 'success');
            loadCrews();
        }
    } catch (error) {
        console.error('Error deleting crew:', error);
        showNotification(error.message || 'Помилка видалення екіпажу', 'error');
    }
}

// Перегляд деталей екіпажу
async function viewCrewDetails(crewId) {
    try {
        const response = await api.getCrew(crewId);
        const data = await api.handleResponse(response);
        const crew = data.data;
        
        if (!crew) {
            showNotification('Екіпаж не знайдено', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'crewDetailsModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Деталі екіпажу: ${crew.name}</div>
                    <button class="close-btn" onclick="closeModal('crewDetailsModal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="crew-details">
                        <p><strong>Назва:</strong> ${crew.name}</p>
                        <p><strong>Тип БПЛА:</strong> ${crew.uav_type}</p>
                        <p><strong>Кількість членів:</strong> ${crew.members_count || 0}</p>
                        ${crew.members && crew.members.length > 0 ? `
                            <div class="crew-members-details">
                                <h4>Члени екіпажу:</h4>
                                <table class="crew-members-table">
                                    <thead>
                                        <tr>
                                            <th>ПІБ</th>
                                            <th>Посада</th>
                                            <th>Звання</th>
                                            <th>Роль в екіпажі</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${crew.members.map(member => `
                                            <tr>
                                                <td>${member.full_name || 'Невідомо'}</td>
                                                <td>${member.position || '-'}</td>
                                                <td>${member.rank || '-'}</td>
                                                <td>${member.role || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p class="text-muted">Члени екіпажу не додані</p>'}
                    </div>
                    <div class="form-actions">
                        <button class="btn-primary" onclick="editCrew(${crew.id}); closeModal('crewDetailsModal');">Редагувати</button>
                        <button class="btn-secondary" onclick="closeModal('crewDetailsModal')">Закрити</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('crewDetailsModal');
        };
    } catch (error) {
        console.error('Error loading crew details:', error);
        showNotification('Помилка завантаження деталей екіпажу', 'error');
    }
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.loadCrews = loadCrews;
    window.showAddCrewModal = showAddCrewModal;
    window.handleAddCrew = handleAddCrew;
    window.editCrew = editCrew;
    window.deleteCrew = deleteCrew;
    window.viewCrewDetails = viewCrewDetails;
    window.addCrewMember = addCrewMember;
    // closeModal та showNotification експортуються в auth.js
}



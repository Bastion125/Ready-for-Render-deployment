// Засоби - управління засобами (БПЛА, обладнання)

let equipmentList = [];
let equipmentViewMode = localStorage.getItem('equipmentViewMode') || 'grid';
let equipmentTypes = [];

// Завантаження засобів
async function loadEquipment() {
    const content = document.getElementById('equipmentContent');
    if (!content) return;

    try {
        // Завантаження типів
        const typesResponse = await api.getEquipmentTypes();
        const typesData = await api.handleResponse(typesResponse);
        equipmentTypes = typesData.data || [];
        
        // Завантаження засобів
        const response = await api.getEquipment();
        const data = await api.handleResponse(response);
        equipmentList = data.data || [];
        
        renderEquipment(equipmentList);
    } catch (error) {
        console.error('Error loading equipment:', error);
        let errorMessage = 'Помилка завантаження засобів';
        if (error.message && error.message.includes('no such table')) {
            errorMessage = 'Таблиця засобів не знайдена. Будь ласка, оновіть базу даних.';
        }
        content.innerHTML = `<div class="empty-state error">${errorMessage}</div>`;
        showNotification(errorMessage, 'error');
    }
}

// Відображення засобів
function renderEquipment(equipment) {
    const content = document.getElementById('equipmentContent');
    if (!content) return;

    if (equipment.length === 0) {
        content.innerHTML = `
            <div class="equipment-header">
                <div class="view-toggle">
                    <button class="toggle-btn ${equipmentViewMode === 'list' ? 'active' : ''}" 
                            data-view="list" onclick="setEquipmentViewMode('list')">
                        📋 Список
                    </button>
                    <button class="toggle-btn ${equipmentViewMode === 'grid' ? 'active' : ''}" 
                            data-view="grid" onclick="setEquipmentViewMode('grid')">
                        🟦 Плитка
                    </button>
                </div>
            </div>
            <div class="empty-state">Засоби відсутні</div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="equipment-header">
            <div class="view-toggle">
                <button class="toggle-btn ${equipmentViewMode === 'list' ? 'active' : ''}" 
                        data-view="list" onclick="setEquipmentViewMode('list')">
                    📋 Список
                </button>
                <button class="toggle-btn ${equipmentViewMode === 'grid' ? 'active' : ''}" 
                        data-view="grid" onclick="setEquipmentViewMode('grid')">
                    🟦 Плитка
                </button>
            </div>
        </div>
        <div class="equipment-container ${equipmentViewMode}-view">
            ${equipmentViewMode === 'grid' ? renderEquipmentGrid(equipment) : renderEquipmentList(equipment)}
        </div>
    `;
}

// Відображення у вигляді плитки
function renderEquipmentGrid(equipment) {
    return `
        <div class="equipment-grid">
            ${equipment.map(item => `
                <div class="equipment-card" onclick="openEquipmentCard(${item.id})">
                    ${item.photo_path || item.photo_data ? `
                        <div class="equipment-photo">
                            <img src="${item.photo_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(item.photo_data, 'image/jpeg') : (item.photo_data.startsWith('data:') ? item.photo_data : 'data:image/jpeg;base64,' + item.photo_data)) : item.photo_path}" 
                                 alt="${item.name}" 
                                 onerror="this.parentElement.innerHTML='<div class=\\'equipment-photo-placeholder\\'>📷</div>'">
                        </div>
                    ` : '<div class="equipment-photo-placeholder">📷</div>'}
                    <h3>${item.name}</h3>
                    <p><strong>Тип:</strong> ${item.type_name || 'Не вказано'}</p>
                    ${item.type_uav ? `<p><strong>Тип БПЛА:</strong> ${item.type_uav}</p>` : ''}
                    <p><strong>Статус:</strong> ${item.status || 'active'}</p>
                    <div class="equipment-actions" onclick="event.stopPropagation()">
                        <button class="btn-primary btn-small" onclick="openEquipmentCard(${item.id})">Відкрити</button>
                        <button class="btn-secondary btn-small" onclick="editEquipment(${item.id})">Редагувати</button>
                        <button class="btn-danger btn-small" onclick="deleteEquipment(${item.id})">Видалити</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Відображення у вигляді списку
function renderEquipmentList(equipment) {
    return `
        <div class="equipment-list">
            <table class="equipment-table">
                <thead>
                    <tr>
                        <th>Фото</th>
                        <th>Назва</th>
                        <th>Тип</th>
                        <th>Тип БПЛА</th>
                        <th>Статус</th>
                        <th>Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${equipment.map(item => `
                        <tr>
                            <td>
                                ${item.photo_path || item.photo_data ? `
                                    <img src="${item.photo_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(item.photo_data, 'image/jpeg') : (item.photo_data.startsWith('data:') ? item.photo_data : 'data:image/jpeg;base64,' + item.photo_data)) : item.photo_path}" 
                                         alt="${item.name}" 
                                         class="equipment-thumbnail"
                                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'50\\' height=\\'50\\'%3E%3Crect fill=\\'%23ccc\\' width=\\'50\\' height=\\'50\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\'%3E📷%3C/text%3E%3C/svg%3E'">
                                ` : '<span class="equipment-thumbnail-placeholder">📷</span>'}
                            </td>
                            <td><strong>${item.name}</strong></td>
                            <td>${item.type_name || 'Не вказано'}</td>
                            <td>${item.type_uav || '-'}</td>
                            <td>${item.status || 'active'}</td>
                            <td>
                                <button class="btn-primary btn-small" onclick="openEquipmentCard(${item.id})">Відкрити</button>
                                <button class="btn-secondary btn-small" onclick="editEquipment(${item.id})">Редагувати</button>
                                <button class="btn-danger btn-small" onclick="deleteEquipment(${item.id})">Видалити</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Перемикання режиму перегляду
function setEquipmentViewMode(mode) {
    equipmentViewMode = mode;
    localStorage.setItem('equipmentViewMode', mode);
    renderEquipment(equipmentList);
}

// Модальне вікно створення/редагування засобу
function showAddEquipmentModal(equipmentId = null) {
    const item = equipmentId ? equipmentList.find(e => e.id === equipmentId) : null;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addEquipmentModal';
    modal.innerHTML = `
        <div class="modal-content large-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">${item ? 'Редагувати засіб' : 'Додати засіб'}</div>
                <button class="close-btn" onclick="closeModal('addEquipmentModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addEquipmentForm" onsubmit="handleAddEquipment(event); return false;">
                    <input type="hidden" id="equipmentId" value="${item ? item.id : ''}">
                    <div class="form-group">
                        <label>Назва *</label>
                        <input type="text" id="equipmentName" required value="${item ? item.name : ''}">
                    </div>
                    <div class="form-group">
                        <label>Тип *</label>
                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                            <select id="equipmentType" required style="flex: 1;">
                                <option value="">Виберіть тип</option>
                                ${equipmentTypes.map(type => `
                                    <option value="${type.id}" ${item && item.type_id === type.id ? 'selected' : ''}>${type.name}</option>
                                `).join('')}
                            </select>
                            <button type="button" class="btn-secondary" onclick="showAddEquipmentTypeModal()" style="white-space: nowrap;">
                                ➕ Створити тип
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Тип / Тип БПЛА</label>
                        <input type="text" id="equipmentTypeUav" value="${item ? item.type_uav || '' : ''}" placeholder="Наприклад: DJI Mavic 3">
                    </div>
                    <div class="form-group">
                        <label>Фотографія</label>
                        <div class="file-upload-area" onclick="document.getElementById('equipmentPhotoInput').click()">
                            <p>Натисніть для вибору фото</p>
                            <input type="file" id="equipmentPhotoInput" style="display: none;" 
                                   accept="image/*" onchange="handleEquipmentPhotoSelect(event)">
                            <div id="equipmentPhotoPreview"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Примітки</label>
                        <textarea id="equipmentNotes" rows="3">${item ? item.notes || '' : ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Зберегти</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addEquipmentModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addEquipmentModal');
    };
    
    // Показати поточне фото якщо є
    if (item && (item.photo_path || item.photo_data)) {
        const preview = document.getElementById('equipmentPhotoPreview');
        preview.innerHTML = `
            <div class="file-preview">
                <img src="${item.photo_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(item.photo_data, 'image/jpeg') : (item.photo_data.startsWith('data:') ? item.photo_data : 'data:image/jpeg;base64,' + item.photo_data)) : item.photo_path}" style="max-width: 200px; max-height: 200px;">
            </div>
        `;
    }
}

// Обробка вибору фото
function handleEquipmentPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('equipmentPhotoPreview');
        preview.innerHTML = `
            <div class="file-preview">
                <img src="${e.target.result}" style="max-width: 200px; max-height: 200px;">
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

// Збереження засобу
async function handleAddEquipment(event) {
    event.preventDefault();
    
    const equipmentId = document.getElementById('equipmentId').value;
    const name = document.getElementById('equipmentName').value;
    const typeId = document.getElementById('equipmentType').value;
    const typeUav = document.getElementById('equipmentTypeUav').value;
    const notes = document.getElementById('equipmentNotes').value;
    const photoInput = document.getElementById('equipmentPhotoInput');
    
    if (!typeId) {
        showNotification('Виберіть тип засобу', 'error');
        return;
    }
    
    try {
        let photoData = null;
        if (photoInput && photoInput.files[0]) {
            const file = photoInput.files[0];
            if (USE_LOCAL_DB) {
                photoData = await fileToBase64(file);
            } else {
                photoData = await uploadFile(file);
            }
        }
        
        const equipmentData = {
            name: name,
            type_id: parseInt(typeId),
            type_uav: typeUav || null,
            photo_data: USE_LOCAL_DB ? photoData : null,
            photo_path: USE_LOCAL_DB ? null : photoData,
            notes: notes || null,
            status: 'active'
        };
        
        let response;
        if (equipmentId) {
            response = await api.updateEquipment(equipmentId, equipmentData);
        } else {
            response = await api.createEquipment(equipmentData);
        }
        
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addEquipmentModal');
            showNotification(equipmentId ? 'Засіб оновлено' : 'Засіб додано', 'success');
            // Миттєве оновлення даних в інтерфейсі
            await loadEquipment();
            // Якщо було редагування, закриваємо картку якщо вона відкрита
            const cardModal = document.getElementById('equipmentCardModal');
            if (cardModal && equipmentId) {
                closeModal('equipmentCardModal');
            }
        }
    } catch (error) {
        console.error('Error saving equipment:', error);
        showNotification(error.message || 'Помилка збереження засобу', 'error');
    }
}

// Редагування засобу
function editEquipment(equipmentId) {
    showAddEquipmentModal(equipmentId);
}

// Відкриття картки засобу
async function openEquipmentCard(equipmentId) {
    try {
        const item = equipmentList.find(e => e.id === equipmentId);
        if (!item) {
            showNotification('Засіб не знайдено', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'equipmentCardModal';
        modal.innerHTML = `
            <div class="modal-content large-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">Картка засобу: ${item.name}</div>
                    <button class="close-btn" onclick="closeModal('equipmentCardModal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="equipment-card-details">
                        ${item.photo_path || item.photo_data ? `
                            <div class="equipment-photo-large" style="text-align: center; margin-bottom: 20px;">
                                <img src="${item.photo_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(item.photo_data, 'image/jpeg') : (item.photo_data.startsWith('data:') ? item.photo_data : 'data:image/jpeg;base64,' + item.photo_data)) : item.photo_path}" 
                                     alt="${item.name}" 
                                     style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 2px solid var(--primary);">
                            </div>
                        ` : ''}
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Назва:</label>
                                <span>${item.name}</span>
                            </div>
                            <div class="info-item">
                                <label>Тип:</label>
                                <span>${item.type_name || 'Не вказано'}</span>
                            </div>
                            ${item.type_uav ? `
                                <div class="info-item">
                                    <label>Тип БПЛА:</label>
                                    <span>${item.type_uav}</span>
                                </div>
                            ` : ''}
                            <div class="info-item">
                                <label>Статус:</label>
                                <span>${item.status || 'active'}</span>
                            </div>
                            ${item.notes ? `
                                <div class="info-item">
                                    <label>Примітки:</label>
                                    <span>${item.notes}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="btn-primary" onclick="editEquipment(${item.id}); closeModal('equipmentCardModal');">Редагувати</button>
                        <button class="btn-secondary" onclick="closeModal('equipmentCardModal')">Закрити</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal('equipmentCardModal');
        };
    } catch (error) {
        console.error('Error opening equipment card:', error);
        showNotification('Помилка відкриття картки засобу', 'error');
    }
}

// Модальне вікно створення типу засобу
function showAddEquipmentTypeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'addEquipmentTypeModal';
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Створити тип засобу</div>
                <button class="close-btn" onclick="closeModal('addEquipmentTypeModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="addEquipmentTypeForm" onsubmit="handleAddEquipmentType(event); return false;">
                    <div class="form-group">
                        <label>Назва типу *</label>
                        <input type="text" id="equipmentTypeName" required placeholder="Наприклад: БПЛА, Пульт управління">
                    </div>
                    <div class="form-group">
                        <label>Опис (опціонально)</label>
                        <textarea id="equipmentTypeDescription" rows="3" placeholder="Опис типу засобу"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Створити</button>
                        <button type="button" class="btn-secondary" onclick="closeModal('addEquipmentTypeModal')">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal('addEquipmentTypeModal');
    };
}

// Збереження типу засобу
async function handleAddEquipmentType(event) {
    event.preventDefault();
    
    const name = document.getElementById('equipmentTypeName').value;
    const description = document.getElementById('equipmentTypeDescription').value;
    
    try {
        const typeData = {
            name: name,
            description: description
        };
        
        const response = await api.createEquipmentType(typeData);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            closeModal('addEquipmentTypeModal');
            showNotification('Тип засобу створено', 'success');
            // Оновлюємо список типів
            await loadEquipment();
            // Оновлюємо вибір типу в модальному вікні додавання засобу
            const typeSelect = document.getElementById('equipmentType');
            if (typeSelect) {
                const newOption = document.createElement('option');
                newOption.value = data.data.id;
                newOption.textContent = data.data.name;
                typeSelect.appendChild(newOption);
                typeSelect.value = data.data.id;
            }
        }
    } catch (error) {
        console.error('Error creating equipment type:', error);
        showNotification(error.message || 'Помилка створення типу засобу', 'error');
    }
}

// Видалення засобу
async function deleteEquipment(equipmentId) {
    if (!confirm('Ви впевнені, що хочете видалити цей засіб?')) {
        return;
    }
    
    try {
        const response = await api.deleteEquipment(equipmentId);
        const data = await api.handleResponse(response);
        
        if (data.success) {
            showNotification('Засіб видалено', 'success');
            loadEquipment();
        }
    } catch (error) {
        console.error('Error deleting equipment:', error);
        showNotification(error.message || 'Помилка видалення засобу', 'error');
    }
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.loadEquipment = loadEquipment;
    window.setEquipmentViewMode = setEquipmentViewMode;
    window.showAddEquipmentModal = showAddEquipmentModal;
    window.showAddEquipmentTypeModal = showAddEquipmentTypeModal;
    window.handleAddEquipment = handleAddEquipment;
    window.handleAddEquipmentType = handleAddEquipmentType;
    window.editEquipment = editEquipment;
    window.deleteEquipment = deleteEquipment;
    window.openEquipmentCard = openEquipmentCard;
    window.handleEquipmentPhotoSelect = handleEquipmentPhotoSelect;
    window.renderEquipment = renderEquipment;
    window.renderEquipmentGrid = renderEquipmentGrid;
    window.renderEquipmentList = renderEquipmentList;
    // formatDataUrl експортується в main.js
    // closeModal та showNotification експортуються в auth.js
}


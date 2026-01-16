// Засоби - управління засобами (БПЛА, обладнання)

let equipmentList = [];
let equipmentViewMode = localStorage.getItem('equipmentViewMode') || 'grid';
let equipmentTypes = [];

// Функція для екранування HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Завантаження засобів
 * @async
 */
async function loadEquipment() {
    const grid = typeof getCachedElement === 'function' 
        ? getCachedElement('equipmentGrid') 
        : document.getElementById('equipmentGrid');
    if (!grid) {
        console.error('equipmentGrid element not found');
        return;
    }

    // Показуємо skeleton loading
    grid.innerHTML = `
        <div class="skeleton-loading">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;
    
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
        if (grid) {
            grid.innerHTML = `<div class="empty-state error">${errorMessage}</div>`;
        }
        if (typeof showNotification === 'function') {
            showNotification(errorMessage, 'error');
        }
    }
}

/**
 * Відображення засобів
 * @param {Array} equipment - Масив засобів
 */
function renderEquipment(equipment) {
    const grid = typeof getCachedElement === 'function' 
        ? getCachedElement('equipmentGrid') 
        : document.getElementById('equipmentGrid');
    if (!grid) {
        console.error('equipmentGrid not found');
        return;
    }

    if (!equipment || !Array.isArray(equipment)) {
        grid.innerHTML = '<div class="empty-state">Помилка: некоректні дані засобів</div>';
        return;
    }

    if (equipment.length === 0) {
        grid.innerHTML = '<div class="empty-state">Засоби відсутні. Натисніть "Створити картку" для додавання засобу.</div>';
        return;
    }

    try {
        const equipmentHtml = `
            <div class="equipment-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                ${equipment.map(eq => {
                    const eqName = eq.name || 'Без назви';
                    const eqType = eq.type || eq.type_name || 'Не вказано';
                    const eqImage = eq.image_data || eq.photo_data || eq.image_path || '';
                    
                    return `
                        <div class="equipment-card" onclick="openEquipmentCard(${eq.id})" style="cursor: pointer; background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%); border: 2px solid var(--primary); border-radius: 12px; padding: 20px; transition: all 0.3s ease; position: relative; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);">
                            ${eqImage ? `
                                <div class="equipment-image" style="text-align: center; margin-bottom: 15px;">
                                    <img src="${eqImage.startsWith('data:') ? eqImage : (eqImage.startsWith('http') ? eqImage : 'data:image/jpeg;base64,' + eqImage)}" 
                                         alt="${escapeHtml(eqName)}" 
                                         style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--primary); object-fit: contain;">
                                </div>
                            ` : ''}
                            <h3 style="color: var(--primary); margin-bottom: 10px;">${escapeHtml(eqName)}</h3>
                            <p style="color: var(--text-light); margin: 5px 0;"><strong>Тип:</strong> ${escapeHtml(eqType)}</p>
                            ${eq.manufacturer ? `<p style="color: var(--text-light); margin: 5px 0;"><strong>Виробник:</strong> ${escapeHtml(eq.manufacturer)}</p>` : ''}
                            ${eq.notes ? `<p style="color: var(--text-muted); margin: 5px 0; font-size: 12px;">${escapeHtml(eq.notes.length > 100 ? eq.notes.substring(0, 100) + '...' : eq.notes)}</p>` : ''}
                            <div class="equipment-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                                <button class="btn-primary btn-small" onclick="event.stopPropagation(); editEquipment(${eq.id})">Редагувати</button>
                                <button class="btn-secondary btn-small" onclick="event.stopPropagation(); openEquipmentCard(${eq.id})">Деталі</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Використовуємо DocumentFragment для оптимізації
        if (typeof createFragmentFromHTML === 'function') {
            const fragment = createFragmentFromHTML(equipmentHtml);
            grid.innerHTML = '';
            grid.appendChild(fragment);
        } else {
            grid.innerHTML = equipmentHtml;
        }
    } catch (error) {
        console.error('Error rendering equipment:', error);
        grid.innerHTML = `<div class="empty-state">Помилка відображення засобів: ${error.message || 'невідома помилка'}</div>`;
    }
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
async function showAddEquipmentModal(equipmentId = null) {
    // Завантажуємо типи засобів якщо ще не завантажені
    if (equipmentTypes.length === 0) {
        try {
            const typesResponse = await api.getEquipmentTypes();
            const typesData = await api.handleResponse(typesResponse);
            equipmentTypes = typesData.data || [];
        } catch (e) {
            console.warn('Could not load equipment types:', e);
        }
    }
    
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
                                   accept="image/*" onchange="if (typeof handleEquipmentPhotoSelect === 'function') handleEquipmentPhotoSelect(event)">
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
    
    // Показати поточне фото якщо є (після додавання модального вікна в DOM)
    setTimeout(() => {
        if (item && (item.photo_path || item.photo_data)) {
            const preview = document.getElementById('equipmentPhotoPreview');
            if (preview) {
                preview.innerHTML = `
                    <div class="file-preview">
                        <img src="${item.photo_data ? (typeof formatDataUrl === 'function' ? formatDataUrl(item.photo_data, 'image/jpeg') : (item.photo_data.startsWith('data:') ? item.photo_data : 'data:image/jpeg;base64,' + item.photo_data)) : item.photo_path}" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--primary);">
                    </div>
                `;
            }
        }
    }, 100);
}

// Обробка вибору фото
function handleEquipmentPhotoSelect(event) {
    const file = event.target?.files?.[0];
    if (!file) {
        console.warn('No file selected');
        return;
    }
    
    // Перевіряємо тип файлу
    if (!file.type.startsWith('image/')) {
        showNotification('Виберіть файл зображення', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        // Оновлюємо preview в модальному вікні
        const preview = document.getElementById('equipmentPhotoPreview');
        if (preview) {
            preview.innerHTML = `
                <div class="file-preview" style="margin-top: 15px;">
                    <img src="${imageData}" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--primary); object-fit: contain;">
                    <p style="color: var(--text-muted); font-size: 12px; margin-top: 5px;">Фото вибрано</p>
                </div>
            `;
        }
        // Також оновлюємо preview в формі на сторінці (якщо вона видима)
        const imagePreview = document.getElementById('equipmentImagePreview');
        if (imagePreview) {
            imagePreview.src = imageData;
            imagePreview.style.display = 'block';
        }
    };
    reader.onerror = () => {
        showNotification('Помилка читання файлу', 'error');
    };
    reader.readAsDataURL(file);
}

// Аліас для сумісності з HTML
function handleEquipmentImageUpload(event) {
    handleEquipmentPhotoSelect(event);
}

// Збереження засобу
async function handleAddEquipment(event) {
    event.preventDefault();
    
    const equipmentId = document.getElementById('equipmentId')?.value || '';
    const name = document.getElementById('equipmentName')?.value || '';
    const typeSelect = document.getElementById('equipmentType');
    const typeId = typeSelect ? typeSelect.value : '';
    const typeUav = document.getElementById('equipmentTypeUav')?.value || '';
    const notes = document.getElementById('equipmentNotes')?.value || '';
    const photoInput = document.getElementById('equipmentPhotoInput');
    
    // Перевіряємо чи вибрано тип
    if (!typeId || typeId === '' || typeId === '0') {
        showNotification('Виберіть тип засобу', 'error');
        if (typeSelect) {
            typeSelect.focus();
        }
        return;
    }
    
    try {
        let photoData = null;
        if (photoInput && photoInput.files[0]) {
            const file = photoInput.files[0];
            // Функція для конвертації файлу в base64
            const fileToBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };
            
            // Перевіряємо чи використовується локальна БД
            const useLocalDb = typeof window !== 'undefined' && window.USE_LOCAL_DB === true;
            if (useLocalDb) {
                photoData = await fileToBase64(file);
            } else if (typeof uploadFile === 'function') {
                photoData = await uploadFile(file);
            } else {
                // Fallback - конвертуємо в base64
                photoData = await fileToBase64(file);
            }
        }
        
        const useLocalDb = typeof window !== 'undefined' && window.USE_LOCAL_DB === true;
        const equipmentData = {
            name: name,
            type_id: parseInt(typeId),
            type_uav: typeUav || null,
            photo_data: useLocalDb ? photoData : null,
            photo_path: useLocalDb ? null : photoData,
            notes: notes || null,
            status: 'active'
        };
        
        let response;
        if (equipmentId) {
            response = await api.updateEquipment(parseInt(equipmentId), equipmentData);
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
        } else {
            showNotification(data.message || 'Помилка збереження засобу', 'error');
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
    window.handleEquipmentImageUpload = handleEquipmentImageUpload;
    window.handleEquipmentPhotoSelect = handleEquipmentPhotoSelect;
    
    // Показуємо форму в модальному вікні замість прямо на сторінці
    const originalShowAddEquipmentModal = showAddEquipmentModal;
    window.showAddEquipmentModal = async function(equipmentId = null) {
        // Приховуємо форму на сторінці якщо вона видима
        const formCard = document.getElementById('equipmentFormCard');
        if (formCard) {
            formCard.style.display = 'none';
        }
        // Показуємо модальне вікно
        await originalShowAddEquipmentModal(equipmentId);
    };
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


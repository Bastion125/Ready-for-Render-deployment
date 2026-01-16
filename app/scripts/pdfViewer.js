// PDF Viewer компонент для перегляду PDF в браузері
// Використовує PDF.js

let pdfjsLib = null;
let currentPdf = null;

// Ініціалізація PDF.js
async function initPDFJS() {
    if (pdfjsLib && typeof pdfjsLib.getDocument === 'function') {
        return pdfjsLib;
    }
    
    // Перевірка, чи вже завантажено
    if (typeof window !== 'undefined' && window.pdfjsLib) {
        pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return pdfjsLib;
    }
    
    // Завантаження PDF.js з CDN
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib) {
                pdfjsLib = window.pdfjsLib;
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(pdfjsLib);
            } else {
                reject(new Error('PDF.js не завантажився'));
            }
        };
        script.onerror = () => reject(new Error('Помилка завантаження PDF.js'));
        document.head.appendChild(script);
    });
}

// Глобальні змінні для PDF viewer
let pdfViewerState = {
    currentPage: 1,
    zoom: 1.0,
    pdf: null,
    modal: null
};

// Глобальні функції для навігації (створюються завчасно)
window.previousPage = async function() {
    if (pdfViewerState.pdf && pdfViewerState.currentPage > 1) {
        pdfViewerState.currentPage--;
        await renderPDFPage(pdfViewerState.currentPage);
    }
};

window.nextPage = async function() {
    if (pdfViewerState.pdf && pdfViewerState.currentPage < pdfViewerState.pdf.numPages) {
        pdfViewerState.currentPage++;
        await renderPDFPage(pdfViewerState.currentPage);
    }
};

window.zoomIn = async function() {
    if (pdfViewerState.pdf) {
        pdfViewerState.zoom = Math.min(pdfViewerState.zoom + 0.25, 3.0);
        const zoomInfo = document.getElementById('zoomInfo');
        if (zoomInfo) zoomInfo.textContent = Math.round(pdfViewerState.zoom * 100) + '%';
        await renderPDFPage(pdfViewerState.currentPage);
    }
};

window.zoomOut = async function() {
    if (pdfViewerState.pdf) {
        pdfViewerState.zoom = Math.max(pdfViewerState.zoom - 0.25, 0.5);
        const zoomInfo = document.getElementById('zoomInfo');
        if (zoomInfo) zoomInfo.textContent = Math.round(pdfViewerState.zoom * 100) + '%';
        await renderPDFPage(pdfViewerState.currentPage);
    }
};

window.closePDFViewer = function() {
    if (pdfViewerState.modal) {
        document.body.removeChild(pdfViewerState.modal);
        pdfViewerState.modal = null;
    }
    pdfViewerState.pdf = null;
    pdfViewerState.currentPage = 1;
    pdfViewerState.zoom = 1.0;
};

// Функція відображення сторінки
async function renderPDFPage(pageNum) {
    if (!pdfViewerState.pdf || !pdfjsLib) return;
    
    try {
        const page = await pdfViewerState.pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: pdfViewerState.zoom });
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Оновлення інформації про сторінку
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Сторінка ${pageNum} з ${pdfViewerState.pdf.numPages}`;
        }
        
        // Оновлення кнопок
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.disabled = pageNum <= 1;
        if (nextBtn) nextBtn.disabled = pageNum >= pdfViewerState.pdf.numPages;
    } catch (error) {
        console.error('Помилка відображення сторінки:', error);
    }
}

// Відкриття PDF в модальному вікні
async function openPDFViewer(pdfUrl, title = 'PDF Документ') {
    try {
        await initPDFJS();
        
        if (!pdfjsLib || typeof pdfjsLib.getDocument !== 'function') {
            throw new Error('PDF.js не ініціалізовано');
        }
        
        // Створення модального вікна
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'pdfViewerModal';
        modal.innerHTML = `
            <div class="modal-content pdf-viewer-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">${title}</div>
                    <button class="close-btn" onclick="closePDFViewer()">✕</button>
                </div>
                <div class="pdf-viewer-controls">
                    <button class="btn-secondary" onclick="previousPage()" id="prevBtn">← Попередня</button>
                    <span id="pageInfo">Сторінка 1 з 1</span>
                    <button class="btn-secondary" onclick="nextPage()" id="nextBtn">Наступна →</button>
                    <button class="btn-secondary" onclick="zoomOut()" id="zoomOutBtn">-</button>
                    <span id="zoomInfo">100%</span>
                    <button class="btn-secondary" onclick="zoomIn()" id="zoomInBtn">+</button>
                </div>
                <div class="pdf-viewer-container">
                    <canvas id="pdfCanvas"></canvas>
                </div>
                <div class="pdf-viewer-loading" id="pdfLoading">Завантаження PDF...</div>
            </div>
        `;
        
        document.body.appendChild(modal);
        pdfViewerState.modal = modal;
        
        // Закриття при кліку на overlay
        modal.onclick = (e) => {
            if (e.target === modal) {
                closePDFViewer();
            }
        };
        
        const loadingDiv = document.getElementById('pdfLoading');
        
        // Завантаження PDF
        // Обробка різних форматів URL
        let pdfUrlToLoad = pdfUrl;
        if (pdfUrl.startsWith('data:')) {
            // Data URL - використовуємо як є
            pdfUrlToLoad = pdfUrl;
        } else if (pdfUrl.startsWith('http') || pdfUrl.startsWith('/')) {
            // HTTP URL або абсолютний шлях
            pdfUrlToLoad = pdfUrl;
        } else {
            // Можливо base64 без префіксу
            if (!pdfUrl.includes('/') && !pdfUrl.includes('.')) {
                pdfUrlToLoad = `data:application/pdf;base64,${pdfUrl}`;
            } else {
                pdfUrlToLoad = pdfUrl;
            }
        }
        
        const loadingTask = pdfjsLib.getDocument({
            url: pdfUrlToLoad,
            httpHeaders: {},
            withCredentials: false
        });
        pdfViewerState.pdf = await loadingTask.promise;
        pdfViewerState.currentPage = 1;
        pdfViewerState.zoom = 1.0;
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        // Початкове відображення
        await renderPDFPage(1);
        
    } catch (error) {
        console.error('Помилка завантаження PDF:', error);
        const loadingDiv = document.getElementById('pdfLoading');
        if (loadingDiv) {
            loadingDiv.textContent = 'Помилка завантаження PDF: ' + error.message;
        }
        showNotification('Помилка завантаження PDF: ' + error.message, 'error');
    }
}

// Відкриття PDF з матеріалу Бази знань
async function openKnowledgePDF(materialId) {
    // Отримання URL PDF з матеріалу
    // Тут потрібно отримати file_path або file_data з матеріалу
    const material = await getMaterialById(materialId);
    
    if (material.material_type !== 'pdf') {
        showNotification('Це не PDF файл', 'error');
        return;
    }
    
    let pdfUrl = material.file_path;
    
    // Якщо файл в БД як BLOB, створюємо URL
    if (material.file_data) {
        const blob = new Blob([material.file_data], { type: 'application/pdf' });
        pdfUrl = URL.createObjectURL(blob);
    }
    
    await openPDFViewer(pdfUrl, material.title);
}

// Експорт глобально
if (typeof window !== 'undefined') {
    window.openPDFViewer = openPDFViewer;
    window.openKnowledgePDF = openKnowledgePDF;
    // closeModal та showNotification експортуються в auth.js
}

// Експорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openPDFViewer,
        openKnowledgePDF
    };
}





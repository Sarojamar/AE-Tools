/**
 * BGrade Pro ID Card Printer - Single-View Dashboard Logic (Reference layout)
 * 100% Client-Side Processing, Privacy-First ID card formatter and print sheets generator.
 */

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application State
var state = {
    // Array of card sets
    savedCards: [], // { id, name, frontSource, backSource, frontImg, backImg, frontCrop, backCrop, frontFilters, backFilters, frontPreset, backPreset }
    
    // Page Queue
    pages: [[]], // Array of arrays containing cardSet IDs: [ [id1, id2], [id3] ]
    currentPageIndex: 0,

    // Selection
    selectedCardId: null,
    selectedSide: 'front', // 'front' or 'back'

    // Draft uploads
    draftFrontSource: null,
    draftBackSource: null,
    draftFrontImg: null,
    draftBackImg: null,

    // Settings
    singleSideMode: false,
    sheetSettings: {
        layout: 'side-by-side', // stacked, side-by-side, pvc, custom
        margin: 10, // mm
        gap: 6, // mm
        rowGap: 6, // mm
        showCropMarks: true,
        border: true,
        roundedCorners: true
    },
    zoom: 1.1,
    currentCropper: {
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        startX: 0,
        startY: 0,
        startBox: { x: 0, y: 0, w: 0, h: 0 }
    }
};

// Standard Card Sizing
var CARD_RATIO = 85.6 / 54;
var A4_WIDTH_MM = 210;
var A4_HEIGHT_MM = 297;
var A4_PX_PER_MM = 595 / A4_WIDTH_MM; // ~2.833 px/mm

// DOM Elements
var toastContainer;
var a4Page;
var cropPanel;

// Global error logging for BGrade ID Card Printer diagnostics
window.onerror = function(message, source, lineno, colno, error) {
    const errText = `${message} at ${source}:${lineno}`;
    console.error(errText);
    if (typeof showToast === 'function') {
        showToast(errText, 'error');
    } else {
        alert(errText);
    }
    return false;
};

// Page Load - called by React useEffect after DOM mount
window.__bgradeIdCardInit = function() {
    toastContainer = document.getElementById('toast-container');
    a4Page = document.getElementById('a4-page');
    cropPanel = document.getElementById('crop-editor-panel');

    setupEventListeners();
    autoFitZoom();
    renderA4Sheet();
    
    window.addEventListener('resize', () => {
        autoFitZoom();
        if (cropPanel && cropPanel.classList.contains('open')) {
            const card = getSelectedCard();
            if (card) {
                setupCropperViewport(card, state.selectedSide);
            }
        }
    });
};

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconClass = 'ph ph-info';
    if (type === 'success') iconClass = 'ph ph-check-circle';
    if (type === 'error') iconClass = 'ph ph-warning-circle';
    
    toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Event Listeners Setup
function setupEventListeners() {
    // Layout selector buttons
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const layout = btn.dataset.type;
            state.sheetSettings.layout = layout;

            // Update presets
            if (layout === 'stacked') {
                state.sheetSettings.margin = 10;
                state.sheetSettings.gap = 5;
                state.sheetSettings.rowGap = 5;
            } else if (layout === 'side-by-side') {
                state.sheetSettings.margin = 10;
                state.sheetSettings.gap = 6;
                state.sheetSettings.rowGap = 6;
            } else if (layout === 'pvc') {
                state.sheetSettings.margin = 10;
                state.sheetSettings.gap = 10;
                state.sheetSettings.rowGap = 10;
            }

            // Sync layout form inputs
            document.getElementById('sheet-margin').value = state.sheetSettings.margin;
            document.getElementById('sheet-margin-val').innerText = `${state.sheetSettings.margin}mm`;
            document.getElementById('card-gap').value = state.sheetSettings.gap;
            document.getElementById('card-gap-val').innerText = `${state.sheetSettings.gap}mm`;
            document.getElementById('card-gap-y').value = state.sheetSettings.rowGap;
            document.getElementById('card-gap-y-val').innerText = `${state.sheetSettings.rowGap}mm`;

            renderA4Sheet();
        });
    });

    // card-layout-type dropdown removed as redundant with type-btn buttons

    // Single Side Mode toggle
    document.getElementById('single-side-mode').addEventListener('change', (e) => {
        state.singleSideMode = e.target.checked;
        renderA4Sheet();
    });

    // Margins and settings sliders
    document.getElementById('sheet-margin').addEventListener('input', (e) => {
        state.sheetSettings.margin = parseInt(e.target.value);
        document.getElementById('sheet-margin-val').innerText = `${e.target.value}mm`;
        renderA4Sheet();
    });
    document.getElementById('card-gap').addEventListener('input', (e) => {
        state.sheetSettings.gap = parseInt(e.target.value);
        document.getElementById('card-gap-val').innerText = `${e.target.value}mm`;
        renderA4Sheet();
    });
    document.getElementById('card-gap-y').addEventListener('input', (e) => {
        state.sheetSettings.rowGap = parseInt(e.target.value);
        document.getElementById('card-gap-y-val').innerText = `${e.target.value}mm`;
        renderA4Sheet();
    });

    // Checkboxes
    ['show-crop-marks', 'card-border', 'rounded-corners'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                let key;
                if (id === 'card-border') key = 'border';
                else key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
                state.sheetSettings[key] = e.target.checked;
                renderA4Sheet();
            });
        }
    });

    // Page Queue events
    document.getElementById('btn-add-page').addEventListener('click', addPageToQueue);
    document.getElementById('btn-delete-page').addEventListener('click', deleteActivePage);

    // Zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        state.zoom = Math.min(1.2, state.zoom + 0.1);
        updateZoom();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        state.zoom = Math.max(0.3, state.zoom - 0.1);
        updateZoom();
    });

    // Active Card Editor sliders
    ['brightness', 'contrast', 'saturate'].forEach(filter => {
        const slider = document.getElementById(`slider-${filter}`);
        if (slider) {
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                document.getElementById(`val-${filter}`).innerText = `${val}%`;
                
                const card = getSelectedCard();
                if (!card) return;

                const filters = state.selectedSide === 'front' ? card.frontFilters : card.backFilters;
                filters[filter] = val;

                // Live draw updates during dragging
                drawEditorImage(card, state.selectedSide);
                drawCardLive(card, state.selectedSide);
            });

            slider.addEventListener('change', () => {
                const card = getSelectedCard();
                if (card) {
                    updateCardPreviewAndSheet();
                }
            });
        }
    });

    // Active Editor Presets
    document.getElementById('btn-preset-cr80').addEventListener('click', () => setCropPreset('cr80'));
    document.getElementById('btn-preset-aadhaar-front').addEventListener('click', () => setCropPreset('aadhaar-front'));
    document.getElementById('btn-preset-aadhaar-back').addEventListener('click', () => setCropPreset('aadhaar-back'));
    document.getElementById('btn-preset-pan').addEventListener('click', () => setCropPreset('pan'));
    document.getElementById('btn-preset-custom').addEventListener('click', () => setCropPreset('custom'));

    // Active Editor Filters
    document.getElementById('btn-filter-none').addEventListener('click', () => setDocFilter('none'));
    document.getElementById('btn-filter-document').addEventListener('click', () => setDocFilter('document'));
    document.getElementById('btn-filter-mono').addEventListener('click', () => setDocFilter('mono'));
    document.getElementById('btn-filter-enhance').addEventListener('click', () => setDocFilter('enhance'));
    document.getElementById('btn-filter-invert').addEventListener('click', () => setDocFilter('invert'));

    // Active Editor rotators & transforms
    document.getElementById('btn-rotate-ccw').addEventListener('click', () => rotateActiveImage(-90));
    document.getElementById('btn-rotate-cw').addEventListener('click', () => rotateActiveImage(90));
    document.getElementById('btn-flip-h').addEventListener('click', () => flipActiveImage('horizontal'));
    document.getElementById('btn-flip-v').addEventListener('click', () => flipActiveImage('vertical'));
    document.getElementById('btn-center-crop').addEventListener('click', centerActiveCrop);
    document.getElementById('btn-reset-filters').addEventListener('click', resetActiveFilters);

    // Maximize screen toggle
    document.getElementById('btn-maximize-editor').addEventListener('click', () => {
        cropPanel.classList.toggle('maximized');
        const icon = document.querySelector('#btn-maximize-editor i');
        if (cropPanel.classList.contains('maximized')) {
            icon.className = 'ph ph-corners-in';
        } else {
            icon.className = 'ph ph-corners-out';
        }
        const card = getSelectedCard();
        if (card) {
            setupCropperViewport(card, state.selectedSide);
        }
    });

    document.getElementById('btn-maximize-editor-body').addEventListener('click', () => {
        document.getElementById('btn-maximize-editor').click();
    });

    // Crop Nudge D-Pad actions
    const handleNudge = (action) => {
        const card = getSelectedCard();
        if (!card) return;
        const side = state.selectedSide;
        const crop = side === 'front' ? card.frontCrop : card.backCrop;
        const img = side === 'front' ? card.frontImg : card.backImg;
        if (!img || !crop) return;

        const step = 0.005; // 0.5% fine step
        if (action === 'up') {
            crop.y = Math.max(0, crop.y - step);
        } else if (action === 'down') {
            crop.y = Math.min(1 - crop.h, crop.y + step);
        } else if (action === 'left') {
            crop.x = Math.max(0, crop.x - step);
        } else if (action === 'right') {
            crop.x = Math.min(1 - crop.w, crop.x + step);
        } else if (action === 'grow') {
            const newW = Math.min(1 - crop.x, crop.w + step * 2);
            const newH = newW / CARD_RATIO;
            if (crop.y + newH <= 1) {
                crop.w = newW;
                crop.h = newH;
            }
        } else if (action === 'shrink') {
            const newW = Math.max(0.1, crop.w - step * 2);
            const newH = newW / CARD_RATIO;
            crop.w = newW;
            crop.h = newH;
        }

        drawCardLive(card, side);
        updateCardPreviewAndSheet();

        const viewport = document.getElementById('editor-viewport');
        const container = viewport.querySelector('div');
        if (container) {
            createCropBoxOverlay(container, card, side);
        }
    };

    document.getElementById('btn-nudge-up').addEventListener('click', () => handleNudge('up'));
    document.getElementById('btn-nudge-down').addEventListener('click', () => handleNudge('down'));
    document.getElementById('btn-nudge-left').addEventListener('click', () => handleNudge('left'));
    document.getElementById('btn-nudge-right').addEventListener('click', () => handleNudge('right'));
    document.getElementById('btn-nudge-grow').addEventListener('click', () => handleNudge('grow'));
    document.getElementById('btn-nudge-shrink').addEventListener('click', () => handleNudge('shrink'));

    // Apply adjustments
    document.getElementById('btn-apply-editor').addEventListener('click', closeEditorPanel);
    document.getElementById('btn-close-editor').addEventListener('click', closeEditorPanel);
    
    const backdrop = document.getElementById('editor-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', closeEditorPanel);
    }

    // Delete Active Card
    document.getElementById('btn-delete-card-active').addEventListener('click', deleteActiveCardSet);

    // Reset layout sheet
    document.getElementById('btn-reset-sheet').addEventListener('click', () => {
        if (confirm('Clear the entire layout sheet queue?')) {
            state.savedCards = [];
            state.pages = [[]];
            state.currentPageIndex = 0;
            closeEditorPanel();
            renderA4Sheet();
            showToast('Workspace reset', 'info');
        }
    });

    // Export actions
    document.getElementById('btn-print-sheet').addEventListener('click', () => {
        if (window.BGradeAnalytics) {
            window.BGradeAnalytics.logAction('print', `Pages: ${state.pages.length}`, 'id_card_printer');
        }
        window.print();
    });
    document.getElementById('btn-download-pdf').addEventListener('click', downloadPDF);
    document.getElementById('btn-download-jpg').addEventListener('click', downloadJPG);

    // Double click header to maximize
    const panelHeader = document.querySelector('.slidepanel-header');
    if (panelHeader) {
        panelHeader.addEventListener('dblclick', () => {
            const btn = document.getElementById('btn-maximize-editor');
            if (btn) btn.click();
        });
    }

    // Keyboard Shortcuts for Nudging Crop Box
    document.addEventListener('keydown', (e) => {
        // Only trigger if editor panel is open
        if (!cropPanel.classList.contains('open')) return;
        
        // Prevent scroll when using arrow keys inside the editor
        const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-'];
        if (keysToPrevent.includes(e.key)) {
            // Check if focused on an input range/text to avoid blocking normal typing
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
        }

        const step = e.shiftKey ? 0.02 : 0.005; // larger step if shift is held
        const card = getSelectedCard();
        if (!card) return;
        const side = state.selectedSide;
        const crop = side === 'front' ? card.frontCrop : card.backCrop;
        if (!crop) return;

        if (e.key === 'ArrowUp') {
            crop.y = Math.max(0, crop.y - step);
        } else if (e.key === 'ArrowDown') {
            crop.y = Math.min(1 - crop.h, crop.y + step);
        } else if (e.key === 'ArrowLeft') {
            crop.x = Math.max(0, crop.x - step);
        } else if (e.key === 'ArrowRight') {
            crop.x = Math.min(1 - crop.w, crop.x + step);
        } else if (e.key === '+' || e.key === '=') {
            const newW = Math.min(1 - crop.x, crop.w + step * 2);
            const newH = newW / CARD_RATIO;
            if (crop.y + newH <= 1) {
                crop.w = newW;
                crop.h = newH;
            }
        } else if (e.key === '-' || e.key === '_') {
            const newW = Math.max(0.1, crop.w - step * 2);
            const newH = newW / CARD_RATIO;
            crop.w = newW;
            crop.h = newH;
        } else {
            return; // Exit if not nudge key
        }

        drawCardLive(card, side);
        updateCardPreviewAndSheet();

        const viewport = document.getElementById('editor-viewport');
        const container = viewport.querySelector('div');
        if (container) {
            createCropBoxOverlay(container, card, side);
        }
    });
}

// Setup drag and drop elements
var LAYOUT_LIMITS = {
    'stacked': 4,
    'side-by-side': 5,
    'pvc': 1,
    'custom': 4
};

function getSelectedCard() {
    return state.savedCards.find(c => c.id === state.selectedCardId);
}

// ─── FILE UPLOAD PIPELINE FOR SLOTS ──────────────────────────────────

async function handleSlotUpload(file, cardId, side) {
    showToast(`Reading ${side} document...`, 'info');
    try {
        if (file.type === 'application/pdf') {
            await handlePDFUploadForSlot(file, cardId, side);
        } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                const img = new Image();
                img.onload = () => {
                    commitSlotUpload(cardId, side, dataUrl, img);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        } else {
            showToast('Format not supported. Please upload a PDF or image scan.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error uploading file: ' + e.message, 'error');
    }
}

async function handlePDFUploadForSlot(file, cardId, side) {
    const fileReader = new FileReader();
    const loadPromise = new Promise((resolve, reject) => {
        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                
                // Page 1 -> Target side
                const page1 = await pdf.getPage(1);
                const source1 = await renderPDFPageToDataUrl(page1);
                const img1 = await loadImgAsync(source1);
                
                // Page 2 -> Other side (if exists)
                if (pdf.numPages >= 2) {
                    const page2 = await pdf.getPage(2);
                    const source2 = await renderPDFPageToDataUrl(page2);
                    const img2 = await loadImgAsync(source2);
                    
                    commitSlotUploadPDFDouble(cardId, side, source1, img1, source2, img2);
                    showToast('PDF pages split successfully into Front & Back', 'success');
                } else {
                    commitSlotUpload(cardId, side, source1, img1);
                    showToast('PDF page loaded successfully', 'success');
                }
                resolve();
            } catch (e) {
                reject(e);
            }
        };
        fileReader.onerror = reject;
    });
    fileReader.readAsArrayBuffer(file);
    await loadPromise;
}

function commitSlotUpload(cardId, side, dataUrl, img) {
    if (window.BGradeAnalytics) {
        window.BGradeAnalytics.logAction('upload', 'CR80 Slot Upload: ' + side, 'id_card_printer');
    }

    const getDefCrop = (img) => {
        if (!img) return null;
        let w = 0.85;
        let h = w * (img.width / img.height) / CARD_RATIO;
        if (h > 0.85) {
            h = 0.85;
            w = h * CARD_RATIO / (img.width / img.height);
        }
        return { x: (1 - w) / 2, y: (1 - h) / 2, w: w, h: h };
    };

    let cardSet;
    if (cardId === 'placeholder') {
        const newCardId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
        const cardName = `Card Set #${state.savedCards.length + 1}`;
        
        cardSet = {
            id: newCardId,
            name: cardName,
            frontSource: side === 'front' ? dataUrl : null,
            backSource: side === 'back' ? dataUrl : null,
            frontImg: side === 'front' ? img : null,
            backImg: side === 'back' ? img : null,
            frontRotation: 0,
            backRotation: 0,
            frontFlipH: false,
            frontFlipV: false,
            backFlipH: false,
            backFlipV: false,
            frontCrop: side === 'front' ? getDefCrop(img) : null,
            backCrop: side === 'back' ? getDefCrop(img) : null,
            frontPreset: 'cr80',
            backPreset: 'cr80',
            frontFilters: { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' },
            backFilters: { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' },
            frontCroppedData: null,
            backCroppedData: null
        };

        if (side === 'front') {
            cardSet.frontCroppedData = cacheCropCanvas(cardSet, 'front');
        } else {
            cardSet.backCroppedData = cacheCropCanvas(cardSet, 'back');
        }

        state.savedCards.push(cardSet);
        state.pages[state.currentPageIndex].push(newCardId);
        state.selectedCardId = newCardId;
        state.selectedSide = side;
        
        showToast(`${cardName} added!`);
    } else {
        cardSet = state.savedCards.find(c => c.id === cardId);
        if (cardSet) {
            cardSet[`${side}Source`] = dataUrl;
            cardSet[`${side}Img`] = img;
            cardSet[`${side}Crop`] = getDefCrop(img);
            cardSet[`${side}Rotation`] = 0;
            cardSet[`${side}FlipH`] = false;
            cardSet[`${side}FlipV`] = false;
            cardSet[`${side}Preset`] = 'cr80';
            cardSet[`${side}Filters`] = { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' };
            cardSet[`${side}CroppedData`] = cacheCropCanvas(cardSet, side);
            
            state.selectedCardId = cardId;
            state.selectedSide = side;
            
            showToast(`Updated ${cardSet.name} ${side} side`, 'success');
        }
    }

    renderA4Sheet();
    updateQueueCardsList();
    updateEditorPanel();
}

function commitSlotUploadPDFDouble(cardId, side, dataUrl1, img1, dataUrl2, img2) {
    if (window.BGradeAnalytics) {
        window.BGradeAnalytics.logAction('upload', 'PDF Double Page Upload', 'id_card_printer');
    }

    const getDefCrop = (img) => {
        if (!img) return null;
        let w = 0.85;
        let h = w * (img.width / img.height) / CARD_RATIO;
        if (h > 0.85) {
            h = 0.85;
            w = h * CARD_RATIO / (img.width / img.height);
        }
        return { x: (1 - w) / 2, y: (1 - h) / 2, w: w, h: h };
    };

    let cardSet;
    const side1 = side;
    const side2 = side === 'front' ? 'back' : 'front';

    if (cardId === 'placeholder') {
        const newCardId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
        const cardName = `Card Set #${state.savedCards.length + 1}`;
        
        cardSet = {
            id: newCardId,
            name: cardName,
            frontSource: side1 === 'front' ? dataUrl1 : dataUrl2,
            backSource: side1 === 'back' ? dataUrl1 : dataUrl2,
            frontImg: side1 === 'front' ? img1 : img2,
            backImg: side1 === 'back' ? img1 : img2,
            frontRotation: 0,
            backRotation: 0,
            frontFlipH: false,
            frontFlipV: false,
            backFlipH: false,
            backFlipV: false,
            frontCrop: side1 === 'front' ? getDefCrop(img1) : getDefCrop(img2),
            backCrop: side1 === 'back' ? getDefCrop(img1) : getDefCrop(img2),
            frontPreset: 'cr80',
            backPreset: 'cr80',
            frontFilters: { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' },
            backFilters: { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' },
            frontCroppedData: null,
            backCroppedData: null
        };

        cardSet.frontCroppedData = cacheCropCanvas(cardSet, 'front');
        cardSet.backCroppedData = cacheCropCanvas(cardSet, 'back');

        state.savedCards.push(cardSet);
        state.pages[state.currentPageIndex].push(newCardId);
        state.selectedCardId = newCardId;
        state.selectedSide = side1;
        
        showToast(`${cardName} added!`);
    } else {
        cardSet = state.savedCards.find(c => c.id === cardId);
        if (cardSet) {
            cardSet[`${side1}Source`] = dataUrl1;
            cardSet[`${side1}Img`] = img1;
            cardSet[`${side1}Crop`] = getDefCrop(img1);
            cardSet[`${side1}Rotation`] = 0;
            cardSet[`${side1}FlipH`] = false;
            cardSet[`${side1}FlipV`] = false;
            cardSet[`${side1}Preset`] = 'cr80';
            cardSet[`${side1}Filters`] = { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' };
            cardSet[`${side1}CroppedData`] = cacheCropCanvas(cardSet, side1);

            cardSet[`${side2}Source`] = dataUrl2;
            cardSet[`${side2}Img`] = img2;
            cardSet[`${side2}Crop`] = getDefCrop(img2);
            cardSet[`${side2}Rotation`] = 0;
            cardSet[`${side2}FlipH`] = false;
            cardSet[`${side2}FlipV`] = false;
            cardSet[`${side2}Preset`] = 'cr80';
            cardSet[`${side2}Filters`] = { brightness: 100, contrast: 100, saturate: 100, filterType: 'none' };
            cardSet[`${side2}CroppedData`] = cacheCropCanvas(cardSet, side2);

            state.selectedCardId = cardId;
            state.selectedSide = side1;
            
            showToast(`Updated ${cardSet.name} Front & Back`, 'success');
        }
    }

    renderA4Sheet();
    updateQueueCardsList();
    updateEditorPanel();
}

function setupSlotDragAndDrop(slotEl, cardId, side) {
    ['dragenter', 'dragover'].forEach(eventName => {
        slotEl.addEventListener(eventName, (e) => {
            e.preventDefault();
            slotEl.classList.add('dragover');
        }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        slotEl.addEventListener(eventName, (e) => {
            e.preventDefault();
            slotEl.classList.remove('dragover');
        }, false);
    });
    slotEl.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSlotUpload(files[0], cardId, side);
        }
    });
}

function openEditorForSlot(cardId, side) {
    state.selectedCardId = cardId;
    state.selectedSide = side;
    renderA4Sheet();
    updateQueueCardsList();
    updateEditorPanel();
    toggleEditorModal(true);
}

function rotateSlotCard(cardId, side) {
    const card = state.savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    if (side === 'front') {
        card.frontRotation = ((card.frontRotation || 0) + 90) % 360;
        card.frontCroppedData = cacheCropCanvas(card, 'front');
    } else {
        card.backRotation = ((card.backRotation || 0) + 90) % 360;
        card.backCroppedData = cacheCropCanvas(card, 'back');
    }
    
    renderA4Sheet();
    updateEditorPanel();
    showToast('Rotated side 90°');
}

function deleteSlotCard(cardId, side) {
    const card = state.savedCards.find(c => c.id === cardId);
    if (!card) return;

    if (confirm(`Clear this card's ${side} side?`)) {
        card[`${side}Source`] = null;
        card[`${side}Img`] = null;
        card[`${side}Crop`] = null;
        card[`${side}CroppedData`] = null;

        if (!card.frontSource && !card.backSource) {
            state.savedCards = state.savedCards.filter(c => c.id !== cardId);
            state.pages[state.currentPageIndex] = state.pages[state.currentPageIndex].filter(id => id !== cardId);
            
            state.savedCards.forEach((c, idx) => {
                c.name = `Card Set #${idx + 1}`;
            });

            if (state.selectedCardId === cardId) {
                state.selectedCardId = null;
                closeEditorPanel();
            }
        } else {
            if (state.selectedCardId === cardId && state.selectedSide === side) {
                state.selectedSide = side === 'front' ? 'back' : 'front';
            }
        }

        renderA4Sheet();
        updateQueueCardsList();
        updateEditorPanel();
        showToast(`Cleared ${side} side`);
    }
}

// Cache cropped canvas to Base64
function cacheCropCanvas(card, side) {
    const img = side === 'front' ? card.frontImg : card.backImg;
    if (!img) return null;

    const crop = side === 'front' ? card.frontCrop : card.backCrop;
    const filters = side === 'front' ? card.frontFilters : card.backFilters;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width;
    srcCanvas.height = img.height;
    const sCtx = srcCanvas.getContext('2d');
    sCtx.drawImage(img, 0, 0);

    let filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
    sCtx.save();
    sCtx.filter = filterString;
    sCtx.drawImage(srcCanvas, 0, 0);
    sCtx.restore();

    if (filters.filterType === 'document' || filters.filterType === 'mono' || filters.filterType === 'invert') {
        const imgData = sCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
        applyDocScanFilter(imgData, filters.filterType === 'mono', filters.filterType === 'invert');
        sCtx.putImageData(imgData, 0, 0);
    }

    const sourceX = crop.x * srcCanvas.width;
    const sourceY = crop.y * srcCanvas.height;
    const sourceW = crop.w * srcCanvas.width;
    const sourceH = crop.h * srcCanvas.height;

    const destCanvas = document.createElement('canvas');
    destCanvas.width = 1012;
    destCanvas.height = 638;
    const dCtx = destCanvas.getContext('2d');

    dCtx.drawImage(
        srcCanvas,
        sourceX, sourceY, sourceW, sourceH,
        0, 0, destCanvas.width, destCanvas.height
    );

    return destCanvas.toDataURL('image/png');
}

// ─── MULTI-PAGE QUEUE SYSTEM ──────────────────────────────────────────

function addPageToQueue() {
    state.pages.push([]);
    state.currentPageIndex = state.pages.length - 1;
    
    updateQueueCardsList();
    renderA4Sheet();
    closeEditorPanel();
    
    showToast(`Added Page ${state.pages.length} to print queue`, 'success');
}

function deleteActivePage() {
    if (state.pages.length <= 1) {
        showToast('Cannot delete the last remaining print page.', 'error');
        return;
    }

    if (confirm(`Delete print page ${state.currentPageIndex + 1}? All cards on it will be removed.`)) {
        // Remove cards assigned to this page
        const cardIdsToDelete = state.pages[state.currentPageIndex];
        state.savedCards = state.savedCards.filter(c => !cardIdsToDelete.includes(c.id));

        state.pages.splice(state.currentPageIndex, 1);
        state.currentPageIndex = Math.max(0, state.currentPageIndex - 1);

        state.selectedCardId = null;
        closeEditorPanel();
        updateQueueCardsList();
        renderA4Sheet();
        
        showToast('Page deleted from print queue', 'info');
    }
}

// Update the list of card sets loaded on page
function updateQueueCardsList() {
    const list = document.getElementById('queue-cards-list');
    document.getElementById('active-page-badge').innerText = `Page ${state.currentPageIndex + 1} / ${state.pages.length}`;

    const currentPageCards = state.pages[state.currentPageIndex];

    if (!currentPageCards || currentPageCards.length === 0) {
        list.innerHTML = '<div class="empty-queue-text">No cards loaded on sheet</div>';
        return;
    }

    list.innerHTML = '';
    currentPageCards.forEach((id, index) => {
        const card = state.savedCards.find(c => c.id === id);
        if (!card) return;

        const item = document.createElement('div');
        item.className = `queue-item ${state.selectedCardId === card.id ? 'selected' : ''}`;
        item.innerHTML = `
            <div class="queue-item-left">
                <i class="ph ph-identification-card"></i>
                <div>
                    <div><strong>${card.name}</strong></div>
                    <span>${card.backSource ? 'Front + Back' : 'Front Only'}</span>
                </div>
            </div>
            <button class="btn-delete-queue-item" onclick="event.stopPropagation(); deleteCardFromQueue('${card.id}')" title="Delete card"><i class="ph ph-trash"></i></button>
        `;

        item.addEventListener('click', () => {
            state.selectedCardId = card.id;
            state.selectedSide = card.frontImg ? 'front' : 'back';
            updateQueueCardsList();
            renderA4Sheet();
            updateEditorPanel();
            toggleEditorModal(true);
        });

        list.appendChild(item);
    });
}

window.deleteCardFromQueue = function(id) {
    if (confirm('Delete this card set?')) {
        state.savedCards = state.savedCards.filter(c => c.id !== id);
        state.pages[state.currentPageIndex] = state.pages[state.currentPageIndex].filter(cId => cId !== id);
        
        // Rename remaining card sets for index alignment
        state.savedCards.forEach((c, idx) => {
            c.name = `Card Set #${idx + 1}`;
        });

        if (state.selectedCardId === id) {
            state.selectedCardId = null;
            closeEditorPanel();
        }

        updateQueueCardsList();
        renderA4Sheet();
        showToast('Card deleted from queue', 'info');
    }
};

// ─── CROP EDITOR PANEL LOGIC ───────────────────────────────────────────

function updateEditorPanel() {
    const card = getSelectedCard();
    if (!card) {
        closeEditorPanel();
        return;
    }

    const side = state.selectedSide;
    const filters = side === 'front' ? card.frontFilters : card.backFilters;
    const preset = side === 'front' ? card.frontPreset : card.backPreset;

    // Load presets
    ['cr80', 'aadhaar-front', 'aadhaar-back', 'pan', 'custom'].forEach(p => {
        const btn = document.getElementById(`btn-preset-${p}`);
        if (btn) btn.classList.toggle('active', preset === p);
    });

    // Load filters
    ['none', 'document', 'mono'].forEach(f => {
        document.getElementById(`btn-filter-${f}`).classList.toggle('active', filters.filterType === f);
    });

    // Load sliders
    ['brightness', 'contrast', 'saturate'].forEach(f => {
        const val = filters[f];
        document.getElementById(`slider-${f}`).value = val;
        document.getElementById(`val-${f}`).innerText = `${val}%`;
    });

    // Show slide panel control group
    document.getElementById('editor-controls-group').style.display = 'flex';
    document.getElementById('editor-title').innerHTML = `<i class="ph ph-crop"></i> Adjusting Card #${state.savedCards.indexOf(card) + 1} (${side === 'front' ? 'Front' : 'Back'})`;

    setupCropperViewport(card, side);
}

function toggleEditorModal(isOpen) {
    const backdrop = document.getElementById('editor-backdrop');
    if (isOpen) {
        cropPanel.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
    } else {
        cropPanel.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    }
}

function closeEditorPanel() {
    toggleEditorModal(false);
}

function setupCropperViewport(card, side) {
    const viewport = document.getElementById('editor-viewport');
    viewport.innerHTML = '';

    const img = side === 'front' ? card.frontImg : card.backImg;
    if (!img) {
        viewport.innerHTML = '<div class="empty-viewport-text">No image loaded for this side.</div>';
        return;
    }

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';

    const canvas = document.createElement('canvas');
    canvas.id = 'editor-canvas';
    canvas.className = 'crop-image';
    canvas.style.display = 'block';

    container.appendChild(canvas);
    viewport.appendChild(container);

    drawEditorImage(card, side);
    createCropBoxOverlay(container, card, side);
}

// ─── UTILITY FUNCTIONS FOR CROPPER & ROTATION ─────────────────────────

function renderCardSlotCanvas(canvasEl, card, side) {
    try {
        if (!canvasEl) return;
        const rawImg = side === 'front' ? card.frontImg : card.backImg;
        if (!rawImg) return;

        const rotation = side === 'front' ? (card.frontRotation || 0) : (card.backRotation || 0);
        const flipH = side === 'front' ? !!card.frontFlipH : !!card.backFlipH;
        const flipV = side === 'front' ? !!card.frontFlipV : !!card.backFlipV;
        const img = getRotatedSourceCanvas(rawImg, rotation, flipH, flipV);

        const crop = side === 'front' ? card.frontCrop : card.backCrop;
        const filters = side === 'front' ? card.frontFilters : card.backFilters;

        canvasEl.width = 1012;
        canvasEl.height = 638;
        const ctx = canvasEl.getContext('2d');

        // Draw card
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        
        ctx.save();
        let filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
        ctx.filter = filterString;

        const sourceX = crop.x * img.width;
        const sourceY = crop.y * img.height;
        const sourceW = crop.w * img.width;
        const sourceH = crop.h * img.height;

        ctx.drawImage(
            img,
            sourceX, sourceY, sourceW, sourceH,
            0, 0, canvasEl.width, canvasEl.height
        );
        ctx.restore();

        // Apply document scan filter if enabled
        if (filters.filterType === 'document' || filters.filterType === 'mono' || filters.filterType === 'invert') {
            const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
            applyDocScanFilter(imgData, filters.filterType === 'mono', filters.filterType === 'invert');
            ctx.putImageData(imgData, 0, 0);
        }
    } catch (err) {
        showToast(`renderCardSlotCanvas Error: ${err.message}`, 'error');
        console.error(err);
    }
}

function drawCardLive(card, side) {
    try {
        if (!card) return;
        const canvasEl = document.getElementById(`canvas-${card.id}-${side}`);
        if (canvasEl) {
            renderCardSlotCanvas(canvasEl, card, side);
        }
    } catch (err) {
        showToast(`drawCardLive Error: ${err.message}`, 'error');
        console.error(err);
    }
}

function getRotatedSourceCanvas(img, rotation, flipH = false, flipV = false) {
    const canvas = document.createElement('canvas');
    const rad = (rotation * Math.PI) / 180;
    const is90or270 = (rotation / 90) % 2 !== 0;
    
    canvas.width = is90or270 ? img.height : img.width;
    canvas.height = is90or270 ? img.width : img.height;
    
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    
    const scaleX = flipH ? -1 : 1;
    const scaleY = flipV ? -1 : 1;
    ctx.scale(scaleX, scaleY);
    
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    
    return canvas;
}

function drawEditorImage(card, side) {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;

    const rawImg = side === 'front' ? card.frontImg : card.backImg;
    if (!rawImg) return;

    const rotation = side === 'front' ? (card.frontRotation || 0) : (card.backRotation || 0);
    const flipH = side === 'front' ? !!card.frontFlipH : !!card.backFlipH;
    const flipV = side === 'front' ? !!card.frontFlipV : !!card.backFlipV;
    const img = getRotatedSourceCanvas(rawImg, rotation, flipH, flipV);

    const filters = side === 'front' ? card.frontFilters : card.backFilters;

    const viewport = document.getElementById('editor-viewport');
    const maxW = viewport.clientWidth - 20;
    
    const isMaximized = cropPanel.classList.contains('maximized');
    const maxH = (viewport.clientHeight - 20) || (isMaximized ? 620 : 420);

    let scale = Math.min(maxW / img.width, maxH / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext('2d');
    let filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
    ctx.filter = filterString;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (filters.filterType === 'document' || filters.filterType === 'mono' || filters.filterType === 'invert') {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyDocScanFilter(imgData, filters.filterType === 'mono', filters.filterType === 'invert');
        ctx.putImageData(imgData, 0, 0);
    }
}

function createCropBoxOverlay(container, card, side) {
    const existing = container.querySelector('.crop-box-overlay');
    if (existing) existing.remove();

    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;

    const crop = side === 'front' ? card.frontCrop : card.backCrop;
    const preset = side === 'front' ? card.frontPreset : card.backPreset;

    const overlay = document.createElement('div');
    overlay.className = 'crop-box-overlay';
    overlay.style.left = `${canvas.offsetLeft}px`;
    overlay.style.top = `${canvas.offsetTop}px`;
    overlay.style.width = `${canvas.offsetWidth}px`;
    overlay.style.height = `${canvas.offsetHeight}px`;
    
    const cropFrame = document.createElement('div');
    cropFrame.className = 'crop-frame';

    const updateFrameStyle = () => {
        cropFrame.style.left = `${crop.x * canvas.offsetWidth}px`;
        cropFrame.style.top = `${crop.y * canvas.offsetHeight}px`;
        cropFrame.style.width = `${crop.w * canvas.offsetWidth}px`;
        cropFrame.style.height = `${crop.h * canvas.offsetHeight}px`;
    };
    updateFrameStyle();

    const handles = ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'];
    handles.forEach(h => {
        const handle = document.createElement('div');
        handle.className = `crop-handle handle-${h}`;
        cropFrame.appendChild(handle);

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startCropResize(e, h, crop, canvas, updateFrameStyle, preset, card, side);
        });

        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.touches.length > 0) {
                startCropResize(e.touches[0], h, crop, canvas, updateFrameStyle, preset, card, side);
            }
        });
    });

    cropFrame.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();
        startCropDrag(e, crop, canvas, updateFrameStyle, card, side);
    });

    cropFrame.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();
        if (e.touches.length > 0) {
            startCropDrag(e.touches[0], crop, canvas, updateFrameStyle, card, side);
        }
    });

    overlay.appendChild(cropFrame);
    container.appendChild(overlay);
}

function startCropDrag(e, crop, canvas, updateFrameStyle, card, side) {
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startCropX = crop.x;
    const startCropY = crop.y;

    const onMouseMove = (moveEvent) => {
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const deltaX = (clientX - startMouseX) / canvas.offsetWidth;
        const deltaY = (clientY - startMouseY) / canvas.offsetHeight;

        let newX = startCropX + deltaX;
        let newY = startCropY + deltaY;

        newX = Math.max(0, Math.min(1 - crop.w, newX));
        newY = Math.max(0, Math.min(1 - crop.h, newY));

        crop.x = newX;
        crop.y = newY;

        updateFrameStyle();
        drawCardLive(card, side);
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onMouseMove);
        document.removeEventListener('touchend', onMouseUp);

        if (card) {
            updateCardPreviewAndSheet();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onMouseMove, { passive: false });
    document.addEventListener('touchend', onMouseUp);
}

function startCropResize(e, handle, crop, canvas, updateFrameStyle, preset, card, side) {
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startCrop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    
    const isLocked = preset !== 'custom';
    const canvasW = canvas.offsetWidth;
    const canvasH = canvas.offsetHeight;
    const nRatio = CARD_RATIO * (canvasH / canvasW);

    const onMouseMove = (moveEvent) => {
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

        let deltaX = (clientX - startMouseX) / canvasW;
        let deltaY = (clientY - startMouseY) / canvasH;

        let newX = startCrop.x;
        let newY = startCrop.y;
        let newW = startCrop.w;
        let newH = startCrop.h;

        if (isLocked) {
            if (handle === 'tr') {
                newW = Math.max(0.1, Math.min(1 - startCrop.x, startCrop.w + deltaX));
                newH = newW / nRatio;
                newY = startCrop.y + startCrop.h - newH;
            } else if (handle === 'tl') {
                newW = Math.max(0.1, Math.min(startCrop.x + startCrop.w, startCrop.w - deltaX));
                newH = newW / nRatio;
                newX = startCrop.x + startCrop.w - newW;
                newY = startCrop.y + startCrop.h - newH;
            } else if (handle === 'br') {
                newW = Math.max(0.1, Math.min(1 - startCrop.x, startCrop.w + deltaX));
                newH = newW / nRatio;
            } else if (handle === 'bl') {
                newW = Math.max(0.1, Math.min(startCrop.x + startCrop.w, startCrop.w - deltaX));
                newH = newW / nRatio;
                newX = startCrop.x + startCrop.w - newW;
            } else if (handle === 't') {
                newH = Math.max(0.1, Math.min(startCrop.y + startCrop.h, startCrop.h - deltaY));
                newW = newH * nRatio;
                newY = startCrop.y + startCrop.h - newH;
                newX = startCrop.x + (startCrop.w - newW) / 2;
            } else if (handle === 'b') {
                newH = Math.max(0.1, Math.min(1 - startCrop.y, startCrop.h + deltaY));
                newW = newH * nRatio;
                newX = startCrop.x + (startCrop.w - newW) / 2;
            } else if (handle === 'l') {
                newW = Math.max(0.1, Math.min(startCrop.x + startCrop.w, startCrop.w - deltaX));
                newH = newW / nRatio;
                newX = startCrop.x + startCrop.w - newW;
                newY = startCrop.y + (startCrop.h - newH) / 2;
            } else if (handle === 'r') {
                newW = Math.max(0.1, Math.min(1 - startCrop.x, startCrop.w + deltaX));
                newH = newW / nRatio;
                newY = startCrop.y + (startCrop.h - newH) / 2;
            }

            if (newX < 0) {
                newW += newX;
                newH = newW / nRatio;
                newX = 0;
            }
            if (newY < 0) {
                newH += newY;
                newW = newH * nRatio;
                newY = 0;
            }
            if (newX + newW > 1) {
                newW = 1 - newX;
                newH = newW / nRatio;
            }
            if (newY + newH > 1) {
                newH = 1 - newY;
                newW = newH * nRatio;
            }
        } else {
            if (handle.includes('r')) {
                newW = Math.max(0.1, Math.min(1 - startCrop.x, startCrop.w + deltaX));
            }
            if (handle.includes('l')) {
                newW = Math.max(0.1, Math.min(startCrop.x + startCrop.w, startCrop.w - deltaX));
                newX = startCrop.x + startCrop.w - newW;
            }
            if (handle.includes('b')) {
                newH = Math.max(0.1, Math.min(1 - startCrop.y, startCrop.h + deltaY));
            }
            if (handle.includes('t')) {
                newH = Math.max(0.1, Math.min(startCrop.y + startCrop.h, startCrop.h - deltaY));
                newY = startCrop.y + startCrop.h - newH;
            }
        }

        crop.x = newX;
        crop.y = newY;
        crop.w = newW;
        crop.h = newH;

        updateFrameStyle();
        drawCardLive(card, side);
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onMouseMove);
        document.removeEventListener('touchend', onMouseUp);

        if (card) {
            updateCardPreviewAndSheet();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onMouseMove, { passive: false });
    document.addEventListener('touchend', onMouseUp);
}

function setCropPreset(preset) {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    const img = side === 'front' ? card.frontImg : card.backImg;
    if (!img) return;

    if (side === 'front') {
        card.frontPreset = preset;
    } else {
        card.backPreset = preset;
    }

    let crop = side === 'front' ? card.frontCrop : card.backCrop;
    
    if (preset === 'cr80') {
        let w = 0.85;
        let h = w * (img.width / img.height) / CARD_RATIO;
        if (h > 0.85) {
            h = 0.85;
            w = h * CARD_RATIO / (img.width / img.height);
        }
        crop.x = (1 - w) / 2;
        crop.y = (1 - h) / 2;
        crop.w = w;
        crop.h = h;
    } else if (preset === 'aadhaar-front') {
        // Aadhaar Front bottom-right panel of A4 letter (usually)
        crop.x = 0.51;
        crop.y = 0.62;
        crop.w = 0.44;
        crop.h = crop.w * (img.width / img.height) / CARD_RATIO;
        if (crop.y + crop.h > 1) {
            crop.h = 1 - crop.y;
            crop.w = crop.h * CARD_RATIO / (img.width / img.height);
        }
    } else if (preset === 'aadhaar-back') {
        // Aadhaar Back bottom-left panel of A4 letter
        crop.x = 0.05;
        crop.y = 0.62;
        crop.w = 0.44;
        crop.h = crop.w * (img.width / img.height) / CARD_RATIO;
        if (crop.y + crop.h > 1) {
            crop.h = 1 - crop.y;
            crop.w = crop.h * CARD_RATIO / (img.width / img.height);
        }
    } else if (preset === 'pan') {
        // PAN Card centered preset
        crop.w = 0.70;
        crop.h = crop.w * (img.width / img.height) / CARD_RATIO;
        crop.x = (1 - crop.w) / 2;
        crop.y = (1 - crop.h) / 2;
        if (crop.y + crop.h > 1) {
            crop.h = 1 - crop.y;
            crop.w = crop.h * CARD_RATIO / (img.width / img.height);
            crop.x = (1 - crop.w) / 2;
        }
    } else {
        crop.x = 0.05;
        crop.y = 0.05;
        crop.w = 0.9;
        crop.h = 0.9;
    }

    ['cr80', 'aadhaar-front', 'aadhaar-back', 'pan', 'custom'].forEach(p => {
        const btn = document.getElementById(`btn-preset-${p}`);
        if (btn) btn.classList.toggle('active', preset === p);
    });

    updateCardPreviewAndSheet();
    
    const viewport = document.getElementById('editor-viewport');
    const container = viewport.querySelector('div');
    if (container) {
        createCropBoxOverlay(container, card, side);
    }
}

function setDocFilter(filterType) {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    const filters = side === 'front' ? card.frontFilters : card.backFilters;
    filters.filterType = filterType;

    ['none', 'document', 'mono', 'enhance', 'invert'].forEach(f => {
        const btn = document.getElementById(`btn-filter-${f}`);
        if (btn) btn.classList.toggle('active', filterType === f);
    });

    if (filterType === 'enhance') {
        filters.brightness = 105;
        filters.contrast = 125;
        filters.saturate = 105;

        // Sync slider controls
        document.getElementById('slider-brightness').value = 105;
        document.getElementById('val-brightness').innerText = '105%';
        document.getElementById('slider-contrast').value = 125;
        document.getElementById('val-contrast').innerText = '125%';
        document.getElementById('slider-saturate').value = 105;
        document.getElementById('val-saturate').innerText = '105%';
    }

    drawEditorImage(card, side);
    updateCardPreviewAndSheet();
}

function rotateActiveImage(degree) {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    if (side === 'front') {
        card.frontRotation = ((card.frontRotation || 0) + degree + 360) % 360;
    } else {
        card.backRotation = ((card.backRotation || 0) + degree + 360) % 360;
    }

    drawEditorImage(card, side);
    
    const preset = side === 'front' ? card.frontPreset : card.backPreset;
    setCropPreset(preset);
}

function flipActiveImage(direction) {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    if (direction === 'horizontal') {
        if (side === 'front') {
            card.frontFlipH = !card.frontFlipH;
        } else {
            card.backFlipH = !card.backFlipH;
        }
    } else {
        if (side === 'front') {
            card.frontFlipV = !card.frontFlipV;
        } else {
            card.backFlipV = !card.backFlipV;
        }
    }

    drawEditorImage(card, side);
    updateCardPreviewAndSheet();
}

function centerActiveCrop() {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    const crop = side === 'front' ? card.frontCrop : card.backCrop;
    if (!crop) return;

    crop.x = (1 - crop.w) / 2;
    crop.y = (1 - crop.h) / 2;

    drawCardLive(card, side);
    updateCardPreviewAndSheet();

    const viewport = document.getElementById('editor-viewport');
    const container = viewport.querySelector('div');
    if (container) {
        createCropBoxOverlay(container, card, side);
    }
    showToast('Centered crop area', 'info');
}

function resetActiveFilters() {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    const filters = side === 'front' ? card.frontFilters : card.backFilters;
    
    filters.brightness = 100;
    filters.contrast = 100;
    filters.saturate = 100;
    filters.filterType = 'none';

    ['brightness', 'contrast', 'saturate'].forEach(f => {
        const slider = document.getElementById(`slider-${f}`);
        if (slider) slider.value = 100;
        const valDisp = document.getElementById(`val-${f}`);
        if (valDisp) valDisp.innerText = '100%';
    });

    ['none', 'document', 'mono', 'enhance', 'invert'].forEach(f => {
        const btn = document.getElementById(`btn-filter-${f}`);
        if (btn) btn.classList.toggle('active', f === 'none');
    });

    drawEditorImage(card, side);
    updateCardPreviewAndSheet();
}

function deleteActiveCardSet() {
    const card = getSelectedCard();
    if (!card) return;
    window.deleteCardFromQueue(card.id);
}

function updateCardPreviewAndSheet() {
    const card = getSelectedCard();
    if (!card) return;

    const side = state.selectedSide;
    
    if (side === 'front') {
        card.frontCroppedData = cacheCropCanvas(card, 'front');
    } else {
        card.backCroppedData = cacheCropCanvas(card, 'back');
    }

    renderA4Sheet();
}

function applyDocScanFilter(imgData, mono, invert) {
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (invert) {
            data[i] = 255 - data[i];
            data[i+1] = 255 - data[i+1];
            data[i+2] = 255 - data[i+2];
            continue;
        }
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (mono) {
            const val = gray > 130 ? 255 : 0;
            data[i] = val;
            data[i+1] = val;
            data[i+2] = val;
        } else {
            let newVal = gray;
            if (gray > 120) {
                newVal = Math.min(255, 120 + (gray - 120) * 1.8);
            } else {
                newVal = Math.max(0, gray * 0.7);
            }
            data[i] = newVal;
            data[i+1] = newVal;
            data[i+2] = newVal;
        }
    }
}

function updateZoom() {
    const page = document.getElementById('a4-page');
    const zoomText = document.getElementById('zoom-level');
    if (!page) return;

    page.style.transform = `scale(${state.zoom})`;
    
    const container = page.parentElement;
    if (container) {
        container.style.width = `${595 * state.zoom}px`;
        container.style.height = `${842 * state.zoom}px`;
    }

    if (zoomText) {
        zoomText.innerText = `${Math.round(state.zoom * 100)}%`;
    }
}

function autoFitZoom() {
    try {
        const workspace = document.querySelector('.sheet-scroller-area');
        if (!workspace) return;
        
        const workspaceW = workspace.clientWidth;
        
        // On smaller screens, fit to width. Provide 40px padding (20px each side)
        if (workspaceW < 650) {
            let newZoom = (workspaceW - 40) / 595;
            if (newZoom > 1.1) newZoom = 1.1;
            if (newZoom < 0.25) newZoom = 0.25;
            state.zoom = newZoom;
        } else {
            // Default preview page zoom set to 110% (1.1)
            state.zoom = 1.1;
        }
        
        updateZoom();
    } catch (err) {
        console.error(err);
    }
}

// ─── SHEET RENDER COMPOSER ────────────────────────────────────────────

// Render the sheet corresponding to currentPageIndex
function renderA4Sheet() {
    a4Page.innerHTML = '';
    
    const currentPageCards = state.pages[state.currentPageIndex] || [];
    const margin = state.sheetSettings.margin;
    const gap = state.sheetSettings.gap;
    const rowGap = state.sheetSettings.rowGap !== undefined ? state.sheetSettings.rowGap : 5;
    const layout = state.sheetSettings.layout;
    const showBorder = state.sheetSettings.border;
    const roundedCorners = state.sheetSettings.roundedCorners;
    const showCropMarks = state.sheetSettings.showCropMarks;

    const cardW_mm = 85.6;
    const cardH_mm = 54;

    const slots = [];

    // Filter cards to only include the ones in current page queue
    const activeCards = state.savedCards.filter(c => currentPageCards.includes(c.id));
    
    // Add dummy placeholder card set if under the layout limit
    const maxSets = LAYOUT_LIMITS[layout] || 4;
    const renderCards = [...activeCards];
    if (renderCards.length < maxSets) {
        renderCards.push({
            id: 'placeholder',
            isPlaceholder: true,
            frontCroppedData: null,
            backCroppedData: null
        });
    }

    if (layout === 'pvc') {
        const centerX = (A4_WIDTH_MM - cardW_mm) / 2;
        const centerY = (A4_HEIGHT_MM - cardH_mm) / 2;

        const cardSet = renderCards[0];
        if (cardSet) {
            slots.push({
                id: cardSet.id,
                side: 'front',
                imgData: cardSet.frontCroppedData,
                x: centerX,
                y: centerY,
                isPlaceholder: cardSet.isPlaceholder
            });
            if (!state.singleSideMode) {
                const yOffset = cardH_mm + rowGap;
                slots.push({
                    id: cardSet.id,
                    side: 'back',
                    imgData: cardSet.backCroppedData,
                    x: centerX,
                    y: centerY + yOffset,
                    isPlaceholder: cardSet.isPlaceholder
                });
            }
        }
    } else if (layout === 'side-by-side') {
        let currentY = margin;
        renderCards.forEach(cardSet => {
            slots.push({
                id: cardSet.id,
                side: 'front',
                imgData: cardSet.frontCroppedData,
                x: margin,
                y: currentY,
                isPlaceholder: cardSet.isPlaceholder
            });
            if (!state.singleSideMode) {
                const xOffset = cardW_mm + gap;
                slots.push({
                    id: cardSet.id,
                    side: 'back',
                    imgData: cardSet.backCroppedData,
                    x: margin + xOffset,
                    y: currentY,
                    isPlaceholder: cardSet.isPlaceholder
                });
            }
            currentY += cardH_mm + rowGap;
        });
    } else {
        // Stacked vertically grid (default)
        let col = 0;
        let row = 0;
        
        renderCards.forEach(cardSet => {
            const x = margin + col * (cardW_mm + gap);
            const setHeight = state.singleSideMode ? cardH_mm : (cardH_mm * 2 + rowGap);
            const y = margin + row * (setHeight + rowGap);

            slots.push({
                id: cardSet.id,
                side: 'front',
                imgData: cardSet.frontCroppedData,
                x: x,
                y: y,
                isPlaceholder: cardSet.isPlaceholder
            });
            if (!state.singleSideMode) {
                const yOffset = cardH_mm + rowGap;
                slots.push({
                    id: cardSet.id,
                    side: 'back',
                    imgData: cardSet.backCroppedData,
                    x: x,
                    y: y + yOffset,
                    isPlaceholder: cardSet.isPlaceholder
                });
            }

            col++;
            if (col >= 2) {
                col = 0;
                row++;
            }
        });
    }

    // Render A4 Slot nodes
    slots.forEach(slot => {
        const slotEl = document.createElement('div');
        slotEl.className = 'virtual-card-slot';
        
        slotEl.style.left = `${slot.x * A4_PX_PER_MM}px`;
        slotEl.style.top = `${slot.y * A4_PX_PER_MM}px`;
        slotEl.style.width = `${cardW_mm * A4_PX_PER_MM}px`;
        slotEl.style.height = `${cardH_mm * A4_PX_PER_MM}px`;

        // Set CSS custom properties for print layout positioning in mm
        slotEl.style.setProperty('--x', `${slot.x}mm`);
        slotEl.style.setProperty('--y', `${slot.y}mm`);

        if (!slot.imgData) {
            slotEl.classList.add('empty-upload-slot');
            slotEl.innerHTML = `
                <div class="empty-upload-content">
                    <i class="ph ph-plus-circle"></i>
                    <span>Upload ${slot.side === 'front' ? 'Front' : 'Back'}</span>
                </div>
                <input type="file" class="slot-file-input" accept="image/*,application/pdf" style="display:none;">
            `;

            const fileInput = slotEl.querySelector('.slot-file-input');
            slotEl.addEventListener('click', (e) => {
                fileInput.click();
                e.stopPropagation();
            });

            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    await handleSlotUpload(e.target.files[0], slot.id, slot.side);
                }
            });

            setupSlotDragAndDrop(slotEl, slot.id, slot.side);
        } else {
            if (showBorder) slotEl.classList.add('card-with-border');
            if (roundedCorners) slotEl.classList.add('rounded-corner-card');
            
            if (state.selectedCardId === slot.id && state.selectedSide === slot.side) {
                slotEl.classList.add('selected-card');
            }

            const canvas = document.createElement('canvas');
            canvas.id = `canvas-${slot.id}-${slot.side}`;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';
            slotEl.appendChild(canvas);

            const card = state.savedCards.find(c => c.id === slot.id);
            if (card) {
                renderCardSlotCanvas(canvas, card, slot.side);
            }

            const label = document.createElement('span');
            label.className = 'card-slot-label';
            label.innerText = slot.side.toUpperCase();
            slotEl.appendChild(label);

            // Hover Action overlay
            const hoverOverlay = document.createElement('div');
            hoverOverlay.className = 'slot-hover-overlay';
            hoverOverlay.innerHTML = `
                <button class="slot-hover-btn edit" title="Edit / Crop"><i class="ph ph-crop"></i></button>
                <button class="slot-hover-btn rotate" title="Rotate 90°"><i class="ph ph-arrow-clockwise"></i></button>
                <button class="slot-hover-btn delete" title="Clear Slot"><i class="ph ph-trash"></i></button>
            `;

            hoverOverlay.querySelector('.edit').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditorForSlot(slot.id, slot.side);
            });

            hoverOverlay.querySelector('.rotate').addEventListener('click', (e) => {
                e.stopPropagation();
                rotateSlotCard(slot.id, slot.side);
            });

            hoverOverlay.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSlotCard(slot.id, slot.side);
            });

            slotEl.appendChild(hoverOverlay);

            slotEl.addEventListener('click', (e) => {
                openEditorForSlot(slot.id, slot.side);
                e.stopPropagation();
            });

            if (showCropMarks) {
                ['tl', 'tr', 'bl', 'br'].forEach(mark => {
                    const marker = document.createElement('div');
                    marker.className = `crop-mark crop-mark-${mark}`;
                    slotEl.appendChild(marker);
                });
            }
        }

        a4Page.appendChild(slotEl);
    });
}

// ─── EXPORT CHANNELS ──────────────────────────────────────────────────

function downloadPDF() {
    if (state.savedCards.length === 0) {
        showToast('Print queue is empty', 'error');
        return;
    }

    if (window.BGradeAnalytics) {
        window.BGradeAnalytics.logAction('download_pdf', `Pages: ${state.pages.length}`, 'id_card_printer');
    }

    showToast('Compiling PDF sheets...', 'info');

    const margin = state.sheetSettings.margin;
    const gap = state.sheetSettings.gap;
    const rowGap = state.sheetSettings.rowGap !== undefined ? state.sheetSettings.rowGap : 5;
    const layout = state.sheetSettings.layout;
    const showBorder = state.sheetSettings.border;
    const showCropMarks = state.sheetSettings.showCropMarks;

    const cardW_mm = 85.6;
    const cardH_mm = 54;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const drawCardToPDF = (imgData, x, y) => {
        if (!imgData) return;
        if (showBorder) {
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.15);
            pdf.rect(x, y, cardW_mm, cardH_mm);
        }
        pdf.addImage(imgData, 'PNG', x, y, cardW_mm, cardH_mm);

        if (showCropMarks) {
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.15);
            const markLen = 4;
            const offset = 2.5;
            
            pdf.line(x - offset, y, x - offset - markLen, y);
            pdf.line(x, y - offset, x, y - offset - markLen);
            
            pdf.line(x + cardW_mm + offset, y, x + cardW_mm + offset + markLen, y);
            pdf.line(x + cardW_mm, y - offset, x + cardW_mm, y - offset - markLen);

            pdf.line(x - offset, y + cardH_mm, x - offset - markLen, y + cardH_mm);
            pdf.line(x, y + cardH_mm + offset, x, y + cardH_mm + offset + markLen);

            pdf.line(x + cardW_mm + offset, y + cardH_mm, x + cardW_mm + offset + markLen, y + cardH_mm);
            pdf.line(x + cardW_mm, y + cardH_mm + offset, x + cardW_mm, y + cardH_mm + offset + markLen);
        }
    };

    // Compile multiple pages in PDF based on state.pages queue
    state.pages.forEach((pageCardIds, pageIdx) => {
        if (pageIdx > 0) pdf.addPage();

        const pageCards = state.savedCards.filter(c => pageCardIds.includes(c.id));

        if (layout === 'pvc') {
            const centerX = (A4_WIDTH_MM - cardW_mm) / 2;
            const centerY = (A4_HEIGHT_MM - cardH_mm) / 2;
            if (pageCards[0]) {
                if (pageCards[0].frontCroppedData) {
                    drawCardToPDF(pageCards[0].frontCroppedData, centerX, centerY);
                }
                if (pageCards[0].backCroppedData) {
                    pdf.addPage();
                    drawCardToPDF(pageCards[0].backCroppedData, centerX, centerY);
                }
            }
        } else if (layout === 'side-by-side') {
            let currentY = margin;
            pageCards.forEach(cardSet => {
                if (cardSet.frontCroppedData) {
                    drawCardToPDF(cardSet.frontCroppedData, margin, currentY);
                }
                if (cardSet.backCroppedData) {
                    const xOffset = cardSet.frontCroppedData ? (cardW_mm + gap) : 0;
                    drawCardToPDF(cardSet.backCroppedData, margin + xOffset, currentY);
                }
                currentY += cardH_mm + rowGap;
            });
        } else {
            let col = 0;
            let row = 0;
            pageCards.forEach(cardSet => {
                const x = margin + col * (cardW_mm + gap);
                const setHeight = cardH_mm * 2 + rowGap;
                const y = margin + row * (setHeight + rowGap);

                if (cardSet.frontCroppedData) {
                    drawCardToPDF(cardSet.frontCroppedData, x, y);
                }
                if (cardSet.backCroppedData) {
                    const yOffset = cardSet.frontCroppedData ? (cardH_mm + rowGap) : 0;
                    drawCardToPDF(cardSet.backCroppedData, x, y + yOffset);
                }

                col++;
                if (col >= 2) {
                    col = 0;
                    row++;
                }
            });
        }
    });

    pdf.save('AmritEnterprises_ID_Card_Layout.pdf');
    showToast('Multi-page PDF compiled successfully!');
}

function downloadJPG() {
    if (state.savedCards.length === 0) {
        showToast('Print queue is empty', 'error');
        return;
    }

    if (window.BGradeAnalytics) {
        window.BGradeAnalytics.logAction('download_png', `Page: ${state.currentPageIndex + 1}`, 'id_card_printer');
    }

    showToast('Exporting current sheet...', 'info');

    const dpi = 300;
    const mmToInch = 25.4;
    const canvasW = Math.round((A4_WIDTH_MM / mmToInch) * dpi);
    const canvasH = Math.round((A4_HEIGHT_MM / mmToInch) * dpi);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasW;
    exportCanvas.height = canvasH;
    const ctx = exportCanvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const scale = canvasW / A4_WIDTH_MM;

    const margin = state.sheetSettings.margin;
    const gap = state.sheetSettings.gap;
    const rowGap = state.sheetSettings.rowGap !== undefined ? state.sheetSettings.rowGap : 5;
    const layout = state.sheetSettings.layout;
    const showBorder = state.sheetSettings.border;
    const showCropMarks = state.sheetSettings.showCropMarks;

    const cardW_mm = 85.6;
    const cardH_mm = 54;

    const drawCardToCanvas = (imgDataUrl, x, y) => {
        return new Promise((resolve) => {
            if (!imgDataUrl) {
                resolve();
                return;
            }
            const img = new Image();
            img.onload = () => {
                const pxX = x * scale;
                const pxY = y * scale;
                const pxW = cardW_mm * scale;
                const pxH = cardH_mm * scale;

                ctx.drawImage(img, pxX, pxY, pxW, pxH);

                if (showBorder) {
                    ctx.strokeStyle = '#b4b4b4';
                    ctx.lineWidth = 0.15 * scale;
                    ctx.strokeRect(pxX, pxY, pxW, pxH);
                }

                if (showCropMarks) {
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 0.15 * scale;
                    const markLen = 4 * scale;
                    const offset = 2.5 * scale;

                    ctx.beginPath();
                    ctx.moveTo(pxX - offset, pxY);
                    ctx.lineTo(pxX - offset - markLen, pxY);
                    ctx.moveTo(pxX, pxY - offset);
                    ctx.lineTo(pxX, pxY - offset - markLen);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(pxX + pxW + offset, pxY);
                    ctx.lineTo(pxX + pxW + offset + markLen, pxY);
                    ctx.moveTo(pxX + pxW, pxY - offset);
                    ctx.lineTo(pxX + pxW, pxY - offset - markLen);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(pxX - offset, pxY + pxH);
                    ctx.lineTo(pxX - offset - markLen, pxY + pxH);
                    ctx.moveTo(pxX, pxY + pxH + offset);
                    ctx.lineTo(pxX, pxY + pxH + offset + markLen);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(pxX + pxW + offset, pxY + pxH);
                    ctx.lineTo(pxX + pxW + offset + markLen, pxY + pxH);
                    ctx.moveTo(pxX + pxW, pxY + pxH + offset);
                    ctx.lineTo(pxX + pxW, pxY + pxH + offset + markLen);
                    ctx.stroke();
                }
                resolve();
            };
            img.src = imgDataUrl;
        });
    };

    const drawAll = async () => {
        const currentPageCardIds = state.pages[state.currentPageIndex];
        const pageCards = state.savedCards.filter(c => currentPageCardIds.includes(c.id));

        if (layout === 'pvc') {
            const centerX = (A4_WIDTH_MM - cardW_mm) / 2;
            const centerY = (A4_HEIGHT_MM - cardH_mm) / 2;
            if (pageCards[0]) {
                if (pageCards[0].frontCroppedData) {
                    await drawCardToCanvas(pageCards[0].frontCroppedData, centerX, centerY);
                }
                if (pageCards[0].backCroppedData) {
                    const yOffset = pageCards[0].frontCroppedData ? (cardH_mm + rowGap) : 0;
                    await drawCardToCanvas(pageCards[0].backCroppedData, centerX, centerY + yOffset);
                }
            }
        } else if (layout === 'side-by-side') {
            let currentY = margin;
            for (let cardSet of pageCards) {
                if (cardSet.frontCroppedData) {
                    await drawCardToCanvas(cardSet.frontCroppedData, margin, currentY);
                }
                if (cardSet.backCroppedData) {
                    const xOffset = cardSet.frontCroppedData ? (cardW_mm + gap) : 0;
                    await drawCardToCanvas(cardSet.backCroppedData, margin + xOffset, currentY);
                }
                currentY += cardH_mm + rowGap;
            }
        } else {
            let col = 0;
            let row = 0;
            for (let cardSet of pageCards) {
                const x = margin + col * (cardW_mm + gap);
                const setHeight = cardH_mm * 2 + rowGap;
                const y = margin + row * (setHeight + rowGap);

                if (cardSet.frontCroppedData) {
                    await drawCardToCanvas(cardSet.frontCroppedData, x, y);
                }
                if (cardSet.backCroppedData) {
                    const yOffset = cardSet.frontCroppedData ? (cardH_mm + rowGap) : 0;
                    await drawCardToCanvas(cardSet.backCroppedData, x, y + yOffset);
                }

                col++;
                if (col >= 2) {
                    col = 0;
                    row++;
                }
            }
        }

        const link = document.createElement('a');
        link.download = `AmritEnterprises_ID_Page_${state.currentPageIndex + 1}.jpg`;
        link.href = exportCanvas.toDataURL('image/jpeg', 0.9);
        link.click();
        showToast(`Page ${state.currentPageIndex + 1} JPG exported!`);
    };

    drawAll();
}



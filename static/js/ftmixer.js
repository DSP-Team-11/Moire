// ==========================================================
// CLASS DEFINITIONS
// ==========================================================

/**
 * Manages region drawing state for a single component
 */
class Region {
    constructor(slot, type = 'inner', x = 0, y = 0, width = 100, height = 100) {
        this.slot = slot;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.isSet = false;
        this.element = null;
    }

    /**
     * Updates region dimensions based on drawing coordinates
     */
    updateFromDrawing(startX, startY, currentX, currentY, viewportRect) {
        const xPercent = ((startX) / viewportRect.width) * 100;
        const yPercent = ((startY) / viewportRect.height) * 100;
        const widthPercent = ((currentX - startX) / viewportRect.width) * 100;
        const heightPercent = ((currentY - startY) / viewportRect.height) * 100;
        
        this.x = Math.max(0, Math.min(xPercent, 100));
        this.y = Math.max(0, Math.min(yPercent, 100));
        this.width = Math.max(1, Math.min(Math.abs(widthPercent), 100));
        this.height = Math.max(1, Math.min(Math.abs(heightPercent), 100));
        this.isSet = true;
    }

    /**
     * Updates region from dragged rectangle position
     */
    updateFromDrag(rectElement, overlayRect) {
        this.x = (parseFloat(rectElement.style.left) / overlayRect.width) * 100;
        this.y = (parseFloat(rectElement.style.top) / overlayRect.height) * 100;
        this.width = (parseFloat(rectElement.style.width) / overlayRect.width) * 100;
        this.height = (parseFloat(rectElement.style.height) / overlayRect.height) * 100;
    }

    /**
     * Toggles between inner and outer region types
     */
    toggleType() {
        this.type = this.type === 'inner' ? 'outer' : 'inner';
        return this.type;
    }

    /**
     * Creates a rectangle element for this region
     */
    createRectangleElement() {
        const rect = document.createElement('div');
        rect.className = `region-rectangle ${this.type}`;
        rect.setAttribute('data-slot', this.slot);
        this.element = rect;
        return rect;
    }

    /**
     * Updates rectangle element position and size
     */
    updateRectangleElement(overlayRect) {
        if (!this.element) return;
        
        this.element.className = `region-rectangle ${this.type}`;
        this.element.style.left = `${(this.x / 100) * overlayRect.width}px`;
        this.element.style.top = `${(this.y / 100) * overlayRect.height}px`;
        this.element.style.width = `${(this.width / 100) * overlayRect.width}px`;
        this.element.style.height = `${(this.height / 100) * overlayRect.height}px`;
    }

    /**
     * Resets region to default values
     */
    reset() {
        this.type = 'inner';
        this.x = 0;
        this.y = 0;
        this.width = 100;
        this.height = 100;
        this.isSet = false;
    }

    /**
     * Converts to payload format for API
     */
    toPayload() {
        return {
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

/**
 * Manages brightness/contrast state for an image
 */
class BrightnessContrastState {
    constructor() {
        this.states = new Map(); // imgId -> {b, c}
    }

    setState(imgId, b = 100, c = 100) {
        this.states.set(imgId, { b, c });
    }

    getState(imgId) {
        return this.states.get(imgId) || { b: 100, c: 100 };
    }

    update(imgId, deltaB, deltaC) {
        const state = this.getState(imgId);
        state.c = Math.max(0, state.c + deltaC);
        state.b = Math.max(0, state.b + deltaB);
        this.states.set(imgId, state);
        return state;
    }

    applyToElement(imgId, element) {
        const state = this.getState(imgId);
        if (element && state) {
            element.style.filter = `brightness(${state.b}%) contrast(${state.c}%)`;
        }
    }

    remove(imgId) {
        this.states.delete(imgId);
    }
}

/**
 * Manages region drawing operations
 */
class RegionDrawingManager {
    constructor(regionManager) {
        this.regionManager = regionManager;
        this.isDrawing = false;
        this.drawingSlot = null;
        this.startX = 0;
        this.startY = 0;
        this.currentRect = null;
        this.isDragging = false;
        this.draggingRect = null;
        this.draggingSlot = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartLeft = 0;
        this.dragStartTop = 0;
    }

    startDrawing(e, slot) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const viewport = document.getElementById(`viewport-compImg${slot}`);
        const overlay = document.getElementById(`overlay-compImg${slot}`);
        if (!viewport || !overlay) return;

        // Remove existing rectangle
        const existingRect = overlay.querySelector('.region-rectangle');
        if (existingRect) existingRect.remove();

        const rect = viewport.getBoundingClientRect();
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
        this.isDrawing = true;
        this.drawingSlot = slot;

        // Create new rectangle
        const region = this.regionManager.getRegion(slot);
        this.currentRect = region.createRectangleElement();
        this.currentRect.style.left = `${this.startX}px`;
        this.currentRect.style.top = `${this.startY}px`;
        this.currentRect.style.width = '0px';
        this.currentRect.style.height = '0px';
        this.currentRect.addEventListener('mousedown', (e) => this.startDragging(e, slot));
        
        overlay.appendChild(this.currentRect);
    }

    updateDrawing(e, slot) {
        if (!this.isDrawing || this.drawingSlot !== slot || !this.currentRect) return;

        const viewport = document.getElementById(`viewport-compImg${slot}`);
        if (!viewport) return;

        const rect = viewport.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - this.startX;
        const height = currentY - this.startY;

        this.currentRect.style.width = `${Math.abs(width)}px`;
        this.currentRect.style.height = `${Math.abs(height)}px`;

        if (width < 0) this.currentRect.style.left = `${currentX}px`;
        if (height < 0) this.currentRect.style.top = `${currentY}px`;
    }

    finishDrawing(slot) {
        if (!this.isDrawing || this.drawingSlot !== slot || !this.currentRect) return;

        const viewport = document.getElementById(`viewport-compImg${slot}`);
        const overlay = document.getElementById(`overlay-compImg${slot}`);
        if (!viewport || !overlay) return;

        const viewportRect = viewport.getBoundingClientRect();
        const rectBounds = this.currentRect.getBoundingClientRect();

        const startX = this.startX;
        const startY = this.startY;
        const endX = startX + (parseFloat(this.currentRect.style.width) * (rectBounds.left < viewportRect.left ? -1 : 1));
        const endY = startY + (parseFloat(this.currentRect.style.height) * (rectBounds.top < viewportRect.top ? -1 : 1));

        const region = this.regionManager.getRegion(slot);
        region.updateFromDrawing(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.max(startX, endX),
            Math.max(startY, endY),
            viewportRect
        );

        this.regionManager.updateRegionUI(slot);
        this.resetDrawingState();
    }

    startDragging(e, slot) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.draggingRect = e.target;
        this.draggingSlot = slot;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartLeft = parseFloat(this.draggingRect.style.left) || 0;
        this.dragStartTop = parseFloat(this.draggingRect.style.top) || 0;

        document.addEventListener('mousemove', this.handleDrag.bind(this));
        document.addEventListener('mouseup', this.stopDragging.bind(this));
    }

    handleDrag(e) {
        if (!this.isDragging || !this.draggingRect || !this.draggingSlot) return;

        const slot = this.draggingSlot;
        const overlay = document.getElementById(`overlay-compImg${slot}`);
        if (!overlay) return;

        const overlayRect = overlay.getBoundingClientRect();
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        const rectWidth = parseFloat(this.draggingRect.style.width) || 0;
        const rectHeight = parseFloat(this.draggingRect.style.height) || 0;
        const maxLeft = overlayRect.width - rectWidth;
        const maxTop = overlayRect.height - rectHeight;

        const newLeft = Math.max(0, Math.min(this.dragStartLeft + deltaX, maxLeft));
        const newTop = Math.max(0, Math.min(this.dragStartTop + deltaY, maxTop));

        this.draggingRect.style.left = `${newLeft}px`;
        this.draggingRect.style.top = `${newTop}px`;
    }

    stopDragging() {
        if (!this.isDragging || !this.draggingRect || !this.draggingSlot) return;

        const slot = this.draggingSlot;
        const overlay = document.getElementById(`overlay-compImg${slot}`);
        
        if (overlay) {
            const overlayRect = overlay.getBoundingClientRect();
            const region = this.regionManager.getRegion(slot);
            region.updateFromDrag(this.draggingRect, overlayRect);
            this.regionManager.updateRegionUI(slot);
        }

        document.removeEventListener('mousemove', this.handleDrag.bind(this));
        document.removeEventListener('mouseup', this.stopDragging.bind(this));
        this.resetDraggingState();
    }

    resetDrawingState() {
        this.isDrawing = false;
        this.drawingSlot = null;
        this.startX = 0;
        this.startY = 0;
        this.currentRect = null;
    }

    resetDraggingState() {
        this.isDragging = false;
        this.draggingRect = null;
        this.draggingSlot = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartLeft = 0;
        this.dragStartTop = 0;
    }
}

/**
 * Manages all regions across components
 */
class RegionManager {
    constructor() {
        this.regions = new Map();
        this.drawingManager = new RegionDrawingManager(this);
        this.currentMode = 'basic'; // 'basic' or 'region'
        
        // Initialize regions for slots 1-4
        for (let i = 1; i <= 4; i++) {
            this.regions.set(i, new Region(i));
        }
    }

    getRegion(slot) {
        return this.regions.get(slot);
    }

    setMode(mode) {
        this.currentMode = mode;
        this.updateAllRegionsUI();
        
        if (mode === 'basic') {
            this.resetAllRegions();
        }
    }

    resetAllRegions() {
        this.regions.forEach(region => region.reset());
    }

    toggleRegionType(slot) {
        const region = this.getRegion(slot);
        if (region && region.isSet) {
            region.toggleType();
            this.updateRegionUI(slot);
        }
    }

    updateRegionUI(slot) {
        const region = this.getRegion(slot);
        const overlay = document.getElementById(`overlay-compImg${slot}`);
        
        if (!overlay) return;

        // Remove existing rectangle
        const existingRect = overlay.querySelector('.region-rectangle');
        if (existingRect) existingRect.remove();

        // Add new rectangle if region is set and mode is region
        if (region.isSet && this.currentMode === 'region') {
            const overlayRect = overlay.getBoundingClientRect();
            region.updateRectangleElement(overlayRect);
            region.element.addEventListener('mousedown', (e) => 
                this.drawingManager.startDragging(e, slot));
            overlay.appendChild(region.element);
        }

        // Update button
        this.updateRegionButton(slot);
    }

    updateAllRegionsUI() {
        for (let i = 1; i <= 4; i++) {
            this.updateRegionUI(i);
        }
    }

    updateRegionButton(slot) {
        const btn = document.getElementById(`region-type${slot}`);
        if (!btn) return;

        const region = this.getRegion(slot);
        
        if (this.currentMode === 'region') {
            btn.style.display = 'block';
            btn.textContent = region.type === 'inner' ? 'Selecting INSIDE' : 'Selecting OUTSIDE';
            btn.className = `region-btn ${region.type}`;
            
            btn.disabled = !region.isSet;
            btn.style.opacity = region.isSet ? '1' : '0.5';
            btn.style.cursor = region.isSet ? 'pointer' : 'not-allowed';
        } else {
            btn.style.display = 'none';
        }
    }

    toPayload() {
        const payload = {};
        this.regions.forEach((region, slot) => {
            payload[slot] = region.toPayload();
        });
        return payload;
    }

    initializeEventListeners() {
        for (let i = 1; i <= 4; i++) {
            const viewport = document.getElementById(`viewport-compImg${i}`);
            if (viewport) {
                viewport.addEventListener('mousedown', (e) => this.drawingManager.startDrawing(e, i));
                viewport.addEventListener('mousemove', (e) => this.drawingManager.updateDrawing(e, i));
                viewport.addEventListener('mouseup', () => this.drawingManager.finishDrawing(i));
                
                const overlay = document.getElementById(`overlay-compImg${i}`);
                if (overlay) {
                    overlay.addEventListener('mousedown', (e) => this.drawingManager.startDrawing(e, i));
                    overlay.addEventListener('mousemove', (e) => this.drawingManager.updateDrawing(e, i));
                    overlay.addEventListener('mouseup', () => this.drawingManager.finishDrawing(i));
                }
            }
        }
    }
}

/**
 * Manages mixing operations
 */
class MixingManager {
    constructor() {
        this.pollingInterval = null;
        this.currentJobId = 0;
        this.isMixing = false;
    }

    async requestMix(regionManager, targetOutput, currentMixingMode) {
        console.log('Mix Images button clicked');
        
        // Cancel any ongoing mixing
        this.cancelCurrentMix();
        
        // Increment job ID for new job
        this.currentJobId++;
        const jobId = this.currentJobId;
        
        console.log(`Starting Job #${jobId}`);
        
        // Reset mixing lock
        this.isMixing = false;

        // Reset progress bar
        this.resetProgressBar();

        // Prepare payload
        const payload = {
            mode: this.getSliderValue('mixMode'),
            target_output: targetOutput,
            mixing_mode: currentMixingMode,
            regions: regionManager.toPayload(),
            wa1: this.getSliderValue('wa1'),
            wa2: this.getSliderValue('wa2'),
            wa3: this.getSliderValue('wa3'),
            wa4: this.getSliderValue('wa4'),
            wb1: this.getSliderValue('wb1'),
            wb2: this.getSliderValue('wb2'),
            wb3: this.getSliderValue('wb3'),
            wb4: this.getSliderValue('wb4')
        };

        console.log(`Job #${jobId} - Starting new mix with payload:`, payload);

        // Set mixing lock
        this.isMixing = true;

        try {
            // Start mixing on backend
            console.log(`Job #${jobId} - Sending request to backend...`);
            await this.startMixingOnBackend(payload);
            
            console.log(`Job #${jobId} - Backend processing started, beginning progress polling...`);
            
            // Start polling for progress
            this.startPolling(jobId, targetOutput);
            
        } catch (error) {
            console.error(`Job #${jobId} - Error starting mix:`, error);
            this.isMixing = false;
            alert(`Error starting mix: ${error.message}`);
        }
    }

    getSliderValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : 0;
    }

    cancelCurrentMix() {
        if (this.pollingInterval) {
            console.log(`Cancelling previous mixing process for Job #${this.currentJobId}`);
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    resetProgressBar() {
        const pbar = document.getElementById('pbar');
        if (pbar) {
            pbar.style.width = "0%";
            // Optional: Update progress bar text to show current job
            pbar.setAttribute('data-current-job', this.currentJobId);
        }
    }

    async startMixingOnBackend(payload) {
        const response = await fetch('/mix', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status} ${errorText}`);
        }

        return await response.json();
    }

    startPolling(jobId, targetOutput) {
        this.pollingInterval = setInterval(async () => {
            // Stop if a newer job started
            if (jobId !== this.currentJobId) {
                console.log(`Job #${jobId} - Stopping polling (replaced by Job #${this.currentJobId})`);
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
                return;
            }

            try {
                const data = await this.fetchMixStatus();
                
                // Log progress periodically (every 5% or when it changes significantly)
                if (data.progress % 10 === 0 || data.progress === 100) {
                    console.log(`Job #${jobId} - Progress: ${data.progress}%`);
                }
                
                // Update progress bar
                this.updateProgressBar(data.progress);
                
                // Stop polling when job is done
                if (!data.running) {
                    this.handleMixCompletion(jobId, data, targetOutput);
                }
                
            } catch (error) {
                console.error(`Job #${jobId} - Error polling mix status:`, error);
                this.cleanupPolling(jobId);
            }
        }, 150);
    }

    async fetchMixStatus() {
        const res = await fetch('/mix_status');
        if (!res.ok) {
            throw new Error(`Status fetch failed: ${res.status}`);
        }
        return await res.json();
    }

    updateProgressBar(progress) {
        const pbar = document.getElementById('pbar');
        if (pbar) pbar.style.width = `${progress}%`;
    }

    handleMixCompletion(jobId, data, targetOutput) {
        console.log(`Job #${jobId} - Completed with ${data.progress}% progress`);
        this.cleanupPolling(jobId);

        if (data.result) {
            console.log(`Job #${jobId} - Result received, updating output image...`);
            this.updateOutputImage(data.result, targetOutput);
        } else {
            console.warn(`Job #${jobId} - Mix finished but no result returned`);
        }

        this.resetProgressBarWithDelay(jobId);
    }

    updateOutputImage(base64Image, targetOutput) {
        const outEl = document.getElementById('outImg' + targetOutput);
        if (outEl) {
            outEl.src = "data:image/png;base64," + base64Image;
            
            // Apply brightness/contrast if state exists
            const bcKey = 'outImg' + targetOutput;
            if (bcState[bcKey]) {
                const { b, c } = bcState[bcKey];
                outEl.style.filter = `brightness(${b}%) contrast(${c}%)`;
            }
        }
        
        // Update component view
        updateOutputCompView(targetOutput);
    }

    resetProgressBarWithDelay(jobId) {
        setTimeout(() => {
            const pbar = document.getElementById('pbar');
            if (pbar) {
                pbar.style.width = "0%";
                console.log(`Job #${jobId} - Progress bar reset`);
            }
        }, 300);
    }

    cleanupPolling(jobId) {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isMixing = false;
        if (jobId) {
            console.log(`Job #${jobId} - Cleanup complete`);
        }
    }
}

/**
 * Manages application state and coordinates all managers
 */
class AppState {
    constructor() {
        this.currentSlot = 1;
        this.targetOutput = 1;
        this.currentMixingMode = 'basic';
        
        this.bcState = new BrightnessContrastState();
        this.regionManager = new RegionManager();
        this.mixingManager = new MixingManager();
        
        this.dragTarget = null;
        this.startX = 0;
        this.startY = 0;
    }

    selectOutput(id) {
        this.targetOutput = id;
        document.querySelectorAll('.active-output')
            .forEach(el => el.classList.remove('active-output'));
        document.getElementById('outCard' + id).classList.add('active-output');
        updateOutputCompView(id);
    }

    toggleMixingMode() {
        const toggle = document.getElementById('modeToggle');
        this.currentMixingMode = toggle.checked ? 'region' : 'basic';
        
        this.updateModeUI();
        this.regionManager.setMode(this.currentMixingMode);
    }

    updateModeUI() {
        const modeLabel = document.querySelector('.mode-label');
        if (modeLabel) {
            modeLabel.textContent = this.currentMixingMode === 'region' ? 'Region Mode' : 'Basic Mode';
        }
        
        const regionInstructions = document.getElementById('regionInstructions');
        if (regionInstructions) {
            regionInstructions.style.display = this.currentMixingMode === 'region' ? 'block' : 'none';
        }
        
        this.updateRegionRectanglesVisibility();
    }

    updateRegionRectanglesVisibility() {
        for (let i = 1; i <= 4; i++) {
            const overlay = document.getElementById(`overlay-compImg${i}`);
            if (overlay) {
                overlay.style.display = this.currentMixingMode === 'region' ? 'block' : 'none';
            }
        }
    }

    requestMix() {
        this.mixingManager.requestMix(this.regionManager, this.targetOutput, this.currentMixingMode);
    }
}

// ==========================================================
// GLOBAL INSTANCES (Replacing old global variables)
// ==========================================================
const appState = new AppState();
const bcState = appState.bcState; // Alias for backward compatibility

// ==========================================================
// UPDATED GLOBAL FUNCTIONS (Using new OOP structure)
// ==========================================================

function startDrag(e, imgId) {
    if(e.button !== 0) return;
    e.preventDefault();
    appState.dragTarget = imgId;
    appState.startX = e.clientX;
    appState.startY = e.clientY;
    if (!bcState.getState(imgId)) bcState.setState(imgId, 100, 100);
}

window.addEventListener('mousemove', (e) => {
    if (!appState.dragTarget) return;

    const dx = e.clientX - appState.startX;
    const dy = appState.startY - e.clientY;
    const sensitivity = 0.5;

    const state = bcState.update(appState.dragTarget, dy * sensitivity, dx * sensitivity);
    
    const el = document.getElementById(appState.dragTarget);
    if(el) {
        el.style.filter = `brightness(${state.b}%) contrast(${state.c}%)`;
    }

    appState.startX = e.clientX;
    appState.startY = e.clientY;
});

window.addEventListener('mouseup', () => { appState.dragTarget = null; });

function updateMode() {
    const mode = document.getElementById('mixMode').value;
    document.getElementById('labelColA').innerText =
        mode === 'magnitude_phase' ? "Magnitude" : "Real";
    document.getElementById('labelColB').innerText =
        mode === 'magnitude_phase' ? "Phase" : "Imaginary";
}

function toggleMixingMode() {
    appState.toggleMixingMode();
}

function toggleRegionType(slot) {
    appState.regionManager.toggleRegionType(slot);
}

function selectOutput(id) {
    appState.selectOutput(id);
}

function requestMix() {
    appState.requestMix();
}

// ==========================================================
// HELPER FUNCTIONS (Remaining unchanged)
// ==========================================================

function upload(id) {
    appState.currentSlot = id;
    document.getElementById('fileInput').click();
}

document.getElementById('fileInput').addEventListener('change', async function() {
    if (!this.files[0]) return;

    const fd = new FormData();
    fd.append('image', this.files[0]);
    fd.append('slot_id', appState.currentSlot);

    try {
        await fetch('/upload', { method: 'POST', body: fd });
        await updateImgSrc(appState.currentSlot, 'original', 'img');
        await updateCompView(appState.currentSlot);
    } catch (e) { console.error(e); }

    this.value = '';
});

async function updateCompView(slot) {
    const type = document.getElementById('sel' + slot).value;
    await updateImgSrc(slot, type, 'compImg');
    setTimeout(() => appState.regionManager.updateRegionUI(slot), 100);
}

async function updateOutputCompView(port) {
    const type = document.getElementById('outSel' + port).value;
    await updateImgSrc(port, type, 'outCompImg', true);
}

async function updateImgSrc(slot, type, prefix, isOutput = false) {
    try {
        const res = await fetch('/get_view', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                slot_id: slot, 
                type: type,
                is_output: isOutput
            })
        });

        if (res.ok) {
            const data = await res.json();
            const el = document.getElementById(prefix + slot);
            if (el) {
                el.src = data.image ? "data:image/png;base64," + data.image : "";
                bcState.applyToElement(prefix + slot, el);
            }
        }
    } catch (e) { console.error(e); }
}

function setupSliderHandlers() {
    const weightSliders = [
        'wa1', 'wa2', 'wa3', 'wa4',
        'wb1', 'wb2', 'wb3', 'wb4'
    ];
    
    weightSliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(sliderId + '-value');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', function() {
                valueDisplay.textContent = this.value + '%';
            });
            
            valueDisplay.textContent = slider.value + '%';
        }
    });
    
    const resetButtons = document.querySelectorAll('.reset-btn');
    resetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sliderId = this.getAttribute('data-slider');
            const slider = document.getElementById(sliderId);
            const defaultValue = this.getAttribute('data-default') || '50';
            
            if (slider) {
                slider.value = defaultValue;
                const valueDisplay = document.getElementById(sliderId + '-value');
                if (valueDisplay) {
                    valueDisplay.textContent = defaultValue + '%';
                }
            }
        });
    });
}

// ==========================================================
// INITIALIZATION
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize region drawing
    appState.regionManager.initializeEventListeners();
    
    // Set up event listeners
    window.addEventListener('resize', () => appState.regionManager.updateAllRegionsUI());
    
    // Initialize mode toggle
    const toggle = document.getElementById('modeToggle');
    if (toggle) {
        toggle.checked = false;
        appState.toggleMixingMode();
    }
    
    // Clear output images on load
    clearOutputComponentImagesOnLoad();
    
    // Set up slider handlers
    setupSliderHandlers();
});

function clearOutputComponentImagesOnLoad() {
    for (let i = 1; i <= 2; i++) {
        const compImg = document.getElementById('outCompImg' + i);
        if (compImg) {
            compImg.src = '';
            compImg.style.filter = '';
        }
        
        bcState.remove('outCompImg' + i);
    }
}

// ==========================================================
// RESET ON REFRESH
// ==========================================================

window.addEventListener("load", () => {
    fetch("/reset", {
        method: "POST"
    }).catch(err => console.error("Reset failed:", err));
});
// ==========================================================
// GLOBAL STATE
// ==========================================================
let currentSlot = 1;
let targetOutput = 1;

let mixingActive = false;
let pollingInterval = null;
let currentJobId = 0;
let isMixing = false; // Lock to prevent multiple simultaneous mixes

let bcState = {};
let dragTarget = null;
let startX = 0, startY = 0;

// Region drawing state
let regionState = {
    isDrawing: false,
    drawingSlot: null,
    startX: 0,
    startY: 0,
    currentRect: null,
    
    // Store individual regions for each component
    regions: {
        1: { type: 'inner', x: 0, y: 0, width: 100, height: 100, isSet: false },
        2: { type: 'inner', x: 0, y: 0, width: 100, height: 100, isSet: false },
        3: { type: 'inner', x: 0, y: 0, width: 100, height: 100, isSet: false },
        4: { type: 'inner', x: 0, y: 0, width: 100, height: 100, isSet: false }
    }
};

// Mixing mode state
let currentMixingMode = 'basic'; // 'basic' or 'region'

// ==========================================================
// BRIGHTNESS / CONTRAST DRAG
// ==========================================================
function startDrag(e, imgId) {
    if(e.button !== 0) return;
    e.preventDefault();
    dragTarget = imgId;
    startX = e.clientX;
    startY = e.clientY;
    if (!bcState[imgId]) bcState[imgId] = { b: 100, c: 100 };
}

window.addEventListener('mousemove', (e) => {
    if (!dragTarget || !bcState[dragTarget]) return;

    const dx = e.clientX - startX;
    const dy = startY - e.clientY;
    const sensitivity = 0.5;

    bcState[dragTarget].c += dx * sensitivity;
    bcState[dragTarget].b += dy * sensitivity;

    bcState[dragTarget].c = Math.max(0, bcState[dragTarget].c);
    bcState[dragTarget].b = Math.max(0, bcState[dragTarget].b);

    const el = document.getElementById(dragTarget);
    if(el) {
        el.style.filter = `brightness(${bcState[dragTarget].b}%) contrast(${bcState[dragTarget].c}%)`;
    }

    startX = e.clientX;
    startY = e.clientY;
});

window.addEventListener('mouseup', () => { dragTarget = null; });

// ==========================================================
// OUTPUT SELECT & MODE
// ==========================================================
function selectOutput(id) {
    targetOutput = id;
    document.querySelectorAll('.active-output')
        .forEach(el => el.classList.remove('active-output'));
    document.getElementById('outCard' + id).classList.add('active-output');
    // Update the output component view for the selected output
    updateOutputCompView(id);
}

function updateMode() {
    const mode = document.getElementById('mixMode').value;
    document.getElementById('labelColA').innerText =
        mode === 'magnitude_phase' ? "Magnitude" : "Real";
    document.getElementById('labelColB').innerText =
        mode === 'magnitude_phase' ? "Phase" : "Imaginary";
    // Remove scheduleMix() - mixing only happens on button click
}

// ==========================================================
// MIXING MODE TOGGLE (Simple switch)
// ==========================================================
function toggleMixingMode() {
    const toggle = document.getElementById('modeToggle');
    currentMixingMode = toggle.checked ? 'region' : 'basic';
    
    // Update mode label
    const modeLabel = document.querySelector('.mode-label');
    if (modeLabel) {
        modeLabel.textContent = currentMixingMode === 'region' ? 'Region Mode' : 'Basic Mode';
    }
    
    // Update region instructions visibility
    const regionInstructions = document.getElementById('regionInstructions');
    if (regionInstructions) {
        if (currentMixingMode === 'region') {
            regionInstructions.style.display = 'block';
        } else {
            regionInstructions.style.display = 'none';
        }
    }
    
    // Update region rectangles visibility
    updateRegionRectanglesVisibility();
    
    // Update all rectangles
    updateAllRectangles();
    
    // Reset all regions to full if switching to basic mode
    if (currentMixingMode === 'basic') {
        for (let i = 1; i <= 4; i++) {
            regionState.regions[i] = {
                type: 'inner',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                isSet: false
            };
            updateRegionButton(i);
        }
    }
    // Remove scheduleMix() - mixing only happens on button click
}

function updateRegionRectanglesVisibility() {
    // Show/hide region rectangles based on mode
    for (let i = 1; i <= 4; i++) {
        const overlay = document.getElementById(`overlay-compImg${i}`);
        if (overlay) {
            if (currentMixingMode === 'region') {
                overlay.style.display = 'block';
            } else {
                overlay.style.display = 'none';
            }
        }
    }
}

// ==========================================================
// UPLOAD HANDLING
// ==========================================================
function upload(id) {
    currentSlot = id;
    document.getElementById('fileInput').click();
}

document.getElementById('fileInput').addEventListener('change', async function() {
    if (!this.files[0]) return;

    const fd = new FormData();
    fd.append('image', this.files[0]);
    fd.append('slot_id', currentSlot);

    try {
        await fetch('/upload', { method: 'POST', body: fd });
        await updateImgSrc(currentSlot, 'original', 'img');
        await updateCompView(currentSlot);
    } catch (e) { console.error(e); }

    this.value = '';
});

async function updateCompView(slot) {
    const type = document.getElementById('sel' + slot).value;
    await updateImgSrc(slot, type, 'compImg');
    // Update rectangle position after image loads
    setTimeout(() => updateRectangle(slot), 100);
}

async function updateOutputCompView(port) {
    const type = document.getElementById('outSel' + port).value;
    await updateImgSrc(port, type, 'outCompImg', true); // true = is_output
}

// UNIFIED FUNCTION FOR BOTH INPUT AND OUTPUT IMAGES
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
                // Set src to empty string if no image (for outputs)
                el.src = data.image ? "data:image/png;base64," + data.image : "";
                
                // Apply brightness/contrast if state exists
                const bcKey = prefix + slot;
                if (bcState[bcKey]) {
                    const { b, c } = bcState[bcKey];
                    el.style.filter = `brightness(${b}%) contrast(${c}%)`;
                }
            }
        }
    } catch (e) { console.error(e); }
}

// ==========================================================
// REGION DRAWING FUNCTIONS (Click and drag to draw)
// ==========================================================
function initializeRegionDrawing() {
    // Add mouse event listeners to each FT viewport
    for (let i = 1; i <= 4; i++) {
        const viewport = document.getElementById(`viewport-compImg${i}`);
        if (viewport) {
            // Add click and drag listeners
            viewport.addEventListener('mousedown', (e) => startRegionDrawing(e, i));
            viewport.addEventListener('mousemove', (e) => updateRegionDrawing(e, i));
            viewport.addEventListener('mouseup', (e) => finishRegionDrawing(e, i));
            
            // Also listen on the overlay
            const overlay = document.getElementById(`overlay-compImg${i}`);
            if (overlay) {
                overlay.addEventListener('mousedown', (e) => startRegionDrawing(e, i));
                overlay.addEventListener('mousemove', (e) => updateRegionDrawing(e, i));
                overlay.addEventListener('mouseup', (e) => finishRegionDrawing(e, i));
            }
        }
    }
}

function startRegionDrawing(e, slot) {
    // Only allow drawing in region mode
    if (currentMixingMode !== 'region') return;
    
    if (e.button !== 0) return; // Only left mouse button
    e.preventDefault();
    e.stopPropagation();
    
    const viewport = document.getElementById(`viewport-compImg${slot}`);
    const overlay = document.getElementById(`overlay-compImg${slot}`);
    if (!viewport || !overlay) return;
    
    // Clear any existing rectangle
    const existingRect = overlay.querySelector('.region-rectangle');
    if (existingRect) {
        existingRect.remove();
    }
    
    // Get mouse position relative to viewport
    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Start drawing
    regionState.isDrawing = true;
    regionState.drawingSlot = slot;
    regionState.startX = x;
    regionState.startY = y;
    
    // Create new rectangle element
    const newRect = document.createElement('div');
    newRect.className = `region-rectangle ${regionState.regions[slot].type}`;
    newRect.style.left = `${x}px`;
    newRect.style.top = `${y}px`;
    newRect.style.width = '0px';
    newRect.style.height = '0px';
    
    overlay.appendChild(newRect);
    regionState.currentRect = newRect;
    
    // Add click handler to existing rectangle for dragging
    newRect.addEventListener('mousedown', (e) => startRectangleDrag(e, slot));
}

function updateRegionDrawing(e, slot) {
    // Only update if we're drawing on this slot
    if (!regionState.isDrawing || regionState.drawingSlot !== slot) return;
    if (!regionState.currentRect) return;
    
    const viewport = document.getElementById(`viewport-compImg${slot}`);
    if (!viewport) return;
    
    // Get mouse position relative to viewport
    const rect = viewport.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Calculate rectangle dimensions
    const width = currentX - regionState.startX;
    const height = currentY - regionState.startY;
    
    // Update rectangle
    regionState.currentRect.style.width = `${Math.abs(width)}px`;
    regionState.currentRect.style.height = `${Math.abs(height)}px`;
    
    // Adjust position if drawing left or up
    if (width < 0) {
        regionState.currentRect.style.left = `${currentX}px`;
    }
    if (height < 0) {
        regionState.currentRect.style.top = `${currentY}px`;
    }
}

function finishRegionDrawing(e, slot) {
    if (!regionState.isDrawing || regionState.drawingSlot !== slot) return;
    if (!regionState.currentRect) return;
    
    const viewport = document.getElementById(`viewport-compImg${slot}`);
    const overlay = document.getElementById(`overlay-compImg${slot}`);
    if (!viewport || !overlay) return;
    
    // Get final rectangle position and size
    const viewportRect = viewport.getBoundingClientRect();
    const rect = regionState.currentRect.getBoundingClientRect();
    
    // Convert pixels to percentages
    const xPercent = ((rect.left - viewportRect.left) / viewportRect.width) * 100;
    const yPercent = ((rect.top - viewportRect.top) / viewportRect.height) * 100;
    const widthPercent = (rect.width / viewportRect.width) * 100;
    const heightPercent = (rect.height / viewportRect.height) * 100;
    
    // Store region data
    regionState.regions[slot] = {
        type: regionState.regions[slot].type, // Keep existing type
        x: Math.max(0, Math.min(xPercent, 100)),
        y: Math.max(0, Math.min(yPercent, 100)),
        width: Math.max(1, Math.min(widthPercent, 100)),
        height: Math.max(1, Math.min(heightPercent, 100)),
        isSet: true
    };
    
    // Reset drawing state
    regionState.isDrawing = false;
    regionState.drawingSlot = null;
    regionState.currentRect = null;
    
    // Update the region button
    updateRegionButton(slot);
}

// ==========================================================
// RECTANGLE DRAGGING (After drawing)
// ==========================================================
function startRectangleDrag(e, slot) {
    if (currentMixingMode !== 'region') return;
    
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.target;
    const overlay = document.getElementById(`overlay-compImg${slot}`);
    if (!rect || !overlay) return;
    
    // Store initial positions
    regionState.dragStartX = e.clientX;
    regionState.dragStartY = e.clientY;
    regionState.dragStartLeft = parseFloat(rect.style.left) || 0;
    regionState.dragStartTop = parseFloat(rect.style.top) || 0;
    regionState.draggingRect = rect;
    regionState.draggingSlot = slot;
    
    // Add drag listeners
    document.addEventListener('mousemove', handleRectangleDrag);
    document.addEventListener('mouseup', stopRectangleDrag);
}

function handleRectangleDrag(e) {
    if (!regionState.draggingRect || !regionState.draggingSlot) return;
    
    const slot = regionState.draggingSlot;
    const rect = regionState.draggingRect;
    const overlay = document.getElementById(`overlay-compImg${slot}`);
    if (!overlay) return;
    
    const overlayRect = overlay.getBoundingClientRect();
    const deltaX = e.clientX - regionState.dragStartX;
    const deltaY = e.clientY - regionState.dragStartY;
    
    // Calculate new position
    const newLeft = regionState.dragStartLeft + deltaX;
    const newTop = regionState.dragStartTop + deltaY;
    
    // Constrain within overlay bounds
    const rectWidth = parseFloat(rect.style.width) || 0;
    const rectHeight = parseFloat(rect.style.height) || 0;
    const maxLeft = overlayRect.width - rectWidth;
    const maxTop = overlayRect.height - rectHeight;
    
    rect.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
    rect.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
}

function stopRectangleDrag() {
    if (!regionState.draggingRect || !regionState.draggingSlot) return;
    
    const slot = regionState.draggingSlot;
    const rect = regionState.draggingRect;
    const overlay = document.getElementById(`overlay-compImg${slot}`);
    
    if (rect && overlay) {
        // Convert new position to percentages
        const overlayRect = overlay.getBoundingClientRect();
        const xPercent = (parseFloat(rect.style.left) / overlayRect.width) * 100;
        const yPercent = (parseFloat(rect.style.top) / overlayRect.height) * 100;
        const widthPercent = (parseFloat(rect.style.width) / overlayRect.width) * 100;
        const heightPercent = (parseFloat(rect.style.height) / overlayRect.height) * 100;
        
        // Update stored region
        regionState.regions[slot].x = Math.max(0, Math.min(xPercent, 100));
        regionState.regions[slot].y = Math.max(0, Math.min(yPercent, 100));
        regionState.regions[slot].width = Math.max(1, Math.min(widthPercent, 100));
        regionState.regions[slot].height = Math.max(1, Math.min(heightPercent, 100));
        regionState.regions[slot].isSet = true;
    }
    
    // Clean up
    document.removeEventListener('mousemove', handleRectangleDrag);
    document.removeEventListener('mouseup', stopRectangleDrag);
    regionState.draggingRect = null;
    regionState.draggingSlot = null;
}

// ==========================================================
// REGION MANAGEMENT FUNCTIONS
// ==========================================================
function updateRectangle(slot) {
    const region = regionState.regions[slot];
    const overlay = document.getElementById(`overlay-compImg${slot}`);
    
    if (!overlay) return;
    
    // Clear any existing rectangle
    const existingRect = overlay.querySelector('.region-rectangle');
    if (existingRect) {
        existingRect.remove();
    }
    
    // Only create rectangle if region is set and we're in region mode
    if (region.isSet && currentMixingMode === 'region') {
        // Create rectangle element
        const rect = document.createElement('div');
        rect.className = `region-rectangle ${region.type}`;
        
        // Convert percentages to pixels
        const overlayRect = overlay.getBoundingClientRect();
        const left = (region.x / 100) * overlayRect.width;
        const top = (region.y / 100) * overlayRect.height;
        const width = (region.width / 100) * overlayRect.width;
        const height = (region.height / 100) * overlayRect.height;
        
        rect.style.left = `${left}px`;
        rect.style.top = `${top}px`;
        rect.style.width = `${width}px`;
        rect.style.height = `${height}px`;
        
        // Add drag listener
        rect.addEventListener('mousedown', (e) => startRectangleDrag(e, slot));
        
        overlay.appendChild(rect);
    }
}

function updateAllRectangles() {
    for (let i = 1; i <= 4; i++) {
        updateRectangle(i);
    }
}

function toggleRegionType(slot) {
    // Only allow toggling in region mode when region is set
    if (currentMixingMode !== 'region' || !regionState.regions[slot].isSet) return;
    
    const region = regionState.regions[slot];
    region.type = region.type === 'inner' ? 'outer' : 'inner';
    
    // Update button
    updateRegionButton(slot);
    
    // Update rectangle color
    updateRectangle(slot);
}

function updateRegionButton(slot) {
    const btn = document.getElementById(`region-type${slot}`);
    if (btn) {
        const region = regionState.regions[slot];
        
        // Only show button in region mode
        if (currentMixingMode === 'region') {
            btn.style.display = 'block';
            // Update button text to be more descriptive
            btn.textContent = region.type === 'inner' ? 'Selecting INSIDE' : 'Selecting OUTSIDE';
            btn.className = `region-btn ${region.type}`;
            
            // Enable/disable based on whether region is set
            if (region.isSet) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        } else {
            // Hide button in basic mode
            btn.style.display = 'none';
        }
    }
}

// ==========================================================
// SLIDER HANDLERS
// ==========================================================
function setupSliderHandlers() {
    console.log("Setting up slider handlers...");
    
    // Get all weight sliders
    const weightSliders = [
        'wa1', 'wa2', 'wa3', 'wa4',
        'wb1', 'wb2', 'wb3', 'wb4'
    ];
    
    // Setup handlers for each slider
    weightSliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(sliderId + '-value');
        
        if (slider && valueDisplay) {
            // Update display when slider changes
            slider.addEventListener('input', function() {
                valueDisplay.textContent = this.value + '%';
                // No automatic mixing - only on button click
            });
            
            // Also update on page load to show current value
            valueDisplay.textContent = slider.value + '%';
        }
    });
    
    // Setup reset buttons if they exist
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
    initializeRegionDrawing();
    
    // Update rectangles on window resize
    window.addEventListener('resize', updateAllRectangles);
    
    // Set initial mode
    const toggle = document.getElementById('modeToggle');
    if (toggle) {
        toggle.checked = false;
        toggleMixingMode(); // Initialize with basic mode
    }
    
    // Instead, just clear them
    clearOutputComponentImagesOnLoad();
    
    // Initialize slider handlers
    setupSliderHandlers();
});

// NEW FUNCTION: Clear output component images on page load
function clearOutputComponentImagesOnLoad() {
    // Clear the output component images (but not the main output images)
    for (let i = 1; i <= 2; i++) {
        const compImg = document.getElementById('outCompImg' + i);
        if (compImg) {
            compImg.src = ''; // Clear the src
            compImg.style.filter = ''; // Clear any filters
        }
        
        // Also clear brightness/contrast state for output components
        const bcKey = 'outCompImg' + i;
        delete bcState[bcKey];
    }
}

// ==========================================================
// REALTIME MIX (ONLY ON BUTTON CLICK) - FIXED VERSION
// ==========================================================
async function requestMix() {
    // Prevent multiple simultaneous mixes
    if (isMixing) {
        console.log('Already mixing, please wait...');
        return;
    }
    
    console.log('Mix Images button clicked');
    
    isMixing = true;
    // Increase job id ⇒ this automatically cancels old polling loops
    currentJobId++;
    const jobId = currentJobId;

    // Stop previous polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    // Reset progress bar
    const pbar = document.getElementById('pbar');
    if (pbar) pbar.style.width = "0%";

    // Collect slider values
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : 0;
    };

    // Prepare payload with backward-compatible format
    const payload = {
        mode: getVal('mixMode'),  // Component mode: 'magnitude_phase' or 'real_imag'
        target_output: targetOutput,
        
        // For backward compatibility with old backend
        mask_size: 100,  // Always 100% for basic mode
        mask_inner: true,  // Always inner for basic mode
        
        // New format for region mixing
        mixing_mode: currentMixingMode, // 'basic' or 'region'
        regions: {}
    };

    // Add individual region configurations for all slots
    for (let i = 1; i <= 4; i++) {
        const region = regionState.regions[i];
        
        if (currentMixingMode === 'basic') {
            // Basic mode: use full region for backward compatibility
            payload.regions[i] = {
                type: 'inner',
                x: 0,
                y: 0,
                width: 100,
                height: 100
            };
        } else {
            // Region mode: use user-defined regions
            payload.regions[i] = {
                type: region.type,
                x: region.isSet ? parseFloat(region.x) : 0,
                y: region.isSet ? parseFloat(region.y) : 0,
                width: region.isSet ? parseFloat(region.width) : 100,
                height: region.isSet ? parseFloat(region.height) : 100
            };
        }
    }

    // Add weight sliders (keep old format for backward compatibility)
    payload.wa1 = getVal('wa1');
    payload.wa2 = getVal('wa2');
    payload.wa3 = getVal('wa3');
    payload.wa4 = getVal('wa4');
    payload.wb1 = getVal('wb1');
    payload.wb2 = getVal('wb2');
    payload.wb3 = getVal('wb3');
    payload.wb4 = getVal('wb4');

    console.log('Mixing payload:', payload);

    try {
        // Tell backend to start mixing
        const response = await fetch('/mix', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', response.status, errorText);
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Mix started:', result);

    } catch (error) {
        console.error('Error starting mix:', error);
        isMixing = false;
        alert(`Error starting mix: ${error.message}`);
        return; // Stop if there was an error
    }

    // Start polling for progress + result
    pollingInterval = setInterval(async () => {
        // If a newer job started, stop polling
        if (jobId !== currentJobId) {
            clearInterval(pollingInterval);
            isMixing = false;
            return;
        }

        try {
            const res = await fetch('/mix_status');
            if (!res.ok) {
                console.error('Error fetching mix status:', res.status);
                clearInterval(pollingInterval);
                isMixing = false;
                return;
            }
            
            const data = await res.json();
            console.log('Mix status:', data);

            // Update progress bar
            if (pbar) pbar.style.width = data.progress + "%";

            // ==========================================================
            // FIXED: Stop polling when job is done, regardless of result
            // ==========================================================
            if (!data.running) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                isMixing = false;

                // If we have a result, update the image
                if (data.result) {
                    // Update main output image
                    const outEl = document.getElementById('outImg' + targetOutput);
                    if (outEl) {
                        outEl.src = "data:image/png;base64," + data.result;

                        // Apply brightness/contrast if state exists
                        const bcKey = 'outImg' + targetOutput;
                        if (bcState[bcKey]) {
                            const { b, c } = bcState[bcKey];
                            outEl.style.filter = `brightness(${b}%) contrast(${c}%)`;
                        }
                    }

                    // Update output component view
                    await updateOutputCompView(targetOutput);
                    console.log('Mix completed successfully');
                } else {
                    console.warn("Mix finished but no result returned");
                }

                // Reset bar after a small delay
                setTimeout(() => { if (pbar) pbar.style.width = "0%"; }, 300);
            }
            // ==========================================================
            // END OF FIX
            // ==========================================================
            
        } catch (error) {
            console.error('Error polling mix status:', error);
            clearInterval(pollingInterval);
            pollingInterval = null;
            isMixing = false;
        }

    }, 150); // poll 6 times per second
}
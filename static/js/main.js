// Main application state
const AppState = {
    arrays: [],
    selectedArrayIndex: -1,
    selectedFrequencyIndex: -1,
    currentScenario: null,
    followTarget: false
};

// API base URL
const API_BASE_URL = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    setupEventListeners();
    updatePlots();
});

async function initializeApp() {
    // Load scenarios
    await loadScenarios();

    // Create default array if none exists
    if (AppState.arrays.length === 0) {
        await createDefaultArray();
    }
}

function setupEventListeners() {
    // Array list selection
    document.getElementById('arrayList').addEventListener('change', handleArraySelection);

    // Array management buttons
    document.getElementById('addArrayButton').addEventListener('click', addArray);
    document.getElementById('removeArrayButton').addEventListener('click', removeArray);

    // Array property controls
    ['xPosition', 'yPosition', 'rotation', 'numElements', 'elementSpacing', 'curvature'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateSelectedArray);
    });

    // Beam control
    document.getElementById('steeringAngle').addEventListener('input', updateSteeringAngle);
    document.getElementById('arrayType').addEventListener('change', updateArrayType);

    // Target controls
    document.getElementById('xPosition_target').addEventListener('input', updateTarget);
    document.getElementById('yPosition_target').addEventListener('input', updateTarget);
    document.getElementById('follow_target_checkBox').addEventListener('change', toggleFollowTarget);

    // Frequency controls
    document.getElementById('frequencyList').addEventListener('change', handleFrequencySelection);
    document.getElementById('addFrequencyButton').addEventListener('click', addFrequency);
    document.getElementById('removeFrequencyButton').addEventListener('click', removeFrequency);
    ['frequencyInput', 'amplitudeInput', 'phaseInput'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateSelectedFrequency);
    });
    document.getElementById('frequencyUnit').addEventListener('change', updateFrequencyUnit);

    // Scenario controls
    document.getElementById('scenarioSelect').addEventListener('change', loadSelectedScenario);
    document.getElementById('loadScenarioButton').addEventListener('click', () => loadSelectedScenario());
    document.getElementById('saveScenarioButton').addEventListener('click', saveScenario);

    // Update slider values display
    document.getElementById('rotation').addEventListener('input', function() {
        document.getElementById('rotationValue').textContent = this.value + '°';
    });

    document.getElementById('steeringAngle').addEventListener('input', function() {
        document.getElementById('steeringValue').textContent = this.value + '°';
    });
}

// API Functions
async function fetchArrays() {
    try {
        const response = await axios.get(`${API_BASE_URL}/arrays`);
        AppState.arrays = response.data;
        updateArrayList();
        updateArrayControls();
        return AppState.arrays;
    } catch (error) {
        console.error('Error fetching arrays:', error);
        showError('Failed to load arrays');
        return [];
    }
}

async function createArray(arrayData) {
    try {
        const response = await axios.post(`${API_BASE_URL}/arrays`, arrayData);
        AppState.arrays.push(response.data);
        updateArrayList();
        updateArrayControls();
        return response.data;
    } catch (error) {
        console.error('Error creating array:', error);
        showError('Failed to create array');
        throw error;
    }
}

async function updateArray(index, arrayData) {
    try {
        const response = await axios.put(`${API_BASE_URL}/arrays/${index}`, arrayData);
        AppState.arrays[index] = response.data;
        updateArrayList();
        updateArrayControls();
        return response.data;
    } catch (error) {
        console.error('Error updating array:', error);
        showError('Failed to update array');
        throw error;
    }
}

async function deleteArray(index) {
    try {
        await axios.delete(`${API_BASE_URL}/arrays/${index}`);
        AppState.arrays.splice(index, 1);
        updateArrayList();
        updateArrayControls();
        return true;
    } catch (error) {
        console.error('Error deleting array:', error);
        showError('Failed to delete array');
        return false;
    }
}

async function calculateBeamPattern(index) {
    try {
        const response = await axios.get(`${API_BASE_URL}/calculate/beam-pattern/${index}`);
        return response.data;
    } catch (error) {
        console.error('Error calculating beam pattern:', error);
        showError('Failed to calculate beam pattern');
        throw error;
    }
}

async function calculateField() {
    try {
        const response = await axios.post(`${API_BASE_URL}/calculate/field`, {
            extent: [-15, 15, 0, 10],
            resolution: 200
        });
        return response.data;
    } catch (error) {
        console.error('Error calculating field:', error);
        showError('Failed to calculate field');
        throw error;
    }
}

// UI Update Functions
function updateArrayList() {
    const arrayList = document.getElementById('arrayList');
    arrayList.innerHTML = '';

    AppState.arrays.forEach((array, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Array ${index + 1}`;
        if (index === AppState.selectedArrayIndex) {
            option.selected = true;
        }
        arrayList.appendChild(option);
    });
}

function updateArrayControls() {
    if (AppState.selectedArrayIndex >= 0 && AppState.selectedArrayIndex < AppState.arrays.length) {
        const array = AppState.arrays[AppState.selectedArrayIndex];

        // Update position and rotation controls
        document.getElementById('xPosition').value = array.center[0];
        document.getElementById('yPosition').value = array.center[1];
        document.getElementById('rotation').value = array.rotation;
        document.getElementById('rotationValue').textContent = array.rotation + '°';

        // Update array configuration
        document.getElementById('numElements').value = array.num_elements;
        document.getElementById('elementSpacing').value = array.spacing;
        document.getElementById('curvature').value = array.curvature;

        // Update beam control
        document.getElementById('steeringAngle').value = array.steering_angle;
        document.getElementById('steeringValue').textContent = array.steering_angle + '°';
        document.getElementById('arrayType').value = array.type;

        // Update frequency list
        updateFrequencyList(array.components);
    }
}

function updateFrequencyList(components) {
    const frequencyList = document.getElementById('frequencyList');
    frequencyList.innerHTML = '';

    components.forEach((comp, index) => {
        const option = document.createElement('option');
        option.value = index;
        const freq = formatFrequency(comp.frequency);
        option.textContent = `${comp.amplitude.toFixed(2)} * sin(2π*${freq} + ${comp.phase}°)`;
        if (index === AppState.selectedFrequencyIndex) {
            option.selected = true;
        }
        frequencyList.appendChild(option);
    });

    if (components.length > 0 && AppState.selectedFrequencyIndex >= 0) {
        updateFrequencyControls(components[AppState.selectedFrequencyIndex]);
    }
}

function updateFrequencyControls(component) {
    if (!component) return;

    const freq = component.frequency;
    let displayFreq = freq;
    let unit = 'Hz';

    if (freq >= 1e6) {
        displayFreq = freq / 1e6;
        unit = 'MHz';
    } else if (freq >= 1e3) {
        displayFreq = freq / 1e3;
        unit = 'kHz';
    }

    document.getElementById('frequencyInput').value = displayFreq;
    document.getElementById('frequencyUnit').value = unit;
    document.getElementById('amplitudeInput').value = component.amplitude;
    document.getElementById('phaseInput').value = component.phase;
}

function formatFrequency(freq) {
    if (freq >= 1e6) {
        return (freq / 1e6).toFixed(2) + 'MHz';
    } else if (freq >= 1e3) {
        return (freq / 1e3).toFixed(2) + 'kHz';
    }
    return freq + 'Hz';
}

// Event Handlers
async function handleArraySelection(event) {
    AppState.selectedArrayIndex = parseInt(event.target.value);
    if (AppState.selectedArrayIndex >= 0) {
        updateArrayControls();
        await updatePlots();
    }
}

async function addArray() {
    const newArray = {
        num_elements: 8,
        spacing: 0.2,
        center: [0, 0],
        curvature: 0.0,
        rotation: 0.0,
        type: 'acoustic',
        steering_angle: 0,
        components: [{ frequency: 1000, phase: 0, amplitude: 1 }]
    };

    await createArray(newArray);
    AppState.selectedArrayIndex = AppState.arrays.length - 1;
    updateArrayList();
    updateArrayControls();
    await updatePlots();
}

async function removeArray() {
    if (AppState.selectedArrayIndex >= 0) {
        const confirmed = confirm('Are you sure you want to remove this array?');
        if (confirmed) {
            await deleteArray(AppState.selectedArrayIndex);
            AppState.selectedArrayIndex = Math.max(0, AppState.selectedArrayIndex - 1);
            updateArrayList();
            updateArrayControls();
            await updatePlots();
        }
    }
}

async function updateSelectedArray() {
    if (AppState.selectedArrayIndex >= 0) {
        const arrayData = {
            center: [
                parseFloat(document.getElementById('xPosition').value),
                parseFloat(document.getElementById('yPosition').value)
            ],
            rotation: parseFloat(document.getElementById('rotation').value),
            num_elements: parseInt(document.getElementById('numElements').value),
            spacing: parseFloat(document.getElementById('elementSpacing').value),
            curvature: parseFloat(document.getElementById('curvature').value)
        };

        await updateArray(AppState.selectedArrayIndex, arrayData);
        await updatePlots();
    }
}

async function updateSteeringAngle() {
    if (AppState.selectedArrayIndex >= 0) {
        const angle = parseFloat(document.getElementById('steeringAngle').value);
        await updateArray(AppState.selectedArrayIndex, { steering_angle: angle });
        await updatePlots();
    }
}

async function updateArrayType() {
    if (AppState.selectedArrayIndex >= 0) {
        const type = document.getElementById('arrayType').value;
        await updateArray(AppState.selectedArrayIndex, { type: type });
        await updatePlots();
    }
}

async function updateTarget() {
    if (AppState.followTarget && AppState.selectedArrayIndex >= 0) {
        const targetX = parseFloat(document.getElementById('xPosition_target').value);
        const targetY = parseFloat(document.getElementById('yPosition_target').value);

        // Calculate and set steering angle based on target
        const response = await axios.post(`${API_BASE_URL}/steer-to-target/${AppState.selectedArrayIndex}`, {
            target_x: targetX,
            target_y: targetY
        });

        AppState.arrays[AppState.selectedArrayIndex] = response.data;
        updateArrayControls();
        await updatePlots();
    }
}

function toggleFollowTarget() {
    AppState.followTarget = document.getElementById('follow_target_checkBox').checked;
    document.getElementById('xPosition_target').disabled = !AppState.followTarget;
    document.getElementById('yPosition_target').disabled = !AppState.followTarget;
    document.getElementById('steeringAngle').disabled = AppState.followTarget;
}

function handleFrequencySelection(event) {
    AppState.selectedFrequencyIndex = parseInt(event.target.value);
    if (AppState.selectedFrequencyIndex >= 0 && AppState.selectedArrayIndex >= 0) {
        const array = AppState.arrays[AppState.selectedArrayIndex];
        if (AppState.selectedFrequencyIndex < array.components.length) {
            updateFrequencyControls(array.components[AppState.selectedFrequencyIndex]);
        }
    }
}

async function addFrequency() {
    if (AppState.selectedArrayIndex >= 0) {
        const freqInput = parseFloat(document.getElementById('frequencyInput').value);
        const unit = document.getElementById('frequencyUnit').value;
        let frequency = freqInput;

        if (unit === 'kHz') frequency *= 1000;
        else if (unit === 'MHz') frequency *= 1000000;

        const amplitude = parseFloat(document.getElementById('amplitudeInput').value);
        const phase = parseFloat(document.getElementById('phaseInput').value);

        try {
            await axios.post(`${API_BASE_URL}/arrays/${AppState.selectedArrayIndex}/frequency`, {
                frequency: frequency,
                amplitude: amplitude,
                phase: phase
            });

            await fetchArrays();
            AppState.selectedFrequencyIndex = AppState.arrays[AppState.selectedArrayIndex].components.length - 1;
            updateArrayControls();
            await updatePlots();
        } catch (error) {
            console.error('Error adding frequency:', error);
            showError('Failed to add frequency component');
        }
    }
}

async function updateSelectedFrequency() {
    if (AppState.selectedArrayIndex >= 0 && AppState.selectedFrequencyIndex >= 0) {
        const freqInput = parseFloat(document.getElementById('frequencyInput').value);
        const unit = document.getElementById('frequencyUnit').value;
        let frequency = freqInput;

        if (unit === 'kHz') frequency *= 1000;
        else if (unit === 'MHz') frequency *= 1000000;

        const amplitude = parseFloat(document.getElementById('amplitudeInput').value);
        const phase = parseFloat(document.getElementById('phaseInput').value);

        const array = AppState.arrays[AppState.selectedArrayIndex];
        if (AppState.selectedFrequencyIndex < array.components.length) {
            array.components[AppState.selectedFrequencyIndex] = {
                frequency: frequency,
                amplitude: amplitude,
                phase: phase
            };

            await updateArray(AppState.selectedArrayIndex, { components: array.components });
            updateArrayControls();
            await updatePlots();
        }
    }
}

function updateFrequencyUnit() {
    updateSelectedFrequency();
}

async function removeFrequency() {
    if (AppState.selectedArrayIndex >= 0 && AppState.selectedFrequencyIndex >= 0) {
        try {
            await axios.delete(
                `${API_BASE_URL}/arrays/${AppState.selectedArrayIndex}/frequency/${AppState.selectedFrequencyIndex}`
            );

            await fetchArrays();
            AppState.selectedFrequencyIndex = Math.max(0, AppState.selectedFrequencyIndex - 1);
            updateArrayControls();
            await updatePlots();
        } catch (error) {
            console.error('Error removing frequency:', error);
            showError('Failed to remove frequency component');
        }
    }
}

// Scenario Functions
async function loadScenarios() {
    try {
        const response = await axios.get(`${API_BASE_URL}/scenarios`);
        const scenarioSelect = document.getElementById('scenarioSelect');
        scenarioSelect.innerHTML = '';

        response.data.forEach(scenario => {
            const option = document.createElement('option');
            option.value = scenario;
            option.textContent = scenario;
            scenarioSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading scenarios:', error);
    }
}

async function loadSelectedScenario() {
    const scenarioName = document.getElementById('scenarioSelect').value;
    if (!scenarioName) return;

    try {
        const response = await axios.get(`${API_BASE_URL}/scenarios/${scenarioName}`);
        AppState.arrays = response.data.arrays;
        AppState.currentScenario = scenarioName;

        // Update target controls
        if (response.data.target) {
            document.getElementById('xPosition_target').value = response.data.target.x;
            document.getElementById('yPosition_target').value = response.data.target.y;
        }

        // Update follow target checkbox
        AppState.followTarget = response.data.follow_target || false;
        document.getElementById('follow_target_checkBox').checked = AppState.followTarget;
        document.getElementById('steeringAngle').disabled = AppState.followTarget;
        document.getElementById('xPosition_target').disabled = !AppState.followTarget;
        document.getElementById('yPosition_target').disabled = !AppState.followTarget;

        // Update UI
        AppState.selectedArrayIndex = AppState.arrays.length > 0 ? 0 : -1;
        updateArrayList();
        updateArrayControls();
        await updatePlots();

        showSuccess(`Loaded scenario: ${scenarioName}`);
    } catch (error) {
        console.error('Error loading scenario:', error);
        showError('Failed to load scenario');
    }
}

async function saveScenario() {
    const scenarioName = prompt('Enter scenario name:');
    if (!scenarioName) return;

    try {
        await axios.post(`${API_BASE_URL}/scenarios`, {
            name: scenarioName,
            target: {
                x: parseFloat(document.getElementById('xPosition_target').value),
                y: parseFloat(document.getElementById('yPosition_target').value)
            },
            follow_target: AppState.followTarget
        });

        await loadScenarios();
        showSuccess(`Scenario saved: ${scenarioName}`);
    } catch (error) {
        console.error('Error saving scenario:', error);
        showError('Failed to save scenario');
    }
}

// Plot Functions
async function updatePlots() {
    await updateInterferenceMap();
    if (AppState.selectedArrayIndex >= 0) {
        await updateBeamPattern();
    }
}

async function updateInterferenceMap() {
    try {
        const fieldData = await calculateField();
        if (fieldData.field) {
            Plotly.newPlot('interference-map', [{
                z: fieldData.field,
                type: 'heatmap',
                colorscale: 'Jet',
                zmin: -40,
                zmax: 0,
                x0: fieldData.extent[0],
                dx: (fieldData.extent[1] - fieldData.extent[0]) / (fieldData.field[0].length - 1),
                y0: fieldData.extent[2],
                dy: (fieldData.extent[3] - fieldData.extent[2]) / (fieldData.field.length - 1)
            }], {
                title: 'Interference Map',
                xaxis: { title: 'X (m)' },
                yaxis: { title: 'Y (m)' },
                width: document.getElementById('interference-map').offsetWidth,
                height: document.getElementById('interference-map').offsetHeight
            });
        }
    } catch (error) {
        console.error('Error updating interference map:', error);
    }
}

async function updateBeamPattern() {
    try {
        const patternData = await calculateBeamPattern(AppState.selectedArrayIndex);
        if (patternData.theta && patternData.pattern) {
            // Sort angles and pattern together to ensure proper plotting
            const combined = patternData.theta.map((rad, i) => ({
                theta: rad,
                pattern: patternData.pattern[i]
            }));
            
            // Sort by angle
            combined.sort((a, b) => a.theta - b.theta);
            
            const sortedTheta = combined.map(item => item.theta);
            const sortedPattern = combined.map(item => item.pattern);
            
            PlotUtils.createBeamPattern({
                theta: sortedTheta,
                pattern: sortedPattern
            }, 'beam-pattern');
        }
    } catch (error) {
        console.error('Error updating beam pattern:', error);
    }
}

// Utility Functions
async function createDefaultArray() {
    const defaultArray = {
        num_elements: 8,
        spacing: 0.2,
        center: [0, 0],
        curvature: 0.0,
        rotation: 0.0,
        type: 'acoustic',
        steering_angle: 0,
        components: [{ frequency: 1000, phase: 0, amplitude: 1 }]
    };

    await createArray(defaultArray);
    AppState.selectedArrayIndex = 0;
}

function showError(message) {
    alert(`Error: ${message}`);
}

function showSuccess(message) {
    console.log(`Success: ${message}`);
    // You can implement a more sophisticated notification system here
}
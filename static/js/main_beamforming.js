class BeamFormingApp {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentState = {};
        this.isUpdating = false;
        this.defaultScenario = 'custom';

        
        this.initializeElements();
        this.bindEvents();
        this.initializeApp();
    
    }

    
    
    initializeElements() {
        // Wave map elements
        this.waveMapImage = document.getElementById('waveMapImage');
        
        // Beam profile elements
        this.beamProfileImage = document.getElementById('beamProfileImage');
        
        // Control elements
        this.frequencySlider = document.getElementById('frequencySlider');
        this.frequencyValue = document.getElementById('frequencyValue');
        
        this.phaseShiftSlider = document.getElementById('phaseShiftSlider');
        this.phaseShiftValue = document.getElementById('phaseShiftValue');
        
        this.distanceSlider = document.getElementById('distanceSlider');
        this.distanceValue = document.getElementById('distanceValue');
        
        this.radiusSlider = document.getElementById('radiusSlider');
        this.radiusValue = document.getElementById('radiusValue');
        
        this.geometrySelect = document.getElementById('geometrySelect');
        this.radiusContainer = document.getElementById('radiusContainer');
        
        this.addTransmitterBtn = document.getElementById('addTransmitterBtn');
        this.removeTransmitterBtn = document.getElementById('removeTransmitterBtn');
        this.transmitterCount = document.getElementById('transmitterCount');
        
        this.scenarioSelect = document.getElementById('scenarioSelect');
        this.loadScenarioBtn = document.getElementById('loadScenarioBtn');
        
        this.statusIndicator = document.getElementById('statusIndicator');
    }
    
    bindEvents() {
        // Slider events
        this.frequencySlider.addEventListener('input', (e) => this.updateFrequency(e.target.value));
        this.phaseShiftSlider.addEventListener('input', (e) => this.updatePhaseShift(e.target.value));
        this.distanceSlider.addEventListener('input', (e) => this.updateDistance(e.target.value));
        this.radiusSlider.addEventListener('input', (e) => this.updateRadius(e.target.value));
        
        // Select events
        this.geometrySelect.addEventListener('change', (e) => this.updateGeometry(e.target.value));
        
        // Button events
        this.addTransmitterBtn.addEventListener('click', () => this.addTransmitter());
        this.removeTransmitterBtn.addEventListener('click', () => this.removeTransmitter());
        this.loadScenarioBtn.addEventListener('click', () => this.loadScenario());
    }
    
    async initializeApp() {
        this.updateStatus('Initializing application...', 'info');

        try {
            // 1️⃣ Reset backend state
            await fetch(`${this.baseUrl}/reset`, { method: 'POST' });

            // 2️⃣ Set scenario selector to default
            this.scenarioSelect.value = this.defaultScenario;

            // 3️⃣ Load default scenario automatically
            await fetch(`${this.baseUrl}/load_scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario: this.defaultScenario })
            });

            // 4️⃣ Fetch updated state and visuals
            await this.fetchInitialState();
            await this.updateVisualizations();

            this.updateStatus('Ready (Custom scenario loaded)', 'success');
        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus('Initialization failed', 'error');
        }
    }

    
    async fetchInitialState() {
        try {
            const response = await fetch(`${this.baseUrl}/phased_array`);
            this.currentState = await response.json();
            this.updateControlValues();
        } catch (error) {
            console.error('Failed to fetch initial state:', error);
            throw error;
        }
    }
    
    updateControlValues() {
        // Update slider values
        this.frequencySlider.value = this.currentState.current_frequency;
        this.frequencyValue.textContent = this.currentState.current_frequency.toFixed(1);
        
        this.phaseShiftSlider.value = this.currentState.phase_shift;
        this.phaseShiftValue.textContent = (this.currentState.phase_shift / Math.PI).toFixed(1) + 'π';
        
        this.distanceSlider.value = this.currentState.distance;
        this.distanceValue.textContent = this.currentState.distance.toFixed(2);
        
        this.radiusSlider.value = this.currentState.radius;
        this.radiusValue.textContent = this.currentState.radius.toFixed(1);
        
        // Update geometry
        this.geometrySelect.value = this.currentState.geometry;
        this.toggleRadiusVisibility(this.currentState.geometry === 'Curvilinear');
        
        // Update transmitter count
        this.transmitterCount.textContent = this.currentState.transmitter_count;
    }
    
    toggleRadiusVisibility(show) {
        if (show) {
            this.radiusContainer.style.display = 'block';
        } else {
            this.radiusContainer.style.display = 'none';
        }
    }
    
    async updateFrequency(value) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.frequencyValue.textContent = value;
        
        try {
            await fetch(`${this.baseUrl}/update_frequency`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ frequency: parseFloat(value) })
            });
            
            await this.updateVisualizations();
        } catch (error) {
            console.error('Failed to update frequency:', error);
            this.updateStatus('Update failed', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async updatePhaseShift(value) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.phaseShiftValue.textContent = (value / Math.PI).toFixed(1) + 'π';
        
        try {
            await fetch(`${this.baseUrl}/update_phase_shift`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ phase_shift: parseFloat(value) })
            });
            
            await this.updateVisualizations();
        } catch (error) {
            console.error('Failed to update phase shift:', error);
            this.updateStatus('Update failed', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async updateDistance(value) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.distanceValue.textContent = value;
        
        try {
            await fetch(`${this.baseUrl}/update_distance`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ distance: parseFloat(value) })
            });
            
            await this.updateVisualizations();
        } catch (error) {
            console.error('Failed to update distance:', error);
            this.updateStatus('Update failed', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async updateRadius(value) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.radiusValue.textContent = value;
        
        try {
            await fetch(`${this.baseUrl}/update_radius`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ radius: parseFloat(value) })
            });
            
            await this.updateVisualizations();
        } catch (error) {
            console.error('Failed to update radius:', error);
            this.updateStatus('Update failed', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async updateGeometry(value) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.toggleRadiusVisibility(value === 'Curvilinear');
        
        try {
            await fetch(`${this.baseUrl}/update_geometry`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ geometry: value })
            });
            
            await this.updateVisualizations();
        } catch (error) {
            console.error('Failed to update geometry:', error);
            this.updateStatus('Update failed', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async addTransmitter() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.updateStatus('Adding transmitter...', 'info');
        
        try {
            const distance = parseFloat(this.distanceSlider.value);
            const radius = parseFloat(this.radiusSlider.value);
            
            const response = await fetch(`${this.baseUrl}/add_transmitter`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ distance, radius })
            });
            
            const data = await response.json();
            this.transmitterCount.textContent = data.count;
            
            await this.updateVisualizations();
            this.updateStatus('Transmitter added', 'success');
        } catch (error) {
            console.error('Failed to add transmitter:', error);
            this.updateStatus('Failed to add transmitter', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async removeTransmitter() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.updateStatus('Removing transmitter...', 'info');
        
        try {
            const distance = parseFloat(this.distanceSlider.value);
            const radius = parseFloat(this.radiusSlider.value);
            
            const response = await fetch(`${this.baseUrl}/remove_transmitter`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ distance, radius })
            });
            
            const data = await response.json();
            this.transmitterCount.textContent = data.count;
            
            await this.updateVisualizations();
            this.updateStatus('Transmitter removed', 'success');
        } catch (error) {
            console.error('Failed to remove transmitter:', error);
            this.updateStatus('Failed to remove transmitter', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async loadScenario() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        const scenario = this.scenarioSelect.value;
        this.updateStatus(`Loading ${scenario.replace('_', ' ')} scenario...`, 'info');
        
        try {
            await fetch(`${this.baseUrl}/load_scenario`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ scenario })
            });
            
            await this.fetchInitialState();
            await this.updateVisualizations();
            this.updateStatus('Scenario loaded successfully', 'success');
        } catch (error) {
            console.error('Failed to load scenario:', error);
            this.updateStatus('Failed to load scenario', 'error');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async updateVisualizations() {
        try {
            // Update wave map
            const waveMapResponse = await fetch(`${this.baseUrl}/wave_map`);
            const waveMapData = await waveMapResponse.json();
            this.waveMapImage.src = waveMapData.image;
            
            // Update beam profile
            const beamProfileResponse = await fetch(`${this.baseUrl}/beam_profile`);
            const beamProfileData = await beamProfileResponse.json();
            this.beamProfileImage.src = beamProfileData.image;
            
        } catch (error) {
            console.error('Failed to update visualizations:', error);
            throw error;
        }
    }
    
    
    updateStatus(message, type = 'info') {
        const statusText = this.statusIndicator.querySelector('.status-text');
        const statusDot = this.statusIndicator.querySelector('.status-dot');
        
        statusText.textContent = message;
        
        // Remove all color classes
        statusDot.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500');
        
        // Add appropriate color class
        switch(type) {
            case 'success':
                statusDot.classList.add('bg-green-500');
                break;
            case 'warning':
                statusDot.classList.add('bg-yellow-500');
                break;
            case 'error':
                statusDot.classList.add('bg-red-500');
                break;
            default:
                statusDot.classList.add('bg-blue-500');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BeamFormingApp();
});


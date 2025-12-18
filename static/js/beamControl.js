// Beam Control specific functionality
class BeamControl {
    constructor(arrayManager) {
        this.arrayManager = arrayManager;
    }

    async setSteeringAngle(angle) {
        const array = this.arrayManager.getSelectedArray();
        if (array) {
            try {
                const response = await axios.put(`/api/arrays/${this.arrayManager.selectedIndex}`, {
                    steering_angle: angle
                });
                return response.data;
            } catch (error) {
                console.error('Error setting steering angle:', error);
                throw error;
            }
        }
    }

    async setArrayType(type) {
        const array = this.arrayManager.getSelectedArray();
        if (array) {
            try {
                const response = await axios.put(`/api/arrays/${this.arrayManager.selectedIndex}`, {
                    type: type
                });
                return response.data;
            } catch (error) {
                console.error('Error setting array type:', error);
                throw error;
            }
        }
    }

    async addFrequencyComponent(frequency, amplitude = 1, phase = 0) {
        const array = this.arrayManager.getSelectedArray();
        if (array) {
            try {
                const response = await axios.post(`/api/arrays/${this.arrayManager.selectedIndex}/frequency`, {
                    frequency: frequency,
                    amplitude: amplitude,
                    phase: phase
                });
                return response.data;
            } catch (error) {
                console.error('Error adding frequency component:', error);
                throw error;
            }
        }
    }

    async removeFrequencyComponent(index) {
        const array = this.arrayManager.getSelectedArray();
        if (array) {
            try {
                await axios.delete(`/api/arrays/${this.arrayManager.selectedIndex}/frequency/${index}`);
                return true;
            } catch (error) {
                console.error('Error removing frequency component:', error);
                throw error;
            }
        }
    }
}
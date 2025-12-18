// Array Manager specific functionality
class ArrayManager {
    constructor() {
        this.arrays = [];
        this.selectedIndex = -1;
    }

    async addArray(arrayData) {
        try {
            const response = await axios.post('/api/arrays', arrayData);
            this.arrays.push(response.data);
            return response.data;
        } catch (error) {
            console.error('Error adding array:', error);
            throw error;
        }
    }

    async updateArray(index, arrayData) {
        if (index >= 0 && index < this.arrays.length) {
            try {
                const response = await axios.put(`/api/arrays/${index}`, arrayData);
                this.arrays[index] = response.data;
                return response.data;
            } catch (error) {
                console.error('Error updating array:', error);
                throw error;
            }
        }
    }

    async deleteArray(index) {
        if (index >= 0 && index < this.arrays.length) {
            try {
                await axios.delete(`/api/arrays/${index}`);
                this.arrays.splice(index, 1);
                return true;
            } catch (error) {
                console.error('Error deleting array:', error);
                throw error;
            }
        }
    }

    selectArray(index) {
        if (index >= 0 && index < this.arrays.length) {
            this.selectedIndex = index;
            return this.arrays[index];
        }
        return null;
    }

    getSelectedArray() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.arrays.length) {
            return this.arrays[this.selectedIndex];
        }
        return null;
    }

    getAllArrays() {
        return [...this.arrays];
    }
}
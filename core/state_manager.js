export class StateManager {
    constructor(initialState) {
        this.state = JSON.parse(JSON.stringify(initialState));
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    /**
     * Update a specific path in the state
     * @param {string} path - e.g., 'data.currentAge'
     * @param {any} value 
     */
    update(path, value) {
        const parts = path.split('.');
        let current = this.state;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        this.notify();
    }

    /**
     * Replace the entire data object (useful for loading)
     * @param {object} newData 
     */
    setData(newData) {
        this.state.data = JSON.parse(JSON.stringify(newData));
        this.notify();
    }

    subscribe(callback) {
        this.listeners.push(callback);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify() {
        this.listeners.forEach(callback => callback(this.state));
    }
}

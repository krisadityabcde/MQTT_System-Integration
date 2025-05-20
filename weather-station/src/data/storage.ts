class DataStorage {
    private data: any[] = [];

    saveData(sensorData: any) {
        this.data.push(sensorData);
    }

    retrieveData(): any[] {
        return this.data;
    }
}

export default DataStorage;
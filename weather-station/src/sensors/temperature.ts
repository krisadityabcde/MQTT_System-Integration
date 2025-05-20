export class TemperatureSensor {
    private temperature: number;

    constructor() {
        this.temperature = 0;
    }

    readTemperature(): number {
        // Simulate reading temperature from a sensor
        // More realistic temperature values: between 18 and 32 degrees Celsius
        this.temperature = 18 + Math.random() * 14;
        return this.temperature;
    }

    calibrate(offset: number): void {
        // Adjust the temperature reading by the offset
        this.temperature += offset;
    }
}
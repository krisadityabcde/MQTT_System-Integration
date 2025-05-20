export class HumiditySensor {
    private humidity: number;

    constructor() {
        this.humidity = 0;
    }

    readHumidity(): number {
        // Simulate reading humidity from a sensor
        // More realistic humidity values: between 40% and 85%
        this.humidity = 40 + Math.random() * 45;
        return this.humidity;
    }

    calibrate(): void {
        // Simulate calibration process
        console.log("Calibrating humidity sensor...");
    }
}
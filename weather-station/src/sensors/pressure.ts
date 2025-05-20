export class PressureSensor {
    private pressure: number;

    constructor() {
        this.pressure = 0;
    }

    readPressure(): number {
        // Simulate reading pressure from a sensor
        // Realistic atmospheric pressure values: around 1000-1030 hPa
        this.pressure = 1000 + Math.random() * 30;
        return this.pressure;
    }

    calibrate(): void {
        // Simulate calibration process
        console.log("Calibrating pressure sensor...");
    }
}
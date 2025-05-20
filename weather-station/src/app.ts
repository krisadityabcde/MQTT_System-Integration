import { TemperatureSensor } from './sensors/temperature';
import { HumiditySensor } from './sensors/humidity';
import { PressureSensor } from './sensors/pressure';
import DataStorage from './data/storage';
import { Logger } from './data/logging';
import Dashboard from './display/dashboard';
import { Alerts } from './display/alerts';
import { setupRoutes } from './api/routes';
import { startServer } from './api/server';

class WeatherStation {
    private temperatureSensor: TemperatureSensor;
    private humiditySensor: HumiditySensor;
    private pressureSensor: PressureSensor;
    private dataStorage: DataStorage;
    private logger: Logger;
    private dashboard: Dashboard;
    private alerts: Alerts;

    constructor() {
        this.temperatureSensor = new TemperatureSensor();
        this.humiditySensor = new HumiditySensor();
        this.pressureSensor = new PressureSensor();
        this.dataStorage = new DataStorage();
        this.logger = new Logger();
        this.dashboard = new Dashboard();
        this.alerts = new Alerts();
    }

    public initialize() {
        // Initialize sensors, data storage, logging, display, and API server
        this.setupSensors();
        this.setupAPI();
        this.setupDisplay();
    }

    private setupSensors() {
        // Example of reading sensor data and storing it
        const temperature = this.temperatureSensor.readTemperature();
        const humidity = this.humiditySensor.readHumidity();
        const pressure = this.pressureSensor.readPressure();

        this.dataStorage.saveData({ temperature, humidity, pressure });
        this.logger.logData({ temperature, humidity, pressure });
    }

    private setupAPI() {
        startServer();
    }

    private setupDisplay() {
        const temperature = this.temperatureSensor.readTemperature();
        const humidity = this.humiditySensor.readHumidity();
        const pressure = this.pressureSensor.readPressure();
        this.dashboard.updateDisplay(temperature, humidity, pressure);
        this.alerts.triggerAlert('Sensor data updated');
    }
}

const weatherStation = new WeatherStation();
weatherStation.initialize();
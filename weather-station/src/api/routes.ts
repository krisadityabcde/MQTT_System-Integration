import { Router, Request, Response, Application } from 'express';
import { TemperatureSensor } from '../sensors';
import { HumiditySensor } from '../sensors';
import { PressureSensor } from '../sensors';
import DataStorage from '../data/storage';
import { Logger } from '../data/logging';

const router = Router();
const temperatureSensor = new TemperatureSensor();
const humiditySensor = new HumiditySensor();
const pressureSensor = new PressureSensor();
const dataStorage = new DataStorage();
const logger = new Logger();

router.get('/temperature', (_req: Request, res: Response) => {
    const temperature = temperatureSensor.readTemperature();
    res.json({ temperature });
});

router.get('/humidity', (_req: Request, res: Response) => {
    const humidity = humiditySensor.readHumidity();
    res.json({ humidity });
});

router.get('/pressure', (_req: Request, res: Response) => {
    const pressure = pressureSensor.readPressure();
    res.json({ pressure });
});

router.post('/data', (req: Request, res: Response) => {
    const { type, value } = req.body;
    dataStorage.saveData({ type, value });
    logger.logData(`Saved ${type}: ${value}`);
    res.status(201).send('Data saved');
});

export function setupRoutes(app: Application) {
    app.use('/api', router);
}
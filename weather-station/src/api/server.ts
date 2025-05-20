import express from 'express';
import { setupRoutes } from './routes';
import http from 'http';
import path from 'path';
import { Server as SocketServer } from 'socket.io';
import * as mqtt from 'mqtt';
import { TemperatureSensor, HumiditySensor, PressureSensor } from '../sensors';

export function startServer() {
    const app = express();
    const server = http.createServer(app);
    const io = new SocketServer(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    const port = process.env.PORT || 3000;

    // Serve static files
    app.use(express.static(path.join(__dirname, '../../public')));
    
    // Setup API routes
    setupRoutes(app);

    // Create sensor instances
    const temperatureSensor = new TemperatureSensor();
    const humiditySensor = new HumiditySensor();
    const pressureSensor = new PressureSensor();

    // Connect to MQTT broker
    const mqttClient = mqtt.connect('mqtt://localhost:1883');
    
    // Subscribe to sensor topics
    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        mqttClient.subscribe('weather/temperature');
        mqttClient.subscribe('weather/humidity');
        mqttClient.subscribe('weather/pressure');
        mqttClient.subscribe('weather/all');
    });

    // Global interval for sending data
    let sensorDataInterval: NodeJS.Timeout | null = null;
    
    function startDataBroadcast() {
        if (!sensorDataInterval) {
            sensorDataInterval = setInterval(() => {
                const temperature = temperatureSensor.readTemperature();
                const humidity = humiditySensor.readHumidity();
                const pressure = pressureSensor.readPressure();
                
                const data = { temperature, humidity, pressure };
                
                console.log('Broadcasting sensor data:', data);
                
                // Publish to MQTT
                mqttClient.publish('weather/all', JSON.stringify(data));
                
                // Broadcast to ALL connected clients
                io.emit('sensorData', data);
            }, 1000);
            console.log("Started sensor data broadcast");
        }
    }

    // Handle socket connections
    io.on('connection', (socket) => {
        console.log('Client connected to dashboard');
        
        // Start broadcasting if not already started
        startDataBroadcast();
        
        // Clean up on disconnect
        socket.on('disconnect', () => {
            console.log('Client disconnected');
            // Only stop interval if no clients are connected
            if (io.sockets.sockets.size === 0) {
                if (sensorDataInterval) {
                    clearInterval(sensorDataInterval);
                    sensorDataInterval = null;
                    console.log("Stopped sensor data broadcast - no clients connected");
                }
            }
        });
    });

    // Handle MQTT messages
    mqttClient.on('message', (topic, message) => {
        console.log(`Received message from ${topic}: ${message.toString()}`);
        
        // Parse incoming MQTT message and broadcast to clients
        if (topic === 'weather/all') {
            try {
                const data = JSON.parse(message.toString());
                io.emit('sensorData', data);
                console.log('Forwarded MQTT message to all clients:', data);
            } catch (err) {
                console.error('Error parsing MQTT message:', err);
            }
        }
    });

    // Start the server
    server.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}
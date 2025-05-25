import express from 'express';
import { setupRoutes } from './routes';
import http from 'http';
import path from 'path';
import { Server as SocketServer } from 'socket.io';
import * as mqtt from 'mqtt';
import { TemperatureSensor, HumiditySensor, PressureSensor } from '../sensors';
import { MqttService } from '../mqtt/mqtt-service';

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
    const pressureSensor = new PressureSensor();    // Create an instance of MqttService
    const mqttService = new MqttService({
        clientId: `weather-station-${Math.random().toString(16).substr(2, 8)}`,
        host: 'localhost',
        port: 1883,
        protocol: 'mqtt'
    });
    
    // Get the MQTT client from the service
    const mqttClient = mqttService.getClient();
    
    // Set up Will message and status on connect
    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        
        // Subscribe to topics with different QoS levels
        mqttService.subscribe('weather/temperature', 0); // QoS 0 - At most once delivery
        mqttService.subscribe('weather/humidity', 1);    // QoS 1 - At least once delivery
        mqttService.subscribe('weather/pressure', 2);    // QoS 2 - Exactly once delivery
        mqttService.subscribe('weather/all', 1);         // QoS 1 for all sensor data
        mqttService.subscribe('weather/control', 1);     // QoS 1 for control messages
        
        // Set up request handler for on-demand readings
        mqttService.onRequest('weather/request/reading', async (request) => {
            const temperature = temperatureSensor.readTemperature();
            const humidity = humiditySensor.readHumidity();
            const pressure = pressureSensor.readPressure();
            
            return { 
                temperature, 
                humidity, 
                pressure,
                timestamp: new Date().toISOString(),
                requestId: request.requestId
            };
        });
    });

    // Global interval for sending data
    let sensorDataInterval: NodeJS.Timeout | null = null;
      function startDataBroadcast() {
        if (!sensorDataInterval) {
            sensorDataInterval = setInterval(() => {
                const temperature = temperatureSensor.readTemperature();
                const humidity = humiditySensor.readHumidity();
                const pressure = pressureSensor.readPressure();
                const timestamp = new Date().toISOString();
                
                // Prepare individual sensor data
                const temperatureData = { temperature, timestamp };
                const humidityData = { humidity, timestamp };
                const pressureData = { pressure, timestamp };
                const allData = { temperature, humidity, pressure, timestamp };
                
                console.log('Broadcasting sensor data:', allData);
                
                // Publish to MQTT with different QoS levels
                // Temperature with QoS 0 (at most once) - not retained
                mqttService.publish('weather/temperature', JSON.stringify(temperatureData), { 
                    qos: 0,
                    retain: false 
                });
                
                // Humidity with QoS 1 (at least once) - retained
                mqttService.publish('weather/humidity', JSON.stringify(humidityData), { 
                    qos: 1,
                    retain: true,
                    properties: {
                        messageExpiryInterval: 3600 // 1 hour expiry
                    }
                });
                
                // Pressure with QoS 2 (exactly once) - retained
                mqttService.publish('weather/pressure', JSON.stringify(pressureData), { 
                    qos: 2,
                    retain: true,
                    properties: {
                        messageExpiryInterval: 3600 // 1 hour expiry
                    }
                });
                
                // All data with QoS 1 - not retained
                mqttService.publish('weather/all', JSON.stringify(allData), { 
                    qos: 1,
                    retain: false,
                    properties: {
                        messageExpiryInterval: 300 // 5 minutes expiry
                    }
                });
                
                // Broadcast to ALL connected clients via Socket.io
                io.emit('sensorData', allData);
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
    });    // Handle MQTT messages
    mqttClient.on('message', (topic, message, packet) => {
        console.log(`Received message from ${topic}: ${message.toString()}`);
        console.log(`Message properties: QoS=${packet.qos}, Retained=${packet.retain}`);
        
        try {
            const data = JSON.parse(message.toString());
            
            // Add metadata to the message for UI display
            const enhancedData = {
                ...data,
                _meta: {
                    topic,
                    qos: packet.qos,
                    retained: packet.retain,
                    receivedAt: new Date().toISOString()
                }
            };
            
            // Handle different topics
            switch(topic) {
                case 'weather/all':
                    io.emit('sensorData', enhancedData);
                    console.log('Forwarded combined sensor data to clients');
                    break;
                    
                case 'weather/temperature':
                    io.emit('temperatureData', enhancedData);
                    console.log('Forwarded temperature data to clients');
                    break;
                    
                case 'weather/humidity':
                    io.emit('humidityData', enhancedData);
                    console.log('Forwarded humidity data to clients');
                    break;
                    
                case 'weather/pressure':
                    io.emit('pressureData', enhancedData);
                    console.log('Forwarded pressure data to clients');
                    break;
                    
                case 'weather/status':
                    io.emit('stationStatus', enhancedData);
                    console.log('Forwarded station status to clients');
                    break;
                    
                case 'weather/control':
                    // Handle control messages for flow control
                    if (data.action === 'pause') {
                        console.log('Received pause command');
                        if (sensorDataInterval) {
                            clearInterval(sensorDataInterval);
                            sensorDataInterval = null;
                            
                            // Acknowledge the pause command
                            mqttService.publish('weather/control/ack', JSON.stringify({
                                status: 'paused',
                                timestamp: new Date().toISOString()
                            }), { qos: 1 });
                        }
                    } else if (data.action === 'resume') {
                        console.log('Received resume command');
                        startDataBroadcast();
                        
                        // Acknowledge the resume command
                        mqttService.publish('weather/control/ack', JSON.stringify({
                            status: 'resumed',
                            timestamp: new Date().toISOString()
                        }), { qos: 1 });
                    } else if (data.action === 'setRate') {
                        // Implement flow control by adjusting the rate
                        console.log(`Adjusting message rate to ${data.messagesPerSecond} per second`);
                        
                        // Acknowledge the rate change
                        mqttService.publish('weather/control/ack', JSON.stringify({
                            status: 'rateChanged',
                            rate: data.messagesPerSecond,
                            timestamp: new Date().toISOString()
                        }), { qos: 1 });
                    }
                    break;
            }
        } catch (err) {
            console.error('Error handling MQTT message:', err);
        }
    });    // Set up demo for request-response pattern
    // This simulates a client requesting data at a specific interval
    const requestResponseDemo = setInterval(async () => {
        try {
            console.log("Demonstrating request-response pattern for on-demand reading");
            
            // Make a request for current weather data
            const response = await mqttService.request(
                'weather/request/reading', // Request topic
                'weather/response/reading', // Response topic
                { requestId: `req-${Date.now()}`, type: 'fullReading' }, // Payload
                5000 // Timeout in ms
            );
            
            console.log('Received response to on-demand reading request:', response);
            
            // Notify clients of the on-demand reading
            io.emit('onDemandReading', {
                ...response,
                _meta: {
                    type: 'requestResponse',
                    requestTime: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('Error in request-response demo:', err);
        }
    }, 10000); // Every 10 seconds
    
    // Add an API endpoint to trigger on-demand readings
    app.get('/api/request-reading', async (req, res) => {
        try {
            const response = await mqttService.request(
                'weather/request/reading',
                'weather/response/reading',
                { 
                    requestId: `api-req-${Date.now()}`,
                    type: 'fullReading',
                    source: 'api'
                },
                5000
            );
            
            res.json({
                success: true,
                data: response
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    });
    
    // Graceful shutdown function to handle MQTT cleanup
    function gracefulShutdown() {
        console.log('Shutting down gracefully...');
        
        // Clear intervals
        if (sensorDataInterval) {
            clearInterval(sensorDataInterval);
        }
        if (requestResponseDemo) {
            clearInterval(requestResponseDemo);
        }
        
        // Disconnect MQTT with Last Will and Testament
        mqttService.disconnect();
        
        process.exit(0);
    }
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    // Start the server
    server.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}
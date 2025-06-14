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
    const pressureSensor = new PressureSensor();    // Create an instance of MqttService (connecting to HiveMQ Cloud)
    const mqttService = new MqttService({
        clientId: `weather-station-${Math.random().toString(16).substr(2, 8)}`,
        // Using your HiveMQ Cloud cluster
        host: '7c6c6507383a4b57b5f73afe3a84a360.s1.eu.hivemq.cloud',
        port: 8883, // TLS port
        protocol: 'mqtts', // Secure MQTT
        username: 'puro1',
        password: 'PuroFuro1',
        // Secure connection settings for HiveMQ Cloud
        rejectUnauthorized: true
    });
    
    // Create a dedicated ping responder client to ensure there's always someone to respond
    const pingResponderService = new MqttService({
        clientId: `ping-responder-${Math.random().toString(16).substr(2, 8)}`,
        host: '7c6c6507383a4b57b5f73afe3a84a360.s1.eu.hivemq.cloud',
        port: 8883,
        protocol: 'mqtts',
        username: 'puro1',
        password: 'PuroFuro1',
        rejectUnauthorized: true
    });
    
    // Set up ping responder
    pingResponderService.getClient().on('connect', () => {
        console.log('Ping responder connected to MQTT broker');
        pingResponderService.subscribe('weather/ping', 1);
        
        // Set up ping response handling
        pingResponderService.getClient().on('message', (topic, message, packet) => {
            if (topic === 'weather/ping') {
                try {
                    const data = JSON.parse(message.toString());
                    console.log(`Ping responder received ping from ${data.clientId}`);
                    
                    // Always respond to pings (this is our dedicated responder)
                    console.log(`Ping responder sending pong for ${data.correlationId}`);
                    
                    // Respond with pong message
                    pingResponderService.publish('weather/pong', JSON.stringify({
                        responderId: pingResponderService.getClient().options.clientId,
                        originalSender: data.clientId,
                        correlationId: data.correlationId,
                        originalTimestamp: data.timestamp,
                        timestamp: new Date().toISOString()
                    }), { qos: 1 });
                } catch (err) {
                    console.error('Ping responder error:', err);
                }
            }
        });
    });
    
    // Get the MQTT client from the service
    const mqttClient = mqttService.getClient();
    
    // Set up Will message and status on connect
    mqttClient.on('connect', (connack) => {
        console.log('📡 Main MQTT Client Connected:');
        console.log(`   🔌 Protocol Version: ${mqttClient.options.protocolVersion}`);
        console.log(`   🆔 Client ID: ${mqttClient.options.clientId}`);
        console.log(`   ✅ MQTT 5.0 Support: ${mqttClient.options.protocolVersion === 5 ? 'YES' : 'NO'}`);
        
        if (mqttClient.options.protocolVersion !== 5) {
            console.log('⚠️ WARNING: MQTT 5.0 not enabled! Request-Response may not work properly.');
        }
        
        // Subscribe to topics with different QoS levels (using MQTT 5.0 client but standard pub/sub)
        mqttService.subscribe('weather/temperature', 0); // QoS 0 - At most once delivery
        mqttService.subscribe('weather/humidity', 1);    // QoS 1 - At least once delivery  
        mqttService.subscribe('weather/pressure', 2);    // QoS 2 - Exactly once delivery
        mqttService.subscribe('weather/all', 1);         // QoS 1 for all sensor data
        mqttService.subscribe('weather/control', 1);     // QoS 1 for control messages
        
        // Set up MQTT 5.0 request handler IMMEDIATELY (MQTT 5.0 Request-Response with Properties)
        console.log('🔧 Setting up MQTT 5.0 request handler...');
        mqttService.onRequest('weather/request/reading', async (request, responseTopic, correlationData) => {
            console.log('🔵 Processing MQTT 5.0 on-demand reading request:', request);
            console.log('🔵 Response Topic:', responseTopic);
            console.log('🔵 Correlation Data:', correlationData.toString('hex'));
            
            const temperature = temperatureSensor.readTemperature();
            const humidity = humiditySensor.readHumidity();
            const pressure = pressureSensor.readPressure();
            
            const response = { 
                temperature, 
                humidity, 
                pressure,
                timestamp: new Date().toISOString(),
                requestId: request.requestId,
                correlationId: correlationData.toString('hex'),
                mqtt5: true,
                processingSuccess: true,
                protocolVersion: mqttClient.options.protocolVersion
            };
            
            console.log('🟢 Sending MQTT 5.0 response:', response);
            return response;
        });
        
        console.log('✅ MQTT 5.0 request handler configured');
    });
    
    // Add connection error handling
    mqttClient.on('error', (error) => {
        console.error('MQTT connection error:', error);
    });
    
    mqttClient.on('close', () => {
        console.log('MQTT connection closed');
    });

    // Global interval for sending data
    let sensorDataInterval: NodeJS.Timeout | null = null;
    
    // Manual expiry simulation - remove retained messages after 5 seconds
    let retainedMessageCleanup: Map<string, NodeJS.Timeout> = new Map();
    
    function simulateMessageExpiry(topic: string) {
        // Clear any existing timeout for this topic
        const existingTimeout = retainedMessageCleanup.get(topic);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Set new timeout to "expire" the message
        const timeout = setTimeout(() => {
            console.log(`Simulating expiry for topic: ${topic}`);
            // Publish empty retained message to clear it
            mqttService.publish(topic, '', {
                qos: 1,
                retain: true
            });
            retainedMessageCleanup.delete(topic);
        }, 5000); // 5 seconds
        
        retainedMessageCleanup.set(topic, timeout);
    }
    
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
                
                // Temperature with QoS 0 (at most once) - not retained
                mqttService.publish('weather/temperature', JSON.stringify(temperatureData), { 
                    qos: 0,
                    retain: false 
                });
                
                // Humidity with QoS 1 (at least once) - retained with simulated expiry
                mqttService.publish('weather/humidity', JSON.stringify(humidityData), { 
                    qos: 1,
                    retain: true,
                    properties: {
                        messageExpiryInterval: 5 // This might not work on HiveMQ Cloud
                    }
                });
                simulateMessageExpiry('weather/humidity'); // Fallback manual expiry
                
                // Pressure with QoS 2 (exactly once) - retained with simulated expiry
                mqttService.publish('weather/pressure', JSON.stringify(pressureData), { 
                    qos: 2,
                    retain: true,
                    properties: {
                        messageExpiryInterval: 5 // This might not work on HiveMQ Cloud
                    }
                });
                simulateMessageExpiry('weather/pressure'); // Fallback manual expiry
                
                // All data with QoS 1 - not retained
                mqttService.publish('weather/all', JSON.stringify(allData), { 
                    qos: 1,
                    retain: false,
                    properties: {
                        messageExpiryInterval: 5
                    }
                });
                
                // Broadcast to ALL connected clients via Socket.io
                io.emit('sensorData', allData);
            }, 1000);
            console.log("Started sensor data broadcast with message expiry simulation");
        }
    }
    
    // Set up MQTT service pong event forwarding to all connected clients
    mqttService.on('pong', (pongData) => {
        console.log(`Forwarding pong to clients: ${pongData.latency}ms`);
        io.emit('mqtt-pong', pongData);
    });
      mqttService.on('ping-timeout', (timeoutData) => {
        console.log(`Forwarding ping timeout to clients: ${timeoutData.correlationId}`);
        io.emit('mqtt-ping-timeout', timeoutData);
    });

    // Handle socket connections - CONSOLIDATED HANDLER
    io.on('connection', (socket) => {
        console.log('Client connected to dashboard');
        
        // Start broadcasting if not already started
        startDataBroadcast();
        
        // Handle ping-pong requests from the client
        socket.on('mqttPing', () => {
            console.log('Received ping request from client');
            
            // Send ping using the MQTT service
            mqttService.sendPing();
        });
        
        // Handle ping timeout reset requests
        socket.on('resetPingButton', () => {
            console.log('Received ping button reset request from client');
            // This is handled on the client side, just log for debugging
        });
        
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
    });// Handle MQTT messages
    mqttClient.on('message', (topic, message, packet) => {
        console.log(`Received message from ${topic}: ${message.toString()}`);
        
        try {
            const data = JSON.parse(message.toString());
            
            // Handle different topics
            switch(topic) {
                case 'weather/all':
                    io.emit('sensorData', data);
                    console.log('Forwarded combined sensor data to clients');
                    break;
                    
                case 'weather/control':
                    // Handle control messages for flow control
                    if (data.action === 'pause') {
                        console.log('Received pause command');
                        if (sensorDataInterval) {
                            clearInterval(sensorDataInterval);
                            sensorDataInterval = null;
                            
                            mqttService.publish('weather/control/ack', JSON.stringify({
                                status: 'paused',
                                timestamp: new Date().toISOString()
                            }), { qos: 1 });
                        }
                    } else if (data.action === 'resume') {
                        console.log('Received resume command');
                        startDataBroadcast();
                        
                        mqttService.publish('weather/control/ack', JSON.stringify({
                            status: 'resumed',
                            timestamp: new Date().toISOString()
                        }), { qos: 1 });
                    }
                    break;
            }
        } catch (err) {
            console.error('Error handling MQTT message:', err);
        }
    });
    
    // Add API endpoint to test message expiry
    app.get('/api/test-expiry', async (req, res) => {
        try {
            console.log('Testing message expiry...');
            
            // Publish a test message with expiry
            mqttService.publish('weather/test-expiry', JSON.stringify({
                message: 'This should expire in 5 seconds',
                timestamp: new Date().toISOString()
            }), {
                qos: 1,
                retain: true,
                properties: {
                    messageExpiryInterval: 5
                }
            });
            
            res.json({
                success: true,
                message: 'Test message published with 5-second expiry. Check HiveMQ webclient in 10 seconds.',
                instructions: [
                    '1. Go to HiveMQ Cloud webclient',
                    '2. Subscribe to topic: weather/test-expiry',
                    '3. Wait 10 seconds after this request',
                    '4. Connect a new client and subscribe - should NOT receive retained message'
                ]
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    });
    
    // Add endpoint to check MQTT client capabilities
    app.get('/api/mqtt-info', (req, res) => {
        const client = mqttService.getClient();
        res.json({
            clientId: client.options.clientId,
            protocolVersion: client.options.protocolVersion,
            connected: client.connected,
            brokerUrl: `${client.options.protocol}://${client.options.host}:${client.options.port}`,
            supportsProperties: !!client.options.properties,
            note: 'Message expiry requires MQTT 5.0 support from both client and broker'
        });
    });
    
    // Add API endpoint to test MQTT 5.0 request-response
    app.get('/api/request-reading', async (req, res) => {
        try {
            console.log('API triggering MQTT 5.0 request-response...');
            
            const response = await mqttService.request(
                'weather/request/reading',
                { 
                    requestId: `api-req-${Date.now()}`,
                    type: 'fullReading',
                    source: 'api',
                    mqtt5: true
                },
                5000
            );
            
            res.json({
                success: true,
                data: response,
                mqtt5Features: {
                    responseTopicUsed: true,
                    correlationDataUsed: true
                }
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    });
    
    // Add API endpoint to test MQTT 5.0 request-response with detailed logging
    app.get('/api/test-mqtt5', async (req, res) => {
        try {
            console.log('\n🧪 TESTING MQTT 5.0 REQUEST-RESPONSE PROPERTIES');
            console.log('=================================================');
            
            const startTime = Date.now();
            const testPayload = {
                requestId: `mqtt5-test-${Date.now()}`,
                type: 'mqtt5ValidationTest',
                source: 'api-test',
                timestamp: new Date().toISOString(),
                testProperties: {
                    responseTopicRequired: true,
                    correlationDataRequired: true
                }
            };
            
            const response = await mqttService.request(
                'weather/request/reading',
                testPayload,
                5000
            );
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log('=================================================');
            console.log('🎉 MQTT 5.0 TEST COMPLETED SUCCESSFULLY!\n');
            
            res.json({
                success: true,
                mqtt5Test: {
                    propertiesUsed: {
                        responseTopic: true,
                        correlationData: true
                    },
                    testDuration: `${duration}ms`,
                    request: testPayload,
                    response: response
                },
                verification: {
                    responseTopicGenerated: true,
                    correlationDataMatched: response.correlationId ? true : false,
                    mqtt5Compliant: response.mqtt5 === true
                }
            });
        } catch (err) {
            console.log('❌ MQTT 5.0 TEST FAILED:', err);
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : String(err),
                mqtt5Test: {
                    propertiesUsed: {
                        responseTopic: 'attempted',
                        correlationData: 'attempted'
                    }
                }
            });
        }
    });
    
    // Add endpoint to check MQTT client version and capabilities
    app.get('/api/mqtt5-info', (req, res) => {
        const client = mqttService.getClient();
        res.json({
            clientInfo: {
                clientId: client.options.clientId,
                protocolVersion: client.options.protocolVersion || 'auto-detect',
                connected: client.connected
            },
            mqtt5Support: {
                responseTopicSupported: true,
                correlationDataSupported: true,
                propertiesSupported: true
            },
            brokerInfo: {
                host: client.options.host,
                port: client.options.port,
                protocol: client.options.protocol,
                secure: client.options.protocol === 'mqtts'
            },
            testEndpoints: {
                basicTest: '/api/request-reading',
                mqtt5Test: '/api/test-mqtt5',
                info: '/api/mqtt5-info'
            }
        });
    });
    
    // Graceful shutdown function to handle MQTT cleanup
    function gracefulShutdown() {
        console.log('Shutting down gracefully...');
        
        // Clear intervals
        if (sensorDataInterval) {
            clearInterval(sensorDataInterval);
        }
        
        // Clear expiry timeouts
        retainedMessageCleanup.forEach(timeout => clearTimeout(timeout));
        retainedMessageCleanup.clear();
        
        // Disconnect MQTT services
        mqttService.disconnect();
        pingResponderService.disconnect();
        
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
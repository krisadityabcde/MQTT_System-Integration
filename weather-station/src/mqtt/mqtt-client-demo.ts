// mqtt-client-demo.ts
// Demonstrates using various MQTT features for a weather station client

import * as mqtt from 'mqtt';
import { MqttService } from './mqtt-service';

export class WeatherStationClient {
    private mqttService: MqttService;
    private latestTemperature: number | null = null;
    private latestHumidity: number | null = null;
    private latestPressure: number | null = null;
    private stationStatus: 'online' | 'offline' = 'offline';
    private retainedMessages: Record<string, any> = {};
    
    constructor(options: {
        host: string;
        port: number;
        clientId?: string;
        username?: string;
        password?: string;
    }) {
        // Create MQTT service with client ID
        this.mqttService = new MqttService({
            clientId: options.clientId || `weather-client-${Math.random().toString(16).substr(2, 8)}`,
            host: options.host,
            port: options.port,
            protocol: 'mqtt',
            username: options.username,
            password: options.password
        });
        
        // Set up event handlers
        this.setupEventHandlers();
    }
    
    private setupEventHandlers(): void {
        const mqttClient = this.mqttService.getClient();
        
        mqttClient.on('connect', () => {
            console.log('Weather station client connected to MQTT broker');
            
            // Subscribe to topics with appropriate QoS levels
            this.mqttService.subscribe('weather/temperature', 0);  // QoS 0
            this.mqttService.subscribe('weather/humidity', 1);     // QoS 1
            this.mqttService.subscribe('weather/pressure', 2);     // QoS 2
            this.mqttService.subscribe('weather/all', 1);          // QoS 1
            this.mqttService.subscribe('weather/status', 1);       // QoS 1 (for LWT)
            this.mqttService.subscribe('weather/control/ack', 1);  // QoS 1 (for control acknowledgments)
            
            // Log connection success
            console.log('Successfully subscribed to weather topics');
            
            // Request an initial reading
            this.requestReading().catch(err => {
                console.error('Failed to get initial reading:', err);
            });
        });
        
        // Handle incoming messages
        mqttClient.on('message', (topic, message, packet) => {
            try {
                const data = JSON.parse(message.toString());
                
                // Check if this is a retained message
                if (packet.retain) {
                    console.log(`Received RETAINED message on topic ${topic}`);
                    this.retainedMessages[topic] = { 
                        data, 
                        receivedAt: new Date().toISOString() 
                    };
                }
                
                // Handle different topics
                switch (topic) {
                    case 'weather/temperature':
                        this.latestTemperature = data.temperature;
                        console.log(`Temperature update: ${this.latestTemperature}°C (QoS: ${packet.qos}, Retained: ${packet.retain})`);
                        break;
                        
                    case 'weather/humidity':
                        this.latestHumidity = data.humidity;
                        console.log(`Humidity update: ${this.latestHumidity}% (QoS: ${packet.qos}, Retained: ${packet.retain})`);
                        break;
                        
                    case 'weather/pressure':
                        this.latestPressure = data.pressure;
                        console.log(`Pressure update: ${this.latestPressure} hPa (QoS: ${packet.qos}, Retained: ${packet.retain})`);
                        break;
                        
                    case 'weather/all':
                        // Update all values at once
                        this.latestTemperature = data.temperature;
                        this.latestHumidity = data.humidity;
                        this.latestPressure = data.pressure;
                        console.log(`Full update received: Temp=${this.latestTemperature}°C, Hum=${this.latestHumidity}%, Press=${this.latestPressure}hPa`);
                        break;
                        
                    case 'weather/status':
                        // Handle Last Will and Testament message
                        this.stationStatus = data.status;
                        console.log(`Weather station status: ${this.stationStatus} (${data.timestamp})`);
                        
                        if (this.stationStatus === 'offline') {
                            console.log('⚠️ Weather station is OFFLINE! This may be a LWT (Last Will and Testament) message.');
                        } else {
                            console.log('✅ Weather station is ONLINE');
                        }
                        break;
                        
                    case 'weather/control/ack':
                        console.log('Control acknowledgment received:', data);
                        break;
                }
            } catch (error) {
                console.error(`Error processing message from ${topic}:`, error);
            }
        });
    }
    
    // Request an on-demand reading (demonstrates request-response pattern)
    public async requestReading(): Promise<any> {
        try {
            console.log('Requesting on-demand reading from weather station...');
            
            const response = await this.mqttService.request(
                'weather/request/reading',   // Request topic
                'weather/response/reading',  // Response topic
                { requestId: `client-req-${Date.now()}` }, // Payload
                5000 // Timeout in ms
            );
            
            console.log('On-demand reading received:', response);
            
            // Update local values
            this.latestTemperature = response.temperature;
            this.latestHumidity = response.humidity;
            this.latestPressure = response.pressure;
            
            return response;
        } catch (error) {
            console.error('Failed to get on-demand reading:', error);
            throw error;
        }
    }
    
    // Control flow rate (demonstrates flow control)
    public setMessageRate(messagesPerSecond: number): void {
        this.mqttService.publish('weather/control', JSON.stringify({
            action: 'setRate',
            messagesPerSecond,
            timestamp: new Date().toISOString()
        }), { qos: 1 });
        
        console.log(`Requested to change messaging rate to ${messagesPerSecond} msg/sec`);
    }
    
    // Pause data transmission (demonstrates flow control)
    public pauseDataTransmission(): void {
        this.mqttService.publish('weather/control', JSON.stringify({
            action: 'pause',
            timestamp: new Date().toISOString()
        }), { qos: 1 });
        
        console.log('Requested to pause data transmission');
    }
    
    // Resume data transmission (demonstrates flow control)
    public resumeDataTransmission(): void {
        this.mqttService.publish('weather/control', JSON.stringify({
            action: 'resume',
            timestamp: new Date().toISOString()
        }), { qos: 1 });
        
        console.log('Requested to resume data transmission');
    }
    
    // Get the latest readings
    public getLatestReadings(): { temperature: number | null, humidity: number | null, pressure: number | null } {
        return {
            temperature: this.latestTemperature,
            humidity: this.latestHumidity,
            pressure: this.latestPressure
        };
    }
    
    // Get received retained messages
    public getRetainedMessages(): Record<string, any> {
        return this.retainedMessages;
    }
    
    // Get weather station status
    public getStationStatus(): 'online' | 'offline' {
        return this.stationStatus;
    }
    
    // Disconnect
    public disconnect(): void {
        this.mqttService.disconnect();
        console.log('Weather station client disconnected');
    }
}

// Example usage:
/*
const client = new WeatherStationClient({
    host: 'localhost',
    port: 1883
});

// After some time, request a reading
setTimeout(async () => {
    try {
        const reading = await client.requestReading();
        console.log('Latest reading:', reading);
        
        // Get retained messages
        console.log('Retained messages:', client.getRetainedMessages());
        
        // Flow control demo
        client.pauseDataTransmission();
        
        // Resume after 5 seconds
        setTimeout(() => {
            client.resumeDataTransmission();
            
            // Change message rate
            setTimeout(() => {
                client.setMessageRate(2); // 2 messages per second
            }, 5000);
        }, 5000);
    } catch (err) {
        console.error('Error:', err);
    }
}, 2000);

// Clean up on exit
process.on('SIGINT', () => {
    client.disconnect();
    process.exit(0);
});
*/

// MQTT Service implementation with advanced features
import * as mqtt from 'mqtt';

export interface MqttOptions {
    clientId: string;
    username?: string;
    password?: string;
    host: string;
    port: number;
    protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';
}

export class MqttService {
    private client: mqtt.MqttClient;
    private messageCount: number = 0;
    private readonly MAX_MESSAGES_PER_SECOND = 10; // For flow control
    private messageQueue: Array<{ topic: string, message: string, options?: mqtt.IClientPublishOptions }> = [];
    private processingQueue = false;
    
    constructor(options: MqttOptions) {
        // Set up Last Will and Testament message
        const lwt = {
            topic: 'weather/status',
            payload: JSON.stringify({
                status: 'offline',
                clientId: options.clientId,
                timestamp: new Date().toISOString()
            }),
            qos: 1 as 0 | 1 | 2,
            retain: true
        };
        
        // Connect to the MQTT broker
        this.client = mqtt.connect(`${options.protocol}://${options.host}:${options.port}`, {
            clientId: options.clientId,
            username: options.username,
            password: options.password,
            clean: true,
            keepalive: 60,
            reconnectPeriod: 5000,
            will: lwt  // Last Will and Testament message
        });
        
        // Set up listeners
        this.setupListeners();
    }
    
    private setupListeners(): void {
        // Handle connection event
        this.client.on('connect', () => {
            console.log('Connected to MQTT broker');
            
            // Publish an online status message with retain flag
            this.publish('weather/status', JSON.stringify({
                status: 'online',
                clientId: this.client.options.clientId,
                timestamp: new Date().toISOString()
            }), { qos: 1, retain: true });
            
            // Subscribe to control topic for flow control
            this.subscribe('weather/control');
        });
        
        // Handle error event
        this.client.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });
        
        // Handle close event
        this.client.on('close', () => {
            console.log('Disconnected from MQTT broker');
        });
        
        // Handle reconnect event
        this.client.on('reconnect', () => {
            console.log('Reconnecting to MQTT broker...');
        });
    }
    
    // Subscribe to a topic with specified QoS
    public subscribe(topic: string, qos: 0 | 1 | 2 = 0): void {
        this.client.subscribe(topic, { qos }, (err) => {
            if (!err) {
                console.log(`Subscribed to ${topic} with QoS ${qos}`);
            } else {
                console.error(`Error subscribing to ${topic}:`, err);
            }
        });
    }
    
    // Publish a message with options
    public publish(topic: string, message: string, options?: mqtt.IClientPublishOptions): void {
        // Add message to queue for flow control
        this.messageQueue.push({ topic, message, options });
        
        // Process the queue if not already processing
        if (!this.processingQueue) {
            this.processMessageQueue();
        }
    }
    
    // Process message queue with flow control
    private async processMessageQueue(): Promise<void> {
        this.processingQueue = true;
        
        while (this.messageQueue.length > 0) {
            // Check if we've exceeded message rate
            if (this.messageCount >= this.MAX_MESSAGES_PER_SECOND) {
                // Wait a second before continuing
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.messageCount = 0;
            }
            
            const { topic, message, options } = this.messageQueue.shift()!;
            
            // Default options if none provided
            const publishOptions: mqtt.IClientPublishOptions = options || { 
                qos: 0,
                retain: false
            };
            
            // Add message expiry if not already set
            if (!publishOptions.properties) {
                publishOptions.properties = {
                    messageExpiryInterval: 3600 // 1 hour in seconds
                };
            }
            
            // Publish the message
            this.client.publish(topic, message, publishOptions, (err) => {
                if (err) {
                    console.error(`Error publishing to ${topic}:`, err);
                } else {
                    console.log(`Published to ${topic} with QoS ${publishOptions.qos}, retain: ${publishOptions.retain}`);
                    this.messageCount++;
                }
            });
        }
        
        this.processingQueue = false;
    }
    
    // Implement request-response pattern
    public async request(requestTopic: string, responseTopic: string, payload: any, timeout: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            // Generate a unique correlation ID
            const correlationId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            // Add correlation ID to payload
            const requestPayload = {
                ...payload,
                correlationId
            };
            
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.client.unsubscribe(responseTopic);
                reject(new Error(`Request to ${requestTopic} timed out after ${timeout}ms`));
            }, timeout);
            
            // Handle response
            const messageHandler = (topic: string, message: Buffer) => {
                try {
                    const response = JSON.parse(message.toString());
                    
                    // Check if this is the response we're waiting for
                    if (response.correlationId === correlationId) {
                        // Clean up
                        clearTimeout(timeoutId);
                        this.client.unsubscribe(responseTopic);
                        this.client.removeListener('message', messageHandler);
                        
                        // Resolve with the response data
                        resolve(response);
                    }
                } catch (err) {
                    console.error('Error parsing response:', err);
                }
            };
            
            // Subscribe to response topic
            this.client.subscribe(responseTopic);
            this.client.on('message', messageHandler);
            
            // Send the request
            this.publish(requestTopic, JSON.stringify(requestPayload), { 
                qos: 1,
                properties: {
                    responseTopic,
                    correlationData: Buffer.from(correlationId),
                    messageExpiryInterval: 30 // 30 seconds
                }
            });
        });
    }
    
    // Handle a request (for implementing responders)
    public onRequest(requestTopic: string, handler: (request: any) => Promise<any>): void {
        this.subscribe(requestTopic, 1);
        
        this.client.on('message', async (topic, message, packet) => {
            if (topic === requestTopic) {
                try {
                    // Parse the request
                    const request = JSON.parse(message.toString());
                    
                    // Get the response topic and correlation ID
                    const responseTopic = packet.properties?.responseTopic?.toString();
                    const correlationId = request.correlationId;
                    
                    if (responseTopic && correlationId) {
                        try {
                            // Process the request
                            const result = await handler(request);
                            
                            // Send the response
                            const response = {
                                ...result,
                                correlationId
                            };
                            
                            this.publish(responseTopic, JSON.stringify(response), { qos: 1 });
                        } catch (err) {
                            // Send error response
                            this.publish(responseTopic, JSON.stringify({
                                error: err instanceof Error ? err.message : String(err),
                                correlationId
                            }), { qos: 1 });
                        }
                    }
                } catch (err) {
                    console.error('Error handling request:', err);
                }
            }
        });
    }
    
    // Disconnect from the broker
    public disconnect(): void {
        // Publish offline status before disconnecting
        this.publish('weather/status', JSON.stringify({
            status: 'offline',
            clientId: this.client.options.clientId,
            timestamp: new Date().toISOString()
        }), { qos: 1, retain: true });
        
        // Disconnect
        this.client.end();
    }
    
    // Get the raw MQTT client
    public getClient(): mqtt.MqttClient {
        return this.client;
    }
}

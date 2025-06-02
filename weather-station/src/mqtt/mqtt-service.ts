// MQTT Service implementation with advanced features
import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';

export interface MqttOptions {
    clientId: string;
    username?: string;
    password?: string;
    host: string;
    port: number;
    protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';
    // For secure connections
    ca?: Buffer | Buffer[];   // Certificate Authority certificates
    cert?: Buffer;            // Client certificate
    key?: Buffer;             // Client private key
    rejectUnauthorized?: boolean; // Reject unauthorized certificates
}

export class MqttService extends EventEmitter {
    private client: mqtt.MqttClient;
    private messageCount: number = 0;
    private readonly MAX_MESSAGES_PER_SECOND = 10; // For flow control
    private messageQueue: Array<{ topic: string, message: string, options?: mqtt.IClientPublishOptions }> = [];
    private processingQueue = false;
    private pingTimestamps: Map<string, number> = new Map(); // To store timestamps for ping/pong measurement
    
    constructor(options: MqttOptions) {
        super(); // Call EventEmitter constructor
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
        
        // Connect options for HiveMQ broker
        const connectOptions: mqtt.IClientOptions = {
            clientId: options.clientId,
            username: options.username,
            password: options.password,
            clean: true,
            keepalive: 60,
            reconnectPeriod: 5000,
            will: lwt,  // Last Will and Testament message
            protocolVersion: 5, // Force MQTT 5.0
            // Add secure connection options if provided
            rejectUnauthorized: options.rejectUnauthorized,
            // Include certificates if provided
            ca: options.ca,
            cert: options.cert,
            key: options.key
        };
          // Connect to the MQTT broker (HiveMQ Cloud)
        this.client = mqtt.connect(`${options.protocol}://${options.host}:${options.port}`, connectOptions);
        
        // Set up listeners
        this.setupListeners();
    }
      private setupListeners(): void {
        // Handle connection event
        this.client.on('connect', (connack) => {
            console.log('Connected to HiveMQ Cloud broker');
            console.log('📋 Connection Details:');
            console.log(`   🔌 Protocol Version: ${this.client.options.protocolVersion}`);
            console.log(`   🆔 Client ID: ${this.client.options.clientId}`);
            console.log(`   📦 Session Present: ${connack.sessionPresent}`);
            console.log(`   ✅ MQTT 5.0 Support: ${this.client.options.protocolVersion === 5 ? 'YES' : 'NO'}`);
            
            // Publish an online status message with retain flag
            this.publish('weather/status', JSON.stringify({
                status: 'online',
                clientId: this.client.options.clientId,
                timestamp: new Date().toISOString(),
                protocolVersion: this.client.options.protocolVersion
            }), { qos: 1, retain: true });
              // Subscribe to control topic for flow control
            this.subscribe('weather/control');
            
            // Subscribe to ping response topic for ping/pong functionality
            this.subscribe('weather/pong');
            
            // Subscribe to ping request topic to respond to pings from other clients
            this.subscribe('weather/ping');
        });
          // Handle message events
        this.client.on('message', (topic, message, packet) => {            // Handle ping/pong response
            if (topic === 'weather/pong') {
                try {
                    const data = JSON.parse(message.toString());
                    
                    // Only process pongs that are responses to our pings
                    if (data.correlationId && 
                        this.pingTimestamps.has(data.correlationId) &&
                        data.originalSender === this.client.options.clientId) {
                        
                        const startTime = this.pingTimestamps.get(data.correlationId);
                        const latency = Date.now() - startTime!;
                        console.log(`Ping-Pong latency: ${latency}ms (responded by ${data.responderId})`);
                          // Emit an event that the server can listen for
                        this.emit('pong', { latency, responderId: data.responderId, timestamp: new Date().toISOString() });
                        
                        // Also try browser event if available (for direct browser usage)
                        if (typeof window !== 'undefined') {
                            const event = new CustomEvent('mqtt-pong', { 
                                detail: { latency, responderId: data.responderId, timestamp: new Date().toISOString() }
                            });
                            window.dispatchEvent(event);
                        }
                        
                        // Remove the timestamp
                        this.pingTimestamps.delete(data.correlationId);
                    }
                } catch (err) {
                    console.error('Error processing pong message:', err);
                }
            }            // Handle ping requests and respond with pong
            if (topic === 'weather/ping') {
                try {
                    const data = JSON.parse(message.toString());
                    console.log(`Received ping from ${data.clientId}`);
                    
                    // Respond to pings from other clients (not our own to avoid loops)
                    if (data.clientId !== this.client.options.clientId) {
                        console.log(`Responding to ping from ${data.clientId}`);
                        
                        // Respond with pong message
                        this.publish('weather/pong', JSON.stringify({
                            responderId: this.client.options.clientId,
                            originalSender: data.clientId,
                            correlationId: data.correlationId,
                            originalTimestamp: data.timestamp,
                            timestamp: new Date().toISOString()
                        }), { qos: 1 });
                    } else {
                        console.log(`Ignoring ping from self: ${data.clientId}`);
                    }
                } catch (err) {
                    console.error('Error processing ping message:', err);
                }
            }
        });
        
        // Handle error event
        this.client.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });
          // Handle close event
        this.client.on('close', () => {
            console.log('Disconnected from HiveMQ Cloud broker');
        });
          // Handle reconnect event
        this.client.on('reconnect', () => {
            console.log('Reconnecting to HiveMQ Cloud broker...');
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
                    messageExpiryInterval: 5 // 5 seconds
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
    
    // MQTT 5.0 Request-Response pattern using Response Topic and Correlation Data
    public async request(requestTopic: string, payload: any, timeout: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            // Generate unique correlation data for MQTT 5.0
            const correlationData = Buffer.from(`req-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`);
            
            // Create unique response topic for this request
            const responseTopic = `${requestTopic}/response/${this.client.options.clientId}/${correlationData.toString('hex')}`;
            
            console.log(`🔵 MQTT 5.0 REQUEST INITIATED:`);
            console.log(`   📤 Request Topic: ${requestTopic}`);
            console.log(`   📨 Response Topic (Property 1): ${responseTopic}`);
            console.log(`   🔗 Correlation Data (Property 2): ${correlationData.toString('hex')}`);
            console.log(`   📋 Payload:`, payload);
            
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.client.unsubscribe(responseTopic);
                console.log(`❌ MQTT 5.0 REQUEST TIMEOUT after ${timeout}ms`);
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);
            
            // Subscribe to response topic first
            this.client.subscribe(responseTopic, { qos: 1 }, (err) => {
                if (err) {
                    clearTimeout(timeoutId);
                    console.log(`❌ Failed to subscribe to response topic: ${err.message}`);
                    reject(err);
                    return;
                }
                
                console.log(`✅ Subscribed to response topic: ${responseTopic}`);
                
                // Set up one-time response handler
                const responseHandler = (topic: string, message: Buffer, packet: any) => {
                    if (topic === responseTopic) {
                        console.log(`🔵 MQTT 5.0 RESPONSE RECEIVED:`);
                        console.log(`   📨 Response Topic: ${topic}`);
                        console.log(`   📦 Packet Properties:`, packet.properties);
                        
                        // Verify correlation data matches (MQTT 5.0 feature)
                        const receivedCorrelationData = packet.properties?.correlationData;
                        
                        if (receivedCorrelationData) {
                            console.log(`   🔗 Received Correlation Data: ${receivedCorrelationData.toString('hex')}`);
                            console.log(`   🔗 Expected Correlation Data: ${correlationData.toString('hex')}`);
                            console.log(`   ✅ Correlation Data Match: ${receivedCorrelationData.equals(correlationData)}`);
                            
                            if (receivedCorrelationData.equals(correlationData)) {
                                clearTimeout(timeoutId);
                                this.client.removeListener('message', responseHandler);
                                this.client.unsubscribe(responseTopic);
                                
                                try {
                                    const response = JSON.parse(message.toString());
                                    console.log(`   📋 Response Data:`, response);
                                    console.log(`🟢 MQTT 5.0 REQUEST-RESPONSE SUCCESSFUL!`);
                                    resolve(response);
                                } catch (parseError) {
                                    console.log(`❌ Invalid JSON response: ${parseError}`);
                                    reject(new Error('Invalid JSON response'));
                                }
                            } else {
                                console.log(`❌ Correlation Data mismatch - ignoring response`);
                            }
                        } else {
                            console.log(`❌ No correlation data in response - not MQTT 5.0 compliant`);
                        }
                    }
                };
                
                this.client.on('message', responseHandler);
                
                // Publish request with MQTT 5.0 properties
                this.client.publish(requestTopic, JSON.stringify(payload), {
                    qos: 1,
                    properties: {
                        responseTopic: responseTopic,           // Property 1: Response Topic
                        correlationData: correlationData       // Property 2: Correlation Data
                    }
                }, (publishErr) => {
                    if (publishErr) {
                        clearTimeout(timeoutId);
                        this.client.removeListener('message', responseHandler);
                        this.client.unsubscribe(responseTopic);
                        console.log(`❌ Failed to publish request: ${publishErr.message}`);
                        reject(publishErr);
                    } else {
                        console.log(`✅ MQTT 5.0 request published successfully`);
                    }
                });
            });
        });
    }
    
    // MQTT 5.0 Request handler - processes requests with Response Topic and Correlation Data
    public onRequest(requestTopic: string, handler: (request: any, responseTopic: string, correlationData: Buffer) => Promise<any> | any): void {
        console.log(`🔧 Setting up request handler for topic: ${requestTopic}`);
        this.subscribe(requestTopic, 1);
        
        // Create a unique handler identifier to avoid conflicts
        const handlerName = `request-handler-${requestTopic}-${Date.now()}`;
        
        const requestHandler = async (topic: string, message: Buffer, packet: any) => {
            if (topic === requestTopic) {
                console.log(`🔵 MQTT 5.0 REQUEST RECEIVED on ${topic}:`);
                console.log(`   📦 Raw message:`, message.toString());
                console.log(`   📦 Packet Properties:`, packet.properties);
                
                // Extract MQTT 5.0 properties
                const responseTopic = packet.properties?.responseTopic;
                const correlationData = packet.properties?.correlationData;
                
                console.log(`   📨 Response Topic (Property 1): ${responseTopic || 'MISSING'}`);
                console.log(`   🔗 Correlation Data (Property 2): ${correlationData ? correlationData.toString('hex') : 'MISSING'}`);
                
                if (responseTopic && correlationData) {
                    console.log(`✅ MQTT 5.0 properties present - processing request`);
                    
                    try {
                        const request = JSON.parse(message.toString());
                        console.log(`   📋 Request Data:`, request);
                        
                        // Call handler
                        console.log(`   🔄 Calling request handler...`);
                        const response = await handler(request, responseTopic, correlationData);
                        console.log(`   📋 Handler returned response:`, response);
                        
                        // Send response using MQTT 5.0 properties
                        console.log(`   📤 Publishing response to: ${responseTopic}`);
                        this.client.publish(responseTopic, JSON.stringify(response), {
                            qos: 1,
                            properties: {
                                correlationData: correlationData  // Echo back correlation data
                            }
                        }, (publishErr) => {
                            if (publishErr) {
                                console.log(`❌ Failed to send response: ${publishErr.message}`);
                            } else {
                                console.log(`🟢 MQTT 5.0 response sent successfully`);
                                console.log(`   📨 Response Topic: ${responseTopic}`);
                                console.log(`   🔗 Correlation Data echoed: ${correlationData.toString('hex')}`);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Error processing MQTT 5.0 request:', error);
                        
                        // Send error response
                        this.client.publish(responseTopic, JSON.stringify({
                            error: 'Request processing failed',
                            message: error instanceof Error ? error.message : String(error),
                            mqtt5Error: true
                        }), {
                            qos: 1,
                            properties: {
                                correlationData: correlationData
                            }
                        });
                    }
                } else {
                    console.log(`❌ MQTT 5.0 properties missing - not a valid MQTT 5.0 request`);
                    console.log(`   Missing: ${!responseTopic ? 'Response Topic' : ''} ${!correlationData ? 'Correlation Data' : ''}`);
                }
            }
        };
        
        // Store the handler reference to avoid duplicates
        (this as any)[handlerName] = requestHandler;
        this.client.on('message', requestHandler);
        
        console.log(`✅ Request handler registered for ${requestTopic}`);
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
    
    // Send ping request to measure latency
    public sendPing(): void {
        const correlationId = `ping-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Store the timestamp for calculating latency
        this.pingTimestamps.set(correlationId, Date.now());
        
        // Send ping message
        this.publish('weather/ping', JSON.stringify({
            clientId: this.client.options.clientId,
            timestamp: new Date().toISOString(),
            correlationId
        }), { qos: 1 });
        
        console.log(`Ping sent with ID: ${correlationId}`);
        
        // Set up timeout to clean up if no response
        setTimeout(() => {
            if (this.pingTimestamps.has(correlationId)) {
                console.log(`Ping timed out for ID: ${correlationId}`);
                this.pingTimestamps.delete(correlationId);
                  // Emit timeout event for server
                this.emit('ping-timeout', { correlationId, timestamp: new Date().toISOString() });
                
                // Also try browser event if available (for direct browser usage)
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('mqtt-ping-timeout', {
                        detail: { correlationId, timestamp: new Date().toISOString() }
                    });
                    window.dispatchEvent(event);
                }
            }
        }, 5000); // 5 second timeout
    }
}

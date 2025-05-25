# MQTT Weather Station Features

This document provides an overview of the MQTT features implemented in the Weather Station project.

## MQTT Features Implemented

### 1. Quality of Service (QoS) Levels

The project implements all three QoS levels:

- **QoS 0 (At most once)**: Used for temperature data where occasional loss is acceptable
  - Implementation: `mqttService.publish('weather/temperature', data, { qos: 0 })`
  - Best for: High-frequency, non-critical data where occasional loss is acceptable
  - Example: Temperature readings are published every second

- **QoS 1 (At least once)**: Used for humidity data and combined sensor data
  - Implementation: `mqttService.publish('weather/humidity', data, { qos: 1 })`
  - Best for: Important data that must be delivered, but can handle duplicates
  - Example: Humidity readings, status updates, control commands

- **QoS 2 (Exactly once)**: Used for pressure data where exact delivery is required
  - Implementation: `mqttService.publish('weather/pressure', data, { qos: 2 })`
  - Best for: Critical data that must be delivered exactly once
  - Example: Pressure readings, calibration data, system configuration

### 2. Retained Messages

Retained messages enable new clients to receive the most recent value immediately upon subscription.

- **Implementation**:
  ```typescript
  mqttService.publish('weather/humidity', JSON.stringify(humidityData), { 
    qos: 1,
    retain: true 
  });
  ```

- **Use Cases**:
  - Latest humidity and pressure readings are retained
  - Station status is retained (online/offline)
  - Configuration settings are retained

- **Client Handling**:
  ```typescript
  mqttClient.on('message', (topic, message, packet) => {
    if (packet.retain) {
      console.log('Received retained message:', message.toString());
    }
  });
  ```

### 3. Last Will and Testament (LWT)

LWT provides automatic notification when a client disconnects unexpectedly.

- **Implementation**:
  ```typescript
  const lwt = {
    topic: 'weather/status',
    payload: JSON.stringify({
        status: 'offline',
        clientId: options.clientId,
        timestamp: new Date().toISOString()
    }),
    qos: 1,
    retain: true
  };
  
  this.client = mqtt.connect(`${options.protocol}://${options.host}:${options.port}`, {
    clientId: options.clientId,
    will: lwt
  });
  ```

- **Benefits**:
  - Immediate notification when weather station goes offline
  - Status message is retained for new clients
  - Helps with system monitoring and reliability

### 4. Message Expiry

Message expiry prevents stale data from being delivered to clients.

- **Implementation**:
  ```typescript
  mqttService.publish('weather/all', JSON.stringify(allData), { 
    qos: 1,
    properties: {
      messageExpiryInterval: 300 // 5 minutes expiry
    }
  });
  ```

- **Use Cases**:
  - Weather data expires after 1 hour (3600 seconds)
  - Request messages expire after 30 seconds
  - All sensor readings expire after 5 minutes

### 5. Request-Response Pattern

The request-response pattern enables clients to request specific data on-demand.

- **Implementation - Server Side**:
  ```typescript
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
  ```

- **Implementation - Client Side**:
  ```typescript
  const response = await mqttService.request(
    'weather/request/reading',   // Request topic
    'weather/response/reading',  // Response topic
    { requestId: `client-req-${Date.now()}` }, // Payload
    5000 // Timeout in ms
  );
  ```

- **Benefits**:
  - On-demand data retrieval without continuous subscription
  - Built-in timeout handling
  - Correlation IDs for matching requests and responses

### 6. Flow Control

Flow control mechanisms prevent overwhelming clients with too much data.

- **Implementation**:
  ```typescript
  private readonly MAX_MESSAGES_PER_SECOND = 10; 
  private messageQueue: Array<{ topic: string, message: string, options?: mqtt.IClientPublishOptions }> = [];

  // In message queue processor
  if (this.messageCount >= this.MAX_MESSAGES_PER_SECOND) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.messageCount = 0;
  }
  ```

- **Control Commands**:
  - Pause: `client.publish('weather/control', '{"action":"pause"}')`
  - Resume: `client.publish('weather/control', '{"action":"resume"}')`
  - Set Rate: `client.publish('weather/control', '{"action":"setRate", "messagesPerSecond": 5}')`

- **Benefits**:
  - Prevents client overload
  - Adjustable message rates
  - Queuing system for message bursts

## Running the Demo

To test all these MQTT features:

1. Start the MQTT broker:
   ```
   mosquitto -v
   ```

2. Start the weather station server:
   ```
   npm run start
   ```

3. Run the MQTT features demo:
   ```
   ts-node src/mqtt/mqtt-demo-runner.ts
   ```

## Testing Tips

- To test LWT, forcibly terminate the server process
- To observe retained messages, start a new client after some data has been published
- To test different QoS levels, try introducing network issues and see which messages survive
- To test flow control, send rate control commands and observe the change in message frequency

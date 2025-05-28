# MQTT Features Implementation

This weather station project implements all major MQTT features using HiveMQ Cloud broker.

## Implemented Features ✅

### 1. MQTT Secure (SSL/TLS)
- **Status**: ✅ Implemented
- **Description**: Uses MQTTS protocol with SSL/TLS encryption to HiveMQ Cloud
- **Configuration**: 
  - Protocol: `mqtts`
  - Port: `8883` (secure port)
  - Host: HiveMQ Cloud cluster
  - Certificate validation: `rejectUnauthorized: true`
- **Location**: `server.ts` - MqttService configuration

### 2. Authentication
- **Status**: ✅ Implemented
- **Description**: Username and password authentication with HiveMQ Cloud
- **Configuration**: Secure credentials (username: puro1, password: PuroFuro1)
- **Location**: `server.ts` - MqttService connection options

### 3. QoS Levels (0, 1, 2)
- **Status**: ✅ Implemented
- **Description**: All three Quality of Service levels demonstrated
- **Usage**:
  - **QoS 0**: Temperature data (at most once delivery)
    - Fast delivery, no guarantees
    - Used for high-frequency sensor data
  - **QoS 1**: Humidity data and control messages (at least once delivery)
    - Guaranteed delivery, possible duplicates
    - Used for important data like humidity readings
  - **QoS 2**: Pressure data (exactly once delivery)
    - Guaranteed exactly-once delivery
    - Used for critical measurements like pressure
- **Location**: `server.ts` - Different QoS levels in publish calls

### 4. Retained Messages
- **Status**: ✅ Implemented
- **Description**: Messages stored on broker for immediate delivery to new subscribers
- **Usage**: 
  - Humidity messages are retained (QoS 1)
  - Pressure messages are retained (QoS 2)
  - Temperature messages are NOT retained (QoS 0)
- **Test**: Refresh browser to see retained messages appear immediately
- **Location**: `server.ts` - retain flag in humidity/pressure publish calls

### 5. Last Will and Testament (LWT)
- **Status**: ✅ Implemented
- **Description**: Automatic offline message when client disconnects unexpectedly
- **Configuration**: Will message set to publish offline status
- **Test**: Forcibly terminate server (Ctrl+C) and check for offline status
- **Location**: `mqtt-service.ts` - LWT configuration in constructor

### 6. Message Expiry
- **Status**: ✅ Implemented with Simulation
- **Description**: Messages expire after 5 seconds to prevent stale data
- **Implementation**: 
  - Native MQTT 5.0 expiry: `messageExpiryInterval: 5`
  - Simulated expiry: Server clears retained messages after 5 seconds
- **Test**: Stop server, wait 10 seconds, restart - retained messages should be gone
- **Location**: `server.ts` - simulateMessageExpiry function

### 7. Request-Response Pattern
- **Status**: ✅ Implemented
- **Description**: On-demand weather readings with correlation IDs
- **Features**:
  - Server responds to `weather/request/reading` topic
  - Correlation ID tracking for request matching
  - 5-second timeout handling
- **Test**: API endpoint `/api/request-reading` demonstrates this pattern
- **Location**: `server.ts` - onRequest handler and API endpoint

### 8. Flow Control
- **Status**: ✅ Implemented
- **Description**: Control data transmission rate and pause/resume functionality
- **Features**:
  - Pause command: `{"action": "pause"}`
  - Resume command: `{"action": "resume"}`
  - Acknowledgment messages on control topic
- **Test**: Send control messages to `weather/control` topic
- **Location**: `server.ts` - control message handling in MQTT message handler

### 9. Ping-Pong Latency Testing
- **Status**: ✅ Implemented
- **Description**: Real-time latency measurement between clients and broker
- **Features**:
  - Web dashboard ping button
  - Correlation ID tracking
  - 5-second timeout with automatic button reset
  - Dedicated ping responder service ensures responses
- **Test**: Click "Ping Broker" button on web dashboard
- **Location**: 
  - Backend: `server.ts` - ping responder service
  - Frontend: `mqtt-features.js` - ping button handling

## Architecture

### Components
1. **Main Weather Station Server**: Publishes sensor data with different QoS levels
2. **Ping Responder Service**: Dedicated client that responds to ping requests
3. **Web Dashboard**: Real-time data display with ping-pong testing
4. **HiveMQ Cloud Broker**: Secure MQTT broker with full feature support

### Data Flow
1. Sensor data published every second with different QoS levels
2. Humidity/Pressure retained for new subscribers
3. Messages expire after 5 seconds (simulated)
4. Control messages allow pause/resume of data flow
5. Ping-pong measures real-time latency

## Testing the Features

### 1. Basic Connectivity
- Start server: `npm run dev`
- Open browser: `http://localhost:3000`
- Verify "Connected to HiveMQ" status

### 2. QoS Levels
- Check console logs for different QoS levels being published
- Temperature: QoS 0, Humidity: QoS 1, Pressure: QoS 2

### 3. Retained Messages
- Refresh browser page
- Humidity and pressure should appear immediately (retained)
- Temperature appears after ~1 second (not retained)

### 4. Message Expiry
- Stop server, wait 10+ seconds, restart
- Use API: `curl http://localhost:3000/api/test-expiry`
- Check HiveMQ webclient for expired messages

### 5. Request-Response
- API test: `curl http://localhost:3000/api/request-reading`
- Console shows correlation IDs and responses

### 6. Flow Control
Send MQTT messages to `weather/control` topic:
```json
// Pause
{"action": "pause", "timestamp": "2024-01-01T12:00:00.000Z"}

// Resume  
{"action": "resume", "timestamp": "2024-01-01T12:00:00.000Z"}
```

### 7. Ping-Pong
- Click "Ping Broker" button on dashboard
- Should see latency measurement
- Button resets after timeout if no response

### 8. Last Will and Testament
- Stop server with Ctrl+C
- Check HiveMQ webclient for offline status message

## API Endpoints

- `GET /` - Web dashboard
- `GET /api/request-reading` - Test request-response pattern
- `GET /api/test-expiry` - Test message expiry
- `GET /api/mqtt-info` - Check MQTT client configuration

## Technical Implementation

### Key Files
- `src/api/server.ts` - Main server with all MQTT features
- `src/mqtt/mqtt-service.ts` - Core MQTT service wrapper
- `public/mqtt-features.js` - Frontend ping-pong implementation
- `public/index.html` - Web dashboard

### MQTT Topics
- `weather/temperature` - QoS 0, not retained
- `weather/humidity` - QoS 1, retained, expires in 5s
- `weather/pressure` - QoS 2, retained, expires in 5s
- `weather/all` - QoS 1, not retained, expires in 5s
- `weather/control` - QoS 1, flow control commands
- `weather/ping` - QoS 1, ping requests
- `weather/pong` - QoS 1, ping responses
- `weather/request/reading` - QoS 1, on-demand requests
- `weather/response/reading` - QoS 1, on-demand responses

This implementation demonstrates all major MQTT features in a practical weather station scenario with real-time web visualization.

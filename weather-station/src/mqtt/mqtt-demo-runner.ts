// mqtt-demo-runner.ts
// Demonstrates all MQTT features in a simple console application

import { WeatherStationClient } from './mqtt-client-demo';

// Create the client
const client = new WeatherStationClient({
    host: 'localhost',
    port: 1883,
    clientId: `demo-client-${Math.random().toString(16).substr(2, 8)}`
});

console.log('MQTT Feature Demo Started');
console.log('-------------------------');
console.log('This demo showcases:');
console.log('1. QoS Levels (0, 1, 2)');
console.log('2. Retained Messages');
console.log('3. Last Will and Testament (LWT)');
console.log('4. Message Expiry');
console.log('5. Request-Response Pattern');
console.log('6. Flow Control');
console.log('-------------------------\n');

// Demo function for request-response pattern
async function demonstrateRequestResponse() {
    console.log('\n--- DEMO: Request-Response Pattern ---');
    try {
        console.log('Requesting on-demand weather reading...');
        const reading = await client.requestReading();
        
        console.log('Request-Response successful!');
        console.log(`Temperature: ${reading.temperature}°C`);
        console.log(`Humidity: ${reading.humidity}%`);
        console.log(`Pressure: ${reading.pressure} hPa`);
        console.log('--------------------------------\n');
    } catch (err) {
        console.error('Request-Response failed:', err);
    }
}

// Demo function for retained messages
function demonstrateRetainedMessages() {
    console.log('\n--- DEMO: Retained Messages ---');
    const retained = client.getRetainedMessages();
    
    if (Object.keys(retained).length === 0) {
        console.log('No retained messages received yet. Waiting...');
    } else {
        console.log('Retained messages:');
        for (const [topic, message] of Object.entries(retained)) {
            console.log(`Topic: ${topic}`);
            console.log(`Data: ${JSON.stringify(message.data)}`);
            console.log(`Received at: ${message.receivedAt}`);
            console.log('---');
        }
    }
    console.log('--------------------------------\n');
}

// Demo function for flow control
function demonstrateFlowControl() {
    console.log('\n--- DEMO: Flow Control ---');
    
    console.log('Pausing data transmission...');
    client.pauseDataTransmission();
    
    setTimeout(() => {
        console.log('Resuming data transmission...');
        client.resumeDataTransmission();
        
        setTimeout(() => {
            console.log('Setting message rate to 2 messages per second...');
            client.setMessageRate(2);
        }, 5000);
    }, 5000);
    
    console.log('--------------------------------\n');
}

// Demo function for LWT (Last Will and Testament)
function checkStationStatus() {
    console.log('\n--- DEMO: Station Status (LWT) ---');
    const status = client.getStationStatus();
    console.log(`Current station status: ${status}`);
    console.log('(To fully test LWT, you can forcibly terminate the server)');
    console.log('--------------------------------\n');
}

// Schedule the demos
setTimeout(demonstrateRetainedMessages, 3000);  // Show retained messages after 3 seconds
setTimeout(demonstrateRequestResponse, 6000);    // Demo request-response after 6 seconds
setTimeout(checkStationStatus, 9000);           // Check station status after 9 seconds
setTimeout(demonstrateFlowControl, 12000);       // Demo flow control after 12 seconds

// Periodic status reports
const statusInterval = setInterval(() => {
    const readings = client.getLatestReadings();
    console.log('\nCurrent Readings:');
    console.log(`Temperature: ${readings.temperature !== null ? readings.temperature + '°C' : 'N/A'}`);
    console.log(`Humidity: ${readings.humidity !== null ? readings.humidity + '%' : 'N/A'}`);
    console.log(`Pressure: ${readings.pressure !== null ? readings.pressure + ' hPa' : 'N/A'}`);
    console.log(`Station Status: ${client.getStationStatus()}`);
}, 10000);

// Show retained messages again after some time (to see if we got any)
setTimeout(demonstrateRetainedMessages, 15000);

// Clean up on exit
process.on('SIGINT', () => {
    clearInterval(statusInterval);
    console.log('\nCleaning up...');
    client.disconnect();
    console.log('Exiting demo');
    process.exit(0);
});

console.log('Demo running... Press Ctrl+C to exit');

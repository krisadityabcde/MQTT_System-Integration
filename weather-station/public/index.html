<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Station Dashboard</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        #console-output {
            margin-top: 20px;
            border-top: 1px solid #ccc;
            padding: 10px; 
            background-color: #f5f5f5;
            height: 200px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
        }
        #connection-status {
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 10px;
        }
        .connected {
            background-color: #d4edda;
            color: #155724;
        }
        .disconnected {
            background-color: #f8d7da;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <h1>Weather Station Dashboard</h1>
        
        <div id="connection-status">Connection Status: <span id="status">Disconnected</span></div>
        
        <div class="sensors-container">
            <div class="sensor-card">
                <h2>Temperature</h2>
                <div id="temperature-value" class="sensor-value">--</div>
                <div class="unit">°C</div>
                <div id="temperature-chart" class="chart"></div>
            </div>
            <div class="sensor-card">
                <h2>Humidity</h2>
                <div id="humidity-value" class="sensor-value">--</div>
                <div class="unit">%</div>
                <div id="humidity-chart" class="chart"></div>
            </div>
            <div class="sensor-card">
                <h2>Pressure</h2>
                <div id="pressure-value" class="sensor-value">--</div>
                <div class="unit">hPa</div>
                <div id="pressure-chart" class="chart"></div>
            </div>
        </div>
        
        <div class="timestamp">Last updated: <span id="timestamp">--</span></div>
        
        <!-- Ping-Pong Section -->
        <div class="ping-pong-container">
            <h3>Ping-Pong Latency Test</h3>
            <p>Test the latency between the client and HiveMQ broker</p>
            <button id="ping-button">Ping Broker</button>
            <div id="ping-results">
                <!-- Ping results will be displayed here -->
            </div>
        </div>
        
        <div id="console-output">
            <h3>Debug Console</h3>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="mqtt-features.js"></script>
    <script>
        // Debug logging function
        function addToDebugConsole(message) {
            const consoleOutput = document.getElementById('console-output');
            if (consoleOutput) {
                const entry = document.createElement('div');
                entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
                consoleOutput.appendChild(entry);
                // Limit number of entries
                if (consoleOutput.children.length > 50) {
                    consoleOutput.removeChild(consoleOutput.firstChild);
                }
                // Auto-scroll to bottom
                consoleOutput.scrollTop = consoleOutput.scrollHeight;
            }
        }

        // Chart configuration
        const chartConfig = {
            type: 'line',
            data: {
                labels: Array(10).fill(''),
                datasets: [{
                    data: Array(10).fill(null),
                    borderColor: '#3498db',
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#3498db',
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false },
                    y: { beginAtZero: false }
                },
                animation: {
                    duration: 0
                }
            }
        };

        // Global chart and data variables
        let temperatureChart, humidityChart, pressureChart;
        const temperatureData = Array(10).fill(null);
        const humidityData = Array(10).fill(null);
        const pressureData = Array(10).fill(null);

        // Initialize charts when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            addToDebugConsole('Initializing dashboard...');

            // Initialize charts
            try {
                temperatureChart = new Chart(
                    document.getElementById('temperature-chart').getContext('2d'),
                    JSON.parse(JSON.stringify(chartConfig))
                );
                
                humidityChart = new Chart(
                    document.getElementById('humidity-chart').getContext('2d'),
                    JSON.parse(JSON.stringify(chartConfig))
                );
                
                pressureChart = new Chart(
                    document.getElementById('pressure-chart').getContext('2d'),
                    JSON.parse(JSON.stringify(chartConfig))
                );
                
                addToDebugConsole('Charts initialized successfully');
            } catch (err) {
                addToDebugConsole(`Error initializing charts: ${err.message}`);
                console.error('Error initializing charts:', err);
            }

            // Setup Socket.IO connection
            setupSocketConnection();
        });        // Set up Socket.IO connection
        function setupSocketConnection() {
            const socket = io({
                transports: ['websocket', 'polling'],
                forceNew: true,
                reconnectionAttempts: 5
            });
            
            // Store socket connection for other components to use - multiple ways for compatibility
            window.socketConnection = socket;
            window.socket = socket;

            // Connection events
            socket.on('connect', () => {
                document.getElementById('status').textContent = 'Connected to HiveMQ';
                document.getElementById('connection-status').className = 'connected';
                addToDebugConsole('Connected to server via Socket.IO');
            });

            socket.on('disconnect', () => {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('connection-status').className = 'disconnected';
                addToDebugConsole('Disconnected from server');
            });

            socket.on('connect_error', (error) => {
                document.getElementById('status').textContent = 'Connection error: ' + error.message;
                document.getElementById('connection-status').className = 'disconnected';
                addToDebugConsole(`Connection error: ${error.message}`);
            });
            
            // Sensor data update
            socket.on('sensorData', (data) => {
                try {
                    addToDebugConsole(`Received data - Temp: ${data.temperature.toFixed(1)}°C, Humidity: ${data.humidity.toFixed(1)}%, Pressure: ${data.pressure.toFixed(1)}hPa`);
                    console.log('Received sensor data:', data);
                    
                    // Update displayed values
                    document.getElementById('temperature-value').textContent = data.temperature.toFixed(1);
                    document.getElementById('humidity-value').textContent = data.humidity.toFixed(1);
                    document.getElementById('pressure-value').textContent = data.pressure.toFixed(1);
                    
                    // Update timestamp
                    document.getElementById('timestamp').textContent = new Date().toLocaleTimeString();
                    
                    // Update charts
                    if (temperatureChart) {
                        temperatureData.push(data.temperature);
                        temperatureData.shift();
                        temperatureChart.data.datasets[0].data = temperatureData;
                        temperatureChart.update();
                    }
                    
                    if (humidityChart) {
                        humidityData.push(data.humidity);
                        humidityData.shift();
                        humidityChart.data.datasets[0].data = humidityData;
                        humidityChart.update();
                    }
                    
                    if (pressureChart) {
                        pressureData.push(data.pressure);
                        pressureData.shift();
                        pressureChart.data.datasets[0].data = pressureData;
                        pressureChart.update();
                    }
                } catch (err) {
                    addToDebugConsole(`Error handling sensor data: ${err.message}`);
                    console.error('Error handling sensor data:', err);
                }
            });              // MQTT ping/pong events are handled directly in mqtt-features.js
            
            // Additional event listeners for ping timeout handling
            socket.on('mqtt-ping-timeout', (timeoutData) => {
                addToDebugConsole(`Ping timeout: ${timeoutData.correlationId}`);
            });
            
            socket.on('mqtt-pong', (pongData) => {
                addToDebugConsole(`Pong received: ${pongData.latency}ms from ${pongData.responderId}`);
            });

            addToDebugConsole('Socket.IO connection setup complete');
            
            // Notify other scripts that socket is ready
            window.dispatchEvent(new CustomEvent('socketReady', { detail: { socket } }));
        }
    </script>
</body>
</html>

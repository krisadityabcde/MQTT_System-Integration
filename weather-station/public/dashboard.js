// Wait for the DOM to be fully loaded before setting up WebSocket connection
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, setting up Socket.IO connection...');
    setupSocketConnection();
});

// Function to setup Socket.IO connection
function setupSocketConnection() {
    // Connect to Socket.IO server with specific transport options
    const socket = io({
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnectionAttempts: 5
    });
    
    // Make socket globally accessible
    window.socket = socket;

    // Add connection status logging
socket.on('connect', () => {
    console.log('Connected to server via Socket.IO');
    document.getElementById('timestamp').textContent = 'Connected to server';
    // Log to the debug console in the UI
    addToDebugConsole('Connected to server via Socket.IO');
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
    document.getElementById('timestamp').textContent = 'Connection error!';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    document.getElementById('timestamp').textContent = 'Disconnected from server';
});

// Function to add message to debug console
function addToDebugConsole(message) {
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) {
        const entry = document.createElement('div');
        entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        consoleOutput.appendChild(entry);
        // Limit number of entries to prevent performance issues
        if (consoleOutput.children.length > 50) {
            consoleOutput.removeChild(consoleOutput.firstChild);
        }
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

// Initialize charts
const temperatureChart = new Chart(
    document.getElementById('temperature-chart').getContext('2d'),
    JSON.parse(JSON.stringify(chartConfig))
);

const humidityChart = new Chart(
    document.getElementById('humidity-chart').getContext('2d'),
    JSON.parse(JSON.stringify(chartConfig))
);

const pressureChart = new Chart(
    document.getElementById('pressure-chart').getContext('2d'),
    JSON.parse(JSON.stringify(chartConfig))
);

// Data arrays for charts
const temperatureData = Array(10).fill(null);
const humidityData = Array(10).fill(null);
const pressureData = Array(10).fill(null);

// Update sensor values when receiving data
socket.on('sensorData', (data) => {
    try {
        console.log('Received sensor data:', data);
        addToDebugConsole(`Received data - Temp: ${data.temperature.toFixed(1)}°C, Humidity: ${data.humidity.toFixed(1)}%, Pressure: ${data.pressure.toFixed(1)}hPa`);
        
        // Update displayed values
        const tempElement = document.getElementById('temperature-value');
        const humidityElement = document.getElementById('humidity-value');
        const pressureElement = document.getElementById('pressure-value');
        
        if (tempElement) tempElement.textContent = data.temperature.toFixed(1);
        if (humidityElement) humidityElement.textContent = data.humidity.toFixed(1);
        if (pressureElement) pressureElement.textContent = data.pressure.toFixed(1);
        
        // Update timestamp
        const now = new Date();
        const timestampElement = document.getElementById('timestamp');
        if (timestampElement) timestampElement.textContent = now.toLocaleTimeString();
        
        // Update charts if they exist
        if (window.temperatureChart && temperatureData) {
            temperatureData.push(data.temperature);
            temperatureData.shift();
            window.temperatureChart.data.datasets[0].data = temperatureData;
            window.temperatureChart.update();
        }
          if (window.humidityChart && humidityData) {
            humidityData.push(data.humidity);
            humidityData.shift();
            window.humidityChart.data.datasets[0].data = humidityData;
            window.humidityChart.update();
        }
        
        if (window.pressureChart && pressureData) {
            pressureData.push(data.pressure);
            pressureData.shift();
            window.pressureChart.data.datasets[0].data = pressureData;
            window.pressureChart.update();
        }
    } catch (err) {
        console.error('Error handling sensor data:', err);
        addToDebugConsole(`Error handling sensor data: ${err.message}`);
    }
});
}
// Simplified MQTT Features - Only Ping-Pong Functionality

function setupPingPong() {
    const pingButton = document.getElementById('ping-button');
    const pingResults = document.getElementById('ping-results');
    
    if (!pingButton || !pingResults) {
        console.error('Ping-pong elements not found');
        return;
    }
    
    // Function to get the socket connection
    function getSocket() {
        return window.socketConnection || window.socket;
    }
    
    // Function to add ping result
    function addPingResult(message, className) {
        const result = document.createElement('div');
        result.className = className;
        result.innerHTML = `<span class="timestamp">${new Date().toLocaleTimeString()}</span> ${message}`;
        pingResults.appendChild(result);
        
        // Auto-scroll to bottom
        pingResults.scrollTop = pingResults.scrollHeight;
        
        // Limit results to 20 entries
        while (pingResults.children.length > 20) {
            pingResults.removeChild(pingResults.firstChild);
        }
    }
    
    // Ping button event listener
    pingButton.addEventListener('click', function() {
        const socket = getSocket();
        
        if (!socket || !socket.connected) {
            addPingResult('❌ Not connected to server', 'ping-error');
            return;
        }
        
        // Disable button and show loading state
        pingButton.disabled = true;
        pingButton.textContent = 'Pinging...';
        
        // Record the attempt
        addPingResult('📤 Sending ping to broker...', 'ping-attempt');
        
        // Set up timeout to re-enable button if no response
        const timeoutId = setTimeout(() => {
            pingButton.disabled = false;
            pingButton.textContent = 'Ping Broker';
            addPingResult('⏱️ Ping request timed out - button reset', 'ping-timeout');
        }, 6000);
        
        // Store timeout ID for cleanup
        pingButton.dataset.timeoutId = timeoutId;
        
        // Send ping request
        socket.emit('mqttPing');
    });
    
    // Set up socket event listeners when socket becomes available
    function setupSocketListeners() {
        const socket = getSocket();
        
        if (!socket) {
            setTimeout(setupSocketListeners, 100);
            return;
        }
        
        // Listen for ping timeout events from server
        socket.on('mqtt-ping-timeout', function(timeoutData) {
            const timeoutId = pingButton.dataset.timeoutId;
            if (timeoutId) {
                clearTimeout(parseInt(timeoutId));
                delete pingButton.dataset.timeoutId;
            }
            
            pingButton.disabled = false;
            pingButton.textContent = 'Ping Broker';
            addPingResult(`⏱️ Server ping timeout: ${timeoutData.correlationId}`, 'ping-timeout');
        });
        
        // Listen for pong responses
        socket.on('mqtt-pong', function(pongData) {
            const timeoutId = pingButton.dataset.timeoutId;
            if (timeoutId) {
                clearTimeout(parseInt(timeoutId));
                delete pingButton.dataset.timeoutId;
            }
            
            pingButton.disabled = false;
            pingButton.textContent = 'Ping Broker';
            
            // Determine latency quality
            let qualityClass = 'good';
            if (pongData.latency > 100) qualityClass = 'medium';
            if (pongData.latency > 500) qualityClass = 'poor';
            
            addPingResult(
                `✅ Pong: ${pongData.latency}ms (from ${pongData.responderId})`,
                `ping-result ${qualityClass}`
            );
        });
    }
    
    setupSocketListeners();
}

// Initialize ping-pong functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupPingPong();
    }, 500);
});
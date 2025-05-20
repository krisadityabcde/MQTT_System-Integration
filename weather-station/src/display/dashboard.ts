class Dashboard {
    updateDisplay(temperature: number, humidity: number, pressure: number): void {
        console.log(`Temperature: ${temperature}°C`);
        console.log(`Humidity: ${humidity}%`);
        console.log(`Pressure: ${pressure} hPa`);
    }

    render(): void {
        // Logic to render the dashboard UI can be implemented here
        console.log("Rendering dashboard...");
    }
}

export default Dashboard;
export class Alerts {
    private alerts: string[] = [];

    triggerAlert(message: string): void {
        this.alerts.push(message);
        console.log(`Alert triggered: ${message}`);
    }

    clearAlerts(): void {
        this.alerts = [];
        console.log('All alerts cleared.');
    }
}
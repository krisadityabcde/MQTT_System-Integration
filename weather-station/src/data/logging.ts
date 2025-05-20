export class Logger {
    logData(data: any): void {
        console.log(`Data logged: ${JSON.stringify(data)}`);
    }

    logError(error: Error): void {
        console.error(`Error logged: ${error.message}`);
    }
}
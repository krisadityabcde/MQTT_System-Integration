# Weather Station Project

This Weather Station project is designed to monitor and display environmental data such as temperature, humidity, and pressure. It consists of various components that work together to read sensor data, store it, log it, and display it on a dashboard.

## Project Structure

- **src/**: Contains the source code for the application.
  - **sensors/**: Includes sensor classes for temperature, humidity, and pressure.
    - `temperature.ts`: Handles temperature readings and calibration.
    - `humidity.ts`: Handles humidity readings and calibration.
    - `pressure.ts`: Handles pressure readings and calibration.
    - `index.ts`: Exports all sensor classes for easy access.
  - **data/**: Manages data storage and logging.
    - `storage.ts`: Manages the storage of sensor data.
    - `logging.ts`: Handles logging of data and errors.
  - **display/**: Manages the display of sensor data.
    - `dashboard.ts`: Updates and renders the dashboard display.
    - `alerts.ts`: Manages alert notifications based on sensor readings.
  - **api/**: Sets up the API for accessing sensor data.
    - `routes.ts`: Sets up API routes.
    - `server.ts`: Initializes and starts the API server.
  - `app.ts`: The entry point of the application that initializes all components.

- **config/**: Contains configuration settings for the application.
  - `default.json`: Configuration settings such as sensor thresholds and logging levels.

- **package.json**: Configuration file for npm, listing dependencies and scripts.

- **tsconfig.json**: TypeScript configuration file specifying compiler options.

## Features

- Real-time monitoring of temperature, humidity, and pressure.
- Data storage and retrieval for historical analysis.
- Logging of sensor data and errors for troubleshooting.
- A user-friendly dashboard for visualizing sensor data.
- Alert notifications based on predefined thresholds.

## Getting Started

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd weather-station
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Start the application:
   ```
   npm start
   ```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
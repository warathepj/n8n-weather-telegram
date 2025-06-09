# ซอร์สโค้ดนี้ ใช้สำหรับเป็นตัวอย่างเท่านั้น ถ้านำไปใช้งานจริง ผู้ใช้ต้องจัดการเรื่องความปลอดภัย และ ประสิทธิภาพด้วยตัวเอง

# n8n Weather Forecast Formatter for Open-Meteo Data

This project provides an n8n script (`script.js`) designed for a Code node. It processes hourly weather forecast data, presumably fetched from the Open-Meteo API by a preceding node, and formats it into a human-readable message suitable for services like Telegram.

## Overview

The script takes raw hourly weather data and transforms it into a concise and informative daily weather forecast. It includes:

*   A daily overview with temperature ranges, total expected rain, and average wind conditions.
*   Hourly forecasts for specific, configurable times of the day.
*   Weather condition mapping from WMO codes to descriptive text and relevant emojis.
*   Smart recommendations based on the forecast (e.g., bring an umbrella, dress warmly).

## Features

*   **Customizable Display Timezone:** All times are converted and displayed in a user-defined timezone.
*   **Specific Hourly Forecasts:** Provides weather details for predefined hours (e.g., 9 AM, 12 PM, 3 PM, 6 PM, 9 PM).
*   **Daily Summary:**
    *   High and low temperatures for the selected hours.
    *   Total precipitation.
    *   Average wind speed and descriptive condition.
*   **Rich Weather Information:**
    *   WMO weather codes translated to main condition (Clear, Clouds, Rain, etc.) and full description.
    *   Dynamic weather emojis, including night/day variations for clear sky and cloud cover density for cloudy conditions.
    *   Temperature-specific emojis.
    *   Wind speed and descriptive text (e.g., "Light breeze").
*   **UV Advice:** Provides a general UV protection reminder for midday hours.
*   **Actionable Recommendations:** Suggests actions based on predicted weather (e.g., take an umbrella, stay hydrated).
*   **Data Source Attribution:** Clearly states "Open-Meteo" as the data source.
*   **Location Name:** Attempts to derive location name or uses a fallback.

## How it Works (n8n Flow Structure)

This script is intended to be used within an n8n workflow:

1.  **Data Fetching Node (e.g., HTTP Request):** This node should call the Open-Meteo API (or another weather API providing similar data) to get hourly forecast data. The API endpoint should be configured to retrieve necessary variables like `temperature_2m`, `weather_code`, `wind_speed_10m`, `precipitation`, and `timezone` (for location name).
2.  **Code Node (this script):**
    *   The Code node receives the JSON data from the previous node.
    *   It executes `script.js`.
    *   The script processes the hourly data, filters for the current day and desired hours in the `DISPLAY_TIMEZONE`.
    *   It constructs a formatted message string.
3.  **Notification Node (e.g., Telegram, Email):** This node takes the formatted message from the Code node's output and sends it to the desired service.

## Input Data Requirements

The script expects the input data from the preceding n8n node to be in the following structure, accessible via `items[0].json`:

```json
{
  "timezone_abbreviation": "GMT", // Optional: Used for location name if not 'Asia/Bangkok'
  "hourly": {
    "time": ["2023-10-27T00:00Z", "2023-10-27T01:00Z", ...], // UTC datetime strings
    "temperature_2m": [10.5, 10.2, ...],                   // Degrees Celsius
    "weather_code": [3, 2, ...],                           // WMO weather codes
    "wind_speed_10m": [5.5, 6.0, ...],                     // km/h
    "precipitation": [0.0, 0.1, ...]                       // mm
    // Potentially other fields like uv_index if you extend the script
  }
  // Other top-level fields from Open-Meteo response can exist but are not used by default
}
```

## Script Configuration (`script.js`)

Several constants at the top of `script.js` can be modified to customize its behavior:

*   `DISPLAY_TIMEZONE`: (String) The target timezone for all displayed times (e.g., `'Europe/Berlin'`, `'America/New_York'`).
*   `LOCATION_NAME_FALLBACK`: (String) A fallback name for the location if it cannot be derived.
*   `DATA_SOURCE_NAME`: (String) The name of the weather data provider (defaults to `'Open-Meteo'`).
*   `desiredHours`: (Array of Strings) An array of times (in `HH:MM` format, 24-hour clock) for which to display detailed hourly forecasts. These times are interpreted in the `DISPLAY_TIMEZONE`. Example: `["09:00", "12:00", "15:00", "18:00", "21:00"]`.

## Output

The script returns an n8n item in the following format:

```json
[
  {
    "json": {
      "message": "🌤️ Weather Forecast for Selected Location\n📅 Friday, 27 October 2023\n\n📊 Daily Overview\n🌡️ Range: 8°C - 15°C\n🌧️ Expected rain: 1.5mm\n💨 Moderate breeze (25.0 km/h)\n\n⏰ Hourly Forecast\n🕒 09:00 ⛅ 10°C\n    ☀️ Consider sun protection\n🕒 12:00 ☀️ 15°C, 🌧️ 0.5mm\n    ☀️ Consider sun protection\n...\n\n💡 Recommendations\n☂️ Consider an umbrella or raincoat for expected rain.\n🧥 Dress warmly (lows near 8°C expected).\n\n📡 Data from Open-Meteo | Updated: 08:30 CET"
    }
  }
]
```

The `message` string is ready to be used in a subsequent n8n node.

## Setup in n8n

1.  Create an n8n workflow.
2.  Add an HTTP Request node (or similar) to fetch weather data from Open-Meteo. Ensure you request the `hourly` parameters: `temperature_2m,precipitation,weather_code,wind_speed_10m`. Also include `timezone` in the main request parameters if you want to use `timezone_abbreviation` for the location name.
    *   Example Open-Meteo URL: `https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FBerlin`
3.  Add a Code node after the data fetching node.
4.  Copy the content of `script.js` into the Code node's JavaScript editor.
5.  Configure the constants at the top of the script (`DISPLAY_TIMEZONE`, `desiredHours`, etc.) as needed.
6.  Connect a notification node (e.g., Telegram Send Message) to the Code node. Use an expression like `{{ $json.message }}` to access the formatted weather message.

## Customization Tips

*   **Timezone & Location:**
    *   Set `DISPLAY_TIMEZONE` to your local timezone.
    *   The script has a special case: if `DISPLAY_TIMEZONE` is `'Asia/Bangkok'`, `locationName` becomes `'Bangkok'`. Otherwise, it tries to use `inputData.timezone_abbreviation` (which Open-Meteo provides if you specify a `timezone` in your API request) or falls back to `LOCATION_NAME_FALLBACK`. You might want to adjust this logic for more robust location naming.
*   **Desired Hours:** Modify the `desiredHours` array to get forecasts for different times of the day.
*   **Emojis & Text:**
    *   The `mapWmoCodeToWeatherCondition`, `getWeatherEmoji`, `getTemperatureEmoji`, and `getWindInfo` functions can be modified to change the descriptions, emojis, or thresholds.
*   **UV Advice:** The `getUVAdvice` function currently gives generic advice for hours 10-16. If your Open-Meteo API call includes `uv_index` in the `hourly` parameters, you could modify the script to use this actual data for more accurate UV advice.
*   **Recommendations:** Adjust the thresholds in the "Smart recommendations" section to better suit your preferences or local conditions.

## Example Output Snippet

```text
🌤️ Weather Forecast for Berlin
📅 Friday, October 27, 2023

📊 Daily Overview
🌡️ Range: 8°C - 15°C
🌧️ Expected rain: 1.2mm
💨 Light breeze (15.5 km/h)

⏰ Hourly Forecast
🕒 09:00 ⛅ 10°C
🕒 12:00 ☀️ 15°C, 🌧️ 0.5mm
    ☀️ Consider sun protection
🕒 15:00 🌦️ 14°C, 🌧️ 0.7mm, 💨 22 km/h
    ☀️ Consider sun protection
🕒 18:00 🌙 11°C
🕒 21:00 🌙 8°C

💡 Recommendations
☂️ Consider an umbrella or raincoat for expected rain.
🧥 Dress warmly (lows near 8°C expected).

📡 Data from Open-Meteo | Updated: 08:45 CEST
```

---

This README should provide a good starting point for understanding and using your n8n weather script.

## Future Improvements for `script.js`

1.  **Location Name Logic:**
    The current logic for `locationName` has a hardcoded special case for 'Asia/Bangkok'. It might be more flexible to prioritize `inputData.timezone_abbreviation` if available, or allow `locationName` to be passed in or configured more directly.

2.  **Unused `country` Variable:**
    The `country` variable is declared but never used. It can be removed.

3.  **Timezone Abbreviation Fallback:**
    The fallback for `displayTimezoneAbbr` is very specific (`Europe/Luxembourg`). If `toLocaleTimeString` with `timeZoneName:'short'` fails, it might be better to just use the full `DISPLAY_TIMEZONE` string or omit the abbreviation.

4.  **UV Advice Enhancement (Optional):**
    The current UV advice is based on the time of day. Open-Meteo API can provide actual `uv_index` data. If you fetch this (e.g., add `uv_index` to your `hourly` parameters in the API call), you could make the UV advice much more accurate.
    For example, you could modify `getUVAdvice` to take `uvIndex` as a parameter:
    `function getUVAdvice(uvIndex, hour)`
    And then in the main loop:
    `const uvIndex = hourlyData.uv_index[i]; // Assuming you fetch it`
    `const uvText = getUVAdvice(uvIndex, forecastHourNumInDisplayTz);`

5.  **Constants for Thresholds:**
    Some magic numbers used for thresholds (e.g., in `getTemperatureEmoji`, `getWindInfo`, recommendation logic) could be defined as named constants at the top of the script for easier configuration and better readability.

    For example:
    ```javascript
    // Configuration
    // ...
    const TEMP_EMOJI_THRESHOLDS = { HOT: 30, WARM: 25, MILD: 20, COOL: 15, COLD: 10, VERY_COLD: 5 };
    const WIND_SPEED_THRESHOLDS_KMH = { CALM: 5, LIGHT: 20, MODERATE: 40, STRONG: 70 };
    const RAIN_RECOMMENDATION_THRESHOLD_MM = 0.5;
    // ...
    ```

6.  **Error Handling for Input Data:**
    Consider adding basic checks to ensure `items[0].json` and `inputData.hourly` (and its nested arrays) exist before trying to access their properties. This would make the script more robust if the input data is unexpectedly missing or malformed.

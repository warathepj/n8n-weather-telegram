// Weather Forecast Processor for Open-Meteo Data
// Processes hourly forecast data and formats for Telegram

// Configuration
const DISPLAY_TIMEZONE = 'Europe/Luxembourg'; // Target timezone for display
const LOCATION_NAME_FALLBACK = 'Selected Location'; // Fallback if location name can't be derived
const DATA_SOURCE_NAME = 'Open-Meteo'; // Source of the weather data

// --- Helper Functions ---

// Maps WMO Weather Codes to a simplified condition and cloudiness proxy
function mapWmoCodeToWeatherCondition(wmoCode) {
    // Returns { main: 'WeatherMain', description: 'Full Description', cloudiness_proxy: 0-100 }
    // Cloudiness proxy: 0 for clear, 10-30 for few clouds, 50 for partly, 100 for overcast.
    // Used by getWeatherEmoji for 'Clear' and 'Clouds' types.
    if (wmoCode === 0) return { main: 'Clear', description: 'Clear sky', cloudiness_proxy: 0 };
    if (wmoCode === 1) return { main: 'Clear', description: 'Mainly clear', cloudiness_proxy: 20 };
    if (wmoCode === 2) return { main: 'Clouds', description: 'Partly cloudy', cloudiness_proxy: 50 };
    if (wmoCode === 3) return { main: 'Clouds', description: 'Overcast', cloudiness_proxy: 100 };
    if (wmoCode === 45) return { main: 'Fog', description: 'Fog', cloudiness_proxy: 100 };
    if (wmoCode === 48) return { main: 'Fog', description: 'Depositing rime fog', cloudiness_proxy: 100 };
    if (wmoCode >= 51 && wmoCode <= 55) { // Drizzle
        let desc = 'Drizzle';
        if (wmoCode === 51) desc = 'Light drizzle';
        if (wmoCode === 53) desc = 'Moderate drizzle';
        if (wmoCode === 55) desc = 'Dense drizzle';
        return { main: 'Drizzle', description: desc, cloudiness_proxy: 90 };
    }
    if (wmoCode >= 61 && wmoCode <= 65) { // Rain
        let desc = 'Rain';
        if (wmoCode === 61) desc = 'Slight rain';
        if (wmoCode === 63) desc = 'Moderate rain';
        if (wmoCode === 65) desc = 'Heavy rain';
        return { main: 'Rain', description: desc, cloudiness_proxy: 100 };
    }
    if (wmoCode >= 80 && wmoCode <= 82) { // Rain showers
        let desc = 'Rain showers';
        if (wmoCode === 80) desc = 'Slight rain showers';
        if (wmoCode === 81) desc = 'Moderate rain showers';
        if (wmoCode === 82) desc = 'Violent rain showers';
        return { main: 'Rain', description: desc, cloudiness_proxy: 100 }; // Treat as Rain for emoji
    }
    if (wmoCode >= 71 && wmoCode <= 75) { // Snow fall
        let desc = 'Snow fall';
        if (wmoCode === 71) desc = 'Slight snow fall';
        if (wmoCode === 73) desc = 'Moderate snow fall';
        if (wmoCode === 75) desc = 'Heavy snow fall';
        return { main: 'Snow', description: desc, cloudiness_proxy: 100 };
    }
    if (wmoCode === 77) return { main: 'Snow', description: 'Snow grains', cloudiness_proxy: 100 };
    if (wmoCode === 85 || wmoCode === 86) return { main: 'Snow', description: 'Snow showers', cloudiness_proxy: 100 };

    if (wmoCode === 95) return { main: 'Thunderstorm', description: 'Thunderstorm', cloudiness_proxy: 100 };
    if (wmoCode === 96 || wmoCode === 99) return { main: 'Thunderstorm', description: 'Thunderstorm with hail', cloudiness_proxy: 100 };

    // Less common codes, can be expanded
    if (wmoCode === 56 || wmoCode === 57) return { main: 'Drizzle', description: 'Freezing Drizzle', cloudiness_proxy: 90 };
    if (wmoCode === 66 || wmoCode === 67) return { main: 'Rain', description: 'Freezing Rain', cloudiness_proxy: 100 };


    return { main: 'Unknown', description: `WMO ${wmoCode}`, cloudiness_proxy: 50 }; // Default
}

function getWeatherEmoji(weatherMain, cloudiness = 0, isNight = false) {
    const emojiMap = {
        'Clear': isNight ? '🌙' : '☀️',
        'Clouds': cloudiness > 75 ? '☁️' : cloudiness > 25 ? '⛅' : '🌤️', // Uses cloudiness_proxy
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Mist': '🌫️', // Mist, Fog, Haze, Smoke can share
        'Fog': '🌫️',
        'Haze': '🌫️',
        'Smoke': '🌫️'
    };
    return emojiMap[weatherMain] || '🌍'; // Default emoji
}

function getTemperatureEmoji(temp) {
    if (temp >= 30) return '🔥';
    if (temp >= 25) return '😎';
    if (temp >= 20) return '😊';
    if (temp >= 15) return '😐';
    if (temp >= 10) return '🧥';
    if (temp >= 5) return '🥶';
    return '🧊';
}

function getWindInfo(windSpeedKmh) { // Expects windSpeed in km/h
    let windEmoji = '💨';
    let windText = '';

    if (windSpeedKmh < 5) windText = 'Calm';
    else if (windSpeedKmh < 20) windText = 'Light breeze';
    else if (windSpeedKmh < 40) windText = 'Moderate breeze';
    else if (windSpeedKmh < 70) windText = 'Strong breeze';
    else windText = 'Very windy';

    return `${windEmoji} ${windText} (${windSpeedKmh.toFixed(1)} km/h)`;
}

function getUVAdvice(hour) { // hour is local time hour (0-23)
    if (hour >= 10 && hour <= 16) return '☀️ Consider sun protection';
    return '';
}

// --- Main Processing ---
// Assuming `items` is an array from n8n's input, and `items[0].json` holds the data like in data.json
const inputData = items[0].json;
const hourlyData = inputData.hourly;

// Location and Timezone Information
const locationName = inputData.timezone_abbreviation || LOCATION_NAME_FALLBACK; // e.g., "GMT" or a fallback
// const country = ''; // Country is not in this data structure, can be set if known

const now = new Date();
// Get today's date string in YYYY-MM-DD format for the display timezone
const todayInDisplayTimeZone = now.toLocaleDateString('en-CA', { timeZone: DISPLAY_TIMEZONE });

const desiredHours = ["09:00", "12:00", "15:00", "18:00", "21:00"]; // In DISPLAY_TIMEZONE

let hourlySummary = '';
let headerIcon = '🌤️'; // Default header icon
let dayHighTemp = -Infinity;
let dayLowTemp = Infinity;
let totalRain = 0;
let totalWindSpeed = 0; // For averaging
let weatherCount = 0;

let firstMatchForHeader = true;

// Process hourly forecast data
for (let i = 0; i < hourlyData.time.length; i++) {
    const dateTimeUtcStr = hourlyData.time[i]; // e.g., "2025-06-09T10:00" (UTC)
    const forecastDateTimeUtc = new Date(dateTimeUtcStr + 'Z'); // Ensure UTC parsing

    // Convert UTC time to the display timezone
    const forecastDateInDisplayTz = forecastDateTimeUtc.toLocaleDateString('en-CA', { timeZone: DISPLAY_TIMEZONE }); // YYYY-MM-DD
    const forecastTimeInDisplayTz = forecastDateTimeUtc.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: DISPLAY_TIMEZONE,
        hour12: false
    }); // HH:MM
    const forecastHourNumInDisplayTz = parseInt(forecastTimeInDisplayTz.slice(0, 2));

    if (forecastDateInDisplayTz === todayInDisplayTimeZone && desiredHours.includes(forecastTimeInDisplayTz)) {
        const temp = Math.round(hourlyData.temperature_2m[i]);
        // FeelsLike is not in this data structure, so we omit it.
        const wmoCode = hourlyData.weather_code[i];
        const windSpeedKmh = hourlyData.wind_speed_10m[i];
        const rainAmount = hourlyData.precipitation[i]; // mm, likely per hour

        const isNight = forecastHourNumInDisplayTz < 6 || forecastHourNumInDisplayTz > 20;
        const weatherCondition = mapWmoCodeToWeatherCondition(wmoCode);

        // Track daily stats
        dayHighTemp = Math.max(dayHighTemp, temp);
        dayLowTemp = Math.min(dayLowTemp, temp);
        totalRain += rainAmount;
        totalWindSpeed += windSpeedKmh;
        weatherCount++;

        // Set header icon based on first matching hour (e.g., 09:00 weather)
        if (firstMatchForHeader && weatherCondition.main !== 'Unknown') {
            headerIcon = getWeatherEmoji(weatherCondition.main, weatherCondition.cloudiness_proxy, isNight);
            firstMatchForHeader = false;
        }

        const tempEmoji = getTemperatureEmoji(temp);
        const currentHourWeatherEmoji = getWeatherEmoji(weatherCondition.main, weatherCondition.cloudiness_proxy, isNight);
        
        const rainText = rainAmount > 0 ? `, 🌧️ ${rainAmount.toFixed(1)}mm` : '';
        // Show wind for the hour if it's somewhat significant
        const windTextHourly = windSpeedKmh > 10 ? `, 💨 ${windSpeedKmh.toFixed(0)} km/h` : '';
        const uvText = getUVAdvice(forecastHourNumInDisplayTz);

        hourlySummary += `🕒 <b>${forecastTimeInDisplayTz}</b> ${currentHourWeatherEmoji} ${temp}°C${rainText}${windTextHourly}\n`;
        if (uvText) hourlySummary += `    ${uvText}\n`;
    }
}

// Calculate averages
let avgWindSpeedKmh = 0;
if (weatherCount > 0) {
    avgWindSpeedKmh = totalWindSpeed / weatherCount;
}

// Build comprehensive message
let message = `${headerIcon} <b>Weather Forecast for ${locationName}</b>\n`;
message += `📅 ${now.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: DISPLAY_TIMEZONE
})}\n\n`;

// Daily overview
message += `<b>📊 Daily Overview</b>\n`;
if (dayHighTemp > -Infinity && dayLowTemp < Infinity && weatherCount > 0) {
    message += `🌡️ Range: ${dayLowTemp}°C - ${dayHighTemp}°C\n`;
} else if (weatherCount === 0) {
    message += `🌡️ No temperature data for selected hours today.\n`;
}

if (totalRain > 0) {
    message += `🌧️ Expected rain: ${totalRain.toFixed(1)}mm\n`;
}
if (avgWindSpeedKmh > 2 && weatherCount > 0) { // Only show if some wind and data processed
    message += `${getWindInfo(avgWindSpeedKmh)}\n`;
}
// Humidity section removed as no hourly humidity data
message += `\n`;


// Hourly forecast
if (hourlySummary) {
    message += `<b>⏰ Hourly Forecast</b>\n`;
    message += hourlySummary;
} else {
    message += `<b>⏰ Hourly Forecast</b>\nNo forecast data available for the selected hours today.\n`;
}


// Smart recommendations
let recommendations = '';
if (totalRain > 0.5) { // Threshold for bringing umbrella
    recommendations += `☂️ Consider an umbrella or raincoat for expected rain.\n`;
}
if (dayLowTemp < 10 && weatherCount > 0) {
    recommendations += `🧥 Dress warmly (lows near ${dayLowTemp}°C expected).\n`;
}
if (dayHighTemp > 25 && weatherCount > 0) {
    recommendations += `💧 Stay hydrated (highs near ${dayHighTemp}°C expected).\n`;
}
if (avgWindSpeedKmh > 30 && weatherCount > 0) { // Adjusted threshold for "windy"
    recommendations += `💨 Windy conditions expected - secure loose items.\n`;
}
// UV advice is per hour, but a general one could be added if any hour has UV warning
if (hourlySummary.includes("Consider sun protection")) {
     recommendations += `☀️ Sun protection might be needed during midday hours.\n`;
}


if (recommendations) {
    message += `\n<b>💡 Recommendations</b>\n`;
    message += recommendations;
}

// Footer with data source and time
const updateTime = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE
});
let displayTimezoneAbbr = DISPLAY_TIMEZONE;
try {
    // Attempt to get a short timezone abbreviation
    displayTimezoneAbbr = new Date().toLocaleTimeString('en', { timeZoneName:'short', timeZone: DISPLAY_TIMEZONE }).split(' ').pop();
} catch (e) {
    // Fallback if the above fails for any reason
    if (DISPLAY_TIMEZONE === 'Europe/Luxembourg') displayTimezoneAbbr = 'CET/CEST';
}

message += `\n<i>📡 Data from ${DATA_SOURCE_NAME} | Updated: ${updateTime} ${displayTimezoneAbbr}</i>`;

return [{ json: { message: message } }];

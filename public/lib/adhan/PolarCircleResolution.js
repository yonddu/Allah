import Coordinates from './Coordinates.js';
import { computePrayerTimesForDay, shiftPrayerTimesByDays } from './PrayerTimesCalculation.js';
export const PolarCircleResolution = {
    AqrabBalad: 'AqrabBalad',
    AqrabYaum: 'AqrabYaum',
    Unresolved: 'Unresolved'
};
const LATITUDE_VARIATION_STEP = 0.5;
const aqrabYaumResolver = (coordinates, date, calculationParameters, daysAdded = 1, direction = 1)=>{
    if (daysAdded > Math.ceil(365 / 2)) {
        return null;
    }
    const testDate = new Date(date.getTime());
    testDate.setDate(testDate.getDate() + direction * daysAdded);
    const result = computePrayerTimesForDay(coordinates, testDate, calculationParameters);
    if (!result.isValid) {
        return aqrabYaumResolver(coordinates, date, calculationParameters, daysAdded + (direction > 0 ? 0 : 1), -direction);
    }
    return shiftPrayerTimesByDays(result, -(direction * daysAdded));
};
const aqrabBaladResolver = (coordinates, date, latitude, calculationParameters)=>{
    const candidateCoordinates = new Coordinates(latitude, coordinates.longitude);
    const result = computePrayerTimesForDay(candidateCoordinates, date, calculationParameters);
    if (!result.isValid) {
        if (latitude === 0) {
            return null;
        }
        const nextLatitude = Math.sign(latitude) * Math.max(0, Math.abs(latitude) - LATITUDE_VARIATION_STEP);
        return aqrabBaladResolver(coordinates, date, nextLatitude, calculationParameters);
    }
    return result;
};
export const resolvePolarCircle = (resolver, coordinates, date, calculationParameters)=>{
    switch(resolver){
        case PolarCircleResolution.AqrabYaum:
            {
                return aqrabYaumResolver(coordinates, date, calculationParameters);
            }
        case PolarCircleResolution.AqrabBalad:
            {
                const { latitude } = coordinates;
                return aqrabBaladResolver(coordinates, date, latitude - Math.sign(latitude) * LATITUDE_VARIATION_STEP, calculationParameters);
            }
        default:
            {
                return null;
            }
    }
};

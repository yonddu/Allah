import SolarTime from './SolarTime.js';
import TimeComponents from './TimeComponents.js';
import Astronomical from './Astronomical.js';
import { dateByAddingDays, dateByAddingMinutes, dateByAddingSeconds, dayOfYear, roundedMinute, timesInOrder } from './DateUtils.js';
import { shadowLength } from './Madhab.js';
const HIGH_LATITUDE_THRESHOLD = 55;
export function computePrayerTimesForDay(coordinates, date, calculationParameters) {
    const { sunrise: sunriseElevation, sunset: sunsetElevation } = calculationParameters.horizonElevations();
    const solarTime = new SolarTime(date, coordinates, sunriseElevation, sunsetElevation);
    const tomorrow = dateByAddingDays(date, 1);
    const tomorrowSolarTime = new SolarTime(tomorrow, coordinates, sunriseElevation, sunsetElevation);
    const dhuhrTime = new TimeComponents(solarTime.transit).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
    const sunriseTime = new TimeComponents(solarTime.sunrise).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
    const sunsetTime = new TimeComponents(solarTime.sunset).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
    const asrTime = new TimeComponents(solarTime.afternoon(shadowLength(calculationParameters.madhab))).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrowSunrise = new TimeComponents(tomorrowSolarTime.sunrise).utcDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    const night = (Number(tomorrowSunrise) - Number(sunsetTime)) / 1000;
    let nightFraction;
    let fajrTime = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.fajrAngle, false)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
    if (calculationParameters.method === 'MoonsightingCommittee' && coordinates.latitude >= HIGH_LATITUDE_THRESHOLD) {
        nightFraction = night / 7;
        fajrTime = dateByAddingSeconds(sunriseTime, -nightFraction);
    }
    const safeFajr = function() {
        if (calculationParameters.method === 'MoonsightingCommittee') {
            return Astronomical.seasonAdjustedMorningTwilight(coordinates.latitude, dayOfYear(date), date.getFullYear(), sunriseTime);
        } else {
            const portion = calculationParameters.nightPortions().fajr;
            nightFraction = portion * night;
            return dateByAddingSeconds(sunriseTime, -nightFraction);
        }
    }();
    if (isNaN(fajrTime.getTime()) || safeFajr > fajrTime || !timesInOrder(fajrTime, sunriseTime)) {
        fajrTime = safeFajr;
    }
    let ishaTime;
    if (calculationParameters.ishaInterval > 0) {
        ishaTime = dateByAddingMinutes(sunsetTime, calculationParameters.ishaInterval);
    } else {
        ishaTime = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.ishaAngle, true)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        if (calculationParameters.method === 'MoonsightingCommittee' && coordinates.latitude >= HIGH_LATITUDE_THRESHOLD) {
            nightFraction = night / 7;
            ishaTime = dateByAddingSeconds(sunsetTime, nightFraction);
        }
        const safeIsha = function() {
            if (calculationParameters.method === 'MoonsightingCommittee') {
                return Astronomical.seasonAdjustedEveningTwilight(coordinates.latitude, dayOfYear(date), date.getFullYear(), sunsetTime, calculationParameters.shafaq);
            } else {
                const portion = calculationParameters.nightPortions().isha;
                nightFraction = portion * night;
                return dateByAddingSeconds(sunsetTime, nightFraction);
            }
        }();
        if (isNaN(ishaTime.getTime()) || !timesInOrder(sunsetTime, ishaTime) || safeIsha < ishaTime) {
            ishaTime = safeIsha;
        }
    }
    let maghribTime = sunsetTime;
    if (calculationParameters.maghribAngle) {
        const angleBasedMaghrib = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.maghribAngle, true)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        if (sunsetTime < angleBasedMaghrib && ishaTime > angleBasedMaghrib) {
            maghribTime = angleBasedMaghrib;
        }
    }
    const fajrAdjustment = (calculationParameters.adjustments.fajr || 0) + (calculationParameters.methodAdjustments.fajr || 0);
    const sunriseAdjustment = (calculationParameters.adjustments.sunrise || 0) + (calculationParameters.methodAdjustments.sunrise || 0);
    const dhuhrAdjustment = (calculationParameters.adjustments.dhuhr || 0) + (calculationParameters.methodAdjustments.dhuhr || 0);
    const asrAdjustment = (calculationParameters.adjustments.asr || 0) + (calculationParameters.methodAdjustments.asr || 0);
    const maghribAdjustment = (calculationParameters.adjustments.maghrib || 0) + (calculationParameters.methodAdjustments.maghrib || 0);
    const ishaAdjustment = (calculationParameters.adjustments.isha || 0) + (calculationParameters.methodAdjustments.isha || 0);
    const isValid = timesInOrder(fajrTime, sunriseTime) && timesInOrder(sunriseTime, dhuhrTime) && timesInOrder(dhuhrTime, asrTime) && timesInOrder(asrTime, maghribTime) && timesInOrder(maghribTime, ishaTime);
    if (!isValid) {
        return {
            isValid: false
        };
    }
    return {
        isValid: true,
        fajr: roundedMinute(dateByAddingMinutes(fajrTime, fajrAdjustment), calculationParameters.rounding),
        sunrise: roundedMinute(dateByAddingMinutes(sunriseTime, sunriseAdjustment), calculationParameters.rounding),
        dhuhr: roundedMinute(dateByAddingMinutes(dhuhrTime, dhuhrAdjustment), calculationParameters.rounding),
        asr: roundedMinute(dateByAddingMinutes(asrTime, asrAdjustment), calculationParameters.rounding),
        sunset: roundedMinute(sunsetTime, calculationParameters.rounding),
        maghrib: roundedMinute(dateByAddingMinutes(maghribTime, maghribAdjustment), calculationParameters.rounding),
        isha: roundedMinute(dateByAddingMinutes(ishaTime, ishaAdjustment), calculationParameters.rounding)
    };
}
export function shiftPrayerTimesByDays(result, days) {
    if (!result.isValid || days === 0) {
        return result;
    }
    const seconds = days * 86400;
    return {
        isValid: true,
        fajr: dateByAddingSeconds(result.fajr, seconds),
        sunrise: dateByAddingSeconds(result.sunrise, seconds),
        dhuhr: dateByAddingSeconds(result.dhuhr, seconds),
        asr: dateByAddingSeconds(result.asr, seconds),
        sunset: dateByAddingSeconds(result.sunset, seconds),
        maghrib: dateByAddingSeconds(result.maghrib, seconds),
        isha: dateByAddingSeconds(result.isha, seconds)
    };
}

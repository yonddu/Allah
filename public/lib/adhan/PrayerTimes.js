import Prayer from './Prayer.js';
import CalculationParameters from './CalculationParameters.js';
import Coordinates from './Coordinates.js';
import { isValidDate } from './DateUtils.js';
import { computePrayerTimesForDay } from './PrayerTimesCalculation.js';
import { PolarCircleResolution, resolvePolarCircle } from './PolarCircleResolution.js';
export default class PrayerTimes {
    coordinates;
    date;
    calculationParameters;
    fajr = new Date(NaN);
    sunrise = new Date(NaN);
    dhuhr = new Date(NaN);
    asr = new Date(NaN);
    sunset = new Date(NaN);
    maghrib = new Date(NaN);
    isha = new Date(NaN);
    constructor(coordinates, date, calculationParameters){
        this.coordinates = coordinates;
        this.date = date;
        this.calculationParameters = calculationParameters;
        if (!Number.isFinite(coordinates.latitude) || Math.abs(coordinates.latitude) > 90 || !Number.isFinite(coordinates.longitude) || !isValidDate(date)) {
            return;
        }
        let result = computePrayerTimesForDay(coordinates, date, calculationParameters);
        if (!result.isValid && calculationParameters.polarCircleResolution !== PolarCircleResolution.Unresolved) {
            const resolved = resolvePolarCircle(calculationParameters.polarCircleResolution, coordinates, date, calculationParameters);
            if (resolved) {
                result = resolved;
            }
        }
        if (!result.isValid) {
            return;
        }
        this.fajr = result.fajr;
        this.sunrise = result.sunrise;
        this.dhuhr = result.dhuhr;
        this.asr = result.asr;
        this.sunset = result.sunset;
        this.maghrib = result.maghrib;
        this.isha = result.isha;
    }
    get isValid() {
        return isValidDate(this.fajr) && isValidDate(this.sunrise) && isValidDate(this.dhuhr) && isValidDate(this.asr) && isValidDate(this.sunset) && isValidDate(this.maghrib) && isValidDate(this.isha);
    }
    timeForPrayer(prayer) {
        if (prayer === Prayer.Fajr) {
            return this.fajr;
        } else if (prayer === Prayer.Sunrise) {
            return this.sunrise;
        } else if (prayer === Prayer.Dhuhr) {
            return this.dhuhr;
        } else if (prayer === Prayer.Asr) {
            return this.asr;
        } else if (prayer === Prayer.Maghrib) {
            return this.maghrib;
        } else if (prayer === Prayer.Isha) {
            return this.isha;
        } else {
            return null;
        }
    }
    currentPrayer(date = new Date()) {
        if (date >= this.isha) {
            return Prayer.Isha;
        } else if (date >= this.maghrib) {
            return Prayer.Maghrib;
        } else if (date >= this.asr) {
            return Prayer.Asr;
        } else if (date >= this.dhuhr) {
            return Prayer.Dhuhr;
        } else if (date >= this.sunrise) {
            return Prayer.Sunrise;
        } else if (date >= this.fajr) {
            return Prayer.Fajr;
        } else {
            return Prayer.None;
        }
    }
    nextPrayer(date = new Date()) {
        if (date >= this.isha) {
            return Prayer.None;
        } else if (date >= this.maghrib) {
            return Prayer.Isha;
        } else if (date >= this.asr) {
            return Prayer.Maghrib;
        } else if (date >= this.dhuhr) {
            return Prayer.Asr;
        } else if (date >= this.sunrise) {
            return Prayer.Dhuhr;
        } else if (date >= this.fajr) {
            return Prayer.Sunrise;
        } else {
            return Prayer.Fajr;
        }
    }
}

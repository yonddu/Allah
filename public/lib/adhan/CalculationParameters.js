import { Madhab } from './Madhab.js';
import HighLatitudeRule from './HighLatitudeRule.js';
import { PolarCircleResolution } from './PolarCircleResolution.js';
import { Rounding } from './Rounding.js';
import { Shafaq } from './Shafaq.js';
export default class CalculationParameters {
    method;
    fajrAngle;
    ishaAngle;
    ishaInterval;
    maghribAngle;
    madhab = Madhab.Shafi;
    highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
    adjustments = {
        fajr: 0,
        sunrise: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0
    };
    methodAdjustments = {
        fajr: 0,
        sunrise: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0
    };
    polarCircleResolution = PolarCircleResolution.AqrabBalad;
    rounding = Rounding.Nearest;
    shafaq = Shafaq.General;
    elevationFromHorizon = 0;
    constructor(method, fajrAngle = 0, ishaAngle = 0, ishaInterval = 0, maghribAngle = 0){
        this.method = method;
        this.fajrAngle = fajrAngle;
        this.ishaAngle = ishaAngle;
        this.ishaInterval = ishaInterval;
        this.maghribAngle = maghribAngle;
        if (this.method === null) {
            this.method = 'Other';
        }
    }
    nightPortions() {
        switch(this.highLatitudeRule){
            case HighLatitudeRule.MiddleOfTheNight:
                return {
                    fajr: 1 / 2,
                    isha: 1 / 2
                };
            case HighLatitudeRule.SeventhOfTheNight:
                return {
                    fajr: 1 / 7,
                    isha: 1 / 7
                };
            case HighLatitudeRule.TwilightAngle:
                return {
                    fajr: this.fajrAngle / 60,
                    isha: this.ishaAngle / 60
                };
            default:
                throw new Error(`Invalid high latitude rule found when attempting to compute night portions: ${this.highLatitudeRule}`);
        }
    }
    horizonElevations() {
        const value = this.elevationFromHorizon ?? 0;
        let elevations;
        if (typeof value === 'number') {
            elevations = {
                sunrise: value,
                sunset: value
            };
        } else {
            elevations = {
                sunrise: value.sunrise,
                sunset: value.sunset
            };
        }
        if (!Number.isFinite(elevations.sunrise) || !Number.isFinite(elevations.sunset)) {
            throw new Error(`Invalid elevationFromHorizon: ${JSON.stringify(value)}. Expected a finite number of meters.`);
        }
        return {
            sunrise: Math.max(0, elevations.sunrise),
            sunset: Math.max(0, elevations.sunset)
        };
    }
}

import Astronomical from './Astronomical.js';
import { degreesToRadians, radiansToDegrees } from './MathUtils.js';
import SolarCoordinates from './SolarCoordinates.js';
export default class SolarTime {
    observer;
    solar;
    prevSolar;
    nextSolar;
    approxTransit;
    transit;
    sunrise;
    sunset;
    constructor(date, coordinates, sunriseElevation = 0, sunsetElevation = 0){
        const julianDay = Astronomical.julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 0);
        this.observer = coordinates;
        this.solar = new SolarCoordinates(julianDay);
        this.prevSolar = new SolarCoordinates(julianDay - 1);
        this.nextSolar = new SolarCoordinates(julianDay + 1);
        const m0 = Astronomical.approximateTransit(coordinates.longitude, this.solar.apparentSiderealTime, this.solar.rightAscension);
        const solarAltitude = -50.0 / 60.0;
        const sunriseAltitude = solarAltitude - Astronomical.elevationCorrection(sunriseElevation);
        const sunsetAltitude = solarAltitude - Astronomical.elevationCorrection(sunsetElevation);
        this.approxTransit = m0;
        this.transit = Astronomical.correctedTransit(m0, coordinates.longitude, this.solar.apparentSiderealTime, this.solar.rightAscension, this.prevSolar.rightAscension, this.nextSolar.rightAscension);
        this.sunrise = Astronomical.correctedHourAngle(m0, sunriseAltitude, coordinates, false, this.solar.apparentSiderealTime, this.solar.rightAscension, this.prevSolar.rightAscension, this.nextSolar.rightAscension, this.solar.declination, this.prevSolar.declination, this.nextSolar.declination);
        this.sunset = Astronomical.correctedHourAngle(m0, sunsetAltitude, coordinates, true, this.solar.apparentSiderealTime, this.solar.rightAscension, this.prevSolar.rightAscension, this.nextSolar.rightAscension, this.solar.declination, this.prevSolar.declination, this.nextSolar.declination);
    }
    hourAngle(angle, afterTransit) {
        return Astronomical.correctedHourAngle(this.approxTransit, angle, this.observer, afterTransit, this.solar.apparentSiderealTime, this.solar.rightAscension, this.prevSolar.rightAscension, this.nextSolar.rightAscension, this.solar.declination, this.prevSolar.declination, this.nextSolar.declination);
    }
    afternoon(shadowLength) {
        const tangent = Math.abs(this.observer.latitude - this.solar.declination);
        const inverse = shadowLength + Math.tan(degreesToRadians(tangent));
        const angle = radiansToDegrees(Math.atan(1.0 / inverse));
        const solarAngularDiameter = 32.0 / 60.0;
        if (angle <= solarAngularDiameter / 2) {
            return NaN;
        }
        const maxAltitude = Astronomical.altitudeOfCelestialBody(this.observer.latitude, this.solar.declination, 0);
        if (maxAltitude < angle) {
            return NaN;
        }
        const result = this.hourAngle(angle, true);
        if (result <= this.transit) {
            return NaN;
        }
        return result;
    }
}

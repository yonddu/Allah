import Astronomical from './Astronomical.js';
import { degreesToRadians, radiansToDegrees, unwindAngle } from './MathUtils.js';
export default class SolarCoordinates {
    declination;
    rightAscension;
    apparentSiderealTime;
    constructor(julianDay){
        const T = Astronomical.julianCentury(julianDay);
        const L0 = Astronomical.meanSolarLongitude(T);
        const Lp = Astronomical.meanLunarLongitude(T);
        const Omega = Astronomical.ascendingLunarNodeLongitude(T);
        const Lambda = degreesToRadians(Astronomical.apparentSolarLongitude(T, L0));
        const Theta0 = Astronomical.meanSiderealTime(T);
        const dPsi = Astronomical.nutationInLongitude(T, L0, Lp, Omega);
        const dEpsilon = Astronomical.nutationInObliquity(T, L0, Lp, Omega);
        const Epsilon0 = Astronomical.meanObliquityOfTheEcliptic(T);
        const EpsilonApparent = degreesToRadians(Astronomical.apparentObliquityOfTheEcliptic(T, Epsilon0));
        this.declination = radiansToDegrees(Math.asin(Math.sin(EpsilonApparent) * Math.sin(Lambda)));
        this.rightAscension = unwindAngle(radiansToDegrees(Math.atan2(Math.cos(EpsilonApparent) * Math.sin(Lambda), Math.cos(Lambda))));
        this.apparentSiderealTime = Theta0 + dPsi * 3600 * Math.cos(degreesToRadians(Epsilon0 + dEpsilon)) / 3600;
    }
}

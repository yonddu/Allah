import { Rounding } from './Rounding.js';
export function dateByAddingDays(date, days) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate() + days;
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    return new Date(year, month, day, hours, minutes, seconds);
}
export function dateByAddingMinutes(date, minutes) {
    return dateByAddingSeconds(date, minutes * 60);
}
export function dateByAddingSeconds(date, seconds) {
    return new Date(date.getTime() + seconds * 1000);
}
const MILLISECONDS_PER_MINUTE = 60 * 1000;
export function roundedMinute(date, rounding = Rounding.Nearest) {
    if (rounding === Rounding.None) {
        return new Date(date.getTime());
    }
    const seconds = Math.floor(date.getTime() / 1000);
    const minutes = seconds / 60;
    const rounded = rounding === Rounding.Up ? Math.ceil(minutes) : Math.round(minutes);
    return new Date(rounded * MILLISECONDS_PER_MINUTE);
}
export function isLeapYear(year) {
    if (year % 4 !== 0) {
        return false;
    }
    if (year % 100 === 0 && year % 400 !== 0) {
        return false;
    }
    return true;
}
export function dayOfYear(date) {
    let returnedDayOfYear = 0;
    const feb = isLeapYear(date.getFullYear()) ? 29 : 28;
    const months = [
        31,
        feb,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];
    for(let i = 0; i < date.getMonth(); i++){
        returnedDayOfYear += months[i];
    }
    returnedDayOfYear += date.getDate();
    return returnedDayOfYear;
}
export function isValidDate(date) {
    return date instanceof Date && !isNaN(date.valueOf());
}
export const MIN_PRAYER_GAP_MS = 5 * 60 * 1000;
export function timesInOrder(a, b) {
    if (!isValidDate(a) || !isValidDate(b)) {
        return false;
    }
    return b.getTime() - a.getTime() >= MIN_PRAYER_GAP_MS;
}

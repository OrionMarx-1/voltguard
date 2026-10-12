import { CARPARK_LAYOUT, zoneAt } from './layout.mjs';
import { POLICY } from '../safety.mjs';
import { temperatureColor } from '../thermal-map.mjs';

export const VEHICLE_NEUTRAL_COLOR = '#c2cdd2';
export const VEHICLE_ZONES = Object.freeze(['end', 'wheel', 'underbody']);

// Region maxima are actual pixels from the selected frame. No interpolation,
// unseen-end measurements or vehicle-specific geometry are inferred.
export function vehicleColors(matrix, { occupied = false, noData = true } = {}) {
  const peaks = Object.fromEntries(VEHICLE_ZONES.map(zone => [zone, null]));
  const validShape = Array.isArray(matrix) && matrix.length === CARPARK_LAYOUT.frame.rows &&
    matrix.every(row => Array.isArray(row) && row.length === CARPARK_LAYOUT.frame.cols);
  if (occupied && !noData && validShape) {
    matrix.forEach((row, r) => row.forEach((value, col) => {
      const zone = zoneAt(r, col);
      if (Object.hasOwn(peaks, zone) && Number.isFinite(value)) peaks[zone] = peaks[zone] === null ? value : Math.max(peaks[zone], value);
    }));
  }
  const visible = occupied && !noData && validShape && Object.values(peaks).some(value => value !== null);
  return { visible, zones: Object.fromEntries(VEHICLE_ZONES.map(zone => {
    const peakC = peaks[zone], hot = peakC !== null && peakC >= POLICY.warningTempC;
    return [zone, { peakC, hot, color: !visible ? null : peakC === null ? temperatureColor(null) : hot ? temperatureColor(peakC) : VEHICLE_NEUTRAL_COLOR }];
  })) };
}

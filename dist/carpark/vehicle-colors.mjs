import { CARPARK_LAYOUT, zoneAt } from './layout.mjs';
import { POLICY } from '../safety.mjs';
import { temperatureColor } from '../thermal-map.mjs';

export const VEHICLE_NEUTRAL_COLOR = '#c2cdd2';
export const VEHICLE_TIRE_COLOR = '#39464c';
export const VEHICLE_ZONES = Object.freeze(['end', 'wheel', 'underbody']);

// Fixed schematic projection, not a reconstruction of the measured vehicle.
// +Z is the front; +Y is up; increasing image rows move toward the ground.
export function vehicleHotspotPosition(row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= CARPARK_LAYOUT.frame.rows || col < 0 || col >= CARPARK_LAYOUT.frame.cols) return null;
  const zone = zoneAt(row, col);
  if (zone === 'wheel') {
    const left = col < 16;
    return { zone, x: (left ? -1.23 : 1.23) + (col - (left ? 5.5 : 25.5)) * .01, y: .76 - (row - 14) / 9 * .52, z: 1.35 };
  }
  if (zone === 'underbody') return { zone, x: (col - 15.5) / 6.5 * .65, y: .38 - (row - 19) / 4 * .15, z: 2.27 };
  if (zone === 'end') return { zone, x: (col / 31 * 2 - 1) * .92, y: 1.18 - (row - 4) / 14 * .62, z: 2.18 };
  return null;
}

// Region maxima are actual pixels from the selected frame. No interpolation,
// unseen-end measurements or vehicle-specific geometry are inferred.
export function vehicleColors(matrix, { occupied = false, noData = true, isCharging = false } = {}) {
  const peaks = Object.fromEntries(VEHICLE_ZONES.map(zone => [zone, null]));
  let maximum = null;
  const validShape = Array.isArray(matrix) && matrix.length === CARPARK_LAYOUT.frame.rows &&
    matrix.every(row => Array.isArray(row) && row.length === CARPARK_LAYOUT.frame.cols);
  if (occupied && !noData && validShape) {
    matrix.forEach((row, r) => row.forEach((value, col) => {
      if (!Number.isFinite(value)) return;
      if (!maximum || value > maximum.peakC) maximum = { row: r, col, peakC: value };
      const zone = zoneAt(r, col);
      if (Object.hasOwn(peaks, zone) && Number.isFinite(value)) peaks[zone] = peaks[zone] === null ? value : Math.max(peaks[zone], value);
    }));
  }
  const visible = occupied && !noData && validShape && Object.values(peaks).some(value => value !== null);
  const position = maximum && vehicleHotspotPosition(maximum.row, maximum.col);
  return { visible, bodyColor: VEHICLE_NEUTRAL_COLOR, rearWheelColor: VEHICLE_TIRE_COLOR, chargingCable: Boolean(visible && isCharging),
    hotspot: visible && position ? { ...maximum, ...position, color: temperatureColor(maximum.peakC) } : null,
    zones: Object.fromEntries(VEHICLE_ZONES.map(zone => {
    const peakC = peaks[zone], hot = peakC !== null && peakC >= POLICY.warningTempC;
    return [zone, { peakC, hot, color: !visible ? null : peakC === null ? temperatureColor(null) : hot ? temperatureColor(peakC) : VEHICLE_NEUTRAL_COLOR }];
  })) };
}

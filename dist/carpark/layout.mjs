import configuration from '../data/carpark-b2.json' with { type: 'json' };
import { ValidationError } from '../safety.mjs';

// Installation configuration, not measured vehicle geometry or telemetry.
function freezeTree(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeTree(child);
  return Object.freeze(value);
}
export const CARPARK_LAYOUT = freezeTree(configuration);

export function zoneAt(row, col) {
  const { rows, cols } = CARPARK_LAYOUT.frame;
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= rows || col >= cols) {
    throw new ValidationError('FRAME_PIXEL');
  }
  for (const zone of CARPARK_LAYOUT.zones) {
    if (zone.rects.some(rect => row >= rect.rows[0] && row <= rect.rows[1] && col >= rect.cols[0] && col <= rect.cols[1])) return zone.id;
  }
  return 'other';
}

export function zoneLabels(zone, endFacingCamera = 'front') {
  if (!['front', 'rear'].includes(endFacingCamera)) throw new ValidationError('CAMERA_FACING');
  const labels = {
    end: endFacingCamera === 'front' ? { zh: '車頭', en: 'Front end' } : { zh: '車尾', en: 'Rear end' },
    wheel: endFacingCamera === 'front' ? { zh: '前輪', en: 'Front wheels' } : { zh: '後輪', en: 'Rear wheels' },
    underbody: { zh: '車底', en: 'Underbody' },
    other: { zh: '其他位置', en: 'Other area' }
  };
  if (!Object.hasOwn(labels, zone)) throw new ValidationError('FRAME_ZONE');
  return labels[zone];
}

// A strict greater-than preserves the first maximum in row/column order.
// Bad pixels remain missing and never become a made-up hotspot.
export function hotspotRegion(matrix, endFacingCamera = 'front') {
  const { rows, cols } = CARPARK_LAYOUT.frame;
  if (!Array.isArray(matrix) || matrix.length !== rows || matrix.some(row => !Array.isArray(row) || row.length !== cols)) {
    throw new ValidationError('FRAME_MATRIX');
  }
  let hotspot = null;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const temperatureC = matrix[row][col];
      if (temperatureC === null) continue;
      if (typeof temperatureC !== 'number' || !Number.isFinite(temperatureC) || temperatureC < -60 || temperatureC > 1000) {
        throw new ValidationError('TEMPERATURE');
      }
      if (!hotspot || temperatureC > hotspot.temperatureC) hotspot = { row, col, temperatureC };
    }
  }
  if (!hotspot) throw new ValidationError('NO_MEASUREMENTS');
  const zone = zoneAt(hotspot.row, hotspot.col);
  return { ...hotspot, zone, labels: zoneLabels(zone, endFacingCamera) };
}

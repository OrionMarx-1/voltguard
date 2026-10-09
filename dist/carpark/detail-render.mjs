import { CARPARK_LAYOUT } from './layout.mjs';
import { temperatureColor } from '../thermal-map.mjs';

export function drawBayFrame(canvas, matrix, hotspot) {
  const { rows, cols } = CARPARK_LAYOUT.frame;
  if (!Array.isArray(matrix) || matrix.length !== rows || matrix.some(row => !Array.isArray(row) || row.length !== cols || row.some(value => value !== null && (!Number.isFinite(value) || value < -60 || value > 1000)))) throw Error('BAY_FRAME_MATRIX');
  const unit = 8; canvas.width = cols * unit; canvas.height = rows * unit;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  matrix.forEach((row, r) => row.forEach((value, col) => {
    ctx.fillStyle = temperatureColor(value); ctx.fillRect(col * unit, r * unit, unit, unit);
    if (value === null) { ctx.strokeStyle = '#9dabb2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(col * unit, r * unit + unit); ctx.lineTo(col * unit + unit, r * unit); ctx.stroke(); }
  }));
  ctx.lineWidth = 1; ctx.strokeStyle = '#ffffffa6';
  for (const zone of CARPARK_LAYOUT.zones) for (const rect of zone.rects) {
    ctx.strokeRect(rect.cols[0] * unit + .5, rect.rows[0] * unit + .5, (rect.cols[1] - rect.cols[0] + 1) * unit - 1, (rect.rows[1] - rect.rows[0] + 1) * unit - 1);
  }
  if (hotspot) {
    const x = (hotspot.col + .5) * unit, y = (hotspot.row + .5) * unit;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.strokeStyle = '#163444'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
  }
}

// Position samples by their timestamps, never evenly space missing seconds or
// connect across a feed gap. Scale includes the fixed 60/80°C threshold lines.
export function trendGeometry(history, capturedAt) {
  const end = Date.parse(capturedAt);
  if (!Number.isFinite(end)) return { paths: [], points: [], min: 20, max: 80 };
  const samples = history.filter(item => Number.isFinite(item.peakC) && Number.isFinite(Date.parse(item.capturedAt)))
    .map(item => ({ time: Date.parse(item.capturedAt), value: item.peakC }))
    .filter(item => item.time > end - 60000 && item.time <= end).sort((a, b) => a.time - b.time);
  const min = Math.min(20, ...samples.map(item => Math.floor(item.value / 10) * 10));
  const max = Math.max(80, ...samples.map(item => Math.ceil(item.value / 10) * 10));
  const points = samples.map(item => ({ ...item, x: 12 + (item.time - end + 60000) / 60000 * 276, y: 8 + (max - item.value) / (max - min) * 76 }));
  const paths = []; let path = '';
  for (const [i, point] of points.entries()) {
    if (!i || point.time - points[i - 1].time > 1500) { if (path) paths.push(path); path = `M${point.x.toFixed(2)},${point.y.toFixed(2)}`; }
    else path += ` L${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }
  if (path) paths.push(path);
  return { paths, points, min, max };
}

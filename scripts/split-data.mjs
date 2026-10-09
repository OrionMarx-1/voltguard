import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(projectRoot, 'dist', 'data');
const cellIds = ['b0005', 'b0006', 'b0007', 'b0018'];

const thermalStatus = cycle => {
  if (cycle.tempMaxC >= 80 || cycle.maxFiveSecondRiseCPerS >= 2) return 'danger';
  if (cycle.tempMaxC >= 60 || cycle.maxFiveSecondRiseCPerS >= 1) return 'warning';
  return 'normal';
};

const maintenanceStatus = cycle => cycle.sohPercent < 75 ? 'review' : cycle.sohPercent < 90 ? 'watch' : 'normal';
const fleetCells = [];

for (const cellId of cellIds) {
  const source = JSON.parse(await readFile(join(dataDir, `${cellId}.json`), 'utf8'));
  const cellDir = join(dataDir, 'cells', cellId);
  const cyclesDir = join(cellDir, 'cycles');
  await mkdir(cyclesDir, { recursive: true });

  const cycleIndex = source.cycles.map(({ samples, ...cycle }) => cycle);
  await writeFile(join(cellDir, 'summary.json'), JSON.stringify({
    dataset: source.dataset,
    summary: source.summary,
    cycles: cycleIndex,
  }), 'utf8');

  await Promise.all(source.cycles.map((cycle, index) => {
    const filename = `${String(index + 1).padStart(3, '0')}.json`;
    return writeFile(join(cyclesDir, filename), JSON.stringify(cycle), 'utf8');
  }));

  const latest = source.cycles.at(-1);
  fleetCells.push({
    id: source.dataset.cell,
    dataPath: `./data/cells/${cellId}`,
    dischargeCycleCount: source.summary.dischargeCycleCount,
    initialCapacityAh: source.summary.initialCapacityAh,
    latestCapacityAh: latest.capacityAh,
    latestSohPercent: latest.sohPercent,
    latestPeakTempC: latest.tempMaxC,
    latestRiseCPerS: latest.maxFiveSecondRiseCPerS,
    observedPeakTempC: source.summary.observedPeakTempC,
    latestRecordedAt: latest.recordedAt,
    thermalStatus: thermalStatus(latest),
    maintenanceStatus: maintenanceStatus(latest),
  });
}

await writeFile(join(dataDir, 'fleet-summary.json'), JSON.stringify({
  source: 'NASA Ames PCoE Battery Data Set',
  sourceUrl: 'https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/',
  mode: 'historical_measured_records',
  thresholds: {
    warningTempC: 60,
    dangerTempC: 80,
    warningRiseCPerS: 1,
    dangerRiseCPerS: 2,
  },
  cells: fleetCells,
}), 'utf8');

console.log(`Created verified fleet index for ${fleetCells.length} cells and ${fleetCells.reduce((sum, cell) => sum + cell.dischargeCycleCount, 0)} measured discharge cycles.`);

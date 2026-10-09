import { DEMO_BAYS, SCENARIOS, bayFrameAt } from './scenarios.mjs';
import { ValidationError } from '../../dist/safety.mjs';

export function createSimulationPlayer({ now = Date.now, onFrame, onTick = () => {}, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
  const serviceStartedAt = now();
  let playbackStartedAt = serviceStartedAt, scenario = null, lastSecond = -1, sequence = 0, timer = null;
  function tick() {
    const receivedAt = now();
    if (!Number.isFinite(receivedAt) || receivedAt < playbackStartedAt) throw new ValidationError('SIMULATION_CLOCK');
    const second = Math.floor((receivedAt - playbackStartedAt) / 1000);
    if (second <= lastSecond) return false;
    const serviceSecond = Math.floor((receivedAt - serviceStartedAt) / 1000);
    sequence++;
    // Sample time follows the logical source clock, so timer jitter cannot create
    // a fabricated high rise rate. Freshness is measured at receipt in bays.mjs.
    const capturedAt = new Date(playbackStartedAt + second * 1000).toISOString();
    for (const bay of DEMO_BAYS) {
      const matrix = bayFrameAt(bay.bayId, serviceSecond, { scenario, scenarioTime: second });
      if (matrix === null) continue;
      onFrame({ schemaVersion: 'voltguard-frame-1', bayId: bay.bayId, seq: sequence, capturedAt, temperaturesC: matrix });
    }
    lastSecond = second;
    onTick({ second, scenario, seq: sequence });
    return true;
  }
  function reset(name = null) {
    if (name !== null && !['A', 'B'].includes(name)) throw new ValidationError('SIMULATION_SCENARIO');
    scenario = name;
    playbackStartedAt = now();
    lastSecond = -1;
    sequence = 0;
    tick();
  }
  function start() {
    if (timer !== null) return;
    tick();
    timer = setIntervalFn(tick, 1000);
    timer?.unref?.();
  }
  function stop() {
    if (timer !== null) clearIntervalFn(timer);
    timer = null;
  }
  return { tick, reset, start, stop };
}

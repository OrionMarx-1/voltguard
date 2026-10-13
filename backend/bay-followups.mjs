import { randomUUID } from 'node:crypto';
import { hotspotRegion } from '../dist/carpark/layout.mjs';
import { ValidationError } from '../dist/safety.mjs';
import { SCENARIOS, frameAt } from './sim/scenarios.mjs';

export const FOLLOWUP_DELAY_SECONDS = 8;

export function patrolReport(scenario) {
  if (scenario === 'B') return { zh: '現場回報：車底明顯發熱。', en: 'Patrol report: underbody heat is obvious.' };
  if (scenario === 'C') return { zh: '現場回報：輪轂熱、車底不高。', en: 'Patrol report: hub is warm; underbody is not elevated.' };
  if (scenario === 'A') return { zh: '現場回報：前輪熱、車底不高。', en: 'Patrol report: front wheels warm; underbody is not elevated.' };
  return { zh: '現場回報：已到達，未見明顯車底發熱。', en: 'Patrol report: on site; no obvious underbody heat.' };
}

function publicItem(item) {
  if (!item) return null;
  const shared = {
    status: item.status, kind: item.kind, bayId: item.bayId, alertId: item.alertId,
    requestedSecond: item.requestedSecond, readySecond: item.readySecond, sourceType: 'simulation', exportable: false
  };
  if (item.kind === 'closeup') {
    return {
      ...shared,
      note: { zh: '仿真特寫熱像，不是真實監控平台接入。', en: 'Simulated close-up thermal view, not a live CCTV integration.' },
      frame: item.status === 'ready' ? item.frame : null,
      hotspot: item.status === 'ready' ? item.hotspot : null
    };
  }
  return { ...shared, text_zh: item.status === 'ready' ? item.text_zh : null, text_en: item.status === 'ready' ? item.text_en : null };
}

export function createBayFollowups({ delaySeconds = FOLLOWUP_DELAY_SECONDS } = {}) {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 1) throw new ValidationError('FOLLOWUP_DELAY');
  let sessionId = null, scenario = null, second = 0;
  const items = [];
  function existing(bayId, kind) {
    return items.find(item => item.bayId === bayId && item.kind === kind) ?? null;
  }
  function request({ bayId, alertId, kind }) {
    if (!['closeup', 'patrol'].includes(kind)) throw new ValidationError('FOLLOWUP_KIND');
    const current = existing(bayId, kind);
    if (current) return current;
    const item = {
      id: randomUUID(), sessionId, bayId, alertId, kind, requestedSecond: second, readySecond: second + delaySeconds,
      status: 'pending', frame: null, hotspot: null, text_zh: null, text_en: null
    };
    items.push(item);
    return item;
  }
  return {
    reset(id, name = null) { sessionId = id; scenario = name; second = 0; items.length = 0; },
    request,
    requestFromDecision(decision) {
      if (decision.extras.includes('request_closeup')) request({ bayId: decision.bayId, alertId: decision.alertId, kind: 'closeup' });
      if (decision.extras.includes('dispatch_patrol')) request({ bayId: decision.bayId, alertId: decision.alertId, kind: 'patrol' });
    },
    setSecond(next, { capturedAt = null } = {}) {
      second = next;
      const newly = [];
      for (const item of items) {
        if (item.status !== 'pending' || next < item.readySecond) continue;
        item.status = 'ready';
        if (item.kind === 'closeup') {
          const closeupScenario = scenario && SCENARIOS[scenario]?.bayId === item.bayId ? scenario : 'normal';
          const matrix = frameAt(closeupScenario, closeupScenario === 'normal' ? 0 : next, { closeup: true });
          item.frame = {
            schemaVersion: 'voltguard-frame-1', bayId: item.bayId, seq: null, capturedAt,
            temperaturesC: matrix, sourceType: 'simulation', exportable: false, view: 'closeup'
          };
          item.hotspot = hotspotRegion(matrix);
        } else {
          const report = patrolReport(scenario);
          item.text_zh = report.zh;
          item.text_en = report.en;
        }
        newly.push(item);
      }
      return newly;
    },
    forBay(bayId) { return { closeup: publicItem(existing(bayId, 'closeup')), patrol: publicItem(existing(bayId, 'patrol')) }; }
  };
}

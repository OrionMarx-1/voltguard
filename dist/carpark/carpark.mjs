import { CARPARK_LAYOUT } from './layout.mjs';
import { displayBay, countBayStates, bayInDirection, displayAlerts } from './state.mjs';
import { zoneLabels } from './layout.mjs';
import { createBayDetailLoader } from './detail-loader.mjs';
import { drawBayFrame, trendGeometry } from './detail-render.mjs';
import { createDecisionPanel } from './decision-panel.mjs';
import { reminderCycleKey, reminderPolicy } from './reminders.mjs';
import { createReminderAudio } from './reminder-audio.mjs';
import { vehicleColors } from './vehicle-colors.mjs';
import { createBayVehicle } from './vehicle-3d.mjs';

const bridge = window.voltguard, $ = id => document.getElementById(id);
const words = {
  zh: {
    vehicle3d: '車位 3D · 仿真', vehicleLimit: '示意，非實車模型', vehicleColors: '熱斑僅表示最熱格點的示意位置，非整車溫度場；圖例為分區峰值。拖動可旋轉。', vehicleFallback: '3D 無法顯示；2D 熱圖與平面圖仍可用。',
    tab: '車位監控', kicker: '控制室 · 停車場早期預警', title: '先看見異常，再決定下一步。',
    intro: 'B2 層 · 6 個充電位', simulation: '仿真演示', compressed: '演示時間已壓縮',
    limit: '合成溫度幀，非實測或物理模型結果；不進入實測記錄或匯出。',
    live: '本機服務已連線', loading: '正在連接本機服務', offline: '連線中斷 · 保留已知告警',
    serviceRequired: '需運行本地服務', serviceNote: '車位演示需要本機 VoltGuard 服務。NASA 實測頁面仍可使用。',
    retry: '重新連線', normal: '正常', warning: '警告', danger: '危險', no_data: '無資料', connecting: '正在接入',
    map: 'B2 車位平面圖', mapNote: '按狀態查看車位；顏色與文字同時標示', chargingRow: '充電車位', standardRow: '普通車位',
    aisle: '行車通道', charging: '充電中', charger: '充電位', parked: '有車 · 未充電', empty: '空位', unknown: '車輛狀態未知',
    latest: '最高溫', lastReading: '最後讀值', blindSpots: '無資料車位', alerts: '目前告警', alertsNote: '已處理告警仍保留，待持續正常後結束；重置可清空。',
    noAlerts: '目前沒有規則告警', noAlertsNote: '系統持續監測；無資料不代表正常。', pending: '待處理', recovered: '溫度已恢復正常',
    selected: '車位詳情', selectHint: '點選車位，或用方向鍵移動。', chargingBay: '充電車位', standardBay: '普通車位',
    evidence: '車位畫面 · 仿真',
    noFrame: '尚無可用溫度幀', missingNote: '未收到新資料；不能據此判定正常。', summaryNote: '此頁顯示規則狀態與最高溫。',
    controls: '演示控制', controlsNote: '選擇場景會清空上一場演示告警。',
    sceneA: '場景 A', sceneADesc: '前輪餘熱', sceneB: '場景 B', sceneBDesc: '車底升溫', reset: '重置演示',
    ai: 'AI 說明', aiNote: 'AI 未配置，規則告警照常運行。', baseline: '正常背景', runningA: '場景 A · 前輪餘熱', runningB: '場景 B · 車底升溫',
    policy: '原型閾值', policyNote: '警告 ≥ 60°C 或 1°C/s · 危險 ≥ 80°C 或 2°C/s。尚未按車型校準。',
    actionFailed: '操作未完成，請重新連線後再試。', csrfError: '服務已重啟，請重新連線後再試。',
    floorLabel: 'B2 車位配置', summaryLabel: '車位規則狀態摘要', context: 'B2 停車場 · 仿真演示 · 非實測',
    counts: '車位狀態統計', selectBay: '查看車位', noDataBadge: '無資料',
    thermalImage: '熱成像 · 仿真', camera: '車道對面斜上方視角 · 只覆蓋朝外的一端',
    palette: '固定色標 20–80°C · 超出範圍顏色封頂', missingPixel: '灰色斜線：壞點；不補值',
    hotspot: '最高溫位置', rule: '當前幀規則', rise: '最高格點升溫速率', trend: '最近 60 秒最高溫',
    trendNote: '按採樣時間繪製；斷幀留空，不補線。', lastMinute: '−60 秒', now: '此幀',
    detailLoading: '正在讀取車位詳情…', detailFailed: '詳情讀取失敗；保留最後畫面。',
    detailBehind: '等待最新幀詳情；以下為最後畫面。', detailMissing: '未收到新資料；以下為最後畫面與規則。',
    detailRetry: '重試詳情', noRate: '缺少可比較幀，速率不可用。', unknownRule: '資料不足',
    frame: '幀', ruleNote: '規則來自服務端；上方車位狀態保留未結束告警。', processing: '處理中', downgraded: '已降級 · 觀察中'
  },
  en: {
    vehicle3d: 'Bay 3D · Simulation', vehicleLimit: 'Schematic, not a real vehicle model', vehicleColors: 'The spot maps only the hottest pixel, not a whole-vehicle temperature field. The legend shows region peaks. Drag to rotate.', vehicleFallback: '3D unavailable; the 2D heatmap and floor plan remain usable.',
    tab: 'Bay monitor', kicker: 'CONTROL ROOM · EARLY WARNING', title: 'Spot the change. Decide the next step.',
    intro: 'Level B2 · 6 charging bays', simulation: 'Simulation demo', compressed: 'Demo time is compressed',
    limit: 'Synthetic temperature frames, not measurements or a physical model. Excluded from measured records and exports.',
    live: 'Local service connected', loading: 'Connecting to local service', offline: 'Connection lost · Known alerts retained',
    serviceRequired: 'Run the local service', serviceNote: 'The bay demo needs the local VoltGuard service. NASA measured-data pages remain available.',
    retry: 'Reconnect', normal: 'Normal', warning: 'Warning', danger: 'Danger', no_data: 'No data', connecting: 'Connecting',
    map: 'B2 parking layout', mapNote: 'Inspect each bay; status uses both colour and text', chargingRow: 'CHARGING BAYS', standardRow: 'STANDARD BAYS',
    aisle: 'DRIVE AISLE', charging: 'Charging', charger: 'Charging bay', parked: 'Parked · Not charging', empty: 'Empty bay', unknown: 'Occupancy unknown',
    latest: 'Peak temperature', lastReading: 'Last reading', blindSpots: 'Bays without data', alerts: 'Current alerts', alertsNote: 'Handled alerts remain until sustained normal evidence closes them or the demo is reset.',
    noAlerts: 'No current rule alerts', noAlertsNote: 'Monitoring continues. Missing data is not a normal result.', pending: 'Pending', recovered: 'Temperature returned to normal',
    selected: 'Bay details', selectHint: 'Select a bay, or move with the arrow keys.', chargingBay: 'Charging bay', standardBay: 'Standard bay',
    evidence: 'Bay view · Simulation',
    noFrame: 'No temperature frame available', missingNote: 'No new data. A normal result cannot be established.', summaryNote: 'This view shows rule status and peak temperature.',
    controls: 'Demo controls', controlsNote: 'Starting a scenario clears the previous demo alerts.',
    sceneA: 'Scenario A', sceneADesc: 'Wheel residual heat', sceneB: 'Scenario B', sceneBDesc: 'Underbody heating', reset: 'Reset demo',
    ai: 'AI explanation', aiNote: 'AI is not configured. Rule alerts remain active.', baseline: 'Baseline', runningA: 'Scenario A · Wheel residual heat', runningB: 'Scenario B · Underbody heating',
    policy: 'Prototype thresholds', policyNote: 'Warning ≥ 60°C or 1°C/s · Danger ≥ 80°C or 2°C/s. Not vehicle-calibrated.',
    actionFailed: 'The action did not complete. Reconnect and try again.', csrfError: 'The service restarted. Reconnect and try again.',
    floorLabel: 'B2 bay configuration', summaryLabel: 'Bay rule-status summary', context: 'B2 carpark · Simulation demo · Not measured',
    counts: 'Bay status counts', selectBay: 'Inspect bay', noDataBadge: 'No data',
    thermalImage: 'Thermal image · Simulation', camera: 'Angled view across the aisle · Outward-facing end only',
    palette: 'Fixed 20–80°C scale · Colours clamp outside this range', missingPixel: 'Grey hatching: missing pixel; no fill',
    hotspot: 'Peak location', rule: 'Current frame rule', rise: 'Maximum pixel rise rate', trend: 'Peak temperature · Last 60 seconds',
    trendNote: 'Positioned by capture time; feed gaps stay blank.', lastMinute: '−60 s', now: 'This frame',
    detailLoading: 'Loading bay details…', detailFailed: 'Details could not be read; last image retained.',
    detailBehind: 'Waiting for latest details; last image shown below.', detailMissing: 'No new data; last image and rule shown below.',
    detailRetry: 'Retry details', noRate: 'No comparable frame; rise rate unavailable.', unknownRule: 'Insufficient data',
    frame: 'Frame', ruleNote: 'Rules come from the service. The bay status above retains active alerts.', processing: 'In progress', downgraded: 'Downgraded · Observing'
  }
};
const c = () => words[bridge.language];
const icons = { normal: '✓', warning: '!', danger: '!', no_data: '−' };
const view = document.createElement('section');
view.id = 'carparkView'; view.hidden = true;
view.innerHTML = `
  <div class="carpark-intro"><div><p class="cp-eyebrow" data-cp="kicker"></p><h1 data-cp="title"></h1><p class="cp-subtitle" data-cp="intro"></p></div><div id="cpConnection" class="cp-connection" role="status"></div></div>
  <div class="cp-demo-banner"><div class="cp-demo-symbol" aria-hidden="true">S</div><div><strong data-cp="simulation"></strong><span class="cp-banner-divider" aria-hidden="true">/</span><span data-cp="compressed"></span><p data-cp="limit"></p></div></div>
  <div id="cpServiceNotice" class="cp-service-notice" hidden><div><strong data-cp="serviceRequired"></strong><p data-cp="serviceNote"></p><code>node serve.mjs</code></div><button id="cpReconnect" class="cp-button" data-cp="retry" type="button"></button></div>
  <p id="cpError" class="cp-error" role="alert" hidden></p>
  <div class="cp-workspace">
    <div class="cp-map-column">
      <section class="cp-map-panel" aria-labelledby="cpMapTitle">
        <div class="cp-panel-head"><div><p class="cp-eyebrow">FLOOR / B2</p><h2 id="cpMapTitle" data-cp="map"></h2><p data-cp="mapNote"></p></div><div class="cp-floor-mark" aria-hidden="true">B2</div></div>
        <div id="cpCounts" class="cp-counts"></div>
        <div class="cp-floor"><div class="cp-row-label" data-cp="chargingRow"></div><div id="cpBayGrid" class="cp-bay-grid"></div></div>
        <div class="cp-map-foot"><span data-cp="selectHint"></span><span>32 × 24 · 1 Hz</span></div>
      </section>
      <section class="cp-controls" aria-labelledby="cpControlsTitle"><div class="cp-controls-heading"><div><h2 id="cpControlsTitle" data-cp="controls"></h2><p data-cp="controlsNote"></p></div><span id="cpScenario" class="cp-scenario-label"></span></div><div class="cp-control-actions"><button id="cpScenarioA" class="cp-scenario-button" type="button" aria-pressed="false"><span class="cp-scenario-letter">A</span><span><strong data-cp="sceneA"></strong><small data-cp="sceneADesc"></small></span></button><button id="cpScenarioB" class="cp-scenario-button" type="button" aria-pressed="false"><span class="cp-scenario-letter">B</span><span><strong data-cp="sceneB"></strong><small data-cp="sceneBDesc"></small></span></button><button id="cpReset" class="cp-button cp-reset" type="button"><span aria-hidden="true">↺</span><span data-cp="reset"></span></button></div><div class="cp-ai-control"><label><input id="cpAiToggle" type="checkbox" disabled><span data-cp="ai"></span></label><span data-cp="aiNote"></span></div></section>
    </div>
    <section id="cpEvidencePanel" class="cp-evidence-panel" aria-labelledby="cpEvidenceTitle"><h2 id="cpEvidenceTitle" class="cp-evidence-title" data-cp="evidence"></h2></section>
    <aside class="cp-sidebar">
      <section class="cp-alert-panel" aria-labelledby="cpAlertsTitle"><div class="cp-sidebar-heading"><h2 id="cpAlertsTitle" data-cp="alerts"></h2><span id="cpAlertCount" class="cp-counter">0</span></div><p id="cpNoDataBays" class="cp-no-data"></p><div id="cpAlertList" aria-live="polite" aria-atomic="true"></div><p class="cp-panel-note" data-cp="alertsNote"></p></section>
      <section id="cpSelectedPanel" class="cp-selected-panel" aria-labelledby="cpSelectedTitle"><div class="cp-sidebar-heading"><h2 id="cpSelectedTitle" data-cp="selected"></h2><span class="cp-selection-dot" aria-hidden="true"></span></div><div class="cp-selected-heading"><strong id="cpSelectedId"></strong><span id="cpSelectedType"></span></div><span id="cpSelectedStatus" class="cp-status-tag"></span><div class="cp-selected-temp"><span id="cpSelectedPeak">—</span><small>°C</small></div><p id="cpSelectedCaption"></p><p id="cpSelectedOccupancy"></p><p id="cpSelectedNote" class="cp-panel-note"></p></section>
      <section class="cp-policy"><h2 data-cp="policy"></h2><p data-cp="policyNote"></p></section>
    </aside>
  </div>`;
document.querySelector('.view-tabs').after(view);
const details = document.createElement('div'); details.className = 'cp-detail-content';
details.innerHTML = `<div id="cpDetailNotice" class="cp-detail-notice" role="status" hidden></div><button id="cpDetailRetry" class="cp-button" type="button" data-cp="detailRetry" hidden></button>
  <div id="cpDetailEmpty" class="cp-detail-empty" data-cp="noFrame"></div>
  <div id="cpVehicleEmptyStage"></div>
  <div id="cpFrameContent" hidden>
    <div class="cp-thermal-head"><h3 data-cp="thermalImage"></h3><span id="cpFrameStamp"></span></div>
    <div class="cp-frame-views"><div class="cp-flat-frame">
    <canvas id="cpThermalImage" width="256" height="192" role="img"></canvas>
    <div class="cp-palette" aria-hidden="true"></div><div class="cp-palette-ticks" aria-hidden="true"><span>20°C</span><span>40°C</span><span>60°C</span><span>80°C</span></div>
    <p class="cp-detail-small" data-cp="palette"></p><p class="cp-detail-small" data-cp="missingPixel"></p>
    <p class="cp-detail-small cp-camera-note" data-cp="camera"></p>
    </div><section id="cpVehicle3D" class="cp-vehicle-3d" hidden aria-labelledby="cpVehicleTitle"><h3 id="cpVehicleTitle" data-cp="vehicle3d"></h3><p class="cp-vehicle-limit" data-cp="vehicleLimit"></p><div id="cpVehicleHost" class="cp-vehicle-host"></div><div id="cpVehicleLegend" class="cp-vehicle-legend"></div><p class="cp-detail-small" data-cp="vehicleColors"></p></section></div>
    <p id="cpVehicleFallback" class="cp-detail-small" data-cp="vehicleFallback" hidden></p>
    <div id="cpZoneLegend" class="cp-zone-legend"></div><p id="cpHotspot" class="cp-hotspot"></p>
    <dl class="cp-rule-grid"><div><dt data-cp="rise"></dt><dd id="cpRiseRate"></dd></div><div><dt data-cp="rule"></dt><dd id="cpRuleLevel"></dd></div></dl>
    <p id="cpNoRate" class="cp-detail-small" data-cp="noRate" hidden></p>
    <p class="cp-detail-small" data-cp="ruleNote"></p>
    <h3 class="cp-trend-title" data-cp="trend"></h3><svg id="cpTrend" viewBox="0 0 300 110" role="img"></svg>
    <p class="cp-detail-small" data-cp="trendNote"></p>
  </div>`;
const decisionHost = document.createElement('div'); decisionHost.className = 'cp-decision-panel';
$('cpSelectedOccupancy').after(decisionHost);
$('cpEvidencePanel').append(details);
// Keep the existing missing-frame 2D state while allowing an empty bay schematic.
const vehiclePosition = document.createElement('div'); vehiclePosition.className = 'cp-flat-frame';
$('cpVehicle3D').before(vehiclePosition); vehiclePosition.append($('cpVehicle3D'));
const fallbackPosition = document.createElement('div');
$('cpVehicleFallback').before(fallbackPosition); fallbackPosition.append($('cpVehicleFallback'));
const operatorHost = document.createElement('div'); operatorHost.className = 'cp-operator'; view.querySelector('.cp-demo-banner').after(operatorHost);
const reminderHost = document.createElement('div'); reminderHost.className = 'cp-reminder-controls';
reminderHost.innerHTML = '<button id="cpReminderEnable" class="cp-button" type="button"></button><button id="cpGlobalMute" class="cp-button" type="button" aria-pressed="false"></button><span id="cpReminderState" role="status"></span>';
operatorHost.after(reminderHost);
const reminderAudio = createReminderAudio(), mutedUntil = new Map(); let globalMuted = false, reminderEnableFailed = false;
$('cpReminderEnable').addEventListener('click', async () => { reminderEnableFailed = !await reminderAudio.enable(); updateReminders(); });
$('cpGlobalMute').addEventListener('click', () => { globalMuted = !globalMuted; updateReminders(); });
const tab = $('carparkTab');

const vehicleSvg = '<svg viewBox="0 0 54 88" aria-hidden="true"><rect class="cp-car-body" x="9" y="4" width="36" height="80" rx="13"/><path class="cp-car-window" d="M16 23h22l3 17H13zM14 59h26l-3 14H17z"/><path class="cp-car-trim" d="M10 47h34M14 11h7m12 0h7M14 79h7m12 0h7"/><rect x="5" y="21" width="4" height="16" rx="2"/><rect x="45" y="21" width="4" height="16" rx="2"/><rect x="5" y="58" width="4" height="16" rx="2"/><rect x="45" y="58" width="4" height="16" rx="2"/></svg>';
const bayElements = new Map();
for (const bay of CARPARK_LAYOUT.bays) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'cp-bay'; button.dataset.bay = bay.id;
  button.style.gridColumn = String(bay.col + 1); button.style.gridRow = String(bay.row + 1);
  button.innerHTML = `<span class="cp-bay-top"><strong>${bay.id}</strong><span class="cp-charger-icon" aria-hidden="true">${bay.charging ? 'ϟ' : ''}</span></span><span class="cp-bay-state"><span class="cp-state-icon" aria-hidden="true"></span><span class="cp-state-text"></span></span><span class="cp-bay-vehicle">${vehicleSvg}<span class="cp-empty-icon" aria-hidden="true">P</span></span><span class="cp-bay-temperature"></span><span class="cp-bay-occupancy"></span><span class="cp-bay-missing"></span><span class="cp-bay-pending-age" hidden></span>`;
  button.addEventListener('click', () => selectBay(bay.id));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const id = bayInDirection(CARPARK_LAYOUT.bays, bay.id, event.key);
    selectBay(id); bayElements.get(id).focus();
  });
  $('cpBayGrid').append(button); bayElements.set(bay.id, button);
}
const aisle = document.createElement('div'); aisle.className = 'cp-aisle'; aisle.innerHTML = '<span aria-hidden="true">→</span><span data-cp="aisle"></span><span aria-hidden="true">→</span>';
$('cpBayGrid').append(aisle);

let snapshot = null, alerts = [], selected = 'B2-02', csrf = '', connected = false, service = 'loading', busy = false, error = '', started = false;
let socket = null, reconnectTimer = null, lastUpdateAt = 0, loadId = 0, stopped = false, alertSignature = '';
let detailRevision = 0, alertsLoadId = 0;
const retiredSessions = new Set();
const decisionPanel = createDecisionPanel({ host: decisionHost, operatorHost, language: () => bridge.language, request,
  async onSaved(result) {
    if (snapshot?.session.id !== result.session.id) return;
    applySnapshot(await request('/api/carpark')); await refreshAlerts(); detailLoader.retry();
  }
});
const detailLoader = createBayDetailLoader({
  fetchDetail: (id, signal) => request(`/api/bays/${encodeURIComponent(id)}`, undefined, signal),
  onChange: () => render()
});
let detailSignature = '', vehicleModel = null, vehicleFailed = false;
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
const currentBays = () => CARPARK_LAYOUT.bays.map(bay => displayBay(snapshot?.bays.find(item => item.id === bay.id), connected));
function occupancy(bay) { return !snapshot || bay.noData ? c().unknown : bay.isCharging ? c().charging : bay.occupied ? c().parked : c().empty; }
function syncDetail() {
  if (view.hidden || !connected || !snapshot) return;
  const bay = snapshot.bays.find(item => item.id === selected);
  detailLoader.update({ bayId: selected, sessionId: snapshot.session.id, seq: bay?.frameSeq ?? null, revision: detailRevision });
}
function selectBay(id) { selected = id; detailLoader.close(); render(); syncDetail(); }
function renderVehicle(frame, detail, bay) {
  const state = vehicleColors(frame?.temperaturesC, { occupied: Boolean(bay.occupied), isCharging: Boolean(bay.isCharging), noData: !connected || bay.noData || !detail || detail.summary.noData });
  const stage = frame ? vehiclePosition : $('cpVehicleEmptyStage'), fallbackStage = frame ? fallbackPosition : $('cpVehicleEmptyStage');
  if ($('cpVehicle3D').parentElement !== stage) stage.append($('cpVehicle3D'));
  if ($('cpVehicleFallback').parentElement !== fallbackStage) fallbackStage.append($('cpVehicleFallback'));
  const host = $('cpVehicleHost'); host.dataset.vehicle = String(state.visible); host.dataset.zoneColors = JSON.stringify(state.zones);
  host.dataset.hotspot = JSON.stringify(state.hotspot);
  $('cpVehicle3D').hidden = vehicleFailed;
  $('cpVehicleFallback').hidden = !vehicleFailed;
  if (vehicleFailed) return;
  try {
    vehicleModel ??= createBayVehicle(host, { onFailure() { vehicleFailed = true; vehicleModel = null; host.replaceChildren(); $('cpVehicle3D').hidden = true; $('cpVehicleFallback').hidden = false; } });
    vehicleModel.update(state, `${selected}, ${c().vehicle3d}, ${c().vehicleLimit}`); host.dataset.frameSeq = String(frame?.seq ?? '');
    $('cpVehicleLegend').replaceChildren();
    for (const [zone, reading] of Object.entries(state.zones)) {
      const item = document.createElement('span'); item.className = 'cp-vehicle-zone'; item.dataset.zone = zone;
      const swatch = document.createElement('i'); swatch.style.backgroundColor = reading.color; swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = `${zoneLabels(zone, detail?.bay.endFacingCamera ?? 'front')[bridge.language]} ${reading.peakC === null ? '—' : reading.peakC.toFixed(1) + '°C'}`;
      item.append(swatch, label); $('cpVehicleLegend').append(item);
    }
  } catch { vehicleFailed = true; vehicleModel?.dispose(); vehicleModel = null; host.replaceChildren(); $('cpVehicle3D').hidden = true; $('cpVehicleFallback').hidden = false; }
}
function renderDetail(bay, config) {
  const { detail, loading, error: failed } = detailLoader.state;
  const matches = detail?.bay.id === selected && detail?.session.id === snapshot?.session.id;
  const frame = matches ? detail.frame : null;
  renderVehicle(frame, matches ? detail : null, bay);
  const behind = Boolean(frame && bay.frameSeq !== null && frame.seq < bay.frameSeq);
  const stale = Boolean(frame && (!connected || bay.noData || detail.summary.noData || behind || failed));
  $('cpFrameContent').hidden = !frame; $('cpDetailEmpty').hidden = Boolean(frame);
  $('cpSelectedPanel').dataset.detailStale = String(stale);
  $('cpEvidencePanel').dataset.detailStale = String(stale);
  $('cpSelectedPanel').dataset.detailBay = matches ? selected : '';
  $('cpSelectedPanel').dataset.detailSession = matches ? detail.session.id : '';
  const notice = failed ? c().detailFailed : frame && (!connected || (bay.noData && !bay.connecting) || (detail.summary.noData && !detail.summary.connecting)) ? c().detailMissing : behind ? c().detailBehind : loading && !frame ? c().detailLoading : '';
  $('cpDetailNotice').hidden = !notice; setText($('cpDetailNotice'), notice);
  $('cpDetailRetry').hidden = !failed; $('cpDetailRetry').disabled = !connected || loading;
  if (!frame) { detailSignature = ''; $('cpThermalImage').dataset.frameSeq = ''; return; }
  const signature = JSON.stringify([detail.session.id, selected, frame.seq, bridge.language]);
  if (signature === detailSignature) return;
  detailSignature = signature;
  drawBayFrame($('cpThermalImage'), frame.temperaturesC, detail.hotspot);
  $('cpThermalImage').dataset.frameSeq = String(frame.seq);
  $('cpThermalImage').dataset.region = detail.hotspot?.zone ?? '';
  $('cpThermalImage').dataset.peak = String(detail.assessment?.peakC ?? '');
  const region = detail.hotspot ? zoneLabels(detail.hotspot.zone, config.endFacingCamera)[bridge.language] : '—';
  const peak = detail.assessment?.peakC;
  $('cpThermalImage').setAttribute('aria-label', `${selected}, ${c().thermalImage}, ${c().hotspot}: ${region}, ${Number.isFinite(peak) ? peak.toFixed(1) : '—'}°C`);
  setText($('cpFrameStamp'), `${c().frame} ${frame.seq} · ${new Date(frame.capturedAt).toLocaleTimeString(bridge.language === 'zh' ? 'zh-HK' : 'en-GB', { hour12: false })}`);
  setText($('cpZoneLegend'), ['end', 'wheel', 'underbody', 'other'].map(zone => zoneLabels(zone, config.endFacingCamera)[bridge.language]).join(' / '));
  setText($('cpHotspot'), `${c().hotspot}: ${region}${detail.hotspot ? ` · ${detail.hotspot.temperatureC.toFixed(1)}°C · (${detail.hotspot.row + 1}, ${detail.hotspot.col + 1})` : ''}`);
  const rate = detail.assessment?.riseCPerS;
  setText($('cpRiseRate'), Number.isFinite(rate) ? `${rate.toFixed(2)} °C/s` : '—');
  $('cpNoRate').hidden = Number.isFinite(rate);
  const level = detail.assessment?.thermal;
  setText($('cpRuleLevel'), ['normal', 'warning', 'danger'].includes(level) ? c()[level] : c().unknownRule); $('cpRuleLevel').dataset.level = level ?? 'unknown';
  const geometry = trendGeometry(detail.history, frame.capturedAt), svg = $('cpTrend');
  svg.replaceChildren(); svg.setAttribute('aria-label', `${selected}, ${c().trend}, ${Number.isFinite(peak) ? peak.toFixed(1) : '—'}°C`);
  svg.dataset.samples = String(geometry.points.length); svg.dataset.segments = String(geometry.paths.length);
  const add = (tag, attributes, text) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; svg.append(node); };
  for (const threshold of [60, 80]) {
    const y = 8 + (geometry.max - threshold) / (geometry.max - geometry.min) * 76;
    add('line', { x1: 12, x2: 288, y1: y, y2: y, class: 'cp-trend-threshold' });
    add('text', { x: 288, y: y + 10, 'text-anchor': 'end', class: 'cp-trend-label' }, `${threshold}°`);
  }
  for (const d of geometry.paths) add('path', { d, class: 'cp-trend-line' });
  for (const point of geometry.points) add('circle', { cx: point.x, cy: point.y, r: 2, class: 'cp-trend-point' });
  add('text', { x: 12, y: 104, class: 'cp-trend-label' }, c().lastMinute);
  add('text', { x: 288, y: 104, 'text-anchor': 'end', class: 'cp-trend-label' }, c().now);
}
function renderAlerts() {
  const shown = displayAlerts(alerts, snapshot?.bays ?? [], connected);
  const signature = JSON.stringify([bridge.language, service, connected, shown.map(({ pendingSeconds, ...alert }) => alert)]);
  if (signature === alertSignature) return;
  alertSignature = signature; $('cpAlertList').replaceChildren();
  if (!alerts.length) {
    const empty = document.createElement('div'); empty.className = 'cp-alert-empty';
    const symbol = document.createElement('span'); symbol.className = 'cp-empty-check'; symbol.textContent = connected ? '✓' : '−'; symbol.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = connected ? c().noAlerts : service === 'static' ? c().serviceRequired : service === 'loading' ? c().loading : c().offline;
    const note = document.createElement('p'); note.textContent = connected ? c().noAlertsNote : c().missingNote;
    empty.append(symbol, title, note); $('cpAlertList').append(empty);
  }
  let group = '', groupHost;
  for (const alert of shown) {
    const nextGroup = alert.status === 'pending' ? 'pending' : 'processing';
    if (group !== nextGroup) {
      group = nextGroup; groupHost = document.createElement('div'); groupHost.className = 'cp-alert-group'; groupHost.dataset.group = group;
      const title = document.createElement('h3'); title.textContent = c()[group]; groupHost.append(title); $('cpAlertList').append(groupHost);
    }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'cp-alert-item'; button.dataset.level = alert.level; button.dataset.alertStatus = alert.status;
    const row = document.createElement('div'); row.className = 'cp-alert-row'; row.dataset.alertId = alert.id;
    const head = document.createElement('span'); head.className = 'cp-alert-item-head';
    const id = document.createElement('strong'); id.textContent = alert.bayId;
    const label = document.createElement('span'); label.textContent = `${icons[alert.level] ?? '!'} ${c()[alert.level] ?? c().warning}`;
    head.append(id, label);
    const note = document.createElement('small'); note.textContent = `${c()[alert.status] ?? c().pending}${!connected || alert.noData ? ` · ${c().no_data}` : alert.recovered ? ` · ${c().recovered}` : ''}`;
    const age = document.createElement('small'); age.className = 'cp-alert-pending-age'; age.hidden = true;
    button.append(head, note, age); button.addEventListener('click', () => { selectBay(alert.bayId); bayElements.get(alert.bayId)?.focus(); });
    row.append(button);
    if (alert.status === 'pending') {
      const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'cp-alert-mute cp-button';
      mute.addEventListener('click', () => {
        const current = reminderAlerts().find(item => item.id === alert.id);
        if (current?.status === 'pending') { mutedUntil.set(reminderCycleKey(current), Date.now() + 60000); updateReminders(); }
      });
      row.append(mute);
    }
    groupHost.append(row);
  }
}
function reminderAlerts() {
  return alerts.map(alert => {
    const bay = snapshot?.bays.find(item => item.alertId === alert.id);
    return bay ? { ...alert, status: bay.alertStatus, level: bay.status, pendingSince: bay.pendingSince, pendingSeconds: bay.pendingSeconds } : alert;
  });
}
function updateReminders() {
  const current = reminderAlerts(), at = Date.now(), zh = bridge.language === 'zh';
  const activeCycles = new Set(current.filter(alert => alert.status === 'pending').map(reminderCycleKey));
  for (const [key, until] of mutedUntil) if (!activeCycles.has(key) || until <= at) mutedUntil.delete(key);
  $('cpReminderEnable').hidden = reminderAudio.enabled;
  setText($('cpReminderEnable'), zh ? '點擊啟用提醒音' : 'Click to enable alert sounds');
  $('cpGlobalMute').setAttribute('aria-pressed', String(globalMuted));
  setText($('cpGlobalMute'), zh ? (globalMuted ? '提醒音：已靜音 · 取消靜音' : '提醒音：未靜音 · 全局靜音') : (globalMuted ? 'Sounds: muted · Unmute all' : 'Sounds: unmuted · Mute all'));
  setText($('cpReminderState'), reminderEnableFailed ? (zh ? '無法啟用提醒音；請重試，視覺提醒照常。' : 'Could not enable sounds; retry. Visual alerts remain active.') : !reminderAudio.enabled ? (zh ? '需先點擊啟用；視覺提醒照常。' : 'Enable sounds with a click. Visual alerts remain active.') : (zh ? '聲音與視覺提醒不依賴 AI。' : 'Sound and visual reminders work independently of AI.'));
  for (const [bayId, button] of bayElements) {
    const alert = current.find(item => item.bayId === bayId), policy = reminderPolicy(alert);
    button.dataset.overdue = String(policy.overdue);
    const age = button.querySelector('.cp-bay-pending-age'); age.hidden = !policy.overdue;
    setText(age, policy.overdue ? (zh ? `已 ${policy.seconds} 秒未處理` : `Unhandled for ${policy.seconds} s`) : '');
  }
  for (const row of $('cpAlertList').querySelectorAll('.cp-alert-row')) {
    const alert = current.find(item => item.id === row.dataset.alertId), policy = reminderPolicy(alert);
    row.dataset.overdue = String(policy.overdue);
    const age = row.querySelector('.cp-alert-pending-age'); age.hidden = !policy.overdue;
    setText(age, policy.overdue ? (zh ? `已 ${policy.seconds} 秒未處理` : `Unhandled for ${policy.seconds} s`) : '');
    const mute = row.querySelector('.cp-alert-mute');
    if (mute) {
      const remaining = Math.max(0, Math.ceil(((alert && mutedUntil.get(reminderCycleKey(alert))) ?? at) - at) / 1000);
      mute.disabled = !policy.pending || remaining > 0;
      setText(mute, remaining > 0 ? (zh ? `靜音餘 ${Math.ceil(remaining)} 秒` : `Muted: ${Math.ceil(remaining)} s left`) : (zh ? '此告警靜音 60 秒' : 'Mute this alert for 60 s'));
    }
  }
  reminderAudio.tick(current, { globalMuted, mutedUntil, now: at });
}
function render() {
  if (view.hidden) return;
  view.querySelectorAll('[data-cp]').forEach(element => setText(element, c()[element.dataset.cp]));
  $('cpAiToggle').disabled = !connected || busy || !snapshot?.session.aiConfigured;
  const aiNote = snapshot?.session.aiMode === 'test_stub' ? (bridge.language === 'zh' ? '測試替身 · 預設輸出 · 非真實模型；只影響下一場演示。' : 'TEST STUB · Preset output · Not a real model; applies to the next scenario.') : snapshot?.session.aiConfigured ? (bridge.language === 'zh' ? '只影響下一場演示；AI 不會自動處置告警。' : 'Applies to the next scenario; AI does not act on alerts automatically.') : c().aiNote;
  setText(view.querySelector('[data-cp="aiNote"]'), aiNote);
  const bays = currentBays(), counts = countBayStates(bays);
  $('cpConnection').dataset.connected = String(connected);
  setText($('cpConnection'), service === 'loading' ? c().loading : service === 'static' ? c().serviceRequired : connected ? c().live : c().offline);
  $('cpServiceNotice').hidden = service === 'loading' || connected;
  $('cpError').hidden = !error; setText($('cpError'), error === 'CSRF' ? c().csrfError : c().actionFailed);
  $('cpCounts').setAttribute('aria-label', c().counts); $('cpBayGrid').setAttribute('aria-label', c().floorLabel);
  const countSignature = JSON.stringify([bridge.language, counts]);
  if ($('cpCounts').dataset.signature !== countSignature) {
    $('cpCounts').dataset.signature = countSignature; $('cpCounts').replaceChildren();
    for (const status of ['normal', 'warning', 'danger', 'no_data']) {
      const item = document.createElement('div'); item.className = 'cp-count'; item.dataset.status = status;
      const count = document.createElement('strong'); count.textContent = String(counts[status]);
      const label = document.createElement('span'); label.textContent = c()[status]; item.append(count, label); $('cpCounts').append(item);
    }
  }
  for (const [index, config] of CARPARK_LAYOUT.bays.entries()) {
    const bay = bays[index], button = bayElements.get(config.id), label = bay.connecting ? c().connecting : c()[bay.status];
    button.dataset.status = bay.status; button.dataset.occupied = String(!bay.noData && Boolean(bay.occupied));
    button.dataset.frameSeq = String(bay.frameSeq ?? ''); button.dataset.noData = String(bay.noData);
    button.dataset.alertStatus = bay.alertStatus ?? '';
    button.setAttribute('aria-pressed', String(selected === config.id)); button.tabIndex = selected === config.id ? 0 : -1;
    setText(button.querySelector('.cp-state-icon'), icons[bay.status]); setText(button.querySelector('.cp-state-text'), label);
    setText(button.querySelector('.cp-bay-temperature'), bay.peakC === null ? '—' : `${bay.peakC.toFixed(1)}°`);
    setText(button.querySelector('.cp-bay-occupancy'), occupancy(bay));
    setText(button.querySelector('.cp-bay-missing'), bay.noData && ['warning', 'danger'].includes(bay.status) ? c().noDataBadge : bay.alertStatus === 'downgraded' ? c().downgraded : '');
    button.setAttribute('aria-label', `${config.id}, ${label}, ${bay.peakC === null ? c().noFrame : `${bay.peakC.toFixed(1)}°C`}, ${occupancy(bay)}${bay.noData ? `, ${c().no_data}` : ''}`);
  }
  const missingIds = CARPARK_LAYOUT.bays.filter((_, index) => bays[index].noData).map(bay => bay.id);
  $('cpNoDataBays').hidden = !missingIds.length; setText($('cpNoDataBays'), `${c().blindSpots}: ${missingIds.join(', ')}`);
  setText($('cpAlertCount'), String(alerts.length)); renderAlerts();
  updateReminders();
  const index = CARPARK_LAYOUT.bays.findIndex(bay => bay.id === selected), bay = bays[index], config = CARPARK_LAYOUT.bays[index];
  $('cpSelectedPanel').dataset.status = bay.status; $('cpSelectedPanel').setAttribute('aria-label', c().summaryLabel);
  setText($('cpSelectedId'), selected); setText($('cpSelectedType'), config.charging ? c().chargingBay : c().standardBay);
  setText($('cpSelectedStatus'), `${icons[bay.status]} ${bay.connecting ? c().connecting : c()[bay.status]}`);
  setText($('cpSelectedPeak'), bay.peakC === null ? '—' : bay.peakC.toFixed(1));
  setText($('cpSelectedCaption'), bay.peakC === null ? c().noFrame : bay.noData ? c().lastReading : c().latest);
  setText($('cpSelectedOccupancy'), occupancy(bay)); setText($('cpSelectedNote'), bay.noData ? c().missingNote : c().summaryNote);
  renderDetail(bay, config);
  const detail = detailLoader.state.detail;
  const matches = detail?.bay.id === selected && detail?.session.id === snapshot?.session.id;
  decisionPanel.render({ sessionId: snapshot?.session.id ?? '', bayId: selected, config, alert: alerts.find(item => item.id === bay.alertId) ?? null,
    decisions: matches ? detail.decisions : [], ai: matches ? detail.ai : null, aiRuns: matches ? detail.aiRuns : [], currentFrameSeq: bay.frameSeq, connected, busy, detailReady: Boolean(matches && detail.frame && !detailLoader.state.loading && !detailLoader.state.error) });
  for (const id of ['cpScenarioA', 'cpScenarioB', 'cpReset']) $(id).disabled = busy || !connected;
  $('cpScenarioA').setAttribute('aria-pressed', String(snapshot?.session.scenario === 'A'));
  $('cpScenarioB').setAttribute('aria-pressed', String(snapshot?.session.scenario === 'B'));
  setText($('cpScenario'), c()[snapshot?.session.scenario === 'A' ? 'runningA' : snapshot?.session.scenario === 'B' ? 'runningB' : 'baseline']);
  $('cpControlsTitle').parentElement.parentElement.setAttribute('aria-busy', String(busy));
  $('contextValue').textContent = c().context;
  const verified = document.querySelector('.verified'); verified.textContent = c().simulation; verified.classList.add('is-simulation');
}
function show() {
  if (view.hidden) decisionPanel.resetViewing();
  bridge.showCarpark(); view.hidden = false; tab.classList.add('active'); tab.setAttribute('aria-current', 'page');
  document.body.classList.add('carpark-active'); render();
  if (!started) { started = true; load(); } else syncDetail();
}
tab.addEventListener('click', show);
window.addEventListener('voltguard-view', event => {
  if (event.detail.view === 'carpark') return;
  view.hidden = true; tab.classList.remove('active'); tab.setAttribute('aria-current', 'false');
  vehicleModel?.dispose(); vehicleModel = null;
  detailLoader.close();
  decisionPanel.resetViewing();
  document.body.classList.remove('carpark-active'); document.querySelector('.verified').classList.remove('is-simulation');
});
window.addEventListener('voltguard-language', render);

async function request(route, input, signal) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(route, { cache: 'no-store', signal: signal ? AbortSignal.any([controller.signal, signal]) : controller.signal,
      ...(input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voltguard-Csrf': csrf }, body: JSON.stringify(input) }) });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); const failure = new Error(response.status === 403 ? 'CSRF' : payload.error ?? 'REQUEST'); failure.status = response.status; throw failure; }
    return await response.json();
  } finally { clearTimeout(timer); }
}
function applySnapshot(next) {
  if (retiredSessions.has(next.session.id)) return false;
  if (snapshot?.session.id !== next.session.id) $('cpAiToggle').checked = next.session.aiEnabled;
  if (snapshot && snapshot.session.id !== next.session.id) {
    retiredSessions.add(snapshot.session.id);
    if (retiredSessions.size > 32) retiredSessions.delete(retiredSessions.values().next().value);
    alerts = []; alertSignature = '';
  }
  snapshot = next; lastUpdateAt = Date.now(); connected = true; service = 'local'; render(); syncDetail(); return true;
}
async function refreshAlerts() {
  const id = ++alertsLoadId;
  try {
    const result = await request('/api/alerts');
    if (id !== alertsLoadId || snapshot?.session.id !== result.session.id) return;
    alerts = result.alerts; render();
  } catch { /* Keep known alerts when a read fails; no invented empty result. */ }
}
async function load() {
  const id = ++loadId; error = ''; service = snapshot ? 'local' : 'loading'; render();
  try {
    const [next, health] = await Promise.all([request('/api/carpark'), request('/api/health')]);
    if (stopped || id !== loadId) return;
    if (next.schemaVersion !== 'voltguard-carpark-state-1' || next.session?.sourceType !== 'simulation') throw Error('CARPARK_SCHEMA');
    csrf = health.csrf; applySnapshot(next); await refreshAlerts(); connect();
  } catch (failure) {
    if (stopped || id !== loadId) return;
    connected = false; service = failure.status === 404 ? 'static' : 'offline'; render();
  }
}
function connect() {
  if (stopped || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  clearTimeout(reconnectTimer);
  const channel = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); socket = channel;
  channel.addEventListener('message', event => {
    if (channel !== socket || stopped) return;
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'bays' && snapshot && message.report?.sourceType === 'simulation') {
      const changed = snapshot.session.id !== message.report.session.id;
      if (applySnapshot({ ...snapshot, session: message.report.session, bays: message.report.bays }) && changed) refreshAlerts();
    } else if (message.type === 'alert') {
      refreshAlerts();
      if (message.report?.alert?.sessionId === snapshot?.session.id && message.report.alert.bayId === selected) { detailRevision++; syncDetail(); }
    } else if (['decision', 'ai'].includes(message.type) && message.report?.sessionId === snapshot?.session.id && message.report.bayId === selected) { detailRevision++; syncDetail(); }
  });
  channel.addEventListener('error', () => channel.close());
  channel.addEventListener('close', () => {
    if (channel !== socket || stopped) return;
    socket = null; connected = false; service = 'offline'; render();
    reconnectTimer = setTimeout(load, 2000);
  });
}
async function control(name = null) {
  if (busy || !connected) return;
  busy = true; error = ''; render();
  try {
    const next = await request(name ? '/api/demo/scenario' : '/api/demo/reset', name ? { name, ai: $('cpAiToggle').checked } : {});
    applySnapshot(next); await refreshAlerts();
  } catch (failure) { error = failure.message; }
  finally { busy = false; render(); }
}
$('cpScenarioA').addEventListener('click', () => control('A')); $('cpScenarioB').addEventListener('click', () => control('B')); $('cpReset').addEventListener('click', () => control());
$('cpReconnect').addEventListener('click', load);
$('cpDetailRetry').addEventListener('click', () => detailLoader.retry());
const freshnessTimer = setInterval(() => {
  if (service === 'local' && connected && Date.now() - lastUpdateAt > 5000) { connected = false; service = 'offline'; render(); }
  else if (!view.hidden) render();
  else updateReminders();
}, 1000);
window.addEventListener('pagehide', () => { stopped = true; vehicleModel?.dispose(); reminderAudio.close(); detailLoader.close(); clearInterval(freshnessTimer); clearTimeout(reconnectTimer); socket?.close(); });
const requested = () => bridge.view === 'carpark';
window.addEventListener('voltguard-ready', () => { if (requested()) show(); });
window.addEventListener('voltguard-data-error', () => { if (requested()) show(); });
if (requested()) show(); else render();

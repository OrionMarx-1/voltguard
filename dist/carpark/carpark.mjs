import { CARPARK_LAYOUT } from './layout.mjs';
import { displayBay, countBayStates, bayInDirection, displayAlerts } from './state.mjs';

const bridge = window.voltguard, $ = id => document.getElementById(id);
const words = {
  zh: {
    tab: '車位監控', kicker: '控制室 · 停車場早期預警', title: '先看見異常，再決定下一步。',
    intro: 'B2 層 · 12 個車位 · 6 個充電位', simulation: '仿真演示', compressed: '演示時間已壓縮',
    limit: '合成溫度幀，非實測或物理模型結果；不進入實測記錄或匯出。',
    live: '本機服務已連線', loading: '正在連接本機服務', offline: '連線中斷 · 保留已知告警',
    serviceRequired: '需運行本地服務', serviceNote: '車位演示需要本機 VoltGuard 服務。NASA 實測頁面仍可使用。',
    retry: '重新連線', normal: '正常', warning: '警告', danger: '危險', no_data: '無資料', connecting: '正在接入',
    map: 'B2 車位平面圖', mapNote: '按狀態查看車位；顏色與文字同時標示', chargingRow: '充電車位', standardRow: '普通車位',
    aisle: '行車通道', charging: '充電中', charger: '充電位', parked: '有車 · 未充電', empty: '空位', unknown: '車輛狀態未知',
    latest: '最高溫', lastReading: '最後讀值', blindSpots: '無資料車位', alerts: '目前告警', alertsNote: '規則告警持續保留，直到處理或重置演示。',
    noAlerts: '目前沒有規則告警', noAlertsNote: '系統持續監測；無資料不代表正常。', pending: '待處理', recovered: '溫度已恢復正常',
    selected: '車位摘要', selectHint: '點選車位，或用方向鍵移動。', chargingBay: '充電車位', standardBay: '普通車位',
    noFrame: '尚無可用溫度幀', missingNote: '未收到新資料；不能據此判定正常。', summaryNote: '此頁顯示規則狀態與最高溫。',
    controls: '演示控制', controlsNote: '選擇場景會清空上一場演示告警。',
    sceneA: '場景 A', sceneADesc: '前輪餘熱', sceneB: '場景 B', sceneBDesc: '車底升溫', reset: '重置演示',
    ai: 'AI 說明', aiNote: 'AI 未配置，規則告警照常運行。', baseline: '正常背景', runningA: '場景 A · 前輪餘熱', runningB: '場景 B · 車底升溫',
    policy: '原型閾值', policyNote: '警告 ≥ 60°C 或 1°C/s · 危險 ≥ 80°C 或 2°C/s。尚未按車型校準。',
    actionFailed: '操作未完成，請重新連線後再試。', csrfError: '服務已重啟，請重新連線後再試。',
    floorLabel: 'B2 車位配置', summaryLabel: '車位規則狀態摘要', context: 'B2 停車場 · 仿真演示 · 非實測',
    counts: '車位狀態統計', selectBay: '查看車位', noDataBadge: '無資料'
  },
  en: {
    tab: 'Bay monitor', kicker: 'CONTROL ROOM · EARLY WARNING', title: 'Spot the change. Decide the next step.',
    intro: 'Level B2 · 12 bays · 6 charging bays', simulation: 'Simulation demo', compressed: 'Demo time is compressed',
    limit: 'Synthetic temperature frames, not measurements or a physical model. Excluded from measured records and exports.',
    live: 'Local service connected', loading: 'Connecting to local service', offline: 'Connection lost · Known alerts retained',
    serviceRequired: 'Run the local service', serviceNote: 'The bay demo needs the local VoltGuard service. NASA measured-data pages remain available.',
    retry: 'Reconnect', normal: 'Normal', warning: 'Warning', danger: 'Danger', no_data: 'No data', connecting: 'Connecting',
    map: 'B2 parking layout', mapNote: 'Inspect each bay; status uses both colour and text', chargingRow: 'CHARGING BAYS', standardRow: 'STANDARD BAYS',
    aisle: 'DRIVE AISLE', charging: 'Charging', charger: 'Charging bay', parked: 'Parked · Not charging', empty: 'Empty bay', unknown: 'Occupancy unknown',
    latest: 'Peak temperature', lastReading: 'Last reading', blindSpots: 'Bays without data', alerts: 'Current alerts', alertsNote: 'Rule alerts remain until handled or the demo is reset.',
    noAlerts: 'No current rule alerts', noAlertsNote: 'Monitoring continues. Missing data is not a normal result.', pending: 'Pending', recovered: 'Temperature returned to normal',
    selected: 'Bay summary', selectHint: 'Select a bay, or move with the arrow keys.', chargingBay: 'Charging bay', standardBay: 'Standard bay',
    noFrame: 'No temperature frame available', missingNote: 'No new data. A normal result cannot be established.', summaryNote: 'This view shows rule status and peak temperature.',
    controls: 'Demo controls', controlsNote: 'Starting a scenario clears the previous demo alerts.',
    sceneA: 'Scenario A', sceneADesc: 'Wheel residual heat', sceneB: 'Scenario B', sceneBDesc: 'Underbody heating', reset: 'Reset demo',
    ai: 'AI explanation', aiNote: 'AI is not configured. Rule alerts remain active.', baseline: 'Baseline', runningA: 'Scenario A · Wheel residual heat', runningB: 'Scenario B · Underbody heating',
    policy: 'Prototype thresholds', policyNote: 'Warning ≥ 60°C or 1°C/s · Danger ≥ 80°C or 2°C/s. Not vehicle-calibrated.',
    actionFailed: 'The action did not complete. Reconnect and try again.', csrfError: 'The service restarted. Reconnect and try again.',
    floorLabel: 'B2 bay configuration', summaryLabel: 'Bay rule-status summary', context: 'B2 carpark · Simulation demo · Not measured',
    counts: 'Bay status counts', selectBay: 'Inspect bay', noDataBadge: 'No data'
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
        <div class="cp-floor"><div class="cp-row-label" data-cp="chargingRow"></div><div id="cpBayGrid" class="cp-bay-grid"></div><div class="cp-row-label cp-bottom-label" data-cp="standardRow"></div></div>
        <div class="cp-map-foot"><span data-cp="selectHint"></span><span>32 × 24 · 1 Hz</span></div>
      </section>
      <section class="cp-controls" aria-labelledby="cpControlsTitle"><div class="cp-controls-heading"><div><h2 id="cpControlsTitle" data-cp="controls"></h2><p data-cp="controlsNote"></p></div><span id="cpScenario" class="cp-scenario-label"></span></div><div class="cp-control-actions"><button id="cpScenarioA" class="cp-scenario-button" type="button" aria-pressed="false"><span class="cp-scenario-letter">A</span><span><strong data-cp="sceneA"></strong><small data-cp="sceneADesc"></small></span></button><button id="cpScenarioB" class="cp-scenario-button" type="button" aria-pressed="false"><span class="cp-scenario-letter">B</span><span><strong data-cp="sceneB"></strong><small data-cp="sceneBDesc"></small></span></button><button id="cpReset" class="cp-button cp-reset" type="button"><span aria-hidden="true">↺</span><span data-cp="reset"></span></button></div><div class="cp-ai-control"><label><input id="cpAiToggle" type="checkbox" disabled><span data-cp="ai"></span></label><span data-cp="aiNote"></span></div></section>
    </div>
    <aside class="cp-sidebar">
      <section class="cp-alert-panel" aria-labelledby="cpAlertsTitle"><div class="cp-sidebar-heading"><h2 id="cpAlertsTitle" data-cp="alerts"></h2><span id="cpAlertCount" class="cp-counter">0</span></div><p id="cpNoDataBays" class="cp-no-data"></p><div id="cpAlertList" aria-live="polite" aria-atomic="true"></div><p class="cp-panel-note" data-cp="alertsNote"></p></section>
      <section id="cpSelectedPanel" class="cp-selected-panel" aria-labelledby="cpSelectedTitle"><div class="cp-sidebar-heading"><h2 id="cpSelectedTitle" data-cp="selected"></h2><span class="cp-selection-dot" aria-hidden="true"></span></div><div class="cp-selected-heading"><strong id="cpSelectedId"></strong><span id="cpSelectedType"></span></div><span id="cpSelectedStatus" class="cp-status-tag"></span><div class="cp-selected-temp"><span id="cpSelectedPeak">—</span><small>°C</small></div><p id="cpSelectedCaption"></p><p id="cpSelectedOccupancy"></p><p id="cpSelectedNote" class="cp-panel-note"></p></section>
      <section class="cp-policy"><h2 data-cp="policy"></h2><p data-cp="policyNote"></p></section>
    </aside>
  </div>`;
document.querySelector('.view-tabs').after(view);
const tab = document.createElement('button');
tab.id = 'carparkTab'; tab.type = 'button'; tab.className = 'view-tab'; tab.setAttribute('aria-controls', 'carparkView');
document.querySelector('.view-tabs').prepend(tab);

const vehicleSvg = '<svg viewBox="0 0 54 88" aria-hidden="true"><rect class="cp-car-body" x="9" y="4" width="36" height="80" rx="13"/><path class="cp-car-window" d="M16 23h22l3 17H13zM14 59h26l-3 14H17z"/><path class="cp-car-trim" d="M10 47h34M14 11h7m12 0h7M14 79h7m12 0h7"/><rect x="5" y="21" width="4" height="16" rx="2"/><rect x="45" y="21" width="4" height="16" rx="2"/><rect x="5" y="58" width="4" height="16" rx="2"/><rect x="45" y="58" width="4" height="16" rx="2"/></svg>';
const bayElements = new Map();
for (const bay of CARPARK_LAYOUT.bays) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'cp-bay'; button.dataset.bay = bay.id;
  button.style.gridColumn = String(bay.col + 1); button.style.gridRow = String(bay.row === 0 ? 1 : 3);
  button.innerHTML = `<span class="cp-bay-top"><strong>${bay.id}</strong><span class="cp-charger-icon" aria-hidden="true">${bay.charging ? 'ϟ' : ''}</span></span><span class="cp-bay-state"><span class="cp-state-icon" aria-hidden="true"></span><span class="cp-state-text"></span></span><span class="cp-bay-vehicle">${vehicleSvg}<span class="cp-empty-icon" aria-hidden="true">P</span></span><span class="cp-bay-temperature"></span><span class="cp-bay-occupancy"></span><span class="cp-bay-missing"></span>`;
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
const retiredSessions = new Set();
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
const currentBays = () => CARPARK_LAYOUT.bays.map(bay => displayBay(snapshot?.bays.find(item => item.id === bay.id), connected));
function occupancy(bay) { return !snapshot || bay.noData ? c().unknown : bay.isCharging ? c().charging : bay.occupied ? c().parked : c().empty; }
function selectBay(id) { selected = id; render(); }
function renderAlerts() {
  const shown = displayAlerts(alerts, snapshot?.bays ?? [], connected);
  const signature = JSON.stringify([bridge.language, service, connected, shown]);
  if (signature === alertSignature) return;
  alertSignature = signature; $('cpAlertList').replaceChildren();
  if (!alerts.length) {
    const empty = document.createElement('div'); empty.className = 'cp-alert-empty';
    const symbol = document.createElement('span'); symbol.className = 'cp-empty-check'; symbol.textContent = connected ? '✓' : '−'; symbol.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = connected ? c().noAlerts : service === 'static' ? c().serviceRequired : service === 'loading' ? c().loading : c().offline;
    const note = document.createElement('p'); note.textContent = connected ? c().noAlertsNote : c().missingNote;
    empty.append(symbol, title, note); $('cpAlertList').append(empty);
  }
  for (const alert of shown) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'cp-alert-item'; button.dataset.level = alert.level;
    const head = document.createElement('span'); head.className = 'cp-alert-item-head';
    const id = document.createElement('strong'); id.textContent = alert.bayId;
    const label = document.createElement('span'); label.textContent = `${icons[alert.level] ?? '!'} ${c()[alert.level] ?? c().warning}`;
    head.append(id, label);
    const note = document.createElement('small'); note.textContent = `${c().pending}${!connected || alert.noData ? ` · ${c().no_data}` : alert.recovered ? ` · ${c().recovered}` : ''}`;
    button.append(head, note); button.addEventListener('click', () => { selectBay(alert.bayId); bayElements.get(alert.bayId)?.focus(); });
    $('cpAlertList').append(button);
  }
}
function render() {
  tab.textContent = c().tab;
  if (view.hidden) return;
  view.querySelectorAll('[data-cp]').forEach(element => setText(element, c()[element.dataset.cp]));
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
    button.setAttribute('aria-pressed', String(selected === config.id)); button.tabIndex = selected === config.id ? 0 : -1;
    setText(button.querySelector('.cp-state-icon'), icons[bay.status]); setText(button.querySelector('.cp-state-text'), label);
    setText(button.querySelector('.cp-bay-temperature'), bay.peakC === null ? '—' : `${bay.peakC.toFixed(1)}°`);
    setText(button.querySelector('.cp-bay-occupancy'), occupancy(bay));
    setText(button.querySelector('.cp-bay-missing'), bay.noData && ['warning', 'danger'].includes(bay.status) ? c().noDataBadge : '');
    button.setAttribute('aria-label', `${config.id}, ${label}, ${bay.peakC === null ? c().noFrame : `${bay.peakC.toFixed(1)}°C`}, ${occupancy(bay)}${bay.noData ? `, ${c().no_data}` : ''}`);
  }
  const missingIds = CARPARK_LAYOUT.bays.filter((_, index) => bays[index].noData).map(bay => bay.id);
  $('cpNoDataBays').hidden = !missingIds.length; setText($('cpNoDataBays'), `${c().blindSpots}: ${missingIds.join(', ')}`);
  setText($('cpAlertCount'), String(alerts.length)); renderAlerts();
  const index = CARPARK_LAYOUT.bays.findIndex(bay => bay.id === selected), bay = bays[index], config = CARPARK_LAYOUT.bays[index];
  $('cpSelectedPanel').dataset.status = bay.status; $('cpSelectedPanel').setAttribute('aria-label', c().summaryLabel);
  setText($('cpSelectedId'), selected); setText($('cpSelectedType'), config.charging ? c().chargingBay : c().standardBay);
  setText($('cpSelectedStatus'), `${icons[bay.status]} ${bay.connecting ? c().connecting : c()[bay.status]}`);
  setText($('cpSelectedPeak'), bay.peakC === null ? '—' : bay.peakC.toFixed(1));
  setText($('cpSelectedCaption'), bay.peakC === null ? c().noFrame : bay.noData ? c().lastReading : c().latest);
  setText($('cpSelectedOccupancy'), occupancy(bay)); setText($('cpSelectedNote'), bay.noData ? c().missingNote : c().summaryNote);
  for (const id of ['cpScenarioA', 'cpScenarioB', 'cpReset']) $(id).disabled = busy || !connected;
  $('cpScenarioA').setAttribute('aria-pressed', String(snapshot?.session.scenario === 'A'));
  $('cpScenarioB').setAttribute('aria-pressed', String(snapshot?.session.scenario === 'B'));
  setText($('cpScenario'), c()[snapshot?.session.scenario === 'A' ? 'runningA' : snapshot?.session.scenario === 'B' ? 'runningB' : 'baseline']);
  $('cpControlsTitle').parentElement.parentElement.setAttribute('aria-busy', String(busy));
  $('contextValue').textContent = c().context;
  const verified = document.querySelector('.verified'); verified.textContent = c().simulation; verified.classList.add('is-simulation');
}
function show() {
  bridge.showCarpark(); view.hidden = false; tab.classList.add('active'); tab.setAttribute('aria-current', 'page');
  document.body.classList.add('carpark-active'); render();
  if (!started) { started = true; load(); }
}
tab.addEventListener('click', show);
window.addEventListener('voltguard-view', event => {
  if (event.detail.view === 'carpark') return;
  view.hidden = true; tab.classList.remove('active'); tab.setAttribute('aria-current', 'false');
  document.body.classList.remove('carpark-active'); document.querySelector('.verified').classList.remove('is-simulation');
});
window.addEventListener('voltguard-language', render);

async function request(route, input) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(route, { cache: 'no-store', signal: controller.signal,
      ...(input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voltguard-Csrf': csrf }, body: JSON.stringify(input) }) });
    if (!response.ok) { const failure = new Error(response.status === 403 ? 'CSRF' : 'REQUEST'); failure.status = response.status; throw failure; }
    return await response.json();
  } finally { clearTimeout(timer); }
}
function applySnapshot(next) {
  if (retiredSessions.has(next.session.id)) return false;
  if (snapshot && snapshot.session.id !== next.session.id) {
    retiredSessions.add(snapshot.session.id);
    if (retiredSessions.size > 32) retiredSessions.delete(retiredSessions.values().next().value);
    alerts = []; alertSignature = '';
  }
  snapshot = next; lastUpdateAt = Date.now(); connected = true; service = 'local'; render(); return true;
}
async function refreshAlerts() {
  try {
    const result = await request('/api/alerts');
    if (snapshot?.session.id !== result.session.id) return;
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
    } else if (message.type === 'alert') refreshAlerts();
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
const freshnessTimer = setInterval(() => {
  if (service === 'local' && connected && Date.now() - lastUpdateAt > 5000) { connected = false; service = 'offline'; render(); }
}, 1000);
window.addEventListener('pagehide', () => { stopped = true; clearInterval(freshnessTimer); clearTimeout(reconnectTimer); socket?.close(); });
const requested = () => new URLSearchParams(location.search).get('view') === 'carpark';
window.addEventListener('voltguard-ready', () => { if (requested()) show(); });
window.addEventListener('voltguard-data-error', () => { if (requested()) show(); });
if (requested()) show(); else render();

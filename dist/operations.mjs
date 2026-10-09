import {buildNasaReport,decodeMeasuredImport,NASA_CELLS} from './evidence.mjs';

const bridge = window.voltguard;
const copy = {
  en: {
    tab:'Operations', kicker:'Evidence → review → handover', title:'From measurements to action', intro:'Import measured telemetry, inspect the evidence and prepare a handover. Nothing here invents a sensor, a vehicle connection or a fire incident.',
    nasa:'Use NASA record', import:'Import measured JSON', json:'Export report JSON', print:'Print / save PDF', save:'Save to local log',
    hosted:'Public workspace · file processing stays in this browser session', local:'Local service · SQLite event log available', disconnected:'Local service disconnected · reconnecting; live status unavailable', clock:'Historical data ≠ live vehicles',
    measurements:'Measured sensor layout', gridNote:'Cells are supplied sensor positions, not an inferred pack layout. No spatial interpolation is applied.', oneSensor:'One measured point only. The NASA dataset cannot support a pack heatmap.', emptyTitle:'Start with a real measurement', empty:'Use a verified NASA cycle, or import your own measured JSON. No demonstration readings are generated.',
    source:'Source', time:'Measurement time', sensors:'Measured sensors', peak:'Peak temperature', rate:'Rise rate', thermal:'Thermal rule result', maintenance:'Capacity review', rateMissing:'Insufficient consecutive data', normal:'No threshold crossed', warning:'WARNING', danger:'DANGER', unknown:'Insufficient evidence', review:'Maintenance review', watch:'Trend watch', historical:'Historical', current:'Current', stale:'Stale — not current', partial:'Missing sensors', future:'Future timestamp',
    prototype:'Prototype rules only: 60/80°C and 1/2°C/s. Not calibrated for a vehicle model, certified, or a prediction that a fire will occur.', provenanceNasa:'Bundled NASA record · source verified', provenanceUser:'User-supplied measurements · provenance not independently verified',
    response:'Frontline handover', responseSub:'Factual checklist; not AI-generated firefighting advice', speak:'Read checklist aloud', stop:'Stop speech', noSpeech:'Speech is unavailable in this browser.',
    steps:['Check measurement time, source, missing sensors and data quality. An offline or stale channel is not evidence of safety.', 'Separate capacity maintenance from thermal warnings. Escalate measured warning/danger to the responsible operator using the site emergency plan.', 'If there is an actual fire, call 999 from a safe location. State the location, incident type and situation; follow the dispatcher’s questions.', 'Do not let this prototype operate vehicle power, charging or fire equipment. Only authorized, trained personnel may follow the applicable procedures.'],
    fsd:'FSD emergency-call guidance', circular:'FSD Circular 3/2025',
    events:'Event log', eventsSub:'Explicitly saved records and gateway alerts; never fabricated incidents', emptyEvents:'No saved review events.', cloudLimit:'This public site has no connected durable event service. Export a report, or run the included local service for SQLite storage. This is not a cloud audit log.',
    thermalEvent:'Thermal threshold review', maintenanceEvent:'Capacity maintenance review', open:'Open', acknowledged:'Acknowledged', closed:'Closed', acknowledge:'Acknowledge', close:'Close review', view:'Open report',
    liveTitle:'Authorized gateway channels', liveEmpty:'No live telemetry received. The NASA records are historical and do not populate this list.', liveToken:'Live ingestion is disabled until a gateway token is configured locally.',
    importHelp:'Measured-data contract', importNote:'JSON object, or {"records": [...]}. Historical import only; maximum 1 MB / 1,000 records. Use hardware aliases, never VINs, plates, driver names or contact details. Consecutive records must have the same asset/source/layout and increasing timestamps; gaps over 30 seconds cannot establish a rise rate.',
    schema:'assetId: hardware alias; mode: "historical"; source: measurement source; timestamp: ISO 8601 with timezone; temperaturesC: rectangular numeric matrix, null for missing sensors. Optional: voltageV, currentA, socPercent, capacityAh + initialCapacityAh. See API guide for live gateway ingestion.',
    privacy:'Privacy boundary', privacyText:'Only whitelisted telemetry fields are processed. The local log hashes hardware aliases. Imported source labels and aliases still must not contain personal information; no legal-compliance certification is claimed.',
    aiTitle:'GenAI diagnostic layer', aiText:'Not connected. No AI key or validated diagnostic pipeline is configured. Deterministic measurements and linked official guidance remain available. This interface does not disguise a rule-based report as AI output.',
    loaded:n=>`${n} measured record(s) validated. Displaying the latest.`, saved:'Saved in the local SQLite log.', duplicate:'This record is already in the local log.', fileLarge:'File exceeds the 1 MB limit.', badFile:'Invalid or unsupported measurement file.', historicalOnly:'File imports must be explicitly marked historical.', mixed:'Records must use one asset, source and consistent sensor layout.', unavailable:'The local event service is unavailable.', apiError:'The operation was rejected',
    errors:{OBJECT_REQUIRED:'A telemetry object is required.',ASSET_ID:'Use a hardware alias of 1–48 letters, digits, underscores or hyphens.',MODE:'Mode must be historical or live.',SOURCE:'Provide a short measurement-source label without personal details.',TIMESTAMP:'Timestamp must include seconds and a timezone.',MATRIX:'Provide a rectangular matrix of 1–64 rows and columns.',TEMPERATURE:'Temperature values must be finite numbers (−60…1000°C), or null.',NO_MEASUREMENTS:'No measured sensors are present.',CAPACITY_BASELINE:'Capacity requires a positive initial-capacity baseline.',OUT_OF_ORDER:'Timestamps must be strictly increasing.',HISTORICAL_REQUIRED:'Only historical records may be saved from the browser.',ACKNOWLEDGE_FIRST:'Acknowledge the review before closing it.',UNRESOLVED_THERMAL:'Cannot close an active, stale or insufficiently resolved live thermal alert.',EVENT_CLOSED:'This event is already closed.',CSRF:'Service restarted. Refresh this page before saving.'},
    reportTitle:'VoltGuard measurement handover', created:'Report generated', status:'Assessment', limits:'Limits and interpretation', evidence:'Sanitized telemetry evidence', noAI:'No AI diagnosis. Rule-based prototype assessment only.', safeHint:'A normal rule result is not a guarantee against battery fire.', checklist:'Operator checklist', cycle:'NASA discharge cycle', timezone:'NASA lab timestamp; timezone not specified by source', imported:'Imported measurements', sample:'Selected measurement point',
  },
  zh: {
    tab:'現場工作台', kicker:'量測 → 檢視 → 交接', title:'讓量測成為可交接的記錄', intro:'匯入真實遙測、檢查證據並準備交接。系統不會生成虛構測點、實車連線或火災事件。',
    nasa:'使用 NASA 記錄', import:'匯入實測 JSON', json:'匯出報告 JSON', print:'列印／儲存 PDF', save:'存入本地事件庫',
    hosted:'公開工作台 · 檔案只在目前瀏覽器工作階段處理', local:'本地服務 · SQLite 事件庫可用', disconnected:'本地服務斷線 · 重連中；即時狀態不可用', clock:'歷史記錄 ≠ 即時車輛',
    measurements:'實測測點分布', gridNote:'格子對應資料提供的測點位置，不推測電池包布局，也不使用空間插值。', oneSensor:'只有一個真實測點；NASA 資料不能支援電池包熱力圖。', emptyTitle:'從一筆真實量測開始', empty:'選擇已核驗 NASA 循環，或匯入自行採集的實測 JSON。不會生成展示數值。',
    source:'資料來源', time:'量測時間', sensors:'有效測點', peak:'最高溫', rate:'升溫率', thermal:'熱狀態規則結果', maintenance:'容量評估', rateMissing:'缺少連續量測', normal:'未跨過原型閾值', warning:'警告', danger:'危險', unknown:'證據不足', review:'需維護評估', watch:'趨勢觀察', historical:'歷史資料', current:'目前量測', stale:'資料過期 · 非目前狀態', partial:'存在缺失測點', future:'時間戳超前',
    prototype:'僅為原型規則：60／80°C 及 1／2°C/s。未經車型校準或認證，也不代表預測會發生火災。', provenanceNasa:'隨附 NASA 原始記錄 · 來源已核驗', provenanceUser:'使用者提供的量測 · 尚未獨立核驗來源',
    response:'前線交接', responseSub:'事實核查清單；不是 AI 消防指令', speak:'朗讀交接清單', stop:'停止朗讀', noSpeech:'此瀏覽器不支援語音朗讀。',
    steps:['檢查量測時間、來源、缺失測點及資料品質。斷線或過期資料不能證明安全。', '將容量維護與熱警告分開處理。量測觸發警告／危險時，按場所應急計劃向負責人升級通報。', '若現場確有火警，在安全位置致電 999，說明地點、事故類別和現場情況，並回答接報人員的問題。', '本原型不可控制車輛電源、充電設備或消防器材。只有獲授權且受訓人員才能依適用程序操作。'],
    fsd:'消防處報警指引', circular:'消防處通函 3/2025',
    events:'事件記錄', eventsSub:'明確儲存的評估及閘道警告；不生成虛構事故', emptyEvents:'尚無已儲存的評估事件。', cloudLimit:'公開網站未連接持久事件服務。可匯出報告，或執行隨附本地服務使用 SQLite 儲存；這裡不是雲端審計記錄。',
    thermalEvent:'熱狀態閾值評估', maintenanceEvent:'容量維護評估', open:'待處理', acknowledged:'已確認', closed:'已結束', acknowledge:'確認接收', close:'結束評估', view:'開啟報告',
    liveTitle:'獲授權閘道通道', liveEmpty:'尚未收到即時遙測。歷史 NASA 記錄不會出現在此清單。', liveToken:'本地配置閘道憑證後，才會開放即時資料寫入。',
    importHelp:'實測資料格式', importNote:'JSON 物件或 {"records": [...]}，僅匯入歷史實測資料；最多 1 MB／1,000 筆。只用硬體別名，不使用 VIN、車牌、姓名或聯絡資料。連續記錄須同一設備、來源及測點布局，时间嚴格遞增；間隔超過 30 秒時不判定升溫率。',
    schema:'assetId：硬體別名；mode："historical"；source：量測來源；timestamp：含時區的 ISO 8601 時間；temperaturesC：矩形數值矩陣，以 null 表示缺失測點。可選 voltageV、currentA、socPercent、capacityAh＋initialCapacityAh。即時閘道格式請參閱 API 指引。',
    privacy:'私隱邊界', privacyText:'只處理白名單遙測欄位，本地儲存會雜湊硬體別名。匯入的來源標籤和別名仍不得含個人資料；不宣稱已取得法規合規認證。',
    aiTitle:'GenAI 診斷層', aiText:'尚未連接：目前未配置 AI 密鑰或已驗證的診斷流程。確定性量測判讀及官方指引可用，不會將規則報告偽裝成 AI 輸出。',
    loaded:n=>`已核查 ${n} 筆量測，現在顯示最後一筆。`, saved:'已儲存至本地 SQLite 記錄庫。', duplicate:'本地記錄庫已有此記錄。', fileLarge:'檔案超過 1 MB 上限。', badFile:'量測檔案無效或格式不支援。', historicalOnly:'匯入檔案須明確標為 historical。', mixed:'記錄須來自同一設備、來源及一致測點布局。', unavailable:'本地事件服務不可用。', apiError:'操作未獲接受',
    errors:{OBJECT_REQUIRED:'需要遙測物件。',ASSET_ID:'硬體別名限 1–48 個英文字母、數字、底線或連字號。',MODE:'模式須為 historical 或 live。',SOURCE:'提供簡短量測來源標籤，不含個人資料。',TIMESTAMP:'時間須包含秒數及時區。',MATRIX:'提供 1–64 行及列的矩形矩陣。',TEMPERATURE:'溫度須為有限數值（−60…1000°C）或 null。',NO_MEASUREMENTS:'沒有有效量測測點。',CAPACITY_BASELINE:'容量評估須提供正值初始容量基線。',OUT_OF_ORDER:'時間戳须嚴格遞增。',HISTORICAL_REQUIRED:'瀏覽器只能儲存歷史記錄。',ACKNOWLEDGE_FIRST:'先確認接收，再結束評估。',UNRESOLVED_THERMAL:'即時熱警告仍存在、資料過期或證據不足，不能結束。',EVENT_CLOSED:'此事件已結束。',CSRF:'服務已重新啟動；請重新整理後再儲存。'},
    reportTitle:'VoltGuard 量測交接報告', created:'報告產生時間', status:'判讀', limits:'邊界與解讀', evidence:'白名單遙測證據', noAI:'沒有 AI 診斷，只有原型規則判讀。', safeHint:'規則結果正常並不能保證不會發生電池火災。', checklist:'操作員清單', cycle:'NASA 放電循環', timezone:'NASA 實驗室時間；來源未註明時區', imported:'匯入量測', sample:'所選量測點',
  },
};
copy.en.fullCycle='Peak temperature and rise rate summarize the whole discharge cycle; the tile shows the selected sample only.';
copy.zh.fullCycle='最高溫及升溫率統計整次放電；方格只顯示所選時間點的量測。';
copy.en.singleUser='One measured point only; no pack-level spatial heatmap is inferred.';copy.zh.singleUser='只有一個有效位置；不推測整個電池包的空間熱分布。';
Object.assign(copy.en,{driving:'Driving',parked:'Parked',charging:'Charging',live:'Live gateway',workspace:'Measurement workspace',unverified:'Source not verified'});
Object.assign(copy.zh,{driving:'行駛中',parked:'停泊',charging:'充電',live:'即時閘道',workspace:'量測工作台',unverified:'來源未核驗'});
copy.en.viewHeatmap='Open thermal map';copy.zh.viewHeatmap='查看溫度圖';
Object.assign(copy.en,{kicker:'VOLTGUARD / OPERATIONS',title:'Review & handover',intro:'Select a measured record, review its condition, and hand over the evidence.',library:'Measured records',libraryNote:'Four independent NASA cells · historical',latest:'Latest cycle',loadSelected:'Load selected NASA record',thermalCount:'Historical thermal alerts',maintenanceCount:'Capacity reviews',liveCount:'Gateway channels',summaryScope:'Latest bundled cycles · not live fire incidents',servicePending:'Checking local service…',sourceStep:'01 · Record',reviewStep:'02 · Evidence',handoverStep:'03 · Handover',ready:'Available',choose:'Select a record',currentReview:'Current review',selectedTemp:'Selected-point temperature',capacity:'Capacity health',inspect:'Inspect in 3D',sensorDetail:'Sensor values & source details',nextAction:'Next action',actionReview:'Prepare a capacity-maintenance handover',actionReviewText:'This record crosses a capacity-review rule, not a thermal-alert rule. Keep the original measurements and arrange review by the responsible technician.',actionThermal:'Escalate the measured thermal condition',actionThermalText:'Notify the responsible operator using the approved site emergency plan. This software does not control vehicle or fire equipment.',actionUnknown:'Check the missing evidence first',actionUnknownText:'Check source, time and sensor coverage before relying on this record. Insufficient data is not a normal result.',actionNormal:'Keep the record for follow-up',actionNormalText:'No prototype threshold was crossed. Retain the source and measurements; this result does not guarantee battery safety.',handoverTools:'Handover tools',saveHint:'Save an auditable review locally; export a copy for handover.',exportHint:'Public mode: download a report. A durable event service is not connected.',savedRecord:'Previously saved review',gatewayNote:'Only actual authorized gateway records appear here.',emptyLive:'No connected vehicle',technical:'Data format, privacy & diagnostic limits',emptyEventsTitle:'No reviews saved yet',emptyEventsText:'Save the selected record to begin a local review. A record is not an incident merely because it has been saved.',logCount:'Saved reviews',logUnavailable:'Event storage not connected',currentRecord:'Current record',loading:'Loading the measured record…',loadFailed:'Record could not be loaded. The previous valid review is retained.',historicalScope:'Historical cycle assessment · not the present state of a vehicle'});
Object.assign(copy.zh,{kicker:'VOLTGUARD / OPERATIONS',title:'現場工作台',intro:'選擇實測記錄，檢視狀態，再將證據交接給負責人。',library:'實測記錄',libraryNote:'四枚獨立 NASA 電芯 · 歷史資料',latest:'最新循環',loadSelected:'載入所選 NASA 記錄',thermalCount:'歷史熱異常',maintenanceCount:'容量維護評估',liveCount:'閘道通道',summaryScope:'最新隨附循環 · 不是即時火警事件',servicePending:'正在檢查本地服務…',sourceStep:'01 · 選擇記錄',reviewStep:'02 · 檢視證據',handoverStep:'03 · 準備交接',ready:'可用',choose:'請選擇記錄',currentReview:'目前檢視',selectedTemp:'所選測點溫度',capacity:'容量健康度',inspect:'在 3D 模型中查看',sensorDetail:'測點數值與來源詳情',nextAction:'下一步處理',actionReview:'準備容量維護交接',actionReviewText:'此記錄跨過容量維護規則，不是熱警告。保留原始量測，安排負責技術人員評估。',actionThermal:'通報實測熱狀態異常',actionThermalText:'按已核准的場所應急計劃通知負責人。本系統不控制車輛電源或消防器材。',actionUnknown:'先核查缺失的證據',actionUnknownText:'核對來源、時間與測點覆蓋率，再決定是否可採信此記錄。資料不足不等於正常。',actionNormal:'保留記錄供後續追蹤',actionNormalText:'未跨過原型閾值。仍須保留來源及量測；此結果不保證電池安全。',handoverTools:'交接工具',saveHint:'存入本地記錄庫以保留評估；另可匯出副本交接。',exportHint:'公開模式：請下載交接報告。目前未連接持久事件服務。',savedRecord:'已儲存的評估',gatewayNote:'這裡只顯示獲授權閘道收到的真實記錄。',emptyLive:'尚無已連接車輛',technical:'資料格式、私隱與診斷邊界',emptyEventsTitle:'尚未儲存評估',emptyEventsText:'將目前記錄存入本地事件庫即可開始評估。儲存記錄並不代表發生事故。',logCount:'已儲存評估',logUnavailable:'事件儲存未連接',currentRecord:'目前記錄',loading:'正在載入實測記錄…',loadFailed:'記錄未能載入，已保留上一筆有效評估。',historicalScope:'歷史循環判讀 · 不代表實車目前狀態'});
let report = null, persistedReport=false, backend = null, events = [], live = [], socket = null, serviceAvailable = false, message = '', messageError = false;
let selectedLibrary='B0005',recordRequest=0,recordLoading=false,serviceChecked=false,saving=false;
let historyData=null,historyLoading=false,historyError=false,historyRequest=0,historyEventId=null;
copy.en.historyTruncated='Showing the latest 200 actions; earlier actions are omitted from this view and export.';copy.zh.historyTruncated='只顯示最近 200 次操作；較早操作未包含在此視圖及匯出檔案中。';
copy.en.historyTimezone='Processing times: UTC+8. Exports retain the original UTC timestamps.';copy.zh.historyTimezone='處理時間：UTC+8；匯出檔案保留原始 UTC 時間戳。';
Object.assign(copy.en,{history:'Processing history',historyTitle:'Review timeline',historyCreated:'Review created',historyMeasurement:'Supporting measurement updated',historyAcknowledged:'Receipt acknowledged',historyClosed:'Review closed',historyLoading:'Loading the saved history…',historyFailed:'Unable to load the processing history. Retry when the local service is available.',historyLimit:'Local development log, not tamper-proof. Operator identities are not authenticated. Imported history is never added to this log.',historyOld:'This older event has no recorded creation action; the stored event creation time is shown separately.',historyExport:'Export processing history',dismiss:'Close panel',retry:'Retry',reportRestored:'Report reloaded; assessment rebuilt from measured evidence.',duplicate:'This cycle was already saved. The originally stored measurement is now loaded; export a new sample separately.',import:'Import data / report JSON'});
copy.en.aiText='The optional local evidence assistant uses GPT-4o only after a server-side key and explicit consent. Key detection alone does not verify provider access. Public mode has no AI service. AI cannot change the rule result or confirm battery safety.';
copy.zh.aiText='可選的本地證據助理須配置伺服器密鑰並取得明確同意，才可使用 GPT-4o；偵測到密鑰不代表已驗證供應商連線。公開模式沒有 AI 服務。AI 不能改寫規則判定或確認電池安全。';
Object.assign(copy.zh,{history:'處理記錄',historyTitle:'評估處理時間線',historyCreated:'建立評估',historyMeasurement:'更新支持量測',historyAcknowledged:'確認接收',historyClosed:'結束評估',historyLoading:'正在讀取已儲存的處理記錄…',historyFailed:'未能讀取處理記錄；本地服務可用時請重試。',historyLimit:'本地開發記錄，不是防竄改審計服務；未驗證操作人身分。匯入檔案中的歷史不會寫入此記錄庫。',historyOld:'這筆舊事件沒有建立操作記錄；另外顯示資料庫保存的事件建立時間。',historyExport:'匯出處理記錄',dismiss:'關閉面板',retry:'重試',reportRestored:'已重載報告，並按量測證據重新計算判讀。',duplicate:'此循環已儲存，已載入原先保存的測點；新的測點可另外匯出。',import:'匯入資料／報告 JSON'});
Object.assign(copy.en.errors,{NASA_REFERENCE:'NASA report lacks a valid source index. Re-export from a bundled record.',NASA_SAMPLE:'The selected NASA sample does not exist.',REPORT_SCHEMA:'Unsupported report format.',REPORT_MISMATCH:'Report measurements do not match the referenced bundled NASA sample.',RECORD_COUNT:'Provide 1–1,000 measured records.',PREVIOUS_CHANNEL:'Measurements must use the same alias, source and sensor layout.',EVENT_ACKNOWLEDGED:'Receipt has already been acknowledged.'});
Object.assign(copy.zh.errors,{NASA_REFERENCE:'NASA 報告缺少有效來源索引；請從隨附記錄重新匯出。',NASA_SAMPLE:'所選 NASA 測點不存在。',REPORT_SCHEMA:'不支援此報告格式。',REPORT_MISMATCH:'報告量測與所引用的 NASA 原始測點不符。',RECORD_COUNT:'請提供 1–1,000 筆實測記錄。',PREVIOUS_CHANNEL:'量測須來自同一別名、來源及測點布局。',EVENT_ACKNOWLEDGED:'已確認接收此評估。'});
const el = id => document.getElementById(id), c = () => copy[bridge.language];
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const section = document.createElement('section'); section.id = 'operationsView'; section.hidden = true;
section.innerHTML = `<div class="operations-intro"><div><div class="kicker" data-ops="kicker"></div><h1 data-ops="title"></h1><p data-ops="intro"></p></div><label class="import-button"><span data-ops="import"></span><input id="opsFile" class="ops-upload" type="file" accept=".json,application/json"></label></div>
  <div id="opsService" class="ops-status"><i class="ops-status-dot"></i><span id="opsServiceText"></span><span data-ops="clock"></span></div>
  <div class="ops-overview" id="opsOverview"></div>
  <nav class="ops-progress" aria-label="Review workflow"><div id="opsStepRecord"><span data-ops="sourceStep"></span><small id="opsRecordState"></small></div><div id="opsStepEvidence"><span data-ops="reviewStep"></span><small id="opsEvidenceState"></small></div><div id="opsStepHandover"><span data-ops="handoverStep"></span><small id="opsHandoverState"></small></div></nav>
  <p id="opsMessage" role="status" aria-live="polite" hidden></p>
  <div class="ops-layout"><aside class="ops-stack ops-records"><section class="sheet"><div class="sheet-head"><div><h2 class="sheet-title" data-ops="library"></h2><p class="sheet-sub" data-ops="libraryNote"></p></div></div><div id="opsLibrary" class="ops-library"></div><div class="ops-library-footer"><button id="opsNasa" class="ops-button" data-ops="loadSelected"></button></div></section><section class="sheet"><div class="sheet-head"><div><h2 class="sheet-title" data-ops="liveTitle"></h2></div></div><div class="ops-body"><div id="opsLive" class="live-channels"></div></div></section></aside>
  <section class="sheet ops-review"><div class="sheet-head"><div><h2 class="sheet-title" data-ops="currentReview"></h2><p class="sheet-sub" id="opsProvenance"></p></div><span id="opsCurrentBadge" class="ops-tag"></span></div><div id="opsMeasurements"></div><div class="ops-review-footer"><button id="opsInspect" class="ops-button" data-ops="inspect" disabled></button><span data-ops="historicalScope" id="opsScope"></span></div></section>
  <aside class="ops-stack ops-handover"><section class="sheet ops-next"><div class="ops-body"><div class="section-index" data-ops="nextAction"></div><h2 id="opsNextTitle"></h2><p id="opsNextText"></p></div><div class="ops-export"><h3 data-ops="handoverTools"></h3><button id="opsPrint" class="ops-button primary" data-ops="print" disabled></button><button id="opsJson" class="ops-button" data-ops="json" disabled></button><button id="opsSave" class="ops-button" data-ops="save" disabled></button><p id="opsSaveHint"></p></div></section>
  <details class="sheet ops-guidance"><summary><span data-ops="response"></span><small data-ops="responseSub"></small></summary><div class="ops-body"><ol class="ops-actions" id="opsChecklist"></ol><div class="ops-toolbar"><button class="ops-button" id="opsSpeak" data-ops="speak"></button><button class="ops-button" id="opsStop" data-ops="stop"></button></div><div class="ops-links"><a id="opsFsdLink" target="_blank" rel="noreferrer" data-ops="fsd"></a><a href="https://www.hkfsd.gov.hk/eng/source/circular/2025_03_eng_20250905_192346.pdf" target="_blank" rel="noreferrer" data-ops="circular"></a></div></div></details></aside></div>
  <section class="sheet ops-events"><div class="sheet-head"><div><h2 class="sheet-title" data-ops="events"></h2><p class="sheet-sub" data-ops="eventsSub"></p></div><span id="opsLogCount" class="ops-tag"></span></div><div id="opsEvents"></div></section>
  <details class="sheet ops-technical"><summary data-ops="technical"></summary><div class="ops-technical-grid"><section><h2 data-ops="importHelp"></h2><p data-ops="importNote"></p><p data-ops="schema"></p></section><section><h2 data-ops="privacy"></h2><p data-ops="privacyText"></p><h2 data-ops="aiTitle"></h2><p data-ops="aiText"></p></section></div></details>`;
document.querySelector('main.page').append(section);
section.insertAdjacentHTML('beforeend','<dialog id="opsHistoryDialog" class="ops-history-dialog" aria-labelledby="opsHistoryTitle"><div class="ops-history-head"><div><div class="kicker" id="opsHistoryKicker"></div><h2 id="opsHistoryTitle"></h2></div><button id="opsHistoryClose" class="ops-button"></button></div><div id="opsHistoryBody"></div><div class="ops-history-footer"><button id="opsHistoryRetry" class="ops-button"></button><button id="opsHistoryExport" class="ops-button primary"></button></div></dialog>');
const tab = document.createElement('button'); tab.id = 'operationsTab'; tab.type = 'button'; tab.className = 'view-tab'; document.querySelector('.view-tabs').append(tab);
function show() { bridge.showOperations(); section.hidden = false; tab.classList.add('active'); tab.setAttribute('aria-current','page'); render(); if(!report&&!recordLoading&&!messageError&&bridge.fleet)useNasa(); }
tab.addEventListener('click', show);
window.addEventListener('voltguard-view',event=>{if(event.detail.view!=='operations'){section.hidden=true;tab.classList.remove('active');tab.setAttribute('aria-current','false');}});
for (const id of ['fleetTab','detailTab']) el(id).addEventListener('click', () => { section.hidden = true; tab.classList.remove('active'); tab.setAttribute('aria-current','false'); });
function displayMessage(text, isError = false) { message = text; messageError = isError; el('opsMessage').textContent = text; el('opsMessage').hidden=!text; el('opsMessage').className = isError ? 'ops-error' : 'ops-note'; }
function errorText(error) { return c().errors[error.message] || `${c().apiError}: ${/^[A-Z_]+$/.test(error.message) ? error.message : c().badFile}`; }
function render() {
  tab.textContent = c().tab;
  if(!section.hidden){document.querySelector('.verified').textContent=report?report.provenance==='bundled_nasa_record'?c().provenanceNasa:c().unverified:c().workspace;bridge.showOperations();}
  section.querySelectorAll('[data-ops]').forEach(node => { node.textContent = c()[node.dataset.ops]; });
  el('opsServiceText').textContent = !serviceChecked ? c().servicePending : backend ? serviceAvailable ? c().local : c().disconnected : c().hosted;
  el('opsService').dataset.connected = String(Boolean(backend && serviceAvailable));
  el('opsFsdLink').href = `https://www.hkfsd.gov.hk/${bridge.language === 'zh' ? 'chi' : 'eng'}/fire_ambulance_services/fire_information.html`;
  el('opsChecklist').innerHTML = c().steps.map(text => `<li>${escape(text)}</li>`).join('');
  el('opsJson').disabled = el('opsPrint').disabled = !report;
  el('opsInspect').disabled=!report||recordLoading||(report.provenance==='bundled_nasa_record'&&!NASA_CELLS.includes(nasaCell()));el('opsNasa').disabled=recordLoading;
  el('opsInspect').title=report?.provenance==='bundled_nasa_record'&&!NASA_CELLS.includes(nasaCell())?c().errors.NASA_REFERENCE:'';
  el('opsSave').disabled = !report || recordLoading || saving || persistedReport || !backend || !serviceAvailable || report.record.mode !== 'historical';
  section.querySelector('.ops-review').setAttribute('aria-busy',String(recordLoading));
  el('opsSpeak').disabled = !('speechSynthesis' in window);
  el('opsStop').disabled = !('speechSynthesis' in window);
  el('opsMessage').textContent = message;el('opsMessage').hidden=!message; el('opsMessage').className = messageError ? 'ops-error' : 'ops-note';
  renderWorkspace();renderMeasurement(); renderEvents(); renderLive();renderHistory();
  window.dispatchEvent(new Event('voltguard-review-context'));
}
export function getOperationsContext(){return {report:report?structuredClone(report):null,loading:recordLoading,backendAvailable:Boolean(backend&&serviceAvailable),aiConfigured:Boolean(backend?.aiConfigured),csrf:backend?.csrf};}
const nasaCell=()=>report?.sourceRef?.cell||report?.record.assetId;
function renderWorkspace(){
 const cells=bridge.fleet?.cells||[],thermal=cells.filter(r=>['warning','danger'].includes(r.thermalStatus)).length,maintenance=cells.filter(r=>r.maintenanceStatus==='review').length;
 const metrics=[[c().thermalCount,bridge.fleet?thermal:'—',c().summaryScope,'thermal'],[c().maintenanceCount,bridge.fleet?maintenance:'—',c().summaryScope,'maintenance'],[c().liveCount,serviceAvailable?live.length:'—',serviceAvailable?c().gatewayNote:c().emptyLive,'gateway']];
 el('opsOverview').innerHTML=metrics.map(([label,value,note,type])=>`<div class="ops-metric ${type}"><span>${escape(label)}</span><strong>${value}</strong><small>${escape(note)}</small></div>`).join('');
 el('opsLibrary').innerHTML=cells.map(item=>`<button class="ops-record" type="button" data-ops-cell="${item.id}" aria-pressed="${report?.provenance==='bundled_nasa_record'&&report.record.assetId===item.id}" ${recordLoading?'disabled':''}><span class="ops-record-top"><strong>${item.id}</strong><span class="ops-tag" data-state="${item.maintenanceStatus}">${escape(c()[item.maintenanceStatus])}</span></span><span class="ops-record-values"><span>${item.latestPeakTempC.toFixed(2)}<small>°C</small></span><span>${item.latestSohPercent.toFixed(2)}<small>%</small></span></span><small>${escape(c().latest)} ${item.dischargeCycleCount} · ${escape(item.latestRecordedAt)}</small></button>`).join('');
 el('opsLibrary').querySelectorAll('[data-ops-cell]').forEach(button=>{button.setAttribute('aria-pressed',String(report?.provenance==='bundled_nasa_record'&&nasaCell()===button.dataset.opsCell));button.addEventListener('click',()=>useNasa(button.dataset.opsCell));});
 for(const name of ['Record','Evidence','Handover']){el(`opsStep${name}`).dataset.ready=String(Boolean(report));el(`ops${name}State`).textContent=recordLoading?c().loading:report?c().ready:c().choose;}
 el('opsCurrentBadge').textContent=report?persistedReport?c().savedRecord:c()[report.record.mode]:c().choose;
 el('opsLogCount').textContent=backend?`${events.length} ${c().logCount}`:c().logUnavailable;
 el('opsSaveHint').textContent=backend&&serviceAvailable?c().saveHint:c().exportHint;
 const a=report?.assessment,key=!a?'actionUnknown':['warning','danger'].includes(a.thermal)?'actionThermal':a.thermal==='unknown'||a.quality==='stale'?'actionUnknown':a.maintenance==='review'||a.maintenance==='watch'?'actionReview':'actionNormal';
 el('opsNextTitle').textContent=c()[key];el('opsNextText').textContent=c()[`${key}Text`];el('opsNextTitle').closest('.ops-next').dataset.state=key;
 el('opsScope').textContent=report?.record.mode==='live'?c().snapshotScope||c().current:c().historicalScope;
}
function renderMeasurement() {
  if (!report) { el('opsProvenance').textContent = ''; el('opsMeasurements').innerHTML = `<div class="ops-empty"><strong>${escape(c().emptyTitle)}</strong>${escape(c().empty)}</div>`; return; }
  const r = report.record, a = report.assessment, matrix = r.temperaturesC;
  el('opsProvenance').textContent = report.provenance === 'bundled_nasa_record' ? c().provenanceNasa : c().provenanceUser;
  const tiles = matrix.flat().map((value, i) => `<div class="sensor-tile ${value === null ? 'missing' : value >= 80 ? 'danger' : value >= 60 ? 'warning' : ''}">${value === null ? '—' : value.toFixed(2)+'°'}<small>${Math.floor(i / matrix[0].length)+1} · ${i % matrix[0].length+1}</small></div>`).join('');
  const pairs = [[c().thermal, c()[a.thermal]], [c().maintenance, c()[a.maintenance]], [c().peak, a.peakC.toFixed(2)+' °C'], [c().rate, a.riseCPerS === null ? c().rateMissing : a.riseCPerS.toFixed(4)+' °C/s'], [c().sensors, `${a.sensorCount} / ${matrix.flat().length}`], [c().status, c()[a.quality]]];
  const single=matrix.flat().length===1,value=single?matrix[0][0]:a.peakC;
  el('opsMeasurements').innerHTML = `<div class="ops-body"><div id="opsRecordHeader" class="ops-record-heading"><div><span class="ops-eyebrow">${escape(c().currentRecord)}</span><h2>${escape(r.assetId)}</h2><span>${escape(r.source)}</span></div><span class="ops-tag" data-state="${a.quality}">${escape(c()[a.quality])}</span></div><div class="ops-decision" data-state="${a.thermal}"><span>${escape(c().thermal)}</span><strong>${escape(c()[a.thermal])}</strong></div><div class="ops-reading"><div><span>${escape(single?c().selectedTemp:c().peak)}</span><strong>${value===null?'—':value.toFixed(2)}<small>°C</small></strong></div><div class="ops-capacity"><span>${escape(c().capacity)}</span><strong>${a.sohPercent==null?'—':a.sohPercent.toFixed(2)+'%'}<small class="ops-tag" data-state="${a.maintenance}">${escape(c()[a.maintenance])}</small></strong><div class="ops-capacity-meter"><i style="width:${Math.max(0,Math.min(100,a.sohPercent??0))}%"></i></div></div></div><div class="ops-evidence">${pairs.slice(2).map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('')}</div><div class="ops-time"><span>${escape(c().time)}</span><strong>${escape(r.timestamp)}</strong>${report.provenance==='bundled_nasa_record'?`<small>${escape(c().timezone)}</small>`:''}</div>${report.assessmentScope==='full_discharge_cycle'?'<p class="ops-note">'+escape(c().fullCycle)+'</p>':''}<details class="ops-sensor-detail"><summary>${escape(c().sensorDetail)}</summary><div class="ops-grid ${single?'single-sensor':''}" style="grid-template-columns:repeat(${matrix[0].length},minmax(46px,1fr))">${tiles}</div><p class="ops-note">${escape(single?report.provenance==='bundled_nasa_record'?c().oneSensor:c().singleUser:c().gridNote)}</p></details><p class="ops-note warn">${escape(c().prototype)}</p></div>`;
 if(report.sourceRef)el('opsRecordHeader').querySelector('h2').textContent=report.sourceRef.cell;
}
async function useNasa(explicitId) {
  const sequence=++recordRequest;recordLoading=true;displayMessage('');render();
  try {
    const selected = bridge.selected;
    const id = typeof explicitId==='string'?explicitId:report?.provenance==='bundled_nasa_record'&&NASA_CELLS.includes(nasaCell())?nasaCell():selected?.cell||selectedLibrary;
    const number=bridge.fleet.cells.find(item=>item.id===id)?.dischargeCycleCount;
    let cycle;
    if(typeof explicitId!=='string'&&selected?.cell===id)cycle=selected.cycle;
    else {const response=await fetch(`./data/cells/${id.toLowerCase()}/cycles/${String(number).padStart(3,'0')}.json`,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw new Error('DATA');cycle=await response.json();}
    if(sequence!==recordRequest)return;
    const index=typeof explicitId!=='string'&&selected?.cell===id?selected.sampleIndex:cycle.samples.reduce((best,p,i)=>p.c>cycle.samples[best].c?i:best,0),point=cycle.samples[index];
    selectedLibrary=id;report=buildNasaReport(id,cycle,index);persistedReport=false;
    displayMessage(`${c().cycle} ${cycle.dischargeCycle} · ${c().sample} ${point.t}s`); render();
  } catch { if(sequence===recordRequest)displayMessage(c().loadFailed,true); }
  finally { if(sequence===recordRequest){recordLoading=false;render();} }
}
async function importFile(file) {
  if (!file) return;
  const sequence=++recordRequest;recordLoading=true;displayMessage('');render();
  try {
    if (file.size > 1048576) throw new Error(c().fileLarge);
    const input=JSON.parse(await file.text()),result=await decodeMeasuredImport(input,{loadNasaCycle:async ref=>{const response=await fetch(`./data/cells/${ref.cell.toLowerCase()}/cycles/${String(ref.dischargeCycle).padStart(3,'0')}.json`,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw new Error('DATA');return response.json();}});
    if(sequence!==recordRequest)return;recordLoading=false;report=result.report;persistedReport=false;displayMessage(input.schemaVersion?c().reportRestored:c().loaded(result.records.length));render();
    if(result.nasaReference){show();}
    else window.dispatchEvent(new CustomEvent('voltguard-thermal-import',{detail:{records:result.records}}));
  } catch (error) { if(sequence===recordRequest){recordLoading=false;displayMessage(c().errors[error.message] || (/^[A-Z_]+$/.test(error.message) ? errorText(error) : error instanceof SyntaxError ? c().badFile : error.message), true);show();} }
  finally { el('opsFile').value = '';if(sequence===recordRequest){recordLoading=false;render();} }
}
async function api(route, options = {}) {
  const response = await fetch(route, { ...options, signal: AbortSignal.timeout(6000), headers: { 'Content-Type':'application/json', 'X-Voltguard-Csrf':backend?.csrf || '', ...(options.headers || {}) }, cache:'no-store' });
  if (!response.ok) { const result = await response.json().catch(()=>({error:'SERVICE'})); throw new Error(result.error); }
  return response.json();
}
async function refreshService() {
  const [e,f] = await Promise.all([api('/api/events'), api('/api/fleet')]);
  events=e.events; live=f.records; serviceAvailable=true; render();
}
async function save() {
  if (!report || !backend || saving) return;
  const savingReport=report;saving=true;el('opsSave').disabled=true;
  try {
    const r = report.record;
    const result = report.provenance === 'bundled_nasa_record' ? await api('/api/records/nasa',{method:'POST',body:JSON.stringify({cell:nasaCell(),cycle:r.dischargeCycle,sampleIndex:report.sourceRef?.sampleIndex})}) : await api('/api/records/import',{method:'POST',body:JSON.stringify({record:r,previous:report.previousMeasurement})});
    if(report===savingReport){if(result.duplicate)report=result.report;persistedReport=true;displayMessage(result.duplicate ? c().duplicate : c().saved);}await refreshService();
  } catch (error) { if(report===savingReport)displayMessage(errorText(error),true); }
  finally { saving=false;render(); }
}
function renderEvents() {
  if (!backend) { el('opsEvents').innerHTML = `<div class="ops-log-empty"><span class="ops-tag">${escape(c().logUnavailable)}</span><p>${escape(c().cloudLimit)}</p></div>`; return; }
  el('opsEvents').innerHTML = events.length ? events.map(event => `<div class="ops-event"><div><strong>${escape(event.kind === 'thermal' ? c().thermalEvent : c().maintenanceEvent)} · ${escape(c()[event.status])}</strong><small>#${event.id} · ${escape(event.asset)} · ${escape(event.updated_at)} · ${escape(c()[event.report.record.mode] || event.report.record.mode)}</small></div><div class="ops-event-controls"><button type="button" class="ops-button" data-report="${event.id}">${escape(c().view)}</button>${event.status === 'open' ? `<button type="button" class="ops-button" data-event="${event.id}" data-action="acknowledge">${escape(c().acknowledge)}</button>` : event.status === 'acknowledged' ? `<button type="button" class="ops-button" data-event="${event.id}" data-action="close">${escape(c().close)}</button>` : ''}</div></div>`).join('') : `<div class="ops-empty">${escape(c().emptyEvents)}</div>`;
  el('opsEvents').querySelectorAll('[data-report]').forEach(button=>button.addEventListener('click',()=>{recordRequest++;recordLoading=false;report=events.find(e=>e.id===Number(button.dataset.report)).report;persistedReport=true;displayMessage('');render(); section.scrollIntoView({behavior:'smooth'});}));
  el('opsEvents').querySelectorAll('.ops-event-controls').forEach((controls,index)=>{const button=document.createElement('button');button.type='button';button.className='ops-button';button.dataset.history=events[index].id;button.textContent=c().history;button.addEventListener('click',()=>loadHistory(events[index].id));controls.prepend(button);});
  el('opsEvents').querySelectorAll('[data-event]').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;
    try { await api(`/api/events/${button.dataset.event}`,{method:'PATCH',body:JSON.stringify({action:button.dataset.action})}); await refreshService(); }
    catch(error){ displayMessage(errorText(error),true); button.disabled=false; }
  }));
}
let historyTrigger=null;
async function loadHistory(id){
 const sequence=++historyRequest;historyEventId=id;historyData=null;historyError=false;historyLoading=true;renderHistory();
 if(!el('opsHistoryDialog').open){historyTrigger=document.activeElement;el('opsHistoryDialog').showModal();el('opsHistoryClose').focus();}
 try{const data=await api(`/api/events/${id}/history`);if(sequence===historyRequest)historyData=data;}
 catch{if(sequence===historyRequest)historyError=true;}
 finally{if(sequence===historyRequest){historyLoading=false;renderHistory();}}
}
function renderHistory(){
 el('opsHistoryKicker').textContent='VOLTGUARD / LOCAL RECORD';el('opsHistoryTitle').textContent=c().historyTitle;el('opsHistoryClose').textContent=c().dismiss;el('opsHistoryRetry').textContent=c().retry;el('opsHistoryExport').textContent=c().historyExport;
 el('opsHistoryExport').disabled=!historyData||historyLoading;el('opsHistoryRetry').hidden=!historyError;
 const body=el('opsHistoryBody');
 if(historyLoading){body.innerHTML=`<p class="ops-history-message" role="status">${escape(c().historyLoading)}</p>`;return;}
 if(historyError){body.innerHTML=`<p class="ops-history-message error" role="alert">${escape(c().historyFailed)}</p>`;return;}
 if(!historyData){body.replaceChildren();return;}
 const event=historyData.event,actions={created:c().historyCreated,measurement:c().historyMeasurement,acknowledge:c().historyAcknowledged,close:c().historyClosed};
 body.innerHTML=`<div class="ops-history-summary"><strong>#${event.id} · ${escape(event.kind==='thermal'?c().thermalEvent:c().maintenanceEvent)}</strong><span class="ops-tag">${escape(c()[event.status])}</span><small>${escape(event.asset)} · ${escape(event.report.record.source)}</small><small>${escape(c().historyCreated)} · ${escape(event.created_at)}</small></div><ol class="ops-history-timeline">${historyData.history.map(item=>`<li data-action="${escape(item.action)}"><strong>${escape(actions[item.action]||c().unknown)}</strong><time>${escape(item.at)}</time></li>`).join('')}</ol>${historyData.history.some(item=>item.action==='created')?'':`<p class="ops-note">${escape(c().historyOld)}</p>`}<p class="ops-history-limit">${escape(c().historyLimit)}</p>`;
 const formatTime=stamp=>new Intl.DateTimeFormat(bridge.language==='zh'?'zh-HK':'en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(stamp));
 body.querySelector('.ops-history-summary small:last-child').textContent=`${c().historyCreated} · ${formatTime(event.created_at)}`;
 body.querySelectorAll('time').forEach((node,index)=>{node.dateTime=historyData.history[index].at;node.textContent=formatTime(historyData.history[index].at);});
 const timezone=document.createElement('p');timezone.className='ops-note';timezone.textContent=c().historyTimezone;body.querySelector('.ops-history-summary').after(timezone);
 if(historyData.historyTruncated){body.querySelectorAll('.ops-note').forEach(note=>{if(note!==timezone)note.remove();});const note=document.createElement('p');note.className='ops-history-limit';note.textContent=c().historyTruncated;body.append(note);}
}
el('opsHistoryClose').addEventListener('click',()=>el('opsHistoryDialog').close());
el('opsHistoryDialog').addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const focusable=[...el('opsHistoryDialog').querySelectorAll('button,[href],input,select,textarea,[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);
 const first=focusable[0],last=focusable.at(-1);if(!first)return;
 if(event.shiftKey&&(document.activeElement===first||!el('opsHistoryDialog').contains(document.activeElement))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||!el('opsHistoryDialog').contains(document.activeElement))){event.preventDefault();first.focus();}
});
el('opsHistoryDialog').addEventListener('close',()=>{historyRequest++;historyLoading=false;if(historyTrigger?.isConnected)historyTrigger.focus();});
el('opsHistoryRetry').addEventListener('click',()=>loadHistory(historyEventId));
el('opsHistoryExport').addEventListener('click',()=>{if(!historyData)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...historyData,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`voltguard-event-${historyData.event.id}-history.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function renderLive() {
  const online = backend && serviceAvailable;
  el('opsLive').innerHTML = live.length ? live.map(item=>{
    const a=item.assessment, age=(Date.now()-Date.parse(item.record.timestamp))/1000;
    const quality = !online ? 'stale' : age > 15 ? 'stale' : a.quality;
    const status=['warning','danger'].includes(a.thermal)?c()[a.thermal]:quality==='stale'?c().unknown:c()[a.thermal];
    return `<div class="live-channel"><strong>${escape(item.record.assetId)} · ${escape(status)}</strong><span>${escape(item.record.source)} · ${a.peakC.toFixed(2)}°C · ${escape(c()[quality])}${item.record.operatingState?' · '+escape(c()[item.record.operatingState]):''}</span><span>${escape(item.record.timestamp)}</span><button class="ops-button" type="button" data-live-map="${escape(item.record.assetId)}">${escape(c().viewHeatmap)}</button></div>`;
  }).join('') : `<div class="ops-gateway-empty"><strong>${escape(c().emptyLive)}</strong><p>${escape(c().liveEmpty)}</p>${backend&&!backend.liveIngestConfigured?'<small>'+escape(c().liveToken)+'</small>':''}</div>`;
  el('opsLive').querySelectorAll('[data-live-map]').forEach(button=>button.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('voltguard-thermal-live',{detail:{report:live.find(r=>r.record.assetId===button.dataset.liveMap),online:Boolean(online)}}))));
  window.dispatchEvent(new CustomEvent('voltguard-live',{detail:{records:live,online:Boolean(online)}}));
}
function exportJson() {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=`voltguard-report-${report.record.assetId}-${Date.now()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printReport() {
  if (!report) return;
  document.querySelector('.report-print')?.remove();
  const out=document.createElement('article'); out.className='report-print';
  const a=report.assessment,r=report.record;
  const rows=[[c().created,report.generatedAt],[c().source,r.source],[c().time,r.timestamp],[c().thermal,c()[a.thermal]],[c().maintenance,c()[a.maintenance]],[c().peak,a.peakC.toFixed(3)+'°C'],[c().rate,a.riseCPerS === null ? c().rateMissing : a.riseCPerS.toFixed(4)+'°C/s'],[c().sensors,`${a.sensorCount} / ${r.temperaturesC.flat().length}`]];
  out.innerHTML=`<h1>${escape(c().reportTitle)}</h1><p>${escape(r.assetId)} · ${escape(r.mode === 'historical' ? c().historical : c().current)}</p><p>${escape(report.provenance === 'bundled_nasa_record' ? c().provenanceNasa : c().provenanceUser)}</p><section><h2>${escape(c().status)}</h2><table>${rows.map(([label,value])=>`<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join('')}</table></section><section class="print-limit"><h2>${escape(c().limits)}</h2><p>${escape(c().prototype)}</p><p>${escape(c().safeHint)}</p><p>${escape(c().noAI)}</p><p>${escape(r.temperaturesC.flat().length === 1 ? c().oneSensor : c().gridNote)}</p>${report.provenance === 'bundled_nasa_record' ? '<p>'+escape(c().timezone)+'</p>' : ''}</section><section><h2>${escape(c().checklist)}</h2><ol>${c().steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p>FSD · https://www.hkfsd.gov.hk/eng/fire_ambulance_services/fire_information.html</p></section><section><h2>${escape(c().evidence)}</h2><pre>${escape(JSON.stringify(r,null,2))}</pre></section>`;
  if(report.assessmentScope==='full_discharge_cycle'){const note=document.createElement('p');note.textContent=c().fullCycle;out.querySelector('.print-limit').append(note);}
  if(report.provenance!=='bundled_nasa_record'&&r.temperaturesC.flat().length===1){const limit=out.querySelector('.print-limit');limit.innerHTML=limit.innerHTML.replace(escape(c().oneSensor),escape(c().singleUser));}
  out.querySelector('pre').textContent=JSON.stringify({record:r,...(report.sourceRef?{sourceRef:report.sourceRef}:{}),...(report.previousMeasurement?{previousMeasurement:report.previousMeasurement}:{})},null,2);
  document.body.append(out); window.print();
}
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket.onopen = () => { serviceAvailable=true; refreshService().catch(()=>{}); };
  socket.onmessage = event => { const data=JSON.parse(event.data); if(data.type!=='heartbeat'&&data.type!=='connected')refreshService().catch(()=>{serviceAvailable=false;render();}); };
  socket.onerror = () => socket.close();
  socket.onclose = () => { serviceAvailable=false; render(); setTimeout(async()=>{try{backend=await api('/api/health');connect();}catch{connect();}},5000); };
}
el('opsNasa').addEventListener('click',useNasa); el('opsFile').addEventListener('change',event=>importFile(event.target.files[0])); el('opsJson').addEventListener('click',exportJson); el('opsPrint').addEventListener('click',printReport); el('opsSave').addEventListener('click',save);
el('opsInspect').addEventListener('click',()=>{if(!report)return;if(report.record.mode==='live')window.dispatchEvent(new CustomEvent('voltguard-thermal-live',{detail:{report,online:Boolean(backend&&serviceAvailable)}}));else if(report.provenance==='bundled_nasa_record')window.dispatchEvent(new CustomEvent('voltguard-thermal-nasa',{detail:{cell:nasaCell(),cycle:report.record.dischargeCycle,elapsed:report.record.sampleElapsedSeconds}}));else window.dispatchEvent(new CustomEvent('voltguard-thermal-import',{detail:{records:[...(report.previousMeasurement?[report.previousMeasurement]:[]),report.record]}}));});
el('opsSpeak').addEventListener('click',()=>{if(!('speechSynthesis'in window)){displayMessage(c().noSpeech,true);return;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(c().steps.join(' '));utterance.lang=bridge.language==='zh'?'zh-HK':'en-GB';utterance.rate=.9;speechSynthesis.speak(utterance);});
el('opsStop').addEventListener('click',()=>window.speechSynthesis?.cancel());
window.addEventListener('voltguard-language',()=>{message='';window.speechSynthesis?.cancel();render();});
window.addEventListener('voltguard-ready',()=>{if(new URLSearchParams(location.search).get('view')==='operations')show();});
window.addEventListener('voltguard-data-error',show);
window.addEventListener('voltguard-report-request',event=>{recordRequest++;recordLoading=false;report=event.detail;persistedReport=false;displayMessage('');render();});
if(bridge.ready&&new URLSearchParams(location.search).get('view')==='operations')show();
setInterval(renderLive,3000); render();
// Do not probe arbitrary public endpoints. The bundled service is intentionally loopback-only.
if (['127.0.0.1','localhost'].includes(location.hostname)) {
  try { backend=await api('/api/health'); if(backend.storage==='sqlite'){await refreshService();connect();} else backend=null; }
  catch { backend=null; }
  serviceChecked=true;render();
}
else {serviceChecked=true;render();}

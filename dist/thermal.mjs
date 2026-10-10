import {temperatureColor,hottestSensor,drawSensorMap,fitThermalCanvas,sensorAtPoint} from './thermal-map.mjs';
import {assessNasaCycle,assessTelemetry,createReport} from './safety.mjs';
import {buildNasaReport} from './evidence.mjs';
import {readThermalState,saveThermalState,thermalAlertKind} from './thermal-ux.mjs';
import {buildSimulation} from './thermal-simulation.mjs';
const bridge=window.voltguard, $=id=>document.getElementById(id);
const words={
 en:{tab:'Thermal view',title:'Battery thermal monitor',subtitle:'Measured temperature, at a glance.',mode:'NASA laboratory record · Historical',mapTitle:'Measured sensor map',singleTitle:'Battery temperature · one measured point',mapNote:'Supplied sensor grid · no interpolation',singleNote:'No pack geometry or spatial distribution in this dataset',sensor:'Measured surface point',position:'Sensor location not specified by source',temperature:'Selected temperature',hotspot:'Hottest measured sensor',selected:'Selected sensor',noMeasurement:'No measurement',peak:'Cycle peak',rate:'5-second max rise',voltage:'Voltage',current:'Current',health:'Capacity health',normal:'No prototype thermal threshold crossed',warning:'Prototype thermal WARNING',danger:'Prototype thermal DANGER',unknown:'Insufficient evidence',legend:'Fixed 20–80°C scale · color shows temperature, not predicted fire risk. Out-of-range values use end colors.',history:'Temperature over time',historyNote:'Measured samples, not spatial modules',cycle:'Discharge cycle',play:'Play recorded samples',pause:'Pause replay',jumpPeak:'Go to hottest sample',zoom:'Enlarge map',unzoom:'Standard size',import:'Import sensor data',details:'Full record',handover:'Review / export',limitTitle:'What is actually measured?',limit:'NASA supplies one surface-temperature channel for this laboratory cell. The square is that measurement, not a full vehicle battery pack. The colored timeline shows real changes over time.',multiLimit:'The map shows only the supplied sensor matrix. Grey hatching is missing data; it is not estimated or filled. Row/column addresses are not certified physical module positions.',rules:'Prototype rule boundaries',rulesText:'60°C / 1°C/s: warning. 80°C / 2°C/s: danger. These are development rules, not certified fire limits or validated fire prediction. Capacity decline is separate from thermal alerts.',provenance:'NASA Ames PCoE · verified bundled record',importProvenance:'User-supplied measured data · source unverified',importMode:'Imported measurement · Historical',sample:'Sample',missing:'Missing',cycleScope:'State, peak and rise rate assess the complete cycle; the map shows the selected sample.',snapshotScope:'State assesses the current sensor snapshot and preceding measurement when available.',error:'Unable to load this record. The last valid record is preserved.',retry:'Retry',waiting:'Loading measured temperature…',layout:'Sensor grid',independent:'Four independent laboratory cells, not modules in one pack',point:'Point',row:'Row',col:'Column',liveMode:'Local gateway · measured feed',stale:'Channel stale / offline — current state unknown',sourceTime:'NASA lab timestamp; source timezone unspecified',selectHint:'Click a sensor or use arrow keys to inspect it.',frame:'Measurement',liveUnavailable:'No live gateway record has been received.',live:'Live gateway'},
 zh:{tab:'溫度圖',title:'電池溫度監測',subtitle:'讓實測溫度一目了然。',mode:'NASA 實驗室記錄 · 歷史量測',mapTitle:'實測測點熱力圖',singleTitle:'電池溫度 · 一個實測測點',mapNote:'資料提供的測點矩陣 · 不插值',singleNote:'此資料不含電池包幾何或空間溫度分布',sensor:'實測表面溫度點',position:'來源未提供感測器的具體位置',temperature:'所選測點溫度',hotspot:'最高溫測點',selected:'所選測點',noMeasurement:'未量測',peak:'整次循環最高溫',rate:'5 秒最大升溫率',voltage:'電壓',current:'電流',health:'容量健康度',normal:'未跨過原型熱狀態閾值',warning:'原型熱狀態：警告',danger:'原型熱狀態：危險',unknown:'證據不足',legend:'固定 20–80°C 色階 · 顏色代表溫度，不代表預測火災風險；超出範圍使用端點色。',history:'溫度時間熱力帶',historyNote:'每格為實測時間點，不是空間模組',cycle:'放電循環',play:'播放實測記錄',pause:'暫停回放',jumpPeak:'跳到最高溫時刻',zoom:'放大溫度圖',unzoom:'標準大小',import:'匯入測點資料',details:'完整記錄',handover:'評估／匯出',limitTitle:'這張圖實際量測了什麼？',limit:'NASA 為這枚實驗室電芯提供一個表面溫度通道。方格只代表這個實測點，不是完整汽車電池包；下方色帶顯示溫度隨時間的真實變化。',multiLimit:'只顯示資料提供的測點矩陣。灰色斜線代表缺失資料，不估算也不補值；行列地址不代表已核驗的實體模組位置。',rules:'原型規則邊界',rulesText:'60°C／1°C/s：警告；80°C／2°C/s：危險。這是開發規則，不是消防認證限值或已驗證的火災預測；容量退化與熱警告分開判讀。',provenance:'NASA Ames PCoE · 隨附來源已核驗',importProvenance:'使用者提供的實測資料 · 來源未獨立核驗',importMode:'匯入量測 · 歷史資料',sample:'量測點',missing:'缺失',cycleScope:'狀態、最高溫及升溫率評估整次循環；溫度圖只顯示所選時刻。',snapshotScope:'狀態評估目前測點快照；有連續資料時才計算升溫率。',error:'此記錄未能載入，已保留上一筆有效資料。',retry:'重試',waiting:'正在載入實測溫度…',layout:'測點矩陣',independent:'四枚獨立實驗室電芯，不是同一電池包的模組',point:'測點',row:'行',col:'列',liveMode:'本地閘道 · 實測連線',stale:'通道資料過期／斷線 · 目前狀態未知',sourceTime:'NASA 實驗室時間；来源未註明時區',selectHint:'點選測點或使用方向鍵查看數值。',frame:'量測記錄',liveUnavailable:'尚未收到即時閘道記錄。',live:'即時閘道'}
};
words.en.channelPeak='Latest cycle peak';words.zh.channelPeak='最新循環最高溫';
Object.assign(words.en,{model:'3D battery model',flat:'2D sensor map',reset:'Reset view',top:'Top view',zoomIn:'Zoom in',zoomOut:'Zoom out',modelHint:'Drag to rotate · scroll / pinch to zoom · click a measured region',modelNote:'Illustrative geometry · no estimated temperatures',singleNote:'Illustrative cell · sensor anchor is not its verified physical location',limit:'NASA supplies one surface-temperature channel. Only the small sensor marker is colored with a measured value. The grey cell shell is unmeasured. The marker position and model geometry are illustrative, not a verified sensor location or engineering CAD.',multiLimit:'Each colored top surface corresponds to one supplied matrix entry, not an interpolated temperature field. Grey regions are unmeasured. Module geometry and row/column positions are illustrative, not verified OEM geometry.',fallback:'3D unavailable on this browser. The measured 2D view remains available.',modelWaiting:'Preparing the 3D view…',singleTitle:'Cell thermal inspection · 3D',mapTitle:'Battery sensor regions · 3D'});
Object.assign(words.zh,{model:'3D 電池模型',flat:'2D 測點圖',reset:'重設視角',top:'俯視',zoomIn:'拉近',zoomOut:'拉遠',modelHint:'拖動旋轉 · 滾輪／雙指縮放 · 點選實測區域',modelNote:'示意幾何 · 不估算溫度',singleNote:'示意電芯 · 測點錨點不是已核驗的實體位置',limit:'NASA 只提供一個表面溫度通道。只有小型測點標記按實測值著色，灰色電芯表面未量測。測點位置和模型幾何均為示意，不代表已核驗的感測器位置或工程 CAD。',multiLimit:'每個著色頂面對應資料矩陣中的一個測點，不是插值溫度場；灰色區域未量測。模組形狀及行列位置是示意，不代表已核驗的車廠幾何。',fallback:'此瀏覽器無法顯示 3D，仍可使用實測 2D 溫度圖。',modelWaiting:'正在準備 3D 視圖…',singleTitle:'電芯立體溫度檢視',mapTitle:'電池分區立體溫度圖'});
const text=()=>words[bridge.language], escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
Object.assign(words.en,{emergencyDanger:'DANGER · Prototype thermal rule triggered',emergencyWarning:'WARNING · Prototype thermal rule triggered',emergencyLimit:'Not a confirmed thermal-runaway diagnosis. Follow the applicable site / OEM escalation procedure and seek qualified review.',emergencyHistorical:'Historical evidence only · no current vehicle emergency is established.',emergencyStale:'Live channel stale / offline · current condition unknown; the last alert is retained.',previousSample:'Previous measured sample',nextSample:'Next measured sample',previousCycle:'Previous discharge cycle',nextCycle:'Next discharge cycle'});
Object.assign(words.zh,{emergencyDanger:'危險 · 已觸發原型熱狀態規則',emergencyWarning:'警告 · 已觸發原型熱狀態規則',emergencyLimit:'這不是已確認的熱失控診斷。請依適用的場地／車廠升級流程，由合資格人員覆核。',emergencyHistorical:'僅為歷史證據 · 並未確認車輛當前發生緊急事故。',emergencyStale:'即時通道過期／斷線 · 目前狀態未知，保留上一筆警示。',previousSample:'上一個實測量測點',nextSample:'下一個實測量測點',previousCycle:'上一次放電循環',nextCycle:'下一次放電循環'});
let cell='B0005',summary=null,cycle=null,sample=0,mode='nasa',records=[],selection={row:0,col:0},bounds=null,timer=null,request=0,error=false,loading=false,zoom=false,liveRecord=null,liveOnline=false;
let simulation=null,nasaResume=null;
Object.assign(words.en,{simNormal:'Simulate normal',simWarning:'Simulate warning',simDanger:'Simulate danger',simNote:'Demonstration scenarios · synthetic temperatures, not measured data',simMode:'SIMULATION · NOT MEASURED',simTitle:'Simulation only — no vehicle is connected',simScope:'Local demonstration only. No incident is established; no data is saved, exported or sent to AI.',simReturn:'Use NASA records',simRegion:'Simulated region',simTemperature:'Selected simulated temperature',simMap:'Simulated battery regions',simModel:'Simulated 3D battery model',simFlat:'Simulated 2D grid',simLimit:'All 16 values are constructed demonstration inputs on illustrative geometry. These are not measurements or a real battery pack. Two identical synthetic frames one second apart give a synthetic rise rate of zero; the warning and danger scenes trigger only temperature rules.',simPeak:'Simulated peak',simRate:'Synthetic rise rate',simSnapshot:'Constructed snapshot · no measured replay',simWarningRule:'SIMULATION · Prototype thermal WARNING',simDangerRule:'SIMULATION · Prototype thermal DANGER',simNormalRule:'SIMULATION · No prototype threshold crossed',simHint:'Drag to rotate · click a simulated region',simGeometry:'Synthetic values · illustrative geometry'});
Object.assign(words.zh,{simNormal:'模擬正常狀態',simWarning:'模擬警告狀態',simDanger:'模擬危險狀態',simNote:'展示情境 · 仿真溫度，並非實測資料',simMode:'仿真展示 · 非實測',simTitle:'僅供仿真展示 — 未連接車輛',simScope:'僅在本地展示，不代表發生事故；不儲存、不匯出，也不傳送至 AI。',simReturn:'使用 NASA 記錄',simRegion:'仿真區域',simTemperature:'所選仿真溫度',simMap:'仿真電池分區',simModel:'仿真 3D 電池模型',simFlat:'仿真 2D 矩陣',simLimit:'16 個數值均為構造的展示輸入，幾何也是示意，不是實測或真實電池包。兩個相隔一個仿真秒的相同快照產生零仿真溫升率；警告及危險情境只觸發溫度規則。',simPeak:'仿真最高溫',simRate:'仿真溫升率',simSnapshot:'構造快照 · 並非實測回放',simWarningRule:'仿真 · 原型熱狀態：警告',simDangerRule:'仿真 · 原型熱狀態：危險',simNormalRule:'仿真 · 未跨過原型閾值',simHint:'拖動旋轉 · 點選仿真區域',simGeometry:'仿真數值 · 示意幾何'});
const summaries=new Map(),cycles=new Map();
let model3d=null,modelPromise=null,modelFailed=false,display3d=!window.matchMedia('(max-width:760px)').matches;
const view=document.createElement('section');view.id='thermalView';view.className='thermal-view';view.hidden=true;
view.innerHTML=`<div class="thermal-heading"><div><div class="kicker">VOLTGUARD / THERMAL</div><h1 data-thermal="title"></h1><p data-thermal="subtitle"></p></div><span class="thermal-mode" id="thermalMode"></span></div><div class="thermal-channels" id="thermalChannels"></div><p class="thermal-error" id="thermalError" role="status" hidden></p>
 <div class="thermal-layout"><section class="thermal-main"><div class="thermal-main-head"><div><h2 id="thermalMapTitle"></h2><p id="thermalMapNote"></p></div><button class="thermal-button" id="thermalZoom" data-thermal="zoom"></button></div><div class="thermal-map-stage"><div class="thermal-map-meta" id="thermalMapMeta"></div><div class="thermal-map-aside" id="thermalMapAside"></div><canvas id="thermalMap" tabindex="0"></canvas></div><div class="thermal-scale"><div class="thermal-scale-bar"></div><div class="thermal-scale-labels"><span>20°C</span><span>40°C</span><span>60°C</span><span>80°C</span></div><p data-thermal="legend"></p></div>
 <div class="thermal-playback"><div class="thermal-timeline-head"><h3 data-thermal="history"></h3><span id="thermalElapsed"></span></div><canvas id="thermalHistory" class="thermal-history" tabindex="0"></canvas><div class="thermal-time-labels"><span id="thermalStart"></span><span id="thermalHistoryNote"></span><span id="thermalEnd"></span></div><div class="thermal-scrub"><button class="thermal-button icon" id="thermalPlay">▶</button><input id="thermalScrub" type="range" min="0" max="0" value="0"><button class="thermal-button" id="thermalPeak" data-thermal="jumpPeak"></button></div><div class="thermal-cycle-controls"><label id="thermalCycleLabel" for="thermalCycle" data-thermal="cycle"></label><select id="thermalCycle"></select><button class="thermal-button" id="thermalDetails" data-thermal="details"></button></div></div></section>
 <aside class="thermal-side"><section class="thermal-reading"><span class="label" data-thermal="temperature"></span><strong class="number"><span id="thermalTemperature">—</span><small>°C</small></strong><span class="selection-label" id="thermalSelection"></span><div class="thermal-state" id="thermalState"></div><dl class="thermal-stats" id="thermalStats"></dl><input id="thermalSensorPick" class="thermal-picked" type="range" min="0" max="0"><p class="thermal-helper" id="thermalPickHint" data-thermal="selectHint"></p></section><div class="thermal-action-row"><button class="thermal-button" id="thermalImport" data-thermal="import"></button><button class="thermal-button" id="thermalHandover" data-thermal="handover"></button></div><section class="thermal-note"><strong data-thermal="limitTitle"></strong><p id="thermalLimit"></p><details><summary data-thermal="rules"></summary><p data-thermal="rulesText"></p></details></section><p class="thermal-caption" id="thermalSource"></p></aside></div>`;
view.querySelector('#thermalState').id='thermalRuleResult';
view.querySelector('.thermal-heading').insertAdjacentHTML('afterend','<div id="thermalSimulationNotice" class="thermal-simulation-notice" role="status" hidden><div><strong data-thermal="simTitle"></strong><p data-thermal="simScope"></p></div><button id="thermalSimReturn" class="thermal-button" type="button" data-thermal="simReturn"></button></div>');
view.querySelector('.thermal-cycle-controls').insertAdjacentHTML('beforebegin','<section class="thermal-sim" aria-labelledby="thermalSimNote"><p id="thermalSimNote" class="thermal-sim-note" data-thermal="simNote"></p><div class="thermal-sim-buttons"><button type="button" class="thermal-button sim-normal" id="thermalSimNormal" data-thermal="simNormal" aria-pressed="false"></button><button type="button" class="thermal-button sim-warning" id="thermalSimWarning" data-thermal="simWarning" aria-pressed="false"></button><button type="button" class="thermal-button sim-danger" id="thermalSimDanger" data-thermal="simDanger" aria-pressed="false"></button></div></section>');
view.querySelector('.thermal-heading').insertAdjacentHTML('afterend','<div id="thermalEmergency" class="thermal-emergency" role="status" aria-live="polite" aria-atomic="true" hidden><span aria-hidden="true" class="thermal-emergency-icon">⚠</span><div><strong id="thermalEmergencyText"></strong><p id="thermalEmergencyScope"></p><small id="thermalEmergencyLimit"></small></div></div>');
view.querySelector('#thermalScrub').insertAdjacentHTML('beforebegin','<button type="button" id="thermalStepPrev" class="thermal-button step">−</button>');
view.querySelector('#thermalScrub').insertAdjacentHTML('afterend','<button type="button" id="thermalStepNext" class="thermal-button step">+</button>');
view.querySelector('#thermalCycle').insertAdjacentHTML('beforebegin','<button type="button" id="thermalCyclePrev" class="thermal-button step">−</button>');
view.querySelector('#thermalCycle').insertAdjacentHTML('afterend','<button type="button" id="thermalCycleNext" class="thermal-button step">+</button>');
const stage=view.querySelector('.thermal-map-stage');
stage.insertAdjacentHTML('beforeend','<div id="thermal3d" class="thermal-model-host"></div><p id="thermalModelHint" class="thermal-model-hint"></p>');
stage.insertAdjacentHTML('beforebegin','<div class="thermal-model-tools"><div class="thermal-view-switch" role="group"><button id="thermal3dButton" class="thermal-button" data-thermal="model" aria-pressed="true"></button><button id="thermal2dButton" class="thermal-button" data-thermal="flat" aria-pressed="false"></button></div><div class="thermal-camera-tools"><button id="thermalReset" class="thermal-button" data-thermal="reset"></button><button id="thermalTop" class="thermal-button" data-thermal="top"></button><button id="thermalZoomIn" class="thermal-button">+</button><button id="thermalZoomOut" class="thermal-button">−</button></div></div>');
stage.insertAdjacentHTML('afterend','<p id="thermal3dStatus" class="thermal-model-status" role="status" hidden></p>');
document.querySelector('.view-tabs').after(view);
const tab=document.createElement('button');tab.id='thermalTab';tab.type='button';tab.className='view-tab';document.querySelector('.view-tabs').prepend(tab);
function persistState(){if(mode!=='nasa'||!cycle||loading||error)return;try{saveThermalState(sessionStorage,{mode,cell,cycle:cycle.dischargeCycle,sample,display3d});}catch{}}
function show(){bridge.showThermal();view.hidden=false;tab.classList.add('active');tab.setAttribute('aria-current','page');render();if(!cycle&&mode==='nasa'&&!loading){let saved=null;try{saved=readThermalState(sessionStorage);}catch{}if(saved?.display3d!==null&&saved)display3d=saved.display3d;load(saved?.cell||cell,saved?.cycle||null,saved);}}
function pause(){clearInterval(timer);timer=null;updateControls();}
window.addEventListener('voltguard-view',event=>{if(event.detail.view!=='thermal'){persistState();view.hidden=true;model3d?.setVisible(false);tab.classList.remove('active');tab.setAttribute('aria-current','false');pause();}});
window.addEventListener('pagehide',persistState);
tab.addEventListener('click',show);
async function fetchData(url){const response=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw new Error('DATA');return response.json();}
async function load(id,cycleNumber=null,restore=null){
 const seq=++request;pause();loading=true;error=false;view.classList.add('thermal-loading');view.setAttribute('aria-busy','true');updateControls();
 try{
  const slug=id.toLowerCase();let index=summaries.get(id);
  if(!index){index=await fetchData(`./data/cells/${slug}/summary.json`);summaries.set(id,index);}
  const number=Math.min(Math.max(1,cycleNumber||index.cycles.length),index.cycles.length),key=`${id}/${number}`;let data=cycles.get(key);
  if(!data){data=await fetchData(`./data/cells/${slug}/cycles/${String(number).padStart(3,'0')}.json`);cycles.set(key,data);}
  if(seq!==request)return;
  cell=id;summary=index;cycle=data;mode='nasa';records=[];sample=peakIndex();selection={row:0,col:0};
  if(restore)sample=Math.min(restore.sample,cycle.samples.length-1);
 }catch{if(seq===request)error=true;}
 finally{if(seq===request){loading=false;view.classList.remove('thermal-loading');view.setAttribute('aria-busy','false');render();}}
 return seq===request&&!error;
}
function activeRecord(){return mode==='import'?records[sample]:mode==='live'?liveRecord?.record:null;}
function matrix(){return mode==='simulation'?simulation.matrix:mode==='nasa'?cycle?[[cycle.samples[sample].c]]:null:activeRecord()?.temperaturesC;}
function assessment(){return mode==='simulation'?simulation.assessment:mode==='nasa'?cycle?assessNasaCycle(cycle):null:mode==='live'?liveRecord?.assessment:records.length?assessTelemetry(records[sample],records[sample-1]||null):null;}
function points(){return mode==='simulation'?[{t:0,c:simulation.assessment.peakC}]:mode==='nasa'?cycle?.samples||[]:records.map((r,i)=>({t:i,c:hottestSensor(r.temperaturesC).value}));}
function peakIndex(){const list=points();return list.reduce((best,p,i)=>p.c>list[best].c?i:best,0);}
const clock=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
function render(){
 tab.textContent=text().tab;view.querySelectorAll('[data-thermal]').forEach(el=>el.textContent=text()[el.dataset.thermal]);
 view.dataset.mode=mode;const sim=mode==='simulation';$('thermalSimulationNotice').hidden=!sim;
 for(const [id,type] of [['thermalSimNormal','normal'],['thermalSimWarning','warning'],['thermalSimDanger','danger']]){$(id).setAttribute('aria-pressed',String(sim&&simulation.scenario===type));$(id).disabled=loading;}
 $('thermalSimReturn').disabled=loading;
 if(!view.hidden){document.querySelector('.verified').textContent=mode==='nasa'?text().provenance:text().importProvenance;$('contextValue').textContent=mode==='nasa'?`${cell} · ${text().mode}`:mode==='live'?text().liveMode:text().importMode;}
 $('thermalMode').textContent=mode==='nasa'?text().mode:mode==='live'?text().liveMode:text().importMode;
 if(sim){$('thermalMode').textContent=text().simMode;if(!view.hidden){document.querySelector('.verified').textContent=text().simMode;$('contextValue').textContent=text().simTitle;}view.querySelector('[data-thermal="subtitle"]').textContent=text().simNote;view.querySelector('[data-thermal="temperature"]').textContent=text().simTemperature;view.querySelector('[data-thermal="history"]').textContent=text().simSnapshot;$('thermal3dButton').textContent=text().simModel;$('thermal2dButton').textContent=text().simFlat;}
 const fleet=bridge.fleet?.cells||[];
 $('thermalChannels').innerHTML=fleet.map(item=>`<button class="thermal-channel" data-thermal-cell="${item.id}" aria-pressed="${mode==='nasa'&&cell===item.id}"><span>${item.id}<i style="--channel-color:${temperatureColor(item.latestPeakTempC)}"></i></span><small>${escape(text().channelPeak)} ${item.latestPeakTempC.toFixed(2)}°C</small></button>`).join('');
 $('thermalChannels').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>load(button.dataset.thermalCell)));
 const a=assessment(),grid=matrix(),one=!grid||grid.flat().length===1;
 view.querySelector('.thermal-playback').hidden=mode==='live';
 $('thermalMapTitle').textContent=one?text().singleTitle:text().mapTitle;
 $('thermalMapNote').textContent=one?text().singleNote:text().modelNote;
 $('thermalMapMeta').textContent=mode==='nasa'?`${cell} / ${cycle?String(cycle.dischargeCycle).padStart(3,'0'):'—'}`:activeRecord()?.assetId||'—';
 $('thermalMapAside').textContent=grid?`${text().layout} ${grid.length} × ${grid[0].length} · ${a.sensorCount} ${text().point}`:text().waiting;
 $('thermalLimit').textContent=mode==='nasa'?text().limit:one?text().singleNote:text().multiLimit;
 $('thermalSource').textContent=mode==='nasa'?`${text().provenance}\n${cycle?.recordedAt||''} · ${text().sourceTime}\n${text().independent}`:`${text().importProvenance}\n${activeRecord()?.source||''} · ${activeRecord()?.timestamp||''}`;
 if(sim){$('thermalMapNote').textContent=text().simGeometry;$('thermalMapMeta').textContent=text().simMode;$('thermalMapAside').textContent=`4 × 4 · ${text().simRegion}`;$('thermalLimit').textContent=text().simLimit;$('thermalSource').textContent=text().simScope;}
 $('thermalError').hidden=!error;$('thermalError').textContent=text().error;
 $('thermalCycleLabel').textContent=mode==='nasa'?text().cycle:text().frame;
 $('thermalCycle').hidden=mode!=='nasa';$('thermalCycleLabel').hidden=mode!=='nasa';
 $('thermalCyclePrev').hidden=$('thermalCycleNext').hidden=mode!=='nasa';
 $('thermalCycle').innerHTML=summary?summary.cycles.map(c=>`<option value="${c.dischargeCycle}"${c.dischargeCycle===cycle?.dischargeCycle?' selected':''}>${c.dischargeCycle} / ${summary.cycles.length}</option>`).join(''):'';
 $('thermalDetails').disabled=mode!=='nasa'||!cycle;$('thermalHandover').disabled=!grid||sim;$('thermalHandover').title=sim?text().simScope:'';$('thermalZoom').textContent=zoom?text().unzoom:text().zoom;
 $('thermalSensorPick').hidden=$('thermalPickHint').hidden=one;
 if(grid)$('thermalSensorPick').max=grid.flat().length-1;
 updateSample();requestAnimationFrame(()=>{draw();drawHistory();});
}
function updateControls(){const empty=points().length<2||mode==='live'||loading;$('thermalPlay').disabled=empty;$('thermalPlay').textContent=timer?'Ⅱ':'▶';$('thermalPlay').setAttribute('aria-label',timer?text().pause:text().play);$('thermalPeak').disabled=empty;$('thermalScrub').disabled=empty;$('thermalScrub').setAttribute('aria-label',text().history);$('thermalMap').setAttribute('aria-label',text().mapTitle);$('thermalHistory').setAttribute('aria-label',`${text().history} · ${text().historyNote}`);$('thermalSensorPick').setAttribute('aria-label',text().selected);$('thermalStepPrev').disabled=empty||sample<=0;$('thermalStepNext').disabled=empty||sample>=points().length-1;$('thermalCycle').disabled=loading;$('thermalCyclePrev').disabled=loading||mode!=='nasa'||!cycle||cycle.dischargeCycle<=1;$('thermalCycleNext').disabled=loading||mode!=='nasa'||!cycle||cycle.dischargeCycle>=summary.cycles.length;for(const[id,key]of[['thermalStepPrev','previousSample'],['thermalStepNext','nextSample'],['thermalCyclePrev','previousCycle'],['thermalCycleNext','nextCycle']]){$(id).setAttribute('aria-label',text()[key]);$(id).title=text()[key];}}
function updateSample(){
 const grid=matrix(),a=assessment(),list=points();updateControls();
 const alert=thermalAlertKind(a);$('thermalEmergency').hidden=!alert;$('thermalEmergency').classList.toggle('warning',alert==='warning');
 if(alert){$('thermalEmergencyText').textContent=text()[alert==='danger'?'emergencyDanger':'emergencyWarning'];$('thermalEmergencyLimit').textContent=text().emergencyLimit;$('thermalEmergencyScope').textContent=mode==='nasa'||activeRecord()?.mode==='historical'?text().emergencyHistorical:mode==='live'&&(!liveOnline||(Date.now()-Date.parse(activeRecord().timestamp))/1000>15)?text().emergencyStale:text().snapshotScope;}
 if(alert&&mode==='simulation'){$('thermalEmergencyText').textContent=text()[alert==='danger'?'simDangerRule':'simWarningRule'];$('thermalEmergencyScope').textContent=text().simScope;}
 if(!grid||!a)return;
 if(selection.row>=grid.length||selection.col>=grid[0].length)selection={row:0,col:0};
 const value=grid[selection.row][selection.col],hot=hottestSensor(grid);
 $('thermalTemperature').textContent=value===null?'—':value.toFixed(2);
 $('thermalSelection').textContent=`${text().selected} ${selection.row+1} · ${selection.col+1}${value===null?' / '+text().missing:''}`;
 const isStale=mode==='live'&&(!liveOnline||(Date.now()-Date.parse(activeRecord().timestamp))/1000>15);
 $('thermalRuleResult').textContent=isStale?`${['danger','warning'].includes(a.thermal)?text()[a.thermal]+' · ':''}${text().stale}`:text()[a.thermal];$('thermalRuleResult').dataset.status=isStale&&a.thermal==='normal'?'unknown':a.thermal;
 if(mode==='simulation'){$('thermalRuleResult').textContent=text()[a.thermal==='danger'?'simDangerRule':a.thermal==='warning'?'simWarningRule':'simNormalRule'];$('thermalSelection').textContent=`${text().simRegion} ${selection.row+1} · ${selection.col+1}`;}
 const p=mode==='nasa'?cycle.samples[sample]:activeRecord();
 const values=mode==='simulation'?[[text().simPeak,`${a.peakC.toFixed(2)}°C`],[text().simRate,'0.000 °C/s'],[text().voltage,'—'],[text().current,'—'],[text().health,'—'],[text().simRegion,`${hot.row+1} · ${hot.col+1}`]]:mode==='nasa'?[[text().peak,`${cycle.tempMaxC.toFixed(2)}°C`],[text().rate,`${cycle.maxFiveSecondRiseCPerS.toFixed(3)}`],[text().voltage,`${p.v.toFixed(3)} V`],[text().current,`${p.a.toFixed(3)} A`],[text().health,`${cycle.sohPercent.toFixed(2)}%`],[text().hotspot,'1 · 1']]:[[text().hotspot,`${hot.row+1} · ${hot.col+1}`],[text().peak,`${a.peakC.toFixed(2)}°C`],[text().voltage,p.voltageV==null?'—':`${p.voltageV.toFixed(2)} V`],[text().current,p.currentA==null?'—':`${p.currentA.toFixed(2)} A`],[text().health,a.sohPercent===null?'—':`${a.sohPercent.toFixed(2)}%`],[text().missing,`${a.missingSensors}`]];
 $('thermalStats').innerHTML=values.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}${label===text().rate?' <small>°C/s</small>':''}</dd></div>`).join('');
 $('thermalPickHint').textContent=text().selectHint;
 $('thermalSensorPick').value=selection.row*grid[0].length+selection.col;
 $('thermalSensorPick').setAttribute('aria-valuetext',`${text().selected} ${selection.row+1}, ${selection.col+1}: ${value===null?text().missing:value.toFixed(2)+'°C'}`);
 $('thermalMap').setAttribute('aria-label',`${text().mapTitle}. ${text().selected} ${selection.row+1}, ${selection.col+1}: ${value===null?text().missing:value.toFixed(2)+'°C'}. ${text().selectHint}`);
 $('thermalScrub').max=Math.max(0,list.length-1);$('thermalScrub').value=sample;
 $('thermalElapsed').textContent=mode==='nasa'?`${clock(p.t)} / ${clock(list.at(-1).t)}`:`${sample+1} / ${Math.max(1,list.length)}`;
 $('thermalStart').textContent=mode==='nasa'?'00:00':'1';$('thermalEnd').textContent=mode==='nasa'?clock(list.at(-1).t):String(list.length||1);
 $('thermalHistoryNote').textContent=text().historyNote;
 $('thermalCaption')?.remove();
 const caption=document.createElement('p');caption.id='thermalCaption';caption.className='thermal-helper';caption.textContent=mode==='nasa'?text().cycleScope:text().snapshotScope;$('thermalStats').after(caption);
 if(mode==='simulation'){$('thermalHistoryNote').textContent=text().simSnapshot;caption.textContent=text().simScope;$('thermalPickHint').textContent=text().simHint;$('thermalSensorPick').setAttribute('aria-label',text().simRegion);$('thermalSensorPick').setAttribute('aria-valuetext',`${text().simRegion} ${selection.row+1}, ${selection.col+1}: ${value.toFixed(2)}°C`);$('thermalMap').setAttribute('aria-label',`${text().simMap}. ${text().simRegion} ${selection.row+1}, ${selection.col+1}: ${value.toFixed(2)}°C`);$('thermalHistory').setAttribute('aria-label',text().simSnapshot);}
 draw();drawHistory();
 persistState();
}
function modelFallback(){modelFailed=true;display3d=false;model3d?.setVisible(false);draw();}
async function ensureModel(){
 if(model3d||modelFailed||modelPromise)return;
 $('thermal3dStatus').hidden=false;$('thermal3dStatus').textContent=text().modelWaiting;
 modelPromise=import('./thermal-3d.mjs').then(({createThermalModel})=>{model3d=createThermalModel($('thermal3d'),{onPick:pickSensor,onFailure:modelFallback});draw();}).catch(modelFallback);
}
function draw(){
 if(view.hidden)return;const grid=matrix();
 const one=!grid||grid.flat().length===1;
 $('thermalMapTitle').textContent=display3d?(one?text().singleTitle:text().mapTitle):(one?text().sensor:text().flat);
 if(mode==='simulation')$('thermalMapTitle').textContent=text().simMap;
 $('thermalMap').hidden=display3d;$('thermal3d').hidden=!display3d;
 $('thermal3dButton').setAttribute('aria-pressed',String(display3d));$('thermal3dButton').disabled=modelFailed;
 $('thermal2dButton').setAttribute('aria-pressed',String(!display3d));
 view.querySelector('.thermal-camera-tools').hidden=!display3d;
 $('thermalModelHint').textContent=display3d?text().modelHint:text().selectHint;
 if(mode==='simulation')$('thermalModelHint').textContent=text().simMode;
 $('thermalZoomIn').setAttribute('aria-label',text().zoomIn);$('thermalZoomOut').setAttribute('aria-label',text().zoomOut);
 $('thermal3dStatus').hidden=!modelFailed&&(!display3d||Boolean(model3d));
 $('thermal3dStatus').textContent=modelFailed?text().fallback:text().modelWaiting;
 if(display3d){ensureModel();model3d?.setVisible(true);if(grid)model3d?.update(grid,selection,{simulated:mode==='simulation',model:mode==='simulation'?text().simModel:text().model,sensor:text().sensor,point:mode==='simulation'?text().simRegion:text().point,missing:text().noMeasurement,hint:mode==='simulation'?text().simMode:text().modelHint});}
 else {model3d?.setVisible(false);if(grid)bounds=drawSensorMap($('thermalMap'),grid,selection,{single:text().sensor,position:text().position,missing:text().noMeasurement});}
}
$('thermal3dButton').addEventListener('click',()=>{display3d=true;draw();persistState();});
$('thermal2dButton').addEventListener('click',()=>{display3d=false;draw();persistState();});
$('thermalReset').addEventListener('click',()=>model3d?.reset());
$('thermalTop').addEventListener('click',()=>model3d?.reset(true));
$('thermalZoomIn').addEventListener('click',()=>model3d?.zoom(.8));
$('thermalZoomOut').addEventListener('click',()=>model3d?.zoom(1.2));
function historyBounds(list,width){return list.map((p,i)=>({left:(i===0?0:(list[i-1].t+p.t)/2)/(list.at(-1).t||1)*width,right:(i===list.length-1?list.at(-1).t:(p.t+list[i+1].t)/2)/(list.at(-1).t||1)*width}));}
function drawHistory(){
 if(view.hidden)return;const canvas=$('thermalHistory'),{ctx,width,height}=fitThermalCanvas(canvas),list=points();ctx.clearRect(0,0,width,height);
 if(!list.length)return;
 if(list.length===1){ctx.fillStyle=temperatureColor(list[0].c);ctx.fillRect(0,0,width,height);return;}
 const cells=historyBounds(list,width);list.forEach((p,i)=>{ctx.fillStyle=temperatureColor(p.c);ctx.fillRect(cells[i].left,0,Math.ceil(cells[i].right-cells[i].left),height);});
 const selected=cells[sample],x=(selected.left+selected.right)/2;ctx.strokeStyle='#173b50';ctx.lineWidth=3;ctx.strokeRect(selected.left+1,1,Math.max(2,selected.right-selected.left-2),height-2);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x-5,0);ctx.lineTo(x+5,0);ctx.lineTo(x,7);ctx.fill();
}
function selectSample(index){pause();sample=Math.max(0,Math.min(points().length-1,index));updateSample();}
function pickSensor(row,col){const grid=matrix();if(!grid)return;selection={row:Math.max(0,Math.min(grid.length-1,row)),col:Math.max(0,Math.min(grid[0].length-1,col))};updateSample();}
$('thermalMap').addEventListener('click',event=>{const box=$('thermalMap').getBoundingClientRect(),picked=sensorAtPoint(bounds,event.clientX-box.left,event.clientY-box.top);if(picked)pickSensor(picked.row,picked.col);});
$('thermalMap').addEventListener('keydown',event=>{const move={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[event.key];if(move){event.preventDefault();pickSensor(selection.row+move[0],selection.col+move[1]);}});
$('thermalHistory').addEventListener('click',event=>{const box=$('thermalHistory').getBoundingClientRect(),cells=historyBounds(points(),box.width),x=event.clientX-box.left;selectSample(Math.max(0,cells.findIndex(bin=>x>=bin.left&&x<=bin.right)));});
$('thermalHistory').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();selectSample(event.key==='Home'?0:event.key==='End'?points().length-1:sample+(event.key==='ArrowLeft'?-1:1));}});
$('thermalSensorPick').addEventListener('input',event=>{const grid=matrix(),index=Number(event.target.value);pickSensor(Math.floor(index/grid[0].length),index%grid[0].length);});
$('thermalScrub').addEventListener('input',event=>selectSample(Number(event.target.value)));
$('thermalStepPrev').addEventListener('click',()=>selectSample(sample-1));
$('thermalStepNext').addEventListener('click',()=>selectSample(sample+1));
$('thermalCyclePrev').addEventListener('click',()=>load(cell,cycle.dischargeCycle-1));
$('thermalCycleNext').addEventListener('click',()=>load(cell,cycle.dischargeCycle+1));
function enterSim(type){
 if(mode==='nasa'&&cycle){persistState();nasaResume={cell,cycle:cycle.dischargeCycle,sample,display3d};}
 pause();request++;loading=false;error=false;view.classList.remove('thermal-loading');view.setAttribute('aria-busy','false');simulation=buildSimulation(type);mode='simulation';records=[];sample=0;selection={row:2,col:2};render();
}
for(const[id,type]of[['thermalSimNormal','normal'],['thermalSimWarning','warning'],['thermalSimDanger','danger']])$(id).addEventListener('click',()=>enterSim(type));
$('thermalSimReturn').addEventListener('click',()=>{let saved=nasaResume;try{saved||=readThermalState(sessionStorage);}catch{}load(saved?.cell||cell,saved?.cycle||null,saved);});
$('thermalPlay').addEventListener('click',()=>{if(timer){pause();return;}if(sample>=points().length-1)sample=0;timer=setInterval(()=>{sample++;if(sample>=points().length-1){sample=points().length-1;pause();}updateSample();},160);updateControls();});
$('thermalPeak').addEventListener('click',()=>{selectSample(peakIndex());const hot=hottestSensor(matrix());selection={row:hot.row,col:hot.col};updateSample();});
$('thermalCycle').addEventListener('change',event=>load(cell,Number(event.target.value)));
$('thermalZoom').addEventListener('click',()=>{zoom=!zoom;view.classList.toggle('thermal-zoom',zoom);$('thermalZoom').textContent=zoom?text().unzoom:text().zoom;requestAnimationFrame(draw);});
$('thermalImport').addEventListener('click',()=>$('opsFile').click());
$('thermalDetails').addEventListener('click',async()=>{pause();await bridge.openDetails(cell,cycle.dischargeCycle);});
$('thermalHandover').addEventListener('click',()=>{
 if(mode==='simulation')return;
 pause();let report;
 if(mode==='nasa')report=buildNasaReport(cell,cycle,sample);
 else {report=createReport(activeRecord(),assessment());if(mode==='import'&&sample>0)report.previousMeasurement=records[sample-1];}
 window.dispatchEvent(new CustomEvent('voltguard-report-request',{detail:report}));$('operationsTab').click();
});
window.addEventListener('voltguard-thermal-import',event=>{request++;loading=false;view.classList.remove('thermal-loading');pause();records=event.detail.records;mode='import';sample=records.length-1;const hot=hottestSensor(matrix());selection={row:hot.row,col:hot.col};show();});
window.addEventListener('voltguard-thermal-nasa',async event=>{pause();const record=event.detail;if(await load(record.cell,record.cycle)){if(Number.isFinite(record.elapsed))sample=cycle.samples.reduce((best,p,i)=>Math.abs(p.t-record.elapsed)<Math.abs(cycle.samples[best].t-record.elapsed)?i:best,0);show();}});
window.addEventListener('voltguard-live',event=>{liveOnline=event.detail.online;if(mode==='live'){liveRecord=event.detail.records.find(r=>r.record.assetId===liveRecord?.record.assetId)||liveRecord;updateSample();}});
window.addEventListener('voltguard-thermal-live',event=>{pause();request++;loading=false;view.classList.remove('thermal-loading');liveRecord=event.detail.report;liveOnline=event.detail.online;mode='live';records=[];sample=0;const hot=hottestSensor(matrix());selection={row:hot.row,col:hot.col};show();});
window.addEventListener('voltguard-language',render);
window.addEventListener('resize',()=>{draw();drawHistory();});
const defaultView=()=>{if(bridge.view==='thermal')show();};
window.addEventListener('voltguard-ready',defaultView);if(bridge.ready)defaultView();else render();
setInterval(()=>{if(mode==='live'&&!view.hidden)updateSample();},3000);

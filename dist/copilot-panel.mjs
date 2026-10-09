import {getOperationsContext} from './operations.mjs';
import {retrieveGuidance} from './guidance.mjs';
const bridge=window.voltguard;
const copy={
 en:{title:'Evidence assistant',sub:'Source guidance and optional AI explanation',sources:'Official source guidance',query:'Search guidance',placeholder:'Try “fire”, “escape” or “999”',search:'Search sources',method:'Curated keyword search, not a generated answer. Two official pages, checked 3 October 2026.',empty:'No matching source in this small collection. Check the official guidance directly.',checked:'Checked',scope:'Scope',ai:'AI evidence explanation',unconfigured:'Local AI key not configured. No model has analyzed this record.',public:'This public site has no AI service. Use the local service after configuring a key.',ready:'Local API key detected. Provider access has not yet been verified.',privacy:'On request, send measured values, rule results and a generated sensor-index image to OpenAI. Hardware aliases, source text, timestamps and location are excluded. API retention policies still apply even with store:false.',consent:'I authorize sending this measurement to OpenAI for an explanation.',run:'Explain this record',loading:'Reviewing the measured evidence…',noRecord:'Select a valid record first.',limit:'AI cannot change the rule result, clear an alarm or confirm battery safety. A person must review the explanation.',failed:'AI unavailable or its output could not be validated. Existing rules and measured evidence remain in effect.',rule:'Rule result retained',evidence:'Referenced evidence',uncertainty:'Limitations',cached:'Cached explanation',fresh:'New explanation',human:'Human review required',single_sensor:'Only one temperature channel is available.',unknown_physical_layout:'Sensor coordinates and physical pack layout are unverified.',historical_lab_data:'Historical laboratory data does not establish current vehicle condition.',unverified_import:'The source of supplied measurements is not independently verified.',missing_rate:'A comparable temperature rise rate is unavailable.',missing_sensors:'Some sensor measurements are missing.',not_vehicle_validated:'Prototype rules lack vehicle-specific validation.',not_fire_prediction:'This explanation does not predict a fire.',stale_or_future:'The live timestamp is stale or in the future.',thermal:'Thermal',maintenance:'Maintenance',quality:'Evidence quality',normal:'No thermal threshold crossed',warning:'Thermal warning',danger:'Thermal escalation',unknown:'Insufficient evidence',review:'Capacity review',watch:'Capacity observation',historical:'Historical',current:'Current',stale:'Stale',future:'Future timestamp',partial:'Partial'},
 zh:{title:'證據助理',sub:'官方資料與可選的 AI 解讀',sources:'官方指引檢索',query:'搜尋指引',placeholder:'例如「火警」、「逃生」或「999」',search:'搜尋資料',method:'精選關鍵字檢索，不是生成答案。收錄兩個官方頁面，核對日期為 2026 年 10 月 3 日。',empty:'這個小型資料庫沒有符合的來源，請直接查閱官方指引。',checked:'核對日期',scope:'適用範圍',ai:'AI 證據解讀',unconfigured:'本地 AI 密鑰尚未配置；模型沒有分析此記錄。',public:'公開網站未連接 AI 服務；配置密鑰後請使用本地服務。',ready:'偵測到本地 API 密鑰，但尚未驗證供應商連線。',privacy:'按要求將量測值、規則結果及由測點生成的索引圖傳送至 OpenAI。不傳送硬件代號、來源文字、時間戳或位置。即使使用 store:false，仍適用 API 資料保留政策。',consent:'我同意把此量測傳送至 OpenAI 作解讀。',run:'解讀此記錄',loading:'正在覆核量測證據…',noRecord:'請先選擇有效記錄。',limit:'AI 不能改寫規則判定、解除警報或確認電池安全；解讀須由人員覆核。',failed:'AI 未能使用，或輸出未通過驗證。現有規則與量測證據仍然有效。',rule:'保留規則判定',evidence:'引用的量測證據',uncertainty:'限制與缺失',cached:'快取解讀',fresh:'新解讀',human:'須由人員覆核',single_sensor:'只有一個溫度通道。',unknown_physical_layout:'尚未核實測點座標及實體電池配置。',historical_lab_data:'歷史實驗資料不能代表車輛當前狀態。',unverified_import:'未能獨立核實所提供量測的來源。',missing_rate:'缺少可比較的溫升率。',missing_sensors:'部分測點缺少量測。',not_vehicle_validated:'原型規則未經特定車型驗證。',not_fire_prediction:'此解讀不會預測火警。',stale_or_future:'即時時間戳已過期或位於未來。',thermal:'熱狀態',maintenance:'維護狀態',quality:'證據品質',normal:'未跨越熱閾值',warning:'熱異常提示',danger:'需升級處理',unknown:'證據不足',review:'容量維護',watch:'容量觀察',historical:'歷史資料',current:'即時資料',stale:'已過期',future:'未來時間戳',partial:'不完整'}
};
const c=()=>copy[bridge.language],el=id=>document.getElementById(id);
Object.assign(copy.en,{verified:'A response was received this session. Select a record and authorize another explanation when needed.',onboarding:'First use: select a measured record → check the consent box → explain. No automatic AI calls are made.',dismissGuide:'Got it',badgePublic:'AI · No service',badgeUnconfigured:'AI · Not configured',badgeConfigured:'AI · Unverified',badgeVerified:'AI · Responded',badgeBusy:'AI · Reviewing',badgeFailed:'AI · Unavailable',badgeOffline:'AI · Offline'});
Object.assign(copy.zh,{verified:'本次工作階段已收到回覆；如需再次解讀，請選擇記錄並授權。',onboarding:'首次使用：選擇實測記錄 → 勾選同意 → 解讀。系統不會自動呼叫 AI。',dismissGuide:'知道了',badgePublic:'AI · 無服務',badgeUnconfigured:'AI · 未配置',badgeConfigured:'AI · 未驗證',badgeVerified:'AI · 已回覆',badgeBusy:'AI · 解讀中',badgeFailed:'AI · 未能使用',badgeOffline:'AI · 離線'});
const panel=document.createElement('details');panel.id='copilotPanel';panel.className='sheet copilot-panel';
panel.innerHTML='<summary><span><strong id="cpTitle"></strong><small id="cpSub"></small></span><span aria-hidden="true">+</span></summary><div class="copilot-layout"><section><h2 id="cpSourcesTitle"></h2><form id="cpSearchForm"><label for="cpQuery" id="cpQueryLabel"></label><div class="copilot-search"><input id="cpQuery" type="search" maxlength="240"><button class="ops-button" id="cpSearch" type="submit"></button></div></form><p class="copilot-meta" id="cpMethod"></p><div id="cpSources" aria-live="polite"></div></section><section class="copilot-ai"><h2 id="cpAiTitle"></h2><p id="cpStatus" role="status"></p><p class="copilot-meta" id="cpPrivacy"></p><label class="copilot-consent"><input type="checkbox" id="cpConsent"><span id="cpConsentText"></span></label><button class="ops-button primary" id="cpRun" type="button" disabled></button><p class="copilot-meta" id="cpLimit"></p><div id="cpResult" aria-live="polite"></div></section></div>';
document.querySelector('.ops-events').before(panel);
el('cpStatus').insertAdjacentHTML('afterend','<div id="cpOnboarding" class="copilot-onboarding" hidden><p id="cpOnboardingText"></p><button type="button" class="ops-button" id="cpDismissGuide"></button></div>');
const aiBadge=document.createElement('button');aiBadge.id='aiStatusDot';aiBadge.type='button';aiBadge.className='ai-status-badge';aiBadge.setAttribute('aria-controls','copilotPanel');document.querySelector('.mast-actions').append(aiBadge);
let seen=false,guideShown=false,verified=false;try{seen=sessionStorage.getItem('vg-copilot-seen')==='1';}catch{}
function dismissGuide(){seen=true;guideShown=false;try{sessionStorage.setItem('vg-copilot-seen','1');}catch{}sync();}
el('cpDismissGuide').addEventListener('click',()=>{dismissGuide();el('cpConsent').focus();});
panel.addEventListener('toggle',()=>{if(!panel.open&&guideShown)dismissGuide();else sync();});
aiBadge.addEventListener('click',()=>{document.getElementById('operationsTab').click();panel.open=true;panel.scrollIntoView({block:'start'});panel.querySelector('summary').focus();});
let result=null,busy=false,error=false,controller=null,sequence=0,fingerprint='';
function sync(){
 const ctx=getOperationsContext(),next=JSON.stringify({report:ctx.report,loading:ctx.loading,language:bridge.language,backendAvailable:ctx.backendAvailable,aiConfigured:ctx.aiConfigured});
 if(!ctx.backendAvailable||!ctx.aiConfigured)verified=false;
 if(next!==fingerprint){fingerprint=next;sequence++;controller?.abort();result=null;busy=false;error=false;el('cpConsent').checked=false;}
 for(const[id,key]of[['cpTitle','title'],['cpSub','sub'],['cpSourcesTitle','sources'],['cpAiTitle','ai'],['cpQueryLabel','query'],['cpSearch','search'],['cpMethod','method'],['cpPrivacy','privacy'],['cpConsentText','consent'],['cpLimit','limit']])el(id).textContent=c()[key];
 el('cpQuery').placeholder=c().placeholder;
 el('cpStatus').textContent=busy?c().loading:error?c().failed:result?c().human:!ctx.backendAvailable?c().public:!ctx.aiConfigured?c().unconfigured:!ctx.report||ctx.loading?c().noRecord:verified?c().verified:c().ready;
 const badge=busy?'Busy':!navigator.onLine?'Offline':!ctx.backendAvailable?'Public':!ctx.aiConfigured?'Unconfigured':error?'Failed':verified?'Verified':'Configured';aiBadge.textContent=c()['badge'+badge];aiBadge.dataset.state=badge.toLowerCase();aiBadge.title=busy?c().loading:badge==='Verified'?c().verified:badge==='Configured'?c().ready:el('cpStatus').textContent;
 aiBadge.setAttribute('aria-expanded',String(panel.open&&!document.getElementById('operationsView').hidden));
 el('cpOnboarding').hidden=!panel.open||seen||!ctx.backendAvailable||!ctx.aiConfigured;guideShown=!el('cpOnboarding').hidden;el('cpOnboardingText').textContent=c().onboarding;el('cpDismissGuide').textContent=c().dismissGuide;
 el('cpConsent').disabled=!navigator.onLine||!ctx.backendAvailable||!ctx.aiConfigured||!ctx.report||ctx.loading||busy;
 el('cpRun').disabled=el('cpConsent').disabled||!el('cpConsent').checked;
 el('cpRun').textContent=busy?c().loading:c().run;panel.setAttribute('aria-busy',String(busy));
 renderSources();renderResult();
}
function renderSources(){
 const hits=retrieveGuidance(el('cpQuery').value,bridge.language).results,list=el('cpSources');list.replaceChildren();
 if(!hits.length){const p=document.createElement('p');p.textContent=c().empty;list.append(p);return;}
 for(const hit of hits){const item=document.createElement('article');item.className='copilot-source';const link=document.createElement('a');link.href=hit.url;link.target='_blank';link.rel='noreferrer';link.textContent=hit.title;const p=document.createElement('p');p.textContent=hit.summary;const note=document.createElement('small');note.textContent=`${c().scope}: ${hit.scope} ${c().checked}: ${hit.checkedAt}`;item.append(link,p,note);list.append(item);}
}
function renderResult(){
 const root=el('cpResult');root.replaceChildren();if(!result)return;
 const meta=document.createElement('p');meta.className='copilot-meta';meta.textContent=`${c()[result.cached?'cached':'fresh']} · ${result.model} · ${result.latencyMs} ms · ${c().human}`;
 const p=document.createElement('p');p.className='copilot-explanation';p.textContent=result.explanation.explanation;
 const rule=document.createElement('p');rule.textContent=`${c().rule}: ${c().thermal} ${c()[result.ruleStatus.thermal]}, ${c().maintenance} ${c()[result.ruleStatus.maintenance]}, ${c().quality} ${c()[result.ruleStatus.quality]}`;
 const refs=document.createElement('p');refs.className='copilot-meta';refs.textContent=`${c().evidence}: ${result.explanation.evidence_ids.join(', ')}`;
 const h=document.createElement('h3');h.textContent=c().uncertainty;const ul=document.createElement('ul');for(const code of result.explanation.uncertainty_codes){const li=document.createElement('li');li.textContent=c()[code];ul.append(li);}
 root.append(meta,p,rule,refs,h,ul);
 for(const source of result.guidance.results.filter(s=>result.explanation.source_ids.includes(s.id))){const a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noreferrer';root.append(a);}
}
el('cpSearchForm').addEventListener('submit',event=>{event.preventDefault();renderSources();});
el('cpConsent').addEventListener('change',sync);
el('cpRun').addEventListener('click',async()=>{
 const ctx=getOperationsContext();if(!ctx.report||!el('cpConsent').checked||!ctx.aiConfigured||busy)return;
 const attempt=++sequence;controller=new AbortController();busy=true;error=false;result=null;sync();const timeout=setTimeout(()=>controller.abort(),16000);
 try{const response=await fetch('/api/copilot/diagnose',{method:'POST',headers:{'Content-Type':'application/json','X-VoltGuard-CSRF':ctx.csrf},signal:controller.signal,body:JSON.stringify({report:ctx.report,language:bridge.language,consent:true})});if(!response.ok)throw new Error('AI_UNAVAILABLE');const data=await response.json();if(attempt!==sequence)return;if(data.schemaVersion!=='voltguard-copilot-1'||!data.humanReviewRequired)throw new Error('AI_RESPONSE');result=data;verified=true;dismissGuide();}
 catch{if(attempt===sequence){error=true;verified=false;}}
 finally{clearTimeout(timeout);if(attempt===sequence){busy=false;sync();}}
});
window.addEventListener('voltguard-review-context',sync);
window.addEventListener('voltguard-view',()=>queueMicrotask(sync));
window.addEventListener('voltguard-language',()=>{el('cpQuery').value='';sync();});
window.addEventListener('offline',()=>{sequence++;controller?.abort();busy=false;result=null;verified=false;error=true;sync();});
window.addEventListener('online',sync);
sync();

// Curated paraphrases, not emergency procedures or live legal advice.
// Source contents checked on 2026-10-03. Recheck before operational use.
export const GUIDANCE_VERSION='hk-fsd-2026-10-03';
export const GUIDANCE=Object.freeze([
 {id:'fsd-call',checkedAt:'2026-10-03',publisher:'Hong Kong Fire Services Department',
  url:'https://www.hkfsd.gov.hk/eng/fire_ambulance_services/fire_information.html',
  zhUrl:'https://www.hkfsd.gov.hk/chi/fire_ambulance_services/fire_information.html',
  title:{en:'Information for emergency calls',zh:'召喚消防及救護服務應提供資料'},
  summary:{en:'For an actual emergency, call 999. Give the location, contact number, incident type and observed conditions. Answer the dispatcher’s questions.',zh:'遇有實際緊急事故，致電 999。提供位置、聯絡電話、事故類別及所見情況，並按接線員提問提供資料。'},
  scope:{en:'Emergency reporting. A software threshold alone does not establish a fire.',zh:'適用於緊急事故通報。單憑軟件閾值不能確定發生火警。'},
  terms:['999','call','fire','emergency','report','smoke','danger','消防','報警','火警','緊急','煙','危險']},
 {id:'fsd-escape',checkedAt:'2026-10-03',publisher:'Hong Kong Fire Services Department',
  url:'https://www.hkfsd.gov.hk/eng/education/cep_edu/cep/cep_3skill_index/cep_3skill_escape/fire_escape.html',
  zhUrl:'https://www.hkfsd.gov.hk/chi/education/cep_edu/cep/cep_3skill_index/cep_3skill_escape/fire_escape.html',
  title:{en:'Building fire escape',zh:'大廈火警逃生'},
  summary:{en:'Know the building’s escape routes and emergency plan. Do not use lifts during a fire. Report an actual fire from a safe location.',zh:'熟悉大廈逃生路線及應變計劃。火警時不要使用升降機；到達安全地點後報告實際火警。'},
  scope:{en:'General building guidance. It does not specify EV firefighting, a universal exclusion radius or ventilation settings.',zh:'一般大廈指引，並未訂明電動車滅火方法、通用隔離距離或通風操作。'},
  terms:['escape','evacuation','lift','building','fire','emergency','danger','逃生','疏散','升降機','大廈','火警','緊急','危險']}
]);
export function retrieveGuidance(query='',language='en'){
 if(typeof query!=='string'||query.length>240)throw new Error('QUERY');
 const lang=language==='zh'?'zh':'en',text=query.trim().toLowerCase();
 const hits=GUIDANCE.map(item=>({item,score:item.terms.filter(term=>text.includes(term)).length})).filter(hit=>!text||hit.score>0).sort((a,b)=>b.score-a.score);
 return {version:GUIDANCE_VERSION,method:'curated_keyword_retrieval',checkedAt:'2026-10-03',results:hits.map(({item,score})=>({id:item.id,publisher:item.publisher,title:item.title[lang],summary:item.summary[lang],scope:item.scope[lang],url:lang==='zh'?item.zhUrl:item.url,checkedAt:item.checkedAt,score}))};
}

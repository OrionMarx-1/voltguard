import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildNasaReport} from '../dist/evidence.mjs';
import {createCopilot,CopilotError} from '../backend/copilot.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// Rate limit in copilot.mjs rejects a second provider call within 5 s.
export async function runLiveCheck({copilot,report,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const steps=[];
 const call=async(name,language)=>{
  try{const r=await copilot.diagnose(report,language);steps.push({name,language,ok:true,cached:r.cached,latencyMs:Math.round(r.latencyMs),model:r.model,explanation:r.explanation,limitations:r.limitations});}
  catch(error){steps.push({name,language,ok:false,error:error instanceof CopilotError?error.code:'UNEXPECTED_ERROR'});}
 };
 if(!copilot.configured)return {ok:false,error:'AI_NOT_CONFIGURED',steps};
 await call('en-first','en');
 await call('en-repeat-cache','en');
 await wait(5500);
 await call('zh-first','zh');
 const ok=steps.every(s=>s.ok)&&steps[0].cached===false&&steps[1].cached===true&&steps[2].cached===false;
 return {ok,steps};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const envFile=path.join(root,'.env');
 if(existsSync(envFile))process.loadEnvFile(envFile);
 const apiKey=process.env.OPENAI_API_KEY||'';
 const cycle=JSON.parse(await readFile(path.join(root,'dist/data/cells/b0005/cycles/168.json'),'utf8'));
 const result={checkedAt:new Date().toISOString(),record:'NASA B0005 cycle 168 sample 0',...await runLiveCheck({copilot:createCopilot({apiKey}),report:buildNasaReport('B0005',cycle,0)})};
 const text=JSON.stringify(result,null,1);
 if(apiKey&&text.includes(apiKey))throw new Error('Refusing to print output containing the API key');
 const outDir=path.join(root,'.sites-runtime','live-copilot');await mkdir(outDir,{recursive:true});
 const outFile=path.join(outDir,result.checkedAt.replace(/[:.]/g,'-')+'.json');await writeFile(outFile,text);
 console.log(text);console.log('saved: '+outFile);
 process.exitCode=result.ok?0:1;
}

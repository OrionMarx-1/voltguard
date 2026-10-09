import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),require=createRequire(path.join(process.env.RUNTIME_NODE_MODULES,'runtime.cjs'));
const {PresentationFile,FileBlob}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const deck=await PresentationFile.importPptx(await FileBlob.load(path.join(root,'pitch/pitch-deck.pptx'))),out=path.join(root,'.sites-runtime/pitch-build/final');await fs.mkdir(out,{recursive:true});
for(let i=0;i<deck.slides.items.length;i++){const img=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(out,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await img.arrayBuffer()));}
console.log(JSON.stringify({renderedFinalSlides:deck.slides.items.length,output:out}));

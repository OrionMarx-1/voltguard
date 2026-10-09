import {deflateSync} from 'node:zlib';
const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
function chunk(type,data){const tag=Buffer.from(type),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([size,tag,data,check]);}
// Rectangular SENSOR INDEX image derived only from validated measurements.
// No interpolation, inferred location, labels, identifiers or user image uploads.
export function measuredHeatmap(matrix){
 const rows=matrix.length,cols=matrix[0].length,unit=8,w=cols*unit,h=rows*unit,raw=Buffer.alloc(h*(1+w*3));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=matrix[Math.floor(y/unit)][Math.floor(x/unit)],s=t===null?null:Math.max(0,Math.min(1,(t-20)/60));
  const rgb=s===null?[184,193,199]:s<.5?[Math.round(26+430*s),Math.round(151+120*s),Math.round(180-320*s)]:[241,Math.round(211-340*(s-.5)),Math.round(20+64*(s-.5))];
  const p=y*(1+w*3)+1+x*3;for(let i=0;i<3;i++)raw[p+i]=rgb[i];
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}

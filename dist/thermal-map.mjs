// Continuous, fixed temperature palette. Color encodes temperature, not incident probability.
const stops = [[20,[43,112,172]],[30,[45,167,178]],[40,[231,188,80]],[60,[231,124,50]],[80,[194,64,65]]];
export function temperatureColor(value) {
  if(value===null || !Number.isFinite(value)) return '#e5eaed';
  const bounded=Math.min(80,Math.max(20,value));
  for(let i=1;i<stops.length;i++) {
    const [end,to]=stops[i], [start,from]=stops[i-1];
    if(bounded<=end) {const ratio=(bounded-start)/(end-start);return `rgb(${from.map((v,j)=>Math.round(v+(to[j]-v)*ratio)).join(',')})`;}
  }
}
export function hottestSensor(matrix) {
  let best=null;
  matrix.forEach((row,r)=>row.forEach((value,col)=>{if(value!==null && (best===null || value>best.value))best={row:r,col,value};}));
  return best;
}
export function fitThermalCanvas(canvas) {
  const box=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,width:box.width,height:box.height};
}
export function drawSensorMap(canvas,matrix,selection,{missing='No measurement',single='Measured point',position='Sensor location not specified'}={}) {
  const {ctx,width,height}=fitThermalCanvas(canvas);
  ctx.clearRect(0,0,width,height);
  const rows=matrix.length,cols=matrix[0].length,one=rows*cols===1;
  const pad=one?34:28,availableW=width-pad*2,availableH=height-pad*2;
  const unit=Math.min(availableW/cols,availableH/rows,one?170:100);
  const mapW=unit*cols,mapH=unit*rows,left=(width-mapW)/2,top=(height-mapH)/2-(one?32:0),gap=unit>18?4:1;
  if(one) {
    // A symbolic one-channel frame, not a vehicle pack geometry or interpolated thermal field.
    ctx.strokeStyle='#c7d2d8';ctx.lineWidth=1.5;ctx.setLineDash([5,6]);
    ctx.strokeRect(Math.max(16,left-60),Math.max(12,top-34),Math.min(width-32,mapW+120),mapH+68);ctx.setLineDash([]);
  }
  matrix.forEach((row,r)=>row.forEach((value,col)=>{
    const x=left+col*unit+gap/2,y=top+r*unit+gap/2,size=unit-gap;
    ctx.fillStyle=temperatureColor(value);ctx.beginPath();ctx.roundRect(x,y,size,size,Math.min(9,size/10));ctx.fill();
    if(value===null){ctx.save();ctx.beginPath();ctx.rect(x,y,size,size);ctx.clip();ctx.strokeStyle='#c5cfd4';ctx.lineWidth=1;for(let i=-size;i<size*2;i+=10){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i+size,y+size);ctx.stroke();}ctx.restore();}
    if(size>38) {ctx.fillStyle='#102d3b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.min(one?36:19,size/3.5)}px Consolas, monospace`;ctx.fillText(value===null?'—':value.toFixed(1)+'°',x+size/2,y+size/2);}
    if(size>70){ctx.font='12px system-ui';ctx.fillStyle='#143747';ctx.fillText(`${r+1} · ${col+1}`,x+size/2,y+size-18);}
    if(selection?.row===r&&selection?.col===col){ctx.strokeStyle='#153b4d';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x-2,y-2,size+4,size+4,10);ctx.stroke();}
  }));
  if(one){ctx.textAlign='center';ctx.fillStyle='#43606e';ctx.font='13px system-ui';ctx.fillText(single,width/2,top+mapH+58);ctx.fillStyle='#718694';ctx.font='12px system-ui';ctx.fillText(position,width/2,top+mapH+80);}
  return {left,top,unit,rows,cols};
}
export function sensorAtPoint(bounds,x,y) {
  if(!bounds)return null;
  const col=Math.floor((x-bounds.left)/bounds.unit),row=Math.floor((y-bounds.top)/bounds.unit);
  return col>=0&&col<bounds.cols&&row>=0&&row<bounds.rows?{row,col}:null;
}

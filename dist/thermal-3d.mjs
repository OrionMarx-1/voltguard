import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {temperatureColor} from './thermal-map.mjs';

// Geometry is illustrative. The renderer never generates/interpolates temperatures.
// Caller-supplied demo values are explicitly flagged separately from measurements.
export function createThermalModel(host, {onPick, onFailure}) {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0xf7fafc);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.className='thermal-webgl';
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,300);
  const controls=new OrbitControls(camera,canvas);
  controls.enablePan=false;controls.enableDamping=false;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI*.87;
  scene.add(new THREE.HemisphereLight(0xffffff,0x91a5b2,2.8));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(3,7,5);scene.add(key);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.001;
  const fill=new THREE.DirectionalLight(0xd0e9ff,1.6);fill.position.set(-6,2,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0xf0f5f8,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-1.12;scene.add(floor);
  floor.receiveShadow=true;
  const gridlines=new THREE.GridHelper(100,100,0xd2dfe7,0xe2eaf0);gridlines.position.y=-1.11;scene.add(gridlines);
  let model=null,sensors=null,outline=null,shape='',rows=0,cols=0,grid=null,selection={row:0,col:0},radius=5,visible=true,failed=false;
  const transform=new THREE.Object3D(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),anchor=new THREE.Vector3();
  const label=document.createElement('div');label.className='thermal-model-label';host.append(label);
  const pointPositions=[];
  const material=(color,metalness=.1)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.38});
  function mesh(geometry,mat,x=0,y=0,z=0){const item=new THREE.Mesh(geometry,mat);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;model.add(item);return item;}
  function disposeModel(){if(!model)return;const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(model);}
  function build(single){
    disposeModel();model=new THREE.Group();scene.add(model);pointPositions.length=0;
    if(single){
      radius=4.4;
      const body=mesh(new THREE.CylinderGeometry(.78,.78,5.2,72),material(0xc2cdd5,.68));body.rotation.z=Math.PI/2;
      for(const x of [-2.55,2.55]){
        const ring=mesh(new THREE.TorusGeometry(.78,.035,12,64),material(0x8195a3,.65),x);ring.rotation.y=Math.PI/2;
        const cap=mesh(new THREE.CylinderGeometry(.68,.68,.08,64),material(0xe2e8eb,.7),x);cap.rotation.z=Math.PI/2;
      }
      const terminal=mesh(new THREE.CylinderGeometry(.33,.33,.13,48),material(0xa1b1bc,.75),2.68);terminal.rotation.z=Math.PI/2;
      // A small point anchor, NOT an assertion about the actual thermocouple location.
      const sensorGeometry=new THREE.SphereGeometry(.13,24,16);
      sensors=new THREE.InstancedMesh(sensorGeometry,material(0xffffff,0),1);model.add(sensors);
      pointPositions.push(new THREE.Vector3(0,.35,.74));
      outline=mesh(new THREE.TorusGeometry(.19,.015,8,48),material(0x173b50,0),0,.35,.78);
      const seam=mesh(new THREE.TorusGeometry(.783,.009,8,64),material(0x9aadb9),-2.3);seam.rotation.y=Math.PI/2;
      host.dataset.geometry='single-cell';
    }else{
      const width=cols*1.14,depth=rows*1.14;radius=Math.max(width,depth)*.73+2.2;
      mesh(new THREE.BoxGeometry(width+.55,.28,depth+.55),material(0xa5b5c1,.55),0,-.9);
      mesh(new THREE.BoxGeometry(width+.65,.22,.1),material(0x6d8698,.55),0,-.65,(depth+.55)/2);
      mesh(new THREE.BoxGeometry(width+.65,.22,.1),material(0x6d8698,.55),0,-.65,-(depth+.55)/2);
      for(const x of [-(width+.55)/2,(width+.55)/2])mesh(new THREE.BoxGeometry(.1,.22,depth+.55),material(0x6d8698,.55),x,-.65);
      const modules=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.7,1),material(0xc1ccd4,.4),rows*cols);modules.castShadow=true;modules.receiveShadow=true;model.add(modules);
      sensors=new THREE.InstancedMesh(new THREE.BoxGeometry(.94,.035,.94),material(0xffffff,0),rows*cols);model.add(sensors);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const index=r*cols+c,x=(c-(cols-1)/2)*1.14,z=(r-(rows-1)/2)*1.14;
        transform.position.set(x,-.39,z);transform.updateMatrix();modules.setMatrixAt(index,transform.matrix);
        pointPositions.push(new THREE.Vector3(x,-.022,z));
      }
      outline=mesh(new THREE.BoxGeometry(1.025,.045,1.025),material(0x173b50,0));
      host.dataset.geometry='sensor-grid';
    }
    Object.assign(key.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,far:radius*6});key.shadow.camera.updateProjectionMatrix();
    key.position.set(radius*.7,radius*1.6,radius);sensors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);reset();
  }
  function reset(top=false){
    controls.target.set(0,-.1,0);
    camera.position.set(top?0:radius*.86,top?radius*2:radius*.7,top?.001:radius*1.38);
    controls.minDistance=radius*.55;controls.maxDistance=radius*4;camera.far=Math.max(300,radius*12);camera.updateProjectionMatrix();controls.update();render();
  }
  function render(){
    if(failed||!visible||host.hidden||host.getBoundingClientRect().width===0)return;
    try{renderer.render(scene,camera);}catch{fail();return;}
    if(grid){
      const value=grid[selection.row]?.[selection.col],position=pointPositions[selection.row*cols+selection.col];
      if(position){anchor.copy(position).project(camera);label.style.left=`${Math.max(10,Math.min(88,(anchor.x*.5+.5)*100))}%`;label.style.top=`${Math.max(18,Math.min(74,(-anchor.y*.5+.5)*100))}%`;label.hidden=anchor.z>1||anchor.z< -1;}
      label.querySelector('strong')?.setAttribute('data-value',value===null?'missing':String(value));
    }
    host.dataset.camera=camera.position.toArray().map(n=>n.toFixed(3)).join(',');
  }
  function resize(){if(host.hidden)return;const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=Math.min(100,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(36)/2)*Math.max(1,1.45/camera.aspect))));camera.updateProjectionMatrix();render();}
  function fail(){if(failed)return;failed=true;onFailure();}
  controls.addEventListener('change',render);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail();});
  const observer=new ResizeObserver(resize);observer.observe(host);
  let down=null;
  canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
  canvas.addEventListener('pointerup',event=>{
    if(!grid||!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;
    const box=canvas.getBoundingClientRect();pointer.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);
    raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(sensors)[0];
    if(hit?.instanceId!==undefined)onPick(Math.floor(hit.instanceId/cols),hit.instanceId%cols);
  });
  canvas.addEventListener('keydown',event=>{
    const delta={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[event.key];
    if(delta){event.preventDefault();onPick(selection.row+delta[0],selection.col+delta[1]);}
    if(event.key==='Home'){event.preventDefault();reset();}
    if(['+','=','-'].includes(event.key)){event.preventDefault();zoom(event.key==='-'?1.2:.8);}
  });
  function zoom(factor){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor).clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();render();}
  return {
    update(next,picked,copy){
      grid=next;selection=picked;rows=next.length;cols=next[0].length;const key=`${rows}x${cols}`;
      if(shape!==key){shape=key;build(rows*cols===1);}
      let measured=0;
      next.forEach((row,r)=>row.forEach((value,c)=>{
        const i=r*cols+c;transform.position.copy(pointPositions[i]);transform.updateMatrix();sensors.setMatrixAt(i,transform.matrix);
        sensors.setColorAt(i,new THREE.Color(temperatureColor(value)));if(value!==null)measured++;
      }));
      sensors.instanceMatrix.needsUpdate=true;sensors.instanceColor.needsUpdate=true;
      // Instance transforms invalidate the bound used by culling AND ray picking.
      sensors.computeBoundingSphere();
      const position=pointPositions[picked.row*cols+picked.col];outline.position.copy(position);outline.position.y-=rows*cols===1?0:.06;
      if(rows*cols===1)outline.position.z+=.04;
      const value=next[picked.row][picked.col];label.replaceChildren();
      const caption=document.createElement('span'),reading=document.createElement('strong');caption.textContent=rows*cols===1?copy.sensor:`${copy.point} ${picked.row+1} · ${picked.col+1}`;reading.textContent=value===null?copy.missing:`${value.toFixed(2)} °C`;label.append(caption,reading);
      canvas.setAttribute('aria-label',`${copy.model}. ${caption.textContent}: ${reading.textContent}. ${copy.hint}`);
      host.dataset.measured=copy.simulated?0:measured;host.dataset.simulated=copy.simulated?measured:0;host.dataset.missing=rows*cols-measured;host.dataset.selectedColor=temperatureColor(value);resize();
    },reset,zoom,setVisible(value){visible=value;if(value)resize();},
    dispose(){observer.disconnect();controls.dispose();disposeModel();renderer.dispose();canvas.remove();label.remove();}
  };
}

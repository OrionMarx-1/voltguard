import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { VEHICLE_NEUTRAL_COLOR, VEHICLE_TIRE_COLOR } from './vehicle-colors.mjs';

// One bay made only from local geometry. Positions are schematic, not measured.
export function createBayVehicle(host, { onFailure }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xf3f7f7); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.className = 'cp-vehicle-canvas'; canvas.tabIndex = 0; canvas.setAttribute('role', 'img'); host.append(canvas);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 50);
  camera.position.set(-5.2, 4.15, 7.1);
  const controls = new OrbitControls(camera, canvas); controls.target.set(0, .65, 0);
  controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 6; controls.maxDistance = 14; controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb2c1c7, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(-3, 7, 5); light.castShadow = true;
  light.shadow.mapSize.set(512, 512); Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 }); light.shadow.bias = -.001; scene.add(light);
  const car = new THREE.Group(); scene.add(car);
  const geometries = new Set(), materials = new Set(), rearWheels = [];
  let failed = false, disposed = false;
  const body = new THREE.MeshStandardMaterial({ color: VEHICLE_NEUTRAL_COLOR, roughness: .75 });
  const tire = new THREE.MeshStandardMaterial({ color: VEHICLE_TIRE_COLOR, roughness: .95 });
  const trim = new THREE.MeshStandardMaterial({ color: '#71838d', roughness: .8 });
  const glass = new THREE.MeshStandardMaterial({ color: '#566b75', roughness: .4, side: THREE.DoubleSide });
  function mesh(geometry, material, position, parent = car) {
    geometries.add(geometry); materials.add(material);
    const item = new THREE.Mesh(geometry, material); item.position.set(...position); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  }
  function roundedBox(width, height, depth, radius = .08) {
    const x = -width / 2, y = -height / 2, shape = new THREE.Shape();
    shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
    const bevel = Math.min(.035, depth / 4);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1, curveSegments: 8 });
    geometry.translate(0, 0, -depth / 2 + bevel); return geometry;
  }
  mesh(roundedBox(2, .68, 4.15, .17), body, [0, .88, -.02]);
  // Sloped cabin profile (profile X becomes -Z), with rounded edges.
  const cabin = new THREE.Shape(); cabin.moveTo(1.15, 1.18); cabin.lineTo(.8, 1.76); cabin.lineTo(-.35, 1.76); cabin.lineTo(-.95, 1.18); cabin.closePath();
  const cabinGeometry = new THREE.ExtrudeGeometry(cabin, { depth: 1.68, bevelEnabled: true, bevelThickness: .045, bevelSize: .045, bevelSegments: 3, steps: 1 });
  cabinGeometry.translate(0, 0, -.84); cabinGeometry.rotateY(Math.PI / 2); mesh(cabinGeometry, body, [0, 0, 0]);
  const side = new THREE.Shape(); side.moveTo(.94, 1.25); side.lineTo(.7, 1.66); side.lineTo(-.28, 1.66); side.lineTo(-.77, 1.25); side.closePath();
  for (const x of [-.89, .89]) { const geometry = new THREE.ShapeGeometry(side); geometry.rotateY(Math.PI / 2); mesh(geometry, glass, [x, 0, 0]); }
  const windshield = mesh(new THREE.PlaneGeometry(1.48, .65), glass, [0, 1.47, .69]); windshield.rotation.x = -Math.atan(.6 / .58);
  mesh(roundedBox(2.05, .22, .25, .06), trim, [0, .55, 2.06]);
  mesh(roundedBox(1.12, .2, .09, .035), tire, [0, .83, 2.12]);
  const headlight = new THREE.MeshStandardMaterial({ color: '#eff3ed', roughness: .45 });
  for (const x of [-.73, .73]) mesh(roundedBox(.42, .14, .08, .035), headlight, [x, 1.01, 2.12]);
  mesh(roundedBox(.42, .12, .06, .025), new THREE.MeshStandardMaterial({ color: '#e6ecee' }), [0, .56, 2.22]);
  mesh(roundedBox(1.5, .13, 3.8, .04), trim, [0, .25, .26]);
  for (const x of [-1.08, 1.08]) for (const z of [1.3, -1.35]) {
    const geometry = new THREE.CylinderGeometry(.38, .38, .3, 32); geometry.rotateZ(Math.PI / 2);
    const wheel = mesh(geometry, tire, [x, .42, z]); wheel.rotation.x = Math.PI / 2;
    const hubGeometry = new THREE.CylinderGeometry(.22, .22, .315, 24); hubGeometry.rotateZ(Math.PI / 2);
    const hub = mesh(hubGeometry, trim, [x, .42, z]); hub.rotation.x = Math.PI / 2;
    if (z < 0) rearWheels.push(wheel);
  }
  const floor = mesh(new THREE.PlaneGeometry(6.5, 8.2), new THREE.MeshStandardMaterial({ color: '#d9e0e1', roughness: 1 }), [0, 0, 0], scene);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const line = new THREE.MeshStandardMaterial({ color: '#fbfcfb', roughness: 1 });
  for (const x of [-1.43, 1.43]) mesh(new THREE.BoxGeometry(.035, .015, 5.4), line, [x, .012, 0], scene);
  mesh(new THREE.BoxGeometry(2.89, .015, .035), line, [0, .012, -2.7], scene);
  const charger = new THREE.Group(); scene.add(charger);
  mesh(roundedBox(.52, .12, .46, .035), trim, [-1.91, .07, -2.35], charger);
  mesh(roundedBox(.38, 1.25, .35, .08), body, [-1.91, .73, -2.35], charger);
  mesh(roundedBox(.24, .3, .045, .03), glass, [-1.91, .98, -2.13], charger);
  const cableCurve = new THREE.CatmullRomCurve3([[-1.91, .79, -2.12], [-2.03, .35, -1.25], [-1.55, .12, .2], [-1.3, .16, 1.65], [-.58, .8, 2.2]].map(point => new THREE.Vector3(...point)));
  const cable = mesh(new THREE.TubeGeometry(cableCurve, 40, .035, 8, false), tire, [0, 0, 0], scene);
  const hotspot = mesh(new THREE.SphereGeometry(.14, 24, 16), new THREE.MeshBasicMaterial({ color: VEHICLE_NEUTRAL_COLOR }), [0, 0, 0], scene);
  hotspot.castShadow = false; hotspot.receiveShadow = false;
  car.visible = false; cable.visible = false; hotspot.visible = false;
  function dispose() {
    if (disposed) return; disposed = true; observer.disconnect(); controls.dispose();
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); light.shadow.dispose();
    renderer.dispose(); canvas.remove();
  }
  function fail() { if (failed || disposed) return; failed = true; dispose(); onFailure(); }
  function render() {
    if (failed || disposed) return;
    try { host.dataset.cameraPosition = JSON.stringify(camera.position.toArray()); renderer.render(scene, camera); } catch { fail(); }
  }
  function resize() {
    if (failed || disposed || !host.getBoundingClientRect().width) return;
    const width = host.clientWidth, height = host.clientHeight || 190;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  controls.addEventListener('change', render);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(); }, { once: true });
  return {
    update(state, label) {
      if (failed || disposed) return;
      car.visible = state.visible; cable.visible = state.chargingCable; hotspot.visible = Boolean(state.hotspot);
      hotspot.material.color.set(state.hotspot?.color ?? VEHICLE_NEUTRAL_COLOR);
      if (state.hotspot) hotspot.position.set(state.hotspot.x, state.hotspot.y, state.hotspot.z);
      host.dataset.vehicle = String(car.visible); host.dataset.zoneColors = JSON.stringify(state.zones);
      host.dataset.hotspot = JSON.stringify(state.hotspot); host.dataset.chargingCable = String(cable.visible); host.dataset.charger = String(charger.visible);
      host.dataset.bodyColor = `#${body.color.getHexString()}`; host.dataset.rearWheelColor = `#${rearWheels[0].material.color.getHexString()}`;
      canvas.setAttribute('aria-label', label); resize();
    }, dispose
  };
}

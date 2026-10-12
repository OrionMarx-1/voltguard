import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { VEHICLE_NEUTRAL_COLOR } from './vehicle-colors.mjs';

// A box schematic of one selected bay, not a model of a measured vehicle.
export function createBayVehicle(host, { onFailure }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xf3f7f7); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement; canvas.className = 'cp-vehicle-canvas'; canvas.tabIndex = 0; canvas.setAttribute('role', 'img'); host.append(canvas);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .1, 50);
  camera.position.set(4.5, 2.9, 5.8);
  const controls = new OrbitControls(camera, canvas); controls.target.set(0, .55, 0);
  controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 4; controls.maxDistance = 12; controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb2c1c7, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(4, 6, 3); scene.add(light);
  const group = new THREE.Group(); scene.add(group);
  const geometries = new Set(), materials = new Set(), zones = { end: [], wheel: [], underbody: [] };
  let failed = false, disposed = false;
  function box(size, position, zone = null) {
    const geometry = new THREE.BoxGeometry(...size); geometries.add(geometry);
    const material = zone ? new THREE.MeshBasicMaterial({ color: VEHICLE_NEUTRAL_COLOR }) : new THREE.MeshStandardMaterial({ color: VEHICLE_NEUTRAL_COLOR, roughness: .8 });
    materials.add(material); if (zone) zones[zone].push(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); group.add(mesh);
    const edges = new THREE.EdgesGeometry(geometry), outline = new THREE.LineBasicMaterial({ color: 0x718690 });
    geometries.add(edges); materials.add(outline); mesh.add(new THREE.LineSegments(edges, outline));
  }
  box([2, .85, 2.4], [0, .95, -.65]);
  box([1.65, .55, 1.65], [0, 1.65, -.65]);
  box([2, .55, 1], [0, .95, 1.05], 'end');
  box([1.5, .2, 2.5], [0, .3, .55], 'underbody');
  for (const x of [-1.1, 1.1]) { box([.45, .6, .65], [x, .42, .85], 'wheel'); box([.45, .6, .65], [x, .42, -1.35]); }
  group.visible = false;
  function dispose() {
    if (disposed) return; disposed = true; observer.disconnect(); controls.dispose();
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    renderer.dispose(); canvas.remove();
  }
  function fail() { if (failed || disposed) return; failed = true; dispose(); onFailure(); }
  function render() {
    if (failed || disposed || !group.visible) return;
    try { renderer.render(scene, camera); } catch { fail(); }
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
      group.visible = state.visible;
      for (const [zone, list] of Object.entries(zones)) for (const material of list) material.color.set(state.zones[zone].color ?? VEHICLE_NEUTRAL_COLOR);
      host.dataset.vehicle = String(state.visible); host.dataset.zoneColors = JSON.stringify(state.zones);
      canvas.setAttribute('aria-label', label); resize();
    }, dispose
  };
}

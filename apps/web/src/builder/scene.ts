import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Recipe } from '@toyforge/shared';
import { buildCharacter, disposeObject } from './character';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  setCharacter(recipe: Recipe): void;
  current(): THREE.Group;
  render(): void;
  resize(): void;
  dispose(): void;
}

export function createScene(container: HTMLElement): SceneHandle {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe0f2fe, 0.015);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 7, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 4.5, 0);
  controls.minDistance = 7;
  controls.maxDistance = 35;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;
  controls.enablePan = false;

  // Lighting re-tuned for physically based intensities (three r155+) to match the r128 prototype look.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(10, 20, 15);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbae6fd, 0.9);
  fill.position.set(-10, 8, -10);
  scene.add(fill);

  const bed = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
  bed.position.y = -0.1;
  bed.receiveShadow = true;
  scene.add(bed);
  const grid = new THREE.GridHelper(12, 12, 0x38bdf8, 0xcbd5e1);
  grid.position.y = 0.01;
  scene.add(grid);

  let character = new THREE.Group();
  scene.add(character);

  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    controls.update();
    render();
  };
  loop();

  return {
    renderer, scene, camera, controls, render, resize,
    current: () => character,
    setCharacter(recipe) {
      const next = buildCharacter(recipe);
      scene.remove(character);
      disposeObject(character);
      character = next;
      scene.add(character);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

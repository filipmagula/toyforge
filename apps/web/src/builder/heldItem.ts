import * as THREE from 'three';
import type { Recipe } from '@toyforge/shared';
import { addMesh, type Vec3 } from './mesh';

type M = THREE.MeshStandardMaterial;

export function buildHeldItem(parent: THREE.Object3D, itemType: Recipe['rightHandItem'], mPrimary: M, mAccent: M, pos: Vec3): void {
  if (itemType === 'none') return;
  const g = new THREE.Group();
  g.position.set(...pos);
  parent.add(g);
  const PI = Math.PI;

  if (itemType === 'sword') {
    addMesh(g, new THREE.CylinderGeometry(0.14, 0.14, 0.75, 12), mAccent, [0, 0, 0.15], [PI / 2, 0, 0]);
    addMesh(g, new THREE.BoxGeometry(0.75, 0.22, 0.24), mAccent, [0, 0, 0.42]);
    addMesh(g, new THREE.BoxGeometry(0.28, 0.16, 1.85), mPrimary, [0, 0, 1.32]);
  } else if (itemType === 'wand') {
    addMesh(g, new THREE.CylinderGeometry(0.11, 0.13, 1.45, 12), mAccent, [0, 0, 0.55], [PI / 2, 0, 0]);
    addMesh(g, new THREE.OctahedronGeometry(0.38, 0), mPrimary, [0, 0, 1.3]);
  } else if (itemType === 'shield') {
    addMesh(g, new THREE.CylinderGeometry(0.95, 0.95, 0.26, 20), mPrimary, [0, 0, 0.25], [PI / 2, 0, 0]);
    addMesh(g, new THREE.SphereGeometry(0.38, 16, 12), mAccent, [0, 0, 0.34]);
  } else if (itemType === 'blaster') {
    addMesh(g, new THREE.BoxGeometry(0.34, 0.44, 1.15), mPrimary, [0, 0.12, 0.42]);
    addMesh(g, new THREE.CylinderGeometry(0.18, 0.14, 0.45, 12), mAccent, [0, 0.12, 1.02], [PI / 2, 0, 0]);
  } else if (itemType === 'icecream') {
    addMesh(g, new THREE.ConeGeometry(0.34, 0.95, 16), mAccent, [0, 0.18, 0.15], [PI, 0, 0]);
    addMesh(g, new THREE.SphereGeometry(0.38, 16, 14), mPrimary, [0, 0.65, 0.15]);
  } else if (itemType === 'wrench') {
    addMesh(g, new THREE.BoxGeometry(0.24, 0.2, 1.45), mPrimary, [0, 0, 0.58]);
    addMesh(g, new THREE.TorusGeometry(0.34, 0.14, 10, 18, PI * 1.35), mPrimary, [0, 0, 1.32], [PI / 2, 0, PI * 0.8]);
  }
}

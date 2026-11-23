import * as THREE from 'three';
import type { ColorZone } from '@toyforge/shared';

export type Vec3 = [number, number, number];
export type Mats = Record<ColorZone, THREE.MeshStandardMaterial>;

export function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  pos: Vec3 = [0, 0, 0],
  rot: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.zone = material.userData.zone;
  parent.add(mesh);
  return mesh;
}

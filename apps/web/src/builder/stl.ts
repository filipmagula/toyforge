import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

/** Y-up scene units → Z-up millimetres (×10 ≈ 75–85 mm figurine), binary STL. */
export function exportStl(group: THREE.Group): ArrayBuffer {
  const clone = group.clone(true);
  const wrapper = new THREE.Group();
  wrapper.add(clone);
  wrapper.rotation.x = Math.PI / 2;
  wrapper.scale.setScalar(10);
  wrapper.updateMatrixWorld(true);
  const view = new STLExporter().parse(wrapper, { binary: true }) as DataView;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

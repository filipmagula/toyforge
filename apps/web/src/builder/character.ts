import * as THREE from 'three';
import { COLOR_ZONES, type Recipe } from '@toyforge/shared';
import { addMesh, type Mats } from './mesh';
import { buildHeldItem } from './heldItem';

/**
 * Procedural character builder, ported 1:1 from the v2.0 prototype.
 * Parts overlap on purpose (solid joints) so slicers treat the figure as one piece.
 */
function makeMaterials(colors: Recipe['colors']): Mats {
  const mats = {} as Mats;
  for (const zone of COLOR_ZONES) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[zone]), roughness: 0.45, metalness: 0.1 });
    m.userData.zone = zone;
    mats[zone] = m;
  }
  return mats;
}

export function buildCharacter(r: Recipe): THREE.Group {
  const PI = Math.PI;
  const root = new THREE.Group();
  root.name = 'character';
  const m = makeMaterials(r.colors);
  const { head: mHead, face: mFace, hat: mHat, body: mBody, backpack: mBack, arms: mArms, items: mItems, legs: mLegs, feet: mFeet, base: mBase } = m;

  let currentY = 0;

  // 0. Printable stand base
  if (r.includeBase) {
    addMesh(root, new THREE.CylinderGeometry(2.4, 2.6, 0.35, 32), mBase, [0, 0.175, 0]);
    currentY = 0.3;
  }

  // 1. Feet (skipped for tentacles)
  const footH = 0.6;
  const legSpacing = 0.75;
  if (r.legsStyle !== 'tentacles') {
    for (const x of [-legSpacing, legSpacing]) {
      if (r.feetStyle === 'blocky') {
        addMesh(root, new THREE.BoxGeometry(0.95, footH + 0.1, 1.3), mFeet, [x, currentY + (footH + 0.1) / 2 - 0.05, 0.15]);
      } else if (r.feetStyle === 'boots') {
        addMesh(root, new THREE.CylinderGeometry(0.5, 0.55, footH + 0.25, 16), mFeet, [x, currentY + (footH + 0.25) / 2 - 0.05, 0]);
        addMesh(root, new THREE.SphereGeometry(0.52, 16, 12), mFeet, [x, currentY + 0.32, 0.3]);
      } else if (r.feetStyle === 'flippers') {
        addMesh(root, new THREE.BoxGeometry(1.1, 0.35, 1.9), mFeet, [x, currentY + 0.12, 0.45]);
      } else if (r.feetStyle === 'paws') {
        addMesh(root, new THREE.SphereGeometry(0.58, 16, 12), mFeet, [x, currentY + 0.28, 0.22], [0, 0, 0], [1.1, 0.65, 1.35]);
        for (const toeX of [-0.26, 0, 0.26]) addMesh(root, new THREE.SphereGeometry(0.2, 12, 10), mHat, [x + toeX, currentY + 0.2, 0.72]);
      } else {
        addMesh(root, new THREE.BoxGeometry(0.85, footH + 0.1, 1.35), mFeet, [x, currentY + (footH + 0.1) / 2 - 0.05, 0.2]);
        addMesh(root, new THREE.SphereGeometry(0.43, 16, 12), mFeet, [x, currentY + 0.28, 0.7]);
      }
    }
    currentY += footH - 0.15;
  }

  // 2. Legs
  const legH = 1.95;
  if (r.legsStyle === 'wheel') {
    addMesh(root, new THREE.CylinderGeometry(0.9, 0.9, 1.6, 24), mLegs, [0, currentY + 0.7, 0], [0, 0, PI / 2]);
    addMesh(root, new THREE.CylinderGeometry(0.65, 0.85, 1.5, 16), mLegs, [0, currentY + 1.35, 0]);
  } else if (r.legsStyle === 'tentacles') {
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Group();
      t.position.set(0, currentY - 0.05, 0);
      t.rotation.y = (i / 6) * PI * 2;
      root.add(t);
      addMesh(t, new THREE.CylinderGeometry(0.42, 0.3, 1.45, 14), mLegs, [0.48, 1.35, 0], [0, 0, -0.35]);
      addMesh(t, new THREE.SphereGeometry(0.31, 12, 10), mLegs, [0.72, 0.72, 0]);
      addMesh(t, new THREE.CylinderGeometry(0.3, 0.18, 1.3, 14), mLegs, [1.1, 0.42, 0], [0, 0, -1.1]);
      addMesh(t, new THREE.SphereGeometry(0.22, 12, 10), mFeet, [1.62, 0.2, 0]);
    }
    addMesh(root, new THREE.SphereGeometry(1.05, 18, 14), mLegs, [0, currentY + 1.85, 0]);
  } else {
    for (const x of [-legSpacing, legSpacing]) {
      if (r.legsStyle === 'blocky') {
        addMesh(root, new THREE.BoxGeometry(0.85, legH, 0.85), mLegs, [x, currentY + legH / 2 - 0.05, 0]);
      } else if (r.legsStyle === 'springs') {
        addMesh(root, new THREE.CylinderGeometry(0.34, 0.34, legH, 14), mLegs, [x, currentY + legH / 2 - 0.05, 0]);
        for (let i = 0; i < 4; i++) addMesh(root, new THREE.TorusGeometry(0.34, 0.15, 10, 20), mLegs, [x, currentY + 0.25 + i * 0.42, 0], [PI / 2, 0, 0]);
      } else {
        addMesh(root, new THREE.CylinderGeometry(0.44, 0.38, legH, 16), mLegs, [x, currentY + legH / 2 - 0.05, 0]);
      }
    }
  }
  currentY += r.legsStyle === 'tentacles' ? 2.0 : legH - 0.25;

  // 3. Torso
  const torso = new THREE.Group();
  torso.position.set(0, currentY, 0);
  const bScale = r.bodyScale;
  torso.scale.set(bScale, bScale, bScale);
  root.add(torso);

  const bodyH = 2.35;
  if (r.bodyShape === 'blocky') {
    addMesh(torso, new THREE.BoxGeometry(2.2, bodyH, 1.2), mBody, [0, bodyH / 2, 0]);
  } else if (r.bodyShape === 'robot') {
    addMesh(torso, new THREE.BoxGeometry(2.3, bodyH, 1.4), mBody, [0, bodyH / 2, 0]);
    addMesh(torso, new THREE.BoxGeometry(1.3, 0.9, 0.3), mFace, [0, bodyH * 0.58, 0.62]);
    addMesh(torso, new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16), mHat, [-0.35, bodyH * 0.58, 0.72], [PI / 2, 0, 0]);
    addMesh(torso, new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16), mFeet, [0.35, bodyH * 0.58, 0.72], [PI / 2, 0, 0]);
  } else if (r.bodyShape === 'armor') {
    addMesh(torso, new THREE.CylinderGeometry(1.3, 0.95, bodyH, 8), mBody, [0, bodyH / 2, 0]);
    addMesh(torso, new THREE.SphereGeometry(0.68, 16, 12), mHat, [-1.15, bodyH - 0.25, 0]);
    addMesh(torso, new THREE.SphereGeometry(0.68, 16, 12), mHat, [1.15, bodyH - 0.25, 0]);
  } else if (r.bodyShape === 'chubby') {
    addMesh(torso, new THREE.SphereGeometry(1.42, 24, 18), mBody, [0, bodyH * 0.5, 0], [0, 0, 0], [1.05, 0.92, 0.95]);
    addMesh(torso, new THREE.SphereGeometry(1.05, 20, 16), mHat, [0, bodyH * 0.48, 0.44], [0, 0, 0], [0.85, 0.8, 0.65]);
  } else {
    addMesh(torso, new THREE.CylinderGeometry(1.08, 0.92, bodyH, 20), mBody, [0, bodyH / 2, 0]);
    addMesh(torso, new THREE.SphereGeometry(1.08, 20, 12), mBody, [0, bodyH - 0.3, 0], [0, 0, 0], [1, 0.45, 0.75]);
  }

  // 4. Back gear
  if (r.backpackStyle === 'jetpack') {
    addMesh(torso, new THREE.BoxGeometry(1.45, 1.1, 0.95), mBack, [0, bodyH * 0.55, -0.45]);
    for (const bx of [-0.45, 0.45]) {
      addMesh(torso, new THREE.CylinderGeometry(0.36, 0.36, 1.6, 16), mBack, [bx, bodyH * 0.55, -0.78]);
      addMesh(torso, new THREE.ConeGeometry(0.36, 0.52, 16), mBack, [bx, bodyH * 0.55 + 0.98, -0.78]);
      addMesh(torso, new THREE.CylinderGeometry(0.26, 0.4, 0.38, 16), mHat, [bx, bodyH * 0.55 - 0.88, -0.78]);
    }
  } else if (r.backpackStyle === 'cape') {
    addMesh(torso, new THREE.BoxGeometry(1.85, 0.4, 0.7), mBack, [0, bodyH * 0.86, -0.42]);
    addMesh(torso, new THREE.BoxGeometry(1.9, 2.35, 0.28), mBack, [0, bodyH * 0.45, -0.68], [0.16, 0, 0]);
  } else if (r.backpackStyle === 'wings') {
    addMesh(torso, new THREE.BoxGeometry(0.9, 1.1, 0.85), mBack, [0, bodyH * 0.55, -0.42]);
    for (const dir of [-1, 1]) {
      addMesh(torso, new THREE.BoxGeometry(1.85, 0.9, 0.26), mBack, [dir * 1.15, bodyH * 0.65, -0.58], [0, -dir * 0.22, dir * 0.22]);
      addMesh(torso, new THREE.BoxGeometry(1.35, 0.65, 0.26), mBack, [dir * 0.9, bodyH * 0.36, -0.58], [0, -dir * 0.22, -dir * 0.15]);
    }
  } else if (r.backpackStyle === 'shell') {
    addMesh(torso, new THREE.SphereGeometry(1.3, 20, 16), mBack, [0, bodyH * 0.5, -0.35], [0, 0, 0], [0.95, 1.1, 0.8]);
  } else if (r.backpackStyle === 'dinoTail') {
    addMesh(torso, new THREE.ConeGeometry(0.75, 2.6, 16), mBack, [0, 0.62, -1.05], [-1.15, 0, 0]);
    addMesh(torso, new THREE.ConeGeometry(0.24, 0.5, 8), mHat, [0, 0.95, -1.05], [-0.4, 0, 0]);
    addMesh(torso, new THREE.ConeGeometry(0.2, 0.45, 8), mHat, [0, 0.75, -1.6], [-0.4, 0, 0]);
  }

  // 5. Arms, hands, gear
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.25, bodyH - 0.38, 0);
    arm.rotation.set(-0.35, 0, side * -0.18);
    torso.add(arm);
    addMesh(arm, new THREE.SphereGeometry(0.45, 16, 12), mArms);

    const armLen = 1.65;
    if (r.armsStyle === 'blocky') {
      addMesh(arm, new THREE.BoxGeometry(0.7, armLen, 0.7), mArms, [0, -armLen / 2 + 0.15, 0]);
    } else if (r.armsStyle === 'claw') {
      addMesh(arm, new THREE.CylinderGeometry(0.34, 0.34, armLen - 0.2, 16), mArms, [0, -(armLen - 0.2) / 2 + 0.15, 0]);
      addMesh(arm, new THREE.TorusGeometry(0.35, 0.14, 10, 20, PI * 1.4), mFeet, [0, -armLen + 0.12, 0], [0, PI / 2, PI * 0.8]);
    } else if (r.armsStyle === 'tube') {
      addMesh(arm, new THREE.CylinderGeometry(0.36, 0.36, armLen, 16), mArms, [0, -armLen / 2 + 0.15, 0]);
    } else if (r.armsStyle === 'tentacles') {
      addMesh(arm, new THREE.CylinderGeometry(0.36, 0.26, 1.0, 14), mArms, [side * 0.12, -0.42, 0], [0, 0, side * 0.25]);
      addMesh(arm, new THREE.SphereGeometry(0.27, 12, 10), mArms, [side * 0.22, -0.88, 0.05]);
      addMesh(arm, new THREE.CylinderGeometry(0.26, 0.14, 0.95, 14), mArms, [side * 0.1, -1.28, 0.15], [-0.3, 0, side * -0.3]);
    } else {
      addMesh(arm, new THREE.CylinderGeometry(0.38, 0.32, armLen, 16), mArms, [0, -armLen / 2 + 0.15, 0]);
      addMesh(arm, new THREE.SphereGeometry(0.36, 16, 12), mArms, [0, -armLen + 0.12, 0]);
    }
    buildHeldItem(arm, side === -1 ? r.rightHandItem : r.leftHandItem, mItems, mBack, [0, -armLen + 0.12, 0.18]);
  }

  currentY += bodyH * bScale - 0.15;

  // 6. Neck & head
  addMesh(root, new THREE.CylinderGeometry(0.68, 0.78, 0.75, 16), mArms, [0, currentY + 0.15, 0]);
  currentY += 0.25;

  const head = new THREE.Group();
  head.position.set(0, currentY, 0);
  head.scale.setScalar(r.headScale);
  root.add(head);

  let faceZ = 0.96;
  if (r.headShape === 'cube') {
    addMesh(head, new THREE.BoxGeometry(2.1, 2.0, 2.0), mHead, [0, 1.0, 0]);
    faceZ = 0.96;
  } else if (r.headShape === 'sphere') {
    addMesh(head, new THREE.SphereGeometry(1.18, 24, 20), mHead, [0, 1.05, 0]);
    faceZ = 1.05;
  } else if (r.headShape === 'cylinder') {
    addMesh(head, new THREE.CylinderGeometry(1.05, 1.05, 2.0, 24), mHead, [0, 1.0, 0]);
    faceZ = 0.98;
  } else if (r.headShape === 'tv') {
    addMesh(head, new THREE.BoxGeometry(2.4, 1.8, 1.7), mHead, [0, 0.95, 0]);
    addMesh(head, new THREE.BoxGeometry(1.9, 1.35, 0.22), mArms, [0, 0.95, 0.8]);
    faceZ = 0.88;
  } else if (r.headShape === 'blob') {
    addMesh(head, new THREE.SphereGeometry(1.25, 24, 20), mHead, [0, 0.85, 0], [0, 0, 0], [1.15, 0.85, 1.05]);
    addMesh(head, new THREE.SphereGeometry(0.88, 20, 16), mHead, [0, 1.5, -0.05]);
    faceZ = 1.1;
  } else if (r.headShape === 'dino') {
    addMesh(head, new THREE.BoxGeometry(1.9, 1.85, 1.8), mHead, [0, 1.0, -0.1]);
    addMesh(head, new THREE.BoxGeometry(1.5, 1.05, 1.25), mHead, [0, 0.65, 0.85]);
    faceZ = 0.78;
  }

  // 7. Face
  const eyeY = 1.18;
  if (r.eyesStyle === 'round') {
    for (const ex of [-0.42, 0.42]) addMesh(head, new THREE.SphereGeometry(0.24, 16, 12), mFace, [ex, eyeY, faceZ - 0.02]);
  } else if (r.eyesStyle === 'blocky') {
    for (const ex of [-0.42, 0.42]) addMesh(head, new THREE.BoxGeometry(0.42, 0.28, 0.25), mFace, [ex, eyeY, faceZ]);
  } else if (r.eyesStyle === 'visor') {
    addMesh(head, new THREE.BoxGeometry(1.45, 0.38, 0.28), mFace, [0, eyeY, faceZ + 0.02]);
  } else if (r.eyesStyle === 'cyclops') {
    addMesh(head, new THREE.CylinderGeometry(0.45, 0.45, 0.28, 20), mFace, [0, eyeY + 0.05, faceZ + 0.02], [PI / 2, 0, 0]);
    addMesh(head, new THREE.SphereGeometry(0.22, 16, 12), mHat, [0, eyeY + 0.05, faceZ + 0.14]);
  } else if (r.eyesStyle === 'star') {
    for (const ex of [-0.42, 0.42]) addMesh(head, new THREE.OctahedronGeometry(0.28, 0), mFace, [ex, eyeY, faceZ + 0.04]);
  } else if (r.eyesStyle === 'threeEyes') {
    for (const ex of [-0.5, 0.5]) addMesh(head, new THREE.SphereGeometry(0.22, 14, 12), mFace, [ex, eyeY - 0.05, faceZ - 0.02]);
    addMesh(head, new THREE.SphereGeometry(0.25, 14, 12), mFace, [0, eyeY + 0.28, faceZ - 0.06]);
  } else if (r.eyesStyle === 'googly') {
    addMesh(head, new THREE.SphereGeometry(0.32, 16, 12), mFace, [-0.42, eyeY + 0.08, faceZ]);
    addMesh(head, new THREE.SphereGeometry(0.2, 16, 12), mFace, [0.42, eyeY - 0.08, faceZ]);
  }

  const snoutZ = r.headShape === 'dino' ? faceZ + 0.62 : faceZ;
  if (r.noseStyle === 'button') {
    addMesh(head, new THREE.SphereGeometry(0.2, 14, 12), mFace, [0, 0.88, snoutZ + 0.05]);
  } else if (r.noseStyle === 'block') {
    addMesh(head, new THREE.BoxGeometry(0.32, 0.34, 0.34), mFace, [0, 0.88, snoutZ + 0.06]);
  } else if (r.noseStyle === 'carrot') {
    addMesh(head, new THREE.ConeGeometry(0.2, 0.68, 12), mItems, [0, 0.88, snoutZ + 0.22], [PI / 2, 0, 0]);
  } else if (r.noseStyle === 'snout') {
    addMesh(head, new THREE.CylinderGeometry(0.34, 0.38, 0.36, 18), mHat, [0, 0.86, snoutZ + 0.08], [PI / 2, 0, 0]);
    for (const nx of [-0.12, 0.12]) addMesh(head, new THREE.SphereGeometry(0.08, 10, 8), mFace, [nx, 0.86, snoutZ + 0.24]);
  } else if (r.noseStyle === 'trunk') {
    addMesh(head, new THREE.CylinderGeometry(0.28, 0.2, 0.7, 14), mHead, [0, 0.82, snoutZ + 0.22], [1.1, 0, 0]);
    addMesh(head, new THREE.SphereGeometry(0.2, 12, 10), mHead, [0, 0.64, snoutZ + 0.5]);
    addMesh(head, new THREE.CylinderGeometry(0.2, 0.24, 0.55, 14), mHead, [0, 0.84, snoutZ + 0.6], [0.2, 0, 0]);
  }

  const mouthY = 0.52;
  if (r.mouthStyle === 'smile') {
    addMesh(head, new THREE.TorusGeometry(0.34, 0.09, 10, 20, PI), mFace, [0, mouthY + 0.14, snoutZ + 0.02], [0, 0, PI]);
  } else if (r.mouthStyle === 'grille') {
    addMesh(head, new THREE.BoxGeometry(0.95, 0.34, 0.22), mFace, [0, mouthY, snoutZ + 0.02]);
  } else if (r.mouthStyle === 'blocky') {
    addMesh(head, new THREE.BoxGeometry(0.75, 0.22, 0.22), mFace, [0, mouthY, snoutZ + 0.02]);
  } else if (r.mouthStyle === 'open') {
    addMesh(head, new THREE.CylinderGeometry(0.24, 0.24, 0.22, 16), mFace, [0, mouthY, snoutZ + 0.02], [PI / 2, 0, 0]);
  } else if (r.mouthStyle === 'mustache') {
    addMesh(head, new THREE.BoxGeometry(1.15, 0.24, 0.28), mHat, [0, mouthY + 0.1, snoutZ + 0.06]);
  } else if (r.mouthStyle === 'fangs') {
    addMesh(head, new THREE.BoxGeometry(0.92, 0.2, 0.22), mFace, [0, mouthY + 0.04, snoutZ + 0.02]);
    for (const fx of [-0.3, 0.3]) addMesh(head, new THREE.ConeGeometry(0.12, 0.36, 8), mHat, [fx, mouthY - 0.14, snoutZ + 0.05], [PI, 0, 0]);
  }

  // Side ears
  const earX = r.headShape === 'tv' ? 1.15 : 1.02;
  const earY = 1.05;
  if (r.sideEarsStyle === 'human') {
    for (const ex of [-earX, earX]) addMesh(head, new THREE.SphereGeometry(0.28, 14, 12), mHead, [ex, earY, -0.05], [0, 0, 0], [0.65, 1.25, 0.85]);
  } else if (r.sideEarsStyle === 'elf') {
    for (const dir of [-1, 1]) addMesh(head, new THREE.ConeGeometry(0.24, 0.78, 10), mHead, [dir * (earX + 0.15), earY + 0.12, -0.05], [0, 0, -dir * 1.15]);
  } else if (r.sideEarsStyle === 'cat') {
    const topEarY = r.headShape === 'tv' ? 1.85 : 1.92;
    [-0.68, 0.68].forEach((ex, idx) => addMesh(head, new THREE.ConeGeometry(0.36, 0.72, 4), mHead, [ex, topEarY + 0.12, 0], [0, PI / 4, idx === 0 ? 0.25 : -0.25]));
  } else if (r.sideEarsStyle === 'dog') {
    for (const dir of [-1, 1]) addMesh(head, new THREE.SphereGeometry(0.32, 14, 12), mHead, [dir * (earX + 0.08), earY - 0.18, 0], [0, 0, dir * 0.22], [0.6, 1.85, 0.95]);
  } else if (r.sideEarsStyle === 'robotDish') {
    for (const dir of [-1, 1]) {
      addMesh(head, new THREE.CylinderGeometry(0.18, 0.18, 0.35, 12), mArms, [dir * earX, earY, 0], [0, 0, PI / 2]);
      addMesh(head, new THREE.CylinderGeometry(0.45, 0.22, 0.25, 16), mHat, [dir * (earX + 0.2), earY, 0], [0, 0, -dir * PI / 2]);
    }
  }

  // 8. Hair & hats
  const hatBaseY = r.headShape === 'tv' ? 1.8 : 1.92;
  if (r.hairStyle === 'spiky') {
    addMesh(head, new THREE.SphereGeometry(1.06, 20, 12, 0, PI * 2, 0, PI * 0.48), mHat, [0, hatBaseY - 0.22, 0]);
    const spikes: [number, number, number, number, number][] = [
      [0, hatBaseY + 0.48, 0.2, 0.25, 0],
      [-0.45, hatBaseY + 0.4, 0.1, 0.2, 0.38],
      [0.45, hatBaseY + 0.4, 0.1, 0.2, -0.38],
      [0, hatBaseY + 0.42, -0.35, -0.35, 0],
      [-0.42, hatBaseY + 0.34, -0.3, -0.25, 0.35],
      [0.42, hatBaseY + 0.34, -0.3, -0.25, -0.35],
    ];
    for (const [sx, sy, sz, rx, rz] of spikes) addMesh(head, new THREE.ConeGeometry(0.28, 0.72, 10), mHat, [sx, sy, sz], [rx, 0, rz]);
  } else if (r.hairStyle === 'afro') {
    addMesh(head, new THREE.SphereGeometry(1.18, 22, 16), mHat, [0, hatBaseY + 0.05, -0.08], [0, 0, 0], [1.15, 0.85, 1.12]);
    for (const [px, py, pz] of [[-0.75, 0.1, 0.3], [0.75, 0.1, 0.3], [-0.65, 0.35, -0.4], [0.65, 0.35, -0.4], [0, 0.55, 0.2]] as const) {
      addMesh(head, new THREE.SphereGeometry(0.45, 14, 12), mHat, [px, hatBaseY + py, pz]);
    }
  } else if (r.hairStyle === 'buns') {
    addMesh(head, new THREE.SphereGeometry(1.08, 20, 12, 0, PI * 2, 0, PI * 0.5), mHat, [0, hatBaseY - 0.2, 0]);
    for (const bx of [-1.12, 1.12]) addMesh(head, new THREE.SphereGeometry(0.46, 16, 14), mHat, [bx, hatBaseY - 0.05, -0.05]);
  } else if (r.hairStyle === 'mohawk') {
    for (let z = -0.65; z <= 0.65; z += 0.32) addMesh(head, new THREE.ConeGeometry(0.26, 0.78, 10), mHat, [0, hatBaseY + 0.32, z], [z * 0.25, 0, 0]);
  }

  if (r.hatStyle === 'antenna') {
    addMesh(head, new THREE.CylinderGeometry(0.32, 0.38, 0.25, 16), mHat, [0, hatBaseY - 0.05, 0]);
    addMesh(head, new THREE.CylinderGeometry(0.14, 0.18, 0.85, 12), mHat, [0, hatBaseY + 0.4, 0]);
    addMesh(head, new THREE.SphereGeometry(0.28, 16, 12), mItems, [0, hatBaseY + 0.86, 0]);
  } else if (r.hatStyle === 'crown') {
    addMesh(head, new THREE.CylinderGeometry(0.85, 0.75, 0.55, 16), mHat, [0, hatBaseY + 0.14, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      addMesh(head, new THREE.ConeGeometry(0.22, 0.45, 8), mHat, [Math.cos(a) * 0.68, hatBaseY + 0.52, Math.sin(a) * 0.68]);
    }
  } else if (r.hatStyle === 'cap') {
    addMesh(head, new THREE.SphereGeometry(1.12, 20, 12, 0, PI * 2, 0, PI / 2), mHat, [0, hatBaseY - 0.22, 0]);
    addMesh(head, new THREE.BoxGeometry(1.3, 0.18, 1.0), mHat, [0, hatBaseY - 0.14, 0.85]);
  } else if (r.hatStyle === 'ears') {
    for (const ex of [-0.82, 0.82]) addMesh(head, new THREE.CylinderGeometry(0.48, 0.48, 0.28, 20), mHat, [ex, hatBaseY + 0.18, 0], [PI / 2, 0, 0]);
  } else if (r.hatStyle === 'helmet') {
    addMesh(head, new THREE.BoxGeometry(0.34, 0.65, 1.75), mHat, [0, hatBaseY + 0.15, 0]);
  } else if (r.hatStyle === 'bunnyEars') {
    [-0.45, 0.45].forEach((ex, idx) => {
      addMesh(head, new THREE.CylinderGeometry(0.22, 0.28, 1.25, 14), mHat, [ex, hatBaseY + 0.42, 0], [0, 0, idx === 0 ? 0.14 : -0.14]);
      addMesh(head, new THREE.SphereGeometry(0.22, 12, 10), mHat, [ex + (idx === 0 ? -0.08 : 0.08), hatBaseY + 1.02, 0]);
    });
  } else if (r.hatStyle === 'horns') {
    [-0.65, 0.65].forEach((ex, idx) => {
      const dir = idx === 0 ? -1 : 1;
      addMesh(head, new THREE.ConeGeometry(0.28, 0.95, 12), mHat, [ex, hatBaseY + 0.26, 0], [0.2, 0, -dir * 0.48]);
    });
  }

  return root;
}

export function disposeObject(obj: THREE.Object3D): void {
  const mats = new Set<THREE.Material>();
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => mats.add(m));
  });
  mats.forEach((m) => m.dispose());
}

import type { ColorZone, PartProp, Recipe } from '@toyforge/shared';
import type { IconName } from '../icons';
import type { MessageKey } from '../i18n';

export type Section =
  | { kind: 'grid'; prop: PartProp; titleKey: MessageKey; icons: Record<string, IconName>; visible?: (r: Recipe) => boolean }
  | { kind: 'slider'; prop: 'headScale' | 'bodyScale'; titleKey: MessageKey };

export interface Category { id: string; labelKey: MessageKey; icon: IconName; colorZone: ColorZone; sections: Section[] }

const items: Record<string, IconName> = { none: 'Ban', sword: 'Sword', wand: 'WandSparkles', shield: 'Shield', blaster: 'Crosshair', icecream: 'IceCreamCone', wrench: 'Wrench' };

export const CATEGORIES: Category[] = [
  {
    id: 'head', labelKey: 'cat.head', icon: 'Smile', colorZone: 'head',
    sections: [
      { kind: 'grid', prop: 'headShape', titleKey: 'section.headShape', icons: { cube: 'Box', sphere: 'Circle', cylinder: 'Cylinder', tv: 'Tv', blob: 'Ghost', dino: 'Bone' } },
      { kind: 'slider', prop: 'headScale', titleKey: 'section.headScale' },
    ],
  },
  {
    id: 'face', labelKey: 'cat.face', icon: 'Eye', colorZone: 'face',
    sections: [
      { kind: 'grid', prop: 'eyesStyle', titleKey: 'section.eyesStyle', icons: { visor: 'Glasses', round: 'Eye', blocky: 'Square', cyclops: 'Target', threeEyes: 'Radiation', googly: 'Laugh', star: 'Star' } },
      { kind: 'grid', prop: 'mouthStyle', titleKey: 'section.mouthStyle', icons: { smile: 'Smile', fangs: 'Skull', grille: 'Grid3x3', blocky: 'Minus', open: 'Circle', mustache: 'Drama' } },
      { kind: 'grid', prop: 'noseStyle', titleKey: 'section.noseStyle', icons: { none: 'Ban', button: 'CircleDot', snout: 'Disc3', trunk: 'Spline', carrot: 'Carrot', block: 'Cuboid' } },
      { kind: 'grid', prop: 'sideEarsStyle', titleKey: 'section.sideEarsStyle', icons: { none: 'Ban', human: 'Ear', elf: 'Sparkles', cat: 'Cat', dog: 'Dog', robotDish: 'Satellite' } },
    ],
  },
  {
    id: 'hat', labelKey: 'cat.hat', icon: 'Crown', colorZone: 'hat',
    sections: [
      { kind: 'grid', prop: 'hairStyle', titleKey: 'section.hairStyle', icons: { none: 'Ban', spiky: 'Zap', afro: 'Cloud', buns: 'Heart', mohawk: 'Flame' } },
      { kind: 'grid', prop: 'hatStyle', titleKey: 'section.hatStyle', icons: { none: 'Ban', horns: 'Cone', bunnyEars: 'Rabbit', ears: 'Mouse', crown: 'Crown', antenna: 'RadioTower', cap: 'HardHat', helmet: 'Rocket' } },
    ],
  },
  {
    id: 'body', labelKey: 'cat.body', icon: 'Shirt', colorZone: 'body',
    sections: [
      { kind: 'grid', prop: 'bodyShape', titleKey: 'section.bodyShape', icons: { robot: 'Bot', human: 'Shirt', blocky: 'Box', armor: 'Shield', chubby: 'Circle' } },
      { kind: 'slider', prop: 'bodyScale', titleKey: 'section.bodyScale' },
    ],
  },
  {
    id: 'back', labelKey: 'cat.back', icon: 'Rocket', colorZone: 'backpack',
    sections: [
      { kind: 'grid', prop: 'backpackStyle', titleKey: 'section.backpackStyle', icons: { none: 'Ban', jetpack: 'Rocket', cape: 'Drama', wings: 'Feather', shell: 'Turtle', dinoTail: 'Bone' } },
    ],
  },
  {
    id: 'arms', labelKey: 'cat.arms', icon: 'Hand', colorZone: 'arms',
    sections: [
      { kind: 'grid', prop: 'armsStyle', titleKey: 'section.armsStyle', icons: { claw: 'Bot', human: 'Hand', blocky: 'Box', tube: 'GripVertical', tentacles: 'Spline' } },
    ],
  },
  {
    id: 'items', labelKey: 'cat.items', icon: 'WandSparkles', colorZone: 'items',
    sections: [
      { kind: 'grid', prop: 'rightHandItem', titleKey: 'section.rightHandItem', icons: items },
      { kind: 'grid', prop: 'leftHandItem', titleKey: 'section.leftHandItem', icons: items },
    ],
  },
  {
    id: 'legs', labelKey: 'cat.legs', icon: 'Footprints', colorZone: 'legs',
    sections: [
      { kind: 'grid', prop: 'legsStyle', titleKey: 'section.legsStyle', icons: { blocky: 'Box', human: 'PersonStanding', springs: 'Zap', wheel: 'Disc3', tentacles: 'Spline' } },
      { kind: 'grid', prop: 'feetStyle', titleKey: 'section.feetStyle', icons: { boots: 'Bot', shoes: 'Footprints', blocky: 'Square', flippers: 'Waves', paws: 'PawPrint' }, visible: (r) => r.legsStyle !== 'tentacles' },
    ],
  },
];

export type ChangeSource = 'part' | 'slider' | 'reset';
export interface Store {
  get(): Recipe;
  set(patch: Partial<Recipe>, source?: ChangeSource): void;
  replace(r: Recipe, source?: ChangeSource): void;
  subscribe(fn: (r: Recipe, source: ChangeSource) => void): () => void;
}

export function createStore(initial: Recipe): Store {
  let state: Recipe = structuredClone(initial);
  const fns = new Set<(r: Recipe, s: ChangeSource) => void>();
  const emit = (s: ChangeSource) => fns.forEach((fn) => fn(state, s));
  return {
    get: () => state,
    set(patch, source = 'part') { state = { ...state, ...patch, colors: { ...state.colors, ...(patch.colors ?? {}) } }; emit(source); },
    replace(r, source = 'reset') { state = structuredClone(r); emit(source); },
    subscribe(fn) { fns.add(fn); return () => fns.delete(fn); },
  };
}

import { z } from 'zod';

export const PART_OPTIONS = {
  headShape: ['cube', 'sphere', 'cylinder', 'tv', 'blob', 'dino'],
  eyesStyle: ['visor', 'round', 'blocky', 'cyclops', 'threeEyes', 'googly', 'star'],
  mouthStyle: ['smile', 'fangs', 'grille', 'blocky', 'open', 'mustache'],
  noseStyle: ['none', 'button', 'snout', 'trunk', 'carrot', 'block'],
  sideEarsStyle: ['none', 'human', 'elf', 'cat', 'dog', 'robotDish'],
  hairStyle: ['none', 'spiky', 'afro', 'buns', 'mohawk'],
  hatStyle: ['none', 'horns', 'bunnyEars', 'ears', 'crown', 'antenna', 'cap', 'helmet'],
  bodyShape: ['robot', 'human', 'blocky', 'armor', 'chubby'],
  backpackStyle: ['none', 'jetpack', 'cape', 'wings', 'shell', 'dinoTail'],
  armsStyle: ['claw', 'human', 'blocky', 'tube', 'tentacles'],
  rightHandItem: ['none', 'sword', 'wand', 'shield', 'blaster', 'icecream', 'wrench'],
  leftHandItem: ['none', 'sword', 'wand', 'shield', 'blaster', 'icecream', 'wrench'],
  legsStyle: ['blocky', 'human', 'springs', 'wheel', 'tentacles'],
  feetStyle: ['boots', 'shoes', 'blocky', 'flippers', 'paws'],
} as const;

export type PartProp = keyof typeof PART_OPTIONS;

export const COLOR_ZONES = ['head', 'face', 'hat', 'body', 'backpack', 'arms', 'items', 'legs', 'feet', 'base'] as const;
export type ColorZone = (typeof COLOR_ZONES)[number];

export const PALETTE = [
  { id: 'robotSilver', hex: '#cbd5e1' },
  { id: 'skyBlue', hex: '#38bdf8' },
  { id: 'heroRed', hex: '#f43f5e' },
  { id: 'sunnyYellow', hex: '#facc15' },
  { id: 'slimeGreen', hex: '#4ade80' },
  { id: 'monsterPurple', hex: '#a855f7' },
  { id: 'tangerine', hex: '#fb923c' },
  { id: 'peachSkin', hex: '#fed7aa' },
  { id: 'warmBrown', hex: '#92400e' },
  { id: 'midnightDark', hex: '#334155' },
  { id: 'snowWhite', hex: '#f8fafc' },
  { id: 'bubblegumPink', hex: '#f472b6' },
] as const;

export const SCALE_RANGES = {
  headScale: [0.75, 1.45, 0.05],
  bodyScale: [0.8, 1.3, 0.05],
} as const;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const enumOf = <K extends PartProp>(k: K) => z.enum(PART_OPTIONS[k] as unknown as [string, ...string[]]) as unknown as z.ZodType<(typeof PART_OPTIONS)[K][number]>;

export const recipeSchema = z.strictObject({
  version: z.literal(1),
  headScale: z.number().min(SCALE_RANGES.headScale[0]).max(SCALE_RANGES.headScale[1]),
  bodyScale: z.number().min(SCALE_RANGES.bodyScale[0]).max(SCALE_RANGES.bodyScale[1]),
  includeBase: z.boolean(),
  headShape: enumOf('headShape'),
  eyesStyle: enumOf('eyesStyle'),
  mouthStyle: enumOf('mouthStyle'),
  noseStyle: enumOf('noseStyle'),
  sideEarsStyle: enumOf('sideEarsStyle'),
  hairStyle: enumOf('hairStyle'),
  hatStyle: enumOf('hatStyle'),
  bodyShape: enumOf('bodyShape'),
  backpackStyle: enumOf('backpackStyle'),
  armsStyle: enumOf('armsStyle'),
  rightHandItem: enumOf('rightHandItem'),
  leftHandItem: enumOf('leftHandItem'),
  legsStyle: enumOf('legsStyle'),
  feetStyle: enumOf('feetStyle'),
  colors: z.strictObject({
    head: hex, face: hex, hat: hex, body: hex, backpack: hex,
    arms: hex, items: hex, legs: hex, feet: hex, base: hex,
  }),
});

export type Recipe = z.infer<typeof recipeSchema>;

export const BLANK_RECIPE: Recipe = Object.freeze({
  version: 1,
  headScale: 1.0,
  bodyScale: 1.0,
  includeBase: true,
  headShape: 'sphere',
  eyesStyle: 'round',
  mouthStyle: 'smile',
  noseStyle: 'none',
  sideEarsStyle: 'none',
  hairStyle: 'none',
  hatStyle: 'none',
  bodyShape: 'human',
  backpackStyle: 'none',
  armsStyle: 'human',
  rightHandItem: 'none',
  leftHandItem: 'none',
  legsStyle: 'human',
  feetStyle: 'shoes',
  colors: Object.freeze({
    head: '#e2e8f0', face: '#334155', hat: '#facc15', body: '#cbd5e1', backpack: '#94a3b8',
    arms: '#e2e8f0', items: '#facc15', legs: '#94a3b8', feet: '#64748b', base: '#94a3b8',
  }),
}) as Recipe;

export function randomRecipe(rand: () => number = Math.random, includeBase = true): Recipe {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const parts = Object.fromEntries(
    (Object.keys(PART_OPTIONS) as PartProp[]).map((k) => [k, pick(PART_OPTIONS[k])]),
  );
  const colors = Object.fromEntries(
    COLOR_ZONES.map((z) => [z, z === 'base' ? BLANK_RECIPE.colors.base : pick(PALETTE).hex]),
  ) as Recipe['colors'];
  return {
    ...(parts as Omit<Recipe, 'version' | 'headScale' | 'bodyScale' | 'includeBase' | 'colors'>),
    version: 1,
    headScale: Math.round((0.85 + rand() * 0.45) * 100) / 100,
    bodyScale: Math.round((0.9 + rand() * 0.25) * 100) / 100,
    includeBase,
    colors,
  };
}

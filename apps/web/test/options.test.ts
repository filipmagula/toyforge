import { describe, expect, it } from 'vitest';
import { PART_OPTIONS, BLANK_RECIPE } from '@toyforge/shared';
import { CATEGORIES, createStore } from '../src/builder/options';

describe('CATEGORIES', () => {
  it('covers every part prop with an icon for every value', () => {
    const grids = CATEGORIES.flatMap((c) => c.sections).filter((s) => s.kind === 'grid');
    expect(new Set(grids.map((s) => s.prop))).toEqual(new Set(Object.keys(PART_OPTIONS)));
    for (const s of grids) if (s.kind === 'grid') for (const v of PART_OPTIONS[s.prop]) expect(s.icons[v], `${s.prop}.${v}`).toBeTruthy();
  });
  it('hides feet for tentacle legs', () => {
    const feet = CATEGORIES.find((c) => c.id === 'legs')!.sections[1]!;
    expect(feet.kind === 'grid' && feet.visible?.({ ...BLANK_RECIPE, legsStyle: 'tentacles' })).toBe(false);
  });
});

describe('createStore', () => {
  it('merges colours and reports the source', () => {
    const s = createStore(BLANK_RECIPE);
    const seen: string[] = [];
    s.subscribe((_r, src) => seen.push(src));
    s.set({ colors: { ...s.get().colors, body: '#000000' } });
    s.set({ headScale: 1.2 }, 'slider');
    expect(s.get().colors.body).toBe('#000000');
    expect(s.get().colors.head).toBe(BLANK_RECIPE.colors.head);
    expect(seen).toEqual(['part', 'slider']);
  });
});

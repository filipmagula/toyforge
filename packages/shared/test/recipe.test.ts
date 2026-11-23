import { describe, expect, it } from 'vitest';
import { BLANK_RECIPE, COLOR_ZONES, PALETTE, PART_OPTIONS, randomRecipe, recipeSchema } from '../src/index';

describe('recipe', () => {
  it('blank recipe is valid and matches prototype dummy', () => {
    expect(recipeSchema.parse(BLANK_RECIPE)).toEqual(BLANK_RECIPE);
    expect(BLANK_RECIPE.headShape).toBe('sphere');
    expect(BLANK_RECIPE.bodyShape).toBe('human');
    expect(BLANK_RECIPE.feetStyle).toBe('shoes');
    expect(BLANK_RECIPE.includeBase).toBe(true);
    expect(BLANK_RECIPE.colors.head).toBe('#e2e8f0');
  });
  it('has 12 palette colours and 10 zones', () => {
    expect(PALETTE).toHaveLength(12);
    expect(COLOR_ZONES).toHaveLength(10);
    expect(PART_OPTIONS.hatStyle).toEqual(['none', 'horns', 'bunnyEars', 'ears', 'crown', 'antenna', 'cap', 'helmet']);
  });
  it('random recipes are valid', () => {
    for (let i = 0; i < 200; i++) expect(() => recipeSchema.parse(randomRecipe(Math.random, i % 2 === 0))).not.toThrow();
  });
  it('random recipe keeps includeBase and base colour', () => {
    const r = randomRecipe(Math.random, false);
    expect(r.includeBase).toBe(false);
    expect(r.colors.base).toBe(BLANK_RECIPE.colors.base);
  });
  it('rejects out of range scale', () => {
    expect(recipeSchema.safeParse({ ...BLANK_RECIPE, headScale: 2 }).success).toBe(false);
  });
  it('rejects unknown keys and values', () => {
    expect(recipeSchema.safeParse({ ...BLANK_RECIPE, evil: 1 }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...BLANK_RECIPE, hatStyle: 'tophat' }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...BLANK_RECIPE, colors: { ...BLANK_RECIPE.colors, head: 'red' } }).success).toBe(false);
  });
});

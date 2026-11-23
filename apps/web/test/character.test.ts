import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { BLANK_RECIPE, randomRecipe, type Recipe } from '@toyforge/shared';
import { buildCharacter, disposeObject } from '../src/builder/character';

const meshes = (g: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); });
  return out;
};

describe('buildCharacter', () => {
  it('builds the blank figure', () => {
    const g = buildCharacter(BLANK_RECIPE);
    expect(meshes(g).length).toBeGreaterThan(10);
  });
  it('builds 200 random recipes without throwing', () => {
    for (let i = 0; i < 200; i++) expect(() => buildCharacter(randomRecipe(Math.random, i % 2 === 0))).not.toThrow();
  });
  it('skips feet for tentacle legs', () => {
    const human = meshes(buildCharacter({ ...BLANK_RECIPE, legsStyle: 'human' } as Recipe)).filter((m) => m.userData.zone === 'feet');
    const tent = meshes(buildCharacter({ ...BLANK_RECIPE, legsStyle: 'tentacles' } as Recipe)).filter((m) => m.userData.zone === 'feet');
    expect(human.length).toBe(4);
    expect(tent.length).toBe(6);
  });
  it('omits the base when disabled', () => {
    const on = meshes(buildCharacter(BLANK_RECIPE)).filter((m) => m.userData.zone === 'base');
    const off = meshes(buildCharacter({ ...BLANK_RECIPE, includeBase: false } as Recipe)).filter((m) => m.userData.zone === 'base');
    expect(on.length).toBe(1);
    expect(off.length).toBe(0);
  });
  it('shares one material per colour zone', () => {
    const mats = new Set(meshes(buildCharacter(BLANK_RECIPE)).map((m) => m.material));
    expect(mats.size).toBeLessThanOrEqual(10);
  });
  it('applies zone colours', () => {
    const g = buildCharacter({ ...BLANK_RECIPE, colors: { ...BLANK_RECIPE.colors, body: '#f43f5e' } } as Recipe);
    const body = meshes(g).find((m) => m.userData.zone === 'body')!;
    expect((body.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(new THREE.Color('#f43f5e').getHexString());
  });
});

describe('disposeObject', () => {
  it('disposes every geometry and material', () => {
    const g = buildCharacter(BLANK_RECIPE);
    const ms = meshes(g);
    const geoSpies = ms.map((m) => vi.spyOn(m.geometry, 'dispose'));
    const matSpy = vi.spyOn(ms[0]!.material as THREE.Material, 'dispose');
    disposeObject(g);
    for (const s of geoSpies) expect(s).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
  });
});

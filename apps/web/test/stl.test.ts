import { describe, expect, it } from 'vitest';
import { BLANK_RECIPE, type Recipe } from '@toyforge/shared';
import { buildCharacter } from '../src/builder/character';
import { exportStl } from '../src/builder/stl';

function zRange(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const n = v.getUint32(80, true);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const z = v.getFloat32(84 + i * 50 + 12 + k * 12 + 8, true);
      min = Math.min(min, z); max = Math.max(max, z);
    }
  }
  return { min, max, n };
}

describe('exportStl', () => {
  it('produces a consistent binary STL', () => {
    const buf = exportStl(buildCharacter(BLANK_RECIPE));
    const n = new DataView(buf).getUint32(80, true);
    expect(n).toBeGreaterThan(100);
    expect(buf.byteLength).toBe(84 + 50 * n);
  });
  it('is Z-up, sits on the bed and is 70-90 mm tall', () => {
    const { min, max } = zRange(exportStl(buildCharacter(BLANK_RECIPE)));
    expect(Math.abs(min)).toBeLessThan(0.5);
    expect(max - min).toBeGreaterThan(70);
    expect(max - min).toBeLessThan(90);
  });
  it('does not mutate the source group', () => {
    const g = buildCharacter({ ...BLANK_RECIPE, includeBase: false } as Recipe);
    exportStl(g);
    expect(g.rotation.x).toBe(0);
    expect(g.scale.x).toBe(1);
  });
});

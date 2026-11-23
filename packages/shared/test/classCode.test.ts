import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH, formatClassCode, generateClassCode, normalizeClassCode } from '../src/index';

describe('class codes', () => {
  it('uses the look-alike-free alphabet', () => {
    expect(CODE_ALPHABET).toBe('ABCDEFGHJKMNPQRSTUVWXYZ');
    expect(CODE_LENGTH).toBe(6);
  });
  it('generates valid codes', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateClassCode((n) => randomBytes(n))).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });
  it('normalizes case, spaces and dashes', () => {
    expect(normalizeClassCode(' kqm-trb ')).toBe('KQMTRB');
    expect(normalizeClassCode('KQM TRB')).toBe('KQMTRB');
  });
  it('rejects invalid codes', () => {
    expect(normalizeClassCode('KQMTR0')).toBeNull();
    expect(normalizeClassCode('KQMTRBX')).toBeNull();
    expect(normalizeClassCode('KQMTI')).toBeNull();
    expect(normalizeClassCode('')).toBeNull();
  });
  it('formats for display', () => {
    expect(formatClassCode('KQMTRB')).toBe('KQM TRB');
  });
});

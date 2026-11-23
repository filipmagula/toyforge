import { describe, expect, it } from 'vitest';
import { NAME_LIMITS, validateName } from '../src/index';

describe('validateName', () => {
  it('has the unified limits', () => {
    expect(NAME_LIMITS).toEqual({ maker: { min: 1, max: 20 }, character: { min: 0, max: 24 }, className: { min: 0, max: 40 } });
  });
  it('trims and accepts accented names', () => {
    expect(validateName('maker', '  Šimon ')).toEqual({ ok: true, value: 'Šimon' });
    expect(validateName('maker', 'Łukasz')).toEqual({ ok: true, value: 'Łukasz' });
    expect(validateName('maker', "Zoë O'Neil-Ann")).toEqual({ ok: true, value: "Zoë O'Neil-Ann" });
  });
  it('collapses inner whitespace', () => {
    expect(validateName('character', 'Captain   Tentacle')).toEqual({ ok: true, value: 'Captain Tentacle' });
  });
  it('requires a maker name', () => {
    expect(validateName('maker', '   ')).toEqual({ ok: false, error: 'required' });
  });
  it('allows empty character name', () => {
    expect(validateName('character', '')).toEqual({ ok: true, value: '' });
  });
  it('enforces max length', () => {
    expect(validateName('maker', 'a'.repeat(20)).ok).toBe(true);
    expect(validateName('maker', 'a'.repeat(21))).toEqual({ ok: false, error: 'too_long' });
    expect(validateName('className', 'a'.repeat(41))).toEqual({ ok: false, error: 'too_long' });
  });
  it('rejects emoji and markup', () => {
    expect(validateName('maker', 'Bob🙂')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateName('maker', '<b>x')).toEqual({ ok: false, error: 'invalid_chars' });
  });
  it('strips control characters', () => {
    expect(validateName('maker', 'Ma\u0000ya\u0007')).toEqual({ ok: true, value: 'Maya' });
  });
});

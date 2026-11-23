import { describe, expect, it } from 'vitest';
import { PALETTE, PART_OPTIONS, type ErrorCode } from '@toyforge/shared';
import { en } from '../src/i18n/en';
import { cs } from '../src/i18n/cs';
import { pl } from '../src/i18n/pl';
import { detectLang, format, partKey } from '../src/i18n/index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('catalogues', () => {
  for (const [lang, cat] of [['cs', cs], ['pl', pl]] as const) {
    it(`${lang} covers every en key with the same placeholders`, () => {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(cat[key], `${lang}:${key}`).toBeTruthy();
        expect(placeholders(cat[key]), `${lang}:${key}`).toEqual(placeholders(en[key]));
      }
      expect(Object.keys(cat).sort()).toEqual(Object.keys(en).sort());
    });
  }
  it('has a label for every part option and colour', () => {
    for (const [prop, values] of Object.entries(PART_OPTIONS)) {
      for (const v of values) expect(en, partKey(prop as keyof typeof PART_OPTIONS, v)).toHaveProperty(partKey(prop as keyof typeof PART_OPTIONS, v));
    }
    for (const c of PALETTE) expect(en).toHaveProperty(`color.${c.id}`);
  });
  it('has a message for every error code', () => {
    const codes: ErrorCode[] = ['validation', 'class_not_found', 'class_closed', 'class_full', 'too_large', 'rate_limited', 'unauthorized', 'not_found', 'internal'];
    for (const c of codes) expect(en).toHaveProperty(`error.${c}`);
  });
});

describe('detectLang', () => {
  it('prefers the query string', () => expect(detectLang('?lang=pl', null, ['en'])).toBe('pl'));
  it('then the saved choice', () => expect(detectLang('', 'cs', ['pl'])).toBe('cs'));
  it('then the browser languages', () => expect(detectLang('', null, ['pl-PL', 'en'])).toBe('pl'));
  it('falls back to English', () => expect(detectLang('', null, ['de'])).toBe('en'));
  it('ignores junk', () => expect(detectLang('?lang=xx', 'zz', [])).toBe('en'));
});

describe('format', () => {
  it('interpolates params', () => expect(format('We can\'t find class {code}.', { code: 'KQM TRB' })).toBe("We can't find class KQM TRB."));
  it('leaves unknown placeholders', () => expect(format('{a} {b}', { a: 1 })).toBe('1 {b}'));
});

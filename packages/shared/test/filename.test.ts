import { describe, expect, it } from 'vitest';
import { asciiSlug, stlArchiveName, stlDownloadName } from '../src/index';

describe('asciiSlug', () => {
  it('folds Polish and Czech letters', () => {
    expect(asciiSlug('Łukasz', 'x')).toBe('lukasz');
    expect(asciiSlug('Šimon', 'x')).toBe('simon');
    expect(asciiSlug('Žofie Ńová', 'x')).toBe('zofie_nova');
    expect(asciiSlug('Gęś Źdźbło', 'x')).toBe('ges_zdzblo');
  });
  it('falls back when nothing remains', () => {
    expect(asciiSlug('🙂', 'maker')).toBe('maker');
    expect(asciiSlug('', 'character')).toBe('character');
  });
  it('removes path traversal', () => {
    expect(asciiSlug('../../etc', 'x')).toBe('etc');
  });
  it('caps length at 32', () => {
    expect(asciiSlug('a'.repeat(50), 'x')).toHaveLength(32);
  });
});

describe('stl names', () => {
  it('builds the download name', () => {
    expect(stlDownloadName('Maya', 'Captain Tentacle', new Date(2026, 10, 23))).toBe('maya_captain_tentacle_20261123.stl');
    expect(stlDownloadName('Maya', '', new Date(2026, 0, 5))).toBe('maya_character_20260105.stl');
  });
  it('builds the archive name with id suffix', () => {
    expect(stlArchiveName('Maya', '', '8f14e45f-ea3c-4d2b-9a11-0192837465ab')).toBe('maya_character_8f14.stl');
  });
});

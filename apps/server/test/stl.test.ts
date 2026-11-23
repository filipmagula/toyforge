import { describe, expect, it } from 'vitest';
import { parseBinaryStl } from '../src/stl';
import { readPngSize } from '../src/png';
import { makePng, makeStl } from './fixtures';

describe('parseBinaryStl', () => {
  it('reads triangle count', () => expect(parseBinaryStl(makeStl(12))).toEqual({ triangleCount: 12 }));
  it('rejects truncated files', () => expect(parseBinaryStl(makeStl(12).subarray(0, 84 + 50 * 12 - 1))).toBeNull());
  it('rejects zero triangles', () => expect(parseBinaryStl(makeStl(0))).toBeNull());
  it('rejects too many triangles', () => {
    const b = Buffer.alloc(84); b.writeUInt32LE(200_001, 80);
    expect(parseBinaryStl(b)).toBeNull();
  });
  it('rejects ascii stl', () => expect(parseBinaryStl(Buffer.from('solid x\nendsolid x\n'))).toBeNull());
  it('rejects tiny buffers', () => expect(parseBinaryStl(Buffer.alloc(10))).toBeNull());
});

describe('readPngSize', () => {
  it('reads size', () => expect(readPngSize(makePng(64, 32))).toEqual({ width: 64, height: 32 }));
  it('rejects jpeg', () => expect(readPngSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull());
});

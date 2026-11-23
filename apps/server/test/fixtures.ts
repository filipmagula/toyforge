import { randomUUID } from 'node:crypto';
import { BLANK_RECIPE } from '@toyforge/shared';

export function makeStl(triangles: number): Buffer {
  const buf = Buffer.alloc(84 + 50 * triangles);
  buf.write('binary stl', 0);
  buf.writeUInt32LE(triangles, 80);
  for (let i = 0; i < triangles; i++) buf.writeFloatLE(i, 84 + i * 50 + 12);
  return buf;
}

export function makePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

export interface SubmissionFields {
  submissionId?: string;
  makerName?: string;
  characterName?: string;
  recipeJson?: string;
  stl?: Buffer | null;
  png?: Buffer | null;
}

export async function multipart(f: SubmissionFields = {}) {
  const fd = new FormData();
  fd.set('submissionId', f.submissionId ?? randomUUID());
  if (f.makerName !== undefined) fd.set('makerName', f.makerName); else fd.set('makerName', 'Maya');
  fd.set('characterName', f.characterName ?? 'Robot');
  fd.set('recipeJson', f.recipeJson ?? JSON.stringify(BLANK_RECIPE));
  if (f.stl !== null) fd.set('stlFile', new Blob([f.stl ?? makeStl(12)]), 'model.stl');
  if (f.png !== null) fd.set('thumbnail', new Blob([f.png ?? makePng(64, 64)]), 'thumb.png');
  const req = new Request('http://local/', { method: 'POST', body: fd });
  return { payload: Buffer.from(await req.arrayBuffer()), headers: { 'content-type': req.headers.get('content-type')! } };
}

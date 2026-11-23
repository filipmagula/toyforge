export const MAX_TRIANGLES = 200_000;

/** Validates a binary STL: 80-byte header, uint32 count, 50 bytes per triangle. */
export function parseBinaryStl(buf: Buffer): { triangleCount: number } | null {
  if (buf.length < 84) return null;
  const n = buf.readUInt32LE(80);
  if (n < 1 || n > MAX_TRIANGLES) return null;
  if (84 + 50 * n !== buf.length) return null;
  return { triangleCount: n };
}

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

/** Generates a class code using rejection sampling (no modulo bias). */
export function generateClassCode(randomBytes: (n: number) => Uint8Array): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = '';
  while (out.length < CODE_LENGTH) {
    for (const b of randomBytes(16)) {
      if (b < limit) out += CODE_ALPHABET[b % n];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

export function normalizeClassCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]+/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

export function formatClassCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

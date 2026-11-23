export const NAME_LIMITS = {
  maker: { min: 1, max: 20 },
  character: { min: 0, max: 24 },
  className: { min: 0, max: 40 },
} as const;

export type NameKind = keyof typeof NAME_LIMITS;
export type NameError = 'required' | 'too_long' | 'invalid_chars';
export type NameResult = { ok: true; value: string } | { ok: false; error: NameError };

export const UNTITLED_CHARACTER = 'Untitled Creature';

const ALLOWED = /^[\p{L}\p{M}\p{N} _'-]*$/u;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

export function validateName(kind: NameKind, raw: string): NameResult {
  const value = raw.replace(CONTROL, '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const limits = NAME_LIMITS[kind];
  const length = [...value].length;
  if (length < limits.min) return { ok: false, error: 'required' };
  if (length > limits.max) return { ok: false, error: 'too_long' };
  if (!ALLOWED.test(value)) return { ok: false, error: 'invalid_chars' };
  return { ok: true, value };
}

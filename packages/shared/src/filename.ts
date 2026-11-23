const SPECIAL: Record<string, string> = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', ß: 'ss', đ: 'd', Đ: 'D', æ: 'ae', Æ: 'AE' };

export function asciiSlug(s: string, fallback: string): string {
  const slug = s
    .replace(/[łŁøØßđĐæÆ]/g, (c) => SPECIAL[c] ?? c)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
    .replace(/_+$/g, '');
  return slug || fallback;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function stlDownloadName(maker: string, character: string, date: Date): string {
  return `${asciiSlug(maker, 'maker')}_${asciiSlug(character, 'character')}_${ymd(date)}.stl`;
}

export function stlArchiveName(maker: string, character: string, id: string): string {
  return `${asciiSlug(maker, 'maker')}_${asciiSlug(character, 'character')}_${id.slice(0, 4)}.stl`;
}

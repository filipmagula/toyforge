export type PrefKey = 'classCode' | 'makerName';
const K = (k: string) => `toyforge.${k}`;

function store(): Storage | null {
  try { return localStorage; } catch { return null; }
}

export function getPref(key: PrefKey): string | null {
  return store()?.getItem(K(key)) ?? null;
}

export function setPref(key: PrefKey, value: string | null): void {
  if (value === null || value === '') store()?.removeItem(K(key));
  else store()?.setItem(K(key), value);
}

export interface SavedTeacherClass { code: string; name: string; key: string; createdAt: string }

export function getTeacherClasses(): SavedTeacherClass[] {
  try {
    const v = JSON.parse(store()?.getItem(K('teacherClasses')) ?? '[]');
    return Array.isArray(v) ? v.filter((c) => c && typeof c.key === 'string' && typeof c.code === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTeacherClass(c: SavedTeacherClass): void {
  const list = getTeacherClasses().filter((x) => x.key !== c.key);
  list.unshift(c);
  store()?.setItem(K('teacherClasses'), JSON.stringify(list.slice(0, 50)));
}

export function forgetTeacherClass(key: string): void {
  store()?.setItem(K('teacherClasses'), JSON.stringify(getTeacherClasses().filter((x) => x.key !== key)));
}

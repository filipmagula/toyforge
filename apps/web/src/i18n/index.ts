import type { PartProp } from '@toyforge/shared';
import { en, type MessageKey } from './en';
import { cs } from './cs';
import { pl } from './pl';

export type { MessageKey } from './en';
export type Lang = 'en' | 'cs' | 'pl';
export const LANGS: readonly Lang[] = ['en', 'cs', 'pl'];
const CATALOGUES: Record<Lang, Record<MessageKey, string>> = { en, cs, pl };
const STORAGE_KEY = 'toyforge.lang';

const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export function detectLang(search: string, stored: string | null, navLangs: readonly string[]): Lang {
  const q = new URLSearchParams(search).get('lang');
  if (isLang(q)) return q;
  if (isLang(stored)) return stored;
  for (const l of navLangs) {
    const base = l.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function partKey(prop: PartProp, value: string): MessageKey {
  const group = prop === 'rightHandItem' || prop === 'leftHandItem' ? 'item' : prop;
  return `part.${group}.${value}` as MessageKey;
}

let current: Lang = 'en';

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function initLang(): Lang {
  const stored = safeStorage()?.getItem(STORAGE_KEY) ?? null;
  current = detectLang(location.search, stored, navigator.languages ?? [navigator.language]);
  const q = new URLSearchParams(location.search).get('lang');
  if (isLang(q)) safeStorage()?.setItem(STORAGE_KEY, q);
  document.documentElement.lang = current;
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  safeStorage()?.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return format(CATALOGUES[current][key] ?? en[key] ?? key, params);
}

/** Fills [data-i18n], [data-i18n-placeholder], [data-i18n-title] and [data-i18n-aria] under root. */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n as MessageKey); });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder as MessageKey); });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle as MessageKey); });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria as MessageKey)); });
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(current, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(current, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

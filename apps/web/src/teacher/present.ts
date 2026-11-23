import QRCode from 'qrcode';
import { formatClassCode } from '@toyforge/shared';
import { h } from '../dom';
import { t } from '../i18n';

export function kidUrl(code: string): string {
  return `${location.origin}/?class=${code}`;
}

export function teacherUrl(key: string): string {
  return `${location.origin}/teacher#key=${key}`;
}

export function qrCanvas(text: string, size: number): HTMLCanvasElement {
  const c = h('canvas', { class: 'rounded-xl bg-white', 'aria-hidden': 'true' });
  void QRCode.toCanvas(c, text, { width: size, margin: 1, errorCorrectionLevel: 'M' });
  return c;
}

/** Full-screen view for projecting the code + QR to the room. */
export function openPresentation(code: string, name: string): void {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.42;
  const overlay = h('div', { class: 'fixed inset-0 z-[70] bg-gradient-to-b from-sky-200 to-indigo-100 flex flex-col items-center justify-center gap-6 p-6 text-center cursor-pointer', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' },
    name ? h('p', { class: 'text-3xl md:text-4xl font-bold text-sky-900' }, name) : null,
    h('p', { class: 'text-xl md:text-2xl font-medium text-slate-600' }, t('present.goTo', { url: location.host })),
    h('p', { class: 'text-7xl md:text-9xl font-bold tracking-[0.15em] text-slate-900 bg-white px-8 py-4 rounded-3xl shadow-xl border-4 border-amber-400' }, formatClassCode(code)),
    qrCanvas(kidUrl(code), Math.round(size)),
    h('p', { class: 'text-sm text-slate-500' }, t('present.closeHint')),
  );
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  void overlay.requestFullscreen?.().catch(() => undefined);
}

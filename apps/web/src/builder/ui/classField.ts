import { formatClassCode, normalizeClassCode, type ClassInfo, type ErrorCode } from '@toyforge/shared';
import { h } from '../../dom';
import { icon } from '../../icons';
import { t } from '../../i18n';
import { getPref, setPref } from '../../prefs';
import { lookupClass } from '../../net/api';

export interface ClassState {
  get(): ClassInfo | null;
  subscribe(fn: (c: ClassInfo | null) => void): void;
  /** Validates and joins; returns an error code on failure. */
  join(raw: string): Promise<{ ok: true; info: ClassInfo } | { ok: false; error: ErrorCode | 'network' | 'format' }>;
  leave(): void;
  refresh(): Promise<void>;
}

export function createClassState(): ClassState {
  let current: ClassInfo | null = null;
  const fns = new Set<(c: ClassInfo | null) => void>();
  const emit = () => fns.forEach((fn) => fn(current));
  const storedCode = getPref('classCode');
  // Optimistically show the remembered code until refresh() confirms it.
  if (storedCode) current = { code: storedCode, name: '', isOpen: true };

  return {
    get: () => current,
    subscribe(fn) { fns.add(fn); },
    async join(raw) {
      const code = normalizeClassCode(raw);
      if (!code) return { ok: false, error: 'format' };
      const r = await lookupClass(code);
      if (r.kind === 'error') return { ok: false, error: r.error };
      current = r.info;
      setPref('classCode', r.info.code);
      emit();
      return { ok: true, info: r.info };
    },
    leave() { current = null; setPref('classCode', null); emit(); },
    async refresh() {
      if (!current) return;
      const r = await lookupClass(current.code);
      if (r.kind === 'ok') { current = r.info; emit(); }
      else if (r.error === 'class_not_found') { current = null; setPref('classCode', null); emit(); }
      // network errors: keep the remembered code, the offline queue will handle sending later
    },
  };
}

export function classErrorText(error: ErrorCode | 'network' | 'format', code: string): string {
  if (error === 'format') return t('class.badFormat');
  if (error === 'network') return t('error.network');
  return t(`error.${error}`, { code: formatClassCode(code) });
}

export function classLabel(c: ClassInfo): string {
  return t('top.classActive', { name: c.name || formatClassCode(c.code) });
}

/** Modal dialog to enter / change the class code. Resolves when closed. */
export function openClassDialog(state: ClassState): Promise<void> {
  return new Promise((resolve) => {
    const current = state.get();
    const input = h('input', {
      type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: 9,
      value: current ? formatClassCode(current.code) : '',
      placeholder: 'ABC DEF',
      class: 'w-full text-center tracking-[0.3em] uppercase text-2xl font-bold px-3 py-3 rounded-xl border-2 border-slate-300 focus:border-sky-500 focus:outline-none',
      'aria-label': t('class.title'),
    });
    const msg = h('p', { class: 'min-h-5 text-sm font-bold text-rose-500', role: 'status' });
    const joinBtn = h('button', { type: 'submit', class: 'toy-btn w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-[0_4px_0_#065f46]' }, t('class.join'));
    const close = () => { overlay.remove(); resolve(); };
    const form = h('form', { class: 'space-y-3' }, input, msg, joinBtn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.className = 'min-h-5 text-sm font-bold text-slate-500';
      msg.textContent = t('class.checking');
      joinBtn.disabled = true;
      const r = await state.join(input.value);
      joinBtn.disabled = false;
      if (r.ok) {
        msg.className = 'min-h-5 text-sm font-bold text-emerald-600';
        msg.textContent = t('class.joined', { name: r.info.name || formatClassCode(r.info.code) });
        setTimeout(close, 700);
      } else {
        msg.className = 'min-h-5 text-sm font-bold text-rose-500';
        msg.textContent = classErrorText(r.error, normalizeClassCode(input.value) ?? input.value.toUpperCase());
      }
    });
    const card = h('div', { class: 'bg-white rounded-3xl max-w-sm w-full p-5 md:p-6 shadow-2xl border-4 border-sky-400 text-center space-y-3' },
      h('div', { class: 'w-12 h-12 bg-sky-100 text-sky-500 rounded-full flex items-center justify-center mx-auto' }, icon('School', 'w-6 h-6')),
      h('h2', { class: 'text-xl font-bold text-slate-800' }, t('class.title')),
      h('p', { class: 'text-sm text-slate-500' }, t('class.prompt')),
      form,
      current ? h('button', { type: 'button', class: 'text-rose-500 font-bold text-sm', onclick: () => { state.leave(); close(); } }, t('class.leave')) : null,
      h('button', { type: 'button', class: 'block mx-auto text-slate-400 hover:text-slate-600 font-bold text-xs py-1', onclick: close }, t('class.cancel')),
    );
    const overlay = h('div', { class: 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-3', role: 'dialog', 'aria-modal': 'true' }, card);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.append(overlay);
    input.focus();
    input.select();
  });
}

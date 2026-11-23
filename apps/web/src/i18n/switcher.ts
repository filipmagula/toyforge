import { h, clear } from '../dom';
import { getLang, LANGS, setLang } from './index';

/** Renders EN · CS · PL buttons into el and keeps them in sync. */
export function mountLangSwitcher(el: HTMLElement, cls = ''): void {
  const render = () => {
    clear(el);
    el.className = `flex items-center gap-0.5 rounded-xl bg-white/90 p-0.5 shadow border border-sky-200 ${cls}`;
    for (const l of LANGS) {
      const active = l === getLang();
      el.append(
        h('button', {
          type: 'button',
          class: `px-2 py-1 rounded-lg text-xs font-bold ${active ? 'bg-sky-500 text-white' : 'text-slate-500 hover:bg-sky-50'}`,
          'aria-pressed': String(active),
          lang: l,
          onclick: () => setLang(l),
        }, l.toUpperCase()),
      );
    }
  };
  render();
  window.addEventListener('langchange', render);
}

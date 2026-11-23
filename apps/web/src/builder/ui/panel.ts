import { PALETTE, PART_OPTIONS, SCALE_RANGES, type Recipe } from '@toyforge/shared';
import { clear, h } from '../../dom';
import { icon } from '../../icons';
import { partKey, t, type MessageKey } from '../../i18n';
import { CATEGORIES, type Section, type Store } from '../options';

export function mountPanel(els: { tabs: HTMLElement; options: HTMLElement; colorLabel: HTMLElement; swatches: HTMLElement }, store: Store) {
  let active = CATEGORIES[0]!.id;

  const renderTabs = () => {
    clear(els.tabs);
    for (const cat of CATEGORIES) {
      const on = cat.id === active;
      els.tabs.append(
        h('button', {
          type: 'button',
          class: `toy-btn shrink-0 px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm whitespace-nowrap flex items-center gap-1.5 ${on ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-sky-100'}`,
          'aria-pressed': String(on),
          onclick: () => { active = cat.id; renderAll(); },
        }, icon(cat.icon, 'w-4 h-4'), h('span', {}, t(cat.labelKey))),
      );
    }
  };

  const grid = (s: Extract<Section, { kind: 'grid' }>, r: Recipe) => {
    const g = h('div', { class: 'grid grid-cols-4 sm:grid-cols-3 gap-1.5 md:gap-2.5' });
    for (const v of PART_OPTIONS[s.prop]) {
      const on = r[s.prop] === v;
      g.append(
        h('button', {
          type: 'button',
          class: `toy-btn min-h-14 py-1.5 px-1 md:p-3 rounded-xl md:rounded-2xl border-2 flex flex-col items-center justify-center gap-1 md:gap-1.5 text-center ${on ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-sky-50 hover:border-sky-200 font-medium'}`,
          'aria-pressed': String(on),
          onclick: () => store.set({ [s.prop]: v } as Partial<Recipe>),
        },
        icon(s.icons[v]!, `w-5 h-5 md:w-7 md:h-7 ${on ? 'text-amber-500' : 'text-slate-400'}`),
        h('span', { class: 'text-[10px] md:text-xs leading-tight w-full truncate' }, t(partKey(s.prop, v)))),
      );
    }
    return h('div', {}, h('h3', { class: 'text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2' }, t(s.titleKey)), g);
  };

  const slider = (s: Extract<Section, { kind: 'slider' }>, r: Recipe) => {
    const [min, max, step] = SCALE_RANGES[s.prop];
    const label = h('span', {}, `${Math.round(r[s.prop] * 100)}%`);
    const input = h('input', { type: 'range', min, max, step, value: r[s.prop], class: 'w-full cursor-pointer', 'aria-label': t(s.titleKey) });
    // Update scene + label only: re-rendering the panel mid-drag would drop pointer capture.
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      label.textContent = `${Math.round(v * 100)}%`;
      store.set({ [s.prop]: v } as Partial<Recipe>, 'slider');
    });
    return h('div', { class: 'bg-sky-50 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl border border-sky-200' },
      h('div', { class: 'flex justify-between text-xs md:text-sm font-bold text-sky-900 mb-2' }, h('span', {}, t(s.titleKey)), label),
      input);
  };

  const renderOptions = () => {
    const r = store.get();
    const cat = CATEGORIES.find((c) => c.id === active)!;
    clear(els.options);
    for (const s of cat.sections) {
      if (s.kind === 'grid' && s.visible && !s.visible(r)) continue;
      els.options.append(s.kind === 'grid' ? grid(s, r) : slider(s, r));
    }
    els.colorLabel.textContent = t('panel.colorFor', { part: t(cat.labelKey) });
    clear(els.swatches);
    for (const c of PALETTE) {
      const on = r.colors[cat.colorZone].toLowerCase() === c.hex.toLowerCase();
      const name = t(`color.${c.id}` as MessageKey);
      els.swatches.append(
        h('button', {
          type: 'button',
          title: name,
          'aria-label': name,
          'aria-pressed': String(on),
          class: `w-8 h-8 md:w-9 md:h-9 rounded-full shrink-0 border-2 transition-transform ${on ? 'scale-110 border-slate-900 ring-2 ring-sky-400' : 'border-white shadow'}`,
          style: `background-color:${c.hex}`,
          onclick: () => store.set({ colors: { ...store.get().colors, [cat.colorZone]: c.hex } }),
        }),
      );
    }
  };

  const renderAll = () => { renderTabs(); renderOptions(); };
  store.subscribe((_r, source) => { if (source !== 'slider') renderOptions(); });
  window.addEventListener('langchange', renderAll);
  renderAll();
}

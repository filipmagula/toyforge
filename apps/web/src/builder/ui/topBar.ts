import { BLANK_RECIPE, randomRecipe } from '@toyforge/shared';
import { clear, h } from '../../dom';
import { icon } from '../../icons';
import { t } from '../../i18n';
import { getPref, setPref } from '../../prefs';
import type { Store } from '../options';
import { classLabel, openClassDialog, type ClassState } from './classField';

const btn = 'toy-btn text-white font-bold py-1.5 px-2.5 md:py-2.5 md:px-4 rounded-xl md:rounded-2xl flex items-center gap-1.5 text-xs md:text-base';

export function mountTopBar(el: HTMLElement, store: Store) {
  const nick = h('input', {
    type: 'text', maxlength: 20, autocomplete: 'nickname', value: getPref('makerName') ?? '',
    class: 'bg-transparent text-xs md:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none w-24 sm:w-32 md:w-36',
  });
  nick.addEventListener('input', () => setPref('makerName', nick.value.trim()));

  const brand = h('div', { class: 'bg-white/95 backdrop-blur-md px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl shadow-lg border-2 border-sky-300 pointer-events-auto flex items-center gap-2 md:gap-3' });
  const actions = h('div', { class: 'flex gap-1.5 md:gap-2 pointer-events-auto' });

  const render = () => {
    clear(brand);
    nick.placeholder = t('top.nicknamePlaceholder');
    nick.setAttribute('aria-label', t('finish.nickname'));
    brand.append(
      h('div', { class: 'bg-amber-400 text-white w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner shrink-0' }, icon('Package', 'w-5 h-5 md:w-6 md:h-6')),
      h('div', { class: 'hidden lg:block' },
        h('h1', { class: 'text-lg md:text-xl font-bold text-sky-900 leading-none' }, t('app.title')),
        h('p', { class: 'text-[11px] text-sky-600 font-medium' }, t('app.tagline'))),
      h('div', { class: 'flex items-center bg-sky-50 border-2 border-sky-200 focus-within:border-amber-400 rounded-lg md:rounded-xl px-2 py-1' }, icon('UserRound', 'w-4 h-4 text-sky-500 mr-1.5'), nick),
    );
    const base = store.get().includeBase;
    clear(actions);
    actions.append(
      h('button', { type: 'button', title: t('top.blankTitle'), 'aria-label': t('top.blank'), class: `${btn} bg-sky-500 hover:bg-sky-600 shadow-[0_3px_0_#0369a1] md:shadow-[0_4px_0_#0369a1]`, onclick: () => store.replace({ ...BLANK_RECIPE, includeBase: store.get().includeBase }) },
        icon('RotateCcw', 'w-4 h-4 md:w-5 md:h-5'), h('span', { class: 'hidden sm:inline' }, t('top.blank'))),
      h('button', { type: 'button', title: t('top.mixTitle'), 'aria-label': t('top.mix'), class: `${btn} bg-purple-500 hover:bg-purple-600 shadow-[0_3px_0_#6b21a8] md:shadow-[0_4px_0_#6b21a8]`, onclick: () => store.replace(randomRecipe(Math.random, store.get().includeBase)) },
        icon('Dices', 'w-4 h-4 md:w-5 md:h-5'), h('span', { class: 'hidden sm:inline' }, t('top.mix'))),
      h('button', { type: 'button', title: t('top.baseTitle'), 'aria-label': t(base ? 'top.baseOn' : 'top.baseOff'), 'aria-pressed': String(base), class: `${btn} ${base ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_3px_0_#065f46] md:shadow-[0_4px_0_#065f46]' : 'bg-slate-400 shadow-[0_3px_0_#475569] md:shadow-[0_4px_0_#475569]'}`, onclick: () => store.set({ includeBase: !store.get().includeBase }) },
        icon(base ? 'CircleDot' : 'CircleDashed', 'w-4 h-4 md:w-5 md:h-5'), h('span', { class: 'hidden sm:inline' }, t(base ? 'top.baseOn' : 'top.baseOff'))),
    );
  };

  el.className = 'absolute top-2.5 left-2.5 right-2.5 md:top-4 md:left-4 md:right-4 z-10 flex flex-wrap justify-between items-center pointer-events-none gap-1.5 md:gap-2';
  el.append(brand, actions);
  render();
  store.subscribe((_r, source) => { if (source !== 'slider') render(); });
  window.addEventListener('langchange', render);
  return { setNickname(v: string) { if (nick.value !== v) nick.value = v; } };
}

export function mountClassPill(el: HTMLElement, state: ClassState) {
  const render = () => {
    clear(el);
    const c = state.get();
    el.append(
      h('button', {
        type: 'button',
        class: `toy-btn flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border-2 ${c ? (c.isOpen ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-amber-50 border-amber-300 text-amber-700') : 'bg-white border-sky-200 text-sky-600'}`,
        onclick: () => void openClassDialog(state),
      },
      icon('School', 'w-4 h-4'),
      h('span', { class: 'truncate max-w-[12rem]' }, c ? classLabel(c) : t('top.addClass')),
      c && c.name ? icon(c.isOpen ? 'Check' : 'Lock', 'w-3.5 h-3.5') : null),
    );
    if (c && !c.isOpen) el.append(h('span', { class: 'text-[10px] text-amber-600 font-bold' }, t('class.closedNote')));
  };
  state.subscribe(render);
  window.addEventListener('langchange', render);
  render();
}

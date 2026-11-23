import '../styles.css';
import { BLANK_RECIPE } from '@toyforge/shared';
import { h } from '../dom';
import { icon } from '../icons';
import { applyI18n, initLang, t } from '../i18n';
import { mountLangSwitcher } from '../i18n/switcher';
import { hasWebGL2 } from '../webgl';
import { memoryQueue, openQueue } from '../net/queue';
import { createSync } from '../net/sync';
import { createScene } from './scene';
import { createStore } from './options';
import { mountPanel } from './ui/panel';
import { mountClassPill, mountTopBar } from './ui/topBar';
import { createFinishModal } from './ui/finishModal';
import { createClassState } from './ui/classField';

function unsupported(root: HTMLElement) {
  const render = () => {
    root.replaceChildren(
      h('div', { class: 'min-h-dvh flex items-center justify-center p-6' },
        h('div', { class: 'max-w-md bg-white rounded-3xl border-4 border-sky-300 p-6 text-center shadow-xl space-y-3' },
          h('div', { class: 'w-14 h-14 mx-auto bg-amber-100 text-amber-500 rounded-full flex items-center justify-center' }, icon('TriangleAlert', 'w-7 h-7')),
          h('h1', { class: 'text-xl font-bold text-slate-800' }, t('unsupported.title')),
          h('p', { class: 'text-slate-600' }, t('unsupported.body')),
          h('div', { id: 'lang' }))),
    );
    mountLangSwitcher(root.querySelector('#lang')!, 'inline-flex');
  };
  render();
  window.addEventListener('langchange', render);
}

async function main() {
  initLang();
  const root = document.getElementById('app')!;
  document.title = t('app.title');
  if (!hasWebGL2()) return unsupported(root);
  document.body.classList.add('builder');

  const viewport = h('div', { class: 'relative w-full h-[46%] md:w-3/5 lg:w-2/3 md:h-full bg-gradient-to-b from-sky-200 via-sky-100 to-indigo-100 flex flex-col' });
  const topBar = h('div');
  const canvasBox = h('div', { class: 'absolute inset-0 cursor-grab active:cursor-grabbing' });
  const finishBtn = h('button', { type: 'button', class: 'toy-btn pointer-events-auto bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold py-2 px-4 md:py-3 md:px-6 rounded-xl md:rounded-2xl shadow-[0_4px_0_#c2410c] md:shadow-[0_5px_0_#c2410c] flex items-center gap-2 text-sm md:text-lg' },
    icon('Rocket', 'w-5 h-5 md:w-6 md:h-6'), h('span', { 'data-i18n': 'builder.finish' }));
  const bottom = h('div', { class: 'absolute bottom-2.5 left-2.5 right-2.5 md:bottom-4 md:left-4 md:right-4 z-10 flex justify-between items-end pointer-events-none gap-2' },
    h('div', { class: 'bg-white/85 backdrop-blur px-2.5 py-1 rounded-lg md:rounded-xl text-[11px] md:text-xs font-medium text-slate-600 shadow border border-white flex items-center gap-1.5' },
      icon('Pointer', 'w-3.5 h-3.5 text-sky-500'),
      h('span', { class: 'hidden sm:inline', 'data-i18n': 'view.hint' }),
      h('span', { class: 'sm:hidden', 'data-i18n': 'view.hintShort' })),
    finishBtn);
  viewport.append(canvasBox, topBar, bottom);

  const classPill = h('div', { class: 'flex items-center gap-2 min-w-0' });
  const lang = h('div');
  const tabs = h('div', { class: 'flex overflow-x-auto bg-slate-100 p-1 md:p-1.5 gap-1 md:gap-1.5 border-b border-slate-200 shrink-0' });
  const options = h('div', { class: 'flex-1 overflow-y-auto p-2.5 md:p-4 space-y-3 md:space-y-5' });
  const colorLabel = h('span', { class: 'text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-500' });
  const swatches = h('div', { class: 'flex gap-1.5 md:gap-2 overflow-x-auto pb-0.5 pt-1 px-0.5' });
  const panel = h('div', { class: 'w-full h-[54%] md:w-2/5 lg:w-1/3 md:h-full bg-white border-t-4 md:border-t-0 md:border-l-4 border-sky-200 flex flex-col shadow-2xl z-20' },
    h('div', { class: 'px-2.5 py-1.5 bg-sky-50 border-b border-sky-100 flex justify-between items-center gap-2 shrink-0' }, classPill, lang),
    tabs,
    options,
    h('div', { class: 'px-2.5 py-2 md:p-3 bg-slate-50 border-t-2 border-slate-200 shrink-0' },
      h('div', { class: 'flex items-center justify-between mb-1' }, colorLabel, h('span', { class: 'text-[10px] md:text-xs text-slate-400', 'data-i18n': 'panel.colorHint' })),
      swatches,
      h('div', { class: 'flex justify-center gap-3 pt-1.5 text-[10px] text-slate-400' },
        h('a', { href: '/privacy', class: 'hover:text-sky-600', 'data-i18n': 'footer.privacy' }),
        h('a', { href: '/teacher', class: 'hover:text-sky-600', 'data-i18n': 'footer.teacher' }))),
  );
  root.className = 'h-dvh w-screen flex flex-col md:flex-row text-slate-800';
  root.append(viewport, panel);

  const store = createStore(BLANK_RECIPE);
  const scene = createScene(canvasBox);
  scene.setCharacter(store.get());
  store.subscribe((r) => scene.setCharacter(r));

  const classState = createClassState();
  const queue = await openQueue().catch(() => memoryQueue());
  const sync = createSync(queue);

  const bar = mountTopBar(topBar, store);
  mountPanel({ tabs, options, colorLabel, swatches }, store);
  mountClassPill(classPill, classState);
  mountLangSwitcher(lang);
  const modal = createFinishModal({ scene, getRecipe: () => store.get(), classState, queue, sync, onNameChange: (v) => bar.setNickname(v) });
  finishBtn.addEventListener('click', () => void modal.open());
  sync.onChange(() => { if (modal.isOpen()) void modal.refresh(); });
  classState.subscribe(() => { if (modal.isOpen()) void modal.refresh(); });

  applyI18n(root);
  window.addEventListener('langchange', () => { applyI18n(root); document.title = t('app.title'); if (modal.isOpen()) void modal.refresh(); });

  // ?class=CODE from the teacher's link / QR code
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('class');
  if (fromUrl) {
    params.delete('class');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    const r = await classState.join(fromUrl);
    if (!r.ok) void classState.refresh();
  } else {
    void classState.refresh();
  }
  sync.start();
}

void main();

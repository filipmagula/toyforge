import type { ModelSummary } from '@toyforge/shared';
import { h } from '../dom';
import { t } from '../i18n';
import { hasWebGL2 } from '../webgl';
import { createScene } from '../builder/scene';
import { button } from './ui';

/** Rebuilds a submitted model from its recipe and shows it in an orbitable 3D view. */
export function openViewer(m: ModelSummary): void {
  if (!hasWebGL2()) return;
  const box = h('div', { class: 'w-full h-[60dvh] rounded-2xl overflow-hidden bg-gradient-to-b from-sky-200 to-indigo-100' });
  const overlay = h('div', { class: 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3', role: 'dialog', 'aria-modal': 'true' });
  let handle: ReturnType<typeof createScene> | null = null;
  const close = () => { handle?.dispose(); overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  overlay.append(h('div', { class: 'bg-white rounded-3xl max-w-3xl w-full p-4 space-y-3' },
    h('div', { class: 'flex items-center justify-between gap-2' },
      h('p', { class: 'font-bold text-slate-800 truncate' }, `${m.characterName} — ${t('dash.by', { maker: m.makerName })}`),
      button(t('dash.close3d'), close, { small: true, icon: 'X' })),
    box));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  handle = createScene(box);
  handle.setCharacter(m.recipe);
}

import { formatClassCode, stlDownloadName, UNTITLED_CHARACTER, validateName, type Recipe } from '@toyforge/shared';
import { clear, downloadBlob, h } from '../../dom';
import { icon } from '../../icons';
import { t, type MessageKey } from '../../i18n';
import { getPref, setPref } from '../../prefs';
import type { Queue, Submission } from '../../net/queue';
import type { Sync } from '../../net/sync';
import { exportStl } from '../stl';
import { captureThumbnail } from '../thumbnail';
import type { SceneHandle } from '../scene';
import { classErrorText, openClassDialog, type ClassState } from './classField';

interface Deps {
  scene: SceneHandle;
  getRecipe: () => Recipe;
  classState: ClassState;
  queue: Queue;
  sync: Sync;
  onNameChange: (name: string) => void;
}

type Feedback = { tone: 'ok' | 'warn' | 'error'; text: string } | null;

export function createFinishModal(deps: Deps) {
  let overlay: HTMLElement | null = null;
  let feedback: Feedback = null;
  let sending = false;
  let characterName = '';
  // Re-sending the very same model (same recipe, names, class) reuses its id, so the server dedupes it.
  let lastSend: { key: string; id: string } | null = null;

  const close = () => { overlay?.remove(); overlay = null; };

  function readNames(makerInput: HTMLInputElement, charInput: HTMLInputElement, errorEl: HTMLElement) {
    const maker = validateName('maker', makerInput.value);
    const character = validateName('character', charInput.value);
    errorEl.textContent = '';
    makerInput.classList.remove('border-rose-500');
    if (!maker.ok) {
      errorEl.textContent = t(`name.${maker.error}` as MessageKey);
      makerInput.classList.add('border-rose-500');
      makerInput.focus();
      return null;
    }
    if (!character.ok) {
      errorEl.textContent = t(`name.${character.error}` as MessageKey);
      charInput.focus();
      return null;
    }
    setPref('makerName', maker.value);
    deps.onNameChange(maker.value);
    characterName = character.value;
    return { maker: maker.value, character: character.value };
  }

  function download(maker: string, character: string) {
    const stl = exportStl(deps.scene.current());
    const file = stlDownloadName(maker, character, new Date());
    downloadBlob(new Blob([stl], { type: 'model/stl' }), file);
    feedback = { tone: 'ok', text: t('finish.downloaded', { file }) };
  }

  async function send(maker: string, character: string) {
    const cls = deps.classState.get();
    if (!cls) return;
    const stl = exportStl(deps.scene.current());
    const thumbnail = await (await captureThumbnail(deps.scene)).arrayBuffer();
    const recipe = structuredClone(deps.getRecipe());
    const key = JSON.stringify([cls.code, maker, character, recipe]);
    if (lastSend?.key !== key) lastSend = { key, id: crypto.randomUUID() };
    const s: Submission = {
      submissionId: lastSend.id,
      code: cls.code,
      makerName: maker,
      characterName: character,
      recipe,
      stl,
      thumbnail,
      createdAt: new Date().toISOString(),
    };
    const r = await deps.sync.submitOrQueue(s);
    if (r.kind === 'sent') feedback = { tone: 'ok', text: t('finish.sent', { maker, character: r.response.characterName || character || UNTITLED_CHARACTER }) };
    else if (r.kind === 'queued') feedback = { tone: 'warn', text: t('finish.queued') };
    else if (r.kind === 'rejected') feedback = { tone: 'error', text: classErrorText(r.error, cls.code) };
  }

  async function render() {
    if (!overlay) return;
    const cls = deps.classState.get();
    const items = await deps.queue.all().catch(() => [] as Submission[]);
    const pending = items.filter((s) => !s.rejected);
    const rejected = items.filter((s) => s.rejected);

    const makerInput = h('input', {
      type: 'text', maxlength: 20, autocomplete: 'nickname', value: getPref('makerName') ?? '',
      placeholder: t('finish.nicknamePlaceholder'),
      class: 'w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 focus:border-sky-500 focus:outline-none font-bold text-slate-800 text-base',
    });
    const charInput = h('input', {
      type: 'text', maxlength: 24, autocomplete: 'off', value: characterName,
      placeholder: t('finish.characterPlaceholder'),
      class: 'w-full px-3.5 py-2 rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:outline-none font-medium text-slate-700 text-base',
    });
    charInput.addEventListener('input', () => { characterName = charInput.value; });
    makerInput.addEventListener('input', () => { setPref('makerName', makerInput.value.trim()); deps.onNameChange(makerInput.value.trim()); });
    const errorEl = h('p', { class: 'text-rose-500 text-xs font-bold mt-1 min-h-4', role: 'alert' });

    const doDownload = async () => {
      const names = readNames(makerInput, charInput, errorEl);
      if (!names) return;
      download(names.maker, names.character);
      await render();
    };
    // Only sending is exclusive; Download must keep working while an upload hangs.
    const doSend = async () => {
      if (sending) return;
      const names = readNames(makerInput, charInput, errorEl);
      if (!names) return;
      sending = true;
      feedback = null;
      await render();
      try { await send(names.maker, names.character); } finally { sending = false; await render(); }
    };

    const sendBtn = cls
      ? h('button', { type: 'button', disabled: sending, class: 'toy-btn w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-bold py-3 rounded-xl shadow-[0_4px_0_#065f46] flex items-center justify-center gap-2 text-sm md:text-base disabled:opacity-60', onclick: doSend },
          icon('Send', 'w-5 h-5'), h('span', {}, sending ? t('finish.sending') : t('finish.sendTo', { code: formatClassCode(cls.code) })))
      : h('button', { type: 'button', class: 'toy-btn w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl shadow-[0_4px_0_#065f46] flex items-center justify-center gap-2 text-sm', onclick: async () => { await openClassDialog(deps.classState); await render(); } },
          icon('School', 'w-5 h-5'), h('span', {}, t('finish.send')));
    const downloadBtn = h('button', { type: 'button', class: `toy-btn w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold ${cls ? 'py-2.5 text-sm' : 'py-3 text-sm md:text-base'} rounded-xl shadow-[0_4px_0_#c2410c] flex items-center justify-center gap-2`, onclick: doDownload },
      icon('Download', 'w-5 h-5'), h('span', {}, t('finish.download')));

    const toneCls = { ok: 'bg-emerald-50 border-emerald-200 text-emerald-800', warn: 'bg-amber-50 border-amber-200 text-amber-800', error: 'bg-rose-50 border-rose-200 text-rose-800' };

    const rejectedList = rejected.length
      ? h('div', { class: 'text-left bg-rose-50 border border-rose-200 rounded-xl p-2.5 space-y-1.5' },
          h('p', { class: 'text-xs font-bold text-rose-700' }, t('finish.rejectedTitle')),
          ...rejected.map((s) => h('div', { class: 'flex items-center gap-2 text-xs' },
            h('span', { class: 'flex-1 truncate text-slate-700' }, t('finish.rejectedItem', { character: s.characterName || UNTITLED_CHARACTER, maker: s.makerName }), ' — ', classErrorText(s.rejected!, s.code)),
            h('button', { type: 'button', class: 'font-bold text-sky-600', onclick: () => downloadBlob(new Blob([s.stl], { type: 'model/stl' }), stlDownloadName(s.makerName, s.characterName, new Date(s.createdAt))) }, t('finish.downloadItem')),
            h('button', { type: 'button', class: 'font-bold text-rose-600', onclick: async () => { await deps.queue.remove(s.submissionId); await render(); } }, t('finish.discard')),
          )))
      : null;

    const card = h('div', { class: 'bg-white rounded-3xl max-w-md w-full max-h-[95dvh] overflow-y-auto p-5 md:p-6 shadow-2xl border-4 border-amber-400 text-center' },
      h('div', { class: 'w-14 h-14 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3' }, icon('Trophy', 'w-7 h-7')),
      h('h2', { class: 'text-xl md:text-2xl font-bold text-slate-800 mb-1' }, t('finish.title')),
      h('p', { class: 'text-slate-500 text-xs md:text-sm mb-4' }, t('finish.subtitle')),
      h('div', { class: 'space-y-2.5 text-left mb-4' },
        h('label', { class: 'block' },
          h('span', { class: 'block text-xs font-bold text-slate-700 mb-1' }, t('finish.nickname'), ' ', h('span', { class: 'text-rose-500' }, t('finish.required'))),
          makerInput,
          h('span', { class: 'block text-[11px] text-slate-400 mt-1' }, t('finish.nicknameHint')),
          errorEl),
        h('label', { class: 'block' },
          h('span', { class: 'block text-xs font-bold text-slate-700 mb-1' }, t('finish.character'), ' ', h('span', { class: 'text-slate-400 font-normal' }, t('finish.optional'))),
          charInput),
      ),
      h('div', { class: 'space-y-2.5 mb-3' }, ...(cls ? [sendBtn, downloadBtn] : [downloadBtn, sendBtn])),
      !cls ? h('p', { class: 'text-[11px] text-slate-400 mb-3' }, t('finish.noClassHint')) : null,
      feedback ? h('div', { class: `border rounded-xl p-2.5 text-xs font-medium mb-3 ${toneCls[feedback.tone]}`, role: 'status' }, feedback.text) : null,
      pending.length ? h('p', { class: 'text-xs font-bold text-amber-600 mb-3 flex items-center justify-center gap-1' }, icon('CloudOff', 'w-4 h-4'), t('finish.pending', { count: pending.length })) : null,
      rejectedList,
      h('button', { type: 'button', class: 'mt-2 text-slate-400 hover:text-slate-600 font-bold text-xs py-1', onclick: close }, t('finish.back')),
    );

    clear(overlay);
    overlay.append(card);
  }

  return {
    async open() {
      if (overlay) return;
      feedback = null;
      overlay = h('div', { class: 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4', role: 'dialog', 'aria-modal': 'true' });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      document.body.append(overlay);
      await render();
    },
    /** Re-render unless the kid is typing in the form. */
    refresh: () => (overlay && overlay.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement ? Promise.resolve() : render()),
    isOpen: () => !!overlay,
  };
}

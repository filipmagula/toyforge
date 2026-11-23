import { formatClassCode, PRINT_STATUSES, type ModelSummary, type PrintStatus, type TeacherClass } from '@toyforge/shared';
import { clear, downloadBlob, formatBytes, h } from '../dom';
import { icon } from '../icons';
import { formatDate, formatTime, t } from '../i18n';
import { forgetTeacherClass, saveTeacherClass } from '../prefs';
import { ApiFailure, teacherApi, type TeacherApi } from './api';
import { kidUrl, openPresentation, teacherUrl } from './present';
import { button, card, copyButton } from './ui';
import { openViewer } from './viewer';

type Filter = PrintStatus | 'all';

const pill: Record<PrintStatus, string> = {
  new: 'bg-sky-100 text-sky-700',
  queued: 'bg-amber-100 text-amber-700',
  printed: 'bg-emerald-100 text-emerald-700',
};

export function renderDashboard(root: HTMLElement, key: string): () => void {
  const api = teacherApi(key);
  let cls: TeacherClass | null = null;
  let models: ModelSummary[] = [];
  let filter: Filter = 'all';
  let error: string | null = null;
  let stopped = false;

  const header = h('section', { class: `${card} space-y-4` });
  const summary = h('section', { class: `${card} space-y-3` });
  const grid = h('div', { class: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' });
  const gallery = h('section', { class: 'space-y-3' });

  async function load() {
    try {
      const [c, m] = await Promise.all([api.getClass(), api.listModels('all')]);
      cls = c;
      models = m;
      error = null;
      saveTeacherClass({ code: c.code, name: c.name, key, createdAt: c.createdAt });
    } catch (e) {
      error = e instanceof ApiFailure ? e.code : 'internal';
    }
    render();
  }

  async function act(fn: (a: TeacherApi) => Promise<unknown>) {
    try { await fn(api); } catch (e) { alert(t(`error.${e instanceof ApiFailure ? e.code : 'internal'}`, { code: '' })); }
    await load();
  }

  function renderError() {
    clear(root);
    const unauthorized = error === 'unauthorized';
    root.append(h('section', { class: `${card} space-y-4 text-center` },
      h('div', { class: 'w-14 h-14 mx-auto bg-rose-100 text-rose-500 rounded-full flex items-center justify-center' }, icon('TriangleAlert', 'w-7 h-7')),
      h('p', { class: 'font-bold text-slate-700' }, t(unauthorized ? 'error.unauthorized' : error === 'network' ? 'error.network' : 'error.internal', { code: '' })),
      h('div', { class: 'flex flex-wrap gap-2 justify-center' },
        unauthorized ? button(t('teacher.forget'), () => { forgetTeacherClass(key); location.hash = ''; }, { tone: 'danger', icon: 'Trash2' }) : button(t('dash.refresh'), () => void load(), { icon: 'RefreshCw' }),
        button(t('dash.backToStart'), () => { location.hash = ''; }, { icon: 'ChevronLeft' }))));
  }

  function renderHeader(c: TeacherClass) {
    clear(header);
    header.append(
      h('div', { class: 'flex flex-wrap items-start justify-between gap-3' },
        h('div', { class: 'space-y-1 min-w-0' },
          h('div', { class: 'flex items-center gap-2' },
            h('h1', { class: 'text-2xl md:text-3xl font-bold text-sky-900 truncate' }, c.name || t('dash.untitled')),
            button('', () => {
              const name = prompt(t('dash.renamePrompt'), c.name);
              if (name !== null) void act((a) => a.patchClass({ name }));
            }, { small: true, icon: 'Pencil' })),
          h('p', { class: 'text-5xl font-bold tracking-[0.15em] text-slate-900' }, formatClassCode(c.code)),
          h('p', { class: `inline-flex items-center gap-1.5 text-sm font-bold ${c.isOpen ? 'text-emerald-600' : 'text-amber-600'}` },
            icon(c.isOpen ? 'LockOpen' : 'Lock', 'w-4 h-4'), t(c.isOpen ? 'dash.isOpen' : 'dash.isClosed'))),
        h('div', { class: 'flex flex-col items-stretch gap-2' },
          button(t('dash.present'), () => openPresentation(c.code, c.name), { tone: 'primary', icon: 'QrCode' }),
          copyButton(() => kidUrl(c.code), t('dash.copyKidLink')),
          copyButton(() => teacherUrl(key), t('dash.copyTeacherLink')))),
      h('div', { class: 'flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100' },
        button(t(c.isOpen ? 'dash.close' : 'dash.reopen'), () => void act((a) => a.patchClass({ isOpen: !c.isOpen })), { small: true, icon: c.isOpen ? 'Lock' : 'LockOpen' }),
        h('span', { class: 'text-xs text-slate-500 flex-1' }, t('dash.expires', { date: formatDate(c.expiresAt) })),
        button(t('dash.deleteClass'), () => {
          if (!confirm(t('dash.confirmDeleteClass'))) return;
          void api.deleteClass().then(() => { forgetTeacherClass(key); location.hash = ''; }).catch(() => alert(t('error.internal')));
        }, { small: true, tone: 'danger', icon: 'Trash2' })),
    );
  }

  function renderSummary(c: TeacherClass) {
    clear(summary);
    const counter = (label: string, n: number, cls2: string) =>
      h('div', { class: `rounded-2xl px-3 py-2 text-center ${cls2}` }, h('p', { class: 'text-2xl font-bold' }, String(n)), h('p', { class: 'text-xs font-bold uppercase tracking-wide' }, label));
    const zip = (status: 'new' | 'all') => async () => {
      try { location.href = await api.zipUrl(status, status === 'new'); setTimeout(() => void load(), 1500); }
      catch (e) { alert(t(`error.${e instanceof ApiFailure ? e.code : 'internal'}`, { code: '' })); }
    };
    summary.append(
      h('div', { class: 'grid grid-cols-4 gap-2' },
        counter(t('dash.total'), c.counts.total, 'bg-slate-100 text-slate-700'),
        counter(t('status.new'), c.counts.new, pill.new),
        counter(t('status.queued'), c.counts.queued, pill.queued),
        counter(t('status.printed'), c.counts.printed, pill.printed)),
      h('div', { class: 'flex flex-wrap gap-2 items-center' },
        button(t('dash.zipNew'), () => void zip('new')(), { tone: 'green', icon: 'Download', disabled: !c.counts.new }),
        button(t('dash.zipAll'), () => void zip('all')(), { icon: 'Archive', disabled: !c.counts.total }),
        h('span', { class: 'text-xs text-slate-400' }, t('dash.zipNewHint'))),
    );
  }

  function modelCard(m: ModelSummary) {
    const img = h('img', { alt: '', class: 'w-full aspect-square object-cover bg-sky-50 rounded-xl' });
    void api.thumbnailUrl(m.id).then((u) => { img.src = u; }).catch(() => undefined);
    const next: PrintStatus[] = PRINT_STATUSES.filter((s) => s !== m.printStatus);
    const labelFor: Record<PrintStatus, Parameters<typeof t>[0]> = { new: 'dash.markNew', queued: 'dash.markQueued', printed: 'dash.markPrinted' };
    return h('article', { class: 'bg-white rounded-2xl border-2 border-slate-200 p-2 space-y-1.5 shadow-sm', 'data-model': m.id },
      h('button', { type: 'button', class: 'block w-full', title: t('dash.view3d'), onclick: () => openViewer(m) }, img),
      h('div', { class: 'flex items-center justify-between gap-1' },
        h('span', { class: 'text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full truncate' }, t('dash.by', { maker: m.makerName })),
        h('span', { class: `text-[10px] font-bold px-2 py-0.5 rounded-full ${pill[m.printStatus]}` }, t(`status.${m.printStatus}`))),
      h('p', { class: 'text-sm font-bold text-slate-800 truncate' }, m.characterName),
      h('p', { class: 'text-[11px] text-slate-400' }, `${formatBytes(m.stlSizeBytes)} · ${formatTime(m.createdAt)}`),
      h('div', { class: 'flex flex-wrap gap-1' },
        button(t('dash.downloadStl'), () => void api.downloadStl(m.id).then(({ blob, filename }) => downloadBlob(blob, filename)).catch(() => alert(t('error.internal'))), { small: true, icon: 'Download' }),
        ...next.map((s) => button(t(labelFor[s]), () => void act((a) => a.setStatus(m.id, s)), { small: true, icon: s === 'printed' ? 'Printer' : s === 'queued' ? 'Inbox' : 'RotateCcw' })),
        button('', () => { if (confirm(t('dash.confirmDelete', { character: m.characterName, maker: m.makerName }))) void act((a) => a.deleteModel(m.id)); }, { small: true, tone: 'danger', icon: 'Trash2' })),
    );
  }

  function renderGallery(c: TeacherClass) {
    clear(gallery);
    const tabs = h('div', { class: 'flex flex-wrap gap-1.5 items-center' });
    for (const f of ['all', ...PRINT_STATUSES] as Filter[]) {
      const on = f === filter;
      tabs.append(h('button', { type: 'button', 'aria-pressed': String(on), class: `px-3 py-1.5 rounded-xl text-sm font-bold ${on ? 'bg-sky-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`, onclick: () => { filter = f; render(); } },
        f === 'all' ? t('dash.filterAll') : t(`status.${f}`)));
    }
    tabs.append(h('span', { class: 'flex-1' }), button(t('dash.refresh'), () => void load(), { small: true, icon: 'RefreshCw' }));
    clear(grid);
    const shown = models.filter((m) => filter === 'all' || m.printStatus === filter);
    shown.forEach((m) => grid.append(modelCard(m)));
    gallery.append(tabs, shown.length ? grid : h('p', { class: `${card} text-center text-slate-500` }, t('dash.empty', { code: formatClassCode(c.code) })));
  }

  function render() {
    if (stopped) return;
    if (error || !cls) { if (error) renderError(); return; }
    if (!root.contains(header)) {
      clear(root);
      root.append(header, summary, gallery);
    }
    renderHeader(cls);
    renderSummary(cls);
    renderGallery(cls);
  }

  const onLang = () => render();
  window.addEventListener('langchange', onLang);
  const poll = setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('[role=dialog]')) void load(); }, 15_000);
  void load();
  return () => { stopped = true; clearInterval(poll); window.removeEventListener('langchange', onLang); };
}

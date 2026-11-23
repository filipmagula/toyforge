import { formatClassCode, NAME_LIMITS } from '@toyforge/shared';
import { clear, h } from '../dom';
import { icon } from '../icons';
import { formatDate, t } from '../i18n';
import { forgetTeacherClass, getTeacherClasses, saveTeacherClass } from '../prefs';
import { ApiFailure, createClass } from './api';
import { kidUrl, qrCanvas, teacherUrl } from './present';
import { button, card, copyButton } from './ui';

export function renderStart(root: HTMLElement, retentionDays: number) {
  clear(root);
  const nameInput = h('input', {
    type: 'text', maxlength: NAME_LIMITS.className.max, placeholder: t('teacher.classNamePlaceholder'),
    class: 'w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 focus:border-sky-500 focus:outline-none font-bold text-base',
  });
  const msg = h('p', { class: 'text-sm font-bold text-rose-500 min-h-5', role: 'alert' });
  const result = h('div');
  const submit = button(t('teacher.create'), () => void create(), { tone: 'primary', icon: 'School' });

  async function create() {
    submit.disabled = true;
    msg.textContent = '';
    try {
      const c = await createClass(nameInput.value);
      saveTeacherClass({ code: c.code, name: c.name, key: c.teacherKey, createdAt: new Date().toISOString() });
      renderCreated(result, c.code, c.name, c.teacherKey);
      nameInput.value = '';
      renderList();
    } catch (e) {
      msg.textContent = t(`error.${e instanceof ApiFailure ? e.code : 'internal'}`, { code: '' });
    } finally {
      submit.disabled = false;
    }
  }

  const list = h('div', { class: 'space-y-2' });
  function renderList() {
    clear(list);
    const classes = getTeacherClasses();
    if (!classes.length) { list.append(h('p', { class: 'text-sm text-slate-400' }, t('teacher.noClasses'))); return; }
    for (const c of classes) {
      list.append(h('div', { class: 'flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200' },
        h('span', { class: 'font-bold tracking-widest text-slate-800' }, formatClassCode(c.code)),
        h('span', { class: 'flex-1 truncate text-sm text-slate-600' }, c.name || t('dash.untitled')),
        h('span', { class: 'hidden sm:inline text-xs text-slate-400' }, formatDate(c.createdAt)),
        button(t('teacher.open'), () => { location.hash = `key=${c.key}`; }, { small: true, tone: 'green' }),
        button('', () => { forgetTeacherClass(c.key); renderList(); }, { small: true, tone: 'danger', icon: 'Trash2' }),
      ));
      (list.lastChild!.lastChild as HTMLElement).setAttribute('aria-label', t('teacher.forget'));
      (list.lastChild!.lastChild as HTMLElement).title = t('teacher.forget');
    }
  }
  renderList();

  const form = h('form', { class: 'space-y-3' },
    h('label', { class: 'block' }, h('span', { class: 'block text-sm font-bold text-slate-700 mb-1' }, t('teacher.className')), nameInput),
    msg, submit);
  form.addEventListener('submit', (e) => { e.preventDefault(); void create(); });

  root.append(
    h('section', { class: `${card} space-y-4` },
      h('h1', { class: 'text-2xl md:text-3xl font-bold text-sky-900 flex items-center gap-2' }, icon('School', 'w-8 h-8 text-amber-500'), t('teacher.title')),
      h('p', { class: 'text-slate-600' }, t('teacher.intro')),
      form,
      h('p', { class: 'text-xs text-slate-400' }, t('teacher.retention', { days: retentionDays }))),
    result,
    h('section', { class: `${card} space-y-3` }, h('h2', { class: 'text-lg font-bold text-slate-800' }, t('teacher.myClasses')), list),
  );
}

function renderCreated(el: HTMLElement, code: string, name: string, key: string) {
  clear(el);
  const link = teacherUrl(key);
  el.append(h('section', { class: 'bg-white rounded-3xl border-4 border-emerald-400 shadow-xl p-4 md:p-6 space-y-4' },
    h('h2', { class: 'text-xl md:text-2xl font-bold text-emerald-700 flex items-center gap-2' }, icon('PartyPopper', 'w-7 h-7'), t('teacher.created')),
    h('div', { class: 'flex flex-col sm:flex-row items-center gap-4' },
      qrCanvas(kidUrl(code), 180),
      h('div', { class: 'space-y-2 text-center sm:text-left' },
        h('p', { class: 'text-xs font-bold uppercase tracking-wider text-slate-500' }, t('teacher.codeLabel')),
        h('p', { class: 'text-5xl font-bold tracking-[0.15em] text-slate-900' }, formatClassCode(code)),
        name ? h('p', { class: 'text-slate-600 font-medium' }, name) : null,
        h('div', { class: 'flex items-center gap-2 justify-center sm:justify-start' },
          h('span', { class: 'text-xs text-slate-500 truncate max-w-[14rem]' }, kidUrl(code)), copyButton(() => kidUrl(code))))),
    h('div', { class: 'bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-2' },
      h('p', { class: 'text-sm font-bold text-amber-800 flex items-center gap-1.5' }, icon('Lock', 'w-4 h-4'), t('teacher.teacherLink')),
      h('p', { class: 'text-xs font-medium text-amber-800' }, t('teacher.bookmarkWarning')),
      h('div', { class: 'flex items-center gap-2' },
        h('input', { type: 'text', readonly: true, value: link, class: 'flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg border border-amber-300 bg-white font-mono', onfocus: (e: Event) => (e.target as HTMLInputElement).select() }),
        copyButton(() => link))),
    button(t('teacher.openDashboard'), () => { location.hash = `key=${key}`; }, { tone: 'green', icon: 'Inbox' }),
  ));
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

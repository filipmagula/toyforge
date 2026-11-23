import '../styles.css';
import { h } from '../dom';
import { initLang, t, type MessageKey } from '../i18n';
import { mountLangSwitcher } from '../i18n/switcher';

const RETENTION_DAYS = 30;
const CONTACT = 'filip.magula@gmail.com';
const SECTIONS: [MessageKey, MessageKey][] = [
  ['privacy.whatTitle', 'privacy.whatBody'],
  ['privacy.whoTitle', 'privacy.whoBody'],
  ['privacy.howLongTitle', 'privacy.howLongBody'],
  ['privacy.namesTitle', 'privacy.namesBody'],
  ['privacy.deviceTitle', 'privacy.deviceBody'],
  ['privacy.trackingTitle', 'privacy.trackingBody'],
];

function render(app: HTMLElement, lang: HTMLElement) {
  document.title = `${t('privacy.title')} · ToyForge 3D`;
  const [before, after] = t('privacy.contactBody', { email: '\u0000' }).split('\u0000');
  app.replaceChildren(
    h('header', { class: 'flex items-center justify-between gap-2' }, h('a', { href: '/', class: 'font-bold text-sky-900 text-lg' }, 'ToyForge 3D'), lang),
    h('article', { class: 'bg-white rounded-3xl border-2 border-sky-200 shadow-lg p-5 md:p-8 space-y-5' },
      h('h1', { class: 'text-3xl font-bold text-sky-900' }, t('privacy.title')),
      h('p', { class: 'text-slate-600' }, t('privacy.intro')),
      ...SECTIONS.map(([title, body]) => h('section', { class: 'space-y-1' },
        h('h2', { class: 'text-lg font-bold text-slate-800' }, t(title)),
        h('p', { class: 'text-slate-600' }, t(body, { days: RETENTION_DAYS })))),
      h('section', { class: 'space-y-1' },
        h('h2', { class: 'text-lg font-bold text-slate-800' }, t('privacy.contactTitle')),
        h('p', { class: 'text-slate-600' }, before ?? '', h('a', { href: `mailto:${CONTACT}`, class: 'text-sky-600 font-bold underline' }, CONTACT), after ?? '')),
      h('a', { href: '/', class: 'inline-block font-bold text-sky-600' }, `← ${t('privacy.back')}`)),
  );
}

initLang();
const app = document.getElementById('app')!;
app.className = 'min-h-dvh max-w-3xl mx-auto p-3 md:p-6 space-y-4';
const lang = h('div');
mountLangSwitcher(lang);
render(app, lang);
window.addEventListener('langchange', () => render(app, lang));

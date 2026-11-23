import '../styles.css';
import { h } from '../dom';
import { initLang, t } from '../i18n';
import { mountLangSwitcher } from '../i18n/switcher';
import { renderStart } from './create';
import { renderDashboard } from './dashboard';

const RETENTION_DAYS = 30;

function keyFromHash(): string | null {
  const m = /(?:^|[#&])key=([A-Za-z0-9_-]{20,100})/.exec(location.hash);
  return m ? m[1]! : null;
}

function main() {
  initLang();
  const app = document.getElementById('app')!;
  const lang = h('div');
  const content = h('main', { class: 'space-y-4' });
  app.className = 'min-h-dvh max-w-5xl mx-auto p-3 md:p-6 space-y-4';
  const footer = h('footer', { class: 'flex justify-center gap-4 text-xs text-slate-400 py-4' });
  app.append(
    h('header', { class: 'flex items-center justify-between gap-2' },
      h('a', { href: '/teacher', class: 'font-bold text-sky-900 text-lg' }, 'ToyForge 3D'), lang),
    content, footer);
  mountLangSwitcher(lang);

  let stop: (() => void) | null = null;
  const route = () => {
    stop?.();
    stop = null;
    document.title = `${t('teacher.title')} · ToyForge 3D`;
    footer.replaceChildren(
      h('a', { href: '/', class: 'hover:text-sky-600' }, t('footer.builder')),
      h('a', { href: '/privacy', class: 'hover:text-sky-600' }, t('footer.privacy')));
    const key = keyFromHash();
    if (key) stop = renderDashboard(content, key);
    else renderStart(content, RETENTION_DAYS);
  };
  window.addEventListener('hashchange', route);
  window.addEventListener('langchange', () => { if (!keyFromHash()) route(); else { document.title = `${t('teacher.title')} · ToyForge 3D`; footer.replaceChildren(h('a', { href: '/', class: 'hover:text-sky-600' }, t('footer.builder')), h('a', { href: '/privacy', class: 'hover:text-sky-600' }, t('footer.privacy'))); } });
  route();
}

main();

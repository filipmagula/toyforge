import { h } from '../dom';
import { icon, type IconName } from '../icons';
import { copyText } from '../dom';
import { t } from '../i18n';

export const card = 'bg-white rounded-3xl border-2 border-sky-200 shadow-lg p-4 md:p-6';

export function button(label: string, onclick: () => void, opts: { icon?: IconName; tone?: 'primary' | 'green' | 'plain' | 'danger'; small?: boolean; disabled?: boolean } = {}) {
  const tones = {
    primary: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-[0_4px_0_#c2410c]',
    green: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_0_#065f46]',
    plain: 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-sky-50',
    danger: 'bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-50',
  };
  return h('button', {
    type: 'button',
    disabled: opts.disabled,
    class: `toy-btn inline-flex items-center justify-center gap-1.5 font-bold rounded-xl disabled:opacity-50 ${opts.small ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${tones[opts.tone ?? 'plain']}`,
    onclick,
  }, opts.icon ? icon(opts.icon, opts.small ? 'w-4 h-4' : 'w-5 h-5') : null, label);
}

export function copyButton(text: () => string, label = t('teacher.copy')) {
  const b = button(label, async () => {
    const ok = await copyText(text());
    const span = b.lastChild as Text;
    if (ok) { span.textContent = t('teacher.copied'); setTimeout(() => { span.textContent = label; }, 1500); }
  }, { icon: 'Copy', small: true });
  return b;
}

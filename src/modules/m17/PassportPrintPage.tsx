// F03 /my/skills/print: printable one-page passport (A4) in the reader's language (Arabic is RTL). The sheet is a standalone
// HTML document (passportHtml) shown in a frame, so the shell never prints. No email, no photo, no task detail.
import { useMemo, useRef } from 'react';
import { Page, Async, Icon, downloadText } from '../../ui';
import { useT, useLang, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { passportHtml } from './passport';
import { useExportModel, usePassportModel } from './PassportView';
import { usePassportData, type PassportData } from './ui';

export default function PassportPrintPage() {
  const t = useT();
  const s = useSession();
  const q = usePassportData(s.identity.personId);
  return (
    <Page title={t('m17.routes.my-skills-print.title')} intro={t('m17.print.intro')}>
      <Async state={q}>{(d) => <Sheet d={d} />}</Async>
    </Page>
  );
}

const LABELS = ['title', 'subtitle', 'years', 'generated', 'skills', 'code', 'skill', 'level', 'basis', 'required', 'more', 'quals', 'licence', 'mirror', 'badges', 'footer',
  'basis_verified', 'basis_evidenced', 'basis_validated', 'basis_claimed', 'basis_none'];

export function Sheet({ d }: { d: PassportData }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const vm = usePassportModel(d);
  const model = useExportModel(d, vm);
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => passportHtml(model, lang, Object.fromEntries(LABELS.map((k) => [k, t(`m17.print.${k}`)])), { date: (x) => f.date(x), num: (n) => f.num(n) }), [model, lang, t, f]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => frame.current?.contentWindow?.print()} data-testid="m17-print-now">
          <Icon name="book" size={14} /> {t('m17.print.print')}
        </button>
        <button type="button" className="btn-outline" onClick={() => downloadText(`kafaa-skills-passport-${model.generated_on}-${lang}.html`, html, 'text/html;charset=utf-8')}>
          <Icon name="download" size={14} /> {t('m17.print.download')}
        </button>
        <L to="/my/skills" className="btn-ghost no-underline">{t('m17.print.back')}</L>
      </div>
      <iframe ref={frame} title={t('m17.print.frame')} srcDoc={html} className="h-[1100px] w-full max-w-[860px] rounded-card border border-line bg-white" data-testid="m17-print-frame" />
    </div>
  );
}

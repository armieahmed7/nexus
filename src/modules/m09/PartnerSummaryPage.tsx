// M09 /partner/onboarding/summary: the readiness summary the supplier takes to ENEC's supplier registration (M09 acceptance).
// Built by the submission RPC and stored on the case, so it shows exactly what was submitted. Printable and downloadable.
import { Page, Card, Callout, Async, EmptyState, KeyValue, Icon, downloadText } from '../../ui';
import { useT, useFormat, useLang, L } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import type { ReadinessSummary } from '../../domain/partners';
import { SELF_ASSESSMENT_MAX } from '../../domain/partners';
import { MStatus, useMyOrg } from './shared';

export default function PartnerSummaryPage() {
  const t = useT();
  const repo = useRepo();
  const { orgId } = useMyOrg();
  const q = useQuery(['partner_onboarding', 'courses'], async () => {
    const [cases, courses] = await Promise.all([repo.list('partner_onboarding', { filter: { org_id: orgId ?? '' } }), repo.list('courses', { filter: { audience: 'supplier' } })]);
    const c = cases[0] ?? null;
    const s = c?.summary as ReadinessSummary | undefined;
    return { c, s: s && s.ref ? s : null, courses };
  }, [orgId]);
  return (
    <Page title={t('m09.routes.partner-readiness-summary.title')} intro={t('m09.sum.intro')}
      actions={<L to="/partner/onboarding" className="btn-outline">{t('m09.sum.back')}</L>}>
      <Async state={q} isEmpty={(d) => !d.s} empty={<EmptyState title={t('m09.sum.none')} action={<L to="/partner/onboarding" className="btn-outline btn-sm">{t('m09.sum.back')}</L>}>{t('m09.sum.noneBody')}</EmptyState>}>
        {(d) => <Summary s={d.s!} status={d.c!.status} courses={d.courses} />}
      </Async>
    </Page>
  );
}

function Summary({ s, status, courses }: { s: ReadinessSummary; status: string; courses: { id: string; code: string; title_en: string; title_ar: string }[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const course = (id: string) => courses.find((c) => c.id === id);
  return (
    <div className="space-y-4" data-testid="m09-summary">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className="btn-primary" onClick={() => window.print()} data-testid="m09-summary-print"><Icon name="download" size={14} /> {t('m09.sum.print')}</button>
        <button className="btn-outline" onClick={() => downloadText(`${s.ref}.json`, JSON.stringify(s, null, 2), 'application/json;charset=utf-8')} data-testid="m09-summary-json">{t('m09.sum.json')}</button>
      </div>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="caps">{t('m09.sum.ref')}</div>
            <div className="num ltr text-[20px] font-semibold" data-testid="m09-summary-ref">{s.ref}</div>
            <div className="text-[13px] text-ink-2">{lang === 'ar' ? s.org_name_ar : s.org_name_en}</div>
          </div>
          <div className="text-end">
            <div className="caps">{t('m09.sum.generated')}</div>
            <div className="num">{f.dateTime(s.generated_at)}</div>
            <div className="mt-1"><MStatus status={status} /></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 font-semibold">{t('m09.sum.steps')}</h2>
            <ul className="space-y-1 text-[13px]">
              {s.steps.map((x) => (
                <li key={x.key} className="flex items-center justify-between gap-2 border-b border-line py-1 last:border-0">
                  <span>{t(`m09.step.${x.key}`)}</span>
                  <MStatus status={x.key === 'handoff' && status === 'handed_off' ? 'done' : x.status} />
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">{t('m09.sum.self')}</h2>
            {Object.keys(s.self_assessment).length === 0 ? (
              <p className="text-ink-3">—</p>
            ) : (
              <KeyValue items={Object.entries(s.self_assessment).map(([k, v]) => [t(`m09.self.${k}.title`), <span key={k} className="num">{f.num(v)} / {f.num(SELF_ASSESSMENT_MAX)}</span>])} />
            )}
          </section>
        </div>
      </Card>

      <Card title={t('m09.sum.documents')}>
        <div className="overflow-x-auto">
          <table className="table-base w-full text-[12.5px]">
            <caption className="sr-only">{t('m09.sum.documents')}</caption>
            <thead className="bg-raised">
              <tr><th scope="col">{t('m09.onb.col.document')}</th><th scope="col">{t('m09.onb.col.status')}</th><th scope="col">{t('m09.onb.col.file')}</th><th scope="col">SHA-256</th></tr>
            </thead>
            <tbody>
              {s.documents.map((d) => (
                <tr key={d.key}>
                  <td>{t(`m09.doc.${d.key}`)}</td>
                  <td><MStatus status={d.status} /></td>
                  <td className="ltr">{d.file_name ?? '—'}</td>
                  <td className="num ltr break-all text-[11px] text-ink-2">{d.sha256 ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title={t('m09.sum.icv')}>
          {s.icv ? (
            <KeyValue items={[
              [t('m09.icv.baseline'), <span key="b" className="num">{f.num(s.icv.baseline)}</span>],
              [t('m09.icv.target'), <span key="t" className="num">{f.num(s.icv.target)} ({f.num(s.icv.target_year, { useGrouping: false })})</span>],
              [t('m09.icv.planStatus'), <MStatus key="s" status={s.icv.status} />],
              [t('m09.icv.certValid'), s.icv.certificate_valid_to ? f.date(s.icv.certificate_valid_to) : '—'],
            ]} />
          ) : <p className="text-ink-3">—</p>}
        </Card>
        <Card title={t('m09.sum.academy')}>
          {s.academy.length === 0 ? <p className="text-ink-3">{t('m09.sum.noCerts')}</p> : (
            <ul className="space-y-1 text-[13px]">
              {s.academy.map((a) => {
                const c = course(a.course_id);
                return (
                  <li key={a.certificate_no} className="flex flex-wrap justify-between gap-2 border-b border-line py-1 last:border-0">
                    <span>{c ? `${c.code} · ${lang === 'ar' ? c.title_ar : c.title_en}` : a.course_id}</span>
                    <span className="num ltr text-ink-2">{a.certificate_no} · {f.date(a.issued_on)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Callout tone="sim" title={t('m09.sum.disclaimerTitle')}>{lang === 'ar' ? t('m09.sum.disclaimerAr') : s.disclaimer}</Callout>
      <p className="text-[12.5px] text-ink-3">{t('m09.sum.next')}</p>
    </div>
  );
}

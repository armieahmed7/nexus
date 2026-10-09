// /training/accreditation/:selfEvalId/report (M26 · F29): the self-evaluation report generator. A standalone HTML document in
// English or Arabic (print or save as PDF from the frame, or download the .html) and a CSV of the gaps; every export carries
// "Demo / not an accreditation decision".
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Async, EmptyState, Callout, Icon, downloadText } from '../../ui';
import { L, translate, useLang, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { AREAS, DEMO_NOTICE, isGap, selfEvalState, type EvidenceLink } from './accr';
import { selfEvalHtml, type SerModel } from './report';
import { useAccrData, type AccrData } from './ui';

export default function AccrReportPage() {
  const t = useT();
  const { selfEvalId = '' } = useParams();
  const q = useAccrData();
  return (
    <Page title={t('m26.routes.training-accreditation-report.title')} intro={t('m26.report.serIntro')} wide>
      <Callout tone="sim"><b>{DEMO_NOTICE.en}</b> · <b>{DEMO_NOTICE.ar}</b></Callout>
      <div className="mt-4"><Async state={q}>{(d) => (d.selfevals.some((s) => s.id === selfEvalId) ? <Report d={d} id={selfEvalId} /> : <EmptyState title={t('m26.se.notFound')} />)}</Async></div>
    </Page>
  );
}

export function serModel(d: AccrData, id: string, today: string): SerModel {
  const se = d.selfevals.find((x) => x.id === id)!;
  const prog = d.programmes.find((p) => p.id === se.programme_id);
  const xs = d.assessments.filter((a) => a.selfeval_id === id);
  const st = selfEvalState(xs as never, d.criteria.length);
  const prevSe = d.selfevals.filter((x) => x.programme_id === se.programme_id && x.status === 'finalised' && x.cycle < se.cycle).sort((a, b) => (a.cycle < b.cycle ? 1 : -1))[0];
  const prev = new Map(d.assessments.filter((a) => a.selfeval_id === prevSe?.id).map((a) => [a.criterion_id, a.rating]));
  const names = new Map(xs.map((a) => [a.rated_by, { en: a.rated_by_name, ar: a.rated_by_name_ar || a.rated_by_name }]));
  const allCycles = d.selfevals.filter((x) => x.programme_id === se.programme_id && x.cycle <= se.cycle).sort((a, b) => (a.cycle < b.cycle ? -1 : 1));
  return {
    programme: { en: prog?.name_en ?? se.programme_id, ar: prog?.name_ar ?? se.programme_id }, code: prog?.code ?? se.programme_id, cycle: se.cycle, status: se.status,
    readiness: st.readiness, rated: st.rated, total: st.total, gaps: st.gaps, authors: st.authors.map((a) => names.get(a) ?? { en: a, ar: a }),
    finalised_by: se.status === 'finalised' ? { en: se.finalised_by_name, ar: se.finalised_by_name_ar || se.finalised_by_name } : null, finalised_at: se.finalised_at ?? null, generated_on: today,
    areas: AREAS.map((area) => ({
      area, criteria: d.criteria.filter((c) => c.area === area).map((c) => {
        const a = xs.find((x) => x.criterion_id === c.id);
        return {
          code: c.code, title: { en: c.title_en, ar: c.title_ar }, rating: a?.rating ?? null, prev: prev.get(c.id) ?? null,
          evidence: ((a?.evidence ?? []) as EvidenceLink[]).map((e) => ({ en: e.label_en, ar: e.label_ar })), gap: a?.gap_en ?? '', owner_role: a?.owner_role ?? null,
          due_on: a?.due_on ? String(a.due_on).slice(0, 10) : null, note: a?.note ?? '',
        };
      }),
    })),
    trend: allCycles.map((x) => ({ cycle: x.cycle, readiness: selfEvalState(d.assessments.filter((a) => a.selfeval_id === x.id) as never, d.criteria.length).readiness })),
    sources: ((d.criteria[0]?.sources ?? []) as { label: string; url: string }[]).map((s) => ({ label: s.label, url: s.url })),
  };
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
export function gapsCsv(m: SerModel, lang: 'en' | 'ar'): string {
  const rows = m.areas.flatMap((a) => a.criteria.filter((c) => c.rating != null && isGap(c.rating)).map((c) => [m.code, m.cycle, a.area, c.code, lang === 'ar' ? c.title.ar : c.title.en, c.rating, c.gap, c.owner_role ?? '', c.due_on ?? '']));
  return [[`# ${DEMO_NOTICE.en} / ${DEMO_NOTICE.ar}`], ['programme', 'cycle', 'area', 'criterion', 'title', 'rating', 'gap', 'owner_role', 'due_on'], ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

function Report({ d, id }: { d: AccrData; id: string }) {
  const t = useT();
  const ui = useLang();
  const [lang, setLang] = useState<'en' | 'ar'>(ui);
  const frame = useRef<HTMLIFrameElement>(null);
  const model = useMemo(() => serModel(d, id, todayIso()), [d, id]);
  const html = useMemo(() => selfEvalHtml(model, lang, (k, v) => translate(lang, k, v), DEMO_NOTICE), [model, lang]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('m26.report.language')} className="inline-flex rounded-btn border border-line">
          {(['en', 'ar'] as const).map((l) => <button key={l} className={`btn-sm px-3 ${lang === l ? 'bg-accent text-white' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)} data-testid={`m26-ser-${l}`}>{t(`m26.report.lang_${l}`)}</button>)}
        </div>
        <button type="button" className="btn-primary" onClick={() => frame.current?.contentWindow?.print()} data-testid="m26-ser-print"><Icon name="book" size={14} /> {t('m26.report.print')}</button>
        <button type="button" className="btn-outline" onClick={() => downloadText(`kafaa-self-evaluation-${id}-${lang}.html`, html, 'text/html;charset=utf-8')}><Icon name="download" size={14} /> {t('m26.report.downloadHtml')}</button>
        <button type="button" className="btn-outline" onClick={() => downloadText(`kafaa-self-evaluation-gaps-${id}.csv`, gapsCsv(model, lang))}><Icon name="download" size={14} /> {t('m26.report.downloadGaps')}</button>
        <L to={`/training/accreditation/${id}`} className="btn-ghost no-underline">{t('m26.common.back')}</L>
      </div>
      <iframe ref={frame} title={t('m26.report.frame')} srcDoc={html} className="h-[1100px] w-full max-w-[980px] rounded-card border border-line bg-white" data-testid="m26-ser-frame" />
    </div>
  );
}

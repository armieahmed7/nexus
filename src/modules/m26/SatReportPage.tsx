// /training/sat/roles/:roleId/report (M26 · F27): the traceability report export. A standalone HTML document in English or Arabic
// (print or save as PDF from the frame, or download the .html), plus a CSV of the task-to-training matrix. Restricted tasks print
// as "restricted" only.
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Async, EmptyState, Icon, downloadText } from '../../ui';
import { L, translate, useLang, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { traceabilityHtml, type TraceModel, type TraceRow } from './report';
import { useSatData, useSatModel, type SatData, type SatModel } from './ui';

export default function SatReportPage() {
  const t = useT();
  const { roleId = '' } = useParams();
  const q = useSatData();
  const m = useSatModel(q.data);
  return (
    <Page title={t('m26.routes.training-sat-report.title')} intro={t('m26.report.traceIntro')} wide>
      <Async state={q}>{(d) => (m && m.role.get(roleId) && !m.analysisOf(roleId)?.restricted ? <Report d={d} m={m} roleId={roleId} /> : <EmptyState title={t('m26.role.notFound')} />)}</Async>
    </Page>
  );
}

export function traceModel(d: SatData, m: SatModel, roleId: string, today: string): TraceModel {
  const role = m.role.get(roleId)!;
  const an = m.analysisOf(roleId);
  const cov = m.coverageOf(roleId);
  const covBy = new Map(cov.rows.map((r) => [r.task_id, r]));
  const bi = (x: Record<string, unknown> | undefined, f: string) => ({ en: String(x?.[`${f}_en`] ?? ''), ar: String(x?.[`${f}_ar`] ?? '') });
  const rows: TraceRow[] = d.tasks.filter((x) => x.role_id === roleId && x.status === 'active').map((x) => {
    const p = m.props.get(x.id);
    const c = covBy.get(x.id);
    const links = d.links.filter((l) => l.task_id === x.id && l.active);
    return {
      code: x.code, title: bi(x as never, 'title'), restricted: x.restricted, source: x.source, critical: x.critical, n: p?.n ?? 0,
      dif: p?.consensus ? { d: p.consensus.d, i: p.consensus.i, f: p.consensus.f } : null, proposal: p?.decision ?? null, decision: x.decision, override: x.override, note: x.decision_note ?? null,
      objectives: (c?.objectives ?? []).map((o) => ({ code: m.obj.get(o)?.code ?? o, text: bi(m.obj.get(o) as never, 'text') })),
      courses: (c?.courses ?? []).map((cid) => {
        const mod = links.find((l) => l.course_id === cid && l.module_id)?.module_id;
        return { code: m.course.get(cid)?.code ?? cid, title: bi(m.course.get(cid) as never, 'title'), module: mod ? bi(m.module.get(mod) as never, 'title') : null };
      }),
      jpms: (c?.jpms ?? []).map((j) => ({ code: m.jpm.get(j)?.code ?? j, title: bi(m.jpm.get(j) as never, 'title') })),
      state: !c ? 'not_selected' : c.gap ? 'gap' : c.no_refresher ? 'no_refresher' : c.selected ? 'covered' : 'not_selected',
    };
  });
  return {
    role: bi(role as never, 'title'), status: an?.status ?? 'draft', version: an?.version ?? 1, approved_on: an?.status === 'approved' ? an.approved_on ?? null : null, generated_on: today,
    summary: { tasks: cov.rows.length, selected: cov.selected, covered: cov.covered, gaps: cov.gaps.length, orphans: cov.orphans.length, pct: cov.pct },
    rows, orphans: cov.orphans.map((o) => { const x = m.obj.get(o)!; return { code: x.code, text: bi(x as never, 'text'), course: x.course_id ? bi(m.course.get(x.course_id) as never, 'title') : null }; }),
  };
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
export function traceCsv(model: TraceModel, lang: 'en' | 'ar'): string {
  const head = ['code', 'title', 'source', 'critical', 'raters', 'd', 'i', 'f', 'rule', 'decision', 'override', 'objectives', 'courses', 'jpms', 'state'];
  const rows = model.rows.map((r) => (r.restricted ? [r.code, 'restricted', '', '', '', '', '', '', '', '', '', '', '', '', 'restricted']
    : [r.code, lang === 'ar' ? r.title.ar : r.title.en, r.source, r.critical, r.n, r.dif?.d ?? '', r.dif?.i ?? '', r.dif?.f ?? '', r.proposal ?? '', r.decision, r.override,
      r.objectives.map((o) => o.code).join('; '), r.courses.map((c) => c.code).join('; '), r.jpms.map((j) => j.code).join('; '), r.state]));
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

function Report({ d, m, roleId }: { d: SatData; m: SatModel; roleId: string }) {
  const t = useT();
  const ui = useLang();
  const [lang, setLang] = useState<'en' | 'ar'>(ui);
  const frame = useRef<HTMLIFrameElement>(null);
  const model = useMemo(() => traceModel(d, m, roleId, todayIso()), [d, m, roleId]);
  const html = useMemo(() => traceabilityHtml(model, lang, (k, v) => translate(lang, k, v)), [model, lang]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('m26.report.language')} className="inline-flex rounded-btn border border-line">
          {(['en', 'ar'] as const).map((l) => <button key={l} className={`btn-sm px-3 ${lang === l ? 'bg-accent text-white' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)} data-testid={`m26-report-${l}`}>{t(`m26.report.lang_${l}`)}</button>)}
        </div>
        <button type="button" className="btn-primary" onClick={() => frame.current?.contentWindow?.print()} data-testid="m26-print"><Icon name="book" size={14} /> {t('m26.report.print')}</button>
        <button type="button" className="btn-outline" onClick={() => downloadText(`kafaa-sat-traceability-${roleId}-${lang}.html`, html, 'text/html;charset=utf-8')}><Icon name="download" size={14} /> {t('m26.report.downloadHtml')}</button>
        <button type="button" className="btn-outline" onClick={() => downloadText(`kafaa-sat-traceability-${roleId}.csv`, traceCsv(model, lang))} data-testid="m26-csv"><Icon name="download" size={14} /> {t('m26.report.downloadCsv')}</button>
        <L to={`/training/sat/roles/${roleId}`} className="btn-ghost no-underline">{t('m26.common.back')}</L>
      </div>
      <iframe ref={frame} title={t('m26.report.frame')} srcDoc={html} className="h-[1100px] w-full max-w-[980px] rounded-card border border-line bg-white" data-testid="m26-report-frame" />
    </div>
  );
}

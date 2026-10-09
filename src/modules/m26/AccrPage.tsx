// /training/accreditation (M26 · F29): accreditation-readiness self-evaluation. Programmes in scope with their readiness and the
// trend across half-year cycles, the current cycle's status (open, draft in progress, finalised), every open gap with its owner and
// due date, and the criteria library: generic, paraphrased SAT-based objectives sourced to public IAEA SAT guidance and FANR-REG-16
// (no INPO or ACAD text). A readiness self-check for a demo, never an accreditation decision.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Tabs, StatTile, DataTable, LineChart, ProgressRing, WhyThis, SourceLink, ConfirmDialog, SimChip, type Column } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useNav, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { AREAS, DEMO_NOTICE, cycleOf, isGap, readinessReasons, selfEvalState } from './accr';
import { RatingPill, SelfEvalPill, useAccrData, type AccrData } from './ui';

export default function AccrPage() {
  const t = useT();
  const q = useAccrData();
  return (
    <Page title={t('m26.routes.training-accreditation.title')} intro={t('m26.accr.intro')} wide eyebrow={<SimChip label={t('m26.accr.sample')} />}>
      <Callout tone="sim" title={t('m26.accr.demoTitle')}>{t('m26.accr.demoBody')}</Callout>
      <div className="mt-5"><Async state={q}>{(d) => <Accr d={d} />}</Async></div>
    </Page>
  );
}

export function useAccrModel(d: AccrData) {
  const pick = usePick();
  return useMemo(() => {
    const prog = new Map(d.programmes.map((p) => [p.id, p]));
    const total = d.criteria.length;
    const cycles = [...new Set(d.selfevals.map((s) => s.cycle))].sort();
    const stateOf = (seId: string) => selfEvalState(d.assessments.filter((a) => a.selfeval_id === seId) as never, total);
    const name = (pid: string) => (prog.get(pid) ? pick(prog.get(pid), 'name') : pid);
    const code = (pid: string) => prog.get(pid)?.code ?? pid;
    return { prog, total, cycles, stateOf, name, code };
  }, [d, pick]);
}

function Accr({ d }: { d: AccrData }) {
  const t = useT();
  const f = useFormat();
  const m = useAccrModel(d);
  const today = todayIso();
  const cur = cycleOf(today);
  const latest = (pid: string) => [...d.selfevals.filter((s) => s.programme_id === pid)].sort((a, b) => (a.cycle < b.cycle ? 1 : -1))[0];
  const current = d.scope.map((p) => latest(p.id)).filter(Boolean);
  const gaps = current.flatMap((se) => d.assessments.filter((a) => a.selfeval_id === se.id && isGap(a.rating)).map((a) => ({ a, se })));
  const overdue = gaps.filter((g) => g.a.due_on && String(g.a.due_on).slice(0, 10) < today).length;
  const drafts = d.selfevals.filter((s) => s.status === 'draft');
  const avg = current.length ? Math.round(current.reduce((s, se) => s + m.stateOf(se.id).readiness, 0) / current.length) : 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m26-accr-tiles">
        <StatTile label={t('m26.accr.tileProgrammes')} value={f.num(d.scope.length)} sub={t('m26.accr.tileCriteria', { n: f.num(m.total) })} />
        <StatTile label={t('m26.accr.tileReadiness')} value={f.pct(avg, 0)} sub={t('m26.accr.tileReadinessSub')} />
        <StatTile label={t('m26.accr.tileDrafts')} value={f.num(drafts.length)} sub={t('m26.accr.tileDraftsSub', { cycle: cur })} tone="info" />
        <StatTile label={t('m26.accr.tileGaps')} value={f.num(gaps.length)} tone={gaps.length ? 'sim' : 'ok'} sub={t('m26.accr.tileGapsSub')} />
        <StatTile label={t('m26.accr.tileOverdue')} value={f.num(overdue)} tone={overdue ? 'bad' : 'ok'} />
      </div>
      <Tabs tabs={[
        { id: 'programmes', label: t('m26.accr.tabProgrammes'), content: <Programmes d={d} /> },
        { id: 'gaps', label: t('m26.accr.tabGaps'), badge: overdue ? <span className="chip border-bad-line bg-bad-bg text-bad">{f.num(overdue)}</span> : undefined, content: <Gaps d={d} gaps={gaps} /> },
        { id: 'criteria', label: t('m26.accr.tabCriteria'), content: <Criteria d={d} /> },
      ]} />
    </div>
  );
}

function Programmes({ d }: { d: AccrData }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const nav = useNav();
  const m = useAccrModel(d);
  const cur = cycleOf(todayIso());
  const canW = s.can('sat', ['W', 'A']);
  const [open, setOpen] = useState<string | null>(null);
  const series = d.scope.map((p) => ({ name: m.code(p.id), points: m.cycles.map((c) => { const se = d.selfevals.find((x) => x.programme_id === p.id && x.cycle === c); return { x: c, y: se ? m.stateOf(se.id).readiness : null }; }) }));
  return (
    <div className="space-y-5 pt-4">
      <Card title={t('m26.accr.trendTitle')} eyebrow={t('m26.accr.trendEyebrow')}>
        <LineChart title={t('m26.accr.trendTitle')} series={series} unit="%" yMin={0} yMax={100} />
      </Card>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="m26-programmes">
        {d.scope.map((p) => {
          const ses = d.selfevals.filter((x) => x.programme_id === p.id).sort((a, b) => (a.cycle < b.cycle ? 1 : -1));
          const draft = ses.find((x) => x.status === 'draft');
          const last = ses.find((x) => x.status === 'finalised');
          const shown = draft ?? last;
          const st = shown ? m.stateOf(shown.id) : null;
          const prev = draft && last ? m.stateOf(last.id).readiness : null;
          const hasCurrent = ses.some((x) => x.cycle === cur);
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{m.name(p.id)}</div>
                  <div className="text-[12px] text-ink-3">{m.code(p.id)}</div>
                </div>
                {st && <ProgressRing value={st.readiness} tone={st.readiness >= 75 ? 'ok' : st.readiness >= 50 ? 'accent' : 'sim'} />}
              </div>
              {shown && st ? (
                <div className="mt-2 space-y-1 text-[12.5px]">
                  <div className="flex flex-wrap items-center gap-1.5"><SelfEvalPill status={shown.status} /><span className="num">{shown.cycle}</span><WhyThis reasons={readinessReasons(st)} testId="m26-readiness-why" /></div>
                  <div className="text-ink-2">{t('m26.accr.cardRated', { a: f.num(st.rated), b: f.num(st.total), g: f.num(st.gaps) })}</div>
                  {prev != null && <div className="text-ink-2">{t('m26.accr.cardPrev', { n: f.num(prev) })}</div>}
                </div>
              ) : <p className="mt-2 text-[12.5px] text-ink-3">{t('m26.accr.noSelfEval')}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {shown && <L to={`/training/accreditation/${shown.id}`} className="btn-outline btn-sm no-underline" data-testid="m26-selfeval-link">{shown.status === 'draft' ? t('m26.accr.continue') : t('m26.accr.view')}</L>}
                {!draft && !hasCurrent && canW && <button className="btn-primary btn-sm" onClick={() => setOpen(p.id)} data-testid="m26-open-selfeval">{t('m26.accr.openCycle', { cycle: cur })}</button>}
                {last && <L to={`/training/accreditation/${last.id}/report`} className="btn-ghost btn-sm no-underline">{t('m26.accr.report')}</L>}
              </div>
            </Card>
          );
        })}
      </div>
      <ConfirmDialog open={!!open} onClose={() => setOpen(null)} title={t('m26.accr.openCycle', { cycle: cur })} consequence={t('m26.accr.openBody', { p: open ? m.name(open) : '', cycle: cur })}
        actingAs={t('m26.common.asStaff')} confirmLabel={t('m26.accr.openCycle', { cycle: cur })}
        onConfirm={async () => { if (!open) return; const r = await run(() => repo.rpc.openSelfEval(open)); if (r.ok && r.data) nav(`/training/accreditation/${r.data.id}`); }} />
    </div>
  );
}

type GapRow = { a: AccrData['assessments'][number]; se: AccrData['selfevals'][number] };
function Gaps({ d, gaps }: { d: AccrData; gaps: GapRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const m = useAccrModel(d);
  const crit = new Map(d.criteria.map((c) => [c.id, c]));
  const today = todayIso();
  const cols: Column<GapRow>[] = [
    { key: 'programme', header: t('m26.accr.colProgramme'), value: (g) => m.name(g.se.programme_id), sortable: true, render: (g) => <L to={`/training/accreditation/${g.se.id}`} className="link">{m.name(g.se.programme_id)}</L> },
    { key: 'cycle', header: t('m26.accr.colCycle'), value: (g) => g.se.cycle, sortable: true },
    { key: 'criterion', header: t('m26.accr.colCriterion'), value: (g) => `${crit.get(g.a.criterion_id)?.code} ${pick(crit.get(g.a.criterion_id), 'title')}`, render: (g) => <span><b>{crit.get(g.a.criterion_id)?.code}</b> {pick(crit.get(g.a.criterion_id), 'title')}</span> },
    { key: 'rating', header: t('m26.accr.colRating'), value: (g) => g.a.rating, sortable: true, render: (g) => <RatingPill rating={g.a.rating} /> },
    { key: 'gap', header: t('m26.accr.colGap'), value: (g) => g.a.gap_en, render: (g) => <span className="text-[12.5px]">{g.a.gap_en}</span> },
    { key: 'owner', header: t('m26.accr.colOwner'), value: (g) => (g.a.owner_role ? t(`m26.owner.${g.a.owner_role}`) : ''), sortable: true },
    { key: 'due', header: t('m26.accr.colDue'), value: (g) => String(g.a.due_on ?? ''), sortable: true, render: (g) => {
      const late = g.a.due_on && String(g.a.due_on).slice(0, 10) < today;
      return <span className={late ? 'font-semibold text-bad' : ''}>{f.date(g.a.due_on)}{late ? ` · ${t('m26.accr.overdue')}` : ''}</span>;
    } },
  ];
  return (
    <div className="space-y-3 pt-4" data-testid="m26-gaps">
      <p className="text-[13px] text-ink-2">{t('m26.accr.gapsBody')}</p>
      <DataTable rows={gaps} columns={cols} rowKey={(g) => g.a.id} csvName="kafaa-accreditation-gaps.csv" initialSort={{ key: 'due', dir: 'asc' }} empty={<EmptyState icon="check" title={t('m26.accr.noGaps')} />} />
      <p className="text-[12px] text-ink-3">{DEMO_NOTICE.en} · {DEMO_NOTICE.ar}</p>
    </div>
  );
}

function Criteria({ d }: { d: AccrData }) {
  const t = useT();
  const pick = usePick();
  const src = d.criteria[0]?.sources as { id: string; label: string; url: string }[] | undefined;
  return (
    <div className="space-y-4 pt-4" data-testid="m26-criteria">
      <Callout>{t('m26.accr.criteriaNote')}</Callout>
      {AREAS.map((area) => (
        <Section key={area} title={t(`m26.area.${area}`)}>
          <ul className="divide-y divide-line rounded-card border border-line bg-panel">
            {d.criteria.filter((c) => c.area === area).map((c) => (
              <li key={c.id} className="p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="num font-semibold">{c.code}</span>
                  <span className="font-semibold">{pick(c, 'title')}</span>
                  {c.phase && <span className="chip border-line bg-sunken text-ink-2">{t(`m26.phase.${c.phase}`)}</span>}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-2">{pick(c, 'guidance')}</p>
                <div className="mt-1 flex flex-wrap gap-1">{c.evidence_kinds.map((k) => <span key={k} className="chip border-info-line bg-info-bg text-info">{t(`m26.evidence.${k}`)}</span>)}</div>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      {src && <div className="flex flex-wrap gap-3 text-[12.5px]">{src.map((s) => <SourceLink key={s.id} href={s.url}>{s.label}</SourceLink>)}</div>}
    </div>
  );
}

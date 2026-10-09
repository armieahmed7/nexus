// /training/sat (M26 · F27): the SAT analysis workbench. Job analyses per role (draft, DIF survey, approved; security, safeguards
// and cyber roles are listed as restricted and managed outside Kafa'a), the deterministic train / no-train / overtrain rule with a
// "try the rule" panel, coverage of training-selected tasks by learning objectives, courses flagged by the F25 effectiveness review,
// and recent SAT changes.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatTile, ProgressBar, WhyThis, SimChip, DataTable, type Column } from '../../ui';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { difDecision } from './sat';
import { AnalysisPill, DecisionPill, HAS_REDESIGN, useSatData, useSatModel, type SatData, type SatModel } from './ui';

export default function SatPage() {
  const t = useT();
  const q = useSatData();
  const repo = useRepo();
  const s = useSession();
  const survey = useQuery(['jta_analyses', 'dif_ratings'], () => repo.rpc.difSurvey(), [s.identity.personId]);
  return (
    <Page title={t('m26.routes.training-sat.title')} intro={t('m26.sat.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip label={t('m26.sat.synthetic')} /><span className="chip border-line bg-sunken text-ink-2">{t('m26.sat.ruleChip')}</span></span>}
      actions={<L to="/training/sat/changes" className="btn-outline no-underline" data-testid="m26-changes-link">{t('m26.routes.training-sat-changes.title')}</L>}>
      {survey.data?.open && (
        <Callout tone="info" title={t('m26.survey.calloutTitle')}>
          {t('m26.survey.calloutBody', { n: survey.data.tasks.length })} <L to="/training/sat/survey" className="link">{t('m26.survey.open')}</L>
        </Callout>
      )}
      <Async state={q}>{(d) => <Overview d={d} />}</Async>
    </Page>
  );
}

function Overview({ d }: { d: SatData }) {
  const t = useT();
  const f = useFormat();
  const m = useSatModel(d) as SatModel;
  const rows = useMemo(() => d.analyses.map((a) => {
    const cov = a.restricted ? null : m.coverageOf(a.role_id);
    const tasks = d.tasks.filter((x) => x.role_id === a.role_id && x.status === 'active');
    return { a, cov, tasks: tasks.length, rated: tasks.filter((x) => !x.restricted && (m.props.get(x.id)?.n ?? 0) >= 3).length, decided: tasks.filter((x) => !x.restricted && x.decision !== 'pending').length };
  }).sort((x, y) => Number(x.a.restricted) - Number(y.a.restricted) || m.roleName(x.a.role_id).localeCompare(m.roleName(y.a.role_id))), [d, m]);
  const live = rows.filter((r) => !r.a.restricted);
  const allTasks = d.tasks.filter((x) => x.status === 'active' && !x.restricted);
  const selected = live.reduce((s, r) => s + (r.cov?.selected ?? 0), 0);
  const covered = live.reduce((s, r) => s + (r.cov?.covered ?? 0), 0);
  const gaps = live.reduce((s, r) => s + (r.cov?.gaps.length ?? 0), 0);
  const orphans = live.reduce((s, r) => s + (r.cov?.orphans.length ?? 0), 0);
  const openChanges = d.changes.filter((c) => c.status === 'open');
  const count = (k: string) => allTasks.filter((x) => x.decision === k).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6" data-testid="m26-sat-tiles">
        <StatTile label={t('m26.sat.tileRoles')} value={f.num(live.length)} sub={t('m26.sat.tileRolesSub', { n: f.num(live.filter((r) => r.a.status === 'approved').length) })} />
        <StatTile label={t('m26.sat.tileTasks')} value={f.num(allTasks.length)} sub={t('m26.sat.tileTasksSub', { n: f.num(d.ratings.length) })} />
        <StatTile label={t('m26.sat.tileDecisions')} value={`${f.num(count('train') + count('overtrain'))} / ${f.num(count('no_train'))}`} sub={t('m26.sat.tileDecisionsSub', { n: f.num(count('pending')) })} />
        <StatTile label={t('m26.sat.tileCoverage')} value={selected ? f.pct((100 * covered) / selected, 0) : '—'} tone={gaps ? 'info' : 'ok'} sub={t('m26.sat.tileCoverageSub', { a: f.num(covered), b: f.num(selected) })} />
        <StatTile label={t('m26.sat.tileGaps')} value={f.num(gaps)} tone={gaps ? 'bad' : 'ok'} sub={t('m26.sat.tileOrphans', { n: f.num(orphans) })} />
        <StatTile label={t('m26.sat.tileChanges')} value={f.num(openChanges.length)} tone={openChanges.length ? 'sim' : 'ok'} sub={t('m26.sat.tileChangesSub', { n: f.num(d.items.filter((i) => i.status === 'open').length) })} />
      </div>

      <Section title={t('m26.sat.analysesTitle')} description={t('m26.sat.analysesBody')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="m26-analyses">
          {rows.map((r) => r.a.restricted ? (
            <Card key={r.a.id} className="opacity-90">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold">{m.roleName(r.a.role_id)}</div>
                <AnalysisPill status="restricted" />
              </div>
              <p className="mt-2 text-[12.5px] text-ink-2">{t('m26.restricted.body')}</p>
            </Card>
          ) : (
            <Card key={r.a.id}>
              <div className="flex items-start justify-between gap-2">
                <L to={`/training/sat/roles/${r.a.role_id}`} className="link min-w-0 font-semibold" data-testid="m26-analysis-link">{m.roleName(r.a.role_id)}</L>
                <AnalysisPill status={r.a.status} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div><dt className="text-ink-3">{t('m26.sat.cardTasks')}</dt><dd className="num font-semibold">{f.num(r.tasks)}</dd></div>
                <div><dt className="text-ink-3">{t('m26.sat.cardRated')}</dt><dd className="num font-semibold">{f.num(r.rated)}</dd></div>
                <div><dt className="text-ink-3">{t('m26.sat.cardDecided')}</dt><dd className="num font-semibold">{f.num(r.decided)}</dd></div>
              </dl>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[12px] text-ink-2">
                  <span>{t('m26.sat.cardCoverage')}</span>
                  <span className="num">{r.cov?.pct == null ? '—' : f.pct(r.cov.pct, 0)}</span>
                </div>
                <ProgressBar value={r.cov?.pct ?? 0} tone={r.cov?.gaps.length ? 'sim' : 'ok'} label={t('m26.sat.cardCoverage')} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                {(r.cov?.gaps.length ?? 0) > 0 && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m26.sat.chipGaps', { n: f.num(r.cov!.gaps.length) })}</span>}
                {(r.cov?.orphans.length ?? 0) > 0 && <span className="chip border-sim-line bg-sim-bg text-sim">{t('m26.sat.chipOrphans', { n: f.num(r.cov!.orphans.length) })}</span>}
                {(r.cov?.no_refresher.length ?? 0) > 0 && <span className="chip border-info-line bg-info-bg text-info">{t('m26.sat.chipRefresher', { n: f.num(r.cov!.no_refresher.length) })}</span>}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RuleCard />
        <RecentChanges d={d} m={m} />
      </div>
      {HAS_REDESIGN && <RedesignFlags m={m} />}
    </div>
  );
}

const SCALE = [1, 2, 3, 4, 5];
/** The DIF rule as a table plus a "try it" picker (same function the RPCs use). */
function RuleCard() {
  const t = useT();
  const [v, setV] = useState({ d: 4, i: 5, f: 1 });
  const r = difDecision(v.d, v.i, v.f);
  return (
    <Card title={t('m26.rule.title')} eyebrow={t('m26.rule.eyebrow')}>
      <ol className="list-decimal space-y-1 ps-5 text-[13px]" data-testid="m26-rule-branches">
        {['overtrain', 'important', 'difficult', 'rare_moderate', 'low'].map((k) => <li key={k} className={r.rule === k ? 'font-semibold text-accent' : ''}>{t(`m26.rule.${k}`)}</li>)}
      </ol>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(['d', 'i', 'f'] as const).map((k) => (
          <label key={k} className="block text-[12.5px]">
            <span className="caps">{t(`m26.dif.${k}`)}</span>
            <select className="input mt-1" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} data-testid={`m26-try-${k}`}>
              {SCALE.map((n) => <option key={n} value={n}>{n} · {t(`m26.scale.${k}${n}`)}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="text-[13px] text-ink-2">{t('m26.rule.outcome')}</span>
        <DecisionPill decision={r.decision} />
        <WhyThis reasons={r.reasons} testId="m26-rule-why" />
      </div>
      <p className="mt-3 text-[12px] text-ink-3">{t('m26.rule.source')}</p>
    </Card>
  );
}

function RecentChanges({ d, m }: { d: SatData; m: SatModel }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const xs = d.changes.slice(0, 5);
  return (
    <Card title={t('m26.sat.changesTitle')} actions={<L to="/training/sat/changes" className="link text-[13px]">{t('m26.sat.allChanges')}</L>}>
      {xs.length === 0 ? <EmptyState title={t('m26.changes.none')} /> : (
        <ul className="divide-y divide-line">
          {xs.map((c) => {
            const items = d.items.filter((i) => i.change_id === c.id);
            return (
              <li key={c.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.task.get(c.task_id)?.code}</span>
                  <span className="min-w-0 truncate">{pick(c.after as never, 'title')}</span>
                  <span className={`chip ${c.status === 'open' ? 'border-sim-line bg-sim-bg text-sim' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(`m26.changes.status.${c.status}`)}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-ink-2">
                  {t(`m26.changes.trigger.${c.trigger}`)} · {f.date(c.opened_at)} · {t('m26.changes.itemsDone', { a: f.num(items.filter((i) => i.status !== 'open').length), b: f.num(items.length) })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** F25 hand-off: courses the training manager flagged for redesign; each links to the tasks trained by that course. */
function RedesignFlags({ m }: { m: SatModel }) {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['redesign_flags' as never], () => repo.list('redesign_flags' as never).catch(() => [] as never[]) as Promise<Record<string, unknown>[]>);
  const flags = (q.data ?? []).filter((x) => x.status !== 'closed') as { id: string; course_id: string; status: string; note?: string }[];
  if (!flags.length) return null;
  const tasksFor = (courseId: string) => [...new Set(m.trace.links.filter((l) => l.active && l.course_id === courseId).map((l) => l.task_id))];
  const cols: Column<(typeof flags)[number]>[] = [
    { key: 'course', header: t('m26.redesign.course'), value: (x) => m.courseName(x.course_id), render: (x) => <span className="font-semibold">{m.courseName(x.course_id)}</span> },
    { key: 'status', header: t('m26.redesign.status'), value: (x) => t(`m26.redesign.state.${x.status === 'in_sat' || x.status === 'closed' ? x.status : 'open'}`) },
    { key: 'tasks', header: t('m26.redesign.tasks'), csv: false, render: (x) => (
      tasksFor(x.course_id).length
        ? <span className="flex flex-wrap gap-1.5">{tasksFor(x.course_id).map((id) => <L key={id} to={`/training/sat/tasks/${id}`} className="link text-[12.5px]">{m.task.get(id)?.code ?? id}</L>)}</span>
        : <span className="text-[12.5px] text-ink-3">{t('m26.redesign.noTasks')}</span>
    ) },
  ];
  return (
    <Section title={t('m26.redesign.title')} description={t('m26.redesign.body')}>
      <DataTable rows={flags} columns={cols} rowKey={(x) => x.id} searchable={false} />
    </Section>
  );
}

// /training/coverage/backlog (FS57): the gap-filling backlog. One row per skill and level the catalogue should reach: every uncovered role
// requirement (at its teachable target) and every open FS17 pathway gap (the FS17 backlog in M19 is the feed; this page carries the decision).
// Each row has an owner (by default the skill's owner function), a due date, build / partner / buy, the rationale and, when planned, the
// score moves the coverage rule predicts. Rows are never removed: when nothing needs a skill any more it reads "covered". The training manager
// syncs new needs (rpc.syncGapBacklog) and records decisions (rpc.decideGap, ledgered); everyone else reads.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { Async, BenchmarkChips, Card, ConfirmDialog, DataTable, Donut, Drawer, EmptyState, Grid, Icon, Page, Section, StatTile, WhyThis } from '../../ui';
import { L, useFormat, useLang, useT } from '../../i18n';
import type { BacklogView, CoverageReport } from './coverage';
import { DecisionDrawer, GbState, MovesList, RoutePill, useFs56Labels } from './fs56ui';

const STATES = ['open', 'planned', 'covered'] as const;

export default function BacklogPage() {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery(['gap_backlog', 'course_skill_links', 'pathways', 'pathway_gaps', 'external_resources', 'role_profile_versions'], async () => {
    const r = await repo.rpc.curriculumCoverage();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  return (
    <Page
      title={t('m25.routes.training-coverage-backlog.title')}
      intro={t('m25.gb.intro')}
      wide
      actions={
        <div className="flex flex-wrap gap-2">
          <L to="/training/coverage" className="btn-outline btn-sm"><Icon name="back" className="rtl:-scale-x-100" />{t('m25.gb.toCoverage')}</L>
          <L to="/training/pathways" className="btn-outline btn-sm">{t('m25.cov.toPathways')}</L>
          {q.data?.can_edit && <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m25-gb-sync"><Icon name="reset" />{t('m25.gb.sync')}</button>}
        </div>
      }
    >
      <BenchmarkChips feature="FS57" />
      <Async state={q}>{(d) => <Body d={d} />}</Async>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m25.gb.sync')} consequence={t('m25.gb.syncConsequence')} confirmLabel={t('m25.gb.sync')}
        onConfirm={async () => { await run(() => repo.rpc.syncGapBacklog()); setConfirm(false); }} />
    </Page>
  );
}

function Body({ d }: { d: CoverageReport }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const labels = useFs56Labels();
  const [state, setState] = useState<string>('open');
  const [source, setSource] = useState<'all' | 'roles' | 'gaps'>('all');
  const [owner, setOwner] = useState('');
  const [view, setView] = useState<BacklogView | null>(null);
  const [decide, setDecide] = useState<BacklogView | null>(null);
  const rows = useMemo(() => d.backlog.filter((b) => (!state || b.state === state) && (source === 'all' || (source === 'roles' ? b.roles.length > 0 : b.gap_ids.length > 0)) && (!owner || b.owner_role === owner)), [d, state, source, owner]);
  const n = (s: string) => d.backlog.filter((b) => b.state === s).length;
  const routes = (['build', 'partner', 'buy'] as const).map((r) => ({ label: t(`m25.gb.route.${r}`), value: d.backlog.filter((b) => b.route === r).length, tone: r === 'build' ? 'accent' : r === 'partner' ? 'leaf' : 'sky' }));
  const rationale = (b: BacklogView) => (lang === 'ar' && b.rationale_ar ? b.rationale_ar : b.rationale);
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m25.gb.tile.open')} value={f.num(n('open'))} sub={t('m25.gb.tile.openSub')} tone={n('open') ? 'bad' : undefined} />
        <StatTile label={t('m25.gb.tile.planned')} value={f.num(n('planned'))} sub={t('m25.gb.tile.plannedSub')} tone="info" />
        <StatTile label={t('m25.gb.tile.covered')} value={f.num(n('covered'))} sub={t('m25.gb.tile.coveredSub')} tone="ok" />
        <StatTile label={t('m25.gb.tile.owned')} value={`${f.num(d.backlog.filter((b) => b.owner_role).length)} / ${f.num(d.backlog.length)}`} sub={t('m25.gb.tile.ownedSub')} />
      </Grid>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="caps">{t('m25.gb.stateFilter')}</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t('m25.gb.stateFilter')}>
              {['', ...STATES].map((s) => (
                <button key={s || 'all'} type="button" className={state === s ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={state === s} onClick={() => setState(s)} data-testid={`m25-gb-filter-${s || 'all'}`}>
                  {s ? t(`m25.gb.state.${s}`) : t('m25.gb.allStates')} <span className="num">{f.num(s ? n(s) : d.backlog.length)}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m25.gb.sourceFilter')}</span>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value as never)} data-testid="m25-gb-source">
              <option value="all">{t('m25.gb.source.all')}</option><option value="roles">{t('m25.gb.source.roles')}</option><option value="gaps">{t('m25.gb.source.gaps')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m25.gb.ownerFilter')}</span>
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)} data-testid="m25-gb-owner-filter">
              <option value="">{t('m25.gb.allOwners')}</option>
              {d.owners.map((o) => <option key={o} value={o}>{t(`fs.owner.${o}`)}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <Section title={t('m25.gb.tableTitle')} description={t('m25.gb.tableHint')}>
        <div data-testid="m25-gb-table">
          <DataTable<BacklogView>
            rows={rows}
            rowKey={(r) => r.id}
            csvName="gap-backlog"
            onRowClick={(r) => setView(r)}
            empty={<EmptyState title={t('m25.gb.none')} />}
            columns={[
              { key: 'skill', header: t('m25.gb.col.skill'), value: (r) => labels.skill(r.skill_id), sortable: true,
                render: (r) => <div data-testid={`m25-gb-row-${r.id}`}><div className="font-semibold">{labels.skill(r.skill_id)}</div><div className="text-[12px] text-ink-3">{t('m25.gb.levelLine', { level: r.level, taught: r.taught })}</div></div> },
              { key: 'source', header: t('m25.gb.col.source'), value: (r) => r.roles.length * 100 + r.gap_ids.length, sortable: true,
                render: (r) => <div className="flex flex-wrap gap-1">{r.roles.length > 0 && <span className="rounded-full border border-bad-line bg-bad-bg px-2 text-[11.5px] text-bad" data-testid="m25-gb-src-roles">{t('m25.gb.srcRoles', { n: f.num(r.roles.length) })}</span>}{r.gap_ids.length > 0 && <span className="rounded-full border border-line px-2 text-[11.5px]" data-testid="m25-gb-src-gaps">{t('m25.gb.srcGaps', { n: f.num(r.gap_ids.length) })}</span>}{!r.roles.length && !r.gap_ids.length && <span className="text-[12px] text-ink-3">—</span>}</div> },
              { key: 'owner', header: t('m25.gb.col.owner'), value: (r) => t(`fs.owner.${r.owner_role}`), sortable: true,
                render: (r) => <div data-testid="m25-gb-owner" data-owner={r.owner_role}><div>{t(`fs.owner.${r.owner_role}`)}</div>{r.owner_person_id && <div className="text-[12px] text-ink-3">{lang === 'ar' ? r.owner_name_ar : r.owner_name}</div>}</div> },
              { key: 'due', header: t('m25.gb.col.due'), value: (r) => r.due_on ?? '9999', render: (r) => (r.due_on ? f.date(r.due_on) : <span className="text-ink-3">—</span>), sortable: true },
              { key: 'route', header: t('m25.gb.col.route'), value: (r) => r.route ?? '', render: (r) => <RoutePill r={r.route} />, sortable: true },
              { key: 'predicted', header: t('m25.gb.col.predicted'), value: (r) => r.predicted.reduce((s, m) => s + m.delta, 0), sortable: true,
                render: (r) => (r.status === 'decided' ? <span className="num text-[12.5px]">{t('m25.gb.predictedLine', { pts: f.num(r.predicted.reduce((s, m) => s + m.delta, 0)), n: f.num(r.predicted.length) })}</span> : <span className="text-ink-3">—</span>) },
              { key: 'state', header: t('m25.gb.col.state'), value: (r) => r.state, sortable: true,
                render: (r) => <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><GbState s={r.state} /><WhyThis reasons={r.reasons} testId={`why-gb-${r.id}`} />{d.can_edit && r.state !== 'covered' && <button type="button" className="btn-ghost btn-sm" onClick={() => setDecide(r)} data-testid={`m25-gb-decide-${r.id}`}>{r.status === 'decided' ? t('m25.gb.revise') : t('m25.gb.decide')}</button>}</div> },
            ]}
          />
        </div>
      </Section>

      <Grid cols={2}>
        <Card title={t('m25.gb.routesTitle')}>
          <Donut title={t('m25.gb.routesTitle')} data={routes} center={<span className="num text-[18px] font-semibold">{f.num(routes.reduce((s, r) => s + r.value, 0))}</span>} />
        </Card>
        <Card title={t('m25.gb.howTitle')}>
          <ul className="list-disc space-y-1.5 ps-5 text-[13px] text-ink-2" data-testid="m25-gb-how">
            <li>{t('m25.gb.how.feed')}</li>
            <li>{t('m25.gb.how.owner')}</li>
            <li>{t('m25.gb.how.never')}</li>
            <li>{t('m25.gb.how.predict')}</li>
          </ul>
        </Card>
      </Grid>

      <Drawer open={!!view} onClose={() => setView(null)} title={view ? t('m25.dec.title', { skill: labels.skill(view.skill_id), level: view.level }) : ''}>
        {view && (
          <div className="space-y-3" data-testid="m25-gb-drawer">
            <div className="flex flex-wrap items-center gap-2"><GbState s={view.state} /><RoutePill r={view.route} /><span className="text-[12.5px] text-ink-3">{t('m25.gb.firstSeen', { date: f.date(view.first_seen) })}</span></div>
            <dl className="grid grid-cols-2 gap-2 text-[13px]">
              <div><dt className="caps">{t('m25.gb.col.owner')}</dt><dd>{t(`fs.owner.${view.owner_role}`)}{view.owner_person_id ? ` · ${lang === 'ar' ? view.owner_name_ar : view.owner_name}` : ''}</dd></div>
              <div><dt className="caps">{t('m25.gb.col.due')}</dt><dd>{view.due_on ? f.date(view.due_on) : '—'}</dd></div>
            </dl>
            {view.rationale && <div><div className="caps">{t('m25.dec.rationale')}</div><p className="text-[13px]" data-testid="m25-gb-rationale">{rationale(view)}</p></div>}
            {view.plan && <div className="rounded-card border border-line p-2 text-[13px]" data-testid="m25-gb-plan">{t('m25.gb.planLine', { title: view.plan.title, level: view.plan.level, hours: view.plan.hours })}</div>}
            {view.status === 'decided' && <div><div className="caps mb-1">{t('m25.gb.predictedAt')}</div><MovesList moves={view.predicted} labels={labels} empty={t('m25.gb.noPredicted')} /></div>}
            {view.roles.length > 0 && <div><div className="caps mb-1">{t('m25.gb.uncoveredRoles')}</div><ul className="flex flex-wrap gap-1">{view.roles.map((x) => { const [r, h] = x.split('@'); return <li key={x} className="rounded-full border border-line px-2 text-[12px]">{labels.role(r)} · {t(`m25.cov.h.${h}`)}</li>; })}</ul></div>}
            {view.gap_ids.length > 0 && <div><div className="caps mb-1">{t('m25.gb.openGaps', { n: f.num(view.gap_ids.length) })}</div><L to="/training/pathways" className="link text-[13px]">{t('m25.gb.toFs17')}</L></div>}
            {view.history.length > 0 && <div><div className="caps mb-1">{t('m25.gb.history')}</div><ol className="space-y-1 text-[12.5px] text-ink-2">{view.history.map((x, i) => <li key={i}>{t('m25.gb.historyLine', { date: f.date(String(x.at).slice(0, 10)), route: t(`m25.gb.route.${x.route}`), due: f.date(String(x.due_on)) })}</li>)}</ol></div>}
            <WhyThis reasons={view.reasons} testId="why-gb-drawer" />
          </div>
        )}
      </Drawer>
      <DecisionDrawer open={!!decide} onClose={() => setDecide(null)} row={decide} report={d} />
    </>
  );
}

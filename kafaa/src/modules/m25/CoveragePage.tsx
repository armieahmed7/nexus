// /training/coverage (FS57): a 0-100 curriculum coverage score per role profile (FS05, now and 2030) from what the catalogue teaches
// (courses incl. FS19 links, published FS17 pathways with a filled learn step, published FS18 externals), up to the learning ceiling (level 2;
// levels 3 and 4 are built on the job). Uncovered skills per role, the score for both horizons side by side, and an in-memory what-if: plan a
// course for one skill and see exactly how each role's score would move (coverage.ts whatIf). Nothing is saved until the training manager
// records it as a backlog decision (DecisionDrawer -> ConfirmDialog -> rpc.decideGap).
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { Async, BenchmarkChips, Callout, Card, DataTable, Drawer, EmptyState, Grid, Heatmap, Icon, Page, Section, StatTile, Tabs, WhyThis } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { meanScore, whatIf, type BacklogView, type CoverageReport, type Horizon, type RoleCoverage, type TeachItem } from './coverage';
import { CoverageBar, DecisionDrawer, GbState, MovesList, useFs56Labels } from './fs56ui';

const teachHref = (i: TeachItem) => (i.kind === 'course' ? `/learn/course/${i.id}` : i.kind === 'pathway' ? `/learn/pathways/${i.id}` : '/learn/external');

export default function CoveragePage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const labels = useFs56Labels();
  const [h, setH] = useState<Horizon>('2030');
  const [open, setOpen] = useState<RoleCoverage | null>(null);
  const q = useQuery(['gap_backlog', 'course_skill_links', 'pathways', 'pathway_gaps', 'external_resources', 'role_profile_versions'], async () => {
    const r = await repo.rpc.curriculumCoverage();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });

  return (
    <Page
      title={t('m25.routes.training-coverage.title')}
      intro={t('m25.cov.intro')}
      wide
      actions={
        <div className="flex flex-wrap gap-2">
          <L to="/training/coverage/backlog" className="btn-primary btn-sm" data-testid="m25-cov-to-backlog"><Icon name="filter" />{t('m25.cov.toBacklog')}</L>
          <L to="/training/skill-change" className="btn-outline btn-sm"><Icon name="chart" />{t('m25.cov.toSkillChange')}</L>
          <L to="/training/pathways" className="btn-outline btn-sm">{t('m25.cov.toPathways')}</L>
        </div>
      }
    >
      <BenchmarkChips feature="FS57" />
      <Async state={q}>
        {(d) => <Body d={d} h={h} setH={setH} onOpen={setOpen} labels={labels} />}
      </Async>
      <Callout tone="info" title={t('m25.cov.ruleTitle')}>
        <ul className="list-disc space-y-1 ps-5" data-testid="m25-cov-rule">
          <li>{t('m25.cov.rule.taught')}</li>
          <li>{t('m25.cov.rule.ceiling', { n: 2 })}</li>
          <li>{t('m25.cov.rule.score')}</li>
          <li>{t('m25.cov.rule.security')}</li>
        </ul>
      </Callout>
      <RoleDrawer role={open} report={q.data} onClose={() => setOpen(null)} labels={labels} />
      <p className="text-[12px] text-ink-3">{q.data ? t('m25.cov.asOf', { date: f.date(q.data.as_of) }) : null}</p>
    </Page>
  );
}

function Body({ d, h, setH, onOpen, labels }: { d: CoverageReport; h: Horizon; setH: (h: Horizon) => void; onOpen: (r: RoleCoverage) => void; labels: ReturnType<typeof useFs56Labels> }) {
  const t = useT();
  const f = useFormat();
  const roles = d.roles.filter((r) => r.horizon === h);
  const scored = roles.filter((r) => r.score !== null);
  const uncovered = new Set(scored.flatMap((r) => r.uncovered));
  const open = d.backlog.filter((b) => b.state === 'open').length;
  const planned = d.backlog.filter((b) => b.state === 'planned').length;
  const ids = [...new Set(d.roles.filter((r) => r.score !== null).map((r) => r.role_id))];
  const at = (role: string, hz: string) => d.roles.find((r) => r.role_id === role && r.horizon === hz);
  const tab = (hz: Horizon) => ({
    id: hz, label: t(`m25.cov.h.${hz}`), badge: <span className="num">{f.num(meanScore(d.roles, hz))}</span>,
    content: (
      <div data-testid={`m25-cov-roles-${hz}`}>
        <DataTable<RoleCoverage>
          rows={d.roles.filter((r) => r.horizon === hz)}
          rowKey={(r) => `${r.role_id}@${r.horizon}`}
          csvName={`curriculum-coverage-${hz}`}
          onRowClick={(r) => onOpen(r)}
          initialSort={{ key: 'score', dir: 'asc' }}
          empty={<EmptyState title={t('m25.cov.none')} />}
          columns={[
            { key: 'role', header: t('m25.cov.col.role'), value: (r) => labels.role(r.role_id), sortable: true,
              render: (r) => <div data-testid={`m25-cov-role-${r.role_id}`}><div className="font-semibold">{labels.role(r.role_id)}</div>{labels.roleRow(r.role_id)?.lifecycle === 'concept' && <span className="text-[11.5px] text-ink-3">{t('m25.cov.concept')}</span>}</div> },
            { key: 'score', header: t('m25.cov.col.score'), value: (r) => r.score ?? 999, render: (r) => <CoverageBar score={r.score} />, sortable: true },
            { key: 'n', header: t('m25.cov.col.reqs'), value: (r) => r.n, render: (r) => (r.path_only ? <span className="text-[12px] text-ink-3">{t('m25.cov.pathOnly')}</span> : <span className="num">{f.num(r.covered)} / {f.num(r.n)}</span>), sortable: true },
            { key: 'uncovered', header: t('m25.cov.col.uncovered'), value: (r) => r.uncovered.length,
              render: (r) => (r.uncovered.length ? (
                <div className="flex flex-wrap gap-1">{r.uncovered.slice(0, 3).map((s) => <span key={s} className="rounded-full border border-bad-line bg-bad-bg px-2 text-[11.5px] text-bad">{labels.skill(s)}</span>)}{r.uncovered.length > 3 && <span className="text-[11.5px] text-ink-3">+{f.num(r.uncovered.length - 3)}</span>}</div>
              ) : <span className="text-[12px] text-ink-3">{r.path_only ? '—' : t('m25.cov.allCovered')}</span>), sortable: true },
          ]}
        />
      </div>
    ),
  });
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m25.cov.tile.mean', { h: t(`m25.cov.h.${h}`) })} value={f.num(meanScore(d.roles, h))} sub={t('m25.cov.tile.meanSub', { n: f.num(scored.length) })} />
        <StatTile label={t('m25.cov.tile.full')} value={`${f.num(scored.filter((r) => r.score === 100).length)} / ${f.num(scored.length)}`} sub={t('m25.cov.tile.fullSub')} tone="ok" />
        <StatTile label={t('m25.cov.tile.uncovered')} value={f.num(uncovered.size)} sub={t('m25.cov.tile.uncoveredSub')} tone={uncovered.size ? 'bad' : undefined} />
        <StatTile label={t('m25.cov.tile.backlog')} value={`${f.num(open)} · ${f.num(planned)}`} sub={t('m25.cov.tile.backlogSub')} />
      </Grid>

      <Section title={t('m25.cov.rolesTitle')} description={t('m25.cov.rolesHint')}>
        <Tabs tabs={[tab('now'), tab('2030')]} value={h} onChange={(x) => setH(x as Horizon)} />
      </Section>

      <Grid cols={2}>
        <Card title={t('m25.cov.heatTitle')}>
          <div data-testid="m25-cov-heat">
            <Heatmap title={t('m25.cov.heatTitle')} rows={ids} cols={['now', '2030']} rowLabel={(r) => labels.role(r)} colLabel={(c) => t(`m25.cov.h.${c}`)}
              value={(r, c) => { const x = at(r, c); const v = x?.score ?? null; return { v, label: v === null ? '—' : f.num(v), tone: v === null ? 'neutral' : v >= 90 ? 'ok' : v >= 70 ? 'info' : 'bad' }; }} />
          </div>
        </Card>
        <WhatIfCard d={d} labels={labels} />
      </Grid>
    </>
  );
}

/** In-memory what-if: plan a course that teaches one backlog skill at a level; see each role's score move. Saving opens the decision drawer. */
function WhatIfCard({ d, labels }: { d: CoverageReport; labels: ReturnType<typeof useFs56Labels> }) {
  const t = useT();
  const f = useFormat();
  const candidates = useMemo(() => d.backlog.filter((b) => b.state !== 'covered' && b.roles.length > 0).sort((a, b) => b.roles.length - a.roles.length || (a.id < b.id ? -1 : 1)), [d]);
  const [pick, setPick] = useState(candidates[0]?.id ?? '');
  const [level, setLevel] = useState(2);
  const [title, setTitle] = useState('');
  const [drawer, setDrawer] = useState(false);
  const row: BacklogView | undefined = d.backlog.find((b) => b.id === pick) ?? candidates[0];
  const moves = row ? whatIf(d.roles, row.skill_id, level) : [];
  const total = moves.reduce((s, m) => s + m.delta, 0);
  if (!candidates.length) return <Card title={t('m25.cov.wi.title')}><EmptyState title={t('m25.cov.wi.nothing')} /></Card>;
  return (
    <Card title={t('m25.cov.wi.title')}>
      <div className="space-y-3" data-testid="m25-cov-whatif">
        <p className="text-[13px] text-ink-2">{t('m25.cov.wi.intro')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m25.cov.wi.skill')}</span>
            <select className="input" value={row?.id ?? ''} onChange={(e) => setPick(e.target.value)} data-testid="m25-cov-wi-skill">
              {candidates.map((b) => <option key={b.id} value={b.id}>{t('m25.cov.wi.option', { skill: labels.skill(b.skill_id), level: b.level, n: b.roles.length })}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m25.cov.wi.level')}</span>
            <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))} data-testid="m25-cov-wi-level">{[1, 2].map((l) => <option key={l} value={l}>{l}</option>)}</select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="caps">{t('m25.cov.wi.titleLabel')}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('m25.cov.wi.titlePlaceholder')} data-testid="m25-cov-wi-title" />
        </label>
        <div className="flex flex-wrap items-baseline gap-2" aria-live="polite">
          <span className="caps">{t('m25.cov.wi.predicted')}</span>
          <span className="num text-[18px] font-semibold" data-testid="m25-cov-wi-total">+{f.num(total)}</span>
          <span className="text-[12.5px] text-ink-3">{t('m25.cov.wi.totalHint', { n: f.num(moves.length) })}</span>
        </div>
        <MovesList moves={moves} labels={labels} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line px-2 text-[11.5px] text-ink-3" data-testid="m25-cov-wi-unsaved">{t('m25.cov.wi.unsaved')}</span>
          {d.can_edit && row && <button type="button" className="btn-primary btn-sm ms-auto" onClick={() => setDrawer(true)} data-testid="m25-cov-wi-save"><Icon name="plus" />{t('m25.cov.wi.save')}</button>}
        </div>
      </div>
      <DecisionDrawer open={drawer} onClose={() => setDrawer(false)} row={row ?? null} report={d} plan={{ title: title.trim() || t('m25.cov.wi.defaultTitle', { skill: row ? labels.skill(row.skill_id) : '' }), level }} />
    </Card>
  );
}

function RoleDrawer({ role, report, onClose, labels }: { role: RoleCoverage | null; report: CoverageReport | undefined; onClose: () => void; labels: ReturnType<typeof useFs56Labels> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!role || !report) return null;
  const teach = new Map(report.teach.map((x) => [x.skill_id, x.items]));
  const backlog = new Map(report.backlog.map((b) => [b.id, b]));
  return (
    <Drawer open onClose={onClose} title={`${labels.role(role.role_id)} · ${t(`m25.cov.h.${role.horizon}`)}`}>
      <div className="space-y-3" data-testid="m25-cov-drawer">
        <div className="flex flex-wrap items-center gap-3"><CoverageBar score={role.score} testId="m25-cov-drawer-score" /><span className="text-[12.5px] text-ink-3">{role.path_only ? t('m25.cov.pathOnlyText') : t('m25.cov.drawerHint', { covered: f.num(role.covered), n: f.num(role.n) })}</span></div>
        {!role.path_only && (
          <ul className="space-y-2" data-testid="m25-cov-reqs">
            {role.reqs.map((q) => {
              const items = teach.get(q.skill_id) ?? [];
              const gb = backlog.get(`gb:${q.skill_id}:${q.target}`);
              const full = q.taught >= q.target;
              return (
                <li key={q.skill_id} className={`rounded-card border p-2 ${full ? 'border-line' : 'border-bad-line bg-bad-bg'}`} data-testid="m25-cov-req" data-covered={full ? 'yes' : 'no'}>
                  <div className="flex flex-wrap items-center gap-2">
                    <L to={`/skills/${q.skill_id}`} className="link font-semibold">{labels.skill(q.skill_id)}</L>
                    <span className="caps">{q.weight === 2 ? t('m25.cov.core') : t('m25.cov.important')}</span>
                    <span className="ms-auto text-[12px] text-ink-2">{t('m25.cov.reqLine', { need: q.need, target: q.target, taught: q.taught })}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {items.length ? items.map((i) => <L key={`${i.kind}-${i.id}`} to={teachHref(i)} className="rounded-full border border-line bg-panel px-2 text-[11.5px]" data-testid="m25-cov-teach">{t(`m25.cov.kind.${i.kind}`)} · {pick(i, 'title')} · {t('m25.sc.levelN', { n: i.level })}</L>)
                      : <span className="text-[12px] text-bad">{t('m25.cov.nothingTeaches')}</span>}
                  </div>
                  {gb && <div className="mt-1 flex items-center gap-2 text-[12px]"><GbState s={gb.state} /><WhyThis reasons={gb.reasons} testId={`why-cov-${q.skill_id}`} /><L to="/training/coverage/backlog" className="link">{t('m25.cov.inBacklog')}</L></div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

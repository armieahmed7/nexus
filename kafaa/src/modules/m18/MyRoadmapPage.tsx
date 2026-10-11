// M18 /my/career/roadmap (F06 Career Roadmap and what-if simulator). Pick a target (shortlist first), a route from the current
// role, and what-ifs (programme intake, rotation, mentoring, leadership course, gap courses). The quarter-by-quarter timeline
// (up to 10 years) recomputes live: programme blocks with published durations and sources, REG-17 milestones (internal exam,
// FANR 60-day notice, exam, certification), experience months counted from the person's own records, and the critical path.
// Two scenarios compare side by side. Saved scenarios can be shared with the line manager and sent to the development plan
// (rpc.roadmapToPlan, behind a ConfirmDialog). Indicative durations carry a SAMPLE tag on screen, in print and in the export.
import { useEffect, useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, StatTile, Grid, Icon, CheckboxField, SelectField, TextField, ConfirmDialog, SimChip, SourceLink, Timeline, downloadText, useFilters, EngineBadge, BenchmarkChips } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine'; // direct import: avoids a circular chunk warning in the build
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { buildRoadmap, developmentBlocks, routeOptions, roadmapCsv, quarterIndex, quarterStart, addMonths, DEFAULT_SCENARIO, HORIZON_QUARTERS, MAX_DELAY_Q, type Block, type Roadmap, type RoadmapInput, type Scenario, type RmEdge } from './roadmap';
import { reachableRoles } from './career';
import { useArrow, useCareerBase, type CareerBase, type RoadmapRow } from './shared';
// FS15 (FS wave B · E5): a roadmap can target a concept future role (banner; bridge learning sized by my FS05 profile gaps)
import { ConceptBanner, ConceptBandPill, ConceptChip, useConceptReadiness } from './futureUi';

export default function MyRoadmapPage() {
  const t = useT();
  const s = useSession();
  const me = s.person?.id ?? null;
  const base = useCareerBase(me);
  const eng = useEngine('recommend');
  return (
    <Page title={t('m18.routes.my-career-roadmap.title')} intro={t('m18.rm.intro')} wide actions={<><EngineBadge engine={eng} /><L to="/my/career" className="btn-ghost btn-sm">{t('m18.rm.toNavigator')}</L></>}>
      <Async state={base}>
        {(d) =>
          !d.facts?.role_id ? (
            <EmptyState title={t('m18.nav.noRole')} icon="briefcase">{t('m18.nav.noRoleBody')}</EmptyState>
          ) : (
            <Planner d={d} me={me!} canPlan={s.can('dev_plans', ['Own'])} />
          )
        }
      </Async>
    </Page>
  );
}

function Planner({ d, me, canPlan }: { d: CareerBase; me: string; canPlan: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const eng = useEngine('recommend');
  const repo = useRepo();
  const act = useAction();
  const arrow = useArrow();
  const myRole = d.facts!.role_id!;
  const [p, setP] = useFilters({ role: '', rm: '' }, true);
  const shortlist = d.targets.filter((x) => x.active).sort((a, b) => a.rank - b.rank).map((x) => x.role_id).filter((r) => r !== myRole);
  const reach = useMemo(() => [...reachableRoles(d.edges as never, myRole, 4)].filter(([id]) => !d.roleById.get(id)?.security_sensitive).sort((a, b) => a[1] - b[1]).map(([id]) => id), [d.edges, d.roleById, myRole]);
  const conceptIds = useMemo(() => d.roles.filter((r) => (r as { lifecycle?: string }).lifecycle === 'concept').map((r) => r.id), [d.roles]);
  const conceptReach = useMemo(() => conceptIds.filter((id) => routeOptions(d.edges as unknown as RmEdge[], myRole, id).length > 0), [conceptIds, d.edges, myRole]);
  const saved = d.roadmaps.filter((r) => r.active).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const loaded = p.rm ? saved.find((r) => r.id === p.rm) ?? null : null;
  const target = loaded?.target_role_id ?? (p.role || shortlist[0] || reach[0] || '');
  const isConcept = conceptIds.includes(target);
  const cq = useConceptReadiness(me, isConcept ? [target] : [], isConcept);
  const cr = isConcept ? cq.data?.get(target) ?? null : null;
  const routes = useMemo(() => (target ? routeOptions(d.edges as unknown as RmEdge[], myRole, target) : []), [d.edges, myRole, target]);

  const have = useMemo(() => eng.skills.competencyLevels(d.states as never, d.skills), [eng, d.states, d.skills]);
  const input: RoadmapInput = useMemo(() => {
    const done = new Set(d.trainingRecords.filter((x) => x.result === 'passed' || x.result === 'completed').map((x) => x.course_id));
    const courses = d.courses.filter((c) => c.audience === 'staff' && !done.has(c.id) && !String(c.programme_id ?? '').match(/^(coit|loit)$/));
    // FS15: for a concept target the gaps come from its FS05 profile (skill requirements count towards their competency)
    const skillComp = new Map(d.skills.map((x) => [x.id, x.competency_id]));
    const conceptComps = cr ? cr.gaps.map((g) => ({ role_id: target, competency_id: g.kind === 'skill' ? skillComp.get(g.ref_id) ?? g.ref_id : g.ref_id, required_level: g.need, importance: g.importance })) : [];
    const gap = target ? eng.rank.coursesForGaps({ have, currentRole: null, targets: [target], roleComps: cr ? conceptComps : d.roleComps, courses: courses as never }).slice(0, 3).map((x) => x.item as unknown as { id: string; title_en: string; title_ar: string; duration_hours: number | null }) : [];
    return {
      now: new Date().toISOString().slice(0, 10), roleId: myRole, monthsInRole: d.facts!.months_in_role, qualifiedInRole: d.facts!.qualified_in_role,
      edges: d.edges as unknown as RmEdge[], roles: d.roles, programmes: d.programmes as never, sources: d.sources.map((s) => ({ id: s.id, label: s.label, url: s.url })),
      gapCourses: gap, leadershipCourse: (d.courses.find((c) => c.id === 'c-intilaqa') as never) ?? null,
      conceptRoles: conceptIds, bridgeMonths: cr?.gap_months ?? 0,
    };
  }, [d, eng, have, myRole, target, cr, conceptIds]);

  const fresh = (path: string[] = routes[0]?.map((e) => e.id) ?? []): Scenario => ({ path, ...DEFAULT_SCENARIO });
  const [a, setA] = useState<Scenario>(() => fresh());
  const [b, setB] = useState<Scenario>(() => ({ ...fresh(), delayQ: 4 }));
  const [compare, setCompare] = useState(false);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (loaded) {
      const sc = loaded.scenario as Partial<Scenario>;
      const okPath = routes.find((r) => r.map((e) => e.id).join() === (sc.path ?? []).join());
      setA({ ...fresh(), ...sc, delayQ: Math.max(0, Math.min(MAX_DELAY_Q, Number(sc.delayQ) || 0)), path: okPath ? okPath.map((e) => e.id) : fresh().path });
      setName(loaded.name);
    } else {
      setA(fresh());
      setB({ ...fresh(), delayQ: 4 });
      setName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, loaded?.id, routes.length]);

  const ra = useMemo(() => buildRoadmap(input, a), [input, a]);
  const rb = useMemo(() => buildRoadmap(input, b), [input, b]);
  const dirty = !loaded || !sameScenario(loaded.scenario as Partial<Scenario>, a) || loaded.target_role_id !== target;
  const dev = developmentBlocks(ra);

  const targetOpts = [...new Set([...shortlist, ...reach, ...conceptReach])].map((id) => ({ value: id, label: `${pick(d.roleById.get(id), 'title')}${conceptIds.includes(id) ? ` · ${t('m18.fs15.conceptChip')}` : ''}${shortlist.includes(id) ? ` · ${t('m18.rm.inShortlist')}` : ''}` }));
  const routeLabel = (r: RmEdge[]) => [pick(d.roleById.get(myRole), 'title'), ...r.map((e) => pick(d.roleById.get(e.to_role_id), 'title'))].join(` ${arrow} `) + ` (${r.map((e) => pick(e, 'label')).join('; ')})`;

  const save = async (): Promise<string | null> => {
    const now = new Date().toISOString();
    const row = { name: name.trim() || t('m18.rm.defaultName', { role: pick(d.roleById.get(target), 'title') }), scenario: a, plan: ra.blocks, earliest_on: ra.earliest, end_on: ra.end, target_role_id: target, updated_at: now };
    if (loaded && loaded.target_role_id === target) {
      const r = await act(() => repo.update('roadmaps', loaded.id, row as never), { success: t('m18.rm.saved') });
      return r.ok ? loaded.id : null;
    }
    const id = `rm-${me.replace(/^p-/, '')}-${Date.now().toString(36)}`;
    const r = await act(() => repo.insert('roadmaps', { id, person_id: me, shared: false, shared_person_id: null, active: true, created_at: now, ...row } as never), { success: t('m18.rm.saved') });
    if (r.ok) setP({ rm: id, role: target });
    return r.ok ? id : null;
  };
  const sendToPlan = async () => {
    const id = dirty ? await save() : loaded!.id;
    if (!id) return;
    await act(() => repo.rpc.roadmapToPlan(id), {});
  };
  const exportCsv = () => {
    const csv = roadmapCsv(ra, lang, { indicative: t('m18.rm.indicative'), published: t('m18.rm.published'), header: [t('m18.rm.col.block'), t('m18.rm.col.lane'), t('m18.rm.col.start'), t('m18.rm.col.end'), t('m18.rm.col.duration'), t('m18.rm.col.basis'), t('m18.rm.col.source')] });
    downloadText(`kafaa-roadmap-${target}.csv`, `﻿${csv}\r\n\r\n"${t('m18.rm.exportNote')}"`, 'text/csv;charset=utf-8');
  };

  return (
    <>
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m18-rm-form">
          <SelectField label={t('m18.rm.target')} name="role" value={target} onChange={(v) => setP({ role: v, rm: '' })} options={targetOpts} hint={t('m18.rm.targetHint')} />
          <TextField label={t('m18.rm.name')} name="name" value={name} onChange={setName} placeholder={t('m18.rm.defaultName', { role: pick(d.roleById.get(target), 'title') })} />
        </div>
      </Card>

      {isConcept && (
        <div className="space-y-2" data-testid="m18-rm-concept">
          <ConceptBanner />
          <div className="flex flex-wrap items-center gap-2">
            <ConceptChip />
            {cr && <ConceptBandPill r={cr} />}
            {cr && <span className="text-[12.5px] text-ink-2">{t('m18.fs15.rmBridge', { n: f.num(Math.max(3, cr.gap_months)), horizon: cr.horizon })}</span>}
            <BenchmarkChips feature="FS15" />
          </div>
        </div>
      )}
      {!target ? (
        <EmptyState title={t('m18.rm.pick')} icon="sparkle" />
      ) : routes.length === 0 ? (
        <EmptyState title={t('m18.rm.noRoute')} icon="info" action={<L to="/my/career" className="btn-outline btn-sm">{t('m18.rm.toNavigator')}</L>}>{t('m18.rm.noRouteBody')}</EmptyState>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 ${compare ? 'xl:grid-cols-2' : ''}`}>
            <ScenarioCard label={compare ? t('m18.rm.scenarioA') : t('m18.rm.whatIf')} s={a} set={setA} routes={routes} routeLabel={routeLabel} r={ra} testId="m18-scenario-a" />
            {compare && <ScenarioCard label={t('m18.rm.scenarioB')} s={b} set={setB} routes={routes} routeLabel={routeLabel} r={rb} testId="m18-scenario-b" />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CheckboxField label={t('m18.rm.compare')} checked={compare} onChange={(v) => { setCompare(v); if (v) setB({ ...a, delayQ: Math.min(MAX_DELAY_Q, a.delayQ + 4) }); }} />
          </div>

          <Grid cols={4}>
            <StatTile label={t('m18.rm.earliest')} value={<span data-testid="m18-rm-end">{f.date(ra.end)}</span>} sub={ra.end !== ra.earliest ? t('m18.rm.vsEarliest', { date: f.date(ra.earliest), n: f.num(monthsBetweenIso(ra.earliest, ra.end)) }) : t('m18.rm.isEarliest')} tone="ok" />
            <StatTile label={t('m18.rm.duration')} value={t('m18.rm.years', { n: f.num(Math.round((ra.months / 12) * 10) / 10) })} sub={t('m18.rm.months', { n: f.num(ra.months) })} />
            <StatTile label={t('m18.rm.firstProgramme')} value={<span className="text-[16px]">{ra.firstProgramme ? (lang === 'ar' ? ra.firstProgramme.ar : ra.firstProgramme.en) : t('m18.rm.none')}</span>} sub={ra.blocks.find((x) => x.lane === 'programme') ? t('m18.rm.startsOn', { date: f.date(ra.blocks.find((x) => x.lane === 'programme')!.start) }) : undefined} />
            {compare ? (
              <StatTile label={t('m18.rm.diff')} value={diffLabel(t, f, monthsBetweenIso(ra.end, rb.end))} sub={t('m18.rm.diffSub', { a: f.date(ra.end), b: f.date(rb.end) })} tone={rb.end > ra.end ? 'sim' : 'ok'} />
            ) : (
              <StatTile label={t('m18.rm.devBlocks')} value={f.num(dev.length)} sub={t('m18.rm.devBlocksSub')} />
            )}
          </Grid>
          {ra.beyondHorizon && <Callout tone="sim">{t('m18.rm.beyond', { n: f.num(HORIZON_QUARTERS / 4) })}</Callout>}

          <Section title={t('m18.rm.timeline')} description={t('m18.rm.timelineDesc')} actions={
            <>
              <button className="btn-outline btn-sm" onClick={exportCsv} data-testid="m18-rm-export"><Icon name="download" size={14} />{t('m18.rm.export')}</button>
              <button className="btn-outline btn-sm" onClick={() => window.print()} data-testid="m18-rm-print">{t('m18.rm.print')}</button>
            </>
          }>
            <Gantt rs={compare ? [{ label: t('m18.rm.scenarioA'), r: ra }, { label: t('m18.rm.scenarioB'), r: rb }] : [{ label: '', r: ra }]} />
          </Section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Section title={t('m18.rm.milestones')}>
              <Card>
                <Timeline items={ra.blocks.filter((x) => x.lane === 'milestone' || x.lane === 'programme').sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0)).map((x) => ({
                  id: x.id, when: f.date(x.start), tone: x.kind === 'move' || x.kind === 'certification' ? 'ok' : x.lane === 'programme' ? 'accent' : x.kind === 'fanr_notice' ? 'info' : 'neutral',
                  title: lang === 'ar' ? x.title.ar : x.title.en, detail: x.lane === 'programme' ? t('m18.rm.until', { date: f.date(x.end) }) : x.indicative ? t('m18.rm.indicativeDate') : undefined,
                }))} />
              </Card>
            </Section>
            <Section title={t('m18.rm.sources')} description={t('m18.rm.sourcesDesc')}>
              <SourcesTable r={ra} />
            </Section>
          </div>

          <Section title={t('m18.rm.actions')}>
            <Card>
              <div className="flex flex-wrap items-center gap-2" data-testid="m18-rm-actions">
                <button className="btn-outline" onClick={() => void save()} data-testid="m18-rm-save"><Icon name="check" size={14} />{loaded && !dirty ? t('m18.rm.savedState') : t('m18.rm.save')}</button>
                <button className="btn-primary" disabled={!canPlan || dev.length === 0} onClick={() => setConfirm(true)} data-testid="m18-rm-send">{t('m18.rm.send')}</button>
                {loaded?.sent_plan_id && <StatusPill tone="ok">{t('m18.rm.sentTo', { id: loaded.sent_plan_id })}</StatusPill>}
                {canPlan && <L to="/my/plan" className="btn-ghost btn-sm">{t('m18.rm.openPlan')}</L>}
              </div>
              <p className="mt-2 text-[12.5px] text-ink-2">{dev.length ? t('m18.rm.sendHint', { n: f.num(dev.length) }) : t('m18.rm.sendNone')}</p>
            </Card>
          </Section>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m18.rm.confirmTitle')} consequence={t('m18.rm.confirmBody', { n: f.num(dev.length), role: pick(d.roleById.get(target), 'title') })} confirmLabel={t('m18.rm.send')}
            onConfirm={async () => { await sendToPlan(); setConfirm(false); }}>
            <ul className="list-disc space-y-0.5 ps-5 text-[13px]">{dev.map((x) => <li key={x.id}>{lang === 'ar' ? x.title.ar : x.title.en} · {f.date(x.end)}</li>)}</ul>
          </ConfirmDialog>
        </>
      )}

      <SavedRoadmaps d={d} me={me} saved={saved} current={loaded?.id ?? null} onLoad={(id, role) => setP({ rm: id, role })} />
      <p className="text-[12.5px] text-ink-3">{t('m18.rm.disclaimer')}</p>
    </>
  );
}

const sameScenario = (x: Partial<Scenario>, y: Scenario) =>
  (x.path ?? []).join() === y.path.join() && x.delayQ === y.delayQ && !!x.rotation === y.rotation && !!x.mentoring === y.mentoring && !!x.leadership === y.leadership && !!x.courses === y.courses;
const monthsBetweenIso = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};
function diffLabel(t: (k: string, v?: Record<string, string | number>) => string, f: ReturnType<typeof useFormat>, n: number) {
  return n === 0 ? t('m18.rm.same') : n > 0 ? t('m18.rm.later', { n: f.num(n) }) : t('m18.rm.earlier', { n: f.num(-n) });
}

function ScenarioCard({ label, s, set, routes, routeLabel, r, testId }: { label: string; s: Scenario; set: (s: Scenario) => void; routes: RmEdge[][]; routeLabel: (r: RmEdge[]) => string; r: Roadmap; testId: string }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const prog = r.firstProgramme ? (lang === 'ar' ? r.firstProgramme.ar : r.firstProgramme.en) : t('m18.rm.theProgramme');
  return (
    <Card title={label} eyebrow={t('m18.rm.scenario')}>
      <div className="space-y-3" data-testid={testId}>
        {routes.length > 1 && (
          <SelectField label={t('m18.rm.route')} name={`${testId}-route`} value={s.path.join(',')} onChange={(v) => v && set({ ...s, path: v.split(',') })} options={routes.map((x) => ({ value: x.map((e) => e.id).join(','), label: routeLabel(x) }))} hint={t('m18.rm.routeHint')} />
        )}
        {routes.length === 1 && <div className="text-[13px] text-ink-2"><span className="caps me-1">{t('m18.rm.route')}</span>{routeLabel(routes[0])}</div>}
        <div>
          <label htmlFor={`${testId}-delay`} className="mb-1 block text-[13px] font-semibold">{t('m18.rm.delay', { programme: prog })}</label>
          <input id={`${testId}-delay`} type="range" min={0} max={MAX_DELAY_Q} step={1} value={s.delayQ} onChange={(e) => set({ ...s, delayQ: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" aria-valuetext={s.delayQ === 0 ? t('m18.rm.nextIntake') : t('m18.rm.plusQ', { n: s.delayQ })} data-testid={`${testId}-delay`} />
          <div className="flex justify-between text-[12px] text-ink-2"><span>{t('m18.rm.nextIntake')}</span><span className="num font-semibold text-ink">{s.delayQ === 0 ? t('m18.rm.nextIntake') : t('m18.rm.plusQ', { n: f.num(s.delayQ) })}</span><span>{t('m18.rm.plusQ', { n: f.num(MAX_DELAY_Q) })}</span></div>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <CheckboxField label={t('m18.rm.rotation')} hint={t('m18.rm.rotationHint')} checked={s.rotation} onChange={(v) => set({ ...s, rotation: v })} />
          <CheckboxField label={t('m18.rm.mentoring')} checked={s.mentoring} onChange={(v) => set({ ...s, mentoring: v })} />
          <CheckboxField label={t('m18.rm.leadership')} checked={s.leadership} onChange={(v) => set({ ...s, leadership: v })} />
          <CheckboxField label={t('m18.rm.courses')} checked={s.courses} onChange={(v) => set({ ...s, courses: v })} />
        </div>
        <div className="rounded-btn bg-sunken px-3 py-2 text-[13px]" aria-live="polite">{t('m18.rm.result', { date: f.date(r.end) })}</div>
      </div>
    </Card>
  );
}

const LANES: Block['lane'][] = ['experience', 'programme', 'milestone', 'development'];
const LANE_CLS: Record<Block['lane'], string> = { experience: 'bg-info-bg border-info-line text-info', programme: 'bg-accent text-accent-ink border-accent', milestone: '', development: 'bg-ok-bg border-ok-line text-ok' };

/** Quarter grid (up to 10 years). Blocks are placed with logical insets, so the chart mirrors in RTL. */
function Gantt({ rs }: { rs: { label: string; r: Roadmap }[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const start = quarterStart(rs[0].r.start);
  const lastQ = Math.max(...rs.map((x) => quarterIndex(start, x.r.end)));
  const nQ = Math.min(HORIZON_QUARTERS, Math.max(8, lastQ + 2));
  const end = addMonths(start, nQ * 3);
  const span = Date.parse(end) - Date.parse(start);
  const pos = (iso: string) => Math.max(0, Math.min(100, ((Date.parse(iso) - Date.parse(start)) / span) * 100));
  const years: { y: number; from: number; n: number }[] = [];
  for (let q = 0; q < nQ; q++) {
    const y = Number(addMonths(start, q * 3).slice(0, 4));
    const last = years[years.length - 1];
    if (last && last.y === y) last.n++; else years.push({ y, from: q, n: 1 });
  }
  const todayX = pos(new Date().toISOString().slice(0, 10));
  return (
    <div className="card overflow-x-auto p-3" data-testid="m18-gantt">
      <div className="min-w-[760px]">
        <div className="relative ms-[132px] h-6 border-b border-line text-[11px] text-ink-2">
          {years.map((y) => (
            <div key={y.y} className="absolute top-0 h-full border-s border-line ps-1 font-semibold" style={{ insetInlineStart: `${(y.from / nQ) * 100}%`, width: `${(y.n / nQ) * 100}%` }}>{f.num(y.y, { useGrouping: false })}</div>
          ))}
        </div>
        {rs.map(({ label, r }) => (
          <div key={label || 'a'} className="mt-2" data-testid="m18-gantt-scenario">
            {label && <div className="caps mb-1">{label} · {f.date(r.end)}</div>}
            {LANES.map((lane) => {
              const bs = r.blocks.filter((b) => b.lane === lane);
              if (!bs.length) return null;
              const rows: Block[][] = [];
              for (const b of [...bs].sort((x, y) => (x.start < y.start ? -1 : 1))) {
                const row = lane === 'milestone' ? rows[0] ?? (rows[0] = []) : rows.find((rw) => rw.every((o) => o.end <= b.start || o.start >= b.end));
                if (row) row.push(b); else rows.push([b]);
              }
              return (
                <div key={lane} className="flex items-stretch border-b border-line/60 py-1">
                  <div className="w-[132px] shrink-0 pe-2 pt-1 text-[12px] font-semibold text-ink-2">{t(`m18.lane.${lane}`)}</div>
                  <div className="relative flex-1" style={{ height: `${rows.length * 30 + 4}px` }}>
                    {Array.from({ length: nQ }, (_, q) => <div key={q} className="absolute top-0 h-full border-s border-line/40" style={{ insetInlineStart: `${(q / nQ) * 100}%` }} aria-hidden />)}
                    <div className="absolute top-0 h-full border-s-2 border-bad/60" style={{ insetInlineStart: `${todayX}%` }} title={t('m18.rm.today')} aria-hidden />
                    {rows.map((row, ri) => row.map((b) => {
                      const x = pos(b.start);
                      const title = `${lang === 'ar' ? b.title.ar : b.title.en} · ${f.date(b.start)}${b.end !== b.start ? ` – ${f.date(b.end)}` : ''}${b.indicative ? ` · ${t('m18.rm.indicative')}` : ''}${b.critical ? ` · ${t('m18.rm.critical')}` : ''}`;
                      if (lane === 'milestone') {
                        return (
                          <span key={b.id} className={`absolute top-[7px] block h-3.5 w-3.5 -translate-x-1/2 rotate-45 rtl:translate-x-1/2 ${b.kind === 'move' || b.kind === 'certification' ? 'bg-ok' : b.kind === 'fanr_notice' ? 'bg-info' : b.critical ? 'bg-accent' : 'bg-line-strong'}`} style={{ insetInlineStart: `${x}%` }} title={title} aria-label={title} role="img" data-testid="m18-gantt-milestone" data-kind={b.kind} />
                        );
                      }
                      const w = Math.max(1.2, pos(b.end) - x);
                      return (
                        <div key={b.id} className={`absolute flex h-[26px] items-center overflow-hidden rounded-[6px] border px-1.5 text-[11px] font-semibold ${LANE_CLS[lane]} ${b.indicative ? 'border-dashed' : ''} ${b.critical ? 'ring-2 ring-accent/50' : ''}`} style={{ insetInlineStart: `${x}%`, width: `${w}%`, top: `${ri * 30 + 2}px` }} title={title} data-testid="m18-gantt-block" data-kind={b.kind} data-start={b.start} data-end={b.end}>
                          <span className="truncate">{lang === 'ar' ? b.title.ar : b.title.en}</span>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
          <span><span className="me-1 inline-block h-2.5 w-4 rounded-sm ring-2 ring-accent/50" aria-hidden />{t('m18.rm.critical')}</span>
          <span><span className="me-1 inline-block h-2.5 w-4 rounded-sm border border-dashed border-ink-3" aria-hidden />{t('m18.rm.indicative')}</span>
          <span><span className="me-1 inline-block h-2.5 w-0.5 bg-bad/60 align-middle" aria-hidden />{t('m18.rm.today')}</span>
        </div>
      </div>
    </div>
  );
}

function SourcesTable({ r }: { r: Roadmap }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const rows = r.blocks.filter((b) => b.lane !== 'milestone' || b.source || b.indicative);
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table-base w-full text-[13px]" data-testid="m18-rm-sources">
        <thead><tr><th className="text-start">{t('m18.rm.col.block')}</th><th className="text-start">{t('m18.rm.col.duration')}</th><th className="text-start">{t('m18.rm.col.source')}</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{lang === 'ar' ? b.title.ar : b.title.en}</td>
              <td className="num whitespace-nowrap">{b.weeks ? t('m18.rm.weeks', { n: f.num(b.weeks) }) : b.months ? t('m18.rm.months', { n: f.num(b.months) }) : f.date(b.start)}</td>
              <td>
                <div className="flex flex-wrap items-center gap-1.5">
                  {b.source && <SourceLink href={b.source.url}>{b.source.label.length > 48 ? `${b.source.label.slice(0, 47)}…` : b.source.label}</SourceLink>}
                  {!b.source && b.rule_ref && <span className="text-[12px] text-ink-2">{b.rule_ref}</span>}
                  {b.indicative && <SimChip label={t('m18.rm.sample')} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedRoadmaps({ d, me, saved, current, onLoad }: { d: CareerBase; me: string; saved: RoadmapRow[]; current: string | null; onLoad: (id: string, role: string) => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  return (
    <Section title={t('m18.rm.savedTitle')} description={t('m18.rm.savedDesc')}>
      {saved.length === 0 ? (
        <EmptyState title={t('m18.rm.savedNone')} icon="calendar" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m18-saved">
          {saved.map((r) => (
            <li key={r.id} className={`card p-3 ${current === r.id ? 'ring-2 ring-accent/40' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{r.name || pick(d.roleById.get(r.target_role_id), 'title')}</div>
                  <div className="text-[12.5px] text-ink-2">{pick(d.roleById.get(r.target_role_id), 'title')} · {t('m18.rm.endsOn', { date: f.date(r.end_on) })}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.shared && <StatusPill tone="info">{t('m18.rm.sharedPill')}</StatusPill>}
                  {r.sent_plan_id && <StatusPill tone="ok">{t('m18.rm.inPlan')}</StatusPill>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button className="btn-outline btn-sm" onClick={() => onLoad(r.id, r.target_role_id)} disabled={current === r.id} data-testid="m18-saved-load">{current === r.id ? t('m18.rm.open') : t('m18.rm.load')}</button>
                <button className="btn-ghost btn-sm" onClick={() => act(() => repo.update('roadmaps', r.id, { shared: !r.shared, shared_person_id: !r.shared ? me : null, updated_at: new Date().toISOString() }), { success: !r.shared ? t('m18.short.sharedOn') : t('m18.short.sharedOff') })} data-testid="m18-saved-share">
                  {r.shared ? t('m18.rm.unshare') : t('m18.rm.share')}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => act(() => repo.update('roadmaps', r.id, { active: false, updated_at: new Date().toISOString() }), { success: t('m18.rm.archived') })}>{t('m18.rm.archive')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

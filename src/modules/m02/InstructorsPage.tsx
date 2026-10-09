// /training/instructors (M02 · F31): the instructor and SME pipeline for instructors, the training manager and auditors (sat R/W/A).
// Pool board (currency status with the 90/60/30-day notices, delivery and development hours against the annual minimum), pipeline by
// stage (accept or decline nominations, qualify ready candidates: maker-checker), the observation queue (an instructor never observes
// themselves), the SME finder (F01 skills, F21 SME profiles, F13 SME mentors; <WhyThis>), the teaching hours log and sourced facts.
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, StatTile, Tabs, DataTable, ConfirmDialog, Icon, WhyThis, EngineBadge, SelectField, ProgressBar, FilterBar, useFilters } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { INS_RULES, poolSummary, type Stage } from './instructors';
import { rankSmeCandidates } from './instructorMatch';
import {
  CurrencyPill, HoursChart, LogHoursModal, MirrorNote, NominateModal, NoticeChip, ObservationModal, ProgrammeFacts, RouteChip, StagePill, StdChips, useInsData, useNamePick,
  type InsData, type TrackView,
} from './instructorUi';

export default function InstructorsPage() {
  const t = useT();
  const q = useInsData();
  return (
    <Page title={t('m02.routes.training-instructors.title')} eyebrow={t('m02.ins.eyebrow')} intro={t('m02.ins.board.intro')} wide>
      <Async state={q} isEmpty={(d) => !d.tracks.length} empty={<EmptyState icon="users" title={t('m02.ins.board.empty')} />}>{(d) => <Board d={d} />}</Async>
    </Page>
  );
}

function Board({ d }: { d: InsData }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const isTm = s.can('sat', ['A']);
  const [sweep, setSweep] = useState(false);
  const [sync, setSync] = useState(false);
  const views = [...d.views.values()];
  const sum = poolSummary(views.map((v) => ({ status: v.track.status, stage: v.stage, currency: v.currency })));
  const inPipe = Object.values(sum.pipeline).reduce((a, b) => a + b, 0);
  const year = views.filter((v) => v.currency).reduce((a, v) => a + (v.currency?.hours ?? 0), 0);
  const me = s.identity.personId;
  const queue = views.filter((v) => v.next && v.next !== 'currency' && v.track.person_id !== me);
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m02.ins.board.statQualified')} value={f.num(sum.qualified)} tone="ok" sub={t('m02.ins.board.statQualifiedSub', { current: f.num(sum.current), due: f.num(sum.due) })} />
        <StatTile label={t('m02.ins.board.statAtRisk')} value={f.num(sum.at_risk)} tone={sum.at_risk ? 'bad' : undefined} sub={t('m02.ins.board.statAtRiskSub', { n: f.num(sum.lapsed) })} />
        <StatTile label={t('m02.ins.board.statPipeline')} value={f.num(inPipe)} tone="info" sub={t('m02.ins.board.statPipelineSub', { ready: f.num(sum.pipeline.ready), nominated: f.num(sum.pipeline.nominated) })} />
        <StatTile label={t('m02.ins.board.statHours')} value={f.num(Math.round(year))} sub={t('m02.ins.board.statHoursSub')} sim />
      </Grid>
      {isTm && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setSync(true)} data-testid="m02-ins-sync"><Icon name="reset" size={13} className="me-1 inline" />{t('m02.ins.board.sync')}</button>
          <button type="button" className="btn-primary btn-sm" onClick={() => setSweep(true)} data-testid="m02-ins-sweep"><Icon name="bell" size={13} className="me-1 inline" />{t('m02.ins.board.sweep')}</button>
        </div>
      )}
      <Tabs initial="pool" tabs={[
        { id: 'pool', label: t('m02.ins.board.tabPool'), badge: sum.at_risk + sum.lapsed || undefined, content: <PoolTab d={d} views={views} /> },
        { id: 'pipeline', label: t('m02.ins.board.tabPipeline'), badge: inPipe || undefined, content: <PipelineTab d={d} views={views} /> },
        { id: 'observe', label: t('m02.ins.board.tabObserve'), badge: queue.length || undefined, content: <ObserveTab d={d} queue={queue} /> },
        ...(isTm ? [{ id: 'find', label: t('m02.ins.board.tabFind'), content: <FindTab d={d} /> }] : []),
        { id: 'hours', label: t('m02.ins.board.tabHours'), content: <HoursTab d={d} /> },
      ]} />
      <Section title={t('m02.ins.facts.title')}><ProgrammeFacts /></Section>
      <MirrorNote />
      <ConfirmDialog open={sweep} onClose={() => setSweep(false)} title={t('m02.ins.board.sweepTitle')} consequence={t('m02.ins.board.sweepBody')} actingAs={t('m02.ins.asTm')}
        onConfirm={async () => { await run(() => repo.rpc.instructorCurrencySweep()); }} />
      <ConfirmDialog open={sync} onClose={() => setSync(false)} title={t('m02.ins.board.syncTitle')} consequence={t('m02.ins.board.syncBody')} actingAs={t('m02.ins.asTm')}
        onConfirm={async () => { await run(() => repo.rpc.syncTeachingHours(null)); }} />
    </div>
  );
}

function PoolTab({ d, views }: { d: InsData; views: TrackView[] }) {
  const t = useT();
  const f = useFormat();
  const nm = useNamePick();
  const [flt, setFlt] = useFilters({ status: '' });
  const pool = views.filter((v) => v.currency && (!flt.status || v.currency.status === flt.status))
    .sort((a, b) => (a.currency!.status === 'lapsed' ? -1 : 0) - (b.currency!.status === 'lapsed' ? -1 : 0) || a.currency!.days - b.currency!.days);
  return (
    <div className="space-y-3">
      <FilterBar value={flt} onChange={setFlt} fields={[{ key: 'status', label: t('m02.ins.board.fStatus'), options: ['current', 'due', 'at_risk', 'lapsed'].map((x) => ({ value: x, label: t(`m02.ins.currency.${x}`) })) }]} />
      <div data-testid="m02-ins-pool">
        <DataTable rows={pool} rowKey={(v) => v.track.id} csvName="instructor-pool" caption={t('m02.ins.board.poolCaption')}
          columns={[
            { key: 'name', header: t('m02.ins.col.name'), value: (v) => nm(v.track.person_name, v.track.person_name_ar), render: (v) => <L to={`/training/instructors/${v.track.id}`} className="link font-semibold">{nm(v.track.person_name, v.track.person_name_ar)}</L> },
            { key: 'route', header: t('m02.ins.col.route'), value: (v) => v.track.route, render: (v) => <RouteChip route={v.track.route} /> },
            { key: 'stds', header: t('m02.ins.col.standards'), value: (v) => v.track.standard_ids.join(' '), render: (v) => <StdChips ids={v.track.standard_ids} d={d} /> },
            { key: 'due', header: t('m02.ins.col.due'), value: (v) => v.currency!.due, render: (v) => <span>{f.date(v.currency!.due)} <span className="text-[12px] text-ink-3">({v.currency!.status === 'lapsed' ? t('m02.ins.currency.lapsed') : f.relDays(v.currency!.days)})</span></span> },
            { key: 'hours', header: t('m02.ins.col.hours'), value: (v) => v.currency!.hours, render: (v) => <div className="min-w-[110px]"><div className="text-[12px]" dir="ltr">{f.num(v.currency!.hours)} / {f.num(INS_RULES.minDeliveryHours)} h</div><ProgressBar value={(v.currency!.hours / INS_RULES.minDeliveryHours) * 100} tone={v.currency!.hours >= INS_RULES.minDeliveryHours ? 'ok' : 'accent'} label={t('m02.ins.col.hours')} /></div> },
            { key: 'cpd', header: t('m02.ins.col.cpd'), value: (v) => v.currency!.cpd, render: (v) => <span dir="ltr">{f.num(v.currency!.cpd)} / {f.num(INS_RULES.minCpdHours)} h</span> },
            { key: 'status', header: t('m02.ins.col.status'), value: (v) => v.currency!.status, render: (v) => <span className="inline-flex flex-wrap items-center gap-1" data-testid="m02-ins-pool-status" data-status={v.currency!.status}><CurrencyPill c={v.currency} /><NoticeChip c={v.currency} /></span> },
          ]} />
      </div>
    </div>
  );
}

const PIPE: Stage[] = ['nominated', 'initial_training', 'co_teach', 'solo', 'ready'];
function PipelineTab({ d, views }: { d: InsData; views: TrackView[] }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const nm = useNamePick();
  const repo = useRepo();
  const run = useAction();
  const isTm = s.can('sat', ['A']);
  const me = s.identity.personId;
  const [act, setAct] = useState<{ v: TrackView; kind: 'accept' | 'decline' | 'qualify' } | null>(null);
  const active = views.filter((v) => v.track.status === 'active');
  const closed = views.filter((v) => v.track.status === 'declined' || v.track.status === 'withdrawn');
  const observedByMe = (v: TrackView) => !!v.qualSet && [v.qualSet.co[0], v.qualSet.co[1], v.qualSet.solo].some((o) => o.observer_person_id === me);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5" data-testid="m02-ins-pipeline">
        {PIPE.map((st) => {
          const col = active.filter((v) => v.stage === st);
          return (
            <section key={st} className="min-w-0 rounded-card bg-sunken/60 p-2" data-testid={`m02-ins-col-${st}`} aria-label={t(`m02.ins.stage.${st}`)}>
              <h3 className="caps mb-2 flex items-center justify-between px-1"><span>{t(`m02.ins.stage.${st}`)}</span><span className="chip border-line bg-panel">{f.num(col.length)}</span></h3>
              <ul className="space-y-2">
                {col.map((v) => (
                  <li key={v.track.id} className="card p-2.5" data-testid="m02-ins-card">
                    <L to={`/training/instructors/${v.track.id}`} className="link block truncate font-semibold">{nm(v.track.person_name, v.track.person_name_ar)}</L>
                    <div className="mt-1 flex flex-wrap gap-1"><RouteChip route={v.track.route} /><StdChips ids={v.track.standard_ids} d={d} /></div>
                    <div className="mt-1 text-[12px] text-ink-3">{t('m02.ins.board.since', { date: f.date(v.track.accepted_on ?? v.track.started_on) })} · {t('m02.ins.board.obsCount', { n: f.num(v.obs.filter((o) => o.result === 'pass').length) })}</div>
                    {isTm && v.track.person_id !== me && st === 'nominated' && (
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" className="btn-outline btn-sm" onClick={() => setAct({ v, kind: 'decline' })} data-testid="m02-ins-decline">{t('m02.ins.act.decline')}</button>
                        <button type="button" className="btn-primary btn-sm" onClick={() => setAct({ v, kind: 'accept' })} data-testid="m02-ins-accept">{t('m02.ins.act.accept')}</button>
                      </div>
                    )}
                    {isTm && v.track.person_id !== me && st === 'ready' && (
                      <div className="mt-2">
                        <button type="button" className="btn-primary btn-sm" onClick={() => setAct({ v, kind: 'qualify' })} data-testid="m02-ins-qualify">{t('m02.ins.act.qualify')}</button>
                        {observedByMe(v) && <p className="mt-1 text-[11.5px] text-sim">{t('m02.ins.act.youObserved')}</p>}
                      </div>
                    )}
                  </li>
                ))}
                {!col.length && <li className="px-1 text-[12.5px] text-ink-3">{t('m02.ins.board.colEmpty')}</li>}
              </ul>
            </section>
          );
        })}
      </div>
      {closed.length > 0 && (
        <details className="card p-3"><summary className="cursor-pointer text-[13px] font-semibold">{t('m02.ins.board.closed', { n: f.num(closed.length) })}</summary>
          <ul className="mt-2 space-y-1">{closed.map((v) => <li key={v.track.id} className="flex flex-wrap items-center gap-2 text-[13px]"><span className="font-semibold">{nm(v.track.person_name, v.track.person_name_ar)}</span><StagePill v={v} />{v.track.decision_note && <span className="text-ink-3">“{v.track.decision_note}”</span>}</li>)}</ul>
        </details>
      )}
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} actingAs={t('m02.ins.asTm')} danger={act?.kind === 'decline'} requireReason={act?.kind === 'decline'} reasonLabel={t('m02.ins.act.reason')}
        title={act ? t(`m02.ins.act.${act.kind}Title`, { name: nm(act.v.track.person_name, act.v.track.person_name_ar) }) : ''}
        consequence={act ? t(`m02.ins.act.${act.kind}Body`) : ''}
        onConfirm={async (reason) => {
          if (!act) return;
          if (act.kind === 'qualify') await run(() => repo.rpc.qualifyInstructor(act.v.track.id, reason || null));
          else await run(() => repo.rpc.decideInstructorNomination(act.v.track.id, act.kind as 'accept' | 'decline', reason || null));
        }} />
    </div>
  );
}

function ObserveTab({ d, queue }: { d: InsData; queue: TrackView[] }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const nm = useNamePick();
  const [open, setOpen] = useState<TrackView | null>(null);
  const canObserve = s.can('sat', ['W']);
  if (!queue.length) return <EmptyState icon="check" title={t('m02.ins.board.queueEmpty')} />;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-2">{t('m02.ins.board.queueIntro')}</p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-ins-queue">
        {queue.map((v) => (
          <li key={v.track.id} className="card flex items-start justify-between gap-3 p-3" data-testid="m02-ins-queue-item">
            <div className="min-w-0">
              <L to={`/training/instructors/${v.track.id}`} className="link font-semibold">{nm(v.track.person_name, v.track.person_name_ar)}</L>
              <div className="mt-1 flex flex-wrap gap-1"><StagePill v={v} /><StdChips ids={v.track.standard_ids} d={d} /></div>
              <p className="mt-1 text-[12.5px] text-ink-3">{t(`m02.ins.board.needs.${v.next}`)} · {t('m02.ins.board.observers', { names: [...new Set(v.obs.filter((o) => o.result === 'pass').map((o) => nm(o.observer_name, o.observer_name_ar)))].join(', ') || '—' })}</p>
              <p className="text-[12px] text-ink-3">{t('m02.ins.board.lastObs', { date: v.obs.length ? f.date(v.obs[v.obs.length - 1].observed_on) : '—' })}</p>
            </div>
            {canObserve && <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => setOpen(v)} data-testid="m02-ins-observe">{t('m02.ins.act.observe')}</button>}
          </li>
        ))}
      </ul>
      {open && <ObservationModal v={open} d={d} open={!!open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FindTab({ d }: { d: InsData }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const eng = useEngine('match');
  const stds = d.stds.filter((s) => s.status === 'current' && !s.security_restricted).sort((a, b) => (a.code < b.code ? -1 : 1));
  const [std, setStd] = useState(stds.find((s) => s.id === 'qs-eng')?.id ?? stds[0]?.id ?? '');
  const [nom, setNom] = useState<{ id: string; name: string } | null>(null);
  const q = useQuery(['people', 'person_skills', 'skills', 'sme_profiles', 'mentors'], async () => {
    const [people, states, skills, sme, mentors] = await Promise.all([
      repo.list('people', { filter: { kind: 'staff', status: 'active' } }), repo.list('person_skills', { filter: { active: true } }), repo.list('skills'),
      repo.list('sme_profiles').catch(() => [] as RowOf<'sme_profiles'>[]), repo.list('mentors').catch(() => [] as RowOf<'mentors'>[]),
    ]);
    return { people, states, skills, sme, mentors };
  });
  const onTrack = useMemo(() => new Set(d.tracks.filter((x) => ['active', 'qualified', 'lapsed'].includes(x.status)).map((x) => x.person_id)), [d.tracks]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm"><SelectField name="ins-find-std" label={t('m02.ins.find.standard')} value={std} onChange={setStd} options={stds.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'title')}` }))} /></div>
        <EngineBadge engine={eng} />
      </div>
      <Async state={q}>
        {(x) => {
          const ranked = rankSmeCandidates({ standardIds: [std], skills: x.skills as never, people: x.people, states: x.states, smeProfiles: x.sme, smeMentors: x.mentors, onTrack, today: d.today }).slice(0, 8);
          const name = (id: string) => { const p = x.people.find((pp) => pp.id === id); return p ? pick({ n_en: p.display_name, n_ar: p.display_name_ar || p.display_name }, 'n') : id; };
          if (!ranked.length) return <EmptyState icon="search" title={t('m02.ins.find.none')} />;
          return (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-ins-candidates">
              {ranked.map((c) => (
                <li key={c.id} className="card p-3" data-testid="m02-ins-candidate">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="truncate font-semibold">{name(c.id)}</div><div className="text-[12px] text-ink-3">{t('m02.ins.find.fit', { pct: Math.round(c.item!.fit * 100) })}</div></div>
                    <span className="text-[15px] font-semibold text-accent" dir="ltr">{Math.round(c.score * 100)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <WhyThis reasons={c.reasons} testId="m02-ins-why" />
                    <button type="button" className="btn-outline btn-sm" onClick={() => setNom({ id: c.id, name: name(c.id) })} data-testid="m02-ins-nominate">{t('m02.ins.act.nominate')}</button>
                  </div>
                </li>
              ))}
            </ul>
          );
        }}
      </Async>
      {nom && <NominateModal open={!!nom} onClose={() => setNom(null)} personId={nom.id} personName={nom.name} d={d} defaultStd={std} />}
    </div>
  );
}

function HoursTab({ d }: { d: InsData }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const pick = usePick();
  const nm = useNamePick();
  const [log, setLog] = useState<string>('');
  const isTm = s.can('sat', ['A']);
  const byPerson = new Map([...d.views.values()].map((v) => [v.track.person_id, v.track]));
  const rows = [...d.hours].sort((a, b) => (a.delivered_on < b.delivered_on ? 1 : -1));
  const people = [...new Map([...d.views.values()].filter((v) => ['active', 'qualified', 'lapsed'].includes(v.track.status)).map((v) => [v.track.person_id, v.track])).values()];
  return (
    <div className="space-y-4">
      <Card><HoursChart hours={d.hours.filter((h) => h.kind === 'delivery')} today={d.today} /></Card>
      {isTm && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full max-w-xs"><SelectField name="ins-log-person" label={t('m02.ins.hours.person')} value={log} onChange={setLog} placeholder={t('m02.ins.hours.pickPerson')} options={people.map((p) => ({ value: p.person_id, label: nm(p.person_name, p.person_name_ar) }))} /></div>
        </div>
      )}
      <div data-testid="m02-ins-hours">
        <DataTable rows={rows} rowKey={(h) => h.id} csvName="teaching-hours" pageSize={15}
          columns={[
            { key: 'date', header: t('m02.ins.col.date'), value: (h) => h.delivered_on, render: (h) => f.date(h.delivered_on) },
            { key: 'name', header: t('m02.ins.col.name'), value: (h) => byPerson.get(h.person_id)?.person_name ?? h.person_id, render: (h) => { const tr = byPerson.get(h.person_id); return tr ? nm(tr.person_name, tr.person_name_ar) : h.person_id; } },
            { key: 'kind', header: t('m02.ins.hours.kind'), value: (h) => h.kind, render: (h) => t(`m02.ins.hours.kinds.${h.kind}`) },
            { key: 'hours', header: t('m02.ins.hours.hours'), value: (h) => Number(h.hours), render: (h) => <span dir="ltr">{f.num(Number(h.hours))} h</span>, align: 'end' },
            { key: 'course', header: t('m02.ins.hours.course'), value: (h) => h.course_id ?? '', render: (h) => { const c = h.course_id ? d.courseById.get(h.course_id) : null; return c ? `${c.code} · ${pick(c, 'title')}` : '—'; } },
            { key: 'source', header: t('m02.ins.hours.source'), value: (h) => h.source, render: (h) => t(`m02.ins.hours.sources.${h.source}`) },
          ]} />
      </div>
      {log && <LogHoursModal open={!!log} onClose={() => setLog('')} personId={log} cpdOnly={false} d={d} />}
    </div>
  );
}

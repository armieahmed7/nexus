// /my/role-2030 (M30 · FS11 My Role in 2030: Role Transformation Maps). For my role (or any current role I pick): the technology
// drivers, how the work moves (tasks that grow, are augmented or shrink, from the FS06 task layer), the skills added from today to
// 2030 and 2035 (FS05 published profiles), a bridge curriculum, my time-to-ready from my own skill states with the gaps it is based
// on, the role archetype and what it means for learning, and the dated timeline (OSSA support ending around 2030, ADVANCE planning
// gates). Every derived item has "Why this?". Planning assumption, no deployment decision implied. Security, safeguards and cyber
// roles show the career path only. Readers: transformation R (staff, auditors).
import { Page, Section, Card, Async, EmptyState, Callout, StatTile, ProgressRing, ProgressBar, StatusPill, WhyThis, EngineBadge, SimChip, Icon } from '../../ui';
import { useEngine } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { MOVES, type RoleMap } from './transform';
import { RoleOutlookLine } from '../m18/futureUi'; // FS wave B: FS16 label of the role
import type { RoleTransformationView } from './backend/rpc';
import {
  ArchetypeCard, BenchTies, DriverChip, FS11, HorizonChip, HorizonToggle, MilestoneTimeline, MovePill, NoDeployNote, RolePicker, roleLink, useRefData, useRefLabel, useRoleMap, useRoleParams, type RefData, RefGaps } from './ui';

export default function MyRole2030Page() {
  const t = useT();
  const p = useRoleParams();
  const ref = useRefData();
  const q = useRoleMap(p.role, p.horizon);
  const eng = useEngine('transform');
  return (
    <Page title={t('m30.routes.my-role-2030.title')} intro={t('m30.my.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip label={t('m30.planning.chip')} /><BenchTies feature={FS11} /><EngineBadge engine={eng} /></span>}
      actions={<span className="flex flex-wrap gap-2">
        <L to={`/my/role-2030/tasks${p.role ? `?role=${p.role}` : ''}`} className="btn-outline no-underline" data-testid="m30-to-tasks">{t('m30.my.toTasks')}</L>
        <L to={`/ask?mode=future&q=${encodeURIComponent(t('m30.my.askQ'))}`} className="btn-outline no-underline" data-testid="m30-ask-dalil">{t('m30.my.askDalil')}</L>{/* FS76 (wave-H integration) */}
        <L to="/my/transition-plan" className="btn-ghost no-underline" data-testid="m30-to-transition-plan">{t('m30.tp.links.mine')}</L>{/* FS81 (wave I · E3) */}
      </span>}>
      <RefGaps d={ref.data} onRetry={ref.reload} />
      <Async state={ref}>{(d) => (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-4" data-testid="m30-controls">
            <div className="min-w-0 flex-1 sm:max-w-md"><RolePicker d={d} value={p.role ?? ''} onChange={(v) => p.set('role', v || null)} /></div>
            <HorizonToggle value={p.horizon} onChange={(h) => p.set('h', h === '2030' ? null : h)} />
          </div>
          <Async state={q}>{(v) => <Body v={v} d={d} />}</Async>
        </div>
      )}</Async>
    </Page>
  );
}

function Body({ v, d }: { v: RoleTransformationView | null; d: RefData }) {
  const t = useT();
  if (!v) return <EmptyState title={t('m30.my.noAccess')} />;
  if (!v.map) return <EmptyState title={t('m30.my.noRole')}>{t('m30.my.noRoleBody')}</EmptyState>;
  if (v.map.path_only) return <PathOnly map={v.map} d={d} />;
  return <MapView v={v} map={v.map} d={d} />;
}

function PathOnly({ map, d }: { map: RoleMap; d: RefData }) {
  const t = useT();
  const pick = usePick();
  const row = d.mapByRole.get(map.role_id);
  return (
    <div className="space-y-4" data-testid="m30-path-only">
      <Callout tone="info" title={t('m30.pathOnly.title')}>{t('m30.pathOnly.body')}</Callout>
      {row && <Card><p className="text-[14px]">{pick(row, 'public_summary')}</p></Card>}
      <L to={roleLink(map.role_id)} className="btn-outline no-underline">{t('m30.pathOnly.toCareer')}</L>
    </div>
  );
}

function MapView({ v, map, d }: { v: RoleTransformationView; map: RoleMap; d: RefData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const label = useRefLabel(d);
  const row = d.mapByRole.get(map.role_id);
  const mine = v.my_role_id === map.role_id;
  const me = map.me;
  return (
    <div className="space-y-6">
      <Card className="border-accent/40">
        <div className="flex flex-wrap items-start gap-4" data-testid="m30-hero">
          <div className="min-w-0 flex-1 basis-64 space-y-2">{/* FS wave H QA: at 390 px the text wraps above the readiness ring instead of a one-word column */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="caps">{mine ? t('m30.my.myRole') : t('m30.my.exploring')}</span>
              <StatusPill status={map.status}>{t(`m30.status.${map.status}`)}</StatusPill>
              {map.version > 0 && <span className="chip border-line bg-sunken text-ink-2">{t('m30.my.version', { v: f.num(map.version) })}</span>}
              {v.can_edit && v.draft && <L to={`/workforce/transformation/${map.role_id}`} className="chip border-sim-line bg-sim-bg text-sim no-underline" data-testid="m30-draft-pending">{t('m30.my.draftPending')}</L>}
            </div>
            <h2 className="text-[20px] font-semibold leading-tight">{pick(d.roleById.get(map.role_id), 'title')}</h2>
            {row && <p className="text-[14px] text-ink-2" data-testid="m30-summary">{pick(row, 'summary')}</p>}
            <RoleOutlookLine roleId={map.role_id} />
            <div className="flex flex-wrap gap-1.5" data-testid="m30-drivers">
              {map.drivers.map((x) => <DriverChip key={x.driver} driver={x.driver}><span className="num ms-1">{t('m30.driverCounts', { tasks: f.num(x.tasks), skills: f.num(x.reqs) })}</span></DriverChip>)}
            </div>
            {v.can_edit && <L to={`/workforce/transformation/${map.role_id}`} className="text-[12.5px]" data-testid="m30-edit-link">{t('m30.my.edit')}</L>}
          </div>
          {me && (
            <div className="flex items-center gap-3 rounded-card border border-line p-3" data-testid="m30-ready">
              <ProgressRing value={me.ready_pct} size={72} tone={me.levels === 0 ? 'ok' : 'accent'} />
              <div className="space-y-0.5">
                <div className="caps">{t('m30.ready.label', { h: t(`m30.horizon.${map.horizon}`) })}</div>
                <div className="num text-[22px] font-semibold leading-tight" data-testid="m30-months">{me.levels === 0 ? t('m30.ready.now') : t('m30.ready.months', { n: f.num(me.months) })}</div>
                <div className="text-[12px] text-ink-2">{t('m30.ready.basis', { n: f.num(me.gaps.length), of: f.num(me.requirements) })}</div>
                <WhyThis reasons={me.reasons} testId="m30-ready-why" />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m30-tiles">
        <StatTile label={t('m30.tiles.grow')} value={f.num(map.counts.grow)} tone="ok" sub={t('m30.tiles.growSub')} />
        <StatTile label={t('m30.tiles.augmented')} value={f.num(map.counts.augmented)} tone="info" sub={t('m30.tiles.augmentedSub')} />
        <StatTile label={t('m30.tiles.shrink')} value={f.num(map.counts.shrink)} tone="sim" sub={t('m30.tiles.shrinkSub')} />
        <StatTile label={t('m30.tiles.added')} value={f.num(map.added.filter((a) => a.horizon === '2030').length)} sub={t('m30.tiles.addedSub', { n: f.num(map.added.filter((a) => a.horizon === '2035').length) })} />
      </div>

      <Section title={t('m30.work.title')} description={t('m30.work.desc')}>
        {map.tasks.length === 0 ? <EmptyState title={t('m30.work.none')}>{t('m30.work.noneBody')}</EmptyState> : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m30-work">
            {MOVES.map((mv) => {
              const xs = map.tasks.filter((x) => x.move === mv);
              return (
                <Card key={mv} title={<span className="inline-flex items-center gap-2"><MovePill move={mv} /><span className="num text-ink-3">{f.num(xs.length)}</span></span>} eyebrow={t(`m30.moveHint.${mv}`)}>
                  {xs.length === 0 ? <p className="text-[12.5px] text-ink-3">{t('m30.work.emptyMove')}</p> : (
                    <ul className="divide-y divide-line" data-testid={`m30-move-${mv}`}>
                      {xs.map((x) => (
                        <li key={x.id} className="space-y-1 py-2 text-[13px]">
                          <div className="font-semibold">{pick(x, 'title')}</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="num text-[11.5px] text-ink-3">{x.code}</span>
                            <HorizonChip horizon={x.horizon} />
                            {x.driver && <DriverChip driver={x.driver} />}
                            {x.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m30.work.critical')}</span>}
                            <WhyThis reasons={x.reasons} testId="m30-task-why" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section title={t('m30.added.title')} description={t('m30.added.desc')}>
            {map.added.length === 0 ? <EmptyState title={t('m30.added.none')} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" data-testid="m30-added">
                  <thead><tr className="text-start text-ink-3">
                    <th scope="col" className="py-1 text-start font-normal">{t('m30.added.col.skill')}</th>
                    <th scope="col" className="py-1 text-start font-normal">{t('m30.added.col.horizon')}</th>
                    <th scope="col" className="py-1 text-start font-normal">{t('m30.added.col.change')}</th>
                    <th scope="col" className="py-1 text-start font-normal">{t('m30.added.col.driver')}</th>
                    <th scope="col" className="py-1" />
                  </tr></thead>
                  <tbody>
                    {map.added.map((a) => (
                      <tr key={`${a.horizon}-${a.kind}-${a.ref_id}`} className="border-t border-line align-top">
                        <td className="py-1.5 pe-2 font-semibold">{label(a.kind, a.ref_id)}<span className="ms-1.5 text-[11.5px] font-normal text-ink-3">{t(`m30.importance.${a.importance}`)}</span></td>
                        <td className="py-1.5 pe-2"><HorizonChip horizon={a.horizon} /></td>
                        <td className="py-1.5 pe-2">{a.change === 'new' ? <StatusPill tone="accent">{t('m30.added.new', { to: f.num(a.to) })}</StatusPill> : <StatusPill tone="info">{t('m30.added.raised', { from: f.num(a.from), to: f.num(a.to) })}</StatusPill>}</td>
                        <td className="py-1.5 pe-2">{a.driver ? <DriverChip driver={a.driver} /> : <span className="text-ink-3">—</span>}</td>
                        <td className="py-1.5"><WhyThis reasons={a.reasons} testId="m30-added-why" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
        <ArchetypeCard id={map.archetype} d={d} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m30.bridge.title')} eyebrow={t('m30.bridge.eyebrow', { h: f.num(map.bridge_hours) })}>
          {map.bridge.length === 0 ? <EmptyState title={t('m30.bridge.none')} /> : (
            <ol className="space-y-2" data-testid="m30-bridge">
              {map.bridge.map((s) => {
                const c = s.course_id ? d.courseById.get(s.course_id) : null;
                return (
                  <li key={s.step} className="flex items-start gap-3 rounded-card border border-line p-2.5 text-[13px]">
                    <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{f.num(s.step)}</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-semibold">{s.kind === 'skill' ? <L to={`/skills/${s.ref_id}`} data-testid="m30-skill-link">{label(s.kind, s.ref_id)}</L> : label(s.kind, s.ref_id)} <HorizonChip horizon={s.horizon} /></div>
                      <div className="text-ink-2">
                        {c ? <span><Icon name="book" size={13} className="me-1 inline" /><L to={`/learn/course/${c.id}`}>{pick(c, 'title')}</L></span> : <span>{t('m30.bridge.practice')}</span>}
                        <span className="num ms-2 text-ink-3">{t('m30.bridge.hours', { n: f.num(s.hours) })}</span>
                      </div>
                    </div>
                    <WhyThis reasons={s.reasons} testId="m30-bridge-why" />
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-2 text-[12px] text-ink-3">{t('m30.bridge.note')}</p>
        </Card>

        <Card title={t('m30.gaps.title', { h: t(`m30.horizon.${map.horizon}`) })} eyebrow={t('m30.gaps.eyebrow')}>
          {!me ? <EmptyState title={t('m30.gaps.noMe')} /> : me.gaps.length === 0 ? <Callout tone="ok" title={t('m30.ready.now')}>{t('m30.gaps.readyBody')}</Callout> : (
            <ul className="space-y-2.5" data-testid="m30-gaps">
              {me.gaps.map((g) => (
                <li key={`${g.kind}-${g.ref_id}`} className="space-y-1 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 font-semibold">{g.kind === 'skill' ? <L to={`/skills/${g.ref_id}`}>{label(g.kind, g.ref_id)}</L> : label(g.kind, g.ref_id)}</span>
                    <span className="num text-ink-2">{t('m30.gaps.level', { have: f.num(g.have), need: f.num(g.need) })}</span>
                    <WhyThis reasons={g.reasons} testId="m30-gap-why" />
                  </div>
                  <ProgressBar value={(100 * g.have) / g.need} tone={g.importance === 'core' ? 'accent' : 'sky'} label={label(g.kind, g.ref_id)} />
                </li>
              ))}
            </ul>
          )}
          {me && me.gaps.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <L to="/my/career" className="btn-outline btn-sm no-underline">{t('m30.gaps.toNavigator')}</L>
              <L to="/learn" className="btn-ghost btn-sm no-underline">{t('m30.gaps.toLearn')}</L>
            </div>
          )}
        </Card>
      </div>

      <Section title={t('m30.timeline.title')} description={t('m30.timeline.desc')}>
        <MilestoneTimeline d={d} />
      </Section>
      <NoDeployNote />
    </div>
  );
}

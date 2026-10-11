// FS14 Horizon lanes 2.0 on /my/future: eleven lanes on a now / next / later board and a 2023-2036 swimlane timeline with dated,
// sourced ENEC, UAE and international milestones. Each lane opens a drawer with its FS02 skills (my level), catalogue courses,
// ADVANCE tracks, training pathways, learning resources, open gigs, milestones and at least three sources with as-of dates.
// The interest toggle keeps feeding the aggregate demand signal (F26, suppressed under 10); the fusion lane is awareness only.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Section, Drawer, Tabs, Icon, SimChip, StatusPill, BenchmarkChips } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { AXIS, LANE_HORIZONS, axisPos, laneLevel2, laneMilestones, linksOf, openGigs, type LaneHorizon } from './lanes';
import { GoalButton, InterestToggle, LevelDots, SourceLinks, type FutureMeData, type FutureSource } from './shared';
import { NextGenLink, TwinLaneLink } from '../m31/links'; // FS wave E integration (FS38/FS40 -> FS14)
import { CleanEnergyLink, EnergyTransitionLink } from '../m32/links'; // FS wave E integration (FS41/FS42 -> FS14)

type Lane = FutureMeData['lanes'][number];
const HZ = Object.keys(LANE_HORIZONS) as LaneHorizon[];
const HZ_TONE: Record<LaneHorizon, string> = { now: 'bg-ok-bg', next: 'bg-info-bg', later: 'bg-sim-bg' };
const KIND_TONE: Record<string, string> = { enec: 'bg-accent', uae: 'bg-ok', international: 'bg-info' };

export function LanesSection({ d }: { d: FutureMeData }) {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const open = sp.get('lane');
  const lane = d.lanes.find((l) => l.id === open) ?? null;
  const setLane = (id: string | null) => {
    const n = new URLSearchParams(sp);
    if (id) n.set('lane', id); else n.delete('lane');
    setSp(n, { replace: true });
  };
  return (
    <Section title={t('m21.hz2.title')} description={t('m21.hz2.desc')} id="m21-lanes">
      <div data-testid="m21-bench-fs14"><BenchmarkChips feature="FS14" label={t('m21.v2.bench')} /></div>
      <Tabs tabs={[
        { id: 'board', label: t('m21.hz2.board'), badge: d.lanes.length, content: <Board d={d} onOpen={setLane} /> },
        { id: 'timeline', label: t('m21.hz2.timeline'), content: <Timeline d={d} onOpen={setLane} /> },
      ]} />
      {lane && <LaneDrawer d={d} lane={lane} onClose={() => setLane(null)} />}
    </Section>
  );
}

function Board({ d, onOpen }: { d: FutureMeData; onOpen: (id: string) => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="m21-horizon">
      {HZ.map((h) => (
        <div key={h} className="flex min-w-0 flex-col gap-3">
          <div className={`flex items-baseline justify-between rounded-btn px-3 py-1.5 ${HZ_TONE[h]}`}>
            <span className="text-[14px] font-semibold">{t(`m21.hz.h.${h}`)}</span>
            <span className="num text-[12px] text-ink-2">{f.num(LANE_HORIZONS[h][0], { useGrouping: false })}–{f.num(LANE_HORIZONS[h][1], { useGrouping: false })}</span>
          </div>
          {d.lanes.filter((l) => l.horizon === h).map((l) => {
            const lv = laneLevel2(l, d.links, d.skills, d.states);
            const lk = linksOf(d.links, l.id);
            const gigs = openGigs(d.links, l.id, d.gigs);
            return (
              <article key={l.id} className="card flex flex-col gap-2.5 p-4" data-testid="m21-lane">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug">{pick(l, 'title')}</h3>
                  <span className="caps num shrink-0">{l.code}</span>
                </div>
                {l.kind === 'watch' && <span className="chip w-fit border-sim-line bg-sim-bg text-sim" data-testid="m21-lane-watch"><Icon name="info" size={12} /> {t('m21.hz2.watch')}</span>}
                <p className="text-[13px] text-ink-2">{pick(l, 'summary')}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="caps">{t('m21.hz.myLevel')}</span>
                  {lv.level == null ? <span className="text-[12px] text-ink-3">—</span> : <span className="inline-flex items-center gap-2"><LevelDots level={Math.round(lv.level)} label={t('m21.hz.levelOf', { n: f.num(lv.level) })} /><span className="num text-[12.5px] font-semibold">{t('m21.hz.levelOf', { n: f.num(lv.level, { maximumFractionDigits: 1 }) })}</span></span>}
                </div>
                <div className="flex flex-wrap gap-1 text-[11.5px]">
                  <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m21.hz2.n.skills', { n: f.num(lk.skill.length) })}</span>
                  <span className="chip border-line bg-sunken text-ink-2">{t('m21.hz2.n.learning', { n: f.num(lk.course.length + lk.track.length) })}</span>
                  <span className={`chip ${gigs.length ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-3'}`}>{t('m21.hz2.n.gigs', { n: f.num(gigs.length) })}</span>
                  <span className="chip border-line bg-panel text-ink-2">{t('m21.hz2.n.sources', { n: f.num((l.sources as unknown[]).length) })}</span>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                  <InterestToggle d={d} kind="lane" target={l.id} />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => onOpen(l.id)} data-testid="m21-lane-open">{t('m21.hz2.open')} <Icon name="chevron" size={12} className="rtl:-scale-x-100" /></button>
                </div>
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Swimlane timeline 2023-2036: horizon bands, a bar per lane across its horizon and dots for the milestones it is placed against. */
function Timeline({ d, onOpen }: { d: FutureMeData; onOpen: (id: string) => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const years = useMemo(() => Array.from({ length: AXIS.to - AXIS.from + 1 }, (_, i) => AXIS.from + i), []);
  const band = (h: LaneHorizon) => ({ start: axisPos(LANE_HORIZONS[h][0], 1), end: axisPos(LANE_HORIZONS[h][1] + 1, 1) });
  const lanes = [...d.lanes].sort((a, b) => HZ.indexOf(a.horizon as LaneHorizon) - HZ.indexOf(b.horizon as LaneHorizon) || a.sort - b.sort);
  return (
    <div className="space-y-4" data-testid="m21-timeline">
      <div className="overflow-x-auto rounded-card border border-line bg-panel">
        <div className="min-w-[720px] p-3">
          <div className="relative ms-[200px] h-6 border-b border-line">
            {years.map((y) => <span key={y} className="num absolute -translate-x-1/2 text-[10.5px] text-ink-3 rtl:translate-x-1/2" style={{ insetInlineStart: `${axisPos(y, 1) * 100}%` }}>{f.num(y, { useGrouping: false })}</span>)}
          </div>
          <div className="relative ms-[200px] h-7" aria-label={t('m21.hz2.milestones')}>
            {d.milestones.map((m) => (
              <span key={m.id} title={`${f.num(m.year, { useGrouping: false })} · ${pick(m, 'title')}`} className={`absolute top-2 h-3 w-3 -translate-x-1/2 rotate-45 rtl:translate-x-1/2 ${KIND_TONE[m.kind] ?? 'bg-ink-3'}`} style={{ insetInlineStart: `${axisPos(m.year, m.month) * 100}%` }} />
            ))}
          </div>
          <ul className="space-y-1.5">
            {lanes.map((l) => {
              const b = band(l.horizon as LaneHorizon);
              const ms = laneMilestones(l, d.milestones);
              return (
                <li key={l.id} className="flex items-center" data-testid="m21-swimlane">
                  <button type="button" onClick={() => onOpen(l.id)} className="w-[200px] shrink-0 truncate pe-2 text-start text-[12.5px] font-semibold hover:text-accent">{l.code} · {pick(l, 'title')}</button>
                  <div className="relative h-7 flex-1 rounded bg-sunken/40">
                    {HZ.map((h) => <div key={h} className={`absolute inset-y-0 ${HZ_TONE[h]} opacity-40`} style={{ insetInlineStart: `${band(h).start * 100}%`, width: `${(band(h).end - band(h).start) * 100}%` }} />)}
                    <div className={`absolute inset-y-1.5 rounded-full ${l.kind === 'watch' ? 'border border-dashed border-sim bg-sim-bg' : 'bg-accent/80'}`} style={{ insetInlineStart: `${b.start * 100}%`, width: `${(b.end - b.start) * 100}%` }} />
                    {ms.map((m) => <span key={m.id} title={`${f.num(m.year, { useGrouping: false })} · ${pick(m, 'title')}`} className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel rtl:translate-x-1/2 ${KIND_TONE[m.kind] ?? 'bg-ink-3'}`} style={{ insetInlineStart: `${axisPos(m.year, m.month) * 100}%` }} />)}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-ink-2">
            {(['enec', 'uae', 'international'] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-full ${KIND_TONE[k]}`} />{t(`m21.hz2.ms.${k}`)}</span>)}
            {HZ.map((h) => <span key={h} className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-4 rounded-sm ${HZ_TONE[h]}`} />{t(`m21.hz.h.${h}`)}</span>)}
          </div>
        </div>
      </div>
      <ol className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m21-milestones">
        {d.milestones.map((m) => (
          <li key={m.id} className="flex gap-3 rounded-btn border border-line bg-panel p-3">
            <span className="num w-20 shrink-0 text-[12.5px] font-semibold text-ink-2">{m.month ? new Intl.DateTimeFormat(f.locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(m.year, m.month - 1, 1))) : f.num(m.year, { useGrouping: false })}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5"><span className={`inline-block h-2 w-2 rounded-full ${KIND_TONE[m.kind]}`} /><span className="text-[13px] font-semibold">{pick(m, 'title')}</span></div>
              <p className="text-[12.5px] text-ink-2">{pick(m, 'summary')}</p>
              <SourceLinks sources={(m.sources as FutureSource[]) ?? []} compact />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LaneDrawer({ d, lane, onClose }: { d: FutureMeData; lane: Lane; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lv = laneLevel2(lane, d.links, d.skills, d.states);
  const lk = linksOf(d.links, lane.id);
  const gigs = openGigs(d.links, lane.id, d.gigs);
  const ms = laneMilestones(lane, d.milestones);
  const res = d.resources.filter((r) => r.lane_ids.includes(lane.id));
  const skill = (id: string) => d.skills.find((s) => s.id === id);
  const role = (id: string) => d.jobRoles.find((r) => r.id === id);
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="caps mb-1.5 mt-4">{children}</h3>;
  const Empty = () => <p className="text-[12.5px] text-ink-3">{t('m21.hz2.none')}</p>;
  return (
    <Drawer open onClose={onClose} title={pick(lane, 'title')} footer={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InterestToggle d={d} kind="lane" target={lane.id} />
        {lane.kind === 'watch' ? <span className="text-[12px] text-sim">{t('m21.hz2.watchNoGoal')}</span> : <GoalButton d={d} kind="lane" refId={lane.id} />}
      </div>
    }>
      <div data-testid="m21-lane-drawer">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip border-line bg-sunken text-ink-2">{lane.code}</span>
          <StatusPill tone={lane.horizon === 'now' ? 'ok' : lane.horizon === 'next' ? 'info' : 'sim'}>{t(`m21.hz.h.${lane.horizon}`)} · {f.num(LANE_HORIZONS[lane.horizon as LaneHorizon][0], { useGrouping: false })}–{f.num(LANE_HORIZONS[lane.horizon as LaneHorizon][1], { useGrouping: false })}</StatusPill>
          {lane.kind === 'watch' && <span className="chip border-sim-line bg-sim-bg text-sim">{t('m21.hz2.watch')}</span>}
          {lane.as_of && <span className="text-[11.5px] text-ink-3">{t('common.asOf', { date: f.date(lane.as_of) })}</span>}
        </div>
        <p className="mt-3 text-[13.5px]">{pick(lane, 'summary')}</p>
        <div className="mt-3 rounded-btn bg-sunken/60 p-3"><div className="caps mb-0.5">{t('m21.hz.why')}</div><p className="text-[13px]">{pick(lane, 'why')}</p></div>

        <H>{t('m21.hz2.skills')}</H>
        <ul className="flex flex-wrap gap-1" data-testid="m21-lane-skills">
          {lv.items.map((i) => (
            <li key={i.skill_id} className={`chip max-w-full whitespace-normal ${i.security ? (i.qualified ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-2') : i.level > 0 ? 'border-accent/30 bg-accent-soft text-eyebrow' : i.future ? 'border-info-line bg-info-bg text-info' : 'border-line bg-panel text-ink-3'}`}>
              {i.future && <Icon name="sparkle" size={11} />} {i.security ? pick(skill(i.skill_id), 'name') : <L to={`/skills/${i.skill_id}`} className="text-inherit" data-testid="m21-lane-skill-link">{pick(skill(i.skill_id), 'name')}</L>}
              <span className="num font-normal">· {i.security ? t(i.qualified ? 'm21.hz.qualified' : 'm21.hz.notQualified') : f.num(i.level)}{i.future ? ` / ${f.num(lk.skill.find((x) => x.ref_id === i.skill_id)?.level ?? 2)}` : ''}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11.5px] text-ink-3">{t('m21.hz2.skillsNote', { n: lv.level == null ? '—' : f.num(lv.level, { maximumFractionDigits: 1 }) })}</p>

        <H>{t('m21.hz2.courses')}</H>
        {lk.course.length === 0 ? <Empty /> : <ul className="space-y-1 text-[13px]">{lk.course.map((c) => <li key={c.id}><Icon name="book" size={12} /> <L to={`/learn/course/${c.ref_id}`}>{pick(d.courses.find((x) => x.id === c.ref_id), 'title') || c.ref_id}</L></li>)}</ul>}
        <H>{t('m21.hz2.tracks')}</H>
        {lk.track.length === 0 ? <Empty /> : <ul className="space-y-1 text-[13px]">{lk.track.map((c) => <li key={c.id}><Icon name="grad" size={12} /> <a href={`#m21-track-${c.ref_id}`} onClick={onClose}>{pick(d.tracks.find((x) => x.id === c.ref_id), 'title') || c.ref_id}</a></li>)}</ul>}
        <H>{t('m21.hz2.pathways')}</H>
        {lk.pathway.length === 0 ? <Empty /> : <ul className="flex flex-wrap gap-1.5 text-[12.5px]">{lk.pathway.map((c) => <li key={c.id}><L to={`/learn/paths/${c.ref_id}`} className="chip border-line bg-panel text-ink">{t(`m21.hz2.path.${c.ref_id}`)}</L></li>)}</ul>}
        <H>{t('m21.hz2.resources')}</H>
        {res.length === 0 ? <Empty /> : <ul className="space-y-1.5 text-[13px]">{res.map((r) => <li key={r.id}><span className="chip me-1 border-line bg-sunken text-ink-2">{t(`m21.res.kind.${r.kind}`)}</span>{r.course_id ? <L to={`/learn/course/${r.course_id}`}>{pick(r, 'title')}</L> : pick(r, 'title')}</li>)}</ul>}
        <WaveELaneLinks laneId={lane.id} />
        <H>{t('m21.hz2.gigs')}</H>
        {gigs.length === 0 ? <Empty /> : <ul className="space-y-1 text-[13px]" data-testid="m21-lane-gigs">{gigs.map((g) => <li key={g.id}><Icon name="briefcase" size={12} /> <L to={`/opportunities/${g.id}`}>{pick(g, 'title')}</L></li>)}</ul>}
        <H>{t('m21.hz2.milestones')}</H>
        {ms.length === 0 ? <Empty /> : <ul className="space-y-1.5 text-[13px]">{ms.map((m) => <li key={m.id}><span className="num me-1.5 font-semibold">{f.num(m.year, { useGrouping: false })}</span>{pick(m, 'title')} <span className="text-[11.5px] text-ink-3">· {t(`m21.hz.h.${m.horizon}`)}</span></li>)}</ul>}
        {(lane.role_ids.length > 0 || lane.path_only_role_ids.length > 0) && <H>{t('m21.hz2.roles')}</H>}
        {lane.role_ids.length > 0 && <p className="text-[12.5px]">{lane.role_ids.map((id, n) => <span key={id}>{n > 0 && ', '}<L to={`/careers/roles/${id}`}>{pick(role(id), 'title') || id}</L></span>)}</p>}
        {lane.path_only_role_ids.length > 0 && <p className="text-[12px] text-ink-2"><Icon name="lock" size={12} /> {t('m21.hz.pathOnly')} {lane.path_only_role_ids.map((id, n) => <span key={id}>{n > 0 && ', '}<L to={`/careers/roles/${id}`}>{pick(role(id), 'title') || id}</L></span>)}</p>}
        <H>{t('m21.hz2.sources', { n: f.num((lane.sources as unknown[]).length) })}</H>
        <SourceLinks sources={(lane.sources as FutureSource[]) ?? []} />
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-sim"><SimChip /> {t('m11.common.noDecision')}</p>
      </div>
    </Drawer>
  );
}

/** FS wave E integration: lanes that a wave-E feature serves link to it (HZ-4/HZ-8 SMR delta, HZ-1/HZ-7 twin drills, HZ-5 CleanEnergyComp, HZ-9/HZ-10 energy-system pathway). */
export const WAVE_E_LANE_LINKS: Record<string, ('next_gen' | 'twin' | 'cec' | 'transition')[]> = {
  'lane-advanced': ['next_gen'], 'lane-manufacturing': ['next_gen'], 'lane-digital': ['twin'], 'lane-ai-maint': ['twin'],
  'lane-netzero': ['cec'], 'lane-hydrogen': ['transition'], 'lane-grid': ['transition'],
};
function WaveELaneLinks({ laneId }: { laneId: string }) {
  const links = WAVE_E_LANE_LINKS[laneId] ?? [];
  if (!links.length) return null;
  return (
    <div className="mt-4 space-y-1.5" data-testid="m21-lane-wave-e">
      {links.map((k) => (k === 'next_gen' ? <NextGenLink key={k} compact /> : k === 'twin' ? <TwinLaneLink key={k} /> : k === 'cec' ? <CleanEnergyLink key={k} /> : <EnergyTransitionLink key={k} />))}
    </div>
  );
}

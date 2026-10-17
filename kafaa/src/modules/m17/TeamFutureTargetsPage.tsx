// FS84 /team/skills/future (skills_profile Scope/A people mode; HR Agg counts only): team capability targets for 2028 and 2030 derived
// from the FS05 role profiles of the group's members, with the gap from today's team to that future profile. Each target names the
// role-profile versions it came from (role, horizon, version number) and explains itself (<WhyThis>); a manager in scope (or the training
// manager) adopts the derived targets as the group's stored 2028/2030 targets in one confirmed, audited step, and the page flags
// adopted targets that no longer match a republished profile. Member readiness is shown in id order, never ranked. Planning
// assumptions only: no deployment decision implied. All data comes from rpc.teamFutureTargets (scope applied on both backends).
import { useMemo, useState } from 'react';
import { Page, Section, Async, BenchmarkChips, Callout, ConfirmDialog, EmptyState, Icon, ProgressBar, SelectField, StatTile, StatusPill, TextArea, WhyThis, ScrollRegion } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { FT_HORIZONS, NOTE_MAX, adoptPlan, targetReasons, type FtHorizon, type FtTarget } from './teamTargets';
import { useCatalogue, useGroupLabel, useName, useSkillName, type Catalogue } from './ciUi';
import type { TeamFutureTargets } from './backend/rpc';

const STATUS_TONE = { covered: 'ok', thin: 'sim', uncovered: 'bad', suppressed: 'neutral' } as const;

export default function TeamFutureTargetsPage() {
  const t = useT();
  const repo = useRepo();
  const cat = useCatalogue();
  const [group, setGroup] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<FtHorizon>('2030');
  const q = useQuery(['team_skill_targets', 'person_skills', 'role_profile_versions'], () => repo.rpc.teamFutureTargets(group, horizon), [group, horizon]);
  return (
    <Page wide title={t('m17.routes.team-skills-future.title')} intro={t('m17.tt.intro')} eyebrow={<BenchmarkChips feature="FS84" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/team/skills" className="btn-outline btn-sm no-underline" data-testid="m17-tt-to-heatmap">{t('m17.tt.toHeatmap')}</L>
        <L to="/careers/horizons" className="btn-ghost btn-sm no-underline">{t('m17.tt.toHorizons')}</L>
      </div>}>
      <Async state={{ data: q.data && cat.data ? { d: q.data, cat: cat.data } : undefined, loading: q.loading || cat.loading, error: q.error ?? cat.error, reload: q.reload }}>
        {({ d, cat: c }) => <Targets d={d} cat={c} horizon={horizon} onHorizon={setHorizon} onGroup={setGroup} reload={q.reload} />}
      </Async>
    </Page>
  );
}

function Targets({ d, cat, horizon, onHorizon, onGroup, reload }: { d: TeamFutureTargets; cat: Catalogue; horizon: FtHorizon; onHorizon: (h: FtHorizon) => void; onGroup: (g: string) => void; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const groupLabel = useGroupLabel();
  const people = d.mode === 'people';
  const canAdopt = people && s.can('skills_profile', ['Scope', 'A']) && !!d.group && d.groups.some((g) => g.key === d.group);
  const changed = d.targets.filter((x) => x.changed).length;
  const fresh = d.targets.filter((x) => !x.adopted).length;
  const plan = adoptPlan(d);
  const sm = d.summary;
  return (
    <div className="space-y-6" data-testid="m17-tt" data-horizon={d.horizon} data-mode={d.mode}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[260px] max-w-full flex-1 sm:flex-none">
          <SelectField label={t('m17.tm.group.label')} name="tt-group" value={d.group ?? ''} onChange={onGroup}
            options={d.groups.map((g) => ({ value: g.key, label: `${groupLabel(g.key)} · ${t('m17.tm.people', { n: f.num(g.size) })}` }))} />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-card border border-line bg-sunken p-1" role="group" aria-label={t('m17.tt.horizon')} data-testid="m17-tt-horizon">
          {FT_HORIZONS.map((h) => (
            <button key={h} type="button" aria-pressed={horizon === h} onClick={() => onHorizon(h)} data-testid={`m17-tt-h-${h}`}
              className={`rounded px-3 py-1.5 text-[13px] font-semibold ${horizon === h ? 'bg-panel text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
              {t(`m17.tt.h.${h}`)}
            </button>
          ))}
        </div>
      </div>
      <Callout tone="info" title={t('m17.tt.assumptionTitle')}>
        <span data-testid="m17-tt-assumption">{t(`m17.tt.assumption_${horizon}`)}</span>
      </Callout>
      {!people && <Callout tone="info" title={t('m17.tm.aggTitle')}>{t('m17.tt.agg')}</Callout>}
      {d.suppressed && <Callout tone="sim" title={t('m17.tm.suppressedTitle')}><span data-testid="m17-tt-suppressed">{t('m17.tm.suppressed', { n: f.num(d.size) })}</span></Callout>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m17-tt-tiles">
        <StatTile label={t('m17.tt.tile.readiness')} value={sm.readiness == null ? <Sup /> : f.pct(sm.readiness, 0)} sub={t('m17.tt.tile.readinessSub', { h: t(`m17.tt.h.${horizon}`) })} tone="info" />
        <StatTile label={t('m17.tt.tile.targets')} value={f.num(sm.targets)} sub={t('m17.tt.tile.targetsSub', { n: f.num(sm.new_skills) })} />
        <StatTile label={t('m17.tt.tile.covered')} value={sm.covered == null ? <Sup /> : f.num(sm.covered)} sub={sm.thin == null ? undefined : t('m17.tt.tile.coveredSub', { thin: f.num(sm.thin), unc: f.num(sm.uncovered ?? 0) })} tone="ok" />
        <StatTile label={t('m17.tt.tile.gap')} value={sm.gap == null ? <Sup /> : f.num(sm.gap)} sub={t('m17.tt.tile.gapSub')} tone={sm.gap ? 'sim' : undefined} />
        <StatTile label={t('m17.tt.tile.profiled')} value={d.profiled == null ? <Sup /> : `${f.num(d.profiled)}/${f.num(d.size)}`}
          sub={d.no_profile == null ? undefined : t('m17.tt.tile.profiledSub', { none: f.num(d.no_profile), path: f.num(d.path_only ?? 0) })} />
      </div>

      <Adoption d={d} canAdopt={canAdopt} changed={changed} fresh={fresh} writes={plan.write.length} retires={plan.retire.length} groupLabel={groupLabel(d.group)} reload={reload} />

      {!d.group || !d.targets.length ? <EmptyState title={t('m17.tt.noneTitle')}>{t('m17.tt.none')}</EmptyState> : (
        <Section title={t('m17.tt.tableTitle', { h: t(`m17.tt.h.${horizon}`) })} description={t('m17.tt.tableIntro')}>
          <TargetTable d={d} cat={cat} horizon={horizon} />
        </Section>
      )}
      {!!d.retired.length && (
        <Section title={t('m17.tt.retiredTitle')} description={t('m17.tt.retiredIntro')}>
          <ul className="flex flex-wrap gap-2" data-testid="m17-tt-retired">
            {d.retired.map((r) => <li key={r.skill_id} className="chip border-line bg-sunken text-ink-2">{cat.skill.get(r.skill_id)?.code ?? r.skill_id} · {t('m17.tm.targetShort', { n: f.num(r.min_people), level: f.num(r.min_level) })}</li>)}
          </ul>
        </Section>
      )}
      {people && !!d.members.length && <Members d={d} cat={cat} />}
      <p className="text-[12px] text-ink-3" data-testid="m17-tt-method">{t('m17.tt.method')}</p>
    </div>
  );
}

function Sup() {
  const t = useT();
  return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
}

function Adoption({ d, canAdopt, changed, fresh, writes, retires, groupLabel, reload }: { d: TeamFutureTargets; canAdopt: boolean; changed: number; fresh: number; writes: number; retires: number; groupLabel: string; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const name = useName();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const by = d.adopted_by ? d.people.find((p) => p.id === d.adopted_by) : null;
  const upToDate = !!d.adopted_at && !writes && !retires;
  return (
    <div className="rounded-card border border-line bg-raised p-4" data-testid="m17-tt-adoption" data-up-to-date={upToDate ? 'true' : 'false'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="caps text-[10.5px] text-ink-3">{t('m17.tt.adoptedTitle')}</p>
          {d.adopted_at ? (
            <p className="mt-1 text-[14px] text-ink">{t('m17.tt.adoptedOn', { date: f.date(d.adopted_at.slice(0, 10)), who: by ? name(by) : (d.adopted_by ?? '—') })}</p>
          ) : <p className="mt-1 text-[14px] text-ink-2">{t('m17.tt.notAdopted')}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-[12.5px]">
            {upToDate && <StatusPill tone="ok"><Icon name="check" size={12} /> {t('m17.tt.upToDate')}</StatusPill>}
            {changed > 0 && <span className="chip border-sim/40 bg-sim-bg text-sim" data-testid="m17-tt-changed"><Icon name="alert" size={12} /> {t('m17.tt.changedN', { n: f.num(changed) })}</span>}
            {d.adopted_at && fresh > 0 && <span className="chip border-info/40 bg-info-bg text-info">{t('m17.tt.freshN', { n: f.num(fresh) })}</span>}
            {retires > 0 && <span className="chip border-line bg-sunken text-ink-2">{t('m17.tt.retiresN', { n: f.num(retires) })}</span>}
          </div>
        </div>
        {canAdopt ? (
          <button type="button" className="btn-primary btn-sm" disabled={!writes && !retires} onClick={() => setOpen(true)} data-testid="m17-tt-adopt">
            {d.adopted_at ? t('m17.tt.readopt') : t('m17.tt.adopt')}
          </button>
        ) : <p className="max-w-xs text-[12.5px] text-ink-3" data-testid="m17-tt-who-adopts"><Icon name="lock" size={12} /> {t('m17.tt.whoAdopts')}</p>}
      </div>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t('m17.tt.confirmTitle', { group: groupLabel, h: t(`m17.tt.h.${d.horizon}`) })} confirmLabel={t('m17.tt.adopt')}
        consequence={t('m17.tt.confirmBody', { n: f.num(writes), r: f.num(retires) })}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.adoptFutureTargets({ team_id: d.group!, horizon: d.horizon, note: note.trim() || null }));
          if (r.ok) { setOpen(false); setNote(''); reload?.(); }
        }}>
        <TextArea name="tt-note" label={t('m17.tt.note')} rows={2} value={note} onChange={(v) => setNote(v.slice(0, NOTE_MAX))} />
      </ConfirmDialog>
    </div>
  );
}

function TargetTable({ d, cat, horizon }: { d: TeamFutureTargets; cat: Catalogue; horizon: FtHorizon }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const sk = useSkillName(cat);
  const name = useName();
  const roleName = (id: string) => { const r = cat.role.get(id); return { en: r?.title_en ?? id, ar: r?.title_ar ?? r?.title_en ?? id }; };
  const member = useMemo(() => new Map(d.people.map((p) => [p.id, p])), [d.people]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-[13px]" data-testid="m17-tt-targets">
        <caption className="sr-only">{t('m17.tt.tableTitle', { h: t(`m17.tt.h.${horizon}`) })}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.skill')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.tt.col.target')}</th>
            <th scope="col" className="caps py-1.5 text-end">{t('m17.tt.col.now')}</th>
            <th scope="col" className="caps py-1.5 ps-3 text-start">{t('m17.tt.col.gap')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.tt.col.from')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.tt.col.adopted')}</th>
            <th scope="col" className="caps py-1.5 text-end"><span className="sr-only">{t('m17.tt.col.why')}</span></th>
          </tr>
        </thead>
        <tbody>
          {d.targets.map((x) => (
            <tr key={x.skill_id} className="border-b border-line/60 align-top" data-testid="m17-tt-row" data-skill={x.skill_id} data-changed={x.changed ? 'true' : 'false'}>
              <th scope="row" className="py-2 pe-2 text-start font-normal">
                <L to={`/skills/${x.skill_id}`} className="font-medium text-ink">{sk(x.skill_id)}</L>
                <span className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="text-ink-3">{t(`m17.area.${cat.skill.get(x.skill_id)?.area ?? 'digital'}`)}</span>
                  {x.change !== 'kept' && <span className={`chip ${x.change === 'new' ? 'border-accent/40 bg-accent/10 text-eyebrow' : 'border-info/40 bg-info-bg text-info'}`}>{t(`m17.tt.change.${x.change}`)}</span>}
                </span>
              </th>
              <td className="py-2 pe-2">{x.min_people == null ? t('m17.tt.levelOnly', { level: f.num(x.min_level) }) : t('m17.tm.targetText', { n: f.num(x.min_people), level: f.num(x.min_level) })}</td>
              <td className="num py-2 text-end" title={x.holders?.map((h) => name(member.get(h), h)).join(', ')}>{x.n == null ? t('common.suppressedShort') : f.num(x.n)}</td>
              <td className="py-2 ps-3 pe-2">
                <span className="flex min-w-[130px] flex-col gap-1">
                  <StatusPill tone={STATUS_TONE[x.status]}>{x.status === 'suppressed' ? t('m17.tm.status.suppressed') : x.gap ? t('m17.tt.gapN', { n: f.num(x.gap) }) : t('m17.tm.status.covered')}</StatusPill>
                  {x.min_people != null && x.n != null && <ProgressBar value={Math.min(100, (100 * x.n) / Math.max(1, x.min_people))} tone={x.status === 'covered' ? 'ok' : x.status === 'thin' ? 'sim' : 'bad'} label={t('m17.tt.barLabel', { n: f.num(x.n), of: f.num(x.min_people) })} />}
                </span>
              </td>
              <td className="py-2 pe-2">
                <ul className="flex flex-wrap gap-1" data-testid="m17-tt-from">
                  {x.roles.map((r) => (
                    <li key={r.role_id}>
                      <L to={`/careers/roles/${r.role_id}`} className="chip border-line bg-sunken text-[11px] text-ink-2 no-underline" title={r.version_id} data-version={r.version_id}>
                        {pick(cat.role.get(r.role_id), 'title') || r.role_id} · {t('m17.tt.versionChip', { v: f.num(r.version) })}
                      </L>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="py-2 pe-2 text-[12px]"><AdoptedCell x={x} /></td>
              <td className="py-2 text-end"><WhyThis reasons={targetReasons(x, horizon, roleName)} testId={`m17-tt-why-${x.skill_id}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdoptedCell({ x }: { x: FtTarget }) {
  const t = useT();
  const f = useFormat();
  if (!x.adopted) return <span className="text-ink-3">{t('m17.tt.notStored')}</span>;
  if (!x.changed) return <span className="inline-flex items-center gap-1 text-ok"><Icon name="check" size={12} /> {t('m17.tt.stored')}</span>;
  return (
    <span className="text-sim" data-testid="m17-tt-was">
      <Icon name="alert" size={12} /> {t('m17.tt.was', { n: f.num(x.adopted.min_people), level: f.num(x.adopted.min_level) })}
      {x.versions.some((v) => !x.adopted!.versions.includes(v)) && <span className="block text-[11px] text-ink-3">{t('m17.tt.newVersion')}</span>}
    </span>
  );
}

function Members({ d, cat }: { d: TeamFutureTargets; cat: Catalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const name = useName();
  const sk = useSkillName(cat);
  const person = new Map(d.people.map((p) => [p.id, p]));
  return (
    <Section title={t('m17.tt.membersTitle')} description={t('m17.tt.membersIntro')}>
      <ScrollRegion label={t('m17.tt.membersTitle')} className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]" data-testid="m17-tt-members">
          <caption className="sr-only">{t('m17.tt.membersTitle')}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="caps py-1.5 text-start">{t('m17.tm.person')}</th>
              <th scope="col" className="caps py-1.5 text-start">{t('m17.tt.col.readiness')}</th>
              <th scope="col" className="caps py-1.5 text-start">{t('m17.tt.col.toGrow')}</th>
            </tr>
          </thead>
          <tbody>
            {d.members.map((m) => (
              <tr key={m.id} className="border-b border-line/60 align-top">
                <th scope="row" className="py-2 pe-3 text-start font-normal">
                  <span className="block font-medium text-ink">{name(person.get(m.id), m.id)}</span>
                  <span className="block text-[11px] text-ink-3">{m.role_id ? pick(cat.role.get(m.role_id), 'title') || m.role_id : t('m17.tt.noRole')}</span>
                </th>
                <td className="py-2 pe-3">
                  {m.status !== 'ok' ? <span className="text-[12px] text-ink-3">{t(`m17.tt.status.${m.status}`)}</span> : (
                    <span className="flex min-w-[160px] items-center gap-2">
                      <span className="w-28"><ProgressBar value={m.pct ?? 0} tone={(m.pct ?? 0) >= 90 ? 'ok' : (m.pct ?? 0) >= 70 ? 'accent' : 'sim'} label={t('m17.tt.readinessOf', { name: name(person.get(m.id), m.id) })} /></span>
                      <span className="num text-[12px] text-ink-2">{f.pct(m.pct, 0)}</span>
                    </span>
                  )}
                </td>
                <td className="py-2 text-[12px] text-ink-2">
                  {m.top.length ? (
                    <span className="flex flex-wrap gap-1">{m.top.map((s) => <span key={s} className="chip border-line bg-sunken text-ink-2">{sk(s)}</span>)}{m.gaps > m.top.length && <span className="text-ink-3">{t('m17.tt.moreN', { n: f.num(m.gaps - m.top.length) })}</span>}</span>
                  ) : m.status === 'ok' ? <span className="text-ok">{t('m17.tt.allMet')}</span> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <p className="text-[12px] text-ink-3">{t('m17.tt.membersNote')}</p>
    </Section>
  );
}

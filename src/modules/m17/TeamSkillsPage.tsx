// F11 /team/skills: Team capability heatmap and crew composition. People x skills heatmap (level and evidence basis) for a
// team or job family in my scope, coverage per skill against a manager-set minimum with single-point-of-failure flags, the
// crew view for shift supervisors (counts and availability counts only; no medical or licence detail), a SIMULATED
// "what if X leaves or rotates?" toggle that persists nothing, suggested actions (course → F07, opportunity → F08,
// mentoring → F13) with reasons, and a CSV export watermarked with role and date. HR (Agg) sees coverage counts only,
// suppressed below 10. All data comes from rpc.teamCoverage, which applies the scope on both backends.
import { useMemo, useState } from 'react';
import { Page, Async, Card, Callout, ConfirmDialog, EmptyState, Tabs, SelectField, TextArea, SimChip, WhyThis, Icon, CheckboxField, downloadText } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, useFormat, usePick, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { securityComps } from './badgeRules';
import { Stat } from './ui';
import { coverage, coverageSummary, heatmapCsv, stateKey, teamActions, CREW_PROFILE, TARGET, type CoverageRow, type StateMap } from './checkins';
import { CoveragePill, SpofFlag, useCatalogue, useGroupLabel, useName, useSkillName, type Catalogue } from './ciUi';
import type { TeamCoverage } from './backend/rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function TeamSkillsPage() {
  const t = useT();
  const repo = useRepo();
  const cat = useCatalogue();
  const [group, setGroup] = useState<string | null>(null);
  const q = useQuery(['team_skill_targets', 'person_skills', 'skill_evidence'], () => repo.rpc.teamCoverage(group), [group]);
  const courses = useQuery('courses', () => repo.list('courses') as Promise<Row[]>, []);
  return (
    <Page wide title={t('m17.routes.team-skills.title')} intro={t('m17.tm.intro')} actions={<L to="/team/skills/validate" className="btn-outline btn-sm no-underline">{t('m17.tm.toValidate')}</L>}>
      <Async state={{ data: q.data && cat.data ? { cov: q.data, cat: cat.data, courses: courses.data ?? [] } : undefined, loading: q.loading || cat.loading, error: q.error ?? cat.error, reload: q.reload }}>
        {(d) => <Team cov={d.cov} cat={d.cat} courses={d.courses} onGroup={setGroup} />}
      </Async>
    </Page>
  );
}

function Team({ cov, cat, courses, onGroup }: { cov: TeamCoverage; cat: Catalogue; courses: Row[]; onGroup: (g: string) => void }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const name = useName();
  const sk = useSkillName(cat);
  const [whatIf, setWhatIf] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const people = cov.mode === 'people';
  const canSet = people && s.can('skills_profile', ['Scope', 'A']);
  const states: StateMap = useMemo(() => new Map(cov.cells.map((c) => [stateKey(c.p, c.s), { person_id: c.p, skill_id: c.s, level: c.l, basis: c.b }])), [cov.cells]);
  const skillRows = useMemo(() => cov.skills.map((id) => cat.skill.get(id)).filter(Boolean), [cov.skills, cat]);
  const rows: CoverageRow[] = useMemo(
    () => (people && whatIf && gone.size ? coverage(skillRows, cov.members.map((m) => m.id), states, cov.targets, { holders: true, exclude: gone }) : cov.coverage),
    [people, whatIf, gone, skillRows, cov, states],
  );
  const sum = coverageSummary(rows);
  const base = coverageSummary(cov.coverage);
  const groupLabel = useGroupLabel();
  const toggleGone = (id: string) => setGone((g) => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportCsv = () => {
    const roles = s.roles.filter((r) => r !== 'public').join(', ');
    const wm = t('m17.tm.watermark', { role: roles, date: f.date(todayIso()), group: groupLabel(cov.group) });
    downloadText(`kafaa-team-skills-${(cov.group ?? 'team').replace(':', '-')}-${todayIso()}.csv`, heatmapCsv({
      watermark: wm, skills: cov.skills.map((id) => ({ id, label: sk(id) })), members: cov.members.map((m) => ({ id: m.id, label: name(m) })), states, basisLabel: (b) => t(`common.skills.basis.${b}`),
    }));
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px]">
            <SelectField label={t('m17.tm.group.label')} name="group" value={cov.group ?? ''} onChange={(g) => { setGone(new Set()); onGroup(g); }}
              options={cov.groups.map((g) => ({ value: g.key, label: `${groupLabel(g.key)} · ${t('m17.tm.people', { n: f.num(g.size) })}` }))} />
          </div>
          {people && (
            <div className="flex items-center gap-2 pb-1">
              <CheckboxField label={t('m17.tm.whatIf')} checked={whatIf} onChange={(v) => { setWhatIf(v); if (!v) setGone(new Set()); }} />
              {whatIf && <SimChip label={t('m17.tm.simulated')} />}
            </div>
          )}
        </div>
        {people && <button type="button" className="btn-outline btn-sm" onClick={exportCsv} data-testid="m17-tm-csv"><Icon name="download" size={14} /> {t('m17.tm.csv')}</button>}
      </div>
      {!people && <Callout tone="info" title={t('m17.tm.aggTitle')}>{t('m17.tm.agg')}</Callout>}
      {cov.suppressed && <Callout tone="sim" title={t('m17.tm.suppressedTitle')}>{t('m17.tm.suppressed', { n: f.num(cov.size) })}</Callout>}
      {whatIf && (
        <Callout tone="sim" title={t('m17.tm.whatIfTitle')}>
          {gone.size ? t('m17.tm.whatIfDelta', { n: f.num(gone.size), spof: f.num(sum.spof - base.spof), unc: f.num(sum.uncovered - base.uncovered) }) : t('m17.tm.whatIfHint')}
        </Callout>
      )}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="m17-tm-stats">
        <Stat label={t('m17.tm.stat.people')} value={f.num(cov.size)} sub={whatIf && gone.size ? t('m17.tm.stat.away', { n: f.num(gone.size) }) : undefined} />
        <Stat label={t('m17.tm.stat.skills')} value={f.num(sum.skills)} />
        <Stat label={t('m17.tm.stat.covered')} value={f.num(sum.covered)} tone="ok" />
        <Stat label={t('m17.tm.stat.gaps')} value={f.num(sum.thin + sum.uncovered)} sub={t('m17.tm.stat.gapsSub', { thin: f.num(sum.thin), unc: f.num(sum.uncovered) })} tone={sum.uncovered ? 'bad' : sum.thin ? 'sim' : undefined} />
        <Stat label={t('m17.tm.stat.spof')} value={f.num(sum.spof)} sub={t('m17.tm.stat.spofSub')} tone={sum.spof ? 'bad' : 'ok'} />
      </div>
      {!cov.group ? <EmptyState title={t('m17.tm.noGroupTitle')}>{t('m17.tm.noGroup')}</EmptyState> : (
        <Tabs tabs={[
          ...(people ? [{ id: 'heatmap', label: t('m17.tm.tab.heatmap'), content: <HeatmapView cov={cov} cat={cat} rows={rows} states={states} whatIf={whatIf} gone={gone} toggle={toggleGone} /> }] : []),
          { id: 'coverage', label: t('m17.tm.tab.coverage'), badge: sum.spof ? f.num(sum.spof) : undefined, content: <CoverageView cov={cov} cat={cat} rows={rows} canSet={canSet} /> },
          ...(people ? [{ id: 'crews', label: t('m17.tm.tab.crews'), content: <CrewsView cov={cov} cat={cat} canSet={canSet} /> }] : []),
          ...(people ? [{ id: 'actions', label: t('m17.tm.tab.actions'), content: <ActionsView cov={cov} cat={cat} rows={rows} states={states} courses={courses} /> }] : []),
        ]} />
      )}
    </div>
  );
}

// ───────────── heatmap
const LEVEL_BG = ['', 'bg-accent/15', 'bg-accent/35', 'bg-accent/60', 'bg-accent/90 text-panel'];
const BASIS_RING: Record<string, string> = { verified: 'ring-2 ring-ok', evidenced: 'ring-2 ring-info', validated: 'ring-2 ring-accent', claimed: 'ring-1 ring-dashed ring-sim outline-dashed outline-1 outline-sim' };
function HeatmapView({ cov, cat, rows, states, whatIf, gone, toggle }: { cov: TeamCoverage; cat: Catalogue; rows: CoverageRow[]; states: StateMap; whatIf: boolean; gone: Set<string>; toggle: (id: string) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const name = useName();
  const sk = useSkillName(cat);
  const [area, setArea] = useState('');
  const [gapsOnly, setGapsOnly] = useState(false);
  const byId = new Map(rows.map((r) => [r.skill_id, r]));
  const areas = [...new Set(cov.skills.map((id) => cat.skill.get(id)?.area).filter(Boolean))] as string[];
  const cols = cov.skills.filter((id) => (!area || cat.skill.get(id)?.area === area) && (!gapsOnly || (byId.get(id)?.status !== 'covered' || byId.get(id)?.spof)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <SelectField label={t('m17.tm.area')} name="area" value={area} onChange={setArea} placeholder={t('common.all')} options={areas.map((a) => ({ value: a, label: t(`m17.area.${a}`) }))} />
        </div>
        <CheckboxField label={t('m17.tm.gapsOnly')} checked={gapsOnly} onChange={setGapsOnly} />
        <Legend />
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-card border border-line" data-testid="m17-tm-heatmap">
        <table className="border-separate border-spacing-0 text-[12px]">
          <caption className="sr-only">{t('m17.tm.heatmapCaption')}</caption>
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th scope="col" className="sticky start-0 z-20 min-w-[200px] bg-panel px-2 py-2 text-start align-bottom caps">{t('m17.tm.person')}</th>
              {cols.map((id) => {
                const r = byId.get(id);
                return (
                  <th key={id} scope="col" className="min-w-[46px] border-s border-line/60 px-1 py-1 align-bottom">
                    <span className="block max-w-[46px] truncate font-mono text-[10px] text-ink-2" title={sk(id)}>{cat.skill.get(id)?.code ?? id}</span>
                    <span className="sr-only">{sk(id)}</span>
                    {r && <span className={`mt-0.5 block text-[10px] ${r.spof ? 'font-semibold text-bad' : r.status === 'covered' ? 'text-ok' : r.status === 'thin' ? 'text-sim' : 'text-bad'}`} title={t('m17.tm.targetTip', { n: f.num(r.min_people), level: f.num(r.min_level) })}>
                      {f.num(r.n ?? 0)}/{f.num(r.min_people)}{r.spof ? ' !' : ''}
                    </span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {cov.members.map((m) => {
              const out = gone.has(m.id);
              return (
                <tr key={m.id} className={out ? 'opacity-40' : ''}>
                  <th scope="row" className="sticky start-0 z-[5] border-t border-line/60 bg-panel px-2 py-1 text-start font-normal">
                    <span className="flex items-center gap-2">
                      {whatIf && <input type="checkbox" aria-label={t('m17.tm.simulateLeave', { name: name(m) })} checked={out} onChange={() => toggle(m.id)} data-testid={`m17-tm-gone-${m.id}`} />}
                      <span className="min-w-0">
                        <span className={`block truncate font-medium text-ink ${out ? 'line-through' : ''}`}>{name(m)}</span>
                        <span className="block truncate text-[11px] text-ink-3">{pick(cat.role.get(m.job_role_id ?? ''), 'title')}{m.crew ? ` · ${t('m17.tm.crewN', { crew: m.crew })}` : ''}</span>
                      </span>
                    </span>
                  </th>
                  {cols.map((id) => {
                    const st = states.get(stateKey(m.id, id));
                    const r = byId.get(id);
                    const hit = st && r && st.level >= r.min_level;
                    const label = st ? t('m17.tm.cellLabel', { name: name(m), skill: sk(id), level: f.num(st.level), basis: t(`common.skills.basis.${st.basis}`) }) : t('m17.tm.cellNone', { name: name(m), skill: sk(id) });
                    return (
                      <td key={id} className="border-s border-t border-line/60 p-0.5 text-center" aria-label={label} title={label}>
                        {st ? (
                          <span className={`mx-auto grid h-7 w-9 place-items-center rounded ${LEVEL_BG[Math.min(4, st.level)]} ${BASIS_RING[st.basis] ?? ''} ${hit ? 'font-semibold' : ''}`} data-basis={st.basis}>
                            {f.num(st.level)}
                          </span>
                        ) : <span className="text-ink-3/50">·</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-ink-3">{t('m17.tm.heatmapNote')}</p>
    </div>
  );
}
function Legend() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 pb-1 text-[12px] text-ink-2" aria-label={t('m17.tm.legend')}>
      {(['verified', 'evidenced', 'validated', 'claimed'] as const).map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5"><span className={`inline-block h-3.5 w-4 rounded bg-accent/35 ${BASIS_RING[b]}`} aria-hidden />{t(`common.skills.basis.${b}`)}</span>
      ))}
      <span className="text-ink-3">{t('m17.tm.legendCount')}</span>
    </div>
  );
}

// ───────────── coverage and targets
function CoverageView({ cov, cat, rows, canSet }: { cov: TeamCoverage; cat: Catalogue; rows: CoverageRow[]; canSet: boolean }) {
  const t = useT();
  const f = useFormat();
  const name = useName();
  const sk = useSkillName(cat);
  const [edit, setEdit] = useState<{ team: string; skill: string; min_people: number; min_level: number; set: boolean } | null>(null);
  const member = new Map(cov.members.map((m) => [m.id, m]));
  const sorted = [...rows].sort((a, b) => Number(b.spof) - Number(a.spof) || rank(a.status) - rank(b.status) || Number(b.target_set) - Number(a.target_set));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]" data-testid="m17-tm-coverage">
          <caption className="sr-only">{t('m17.tm.tab.coverage')}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.skill')}</th>
              <th scope="col" className="caps py-1.5 text-start">{t('m17.tm.col.target')}</th>
              <th scope="col" className="caps py-1.5 text-end">{t('m17.tm.col.holders')}</th>
              <th scope="col" className="caps py-1.5 text-start ps-3">{t('m17.tm.col.status')}</th>
              <th scope="col" className="caps py-1.5 text-start">{t('m17.tm.col.who')}</th>
              {canSet && <th scope="col" className="caps py-1.5 text-end">{t('m17.tm.col.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.skill_id} className="border-b border-line/60 align-top">
                <th scope="row" className="py-1.5 pe-2 text-start font-normal">{sk(r.skill_id)}</th>
                <td className="py-1.5 pe-2">{t('m17.tm.targetText', { n: f.num(r.min_people), level: f.num(r.min_level) })} {!r.target_set && <span className="chip border-line bg-sunken text-ink-3">{t('m17.tm.defaultTarget')}</span>}</td>
                <td className="num py-1.5 text-end">{r.n == null ? t('common.suppressedShort') : f.num(r.n)}{r.claimed_n ? <span className="block text-[11px] text-sim">{t('m17.tm.claimedN', { n: f.num(r.claimed_n) })}</span> : null}</td>
                <td className="py-1.5 ps-3"><span className="flex flex-wrap items-center gap-1.5"><CoveragePill status={r.status} />{r.spof && <SpofFlag />}</span></td>
                <td className="py-1.5 pe-2 text-[12px] text-ink-2">{(r.holders ?? []).map((h) => name(member.get(h), h)).join(', ') || '—'}</td>
                {canSet && <td className="py-1.5 text-end"><button type="button" className="btn-ghost btn-sm" onClick={() => setEdit({ team: cov.group!, skill: r.skill_id, min_people: r.min_people, min_level: r.min_level, set: r.target_set })} data-testid="m17-tm-set">{t('m17.tm.setTarget')}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canSet && <AddTarget cov={cov} cat={cat} onPick={(skill) => setEdit({ team: cov.group!, skill, min_people: TARGET.DEFAULT_PEOPLE, min_level: Number(cat.skill.get(skill)?.key_level ?? 2), set: false })} />}
      <p className="text-[12px] text-ink-3">{t('m17.tm.coverageNote')}</p>
      {edit && <TargetDialog edit={edit} cat={cat} onClose={() => setEdit(null)} />}
    </div>
  );
}
const rank = (s: string) => ({ uncovered: 0, thin: 1, covered: 2, suppressed: 3 } as Record<string, number>)[s] ?? 4;
function AddTarget({ cov, cat, onPick }: { cov: TeamCoverage; cat: Catalogue; onPick: (skill: string) => void }) {
  const t = useT();
  const pick = usePick();
  const sec = useMemo(() => securityComps(cat.comps), [cat.comps]);
  const [v, setV] = useState('');
  const opts = cat.skills.filter((s) => !(s.area === 'security' || sec.has(s.competency_id)) && !cov.targets.some((x) => x.skill_id === s.id));
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[280px]"><SelectField label={t('m17.tm.addTarget')} name="add-target" value={v} onChange={setV} placeholder={t('common.choose')} options={opts.map((s) => ({ value: s.id, label: pick(s, 'name') }))} /></div>
      <button type="button" className="btn-outline btn-sm" disabled={!v} onClick={() => onPick(v)}>{t('m17.tm.setTarget')}</button>
    </div>
  );
}
function TargetDialog({ edit, cat, onClose }: { edit: { team: string; skill: string; min_people: number; min_level: number; set: boolean }; cat: Catalogue; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const sk = useSkillName(cat);
  const [mp, setMp] = useState(String(edit.min_people));
  const [ml, setMl] = useState(String(edit.min_level));
  const [note, setNote] = useState('');
  const [clear, setClear] = useState(false);
  return (
    <ConfirmDialog open onClose={onClose} title={t('m17.tm.targetTitle', { skill: sk(edit.skill) })} confirmLabel={clear ? t('m17.tm.clearTarget') : t('common.save')}
      consequence={edit.team === CREW_PROFILE ? t('m17.tm.targetCrewBody') : t('m17.tm.targetBody')}
      onConfirm={async () => {
        const r = await act(() => repo.rpc.setTeamTarget({ team_id: edit.team, skill_id: edit.skill, min_people: Number(mp), min_level: Number(ml), note: note.trim() || null, active: !clear }));
        if (r.ok) onClose();
      }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label={t('m17.tm.minPeople')} name="mp" value={mp} onChange={setMp} options={Array.from({ length: TARGET.MIN_PEOPLE_MAX }, (_, i) => ({ value: String(i + 1), label: f.num(i + 1) }))} />
        <SelectField label={t('m17.tm.minLevel')} name="ml" value={ml} onChange={setMl} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: t('m17.ci.levelN', { n: f.num(l) }) }))} />
      </div>
      <div className="mt-2"><TextArea name="tnote" label={t('m17.tm.targetNote')} rows={2} value={note} onChange={(v) => setNote(v.slice(0, 300))} /></div>
      {edit.set && <div className="mt-2"><CheckboxField label={t('m17.tm.clearTarget')} checked={clear} onChange={setClear} /></div>}
    </ConfirmDialog>
  );
}

// ───────────── crews (counts and availability only)
function CrewsView({ cov, cat, canSet }: { cov: TeamCoverage; cat: Catalogue; canSet: boolean }) {
  const t = useT();
  const f = useFormat();
  const sk = useSkillName(cat);
  const [edit, setEdit] = useState<{ team: string; skill: string; min_people: number; min_level: number; set: boolean } | null>(null);
  if (!cov.crews.length) return <EmptyState title={t('m17.tm.noCrewsTitle')}>{t('m17.tm.noCrews')}</EmptyState>;
  return (
    <div className="space-y-3">
      <Callout tone="sim" title={t('m17.tm.crewNoteTitle')}>{t('m17.tm.crewNote')}</Callout>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]" data-testid="m17-tm-crews">
          <caption className="sr-only">{t('m17.tm.tab.crews')}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="caps py-1.5 text-start">{t('m17.tm.crew')}</th>
              <th scope="col" className="caps py-1.5 text-end">{t('m17.tm.headcount')}</th>
              {cov.crew_profile.map((p) => (
                <th key={p.skill_id} scope="col" className="caps py-1.5 ps-2 text-center">
                  <span className="block normal-case" title={sk(p.skill_id)}>{cat.skill.get(p.skill_id)?.code ?? p.skill_id}</span>
                  <span className="block text-[10px] normal-case text-ink-3">{t('m17.tm.targetShort', { n: f.num(p.min_people), level: f.num(p.min_level) })}</span>
                  {canSet && <button type="button" className="btn-ghost btn-sm mt-0.5 text-[10px]" onClick={() => setEdit({ team: CREW_PROFILE, skill: p.skill_id, min_people: p.min_people, min_level: p.min_level, set: true })}>{t('m17.tm.edit')}</button>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cov.crews.map((c) => (
              <tr key={c.crew} className="border-b border-line/60">
                <th scope="row" className="py-1.5 text-start font-medium">{t('m17.tm.crewN', { crew: c.crew })}</th>
                <td className="num py-1.5 text-end">{f.num(c.headcount)}<span className="block text-[11px] text-ink-3">{t('m17.tm.availableN', { n: f.num(c.available) })}{c.unknown ? ` · ${t('m17.tm.unknownN', { n: f.num(c.unknown) })}` : ''}</span></td>
                {c.skills.map((x) => (
                  <td key={x.skill_id} className="py-1.5 ps-2 text-center">
                    <span className={`inline-block min-w-[52px] rounded px-1.5 py-0.5 font-semibold ${x.status === 'covered' ? 'bg-ok-bg text-ok' : x.status === 'thin' ? 'bg-sim-bg text-sim' : 'bg-bad-bg text-bad'}`}
                      aria-label={t('m17.tm.crewCell', { crew: c.crew, skill: sk(x.skill_id), n: f.num(x.n), min: f.num(x.min_people), a: f.num(x.available_n) })}>
                      {f.num(x.n)}/{f.num(x.min_people)}
                    </span>
                    <span className="block text-[11px] text-ink-3">{t('m17.tm.availShort', { n: f.num(x.available_n) })}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canSet && <p className="text-[12px] text-ink-3">{t('m17.tm.crewProfileNote')}</p>}
      {edit && <TargetDialog edit={edit} cat={cat} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ───────────── suggested actions
function ActionsView({ cov, cat, rows, states, courses }: { cov: TeamCoverage; cat: Catalogue; rows: CoverageRow[]; states: StateMap; courses: Row[] }) {
  const t = useT();
  const pick = usePick();
  const name = useName();
  const sk = useSkillName(cat);
  const sec = useMemo(() => securityComps(cat.comps), [cat.comps]);
  const member = new Map(cov.members.map((m) => [m.id, m]));
  const list = useMemo(() => teamActions({
    rows, members: cov.members, states, skills: cat.skills, courses, secComps: sec,
    name: (id) => ({ en: member.get(id)?.name_en ?? id, ar: member.get(id)?.name_ar ?? id }),
    skillName: (id) => ({ en: cat.skill.get(id)?.name_en ?? id, ar: cat.skill.get(id)?.name_ar ?? id }),
    courseName: (c) => ({ en: `${c.code} ${c.title_en}`, ar: `${c.code} ${c.title_ar}` }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, cov.members, states, cat, courses, sec]);
  if (!list.length) return <EmptyState title={t('m17.tm.noActionsTitle')}>{t('m17.tm.noActions')}</EmptyState>;
  return (
    <ul className="space-y-2" data-testid="m17-tm-actions">
      {list.slice(0, 24).map((a) => {
        const it = a.item!;
        const course = it.course_id ? courses.find((c) => c.id === it.course_id) : null;
        return (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-raised px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip border-line bg-sunken text-ink-2"><Icon name={it.kind === 'course' ? 'book' : it.kind === 'opportunity' ? 'briefcase' : 'users'} size={12} /> {t(`m17.tm.action.${it.kind}`)}</span>
                <span className="font-medium text-ink">{sk(it.skill_id)}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">
                {it.kind === 'course' && t('m17.tm.actionText.course', { name: name(member.get(it.nominee!), it.nominee), course: course ? `${course.code} ${pick(course, 'title')}` : '' })}
                {it.kind === 'opportunity' && t('m17.tm.actionText.opportunity', { skill: sk(it.skill_id) })}
                {it.kind === 'mentoring' && t('m17.tm.actionText.mentoring', { mentor: name(member.get(it.mentor!), it.mentor), name: name(member.get(it.nominee!), it.nominee) })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <WhyThis reasons={a.reasons} />
              {it.kind === 'course' && course && <L to={`/learn/course/${course.id}`} className="btn-outline btn-sm no-underline">{t('m17.tm.openCourse')}</L>}
              {it.kind === 'opportunity' && <L to="/opportunities/post" className="btn-outline btn-sm no-underline">{t('m17.tm.postGig')}</L>}
              {it.kind === 'mentoring' && <L to="/my/mentoring" className="btn-outline btn-sm no-underline">{t('m17.tm.requestMentoring')}</L>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

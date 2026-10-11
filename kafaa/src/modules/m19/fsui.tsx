// FS17/FS18 (FS wave C · E1) shared UI for the pathway and external-catalogue pages and the Coach tab: data hooks (through the
// repository only) and small presentational pieces. Ranking runs client-side with the pure rankPathways() over rows the person may read.
import { useMemo, useState } from 'react';
import { Icon, Modal, StatusPill, TextArea, TextField, WhyThis, SourceLink } from '../../ui';
import { useAction, useQuery, useRepo, type Table } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { SCHEMA } from '../../data/schema';
import { rankExternals, rankPathways, type PeerStats, type Requirement, type ResolvedItem, type SkillRef, type StepKind } from './pathways';
import type { PathwayCatalogue } from './backend/rpc';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const has = (t: string) => Object.prototype.hasOwnProperty.call(SCHEMA, t);

/** Reference rows every FS17/FS18 page reads: skills, pathways (+ steps), externals, criteria and the catalogue RPC. */
export function usePwRef() {
  const repo = useRepo();
  return useQuery(['pathways', 'pathway_steps', 'pathway_enrolments', 'external_resources', 'catalogue_criteria', 'external_completions', 'skills'] as Table[], async () => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [skills, pathways, externals, criteria, catalogue] = await Promise.all([
      safe(repo.list('skills')), safe(repo.list('pathways' as Table, { order: [['sort', 'asc']] } as never)), safe(repo.list('external_resources' as Table, { order: [['sort', 'asc']] } as never)),
      safe(repo.list('catalogue_criteria' as Table, { order: [['sort', 'asc']] } as never)), repo.rpc.pathwayCatalogue().catch(() => null),
    ]);
    return { skills: skills as Row[], pathways: pathways as Row[], externals: externals as Row[], criteria: criteria as Row[], catalogue: catalogue as PathwayCatalogue | null };
  }, []);
}
export type PwRef = NonNullable<ReturnType<typeof usePwRef>['data']>;

/** The Coach's pathway ranking for the signed-in person (today's role profile, the 2030 profile, goals, weekly goal). */
export function useFsCoach() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  return useQuery(['pathways', 'pathway_enrolments', 'person_skills', 'external_resources', 'learning_goals', ...(['skill_goals', 'future_goals'].filter(has))] as Table[], async () => {
    if (!me) return null;
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const mine = { filter: { person_id: me } } as never;
    const [person, catalogue, skills, states, externals, goals, fgoals, lgoals] = await Promise.all([
      repo.get('people', me).catch(() => null), repo.rpc.pathwayCatalogue().catch(() => null), safe(repo.list('skills')), safe(repo.list('person_skills', mine)),
      safe(repo.list('external_resources' as Table)), has('skill_goals') ? safe(repo.list('skill_goals' as Table, mine)) : Promise.resolve([]),
      has('future_goals') ? safe(repo.list('future_goals' as Table, mine)) : Promise.resolve([]), safe(repo.list('learning_goals', mine)),
    ]);
    if (!catalogue) return null;
    const roleId = (person as Row | null)?.job_role_id ?? null;
    const [profiles, role] = await Promise.all([
      roleId ? safe(repo.list('role_profile_versions' as Table, { filter: { role_id: roleId, status: 'published' } } as never)) : Promise.resolve([]),
      roleId ? repo.get('job_roles', roleId).catch(() => null) : Promise.resolve(null),
    ]);
    const latest = (h: string) => (profiles as Row[]).filter((p) => p.horizon === h).sort((a, b) => Number(b.version) - Number(a.version))[0];
    const have = new Map<string, number>();
    for (const x of states as Row[]) if (x.active !== false) have.set(x.skill_id, Math.max(have.get(x.skill_id) ?? 0, Number(x.level)));
    const goalSkills = [...(goals as Row[]).filter((g) => g.status !== 'removed').map((g) => String(g.skill_id)), ...(fgoals as Row[]).filter((g) => g.status === 'active').flatMap((g) => (g.skill_ids ?? []) as string[])];
    const weekly = (lgoals as Row[])[0]?.hours_per_week;
    const enrolled = new Map<string, string>(catalogue.pathways.filter((p) => p.mine && p.mine !== 'withdrawn').map((p) => [p.id, p.mine!]));
    const ranked = rankPathways({
      pathways: catalogue.pathways.map((p) => ({ id: p.id, skill_id: p.skill_id, level: p.level, envelope_months: p.envelope_months, weekly_hours: p.weekly_hours, title_en: '', title_ar: '', requested: p.requested, peer: p.peer })),
      skills: skills as unknown as SkillRef[], have, roleTitle: role ? { en: (role as Row).title_en, ar: (role as Row).title_ar } : null,
      now: ((latest('now')?.requirements ?? []) as Requirement[]), y2030: ((latest('2030')?.requirements ?? []) as Requirement[]),
      goals: [...new Set(goalSkills)], weeklyGoal: weekly != null && Number(weekly) > 0 ? Number(weekly) : null, enrolled,
    });
    const externalPicks = rankExternals(ranked, externals as never, skills as unknown as SkillRef[]);
    return { ranked, externalPicks, catalogue, has2030: !!latest('2030'), weekly: weekly != null ? Number(weekly) : null };
  }, [me]);
}

// ───────────── small pieces
export const KIND_ICON: Record<StepKind, string> = { learn: 'book', practice: 'briefcase', assess: 'check' };
export const ITEM_ICON: Record<string, string> = { course: 'book', external: 'external', opportunity: 'sparkle', credential: 'shield', fitness: 'check', adaptive: 'chart', task: 'grad' };
export function LevelPill({ level }: { level: number }) {
  const t = useT();
  return <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-eyebrow" data-testid="m19-pw-level">{t('m19.pw.levelShort', { n: level })}</span>;
}
export function ExternalChip() {
  const t = useT();
  return <span className="inline-flex items-center gap-1 rounded-full border border-info-line bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-ink" data-testid="m19-external-chip"><Icon name="external" size={11} />{t('m19.xr.chip')}</span>;
}
export function SelfDeclaredChip() {
  const t = useT();
  return <span className="inline-flex items-center gap-1 rounded-full border border-sim-line bg-sim-bg px-2 py-0.5 text-[11px] font-semibold text-ink" data-testid="m19-self-declared" title={t('m19.xr.selfDeclaredHint')}>{t('m19.xr.selfDeclared')}</span>;
}
export function PeerLine({ peer, compact }: { peer: PeerStats | null | undefined; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  if (!peer) return null;
  if (peer.suppressed) return <span className="text-[12.5px] text-ink-3" data-testid="m19-peer" data-suppressed="true"><Icon name="lock" size={12} className="me-1 inline" />{t(compact ? 'm19.pw.peerSuppressedShort' : 'm19.pw.peerSuppressed')}</span>;
  return <span className="text-[12.5px] text-ink-2" data-testid="m19-peer" data-suppressed="false"><Icon name="users" size={12} className="me-1 inline" />{t('m19.pw.peerLine', { weeks: f.num(peer.median_weeks), n: f.num(peer.completed) })}</span>;
}
export function EnvelopeLine({ months, weekly }: { months: number; weekly: number }) {
  const t = useT();
  const f = useFormat();
  return <span className="text-[12.5px] text-ink-2" data-testid="m19-envelope"><Icon name="calendar" size={12} className="me-1 inline" />{t('m19.pw.envelopeLine', { months: f.num(months), hours: f.num(weekly) })}</span>;
}
export function ItemLink({ item }: { item: ResolvedItem }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid="m19-step-item" data-type={item.type}>
      <Icon name={ITEM_ICON[item.type] ?? 'info'} size={13} className="text-ink-3" />
      <L to={item.link} className="font-medium">{lang === 'ar' ? item.title_ar : item.title_en}</L>
      <span className="caps text-[10.5px] text-ink-3">{t(`m19.pw.item.${item.type}`)}</span>
      {item.external && <ExternalChip />}
      {item.pinned && <span className="text-[11px] text-ink-3" title={t('m19.pw.pinnedHint')}>{t('m19.pw.pinned')}</span>}
      {item.hours != null && <span className="text-[11.5px] text-ink-3">{item.type === 'opportunity' ? t('m19.pw.hoursWeek', { n: f.num(item.hours) }) : t('m19.pw.hoursN', { n: f.num(item.hours) })}</span>}
    </span>
  );
}
export function skillName(skills: Row[], id: string, pick: ReturnType<typeof usePick>) {
  const s = skills.find((x) => x.id === id);
  return s ? pick(s, 'name') : id;
}

/** A ranked Coach card for one pathway (reasons in <WhyThis>). */
export function CoachPathwayCard({ id, reasons, skills, pathways, n }: { id: string; reasons: Parameters<typeof WhyThis>[0]['reasons']; skills: Row[]; pathways: Row[]; n: number }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const p = pathways.find((x) => x.id === id);
  if (!p) return null;
  return (
    <li className="card border-s-4 border-accent/50 p-4" data-testid="m19-pw-coach-card" data-pathway={id}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-eyebrow" aria-hidden="true"><Icon name="grad" size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="num text-[12px] text-ink-3">{f.num(n)}.</span><span className="caps">{t('m19.pw.coachKind')}</span><LevelPill level={Number(p.level)} /></div>
          <h3 className="mt-0.5 text-[15.5px] font-semibold leading-snug"><L to={`/learn/pathways/${p.id}`}>{pick(p, 'title')}</L></h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1"><EnvelopeLine months={Number(p.envelope_months)} weekly={Number(p.weekly_hours)} /><span className="text-[12.5px] text-ink-3">{skillName(skills, p.skill_id, pick)}</span></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <WhyThis reasons={reasons} testId="m19-pw-why" />
        <L to={`/learn/pathways/${p.id}`} className="btn-outline btn-sm">{t('m19.pw.open')}<Icon name="chevron" size={14} className="rtl:-scale-x-100" /></L>
      </div>
    </li>
  );
}

/** FS18: record my completion of an external resource (self-declared; an xAPI "experienced" statement; never verified evidence). */
export function CompleteExternalModal({ resource, open, onClose }: { resource: Row | null; open: boolean; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [on, setOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(on) || on > todayIso() || note.length > 300;
  return (
    <Modal open={open && !!resource} onClose={() => !busy && onClose()} title={t('m19.xr.recordTitle')} size="sm"
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={busy || invalid} data-testid="m19-xr-record-confirm" onClick={async () => {
          if (!resource) return;
          setBusy(true);
          const r = await run(() => repo.rpc.recordExternalCompletion({ resource_id: resource.id, completed_on: on, note: note || null }), { success: t('m19.xr.recorded') });
          setBusy(false);
          if (r.ok) onClose();
        }}>{t('m19.xr.recordConfirm')}</button>
      </>}>
      {resource && (
        <div className="space-y-3">
          <p className="font-semibold">{pick(resource, 'title')}</p>
          <p className="rounded-card border border-sim-line bg-sim-bg p-2.5 text-[13px] text-ink-2" data-testid="m19-xr-self-note">{t('m19.xr.recordNotice')}</p>
          <TextField type="date" label={t('m19.xr.completedOn')} name="completed_on" value={on} onChange={setOn} required />
          <TextArea label={t('m19.xr.note')} name="note" value={note} onChange={setNote} rows={2} hint={t('m19.xr.noteHint')} />
        </div>
      )}
    </Modal>
  );
}

/** One external resource card (catalogue, coach picks). */
export function ExternalCard({ x, skills, mine, onRecord, reasons, highlight }: { x: Row; skills: Row[]; mine?: Row | null; onRecord?: () => void; reasons?: Parameters<typeof WhyThis>[0]['reasons']; highlight?: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const langs = (x.languages ?? []) as string[];
  const src = (x.sources ?? [])[0] as Row | undefined;
  return (
    <li className={`card p-4 ${highlight ? 'ring-2 ring-accent' : ''}`} data-testid="m19-xr-card" data-id={x.id} id={`xr-${x.id}`}>
      <div className="flex flex-wrap items-center gap-2"><ExternalChip /><span className="caps text-[11px]">{t(`m19.xr.format.${x.format}`)}</span>
        <StatusPill tone={x.cost_band === 'free' ? 'ok' : 'neutral'}>{t(`m19.xr.cost.${x.cost_band}`)}</StatusPill>
        {x.has_assessment && <StatusPill tone="info">{t('m19.xr.hasAssessment')}</StatusPill>}
        {mine && <SelfDeclaredChip />}
      </div>
      <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug"><a href={x.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1">{pick(x, 'title')}<Icon name="external" size={13} /></a></h3>
      <p className="text-[13px] text-ink-3">{pick(x, 'provider')}</p>
      <p className="mt-2 text-[13.5px] text-ink-2">{pick(x, 'summary')}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        <span><Icon name="calendar" size={12} className="me-1 inline" />{x.hours != null ? t('m19.pw.hoursN', { n: f.num(Number(x.hours)) }) : pick(x, 'duration')}</span>
        <span><Icon name="globe" size={12} className="me-1 inline" />{langs.map((l) => t(`m19.xr.lang.${l}`)).join(' · ')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" data-testid="m19-xr-skills">
        {((x.skills ?? []) as Row[]).map((s) => <L key={s.skill_id} to={`/skills/${s.skill_id}`} className="chip text-[12px]">{skillName(skills, s.skill_id, pick)} · {t('m19.pw.levelShort', { n: s.level })}</L>)}
      </div>
      {(x.criteria_note_en || x.criteria_note_ar) && <p className="mt-2 text-[12.5px] text-ink-3">{pick(x, 'criteria_note')}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-[12px]" data-testid="m19-xr-source">{src ? <SourceLink href={src.url} date={x.as_of}>{src.label}</SourceLink> : <SourceLink href={x.url} date={x.as_of}>{pick(x, 'provider')}</SourceLink>}</span>
        <span className="flex flex-wrap items-center gap-2">
          {reasons && <WhyThis reasons={reasons} testId="m19-xr-why" />}
          {mine ? <span className="text-[12.5px] text-ink-3">{t('m19.xr.recordedOn', { date: f.date(String(mine.completed_on)) })}</span>
            : onRecord && x.status === 'published' && <button type="button" className="btn-outline btn-sm" onClick={onRecord} data-testid="m19-xr-record">{t('m19.xr.record')}</button>}
        </span>
      </div>
    </li>
  );
}

/** My own external completions (FS18), keyed by resource. */
export function useMyCompletions() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['external_completions'] as Table[], () => (me ? repo.list('external_completions' as Table, { filter: { person_id: me } } as never).catch(() => []) : Promise.resolve([])), [me]);
  return useMemo(() => new Map(((q.data ?? []) as Row[]).map((c) => [String(c.resource_id), c])), [q.data]);
}

// M20 · F15 shared page helpers: the rotations data hook, programme chips, the placement rail, objective lists, phase and
// consent pills. Pages read through the repository only; rules come from ./rotation.
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import type { CareerPathsRow, JobFamiliesRow, JobRolesRow, PersonSkillsRow, RoleCompetenciesRow, RotationCohortsRow, RotationPlacementsRow, RotationTemplatesRow, ShadowHostsRow, ShadowRequestsRow, SkillsRow } from '../../data/types';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Icon, StatusPill, type PillTone } from '../../ui';
import { midpoint, phaseOf, type Objective, type Phase, type Step } from './rotation';
import { defaultTarget } from './ui';

export type Template = RotationTemplatesRow;
export type Cohort = RotationCohortsRow;
export type Placement = RotationPlacementsRow;
export type Host = ShadowHostsRow;
export type ShadowReq = ShadowRequestsRow;

export interface RotData {
  templates: Template[]; cohorts: Cohort[]; placements: Placement[]; hosts: Host[]; shadows: ShadowReq[];
  states: PersonSkillsRow[]; skills: SkillsRow[]; roles: JobRolesRow[]; families: JobFamiliesRow[]; roleComps: RoleCompetenciesRow[]; paths: CareerPathsRow[]; shortlist: string[];
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function useRotations() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['rotation_templates', 'rotation_cohorts', 'rotation_placements', 'shadow_hosts', 'shadow_requests', 'person_skills', 'skills', 'job_roles', 'job_families', 'role_competencies', 'career_paths', 'career_targets'], async (): Promise<RotData> => {
    const [templates, cohorts, placements, hosts, shadows, states, skills, roles, families, roleComps, paths, targets] = await Promise.all([
      repo.list('rotation_templates', { order: [['programme', 'asc']] }),
      repo.list('rotation_cohorts', { order: [['intake_on', 'desc']] }),
      repo.list('rotation_placements', { order: [['starts_on', 'asc']] }),
      repo.list('shadow_hosts', { order: [['name', 'asc']] }),
      repo.list('shadow_requests', { order: [['updated_at', 'desc']] }),
      me ? repo.list('person_skills', { filter: { person_id: me, active: true } }) : Promise.resolve([] as PersonSkillsRow[]),
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('role_competencies'),
      repo.list('career_paths'),
      me ? repo.list('career_targets', { filter: { person_id: me, active: true }, order: [['rank', 'asc']] }).catch(() => []) : Promise.resolve([]),
    ]);
    return { templates, cohorts, placements, hosts, shadows, states, skills, roles, families, roleComps, paths, shortlist: (targets as { role_id: string }[]).map((x) => x.role_id) };
  }, [me]);
  return { q, me, person: s.person, roles: s.roles };
}

/** F05 hand-off: my top shortlisted role, else the next vertical step. */
export const targetOf = (d: RotData, currentRole: string | null | undefined) => defaultTarget(d.paths, currentRole, d.shortlist);

export function useRotLabels(d: RotData | undefined) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const sk = new Map((d?.skills ?? []).map((s) => [s.id, s]));
    const ro = new Map((d?.roles ?? []).map((r) => [r.id, r]));
    const fa = new Map((d?.families ?? []).map((f) => [f.id, f]));
    const tp = new Map((d?.templates ?? []).map((x) => [x.id, x]));
    const co = new Map((d?.cohorts ?? []).map((x) => [x.id, x]));
    return {
      skill: (id: string) => (sk.get(id) ? pick(sk.get(id), 'name') : id),
      role: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title') : t('m20.common.roleCard')),
      family: (id: string | null | undefined) => (id && fa.get(id) ? pick(fa.get(id), 'name') : t('m20.common.unknownFamily')),
      template: (id: string | null | undefined) => (id && tp.get(id) ? pick(tp.get(id), 'title') : t('m20.rot.common.programme')),
      cohort: (id: string | null | undefined) => (id && co.get(id) ? pick(co.get(id), 'name') : t('m20.rot.common.noCohort')),
      roleLabels: Object.fromEntries((d?.roles ?? []).map((r) => [r.id, { en: r.title_en, ar: r.title_ar }])),
      familyLabels: Object.fromEntries((d?.families ?? []).map((f) => [f.id, { en: f.name_en, ar: f.name_ar }])),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, pick, t]);
}
export type RotLabels = ReturnType<typeof useRotLabels>;

const PROG_TONE: Record<string, string> = {
  gdp: 'border-accent/30 bg-accent-soft text-eyebrow', gpo: 'border-ok-line bg-ok-bg text-ok', dnt: 'border-info-line bg-info-bg text-info',
  cross_functional: 'border-sim-line bg-sim-bg text-sim', hipo: 'border-line-strong bg-sunken text-ink',
};
export function ProgrammeChip({ programme }: { programme: string }) {
  const t = useT();
  return <span className={`chip ${PROG_TONE[programme] ?? 'border-line bg-sunken text-ink-2'}`} data-programme={programme}><Icon name="grad" size={12} />{t(`m20.rot.programme.${programme}`)}</span>;
}
export function SiteChip() {
  const t = useT();
  return <span className="chip border-sim-line bg-sim-bg text-sim" data-testid="m20-site-induction" title={t('m20.rot.common.siteHint')}><Icon name="shield" size={12} />{t('m20.rot.common.site')}</span>;
}
const PHASE_TONE: Record<Phase, PillTone> = { upcoming: 'neutral', in_progress: 'info', overdue: 'bad', signed_off: 'ok', cancelled: 'neutral' };
export function PhasePill({ p, today = todayIso() }: { p: { status: string; starts_on: string; ends_on: string }; today?: string }) {
  const t = useT();
  const ph = phaseOf(p, today);
  return <StatusPill status={ph} tone={PHASE_TONE[ph]}>{t(`m20.rot.phase.${ph}`)}</StatusPill>;
}
const SHADOW_TONE: Record<string, PillTone> = { requested: 'info', approved: 'accent', declined: 'bad', withdrawn: 'neutral', completed: 'ok' };
export function ShadowPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={SHADOW_TONE[status] ?? 'neutral'}>{t(`m20.rot.shadowStatus.${status}`)}</StatusPill>;
}
export function ConsentChips({ r }: { r: ShadowReq }) {
  const t = useT();
  const same = r.line_manager_id === r.host_id;
  const chip = (who: string, v: boolean | null) => (
    <span className={`chip ${v === true ? 'border-ok-line bg-ok-bg text-ok' : v === false ? 'border-bad-line bg-bad-bg text-bad' : 'border-line bg-sunken text-ink-3'}`}>
      <Icon name={v === true ? 'check' : v === false ? 'close' : 'info'} size={11} />{t(`m20.rot.consent.${who}`)}: {t(`m20.rot.consent.${v === true ? 'yes' : v === false ? 'no' : 'pending'}`)}
    </span>
  );
  return <span className="flex flex-wrap gap-1.5" data-testid="m20-consents">{same ? chip('both', r.host_consent ?? null) : <>{chip('host', r.host_consent ?? null)}{chip('manager', r.manager_consent ?? null)}</>}</span>;
}

/** The sequence of placements as a proportional rail (current one highlighted). Accessible as a list. */
export function PlacementRail({ steps, today = todayIso(), lab }: { steps: { key: string; family_id: string; months: number; title: ReactNode; starts_on?: string; ends_on?: string; status?: string }[]; today?: string; lab: RotLabels }) {
  const t = useT();
  const f = useFormat();
  const total = steps.reduce((a, s) => a + s.months, 0) || 1;
  return (
    <ol className="flex w-full gap-1 overflow-hidden rounded-card" aria-label={t('m20.rot.common.sequence')} data-testid="m20-rail">
      {steps.map((s, i) => {
        const ph = s.starts_on && s.ends_on ? phaseOf({ status: s.status ?? 'planned', starts_on: s.starts_on, ends_on: s.ends_on }, today) : null;
        const tone = ph === 'signed_off' ? 'bg-ok-bg border-ok-line' : ph === 'in_progress' ? 'bg-accent-soft border-accent/50 ring-2 ring-accent/40' : ph === 'overdue' ? 'bg-bad-bg border-bad-line' : 'bg-sunken border-line';
        return (
          <li key={s.key} className={`min-w-0 border px-2 py-1.5 ${tone}`} style={{ flexGrow: s.months, flexBasis: 0 }} title={`${i + 1}. ${lab.family(s.family_id)} · ${t('m20.rot.common.months', { n: s.months })}`}>
            <div className="caps truncate">{i + 1} · {t('m20.rot.common.monthsShort', { n: f.num(s.months) })}</div>
            <div className="truncate text-[12.5px] font-semibold">{s.title}</div>
            <div className="truncate text-[11.5px] text-ink-3">{lab.family(s.family_id)}{ph ? ` · ${t(`m20.rot.phase.${ph}`)}` : ''}</div>
          </li>
        );
      })}
      <li className="sr-only">{t('m20.rot.common.totalMonths', { n: total })}</li>
    </ol>
  );
}

/** Objectives with the target level, my current level and (after the check-in / sign-off) progress and result. */
export function ObjectiveList({ objectives, lab, myLevel, progress, achieved }: { objectives: Objective[]; lab: RotLabels; myLevel?: (skill: string) => number; progress?: Record<string, string> | null; achieved?: Record<string, number> | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <ul className="space-y-1.5" data-testid="m20-objectives">
      {objectives.map((o) => {
        const got = achieved?.[o.id];
        const met = got != null && got >= o.level;
        const pr = progress?.[o.id];
        return (
          <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 rounded-btn border border-line bg-panel px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px]">{pick(o as unknown as Record<string, unknown>, 'text')}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[12px] text-ink-3">
                <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{lab.skill(o.skill_id)}</span>
                <span>{t('m20.rot.common.target', { n: f.num(o.level) })}</span>
                {myLevel && <span>· {t('m20.rot.common.myLevel', { n: f.num(myLevel(o.skill_id)) })}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {pr && got == null && <span className={`chip ${pr === 'at_risk' ? 'border-bad-line bg-bad-bg text-bad' : pr === 'met' ? 'border-ok-line bg-ok-bg text-ok' : 'border-info-line bg-info-bg text-info'}`}>{t(`m20.rot.progress.${pr}`)}</span>}
              {got != null && <span className={`chip ${met ? 'border-ok-line bg-ok-bg text-ok' : 'border-sim-line bg-sim-bg text-sim'}`}><Icon name={met ? 'check' : 'info'} size={11} />{t(met ? 'm20.rot.common.met' : 'm20.rot.common.notMet', { n: f.num(got) })}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const stepsOf = (t: Template | undefined) => ((t?.steps as unknown as Step[]) ?? []);
export const objectivesOf = (p: Placement) => ((p.objectives as unknown as Objective[]) ?? []);
export const checkinOf = (p: Placement) => (p.checkin as unknown as { at: string; by: string; progress: Record<string, string>; note: string } | null) ?? null;
export const midOf = (p: Placement) => midpoint(p.starts_on, p.ends_on);

/** Who is who on a placement or request, without reading the people table: names are denormalised on the row. */
export function usePlacementPeople() {
  const t = useT();
  const pick = usePick();
  return (p: Placement, id: string | null | undefined) => {
    if (!id) return t('m20.common.system');
    if (id === p.person_id) return pick({ name_en: p.person_name, name_ar: p.person_name_ar }, 'name');
    if (id === p.signer_id && p.skip_level) return t('m20.rot.common.skipSigner');
    if (id === p.host_manager_id) return t('m20.rot.common.hostManager');
    if (id === p.line_manager_id) return t('m20.common.lineManager');
    if (id === p.enrolled_by) return t('m20.rot.common.owner');
    return t('m20.common.colleague');
  };
}

// M20 shared page helpers (F08): data hook with the match engine, chips, match ring, skill lists, application stepper.
import { useMemo, type ReactNode } from 'react';
import { useEngine, useQuery, useRepo } from '../../data';
import type { CareerPathsRow, JobFamiliesRow, JobRolesRow, OpportunitiesRow, OpportunityApplicationsRow, PersonSkillsRow, RoleCompetenciesRow, SkillsRow } from '../../data/types';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Icon, ProgressRing, Stepper, Timeline, StatusPill, type PillTone } from '../../ui';
import { matchOpportunities, NEED_LEVEL } from './match';
import { APP_STEPS, stepOf, type HistoryEntry } from './domain';
import type { BiText, Ranked } from '../../domain/engines/types';
import type { MatchItem } from './match';

export type Opp = OpportunitiesRow;
export type App = OpportunityApplicationsRow;

/** Everything the marketplace pages read, plus my match list (recomputed when the target role changes). */
export function useMarket(targetOverride?: string | null) {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['opportunities', 'opportunity_applications', 'opportunity_saves', 'person_skills', 'skills', 'job_roles', 'job_families', 'role_competencies', 'career_paths', 'career_targets'], async () => {
    const [opps, apps, saves, states, skills, roles, families, roleComps, paths, targets] = await Promise.all([
      repo.list('opportunities', { order: [['start_on', 'asc']] }),
      repo.list('opportunity_applications', { order: [['updated_at', 'desc']] }),
      repo.list('opportunity_saves'),
      me ? repo.list('person_skills', { filter: { person_id: me, active: true } }) : Promise.resolve([] as PersonSkillsRow[]),
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('role_competencies'),
      repo.list('career_paths'),
      me ? repo.list('career_targets', { filter: { person_id: me, active: true }, order: [['rank', 'asc']] }).catch(() => []) : Promise.resolve([]),
    ]);
    // F05 hand-off: my Career Navigator shortlist (active targets by rank) is the default target role
    const shortlist = (targets as { role_id: string }[]).map((x) => x.role_id);
    return { opps, apps, saves, states, skills, roles, families, roleComps, paths, shortlist };
  }, [me]);
  return { q, me, person: s.person };
}

export interface MarketData {
  opps: Opp[]; apps: App[]; saves: { opportunity_id: string; saved: boolean; person_id: string }[]; states: PersonSkillsRow[]; skills: SkillsRow[]; roles: JobRolesRow[]; families: JobFamiliesRow[]; roleComps: RoleCompetenciesRow[]; paths: CareerPathsRow[];
  /** My active F05 shortlist (role ids by rank). */
  shortlist?: string[];
}

/** Default target role: my top Career Navigator shortlist role (F05), else the next vertical step from my current role, else the first lateral one. */
export function defaultTarget(paths: CareerPathsRow[], current: string | null | undefined, shortlist: string[] = []): string | null {
  const top = shortlist.find((x) => x && x !== current);
  if (top) return top;
  if (!current) return null;
  const out = paths.filter((p) => p.from_role_id === current);
  return (out.find((p) => p.type === 'vertical') ?? out[0])?.to_role_id ?? null;
}

export function useMatches(d: MarketData | undefined, target: string | null, currentRole: string | null | undefined, family: string | null | undefined) {
  const eng = useEngine('match');
  const ranked = useMemo<Ranked<MatchItem<Opp>>[]>(() => {
    if (!d) return [];
    const roleLabels: Record<string, BiText> = Object.fromEntries(d.roles.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }]));
    return matchOpportunities({ opps: d.opps.filter((o) => o.status !== 'draft'), states: d.states, skills: d.skills, roleComps: d.roleComps, currentRole, targetRole: target, family, roleLabels, weights: eng.weights });
  }, [d, target, currentRole, family, eng.weights]);
  return { eng, ranked, byId: useMemo(() => new Map(ranked.map((r) => [r.id, r])), [ranked]) };
}

export function useLabels(d: { skills: SkillsRow[]; roles: JobRolesRow[]; families: JobFamiliesRow[] } | undefined) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const sk = new Map((d?.skills ?? []).map((s) => [s.id, s]));
    const ro = new Map((d?.roles ?? []).map((r) => [r.id, r]));
    const fa = new Map((d?.families ?? []).map((f) => [f.id, f]));
    return {
      skill: (id: string) => (sk.get(id) ? pick(sk.get(id), 'name') : id),
      role: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title') : t('m20.common.roleCard')),
      family: (id: string | null | undefined) => (id && fa.get(id) ? pick(fa.get(id), 'name') : t('m20.common.unknownFamily')),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, pick, t]);
}

const KIND_ICON: Record<string, string> = { project: 'briefcase', outage_support: 'calendar', shadowing: 'users', oe_review: 'book', knowledge_capture: 'chat', outreach: 'globe', research: 'sparkle' };
export function KindChip({ kind }: { kind: string }) {
  const t = useT();
  return (
    <span className="chip border-accent/30 bg-accent-soft text-eyebrow">
      <Icon name={KIND_ICON[kind] ?? 'briefcase'} size={12} />
      {t(`m20.kind.${kind}`)}
    </span>
  );
}
export function FlagChips({ flags }: { flags: string[] | null | undefined }) {
  const t = useT();
  if (!flags?.length) return null;
  return (
    <>
      {flags.map((f) => (
        <span key={f} className={`chip ${f === 'emirati_development' ? 'border-ok-line bg-ok-bg text-ok' : f === 'knowledge_transfer' ? 'border-info-line bg-info-bg text-info' : 'border-line bg-sunken text-ink-2'}`} data-flag={f}>
          {t(`m20.flag.${f}`)}
        </span>
      ))}
    </>
  );
}
export function MatchRing({ score, size = 56 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  const tone = pct >= 70 ? 'ok' : pct >= 45 ? 'accent' : 'sky';
  return <ProgressRing value={pct} size={size} tone={tone} />;
}

const APP_TONE: Record<string, PillTone> = { applied: 'info', released: 'accent', declined_release: 'bad', selected: 'ok', not_selected: 'neutral', completed: 'ok', withdrawn: 'neutral' };
export function AppPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={APP_TONE[status] ?? 'neutral'}>{t(`m20.appStatus.${status}`)}</StatusPill>;
}
export function OppPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={status === 'open' ? 'ok' : status === 'filled' ? 'info' : 'neutral'}>{t(`m20.oppStatus.${status}`)}</StatusPill>;
}

export function AppStepper({ status }: { status: string }) {
  const t = useT();
  const s = stepOf(status);
  return <Stepper steps={APP_STEPS.map((x) => ({ id: x, label: t(`m20.step.${x}`) }))} current={s.current} failedAt={s.failedAt} />;
}
export function AppTimeline({ app, name }: { app: App; name: (id: string | null) => string }) {
  const t = useT();
  const f = useFormat();
  const hist = ((app.history as unknown as HistoryEntry[]) ?? []).slice().reverse();
  return (
    <Timeline items={hist.map((h, i) => ({ id: `${h.at}-${i}`, when: f.dateTime(h.at), title: t(`m20.appStatus.${h.status}`), detail: <>{name(h.by)}{h.note ? <> · “{h.note}”</> : null}</>, tone: APP_TONE[h.status] ?? 'neutral' }))} />
  );
}

/** My level vs the needed level on each needed skill. */
export function NeededSkills({ ids, levelOf, label }: { ids: string[]; levelOf: (id: string) => number; label: (id: string) => string }) {
  const t = useT();
  if (!ids.length) return <p className="text-[13px] text-ink-3">{t('m20.detail.noPrereq')}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="m20-needed">
      {ids.map((id) => {
        const lv = levelOf(id);
        const okay = lv >= NEED_LEVEL;
        return (
          <li key={id} className={`chip ${okay ? 'border-ok-line bg-ok-bg text-ok' : 'border-sim-line bg-sim-bg text-sim'}`} title={t('m20.common.levelOf', { have: lv, need: NEED_LEVEL })}>
            <Icon name={okay ? 'check' : 'sparkle'} size={11} />
            {label(id)}
            <span className="num opacity-80">{lv}/{NEED_LEVEL}</span>
          </li>
        );
      })}
    </ul>
  );
}
export function GainedSkills({ ids, label }: { ids: string[]; label: (id: string) => string }) {
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="m20-gained">
      {ids.map((id) => (
        <li key={id} className="chip border-accent/30 bg-accent-soft text-eyebrow">
          <Icon name="plus" size={11} />
          {label(id)}
        </li>
      ))}
    </ul>
  );
}

export function Meta({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-2">
      <Icon name={icon} size={13} className="text-ink-3" />
      {children}
    </span>
  );
}

/** "12 Nov – 18 Dec 2026" in the reader's language. */
export function useRange() {
  const f = useFormat();
  return (a: string, b: string) => `${f.date(a)} – ${f.date(b)}`;
}
export function usePersonName() {
  const lang = useLang();
  const t = useT();
  return (app: App | null | undefined, id: string | null | undefined, roles?: (id: string | null | undefined) => string) => {
    if (!id) return t('m20.common.system');
    if (app && id === app.person_id) return lang === 'ar' ? app.applicant_name_ar || app.applicant_name : app.applicant_name;
    if (app && id === app.poster_id) return t('m20.common.poster');
    if (app && id === app.releaser_id) return app.skip_level ? t('m20.common.skipManager') : t('m20.common.lineManager');
    return roles ? roles(id) : t('m20.common.colleague');
  };
}

export const seatsLeft = (o: Opp) => Math.max(0, o.seats - (o.seats_taken ?? 0));

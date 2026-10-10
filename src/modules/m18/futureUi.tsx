/**
 * FS15 / FS16 shared UI (FS wave B · E5): hooks for concept-role readiness (rpc.futureRoleReadiness), transition evidence
 * (rpc.transitionEvidence) and role outlook labels (kafaa_role_outlook_labels, public; components staff-only), plus the
 * presentation pieces the Navigator, Roadmap, team view and the criteria page share. <RoleOutlookBadge roleId> is the drop-in
 * for other modules' career pages (label only for the public; staff see the components in "Why this label?").
 */
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../data';
import { Callout, Icon, ProgressRing, StatusPill, WhyThis, type PillTone } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { ConceptBand, ConceptReadiness, TransitionEvidence } from './futureRoles';
import { criteriaFor, labelReasons, thresholdsOf, type Components, type CriteriaRow, type OutlookLabel } from './outlookLabels';

// ───────────── FS15 hooks
/** Concept readiness for a person (null roleIds = every concept role); throws the refusal so <Async> shows the error state. */
export function useConceptReadiness(personId: string | null | undefined, roleIds: string[] | null, enabled = true) {
  const repo = useRepo();
  const key = roleIds == null ? '*' : [...new Set(roleIds)].sort().join(',');
  return useQuery(
    ['person_skills', 'career_targets', 'roadmaps', 'engine_settings', 'role_profile_versions', 'qual_records', 'licences'],
    async () => {
      if (!personId || !enabled || key === '') return new Map<string, ConceptReadiness>();
      const r = await repo.rpc.futureRoleReadiness(personId, key === '*' ? null : key.split(','));
      if (!r.ok) throw new Error(r.message);
      return new Map((r.data ?? []).map((x) => [x.role_id, x]));
    },
    [personId, key, enabled],
  );
}
/** Transition evidence from one role to each target (aggregates, suppressed under 10). Never throws: a refusal is an empty map. */
export function useTransitions(fromRoleId: string | null | undefined, toIds: string[]) {
  const repo = useRepo();
  const key = [...new Set(toIds)].sort().join(',');
  return useQuery(
    ['role_moves'],
    async () => {
      if (!fromRoleId || !key) return new Map<string, TransitionEvidence>();
      const r = await repo.rpc.transitionEvidence(fromRoleId, key.split(','));
      return new Map((r.ok ? r.data ?? [] : []).map((x) => [x.to_role_id, x]));
    },
    [fromRoleId, key],
  );
}

// ───────────── FS15 presentation
const CBAND_TONE: Record<ConceptBand, PillTone> = { profile_met: 'ok', within: 'info', stretch: 'sim' };
export function ConceptBandPill({ r }: { r: Pick<ConceptReadiness, 'band' | 'months'> }) {
  const t = useT();
  const f = useFormat();
  return (
    <span data-testid="m18-fs15-band" data-band={r.band}>
      <StatusPill tone={CBAND_TONE[r.band]}>{t(`m18.fs15.band.${r.band}`, { n: f.num(r.months) })}</StatusPill>
    </span>
  );
}
export function ConceptRing({ r, size = 56 }: { r: Pick<ConceptReadiness, 'pct' | 'band'>; size?: number }) {
  const f = useFormat();
  return <ProgressRing value={r.pct} size={size} tone={r.band === 'profile_met' ? 'ok' : r.band === 'stretch' ? 'sim' : 'accent'} label={f.pct(r.pct, 0)} />;
}
export function ConceptChip() {
  const t = useT();
  return <StatusPill tone="reserved"><span data-testid="m18-fs15-concept-chip">{t('m18.fs15.conceptChip')}</span></StatusPill>;
}
/** The banner every concept-role screen carries. */
export function ConceptBanner({ compact }: { compact?: boolean }) {
  const t = useT();
  return (
    <div data-testid="m18-fs15-banner">
      <Callout tone="sim" title={compact ? undefined : t('m18.fs15.banner.title')}>{t('m18.fs15.banner.body')}</Callout>
    </div>
  );
}

/** "How many colleagues made this move" line: count and median, or suppressed, or the concept-role analogue. */
export function TransitionNote({ ev, familyLabel }: { ev: TransitionEvidence | null | undefined; familyLabel?: string }) {
  const t = useT();
  const f = useFormat();
  if (!ev || ev.path_only) return null;
  let text: string;
  if (ev.concept) {
    text = !ev.analogue ? t('m18.fs15.tr.conceptNone') : ev.analogue.suppressed ? t('m18.fs15.tr.conceptSuppressed', { family: familyLabel ?? ev.analogue.family_id })
      : t('m18.fs15.tr.conceptAnalogue', { n: f.num(ev.analogue.n ?? 0), months: f.num(ev.analogue.median_months ?? 0), family: familyLabel ?? ev.analogue.family_id });
  } else text = ev.suppressed ? t('m18.fs15.tr.suppressed') : t('m18.fs15.tr.count', { n: f.num(ev.n ?? 0), months: f.num(ev.median_months ?? 0) });
  return (
    <div className="flex items-start gap-1.5 text-[12.5px] text-ink-2" data-testid="m18-fs15-transition" data-suppressed={ev.concept ? String(ev.analogue?.suppressed ?? true) : String(ev.suppressed)}>
      <Icon name="users" size={14} className="mt-0.5 shrink-0 text-ink-3" />
      <span>{text}</span>
    </div>
  );
}

// ───────────── FS16 hooks and presentation
export interface OutlookRow { id: string; role_id: string; year: number; label: OutlookLabel; criteria_id: string; archived: boolean; as_of: string }
export interface OutlookData { labels: OutlookRow[]; components: Map<string, Components>; criteria: (CriteriaRow & Record<string, unknown>)[]; years: number[]; current: number }
/** Labels and criteria (public) and the components (staff only: the repository returns none to others). */
export function useOutlookData() {
  const repo = useRepo();
  return useQuery(['role_outlook_labels', 'role_outlook_components', 'role_outlook_criteria'], async () => {
    const [labels, comps, criteria] = await Promise.all([
      repo.list('role_outlook_labels', { order: [['year', 'asc']] }),
      repo.list('role_outlook_components'),
      repo.list('role_outlook_criteria', { order: [['version', 'asc']] }),
    ]);
    const years = [...new Set(labels.map((l) => Number(l.year)))].sort((a, b) => a - b);
    return {
      labels: labels as unknown as OutlookRow[],
      components: new Map(comps.map((c) => [c.id, c.components as unknown as Components])),
      criteria: criteria as unknown as OutlookData['criteria'],
      years,
      current: years[years.length - 1] ?? new Date().getUTCFullYear(),
    } satisfies OutlookData;
  }, []);
}

export const LABEL_TONE: Record<OutlookLabel, PillTone> = { growing: 'ok', changing: 'info', stable: 'neutral' };
export const LABEL_ICON: Record<OutlookLabel, string> = { growing: 'chart', changing: 'sparkle', stable: 'check' };

/** One label chip; with components (staff) it also explains itself. */
export function OutlookChip({ row, components, criteria, withWhy = true }: { row: Pick<OutlookRow, 'label' | 'year' | 'criteria_id'>; components?: Components | null; criteria?: CriteriaRow[]; withWhy?: boolean }) {
  const t = useT();
  const f = useFormat();
  const crit = criteria?.find((c) => c.id === row.criteria_id) ?? (criteria ? criteriaFor(criteria, row.year) : null);
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="m18-fs16-label" data-label={row.label}>
      <StatusPill tone={LABEL_TONE[row.label]}>{t(`m18.fs16.label.${row.label}`)}{' · '}<span className="num">{f.num(row.year, { useGrouping: false })}</span></StatusPill>
      {withWhy && components && crit && <WhyThis reasons={labelReasons(components, thresholdsOf(crit), row.label)} label={t('m18.fs16.why')} testId="m18-fs16-why" />}
    </span>
  );
}

/** Drop-in for career pages: the role's current label (public: label only; staff: with its components). */
export function RoleOutlookBadge({ roleId, withWhy = true }: { roleId: string; withWhy?: boolean }) {
  const q = useOutlookData();
  const d = q.data;
  if (!d) return null;
  const row = d.labels.filter((l) => l.role_id === roleId).sort((a, b) => b.year - a.year)[0];
  if (!row) return null;
  return <OutlookChip row={row} components={d.components.get(row.id) ?? null} criteria={d.criteria} withWhy={withWhy} />;
}

/** FS wave-B integration: the role's current FS16 label with a link to the published criteria (career pages, My Role 2030).
 * Renders nothing for roles without a label (concept, security, safeguards and cyber roles). */
export function RoleOutlookLine({ roleId }: { roleId: string }) {
  const t = useT();
  const cur = useCurrentLabels();
  const row = cur?.byRole.get(roleId);
  if (!cur || !row) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]" data-testid="m18-fs16-line">
      <span className="caps">{t('m18.wb.outlook')}</span>
      <OutlookChip row={row} components={cur.d.components.get(row.id) ?? null} criteria={cur.d.criteria} />
      <L to="/careers/outlook-criteria" data-testid="m18-fs16-criteria-link">{t('m18.wb.criteria')}</L>
    </div>
  );
}

/** Label for each role in the latest year (map role -> row). */
export function useCurrentLabels() {
  const q = useOutlookData();
  return useMemo(() => {
    const d = q.data;
    if (!d) return null;
    return { byRole: new Map(d.labels.filter((l) => l.year === d.current).map((l) => [l.role_id, l])), d };
  }, [q.data]);
}

/** Staff view check: components are readable (transformation R). */
export function useSeesComponents() {
  const s = useSession();
  return s.can('transformation', ['R', 'W', 'A']);
}

/** A family id as a readable label (job families table). */
export function useFamilyLabels() {
  const repo = useRepo();
  const pick = usePick();
  const q = useQuery(['job_families'], () => repo.list('job_families'), []);
  return (id: string | null | undefined) => {
    const r = q.data?.find((x) => x.id === id);
    return r ? pick(r, 'name') : id ?? '';
  };
}

/** Job roles by id (public read): titles and families for label tables. */
export function useRolesById() {
  const repo = useRepo();
  return useQuery(['job_roles'], async () => new Map((await repo.list('job_roles', { order: [['sort', 'asc']] })).map((r) => [r.id, r])), []);
}

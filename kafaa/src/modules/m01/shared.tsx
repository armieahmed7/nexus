/** M01 shared pieces: one data hook for the career map and the role badges (basis, regulated, entry, reserved). */
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import type { RowOf } from '../../data';
import { StatusPill, SourceLink, Icon } from '../../ui';
import { useFormat, usePick } from '../../i18n';
import { useT, useLang, useI18n, L } from '../../i18n';
import { conds, edgeMonths, type PathEdge } from './careerGraph';

export type Role = RowOf<'job_roles'>;
export type Family = RowOf<'job_families'>;
export type Edge = RowOf<'career_paths'> & PathEdge;
export type SourceRef = { id: string; label: string; url: string };

export const GROUPS = ['operations', 'maintenance_engineering', 'rp_chem_env', 'safety_quality_oversight', 'ep_security_safeguards', 'training_supply_corporate'] as const;
export const LEVELS = ['entry', 'professional', 'senior', 'leadership'] as const;
export const EDUCATION = ['high_school', 'diploma', 'bachelor', 'master'] as const;

/** Roles, families, progression edges and the citation registry in one round trip (all public reads). */
export function useCareerData() {
  const repo = useRepo();
  return useQuery(['job_roles', 'job_families', 'career_paths', 'sources'], async () => {
    const [roles, families, paths, sources] = await Promise.all([
      repo.list('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }),
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('career_paths', { order: [['sort', 'asc']] }),
      repo.list('sources'),
    ]);
    // FS05: concept future roles and 'future' edges are kept apart, so the existing views show today's map unchanged.
    const current = roles.filter((r) => r.lifecycle !== 'concept');
    const concepts = roles.filter((r) => r.lifecycle === 'concept');
    const edges = paths as Edge[];
    return {
      roles: current,
      concepts,
      families,
      paths: edges.filter((e) => e.kind !== 'future'),
      futurePaths: edges.filter((e) => e.kind === 'future'),
      sources,
      roleById: new Map(current.map((r) => [r.id, r])),
      conceptById: new Map(concepts.map((r) => [r.id, r])),
      anyRoleById: new Map(roles.map((r) => [r.id, r])),
      familyById: new Map(families.map((f) => [f.id, f])),
      sourceById: new Map(sources.map((s) => [s.id, s])),
    };
  });
}
export type CareerData = NonNullable<ReturnType<typeof useCareerData>['data']>;

export function BasisBadge({ basis }: { basis: string }) {
  const t = useT();
  const tone = basis === 'barakah' ? 'ok' : basis === 'generic' ? 'info' : 'sim';
  return (
    <span title={t(`m01.basis.${basis}Hint`)}>
      <StatusPill tone={tone}>{t(`m01.basis.${basis}`)}</StatusPill>
    </span>
  );
}

export function RoleBadges({ role, compact }: { role: Role; compact?: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="role-badges">
      <BasisBadge basis={role.basis} />
      {role.regulated && (
        <StatusPill tone="accent">
          <Icon name="shield" size={12} className="me-1 inline" />
          {t('m01.badge.regulated')}
        </StatusPill>
      )}
      {role.entry_level && <StatusPill tone="info">{t('m01.badge.entry')}</StatusPill>}
      {role.emiratization_reserved && <StatusPill tone="reserved">{t('m01.badge.reserved')}</StatusPill>}
      {role.security_sensitive && !compact && <StatusPill tone="neutral">{t('m01.badge.careerOnly')}</StatusPill>}
    </div>
  );
}

/** Conditions on a progression edge, as a list of bilingual strings. */
/** Direction-aware arrow for "from -> to" labels. */
export function useArrow() {
  return useI18n().dir === 'rtl' ? '←' : '→';
}

export function useConditionText() {
  const lang = useLang();
  return (e: Pick<PathEdge, 'conditions'>) => conds(e).map((c) => (lang === 'ar' && c.ar ? c.ar : c.en));
}

export function RoleLink({ role, children }: { role: Pick<Role, 'id'>; children?: ReactNode }) {
  return <L to={`/careers/roles/${role.id}`}>{children}</L>;
}

/** The sources a role cites, with the citation registry's "accessed" date as the as-of date. */
export function RoleSources({ role, data }: { role: Role; data: CareerData }) {
  const list = (Array.isArray(role.sources) ? (role.sources as SourceRef[]) : []).filter((s) => s && s.url);
  return (
    <ul className="space-y-1" data-testid="role-sources">
      {list.map((s) => (
        <li key={s.id}>
          <SourceLink href={s.url} date={data.sourceById.get(s.id)?.accessed ?? null}>
            {s.label}
          </SourceLink>
        </li>
      ))}
    </ul>
  );
}

/** Standard source footer for public career pages. */
export function CareerSourcesFooter({ data, ids }: { data: CareerData; ids: string[] }) {
  const t = useT();
  return (
    <div className="border-t border-line pt-3 text-[12.5px] text-ink-2" data-testid="sources-footer">
      <div className="caps mb-1">{t('m01.sources')}</div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {ids
          .map((id) => data.sourceById.get(id))
          .filter(Boolean)
          .map((s) => (
            <li key={s!.id}>
              <SourceLink href={s!.url} date={s!.accessed}>
                {s!.label}
              </SourceLink>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** One progression edge: target (or entry label), type, indicative months, structured conditions, rule reference. */
export function EdgeCard({ edge, to, title, conds }: { edge: Edge; to?: Role; title?: string; conds: string[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const m = edgeMonths(edge);
  return (
    <div className="rounded-card border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{to ? <L to={`/careers/roles/${to.id}`}>{pick(to, 'title')}</L> : title}</div>
        <div className="flex gap-1.5">
          <StatusPill tone={edge.type === 'vertical' ? 'accent' : edge.type === 'entry' ? 'info' : 'neutral'}>{t(`m01.edgeType.${edge.type}`)}</StatusPill>
          {m > 0 && <StatusPill tone="neutral">{t('m01.months', { n: f.num(m) })}</StatusPill>}
        </div>
      </div>
      <div className="text-[12.5px] text-ink-2">{pick(edge, 'label')}</div>
      {conds.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
          {conds.map((c, i) => (
            <li key={i} className="flex gap-1.5">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-accent" />
              {c}
            </li>
          ))}
        </ul>
      )}
      {edge.rule_ref && <div className="mt-1.5 text-[11.5px] text-ink-3">{pick(edge, 'rule_ref')}</div>}
    </div>
  );
}


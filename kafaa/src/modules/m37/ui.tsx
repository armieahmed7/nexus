// M37 shared UI (FS62 national-strategy alignment, FS63 MoHRE occupation mapping): reference-data hooks, tier and status pills, source
// lists, measure cells (suppressed under 10), item links that only point where the viewer may go, and the "not an authority" callouts.
// Module-local; pages import from here.
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import type { Level, Resource } from '../../auth/policy';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Callout, Icon, SimChip, SourceLink, StatusPill, type PillTone } from '../../ui';
import { STRATEGIES, tagSourceView, type Measure, type ReportItem, type TagRow, type TagSource } from './national';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;
const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);

/** Tags and curated links (national_alignment R). */
export function useNaRef() {
  const repo = useRepo();
  return useQuery(['national_tags', 'tag_links'], async () => {
    const [tags, links] = await Promise.all([safe(repo.list('national_tags' as never)), safe(repo.list('tag_links' as never))]);
    const order = (t: Row) => [STRATEGIES.indexOf(t.strategy), t.parent_id ? 1 : 0, Number(t.sort)];
    const sorted = (tags as TagRow[]).sort((a, b) => { const x = order(a); const y = order(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || (a.id < b.id ? -1 : 1); });
    return { tags: sorted, links: links as Row[] };
  }, []);
}
export type NaRef = NonNullable<ReturnType<typeof useNaRef>['data']>;

export const STRATEGY_ICON: Record<string, string> = { nes_2031: 'briefcase', we_uae_2031: 'users', ai_2031: 'sparkle', net_zero_2050: 'globe', jahiz: 'grad', centennial_2071: 'calendar' };
export const TIER_TONE: Record<string, PillTone> = { official: 'ok', intergovernmental: 'info', secondary: 'sim' };

export function TierPill({ tier, testId }: { tier: string; testId?: string }) {
  const t = useT();
  return <span data-testid={testId} data-tier={tier}><StatusPill tone={TIER_TONE[tier] ?? 'neutral'}>{t(`m37.tier.${tier}`)}</StatusPill></span>;
}

/** The tag's source standing: the primary (most official) source, its tier, and a visible flag with the reason when it is not official or indirect. */
export function SourceStanding({ tag, compact = false }: { tag: TagRow; compact?: boolean }) {
  const t = useT();
  const pick = usePick();
  const v = tagSourceView(tag.sources ?? [], tag.source_scope);
  if (!v) return <StatusPill tone="bad">{t('m37.src.none')}</StatusPill>;
  return (
    <div className="space-y-1.5" data-testid="m37-source-standing" data-flagged={v.flagged ? 'true' : 'false'} data-tier={v.best_tier}>
      <div className="flex flex-wrap items-center gap-1.5">
        <TierPill tier={v.best_tier} />
        {tag.source_scope === 'indirect' && <StatusPill tone="sim">{t('m37.src.indirect')}</StatusPill>}
        {v.flagged && <span className="chip border-transparent bg-sim-bg normal-case tracking-normal text-sim" data-testid="m37-source-flag"><Icon name="alert" size={12} />{t('m37.src.recheck')}</span>}
      </div>
      {!compact && <div className="text-[12.5px]"><SourceLink href={v.primary.url} date={v.primary.as_of}>{v.primary.label}</SourceLink></div>}
      {!compact && v.flagged && pick(tag, 'source_note') && <p className="text-[12.5px] text-ink-2" data-testid="m37-source-note">{pick(tag, 'source_note')}</p>}
    </div>
  );
}

export function SourceList({ sources, testId = 'm37-sources' }: { sources: TagSource[]; testId?: string }) {
  return (
    <ul className="space-y-1.5 text-[13px]" data-testid={testId}>
      {sources.map((s) => (
        <li key={s.url} className="flex flex-wrap items-center gap-2" data-tier={s.tier}>
          <TierPill tier={s.tier ?? 'secondary'} />
          <SourceLink href={s.url} date={s.as_of}>{s.label}</SourceLink>
        </li>
      ))}
    </ul>
  );
}

/** A count or share from the report: suppressed under 10 (never a value), "—" when measures are not visible. */
export function MeasureCell({ m, testId }: { m: Measure | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  if (!m) return <span className="text-ink-3" data-testid={testId}>—</span>;
  const sup = <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
  const share = m.kind === 'org_share' || m.kind === 'family_share';
  return (
    <span className="inline-flex flex-col items-end gap-0.5 text-end" data-testid={testId} data-kind={m.kind} data-n={m.n ?? ''}>
      <span className="num font-semibold">{share ? (m.pct == null ? sup : f.pct(m.pct)) : m.n == null ? sup : f.num(m.n)}</span>
      <span className="text-[11.5px] text-ink-3">{t(`m37.measure.${m.kind}`, { target: m.target == null ? '—' : f.num(m.target), due: m.due_on ? f.date(m.due_on) : '—' })}</span>
    </span>
  );
}

const ACAD: Record<string, string> = { 'pg-acad-ai': 'ac-ai', 'pg-acad-twin': 'ac-twin', 'pg-acad-smr': 'ac-smr', 'pg-acad-energy': 'ac-energy' };
/** Where a linked row lives in Kafa'a, and the grant needed to open it (no dead ends). */
export function hrefFor(i: Pick<ReportItem, 'target_table' | 'target_id' | 'title_en'>): { to: string; res?: Resource; levels?: Level[] } | null {
  switch (i.target_table) {
    case 'skills': return { to: `/skills/${i.target_id}` };
    case 'cec_competences': return { to: `/skills/clean-energy/${i.target_id}` };
    case 'programmes': return ACAD[i.target_id] ? { to: `/learn/academies/${ACAD[i.target_id]}` } : i.target_id === 'pg-fs-pack' ? { to: '/learn/future-skills' } : null;
    case 'pathways': return { to: `/learn/pathways/${i.target_id}`, res: 'internal_content', levels: ['R'] };
    case 'microcred_defs': return { to: `/my/skills/credentials/c/${String(i.title_en).split(' ')[0]}`, res: 'skills_profile', levels: ['Own'] };
    case 'talent_programmes': return { to: `/pathways/${i.target_id}` };
    case 'leadership_programmes': return { to: `/leadership/programmes/${i.target_id}`, res: 'internal_content', levels: ['R'] };
    case 'critical_skills': return { to: `/workforce/critical-skills/${i.target_id}`, res: 'workforce_strategy', levels: ['Agg', 'R', 'W', 'A'] };
    case 'ai_org_targets': return { to: '/workforce/ai-fluency', res: 'ai_literacy', levels: ['Agg'] };
    case 'cec_role_targets': return { to: '/skills/clean-energy' };
    default: return null;
  }
}

export function ItemLink({ item, children }: { item: ReportItem; children?: ReactNode }) {
  const pick = usePick();
  const s = useSession();
  const h = hrefFor(item);
  const label = children ?? pick(item as Row, 'title');
  if (!h || (h.res && !s.can(h.res, h.levels ?? ['R']))) return <span>{label}</span>;
  return <L to={h.to} data-testid="m37-item-link">{label}</L>;
}

export const STATUS_TONE: Record<string, PillTone> = { active: 'ok', inactive: 'sim', missing: 'bad' };
export const BASIS_TONE: Record<string, PillTone> = { curated: 'accent', future_group: 'info', net_zero: 'info' };

export function NotGovernmentCallout() {
  const t = useT();
  return <Callout tone="info" title={t('m37.na.notGov.title')}><span data-testid="m37-not-gov">{t('m37.na.notGov.body')}</span></Callout>;
}
export function NotMohreCallout() {
  const t = useT();
  return <Callout tone="sim" title={t('m37.ro.notMohre.title')}><span data-testid="m37-not-mohre">{t('m37.ro.notMohre.body')}</span></Callout>;
}
export function Simulated({ label }: { label?: string }) {
  const t = useT();
  return <SimChip label={label ?? t('m37.simulated')} />;
}

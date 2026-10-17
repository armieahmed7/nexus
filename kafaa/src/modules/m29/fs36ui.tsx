// FS36 AI-literacy register + FS37 sandbox drills: shared module-local UI (data hooks, chips, coverage bar, measure links).
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BenchmarkLine, Icon, SimChip, StatusPill, WhyThis } from '../../ui';
import { THRESHOLD, coverageReasons, type GroupCoverage, type SystemCoverage } from './register';
import { RungPill, type Row } from './ui';

export const FS36 = ['AI-LIT', 'UAE-AI'];
export const FS37 = ['IAEA-AI', 'AI-LIT', 'UAE-PEERS'];

/** Register rows the caller may read (RLS: published for staff, drafts for admin/auditors) plus families, cells and the coverage RPC. */
export function useRegister() {
  const repo = useRepo();
  return useQuery(['ai_systems', 'ai_system_users', 'person_skills', 'ai_rungs', 'job_families'], async () => {
    const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);
    const [systems, groups, families, cells, cov] = await Promise.all([
      safe(repo.list('ai_systems' as never, { order: [['sort', 'asc']] } as never)), safe(repo.list('ai_system_users' as never, { order: [['sort', 'asc']] } as never)),
      safe(repo.list('job_families')), safe(repo.list('ai_rungs' as never)), repo.rpc.aiLiteracyCoverage().catch(() => null),
    ]);
    return { systems: systems as Row[], groups: (groups as Row[]).filter((g) => g.active), families: families as Row[], cells: cells as Row[], cov };
  }, []);
}
export type RegisterData = NonNullable<ReturnType<typeof useRegister>['data']>;

export function MaturityPill({ maturity }: { maturity: string }) {
  const t = useT();
  const tone = maturity === 'full' ? 'ok' : maturity === 'partial' ? 'info' : 'neutral';
  return <StatusPill tone={tone}><span data-testid="m29-reg-maturity" data-maturity={maturity}>{t(`m29.reg.maturity.${maturity}`)}</span></StatusPill>;
}
export function RoleChip({ role }: { role: string }) {
  const t = useT();
  return <span className={`chip normal-case tracking-normal ${role === 'provider' ? 'border-transparent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} data-testid="m29-reg-role">{t(`m29.reg.role.${role}`)}</span>;
}
export function UseClassChip({ use }: { use: string }) {
  const t = useT();
  return <span className="chip border-line bg-panel normal-case tracking-normal text-ink-2"><Icon name="shield" size={12} /> {t(`m29.reg.use.${use}`)}</span>;
}
export function SystemChips({ s }: { s: Row }) {
  const t = useT();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <RoleChip role={s.ai_role} />
      <UseClassChip use={s.use_class} />
      <MaturityPill maturity={s.maturity} />
      {s.simulated && <SimChip label={t('m29.reg.simulated')} />}
      {s.status !== 'published' && <StatusPill status={s.status} />}
    </span>
  );
}

/** Coverage of a system or group: a bar with the 80% line, or "suppressed". */
export function CoverageBar({ c, label, compact }: { c: { pct: number | null; n: number | null } | null | undefined; label: string; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  if (!c) return <span className="text-[12.5px] text-ink-3" data-testid="m29-reg-nocov">{t('m29.reg.cov.hidden')}</span>;
  if (c.pct == null) return <span className="chip border-line bg-sunken normal-case tracking-normal text-ink-3" data-testid="m29-reg-suppressed" title={t('common.suppressed')}>{t('m29.reg.cov.suppressed')}</span>;
  return (
    <div data-testid="m29-reg-cov" data-pct={c.pct}>
      <BenchmarkLine value={c.pct} max={100} unit="pct" label={label} compact={compact} lines={[{ kind: 'target', label: t('m29.reg.cov.threshold', { pct: f.pct(THRESHOLD, 0) }), value: THRESHOLD }]} />
    </div>
  );
}

export function LabelCheck({ sc }: { sc: SystemCoverage | undefined }) {
  const t = useT();
  if (!sc || sc.label_ok == null) return null;
  return sc.label_ok
    ? <StatusPill tone="ok"><span data-testid="m29-reg-label-ok">{t('m29.reg.label.ok')}</span></StatusPill>
    : <StatusPill tone="bad"><span data-testid="m29-reg-label-low">{t('m29.reg.label.low')}</span></StatusPill>;
}
export function CoverageWhy({ sc }: { sc: SystemCoverage | undefined }) {
  const t = useT();
  if (!sc) return null;
  return <WhyThis reasons={coverageReasons(sc)} label={t('m29.reg.cov.why')} testId="m29-reg-why" />;
}

export function GroupRequirement({ g, cells }: { g: Row; cells: Row[] }) {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RungPill rung={Number(g.required_rung)} />
      {(g.required_cells ?? []).map((id: string) => {
        const c = cells.find((x) => x.id === id);
        return <StatusPill key={id} tone="accent">{c ? t('m29.target.plus', { rung: t(`m29.rung.${c.rung_key}`), dim: t(`m29.dim.${c.dimension}`) }) : id}</StatusPill>;
      })}
    </span>
  );
}
export function GroupWho({ g, families }: { g: Row; families: Row[] }) {
  const t = useT();
  const pick = usePick();
  if (g.all_staff) return <span>{t('m29.reg.allStaff')}</span>;
  return <span>{(g.family_ids ?? []).map((id: string) => { const f = families.find((x) => x.id === id); return f ? pick(f, 'name') : id; }).join(' · ')}</span>;
}
export function Gaps({ gc, cells }: { gc: GroupCoverage | undefined; cells: Row[] }) {
  const t = useT();
  const f = useFormat();
  if (!gc || !gc.gaps.length) return <span className="text-ink-3">—</span>;
  return (
    <ul className="space-y-0.5 text-[12.5px]" data-testid="m29-reg-gaps">
      {gc.gaps.map((x) => {
        const c = cells.find((y) => y.id === x.cell_id);
        return <li key={x.cell_id}>{c ? `${t(`m29.rung.${c.rung_key}`)} · ${t(`m29.dim.${c.dimension}`)}` : x.cell_id} <span className="text-ink-3">({x.n == null ? t('common.suppressedShort') : f.num(x.n)})</span></li>;
      })}
    </ul>
  );
}

export function MeasureLink({ m }: { m: Row }) {
  const pick = usePick();
  const icon = m.kind === 'course' ? 'book' : m.kind === 'check' ? 'check' : m.kind === 'drill' ? 'alert' : 'sparkle';
  const to = m.kind === 'ladder' ? '/learn/ai-fluency' : m.kind === 'check' ? '/my/ai-fluency/check' : m.kind === 'drill' ? '/my/ai-fluency/drills' : m.kind === 'course' && m.ref ? `/learn/course/${m.ref}` : null;
  const body: ReactNode = to ? <L to={to}>{pick(m, 'title')}</L> : <span>{pick(m, 'title')}</span>;
  return <li className="flex items-start gap-2 text-[13px]"><Icon name={icon} size={14} className="mt-0.5 shrink-0 text-accent" /><span className="min-w-0">{body}</span></li>;
}

/** Drill difficulty as three dots. */
export function Difficulty({ n }: { n: number }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={t('m29.dr.difficulty', { n })} title={t('m29.dr.difficulty', { n })}>
      {[1, 2, 3].map((i) => <span key={i} className={`h-2 w-2 rounded-full ${i <= n ? 'bg-[rgb(var(--accent))]' : 'bg-sunken border border-line'}`} />)}
    </span>
  );
}

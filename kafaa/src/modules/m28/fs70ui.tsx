// FS70/FS71/FS72 shared pieces for the M28 wave-H pages: reference data (skills, job families, roles, technologies), the signal cell, the
// category and status pills, the quarter picker and the published-criteria boxes. Strings: m28.rs.*, m28.ht.*, m28.ssg.*.
import { useCallback, type ReactNode } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Result } from '../../data/types';
import { hasKey, useFormat, usePick, useT, L } from '../../i18n';
import { Icon, StatusPill, WhyThis, type PillTone } from '../../ui';
import { GROWTH_PCT, HIRE_WINDOW_DAYS, LIST_MAX, MIN_SIGNAL, type SignalCell } from './signals';
import { HOT, IN_DEMAND } from './technologies';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface Ref { skills: Map<string, Row>; families: Map<string, Row>; roles: Map<string, Row>; technologies: Row[] }

/** Skills, job families, roles and technologies: one query, both backends (all readable by staff). */
export function useRef70() {
  const repo = useRepo();
  return useQuery(['skills', 'job_families', 'job_roles', 'technologies'], async (): Promise<Ref> => {
    const [skills, families, roles, technologies] = await Promise.all([
      repo.list('skills') as Promise<Row[]>, repo.list('job_families') as Promise<Row[]>, repo.list('job_roles') as Promise<Row[]>,
      (repo.list('technologies' as never, { order: [['sort', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { skills: new Map(skills.map((s) => [s.id, s])), families: new Map(families.map((f) => [f.id, f])), roles: new Map(roles.map((r) => [r.id, r])), technologies };
  });
}

export function SkillLink({ id, r }: { id: string; r: Ref }) {
  const pick = usePick();
  const s = r.skills.get(id);
  return <L to={`/skills/${id}`} className="font-semibold">{s ? pick(s, 'name') : id}</L>;
}

const CAT_TONE: Record<string, PillTone> = { now: 'accent', growing: 'ok' };
export function CategoryPill({ c }: { c: string }) {
  const t = useT();
  return <StatusPill tone={CAT_TONE[c] ?? 'neutral'}>{t(`m28.rs.cat.${c}`)}</StatusPill>;
}

/** One signal: its value, the change against the previous quarter, or "suppressed" under 10. */
export function SignalCellView({ c }: { c: SignalCell }) {
  const t = useT();
  const f = useFormat();
  const tone = c.moved ? 'border-accent/40 bg-accent/5' : 'border-line bg-panel';
  return (
    <div className={`min-w-0 rounded-card border px-2.5 py-2 ${tone}`} data-testid="m28-rs-signal" data-key={c.key} data-value={c.value ?? ''} data-moved={c.moved ? '1' : '0'}>
      <div className="caps truncate">{t(`m28.rs.sig.${c.key}`)}</div>
      {c.value == null
        ? <div className="text-[13px] text-ink-3" title={t('m28.rs.suppressedHelp', { n: MIN_SIGNAL })}>{t('m28.rs.suppressed')}</div>
        : <div className="flex flex-wrap items-baseline gap-x-1.5"><span className="text-[17px] font-semibold tabular-nums">{f.num(c.value)}</span>
          {c.change_pct != null && <span className={`text-[12px] ${c.change_pct >= 0 ? 'text-ok' : 'text-bad'}`}>{c.change_pct >= 0 ? '+' : ''}{f.num(c.change_pct)}%</span>}
          {c.prev == null && c.moved && c.key !== 'demand' && <span className="text-[12px] text-ok">{t('m28.rs.newSignal')}</span>}</div>}
      <div className="text-[11.5px] text-ink-3">{c.moved ? t('m28.rs.moved') : c.value == null ? t('m28.rs.notCounted') : t('m28.rs.notMoved')}</div>
    </div>
  );
}

export function QuarterPicker({ quarters, value, onChange, testId }: { quarters: string[]; value: string; onChange: (q: string) => void; testId: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="flex min-w-0 max-w-full flex-wrap gap-2" role="group" aria-label={t('m28.rs.quarter')} data-testid={testId}>
      {quarters.map((q) => (
        <button key={q} type="button" className={`btn-sm ${q === value ? 'btn-primary' : 'btn-outline'}`} aria-pressed={q === value} onClick={() => onChange(q)} data-quarter={q}>
          {t('m28.rs.quarterLabel', { y: f.num(Number(q.slice(0, 4)), { useGrouping: false }), q: f.num(Number(q.slice(6))) })}
        </button>
      ))}
    </div>
  );
}
export function useQuarterLabel() {
  const t = useT();
  const f = useFormat();
  return (q: string) => (q ? t('m28.rs.quarterLabel', { y: f.num(Number(q.slice(0, 4)), { useGrouping: false }), q: f.num(Number(q.slice(6))) }) : '');
}

/** The published FS70 counting rules (numbers come from the rule constants). */
export function SignalRules({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  const items: [string, ReactNode][] = [
    ['goals_profiles', t('m28.sm.goals_profiles')], ['recent_hires', t('m28.sm.recent_hires', { days: f.num(HIRE_WINDOW_DAYS) })], ['demand', t('m28.sm.demand')],
  ];
  return (
    <div className="space-y-3" data-testid="m28-sm-rules">
      <ul className="space-y-2">
        {items.map(([k, v]) => (
          <li key={k} className="rounded-card border border-line bg-panel p-3" data-signal={k}>
            <div className="font-semibold">{t(`m28.rs.sig.${k}`)}</div>
            <p className="text-[13px] text-ink-2">{v}</p>
          </li>
        ))}
      </ul>
      {!compact && (
        <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
          <li>{t('m28.sm.suppress', { n: f.num(MIN_SIGNAL) })}</li>
          <li>{t('m28.sm.now')}</li>
          <li>{t('m28.sm.growing', { pct: f.num(GROWTH_PCT) })}</li>
          <li>{t('m28.sm.max', { n: f.num(LIST_MAX) })}</li>
          <li>{t('m28.sm.never')}</li>
          <li>{t('m28.sm.kept')}</li>
        </ul>
      )}
    </div>
  );
}

/** The published FS71 badge criteria (numbers come from the rule constants). */
export function BadgeCriteria() {
  const t = useT();
  const f = useFormat();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m28-ht-criteria">
      <div className="rounded-card border border-line bg-panel p-3">
        <div className="mb-1 font-semibold">{t('m28.ht.hot')}</div>
        <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
          <li>{t('m28.ht.c.window', { n: f.num(HOT.window_quarters) })}</li>
          <li>{t('m28.ht.c.sources', { n: f.num(HOT.min_sources) })}</li>
          <li>{t('m28.ht.c.families', { n: f.num(HOT.min_families) })}</li>
          <li>{t('m28.ht.c.recent', { n: f.num(HOT.min_recent) })}</li>
        </ul>
      </div>
      <div className="rounded-card border border-line bg-panel p-3">
        <div className="mb-1 font-semibold">{t('m28.ht.inDemand')}</div>
        <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
          <li>{t('m28.ht.c.profile')}</li>
          <li>{t('m28.ht.c.family', { n: f.num(IN_DEMAND.min_family_opportunities) })}</li>
          <li>{t('m28.ht.c.kept')}</li>
        </ul>
      </div>
    </div>
  );
}

const SSG_TONE: Record<string, PillTone> = { open: 'info', confirmed: 'ok', rejected: 'neutral', not_me: 'neutral', expired: 'sim' };
export function SuggestionStatus({ s }: { s: string }) {
  const t = useT();
  return <StatusPill tone={SSG_TONE[s] ?? 'neutral'}>{t(`m28.ssg.status.${s}`)}</StatusPill>;
}

/** Run a write and toast it in the reader's language: success text given by the page; a refusal reads m28.err.<area>.<code> when that
 *  key exists (both backends return the same codes), else the backend's message. */
export function useRun28(area: 'rs' | 'mp' | 'ht' | 'ssg') {
  const t = useT();
  const run = useAction();
  return useCallback(<T,>(fn: () => Promise<Result<T>>, success: string) => run(async () => {
    const r = await fn();
    if (r.ok) return { ...r, message: success };
    const k = `m28.err.${area}.${r.code}`;
    return hasKey(k) ? { ...r, message: t(k) } : r;
  }), [run, t, area]);
}

/** One listed skill on a Skills on the Rise list (published or a workbench preview): rank, category, the three signals, what moved it,
 *  its job families and <WhyThis>. */
export function SignalCard({ x, r }: { x: Row; r: Ref }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cells = (x.signals ?? []) as SignalCell[];
  return (
    <li className="min-w-0 rounded-card border border-line bg-panel p-4" data-testid="m28-rs-row" data-skill={x.skill_id} data-category={x.category} data-moved={(x.moved_by ?? []).join(',')}>
      <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="caps me-2">{t('m28.rs.rank', { n: f.num(Number(x.rank)) })}</span>
          <SkillLink id={x.skill_id} r={r} />
        </div>
        <div className="flex flex-wrap items-center gap-2"><CategoryPill c={x.category} /><WhyThis reasons={x.reasons ?? []} testId="m28-rs-why" /></div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{cells.map((c) => <SignalCellView key={c.key} c={c} />)}</div>
      <p className="mt-2 text-[12.5px] text-ink-2" data-testid="m28-rs-movedby">
        <Icon name="chart" size={13} className="me-1 inline" />{t('m28.rs.movedBy', { list: (x.moved_by ?? []).map((k: string) => t(`m28.rs.sig.${k}`)).join(t('m28.rs.sep')) })}
      </p>
      {(x.families ?? []).length > 0 && (
        <div className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label={t('m28.rs.families')}>
          {(x.families as string[]).slice(0, 6).map((fid) => <span key={fid} className="chip max-w-full whitespace-normal break-words">{pick(r.families.get(fid) ?? { name_en: fid, name_ar: fid }, 'name')}</span>)}
          {(x.families as string[]).length > 6 && <span className="chip">{t('m28.rs.more', { n: f.num((x.families as string[]).length - 6) })}</span>}
        </div>
      )}
    </li>
  );
}

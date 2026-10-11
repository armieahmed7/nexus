// F32 shared UI (W5 · E1): micro-credential medal, status pill, criteria checklist with evidence, the eligibility reasons for
// <WhyThis>, and the data hook used by /my/skills/credentials and the /admin/frameworks "Micro-credentials" tab.
import type { ReactNode } from 'react';
import { StatusPill, Icon, ProgressBar } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import type { Reason } from '../../domain/engines/types';
import { awardView, type AwardRow, type AwardView, type CritResult, type DefRow, type Eligibility } from './microcred';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export const MC_TONE: Record<string, 'ok' | 'bad' | 'info' | 'sim' | 'neutral' | 'accent'> = {
  active: 'ok', renewal_due: 'sim', expired: 'bad', revoked: 'bad', superseded: 'neutral', pending_approval: 'info', declined: 'bad', eligible: 'accent', none: 'neutral', progress: 'neutral',
};
export function McStatusPill({ status }: { status: AwardView | 'eligible' | 'progress' | 'none' }) {
  const t = useT();
  return <StatusPill tone={MC_TONE[status] ?? 'neutral'} status={status}>{t(`m17.mc.status.${status}`)}</StatusPill>;
}

/** Hexagon medal with stacked rings for stacked credentials. */
export function McMedal({ code, status, stack, size = 56 }: { code: string; status: string; stack?: boolean; size?: number }) {
  const tone = status === 'active' ? 'var(--accent)' : status === 'renewal_due' || status === 'eligible' ? 'var(--sim)' : status === 'expired' || status === 'revoked' ? 'var(--bad)' : 'var(--ink-3)';
  const hex = (r: number) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; return `${32 + Math.cos(a) * r},${32 + Math.sin(a) * r}`; }).join(' ');
  const short = code.replace(/^MC-/, '');
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="shrink-0">
      {stack && <polygon points={hex(30)} fill="none" stroke={`rgb(${tone} / .45)`} strokeWidth={1.5} strokeDasharray="2 2" />}
      <polygon points={hex(stack ? 25 : 28)} fill={`rgb(${tone} / .12)`} stroke={`rgb(${tone})`} strokeWidth={2.2} />
      <text x={32} y={35} textAnchor="middle" fontSize={short.length > 8 ? 6.5 : short.length > 5 ? 7.5 : 9} fontWeight={700} fill={`rgb(${tone})`} style={{ direction: 'ltr' }}>{short}</text>
    </svg>
  );
}

const CRIT_ICON: Record<string, string> = { met: 'check', missing: 'info', lapsed: 'calendar', claimed: 'alert', manual: 'user' };
/** One line per criterion: status icon, label, what is missing and the evidence it rests on. */
export function CriteriaList({ e, def }: { e: Eligibility; def: DefRow }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  return (
    <ul className="space-y-1.5" data-testid="m17-mc-criteria">
      {e.components.map((c) => (
        <li key={`part:${c.code}`} className="flex items-start gap-2 text-[13px]" data-status={c.met ? 'met' : 'missing'}>
          <Icon name={c.met ? 'check' : 'info'} size={14} className={c.met ? 'mt-0.5 text-ok' : 'mt-0.5 text-ink-3'} />
          <span className="min-w-0 flex-1">
            {t('m17.mc.crit.component', { code: c.code, title: pick(c, 'title') })}
            {' '}<McStatusPill status={c.status} />
          </span>
        </li>
      ))}
      {e.criteria.map((c) => (
        <li key={c.key} className="flex items-start gap-2 text-[13px]" data-status={c.status}>
          <Icon name={CRIT_ICON[c.status] ?? 'info'} size={14} className={c.met ? 'mt-0.5 text-ok' : c.status === 'lapsed' ? 'mt-0.5 text-bad' : 'mt-0.5 text-ink-3'} />
          <span className="min-w-0 flex-1">
            <span className={c.met ? '' : 'text-ink-2'}>{pick(c, 'label')}</span>
            <span className="block text-[12px] text-ink-3">{critNote(c, t, f)}</span>
          </span>
        </li>
      ))}
      {def.criteria.length === 0 && e.components.length === 0 && <li className="text-[13px] text-ink-3">{t('m17.mc.crit.none')}</li>}
    </ul>
  );
}
function critNote(c: CritResult, t: (k: string, v?: Record<string, string | number>) => string, f: ReturnType<typeof useFormat>): string {
  const ev = c.evidence[0];
  if (c.kind === 'manual') return t('m17.mc.crit.manualNote');
  if (c.kind === 'skill') return t(`m17.mc.crit.skill_${c.status}`, { level: f.num(c.level ?? 0), min: f.num(c.min_level ?? 2) });
  if (c.kind === 'adaptive') return t(`m17.mc.crit.adaptive_${c.status === 'met' ? 'met' : 'missing'}`, { level: f.num(c.level ?? 0), min: f.num(c.min_level ?? 2) }); // FS31
  if (c.status === 'met') return ev?.date ? t('m17.mc.crit.metOn', { date: f.date(ev.date), table: t(`m17.mc.table.${ev.table}`) }) : t('m17.mc.crit.met');
  if (c.status === 'lapsed') return t('m17.mc.crit.lapsed', { date: ev?.date ? f.date(ev.date) : '—' });
  return t(`m17.mc.crit.missing_${c.kind}`);
}

/** Reasons for <WhyThis>: each criterion with its status and evidence reference (F02 contract). */
export function eligibilityReasons(e: Eligibility, pickLabel: (c: CritResult) => { en: string; ar: string }): Reason[] {
  const out: Reason[] = [];
  for (const c of e.components) out.push({ code: c.met ? 'mc_part_ok' : 'mc_part_missing', key: c.met ? 'm17.reasons.mc_part_ok' : 'm17.reasons.mc_part_missing', vars: { code: c.code }, ...(c.award_id ? { ref: { table: 'microcred_awards', id: c.award_id } } : {}) });
  for (const c of e.criteria) {
    const ev = c.evidence[0];
    out.push({ code: `mc_${c.status}`, key: `m17.reasons.mc_${c.status}`, vars: { label: pickLabel(c) }, ...(ev ? { ref: { table: ev.table, id: ev.id } } : {}) });
  }
  if (!out.length) out.push({ code: 'mc_none', key: 'm17.reasons.mc_none' });
  return out;
}

/** Progress: met criteria + valid components over the total (manual criteria count as open until approved). */
export function progressOf(e: Eligibility): { met: number; total: number } {
  const total = e.criteria.length + e.components.length;
  const met = e.criteria.filter((c) => c.met).length + e.components.filter((c) => c.met).length;
  return { met, total };
}
export function ProgressLine({ e }: { e: Eligibility }) {
  const t = useT();
  const f = useFormat();
  const p = progressOf(e);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11.5px] text-ink-3"><span>{t('m17.mc.progressLabel')}</span><span>{t('m17.mc.progress', { met: f.num(p.met), total: f.num(p.total) })}</span></div>
      <ProgressBar value={p.total ? (100 * p.met) / p.total : 0} tone={e.auto_met ? 'ok' : 'accent'} label={t('m17.mc.progress', { met: f.num(p.met), total: f.num(p.total) })} />
    </div>
  );
}

export interface McData {
  today: string;
  me: string;
  defs: DefRow[];
  awards: AwardRow[];
  items: Eligibility[];
  roles: Row[];
  skills: Row[];
}
/** Definitions (all versions), my awards, my eligibility for every published definition, roles and skills (labels). */
export function useMcData(me: string | null) {
  const repo = useRepo();
  return useQuery(['microcred_defs', 'microcred_awards', 'person_skills', 'job_roles', 'skills'], async (): Promise<McData> => {
    const [defs, awards, el, roles, skills] = await Promise.all([
      repo.list('microcred_defs', { order: [['sort', 'asc']] }), repo.list('microcred_awards', { filter: { person_id: me ?? '' } }), repo.rpc.microcredEligibility(null),
      repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('skills'),
    ]);
    return { today: new Date().toISOString().slice(0, 10), me: me ?? '', defs: defs as unknown as DefRow[], awards: awards as unknown as AwardRow[], items: el.allowed ? el.items : [], roles, skills };
  }, [me]);
}

/** The state a catalogue card shows for me: my latest award view, else eligible / requested / in progress. */
export function cardState(d: McData, def: DefRow, e: Eligibility | undefined): { status: AwardView | 'eligible' | 'progress' | 'none'; award: AwardRow | null; reason: string | null; daysLeft: number | null } {
  const mine = d.awards.filter((a) => a.def_code === def.code).sort((a, b) => String(b.issued_on ?? b.requested_at ?? '').localeCompare(String(a.issued_on ?? a.requested_at ?? '')) || b.id.localeCompare(a.id));
  const pending = mine.find((a) => a.status === 'pending_approval');
  if (pending) return { status: 'pending_approval', award: pending, reason: null, daysLeft: null };
  const held = mine.find((a) => a.status === 'awarded');
  if (held) {
    const v = awardView(held, d.today, d.awards);
    return { status: v.status, award: held, reason: v.reason, daysLeft: v.days_left };
  }
  if (e?.auto_met) return { status: 'eligible', award: null, reason: null, daysLeft: null };
  return { status: e && progressOf(e).met > 0 ? 'progress' : 'none', award: mine[0] ?? null, reason: null, daysLeft: null };
}

export function AreaChip({ area, children }: { area: string; children?: ReactNode }) {
  const t = useT();
  return <span className="chip border-line bg-sunken text-ink-2">{t(`m17.mc.area.${area}`)}{children}</span>;
}

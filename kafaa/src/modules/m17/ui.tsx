// M17 shared UI: basis chips, level meter, skills radar (RTL-aware SVG with a table alternative), badge medal, and the
// passport data hook. Built inside the module (CONTRACT section 5); nothing here imports a backend.
import { useId, useState, type ReactNode } from 'react';
import { Icon, StatusPill } from '../../ui';
import { useLang, useT, useFormat } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { LEVEL_MAX, radarPoints, type RadarAxis, type SkillRow, type CompRow, type CourseRow, type StateRow } from './passport';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

// ───────────── basis chip and level meter
const BASIS_STYLE: Record<string, { cls: string; icon: string }> = {
  verified: { cls: 'border-ok-line bg-ok-bg text-ok', icon: 'shield' },
  evidenced: { cls: 'border-info-line bg-info-bg text-info', icon: 'book' },
  validated: { cls: 'border-accent/30 bg-accent-soft text-eyebrow', icon: 'users' },
  claimed: { cls: 'border-sim-line bg-sim-bg text-sim', icon: 'user' },
  none: { cls: 'border-line bg-sunken text-ink-2', icon: 'info' },
};
/** One distinct chip per evidence basis. With onClick it is a button that opens the evidence drawer. */
export function BasisChip({ basis, onClick, testId }: { basis: string; onClick?: () => void; testId?: string }) {
  const t = useT();
  const s = BASIS_STYLE[basis] ?? BASIS_STYLE.none;
  const label = t(`common.skills.basis.${basis in BASIS_STYLE ? basis : 'none'}`);
  const inner = (
    <>
      <Icon name={s.icon} size={12} />
      {label}
    </>
  );
  if (!onClick) return <span className={`chip ${s.cls}`} data-basis={basis}>{inner}</span>;
  return (
    <button type="button" className={`chip ${s.cls} cursor-pointer hover:brightness-95 focus-visible:outline`} data-basis={basis} onClick={onClick} data-testid={testId ?? `m17-basis-${basis}`} aria-label={t('m17.passport.openEvidence', { basis: label })}>
      {inner}
    </button>
  );
}
export function LevelMeter({ level, required, size = 'md' }: { level: number; required?: number | null; size?: 'sm' | 'md' }) {
  const t = useT();
  const f = useFormat();
  const w = size === 'sm' ? 'h-1.5 w-4' : 'h-2 w-6';
  return (
    <span className="inline-flex items-center gap-1.5" title={t('common.skills.level', { level: f.num(level) })}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {Array.from({ length: LEVEL_MAX }, (_, i) => {
          const on = i < level;
          const gap = required != null && i >= level && i < required;
          return <span key={i} className={`${w} rounded-sm ${on ? 'bg-accent' : gap ? 'bg-bad/25 ring-1 ring-inset ring-bad/40' : 'bg-sunken ring-1 ring-inset ring-line'}`} />;
        })}
      </span>
      <span className="num text-[12px] text-ink-2">
        {f.num(level)}
        {required != null && <span className="text-ink-3">/{f.num(required)}</span>}
      </span>
      <span className="sr-only">{required != null ? t('m17.passport.levelOf', { level: f.num(level), need: f.num(required) }) : t('common.skills.level', { level: f.num(level) })}</span>
    </span>
  );
}
export function MirrorChip({ label }: { label?: string }) {
  const t = useT();
  return <span className="chip border-sim-line bg-sim-bg text-sim">{label ?? t('m17.mirror')}</span>;
}

// ───────────── radar
export function SkillsRadar({ axes, title, roleLabel, targetLabel }: { axes: RadarAxis[]; title: string; roleLabel?: string; targetLabel?: string }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const rtl = lang === 'ar';
  const id = useId();
  const [table, setTable] = useState(false);
  const pick = (a: RadarAxis) => (rtl ? a.label.ar : a.label.en);
  const W = 460, H = 360, cx = W / 2, cy = H / 2, r = 120;
  const n = axes.length;
  const poly = (vals: number[]) => radarPoints(vals, r, cx, cy, rtl).map((p) => p.join(',')).join(' ');
  const outer = radarPoints(axes.map(() => LEVEL_MAX), r, cx, cy, rtl);
  const labelPts = radarPoints(axes.map(() => LEVEL_MAX), r + 16, cx, cy, rtl);
  const hasReq = axes.some((a) => a.required != null);
  const hasTgt = axes.some((a) => a.target != null);
  const short = (s: string) => (s.length > 26 ? `${s.slice(0, 25)}…` : s);
  return (
    <figure className="space-y-2" data-testid="m17-radar">
      {n >= 3 ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-labelledby={`${id}-t`} style={{ direction: 'ltr' }} data-dir={rtl ? 'rtl' : 'ltr'}>
          <title id={`${id}-t`}>{title}</title>
          {[1, 2, 3, 4].map((lv) => (
            <polygon key={lv} points={poly(axes.map(() => lv))} fill={lv % 2 ? 'rgb(var(--sunken))' : 'none'} fillOpacity={0.6} stroke="rgb(var(--line))" strokeWidth={1} />
          ))}
          {outer.map(([x, y], i) => (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgb(var(--line))" strokeWidth={1} />
          ))}
          {[1, 2, 3, 4].map((lv) => (
            <text key={lv} x={cx + 3} y={cy - (lv / LEVEL_MAX) * r + 3} fontSize={9} fill="rgb(var(--ink-3))">
              {f.num(lv)}
            </text>
          ))}
          {hasTgt && <polygon points={poly(axes.map((a) => a.target ?? 0))} fill="none" stroke="rgb(var(--sky))" strokeWidth={2} strokeDasharray="2 3" data-series="target" />}
          {hasReq && <polygon points={poly(axes.map((a) => a.required ?? 0))} fill="none" stroke="rgb(var(--ink-2))" strokeWidth={1.5} strokeDasharray="5 4" data-series="required" />}
          <polygon points={poly(axes.map((a) => a.current))} fill="rgb(var(--accent))" fillOpacity={0.22} stroke="rgb(var(--accent))" strokeWidth={2} data-series="current" />
          {radarPoints(axes.map((a) => a.current), r, cx, cy, rtl).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} fill="rgb(var(--accent))" />
          ))}
          {labelPts.map(([x, y], i) => {
            const dx = x - cx;
            const anchor = Math.abs(dx) < 12 ? 'middle' : dx > 0 ? 'start' : 'end';
            return (
              <text key={axes[i].id} x={x} y={y + (y < cy - r * 0.8 ? -2 : y > cy + r * 0.8 ? 10 : 3)} fontSize={10.5} textAnchor={anchor} fill="rgb(var(--ink-2))">
                <title>{pick(axes[i])}</title>
                {short(pick(axes[i]))}
              </text>
            );
          })}
        </svg>
      ) : (
        <p className="text-[13px] text-ink-3">{t('m17.radar.tooFew')}</p>
      )}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-2">
        <span className="flex flex-wrap items-center gap-3">
          <Swatch cls="bg-accent/40 ring-2 ring-accent" label={t('m17.radar.me')} />
          {hasReq && <Swatch cls="border-2 border-dashed border-ink-2" label={roleLabel ? t('m17.radar.requiredFor', { role: roleLabel }) : t('m17.radar.required')} />}
          {hasTgt && <Swatch cls="border-2 border-dotted border-sky" label={t('m17.radar.targetFor', { role: targetLabel ?? '' })} />}
        </span>
        <button type="button" className="btn-ghost btn-sm" aria-expanded={table} onClick={() => setTable((x) => !x)} data-testid="m17-radar-toggle">
          {table ? t('m17.radar.hideTable') : t('m17.radar.showTable')}
        </button>
      </figcaption>
      <div className={table ? 'overflow-x-auto' : 'sr-only'}>
        <table className="w-full text-[13px]" data-testid="m17-radar-table">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-line text-start">
              <th scope="col" className="caps py-1 text-start">{t('m17.radar.axis')}</th>
              <th scope="col" className="caps py-1 text-end">{t('m17.radar.me')}</th>
              {hasReq && <th scope="col" className="caps py-1 text-end">{t('m17.radar.required')}</th>}
              {hasTgt && <th scope="col" className="caps py-1 text-end">{t('m17.radar.target')}</th>}
            </tr>
          </thead>
          <tbody>
            {axes.map((a) => (
              <tr key={a.id} className="border-b border-line/60">
                <th scope="row" className="py-1 text-start font-normal">{pick(a)}</th>
                <td className="num py-1 text-end">{f.num(a.current, { maximumFractionDigits: 1 })}</td>
                {hasReq && <td className="num py-1 text-end">{a.required == null ? '—' : f.num(a.required, { maximumFractionDigits: 1 })}</td>}
                {hasTgt && <td className="num py-1 text-end">{a.target == null ? '—' : f.num(a.target, { maximumFractionDigits: 1 })}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
function Swatch({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-4 rounded-sm ${cls}`} aria-hidden />
      {label}
    </span>
  );
}

// ───────────── badge medal (decorative)
export function BadgeMedal({ code, status, size = 64 }: { code: string; status: string; size?: number }) {
  const tone = status === 'active' ? 'var(--accent)' : status === 'expired' || status === 'renewal_due' ? 'var(--sim)' : 'var(--bad)'; // W5 QA: a micro-credential due for renewal is still valid (amber, not red)
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${32 + Math.cos(a) * 28},${32 + Math.sin(a) * 28}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="shrink-0">
      <polygon points={pts} fill={`rgb(${tone} / .14)`} stroke={`rgb(${tone})`} strokeWidth={2.5} />
      <circle cx={32} cy={32} r={17} fill="rgb(var(--panel))" stroke={`rgb(${tone})`} strokeWidth={1.5} strokeDasharray={status === 'active' ? undefined : '3 2'} />
      <text x={32} y={35} textAnchor="middle" fontSize={code.length > 6 ? 7.5 : 9} fontWeight={700} fill={`rgb(${tone})`} style={{ direction: 'ltr' }} {...(code.length > 7 ? { textLength: 30, lengthAdjust: 'spacingAndGlyphs' } : {})}>
        {code}
      </text>
    </svg>
  );
}
export function BadgeStatusPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status}>{t(`m17.badge.status.${status}`)}</StatusPill>;
}

// ───────────── data
export interface PassportData {
  person: Row | null;
  skills: SkillRow[];
  comps: CompRow[];
  states: StateRow[];
  evidence: Row[];
  roleComps: Row[];
  roles: Row[];
  families: Row[];
  quals: Row[];
  standards: Row[];
  licences: Row[];
  edges: Row[];
  claims: Row[];
  badges: Row[];
  courses: CourseRow[];
  certificates: Row[];
  training: Row[];
  attempts: Row[];
  forms: Row[];
  /** FS03: own micro-credential awards (labels for back-filled credential evidence). */
  mcAwards: Row[];
  /** FS79 (wave I integration): the person's external certificates (labels and trust tier of certificate evidence). */
  xcerts?: Row[];
}
const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
/** Everything the passport needs for one person; the repository applies RLS (own, scope or nothing). */
export function usePassportData(personId: string | null) {
  const repo = useRepo();
  return useQuery(
    ['person_skills', 'skill_evidence', 'skill_claims', 'badges', 'qual_records', 'licences', 'people', 'certificates', 'training_records', 'microcred_awards', 'external_certs'],
    async (): Promise<PassportData> => {
      if (!personId) throw new Error('no person');
      const L = (tbl: string, q: object = {}) => safe(repo.list(tbl as never, q as never) as Promise<Row[]>);
      const [person, skills, comps, states, evidence, roleComps, roles, families, quals, standards, licences, edges, claims, badges, courses, certificates, training, attempts, forms, mcAwards, xcerts] = await Promise.all([
        repo.get('people', personId).catch(() => null),
        L('skills', { order: [['sort', 'asc']] }),
        L('competencies'),
        L('person_skills', { filter: { person_id: personId, active: true } }),
        L('skill_evidence', { filter: { person_id: personId, active: true } }),
        L('role_competencies'),
        L('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }),
        L('job_families'),
        L('qual_records', { filter: { person_id: personId } }),
        L('qual_standards'),
        L('licences', { filter: { person_id: personId } }),
        L('career_paths'),
        L('skill_claims', { filter: { person_id: personId }, order: [['created_at', 'desc']] }),
        L('badges', { filter: { person_id: personId }, order: [['issued_on', 'desc']] }),
        L('courses'),
        L('certificates', { filter: { person_id: personId } }),
        L('training_records', { filter: { person_id: personId } }),
        L('attempts', { filter: { person_id: personId } }),
        L('assessment_forms'),
        L('microcred_awards', { filter: { person_id: personId } }),
        L('external_certs', { filter: { person_id: personId } }), // FS79 (wave I integration)
      ]);
      return { person: (person as Row) ?? null, skills: skills as never, comps: comps as never, states: states as never, evidence, roleComps, roles, families, quals, standards, licences, edges, claims, badges, courses: courses as never, certificates, training, attempts, forms, mcAwards, xcerts };
    },
    [personId],
  );
}
export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'info' | 'sim' }) {
  const toneCls = tone ? { ok: 'text-ok', bad: 'text-bad', info: 'text-info', sim: 'text-sim' }[tone] : 'text-ink';
  return (
    <div className="rounded-card border border-line bg-raised px-3 py-2.5">
      <div className="caps">{label}</div>
      <div className={`num mt-0.5 text-[22px] font-semibold leading-tight ${toneCls}`}>{value}</div>
      {sub && <div className="text-[12px] text-ink-2">{sub}</div>}
    </div>
  );
}

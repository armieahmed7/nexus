// F10/F11 shared UI (built inside M17): level picker with the competency's level descriptors, level dots, outcome and
// coverage pills, person chip, rater-flag pill, and the data hook for the skills catalogue. No backend imports.
import type { ReactNode } from 'react';
import { Icon, StatusPill } from '../../ui';
import { useT, useFormat, usePick, useLang, hasKey } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import type { BiText } from '../../domain/engines/types';
import { LevelIndicators } from '../m02/levelsUi'; // FS23 (fsCe4): raters see the skill's observable indicators at the level being rated

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export function useCatalogue() {
  const repo = useRepo();
  return useQuery(['skills', 'competencies', 'qual_standards', 'job_roles'], async () => {
    const [skills, comps, standards, roles] = await Promise.all([
      repo.list('skills', { order: [['sort', 'asc']] }) as Promise<Row[]>,
      repo.list('competencies') as Promise<Row[]>,
      repo.list('qual_standards').catch(() => []) as Promise<Row[]>,
      repo.list('job_roles').catch(() => []) as Promise<Row[]>,
    ]);
    return { skills, comps, standards, roles, skill: new Map(skills.map((s) => [s.id, s])), comp: new Map(comps.map((c) => [c.id, c])), role: new Map(roles.map((r) => [r.id, r])) };
  }, []);
}
export type Catalogue = NonNullable<ReturnType<typeof useCatalogue>['data']>;

/** Level descriptor for a skill: the competency's level text (EN/AR). */
export function descriptor(cat: Catalogue, skillId: string, level: number): BiText | null {
  const s = cat.skill.get(skillId);
  const c = s ? cat.comp.get(s.competency_id) : null;
  const l = (c?.levels ?? []).find((x: Row) => Number(x.level) === level);
  return l ? { en: l.en, ar: l.ar } : null;
}

export function LevelDots({ level, of = 4, tone = 'accent', label }: { level: number | null | undefined; of?: number; tone?: 'accent' | 'sim' | 'info' | 'ok' | 'bad'; label?: string }) {
  const t = useT();
  const f = useFormat();
  const on = { accent: 'bg-accent', sim: 'bg-sim', info: 'bg-info', ok: 'bg-ok', bad: 'bg-bad' }[tone];
  if (level == null) return <span className="text-[12px] text-ink-3">—</span>;
  return (
    <span className="relative inline-flex items-center gap-1.5" title={label ?? t('common.skills.level', { level: f.num(level) })}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {Array.from({ length: of }, (_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i < level ? on : 'bg-sunken ring-1 ring-inset ring-line'}`} />)}
      </span>
      <span className="num text-[12px] text-ink-2">{f.num(level)}</span>
      <span className="sr-only">{label ?? t('common.skills.level', { level: f.num(level) })}</span>
    </span>
  );
}

/** Four level buttons (radio semantics) with the selected level's descriptor underneath. */
export function LevelPicker({ name, value, onChange, cat, skillId, allowZero, zeroLabel, label }: { name: string; value: number | null; onChange: (v: number) => void; cat: Catalogue; skillId: string; allowZero?: boolean; zeroLabel?: string; label: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const d = value && value > 0 ? descriptor(cat, skillId, value) : null;
  const opts = [...(allowZero ? [0] : []), 1, 2, 3, 4];
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-ink-2">{label}</legend>
      <div role="radiogroup" className="flex flex-wrap gap-1.5">
        {opts.map((lv) => (
          <button key={lv} type="button" role="radio" aria-checked={value === lv} name={name} data-testid={`m17-level-${name}-${lv}`}
            className={`rounded-md border px-2.5 py-1 text-[13px] ${value === lv ? 'border-accent bg-accent-soft font-semibold text-eyebrow' : 'border-line bg-panel text-ink-2 hover:bg-sunken'}`}
            onClick={() => onChange(lv)}>
            {lv === 0 ? zeroLabel ?? t('m17.ci.notObserved') : t('m17.ci.levelN', { n: f.num(lv) })}
          </button>
        ))}
      </div>
      {/* FS23: the skill's own essence and indicators at the selected level (falls back to the competency text) */}
      {value && value > 0 ? <LevelIndicators skillId={skillId} level={value} fallback={d ? <p className="text-[12px] text-ink-3">{lang === 'ar' ? d.ar : d.en}</p> : null} /> : null}
    </fieldset>
  );
}

const OUTCOME_TONE: Record<string, 'ok' | 'info' | 'sim' | 'neutral' | 'bad'> = { validate: 'ok', adjust: 'info', not_yet: 'sim', qualification_only: 'neutral' };
export function OutcomePill({ outcome }: { outcome: string }) {
  const t = useT();
  return <StatusPill tone={OUTCOME_TONE[outcome] ?? 'neutral'}>{t(`m17.ci.outcome.${outcome}`)}</StatusPill>;
}
export function CheckinStatus({ status, overdue }: { status: string; overdue?: boolean }) {
  const t = useT();
  if (overdue) return <StatusPill tone="bad">{t('m17.ci.status.overdue')}</StatusPill>;
  const tone = ({ open: 'info', validated: 'ok', adjusted: 'accent', withdrawn: 'neutral' } as const)[status as 'open'] ?? 'neutral';
  return <StatusPill tone={tone}>{t(`m17.ci.status.${status}`)}</StatusPill>;
}
const COV_TONE = { covered: 'ok', thin: 'sim', uncovered: 'bad', suppressed: 'neutral' } as const;
export function CoveragePill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={COV_TONE[status as 'covered'] ?? 'neutral'}>{t(`m17.tm.status.${status}`)}</StatusPill>;
}
export function SpofFlag() {
  const t = useT();
  return (
    <span className="chip border-bad/40 bg-bad-bg text-bad" data-testid="m17-spof">
      <Icon name="alert" size={12} /> {t('m17.tm.spof')}
    </span>
  );
}
export function RaterFlag({ flag }: { flag: string }) {
  const t = useT();
  const tone = ({ high: 'sim', low: 'info', aligned: 'ok', few: 'neutral' } as const)[flag as 'high'] ?? 'neutral';
  return <StatusPill tone={tone}>{t(`m17.cal.flag.${flag}`)}</StatusPill>;
}
export function PersonName({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2" title={sub ? `${name} · ${sub}` : name}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-semibold text-ink-2" aria-hidden>
        {name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        {sub && <span className="block truncate text-[12px] text-ink-3">{sub}</span>}
      </span>
    </span>
  );
}
/** Bilingual name from a card or member row. */
export function useName() {
  const lang = useLang();
  return (r: { name_en?: string; name_ar?: string } | null | undefined, fallback = '') => (r ? (lang === 'ar' ? r.name_ar || r.name_en : r.name_en) ?? fallback : fallback);
}
export function useSkillName(cat: Catalogue | undefined) {
  const pick = usePick();
  return (id: string) => (cat?.skill.get(id) ? pick(cat.skill.get(id), 'name') : id);
}

/** "Team: Operations crew B" / "Job family: Operations" (team names from i18n, family names from job_families). */
export function useGroupLabel() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const fams = useQuery('job_families', () => repo.list('job_families') as Promise<Row[]>, []);
  return (key: string | null | undefined) => {
    if (!key) return '—';
    const [kind, id] = key.split(':');
    if (kind === 'team') { const k = `m17.tm.teams.${id}`; return t('m17.tm.group.team', { id: hasKey(k) ? t(k) : id }); }
    const fam = (fams.data ?? []).find((x) => x.id === id);
    return t('m17.tm.group.family', { id: fam ? pick(fam, 'name') : id });
  };
}

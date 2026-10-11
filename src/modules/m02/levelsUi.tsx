// FS23/FS24 shared UI (module M02, FS wave C · E4): the data hook for levels, descriptors and the scale map, range dots, level and
// band labels, fit / track / basis pills, evidence-mode chips, a descriptor block and the check-in indicator hint. No backend imports.
import type { ReactNode } from 'react';
import { StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import type { Reason } from '../../domain/engines/types';
import { levelState, type RangeLite } from './descriptors';
import { BANDS, extRange, type Band } from './authority';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

export interface LevelsData {
  attrs: Row[];
  ranges: Row[];
  descs: Row[];
  skills: Row[];
  maps: Row[];
  frameworks: Row[];
  alignments: Row[];
  skill: Map<string, Row>;
  rangeOf: Map<string, Row>;
  descOf: (skillId: string, level: number) => Row | undefined;
}

/** Everything the FS23/FS24 pages read (all public tables; drafts only for readers RLS allows). */
export function useLevelsData() {
  const repo = useRepo();
  return useQuery(['level_attributes', 'skill_level_ranges', 'skill_descriptors', 'skills', 'scale_maps', 'skill_frameworks', 'skill_alignments'], async (): Promise<LevelsData> => {
    const [attrs, ranges, descs, skills, maps, frameworks, alignments] = await Promise.all([
      repo.list('level_attributes', { order: [['sort', 'asc']] }) as Promise<Row[]>,
      repo.list('skill_level_ranges') as Promise<Row[]>,
      repo.list('skill_descriptors') as Promise<Row[]>,
      repo.list('skills', { order: [['sort', 'asc']] }) as Promise<Row[]>,
      repo.list('scale_maps', { order: [['sort', 'asc']] }) as Promise<Row[]>,
      repo.list('skill_frameworks', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('skill_alignments').catch(() => []) as Promise<Row[]>,
    ]);
    const byKey = new Map(descs.map((d) => [`${d.skill_id}|${d.level}`, d]));
    return {
      attrs, ranges, descs, skills, maps, frameworks, alignments,
      skill: new Map(skills.map((s) => [s.id, s])), rangeOf: new Map(ranges.map((r) => [r.skill_id, r])),
      descOf: (skillId, level) => byKey.get(`${skillId}|${level}`),
    };
  }, []);
}

export const LEVELS = [1, 2, 3, 4] as const;

/** "Level 3 · Qualified" style label. */
export function useLevelName() {
  const t = useT();
  return (level: number) => t(`m02.lv.levelName.${level}`);
}
export function useBandName() {
  const t = useT();
  return (band: string) => t(`m02.sc.band.${band}`);
}

/** Four dots: filled where the skill is defined, hollow where it is not; the held level is ringed. */
export function RangeDots({ range, held, testId }: { range: RangeLite | null | undefined; held?: number | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const label = range ? t('m02.lv.rangeLabel', { from: f.num(range.min_level), to: f.num(range.max_level) }) : t('m02.lv.noRange');
  return (
    <span className="inline-flex items-center gap-1" title={label} data-testid={testId}>
      <span className="inline-flex gap-1" aria-hidden>
        {LEVELS.map((l) => {
          const st = levelState(range, l);
          return (
            <span key={l} className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-semibold num ${st === 'defined' ? 'bg-accent text-white' : 'border border-dashed border-line text-ink-3'} ${held === l ? 'ring-2 ring-ok ring-offset-1' : ''}`}>
              {f.num(l)}
            </span>
          );
        })}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

const FIT_TONE: Record<string, 'ok' | 'info' | 'sim' | 'neutral'> = { exact: 'ok', close: 'info', loose: 'sim', none: 'neutral' };
export function FitPill({ fit }: { fit: string | null | undefined }) {
  const t = useT();
  if (!fit) return null;
  return <StatusPill tone={FIT_TONE[fit] ?? 'neutral'}>{t(`m02.sc.fit.${fit}`)}</StatusPill>;
}
export function TrackPill({ track }: { track: string | null | undefined }) {
  const t = useT();
  if (!track) return null;
  return <StatusPill tone={track === 'behavioural' ? 'info' : 'neutral'}>{t(`m02.lv.track.${track}`)}</StatusPill>;
}
export function BasisPill({ basis }: { basis: string | null | undefined }) {
  const t = useT();
  if (!basis) return null;
  return <StatusPill tone={basis === 'full' ? 'ok' : basis === 'awareness_only' || basis === 'not_operated' || basis === 'watch' ? 'sim' : 'neutral'}>{t(`m02.lv.basis.${basis}`)}</StatusPill>;
}
export function ModeChips({ modes }: { modes: string[] | null | undefined }) {
  const t = useT();
  if (!modes?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label={t('m02.lv.evidenceModes')}>
      {modes.map((m) => (
        <li key={m} className="chip border-line bg-sunken normal-case tracking-normal text-ink-2" title={t(`m02.lv.modeHint.${m}`)}>{t(`m02.lv.mode.${m}`)}</li>
      ))}
    </ul>
  );
}

/** The indicator list in the UI language (Arabic when present, else English). */
export function pickList(lang: string, en: unknown, ar: unknown): string[] {
  const a = Array.isArray(ar) ? (ar as string[]) : [];
  const e = Array.isArray(en) ? (en as string[]) : [];
  return lang === 'ar' && a.length ? a : e;
}

/** Essence line + observable indicators (+ evidence modes) of one descriptor row. */
export function DescriptorBlock({ d, showModes = true, testId }: { d: Row; showModes?: boolean; testId?: string }) {
  const pick = usePick();
  const lang = useLang();
  const t = useT();
  const ind = pickList(lang, d.indicators_en, d.indicators_ar);
  return (
    <div className="space-y-2" data-testid={testId}>
      <p className="text-[13.5px] font-medium text-ink">{pick(d, 'essence')}</p>
      <div>
        <div className="caps mb-1">{t('m02.lv.indicators')}</div>
        <ul className="space-y-1.5 text-[13px] text-ink-2">
          {ind.map((x, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </div>
      {showModes && <ModeChips modes={d.evidence_modes} />}
    </div>
  );
}

/** FS23 hook for check-in raters (F10, M17 LevelPicker): the skill's indicators at the level being rated; `fallback` when none. */
export function LevelIndicators({ skillId, level, fallback = null }: { skillId: string; level: number | null | undefined; fallback?: ReactNode }) {
  const repo = useRepo();
  const lang = useLang();
  const t = useT();
  const pick = usePick();
  const q = useQuery(['skill_descriptors', 'skill_level_ranges'], async () => {
    const [ds, rs] = await Promise.all([
      repo.list('skill_descriptors', { filter: { skill_id: skillId, status: 'published' } }) as Promise<Row[]>,
      repo.list('skill_level_ranges', { filter: { skill_id: skillId } }) as Promise<Row[]>,
    ]);
    return { ds, range: rs[0] ?? null };
  }, [skillId]);
  if (!level || level < 1) return null;
  const d = q.data?.ds.find((x) => Number(x.level) === level);
  if (!q.data) return <>{fallback}</>;
  if (!d) {
    const st = levelState(q.data.range, level);
    if (st === 'below' || st === 'above') return <p className="text-[12px] text-ink-3" data-testid={`m02-ci-undefined-${skillId}`}>{t('m02.ci.notDefined')} {pick(q.data.range, 'rationale')}</p>;
    return <>{fallback}</>;
  }
  const ind = pickList(lang, d.indicators_en, d.indicators_ar);
  return (
    <div className="rounded-md border border-line bg-sunken/60 p-2 text-[12px]" data-testid={`m02-ci-indicators-${skillId}`}>
      <p className="font-medium text-ink-2">{pick(d, 'essence')}</p>
      <div className="caps mt-1">{t('m02.ci.lookFor')}</div>
      <ul className="mt-0.5 list-disc space-y-0.5 ps-4 text-ink-2">
        {ind.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

/** External equivalents of a Kafa'a band across the five mapped frameworks (rows of kafaa_scale_maps). */
export function equivalents(maps: Row[], band: Band, frameworks?: string[]) {
  return maps.filter((m) => m.row_kind === 'map' && m.band === band && (!frameworks || frameworks.includes(m.framework)));
}
/** Which frameworks apply to a skill: SFIA, SkillsFuture and the NQF everywhere; DigComp for digital and AI skills; UNESCO for AI. */
export function frameworksFor(skill: Row | null | undefined): string[] {
  const out = ['sfia9', 'skillsfuture'];
  if (skill && (skill.area === 'digital' || skill.fs_area === 'ai_data' || skill.fs_area === 'digital_plant' || skill.fs_area === 'cyber_hygiene')) out.push('digcomp');
  if (skill && (skill.fs_area === 'ai_data' || ['sk-da-02', 'sk-da-02-review'].includes(skill.id))) out.push('unesco_ai');
  out.push('uae_nqf');
  return out;
}
export function EquivalentChips({ maps, band, frameworks, fwShort }: { maps: Row[]; band: Band; frameworks: string[]; fwShort: (id: string) => string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const rows = equivalents(maps, band, frameworks);
  if (!rows.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label={t('m02.sc.equivalents')}>
      {rows.map((r) => (
        <li key={r.id} className="chip border-line bg-panel normal-case tracking-normal text-ink-2" title={pick(r, 'note')}>
          <span className="font-semibold">{fwShort(r.framework)}</span>&nbsp;
          {r.ext_from == null ? '—' : <bdi className="num">{rangeText(r, f)}</bdi>}
          {r.fit === 'loose' && <span className="ms-1 text-ink-3">{t('m02.sc.fitShort.loose')}</span>}
        </li>
      ))}
    </ul>
  );
}
export const ALL_BANDS = BANDS;
/** "3" or "5–6" with the reader's digits. */
export function rangeText(r: Row, f: ReturnType<typeof useFormat>): string {
  const x = extRange(r);
  return x ? x.split('-').map((v) => f.num(Number(v), { useGrouping: false })).join('–') : '—';
}

/** Reasons (for <WhyThis>) why a level is or is not defined for a skill. */
export function rangeReasons(range: Row | null | undefined, level: number, skillName: { en: string; ar: string }): Reason[] {
  if (!range) return [{ code: 'none', key: 'm02.lv.why.none' }];
  const st = levelState(range, level);
  const r: Reason[] = [{ code: 'range', key: 'm02.lv.why.range', vars: { skill: skillName, from: Number(range.min_level), to: Number(range.max_level) } }];
  r.push({ code: range.basis, key: `m02.lv.why.basis.${range.basis}` });
  if (st !== 'defined') r.push({ code: 'sfia', key: 'm02.lv.why.sfia' });
  return r;
}

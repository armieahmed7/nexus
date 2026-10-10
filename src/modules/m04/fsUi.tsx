// FS wave C · E2 shared view helpers for the future-skills course pack (FS19) and the academies (FS20). Module-local, not UI kit.
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Icon, SimChip, SourceLink, StatusPill, type PillTone } from '../../ui';
import { FS_PACK_PROGRAMME, learningRoutes, packCoverage, type LearningRoute, type SkillRef } from './fsPack';
import type { StatsOut, CohortStats } from './academy';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const THEME_TONE: Record<string, PillTone> = { data_ai: 'info', digital_plant: 'accent', advanced_reactor: 'sim', green: 'ok', human: 'neutral', cyber: 'bad' };
export function ThemeChip({ theme }: { theme: string }) {
  const t = useT();
  return <StatusPill tone={THEME_TONE[theme] ?? 'neutral'}>{t(`m04.fsc.theme.${theme}`)}</StatusPill>;
}

/** Level 1-3 as three dots plus the number, with an accessible label. */
export function LevelDots({ level }: { level: number }) {
  const t = useT();
  const f = useFormat();
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={t('m04.fsc.levelN', { n: f.num(level) })} title={t('m04.fsc.levelN', { n: f.num(level) })}>
      {[1, 2, 3].map((i) => <span key={i} aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${i <= level ? 'bg-accent' : 'bg-line-strong'}`} />)}
      <span className="num ms-1 text-[11.5px] text-ink-3">{t('m04.fsc.lv', { n: f.num(level) })}</span>
    </span>
  );
}

/** A skill chip linking to the FS07 skill page. */
export function SkillChip({ skill, level }: { skill: Row | undefined; level?: number }) {
  const pick = usePick();
  if (!skill) return null;
  return (
    <L to={`/skills/${skill.id}`} className="chip max-w-full gap-1.5 border-line bg-sunken normal-case tracking-normal text-ink-2 no-underline hover:border-accent" data-testid="m04-fs-skill">
      <span className="max-w-[16rem] truncate">{pick(skill, 'name')}</span>
      {level != null && <LevelDots level={level} />}
    </L>
  );
}

export function NoDecisionNote() {
  const t = useT();
  return <p className="flex items-start gap-1.5 text-[12.5px] text-ink-3" data-testid="m04-no-decision"><Icon name="info" size={13} className="mt-0.5 shrink-0" />{t('m04.fsc.noDecision')}</p>;
}

/** Sources with their as-of date (each pack and academy source row carries as_of). */
export function AsOfSources({ items }: { items: unknown }) {
  const t = useT();
  const f = useFormat();
  const list = (Array.isArray(items) ? items : []) as { id?: string; label: string; url: string; as_of?: string }[];
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="m04-fs-sources">
      <span className="caps">{t('m04.common.sources')}</span>
      {list.map((s) => <SourceLink key={s.url} href={s.url} date={s.as_of ? t('common.asOf', { date: f.date(s.as_of) }) : null}>{s.label}</SourceLink>)}
    </div>
  );
}

export interface PackData {
  courses: Row[]; modules: Row[]; items: Row[]; links: Row[]; skills: Map<string, Row>; routes: LearningRoute[]; routeOf: Map<string, LearningRoute>;
  coverage: ReturnType<typeof packCoverage>; itemOf: Map<string, Row>; courseOf: Map<string, Row>; linksOf: (courseId: string) => Row[];
}
/** The pack as public reference rows: courses of the pack programme, modules, metadata, active skill links, the skills they teach and
 *  learning routes (holders counted from the person-skill rows the viewer may read; public pages show routes, never holders). */
export function usePackData() {
  const repo = useRepo();
  return useQuery(['courses', 'course_modules', 'course_pack_items', 'course_skill_links', 'skills'], async (): Promise<PackData> => {
    const [courses, items, links, skills] = await Promise.all([
      repo.list('courses', { filter: { programme_id: FS_PACK_PROGRAMME } }),
      repo.list('course_pack_items', { order: [['sort', 'asc']] }),
      repo.list('course_skill_links', { filter: { active: true }, order: [['objective_n', 'asc']] }),
      repo.list('skills'),
    ]);
    const ids = new Set(courses.map((c) => c.id));
    const modules = (await repo.list('course_modules', { order: [['n', 'asc']] })).filter((m) => ids.has(m.course_id));
    const skillMap = new Map<string, Row>(skills.map((s) => [s.id, s as Row]));
    const routes = learningRoutes(skills as unknown as SkillRef[], [], links as never);
    const coverage = packCoverage(routes, skillMap as unknown as Map<string, SkillRef>);
    const linkRows = links as Row[];
    return {
      courses: courses as Row[], modules: modules as Row[], items: items as Row[], links: linkRows, skills: skillMap, routes, routeOf: new Map(routes.map((r) => [r.skill_id, r])), coverage,
      itemOf: new Map(items.map((i) => [i.course_id, i as Row])), courseOf: new Map(courses.map((c) => [c.id, c as Row])),
      linksOf: (cid: string) => linkRows.filter((l) => l.course_id === cid),
    };
  }, []);
}

export interface AcademyData { academies: Row[]; cohorts: Row[]; stats: StatsOut; courses: Map<string, Row>; skills: Map<string, Row> }
export function useAcademyData() {
  const repo = useRepo();
  return useQuery(['academies', 'academy_cohorts', 'academy_members', 'cohort_capstones', 'courses', 'skills', 'enrolments'], async (): Promise<AcademyData> => {
    const [academies, cohorts, stats, courses, skills] = await Promise.all([
      repo.list('academies', { order: [['sort', 'asc']] }), repo.list('academy_cohorts', { order: [['starts_on', 'asc']] }), repo.rpc.academyStats(),
      repo.list('courses', { filter: { programme_id: FS_PACK_PROGRAMME } }), repo.list('skills'),
    ]);
    return { academies: academies as Row[], cohorts: cohorts as Row[], stats, courses: new Map(courses.map((c) => [c.id, c as Row])), skills: new Map(skills.map((s) => [s.id, s as Row])) };
  }, []);
}
export const cohortStatsOf = (stats: StatsOut, cohortId: string): CohortStats | undefined => stats.academies.flatMap((a) => a.cohort_stats).find((c) => c.cohort_id === cohortId);

const COHORT_TONE: Record<string, PillTone> = { planned: 'neutral', nominating: 'info', running: 'ok', completed: 'neutral' };
export function CohortPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={COHORT_TONE[status] ?? 'neutral'}>{t(`m04.acad.cohortStatus.${status}`)}</StatusPill>;
}
const CAP_TONE: Record<string, PillTone> = { draft: 'neutral', submitted: 'info', signed_off: 'ok', returned: 'sim' };
export function CapstonePill({ status, result }: { status: string; result?: string | null }) {
  const t = useT();
  return <StatusPill tone={CAP_TONE[status] ?? 'neutral'}>{t(`m04.acad.capStatus.${status}`)}{status === 'signed_off' && result ? ` · ${t(`m04.acad.result.${result}`)}` : ''}</StatusPill>;
}
const MEMBER_TONE: Record<string, PillTone> = { nominated: 'info', accepted: 'ok', active: 'ok', completed: 'ok', declined: 'neutral', withdrawn: 'neutral' };
export function MemberPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={MEMBER_TONE[status] ?? 'neutral'}>{t(`m04.acad.memberStatus.${status}`)}</StatusPill>;
}

/** A statistic that is either a number or "suppressed (fewer than 10)". */
export function Suppressible({ value, pct }: { value: number | null | undefined; pct?: boolean }) {
  const t = useT();
  const f = useFormat();
  if (value == null) return <span className="text-ink-3" title={t('m04.acad.suppressedHint')} data-testid="m04-suppressed">{t('m04.acad.suppressed')}</span>;
  return <span className="num">{pct ? f.pct(value, 0) : f.num(value)}</span>;
}

/** The module + project + mentor template (with the separate reviewer), as a small diagram. */
export function TemplateTriad({ compact }: { compact?: boolean }) {
  const t = useT();
  const box = (icon: string, title: ReactNode, body: ReactNode, k: string) => (
    <div key={k} className="flex-1 rounded-card border border-line bg-panel p-3" data-testid={`m04-triad-${k}`}>
      <div className="mb-1 flex items-center gap-2 font-semibold text-ink"><Icon name={icon} size={16} className="text-accent" />{title}</div>
      {!compact && <p className="text-[12.5px] text-ink-2">{body}</p>}
    </div>
  );
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch" data-testid="m04-triad">
      {box('book', t('m04.acad.triad.modules'), t('m04.acad.triad.modulesBody'), 'modules')}
      {box('briefcase', t('m04.acad.triad.project'), t('m04.acad.triad.projectBody'), 'project')}
      {box('users', t('m04.acad.triad.mentor'), t('m04.acad.triad.mentorBody'), 'mentor')}
      {box('shield', t('m04.acad.triad.reviewer'), t('m04.acad.triad.reviewerBody'), 'reviewer')}
    </div>
  );
}

export function Simulated() {
  const t = useT();
  return <SimChip label={t('m04.fsc.simulated')} />;
}

/** Hours, weeks and weekly hours as one line. */
export function useEnvelope() {
  const t = useT();
  const f = useFormat();
  return useMemo(() => (hours: number, weeks: number, weekly: number) => t('m04.fsc.envelope', { hours: f.num(hours), weeks: f.num(weeks), weekly: f.num(weekly) }), [t, f]);
}

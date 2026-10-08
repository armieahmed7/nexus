/** Shared M04/M05 view helpers (G2). Module-local; not part of the shared UI kit. */
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import type { CoursesRow, PeopleRow, ProgrammesRow } from '../../data/types';
import { SourceLink, StatusPill, type PillTone } from '../../ui';
import { useFormat, useLang, useT } from '../../i18n';
import { PERSONAS, useSession } from '../../auth/session';
import { isOpen } from '../../domain/learning';
import { daysBetween } from '../../domain/rules';

export const ENROL_TONE: Record<string, PillTone> = {
  assigned: 'neutral', requested: 'sim', approved: 'info', waitlisted: 'sim', enrolled: 'ok', in_progress: 'info', completed: 'ok', failed: 'bad', cancelled: 'neutral',
};
/** Status pill with G2 labels (m04.status.*), falling back to the shared common.status labels. */
export function G2Pill({ status, tone }: { status: string | null | undefined; tone?: PillTone }) {
  const t = useT();
  const s = status ?? '';
  const k = `m04.status.${s}`;
  const label = t(k) === k ? undefined : t(k);
  return <StatusPill status={s} tone={tone ?? ENROL_TONE[s]}>{label}</StatusPill>;
}

/** Label helpers for enums used across M04/M05 pages. */
export function useLabels() {
  const t = useT();
  return useMemo(() => {
    const lab = (group: string) => (v: string | null | undefined) => (v ? (t(`m04.${group}.${v}`) === `m04.${group}.${v}` ? v.replace(/_/g, ' ') : t(`m04.${group}.${v}`)) : '—');
    return {
      modality: lab('modality'), area: lab('area'), kind: lab('kind'), source: lab('source'), sessionKind: lab('sessionKind'), priority: lab('priority'),
      audience: lab('audience'), booking: lab('booking'), activity: lab('activity'), attendance: lab('attendance'), formKind: lab('formKind'), difficulty: lab('difficulty'),
    };
  }, [t]);
}

/** Public citations: [{id,label,url}] from the row, with the registry's "accessed" date as the as-of date. */
export function Sources({ items, compact }: { items: unknown; compact?: boolean }) {
  const repo = useRepo();
  const f = useFormat();
  const t = useT();
  const reg = useQuery('sources', () => repo.list('sources'), []);
  const list = (Array.isArray(items) ? items : []) as { id: string; label: string; url: string }[];
  if (!list.length) return null;
  const accessed = (id: string) => reg.data?.find((s) => s.id === id)?.accessed ?? null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? '' : 'mt-2'}`} data-testid="m04-sources">
      <span className="caps">{t('m04.common.sources')}</span>
      {list.map((s) => (
        <SourceLink key={s.id} href={s.url} date={accessed(s.id) ? t('common.asOf', { date: f.date(accessed(s.id)) }) : null}>
          {s.label}
        </SourceLink>
      ))}
    </div>
  );
}
/** Resolve source ids (paths content) against the citation registry. */
export function SourceIds({ ids }: { ids: string[] }) {
  const repo = useRepo();
  const reg = useQuery('sources', () => repo.list('sources'), []);
  const items = (reg.data ?? []).filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, label: s.label, url: s.url }));
  return <Sources items={items} compact />;
}

/** Synthetic people, as the current viewer may see them (staff views only; never on public pages). */
export function usePeople() {
  const repo = useRepo();
  const lang = useLang();
  const t = useT();
  const q = useQuery('people', () => repo.list('people'), []);
  return useMemo(() => {
    const byId = new Map<string, PeopleRow>((q.data ?? []).map((p) => [p.id, p]));
    const name = (id: string | null | undefined) => {
      if (!id) return '—';
      const p = byId.get(id);
      // A person outside the caller's read scope: show the demo persona's role title, or a neutral label (never a raw id).
      if (!p) {
        const card = PERSONAS.find((c) => c.person_id === id);
        return card ? (lang === 'ar' ? card.title_ar : card.title_en) : t('m04.common.staffMember');
      }
      return lang === 'ar' && p.display_name_ar ? p.display_name_ar : p.display_name;
    };
    return { list: q.data ?? [], byId, name, loading: q.loading };
  }, [q.data, q.loading, lang, t]);
}

export function useCatalogue() {
  const repo = useRepo();
  const courses = useQuery('courses', () => repo.list('courses', { order: [['code', 'asc']] }), []);
  const programmes = useQuery('programmes', () => repo.list('programmes', { order: [['sort', 'asc']] }), []);
  return useMemo(() => {
    const course = new Map<string, CoursesRow>((courses.data ?? []).map((c) => [c.id, c]));
    const programme = new Map<string, ProgrammesRow>((programmes.data ?? []).map((p) => [p.id, p]));
    return { courses: courses.data ?? [], programmes: programmes.data ?? [], course, programme, state: courses, pstate: programmes };
  }, [courses, programmes]);
}

/** The signed-in person's evidence for paths and "my learning" (own rows only, as the repository returns them). */
export function useMyEvidence() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  return useQuery(['enrolments', 'training_records', 'qual_records', 'licences'], async () => {
    if (!me) return null;
    const [enr, recs, quals, lic] = await Promise.all([
      repo.list('enrolments', { filter: { person_id: me } }),
      repo.list('training_records', { filter: { person_id: me } }),
      repo.list('qual_records', { filter: { person_id: me } }).catch(() => []),
      repo.list('licences', { filter: { person_id: me } }).catch(() => []),
    ]);
    return {
      roleId: s.person?.job_role_id ?? null,
      completedCourses: new Set([...recs.filter((r) => r.result !== 'failed').map((r) => r.course_id), ...enr.filter((e) => e.status === 'completed').map((e) => e.course_id)]),
      activeCourses: new Set(enr.filter((e) => isOpen(e.status)).map((e) => e.course_id)),
      qualifiedStandards: new Set(quals.filter((q) => ['qualified', 'due', 'renewed'].includes(q.status)).map((q) => q.standard_id)),
      activeStandards: new Set(quals.filter((q) => ['in_progress', 'planned'].includes(q.status)).map((q) => q.standard_id)),
      licences: new Set(lic.filter((l) => l.status === 'valid').map((l) => l.type as string)),
    };
  }, [me, s.person?.job_role_id]);
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  return <StatusPill tone={tone}>{children}</StatusPill>;
}

/** Days until a date (negative when past). */
/** Calendar days from today to `d` (0 = due today, negative = overdue). */
export const daysUntil = (d: string | null | undefined) => (d ? daysBetween(new Date(), d) : null);

// SHR-01 · One place that turns Kafa'a rows into calendar events, in the page language, so the same item gets the same
// UID (and the same wording) whether it is saved from /my/learning, /my/assessments, /my/plan, /my/quals, /my/licence,
// /licensing/calendar, /training/schedule or the "everything coming up" file on /my. Re-importing then updates an event
// instead of duplicating it. Every description ends with the demo-data note and a link back to the page.
import { useMemo } from 'react';
import type { AssessmentFormsRow, AttemptsRow, CoursesRow, ExamMilestonesRow, LicensingTasksRow, PlanActivitiesRow, QualRecordsRow, QualStandardsRow, ReportingObligationsRow, SessionsRow } from '../../data/types';
import { dubaiDate, type IcsEvent } from '../../domain/ics';
import { systemName, useFormat, usePick, useRefText, useT } from '../../i18n';
import { useCalendarLink } from '../../ui/AddToCalendar';

type KeyDateLite = { id: string; date: string; kind: string };
const lines = (...xs: (string | null | undefined | false)[]) => xs.filter(Boolean).join('\n');

type PickFn = ReturnType<typeof usePick>;
export interface CalendarDeps {
  t: (key: string, vars?: Record<string, string | number>) => string;
  pick: PickFn;
  f: Pick<ReturnType<typeof useFormat>, 'num' | 'pct'>;
  refText: (ref: string | null | undefined) => string;
  /** Absolute link to a page in the reader's language. */
  link: (path: string) => string;
}

/** The builders without React, for tests and for the "everything coming up" file. */
export function makeCalendarEvents({ t, pick, f, refText, link }: CalendarDeps) {
  const note = t('common.ics.note');
  const label = (key: string) => { const v = t(key); return v === key ? null : v; };
  const enrolmentStatus = (st: string) => label(`m04.status.${st}`) ?? label(`common.status.${st}`) ?? st.replace(/_/g, ' ');
  return {
    /** A booked or scheduled training session (timed). With the learner's enrolment status when it is theirs. */
    session(x: SessionsRow, course: CoursesRow | undefined, page: string, kindLabel?: string, status?: string): IcsEvent {
      const title = course ? pick(course, 'title') : x.course_id;
      return {
        uid: `kafaa-session-${x.id}`,
        summary: t('common.ics.sum.session', { title }),
        start: x.starts_at,
        end: x.ends_at,
        location: pick(x, 'location') || x.location,
        description: lines(course && t('common.ics.desc.course', { code: course.code }), kindLabel && t('common.ics.desc.kind', { kind: kindLabel }), x.crew && t('common.ics.desc.crew', { crew: x.crew }), status && t('common.ics.desc.status', { status: enrolmentStatus(status) }), note),
        url: link(page),
      };
    },
    /** A scheduled exam or assessment slot (timed; length from the form's time limit, else one hour). */
    attempt(a: AttemptsRow, form: AssessmentFormsRow | undefined, page: string): IcsEvent | null {
      if (!a.scheduled_for || Number.isNaN(new Date(a.scheduled_for).getTime())) return null;
      const minutes = form?.time_limit_min && form.time_limit_min > 0 ? form.time_limit_min : 60;
      return {
        uid: `kafaa-attempt-${a.id}`,
        summary: t('common.ics.sum.assessment', { title: form ? pick(form, 'title') : a.form_id }),
        start: a.scheduled_for,
        end: new Date(new Date(a.scheduled_for).getTime() + minutes * 60_000).toISOString(),
        description: lines(form && t('common.ics.desc.rules', { n: f.num(form.item_ids.length), min: f.num(form.time_limit_min), pass: f.pct(form.pass_mark, 0) }), note),
        url: link(page),
      };
    },
    /** A development-plan activity due date (all-day). */
    planActivity(a: PlanActivitiesRow, page: string, roleTitle?: string): IcsEvent | null {
      if (!a.due_on) return null;
      return { uid: `kafaa-plan-${a.id}`, summary: t('common.ics.sum.due', { title: pick(a, 'title') }), start: a.due_on, description: lines(roleTitle && t('common.ics.desc.plan', { role: roleTitle }), note), url: link(page) };
    },
    /** A qualification expiry (all-day). Security-restricted records never carry dates, so callers leave them out. */
    qualExpiry(r: QualRecordsRow, std: QualStandardsRow | undefined, page: string): IcsEvent | null {
      if (!r.expires_on || r.security_mirror_only) return null;
      const title = std ? `${std.code} ${pick(std, 'title')}` : r.standard_id;
      return { uid: `kafaa-qual-${r.id}`, summary: t('common.ics.sum.expiry', { title }), start: r.expires_on, description: lines(t('common.ics.mirror', { system: systemName(t, r.source_system) }), note), url: link(page) };
    },
    /** A licence key date: certificate expiry, renewal window, medical due, quarter end, requalification (all-day). */
    licenceDate(k: KeyDateLite, page: string, system?: string): IcsEvent {
      return { uid: `kafaa-licence-${k.id}-${k.date}`, summary: t('common.ics.sum.licence', { title: t(`m03.dates.${k.kind}`) }), start: k.date, description: lines(system && t('common.ics.mirror', { system: systemName(t, system) }), note), url: link(page) };
    },
    /** An open licensing task with a due date (all-day). */
    licensingTask(x: LicensingTasksRow, page: string): IcsEvent | null {
      const date = dubaiDate(x.due_at);
      if (!date) return null;
      return { uid: `kafaa-ltask-${x.id}`, summary: t('common.ics.sum.due', { title: pick(x, 'title') }), start: date, description: lines(x.rule_ref && t('common.ics.desc.rule', { ref: refText(x.rule_ref) }), note), url: link(page) };
    },
    /** An exam milestone (all-day). */
    milestone(m: ExamMilestonesRow, page: string): IcsEvent {
      const kind = t(`m03.ms.${m.kind}`);
      return { uid: `kafaa-milestone-${m.id}`, summary: m.note_en ? `${kind}: ${pick(m, 'note')}` : kind, start: m.due_on, description: lines(note), url: link(page) };
    },
    /** A licensing reporting obligation (all-day), with the rule, the owner role and "Kafa'a sends nothing to FANR". */
    obligation(o: ReportingObligationsRow, page: string): IcsEvent {
      return {
        uid: `kafaa-obligation-${o.id}`,
        summary: t('common.ics.sum.obligation', { title: pick(o, 'title') }),
        start: o.due_on,
        description: lines(t('common.ics.desc.rule', { ref: refText(o.rule_ref) }), t('common.ics.desc.owner', { role: o.owner_role }), t('common.ics.notFanr'), note),
        url: link(page),
      };
    },
  };
}
export type CalendarEvents = ReturnType<typeof makeCalendarEvents>;

export function useCalendarEvents(): CalendarEvents {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const refText = useRefText();
  const link = useCalendarLink();
  return useMemo(() => makeCalendarEvents({ t, pick, f, refText, link }), [t, pick, f, refText, link]);
}

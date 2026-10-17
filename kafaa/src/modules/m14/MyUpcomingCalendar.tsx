// SHR-01 · /my "Add everything coming up to calendar": one .ics with the person's booked sessions, scheduled assessments,
// plan due dates, qualification expiries and licence dates. The extra rows (sessions, attempts, licensing items) are read
// only when the button is pressed, with an explicit person filter, so /my does not get slower. Nothing is stored or sent.
import { useState } from 'react';
import { useRepo } from '../../data';
import type { CoursesRow, DevPlansRow, EnrolmentsRow, JobRolesRow, LicencesRow, MedicalDueRow, PlanActivitiesRow, QualRecordsRow, QualStandardsRow } from '../../data/types';
import { buildIcs } from '../../domain/ics';
import { useCount, useLang, usePick, useT } from '../../i18n';
import { Icon, saveIcs, useToast } from '../../ui';
import { collectUpcoming } from '../../shell/calendar/upcoming';
import { useCalendarEvents } from '../../shell/calendar/useCalendarEvents';
import { useLabels } from '../m04/ui';

export interface MyUpcomingCalendarProps {
  personId: string;
  enrolments: EnrolmentsRow[];
  courses: CoursesRow[];
  plans: DevPlansRow[];
  activities: PlanActivitiesRow[];
  roles: JobRolesRow[];
  quals: QualRecordsRow[];
  standards: QualStandardsRow[];
  licence: LicencesRow | null;
  medical: MedicalDueRow | null;
}

export function MyUpcomingCalendar(p: MyUpcomingCalendarProps) {
  const t = useT();
  const plural = useCount();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const toast = useToast();
  const cal = useCalendarEvents();
  const lab = useLabels();
  const [busy, setBusy] = useState(false);
  const me = { filter: { person_id: p.personId } } as const;
  const onClick = async () => {
    setBusy(true);
    try {
      const sessionIds = [...new Set(p.enrolments.map((e) => e.session_id).filter((x): x is string => !!x))];
      const [sessions, attempts, forms, tasks, milestones, requal] = await Promise.all([
        sessionIds.length ? repo.list('sessions', { filter: { id: sessionIds } }).catch(() => []) : Promise.resolve([]),
        repo.list('attempts', { filter: { person_id: p.personId, status: 'scheduled' } }).catch(() => []),
        repo.list('assessment_forms').catch(() => []),
        p.licence ? repo.list('licensing_tasks', { filter: { person_id: p.personId, status: 'open' } }).catch(() => []) : Promise.resolve([]),
        p.licence ? repo.list('exam_milestones', { filter: { person_id: p.personId } }).catch(() => []) : Promise.resolve([]),
        p.licence ? repo.list('requal_cycles', me).catch(() => []) : Promise.resolve([]),
      ]);
      const events = collectUpcoming(
        { ...p, sessions, attempts, forms, tasks, milestones, requal: requal[0] ?? null },
        cal,
        { sessionKind: (k) => lab.sessionKind(k), roleTitle: (r) => pick(r, 'title') },
      );
      if (!events.length) {
        toast.push({ tone: 'info', title: t('common.ics.nothing') });
        return;
      }
      saveIcs('coming-up', buildIcs(events, { name: t('common.ics.cal.upcoming'), lang }));
      toast.push({ tone: 'ok', title: t('common.ics.saved', { n: plural('common.ics.nEvents', events.length) }), detail: t('common.ics.savedDetail') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn-outline btn-sm" onClick={onClick} disabled={busy} aria-busy={busy} title={t('common.ics.upcomingHint')} data-testid="m14-my-ics">
      <Icon name="calendar" size={14} />
      <span>{t('common.ics.addUpcoming')}</span>
    </button>
  );
}

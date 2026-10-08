// /learn/course/:id (M04): objectives tied to competencies, modality, prerequisites, modules, linked evaluation;
// sessions, enrolment and waitlist for signed-in staff only (schedules and rosters stay internal).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Grid, KeyValue, Async, EmptyState, Callout, ConfirmDialog, DataTable, Icon, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { SessionsRow } from '../../data/types';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { isOpen, missingPrerequisites } from '../../domain/learning';
import { Chip, G2Pill, Sources, useLabels, usePeople } from './ui';

export default function LearnCoursePage() {
  const { id = '' } = useParams();
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const f = useFormat();
  const lab = useLabels();
  const repo = useRepo();
  const s = useSession();
  const run = useAction();
  const people = usePeople();
  const me = s.identity.personId;
  const staff = s.can('training', ['Own', 'W', 'A', 'OwnOrg']);
  const [confirm, setConfirm] = useState<{ session: SessionsRow | null } | null>(null);
  const [withdraw, setWithdraw] = useState(false);

  const q = useQuery(['courses', 'course_modules', 'programmes', 'competencies', 'sessions', 'enrolments', 'assessment_forms', 'training_records'], async () => {
    const course = await repo.get('courses', id);
    if (!course) return { course: null } as const;
    const [modules, programme, comps, sessions, forms, allCourses] = await Promise.all([
      repo.list('course_modules', { filter: { course_id: id }, order: [['n', 'asc']] }),
      course.programme_id ? repo.get('programmes', course.programme_id) : Promise.resolve(null),
      repo.list('competencies'),
      staff ? repo.list('sessions', { filter: { course_id: id }, order: [['starts_at', 'asc']] }) : Promise.resolve([]),
      course.evaluation_form_id && staff ? repo.list('assessment_forms', { filter: { id: course.evaluation_form_id } }).catch(() => []) : Promise.resolve([]),
      repo.list('courses'),
    ]);
    const mine = staff && me ? await repo.list('enrolments', { filter: { course_id: id, person_id: me } }) : [];
    const avail = staff ? await repo.rpc.sessionAvailability(id) : null;
    const seatsBySession = new Map((avail?.data ?? []).map((a) => [a.session_id, a]));
    const records = me ? await repo.list('training_records', { filter: { person_id: me } }) : [];
    const myCompleted = me ? await repo.list('enrolments', { filter: { person_id: me, status: 'completed' } }) : [];
    return { course, modules, programme, comps, sessions, form: forms[0] ?? null, allCourses, seatsBySession, mine, records, myCompleted };
  }, [id, me, staff]);

  return (
    <Async state={q} isEmpty={(d) => !d.course} empty={
      <Page title={t('m04.routes.learn-course.title')}>
        <EmptyState icon="book" title={t('m04.course.notFound')} action={<L to="/learn" className="btn-outline btn-sm">{t('m04.course.backToCatalogue')}</L>}>
          {s.status !== 'signed_in' ? t('m04.course.notFoundAnon') : t('m04.course.notFoundStaff')}
        </EmptyState>
      </Page>}>
      {(d) => {
        if (!d.course) return null;
        const c = d.course;
        const compName = (cid: string) => { const x = d.comps.find((k) => k.id === cid); return x ? `${x.code} · ${pick(x, 'name')}` : cid; };
        const courseCode = (cid: string) => d.allCourses.find((k) => k.id === cid);
        const done = new Set([...d.records.filter((r) => r.result !== 'failed').map((r) => r.course_id), ...d.myCompleted.map((e) => e.course_id)]);
        const missing = me ? missingPrerequisites(c.prerequisites ?? [], done) : [];
        const active = d.mine.find((e) => isOpen(e.status));
        const upcoming = d.sessions.filter((x) => x.status === 'scheduled' && x.starts_at > new Date().toISOString());
        // A booking on a cancelled or closed session no longer holds the learner (they can book another session).
        const bookedLive = !!active?.session_id && d.sessions.some((x) => x.id === active.session_id && x.status === 'scheduled');
        const seats = (sid: string) => d.seatsBySession.get(sid)?.taken ?? 0;
        const waiting = (sid: string) => d.seatsBySession.get(sid)?.waiting ?? 0;
        const objectives = (Array.isArray(c.objectives) ? c.objectives : []) as { competency_id?: string; en: string; ar: string }[];
        return (
          <Page title={pick(c, 'title')} eyebrow={<span className="ltr">{c.code}</span>} intro={pick(c, 'summary') || (d.programme ? pick(d.programme, 'purpose') : '')}
            actions={<L to="/learn" className="btn-outline btn-sm"><Icon name="back" size={14} />{t('m04.course.backToCatalogue')}</L>}>
            <div className="flex flex-wrap gap-1.5" data-testid="m04-course-chips">
              <Chip tone="accent">{lab.modality(c.modality)}</Chip>
              <Chip>{c.initial ? t('m04.common.initial') : t('m04.common.continuing')}</Chip>
              <Chip>{c.mandatory ? t('m04.common.mandatory') : t('m04.common.elective')}</Chip>
              {c.qualifying && <Chip tone="info">{t('m04.status.qualifying')}</Chip>}
              <Chip>{lab.audience(c.audience)}</Chip>
              {c.packaging && c.packaging !== 'none' && <Chip>{c.packaging === 'scorm' ? 'SCORM' : 'xAPI'}</Chip>}
              {c.concept_content && <Chip tone="sim">{t('m04.course.concept')}</Chip>}
            </div>

            <Grid cols={3}>
              <Card title={t('m04.course.facts')} className="sm:col-span-1">
                <KeyValue items={[
                  [t('m04.course.programme'), d.programme ? <L key="p" to={`/learn#area-${d.programme.area}`}>{pick(d.programme, 'name')}</L> : '—'],
                  [t('m04.course.duration'), c.duration_hours != null ? t('m04.common.hours', { n: f.num(c.duration_hours) }) : '—'],
                  [t('m04.course.programmeDuration'), d.programme ? pick(d.programme, 'duration') || '—' : '—'],
                  [t('m04.course.passMark'), c.pass_mark != null ? f.pct(c.pass_mark, 0) : '—'],
                  [t('m04.course.validity'), c.validity_months ? t('m04.common.months', { n: f.num(c.validity_months) }) : '—'],
                  [t('m04.course.owner'), c.owner_role],
                ]} />
                {d.programme && <Sources items={(c.sources as unknown[])?.length ? c.sources : d.programme.sources} />}
              </Card>
              <Card title={t('m04.course.objectives')} className="sm:col-span-2">
                {objectives.length === 0 ? <p className="text-ink-3">{t('m04.course.noObjectives')}</p> : (
                  <ul className="space-y-2" data-testid="m04-objectives">
                    {objectives.map((o, i) => (
                      <li key={i} className="flex gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-ok" />
                        <div>
                          <div>{lang === 'ar' ? o.ar : o.en}</div>
                          {o.competency_id && <div className="text-[12px] text-ink-3">{t('m04.course.competency')}: {compName(o.competency_id)}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {(c.competency_ids ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    <span className="caps me-1">{t('m04.course.competencies')}</span>
                    {c.competency_ids.map((k) => <L key={k} to="/competencies" className="chip border-line bg-sunken text-ink-2 link-plain">{compName(k)}</L>)}
                  </div>
                )}
              </Card>
            </Grid>

            <Grid cols={2}>
              <Card title={t('m04.course.prerequisites')}>
                {(c.prerequisites ?? []).length === 0 ? <p className="text-ink-3">{t('m04.course.noPrereq')}</p> : (
                  <ul className="space-y-1.5">
                    {c.prerequisites.map((p) => {
                      const pc = courseCode(p);
                      const ok = !missing.includes(p);
                      return (
                        <li key={p} className="flex items-center justify-between gap-2">
                          <L to={`/learn/course/${p}`}>{pc ? `${pc.code} · ${pick(pc, 'title')}` : p}</L>
                          {me && <G2Pill status={ok ? 'met' : 'not_met'} tone={ok ? 'ok' : 'bad'} />}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
              <Card title={t('m04.course.modules')}>
                {d.modules.length === 0 ? <p className="text-ink-3">{t('m04.course.noModules')}</p> : (
                  <ol className="space-y-1.5">
                    {d.modules.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                        <span><span className="num me-2 text-ink-3">{f.num(m.n)}.</span>{pick(m, 'title')}</span>
                        <span className="num text-ink-3">{t('m04.common.minutes', { n: f.num(m.minutes) })}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </Grid>

            {c.qualifying && (
              <Callout title={t('m04.course.evaluationTitle')}>
                {t('m04.course.evaluationBody')}
                {d.form && <span className="mt-1 block">{t('m04.course.evaluationForm', { form: pick(d.form, 'title'), kind: lab.formKind(d.form.kind), pass: f.pct(d.form.pass_mark, 0), max: f.num(d.form.max_attempts), wait: f.num(d.form.retake_wait_days) })}</span>}
              </Callout>
            )}

            {!staff ? (
              <Callout title={t('m04.course.internalTitle')}>{t('m04.course.internalBody')} {s.status !== 'signed_in' && <L to={`/sign-in?next=/learn/course/${c.id}`}>{t('m04.course.signIn')}</L>}</Callout>
            ) : (
              <Section title={t('m04.course.sessions')} description={t('m04.course.sessionsIntro')}
                actions={active ? <div className="flex items-center gap-2"><span className="caps">{t('m04.course.myStatus')}</span><G2Pill status={active.status} />{active.status !== 'assigned' && <button className="btn-outline btn-sm" onClick={() => setWithdraw(true)} data-testid="m04-withdraw">{t('m04.course.withdraw')}</button>}</div> : null}>
                {missing.length > 0 && <Callout tone="sim" title={t('m04.course.prereqMissing')}>{missing.map((m) => courseCode(m)?.code ?? m).join(', ')}</Callout>}
                {people.loading ? <Skeleton /> : (
                  <DataTable rows={upcoming} rowKey={(r) => r.id} searchable={false} empty={t('m04.course.noSessions')} columns={[
                    { key: 'when', header: t('m04.common.when'), value: (r) => r.starts_at, render: (r) => f.dateTime(r.starts_at), sortable: true },
                    { key: 'where', header: t('m04.common.where'), value: (r) => r.location },
                    { key: 'kind', header: t('m04.common.kind'), value: (r) => lab.sessionKind(r.kind) },
                    { key: 'crew', header: t('m04.common.crew'), value: (r) => r.crew ?? '—' },
                    { key: 'instr', header: t('m04.common.instructor'), value: (r) => people.name(r.instructor_person_id) },
                    { key: 'seats', header: t('m04.common.seats'), value: (r) => r.capacity - seats(r.id), render: (r) => <span className="num">{t('m04.course.seatsLeft', { n: f.num(Math.max(0, r.capacity - seats(r.id))), cap: f.num(r.capacity) })}{waiting(r.id) ? ` · ${t('m04.course.waiting', { n: f.num(waiting(r.id)) })}` : ''}</span> },
                    { key: 'act', header: '', csv: false, render: (r) => {
                      const full = seats(r.id) >= r.capacity;
                      const booked = active?.session_id === r.id;
                      return booked ? <G2Pill status={active!.status} /> : (
                        <button className="btn-primary btn-sm" disabled={missing.length > 0 || bookedLive || active?.status === 'requested'} onClick={() => setConfirm({ session: r })} data-testid="m04-enrol">
                          {full ? t('m04.course.joinWaitlist') : !c.mandatory && !active ? t('m04.course.request') : t('m04.course.book')}
                        </button>
                      );
                    } },
                  ]} />
                )}
                {!active && upcoming.length === 0 && (c.modality === 'elearning' || c.audience !== 'staff') && (
                  <button className="btn-primary" disabled={missing.length > 0} onClick={() => setConfirm({ session: null })} data-testid="m04-enrol-selfpaced">{c.mandatory || c.audience !== 'staff' ? t('m04.course.enrolSelfPaced') : t('m04.course.request')}</button>
                )}
              </Section>
            )}

            <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={t('m04.course.confirmTitle')}
              consequence={confirm?.session ? t('m04.course.confirmSession', { course: pick(c, 'title'), when: f.dateTime(confirm.session.starts_at) }) : t('m04.course.confirmSelf', { course: pick(c, 'title') })}
              confirmLabel={t('m04.course.confirm')} onConfirm={async () => { await run(() => repo.rpc.enrolCourse(c.id, confirm?.session?.id ?? null)); }}>
              {!c.mandatory && !active && c.audience === 'staff' && <p className="text-[13px] text-ink-2">{t('m04.course.electiveNote')}</p>}
            </ConfirmDialog>
            <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m04.course.withdrawTitle')} consequence={c.mandatory || active?.source === 'role_rule' ? t('m04.course.withdrawMandatory') : t('m04.course.withdrawElective')}
              danger confirmLabel={t('m04.course.withdraw')} onConfirm={async () => { if (active) await run(() => repo.rpc.cancelEnrolment(active.id, '')); }} />
          </Page>
        );
      }}
    </Async>
  );
}


// M09 /partner/academy: supplier courses with certificates. Enrol, work through the modules, pass the knowledge check
// (scored on the server) and receive an internal Kafa'a course certificate that anyone can verify. Partner admins also see
// and assign their own organisation's people. Course titles come from the NEXUS concept: concept content until ENEC confirms.
import { useState } from 'react';
import { Page, Card, Callout, Async, EmptyState, Tabs, Drawer, ProgressBar, RadioGroup, SimChip, StatusPill, DataTable, ConfirmDialog, SelectField, Icon, type Column } from '../../ui';
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { MStatus, useMyOrg } from './shared';

type Course = RowOf<'courses'>;
type Enrol = RowOf<'enrolments'>;
type Check = RowOf<'academy_checks'>;
type Opt = { en: string; ar: string };

export default function PartnerAcademyPage() {
  const t = useT();
  const repo = useRepo();
  const { personId, orgId, isAdmin } = useMyOrg();
  const q = useQuery(['courses', 'course_modules', 'academy_checks', 'enrolments', 'certificates', 'people'], async () => {
    const courses = await repo.list('courses', { filter: { audience: 'supplier' }, order: [['code', 'asc']] });
    const ids = courses.map((c) => c.id);
    const [modules, checks, enrol, certs, people] = await Promise.all([
      repo.list('course_modules', { filter: { course_id: ids }, order: [['n', 'asc']] }),
      repo.list('academy_checks', { filter: { course_id: ids }, order: [['n', 'asc']] }),
      repo.list('enrolments', { filter: { course_id: ids } }),
      repo.list('certificates', { filter: { course_id: ids } }),
      isAdmin ? repo.list('people', { filter: { org_id: orgId ?? '' }, order: [['display_name', 'asc']] }) : Promise.resolve([] as RowOf<'people'>[]),
    ]);
    return { courses, modules, checks, enrol, certs, people };
  }, [personId, orgId, isAdmin]);
  return (
    <Page title={t('m09.routes.partner-academy.title')} intro={t('m09.academy.intro')} actions={<SimChip label={t('m09.academy.concept')} />}>
      <Callout tone="sim" title={t('m09.academy.conceptTitle')}>{t('m09.academy.conceptBody')}</Callout>
      <Async state={q} isEmpty={(d) => d.courses.length === 0} empty={<EmptyState title={t('m09.academy.noCourses')} />}>
        {(d) => <Academy {...d} personId={personId} isAdmin={isAdmin} />}
      </Async>
    </Page>
  );
}

function Academy({ courses, modules, checks, enrol, certs, people, personId, isAdmin }: {
  courses: Course[]; modules: RowOf<'course_modules'>[]; checks: Check[]; enrol: Enrol[]; certs: RowOf<'certificates'>[]; people: RowOf<'people'>[]; personId: string | null; isAdmin: boolean;
}) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [open, setOpen] = useState<string | null>(null);
  const mine = enrol.filter((e) => e.person_id === personId && !['cancelled'].includes(e.status));
  const myCerts = certs.filter((c) => c.person_id === personId);
  const enrolFor = (courseId: string) => mine.find((e) => e.course_id === courseId) ?? null;
  const course = courses.find((c) => c.id === open) ?? null;

  const certCols: Column<RowOf<'certificates'>>[] = [
    { key: 'no', header: t('m09.academy.certNo'), value: (c) => c.id, render: (c) => <span className="num ltr font-semibold">{c.id}</span>, sortable: true },
    { key: 'course', header: t('m09.academy.course'), value: (c) => { const co = courses.find((x) => x.id === c.course_id); return co ? `${co.code} ${pick(co, 'title')}` : c.course_id; } },
    { key: 'issued', header: t('m09.academy.issued'), value: (c) => c.issued_on, render: (c) => f.date(c.issued_on), sortable: true },
    { key: 'valid', header: t('m09.academy.validTo'), value: (c) => c.valid_to ?? '', render: (c) => (c.valid_to ? f.date(c.valid_to) : '—') },
    { key: 'status', header: t('m09.onb.col.status'), value: (c) => c.status, render: (c) => <MStatus status={c.status} /> },
    { key: 'verify', header: '', csv: false, render: (c) => <L to={`/verify?no=${encodeURIComponent(c.id)}`} className="text-[12.5px]">{t('m09.academy.verify')}</L> },
  ];

  const tabs = [
    {
      id: 'courses',
      label: t('m09.academy.tabCourses'),
      content: (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m09-academy-courses">
          {courses.map((c) => {
            const e = enrolFor(c.id);
            return (
              <li key={c.id} className="card flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="caps num">{c.code}</div>
                    <h3 className="font-semibold leading-snug">{pick(c, 'title')}</h3>
                  </div>
                  {e ? <MStatus status={e.status} /> : <StatusPill status="not_started">{t('m09.academy.notEnrolled')}</StatusPill>}
                </div>
                <p className="text-[13px] text-ink-2">{pick(c, 'summary')}</p>
                <div className="flex flex-wrap gap-1 text-[12px]">
                  <span className="chip border-line bg-sunken text-ink-2">{t(`m09.modality.${c.modality}`)}</span>
                  {c.duration_hours != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.hours', { n: f.num(c.duration_hours) })}</span>}
                  {c.pass_mark != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.passMark', { n: f.num(c.pass_mark) })}</span>}
                  {c.validity_months != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.validity', { n: f.num(c.validity_months) })}</span>}
                </div>
                {e && <ProgressBar value={e.progress_pct ?? 0} label={t('m09.academy.progress', { n: f.num(e.progress_pct ?? 0) })} />}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {e?.certificate_no ? <span className="num ltr text-[12px] text-ok">{e.certificate_no}</span> : <span />}
                  <button className={e ? 'btn-outline btn-sm' : 'btn-primary btn-sm'} onClick={() => setOpen(c.id)} data-testid={`m09-academy-open-${c.id}`}>
                    {e ? (e.status === 'completed' ? t('m09.academy.review') : t('m09.academy.continue')) : t('m09.academy.details')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      id: 'certs',
      label: t('m09.academy.tabCerts'),
      badge: myCerts.length || undefined,
      content: myCerts.length ? <DataTable rows={myCerts} columns={certCols} rowKey={(c) => c.id} csvName="kafaa-supplier-certificates" caption={t('m09.academy.tabCerts')} /> : <EmptyState title={t('m09.academy.noCerts')}>{t('m09.academy.noCertsBody')}</EmptyState>,
    },
    ...(isAdmin ? [{ id: 'team', label: t('m09.academy.tabTeam'), content: <Team courses={courses} enrol={enrol} people={people} personId={personId} /> }] : []),
  ];

  return (
    <>
      <Tabs tabs={tabs} />
      <Drawer open={!!course} onClose={() => setOpen(null)} title={course ? `${course.code} · ${pick(course, 'title')}` : ''}>
        {course && <CourseDetail course={course} modules={modules.filter((m) => m.course_id === course.id)} checks={checks.filter((c) => c.course_id === course.id)} e={enrolFor(course.id)} />}
      </Drawer>
    </>
  );
}

function CourseDetail({ course, modules, checks, e }: { course: Course; modules: RowOf<'course_modules'>[]; checks: Check[]; e: Enrol | null }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; certificate_no: string | null } | null>(null);
  const n = modules.length || 1;
  const doneModules = e ? Math.min(n, Math.round(((e.progress_pct ?? 0) / 100) * n)) : 0;
  const ready = !!e && doneModules >= n && e.status !== 'completed';
  const lang = useLang();

  const enrol = () => run(() => repo.rpc.enrolSupplierCourse(course.id, null), { success: t('m09.academy.enrolled') });
  const completeModule = async () => {
    if (!e) return;
    const pct = Math.min(100, Math.round(((doneModules + 1) / n) * 100));
    await run(() => repo.update('enrolments', e.id, { progress_pct: pct, status: e.status === 'enrolled' || e.status === 'assigned' ? 'in_progress' : e.status }), { success: t('m09.academy.moduleDone') });
  };
  const submit = async () => {
    if (!e) return;
    const r = await run(() => repo.rpc.completeSupplierCourse(e.id, checks.map((c) => ({ check_id: c.id, answer: answers[c.id] ?? -1 }))));
    if (r.ok && r.data) setResult(r.data);
  };

  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-ink-2">{pick(course, 'summary')}</p>
      <div className="flex flex-wrap gap-1 text-[12px]">
        <span className="chip border-line bg-sunken text-ink-2">{t(`m09.modality.${course.modality}`)}</span>
        {course.duration_hours != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.hours', { n: f.num(course.duration_hours) })}</span>}
        {course.pass_mark != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.passMark', { n: f.num(course.pass_mark) })}</span>}
        <SimChip label={t('m09.academy.concept')} />
      </div>
      {!e ? (
        <button className="btn-primary" onClick={enrol} data-testid="m09-academy-enrol">{t('m09.academy.enrol')}</button>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2"><MStatus status={e.status} />{e.due_on && <span className="text-[12.5px] text-ink-3">{t('m09.academy.due', { date: f.date(e.due_on) })}</span>}</div>
          <ProgressBar value={e.progress_pct ?? 0} label={t('m09.academy.progress', { n: f.num(e.progress_pct ?? 0) })} />
        </div>
      )}

      <section>
        <h3 className="mb-2 font-semibold">{t('m09.academy.modules')}</h3>
        <ol className="space-y-1.5">
          {modules.map((m, i) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-btn border border-line p-2 text-[13px]">
              <span className="flex items-center gap-2">
                <Icon name={i < doneModules ? 'check' : 'book'} size={14} className={i < doneModules ? 'text-ok' : 'text-ink-3'} />
                {pick(m, 'title')}
              </span>
              <span className="num text-ink-3">{t('m09.academy.minutes', { n: f.num(m.minutes) })}</span>
            </li>
          ))}
        </ol>
        {e && e.status !== 'completed' && doneModules < n && (
          <button className="btn-outline btn-sm mt-2" onClick={completeModule} data-testid="m09-academy-module">{t('m09.academy.completeModule', { n: f.num(doneModules + 1) })}</button>
        )}
      </section>

      {e && e.status !== 'completed' && (
        <section className="space-y-3" aria-live="polite">
          <h3 className="font-semibold">{t('m09.academy.check')}</h3>
          {!ready ? (
            <p className="text-[13px] text-ink-3">{t('m09.academy.checkLocked')}</p>
          ) : checks.length === 0 ? (
            <p className="text-[13px] text-ink-3">{t('m09.academy.noCheck')}</p>
          ) : (
            <>
              {checks.map((c) => (
                <Card key={c.id}>
                  <RadioGroup
                    label={<span><span className="num">{f.num(c.n)}.</span> {lang === 'ar' ? c.q_ar : c.q_en}</span>}
                    name={`q-${c.id}`}
                    value={answers[c.id] == null ? '' : String(answers[c.id])}
                    onChange={(v) => setAnswers((a) => ({ ...a, [c.id]: Number(v) }))}
                    options={((c.options as Opt[]) ?? []).map((o, i) => ({ value: String(i), label: lang === 'ar' ? o.ar : o.en }))}
                  />
                </Card>
              ))}
              <button className="btn-primary" disabled={checks.some((c) => answers[c.id] == null)} onClick={submit} data-testid="m09-academy-submit">{t('m09.academy.submitCheck')}</button>
            </>
          )}
          {result && !result.passed && <Callout tone="bad" title={t('m09.academy.failTitle', { n: f.num(result.score) })}>{t('m09.academy.failBody', { n: f.num(course.pass_mark ?? 80) })}</Callout>}
        </section>
      )}
      {(result?.passed || e?.status === 'completed') && (
        <Callout tone="ok" title={t('m09.academy.passTitle', { n: f.num(result?.score ?? e?.score ?? 0) })}>
          {t('m09.academy.passBody', { no: result?.certificate_no ?? e?.certificate_no ?? '' })}{' '}
          <L to={`/verify?no=${encodeURIComponent(result?.certificate_no ?? e?.certificate_no ?? '')}`}>{t('m09.academy.verify')}</L>
        </Callout>
      )}
      <p className="text-[12px] text-ink-3">{t('m09.academy.certNote')}</p>
    </div>
  );
}

function Team({ courses, enrol, people, personId }: { courses: Course[]; enrol: Enrol[]; people: RowOf<'people'>[]; personId: string | null }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [assign, setAssign] = useState<{ person: string; course: string }>({ person: '', course: '' });
  const [confirm, setConfirm] = useState(false);
  const staff = people.filter((p) => p.id !== personId);
  const status = (p: string, c: string) => enrol.find((e) => e.person_id === p && e.course_id === c && e.status !== 'cancelled')?.status ?? null;
  const pct = (c: string) => {
    const done = people.filter((p) => status(p.id, c) === 'completed').length;
    return people.length ? Math.round((done / people.length) * 100) : 0;
  };
  if (!people.length) return <EmptyState title={t('m09.academy.noTeam')} />;
  return (
    <div className="space-y-4">
      <Card title={t('m09.academy.assignTitle')}>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
          <SelectField label={t('m09.academy.person')} name="person" value={assign.person} onChange={(v) => setAssign((a) => ({ ...a, person: v }))} options={staff.map((p) => ({ value: p.id, label: p.display_name }))} />
          <SelectField label={t('m09.academy.course')} name="course" value={assign.course} onChange={(v) => setAssign((a) => ({ ...a, course: v }))} options={courses.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` }))} />
          <button className="btn-primary" disabled={!assign.person || !assign.course || !!status(assign.person, assign.course)} onClick={() => setConfirm(true)} data-testid="m09-academy-assign">{t('m09.academy.assign')}</button>
        </div>
        {assign.person && assign.course && status(assign.person, assign.course) && <p className="mt-2 text-[12.5px] text-ink-3">{t('m09.academy.alreadyEnrolled')}</p>}
      </Card>
      <div className="card overflow-x-auto">
        <table className="table-base w-full text-[12.5px]" data-testid="m09-academy-matrix">
          <caption className="sr-only">{t('m09.academy.matrix')}</caption>
          <thead className="bg-raised">
            <tr>
              <th scope="col">{t('m09.academy.person')}</th>
              {courses.map((c) => <th key={c.id} scope="col" className="num text-center" title={pick(c, 'title')}>{c.code}</th>)}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="text-start font-medium">{p.display_name}{p.id === personId ? ` (${t('m09.academy.you')})` : ''}</th>
                {courses.map((c) => {
                  const s = status(p.id, c.id);
                  return <td key={c.id} className="text-center">{s ? <MStatus status={s} /> : <span className="text-ink-3">—</span>}</td>;
                })}
              </tr>
            ))}
            <tr className="bg-sunken">
              <th scope="row" className="text-start">{t('m09.academy.completion')}</th>
              {courses.map((c) => <td key={c.id} className="num text-center font-semibold">{f.pct(pct(c.id), 0)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m09.academy.assign')} consequence={t('m09.academy.assignBody')} actingAs={t('m09.home.roleAdmin')}
        onConfirm={async () => { const r = await run(() => repo.rpc.enrolSupplierCourse(assign.course, assign.person), { success: t('m09.academy.assigned') }); if (r.ok) setAssign({ person: '', course: '' }); }} />
    </div>
  );
}

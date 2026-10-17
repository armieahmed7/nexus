// MGR-05: the "To book" tab on /training/cohorts. Assigned or approved training without a seat on a scheduled session, grouped by
// course (most urgent first), with the next sessions that still have free seats, "Book N people" on a session (rpc.enrolCourse
// for each person, which books the existing enrolment), a link to the schedule, and the full list with filters and CSV.
// Rows come through RLS (what the caller may read); the RPC checks again who may book whom. People are synthetic.
import { useMemo, useState } from 'react';
import { Async, Callout, Card, ConfirmDialog, DataTable, FilterBar, Grid, Icon, Skeleton, StatTile, useFilters, useToast } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Chip, G2Pill, useCatalogue, useLabels, usePeople } from './ui';
import { groupByCourse, pickForSession, toBookList, type BookPriority, type OpenSession, type ToBookItem } from './toBook';

const PRIO_TONE: Record<BookPriority, 'bad' | 'accent' | 'neutral'> = { licence_critical: 'bad', mandatory: 'accent', elective: 'neutral' };
const SHOWN_SESSIONS = 3;

/** The to-book data for the page (also gives the tab its count); the page passes its own catalogue and people. */
export function useToBook(cat: ReturnType<typeof useCatalogue>, people: ReturnType<typeof usePeople>) {
  const repo = useRepo();
  const q = useQuery(['enrolments', 'sessions', 'training_records'], async () => {
    const [enrolments, sessions, records] = await Promise.all([repo.list('enrolments'), repo.list('sessions', { order: [['starts_at', 'asc']] }), repo.list('training_records')]);
    return { enrolments, sessions, records };
  }, []);
  const items = useMemo(() => (q.data && !people.loading ? toBookList(q.data.enrolments, q.data.sessions, cat.course, people.byId, new Date().toISOString(), q.data.records) : null), [q.data, people.loading, people.byId, cat.course]);
  return { q, items, cat, people };
}

export function ToBookPanel({ data }: { data: ReturnType<typeof useToBook> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const toast = useToast();
  const s = useSession();
  const { q, items, cat, people } = data;
  const [flt, setFlt] = useFilters({ bq: '', bcourse: '', bprio: '', bcrew: '', bdue: '' }, true);
  const [book, setBook] = useState<{ o: OpenSession; who: ToBookItem[] } | null>(null);
  const canBook = s.can('training', ['W', 'A']);

  const shown = useMemo(() => (items ?? []).filter((x) => (!flt.bcourse || x.e.course_id === flt.bcourse) && (!flt.bprio || x.priority === flt.bprio) && (!flt.bcrew || x.person?.crew === flt.bcrew)
    && (!flt.bdue || (flt.bdue === 'overdue' ? (x.dueIn ?? 1) < 0 : flt.bdue === '30' ? x.dueIn != null && x.dueIn <= 30 : x.dueIn == null))
    && (!flt.bq || `${people.name(x.e.person_id)} ${x.course?.code ?? ''} ${pick(x.course, 'title')}`.toLowerCase().includes(flt.bq.toLowerCase()))), [items, flt, people, pick]);
  const courseOptions = useMemo(() => [...new Set((items ?? []).map((x) => x.e.course_id))].map((id) => ({ value: id, label: `${cat.course.get(id)?.code ?? id} · ${pick(cat.course.get(id), 'title')}` })).sort((a, b) => a.label.localeCompare(b.label)), [items, cat.course, pick]);
  const crewOptions = useMemo(() => [...new Set((items ?? []).map((x) => x.person?.crew).filter(Boolean) as string[])].sort().map((c) => ({ value: c, label: `${t('m04.common.crew')} ${c}` })), [items, t]);
  const codes = (ids: string[]) => [...new Set(ids)].map((id) => cat.course.get(id)?.code ?? id).join(', ');
  const due = (x: ToBookItem) => (x.e.due_on ? <span className={x.dueIn != null && x.dueIn < 0 ? 'font-semibold text-bad' : ''}>{f.date(x.e.due_on)}{x.dueIn != null && x.dueIn < 0 ? ` · ${t('m04.toBook.overdue')}` : ''}</span> : '—');

  const runBooking = async () => {
    if (!book) return;
    let seated = 0;
    let waitlisted = 0;
    const refused: string[] = [];
    for (const x of book.who) {
      const r = await repo.rpc.enrolCourse(book.o.s.course_id, book.o.s.id, x.e.person_id);
      if (!r.ok) refused.push(`${people.name(x.e.person_id)}: ${r.message}`);
      else if (r.data?.status === 'waitlisted') waitlisted++;
      else seated++;
    }
    toast.push({ tone: refused.length ? (seated ? 'info' : 'bad') : 'ok', title: t('m04.toBook.booked', { n: f.num(seated), w: f.num(waitlisted), r: f.num(refused.length) }), detail: refused.join(' · ') || undefined });
  };

  return (
    <Async state={q}>
      {(d) => {
        if (!items) return <Skeleton lines={6} />;
        const groups = groupByCourse(shown, d.sessions, d.enrolments, new Date().toISOString());
        const overdue = shown.filter((x) => (x.dueIn ?? 1) < 0).length;
        const seats = groups.reduce((n, g) => n + g.freeSeats, 0);
        return (
          <div className="space-y-5" data-testid="m04-tobook">
            <p className="text-[13.5px] text-ink-2">{t('m04.toBook.intro')}</p>
            <FilterBar value={flt} onChange={setFlt} search="bq" fields={[
              { key: 'bcourse', label: t('m04.common.course'), options: courseOptions },
              { key: 'bprio', label: t('m04.schedule.priority'), options: (['licence_critical', 'mandatory', 'elective'] as const).map((p) => ({ value: p, label: lab.priority(p) })) },
              { key: 'bcrew', label: t('m04.common.crew'), options: crewOptions },
              { key: 'bdue', label: t('m04.toBook.due'), options: [{ value: 'overdue', label: t('m04.toBook.dueOverdue') }, { value: '30', label: t('m04.toBook.due30', { n: f.num(30) }) }, { value: 'none', label: t('m04.toBook.dueNone') }] },
            ]} />
            <Grid cols={4}>
              <StatTile label={t('m04.toBook.people')} value={f.num(shown.length)} sub={t('m04.toBook.peopleSub', { n: f.num(new Set(shown.map((x) => x.e.person_id)).size) })} />
              <StatTile label={t('m04.toBook.courses')} value={f.num(groups.length)} />
              <StatTile label={t('m04.toBook.overdueTile')} value={f.num(overdue)} tone={overdue ? 'bad' : undefined} />
              <StatTile label={t('m04.toBook.seats')} value={f.num(seats)} sub={t('m04.toBook.seatsSub')} tone={seats < shown.length ? 'sim' : 'ok'} />
            </Grid>
            {shown.length === 0 ? <Callout title={t('m04.toBook.noneTitle')}>{t('m04.toBook.none')}</Callout> : (
              <section aria-labelledby="m04-tobook-courses">
                <h2 id="m04-tobook-courses" className="mb-2 font-semibold">{t('m04.toBook.byCourse')}</h2>
                <ul className="grid gap-3 lg:grid-cols-2" data-testid="m04-tobook-courses">
                  {groups.map((g) => (
                    <Card as="li" key={g.courseId} title={<span>{g.course?.code ?? g.courseId} · {pick(g.course, 'title') || g.courseId}</span>} eyebrow={g.course ? lab.modality(g.course.modality) : undefined} actions={<Chip tone={PRIO_TONE[g.priority]}>{lab.priority(g.priority)}</Chip>}>
                      <div className="text-[13.5px] text-ink-2">
                        {t('m04.toBook.groupLine', { n: f.num(g.items.length) })}
                        {g.earliestDue != null && <> · {t('m04.toBook.earliest', { date: f.date(g.items.map((x) => x.e.due_on).filter(Boolean).sort()[0]) })}</>}
                      </div>
                      {g.items.some((x) => x.missing.length) && <p className="mt-1 text-[12.5px] text-sim" data-testid="m04-tobook-prereq">{t('m04.toBook.prereqBlocked', { n: f.num(g.items.filter((x) => x.missing.length).length), codes: codes(g.items.flatMap((x) => x.missing)) })}</p>}
                      {g.open.length === 0 ? (
                        <p className="mt-2 text-[13px] text-ink-3">{t('m04.toBook.noSession')}</p>
                      ) : (
                        <ul className="mt-2 divide-y divide-line rounded-card border border-line">
                          {g.open.slice(0, SHOWN_SESSIONS).map((o) => {
                            const who = pickForSession(o, g.items);
                            return (
                              <li key={o.s.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-[13px]">
                                <div>
                                  <div className="font-semibold">{f.dateTime(o.s.starts_at)}</div>
                                  <div className="text-[12px] text-ink-3">{lab.sessionKind(o.s.kind)} · {pick(o.s, 'location')}{o.s.crew ? ` · ${t('m04.common.crew')} ${o.s.crew}` : ''} · {t('m04.toBook.free', { n: f.num(o.free), cap: f.num(o.s.capacity) })}</div>
                                </div>
                                {canBook && who.length > 0 ? (
                                  <button className="btn-outline btn-sm" onClick={() => setBook({ o, who })} data-testid="m04-tobook-book">{t('m04.toBook.book', { n: f.num(who.length) })}</button>
                                ) : (
                                  <span className="text-[12px] text-ink-3">{o.free === 0 ? t('m04.toBook.full') : o.s.crew ? t('m04.toBook.crewOnly', { crew: o.s.crew }) : canBook ? t('m04.toBook.noneEligible') : ''}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
                        <L to={`/training/schedule?course=${encodeURIComponent(g.courseId)}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline" data-testid="m04-tobook-schedule"><Icon name="calendar" size={14} />{g.open.length === 0 ? t('m04.toBook.scheduleOne') : t('m04.toBook.openSchedule')}</L>
                        {g.items.length > g.freeSeats && <L to="/training/needs" className="text-accent hover:underline">{t('m04.toBook.needs', { n: f.num(g.items.length - g.freeSeats) })}</L>}
                      </div>
                    </Card>
                  ))}
                </ul>
              </section>
            )}
            <section aria-labelledby="m04-tobook-list">
              <h2 id="m04-tobook-list" className="mb-2 font-semibold">{t('m04.toBook.list')}</h2>
              <DataTable rows={shown} rowKey={(x) => x.e.id} searchable={false} csvName="to-book" pageSize={15} empty={t('m04.toBook.none')} columns={[
                { key: 'name', header: t('m04.cohort.person'), value: (x) => people.name(x.e.person_id), sortable: true },
                { key: 'crew', header: t('m04.common.crew'), value: (x) => x.person?.crew ?? '—', sortable: true },
                { key: 'course', header: t('m04.common.course'), value: (x) => x.course?.code ?? x.e.course_id, render: (x) => <div><div>{pick(x.course, 'title') || x.e.course_id}</div><div className="ltr text-[12px] text-ink-3">{x.course?.code}</div></div>, sortable: true },
                { key: 'prio', header: t('m04.schedule.priority'), value: (x) => lab.priority(x.priority), render: (x) => <Chip tone={PRIO_TONE[x.priority]}>{lab.priority(x.priority)}</Chip> },
                { key: 'due', header: t('m04.toBook.due'), value: (x) => x.e.due_on ?? '', render: due, sortable: true },
                { key: 'status', header: t('m04.common.status'), value: (x) => x.e.status, render: (x) => <G2Pill status={x.e.status} /> },
                { key: 'prereq', header: t('m04.toBook.prereq'), value: (x) => codes(x.missing), render: (x) => (x.missing.length ? <span className="ltr text-[12.5px] text-sim">{codes(x.missing)}</span> : '—') },
                { key: 'go', header: '', csv: false, render: (x) => <L to={`/training/schedule?course=${encodeURIComponent(x.e.course_id)}`} className="text-[13px] text-accent hover:underline">{t('m04.toBook.findSession')}</L> },
              ]} />
            </section>
            <ConfirmDialog open={!!book} onClose={() => setBook(null)} title={t('m04.toBook.confirmTitle')} actingAs={t('m04.common.roleTraining')}
              consequence={book ? t('m04.toBook.confirmBody', { n: f.num(book.who.length), course: `${cat.course.get(book.o.s.course_id)?.code ?? ''} ${pick(cat.course.get(book.o.s.course_id), 'title')}`, when: f.dateTime(book.o.s.starts_at), names: book.who.map((x) => people.name(x.e.person_id)).join(', ') }) : ''}
              onConfirm={runBooking} />
          </div>
        );
      }}
    </Async>
  );
}

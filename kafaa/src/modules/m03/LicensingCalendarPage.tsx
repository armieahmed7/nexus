// M03 /licensing/calendar (licensing coordinator): reporting obligations (candidate lists 60 days before programme start,
// 6-monthly comprehensive training plan reports, lapse reports within 3 working days, FANR exam notices 60 days ahead) and
// exam milestones in one calendar. Adding a FANR written exam adds its 60-day notice milestone; draft data packs download
// for the named role to review. Kafa'a never sends anything to FANR.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, StatusPill, Callout, FilterBar, useFilters, Modal, SelectField, TextField, ConfirmDialog, downloadText, Icon, StatTile } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useT, usePick, useFormat, useRefText } from '../../i18n';
import { RULES } from '../../auth/policy';
import { examNoticeDue, examNoticeReminder, todayIso, daysBetween, isoDate, toDate } from '../../domain/rules';
import { workingDaysLeft } from './licensing';

type Obl = RowOf<'reporting_obligations'>;
type Ms = RowOf<'exam_milestones'>;
async function load(repo: ReturnType<typeof useRepo>) {
  const [obl, ms, progs, cands, lic, people, tasks] = await Promise.all([
    repo.list('reporting_obligations', { order: [['due_on', 'asc']] }),
    repo.list('exam_milestones', { order: [['due_on', 'asc']] }),
    repo.list('licence_programmes'),
    repo.list('licence_candidates'),
    repo.list('licences'),
    repo.list('people', { filter: { kind: 'staff' } }),
    repo.list('licensing_tasks', { filter: { status: 'open' } }),
  ]);
  return { obl, ms, progs, progById: new Map(progs.map((p) => [p.id, p])), cands, lic, people: new Map(people.map((p) => [p.id, p])), tasks };
}
type Data = Awaited<ReturnType<typeof load>>;
type Entry = { id: string; date: string; source: 'obligation' | 'milestone'; o?: Obl; m?: Ms };

export default function LicensingCalendarPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['reporting_obligations', 'exam_milestones', 'licence_programmes', 'licence_candidates', 'licences', 'people', 'licensing_tasks'], () => load(repo));
  return (
    <Page title={t('m03.routes.licensing-calendar.title')} intro={t('m03.cal.intro')} wide>
      <Callout tone="info" title={t('m03.cal.calloutTitle')}>
        {t('m03.cal.calloutBody')}
      </Callout>
      <Async state={q}>{(d) => <Calendar d={d} />}</Async>
    </Page>
  );
}

function Calendar({ d }: { d: Data }) {
  const t = useT();
  const pick = usePick();
  const refText = useRefText();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const [flt, setFlt] = useFilters({ kind: '', status: 'pending', range: '' }, true);
  const [addMs, setAddMs] = useState(false);
  const [move, setMove] = useState<{ o: Obl; to: Obl['status'] } | null>(null);
  const [plan, setPlan] = useState(false);
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [...d.obl.map((o) => ({ id: o.id, date: o.due_on, source: 'obligation' as const, o })), ...d.ms.map((m) => ({ id: m.id, date: m.due_on, source: 'milestone' as const, m }))];
    return out
      .filter((e) => {
        const kind = e.o?.kind ?? e.m?.kind ?? '';
        if (flt.kind && kind !== flt.kind) return false;
        const done = e.o ? ['sent_by_owner', 'closed'].includes(e.o.status) : e.m!.status !== 'planned';
        if (flt.status === 'pending' && done) return false;
        if (flt.status === 'done' && !done) return false;
        if (flt.range === '90' && daysBetween(today, e.date) > 90) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [d, flt, today]);
  const byMonth = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) m.set(e.date.slice(0, 7), [...(m.get(e.date.slice(0, 7)) ?? []), e]);
    return [...m.entries()];
  }, [entries]);
  const lastPlan = d.obl.filter((o) => o.kind === 'training_plan_report').map((o) => o.due_on).sort().pop() ?? today;
  const nextPlan = (() => {
    const x = toDate(lastPlan);
    x.setUTCMonth(x.getUTCMonth() + RULES.trainingPlanReportMonths);
    return isoDate(x);
  })();
  const overdue = d.obl.filter((o) => ['open', 'drafted'].includes(o.status) && o.due_on < today).length;
  const monthName = (k: string) => new Intl.DateTimeFormat(f.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${k}-01T00:00:00Z`));
  const kinds = ['candidate_list', 'training_plan_report', 'lapse_report', 'withdrawal_notice', 'exam_notice', 'internal_written', 'internal_operating', 'fanr_notice', 'fanr_written', 'fanr_operating', 'result'];

  const pack = (o: Obl) => {
    const lines = [`DRAFT · ${o.title_en}`, `Due: ${o.due_on} · Rule: ${o.rule_ref} · Owner: ${o.owner_role}`, "Prepared in Kafa'a for the named role to review and send through official channels. Kafa'a sends nothing to FANR.", ''];
    if (o.kind === 'candidate_list') {
      const prog = d.progs.find((p) => p.candidate_list_due === o.due_on);
      lines.push(`Programme: ${prog?.name_en ?? '-'} (start ${prog?.start_on ?? '-'})`, '');
      for (const c of d.cands.filter((c) => c.programme_id === prog?.id && c.status !== 'withdrawn')) lines.push(`- ${d.people.get(c.person_id)?.display_name ?? c.person_id}: route ${c.route}, ${c.status}, clearance ${c.clearance}`);
    } else if (o.kind === 'training_plan_report') {
      lines.push('Programmes:');
      for (const p of d.progs) lines.push(`- ${p.name_en}: ${p.status}, start ${p.start_on}, candidates ${d.cands.filter((c) => c.programme_id === p.id && c.status !== 'withdrawn').length}`);
      lines.push('', `Certified operators (mirror): ${d.lic.length}; valid ${d.lic.filter((l) => l.status === 'valid').length}; lapsed ${d.lic.filter((l) => l.status === 'lapsed').length}`);
      lines.push('Upcoming exam milestones:');
      for (const m of d.ms.filter((m) => m.status === 'planned')) lines.push(`- ${m.due_on} ${m.kind} (${d.progById.get(m.programme_id ?? '')?.name_en ?? '-'})`);
    } else if (o.kind === 'lapse_report' && o.person_id) {
      const l = d.lic.find((x) => x.person_id === o.person_id);
      lines.push(`Certificate: ${l?.type ?? '-'} ${l?.cert_no ?? '-'} (${l?.facility ?? '-'}); lapse recorded ${l?.lapsed_on ?? '-'}; source ${l?.source_system ?? '-'}`);
    } else if (o.kind === 'exam_notice') {
      for (const m of d.ms.filter((m) => m.kind.startsWith('fanr_') && m.kind !== 'fanr_notice' && m.status === 'planned')) lines.push(`- ${m.due_on} ${m.kind} (${d.progById.get(m.programme_id ?? '')?.name_en ?? '-'})`);
    }
    downloadText(`DRAFT-${o.kind}-${o.due_on}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
  };

  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m03.cal.tOpen')} value={f.num(d.obl.filter((o) => ['open', 'drafted'].includes(o.status)).length)} />
        <StatTile label={t('m03.cal.tOverdue')} value={f.num(overdue)} tone={overdue ? 'bad' : 'ok'} />
        <StatTile label={t('m03.cal.tMilestones')} value={f.num(d.ms.filter((m) => m.status === 'planned').length)} tone="info" />
        <StatTile label={t('m03.cal.tNextPlan')} value={f.date(d.obl.filter((o) => o.kind === 'training_plan_report' && o.status !== 'sent_by_owner' && o.status !== 'closed').map((o) => o.due_on).sort()[0] ?? null)} sub={t('m03.cal.every', { n: RULES.trainingPlanReportMonths })} />
      </Grid>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <FilterBar
          value={flt}
          onChange={setFlt}
          fields={[
            { key: 'kind', label: t('m03.cal.kind'), options: kinds.map((k) => ({ value: k, label: t(`m03.kind.${k}`) })) },
            { key: 'status', label: t('m02.task.status'), options: [{ value: 'pending', label: t('m03.cal.pending') }, { value: 'done', label: t('m03.cal.done') }] },
            { key: 'range', label: t('m03.cal.range'), options: [{ value: '90', label: t('m03.cal.next90') }] },
          ]}
        />
        <div className="flex gap-2">
          <button className="btn-outline btn-sm" onClick={() => setPlan(true)} data-testid="m03-add-plan-report">
            <Icon name="plus" size={13} className="me-1 inline" />
            {t('m03.cal.addPlan')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => setAddMs(true)} data-testid="m03-add-milestone">
            <Icon name="calendar" size={13} className="me-1 inline" />
            {t('m03.cal.addMilestone')}
          </button>
        </div>
      </div>
      {byMonth.length === 0 ? (
        <EmptyState title={t('m03.cal.none')} />
      ) : (
        <div className="space-y-5" data-testid="m03-calendar">
          {byMonth.map(([k, es]) => (
            <Section key={k} title={monthName(k)}>
              <ul className="space-y-2">
                {es.map((e) => (
                  <li key={e.id} className="card flex flex-wrap items-start justify-between gap-3 p-3" data-source={e.source}>
                    <div className="flex items-start gap-3">
                      <div className="num w-12 shrink-0 text-center">
                        <div className="text-[20px] font-semibold leading-none">{f.num(Number(e.date.slice(8, 10)))}</div>
                        <div className="text-[11px] text-ink-3">{t(`m03.cal.src_${e.source}`)}</div>
                      </div>
                      <div>
                        <div className="font-semibold">{e.o ? pick(e.o, 'title') : `${t(`m03.kind.${e.m!.kind}`)}${e.m!.programme_id ? ` · ${pick(d.progById.get(e.m!.programme_id), 'name')}` : ''}`}</div>
                        <div className="text-[12.5px] text-ink-2">
                          {e.o ? `${refText(e.o.rule_ref)} · ${t('m03.cal.owner', { r: e.o.owner_role })}` : e.m!.note_en ? pick(e.m!, 'note') : ''}
                          {e.m?.person_id && <> · {d.people.get(e.m.person_id)?.display_name}</>}
                        </div>
                        {e.m?.kind === 'fanr_written' && e.m.status === 'planned' && (
                          <div className="text-[12px] text-ink-3">{t('m03.cal.noticeDates', { notice: f.date(examNoticeDue(e.m.due_on)), reminder: f.date(examNoticeReminder(e.m.due_on)) })}</div>
                        )}
                        {e.o && ['open', 'drafted'].includes(e.o.status) && (
                          <div className={`text-[12px] ${e.o.due_on < today ? 'text-bad' : 'text-ink-3'}`}>
                            {e.o.kind === 'lapse_report' ? (workingDaysLeft(today, e.o.due_on) < 0 ? t('m03.tasks.overdueWd', { n: f.num(-workingDaysLeft(today, e.o.due_on)) }) : t('m03.tasks.wdLeft', { n: f.num(workingDaysLeft(today, e.o.due_on)) })) : daysBetween(today, e.o.due_on) < 0 ? t('m02.expiredAgo', { n: f.num(-daysBetween(today, e.o.due_on)) }) : t('m02.inDays', { n: f.num(daysBetween(today, e.o.due_on)) })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {e.o ? (
                        <>
                          <StatusPill status={e.o.status === 'sent_by_owner' ? 'completed' : e.o.status}>{t(`m03.obl.s_${e.o.status}`)}</StatusPill>
                          <button className="btn-ghost btn-sm" onClick={() => pack(e.o!)} data-testid="m03-draft-pack">
                            <Icon name="download" size={13} className="me-1 inline" />
                            {t('m03.cal.pack')}
                          </button>
                          {e.o.status === 'open' && <button className="btn-outline btn-sm" onClick={() => setMove({ o: e.o!, to: 'drafted' })}>{t('m03.cal.markDrafted')}</button>}
                          {e.o.status === 'drafted' && <button className="btn-outline btn-sm" onClick={() => setMove({ o: e.o!, to: 'sent_by_owner' })} data-testid="m03-mark-sent">{t('m03.cal.markSent')}</button>}
                          {e.o.status === 'sent_by_owner' && <button className="btn-ghost btn-sm" onClick={() => setMove({ o: e.o!, to: 'closed' })}>{t('m03.cal.close')}</button>}
                        </>
                      ) : (
                        <select className="input py-1 text-[13px]" aria-label={t('m02.task.status')} value={e.m!.status} onChange={(ev) => act(() => repo.update('exam_milestones', e.m!.id, { status: ev.target.value as Ms['status'] }), { success: t('m03.cal.saved') })}>
                          {(['planned', 'done', 'missed'] as const).map((s) => (
                            <option key={s} value={s}>
                              {t(`m03.ms.s_${s}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!move}
        onClose={() => setMove(null)}
        title={move ? t(`m03.cal.move_${move.to}`) : ''}
        consequence={move ? t(`m03.cal.moveBody_${move.to}`, { title: pick(move.o, 'title') }) : ''}
        actingAs={t('m03.val.actingAs')}
        onConfirm={() => act(() => repo.update('reporting_obligations', move!.o.id, { status: move!.to }), { success: t('m03.cal.saved') })}
      />
      <ConfirmDialog
        open={plan}
        onClose={() => setPlan(false)}
        title={t('m03.cal.addPlan')}
        consequence={t('m03.cal.addPlanBody', { d: f.date(nextPlan) })}
        onConfirm={() =>
          act(() => repo.insert('reporting_obligations', { id: `ro-tpr-${nextPlan}`, kind: 'training_plan_report', title_en: `Comprehensive training plan report (due ${nextPlan})`, title_ar: `تقرير خطة التدريب الشاملة (موعده ${nextPlan})`, due_on: nextPlan, status: 'open', owner_role: 'Licensing coordinator', person_id: null, rule_ref: 'FANR-REG-17 Art. 13 (every 6 months)' }), { success: t('m03.cal.saved') })
        }
      />
      {addMs && <AddMilestone d={d} onClose={() => setAddMs(false)} />}
    </>
  );
}

function AddMilestone({ d, onClose }: { d: Data; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [prog, setProg] = useState(d.progs.find((p) => p.status !== 'closed')?.id ?? '');
  const [kind, setKind] = useState<Ms['kind']>('fanr_written');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const today = todayIso();
  const tooLate = kind === 'fanr_written' && !!date && examNoticeDue(date) < today;
  const submit = async () => {
    const r = await act(() => repo.insert('exam_milestones', { programme_id: prog || null, person_id: null, kind, due_on: date, status: 'planned', note_en: note || null, note_ar: note || null }), { success: t('m03.cal.saved') });
    if (r.ok && kind === 'fanr_written') {
      await repo.insert('exam_milestones', { programme_id: prog || null, person_id: null, kind: 'fanr_notice', due_on: examNoticeDue(date), status: 'planned', note_en: 'Notify FANR 60 days before the exam (reminder at 75 days)', note_ar: 'إخطار الهيئة قبل الاختبار بـ60 يوماً (تذكير عند 75 يوماً)' });
      await repo.insert('reporting_obligations', { kind: 'exam_notice', title_en: `FANR exam notification: ${d.progById.get(prog)?.name_en ?? 'programme'} (exam ${date})`, title_ar: `إخطار الهيئة بالاختبار: ${d.progById.get(prog)?.name_ar ?? ''} (الاختبار ${date})`, due_on: examNoticeDue(date), status: 'open', owner_role: 'Licensing coordinator', person_id: null, rule_ref: 'FANR-REG-17 Art. 7 (60 days ahead)' });
    }
    if (r.ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('m03.cal.addMilestone')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" disabled={!date} onClick={submit} data-testid="m03-milestone-confirm">
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectField label={t('m03.cand.programmes')} name="prog" value={prog} onChange={setProg} options={d.progs.map((p) => ({ value: p.id, label: pick(p, 'name') }))} />
        <SelectField label={t('m03.cal.kind')} name="kind" value={kind} onChange={(v) => setKind(v as Ms['kind'])} options={(['internal_written', 'internal_operating', 'fanr_written', 'fanr_operating', 'result'] as const).map((k) => ({ value: k, label: t(`m03.kind.${k}`) }))} />
        <TextField label={t('m03.cal.date')} name="date" type="date" value={date} onChange={setDate} required />
        <TextField label={t('m03.cal.note')} name="note" value={note} onChange={setNote} />
        {kind === 'fanr_written' && date && <Callout tone={tooLate ? 'bad' : 'info'}>{tooLate ? t('m03.cal.tooLate', { d: f.date(examNoticeDue(date)) }) : t('m03.cal.autoNotice', { notice: f.date(examNoticeDue(date)), reminder: f.date(examNoticeReminder(date)) })}</Callout>}
      </div>
    </Modal>
  );
}

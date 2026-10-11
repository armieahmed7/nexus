// /training/simulator (M04): full-scope simulator slots by crew. Licence-critical training (COCT, requalification) cannot be
// displaced by elective use; the rule is enforced by rpc.bookSimulator in both backends (canDisplace mirrors it for the UI).
import { useMemo, useState } from 'react';
import { Page, Grid, Card, StatTile, BarChart, Donut, DataTable, Modal, Callout, Icon, Tabs, Async, RadioGroup, SelectField } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { SimulatorSlotsRow } from '../../data/types';
import { useFormat, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { bookingPriority, canDisplace } from '../../domain/rules';
import { Chip, G2Pill, useLabels, usePeople } from './ui';
import { SimulatorScenariosTab } from './SimulatorScenariosTab'; // W4E3 (F28)

const KINDS = ['coct', 'requal', 'initial', 'maintenance', 'elective'] as const;
const CREWS = ['A', 'B', 'C', 'D', 'E'];
const tone = (s: SimulatorSlotsRow) => (s.booking_kind === 'free' || s.status === 'free' ? 'neutral' : s.priority === 1 ? 'bad' : s.priority === 2 ? 'info' : 'sim');
const day = (iso: string) => iso.slice(0, 10);

export default function TrainingSimulatorPage() {
  const t = useT();
  const f = useFormat();
  const lab = useLabels();
  const repo = useRepo();
  const s = useSession();
  const people = usePeople();
  const canBook = s.can('training', ['W', 'A']);
  const q = useQuery('simulator_slots', () => repo.list('simulator_slots', { order: [['starts_at', 'asc']] }), []);
  const [week, setWeek] = useState(0);
  const [slot, setSlot] = useState<SimulatorSlotsRow | null>(null);
  return (
    <Page title={t('m04.routes.training-simulator.title')} intro={t('m04.sim.intro')} wide>
      <Callout title={t('m04.sim.ruleTitle')}>{t('m04.sim.ruleBody')}</Callout>
      <Async state={q}>
        {(rows) => {
          const now = new Date();
          const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7) + week * 7));
          const days = Array.from({ length: 5 }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
          const sims = [...new Set(rows.map((r) => r.simulator))].sort();
          const future = rows.filter((r) => r.starts_at >= now.toISOString());
          const hours = (r: SimulatorSlotsRow) => (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 3_600_000;
          const booked = future.filter((r) => r.booking_kind !== 'free' && r.status !== 'free');
          const util = future.length ? (booked.reduce((n, r) => n + hours(r), 0) * 100) / future.reduce((n, r) => n + hours(r), 0) : 0;
          return (
            <Tabs initial="grid" tabs={[
              { id: 'grid', label: t('m04.sim.tabWeek'), content: (
                <div className="space-y-4">
                  <Grid cols={4}>
                    <StatTile label={t('m04.sim.utilisation')} value={f.pct(util, 0)} sub={t('m04.sim.utilisationSub', { n: f.num(future.length) })} />
                    <StatTile label={t('m04.sim.licenceCritical')} value={f.num(booked.filter((r) => r.priority === 1).length)} tone="bad" sub={t('m04.sim.licenceCriticalSub')} />
                    <StatTile label={t('m04.sim.elective')} value={f.num(booked.filter((r) => r.booking_kind === 'elective').length)} sub={t('m04.sim.electiveSub')} />
                    <StatTile label={t('m04.sim.free')} value={f.num(future.length - booked.length)} tone="ok" sub={t('m04.sim.freeSub')} />
                  </Grid>
                  <div className="flex items-center justify-between gap-2">
                    <button className="btn-outline btn-sm" onClick={() => setWeek(week - 1)} aria-label={t('m04.sim.prevWeek')}><Icon name="back" size={14} />{t('m04.sim.prevWeek')}</button>
                    <div className="font-semibold">{t('m04.sim.weekOf', { date: f.date(days[0]) })}</div>
                    <button className="btn-outline btn-sm" onClick={() => setWeek(week + 1)} aria-label={t('m04.sim.nextWeek')}>{t('m04.sim.nextWeek')}<Icon name="chevron" size={14} /></button>
                  </div>
                  <div className="card overflow-x-auto" data-testid="m04-sim-grid">
                    <table className="table-base w-full min-w-[720px] border-collapse text-[13px]">
                      <caption className="sr-only">{t('m04.sim.gridCaption')}</caption>
                      <thead className="bg-raised"><tr><th scope="col" className="text-start">{t('m04.sim.simulator')}</th>{days.map((d) => <th key={d} scope="col" className="text-start">{f.date(d, 'short')}</th>)}</tr></thead>
                      <tbody>
                        {sims.map((sim) => (
                          <tr key={sim}>
                            <th scope="row" className="text-start font-semibold ltr">{sim}</th>
                            {days.map((d) => {
                              const cell = rows.filter((r) => r.simulator === sim && day(r.starts_at) === d);
                              return (
                                <td key={d} className="align-top">
                                  {cell.length === 0 ? <span className="text-ink-3">—</span> : cell.map((r) => (
                                    <button key={r.id} type="button" disabled={!canBook} onClick={() => setSlot(r)} className="mb-1 block w-full rounded-btn border border-line p-1.5 text-start hover:border-accent disabled:cursor-default" data-testid={`m04-slot-${r.id}`}>
                                      <Chip tone={tone(r)}>{lab.booking(r.booking_kind)}</Chip>
                                      <div className="mt-0.5 text-[12px] text-ink-2">{r.crew ? `${t('m04.common.crew')} ${r.crew}` : t('m04.sim.noCrew')} · {new Date(r.starts_at).toLocaleTimeString(f.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}</div>
                                      {r.status === 'tentative' && <div className="text-[11.5px] text-sim">{t('m04.status.tentative')}</div>}
                                    </button>
                                  ))}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[12.5px]" aria-label={t('m04.sim.legend')}>
                    <Chip tone="bad">{t('m04.sim.legendP1')}</Chip><Chip tone="info">{t('m04.sim.legendP2')}</Chip><Chip tone="sim">{t('m04.sim.legendP4')}</Chip><Chip>{t('m04.sim.legendFree')}</Chip>
                  </div>
                </div>
              ) },
              { id: 'list', label: t('m04.sim.tabList'), content: (
                <DataTable rows={rows} rowKey={(r) => r.id} csvName="simulator-slots" onRowClick={canBook ? setSlot : undefined} columns={[
                  { key: 'when', header: t('m04.common.when'), value: (r) => r.starts_at, render: (r) => f.dateTime(r.starts_at), sortable: true },
                  { key: 'sim', header: t('m04.sim.simulator'), value: (r) => r.simulator, sortable: true },
                  { key: 'crew', header: t('m04.common.crew'), value: (r) => r.crew ?? '—', sortable: true },
                  { key: 'kind', header: t('m04.common.kind'), value: (r) => lab.booking(r.booking_kind), render: (r) => <Chip tone={tone(r)}>{lab.booking(r.booking_kind)}</Chip> },
                  { key: 'prio', header: t('m04.sim.priority'), value: (r) => r.priority, align: 'end', sortable: true },
                  { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} /> },
                  { key: 'by', header: t('m04.sim.bookedBy'), value: (r) => people.name(r.booked_by) },
                ]} />
              ) },
              { id: 'charts', label: t('m04.sim.tabUse'), content: (
                <Grid cols={2}>
                  <Card title={t('m04.sim.byKind')}><BarChart title={t('m04.sim.byKind')} unit=" h" data={['coct', 'requal', 'initial', 'maintenance', 'elective'].map((k) => ({ label: lab.booking(k), value: future.filter((r) => r.booking_kind === k).reduce((n, r) => n + hours(r), 0), tone: k === 'coct' || k === 'requal' ? 'bad' : undefined }))} /></Card>
                  <Card title={t('m04.sim.byCrew')}><Donut title={t('m04.sim.byCrew')} data={CREWS.map((c) => ({ label: `${t('m04.common.crew')} ${c}`, value: booked.filter((r) => r.crew === c).length }))} /></Card>
                </Grid>
              ) },
              // W4E3 (F28): scenario library, coverage and crew debriefs
              { id: 'scenarios', label: t('m04.scn.tab2.label'), content: <SimulatorScenariosTab slots={rows} /> },
            ]} />
          );
        }}
      </Async>
      {slot && <BookModal slot={slot} onClose={() => setSlot(null)} />}
    </Page>
  );
}

function BookModal({ slot, onClose }: { slot: SimulatorSlotsRow; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const [kind, setKind] = useState<string>('elective');
  const [crew, setCrew] = useState<string>(slot.crew ?? 'A');
  const allowed = useMemo(() => canDisplace(slot, kind), [slot, kind]);
  return (
    <Modal open onClose={onClose} title={t('m04.sim.bookTitle', { sim: slot.simulator, when: f.dateTime(slot.starts_at) })} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" data-testid="m04-sim-book" onClick={async () => { const r = await run(() => repo.rpc.bookSimulator(slot.id, kind, crew)); if (r.ok) onClose(); }}>{t('m04.sim.book')}</button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><span className="caps">{t('m04.sim.current')}</span><Chip tone={tone(slot)}>{lab.booking(slot.booking_kind)}</Chip>{slot.crew && <span>{t('m04.common.crew')} {slot.crew}</span>}<G2Pill status={slot.status} /></div>
        <RadioGroup label={t('m04.sim.kind')} name="kind" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: <span>{lab.booking(k)} <span className="text-ink-3">· {t('m04.sim.prioN', { n: bookingPriority(k) })}</span></span> }))} />
        <SelectField label={t('m04.common.crew')} name="crew" value={crew} onChange={setCrew} options={CREWS.map((c) => ({ value: c, label: c }))} />
        {!allowed ? <Callout tone="bad" title={t('m04.sim.blockedTitle')}>{t('m04.sim.blockedBody')}</Callout> : slot.booking_kind !== 'free' && slot.status !== 'free' ? <Callout tone="sim" title={t('m04.sim.displaceTitle')}>{t('m04.sim.displaceBody', { kind: lab.booking(slot.booking_kind) })}</Callout> : null}
        <p className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info"><Icon name="shield" size={14} className="mt-0.5" />{t('common.evidenceRecorded')}</p>
      </div>
    </Modal>
  );
}

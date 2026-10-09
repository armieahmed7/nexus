// /talent/review/:cycleId/calibration (M23 · F18): the calibration session. The HR facilitator sees the distribution across
// managers, rater patterns (share of high potential and the average evidence index per placing manager) and the outlier flags
// (deterministic: placement against the evidence index), adjusts placements with a reason, then finishes calibration. The HR
// director locks the cycle (maker-checker: never someone who placed or calibrated). Locked cycles refuse every change.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, Grid, StatTile, BarChart, ConfirmDialog, Modal, DataTable, TextArea, Icon, StatusPill, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { NOTE_MIN, boxOf } from './domain';
import { BoxName, ConfidentialNote, CyclePill, CycleSteps, FlagPills, NineBox, personName, unwrap, useCatalogue, useLabels } from './ui';
import type { BoardMember, CalibrationChange, TalentBoard } from './backend/rpc';

export default function CalibrationPage() {
  const t = useT();
  const repo = useRepo();
  const { cycleId = '' } = useParams();
  const q = useQuery(['review_placements', 'review_cycles'], () => unwrap<TalentBoard>(repo.rpc.talentBoard(cycleId)), [cycleId]);
  return (
    <Page title={t('m23.routes.talent-review-calibration.title')} intro={t('m23.cal.intro')} eyebrow={<L to={`/talent/review/${cycleId}`}>{t('m23.cal.back')}</L>} wide>
      <Async state={q}>{(b) => <Session b={b} />}</Async>
    </Page>
  );
}

interface RaterRow { id: string; name: string; n: number; high: number; low: number; avgIndex: number; flagged: number }

function Session({ b }: { b: TalentBoard }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const cat = useCatalogue();
  const lab = useLabels(cat.data);
  const [changes, setChanges] = useState<Record<string, CalibrationChange>>({});
  const [edit, setEdit] = useState<BoardMember | null>(null);
  const [confirm, setConfirm] = useState<'apply' | 'finish' | 'lock' | null>(null);
  const c = b.cycle;
  const placed = b.members.filter((m) => m.placement);
  const unplaced = b.members.length - placed.length;
  const staged = Object.values(changes);
  const boxOfM = (m: BoardMember) => (changes[m.person_id] ? boxOf(changes[m.person_id].perf, changes[m.person_id].potential) : m.placement!.box);
  const dist = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((box) => ({ label: `${box} · ${t(`m23.box.${box}`)}`, value: placed.filter((m) => boxOfM(m) === box).length, tone: box >= 8 ? 'ok' : box === 1 ? 'bad' : 'accent' }));
  const raters = useMemo<RaterRow[]>(() => {
    const by = new Map<string, BoardMember[]>();
    for (const m of placed) by.set(m.placement!.placed_by, [...(by.get(m.placement!.placed_by) ?? []), m]);
    return [...by].map(([id, ms]) => ({
      id, name: lang === 'ar' ? ms[0].placement!.placed_by_name_ar : ms[0].placement!.placed_by_name, n: ms.length,
      high: ms.filter((m) => m.placement!.potential === 3).length, low: ms.filter((m) => m.placement!.potential === 1).length,
      avgIndex: Math.round(ms.reduce((s, m) => s + m.index, 0) / ms.length), flagged: ms.filter((m) => m.flags.length).length,
    })).sort((a, x) => x.n - a.n);
  }, [placed, lang]);
  const outliers = placed.filter((m) => m.flags.length);
  const locked = c.status === 'locked';
  const canCal = b.can.calibrate && !locked;
  const raterCols: Column<RaterRow>[] = [
    { key: 'name', header: t('m23.cal.colManager'), value: (r) => r.name, sortable: true },
    { key: 'n', header: t('m23.cal.colPlaced'), value: (r) => r.n, sortable: true, align: 'end' },
    { key: 'high', header: t('m23.cal.colHigh'), value: (r) => r.high, sortable: true, align: 'end', render: (r) => <span className="num">{f.num(r.high)} ({f.pct((r.high / r.n) * 100, 0)})</span> },
    { key: 'low', header: t('m23.cal.colLow'), value: (r) => r.low, sortable: true, align: 'end' },
    { key: 'avg', header: t('m23.cal.colAvg'), value: (r) => r.avgIndex, sortable: true, align: 'end' },
    { key: 'flag', header: t('m23.cal.colPattern'), value: (r) => r.flagged, render: (r) => (r.n >= 3 && r.high / r.n > 0.4 ? <StatusPill tone="sim">{t('m23.cal.lenient')}</StatusPill> : r.flagged ? <StatusPill tone="bad">{t('m23.cal.hasOutliers', { n: f.num(r.flagged) })}</StatusPill> : <StatusPill tone="ok">{t('m23.cal.inLine')}</StatusPill>) },
  ];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[19px] font-semibold">{pick(c, 'title')}</h2>
          <CycleSteps status={c.status} />
        </div>
        <CyclePill status={c.status} />
      </div>
      <ConfidentialNote />
      {locked ? <Callout tone="ok" title={t('m23.board.lockedTitle', { date: f.date(c.locked_at) })}>{t('m23.cal.lockedBody', { name: c.locked_name ?? '' })}</Callout>
        : !b.can.calibrate ? <Callout title={t('m23.cal.viewOnly')}>{t('m23.cal.viewOnlyBody')}</Callout>
          : <Callout tone="sim" title={t('m23.cal.facilitator')}>{t('m23.cal.facilitatorBody')}</Callout>}
      <Grid cols={4}>
        <StatTile label={t('m23.board.placedTile')} value={f.num(placed.length)} sub={t('m23.cal.unplaced', { n: f.num(unplaced) })} tone={unplaced ? 'info' : 'ok'} />
        <StatTile label={t('m23.board.flagged')} value={f.num(outliers.length)} tone={outliers.length ? 'bad' : 'ok'} />
        <StatTile label={t('m23.cal.calibrated')} value={f.num(placed.filter((m) => m.placement!.calibrated).length)} sub={c.calibrated_at ? t('m23.cal.finishedOn', { date: f.date(c.calibrated_at) }) : t('m23.cal.notFinished')} />
        <StatTile label={t('m23.cal.staged')} value={f.num(staged.length)} tone={staged.length ? 'info' : undefined} />
      </Grid>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m23.cal.distribution')}>
          <BarChart title={t('m23.cal.distribution')} data={dist} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m23.cal.distributionNote')}</p>
        </Card>
        <Card title={t('m23.board.gridTitle')}><NineBox members={b.members} lang={lang} onPick={(id) => { const m = b.members.find((x) => x.person_id === id); if (m && canCal) setEdit(m); }} testId="m23-cal-grid" /></Card>
      </div>
      <Section title={t('m23.cal.raters')} description={t('m23.cal.ratersDesc')}>
        <div data-testid="m23-raters"><DataTable rows={raters} columns={raterCols} rowKey={(r) => r.id} searchable={false} caption={t('m23.cal.raters')} empty={<EmptyState title={t('m23.cal.noPlacements')} />} /></div>
      </Section>
      <Section title={t('m23.cal.outliers')} description={b.cuts ? t('m23.cal.outliersDesc', { low: f.num(b.cuts.low), high: f.num(b.cuts.high) }) : t('m23.board.noCuts')}>
        {outliers.length === 0 ? <EmptyState icon="check" title={t('m23.cal.noOutliers')} /> : (
          <ul className="space-y-2" data-testid="m23-outliers">
            {outliers.map((m) => (
              <li key={m.person_id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="font-semibold">{personName(m, lang)} <span className="font-normal text-ink-3">· {lab.roleShort(m.role_id)}</span></div>
                  <div className="text-[12.5px] text-ink-2">{t('m23.cal.outlierLine', { box: f.num(m.placement!.box), index: f.num(m.index) })} · <BoxName box={m.placement!.box} /></div>
                  <div className="mt-1"><FlagPills flags={m.flags} /></div>
                </div>
                {canCal && <button className="btn-outline btn-sm" onClick={() => setEdit(m)} data-testid="m23-adjust">{changes[m.person_id] ? t('m23.cal.adjusted') : t('m23.cal.adjust')}</button>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {staged.length > 0 && (
        <Section title={t('m23.cal.stagedTitle')}>
          <ul className="space-y-1 text-[13px]" data-testid="m23-staged">
            {staged.map((x) => { const m = b.members.find((y) => y.person_id === x.person_id)!; return <li key={x.person_id}>{personName(m, lang)}: <span className="num">{f.num(m.placement!.box)} → {f.num(boxOf(x.perf, x.potential))}</span> · {x.note}</li>; })}
          </ul>
        </Section>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {canCal && <button className="btn-outline" disabled={!staged.length} onClick={() => setConfirm('apply')} data-testid="m23-cal-apply">{t('m23.cal.apply', { n: f.num(staged.length) })}</button>}
        {canCal && <button className="btn-primary" onClick={() => setConfirm('finish')} data-testid="m23-cal-finish"><Icon name="check" size={14} />{t('m23.cal.finish')}</button>}
        {b.can.lock_blocker !== null || b.can.lock ? (
          <span className="flex flex-wrap items-center gap-2">
            <button className="btn-danger" disabled={!b.can.lock} onClick={() => setConfirm('lock')} data-testid="m23-lock"><Icon name="lock" size={14} />{t('m23.cal.lock')}</button>
            {b.can.lock_blocker && <span className="text-[12.5px] text-sim" data-testid="m23-lock-blocker">{t(`m23.cal.blocker.${b.can.lock_blocker}`)}</span>}
          </span>
        ) : null}
      </div>
      {edit && <AdjustModal m={edit} cur={changes[edit.person_id]} onClose={() => setEdit(null)} onSave={(x) => { setChanges((s) => ({ ...s, [x.person_id]: x })); setEdit(null); }} />}
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} danger={confirm === 'lock'} requireReason={confirm === 'lock'} reasonLabel={t('m23.cal.lockNote')}
        title={confirm ? t(`m23.cal.confirm.${confirm}.title`) : ''} consequence={confirm ? t(`m23.cal.confirm.${confirm}.body`, { n: f.num(staged.length) }) : ''}
        confirmLabel={confirm === 'lock' ? t('m23.cal.lock') : confirm === 'finish' ? t('m23.cal.finish') : t('m23.cal.applyShort')}
        onConfirm={async (reason) => {
          if (confirm === 'lock') { await run(() => repo.rpc.lockCycle(c.id, reason)); return; }
          const r = await run(() => repo.rpc.calibrateCycle(c.id, staged, confirm === 'finish'));
          if (r.ok) setChanges({});
        }} />
    </>
  );
}

function AdjustModal({ m, cur, onClose, onSave }: { m: BoardMember; cur?: CalibrationChange; onClose: () => void; onSave: (x: CalibrationChange) => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const [perf, setPerf] = useState(cur?.perf ?? m.placement!.perf);
  const [pot, setPot] = useState(cur?.potential ?? m.placement!.potential);
  const [note, setNote] = useState(cur?.note ?? '');
  const ok = note.trim().length >= NOTE_MIN;
  return (
    <Modal open onClose={onClose} title={t('m23.cal.adjustTitle', { name: personName(m, lang) })}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!ok} onClick={() => onSave({ person_id: m.person_id, perf, potential: pot, note: note.trim() })} data-testid="m23-adjust-save">{t('m23.cal.stage')}</button></>}>
      <div className="space-y-3 text-[13px]">
        <p className="text-ink-2">{t('m23.cal.adjustBody', { box: f.num(m.placement!.box), index: f.num(m.index) })}</p>
        <FlagPills flags={m.flags} />
        {(['perf', 'pot'] as const).map((k) => (
          <fieldset key={k}>
            <legend className="mb-1 font-semibold">{t(k === 'perf' ? 'm23.place.perf' : 'm23.place.potential')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3].map((v) => {
                const on = (k === 'perf' ? perf : pot) === v;
                return <button key={v} type="button" aria-pressed={on} className={`btn-sm ${on ? 'btn-primary' : 'btn-outline'}`} onClick={() => (k === 'perf' ? setPerf(v) : setPot(v))}>{t(`m23.${k}.${v}`)}</button>;
              })}
            </div>
          </fieldset>
        ))}
        <div className="font-semibold">{t('m23.cal.newBox')}: <span className="num">{f.num(boxOf(perf, pot))}</span> · <BoxName box={boxOf(perf, pot)} /></div>
        <TextArea label={t('m23.cal.reason')} name="reason" value={note} onChange={setNote} rows={3} hint={t('m23.cal.reasonHint')} />
      </div>
    </Modal>
  );
}

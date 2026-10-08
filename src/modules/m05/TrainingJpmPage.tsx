// /training/jpm (M05): JPM evaluator. Step-by-step pass/fail with critical steps; a failed critical step fails the JPM
// regardless of total score (scoreJpm, rpc.recordJpm); self-evaluation is refused. Works offline (queued in this browser)
// and syncs later. Results update a qualification record only after the evaluator signs off the task (rpc.signoffEvaluation).
import { useEffect, useMemo, useState } from 'react';
import { Page, Tabs, Grid, Card, Async, EmptyState, ConfirmDialog, DataTable, Callout, Icon, StatTile, BarChart, SelectField, CheckboxField, TextArea, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { JpmsRow } from '../../data/types';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { scoreJpm } from '../../domain/rules';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { evaluatorCalibration } from '../../domain/learning';
import { Chip, G2Pill, usePeople } from '../m04/ui';

type Step = { n: number; en: string; ar: string; critical: boolean };
type Queued = { id: string; jpm_id: string; person_id: string; steps: { n: number; result: 'pass' | 'fail' }[]; at: string };
const QKEY = 'kafaa.jpm.offline.v1';
const readQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]') as Queued[]; } catch { return []; } };
const writeQueue = (q: Queued[]) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* blocked */ } };

export default function TrainingJpmPage() {
  const t = useT();
  return (
    <Page title={t('m05.routes.training-jpm.title')} intro={t('m05.jpm.intro')} wide>
      <Tabs initial="evaluate" tabs={[
        { id: 'evaluate', label: t('m05.jpm.tabEvaluate'), content: <Evaluate /> },
        { id: 'results', label: t('m05.jpm.tabResults'), content: <Results /> },
        { id: 'calibration', label: t('m05.jpm.tabCalibration'), content: <Calibration /> },
      ]} />
    </Page>
  );
}

function Evaluate() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const people = usePeople();
  const me = s.identity.personId;
  const q = useQuery(['jpms', 'qual_standards', 'qual_records', 'evaluator_quals'], async () => {
    const [jpms, standards, records, evq] = await Promise.all([repo.list('jpms'), repo.list('qual_standards', { filter: { status: 'current' } }), repo.list('qual_records'), repo.list('evaluator_quals', { filter: { person_id: me ?? '' } }).catch(() => [])]);
    return { jpms, standards: standards.filter((x) => !x.security_restricted && jpms.some((j) => j.standard_id === x.id)), records, evq };
  }, [me]);
  const [std, setStd] = useState('');
  const [jpmId, setJpmId] = useState('');
  const [person, setPerson] = useState('');
  const [res, setRes] = useState<Record<number, 'pass' | 'fail'>>({});
  const [note, setNote] = useState('');
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<Queued[]>(readQueue);
  const [confirm, setConfirm] = useState(false);
  const [last, setLast] = useState<{ result: string; critical_failed: boolean; record_id: string | null; task_id: string | null } | null>(null);
  const [signoff, setSignoff] = useState(false);
  useEffect(() => { setRes({}); setLast(null); }, [jpmId, person]);
  useEffect(() => writeQueue(queue), [queue]);

  return (
    <Async state={q}>
      {(d) => {
        const jpm = d.jpms.find((j) => j.id === jpmId) as JpmsRow | undefined;
        const steps = (jpm?.critical_steps ?? []) as Step[];
        const score = scoreJpm(steps, steps.map((x) => ({ n: x.n, result: res[x.n] ?? 'fail' })));
        const complete = steps.length > 0 && steps.every((x) => res[x.n]);
        const candidates = d.records.filter((r) => r.standard_id === std && r.person_id !== me).map((r) => r.person_id);
        const record = d.records.find((r) => r.standard_id === std && r.person_id === person);
        const qualified = d.evq.some((x) => x.standard_id === std && x.valid_to >= new Date().toISOString().slice(0, 10));
        const doRecord = async () => {
          const payload = steps.map((x) => ({ n: x.n, result: res[x.n] }));
          if (offline) {
            setQueue([...queue, { id: `q-${Date.now()}`, jpm_id: jpmId, person_id: person, steps: payload as Queued['steps'], at: new Date().toISOString() }]);
            setRes({});
            return;
          }
          const r = await run(() => repo.rpc.recordJpm(jpmId, person, payload as Queued['steps']));
          if (r.ok && r.data) setLast({ result: r.data.result, critical_failed: r.data.critical_failed, record_id: record?.id ?? null, task_id: jpm?.task_id ?? null });
        };
        const sync = async () => {
          const left: Queued[] = [];
          for (const x of queue) { const r = await repo.rpc.recordJpm(x.jpm_id, x.person_id, x.steps); if (!r.ok) left.push(x); }
          setQueue(left);
          await run(async () => ({ ok: left.length === 0, code: left.length ? 'error' : 'ok', message: left.length ? t('m05.jpm.syncPartial', { n: left.length }) : t('m05.jpm.synced') }));
        };
        return (
          <div className="space-y-4">
            <Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField label={t('m05.jpm.standard')} name="std" value={std} onChange={(v) => { setStd(v); setJpmId(''); setPerson(''); }} options={d.standards.map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'title')}` }))} />
                <SelectField label={t('m05.jpm.jpm')} name="jpm" value={jpmId} disabled={!std} onChange={setJpmId} options={d.jpms.filter((j) => j.standard_id === std).map((j) => ({ value: j.id, label: `${j.code} · ${pick(j, 'title')}` }))} />
                <SelectField label={t('m05.jpm.candidate')} name="person" value={person} disabled={!std} onChange={setPerson} options={candidates.map((id) => ({ value: id, label: people.name(id) }))} hint={t('m05.jpm.candidateHint')} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <CheckboxField label={t('m05.jpm.offline')} hint={t('m05.jpm.offlineHint')} checked={offline} onChange={setOffline} />
                {std && <Chip tone={qualified ? 'ok' : 'sim'}>{qualified ? t('m05.jpm.evaluatorQualified') : t('m05.jpm.evaluatorNotQualified')}</Chip>}
              </div>
            </Card>
            {queue.length > 0 && <Callout tone="sim" title={t('m05.jpm.queued', { n: f.num(queue.length) })}>{t('m05.jpm.queuedBody')} <button className="btn-primary btn-sm ms-2" onClick={sync} disabled={offline} data-testid="m05-jpm-sync">{t('m05.jpm.sync')}</button></Callout>}
            {!jpm ? <EmptyState icon="check" title={t('m05.jpm.pick')}>{t('m05.jpm.pickBody')}</EmptyState> : (
              <Grid cols={3}>
                <Card className="sm:col-span-2" eyebrow={<span className="ltr">{jpm.code}</span>} title={pick(jpm, 'title')} footer={pick(jpm, 'pass_criteria')}>
                  <ol className="space-y-2" data-testid="m05-jpm-steps">
                    {steps.map((x) => (
                      <li key={x.n} className={`rounded-btn border p-3 ${x.critical ? 'border-bad-line' : 'border-line'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0"><span className="num me-2 font-semibold text-ink-3">{f.num(x.n)}.</span>{lang === 'ar' ? x.ar : x.en}{x.critical && <Chip tone="bad">{t('m05.jpm.critical')}</Chip>}</div>
                          <div role="radiogroup" aria-label={t('m05.jpm.stepResult', { n: x.n })} className="flex gap-1">
                            <button role="radio" aria-checked={res[x.n] === 'pass'} className={`btn-sm ${res[x.n] === 'pass' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRes({ ...res, [x.n]: 'pass' })}>{t('m05.jpm.sat')}</button>
                            <button role="radio" aria-checked={res[x.n] === 'fail'} className={`btn-sm ${res[x.n] === 'fail' ? 'btn-danger' : 'btn-outline'}`} onClick={() => setRes({ ...res, [x.n]: 'fail' })}>{t('m05.jpm.unsat')}</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3"><TextArea label={t('m05.jpm.notes')} hint={t('m05.jpm.notesHint')} name="note" value={note} onChange={setNote} rows={2} /></div>
                </Card>
                <div className="space-y-3">
                  <StatTile label={t('m05.jpm.liveScore')} value={f.pct(score.scorePct, 0)} tone={complete ? (score.result === 'pass' ? 'ok' : 'bad') : undefined} sub={complete ? (score.criticalFailed ? t('m05.jpm.criticalFailedSub') : score.result === 'pass' ? t('m05.jpm.passSub') : t('m05.jpm.belowSub')) : t('m05.jpm.incomplete', { n: f.num(steps.filter((x) => !res[x.n]).length) })} />
                  {complete && score.criticalFailed && <Callout tone="bad" title={t('m05.jpm.criticalFailed')}>{t('m05.jpm.criticalRule')}</Callout>}
                  <button className="btn-primary w-full" disabled={!complete || !person} onClick={() => setConfirm(true)} data-testid="m05-jpm-record">{offline ? t('m05.jpm.queue') : t('m05.jpm.record')}</button>
                  {last && (
                    <Card title={t('m05.jpm.recorded')} actions={<G2Pill status={last.result === 'pass' ? 'passed' : 'failed'} />}>
                      <p className="text-[13px] text-ink-2">{t('m05.jpm.signoffNote')}</p>
                      {last.record_id && last.task_id ? <button className="btn-outline btn-sm mt-2" onClick={() => setSignoff(true)} data-testid="m05-jpm-signoff">{t('m05.jpm.signoff')}</button> : <p className="mt-1 text-[12.5px] text-ink-3">{t('m05.jpm.noRecord')}</p>}
                    </Card>
                  )}
                </div>
              </Grid>
            )}
            <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m05.jpm.confirmTitle')} actingAs={t('m04.common.roleEvaluator')}
              consequence={t('m05.jpm.confirmBody', { name: people.name(person), result: score.result === 'pass' ? t('m04.status.passed') : t('m04.status.failed'), score: f.pct(score.scorePct, 0) })} onConfirm={doRecord} />
            <ConfirmDialog open={signoff} onClose={() => setSignoff(false)} title={t('m05.jpm.signoff')} actingAs={t('m04.common.roleEvaluator')} consequence={t('m05.jpm.signoffBody', { name: people.name(person) })}
              onConfirm={async () => { if (last?.record_id) await run(() => repo.rpc.signoffEvaluation({ record_id: last.record_id!, task_id: last.task_id, method: 'jpm', result: last.result === 'pass' ? 'pass' : 'fail', critical_failed: last.critical_failed })); }} />
          </div>
        );
      }}
    </Async>
  );
}

function Results() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const people = usePeople();
  const q = useQuery(['jpm_results', 'jpms'], async () => {
    const [rows, jpms] = await Promise.all([repo.list('jpm_results', { order: [['date', 'desc']] }), repo.list('jpms')]);
    return { rows, jpms };
  }, []);
  return (
    <Async state={q} isEmpty={(d) => d.rows.length === 0} empty={<EmptyState icon="check" title={t('m05.jpm.noResults')} />}>
      {(d) => people.loading ? <Skeleton /> : (
        <DataTable rows={d.rows} rowKey={(r) => r.id} csvName="jpm-results" initialSort={{ key: 'date', dir: 'desc' }} columns={[
          { key: 'date', header: t('m05.my.date'), value: (r) => r.date, render: (r) => f.date(r.date), sortable: true },
          { key: 'jpm', header: t('m05.jpm.jpm'), value: (r) => d.jpms.find((j) => j.id === r.jpm_id)?.code ?? r.jpm_id, render: (r) => { const j = d.jpms.find((x) => x.id === r.jpm_id); return <div><div className="ltr text-[12px] text-ink-3">{j?.code}</div>{j ? pick(j, 'title') : r.jpm_id}</div>; } },
          { key: 'person', header: t('m05.jpm.candidate'), value: (r) => people.name(r.person_id), sortable: true },
          { key: 'eval', header: t('m05.jpm.evaluator'), value: (r) => people.name(r.evaluator_person_id) },
          { key: 'score', header: t('m05.my.score'), value: (r) => r.score_pct, render: (r) => f.pct(r.score_pct, 0), align: 'end', sortable: true },
          { key: 'crit', header: t('m05.jpm.critical'), value: (r) => (r.critical_failed ? 1 : 0), render: (r) => (r.critical_failed ? <Chip tone="bad">{t('m05.jpm.criticalFailed')}</Chip> : '—') },
          { key: 'result', header: t('m04.common.result'), value: (r) => r.result, render: (r) => <G2Pill status={r.result === 'pass' ? 'passed' : 'failed'} /> },
          { key: 'signed', header: t('m05.jpm.signedCol'), value: (r) => (r.signed ? 1 : 0), render: (r) => (r.signed ? <Icon name="check" className="text-ok" title={t('m05.jpm.signed')} /> : <span className="text-ink-3">{t('m05.jpm.unsigned')}</span>) },
        ]} />
      )}
    </Async>
  );
}

function Calibration() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const people = usePeople();
  const q = useQuery('jpm_results', () => repo.list('jpm_results'), []);
  const all = useMemo(() => evaluatorCalibration(q.data ?? []), [q.data]);
  // Small groups (< MIN_GROUP_SIZE evaluations) are suppressed: their rates could identify individual candidates.
  const rows = all.filter((r) => r.n >= MIN_GROUP_SIZE);
  const hidden = all.length - rows.length;
  return (
    <div className="space-y-4">
      <Callout title={t('m05.jpm.calibrationTitle')}>{t('m05.jpm.calibrationBody')}</Callout>
      {all.length > 0 && hidden > 0 && <Callout tone="sim" title={t('m05.jpm.suppressedTitle')}>{t('m05.jpm.suppressed', { n: f.num(hidden), min: f.num(MIN_GROUP_SIZE) })}</Callout>}
      <Async state={q} isEmpty={() => rows.length === 0} empty={<EmptyState icon="chart" title={all.length ? t('m05.jpm.allSuppressed') : t('m05.jpm.noResults')} />}>
        {() => (
          <Grid cols={2}>
            <Card title={t('m05.jpm.passRate')}><BarChart title={t('m05.jpm.passRate')} unit="%" max={100} data={rows.map((r) => ({ label: `${people.name(r.evaluator)} (${f.num(r.n)})`, value: r.passRate }))} /></Card>
            <Card title={t('m05.jpm.critRate')}><BarChart title={t('m05.jpm.critRate')} unit="%" max={100} data={rows.map((r) => ({ label: `${people.name(r.evaluator)} (${f.num(r.n)})`, value: r.critRate, tone: 'bad' }))} /></Card>
          </Grid>
        )}
      </Async>
      <p className="text-[12.5px] text-ink-3">{t('m05.jpm.calibrationNote')}</p>
    </div>
  );
}
